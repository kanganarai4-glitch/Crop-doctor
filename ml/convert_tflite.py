"""
convert_tflite.py
=================
Quantizes a trained MobileNetV3 Keras model to TFLite format and validates
that the quantized model's accuracy is within 1-2% of the original.

Output sizes targeted: float32 ≈ 4-6 MB, int8 dynamic-range ≈ 2-3 MB.

Usage:
    python ml/convert_tflite.py \
        --model ml/models/mobilenet_final.keras \
        --output_dir ml/models \
        --val_dir /path/to/dataset/val \
        [--batch_size 32] [--max_accuracy_drop 0.02]

See ml/PREPROCESSING_SPEC.md for the preprocessing contract that MUST be
maintained through conversion.
"""

import argparse
import json
import logging
import pathlib
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

ROOT = pathlib.Path(__file__).resolve().parent.parent
ML_DIR = ROOT / "ml"
LABELS_PATH = ML_DIR / "labels.json"

with open(LABELS_PATH) as f:
    LABEL_CFG = json.load(f)

CLASSES = LABEL_CFG["classes"]
NUM_CLASSES = LABEL_CFG["numClasses"]
IMG_SIZE = (224, 224)


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--model", required=True)
    p.add_argument("--output_dir", default=str(ML_DIR / "models"))
    p.add_argument("--val_dir", required=True, help="Validation images for accuracy comparison")
    p.add_argument("--batch_size", type=int, default=32)
    p.add_argument("--max_accuracy_drop", type=float, default=0.02,
                   help="Max allowed accuracy drop from quantization (default 2%)")
    return p.parse_args()


def evaluate_keras(model, val_ds) -> float:
    """Returns top-1 accuracy of a Keras model on the val dataset."""
    import numpy as np
    correct = 0
    total = 0
    for images, labels in val_ds:
        preds = model.predict(images, verbose=0)
        correct += int(np.sum(np.argmax(preds, axis=1) == np.argmax(labels.numpy(), axis=1)))
        total += len(labels)
    return correct / total


def evaluate_tflite(tflite_path: pathlib.Path, val_ds) -> float:
    """Returns top-1 accuracy of a TFLite model on the val dataset."""
    import tensorflow as tf
    import numpy as np

    interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
    interpreter.allocate_tensors()
    inp = interpreter.get_input_details()[0]
    out = interpreter.get_output_details()[0]

    correct = 0
    total = 0

    for images, labels in val_ds:
        for i in range(len(images)):
            img = images[i].numpy()                         # (224, 224, 3) float32 0-255
            img = np.expand_dims(img, 0).astype(inp["dtype"])
            interpreter.set_tensor(inp["index"], img)
            interpreter.invoke()
            pred = interpreter.get_tensor(out["index"])[0]  # (NUM_CLASSES,)
            if np.argmax(pred) == np.argmax(labels[i].numpy()):
                correct += 1
            total += 1

    return correct / total


def main():
    args = parse_args()

    try:
        import tensorflow as tf
        import numpy as np
    except ImportError:
        log.error("Run: pip install tensorflow-cpu numpy")
        sys.exit(1)

    output_dir = pathlib.Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    log.info("Loading Keras model: %s", args.model)
    keras_model = tf.keras.models.load_model(args.model)

    log.info("Loading validation dataset for accuracy comparison …")
    val_ds = tf.keras.utils.image_dataset_from_directory(
        args.val_dir,
        image_size=IMG_SIZE,
        batch_size=args.batch_size,
        label_mode="categorical",
        class_names=CLASSES,
        shuffle=False,
    )

    # ── Baseline Keras accuracy ───────────────────────────────────
    log.info("Evaluating original Keras model …")
    keras_acc = evaluate_keras(keras_model, val_ds)
    log.info("Keras model top-1 accuracy: %.4f (%.1f%%)", keras_acc, keras_acc * 100)

    # ── Convert: float32 TFLite ───────────────────────────────────
    log.info("Converting to float32 TFLite …")
    converter = tf.lite.TFLiteConverter.from_keras_model(keras_model)
    tflite_float = converter.convert()
    float_path = output_dir / "mobilenet_final.tflite"
    float_path.write_bytes(tflite_float)
    log.info("float32 TFLite: %.2f MB → %s", float_path.stat().st_size / 1e6, float_path)

    float_acc = evaluate_tflite(float_path, val_ds)
    log.info("float32 TFLite top-1 accuracy: %.4f (%.1f%%)", float_acc, float_acc * 100)

    # ── Convert: int8 dynamic-range ───────────────────────────────
    log.info("Converting to int8 dynamic-range quantised TFLite …")
    converter2 = tf.lite.TFLiteConverter.from_keras_model(keras_model)
    converter2.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_int8 = converter2.convert()
    int8_path = output_dir / "mobilenet_final_int8.tflite"
    int8_path.write_bytes(tflite_int8)
    log.info("int8 TFLite: %.2f MB → %s", int8_path.stat().st_size / 1e6, int8_path)

    int8_acc = evaluate_tflite(int8_path, val_ds)
    log.info("int8 TFLite top-1 accuracy: %.4f (%.1f%%)", int8_acc, int8_acc * 100)

    # ── Accuracy drop check ───────────────────────────────────────
    drop = keras_acc - int8_acc
    log.info("Accuracy drop (Keras→int8): %.4f (%.2f%%)", drop, drop * 100)
    if drop > args.max_accuracy_drop:
        log.warning(
            "⚠️  Accuracy drop %.2f%% exceeds threshold %.2f%%. "
            "Consider full-integer quantisation with a representative dataset.",
            drop * 100, args.max_accuracy_drop * 100
        )
    else:
        log.info("✅  Accuracy drop is within acceptable range.")

    # ── Save summary ──────────────────────────────────────────────
    summary = {
        "keras_model": args.model,
        "keras_top1_accuracy": round(keras_acc, 4),
        "float32_tflite": str(float_path),
        "float32_top1_accuracy": round(float_acc, 4),
        "float32_size_mb": round(float_path.stat().st_size / 1e6, 2),
        "int8_tflite": str(int8_path),
        "int8_top1_accuracy": round(int8_acc, 4),
        "int8_size_mb": round(int8_path.stat().st_size / 1e6, 2),
        "accuracy_drop_percent": round(drop * 100, 2),
        "within_threshold": drop <= args.max_accuracy_drop,
    }

    summary_path = output_dir / "tflite_conversion_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2))
    log.info("Summary saved: %s", summary_path)

    log.info("")
    log.info("Next steps:")
    log.info("  1. Copy %s to web/public/models/", int8_path.name)
    log.info("  2. Update api/src/services/modelRegistry.js with new version + S3 URL")


if __name__ == "__main__":
    main()
