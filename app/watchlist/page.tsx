'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, Trash2 } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';
import { PokemonSearchPicker, type PokemonSummary } from '@/app/components/publish/PokemonSearchPicker';

interface WatchedPokemon {
  watchlistId: string;
  pokemon: PokemonSummary;
}

export default function WatchlistPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [watched, setWatched] = useState<WatchedPokemon[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('watchlist')
        .select('id, pokemon:pokemons ( id, dex_number, name, sprite_url, shiny_sprite_url )')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error('Error fetching watchlist:', error.message);
        setIsLoading(false);
        return;
      }

      setWatched(
        (data ?? [])
          .filter((row) => row.pokemon != null)
          .map((row) => ({ watchlistId: row.id as string, pokemon: row.pokemon as unknown as PokemonSummary }))
      );
      setIsLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user, isUserLoading, router]);

  async function handleAdd(pokemon: PokemonSummary) {
    if (!user) return;
    setAddError(null);

    if (watched.some((w) => w.pokemon.id === pokemon.id)) {
      setAddError(`${pokemon.name} is already on your watchlist.`);
      return;
    }

    const { data, error } = await supabase
      .from('watchlist')
      .insert({ user_id: user.id, pokemon_id: pokemon.id })
      .select('id')
      .single();

    if (error) {
      // unique(user_id, pokemon_id) — puede pasar por una carrera (dos tabs).
      if (error.code === '23505') {
        setAddError(`${pokemon.name} is already on your watchlist.`);
      } else {
        setAddError(`Could not add: ${error.message}`);
      }
      return;
    }

    setWatched((prev) => [{ watchlistId: data.id as string, pokemon }, ...prev]);
  }

  async function handleRemove(watchlistId: string) {
    if (!user) return;
    setRemoveError(null);
    setRemovingId(watchlistId);

    const { error } = await supabase.from('watchlist').delete().eq('id', watchlistId).eq('user_id', user.id);

    setRemovingId(null);

    if (error) {
      setRemoveError(`Could not remove: ${error.message}`);
      return;
    }

    setWatched((prev) => prev.filter((w) => w.watchlistId !== watchlistId));
  }

  if (isUserLoading || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F14] text-[#F4F6F8]">
        <p className="text-xs text-[#5C6773]">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F14] text-[#F4F6F8]">
      <header className="border-b border-[#232D38] bg-[#0B0F14]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#232D38]
                       text-[#8792A0] transition hover:border-[#3A4C63] hover:text-[#F4F6F8]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-base font-extrabold tracking-tight">Watchlist</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/"
          className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-[#8792A0] transition hover:text-[#F4F6F8]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to feed
        </Link>

        <p className="mb-4 text-xs leading-relaxed text-[#8792A0]">
          Add a Pokémon here and we&apos;ll email you as soon as someone posts a trade offering it — as long as
          email notifications are turned on in{' '}
          <Link href="/configuracion" className="text-[#2E9BF5] hover:underline">
            Settings
          </Link>
          .
        </p>

        <div className="mb-6 rounded-xl border border-[#232D38] bg-[#131A22] p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#8792A0]">Add a Pokémon</h2>
          <PokemonSearchPicker onSelect={handleAdd} accent="blue" />
          {addError && (
            <p className="mt-2 rounded-lg border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-2 py-1.5 text-[10px] font-semibold text-[#FF3D3D]">
              {addError}
            </p>
          )}
        </div>

        {removeError && (
          <p className="mb-4 rounded-lg border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-2 py-1.5 text-[10px] font-semibold text-[#FF3D3D]">
            {removeError}
          </p>
        )}

        {watched.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#232D38] py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2E9BF5]/10">
              <Bell className="h-5 w-5 text-[#2E9BF5]" />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#F4F6F8]">You&apos;re not watching anything yet</p>
            <p className="mt-1 text-xs text-[#5C6773]">Search above to add your first Pokémon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {watched.map(({ watchlistId, pokemon }) => (
              <div
                key={watchlistId}
                className="flex items-center gap-2 rounded-xl border border-[#232D38] bg-[#131A22] p-2.5"
              >
                <div className="relative h-10 w-10 shrink-0">
                  <Image
                    src={pokemon.sprite_url ?? '/sprites/unknown.png'}
                    alt={pokemon.name}
                    fill
                    sizes="40px"
                    unoptimized
                    className="object-contain"
                  />
                </div>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#F4F6F8]">{pokemon.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(watchlistId)}
                  disabled={removingId === watchlistId}
                  title="Remove"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#232D38]
                             text-[#8792A0] transition hover:border-[#FF3D3D] hover:text-[#FF3D3D]
                             disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
