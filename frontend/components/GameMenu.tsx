'use client'

interface GameMenuProps {
  isSittingOut: boolean
  canAddToStack: boolean
  onStand: () => void
  onAddToStack: () => void
  onReset: () => void
  onLeave: () => void
}

export default function GameMenu({
  isSittingOut,
  canAddToStack,
  onStand,
  onAddToStack,
  onReset,
  onLeave,
}: GameMenuProps) {
  return (
    <div className="fixed top-4 right-4 z-40 flex flex-col gap-2 bg-black/70 backdrop-blur-md rounded-xl p-3 border border-white/15 shadow-2xl">
      <button
        onClick={onStand}
        className={`px-4 py-2 font-bold rounded-lg text-sm transition active:scale-95 ${
          isSittingOut
            ? 'bg-amber-500 hover:bg-amber-400 text-black'
            : 'bg-zinc-700 hover:bg-zinc-600 text-white'
        }`}
      >
        {isSittingOut ? 'Sit Back In' : 'Stand'}
      </button>

      <button
        onClick={onAddToStack}
        disabled={!canAddToStack}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-white/30 disabled:cursor-not-allowed text-white font-bold rounded-lg text-sm transition active:scale-95"
        title={
          canAddToStack
            ? 'Top up your stack'
            : 'Available only when your stack is at or below 20% of average'
        }
      >
        Add to Stack
      </button>

      <button
        onClick={onReset}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-lg text-sm transition"
        title="Reroll the lineup and reset every stack"
      >
        Reset Table
      </button>

      <button
        onClick={onLeave}
        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-lg text-sm transition"
      >
        Leave Game
      </button>
    </div>
  )
}
