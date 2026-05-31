'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PokerTable from '../../components/PokerTable'
import GameMenu from '../../components/GameMenu'
import ConfirmModal from '../../components/ConfirmModal'
import { GameState, ActionType } from '../../types/poker'
import {
  initGame, dealNewHand, processAction, advanceStreet, STARTING_CHIPS,
} from '../../lib/gameEngine'
import { decideBotAction } from '../../lib/botLogic'
import { decideBotApi } from '../../lib/api'
import { generateOpponents, getDifficulty, randomTableSize } from '../../lib/difficulties'

const BOT_DELAY_MS = 1500
const SHOWDOWN_DELAY_MS = 4000
const STREET_BUFFER_MS = 900           // pause between last action of a street and next card
const DEAL_TICK_MS = 160

type ConfirmKind = 'leave' | 'addStack' | 'reset' | null

function GamePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const styleId = searchParams.get('style') ?? 'home-game'
  const difficulty = getDifficulty(styleId)

  const [state, setState] = useState<GameState | null>(null)
  const [dealtCount, setDealtCount] = useState(0)
  // User's intent to sit out — applied at the next dealNewHand.
  const [sitOutQueued, setSitOutQueued] = useState(false)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null)

  // Roll a fresh table: random size 5–9, new controlled-random opponents,
  // fresh stacks for everyone. Used both on initial mount and by the Reset
  // button in the game menu.
  const rollFreshTable = useCallback(() => {
    const size = randomTableSize(5, 9)
    const opponents = generateOpponents(styleId, size - 1)
    setState(dealNewHand(initGame(size, opponents)))
    setDealtCount(0)
    setSitOutQueued(false)
  }, [styleId])

  useEffect(() => {
    rollFreshTable()
  }, [rollFreshTable])

  const isDealing = !!state && dealtCount < (state.players.length * 2)

  // Step the dealing animation forward one card at a time. Sat-out and
  // busted seats just render empty card slots (their holeCards = []).
  useEffect(() => {
    if (!state || state.phase !== 'playing') return
    if (dealtCount >= state.players.length * 2) return
    const timer = setTimeout(() => setDealtCount(c => c + 1), DEAL_TICK_MS)
    return () => clearTimeout(timer)
  }, [state, dealtCount])

  const handleAction = useCallback((action: ActionType, amount: number) => {
    setState(prev => (prev ? processAction(prev, action, amount) : prev))
  }, [])

  // Bot turn loop.
  useEffect(() => {
    if (!state || state.phase !== 'playing') return
    if (isDealing) return
    const current = state.players[state.currentPlayerIndex]
    if (!current || current.isHuman) return
    if (current.status !== 'active') return  // safety: never act for a player who can't

    let cancelled = false
    const timer = setTimeout(async () => {
      if (cancelled) return

      const snapshot = state
      const player = snapshot.players[snapshot.currentPlayerIndex]
      const numActive = snapshot.players.filter(p => p.status === 'active').length

      let decision
      try {
        decision = await decideBotApi({
          hole_cards: player.holeCards,
          community_cards: snapshot.communityCards,
          pot: snapshot.pot,
          current_bet: snapshot.currentBet,
          player_current_bet: player.currentBet,
          player_chips: player.chips,
          min_raise: snapshot.minRaise,
          big_blind: 20,
          street: snapshot.street,
          personality: player.personality ?? 'pro',
          position: player.position,
          num_active: numActive,
        })
      } catch (err) {
        console.warn('Bot API unavailable, using local fallback:', err)
        decision = decideBotAction(snapshot)
      }
      if (cancelled) return

      setState(prev => {
        if (!prev || prev.phase !== 'playing') return prev
        const c = prev.players[prev.currentPlayerIndex]
        if (!c || c.isHuman || c.status !== 'active') return prev
        return processAction(prev, decision.action, decision.amount)
      })
    }, BOT_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [state, isDealing])

  // Inter-street pacing: when a betting round ends, wait briefly then deal
  // the next card. This also covers the all-in run-out — each card runs
  // through this same buffer.
  useEffect(() => {
    if (!state || state.phase !== 'between-streets') return
    const timer = setTimeout(() => {
      setState(prev => (prev && prev.phase === 'between-streets' ? advanceStreet(prev) : prev))
    }, STREET_BUFFER_MS)
    return () => clearTimeout(timer)
  }, [state])

  // After showdown, pause and deal the next hand (or game-over).
  useEffect(() => {
    if (!state || state.phase !== 'showdown') return
    const timer = setTimeout(() => {
      setState(prev => {
        if (!prev) return prev
        const next = dealNewHand(prev, { humanSittingOut: sitOutQueued })
        return next
      })
      setDealtCount(0)
    }, SHOWDOWN_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state, sitOutQueued])

  // Add-to-stack gating: human's stack ≤ 20% of average AND we're between hands.
  const canAddToStack = useMemo(() => {
    if (!state) return false
    if (state.phase !== 'showdown' && state.phase !== 'waiting') return false
    const inGame = state.players.filter(p => p.status !== 'busted')
    if (inGame.length === 0) return false
    const total = inGame.reduce((sum, p) => sum + p.chips, 0)
    const avg = total / inGame.length
    const human = state.players.find(p => p.isHuman)
    if (!human || human.status === 'busted') return false
    if (human.chips >= STARTING_CHIPS) return false
    return human.chips <= 0.2 * avg
  }, [state])

  const handleStand = useCallback(() => setSitOutQueued(v => !v), [])
  const requestLeave = useCallback(() => setConfirmKind('leave'), [])
  const requestAddToStack = useCallback(() => setConfirmKind('addStack'), [])
  const requestReset = useCallback(() => setConfirmKind('reset'), [])
  const cancelConfirm = useCallback(() => setConfirmKind(null), [])

  const confirmReset = useCallback(() => {
    setConfirmKind(null)
    rollFreshTable()
  }, [rollFreshTable])

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

  const isGameOver = state?.phase === 'game-over'

  if (!state) {
    return (
      <div className="min-h-screen bg-underground flex items-center justify-center text-white">
        <div className="text-2xl font-semibold opacity-70">Dealing...</div>
      </div>
    )
  }

  const human = state.players.find(p => p.isHuman)
  const humanIsSittingOut = human?.status === 'sitting-out'

  return (
    <div className="min-h-screen bg-underground py-6 px-4 text-white">
      <div className="fixed top-4 left-4 z-40 bg-black/70 backdrop-blur-md rounded-xl px-4 py-2 border border-white/15 shadow-lg">
        <div className="text-xs uppercase tracking-wider text-white/50">Table</div>
        <div className="text-base font-bold text-amber-300">{difficulty.name}</div>
        <div className="text-xs text-white/50 mt-0.5">{state.players.length}-handed</div>
      </div>

      {/* Queued sit-out / sit-in banner — visible when the user's intent for
          the next hand differs from their current state. */}
      {sitOutQueued && !humanIsSittingOut && state.phase !== 'game-over' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-amber-500/90 text-black font-bold text-sm px-4 py-2 rounded-lg shadow-lg">
          You&apos;ll sit out next hand
        </div>
      )}
      {!sitOutQueued && humanIsSittingOut && state.phase !== 'game-over' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-emerald-500/90 text-black font-bold text-sm px-4 py-2 rounded-lg shadow-lg">
          You&apos;ll be dealt in next hand
        </div>
      )}

      <PokerTable
        state={state}
        onAction={handleAction}
        dealtCount={dealtCount}
        isDealing={isDealing}
      />

      <GameMenu
        isSittingOut={sitOutQueued}
        canAddToStack={canAddToStack}
        onStand={handleStand}
        onAddToStack={requestAddToStack}
        onReset={requestReset}
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

      {confirmKind === 'reset' && (
        <ConfirmModal
          title="Reset the table?"
          message="A fresh lineup will be drawn, everyone's stack resets to $2000, and a new hand is dealt. Your current progress is lost."
          confirmText="Reset"
          cancelText="Cancel"
          onConfirm={confirmReset}
          onCancel={cancelConfirm}
        />
      )}

      {isGameOver && (
        <ConfirmModal
          title={human?.status === 'busted' ? 'You busted out.' : 'Game over.'}
          message={
            human?.status === 'busted'
              ? "You're out of chips. Better luck next session."
              : 'Not enough players left to continue.'
          }
          confirmText="Back to lobby"
          cancelText="Stay"
          onConfirm={confirmLeave}
          onCancel={() => { /* no-op — game is already over */ }}
        />
      )}
    </div>
  )
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-underground flex items-center justify-center text-white">
          <div className="text-2xl font-semibold opacity-70">Loading...</div>
        </div>
      }
    >
      <GamePageInner />
    </Suspense>
  )
}
