'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GameState } from '../types/poker'
import {
  CoachMessage,
  buildGameContext,
  streamCoachReply,
} from '../lib/coach'

interface CoachPanelProps {
  open: boolean
  onClose: () => void
  /** Live game state. A fresh snapshot is captured each time the user sends. */
  gameState: GameState
}

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: 'Analyze this spot', prompt: 'Analyze my current spot. What are the key considerations?' },
  { label: 'Should I fold?', prompt: 'Should I fold here? Why or why not?' },
  { label: "What's my equity?", prompt: "What's my approximate equity here and how does it compare to my pot odds?" },
  { label: 'Read my opponents', prompt: 'What can you tell me about the opponents still in the hand and how should I exploit them?' },
]

export default function CoachPanel({ open, onClose, gameState }: CoachPanelProps) {
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll the message list to the bottom whenever it changes.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, streaming])

  // Cancel any in-flight stream when the panel closes or the component unmounts.
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
      setStreaming(false)
    }
  }, [open])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    setError(null)

    const userMsg: CoachMessage = { role: 'user', content: trimmed }
    // Snapshot the conversation we're sending — separate from React state so
    // we can append assistant deltas without racing the user's next message.
    const outgoing = [...messages, userMsg]
    setMessages([...outgoing, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const context = buildGameContext(gameState)
      let assistantText = ''
      for await (const delta of streamCoachReply(outgoing, context, controller.signal)) {
        assistantText += delta
        setMessages(prev => {
          // Replace the trailing assistant placeholder with the accumulated text.
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: assistantText }
          return next
        })
      }
    } catch (e: unknown) {
      if ((e as { name?: string } | null)?.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : 'Coach stream failed'
      setError(msg)
      // Drop the empty assistant placeholder on hard failure.
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant' && last.content === '') return prev.slice(0, -1)
        return prev
      })
    } finally {
      abortRef.current = null
      setStreaming(false)
    }
  }, [messages, streaming, gameState])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    send(input)
  }, [send, input])

  const clearConversation = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    setMessages([])
    setError(null)
  }, [])

  return (
    <>
      {/* Backdrop — clicking it closes the panel. */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed top-0 right-0 z-50 h-screen w-full max-w-md bg-zinc-950 border-l border-white/10 shadow-2xl flex flex-col transform transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            <h2 className="text-lg font-bold text-white">Coach</h2>
            <span className="text-xs text-white/40 font-mono ml-1">Llama 3</span>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
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

        {/* Message list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-white/50 text-sm leading-relaxed">
              <p className="mb-3">
                Ask anything about your current spot. I can see your hand,
                the board, the action history, and your opponents&apos; styles.
              </p>
              <p className="text-white/40 text-xs">
                Quick start — try one of the chips below.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-amber-500 text-black font-medium rounded-br-sm'
                    : 'bg-zinc-800 text-white/95 rounded-bl-sm border border-white/5'
                }`}
              >
                {m.content || (streaming && i === messages.length - 1 ? (
                  <span className="inline-flex gap-1 items-center text-white/50 text-xs">
                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" />
                    thinking
                  </span>
                ) : '')}
              </div>
            </div>
          ))}

          {error && (
            <div className="text-rose-400 text-xs bg-rose-950/40 border border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-white/10 px-4 py-3 space-y-2 bg-zinc-950">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map(q => (
              <button
                key={q.label}
                disabled={streaming}
                onClick={() => send(q.prompt)}
                className="text-xs px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white/85 border border-white/10 transition"
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
              className="flex-1 bg-zinc-900 border border-white/15 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/35 focus:outline-none focus:border-amber-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-white/30 active:scale-95 text-black font-bold rounded-lg text-sm transition"
            >
              Send
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
