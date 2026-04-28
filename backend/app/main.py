import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import get_settings, ensure_directories
from app.services.openai_client import get_groq_service
from app.routers import (
    jobs_router,
    candidates_router,
    interviews_router,
    screening_router,
    analytics_router
)
from app.routers.applications import router as applications_router
from app.routers.assessments import router as assessments_router
from app.routers.ai_interview import router as ai_interview_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    ensure_directories()
    yield
    # Shutdown
    pass


app = FastAPI(
    title="Talent Scout AI",
    description="AI-powered Interview & Hiring Platform API",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(jobs_router)
app.include_router(candidates_router)
app.include_router(interviews_router)
app.include_router(screening_router)
app.include_router(analytics_router)
app.include_router(applications_router)
app.include_router(assessments_router)
app.include_router(ai_interview_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Talent Scout AI",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/ai/groq/ping")
async def groq_ping():
    groq = get_groq_service()
    try:
        response_text = await asyncio.wait_for(
            groq.generate_text(
                prompt="pong",
                temperature=0.2,
                max_tokens=64,
            ),
            timeout=20,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq ping failed: {e}")

    return {
        "ok": True,
        "model": getattr(groq, "model_name", None),
        "response": (response_text or "").strip()[:200],
    }
