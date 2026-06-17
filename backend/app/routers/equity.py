import random as rand
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from treys import Card, Deck, Evaluator

router = APIRouter(prefix="/equity", tags=["equity"])
evaluator = Evaluator()


class EquityRequest(BaseModel):
    players: list[list[str]]
    board: list[str] = []
    simulations: int = 10000

    @field_validator("players")
    @classmethod
    def validate_players(cls, v):
        if not (2 <= len(v) <= 9):
            raise ValueError("Must have 2–9 players")
        for hand in v:
            if len(hand) != 2:
                raise ValueError("Each player must have exactly 2 hole cards")
        return v

    @field_validator("board")
    @classmethod
    def validate_board(cls, v):
        if len(v) > 4:
            raise ValueError("Board can have at most 4 cards (pre-river)")
        return v

    @field_validator("simulations")
    @classmethod
    def validate_simulations(cls, v):
        if not (100 <= v <= 100000):
            raise ValueError("Simulations must be between 100 and 100,000")
        return v

    @classmethod
    def validate_simulations(cls, v):
        if not (100 <= v <= 100000):
            raise ValueError("Simulations must be between 100 and 100,000")
        return v


class EquityResponse(BaseModel):
    equities: list[float]
    simulations_run: int


def parse_cards(card_strings: list[str]) -> list[int]:
    try:
        return [Card.new(c) for c in card_strings]
    except Exception:
        raise HTTPException(status_code=422, detail=f"Invalid card(s): {card_strings}")



class HeroEquityResponse(BaseModel):
    equity: float


@router.get("/hero", response_model=HeroEquityResponse)
async def hero_equity_route(
    hole: str,
    board: str = "",
    num_opps: int = 1,
    sims: int = 1500,
):
    """Compute hero hand vs. N random opponents — used by the in-game coach
    HUD where we need a quick equity readout without asking the LLM. Reuses
    the cached Monte Carlo from coach.context."""
    from app.coach.context import hero_equity

    hole_cards = tuple(c.strip() for c in hole.split(",") if c.strip())
    board_cards = tuple(c.strip() for c in board.split(",") if c.strip())
    if len(hole_cards) != 2:
        raise HTTPException(status_code=400, detail="hole must be two cards, comma-separated")
    if not (1 <= num_opps <= 8):
        raise HTTPException(status_code=400, detail="num_opps must be between 1 and 8")
    if not (200 <= sims <= 5000):
        raise HTTPException(status_code=400, detail="sims must be between 200 and 5000")

    try:
        eq = hero_equity(hole_cards, board_cards, num_opps, sims)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Equity computation failed: {e}")
    return HeroEquityResponse(equity=round(eq, 4))


@router.post("/calculate", response_model=EquityResponse)
async def calculate_equity(request: EquityRequest):
    player_cards = [parse_cards(hand) for hand in request.players]
    board_cards = parse_cards(request.board)

    known = [c for hand in player_cards for c in hand] + board_cards
    full_deck = [Card.new(r + s) for r in "23456789TJQKA" for s in "shdc"]
    remaining = [c for c in full_deck if c not in known]

    cards_needed = 5 - len(board_cards)
    wins = [0] * len(request.players)
    ties = 0

    for _ in range(request.simulations):
        runout = rand.sample(remaining, cards_needed)
        simulated_board = board_cards + runout

        ranks = [
            evaluator.evaluate(simulated_board, hand)
            for hand in player_cards
        ]

        best = min(ranks)
        winners = [i for i, r in enumerate(ranks) if r == best]

        if len(winners) == 1:
            wins[winners[0]] += 1
        else:
            ties += 1
            share = 1 / len(winners)
            for i in winners:
                wins[i] += share

    equities = [round(w / request.simulations, 4) for w in wins]

    return EquityResponse(equities=equities, simulations_run=request.simulations)
