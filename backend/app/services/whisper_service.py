import io
from typing import Optional

from openai import AsyncOpenAI

from app.config import get_settings

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


class WhisperService:
    MODEL = "whisper-1"

    def _get_client(self) -> AsyncOpenAI:
        settings = get_settings()
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured.")
        return AsyncOpenAI(api_key=settings.openai_api_key)

    async def transcribe(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
        if not audio_bytes:
            return ""

        client = self._get_client()

        base_mime = mime_type.split(";")[0].strip().lower() if mime_type else "audio/webm"
        ext = _EXT_MAP.get(base_mime, "webm")

        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = f"audio.{ext}"

        try:
            result = await client.audio.transcriptions.create(
                model=self.MODEL,
                file=audio_file,
                response_format="text",
                timeout=60.0,
            )
            return str(result).strip() if result else ""
        except Exception as e:
            err_lower = str(e).lower()
            if any(k in err_lower for k in ("no speech", "audio_too_short", "too short", "duration")):
                return ""
            raise RuntimeError(f"Whisper transcription failed: {str(e)}")


_service: Optional[WhisperService] = None


def get_whisper_service() -> WhisperService:
    global _service
    if _service is None:
        _service = WhisperService()
    return _service
