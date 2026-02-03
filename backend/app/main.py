from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import get_settings, ensure_directories
from app.routers import (
    jobs_router,
    candidates_router,
    interviews_router,
    screening_router,
    analytics_router
)


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
