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

# Llama 3.3 70B on Groq: highest quality of the Llama 3 family they host,
# still fast enough to feel snappy. Swap to llama-3.1-8b-instant for the
# cheapest path if quality is acceptable.
DEFAULT_MODEL = "llama-3.3-70b-versatile"

_client = AsyncGroq(api_key=settings.groq_api_key)


async def chat(messages: list[dict], model: str = DEFAULT_MODEL) -> str:
    """Blocking round-trip — returns the full assistant reply."""
    completion = await _client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.4,
        max_tokens=600,
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
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
