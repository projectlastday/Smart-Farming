import io
import uuid
from datetime import date

from PIL import Image

from app.auth.security import hash_password
from app.models import CropCycle, CropType, CycleStatus, Farm, User, UserRole, UserStatus
from app.services.features import save_prediction
from tests.conftest import _headers


def test_register_login_and_harvest(client):
    email = f"new.farmer.{uuid.uuid4().hex[:8]}@example.com"
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Petani Baru",
            "email": email,
            "password": "NewFarmer123!",
        },
    )
    assert reg.status_code == 200
    csrf = reg.json()["csrf_token"]
    headers = _headers(csrf)

    farm_resp = client.post(
        "/api/v1/farms",
        json={"name": "Sawah Test", "location": "Semarang"},
        headers=headers,
    )
    assert farm_resp.status_code == 200
    farm_id = farm_resp.json()["id"]

    cycle_resp = client.post(
        f"/api/v1/farms/{farm_id}/crop-cycles",
        json={
            "crop": "rice",
            "variety": "Ciherang",
            "planting_date": date.today().isoformat(),
            "area": 1.0,
            "location": "Semarang",
            "lifecycle_status": "growing",
        },
        headers=headers,
    )
    assert cycle_resp.status_code == 200
    cycle_id = cycle_resp.json()["id"]

    harvest = client.post(
        "/api/v1/features/harvest",
        json={"crop_cycle_id": cycle_id, "variety_key": "ciherang"},
        headers=headers,
    )
    assert harvest.status_code == 200
    body = harvest.json()
    assert body["feature_type"] == "harvest"


