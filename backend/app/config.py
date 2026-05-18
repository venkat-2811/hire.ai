import os
from functools import lru_cache
from typing import Any, Dict, List

from pydantic import Field, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str = Field(min_length=1, alias="OPENAI_API_KEY")
    assemblyai_api_key: str = Field(default="", alias="ASSEMBLYAI_API_KEY")

    supabase_url: str = Field(min_length=1, alias="SUPABASE_URL")
    supabase_key: str = Field(default="", alias="SUPABASE_KEY")
    supabase_service_key: str = Field(min_length=1, alias="SUPABASE_SERVICE_KEY")

    vector_store_path: str = Field(default="./vector_store", alias="VECTOR_STORE_PATH")

    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    debug: bool = Field(default=False, alias="DEBUG")

    frontend_url: str = Field(default="http://localhost:8080", alias="FRONTEND_URL")
    cors_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:8080",
        ],
        alias="CORS_ORIGINS",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v: Any):
        # Support comma-separated env var value: "a,b,c"
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return v

    clerk_publishable_key: str = Field(default="", alias="CLERK_PUBLISHABLE_KEY")
    clerk_jwks_url: str = Field(min_length=1, alias="CLERK_JWKS_URL")
    clerk_issuer: str = Field(min_length=1, alias="CLERK_ISSUER")

    hackerearth_client_id: str = Field(default="", alias="HACKEREARTH_CLIENT_ID")
    hackerearth_client_secret: str = Field(default="", alias="HACKEREARTH_CLIENT_SECRET")

    resend_api_key: str = Field(default="", alias="RESEND_API_KEY")
    resend_from_email: str = Field(default="onboarding@resend.dev", alias="RESEND_FROM_EMAIL")

    smtp_host: str = Field(default="smtp.hostinger.com", alias="SMTP_HOST")
    smtp_port: int = Field(default=465, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from_email: str = Field(default="", alias="SMTP_FROM_EMAIL")
    smtp_use_ssl: bool = Field(default=True, alias="SMTP_USE_SSL")

    stripe_secret_key: str = Field(default="", alias="STRIPE_SECRET_KEY")


def _format_settings_validation_error(exc: ValidationError) -> str:
    # Prefer environment variable names in messages (aliases)
    alias_by_field: Dict[str, str] = {
        "openai_api_key": "OPENAI_API_KEY",
        "supabase_url": "SUPABASE_URL",
        "supabase_key": "SUPABASE_KEY",
        "supabase_service_key": "SUPABASE_SERVICE_KEY",
        "clerk_jwks_url": "CLERK_JWKS_URL",
        "clerk_issuer": "CLERK_ISSUER",
    }

    missing: List[str] = []
    invalid: List[str] = []

    for err in exc.errors():
        loc = err.get("loc") or []
        field = str(loc[0]) if loc else "<unknown>"
        display = alias_by_field.get(field, field)
        msg = str(err.get("msg") or "")
        typ = str(err.get("type") or "")
        if typ == "missing":
            missing.append(display)
        else:
            invalid.append(f"{display}: {msg}")

    parts: List[str] = ["Environment validation failed."]
    if missing:
        parts.append("Missing required environment variables: " + ", ".join(sorted(set(missing))))
    if invalid:
        parts.append("Invalid environment variables: " + "; ".join(invalid))
    parts.append("Fix your .env / environment variables and restart the server.")
    return " ".join(parts)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    try:
        s = Settings()
    except ValidationError as e:
        raise RuntimeError(_format_settings_validation_error(e))

    vercel_url = os.getenv("VERCEL_URL", "").strip()
    if vercel_url:
        full = f"https://{vercel_url}"
        if full not in s.cors_origins:
            s.cors_origins.append(full)
    if s.frontend_url and s.frontend_url not in s.cors_origins:
        s.cors_origins.append(s.frontend_url)
    return s


def ensure_directories():
    settings = get_settings()
    os.makedirs(settings.vector_store_path, exist_ok=True)
