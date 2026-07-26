'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/auth'

const NEXT_KEY = 'riveriq:postSignInPath'

type Mode = 'signin' | 'signup'

function SignInInner() {
  const router = useRouter()
  const search = useSearchParams()
  const { session } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Capture where the user came from so we can return them after sign-in.
  useEffect(() => {
    const next = search.get('next')
    if (next && typeof window !== 'undefined') {
      sessionStorage.setItem(NEXT_KEY, next)
    }
  }, [search])

  // Already signed in? Bounce back to wherever they were.
  useEffect(() => {
    if (!session) return
    const stashed = typeof window !== 'undefined' ? sessionStorage.getItem(NEXT_KEY) : null
    if (stashed) sessionStorage.removeItem(NEXT_KEY)
    router.replace(stashed || '/')
  }, [session, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password) return
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })
        if (error) throw error
        // onAuthStateChange will populate the session; the redirect effect
        // above takes over from here.
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        })
        if (error) throw error
        if (!data.session) {
          // "Confirm email" is on in the dashboard; sign-up succeeded but
          // no session was issued. Tell the user to check their inbox —
          // but they shouldn't hit this path in the current config.
          setNotice(
            'Account created. Check your email for the confirmation link before signing in.',
          )
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[signin] auth error:', err)
      const e = err as { message?: string; status?: number } | null
      setError(e?.message || `Auth failed (status ${e?.status ?? 'unknown'})`)
    } finally {
      setSubmitting(false)
    }
  }

  const flip = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  return (
    <div className="min-h-screen bg-underground text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="text-sm text-[color:var(--brass)] hover:text-amber-200">← Lobby</Link>

        <h1 className="font-display italic text-5xl md:text-6xl tracking-tight mt-3 mb-2">
          {mode === 'signin' ? 'Sit down at the table.' : 'Buy in.'}
        </h1>
        <p className="text-white/55 text-sm leading-relaxed mb-8">
          {mode === 'signin'
            ? 'Welcome back. Your history and stats are right where you left them.'
            : 'Pick an email and a password. No verification required — you can change either later.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="w-full bg-zinc-900 border border-white/15 rounded-lg px-4 py-3 text-white text-base placeholder:text-white/35 focus:outline-none focus:border-amber-400 disabled:opacity-50"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="w-full bg-zinc-900 border border-white/15 rounded-lg px-4 py-3 text-white text-base placeholder:text-white/35 focus:outline-none focus:border-amber-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={submitting || !email.trim() || password.length < 6}
            className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-white/30 active:scale-[0.99] text-black font-bold rounded-lg text-base transition"
          >
            {submitting
              ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
              : (mode === 'signin' ? 'Sign in' : 'Create account')}
          </button>

          {error && (
            <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {notice && (
            <div className="bg-amber-950/40 border border-amber-500/30 text-amber-200 text-sm rounded-lg px-3 py-2">
              {notice}
            </div>
          )}
        </form>

        <p className="text-sm text-white/55 mt-6 text-center">
          {mode === 'signin' ? (
            <>New here? <button onClick={() => flip('signup')} className="text-[color:var(--brass)] hover:text-amber-200 underline-offset-4 hover:underline">Create an account</button></>
          ) : (
            <>Already have one? <button onClick={() => flip('signin')} className="text-[color:var(--brass)] hover:text-amber-200 underline-offset-4 hover:underline">Sign in instead</button></>
          )}
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-underground flex items-center justify-center text-white/55 text-sm">
        Loading…
      </div>
    }>
      <SignInInner />
    </Suspense>
  )
}
