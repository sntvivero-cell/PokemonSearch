'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, LogIn, LogOut, MessageCircle, Plus, Search, Settings } from 'lucide-react';
import { supabase, consumeAuthRedirectType } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';
import { fetchProfilesWithRank } from '@/app/lib/profiles';
import { fetchSavedTradeGroupIds } from '@/app/lib/savedTrades';
import { fetchUnreadConversationCount } from '@/app/lib/conversations';
import { TRADE_SELECT, groupTradeRows, type RawTradeRow } from '@/app/lib/tradeGrouping';
import type { TradePost } from '@/app/types/trades';
import { TradeCard } from '@/app/components/trades/TradeCard';
import { EmptyState } from '@/app/components/trades/EmptyState';
import { Toast } from '@/app/components/publish/Toast';
import { LanguageToggleButton } from '@/app/components/layout/LanguageToggleButton';

// Sin importar mayúsculas/acentos: "pikachu" debe matchear "Pikachú" o "PIKACHU".
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function tradeMatchesQuery(trade: TradePost, normalizedQuery: string): boolean {
  return [...trade.offering, ...trade.lookingFor].some((variant) =>
    normalize(variant.pokemon.name).includes(normalizedQuery)
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const [trades, setTrades] = useState<TradePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [unreadConversations, setUnreadConversations] = useState(0);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  const [savedTradeGroupIds, setSavedTradeGroupIds] = useState<Set<string>>(new Set());

  // Detecta específicamente una confirmación de signup recién hecha (type=signup en el
  // hash del link del mail, capturado en supabaseClient.ts antes de que el SDK lo
  // borre solo) — no "hay sesión nueva" en general, así un login normal no dispara
  // este toast. router.replace limpia cualquier resto de hash/query de la URL para que
  // no quede visible ni se re-dispare al recargar.
  useEffect(() => {
    if (consumeAuthRedirectType() !== 'signup') return;
    setShowWelcomeToast(true);
    router.replace('/');
  }, [router]);

  useEffect(() => {
    async function loadUnreadCount() {
      if (!user) {
        setUnreadConversations(0);
        return;
      }
      setUnreadConversations(await fetchUnreadConversationCount(user.id));
    }
    loadUnreadCount();
  }, [user]);

  useEffect(() => {
    async function loadSaved() {
      if (!user) {
        setSavedTradeGroupIds(new Set());
        return;
      }
      setSavedTradeGroupIds(await fetchSavedTradeGroupIds(user.id));
    }
    loadSaved();
  }, [user]);

  function handleSaveChange(tradeGroupId: string, isSaved: boolean) {
    setSavedTradeGroupIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.add(tradeGroupId);
      else next.delete(tradeGroupId);
      return next;
    });
  }

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
        setIsLoading(false);
        return;
      }

      const grouped = groupTradeRows((data as unknown as RawTradeRow[]) ?? []);
      const profiles = await fetchProfilesWithRank(grouped.map((t) => t.user_id));
      setTrades(
        grouped.map((t) => ({
          ...t,
          username: profiles.get(t.user_id)?.username ?? null,
          rank: profiles.get(t.user_id)?.rank ?? null,
        }))
      );
      setIsLoading(false);
    }

    fetchTrades();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function handleDeleted(tradeGroupId: string) {
    setTrades((prev) => prev.filter((t) => t.trade_group_id !== tradeGroupId));
  }

  const filteredTrades = useMemo(() => {
    const normalizedQuery = normalize(debouncedSearch.trim());
    if (!normalizedQuery) return trades;
    return trades.filter((trade) => tradeMatchesQuery(trade, normalizedQuery));
  }, [trades, debouncedSearch]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-[#F4F6F8]">
      <header className="sticky top-0 z-10 border-b border-[#232D38] bg-[#0B0F14]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo-1024.png" alt="GoTraderz" width={36} height={36} className="rounded-lg" />
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">GoTraderz</h1>
              <p className="text-xs text-[#5C6773]">Tablón de intercambios de la comunidad</p>
            </div>
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
            {user && (
              <Link
                href="/mensajes"
                className="relative flex items-center gap-1.5 rounded-full border border-[#232D38] px-3 py-2
                           text-xs font-semibold text-[#8792A0] transition hover:border-[#3A4C63]
                           hover:text-[#F4F6F8]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mensajes</span>
                {unreadConversations > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center
                               rounded-full bg-[#FF3D3D] px-1 text-[9px] font-bold text-white"
                  >
                    {unreadConversations > 9 ? '9+' : unreadConversations}
                  </span>
                )}
              </Link>
            )}
            {user && (
              <Link
                href="/guardados"
                className="flex items-center gap-1.5 rounded-full border border-[#232D38] px-3 py-2
                           text-xs font-semibold text-[#8792A0] transition hover:border-[#3A4C63]
                           hover:text-[#F4F6F8]"
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Guardados</span>
              </Link>
            )}
            {user && (
              <Link
                href="/configuracion"
                aria-label="Configuración"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#232D38]
                           text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]"
              >
                <Settings className="h-3.5 w-3.5" />
              </Link>
            )}
            <LanguageToggleButton />
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
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5C6773]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar Pokémon en el foro…"
              className="w-full rounded-full border border-[#232D38] bg-[#131A22] py-2 pl-9 pr-3 text-sm
                         text-[#F4F6F8] placeholder:text-[#5C6773] outline-none transition
                         focus:border-[#2E9BF5]"
            />
          </div>
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
                onDeleted={handleDeleted}
                isSaved={savedTradeGroupIds.has(trade.trade_group_id)}
                onSaveChange={handleSaveChange}
              />
            ))}
          </div>
        )}
      </div>

      {showWelcomeToast && (
        <Toast
          message="🎉 ¡Bienvenido a GoTraderz! Tu cuenta está confirmada"
          duration={3000}
          onDismiss={() => setShowWelcomeToast(false)}
        />
      )}
    </main>
  );
}
