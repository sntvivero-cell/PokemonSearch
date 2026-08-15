'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';
import type { BattleState } from '@/app/types/trades';
import type { PokemonSummary } from '@/app/components/publish/PokemonSearchPicker';
import {
  TradeSideList,
  createInitialSlots,
  type TradeSideSlot,
} from '@/app/components/publish/TradeSideList';
import { Toast } from '@/app/components/publish/Toast';

// Confirmado en producción: pokemon_variants NO tiene una unique constraint sobre
// (pokemon_id, is_shiny, battle_state, costume_id, background_id) — el upsert con
// onConflict fallaba con "there is no unique or exclusion constraint matching the
// ON CONFLICT specification". Sin esa constraint no hay forma de que la base de
// datos deduplique por sí sola, así que en vez de upsert hacemos manualmente
// "buscar y si no existe, crear". Esto no es atómico (dos publicaciones concurrentes
// con la misma combinación exacta podrían crear dos filas de variante duplicadas),
// pero es el único camino sin agregar una constraint a la base de datos.
async function getOrCreateVariant(pokemon: PokemonSummary, isShiny: boolean, battleState: BattleState) {
  const { data: existing, error: selectError } = await supabase
    .from('pokemon_variants')
    .select('id')
    .eq('pokemon_id', pokemon.id)
    .eq('is_shiny', isShiny)
    .eq('battle_state', battleState)
    .is('costume_id', null)
    .is('background_id', null)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }
  if (existing) {
    return existing.id as string;
  }

  const { data: created, error: insertError } = await supabase
    .from('pokemon_variants')
    .insert({
      pokemon_id: pokemon.id,
      is_shiny: isShiny,
      battle_state: battleState,
      costume_id: null,
      background_id: null,
    })
    .select('id')
    .single();

  if (insertError || !created) {
    throw new Error(insertError?.message ?? 'No se pudo crear la variante del Pokémon.');
  }

  return created.id as string;
}

function configuredSlots(slots: TradeSideSlot[]) {
  return slots.filter(
    (slot): slot is TradeSideSlot & { pokemon: PokemonSummary } => slot.pokemon !== null
  );
}

export default function PublishTradePage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();

  const [offeringSlots, setOfferingSlots] = useState<TradeSideSlot[]>(createInitialSlots);
  const [seekingSlots, setSeekingSlots] = useState<TradeSideSlot[]>(createInitialSlots);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const hasAnyPokemon =
    configuredSlots(offeringSlots).length > 0 || configuredSlots(seekingSlots).length > 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    if (!user) {
      setSubmitError('Necesitás iniciar sesión para publicar.');
      return;
    }

    const offering = configuredSlots(offeringSlots);
    const seeking = configuredSlots(seekingSlots);

    if (offering.length === 0 && seeking.length === 0) {
      setSubmitError('Agregá al menos un Pokémon en "Ofrezco" o en "Busco a cambio".');
      return;
    }

    setIsSubmitting(true);

    let offeringVariantIds: string[];
    let seekingVariantIds: string[];
    try {
      [offeringVariantIds, seekingVariantIds] = await Promise.all([
        Promise.all(offering.map((slot) => getOrCreateVariant(slot.pokemon, slot.isShiny, slot.battleState))),
        Promise.all(seeking.map((slot) => getOrCreateVariant(slot.pokemon, slot.isShiny, slot.battleState))),
      ]);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo preparar alguna de las variantes.');
      setIsSubmitting(false);
      return;
    }

    // Quantity y notes se guardan duplicados en todas las filas del grupo (criterio más
    // simple): así cualquiera de las filas que se lea por separado conserva la info
    // completa del post, sin depender de cuál fila del grupo se consulte primero.
    const tradeGroupId = crypto.randomUUID();
    const rows = [
      ...offeringVariantIds.map((variantId) => ({
        user_id: user.id,
        trade_group_id: tradeGroupId,
        variant_id: variantId,
        intent: 'for_trade' as const,
        quantity,
        notes: notes.trim() || null,
        status: 'active' as const,
      })),
      ...seekingVariantIds.map((variantId) => ({
        user_id: user.id,
        trade_group_id: tradeGroupId,
        variant_id: variantId,
        intent: 'looking_for' as const,
        quantity,
        notes: notes.trim() || null,
        status: 'active' as const,
      })),
    ];

    const { error: insertError } = await supabase.from('user_trades').insert(rows);

    if (insertError) {
      setSubmitError(`No se pudo publicar el trade: ${insertError.message}`);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setShowSuccessToast(true);
    setTimeout(() => {
      router.push('/');
    }, 900);
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
            <h1 className="text-base font-extrabold tracking-tight">Publicar trade</h1>
            <p className="text-xs text-[#5C6773]">Indica qué ofreces y qué buscas a cambio</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-4 py-6">
        {!isUserLoading && !user && (
          <p className="mb-4 rounded-xl border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-3 py-2.5 text-xs font-semibold text-[#FF3D3D]">
            Necesitás iniciar sesión para publicar.{' '}
            <Link href="/login" className="underline underline-offset-2 hover:text-[#F4F6F8]">
              Iniciar sesión
            </Link>
          </p>
        )}

        <section className="rounded-2xl border border-[#232D38] bg-[#131A22] p-4">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-[#8792A0]">
            1. Pokémon del intercambio
          </h2>
          <p className="mb-3 text-[11px] text-[#5C6773]">Podés agregar hasta 10 Pokémon distintos por lado.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <TradeSideList side="offer" slots={offeringSlots} onChange={setOfferingSlots} />
            <TradeSideList side="seek" slots={seekingSlots} onChange={setSeekingSlots} />
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-[#232D38] bg-[#131A22] p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#8792A0]">2. Detalles</h2>

          <label className="block text-xs font-semibold text-[#8792A0]">Cantidad</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1.5 w-24 rounded-lg border border-[#232D38] bg-[#0B0F14] px-3 py-2 text-sm
                       text-[#F4F6F8] outline-none transition focus:border-[#2E9BF5]"
          />

          <label className="mt-4 block text-xs font-semibold text-[#8792A0]">
            Notas <span className="text-[#5C6773]">(opcional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Ej. acepto legendarios a cambio"
            className="mt-1.5 w-full resize-none rounded-lg border border-[#232D38] bg-[#0B0F14] px-3 py-2
                       text-sm text-[#F4F6F8] placeholder:text-[#5C6773] outline-none transition
                       focus:border-[#2E9BF5]"
          />
        </section>

        {submitError && (
          <p
            className="mt-4 rounded-xl border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-3 py-2.5 text-xs
                        font-semibold text-[#FF3D3D]"
          >
            {submitError}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <Link
            href="/"
            className="flex-1 rounded-full border border-[#232D38] px-5 py-2.5 text-center text-xs
                       font-semibold text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !user || !hasAnyPokemon}
            className="flex-1 rounded-full bg-[#2E9BF5] px-5 py-2.5 text-xs font-semibold text-white
                       transition hover:bg-[#2589db] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Publicando…' : 'Publicar trade'}
          </button>
        </div>
      </form>

      {showSuccessToast && <Toast message="Trade publicado. Redirigiendo…" />}
    </main>
  );
}
