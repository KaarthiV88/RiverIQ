import { getBotAvatar } from './avatars/BotAvatars'

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

function getInitials(name: string): string {
  const cleaned = name.replace('.', '').trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({ name, isHuman = false, size = 'md' }: AvatarProps) {
  const sizeClass = SIZES[size]
  const BotSvg = isHuman ? undefined : getBotAvatar(name)

  // Bot → either the hand-drawn portrait for named pros or a hash-assigned
  // archetype (cowboy, visorman, suit, …). Either way: a real character,
  // never initials.
  if (BotSvg) {
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden shadow-lg`}
        style={{ boxShadow: '0 0 0 1px rgba(184,150,104,0.5), 0 6px 14px -6px rgba(0,0,0,0.8)' }}
      >
        <BotSvg />
      </div>
    )
  }

  // Human only — kept as a brass-rimmed initial chip in case any consumer
  // still asks for the human avatar (the in-game seat no longer does).
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold select-none`}
      style={{
        background: 'linear-gradient(160deg, #c9a468 0%, #8b6b3c 100%)',
        color: 'var(--ink)',
        boxShadow: '0 0 0 1px rgba(184,150,104,0.6), 0 6px 14px -6px rgba(0,0,0,0.8)',
      }}
    >
      {getInitials(name)}
    </div>
  )
}
