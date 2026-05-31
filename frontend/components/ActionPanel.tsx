'use client'

import { useState, useEffect, useMemo } from 'react'
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

  const [raiseAmount, setRaiseAmount] = useState(minRaiseTotal)
  const [inputValue, setInputValue] = useState(String(minRaiseTotal))

  useEffect(() => {
    const clamped = Math.min(Math.max(minRaiseTotal, 0), maxRaiseTotal)
    setRaiseAmount(clamped)
    setInputValue(String(clamped))
  }, [minRaiseTotal, maxRaiseTotal, state.currentPlayerIndex, state.street])

  const humanPlayer = useMemo(() => state.players.find(p => p.isHuman), [state.players])

  const isHumansTurn =
    !disabled
    && player?.isHuman
    && state.phase === 'playing'
    && player.status === 'active'

  // Status messages still rendered inline when they relate specifically to the
  // human's state (e.g. all-in / folded / sitting out). Generic "waiting for
  // X" lives in the floating indicator above the table instead.
  if (humanPlayer && humanPlayer.status === 'all-in' && state.phase !== 'showdown') {
    return (
      <div className="bg-black/60 text-white/70 text-lg font-semibold px-8 py-5 rounded-2xl shadow-xl">
        You&apos;re all in — running out the board.
      </div>
    )
  }
  if (humanPlayer && humanPlayer.status === 'folded' && state.phase === 'playing') {
    return (
      <div className="bg-black/60 text-white/70 text-lg font-semibold px-8 py-5 rounded-2xl shadow-xl">
        You folded — waiting on the rest of the table.
      </div>
    )
  }
  if (humanPlayer && humanPlayer.status === 'sitting-out') {
    return (
      <div className="bg-black/60 text-white/70 text-lg font-semibold px-8 py-5 rounded-2xl shadow-xl">
        Sitting out this hand.
      </div>
    )
  }

  if (disabled) return null
  if (state.phase === 'between-streets') return null
  if (state.phase === 'showdown') return null
  if (state.phase === 'game-over') return null
  if (!isHumansTurn) return null

  const setAmount = (n: number) => {
    const clamped = Math.min(Math.max(Math.floor(n), minRaiseTotal), maxRaiseTotal)
    setRaiseAmount(clamped)
    setInputValue(String(clamped))
  }

  const commitInput = () => {
    const parsed = parseInt(inputValue, 10)
    if (Number.isFinite(parsed)) setAmount(parsed)
    else setInputValue(String(raiseAmount))
  }

  // Pressing Enter submits the raise — but only if the typed amount is in
  // the legal range. Invalid input clamps the display silently instead of
  // firing an action the engine would reject anyway.
  const submitRaiseFromInput = () => {
    const parsed = parseInt(inputValue, 10)
    if (!Number.isFinite(parsed)) {
      setInputValue(String(raiseAmount))
      return
    }
    if (parsed < minRaiseTotal || parsed > maxRaiseTotal) {
      setAmount(parsed)
      return
    }
    onAction('raise', parsed)
  }

  const pot = Math.max(state.pot, 0)
  const halfPot = state.currentBet + Math.floor(pot * 0.5)
  const presets = [
    { label: '½ Pot', value: halfPot },
  ].filter(p => p.value >= minRaiseTotal && p.value <= maxRaiseTotal)

  return (
    <div className="flex flex-col items-stretch gap-4 bg-black/75 rounded-2xl p-6 min-w-[680px] border-2 border-amber-400 shadow-[0_0_28px_rgba(251,191,36,0.55)]">
      {canRaise && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm text-white/60 font-mono">min ${minRaiseTotal}</span>
            <div className="flex items-center gap-2 bg-zinc-950 border-2 border-amber-400/50 rounded-xl px-4 py-2 focus-within:border-amber-400">
              <span className="text-amber-300 text-2xl font-bold">$</span>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={commitInput}
                onKeyDown={(e) => { if (e.key === 'Enter') submitRaiseFromInput() }}
                min={minRaiseTotal}
                max={maxRaiseTotal}
                step={5}
                className="w-40 bg-transparent text-white text-3xl font-extrabold text-center focus:outline-none"
              />
            </div>
            <span className="text-sm text-white/60 font-mono">max ${maxRaiseTotal}</span>
          </div>
          {presets.length > 0 && (
            <div className="flex gap-2 justify-center">
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => setAmount(p.value)}
                  className="text-sm px-4 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white/90 border border-white/10 transition font-semibold"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
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
