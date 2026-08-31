import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { RankBadge } from '@/app/components/trades/RankBadge';
import { buildPageMetadata } from '@/app/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Top Traders Leaderboard — GoTraderz',
  description: 'See the top 20 Pokémon GO trainers on GoTraderz, ranked by completed trades — updated live.',
  path: '/leaderboard',
  ogTitle: 'Top Traders Leaderboard',
  ogDescription: 'The top 20 Pokémon GO trainers on GoTraderz, ranked by completed trades.',
});

// Se refresca en cada carga: el ranking cambia con cada trade completado, no vale la
// pena cachear una página tan barata de generar (una sola query a una vista pública).
export const dynamic = 'force-dynamic';

interface LeaderboardRow {
  user_id: string;
  username: string | null;
  rank: string;
  total_trades_completed: number;
  total_trades_published: number;
}

async function getTopTraders(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from('profiles_with_rank')
    .select('user_id, username, rank, total_trades_completed, total_trades_published')
    .order('total_trades_completed', { ascending: false })
    .order('total_trades_published', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching leaderboard:', error.message);
    return [];
  }

  return (data ?? []) as LeaderboardRow[];
}

const MEDAL_COLOR: Record<number, string> = {
  1: '#FFCB05',
  2: '#C0C0C0',
  3: '#CD7F32',
};

export default async function LeaderboardPage() {
  const traders = await getTopTraders();

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
          <h1 className="text-base font-extrabold tracking-tight">Leaderboard</h1>
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

        <p className="mb-6 text-xs text-[#8792A0]">Top 20 trainers by completed trades.</p>

        {traders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#232D38] py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2E9BF5]/10">
              <Trophy className="h-5 w-5 text-[#2E9BF5]" />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#F4F6F8]">No completed trades yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#232D38]">
            {traders.map((trader, index) => {
              const position = index + 1;
              const medalColor = MEDAL_COLOR[position];
              return (
                <Link
                  key={trader.user_id}
                  href={`/usuario/${trader.user_id}`}
                  className={`flex items-center gap-3 px-4 py-3 transition hover:bg-[#131A22] ${
                    position !== traders.length ? 'border-b border-[#232D38]' : ''
                  }`}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
                    style={{
                      backgroundColor: medalColor ? `${medalColor}26` : '#232D38',
                      color: medalColor ?? '#8792A0',
                    }}
                  >
                    {position}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-[#F4F6F8]">
                      {trader.username ?? 'Trainer'}
                    </span>
                    <RankBadge rank={trader.rank} />
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-[#22C55E]">
                    {trader.total_trades_completed}
                    <span className="ml-1 text-[10px] font-semibold text-[#5C6773]">completed</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
