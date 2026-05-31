// Client for the RiverIQ FastAPI backend.
// In production the API base URL is set via NEXT_PUBLIC_API_BASE; in dev
// we default to localhost where `uvicorn app.main:app --reload` runs.

import { ActionType, BotDecision, Card, Position, Street } from '../types/poker'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

export interface BotDecisionRequest {
  hole_cards: Card[]
  community_cards: Card[]
  pot: number
  current_bet: number
  player_current_bet: number
  player_chips: number
  min_raise: number
  big_blind: number
  street: Street
  personality: string
  position: Position
  num_active: number
}

interface BotDecisionResponseRaw {
  action: string
  amount: number
}

export async function decideBotApi(req: BotDecisionRequest): Promise<BotDecision> {
  const res = await fetch(`${API_BASE}/bot/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    throw new Error(`/bot/decide returned ${res.status}`)
  }
  const data: BotDecisionResponseRaw = await res.json()
  return {
    action: data.action as ActionType,
    amount: data.amount,
  }
}
