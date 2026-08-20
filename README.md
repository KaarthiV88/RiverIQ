# RiverIQ

Texas Hold'em AI Coaching Platform — analyze your play, find leaks, and get real-time coaching powered by LLMs.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (Vercel) |
| Backend | FastAPI (Fly.io / Render) |
| Database | Supabase (Postgres) |
| LLM | Groq API — GPT-OSS 120B |
| Equity Engine | treys (Monte Carlo simulation) |

## Features

- Playable browser poker table
- Real-time equity calculator via Monte Carlo simulation
- LLM coach chat with hand-aware context
- Hand history storage and leak detection

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- A `.env` file in the project root (see `.env.example`)

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API runs at `http://localhost:8000`  
Auto-generated docs at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI runs at `http://localhost:3000`

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```
GROQ_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## AI Concepts Demonstrated

- **Monte Carlo simulation** — probabilistic equity calculation across random board runouts
- **LLM prompt engineering** — structured hand state injected into the LLM context for coaching
- **RAG-lite pattern** — hand history retrieved from Postgres and injected into LLM context for leak detection
- **Async API design** — FastAPI async handlers for non-blocking LLM and DB calls
