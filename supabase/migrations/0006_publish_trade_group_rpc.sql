-- Reemplaza la policy RESTRICTIVE de INSERT de la migración 0005 (que excluía por
-- trade_group_id, permitiendo reeditar el mismo post sin esperar) por una función
-- SECURITY DEFINER que centraliza publicar/editar en un paso atómico. El cooldown de
-- 30 min ahora aplica a CUALQUIER publicación o edición sin excepción, incluso
-- reeditar el mismo post que acabás de tocar.

-- 1. Sacar la policy vieja: ya no aplica ningún chequeo de cooldown a nivel de INSERT
-- directo, porque el INSERT directo deja de estar permitido (ver paso 2).
drop policy if exists "Cooldown de 30 min entre publicar y editar" on public.user_trades;

-- 2. Sacar el permiso de INSERT directo a las tablas para `authenticated`/`anon`. Con
-- esto, la función de abajo (SECURITY DEFINER) pasa a ser el ÚNICO camino posible para
-- insertar filas en user_trades — si dejáramos el INSERT directo habilitado, cualquiera
-- podría saltear el cooldown llamando a `supabase.from('user_trades').insert(...)`
-- directo desde el navegador, sin pasar por la función. No se toca DELETE (lo sigue
-- usando "Eliminar publicación" en TradeCard.tsx) ni UPDATE.
revoke insert on public.user_trades from authenticated, anon;

-- 3. Función que centraliza publicar y editar (editar = borrar las filas del grupo y
-- volver a insertarlas) en un solo paso atómico, con el cooldown y el ownership
-- chequeados DENTRO de la función porque, al ser SECURITY DEFINER, corre con los
-- privilegios de su dueño y no pasa por RLS de user_trades.
--
-- Columnas reales de user_trades confirmadas contra el código actual (TradeForm.tsx +
-- ambos page.tsx que insertaban filas antes de este cambio): id (default), user_id,
-- variant_id, intent, quantity, notes, status, created_at, updated_at, trade_group_id,
-- is_spoofer, trinket_choice, open_to_offers. `p_rows` solo necesita los campos que
-- varían por fila o que ya venían duplicados en cada fila desde el cliente
-- (variant_id, intent, quantity, notes, is_spoofer, trinket_choice, open_to_offers) —
-- user_id, trade_group_id, status, created_at y updated_at los pone la función.
create or replace function public.publish_trade_group(
  p_trade_group_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_last_action timestamptz;
  v_created_at timestamptz;
  v_seconds_remaining numeric;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  -- Ownership: p_trade_group_id lo genera el cliente (crypto.randomUUID() al
  -- publicar, o el id ya existente al editar) y viaja como parámetro de una función
  -- SECURITY DEFINER — no hay que confiar ciegamente en él. Si ya existe alguna fila
  -- con ese trade_group_id que pertenezca a OTRO usuario, cortamos acá: sin este
  -- chequeo, alguien podría tomar el trade_group_id de la publicación de otra persona
  -- (es público, se ve en la URL /publicar/[tradeGroupId]/editar y en cada TradeCard)
  -- e insertar filas propias bajo ese mismo id, mezclando su contenido con el de otro
  -- usuario en el feed (groupTradeRows agrupa todo por trade_group_id sin verificar
  -- que todas las filas sean del mismo dueño).
  if exists (
    select 1 from user_trades
    where trade_group_id = p_trade_group_id
      and user_id <> v_user_id
  ) then
    raise exception 'No tenés permiso para modificar esta publicación.';
  end if;

  -- Cooldown: última acción del usuario en CUALQUIER post, sin excluir
  -- p_trade_group_id — a diferencia de la policy que reemplaza, reeditar el mismo
  -- post que acabás de tocar también cae acá, tal como pide el nuevo requisito.
  select max(updated_at) into v_last_action
  from user_trades
  where user_id = v_user_id;

  if v_last_action is not null and v_last_action > now() - interval '30 minutes' then
    v_seconds_remaining := extract(epoch from (v_last_action + interval '30 minutes' - now()));
    raise exception 'cooldown_activo' using detail = v_seconds_remaining::text;
  end if;

  -- created_at: si p_trade_group_id ya tenía filas (estamos editando), se preserva el
  -- created_at ORIGINAL de esas filas, para que el post no salte al tope del feed
  -- solo por editarlo. Si no tenía filas (post nuevo), se usa el momento actual. Esto
  -- reemplaza el `originalCreatedAt` que antes tenía que rastrear y reenviar
  -- app/publicar/[tradeGroupId]/editar/page.tsx: ahora la función lo resuelve sola,
  -- leyendo el estado real de la tabla en vez de confiar en lo que mande el cliente.
  select min(created_at) into v_created_at
  from user_trades
  where trade_group_id = p_trade_group_id and user_id = v_user_id;

  if v_created_at is null then
    v_created_at := now();
  end if;

  delete from user_trades
  where trade_group_id = p_trade_group_id and user_id = v_user_id;

  insert into user_trades (
    user_id, trade_group_id, variant_id, intent, quantity, notes,
    status, created_at, updated_at, is_spoofer, trinket_choice, open_to_offers
  )
  select
    v_user_id,
    p_trade_group_id,
    (r->>'variant_id')::uuid,
    r->>'intent',
    (r->>'quantity')::int,
    r->>'notes',
    'active',
    v_created_at,
    now(),
    coalesce((r->>'is_spoofer')::boolean, false),
    coalesce(r->>'trinket_choice', 'none'),
    coalesce((r->>'open_to_offers')::boolean, false)
  from jsonb_array_elements(p_rows) as r;
end;
$$;

-- Callable solo por usuarios autenticados (no `anon`, no `public`) — refuerza a nivel
-- de GRANT lo que la función ya valida con auth.uid() is null adentro.
grant execute on function public.publish_trade_group(uuid, jsonb) to authenticated;
