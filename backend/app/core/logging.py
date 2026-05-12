from __future__ import annotations

import logging
import sys
from typing import Optional


def setup_logging(level: str = "INFO") -> None:
    """Configure application-wide logging.

    - Console logs (stdout)
    - Consistent format for local/dev + containers

    Note: kept intentionally lightweight to avoid imposing a specific logging stack.
    """

    root = logging.getLogger()
    if root.handlers:
        return  # already configured

    root.setLevel(level.upper())

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level.upper())

    formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )
    handler.setFormatter(formatter)

    root.addHandler(handler)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    return logging.getLogger(name or "app")
