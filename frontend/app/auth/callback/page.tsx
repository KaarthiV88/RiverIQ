'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../lib/auth'

const NEXT_KEY = 'riveriq:postSignInPath'

/** Auth callback landing page.
 *
 *  Reserved for any future flow that exits the app and comes back (magic
 *  link, OAuth). Today's primary path is email + password, which doesn't
 *  route through here — but if a magic link is ever wired up, this page
 *  is what `emailRedirectTo` should point at.
 *
 *  supabase-js (with `detectSessionInUrl: true`) handles the token
 *  exchange automatically. We just wait for the session and bounce.
 *  The legacy-hand claim now lives in AuthProvider, so it fires here too
 *  via the normal session-change path.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const { session } = useAuth()

  useEffect(() => {
    if (session === undefined) return
    if (!session) {
      router.replace('/signin?error=link_expired')
      return
    }
    const next = typeof window !== 'undefined' ? sessionStorage.getItem(NEXT_KEY) : null
    if (next) sessionStorage.removeItem(NEXT_KEY)
    router.replace(next || '/')
  }, [session, router])

  return (
    <div className="min-h-screen bg-underground text-white flex items-center justify-center">
      <div className="text-white/60 text-sm">Signing you in…</div>
    </div>
  )
}
