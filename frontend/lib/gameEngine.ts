import { Card, GameState, Player, PlayerAction, ActionType, Street, Position, BotPersonality } from '../types/poker'

// ─── Constants ────────────────────────────────────────────────────────────────

const SMALL_BLIND = 10
const BIG_BLIND = 20
export const STARTING_CHIPS = 2000

// Pool of names. A random subset is shuffled per game so the same seat doesn't
// always show the same face. Mix of real pros + handles for flavor.
const BOT_NAME_POOL = [
  'P. Ivey', 'P. Hellmuth', 'D. Negreanu', 'T. Dwan', 'D. Brunson',
  'Tony G', 'Rampage', 'Wolfgang', 'V. Selbst', 'F. Galfond',
  'S. Polk', 'P. Antonius', 'L. Veldhuis', 'M. Mateos', 'J. Moneymaker',
  'C. Robl', 'S. Hua', 'JJ McNutt', 'Cardo', 'B. Slim',
  'A. Kuro', 'K. Riess', 'B. Holz', 'D. Cates',
]

function shuffleNames(): string[] {
  const arr = [...BOT_NAME_POOL]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const PERSONALITIES: BotPersonality[] = [
  'pro', 'tag', 'calling-station', 'lag', 'nit', 'maniac', 'home-game', 'gto-wizard',
]

// Position labels indexed [0] = dealer, [1] = SB, [2] = BB, ... going clockwise.
// Players who aren't in the hand are simply skipped, so the size key is
// "number of players in the hand" — not the table layout size.
const POSITIONS_BY_COUNT: Record<number, Position[]> = {
  2: ['BTN', 'BB'],                                 // heads-up: dealer is SB; we use 'BTN' label here
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
}

// Statuses that mean "won't be dealt cards next round."
function willPlayNextHand(p: Player): boolean {
  return p.chips > 0 && p.status !== 'sitting-out' && p.status !== 'busted'
}

// Was this player dealt into the current hand? (Used for showdown eligibility.)
function wasDealtIn(p: Player): boolean {
  return p.status !== 'sitting-out' && p.status !== 'busted'
}

// ─── Deck ─────────────────────────────────────────────────────────────────────

export function createDeck(): Card[] {
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
  const suits = ['h', 'd', 'c', 's']
  return ranks.flatMap(r => suits.map(s => `${r}${s}` as Card))
}

export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

// ─── Hand Evaluation ──────────────────────────────────────────────────────────

function rankValue(card: Card): number {
  const r = card[0]
  if (r === 'T') return 10
  if (r === 'J') return 11
  if (r === 'Q') return 12
  if (r === 'K') return 13
  if (r === 'A') return 14
  return parseInt(r)
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  return [
    ...combinations(rest, k - 1).map(c => [first, ...c]),
    ...combinations(rest, k),
  ]
}

function scoreFiveCards(cards: Card[]): number {
  const ranks = cards.map(rankValue).sort((a, b) => b - a)
  const suits = cards.map(c => c[1])
  const B = 15

  const isFlush = suits.every(s => s === suits[0])

  let isStraight = false
  let straightHigh = ranks[0]
  if (new Set(ranks).size === 5 && ranks[0] - ranks[4] === 4) isStraight = true
  if (JSON.stringify(ranks) === JSON.stringify([14, 5, 4, 3, 2])) {
    isStraight = true
    straightHigh = 5
  }

  const counts: Record<number, number> = {}
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1
  const grouped = Object.entries(counts)
    .map(([r, c]) => ({ rank: parseInt(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank)

  if (isFlush && isStraight) return 8 * B ** 5 + straightHigh
  if (grouped[0].count === 4)
    return 7 * B ** 5 + grouped[0].rank * B + grouped[1].rank
  if (grouped[0].count === 3 && grouped[1].count === 2)
    return 6 * B ** 5 + grouped[0].rank * B + grouped[1].rank
  if (isFlush)
    return 5 * B ** 5 + ranks[0] * B ** 4 + ranks[1] * B ** 3 + ranks[2] * B ** 2 + ranks[3] * B + ranks[4]
  if (isStraight) return 4 * B ** 5 + straightHigh
  if (grouped[0].count === 3)
    return 3 * B ** 5 + grouped[0].rank * B ** 2 + grouped[1].rank * B + grouped[2].rank
  if (grouped[0].count === 2 && grouped[1].count === 2)
    return 2 * B ** 5 + grouped[0].rank * B ** 2 + grouped[1].rank * B + grouped[2].rank
  if (grouped[0].count === 2)
    return 1 * B ** 5 + grouped[0].rank * B ** 4 + grouped[1].rank * B ** 3 + grouped[2].rank * B ** 2 + grouped[3].rank * B + (grouped[4]?.rank ?? 0)
  return ranks[0] * B ** 4 + ranks[1] * B ** 3 + ranks[2] * B ** 2 + ranks[3] * B + ranks[4]
}

export function getBestHandScore(holeCards: Card[], communityCards: Card[]): number {
  const all = [...holeCards, ...communityCards]
  return Math.max(...combinations(all, 5).map(scoreFiveCards))
}

// Category index (0–8) → name. Mirrors the tiers scored in scoreFiveCards.
const HAND_CATEGORY_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind',
  'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
]
const RANK_LABELS: Record<number, string> = {
  14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten',
  9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two',
}

// Human-readable name of a player's best five-card hand — e.g. "Flush",
// "Full House", "Ace high", "Royal Flush". Returns '' when fewer than five
// cards are available (an uncontested preflop win), where no hand is shown.
export function describeBestHand(holeCards: Card[], communityCards: Card[]): string {
  const all = [...holeCards, ...communityCards]
  if (all.length < 5) return ''
  const B = 15
  let bestScore = -1
  let bestCombo: Card[] = []
  for (const combo of combinations(all, 5)) {
    const s = scoreFiveCards(combo)
    if (s > bestScore) { bestScore = s; bestCombo = combo }
  }
  const category = Math.floor(bestScore / B ** 5)
  if (category === 0) {
    const high = Math.max(...bestCombo.map(rankValue))
    return `${RANK_LABELS[high]} high`
  }
  if (category === 8) {
    // straightHigh is the low-order part of the score; 14 ⇒ ace-high ⇒ royal.
    return bestScore - 8 * B ** 5 === 14 ? 'Royal Flush' : 'Straight Flush'
  }
  return HAND_CATEGORY_NAMES[category]
}

// ─── Navigation Helpers ───────────────────────────────────────────────────────

function getNextActiveIndex(players: Player[], from: number): number {
  const n = players.length
  let i = (from + 1) % n
  for (let step = 0; step < n; step++) {
    if (players[i].status === 'active') return i
    i = (i + 1) % n
  }
  return from
}

function getFirstPostFlopActor(players: Player[], dealerIndex: number): number {
  const n = players.length
  let i = (dealerIndex + 1) % n
  for (let step = 0; step < n; step++) {
    if (players[i].status === 'active') return i
    i = (i + 1) % n
  }
  return dealerIndex
}

function nextEligibleFrom(players: Player[], start: number): number {
  const n = players.length
  for (let step = 0; step < n; step++) {
    const i = (start + step) % n
    if (willPlayNextHand(players[i])) return i
  }
  return start
}

function activeCount(players: Player[]): number {
  return players.filter(p => p.status === 'active').length
}

function isBettingRoundComplete(state: GameState): boolean {
  const active = state.players.filter(p => p.status === 'active')
  if (active.length === 0) return true
  return active.every(
    p => state.actedThisStreet.includes(p.id) && p.currentBet === state.currentBet
  )
}

function reassignPositions(players: Player[], dealerIndex: number): Player[] {
  // Walk around the table starting at the dealer; assign positions to the
  // players who are in this hand (not busted, not sitting out).
  const n = players.length
  const inHandIndices: number[] = []
  for (let step = 0; step < n; step++) {
    const i = (dealerIndex + step) % n
    if (wasDealtIn(players[i])) inHandIndices.push(i)
  }
  const positions = POSITIONS_BY_COUNT[inHandIndices.length] ?? POSITIONS_BY_COUNT[6]
  return players.map((p, i) => {
    const slot = inHandIndices.indexOf(i)
    if (slot === -1) return p
    return { ...p, position: positions[slot] ?? p.position }
  })
}

// ─── Game Initialization ──────────────────────────────────────────────────────

export function initGame(
  tableSize: number,
  opponentPersonalities?: BotPersonality[]
): GameState {
  const assigned = opponentPersonalities ?? PERSONALITIES.slice(0, tableSize - 1)
  const positions = POSITIONS_BY_COUNT[tableSize] ?? POSITIONS_BY_COUNT[6]
  const names = shuffleNames()
  const players: Player[] = Array.from({ length: tableSize }, (_, i) => ({
    id: i === 0 ? 'human' : `bot-${i}`,
    name: i === 0 ? 'You' : (names[i - 1] ?? `Bot ${i}`),
    isHuman: i === 0,
    holeCards: [],
    chips: STARTING_CHIPS,
    currentBet: 0,
    totalBetThisHand: 0,
    status: 'active',
    position: positions[i] ?? 'BTN',
    personality: i === 0 ? null : (assigned[i - 1] ?? PERSONALITIES[(i - 1) % PERSONALITIES.length]),
    seatIndex: i,
  }))

  return {
    players,
    communityCards: [],
    pot: 0,
    street: 'preflop',
    phase: 'waiting',
    currentPlayerIndex: 0,
    dealerIndex: 0,
    smallBlindIndex: 1,
    bigBlindIndex: 2,
    currentBet: 0,
    minRaise: BIG_BLIND,
    handHistory: [],
    winners: [],
    tableSize,
    deck: [],
    actedThisStreet: [],
  }
}

// ─── Deal New Hand ────────────────────────────────────────────────────────────

export interface DealOptions {
  humanSittingOut?: boolean   // user pressed Stand: skip dealing them in
}

export function dealNewHand(state: GameState, opts: DealOptions = {}): GameState {
  const deck = shuffleDeck(createDeck())
  const n = state.players.length

  // Reset everyone for the new hand. `opts.humanSittingOut` is the
  // authoritative human state for the upcoming hand — it both sits them out
  // AND brings them back when toggled off, regardless of previous status.
  const refreshed: Player[] = state.players.map(p => {
    const base = { ...p, holeCards: [] as Card[], currentBet: 0, totalBetThisHand: 0 }
    if (p.chips <= 0) return { ...base, status: 'busted' as const }
    if (p.isHuman) {
      return { ...base, status: opts.humanSittingOut ? 'sitting-out' as const : 'active' as const }
    }
    return { ...base, status: 'active' as const }
  })

  // If the human just busted, end the game.
  const human = refreshed.find(p => p.isHuman)
  if (human && human.status === 'busted') {
    return { ...state, players: refreshed, phase: 'game-over' }
  }

  // If only one playable seat remains, end the game (game-over from the
  // human's perspective if they're it; otherwise still over since there's
  // no one to play against).
  const playable = refreshed.filter(willPlayNextHand)
  if (playable.length < 2) {
    return { ...state, players: refreshed, phase: 'game-over' }
  }

  // Rotate dealer to next eligible.
  const startFrom = state.phase === 'waiting' ? 0 : (state.dealerIndex + 1) % n
  const dealerIndex = nextEligibleFrom(refreshed, startFrom)
  const sbIndex = nextEligibleFrom(refreshed, (dealerIndex + 1) % n)
  const bbIndex = nextEligibleFrom(refreshed, (sbIndex + 1) % n)

  // Deal cards only to in-hand players.
  let deckCursor = 0
  let withCards: Player[] = refreshed.map(p => {
    if (!willPlayNextHand(p)) return p
    return { ...p, holeCards: [deck[deckCursor++], deck[deckCursor++]] as Card[], status: 'active' }
  })

  // Post blinds (clamp to chip stack — short stacks post less, go all-in).
  withCards = withCards.map((p, i) => {
    if (i === sbIndex) {
      const post = Math.min(SMALL_BLIND, p.chips)
      const status: Player['status'] = p.chips - post === 0 ? 'all-in' : 'active'
      return { ...p, chips: p.chips - post, currentBet: post, totalBetThisHand: post, status }
    }
    if (i === bbIndex) {
      const post = Math.min(BIG_BLIND, p.chips)
      const status: Player['status'] = p.chips - post === 0 ? 'all-in' : 'active'
      return { ...p, chips: p.chips - post, currentBet: post, totalBetThisHand: post, status }
    }
    return p
  })

  // Recompute positions based on who's actually in this hand.
  const positioned = reassignPositions(withCards, dealerIndex)

  const firstToAct = getNextActiveIndex(positioned, bbIndex)

  // Sum the blinds that were actually posted — a short stack posts less than a
  // full blind (and is all-in), so the pot can't assume SB+BB flat.
  const postedBlinds = positioned.reduce((sum, p) => sum + p.totalBetThisHand, 0)

  return {
    ...state,
    players: positioned,
    communityCards: [],
    pot: postedBlinds,
    street: 'preflop',
    phase: 'playing',
    currentPlayerIndex: firstToAct,
    dealerIndex,
    smallBlindIndex: sbIndex,
    bigBlindIndex: bbIndex,
    currentBet: BIG_BLIND,
    minRaise: BIG_BLIND,
    handHistory: [],
    winners: [],
    deck: deck.slice(deckCursor),
    actedThisStreet: [],
  }
}

// ─── Street Advancement ───────────────────────────────────────────────────────

const NEXT_STREET: Record<Street, Street> = {
  preflop: 'flop',
  flop: 'turn',
  turn: 'river',
  river: 'showdown',
  showdown: 'showdown',
}
const CARDS_TO_ADD: Record<string, number> = { preflop: 3, flop: 1, turn: 1 }

/** Deal the next street's cards. Determines if more betting is possible.
 *  Called explicitly by the page after the pacing buffer fires. */
export function advanceStreet(state: GameState): GameState {
  if (state.street === 'river') return determineWinners(state)

  const count = CARDS_TO_ADD[state.street] ?? 0
  const newCommunity = [...state.communityCards, ...state.deck.slice(0, count)] as Card[]
  const newDeck = state.deck.slice(count)
  const newStreet = NEXT_STREET[state.street]

  // Reset per-street state.
  const players = state.players.map(p => ({ ...p, currentBet: 0 }))

  const next: GameState = {
    ...state,
    players,
    communityCards: newCommunity,
    deck: newDeck,
    street: newStreet,
    currentBet: 0,
    minRaise: BIG_BLIND,
    actedThisStreet: [],
  }

  // If 2+ players can still act, normal betting round.
  if (activeCount(players) >= 2) {
    return {
      ...next,
      phase: 'playing',
      currentPlayerIndex: getFirstPostFlopActor(players, state.dealerIndex),
    }
  }

  // Otherwise no more betting this hand — keep the phase as between-streets
  // so the page schedules the next card after a pause. If we've already
  // reached the river with no possible action, go straight to showdown.
  if (newStreet === 'river') return determineWinners(next)
  return { ...next, phase: 'between-streets' }
}

// ─── Winner Determination ─────────────────────────────────────────────────────

interface SidePot {
  amount: number
  eligibleIds: string[]   // players who can win this layer: contributed to it AND not folded
}

/** Split every chip wagered this hand into a stack of pots, using each
 *  player's `totalBetThisHand` as their contribution.
 *
 *  Each distinct contribution level defines a layer. A layer's chips come from
 *  everyone who put in at least that much (folded players included — their
 *  chips are dead money), but only non-folded contributors are eligible to win
 *  it. A consequence that falls out for free: an all-in overbet nobody matched
 *  becomes a top layer with a single eligible player, i.e. the uncalled portion
 *  is returned to the bettor.
 */
function buildSidePots(players: Player[]): SidePot[] {
  const contributors = players.filter(p => wasDealtIn(p) && p.totalBetThisHand > 0)
  if (contributors.length === 0) return []

  const levels = Array.from(new Set(contributors.map(p => p.totalBetThisHand)))
    .sort((a, b) => a - b)

  const pots: SidePot[] = []
  let prev = 0
  for (const level of levels) {
    const atLeast = contributors.filter(p => p.totalBetThisHand >= level)
    const amount = (level - prev) * atLeast.length
    if (amount > 0) {
      const eligibleIds = atLeast.filter(p => p.status !== 'folded').map(p => p.id)
      pots.push({ amount, eligibleIds })
    }
    prev = level
  }
  return pots
}

export function determineWinners(state: GameState): GameState {
  const contested = state.players.filter(p => p.status !== 'folded' && wasDealtIn(p))

  // Uncontested — everyone else folded. The lone player scoops every wagered
  // chip (including dead money), no showdown required.
  if (contested.length <= 1) {
    const winner = contested[0]
    const players = winner
      ? state.players.map(p => (p.id === winner.id ? { ...p, chips: p.chips + state.pot } : p))
      : state.players
    return {
      ...state,
      players,
      winners: winner ? [winner.id] : [],
      street: 'showdown',
      phase: 'showdown',
    }
  }

  // Best 5-card score for each contender, computed once.
  const scoreById = new Map<string, number>()
  for (const p of contested) {
    scoreById.set(p.id, getBestHandScore(p.holeCards, state.communityCards))
  }
  const seatById = new Map(state.players.map(p => [p.id, p.seatIndex]))

  const payouts = new Map<string, number>()
  const winnerSet = new Set<string>()

  for (const pot of buildSidePots(state.players)) {
    // Only contenders (non-folded, dealt-in) can take a pot. In a real showdown
    // every layer has at least one; the guard is defensive against chip loss.
    const eligible = pot.eligibleIds.filter(id => scoreById.has(id))
    if (eligible.length === 0) continue

    const best = Math.max(...eligible.map(id => scoreById.get(id)!))
    const winners = eligible
      .filter(id => scoreById.get(id) === best)
      .sort((a, b) => (seatById.get(a)! - seatById.get(b)!))   // deterministic odd-chip order

    const share = Math.floor(pot.amount / winners.length)
    let remainder = pot.amount - share * winners.length        // odd chips: earliest seat first
    for (const id of winners) {
      const extra = remainder > 0 ? 1 : 0
      remainder -= extra
      payouts.set(id, (payouts.get(id) ?? 0) + share + extra)
      winnerSet.add(id)
    }
  }

  const players = state.players.map(p =>
    payouts.has(p.id) ? { ...p, chips: p.chips + payouts.get(p.id)! } : p
  )
  return { ...state, players, winners: [...winnerSet], street: 'showdown', phase: 'showdown' }
}

// ─── Process Action ───────────────────────────────────────────────────────────

export function processAction(state: GameState, action: ActionType, amount: number): GameState {
  const player = state.players[state.currentPlayerIndex]
  let pot = state.pot
  let currentBet = state.currentBet
  let minRaise = state.minRaise

  let updated: Player = { ...player }

  if (action === 'fold') {
    updated.status = 'folded'
  } else if (action === 'check') {
    // no chip movement
  } else if (action === 'call') {
    const callAmount = Math.min(currentBet - player.currentBet, player.chips)
    updated = { ...updated, chips: updated.chips - callAmount, currentBet: updated.currentBet + callAmount, totalBetThisHand: updated.totalBetThisHand + callAmount }
    pot += callAmount
    if (updated.chips === 0) updated.status = 'all-in'
  } else {
    const additional = Math.min(amount - player.currentBet, player.chips)
    const raise = (player.currentBet + additional) - currentBet
    minRaise = Math.max(raise, BIG_BLIND)
    currentBet = player.currentBet + additional
    updated = { ...updated, chips: updated.chips - additional, currentBet: currentBet, totalBetThisHand: updated.totalBetThisHand + additional }
    pot += additional
    if (updated.chips === 0) updated.status = 'all-in'
  }

  const players = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? updated : p
  )

  const historyEntry: PlayerAction = { playerId: player.id, action, amount, street: state.street }
  const actedThisStreet = [...state.actedThisStreet, player.id]

  const next: GameState = {
    ...state,
    players,
    pot,
    currentBet,
    minRaise,
    handHistory: [...state.handHistory, historyEntry],
    actedThisStreet,
  }

  // Only one player left → award pot immediately.
  if (players.filter(p => p.status !== 'folded' && wasDealtIn(p)).length === 1) {
    return determineWinners({ ...next, street: 'showdown', phase: 'showdown' })
  }

  // Betting round complete → enter the pacing buffer; page schedules advance.
  if (isBettingRoundComplete(next)) {
    if (next.street === 'river') return determineWinners(next)
    return { ...next, phase: 'between-streets' }
  }

  return { ...next, phase: 'playing', currentPlayerIndex: getNextActiveIndex(players, state.currentPlayerIndex) }
}
