"""Hand-strength estimation for poker bots.

Returns a 0–1 score representing how strong a hand is. The preflop scorer
is a heuristic (Chen-formula-flavored); the postflop scorer uses the
`treys` library to categorize the best 5-card hand and maps it to a
score on the same scale.

Phase 4c will replace these with a learned PyTorch feature representation.
"""

from treys import Card, Evaluator

_evaluator = Evaluator()


def _rank_value(rank_char: str) -> int:
    if rank_char == "T":
        return 10
    if rank_char == "J":
        return 11
    if rank_char == "Q":
        return 12
    if rank_char == "K":
        return 13
    if rank_char == "A":
        return 14
    return int(rank_char)


def preflop_strength(hole_cards: list[str]) -> float:
    """Score a starting hand from 0 (worst) to 1 (best)."""
    if len(hole_cards) != 2:
        return 0.0

    c1, c2 = hole_cards
    r1 = _rank_value(c1[0])
    r2 = _rank_value(c2[0])
    high = max(r1, r2)
    low = min(r1, r2)
    is_pair = r1 == r2
    is_suited = c1[1] == c2[1]
    gap = high - low

    if is_pair:
        if high >= 12:
            return 0.90
        if high >= 10:
            return 0.75
        if high >= 7:
            return 0.55
        return 0.40

    strength = (high + low) / 40.0
    if is_suited:
        strength += 0.10
    if gap == 1:
        strength += 0.05
    elif gap >= 3:
        strength -= 0.05 * (gap - 2)
    if high == 14:
        strength += 0.05

    return max(0.0, min(1.0, strength))


# Maps treys rank_class (1=Royal/Straight Flush ... 9=High Card) → our 0–1 scale.
_POSTFLOP_CATEGORY_STRENGTH: dict[int, float] = {
    9: 0.20,  # high card
    8: 0.45,  # pair
    7: 0.65,  # two pair
    6: 0.78,  # three of a kind
    5: 0.85,  # straight
    4: 0.88,  # flush
    3: 0.94,  # full house
    2: 0.98,  # four of a kind
    1: 0.99,  # straight flush / royal
}


def postflop_strength(hole_cards: list[str], community_cards: list[str]) -> float:
    """Score the best 5-card hand reachable from 2 hole cards + 3-5 board cards."""
    try:
        hole_ints = [Card.new(c) for c in hole_cards]
        board_ints = [Card.new(c) for c in community_cards]
    except Exception:
        return 0.15

    rank = _evaluator.evaluate(board_ints, hole_ints)
    rank_class = _evaluator.get_rank_class(rank)
    return _POSTFLOP_CATEGORY_STRENGTH.get(rank_class, 0.15)
