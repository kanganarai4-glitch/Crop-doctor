"""
inference-service/app/gradcam.py
=================================
Grad-CAM implementation for EfficientNetB0.

Key implementation notes:
  1. EfficientNetB0 loaded via tf.keras.models.load_model() wraps the base model
     as a nested sub-model. The last conv layer ("top_activation") is INSIDE the
     nested base. We build a functional model that exposes that layer's output
     so tf.GradientTape can reach it.
  2. Severity is defined as: fraction of heatmap pixels with normalised value > 0.5.
     This is an ESTIMATE, not a clinical measure.
  3. Output: base64-encoded PNG of the original image blended with the red heatmap.
"""

import base64
import io
import logging

import numpy as np
from PIL import Image

log = logging.getLogger(__name__)

# Name of the last convolutional activation layer inside EfficientNetB0.
# The nested-model path is: outer_model -> efficientnetb0 -> top_activation
LAST_CONV_LAYER_NAME = "top_activation"


class GradCAMGenerator:
    def __init__(self, model, labels: list[str]):
        self._labels = labels
        self._grad_model = None
        self._build_grad_model(model)

    def _build_grad_model(self, outer_model) -> None:
        """
        Build a functional model that outputs BOTH:
          - the last conv layer activations (for gradient computation)
          - the final softmax predictions

        Handles the nested-base-model pitfall: EfficientNetB0 loaded from
        a SavedModel is a sub-model inside the outer classification model.
        """
        import tensorflow as tf

        try:
            # Try to find the layer in the outer model first
            last_conv = outer_model.get_layer(LAST_CONV_LAYER_NAME)
            inputs = outer_model.input
            conv_outputs = last_conv.output
            predictions = outer_model.output

        except ValueError:
            # Nested model: search inside the base sub-model
            base_model = None
            for layer in outer_model.layers:
                if hasattr(layer, "layers"):   # it's a sub-model
                    base_model = layer
                    break

            if base_model is None:
                raise RuntimeError(
                    f"Cannot find '{LAST_CONV_LAYER_NAME}' in model. "
                    "Check that EfficientNetB0 is part of the model graph."
                )

            last_conv = base_model.get_layer(LAST_CONV_LAYER_NAME)
            # Build a sub-model from the nested base to expose the conv layer
            sub_model = tf.keras.Model(
                inputs=base_model.input,
                outputs=[last_conv.output, base_model.output],
                name="efficientnet_gradcam_sub",
            )

            # Wrap: outer input → sub_model → classification head
            inputs = outer_model.input
            conv_sub_out, base_out = sub_model(inputs)

            # Reconstruct the classification head (layers after the base model)
            head_layers = [
                l for l in outer_model.layers
                if l not in base_model.layers and l.name != outer_model.input.name
            ]
            x = base_out
            for layer in head_layers:
                try:
                    x = layer(x)
                except (TypeError, ValueError, AttributeError, RuntimeError) as err:
                    log.debug("Skipping non-executable head layer: %s", err)

            conv_outputs = conv_sub_out
            predictions = x

        self._grad_model = tf.keras.Model(
            inputs=inputs,
            outputs=[conv_outputs, predictions],
            name="gradcam_model",
        )
        log.info("Grad-CAM functional model built. Conv output shape: %s", conv_outputs.shape)

    def generate(self, tensor: np.ndarray, original_image: Image.Image) -> dict:
        """
        Run Grad-CAM on the tensor and return heatmap overlay as base64 PNG.

        Args:
            tensor:         Preprocessed input (1, 224, 224, 3) float32, values 0-255
            original_image: Original PIL Image (for overlay, any size)

        Returns dict:
            heatmapImage  : base64 PNG string
            severity      : float 0-1 (estimated fraction of affected area)
            label         : predicted class label (str)
            confidence    : float
        """
        import tensorflow as tf

        with tf.GradientTape() as tape:
            tf_tensor = tf.cast(tensor, tf.float32)
            tape.watch(tf_tensor)
            conv_outputs, predictions = self._grad_model(tf_tensor, training=False)
            top_class = int(tf.argmax(predictions[0]))
            class_score = predictions[:, top_class]

        # Gradients of the top-class score w.r.t. the last conv layer outputs
        grads = tape.gradient(class_score, conv_outputs)    # (1, H, W, C)

        # Global average pool the gradients → channel weights
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))  # (C,)

        # Weight the conv output channels
        conv_out = conv_outputs[0]                             # (H, W, C)
        cam = tf.reduce_sum(tf.multiply(pooled_grads, conv_out), axis=-1)  # (H, W)

        # ReLU + normalise to [0, 1]
        cam_np = cam.numpy()
        cam_np = np.maximum(cam_np, 0)
        if cam_np.max() > 0:
            cam_np = cam_np / cam_np.max()

        # ── Severity estimate ─────────────────────────────────────
        severity = float(np.mean(cam_np > 0.5))

        # ── Build overlay ─────────────────────────────────────────
        heatmap_pil = Image.fromarray(np.uint8(cam_np * 255)).resize(
            original_image.size, Image.BILINEAR
        )

        # Colorise: red-hot mapping
        heatmap_rgba = _apply_colormap(np.array(heatmap_pil))

        orig_rgba = original_image.convert("RGBA")
        heatmap_img = Image.fromarray(heatmap_rgba).convert("RGBA")
        overlay = Image.blend(orig_rgba, heatmap_img, alpha=0.45)

        # ── Encode to base64 PNG ──────────────────────────────────
        buf = io.BytesIO()
        overlay.convert("RGB").save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        confidence = float(predictions[0, top_class])

        return {
            "heatmapImage": f"data:image/png;base64,{b64}",
            "severity": round(severity, 3),
            "severityLabel": _severity_label(severity),
            "label": self._labels[top_class],
            "confidence": round(confidence, 4),
            "note": (
                "Severity is an estimate based on the fraction of high-activation "
                "heatmap pixels. It is NOT a clinical measurement."
            ),
        }


def _apply_colormap(gray: np.ndarray) -> np.ndarray:
    """Apply a red-heat colormap to a 2-D uint8 grayscale array."""
    r = gray
    g = np.zeros_like(gray)
    b = np.zeros_like(gray)
    a = (gray * 0.8).astype(np.uint8)  # semi-transparent where hot
    return np.stack([r, g, b, a], axis=-1)


def _severity_label(severity: float) -> str:
    if severity < 0.15:
        return "low"
    if severity < 0.40:
        return "moderate"
    if severity < 0.65:
        return "high"
    return "severe"
