-- Hace que handle_new_user lea el username elegido por el usuario en el signup
-- (pasado como options.data.username -> auth.users.raw_user_meta_data->>'username')
-- en vez de derivarlo siempre del prefijo del email.
--
-- Definición original confirmada vía `select prosrc from pg_proc where proname =
-- 'handle_new_user'`:
--   insert into public.profiles (user_id, username)
--   values (new.id, split_part(new.email, '@', 1))
--   on conflict (user_id) do nothing;
-- El `on conflict (user_id) do nothing` se conserva abajo tal cual estaba.
--
-- Fallback: si raw_user_meta_data->>'username' viene vacío o null (por ejemplo,
-- alguien se registra pasando por alto este formulario, directo contra la API),
-- se usa el prefijo del email como antes, para que el insert nunca falle por falta
-- de username.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_username text;
begin
  chosen_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');

  if chosen_username is null then
    chosen_username := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (user_id, username)
  values (new.id, chosen_username)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
