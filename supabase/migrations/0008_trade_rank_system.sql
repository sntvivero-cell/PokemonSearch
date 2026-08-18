-- Sistema de rangos por cantidad de publicaciones NUEVAS (no ediciones), más un rango
-- fijo para la cuenta del desarrollador. Reutiliza el mismo patrón de
-- touch_last_trade_action()/trigger de la migración 0007: el contador vive en
-- `profiles`, se toca desde dentro de publish_trade_group() (SECURITY DEFINER), y el
-- trigger de DELETE existente (handle_user_trade_deleted) NO se toca — no hay
-- decremento, el contador es estrictamente acumulado y sobrevive al borrado del post.

-- 1. Columnas nuevas en profiles.
alter table public.profiles add column total_trades_published integer not null default 0;
alter table public.profiles add column is_developer boolean not null default false;

-- 2. publish_trade_group(): idéntica a la versión de la migración 0007 (ownership,
-- cooldown vía profiles.last_trade_action_at, preservación de created_at) más UNA
-- adición: distinguir publicación nueva de edición.
--
-- Cómo se distingue: el SELECT que ya existía para decidir si preservar created_at
-- (`select min(created_at) into v_created_at from user_trades where trade_group_id =
-- p_trade_group_id and user_id = v_user_id`) YA responde esa pregunta gratis — si no
-- devuelve filas (v_created_at queda null), es porque p_trade_group_id no tenía
-- ninguna fila de este usuario ANTES del delete de abajo, es decir: es una
-- publicación genuinamente nueva, no una edición. Se guarda ese resultado en
-- v_is_new_post ANTES de pisar v_created_at con el fallback de `now()`, y se usa
-- después del INSERT para incrementar el contador solo en ese caso. Reeditar un post
-- existente (v_created_at no null) nunca lo toca.
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
  v_is_new_post boolean;
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

  v_is_new_post := v_created_at is null;

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

  perform public.touch_last_trade_action(v_user_id);

  -- Va DESPUÉS de touch_last_trade_action(): esa llamada ya garantiza que exista una
  -- fila en profiles para v_user_id (inserta una de respaldo si faltaba), así este
  -- UPDATE nunca se pierde en silencio por una fila inexistente.
  if v_is_new_post then
    update public.profiles
    set total_trades_published = total_trades_published + 1
    where user_id = v_user_id;
  end if;
end;
$$;

grant execute on function public.publish_trade_group(uuid, jsonb) to authenticated;

-- 3. Helper de rango, puro e inmutable: mismo total/is_developer siempre da el mismo
-- rango, sin tocar la base.
create or replace function public.get_user_rank(p_total integer, p_is_developer boolean)
returns text
language sql
immutable
as $$
  select case
    when p_is_developer then 'Desarrollador'
    when p_total >= 50 then 'Élite'
    when p_total >= 20 then 'Veterano'
    when p_total >= 5 then 'Entrenador'
    else 'Novato'
  end;
$$;

-- 4. Vista de lectura pública con el rango ya calculado, para no tener que llamar
-- get_user_rank() por fila desde el cliente. `security_invoker = true` hace que la
-- vista corra con los privilegios y RLS de quien consulta (no del dueño de la vista),
-- así respeta exactamente la misma policy de SELECT pública que ya tiene `profiles`
-- (ver comentario en app/lib/profiles.ts) sin necesidad de duplicarla acá.
create or replace view public.profiles_with_rank
with (security_invoker = true) as
select
  user_id,
  username,
  friend_code,
  total_trades_published,
  is_developer,
  public.get_user_rank(total_trades_published, is_developer) as rank
from public.profiles;

grant select on public.profiles_with_rank to anon, authenticated;
