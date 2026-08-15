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
