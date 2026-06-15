/** Stats + leak API client. */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

export interface PositionStats {
  position: string
  hands: number
  vpip: number | null
  pfr: number | null
}

export interface Stats {
  hands_played: number
  hands_won: number
  net_chips: number
  vpip: number | null
  pfr: number | null
  three_bet: number | null
  fold_to_three_bet: number | null
  cbet_flop: number | null
  wtsd: number | null
  wsd: number | null
  af_flop: number | null
  af_turn: number | null
  af_river: number | null
  per_position: PositionStats[]
  sample_sizes: Record<string, number>
}

export interface Finding {
  metric: string
  label: string
  value: number | null
  sample_size: number
  severity: 'good' | 'watch' | 'leak' | 'insufficient'
  benchmark_low: number | null
  benchmark_high: number | null
  explanation: string
}

export async function fetchStats(userId: string, limit = 200): Promise<Stats> {
  const url = new URL(`${API_BASE}/history/stats`)
  url.searchParams.set('user_id', userId)
  url.searchParams.set('limit', String(limit))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`stats failed: ${res.status}`)
  return res.json()
}

export async function fetchLeaks(userId: string, limit = 200): Promise<Finding[]> {
  const url = new URL(`${API_BASE}/history/leaks`)
  url.searchParams.set('user_id', userId)
  url.searchParams.set('limit', String(limit))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`leaks failed: ${res.status}`)
  return res.json()
}
