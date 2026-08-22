'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { BackgroundOption, BattleState } from '@/app/types/trades';
import type { PokemonSummary } from './PokemonSearchPicker';

const BATTLE_STATES: { value: BattleState; label: string }[] = [
  { value: 'none', label: 'Normal' },
  { value: 'dynamax', label: 'DMAX' },
  { value: 'gigantamax', label: 'GMAX' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'purified', label: 'Purified' },
];

// Mismo orden en el que aparecen en el check constraint de backgrounds.category.
const CATEGORY_ORDER = [
  'team',
  'seasonal',
  'location',
  'stadium',
  'national_trust',
  'pokelids',
  'pokemon_center',
  'other',
];

const CATEGORY_LABELS: Record<string, string> = {
  team: 'Team',
  seasonal: 'Season / Event',
  location: 'Location',
  stadium: 'Stadium',
  national_trust: 'National Trust',
  pokelids: 'PokéLids',
  pokemon_center: 'Pokémon Center',
  other: 'Other',
};

interface VariantConfiguratorProps {
  pokemon: PokemonSummary;
  isShiny: boolean;
  battleState: BattleState;
  background: BackgroundOption | null;
  backgrounds: BackgroundOption[];
  onShinyChange: (value: boolean) => void;
  onBattleStateChange: (value: BattleState) => void;
  onBackgroundChange: (value: BackgroundOption | null) => void;
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
  background,
  backgrounds,
  onShinyChange,
  onBattleStateChange,
  onBackgroundChange,
  onClear,
  accent = 'blue',
}: VariantConfiguratorProps) {
  const [isBackgroundOpen, setIsBackgroundOpen] = useState(false);

  const groupedBackgrounds = useMemo(() => {
    const byCategory = new Map<string, BackgroundOption[]>();
    for (const bg of backgrounds) {
      if (!byCategory.has(bg.category)) byCategory.set(bg.category, []);
      byCategory.get(bg.category)!.push(bg);
    }
    return CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => ({
      category,
      items: byCategory.get(category)!,
    }));
  }, [backgrounds]);

  function selectBackground(value: BackgroundOption | null) {
    onBackgroundChange(value);
    setIsBackgroundOpen(false);
  }

  return (
    <div className="rounded-xl border border-[#232D38] bg-[#0B0F14] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-14 w-14 shrink-0">
            <Image
              src={(isShiny ? pokemon.shiny_sprite_url : null) ?? pokemon.sprite_url ?? '/sprites/unknown.png'}
              alt={pokemon.name}
              fill
              sizes="56px"
              unoptimized
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
          Change
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
          <span>{isShiny ? 'On' : 'Off'}</span>
        </button>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#5C6773]">
          Battle state
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

      {backgrounds.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#5C6773]">Background</p>
          <button
            type="button"
            onClick={() => setIsBackgroundOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-[#232D38] px-3 py-2
                       text-xs font-semibold text-[#8792A0] transition hover:border-[#3A4C63]"
          >
            <span className="truncate">{background?.name ?? 'No background'}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${isBackgroundOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isBackgroundOpen && (
            <div className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-[#232D38] bg-[#131A22] p-2">
              <button
                type="button"
                onClick={() => selectBackground(null)}
                className={`mb-2 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                  background === null
                    ? ACCENT_ACTIVE_PILL[accent]
                    : 'border border-[#232D38] text-[#8792A0] hover:border-[#3A4C63]'
                }`}
              >
                No background
              </button>

              {groupedBackgrounds.map(({ category, items }) => (
                <div key={category} className="mb-2 last:mb-0">
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[#5C6773]">
                    {CATEGORY_LABELS[category] ?? category}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((bg) => {
                      const isActive = background?.id === bg.id;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() => selectBackground(bg)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                            isActive
                              ? ACCENT_ACTIVE_PILL[accent]
                              : 'border border-[#232D38] text-[#8792A0] hover:border-[#3A4C63]'
                          }`}
                        >
                          {bg.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
