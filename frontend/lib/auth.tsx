'use client'

/** Auth context — single source of truth for "who's signed in".
 *
 *  Wraps the app in <AuthProvider/>. Any component can call useAuth() to get
 *  the current session, the user id, and helpers for sign-in / sign-out.
 *  The session is read once at mount and then kept fresh by supabase-js's
 *  onAuthStateChange listener.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { claimLegacyHands } from './history'
import { getUserId } from './userId'

const CLAIMED_KEY = 'riveriq:legacyClaimed'

interface AuthState {
  /** undefined = still loading; null = no session; Session = signed in. */
  session: Session | null | undefined
  user: User | null
  signOut: () => Promise<void>
  /** Returns the current access token, or null if signed out. */
  getAccessToken: () => string | null
}

const AuthCtx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const claimRanRef = useRef(false)

  useEffect(() => {
    let mounted = true

    // Initial fetch — supabase-js reads the persisted session from
    // localStorage and refreshes it if needed.
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (mounted) setSession(s ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // One-time legacy-hand claim: the first time we see a real session, try
  // to re-key any pre-auth localStorage-UUID rows over to the verified
  // account. Idempotent server-side; we still gate locally so we don't
  // burn the rate limit on every reload.
  useEffect(() => {
    if (!session || claimRanRef.current) return
    claimRanRef.current = true
    if (typeof window === 'undefined') return
    if (localStorage.getItem(CLAIMED_KEY)) return
    const legacy = getUserId()
    if (!legacy || legacy === session.user.id) {
      localStorage.setItem(CLAIMED_KEY, '1')
      return
    }
    claimLegacyHands(legacy)
      .catch(err => {
        // Non-fatal — user just doesn't see their pre-auth hands.
        // eslint-disable-next-line no-console
        console.warn('[auth] legacy claim failed:', err)
      })
      .finally(() => {
        localStorage.setItem(CLAIMED_KEY, '1')
      })
  }, [session])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const getAccessToken = useCallback(() => {
    return session?.access_token ?? null
  }, [session])

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    signOut,
    getAccessToken,
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth() called outside <AuthProvider>')
  return ctx
}
