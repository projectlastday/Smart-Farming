# Audit Independen AgriFusionNet

**Tanggal:** 31 Agustus 2026  
**Metode:** review source code, pemeriksaan stack pada port 8005, inspeksi MySQL secara read-only, dan probe runtime ONNX di container backend.  
**Sifat audit:** read-only. Audit tidak mengubah source code, data, deployment, kredensial, atau konfigurasi domain.

## 1. Konteks Proyek

AgriFusionNet adalah PWA berbahasa Indonesia untuk tugas sekolah mengenai sistem pendukung keputusan pertanian. Ruang lingkup tanaman dibatasi pada padi dan jambu biji.

Tugas utama meminta data pertanian sejak awal tanam sampai panen, dengan kemampuan:

1. Prediksi waktu panen.
2. Analisis kondisi tanah.
3. Deteksi penyakit tanaman.
4. Rekomendasi usia peremajaan.
5. Fitur tambahan pemetaan lahan.
6. Fitur tambahan AI offline.

Pengguna terdiri atas farmer, admin, dan superadmin. Stack menggunakan frontend PWA, backend API, MySQL, Docker Compose, proxy pada port 8005, dan Cloudflare Tunnel.

## 2. Ringkasan Eksekutif

Aplikasi dapat didemonstrasikan dari sisi alur, CRUD, keamanan dasar, dan UI, tetapi belum layak diklaim sebagai enam fitur AI yang sepenuhnya bekerja.

Kekuatan yang sudah nyata:

- Autentikasi, sesi server-side, CSRF, dan Origin validation.
- RBAC dan ownership query yang kuat; tidak ditemukan IDOR pada batas yang diperiksa.
- CRUD Lahan dan Siklus Tanam dengan dependency guard.
- Analisis panen, tanah, dan peremajaan berbasis aturan.
- Penyimpanan hasil, riwayat, detail, dan sinkronisasi idempotent.
- Halaman terpadu `/analysis`, filter, pagination, autocomplete, dan responsive layout.
- Alembic migration pada MySQL serta cakupan test backend/frontend yang cukup besar.

Temuan paling serius:

1. Model penyakit adalah ONNX dengan bobot acak dan belum pernah dilatih. Semua 107 hasil penyakit tersimpan berstatus `unknown`.
2. Akun demo terkontaminasi data E2E: 60 lahan, 84 siklus, dan 327 prediksi; sebagian besar berupa data testing.
3. Offline AI tidak dapat bekerja pada airplane mode karena WASM masih diambil dari CDN dan tidak diprecache.
4. Repository belum memiliki commit Git; seluruh file masih untracked.
5. Alur data berhenti pada prediksi, belum ada pencatatan panen aktual dan perbandingan prediksi dengan hasil nyata.

## 3. Matriks Persyaratan

| Fitur | Status | Implementasi sebenarnya | Bukti utama |
|---|---|---|---|
| Prediksi waktu panen | Sebagian bekerja | Rules engine berdasarkan durasi varietas; bukan ML | `backend/app/predictors/rules.py:30`; weather adapter masih stub dan confidence `0.65` tetap |
| Kondisi tanah | Bekerja sebagai aturan | Threshold pH/NPK dan fixture regional statis; bukan ML | `backend/app/predictors/rules.py:69`, `backend/app/adapters/external.py` |
| Penyakit tanaman | **Rusak** | ONNX `TinyRiceCNN` berbobot acak; tidak ada training/dataset/metrics | `ml/export/export_disease_onnx.py:53`, `backend/app/predictors/disease.py:66`; 107/107 hasil `unknown` |
| Peremajaan jambu | Bekerja sebagai aturan | Scoring deterministik usia, produktivitas, dan kanopi | `backend/app/predictors/rules.py:115`; memiliki test boundary yang baik |
| Pemetaan lahan | Sebagian bekerja | Rasterio membaca metadata, tetapi segmentasi area adalah konstanta 62,5% | `backend/app/predictors/mapping.py:14`, `:30`, `:64` |
| AI Offline | Sebagian; gagal offline nyata | ORT-Web dan IndexedDB nyata, tetapi WASM memakai CDN dan service worker tidak menyimpan WASM | `frontend/src/offline/model.ts:141`, `frontend/vite.config.ts:38` |

**Kesimpulan:** belum ada satu pun dari enam fitur yang memakai model terlatih. Pendekatan rules engine tetap dapat diterima untuk tugas sekolah bila dijelaskan jujur, tetapi fitur penyakit sebelumnya dijanjikan sebagai model terlatih dan saat ini tidak memenuhi klaim tersebut.

## 4. Alur Pengguna Saat Ini

### Farmer

