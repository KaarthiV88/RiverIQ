export type ChipColor = 'white' | 'red' | 'blue' | 'green' | 'black'

export const CHIP_VALUES: Record<ChipColor, number> = {
  white: 1,
  red:   5,
  blue:  25,
  green: 100,
  black: 500,
}

// Ordered lowest → highest for breakdown logic.
export const CHIP_ORDER: ChipColor[] = ['white', 'red', 'blue', 'green', 'black']

// Pick the chip denomination that best represents a given amount.
export function chipColorFor(amount: number): ChipColor {
  if (amount >= 500) return 'black'
  if (amount >= 100) return 'green'
  if (amount >= 25)  return 'blue'
  if (amount >= 5)   return 'red'
  return 'white'
}

const STYLES: Record<ChipColor, { face: string; edge: string; text: string }> = {
  white: { face: 'bg-white',       edge: 'border-blue-900', text: 'text-gray-800' },
  red:   { face: 'bg-rose-600',    edge: 'border-white',    text: 'text-white' },
  blue:  { face: 'bg-blue-900',    edge: 'border-white',    text: 'text-white' },
  green: { face: 'bg-emerald-600', edge: 'border-white',    text: 'text-white' },
  black: { face: 'bg-gray-900',    edge: 'border-white',    text: 'text-white' },
}

const SIZES = {
  sm: 'w-6 h-6 text-[9px] border-[1.5px]',
  md: 'w-8 h-8 text-[10px] border-2',
  lg: 'w-10 h-10 text-xs border-[2.5px]',
}

interface ChipProps {
  color: ChipColor
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
}

export default function Chip({ color, size = 'md', showValue = true }: ChipProps) {
  const s = STYLES[color]
  return (
    <div
      className={`${SIZES[size]} ${s.face} ${s.edge} ${s.text} rounded-full border-dashed flex items-center justify-center font-bold shadow-md select-none`}
    >
      {showValue ? CHIP_VALUES[color] : ''}
    </div>
  )
}
