#!/usr/bin/env python3
"""Generate demo fixtures (SoilGrids cache) and ONNX model."""

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
    onnx_ok = export_onnx_via_ml_script()
    print(f"SoilGrids cache: ok")
    print(f"ONNX model: {'ok' if onnx_ok else 'missing trained checkpoint; not using heuristic'}")
