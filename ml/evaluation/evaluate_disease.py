#!/usr/bin/env python3
"""Evaluate trained disease model on held-out test split."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import torch
import yaml
from PIL import Image
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "ml" / "configs" / "disease_v1.yaml"


def load_config() -> dict:
    with CONFIG_PATH.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


class SplitDataset(Dataset):
    def __init__(self, entries: list[dict], data_root: Path, transform) -> None:
        self.entries = entries
        self.data_root = data_root
        self.transform = transform

    def __len__(self) -> int:
        return len(self.entries)

    def __getitem__(self, idx: int):
        entry = self.entries[idx]
        path = self.data_root / entry["path"]
        image = Image.open(path).convert("RGB")
        return self.transform(image), entry["class_idx"]


def build_model(num_classes: int) -> torch.nn.Module:
    model = models.mobilenet_v3_small(weights=None)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = torch.nn.Linear(in_features, num_classes)
    return model


def softmax_np(logits: np.ndarray) -> np.ndarray:
    exp = np.exp(logits - logits.max(axis=1, keepdims=True))
    return exp / exp.sum(axis=1, keepdims=True)


def calibrate_unknown_threshold(probs: np.ndarray, y_true: np.ndarray, cfg: dict) -> dict:
    """Pick threshold on validation max-softmax vs unknown-rate tradeoff."""
    ut = cfg["unknown_threshold"]
    thresholds = np.arange(ut["search_min"], ut["search_max"] + ut["search_step"] / 2, ut["search_step"])
    best = None
    rows = []
    for t in thresholds:
        max_p = probs.max(axis=1)
        unknown_mask = max_p < t
        known_mask = ~unknown_mask
        unknown_rate = float(unknown_mask.mean())
        if known_mask.sum() == 0:
            acc_known = 0.0
        else:
            preds = probs.argmax(axis=1)
            acc_known = float((preds[known_mask] == y_true[known_mask]).mean())
        row = {
            "threshold": round(float(t), 2),
            "unknown_rate": round(unknown_rate, 4),
            "accuracy_on_known": round(acc_known, 4),
        }
        rows.append(row)
        # prefer higher acc on known with unknown_rate <= 0.25
        score = acc_known - 0.5 * unknown_rate
        if best is None or score > best["score"]:
            best = {**row, "score": score}
    return {"chosen": best, "search": rows}


def write_docs(metrics: dict, cfg: dict, manifest: dict) -> None:
    doc_path = ROOT / "docs" / "model-disease.md"
    classes = cfg["classes"]
    lines = [
        "# Disease model (v1)",
        "",
        "## Provenance",
        "",
        f"- **Dataset**: [{manifest.get('dataset')}]({manifest['source']['hf_card']})",
        f"- **Paper**: {manifest['source']['paper']}",
        f"- **IEEE DataPort**: {manifest['source']['ieee_dataport']}",
        f"- **License**: {manifest['source']['license_note']}",
        "",
        "Citation: Petchiammal, S., et al. (2022/2023). *Paddy Doctor: A Visual Guide for "
        "Paddy Disease Detection and Classification.* IEEE DataPort. "
        "https://doi.org/10.21227/hz4v-af08",
        "",
        "## Training",
        "",
        f"- Architecture: MobileNetV3-Small (torchvision, ImageNet pretrained={cfg['pretrained']})",
        f"- Seed: {cfg['seed']}",
        f"- Image size: {cfg['image_size']}×{cfg['image_size']}",
        f"- Classes (order): `{classes}`",
        "- Label map: `normal` → `healthy`",
        "",
        "## Data split (after SHA-256 dedup)",
        "",
    ]
    split = metrics["split_totals"]
    lines.append(f"| Split | Count |")
    lines.append(f"|-------|-------|")
    for k, v in split.items():
        lines.append(f"| {k} | {v} |")
    lines.extend(
        [
            "",
            "## Test metrics",
            "",
            f"- **Accuracy**: {metrics['test_accuracy']:.4f}",
            f"- **Macro F1**: {metrics['test_macro_f1']:.4f}",
            f"- **Unknown threshold** (max-softmax): {metrics['unknown_threshold']}",
            "",
            "### Per-class (test)",
            "",
            "| Class | Precision | Recall | F1 |",
            "|-------|-----------|--------|-----|",
        ]
    )
    for cls in classes:
        pc = metrics["per_class"][cls]
        lines.append(
            f"| {cls} | {pc['precision']:.4f} | {pc['recall']:.4f} | {pc['f1']:.4f} |"
        )
    lines.extend(["", "### Confusion matrix (test)", "", "```"])
    lines.append(metrics["confusion_matrix_str"])
    lines.append("```")
    lines.extend(["", "### Unknown threshold calibration (validation)", ""])
    lines.append("| Threshold | Unknown rate | Acc (known) |")
    lines.append("|-----------|--------------|-------------|")
    for row in metrics["threshold_search"][:15]:
        mark = " **chosen**" if row["threshold"] == metrics["unknown_threshold"] else ""
        lines.append(
            f"| {row['threshold']}{mark} | {row['unknown_rate']} | {row['accuracy_on_known']} |"
        )
    lines.append("")
    doc_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    cfg = load_config()
    ckpt_path = ROOT / cfg["paths"]["checkpoint"]
    split_path = ROOT / cfg["paths"]["split_manifest"]
    manifest_path = ROOT / cfg["paths"]["manifest"]
    metrics_path = ROOT / cfg["paths"]["metrics"]

    if not ckpt_path.exists():
        print(f"Missing checkpoint: {ckpt_path}", file=sys.stderr)
        return 1

    split_doc = json.loads(split_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    classes = cfg["classes"]
    class_to_idx = {c: i for i, c in enumerate(classes)}
    data_root = ROOT / cfg["paths"]["data_dir"]

    for split_name in ("train", "val", "test"):
        for entry in split_doc["splits"][split_name]:
            entry["class_idx"] = class_to_idx[entry["class"]]

    size = cfg["image_size"]
    eval_tf = transforms.Compose(
        [
            transforms.Resize((size, size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=cfg["mean"], std=cfg["std"]),
        ]
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    model = build_model(len(classes))
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(device)
    model.eval()

    def run_split(entries: list[dict]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        ds = SplitDataset(entries, data_root, eval_tf)
        loader = DataLoader(ds, batch_size=32, shuffle=False)
        all_probs: list[np.ndarray] = []
        all_labels: list[int] = []
        with torch.no_grad():
            for images, labels in loader:
                images = images.to(device)
                logits = model(images)
                probs = torch.softmax(logits, dim=1).cpu().numpy()
                all_probs.append(probs)
                all_labels.extend(labels.tolist())
        return np.vstack(all_probs), np.array(all_labels), np.array([classes[i] for i in all_labels])

    val_probs, val_y, _ = run_split(split_doc["splits"]["val"])
    cal = calibrate_unknown_threshold(val_probs, val_y, cfg)
    chosen_threshold = cal["chosen"]["threshold"]

    test_probs, test_y_idx, test_y = run_split(split_doc["splits"]["test"])
    test_preds = test_probs.argmax(axis=1)

    acc = float(accuracy_score(test_y_idx, test_preds))
    macro_f1 = float(f1_score(test_y_idx, test_preds, average="macro", zero_division=0))
    report = classification_report(test_y_idx, test_preds, target_names=classes, output_dict=True, zero_division=0)
    cm = confusion_matrix(test_y_idx, test_preds)

    per_class = {
        cls: {
            "precision": report[cls]["precision"],
            "recall": report[cls]["recall"],
            "f1": report[cls]["f1-score"],
        }
        for cls in classes
    }

    cm_str = "          " + "  ".join(f"{c[:8]:>8}" for c in classes) + "\n"
    for i, row in enumerate(cm):
        cm_str += f"{classes[i][:10]:10}" + "".join(f"{v:8d}" for v in row) + "\n"

    metrics = {
        "split_totals": split_doc["totals"],
        "per_class_counts": split_doc["per_class_counts"],
        "test_accuracy": acc,
        "test_macro_f1": macro_f1,
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
        "confusion_matrix_str": cm_str.strip(),
        "unknown_threshold": chosen_threshold,
        "threshold_calibration": cal,
        "threshold_search": cal["search"],
        "best_val_acc": ckpt.get("val_acc"),
        "checkpoint_epoch": ckpt.get("epoch"),
    }

    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    write_docs(metrics, cfg, manifest)
    print(json.dumps({"test_accuracy": acc, "macro_f1": macro_f1, "threshold": chosen_threshold}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
