#!/usr/bin/env python3
"""Train MobileNetV3-Small on Paddy Doctor subset."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import torch
import torch.nn as nn
import yaml
from PIL import Image
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
        label = entry["class_idx"]
        return self.transform(image), label


def build_model(num_classes: int, pretrained: bool) -> nn.Module:
    weights = models.MobileNet_V3_Small_Weights.IMAGENET1K_V1 if pretrained else None
    model = models.mobilenet_v3_small(weights=weights)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_classes)
    return model


def main() -> int:
    cfg = load_config()
    split_path = ROOT / cfg["paths"]["split_manifest"]
    if not split_path.exists():
        print("Run prepare_split.py first", file=sys.stderr)
        return 1

    split_doc = json.loads(split_path.read_text(encoding="utf-8"))
    classes = cfg["classes"]
    class_to_idx = {c: i for i, c in enumerate(classes)}
    data_root = ROOT / cfg["paths"]["data_dir"]

    for split_name in ("train", "val", "test"):
        for entry in split_doc["splits"][split_name]:
            entry["class_idx"] = class_to_idx[entry["class"]]

    size = cfg["image_size"]
    mean = cfg["mean"]
    std = cfg["std"]
    aug = cfg["augmentation"]

    train_tf = transforms.Compose(
        [
            transforms.Resize((size, size)),
            transforms.RandomHorizontalFlip(p=aug["horizontal_flip"]),
            transforms.RandomRotation(aug["rotation_degrees"]),
            transforms.ColorJitter(**aug["color_jitter"]),
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std),
        ]
    )
    eval_tf = transforms.Compose(
        [
            transforms.Resize((size, size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std),
        ]
    )

    train_ds = SplitDataset(split_doc["splits"]["train"], data_root, train_tf)
    val_ds = SplitDataset(split_doc["splits"]["val"], data_root, eval_tf)

    train_cfg = cfg["training"]
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    print(f"Train: {len(train_ds)}  Val: {len(val_ds)}")

    train_loader = DataLoader(
        train_ds,
        batch_size=train_cfg["batch_size"],
        shuffle=True,
        num_workers=train_cfg["num_workers"],
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=train_cfg["batch_size"],
        shuffle=False,
        num_workers=train_cfg["num_workers"],
    )

    torch.manual_seed(cfg["seed"])
    model = build_model(len(classes), cfg["pretrained"]).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=train_cfg["learning_rate"],
        weight_decay=train_cfg["weight_decay"],
    )

    ckpt_dir = ROOT / cfg["paths"]["checkpoint_dir"]
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path = ROOT / cfg["paths"]["checkpoint"]

    best_val_acc = 0.0
    history: list[dict] = []
    t0 = time.time()

    for epoch in range(1, train_cfg["epochs"] + 1):
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            logits = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * images.size(0)
            preds = logits.argmax(dim=1)
            train_correct += (preds == labels).sum().item()
            train_total += images.size(0)

        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                logits = model(images)
                preds = logits.argmax(dim=1)
                val_correct += (preds == labels).sum().item()
                val_total += images.size(0)

        train_acc = train_correct / max(train_total, 1)
        val_acc = val_correct / max(val_total, 1)
        epoch_info = {
            "epoch": epoch,
            "train_loss": train_loss / max(train_total, 1),
            "train_acc": train_acc,
            "val_acc": val_acc,
        }
        history.append(epoch_info)
        print(
            f"Epoch {epoch}/{train_cfg['epochs']} "
            f"loss={epoch_info['train_loss']:.4f} train_acc={train_acc:.4f} val_acc={val_acc:.4f}"
        )

        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "classes": classes,
                    "class_to_idx": class_to_idx,
                    "config": cfg,
                    "epoch": epoch,
                    "val_acc": val_acc,
                    "history": history,
                },
                ckpt_path,
            )

    elapsed = time.time() - t0
    print(f"Training done in {elapsed:.1f}s; best val_acc={best_val_acc:.4f}; checkpoint={ckpt_path}")
    return 0 if ckpt_path.exists() else 1


if __name__ == "__main__":
    sys.exit(main())
