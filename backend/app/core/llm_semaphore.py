"""
LLM Concurrency Control
=======================
Provides a singleton asyncio.Semaphore that caps the maximum number of
concurrent OpenAI API calls across the entire application.

This prevents:
  - OpenAI rate-limit (429) cascades when many recruiters generate assessments
    simultaneously.
  - Token-per-minute (TPM) limit breaches on lower OpenAI tiers.

Timeout design
--------------
Semaphore acquisition has NO wait_timeout by default. Coroutines that are
waiting for a slot are simply suspended — they consume ~2-4 KB of stack each
and zero CPU. This is correct asyncio behaviour and creates no meaningful
memory pressure for the typical load this platform sees.

The actual OpenAI HTTP call timeout is applied inside openai_client.py using
the OpenAI client's native timeout= parameter (LLM_API_CALL_TIMEOUT_SECONDS,
default 90s). This ensures every generation job always receives the full
timeout budget for the actual API work, regardless of how long it waited
in the semaphore queue.

Configuration
-------------
Set LLM_MAX_CONCURRENCY in the environment (default: 10).
GPT-4.1-mini tier-1 supports ~500 RPM, so 10 concurrent callers is a
deliberately conservative default that can be raised as the account tier grows.

Usage
-----
    from app.core.llm_semaphore import llm_semaphore_context

    async with llm_semaphore_context():          # no wait_timeout
        result = await openai_client.generate_json(prompt)
"""
from __future__ import annotations

import asyncio
import os
import threading
from typing import Optional

import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton management — one semaphore per event loop / process.
# A threading lock protects against the rare case where multiple threads
# try to initialise the singleton concurrently at startup.
# ---------------------------------------------------------------------------
_semaphore: Optional[asyncio.Semaphore] = None
_init_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Metrics — simple counters, no external dependency required.
# ---------------------------------------------------------------------------
_metrics: dict[str, int] = {
    "acquired": 0,     # total times semaphore was acquired (= LLM calls started)
    "waiting": 0,      # current number of callers blocked waiting for a slot
    "completed": 0,    # LLM calls that finished (success or error)
    "timed_out": 0,    # calls that raised asyncio.TimeoutError while waiting
}


def _max_concurrency() -> int:
    try:
        return max(1, int(os.getenv("LLM_MAX_CONCURRENCY", "10")))
    except (ValueError, TypeError):
        return 10


def get_llm_semaphore() -> asyncio.Semaphore:
    """Return the process-wide LLM concurrency semaphore (creates it on first call)."""
    global _semaphore
    if _semaphore is None:
        with _init_lock:
            if _semaphore is None:
                capacity = _max_concurrency()
                _semaphore = asyncio.Semaphore(capacity)
                logger.info(
                    "[llm_semaphore] initialised capacity=%d env=LLM_MAX_CONCURRENCY",
                    capacity,
                )
    return _semaphore


def get_llm_semaphore_stats() -> dict:
    """Return current semaphore statistics for the health endpoint."""
    sem = _semaphore
    capacity = _max_concurrency()
    if sem is None:
        available = capacity
    else:
        available = sem._value  # type: ignore[attr-defined]

    return {
        "capacity": capacity,
        "available": available,
        "in_use": capacity - available,
        "metrics": dict(_metrics),
    }


def _inc(key: str, delta: int = 1) -> None:
    """Thread-safe counter increment (GIL makes += atomic for CPython)."""
    _metrics[key] = _metrics.get(key, 0) + delta


class _TrackedSemaphoreContext:
    """Async context manager that updates metrics around semaphore acquisition."""

    __slots__ = ("_sem", "_wait_timeout")

    def __init__(self, sem: asyncio.Semaphore, wait_timeout: Optional[float]):
        self._sem = sem
        self._wait_timeout = wait_timeout

    async def __aenter__(self):
        _inc("waiting")
        try:
            if self._wait_timeout is not None:
                try:
                    await asyncio.wait_for(self._sem.acquire(), timeout=self._wait_timeout)
                except asyncio.TimeoutError:
                    _inc("timed_out")
                    _inc("waiting", -1)
                    raise
            else:
                await self._sem.acquire()
        except Exception:
            _inc("waiting", -1)
            raise
        _inc("waiting", -1)
        _inc("acquired")
        return self

    async def __aexit__(self, *_):
        self._sem.release()
        _inc("completed")


def llm_semaphore_context(wait_timeout: Optional[float] = None) -> _TrackedSemaphoreContext:
    """
    Return an async context manager that:
      1. Waits for a concurrency slot (with optional timeout).
      2. Updates metrics counters.
      3. Releases the slot on exit.

    Example::

        async with llm_semaphore_context(wait_timeout=30):
            result = await openai.generate_json(prompt)
    """
    return _TrackedSemaphoreContext(get_llm_semaphore(), wait_timeout)
