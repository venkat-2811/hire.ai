import io
import logging
from typing import Optional

from openai import AsyncOpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)

_EXT_MAP = {
    "audio/webm": "webm",
    "audio/webm;codecs=opus": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/aac": "aac",
    "audio/flac": "flac",
    "video/webm": "webm",
}


class _NamedBytesIO(io.BytesIO):
    """BytesIO subclass with a .name attribute for OpenAI SDK multipart upload."""
    def __init__(self, data: bytes, name: str) -> None:
        super().__init__(data)
        self.name = name


class WhisperService:
    # gpt-4o-mini-transcribe: faster, cheaper, more accurate than whisper-1
    MODEL = "gpt-4o-mini-transcribe"

    def _get_client(self) -> AsyncOpenAI:
        settings = get_settings()
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured.")
        return AsyncOpenAI(api_key=settings.openai_api_key)

    async def transcribe(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
        if not audio_bytes:
            logger.warning("[Transcribe] Empty audio bytes — returning empty transcript")
            return ""

        client = self._get_client()

        base_mime = mime_type.split(";")[0].strip().lower() if mime_type else "audio/webm"
        ext = _EXT_MAP.get(base_mime, "webm")
        audio_file = _NamedBytesIO(audio_bytes, f"audio.{ext}")

        logger.info("[Transcribe] Starting transcription model=%s mime=%s bytes=%d", self.MODEL, mime_type, len(audio_bytes))
        try:
            result = await client.audio.transcriptions.create(
                model=self.MODEL,
                file=audio_file,
                timeout=90.0,
            )
            text = result.text if hasattr(result, "text") else str(result)
            logger.info("[Transcribe] OK chars=%d", len(text or ""))
            return (text or "").strip()
        except Exception as e:
            err_lower = str(e).lower()
            logger.error("[Transcribe] Error model=%s mime=%s bytes=%d: %s", self.MODEL, mime_type, len(audio_bytes), str(e))
            if "api key" in err_lower or "authentication" in err_lower or "unauthorized" in err_lower:
                raise RuntimeError(f"Transcription auth error: {str(e)}")
            # Bad audio / no speech / network — return empty so interview can continue
            return ""


_service: Optional[WhisperService] = None


def get_whisper_service() -> WhisperService:
    global _service
    if _service is None:
        _service = WhisperService()
    return _service
