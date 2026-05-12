from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi.responses import JSONResponse


def success_response(
    data: Any = None,
    *,
    message: str = "OK",
    status_code: int = 200,
    meta: Optional[Dict[str, Any]] = None,
) -> JSONResponse:
    payload: Dict[str, Any] = {"success": True, "message": message, "data": data}
    if meta is not None:
        payload["meta"] = meta
    return JSONResponse(status_code=status_code, content=payload)


def ok(payload: Any = None, *, status_code: int = 200) -> JSONResponse:
    """Return a raw JSON payload without an envelope.

    This is useful for compatibility with the existing Node.js API payload shapes.
    """

    return JSONResponse(status_code=status_code, content=payload)


def error_response(
    *,
    error: str,
    message: str,
    status_code: int,
    detail: Any = None,
) -> JSONResponse:
    payload: Dict[str, Any] = {"success": False, "error": error, "message": message}
    if detail is not None:
        payload["detail"] = detail
    return JSONResponse(status_code=status_code, content=payload)


def api_error(*, message: str, status_code: int = 400) -> JSONResponse:
    """Node-compatible error payload.

    The existing frontend expects many endpoints to return `{ error: string }`.
    """

    return JSONResponse(status_code=status_code, content={"error": message})
