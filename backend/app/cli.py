"""Seed demo data, reference entries, and canonical credential migration."""

import sys
from datetime import date, timedelta

from app.auth.security import hash_password, revoke_all_sessions
from app.config import ROOT_DIR, settings
from app.db import SessionLocal
from app.models import (
    CropCycle,
    CropType,
    CycleStatus,
    Farm,
    ReferenceEntry,
    User,
    UserRole,
    UserStatus,
)
from app.services.features import FeatureService

LEGACY_SUPERADMIN_EMAIL = "superadmin@agrifusion.local"
LEGACY_DEMO_FARMER_EMAIL = "petani.demo@agrifusion.local"


def _ensure_email_available(db, user_id: str, new_email: str) -> None:
    conflict = (
        db.query(User)
        .filter(User.email == new_email.lower(), User.id != user_id)
        .first()
    )
    if conflict:
        raise RuntimeError(f"Email {new_email} already used by another account")


def apply_credentials() -> None:
    """Migrate bootstrap superadmin and seeded farmer to canonical emails/passwords."""
    db = SessionLocal()
    try:
        password_hash = hash_password(settings.superadmin_password)

        superadmin = (
            db.query(User)
            .filter(User.email == settings.superadmin_email.lower())
            .first()
        )
        if superadmin is None:
            superadmin = (
                db.query(User)
                .filter(
                    User.role == UserRole.superadmin,
                    User.status != UserStatus.anonymized,
                )
                .first()
            )
        if superadmin is None:
            superadmin = (
                db.query(User)
                .filter(User.email == LEGACY_SUPERADMIN_EMAIL.lower())
                .first()
            )
        if superadmin:
            target_email = settings.superadmin_email.lower()
            if superadmin.email.lower() != target_email:
                _ensure_email_available(db, superadmin.id, target_email)
                superadmin.email = target_email
            superadmin.password_hash = password_hash
            superadmin.must_change_password = False
            revoke_all_sessions(db, superadmin)

        farmer_password_hash = hash_password(settings.demo_farmer_password)
        farmer = (
            db.query(User)
            .filter(
                User.email.in_(
                    [
                        settings.demo_farmer_email.lower(),
                        LEGACY_DEMO_FARMER_EMAIL.lower(),
                    ]
                )
            )
            .first()
        )
        if farmer is None:
            farmer = (
                db.query(User)
                .filter(User.name == "Budi Santoso", User.role == UserRole.farmer)
                .first()
            )
        if farmer:
            target_email = settings.demo_farmer_email.lower()
            if farmer.email.lower() != target_email:
                _ensure_email_available(db, farmer.id, target_email)
                farmer.email = target_email
            farmer.password_hash = farmer_password_hash
            farmer.must_change_password = False
            revoke_all_sessions(db, farmer)

        db.commit()
    finally:
        db.close()


def _ensure_reference(db) -> None:
    for key, meta in {
        "ciherang": {"display": "Ciherang", "duration_min": 115, "duration_max": 125},
        "ir64": {"display": "IR64", "duration_min": 110, "duration_max": 115},
        "inpari32": {"display": "Inpari 32", "duration_min": 110, "duration_max": 120},
    }.items():
        existing = db.query(ReferenceEntry).filter(ReferenceEntry.key_code == key).first()
        if existing:
            continue
        db.add(
            ReferenceEntry(
                reference_type="crop_variety",
                crop=CropType.rice,
                key_code=key,
                display_value=meta["display"],
                scientific_metadata=meta,
            )
        )


def _ensure_farm(db, farmer: User, name: str, location: str) -> Farm:
    farm = db.query(Farm).filter(Farm.farmer_id == farmer.id, Farm.name == name).first()
    if farm:
        farm.location = location
        return farm
    farm = Farm(name=name, location=location, farmer_id=farmer.id)
    db.add(farm)
    db.flush()
    return farm


def _ensure_cycle(
    db,
    farm: Farm,
    *,
    crop: CropType,
    variety: str,
    planting_date: date,
    area: float,
    status: CycleStatus,
) -> CropCycle:
    cycle = (
        db.query(CropCycle)
        .filter(CropCycle.farm_id == farm.id, CropCycle.crop == crop)
        .order_by(CropCycle.created_at.asc())
        .first()
    )
    if cycle:
        cycle.variety = variety
        cycle.planting_date = planting_date
        cycle.area = area
        cycle.location = farm.location
        if cycle.lifecycle_status != CycleStatus.harvested:
            cycle.lifecycle_status = status
        return cycle
    cycle = CropCycle(
        farm_id=farm.id,
        crop=crop,
        variety=variety,
        planting_date=planting_date,
        area=area,
        location=farm.location,
        lifecycle_status=status,
    )
    db.add(cycle)
    db.flush()
    return cycle


def _has_feature(db, user_id: str, cycle_id: str, feature: str) -> bool:
    from app.models import Prediction

    return (
        db.query(Prediction)
        .filter(
            Prediction.user_id == user_id,
            Prediction.crop_cycle_id == cycle_id,
            Prediction.feature_type == feature,
        )
        .first()
        is not None
    )


