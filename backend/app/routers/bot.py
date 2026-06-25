"""POST /bot/decide — given the current state of a poker hand from the
perspective of one bot, return the action it should take.

Body fields are intentionally minimal: enough to make a decision, nothing
about other players' hole cards or anything the bot shouldn't see.
"""

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, field_validator

from app.bots.baseline import DecisionContext
from app.bots import orchestrator
from app.limits import limiter

router = APIRouter(prefix="/bot", tags=["bot"])


class BotDecisionRequest(BaseModel):
    hole_cards: list[str] = Field(..., description="Two cards, e.g. ['Ah','Kd']")
    community_cards: list[str] = Field(default_factory=list, max_length=5)
    pot: float = Field(..., ge=0)
    current_bet: float = Field(..., ge=0, description="Highest bet on this street")
    player_current_bet: float = Field(..., ge=0, description="Bot's chips already in this street")
    player_chips: float = Field(..., ge=0)
    min_raise: float = Field(..., ge=0)
    big_blind: float = Field(default=20.0, gt=0, description="Big blind size, used for sizing")
    street: str = Field(..., max_length=16, description="'preflop' | 'flop' | 'turn' | 'river'")
    personality: str = Field(..., max_length=32)
    position: str = Field(..., max_length=8)
    num_active: int = Field(..., ge=2, le=9)

    @field_validator("hole_cards")
    @classmethod
    def _validate_hole(cls, v: list[str]) -> list[str]:
        if len(v) != 2:
            raise ValueError("hole_cards must contain exactly 2 cards")
        for c in v:
            if not isinstance(c, str) or not (2 <= len(c) <= 3):
                raise ValueError("each card must be a 2- or 3-char string")
        return v

    @field_validator("community_cards")
    @classmethod
    def _validate_board(cls, v: list[str]) -> list[str]:
        for c in v:
            if not isinstance(c, str) or not (2 <= len(c) <= 3):
                raise ValueError("each community card must be a 2- or 3-char string")
        return v


class BotDecisionResponse(BaseModel):
    action: str
    amount: float


@router.post("/decide", response_model=BotDecisionResponse)
@limiter.limit("240/minute")
async def decide_bot_action(request: Request, payload: BotDecisionRequest) -> BotDecisionResponse:
    ctx = DecisionContext(
        hole_cards=payload.hole_cards,
        community_cards=payload.community_cards,
        pot=payload.pot,
        current_bet=payload.current_bet,
        player_current_bet=payload.player_current_bet,
        player_chips=payload.player_chips,
        min_raise=payload.min_raise,
        big_blind=payload.big_blind,
        personality=payload.personality,
        position=payload.position,
        street=payload.street,
        num_active=payload.num_active,
    )
    decision = orchestrator.decide(ctx)
    return BotDecisionResponse(action=decision.action, amount=decision.amount)
