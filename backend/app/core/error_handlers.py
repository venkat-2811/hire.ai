from __future__ import annotations

import traceback
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import AppError
from app.core.logging import get_logger
from app.core.validation import format_validation_error


logger = get_logger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(_req: Request, exc: HTTPException):
        detail = exc.detail
        if isinstance(detail, dict):
            message = detail.get("message") or detail.get("detail") or str(detail)
            err = detail.get("error") or "http_error"
        else:
            message = str(detail)
            err = "http_error"

        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "error": err, "message": message, "detail": detail},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_req: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": "validation_error",
                "message": "Request validation failed",
                **format_validation_error(exc),
            },
        )

    @app.exception_handler(AppError)
    async def app_error_handler(_req: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.code, "message": exc.message, **(exc.extra or {})},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(req: Request, exc: Exception):
        request_id = req.headers.get("x-request-id")
        logger.error(
            "Unhandled exception",
            extra={
                "path": str(req.url.path),
                "method": req.method,
                "error": str(exc),
                "request_id": request_id,
                "trace": traceback.format_exc() if app.debug else None,
            },
        )
        return JSONResponse(
            status_code=500,
            content={"error": "internal_server_error", "message": "Internal server error"},
        )
