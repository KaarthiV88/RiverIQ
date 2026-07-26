'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { StoredHand, listHands } from '../../lib/history'
import ExpandableCard from '../../components/ExpandableCard'
import SignInGate from '../../components/SignInGate'

// Streets in the order money flows.
const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'] as const
type Street = (typeof STREETS)[number]

const STREET_LABEL: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
}

// Position display order — anything not listed falls to the end alphabetically.
const POSITION_ORDER = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN']

function fmtMoney(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}$${Math.abs(v).toFixed(0)}`
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return d.toISOString().slice(0, 10)
}

function shortDay(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived metrics — everything below feeds off the hand list, oldest-first.

interface Curve {
  oldest: StoredHand[]
  cumulative: number[]
  peak: { value: number; index: number }
  trough: { value: number; index: number }
  biggestWin: { value: number; hand: StoredHand | null }
  biggestLoss: { value: number; hand: StoredHand | null }
  net: number
}

function buildCurve(hands: StoredHand[]): Curve {
  const oldest = [...hands].reverse()
  let running = 0
  const cumulative: number[] = []
  let peak = { value: 0, index: -1 }
  let trough = { value: 0, index: -1 }
  let biggestWin = { value: 0, hand: null as StoredHand | null }
  let biggestLoss = { value: 0, hand: null as StoredHand | null }
  oldest.forEach((h, i) => {
    running += h.result
    cumulative.push(running)
    if (running > peak.value) peak = { value: running, index: i }
    if (running < trough.value) trough = { value: running, index: i }
    if (h.result > biggestWin.value) biggestWin = { value: h.result, hand: h }
    if (h.result < biggestLoss.value) biggestLoss = { value: h.result, hand: h }
  })
  return {
    oldest,
    cumulative,
    peak,
    trough,
    biggestWin,
    biggestLoss,
    net: running,
  }
}

interface PositionRow {
  position: string
  hands: number
  won: number
  net: number
}

function winsByPosition(hands: StoredHand[]): PositionRow[] {
  const map = new Map<string, PositionRow>()
  hands.forEach(h => {
    const pos = h.position ?? '—'
    const r = map.get(pos) ?? { position: pos, hands: 0, won: 0, net: 0 }
    r.hands++
    if (h.won) r.won++
    r.net += h.result
    map.set(pos, r)
  })
  return Array.from(map.values()).sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a.position)
    const bi = POSITION_ORDER.indexOf(b.position)
    if (ai === -1 && bi === -1) return a.position.localeCompare(b.position)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

interface StreetRow {
  street: Street
  hands: number
  net: number
}

function resultByStreet(hands: StoredHand[]): StreetRow[] {
  const rows: StreetRow[] = STREETS.map(s => ({ street: s, hands: 0, net: 0 }))
  hands.forEach(h => {
    const idx = STREETS.indexOf(h.street_reached as Street)
    if (idx < 0) return
    rows[idx].hands++
    rows[idx].net += h.result
  })
  return rows
}

interface DayRow {
  day: string       // YYYY-MM-DD
  label: string     // "Jun 23"
  hands: number
  net: number
}

function handsByDay(hands: StoredHand[]): DayRow[] {
  const map = new Map<string, DayRow>()
  hands.forEach(h => {
    const k = dayKey(h.created_at)
    const r = map.get(k) ?? { day: k, label: shortDay(h.created_at), hands: 0, net: 0 }
    r.hands++
    r.net += h.result
    map.set(k, r)
  })
  return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day))
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero: bankroll curve.

function BankrollCurve({ curve }: { curve: Curve }) {
  const W = 1100
  const H = 360
  const PAD = { l: 64, r: 36, t: 28, b: 36 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b

  const series = [0, ...curve.cumulative]
  const n = series.length
  const yMaxRaw = Math.max(0, ...series)
  const yMinRaw = Math.min(0, ...series)
  const ySpan = yMaxRaw - yMinRaw || 1
  // pad y a touch on both ends so the curve doesn't kiss the frame
  const yMax = yMaxRaw + ySpan * 0.08
  const yMin = yMinRaw - ySpan * 0.08

  const xScale = (i: number) => PAD.l + (i / Math.max(1, n - 1)) * innerW
  const yScale = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * innerH
  const zeroY = yScale(0)

  // Build positive and negative areas separately so each can take its tint.
  const linePath = series.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ')
  const posArea = `${linePath} L ${xScale(n - 1)} ${zeroY} L ${xScale(0)} ${zeroY} Z`

  // y-axis tick lines (4 lines including zero)
  const yTicks: number[] = []
  const tickStep = niceTickStep(yMin, yMax, 4)
  for (let t = Math.ceil(yMin / tickStep) * tickStep; t <= yMax; t += tickStep) {
    yTicks.push(t)
  }

  const lastX = xScale(n - 1)
  const lastY = yScale(series[n - 1])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto block"
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id="curve-clip-positive">
          <rect x={0} y={0} width={W} height={zeroY} />
        </clipPath>
        <clipPath id="curve-clip-negative">
          <rect x={0} y={zeroY} width={W} height={H - zeroY} />
        </clipPath>
      </defs>

      {/* Felt-green grid lines */}
      {yTicks.map(t => (
        <line
          key={t}
          x1={PAD.l}
          x2={W - PAD.r}
          y1={yScale(t)}
          y2={yScale(t)}
          className={t === 0 ? 'ledger-zero-line' : 'ledger-grid-line'}
        />
      ))}

      {/* Y axis labels */}
      {yTicks.map(t => (
        <text
          key={`yl-${t}`}
          x={PAD.l - 10}
          y={yScale(t) + 3.5}
          textAnchor="end"
          className="ledger-axis"
        >
          {fmtMoney(t)}
        </text>
      ))}

      {/* Tinted area: positive above zero, negative below */}
      <g clipPath="url(#curve-clip-positive)">
        <path d={posArea} className="ledger-area-pos" />
      </g>
      <g clipPath="url(#curve-clip-negative)">
        <path d={posArea} className="ledger-area-neg" />
      </g>

      {/* The curve itself */}
      <path d={linePath} className="ledger-curve" />

      {/* Hand-count axis cues at start / mid / end */}
      <text x={PAD.l} y={H - 10} className="ledger-axis">hand 1</text>
      <text x={W - PAD.r} y={H - 10} textAnchor="end" className="ledger-axis">
        hand {curve.oldest.length}
      </text>

      {/* Live "you-are-here" marker — candlelit endpoint. */}
      <circle cx={lastX} cy={lastY} r={9} className="ledger-marker-halo" />
      <circle cx={lastX} cy={lastY} r={4.5} className="ledger-marker" />
    </svg>
  )
}

function niceTickStep(min: number, max: number, target: number): number {
  const range = max - min
  if (range <= 0) return 1
  const raw = range / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  let step
  if (norm < 1.5) step = 1
  else if (norm < 3) step = 2
  else if (norm < 7) step = 5
  else step = 10
  return step * mag
}

// ─────────────────────────────────────────────────────────────────────────────
// Three supporting widgets.

function WinRateByPosition({ rows, expanded = false }: { rows: PositionRow[]; expanded?: boolean }) {
  if (rows.length === 0) return <EmptyChart label="No hands yet" />
  return (
    <div className={expanded ? 'space-y-5' : 'space-y-3'}>
      {rows.map(r => {
        const rate = r.hands > 0 ? r.won / r.hands : 0
        return (
          <div key={r.position} className={`flex items-center ${expanded ? 'gap-5' : 'gap-3'}`}>
            <div
              className={`font-mono font-bold tracking-wider text-[color:var(--ink)] ${
                expanded ? 'w-24 text-2xl' : 'w-12 text-xs'
              }`}
            >
              {r.position}
            </div>
            <div
              className={`flex-1 bg-[rgba(13,12,10,0.10)] border border-[color:var(--ink)]/10 rounded relative overflow-hidden ${
                expanded ? 'h-10' : 'h-6'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-[color:var(--moss)]/85 transition-[width] duration-500"
                style={{ width: `${rate * 100}%` }}
              />
            </div>
            <div
              className={`text-right font-mono font-bold text-[color:var(--ink)] ${
                expanded ? 'w-24 text-2xl' : 'w-12 text-xs'
              }`}
            >
              {(rate * 100).toFixed(0)}%
            </div>
            <div
              className={`text-right font-mono text-[color:var(--ink)]/60 ${
                expanded ? 'w-36 text-lg' : 'w-20 text-xs'
              }`}
            >
              {r.won} of {r.hands}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResultByStreet({ rows, expanded = false }: { rows: StreetRow[]; expanded?: boolean }) {
  if (rows.every(r => r.hands === 0)) return <EmptyChart label="No hands yet" />
  const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.net)))
  return (
    <div className={expanded ? 'space-y-5' : 'space-y-3'}>
      {rows.map(r => {
        if (r.hands === 0) {
          return (
            <div key={r.street} className={`flex items-center opacity-50 ${expanded ? 'gap-5' : 'gap-3'}`}>
              <div
                className={`font-mono tracking-wider uppercase text-[color:var(--ink)]/60 font-bold ${
                  expanded ? 'w-28 text-xl' : 'w-16 text-xs'
                }`}
              >
                {STREET_LABEL[r.street]}
              </div>
              <div className={`flex-1 italic text-[color:var(--ink)]/40 ${expanded ? 'text-lg' : 'text-xs'}`}>
                never reached
              </div>
            </div>
          )
        }
        const widthPct = (Math.abs(r.net) / maxAbs) * 100
        const positive = r.net >= 0
        return (
          <div key={r.street} className={`flex items-center ${expanded ? 'gap-5' : 'gap-3'}`}>
            <div
              className={`font-mono tracking-wider uppercase text-[color:var(--ink)]/80 font-bold ${
                expanded ? 'w-28 text-xl' : 'w-16 text-xs'
              }`}
            >
              {STREET_LABEL[r.street]}
            </div>
            <div className={`flex-1 relative ${expanded ? 'h-10' : 'h-6'}`}>
              {/* spine */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[color:var(--ink)]/30" />
              <div
                className={`absolute top-1 bottom-1 ${positive ? 'left-1/2' : 'right-1/2'} ${
                  positive ? 'bg-[color:var(--moss)]/85' : 'bg-[color:var(--wine)]/85'
                } rounded-sm`}
                style={{ width: `${widthPct / 2}%` }}
              />
            </div>
            <div
              className={`text-right font-mono font-bold ${
                positive ? 'text-[color:var(--moss)]' : 'text-[color:var(--wine)]'
              } ${expanded ? 'w-40 text-xl' : 'w-24 text-xs'}`}
            >
              {fmtMoney(r.net)}
              <span className="text-[color:var(--ink)]/55 font-normal ml-2">· {r.hands}h</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HandsPerDay({ rows, expanded = false }: { rows: DayRow[]; expanded?: boolean }) {
  if (rows.length === 0) return <EmptyChart label="No hands yet" />
  const max = Math.max(...rows.map(r => r.hands))
  return (
    <div className={`flex items-end ${expanded ? 'gap-4 h-[60vh] max-h-[600px]' : 'gap-2 h-32'}`}>
      {rows.map(r => {
        const heightPct = (r.hands / max) * 100
        const positive = r.net >= 0
        return (
          <div key={r.day} className={`flex-1 flex flex-col items-center group ${expanded ? 'gap-3' : 'gap-1'}`}>
            <div
              className={`font-mono font-bold text-[color:var(--ink)]/70 ${
                expanded ? 'text-xl' : 'text-[10px]'
              }`}
            >
              {r.hands}
            </div>
            <div
              className={`w-full rounded-t-sm ${
                positive ? 'bg-[color:var(--moss)]/85' : 'bg-[color:var(--wine)]/85'
              } group-hover:opacity-100 opacity-90 transition`}
              style={{ height: `${heightPct}%`, minHeight: '4px' }}
              title={`${r.label} · ${r.hands} hands · ${fmtMoney(r.net)}`}
            />
            <div
              className={`font-mono text-[color:var(--ink)]/65 tracking-wider ${
                expanded ? 'text-base' : 'text-[10px]'
              }`}
            >
              {r.label}
            </div>
            {expanded && (
              <div
                className={`font-mono font-bold ${
                  positive ? 'text-[color:var(--moss)]' : 'text-[color:var(--wine)]'
                } text-sm`}
              >
                {fmtMoney(r.net)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-32 flex items-center justify-center text-[color:var(--ink)]/40 text-sm italic">
      {label}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI tile.

function KpiTile({ eyebrow, value, sub, tone, expanded = false }: {
  eyebrow: string
  value: string
  sub?: string
  tone?: 'positive' | 'negative' | 'neutral'
  expanded?: boolean
}) {
  const valueColor = tone === 'positive'
    ? 'text-[color:var(--moss)]'
    : tone === 'negative'
    ? 'text-[color:var(--wine)]'
    : 'text-[color:var(--ink)]'
  return (
    <div
      className={`ledger-card ${
        expanded
          ? 'h-full w-full flex flex-col justify-center px-16 py-20'
          : 'px-5 py-4'
      }`}
    >
      <div className={`ledger-eyebrow ${expanded ? 'mb-6 text-xl' : 'mb-2'}`}>{eyebrow}</div>
      <div
        className={`ledger-figure ${valueColor} ${
          expanded ? 'text-[10rem] md:text-[14rem] leading-none' : 'text-3xl md:text-4xl'
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className={`ledger-sub ${expanded ? 'mt-8 text-xl' : 'mt-2'}`}>
          {sub}
        </div>
      )}
    </div>
  )
}

// Reusable card wrapper for chart panels — keeps brass-corner vocabulary.
function LedgerPanel({ title, eyebrow, children, className = '', expanded = false }: {
  title: string
  eyebrow?: string
  children: React.ReactNode
  className?: string
  expanded?: boolean
}) {
  return (
    <div
      className={`ledger-card relative ${
        expanded
          ? 'h-full w-full flex flex-col px-10 py-10 md:px-14 md:py-12'
          : 'px-5 py-5'
      } ${className}`}
    >
      <span className="hud-corner hud-corner-tl" style={{ top: -6, left: -6 }} />
      <span className="hud-corner hud-corner-tr" style={{ top: -6, right: -6 }} />
      <span className="hud-corner hud-corner-bl" style={{ bottom: -6, left: -6 }} />
      <span className="hud-corner hud-corner-br" style={{ bottom: -6, right: -6 }} />
      {eyebrow && <div className={`ledger-eyebrow ${expanded ? 'mb-3 text-xl' : 'mb-1'}`}>{eyebrow}</div>}
      <h2 className={`ledger-title ${expanded ? 'text-5xl md:text-6xl mb-6' : 'text-2xl mb-4'}`}>{title}</h2>
      <div className={`ledger-divider ${expanded ? 'mb-8' : 'mb-4'}`} />
      <div className={expanded ? 'flex-1 flex flex-col justify-center min-h-0' : ''}>
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function VisualizePageInner() {
  const [hands, setHands] = useState<StoredHand[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listHands(200)
      .then(setHands)
      .catch(err => setError(err.message ?? String(err)))
  }, [])

  const curve = useMemo(() => hands && hands.length ? buildCurve(hands) : null, [hands])
  const positionRows = useMemo(() => hands ? winsByPosition(hands) : [], [hands])
  const streetRows = useMemo(() => hands ? resultByStreet(hands) : [], [hands])
  const dayRows = useMemo(() => hands ? handsByDay(hands) : [], [hands])

  const hasData = hands !== null && hands.length > 0

  return (
    <div className="min-h-screen bg-underground text-white px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap items-start justify-between gap-4 mb-10">
          <div>
            <Link href="/" className="back-link">← Lobby</Link>
            <p className="eyebrow mt-3 mb-2">The Session · last 200 hands</p>
            <h1 className="font-display italic text-5xl md:text-6xl tracking-tight text-white">
              The Session
            </h1>
            <p className="text-white/55 text-sm mt-2 max-w-md leading-relaxed">
              Every hand you&apos;ve played, traced as a single ledger curve. The candle marks where you stand right now.
            </p>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/history" className="btn-ghost">History</Link>
            <Link href="/stats" className="btn-ghost">Stats</Link>
          </nav>
        </header>

        {error && (
          <div className="alert-error mb-6">
            Failed to load: {error}
          </div>
        )}

        {!error && hands === null && (
          <div className="text-white/50 text-sm">Drawing the ledger…</div>
        )}

        {hands !== null && !hasData && (
          <div className="ledger-card px-8 py-16 text-center">
            <p className="ledger-title text-2xl mb-3">The ledger is blank.</p>
            <p className="text-[color:var(--ink)]/60 text-sm mb-6 max-w-sm mx-auto">
              Play your first hand and the curve starts here.
            </p>
            <Link href="/" className="btn-brass">Pick a table</Link>
          </div>
        )}

        {hasData && curve && (
          <div className="space-y-6">
            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ExpandableCard ariaLabel="Net chips">
                {(e) => (
                  <KpiTile
                    eyebrow="Net"
                    value={fmtMoney(curve.net)}
                    sub={`${hands!.length} hands`}
                    tone={curve.net > 0 ? 'positive' : curve.net < 0 ? 'negative' : 'neutral'}
                    expanded={e}
                  />
                )}
              </ExpandableCard>
              <ExpandableCard ariaLabel="Peak bankroll">
                {(e) => (
                  <KpiTile
                    eyebrow="Peak"
                    value={fmtMoney(curve.peak.value)}
                    sub={curve.peak.index >= 0 ? `at hand ${curve.peak.index + 1}` : '—'}
                    tone="positive"
                    expanded={e}
                  />
                )}
              </ExpandableCard>
              <ExpandableCard ariaLabel="Trough bankroll">
                {(e) => (
                  <KpiTile
                    eyebrow="Trough"
                    value={fmtMoney(curve.trough.value)}
                    sub={curve.trough.index >= 0 ? `at hand ${curve.trough.index + 1}` : '—'}
                    tone="negative"
                    expanded={e}
                  />
                )}
              </ExpandableCard>
              <ExpandableCard ariaLabel="Biggest pot">
                {(e) => (
                  <KpiTile
                    eyebrow="Biggest pot"
                    value={fmtMoney(curve.biggestWin.value)}
                    sub={curve.biggestWin.hand ? `vs ${curve.biggestWin.hand.opponents.length} opps` : '—'}
                    tone="positive"
                    expanded={e}
                  />
                )}
              </ExpandableCard>
            </div>

            {/* Hero bankroll curve */}
            <ExpandableCard ariaLabel="Bankroll curve">
              {(e) => (
                <LedgerPanel
                  eyebrow="Bankroll · cumulative net chips"
                  title="The curve, hand by hand."
                  expanded={e}
                >
                  <BankrollCurve curve={curve} />
                </LedgerPanel>
              )}
            </ExpandableCard>

            {/* Bottom row — three smaller widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ExpandableCard ariaLabel="Win rate by position">
                {(e) => (
                  <LedgerPanel eyebrow="Position" title="Where you win." expanded={e}>
                    <WinRateByPosition rows={positionRows} expanded={e} />
                  </LedgerPanel>
                )}
              </ExpandableCard>

              <ExpandableCard ariaLabel="Result by street">
                {(e) => (
                  <LedgerPanel eyebrow="Street" title="Where money moves." expanded={e}>
                    <ResultByStreet rows={streetRows} expanded={e} />
                  </LedgerPanel>
                )}
              </ExpandableCard>

              <ExpandableCard ariaLabel="Hands per day">
                {(e) => (
                  <LedgerPanel eyebrow="Daily" title="When you played." expanded={e}>
                    <HandsPerDay rows={dayRows} expanded={e} />
                  </LedgerPanel>
                )}
              </ExpandableCard>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VisualizePage() {
  return <SignInGate><VisualizePageInner /></SignInGate>
}
