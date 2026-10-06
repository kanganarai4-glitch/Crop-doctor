"""
inference-service/tests/test_main.py
=====================================
Unit tests for FastAPI inference service.
"""

import io
import os
import pathlib
import pytest
from fastapi.testclient import TestClient
from PIL import Image

# Ensure environment variables point to dummy models before importing app
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
os.environ["MODEL_DIR"] = str(ROOT / "ml" / "models")
os.environ["LABELS_PATH"] = str(ROOT / "ml" / "labels.json")
os.environ["EFFICIENTNET_MODEL"] = "efficientnet_dummy.keras"
os.environ["MODEL_VERSION"] = "0.0.1-dummy"

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def dummy_image_bytes():
    img = Image.new("RGB", (224, 224), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["modelLoaded"] is True
    assert data["numClasses"] == 26


def test_predict_success(client, dummy_image_bytes):
    files = {"file": ("leaf.jpg", dummy_image_bytes, "image/jpeg")}
    response = client.post("/predict", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "top3" in data
    assert len(data["top3"]) == 3
    assert "label" in data["top3"][0]
    assert "confidence" in data["top3"][0]


def test_predict_unsupported_media_type(client):
    files = {"file": ("test.txt", b"hello world", "text/plain")}
    response = client.post("/predict", files=files)
    assert response.status_code == 415


def test_predict_corrupt_image(client):
    files = {"file": ("leaf.jpg", b"invalid image bytes", "image/jpeg")}
    response = client.post("/predict", files=files)
    assert response.status_code == 400


def test_gradcam_success(client, dummy_image_bytes):
    files = {"file": ("leaf.jpg", dummy_image_bytes, "image/jpeg")}
    response = client.post("/gradcam", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "heatmapImage" in data
    assert data["heatmapImage"].startswith("data:image/png;base64,")
    assert "severity" in data
    assert "severityLabel" in data
    assert "label" in data
    assert "confidence" in data
