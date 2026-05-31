import { CSSProperties } from 'react'
import { Card as CardType } from '../types/poker'
import Card from './Card'

interface CommunityCardsProps {
  cards: CardType[]
}

// Board cards use the new "board" size (72×100) — bigger than md, a touch
// smaller than the hole-card "lg" so the pot can grow alongside them.
const CARD_W = 72
const GAP = 10
const STEP = CARD_W + GAP

export default function CommunityCards({ cards }: CommunityCardsProps) {
  return (
    <div className="flex gap-2.5 justify-center items-center">
      <div className="relative w-[72px] h-[100px]">
        <div className="absolute inset-0" style={{ transform: 'translate(-3px, -3px)', opacity: 0.7 }}>
          <Card size="board" />
        </div>
        <div className="absolute inset-0" style={{ transform: 'translate(-1.5px, -1.5px)', opacity: 0.85 }}>
          <Card size="board" />
        </div>
        <div className="absolute inset-0">
          <Card size="board" />
        </div>
      </div>

      {Array.from({ length: 5 }).map((_, i) => {
        if (!cards[i]) {
          return (
            <div
              key={`slot-${i}`}
              className="w-[72px] h-[100px] rounded-lg border-2 border-dashed border-white/15"
            />
          )
        }

        const isFlop = i < 3
        const fromX = -(i + 1) * STEP
        const delay = isFlop ? i * 400 : 0
        const zIndex = isFlop ? 3 - i : 0

        return (
          <div
            key={`card-${cards[i]}`}
            className="card-flip-container w-[72px] h-[100px]"
            style={{ perspective: '1000px', zIndex } as CSSProperties}
          >
            <div
              className="card-flip-inner"
              style={
                {
                  '--from-x': `${fromX}px`,
                  animationDelay: `${delay}ms`,
                } as CSSProperties
              }
            >
              <div className="card-flip-back">
                <Card size="board" />
              </div>
              <div className="card-flip-face">
                <Card card={cards[i]} size="board" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
