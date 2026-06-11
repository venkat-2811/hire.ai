"""
Clerk JWT authentication for FastAPI backend.
Verifies JWT tokens issued by Clerk using JWKS.
"""
import logging
import httpx
from typing import Optional, Dict, Any
from functools import lru_cache
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, jwk, JWTError
from jose.exceptions import JWKError
from app.config import get_settings

logger = logging.getLogger(__name__)


security = HTTPBearer(auto_error=False)


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
    """
    Represents an authenticated Clerk user, resolved during request authentication.

    Admin detection strategy (in order, any signal is sufficient):
    1. Email in JWT payload → checked against HARDCODED_ADMIN_EMAILS.
    2. Clerk public_metadata.role == "admin".
    3. Email from Supabase profiles table (looked up by user_id) → checked against ADMIN_EMAILS.
       This is the primary path when Clerk JWT has no email claim (default configuration).
    4. profiles.role == 'admin' DB column (set by the SQL migration).

    Signals 3 & 4 are resolved asynchronously in get_current_user() using anyio.to_thread,
    then stored on this object as plain attributes. is_admin is a pure in-memory bool.
    Admin users bypass ALL subscription restrictions and billing checks.
    """

    def __init__(self, payload: Dict[str, Any]):
        self.id: str = payload.get("sub", "")
        # Email from JWT (often None in default Clerk configuration — resolved later)
        self.email: Optional[str] = payload.get("email") or self._extract_email(payload)
        self.full_name: Optional[str] = payload.get("name") or self._extract_name(payload)
        self.image_url: Optional[str] = payload.get("image_url") or payload.get("picture")
        self.metadata: Dict[str, Any] = payload.get("public_metadata") or {}
        self.raw: Dict[str, Any] = payload
        # Resolved asynchronously by get_current_user — starts as None
        self._db_role: Optional[str] = None

    def _extract_email(self, payload: Dict[str, Any]) -> Optional[str]:
        """Extract email from non-standard JWT claim locations."""
        if "email_addresses" in payload:
            addresses = payload["email_addresses"]
            if addresses and len(addresses) > 0:
                return addresses[0].get("email_address")
        return None

    def _extract_name(self, payload: Dict[str, Any]) -> Optional[str]:
        first = payload.get("first_name", "")
        last = payload.get("last_name", "")
        if first or last:
            return f"{first} {last}".strip()
        return None

    @property
    def is_admin(self) -> bool:
        """
        Returns True if this user is a platform administrator.
        This is a pure in-memory check — the DB lookup already happened
        in get_current_user() before this property is accessed.

        Signal priority (any one is sufficient):
        1. Email from JWT → HARDCODED_ADMIN_EMAILS
        2. Clerk public_metadata.role == "admin"
        3. Profile email from Supabase → HARDCODED_ADMIN_EMAILS  (set by _resolve_profile)
        4. profiles.role == "admin" DB column                    (set by _resolve_profile)
        5. Clerk user_id → HARDCODED_ADMIN_USER_IDS              (always reliable, JWT sub)
        """
        from app.auth.roles import is_admin_email, is_admin_user_id

        # Signal 5 FIRST: user_id from JWT sub — most reliable, always present
        # Works even when email column is "unknown" and role column wasn't updated
        if self.id and is_admin_user_id(self.id):
            return True

        # Signal 1: email from JWT (fast path — no DB needed)
        if self.email and is_admin_email(self.email):
            return True

        # Signal 2: Clerk public_metadata.role
        if self.metadata.get("role") == "admin":
            return True

        # Signal 4: DB role column (resolved by get_current_user via _resolve_profile)
        if self._db_role == "admin":
            return True

        return False

    @property
    def role(self) -> str:
        """Returns the user's RBAC role string."""
        return "admin" if self.is_admin else "recruiter"

    @property
    def is_hiring_manager(self) -> bool:
        """Check if user has hiring manager role. Admins always qualify."""
        return self.is_admin or self.metadata.get("role") == "hiring_manager" or True


async def _resolve_profile(user: ClerkUser) -> None:
    """
    Async helper: looks up the user's profile in Supabase by user_id and populates
    user.email (if not in JWT) and user._db_role.

    This runs once per request in get_current_user(), safely inside the async context
    using anyio.to_thread.run_sync so the sync Supabase client doesn't block the event loop.
    """
    import anyio
    from app.auth.roles import is_admin_email

    user_id = user.id
    if not user_id:
        return

    def _fetch_profile():
        try:
            from app.services.db.supabase_service import get_db_admin_service
            db = get_db_admin_service()
            # Try with role column (works after migration)
            try:
                res = (
                    db.client.from_("profiles")
                    .select("email, role")
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                )
                return getattr(res, "data", None) or {}
            except Exception:
                # role column doesn't exist yet — email only
                try:
                    res = (
                        db.client.from_("profiles")
                        .select("email")
                        .eq("user_id", user_id)
                        .maybe_single()
                        .execute()
                    )
                    return getattr(res, "data", None) or {}
                except Exception:
                    return {}
        except Exception:
            return {}

    try:
        profile: Dict[str, Any] = await anyio.to_thread.run_sync(_fetch_profile)
    except Exception:
        profile = {}

    profile_email: str = profile.get("email") or ""
    db_role: str = profile.get("role") or ""

    # Populate email on user if JWT didn't provide it (Signal 3)
    if profile_email and not user.email:
        user.email = profile_email
        if is_admin_email(profile_email):
            logger.info(
                "[auth] ADMIN via Signal 3 (profile email) user_id=%s email=%s",
                user_id, profile_email,
            )

    # Store DB role (Signal 4)
    if db_role:
        user._db_role = db_role
        if db_role == "admin":
            logger.info(
                "[auth] ADMIN via Signal 4 (DB role column) user_id=%s email=%s",
                user_id, profile_email or user.email,
            )

    if not user.is_admin:
        logger.debug(
            "[auth] NOT admin user_id=%s jwt_email=%s profile_email=%s db_role=%s",
            user_id, user.raw.get("email"), profile_email, db_role,
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> ClerkUser:
    """FastAPI dependency: authenticate, then resolve profile for admin detection."""
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

    # Resolve email + role from Supabase (needed when Clerk JWT has no email claim).
    # Fast-path: skip DB lookup if email is already in the JWT AND it's not an admin.
    # We always do the lookup for potential admins (or when email is missing).
    from app.auth.roles import is_admin_email
    jwt_email = user.email or ""
    needs_db = not jwt_email or is_admin_email(jwt_email)
    if needs_db:
        await _resolve_profile(user)

    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[ClerkUser]:
    """FastAPI dependency: optionally authenticate (no error if not authenticated)."""
    if credentials is None:
        return None
    try:
        token = credentials.credentials
        payload = verify_clerk_token(token)
        user = ClerkUser(payload)
        from app.auth.roles import is_admin_email
        jwt_email = user.email or ""
        needs_db = not jwt_email or is_admin_email(jwt_email)
        if needs_db:
            await _resolve_profile(user)
        return user
    except HTTPException:
        return None


async def require_hiring_manager(
    user: ClerkUser = Depends(get_current_user),
) -> ClerkUser:
    """FastAPI dependency to require hiring manager role."""
    if not user.is_hiring_manager:
        raise HTTPException(status_code=403, detail="Hiring manager access required")
    return user
