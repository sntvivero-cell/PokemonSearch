// Los posts inactivos hace más de 7 días se borran físicamente vía
// app/api/cleanup/route.ts (cron externo diario) — no hay estado intermedio
// "expirado" ni filtro por fecha acá: si la fila existe, se muestra.
export const BUMP_COOLDOWN_MINUTES = 30;

const BUMP_COOLDOWN_MS = BUMP_COOLDOWN_MINUTES * 60 * 1000;

// Espejo en el cliente de la policy RESTRICTIVE de UPDATE en Supabase (updated_at <
// now() - interval '30 minutes'). Sirve para deshabilitar el botón antes de intentar
// el UPDATE, pero la policy de la base es la que realmente lo hace cumplir.
export function msUntilNextBump(updatedAt: string, now: number = Date.now()): number {
  const elapsed = now - new Date(updatedAt).getTime();
  return Math.max(0, BUMP_COOLDOWN_MS - elapsed);
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes < 1) return 'menos de 1 min';
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}
