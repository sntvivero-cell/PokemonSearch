-- Bug: como publish_trade_group() leía max(updated_at) de las filas EXISTENTES en
-- user_trades, borrar un post con "Eliminar" (DELETE directo, TradeCard.tsx) hacía
-- desaparecer la evidencia de que el usuario había publicado hace poco — permitiendo
-- borrar y republicar al instante, saltándose el cooldown de 30 min. Esta migración
-- mueve el "último toque" a profiles.last_trade_action_at, que sobrevive al borrado,
-- y agrega un trigger para que el borrado en sí también cuente como una acción.

-- 1. Columna nueva en profiles.
alter table public.profiles add column last_trade_action_at timestamptz;

-- 2. Helper compartido entre publish_trade_group() y el trigger de DELETE: marca
-- "ahora" como la última acción del usuario en profiles.last_trade_action_at.
--
-- profiles.user_id debería tener SIEMPRE una fila garantizada por handle_new_user()
-- (se crea en el signup, con "on conflict (user_id) do nothing" — ver migración
-- 0001), así que el camino normal es un UPDATE simple. Igual, por si alguna cuenta
-- vieja quedó sin fila en profiles por el motivo que sea, el UPDATE solo no alcanza
-- (un UPDATE sobre una fila que no existe no falla, simplemente no actualiza nada, y
-- el cooldown quedaría roto en silencio para ese usuario puntual). Por eso: si el
-- UPDATE no afectó ninguna fila (`not found`), se hace un INSERT de respaldo con el
-- mismo criterio de username de fallback que usa handle_new_user() (prefijo del
-- email), con ON CONFLICT como red de seguridad extra ante una carrera entre el
-- UPDATE y el INSERT.
create or replace function public.touch_last_trade_action(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set last_trade_action_at = now()
  where user_id = p_user_id;

  if not found then
    insert into public.profiles (user_id, username, last_trade_action_at)
    values (
      p_user_id,
      coalesce((select split_part(email, '@', 1) from auth.users where id = p_user_id), 'entrenador'),
      now()
    )
    on conflict (user_id) do update set last_trade_action_at = excluded.last_trade_action_at;
  end if;
end;
$$;

-- 3. Trigger: cualquier DELETE en user_trades (venga del botón "Eliminar" actual, de
-- publish_trade_group() editando, o de cualquier otro lado futuro que borre filas
-- directo) marca al dueño de la fila borrada como si acabara de actuar. Así borrar ya
-- no "resetea" el cooldown — al contrario, lo reinicia contra el usuario, que es el
-- comportamiento que se busca.
create or replace function public.handle_user_trade_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_last_trade_action(old.user_id);
  return old;
end;
$$;

drop trigger if exists on_user_trade_deleted on public.user_trades;
create trigger on_user_trade_deleted
after delete on public.user_trades
for each row
execute function public.handle_user_trade_deleted();

-- 4. publish_trade_group(): el cooldown ahora se lee de profiles.last_trade_action_at
-- en vez de max(updated_at) de user_trades, y al final (INSERT ya exitoso) se
-- actualiza vía el mismo helper que usa el trigger. Ownership y preservación de
-- created_at quedan exactamente igual que en la migración 0006 — no se tocan.
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

  if exists (
    select 1 from user_trades
    where trade_group_id = p_trade_group_id
      and user_id <> v_user_id
  ) then
    raise exception 'No tenés permiso para modificar esta publicación.';
  end if;

  select last_trade_action_at into v_last_action
  from public.profiles
  where user_id = v_user_id;

  if v_last_action is not null and v_last_action > now() - interval '30 minutes' then
    v_seconds_remaining := extract(epoch from (v_last_action + interval '30 minutes' - now()));
    raise exception 'cooldown_activo' using detail = v_seconds_remaining::text;
  end if;

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
    (r->>'intent')::trade_intent,
    (r->>'quantity')::int,
    r->>'notes',
    'active',
    v_created_at,
    now(),
    coalesce((r->>'is_spoofer')::boolean, false),
    coalesce(r->>'trinket_choice', 'none'),
    coalesce((r->>'open_to_offers')::boolean, false)
  from jsonb_array_elements(p_rows) as r;

  perform public.touch_last_trade_action(v_user_id);
end;
$$;

grant execute on function public.publish_trade_group(uuid, jsonb) to authenticated;
