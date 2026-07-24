from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from fastapi import Request, Depends, HTTPException

from app.auth.clerk import ClerkUser
from app.services.db_admin import get_db_admin_service

@dataclass
class UserContext:
    user_id: str
    email: str
    
    # Company Membership
    is_company_member: bool = False
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    role: Optional[str] = None  # "owner", "recruiter", etc.
    credits_allocated: int = 0
    
    # Individual Subscription
    subscription_plan: str = "free"
    
    # Raw DB objects
    profile_data: Dict[str, Any] = field(default_factory=dict)
    company_data: Dict[str, Any] = field(default_factory=dict)

    def is_owner(self) -> bool:
        return self.is_company_member and self.role == "owner"

    def is_independent(self) -> bool:
        return not self.is_company_member


async def get_user_context(request: Request) -> UserContext:
    """
    FastAPI dependency that constructs a comprehensive UserContext.
    Ensures a single source of truth for user state, company membership, and permissions.
    Throws 401 if user is not authenticated.
    """
    user = getattr(request.state, "user", None)
    if not isinstance(user, ClerkUser):
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db_admin_service()
    
    ctx = UserContext(user_id=user.id, email=user.email)
    
    def _fetch_profile():
        return db.client.from_("profiles").select("*").eq("user_id", user.id).maybe_single().execute()
    
    def _fetch_membership():
        return db.client.from_("company_members").select("*, companies(*)").eq("user_id", user.id).eq("status", "active").maybe_single().execute()
        
    p_res = await db.run(_fetch_profile)
    profile = getattr(p_res, "data", None) or {}
    ctx.profile_data = profile
    ctx.subscription_plan = str(profile.get("subscription_plan") or "free").lower()

    m_res = await db.run(_fetch_membership)
    membership = getattr(m_res, "data", None)
    
    if membership and isinstance(membership, dict):
        ctx.is_company_member = True
        ctx.role = membership.get("role")
        ctx.credits_allocated = int(membership.get("credits_allocated") or 0)
        
        company = membership.get("companies") or {}
        ctx.company_data = company
        ctx.company_id = company.get("id")
        ctx.company_name = company.get("name")
    
    return ctx

def require_independent(ctx: UserContext = Depends(get_user_context)):
    if ctx.is_company_member:
        raise HTTPException(status_code=403, detail="Company members cannot perform this action.")
    return ctx

def require_company_owner(ctx: UserContext = Depends(get_user_context)):
    if not ctx.is_owner():
        raise HTTPException(status_code=403, detail="Company owner privileges required.")
    return ctx

def require_company_member(ctx: UserContext = Depends(get_user_context)):
    if not ctx.is_company_member:
        raise HTTPException(status_code=403, detail="Company membership required.")
    return ctx
