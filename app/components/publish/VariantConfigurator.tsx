'use client';

import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import type { BattleState } from '@/app/types/trades';
import type { PokemonSummary } from './PokemonSearchPicker';

const BATTLE_STATES: { value: BattleState; label: string }[] = [
  { value: 'none', label: 'Normal' },
  { value: 'dynamax', label: 'DMAX' },
  { value: 'gigantamax', label: 'GMAX' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'purified', label: 'Purified' },
];

interface VariantConfiguratorProps {
  pokemon: PokemonSummary;
  isShiny: boolean;
  battleState: BattleState;
  onShinyChange: (value: boolean) => void;
  onBattleStateChange: (value: BattleState) => void;
  onClear: () => void;
  accent?: 'blue' | 'red';
}

const ACCENT_ACTIVE_PILL: Record<'blue' | 'red', string> = {
  blue: 'bg-[#2E9BF5] text-white',
  red: 'bg-[#FF3D3D] text-white',
};

export function VariantConfigurator({
  pokemon,
  isShiny,
  battleState,
  onShinyChange,
  onBattleStateChange,
  onClear,
  accent = 'blue',
}: VariantConfiguratorProps) {
  return (
    <div className="rounded-xl border border-[#232D38] bg-[#0B0F14] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-14 w-14 shrink-0">
            <Image
              src={pokemon.sprite_url ?? '/sprites/unknown.png'}
              alt={pokemon.name}
              fill
              sizes="56px"
              className={`object-contain ${isShiny ? 'drop-shadow-[0_0_6px_#FFCB05aa]' : ''}`}
            />
          </div>
          <div className="min-w-0">
            <span className="font-mono text-[10px] font-semibold text-[#5C6773]">
              #{String(pokemon.dex_number).padStart(3, '0')}
            </span>
            <p className="truncate text-sm font-semibold capitalize text-[#F4F6F8]">{pokemon.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-xs font-semibold text-[#5C6773] transition hover:text-[#F4F6F8]"
        >
          Cambiar
        </button>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => onShinyChange(!isShiny)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition ${
            isShiny
              ? 'border-[#FFCB05]/60 bg-[#FFCB05]/10 text-[#FFCB05]'
              : 'border-[#232D38] text-[#8792A0] hover:border-[#3A4C63]'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Shiny
          </span>
          <span>{isShiny ? 'Activado' : 'Desactivado'}</span>
        </button>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#5C6773]">
          Estado de combate
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BATTLE_STATES.map((state) => {
            const isActive = battleState === state.value;
            return (
              <button
                key={state.value}
                type="button"
                onClick={() => onBattleStateChange(state.value)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                  isActive
                    ? ACCENT_ACTIVE_PILL[accent]
                    : 'border border-[#232D38] text-[#8792A0] hover:border-[#3A4C63]'
                }`}
              >
                {state.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
