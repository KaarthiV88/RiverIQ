'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GameState } from '../types/poker'
import {
  CoachMessage,
  CoachStreamError,
  buildGameContext,
  streamCoachReply,
} from '../lib/coach'
import { getUserId } from '../lib/userId'

interface CoachPanelProps {
  open: boolean
  onClose: () => void
  /** Live game state. A fresh snapshot is captured each time the user sends. */
  gameState: GameState
  /** Bubble up streaming status so the page can pulse the FAB while closed. */
  onStreamingChange?: (streaming: boolean) => void
  /** Which side of the AR area the panel docks to. */
  side: 'left' | 'right'
  /** Caller controls the side; we just emit the request to flip. */
  onToggleSide: () => void
}

// Chat history may contain a special "divider" entry that visually separates
// the conversation by hand. Backend never sees these — they're filtered out
// before sending.
type ChatEntry =
  | { kind: 'message'; role: 'user' | 'assistant'; content: string }
  | { kind: 'divider'; label: string }

const LIVE_ACTIONS: { label: string; prompt: string }[] = [
  { label: 'Analyze this spot', prompt: 'Analyze my current spot. What are the key considerations?' },
  { label: 'Should I fold?', prompt: 'Should I fold here? Why or why not?' },
  { label: "What's my equity?", prompt: "What's my approximate equity here and how does it compare to my pot odds?" },
  { label: 'Read my opponents', prompt: 'What can you tell me about the opponents still in the hand and how should I exploit them?' },
]

const REVIEW_ACTIONS: { label: string; prompt: string }[] = [
  { label: 'Review the hand', prompt: 'Review the hand I just played. Walk me through it street by street and highlight the key decisions.' },
  { label: 'What would you do?', prompt: 'What would you have done differently in this hand?' },
  { label: 'Biggest mistake?', prompt: "What's the biggest mistake (if any) I made in this hand?" },
  { label: 'Was my river OK?', prompt: 'Was my river decision correct given the opponent ranges?' },
]

