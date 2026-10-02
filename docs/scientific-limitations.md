# Scientific limitations (AgriFusionNet v1)

- Not a production agronomy service or regulated diagnostic tool.
- Harvest dates use transparent variety-duration priors (Ciherang, IR64, Inpari 32), not local calibration.
- Soil guidance uses user/simulated inputs; SoilGrids is optional regional context only.
- Disease diagnosis is visual-only on a Paddy Doctor subset of real rice-leaf photographs (not synthetic drawings); field accuracy is limited and low softmax returns *Tidak dapat diklasifikasi dengan andal*.
- Guava rejuvenation uses species-specific deterministic rules, not cross-crop generalization.
- Mapping demo uses seeded raster; 10 m Sentinel-2 mixed pixels limit boundary accuracy.
