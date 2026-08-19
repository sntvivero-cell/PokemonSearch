'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';
import { fetchProfilesWithRank } from '@/app/lib/profiles';
import { TRADE_SELECT, groupTradeRows, type RawTradeRow } from '@/app/lib/tradeGrouping';
import type { TradePost } from '@/app/types/trades';
import { TradeCard } from '@/app/components/trades/TradeCard';
import { SavedPlaceholderCard } from '@/app/components/trades/SavedPlaceholderCard';

interface SavedRow {
  id: string;
  trade_group_id: string;
}

// Cada guardado es o bien una publicación que todavía existe (kind: 'trade') o una
// que ya no tiene filas activas en user_trades (kind: 'missing') — ver punto 3 del
// pedido: esto último NO se filtra en silencio, se muestra como placeholder.
type SavedEntry =
  | { kind: 'trade'; trade: TradePost }
  | { kind: 'missing'; savedTradeId: string; tradeGroupId: string };

export default function SavedTradesPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();

  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [savedTradeGroupIds, setSavedTradeGroupIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function load() {
      if (!user) return;
      setIsLoading(true);
      setLoadError(null);

      // Orden real de la página: por created_at de saved_trades (más reciente
      // primero), NO por el created_at del post original — por eso se guarda este
      // orden acá y se respeta al armar `entries` más abajo, en vez de usar el orden
      // que devuelve groupTradeRows() (que ordena por el created_at del trade).
      const { data: savedRows, error: savedError } = await supabase
        .from('saved_trades')
        .select('id, trade_group_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (savedError) {
        setLoadError(savedError.message);
        setIsLoading(false);
        return;
      }

      const rows = (savedRows ?? []) as SavedRow[];
      setSavedTradeGroupIds(new Set(rows.map((r) => r.trade_group_id)));

      if (rows.length === 0) {
        setEntries([]);
        setIsLoading(false);
        return;
      }

      const { data: tradeRows, error: tradesError } = await supabase
        .from('user_trades')
        .select(TRADE_SELECT)
        .eq('status', 'active')
        .in(
          'trade_group_id',
          rows.map((r) => r.trade_group_id)
        );

      if (tradesError) {
        setLoadError(tradesError.message);
        setIsLoading(false);
        return;
      }

      const grouped = groupTradeRows((tradeRows as unknown as RawTradeRow[]) ?? []);
      const profiles = await fetchProfilesWithRank(grouped.map((t) => t.user_id));
      const tradeByGroupId = new Map(
        grouped.map((t) => [
          t.trade_group_id,
          { ...t, username: profiles.get(t.user_id)?.username ?? null, rank: profiles.get(t.user_id)?.rank ?? null },
        ])
      );

      setEntries(
        rows.map((row) => {
          const trade = tradeByGroupId.get(row.trade_group_id);
          return trade
            ? { kind: 'trade' as const, trade }
            : { kind: 'missing' as const, savedTradeId: row.id, tradeGroupId: row.trade_group_id };
        })
      );
      setIsLoading(false);
    }

    load();
  }, [user, isUserLoading, router]);

  // Único punto de salida de un trade_group_id de la lista: lo usan tanto
  // TradeCard (al des-guardar con el mismo bookmark, o si el dueño lo borra desde
  // acá) como el fallback de abajo si tradeByGroupId no lo tenía.
  function removeTradeGroupFromList(tradeGroupId: string) {
    setEntries((prev) => prev.filter((e) => !(e.kind === 'trade' && e.trade.trade_group_id === tradeGroupId)));
    setSavedTradeGroupIds((prev) => {
      const next = new Set(prev);
      next.delete(tradeGroupId);
      return next;
    });
  }

  function handleSaveChange(tradeGroupId: string, isSaved: boolean) {
    if (!isSaved) {
      removeTradeGroupFromList(tradeGroupId);
      return;
    }
    setSavedTradeGroupIds((prev) => new Set(prev).add(tradeGroupId));
  }

  function handleRemovedMissing(savedTradeId: string) {
    setEntries((prev) => prev.filter((e) => !(e.kind === 'missing' && e.savedTradeId === savedTradeId)));
  }

  if (!isUserLoading && !user) {
    // El useEffect de arriba ya dispara el redirect a /login; esto evita un
    // flash del contenido de la página mientras router.push() todavía no navegó.
    return null;
  }

  return (
    <main className="min-h-screen bg-[#0B0F14] text-[#F4F6F8]">
      <header className="sticky top-0 z-10 border-b border-[#232D38] bg-[#0B0F14]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#232D38]
                       text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFCB05]/10">
              <Bookmark className="h-4 w-4 text-[#FFCB05]" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight">Guardados</h1>
              <p className="text-xs text-[#5C6773]">Publicaciones que marcaste para encontrar después</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border border-[#232D38] bg-[#131A22]" />
            ))}
          </div>
        ) : loadError ? (
          <p className="rounded-xl border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-3 py-2.5 text-xs font-semibold text-[#FF3D3D]">
            No se pudieron cargar tus guardados: {loadError}
          </p>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#232D38] py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFCB05]/10">
              <Bookmark className="h-5 w-5 text-[#FFCB05]" />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#F4F6F8]">Todavía no guardaste ninguna publicación</p>
            <p className="mt-1 max-w-xs text-xs text-[#5C6773]">
              Usá el ícono de marcador en cualquier publicación del feed para guardarla acá y encontrarla después.
            </p>
            <Link
              href="/"
              className="mt-5 rounded-full bg-[#2E9BF5] px-5 py-2 text-xs font-semibold text-white
                         transition hover:bg-[#2589db]"
            >
              Explorar el feed
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) =>
              entry.kind === 'trade' ? (
                <TradeCard
                  key={entry.trade.id}
                  trade={entry.trade}
                  currentUserId={user?.id ?? null}
                  onDeleted={removeTradeGroupFromList}
                  isSaved={savedTradeGroupIds.has(entry.trade.trade_group_id)}
                  onSaveChange={handleSaveChange}
                />
              ) : (
                <SavedPlaceholderCard
                  key={entry.savedTradeId}
                  savedTradeId={entry.savedTradeId}
                  onRemoved={handleRemovedMissing}
                />
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}
