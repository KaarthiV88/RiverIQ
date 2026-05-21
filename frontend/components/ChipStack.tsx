import Chip, { CHIP_VALUES, CHIP_ORDER, ChipColor } from './Chip'

interface ChipStackProps {
  amount: number
  size?: 'sm' | 'md' | 'lg'
}

// Greedy breakdown into chip denominations, highest first.
// Caps each denomination at 4 visible chips so the stack stays compact.
function breakdown(amount: number): { color: ChipColor; count: number }[] {
  const result: { color: ChipColor; count: number }[] = []
  let remaining = amount
  for (let i = CHIP_ORDER.length - 1; i >= 0; i--) {
    const color = CHIP_ORDER[i]
    const value = CHIP_VALUES[color]
    const raw = Math.floor(remaining / value)
    if (raw === 0) continue
    const visible = Math.min(raw, 4)
    result.push({ color, count: visible })
    remaining -= raw * value
  }
  return result
}

export default function ChipStack({ amount, size = 'sm' }: ChipStackProps) {
  if (amount === 0) {
    return <div className="text-xs text-white/50 font-semibold">$0</div>
  }

  const stacks = breakdown(amount)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-end gap-1">
        {stacks.map(({ color, count }) => (
          <div key={color} className="relative" style={{ height: `${(count - 1) * 4 + 32}px` }}>
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="absolute left-0"
                style={{ bottom: `${i * 4}px` }}
              >
                <Chip color={color} size={size} showValue={i === count - 1} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="text-xs text-white font-bold tracking-tight">${amount}</div>
    </div>
  )
}
