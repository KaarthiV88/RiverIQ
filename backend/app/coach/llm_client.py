"""Thin async wrapper around the Groq chat-completions API.

Phase: Coach.
  * `chat()`    — Step 1, blocking round-trip. Returned for curl-friendly tests.
  * `stream_chat()` — Step 2, async generator of token deltas. Drives the
    SSE endpoint and (eventually) the chat panel UI.

The RAG-lite context builder lives one layer above (Step 3): it formats the
game snapshot into a system+user prompt before calling these.

Model selection is env-driven (see app/config.py). Groq retired the Llama 3.x
family out from under this app once already, so the model id, the fallback,
and the base URL are all configurable from the hosting dashboard — no code
change or redeploy needed to work around a deprecation or a throttle.
"""

from typing import AsyncIterator

import groq
from groq import AsyncGroq

from app.config import settings

DEFAULT_MODEL = settings.groq_model
FALLBACK_MODEL = settings.groq_fallback_model

# gpt-oss is a *reasoning* model: at default effort it spends the whole token
# budget thinking and returns empty `content`. "low" keeps the chain-of-thought
# to a few tokens so the coach answers directly. Reasoning text arrives on a
# separate field and never lands in `content`, so the streaming loop stays clean.
REASONING_EFFORT = "low"

# base_url lets you point at any OpenAI-compatible provider (Gemini, Cerebras,
# OpenRouter) using the same client. Empty keeps the Groq default.
_client = AsyncGroq(
    api_key=settings.groq_api_key,
    **({"base_url": settings.groq_base_url} if settings.groq_base_url else {}),
)

# Worth retrying on the backup model: the primary was retired (404) or we're
# being throttled (429). Anything else is a real error and should surface.
_FAILOVER_ERRORS = (groq.NotFoundError, groq.RateLimitError)


def _supports_reasoning_effort(model: str) -> bool:
    """Only the gpt-oss family accepts this parameter. groq/compound rejects it
    with a 400, so sending it blindly on failover would fail for the wrong
    reason and mask the outage we're trying to route around."""
    return model.startswith("openai/gpt-oss")


def _params(model: str, messages: list[dict], *, stream: bool) -> dict:
    params = {
        "model": model,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 600,
        "stream": stream,
    }
    if _supports_reasoning_effort(model):
        params["reasoning_effort"] = REASONING_EFFORT
    return params


async def _create(messages: list[dict], model: str, *, stream: bool):
    """Call the primary model, falling back to the backup on 404/429.

    The failover happens on the initial request, before any token has been
    yielded, so a streaming consumer never sees a half-written reply.
    """
    try:
        return await _client.chat.completions.create(**_params(model, messages, stream=stream))
    except _FAILOVER_ERRORS as exc:
        if not FALLBACK_MODEL or FALLBACK_MODEL == model:
            raise
        print(
            f"[coach] {model} unavailable ({type(exc).__name__}); "
            f"falling back to {FALLBACK_MODEL}"
        )
        return await _client.chat.completions.create(
            **_params(FALLBACK_MODEL, messages, stream=stream)
        )


async def chat(messages: list[dict], model: str = DEFAULT_MODEL) -> str:
    """Blocking round-trip — returns the full assistant reply."""
    completion = await _create(messages, model, stream=False)
    return completion.choices[0].message.content or ""


async def stream_chat(
    messages: list[dict],
    model: str = DEFAULT_MODEL,
) -> AsyncIterator[str]:
    """Stream the assistant reply one delta at a time."""
    stream = await _create(messages, model, stream=True)
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
