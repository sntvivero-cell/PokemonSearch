'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';
import { getOrCreateVariant } from '@/app/lib/variants';
import { configuredSlots, type TradeSideSlot } from '@/app/components/publish/TradeSideList';
import type { PokemonSummary } from '@/app/components/publish/PokemonSearchPicker';
import { TradeForm, type TradeFormValues } from '@/app/components/publish/TradeForm';
import { Toast } from '@/app/components/publish/Toast';
import type { PokemonVariant, TradeIntent } from '@/app/types/trades';

interface EditTradePageProps {
  params: Promise<{ tradeGroupId: string }>;
}

interface RawGroupRow {
  user_id: string;
  intent: TradeIntent;
  quantity: number;
  notes: string | null;
  is_spoofer: boolean;
  created_at: string;
  variant: PokemonVariant;
}

function variantToSlot(variant: PokemonVariant): TradeSideSlot {
  const pokemon: PokemonSummary = {
    id: variant.pokemon.id,
    dex_number: variant.pokemon.dex_number,
    name: variant.pokemon.name,
    sprite_url: variant.pokemon.sprite_url,
  };

  return {
    id: crypto.randomUUID(),
    pokemon,
    isShiny: variant.is_shiny,
    battleState: variant.battle_state,
    background: variant.background,
  };
}

