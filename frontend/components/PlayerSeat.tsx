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
  const isFolded = player.status === 'folded'
  const isAllIn = player.status === 'all-in'
  const revealCards = player.isHuman || showCards
  // Folded players: cards are taken away. Don't render them at all.
  const cardsToShow = isFolded ? [] : player.holeCards.slice(0, visibleCardCount)

  return (
    <div
      className={`relative flex flex-col items-center gap-1 transition-all
        ${isFolded ? 'opacity-40' : ''}
        ${isCurrentPlayer ? 'scale-110' : ''}
      `}
    >
      {/* Hole cards */}
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

      {/* Avatar — yellow glow on turn, gold pulse on win. */}
      <div
        className={`rounded-full ${
          isWinner
            ? 'winner-pulse'
            : isCurrentPlayer
            ? 'ring-4 ring-yellow-300 shadow-[0_0_20px_rgba(253,224,71,0.7)]'
            : ''
        }`}
      >
        <Avatar name={player.name} isHuman={player.isHuman} size="lg" />
      </div>

      {/* Name + chip count card */}
      <div
        className={`rounded-lg px-3 py-1.5 text-center min-w-[110px] shadow ${
          isWinner ? 'bg-amber-600/80 ring-2 ring-amber-300' : 'bg-black/65'
        }`}
      >
        <div className="text-sm font-semibold text-white truncate">{player.name}</div>
        <div className="text-base text-amber-300 font-bold">${player.chips}</div>
      </div>

      {/* Position markers */}
      {(isDealer || isLB || isBB) && (
        <div className="absolute -top-2 -right-2 flex gap-1">
          {isDealer && <PositionMarker marker="D" size="sm" />}
          {isLB && <PositionMarker marker="LB" size="sm" />}
          {isBB && <PositionMarker marker="BB" size="sm" />}
        </div>
      )}

      {/* Status overlays */}
      {isFolded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded -rotate-12 shadow">
            FOLD
          </div>
        </div>
      )}
      {isAllIn && (
        <div className="absolute -top-2 -left-2 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow">
          ALL-IN
        </div>
      )}
    </div>
  )
}
