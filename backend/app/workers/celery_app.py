from __future__ import annotations

from celery import Celery

from app.core.settings import get_settings


def create_celery() -> Celery:
    settings = get_settings()
    celery = Celery(
        "app",
        broker=settings.celery_broker_url,
        backend=settings.celery_result_backend,
        include=[],
    )

    celery.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
    )

    return celery


celery_app = create_celery()
