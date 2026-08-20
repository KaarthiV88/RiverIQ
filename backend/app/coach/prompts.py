"""Prompt templates for the coach.

Kept separate from the router so the persona + context-rendering logic can
be tuned without touching the HTTP layer.
"""

from .context import GameContext, hero_equity, pot_odds, stack_to_pot_ratio


SYSTEM_PROMPT = """You are RiverIQ Coach, an expert no-limit Texas Hold'em coach embedded in a live poker app. You are advising the user (the "hero") on the spot they are currently in.

Style:
- Direct, concise, and concrete. No fluff, no disclaimers.
- Plain prose and short bullet lines only. The chat panel renders raw text, so never use markdown tables, pipe layouts, or heading syntax — they show up as literal characters.
- Walk through your reasoning briefly (1-3 short lines) before giving a recommendation, but keep the whole answer tight.
- Use poker shorthand naturally (UTG, BTN, c-bet, SPR, 3-bet, polar/merged, etc.).
- When the user gives you a specific spot, recommend a concrete action and size when relevant.

Honesty:
- You only see the hero's hole cards. Never invent or assume opponents' hole cards. Reason about ranges instead.
- Never invent actions or board cards that the user didn't mention. If the structured GAME CONTEXT below is present, use it as the source of truth and don't contradict it.
- If something is missing or ambiguous, ask one clarifying question instead of guessing.

When GAME CONTEXT is provided, it includes hero equity (already computed for you), pot odds, SPR, opponent stacks and personality archetypes, and the full action history of this hand. Use these. Reference equity vs. pot odds explicitly when justifying calls."""


REVIEW_PROMPT = """You are RiverIQ Coach in REVIEW MODE. The hand is over — opponents' hole cards and the winners are visible to you in the GAME CONTEXT. The hero wants to learn from what just happened, not get advice on what to do next.

Style:
- Walk through the hand street-by-street. Call out the key decision points (open, c-bet, river spot, etc.).
- Plain prose and short bullet lines only. The chat panel renders raw text, so never use markdown tables, pipe layouts, or heading syntax — they show up as literal characters.
- For each one, state what the hero did, whether it was good/bad/neutral, and the higher-EV alternative if there was one.
- Be concrete: cite equity, pot odds, blockers, opponent type, and the specific holding the opponent turned up.
- Close with a one-line takeaway — the single most useful thing to remember for next time.

Honesty:
- Use the revealed opponent cards in your reasoning, but frame the analysis as "given their range was X, your line did/didn't make sense."
- Don't hindsight-bias: a call that lost to one specific holding can still have been correct vs. the opponent's full range.
- If the hero asks a question instead of a review, answer the question directly and skip the street-by-street."""


# Short, descriptive blurbs the coach can lean on for read-the-player advice.
PERSONALITY_BLURBS: dict[str, str] = {
    "nit": "very tight & passive — only puts chips in with premiums; folds to most aggression",
    "tag": "tight-aggressive solid reg — value-heavy ranges, 3-bets premiums, c-bets often",
    "lag": "loose-aggressive — wide ranges, frequent 3-bets and bluffs, tough to read",
    "calling-station": "calls way too much, raises almost never; value-bet thin, don't bluff",
    "maniac": "ultra-aggro — bombs every street, overbets, capable of huge bluffs",
    "home-game": "casual recreational — inconsistent, loose calls, makes random folds",
    "pro": "balanced solid reg with mild exploits; treat as a thinking opponent",
    "gto-wizard": "near-GTO — well-balanced ranges, mixed strategies, very hard to exploit",
}


def _fmt_money(x: float) -> str:
    return f"${int(round(x))}"


def _fmt_pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def _opponent_line(opp) -> str:
    bits = [f"{opp.name} ({opp.position})", f"{_fmt_money(opp.chips)}"]
    if opp.current_bet > 0:
        bits.append(f"bet {_fmt_money(opp.current_bet)}")
    if opp.status != "active":
        bits.append(opp.status)
    if opp.hole_cards:
        bits.append(f"cards: {' '.join(opp.hole_cards)}")
    if opp.personality:
        blurb = PERSONALITY_BLURBS.get(opp.personality, opp.personality)
        bits.append(f"[{opp.personality}: {blurb}]")
    return " — ".join(bits)


def _history_lines(ctx: GameContext) -> list[str]:
    """Group actions by street so the LLM can see the flow."""
    if not ctx.history:
        return ["(no actions yet)"]
    lines: list[str] = []
    last_street: str | None = None
    for entry in ctx.history:
        if entry.street != last_street:
            lines.append(f"  [{entry.street}]")
            last_street = entry.street
        verb = entry.action
        if entry.action in ("raise", "bet", "call") and entry.amount > 0:
            verb = f"{entry.action} {_fmt_money(entry.amount)}"
        lines.append(f"    {entry.actor}: {verb}")
    return lines


def render_context_block(ctx: GameContext) -> str:
    """Render a GameContext into a compact text block for the system prompt."""
    call_amount = max(ctx.current_bet - ctx.my_current_bet, 0.0)
    po = pot_odds(call_amount, ctx.pot)
    spr = stack_to_pot_ratio(ctx.my_chips, ctx.pot)

    equity: float | None = None
    if len(ctx.hole_cards) == 2 and ctx.num_active >= 2:
        num_opps = max(ctx.num_active - 1, 1)
        equity = hero_equity(
            tuple(ctx.hole_cards),
            tuple(ctx.community_cards),
            num_opps,
        )

    board = " ".join(ctx.community_cards) if ctx.community_cards else "(none)"
    hero_cards = " ".join(ctx.hole_cards) if ctx.hole_cards else "(unknown)"

    opp_lines = (
        [f"  - {_opponent_line(o)}" for o in ctx.opponents]
        or ["  (no opponents listed)"]
    )

    lines = [
        "GAME CONTEXT",
        f"  Street: {ctx.street}",
        f"  Hero hole cards: {hero_cards}",
        f"  Board: {board}",
        f"  Hero position: {ctx.my_position}",
        f"  Hero stack: {_fmt_money(ctx.my_chips)}    Hero bet this street: {_fmt_money(ctx.my_current_bet)}",
        f"  Pot: {_fmt_money(ctx.pot)}    To call: {_fmt_money(call_amount)}    Min-raise to: {_fmt_money(ctx.current_bet + ctx.min_raise)}",
        f"  BB: {_fmt_money(ctx.big_blind)}    Active players: {ctx.num_active}",
    ]
    if equity is not None:
        lines.append(f"  Hero equity vs. {max(ctx.num_active - 1, 1)} random opponents: {_fmt_pct(equity)}")
    if po is not None:
        lines.append(f"  Pot odds to call: {_fmt_pct(po)} (need this much equity to break even)")
    if spr is not None:
        lines.append(f"  SPR: {spr:.1f}")

    lines.append("")
    lines.append("Opponents:")
    lines.extend(opp_lines)
    lines.append("")
    lines.append("Action history this hand:")
    lines.extend(_history_lines(ctx))

    if ctx.mode == "review" and ctx.winners:
        lines.append("")
        lines.append(f"Showdown winners: {', '.join(ctx.winners)}")

    return "\n".join(lines)


def system_prompt_for(mode: str) -> str:
    """Pick the right system prompt for the current context mode."""
    return REVIEW_PROMPT if mode == "review" else SYSTEM_PROMPT
