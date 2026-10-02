from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.config import settings
from app.security_headers import hsts_header_value


def client_ip(request: Request) -> str:
    peer = request.client.host if request.client else ""
    if peer in settings.trusted_proxy_set():
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            return forwarded
        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip
    return peer or "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    _instances: list["RateLimitMiddleware"] = []

    def __init__(self, app) -> None:
        super().__init__(app)
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()
        RateLimitMiddleware._instances.append(self)

    @classmethod
    def reset_all(cls) -> None:
        for inst in cls._instances:
            with inst._lock:
                inst._hits.clear()

    def _limit_for(self, path: str, method: str) -> int | None:
        if method != "POST":
            return None
        if path.endswith("/auth/login"):
            return settings.login_rate_limit
        if path.endswith("/auth/register") or path.endswith("/admin/farmers"):
            return settings.register_rate_limit
        if "/auth/password/" in path:
            return settings.password_rate_limit
        if path.endswith("/features/disease") or path.endswith("/features/disease/"):
            return settings.upload_rate_limit
        return None

    async def dispatch(self, request: Request, call_next) -> Response:
        limit = self._limit_for(request.url.path, request.method)
        if limit:
            key = f"{client_ip(request)}:{request.url.path}"
            window = settings.rate_limit_window_seconds
            now = time.time()
            with self._lock:
                bucket = self._hits[key]
                while bucket and now - bucket[0] > window:
                    bucket.popleft()
                if len(bucket) >= limit:
                    retry = int(max(1, window - (now - bucket[0])))
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Terlalu banyak permintaan. Coba lagi nanti."},
                        headers={"Retry-After": str(retry)},
                    )
                bucket.append(now)
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(self), microphone=(), geolocation=()",
        )
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; "
            "script-src 'self' 'wasm-unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "worker-src 'self' blob:; "
            "frame-ancestors 'none'; "
            "object-src 'none'; "
            "base-uri 'self'",
        )
        hsts = hsts_header_value(request)
        if hsts:
            response.headers.setdefault("Strict-Transport-Security", hsts)
        return response
