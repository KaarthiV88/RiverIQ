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
  const tone = zero ? 'zero' : positive ? 'pos' : 'neg'
  return (
    <span className={`result-plate ${tone}`}>
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
        <header className="flex flex-wrap items-start justify-between gap-4 mb-10">
          <div>
            <Link href="/" className="back-link">← Lobby</Link>
            <p className="eyebrow mt-3 mb-2">Dealer&apos;s Log · last 100 hands</p>
            <h1 className="font-display italic text-5xl md:text-6xl tracking-tight text-white">Hand History</h1>
            <p className="text-white/55 text-sm mt-2">Every hand you&apos;ve played, most recent first.</p>
          </div>
          <div className="flex items-center gap-2">
            {hands !== null && hands.length > 0 && (
              confirmReset ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[color:var(--wine)] font-semibold">Erase all hands?</span>
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="btn-danger-solid"
                  >
                    {resetting ? 'Erasing…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    disabled={resetting}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="btn-danger"
                  title="Erase all hand history"
                >
                  Reset history
                </button>
              )
            )}
            <Link href="/visualize" className="btn-ghost">Visualize →</Link>
            <Link href="/stats" className="btn-ghost">Stats →</Link>
          </div>
        </header>

        {error && (
          <div className="alert-error">
            Failed to load history: {error}
          </div>
        )}

        {!error && hands === null && (
          <div className="text-white/50 text-sm">Loading…</div>
        )}

        {hands !== null && hands.length === 0 && (
          <div className="ledger-card px-8 py-16 text-center">
            <p className="ledger-title text-2xl mb-3">No hands yet.</p>
            <p className="text-[color:var(--ink)]/60 text-sm mb-6">Play a hand and it&apos;ll show up here.</p>
            <Link href="/" className="btn-brass">Pick a table</Link>
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
                    <div className="flex items-center gap-4 pt-5 pb-2 select-none">
                      <span className="eyebrow whitespace-nowrap">{day}</span>
                      <span className="brass-rule flex-1" />
                    </div>
                  )}
                  <div className="log-row grid grid-cols-12 gap-5 items-center px-6 py-5">
                    <div className="col-span-2 text-sm">
                      <div className="font-semibold text-[color:var(--parchment)]">
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
                        <span className="text-[color:var(--brass)]">SD</span>
                      ) : h.won ? (
                        <span className="text-[#94ab72]">Won</span>
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
