#!/usr/bin/env python3
"""Export trained disease_v1 checkpoint to ONNX with metadata."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import torch
import yaml
from torchvision import models

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "ml" / "configs" / "disease_v1.yaml"


def load_config() -> dict:
    with CONFIG_PATH.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class DiseaseExportWrapper(torch.nn.Module):
    """MobileNetV3-Small with softmax output for ONNX."""

    def __init__(self, backbone: torch.nn.Module) -> None:
        super().__init__()
        self.backbone = backbone

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        logits = self.backbone(x)
        return torch.softmax(logits, dim=1)


def build_model(num_classes: int) -> torch.nn.Module:
    model = models.mobilenet_v3_small(weights=None)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = torch.nn.Linear(in_features, num_classes)
    return model


def export_onnx() -> dict:
    cfg = load_config()
    ckpt_path = ROOT / cfg["paths"]["checkpoint"]
    metrics_path = ROOT / cfg["paths"]["metrics"]
    manifest_path = ROOT / cfg["paths"]["manifest"]
    onnx_path = ROOT / cfg["paths"]["onnx"]
    meta_path = ROOT / cfg["paths"]["onnx_meta"]

    if not ckpt_path.exists():
        raise FileNotFoundError(f"Trained checkpoint not found: {ckpt_path}")

    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    classes = ckpt.get("classes", cfg["classes"])
    model = build_model(len(classes))
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    export_model = DiseaseExportWrapper(model)

    input_size = cfg["image_size"]
    dummy = torch.randn(1, 3, input_size, input_size)
    onnx_path.parent.mkdir(parents=True, exist_ok=True)

    torch.onnx.export(
        export_model,
        dummy,
        str(onnx_path),
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=13,
        dynamo=False,
    )

    threshold = 0.55
    if metrics_path.exists():
        metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
        threshold = metrics.get("unknown_threshold", threshold)

    manifest = {}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    meta = {
        "version": "disease-mobilenet-v1-paddy-doctor",
        "classes": classes,
        "labels": classes,
        "input_size": [input_size, input_size],
        "mean": cfg["mean"],
        "std": cfg["std"],
        "confidence_threshold": threshold,
        "model_url": "/api/v1/features/disease/model/download",
        "mode": "trained_mobilenet_v3_small",
        "provenance": {
            "dataset": manifest.get("dataset"),
            "paper": manifest.get("source", {}).get("paper"),
            "ieee_dataport": manifest.get("source", {}).get("ieee_dataport"),
            "license_note": manifest.get("source", {}).get("license_note"),
            "checkpoint_epoch": ckpt.get("epoch"),
            "val_acc": ckpt.get("val_acc"),
        },
        "limitations": [
            "Model sekolah dilatih pada subset Paddy Doctor; bukan sertifikasi lapangan.",
            "Akurasi lapangan terbatas; gunakan retake foto bila confidence rendah.",
        ],
        "hash": sha256_file(onnx_path),
        "size_bytes": onnx_path.stat().st_size,
    }

    import numpy as np
    import onnxruntime as ort

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    arr = np.random.rand(1, 3, input_size, input_size).astype(np.float32)
    out = session.run(None, {input_name: arr})[0]
    meta["onnxruntime_verified"] = bool(out.shape[-1] == len(classes))

    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


if __name__ == "__main__":
    try:
        result = export_onnx()
        print(json.dumps(result, indent=2))
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001
        print(f"Export failed: {exc}", file=sys.stderr)
        sys.exit(1)