export default function CoachPanel({ open, onClose, gameState, onStreamingChange, side, onToggleSide }: CoachPanelProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<{ message: string; status?: number } | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const prevPhaseRef = useRef<GameState['phase']>(gameState.phase)
  // Pixel-positioned `left` so we can transition between docked sides instead
  // of snapping (Tailwind's right-3 / left-3 swap is `auto`-keyed and won't
  // animate). Re-measured on side-change and on parent resize.
  const [leftPx, setLeftPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    const panel = panelRef.current
    const parent = panel?.parentElement
    if (!panel || !parent) return
    const GAP = 12 // matches the old `right-3` / `left-3` spacing
    const update = () => {
      const pw = parent.getBoundingClientRect().width
      const w = panel.getBoundingClientRect().width
      setLeftPx(side === 'right' ? pw - w - GAP : GAP)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(parent)
    ro.observe(panel)
    return () => ro.disconnect()
  }, [side])

  const isReview = gameState.phase === 'showdown'
  const quickActions = isReview ? REVIEW_ACTIONS : LIVE_ACTIONS

  // Surface streaming state up to the parent (FAB pulse).
  useEffect(() => {
    onStreamingChange?.(streaming)
  }, [streaming, onStreamingChange])

  // Auto-scroll to bottom on any change.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [entries, streaming])

  // Cancel any in-flight stream on unmount only — closing the panel keeps the
  // stream alive so the user comes back to a completed answer.
  useEffect(() => () => abortRef.current?.abort(), [])

  // New-hand divider: fire when phase transitions from 'showdown' (the
  // previous hand ended) into 'playing' (a fresh hand is being dealt).
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = gameState.phase
    if (prev !== 'showdown' || gameState.phase !== 'playing') return
    setEntries(prev => {
      // Don't add a divider if the chat is empty or already ends with one.
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      if (last.kind === 'divider') return prev
      return [...prev, { kind: 'divider', label: 'New hand' }]
    })
  }, [gameState.phase])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    setError(null)

    // Pull the existing conversation as backend-shaped messages.
    const outgoing: CoachMessage[] = [
      ...entries
        .filter((e): e is Extract<ChatEntry, { kind: 'message' }> => e.kind === 'message')
        .map(e => ({ role: e.role, content: e.content })),
      { role: 'user', content: trimmed },
    ]
    setEntries(prev => [
      ...prev,
      { kind: 'message', role: 'user', content: trimmed },
      { kind: 'message', role: 'assistant', content: '' },
    ])
    setInput('')
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const context = buildGameContext(gameState)
      const userId = getUserId()
      let assistantText = ''
      for await (const delta of streamCoachReply(outgoing, context, controller.signal, userId)) {
        assistantText += delta
        setEntries(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.kind === 'message' && last.role === 'assistant') {
            next[next.length - 1] = { kind: 'message', role: 'assistant', content: assistantText }
          }
          return next
        })
      }
    } catch (e: unknown) {
      if ((e as { name?: string } | null)?.name === 'AbortError') return
      const status = e instanceof CoachStreamError ? e.status : undefined
      const msg = e instanceof Error ? e.message : 'Coach stream failed'
      setError({ message: msg, status })
      // Drop the empty assistant placeholder so the user can retry cleanly.
      setEntries(prev => {
        const last = prev[prev.length - 1]
        if (last && last.kind === 'message' && last.role === 'assistant' && last.content === '') {
          return prev.slice(0, -1)
        }
        return prev
      })
    } finally {
      abortRef.current = null
      setStreaming(false)
    }
  }, [entries, streaming, gameState])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    send(input)
  }, [send, input])

  const clearConversation = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    setEntries([])
    setError(null)
  }, [])

  return (
    <>
      <aside
        ref={panelRef}
        className={`coach-panel-hud absolute top-3 bottom-3 z-30 w-[34%] max-w-[420px] min-w-[320px] rounded-md flex flex-col origin-center ${
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-50 pointer-events-none'
        }`}
        style={{
          // Hold off rendering at any position until we've measured the parent.
          // Avoids a flash at top-left on first paint.
          left: leftPx == null ? undefined : `${leftPx}px`,
          right: 'auto',
          // Three concurrent transitions:
          //   left      — slide between docked sides
          //   transform — scale-out from center on close/open
          //   opacity   — fade
          transition:
            'left 520ms cubic-bezier(0.65, 0, 0.35, 1), ' +
            'transform 340ms cubic-bezier(0.34, 1.56, 0.64, 1), ' +
            'opacity 260ms ease-out',
        }}
      >
        {/* Brass corner brackets — same vocabulary as the table reticles so
            the panel reads as part of the same HUD instrument. */}
        <span className="hud-corner hud-corner-tl" />
        <span className="hud-corner hud-corner-tr" />
        <span className="hud-corner hud-corner-bl" />
        <span className="hud-corner hud-corner-br" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            <h2 className="text-lg font-bold text-white">Coach</h2>
            <span className="text-xs text-white/40 font-mono ml-1">Llama 3</span>
            {isReview && (
              <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold">
                Review
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleSide}
              className="coach-side-toggle"
              aria-label={side === 'right' ? 'Move chat to left side' : 'Move chat to right side'}
              title={side === 'right' ? 'Dock chat to the left' : 'Dock chat to the right'}
            >
              {side === 'right' ? '←' : '→'}
            </button>
            {entries.length > 0 && (
              <button
                onClick={clearConversation}
                className="text-xs px-2 py-1 text-white/60 hover:text-white border border-white/15 rounded-md transition"
                title="Clear conversation"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition flex items-center justify-center text-xl leading-none"
              aria-label="Close coach"
            >
              ×
            </button>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {entries.length === 0 && (
            <div className="text-white/55 text-base leading-relaxed">
              <p className="mb-3">
                {isReview
                  ? "The hand's over — ask me to review it, or anything else about the spot."
                  : "Ask anything about your current spot. I can see your hand, the board, the action history, and your opponents' styles."}
              </p>
              <p className="text-white/45 text-sm">Quick start — try a chip below.</p>
            </div>
          )}

          {entries.map((e, i) => {
            if (e.kind === 'divider') {
              return (
                <div key={i} className="flex items-center gap-3 py-1 select-none">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs uppercase tracking-wider text-white/40">{e.label}</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              )
            }
            return (
              <div
                key={i}
                className={`flex ${e.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${
                    e.role === 'user'
                      ? 'coach-bubble-user font-medium rounded-br-sm'
                      : 'coach-bubble-assistant rounded-bl-sm'
                  }`}
                >
                  {e.content || (streaming && i === entries.length - 1 ? (
                    <span className="inline-flex gap-1 items-center text-white/55 text-sm">
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" />
                      thinking
                    </span>
                  ) : '')}
                </div>
              </div>
            )
          })}

          {error && (
            <div
              className={`text-xs rounded-lg px-3 py-2 border ${
                error.status === 429
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              {error.message}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3 space-y-2 bg-zinc-950">
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map(q => (
              <button
                key={q.label}
                disabled={streaming}
                onClick={() => send(q.prompt)}
                className="text-sm px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white/85 border border-white/10 transition"
              >
                {q.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the coach…"
              disabled={streaming}
              className="flex-1 bg-zinc-900 border border-white/15 rounded-lg px-3 py-2.5 text-white text-base placeholder:text-white/35 focus:outline-none focus:border-amber-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-white/30 active:scale-95 text-black font-bold rounded-lg text-base transition"
            >
              Send
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
