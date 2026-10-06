"""
ml/tests/test_preprocessing_parity.py
──────────────────────────────────────
Unit test: verify that the Python preprocessing path produces the same
numerical result that the JS Web Worker produces.

Because we cannot run JS from Python, the test verifies the PYTHON side
contract and saves a reference numpy array that the Jest test compares
against (in Phase 7 the web test loads this .npy and checks pixel values).

Run:
    cd /project/root
    python -m pytest ml/tests/test_preprocessing_parity.py -v

Full implementation in Phase 7. Skeleton shows structure.
"""

import pathlib
import pytest
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
REFERENCE_PATH = ROOT / "ml" / "tests" / "reference_input.npy"
REFERENCE_PIXELS_PATH = ROOT / "ml" / "tests" / "reference_pixels.npy"

IMG_SIZE = (224, 224)
EXPECTED_SHAPE = (1, 224, 224, 3)
PIXEL_MIN = 0.0
PIXEL_MAX = 255.0


def _preprocess_python(image_array: np.ndarray) -> np.ndarray:
    """
    Reference Python preprocessing — must match PREPROCESSING_SPEC.md.
    Input: (H, W, 3) uint8 array
    Output: (1, 224, 224, 3) float32 with values 0-255
    """
    from PIL import Image
    img = Image.fromarray(image_array).convert("RGB")
    img = img.resize(IMG_SIZE, Image.BILINEAR)
    arr = np.array(img, dtype=np.float32)       # (224, 224, 3)
    return np.expand_dims(arr, 0)                # (1, 224, 224, 3)


def test_output_shape():
    """Preprocessing output must be (1, 224, 224, 3)."""
    dummy = np.random.randint(0, 256, (300, 400, 3), dtype=np.uint8)
    result = _preprocess_python(dummy)
    assert result.shape == EXPECTED_SHAPE, f"Expected {EXPECTED_SHAPE}, got {result.shape}"


def test_pixel_range_not_normalized():
    """
    Pixel values MUST be in [0, 255].
    If any value is in (0, 1) range, normalisation was incorrectly applied.
    """
    dummy = np.random.randint(128, 256, (224, 224, 3), dtype=np.uint8)
    result = _preprocess_python(dummy)
    assert result.max() > 1.0, (
        "Pixels appear to be in [0,1] range — normalisation was incorrectly applied. "
        "See PREPROCESSING_SPEC.md."
    )
    assert result.max() <= 255.0, f"Pixel value exceeds 255: {result.max()}"
    assert result.min() >= 0.0, f"Negative pixel value: {result.min()}"


def test_dtype_is_float32():
    """Output dtype must be float32 for TensorFlow inference."""
    dummy = np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)
    result = _preprocess_python(dummy)
    assert result.dtype == np.float32, f"Expected float32, got {result.dtype}"


def test_rgb_channel_order():
    """First channel should be Red — verify by constructing a pure-red image."""
    red_image = np.zeros((224, 224, 3), dtype=np.uint8)
    red_image[:, :, 0] = 255   # R=255, G=0, B=0
    result = _preprocess_python(red_image)
    assert result[0, :, :, 0].mean() > 200, "Channel 0 (Red) should be high for a red image"
    assert result[0, :, :, 1].mean() < 10,  "Channel 1 (Green) should be ~0 for a red image"
    assert result[0, :, :, 2].mean() < 10,  "Channel 2 (Blue) should be ~0 for a red image"


def test_save_reference_array():
    """
    Save a fixed-seed reference input and its preprocessed form to .npy files.
    These files are used by the Phase 7 JS test to verify cross-platform parity.
    """
    rng = np.random.default_rng(seed=42)
    raw = rng.integers(0, 256, (300, 400, 3), dtype=np.uint8)
    preprocessed = _preprocess_python(raw)

    REFERENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    np.save(str(REFERENCE_PATH), raw)
    np.save(str(REFERENCE_PIXELS_PATH), preprocessed)

    # Reload and verify roundtrip
    loaded = np.load(str(REFERENCE_PIXELS_PATH))
    np.testing.assert_array_almost_equal(preprocessed, loaded, decimal=3)
