import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router as api_v1_router
from app.api.v2.router import api_router as api_v2_router
from app.config import ensure_directories, get_settings
from app.core.config_validation import validate_environment
from app.core.error_handlers import register_exception_handlers
from app.core.logging import setup_logging
from app.middleware.clerk_auth import ClerkAuthMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.request_logging import RequestLoggingMiddleware
from app.services.openai_client import get_openai_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    setup_logging(os.getenv("LOG_LEVEL", "INFO"))
    validate_environment()
    ensure_directories()

    # Register exception handlers (foundation)
    register_exception_handlers(app)
    yield
    # Shutdown
    pass


app = FastAPI(
    title="Talent Scout AI",
    description="AI-powered Interview & Hiring Platform API",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware (foundation)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(ClerkAuthMiddleware)

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
# Versioned API base (foundation)
app.include_router(api_v1_router, prefix="/api/v1")

# AI-heavy migration API base (parallel)
app.include_router(api_v2_router, prefix="/api/v2")


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


@app.get("/ai/openai/ping")
async def openai_ping():
    openai = get_openai_service()
    try:
        response_text = await asyncio.wait_for(
            openai.generate_text(
                prompt="pong",
                temperature=0.2,
                max_tokens=64,
            ),
            timeout=20,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI ping failed: {e}")

    return {
        "ok": True,
        "model": getattr(openai, "model_name", None),
        "response": (response_text or "").strip()[:200],
    }
