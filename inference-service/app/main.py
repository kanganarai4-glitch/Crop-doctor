"""
inference-service/app/main.py
==============================
FastAPI inference service for CropDoctor.

Endpoints:
  GET  /health        — liveness probe
  POST /predict       — top-3 predictions from EfficientNetB0
  POST /gradcam       — Grad-CAM heatmap overlay + severity estimate

Internal-only service: not publicly exposed.
Model is loaded ONCE at startup via lifespan context.

See ml/PREPROCESSING_SPEC.md for the preprocessing contract (0-255 pixel range).
"""

import io
import json
import logging
import os
import pathlib
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from app.gradcam import GradCAMGenerator

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
MODEL_DIR = pathlib.Path(os.getenv("MODEL_DIR", "/app/models"))
EFFICIENTNET_MODEL_PATH = MODEL_DIR / os.getenv(
    "EFFICIENTNET_MODEL", "efficientnet_dummy.keras"
)
LABELS_PATH = pathlib.Path(os.getenv("LABELS_PATH", "/app/labels.json"))
MODEL_VERSION = os.getenv("MODEL_VERSION", "0.0.1-dummy")
MAX_IMAGE_SIZE_MB = float(os.getenv("MAX_IMAGE_SIZE_MB", "10"))
LOW_CONFIDENCE_THRESHOLD = float(os.getenv("LOW_CONFIDENCE_THRESHOLD", "0.60"))

IMG_SIZE = (224, 224)
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

# ── Global model state ────────────────────────────────────────────────────────
_model = None
_labels: list[str] = []
_gradcam_gen: GradCAMGenerator | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the model once at startup and clean up on shutdown."""
    global _model, _labels, _gradcam_gen

    log.info("Loading labels from %s", LABELS_PATH)
    labels_text = LABELS_PATH.read_text(encoding="utf-8")
    cfg = json.loads(labels_text)
    _labels = cfg["classes"]
    log.info("Loaded %d classes", len(_labels))

    log.info("Loading EfficientNetB0 from %s", EFFICIENTNET_MODEL_PATH)
    try:
        import tensorflow as tf
        _model = tf.keras.models.load_model(str(EFFICIENTNET_MODEL_PATH))
        # Warm up the model with a dummy forward pass
        dummy = np.zeros((1, *IMG_SIZE, 3), dtype=np.float32)
        _model.predict(dummy, verbose=0)
        log.info("Model loaded and warmed up. Version: %s", MODEL_VERSION)
    except Exception as e:
        log.error("Failed to load model: %s", e)
        raise

    # Initialise Grad-CAM generator with the loaded model
    _gradcam_gen = GradCAMGenerator(_model, labels=_labels)

    yield  # ── App is running ──

    log.info("Shutting down inference service")
    _model = None
    _gradcam_gen = None


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CropDoctor Inference Service",
    description="EfficientNetB0 plant disease prediction + Grad-CAM heatmaps",
    version=MODEL_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Internal only; the Node API is the gatekeeper
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_and_decode_image(file: UploadFile) -> Image.Image:
    """Validate content type, size, and decode image to PIL RGB."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type '{file.content_type}'. "
                   f"Accepted: {', '.join(ALLOWED_CONTENT_TYPES)}",
        )

    data = file.file.read()
    size_mb = len(data) / 1_048_576
    if size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image too large ({size_mb:.1f} MB). Max {MAX_IMAGE_SIZE_MB} MB.",
        )

    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except UnidentifiedImageError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot decode image. Please upload a valid JPEG, PNG, or WebP.",
        )
    return img


def _preprocess(img: Image.Image) -> np.ndarray:
    """
    Resize to 224×224, return float32 array with values 0-255.
    The Keras EfficientNetB0 model handles internal normalisation.
    See ml/PREPROCESSING_SPEC.md.
    """
    img = img.resize(IMG_SIZE, Image.BILINEAR)
    arr = np.array(img, dtype=np.float32)      # (224, 224, 3)  values 0.0-255.0
    return np.expand_dims(arr, axis=0)          # (1, 224, 224, 3)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
async def health():
    return {
        "status": "ok",
        "modelLoaded": _model is not None,
        "modelVersion": MODEL_VERSION,
        "numClasses": len(_labels),
    }


@app.post("/predict", tags=["inference"])
async def predict(file: UploadFile = File(...)):  # noqa: B008
    """
    Run EfficientNetB0 on the uploaded leaf image.

    Returns top-3 predictions with confidence scores.
    If all top-3 confidences are below LOW_CONFIDENCE_THRESHOLD,
    status is set to "uncertain".
    """
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    img = _validate_and_decode_image(file)
    tensor = _preprocess(img)

    preds = _model.predict(tensor, verbose=0)[0]   # shape (NUM_CLASSES,)
    top3_indices = np.argsort(preds)[::-1][:3]

    top3 = [
        {"label": _labels[i], "confidence": round(float(preds[i]), 4)}
        for i in top3_indices
    ]

    top_confidence = top3[0]["confidence"]
    prediction_status = (
        "uncertain" if top_confidence < LOW_CONFIDENCE_THRESHOLD else "ok"
    )

    return {
        "status": prediction_status,
        "top3": top3,
        "modelVersion": MODEL_VERSION,
        "message": (
            "Low confidence — retake the photo in better lighting or consult an agriculture officer."
            if prediction_status == "uncertain"
            else None
        ),
    }


@app.post("/gradcam", tags=["inference"])
async def gradcam(file: UploadFile = File(...)):  # noqa: B008
    """
    Generate a Grad-CAM heatmap overlay for the top-1 predicted class.

    Returns:
      - heatmapImage: base64-encoded PNG overlay
      - severity: fraction of heatmap pixels > 0.5 (severity estimate, NOT a medical diagnosis)
      - label: predicted class label
      - confidence: top-1 confidence
    """
    if _model is None or _gradcam_gen is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    img = _validate_and_decode_image(file)
    tensor = _preprocess(img)

    result = _gradcam_gen.generate(tensor, original_image=img)
    return result
