'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StoredHand, listHands } from '../../lib/history'
import { getUserId } from '../../lib/userId'
import Card from '../../components/Card'
import { Card as CardType } from '../../types/poker'

function PrettyDate({ iso }: { iso: string }) {
  const d = new Date(iso)
  const label = d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  return <span>{label}</span>
}

function ResultBadge({ result }: { result: number }) {
  const positive = result > 0
  const zero = result === 0
  return (
    <span
      className={`px-2 py-0.5 rounded-md font-mono font-bold text-sm ${
        zero
          ? 'bg-zinc-800 text-white/60'
          : positive
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
      }`}
    >
      {positive ? '+' : ''}${result.toFixed(0)}
    </span>
  )
}

export default function HistoryPage() {
  const [hands, setHands] = useState<StoredHand[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const uid = getUserId()
    if (!uid) return
    listHands(uid, 100)
      .then(setHands)
      .catch(err => setError(err.message ?? String(err)))
  }, [])

  return (
    <div className="min-h-screen bg-underground text-white px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-sm text-amber-300 hover:text-amber-200">← Lobby</Link>
            <h1 className="text-4xl font-bold mt-1 tracking-tight">Hand History</h1>
            <p className="text-white/50 text-sm mt-1">Your most recent hands across all tables.</p>
          </div>
          <Link
            href="/stats"
            className="text-sm font-bold px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition"
          >
            View Stats →
          </Link>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm rounded-lg px-4 py-3">
            Failed to load history: {error}
          </div>
        )}

        {!error && hands === null && (
          <div className="text-white/50 text-sm">Loading…</div>
        )}

        {hands !== null && hands.length === 0 && (
          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl px-8 py-16 text-center">
            <p className="text-white/70 text-lg mb-3">No hands yet.</p>
            <p className="text-white/40 text-sm mb-6">Play a hand and it&apos;ll show up here.</p>
            <Link
              href="/"
              className="inline-block text-sm font-bold px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition"
            >
              Pick a table
            </Link>
          </div>
        )}

        {hands !== null && hands.length > 0 && (
          <div className="space-y-2">
            {hands.map(h => (
              <div
                key={h.id}
                className="grid grid-cols-12 gap-4 items-center px-4 py-3 bg-zinc-900/60 border border-white/5 rounded-xl hover:border-white/15 transition"
              >
                <div className="col-span-2 text-xs text-white/50">
                  <PrettyDate iso={h.created_at} />
                  <div className="mt-0.5 text-white/40 capitalize">{h.difficulty}</div>
                </div>

                <div className="col-span-2 flex items-center gap-1.5">
                  {h.hole_cards.length === 2 ? (
                    h.hole_cards.map((c, i) => <Card key={i} card={c as CardType} size="sm" />)
                  ) : (
                    <span className="text-white/30 text-xs">no cards</span>
                  )}
                </div>

                <div className="col-span-4 flex items-center gap-1 flex-wrap">
                  {h.board_cards.length > 0 ? (
                    h.board_cards.map((c, i) => <Card key={i} card={c as CardType} size="sm" />)
                  ) : (
                    <span className="text-white/30 text-xs">folded preflop</span>
                  )}
                </div>

                <div className="col-span-1 text-xs text-white/60 font-mono uppercase tracking-wider">
                  {h.position ?? '—'}
                </div>

                <div className="col-span-1 text-xs">
                  {h.went_to_showdown ? (
                    <span className="text-amber-300/80">SD</span>
                  ) : h.won ? (
                    <span className="text-emerald-300/80">Won</span>
                  ) : (
                    <span className="text-white/30">Folded</span>
                  )}
                </div>

                <div className="col-span-2 flex justify-end">
                  <ResultBadge result={h.result} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
