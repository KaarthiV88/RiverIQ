import { Card, GameState, Player, PlayerAction, ActionType, Street, Position, BotPersonality } from '../types/poker'

// ─── Constants ────────────────────────────────────────────────────────────────

const SMALL_BLIND = 10
const BIG_BLIND = 20
export const STARTING_CHIPS = 2000

const BOT_NAMES = ['P. Ivey', 'P. Hellmuth', 'D. Negreanu', 'T. Dwan', 'D. Brunson', 'Tony G', 'Rampage', 'Wolfgang']

const PERSONALITIES: BotPersonality[] = [
  'tight-passive', 'tight-aggressive', 'loose-passive', 'loose-aggressive',
  'tight-passive', 'tight-aggressive', 'loose-passive', 'loose-aggressive',
]

// Positions listed clockwise from BTN (index 0 = BTN)
const POSITIONS_BY_SIZE: Record<number, Position[]> = {
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
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

// Returns a score where higher = better hand
function scoreFiveCards(cards: Card[]): number {
  const ranks = cards.map(rankValue).sort((a, b) => b - a)
  const suits = cards.map(c => c[1])
  const B = 15  // base — max card rank is 14

  const isFlush = suits.every(s => s === suits[0])

  let isStraight = false
  let straightHigh = ranks[0]
  if (new Set(ranks).size === 5 && ranks[0] - ranks[4] === 4) isStraight = true
  // Wheel: A-2-3-4-5
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

// ─── Navigation Helpers ───────────────────────────────────────────────────────

function getNextActiveIndex(players: Player[], from: number): number {
  const n = players.length
  let i = (from + 1) % n
  while (i !== from) {
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

function isBettingRoundComplete(state: GameState): boolean {
  const active = state.players.filter(p => p.status === 'active')
  return active.every(
    p => state.actedThisStreet.includes(p.id) && p.currentBet === state.currentBet
  )
}

// ─── Game Initialization ──────────────────────────────────────────────────────

export function initGame(tableSize: number): GameState {
  const positions = POSITIONS_BY_SIZE[tableSize]
  const players: Player[] = Array.from({ length: tableSize }, (_, i) => ({
    id: i === 0 ? 'human' : `bot-${i}`,
    name: i === 0 ? 'You' : BOT_NAMES[i - 1],
    isHuman: i === 0,
    holeCards: [],
    chips: STARTING_CHIPS,
    currentBet: 0,
    totalBetThisHand: 0,
    status: 'active',
    position: positions[i],
    personality: i === 0 ? null : PERSONALITIES[i - 1],
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

export function dealNewHand(state: GameState): GameState {
  const deck = shuffleDeck(createDeck())
  const n = state.tableSize

  const dealerIndex = state.phase === 'waiting' ? 0 : (state.dealerIndex + 1) % n
  const sbIndex = (dealerIndex + 1) % n
  const bbIndex = (dealerIndex + 2) % n
  const firstToAct = (bbIndex + 1) % n

  const positions = POSITIONS_BY_SIZE[n]

  let deckCursor = 0
  const players: Player[] = state.players.map((p, i) => {
    const relPos = (i - dealerIndex + n) % n
    return {
      ...p,
      holeCards: [deck[deckCursor++], deck[deckCursor++]] as Card[],
      currentBet: 0,
      totalBetThisHand: 0,
      status: 'active',
      position: positions[relPos],
    }
  })

  // Post blinds immutably
  const withBlinds = players.map((p, i) => {
    if (i === sbIndex) return { ...p, chips: p.chips - SMALL_BLIND, currentBet: SMALL_BLIND, totalBetThisHand: SMALL_BLIND }
    if (i === bbIndex) return { ...p, chips: p.chips - BIG_BLIND, currentBet: BIG_BLIND, totalBetThisHand: BIG_BLIND }
    return p
  })

  return {
    ...state,
    players: withBlinds,
    communityCards: [],
    pot: SMALL_BLIND + BIG_BLIND,
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

export function advanceStreet(state: GameState): GameState {
  const streetOrder: Street[] = ['preflop', 'flop', 'turn', 'river']
  const nextStreetMap: Record<string, Street> = {
    preflop: 'flop',
    flop: 'turn',
    turn: 'river',
    river: 'showdown',
  }
  const cardsToAdd: Record<string, number> = { preflop: 3, flop: 1, turn: 1 }

  if (state.street === 'river') return determineWinners(state)

  const count = cardsToAdd[state.street]
  const newCommunity = [...state.communityCards, ...state.deck.slice(0, count)] as Card[]
  const newDeck = state.deck.slice(count)
  const newStreet = nextStreetMap[state.street]

  const players = state.players.map(p => ({ ...p, currentBet: 0 }))
  const firstToAct = getFirstPostFlopActor(players, state.dealerIndex)

  return {
    ...state,
    players,
    communityCards: newCommunity,
    deck: newDeck,
    street: newStreet,
    currentBet: 0,
    minRaise: BIG_BLIND,
    actedThisStreet: [],
    currentPlayerIndex: firstToAct,
  }
}

// ─── Winner Determination ─────────────────────────────────────────────────────

export function determineWinners(state: GameState): GameState {
  const eligible = state.players.filter(p => p.status !== 'folded')

  if (eligible.length === 1) {
    const winner = eligible[0]
    const players = state.players.map(p =>
      p.id === winner.id ? { ...p, chips: p.chips + state.pot } : p
    )
    return { ...state, players, winners: [winner.id], street: 'showdown', phase: 'showdown' }
  }

  const scored = eligible.map(p => ({
    id: p.id,
    score: getBestHandScore(p.holeCards, state.communityCards),
  }))
  const best = Math.max(...scored.map(s => s.score))
  const winnerIds = scored.filter(s => s.score === best).map(s => s.id)
  const share = Math.floor(state.pot / winnerIds.length)

  const players = state.players.map(p =>
    winnerIds.includes(p.id) ? { ...p, chips: p.chips + share } : p
  )
  return { ...state, players, winners: winnerIds, street: 'showdown', phase: 'showdown' }
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
    // raise or bet — `amount` is the total the player wants to have bet this street
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

  // Only one player left — hand is over
  if (players.filter(p => p.status !== 'folded').length === 1) {
    return determineWinners({ ...next, street: 'showdown', phase: 'showdown' })
  }

  if (isBettingRoundComplete(next)) return advanceStreet(next)

  return { ...next, currentPlayerIndex: getNextActiveIndex(players, state.currentPlayerIndex) }
}
