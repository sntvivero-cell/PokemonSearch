// Carga completa del pokédex de Pokémon GO (todas las especies + formas alternativas
// + megas) en la tabla `pokemons`, usando la API pública de
// https://pokemon-go-api.github.io/pokemon-go-api/ (no la PokeAPI genérica que usa
// seed-pokemons.ts). Requiere la migración de la columna `form` + constraint
// compuesta (dex_number, form) ya aplicada — ver el mensaje de entrega para el SQL.
//
// Además de regionForms/megaEvolutions, también captura formas "huérfanas" que solo
// existen como entrada suelta dentro de `assetForms` (form no-null, costume null, sin
// contraparte en regionForms/megaEvolutions) — es el caso de Armored Mewtwo
// ("A"), que la API nunca modela como region form ni como mega, así que antes de este
// cambio el script ni siquiera intentaba insertarlo. Ver buildOrphanFormRows().
//
// Uso:
//   npx tsx seed-pokemon-go.ts --dry-run   (no escribe nada, solo muestra qué haría)
//   npx tsx seed-pokemon-go.ts             (upsert real)
// Necesita SUPABASE_SERVICE_ROLE_KEY en .env.local para el modo real (server-only,
// salta RLS a propósito: este script no corre con sesión de usuario).

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
  shinyImage?: string | null;
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
  shiny_sprite_url: string | null;
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

// Lista explícita (no heurística) de formas "huérfanas" a importar: existen solo como
// entrada suelta en `assetForms` (sin region form ni mega evolution propios), pero SÍ
// son formas de batalla reales y lanzadas en Pokémon GO — a diferencia de la mayoría
// de las entradas sueltas de `assetForms`, que son disfraces/gorros promocionales de
// eventos mal catalogados como `form` en vez de `costume` por la fuente (ver historial
// del dry-run: de 98 candidatas detectadas por un heurístico amplio, ~90 eran ese
// ruido — Pikachu Rock Star/Doctor/Tshirt/Gofest/etc. — y varias más eran Gigantamax,
// que este script excluye a propósito más abajo). Cada entrada nueva debe confirmarse
// a mano como forma real y lanzada antes de agregarse acá; no ampliar este criterio a
// "todo lo que no esté ya cubierto" sin ese chequeo, se vuelve a colar el ruido.
//
// Key: `${dexNr}:${código de form crudo tal cual lo da la API}`. Value: label humano
// para la columna `form` (y prefijo del `name`).
const ALLOWED_ORPHAN_FORMS: Record<string, string> = {
  '150:A': 'Armored', // Armored Mewtwo — raid exclusivo
  '705:HISUIAN': 'Hisuian', // Hisuian Sliggoo
  '706:HISUIAN': 'Hisuian', // Hisuian Goodra
  '716:NEUTRAL': 'Neutral', // Neutral Xerneas
  // NOTA: 646:BLACK / 646:WHITE (Black/White Kyurem) NO van acá — ya están cubiertas
  // por `regionForms` (se insertan vía el loop de regionForms más abajo, con nombre
  // "Kyurem (Black Kyurem)" / "Kyurem (White Kyurem)"). Agregarlas también acá generó
  // una fila duplicada con la misma clave (dex_number, form) y rompió el upsert
  // ("ON CONFLICT DO UPDATE command cannot affect row a second time") — confirmado en
  // la corrida real. 646:NORMAL / 649:NORMAL (Kyurem/Genesect) también se excluyen a
  // propósito: su sprite es idéntico byte a byte al de la fila base 'Normal' ya
  // sembrada por toRow() más abajo — incluirlas pisaría el nombre de esa fila sin
  // agregar nada real. Las 4 Drives de Genesect (Burn/Chill/Douse/Shock) llegan solo
  // vía regionForms si la fuente las trae ahí, no por este mecanismo.
};

// `regionForms`/`megaEvolutions` a veces traen `assets: null` (ej. las 26 letras de
// Unown) aunque el sprite SÍ existe en el array `assetForms` del Pokémon base — ahí
// queda indexado por su form key completa (ej. "UNOWN_A") o por el sufijo solo (ej.
// "ALOLA"), sin un criterio único entre especies. Probamos ambas antes de rendirnos.
function findFallbackAssetForm(
  assetForms: ApiAssetForm[] | undefined,
  fullKey: string,
  suffix: string
): ApiAssetForm | undefined {
  return (assetForms ?? []).find(
    (af) => !af.costume && !af.isFemale && (af.form === fullKey || af.form === suffix)
  );
}

function toRow(
  entry: ApiSpeciesLike,
  dexNumber: number,
  form: string,
  spriteFallback: ApiAssetForm | undefined = undefined
): PokemonRow {
  const types = [typeToDbValue(entry.primaryType), typeToDbValue(entry.secondaryType)].filter(
    (t): t is string => t !== null
  );

  return {
    dex_number: dexNumber,
    name: entry.names.English,
    sprite_url: entry.assets?.image ?? spriteFallback?.image ?? null,
    shiny_sprite_url: entry.assets?.shinyImage ?? spriteFallback?.shinyImage ?? null,
    types,
    form,
  };
}

