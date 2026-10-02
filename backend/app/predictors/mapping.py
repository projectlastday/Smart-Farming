from pathlib import Path
from typing import Any

import numpy as np

from app.config import settings
from app.predictors.rules import rule_reliability

# Single-band intensity threshold on the seeded uint8 demo raster.
# This is NOT NDVI: the fixture has one reflective-like band, no NIR.
CROP_INTENSITY_THRESHOLD = 100


class MappingService:
    version = "mapping-threshold-v1"

    def analyze(self, *, fixture_path: str | None = None) -> dict[str, Any]:
        path = Path(fixture_path or settings.mapping_fixture_path)
        if path.exists():
            try:
                return self._analyze_raster(path)
            except Exception as exc:  # noqa: BLE001
                return self._deterministic_fallback(
                    reason=f"Validasi raster gagal: {exc}",
                )
        return self._deterministic_fallback(
            reason="Raster demo tidak tersedia; menampilkan contoh deterministik.",
        )

    def _analyze_raster(self, path: Path) -> dict[str, Any]:
        import rasterio

        with rasterio.open(path) as dataset:
            bounds = dataset.bounds
            band = dataset.read(1)
            nodata = dataset.nodata
            preview = {
                "width": dataset.width,
                "height": dataset.height,
                "crs": str(dataset.crs) if dataset.crs else "EPSG:4326",
                "bounds": [bounds.left, bounds.bottom, bounds.right, bounds.top],
                "count": dataset.count,
                "dtype": str(dataset.dtypes[0]),
                "nodata": nodata,
            }
        valid = np.ones(band.shape, dtype=bool)
        if nodata is not None:
            valid = band != nodata
        valid_count = int(valid.sum())
        if valid_count == 0:
            raise ValueError("Semua piksel bernilai nodata")
        crop_mask = valid & (band >= CROP_INTENSITY_THRESHOLD)
        crop_area_percent = round(100.0 * float(crop_mask.sum()) / float(valid_count), 2)
        reliability = rule_reliability(
            inputs_complete=True,
            extra_reasons=[
                "Metode: ambang intensitas pita tunggal, bukan NDVI.",
                "Akurasi batas terbatas pada lahan kecil (piksel campuran Sentinel-2 10 m).",
            ],
        )
        return {
            "available": True,
            "mode": "real_raster",
            "raster_metadata": preview,
            "segmentation_summary": {
                "method": "single_band_intensity_threshold",
                "threshold": CROP_INTENSITY_THRESHOLD,
                "band": 1,
                "crs": preview["crs"],
                "nodata": nodata,
                "crop_area_percent": crop_area_percent,
                "valid_pixel_count": valid_count,
                "crop_pixel_count": int(crop_mask.sum()),
                "note": "Bukan NDVI. Ambang intensitas pada pita tunggal raster demo.",
            },
            "reliability": reliability,
            "provenance": {
                "source": "seeded_demo_raster",
                "path": str(path.name),
                "method": "single_band_intensity_threshold",
            },
            "limitations": [
                "Demo menggunakan raster pramuat, bukan unduhan Copernicus langsung.",
                "Fragmentasi lahan kecil mengurangi presisi batas.",
                "Output area adalah persentase piksel di atas ambang intensitas, bukan klasifikasi tanaman lapangan.",
            ],
        }

    def _deterministic_fallback(self, *, reason: str) -> dict[str, Any]:
        reliability = rule_reliability(
            inputs_complete=False,
            extra_reasons=["Mode fallback sintetis karena raster tidak dapat dibaca."],
        )
        return {
            "available": True,
            "mode": "deterministic_demo_fallback",
            "message": reason,
            "raster_metadata": {
                "width": 128,
                "height": 128,
                "crs": "EPSG:4326",
                "bounds": [110.0, -6.90128, 110.0128, -6.88872],
                "count": 1,
            },
            "segmentation_summary": {
                "method": "synthetic_demo_grid",
                "crop_area_percent": None,
                "note": "Fallback demo sekolah; bukan scene Sentinel-2 unduhan langsung.",
            },
            "reliability": reliability,
            "provenance": {"source": "deterministic_demo_fallback"},
            "limitations": [
                "Hasil demo sintetis ketika GeoTIFF pramuat tidak ada.",
                "Fragmentasi lahan kecil mengurangi presisi batas.",
            ],
        }
