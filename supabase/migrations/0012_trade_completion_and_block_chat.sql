-- Parte 1: marcar un trade como completado. Parte 2: el bloqueo (migración 0011)
-- también bloquea el chat entre las dos partes.
--
-- Ninguna de las dos partes de abajo necesitó que confirmemos primero el contenido
-- exacto de la base en vivo (constraint de user_trades.status / policy de INSERT en
-- messages) — ambas se escribieron de forma que funcionan sin importar cuál sea ese
-- contenido actual, en vez de asumirlo a ciegas:
--   * El constraint de status se busca y reemplaza dinámicamente por nombre real (no
--     un nombre asumido) vía pg_constraint, con RAISE NOTICE del valor anterior antes
--     de tocarlo — se ve en el output cuando lo corras en el SQL Editor.
--   * El bloqueo en `messages` se agrega como policy RESTRICTIVE, que Postgres
--     combina con AND sobre CUALQUIER policy permisiva de INSERT que ya exista — no
--     hace falta tocar ni conocer esa policy existente para sumarle esta condición.

-- 1. Constraint de user_trades.status: agregar 'completed' como valor válido.
-- Encuentra el/los check constraint(s) que referencian la columna `status` sea cual
-- sea su nombre real (no se asume "user_trades_status_check"), muestra su definición
-- anterior por RAISE NOTICE, y los reemplaza por uno que acepta los 3 valores que usa
-- el código hoy (TradeStatus en app/types/trades.ts): active, completed, cancelled.
-- Si alguna fila existente tuviera un status fuera de ese set, el ADD CONSTRAINT de
-- abajo falla con un error claro (no se pierde ni se corrompe nada silenciosamente).
do $$
declare
  r record;
begin
  for r in
    select c.conname, pg_get_constraintdef(c.oid) as condef
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.user_trades'::regclass
      and c.contype = 'c'
      and a.attname = 'status'
  loop
    raise notice 'Dropping existing status check constraint %: %', r.conname, r.condef;
    execute format('alter table public.user_trades drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.user_trades
  add constraint user_trades_status_check
  check (status in ('active', 'completed', 'cancelled'));

-- 2. mark_trade_completed(): mismo patrón de ownership que publish_trade_group()
-- (migración 0008) — SECURITY DEFINER, sin policy de UPDATE adicional en user_trades
-- ni profiles porque el dueño de la función bypassea RLS igual que ya hace
-- publish_trade_group() hoy (confirma el punto 5 del pedido: no hace falta agregar
-- ninguna policy nueva de UPDATE para esto).
--
-- El incremento de profiles.total_trades_completed es UNA sola sentencia UPDATE al
-- final de la función — corre una única vez por llamada a la función,
-- independientemente de cuántas filas de user_trades tenga el trade_group_id (puede
-- ser hasta 20: hasta 10 for_trade + hasta 10 looking_for). El UPDATE de arriba que
-- pasa esas filas a 'completed' es una sentencia aparte que sí afecta N filas, pero
-- eso no tiene relación con cuántas veces se ejecuta el UPDATE de profiles, que va
-- después y una sola vez. El guard de v_already_completed además evita que llamar dos
-- veces a la función sobre el mismo post sume el contador dos veces.
create or replace function public.mark_trade_completed(p_trade_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_already_completed boolean;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if exists (
    select 1 from user_trades
    where trade_group_id = p_trade_group_id
      and user_id <> v_user_id
  ) then
    raise exception 'No tenés permiso para modificar esta publicación.';
  end if;

  if not exists (
    select 1 from user_trades
    where trade_group_id = p_trade_group_id and user_id = v_user_id
  ) then
    raise exception 'Publicación no encontrada.';
  end if;

  select bool_and(status = 'completed') into v_already_completed
  from user_trades
  where trade_group_id = p_trade_group_id and user_id = v_user_id;

  if v_already_completed then
    -- Ya estaba completo: no hace nada, sin error — evita incrementar el contador dos
    -- veces por el mismo post si el cliente llama a esto más de una vez.
    return;
  end if;

  update user_trades
  set status = 'completed', updated_at = now()
  where trade_group_id = p_trade_group_id and user_id = v_user_id;

  update public.profiles
  set total_trades_completed = total_trades_completed + 1
  where user_id = v_user_id;
end;
$$;

grant execute on function public.mark_trade_completed(uuid) to authenticated;

-- 3. Bloqueo bidireccional en el chat: policy RESTRICTIVE de INSERT en `messages`.
-- Una policy RESTRICTIVE se combina con AND sobre las policies permisivas existentes
-- (la que ya valida sender_id/participación en la conversación, sea cual sea su
-- definición exacta) — no reemplaza ni necesita conocer esa policy, solo agrega una
-- condición más que también tiene que cumplirse.
--
-- La "otra parte" de la conversación se resuelve desde `conversations` (user_a/user_b)
-- comparando contra auth.uid(), no contra sender_id de la fila nueva — así funciona
-- sin importar cuál de los dos participantes es quien está insertando.
create policy "Blocked users cannot message each other"
  on public.messages as restrictive
  for insert
  with check (
    not exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (
          exists (
            select 1 from public.blocked_users b
            where b.user_id = auth.uid()
              and b.blocked_user_id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
          )
          or exists (
            select 1 from public.blocked_users b
            where b.blocked_user_id = auth.uid()
              and b.user_id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
          )
        )
    )
  );
