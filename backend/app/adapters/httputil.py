"""Shared HTTP GET with timeout, retry, and file cache."""

from __future__ import annotations

import hashlib
import json
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx

from app.config import settings


class ExternalFetchError(Exception):
    pass


def get_json(
    url: str,
    *,
    timeout: float,
    retries: int,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    last: Exception | None = None
    merged = {
        "User-Agent": settings.external_http_user_agent,
        "Accept": "application/json",
        **(headers or {}),
    }
    for attempt in range(retries + 1):
        try:
            with httpx.Client(timeout=timeout, follow_redirects=True) as client:
                response = client.get(url, headers=merged)
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict):
                    raise ExternalFetchError("JSON object expected")
                return data
        except (httpx.HTTPError, json.JSONDecodeError, ValueError, ExternalFetchError) as exc:
            last = exc
            if attempt < retries:
                time.sleep(min(0.25 * (2**attempt), 2.0))
    raise ExternalFetchError(str(last) if last else "request failed") from last


def cache_file(directory: Path, key: str) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:40]
    return directory / f"{digest}.json"


def write_cache(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = {**payload, "_cached_at": datetime.now(UTC).isoformat()}
    path.write_text(json.dumps(body, ensure_ascii=True), encoding="utf-8")


def read_cache(path: Path, ttl_hours: int) -> tuple[dict[str, Any] | None, bool]:
    """Return (payload, stale). Payload includes original fields; _cached_at stripped."""
    if not path.exists():
        return None, True
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None, True
    cached_at = raw.get("_cached_at")
    stale = True
    if cached_at:
        try:
            stored = datetime.fromisoformat(str(cached_at).replace("Z", "+00:00"))
            if stored.tzinfo is None:
                stored = stored.replace(tzinfo=UTC)
            stale = datetime.now(UTC) - stored > timedelta(hours=ttl_hours)
        except ValueError:
            stale = True
    payload = {k: v for k, v in raw.items() if k != "_cached_at"}
    payload["_cached_at"] = cached_at
    return payload, stale
