import { createClient } from '@supabase/supabase-js'

// Capturado ACÁ, antes de createClient(): con flowType implícito (default de este
// proyecto, no configurado explícitamente) supabase-js detecta y borra el hash de la
// URL solo (detectSessionInUrl), apenas se crea el cliente de abajo. Confirmado en
// vivo: el link de confirmación de mail aterriza en algo como
// "/#access_token=...&type=signup" y para cuando se mira la barra de direcciones ya
// quedó en "/#" vacío — el SDK ya lo consumió. Por eso esto se lee en el punto más
// temprano posible del bundle, antes de esa limpieza automática.
let _authRedirectType: string | null =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type')
    : null;

// Lectura de un solo uso: la primera llamada devuelve el valor real capturado arriba
// y lo borra. Necesario porque un remount del componente que lo consume (ej. navegar
// a otra ruta y volver a "/" con routing de cliente) no debe volver a disparar el
// toast de bienvenida con el mismo valor viejo.
export function consumeAuthRedirectType(): string | null {
  const value = _authRedirectType;
  _authRedirectType = null;
  return value;
}

// Sustituye estas dos líneas con tus claves reales de tu panel de Supabase
// La URL del proyecto no es secreta (se exporta para reutilizarla, ej. en el cliente
// admin de app/api/cleanup/route.ts, sin duplicar el literal).
export const supabaseUrl = "https://rplcfsphdbeeletbfpom.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbGNmc3BoZGJlZWxldGJmcG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NzQ4MTIsImV4cCI6MjEwMjM1MDgxMn0.u3D-i0KQzNXIVri4EOwvsJhYo_3jg0Nd5-hbHt2RBEE"

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltan las credenciales de Supabase en supabaseClient.ts")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)