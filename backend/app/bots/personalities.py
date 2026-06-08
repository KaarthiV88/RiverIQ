"""Personality profiles for poker bots — 8 archetypes.

Each profile is a vector of biases against a (rough) GTO-ish baseline.
Phase 4c will pass these same values into the PyTorch policy net so that
the learned policy can still be conditioned on a player type.

All thresholds operate on a 0–1 perceived-hand-strength scale (see
hand_strength.py). Decision logic in baseline.py uses these:

    looseness            additive on perceived strength
    value_threshold      min strength to bet/raise for value
    fold_to_bet_mult     multiplier on pot odds for folding
    aggression           when ahead, chance of raising vs calling
    bluff_frequency      when behind w/ no bet to call, chance of betting
    open_size_bb         preflop opening size in big blinds
    cbet_pot_frac        postflop bet sizing as fraction of pot
    randomness           noise scale on perceived strength
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PersonalityProfile:
    looseness: float
    value_threshold: float
    fold_to_bet_mult: float
    aggression: float
    bluff_frequency: float
    open_size_bb: float
    cbet_pot_frac: float
    randomness: float
    # How much to weight the learned policy net vs the heuristic baseline.
    # 0 = pure baseline (predictable rule-based). 1 = pure net.
    policy_weight: float = 0.0


# ── 8 archetypes ──────────────────────────────────────────────────────────────
#
# nit              — only premiums, folds easy, small sizings
# tag              — tight pre, aggressive post, solid reg
# lag              — wide range, aggressive, hard to read
# calling-station  — calls everything, never raises
# maniac           — bombs every street, overbets, high variance
# home-game        — inconsistent: loose calls + random folds
# pro              — balanced, slight exploit edge
# gto-wizard       — near-baseline, low randomness, mixed strategies

PERSONALITIES: dict[str, PersonalityProfile] = {
    "nit": PersonalityProfile(
        looseness=-0.25, value_threshold=0.80, fold_to_bet_mult=1.40,
        aggression=0.30, bluff_frequency=0.02,
        open_size_bb=2.5, cbet_pot_frac=0.50, randomness=0.05,
        policy_weight=0.20,
    ),
    "tag": PersonalityProfile(
        looseness=-0.08, value_threshold=0.65, fold_to_bet_mult=1.15,
        aggression=0.70, bluff_frequency=0.15,
        open_size_bb=2.5, cbet_pot_frac=0.66, randomness=0.08,
        policy_weight=0.50,
    ),
    "lag": PersonalityProfile(
        looseness=0.15, value_threshold=0.55, fold_to_bet_mult=0.95,
        aggression=0.85, bluff_frequency=0.30,
        open_size_bb=3.0, cbet_pot_frac=0.75, randomness=0.15,
        policy_weight=0.50,
    ),
    "calling-station": PersonalityProfile(
        looseness=0.20, value_threshold=0.85, fold_to_bet_mult=0.50,
        aggression=0.10, bluff_frequency=0.03,
        open_size_bb=2.2, cbet_pot_frac=0.40, randomness=0.10,
        policy_weight=0.10,
    ),
    "maniac": PersonalityProfile(
        looseness=0.25, value_threshold=0.40, fold_to_bet_mult=0.70,
        aggression=0.92, bluff_frequency=0.50,
        open_size_bb=4.0, cbet_pot_frac=1.00, randomness=0.55,
        policy_weight=0.10,
    ),
    "home-game": PersonalityProfile(
        looseness=0.12, value_threshold=0.60, fold_to_bet_mult=1.00,
        aggression=0.45, bluff_frequency=0.20,
        open_size_bb=3.5, cbet_pot_frac=0.70, randomness=0.30,
        policy_weight=0.20,
    ),
    "pro": PersonalityProfile(
        looseness=0.02, value_threshold=0.62, fold_to_bet_mult=1.10,
        aggression=0.72, bluff_frequency=0.22,
        open_size_bb=2.5, cbet_pot_frac=0.66, randomness=0.08,
        policy_weight=0.70,
    ),
    "gto-wizard": PersonalityProfile(
        looseness=0.01, value_threshold=0.60, fold_to_bet_mult=1.20,
        aggression=0.65, bluff_frequency=0.25,
        open_size_bb=2.5, cbet_pot_frac=0.50, randomness=0.02,
        policy_weight=0.90,
    ),
}


def get_profile(name: str) -> PersonalityProfile:
    """Return a profile by name, defaulting to `pro` for unknown / legacy names."""
    return PERSONALITIES.get(name, PERSONALITIES["pro"])
