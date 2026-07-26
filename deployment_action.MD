# RiverIQ — Deployment Action Plan

Working doc to resume from after a pause. Captures decisions made, what's
already done, and the concrete next steps to ship.

Last updated: 2026-06-25

---

## Chosen stack

| Layer | Service | Why |
|---|---|---|
| Frontend host | **Vercel** (free) | Built by the Next.js team; GitHub-integrated deploys |
| Backend host | **Railway** ($5/mo credit free) | Builds FastAPI from `requirements.txt`; supports long-lived SSE |
| Database | **Supabase** (free) | Already in stack; pairs with Supabase Auth |
| Auth | **Supabase Auth** (free, 50k MAU) | Same vendor; JWT integrates with Postgres RLS |
| LLM | **Groq** (already integrated) | No change |
| Keepalive | **GitHub Actions** cron (free) | Pings backend every ~6 days to prevent Supabase pause |
| Edge protection (later) | **Cloudflare** (free) | WAF + IP-level rate limits + DDoS shielding |

---

## What's already done (Phase 8a — Hardening)

Hardening pass completed before this doc. Don't redo:

- **Rate limiting** via `slowapi` on every route, keyed by IP with
  `X-Forwarded-For` awareness for proxy/CDN scenarios. See
  [`backend/app/limits.py`](backend/app/limits.py).
  - `/coach/*` — 20/hr (LLM cost)
  - `/equity/calculate` — 30/min, `/equity/hero` — 120/min
  - `/bot/decide` — 240/min
  - `/history/hand` POST — 60/min
  - `/history/hands` DELETE — 5/hr
  - `/history/hands|stats|leaks` GET — 30/min
  - Custom 429 handler returns the limit string in the JSON detail.
- **Pydantic payload caps** on every router:
  - Coach: 4000 chars/message, 40 messages/request
  - History `HandSummary`: actions ≤ 200, opponents/winners ≤ 9, card-array bounds, all string lengths bounded
  - Bot: hole_cards exactly 2, community ≤ 5, numeric `ge=0`
  - Equity: card-string length bounded
- **CORS env-driven** via `CORS_ALLOW_ORIGINS` (comma-separated) in
  [`backend/app/config.py`](backend/app/config.py). Default
  `http://localhost:3000`. Allowed methods narrowed to GET/POST/DELETE/OPTIONS.
- **Security headers middleware** on every response:
  `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, `Strict-Transport-Security`.
- **Per-user row ceiling** of 5000 hands on `/history/hand` POST. Returns 409
  when exceeded. Configurable via `MAX_HANDS_PER_USER` env var.
- **Secret audit clean** — `.env*` gitignored, no key value ever committed,
  no JWT or Groq prefix in commit history.

---

## Open questions and decisions

### 1. Auto-redeploy on push

**Yes — every push to `main` auto-rebuilds and rolls out (~1–3 min).** Both
Vercel and Railway integrate with GitHub. No manual redeploy needed. Manual
rebuild / instant rollback available in each dashboard.

### 2. Keeping Supabase awake

Free tier pauses after **7 days inactivity**.
**Decision: cron ping via GitHub Actions** (free, no extra vendor).
A workflow on a 6-day schedule hits `/health`, which touches Supabase.

To do later — add `.github/workflows/keepalive.yml`:

```yaml
name: keepalive
on:
  schedule: [ { cron: "0 12 */6 * *" } ]
  workflow_dispatch: {}
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS "${{ vars.HEALTHCHECK_URL }}/health"
```

Set repo variable `HEALTHCHECK_URL` to the Railway backend URL.

Also: extend `/health` to do a tiny Supabase read so the touch actually
counts. Right now it just returns `{"status":"ok"}`. Should query e.g.
`SELECT 1` against the `hands` table to register activity.

### 3. Authentication

**Decision: Supabase Auth** (built into the stack we already use).

Flow:
- Frontend imports `@supabase/supabase-js`, opens a sign-in form
- User signs in → Supabase returns a JWT
- Frontend sends `Authorization: Bearer <jwt>` on every backend call
- Backend verifies JWT against Supabase's public JWKS, extracts the user UUID
- Backend uses that UUID as `user_id` instead of trusting the client-supplied
  localStorage UUID

Replaces the current anonymous UUID model. Big win: cross-user data wipes
(theoretical risk under anonymous UUIDs) become structurally impossible.

Providers to enable in Supabase dashboard (`Authentication → Providers`):
- Email (magic link)
- Google OAuth (optional, requires Google Cloud OAuth client setup)

### 4. Docker

**Decision: skip.** Railway builds FastAPI directly from `requirements.txt`;
Vercel detects Next.js automatically. Adding a `Dockerfile` is reversible
later if needed (e.g. for a VPS migration).

### 5. Vercel scope

**Decision: Vercel for frontend only.** Backend goes on Railway because
Vercel's Python serverless is awkward for the streaming SSE coach endpoint.

---

## Accounts to create

Already have: Supabase, Groq, GitHub.

To register (use GitHub login for both):

- [ ] **Vercel** — vercel.com/signup
- [ ] **Railway** — railway.app/login
- [ ] **Cloudflare** (later, optional) — cloudflare.com/sign-up

---

## Secrets / env vars by platform

No new API keys to procure — just need to copy existing values into the
hosting dashboards.

### Supabase dashboard (already have project)

From `Settings → API`:
- `Project URL` → `https://xxxxx.supabase.co`
- `service_role` secret → backend only, **never** in frontend
- `anon public` key → safe for frontend

