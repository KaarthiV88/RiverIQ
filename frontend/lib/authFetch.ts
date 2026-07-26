/** `fetch` with the user's Supabase JWT auto-attached.
 *
 *  Pulls the current access token from the supabase-js client (which itself
 *  reads from localStorage and refreshes on expiry). If there's no session
 *  the request still goes through — the backend will 401, and the calling
 *  page is responsible for surfacing that as "please sign in".
 */

import { supabase } from './supabaseClient'

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  return fetch(input, { ...init, headers })
}
