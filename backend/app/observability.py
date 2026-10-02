"""Structured logs, request correlation, and in-process counters."""

from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import UTC, datetime
from threading import Lock
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

_metrics_lock = Lock()
_metrics: dict[str, int] = {
    "http_requests_total": 0,
    "http_5xx_total": 0,
    "nasa_live_ok": 0,
    "nasa_fallback": 0,
    "soilgrids_live_ok": 0,
    "soilgrids_fallback": 0,
}


def bump(name: str, amount: int = 1) -> None:
    with _metrics_lock:
        _metrics[name] = _metrics.get(name, 0) + amount


def snapshot_metrics() -> dict[str, int]:
    with _metrics_lock:
        return dict(_metrics)


def reset_metrics() -> None:
    with _metrics_lock:
        for key in list(_metrics):
            _metrics[key] = 0


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        request_id = getattr(record, "request_id", None)
        if request_id:
            payload["request_id"] = request_id
        if record.exc_info:
            payload["exc_type"] = record.exc_info[0].__name__ if record.exc_info[0] else None
        return json.dumps(payload, ensure_ascii=True)


def configure_logging() -> None:
    logger = logging.getLogger("agrifusion")
    if logger.handlers:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        response: Response | None = None
        try:
            response = await call_next(request)
            return response
        finally:
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            status = response.status_code if response is not None else 500
            bump("http_requests_total")
            if status >= 500:
                bump("http_5xx_total")
            if response is not None:
                response.headers["X-Request-ID"] = request_id
            logging.getLogger("agrifusion.http").info(
                "%s %s %s %sms",
                request.method,
                request.url.path,
                status,
                elapsed_ms,
                extra={"request_id": request_id},
            )
