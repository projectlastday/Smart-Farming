"""Server-side prediction pagination, filters, and ownership."""

import uuid
from datetime import UTC, date, datetime, timedelta

from app.models import CropCycle, CropType, CycleStatus, Farm, Prediction, SyncState
from tests.conftest import _headers


def test_predictions_paginated_and_old_cycle_visible(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Paginate Farm", location="Semarang", farmer_id=farmer.id)
    db.add(farm)
    db.flush()
    old_cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.rice,
        variety="Ciherang",
        planting_date=date.today() - timedelta(days=80),
        area=1.0,
        location="Semarang",
        lifecycle_status=CycleStatus.growing,
    )
    new_cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.rice,
        variety="IR64",
        planting_date=date.today() - timedelta(days=10),
        area=1.0,
        location="Semarang",
        lifecycle_status=CycleStatus.growing,
    )
    db.add_all([old_cycle, new_cycle])
    db.flush()
    old_pred = Prediction(
        user_id=farmer.id,
        farm_id=farm.id,
        crop_cycle_id=old_cycle.id,
        feature_type="soil",
        model_version="soil-advisory-v1",
        inputs_snapshot={},
        output={"marker": "old-cycle-keep"},
        client_operation_id=str(uuid.uuid4()),
        sync_state=SyncState.synced,
        created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=40),
    )
    db.add(old_pred)
    for i in range(160):
        db.add(
            Prediction(
                user_id=farmer.id,
                farm_id=farm.id,
                crop_cycle_id=new_cycle.id,
                feature_type="harvest",
                model_version="harvest-duration-v1",
                inputs_snapshot={"i": i},
                output={"i": i},
                client_operation_id=str(uuid.uuid4()),
                sync_state=SyncState.synced,
                created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=i),
            )
        )
    db.commit()

    listed = client.get("/api/v1/predictions?page=1&page_size=20")
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] >= 161
    assert len(body["items"]) == 20
    assert body["page"] == 1

    filtered = client.get(f"/api/v1/predictions?crop_cycle_id={old_cycle.id}&page_size=20")
    assert filtered.status_code == 200
    items = filtered.json()["items"]
    assert any(item["output"].get("marker") == "old-cycle-keep" for item in items)
    assert all(item["crop_cycle_id"] == old_cycle.id for item in items)


def test_predictions_latest_per_feature(client, db, farmer, farmer_session):
    farm = Farm(name="Latest Farm", location="Semarang", farmer_id=farmer.id)
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
    for i, feat in enumerate(["harvest", "harvest", "soil"]):
        db.add(
            Prediction(
                user_id=farmer.id,
                farm_id=farm.id,
                crop_cycle_id=cycle.id,
                feature_type=feat,
                model_version="v",
                inputs_snapshot={},
                output={"n": i},
                client_operation_id=str(uuid.uuid4()),
                sync_state=SyncState.synced,
                created_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(seconds=i),
            )
        )
    db.commit()
    resp = client.get(f"/api/v1/predictions?crop_cycle_id={cycle.id}&latest_per_feature=true")
    assert resp.status_code == 200
    items = resp.json()["items"]
    types = [item["feature_type"] for item in items]
    assert types.count("harvest") == 1
    harvest = next(item for item in items if item["feature_type"] == "harvest")
    assert harvest["output"]["n"] == 1
