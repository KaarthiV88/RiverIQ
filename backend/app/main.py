from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.bots import orchestrator
from app.routers import bot, equity


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load the trained policy net once at startup. If no checkpoint exists,
    # orchestrator.decide() silently falls back to the heuristic baseline.
    orchestrator.load_model()
    yield


app = FastAPI(title="RiverIQ API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(equity.router)
app.include_router(bot.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
