import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps

from app.config import settings

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _detect_image_kind(raw: bytes) -> str | None:
    if raw.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if raw[:4] == b"RIFF" and len(raw) >= 12 and raw[8:12] == b"WEBP":
        return "webp"
    return None


async def read_and_validate_image(upload: UploadFile) -> bytes:
    raw = await upload.read()
    if len(raw) > settings.upload_max_bytes:
        raise HTTPException(status_code=400, detail="Ukuran file melebihi batas 10 MiB")
    kind = _detect_image_kind(raw)
    if kind is None:
        raise HTTPException(status_code=400, detail="Format gambar tidak didukung")
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
        image = ImageOps.exif_transpose(image)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Gambar tidak valid") from exc
    if image.width * image.height > settings.upload_max_pixels:
        raise HTTPException(status_code=400, detail="Dimensi gambar melebihi batas")
    clean = Image.new("RGB", image.size)
    clean.paste(image.convert("RGB"))
    buf = io.BytesIO()
    clean.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def write_temp_upload(data: bytes, upload_dir: Path) -> Path:
    upload_dir.mkdir(parents=True, exist_ok=True)
    path = upload_dir / f"{uuid.uuid4()}.jpg"
    path.write_bytes(data)
    return path


def cleanup_path(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass
