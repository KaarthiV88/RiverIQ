/** Frontend client for the /coach endpoints (Phase: Coach).
 *
 *  - `streamCoachReply` is an async generator that yields token deltas as the
 *    backend streams them. SSE is consumed via fetch + ReadableStream so we
 *    can POST a body (EventSource is GET-only).
 *  - `buildGameContext` adapts a live `GameState` into the payload shape the
 *    backend's `GameContext` model expects. Keeps the conversion in one place
 *    so the UI never has to know about the wire format.
 */

import { GameState } from '../types/poker'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

export interface CoachMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface CoachOpponent {
  name: string
  position: string
  chips: number
  current_bet: number
  status: string
  personality: string | null
}

export interface CoachHistoryEntry {
  street: string
  actor: string
  action: string
  amount: number
}

export interface CoachGameContext {
  hole_cards: string[]
  community_cards: string[]
  street: string
  pot: number
  current_bet: number
  min_raise: number
  big_blind: number
  my_position: string
  my_chips: number
  my_current_bet: number
  num_active: number
  opponents: CoachOpponent[]
  history: CoachHistoryEntry[]
}

/** Convert a live `GameState` into the backend's coach payload.
 *  Returns null if there's no human seat (defensive — shouldn't happen). */
export function buildGameContext(state: GameState): CoachGameContext | null {
  const human = state.players.find(p => p.isHuman)
  if (!human) return null

  return {
    hole_cards: human.holeCards,
    community_cards: state.communityCards,
    street: state.street,
    pot: state.pot,
    current_bet: state.currentBet,
    min_raise: state.minRaise,
    big_blind: 20,
    my_position: human.position,
    my_chips: human.chips,
    my_current_bet: human.currentBet,
    num_active: state.players.filter(p => p.status === 'active').length,
    opponents: state.players
      .filter(p => !p.isHuman)
      .map(p => ({
        name: p.name,
        position: p.position,
        chips: p.chips,
        current_bet: p.currentBet,
        status: p.status,
        personality: p.personality,
      })),
    history: state.handHistory.map(a => {
      const actor = state.players.find(p => p.id === a.playerId)
      const name = actor?.isHuman ? 'You' : (actor?.name ?? a.playerId)
      const pos = actor?.position ?? ''
      return {
        street: a.street,
        actor: pos ? `${name} (${pos})` : name,
        action: a.action,
        amount: a.amount,
      }
    }),
  }
}

/** Stream the coach's reply token-by-token. Yields deltas; the consumer is
 *  responsible for concatenating them into the assistant message buffer. */
export async function* streamCoachReply(
  messages: CoachMessage[],
  gameContext: CoachGameContext | null,
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_BASE}/coach/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, game_context: gameContext }),
    signal,
  })
  if (!res.ok || !res.body) {
    throw new Error(`Coach stream failed: ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by blank lines (\n\n). Pull complete events
    // out of the buffer one at a time; partial events stay buffered.
    let sep = buffer.indexOf('\n\n')
    while (sep !== -1) {
      const event = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      sep = buffer.indexOf('\n\n')

      if (!event.startsWith('data: ')) continue
      const payload = event.slice(6)
      if (payload === '[DONE]') return

      try {
        const parsed = JSON.parse(payload) as { delta?: string; error?: string }
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.delta) yield parsed.delta
      } catch (err) {
        if (err instanceof Error && err.message) throw err
        // Otherwise it's a JSON-parse failure on a partial chunk — drop it.
      }
    }
  }
}
