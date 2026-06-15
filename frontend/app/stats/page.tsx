'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Finding, Stats, fetchLeaks, fetchStats } from '../../lib/stats'
import { getUserId } from '../../lib/userId'

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

function MetricCard({ finding }: { finding: Finding }) {
  const isPct = !finding.metric.startsWith('af_')
  const valueStr = isPct ? fmtPct(finding.value) : fmtAf(finding.value)
  const sev = SEVERITY_LABEL[finding.severity]
  return (
    <div className={`rounded-2xl border px-5 py-4 ${SEVERITY_STYLE[finding.severity]}`}>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm uppercase tracking-wider text-white/60 font-semibold">
          {finding.label}
        </h3>
        <span className={`text-[10px] font-bold tracking-wider ${sev.color}`}>{sev.label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-white">{valueStr}</span>
        <span className="text-xs text-white/40">n={finding.sample_size}</span>
      </div>
      {finding.benchmark_low != null && finding.benchmark_high != null && finding.severity !== 'insufficient' && (
        <div className="text-xs text-white/40 mt-1">
          target {isPct
            ? `${(finding.benchmark_low * 100).toFixed(0)}–${(finding.benchmark_high * 100).toFixed(0)}%`
            : `${finding.benchmark_low}–${finding.benchmark_high}`}
        </div>
      )}
      <p className="text-xs text-white/70 mt-2 leading-relaxed">{finding.explanation}</p>
    </div>
  )
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [leaks, setLeaks] = useState<Finding[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const uid = getUserId()
    if (!uid) return
    Promise.all([fetchStats(uid), fetchLeaks(uid)])
      .then(([s, l]) => { setStats(s); setLeaks(l) })
      .catch(err => setError(err.message ?? String(err)))
  }, [])

  const hasData = stats !== null && stats.hands_played > 0

  return (
    <div className="min-h-screen bg-underground text-white px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-sm text-amber-300 hover:text-amber-200">← Lobby</Link>
            <h1 className="text-4xl font-bold mt-1 tracking-tight">Your Stats</h1>
            <p className="text-white/50 text-sm mt-1">Aggregate metrics across your last 200 hands.</p>
          </div>
          <Link
            href="/history"
            className="text-sm font-bold px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition"
          >
            View History →
          </Link>
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
              <div className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-white/50">Hands</div>
                <div className="text-3xl font-extrabold mt-1">{stats.hands_played}</div>
              </div>
              <div className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-white/50">Won</div>
                <div className="text-3xl font-extrabold mt-1">{stats.hands_won}</div>
              </div>
              <div className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-white/50">Win rate</div>
                <div className="text-3xl font-extrabold mt-1">
                  {stats.hands_played > 0
                    ? `${((stats.hands_won / stats.hands_played) * 100).toFixed(0)}%`
                    : '—'}
                </div>
              </div>
              <div className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-white/50">Net chips</div>
                <div
                  className={`text-3xl font-extrabold mt-1 ${
                    stats.net_chips > 0
                      ? 'text-emerald-300'
                      : stats.net_chips < 0
                      ? 'text-rose-300'
                      : 'text-white'
                  }`}
                >
                  {stats.net_chips > 0 ? '+' : ''}{stats.net_chips.toFixed(0)}
                </div>
              </div>
            </div>

            {/* Leak findings = the metric grid */}
            {leaks !== null && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
                {leaks.map(f => <MetricCard key={f.metric} finding={f} />)}
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
