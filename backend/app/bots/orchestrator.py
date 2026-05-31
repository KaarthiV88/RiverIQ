"""Decision orchestrator — blends the heuristic baseline with the
learned policy network according to each personality's `policy_weight`.

Behaviour:
  * If no model checkpoint is loaded → always use baseline (so the server
    runs identically to Phase 4b until you train a model).
  * Otherwise: Bernoulli flip on profile.policy_weight. Use net's action
    distribution + sizing head with that probability, else baseline.

Loading is handled by `load_model()` which is called from the FastAPI
startup lifespan.
"""

import random
from pathlib import Path
from typing import Optional

import torch

from .baseline import DecisionContext, Decision, decide as baseline_decide
from .features import encode_features
from .hand_strength import preflop_strength, postflop_strength
from .personalities import get_profile
from .policy_net import (
    ACTION_CALL,
    ACTION_CHECK,
    ACTION_FOLD,
    ACTION_RAISE,
    PolicyNet,
    mask_illegal_actions,
)

# Resolved relative to this file: backend/ml/saved_models/policy_v1.pt
MODEL_PATH = (
    Path(__file__).resolve().parent.parent.parent / "ml" / "saved_models" / "policy_v1.pt"
)

_MODEL: Optional[PolicyNet] = None


def load_model() -> bool:
    """Load the trained policy net checkpoint. Returns True on success."""
    global _MODEL
    if not MODEL_PATH.exists():
        print(f"[orchestrator] No checkpoint at {MODEL_PATH} — using baseline only.")
        _MODEL = None
        return False
    try:
        net = PolicyNet()
        state = torch.load(MODEL_PATH, map_location="cpu")
        net.load_state_dict(state)
        net.eval()
        _MODEL = net
        print(f"[orchestrator] Loaded policy net from {MODEL_PATH}.")
        return True
    except Exception as e:  # noqa: BLE001
        print(f"[orchestrator] Failed to load policy net: {e}")
        _MODEL = None
        return False


def is_model_loaded() -> bool:
    return _MODEL is not None


def _hand_strength(ctx: DecisionContext) -> float:
    if len(ctx.community_cards) == 0:
        return preflop_strength(ctx.hole_cards)
    return postflop_strength(ctx.hole_cards, ctx.community_cards)


def _net_decide(ctx: DecisionContext) -> Decision:
    """Sample an action and sizing from the policy network's output."""
    assert _MODEL is not None, "_net_decide called without a loaded model"

    feats = encode_features(
        hole_cards=ctx.hole_cards,
        community_cards=ctx.community_cards,
        pot=ctx.pot,
        current_bet=ctx.current_bet,
        player_current_bet=ctx.player_current_bet,
        player_chips=ctx.player_chips,
        big_blind=ctx.big_blind,
        personality=ctx.personality,
        position=ctx.position,
        street=ctx.street,
        num_active=ctx.num_active,
        hand_strength=_hand_strength(ctx),
    )
    x = torch.from_numpy(feats).unsqueeze(0)
    with torch.no_grad():
        action_logits, sizing = _MODEL(x)

    call_amount = ctx.current_bet - ctx.player_current_bet
    min_raise_total = ctx.current_bet + ctx.min_raise
    max_total_commit = ctx.player_chips + ctx.player_current_bet
    can_raise = max_total_commit >= min_raise_total

    masked = mask_illegal_actions(
        action_logits, call_amount=call_amount, can_raise=can_raise,
    )
    probs = torch.softmax(masked, dim=-1)
    action_idx = int(torch.multinomial(probs, num_samples=1).item())

    if action_idx == ACTION_FOLD:
        return Decision(action="fold", amount=0.0)
    if action_idx == ACTION_CHECK:
        return Decision(action="check", amount=0.0)
    if action_idx == ACTION_CALL:
        return Decision(action="call", amount=float(call_amount))

    # RAISE — sizing is raise-above-current_bet as a fraction of pot.
    pot_fraction = float(sizing.item())
    raise_above = ctx.pot * pot_fraction
    total = ctx.current_bet + raise_above
    final = max(min_raise_total, min(int(total), int(max_total_commit)))
    return Decision(action="raise", amount=float(final))


def decide(ctx: DecisionContext) -> Decision:
    profile = get_profile(ctx.personality)

    if not is_model_loaded():
        return baseline_decide(ctx)

    # Bernoulli blend: use the policy net with prob = profile.policy_weight,
    # otherwise fall back to the rule-based baseline.
    if random.random() < profile.policy_weight:
        return _net_decide(ctx)
    return baseline_decide(ctx)
