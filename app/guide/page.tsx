import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Repeat, Gift, Star, UserRound, ArrowRightLeft, ListChecks, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { TYPE_COLORS } from '@/app/types/pokemons';

export const metadata = {
  title: 'Trading Guide — GoTraderz',
};

const EVOLUTION_TRADE_POKEMON: { label: string; name: string; form: string }[] = [
  { label: 'Kadabra', name: 'Kadabra', form: 'Normal' },
  { label: 'Machoke', name: 'Machoke', form: 'Normal' },
  { label: 'Graveler', name: 'Graveler', form: 'Normal' },
  { label: 'Alolan Graveler', name: 'Graveler', form: 'Alola' },
  { label: 'Haunter', name: 'Haunter', form: 'Normal' },
  { label: 'Boldore', name: 'Boldore', form: 'Normal' },
  { label: 'Gurdurr', name: 'Gurdurr', form: 'Normal' },
  { label: 'Karrablast', name: 'Karrablast', form: 'Normal' },
  { label: 'Shelmet', name: 'Shelmet', form: 'Normal' },
  { label: 'Phantump', name: 'Phantump', form: 'Normal' },
  { label: 'Pumpkaboo', name: 'Pumpkaboo', form: 'Normal' },
];

interface SpriteRow {
  name: string;
  form: string;
  types: string[];
  sprite_url: string | null;
}

interface EvolutionCardData {
  sprite: string | null;
  typeColor: string;
}

async function getEvolutionTradeCards(): Promise<Record<string, EvolutionCardData>> {
  const names = Array.from(new Set(EVOLUTION_TRADE_POKEMON.map((p) => p.name)));
  const { data } = await supabase.from('pokemons').select('name, form, types, sprite_url').in('name', names);
  const rows = (data as SpriteRow[]) ?? [];

  // Graveler solo tiene la forma "Normal" cargada en `pokemons` (sin fila para
  // "Alola") — para esa entrada no hay sprite propio, así que reutilizamos el color
  // de tipo de la especie base (Rock) como acento, pero sin mostrar su sprite normal
  // como si fuera el regional (sería un dato falso).
  const findRow = (name: string, form: string) => rows.find((r) => r.name === name && r.form === form);

  const result: Record<string, EvolutionCardData> = {};
  for (const p of EVOLUTION_TRADE_POKEMON) {
    const exact = findRow(p.name, p.form);
    const fallback = rows.find((r) => r.name === p.name);
    const primaryType = exact?.types?.[0] ?? fallback?.types?.[0];
    result[p.label] = {
      sprite: exact?.sprite_url ?? null,
      typeColor: (primaryType && TYPE_COLORS[primaryType]) || '#8792A0',
    };
  }
  return result;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-bold text-[#2E9BF5]">{children}</h2>;
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#232D38] bg-[#131A22] p-4 text-xs leading-relaxed text-[#8792A0]">
      {children}
    </div>
  );
}

function IconListRow({
  icon: Icon,
  children,
  last = false,
}: {
  icon: typeof Repeat;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 py-2.5 ${last ? '' : 'border-b border-[#232D38]'}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B0F14] text-[#2E9BF5]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[#F4F6F8]">{children}</span>
    </div>
  );
}

function StepCard({
  number,
  icon: Icon,
  title,
  children,
}: {
  number: number;
  icon: typeof UserRound;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#232D38] bg-[#0B0F14] p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2E9BF5]/15 text-[11px] font-bold text-[#2E9BF5]">
        {number}
      </span>
      <div className="flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-[#2E9BF5]" />
          <span className="font-bold text-[#F4F6F8]">{title}</span>
        </div>
        <p className="text-[#8792A0]">{children}</p>
      </div>
    </div>
  );
}

