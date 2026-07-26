/** Browser-side Supabase client.
 *
 *  Only the anon key — safe to ship to the client. Service-role NEVER lives
 *  in the frontend. Session storage uses localStorage by default; supabase-js
 *  handles refresh tokens and automatic JWT renewal on its own.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loud at import time in dev so missing env doesn't manifest as a
  // confusing "user is always signed out" later. Build won't break because
  // process.env values are inlined at build time, not import time.
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.error('[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
  }
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,   // catches the #access_token in the magic-link callback
  },
})
