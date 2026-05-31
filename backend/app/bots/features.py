"""State → feature vector encoding for the policy network.

Produces a fixed 73-dim float vector from a DecisionContext. Layout:

    [0..13)   hole high-card rank (one-hot)
    [13..26)  hole low-card rank (one-hot)
    [26]      suited flag
    [27]      pair flag
    [28..41)  board rank counts (0..4 per rank)
    [41..45)  board suit counts (0..5 per suit)  — flush-draw signal
    [45]      hand_strength (0..1) — current heuristic score
    [46]      pot_odds (0..1)
    [47]      pot / BB, capped at 100, scaled 0..1
    [48]      stack / BB, capped at 200, scaled 0..1
    [49]      stack-to-pot ratio, capped at 50, scaled 0..1
    [50..59)  position one-hot (BTN/SB/BB/UTG/UTG+1/UTG+2/LJ/HJ/CO)
    [59..63)  street one-hot (preflop/flop/turn/river)
    [63]      num_active / 9
    [64..72)  personality one-hot (8 archetypes)
    [72]      facing_bet binary

The exact order matters for training/inference consistency. Don't reorder.
"""

import numpy as np

# Keep this in sync with the indexing layout above.
FEATURE_DIM = 73

RANK_TO_IDX = {"2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6,
               "9": 7, "T": 8, "J": 9, "Q": 10, "K": 11, "A": 12}
SUIT_TO_IDX = {"h": 0, "d": 1, "c": 2, "s": 3}

POSITION_TO_IDX = {
    "BTN": 0, "SB": 1, "BB": 2, "UTG": 3, "UTG+1": 4,
    "UTG+2": 5, "LJ": 6, "HJ": 7, "CO": 8,
}
STREET_TO_IDX = {"preflop": 0, "flop": 1, "turn": 2, "river": 3}

# Must match the order used at training time. Adding archetypes later means
# retraining — append at the END only.
PERSONALITY_TO_IDX = {
    "nit": 0, "tag": 1, "lag": 2, "calling-station": 3,
    "maniac": 4, "home-game": 5, "pro": 6, "gto-wizard": 7,
}
NUM_PERSONALITIES = len(PERSONALITY_TO_IDX)


def encode_features(
    *,
    hole_cards: list[str],
    community_cards: list[str],
    pot: float,
    current_bet: float,
    player_current_bet: float,
    player_chips: float,
    big_blind: float,
    personality: str,
    position: str,
    street: str,
    num_active: int,
    hand_strength: float,
) -> np.ndarray:
    feats = np.zeros(FEATURE_DIM, dtype=np.float32)
    idx = 0

    # ── Hole cards ─────────────────────────────────────────────────
    if len(hole_cards) == 2:
        r1 = RANK_TO_IDX.get(hole_cards[0][0], 0)
        r2 = RANK_TO_IDX.get(hole_cards[1][0], 0)
        feats[idx + max(r1, r2)] = 1.0
        feats[idx + 13 + min(r1, r2)] = 1.0
        feats[idx + 26] = 1.0 if hole_cards[0][1] == hole_cards[1][1] else 0.0
        feats[idx + 27] = 1.0 if r1 == r2 else 0.0
    idx += 28

    # ── Board ──────────────────────────────────────────────────────
    for c in community_cards:
        r = RANK_TO_IDX.get(c[0])
        s = SUIT_TO_IDX.get(c[1])
        if r is not None:
            feats[idx + r] += 1.0
        if s is not None:
            feats[idx + 13 + s] += 1.0
    idx += 17

    # ── Scalar context ─────────────────────────────────────────────
    feats[idx] = hand_strength
    idx += 1

    call_amount = current_bet - player_current_bet
    pot_odds = call_amount / (pot + call_amount) if call_amount > 0 else 0.0
    feats[idx] = pot_odds
    idx += 1

    bb = max(big_blind, 1.0)
    feats[idx] = min(pot / bb, 100.0) / 100.0
    idx += 1
    feats[idx] = min(player_chips / bb, 200.0) / 200.0
    idx += 1

    spr = player_chips / max(pot, 1.0)
    feats[idx] = min(spr, 50.0) / 50.0
    idx += 1

    # ── Position / street / num_active ─────────────────────────────
    if position in POSITION_TO_IDX:
        feats[idx + POSITION_TO_IDX[position]] = 1.0
    idx += 9
    if street in STREET_TO_IDX:
        feats[idx + STREET_TO_IDX[street]] = 1.0
    idx += 4
    feats[idx] = min(num_active, 9) / 9.0
    idx += 1

    # ── Personality + facing-bet ──────────────────────────────────
    if personality in PERSONALITY_TO_IDX:
        feats[idx + PERSONALITY_TO_IDX[personality]] = 1.0
    idx += 8
    feats[idx] = 1.0 if call_amount > 0 else 0.0
    idx += 1

    assert idx == FEATURE_DIM, f"feature index mismatch: {idx} vs {FEATURE_DIM}"
    return feats
