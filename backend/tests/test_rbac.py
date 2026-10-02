"""RBAC and ownership isolation tests."""

import uuid
from datetime import date

from app.models import CropCycle, CropType, CycleStatus, Farm, User, UserRole, UserStatus
from app.auth.security import hash_password
from tests.conftest import _headers


def _email(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def test_farmer_cannot_list_admin_audit(client, db):
    admin = User(
        name="Admin",
        email=_email("admin.test"),
        password_hash=hash_password("AdminTest123!"),
        role=UserRole.admin,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add(admin)
    db.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={"email": admin.email, "password": "AdminTest123!"},
    )
    assert login.status_code == 200

    farmer = User(
        name="Other",
        email=_email("other.farmer"),
        password_hash=hash_password("OtherFarmer123!"),
        role=UserRole.farmer,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add(farmer)
    db.commit()

    farmer_login = client.post(
        "/api/v1/auth/login",
        json={"email": farmer.email, "password": "OtherFarmer123!"},
    )
    csrf = farmer_login.json()["csrf_token"]
    resp = client.get("/api/v1/admin/audit", headers=_headers(csrf))
    assert resp.status_code == 403


def test_farmer_cannot_access_other_farm_predictions(client, db):
    owner = User(
        name="Owner",
        email=_email("owner"),
        password_hash=hash_password("OwnerFarmer123!"),
        role=UserRole.farmer,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    intruder = User(
        name="Intruder",
        email=_email("intruder"),
        password_hash=hash_password("IntruderFarmer123!"),
        role=UserRole.farmer,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add_all([owner, intruder])
    db.flush()
    farm = Farm(name="Private", location="Semarang", farmer_id=owner.id)
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

    login = client.post(
        "/api/v1/auth/login",
        json={"email": intruder.email, "password": "IntruderFarmer123!"},
    )
    csrf = login.json()["csrf_token"]
    resp = client.post(
        "/api/v1/features/harvest",
        json={"crop_cycle_id": cycle.id},
        headers=_headers(csrf),
    )
    assert resp.status_code == 404


def test_admin_can_list_farmers(client, db):
    admin = User(
        name="Admin2",
        email=_email("admin2"),
        password_hash=hash_password("Admin2Test123!"),
        role=UserRole.admin,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add(admin)
    db.commit()
    login = client.post(
        "/api/v1/auth/login",
        json={"email": admin.email, "password": "Admin2Test123!"},
    )
    csrf = login.json()["csrf_token"]
    resp = client.get("/api/v1/admin/farmers", headers=_headers(csrf))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_admin_cannot_access_audit(client, db):
    admin = User(
        name="Admin Audit",
        email=_email("admin.audit"),
        password_hash=hash_password("AdminAudit123!"),
        role=UserRole.admin,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add(admin)
    db.commit()
    login = client.post(
        "/api/v1/auth/login",
        json={"email": admin.email, "password": "AdminAudit123!"},
    )
    csrf = login.json()["csrf_token"]
    resp = client.get("/api/v1/admin/audit", headers=_headers(csrf))
    assert resp.status_code == 403


def test_admin_disable_farmer_blocks_login(client, db):
    admin = User(
        name="Admin Disable",
        email=_email("admin.disable"),
        password_hash=hash_password("AdminDisable123!"),
        role=UserRole.admin,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    target = User(
        name="Target Farmer",
        email=_email("target.farmer"),
        password_hash=hash_password("TargetFarmer123!"),
        role=UserRole.farmer,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add_all([admin, target])
    db.commit()

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": admin.email, "password": "AdminDisable123!"},
    )
    admin_csrf = admin_login.json()["csrf_token"]
    disable = client.post(
        f"/api/v1/admin/farmers/{target.id}/disable",
        headers=_headers(admin_csrf),
    )
    assert disable.status_code == 200

    blocked = client.post(
        "/api/v1/auth/login",
        json={"email": target.email, "password": "TargetFarmer123!"},
    )
    assert blocked.status_code == 403


def test_farms_list_isolated_to_owner(client, db):
    owner = User(
        name="Owner",
        email=_email("owner.list"),
        password_hash=hash_password("OwnerFarmer123!"),
        role=UserRole.farmer,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    other = User(
        name="Neighbor",
        email=_email("neighbor.list"),
        password_hash=hash_password("NeighborFarmer123!"),
        role=UserRole.farmer,
        status=UserStatus.active,
        session_version=1,
        must_change_password=False,
    )
    db.add_all([owner, other])
    db.flush()
    db.add(Farm(name="Owner Farm", location="A", farmer_id=owner.id))
    db.add(Farm(name="Neighbor Farm", location="B", farmer_id=other.id))
    db.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={"email": owner.email, "password": "OwnerFarmer123!"},
    )
    csrf = login.json()["csrf_token"]
    resp = client.get("/api/v1/farms", headers=_headers(csrf))
    assert resp.status_code == 200
    names = {f["name"] for f in resp.json()}
    assert names == {"Owner Farm"}
