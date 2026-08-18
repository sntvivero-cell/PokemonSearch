// Carga de disfraces (costumes) de Pokémon GO a la tabla `pokemons`, como filas
// adicionales con el mismo criterio que usa seed-pokemon-go.ts para formas
// regionales/megas: una fila por variante, diferenciada por `form`. No agrega
// columnas ni constraints nuevos — reutiliza (dex_number, form).
//
// La API (https://pokemon-go-api.github.io/pokemon-go-api/) no separa "disfraz" como
// concepto propio de forma limpia: dentro de `assetForms` cada entrada trae `form` o
// `costume` (uno de los dos, mutuamente excluyente), pero algunos disfraces del juego
// (Pikachu Libre, Rock Star, Pop Star, etc.) ya vienen clasificados como `form` por la
// API y entran hoy por seed-pokemon-go.ts si en algún momento se lee assetForms para
// eso; este script solo cubre las entradas con `costume` no nulo (disfraces de
// evento/temporada: Halloween, Holiday, aniversarios, etc.).
//
// Cada costume trae sprite propio (male/female). Este script usa solo el sprite
// macho (isFemale: false), igual criterio que usa el Pokémon base para su fila
// "Normal" — no se generan filas separadas por género.
//
// El sufijo interno "_NOEVOLVE" (marca técnica de la API: este disfraz no
// evoluciona/transfiere forma) se quita antes de humanizar el nombre — verificado
// que ningún Pokémon tiene a la vez la versión con y sin sufijo del mismo código, así
// que no hay colisión de `form` al quitarlo.
//
// Uso:
//   npx tsx seed-costumes.ts --dry-run   (no escribe nada, solo muestra qué haría)
//   npx tsx seed-costumes.ts             (upsert real)
// Necesita SUPABASE_SERVICE_ROLE_KEY en .env.local para el modo real.

import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from './app/lib/supabaseClient';

process.loadEnvFile('.env.local');

const POKEDEX_URL = 'https://pokemon-go-api.github.io/pokemon-go-api/api/pokedex.json';
const BATCH_SIZE = 75;

interface ApiType {
  type: string;
}

interface ApiAssetForm {
  form: string | null;
  costume: string | null;
  isFemale: boolean;
  image?: string | null;
  shinyImage?: string | null;
}

interface ApiPokemon {
  id: string;
  dexNr: number;
  names: { English: string };
  primaryType?: ApiType | null;
  secondaryType?: ApiType | null;
  assetForms?: ApiAssetForm[];
}

interface PokemonRow {
  dex_number: number;
  name: string;
  sprite_url: string | null;
  shiny_sprite_url: string | null;
  types: string[];
  form: string;
}

function typeToDbValue(t: ApiType | null | undefined): string | null {
  if (!t) return null;
  return t.type.replace('POKEMON_TYPE_', '').toLowerCase();
}

// "HALLOWEEN_2017" -> "Halloween 2017" | "JAN_2020_NOEVOLVE" -> "Jan 2020"
function humanizeCostumeCode(code: string): string {
  const withoutNoevolve = code.replace(/_NOEVOLVE$/, '');
  return titleCaseWords(withoutNoevolve);
}

function titleCaseWords(snakeCase: string): string {
  return snakeCase
    .split('_')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// La mayoría de entradas de assetForms tienen `form` o `costume`, nunca ambos — pero
// algunos Pokémon (ej. Pumpkaboo/Gourgeist por tamaño, Galarian Ponyta/Zigzagoon)
// traen ambos a la vez: el disfraz aplica sobre una forma específica, no sobre la
// especie entera. Sin incluir `form` acá, esas variantes colisionan en el mismo
// nombre (ej. las 4 formas de Pumpkaboo con el mismo disfraz de Halloween 2022 dan
// todas "Fall 2022").
function buildFormName(entry: ApiAssetForm): string {
  const costumeName = humanizeCostumeCode(entry.costume as string);
  if (!entry.form) return costumeName;
  return `${titleCaseWords(entry.form)} ${costumeName}`;
}

function buildRows(pokedex: ApiPokemon[]): PokemonRow[] {
  const rows: PokemonRow[] = [];

  for (const p of pokedex) {
    const types = [typeToDbValue(p.primaryType), typeToDbValue(p.secondaryType)].filter(
      (t): t is string => t !== null
    );

    const costumeEntries = (p.assetForms ?? []).filter((af) => af.costume && !af.isFemale);

    for (const entry of costumeEntries) {
      rows.push({
        dex_number: p.dexNr,
        name: p.names.English,
        sprite_url: entry.image ?? null,
        shiny_sprite_url: entry.shinyImage ?? null,
        types,
        form: buildFormName(entry),
      });
    }
  }

  return rows;
}

async function seedCostumes() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Descargando pokédex de Pokémon GO...');
  const response = await fetch(POKEDEX_URL);
  if (!response.ok) {
    throw new Error(`Fetch falló: ${response.status} ${response.statusText}`);
  }
  const pokedex: ApiPokemon[] = await response.json();
  console.log(`${pokedex.length} especies base descargadas.`);

  const rows = buildRows(pokedex);
  console.log(`${rows.length} filas de disfraces a upsertear.`);

  if (dryRun) {
    console.log('\n--- DRY RUN: no se escribió nada en la base ---');
    console.log(`Filas nuevas que se insertarían/actualizarían: ${rows.length}`);
    console.log('\nEjemplos (primeras 10):');
    rows.slice(0, 10).forEach((r) =>
      console.log(`  dex ${r.dex_number} ${r.name} | form: '${r.form}' | sprite: ${r.sprite_url}`)
    );
    return;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en .env.local');
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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

seedCostumes().catch((err) => {
  console.error('Seed falló:', err);
  process.exitCode = 1;
});
