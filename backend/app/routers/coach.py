"""Phase: Coach endpoints.

  * POST /coach/chat         — blocking, returns the full reply as JSON.
                               Useful for curl, tests, and any client that
                               doesn't need incremental output.
  * POST /coach/chat/stream  — Server-Sent Events. Each event payload is JSON
                               of the shape `{"delta": "..."}`; a final
                               `data: [DONE]\\n\\n` marks the end. Errors are
                               surfaced as `{"error": "..."}` events.

Both endpoints accept an optional `game_context`. When present, the context
builder turns it into a system message containing hero equity, pot odds, SPR,
opponent personalities, and the action history — that's what makes the
coach's answers actually about the user's current spot.
"""

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.coach.context import GameContext
from app.coach.llm_client import chat, stream_chat
from app.coach.prompts import SYSTEM_PROMPT, render_context_block

router = APIRouter(prefix="/coach", tags=["coach"])


class Message(BaseModel):
    role: str = Field(..., description="'user' | 'assistant' | 'system'")
    content: str


class CoachChatRequest(BaseModel):
    messages: list[Message]
    game_context: GameContext | None = None


class CoachChatResponse(BaseModel):
    reply: str


def _prepare_messages(messages: list[Message], game_context: GameContext | None) -> list[dict]:
    if not messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")

    prepared: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if game_context is not None:
        prepared.append({"role": "system", "content": render_context_block(game_context)})
    prepared.extend({"role": m.role, "content": m.content} for m in messages)
    return prepared


@router.post("/chat", response_model=CoachChatResponse)
async def coach_chat(request: CoachChatRequest) -> CoachChatResponse:
    full_messages = _prepare_messages(request.messages, request.game_context)
    try:
        reply = await chat(full_messages)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")
    return CoachChatResponse(reply=reply)


@router.post("/chat/stream")
async def coach_chat_stream(request: CoachChatRequest):
    full_messages = _prepare_messages(request.messages, request.game_context)

    async def event_stream():
        try:
            async for delta in stream_chat(full_messages):
                yield f"data: {json.dumps({'delta': delta})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:  # noqa: BLE001
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
