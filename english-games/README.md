# 🎮 English Fun Games

Website game belajar Bahasa Inggris untuk anak SD. Bisa dibuka di HP, tablet, atau laptop, tanpa instalasi.

## Isi

| Game | Cara main | Level 1 (Mudah) | Level 2 (Sedang) | Level 3 (Sulit) |
|---|---|---|---|---|
| 🧩 **TTS** | Isi teka-teki silang | 10 kata, ada gambar + arti, huruf pertama sudah diisi | 12 kata, gambar + arti | 15 kata, petunjuk hanya arti |
| 🔍 **Word Search** | Geser jari / ketuk huruf awal lalu huruf akhir | 10 kata, kotak 10×10, mendatar & menurun | 12 kata, 12×12, ditambah diagonal | 15 kata, 14×14, semua arah, kata disembunyikan (hanya arti) |
| 🔤 **Susun Kata** | Ketuk huruf sesuai urutan | 10 soal, gambar + arti + suara | 12 soal, gambar + suara | 15 soal, hanya arti + 2 huruf pengecoh |
| 🖼️ **Match Picture** | Pilih kata yang cocok dengan gambar | 10 soal, 3 pilihan + arti | 12 soal, 4 pilihan | 15 soal, 4 pilihan mirip + batas waktu 12 detik |
| 📝 **Susun Kalimat** | Ketuk kata sesuai urutan kalimat | 10 kalimat pendek + arti | 12 kalimat sedang + arti | 15 kalimat panjang, arti disembunyikan |

**Tema:** Warna, Angka, Hewan, Buah, Sayuran, Pekerjaan, Kata Benda Sekitar, Peralatan Sekolah, Nama Tempat, Kata Kerja Sederhana, dan Campuran (gabungan semua tema).

Soal diacak setiap kali bermain, jadi anak bisa mengulang tanpa bosan.

**Fitur lain:**
- Input nama + kelas saat masuk.
- Pengucapan kata/kalimat (🔊) dengan suara bawaan perangkat.
- Skor, bintang (⭐ 1–3), dan 11 lencana prestasi.
- **Papan Prestasi**: peringkat (filter per game/tema/level), koleksi lencana, dan riwayat bermain.
- Skor tersimpan ke **Google Spreadsheet**. Kalau internet putus, skor disimpan dulu di perangkat lalu dikirim otomatis.

## Penilaian
- Setiap soal benar bernilai 10 poin. Pada Susun Kata dan Susun Kalimat, anak punya 2 kali kesempatan (benar di percobaan kedua = 5 poin).
- Bantuan TTS −2 poin, bantuan Word Search −3 poin.
- Nilai = poin ÷ poin maksimal × 100. ⭐⭐⭐ ≥ 90, ⭐⭐ ≥ 70, ⭐ ≥ 50.

---

## 1. Hubungkan ke Google Spreadsheet (±5 menit)

1. Buka <https://sheets.new> untuk membuat Spreadsheet baru, misalnya dengan nama **Skor English Fun Games**.
2. Klik menu **Ekstensi → Apps Script**.
3. Hapus semua isi `Code.gs`, lalu tempel seluruh isi file [`apps-script/Code.gs`](apps-script/Code.gs). Klik 💾 **Simpan**.
4. Di bagian atas, pilih fungsi **`setup`** lalu klik ▶ **Jalankan**. Izinkan akses (*Tinjau izin → pilih akun → Lanjutan → Buka proyek → Izinkan*). Sheet **Skor** akan dibuat otomatis.
5. Klik **Terapkan (Deploy) → Deployment baru**. Klik ⚙️ lalu pilih **Aplikasi web**, kemudian isi:
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja** (*Anyone*)
6. Klik **Terapkan**, lalu salin **URL aplikasi web** (berakhiran `/exec`).
7. Masukkan URL itu dengan salah satu cara berikut:
   - **Cara A (disarankan, berlaku di semua perangkat):** buka `config.js`, lalu isi `SHEET_API_URL: 'https://script.google.com/macros/s/XXXX/exec'`.
   - **Cara B (hanya untuk perangkat itu):** di halaman awal website, klik **⚙️ Pengaturan**, tempel URL, klik **Tes Koneksi**, lalu **Simpan**.

Kolom yang tersimpan: Waktu, Nama, Kelas, Game, Tema, Level, Poin, Poin Maks, Benar, Jumlah Soal, Nilai, Bintang, Durasi, Bantuan, Lencana.

> Jika nanti `Code.gs` diubah, gunakan **Terapkan → Kelola deployment → Edit → Versi: Versi baru** agar URL tetap sama.

## 2. Online-kan website (GitHub Pages)

1. Gabungkan (merge) branch ini ke `main`.
2. Di GitHub, buka **Settings → Pages**, lalu pilih *Source*: **Deploy from a branch** → `main` / `(root)` → **Save**.
3. Setelah 1–2 menit, website bisa dibuka di:
   `https://sulthonhaekal93.github.io/sulthonhaekal93/english-games/`

Bisa juga dibuka langsung tanpa internet dengan membuka file `index.html` di browser. Namun, simpan ke Spreadsheet tetap butuh internet.

## 3. Menambah / mengubah soal

Semua kata dan kalimat ada di **`data.js`**:
- Kata: `['apple', 'apel', '🍎', 1]`, yaitu kata Inggris, arti, gambar (emoji), dan tingkat (1 mudah, 2 sedang, 3 sulit).
- Kalimat: pola seperti `['I eat {a} {w}.', 'Aku makan {id}.']`. `{w}` diganti kata dari tema, `{a}` menjadi *a/an*, dan `{id}` menjadi artinya.

## Struktur file
```
english-games/
├── index.html        halaman utama
├── style.css         tampilan
├── config.js         URL Google Apps Script
├── data.js           bank soal (kata & kalimat per tema)
├── engine.js         pembuat soal, TTS, word search, peringkat
├── app.js            alur game, skor, lencana, papan prestasi
└── apps-script/
    └── Code.gs       kode Google Apps Script untuk Spreadsheet
```
