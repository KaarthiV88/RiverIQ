import { Card as CardType } from '../types/poker'

interface CardProps {
  card?: CardType | null  // null/undefined => face down
  size?: 'sm' | 'md' | 'board' | 'lg' | 'xl'
}

// Convert internal card notation (e.g. "Ah", "Td") into the filename used by
// the SVG-cards-1.3 pack: "{rank}_of_{suit}.svg" with verbose rank/suit names.
const RANK_MAP: Record<string, string> = {
  A: 'ace',
  K: 'king',
  Q: 'queen',
  J: 'jack',
  T: '10',
  '9': '9', '8': '8', '7': '7', '6': '6',
  '5': '5', '4': '4', '3': '3', '2': '2',
}

const SUIT_MAP: Record<string, string> = {
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
  s: 'spades',
}

function toFilename(card: CardType): string {
  const rank = RANK_MAP[card[0]]
  const suit = SUIT_MAP[card[1]]
  return `${rank}_of_${suit}.svg`
}

const SIZES = {
  sm: 'w-10 h-14',
  md: 'w-14 h-20',
  board: 'w-[72px] h-[100px]',
  lg: 'w-20 h-28',
  xl: 'w-24 h-36',
}

export default function Card({ card, size = 'md' }: CardProps) {
  const sizeClass = SIZES[size]

  if (!card) {
    // Stylized card back — diagonal cross-hatch over a dark purple gradient
    // with a thin gold inner border. No SVG asset needed.
    return (
      <div
        className={`${sizeClass} rounded-lg shadow-lg overflow-hidden ring-1 ring-black/40 select-none relative`}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 4px, transparent 4px, transparent 10px),
              repeating-linear-gradient(-45deg, rgba(0,0,0,0.25) 0, rgba(0,0,0,0.25) 4px, transparent 4px, transparent 10px),
              linear-gradient(135deg, #6e3fcc 0%, #2e0c69 60%, #14062e 100%)
            `,
          }}
        />
        <div className="absolute inset-[6%] border border-amber-400/40 rounded-md" />
        <div className="absolute inset-[12%] border border-amber-400/20 rounded-sm" />
      </div>
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-lg shadow-lg bg-white overflow-hidden ring-1 ring-black/10 select-none`}
    >
      <img
        src={`/SVG-cards-1.3/${toFilename(card)}`}
        alt={card}
        className="w-full h-full object-contain block"
        draggable={false}
      />
    </div>
  )
}
