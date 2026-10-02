"""Security and origin validation against live-style requests."""

import uuid

from app.auth.security import hash_password
from app.models import User, UserRole, UserStatus

from tests.conftest import _headers


def test_post_without_csrf_rejected(client, farmer):
    client.post(
        "/api/v1/auth/login",
        json={"email": farmer.email, "password": "TestFarmer123!"},
    )
    resp = client.post(
        "/api/v1/farms",
        json={"name": "No CSRF", "location": "Test"},
        headers={"Origin": "http://127.0.0.1:8080"},
    )
    assert resp.status_code == 403


def test_post_with_wrong_origin_rejected(client, farmer, farmer_session):
    resp = client.post(
        "/api/v1/farms",
        json={"name": "Bad Origin", "location": "Test"},
        headers={
            **_headers(farmer_session["csrf"]),
            "Origin": "http://evil.example:8080",
        },
    )
    assert resp.status_code == 403


def test_register_rejects_short_password(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"name": "X", "email": "short@example.com", "password": "abc"},
    )
    assert resp.status_code == 422


def test_disabled_user_cannot_login(client, db):
    user = User(
        name="Disabled",
        email=f"disabled.{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("DisabledUser123!"),
        role=UserRole.farmer,
        status=UserStatus.disabled,
        session_version=1,
        must_change_password=False,
    )
    db.add(user)
    db.commit()

    resp = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "DisabledUser123!"},
    )
    assert resp.status_code == 403


def test_post_with_loopback_origin_allowed(client, farmer, farmer_session):
    resp = client.post(
        "/api/v1/farms",
        json={"name": "Loopback OK", "location": "Semarang"},
        headers={
            **_headers(farmer_session["csrf"]),
            "Origin": "http://127.0.0.1:8080",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Loopback OK"


def test_wrong_csrf_rejected(client, farmer, farmer_session):
    resp = client.post(
        "/api/v1/farms",
        json={"name": "Bad CSRF", "location": "X"},
        headers={
            "X-CSRF-Token": "wrong-token",
            "Origin": "http://localhost:5173",
        },
    )
    assert resp.status_code == 403


def test_logout_requires_csrf(client, farmer, farmer_session):
    resp = client.post("/api/v1/auth/logout")
    assert resp.status_code == 403


def test_password_change_wrong_current(client, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    resp = client.post(
        "/api/v1/auth/password/change",
        json={
            "current_password": "WrongCurrent123!",
            "new_password": "NewPassword123!",
        },
        headers=headers,
    )
    assert resp.status_code == 400


def test_unauthenticated_farms_returns_401(client):
    resp = client.get("/api/v1/farms")
    assert resp.status_code == 401


def test_login_wrong_password(client, farmer):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": farmer.email, "password": "WrongPassword123!"},
    )
    assert resp.status_code == 401


def test_logout_with_csrf_succeeds(client, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    resp = client.post("/api/v1/auth/logout", headers=headers)
    assert resp.status_code == 200
    assert client.get("/api/v1/farms").status_code == 401
