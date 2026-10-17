# Arabku Ceria 🐫

Game belajar bahasa Arab untuk anak SD. Cukup buka `index.html` di browser (HP, tablet, atau laptop). Tidak perlu instalasi.

## Materi (7 topik)
| Topik | Isi |
|---|---|
| Benda di Sekitarku (أَشْيَاءُ حَوْلَنَا) | 19 kata benda: buku, pena, pintu, kursi, rumah, mobil, apel, kucing, dll. |
| Warna-warni (أَلْوَانٌ) | 11 warna: merah, biru, hijau, kuning, putih, hitam, oranye, cokelat, merah muda, ungu, abu-abu |
| Angka 1–10 (أَعْدَادٌ) | وَاحِدٌ sampai عَشَرَةٌ, lengkap dengan angka Arab ١–١٠ dan latihan berhitung |
| Anggota Tubuh (أَعْضَاءُ الْجِسْمِ) | 13 kata: wajah, mata, telinga, hidung, mulut, gigi, lidah, rambut, tangan, jari, lengan, kaki, jantung |
| Hewan (حَيَوَانَاتٌ) | 15 hewan: singa, gajah, unta, kuda, sapi, domba, kelinci, monyet, ikan, burung, ayam, bebek, semut, kupu-kupu, kura-kura |
| Keluargaku (أُسْرَتِي) | 13 kata: keluarga, ayah, ibu, saudara, anak, kakek, nenek, serta عَمٌّ/عَمَّةٌ (paman/bibi dari ayah) dan خَالٌ/خَالَةٌ (paman/bibi dari ibu) |
| Kata Sambung (حُرُوفُ الْعَطْفِ) | وَ، أَوْ، ثُمَّ، لٰكِنْ، فَـ، لِأَنَّ، حَتَّى beserta 15 contoh kalimat |

## Permainan
1. **Kartu Belajar**: kartu bergambar yang dibalik untuk melihat dan mendengar kata Arabnya (latihan, tanpa nilai).
2. **Tebak Kata**: dengar kata Arab lalu pilih gambarnya, atau lihat gambar lalu pilih kata Arabnya. 10 soal.
3. **Kartu Kembar**: permainan memori mencocokkan gambar dengan kata Arab. 6 pasang.
4. **Letus Balon**: letuskan 8 balon yang kata Arabnya cocok dengan gambar, sebelum 3 nyawa habis.
5. **Lengkapi Kalimat** (khusus kata sambung): isi 8 kalimat dengan kata sambung yang tepat.

## Penilaian (sama dengan English Fun Games)
- Murid mengisi **nama + kelas** sebelum bermain.
- Setiap jawaban benar bernilai **10 poin**.
  - Kartu Kembar: 6 pasang = 60 poin, setiap salah tebak −2 poin.
  - Letus Balon: 8 balon = 80 poin, setiap salah ketuk −3 poin.
- **Nilai** = poin ÷ poin maksimal × 100. ⭐⭐⭐ ≥ 90, ⭐⭐ ≥ 70, ⭐ ≥ 50.
- **12 lencana**: Langkah Pertama, Bintang Kelas, Mumtaz!, Secepat Kilat, Ingatan Gajah, Raja Balon, Ahli Kalimat, Juara Bahasa Arab, Penjelajah Game, Pelangi Topik, Rajin Belajar, Pantang Menyerah.
- **Papan Prestasi**: peringkat (filter per game dan topik), koleksi lencana, dan riwayat bermain.
- Nilai tersimpan ke **Google Spreadsheet**. Kalau internet putus, nilai disimpan dulu di perangkat lalu dikirim otomatis.

---

## 1. Hubungkan ke Google Spreadsheet (±5 menit)

Gunakan Spreadsheet **terpisah** dari English Fun Games.

1. Buka <https://sheets.new>, beri nama misalnya **Nilai Arabku Ceria**.
2. Klik menu **Ekstensi → Apps Script**.
3. Hapus semua isi `Code.gs`, lalu tempel seluruh isi file [`apps-script/Code.gs`](apps-script/Code.gs). Klik 💾 **Simpan**.
4. Pilih fungsi **`setup`** lalu klik ▶ **Jalankan**. Izinkan akses (*Tinjau izin → pilih akun → Lanjutan → Buka proyek → Izinkan*). Sheet **Nilai** akan dibuat otomatis.
5. Klik **Terapkan (Deploy) → Deployment baru**. Klik ⚙️ lalu pilih **Aplikasi web**:
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja** (*Anyone*)
6. Klik **Terapkan**, lalu salin **URL aplikasi web** (berakhiran `/exec`).
7. Masukkan URL itu dengan salah satu cara:
   - **Cara A (disarankan, berlaku di semua perangkat):** buka `index.html`, cari `APP_CONFIG`, lalu isi `SHEET_API_URL: 'https://script.google.com/macros/s/XXXX/exec'`.
   - **Cara B (hanya untuk perangkat itu):** di halaman awal, klik **⚙️ Pengaturan**, tempel URL, klik **Tes Koneksi**, lalu **Simpan**.

Kolom yang tersimpan: Waktu, Nama, Kelas, Game, Topik, Poin, Poin Maks, Benar, Jumlah Soal, Nilai, Bintang, Durasi, Lencana.

> Jika nanti `Code.gs` diubah, gunakan **Terapkan → Kelola deployment → Edit → Versi: Versi baru** agar URL tetap sama.

## 2. Online-kan website (GitHub Pages)

Setelah branch ini digabung ke `main` dan GitHub Pages aktif, game bisa dibuka di:
`https://sulthonhaekal93.github.io/sulthonhaekal93/arabic-games/`

## Catatan untuk guru
- Pelafalan memakai suara Text-to-Speech bawaan perangkat. Jika suara Arab belum terpasang, game tetap bisa dimainkan dengan tulisan latin. Di Android: Pengaturan → Text-to-Speech → unduh bahasa Arab.
- Kosakata ada di bagian `TOPICS` dan `SENTENCES` di dalam `index.html` dan mudah ditambah.
