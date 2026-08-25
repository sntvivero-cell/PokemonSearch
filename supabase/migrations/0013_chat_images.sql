-- Imágenes en el chat: columna nueva en `messages`, bucket privado de Storage, y las
-- policies de ese bucket. `messages`/`conversations` no tienen migración previa en
-- este repo (se crearon a mano en el SQL Editor — ver comentario de la migración
-- 0012), así que el ajuste al constraint de `content` usa la misma técnica dinámica
-- que esa migración: encuentra el/los check constraint(s) reales que referencian la
-- columna, sea cual sea su nombre, y los reemplaza — no asume un nombre.

-- 1. content pasa a ser opcional: un mensaje puede tener texto, imagen, o ambos.
alter table public.messages alter column content drop not null;

do $$
declare
  r record;
begin
  for r in
    select c.conname, pg_get_constraintdef(c.oid) as condef
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.messages'::regclass
      and c.contype = 'c'
      and a.attname = 'content'
  loop
    raise notice 'Dropping existing content check constraint %: %', r.conname, r.condef;
    execute format('alter table public.messages drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.messages add column image_url text;

-- Guarda tanto el límite de longitud que ya usaba el cliente (MAX_MESSAGE_LENGTH =
-- 1000 en app/mensajes/[conversationId]/page.tsx) como la regla nueva: no se puede
-- mandar un mensaje completamente vacío (ni texto ni imagen).
alter table public.messages
  add constraint messages_content_length_check
  check (content is null or char_length(content) <= 1000);

alter table public.messages
  add constraint messages_content_or_image_check
  check (image_url is not null or char_length(trim(coalesce(content, ''))) > 0);

-- 2. Bucket privado. `image_url` en la fila de `messages` guarda el PATH dentro del
-- bucket (ej. "{conversation_id}/{message_id}.jpg"), no una URL pública — el bucket es
-- privado a propósito, así que el cliente resuelve una signed URL al mostrar el chat
-- (ver app/lib/chatImages.ts). allowed_mime_types/file_size_limit son un segundo
-- filtro server-side además de la validación del cliente (tipo de archivo real y
-- tamaño antes de comprimir).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3. Policies del bucket: solo puede subir/leer un archivo quien sea participante de
-- la conversación cuyo id es el primer segmento del path
-- (storage.foldername(name))[1] — el mismo id que ya usa la policy de `messages` para
-- decidir quién puede ver/escribir esa conversación.
create policy "Conversation participants can upload chat images"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.conversations c
      where c.id = (storage.foldername(name))[1]::uuid
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create policy "Conversation participants can read chat images"
  on storage.objects for select
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.conversations c
      where c.id = (storage.foldername(name))[1]::uuid
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );
