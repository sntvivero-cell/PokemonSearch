'use client';

import { useState } from 'react';
import { BookmarkX } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';

interface SavedPlaceholderCardProps {
  savedTradeId: string;
  onRemoved: (savedTradeId: string) => void;
}

// Se renderiza en app/guardados/page.tsx en lugar de un TradeCard cuando el
// trade_group_id guardado ya no tiene filas activas en user_trades (el autor lo
// borró, o expiró vía /api/cleanup) — a propósito NO se filtra en silencio, para que
// la persona sepa que lo que guardó ya no está y pueda sacarlo de su lista.
export function SavedPlaceholderCard({ savedTradeId, onRemoved }: SavedPlaceholderCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    setError(null);
    setIsRemoving(true);

    const { error: deleteError } = await supabase.from('saved_trades').delete().eq('id', savedTradeId);

    setIsRemoving(false);
    if (deleteError) {
      setError('No se pudo quitar.');
      return;
    }
    onRemoved(savedTradeId);
  }

  return (
    <article className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#232D38] bg-[#0B0F14] p-4 text-center opacity-70">
      <BookmarkX className="h-5 w-5 text-[#5C6773]" />
      <p className="text-xs font-semibold text-[#5C6773]">Esta publicación ya no está disponible</p>
      <button
        type="button"
        onClick={handleRemove}
        disabled={isRemoving}
        className="mt-1 rounded-full border border-[#232D38] px-3 py-1.5 text-[11px] font-semibold text-[#8792A0]
                   transition hover:border-[#3A4C63] hover:text-[#F4F6F8] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRemoving ? 'Quitando…' : 'Quitar de guardados'}
      </button>
      {error && <p className="text-[10px] font-semibold text-[#FF3D3D]">{error}</p>}
    </article>
  );
}