export default function EditTradePage({ params }: EditTradePageProps) {
  const { tradeGroupId } = use(params);
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();

  const [isLoadingGroup, setIsLoadingGroup] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [initialOffering, setInitialOffering] = useState<TradeSideSlot[]>([]);
  const [initialSeeking, setInitialSeeking] = useState<TradeSideSlot[]>([]);
  const [initialQuantity, setInitialQuantity] = useState(1);
  const [initialNotes, setInitialNotes] = useState('');
  const [initialIsSpoofer, setInitialIsSpoofer] = useState(false);
  const [originalCreatedAt, setOriginalCreatedAt] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      router.push('/');
      return;
    }

    let cancelled = false;

    async function loadGroup() {
      setIsLoadingGroup(true);
      setLoadError(null);

      const { data, error } = await supabase
        .from('user_trades')
        .select(
          `
          user_id, intent, quantity, notes, is_spoofer, created_at,
          variant:pokemon_variants!variant_id (
            id, pokemon_id, is_shiny, battle_state,
            background:backgrounds ( id, name, category ),
            pokemon:pokemons ( id, dex_number, name, sprite_url, types )
          )
        `
        )
        .eq('trade_group_id', tradeGroupId);

      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
        setIsLoadingGroup(false);
        return;
      }

      const rows = (data as unknown as RawGroupRow[]) ?? [];
      if (rows.length === 0) {
        setLoadError('No se encontró esta publicación (puede que ya no exista).');
        setIsLoadingGroup(false);
        return;
      }
      if (!user || rows[0].user_id !== user.id) {
        setForbidden(true);
        setIsLoadingGroup(false);
        return;
      }

      setInitialOffering(rows.filter((r) => r.intent === 'for_trade').map((r) => variantToSlot(r.variant)));
      setInitialSeeking(rows.filter((r) => r.intent === 'looking_for').map((r) => variantToSlot(r.variant)));
      setInitialQuantity(rows[0].quantity);
      setInitialNotes(rows[0].notes ?? '');
      setInitialIsSpoofer(rows[0].is_spoofer);
      setOriginalCreatedAt(rows[0].created_at);
      setIsLoadingGroup(false);
    }

    loadGroup();

    return () => {
      cancelled = true;
    };
  }, [user, isUserLoading, tradeGroupId, router]);

  async function handleSubmit(values: TradeFormValues): Promise<string | null> {
    if (!user) return 'Necesitás iniciar sesión.';
    if (!originalCreatedAt) return 'No se pudo determinar la fecha original de la publicación.';

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
      return err instanceof Error ? err.message : 'No se pudo preparar alguna de las variantes.';
    }

    // No usamos UPDATE a propósito: la policy RESTRICTIVE de UPDATE en user_trades
    // (cooldown de 30 min del botón "Actualizar") aplica a CUALQUIER UPDATE sobre la
    // fila, no solo al bump. Si editáramos con UPDATE, quedaría bloqueado guardar
    // cambios dentro de los primeros 30 min de vida del post (o del último bump/
    // edición). DELETE + INSERT no tiene esa restricción: la policy "Users can manage
    // their own trades" (auth.uid() = user_id) permite ambas sin límite de tiempo
    // para el dueño. El created_at original se reenvía explícito en el INSERT para
    // que el post no aparezca como "nuevo" en el feed solo por editarlo.
    const { error: deleteError } = await supabase
      .from('user_trades')
      .delete()
      .eq('trade_group_id', tradeGroupId)
      .eq('user_id', user.id);

    if (deleteError) {
      return `No se pudo actualizar la publicación: ${deleteError.message}`;
    }

    const rows = [
      ...offeringVariantIds.map((variantId) => ({
        user_id: user.id,
        trade_group_id: tradeGroupId,
        variant_id: variantId,
        intent: 'for_trade' as const,
        quantity: values.quantity,
        notes: values.notes.trim() || null,
        is_spoofer: values.isSpoofer,
        status: 'active' as const,
        created_at: originalCreatedAt,
      })),
      ...seekingVariantIds.map((variantId) => ({
        user_id: user.id,
        trade_group_id: tradeGroupId,
        variant_id: variantId,
        intent: 'looking_for' as const,
        quantity: values.quantity,
        notes: values.notes.trim() || null,
        is_spoofer: values.isSpoofer,
        status: 'active' as const,
        created_at: originalCreatedAt,
      })),
    ];

    const { error: insertError } = await supabase.from('user_trades').insert(rows);
    if (insertError) {
      return (
        `Se borró la versión anterior pero no se pudo volver a crear: ${insertError.message}. ` +
        'La publicación quedó eliminada — volvé a cargarla desde /publicar si hace falta.'
      );
    }

    setShowSuccessToast(true);
    setTimeout(() => {
      router.push('/');
    }, 900);
    return null;
  }

  if (isUserLoading || isLoadingGroup) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F14] text-[#F4F6F8]">
        <p className="text-xs text-[#5C6773]">Cargando publicación…</p>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0F14] px-4 text-center text-[#F4F6F8]">
        <p className="text-sm font-semibold">No podés editar esta publicación.</p>
        <p className="text-xs text-[#5C6773]">Esta publicación pertenece a otro entrenador.</p>
        <Link href="/" className="mt-2 text-xs font-semibold text-[#2E9BF5] hover:underline">
          Volver al feed
        </Link>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0F14] px-4 text-center text-[#F4F6F8]">
        <p className="text-sm font-semibold text-[#FF3D3D]">{loadError}</p>
        <Link href="/" className="mt-2 text-xs font-semibold text-[#2E9BF5] hover:underline">
          Volver al feed
        </Link>
      </main>
    );
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
            <h1 className="text-base font-extrabold tracking-tight">Editar trade</h1>
            <p className="text-xs text-[#5C6773]">Actualizá qué ofreces y qué buscás a cambio</p>
          </div>
        </div>
      </header>

      <TradeForm
        initialValues={{
          offering: initialOffering,
          seeking: initialSeeking,
          quantity: initialQuantity,
          notes: initialNotes,
          isSpoofer: initialIsSpoofer,
        }}
        isUserReady={!isUserLoading}
        isLoggedIn={!!user}
        submitLabel="Guardar cambios"
        submittingLabel="Guardando…"
        onSubmit={handleSubmit}
        cancelHref="/"
      />

      {showSuccessToast && <Toast message="Trade actualizado. Redirigiendo…" />}
    </main>
  );
}