def test_guava_harvest_not_applicable(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Kebun", location="Demak", farmer_id=farmer.id)
    db.add(farm)
    db.flush()
    cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.guava,
        variety="Kristal",
        planting_date=date(2012, 1, 1),
        area=1.0,
        location="Demak",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.commit()

    resp = client.post(
        "/api/v1/features/harvest",
        json={"crop_cycle_id": cycle.id},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["output"]["status"] == "not_applicable"


def test_sync_idempotent(client, db, farmer, farmer_session):
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
        location="Semarang",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.commit()

    payload = {
        "client_operation_id": "offline-op-1",
        "farm_id": farm.id,
        "crop_cycle_id": cycle.id,
        "feature_type": "disease",
        "model_version": "demo",
        "inputs_snapshot": {},
        "output": {"status": "unknown"},
        "confidence": 30.0,
        "assumptions": "offline",
        "explanation": "test",
        "recommendation": "test",
    }
    first = client.post("/api/v1/predictions/sync", json=payload, headers=headers)
    second = client.post("/api/v1/predictions/sync", json=payload, headers=headers)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]


def test_sync_rejects_mismatched_farm(client, db, farmer, farmer_session):
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
        location="Semarang",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.commit()

    resp = client.post(
        "/api/v1/predictions/sync",
        json={
            "client_operation_id": f"audit-{uuid.uuid4().hex[:8]}",
            "farm_id": str(uuid.uuid4()),
            "crop_cycle_id": cycle.id,
            "feature_type": "disease",
            "model_version": "offline",
            "inputs_snapshot": {},
            "output": {"label": "healthy"},
            "confidence": 50.0,
            "assumptions": "offline",
            "explanation": "audit",
            "recommendation": "audit",
        },
        headers=headers,
    )
    assert resp.status_code == 404


def test_retired_mapping_endpoint_is_not_available(client):
    resp = client.post("/api/v1/features/mapping", json={})
    assert resp.status_code == 404


def test_disease_guava_not_applicable(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Kebun2", location="Demak", farmer_id=farmer.id)
    db.add(farm)
    db.flush()
    cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.guava,
        variety="Kristal",
        planting_date=date(2010, 1, 1),
        area=1.0,
        location="Demak",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.commit()

    img = io.BytesIO()
    Image.new("RGB", (64, 64), color=(0, 128, 0)).save(img, format="PNG")
    resp = client.post(
        "/api/v1/features/disease",
        data={"crop_cycle_id": cycle.id},
        files={"image": ("leaf.png", img.getvalue(), "image/png")},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["output"]["status"] == "not_applicable"


def test_save_prediction_idempotent(db, farmer):
    farm = Farm(name="Idem", location="X", farmer_id=farmer.id)
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

    op_id = f"idem-{uuid.uuid4().hex[:8]}"
    first = save_prediction(
        db,
        user=farmer,
        cycle=cycle,
        feature_type="disease",
        model_version="v1",
        inputs_snapshot={},
        output={"label": "healthy"},
        confidence=50.0,
        assumptions="a",
        explanation="b",
        recommendation="c",
        provenance=None,
        client_operation_id=op_id,
    )
    second = save_prediction(
        db,
        user=farmer,
        cycle=cycle,
        feature_type="disease",
        model_version="v1",
        inputs_snapshot={},
        output={"label": "changed"},
        confidence=99.0,
        assumptions="a",
        explanation="b",
        recommendation="c",
        provenance=None,
        client_operation_id=op_id,
    )
    assert first.id == second.id
    assert second.output["label"] == "healthy"


def test_prediction_detail_requires_ownership(client, db, farmer, farmer_session):
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
    farm = Farm(name="Private", location="Semarang", farmer_id=other.id)
    db.add(farm)
    db.flush()
    cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.rice,
        variety="Ciherang",
        planting_date=date.today(),
        area=1.0,
        location="Semarang",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.flush()
    prediction = save_prediction(
        db,
        user=other,
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

    resp = client.get(f"/api/v1/predictions/{prediction.id}", headers=headers)
    assert resp.status_code == 404


def test_invalid_crop_cycle_payload(client, farmer, farmer_session, db):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="BadCrop", location="Semarang", farmer_id=farmer.id)
    db.add(farm)
    db.commit()

    resp = client.post(
        f"/api/v1/farms/{farm.id}/crop-cycles",
        json={
            "crop": "corn",
            "variety": "X",
            "planting_date": date.today().isoformat(),
            "area": 1.0,
            "location": "Semarang",
            "lifecycle_status": "growing",
        },
        headers=headers,
    )
    assert resp.status_code == 422


def test_soil_validation_missing_fields(client, farmer, farmer_session, db):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Soil", location="Semarang", farmer_id=farmer.id)
    db.add(farm)
    db.flush()
    cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.rice,
        variety="Ciherang",
        planting_date=date.today(),
        area=1.0,
        location="Semarang",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.commit()

    resp = client.post(
        "/api/v1/features/soil",
        json={"crop_cycle_id": cycle.id},
        headers=headers,
    )
    assert resp.status_code == 422


def test_rejuvenation_rice_not_applicable_api(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Padi", location="Semarang", farmer_id=farmer.id)
    db.add(farm)
    db.flush()
    cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.rice,
        variety="Ciherang",
        planting_date=date.today(),
        area=1.0,
        location="Semarang",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.commit()

    resp = client.post(
        "/api/v1/features/rejuvenation",
        json={
            "crop_cycle_id": cycle.id,
            "orchard_age": 12,
            "productivity_decline": "moderate",
            "canopy_condition": "moderate",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["output"]["status"] == "not_applicable"


def test_harvest_unknown_cycle_404(client, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    resp = client.post(
        "/api/v1/features/harvest",
        json={"crop_cycle_id": str(uuid.uuid4())},
        headers=headers,
    )
    assert resp.status_code == 404


def test_invalid_lifecycle_status_rejected(client, farmer, farmer_session, db):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Cycle", location="Semarang", farmer_id=farmer.id)
    db.add(farm)
    db.commit()

    resp = client.post(
        f"/api/v1/farms/{farm.id}/crop-cycles",
        json={
            "crop": "rice",
            "variety": "Ciherang",
            "planting_date": date.today().isoformat(),
            "area": 1.0,
            "location": "Semarang",
            "lifecycle_status": "invalid-status",
        },
        headers=headers,
    )
    assert resp.status_code == 422


def test_soil_analysis_works_for_guava(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Kebun", location="Demak", farmer_id=farmer.id)
    db.add(farm)
    db.flush()
    cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.guava,
        variety="Kristal",
        planting_date=date(2010, 1, 1),
        area=2.0,
        location="Demak",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.commit()

    resp = client.post(
        "/api/v1/features/soil",
        json={
            "crop_cycle_id": cycle.id,
            "ph": 6.0,
            "moisture": 45,
            "nitrogen": 0.18,
            "phosphorus": 0.08,
            "potassium": 0.1,
            "input_provenance": "manual",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["output"]["crop"] == "guava"


def test_sync_missing_required_fields_422(client, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    resp = client.post(
        "/api/v1/predictions/sync",
        json={"client_operation_id": "incomplete"},
        headers=headers,
    )
    assert resp.status_code == 422


def test_superadmin_can_create_admin_with_password(client, db):
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
    db.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={"email": superadmin.email, "password": "SuperAdmin123!"},
    )
    csrf = login.json()["csrf_token"]
    new_email = f"new.admin.{uuid.uuid4().hex[:8]}@example.com"
    create = client.post(
        "/api/v1/auth/admin/create",
        json={"name": "New Admin", "email": new_email, "role": "admin", "password": "NewAdmin123!"},
        headers=_headers(csrf),
    )
    assert create.status_code == 200
    assert create.json()["email"] == new_email

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": new_email, "password": "NewAdmin123!"},
    )
    assert admin_login.status_code == 200


def test_setup_password_endpoint_is_removed(client):
    response = client.post(
        "/api/v1/auth/password/setup",
        json={"token": "not-used", "password": "NeverUsed123!"},
    )
    assert response.status_code in {404, 405}


def test_must_change_password_blocks_login(client, db):
    user = User(
        name="Need Setup",
        email=f"need.setup.{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("NeedSetup123!"),
        role=UserRole.farmer,
        status=UserStatus.active,
        session_version=1,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "NeedSetup123!"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "PASSWORD_SETUP_REQUIRED"
