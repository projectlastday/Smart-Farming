"""Tests for trained disease ONNX artifact and known-good classification."""

from pathlib import Path

import numpy as np
from PIL import Image

from app.config import ROOT_DIR, settings
from app.predictors.disease import DiseasePredictor, preprocess_leaf_array
from app.predictors.rules import DISEASE_CLASSES

FIXTURE_DIR = ROOT_DIR / "fixtures" / "disease" / "known_good"


def test_model_artifact_exists():
    path = settings.resolved_disease_model_path
    assert path.exists(), f"Trained ONNX missing at {path}"
    assert path.stat().st_size > 100_000


def test_model_metadata_reports_trained_model(client, farmer, farmer_session):
    resp = client.get("/api/v1/features/disease/model/metadata")
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("model_available") is True
    assert body.get("classes") == DISEASE_CLASSES or body.get("labels") == DISEASE_CLASSES
    assert body.get("hash")
    assert body.get("mode") == "trained_mobilenet_v3_small"


def test_model_download_requires_session(client):
    resp = client.get("/api/v1/features/disease/model/download")
    assert resp.status_code == 401


def test_model_download_when_authenticated(client, farmer, farmer_session):
    resp = client.get("/api/v1/features/disease/model/download")
    assert resp.status_code == 200
    assert len(resp.content) > 100_000


def test_known_good_images_classify_correct_class():
    path = settings.resolved_disease_model_path
    assert path.exists(), "Model artifact required; do not skip"
    assert FIXTURE_DIR.exists(), "Known-good fixtures required"
    predictor = DiseasePredictor()
    assert predictor._session is not None
    for cls in DISEASE_CLASSES:
        image_path = FIXTURE_DIR / f"{cls}.jpg"
        assert image_path.exists(), f"Missing fixture {image_path}"
        result = predictor.predict(image_path.read_bytes())
        assert result["status"] == "classified", result
        assert result["label"] == cls, result
        assert result["confidence"] >= predictor.threshold


def test_preprocess_shape_parity():
    img = Image.new("RGB", (640, 480), color=(128, 64, 32))
    tensor = preprocess_leaf_array(img)
    assert tensor.shape == (1, 3, 224, 224)
    assert tensor.dtype == np.float32
    expected_r = (128 / 255.0 - 0.485) / 0.229
    assert abs(float(tensor[0, 0, 0, 0]) - expected_r) < 1e-4
