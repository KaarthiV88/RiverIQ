import { Card, GameState, BotDecision, BotPersonality } from '../types/poker'
import { getBestHandScore } from './gameEngine'

// ─── Personality Parameters ───────────────────────────────────────────────────
//
// looseness  – additive modifier to perceived hand strength (more loose ⇒ plays more)
// aggression – probability of choosing a raise over a call when ahead

// Slimmed-down version of the Python personality profiles. The Python
// backend is authoritative; this exists so the game still runs if the
// API is unreachable. Same archetype names so behavior stays consistent.
const PERSONALITY_PARAMS: Record<BotPersonality, { looseness: number; aggression: number }> = {
  nit:               { looseness: -0.25, aggression: 0.30 },
  tag:               { looseness: -0.08, aggression: 0.70 },
  lag:               { looseness:  0.15, aggression: 0.85 },
  'calling-station': { looseness:  0.20, aggression: 0.10 },
  maniac:            { looseness:  0.25, aggression: 0.92 },
  'home-game':       { looseness:  0.12, aggression: 0.45 },
  pro:               { looseness:  0.00, aggression: 0.72 },
  'gto-wizard':      { looseness:  0.00, aggression: 0.65 },
}

// ─── Hand Strength Estimation ─────────────────────────────────────────────────

function rankValue(card: Card): number {
  const r = card[0]
  if (r === 'T') return 10
  if (r === 'J') return 11
  if (r === 'Q') return 12
  if (r === 'K') return 13
  if (r === 'A') return 14
  return parseInt(r)
}

function preflopStrength(holeCards: Card[]): number {
  const [c1, c2] = holeCards
  const r1 = rankValue(c1)
  const r2 = rankValue(c2)
  const high = Math.max(r1, r2)
  const low = Math.min(r1, r2)
  const isPair = r1 === r2
  const isSuited = c1[1] === c2[1]
  const gap = high - low

  if (isPair) {
    if (high >= 12) return 0.90   // QQ+
    if (high >= 10) return 0.75   // TT–JJ
    if (high >= 7)  return 0.55   // 77–99
    return 0.40                   // 22–66
  }

  let strength = (high + low) / 40         // base from card values
  if (isSuited) strength += 0.10
  if (gap === 1) strength += 0.05          // connected
  else if (gap >= 3) strength -= 0.05 * (gap - 2)
  if (high === 14) strength += 0.05        // ace-anything bonus

  return Math.max(0, Math.min(1, strength))
}

function postflopStrength(holeCards: Card[], communityCards: Card[]): number {
  const score = getBestHandScore(holeCards, communityCards)
  const B = 15
  const category = Math.floor(score / B ** 5)

  switch (category) {
    case 0: return 0.20  // high card
    case 1: return 0.45  // pair
    case 2: return 0.65  // two pair
    case 3: return 0.78  // trips
    case 4: return 0.85  // straight
    case 5: return 0.88  // flush
    case 6: return 0.94  // full house
    case 7: return 0.98  // quads
    case 8: return 0.99  // straight flush
    default: return 0.15
  }
}

// ─── Decision Engine ──────────────────────────────────────────────────────────

const IN_POSITION = new Set(['BTN', 'CO', 'HJ'])

function preflopOpenChance(strength: number, aggression: number): number {
  if (strength >= 0.85) return Math.min(1, aggression + 0.20)
  if (strength >= 0.65) return aggression
  if (strength >= 0.50) return aggression * 0.55
  if (strength >= 0.40) return aggression * 0.30
  if (strength >= 0.30) return aggression * 0.10
  return 0
}

export function decideBotAction(state: GameState): BotDecision {
  const bot = state.players[state.currentPlayerIndex]
  const personality = bot.personality
  if (!personality) {
    return { action: state.currentBet === bot.currentBet ? 'check' : 'fold', amount: 0 }
  }

  const { looseness, aggression } = PERSONALITY_PARAMS[personality]

  const callAmount = state.currentBet - bot.currentBet
  const potOdds = callAmount > 0 ? callAmount / (state.pot + callAmount) : 0
  const isPreflop = state.communityCards.length === 0

  const rawStrength = isPreflop
    ? preflopStrength(bot.holeCards)
    : postflopStrength(bot.holeCards, state.communityCards)

  let strength = rawStrength + looseness
  strength += (Math.random() - 0.5) * 0.10

  const minRaiseTotal = state.currentBet + state.minRaise
  const maxCommit = bot.chips + bot.currentBet
  const canRaise = maxCommit >= minRaiseTotal
  const inPosition = IN_POSITION.has(bot.position)

  // ── No bet to call ────────────────────────────────────────────────
  if (callAmount === 0) {
    // Slow-play monster postflop hands sometimes
    if (!isPreflop && rawStrength >= 0.94 && aggression >= 0.65 && Math.random() < 0.35) {
      return { action: 'check', amount: 0 }
    }

    // In-position stab when checked around (aggressive personalities only)
    if (!isPreflop && inPosition && state.pot > 0 && aggression >= 0.70) {
      const stabChance = 0.45 + 0.20 * (aggression - 0.70)
      if (Math.random() < stabChance && canRaise) {
        const size = Math.floor(state.pot * (0.55 + Math.random() * 0.35))
        const finalBet = Math.max(minRaiseTotal, Math.min(size + state.currentBet, maxCommit))
        return { action: 'raise', amount: finalBet }
      }
    }

    if (isPreflop) {
      if (canRaise && Math.random() < preflopOpenChance(strength, aggression)) {
        const size = Math.floor(20 * 2.8)  // ~2.8 BB open
        const finalBet = Math.max(minRaiseTotal, Math.min(size, maxCommit))
        return { action: 'raise', amount: finalBet }
      }
      return { action: 'check', amount: 0 }
    }

    if (strength > 0.65 && Math.random() < aggression && canRaise) {
      const betSize = Math.floor(state.pot * (0.5 + Math.random() * 0.5))
      const finalBet = Math.max(minRaiseTotal, Math.min(betSize + state.currentBet, maxCommit))
      return { action: 'raise', amount: finalBet }
    }
    return { action: 'check', amount: 0 }
  }

  // ── Facing a bet ──────────────────────────────────────────────────
  // Check-raise / trap with a true monster
  if (!isPreflop && rawStrength >= 0.94) {
    if (Math.random() < 0.65 && canRaise) {
      const size = Math.floor(state.currentBet * 3.0 + state.pot * 0.6)
      const finalRaise = Math.max(minRaiseTotal, Math.min(size, maxCommit))
      return { action: 'raise', amount: finalRaise }
    }
    return { action: 'call', amount: callAmount }
  }

  if (strength < potOdds * 1.2) {
    return { action: 'fold', amount: 0 }
  }

  if (strength > 0.75 && Math.random() < aggression && canRaise) {
    const raiseSize = Math.floor(state.currentBet * 2.5 + state.pot * 0.3)
    const finalRaise = Math.max(minRaiseTotal, Math.min(raiseSize, maxCommit))
    return { action: 'raise', amount: finalRaise }
  }

  return { action: 'call', amount: callAmount }
}
