import { BotPersonality } from '../types/poker'

export interface Difficulty {
  id: 'home-game' | 'easy' | 'medium' | 'hard'
  name: string
  tagline: string
  description: string
  // Allowed personalities at this difficulty, with a "weight" giving how
  // often each one shows up. The composition is rolled fresh every game.
  weights: Partial<Record<BotPersonality, number>>
  // Optional hard caps so we don't accidentally get e.g. two GTO wizards at
  // a home game. Missing key = no cap.
  caps?: Partial<Record<BotPersonality, number>>
  accent: string
}

export const DIFFICULTIES: Difficulty[] = [
  {
    id: 'home-game',
    name: 'Home Game',
    tagline: 'Friday night with friends',
    description:
      'Loose passive table. Lots of limping, lots of chasing, plenty of action. Beatable with patience.',
    weights: {
      'home-game': 6,
      'calling-station': 3,
      'maniac': 2,
      'pro': 1,
    },
    caps: { 'pro': 1 },
    accent: 'from-orange-500 to-amber-700',
  },
  {
    id: 'easy',
    name: 'Easy',
    tagline: 'Low-stakes grind',
    description:
      'Fish-heavy pool with a couple of regs. Print money by playing solid value-heavy poker.',
    weights: {
      'home-game': 4,
      'calling-station': 4,
      'maniac': 2,
      'tag': 2,
      'nit': 1,
    },
    accent: 'from-emerald-500 to-teal-700',
  },
  {
    id: 'medium',
    name: 'Medium',
    tagline: 'Mid-stakes mix',
    description:
      'One of everything — a fish, a reg, a maniac, a nit, and someone who knows what they\'re doing.',
    weights: {
      'home-game': 2,
      'calling-station': 2,
      'maniac': 2,
      'lag': 2,
      'tag': 3,
      'nit': 2,
      'pro': 2,
    },
    caps: { 'pro': 2 },
    accent: 'from-sky-500 to-blue-700',
  },
  {
    id: 'hard',
    name: 'Hard',
    tagline: 'Tough cash game',
    description:
      'Mostly winning regs. One bad spot can cost you the session. Find a small edge or get ground down.',
    weights: {
      'calling-station': 1,
      'lag': 3,
      'tag': 4,
      'nit': 3,
      'pro': 3,
      'gto-wizard': 2,
    },
    caps: { 'calling-station': 1, 'gto-wizard': 2 },
    accent: 'from-fuchsia-500 to-purple-700',
  },
]

function weightedPick<T extends string>(weights: Partial<Record<T, number>>, banned: Set<T>): T | null {
  const entries = (Object.entries(weights) as [T, number][])
    .filter(([k]) => !banned.has(k))
  if (entries.length === 0) return null
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [k, w] of entries) {
    r -= w
    if (r <= 0) return k
  }
  return entries[entries.length - 1][0]
}

/** Sample N opponent personalities for a given difficulty.
 *  Each personality is drawn independently from the difficulty's weighted
 *  distribution, but capped: once an archetype hits its cap, it gets banned
 *  from further picks. Result is controlled randomness — the mix changes
 *  every game but always respects the difficulty's character.
 */
export function generateOpponents(difficultyId: string, count: number): BotPersonality[] {
  const diff = DIFFICULTIES.find(d => d.id === difficultyId) ?? DIFFICULTIES[0]
  const counts: Partial<Record<BotPersonality, number>> = {}
  const banned = new Set<BotPersonality>()
  const result: BotPersonality[] = []

  for (let i = 0; i < count; i++) {
    const pick = weightedPick<BotPersonality>(diff.weights, banned)
    if (pick === null) break
    result.push(pick)
    counts[pick] = (counts[pick] ?? 0) + 1
    const cap = diff.caps?.[pick]
    if (cap !== undefined && (counts[pick] ?? 0) >= cap) banned.add(pick)
  }
  // Failsafe in case caps starve the pool — pad with home-game.
  while (result.length < count) result.push('home-game')
  return result
}

/** Random table size 5–9 for the upcoming game. */
export function randomTableSize(min = 5, max = 9): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function getDifficulty(id: string): Difficulty {
  return DIFFICULTIES.find(d => d.id === id) ?? DIFFICULTIES[0]
}

export const PERSONALITY_LABEL: Record<BotPersonality, string> = {
  'nit': 'Nit',
  'tag': 'TAG',
  'lag': 'LAG',
  'calling-station': 'Station',
  'maniac': 'Maniac',
  'home-game': 'Home game',
  'pro': 'Pro',
  'gto-wizard': 'GTO wizard',
}
