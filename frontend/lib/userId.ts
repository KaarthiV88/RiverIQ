/** Anonymous browser-side user identifier.
 *
 *  Phase 6 persists hands without auth. A UUID is generated on first visit
 *  and kept in localStorage. Phase 7 (auth) will replace this with the
 *  Supabase user id once we wire that up.
 */

const STORAGE_KEY = 'riveriq:user_id'

function makeUUID(): string {
  // crypto.randomUUID is available in all modern browsers; fall back just in case.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Cheap fallback that is *not* RFC-compliant but is sufficient as a key.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Get-or-create the user's anon UUID. Returns null during SSR. */
export function getUserId(): string | null {
  if (typeof window === 'undefined') return null
  let id = window.localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = makeUUID()
    window.localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}
