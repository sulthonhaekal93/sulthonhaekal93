# 🌱 Sedjati Numeracy Adventure

**Taman Belajar Sedjati — "Belajar, Bermain, Berhitung!"**

Game numerasi berbahasa Indonesia untuk anak TK sampai kelas 6 SD. Anak belajar penjumlahan, pengurangan, perkalian, dan pembagian lewat benda, kelompok, garis bilangan, dan blok puluhan, dengan umpan balik yang ramah. Bisa dibuka di HP Android, tablet, dan laptop. Tidak perlu server dan tidak ada iklan. Progres tersimpan otomatis di perangkat, dan bisa juga dikirim ke Google Spreadsheet guru (opsional).

## Isi permainan

| Level | Area | Misi (makin menantang) |
|---|---|---|
| 1 | 🌱 Kebun Angka | Kenal angka 1–5 · Hitung sampai 10 · Lebih banyak/sedikit · Hitung sampai 20 |
| 2 | 🏠 Rumah Penjumlahan | Sampai 5 · Sampai 10 · Sampai 20 · Dua angka tanpa menyimpan · Dua angka dengan menyimpan |
| 3 | 🌳 Taman Pengurangan | Sampai 5 · Sampai 10 · Sampai 20 & selisih · Dua angka tanpa meminjam · Dua angka dengan meminjam |
| 4 | 🌉 Jembatan Perkalian | Kelompok 2 & 5 · Kelompok 10 · Perkalian 1–5 (larik) · Perkalian 1–10 · Dua angka × satu angka |
| 5 | 🏪 Pasar Pembagian | Berbagi sama rata · Pembagian kecil · Fakta pembagian · Pembagian besar · Pembagian bersisa |
| 6 | 🏝️ Pulau Tantangan | Pilih operasi · Soal campuran · Pola bilangan · Soal cerita · Urutan operasi |

Level menunjukkan **kemampuan**, bukan kelas sekolah.

**Tiga mode:** Mode TK (benda besar, maksimal 3 pilihan, tanpa waktu, soal bisa dibacakan), SD Starter (kelas 1–3), dan SD Challenge (kelas 4–6, tantangan waktu opsional tanpa hukuman).

**Tiga cara menjawab:** 👆 Pilih Jawaban · ✋ Hitung Benda (ketuk benda untuk menghitung, mengambil, menghitung loncat per kelompok, atau membagikan permen ke piring) · 🔢 Susun Angka (papan angka, juga bisa memakai keyboard).

**Alur misi:** tujuan belajar → penjelasan singkat → contoh bergerak → soal → umpan balik → ringkasan → saran misi berikutnya.

- Jika salah: *"Tidak apa-apa, kita coba bersama, ya!"*, lalu bantuan dan percobaan kedua. Jika masih salah, cara lengkapnya ditunjukkan, lalu diberi soal mirip.
- Jika 2 kali berturut-turut belum benar, soal turun satu tingkat. Jika 3 kali benar berturut-turut, ada **Soal Tantangan** opsional.
- Bintang (1–3) per misi, 8 lencana capaian (Penjelajah Angka, Jago Penjumlahan, Sahabat Pengurangan, Ahli Perkalian, Pahlawan Pembagian, Juara Numerasi Sedjati, dll.). Bintang dan lencana tidak pernah dicabut.
- **Tes Awal** (opsional) untuk menentukan titik mulai, dan **Tes Akhir Level** (6 soal baru) setelah 2 misi selesai.
- **Progres Belajar:** tampilan anak (bintang, lencana, saran) dan tampilan orang tua/guru (statistik per operasi, status *Sedang berlatih / Mulai lancar / Dikuasai*, soal sulit + latihan ulang, hasil tes, aktivitas terbaru, reset).
- Beberapa pemain bisa memakai satu perangkat. Bisa juga main sebagai Tamu.

## Hubungkan ke Google Spreadsheet (opsional, ±5 menit)

Tanpa spreadsheet pun game tetap jalan: progres tersimpan otomatis di perangkat. Hubungkan spreadsheet jika guru ingin memantau semua anak di satu tempat.

Spreadsheet akan berisi dua tab:
- **Riwayat**: satu baris setiap misi/tes yang selesai (waktu, nama, kelompok, mode, jenis, level, area, misi, jumlah soal, benar langsung, benar setelah mencoba, belum benar, nilai, bintang, selesai, keterangan, lencana baru).
- **Rekap Siswa**: satu baris per anak yang selalu diperbarui (total bintang, misi selesai, lencana, ketepatan, status per operasi, yang perlu dilatih, saran berikutnya, hasil tes awal & akhir).

