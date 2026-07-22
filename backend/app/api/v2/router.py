from fastapi import APIRouter

from app.api.v2.endpoints.analytics import router as analytics_router
from app.api.v2.endpoints.admin import router as admin_router
from app.api.v2.endpoints.ai_interview import router as ai_interview_router
from app.api.v2.endpoints.apply import router as apply_router
from app.api.v2.endpoints.assessments import router as assessments_router
from app.api.v2.endpoints.audit import router as audit_router
from app.api.v2.endpoints.billing import router as billing_router
from app.api.v2.endpoints.candidates import router as candidates_router
from app.api.v2.endpoints.clerk_webhooks import router as clerk_webhooks_router
from app.api.v2.endpoints.companies import router as companies_router
from app.api.v2.endpoints.dsa_problems import router as dsa_problems_router
from app.api.v2.endpoints.interviews import router as interviews_router
from app.api.v2.endpoints.job_status import router as job_status_router
from app.api.v2.endpoints.jobs import router as jobs_router
from app.api.v2.endpoints.linkedin_talent import router as linkedin_talent_router
from app.api.v2.endpoints.profile import router as profile_router
from app.api.v2.endpoints.screening import router as screening_router
from app.api.v2.endpoints.subscription import router as subscription_router
from app.api.v2.endpoints.test import router as test_router
from app.api.v2.endpoints.usage import router as usage_router
from app.api.v2.endpoints.resume_optimization import router as resume_optimization_router

api_router = APIRouter()

api_router.include_router(test_router, tags=["test"])
api_router.include_router(admin_router, tags=["admin"])
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
api_router.include_router(clerk_webhooks_router, tags=["clerk-webhooks"])
api_router.include_router(resume_optimization_router, tags=["resume-optimization"])
api_router.include_router(linkedin_talent_router, tags=["linkedin-talent"])
api_router.include_router(companies_router, tags=["companies"])
api_router.include_router(audit_router, tags=["audit"])
