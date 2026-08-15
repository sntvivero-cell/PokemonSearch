import { createClient } from '@supabase/supabase-js'

// Sustituye estas dos líneas con tus claves reales de tu panel de Supabase
// La URL del proyecto no es secreta (se exporta para reutilizarla, ej. en el cliente
// admin de app/api/cleanup/route.ts, sin duplicar el literal).
export const supabaseUrl = "https://rplcfsphdbeeletbfpom.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbGNmc3BoZGJlZWxldGJmcG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NzQ4MTIsImV4cCI6MjEwMjM1MDgxMn0.u3D-i0KQzNXIVri4EOwvsJhYo_3jg0Nd5-hbHt2RBEE"

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltan las credenciales de Supabase en supabaseClient.ts")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)