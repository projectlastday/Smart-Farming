# AgriFusionNet — Full Implementation Goal

**Status:** completion audit 2026-09-01 pada `audit-remediation`. Implementasi teknis v1 selesai; gerbang presentasi publik, Add-to-Home-Screen fisik, dan NVDA/VoiceOver tetap owner-manual.
**Sumber audit:** [`AUDIT-REPORT.md`](./AUDIT-REPORT.md)  
**Jenis proyek:** PWA tugas sekolah, bukan layanan agronomi produksi  
**Bahasa antarmuka:** Bahasa Indonesia  
**Tanaman dalam scope:** padi dan jambu biji

**Perubahan scope (2026-10-13):** fitur pemetaan lahan dinonaktifkan dan dihapus dari aplikasi atas permintaan pengguna. Hanya AI Offline yang tersisa sebagai fitur tambahan; bila rubrik tetap mewajibkan dua fitur tambahan, perlu disepakati fitur pengganti. Daftar pemetaan di bawah mencatat audit/perencanaan lama dan bukan instruksi untuk mengaktifkannya kembali.

## 1. Tujuan Akhir

Selesaikan seluruh temuan audit AgriFusionNet sampai aplikasi:

1. Layak dan meyakinkan untuk demonstrasi sekolah.
2. Memenuhi alur data dari pembuatan lahan dan siklus tanam sampai pencatatan panen aktual.
3. Menjalankan enam fitur yang dijanjikan secara nyata dan jujur:
   - prediksi waktu panen;
   - analisis kondisi tanah;
   - deteksi penyakit tanaman;
   - rekomendasi usia peremajaan;
   - pemetaan lahan;
   - AI offline.
4. Menjelaskan dengan benar apakah setiap hasil berasal dari model ML, aturan, baseline, data eksternal, atau demo.
5. Memiliki autentikasi, otorisasi, penyimpanan, sinkronisasi offline, error handling, dan pengujian yang konsisten.
6. Tidak menyembunyikan keterbatasan melalui angka confidence atau label yang menyesatkan.

## 2. Cara Menggunakan Dokumen Ini

Agent implementasi wajib:

1. Membaca `AUDIT-REPORT.md`, `HANDOFF.md`, `README.md`, `AGENTS.md`, konfigurasi, migration, source, dan test yang relevan sebelum mengubah bagian terkait.
2. Memverifikasi ulang setiap temuan terhadap source dan aplikasi saat ini karena line number audit dapat bergeser.
3. Mengerjakan fase secara berurutan. P0 selesai sebelum P1; demo gate selesai sebelum production hardening.
4. Mengubah checkbox hanya setelah acceptance criteria terkait terbukti.
5. Menambahkan bukti pada bagian **Implementation Log**: file, migration, test, command, dan hasil verifikasi.
6. Membuat perubahan kecil dan dapat direview. Satu commit logis per kelompok perubahan.
7. Menjaga `AUDIT-REPORT.md` sebagai bukti audit asli. Catat penyelesaian di dokumen ini; jangan menghapus temuan lama.

## 3. Guardrails

- Pertahankan scope padi dan jambu biji.
- Pertahankan stack saat ini kecuali perubahan benar-benar dibutuhkan untuk memenuhi acceptance criteria.
- Pertahankan MySQL sebagai database utama.
- Gunakan PWA; jangan membuat aplikasi Android native.
- Jangan menambah tanaman, enam model terpisah, atau integrasi besar yang tidak dibutuhkan demonstrasi.
- Jangan mencetak, memasukkan ke Git, atau menulis kredensial ke dokumentasi dan log.
- Pastikan `.env`, dump database, model berlisensi terbatas, foto pengguna, dan artefak sensitif diabaikan Git.
- Sebelum operasi data destruktif, buat backup yang dapat dipulihkan, tampilkan target persis, dan dapatkan persetujuan pemilik.
- Pertahankan data pengguna yang bukan data test. Pembersihan otomatis hanya boleh menargetkan data test dengan penanda yang dapat dibuktikan.
- Jangan menurunkan proteksi ownership, CSRF, session, atau RBAC demi membuat test lulus.
- Jangan mengklaim ML terlatih tanpa training pipeline, dataset provenance, split, metrik, dan model artifact yang dapat diverifikasi.
- Jika bukti tidak cukup, tulis **unverified**, bukan **working**.

## 4. Matriks Role yang Menjadi Target

Matriks ini mengikuti keputusan pemilik proyek dan menjadi sumber kebenaran implementasi:

### Farmer

- Login dan mengelola akun sendiri.
- CRUD hanya untuk lahan miliknya sendiri.
- CRUD hanya untuk siklus tanam pada lahannya sendiri.
- Menjalankan analisis hanya pada siklus miliknya sendiri.
- Melihat riwayat dan detail prediksi miliknya sendiri.
- Menjalankan AI offline dan menyinkronkan hasil miliknya sendiri.
- Mencatat panen aktual untuk siklus miliknya sendiri.

### Admin

