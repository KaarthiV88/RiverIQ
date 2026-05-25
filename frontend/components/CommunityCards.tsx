import { CSSProperties } from 'react'
import { Card as CardType } from '../types/poker'
import Card from './Card'

interface CommunityCardsProps {
  cards: CardType[]
}

// Board cards are size="md" (w-14 h-20 = 56×80) — smaller than hole cards.
// Layout is [Deck] [Slot1] [Slot2] [Slot3] [Slot4] [Slot5]. Each new board
// card slides out of the deck position and flips face-up as it travels.
const CARD_W = 56   // w-14
const GAP = 8       // gap-2
const STEP = CARD_W + GAP

export default function CommunityCards({ cards }: CommunityCardsProps) {
  return (
    <div className="flex gap-2 justify-center items-center">
      {/* Deck stack — a small visual pile of face-down cards. Source of all
          board cards in the dealing animation. */}
      <div className="relative w-14 h-20">
        <div
          className="absolute inset-0"
          style={{ transform: 'translate(-3px, -3px)', opacity: 0.7 }}
        >
          <Card size="md" />
        </div>
        <div
          className="absolute inset-0"
          style={{ transform: 'translate(-1.5px, -1.5px)', opacity: 0.85 }}
        >
          <Card size="md" />
        </div>
        <div className="absolute inset-0">
          <Card size="md" />
        </div>
      </div>

      {/* Five community slots. */}
      {Array.from({ length: 5 }).map((_, i) => {
        if (!cards[i]) {
          return (
            <div
              key={`slot-${i}`}
              className="w-14 h-20 rounded-lg border-2 border-dashed border-white/15"
            />
          )
        }

        // Flop is staggered (0, 1, 2 mount simultaneously); turn/river fire alone.
        const isFlop = i < 3
        // Distance back to the deck position: (i + 1) slots to the left.
        const fromX = -(i + 1) * STEP
        const delay = isFlop ? i * 400 : 0
        // Top of the deck stack should be the card that flies out first.
        const zIndex = isFlop ? 3 - i : 0

        return (
          <div
            key={`card-${cards[i]}`}
            className="card-flip-container w-14 h-20"
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
                <Card size="md" />
              </div>
              <div className="card-flip-face">
                <Card card={cards[i]} size="md" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
