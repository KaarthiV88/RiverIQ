'use client'

import { useState, useEffect } from 'react'
import { GameState, ActionType } from '../types/poker'
import PlayerSeat from './PlayerSeat'
import CommunityCards from './CommunityCards'
import PotDisplay from './PotDisplay'
import ActionPanel from './ActionPanel'
import Chip from './Chip'
import BetStack from './BetStack'

interface PokerTableProps {
  state: GameState
  onAction?: (action: ActionType, amount: number) => void
  dealtCount?: number
  isDealing?: boolean
  /** Optional overlay rendered on top of the table region — used for the
   *  Coach AR HUD. Shares the table's coordinate system. */
  hudOverlay?: React.ReactNode
  /** Chat panel rendered inside the table wrapper so it docks to the AR
   *  area's right edge instead of the viewport's right edge. */
  chatPanel?: React.ReactNode
}

// For seat `s`, when have we dealt them `1` card? After (s - SB) % n cards.
// Their 2nd card arrives n cards later.
function cardsDealtToPlayer(seatIndex: number, smallBlindIndex: number, n: number, total: number): number {
  const orderForCard1 = (seatIndex - smallBlindIndex + n) % n
  if (total > orderForCard1 + n) return 2
  if (total > orderForCard1) return 1
  return 0
}

// Small component that animates a chip element from the pot center out to a
// winner's seat once mounted, then fades.
function WinnerChipFly({
  toX, toY, color, delay,
}: { toX: number; toY: number; color: 'white' | 'red' | 'blue' | 'green' | 'black'; delay: number }) {
  const [arrived, setArrived] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setArrived(true), 50 + delay)
    return () => clearTimeout(t)
  }, [delay])
  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{
        left: arrived ? `${toX}%` : '50%',
        top: arrived ? `${toY}%` : '50%',
        transform: 'translate(-50%, -50%)',
        transition: 'left 1.1s ease-out, top 1.1s ease-out, opacity 0.4s ease-out 0.9s',
        opacity: arrived ? 0 : 1,
      }}
    >
      <Chip color={color} size="md" />
    </div>
  )
}

