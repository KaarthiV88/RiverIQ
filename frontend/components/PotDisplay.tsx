import Chip from './Chip'

interface PotDisplayProps {
  amount: number
}

export default function PotDisplay({ amount }: PotDisplayProps) {
  if (amount === 0) {
    return (
      <div className="text-white/40 text-base font-semibold tracking-wide">
        Pot: $0
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center -space-x-4">
        <Chip color="black" size="md" showValue={false} />
        <Chip color="green" size="md" showValue={false} />
        <Chip color="blue"  size="md" showValue={false} />
      </div>
      <div className="bg-black/60 px-5 py-1.5 rounded-full shadow-lg border border-amber-400/30">
        <span className="text-amber-300 text-xl font-extrabold tracking-tight">
          Pot: ${amount.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
