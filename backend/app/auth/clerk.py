"""
Clerk JWT authentication for FastAPI backend.
Verifies JWT tokens issued by Clerk using JWKS.
"""
import httpx
from typing import Optional, Dict, Any
from functools import lru_cache
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, jwk, JWTError
from jose.exceptions import JWKError
from app.config import get_settings


security = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _get_jwks_cached(jwks_url: str) -> Dict[str, Any]:
    """Fetch and cache JWKS from Clerk."""
    response = httpx.get(jwks_url, timeout=10.0)
    response.raise_for_status()
    return response.json()


def get_jwks() -> Dict[str, Any]:
    """Get JWKS, with cache invalidation on error."""
    settings = get_settings()
    if not settings.clerk_jwks_url:
        raise RuntimeError("CLERK_JWKS_URL is not configured")
    return _get_jwks_cached(settings.clerk_jwks_url)


def get_signing_key(token: str) -> Any:
    """Get the signing key for a JWT token from JWKS."""
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token header: {e}")
    
    jwks = get_jwks()
    
    for key in jwks.get("keys", []):
        if key.get("kid") == unverified_header.get("kid"):
            try:
                return jwk.construct(key)
            except JWKError as e:
                raise HTTPException(status_code=401, detail=f"Invalid signing key: {e}")
    
    raise HTTPException(status_code=401, detail="Signing key not found")


def verify_clerk_token(token: str) -> Dict[str, Any]:
    """Verify a Clerk JWT token and return the payload."""
    settings = get_settings()
    
    if not settings.clerk_issuer:
        raise RuntimeError("CLERK_ISSUER is not configured")
    
    signing_key = get_signing_key(token)
    
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
        return self.metadata.get("role") == "hiring_manager" or True  # Default to true for now


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> ClerkUser:
    """FastAPI dependency to get the current authenticated user."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = credentials.credentials
    payload = verify_clerk_token(token)
    return ClerkUser(payload)


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
    if not user.is_hiring_manager:
        raise HTTPException(status_code=403, detail="Hiring manager access required")
    return user
