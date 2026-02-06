import asyncio
from typing import Optional

import httpx

from app.config import get_settings


class AssemblyAIService:
    BASE_URL = "https://api.assemblyai.com/v2"

    def __init__(self):
        settings = get_settings()
        self.api_key = settings.assemblyai_api_key

    def _headers(self) -> dict:
        if not self.api_key:
            raise RuntimeError("ASSEMBLYAI_API_KEY is not configured")
        return {"authorization": self.api_key}

    async def upload_audio(self, audio_bytes: bytes) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                resp = await client.post(
                    f"{self.BASE_URL}/upload",
                    headers={**self._headers(), "content-type": "application/octet-stream"},
                    content=audio_bytes,
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as e:
                body = (e.response.text or "").strip()
                raise RuntimeError(f"AssemblyAI upload failed ({e.response.status_code}): {body}")
            upload_url = data.get("upload_url")
            if not upload_url:
                raise RuntimeError("AssemblyAI upload failed: missing upload_url")
            return upload_url

    async def create_transcript(self, audio_url: str, language_code: str = "en_us") -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                resp = await client.post(
                    f"{self.BASE_URL}/transcript",
                    headers={**self._headers(), "content-type": "application/json"},
                    json={
                        "audio_url": audio_url,
                        "language_code": language_code,
                        "speech_models": ["universal-2"],
                    },
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as e:
                body = (e.response.text or "").strip()
                raise RuntimeError(f"AssemblyAI transcript create failed ({e.response.status_code}): {body}")
            transcript_id = data.get("id")
            if not transcript_id:
                raise RuntimeError("AssemblyAI transcript create failed: missing id")
            return transcript_id

    async def poll_transcript(self, transcript_id: str, timeout_seconds: int = 120) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            waited = 0
            while waited <= timeout_seconds:
                try:
                    resp = await client.get(
                        f"{self.BASE_URL}/transcript/{transcript_id}",
                        headers=self._headers(),
                    )
                    resp.raise_for_status()
                    data = resp.json()
                except httpx.HTTPStatusError as e:
                    body = (e.response.text or "").strip()
                    raise RuntimeError(f"AssemblyAI poll failed ({e.response.status_code}): {body}")

                status = data.get("status")
                if status == "completed":
                    text = data.get("text") or ""
                    return text

                if status == "error":
                    raise RuntimeError(f"AssemblyAI transcription error: {data.get('error')}")

                await asyncio.sleep(1)
                waited += 1

            raise TimeoutError("AssemblyAI transcription timed out")

    async def transcribe(self, audio_bytes: bytes, language_code: str = "en_us") -> str:
        audio_url = await self.upload_audio(audio_bytes)
        transcript_id = await self.create_transcript(audio_url, language_code=language_code)
        return await self.poll_transcript(transcript_id)


_service: Optional[AssemblyAIService] = None


def get_assemblyai_service() -> AssemblyAIService:
    global _service
    if _service is None:
        _service = AssemblyAIService()
    return _service