export default async function TradingGuidePage() {
  const evolutionCards = await getEvolutionTradeCards();

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
          <h1 className="text-base font-extrabold tracking-tight">Trading Guide</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-[#8792A0]">
        <Link
          href="/"
          className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-[#8792A0] transition hover:text-[#F4F6F8]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to feed
        </Link>

        <p className="mb-8 text-xs leading-relaxed">
          One of the most useful features of Pok&eacute;mon GO is the ability to trade Pok&eacute;mon with other
          players, adding a social and collaborative element to the experience. If you&apos;re new to trading in
          Pok&eacute;mon GO, here&apos;s a comprehensive guide to get you started!
        </p>

        {/* 1. Requirements for Trading */}
        <section className="mb-8">
          <SectionHeading>1. Requirements for Trading</SectionHeading>
          <InfoBox>
            <p className="mb-2">Before you can start trading Pok&eacute;mon with your friends, there are a few prerequisites you need to meet:</p>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <span className="font-bold text-[#F4F6F8]">Trainer Level:</span> You must be at least level 10 to
                unlock the trading feature.
              </li>
              <li>
                <span className="font-bold text-[#F4F6F8]">Proximity:</span> You and the player you want to trade
                with need to be physically close to each other, usually within 100 meters, unless you are Forever
                Friends and have earnt a Remote Trade, in which case you can trade from anywhere in the world.
              </li>
              <li>
                <span className="font-bold text-[#F4F6F8]">Friendship Levels:</span> There are different Friendship
                Levels (Good Friends, Great Friends, Ultra Friends, Best Friends and Forever Friends) that offer
                trading benefits, such as reduced Stardust costs, increased chances for Lucky Trades, and even
                Remote Trading. You need to be at least Good Friends to initiate a trade.
              </li>
            </ul>
          </InfoBox>
        </section>

        {/* 2. How to Trade */}
        <section className="mb-8">
          <SectionHeading>2. How to Trade</SectionHeading>
          <InfoBox>
            <p className="mb-3">Trading in Pok&eacute;mon GO is a relatively straightforward process:</p>
            <div className="space-y-2">
              <StepCard number={1} icon={UserRound} title="Tap on the friend's avatar">
                Go to your Friends List, select the friend you want to trade with, and tap on their avatar.
              </StepCard>
              <StepCard number={2} icon={ArrowRightLeft} title="Initiate a trade">
                Once you&apos;re on your friend&apos;s profile screen, tap the &ldquo;Trade&rdquo; button.
              </StepCard>
              <StepCard number={3} icon={ListChecks} title="Select the Pokémon">
                Both you and your friend will need to choose the Pok&eacute;mon you want to trade. You can either
                select from your current Pok&eacute;mon storage or use the search function to find specific
                Pok&eacute;mon.
              </StepCard>
              <StepCard number={4} icon={CheckCircle2} title="Confirm the trade">
                Once both players have selected their Pok&eacute;mon, you&apos;ll see a summary of the trade,
                including the Stardust cost. Confirm the trade to initiate the exchange.
              </StepCard>
            </div>
            <p className="mt-3 text-[11px] text-[#5C6773]">This works differently for Remote Trading, which we cover below.</p>
          </InfoBox>
        </section>

        {/* 3. Trade Costs */}
        <section className="mb-8">
          <SectionHeading>3. Trade Costs</SectionHeading>
          <InfoBox>
            <p className="mb-3">
              Trades in Pok&eacute;mon GO require Stardust, a valuable in-game resource. The amount of Stardust
              required for a trade depends on several factors, such as your Friendship Level, and whether it&apos;s
              a Special Trade. Higher Friendship Levels reduce the Stardust cost.
            </p>
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 overflow-hidden rounded-xl border border-[#232D38] text-[11px]">
                <thead>
                  <tr className="bg-[#1B2530] text-left text-[#8792A0]">
                    <th className="px-3 py-2.5 font-semibold">Friendship Level</th>
                    <th className="px-3 py-2.5 font-semibold">Discount</th>
                    <th className="px-3 py-2.5 font-semibold">Regular &amp; Regional (Caught)</th>
                    <th className="px-3 py-2.5 font-semibold">Regular &amp; Regional (New)</th>
                    <th className="px-3 py-2.5 font-semibold">Shiny &amp; Legendary (Caught)</th>
                    <th className="px-3 py-2.5 font-semibold">Shiny &amp; Legendary (New)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[#232D38]">
                    <td className="px-3 py-2.5 font-semibold text-[#F4F6F8]">Good Friends (1 Day)</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">0%</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">100 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">20,000 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">20,000 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">1,000,000 Stardust</td>
                  </tr>
                  <tr className="border-t border-[#232D38]">
                    <td className="px-3 py-2.5 font-semibold text-[#F4F6F8]">Great Friends (7 Days)</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">20%</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">100 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">16,000 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">16,000 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">800,000 Stardust</td>
                  </tr>
                  <tr className="border-t border-[#232D38]">
                    <td className="px-3 py-2.5 font-semibold text-[#F4F6F8]">Ultra Friends (30 Days)</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">92%</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">100 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">1,600 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">1,600 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">80,000 Stardust</td>
                  </tr>
                  <tr className="border-t border-[#232D38]">
                    <td className="px-3 py-2.5 font-semibold text-[#F4F6F8]">Best Friends (90 Days)</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">96%</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">100 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">800 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">800 Stardust</td>
                    <td className="px-3 py-2.5 text-[#F4F6F8]">40,000 Stardust</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </InfoBox>
        </section>

        {/* 4. Remote Trading and Forever Friends */}
        <section className="mb-8">
          <SectionHeading>4. Remote Trading and Forever Friends</SectionHeading>
          <InfoBox>
            <p className="mb-3">
              To reach Forever Friends, Trainers must earn 90 Friendship Points with each Friend after becoming Best
              Friends.
            </p>
            <p className="mb-3">
              Friendship Points are a progression system that replaces the old &ldquo;daily interaction&rdquo;
              mechanic as the main way to track friendship progression between Trainers.
            </p>
            <p className="mb-2">You can earn up to 1 Friendship Point per day per Friend by doing a variety of activities together:</p>
            <div className="mb-3 rounded-lg border border-[#232D38] bg-[#0B0F14] px-3">
              <IconListRow icon={Repeat}>Trading</IconListRow>
              <IconListRow icon={Gift}>Sending Gifts</IconListRow>
              <IconListRow icon={Star} last>
                Completing other friendship interactions
              </IconListRow>
            </div>
            <p className="mb-3">
              You can also speed up progress by completing Weekly Challenges with your Friends, earning up to 7
              extra Friendship Points per week. Any event bonuses that boost friendship gain (for example, double
              friendship points during special events) will apply to Forever Friends progression.
            </p>
            <p className="mb-3">
              Every time you earn 90 Friendship Points, you&apos;ll unlock one Remote Trade with that Friend. Forever
              Friends is a repeatable level: you can continue earning Friendship Points and receive additional
              Remote Trades each time you hit 90 points again.
            </p>
            <p className="mb-3">
              However, Remote Trades don&apos;t stack. If you already have an unused Remote Trade, you&apos;ll need
              to use it before earning another one.
            </p>
            <p className="mb-3">
              Additionally, each Remote Trade is tied to the Friend you earned it with. It can&apos;t be transferred
              or used with any other Friend. Trainers can complete one Remote Trade per day across all Friends,
              regardless of how many Forever Friends they have.
            </p>
            <p className="mb-3">
              Before your first Remote Trade, you&apos;ll be prompted to use a special Remote Trade tag to mark the
              Pok&eacute;mon you&apos;re willing to trade with your Forever Friends.
            </p>
            <p className="mb-4">
              Once you and another Trainer become Forever Friends, you&apos;ll each be able to see one
              another&apos;s Pok&eacute;mon that are tagged for Remote Trading. These are the only Pok&eacute;mon
              available for trade.
            </p>

            <h3 className="mb-2 text-xs font-bold text-[#F4F6F8]">How to Remote Trade</h3>
            <p className="mb-2">To start a Remote Trade:</p>
            <ol className="mb-3 ml-4 list-decimal space-y-2">
              <li>Trainers take turns selecting up to three Pok&eacute;mon from their Friend&apos;s tagged list that they&apos;d like to receive.</li>
              <li>These selections are sent to the other Trainer as a trade &ldquo;wish list.&rdquo;</li>
              <li>Each Trainer then chooses one Pok&eacute;mon from their Friend&apos;s wish list to offer in return.</li>
              <li>Both Trainers review the final selections and can confirm or cancel the trade at any time.</li>
            </ol>
            <p className="mb-3">
              You&apos;re not locked in during the process. Either Trainer can decline or restart the trade at any
              point before confirming.
            </p>
            <p className="mb-3">
              If you&apos;re Lucky Friends, your next trade — even if it&apos;s remote — will result in a Lucky
              Pok&eacute;mon. After completing the trade, you&apos;ll no longer be Lucky Friends, just like with
              normal in-person trades. You can also use Lucky Trinkets as normal to guarantee a Lucky Pok&eacute;mon.
            </p>
            <p className="mb-4">
              Trainers can complete one Remote Trade per day, and Remote Trades do not count as Special Trades, no
              matter which Pok&eacute;mon are traded.
            </p>

            <h3 className="mb-2 text-xs font-bold text-[#F4F6F8]">🚫 Pok&eacute;mon That Are Banned from Remote Trades</h3>
            <p className="mb-2">The following Pok&eacute;mon cannot be included in a Remote Trade:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Pok&eacute;mon caught in the last 30 days</li>
              <li>Previously traded Pok&eacute;mon</li>
              <li>Shadow Pok&eacute;mon</li>
              <li>Mythical Pok&eacute;mon</li>
              <li>Pok&eacute;mon defending Gyms or Power Spots</li>
              <li>Pok&eacute;mon currently set as your buddy</li>
              <li>Actively Mega-Evolved Pok&eacute;mon</li>
              <li>Fused Pok&eacute;mon</li>
              <li>Crowned Sword Zacian and Crowned Shield Zamazenta</li>
              <li>Pok&eacute;mon placed at Pok&eacute;mon Playgrounds</li>
            </ul>
          </InfoBox>
        </section>

        {/* 5. Evolution Trades */}
        <section className="mb-8">
          <SectionHeading>5. Evolution Trades</SectionHeading>
          <InfoBox>
            <p className="mb-4">
              Trade Evolutions can be evolved as usual, but are expensive, requiring 100 candies. If you receive
              these Pok&eacute;mon in a trade from another trainer, it won&apos;t cost you anything to evolve them.
              Remember, you can only trade a Pok&eacute;mon once, so it is best to hold onto these Pok&eacute;mon
              until your friend has one too, so you can trade and both benefit from the free evolution.
            </p>
            <p className="mb-3 text-[11px] text-[#5C6773]">Pok&eacute;mon with trade evolutions include:</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {EVOLUTION_TRADE_POKEMON.map((p) => {
                const card = evolutionCards[p.label];
                return (
                  <div
                    key={p.label}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-[#232D38] px-2 py-3 text-center"
                    style={{ backgroundColor: `${card.typeColor}1a` }}
                  >
                    {card.sprite ? (
                      <Image
                        src={card.sprite}
                        alt={p.label}
                        width={48}
                        height={48}
                        unoptimized
                        className="h-12 w-12 object-contain"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#131A22] text-lg font-bold"
                        style={{ color: card.typeColor }}
                      >
                        ?
                      </div>
                    )}
                    <span className="text-[10px] font-semibold text-[#F4F6F8]">{p.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-[#5C6773]">
              Alolan Graveler doesn&apos;t have its own sprite in the Pok&eacute;dex data yet, so it&apos;s shown with
              a placeholder.
            </p>
          </InfoBox>
        </section>

        {/* 6. Special Trades */}
        <section className="mb-8">
          <SectionHeading>6. Special Trades</SectionHeading>
          <InfoBox>
            <p>
              Special Trades are trades involving Legendary, Shiny, or Pok&eacute;mon not yet registered in your
              Pok&eacute;dex. These trades have a higher Stardust cost, even with high Friendship Levels. You can
              only perform one Special Trade per day (unless noted otherwise during an event), so choose wisely.
            </p>
          </InfoBox>
        </section>

        {/* 7. Lucky Trades and Lucky Friends */}
        <section className="mb-8">
          <SectionHeading>7. Lucky Trades and Lucky Friends</SectionHeading>
          <InfoBox>
            <p className="mb-3">
              When you become Best Friends with another player in Pok&eacute;mon GO, any interaction that would
              typically increase your friendship levels (i.e. the first interaction each day that gives your friend
              the blue halo), has a chance to trigger Lucky Friends. This means that your next trade with that
              player will result in both traded Pok&eacute;mon becoming Lucky Pok&eacute;mon. Niantic hasn&apos;t
              released the odds of achieving Lucky Friends on each interaction, but data from The Silph Road
              subreddit note that the Lucky Friends odds is a little bit below 2% per exchange.
            </p>
            <p className="mb-3">
              After making a trade in Pok&eacute;mon GO, there&apos;s a possibility that the Pok&eacute;mon you
              receive is Lucky. This type of trade costs the same amount of stardust and looks identical to a
              regular trade. However, you&apos;ll notice that you&apos;ve received a Lucky Pok&eacute;mon only when
              you see the summary of the received Pok&eacute;mon. When a Lucky Trade happens, both the players
              involved in the trade receive Lucky Pok&eacute;mon.
            </p>
            <p className="mb-3">
              If you have had a Pok&eacute;mon for an extended period, you&apos;re more likely to get a Lucky. The
              age of the oldest Pok&eacute;mon participating in a trade is the only factor that the game considers.
              Therefore, trading two old Pok&eacute;mon does not provide any tangible benefit compared to trading
              one old and one freshly caught Pok&eacute;mon.
            </p>
            <p className="mb-2">Niantic hasn&apos;t confirmed the odds, but these are what the players have observed:</p>
            <div className="-mx-4 mb-3 overflow-x-auto px-4">
              <table className="w-full min-w-[320px] border-separate border-spacing-0 overflow-hidden rounded-xl border border-[#232D38] text-[11px]">
                <thead>
                  <tr className="bg-[#1B2530] text-left text-[#8792A0]">
                    <th className="px-3 py-2.5 font-semibold">When Pok&eacute;mon was caught</th>
                    <th className="px-3 py-2.5 font-semibold">Chance of Lucky Trade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[#232D38]">
                    <td className="px-3 py-2.5 text-[#F4F6F8]">Less than 1 year ago</td>
                    <td className="px-3 py-2.5 font-semibold text-[#F4F6F8]">5%</td>
                  </tr>
                  <tr className="border-t border-[#232D38]">
                    <td className="px-3 py-2.5 text-[#F4F6F8]">1-2 years ago</td>
                    <td className="px-3 py-2.5 font-semibold text-[#F4F6F8]">10%</td>
                  </tr>
                  <tr className="border-t border-[#232D38]">
                    <td className="px-3 py-2.5 text-[#F4F6F8]">More than 2 years ago</td>
                    <td className="px-3 py-2.5 font-semibold text-[#F4F6F8]">25%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mb-4">
              A Lucky Pok&eacute;mon requires half the Stardust to power up and has an IV floor of 12/12/12. This is
              a fantastic way to get powerful Pok&eacute;mon with less Stardust investment.
            </p>

            <h3 className="mb-2 text-xs font-bold text-[#F4F6F8]">Guaranteed Lucky Trade without Lucky Friends trick</h3>
            <p className="mb-3">
              In 2018, Niantic announced a major update for the Lucky Pok&eacute;mon system! According to the
              official blog post &mdash; if you trade a Pok&eacute;mon that was caught between July 2016 &ndash;
              August 2016, it is guaranteed to become a Lucky Pok&eacute;mon.
            </p>
            <p className="mb-3">Every account has a hidden counter of the number of guaranteed lucky trades they participated in.</p>
            <p className="mb-3">
              Note, this is NOT the number of lucky trades you have had in total. Lucky friend trades and random
              lucky trades do not affect the counter.
            </p>
            <p className="mb-3">
              If you trade a Pok&eacute;mon caught before 31st December 2018, the trade will go lucky if your
              &lsquo;hidden counter&rsquo; of guaranteed lucky trades is less than 25. Both Trainers in the trade
              will then have their counter increase by 1.
            </p>
            <p>
              Only one of the Pok&eacute;mon in the trade has to be caught before 31st December 2018. This
              Pok&eacute;mon is the &lsquo;trigger&rsquo;. The trainer with the &lsquo;trigger&rsquo; Pok&eacute;mon
              must not have more than 25 guaranteed trades on their hidden counter.
            </p>
            <p className="mt-3 text-[11px] text-[#5C6773]">Check out this article for a more in-depth explanation.</p>
          </InfoBox>
        </section>

        {/* 8. Trade Restrictions */}
        <section className="mb-4">
          <SectionHeading>8. Trade Restrictions</SectionHeading>
          <InfoBox>
            <p className="mb-2">There are a few important restrictions to keep in mind:</p>
            <ul className="mb-4 ml-4 list-disc space-y-2">
              <li>
                <span className="font-bold text-[#F4F6F8]">Mythical Pok&eacute;mon:</span> You can&apos;t trade
                Mythical Pok&eacute;mon (like Mew, Celebi, etc.)
              </li>
              <li>
                <span className="font-bold text-[#F4F6F8]">Previously Traded Pok&eacute;mon:</span> Pok&eacute;mon
                that you have received through a trade before cannot be traded again. You can search for previously
                traded Pok&eacute;mon using the search string &lsquo;traded&rsquo;.
              </li>
              <li>
                <span className="font-bold text-[#F4F6F8]">Shadow Pok&eacute;mon:</span> You can&apos;t trade Shadow
                &lsquo;mons
              </li>
              <li>
                Trainers that log in using Niantic Kids or Pok&eacute;mon Trainer Club may need to enable social
                features in the Niantic Kids Parent Portal or Pok&eacute;mon Trainer Club website. Learn more here.
              </li>
              <li>
                <span className="font-bold text-[#F4F6F8]">Fused Pok&eacute;mon:</span> You cannot trade
                Pok&eacute;mon that are Fused.
              </li>
            </ul>
            <p className="text-[11px] italic text-[#5C6773]">
              Trading in Pok&eacute;mon GO is a fantastic way to connect with friends, expand your Pok&eacute;dex,
              and even obtain powerful Lucky Pok&eacute;mon. Make sure to meet the requirements, consider the costs,
              and take advantage of Friendship Levels to make the most out of your trades. Happy trading!
            </p>
          </InfoBox>
        </section>
      </div>
    </main>
  );
}
