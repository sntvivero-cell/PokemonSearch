'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Search, Loader2 } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';

// Solo las columnas confirmadas en `pokemons` (id, dex_number, name, sprite_url,
// shiny_sprite_url). No se usa el tipo `Pokemon` de app/types/pokemons.ts porque ese
// incluye un campo `form` que no está en el esquema confirmado y que aquí no se
// selecciona.
export interface PokemonSummary {
  id: string;
  dex_number: number;
  name: string;
  sprite_url: string | null;
  shiny_sprite_url: string | null;
}

interface PokemonSearchPickerProps {
  onSelect: (pokemon: PokemonSummary) => void;
  accent?: 'blue' | 'red';
}

const ACCENT_BORDER: Record<'blue' | 'red', string> = {
  blue: 'focus:border-[#2E9BF5]',
  red: 'focus:border-[#FF3D3D]',
};

const ACCENT_HOVER: Record<'blue' | 'red', string> = {
  blue: 'hover:border-[#2E9BF5]',
  red: 'hover:border-[#FF3D3D]',
};

export function PokemonSearchPicker({ onSelect, accent = 'blue' }: PokemonSearchPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PokemonSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    let cancelled = false;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      let request = supabase
        .from('pokemons')
        .select('id, dex_number, name, sprite_url, shiny_sprite_url')
        .order('dex_number', { ascending: true })
        .limit(24);

      if (/^\d+$/.test(term)) {
        request = request.eq('dex_number', Number(term));
      } else if (term.length > 0) {
        request = request.ilike('name', `%${term}%`);
      }

      const { data, error: queryError } = await request;
      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setResults([]);
      } else {
        setResults((data as PokemonSummary[]) ?? []);
      }
      setIsLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-[#8792A0]">Buscar Pokémon</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5C6773]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre o número de Pokédex (ej. pikachu, 025)"
          className={`w-full rounded-xl border border-[#232D38] bg-[#0B0F14] py-2.5 pl-9 pr-9 text-sm
                     text-[#F4F6F8] placeholder:text-[#5C6773] outline-none transition ${ACCENT_BORDER[accent]}`}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#5C6773]" />
        )}
      </div>

      {error && <p className="mt-2 text-xs text-[#FF3D3D]">Error al buscar: {error}</p>}

      {!error && !isLoading && results.length === 0 && (
        <p className="mt-3 text-xs text-[#5C6773]">
          {query.trim() ? 'Sin resultados para esa búsqueda.' : 'Escribe para buscar un Pokémon.'}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {results.map((pokemon) => (
            <button
              key={pokemon.id}
              type="button"
              onClick={() => onSelect(pokemon)}
              className={`flex flex-col items-center gap-1 rounded-xl border border-[#232D38] bg-[#131A22] p-2
                         transition ${ACCENT_HOVER[accent]}`}
            >
              <div className="relative h-12 w-12">
                <Image
                  src={pokemon.sprite_url ?? '/sprites/unknown.png'}
                  alt={pokemon.name}
                  fill
                  sizes="48px"
                  className="object-contain"
                />
              </div>
              <span className="font-mono text-[9px] text-[#5C6773]">
                #{String(pokemon.dex_number).padStart(3, '0')}
              </span>
              <span className="w-full truncate text-center text-[10px] font-semibold capitalize text-[#F4F6F8]">
                {pokemon.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
