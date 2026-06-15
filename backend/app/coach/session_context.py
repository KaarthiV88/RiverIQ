"""Pulls the user's recent leak summary for the coach to reference.

The summary is the one-liner produced by `leaks.leaks_summary` over the
user's last ~200 hands. Cached with a short TTL so a chatty conversation
doesn't hit Supabase on every send.
"""

from __future__ import annotations

import time

from app.history.leaks import detect_leaks, leaks_summary
from app.history.stats import compute_stats
from app.history.supabase_client import SupabaseNotConfigured, get_client

# Minimum hands before we tell the coach anything — small samples produce
# misleading summaries.
MIN_HANDS_FOR_SUMMARY = 10

# Per-user cache: user_id → (expires_at_epoch, summary).
_TTL_SECONDS = 30.0
_cache: dict[str, tuple[float, str]] = {}


def get_user_leak_summary(user_id: str) -> str | None:
    """Returns a single-sentence leak summary, or None if unavailable."""
    if not user_id:
        return None

    now = time.time()
    cached = _cache.get(user_id)
    if cached and cached[0] > now:
        return cached[1]

    try:
        sb = get_client()
    except SupabaseNotConfigured:
        return None

    try:
        res = (
            sb.table("hands")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        )
    except Exception:  # noqa: BLE001
        return None

    rows = res.data or []
    if len(rows) < MIN_HANDS_FOR_SUMMARY:
        return None

    stats = compute_stats(rows)
    findings = detect_leaks(stats)
    summary = leaks_summary(findings)
    _cache[user_id] = (now + _TTL_SECONDS, summary)
    return summary