1. Login ke aplikasi.
2. Membuat dan mengelola Lahan pada `/farms`.
3. Membuat dan mengelola Siklus Tanam pada `/crop-cycles`.
4. Membuka `/analysis`, memilih Lahan dan Siklus Tanam.
5. Melihat kartu analisis relevan berdasarkan tanaman.
6. Menjalankan fitur melalui form yang sesuai.
7. Membaca hasil terbaru pada Analisis Tanaman.
8. Membuka `/predictions` untuk log riwayat dan detail teknis.
9. Untuk AI Offline: install model, inferensi lokal, antrekan hasil, lalu sinkronisasi manual.

### Admin

- Dapat melihat dan menonaktifkan farmer.
- Kemampuan membuat farmer tidak sesuai dokumentasi; implementasi saat ini membatasi pembuatan akun ke superadmin.
- Halaman admin masih menyebut dirinya sebagai stub.

### Superadmin

- Dapat membuat admin melalui setup token satu kali.
- Dapat melihat audit log.
- Halaman referensi masih hardcoded/stub dan belum memiliki CRUD.

### Gap alur utama

Tidak ada tindakan **Tandai Panen**, tanggal panen aktual, hasil panen/yield, atau evaluasi predicted-vs-actual. Karena itu, klaim “dari awal tanam sampai panen” belum lengkap.

## 5. Gap Analysis

### P0 — Blocker sebelum presentasi

#### P0.1 Model penyakit tidak dapat mengklasifikasikan

**Bukti:**

- Export hanya menjalankan `torch.manual_seed(42)` dan `TinyRiceCNN()` tanpa training atau `load_state_dict`.
- Probabilitas hasil probe hampir seragam, maksimum sekitar 0,21, sedangkan threshold adalah 0,55.
- Semua 107 hasil penyakit di database berstatus `unknown` dengan label “Tidak dapat diklasifikasi dengan andal”.

**Rekomendasi:**

- Pilihan ideal: latih MobileNetV3-Small pada subset Paddy Doctor yang diizinkan dan simpan metrics.
- Pilihan demo jujur: gunakan heuristic fallback dan beri label sebagai heuristik warna, bukan model terlatih.

#### P0.2 Database demo tercemar data E2E

**Bukti:** akun farmer demo memiliki 60 lahan, 84 siklus, dan 327 prediksi; 57 lahan bernama E2E/Blocked/Curl/test. Banyak tanggal tanam berada pada 2030–2033.

**Rekomendasi:** reset dan seed ulang database demo, lalu gunakan akun/database terpisah untuk Playwright.

#### P0.3 Batas 100 prediksi dapat menyembunyikan hasil

**Bukti:** `GET /predictions` menggunakan `.limit(100)` tanpa pagination atau filter server-side (`backend/app/api/routes/core.py:192`). Halaman `/analysis` menyaring daftar terbatas tersebut di frontend.

**Dampak:** kartu dapat menampilkan “Belum dianalisis” meskipun hasil ada di database.

**Rekomendasi:** tambahkan filter `crop_cycle_id` dan `feature_type` pada API dan minta `/analysis` mengambil hasil hanya untuk siklus terpilih.

#### P0.4 Offline AI gagal pada airplane mode

**Bukti:**

- `ort.env.wasm.wasmPaths` menunjuk ke jsDelivr.
- Workbox glob tidak mencakup `.wasm`.
- Built `sw.js` tidak memiliki WASM dalam precache.
- `ProtectedRoute` membutuhkan pemeriksaan session online saat cold start.

**Rekomendasi:** gunakan WASM lokal, tambahkan WASM ke precache, lalu uji dengan jaringan benar-benar dimatikan. Batasi klaim menjadi “inferensi lokal pada halaman offline”, bukan seluruh aplikasi offline.

#### P0.5 Tidak ada riwayat Git

**Bukti:** branch `master` belum memiliki commit dan seluruh file untracked.

**Rekomendasi:** buat commit awal sebelum perubahan lain agar project memiliki recovery point.

### P1 — Sebaiknya diperbaiki sebelum presentasi

#### P1.1 Tahap panen salah untuk tanggal lampau dan masa depan

Siklus yang sudah melewati jendela panen tetap dilabeli “Mendekati Panen”. Siklus dengan tanggal tanam masa depan dilabeli “Vegetatif”.

**Rekomendasi:** tambahkan status `overdue` dan `not_yet_planted`, serta pesan “Jendela panen terlewat”.

#### P1.2 Tidak ada pencatatan panen aktual

Status lifecycle hanya berubah melalui payload; tidak ada proses domain yang menutup siklus. Data menunjukkan tidak ada siklus yang mencapai `harvested`.

**Rekomendasi:** tambahkan **Tandai Panen**, tanggal panen aktual, optional yield, perubahan status, serta predicted-vs-actual.

