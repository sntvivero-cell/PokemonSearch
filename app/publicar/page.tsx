'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';
import { getOrCreateVariant } from '@/app/lib/variants';
import { cooldownMessageFromRpcError } from '@/app/lib/tradeTiming';
import { configuredSlots } from '@/app/components/publish/TradeSideList';
import { TradeForm, type TradeFormValues } from '@/app/components/publish/TradeForm';
import { Toast } from '@/app/components/publish/Toast';

export default function PublishTradePage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  async function handleSubmit(values: TradeFormValues): Promise<string | null> {
    if (!user) return 'You need to sign in to post.';

    const offering = configuredSlots(values.offering);
    const seeking = configuredSlots(values.seeking);

    let offeringVariantIds: string[];
    let seekingVariantIds: string[];
    try {
      [offeringVariantIds, seekingVariantIds] = await Promise.all([
        Promise.all(
          offering.map((slot) => getOrCreateVariant(slot.pokemon, slot.isShiny, slot.battleState, slot.background?.id ?? null))
        ),
        Promise.all(
          seeking.map((slot) => getOrCreateVariant(slot.pokemon, slot.isShiny, slot.battleState, slot.background?.id ?? null))
        ),
      ]);
    } catch (err) {
      return err instanceof Error ? err.message : 'Could not prepare one of the variants.';
    }

    // Quantity y notes se guardan duplicados en todas las filas del grupo (criterio más
    // simple): así cualquiera de las filas que se lea por separado conserva la info
    // completa del post, sin depender de cuál fila del grupo se consulte primero.
    // user_id, status, created_at y updated_at los pone publish_trade_group() sola.
    const tradeGroupId = crypto.randomUUID();
    const rows = [
      ...offeringVariantIds.map((variantId) => ({
        variant_id: variantId,
        intent: 'for_trade' as const,
        quantity: values.quantity,
        notes: values.notes.trim() || null,
        is_spoofer: values.isSpoofer,
        trinket_choice: values.trinketChoice,
        open_to_offers: values.openToOffers,
      })),
      ...seekingVariantIds.map((variantId) => ({
        variant_id: variantId,
        intent: 'looking_for' as const,
        quantity: values.quantity,
        notes: values.notes.trim() || null,
        is_spoofer: values.isSpoofer,
        trinket_choice: values.trinketChoice,
        open_to_offers: values.openToOffers,
      })),
    ];

    const { error: rpcError } = await supabase.rpc('publish_trade_group', {
      p_trade_group_id: tradeGroupId,
      p_rows: rows,
    });
    if (rpcError) {
      const cooldownMessage = cooldownMessageFromRpcError(rpcError, 'post');
      if (cooldownMessage) return cooldownMessage;
      return `Could not post the trade: ${rpcError.message}`;
    }

    setShowSuccessToast(true);
    setTimeout(() => {
      router.push('/');
    }, 900);
    return null;
  }

  return (
    <main className="min-h-screen bg-[#0B0F14] text-[#F4F6F8]">
      <header className="sticky top-0 z-10 border-b border-[#232D38] bg-[#0B0F14]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#232D38]
                       text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-extrabold tracking-tight">Post trade</h1>
            <p className="text-xs text-[#5C6773]">Indicate what you&apos;re offering and looking for</p>
          </div>
        </div>
      </header>

      <TradeForm
        isUserReady={!isUserLoading}
        isLoggedIn={!!user}
        userId={user?.id ?? null}
        cooldownActionVerb="post"
        submitLabel="Post trade"
        submittingLabel="Posting…"
        onSubmit={handleSubmit}
        cancelHref="/"
      />

      {showSuccessToast && <Toast message="Trade posted. Redirecting…" />}
    </main>
  );
}
