export type BattleState = 'none' | 'dynamax' | 'gigantamax' | 'shadow' | 'purified';
export type TradeIntent = 'for_trade' | 'looking_for';

export interface Pokemon {
  id: string;
  dex_number: number;
  name: string;
  form: string;
  types: string[];
  sprite_url: string | null;
}

export interface Costume {
  id: string;
  name: string;
  icon_url: string | null;
}

export interface Background {
  id: string;
  name: string;
  category: 'team' | 'event_location' | 'raid' | 'other';
}

export interface PokemonVariantFull {
  id: string;
  pokemon_id: string;
  is_shiny: boolean;
  battle_state: BattleState;
  costume_id: string | null;
  background_id: string | null;
  pokemon: Pokemon;
  costume: Costume | null;
  background: Background | null;
}

// Quick-filter pill identifiers shown at the top of the pokedex
export type QuickFilterKey =
  | 'normal'
  | 'shiny'
  | 'costume'
  | 'dynamax'
  | 'gigantamax'
  | 'shadow'
  | 'purified';

// Encodes real information (Pokémon type) as color, used for the card's left accent + glow
export const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
};