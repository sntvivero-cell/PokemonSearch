import { supabase } from '@/app/lib/supabaseClient';

// SELECT es público en `profiles` (policy "Anyone can view profiles"), así que esto
// funciona sin sesión también.
export async function fetchUsernames(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase.from('profiles').select('user_id, username').in('user_id', uniqueIds);

  if (error) {
    console.error('Error fetching profiles:', error.message);
    return new Map();
  }

  return new Map((data ?? []).map((p) => [p.user_id as string, p.username as string]));
}

export interface ProfileRankInfo {
  username: string | null;
  rank: string;
}

// Lee de la vista `profiles_with_rank` (migración 0008), que ya expone `rank`
// resuelto por public.get_user_rank(total_trades_published, is_developer) — evita
// llamar esa función una vez por usuario desde el cliente. La vista usa
// security_invoker, así que respeta la misma policy pública de SELECT que `profiles`.
export async function fetchProfilesWithRank(userIds: string[]): Promise<Map<string, ProfileRankInfo>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('profiles_with_rank')
    .select('user_id, username, rank')
    .in('user_id', uniqueIds);

  if (error) {
    console.error('Error fetching profiles_with_rank:', error.message);
    return new Map();
  }

  return new Map(
    (data ?? []).map((p) => [p.user_id as string, { username: p.username as string | null, rank: p.rank as string }])
  );
}
