import os
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self):
        # OpenAI Configuration
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        
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
        
        # CORS
        cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
        self.cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]


def get_settings() -> Settings:
    return Settings()


def ensure_directories():
    """Ensure required directories exist."""
    settings = get_settings()
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.vector_store_path, exist_ok=True)
