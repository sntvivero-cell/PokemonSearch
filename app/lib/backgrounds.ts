import { supabase } from '@/app/lib/supabaseClient';
import type { BackgroundOption } from '@/app/types/trades';

// SELECT es público en `backgrounds` (policy "Anyone can view backgrounds").
// Catálogo de ~50 filas, se trae completo de una (se agrupa por category en la UI).
export async function fetchBackgrounds(): Promise<BackgroundOption[]> {
  const { data, error } = await supabase
    .from('backgrounds')
    .select('id, name, category')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching backgrounds:', error.message);
    return [];
  }

  return (data ?? []) as BackgroundOption[];
}
