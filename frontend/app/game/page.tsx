'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import PokerTable from '../../components/PokerTable'
import GameMenu from '../../components/GameMenu'
import ConfirmModal from '../../components/ConfirmModal'
import { GameState, ActionType } from '../../types/poker'
import { initGame, dealNewHand, processAction, STARTING_CHIPS } from '../../lib/gameEngine'
import { decideBotAction } from '../../lib/botLogic'

const TABLE_SIZE = 6
const BOT_DELAY_MS = 1800
const SHOWDOWN_DELAY_MS = 4000
const DEAL_TICK_MS = 160
const SITTING_OUT_FOLD_DELAY_MS = 300

type ConfirmKind = 'leave' | 'addStack' | null

export default function GamePage() {
  const router = useRouter()
  const [state, setState] = useState<GameState | null>(null)
  const [dealtCount, setDealtCount] = useState(0)
  const [isSittingOut, setIsSittingOut] = useState(false)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null)

  // Deal the first hand on mount.
  useEffect(() => {
    setState(dealNewHand(initGame(TABLE_SIZE)))
    setDealtCount(0)
  }, [])

  const isDealing = !!state && dealtCount < state.tableSize * 2

  // Step the dealing animation forward one card at a time.
  useEffect(() => {
    if (!state || state.phase !== 'playing') return
    if (dealtCount >= state.tableSize * 2) return
    const timer = setTimeout(() => setDealtCount(c => c + 1), DEAL_TICK_MS)
    return () => clearTimeout(timer)
  }, [state, dealtCount])

  // Human's action handler.
  const handleAction = useCallback((action: ActionType, amount: number) => {
    setState(prev => (prev ? processAction(prev, action, amount) : prev))
  }, [])

  // Bot turn loop.
  useEffect(() => {
    if (!state || state.phase !== 'playing') return
    if (isDealing) return
    const current = state.players[state.currentPlayerIndex]
    if (!current || current.isHuman) return

    const timer = setTimeout(() => {
      setState(prev => {
        if (!prev || prev.phase !== 'playing') return prev
        const c = prev.players[prev.currentPlayerIndex]
        if (!c || c.isHuman) return prev
        const decision = decideBotAction(prev)
        return processAction(prev, decision.action, decision.amount)
      })
    }, BOT_DELAY_MS)

    return () => clearTimeout(timer)
  }, [state, isDealing])

  // Auto-fold the human as soon as it's their turn if they're sitting out.
  useEffect(() => {
    if (!state || state.phase !== 'playing') return
    if (isDealing || !isSittingOut) return
    const current = state.players[state.currentPlayerIndex]
    if (!current?.isHuman || current.status !== 'active') return

    const timer = setTimeout(() => {
      setState(prev => (prev ? processAction(prev, 'fold', 0) : prev))
    }, SITTING_OUT_FOLD_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state, isDealing, isSittingOut])

  // After showdown, pause, then deal a fresh hand and reset the dealing animation.
  useEffect(() => {
    if (!state || state.phase !== 'showdown') return
    const timer = setTimeout(() => {
      setState(prev => (prev ? dealNewHand(prev) : prev))
      setDealtCount(0)
    }, SHOWDOWN_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state])

  // Add-to-stack gating: human's stack ≤ 20% of average AND we're between hands.
  const canAddToStack = useMemo(() => {
    if (!state) return false
    if (state.phase !== 'showdown' && state.phase !== 'waiting') return false
    const total = state.players.reduce((sum, p) => sum + p.chips, 0)
    const avg = total / state.players.length
    const human = state.players.find(p => p.isHuman)
    if (!human) return false
    if (human.chips >= STARTING_CHIPS) return false
    return human.chips <= 0.2 * avg
  }, [state])

  const handleStand = useCallback(() => setIsSittingOut(s => !s), [])
  const requestLeave = useCallback(() => setConfirmKind('leave'), [])
  const requestAddToStack = useCallback(() => setConfirmKind('addStack'), [])
  const cancelConfirm = useCallback(() => setConfirmKind(null), [])

  const confirmLeave = useCallback(() => {
    setConfirmKind(null)
    router.push('/')
  }, [router])

  const confirmAddToStack = useCallback(() => {
    setConfirmKind(null)
    setState(prev => {
      if (!prev) return prev
      return {
        ...prev,
        players: prev.players.map(p =>
          p.isHuman ? { ...p, chips: STARTING_CHIPS } : p
        ),
      }
    })
  }, [])

  if (!state) {
    return (
      <div className="min-h-screen bg-underground flex items-center justify-center text-white">
        <div className="text-2xl font-semibold opacity-70">Dealing...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-underground py-8 px-4 text-white">
      <PokerTable
        state={state}
        onAction={handleAction}
        dealtCount={dealtCount}
        isDealing={isDealing}
      />

      <GameMenu
        isSittingOut={isSittingOut}
        canAddToStack={canAddToStack}
        onStand={handleStand}
        onAddToStack={requestAddToStack}
        onLeave={requestLeave}
      />

      {confirmKind === 'leave' && (
        <ConfirmModal
          title="Leave the table?"
          message="Your stack and progress for this session will be lost."
          confirmText="Leave"
          cancelText="Stay"
          onConfirm={confirmLeave}
          onCancel={cancelConfirm}
        />
      )}

      {confirmKind === 'addStack' && (
        <ConfirmModal
          title="Add to your stack?"
          message={`You'll be topped up to $${STARTING_CHIPS}. Available because your stack is at or below 20% of the table average.`}
          confirmText="Top Up"
          cancelText="Cancel"
          onConfirm={confirmAddToStack}
          onCancel={cancelConfirm}
        />
      )}
    </div>
  )
}
