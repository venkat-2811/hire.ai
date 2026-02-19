"""
Deepgram speech-to-text service for live transcription.
Uses Deepgram's Nova-3 model for high-accuracy real-time transcription.
"""
import httpx
from typing import Optional

from app.config import get_settings


class DeepgramService:
    """Deepgram API service for speech-to-text transcription."""
    
    BASE_URL = "https://api.deepgram.com/v1"
    
    def __init__(self):
        pass
    
    def _get_api_key(self) -> str:
        """Get API key fresh from settings each time."""
        settings = get_settings()
        api_key = settings.deepgram_api_key
        if not api_key:
            raise RuntimeError("DEEPGRAM_API_KEY is not configured. Please set the DEEPGRAM_API_KEY environment variable.")
        return api_key
    
    def _headers(self) -> dict:
        return {
            "Authorization": f"Token {self._get_api_key()}",
            "Content-Type": "audio/webm",
        }
    
    def get_websocket_url(self, language: str = "en") -> str:
        """Get WebSocket URL for live transcription."""
        api_key = self._get_api_key()
        # Use nova-3 model for best accuracy
        return f"wss://api.deepgram.com/v1/listen?model=nova-3&language={language}&smart_format=true&interim_results=true&utterance_end_ms=1000&vad_events=true&encoding=linear16&sample_rate=16000"
    
    def get_auth_token(self) -> str:
        """Get the API key for client-side WebSocket authentication."""
        return self._get_api_key()
    
    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        language: str = "en",
        model: str = "nova-3",
        mimetype: str = "audio/webm",
    ) -> str:
        """
        Transcribe audio bytes using Deepgram's pre-recorded API.
        This is a fallback for when live transcription isn't available.
        
        Args:
            audio_bytes: Raw audio data
            language: Language code (default: en)
            model: Deepgram model to use (default: nova-3)
            mimetype: Audio MIME type
        
        Returns:
            Transcribed text
        """
        url = f"{self.BASE_URL}/listen"
        params = {
            "model": model,
            "language": language,
            "smart_format": "true",
            "punctuate": "true",
        }
        
        headers = {
            "Authorization": f"Token {self._get_api_key()}",
            "Content-Type": mimetype,
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    url,
                    params=params,
                    headers=headers,
                    content=audio_bytes,
                )
                response.raise_for_status()
                data = response.json()
                
                # Extract transcript from response
                results = data.get("results", {})
                channels = results.get("channels", [])
                if channels:
                    alternatives = channels[0].get("alternatives", [])
                    if alternatives:
                        return alternatives[0].get("transcript", "")
                
                return ""
                
            except httpx.HTTPStatusError as e:
                body = (e.response.text or "").strip()
                raise RuntimeError(f"Deepgram transcription failed ({e.response.status_code}): {body}")
            except Exception as e:
                raise RuntimeError(f"Deepgram transcription error: {str(e)}")


_service: Optional[DeepgramService] = None


def get_deepgram_service() -> DeepgramService:
    global _service
    if _service is None:
        _service = DeepgramService()
    return _service
