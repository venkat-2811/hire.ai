"""
Clerk JWT authentication for FastAPI backend.
Verifies JWT tokens issued by Clerk using JWKS.
"""
import httpx
import logging
from typing import Optional, Dict, Any
from functools import lru_cache
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, jwk, JWTError
from jose.exceptions import JWKError
from app.config import get_settings
from app.services.clerk_profile_sync import recover_profile_if_incomplete
from app.services.db.supabase_service import get_db_admin_service


security = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_jwks_cached(jwks_url: str) -> Dict[str, Any]:
    """Fetch and cache JWKS from Clerk."""
    try:
        response = httpx.get(
            jwks_url,
            timeout=10.0,
            follow_redirects=True,
            headers={"Accept": "application/json"},
        )
    except Exception as e:
        raise RuntimeError(f"Failed to fetch Clerk JWKS from {jwks_url}: {e}")

    if response.status_code != 200:
        body_preview = (response.text or "")[:300]
        raise RuntimeError(
            f"Failed to fetch Clerk JWKS from {jwks_url}: HTTP {response.status_code}. Body preview: {body_preview}"
        )

    try:
        jwks = response.json()
    except Exception as e:
        body_preview = (response.text or "")[:300]
        raise RuntimeError(
            f"Invalid JSON from Clerk JWKS endpoint {jwks_url}: {e}. Body preview: {body_preview}"
        )

    if not isinstance(jwks, dict) or not isinstance(jwks.get("keys"), list):
        raise RuntimeError(f"Invalid JWKS format from {jwks_url}")

    return jwks


def get_jwks() -> Dict[str, Any]:
    """Get JWKS, with cache invalidation on error."""
    settings = get_settings()
    if not settings.clerk_jwks_url:
        raise RuntimeError("CLERK_JWKS_URL is not configured")
    try:
        return _get_jwks_cached(settings.clerk_jwks_url)
    except Exception:
        _get_jwks_cached.cache_clear()
        raise


def get_signing_key(token: str) -> Any:
    """Get the signing key for a JWT token from JWKS."""
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token header: {e}")

    try:
        jwks = get_jwks()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication unavailable: {e}")
    
    for key in jwks.get("keys", []):
        if key.get("kid") == unverified_header.get("kid"):
            try:
                return jwk.construct(key)
            except JWKError as e:
                raise HTTPException(status_code=401, detail=f"Invalid signing key: {e}")
    
    raise HTTPException(status_code=401, detail="Signing key not found")


def verify_clerk_token(token: str) -> Dict[str, Any]:
    """Verify a Clerk JWT token and return the payload."""
    with open("jwt.txt", "w") as f:
        f.write(token)
        
    settings = get_settings()
    
    if not settings.clerk_issuer:
        raise RuntimeError("CLERK_ISSUER is not configured")

    try:
        signing_key = get_signing_key(token)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication unavailable: {e}")
    
    try:
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer,
            options={
                "verify_aud": False,  # Clerk doesn't always set audience
                "verify_exp": True,
                "verify_iss": True,
            }
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTClaimsError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token claims: {e}")
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


class ClerkUser:
    """Represents an authenticated Clerk user."""
    
    def __init__(self, payload: Dict[str, Any]):
        self.id = payload.get("sub", "")
        self.email = payload.get("email") or self._extract_email(payload)
        self.full_name = payload.get("name") or self._extract_name(payload)
        self.image_url = payload.get("image_url") or payload.get("picture")
        self.metadata = payload.get("public_metadata", {})
        self.raw = payload
    
    def _extract_email(self, payload: Dict[str, Any]) -> Optional[str]:
        """Extract email from various possible locations in payload."""
        # Clerk sometimes puts email in different places
        if "email_addresses" in payload:
            addresses = payload["email_addresses"]
            if addresses and len(addresses) > 0:
                return addresses[0].get("email_address")
        return None
    
    def _extract_name(self, payload: Dict[str, Any]) -> Optional[str]:
        """Extract full name from payload."""
        first = payload.get("first_name", "")
        last = payload.get("last_name", "")
        if first or last:
            return f"{first} {last}".strip()
        return None
    
    @property
    def is_hiring_manager(self) -> bool:
        """Check if user has hiring manager role."""
        return self.metadata.get("role") == "hiring_manager"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> ClerkUser:
    """FastAPI dependency to get the current authenticated user."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = credentials.credentials
    try:
        payload = verify_clerk_token(token)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = ClerkUser(payload)

    # Legacy recovery safeguard:
    # if profile identity fields are missing for an older user,
    # refresh from Clerk and patch Supabase profile.
    try:
        await recover_profile_if_incomplete(user.id)
    except Exception as exc:
        logger.warning("[auth.clerk] profile recovery skipped user=%s error=%s", user.id, exc)

    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[ClerkUser]:
    """FastAPI dependency to optionally get the current user (no error if not authenticated)."""
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        payload = verify_clerk_token(token)
        return ClerkUser(payload)
    except HTTPException:
        return None


async def require_hiring_manager(
    user: ClerkUser = Depends(get_current_user),
) -> ClerkUser:
    """FastAPI dependency to require hiring manager role."""
    roles = await _get_user_roles(user.id)
    # Backward-compatible interpretation:
    # - recruiter is the effective hiring manager role in this schema
    # - admin also gets manager-level access
    if "recruiter" not in roles and "admin" not in roles:
        raise HTTPException(status_code=403, detail="Hiring manager access required")
    return user


async def _get_user_roles(user_id: str) -> set[str]:
    """Fetch all role rows for a user from user_roles.

    IMPORTANT: a user may have multiple role rows; callers must check for exact
    role presence, not just existence of any row.
    """
    db = get_db_admin_service()

    def _fetch_roles():
        return (
            db.client.from_("user_roles")
            .select("role")
            .eq("user_id", user_id)
            .execute()
        )

    res = await db.run(_fetch_roles)
    rows = getattr(res, "data", None) or []
    roles: set[str] = set()
    if isinstance(rows, list):
        for row in rows:
            if isinstance(row, dict) and row.get("role"):
                roles.add(str(row.get("role")))
    return roles


def require_role(required_role: str):
    """FastAPI dependency factory that enforces a specific role from user_roles.

    Fails closed: if role rows are missing or role is absent, returns 403.
    """
    required = str(required_role or "").strip().lower()
    if not required:
        raise ValueError("required_role must be a non-empty string")

    async def _dep(user: ClerkUser = Depends(get_current_user)) -> ClerkUser:
        roles = await _get_user_roles(user.id)
        if required not in roles:
            raise HTTPException(status_code=403, detail=f"{required} role required")
        return user

    return _dep


def require_any_role(*required_roles: str):
    """FastAPI dependency factory that allows any role in required_roles."""
    allowed = {str(r or "").strip().lower() for r in required_roles if str(r or "").strip()}
    if not allowed:
        raise ValueError("At least one role must be provided")

    async def _dep(user: ClerkUser = Depends(get_current_user)) -> ClerkUser:
        roles = await _get_user_roles(user.id)
        if not roles.intersection(allowed):
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return _dep
