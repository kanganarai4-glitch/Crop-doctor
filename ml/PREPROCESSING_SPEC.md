# Preprocessing Specification
# ============================
# **Version**: 1.0.0  
# **Status**: NORMATIVE — all services MUST follow this exactly.
#
# ## The Rule
#
# | Step | Value |
# |------|-------|
# | Resize | 224 × 224 pixels (bilinear interpolation) |
# | Color | RGB (not BGR) |
# | Dtype | float32 |
# | Pixel range | **0 – 255** (raw uint8 cast to float32) |
# | Normalisation | NONE by caller — the Keras model's own preprocessing layer handles it internally |
#
# ## Why this matters
#
# EfficientNetB0 and MobileNetV3 include a built-in Keras `Rescaling` /
# `Normalization` layer as the very first layer in the model graph.  
# If a caller also rescales to [0, 1] or [-1, 1] the model will receive
# double-normalised input and silently produce garbage predictions.
#
# ## Per-service implementation
#
# ### Training (ml/train_efficientnet.py, ml/train_mobilenet.py)
# ```python
# # tf.keras.utils.image_dataset_from_directory with NO rescaling layer
# ds = tf.keras.utils.image_dataset_from_directory(
#     path, image_size=(224, 224), batch_size=32,
#     label_mode="categorical"
# )
# # augmentation applied BEFORE the model; values still 0-255
# ```
#
# ### FastAPI inference (inference-service/app/main.py)
# ```python
# from PIL import Image
# import numpy as np
#
# def preprocess(image_bytes: bytes) -> np.ndarray:
#     img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
#     img = img.resize((224, 224), Image.BILINEAR)
#     arr = np.array(img, dtype=np.float32)   # shape (224, 224, 3)  values 0-255
#     return np.expand_dims(arr, 0)           # shape (1, 224, 224, 3)
# ```
#
# ### React PWA Web Worker (web/src/workers/inferenceWorker.js)
# ```js
# // Using @tensorflow/tfjs-tflite
# const tensor = tf.browser.fromPixels(imageElement)   // uint8
#     .resizeBilinear([224, 224])
#     .toFloat()                                        // values 0-255
#     .expandDims(0);                                   // [1, 224, 224, 3]
# // Do NOT divide by 255
# ```
#
# ## Unit test (ml/tests/test_preprocessing_parity.py)
# Generates a fixed random 224×224 RGB image, runs preprocessing through
# the Python path and (via saved numpy array) asserts values are identical
# to what the JS Worker would produce. See that file for the full test.
#
# ## Dataset source split rule
# To avoid near-duplicate leakage between PlantVillage (lab) and PlantDoc (field):
# - Train set  : PlantVillage 80% + PlantDoc 80%
# - Val set    : PlantVillage 10% + PlantDoc 10%  (same-domain val)
# - Test set   : PlantDoc 10% ONLY                 (out-of-domain test — harder)
#
# Accuracy reported on the out-of-domain test set only.
