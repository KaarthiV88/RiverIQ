'use client'

import { useEffect, useRef, useState } from 'react'
import { GameState, Player } from '../types/poker'
import { fetchHeroEquity } from '../lib/equity'

interface TableHUDProps {
  state: GameState
  /** True while the Coach panel is visible. The HUD fades in/out with this. */
  active: boolean
}

// Short personality blurbs the dossier can show. Keeps the LLM-flavored
// vocabulary consistent between the HUD and what the coach actually says.
const PERSONALITY_LABELS: Record<NonNullable<Player['personality']>, { tag: string; blurb: string }> = {
  'nit':              { tag: 'NIT',     blurb: 'Premiums only; folds easily to aggression.' },
  'tag':              { tag: 'TAG',     blurb: 'Tight-aggressive reg; value-heavy ranges, c-bets often.' },
  'lag':              { tag: 'LAG',     blurb: 'Loose-aggressive; wide ranges, 3-bets light, hard to read.' },
  'calling-station':  { tag: 'STATION', blurb: 'Calls too much, raises rarely. Value-bet thin; don\'t bluff.' },
  'maniac':           { tag: 'MANIAC',  blurb: 'Bombs every street, overbets, capable of huge bluffs.' },
  'home-game':        { tag: 'HOME',    blurb: 'Casual recreational; loose calls, random folds.' },
  'pro':              { tag: 'PRO',     blurb: 'Balanced reg with mild exploits; thinks about your range.' },
  'gto-wizard':       { tag: 'GTO',     blurb: 'Near-GTO; balanced mixed strategies, very hard to exploit.' },
}

function shortPosition(pos: string): string {
  if (pos === 'UTG+1') return 'U1'
  if (pos === 'UTG+2') return 'U2'
  return pos
}

function lastActionFor(state: GameState, playerId: string): string {
  for (let i = state.handHistory.length - 1; i >= 0; i--) {
    const a = state.handHistory[i]
    if (a.playerId === playerId) {
      if (a.action === 'raise' || a.action === 'bet' || a.action === 'call') {
        return `${a.action} $${a.amount.toLocaleString()}`
      }
      return a.action
    }
  }
  return '—'
}

function handShorthand(hole: string[]): string {
  if (hole.length !== 2) return '—'
  const [a, b] = hole
  const ra = a[0]; const rb = b[0]
  const sa = a[1]; const sb = b[1]
  if (ra === rb) return `${ra}${rb}`
  const ORDER = '23456789TJQKA'
  const hi = ORDER.indexOf(ra) > ORDER.indexOf(rb) ? ra : rb
  const lo = hi === ra ? rb : ra
  return `${hi}${lo}${sa === sb ? 's' : 'o'}`
}

// Hero hand callout — the one piece of always-on info that's truly NEW
// data (computed equity), not already on the felt.
function HeroReticle({ hole, equity }: { hole: string[]; equity: number | null }) {
  return (
    <div className="hud-reticle" style={{ left: '50%', top: '80%', transform: 'translate(-50%, -50%)' }}>
      <div className="hud-callout">
        <div className="hud-label">Your hand</div>
        <div className="hud-data">{handShorthand(hole)}</div>
        <div className="hud-sub">
          {equity == null ? 'equity computing…' : `equity ${(equity * 100).toFixed(0)}%`}
        </div>
      </div>
      <span className="hud-corner hud-corner-tl" />
      <span className="hud-corner hud-corner-tr" />
      <span className="hud-corner hud-corner-bl" />
      <span className="hud-corner hud-corner-br" />
    </div>
  )
}

interface PinProps {
  x: number       // % across the table region
  y: number       // % down the table region
  positionLabel: string
  active: boolean
  onClick: () => void
}

function OpponentPin({ x, y, positionLabel, active, onClick }: PinProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hud-pin ${active ? 'active' : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      aria-label={`Open dossier for ${positionLabel}`}
    >
      {positionLabel}
    </button>
  )
}

interface DossierProps {
  player: Player
  x: number
  y: number
  /** Which quadrant of the table the pin sits in — controls which direction
   *  the dossier opens so it stays on screen. */
  openDir: 'tl' | 'tr' | 'bl' | 'br'
  state: GameState
  onClose: () => void
}

