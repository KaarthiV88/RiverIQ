'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/auth'

const NEXT_KEY = 'riveriq:postSignInPath'

type Mode = 'signin' | 'signup' | 'verify'

function SignInInner() {
  const router = useRouter()
  const search = useSearchParams()
  const { session } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
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

  // Already signed in? Bounce back. Fresh sign-ups clear the stash (see
  // handleSubmit) so they always land on the home page.
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
        // onAuthStateChange populates the session; the redirect effect takes over.
      } else {
        const trimmedUsername = username.trim()
        if (!trimmedUsername) {
          setError('Pick a username.')
          return
        }
        // New sign-ups always land on the home page — drop any stashed return path.
        if (typeof window !== 'undefined') sessionStorage.removeItem(NEXT_KEY)
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          // Stored on auth.users.user_metadata — surfaced as the display name.
          options: { data: { username: trimmedUsername } },
        })
        if (error) throw error
        if (data.session) {
          // Email confirmation is off: signed in immediately, redirect effect fires.
        } else {
          // Confirmation on: Supabase emailed a 6-digit code. Move to the
          // verify step; email/username persist in state for verifyOtp.
          setMode('verify')
          setNotice(`We sent a code to ${trimmedEmail}. Enter it below to finish.`)
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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = code.trim()
    if (token.length < 6) return
    setSubmitting(true)
    setError(null)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'signup',
      })
      if (error) throw error
      // Success issues a session → redirect effect sends them to the home page.
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[signin] verify error:', err)
      const e = err as { message?: string } | null
      setError(e?.message || 'That code didn’t work. Check it and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const resendCode = async () => {
    setError(null)
    setNotice(null)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      })
      if (error) throw error
      setNotice('New code sent. Give it a moment to arrive.')
    } catch (err) {
      const e = err as { message?: string } | null
      setError(e?.message || 'Could not resend the code.')
    }
  }

  const flip = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
    setCode('')
    // Leaving a signup for the sign-in screen should restore normal return-path
    // behavior; entering signup clears it so verified users land home.
    if (next === 'signup' && typeof window !== 'undefined') {
      sessionStorage.removeItem(NEXT_KEY)
    }
  }

  // ─── Verify step ──────────────────────────────────────────────────────────
  if (mode === 'verify') {
    return (
      <div className="min-h-screen bg-underground text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <button
            onClick={() => flip('signup')}
            className="back-link"
          >
            ← Back
          </button>

          <p className="eyebrow mt-6 mb-3">Confirm your email</p>
          <h1 className="font-display italic text-5xl md:text-6xl tracking-tight mb-2">
            Check your email.
          </h1>
          <p className="text-white/55 text-sm leading-relaxed mb-8">
            Enter the code we sent to <span className="text-[color:var(--parchment)]">{email.trim().toLowerCase()}</span> to
            confirm it’s really you.
          </p>

          <form onSubmit={handleVerify} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              // Supabase's OTP length is configurable (6–10). Don't hard-cap at
              // 6 or a longer code can't be fully typed.
              maxLength={10}
              placeholder="Enter code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={submitting}
              className="field-input text-2xl tracking-[0.4em] text-center placeholder:tracking-normal placeholder:text-base"
            />
            <button
              type="submit"
              disabled={submitting || code.length < 6}
              className="btn-brass w-full py-3 text-base"
            >
              {submitting ? 'Verifying…' : 'Verify & continue'}
            </button>

            {error && (
              <div className="alert-error">
                {error}
              </div>
            )}
            {notice && (
              <div className="alert-notice">
                {notice}
              </div>
            )}
          </form>

          <p className="text-sm text-white/55 mt-6 text-center">
            Didn’t get it?{' '}
            <button onClick={resendCode} className="text-[color:var(--brass)] hover:text-[color:var(--parchment)] underline-offset-4 hover:underline">
              Resend code
            </button>
          </p>
        </div>
      </div>
    )
  }

  // ─── Sign in / Sign up steps ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-underground text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="back-link">← Lobby</Link>

        <p className="eyebrow mt-6 mb-3">{mode === 'signin' ? 'Members · Welcome back' : 'New player · Buy in'}</p>
        <h1 className="font-display italic text-5xl md:text-6xl tracking-tight mb-2">
          {mode === 'signin' ? 'Sit down at the table.' : 'Buy in.'}
        </h1>
        <p className="text-white/55 text-sm leading-relaxed mb-8">
          {mode === 'signin'
            ? 'Welcome back. Your history and stats are right where you left them.'
            : 'Pick a username, an email, and a password. We’ll send a 6-digit code to confirm your email.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              minLength={3}
              maxLength={20}
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              className="field-input text-base"
            />
          )}
          <input
            type="email"
            required
            autoFocus={mode === 'signin'}
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="field-input text-base"
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
            className="field-input text-base"
          />
          <button
            type="submit"
            disabled={
              submitting ||
              !email.trim() ||
              password.length < 6 ||
              (mode === 'signup' && username.trim().length < 3)
            }
            className="btn-brass w-full py-3 text-base"
          >
            {submitting
              ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
              : (mode === 'signin' ? 'Sign in' : 'Create account')}
          </button>

          {error && (
            <div className="alert-error">
              {error}
            </div>
          )}
          {notice && (
            <div className="alert-notice">
              {notice}
            </div>
          )}
        </form>

        <p className="text-sm text-white/55 mt-6 text-center">
          {mode === 'signin' ? (
            <>New here? <button onClick={() => flip('signup')} className="text-[color:var(--brass)] hover:text-[color:var(--parchment)] underline-offset-4 hover:underline">Create an account</button></>
          ) : (
            <>Already have one? <button onClick={() => flip('signin')} className="text-[color:var(--brass)] hover:text-[color:var(--parchment)] underline-offset-4 hover:underline">Sign in instead</button></>
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
