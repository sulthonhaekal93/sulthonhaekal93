# 🌱 Sedjati Numeracy Adventure

**Taman Belajar Sedjati — "Belajar, Bermain, Berhitung!"**

Game numerasi berbahasa Indonesia untuk anak TK sampai kelas 6 SD. Anak belajar penjumlahan, pengurangan, perkalian, dan pembagian lewat benda, kelompok, garis bilangan, dan blok puluhan, dengan umpan balik yang ramah. Bisa dibuka di HP Android, tablet, dan laptop. Tidak perlu server, tidak ada iklan, dan tidak ada data yang dikirim ke internet.

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
npm test             # mesin soal & progres (Node, tanpa dependensi)
npm install          # sekali saja, untuk Playwright
npm run test:e2e     # tes browser: alur bermain, 320px–1280px, data rusak, dll.
```

## Struktur file

```
numerasi-sedjati/
├── index.html          kerangka halaman + beranda
├── css/style.css       tampilan (responsif, mendukung "kurangi gerak")
├── js/curriculum.js    6 area, misi, mode, kelompok belajar
├── js/generator.js     mesin soal lokal + validasi
├── js/progress.js      penyimpanan, statistik, lencana, rekomendasi, tes
├── js/visuals.js       gambar benda & interaksi hitung benda
├── js/app.js           layar & alur permainan
└── tests/              tes Node & Playwright
```

**Menambah soal:** tambahkan langkah baru di `curriculum.js` (judul, misi, tujuan, konsep) dan fungsi pembuat soal di `generator.js` pada urutan yang sama. Tes akan memeriksa bahwa jumlahnya cocok.

**Data:** tersimpan di `localStorage` dengan kunci `sedjati-numeracy-adventure:v1` dalam satu objek berversi (daftar pemain → misi, statistik, riwayat). Strukturnya bisa langsung dikirim ke backend nanti. Hanya nama panggilan yang disimpan, bukan data pribadi lain.

## Keterbatasan

- Progres hanya ada di satu perangkat/browser. Menghapus data browser juga menghapus progres.
- Pembacaan soal memakai suara bawaan perangkat. Jika tidak ada suara bahasa Indonesia, suaranya bisa terdengar kurang alami atau tidak tersedia.
- Font (Fredoka, Nunito) dimuat dari Google Fonts. Tanpa internet, tampilan memakai font cadangan perangkat.
- Belum ada seret-lepas (drag-and-drop). Semua interaksi memakai ketukan.
- Belum terhubung ke Google Spreadsheet seperti game lain di repositori ini.
