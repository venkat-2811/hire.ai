from fastapi import APIRouter

from app.api.v2.endpoints.analytics import router as analytics_router
from app.api.v2.endpoints.ai_interview import router as ai_interview_router
from app.api.v2.endpoints.apply import router as apply_router
from app.api.v2.endpoints.assessments import router as assessments_router
from app.api.v2.endpoints.billing import router as billing_router
from app.api.v2.endpoints.candidates import router as candidates_router
from app.api.v2.endpoints.dsa_problems import router as dsa_problems_router
from app.api.v2.endpoints.interviews import router as interviews_router
from app.api.v2.endpoints.job_status import router as job_status_router
from app.api.v2.endpoints.jobs import router as jobs_router
from app.api.v2.endpoints.profile import router as profile_router
from app.api.v2.endpoints.screening import router as screening_router
from app.api.v2.endpoints.subscription import router as subscription_router
from app.api.v2.endpoints.test import router as test_router
from app.api.v2.endpoints.usage import router as usage_router

api_router = APIRouter()

api_router.include_router(test_router, tags=["test"])
api_router.include_router(jobs_router, tags=["jobs"])
api_router.include_router(candidates_router, tags=["candidates"])
api_router.include_router(screening_router, tags=["screening"])
api_router.include_router(analytics_router, tags=["analytics"])
api_router.include_router(job_status_router, tags=["job-status"])
api_router.include_router(profile_router, tags=["profile"])
api_router.include_router(assessments_router, tags=["assessments"])
api_router.include_router(ai_interview_router, tags=["ai-interview"])
api_router.include_router(apply_router, tags=["apply"])
api_router.include_router(usage_router, tags=["usage"])
api_router.include_router(subscription_router, tags=["subscription"])
api_router.include_router(billing_router, tags=["billing"])
api_router.include_router(interviews_router, tags=["interviews"])
api_router.include_router(dsa_problems_router, tags=["dsa-problems"])