def seed_demo() -> None:
    db = SessionLocal()
    service = FeatureService()
    try:
        _ensure_reference(db)
        farmer = (
            db.query(User)
            .filter(
                User.email.in_(
                    [
                        settings.demo_farmer_email.lower(),
                        LEGACY_DEMO_FARMER_EMAIL.lower(),
                    ]
                )
            )
            .first()
        )
        if farmer is None:
            farmer = User(
                name="Budi Santoso",
                email=settings.demo_farmer_email.lower(),
                password_hash=hash_password(settings.demo_farmer_password),
                phone="081234567890",
                role=UserRole.farmer,
                status=UserStatus.active,
            )
            db.add(farmer)
            db.flush()

        rice_farm = _ensure_farm(db, farmer, "Sawah Ngemplak", "Semarang, Jawa Tengah")
        guava_farm = _ensure_farm(db, farmer, "Kebun Jambu Mulyorejo", "Demak, Jawa Tengah")
        rice_cycle = _ensure_cycle(
            db,
            rice_farm,
            crop=CropType.rice,
            variety="Ciherang",
            planting_date=date.today() - timedelta(days=45),
            area=0.75,
            status=CycleStatus.growing,
        )
        guava_cycle = _ensure_cycle(
            db,
            guava_farm,
            crop=CropType.guava,
            variety="Jambu Kristal",
            planting_date=date(2010, 3, 1),
            area=1.2,
            status=CycleStatus.growing,
        )
        if not _has_feature(db, farmer.id, rice_cycle.id, "harvest"):
            service.run_harvest(db, farmer, rice_cycle.id, "ciherang")
        if not _has_feature(db, farmer.id, rice_cycle.id, "soil"):
            service.run_soil(
                db,
                farmer,
                {
                    "crop_cycle_id": rice_cycle.id,
                    "ph": 5.8,
                    "moisture": 42.0,
                    "nitrogen": 0.14,
                    "phosphorus": 0.06,
                    "potassium": 0.09,
                    "input_provenance": "manual",
                },
            )
        blast = ROOT_DIR / "fixtures" / "disease" / "known_good" / "blast.jpg"
        if not _has_feature(db, farmer.id, rice_cycle.id, "disease") and blast.exists():
            service.run_disease(db, farmer, rice_cycle.id, blast.read_bytes(), None)
        if not _has_feature(db, farmer.id, guava_cycle.id, "rejuvenation"):
            service.run_rejuvenation(
                db,
                farmer,
                {
                    "crop_cycle_id": guava_cycle.id,
                    "orchard_age": 16,
                    "productivity_decline": "moderate",
                    "canopy_condition": "fair",
                },
            )
        if not _has_feature(db, farmer.id, guava_cycle.id, "harvest"):
            service.run_harvest(db, farmer, guava_cycle.id, None)
        if not _has_feature(db, farmer.id, guava_cycle.id, "soil"):
            service.run_soil(
                db,
                farmer,
                {
                    "crop_cycle_id": guava_cycle.id,
                    "ph": 6.1,
                    "moisture": 35.0,
                    "nitrogen": 0.16,
                    "phosphorus": 0.07,
                    "potassium": 0.11,
                    "input_provenance": "manual",
                },
            )

        e2e = db.query(User).filter(User.email == settings.e2e_farmer_email.lower()).first()
        if e2e is None:
            e2e = User(
                name="Petani E2E",
                email=settings.e2e_farmer_email.lower(),
                password_hash=hash_password(settings.e2e_farmer_password),
                role=UserRole.farmer,
                status=UserStatus.active,
            )
            db.add(e2e)
            db.flush()
        e2e_rice = _ensure_farm(db, e2e, "E2E-Sawah", "Semarang, Jawa Tengah")
        e2e_guava = _ensure_farm(db, e2e, "E2E-Kebun Jambu", "Demak, Jawa Tengah")
        _ensure_cycle(
            db,
            e2e_rice,
            crop=CropType.rice,
            variety="Ciherang",
            planting_date=date.today() - timedelta(days=40),
            area=0.5,
            status=CycleStatus.growing,
        )
        _ensure_cycle(
            db,
            e2e_guava,
            crop=CropType.guava,
            variety="Jambu Kristal",
            planting_date=date(2012, 1, 1),
            area=0.8,
            status=CycleStatus.growing,
        )
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "seed-demo"
    if command == "apply-credentials":
        apply_credentials()
    elif command == "seed-demo":
        seed_demo()
    elif command == "retention-cleanup":
        from app.services.retention import run_retention

        db = SessionLocal()
        try:
            result = run_retention(db)
            db.commit()
            print(result)
        finally:
            db.close()
    elif command == "backup-drill":
        from app.services.backup_drill import run_backup_restore_drill

        print(run_backup_restore_drill())
    else:
        raise SystemExit(f"Unknown command: {command}")
