import { supabase } from '@/app/lib/supabaseClient';
import type { BattleState } from '@/app/types/trades';
import type { PokemonSummary } from '@/app/components/publish/PokemonSearchPicker';

// pokemon_variants ya tiene una unique constraint que cubre (pokemon_id, is_shiny,
// costume_id, background_id, battle_state, is_lucky) — confirmado vía
// pg_get_constraintdef. Aun así seguimos con "buscar y si no existe, crear" en vez
// de upsert/onConflict porque la app ya viene funcionando así (ver historial: en su
// momento un intento de upsert con onConflict falló, y aunque la constraint hoy
// exista, no hay necesidad de arriesgar el flujo que ya anda). Esto puede dejar
// filas duplicadas ante publicaciones concurrentes con la misma combinación exacta;
// `.limit(1)` antes de `.maybeSingle()` evita que eso rompa el flujo si ya hay más
// de una fila matcheando (pasó en producción: "JSON object requested, multiple (or
// no) rows returned").
//
// costume_id sigue sin implementación de UI (siempre null) — no confundir con
// background_id, que es lo que agrega esta función ahora.
// Compartido entre /publicar y /publicar/[tradeGroupId]/editar.
export async function getOrCreateVariant(
  pokemon: PokemonSummary,
  isShiny: boolean,
  battleState: BattleState,
  backgroundId: string | null
) {
  let existingQuery = supabase
    .from('pokemon_variants')
    .select('id')
    .eq('pokemon_id', pokemon.id)
    .eq('is_shiny', isShiny)
    .eq('battle_state', battleState)
    .is('costume_id', null);

  existingQuery = backgroundId
    ? existingQuery.eq('background_id', backgroundId)
    : existingQuery.is('background_id', null);

  const { data: existing, error: selectError } = await existingQuery.limit(1).maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }
  if (existing) {
    return existing.id as string;
  }

  const { data: created, error: insertError } = await supabase
    .from('pokemon_variants')
    .insert({
      pokemon_id: pokemon.id,
      is_shiny: isShiny,
      battle_state: battleState,
      costume_id: null,
      background_id: backgroundId,
    })
    .select('id')
    .single();

  if (insertError || !created) {
    throw new Error(insertError?.message ?? 'Could not create the Pokémon variant.');
  }

  return created.id as string;
}
