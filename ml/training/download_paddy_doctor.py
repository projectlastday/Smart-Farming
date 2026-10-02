#!/usr/bin/env python3
"""Download Paddy Doctor subset from Hugging Face and write manifest with SHA-256 hashes."""

from __future__ import annotations

import hashlib
import io
import json
import sys
from collections import Counter
from pathlib import Path

import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "ml" / "configs" / "disease_v1.yaml"

PRIMARY_DATASET = "Project-AgML/paddy_disease_classification"
FALLBACK_DATASET = "anthony2261/paddy-disease-classification"


def load_config() -> dict:
    with CONFIG_PATH.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_label(raw: str, label_map: dict[str, str]) -> str | None:
    key = raw.strip().lower().replace(" ", "_").replace("-", "_")
    if key in label_map:
        return label_map[key]
    # tolerate common aliases
    aliases = {
        "bacterial_blight": "bacterial_leaf_blight",
        "bacterialleafblight": "bacterial_leaf_blight",
        "brownspot": "brown_spot",
    }
    key = aliases.get(key, key)
    return label_map.get(key)


def try_download_dataset(repo_id: str) -> tuple[list[dict], dict]:
    """Return list of {class, image_bytes} and download metadata."""
    from datasets import load_dataset

    print(f"Attempting download: {repo_id}")
    ds = load_dataset(repo_id, split="train")
    label_names: list[str] | None = None
    if "label" in ds.features and hasattr(ds.features["label"], "names"):
        label_names = list(ds.features["label"].names)

    rows: list[dict] = []
    for i, row in enumerate(ds):
        label_raw = None
        for key in ("label", "labels", "class", "disease", "category"):
            if key in row and row[key] is not None:
                val = row[key]
                if isinstance(val, int) and label_names is not None:
                    label_raw = label_names[val]
                else:
                    label_raw = val
                break

        image = row.get("image") or row.get("img") or row.get("Image")
        if image is None:
            continue
        if hasattr(image, "convert"):
            buf = io.BytesIO()
            image.convert("RGB").save(buf, format="JPEG", quality=95)
            image_bytes = buf.getvalue()
        elif isinstance(image, dict) and "bytes" in image:
            image_bytes = image["bytes"]
        elif isinstance(image, (bytes, bytearray)):
            image_bytes = bytes(image)
        else:
            continue

        rows.append({"index": i, "label_raw": str(label_raw), "image_bytes": image_bytes})

    meta = {
        "repo_id": repo_id,
        "total_rows": len(rows),
        "hf_split": "train",
        "label_names": label_names,
    }
    return rows, meta


def deduplicate(rows: list[dict], label_map: dict[str, str], target_classes: list[str]) -> list[dict]:
    seen_hashes: set[str] = set()
    kept: list[dict] = []
    for row in rows:
        cls = normalize_label(row["label_raw"], label_map)
        if cls is None or cls not in target_classes:
            continue
        digest = sha256_bytes(row["image_bytes"])
        if digest in seen_hashes:
            continue
        seen_hashes.add(digest)
        kept.append({**row, "class": cls, "sha256": digest})
    return kept


def main() -> int:
    cfg = load_config()
    label_map = cfg["label_map"]
    target_classes = cfg["classes"]
    data_dir = ROOT / cfg["paths"]["data_dir"]
    images_dir = data_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = ROOT / cfg["paths"]["manifest"]

    errors: list[str] = []
    rows: list[dict] = []
    download_meta: dict = {}

    for repo_id in (PRIMARY_DATASET, FALLBACK_DATASET):
        try:
            rows, download_meta = try_download_dataset(repo_id)
            if rows:
                break
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{repo_id}: {type(exc).__name__}: {exc}")

    if not rows:
        blocked_doc = ROOT / "docs" / "model-disease.md"
        blocked_doc.parent.mkdir(parents=True, exist_ok=True)
        content = "# Disease model (v1)\n\n## Blocked\n\n"
        content += "Dataset download failed for both Hugging Face sources.\n\n"
        for err in errors:
            content += f"- {err}\n"
        blocked_doc.write_text(content, encoding="utf-8")
        print("BLOCKED: could not download dataset", file=sys.stderr)
        for err in errors:
            print(err, file=sys.stderr)
        return 1

    deduped = deduplicate(rows, label_map, target_classes)
    class_counts = Counter(r["class"] for r in deduped)

    manifest_entries: list[dict] = []
    total_bytes = 0
    for i, row in enumerate(deduped):
        rel_path = f"images/{row['class']}/{row['sha256'][:16]}.jpg"
        out_path = data_dir / rel_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        if not out_path.exists():
            # validate image
            img = Image.open(io.BytesIO(row["image_bytes"])).convert("RGB")
            img.save(out_path, format="JPEG", quality=95)
        file_hash = sha256_file(out_path)
        size = out_path.stat().st_size
        total_bytes += size
        manifest_entries.append(
            {
                "id": i,
                "path": rel_path,
                "class": row["class"],
                "label_raw": row["label_raw"],
                "sha256": file_hash,
                "size_bytes": size,
            }
        )

    manifest = {
        "dataset": download_meta.get("repo_id"),
        "source": {
            "paper": "Petchiammal et al. 2022/2023 — Paddy Doctor",
            "ieee_dataport": "10.21227/hz4v-af08",
            "hf_card": f"https://huggingface.co/datasets/{download_meta.get('repo_id')}",
            "license_note": (
                "HF dataset card has no SPDX license field. Original authors released "
                "Paddy Doctor open-source for community use (school/non-commercial). "
                "IEEE DataPort original archives require login."
            ),
        },
        "classes": target_classes,
        "label_map": label_map,
        "class_counts": dict(class_counts),
        "total_images": len(manifest_entries),
        "total_bytes": total_bytes,
        "dedup": "exact SHA-256 duplicates removed before split",
        "images": manifest_entries,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"ok": True, "manifest": str(manifest_path), "class_counts": dict(class_counts)}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
