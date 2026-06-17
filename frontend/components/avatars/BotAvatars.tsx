// Stylized SVG avatars for each named bot.
// Each is rendered inside a circular frame (rounded-full + overflow-hidden).
// All use the same 100x100 viewBox. Conventions:
//   • Background fills the square; circular clipping happens at the wrapper.
//   • Head circle ≈ (50, 38) r=20.
//   • Body curve = "upside-down curve" (∩) rising from y=80 at edges to ~y=55 at center.
//   • No facial features (eyes/nose/mouth) per design.

import { JSX } from 'react'

// Avatar backdrop — warm felt-room mauve so the head+body pop against it.
// Earlier value was overridden to read as "table felt" — but the actual felt
// is now darker/warmer in the redesign, so a warmer mauve here looks correct.
const BG = '#5827ab'

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
// `brimSide` is accepted (and currently a no-op in the front view) so older
// call sites pass it without TypeScript errors.
function BaseballCap({
  color, accent, brimSide,
}: { color: string; accent?: string; brimSide?: number }) {
  void brimSide
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

// ── Extra building blocks for the archetype pool ─────────────────────────────

// Visor used by old-school grinders. Wide flat brim, no crown.
function Visor({ color }: { color: string }) {
  return (
    <g>
      <ellipse cx="50" cy="29" rx="28" ry="3" fill={color} />
      <path d="M 30 30 L 30 27 Q 50 23 70 27 L 70 30 Z" fill={color} />
    </g>
  )
}

// Round wire-frame spectacles.
function Glasses({ color = '#1a1a1a' }: { color?: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth="1.6">
      <circle cx="42" cy="40" r="5" />
      <circle cx="58" cy="40" r="5" />
      <line x1="47" y1="40" x2="53" y2="40" />
    </g>
  )
}

// Flat fedora — narrow brim, low crown.
function Fedora({ color, band = '#1a1a1a' }: { color: string; band?: string }) {
  return (
    <g>
      <ellipse cx="50" cy="26" rx="28" ry="2.5" fill={color} />
      <path d="M 36 26 L 36 14 Q 50 8 64 14 L 64 26 Z" fill={color} />
      <ellipse cx="50" cy="23" rx="14" ry="1.5" fill={band} />
    </g>
  )
}

// Slicked-back hair — short and tight, with a side part.
function SlickHair({ color }: { color: string }) {
  return (
    <g>
      <path d="M 30 38 Q 50 18 70 38 Q 50 24 30 38 Z" fill={color} />
      <line x1="46" y1="22" x2="50" y2="34" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
    </g>
  )
}

// A hood pulled fully up — covers most of the head.
function FullHood({ color }: { color: string }) {
  return (
    <path d="M 18 50 Q 30 12 50 12 Q 70 12 82 50 Q 78 70 50 70 Q 22 70 18 50 Z" fill={color} />
  )
}

// Beanie — knit cap pulled down to the ears.
function Beanie({ color, stripe }: { color: string; stripe?: string }) {
  return (
    <g>
      <path d="M 30 32 Q 30 12 70 12 Q 70 32 70 32 Z" fill={color} />
      <ellipse cx="50" cy="32" rx="22" ry="3.5" fill={color} />
      {stripe && <rect x="28" y="22" width="44" height="3" fill={stripe} />}
    </g>
  )
}

// ── Archetype avatars used for any non-named bot ─────────────────────────────

function Cowboy() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Body color="#7a4226" />
      <Head skin="#dfa97a" />
      <CowboyHat color="#2e1808" />
    </svg>
  )
}
function Visorman() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Body color="#1e3b2a" />
      <Head skin="#e8c79d" />
      <ShortHair color="#1a1208" />
      <Visor color="#3b2a14" />
    </svg>
  )
}
function Suit() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <SuitJacket jacketColor="#1f1a14" shirtColor="#f5efdc" tieColor="#8a1c2a" />
      <Head skin="#dfb98c" />
      <SlickHair color="#1a1208" />
    </svg>
  )
}
function Punk() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Hoodie color="#0a0a0a" hoodColor="#1a1a1a" />
      <Head skin="#e6b993" />
      <ShortHair color="#a83232" />
    </svg>
  )
}
function HoodedGambler() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Body color="#161310" />
      <Head skin="#c79a72" />
      <FullHood color="#161310" />
    </svg>
  )
}
function OldTimer() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Body color="#4a342a" />
      <Head skin="#e0bb95" />
      <ShortHair color="#cfcfcf" />
      <Glasses color="#2a1a0a" />
    </svg>
  )
}
function Captain() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <SuitJacket jacketColor="#0e2240" shirtColor="#f3eddc" />
      <Head skin="#d9a479" />
      <Fedora color="#0e2240" band="#b89668" />
    </svg>
  )
}
function Lady() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Body color="#5a1e2e" />
      <Head skin="#eccda4" />
      <LongHair color="#2b1404" />
    </svg>
  )
}
function Streetwise() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <Background />
      <Hoodie color="#3d2817" hoodColor="#1f1108" />
      <Head skin="#cd9572" />
      <Beanie color="#2a1a0e" stripe="#b89668" />
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

// Archetypes used when the name doesn't have a hand-drawn match. Stable
// assignment by name hash so the same bot keeps the same face all session.
const ARCHETYPES: (() => JSX.Element)[] = [
  Cowboy, Visorman, Suit, Punk, HoodedGambler, OldTimer, Captain, Lady, Streetwise,
]

function hash(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function getBotAvatar(name: string): (() => JSX.Element) | undefined {
  if (BOT_AVATARS[name]) return BOT_AVATARS[name]
  if (!name) return undefined
  return ARCHETYPES[hash(name) % ARCHETYPES.length]
}
