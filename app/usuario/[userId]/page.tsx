'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Pencil, Sparkles, User } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';
import { TRADE_SELECT, groupTradeRows, type RawTradeRow } from '@/app/lib/tradeGrouping';
import { getOrCreateConversation } from '@/app/lib/conversations';
import type { TradePost } from '@/app/types/trades';
import { TradeCard } from '@/app/components/trades/TradeCard';

interface UserProfilePageProps {
  params: Promise<{ userId: string }>;
}

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const { userId } = use(params);
  const router = useRouter();
  const { user: currentUser } = useUser();
  const isOwnProfile = currentUser?.id === userId;

  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);

  const [username, setUsername] = useState<string | null>(null);
  const [trades, setTrades] = useState<TradePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setLoadError(null);

      const [{ data: profile, error: profileError }, { data: tradeRows, error: tradesError }] = await Promise.all([
        supabase.from('profiles').select('username').eq('user_id', userId).maybeSingle(),
        supabase
          .from('user_trades')
          .select(TRADE_SELECT)
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ]);

      if (profileError) {
        console.error('Error fetching profile:', profileError.message);
      }
      setUsername(profile?.username ?? null);

      if (tradesError) {
        setLoadError(tradesError.message);
        setIsLoading(false);
        return;
      }

      const grouped = groupTradeRows((tradeRows as unknown as RawTradeRow[]) ?? []);
      setTrades(grouped.map((t) => ({ ...t, username: profile?.username ?? null })));
      setIsLoading(false);
    }

    load();
  }, [userId]);

  function handleBumped(tradeGroupId: string, updatedAt: string) {
    setTrades((prev) =>
      prev.map((t) => (t.trade_group_id === tradeGroupId ? { ...t, updated_at: updatedAt } : t))
    );
  }

  function handleDeleted(tradeGroupId: string) {
    setTrades((prev) => prev.filter((t) => t.trade_group_id !== tradeGroupId));
  }

  function startEditingUsername() {
    setUsernameDraft(username ?? '');
    setUsernameError(null);
    setIsEditingUsername(true);
  }

  function cancelEditingUsername() {
    setIsEditingUsername(false);
    setUsernameError(null);
  }

  async function handleSendMessage() {
    if (!currentUser) return;
    setConversationError(null);
    setIsStartingConversation(true);

    try {
      const conversationId = await getOrCreateConversation(currentUser.id, userId);
      router.push(`/mensajes/${conversationId}`);
    } catch (err) {
      setConversationError(err instanceof Error ? err.message : 'No se pudo abrir la conversación.');
      setIsStartingConversation(false);
    }
  }

  async function handleSaveUsername() {
    const trimmed = usernameDraft.trim();
    setUsernameError(null);

    if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
      setUsernameError(`El nombre debe tener entre ${USERNAME_MIN_LENGTH} y ${USERNAME_MAX_LENGTH} caracteres.`);
      return;
    }

    setIsSavingUsername(true);
    const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('user_id', userId);
    setIsSavingUsername(false);

    if (error) {
      // 23505 = unique_violation en Postgres — profiles.username tiene una unique
      // constraint, así que esto salta cuando el nombre ya lo usa otro entrenador.
      if (error.code === '23505') {
        setUsernameError('Ese nombre ya está en uso.');
      } else {
        setUsernameError(`No se pudo guardar: ${error.message}`);
      }
      return;
    }

    // Se actualiza en el momento, sin recargar: el header y cualquier TradeCard
    // visible en esta pantalla pertenecen todos a este mismo usuario.
    setUsername(trimmed);
    setTrades((prev) => prev.map((t) => ({ ...t, username: trimmed })));
    setIsEditingUsername(false);
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2E9BF5]/10">
              <User className="h-4 w-4 text-[#2E9BF5]" />
            </div>
            <div>
              {isEditingUsername ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={usernameDraft}
                    onChange={(e) => setUsernameDraft(e.target.value)}
                    autoFocus
                    maxLength={USERNAME_MAX_LENGTH}
                    className="w-40 rounded-lg border border-[#232D38] bg-[#0B0F14] px-2 py-1 text-sm
                               font-extrabold text-[#F4F6F8] outline-none transition focus:border-[#2E9BF5]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveUsername}
                    disabled={isSavingUsername}
                    className="rounded-full bg-[#2E9BF5] px-2.5 py-1 text-[11px] font-semibold text-white
                               transition hover:bg-[#2589db] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingUsername ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditingUsername}
                    disabled={isSavingUsername}
                    className="rounded-full border border-[#232D38] px-2.5 py-1 text-[11px] font-semibold
                               text-[#8792A0] transition hover:text-[#F4F6F8] disabled:cursor-not-allowed
                               disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold tracking-tight">
                    {isLoading ? 'Cargando…' : (username ?? 'Entrenador')}
                  </h1>
                  {!isLoading && isOwnProfile && (
                    <button
                      type="button"
                      onClick={startEditingUsername}
                      aria-label="Editar nombre"
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[#5C6773]
                                 transition hover:text-[#F4F6F8]"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-[#5C6773]">Publicaciones activas</p>
              {usernameError && (
                <p className="mt-1 text-[10px] font-semibold text-[#FF3D3D]">{usernameError}</p>
              )}
            </div>
          </div>

          {!isOwnProfile && currentUser && (
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={isStartingConversation}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-[#2E9BF5] px-4 py-2 text-xs
                         font-semibold text-white transition hover:bg-[#2589db] disabled:cursor-not-allowed
                         disabled:opacity-50"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {isStartingConversation ? 'Abriendo…' : 'Enviar mensaje'}
            </button>
          )}
        </div>
        {conversationError && (
          <p className="mx-auto max-w-6xl px-4 pb-2 text-[10px] font-semibold text-[#FF3D3D]">
            {conversationError}
          </p>
        )}
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
            No se pudieron cargar las publicaciones: {loadError}
          </p>
        ) : trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#232D38] py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2E9BF5]/10">
              <Sparkles className="h-5 w-5 text-[#2E9BF5]" />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#F4F6F8]">
              {isOwnProfile ? 'Todavía no publicaste ningún trade' : 'Este entrenador no tiene publicaciones activas'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                currentUserId={currentUser?.id ?? null}
                onBumped={handleBumped}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
