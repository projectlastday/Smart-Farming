"""NASA POWER / SoilGrids adapters, HSTS, retention, backup drill, observability."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import text

from app.adapters.external import NasaPowerAdapter, SoilGridsAdapter
from app.adapters.httputil import ExternalFetchError, get_json
from app.config import settings
from app.models import AuditLog, Prediction, SavedImage, SyncState, User, UserRole, UserStatus
from app.services.backup_drill import run_backup_restore_drill
from app.services.retention import run_retention


def test_hsts_absent_on_localhost_health(client):
    resp = client.get("/api/v1/health/live")
    assert resp.status_code == 200
    assert "Strict-Transport-Security" not in resp.headers
    assert resp.headers.get("x-request-id")


def test_hsts_on_public_https_host(client, monkeypatch):
    monkeypatch.setattr(settings, "public_origin", "https://sf.projectdunia.my.id")
    resp = client.get(
        "/api/v1/health/live",
        headers={
            "Host": "sf.projectdunia.my.id",
            "X-Forwarded-Proto": "https",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("strict-transport-security") == "max-age=31536000; includeSubDomains"


def test_hsts_not_sent_for_public_host_over_http(client, monkeypatch):
    monkeypatch.setattr(settings, "public_origin", "https://sf.projectdunia.my.id")
    resp = client.get("/api/v1/health/live", headers={"Host": "sf.projectdunia.my.id"})
    assert "Strict-Transport-Security" not in resp.headers


def test_metrics_and_ready_shape(client):
    live = client.get("/api/v1/health/live")
    assert live.json()["status"] == "ok"
    ready = client.get("/api/v1/health/ready")
    assert ready.status_code == 200
    body = ready.json()
    assert body["status"] == "ready"
    assert body["database"] == "ok"
    assert "nasa_power_enabled" in body
    metrics = client.get("/api/v1/metrics")
    assert metrics.status_code == 200
    assert metrics.json()["http_requests_total"] >= 1


def test_soilgrids_missing_cache_returns_unavailable(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "soilgrids_live_enabled", False)
    adapter = SoilGridsAdapter(
        cache_dir=str(tmp_path / "empty"),
        live_cache_dir=str(tmp_path / "live"),
    )
    ctx = adapter.get_regional_context("Semarang")
    assert ctx["available"] is False
    assert ctx["mode"] == "unavailable"


def test_soilgrids_local_cache_provenance(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "soilgrids_live_enabled", False)
    fixture = tmp_path / "central-java.json"
    fixture.write_text(
        json.dumps({"region": "central-java", "ph_hydroxide": 5.6, "retrieved_at": "2026-01-01T00:00:00Z"}),
        encoding="utf-8",
    )
    adapter = SoilGridsAdapter(cache_dir=str(tmp_path), live_cache_dir=str(tmp_path / "live"))
    ctx = adapter.get_regional_context("Semarang, Jawa Tengah")
    assert ctx["available"] is True
    assert ctx["mode"] == "local_cache"
    assert ctx["source"] == "local_cache"
    assert ctx["latitude"] == pytest.approx(-6.9667)
    assert "bukan pengukuran laboratorium" in ctx["uncertainty"]


def test_soilgrids_live_success_cache_and_provenance(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "soilgrids_live_enabled", True)
    payload = {
        "properties": {
            "layers": [
                {"name": "phh2o", "depths": [{"values": {"mean": 56}}]},
                {"name": "nitrogen", "depths": [{"values": {"mean": 1.4}}]},
            ]
        }
    }
    monkeypatch.setattr("app.adapters.external.get_json", lambda *_args, **_kwargs: payload)
    adapter = SoilGridsAdapter(cache_dir=str(tmp_path / "fx"), live_cache_dir=str(tmp_path / "live"))
    ctx = adapter.get_regional_context("Semarang")
    assert ctx["available"] is True
    assert ctx["mode"] == "live"
    assert ctx["source"] == "soilgrids_rest_v2"
    assert ctx["baseline"]["ph_hydroxide"] == pytest.approx(5.6)
    assert ctx["baseline"]["nitrogen_gkg"] == pytest.approx(1.4)
    assert ctx["retrieved_at"]
    cached = adapter.get_regional_context("Semarang")
    assert cached["mode"] == "cache"
    assert cached["source"] == "soilgrids_rest_v2_cache"


def test_soilgrids_live_timeout_falls_back(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "soilgrids_live_enabled", True)
    monkeypatch.setattr(settings, "soilgrids_retries", 0)
    monkeypatch.setattr(settings, "soilgrids_timeout_seconds", 0.01)

    def boom(*_args, **_kwargs):
        raise ExternalFetchError("timeout")

    monkeypatch.setattr("app.adapters.external.get_json", boom)
    fixture_dir = tmp_path / "fx"
    fixture_dir.mkdir()
    (fixture_dir / "central-java.json").write_text(
        json.dumps({"region": "central-java", "ph_hydroxide": 5.6}),
        encoding="utf-8",
    )
    adapter = SoilGridsAdapter(cache_dir=str(fixture_dir), live_cache_dir=str(tmp_path / "live"))
    ctx = adapter.get_regional_context("Demak")
    assert ctx["available"] is True
    assert ctx["mode"] == "local_cache"
    assert ctx["source"] == "local_cache"


def test_nasa_live_success_cache_and_adjustment(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "nasa_power_enabled", True)
    payload = {
        "properties": {
            "parameter": {
                "T2M": {"20260801": 22.0, "20260802": 21.5},
                "PRECTOTCORR": {"20260801": 1.2, "20260802": 0.4},
            }
        }
    }
    monkeypatch.setattr("app.adapters.external.get_json", lambda *a, **k: payload)
    adapter = NasaPowerAdapter(cache_dir=str(tmp_path))
    ctx = adapter.get_weather_context("Semarang")
    assert ctx["available"] is True
    assert ctx["mode"] == "live"
    assert ctx["source"] == "nasa_power"
    assert ctx["duration_adjustment_days"] == 3
    assert ctx["retrieved_at"]
    cached = adapter.get_weather_context("Semarang")
    assert cached["mode"] == "cache"
    assert cached["source"] == "nasa_power_cache"


def test_nasa_live_failure_uses_demo_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "nasa_power_enabled", True)
    monkeypatch.setattr("app.adapters.external.get_json", lambda *a, **k: (_ for _ in ()).throw(ExternalFetchError("down")))
    adapter = NasaPowerAdapter(cache_dir=str(tmp_path))
    ctx = adapter.get_weather_context("Semarang")
    assert ctx["available"] is True
    assert ctx["mode"] == "demo_fallback"
    assert ctx["duration_adjustment_days"] == 0
    assert "bukan observasi NASA POWER langsung" in ctx["message"]


def test_get_json_retries_then_raises(monkeypatch):
    calls = {"n": 0}

    class BoomClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url, headers=None):
            calls["n"] += 1
            raise httpx.ConnectError("nope")

    monkeypatch.setattr("app.adapters.httputil.httpx.Client", BoomClient)
    monkeypatch.setattr("app.adapters.httputil.time.sleep", lambda *_: None)
    with pytest.raises(ExternalFetchError):
        get_json("https://example.invalid", timeout=0.01, retries=2)
    assert calls["n"] == 3


def test_backup_restore_drill_isolated(db):
    result = run_backup_restore_drill()
    assert result["ok"] is True
    assert result["marker_verified"] is True
    assert result["demo_database_modified"] is False
    assert result["mode"] in {"temporary_schema", "temporary_table"}
    leftover = db.execute(text("SHOW TABLES LIKE 'drill_restore_%'")).first()
    assert leftover is None


def test_retention_deletes_expired_records(db, farmer, tmp_path):
    old = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=800)
    pred = Prediction(
        user_id=farmer.id,
        farm_id=farmer.farms[0].id if farmer.farms else farmer.id,
        crop_cycle_id=farmer.id,
        feature_type="soil",
        model_version="soil-advisory-v1",
        inputs_snapshot={},
        output={"status": "ok"},
        client_operation_id="ret-1",
        sync_state=SyncState.synced,
        created_at=old,
    )
    # Use a real owned farm/cycle from fixtures if present; otherwise skip farm FK by creating one.
    from app.models import CropCycle, CropType, CycleStatus, Farm

    farm = Farm(name="Retention Farm", location="Semarang", farmer_id=farmer.id)
    db.add(farm)
    db.flush()
    cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.rice,
        variety="Ciherang",
        planting_date=datetime.now(UTC).date(),
        area=1,
        location="Semarang",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.flush()
    pred.farm_id = farm.id
    pred.crop_cycle_id = cycle.id
    image_path = tmp_path / "old.jpg"
    image_path.write_bytes(b"x")
    db.add(pred)
    db.flush()
    db.add(SavedImage(prediction_id=pred.id, path=str(image_path), created_at=old))
    db.add(
        AuditLog(
            actor_id=farmer.id,
            action="test.old",
            target_type="x",
            target_id=farmer.id,
            timestamp=old,
        )
    )
    ghost = User(
        name="Pengguna Dihapus",
        email="deleted-old@anon.local",
        password_hash="x",
        role=UserRole.farmer,
        status=UserStatus.anonymized,
        anonymized_at=old,
    )
    db.add(ghost)
    db.commit()

    stats = run_retention(db, now=datetime.now(UTC).replace(tzinfo=None))
    db.commit()
    assert stats["predictions_deleted"] >= 1
    assert stats["saved_images_deleted"] >= 1
    assert stats["audit_logs_deleted"] >= 1
    assert stats["anonymized_users_deleted"] >= 1
    assert not image_path.exists()
    assert db.query(User).filter(User.email == "deleted-old@anon.local").first() is None


def test_predictions_status_filter_sql(client, db, farmer, farmer_session):
    from app.models import CropCycle, CropType, CycleStatus, Farm

    farm = Farm(name="Status Farm", location="Semarang", farmer_id=farmer.id)
    db.add(farm)
    db.flush()
    cycle = CropCycle(
        farm_id=farm.id,
        crop=CropType.rice,
        variety="Ciherang",
        planting_date=datetime.now(UTC).date(),
        area=1,
        location="Semarang",
        lifecycle_status=CycleStatus.growing,
    )
    db.add(cycle)
    db.flush()
    db.add(
        Prediction(
            user_id=farmer.id,
            farm_id=farm.id,
            crop_cycle_id=cycle.id,
            feature_type="disease",
            model_version="v",
            inputs_snapshot={},
            output={"status": "classified"},
            client_operation_id="st-1",
            sync_state=SyncState.synced,
        )
    )
    db.add(
        Prediction(
            user_id=farmer.id,
            farm_id=farm.id,
            crop_cycle_id=cycle.id,
            feature_type="disease",
            model_version="v",
            inputs_snapshot={},
            output={"status": "unknown"},
            client_operation_id="st-2",
            sync_state=SyncState.synced,
        )
    )
    db.add(
        Prediction(
            user_id=farmer.id,
            farm_id=farm.id,
            crop_cycle_id=cycle.id,
            feature_type="rejuvenation",
            model_version="v",
            inputs_snapshot={},
            output={"status": "not_applicable"},
            client_operation_id="st-3",
            sync_state=SyncState.synced,
        )
    )
    db.add(
        Prediction(
            user_id=farmer.id,
            farm_id=farm.id,
            crop_cycle_id=cycle.id,
            feature_type="harvest",
            model_version="v",
            inputs_snapshot={},
            output={"growth_stage": "vegetative"},
            client_operation_id="st-4",
            sync_state=SyncState.synced,
        )
    )
    db.commit()
    resp = client.get("/api/v1/predictions?status=classified&page_size=20")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert items
    assert all(item["output"].get("status") == "classified" for item in items)

    applicable = client.get("/api/v1/predictions?status=applicable&page_size=20")
    assert applicable.status_code == 200
    applicable_items = applicable.json()["items"]
    assert applicable_items
    assert all(item["output"].get("status") != "not_applicable" for item in applicable_items)
    assert any(item["output"].get("status") == "classified" for item in applicable_items)
    assert any(item["feature_type"] == "harvest" for item in applicable_items)

    na = client.get("/api/v1/predictions?status=not_applicable&page_size=20")
    assert na.status_code == 200
    na_items = na.json()["items"]
    assert na_items
    assert all(item["output"].get("status") == "not_applicable" for item in na_items)


def test_predictions_explain_uses_user_created_index(db, farmer):
    plan = db.execute(
        text(
            "EXPLAIN SELECT id FROM predictions "
            "WHERE user_id = :uid ORDER BY created_at DESC, id DESC LIMIT 20"
        ),
        {"uid": farmer.id},
    ).mappings().first()
    assert plan is not None
    possible = str(plan.get("possible_keys") or "")
    used = str(plan.get("key") or "")
    assert "ix_predictions_user_created" in possible or "ix_predictions_user_created" in used
