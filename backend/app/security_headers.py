"""Public-host HTTPS-only HSTS. Never emit HSTS for localhost or plain HTTP."""

from __future__ import annotations

from urllib.parse import urlparse

from starlette.requests import Request

from app.config import settings

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "testserver", ""}


def request_host(request: Request) -> str:
    raw = request.headers.get("host") or request.url.hostname or ""
    return raw.split(":")[0].lower()


def request_is_https(request: Request) -> bool:
    proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    if proto == "https":
        return True
    visitor = (request.headers.get("cf-visitor") or "").lower()
    if "https" in visitor:
        return True
    return request.url.scheme == "https"


def public_https_host(request: Request) -> bool:
    host = request_host(request)
    if host in _LOCAL_HOSTS:
        return False
    public_host = (urlparse(settings.public_origin).hostname or "").lower()
    if not public_host or public_host in _LOCAL_HOSTS:
        return False
    if host != public_host:
        return False
    return request_is_https(request)


def hsts_header_value(request: Request) -> str | None:
    if not public_https_host(request):
        return None
    return f"max-age={settings.hsts_max_age}; includeSubDomains"
