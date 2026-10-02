#!/usr/bin/env python3
"""Copy one held-out test image per class into fixtures/disease/known_good/."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "ml" / "configs" / "disease_v1.yaml"


def load_config() -> dict:
    with CONFIG_PATH.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def main() -> int:
    cfg = load_config()
    split_path = ROOT / cfg["paths"]["split_manifest"]
    data_root = ROOT / cfg["paths"]["data_dir"]
    fixture_dir = ROOT / "fixtures" / "disease" / "known_good"
    fixture_dir.mkdir(parents=True, exist_ok=True)

    split_doc = json.loads(split_path.read_text(encoding="utf-8"))
    test_entries = split_doc["splits"]["test"]
    manifest = json.loads((ROOT / cfg["paths"]["manifest"]).read_text(encoding="utf-8"))

    copied: dict[str, str] = {}
    for cls in cfg["classes"]:
        cls_test = [e for e in test_entries if e["class"] == cls]
        if not cls_test:
            print(f"No test image for {cls}", file=sys.stderr)
            continue
        entry = cls_test[0]
        src = data_root / entry["path"]
        dst = fixture_dir / f"{cls}.jpg"
        shutil.copy2(src, dst)
        copied[cls] = str(dst.relative_to(ROOT))

    readme = ROOT / "fixtures" / "disease" / "README.md"
    readme.write_text(
        "\n".join(
            [
                "# Disease diagnosis fixtures",
                "",
                "Known-good rice leaf images for manual QA and demo uploads.",
                "",
                "## Source",
                "",
                f"- Dataset: [{manifest.get('dataset')}]({manifest['source']['hf_card']})",
                f"- Paper: {manifest['source']['paper']}",
                f"- IEEE DataPort: {manifest['source']['ieee_dataport']}",
                f"- License: {manifest['source']['license_note']}",
                "",
                "Citation: Petchiammal, S., et al. (2022/2023). *Paddy Doctor.* "
                "https://doi.org/10.21227/hz4v-af08",
                "",
                "## known_good/",
                "",
                "One image per class copied from the **test split only** (not used in training).",
                "",
                "| File | Class | SHA-256 (source) |",
                "|------|-------|------------------|",
            ]
            + [
                f"| `{cls}.jpg` | {cls} | `{next(e['sha256'] for e in test_entries if e['class']==cls)}` |"
                for cls in copied
            ]
            + [""]
        ),
        encoding="utf-8",
    )
    print(json.dumps({"copied": copied}, indent=2))
    return 0 if len(copied) == len(cfg["classes"]) else 1


if __name__ == "__main__":
    sys.exit(main())
