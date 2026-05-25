import Chip from './Chip'

interface PotDisplayProps {
  amount: number
}

export default function PotDisplay({ amount }: PotDisplayProps) {
  if (amount === 0) {
    return (
      <div className="text-white/40 text-sm font-semibold tracking-wide">
        Pot: $0
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center -space-x-3">
        <Chip color="black" size="sm" showValue={false} />
        <Chip color="green" size="sm" showValue={false} />
        <Chip color="blue"  size="sm" showValue={false} />
      </div>
      <div className="bg-black/50 px-3 py-1 rounded-full shadow">
        <span className="text-white text-sm font-bold">Pot: ${amount}</span>
      </div>
    </div>
  )
}
