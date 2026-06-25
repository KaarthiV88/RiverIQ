'use client'

import { useEffect, useState } from 'react'

interface ExpandableCardProps {
  /** Used for both the trigger's aria-label and the modal title. */
  ariaLabel: string
  /** Optional className on the trigger wrapper (the in-grid presentation). */
  className?: string
  /** Render the card content. Receives whether we're in the fullscreen view
   *  so it can scale up type, padding, etc. */
  children: (expanded: boolean) => React.ReactNode
}

/** A card that expands into a centered fullscreen view when clicked.
 *  Closes on backdrop click, the × button, or Escape. */
export default function ExpandableCard({ ariaLabel, className = '', children }: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [expanded])

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={`expandable-card text-left w-full ${className}`}
        aria-label={`Expand: ${ariaLabel}`}
      >
        {children(false)}
      </button>

      {expanded && (
        <div
          className="expand-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          <div
            className="expand-content relative w-[75vw] h-[75vh] max-w-[1600px] max-h-[1100px] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Close expanded view"
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/75 hover:bg-black border border-white/25 text-white text-2xl leading-none flex items-center justify-center transition"
            >
              ×
            </button>
            {children(true)}
          </div>
        </div>
      )}
    </>
  )
}
