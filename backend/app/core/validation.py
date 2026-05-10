from __future__ import annotations

from typing import Any, Dict, List

from fastapi.exceptions import RequestValidationError


def format_validation_error(exc: RequestValidationError) -> Dict[str, Any]:
    errors: List[Dict[str, Any]] = []
    for e in exc.errors():
        errors.append(
            {
                "loc": e.get("loc"),
                "msg": e.get("msg"),
                "type": e.get("type"),
            }
        )
    return {"errors": errors}
