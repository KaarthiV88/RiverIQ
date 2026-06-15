import Link from 'next/link'
import { DIFFICULTIES } from '../lib/difficulties'

export default function Landing() {
  return (
    <div className="min-h-screen bg-underground text-white flex flex-col items-center px-6 py-16">
      <h1 className="text-7xl font-bold mb-3 tracking-tight">RiverIQ</h1>
      <p className="text-lg mb-2 opacity-70 tracking-wide uppercase">
        Texas Hold&apos;em AI Coaching
      </p>
      <p className="text-base mb-10 opacity-50">
        Pick a table. You&apos;ll meet your opponents when you sit down.
      </p>

      <div className="flex gap-2 mb-10">
        <Link
          href="/stats"
          className="text-sm font-bold px-4 py-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 transition"
        >
          Your Stats
        </Link>
        <Link
          href="/history"
          className="text-sm font-bold px-4 py-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 transition"
        >
          Hand History
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-7xl">
        {DIFFICULTIES.map((diff) => (
          <a
            key={diff.id}
            href={`/game?style=${diff.id}`}
            className="group relative overflow-hidden rounded-2xl bg-zinc-900/70 border border-white/10 hover:border-amber-400/60 hover:shadow-[0_0_30px_rgba(251,191,36,0.25)] transition-all p-6 flex flex-col min-h-[260px]"
          >
            <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${diff.accent}`} />

            <h2 className="text-2xl font-bold tracking-tight mt-2">{diff.name}</h2>
            <p className="text-sm text-amber-300/80 italic mb-3">{diff.tagline}</p>
            <p className="text-sm text-white/70 mb-5">{diff.description}</p>

            <div className="mt-auto pt-4 border-t border-white/5">
              <div className="text-xs uppercase tracking-wide text-white/40">
                Table size &amp; lineup
              </div>
              <div className="text-sm text-white/60 mt-1">Randomized each session</div>
            </div>

            <div className="mt-5 text-amber-300 font-bold text-sm group-hover:translate-x-1 transition-transform">
              Sit at the table →
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
