'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../lib/auth'

/** Wraps a page in an auth check. While the session is still hydrating we
 *  show a quiet placeholder; if there's no session we bounce to /signin
 *  with a `next` param so the user lands back here after signing in.
 *
 *  Once we know the user is signed in, we render the children. This is
 *  intentionally simple — no server-side gating, which means the page's
 *  HTML payload is still publicly fetchable, but every backend call it
 *  makes requires a JWT. The backend is the actual security boundary;
 *  this gate is for UX. */
export default function SignInGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (session === null && typeof window !== 'undefined') {
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      router.replace(`/signin?next=${next}`)
    }
  }, [session, router])

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-underground flex items-center justify-center text-white/55 text-sm">
        Loading…
      </div>
    )
  }
  if (session === null) {
    // Render nothing while the effect-redirect fires — prevents a flash of
    // protected content.
    return null
  }
  return <>{children}</>
}
