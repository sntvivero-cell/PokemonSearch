'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { fetchBackgrounds } from '@/app/lib/backgrounds';
import type { BackgroundOption } from '@/app/types/trades';
import { TradeSideList, configuredSlots, createInitialSlots, type TradeSideSlot } from './TradeSideList';

export interface TradeFormValues {
  offering: TradeSideSlot[];
  seeking: TradeSideSlot[];
  quantity: number;
  notes: string;
  isSpoofer: boolean;
}

export interface TradeFormInitialValues {
  offering: TradeSideSlot[];
  seeking: TradeSideSlot[];
  quantity: number;
  notes: string;
  isSpoofer: boolean;
}

interface TradeFormProps {
  initialValues?: TradeFormInitialValues;
  isUserReady: boolean;
  isLoggedIn: boolean;
  submitLabel: string;
  submittingLabel: string;
  // Devuelve un mensaje de error para mostrar, o null si salió bien (el caller se
  // encarga de la redirección/toast tras el éxito).
  onSubmit: (values: TradeFormValues) => Promise<string | null>;
  cancelHref?: string;
}

// Formulario compartido entre /publicar (vacío) y /publicar/[tradeGroupId]/editar
// (precargado vía `initialValues`) — misma selección de Pokémon por lado, cantidad y
// notas; solo cambia qué hace onSubmit con esos datos.
export function TradeForm({
  initialValues,
  isUserReady,
  isLoggedIn,
  submitLabel,
  submittingLabel,
  onSubmit,
  cancelHref = '/',
}: TradeFormProps) {
  const [offeringSlots, setOfferingSlots] = useState<TradeSideSlot[]>(
    () => initialValues?.offering ?? createInitialSlots()
  );
  const [seekingSlots, setSeekingSlots] = useState<TradeSideSlot[]>(
    () => initialValues?.seeking ?? createInitialSlots()
  );
  const [quantity, setQuantity] = useState(initialValues?.quantity ?? 1);
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [isSpoofer, setIsSpoofer] = useState(initialValues?.isSpoofer ?? false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Catálogo chico, se trae una sola vez acá y se pasa a los dos lados (Ofrezco/
  // Busco) en vez de que cada VariantConfigurator lo pida por separado.
  const [backgrounds, setBackgrounds] = useState<BackgroundOption[]>([]);
  useEffect(() => {
    fetchBackgrounds().then(setBackgrounds);
  }, []);

  const hasAnyPokemon = configuredSlots(offeringSlots).length > 0 || configuredSlots(seekingSlots).length > 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    if (!isLoggedIn) {
      setSubmitError('Necesitás iniciar sesión.');
      return;
    }
    if (!hasAnyPokemon) {
      setSubmitError('Agregá al menos un Pokémon en "Ofrezco" o en "Busco a cambio".');
      return;
    }

    setIsSubmitting(true);
    const error = await onSubmit({ offering: offeringSlots, seeking: seekingSlots, quantity, notes, isSpoofer });
    setIsSubmitting(false);
    if (error) setSubmitError(error);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-4 py-6">
      {isUserReady && !isLoggedIn && (
        <p className="mb-4 rounded-xl border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-3 py-2.5 text-xs font-semibold text-[#FF3D3D]">
          Necesitás iniciar sesión.{' '}
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
          <TradeSideList side="offer" slots={offeringSlots} onChange={setOfferingSlots} backgrounds={backgrounds} />
          <TradeSideList side="seek" slots={seekingSlots} onChange={setSeekingSlots} backgrounds={backgrounds} />
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

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setIsSpoofer((v) => !v)}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs
                       font-semibold transition ${
                         isSpoofer
                           ? 'border-[#FF3D3D]/60 bg-[#FF3D3D]/10 text-[#FF3D3D]'
                           : 'border-[#232D38] text-[#8792A0] hover:border-[#3A4C63]'
                       }`}
          >
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Hago spoofing (Fly)
            </span>
            <span>{isSpoofer ? 'Activado' : 'Desactivado'}</span>
          </button>
          <p className="mt-1.5 text-[11px] text-[#5C6773]">
            Marca esto si usás apps de ubicación falsa para jugar.
          </p>
        </div>

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
          href={cancelHref}
          className="flex-1 rounded-full border border-[#232D38] px-5 py-2.5 text-center text-xs
                     font-semibold text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isSubmitting || !isLoggedIn || !hasAnyPokemon}
          className="flex-1 rounded-full bg-[#2E9BF5] px-5 py-2.5 text-xs font-semibold text-white
                     transition hover:bg-[#2589db] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
