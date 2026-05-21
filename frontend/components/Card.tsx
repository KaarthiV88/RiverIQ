import { Card as CardType } from '../types/poker'

interface CardProps {
  card?: CardType | null  // null/undefined => face down
  size?: 'sm' | 'md' | 'lg'
}

// Convert our internal card notation (e.g. "Ah", "Td") into the SVG filename used in /public/cards.
// Card pack uses: A/2-10/J/Q/K + C/D/H/S, where "T" → "10".
function toFilename(card: CardType): string {
  const rankChar = card[0]
  const suitChar = card[1].toUpperCase()
  const rank = rankChar === 'T' ? '10' : rankChar
  return `${rank}${suitChar}.svg`
}

const SIZES = {
  sm: 'w-10 h-14',
  md: 'w-14 h-20',
  lg: 'w-20 h-28',
}

export default function Card({ card, size = 'md' }: CardProps) {
  const sizeClass = SIZES[size]
  const src = card ? `/cards/${toFilename(card)}` : '/cards/1B.svg'
  const alt = card ?? 'card back'

  return (
    <img
      src={src}
      alt={alt}
      className={`${sizeClass} rounded-md shadow-md select-none`}
      draggable={false}
    />
  )
}
