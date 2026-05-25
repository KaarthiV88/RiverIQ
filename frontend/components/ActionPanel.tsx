'use client'

import { useState, useEffect } from 'react'
import { GameState, ActionType } from '../types/poker'

interface ActionPanelProps {
  state: GameState
  onAction: (action: ActionType, amount: number) => void
  disabled?: boolean
}

export default function ActionPanel({ state, onAction, disabled = false }: ActionPanelProps) {
  const player = state.players[state.currentPlayerIndex]
  const callAmount = state.currentBet - (player?.currentBet ?? 0)
  const canCheck = callAmount === 0
  const minRaiseTotal = state.currentBet + state.minRaise
  const maxRaiseTotal = (player?.chips ?? 0) + (player?.currentBet ?? 0)
  const canRaise = maxRaiseTotal >= minRaiseTotal

  // Hooks must run in the same order every render, so we declare them
  // unconditionally up front and only branch on the render below.
  const [raiseAmount, setRaiseAmount] = useState(minRaiseTotal)

  useEffect(() => {
    setRaiseAmount(Math.min(Math.max(minRaiseTotal, 0), maxRaiseTotal))
  }, [minRaiseTotal, maxRaiseTotal, state.currentPlayerIndex, state.street])

  const isHumansTurn =
    !disabled
    && player?.isHuman
    && state.phase === 'playing'
    && player.status === 'active'

  if (disabled) {
    return (
      <div className="bg-black/60 text-white/70 text-lg font-semibold px-8 py-5 rounded-2xl shadow-xl">
        Dealing cards...
      </div>
    )
  }

  if (!isHumansTurn) {
    return (
      <div className="bg-black/60 text-white/70 text-lg font-semibold px-8 py-5 rounded-2xl shadow-xl">
        Waiting for {player?.name ?? '...'}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-stretch gap-5 bg-black/70 rounded-2xl p-6 min-w-[600px] border-2 border-amber-400 shadow-[0_0_28px_rgba(251,191,36,0.55)]">
      {canRaise && (
        <div className="flex flex-col gap-2">
          <input
            type="range"
            min={minRaiseTotal}
            max={maxRaiseTotal}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(parseInt(e.target.value, 10))}
            className="w-full h-2 accent-amber-400"
          />
          <div className="flex justify-between text-sm text-white/70 font-mono">
            <span>min ${minRaiseTotal}</span>
            <span className="text-white text-xl font-bold">${raiseAmount}</span>
            <span>max ${maxRaiseTotal}</span>
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-center">
        <button
          onClick={() => onAction('fold', 0)}
          className="flex-1 px-6 py-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-lg rounded-xl shadow transition"
        >
          Fold
        </button>

        {canCheck ? (
          <button
            onClick={() => onAction('check', 0)}
            className="flex-1 px-6 py-4 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-lg rounded-xl shadow transition"
          >
            Check
          </button>
        ) : (
          <button
            onClick={() => onAction('call', callAmount)}
            className="flex-1 px-6 py-4 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-lg rounded-xl shadow transition"
          >
            Call ${callAmount}
          </button>
        )}

        {canRaise && (
          <button
            onClick={() => onAction('raise', raiseAmount)}
            className="flex-1 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-lg rounded-xl shadow transition"
          >
            Raise → ${raiseAmount}
          </button>
        )}
      </div>
    </div>
  )
}
