/** Hand-history API client.
 *
 *  Builds a `HandSummary` payload from a finished hand and POSTs it to the
 *  backend, which writes to Supabase. Also exposes a `listHands` reader for
 *  the history page.
 */

import { GameState, Player, PlayerAction } from '../types/poker'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

export interface OpponentSummary {
  name: string
  position: string
  personality: string | null
}

export interface ActionEntry {
  street: string
  actor_id: string
  actor_name: string
  position: string
  action: string
  amount: number
}

export interface HandSummaryPayload {
  user_id: string
  difficulty: string
  table_size: number
  position: string
  hole_cards: string[]
  board_cards: string[]
  pot_size: number
  hero_starting_chips: number
  hero_ending_chips: number
  won: boolean
  went_to_showdown: boolean
  street_reached: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
  opponents: OpponentSummary[]
  winners: string[]
  actions: ActionEntry[]
}

export interface StoredHand {
  id: string
  created_at: string
  difficulty: string
  table_size: number
  hole_cards: string[]
  board_cards: string[]
  position: string | null
  pot_size: number
  hero_starting_chips: number
  hero_ending_chips: number
  won: boolean
  went_to_showdown: boolean
  street_reached: string
  result: number
  winners: string[]
  opponents: { name: string; position: string; personality: string | null }[]
}

function streetFromBoard(n: number): HandSummaryPayload['street_reached'] {
  if (n >= 5) return 'river'
  if (n === 4) return 'turn'
  if (n === 3) return 'flop'
  return 'preflop'
}

export function buildHandSummary(
  state: GameState,
  userId: string,
  difficulty: string,
  startingChips: number,
): HandSummaryPayload | null {
  const human = state.players.find(p => p.isHuman)
  if (!human) return null

  // Hand-end eligibility: any player who wasn't folded AND was dealt in.
  const dealtIn = (p: Player) => p.status !== 'sitting-out' && p.status !== 'busted'
  const eligibleAtEnd = state.players.filter(p => p.status !== 'folded' && dealtIn(p))
  const wentToShowdown =
    eligibleAtEnd.length > 1 && eligibleAtEnd.some(p => p.id === human.id)

  const actions: ActionEntry[] = state.handHistory.map((a: PlayerAction) => {
    const actor = state.players.find(p => p.id === a.playerId)
    return {
      street: a.street,
      actor_id: a.playerId,
      actor_name: actor?.isHuman ? 'You' : (actor?.name ?? a.playerId),
      position: actor?.position ?? '',
      action: a.action,
      amount: a.amount,
    }
  })

  const winnerNames = state.winners
    .map(id => state.players.find(p => p.id === id)?.name ?? id)

  return {
    user_id: userId,
    difficulty,
    table_size: state.players.length,
    position: human.position,
    hole_cards: human.holeCards,
    board_cards: state.communityCards,
    pot_size: state.pot,
    hero_starting_chips: startingChips,
    hero_ending_chips: human.chips,
    won: state.winners.includes(human.id),
    went_to_showdown: wentToShowdown,
    street_reached: streetFromBoard(state.communityCards.length),
    opponents: state.players
      .filter(p => !p.isHuman)
      .map(p => ({ name: p.name, position: p.position, personality: p.personality })),
    winners: winnerNames,
    actions,
  }
}

export async function saveHand(payload: HandSummaryPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/history/hand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`saveHand failed: ${res.status}`)
  }
}

export async function listHands(userId: string, limit = 50): Promise<StoredHand[]> {
  const url = new URL(`${API_BASE}/history/hands`)
  url.searchParams.set('user_id', userId)
  url.searchParams.set('limit', String(limit))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`listHands failed: ${res.status}`)
  return res.json()
}

export async function deleteHands(userId: string): Promise<number> {
  const url = new URL(`${API_BASE}/history/hands`)
  url.searchParams.set('user_id', userId)
  const res = await fetch(url.toString(), { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteHands failed: ${res.status}`)
  const body = await res.json() as { deleted?: number }
  return body.deleted ?? 0
}
