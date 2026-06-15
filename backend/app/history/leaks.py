"""Leak detection — compare aggregate stats against benchmark ranges.

Benchmarks are textbook NL-cash heuristics (Krieger, Janda, modern solver
charts). Each metric has:

  good range     — where well-regulated regs sit
  watch margin   — outside good but not yet exploitable
  leak threshold — far enough out that a thinking opp could attack it

Sample sizes matter: a 100% c-bet rate over 3 spots isn't a leak, it's
noise. Each finding carries the denominator we used, and findings below
MIN_SAMPLE are suppressed.

Output is a list of `Finding`s the UI can render and the LLM coach can
inject into its context.
"""

from __future__ import annotations

from pydantic import BaseModel

from .stats import Stats


class Finding(BaseModel):
    metric: str
    label: str               # human-friendly name
    value: float | None      # the stat (None = no data)
    sample_size: int
    severity: str            # 'good' | 'watch' | 'leak' | 'insufficient'
    benchmark_low: float | None
    benchmark_high: float | None
    explanation: str


# Minimum denominator before we render an opinion at all.
MIN_SAMPLE = {
    "vpip": 20,
    "pfr": 20,
    "three_bet": 15,
    "fold_to_three_bet": 8,
    "cbet_flop": 10,
    "wtsd": 15,
    "wsd": 8,
    "af_flop": 15,
    "af_turn": 10,
    "af_river": 10,
}


def _classify(value: float, low: float, high: float, leak_margin: float) -> str:
    if low <= value <= high:
        return "good"
    if value < low - leak_margin or value > high + leak_margin:
        return "leak"
    return "watch"


def _too_low(label: str, value: float, low: float, severity: str) -> str:
    pct = f"{value * 100:.1f}%"
    if severity == "leak":
        return f"{label} is {pct} — well below the {low * 100:.0f}% floor. Opens you up to being run over."
    return f"{label} is {pct} — a touch low (healthy floor ~{low * 100:.0f}%)."


def _too_high(label: str, value: float, high: float, severity: str) -> str:
    pct = f"{value * 100:.1f}%"
    if severity == "leak":
        return f"{label} is {pct} — well above the {high * 100:.0f}% ceiling. Tighten up or this gets exploited."
    return f"{label} is {pct} — a touch high (healthy ceiling ~{high * 100:.0f}%)."


def _good(label: str, value: float) -> str:
    return f"{label} is {value * 100:.1f}% — in the healthy band."


def _check_pct(
    metric: str,
    label: str,
    value: float | None,
    sample: int,
    low: float,
    high: float,
    leak_margin: float,
) -> Finding:
    if value is None or sample < MIN_SAMPLE.get(metric, 10):
        return Finding(
            metric=metric, label=label, value=value, sample_size=sample,
            severity="insufficient",
            benchmark_low=low, benchmark_high=high,
            explanation=f"Need more hands to evaluate {label.lower()} ({sample} so far).",
        )
    severity = _classify(value, low, high, leak_margin)
    if severity == "good":
        msg = _good(label, value)
    elif value < low:
        msg = _too_low(label, value, low, severity)
    else:
        msg = _too_high(label, value, high, severity)
    return Finding(
        metric=metric, label=label, value=value, sample_size=sample,
        severity=severity, benchmark_low=low, benchmark_high=high,
        explanation=msg,
    )


def _check_af(
    metric: str,
    label: str,
    value: float | None,
    sample_calls: int,
    low: float = 1.5,
    high: float = 3.5,
) -> Finding:
    if value is None or sample_calls < MIN_SAMPLE.get(metric, 10):
        return Finding(
            metric=metric, label=label, value=value, sample_size=sample_calls,
            severity="insufficient",
            benchmark_low=low, benchmark_high=high,
            explanation=f"Need more post-flop calls to evaluate {label.lower()} ({sample_calls} so far).",
        )
    if low <= value <= high:
        return Finding(
            metric=metric, label=label, value=value, sample_size=sample_calls,
            severity="good", benchmark_low=low, benchmark_high=high,
            explanation=f"{label} is {value:.2f} — balanced.",
        )
    if value < low:
        sev = "leak" if value < 0.8 else "watch"
        msg = f"{label} is {value:.2f} — under-aggressive (target {low}–{high})."
    else:
        sev = "leak" if value > 5.0 else "watch"
        msg = f"{label} is {value:.2f} — overly aggressive (target {low}–{high})."
    return Finding(
        metric=metric, label=label, value=value, sample_size=sample_calls,
        severity=sev, benchmark_low=low, benchmark_high=high, explanation=msg,
    )


def detect_leaks(stats: Stats) -> list[Finding]:
    s = stats.sample_sizes
    out: list[Finding] = []

    out.append(_check_pct(
        "vpip", "VPIP", stats.vpip, s.get("vpip", 0),
        low=0.18, high=0.28, leak_margin=0.07,
    ))
    out.append(_check_pct(
        "pfr", "PFR", stats.pfr, s.get("pfr", 0),
        low=0.14, high=0.22, leak_margin=0.06,
    ))
    out.append(_check_pct(
        "three_bet", "3-bet %", stats.three_bet, s.get("three_bet", 0),
        low=0.04, high=0.09, leak_margin=0.04,
    ))
    out.append(_check_pct(
        "fold_to_three_bet", "Fold to 3-bet", stats.fold_to_three_bet, s.get("fold_to_three_bet", 0),
        low=0.50, high=0.65, leak_margin=0.10,
    ))
    out.append(_check_pct(
        "cbet_flop", "Flop c-bet", stats.cbet_flop, s.get("cbet_flop", 0),
        low=0.50, high=0.70, leak_margin=0.12,
    ))
    out.append(_check_pct(
        "wtsd", "Went to showdown", stats.wtsd, s.get("wtsd", 0),
        low=0.22, high=0.30, leak_margin=0.08,
    ))
    out.append(_check_pct(
        "wsd", "Won at showdown", stats.wsd, s.get("wsd", 0),
        low=0.48, high=0.58, leak_margin=0.10,
    ))

    out.append(_check_af(
        "af_flop", "Flop AF", stats.af_flop, s.get("af_flop_calls", 0),
    ))
    out.append(_check_af(
        "af_turn", "Turn AF", stats.af_turn, s.get("af_turn_calls", 0),
    ))
    out.append(_check_af(
        "af_river", "River AF", stats.af_river, s.get("af_river_calls", 0),
    ))

    return out


def leaks_summary(findings: list[Finding]) -> str:
    """One-line digest the coach can drop into its context."""
    leaks = [f for f in findings if f.severity == "leak"]
    if not leaks:
        watching = [f for f in findings if f.severity == "watch"]
        if watching:
            return "No outright leaks; a few stats to watch: " + ", ".join(f.label for f in watching) + "."
        return "Stats look healthy in the current sample."
    return "Current-session leaks: " + "; ".join(
        f"{f.label} at {f.value * 100:.1f}%" if f.value is not None and f.metric.startswith(("vpip","pfr","three_bet","fold_to_three_bet","cbet_flop","wtsd","wsd"))
        else f"{f.label} at {f.value}"
        for f in leaks
    ) + "."
