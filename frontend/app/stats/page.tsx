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
  good: 'sev-good',
  watch: 'sev-watch',
  leak: 'sev-leak',
  insufficient: 'sev-low',
}

const SEVERITY_LABEL: Record<Finding['severity'], { label: string; color: string }> = {
  good:         { label: 'HEALTHY',     color: 'sev-label-good' },
  watch:        { label: 'WATCH',       color: 'sev-label-watch' },
  leak:         { label: 'LEAK',        color: 'sev-label-leak' },
  insufficient: { label: 'LOW SAMPLE',  color: 'sev-label-low' },
}

function MetricCard({ finding, expanded = false }: { finding: Finding; expanded?: boolean }) {
  const isPct = !finding.metric.startsWith('af_')
  const valueStr = isPct ? fmtPct(finding.value) : fmtAf(finding.value)
  const sev = SEVERITY_LABEL[finding.severity]
  return (
    <div
      className={`ledger-card ${SEVERITY_STYLE[finding.severity]} ${
        expanded
          ? 'h-full w-full flex flex-col justify-center px-14 py-14'
          : 'px-5 py-4'
      }`}
    >
      <div className={`flex items-baseline justify-between gap-3 ${expanded ? 'mb-6' : 'mb-1'}`}>
        <h3 className={`ledger-eyebrow ${expanded ? 'text-2xl' : ''}`}>
          {finding.label}
        </h3>
        <span className={`font-mono font-bold tracking-[0.14em] ${sev.color} ${expanded ? 'text-lg' : 'text-[10px]'}`}>{sev.label}</span>
      </div>
      <div className="flex items-baseline gap-4">
        <span className={`ledger-figure ${expanded ? 'text-[10rem] md:text-[14rem] leading-none' : 'text-4xl'}`}>
          {valueStr}
        </span>
        <span className={`font-mono text-[color:var(--ink)]/45 ${expanded ? 'text-2xl' : 'text-xs'}`}>n={finding.sample_size}</span>
      </div>
      {finding.benchmark_low != null && finding.benchmark_high != null && finding.severity !== 'insufficient' && (
        <div className={`ledger-sub ${expanded ? 'text-xl mt-6' : 'mt-1.5'}`}>
          target {isPct
            ? `${(finding.benchmark_low * 100).toFixed(0)}–${(finding.benchmark_high * 100).toFixed(0)}%`
            : `${finding.benchmark_low}–${finding.benchmark_high}`}
        </div>
      )}
      <p className={`text-[color:var(--ink)]/72 leading-relaxed ${expanded ? 'text-xl mt-8 max-w-3xl' : 'text-xs mt-2'}`}>
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
  const toneColor = tone === 'positive'
    ? 'var(--moss)'
    : tone === 'negative'
    ? 'var(--wine)'
    : 'var(--ink)'
  return (
    <div
      className={`ledger-card ${
        expanded
          ? 'h-full w-full flex flex-col justify-center px-14 py-14'
          : 'px-5 py-4'
      }`}
    >
      <div className={`ledger-eyebrow ${expanded ? 'text-2xl mb-8' : 'mb-2'}`}>
        {label}
      </div>
      <div
        className={`ledger-figure ${
          expanded ? 'text-[10rem] md:text-[14rem] leading-none' : 'text-4xl'
        }`}
        style={{ color: toneColor }}
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
        <header className="flex flex-wrap items-start justify-between gap-4 mb-10">
          <div>
            <Link href="/" className="back-link">← Lobby</Link>
            <p className="eyebrow mt-3 mb-2">Leak Report · last 200 hands</p>
            <h1 className="font-display italic text-5xl md:text-6xl tracking-tight text-white">Your Stats</h1>
            <p className="text-white/55 text-sm mt-2">Where your game holds up, and where it bleeds.</p>
          </div>
          <div className="flex items-center gap-2">
            {hasData && (
              confirmReset ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[color:var(--wine)] font-semibold">Erase all stats?</span>
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
                  title="Erase all stats (same data backs hand history)"
                >
                  Reset stats
                </button>
              )
            )}
            <Link href="/visualize" className="btn-ghost">Visualize →</Link>
            <Link href="/history" className="btn-ghost">History →</Link>
          </div>
        </header>

        {error && (
          <div className="alert-error">
            Failed to load stats: {error}
          </div>
        )}

        {!error && stats === null && (
          <div className="text-white/50 text-sm">Loading…</div>
        )}

        {stats !== null && !hasData && (
          <div className="ledger-card px-8 py-16 text-center">
            <p className="ledger-title text-2xl mb-3">No hands yet.</p>
            <p className="text-[color:var(--ink)]/60 text-sm mb-6">Play a few hands and your stats will populate here.</p>
            <Link href="/" className="btn-brass">Pick a table</Link>
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
                <p className="eyebrow mb-3">By Position</p>
                <div className="ledger-card overflow-hidden px-1 py-1">
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>Hands</th>
                        <th>VPIP</th>
                        <th>PFR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.per_position.map(p => (
                        <tr key={p.position}>
                          <td>{p.position}</td>
                          <td>{p.hands}</td>
                          <td>{fmtPct(p.vpip)}</td>
                          <td>{fmtPct(p.pfr)}</td>
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
