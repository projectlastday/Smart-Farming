"""Pytest fixtures. Backend tests use agrifusionnet_test, not the demo database."""

from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _env_file_value(key: str) -> str | None:
    path = ROOT / ".env"
    if not path.exists():
        return None
    prefix = f"{key}="
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(prefix):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def _demo_database_url() -> str:
    return _env_file_value("DATABASE_URL") or (
        "mysql+pymysql://agrifusion:change-me-db@127.0.0.1:3307/agrifusionnet?charset=utf8mb4"
    )


def _test_database_url() -> str:
    explicit = os.environ.get("TEST_DATABASE_URL")
    if explicit:
        return explicit
    return re.sub(
        r"/agrifusionnet(?=[/?]|$)",
        "/agrifusionnet_test",
        _demo_database_url(),
        count=1,
    )


if os.environ.get("PYTEST_KEEP_DEMO_DB") != "1":
    os.environ["DATABASE_URL"] = _test_database_url()
os.environ.setdefault("LOGIN_RATE_LIMIT", "1000")
os.environ.setdefault("REGISTER_RATE_LIMIT", "1000")
os.environ.setdefault("PASSWORD_RATE_LIMIT", "1000")
os.environ.setdefault("UPLOAD_RATE_LIMIT", "1000")
os.environ.setdefault("NASA_POWER_ENABLED", "false")
os.environ.setdefault("SOILGRIDS_LIVE_ENABLED", "false")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.db import SessionLocal, wait_for_database
from app.main import app
from app.models import User, UserRole, UserStatus


@pytest.fixture(scope="session", autouse=True)
def _migrated_test_db():
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(ROOT / "backend" / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "backend" / "alembic"))
    command.upgrade(cfg, "head")
    wait_for_database()


@pytest.fixture
def db() -> Session:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def farmer(db: Session):
    import uuid

    email = f"test.farmer.{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        name="Test Farmer",
        email=email,
        password_hash=hash_password("TestFarmer123!"),
        role=UserRole.farmer,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def farmer_session(client: TestClient, farmer: User):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": farmer.email, "password": "TestFarmer123!"},
    )
    assert response.status_code == 200
    csrf = response.json()["csrf_token"]
    return {"csrf": csrf}


def _headers(csrf: str) -> dict[str, str]:
    return {"X-CSRF-Token": csrf, "Origin": "http://localhost:5173"}
