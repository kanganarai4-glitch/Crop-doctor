"""
train_mobilenet.py
==================
Two-stage transfer-learning training for MobileNetV3Small (on-device model).

Follows the same two-stage recipe as EfficientNet but targets a smaller,
TFLite-exportable architecture. The trained model is converted by convert_tflite.py.

Usage:
    python ml/train_mobilenet.py \
        --data_dir /path/to/dataset \
        --output_dir ml/models \
        [--epochs_head 10] [--epochs_finetune 20] [--batch_size 32]

See ml/PREPROCESSING_SPEC.md for the mandatory preprocessing contract.
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
    p = argparse.ArgumentParser(description="Train MobileNetV3Small for crop disease diagnosis")
    p.add_argument("--data_dir", required=True)
    p.add_argument("--output_dir", default=str(ML_DIR / "models"))
    p.add_argument("--epochs_head", type=int, default=10)
    p.add_argument("--epochs_finetune", type=int, default=20)
    p.add_argument("--batch_size", type=int, default=32)
    p.add_argument("--seed", type=int, default=42)
    return p.parse_args()


def build_augmentation_pipeline():
    import tensorflow as tf
    return tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal_and_vertical"),
        tf.keras.layers.RandomRotation(0.25),
        tf.keras.layers.RandomZoom(0.2),
        tf.keras.layers.RandomTranslation(0.1, 0.1),
        tf.keras.layers.RandomBrightness(0.3),
        tf.keras.layers.RandomContrast(0.3),
    ], name="augmentation")


def build_model(num_classes: int):
    """
    MobileNetV3Small with ImageNet weights + include_preprocessing=True.
    Input: raw 0-255 float32 (preprocessing is inside the model).
    """
    import tensorflow as tf

    inputs = tf.keras.Input(shape=(*IMG_SIZE, 3), name="input_image")
    augmented = build_augmentation_pipeline()(inputs, training=True)

    base = tf.keras.applications.MobileNetV3Small(
        include_top=False,
        weights="imagenet",
        input_tensor=augmented,
        pooling="avg",
        include_preprocessing=True,   # Built-in rescaling to [-1, 1]
    )
    base.trainable = False  # Stage 1: freeze base

    x = base.output
    x = tf.keras.layers.Dropout(0.2, name="top_dropout")(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    return tf.keras.Model(inputs=inputs, outputs=outputs, name="mobilenetv3small_cropdoctor")


def main():
    args = parse_args()

    try:
        import tensorflow as tf
        import numpy as np
        from sklearn.utils.class_weight import compute_class_weight
    except ImportError:
        log.error("Missing deps. Run: pip install tensorflow-cpu numpy scikit-learn")
        sys.exit(1)

    log.info("TensorFlow %s", tf.__version__)
    data_dir = pathlib.Path(args.data_dir)
    output_dir = pathlib.Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    common_kwargs = dict(
        image_size=IMG_SIZE,
        batch_size=args.batch_size,
        label_mode="categorical",
        class_names=CLASSES,
        seed=args.seed,
    )

    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir / "train", **common_kwargs
    ).prefetch(tf.data.AUTOTUNE)

    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir / "val", **common_kwargs
    ).prefetch(tf.data.AUTOTUNE)

    # Class weights
    train_ds_raw = tf.keras.utils.image_dataset_from_directory(
        data_dir / "train", batch_size=None, label_mode="categorical",
        class_names=CLASSES, seed=args.seed
    )
    all_labels = [int(tf.argmax(y).numpy()) for _, y in train_ds_raw]
    cw_values = compute_class_weight("balanced", classes=np.arange(NUM_CLASSES), y=all_labels)
    class_weights = dict(enumerate(cw_values))

    # ── Stage 1 ────────────────────────────────────────────────────
    log.info("Stage 1: Training head …")
    model = build_model(NUM_CLASSES)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy", tf.keras.metrics.TopKCategoricalAccuracy(k=3, name="top3_acc")],
    )

    model.fit(
        train_ds, epochs=args.epochs_head, validation_data=val_ds,
        class_weight=class_weights,
        callbacks=[
            tf.keras.callbacks.ModelCheckpoint(
                str(output_dir / "mobilenet_best_head.keras"),
                save_best_only=True, monitor="val_accuracy"),
            tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
        ],
    )

    # ── Stage 2 ────────────────────────────────────────────────────
    log.info("Stage 2: Fine-tuning top blocks at lr=1e-5 …")
    base_layer = model.get_layer("MobileNetV3Small")
    for layer in base_layer.layers[-20:]:
        if not isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = True

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy", tf.keras.metrics.TopKCategoricalAccuracy(k=3, name="top3_acc")],
    )

    model.fit(
        train_ds, epochs=args.epochs_finetune, validation_data=val_ds,
        class_weight=class_weights,
        callbacks=[
            tf.keras.callbacks.ModelCheckpoint(
                str(output_dir / "mobilenet_best_finetune.keras"),
                save_best_only=True, monitor="val_accuracy"),
            tf.keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True),
            tf.keras.callbacks.TensorBoard(log_dir=str(output_dir / "tb_logs_mobilenet")),
        ],
    )

    final_path = output_dir / "mobilenet_final.keras"
    model.save(str(final_path))
    log.info("Final MobileNet model saved: %s", final_path)
    log.info("Next: run ml/convert_tflite.py to quantize and export .tflite")


if __name__ == "__main__":
    main()
