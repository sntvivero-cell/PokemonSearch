import { HomeFeed } from '@/app/components/home/HomeFeed';
import { buildPageMetadata } from '@/app/lib/seo';

export const metadata = buildPageMetadata({
  title: 'GoTraderz — Pokémon GO Trading Community Board',
  description:
    "Browse and post Pokémon GO trades: Shiny, Legendary, Lucky, and Special Trades. Find trainers offering the Pokémon you're looking for, free and community-run.",
  path: '/',
  ogDescription:
    "Browse and post Pokémon GO trades: Shiny, Legendary, Lucky, and Special Trades. Find trainers offering the Pokémon you're looking for.",
});

export default function HomePage() {
  return <HomeFeed />;
}
