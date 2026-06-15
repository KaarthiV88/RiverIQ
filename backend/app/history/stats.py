"""Aggregate poker stats over a window of stored hands.

All metrics use the conventional NL-cash definitions so they match what the
LLM coach (or any reader) will recognize:

  VPIP   — % of hands hero voluntarily put $ in preflop (excl. blinds checks)
  PFR    — % of hands hero raised preflop
  3-bet  — % of hands hero raised preflop when facing an open raise
  Fto3B  — % of times hero open-raised then folded to a 3-bet
  CB-F   — % of times hero c-bet the flop after raising preflop and reaching it
  WTSD   — % of times hero went to showdown after seeing the flop
  W$SD   — % of showdowns hero won
  AF/str — (bets + raises) / calls per street

Each metric is paired with the denominator that produced it so the coach
can know whether 4/4 c-bets is meaningful or noise.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Iterable

from pydantic import BaseModel

# ── Public output models ─────────────────────────────────────────────────────

class PositionStats(BaseModel):
    position: str
    hands: int
    vpip: float | None
    pfr: float | None


class Stats(BaseModel):
    hands_played: int
    hands_won: int
    net_chips: float

    vpip: float | None
    pfr: float | None
    three_bet: float | None
    fold_to_three_bet: float | None
    cbet_flop: float | None
    wtsd: float | None
    wsd: float | None

    af_flop: float | None
    af_turn: float | None
    af_river: float | None

    per_position: list[PositionStats]
    sample_sizes: dict[str, int]   # denominators per metric


# ── Internal counters ─────────────────────────────────────────────────────────

@dataclass
class _Counters:
    hands: int = 0
    hands_won: int = 0
    net_chips: float = 0.0

    vpip_opps: int = 0       # hands hero had a preflop decision
    vpip_yes: int = 0

    pfr_opps: int = 0
    pfr_yes: int = 0

    three_bet_opps: int = 0  # hero facing an open preflop
    three_bet_yes: int = 0

    fto3b_opps: int = 0      # hero opened then got 3-bet
    fto3b_yes: int = 0

    cbet_opps: int = 0       # hero raised preflop AND saw flop AND was first to act post-flop
    cbet_yes: int = 0

    wtsd_opps: int = 0       # hero saw flop
    wtsd_yes: int = 0

    wsd_opps: int = 0        # hero went to showdown
    wsd_yes: int = 0

    af_bets: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    af_calls: dict[str, int] = field(default_factory=lambda: defaultdict(int))

    pos_hands: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    pos_vpip: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    pos_pfr: dict[str, int] = field(default_factory=lambda: defaultdict(int))


def _is_hero_action(a: dict) -> bool:
    return a.get("actor_name") == "You"


def _street_actions(actions: list[dict], street: str) -> list[dict]:
    return [a for a in actions if a.get("street") == street]


def _classify_preflop(hand_actions: list[dict], hero_position: str) -> dict:
    """Return flags describing hero's preflop journey for one hand."""
    pre = _street_actions(hand_actions, "preflop")
    hero_first = next((a for a in pre if _is_hero_action(a)), None)

    # Build the "max raise seen so far" up to hero's first action.
    # In our engine, current_bet starts at BB=20; any 'raise' bumps it.
    seen_raises_before_hero = 0
    facing_bet_before_hero = False    # True if there was a non-blind raise
    for a in pre:
        if _is_hero_action(a):
            break
        if a.get("action") == "raise":
            seen_raises_before_hero += 1
            facing_bet_before_hero = True

    flags = {
        "had_decision": hero_first is not None,
        "vpip": False,
        "pfr": False,
        "open_raised": False,
        "faced_open": facing_bet_before_hero and seen_raises_before_hero == 1,
        "three_bet": False,
        "folded_to_three_bet_after_open": False,
    }
    if not hero_first:
        return flags

    act = hero_first.get("action")
    if act in ("call", "raise"):
        flags["vpip"] = True
    if act == "raise":
        flags["pfr"] = True
        if flags["faced_open"]:
            flags["three_bet"] = True
        elif not facing_bet_before_hero:
            flags["open_raised"] = True

    # Detect "hero opened → someone 3-bet → hero folded".
    if flags["open_raised"]:
        # Find the next raise after hero's open (a 3-bet from someone else).
        idx = pre.index(hero_first)
        three_bet_after = next(
            (a for a in pre[idx + 1:] if a.get("action") == "raise" and not _is_hero_action(a)),
            None,
        )
        if three_bet_after is not None:
            after_3bet_idx = pre.index(three_bet_after)
            hero_after_3bet = next(
                (a for a in pre[after_3bet_idx + 1:] if _is_hero_action(a)),
                None,
            )
            if hero_after_3bet and hero_after_3bet.get("action") == "fold":
                flags["folded_to_three_bet_after_open"] = True

    _ = hero_position  # reserved for future per-position branching
    return flags


