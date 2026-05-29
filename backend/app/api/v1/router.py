from fastapi import APIRouter

from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.test import router as test_router
from app.api.v1.endpoints.contact import router as contact_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(test_router, tags=["test"])
api_router.include_router(contact_router, tags=["contact"])
