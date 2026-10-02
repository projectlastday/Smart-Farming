#!/usr/bin/env python3
"""Generate demo fixtures (SoilGrids cache, mapping GeoTIFF) and ONNX model."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"
MODELS = ROOT / "models"


def write_soilgrids_cache() -> None:
    cache_dir = FIXTURES / "soilgrids"
    cache_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "region": "central-java",
        "ph_hydroxide": 5.6,
        "nitrogen_gkg": 1.2,
        "uncertainty": "high",
        "retrieved_at": "2026-01-01T00:00:00Z",
        "note": "Demo regional baseline only",
    }
    (cache_dir / "central-java.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_demo_raster() -> bool:
    mapping_dir = FIXTURES / "mapping"
    mapping_dir.mkdir(parents=True, exist_ok=True)
    path = mapping_dir / "demo_raster.tif"
    try:
        import numpy as np
        import rasterio
        from rasterio.transform import from_origin
    except ImportError:
        (mapping_dir / "demo_metadata.json").write_text(
            json.dumps(
                {
                    "available": False,
                    "note": "Install numpy+rasterio to generate GeoTIFF fixture",
                }
            ),
            encoding="utf-8",
        )
        return False

    data = np.zeros((128, 128), dtype=np.uint8)
    data[32:96, 32:96] = 180
    transform = from_origin(110.0, -6.9, 0.0001, 0.0001)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=128,
        width=128,
        count=1,
        dtype=data.dtype,
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(data, 1)
    (mapping_dir / "demo_metadata.json").write_text(
        json.dumps({"available": True, "path": str(path.name), "width": 128, "height": 128}),
        encoding="utf-8",
    )
    return True


def export_onnx_via_ml_script() -> bool:
    """Export trained disease_v1 ONNX (requires ml/checkpoints/disease_v1_best.pt)."""
    script = ROOT / "ml" / "export" / "export_disease_onnx.py"
    ckpt = ROOT / "ml" / "checkpoints" / "disease_v1_best.pt"
    backend_python = ROOT / "backend" / ".venv" / "bin" / "python"
    python = str(backend_python if backend_python.exists() else sys.executable)
    if not ckpt.exists():
        print(
            "Skipping ONNX export: trained checkpoint missing. "
            "Run ml/training/train_disease.py first.",
            file=sys.stderr,
        )
        return False
    proc = subprocess.run([python, str(script)], capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        return False
    print(proc.stdout)
    return (MODELS / "disease_v1.onnx").exists()


if __name__ == "__main__":
    write_soilgrids_cache()
    raster_ok = write_demo_raster()
    onnx_ok = export_onnx_via_ml_script()
    print(f"SoilGrids cache: ok")
    print(f"Mapping raster: {'ok' if raster_ok else 'fallback metadata only'}")
    print(f"ONNX model: {'ok' if onnx_ok else 'missing trained checkpoint; not using heuristic'}")
