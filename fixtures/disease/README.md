# Disease diagnosis fixtures

Known-good rice leaf photographs for tests and demo uploads. These are **real** held-out images from a Paddy Doctor redistribution, not generated drawings.

## Source

- Dataset: [Project-AgML/paddy_disease_classification](https://huggingface.co/datasets/Project-AgML/paddy_disease_classification)
- Paper: Petchiammal et al. 2022/2023 — Paddy Doctor
- IEEE DataPort: 10.21227/hz4v-af08
- License: Hugging Face dataset card has no SPDX license field. Original authors released Paddy Doctor open-source for community use (school/non-commercial). IEEE DataPort original archives require login.

Citation: Petchiammal, S., et al. (2022/2023). *Paddy Doctor: A Visual Guide for Paddy Disease Detection and Classification.* IEEE DataPort. https://doi.org/10.21227/hz4v-af08

## known_good/

One JPEG per class copied from the **test split only** (SHA-256 deduped; not used in training). Classes: `healthy`, `blast`, `brown_spot`, `bacterial_leaf_blight`, `tungro`.
