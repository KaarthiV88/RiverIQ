"""POST /bot/decide — given the current state of a poker hand from the
perspective of one bot, return the action it should take.

Body fields are intentionally minimal: enough to make a decision, nothing
about other players' hole cards or anything the bot shouldn't see.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.bots.baseline import DecisionContext
from app.bots import orchestrator

router = APIRouter(prefix="/bot", tags=["bot"])


class BotDecisionRequest(BaseModel):
    hole_cards: list[str] = Field(..., description="Two cards, e.g. ['Ah','Kd']")
    community_cards: list[str] = Field(default_factory=list)
    pot: float
    current_bet: float = Field(..., description="Highest bet on this street")
    player_current_bet: float = Field(..., description="Bot's chips already in this street")
    player_chips: float
    min_raise: float
    big_blind: float = Field(default=20.0, description="Big blind size, used for sizing")
    street: str = Field(..., description="'preflop' | 'flop' | 'turn' | 'river'")
    personality: str
    position: str
    num_active: int


class BotDecisionResponse(BaseModel):
    action: str
    amount: float


@router.post("/decide", response_model=BotDecisionResponse)
async def decide_bot_action(request: BotDecisionRequest) -> BotDecisionResponse:
    ctx = DecisionContext(
        hole_cards=request.hole_cards,
        community_cards=request.community_cards,
        pot=request.pot,
        current_bet=request.current_bet,
        player_current_bet=request.player_current_bet,
        player_chips=request.player_chips,
        min_raise=request.min_raise,
        big_blind=request.big_blind,
        personality=request.personality,
        position=request.position,
        street=request.street,
        num_active=request.num_active,
    )
    decision = orchestrator.decide(ctx)
    return BotDecisionResponse(action=decision.action, amount=decision.amount)
