'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StoredHand, deleteHands, listHands } from '../../lib/history'
import Card from '../../components/Card'
import SignInGate from '../../components/SignInGate'
import { Card as CardType } from '../../types/poker'

function PrettyTime({ iso }: { iso: string }) {
  const d = new Date(iso)
  const label = d.toLocaleString(undefined, {
    hour: 'numeric', minute: '2-digit',
  })
  return <span>{label}</span>
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function ResultBadge({ result }: { result: number }) {
  const positive = result > 0
  const zero = result === 0
  return (
    <span
      className={`px-3 py-1 rounded-md font-mono font-bold text-base ${
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

function HistoryPageInner() {
  const [hands, setHands] = useState<StoredHand[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    listHands(100)
      .then(setHands)
      .catch(err => setError(err.message ?? String(err)))
  }, [])

  const handleReset = async () => {
    setResetting(true)
    try {
      await deleteHands()
      setHands([])
      setConfirmReset(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-underground text-white px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-sm text-amber-300 hover:text-amber-200">← Lobby</Link>
            <h1 className="text-4xl font-bold mt-1 tracking-tight">Hand History</h1>
            <p className="text-white/50 text-sm mt-1">Your most recent hands across all tables.</p>
          </div>
          <div className="flex items-center gap-2">
            {hands !== null && hands.length > 0 && (
              confirmReset ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-300">Erase all hands?</span>
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="text-sm font-bold px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-black transition"
                  >
                    {resetting ? 'Erasing…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    disabled={resetting}
                    className="text-sm px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="text-sm font-bold px-4 py-2 rounded-lg bg-zinc-900 hover:bg-rose-950 border border-rose-500/30 text-rose-300 hover:text-rose-200 transition"
                  title="Erase all hand history"
                >
                  Reset history
                </button>
              )
            )}
            <Link
              href="/visualize"
              className="text-sm font-bold px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition"
            >
              Visualize →
            </Link>
            <Link
              href="/stats"
              className="text-sm font-bold px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition"
            >
              View Stats →
            </Link>
          </div>
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
          <div className="space-y-3">
            {hands.map((h, idx) => {
              const day = dayKey(h.created_at)
              const showDivider = idx === 0 || dayKey(hands[idx - 1].created_at) !== day
              return (
                <div key={h.id}>
                  {showDivider && (
                    <div className="flex items-center gap-3 pt-4 pb-2 select-none">
                      <div className="h-px bg-amber-400/30 flex-none w-10" />
                      <span className="text-xs uppercase tracking-[0.18em] text-amber-300/80 font-semibold whitespace-nowrap">
                        {day}
                      </span>
                      <div className="h-px bg-white/10 flex-1" />
                    </div>
                  )}
                  <div className="grid grid-cols-12 gap-5 items-center px-6 py-5 bg-zinc-900/60 border border-white/5 rounded-2xl hover:border-white/15 transition">
                    <div className="col-span-2 text-sm text-white/70">
                      <div className="font-semibold text-white/90">
                        <PrettyTime iso={h.created_at} />
                      </div>
                      <div className="mt-1 text-xs text-white/40 capitalize">{h.difficulty}</div>
                    </div>

                    <div className="col-span-2 flex items-center gap-2">
                      {h.hole_cards.length === 2 ? (
                        h.hole_cards.map((c, i) => <Card key={i} card={c as CardType} size="md" />)
                      ) : (
                        <span className="text-white/30 text-sm">no cards</span>
                      )}
                    </div>

                    <div className="col-span-4 flex items-center gap-1.5 flex-wrap">
                      {h.board_cards.length > 0 ? (
                        h.board_cards.map((c, i) => <Card key={i} card={c as CardType} size="md" />)
                      ) : (
                        <span className="text-white/30 text-sm italic">folded preflop</span>
                      )}
                    </div>

                    <div className="col-span-1 text-sm text-white/70 font-mono uppercase tracking-wider font-bold">
                      {h.position ?? '—'}
                    </div>

                    <div className="col-span-1 text-sm font-semibold">
                      {h.went_to_showdown ? (
                        <span className="text-amber-300">SD</span>
                      ) : h.won ? (
                        <span className="text-emerald-300">Won</span>
                      ) : (
                        <span className="text-white/40">Fold</span>
                      )}
                    </div>

                    <div className="col-span-2 flex justify-end">
                      <ResultBadge result={h.result} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function HistoryPage() {
  return <SignInGate><HistoryPageInner /></SignInGate>
}