- Semua akses administratif harus memerlukan role `admin` atau lebih tinggi.
- Dapat membuat akun baru dengan role `farmer`.
- Dapat melihat daftar akun farmer dan menonaktifkan/mengaktifkan farmer sesuai aturan produk.
- Tidak dapat membuat admin atau superadmin.
- Tidak memperoleh akses baca/tulis ke lahan, siklus, prediksi, atau gambar farmer kecuali kebijakan itu kelak disetujui secara eksplisit.

### Superadmin

- Memiliki kemampuan pengelolaan akun yang dimiliki admin.
- Dapat membuat akun baru dengan role `admin` dan menetapkan kata sandi langsung.
- Dapat mengakses audit log.
- Dapat mengelola data referensi jika fitur reference CRUD dipertahankan.
- Tidak boleh membuat superadmin melalui alur UI biasa.

### Acceptance criteria role

- [x] Backend dan frontend menerapkan matriks di atas.
- [x] Direct URL dan direct API access sama-sama ditolak ketika role tidak sesuai.
- [x] Ownership menghasilkan respons aman tanpa membocorkan keberadaan record pengguna lain.
- [x] `HANDOFF.md`, UI, API, dan test menyatakan perilaku yang sama.
- [x] Test mencakup setiap kombinasi role dan aksi sensitif.

## 5. Definition of Done Global

Proyek hanya boleh disebut selesai jika:

- [x] Semua item P0, P1, dan P2 yang masih relevan telah selesai atau diberi keputusan tertulis yang disetujui pemilik.
- [x] Seluruh enam fitur memiliki status yang jujur dan acceptance test.
- [x] Tidak ada blocker terbuka pada penyakit, offline, data demo, Git, prediction query, atau lifecycle panen.
- [x] Seluruh migration dapat dijalankan dari database kosong dan pada database existing.
- [x] Unit, integration, frontend, E2E desktop, dan E2E mobile yang relevan lulus.
- [x] Uji offline dilakukan dengan jaringan benar-benar dimatikan.
- [x] Tidak ada test yang menganggap error, logout, fallback tak sengaja, atau empty response sebagai keberhasilan.
- [x] Demo account bersih dan memiliki data realistis untuk padi serta jambu biji.
- [ ] Manual pre-presentation checklist selesai pada domain publik. **Manual-only:** owner incognito walkthrough on `https://sf.projectdunia.my.id` (lihat §8). Tidak diklaim selesai.
- [x] Dokumentasi menjelaskan arsitektur, model/rules, data provenance, keterbatasan, cara menjalankan, dan cara demo.
- [x] Git memiliki commit yang dapat dipulihkan dan working tree dipahami.

---

## Phase 0 — Baseline, Recovery, dan Data Safety

### 0.1 Buat recovery point Git

- [x] Periksa `.gitignore` sebelum staging.
- [x] Pastikan secrets, `.env`, database dump, upload, cache, build output, dan dependency directories tidak ikut Git.
- [x] Catat baseline `git status` dan jangan menghapus perubahan yang tidak dikenal.
- [x] Buat initial commit yang merepresentasikan kondisi aplikasi sebelum remediasi.
- [x] Buat branch kerja audit-remediation atau strategi commit yang setara.

**Acceptance criteria:** `git log` menampilkan baseline commit; working tree hanya berisi perubahan yang diketahui; tidak ada secret dalam tracked files atau history.

### 0.2 Baseline aplikasi dan test

- [x] Catat versi toolchain dan status container.
- [x] Jalankan health check, migration status, dan test baseline yang aman.
- [x] Catat test gagal yang sudah ada sebelum perubahan.
- [x] Ambil bukti jumlah data demo tanpa mencetak data pribadi atau credential.

**Acceptance criteria:** terdapat baseline reproducible pada Implementation Log, termasuk command dan ringkasan hasil.

### 0.3 Strategi pemisahan data demo dan test

- [x] Pisahkan akun/database E2E dari akun demo presentasi.
- [x] Ubah fixture/test agar setiap run membersihkan datanya sendiri atau memakai namespace/database terisolasi.
- [x] Buat seed demo idempotent untuk dua lahan/siklus realistis: padi dan jambu biji.
- [x] Siapkan preview pembersihan untuk data bernama `E2E`, `Blocked`, `Curl`, atau `test` dan tanggal tidak realistis.
- [x] Backup database sebelum pembersihan.
- [x] Jalankan pembersihan hanya setelah target dikonfirmasi pemilik.

**Acceptance criteria:** akun demo tidak berisi residu E2E; E2E baru tidak mengotori akun demo; seed dapat dijalankan ulang tanpa duplikasi.

---

## Phase 1 — P0: Enam Fitur Harus Benar-Benar Dapat Didemokan

### 1.1 Perbaiki deteksi penyakit

Target utama adalah model terlatih yang benar-benar dapat menghasilkan klasifikasi, bukan ONNX random.

