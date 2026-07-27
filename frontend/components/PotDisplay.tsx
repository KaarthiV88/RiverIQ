import Chip, { CHIP_ORDER, CHIP_VALUES, ChipColor } from './Chip'

interface PotDisplayProps {
  amount: number
}

// The distinct chip denominations that make up the pot, highest value first
// (capped so the fan stays tidy). As the pot grows across streets, higher-value
// chips appear and lower ones drop off, so the sprite reflects the pot's size:
//   small pot → white/red   ·   big pot → green/black
function potChips(amount: number): ChipColor[] {
  const present: ChipColor[] = []
  let remaining = amount
  for (let i = CHIP_ORDER.length - 1; i >= 0; i--) {
    const color = CHIP_ORDER[i]
    const value = CHIP_VALUES[color]
    if (Math.floor(remaining / value) > 0) {
      present.push(color)
      remaining %= value
    }
  }
  return present.slice(0, 4)
}

export default function PotDisplay({ amount }: PotDisplayProps) {
  if (amount === 0) {
    return (
      <div className="text-white/40 text-base font-semibold tracking-wide">
        Pot: $0
      </div>
    )
  }

  const chips = potChips(amount)

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center -space-x-4">
        {chips.map((color, i) => (
          <Chip key={`${color}-${i}`} color={color} size="md" showValue={false} />
        ))}
      </div>
      <div className="bg-black/60 px-5 py-1.5 rounded-full shadow-lg border border-[rgba(184,150,104,0.4)]">
        <span className="text-[color:var(--brass)] text-xl font-extrabold tracking-tight">
          Pot: <span className="text-[color:var(--parchment)]">${amount.toLocaleString()}</span>
        </span>
      </div>
    </div>
  )
}
