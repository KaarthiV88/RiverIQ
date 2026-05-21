// Stylized SVG avatars for each named bot.
// Each is rendered inside a circular frame (rounded-full + overflow-hidden).
// All use the same 100x100 viewBox. Conventions:
//   • Background fills the square; circular clipping happens at the wrapper.
//   • Head circle ≈ (50, 38) r=20.
//   • Body curve = "upside-down curve" (∩) rising from y=80 at edges to ~y=55 at center.
//   • No facial features (eyes/nose/mouth) per design.

import { JSX } from 'react'

const BG = '#5827ab'  // matches --felt

// ── Reusable building blocks ──────────────────────────────────────────────────

function Background() {
  return <rect width="100" height="100" fill={BG} />
}

function Body({ color }: { color: string }) {
  // Smooth upside-down curve from bottom-left (0,100) up to a peak near (50,58) and back down.
  return <path d="M 0 100 L 0 82 Q 50 58 100 82 L 100 100 Z" fill={color} />
}

function Head({ skin }: { skin: string }) {
  return <circle cx="50" cy="38" r="20" fill={skin} />
}

// Baseball cap viewed from the front. Crown sits on top of the head, brim
// extends straight forward (rendered as a horizontal ellipse).
function BaseballCap({ color, accent }: { color: string; accent?: string }) {
  return (
    <g>
      {/* Brim (drawn first so it sits behind the crown) */}
      <ellipse cx="50" cy="29" rx="26" ry="3" fill={color} />
      {/* Crown — rounded dome */}
      <path d="M 30 30 C 30 12, 70 12, 70 30 Z" fill={color} />
      {/* Optional center accent stripe */}
      {accent && <rect x="46" y="14" width="8" height="14" fill={accent} />}
    </g>
  )
}

// Classic cowboy hat with a wide brim and tall pinched crown.
function CowboyHat({ color }: { color: string }) {
  return (
    <g>
      {/* Brim — wide and slightly curved */}
      <ellipse cx="50" cy="26" rx="34" ry="3" fill={color} />
      {/* Crown */}
      <path d="M 38 26 C 38 6, 62 6, 62 26 Z" fill={color} />
      {/* Hat band */}
      <ellipse cx="50" cy="24" rx="12" ry="1.5" fill="#1a1a1a" />
    </g>
  )
}

function MulletHair({ color }: { color: string }) {
  // Hair visible behind head and trailing below cap line
  return <path d="M 30 40 Q 26 56 36 62 L 30 50 Q 28 40 30 40 M 70 40 Q 74 56 64 62 L 70 50 Q 72 40 70 40" fill={color} />
}

function ShortHair({ color }: { color: string }) {
  return <path d="M 30 36 Q 50 16 70 36 Q 50 26 30 36 Z" fill={color} />
}

function LongHair({ color }: { color: string }) {
  return (
    <g>
      <path d="M 30 38 Q 50 14 70 38 Q 50 22 30 38 Z" fill={color} />
      <path d="M 28 38 Q 24 60 32 65 L 30 42 Z" fill={color} />
      <path d="M 72 38 Q 76 60 68 65 L 70 42 Z" fill={color} />
    </g>
  )
}

function SuitJacket({ jacketColor, shirtColor, tieColor }: { jacketColor: string; shirtColor: string; tieColor?: string }) {
  return (
    <g>
      {/* Jacket body (overrides any prior body) */}
      <path d="M 0 100 L 0 82 Q 50 58 100 82 L 100 100 Z" fill={jacketColor} />
      {/* Shirt collar V */}
      <path d="M 38 64 L 50 76 L 62 64 L 60 90 L 40 90 Z" fill={shirtColor} />
      {/* Lapels */}
      <path d="M 25 100 L 38 64 L 50 76 L 38 100 Z" fill={jacketColor} />
      <path d="M 75 100 L 62 64 L 50 76 L 62 100 Z" fill={jacketColor} />
      {/* Optional tie */}
      {tieColor && <path d="M 47 76 L 53 76 L 54 100 L 46 100 Z" fill={tieColor} />}
    </g>
  )
}

function Hoodie({ color, hoodColor }: { color: string; hoodColor: string }) {
  return (
    <g>
      <path d="M 0 100 L 0 82 Q 50 58 100 82 L 100 100 Z" fill={color} />
      {/* Hood opening around the head */}
      <path d="M 22 50 Q 50 80 78 50 Q 78 70 50 72 Q 22 70 22 50 Z" fill={hoodColor} />
      {/* Drawstrings */}
      <line x1="44" y1="72" x2="42" y2="92" stroke="#fff" strokeWidth="1.2" />
      <line x1="56" y1="72" x2="58" y2="92" stroke="#fff" strokeWidth="1.2" />
    </g>
  )
}

// ── Named bot avatars ─────────────────────────────────────────────────────────

export function PhilIvey() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Body color="#0e0e0e" />
      <Head skin="#5e3a22" />
      <BaseballCap color="#d4af37" accent="#8a6f1f" brimSide={1} />
    </svg>
  )
}

export function PhilHellmuth() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <SuitJacket jacketColor="#1a1a1a" shirtColor="#9ca3af" />
      <Head skin="#f3cfa6" />
      <MulletHair color="#5c3a1c" />
      <BaseballCap color="#0a0a0a" brimSide={1} />
    </svg>
  )
}

export function DanielNegreanu() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Body color="#1e40af" />
      <Head skin="#f0c9a2" />
      <ShortHair color="#3a2616" />
    </svg>
  )
}

export function TomDwan() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Hoodie color="#2c2c2c" hoodColor="#1a1a1a" />
      <Head skin="#f0caa8" />
      <ShortHair color="#1a1208" />
    </svg>
  )
}

export function DoyleBrunson() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Body color="#7a2929" />
      <Head skin="#e8b890" />
      <CowboyHat color="#3b2410" />
    </svg>
  )
}

export function TonyG() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <SuitJacket jacketColor="#0a0a0a" shirtColor="#ffffff" tieColor="#b91c1c" />
      <Head skin="#e8b890" />
      <ShortHair color="#2c1a0e" />
    </svg>
  )
}

export function Rampage() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Hoodie color="#b91c1c" hoodColor="#7f1414" />
      <Head skin="#f5d6a8" />
      <ShortHair color="#0a0a0a" />
    </svg>
  )
}

export function Wolfgang() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Body color="#15803d" />
      <Head skin="#f3cfa6" />
      <LongHair color="#d4a73a" />
    </svg>
  )
}

// ── Lookup by display name ────────────────────────────────────────────────────

export const BOT_AVATARS: Record<string, () => JSX.Element> = {
  'P. Ivey':       PhilIvey,
  'P. Hellmuth':   PhilHellmuth,
  'D. Negreanu':   DanielNegreanu,
  'T. Dwan':       TomDwan,
  'D. Brunson':    DoyleBrunson,
  'Tony G':        TonyG,
  'Rampage':       Rampage,
  'Wolfgang':      Wolfgang,
}
