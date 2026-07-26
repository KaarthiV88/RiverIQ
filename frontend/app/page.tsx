import Link from 'next/link'
import { DIFFICULTIES, Difficulty } from '../lib/difficulties'
import AuthControl from '../components/AuthControl'

// Suit + rank assignment for each tier. The ranking encodes the stakes
// ladder (2 → 7 → J → A) and the suits encode the room's archetype:
//   ♣ clubs    — recreational, working-class table
//   ♦ diamonds — casual money game
//   ♥ hearts   — mixed pool, sentimental veterans + sharks
//   ♠ spades   — the killers; spades is the high suit
type Suit = '♣' | '♦' | '♥' | '♠'
const TIER_FACE: Record<Difficulty['id'], { rank: string; suit: Suit; tilt: 1 | 2 | 3 | 4 }> = {
  'home-game': { rank: '2', suit: '♣', tilt: 1 },
  'easy':      { rank: '7', suit: '♦', tilt: 2 },
  'medium':    { rank: 'J', suit: '♥', tilt: 3 },
  'hard':      { rank: 'A', suit: '♠', tilt: 4 },
}

function CornerIndex({
  rank, suit, position,
}: { rank: string; suit: Suit; position: 'top' | 'bottom' }) {
  const isRed = suit === '♦' || suit === '♥'
  return (
    <span className={`corner-index ${position} ${isRed ? 'suit-red' : 'suit-black'}`}>
      <span className="rank">{rank}</span>
      <span className="suit">{suit}</span>
    </span>
  )
}

function TierCard({ diff }: { diff: Difficulty }) {
  const face = TIER_FACE[diff.id]
  return (
    <Link
      href={`/game?style=${diff.id}`}
      aria-label={`Sit at the ${diff.name} table`}
      className="tier-card group block focus:outline-none"
      data-tilt={face.tilt}
    >
      <CornerIndex rank={face.rank} suit={face.suit} position="top" />
      <CornerIndex rank={face.rank} suit={face.suit} position="bottom" />

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 py-8">
        <h2 className="tier-title text-3xl md:text-4xl mb-1">{diff.name}</h2>
        <p className="tier-tagline text-sm mb-5">{diff.tagline}</p>
        <p className="tier-body text-sm leading-snug max-w-[22ch]">
          {diff.description}
        </p>
        <div className="absolute bottom-8 left-0 right-0 px-12">
          <p className="tier-footnote">Randomized lineup</p>
        </div>
      </div>
    </Link>
  )
}

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-underground text-white flex flex-col px-6 pt-16 pb-10">
      {/* Hero ─────────────────────────────────────────────────────────────── */}
      <div className="absolute top-4 right-6 z-10">
        <AuthControl />
      </div>

      <header className="text-center max-w-3xl mx-auto">
        <p className="eyebrow mb-4">Texas Hold&apos;em · AI Coaching</p>
        <h1
          className="font-display text-6xl md:text-8xl tracking-tight leading-none"
          style={{ color: 'var(--parchment)' }}
        >
          RiverIQ
        </h1>
        <div className="brass-rule w-40 mx-auto mt-5 mb-4" />
        <p className="text-white/55 text-base italic">
          A back-room game with a learned brain — eight bot archetypes,
          a Monte Carlo equity engine, and a coach that reads your spot
          in real time.
        </p>
      </header>

      {/* Tier cards ─────────────────────────────────────────────────────── */}
      <section className="mt-16 max-w-6xl w-full mx-auto">
        <div className="flex items-center justify-center gap-5 mb-10">
          <span className="brass-rule w-24" />
          <p className="eyebrow whitespace-nowrap">Open Games — Tonight</p>
          <span className="brass-rule w-24" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 px-2">
          {DIFFICULTIES.map(d => <TierCard key={d.id} diff={d} />)}
        </div>
      </section>

      {/* Utility row ─────────────────────────────────────────────────────── */}
      <footer className="mt-16 flex justify-center gap-8 text-sm">
        <Link
          href="/stats"
          className="text-white/55 hover:text-[color:var(--brass)] transition-colors"
        >
          Your stats
        </Link>
        <span className="text-white/20">·</span>
        <Link
          href="/visualize"
          className="text-white/55 hover:text-[color:var(--brass)] transition-colors"
        >
          The session
        </Link>
        <span className="text-white/20">·</span>
        <Link
          href="/history"
          className="text-white/55 hover:text-[color:var(--brass)] transition-colors"
        >
          Hand history
        </Link>
      </footer>
    </div>
  )
}
