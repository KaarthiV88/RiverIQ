export type Marker = 'D' | 'LB' | 'BB'

interface PositionMarkerProps {
  marker: Marker
  size?: 'sm' | 'md'
}

const STYLES: Record<Marker, string> = {
  D:  'bg-white text-gray-900 ring-2 ring-gray-300',
  LB: 'bg-sky-500 text-white ring-2 ring-sky-300',
  BB: 'bg-rose-500 text-white ring-2 ring-rose-300',
}

const SIZES = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
}

export default function PositionMarker({ marker, size = 'md' }: PositionMarkerProps) {
  return (
    <div
      className={`${SIZES[size]} ${STYLES[marker]} rounded-full flex items-center justify-center font-bold shadow-md select-none`}
    >
      {marker}
    </div>
  )
}
