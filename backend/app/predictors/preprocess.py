"""Shared image preprocessing for backend and training parity."""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
DEFAULT_SIZE = 224


def preprocess_image_bytes(
    image_bytes: bytes,
    *,
    size: int = DEFAULT_SIZE,
    mean: list[float] | np.ndarray | None = None,
    std: list[float] | np.ndarray | None = None,
) -> np.ndarray:
    image = Image.open(io.BytesIO(image_bytes))
    image.load()
    return preprocess_pil(image, size=size, mean=mean, std=std)


def preprocess_pil(
    image: Image.Image,
    *,
    size: int = DEFAULT_SIZE,
    mean: list[float] | np.ndarray | None = None,
    std: list[float] | np.ndarray | None = None,
) -> np.ndarray:
    mean_arr = np.array(mean if mean is not None else IMAGENET_MEAN, dtype=np.float32)
    std_arr = np.array(std if std is not None else IMAGENET_STD, dtype=np.float32)
    image = image.convert("RGB").resize((size, size), Image.Resampling.BILINEAR)
    arr = np.asarray(image, dtype=np.float32) / 255.0
    arr = (arr - mean_arr) / std_arr
    arr = np.transpose(arr, (2, 0, 1))
    return np.expand_dims(arr, axis=0).astype(np.float32)


def decode_rgb_no_exif(image_bytes: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(image_bytes))
    image.load()
    return image.convert("RGB")
