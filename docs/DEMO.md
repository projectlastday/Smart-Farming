# Demo script (AgriFusionNet)

User-facing language is Indonesian. Do not present this as a production agronomy service.

Local URL: http://127.0.0.1:8005  
Public URL: https://sf.projectdunia.my.id  

Demo farmer: `petani@gmail.com` (password in `.env`, not repeated here).  
Superadmin: `superadmin@gmail.com`.  
Do not use the Playwright account `e2e.farmer@agrifusion.test` on stage.

## Farmer

1. Login. Dashboard should show two realistic farms: Sawah Ngemplak (padi) and Kebun Jambu Mulyorejo (jambu).
2. **Analisis Tanaman**: lihat semua prediksi tersimpan dalam satu daftar, lalu pilih **Buka** pada hasil yang ingin diperiksa.
3. **Diagnosis Penyakit**: upload `fixtures/disease/known_good/blast.jpg`. Expect `classified` / blast from the trained ONNX, with model probability (not a color heuristic).
4. **Prediksi Panen**: run, then **Tandai Panen** with an actual date. Predicted-vs-actual appears; the original prediction row is unchanged.
5. Guava cycle: soil + rejuvenation. Disease/harvest/mapping show **Tidak Berlaku** with an explanation, not a fake score.
6. **AI Offline**: Aktifkan AI Offline → DevTools Network Offline (or equivalent) → reload → diagnosis on the same blast photo → queue → go online → Sinkronkan Sekarang once (`1 tersinkron`) → sync again (`0 tersinkron`).

Honest answers if asked:

- Disease is a school model on a Paddy Doctor subset (test accuracy 0.88). Not a field diagnosis.
- Harvest/soil/rejuvenation/mapping are transparent rules.
- Offline inference runs ONNX Runtime WASM in the browser; the leaf image is not uploaded until sync of the structured result.

## Admin

Login as an admin (created by the superadmin with a password). Create a farmer. Direct `/admin` as a farmer is denied. Admin cannot create another admin.

## Superadmin

Create an admin with a password, then login with those credentials. Open **Log Audit**. Do not create another superadmin from the UI.

## After the demo

Compose restart must keep MySQL volume data. Do not run cleanup scripts against the presentation account without a backup.