#### P1.3 Confidence bersifat hardcoded

- Harvest: 65%.
- Soil: 70%.
- Rejuvenation: 75%.
- Mapping: 60%.

**Rekomendasi:** hitung dari kualitas input/konteks atau ganti label menjadi “Keandalan aturan (tetap)” agar tidak menyerupai probabilitas model.

#### P1.4 Pemetaan tidak melakukan segmentasi

`crop_area_percent: 62.5` adalah konstanta pada jalur raster maupun fallback.

**Rekomendasi:** lakukan threshold nyata pada data raster atau ubah nama output menjadi placeholder demo secara eksplisit.

#### P1.5 Endpoint model tidak membutuhkan autentikasi

Endpoint metadata dan download model mengembalikan HTTP 200 tanpa session.

**Rekomendasi:** tambahkan dependency autentikasi sebelum model yang benar-benar bernilai digunakan.

#### P1.6 Tidak ada rate limiting

Login, register, password setup, dan upload belum dibatasi. `TRUSTED_PROXY_IPS` didefinisikan tetapi tidak digunakan.

#### P1.7 Password change merusak session aktif

Password change mencabut seluruh session dan membuat session baru, tetapi tidak memasang cookie session baru.

#### P1.8 Anonymize tidak mencabut session

User yang dianonimkan dapat tetap memakai session aktif.

#### P1.9 API error terlihat sebagai data kosong

History, Dashboard, Farms, dan CropCycles tidak membedakan fetch error dari empty state.

#### P1.10 Security headers belum ada

Tidak ditemukan CSP, X-Frame-Options, X-Content-Type-Options, atau HSTS. Perbaiki WASM offline sebelum menambahkan CSP agar CSP tidak memutus CDN yang masih digunakan.

#### P1.11 Role matrix tidak konsisten

HANDOFF menyatakan admin dapat membuat farmer dan superadmin memiliki scope dukungan luas, tetapi implementasi tidak menyediakan kemampuan tersebut. Pilih salah satu: implementasikan matrix atau perbarui dokumentasi agar sesuai kenyataan.

### P2 — Nice to have

- Tambahkan index pada foreign key dan kolom filter utama.
- Hapus atau implementasikan restore untuk model backup offline.
- Gunakan atau hapus `session_version` yang tidak divalidasi.
- Tambahkan endpoint aman untuk gambar tersimpan atau hapus opsi tersebut.
- Bandingkan versi model sebelum download ulang.
- Ganti placeholder PWA icons dengan artwork aplikasi.
- Terjemahkan string `Reset filter`, `Pending`, dan fallback HTTP status.
- Perbaiki typo `jambu_standart`.
- Kurangi penyimpanan prediksi `not_applicable` yang hanya menjadi noise.
- Tambahkan halaman 404 nyata.
- Tambahkan empty state untuk antrean offline.
- Jangan tampilkan confidence pada hasil `not_applicable`.
- Beri pemberitahuan saat PWA auto-update.

## 6. Audit Test Coverage

### Coverage yang kuat

- CSRF, Origin validation, unauthenticated access, wrong password, disabled login, dan logout invalidation.
- RBAC farmer/admin serta ownership isolation pada farm, cycle, prediction detail, dan feature execution.
- Sync idempotency pada API dan service layer.
- Boundary rules untuk peremajaan.
- Not-applicable pairing untuk beberapa fitur.
- Playwright desktop/mobile mencakup auth, CRUD, delete guard, feature flow, dan horizontal overflow.

### Coverage yang hilang

1. Tidak ada test yang memastikan penyakit pernah berstatus `classified`.
2. Tidak ada test yang benar-benar mengaktifkan offline mode.
3. IndexedDB di-mock seluruhnya; antrean nyata tidak pernah diuji.
4. Migration test tidak memulai dari schema kosong.
5. Cookie attributes tidak diuji dari header `Set-Cookie` nyata.
6. Session rotation, EXIF stripping, temp cleanup, rate limiting, dan perilaku daftar prediksi belum diuji.
7. Frontend unit test seluruhnya memock service; tidak ada MSW/real fetch integration.

### Assertion lemah

- Test ONNX keluar lebih awal jika file model hilang.
- Test mapping menerima fallback atau metadata sehingga tidak memastikan segmentasi.
- Test RBAC list hanya memastikan response adalah list, termasuk list kosong.
- Test sync menerima “Sesi habis” sebagai hasil lulus.
- QA audit mengecualikan error WASM, 401, dan `ERR_ABORTED`.

### Test bernilai tinggi yang harus ditambahkan

