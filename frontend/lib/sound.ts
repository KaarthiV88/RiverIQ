/** Web-Audio synthesised game sounds.
 *
 *  All sounds are generated in code so we ship no audio assets. The first
 *  call to `ensureCtx` lazy-initialises the AudioContext on a user gesture
 *  (browsers block autoplay otherwise). Mute state persists in localStorage.
 */

const MUTE_KEY = 'riveriq:sound_muted'
const MASTER_VOLUME = 0.55  // tame the synthesis — sine + noise can clip fast

type Win = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
let mounted = false

/** Read the persisted mute flag and prime the in-memory cache. Safe to call
 *  more than once; only the first call hits localStorage. */
function loadMutePreference() {
  if (mounted || typeof window === 'undefined') return
  mounted = true
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    /* private mode, ignore */
  }
}

/** Lazy-init the AudioContext. Returns null on SSR or if the browser blocks. */
function ensureCtx(): AudioContext | null {
  loadMutePreference()
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const w = window as Win
    const AC = w.AudioContext || w.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = MASTER_VOLUME
    master.connect(ctx.destination)
  }
  // Some browsers leave context 'suspended' until a user gesture even after
  // construction. resume() during a gesture is a no-op otherwise.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

export function isMuted(): boolean {
  loadMutePreference()
  return muted
}

export function setMuted(v: boolean): void {
  loadMutePreference()
  muted = v
  try {
    window.localStorage.setItem(MUTE_KEY, v ? '1' : '0')
  } catch { /* ignore */ }
}

export function toggleMute(): boolean {
  setMuted(!isMuted())
  return isMuted()
}

// ─────────────────────────────────────────────────────────────────────────────
// Synthesis primitives.

function whiteNoiseBuffer(c: AudioContext, durSec: number): AudioBuffer {
  const n = Math.max(1, Math.floor(c.sampleRate * durSec))
  const buf = c.createBuffer(1, n, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
  return buf
}

/** A single chip "ting": short bandpassed noise burst + a bright sine ping.
 *  Pitch wobbles slightly between calls so a cascade doesn't feel mechanical. */
function chipClink(c: AudioContext, when: number, volume = 0.8) {
  const dest = master!

  // Bright transient — bandpass filtered noise.
  const noise = c.createBufferSource()
  noise.buffer = whiteNoiseBuffer(c, 0.12)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2200 + Math.random() * 900
  bp.Q.value = 6
  const ng = c.createGain()
  ng.gain.setValueAtTime(0, when)
  ng.gain.linearRampToValueAtTime(0.55 * volume, when + 0.003)
  ng.gain.exponentialRampToValueAtTime(0.001, when + 0.09)
  noise.connect(bp).connect(ng).connect(dest)
  noise.start(when)
  noise.stop(when + 0.12)

  // Sine "ting" with quick decay — this carries the pitch.
  const osc = c.createOscillator()
  osc.type = 'sine'
  const f0 = 2100 + Math.random() * 500
  osc.frequency.setValueAtTime(f0, when)
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.92, when + 0.12)
  const og = c.createGain()
  og.gain.setValueAtTime(0, when)
  og.gain.linearRampToValueAtTime(0.22 * volume, when + 0.002)
  og.gain.exponentialRampToValueAtTime(0.001, when + 0.14)
  osc.connect(og).connect(dest)
  osc.start(when)
  osc.stop(when + 0.16)
}

/** A soft wooden knock-on-table thunk — used for "check". */
function knock(c: AudioContext, when: number, vol = 1.0) {
  const dest = master!
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(180, when)
  osc.frequency.exponentialRampToValueAtTime(55, when + 0.07)
  const g = c.createGain()
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(0.5 * vol, when + 0.003)
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.09)
  osc.connect(g).connect(dest)
  osc.start(when)
  osc.stop(when + 0.1)
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level sound events.

/** Paper-shuffle — cards being mucked. */
export function playFold() {
  if (muted) return
  const c = ensureCtx()
  if (!c) return
  const now = c.currentTime
  const noise = c.createBufferSource()
  noise.buffer = whiteNoiseBuffer(c, 0.22)
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 1800
  const g = c.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(0.18, now + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
  noise.connect(hp).connect(g).connect(master!)
  noise.start(now)
  noise.stop(now + 0.24)
}

/** Two soft knocks on the table — "check". */
export function playCheck() {
  if (muted) return
  const c = ensureCtx()
  if (!c) return
  const now = c.currentTime
  knock(c, now)
  knock(c, now + 0.08, 0.7)
}

/** One chip placed in front of the bettor — "call". */
export function playCall() {
  if (muted) return
  const c = ensureCtx()
  if (!c) return
  chipClink(c, c.currentTime, 0.9)
}

/** A small stack of chips placed — "bet" or "raise". 3 clinks tight together. */
export function playRaise() {
  if (muted) return
  const c = ensureCtx()
  if (!c) return
  const now = c.currentTime
  chipClink(c, now,              0.95)
  chipClink(c, now + 0.04,       0.85)
  chipClink(c, now + 0.085,      0.75)
}

/** Soft brass bell — "your turn". Two harmonically related tones. */
export function playYourTurn() {
  if (muted) return
  const c = ensureCtx()
  if (!c) return
  const dest = master!
  const t = c.currentTime
  ;[
    { f: 880,  delay: 0,    vol: 0.22 },
    { f: 1320, delay: 0.05, vol: 0.18 },
  ].forEach(({ f, delay, vol }) => {
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = f
    const g = c.createGain()
    const start = t + delay
    g.gain.setValueAtTime(0, start)
    g.gain.linearRampToValueAtTime(vol, start + 0.008)
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.55)
    osc.connect(g).connect(dest)
    osc.start(start)
    osc.stop(start + 0.6)
  })
}

/** Cascade of chips being raked into a stack — "pot collected". 8 clinks
 *  with random pitch + timing jitter so it sounds like physical chips. */
export function playPot() {
  if (muted) return
  const c = ensureCtx()
  if (!c) return
  const now = c.currentTime
  const N = 9
  for (let i = 0; i < N; i++) {
    const jitter = (Math.random() - 0.5) * 0.025
    const t = now + i * 0.045 + jitter
    const vol = 0.7 + Math.random() * 0.25
    chipClink(c, t, vol)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch by ActionType — used by the game-page effects.

export function playAction(action: 'fold' | 'check' | 'call' | 'bet' | 'raise') {
  switch (action) {
    case 'fold':   return playFold()
    case 'check':  return playCheck()
    case 'call':   return playCall()
    case 'bet':
    case 'raise':  return playRaise()
  }
}
