"""Heuristic baseline decision logic.

Combines hand strength, pot odds, and per-personality parameters
(value threshold, fold/bluff frequencies, position-aware sizing) to pick
an action. Layered on top of that:

  * Wider preflop opening ranges so bots actually raise preflop.
  * Slow-play: with monster hands, sometimes just check/call to trap.
  * Check-raise: when checked into by someone aggressive and we're strong.
  * In-position stab: aggressive players in late position bet when the
    field checks to them, even without a great hand.
"""

import random
from dataclasses import dataclass

from .hand_strength import preflop_strength, postflop_strength
from .personalities import get_profile, PersonalityProfile

BIG_BLIND = 20  # used as fallback if request doesn't include it

# Positions considered "in position" for the postflop stab heuristic.
IN_POSITION = {"BTN", "CO", "HJ"}


@dataclass(frozen=True)
class DecisionContext:
    hole_cards: list[str]
    community_cards: list[str]
    pot: float
    current_bet: float           # highest bet on this street
    player_current_bet: float    # this player's commitment this street
    player_chips: float
    min_raise: float
    big_blind: float
    personality: str
    # Context for the policy network (encoded as one-hots in features.py).
    # Default values keep older callers / tests working unchanged.
    position: str = "BTN"
    street: str = "preflop"
    num_active: int = 5


@dataclass(frozen=True)
class Decision:
    action: str   # 'fold' | 'check' | 'call' | 'raise'
    amount: float


# ── Action helpers ────────────────────────────────────────────────────────────

def _max_total_commit(ctx: DecisionContext) -> float:
    """Upper bound for any 'raise to' amount this street (all-in cap)."""
    return ctx.player_chips + ctx.player_current_bet


def _can_raise(ctx: DecisionContext) -> bool:
    min_raise_total = ctx.current_bet + ctx.min_raise
    return _max_total_commit(ctx) >= min_raise_total


def _build_value_bet(ctx: DecisionContext, profile: PersonalityProfile, is_preflop: bool) -> Decision:
    raw = (
        ctx.big_blind * profile.open_size_bb
        if is_preflop else
        ctx.pot * profile.cbet_pot_frac
    )
    cap = _max_total_commit(ctx)
    final = max(ctx.min_raise, min(int(raw), int(cap)))
    return Decision(action="raise", amount=float(final))


def _build_bluff(ctx: DecisionContext, profile: PersonalityProfile, is_preflop: bool) -> Decision:
    raw = (
        ctx.big_blind * profile.open_size_bb * 0.85
        if is_preflop else
        ctx.pot * profile.cbet_pot_frac * 0.75
    )
    cap = _max_total_commit(ctx)
    final = max(ctx.min_raise, min(int(raw), int(cap)))
    return Decision(action="raise", amount=float(final))


def _build_raise_over_bet(ctx: DecisionContext, profile: PersonalityProfile) -> Decision:
    """Raise on top of an existing bet (3-bet, c/r, etc.)."""
    min_raise_total = ctx.current_bet + ctx.min_raise
    cap = _max_total_commit(ctx)
    if cap < min_raise_total:
        call_amount = ctx.current_bet - ctx.player_current_bet
        return Decision(action="call", amount=float(call_amount))
    raw = int(ctx.current_bet * 2.5 + ctx.pot * profile.cbet_pot_frac * 0.5)
    final = max(min_raise_total, min(raw, int(cap)))
    return Decision(action="raise", amount=float(final))


def _build_check_raise(ctx: DecisionContext, profile: PersonalityProfile) -> Decision:
    """Sized larger than a normal raise — trapping with a strong hand."""
    min_raise_total = ctx.current_bet + ctx.min_raise
    cap = _max_total_commit(ctx)
    if cap < min_raise_total:
        call_amount = ctx.current_bet - ctx.player_current_bet
        return Decision(action="call", amount=float(call_amount))
    raw = int(ctx.current_bet * 3.0 + ctx.pot * 0.6)
    final = max(min_raise_total, min(raw, int(cap)))
    return Decision(action="raise", amount=float(final))


# ── Preflop opening range — broader than just `value_threshold`. ─────────────
# Returns probability of opening (raise) at all for a given hand strength.
def _preflop_open_chance(strength: float, profile: PersonalityProfile) -> float:
    if strength >= 0.85:                    # premium → almost always raise
        return min(1.0, profile.aggression + 0.20)
    if strength >= 0.65:                    # strong → raise often
        return profile.aggression
    if strength >= 0.50:                    # playable → raise sometimes
        return profile.aggression * 0.55
    if strength >= 0.40:                    # speculative
        return profile.aggression * 0.30
    if strength >= 0.30:                    # trash → only loose players
        return profile.aggression * 0.10
    return 0.0


