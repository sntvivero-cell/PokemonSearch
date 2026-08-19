import { supabase } from '@/app/lib/supabaseClient';

// Trae de una sola vez los trade_group_id que el usuario ya guardó, para pasarlos
// como Set a cada TradeCard (prop `isSaved`) en vez de que cada card haga su propia
// consulta — mismo criterio que fetchProfilesWithRank para username/rank.
export async function fetchSavedTradeGroupIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('saved_trades').select('trade_group_id').eq('user_id', userId);

  if (error) {
    console.error('Error fetching saved_trades:', error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.trade_group_id as string));
}
