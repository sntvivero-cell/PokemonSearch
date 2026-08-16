import type { PokemonVariant, TradeIntent, TradePost, TradeStatus, TrinketChoice } from '@/app/types/trades';

// user_trades.variant_id -> pokemon_variants.id -> pokemon_variants.pokemon_id -> pokemons.id
// (confirmado vía information_schema). Si tu columna de variante se llama distinto
// a `variant_id`, o pokemon_variants no expone `pokemon_id`, ajusta este SELECT.
export const TRADE_SELECT = `
  id, user_id, trade_group_id, intent, quantity, notes, is_spoofer, trinket_choice, open_to_offers, status, created_at, updated_at,
  variant:pokemon_variants!variant_id (
    id, pokemon_id, is_shiny, battle_state,
    background:backgrounds ( id, name, category ),
    pokemon:pokemons ( id, dex_number, name, sprite_url, shiny_sprite_url, types )
  )
`;

export interface RawTradeRow {
  id: string;
  user_id: string;
  trade_group_id: string;
  intent: TradeIntent;
  quantity: number;
  notes: string | null;
  is_spoofer: boolean;
  trinket_choice: TrinketChoice;
  open_to_offers: boolean;
  status: TradeStatus;
  created_at: string;
  updated_at: string;
  variant: PokemonVariant;
}

// Cada publicación son varias filas de user_trades (hasta 10 'for_trade' + hasta 10
// 'looking_for') que comparten trade_group_id. Las agrupamos en un único TradePost
// acumulando todas las variantes de cada intent en su array correspondiente.
// `username` queda en null acá: se completa aparte con app/lib/profiles.ts porque no
// hay una relación FK directa entre user_trades y profiles que Supabase pueda anidar
// en el mismo SELECT (ambas apuntan a auth.users, no entre sí).
export function groupTradeRows(rows: RawTradeRow[]): TradePost[] {
  const groups = new Map<string, TradePost>();

  for (const row of rows) {
    let group = groups.get(row.trade_group_id);
    if (!group) {
      group = {
        id: row.id,
        trade_group_id: row.trade_group_id,
        user_id: row.user_id,
        username: null,
        quantity: row.quantity,
        notes: row.notes,
        is_spoofer: row.is_spoofer,
        trinket_choice: row.trinket_choice,
        open_to_offers: row.open_to_offers,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        offering: [],
        lookingFor: [],
      };
      groups.set(row.trade_group_id, group);
    }

    if (row.intent === 'for_trade') {
      group.offering.push(row.variant);
    } else {
      group.lookingFor.push(row.variant);
    }

    if (row.created_at > group.created_at) {
      group.created_at = row.created_at;
    }
    // "Editar" hace su DELETE+INSERT sobre TODAS las filas del grupo a la vez, así que
    // en la práctica quedan sincronizadas. Tomamos el máximo igual por robustez.
    if (row.updated_at > group.updated_at) {
      group.updated_at = row.updated_at;
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
