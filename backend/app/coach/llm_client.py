"""Thin async wrapper around the Groq chat-completions API.

Phase: Coach.
  * `chat()`    — Step 1, blocking round-trip. Returned for curl-friendly tests.
  * `stream_chat()` — Step 2, async generator of token deltas. Drives the
    SSE endpoint and (eventually) the chat panel UI.

The RAG-lite context builder lives one layer above (Step 3): it formats the
game snapshot into a system+user prompt before calling these.
"""

from typing import AsyncIterator

from groq import AsyncGroq

from app.config import settings

# Groq decommissioned the Llama 3.x family; gpt-oss-120b is the strongest
# general-purpose chat model they now host. Swap to openai/gpt-oss-20b for a
# cheaper/faster path if quality is acceptable.
#
# It's a *reasoning* model: without an explicit effort setting it spends the
# token budget thinking and can return empty `content`. "low" keeps the
# chain-of-thought to a few tokens so the coach answers directly. Reasoning
# text arrives on a separate `reasoning` field and never lands in `content`,
# so the streaming loop below stays clean.
DEFAULT_MODEL = "openai/gpt-oss-120b"
REASONING_EFFORT = "low"

_client = AsyncGroq(api_key=settings.groq_api_key)


async def chat(messages: list[dict], model: str = DEFAULT_MODEL) -> str:
    """Blocking round-trip — returns the full assistant reply."""
    completion = await _client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.4,
        max_tokens=600,
        reasoning_effort=REASONING_EFFORT,
    )
    return completion.choices[0].message.content or ""


async def stream_chat(
    messages: list[dict],
    model: str = DEFAULT_MODEL,
) -> AsyncIterator[str]:
    """Stream the assistant reply one delta at a time."""
    stream = await _client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.4,
        max_tokens=600,
        reasoning_effort=REASONING_EFFORT,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
