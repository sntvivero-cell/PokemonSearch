// Carga completa del pokédex de Pokémon GO (todas las especies + formas alternativas
// + megas) en la tabla `pokemons`, usando la API pública de
// https://pokemon-go-api.github.io/pokemon-go-api/ (no la PokeAPI genérica que usa
// seed-pokemons.ts). Requiere la migración de la columna `form` + constraint
// compuesta (dex_number, form) ya aplicada — ver el mensaje de entrega para el SQL.
//
// Uso: npx tsx seed-pokemon-go.ts
// Necesita SUPABASE_SERVICE_ROLE_KEY en .env.local (server-only, salta RLS a
// propósito: este script no corre con sesión de usuario).

import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from './app/lib/supabaseClient';

process.loadEnvFile('.env.local');

const POKEDEX_URL = 'https://pokemon-go-api.github.io/pokemon-go-api/api/pokedex.json';
const BATCH_SIZE = 75;

interface ApiType {
  type: string;
}

interface ApiAssets {
  image?: string | null;
  shinyImage?: string | null;
}

interface ApiAssetForm {
  form: string | null;
  costume: string | null;
  isFemale: boolean;
  image?: string | null;
}

// Forma de una entrada de pokédex (base, regionForm o megaEvolution comparten esta
// forma para los campos que nos importan).
interface ApiSpeciesLike {
  names: { English: string };
  primaryType?: ApiType | null;
  secondaryType?: ApiType | null;
  assets?: ApiAssets | null;
}

interface ApiPokemon extends ApiSpeciesLike {
  id: string;
  dexNr: number;
  // Cuando no hay formas alternativas, la API a veces devuelve un array vacío en vez
  // de un objeto — hay que contemplar ambos casos.
  regionForms?: Record<string, ApiSpeciesLike & { formId: string }> | [];
  megaEvolutions?: Record<string, ApiSpeciesLike> | [];
  assetForms?: ApiAssetForm[];
}

interface PokemonRow {
  dex_number: number;
  name: string;
  sprite_url: string | null;
  types: string[];
  form: string;
}

function typeToDbValue(t: ApiType | null | undefined): string | null {
  if (!t) return null;
  return t.type.replace('POKEMON_TYPE_', '').toLowerCase();
}

// "MEGA_X" -> "Mega X" | "EXCLAMATION_POINT" -> "Exclamation Point" | "A" -> "A"
function titleCaseForm(suffix: string): string {
  return suffix
    .split('_')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// `regionForms`/`megaEvolutions` a veces traen `assets: null` (ej. las 26 letras de
// Unown) aunque el sprite SÍ existe en el array `assetForms` del Pokémon base — ahí
// queda indexado por su form key completa (ej. "UNOWN_A") o por el sufijo solo (ej.
// "ALOLA"), sin un criterio único entre especies. Probamos ambas antes de rendirnos.
function findFallbackImage(
  assetForms: ApiAssetForm[] | undefined,
  fullKey: string,
  suffix: string
): string | null {
  const match = (assetForms ?? []).find(
    (af) => !af.costume && !af.isFemale && (af.form === fullKey || af.form === suffix)
  );
  return match?.image ?? null;
}

function toRow(
  entry: ApiSpeciesLike,
  dexNumber: number,
  form: string,
  spriteFallback: string | null = null
): PokemonRow {
  const types = [typeToDbValue(entry.primaryType), typeToDbValue(entry.secondaryType)].filter(
    (t): t is string => t !== null
  );

  return {
    dex_number: dexNumber,
    name: entry.names.English,
    sprite_url: entry.assets?.image ?? spriteFallback,
    types,
    form,
  };
}

function buildRows(pokedex: ApiPokemon[]): PokemonRow[] {
  const rows: PokemonRow[] = [];

  for (const p of pokedex) {
    rows.push(toRow(p, p.dexNr, 'Normal'));

    if (p.regionForms && !Array.isArray(p.regionForms)) {
      for (const [formId, nested] of Object.entries(p.regionForms)) {
        const suffix = formId.slice(p.id.length + 1);
        const fallback = findFallbackImage(p.assetForms, formId, suffix);
        rows.push(toRow(nested, p.dexNr, titleCaseForm(suffix), fallback));
      }
    }

    if (p.megaEvolutions && !Array.isArray(p.megaEvolutions)) {
      for (const [megaKey, nested] of Object.entries(p.megaEvolutions)) {
        const suffix = megaKey.slice(p.id.length + 1);
        const fallback = findFallbackImage(p.assetForms, megaKey, suffix);
        rows.push(toRow(nested, p.dexNr, titleCaseForm(suffix), fallback));
      }
    }

    // Gigantamax queda afuera a propósito: en esta API no tiene stats/tipo propios
    // (solo aparece como sprite dentro de assetForms), y en este proyecto ya está
    // modelado como pokemon_variants.battle_state = 'gigantamax' — agregarlo acá
    // también como `form` duplicaría el concepto.
  }

  return rows;
}

async function seedPokemonGo() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en .env.local');
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('Descargando pokédex de Pokémon GO...');
  const response = await fetch(POKEDEX_URL);
  if (!response.ok) {
    throw new Error(`Fetch falló: ${response.status} ${response.statusText}`);
  }
  const pokedex: ApiPokemon[] = await response.json();
  console.log(`${pokedex.length} especies base descargadas.`);

  const rows = buildRows(pokedex);
  console.log(`${rows.length} filas a upsertear (base + formas alternativas + megas).`);

  let upserted = 0;
  let failedBatches = 0;
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    const { data, error } = await supabaseAdmin
      .from('pokemons')
      .upsert(batch, { onConflict: 'dex_number,form' })
      .select('dex_number, form');

    if (error) {
      failedBatches++;
      console.error(`[${batchNumber}/${totalBatches}] Error:`, error.message);
      continue;
    }

    upserted += data?.length ?? 0;
    console.log(`[${batchNumber}/${totalBatches}] OK (${data?.length ?? 0} filas)`);
  }

  console.log('\n--- Resumen ---');
  console.log(`Filas upserteadas con éxito: ${upserted}/${rows.length}`);
  console.log(`Lotes fallidos: ${failedBatches}/${totalBatches}`);
}

seedPokemonGo().catch((err) => {
  console.error('Seed falló:', err);
  process.exitCode = 1;
});