- [x] Hapus ketergantungan runtime pada model random `TinyRiceCNN` yang tidak pernah dilatih.
- [x] Tentukan kelas penyakit padi yang didukung dan pastikan label frontend/backend identik.
- [x] Gunakan dataset yang lisensinya mengizinkan penggunaan proyek sekolah.
- [x] Dokumentasikan sumber dataset, lisensi, jumlah gambar per kelas, preprocessing, augmentasi, split, seed, dan keterbatasan.
- [x] Cegah data leakage dengan split yang layak; jangan memakai gambar yang sama/duplikat pada train dan test.
- [x] Latih baseline ringan yang sesuai inference browser, misalnya MobileNetV3-Small atau model sekelasnya.
- [x] Simpan training script dan konfigurasi yang reproducible.
- [x] Ekspor ONNX terlatih dan metadata SHA-256/version.
- [x] Ukur minimal accuracy, macro F1, confusion matrix, dan performa per kelas pada test set yang tidak dilatih.
- [x] Kalibrasi threshold `unknown` dari validation data, bukan angka tanpa dasar.
- [x] Pastikan preprocessing PIL backend dan canvas browser semirip mungkin serta memiliki parity test.
- [x] Gunakan file uji known-good per kelas yang legal disimpan di test fixture.
- [x] Tampilkan nama kelas, confidence yang benar-benar berasal dari output model, keterbatasan, dan saran verifikasi lapangan.
- [x] Simpan model version pada prediction.

**Fallback yang jujur:** bila model terlatih belum dapat dibuat, gunakan heuristic hanya sebagai `demo_heuristic`, labeli UI sebagai demo berbasis warna, dan jangan menyebutnya model penyakit terlatih. Fallback ini tidak memenuhi target akhir dan tidak boleh menutup checklist model terlatih.

**Acceptance criteria:** setidaknya satu known-good image per kelas menghasilkan `classified` yang benar dalam test; model random tidak digunakan; metrik dan provenance tersedia; backend dan offline browser menghasilkan kelas yang sama dalam toleransi yang ditetapkan.

### 1.2 Perbaiki AI offline sesungguhnya

- [x] Gunakan ONNX Runtime WASM dari asset lokal, bukan CDN.
- [x] Tambahkan `.wasm` yang diperlukan ke build dan precache service worker.
- [x] Pastikan batas ukuran precache cukup dan build tidak diam-diam mengecualikan WASM/model.
- [x] Cache model dan metadata secara versioned dengan validasi SHA-256.
- [x] Implementasikan version comparison sehingga model yang sama tidak selalu diunduh ulang.
- [x] Implementasikan rollback model yang benar atau hapus backup mechanism palsu.
- [x] Definisikan klaim offline secara jelas: shell halaman, model install, local inference, queue, dan sync.
- [x] Buat offline session behavior yang tidak membuang user ke login saat session terakhir masih sah secara lokal; jangan memperlemah validasi server saat online kembali.
- [x] Berikan status offline/online, status model, progress install, empty state queue, retry, dan pesan error Bahasa Indonesia.
- [x] Pertahankan idempotency `client_operation_id` saat sync.
- [x] Tambahkan reconnect listener atau tombol sync yang jelas; background sync boleh opsional jika tidak stabil di browser target.
- [x] Pastikan inference tetap berjalan setelah reload saat network benar-benar offline.

**Acceptance criteria:** Playwright menginstal model saat online, mematikan network, reload, menjalankan inference, menghasilkan output lokal, memasukkan hasil ke IndexedDB, kembali online, sync tepat satu kali, dan tidak membuat duplikat.

### 1.3 Hilangkan correctness bug batas 100 prediksi

- [x] Tambahkan server-side pagination untuk `GET /predictions`.
- [x] Tambahkan filter minimal `crop_cycle_id`, `feature_type`, status, dan rentang tanggal yang divalidasi.
- [x] Terapkan ownership pada seluruh query dan filter.
- [x] Kembalikan metadata pagination yang stabil.
- [x] Ubah `/analysis` menjadi daftar global semua prediksi tersimpan dengan pagination server-side; setiap hasil dapat dibuka ke detail.
- [x] Pertahankan `/predictions` sebagai riwayat rinci dengan filter/pagination server-side.
- [x] Pastikan query memiliki ordering deterministik ketika timestamp sama.

**Acceptance criteria:** dengan lebih dari 150 prediksi lintas siklus, Analisis Tanaman menampilkan daftar lengkap melalui pagination dan setiap hasil dapat dibuka; tidak ada cross-user leakage.

### 1.4 Bersihkan demo

- [x] Selesaikan langkah 0.3 setelah backup dan persetujuan target.
- [x] Buat data demo realistis dengan tanggal yang konsisten terhadap tanggal presentasi.
- [x] Sediakan hasil tersimpan yang meyakinkan untuk siklus padi dan jambu biji.
- [x] Pastikan akun demo tidak bergantung pada urutan test.

**Acceptance criteria:** pemeriksaan manual tidak menemukan nama E2E/test, tanggal masa depan yang tidak sengaja, atau ratusan record sampah.

---

## Phase 2 — P1: Lengkapi Alur Tanam Sampai Panen

### 2.1 Catat panen aktual

- [x] Tambahkan migration untuk `actual_harvest_date`, hasil panen/yield opsional beserta satuan, dan field lain yang benar-benar diperlukan.
- [x] Selaraskan default lifecycle status antara model dan schema.
- [x] Definisikan transisi status yang valid: planned → planted/growing → harvest_ready → harvested → archived bila dipakai.
- [x] Tambahkan backend service/API untuk menandai panen dengan ownership dan validasi tanggal.
- [x] Tambahkan aksi UI `Tandai Panen` dan edit data panen.
- [x] Tampilkan predicted-vs-actual harvest date dan selisih hari.
- [x] Pastikan prediksi tidak berubah diam-diam ketika actual harvest dicatat; simpan audit trail/version.
- [x] Tentukan perilaku delete siklus yang sudah memiliki panen/prediksi.

