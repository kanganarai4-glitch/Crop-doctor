"""
generate_dummy_models.py
========================
Generates two dummy models (EfficientNetB0-shaped and MobileNetV3-shaped) with
RANDOM weights and the SAME input/output interface as the real trained models.

Purpose: Allows all downstream services (FastAPI, React PWA, Node API) to be
         built and tested without trained weights or a GPU.

Usage:
    pip install tensorflow numpy pillow
    python ml/generate_dummy_models.py

Outputs:
    ml/models/efficientnet_dummy.keras   - Keras SavedModel format
    ml/models/mobilenet_dummy.keras      - Keras SavedModel format
    ml/models/mobilenet_dummy.tflite     - TFLite flatbuffer (float32, ~4-6 MB)
    ml/models/mobilenet_dummy_int8.tflite- TFLite int8 quantized (smaller)
    web/public/models/mobilenet_dummy.tflite  - Copied to PWA assets

IMPORTANT: These models produce RANDOM predictions. Never report their
           "accuracy" as meaningful. They exist solely for integration testing.

Preprocessing contract (MUST be identical everywhere):
    - Input shape : (1, 224, 224, 3)  float32
    - Pixel values: 0-255  (raw uint8 cast to float32; NO manual normalisation)
    - Color order : RGB
    - The Keras model itself contains the EfficientNet / MobileNetV3 preprocessing
      layer which normalises internally, so callers must NOT rescale.

See ml/PREPROCESSING_SPEC.md for the full spec and unit-test instructions.
"""

import os
import sys
import json
import shutil
import logging
import pathlib
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── project root (one level above ml/) ───────────────────────────────────────
ROOT = pathlib.Path(__file__).resolve().parent.parent
ML_DIR = ROOT / "ml"
MODELS_DIR = ML_DIR / "models"
WEB_MODELS_DIR = ROOT / "web" / "public" / "models"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
WEB_MODELS_DIR.mkdir(parents=True, exist_ok=True)

# ── load label list ───────────────────────────────────────────────────────────
LABELS_PATH = ML_DIR / "labels.json"
with open(LABELS_PATH) as f:
    label_cfg = json.load(f)

CLASSES = label_cfg["classes"]
NUM_CLASSES = label_cfg["numClasses"]
assert len(CLASSES) == NUM_CLASSES, "labels.json numClasses mismatch"
log.info("Loaded %d classes from labels.json", NUM_CLASSES)

INPUT_SHAPE = (224, 224, 3)


def _build_efficientnet_dummy() -> "tf.keras.Model":
    """
    EfficientNet-B0 architecture with random weights.
    Includes the built-in preprocessing layer so inference callers pass raw 0-255 pixels.
    """
    import tensorflow as tf

    # Functional API so Grad-CAM can reach inner layers by name
    inputs = tf.keras.Input(shape=INPUT_SHAPE, name="input_image")

    base = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights=None,          # random weights
        input_tensor=inputs,
        pooling="avg",
    )
    # EfficientNetB0 already includes its own rescaling / normalisation inside

    x = base.output
    x = tf.keras.layers.Dropout(0.3, name="top_dropout")(x)
    outputs = tf.keras.layers.Dense(NUM_CLASSES, activation="softmax", name="predictions")(x)

    model = tf.keras.Model(inputs=inputs, outputs=outputs, name="efficientnet_b0_dummy")
    model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
    return model


def _build_mobilenet_dummy() -> "tf.keras.Model":
    """
    MobileNetV3-Small architecture with random weights.
    Same preprocessing contract as EfficientNet dummy above.
    """
    import tensorflow as tf

    inputs = tf.keras.Input(shape=INPUT_SHAPE, name="input_image")

    base = tf.keras.applications.MobileNetV3Small(
        include_top=False,
        weights=None,          # random weights
        input_tensor=inputs,
        pooling="avg",
        include_preprocessing=True,   # built-in rescaling to [-1, 1]
    )

    x = base.output
    x = tf.keras.layers.Dropout(0.2, name="top_dropout")(x)
    outputs = tf.keras.layers.Dense(NUM_CLASSES, activation="softmax", name="predictions")(x)

    model = tf.keras.Model(inputs=inputs, outputs=outputs, name="mobilenet_v3_small_dummy")
    model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
    return model


