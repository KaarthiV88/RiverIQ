"""Lazy Supabase client for Phase 6.

The frontend sends its own browser-side UUID as `user_id` (no auth). The
backend writes/reads using the *service-role* key so it can bypass RLS on
behalf of the anonymous user. When Phase 7 introduces real auth we'll flip
RLS back on and re-key off `auth.uid()`.

Client construction is lazy — Supabase isn't required for the rest of the
app to boot. Routes that depend on it will surface a clear error if the
URL/keys aren't configured.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from supabase import Client, create_client

from app.config import settings


class SupabaseNotConfigured(RuntimeError):
    """Raised when a history route is hit but Supabase env vars are missing."""


@lru_cache(maxsize=1)
def get_client() -> Client:
    url = settings.supabase_url
    key = settings.supabase_service_role_key
    if not url or not key:
        raise SupabaseNotConfigured(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env "
            "for history endpoints."
        )
    return create_client(url, key)


def try_get_client() -> Optional[Client]:
    """Returns None instead of raising — useful for health checks."""
    try:
        return get_client()
    except SupabaseNotConfigured:
        return None
