"""Generate (state → action, sizing) training pairs from the heuristic baseline.

Sample random decision contexts (cards, pot, stacks, street, position,
personality), label each with whatever `baseline.decide(...)` returns,
and save as a compressed .npz file.

Run from `backend/`:
    python -m ml.generate_training_data --n 200000 --out ml/data/train.npz
"""

import argparse
import random
from pathlib import Path

import numpy as np

from app.bots.baseline import DecisionContext, decide
from app.bots.features import FEATURE_DIM, PERSONALITY_TO_IDX, encode_features
from app.bots.hand_strength import postflop_strength, preflop_strength
from app.bots.policy_net import (
    ACTION_CALL,
    ACTION_CHECK,
    ACTION_FOLD,
    ACTION_RAISE,
)

RANKS = "23456789TJQKA"
SUITS = "hdcs"
ALL_CARDS = [r + s for r in RANKS for s in SUITS]
POSITIONS = ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"]
STREETS = ["preflop", "flop", "turn", "river"]
BOARD_SIZE = {"preflop": 0, "flop": 3, "turn": 4, "river": 5}
PERSONALITY_NAMES = list(PERSONALITY_TO_IDX.keys())

ACTION_TO_INDEX = {
    "fold": ACTION_FOLD,
    "check": ACTION_CHECK,
    "call": ACTION_CALL,
    "raise": ACTION_RAISE,
}


def sample_example() -> tuple[np.ndarray, int, float]:
    """Generate one (features, action_idx, sizing_fraction) tuple."""
    deck = ALL_CARDS.copy()
    random.shuffle(deck)

    hole = [deck[0], deck[1]]
    street = random.choice(STREETS)
    board = deck[2 : 2 + BOARD_SIZE[street]]


    big_blind = 20.0
    pot = random.uniform(big_blind * 1.5, big_blind * 250)
    player_chips = random.uniform(big_blind * 5, big_blind * 250)

    # 55% of states are facing a bet, 45% are check decisions.
    facing_bet = random.random() < 0.55
    if facing_bet:
        current_bet = random.uniform(big_blind, pot * 0.8)
        player_current_bet = random.uniform(0, current_bet)
    else:
        current_bet = 0.0
        player_current_bet = 0.0
    min_raise = max(big_blind, current_bet * 0.5 if current_bet > 0 else big_blind)

    personality = random.choice(PERSONALITY_NAMES)
    position = random.choice(POSITIONS)
    num_active = random.randint(2, 9)

    ctx = DecisionContext(
        hole_cards=hole,
        community_cards=board,
        pot=pot,
        current_bet=current_bet,
        player_current_bet=player_current_bet,
        player_chips=player_chips,
        min_raise=min_raise,
        big_blind=big_blind,
        personality=personality,
        position=position,
        street=street,
        num_active=num_active,
    )

    decision = decide(ctx)

    strength = (
        preflop_strength(hole) if len(board) == 0 else postflop_strength(hole, board)
    )
    feats = encode_features(
        hole_cards=hole,
        community_cards=board,
        pot=pot,
        current_bet=current_bet,
        player_current_bet=player_current_bet,
        player_chips=player_chips,
        big_blind=big_blind,
        personality=personality,
        position=position,
        street=street,
        num_active=num_active,
        hand_strength=strength,
    )

    action_idx = ACTION_TO_INDEX[decision.action]
    if decision.action == "raise":
        sizing = (decision.amount - current_bet) / max(pot, 1.0)
    else:
        sizing = 0.0

    return feats, action_idx, float(sizing)


def generate(n: int, out: Path) -> None:
    feats_arr = np.zeros((n, FEATURE_DIM), dtype=np.float32)
    action_arr = np.zeros(n, dtype=np.int64)
    sizing_arr = np.zeros(n, dtype=np.float32)

    for i in range(n):
        feats, action, sizing = sample_example()
        feats_arr[i] = feats
        action_arr[i] = action
        sizing_arr[i] = sizing
        if i and i % 10000 == 0:
            print(f"  {i}/{n}")

    # Quick label-distribution print so you can sanity-check the dataset.
    counts = np.bincount(action_arr, minlength=4)
    print(
        f"Label mix → fold={counts[0]}, check={counts[1]}, "
        f"call={counts[2]}, raise={counts[3]}"
    )

    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        out, features=feats_arr, actions=action_arr, sizings=sizing_arr,
    )
    print(f"Saved {n} examples → {out}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=200_000)
    parser.add_argument("--out", type=str, default="ml/data/train.npz")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    generate(args.n, Path(args.out))


if __name__ == "__main__":
    main()
