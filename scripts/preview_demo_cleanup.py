"""Preview and optional cleanup of provably generated E2E/test records."""

from __future__ import annotations

import argparse
from datetime import date

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import CropCycle, Farm, Prediction, User


def preview(db: Session) -> dict[str, int]:
    test_users = (
        db.query(User)
        .filter(
            or_(
                User.email.like("%@example.com"),
                User.email.like("e2e.farmer@%"),
                User.email.like("test.%"),
            )
        )
        .count()
    )
    e2e_farms = db.query(Farm).filter(
        Farm.name.op("REGEXP")(r"E2E|Blocked|Curl|CRUD Sawah|Audit Lahan|lahan test|^Farm [0-9]")
    ).count()
    future_cycles = db.query(CropCycle).filter(CropCycle.planting_date > date(2027, 1, 1)).count()
    demo_preserved = db.query(User).filter(User.email.in_(["petani@gmail.com", "superadmin@gmail.com"])).count()
    return {
        "example_or_e2e_users": test_users,
        "e2e_named_farms": e2e_farms,
        "future_2027_plus_cycles": future_cycles,
        "canonical_demo_users_preserved": demo_preserved,
    }


def cleanup(db: Session) -> dict[str, int]:
    counts = {"users": 0, "farms": 0, "cycles": 0, "predictions": 0}
    users = db.query(User).filter(User.email.like("%@example.com")).all()
    user_ids = [u.id for u in users]
    if user_ids:
        counts["predictions"] += (
            db.query(Prediction).filter(Prediction.user_id.in_(user_ids)).delete(synchronize_session=False)
        )
        farm_ids = [f.id for f in db.query(Farm).filter(Farm.farmer_id.in_(user_ids)).all()]
        if farm_ids:
            counts["cycles"] += (
                db.query(CropCycle).filter(CropCycle.farm_id.in_(farm_ids)).delete(synchronize_session=False)
            )
        counts["farms"] += db.query(Farm).filter(Farm.farmer_id.in_(user_ids)).delete(synchronize_session=False)
        counts["users"] += db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)

    e2e_farms = db.query(Farm).filter(
        Farm.name.op("REGEXP")(r"E2E|Blocked|Curl|CRUD Sawah|Audit Lahan|lahan test|^Farm [0-9]")
    ).all()
    farm_ids = [f.id for f in e2e_farms]
    if farm_ids:
        cycle_ids = [c.id for c in db.query(CropCycle).filter(CropCycle.farm_id.in_(farm_ids)).all()]
        if cycle_ids:
            counts["predictions"] += (
                db.query(Prediction).filter(Prediction.crop_cycle_id.in_(cycle_ids)).delete(synchronize_session=False)
            )
        counts["cycles"] += db.query(CropCycle).filter(CropCycle.farm_id.in_(farm_ids)).delete(synchronize_session=False)
        counts["farms"] += db.query(Farm).filter(Farm.id.in_(farm_ids)).delete(synchronize_session=False)

    future_cycles = db.query(CropCycle).filter(CropCycle.planting_date > date(2027, 1, 1)).all()
    future_ids = [c.id for c in future_cycles]
    if future_ids:
        counts["predictions"] += (
            db.query(Prediction).filter(Prediction.crop_cycle_id.in_(future_ids)).delete(synchronize_session=False)
        )
        counts["cycles"] += (
            db.query(CropCycle).filter(CropCycle.id.in_(future_ids)).delete(synchronize_session=False)
        )
    db.commit()
    return counts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    db = SessionLocal()
    try:
        print("DRY-RUN", preview(db))
        if args.apply:
            print("APPLY", cleanup(db))
    finally:
        db.close()


if __name__ == "__main__":
    main()