**Acceptance criteria:** farmer dapat membuat siklus, menjalankan prediksi, mencatat panen aktual, melihat selisih prediksi, dan status berakhir `harvested`; unauthorized user tidak dapat mengubahnya.

### 2.2 Perbaiki tahap pertumbuhan dan edge case waktu

- [x] Tambahkan status Bahasa Indonesia untuk `not_yet_planted`, `vegetative`, `reproductive`, `ripening`, `near_harvest`, `overdue`, dan `harvested` bila relevan.
- [x] Tanggal tanam masa depan harus tampil sebagai belum ditanam, bukan vegetatif.
- [x] Tanggal setelah akhir jendela panen harus tampil sebagai jendela panen terlewat, bukan mendekati panen.
- [x] Gunakan actual harvest bila tersedia.
- [x] Validasi timezone dan date-only semantics agar tidak bergeser satu hari.

**Acceptance criteria:** unit test mencakup sebelum tanam, setiap boundary tahap, tepat di jendela panen, setelah jendela, dan sudah dipanen.

### 2.3 Jujurkan confidence

- [x] Audit seluruh angka confidence pada harvest, soil, rejuvenation, mapping, disease, dan offline.
- [x] Confidence probabilistik hanya digunakan untuk output model yang memang terkalibrasi.
- [x] Untuk rules engine, tampilkan `Keandalan aturan` atau indikator kelengkapan input, bukan probabilitas palsu.
- [x] Kurangi keandalan jika input/data eksternal tidak tersedia dan jelaskan alasannya.
- [x] Simpan provenance dan asumsi pada setiap hasil.
- [x] Sembunyikan meter untuk `not_applicable` dan hasil tanpa dasar confidence.

**Acceptance criteria:** tidak ada hardcoded percentage yang dipresentasikan sebagai probabilitas model; label UI dan dokumentasi konsisten.

### 2.4 Perbaiki pemetaan lahan

- [x] Ganti `crop_area_percent: 62.5` konstan dengan perhitungan nyata yang sesuai dataset demo.
- [x] Dokumentasikan band, threshold/metode, CRS, bounds, nodata, dan keterbatasan.
- [x] Jika raster tidak mendukung NDVI yang benar, gunakan metode threshold yang secara teknis valid untuk band tersedia dan namai dengan jujur.
- [x] Pisahkan mode real-raster dan fallback; fallback harus jelas terlihat di output.
- [x] Perkuat test agar memverifikasi nilai perhitungan yang diketahui, bukan assertion `OR` yang selalu lolos.

**Acceptance criteria:** perubahan raster fixture menghasilkan perubahan area terhitung; output bukan literal tetap; fallback dan real mode diuji terpisah.

### 2.5 Selaraskan role dan fitur admin

- [x] Implementasikan matriks pada bagian 4.
- [x] Admin dapat membuat farmer, bukan admin.
- [x] Superadmin dapat membuat admin dengan kata sandi langsung.
- [x] Selesaikan atau hapus label stub pada halaman admin sesuai fungsi nyata.
- [x] Jika reference page dipertahankan, gunakan backend CRUD atau jadikan read-only reference yang benar-benar bersumber dari server.
- [x] Audit log mencatat aksi akun sensitif tanpa credential/token/password.
- [x] Update dokumentasi yang sebelumnya menjanjikan permission berbeda.

**Acceptance criteria:** test matrix role lulus untuk UI dan API; direct endpoint access tidak dapat melewati guard frontend.

---

## Phase 3 — P1: Security, Privacy, dan Reliability

### 3.1 Proteksi endpoint model dan upload

- [x] Wajibkan session valid pada model metadata/download jika hanya untuk pengguna aplikasi.
- [x] Pertahankan CSRF untuk operasi state-changing.
- [x] Batasi ukuran, tipe, dimensi, dan decoding image.
- [x] Pastikan metadata EXIF dibuang dan temporary file selalu dibersihkan.
- [x] Sediakan endpoint akses saved image yang ownership-scoped atau hapus opsi simpan gambar jika tidak digunakan.
- [x] Terapkan retention/deletion untuk saved images.

### 3.2 Rate limiting dan proxy awareness

- [x] Tambahkan rate limit untuk login, register/create account, password change, upload, dan endpoint inference yang mahal.
- [x] Definisikan trusted proxy behavior untuk Cloudflare/nginx tanpa mempercayai spoofed forwarding header dari client langsung.
- [x] Berikan respons 429 konsisten dan `Retry-After` bila sesuai.
- [x] Tambahkan test untuk limit dan trusted/untrusted proxy path.

### 3.3 Session correctness

- [x] Perbaiki change-password agar browser menerima cookie session baru setelah sesi lama direvoke.
- [x] Revoke semua session saat user dinonaktifkan atau dianonimkan.
- [x] Gunakan atau hapus `session_version`; jangan menyimpan mekanisme mati.
- [x] Test rotasi, logout, disable, anonymize, and expired session behavior.
- [x] Assert atribut cookie aktual: HttpOnly, SameSite, Secure sesuai environment, Path, dan expiry.

