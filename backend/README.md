# FastAPI Backend (Foundation)

This folder contains a **parallel FastAPI backend foundation** for the Rekshift application.

Important:
- This does **not** remove or modify the existing Node.js/Netlify backend.
- This does **not** migrate any existing APIs yet.
- This backend is intended to become the future replacement backend.

## Project structure

- `app/main.py` — FastAPI application entrypoint
- `app/api/v1` — versioned API base (`/api/v1`) for future migrations
- `app/core` — settings, logging, exception handling
- `app/auth` — Clerk JWT verification helpers (foundation)
- `app/database` — Supabase client helpers
- `app/services` — service layer (AI wrappers, etc.)
- `app/workers` — Celery scaffolding (not yet used by migrated APIs)

## Local development (venv)

1. Create and activate venv

```bash
python -m venv .venv
# Windows (PowerShell)
.venv\\Scripts\\Activate.ps1
```

2. Install dependencies

```bash
pip install -r requirements.txt
```

3. Create `.env`

Copy from `.env.example` and fill values.

4. Run the server

```bash
uvicorn app.main:app --reload
```

- Swagger UI: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`
- Versioned health: `http://localhost:8000/api/v1/health`

## Docker (development)

```bash
docker compose up --build
```

## Environment variables

Minimum for boot:
- `SUPABASE_URL`
- `SUPABASE_KEY` (anon)

Optional but required for authenticated routes / AI:
- `SUPABASE_SERVICE_KEY`
- `CLERK_JWKS_URL`
- `CLERK_ISSUER`
- `OPENAI_API_KEY`

## Notes

- Existing, non-versioned routes under `app/routers` remain as-is.
- New migrations should be added under `/api/v1` going forward.