// Entradas de `assetForms` que están en ALLOWED_ORPHAN_FORMS para esta especie. Se
// excluyen igual las de `costume` (las cubre seed-costumes.ts) e `isFemale` (sprite
// alternativo de una forma que ya existe, no una forma nueva) como guardas extra,
// aunque en la práctica el allowlist ya es suficientemente específico.
function findOrphanAssetForms(p: ApiPokemon): ApiAssetForm[] {
  return (p.assetForms ?? []).filter(
    (af) => af.form && !af.costume && !af.isFemale && `${p.dexNr}:${af.form}` in ALLOWED_ORPHAN_FORMS
  );
}

function toOrphanRow(p: ApiPokemon, entry: ApiAssetForm): PokemonRow {
  const label = ALLOWED_ORPHAN_FORMS[`${p.dexNr}:${entry.form}`];
  const types = [typeToDbValue(p.primaryType), typeToDbValue(p.secondaryType)].filter(
    (t): t is string => t !== null
  );

  return {
    dex_number: p.dexNr,
    // Hereda el nombre y el tipo de la especie base (`p`, no de la entrada de
    // assetForms, que no trae ninguno de los dos) — correcto para Armored Mewtwo
    // (sigue siendo Psychic), pero no está garantizado en general: si el dry-run
    // muestra una forma huérfana donde el tipo real difiere del de la especie base,
    // hay que resolverlo a mano antes del insert real (esta fuente de datos no da
    // tipo propio para estas entradas).
    name: `${label} ${p.names.English}`,
    sprite_url: entry.image ?? null,
    shiny_sprite_url: entry.shinyImage ?? null,
    types,
    form: label,
  };
}

function buildRows(pokedex: ApiPokemon[]): PokemonRow[] {
  const rows: PokemonRow[] = [];

  for (const p of pokedex) {
    rows.push(toRow(p, p.dexNr, 'Normal'));

    if (p.regionForms && !Array.isArray(p.regionForms)) {
      for (const [formId, nested] of Object.entries(p.regionForms)) {
        const suffix = formId.slice(p.id.length + 1);
        const fallback = findFallbackAssetForm(p.assetForms, formId, suffix);
        rows.push(toRow(nested, p.dexNr, titleCaseForm(suffix), fallback));
      }
    }

    if (p.megaEvolutions && !Array.isArray(p.megaEvolutions)) {
      for (const [megaKey, nested] of Object.entries(p.megaEvolutions)) {
        const suffix = megaKey.slice(p.id.length + 1);
        const fallback = findFallbackAssetForm(p.assetForms, megaKey, suffix);
        rows.push(toRow(nested, p.dexNr, titleCaseForm(suffix), fallback));
      }
    }

    for (const orphan of findOrphanAssetForms(p)) {
      rows.push(toOrphanRow(p, orphan));
    }

    // Gigantamax queda afuera a propósito: en esta API no tiene stats/tipo propios
    // (solo aparece como sprite dentro de assetForms), y en este proyecto ya está
    // modelado como pokemon_variants.battle_state = 'gigantamax' — agregarlo acá
    // también como `form` duplicaría el concepto.
  }

  return rows;
}

// Solo las filas huérfanas (ver findOrphanAssetForms) — separado de buildRows() para
// poder mostrarlas aparte en el reporte de --dry-run, ya que son la categoría de forma
// nueva que este cambio agrega (antes de esto, ninguna se insertaba).
function buildOrphanRows(pokedex: ApiPokemon[]): PokemonRow[] {
  const rows: PokemonRow[] = [];
  for (const p of pokedex) {
    for (const orphan of findOrphanAssetForms(p)) {
      rows.push(toOrphanRow(p, orphan));
    }
  }
  return rows;
}

async function seedPokemonGo() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Descargando pokédex de Pokémon GO...');
  const response = await fetch(POKEDEX_URL);
  if (!response.ok) {
    throw new Error(`Fetch falló: ${response.status} ${response.statusText}`);
  }
  const pokedex: ApiPokemon[] = await response.json();
  console.log(`${pokedex.length} especies base descargadas.`);

  const rows = buildRows(pokedex);
  const orphanRows = buildOrphanRows(pokedex);
  console.log(`${rows.length} filas a upsertear (base + formas alternativas + megas + formas huérfanas).`);
  console.log(`De esas, ${orphanRows.length} son formas huérfanas nuevas detectadas por el criterio ampliado (assetForms sin region form/mega asociado).`);

  if (dryRun) {
    console.log('\n--- DRY RUN: no se escribió nada en la base ---');
    console.log(`Formas huérfanas detectadas: ${orphanRows.length}`);
    orphanRows.forEach((r) =>
      console.log(`  dex ${r.dex_number} | name: '${r.name}' | form: '${r.form}' | types: [${r.types.join(', ')}] | sprite: ${r.sprite_url}`)
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

seedPokemonGo().catch((err) => {
  console.error('Seed falló:', err);
  process.exitCode = 1;
});
