'use client';

import { useState, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  User,
  ArrowLeftRight,
  Pencil,
  Trash2,
  Mountain,
  MapPin,
  HelpCircle,
  MessageCircle,
  Bookmark,
} from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { timeAgo } from '@/app/lib/timeAgo';
import { getOrCreateConversation } from '@/app/lib/conversations';
import { PokemonDetailPopover } from '@/app/components/trades/PokemonDetailPopover';
import { RankBadge } from '@/app/components/trades/RankBadge';
import type { TradePost, PokemonVariant } from '@/app/types/trades';

interface TradeCardProps {
  trade: TradePost;
  // Sin usuario logueado no se muestra "Editar"/"Eliminar", aunque el post sea propio.
  currentUserId?: string | null;
  onDeleted?: (tradeGroupId: string) => void;
  // Estado inicial conocido por el padre (bulk fetch vía fetchSavedTradeGroupIds, ver
  // app/lib/savedTrades.ts) — evita que cada card haga su propia consulta a
  // saved_trades. Si se omite (ej. todavía no resolvió), arranca en "no guardado".
  isSaved?: boolean;
  // Avisa al padre cuando cambia el guardado, para que actualice su propio estado sin
  // refetchear todo — clave en app/guardados/page.tsx, donde sacar un guardado debe
  // sacar la card de la grilla al toque.
  onSaveChange?: (tradeGroupId: string, isSaved: boolean) => void;
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

function VariantThumb({ variant }: { variant: PokemonVariant }) {
  const { pokemon } = variant;

  return (
    <PokemonDetailPopover
      variant={variant}
      className="flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border border-[#232D38]
                 bg-[#131A22] p-1 text-center outline-none transition hover:border-[#3A4C63]
                 focus-visible:border-[#2E9BF5]"
    >
      <div className="relative h-10 w-10 shrink-0 sm:h-12 sm:w-12">
        <Image
          src={(variant.is_shiny ? pokemon.shiny_sprite_url : null) ?? pokemon.sprite_url ?? '/sprites/unknown.png'}
          alt={pokemon.name}
          fill
          sizes="48px"
          className={`object-contain ${variant.is_shiny ? 'drop-shadow-[0_0_5px_#FFCB05aa]' : ''}`}
        />
      </div>
      <span className="w-full truncate text-[8px] font-semibold capitalize text-[#F4F6F8]">{pokemon.name}</span>
      {(variant.is_shiny || variant.battle_state !== 'none' || variant.background) && (
        <div className="flex flex-wrap items-center justify-center gap-0.5">
          {variant.is_shiny && <Sparkles className="h-2 w-2 shrink-0 text-[#FFCB05]" />}
          {variant.battle_state !== 'none' && (
            <span className="rounded-full bg-[#7B5CB8]/15 px-1 text-[7px] font-bold uppercase text-[#7B5CB8]">
              {BATTLE_LABEL[variant.battle_state]}
            </span>
          )}
          {variant.background && <Mountain className="h-2 w-2 shrink-0 text-[#2E9BF5]" />}
        </div>
      )}
    </PokemonDetailPopover>
  );
}

function VariantSide({ variants, openToOffers }: { variants: PokemonVariant[]; openToOffers?: boolean }) {
  if (openToOffers) {
    return (
      <div className="flex-1 rounded-xl border border-[#232D38] bg-[#0B0F14] p-2">
        <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border border-[#232D38] bg-[#131A22] px-2 py-4 text-center">
          <HelpCircle className="h-5 w-5 shrink-0 text-[#FF3D3D]" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#FF3D3D]">Busco ofertas</span>
        </div>
      </div>
    );
  }

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

export function TradeCard({ trade, currentUserId, onDeleted, isSaved, onSaveChange }: TradeCardProps) {
  const isOwner = currentUserId != null && trade.user_id === currentUserId;
  const router = useRouter();

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  // `isSaved` llega del padre y puede resolverse recién después del primer render (el
  // bulk fetch de saved_trades corre en un efecto aparte) — en vez de sincronizarlo a
  // estado local con un useEffect (dispara un re-render extra en cascada), se guarda
  // solo el override optimista que produce un click propio: mientras no hayas
  // tocado el botón vos, `saved` sigue la prop en tiempo real; después de tocarlo, el
  // override manda hasta que este componente se desmonte.
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);
  const saved = optimisticSaved ?? (isSaved ?? false);
  const [isTogglingSave, setIsTogglingSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // stopPropagation: el botón vive adentro del <Link> al perfil (ver abajo), así que
  // sin esto el click también dispararía la navegación al perfil.
  async function handleToggleSave(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!currentUserId) {
      router.push('/login');
      return;
    }

    setSaveError(null);
    setIsTogglingSave(true);

    if (saved) {
      const { error } = await supabase
        .from('saved_trades')
        .delete()
        .eq('user_id', currentUserId)
        .eq('trade_group_id', trade.trade_group_id);

      setIsTogglingSave(false);
      if (error) {
        setSaveError('No se pudo quitar de guardados.');
        return;
      }
      setOptimisticSaved(false);
      onSaveChange?.(trade.trade_group_id, false);
      return;
    }

    const { error } = await supabase
      .from('saved_trades')
      .insert({ user_id: currentUserId, trade_group_id: trade.trade_group_id });

    setIsTogglingSave(false);
    if (error) {
      setSaveError('No se pudo guardar.');
      return;
    }
    setOptimisticSaved(true);
    onSaveChange?.(trade.trade_group_id, true);
  }

  // stopPropagation: el botón vive adentro del <Link> al perfil (ver abajo), así que
  // sin esto el click también dispararía la navegación al perfil.
  async function handleMessage(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!currentUserId) {
      router.push('/login');
      return;
    }

    setConversationError(null);
    setIsStartingConversation(true);

    try {
      const conversationId = await getOrCreateConversation(currentUserId, trade.user_id);
      router.push(`/mensajes/${conversationId}`);
    } catch (err) {
      setConversationError(err instanceof Error ? err.message : 'No se pudo abrir la conversación.');
      setIsStartingConversation(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      '¿Eliminar esta publicación? Se van a borrar todos los Pokémon de ambos lados (ofreces y buscas). Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;

    setDeleteError(null);
    setIsDeleting(true);

    const { error } = await supabase
      .from('user_trades')
      .delete()
      .eq('trade_group_id', trade.trade_group_id)
      .eq('user_id', trade.user_id);

    setIsDeleting(false);

    if (error) {
      setDeleteError(`No se pudo eliminar: ${error.message}`);
      return;
    }

    onDeleted?.(trade.trade_group_id);
  }

  return (
    <article className="rounded-2xl border border-[#232D38] bg-[#131A22] p-4 transition-colors hover:border-[#3A4C63]">
      {(trade.is_spoofer || trade.trinket_choice !== 'none') && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {trade.is_spoofer && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FF3D3D]/15 px-2.5 py-1 text-[10px] font-bold uppercase text-[#FF3D3D]">
              <MapPin className="h-3 w-3" />
              Fly
            </span>
          )}
          {trade.trinket_choice !== 'none' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#2E9BF5]/15 px-2.5 py-1 text-[10px] font-bold uppercase text-[#2E9BF5]">
              <Image src="/trinket2.jpg" alt="" width={12} height={12} className="object-contain" />
              {trade.trinket_choice === 'self' ? 'Mi trinket' : 'Tu trinket'}
            </span>
          )}
        </div>
      )}

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
          <VariantSide variants={trade.lookingFor} openToOffers={trade.open_to_offers} />
        </div>
      </div>

      {trade.quantity > 1 && (
        <p className="mt-3 text-center text-[10px] font-semibold text-[#8792A0]">
          Cantidad: ×{trade.quantity}
        </p>
      )}

      {trade.notes && <p className="mt-3 line-clamp-2 text-xs text-[#8792A0]">{trade.notes}</p>}

      <div className="mt-3 flex items-center justify-between border-t border-[#232D38] pt-2.5">
        {trade.username ? (
          <div className="flex min-w-0 items-center gap-1">
            <Link
              href={`/usuario/${trade.user_id}`}
              className="flex min-w-0 items-center gap-1.5 text-xs text-[#8792A0] transition hover:text-[#F4F6F8]"
            >
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{trade.username}</span>
              <RankBadge rank={trade.rank} />
            </Link>
            {trade.user_id !== currentUserId && (
              <button
                type="button"
                onClick={handleMessage}
                disabled={isStartingConversation}
                title="Enviar mensaje"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border
                           border-[#232D38] text-[#8792A0] transition hover:border-[#2E9BF5]
                           hover:text-[#2E9BF5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageCircle className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-[#8792A0]">
            <User className="h-3.5 w-3.5" />
            Entrenador
          </div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {/* Visible siempre que no sea tu propia publicación — a diferencia de
             Editar/Eliminar (que solo aparecen si sos el dueño), guardar aplica
             justo al revés: no tiene sentido guardar tu propio post. */}
          {!isOwner && (
            <button
              type="button"
              onClick={handleToggleSave}
              disabled={isTogglingSave}
              title={saved ? 'Quitar de guardados' : 'Guardar'}
              aria-pressed={saved}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition
                          disabled:cursor-not-allowed disabled:opacity-50 ${
                            saved
                              ? 'border-[#FFCB05]/50 bg-[#FFCB05]/15 text-[#FFCB05]'
                              : 'border-[#232D38] text-[#8792A0] hover:border-[#FFCB05] hover:text-[#FFCB05]'
                          }`}
            >
              <Bookmark className="h-3 w-3" fill={saved ? 'currentColor' : 'none'} />
            </button>
          )}
          <span className="text-[10px] text-[#5C6773]">{timeAgo(trade.created_at)}</span>
        </div>
      </div>

      {isOwner && (
        <div className="mt-2.5 flex gap-2 border-t border-[#232D38] pt-2.5">
          <Link
            href={`/publicar/${trade.trade_group_id}/editar`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#232D38]
                       px-3 py-1.5 text-[11px] font-semibold text-[#8792A0] transition hover:border-[#3A4C63]
                       hover:text-[#F4F6F8]"
          >
            <Pencil className="h-3 w-3" />
            Editar
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border
                       border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-3 py-1.5 text-[11px] font-semibold
                       text-[#FF3D3D] transition hover:bg-[#FF3D3D]/20 disabled:cursor-not-allowed
                       disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            {isDeleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      )}

      {deleteError && (
        <p className="mt-2 rounded-lg border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-2 py-1.5 text-[10px] font-semibold text-[#FF3D3D]">
          {deleteError}
        </p>
      )}

      {conversationError && (
        <p className="mt-2 rounded-lg border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-2 py-1.5 text-[10px] font-semibold text-[#FF3D3D]">
          {conversationError}
        </p>
      )}

      {saveError && (
        <p className="mt-2 rounded-lg border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-2 py-1.5 text-[10px] font-semibold text-[#FF3D3D]">
          {saveError}
        </p>
      )}
    </article>
  );
}
