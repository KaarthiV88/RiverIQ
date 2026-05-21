import { BOT_AVATARS } from './avatars/BotAvatars'

interface AvatarProps {
  name: string
  isHuman?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'w-10 h-10 text-xs',
  md: 'w-14 h-14 text-sm',
  lg: 'w-20 h-20 text-base',
}

const COLOR_POOL = [
  'from-rose-500 to-rose-700',
  'from-amber-500 to-orange-700',
  'from-emerald-500 to-teal-700',
  'from-sky-500 to-blue-700',
  'from-indigo-500 to-purple-700',
  'from-fuchsia-500 to-pink-700',
  'from-lime-500 to-green-700',
  'from-cyan-500 to-blue-600',
]

function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

function getInitials(name: string): string {
  const cleaned = name.replace('.', '').trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({ name, isHuman = false, size = 'md' }: AvatarProps) {
  const sizeClass = SIZES[size]
  const BotSvg = BOT_AVATARS[name]

  // Known bot → render its custom SVG portrait inside a circular frame.
  if (BotSvg && !isHuman) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden ring-2 ring-white/30 shadow-lg`}>
        <BotSvg />
      </div>
    )
  }

  // Human or unknown name → fallback to initials on a gradient.
  const gradient = isHuman
    ? 'from-yellow-400 to-amber-600'
    : COLOR_POOL[hashName(name) % COLOR_POOL.length]

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white/30 select-none`}
    >
      {getInitials(name)}
    </div>
  )
}
