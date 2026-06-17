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

  // Preset sizings = (call cost) + (pot-relative top-up). Cap each preset to
  // the legal raise window so a preset never offers an illegal amount.
  const pot = Math.max(state.pot, 0)
  const presets = [
    { label: '½ Pot', value: state.currentBet + Math.floor(pot * 0.5) },
    { label: '¾ Pot', value: state.currentBet + Math.floor(pot * 0.75) },
    { label: 'Pot',   value: state.currentBet + pot },
    { label: 'All in', value: maxRaiseTotal },
  ].filter(p => p.value >= minRaiseTotal && p.value <= maxRaiseTotal)

  return (
    <div className="action-placard relative flex flex-col items-stretch gap-4 p-6 min-w-[680px]">
      {canRaise && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-4">
            <span
              className="text-xs font-mono uppercase tracking-widest"
              style={{ color: 'var(--brass-soft)' }}
            >
              min ${minRaiseTotal}
            </span>
            <div className="bet-input flex items-center gap-1 rounded-md px-4 py-2">
              <span className="text-2xl font-bold" style={{ color: 'var(--wine)' }}>$</span>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={commitInput}
                onKeyDown={(e) => { if (e.key === 'Enter') submitRaiseFromInput() }}
                min={minRaiseTotal}
                max={maxRaiseTotal}
                step={5}
                className="w-44 bg-transparent text-3xl font-extrabold text-center focus:outline-none"
                style={{ color: 'var(--ink)' }}
              />
            </div>
            <span
              className="text-xs font-mono uppercase tracking-widest"
              style={{ color: 'var(--brass-soft)' }}
            >
              max ${maxRaiseTotal}
            </span>
          </div>
          {presets.length > 0 && (
            <div className="flex gap-2 justify-center">
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => setAmount(p.value)}
                  className="text-xs font-mono uppercase tracking-wider px-3 py-1 rounded-md transition"
                  style={{
                    background: 'rgba(184, 150, 104, 0.08)',
                    color: 'var(--brass)',
                    border: '1px solid rgba(184, 150, 104, 0.35)',
                  }}
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
          className="action-btn action-btn-fold flex-1 px-6 py-4 text-lg"
        >
          Fold
        </button>

        {canCheck ? (
          <button
            onClick={() => onAction('check', 0)}
            className="action-btn action-btn-call flex-1 px-6 py-4 text-lg"
          >
            Check
          </button>
        ) : (
          <button
            onClick={() => onAction('call', callAmount)}
            className="action-btn action-btn-call flex-1 px-6 py-4 text-lg"
          >
            Call ${callAmount}
          </button>
        )}

        {canRaise && (
          <button
            onClick={() => onAction('raise', raiseAmount)}
            className="action-btn action-btn-raise flex-1 px-6 py-4 text-lg"
          >
            Raise to ${raiseAmount}
          </button>
        )}
      </div>
    </div>
  )
}
