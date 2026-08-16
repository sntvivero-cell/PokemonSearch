import type { Pokemon } from './pokemons';

/**
 * Esquema real confirmado (SQL Editor de Supabase):
 * user_trades.variant_id -> pokemon_variants.id -> pokemon_variants.pokemon_id -> pokemons.id
 *
 * Cada publicación ocupa VARIAS filas en user_trades que comparten el mismo
 * `trade_group_id` (columna añadida vía migración): hasta 10 con intent='for_trade'
 * (los Pokémon que el usuario ofrece) y hasta 10 con intent='looking_for' (los que
 * busca a cambio). El feed agrupa esas filas por trade_group_id en un único
 * TradePost con ambos lados como arrays.
 *
 * `offering`/`lookingFor` son arrays (posiblemente vacíos) en vez de un único valor
 * nullable: un post puede tener 0 Pokémon de un lado (por ejemplo, si el usuario solo
 * cargó qué busca) y varios del otro. También cubre las filas insertadas ANTES del
 * soporte multi-Pokémon, que quedaron como un array de un solo elemento.
 *
 * `updated_at` (agregada vía migración; se refresca sola con cada INSERT nuevo,
 * default now(), ya no hay UPDATE de por medio) es lo que usa
 * app/api/cleanup/route.ts (cron externo diario) para borrar físicamente los posts
 * inactivos hace más de 7 días — no hay status='expired' ni filtro por fecha en el
 * feed: un post inactivo simplemente deja de existir. También es la columna que
 * chequea la policy RESTRICTIVE de INSERT para el cooldown único de 30 minutos entre
 * publicar y editar (ver app/lib/tradeTiming.ts) — ya no existe el botón "Actualizar"
 * ni la policy de UPDATE que tenía antes.
 *
 * `username` NO viene del SELECT de user_trades (no hay FK directa entre user_trades
 * y `profiles`, ambas apuntan a auth.users por separado) — se completa aparte con
 * app/lib/profiles.ts después de agrupar las filas. Por eso empieza en null en
 * app/lib/tradeGrouping.ts y cada page.tsx lo rellena tras el fetch de profiles.
 *
 * Se asume que user_trades sigue el diseño original:
 * create table user_trades (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references auth.users(id),
 *   variant_id uuid references pokemon_variants(id),
 *   intent text check (intent in ('for_trade','looking_for')),
 *   notes text,
 *   status text default 'active',
 *   created_at timestamptz default now(),
 *   trade_group_id uuid not null default gen_random_uuid(),
 *   updated_at timestamptz not null default now()
 * );
 * Si tu `select column_name, data_type from information_schema.columns
 * where table_name = 'user_trades'` muestra nombres distintos (p. ej. sin
 * `notes`, o con `username`), ajusta esta interfaz y el SELECT en page.tsx.
 */

export type TradeStatus = 'active' | 'completed' | 'cancelled';
export type TradeIntent = 'for_trade' | 'looking_for';
export type BattleState = 'none' | 'dynamax' | 'gigantamax' | 'shadow' | 'purified';
// Trinket = objeto que aumenta la chance de intercambio con suerte en Pokémon GO.
// Igual que is_spoofer, es un valor de todo el post, no de un Pokémon en particular.
export type TrinketChoice = 'none' | 'self' | 'other';

// Confirmado en producción: pokemon_variants.background_id ya existía (FK a
// backgrounds) antes de que empezáramos a usarlo. El fondo se trata como texto (un
// badge, igual que battle_state) en vez de imagen — `backgrounds` no tiene columna
// de imagen a propósito, se dropeó `icon_url` al pasar de un catálogo chico con
// miniaturas a este catálogo de ~50 nombres reales agrupados por category.
export interface BackgroundOption {
  id: string;
  name: string;
  category: string;
}

export interface PokemonVariant {
  id: string;
  pokemon_id: string;
  is_shiny: boolean;
  battle_state: BattleState;
  background: BackgroundOption | null;
  pokemon: Pokemon;
}

export interface TradePost {
  id: string;
  trade_group_id: string;
  user_id: string;
  username: string | null;
  quantity: number;
  notes: string | null;
  // Atributo del post completo (no por Pokémon) — se guarda duplicado en todas las
  // filas del grupo, mismo criterio que quantity/notes.
  is_spoofer: boolean;
  trinket_choice: TrinketChoice;
  // Si es true, `lookingFor` se ignora a efectos de mostrar Pokémon concretos: el
  // usuario acepta cualquier oferta en ese lado. Son mutuamente excluyentes (ver
  // TradeForm.tsx), así que en la práctica lookingFor queda vacío cuando esto es true.
  open_to_offers: boolean;
  status: TradeStatus;
  created_at: string;
  updated_at: string;
  offering: PokemonVariant[];
  lookingFor: PokemonVariant[];
}