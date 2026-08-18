import { Crown } from 'lucide-react';

interface RankBadgeProps {
  rank: string | null;
}

// Acentos según cantidad de publicaciones NUEVAS acumuladas (profiles.total_trades_published),
// resueltos server-side por public.get_user_rank() — ver migración 0008.
const RANK_ACCENTS: Record<string, string> = {
  Élite: '#FFCB05',
  Veterano: '#2E9BF5',
  Entrenador: '#8792A0',
};

// 'Novato' (y `rank` null, perfil sin resolver todavía) no muestran badge a propósito:
// es el rango de entrada, no tiene sentido saturar visualmente a cada usuario nuevo.
export function RankBadge({ rank }: RankBadgeProps) {
  if (!rank || rank === 'Novato') return null;

  if (rank === 'Desarrollador') {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold
                   uppercase tracking-wide text-[#0B0F14]"
        style={{ background: 'linear-gradient(90deg, #FFCB05, #7B5CB8)' }}
      >
        <Crown className="h-2.5 w-2.5" />
        Desarrollador
      </span>
    );
  }

  const accent = RANK_ACCENTS[rank];
  if (!accent) return null;

  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-bold
                 uppercase tracking-wide"
      style={{ backgroundColor: `${accent}26`, color: accent }}
    >
      {rank}
    </span>
  );
}
