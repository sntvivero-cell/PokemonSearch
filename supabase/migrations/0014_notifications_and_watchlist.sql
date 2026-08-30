-- Notificaciones por email (mensajes nuevos + watchlist) y feature de watchlist.
-- Arquitectura: nunca se llama a Resend desde dentro de una función SQL/trigger — se
-- encola una fila en `notification_queue` (INSERT rápido, no bloquea la transacción
-- real) y un Database Webhook de Supabase (configurado a mano en el dashboard, ver
-- mensaje de entrega) dispara POST a app/api/send-notifications apenas se inserta esa
-- fila, que ahí sí llama a Resend fuera de cualquier transacción de Postgres.

-- 1. Cola de notificaciones. RLS habilitado SIN ninguna policy a propósito: ni anon ni
-- authenticated tienen acceso alguno — la escriben los triggers (SECURITY DEFINER) y
-- la lee/actualiza app/api/send-notifications con SUPABASE_SERVICE_ROLE_KEY (bypassea
-- RLS). Ningún caso de uso necesita que un cliente lea su propia cola directamente.
create table public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('new_message', 'watchlist_match')),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.notification_queue enable row level security;

-- 2. Toggle de notificaciones por email — un solo interruptor global que cubre AMBOS
-- tipos de notificación (mensajes nuevos y watchlist), no uno por tipo: más simple
-- para el usuario, y es lo que espera /configuracion.
alter table public.profiles add column email_notifications_enabled boolean not null default true;

-- 3. Trigger de mensajes nuevos. Encola 'new_message' para el OTRO participante de la
-- conversación, salvo que tenga las notificaciones desactivadas. Todo el cuerpo va
-- envuelto en su propio bloque con manejo de excepción: un fallo acá (ej. la
-- conversación no existe por algún motivo raro) NUNCA debe impedir que el mensaje se
-- guarde — ya se guardó, esto es un efecto secundario best-effort.
create or replace function public.handle_new_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_recipient_id uuid;
  v_notifications_enabled boolean;
  v_sender_username text;
begin
  begin
    select user_a, user_b into v_user_a, v_user_b
    from conversations
    where id = new.conversation_id;

    if v_user_a is null then
      return new;
    end if;

    v_recipient_id := case when v_user_a = new.sender_id then v_user_b else v_user_a end;

    select email_notifications_enabled into v_notifications_enabled
    from profiles
    where user_id = v_recipient_id;

    if coalesce(v_notifications_enabled, true) is not true then
      return new;
    end if;

    select username into v_sender_username from profiles where user_id = new.sender_id;

    insert into notification_queue (type, recipient_user_id, payload)
    values (
      'new_message',
      v_recipient_id,
      jsonb_build_object(
        'senderUsername', coalesce(v_sender_username, 'A trainer'),
        'conversationId', new.conversation_id
      )
    );
  exception when others then
    raise warning 'handle_new_message_notification failed for message %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
after insert on public.messages
for each row
execute function public.handle_new_message_notification();

-- 4. Watchlist. RLS estándar: solo tus propias filas.
create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pokemon_id uuid not null references public.pokemons(id),
  created_at timestamptz not null default now(),
  unique (user_id, pokemon_id)
);

alter table public.watchlist enable row level security;

create policy "Users can view their own watchlist"
  on public.watchlist for select
  using (auth.uid() = user_id);

create policy "Users can add to their own watchlist"
  on public.watchlist for insert
  with check (auth.uid() = user_id);

create policy "Users can remove from their own watchlist"
  on public.watchlist for delete
  using (auth.uid() = user_id);

-- 5. profiles_with_rank (migración 0008): se agrega total_trades_completed a la
-- proyección para que el leaderboard pueda ordenar/desempatar sin una query aparte.
-- NO se toca get_user_rank() ni la fórmula de `rank` — es exactamente la misma
-- llamada de siempre, solo se suma una columna más al SELECT.
--
-- IMPORTANTE: CREATE OR REPLACE VIEW no permite reordenar ni insertar columnas en
-- el medio de las que ya existían (Postgres lo interpreta como un rename de columna
-- por posición y falla con "cannot change name of view column"). Por eso
-- total_trades_completed va estrictamente AL FINAL, después de `rank` — que ya era
-- la última columna de la versión anterior — y no antes de is_developer.
create or replace view public.profiles_with_rank
with (security_invoker = true) as
select
  user_id,
  username,
  friend_code,
  total_trades_published,
  is_developer,
  public.get_user_rank(total_trades_published, is_developer) as rank,
  total_trades_completed
from public.profiles;

-- 6. publish_trade_group(): se agrega el matching de watchlist DESPUÉS del insert
-- exitoso. Notifica una sola vez por publicación NUEVA (no en cada edición — evita
-- spamear a los watchers cada vez que el publicador corrige una nota o cambia algo
-- del lado "looking for"), solo por filas con intent='for_trade' (lo que se ofrece,
-- no lo que se busca), excluyendo al propio publicador, a quien lo haya bloqueado, y
-- a quien tenga las notificaciones por email desactivadas.
-- CHECKLIST — confirmar los 6 puntos antes de dar por terminado cualquier rewrite
-- futuro de esta función (los primeros 5 vienen de versiones anteriores; se perdió el
-- cast a trade_intent dos veces por reescribir la función entera sin este chequeo):
--   1. Cast (r->>'intent')::trade_intent en el INSERT (columna tipada, no text).
--   2. Chequeo de ownership contra trade_group_id de otro usuario.
--   3. Preservación de created_at original al editar (min(created_at) del grupo).
--   4. Cooldown vía profiles.last_trade_action_at (no max(updated_at) de user_trades).
--   5. Incremento de total_trades_published solo cuando v_is_new_post (no en ediciones).
--   6. Matching de watchlist solo cuando v_is_new_post, y envuelto en su propio bloque
--      con manejo de excepción — un error ahí nunca debe impedir la publicación.
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
  v_watcher record;
  v_pokemon_id uuid;
  v_pokemon_name text;
  v_row jsonb;
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

  if v_is_new_post then
    update public.profiles
    set total_trades_published = total_trades_published + 1
    where user_id = v_user_id;

    begin
      for v_row in select * from jsonb_array_elements(p_rows)
      loop
        if v_row->>'intent' = 'for_trade' then
          select pv.pokemon_id into v_pokemon_id
          from pokemon_variants pv
          where pv.id = (v_row->>'variant_id')::uuid;

          if v_pokemon_id is not null then
            select name into v_pokemon_name from pokemons where id = v_pokemon_id;

            for v_watcher in
              select w.user_id
              from watchlist w
              where w.pokemon_id = v_pokemon_id
                and w.user_id <> v_user_id
                and not exists (
                  select 1 from blocked_users b
                  where b.user_id = w.user_id and b.blocked_user_id = v_user_id
                )
                and coalesce(
                  (select p.email_notifications_enabled from profiles p where p.user_id = w.user_id),
                  true
                ) is true
            loop
              insert into notification_queue (type, recipient_user_id, payload)
              values (
                'watchlist_match',
                v_watcher.user_id,
                jsonb_build_object(
                  'pokemonName', coalesce(v_pokemon_name, 'A Pokémon'),
                  'publisherUserId', v_user_id,
                  'tradeGroupId', p_trade_group_id
                )
              );
            end loop;
          end if;
        end if;
      end loop;
    exception when others then
      raise warning 'watchlist notification matching failed for trade_group_id %: %', p_trade_group_id, sqlerrm;
    end;
  end if;
end;
$$;

grant execute on function public.publish_trade_group(uuid, jsonb) to authenticated;
