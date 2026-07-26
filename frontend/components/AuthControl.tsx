'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '../lib/auth'

/** Top-right pill on the lobby: "Sign in" when signed out, or the user's
 *  email with a small sign-out caret when signed in. Quiet by default; the
 *  intent is for it to fade into the candlelit room aesthetic. */
export default function AuthControl() {
  const { session, user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // While we don't know yet, render nothing — avoids a flash of "Sign in"
  // when the user is actually already authed.
  if (session === undefined) return null

  if (!session) {
    return (
      <Link
        href="/signin"
        className="text-sm font-bold px-4 py-2 rounded-lg bg-[color:var(--brass)] hover:brightness-110 text-[color:var(--ink)] transition"
      >
        Sign in
      </Link>
    )
  }

  const email = user?.email ?? 'Signed in'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-sm px-4 py-2 rounded-lg bg-zinc-900/70 hover:bg-zinc-800 border border-white/15 text-white/85 transition flex items-center gap-2"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
        <span className="font-mono">{email}</span>
        <span className="text-white/40">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-lg border border-white/15 bg-zinc-950 shadow-xl py-1 z-50">
          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true)
              try {
                await signOut()
                // The auth state listener will flip session → null and the
                // gates on protected pages handle redirects on their own.
              } finally {
                setSigningOut(false)
                setOpen(false)
              }
            }}
            className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5 disabled:opacity-50"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
