"""Cookie attributes, password rotation, rate limits, and proxy trust."""

from app.config import settings
from app.middleware import RateLimitMiddleware
from tests.conftest import _headers


def _set_cookie(resp) -> str:
    return resp.headers.get("set-cookie", "")


def test_login_sets_httponly_samesite_cookie(client, farmer):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": farmer.email, "password": "TestFarmer123!"},
    )
    assert resp.status_code == 200
    cookie = _set_cookie(resp)
    assert f"{settings.session_cookie_name}=" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/" in cookie
    assert "samesite=lax" in cookie.lower()
    if settings.cookie_secure:
        assert "Secure" in cookie
    else:
        assert "Secure" not in cookie


def test_password_change_rotates_session_cookie(client, farmer, farmer_session):
    resp = client.post(
        "/api/v1/auth/password/change",
        json={
            "current_password": "TestFarmer123!",
            "new_password": "NewerPassword123!",
        },
        headers=_headers(farmer_session["csrf"]),
    )
    assert resp.status_code == 200
    cookie = _set_cookie(resp)
    assert f"{settings.session_cookie_name}=" in cookie
    assert "HttpOnly" in cookie
    farms = client.get("/api/v1/farms")
    assert farms.status_code == 200
    relogin = client.post(
        "/api/v1/auth/login",
        json={"email": farmer.email, "password": "NewerPassword123!"},
    )
    assert relogin.status_code == 200


def test_login_rate_limit_returns_429(client, monkeypatch):
    monkeypatch.setattr(settings, "login_rate_limit", 3)
    RateLimitMiddleware.reset_all()
    payload = {"email": "rate.limit@example.com", "password": "WrongPassword123!"}
    statuses = []
    for _ in range(4):
        statuses.append(client.post("/api/v1/auth/login", json=payload).status_code)
    assert 429 in statuses
    limited = client.post("/api/v1/auth/login", json=payload)
    assert limited.status_code == 429
    assert limited.headers.get("Retry-After")
    RateLimitMiddleware.reset_all()


def test_untrusted_x_forwarded_for_is_ignored(client, farmer):
    """Spoofed forwarding headers from a non-proxy peer must not become the client IP key."""
    RateLimitMiddleware.reset_all()
    monkeypatch_limit = 2
    from app.config import settings as s

    original = s.login_rate_limit
    s.login_rate_limit = monkeypatch_limit
    try:
        payload = {"email": farmer.email, "password": "WrongPassword123!"}
        headers = {"X-Forwarded-For": "203.0.113.9"}
        client.post("/api/v1/auth/login", json=payload, headers=headers)
        client.post("/api/v1/auth/login", json=payload, headers=headers)
        third = client.post("/api/v1/auth/login", json=payload, headers=headers)
        assert third.status_code == 429
        other = client.post(
            "/api/v1/auth/login",
            json=payload,
            headers={"X-Forwarded-For": "198.51.100.2"},
        )
        assert other.status_code == 429
    finally:
        s.login_rate_limit = original
        RateLimitMiddleware.reset_all()


def test_security_headers_on_health(client):
    resp = client.get("/api/v1/health/live")
    assert resp.status_code == 200
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert "strict-origin-when-cross-origin" in resp.headers.get("referrer-policy", "")
    csp = resp.headers.get("content-security-policy", "")
    assert "wasm-unsafe-eval" in csp
    assert "frame-ancestors 'none'" in csp
    assert "Strict-Transport-Security" not in resp.headers
