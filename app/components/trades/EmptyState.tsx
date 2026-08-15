'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#232D38] py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2E9BF5]/10">
        <Sparkles className="h-5 w-5 text-[#2E9BF5]" />
      </div>
      <p className="mt-4 text-sm font-semibold text-[#F4F6F8]">Todavía no hay intercambios</p>
      <p className="mt-1 max-w-xs text-xs text-[#5C6773]">
        Sé el primer entrenador de la comunidad en publicar un Pokémon que ofreces o que buscas.
      </p>
      <Link
        href="/publicar"
        className="mt-5 rounded-full bg-[#2E9BF5] px-5 py-2 text-xs font-semibold text-white
                   transition hover:bg-[#2589db]"
      >
        Publicar el primer trade
      </Link>
    </div>
  );
}