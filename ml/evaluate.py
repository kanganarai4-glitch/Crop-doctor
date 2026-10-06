"""
evaluate.py
===========
Evaluates a trained Keras model on a test dataset.

Outputs:
  - Top-1 and Top-3 accuracy (printed to stdout)
  - Per-class F1 score table
  - Confusion matrix image (PNG)
  - metrics.json summary file

Usage:
    python ml/evaluate.py \
        --model ml/models/efficientnet_final.keras \
        --test_dir /path/to/dataset/test \
        --output_dir ml/eval_results \
        [--batch_size 32]

IMPORTANT: Never report accuracy from a dummy/random-weight model.
           This script warns clearly when it detects random-weight-level accuracy.
"""

import argparse
import json
import pathlib
import logging
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
    p.add_argument("--model", required=True, help="Path to .keras or SavedModel")
    p.add_argument("--test_dir", required=True, help="Test image directory")
    p.add_argument("--output_dir", default=str(ML_DIR / "eval_results"))
    p.add_argument("--batch_size", type=int, default=32)
    return p.parse_args()


def main():
    args = parse_args()

    try:
        import tensorflow as tf
        import numpy as np
        from sklearn.metrics import (
            classification_report, confusion_matrix, f1_score
        )
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import seaborn as sns
    except ImportError:
        log.error("Missing deps. Run: pip install tensorflow-cpu scikit-learn matplotlib seaborn")
        sys.exit(1)

    output_dir = pathlib.Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    log.info("Loading model from %s …", args.model)
    model = tf.keras.models.load_model(args.model)

    log.info("Loading test dataset …")
    # No shuffle, no augmentation for evaluation.
    test_ds = tf.keras.utils.image_dataset_from_directory(
        args.test_dir,
        image_size=IMG_SIZE,
        batch_size=args.batch_size,
        label_mode="categorical",
        class_names=CLASSES,
        shuffle=False,
    )

    # ── Collect predictions ───────────────────────────────────────
    y_true, y_pred = [], []
    y_pred_probs = []

    for images, labels in test_ds:
        preds = model.predict(images, verbose=0)
        y_true.extend(np.argmax(labels.numpy(), axis=1))
        y_pred.extend(np.argmax(preds, axis=1))
        y_pred_probs.extend(preds)

    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    y_pred_probs = np.array(y_pred_probs)

    # ── Top-1 accuracy ────────────────────────────────────────────
    top1 = float(np.mean(y_true == y_pred))

    # ── Top-3 accuracy ────────────────────────────────────────────
    top3_count = 0
    for i, true_label in enumerate(y_true):
        top3_indices = np.argsort(y_pred_probs[i])[-3:]
        if true_label in top3_indices:
            top3_count += 1
    top3 = top3_count / len(y_true)

    log.info("Top-1 Accuracy: %.4f (%.1f%%)", top1, top1 * 100)
    log.info("Top-3 Accuracy: %.4f (%.1f%%)", top3, top3 * 100)

    # Warn if accuracy looks like random weights
    random_chance = 1.0 / NUM_CLASSES
    if top1 < random_chance * 2:
        log.warning(
            "⚠️  Top-1 accuracy (%.4f) is near random-chance level (%.4f). "
            "This model may not be properly trained. Do NOT report this as real accuracy.",
            top1, random_chance
        )

    # ── Per-class F1 ──────────────────────────────────────────────
    report = classification_report(y_true, y_pred, target_names=CLASSES, output_dict=True)
    log.info("\nPer-class classification report:")
    print(classification_report(y_true, y_pred, target_names=CLASSES))

    # ── Confusion matrix ──────────────────────────────────────────
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(16, 14))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="YlOrRd",
        xticklabels=CLASSES, yticklabels=CLASSES, ax=ax,
        linewidths=0.3,
    )
    ax.set_xlabel("Predicted", fontsize=12)
    ax.set_ylabel("True", fontsize=12)
    ax.set_title("CropDoctor — Confusion Matrix", fontsize=14)
    plt.xticks(rotation=45, ha="right", fontsize=7)
    plt.yticks(rotation=0, fontsize=7)
    plt.tight_layout()
    cm_path = output_dir / "confusion_matrix.png"
    plt.savefig(str(cm_path), dpi=150)
    plt.close()
    log.info("Confusion matrix saved: %s", cm_path)

    # ── Save metrics JSON ─────────────────────────────────────────
    metrics = {
        "model": args.model,
        "top1_accuracy": round(top1, 4),
        "top3_accuracy": round(top3, 4),
        "per_class": {
            cls: {
                "precision": round(report[cls]["precision"], 4),
                "recall": round(report[cls]["recall"], 4),
                "f1": round(report[cls]["f1-score"], 4),
                "support": int(report[cls]["support"]),
            }
            for cls in CLASSES if cls in report
        },
        "macro_f1": round(report["macro avg"]["f1-score"], 4),
        "weighted_f1": round(report["weighted avg"]["f1-score"], 4),
        "note": (
            "RANDOM WEIGHT MODEL — do not cite these numbers"
            if top1 < random_chance * 2
            else "Trained model evaluation"
        ),
    }

    metrics_path = output_dir / "metrics.json"
    metrics_path.write_text(json.dumps(metrics, indent=2))
    log.info("Metrics saved: %s", metrics_path)


if __name__ == "__main__":
    main()
