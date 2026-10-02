from app.config import ROOT_DIR
from app.adapters.external import SoilGridsAdapter
from app.predictors.mapping import MappingService


def test_soilgrids_missing_cache_returns_unavailable(tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "soilgrids_live_enabled", False)
    adapter = SoilGridsAdapter(cache_dir=str(tmp_path / "empty"), live_cache_dir=str(tmp_path / "live"))
    ctx = adapter.get_regional_context("Semarang")
    assert ctx["available"] is False


def test_mapping_missing_raster_is_explicit_fallback():
    service = MappingService()
    result = service.analyze(fixture_path="/nonexistent/path.tif")
    assert result["available"] is True
    assert result["mode"] == "deterministic_demo_fallback"
    assert result["segmentation_summary"]["crop_area_percent"] is None
    assert result["segmentation_summary"].get("crop_area_percent") != 62.5


def test_mapping_demo_raster_computes_known_area():
    raster = ROOT_DIR / "fixtures" / "mapping" / "demo_raster.tif"
    assert raster.exists(), "Demo raster fixture is required for mapping tests"
    result = MappingService().analyze(fixture_path=str(raster))
    assert result["mode"] == "real_raster"
    assert result["segmentation_summary"]["crop_area_percent"] == 25.0
    assert "raster_metadata" in result
