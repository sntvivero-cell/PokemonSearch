'use client';

import { HelpCircle, Plus, Repeat, Search, X } from 'lucide-react';
import type { BackgroundOption, BattleState } from '@/app/types/trades';
import { PokemonSearchPicker, type PokemonSummary } from './PokemonSearchPicker';
import { VariantConfigurator } from './VariantConfigurator';

export const MAX_POKEMON_PER_SIDE = 10;

export interface TradeSideSlot {
  id: string;
  pokemon: PokemonSummary | null;
  isShiny: boolean;
  battleState: BattleState;
  background: BackgroundOption | null;
}

function createEmptySlot(): TradeSideSlot {
  return { id: crypto.randomUUID(), pokemon: null, isShiny: false, battleState: 'none', background: null };
}

export function createInitialSlots(): TradeSideSlot[] {
  return [createEmptySlot()];
}

// Filtra los slots que ya tienen un Pokémon elegido (los vacíos son solo el estado
// del buscador en pantalla, no se publican). Compartido entre /publicar y
// /publicar/[tradeGroupId]/editar.
export function configuredSlots(
  slots: TradeSideSlot[]
): (TradeSideSlot & { pokemon: PokemonSummary })[] {
  return slots.filter((slot): slot is TradeSideSlot & { pokemon: PokemonSummary } => slot.pokemon !== null);
}

interface TradeSideListProps {
  side: 'offer' | 'seek';
  slots: TradeSideSlot[];
  onChange: (slots: TradeSideSlot[]) => void;
  backgrounds: BackgroundOption[];
  // Solo lo usa el lado "seek" cuando "No busco nada específico" está activado —
  // deja de tener sentido elegir Pokémon puntuales ahí, así que se oculta la lista.
  disabled?: boolean;
}

const SIDE_COPY: Record<'offer' | 'seek', { label: string; accent: 'blue' | 'red' }> = {
  offer: { label: 'Ofrezco', accent: 'blue' },
  seek: { label: 'Busco a cambio', accent: 'red' },
};

export function TradeSideList({ side, slots, onChange, backgrounds, disabled = false }: TradeSideListProps) {
  const { label, accent } = SIDE_COPY[side];
  const Icon = side === 'offer' ? Repeat : Search;
  const accentColor = accent === 'blue' ? '#2E9BF5' : '#FF3D3D';
  const atLimit = slots.length >= MAX_POKEMON_PER_SIDE;

  function updateSlot(id: string, patch: Partial<TradeSideSlot>) {
    onChange(slots.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
  }

  function removeSlot(id: string) {
    onChange(slots.filter((slot) => slot.id !== id));
  }

  function addSlot() {
    if (atLimit || disabled) return;
    onChange([...slots, createEmptySlot()]);
  }

  return (
    <div className="flex-1 rounded-xl border border-[#232D38] bg-[#0B0F14]/40 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide"
          style={{ color: accentColor }}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        <span className="text-[10px] font-semibold text-[#5C6773]">
          {slots.filter((s) => s.pokemon).length}/{MAX_POKEMON_PER_SIDE}
        </span>
      </div>

      {disabled ? (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#232D38] px-3 py-8 text-center">
          <HelpCircle className="h-5 w-5 text-[#5C6773]" />
          <p className="text-xs font-semibold text-[#8792A0]">Buscando ofertas</p>
          <p className="text-[10px] text-[#5C6773]">No se pide un Pokémon específico.</p>
        </div>
      ) : (
        <>
          {slots.length > 0 && (
            <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-0.5">
              {slots.map((slot) => (
                <div key={slot.id} className="relative">
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.id)}
                    aria-label="Quitar este Pokémon"
                    className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center
                               rounded-full border border-[#232D38] bg-[#131A22] text-[#8792A0] transition
                               hover:border-[#FF3D3D]/60 hover:text-[#FF3D3D]"
                  >
                    <X className="h-3 w-3" />
                  </button>

                  {slot.pokemon ? (
                    <VariantConfigurator
                      pokemon={slot.pokemon}
                      isShiny={slot.isShiny}
                      battleState={slot.battleState}
                      background={slot.background}
                      backgrounds={backgrounds}
                      accent={accent}
                      onShinyChange={(isShiny) => updateSlot(slot.id, { isShiny })}
                      onBattleStateChange={(battleState) => updateSlot(slot.id, { battleState })}
                      onBackgroundChange={(background) => updateSlot(slot.id, { background })}
                      onClear={() =>
                        updateSlot(slot.id, { pokemon: null, isShiny: false, battleState: 'none', background: null })
                      }
                    />
                  ) : (
                    <PokemonSearchPicker
                      accent={accent}
                      onSelect={(pokemon) =>
                        updateSlot(slot.id, { pokemon, isShiny: false, battleState: 'none', background: null })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addSlot}
            disabled={atLimit}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed
                       border-[#232D38] px-3 py-2 text-xs font-semibold text-[#8792A0] transition
                       hover:border-[#3A4C63] hover:text-[#F4F6F8] disabled:cursor-not-allowed disabled:opacity-50
                       disabled:hover:border-[#232D38] disabled:hover:text-[#8792A0]"
          >
            <Plus className="h-3.5 w-3.5" />
            {atLimit ? 'Máximo 10 por publicación' : 'Añadir otro Pokémon'}
          </button>
        </>
      )}
    </div>
  );
}