def _hero_cbet_flop(hand_actions: list[dict], pfr_yes: bool) -> tuple[bool, bool]:
    """(had_cbet_opp, did_cbet). Hero needs to have raised preflop AND seen
    the flop AND been the first hero action on the flop."""
    if not pfr_yes:
        return False, False
    flop = _street_actions(hand_actions, "flop")
    if not flop:
        return False, False
    hero_flop_first = next((a for a in flop if _is_hero_action(a)), None)
    if hero_flop_first is None:
        return False, False
    # If anyone bet/raised the flop before hero acted, this isn't a "c-bet
    # spot" — it's a donk or someone else taking the betting lead.
    idx = flop.index(hero_flop_first)
    for a in flop[:idx]:
        act = a.get("action")
        if act in ("bet", "raise"):
            return False, False
    return True, hero_flop_first.get("action") in ("bet", "raise")


def _accumulate(c: _Counters, hand: dict) -> None:
    """Fold one stored hand into the counters."""
    actions = hand.get("actions") or []
    hero_pos = hand.get("position") or "?"

    c.hands += 1
    if hand.get("won"):
        c.hands_won += 1
    c.net_chips += float(hand.get("result") or 0)

    # Position
    c.pos_hands[hero_pos] += 1

    # Preflop classification
    pf = _classify_preflop(actions, hero_pos)
    if pf["had_decision"]:
        c.vpip_opps += 1
        c.pfr_opps += 1
        if pf["vpip"]:
            c.vpip_yes += 1
            c.pos_vpip[hero_pos] += 1
        if pf["pfr"]:
            c.pfr_yes += 1
            c.pos_pfr[hero_pos] += 1
    if pf["faced_open"]:
        c.three_bet_opps += 1
        if pf["three_bet"]:
            c.three_bet_yes += 1
    if pf["open_raised"]:
        c.fto3b_opps += 1
        if pf["folded_to_three_bet_after_open"]:
            c.fto3b_yes += 1

    # C-bet
    cb_opp, cb_yes = _hero_cbet_flop(actions, pf["pfr"])
    if cb_opp:
        c.cbet_opps += 1
        if cb_yes:
            c.cbet_yes += 1

    # WTSD / W$SD
    saw_flop = bool(_street_actions(actions, "flop")) or len(hand.get("board_cards") or []) >= 3
    if saw_flop:
        c.wtsd_opps += 1
        if hand.get("went_to_showdown"):
            c.wtsd_yes += 1
    if hand.get("went_to_showdown"):
        c.wsd_opps += 1
        if hand.get("won"):
            c.wsd_yes += 1

    # Aggression factor per post-flop street
    for street in ("flop", "turn", "river"):
        for a in _street_actions(actions, street):
            if not _is_hero_action(a):
                continue
            act = a.get("action")
            if act in ("bet", "raise"):
                c.af_bets[street] += 1
            elif act == "call":
                c.af_calls[street] += 1


def _pct(num: int, denom: int) -> float | None:
    if denom <= 0:
        return None
    return round(num / denom, 4)


def _af(bets: int, calls: int) -> float | None:
    if calls == 0:
        return None if bets == 0 else 99.0   # all-aggression; clamp instead of inf
    return round(bets / calls, 2)


def compute_stats(hands: Iterable[dict]) -> Stats:
    """Hands are the raw rows from the `hands` table (or `StoredHand.model_dump()`)."""
    c = _Counters()
    for h in hands:
        _accumulate(c, h)

    per_pos = [
        PositionStats(
            position=pos,
            hands=h,
            vpip=_pct(c.pos_vpip.get(pos, 0), h),
            pfr=_pct(c.pos_pfr.get(pos, 0), h),
        )
        for pos, h in sorted(c.pos_hands.items(), key=lambda kv: -kv[1])
    ]

    return Stats(
        hands_played=c.hands,
        hands_won=c.hands_won,
        net_chips=round(c.net_chips, 2),
        vpip=_pct(c.vpip_yes, c.vpip_opps),
        pfr=_pct(c.pfr_yes, c.pfr_opps),
        three_bet=_pct(c.three_bet_yes, c.three_bet_opps),
        fold_to_three_bet=_pct(c.fto3b_yes, c.fto3b_opps),
        cbet_flop=_pct(c.cbet_yes, c.cbet_opps),
        wtsd=_pct(c.wtsd_yes, c.wtsd_opps),
        wsd=_pct(c.wsd_yes, c.wsd_opps),
        af_flop=_af(c.af_bets["flop"], c.af_calls["flop"]),
        af_turn=_af(c.af_bets["turn"], c.af_calls["turn"]),
        af_river=_af(c.af_bets["river"], c.af_calls["river"]),
        per_position=per_pos,
        sample_sizes={
            "vpip": c.vpip_opps,
            "pfr": c.pfr_opps,
            "three_bet": c.three_bet_opps,
            "fold_to_three_bet": c.fto3b_opps,
            "cbet_flop": c.cbet_opps,
            "wtsd": c.wtsd_opps,
            "wsd": c.wsd_opps,
            "af_flop_calls": c.af_calls["flop"],
            "af_turn_calls": c.af_calls["turn"],
            "af_river_calls": c.af_calls["river"],
        },
    )
