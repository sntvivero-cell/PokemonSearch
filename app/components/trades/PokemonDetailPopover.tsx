'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { Sparkles, Mountain, X } from 'lucide-react';
import type { PokemonVariant } from '@/app/types/trades';
import { TYPE_COLORS } from '@/app/types/pokemons';

const BATTLE_LABEL: Record<string, string> = {
  dynamax: 'Dynamax',
  gigantamax: 'Gigantamax',
  shadow: 'Shadow',
  purified: 'Purified',
};

const POPOVER_WIDTH = 224; // w-56
const VIEWPORT_MARGIN = 8;

// `(hover: hover)` refleja la capacidad del input PRIMARIO del dispositivo, a
// diferencia de `window.innerWidth`/breakpoints (una tablet grande en modo touch
// puede tener un viewport ancho pero sigue sin hover real) o de `'ontouchstart' in
// window` (da falsos positivos en laptops con pantalla táctil que también tienen
// mouse). Por eso es el criterio recomendado para decidir hover vs. tap.
function useHoverCapableDevice() {
  const [hoverCapable, setHoverCapable] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(hover: hover)').matches
  );

  useEffect(() => {
    const mql = window.matchMedia('(hover: hover)');
    const handleChange = (e: MediaQueryListEvent) => setHoverCapable(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return hoverCapable;
}

interface PokemonDetailPopoverProps {
  variant: PokemonVariant;
  children: ReactNode;
  className?: string;
}

export function PokemonDetailPopover({ variant, children, className }: PokemonDetailPopoverProps) {
  const { pokemon } = variant;
  const hoverCapable = useHoverCapableDevice();

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Se recalcula recién cuando el popover ya está en el DOM, así `popoverRef` tiene
  // una altura real para decidir si abre hacia arriba o hacia abajo — evita el flash
  // de una estimación fija que después "salta" al medir el contenido real.
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !popoverRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverHeight = popoverRef.current.offsetHeight;

    let left = triggerRect.left + triggerRect.width / 2 - POPOVER_WIDTH / 2;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN));

    const fitsAbove = triggerRect.top - popoverHeight - VIEWPORT_MARGIN >= 0;
    const top = fitsAbove
      ? triggerRect.top - popoverHeight - VIEWPORT_MARGIN
      : Math.min(triggerRect.bottom + VIEWPORT_MARGIN, window.innerHeight - popoverHeight - VIEWPORT_MARGIN);

    setPosition({ top, left });
  }, [isOpen]);

  // En touch, "afuera" cierra; en cualquier modo, hacer scroll de la lista deja el
  // popover flotando en un lugar que ya no corresponde al sprite, así que también cierra.
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    function handleScroll() {
      setIsOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const hoverHandlers = hoverCapable
    ? {
        onMouseEnter: () => setIsOpen(true),
        onMouseLeave: () => setIsOpen(false),
        onFocus: () => setIsOpen(true),
        onBlur: () => setIsOpen(false),
      }
    : {
        onClick: () => setIsOpen((prev) => !prev),
      };

  const spriteUrl =
    (variant.is_shiny ? pokemon.shiny_sprite_url : null) ?? pokemon.sprite_url ?? '/sprites/unknown.png';
  const hasDetails = variant.is_shiny || variant.battle_state !== 'none' || variant.background;

  return (
    <div ref={triggerRef} className={className} tabIndex={0} role="button" aria-expanded={isOpen} {...hoverHandlers}>
      {children}

      {isOpen && (
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: position?.top ?? -9999, left: position?.left ?? -9999 }}
          className="z-50 w-56 rounded-xl border border-[#232D38] bg-[#131A22] p-3 shadow-lg backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={hoverCapable ? () => setIsOpen(true) : undefined}
          onMouseLeave={hoverCapable ? () => setIsOpen(false) : undefined}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Cerrar detalle"
            className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full
                       text-[#5C6773] transition hover:bg-[#232D38] hover:text-[#F4F6F8]"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="relative mx-auto h-20 w-20">
            <Image
              src={spriteUrl}
              alt={pokemon.name}
              fill
              sizes="80px"
              className={`object-contain ${variant.is_shiny ? 'drop-shadow-[0_0_8px_#FFCB05aa]' : ''}`}
            />
          </div>

          <p className="mt-1 text-center text-sm font-bold capitalize text-[#F4F6F8]">{pokemon.name}</p>
          <p className="text-center text-[10px] text-[#5C6773]">#{String(pokemon.dex_number).padStart(3, '0')}</p>

          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {pokemon.types.map((type) => (
              <span
                key={type}
                style={{ backgroundColor: `${TYPE_COLORS[type] ?? '#5C6773'}26`, color: TYPE_COLORS[type] ?? '#8792A0' }}
                className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              >
                {type}
              </span>
            ))}
          </div>

          {hasDetails && (
            <div className="mt-2 flex flex-col gap-1 border-t border-[#232D38] pt-2 text-[10px] font-semibold">
              {variant.is_shiny && (
                <span className="flex items-center gap-1.5 text-[#FFCB05]">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  Shiny
                </span>
              )}
              {variant.battle_state !== 'none' && (
                <span className="flex items-center gap-1.5 text-[#7B5CB8]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7B5CB8]" />
                  {BATTLE_LABEL[variant.battle_state]}
                </span>
              )}
              {variant.background && (
                <span className="flex items-center gap-1.5 text-[#2E9BF5]">
                  <Mountain className="h-3 w-3 shrink-0" />
                  {variant.background.name}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