Langkah:
1. Buka <https://sheets.new> untuk membuat Spreadsheet baru, misalnya **Hasil Sedjati Numeracy**.
2. Klik **Ekstensi → Apps Script**.
3. Hapus semua isi `Code.gs`, lalu tempel seluruh isi [`apps-script/Code.gs`](apps-script/Code.gs). Klik 💾 **Simpan**.
4. Pilih fungsi **`setup`** lalu klik ▶ **Jalankan**. Izinkan akses (*Tinjau izin → pilih akun → Lanjutan → Buka proyek → Izinkan*). Tab **Riwayat** dan **Rekap Siswa** dibuat otomatis.
5. Klik **Terapkan (Deploy) → Deployment baru**. Klik ⚙️ lalu pilih **Aplikasi web**:
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja** (*Anyone*)
6. Klik **Terapkan**, lalu salin **URL aplikasi web** (berakhiran `/exec`).
7. Masukkan URL dengan salah satu cara:
   - **Cara A (disarankan, berlaku di semua perangkat):** buka `config.js`, isi `SHEET_API_URL: 'https://script.google.com/macros/s/XXXX/exec'`, lalu simpan ke GitHub.
   - **Cara B (hanya perangkat itu):** buka game → **Panduan Orang Tua & Guru** → **Google Spreadsheet (untuk guru)** → tempel URL → **Tes koneksi & simpan**.

Jika internet putus, hasil disimpan dulu di perangkat lalu dikirim otomatis saat online (atau lewat tombol **Kirim yang tertunda**). Gunakan URL Apps Script khusus game ini, bukan URL milik English Fun Games atau Arabku Ceria.

> Jika `Code.gs` diubah, gunakan **Terapkan → Kelola deployment → Edit → Versi: Versi baru** agar URL tetap sama.

## Menjalankan

Cukup buka `index.html` di browser (klik dua kali). Atau jalankan server lokal:

```bash
cd numerasi-sedjati
npx http-server -p 8080 -c-1 .   # lalu buka http://localhost:8080
```

## Online-kan di GitHub Pages

1. Gabungkan (merge) branch ini ke `main`.
2. Di GitHub buka **Settings → Pages**, lalu pilih *Source*: **Deploy from a branch** → `main` / `(root)` → **Save**.
3. Setelah 1–2 menit, game bisa dibuka di:
   `https://sulthonhaekal93.github.io/sulthonhaekal93/numerasi-sedjati/`

Tidak perlu proses build. Semua file statis.

## Tes

```bash
cd numerasi-sedjati
npm test             # mesin soal, progres & spreadsheet (Node, tanpa dependensi)
npm install          # sekali saja, untuk Playwright
npm run test:e2e     # tes browser: alur bermain, 320px–1280px, data rusak, dll.
```

## Struktur file

```
numerasi-sedjati/
├── index.html          kerangka halaman + beranda
├── config.js           URL Google Spreadsheet (opsional)
├── apps-script/Code.gs penerima data di Google Spreadsheet
├── css/style.css       tampilan (responsif, mendukung "kurangi gerak")
├── js/curriculum.js    6 area, misi, mode, kelompok belajar
├── js/generator.js     mesin soal lokal + validasi
├── js/progress.js      penyimpanan, statistik, lencana, rekomendasi, tes
├── js/sheet.js         kirim ke spreadsheet + antrean offline
├── js/visuals.js       gambar benda & interaksi hitung benda
├── js/app.js           layar & alur permainan
└── tests/              tes Node & Playwright
```

**Menambah soal:** tambahkan langkah baru di `curriculum.js` (judul, misi, tujuan, konsep) dan fungsi pembuat soal di `generator.js` pada urutan yang sama. Tes akan memeriksa bahwa jumlahnya cocok.

**Data:** selalu tersimpan di `localStorage` dengan kunci `sedjati-numeracy-adventure:v1` dalam satu objek berversi (daftar pemain → misi, statistik, riwayat). Strukturnya bisa langsung dikirim ke backend nanti. Hanya nama panggilan yang disimpan, bukan data pribadi lain. Jika spreadsheet dihubungkan, nama panggilan, kelompok, dan hasil belajar juga dikirim ke spreadsheet milik guru.

## Keterbatasan

- Progres hanya ada di satu perangkat/browser. Menghapus data browser juga menghapus progres.
- Pembacaan soal memakai suara bawaan perangkat. Jika tidak ada suara bahasa Indonesia, suaranya bisa terdengar kurang alami atau tidak tersedia.
- Font (Fredoka, Nunito) dimuat dari Google Fonts. Tanpa internet, tampilan memakai font cadangan perangkat.
- Belum ada seret-lepas (drag-and-drop). Semua interaksi memakai ketukan.
- Progres di spreadsheet hanya untuk dipantau guru. Progres anak di game tetap tersimpan per perangkat (pindah perangkat = mulai dari awal di game).