### 3.4 Security headers

- [x] Tambahkan CSP setelah asset WASM tidak lagi memakai CDN.
- [x] Tambahkan `X-Content-Type-Options`, frame protection melalui CSP/frame-ancestors, Referrer-Policy, dan Permissions-Policy yang sesuai.
- [x] Terapkan HSTS pada domain HTTPS/proxy yang benar tanpa merusak localhost.
- [x] Verifikasi header pada frontend dan API melalui domain publik.

### 3.5 Database dan lifecycle reliability

- [x] Tambahkan index pada foreign key/filter penting setelah memeriksa migration dan query plan.
- [x] Uji migration dari database kosong.
- [x] Uji upgrade dari schema existing dengan data.
- [x] Sediakan backup dan restore procedure yang benar-benar dicoba.
- [x] Pastikan cleanup/anonymization memiliki audit trail dan transactional safety.

**Acceptance criteria Phase 3:** security tests lulus, tidak ada regression ownership/CSRF, migration fresh dan upgrade lulus, serta header terverifikasi pada response nyata.

---

## Phase 4 — P2: UX, Accessibility, dan Konsistensi

### 4.1 Error dan empty states

- [x] Dashboard, Lahan, Siklus Tanam, Analisis, Riwayat, dan admin membedakan loading, empty, unauthorized, offline, dan server error.
- [x] Sediakan retry action untuk query error.
- [x] Offline queue memiliki empty state.
- [x] API error diterjemahkan menjadi pesan Bahasa Indonesia yang aman.
- [x] Tambahkan halaman 404; jangan redirect diam-diam ke dashboard.

### 4.2 Konsistensi Bahasa Indonesia

- [x] Ganti `Reset filter`, `Pending`, raw HTTP status text, enum internal, dan istilah Inggris yang terlihat pengguna.
- [x] Perbaiki typo seperti `jambu_standart` melalui migration/compatibility mapping jika sudah tersimpan.
- [x] Gunakan label `Vegetatif`, `Reproduktif`, `Pematangan`, `Mendekati Panen`, `Belum Ditanam`, dan `Jendela Panen Terlewat` secara konsisten.

### 4.3 Hasil analisis dan riwayat

- [x] Analisis Tanaman menjadi halaman utama untuk melihat semua prediksi tersimpan dalam satu daftar.
- [x] Riwayat tetap berguna sebagai audit log terfilter dan dapat membuka detail.
- [x] Jangan tampilkan raw JSON sebagai tampilan utama; sediakan detail terstruktur dan letakkan JSON debug di area khusus bila masih diperlukan.
- [x] Pastikan `not_applicable` memiliki badge dan penjelasan tanpa confidence meter.
- [x] Tampilkan model/rule version, provenance, asumsi, rekomendasi, dan timestamp dengan hierarki visual yang jelas.

### 4.4 Responsive dan accessibility

- [x] Audit setiap route pada desktop dan viewport mobile target.
- [x] Hilangkan horizontal overflow; tabel memiliki strategi mobile yang dapat digunakan.
- [x] Semua form mempunyai label, error association, keyboard navigation, focus state, dan autocomplete yang accessible.
- [x] Dialog konfirmasi dapat digunakan keyboard dan mengembalikan focus. Bukti: `frontend/tests/confirm-dialog.test.tsx`.
- [x] Ukur contrast, target size, zoom 200%, reduced motion, dan screen-reader labels. Pengukuran otomatis: `frontend/tests/contrast.test.ts` dan `e2e/accessibility.spec.ts`.
- [ ] NVDA/VoiceOver pada perangkat fisik (satu alur login+dasbor). **Manual-only:** lihat `docs/accessibility.md` dan §8. Tidak diklaim selesai.
- [x] Gunakan live region untuk progress install/sync bila relevan.

### 4.5 PWA polish

- [x] Ganti placeholder solid-color icons dengan ikon AgriFusionNet yang benar.
- [x] Tambahkan prompt update yang tidak menghilangkan pekerjaan user.
- [ ] Verifikasi manifest, installability, start URL, icon, theme color, dan standalone display pada perangkat nyata. **Manual-only:** Add-to-Home-Screen pada HP. Playwright Chromium memverifikasi manifest/ikon/SW (`e2e/pwa-installability.spec.ts`); lihat `docs/pwa.md`.

**Acceptance criteria Phase 4:** seluruh route lolos smoke test desktop/mobile, tidak ada overflow, error berbeda dari empty state, dan semua string utama berbahasa Indonesia.

---

## Phase 5 — Test Remediation Wajib

### 5.1 Disease dan model

- [x] Known-good fixture menghasilkan kelas yang benar, bukan sekadar `feature_type` benar.
- [x] Test gagal jika model artifact tidak ada; jangan `return` tanpa assertion.
- [x] Test model metadata, SHA-256, version, class order, input shape, dan threshold.
- [x] Backend/browser preprocessing parity test.

### 5.2 Prediction retrieval

- [x] Buat lebih dari 150 prediksi dan buktikan hasil siklus tertentu tetap dapat diambil.
- [x] Test server-side pagination, filter, ordering, invalid parameter, dan ownership.
- [x] Test Analisis Tanaman menggunakan pagination global dan tidak mengirim `latest_per_feature`.

