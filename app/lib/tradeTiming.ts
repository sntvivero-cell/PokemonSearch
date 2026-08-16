import { supabase } from '@/app/lib/supabaseClient';

// Cooldown único por usuario entre publicar un post nuevo o editar CUALQUIER post
// existente, sin excepción (ni siquiera reeditar el mismo post que acabás de tocar) —
// la única fuente de verdad real es la función RPC publish_trade_group (ver migración
// 0006), que chequea max(updated_at) de TODAS las filas del usuario sin excluir
// ningún trade_group_id. Esto de acá es solo un espejo en el cliente para avisar
// antes de intentar; no hace falta que sea perfecto.
export const COOLDOWN_MINUTES = 30;

const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;

export function msUntilCooldownClears(lastActionAt: string, now: number = Date.now()): number {
  const elapsed = now - new Date(lastActionAt).getTime();
  return Math.max(0, COOLDOWN_MS - elapsed);
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes < 1) return 'menos de 1 min';
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

// Busca la fila más reciente (por updated_at) de TODO el usuario — sin excluir ningún
// trade_group_id, a diferencia de la versión anterior — para avisar el cooldown en el
// formulario antes de intentar. Espejo del `select max(updated_at) ... where user_id
// = v_user_id` que hace publish_trade_group().
export async function fetchCooldownRemainingMs(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_trades')
    .select('updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return 0;

  return msUntilCooldownClears(data.updated_at);
}

// El chequeo previo de TradeForm.tsx es solo UX — si igual queda desactualizado (dos
// pestañas abiertas, reloj del cliente desfasado, etc.), publish_trade_group() rechaza
// el intento con `raise exception 'cooldown_activo' using detail = <segundos>`.
// PostgREST expone eso como PostgrestError con message === 'cooldown_activo' y
// details === '<segundos>' (como texto). Esto arma el mismo mensaje amigable a partir
// de esos segundos reales que devolvió la base, en vez de mostrar el error crudo.
export function cooldownMessageFromRpcError(
  error: { message: string; details?: string | null },
  actionVerb: string
): string | null {
  if (error.message !== 'cooldown_activo') return null;

  const secondsRemaining = Number(error.details);
  const ms = Number.isFinite(secondsRemaining) && secondsRemaining > 0 ? secondsRemaining * 1000 : COOLDOWN_MS;

  return `Podés ${actionVerb} de nuevo en ${formatDuration(ms)}.`;
}