From `Authentication → Providers`:
- Enable Email
- (Optional) Enable Google

### Railway (backend host)

Connect GitHub → pick repo → set root to `backend/`.
Add env variables:

```
GROQ_API_KEY                = <groq key>
SUPABASE_URL                = https://xxxxx.supabase.co
SUPABASE_ANON_KEY           = <anon key>
SUPABASE_SERVICE_ROLE_KEY   = <service role secret>
CORS_ALLOW_ORIGINS          = https://<your-frontend>.vercel.app
MAX_HANDS_PER_USER          = 5000    # optional, has a default
```

After deploy, Railway gives a public URL like
`riveriq-api.up.railway.app`. Save it for the frontend's env.

### Vercel (frontend host)

Connect GitHub → pick repo → set root to `frontend/`.
Add env variables (`Settings → Environment Variables`):

```
NEXT_PUBLIC_API_BASE          = https://riveriq-api.up.railway.app
NEXT_PUBLIC_SUPABASE_URL      = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key>
```

After Vercel deploys, copy the generated URL (e.g. `riveriq.vercel.app`)
back into Railway's `CORS_ALLOW_ORIGINS`.

### GitHub repository variables (for keepalive workflow)

`Settings → Secrets and variables → Actions → Variables`:

```
HEALTHCHECK_URL = https://riveriq-api.up.railway.app
```

---

## Order of operations to ship

Recommended sequence. Don't skip ahead — auth needs to be in place before
the backend URL ever sees public traffic, and CORS needs the real Vercel URL.

1. **Supabase Auth integration** (largest single change, do first locally)
   - Add `@supabase/supabase-js` to frontend
   - Build a sign-in screen (email magic link is simplest)
   - Add a Supabase auth context / hook
   - Send `Authorization: Bearer <jwt>` on every backend call
   - Backend: add JWT verification middleware against Supabase JWKS
   - Replace client-supplied `user_id` with the verified UUID from the JWT
   - Migrate existing anonymous-UUID data path: either drop it or build a
     "claim my prior session" flow that links localStorage UUID → new auth ID
2. **Extend `/health`** to touch Supabase so the keepalive cron actually
   counts as activity.
3. **Deploy backend to Railway**
   - Connect repo, set root, add env vars from the list above
   - Note the public URL
4. **Deploy frontend to Vercel**
   - Connect repo, set root, add env vars from the list above
   - Note the public URL
5. **Update Railway's `CORS_ALLOW_ORIGINS`** to the Vercel URL → triggers
   backend redeploy
6. **Add the keepalive workflow** (`.github/workflows/keepalive.yml`)
   plus the `HEALTHCHECK_URL` repo variable.
7. **Smoke test prod** — sign up, play a hand, hit the coach, check
   /history and /stats and /visualize all load.
8. **(Optional later)** Put Cloudflare in front: add domain → enable proxy
   → add a WAF rule for the rate-limit equivalents at edge.

---

## Things to remember after the pause

- The `frontend/AGENTS.md` warning still applies: this Next.js has breaking
  changes from common knowledge; always check `node_modules/next/dist/docs/`.
- Backend venv lives at `/Users/kaart/RiverIQ/.venv` (not in `backend/`).
  Use `/Users/kaart/RiverIQ/.venv/bin/python` and `.venv/bin/pip`.
- Dev server already runs on `localhost:3000` (PIDs 802, 7622 as of writing).
- Frontend typecheck command:
  `cd frontend && npx tsc --noEmit 2>&1 | grep -v "brimSide\|BotAvatars"`
  (those two warnings are pre-existing and unrelated.)

---

## Out of scope for this phase

Capture for later, do not let them sneak in:

- Multi-instance backend (would need Redis-backed slowapi storage)
- Migration off Supabase (Neon / Railway Postgres) — reconsider only if free
  tier becomes untenable
- Frontend i18n
- Real-time multiplayer (current bots are bots; no human-vs-human)
- Switching to Docker
