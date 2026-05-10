from __future__ import annotations

from app.config import get_settings
from app.core.logging import get_logger


logger = get_logger(__name__)


def validate_environment() -> None:
    """Fail-fast environment validation.

    This must be called during startup. It will raise RuntimeError if critical
    environment variables are missing/invalid (enforced by Settings).
    """

    logger.info("Validating environment configuration")
    settings = get_settings()

    # Minimal success log (do not print secrets)
    logger.info(
        "Environment configuration validated",
        extra={
            "supabase_url_set": bool(settings.supabase_url),
            "supabase_service_key_set": bool(settings.supabase_service_key),
            "openai_api_key_set": bool(settings.openai_api_key),
            "clerk_jwks_url_set": bool(settings.clerk_jwks_url),
            "clerk_issuer_set": bool(settings.clerk_issuer),
        },
    )
