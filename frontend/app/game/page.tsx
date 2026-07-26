'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PokerTable from '../../components/PokerTable'
import GameMenu from '../../components/GameMenu'
import ConfirmModal from '../../components/ConfirmModal'
import CoachPanel from '../../components/CoachPanel'
import TableHUD from '../../components/TableHUD'
import { GameState, ActionType } from '../../types/poker'
import {
  initGame, dealNewHand, processAction, advanceStreet, STARTING_CHIPS,
} from '../../lib/gameEngine'
import { decideBotAction } from '../../lib/botLogic'
import { decideBotApi } from '../../lib/api'
import { generateOpponents, getDifficulty, randomTableSize } from '../../lib/difficulties'
import { buildHandSummary, saveHand } from '../../lib/history'
import SignInGate from '../../components/SignInGate'
import { isMuted, playAction, playPot, playYourTurn, toggleMute } from '../../lib/sound'

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
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStreaming, setCoachStreaming] = useState(false)
  // Which side of the AR area the chat docks to. Persisted across sessions
  // so the user's preference sticks.
  const [coachSide, setCoachSide] = useState<'left' | 'right'>('right')
  useEffect(() => {
    const saved = typeof window !== 'undefined'
      ? (window.localStorage.getItem('riveriq:coach_side') as 'left' | 'right' | null)
      : null
    if (saved === 'left' || saved === 'right') setCoachSide(saved)
  }, [])
  const toggleCoachSide = useCallback(() => {
    setCoachSide(prev => {
      const next = prev === 'right' ? 'left' : 'right'
      if (typeof window !== 'undefined') window.localStorage.setItem('riveriq:coach_side', next)
      return next
    })
  }, [])

  // Hand-history persistence (Phase 6): track the hero's stack snapshot at the
  // start of each hand and persist a summary once the hand reaches showdown.
  // `savedHandRef` guards against duplicate writes since the showdown phase
  // sticks around for ~4s while winners are animated.
  const handStartChipsRef = useRef<number | null>(null)
  const savedHandRef = useRef<boolean>(false)

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

  // Snapshot the hero's stack the moment a new hand enters the "playing"
  // phase so we can compute net delta at showdown. Resets `savedHandRef` so
  // the next showdown gets persisted exactly once.
  useEffect(() => {
    if (!state || state.phase !== 'playing') return
    if (handStartChipsRef.current !== null) return
    const human = state.players.find(p => p.isHuman)
    if (!human) return
    // Add back whatever the hero already put in this street (blinds posted
    // before phase flipped to 'playing' on the very first action) so the
    // snapshot is the *pre-blind* starting stack.
    handStartChipsRef.current = human.chips + human.totalBetThisHand
    savedHandRef.current = false
  }, [state])

  // Persist the hand summary once on showdown (Phase 6).
  useEffect(() => {
    if (!state || state.phase !== 'showdown') return
    if (savedHandRef.current) return
    const starting = handStartChipsRef.current
    if (starting === null) return

    savedHandRef.current = true
    const payload = buildHandSummary(state, styleId, starting)
    if (!payload) return

    saveHand(payload).catch(err => {
      // Non-fatal — the game keeps running even if persistence is down.
      console.warn('saveHand failed:', err)
    })
    // Reset the start snapshot now so the next 'playing' transition resets it.
    handStartChipsRef.current = null
  }, [state, styleId])

  const isDealing = !!state && dealtCount < (state.players.length * 2)

  // ──────────────────────────────────────────────────────────────────────
  // Audio cues. Synthesised on demand via lib/sound — no asset files.
  //   - handHistory grows  → play that action's sound
  //   - human's turn opens → soft brass bell
  //   - phase → showdown   → pot-rake chip cascade
  // Each ref tracks the previously observed state so transitions only
  // trigger once. When a new hand begins, handHistory resets to 0 and we
  // sync the ref without playing anything for the implicit blinds entries.
  const lastHistoryLenRef = useRef(0)
  const wasHumanTurnRef = useRef(false)
  const lastPhaseRef = useRef<GameState['phase'] | null>(null)
  const [, setMuteVersion] = useState(0)   // force re-render after toggle

  useEffect(() => {
    if (!state) return
    const len = state.handHistory.length
    const prev = lastHistoryLenRef.current
    if (len < prev) {
      // New hand was dealt — handHistory got rebuilt. Sync silently.
      lastHistoryLenRef.current = len
      return
    }
    if (len > prev) {
      for (let i = prev; i < len; i++) {
        playAction(state.handHistory[i].action)
      }
      lastHistoryLenRef.current = len
    }
  }, [state])

  useEffect(() => {
    if (!state) return
    const current = state.players[state.currentPlayerIndex]
    const myTurn =
      state.phase === 'playing' &&
      !isDealing &&
      !!current?.isHuman &&
      current.status === 'active'
    if (myTurn && !wasHumanTurnRef.current) playYourTurn()
    wasHumanTurnRef.current = myTurn
  }, [state, isDealing])

  useEffect(() => {
    if (!state) return
    if (state.phase === 'showdown' && lastPhaseRef.current !== 'showdown') {
      playPot()
    }
    lastPhaseRef.current = state.phase
  }, [state])

  const handleToggleMute = useCallback(() => {
    toggleMute()
    setMuteVersion(v => v + 1)
  }, [])

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
      <div className="fixed top-4 left-4 z-40 bg-black/70 backdrop-blur-md rounded-xl px-4 py-2 border border-white/15 shadow-lg flex items-center gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/50">Table</div>
          <div className="text-base font-bold text-amber-300">{difficulty.name}</div>
          <div className="text-xs text-white/50 mt-0.5">{state.players.length}-handed</div>
        </div>
        <button
          type="button"
          onClick={handleToggleMute}
          className="w-9 h-9 rounded-md border border-white/15 text-white/75 hover:text-white hover:bg-white/10 transition flex items-center justify-center"
          aria-label={isMuted() ? 'Unmute sounds' : 'Mute sounds'}
          title={isMuted() ? 'Unmute sounds' : 'Mute sounds'}
        >
          {isMuted() ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>
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
        hudOverlay={<TableHUD state={state} active={coachOpen} />}
        chatPanel={
          <CoachPanel
            open={coachOpen}
            onClose={() => setCoachOpen(false)}
            gameState={state}
            onStreamingChange={setCoachStreaming}
            side={coachSide}
            onToggleSide={toggleCoachSide}
          />
        }
      />

      {/* Stand / Add to Stack / Reset / Leave — hidden while the Coach is
          open so the AR area on the right has no competing UI on the edge. */}
      {!coachOpen && (
        <GameMenu
          isSittingOut={sitOutQueued}
          canAddToStack={canAddToStack}
          onStand={handleStand}
          onAddToStack={requestAddToStack}
          onReset={requestReset}
          onLeave={requestLeave}
        />
      )}

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

      {/* Floating coach button — hidden while the panel is open. Pulses + shows
          a "thinking" hint when a background stream is in flight. */}
      {!coachOpen && (
        <button
          onClick={() => setCoachOpen(true)}
          className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 active:scale-95 text-white font-bold rounded-full shadow-2xl border transition ${
            coachStreaming
              ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.55)] animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/40'
          }`}
          title={coachStreaming ? 'Coach is thinking — click to open' : 'Ask the coach about this spot'}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-200 animate-pulse" />
          {coachStreaming ? 'Coach is thinking…' : 'Ask Coach'}
        </button>
      )}
    </div>
  )
}

export default function GamePage() {
  return (
    <SignInGate>
      <Suspense
        fallback={
          <div className="min-h-screen bg-underground flex items-center justify-center text-white">
            <div className="text-2xl font-semibold opacity-70">Loading...</div>
          </div>
        }
      >
        <GamePageInner />
      </Suspense>
    </SignInGate>
  )
}
