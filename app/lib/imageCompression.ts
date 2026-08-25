// Compresión del lado del cliente antes de subir cualquier imagen al chat — no es
// opcional: el plan gratuito de Supabase Storage da 1GB total, y fotos de cámara sin
// comprimir (fácilmente 3-8MB cada una) agotarían esa cuota en un puñado de mensajes.
// Usa Canvas API nativo (createImageBitmap + canvas.toBlob), sin librerías externas.

const DEFAULT_MAX_DIMENSION = 1000;
const DEFAULT_QUALITY = 0.78;

export interface CompressImageOptions {
  // Máximo del lado más largo, en px. La imagen nunca se agranda si ya es más chica.
  maxDimension?: number;
  // Calidad JPEG, 0-1.
  quality?: number;
}

// Redimensiona al máximo indicado (manteniendo aspect ratio) y recomprime a JPEG.
// Siempre devuelve JPEG independientemente del formato de entrada (incluido PNG con
// transparencia — el chat no necesita preservar canal alfa, y JPEG comprime bastante
// mejor que PNG para fotos reales).
export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<Blob> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const bitmap = await createImageBitmap(file);

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get a 2D canvas context to compress the image.');
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });

    if (!blob) {
      throw new Error('Could not compress the image.');
    }

    return blob;
  } finally {
    // Libera la memoria del bitmap decodificado apenas termina de dibujarse — no hace
    // falta esperar al garbage collector, createImageBitmap reserva memoria fuera del
    // heap normal de JS.
    bitmap.close();
  }
}
