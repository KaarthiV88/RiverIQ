from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import equity

app = FastAPI(title="RiverIQ API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(equity.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
