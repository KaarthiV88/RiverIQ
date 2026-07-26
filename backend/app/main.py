from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.bots import orchestrator
from app.config import settings
from app.history.supabase_client import try_get_client
from app.limits import limiter
from app.routers import bot, coach, equity, history


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load the trained policy net once at startup. If no checkpoint exists,
    # orchestrator.decide() silently falls back to the heuristic baseline.
    orchestrator.load_model()
    yield


app = FastAPI(title="RiverIQ API", version="0.1.0", lifespan=lifespan)

# ───────────────────────────────────────────────────────────────────────────
# Rate limiting — per-IP, in-memory. See app/limits.py for the key function.
# ───────────────────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(_request: Request, exc: RateLimitExceeded) -> JSONResponse:
    # Surface the slowapi limit string ("20/hour", "5/hour", …) so the
    # frontend can render a useful message instead of a bare 429.
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}"},
    )


# ───────────────────────────────────────────────────────────────────────────
# Security headers — applied to every response. Conservative, no inline-eval
# CSP because Next.js dev needs more permissive script handling; in prod the
# frontend is served by a separate origin so this only locks the API itself.
# ───────────────────────────────────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # HSTS only meaningful under HTTPS; harmless on http and required in prod.
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


app.add_middleware(SecurityHeadersMiddleware)


# ───────────────────────────────────────────────────────────────────────────
# CORS — env-driven. Set CORS_ALLOW_ORIGINS in prod to a comma-separated
# list of frontend origins. Wildcards are disallowed because we send
# credentials.
# ───────────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


app.include_router(equity.router)
app.include_router(bot.router)
app.include_router(coach.router)
app.include_router(history.router)


# Defined as a plain `def` (not `async`) so FastAPI runs it in a threadpool.
# The supabase-py client is synchronous; awaiting it inside an async handler
# would block the event loop on a network round-trip.
@app.get("/health")
def health():
    """Liveness + a real Supabase touch.

    The touch is what makes the keepalive cron count as activity: a trivial
    SELECT executes in Postgres and resets the free-tier idle timer. If
    Supabase isn't configured we still report ok (nothing to keep alive);
    if it's configured but unreachable we report 503 so a monitor can alert.
    """
    client = try_get_client()
    if client is None:
        return {"status": "ok", "supabase": "not_configured"}
    try:
        client.table("hands").select("id").limit(1).execute()
    except Exception as exc:  # noqa: BLE001 — health must never raise
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "supabase": "unreachable", "detail": str(exc)},
        )
    return {"status": "ok", "supabase": "reachable"}
