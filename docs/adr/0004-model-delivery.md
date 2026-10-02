# ADR 0004: Disease model delivery

## Status
Accepted

## Decision
Visual-only MobileNetV3-Small-class INT8 ONNX (<=20MB target) with WASM default execution; explicit "Aktifkan AI Offline" download flow with version/hash verification.

## Consequences
- v1 ships a MobileNetV3-Small ONNX trained on a Paddy Doctor subset (real rice-leaf photos). Missing artifact yields `unknown` / `unavailable`, not a color heuristic or random TinyCNN.
- Optional symptom/weather context is display-only, never model input.
