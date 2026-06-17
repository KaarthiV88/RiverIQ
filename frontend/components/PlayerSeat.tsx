import { CSSProperties } from 'react'
import { Player } from '../types/poker'
import Avatar from './Avatar'
import Card from './Card'
import PositionMarker from './PositionMarker'

interface PlayerSeatProps {
  player: Player
  isCurrentPlayer: boolean
  isDealer: boolean
  isLB: boolean
  isBB: boolean
  showCards: boolean                       // showdown — reveal active hands
  isWinner: boolean                        // hand was won by this player
  visibleCardCount: number                 // 0/1/2 — gated by the dealing animation
  cardOrigin?: { x: number; y: number }    // pixel vector toward the table-center deck
}

// Shared brass-placard status indicator. Each variant has its own ink color
// and slight tilt so it reads as a physical label pressed onto the seat,
// not a generic toast.
function StatusPlacard({ variant, children }: { variant: string; children: React.ReactNode }) {
  return <span className={`status-placard ${variant}`}>{children}</span>
}

function StatusOverlay({ player }: { player: Player }) {
  // Centered overlay for "out of this hand" states (fold / busted / sitting out).
  if (player.status === 'folded') {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <StatusPlacard variant="status-fold">Folded</StatusPlacard>
      </div>
    )
  }
  if (player.status === 'busted') {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <StatusPlacard variant="status-out">Out</StatusPlacard>
      </div>
    )
  }
  if (player.status === 'sitting-out') {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <StatusPlacard variant="status-away">Away</StatusPlacard>
      </div>
    )
  }
  return null
}

function AllInBadge() {
  // All-in stays as a corner badge (not centered) because the player is
  // still in the hand and we want their cards / chip stack visible.
  return (
    <div className="absolute -top-2 -left-2 pointer-events-none">
      <StatusPlacard variant="status-allin">All in</StatusPlacard>
    </div>
  )
}

export default function PlayerSeat({
  player,
  isCurrentPlayer,
  isDealer,
  isLB,
  isBB,
  showCards,
  isWinner,
  visibleCardCount,
  cardOrigin = { x: 0, y: 0 },
}: PlayerSeatProps) {
  const isOut = player.status === 'folded' || player.status === 'sitting-out' || player.status === 'busted'
  const isAllIn = player.status === 'all-in'
  const revealCards = player.isHuman || showCards
  const cardsToShow = isOut ? [] : player.holeCards.slice(0, visibleCardCount)

  // ── Hero seat ──────────────────────────────────────────────────────────────
  // Plate ABOVE cards so the action placard below has clean room. No big
  // circular avatar — the user is behind their cards, not next to them.
  if (player.isHuman) {
    return (
      <div
        className={`relative flex flex-col items-center gap-2 transition-all
          ${isOut ? 'opacity-40' : ''}
          ${isCurrentPlayer ? 'scale-105' : ''}
        `}
      >
        <div className="name-plate px-3 py-1 flex items-baseline gap-2 whitespace-nowrap">
          <span className="font-display italic font-bold text-sm" style={{ color: 'var(--ink)' }}>
            You
          </span>
          <span className="font-mono text-sm font-bold" style={{ color: 'var(--ink)' }}>
            ${player.chips.toLocaleString()}
          </span>
        </div>

        <div
          className={`relative rounded-lg ${
            isWinner
              ? 'winner-pulse'
              : isCurrentPlayer
              ? 'ring-2 ring-yellow-300 shadow-[0_0_22px_rgba(253,224,71,0.6)]'
              : ''
          }`}
        >
          {cardsToShow.length > 0 && (
            <div className="flex gap-1">
              {cardsToShow.map((c) => (
                <div
                  key={c}
                  className="hole-card-deal"
                  style={
                    {
                      '--card-from-x': `${cardOrigin.x}px`,
                      '--card-from-y': `${cardOrigin.y}px`,
                    } as CSSProperties
                  }
                >
                  <Card card={revealCards ? c : null} size="lg" />
                </div>
              ))}
            </div>
          )}
        </div>

        {(isDealer || isLB || isBB) && (
          <div className="absolute -top-2 -right-2 flex gap-1">
            {isDealer && <PositionMarker marker="D" size="sm" />}
            {isLB && <PositionMarker marker="LB" size="sm" />}
            {isBB && <PositionMarker marker="BB" size="sm" />}
          </div>
        )}

        {isAllIn && <AllInBadge />}
        <StatusOverlay player={player} />
      </div>
    )
  }

  // ── Bot seat ──────────────────────────────────────────────────────────────
  return (
    <div
      className={`relative flex flex-col items-center gap-1 transition-all
        ${isOut ? 'opacity-40' : ''}
        ${isCurrentPlayer ? 'scale-110' : ''}
      `}
    >
      {cardsToShow.length > 0 && (
        <div className="flex gap-1">
          {cardsToShow.map((c) => (
            <div
              key={c}
              className="hole-card-deal"
              style={
                {
                  '--card-from-x': `${cardOrigin.x}px`,
                  '--card-from-y': `${cardOrigin.y}px`,
                } as CSSProperties
              }
            >
              <Card card={revealCards ? c : null} size="lg" />
            </div>
          ))}
        </div>
      )}

      <div
        className={`rounded-full ${
          isWinner
            ? 'winner-pulse'
            : isCurrentPlayer
            ? 'ring-4 ring-yellow-300 shadow-[0_0_20px_rgba(253,224,71,0.7)]'
            : ''
        }`}
      >
        <Avatar name={player.name} isHuman={false} size="lg" />
      </div>

      <div
        className={`name-plate px-3 py-1.5 text-center min-w-[110px] ${
          isWinner ? 'ring-2 ring-amber-300' : ''
        }`}
      >
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
          {player.name}
        </div>
        <div className="text-base font-bold font-mono" style={{ color: 'var(--wine)' }}>
          ${player.chips.toLocaleString()}
        </div>
      </div>

      {(isDealer || isLB || isBB) && (
        <div className="absolute -top-2 -right-2 flex gap-1">
          {isDealer && <PositionMarker marker="D" size="sm" />}
          {isLB && <PositionMarker marker="LB" size="sm" />}
          {isBB && <PositionMarker marker="BB" size="sm" />}
        </div>
      )}

      {isAllIn && <AllInBadge />}
      <StatusOverlay player={player} />
    </div>
  )
}