### 5.3 Offline

- [x] Playwright: install → network offline → reload → inferensi → queue → online → sync.
- [x] Test IndexedDB nyata untuk enqueue, duplicate operation ID, retry, terminal failure, dan removal setelah sync.
- [x] Pastikan 401 tidak dianggap sukses.
- [x] Jangan menyaring WASM error, 401, atau request failure dari console/network audit.

### 5.4 Authentication dan RBAC

- [x] Assert Set-Cookie aktual.
- [x] Test password-change session rotation.
- [x] Test anonymize/disable revocation.
- [x] Test lengkap matriks role bagian 4.
- [x] Test direct URL dan direct API.
- [x] Test rate limit.

### 5.5 Data dan migration

- [x] Jalankan Alembic `upgrade head` pada schema kosong sementara.
- [x] Test migration existing data.
- [x] Test EXIF stripping dan temp cleanup.
- [x] Test actual harvest lifecycle dan predicted-vs-actual.
- [x] Test seed idempotency dan isolasi data E2E.

### 5.6 Frontend reliability

- [x] Query reject menghasilkan error state, bukan empty state.
- [x] Test not-applicable tidak menampilkan meter.
- [x] Test 404, offline state, stale PWA/cache, dan update prompt.
- [x] Test mobile overflow pada setiap route.
- [x] Pertahankan unit test UI, tetapi tambahkan integration test dengan network layer nyata atau MSW yang merepresentasikan kontrak API.

### Test quality gate

Setiap test harus gagal jika fitur yang dilindungi rusak. Hapus atau perbaiki assertion permisif seperti:

- keberhasilan jika salah satu dari dua cabang selalu benar;
- menerima `Sesi habis` sebagai sync berhasil;
- menerima list kosong tanpa memverifikasi permission/data;
- mengabaikan error penting dari audit console;
- return awal tanpa assertion ketika artifact hilang.

**Acceptance criteria:** semua test target lulus minimal dua kali pada environment bersih; tidak ada flaky retry yang menyembunyikan kegagalan; laporan mencatat jumlah pass/fail/skip.

---

## Phase 6 — Production Hardening Setelah Demo Gate

Fase ini dikerjakan setelah sekolah-demo backlog selesai dan stabil.

- [x] Real NASA POWER/SoilGrids adapter hanya jika diperlukan, dengan timeout, retry, cache, provenance, dan fallback eksplisit.
- [x] Observability: structured logs, request correlation, error reporting, health/readiness yang bermakna, dan metric minimal.
- [x] Database backup terjadwal dan restore drill.
- [x] Retention dan privacy lifecycle untuk gambar, prediction, audit log, serta akun anonymized.
- [x] Performance: query plan, index, pagination, upload/inference limit, dan bundle/cache budget.
- [x] Deployment runbook untuk Docker Compose, MySQL, proxy 8005, Cloudflare Tunnel, certificate/domain, restart, rollback, dan recovery.
- [x] Dependency/security scanning dan update policy.

**Bukan scope:** native Android, tanaman tambahan, Copernicus live scene pipeline, atau enam model ML berbeda.

---

## 6. Dokumentasi yang Harus Diperbarui

- [x] `README.md`: setup, run, port, migration, seed, test, akun demo tanpa password hardcoded, dan troubleshooting.
- [x] `HANDOFF.md`: arsitektur aktual, role matrix, lifecycle, API, offline claim, model/rules, known limitations.
- [x] Dokumentasi model: dataset, lisensi, training, evaluation, class mapping, threshold, version, checksum.
- [x] Dokumentasi rules: sumber prior varietas, threshold tanah, rejuvenation score, mapping method, dan arti reliability.
- [x] Demo script: alur farmer, admin, superadmin, online/offline, panen aktual, dan jawaban jujur tentang AI.
- [x] `AUDIT-REPORT.md` tetap sebagai audit asli; tambahkan status remediation melalui dokumen ini atau laporan baru.

## 7. Urutan Implementasi Wajib

1. Recovery point Git dan baseline.
2. Isolasi data test serta rencana cleanup demo.
3. Model penyakit terlatih dan test klasifikasi.
4. WASM/model lokal dan test offline nyata.
5. Prediction API terfilter/paginated dan Analisis Tanaman yang benar.
6. Cleanup/seed demo setelah backup dan persetujuan.
7. Actual harvest lifecycle dan edge case harvest.
8. Confidence honesty dan mapping calculation.
9. Role matrix/admin workflow.
10. Security/session/header/database fixes.
11. UX/accessibility/PWA polish.
12. Full regression, manual checklist, documentation, dan final demo rehearsal.
13. Production hardening setelah demo gate.

## 8. Manual Pre-Presentation Gate

**Owner-manual (unchecked elsewhere, not claimed here):** walkthrough incognito on `https://sf.projectdunia.my.id` (DoD), physical Add-to-Home-Screen (4.5), NVDA/VoiceOver on a real device (4.4). Local Playwright, `context.setOffline(true)`, and public-header fetches are not that walkthrough.

Owner steps when running the public rehearsal:

