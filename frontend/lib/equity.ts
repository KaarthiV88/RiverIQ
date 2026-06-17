/** Hero-equity API client.
 *
 *  Calls the backend's cached Monte Carlo (the same one the LLM coach uses
 *  internally) so the HUD callout shows the AI's actual calculation, not a
 *  client-side approximation. */

import { Card } from '../types/poker'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

interface HeroEquityResponse { equity: number }

export async function fetchHeroEquity(
  hole: Card[],
  board: Card[],
  numOpps: number,
  signal?: AbortSignal,
): Promise<number> {
  if (hole.length !== 2 || numOpps < 1) throw new Error('invalid equity request')
  const url = new URL(`${API_BASE}/equity/hero`)
  url.searchParams.set('hole', hole.join(','))
  url.searchParams.set('board', board.join(','))
  url.searchParams.set('num_opps', String(numOpps))
  const res = await fetch(url.toString(), { signal })
  if (!res.ok) throw new Error(`hero equity failed: ${res.status}`)
  const data = (await res.json()) as HeroEquityResponse
  return data.equity
}