function Dossier({ player, x, y, openDir, state, onClose }: DossierProps) {
  // Anchor the dossier to the opposite corner of the pin so it opens inward
  // toward the table center. ~24px gap from the pin.
  const offset = 24
  const style: React.CSSProperties = {
    [openDir.includes('l') ? 'left' : 'right']: 'auto',
  }
  // Simpler: derive top/left from pin coords + direction.
  if (openDir === 'tl') { style.left = `${x}%`; style.top = `${y}%`; style.transform = `translate(${offset / 16}rem, ${offset / 16}rem)` }
  if (openDir === 'tr') { style.right = `${100 - x}%`; style.top = `${y}%`; style.transform = `translate(-${offset / 16}rem, ${offset / 16}rem)` }
  if (openDir === 'bl') { style.left = `${x}%`; style.bottom = `${100 - y}%`; style.transform = `translate(${offset / 16}rem, -${offset / 16}rem)` }
  if (openDir === 'br') { style.right = `${100 - x}%`; style.bottom = `${100 - y}%`; style.transform = `translate(-${offset / 16}rem, -${offset / 16}rem)` }

  const personality = player.personality
  const profile = personality ? PERSONALITY_LABELS[personality] : null
  const stackBB = state.players[0] && (player.chips / 20).toFixed(0)
  const last = lastActionFor(state, player.id)

  return (
    <div className="hud-dossier" style={style} role="dialog" aria-label={`${player.name} dossier`}>
      <button className="hud-dossier-close" onClick={onClose} aria-label="Close dossier">×</button>
      <div className="hud-dossier-name">{player.name}</div>
      <div className="hud-dossier-rule" />
      <div className="hud-dossier-row">
        <span className="hud-dossier-label">Position</span>
        <span className="hud-dossier-value">{player.position}</span>
      </div>
      <div className="hud-dossier-row">
        <span className="hud-dossier-label">Stack</span>
        <span className="hud-dossier-value">${player.chips.toLocaleString()} · {stackBB} bb</span>
      </div>
      <div className="hud-dossier-row">
        <span className="hud-dossier-label">Last action</span>
        <span className="hud-dossier-value">{last}</span>
      </div>
      {profile && (
        <>
          <div className="hud-dossier-row">
            <span className="hud-dossier-label">Style</span>
            <span className="hud-dossier-value">{profile.tag}</span>
          </div>
          <div className="hud-dossier-blurb">{profile.blurb}</div>
        </>
      )}
    </div>
  )
}

export default function TableHUD({ state, active }: TableHUDProps) {
  const n = state.players.length
  const human = state.players.find(p => p.isHuman)
  const [equity, setEquity] = useState<number | null>(null)
  const [sweepKey, setSweepKey] = useState(0)
  const [openPlayerId, setOpenPlayerId] = useState<string | null>(null)
  const lastFetchKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (active) setSweepKey(k => k + 1)
    else setOpenPlayerId(null)   // close any open dossier when HUD hides
  }, [active])

  useEffect(() => {
    if (!active || !human || human.holeCards.length !== 2) return
    const opps = state.players.filter(p => !p.isHuman && p.status === 'active').length
    if (opps < 1) { setEquity(1); return }
    const key = `${human.holeCards.join('')}|${state.communityCards.join('')}|${opps}`
    if (key === lastFetchKeyRef.current) return
    lastFetchKeyRef.current = key

    const controller = new AbortController()
    setEquity(null)
    fetchHeroEquity(human.holeCards, state.communityCards, opps, controller.signal)
      .then(setEquity)
      .catch(() => setEquity(null))
    return () => controller.abort()
  }, [active, human, state.players, state.communityCards])

  if (!human) return null

  // Same elliptical orbit math as PokerTable seats.
  const SEAT_RX = 48
  const SEAT_RY = 44

  const opponents = state.players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.isHuman && p.status !== 'busted' && p.status !== 'sitting-out')

  return (
    <div
      className={`hud-layer absolute inset-0 ${active ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden={!active}
    >
      <div className="hud-dim" />
      <div key={sweepKey} className="hud-sweep" />

      <HeroReticle hole={human.holeCards} equity={equity} />

      {opponents.map(({ p, i }) => {
        const angle = Math.PI / 2 + (i / n) * 2 * Math.PI
        const x = 50 + SEAT_RX * Math.cos(angle)
        const y = 50 + SEAT_RY * Math.sin(angle)
        // Quadrant the pin sits in → dossier opens inward (away from edge).
        const openDir: DossierProps['openDir'] =
          (x >= 50 ? (y >= 50 ? 'tl' : 'bl') : (y >= 50 ? 'tr' : 'br'))
        return (
          <div key={p.id}>
            <OpponentPin
              x={x}
              y={y}
              positionLabel={shortPosition(p.position)}
              active={openPlayerId === p.id}
              onClick={() => setOpenPlayerId(curr => (curr === p.id ? null : p.id))}
            />
            {openPlayerId === p.id && (
              <Dossier
                player={p}
                x={x}
                y={y}
                openDir={openDir}
                state={state}
                onClose={() => setOpenPlayerId(null)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