1. Buka jendela penyamaran; jangan memakai sesi `127.0.0.1:8005`.
2. Login `petani@gmail.com` (password dari `.env` lokal, jangan tulis di sini).
3. Telusuri perilaku yang sama dengan kotak di bawah. Untuk offline: Chrome DevTools → Network → Offline, reload, inferensi penyakit, lalu online lagi.
4. Untuk PWA: Add to Home Screen pada HP nyata. Untuk pembaca layar: NVDA atau VoiceOver pada satu alur login+dasbor.

The 21 behavioral items below are marked from `docs/VERIFICATION.md` and passing tests (local Compose unless noted). They are not a claim that the owner completed the public incognito rehearsal.

- [x] Login farmer berhasil. `goal-acceptance` login helpers / demo farms test.
- [x] Lahan hanya berisi data demo realistis. `goal-acceptance` demo farms (Sawah Ngemplak + Kebun Jambu, no E2E residue).
- [x] Siklus tidak berisi tanggal masa depan yang tidak disengaja. `goal-acceptance` rice `planting_date <= today`.
- [x] Analisis siklus padi menampilkan harvest, soil, disease, mapping, dan offline yang relevan. `e2e/analysis-overview.spec.ts`.
- [x] Analisis siklus jambu menampilkan soil dan rejuvenation; fitur tidak relevan tidak menyesatkan. `e2e/analysis-overview.spec.ts` + `frontend/tests/analysis-page.test.tsx`.
- [x] Disease menghasilkan kelas nyata pada gambar fixture/demo yang belum menjadi data training. `goal-acceptance` known-good blast + `app.spec` disease flow.
- [x] Harvest menampilkan window dan tahap yang benar. `e2e/harvest-result.spec.ts` + harvest stage unit tests.
- [x] Siklus overdue tampil sebagai terlewat, bukan mendekati panen. `goal-acceptance` overdue harvest (`Jendela Panen Terlewat`).
- [x] `Tandai Panen` menyimpan actual date dan menunjukkan selisih predicted-vs-actual. `goal-acceptance` overdue harvest / actual harvest delta.
- [x] Mapping menghasilkan nilai dari raster, bukan 62.5 konstan. `goal-acceptance` mapping (fixture 25.0) + smoke.
- [x] DevTools Network Offline: reload dan inference lokal berhasil. Automated stand-in: Playwright `context.setOffline(true)` in `offline-disease.spec.ts` (not owner DevTools).
- [x] Hasil offline masuk queue, sync tepat sekali, dan tidak duplikat. `offline-disease.spec.ts` (`1 tersinkron` then `0 tersinkron`).
- [x] Riwayat dapat mencari hasil lebih lama dari 100 record. `goal-acceptance` prediction history test.
- [x] Admin dapat membuat farmer dan tidak dapat membuat admin. `goal-acceptance` admin/superadmin test.
- [x] Superadmin dapat membuat admin dengan kata sandi langsung. same `goal-acceptance` admin/superadmin test.
- [x] Farmer lain tidak dapat membuka prediction/farm/cycle yang bukan miliknya. `goal-acceptance` ownership test.
- [x] Semua route mobile tidak overflow horizontal. `responsive-smoke`, `admin-responsive`, `qa-audit`.
- [x] Query error memperlihatkan error dan retry, bukan empty state palsu. `goal-acceptance` farms 500 + CropCycles/Analysis vitest.
- [x] Restart Compose mempertahankan data. `scripts/verify_compose_persistence.sh`.
- [x] Header keamanan muncul pada domain publik. `goal-acceptance` public HTTPS HSTS/CSP/X-CTO (not an incognito session).
- [x] Tidak ada secret, stack trace, raw exception, atau console error kritis. public HTML secret-name assertion + `qa-audit.spec.ts` happy-path console/API.

## 9. Top Five Immediate Actions

1. **Model penyakit:** ganti ONNX random dengan model terlatih dan test known-good classification.
2. **Data demo:** pisahkan E2E, backup, lalu bersihkan dan seed data realistis.
3. **Git:** buat recovery point yang aman tanpa secret.
4. **Offline:** bundel/precache WASM dan buktikan inference saat network mati.
5. **Prediction query:** server-side filter/pagination agar Analisis Tanaman tidak kehilangan hasil karena batas 100 row.

## 10. Implementation Log

Isi setelah setiap kelompok kerja. Jangan menulis password, cookie, token, atau data pribadi.

