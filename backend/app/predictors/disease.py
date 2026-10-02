import hashlib
import io
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from app.config import ROOT_DIR, settings
from app.predictors.rules import DISEASE_CLASSES, DISEASE_LABELS_ID

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
INPUT_SIZE = 224


def preprocess_leaf_array(image: Image.Image, *, size: int = INPUT_SIZE) -> np.ndarray:
    """CHW float32 NCHW batch matching backend and browser canvas preprocessing."""
    image = image.convert("RGB").resize((size, size), Image.Resampling.BILINEAR)
    arr = np.asarray(image, dtype=np.float32) / 255.0
    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
    arr = np.transpose(arr, (2, 0, 1))
    return np.expand_dims(arr, axis=0)


class DiseasePredictor:
    def __init__(self) -> None:
        self.model_path = settings.resolved_disease_model_path
        self.meta_path = self.model_path.with_suffix(".json")
        repo_meta = ROOT_DIR / "models" / "disease_v1.json"
        if not self.meta_path.exists() and repo_meta.exists():
            self.meta_path = repo_meta
        self._meta = self._load_meta()
        self.version = str(self._meta.get("version") or settings.disease_model_version)
        self.threshold = float(
            self._meta.get("confidence_threshold") or settings.disease_confidence_threshold
        )
        self.classes = list(self._meta.get("classes") or self._meta.get("labels") or DISEASE_CLASSES)
        self._session = None
        self._mode = "unavailable"
        if self.model_path.exists():
            import onnxruntime as ort

            self._session = ort.InferenceSession(
                str(self.model_path), providers=["CPUExecutionProvider"]
            )
            self._mode = str(self._meta.get("mode") or "onnx")

    def _load_meta(self) -> dict[str, Any]:
        if self.meta_path.exists():
            return json.loads(self.meta_path.read_text(encoding="utf-8"))
        alt = ROOT_DIR / "models" / "disease_v1.json"
        if alt.exists():
            self.meta_path = alt
            return json.loads(alt.read_text(encoding="utf-8"))
        return {}

    def _preprocess(self, image: Image.Image) -> np.ndarray:
        size = INPUT_SIZE
        if isinstance(self._meta.get("input_size"), list) and self._meta["input_size"]:
            size = int(self._meta["input_size"][0])
        return preprocess_leaf_array(image, size=size)

    def predict(self, image_bytes: bytes) -> dict[str, Any]:
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
        if not self._session:
            return {
                "status": "unknown",
                "label": "unknown",
                "label_id": DISEASE_LABELS_ID["unknown"],
                "confidence": 0.0,
                "warnings": ["Model penyakit terlatih tidak tersedia pada server."],
                "inference_mode": self._mode,
                "reliability": {
                    "kind": "unavailable",
                    "label": "Model tidak tersedia",
                    "score": None,
                },
            }
        input_name = self._session.get_inputs()[0].name
        tensor = self._preprocess(image)
        outputs = self._session.run(None, {input_name: tensor})
        probs = np.asarray(outputs[0][0], dtype=np.float32)
        idx = int(np.argmax(probs))
        confidence = float(probs[idx])
        label = self.classes[idx] if idx < len(self.classes) else "unknown"
        probabilities = {
            cls: float(probs[i]) if i < len(probs) else 0.0 for i, cls in enumerate(self.classes)
        }
        if label == "unknown" or confidence < self.threshold:
            return {
                "status": "unknown",
                "label": "unknown",
                "label_id": DISEASE_LABELS_ID["unknown"],
                "confidence": confidence,
                "probabilities": probabilities,
                "warnings": ["Gambar di luar distribusi atau confidence rendah."],
                "inference_mode": self._mode,
                "model_version": self.version,
                "reliability": {
                    "kind": "model_probability",
                    "label": "Probabilitas model",
                    "score": round(confidence * 100, 2),
                },
            }
        return {
            "status": "classified",
            "label": label,
            "label_id": DISEASE_LABELS_ID.get(label, label),
            "confidence": confidence,
            "probabilities": probabilities,
            "warnings": [],
            "inference_mode": self._mode,
            "model_version": self.version,
            "reliability": {
                "kind": "model_probability",
                "label": "Probabilitas model",
                "score": round(confidence * 100, 2),
            },
        }

    def metadata(self) -> dict[str, Any]:
        meta = dict(self._meta) if self._meta else {
            "version": self.version,
            "classes": self.classes,
            "labels": self.classes,
            "input_size": [INPUT_SIZE, INPUT_SIZE],
            "mean": IMAGENET_MEAN.tolist(),
            "std": IMAGENET_STD.tolist(),
            "mode": self._mode,
        }
        meta["model_available"] = self.model_path.exists()
        meta["model_url"] = meta.get("model_url", "/api/v1/features/disease/model/download")
        meta["confidence_threshold"] = self.threshold
        meta["version"] = self.version
        if self.model_path.exists() and "hash" not in meta:
            digest = hashlib.sha256()
            with self.model_path.open("rb") as fh:
                for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                    digest.update(chunk)
            meta["hash"] = digest.hexdigest()
            meta["size_bytes"] = self.model_path.stat().st_size
        meta["inference_mode"] = self._mode
        meta.setdefault(
            "limitations",
            ["Model sekolah dilatih pada subset Paddy Doctor; bukan sertifikasi lapangan."],
        )
        return meta