export default function PokerTable({
  state, onAction, dealtCount = 0, isDealing = false, hudOverlay, chatPanel,
}: PokerTableProps) {
  const n = state.players.length
  const isShowdown = state.phase === 'showdown'

  // Player whose turn it currently is — used for the "waiting" indicator above
  // the table when it isn't the human's turn.
  const currentPlayer = state.players[state.currentPlayerIndex]
  const showWaiting =
    state.phase === 'playing'
    && !isDealing
    && currentPlayer
    && !currentPlayer.isHuman
    && currentPlayer.status === 'active'

  // For larger tables the seats clip against the top of the wrapper because
  // they sit at the top of the table ellipse. Adding generous top padding to
  // the outer wrapper gives them breathing room without distorting the felt.
  return (
    <div className="relative w-full max-w-7xl mx-auto pt-24 pb-4">
      {/* Floating "thinking" indicator above the table. */}
      {showWaiting && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-black/75 backdrop-blur-md border border-white/15 rounded-full px-4 py-2 shadow-xl">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
          <span className="text-sm font-semibold text-amber-200">
            {currentPlayer!.name} is thinking…
          </span>
        </div>
      )}
      <div className="relative aspect-[16/7.4]">
        {/* Outer rail — oak wood with grain. */}
        <div className="table-rail absolute inset-0 rounded-[50%] shadow-2xl" />

        {/* Brass hairline trim ring between rail and felt. */}
        <div className="brass-ring absolute inset-5 rounded-[50%]" />

        {/* Worn felt with center oil-lamp pool + dark recessed rim. */}
        <div className="table-felt absolute inset-[22px] rounded-[50%] overflow-visible">
          {/* Manufacturer-mark wordmark stamped into the felt, behind the
              community cards. Quiet enough to feel printed-on, not added-on. */}
          <div className="absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="felt-stamp text-3xl md:text-4xl">RiverIQ</div>
            <div className="felt-stamp-sub text-[9px] mt-1">Texas Hold&apos;em</div>
          </div>

          {/* Center area: community cards + pot. */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
            <CommunityCards cards={state.communityCards} />
            <PotDisplay amount={state.pot} />
          </div>
        </div>

        {/* Player seats — clockwise from bottom-center.
            Elliptical orbit: wider X, tighter Y to (a) fit more seats on a wider
            table without overlap and (b) keep top seats from clipping above. */}
        {state.players.map((player, i) => {
          const angle = Math.PI / 2 + (i / n) * 2 * Math.PI
          const seatX = 50 + 48 * Math.cos(angle)
          const seatY = 50 + 44 * Math.sin(angle)
          const visibleCardCount = cardsDealtToPlayer(i, state.smallBlindIndex, n, dealtCount)
          const isWinner = isShowdown && state.winners.includes(player.id)

          // Hole-card dealing animation origin: a pixel vector pointing from
          // the seat back toward the table center, so cards visually appear
          // to come from the deck and spin into the player's hand.
          const cardOrigin = {
            x: -Math.cos(angle) * 220,
            y: -Math.sin(angle) * 150,
          }

          return (
            <div
              key={player.id}
              className="absolute"
              style={{
                left: `${seatX}%`,
                top: `${seatY}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <PlayerSeat
                player={player}
                isCurrentPlayer={
                  state.currentPlayerIndex === i && state.phase === 'playing' && !isDealing
                }
                isDealer={state.dealerIndex === i}
                isLB={state.smallBlindIndex === i}
                isBB={state.bigBlindIndex === i}
                showCards={isShowdown}
                isWinner={isWinner}
                visibleCardCount={visibleCardCount}
                cardOrigin={cardOrigin}
              />
            </div>
          )
        })}

        {/* Bets — a real chip stack between each seat and the pot. */}
        {state.players.map((player, i) => {
          if (player.currentBet <= 0) return null
          const angle = Math.PI / 2 + (i / n) * 2 * Math.PI
          let betX = 50 + 32 * Math.cos(angle)
          let betY = 50 + 28 * Math.sin(angle)
          if (player.isHuman) {
            betX = 60
            betY = 84
          } else if (i === Math.round(n / 2)) {
            betX = 60
            betY = 22
          }
          return (
            <div
              key={`bet-${player.id}`}
              className="absolute z-10"
              style={{
                left: `${betX}%`,
                top: `${betY}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <BetStack amount={player.currentBet} />
            </div>
          )
        })}

        {/* Winner payout: chips fly from the pot to each winner's seat. */}
        {isShowdown && state.winners.length > 0 && state.winners.map((winnerId, wIdx) => {
          const winnerIndex = state.players.findIndex(p => p.id === winnerId)
          if (winnerIndex < 0) return null
          const angle = Math.PI / 2 + (winnerIndex / n) * 2 * Math.PI
          const toX = 50 + 44 * Math.cos(angle)
          const toY = 50 + 40 * Math.sin(angle)
          const colors: Array<'white' | 'red' | 'blue' | 'green' | 'black'> = ['black', 'green', 'red']
          return colors.map((color, cIdx) => (
            <WinnerChipFly
              key={`win-${wIdx}-${cIdx}`}
              toX={toX}
              toY={toY}
              color={color}
              delay={cIdx * 120}
            />
          ))
        })}

        {/* Coach AR overlay — rendered on top of the table region so it
            shares the same coordinate system as the seats. */}
        {hudOverlay}

        {/* Coach chat panel — docked to the right edge of the AR area so it
            visually belongs to the HUD instead of floating in the viewport. */}
        {chatPanel}
      </div>

      {/* Action panel below the human seat. Reserves vertical space so the
          page doesn't jump when the panel returns null (bot turns / pacing). */}
      {onAction && (
        <div className="flex justify-center mt-6 min-h-[180px]">
          <ActionPanel state={state} onAction={onAction} disabled={isDealing} />
        </div>
      )}
    </div>
  )
}
