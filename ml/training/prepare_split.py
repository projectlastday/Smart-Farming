#!/usr/bin/env python3
"""Stratified train/val/test split with per-class caps (seed 42)."""

from __future__ import annotations

import json
import random
import sys
from collections import defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "ml" / "configs" / "disease_v1.yaml"


def load_config() -> dict:
    with CONFIG_PATH.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def cap_split(items: list[dict], ratios: dict[str, float], caps: dict[str, int], seed: int) -> dict[str, list[dict]]:
    rng = random.Random(seed)
    shuffled = items[:]
    rng.shuffle(shuffled)
    n = len(shuffled)
    n_train = int(n * ratios["train"])
    n_val = int(n * ratios["val"])
    train = shuffled[:n_train]
    val = shuffled[n_train : n_train + n_val]
    test = shuffled[n_train + n_val :]
    return {
        "train": train[: caps["train"]],
        "val": val[: caps["val"]],
        "test": test[: caps["test"]],
    }


def main() -> int:
    cfg = load_config()
    manifest_path = ROOT / cfg["paths"]["manifest"]
    split_path = ROOT / cfg["paths"]["split_manifest"]
    if not manifest_path.exists():
        print(f"Missing manifest: {manifest_path}", file=sys.stderr)
        return 1

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    by_class: dict[str, list[dict]] = defaultdict(list)
    for entry in manifest["images"]:
        by_class[entry["class"]].append(entry)

    seed = cfg["seed"]
    ratios = cfg["split_ratios"]
    caps = cfg["max_per_class"]

    splits: dict[str, list[dict]] = {"train": [], "val": [], "test": []}
    per_class_counts: dict[str, dict[str, int]] = {}

    for cls in cfg["classes"]:
        cls_items = by_class.get(cls, [])
        if not cls_items:
            print(f"WARNING: no images for class {cls}", file=sys.stderr)
            per_class_counts[cls] = {"train": 0, "val": 0, "test": 0}
            continue
        cls_splits = cap_split(cls_items, ratios, caps, seed + hash(cls) % 10000)
        for split_name in ("train", "val", "test"):
            splits[split_name].extend(cls_splits[split_name])
        per_class_counts[cls] = {k: len(v) for k, v in cls_splits.items()}

    # Ensure no SHA appears in both train and test
    train_hashes = {e["sha256"] for e in splits["train"]}
    test_hashes = {e["sha256"] for e in splits["test"]}
    overlap = train_hashes & test_hashes
    if overlap:
        print(f"ERROR: {len(overlap)} hashes in both train and test", file=sys.stderr)
        return 1

    split_doc = {
        "seed": seed,
        "ratios": ratios,
        "caps": caps,
        "per_class_counts": per_class_counts,
        "totals": {k: len(v) for k, v in splits.items()},
        "splits": splits,
    }
    split_path.write_text(json.dumps(split_doc, indent=2), encoding="utf-8")
    print(json.dumps({"ok": True, "totals": split_doc["totals"], "per_class": per_class_counts}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
