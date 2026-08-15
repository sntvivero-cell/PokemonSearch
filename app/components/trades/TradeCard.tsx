'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Sparkles, User, ArrowLeftRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { formatDuration, msUntilNextBump } from '@/app/lib/tradeTiming';
import type { TradePost, PokemonVariant } from '@/app/types/trades';

interface TradeCardProps {
  trade: TradePost;
  // Sin usuario logueado no se muestra el botón "Actualizar" aunque el post sea propio.
  currentUserId?: string | null;
  onBumped?: (tradeGroupId: string, updatedAt: string) => void;
}

const BATTLE_LABEL: Record<string, string> = {
  dynamax: 'DMAX',
  gigantamax: 'GMAX',
  shadow: 'SHADOW',
  purified: 'PURIFIED',
};

// Máximo de sprites que se dibujan por lado antes de colapsar el resto en "+N más",
// para que una publicación con hasta 10 Pokémon por lado no rompa el layout del feed.
const MAX_VISIBLE_PER_SIDE = 4;

function timeAgo(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function VariantThumb({ variant }: { variant: PokemonVariant }) {
  const { pokemon } = variant;

  return (
    <div
      title={`${pokemon.name}${variant.is_shiny ? ' ✦ shiny' : ''}${
        variant.battle_state !== 'none' ? ` · ${BATTLE_LABEL[variant.battle_state]}` : ''
      }`}
      className="flex flex-col items-center gap-0.5 rounded-lg border border-[#232D38] bg-[#131A22] p-1 text-center"
    >
      <div className="relative h-10 w-10 shrink-0 sm:h-12 sm:w-12">
        <Image
          src={pokemon.sprite_url ?? '/sprites/unknown.png'}
          alt={pokemon.name}
          fill
          sizes="48px"
          className={`object-contain ${variant.is_shiny ? 'drop-shadow-[0_0_5px_#FFCB05aa]' : ''}`}
        />
      </div>
      <span className="w-full truncate text-[8px] font-semibold capitalize text-[#F4F6F8]">{pokemon.name}</span>
      {(variant.is_shiny || variant.battle_state !== 'none') && (
        <div className="flex items-center justify-center gap-0.5">
          {variant.is_shiny && <Sparkles className="h-2 w-2 shrink-0 text-[#FFCB05]" />}
          {variant.battle_state !== 'none' && (
            <span className="rounded-full bg-[#7B5CB8]/15 px-1 text-[7px] font-bold uppercase text-[#7B5CB8]">
              {BATTLE_LABEL[variant.battle_state]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function VariantSide({ variants }: { variants: PokemonVariant[] }) {
  if (variants.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#232D38] px-2 py-4 text-center">
        <span className="text-[10px] text-[#5C6773]">Sin especificar</span>
      </div>
    );
  }

  const visible = variants.slice(0, MAX_VISIBLE_PER_SIDE);
  const remaining = variants.length - visible.length;

  return (
    <div className="flex-1 rounded-xl border border-[#232D38] bg-[#0B0F14] p-2">
      <div className="grid grid-cols-2 gap-1.5">
        {visible.map((variant) => (
          <VariantThumb key={variant.id} variant={variant} />
        ))}
        {remaining > 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-[#232D38] bg-[#131A22] py-1.5 text-center">
            <span className="text-[11px] font-bold text-[#8792A0]">+{remaining}</span>
            <span className="text-[7px] font-semibold uppercase tracking-wide text-[#5C6773]">más</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function TradeCard({ trade, currentUserId, onBumped }: TradeCardProps) {
  const showBumpAction = currentUserId != null && trade.user_id === currentUserId;

  // Se re-renderiza cada 30s solo si hace falta ir contando el cooldown en pantalla;
  // sin esto el texto "Podés actualizar en X" quedaría congelado hasta la próxima
  // acción del usuario en la página.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!showBumpAction) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, [showBumpAction]);

  const [isBumping, setIsBumping] = useState(false);
  const [bumpError, setBumpError] = useState<string | null>(null);

  const remainingMs = msUntilNextBump(trade.updated_at);
  const canBump = remainingMs <= 0;

  async function handleBump() {
    setBumpError(null);
    setIsBumping(true);

    // UPDATE trivial (quantity al mismo valor) sobre todas las filas del grupo. El
    // trigger de la base pisa updated_at con now(); lo mandamos también explícito acá
    // por si el trigger no estuviera aplicado. La policy RESTRICTIVE de UPDATE en
    // user_trades es la que realmente hace cumplir el cooldown de 30 min y el
    // ownership — esto de acá es solo para no dejar que el intento falle en silencio.
    const { data, error } = await supabase
      .from('user_trades')
      .update({ quantity: trade.quantity, updated_at: new Date().toISOString() })
      .eq('trade_group_id', trade.trade_group_id)
      .eq('user_id', trade.user_id)
      .select('updated_at');

    setIsBumping(false);

    if (error) {
      setBumpError(`No se pudo actualizar: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      setBumpError('Todavía no se puede actualizar este post (esperá el tiempo de espera).');
      return;
    }

    onBumped?.(trade.trade_group_id, data[0].updated_at);
  }

  return (
    <article className="rounded-2xl border border-[#232D38] bg-[#131A22] p-4 transition-colors hover:border-[#3A4C63]">
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-col">
          <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-[#2E9BF5]">
            Ofrece{trade.offering.length > 0 && ` (${trade.offering.length})`}
          </p>
          <VariantSide variants={trade.offering} />
        </div>

        <ArrowLeftRight className="mt-5 h-4 w-4 shrink-0 text-[#5C6773]" />

        <div className="flex flex-1 flex-col">
          <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-[#FF3D3D]">
            Busca{trade.lookingFor.length > 0 && ` (${trade.lookingFor.length})`}
          </p>
          <VariantSide variants={trade.lookingFor} />
        </div>
      </div>

      {trade.quantity > 1 && (
        <p className="mt-3 text-center text-[10px] font-semibold text-[#8792A0]">
          Cantidad: ×{trade.quantity}
        </p>
      )}

      {trade.notes && <p className="mt-3 line-clamp-2 text-xs text-[#8792A0]">{trade.notes}</p>}

      <div className="mt-3 flex items-center justify-between border-t border-[#232D38] pt-2.5">
        <div className="flex items-center gap-1.5 text-xs text-[#8792A0]">
          <User className="h-3.5 w-3.5" />
          Entrenador
        </div>
        <span className="text-[10px] text-[#5C6773]">{timeAgo(trade.created_at)}</span>
      </div>

      {showBumpAction && (
        <div className="mt-2.5 border-t border-[#232D38] pt-2.5">
          {bumpError && (
            <p className="mb-2 rounded-lg border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-2 py-1.5 text-[10px] font-semibold text-[#FF3D3D]">
              {bumpError}
            </p>
          )}
          <button
            type="button"
            onClick={handleBump}
            disabled={!canBump || isBumping}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#2E9BF5]/40
                       bg-[#2E9BF5]/10 px-3 py-1.5 text-[11px] font-semibold text-[#2E9BF5] transition
                       hover:bg-[#2E9BF5]/20 disabled:cursor-not-allowed disabled:opacity-50
                       disabled:hover:bg-[#2E9BF5]/10"
          >
            <RefreshCw className={`h-3 w-3 ${isBumping ? 'animate-spin' : ''}`} />
            {isBumping
              ? 'Actualizando…'
              : canBump
                ? 'Actualizar'
                : `Podés actualizar en ${formatDuration(remainingMs)}`}
          </button>
        </div>
      )}
    </article>
  );
}
