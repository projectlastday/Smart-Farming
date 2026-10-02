import uuid
from datetime import date

from sqlalchemy import inspect, text

from app.auth.security import hash_password
from app.db import engine
from app.models import CropCycle, CropType, CycleStatus, Farm, User, UserRole, UserStatus
from tests.conftest import _headers


def _email(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def test_alembic_head_has_harvest_and_session_columns():
    inspector = inspect(engine)
    cycle_cols = {col["name"] for col in inspector.get_columns("crop_cycles")}
    session_cols = {col["name"] for col in inspector.get_columns("sessions")}
    assert "actual_harvest_date" in cycle_cols
    assert "actual_yield" in cycle_cols
    assert "yield_unit" in cycle_cols
    assert "user_session_version" in session_cols
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    assert version == "0004_remove_setup_tokens"
    index_names = {idx["name"] for idx in inspector.get_indexes("audit_logs")}
    assert "ix_audit_logs_timestamp" in index_names


def test_admin_cannot_create_admin_role(client, db):
    admin = User(
        name="Admin Create",
        email=_email("admin.create.role"),
        password_hash=hash_password("AdminCreate123!"),
        role=UserRole.admin,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add(admin)
    db.commit()
    login = client.post(
        "/api/v1/auth/login",
        json={"email": admin.email, "password": "AdminCreate123!"},
    )
    csrf = login.json()["csrf_token"]
    resp = client.post(
        "/api/v1/auth/admin/create",
        json={"name": "Should Fail", "email": _email("new.admin"), "role": "admin", "password": "ShouldFail123!"},
        headers=_headers(csrf),
    )
    assert resp.status_code == 403


def test_admin_can_create_farmer(client, db):
    admin = User(
        name="Admin Farmer Create",
        email=_email("admin.farmer.create"),
        password_hash=hash_password("AdminFarmer123!"),
        role=UserRole.admin,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add(admin)
    db.commit()
    login = client.post(
        "/api/v1/auth/login",
        json={"email": admin.email, "password": "AdminFarmer123!"},
    )
    csrf = login.json()["csrf_token"]
    resp = client.post(
        "/api/v1/admin/farmers",
        json={"name": "Petani Baru", "email": _email("petani.baru.role"), "password": "PetaniBaru123!"},
        headers=_headers(csrf),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"]
    assert body["must_change_password"] is False
    login = client.post(
        "/api/v1/auth/login",
        json={"email": body["email"], "password": "PetaniBaru123!"},
    )
    assert login.status_code == 200


def test_farmer_cannot_list_admin_farmers(client, farmer, farmer_session):
    resp = client.get("/api/v1/admin/farmers", headers=_headers(farmer_session["csrf"]))
    assert resp.status_code == 403


def test_farmer_cannot_mark_other_cycle_harvest(client, db, farmer, farmer_session):
    other = User(
        name="Other Harvest",
        email=_email("other.harvest"),
        password_hash=hash_password("OtherHarvest123!"),
        role=UserRole.farmer,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add(other)
    db.flush()
    farm = Farm(name="Other Farm", location="X", farmer_id=other.id)
    db.add(farm)
    db.flush()
    cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.rice,
        variety="Ciherang",
        planting_date=date.today(),
        area=1.0,
        location="X",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.commit()
    resp = client.post(
        f"/api/v1/crop-cycles/{cycle.id}/harvest",
        json={"crop_cycle_id": cycle.id, "actual_harvest_date": str(date.today())},
        headers=_headers(farmer_session["csrf"]),
    )
    assert resp.status_code == 404
