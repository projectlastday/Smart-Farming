"""Farm and crop-cycle CRUD API tests."""

import uuid
from datetime import date

from app.auth.security import hash_password
from app.models import CropCycle, CropType, CycleStatus, Farm, User, UserRole, UserStatus
from app.services.features import save_prediction
from tests.conftest import _headers


def test_update_farm_happy_path(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Old Name", location="Old Loc", farmer_id=farmer.id)
    db.add(farm)
    db.commit()

    resp = client.patch(
        f"/api/v1/farms/{farm.id}",
        json={"name": "New Name", "location": "Semarang Baru"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "New Name"
    assert body["location"] == "Semarang Baru"
    assert body["created_at"] is not None
    assert body["updated_at"] is not None


def test_update_farm_validation_empty_name(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Valid Name", location="Valid", farmer_id=farmer.id)
    db.add(farm)
    db.commit()
    resp = client.patch(
        f"/api/v1/farms/{farm.id}",
        json={"name": "   ", "location": "Valid"},
        headers=headers,
    )
    assert resp.status_code == 422


def test_update_farm_not_found(client, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    resp = client.patch(
        f"/api/v1/farms/{uuid.uuid4()}",
        json={"name": "X", "location": "Y"},
        headers=headers,
    )
    assert resp.status_code == 404


def test_update_farm_other_owner_404(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    other = User(
        name="Other",
        email=f"other.{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("OtherFarmer123!"),
        role=UserRole.farmer,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add(other)
    db.flush()
    farm = Farm(name="Private", location="X", farmer_id=other.id)
    db.add(farm)
    db.commit()

    resp = client.patch(
        f"/api/v1/farms/{farm.id}",
        json={"name": "Hack", "location": "Hack"},
        headers=headers,
    )
    assert resp.status_code == 404


def test_delete_empty_farm(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Empty", location="Delete Me", farmer_id=farmer.id)
    db.add(farm)
    db.commit()
    farm_id = farm.id

    resp = client.delete(f"/api/v1/farms/{farm_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Lahan berhasil dihapus"
    listed = client.get("/api/v1/farms", headers=headers)
    assert listed.status_code == 200
    assert farm_id not in {item["id"] for item in listed.json()}


def test_delete_farm_blocked_by_cycles(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="With Cycle", location="X", farmer_id=farmer.id)
    db.add(farm)
    db.flush()
    db.add(
        CropCycle(
            farm_id=farm.id,
            crop=CropType.rice,
            variety="Ciherang",
            planting_date=date.today(),
            area=1.0,
            location="X",
            lifecycle_status=CycleStatus.growing,
        )
    )
    db.commit()

    resp = client.delete(f"/api/v1/farms/{farm.id}", headers=headers)
    assert resp.status_code == 409
    assert "siklus tanam" in resp.json()["detail"].lower()


def test_delete_farm_not_found(client, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    resp = client.delete(f"/api/v1/farms/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


def test_update_cycle_happy_path(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Sawah", location="Semarang", farmer_id=farmer.id)
    db.add(farm)
    db.flush()
    cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.rice,
        variety="Ciherang",
        planting_date=date(2026, 1, 1),
        area=1.0,
        location="Blok A",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.commit()

    resp = client.patch(
        f"/api/v1/crop-cycles/{cycle.id}",
        json={
            "crop": "rice",
            "variety": "ir64",
            "planting_date": "2026-02-01",
            "area": 2.5,
            "location": "Blok B",
            "lifecycle_status": "growing",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["variety"] == "ir64"
    assert body["area"] == 2.5
    assert body["location"] == "Blok B"


def test_update_cycle_move_farm(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm_a = Farm(name="A", location="Loc A", farmer_id=farmer.id)
    farm_b = Farm(name="B", location="Loc B", farmer_id=farmer.id)
    db.add_all([farm_a, farm_b])
    db.flush()
    cycle = CropCycle(
        farm_id=farm_a.id,
        crop=CropType.guava,
        variety="Kristal",
        planting_date=date(2010, 1, 1),
        area=1.0,
        location="Kebun",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.commit()

    resp = client.patch(
        f"/api/v1/crop-cycles/{cycle.id}",
        json={
            "farm_id": farm_b.id,
            "crop": "guava",
            "variety": "Kristal",
            "planting_date": "2010-01-01",
            "area": 1.0,
            "location": "Kebun",
            "lifecycle_status": "growing",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["farm_id"] == farm_b.id


def test_update_cycle_invalid_area(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Sawah", location="Semarang", farmer_id=farmer.id)
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

    resp = client.patch(
        f"/api/v1/crop-cycles/{cycle.id}",
        json={
            "crop": "rice",
            "variety": "Ciherang",
            "planting_date": date.today().isoformat(),
            "area": 0,
            "location": "X",
            "lifecycle_status": "growing",
        },
        headers=headers,
    )
    assert resp.status_code == 422


def test_update_cycle_other_owner_404(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    other = User(
        name="Other",
        email=f"other2.{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("OtherFarmer123!"),
        role=UserRole.farmer,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add(other)
    db.flush()
    farm = Farm(name="Private", location="X", farmer_id=other.id)
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

    resp = client.patch(
        f"/api/v1/crop-cycles/{cycle.id}",
        json={
            "crop": "rice",
            "variety": "Ciherang",
            "planting_date": date.today().isoformat(),
            "area": 1.0,
            "location": "X",
            "lifecycle_status": "growing",
        },
        headers=headers,
    )
    assert resp.status_code == 404


def test_delete_cycle_without_predictions(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Sawah", location="Semarang", farmer_id=farmer.id)
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
    cycle_id = cycle.id

    resp = client.delete(f"/api/v1/crop-cycles/{cycle_id}", headers=headers)
    assert resp.status_code == 200
    listed = client.get("/api/v1/crop-cycles", headers=headers)
    assert listed.status_code == 200
    assert cycle_id not in {item["id"] for item in listed.json()}


def test_delete_cycle_blocked_by_predictions(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Sawah", location="Semarang", farmer_id=farmer.id)
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
    db.flush()
    save_prediction(
        db,
        user=farmer,
        cycle=cycle,
        feature_type="harvest",
        model_version="v1",
        inputs_snapshot={},
        output={"ok": True},
        confidence=50.0,
        assumptions=None,
        explanation=None,
        recommendation=None,
        provenance=None,
    )
    db.commit()

    resp = client.delete(f"/api/v1/crop-cycles/{cycle.id}", headers=headers)
    assert resp.status_code == 409
    assert "prediksi" in resp.json()["detail"].lower()


def test_delete_cycle_not_found(client, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    resp = client.delete(f"/api/v1/crop-cycles/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


def test_superadmin_cannot_update_other_farmers_farm(client, db, farmer, farmer_session):
    superadmin = User(
        name="Super",
        email=f"super.{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("SuperAdmin123!"),
        role=UserRole.superadmin,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add(superadmin)
    db.flush()
    farm = Farm(name="Farmer Farm", location="Private", farmer_id=farmer.id)
    db.add(farm)
    db.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={"email": superadmin.email, "password": "SuperAdmin123!"},
    )
    assert login.status_code == 200
    headers = _headers(login.json()["csrf_token"])

    resp = client.patch(
        f"/api/v1/farms/{farm.id}",
        json={"name": "Hacked", "location": "Hacked"},
        headers=headers,
    )
    assert resp.status_code == 404
