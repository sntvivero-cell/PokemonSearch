import { supabase } from '@/app/lib/supabaseClient';
import { compressImage } from '@/app/lib/imageCompression';

const BUCKET = 'chat-images';

// Tipos reales aceptados (se valida el MIME type del archivo, no la extensión del
// nombre). El bucket además tiene su propio allowed_mime_types como segundo filtro
// server-side (migración 0013) — esto es la primera línea, para no ni intentar subir
// ni comprimir algo que va a rebotar igual.
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Límite de ENTRADA, antes de comprimir — evita que el navegador se cuelgue tratando
// de decodificar/comprimir un archivo gigante (ej. una foto RAW mal exportada).
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

// Cuánto dura una signed URL antes de que haya que pedir otra. Una conversación
// abierta un rato largo puede necesitar refrescar la de una imagen vieja — se maneja
// en el componente, no acá.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export function validateChatImageFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return 'Only JPG, PNG, or WEBP images are allowed.';
  }
  if (file.size > MAX_INPUT_BYTES) {
    return 'Image is too large (max 15MB).';
  }
  return null;
}

// Comprime y sube al bucket privado, con el path {conversation_id}/{message_id}.jpg
// que espera la policy de storage.objects (migración 0013): el primer segmento del
// path tiene que ser el id de una conversación de la que el usuario sea parte.
// `messageId` se genera del lado del cliente (crypto.randomUUID()) ANTES del insert en
// `messages`, así el mismo id sirve para el path de Storage y para la fila del
// mensaje — sin esa correlación la policy no tendría cómo saber a qué conversación
// pertenece el archivo.
export async function uploadChatImage(
  file: File,
  conversationId: string,
  messageId: string
): Promise<string> {
  const compressed = await compressImage(file);
  const path = `${conversationId}/${messageId}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) {
    throw new Error(mapStorageError(error.message));
  }

  return path;
}

// El bucket es privado — `image_url` en `messages` guarda el PATH, no una URL
// utilizable directo. Esto resuelve una signed URL temporal para mostrarla.
export async function getChatImageSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data) {
    console.error('Error creating signed URL for chat image:', error?.message);
    return null;
  }

  return data.signedUrl;
}

// Traduce el error crudo de Storage a algo que un usuario entienda — en particular el
// caso que motivó este cuidado: el plan gratuito de Supabase Storage tiene 1GB total,
// y ese límite se puede llegar a pisar.
function mapStorageError(message: string): string {
  if (/exceeded|quota|limit/i.test(message)) {
    return 'Could not upload the image: storage limit reached.';
  }
  return `Could not upload the image: ${message}`;
}
