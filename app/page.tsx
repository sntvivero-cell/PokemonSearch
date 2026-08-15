'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LogIn, LogOut, Plus } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';
import type { TradePost, TradeIntent, TradeStatus, PokemonVariant, FeedTab } from '@/app/types/trades';
import { FeedTabs } from '@/app/components/trades/FeedTabs';
import { TradeCard } from '@/app/components/trades/TradeCard';
import { EmptyState } from '@/app/components/trades/EmptyState';

// user_trades.variant_id -> pokemon_variants.id -> pokemon_variants.pokemon_id -> pokemons.id
// (confirmado vía information_schema). Si tu columna de variante se llama distinto
// a `variant_id`, o pokemon_variants no expone `pokemon_id`, ajusta este SELECT.
const TRADE_SELECT = `
  id, user_id, trade_group_id, intent, quantity, notes, status, created_at, updated_at,
  variant:pokemon_variants!variant_id (
    id, pokemon_id, is_shiny, battle_state,
    pokemon:pokemons ( id, dex_number, name, sprite_url, types )
  )
`;

interface RawTradeRow {
  id: string;
  user_id: string;
  trade_group_id: string;
  intent: TradeIntent;
  quantity: number;
  notes: string | null;
  status: TradeStatus;
  created_at: string;
  updated_at: string;
  variant: PokemonVariant;
}

// Cada publicación son varias filas de user_trades (hasta 10 'for_trade' + hasta 10
// 'looking_for') que comparten trade_group_id. Las agrupamos en un único TradePost
// acumulando todas las variantes de cada intent en su array correspondiente.
function groupTradeRows(rows: RawTradeRow[]): TradePost[] {
  const groups = new Map<string, TradePost>();

  for (const row of rows) {
    let group = groups.get(row.trade_group_id);
    if (!group) {
      group = {
        id: row.id,
        trade_group_id: row.trade_group_id,
        user_id: row.user_id,
        quantity: row.quantity,
        notes: row.notes,
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
    // El botón "Actualizar" hace un UPDATE sobre TODAS las filas del grupo a la vez
    // (mismo trade_group_id), así que en la práctica quedan sincronizadas. Tomamos el
    // máximo igual por robustez: si alguna fila quedara más nueva que otra, el grupo
    // se considera "actualizado" recién cuando la más reciente lo esté.
    if (row.updated_at > group.updated_at) {
      group.updated_at = row.updated_at;
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export default function HomePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const [trades, setTrades] = useState<TradePost[]>([]);
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const [isLoading, setIsLoading] = useState(true);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  useEffect(() => {
    async function fetchTrades() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_trades')
        .select(TRADE_SELECT)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user_trades:', error.message);
      } else {
        setTrades(groupTradeRows((data as unknown as RawTradeRow[]) ?? []));
      }
      setIsLoading(false);
    }

    fetchTrades();
  }, []);

  function handleBumped(tradeGroupId: string, updatedAt: string) {
    setTrades((prev) =>
      prev.map((t) => (t.trade_group_id === tradeGroupId ? { ...t, updated_at: updatedAt } : t))
    );
  }

  const filteredTrades = useMemo(() => {
    if (activeTab === 'all') return trades;
    if (activeTab === 'for_trade') return trades.filter((t) => t.offering.length > 0);
    return trades.filter((t) => t.lookingFor.length > 0);
  }, [trades, activeTab]);

  const counts = useMemo(
    () => ({
      all: trades.length,
      for_trade: trades.filter((t) => t.offering.length > 0).length,
      looking_for: trades.filter((t) => t.lookingFor.length > 0).length,
    }),
    [trades]
  );

  return (
    <main className="min-h-screen bg-[#0B0F14] text-[#F4F6F8]">
      <header className="sticky top-0 z-10 border-b border-[#232D38] bg-[#0B0F14]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Pokémon GO Trades 🚀</h1>
            <p className="text-xs text-[#5C6773]">Tablón de intercambios de la comunidad</p>
          </div>
          <div className="flex items-center gap-2">
            {!isUserLoading && (
              <>
                {user ? (
                  <div className="flex items-center gap-2">
                    <span className="hidden max-w-[160px] truncate text-xs text-[#8792A0] sm:inline">
                      {user.email}
                    </span>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-1.5 rounded-full border border-[#232D38] px-3 py-2
                                 text-xs font-semibold text-[#8792A0] transition hover:border-[#3A4C63]
                                 hover:text-[#F4F6F8]"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Cerrar sesión</span>
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="flex items-center gap-1.5 rounded-full border border-[#232D38] px-3 py-2
                               text-xs font-semibold text-[#8792A0] transition hover:border-[#3A4C63]
                               hover:text-[#F4F6F8]"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Iniciar sesión
                  </Link>
                )}
              </>
            )}
            <Link
              href="/publicar"
              className="flex items-center gap-1.5 rounded-full bg-[#2E9BF5] px-4 py-2 text-xs
                         font-semibold text-white transition hover:bg-[#2589db]"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo Trade
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FeedTabs active={activeTab} onChange={setActiveTab} counts={counts} />
          <p className="text-xs text-[#5C6773]">
            {isLoading ? 'Cargando publicaciones…' : `${filteredTrades.length} publicaciones`}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border border-[#232D38] bg-[#131A22]" />
            ))}
          </div>
        ) : filteredTrades.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTrades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                currentUserId={user?.id ?? null}
                onBumped={handleBumped}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}