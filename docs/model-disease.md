# Disease model (v1)

## Provenance

- **Dataset**: [Project-AgML/paddy_disease_classification](https://huggingface.co/datasets/Project-AgML/paddy_disease_classification)
- **Paper**: Petchiammal et al. 2022/2023 — Paddy Doctor
- **IEEE DataPort**: 10.21227/hz4v-af08
- **License**: HF dataset card has no SPDX license field. Original authors released Paddy Doctor open-source for community use (school/non-commercial). IEEE DataPort original archives require login.

Citation: Petchiammal, S., et al. (2022/2023). *Paddy Doctor: A Visual Guide for Paddy Disease Detection and Classification.* IEEE DataPort. https://doi.org/10.21227/hz4v-af08

## Training

- Architecture: MobileNetV3-Small (torchvision, ImageNet pretrained=True)
- Seed: 42
- Image size: 224×224
- Classes (order): `['healthy', 'blast', 'brown_spot', 'bacterial_leaf_blight', 'tungro']`
- Label map: `normal` → `healthy`

## Data split (after SHA-256 dedup)

| Split | Count |
|-------|-------|
| train | 1250 |
| val | 200 |
| test | 200 |

## Test metrics

- **Accuracy**: 0.8800
- **Macro F1**: 0.8805
- **Unknown threshold** (max-softmax): 0.52

### Per-class (test)

| Class | Precision | Recall | F1 |
|-------|-----------|--------|-----|
| healthy | 0.9250 | 0.9250 | 0.9250 |
| blast | 0.7750 | 0.7750 | 0.7750 |
| brown_spot | 0.8372 | 0.9000 | 0.8675 |
| bacterial_leaf_blight | 0.9730 | 0.9000 | 0.9351 |
| tungro | 0.9000 | 0.9000 | 0.9000 |

### Confusion matrix (test)

```
healthy     blast  brown_sp  bacteria    tungro
healthy         37       3       0       0       0
blast            0      31       4       1       4
brown_spot       1       3      36       0       0
bacterial_       1       2       1      36       0
tungro           1       1       2       0      36
```

### Unknown threshold calibration (validation)

| Threshold | Unknown rate | Acc (known) |
|-----------|--------------|-------------|
| 0.45 | 0.02 | 0.9031 |
| 0.46 | 0.02 | 0.9031 |
| 0.47 | 0.02 | 0.9031 |
| 0.48 | 0.02 | 0.9031 |
| 0.49 | 0.02 | 0.9031 |
| 0.5 | 0.02 | 0.9031 |
| 0.51 | 0.02 | 0.9031 |
| 0.52 **chosen** | 0.025 | 0.9077 |
| 0.53 | 0.025 | 0.9077 |
| 0.54 | 0.03 | 0.9072 |
| 0.55 | 0.035 | 0.9119 |
| 0.56 | 0.04 | 0.9115 |
| 0.57 | 0.04 | 0.9115 |
| 0.58 | 0.045 | 0.9162 |
| 0.59 | 0.045 | 0.9162 |
