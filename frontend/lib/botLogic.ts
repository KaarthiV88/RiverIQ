import { Card, GameState, BotDecision, BotPersonality } from '../types/poker'
import { getBestHandScore } from './gameEngine'

// ─── Personality Parameters ───────────────────────────────────────────────────
//
// looseness  – additive modifier to perceived hand strength (more loose ⇒ plays more)
// aggression – probability of choosing a raise over a call when ahead

const PERSONALITY_PARAMS: Record<BotPersonality, { looseness: number; aggression: number }> = {
  'tight-passive':    { looseness: -0.10, aggression: 0.10 },
  'tight-aggressive': { looseness: -0.10, aggression: 0.60 },
  'loose-passive':    { looseness:  0.15, aggression: 0.15 },
  'loose-aggressive': { looseness:  0.15, aggression: 0.65 },
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

export function decideBotAction(state: GameState): BotDecision {
  const bot = state.players[state.currentPlayerIndex]
  const personality = bot.personality
  if (!personality) {
    // Safety: human shouldn't be calling this. Default to check/fold.
    return { action: state.currentBet === bot.currentBet ? 'check' : 'fold', amount: 0 }
  }

  const { looseness, aggression } = PERSONALITY_PARAMS[personality]

  const callAmount = state.currentBet - bot.currentBet
  const potOdds = callAmount > 0 ? callAmount / (state.pot + callAmount) : 0

  let strength =
    state.communityCards.length === 0
      ? preflopStrength(bot.holeCards)
      : postflopStrength(bot.holeCards, state.communityCards)

  strength += looseness
  strength += (Math.random() - 0.5) * 0.10  // a bit of noise so bots aren't deterministic

  // No bet to call → check or bet for value
  if (callAmount === 0) {
    if (strength > 0.65 && Math.random() < aggression) {
      const betSize = Math.floor(state.pot * (0.5 + Math.random() * 0.5))
      const finalBet = Math.max(state.minRaise, Math.min(betSize, bot.chips + bot.currentBet))
      return { action: 'raise', amount: finalBet }
    }
    return { action: 'check', amount: 0 }
  }

  // Facing a bet → fold, call, or raise
  if (strength < potOdds * 1.2) {
    return { action: 'fold', amount: 0 }
  }

  if (strength > 0.75 && Math.random() < aggression) {
    const minRaiseTotal = state.currentBet + state.minRaise
    const raiseSize = Math.floor(state.currentBet * 2.5 + state.pot * 0.3)
    const finalRaise = Math.max(minRaiseTotal, Math.min(raiseSize, bot.chips + bot.currentBet))

    if (bot.chips + bot.currentBet >= minRaiseTotal) {
      return { action: 'raise', amount: finalRaise }
    }
  }

  return { action: 'call', amount: callAmount }
}
