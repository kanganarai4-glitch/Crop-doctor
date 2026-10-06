"""
train_efficientnet.py
=====================
Two-stage transfer-learning training for EfficientNetB0 (server model).

Stage 1 – Head only:   Freeze base, train new classification head for N epochs.
Stage 2 – Fine-tune:   Unfreeze top blocks, train at lr=1e-5 for M epochs.

Requires:
    pip install tensorflow-cpu pillow numpy scikit-learn matplotlib

Usage:
    python ml/train_efficientnet.py \
        --data_dir /path/to/dataset \
        --output_dir ml/models \
        [--epochs_head 10] [--epochs_finetune 20] [--batch_size 32]

Dataset layout expected by tf.keras.utils.image_dataset_from_directory:
    data_dir/
        <class_label>/
            img1.jpg ...

The class labels in the directory MUST exactly match ml/labels.json["classes"].

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
    p = argparse.ArgumentParser(description="Train EfficientNetB0 for crop disease diagnosis")
    p.add_argument("--data_dir", required=True, help="Root directory of image dataset")
    p.add_argument("--output_dir", default=str(ML_DIR / "models"))
    p.add_argument("--epochs_head", type=int, default=10, help="Stage 1 epochs (head only)")
    p.add_argument("--epochs_finetune", type=int, default=20, help="Stage 2 fine-tune epochs")
    p.add_argument("--batch_size", type=int, default=32)
    p.add_argument("--seed", type=int, default=42)
    return p.parse_args()


def build_augmentation_pipeline():
    """
    Heavy augmentation to close the lab→field domain gap.
    Applied BEFORE the model so values remain in 0-255 range.
    """
    import tensorflow as tf

    return tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal_and_vertical"),
        tf.keras.layers.RandomRotation(0.25),
        tf.keras.layers.RandomZoom(0.2),
        tf.keras.layers.RandomTranslation(0.1, 0.1),
        tf.keras.layers.RandomBrightness(0.3),
        tf.keras.layers.RandomContrast(0.3),
        # Gaussian blur proxy via average pooling + upscale (TF-native)
        # For real blur, use tf-addons GaussianBlur or albumentations
    ], name="augmentation")


def build_model(num_classes: int):
    """
    EfficientNetB0 with ImageNet weights.
    Input: raw 0-255 float32 tensor (preprocessing inside model).
    """
    import tensorflow as tf

    inputs = tf.keras.Input(shape=(*IMG_SIZE, 3), name="input_image")
    augmented = build_augmentation_pipeline()(inputs, training=True)

    base = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_tensor=augmented,
        pooling="avg",
    )
    base.trainable = False  # Stage 1: freeze base

    x = base.output
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.3, name="top_dropout")(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    return tf.keras.Model(inputs=inputs, outputs=outputs, name="efficientnetb0_cropdoctor")


def compute_class_weights(dataset) -> dict:
    """Compute inverse-frequency class weights to handle dataset imbalance."""
    import numpy as np
    from sklearn.utils.class_weight import compute_class_weight

    all_labels = []
    for _, labels in dataset.unbatch():
        all_labels.append(int(tf_argmax(labels)))

    import tensorflow as tf
    classes_arr = list(range(NUM_CLASSES))
    weights = compute_class_weight("balanced", classes=classes_arr, y=all_labels)
    return dict(enumerate(weights))


def tf_argmax(label_tensor):
    import tensorflow as tf
    return tf.argmax(label_tensor).numpy()


def main():
    args = parse_args()

    try:
        import tensorflow as tf
        import numpy as np
    except ImportError:
        log.error("Missing dependencies. Run: pip install tensorflow-cpu numpy scikit-learn")
        sys.exit(1)

    log.info("TensorFlow %s", tf.__version__)
    data_dir = pathlib.Path(args.data_dir)
    output_dir = pathlib.Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Load datasets ─────────────────────────────────────────────
    # NOTE: No rescaling here — EfficientNetB0 handles normalisation internally.
    #       See PREPROCESSING_SPEC.md for the full contract.
    common_kwargs = dict(
        image_size=IMG_SIZE,
        batch_size=args.batch_size,
        label_mode="categorical",
        class_names=CLASSES,       # Enforce label order from labels.json
        seed=args.seed,
    )

    log.info("Loading training split …")
    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir / "train", **common_kwargs
    ).prefetch(tf.data.AUTOTUNE)

    log.info("Loading validation split …")
    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir / "val", **common_kwargs
    ).prefetch(tf.data.AUTOTUNE)

    # ── Compute class weights ─────────────────────────────────────
    log.info("Computing class weights for imbalanced dataset …")
    # Rebuild an unbatched dataset for label counting
    train_ds_unbatch = tf.keras.utils.image_dataset_from_directory(
        data_dir / "train", batch_size=None, label_mode="categorical",
        class_names=CLASSES, seed=args.seed
    )
    all_labels = [int(tf.argmax(y).numpy()) for _, y in train_ds_unbatch]
    from sklearn.utils.class_weight import compute_class_weight
    import numpy as np
    cw_values = compute_class_weight("balanced", classes=np.arange(NUM_CLASSES), y=all_labels)
    class_weights = dict(enumerate(cw_values))
    log.info("Class weights computed for %d classes", len(class_weights))

    # ── Stage 1: Train head only ──────────────────────────────────
    log.info("Stage 1: Training classification head …")
    model = build_model(NUM_CLASSES)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy", tf.keras.metrics.TopKCategoricalAccuracy(k=3, name="top3_acc")],
    )

    callbacks_s1 = [
        tf.keras.callbacks.ModelCheckpoint(
            str(output_dir / "efficientnet_best_head.keras"),
            save_best_only=True, monitor="val_accuracy", verbose=1
        ),
        tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=3, min_lr=1e-6),
    ]

    model.fit(
        train_ds,
        epochs=args.epochs_head,
        validation_data=val_ds,
        class_weight=class_weights,
        callbacks=callbacks_s1,
    )

    # ── Stage 2: Fine-tune top blocks ─────────────────────────────
    log.info("Stage 2: Fine-tuning top blocks at lr=1e-5 …")
    base_layer = model.get_layer("efficientnetb0")
    # Unfreeze the top 30 layers of the base model
    for layer in base_layer.layers[-30:]:
        if not isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = True

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy", tf.keras.metrics.TopKCategoricalAccuracy(k=3, name="top3_acc")],
    )

    callbacks_s2 = [
        tf.keras.callbacks.ModelCheckpoint(
            str(output_dir / "efficientnet_best_finetune.keras"),
            save_best_only=True, monitor="val_accuracy", verbose=1
        ),
        tf.keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(factor=0.3, patience=4, min_lr=1e-7),
        tf.keras.callbacks.TensorBoard(log_dir=str(output_dir / "tb_logs_efficientnet")),
    ]

    model.fit(
        train_ds,
        epochs=args.epochs_finetune,
        validation_data=val_ds,
        class_weight=class_weights,
        callbacks=callbacks_s2,
    )

    # ── Save final model ──────────────────────────────────────────
    final_path = output_dir / "efficientnet_final.keras"
    model.save(str(final_path))
    log.info("Final model saved: %s", final_path)
    log.info("Training complete. Run ml/evaluate.py to generate accuracy and confusion matrix.")


if __name__ == "__main__":
    main()
