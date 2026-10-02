"""Farm and crop-cycle ownership, validation, and safe deletion rules."""

from sqlalchemy.orm import Session

from app.models import CropCycle, Farm, Prediction, User
from app.schemas import CropCycleCreateRequest, CropCycleOut, FarmCreateRequest, FarmOut


def farm_out(farm: Farm) -> FarmOut:
    return FarmOut(
        id=farm.id,
        name=farm.name,
        location=farm.location,
        farmer_id=farm.farmer_id,
        created_at=farm.created_at,
        updated_at=farm.updated_at,
    )


def cycle_out(cycle: CropCycle) -> CropCycleOut:
    return CropCycleOut(
        id=cycle.id,
        farm_id=cycle.farm_id,
        crop=cycle.crop.value,
        variety=cycle.variety,
        planting_date=cycle.planting_date,
        area=float(cycle.area),
        location=cycle.location,
        lifecycle_status=cycle.lifecycle_status.value,
        actual_harvest_date=cycle.actual_harvest_date,
        actual_yield=float(cycle.actual_yield) if cycle.actual_yield is not None else None,
        yield_unit=cycle.yield_unit,
        created_at=cycle.created_at,
        updated_at=cycle.updated_at,
    )


def get_owned_farm(db: Session, user: User, farm_id: str) -> Farm | None:
    return (
        db.query(Farm)
        .filter(Farm.id == farm_id, Farm.farmer_id == user.id)
        .first()
    )


def get_owned_cycle(db: Session, user: User, cycle_id: str) -> CropCycle | None:
    return (
        db.query(CropCycle)
        .join(Farm, Farm.id == CropCycle.farm_id)
        .filter(CropCycle.id == cycle_id, Farm.farmer_id == user.id)
        .first()
    )


def create_farm_record(db: Session, user: User, payload: FarmCreateRequest) -> Farm:
    farm = Farm(name=payload.name.strip(), location=payload.location.strip(), farmer_id=user.id)
    db.add(farm)
    db.flush()
    return farm


def update_farm_record(db: Session, user: User, farm_id: str, payload: FarmCreateRequest) -> Farm:
    farm = get_owned_farm(db, user, farm_id)
    if not farm:
        raise LookupError("Lahan tidak ditemukan")
    farm.name = payload.name.strip()
    farm.location = payload.location.strip()
    db.flush()
    return farm


def delete_farm_record(db: Session, user: User, farm_id: str) -> None:
    farm = get_owned_farm(db, user, farm_id)
    if not farm:
        raise LookupError("Lahan tidak ditemukan")
    cycle_count = db.query(CropCycle).filter(CropCycle.farm_id == farm.id).count()
    if cycle_count > 0:
        raise DependencyError(
            f"Lahan masih memiliki {cycle_count} siklus tanam. "
            "Hapus semua siklus tanam terlebih dahulu."
        )
    db.delete(farm)


def create_cycle_record(
    db: Session,
    user: User,
    farm_id: str,
    payload: CropCycleCreateRequest,
) -> CropCycle:
    farm = get_owned_farm(db, user, farm_id)
    if not farm:
        raise LookupError("Lahan tidak ditemukan")
    cycle = CropCycle(
        farm_id=farm.id,
        crop=payload.crop,
        variety=payload.variety.strip(),
        planting_date=payload.planting_date,
        area=payload.area,
        location=payload.location.strip(),
        lifecycle_status=payload.lifecycle_status,
        soil_inputs=payload.soil_inputs,
    )
    db.add(cycle)
    db.flush()
    return cycle


def update_cycle_record(
    db: Session,
    user: User,
    cycle_id: str,
    payload: CropCycleCreateRequest,
    *,
    farm_id: str | None = None,
) -> CropCycle:
    cycle = get_owned_cycle(db, user, cycle_id)
    if not cycle:
        raise LookupError("Siklus tanaman tidak ditemukan")
    target_farm_id = farm_id or cycle.farm_id
    farm = get_owned_farm(db, user, target_farm_id)
    if not farm:
        raise LookupError("Lahan tidak ditemukan")
    cycle.farm_id = farm.id
    cycle.crop = payload.crop
    cycle.variety = payload.variety.strip()
    cycle.planting_date = payload.planting_date
    cycle.area = payload.area
    cycle.location = payload.location.strip()
    cycle.lifecycle_status = payload.lifecycle_status
    cycle.soil_inputs = payload.soil_inputs
    db.flush()
    return cycle


def delete_cycle_record(db: Session, user: User, cycle_id: str) -> None:
    cycle = get_owned_cycle(db, user, cycle_id)
    if not cycle:
        raise LookupError("Siklus tanaman tidak ditemukan")
    prediction_count = (
        db.query(Prediction).filter(Prediction.crop_cycle_id == cycle.id).count()
    )
    if prediction_count > 0:
        raise DependencyError(
            f"Siklus masih memiliki {prediction_count} riwayat prediksi. "
            "Riwayat prediksi tidak dapat dihapus otomatis; hubungi administrator jika diperlukan."
        )
    db.delete(cycle)


class DependencyError(Exception):
    """Raised when delete is blocked by dependent records."""
