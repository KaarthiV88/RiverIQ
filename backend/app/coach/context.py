"""Structured game-state context for the coach (RAG-lite).

What's "retrieved" here isn't documents — it's *facts*. Equity, pot odds,
SPR, opponent personality blurbs, and a pretty-printed action history all
get computed deterministically from the game state and stitched into the
LLM prompt. That's what keeps the coach's answers grounded in the actual
spot instead of generic poker advice.

Equity is the expensive bit: a Monte Carlo simulation of the hero's hand
vs. N random opponent hands. Cached by (hand, board, num_opps) so repeated
questions about the same spot don't re-pay the cost.
"""

from __future__ import annotations

import random
from functools import lru_cache

from pydantic import BaseModel, Field
from treys import Card, Evaluator

_evaluator = Evaluator()


# ── Request payload ───────────────────────────────────────────────────────────

class OpponentInfo(BaseModel):
    name: str
    position: str
    chips: float
    current_bet: float
    status: str            # 'active' | 'folded' | 'all-in' | 'sitting-out' | 'busted'
    personality: str | None = None


class HistoryEntry(BaseModel):
    street: str            # 'preflop' | 'flop' | 'turn' | 'river'
    actor: str             # human-readable, e.g. "T. Dwan (CO)"
    action: str            # 'fold' | 'check' | 'call' | 'raise' | 'bet'
    amount: float = 0


class GameContext(BaseModel):
    # Hero's perspective only — never include opponents' hole cards.
    hole_cards: list[str] = Field(default_factory=list)
    community_cards: list[str] = Field(default_factory=list)
    street: str = "preflop"

    pot: float = 0
    current_bet: float = 0
    min_raise: float = 0
    big_blind: float = 20

    my_position: str = "BTN"
    my_chips: float = 0
    my_current_bet: float = 0

    num_active: int = 0
    opponents: list[OpponentInfo] = Field(default_factory=list)
    history: list[HistoryEntry] = Field(default_factory=list)


# ── Equity (hero vs N random hands) ──────────────────────────────────────────

def _hero_equity_uncached(
    hand_key: tuple[str, ...],
    board_key: tuple[str, ...],
    num_opps: int,
    sims: int,
) -> float:
    """Monte Carlo: hero hand vs `num_opps` random hands.

    Assumes opponent ranges are uniform — a reasonable v1 baseline. A future
    iteration can fold the personality-aware range model from Phase 4e in here.
    """
    if num_opps < 1:
        return 1.0

    hero = [Card.new(c) for c in hand_key]
    board = [Card.new(c) for c in board_key]
    known = set(hero) | set(board)

    full_deck = [Card.new(r + s) for r in "23456789TJQKA" for s in "shdc"]
    remaining = [c for c in full_deck if c not in known]

    cards_needed = 5 - len(board)
    wins = 0.0

    for _ in range(sims):
        # Deal opponents' hole cards then runout, all from the same deck.
        random.shuffle(remaining)
        cursor = 0
        opp_hands = []
        for _ in range(num_opps):
            opp_hands.append(remaining[cursor:cursor + 2])
            cursor += 2
        runout = remaining[cursor:cursor + cards_needed]
        full_board = board + runout

        hero_rank = _evaluator.evaluate(full_board, hero)
        opp_ranks = [_evaluator.evaluate(full_board, h) for h in opp_hands]
        best_opp = min(opp_ranks)

        if hero_rank < best_opp:
            wins += 1
        elif hero_rank == best_opp:
            # Split with however many tied opponents.
            tied = 1 + sum(1 for r in opp_ranks if r == hero_rank)
            wins += 1 / tied

    return wins / sims


@lru_cache(maxsize=512)
def hero_equity(
    hand: tuple[str, ...],
    board: tuple[str, ...],
    num_opps: int,
    sims: int = 2000,
) -> float:
    """Cached wrapper. Inputs must be tuples so they're hashable."""
    return _hero_equity_uncached(hand, board, num_opps, sims)


# ── Derived metrics ───────────────────────────────────────────────────────────

def pot_odds(call_amount: float, pot: float) -> float | None:
    """Price you're getting on a call, as a fraction (0–1). None if no call."""
    if call_amount <= 0:
        return None
    return call_amount / (pot + call_amount)


def stack_to_pot_ratio(chips: float, pot: float) -> float | None:
    """SPR — effective stack divided by pot. None on an empty pot."""
    if pot <= 0:
        return None
    return chips / pot
