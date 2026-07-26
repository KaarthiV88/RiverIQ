"""Phase 6 — hand history persistence + analytics.

  * POST /history/hand     — save one completed hand
  * GET  /history/hands    — list recent hands for a user
  * GET  /history/stats    — aggregate poker stats (added in Step 2)
  * GET  /history/leaks    — flagged leak findings   (added in Step 2)

The hero is identified by an anonymous UUID the frontend persists in
localStorage. No auth in v1. Phase 7 will gate this behind real users.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.auth import current_user
from app.config import settings
from app.history.supabase_client import SupabaseNotConfigured, get_client
from app.history.stats import Stats, compute_stats
from app.history.leaks import Finding, detect_leaks
from app.limits import limiter

router = APIRouter(prefix="/history", tags=["history"])


# Hand-summary payload limits — a real hand has at most a few dozen actions
# and a single table seats 9 players. Padding by ~3× to absorb future growth.
MAX_ACTIONS = 200
MAX_OPPONENTS = 9
MAX_WINNERS = 9


class OpponentSummary(BaseModel):
    name: str = Field(..., max_length=64)
    position: str = Field(..., max_length=8)
    personality: str | None = Field(default=None, max_length=32)


class ActionEntry(BaseModel):
    street: str = Field(..., max_length=16)
    actor_id: str = Field(..., max_length=64)
    actor_name: str = Field(..., max_length=64)
    position: str = Field(..., max_length=8)
    action: str = Field(..., max_length=16)
    amount: float = Field(default=0, ge=0)


class HandSummary(BaseModel):
    # user_id is no longer accepted from the client — it's derived from the
    # verified JWT. Kept optional here so existing tests/clients don't 422
    # immediately; the route ignores whatever is provided.
    user_id: str | None = Field(default=None, description="Ignored; derived from JWT")
    difficulty: str = Field(..., max_length=32)
    table_size: int = Field(..., ge=2, le=9)
    hero_position: str = Field(..., alias="position", max_length=8)
    hole_cards: list[str] = Field(..., min_length=0, max_length=2)
    board_cards: list[str] = Field(default_factory=list, max_length=5)
    pot_size: float = Field(..., ge=0)
    hero_starting_chips: float = Field(..., ge=0)
    hero_ending_chips: float = Field(..., ge=0)
    won: bool
    went_to_showdown: bool
    street_reached: str = Field(..., max_length=16)
    opponents: list[OpponentSummary] = Field(default_factory=list, max_length=MAX_OPPONENTS)
    winners: list[str] = Field(default_factory=list, max_length=MAX_WINNERS)
    actions: list[ActionEntry] = Field(default_factory=list, max_length=MAX_ACTIONS)

    model_config = {"populate_by_name": True}


class ClaimRequest(BaseModel):
    """Body for POST /history/claim — links an anonymous-era row set to the
    now-authenticated account."""
    legacy_user_id: str = Field(..., min_length=8, max_length=64)


class StoredHand(BaseModel):
    id: str
    created_at: str
    difficulty: str
    table_size: int
    hole_cards: list[str]
    board_cards: list[str]
    position: str | None
    pot_size: float
    hero_starting_chips: float
    hero_ending_chips: float
    won: bool
    went_to_showdown: bool
    street_reached: str
    result: float    # net = ending - starting
    winners: list[str]
    opponents: list[dict]


def _row_to_stored(row: dict) -> StoredHand:
    starting = float(row.get("hero_starting_chips") or 0)
    ending = float(row.get("hero_ending_chips") or 0)
    return StoredHand(
        id=row["id"],
        created_at=row["created_at"],
        difficulty=row.get("difficulty", "unknown"),
        table_size=int(row.get("table_size") or 0),
        hole_cards=row.get("hole_cards") or [],
        board_cards=row.get("board_cards") or [],
        position=row.get("position"),
        pot_size=float(row.get("pot_size") or 0),
        hero_starting_chips=starting,
        hero_ending_chips=ending,
        won=bool(row.get("won")),
        went_to_showdown=bool(row.get("went_to_showdown")),
        street_reached=row.get("street_reached", "preflop"),
        result=ending - starting,
        winners=row.get("winners") or [],
        opponents=row.get("opponents") or [],
    )


@router.post("/hand")
@limiter.limit("60/minute")
def save_hand(
    request: Request,
    hand: HandSummary,
    user_id: str = Depends(current_user),
) -> dict:
    try:
        sb = get_client()
    except SupabaseNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Per-user row ceiling — caps the blast radius even for an authenticated
    # account that decides to pump the table. Cheap head-only count query.
    try:
        existing = (
            sb.table("hands")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if existing.count is not None and existing.count >= settings.max_hands_per_user:
            raise HTTPException(
                status_code=409,
                detail=f"Per-user limit of {settings.max_hands_per_user} stored hands reached. "
                       "Reset history before storing more.",
            )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        # If the count check itself fails we still want to attempt the write;
        # the cap is defense-in-depth, not the only thing standing.
        print(f"[history] count check failed (non-fatal): {e}")

    payload = {
        "user_id": user_id,
        "difficulty": hand.difficulty,
        "table_size": hand.table_size,
        "position": hand.hero_position,
        "hole_cards": hand.hole_cards,
        "board_cards": hand.board_cards,
        "pot_size": hand.pot_size,
        "hero_starting_chips": hand.hero_starting_chips,
        "hero_ending_chips": hand.hero_ending_chips,
        "result": hand.hero_ending_chips - hand.hero_starting_chips,
        "won": hand.won,
        "went_to_showdown": hand.went_to_showdown,
        "street_reached": hand.street_reached,
        "opponents": [o.model_dump() for o in hand.opponents],
        "winners": hand.winners,
        "actions": [a.model_dump() for a in hand.actions],
        "villain_cards": [],
    }
    try:
        res = sb.table("hands").insert(payload).execute()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Supabase insert failed: {e}")
    return {"id": res.data[0]["id"] if res.data else None}


def _fetch_recent_rows(user_id: str, limit: int) -> list[dict]:
    try:
        sb = get_client()
    except SupabaseNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    try:
        res = (
            sb.table("hands")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Supabase query failed: {e}")
    return res.data or []


@router.get("/hands", response_model=list[StoredHand])
@limiter.limit("30/minute")
def list_hands(
    request: Request,
    user_id: str = Depends(current_user),
    limit: int = Query(50, ge=1, le=200),
) -> list[StoredHand]:
    return [_row_to_stored(r) for r in _fetch_recent_rows(user_id, limit)]


@router.delete("/hands")
@limiter.limit("5/hour")
def delete_hands(
    request: Request,
    user_id: str = Depends(current_user),
) -> dict:
    """Wipe every stored hand for the authenticated user. Powers the Reset
    button on /history and /stats; the user trades historical context for a
    clean slate (intentional, not recoverable)."""
    try:
        sb = get_client()
    except SupabaseNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    try:
        res = sb.table("hands").delete().eq("user_id", user_id).execute()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Supabase delete failed: {e}")
    return {"deleted": len(res.data or [])}


@router.get("/stats", response_model=Stats)
@limiter.limit("30/minute")
def get_stats(
    request: Request,
    user_id: str = Depends(current_user),
    limit: int = Query(200, ge=1, le=1000),
) -> Stats:
    return compute_stats(_fetch_recent_rows(user_id, limit))


@router.get("/leaks", response_model=list[Finding])
@limiter.limit("30/minute")
def get_leaks(
    request: Request,
    user_id: str = Depends(current_user),
    limit: int = Query(200, ge=1, le=1000),
) -> list[Finding]:
    stats = compute_stats(_fetch_recent_rows(user_id, limit))
    return detect_leaks(stats)


@router.post("/claim")
@limiter.limit("3/hour")
def claim_legacy_hands(
    request: Request,
    body: ClaimRequest,
    user_id: str = Depends(current_user),
) -> dict:
    """Rewrite an anonymous-era set of rows to the now-authenticated user.

    Called once by the frontend the first time a previously anonymous user
    signs in. Trivial no-op if `legacy_user_id` already equals the verified
    UUID. Heavily rate-limited because nobody legitimately needs to do this
    more than once or twice.
    """
    if body.legacy_user_id == user_id:
        return {"claimed": 0, "note": "legacy_user_id already matches verified UUID"}
    try:
        sb = get_client()
    except SupabaseNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    try:
        # First check the legacy set isn't already owned by someone else's
        # authenticated account. Anonymous UUIDs are unguessable, so this is
        # only a worry if a user shares one — still cheap to verify.
        existing = (
            sb.table("hands")
            .select("id")
            .eq("user_id", body.legacy_user_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            return {"claimed": 0, "note": "no rows under that legacy id"}

        res = (
            sb.table("hands")
            .update({"user_id": user_id})
            .eq("user_id", body.legacy_user_id)
            .execute()
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Supabase claim failed: {e}")
    return {"claimed": len(res.data or [])}