| Tanggal | Fase | Perubahan | Bukti test/runtime | Commit | Status/risiko tersisa |
|---|---|---|---|---|---|
| 2026-08-31 | 0 | Git baseline `d1fc1a4`, `.gitignore` (onnx/env/dumps/datasets), `agrifusionnet_test`, demo vs E2E seed, mysqldump `--no-tablespaces` | Alembic `0002_harvest_indexes`; seed idempotent (`test_seed_demo.py`) | working tree uncommitted | Jangan commit `.onnx` / `.env` |
| 2026-08-31 | 1.1 | MobileNetV3-Small on real Paddy Doctor subset (`Project-AgML/paddy_disease_classification`); no synthetic drawings; known-good test-split JPEGs | Host+API known-good 5/5; test acc 0.8800 / macro F1 0.8805; threshold 0.52; SHA-256 `2ae2c755…f8aa0`; `backend/.venv/bin/pytest` **95 passed** | uncommitted | HF card has no SPDX field (documented) |
| 2026-08-31 | 1.2 | Local ORT WASM, precache, CSRF persist in sessionStorage, 403 CSRF retry, crop-cycle cache | Playwright desktop `offline-disease.spec.ts` **passed** (install → offline reload → blast 100% → sync 1 then 0) | uncommitted | Public tunnel is this Compose stack |
| 2026-08-31 | 1.3–2.5 | Pagination `{items,page,total}`, harvest lifecycle, rule reliability, mapping 25.0% raster, RBAC | `test_predictions_query`, `test_harvest_and_mapping`, `test_roles_and_migrations` | uncommitted | — |
| 2026-08-31 | 3–4 | Cookie Secure flag, CSP/X-CTO on API+HTML nginx, EXIF strip test, PWA icons/update banner | `curl` :8005 `/` and `/api/v1/health/ready`; public origin `model_available: true` | uncommitted | HSTS off on HTTP :8005 by design |
| 2026-09-01 | 5 e2e | Login retry 429/502, autocomplete shows all farms after commit, crop-cycle session cache, session reconnect without logout, mapping rice-only, farms error≠empty, list page-size Semua | prior Playwright desktop/mobile **64+64** including `offline-disease.spec.ts` | uncommitted | superseded by 2026-09-01 Phase 6 row |
| 2026-09-01 | 3.4–6 | HSTS host-scoped (none on :8005, present on public HTTPS); NASA/SoilGrids timeout/retry/cache/fallback; JSON logs + `X-Request-ID` + `/metrics`; isolated backup/restore drill; retention CLI + Alembic `0003_retention_indexes`; MSW API contract; a11y/PWA Playwright; Riwayat `status=applicable`; farm-crud locator scoped to nama cell | `backend/.venv/bin/pytest -q` **112 passed**; frontend `npm test` **99 passed** + `tsc --noEmit`; Playwright desktop+mobile **142** (`offline-disease`, `accessibility`, `pwa-installability`); farm-crud re-run **8 passed** after strict-mode fix; `./scripts/backup_restore_drill.sh` marker verified, demo untouched; demo cleanup then `seed-demo` (Sawah Ngemplak rice + Kebun Jambu guava; E2E seed farms only); `curl https://sf.projectdunia.my.id/api/v1/health/ready` HSTS `max-age=31536000; includeSubDomains` | uncommitted | §8 public incognito, physical A2HS, NVDA/VoiceOver, DevTools Offline tetap owner-manual. pip-audit findings deferred in `docs/security-scanning.md`. Working tree still uncommitted on `audit-remediation`. |
| 2026-09-01 | 4.5 | Public Playwright PWA installability against `https://sf.projectdunia.my.id` (Chromium; credentials not printed) | `PLAYWRIGHT_BASE_URL=https://sf.projectdunia.my.id npx playwright test e2e/pwa-installability.spec.ts --project=desktop-chromium --workers=1` **3 passed** | uncommitted | Physical A2HS and §8 incognito remain owner-manual |
| 2026-09-02 | direct account passwords | Managed accounts receive their password during creation; setup-token flow removed; crop-cycle and analysis query error≠empty + retry; superadmin `/admin/audit` | Verification rerun after implementation | audit-remediation | §8 public incognito, physical A2HS, NVDA/VoiceOver remain owner-manual. Do not treat local Playwright as the public walkthrough. |
| 2026-09-01 | completion audit | Compact analysis/history no longer present leftover `%` as model probability; confirm dialog restores focus | frontend `npm test` **111 passed** + `tsc --noEmit` (this round). Prior automated evidence unchanged: backend **114**, Playwright desktop **80** + mobile **80**, smoke, persistence, public header check | `80a5b9e` | Remaining open: public incognito, physical A2HS, NVDA/VoiceOver |
| 2026-09-01 | checklist | Mark §8 21 behavioral items `[x]` from `docs/VERIFICATION.md` / passing tests; do not claim the public incognito walkthrough | documentation only; no test change | this commit | Unchecked: DoD public incognito, 4.5 physical A2HS, 4.4 NVDA/VoiceOver |

## 11. Format Handoff Akhir

Handoff akhir harus menjawab:

1. Apa yang berubah per fase.
2. Migration dan dampak data.
3. Status setiap dari enam fitur: ML/rule/baseline/demo.
4. Metrik model penyakit dan sumber dataset.
5. Bukti offline nyata.
6. Bukti role/ownership.
7. Test yang dijalankan beserta pass/fail/skip.
8. Checklist manual yang telah dilakukan.
9. Item yang masih `unverified` atau sengaja ditunda.
10. Commit terakhir, cara menjalankan, rollback, dan recovery.

## 12. Kondisi Berhenti

Pekerjaan belum selesai hanya karena UI terlihat baik atau test lama lulus. Berhenti sebagai **complete** hanya ketika Definition of Done Global dan demo gate terpenuhi. Jika sebuah target membutuhkan keputusan produk, data berlisensi, atau tindakan destruktif, catat bukti dan minta keputusan spesifik; lanjutkan pekerjaan lain yang aman sambil menunggu.