def _verify_inference(model, label: str) -> None:
    """Run a quick forward pass to confirm the model is functional."""
    import numpy as np
    dummy_img = np.random.randint(0, 256, (1, *INPUT_SHAPE), dtype=np.uint8).astype(np.float32)
    preds = model.predict(dummy_img, verbose=0)
    assert preds.shape == (1, NUM_CLASSES), f"Unexpected output shape: {preds.shape}"
    assert abs(preds.sum() - 1.0) < 1e-4, "Predictions do not sum to 1"
    top_idx = int(np.argmax(preds[0]))
    log.info(
        "[%s] smoke-test OK — top prediction: %s (%.3f)",
        label,
        CLASSES[top_idx],
        float(preds[0, top_idx]),
    )


def _convert_to_tflite(keras_model, out_path: pathlib.Path, quantize_int8: bool = False) -> None:
    """Convert a Keras model to TFLite with optional dynamic-range int8 quantization."""
    import tensorflow as tf

    converter = tf.lite.TFLiteConverter.from_keras_model(keras_model)

    if quantize_int8:
        # Dynamic-range quantisation (no calibration dataset needed)
        converter.optimizations = [tf.lite.Optimize.DEFAULT]

    tflite_model = converter.convert()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(tflite_model)
    size_mb = out_path.stat().st_size / 1_048_576
    log.info("Saved TFLite model (%s): %.2f MB", out_path.name, size_mb)


def main():
    try:
        import tensorflow as tf
    except ImportError:
        log.error("TensorFlow not installed. Run: pip install tensorflow-cpu")
        sys.exit(1)

    log.info("TensorFlow version: %s", tf.__version__)
    log.info("Building dummy models with random weights — NOT for production use.")
    log.info("━" * 60)

    # ── EfficientNet dummy ────────────────────────────────────────
    log.info("Building EfficientNetB0 dummy …")
    eff_model = _build_efficientnet_dummy()
    _verify_inference(eff_model, "EfficientNetB0")

    eff_path = MODELS_DIR / "efficientnet_dummy.keras"
    eff_model.save(str(eff_path))
    log.info("Saved: %s", eff_path)
    log.info("")

    # ── MobileNetV3 dummy ─────────────────────────────────────────
    log.info("Building MobileNetV3Small dummy …")
    mob_model = _build_mobilenet_dummy()
    _verify_inference(mob_model, "MobileNetV3Small")

    mob_keras_path = MODELS_DIR / "mobilenet_dummy.keras"
    mob_model.save(str(mob_keras_path))
    log.info("Saved: %s", mob_keras_path)
    log.info("")

    # ── TFLite conversions ────────────────────────────────────────
    log.info("Converting MobileNetV3 → TFLite (float32) …")
    mob_tflite_path = MODELS_DIR / "mobilenet_dummy.tflite"
    _convert_to_tflite(mob_model, mob_tflite_path, quantize_int8=False)

    log.info("Converting MobileNetV3 → TFLite (int8 dynamic-range) …")
    mob_tflite_int8_path = MODELS_DIR / "mobilenet_dummy_int8.tflite"
    _convert_to_tflite(mob_model, mob_tflite_int8_path, quantize_int8=True)

    # ── Copy float32 TFLite to PWA public/models/ ─────────────────
    dest = WEB_MODELS_DIR / "mobilenet_dummy.tflite"
    shutil.copy2(mob_tflite_path, dest)
    log.info("Copied TFLite model to PWA assets: %s", dest)

    # ── Write model-version manifest ──────────────────────────────
    version_info = {
        "version": "0.0.1-dummy",
        "modelFile": "mobilenet_dummy.tflite",
        "numClasses": NUM_CLASSES,
        "inputShape": list(INPUT_SHAPE),
        "pixelRange": "0-255",
        "note": "Random-weight dummy model for integration testing only."
    }
    version_path = MODELS_DIR / "model_version.json"
    version_path.write_text(json.dumps(version_info, indent=2))
    log.info("Wrote version manifest: %s", version_path)

    log.info("")
    log.info("━" * 60)
    log.info("Phase 0 dummy model generation complete.")
    log.info("All files are in: %s", MODELS_DIR)
    log.info("PWA model asset: %s", dest)
    log.info("")
    log.info("REMINDER: These models have RANDOM weights.")
    log.info("          Never quote their predictions as real accuracy.")


if __name__ == "__main__":
    main()
