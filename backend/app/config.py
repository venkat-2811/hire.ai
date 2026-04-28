import os
from typing import List
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())


class Settings:
    def __init__(self):
        # Groq Configuration
        self.groq_api_key = os.getenv("GROQ_API_KEY", "")

        # AssemblyAI (Speech-to-text)
        self.assemblyai_api_key = os.getenv("ASSEMBLYAI_API_KEY", "")
        
        # Supabase Configuration
        self.supabase_url = os.getenv("SUPABASE_URL", "")
        self.supabase_key = os.getenv("SUPABASE_KEY", "")
        self.supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", "")
        
        # Application Settings
        self.upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
        self.vector_store_path = os.getenv("VECTOR_STORE_PATH", "./vector_store")
        
        # Server Configuration
        self.host = os.getenv("HOST", "0.0.0.0")
        self.port = int(os.getenv("PORT", "8000"))
        self.debug = os.getenv("DEBUG", "false").lower() == "true"

        # Frontend URL (used for email links)
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
        
        # CORS
        cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost:8080")
        self.cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]
        
        # Auto-add Vercel deployment URLs to CORS
        vercel_url = os.getenv("VERCEL_URL", "")
        if vercel_url and f"https://{vercel_url}" not in self.cors_origins:
            self.cors_origins.append(f"https://{vercel_url}")
        # Allow all *.vercel.app subdomains in production
        frontend_url = os.getenv("FRONTEND_URL", "")
        if frontend_url and frontend_url not in self.cors_origins:
            self.cors_origins.append(frontend_url)
        
        # Clerk Authentication
        self.clerk_publishable_key = os.getenv("CLERK_PUBLISHABLE_KEY", "")
        self.clerk_jwks_url = os.getenv("CLERK_JWKS_URL", "")
        self.clerk_issuer = os.getenv("CLERK_ISSUER", "")
        
        # HackerEarth Code Evaluation API
        self.hackerearth_client_secret = os.getenv("HACKEREARTH_CLIENT_SECRET", "")

        # Resend Email
        self.resend_api_key = os.getenv("RESEND_API_KEY", "")
        self.resend_from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")


def get_settings() -> Settings:
    return Settings()


def ensure_directories():
    """Ensure required directories exist."""
    settings = get_settings()
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.vector_store_path, exist_ok=True)
