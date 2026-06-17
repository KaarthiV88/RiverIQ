import Chip, { ChipColor } from './Chip'

/** Greedy denomination breakdown ($500/$100/$25/$5/$1), capped so the visual
 *  stack never exceeds ~6 chips — past that it stops reading as a stack. */
function breakdown(amount: number, maxChips = 6): ChipColor[] {
  const denoms: [ChipColor, number][] = [
    ['black', 500],
    ['green', 100],
    ['blue', 25],
    ['red', 5],
    ['white', 1],
  ]
  const out: ChipColor[] = []
  let r = Math.max(0, Math.floor(amount))
  for (const [color, value] of denoms) {
    while (r >= value && out.length < maxChips) {
      out.push(color)
      r -= value
    }
  }
  // `out` is ordered highest → lowest. We render with i=0 at the visual
  // bottom (lowest `bottom` offset), so the natural order already puts the
  // largest denomination at the bottom of the stack, with smaller chips
  // riding on top — same way a player builds a real stack.
  return out
}

interface BetStackProps {
  amount: number
}

const STEP_PX = 5  // vertical offset between stacked chips — small enough that
                   // the dashed edges read as side-stripes, big enough to count

export default function BetStack({ amount }: BetStackProps) {
  if (amount <= 0) return null
  const chips = breakdown(amount)
  const stackHeightPx = 24 + (chips.length - 1) * STEP_PX  // chip + offsets

  return (
    <div className="flex items-center gap-2 z-10">
      <div className="bet-stack" style={{ height: stackHeightPx }}>
        {chips.map((color, i) => (
          <div key={i} className="chip-rung" style={{ bottom: i * STEP_PX }}>
            <Chip color={color} size="sm" showValue={false} />
          </div>
        ))}
      </div>
      <div className="bet-tag">
        <span className="bet-currency">$</span>
        <span className="bet-amount">{amount.toLocaleString()}</span>
      </div>
    </div>
  )
}
