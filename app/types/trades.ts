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
 * `updated_at` (agregada vía migración, con trigger que la refresca en cada UPDATE)
 * se usa para el cooldown de 30 minutos del botón "Actualizar" (ver
 * app/lib/tradeTiming.ts), reforzado por una policy RESTRICTIVE de UPDATE en la base.
 * También es lo que usa app/api/cleanup/route.ts (cron externo diario) para borrar
 * físicamente los posts inactivos hace más de 7 días — no hay status='expired' ni
 * filtro por fecha en el feed: un post inactivo simplemente deja de existir.
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

export interface PokemonVariant {
  id: string;
  pokemon_id: string;
  is_shiny: boolean;
  battle_state: BattleState;
  pokemon: Pokemon;
}

export interface TradePost {
  id: string;
  trade_group_id: string;
  user_id: string;
  quantity: number;
  notes: string | null;
  status: TradeStatus;
  created_at: string;
  updated_at: string;
  offering: PokemonVariant[];
  lookingFor: PokemonVariant[];
}

export type FeedTab = 'all' | 'for_trade' | 'looking_for';