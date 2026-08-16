'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { HelpCircle, MapPin } from 'lucide-react';
import { fetchBackgrounds } from '@/app/lib/backgrounds';
import { fetchCooldownRemainingMs, formatDuration } from '@/app/lib/tradeTiming';
import type { BackgroundOption, TrinketChoice } from '@/app/types/trades';
import { TradeSideList, configuredSlots, createInitialSlots, type TradeSideSlot } from './TradeSideList';

const TRINKET_OPTIONS: { value: TrinketChoice; label: string }[] = [
  { value: 'none', label: 'Sin trinket' },
  { value: 'self', label: 'Mi trinket' },
  { value: 'other', label: 'Tu trinket' },
];

export interface TradeFormValues {
  offering: TradeSideSlot[];
  seeking: TradeSideSlot[];
  quantity: number;
  notes: string;
  isSpoofer: boolean;
  trinketChoice: TrinketChoice;
  openToOffers: boolean;
}

export interface TradeFormInitialValues {
  offering: TradeSideSlot[];
  seeking: TradeSideSlot[];
  quantity: number;
  notes: string;
  isSpoofer: boolean;
  trinketChoice: TrinketChoice;
  openToOffers: boolean;
}

interface TradeFormProps {
  initialValues?: TradeFormInitialValues;
  isUserReady: boolean;
  isLoggedIn: boolean;
  // Necesario para chequear el cooldown de 30 min contra sus propias filas — null
  // mientras isLoggedIn sea false o el usuario todavía no cargó.
  userId: string | null;
  // "publicar" o "editar" — para el mensaje "Podés {verbo} de nuevo en X".
  cooldownActionVerb: string;
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
  userId,
  cooldownActionVerb,
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
  const [trinketChoice, setTrinketChoice] = useState<TrinketChoice>(initialValues?.trinketChoice ?? 'none');
  const [openToOffers, setOpenToOffers] = useState(initialValues?.openToOffers ?? false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Catálogo chico, se trae una sola vez acá y se pasa a los dos lados (Ofrezco/
  // Busco) en vez de que cada VariantConfigurator lo pida por separado.
  const [backgrounds, setBackgrounds] = useState<BackgroundOption[]>([]);
  useEffect(() => {
    fetchBackgrounds().then(setBackgrounds);
  }, []);

  // Espejo del chequeo de cooldown que hace publish_trade_group() en la base (max
  // updated_at de TODAS las filas del usuario, sin excluir ningún trade_group_id —
  // reeditar el mismo post también cuenta). `now` se guarda como estado (en vez de
  // llamar Date.now() durante el render, que React considera impuro) y solo se
  // actualiza desde efectos: una vez al resolver el chequeo inicial, y después cada
  // 30s mientras el cooldown siga activo, para que el texto cuente hacia abajo y el
  // botón se reactive solo. Es solo UX — la función RPC es la que realmente lo hace
  // cumplir, así que no pasa nada si esto queda desactualizado (ver
  // cooldownMessageFromRpcError en el catch del submit real, en cada page.tsx).
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !userId) return;

    let cancelled = false;
    fetchCooldownRemainingMs(userId).then((remainingMs) => {
      if (cancelled) return;
      const nowMs = Date.now();
      setNow(nowMs);
      setCooldownUntil(remainingMs > 0 ? nowMs + remainingMs : null);
    });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, userId]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const cooldownRemainingMs = cooldownUntil && now ? Math.max(0, cooldownUntil - now) : 0;
  const isInCooldown = cooldownRemainingMs > 0;

  const hasAnyPokemon = configuredSlots(offeringSlots).length > 0 || configuredSlots(seekingSlots).length > 0;

  // "Busco ofertas" y elegir Pokémon puntuales en "Busco a cambio" son mutuamente
  // excluyentes — no tiene sentido pedir algo específico y a la vez aceptar cualquier
  // oferta. Al activar, si ya había Pokémon cargados ahí, se confirma antes de
  // perderlos (no hay forma de "pausarlos": si el usuario se arrepiente, cancela acá).
  function handleToggleOpenToOffers() {
    if (openToOffers) {
      setOpenToOffers(false);
      return;
    }

    if (configuredSlots(seekingSlots).length > 0) {
      const confirmed = window.confirm(
        'Esto va a quitar los Pokémon que elegiste en "Busco a cambio", ¿continuar?'
      );
      if (!confirmed) return;
      setSeekingSlots(createInitialSlots());
    }
    setOpenToOffers(true);
  }

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
    if (!openToOffers && configuredSlots(seekingSlots).length === 0) {
      setSubmitError(
        'Agregá al menos un Pokémon en "Busco a cambio" o activá "No busco nada específico (Busco ofertas)".'
      );
      return;
    }
    if (isInCooldown) {
      setSubmitError(`Podés ${cooldownActionVerb} de nuevo en ${formatDuration(cooldownRemainingMs)}.`);
      return;
    }

    setIsSubmitting(true);
    const error = await onSubmit({
      offering: offeringSlots,
      seeking: seekingSlots,
      quantity,
      notes,
      isSpoofer,
      trinketChoice,
      openToOffers,
    });
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
          <div className="flex flex-1 flex-col">
            <button
              type="button"
              onClick={handleToggleOpenToOffers}
              className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs
                         font-semibold transition ${
                           openToOffers
                             ? 'border-[#FF3D3D]/60 bg-[#FF3D3D]/10 text-[#FF3D3D]'
                             : 'border-[#232D38] text-[#8792A0] hover:border-[#3A4C63]'
                         }`}
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" />
                No busco nada específico (Busco ofertas)
              </span>
              <span>{openToOffers ? 'Activado' : 'Desactivado'}</span>
            </button>
            <TradeSideList
              side="seek"
              slots={seekingSlots}
              onChange={setSeekingSlots}
              backgrounds={backgrounds}
              disabled={openToOffers}
            />
          </div>
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

        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-[#8792A0]">Trinket</p>
          <div className="flex flex-wrap gap-1.5">
            {TRINKET_OPTIONS.map((option) => {
              const isActive = trinketChoice === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTrinketChoice(option.value)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                    isActive
                      ? 'bg-[#2E9BF5] text-white'
                      : 'border border-[#232D38] text-[#8792A0] hover:border-[#3A4C63]'
                  }`}
                >
                  <Image
                    src="/trinket2.jpg"
                    alt=""
                    width={18}
                    height={18}
                    className={`object-contain ${option.value === 'none' ? 'opacity-40' : ''}`}
                  />
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-[#5C6773]">
            El trinket garantiza que el intercambio sea con suerte.
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

      {isInCooldown && (
        <p className="mt-4 rounded-xl border border-[#2E9BF5]/40 bg-[#2E9BF5]/10 px-3 py-2.5 text-xs font-semibold text-[#2E9BF5]">
          Podés {cooldownActionVerb} de nuevo en {formatDuration(cooldownRemainingMs)} — solo se puede publicar o
          editar un post cada 30 minutos.
        </p>
      )}

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
          disabled={isSubmitting || !isLoggedIn || !hasAnyPokemon || isInCooldown}
          className="flex-1 rounded-full bg-[#2E9BF5] px-5 py-2.5 text-xs font-semibold text-white
                     transition hover:bg-[#2589db] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting
            ? submittingLabel
            : isInCooldown
              ? `Disponible en ${formatDuration(cooldownRemainingMs)}`
              : submitLabel}
        </button>
      </div>
    </form>
  );
}
