"""Image upload validation for disease diagnosis."""

import io
from datetime import date

from PIL import Image

from app.config import ROOT_DIR, settings
from app.models import CropCycle, CropType, CycleStatus, Farm
from tests.conftest import _headers


def test_disease_rejects_invalid_upload(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Upload", location="Semarang", farmer_id=farmer.id)
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
        "/api/v1/features/disease",
        data={"crop_cycle_id": cycle.id},
        files={"image": ("bad.txt", b"not-an-image", "text/plain")},
        headers=headers,
    )
    assert resp.status_code == 400


def test_disease_accepts_valid_png(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Upload2", location="Semarang", farmer_id=farmer.id)
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

    img = io.BytesIO()
    Image.new("RGB", (128, 128), color=(34, 120, 45)).save(img, format="PNG")
    resp = client.post(
        "/api/v1/features/disease",
        data={"crop_cycle_id": cycle.id},
        files={"image": ("leaf.png", img.getvalue(), "image/png")},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["feature_type"] == "disease"
    assert body["output"]["status"] in {"classified", "unknown"}
    assert body["model_version"] == settings.disease_model_version


def test_disease_rejects_invalid_context_json(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="Ctx", location="Semarang", farmer_id=farmer.id)
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

    img = io.BytesIO()
    Image.new("RGB", (64, 64), color=(0, 128, 0)).save(img, format="PNG")
    resp = client.post(
        "/api/v1/features/disease",
        data={"crop_cycle_id": cycle.id, "context_json": "{not-json"},
        files={"image": ("leaf.png", img.getvalue(), "image/png")},
        headers=headers,
    )
    assert resp.status_code == 400


def test_disease_known_good_blast_classified(client, db, farmer, farmer_session):
    headers = _headers(farmer_session["csrf"])
    farm = Farm(name="KnownGood", location="Semarang", farmer_id=farmer.id)
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
    blast = ROOT_DIR / "fixtures" / "disease" / "known_good" / "blast.jpg"
    assert blast.exists(), "Known-good blast fixture required"
    resp = client.post(
        "/api/v1/features/disease",
        data={"crop_cycle_id": cycle.id},
        files={"image": ("blast.jpg", blast.read_bytes(), "image/jpeg")},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["feature_type"] == "disease"
    assert body["output"]["status"] == "classified"
    assert body["output"]["label"] == "blast"


def test_upload_strips_exif_and_temp_cleanup(tmp_path):
    import asyncio

    from app.services.uploads import cleanup_path, read_and_validate_image, write_temp_upload

    buf = io.BytesIO()
    Image.new("RGB", (48, 48), color=(12, 24, 36)).save(buf, format="JPEG")
    jpeg = buf.getvalue()
    raw = jpeg[:2] + b"\xff\xe1\x00\x16Exif\x00\x00GPSDUMMYEXIF" + jpeg[2:]

    class _Upload:
        async def read(self) -> bytes:
            return raw

    cleaned = asyncio.run(read_and_validate_image(_Upload()))  # type: ignore[arg-type]
    image = Image.open(io.BytesIO(cleaned))
    assert image.format == "JPEG"
    assert len(image.getexif()) == 0
    assert b"Exif" not in cleaned[:64]

    path = write_temp_upload(cleaned, tmp_path)
    assert path.exists()
    cleanup_path(path)
    assert not path.exists()
