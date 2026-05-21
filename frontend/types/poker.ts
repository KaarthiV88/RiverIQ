export type Suit = 'h' | 'd' | 'c' | 's'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A'
export type Card = `${Rank}${Suit}`

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export type GamePhase = 'waiting' | 'playing' | 'showdown'
export type PlayerStatus = 'active' | 'folded' | 'all-in'
export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'bet'
export type Position = 'BTN' | 'SB' | 'BB' | 'UTG' | 'UTG+1' | 'UTG+2' | 'LJ' | 'HJ' | 'CO'
export type BotPersonality = 'tight-passive' | 'tight-aggressive' | 'loose-passive' | 'loose-aggressive'

export interface Player {
  id: string
  name: string
  isHuman: boolean
  holeCards: Card[]
  chips: number
  currentBet: number
  totalBetThisHand: number
  status: PlayerStatus
  position: Position
  personality: BotPersonality | null  // null for human player
  seatIndex: number                   // 0–8, fixed seat position on table
}

export interface PlayerAction {
  playerId: string
  action: ActionType
  amount: number
  street: Street
}

export interface GameState {
  players: Player[]
  communityCards: Card[]
  pot: number
  street: Street
  phase: GamePhase
  currentPlayerIndex: number
  dealerIndex: number
  smallBlindIndex: number
  bigBlindIndex: number
  currentBet: number
  minRaise: number
  handHistory: PlayerAction[]
  winners: string[]               // player ids
  tableSize: number               // 6–9
  deck: Card[]                    // remaining cards in play
  actedThisStreet: string[]       // player ids who have voluntarily acted this street
}

export interface EquityResult {
  playerId: string
  equity: number
}

export interface BotDecision {
  action: ActionType
  amount: number
}
