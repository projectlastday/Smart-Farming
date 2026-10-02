"""Demo seed is idempotent and isolated from extra E2E farms."""

from app.cli import seed_demo
from app.config import settings
from app.models import CropCycle, Farm, User


def test_seed_demo_idempotent(db):
    seed_demo()
    seed_demo()
    db.expire_all()

    farmer = db.query(User).filter(User.email == settings.demo_farmer_email.lower()).one()
    farms = db.query(Farm).filter(Farm.farmer_id == farmer.id).all()
    names = [farm.name for farm in farms]
    assert names.count("Sawah Ngemplak") == 1
    assert names.count("Kebun Jambu Mulyorejo") == 1

    rice = next(farm for farm in farms if farm.name == "Sawah Ngemplak")
    rice_cycles = db.query(CropCycle).filter(CropCycle.farm_id == rice.id).all()
    assert len(rice_cycles) == 1

    e2e = db.query(User).filter(User.email == settings.e2e_farmer_email.lower()).one()
    e2e_names = {farm.name for farm in db.query(Farm).filter(Farm.farmer_id == e2e.id).all()}
    assert e2e_names == {"E2E-Sawah", "E2E-Kebun Jambu"}
    assert farmer.id != e2e.id