# ── Main decision ─────────────────────────────────────────────────────────────

def decide(ctx: DecisionContext) -> Decision:
    profile = get_profile(ctx.personality)

    call_amount = ctx.current_bet - ctx.player_current_bet
    is_preflop = len(ctx.community_cards) == 0

    if is_preflop:
        raw_strength = preflop_strength(ctx.hole_cards)
    else:
        raw_strength = postflop_strength(ctx.hole_cards, ctx.community_cards)

    strength = raw_strength + profile.looseness
    strength += (random.random() - 0.5) * profile.randomness * 2

    pot_odds = call_amount / (ctx.pot + call_amount) if call_amount > 0 else 0.0
    in_position = ctx.position in IN_POSITION

    # Preflop open opportunity: nobody has raised yet, we're just facing the
    # blinds. Treat this as an "open" decision (wide range) instead of as
    # "facing a bet" — that's what makes bots actually raise preflop.
    is_preflop_open = (
        is_preflop
        and ctx.current_bet <= ctx.big_blind + 0.01
        and call_amount > 0
    )
    if is_preflop_open:
        if random.random() < _preflop_open_chance(strength, profile) and _can_raise(ctx):
            return _build_value_bet(ctx, profile, is_preflop=True)
        # Fold trash with a small chance, otherwise complete/call.
        if strength < pot_odds * profile.fold_to_bet_mult:
            return Decision(action="fold", amount=0.0)
        return Decision(action="call", amount=float(call_amount))

    # ── No bet to call (we can check or open) ────────────────────────
    if call_amount == 0:
        # SLOW-PLAY: with a real monster postflop, sometimes just check to trap.
        # Calling-stations and home-game players don't think this far — skip
        # for them. Pros, GTO wizards, TAG and LAG slowplay occasionally.
        if (not is_preflop) and raw_strength >= 0.94 and profile.aggression >= 0.65:
            if random.random() < 0.35:
                return Decision(action="check", amount=0.0)

        # IN-POSITION STAB: when checked around to a late-position aggressor,
        # they bet a healthy chunk of the time regardless of holding. Applies
        # postflop only.
        if (
            not is_preflop
            and in_position
            and ctx.pot > 0
            and profile.aggression >= 0.70
        ):
            stab_chance = 0.45 + 0.20 * (profile.aggression - 0.70)
            if random.random() < stab_chance and _can_raise(ctx):
                return _build_bluff(ctx, profile, is_preflop=False)

        # Preflop: use the wider opening range instead of the strict
        # value-threshold gate — this is what makes bots actually raise.
        if is_preflop:
            if random.random() < _preflop_open_chance(strength, profile) and _can_raise(ctx):
                return _build_value_bet(ctx, profile, is_preflop=True)
            # Even unopened pots get the occasional bluff-raise from maniacs/LAGs.
            if random.random() < profile.bluff_frequency * 0.5 and _can_raise(ctx):
                return _build_bluff(ctx, profile, is_preflop=True)
            return Decision(action="check", amount=0.0)

        # Postflop value bet on a clean check-around.
        if strength >= profile.value_threshold and random.random() < profile.aggression:
            return _build_value_bet(ctx, profile, is_preflop=False)
        if random.random() < profile.bluff_frequency:
            return _build_bluff(ctx, profile, is_preflop=False)
        return Decision(action="check", amount=0.0)

    # ── Facing a bet ────────────────────────────────────────────────
    # CHECK-RAISE / TRAP: monster postflop hands occasionally check-raise.
    # We approximate that here by raising on a value hand at a higher rate
    # than the default aggression — bots facing a bet with the nuts ramp up.
    if (not is_preflop) and raw_strength >= 0.94:
        if random.random() < 0.65 and _can_raise(ctx):
            return _build_check_raise(ctx, profile)
        return Decision(action="call", amount=float(call_amount))

    # Fold if perceived strength can't justify the price.
    if strength < pot_odds * profile.fold_to_bet_mult:
        return Decision(action="fold", amount=0.0)

    # Strong → value-raise.
    if strength >= profile.value_threshold and random.random() < profile.aggression:
        return _build_raise_over_bet(ctx, profile)

    # Occasional bluff-raise (rarer than open bluff).
    if random.random() < profile.bluff_frequency * 0.4 and _can_raise(ctx):
        return _build_raise_over_bet(ctx, profile)

    return Decision(action="call", amount=float(call_amount))
