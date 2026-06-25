"""Per-IP rate limiting.

Built on slowapi (a FastAPI-friendly port of Flask-Limiter). The Limiter is
in-memory — fine for a single-instance deploy. If the app ever scales out,
swap `storage_uri="memory://"` for a Redis URL and limits will share state
across workers.

When the app sits behind a reverse proxy / CDN (Cloudflare, nginx, Vercel
edge), the client IP arrives in `X-Forwarded-For`. `_client_ip` honors that
header when present so per-IP limits don't all collapse onto the proxy IP.
"""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter


def _client_ip(request: Request) -> str:
    # XFF format: "client, proxy1, proxy2" — the leftmost entry is the original
    # client. Trust this only when behind a proxy you control; in dev it's safe
    # because nothing sets it.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else "anonymous"


limiter = Limiter(key_func=_client_ip, storage_uri="memory://")