1. Known-good leaf harus menghasilkan `output.status == classified`.
2. Seed lebih dari 150 prediksi dan pastikan hasil siklus tertentu tetap ditemukan.
3. Install model, aktifkan Playwright offline, reload, lalu lakukan inferensi.
4. Test IndexedDB nyata dengan duplicate `client_operation_id`.
5. Pastikan login cookie memiliki `HttpOnly` dan `SameSite=Lax`.
6. Pastikan API failure menampilkan error state, bukan empty state.
7. Jalankan Alembic `upgrade head` dari database kosong.
8. Upload JPEG dengan EXIF dan pastikan metadata dihapus.

## 7. Backlog Prioritas

### Backlog demo sekolah

1. Commit project ke Git.
2. Reset/seed ulang database demo dan pisahkan data E2E.
3. Buat penyakit menghasilkan klasifikasi nyata atau gunakan heuristic dengan label jujur.
4. Perbaiki WASM offline dan uji pada jaringan mati.
5. Tambahkan filter server-side untuk prediction.
6. Tambahkan **Tandai Panen** dan predicted-vs-actual.
7. Tambahkan tiga regression test utama untuk disease, prediction cap, dan offline.

### Production hardening (setelah demo)

- Rate limiting untuk auth dan upload.
- CSP serta security headers.
- Autentikasi endpoint model.
- Perbaikan session password change dan anonymization.
- Sinkronisasi role matrix dengan implementasi.
- Confidence dinamis/jujur.
- Segmentasi raster nyata.
- Adapter NASA POWER/SoilGrids nyata dengan timeout dan provenance.
- Endpoint gambar tersimpan dan retention job.
- Index database, structured logging, backup, dan restore verification.

### Tidak direkomendasikan

- Jangan menambah tanaman selain padi dan jambu.
- Jangan menambah live Copernicus download sebelum demo.
- Jangan membuat native Android app.
- Jangan melatih enam model berbeda.

## 8. Checklist Manual Sebelum Presentasi

1. Gunakan incognito dan domain publik.
2. Pastikan daftar Lahan hanya berisi data demo yang bersih; tidak ada E2E/Blocked/Curl/test.
3. Pastikan tidak ada tanggal tanam setelah hari presentasi.
4. Pada `/analysis`, pilih padi dan pastikan semua kartu relevan memiliki hasil.
5. Pilih jambu dan pastikan hanya soil serta rejuvenation yang tampil.
6. Jalankan harvest; pastikan window berada pada masa depan dan stage masuk akal.
7. Jalankan soil, rejuvenation, dan mapping; pastikan result card tampil.
8. Jalankan disease; pastikan menghasilkan kelas nyata sebelum mengklaim diagnosis.
9. Uji not-applicable dan pastikan muncul penjelasan, bukan error.
10. Install offline model, aktifkan DevTools Network Offline, reload, lalu inferensi.
11. Sinkronkan satu hasil offline dan pastikan tidak terjadi duplikasi.
12. Uji superadmin membuat admin dan periksa pembatasan menu/route.
13. Uji ownership dengan prediction ID milik user lain.
14. Uji semua route pada ponsel nyata dan pastikan tidak ada horizontal overflow.
15. Restart Docker Compose dan pastikan data tetap ada.

## 9. Lima Tindakan Utama

1. **Perbaiki fitur penyakit agar dapat menghasilkan klasifikasi.** Model ONNX saat ini tidak terlatih dan 107/107 hasil historis gagal diklasifikasikan.
2. **Reset dan seed ulang database demo serta pisahkan E2E.** Data test akan langsung merusak presentasi.
3. **Commit repository ke Git.** Saat ini tidak ada version history atau recovery point.
4. **Buat AI Offline benar-benar bekerja offline.** Bundel dan precache WASM, lalu uji tanpa jaringan.
5. **Tambahkan filter siklus/fitur pada API prediksi.** Batas 100 row dapat menyembunyikan hasil dari Analisis Tanaman.

## 10. Asumsi dan Hal Belum Terverifikasi

### Asumsi

- Presentasi memakai akun farmer dan superadmin pada Compose stack saat ini.
- Penguji akan mencoba UI secara langsung.
- Penilaian lebih menghargai enam fitur yang bekerja secara jujur daripada production hardening.

### Belum terverifikasi

- Installability PWA pada perangkat nyata.
- WCAG contrast ratio terukur.
- Perilaku cloudflared di luar Compose.
- Parameter Argon2id runtime.
- Perbedaan preprocessing PIL backend dan canvas browser.
- Perilaku seluruh aplikasi pada browser mobile nyata melalui domain publik.

---

Dokumen ini harus diperbarui setelah blocker P0 diperbaiki. Jangan menandai temuan sebagai selesai tanpa bukti test atau verifikasi runtime yang relevan.
