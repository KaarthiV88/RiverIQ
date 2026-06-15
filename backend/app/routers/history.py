"""Phase 6 — hand history persistence + analytics.

  * POST /history/hand     — save one completed hand
  * GET  /history/hands    — list recent hands for a user
  * GET  /history/stats    — aggregate poker stats (added in Step 2)
  * GET  /history/leaks    — flagged leak findings   (added in Step 2)

The hero is identified by an anonymous UUID the frontend persists in
localStorage. No auth in v1. Phase 7 will gate this behind real users.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.history.supabase_client import SupabaseNotConfigured, get_client
from app.history.stats import Stats, compute_stats
from app.history.leaks import Finding, detect_leaks

router = APIRouter(prefix="/history", tags=["history"])


class OpponentSummary(BaseModel):
    name: str
    position: str
    personality: str | None = None


class ActionEntry(BaseModel):
    street: str
    actor_id: str
    actor_name: str
    position: str
    action: str
    amount: float = 0


class HandSummary(BaseModel):
    user_id: str = Field(..., description="Anonymous browser UUID")
    difficulty: str
    table_size: int = Field(..., ge=2, le=9)
    hero_position: str = Field(..., alias="position")
    hole_cards: list[str]
    board_cards: list[str] = Field(default_factory=list)
    pot_size: float
    hero_starting_chips: float
    hero_ending_chips: float
    won: bool
    went_to_showdown: bool
    street_reached: str
    opponents: list[OpponentSummary] = Field(default_factory=list)
    winners: list[str] = Field(default_factory=list)
    actions: list[ActionEntry] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


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
def save_hand(hand: HandSummary) -> dict:
    try:
        sb = get_client()
    except SupabaseNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))

    payload = {
        "user_id": hand.user_id,
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
def list_hands(
    user_id: str = Query(..., description="Anonymous browser UUID"),
    limit: int = Query(50, ge=1, le=200),
) -> list[StoredHand]:
    return [_row_to_stored(r) for r in _fetch_recent_rows(user_id, limit)]


@router.get("/stats", response_model=Stats)
def get_stats(
    user_id: str = Query(...),
    limit: int = Query(200, ge=1, le=1000),
) -> Stats:
    return compute_stats(_fetch_recent_rows(user_id, limit))


@router.get("/leaks", response_model=list[Finding])
def get_leaks(
    user_id: str = Query(...),
    limit: int = Query(200, ge=1, le=1000),
) -> list[Finding]:
    stats = compute_stats(_fetch_recent_rows(user_id, limit))
    return detect_leaks(stats)
