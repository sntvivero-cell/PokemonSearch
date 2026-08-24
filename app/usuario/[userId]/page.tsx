'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Flag, MessageCircle, Settings, ShieldOff, Sparkles, User } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';
import { TRADE_SELECT, groupTradeRows, type RawTradeRow } from '@/app/lib/tradeGrouping';
import { fetchSavedTradeGroupIds } from '@/app/lib/savedTrades';
import { getOrCreateConversation } from '@/app/lib/conversations';
import type { TradePost } from '@/app/types/trades';
import { TradeCard } from '@/app/components/trades/TradeCard';
import { RankBadge } from '@/app/components/trades/RankBadge';

interface UserProfilePageProps {
  params: Promise<{ userId: string }>;
}

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const { userId } = use(params);
  const router = useRouter();
  const { user: currentUser } = useUser();
  const isOwnProfile = currentUser?.id === userId;

  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);

  const [username, setUsername] = useState<string | null>(null);
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [rank, setRank] = useState<string | null>(null);
  const [tradesCompleted, setTradesCompleted] = useState(0);
  const [trades, setTrades] = useState<TradePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedTradeGroupIds, setSavedTradeGroupIds] = useState<Set<string>>(new Set());

  // null mientras no se sabe todavía (evita mostrar "Block" un instante antes de
  // confirmar que ya estaba bloqueado, lo que haría parpadear el botón).
  const [isBlocked, setIsBlocked] = useState<boolean | null>(null);
  const [isTogglingBlock, setIsTogglingBlock] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const [isReportFormOpen, setIsReportFormOpen] = useState(false);
  const [reportReason, setReportReason] = useState<'spam' | 'scam' | 'harassment' | 'other'>('spam');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setLoadError(null);

      const [
        { data: profile, error: profileError },
        { data: completedRow, error: completedError },
        { data: tradeRows, error: tradesError },
      ] = await Promise.all([
        supabase.from('profiles_with_rank').select('username, friend_code, rank').eq('user_id', userId).maybeSingle(),
        // Aparte de profiles_with_rank (migración 0008): esa vista no expone
        // total_trades_completed, y no hace falta tocarla para agregar esto — es un
        // segundo SELECT chico sobre `profiles`, que ya tiene SELECT público.
        supabase.from('profiles').select('total_trades_completed').eq('user_id', userId).maybeSingle(),
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
      if (completedError) {
        console.error('Error fetching total_trades_completed:', completedError.message);
      }
      setUsername(profile?.username ?? null);
      setFriendCode(profile?.friend_code ?? null);
      setRank(profile?.rank ?? null);
      setTradesCompleted(completedRow?.total_trades_completed ?? 0);

      if (tradesError) {
        setLoadError(tradesError.message);
        setIsLoading(false);
        return;
      }

      const grouped = groupTradeRows((tradeRows as unknown as RawTradeRow[]) ?? []);
      setTrades(grouped.map((t) => ({ ...t, username: profile?.username ?? null, rank: profile?.rank ?? null })));
      setIsLoading(false);
    }

    load();
  }, [userId]);

  useEffect(() => {
    async function loadSaved() {
      if (!currentUser) {
        setSavedTradeGroupIds(new Set());
        return;
      }
      setSavedTradeGroupIds(await fetchSavedTradeGroupIds(currentUser.id));
    }
    loadSaved();
  }, [currentUser]);

  useEffect(() => {
    async function loadBlockedStatus() {
      if (!currentUser || isOwnProfile) {
        setIsBlocked(null);
        return;
      }
      const { data, error } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('blocked_user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching block status:', error.message);
        return;
      }
      setIsBlocked(data != null);
    }
    loadBlockedStatus();
  }, [currentUser, isOwnProfile, userId]);

  function handleDeleted(tradeGroupId: string) {
    setTrades((prev) => prev.filter((t) => t.trade_group_id !== tradeGroupId));
  }

  function handleSaveChange(tradeGroupId: string, isSaved: boolean) {
    setSavedTradeGroupIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.add(tradeGroupId);
      else next.delete(tradeGroupId);
      return next;
    });
  }

  async function handleSendMessage() {
    if (!currentUser) return;
    setConversationError(null);
    setIsStartingConversation(true);

    try {
      const conversationId = await getOrCreateConversation(currentUser.id, userId);
      router.push(`/mensajes/${conversationId}`);
    } catch (err) {
      setConversationError(err instanceof Error ? err.message : 'Could not open the conversation.');
      setIsStartingConversation(false);
    }
  }

  async function handleToggleBlock() {
    if (!currentUser) return;

    if (!isBlocked) {
      const confirmed = window.confirm(
        `Block ${username ?? 'this trainer'}? You won't be able to message each other anymore.`
      );
      if (!confirmed) return;
    }

    setBlockError(null);
    setIsTogglingBlock(true);

    if (isBlocked) {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('blocked_user_id', userId);

      setIsTogglingBlock(false);
      if (error) {
        setBlockError('Could not unblock user.');
        return;
      }
      setIsBlocked(false);
      return;
    }

    const { error } = await supabase
      .from('blocked_users')
      .insert({ user_id: currentUser.id, blocked_user_id: userId });

    setIsTogglingBlock(false);
    if (error) {
      setBlockError('Could not block user.');
      return;
    }
    setIsBlocked(true);
  }

  async function handleSubmitReport() {
    if (!currentUser) return;

    setReportError(null);
    setIsSubmittingReport(true);

    const { error } = await supabase.from('user_reports').insert({
      reporter_id: currentUser.id,
      reported_user_id: userId,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });

    setIsSubmittingReport(false);

    if (error) {
      setReportError('Could not submit the report.');
      return;
    }

    setReportSubmitted(true);
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
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold tracking-tight">
                  {isLoading ? 'Loading…' : (username ?? 'Trainer')}
                </h1>
                {!isLoading && <RankBadge rank={rank} />}
                {!isLoading && friendCode && (
                  <span className="rounded-full bg-[#232D38] px-2 py-0.5 text-[10px] font-semibold text-[#8792A0]">
                    {friendCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5C6773]">
                Active posts
                {!isLoading && tradesCompleted > 0 && (
                  <>
                    {' '}
                    ·{' '}
                    <span className="text-[#22C55E]">
                      {tradesCompleted} trade{tradesCompleted === 1 ? '' : 's'} completed
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {!isLoading && isOwnProfile && (
            <Link
              href="/configuracion"
              className="ml-auto flex items-center gap-1.5 rounded-full border border-[#232D38] px-4 py-2
                         text-xs font-semibold text-[#8792A0] transition hover:border-[#3A4C63]
                         hover:text-[#F4F6F8]"
            >
              <Settings className="h-3.5 w-3.5" />
              Edit profile
            </Link>
          )}

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
              {isStartingConversation ? 'Opening…' : 'Send message'}
            </button>
          )}
        </div>
        {conversationError && (
          <p className="mx-auto max-w-6xl px-4 pb-2 text-[10px] font-semibold text-[#FF3D3D]">
            {conversationError}
          </p>
        )}

        {!isOwnProfile && currentUser && (
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 pb-3 text-[11px] font-semibold text-[#5C6773]">
            <button
              type="button"
              onClick={handleToggleBlock}
              disabled={isTogglingBlock || isBlocked === null}
              className="flex items-center gap-1.5 transition hover:text-[#FF3D3D] disabled:cursor-not-allowed
                         disabled:opacity-50"
            >
              <ShieldOff className="h-3 w-3" />
              {isTogglingBlock ? 'Please wait…' : isBlocked ? 'Unblock user' : 'Block user'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsReportFormOpen((open) => !open);
                setReportSubmitted(false);
                setReportError(null);
              }}
              className="flex items-center gap-1.5 transition hover:text-[#F4F6F8]"
            >
              <Flag className="h-3 w-3" />
              Report user
            </button>
          </div>
        )}

        {blockError && (
          <p className="mx-auto max-w-6xl px-4 pb-2 text-[10px] font-semibold text-[#FF3D3D]">{blockError}</p>
        )}

        {isReportFormOpen && (
          <div className="mx-auto max-w-6xl px-4 pb-4">
            <div className="rounded-xl border border-[#232D38] bg-[#131A22] p-3">
              {reportSubmitted ? (
                <p className="text-xs font-semibold text-[#22C55E]">
                  Report sent. Thank you for helping keep the community safe.
                </p>
              ) : (
                <>
                  <label className="mb-1 block text-[10px] font-semibold text-[#8792A0]">Reason</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value as typeof reportReason)}
                    className="mb-2 w-full rounded-lg border border-[#232D38] bg-[#0B0F14] px-2.5 py-1.5 text-xs
                               text-[#F4F6F8] outline-none focus:border-[#2E9BF5]"
                  >
                    <option value="spam">Spam</option>
                    <option value="scam">Scam or fraud</option>
                    <option value="harassment">Harassment</option>
                    <option value="other">Other</option>
                  </select>
                  <label className="mb-1 block text-[10px] font-semibold text-[#8792A0]">Details (optional)</label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    rows={2}
                    placeholder="Anything that helps us understand what happened…"
                    className="mb-2 w-full resize-none rounded-lg border border-[#232D38] bg-[#0B0F14] px-2.5 py-1.5
                               text-xs text-[#F4F6F8] placeholder:text-[#5C6773] outline-none
                               focus:border-[#2E9BF5]"
                  />
                  {reportError && (
                    <p className="mb-2 text-[10px] font-semibold text-[#FF3D3D]">{reportError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsReportFormOpen(false)}
                      className="flex-1 rounded-full border border-[#232D38] px-3 py-1.5 text-[11px] font-semibold
                                 text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitReport}
                      disabled={isSubmittingReport}
                      className="flex-1 rounded-full bg-[#FF3D3D] px-3 py-1.5 text-[11px] font-semibold text-white
                                 transition hover:bg-[#e63636] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmittingReport ? 'Submitting…' : 'Submit report'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
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
            Could not load posts: {loadError}
          </p>
        ) : trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#232D38] py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2E9BF5]/10">
              <Sparkles className="h-5 w-5 text-[#2E9BF5]" />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#F4F6F8]">
              {isOwnProfile ? "You haven't posted any trades yet" : 'This trainer has no active posts'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                currentUserId={currentUser?.id ?? null}
                onDeleted={handleDeleted}
                onCompleted={handleDeleted}
                isSaved={savedTradeGroupIds.has(trade.trade_group_id)}
                onSaveChange={handleSaveChange}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
