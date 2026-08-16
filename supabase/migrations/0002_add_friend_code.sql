-- Código de amigo de Pokémon GO, opcional. Se guarda tal cual lo escribe el usuario
-- (puede incluir espacios entre grupos de 4 dígitos, ej. "1234 5678 9012") — la
-- validación de formato (12 dígitos) se hace solo en el cliente, no acá, porque no
-- vale la pena forzar un único formato de texto en la base para esto.
alter table public.profiles add column if not exists friend_code text;
