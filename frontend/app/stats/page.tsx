'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Finding, Stats, fetchLeaks, fetchStats } from '../../lib/stats'
import { deleteHands } from '../../lib/history'
import ExpandableCard from '../../components/ExpandableCard'
import SignInGate from '../../components/SignInGate'

function fmtPct(v: number | null | undefined): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`
}
function fmtAf(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(2)
}

const SEVERITY_STYLE: Record<Finding['severity'], string> = {
  good: 'border-emerald-500/40 bg-emerald-500/5',
  watch: 'border-amber-500/40 bg-amber-500/5',
  leak: 'border-rose-500/50 bg-rose-500/5',
  insufficient: 'border-white/10 bg-white/2',
}

const SEVERITY_LABEL: Record<Finding['severity'], { label: string; color: string }> = {
  good:         { label: 'HEALTHY',     color: 'text-emerald-300' },
  watch:        { label: 'WATCH',       color: 'text-amber-300' },
  leak:         { label: 'LEAK',        color: 'text-rose-300' },
  insufficient: { label: 'LOW SAMPLE',  color: 'text-white/40' },
}

function MetricCard({ finding, expanded = false }: { finding: Finding; expanded?: boolean }) {
  const isPct = !finding.metric.startsWith('af_')
  const valueStr = isPct ? fmtPct(finding.value) : fmtAf(finding.value)
  const sev = SEVERITY_LABEL[finding.severity]
  return (
    <div
      className={`rounded-2xl border ${SEVERITY_STYLE[finding.severity]} ${
        expanded
          ? 'h-full w-full flex flex-col justify-center px-14 py-14'
          : 'px-5 py-4'
      }`}
    >
      <div className={`flex items-baseline justify-between ${expanded ? 'mb-6' : 'mb-1'}`}>
        <h3 className={`uppercase tracking-wider text-white/60 font-semibold ${expanded ? 'text-3xl' : 'text-sm'}`}>
          {finding.label}
        </h3>
        <span className={`font-bold tracking-wider ${sev.color} ${expanded ? 'text-lg' : 'text-[10px]'}`}>{sev.label}</span>
      </div>
      <div className="flex items-baseline gap-4">
        <span className={`font-extrabold text-white ${expanded ? 'text-[10rem] md:text-[14rem] leading-none' : 'text-3xl'}`}>
          {valueStr}
        </span>
        <span className={`text-white/40 ${expanded ? 'text-2xl' : 'text-xs'}`}>n={finding.sample_size}</span>
      </div>
      {finding.benchmark_low != null && finding.benchmark_high != null && finding.severity !== 'insufficient' && (
        <div className={`text-white/40 ${expanded ? 'text-xl mt-6' : 'text-xs mt-1'}`}>
          target {isPct
            ? `${(finding.benchmark_low * 100).toFixed(0)}–${(finding.benchmark_high * 100).toFixed(0)}%`
            : `${finding.benchmark_low}–${finding.benchmark_high}`}
        </div>
      )}
      <p className={`text-white/75 leading-relaxed ${expanded ? 'text-xl mt-8 max-w-3xl' : 'text-xs mt-2'}`}>
        {finding.explanation}
      </p>
    </div>
  )
}

function SummaryTile({
  label, value, tone, expanded = false,
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative' | 'neutral'
  expanded?: boolean
}) {
  const color = tone === 'positive'
    ? 'text-emerald-300'
    : tone === 'negative'
    ? 'text-rose-300'
    : 'text-white'
  return (
    <div
      className={`bg-zinc-900/60 border border-white/10 rounded-xl ${
        expanded
          ? 'h-full w-full flex flex-col justify-center px-14 py-14'
          : 'px-4 py-3'
      }`}
    >
      <div className={`uppercase tracking-wider text-white/50 ${expanded ? 'text-2xl mb-8' : 'text-xs'}`}>
        {label}
      </div>
      <div
        className={`font-extrabold ${color} ${
          expanded ? 'text-[10rem] md:text-[14rem] leading-none' : 'text-3xl mt-1'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function StatsPageInner() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [leaks, setLeaks] = useState<Finding[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    Promise.all([fetchStats(), fetchLeaks()])
      .then(([s, l]) => { setStats(s); setLeaks(l) })
      .catch(err => setError(err.message ?? String(err)))
  }, [])

  const hasData = stats !== null && stats.hands_played > 0

  const handleReset = async () => {
    setResetting(true)
    try {
      await deleteHands()
      const [s, l] = await Promise.all([fetchStats(), fetchLeaks()])
      setStats(s)
      setLeaks(l)
      setConfirmReset(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-underground text-white px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-sm text-amber-300 hover:text-amber-200">← Lobby</Link>
            <h1 className="text-4xl font-bold mt-1 tracking-tight">Your Stats</h1>
            <p className="text-white/50 text-sm mt-1">Aggregate metrics across your last 200 hands.</p>
          </div>
          <div className="flex items-center gap-2">
            {hasData && (
              confirmReset ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-300">Erase all stats?</span>
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
                  title="Erase all stats (same data backs hand history)"
                >
                  Reset stats
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
              href="/history"
              className="text-sm font-bold px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition"
            >
              View History →
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm rounded-lg px-4 py-3">
            Failed to load stats: {error}
          </div>
        )}

        {!error && stats === null && (
          <div className="text-white/50 text-sm">Loading…</div>
        )}

        {stats !== null && !hasData && (
          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl px-8 py-16 text-center">
            <p className="text-white/70 text-lg mb-3">No hands yet.</p>
            <p className="text-white/40 text-sm mb-6">Play a few hands and your stats will populate here.</p>
            <Link
              href="/"
              className="inline-block text-sm font-bold px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition"
            >
              Pick a table
            </Link>
          </div>
        )}

        {hasData && stats && (
          <>
            {/* Top-line summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <ExpandableCard ariaLabel="Hands played">
                {(e) => <SummaryTile label="Hands" value={String(stats.hands_played)} expanded={e} />}
              </ExpandableCard>
              <ExpandableCard ariaLabel="Hands won">
                {(e) => <SummaryTile label="Won" value={String(stats.hands_won)} expanded={e} />}
              </ExpandableCard>
              <ExpandableCard ariaLabel="Win rate">
                {(e) => (
                  <SummaryTile
                    label="Win rate"
                    value={
                      stats.hands_played > 0
                        ? `${((stats.hands_won / stats.hands_played) * 100).toFixed(0)}%`
                        : '—'
                    }
                    expanded={e}
                  />
                )}
              </ExpandableCard>
              <ExpandableCard ariaLabel="Net chips">
                {(e) => (
                  <SummaryTile
                    label="Net chips"
                    value={`${stats.net_chips > 0 ? '+' : ''}${stats.net_chips.toFixed(0)}`}
                    tone={stats.net_chips > 0 ? 'positive' : stats.net_chips < 0 ? 'negative' : 'neutral'}
                    expanded={e}
                  />
                )}
              </ExpandableCard>
            </div>

            {/* Leak findings = the metric grid */}
            {leaks !== null && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
                {leaks.map(f => (
                  <ExpandableCard key={f.metric} ariaLabel={`${f.label} detail`}>
                    {(e) => <MetricCard finding={f} expanded={e} />}
                  </ExpandableCard>
                ))}
              </div>
            )}

            {/* Per-position breakdown */}
            {stats.per_position.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-3 text-white/80">By Position</h2>
                <div className="bg-zinc-900/60 border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-950 text-white/50 uppercase text-xs tracking-wider">
                      <tr>
                        <th className="text-left px-4 py-2">Pos</th>
                        <th className="text-right px-4 py-2">Hands</th>
                        <th className="text-right px-4 py-2">VPIP</th>
                        <th className="text-right px-4 py-2">PFR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.per_position.map(p => (
                        <tr key={p.position} className="border-t border-white/5">
                          <td className="px-4 py-2 font-mono font-bold">{p.position}</td>
                          <td className="px-4 py-2 text-right">{p.hands}</td>
                          <td className="px-4 py-2 text-right">{fmtPct(p.vpip)}</td>
                          <td className="px-4 py-2 text-right">{fmtPct(p.pfr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function StatsPage() {
  return <SignInGate><StatsPageInner /></SignInGate>
}
