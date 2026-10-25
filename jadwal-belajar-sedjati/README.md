# Dashboard Jadwal Belajar — Taman Belajar Sedjati

Website untuk orang tua: melihat jadwal belajar anak dan mengajukan izin tidak masuk lewat WhatsApp admin.
Admin cukup mengubah Google Sheets; website langsung membaca data terbaru tanpa mengubah kode.

| Bagian | Teknologi |
|---|---|
| Tampilan | HTML5, CSS3, JavaScript murni (tanpa framework, tanpa build) |
| Server | Google Apps Script (V8) |
| Database | Google Sheets (tetap privat) |
| Hosting | Google Apps Script Web App (HtmlService) — gratis |
| Izin | WhatsApp Click to Chat (`wa.me`) |
| Ikon | SVG bergaya Lucide yang ditanam langsung (tanpa CDN) |

## Daftar file

| File | Fungsi |
|---|---|
| `apps-script/Code.gs` | Backend: web app, verifikasi orang tua, jadwal, izin, menu admin, `setupSpreadsheet()` |
| `apps-script/DemoData.gs` | Data demo untuk uji coba + fungsi menghapusnya. **Bukan data produksi.** |
| `apps-script/Index.html` | Kerangka halaman |
| `apps-script/Styles.html` | CSS (mobile-first) |
| `apps-script/Scripts.html` | JavaScript frontend |
| `apps-script/appsscript.json` | Manifest: zona waktu `Asia/Jakarta`, izin akses minimal, pengaturan web app |
| `tests/` | Tes otomatis di komputer (tidak perlu disalin ke Apps Script) |
| `tools/build-preview.js` | Membuat satu file HTML pratinjau (tanpa akun Google) dari kode yang sama, dengan data demo dan simulasi Sheets. Tidak perlu disalin ke Apps Script. |

---

## Tahap 1 — Arsitektur

### Alur sistem

```
Orang tua (HP, buka link dari WhatsApp)
   │ 1. isi nama anak + kode akses
   ▼
Web App Apps Script ── verifyStudentAccess() ──► sheet Murid
   │ 2. cocok & aktif → token sesi acak (30 menit, disimpan di CacheService)
   │    + jadwal milik anak itu saja (dari sheet Jadwal)
   ▼
Dashboard: kartu jadwal / tampilan per hari
   │ 3. "Perbarui Jadwal" → getStudentSchedule(token) → baca ulang sheet Jadwal
   │ 4. "Izin Tidak Masuk" → formulir → logLeaveRequest(token, …)
   │       server memvalidasi tanggal/alasan, mencatat ke sheet Perizinan
   │       (status "Menunggu konfirmasi admin"), menyusun pesan & tautan wa.me
   ▼
Tombol "Buka WhatsApp Admin" → WhatsApp terbuka dengan pesan terisi
   │ 5. orang tua menekan KIRIM di WhatsApp
   ▼
Admin membaca WhatsApp, membalas, lalu mengubah status di sheet Perizinan
```

Prinsip yang dijaga:

- Browser **tidak pernah** menerima daftar murid, `student_id`, kode akses, atau ID spreadsheet.
- Jadwal diambil lewat **token sesi**, bukan `student_id`, sehingga menebak ID tidak membuka jadwal anak lain.
  (Itu sebabnya `getStudentSchedule` menerima token, bukan `studentId` seperti contoh di permintaan.)
- Semua validasi diulang di server. Validasi di browser hanya untuk kenyamanan.
- Spreadsheet **tidak dibagikan** ke publik. Web app berjalan sebagai akun admin
  ("Execute as: Me"), jadi orang tua tidak pernah mendapat akses ke file Sheets.

### Struktur Google Sheets

**Murid** — satu baris per anak

| Kolom | Isi | Contoh |
|---|---|---|
| student_id | ID unik | `S001` |
| nama_anak | Nama lengkap, seperti yang akan diketik orang tua | `Ahmad Fauzan` |
| kode_akses | Kode rahasia untuk orang tua (huruf/angka, disarankan 6) | `K7M2QX` |
| status_murid | `Aktif` / `Cuti` / `Nonaktif` | `Aktif` |

**Jadwal** — satu baris per program; satu anak boleh punya banyak baris

| Kolom | Isi | Contoh |
|---|---|---|
| schedule_id | ID unik | `J001` |
| student_id | dari sheet Murid | `S001` |
| program | Nama program | `Bahasa Inggris` |
| hari | Satu atau beberapa hari | `Senin, Rabu` |
| jam_mulai / jam_selesai | Format 24 jam | `15.30` / `16.30` |
| tutor | Nama tutor | `Kak Aisyah` |
| status_jadwal | `Aktif` / `Nonaktif` | `Aktif` |
| tanggal_mulai / tanggal_selesai | Opsional, masa berlaku | `2026-07-01` |
| updated_at | Terisi otomatis saat baris diubah | `2026-10-25 09:12:00` |

**Perizinan** — diisi otomatis oleh website (jika `catat_izin = ya`)

| Kolom | Isi |
|---|---|
| izin_id | Kode pengajuan, juga tercantum di pesan WhatsApp (`IZN-20261026-KVBY`) |
| student_id, schedule_id | Anak dan jadwal yang diizinkan |
| tanggal_pertemuan | Tanggal pertemuan yang ditinggalkan |
| alasan | `Sakit` / `Keperluan keluarga` / `Lainnya` |
| catatan | Keterangan dari orang tua (maks. 300 karakter) |
| status_pengajuan | Awal: `Menunggu konfirmasi admin`. Admin mengubah ke `Diterima`, `Ditolak`, atau `Tidak ada pesan WA` |
| created_at | Waktu pengajuan (WIB) |

> Kenapa bukan "Dikirim"? Website hanya bisa **membuka** WhatsApp. Sistem tidak bisa tahu apakah orang tua
> benar-benar menekan tombol kirim. Karena itu status awal selalu "Menunggu konfirmasi admin", dan izin
> baru dianggap sah setelah admin menerima pesan WhatsApp-nya.

**Pengaturan** — `key` / `value` (+ kolom `keterangan` sebagai penjelasan)

| key | Bawaan | Fungsi |
|---|---|---|
| nama_lembaga | Taman Belajar Sedjati | Nama di website & pesan WA |
| whatsapp_admin | 085743008511 | Nomor penerima izin (otomatis diubah ke `6285743008511`) |
| logo_url | (kosong) | Alamat gambar logo `https://…`; kosong = logo teks "TBS" |
| info_header | Jadwal diperbarui oleh admin… | Keterangan di bagian atas |
| catat_izin | ya | `ya` = pengajuan dicatat di sheet Perizinan; `tidak` = hanya membuka WA |
| retensi_izin_hari | 90 | Umur maksimal catatan izin sebelum dihapus otomatis |
| pesan_gagal_spesifik | tidak | Lihat bagian keamanan |

Hanya `nama_lembaga`, `logo_url`, dan `info_header` yang dikirim ke browser sebelum verifikasi.
Jangan menaruh password atau rahasia apa pun di sheet ini.

### Integrasi WhatsApp

1. Orang tua mengisi formulir izin: tanggal hanya bisa dipilih dari pertemuan yang sesuai hari jadwal
   dan masa berlakunya (60 hari ke depan).
2. Server memeriksa ulang semuanya, mencatat pengajuan, lalu menyusun pesan dari **data jadwal aktual** dan
   membuat tautan `https://wa.me/6285743008511?text=` + `encodeURIComponent(pesan)`.
3. Website menampilkan layar **"WhatsApp siap dibuka"** dengan tombol besar "Buka WhatsApp Admin".

Kenapa dua langkah (Lanjutkan → Buka WhatsApp), bukan langsung terbuka? Pencatatan ke server butuh waktu
sesaat; browser HP memblokir jendela yang dibuka setelah jeda itu (pop-up blocker). Tombol kedua adalah
tautan biasa yang ditekan langsung oleh orang tua, jadi selalu bisa dibuka — termasuk di browser bawaan WhatsApp.

Contoh pesan yang dihasilkan:

```
Assalamu'alaikum Admin Taman Belajar Sedjati.

Saya ingin mengajukan izin tidak masuk untuk anak saya.

Nama anak: Ahmad Fauzan
Program: Bahasa Inggris
Hari/tanggal pertemuan: Senin, 26 Oktober 2026
Jam belajar: 15.30–16.30
Tutor: Kak Aisyah
Alasan: Sakit
Catatan: Sedang demam.
Kode pengajuan: IZN-20261026-KVBY

Mohon izin ketidakhadiran ini dicatat. Terima kasih.

Wassalamu'alaikum.
```

---

## Tahap 2 — Kode lengkap

Kode lengkap ada di folder [`apps-script/`](apps-script/). Fungsi yang dipanggil browser:

| Fungsi | Dipanggil dari | Keterangan |
|---|---|---|
| `doGet(e)` | membuka URL web app | Menyajikan `Index.html` |
| `getPublicSettings()` | `doGet` | Nama lembaga, logo, info header |
| `verifyStudentAccess(nama, kode)` | tombol "Lihat Jadwal" | Mengembalikan token + jadwal |
| `getStudentSchedule(token)` | tombol "Perbarui Jadwal" | Jadwal terbaru dari Sheets |
| `logLeaveRequest(token, request)` | tombol "Lanjutkan ke WhatsApp" | Validasi, catat, susun tautan WA |

Fungsi berakhiran `_` (misalnya `readTable_`) bersifat privat: Apps Script tidak mengizinkan browser memanggilnya.

---

## Tahap 3 — Setup database

1. Buka [sheets.new](https://sheets.new) dengan akun Google milik lembaga. Beri nama, misalnya
   **"Database Jadwal TBS"**. **Jangan** bagikan file ini ke orang tua atau ke "Siapa saja yang memiliki link".
2. Menu **Ekstensi → Apps Script**. Project Apps Script yang terbuka sudah terikat ke spreadsheet ini.
3. Salin file (lihat Tahap 4 langkah 2), simpan, lalu di editor pilih fungsi **`setupSpreadsheet`** → **Jalankan**.
4. Saat diminta izin: pilih akun Anda → *Advanced/Lanjutan* → *Go to … (unsafe)* → *Allow*.
   Peringatan "unsafe" muncul karena script ini buatan sendiri, bukan dari Google; izin yang diminta hanya
   untuk spreadsheet ini, menampilkan menu, dan menjadwalkan pembersihan.
5. Kembali ke spreadsheet dan muat ulang halaman. Akan muncul menu **Taman Belajar** dan 4 sheet:
   Murid, Jadwal, Perizinan, Pengaturan — lengkap dengan header hijau, dropdown status, dan catatan bantuan
   di setiap judul kolom (arahkan kursor ke judul kolom untuk membacanya).
6. Untuk uji coba: menu **Taman Belajar → Muat data DEMO**. Kode akses demo:

   | Nama | Kode | Untuk menguji |
   |---|---|---|
   | Ahmad Fauzan | DEMO01 | 2 program (Bahasa Inggris Senin & Rabu, Matematika Kamis) + 1 jadwal nonaktif yang harus tersembunyi |
   | Aisyah Putri | DEMO02 | Sempoa Selasa + 1 jadwal yang masa berlakunya sudah lewat |
   | Muhammad Raihan | DEMO03 | Calistung Rabu |
   | Budi Contoh | DEMO04 | Murid nonaktif |

   > ⚠️ **Semua nama dan jadwal demo adalah contoh.** Website menampilkan pita kuning "DATA DEMO" untuk data ini.
   > Jalankan **Taman Belajar → Hapus semua data DEMO** sebelum link dibagikan ke orang tua.

`setupSpreadsheet()` aman dijalankan ulang: data yang sudah ada tidak dihapus dan pengaturan tidak digandakan.

---

## Tahap 4 — Deployment

1. **Buat project:** dari spreadsheet, **Ekstensi → Apps Script**. Ganti nama project menjadi
   "Dashboard Jadwal TBS".
2. **Salin file:**
   - Isi `Code.gs` bawaan dengan isi `apps-script/Code.gs`.
   - Tambah file script (ikon **+** → *Script*) bernama `DemoData`, isi dengan `DemoData.gs`.
   - Tambah file HTML (ikon **+** → *HTML*) bernama persis `Index`, `Styles`, `Scripts` (tanpa `.html`),
     isi dengan file yang sesuai. Hapus seluruh isi bawaan sebelum menempel.
   - **Project Settings** (ikon roda gigi) → centang *Show "appsscript.json" manifest file in editor* →
     buka `appsscript.json` dan ganti isinya dengan `apps-script/appsscript.json`.
3. **Zona waktu:** sudah diatur `Asia/Jakarta` lewat manifest. Periksa di **Project Settings → Time zone**
   dan di spreadsheet **File → Setelan → Zona waktu** (`setupSpreadsheet()` juga mengaturnya).
4. **Uji fungsi di editor:** jalankan `setupSpreadsheet`, lalu `loadDemoData`, lalu `checkData`
   (hasilnya tampil di *Execution log*; jika dari menu Sheets, muncul sebagai kotak pesan).
5. **Terbitkan:** **Deploy → New deployment** → ikon roda gigi → **Web app**:
   - *Description*: `Versi 1`
   - *Execute as*: **Me (email admin)** — script membaca Sheets dengan akun admin, orang tua tidak perlu akses ke file.
   - *Who has access*: **Anyone** — orang tua bisa membuka tanpa login Google.
     (Pilih *Anyone with Google account* jika ingin mewajibkan login Google; lebih aman tapi menyulitkan
     orang tua yang tidak login di browser HP.)
   - Klik **Deploy**, salin **Web app URL** (berakhiran `/exec`). Inilah link untuk orang tua.
6. **Memperbarui kode di kemudian hari:** **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
   URL tetap sama. Perubahan **data** di Sheets tidak perlu deploy ulang sama sekali.
7. (Opsional) **Taman Belajar → Aktifkan pembersihan izin otomatis** — menghapus catatan izin yang lebih
   lama dari `retensi_izin_hari` setiap hari pukul 02.00 WIB.
8. Pastikan spreadsheet tetap privat: tombol **Bagikan** di Sheets hanya berisi admin/staf, dan
   *Akses umum* = **Dibatasi**.

Catatan: halaman web app Google menampilkan pita kecil "This application was created by a Google Apps Script user"
di bagian atas. Itu bawaan Google dan tidak bisa dihilangkan pada hosting gratis ini.

**Logo:** isi `logo_url` di sheet Pengaturan dengan alamat gambar `https://…` yang bisa dibuka publik
(misalnya file logo di website lembaga atau GitHub). Jika gambar gagal dimuat, logo teks "TBS" tetap tampil.

---

## Tahap 5 — Pengujian

### Tes otomatis (opsional, di komputer)

```bash
cd jadwal-belajar-sedjati
node tests/backend.test.js   # 99 pemeriksaan backend dengan Google Sheets tiruan
node tests/ui.test.js        # 56 pemeriksaan tampilan di Chromium (HP 390px & desktop), butuh Playwright
```

Tes ini menjalankan `Code.gs` yang sama dengan tiruan layanan Google. Tes tetap tidak menggantikan uji coba di
Apps Script sungguhan di bawah ini.

### Checklist uji manual (setelah deploy, dengan data DEMO)

**Pencarian & verifikasi**
- [ ] Halaman awal hanya menampilkan formulir; tidak ada nama murid di halaman.
- [ ] Tombol "Lihat Jadwal" tanpa isian → pesan "Mohon isi nama anak".
- [ ] `ahmad fauzan` + `demo01` (huruf kecil) → berhasil.
- [ ] `Ahmad Fauzan` + `SALAH1` → "Nama anak atau kode akses tidak cocok".
- [ ] Nama yang tidak terdaftar → pesan yang sama (tidak membocorkan nama terdaftar).
- [ ] `Aisyah Putri` + `DEMO01` (kode anak lain) → ditolak.
- [ ] 5× salah untuk nama yang sama → "Terlalu banyak percobaan"; kode benar pun ditolak 15 menit.
- [ ] `Budi Contoh` + `DEMO04` → "Status murid saat ini Nonaktif…".

**Tampilan jadwal**
- [ ] Ahmad: 2 kartu (Bahasa Inggris "Senin dan Rabu 15.30–16.30 Kak Aisyah", Matematika Kamis).
      Jadwal "kelas lama" (Nonaktif) **tidak** tampil.
- [ ] Aisyah: hanya Sempoa; "Mengaji (sudah selesai)" tidak tampil.
- [ ] Pita kuning "DATA DEMO" muncul.
- [ ] Tab **Per Hari**: Senin–Minggu berurutan, hari kosong bertuliskan "Tidak ada jadwal", hari ini ditandai.
- [ ] Tampilan rapi di HP (tidak ada geser ke samping) dan di laptop.

**Perubahan jadwal**
- [ ] Ubah tutor Matematika di sheet Jadwal → tekan "Perbarui Jadwal" → tutor baru tampil; `updated_at` terisi.
- [ ] Ubah `status_jadwal` menjadi Nonaktif → setelah diperbarui kartu hilang.
- [ ] Isi `tanggal_selesai` dengan tanggal kemarin → kartu hilang.
- [ ] Ubah `status_murid` menjadi Cuti saat orang tua sedang membuka dashboard → "Perbarui Jadwal" mengembalikan
      ke formulir dengan pesan status.

**Pengajuan izin**
- [ ] "Izin Tidak Masuk" → nama, program, jam, tutor terisi otomatis.
- [ ] Pilihan tanggal hanya hari sesuai jadwal (Bahasa Inggris: Senin & Rabu saja).
- [ ] Kirim tanpa tanggal/alasan → "Formulir belum lengkap…".
- [ ] Alasan "Lainnya" tanpa catatan → diminta mengisi catatan.
- [ ] Isian lengkap → layar "WhatsApp siap dibuka" + kode pengajuan; sheet Perizinan bertambah 1 baris
      berstatus "Menunggu konfirmasi admin".
- [ ] "Buka WhatsApp Admin" membuka chat ke 0857-4300-8511 dengan pesan lengkap (cek tanggal, jam, tutor, baris baru).
- [ ] Ulangi pengajuan yang sama → kode pengajuan sama, tidak ada baris ganda.
- [ ] Ubah `catat_izin` ke `tidak` → WhatsApp tetap bisa dibuka, sheet tidak bertambah, pesan tanpa kode pengajuan.

**Keamanan & privasi**
- [ ] Buka spreadsheet dari browser yang tidak login (mode penyamaran) dengan link spreadsheet → harus ditolak.
- [ ] Lihat sumber halaman (view-source) web app → tidak ada nama murid lain, kode akses, atau ID spreadsheet.
- [ ] URL web app tidak berubah/berisi nama anak setelah login.
- [ ] Tekan "Keluar" → jadwal hilang dari layar.
- [ ] Catatan berisi `=1+1` tersimpan sebagai teks, bukan rumus.
- [ ] Data DEMO sudah dihapus sebelum link dibagikan.

---

## Tahap 6 — Operasional harian admin

**Menambah murid**
1. Sheet **Murid** → isi `nama_anak` di baris kosong (kolom lain boleh kosong).
2. Menu **Taman Belajar → Lengkapi ID & kode akses** → `student_id` (S001, S002, …), kode akses 6 karakter, dan
   status `Aktif` terisi otomatis.
3. Kirim kode akses **secara pribadi** ke orang tua murid itu, bersama link web app. Contoh:
   > Assalamu'alaikum Bapak/Ibu. Jadwal belajar Ananda bisa dilihat di: *(link)*
   > Nama anak: Ahmad Fauzan · Kode akses: K7M2QX (mohon tidak dibagikan).

**Menambah program / jadwal**
1. Sheet **Jadwal** → baris baru: `student_id`, `program`, `hari` (mis. `Senin, Rabu`), `jam_mulai`, `jam_selesai`,
   `tutor`. Anak dengan 2 program = 2 baris.
2. **Lengkapi ID & kode akses** untuk mengisi `schedule_id` dan status `Aktif`.

**Mengganti tutor / mengubah hari atau jam** — ubah sel di sheet Jadwal. Selesai. Orang tua melihat perubahan
saat membuka ulang halaman atau menekan "Perbarui Jadwal".

**Menghentikan jadwal** — ubah `status_jadwal` menjadi `Nonaktif`, atau isi `tanggal_selesai`. Jangan hapus barisnya
bila masih ada catatan izin yang merujuk ke jadwal itu.

**Murid cuti/berhenti** — ubah `status_murid` menjadi `Cuti` atau `Nonaktif`.

**Kode akses bocor / orang tua lupa** — hapus isi `kode_akses` murid itu → **Lengkapi ID & kode akses** → kirim kode baru.
Sesi lama di HP lain otomatis berakhir.

**Setelah mengubah data** — jalankan **Taman Belajar → Periksa kesalahan data**. Menu ini menunjukkan baris yang tidak
akan tampil di website (hari salah ketik, jam tidak valid, `student_id` tidak ada, dll.).

**Menangani pesan izin setiap hari**
1. Buka WhatsApp admin; pesan izin selalu memuat **Kode pengajuan** (`IZN-…`).
2. Di sheet **Perizinan**, cari kode itu (Ctrl+F), ubah `status_pengajuan` menjadi `Diterima` (atau `Ditolak`).
3. Balas orang tua di WhatsApp, misalnya "Izin diterima, semoga lekas sembuh."
4. Beri tahu tutor terkait (filter sheet Perizinan berdasarkan `tanggal_pertemuan` hari ini).
5. Baris yang masih "Menunggu konfirmasi admin" tetapi tidak pernah ada pesan WhatsApp-nya (orang tua tidak menekan
   kirim) → ubah menjadi `Tidak ada pesan WA`.
6. Catatan izin lama terhapus otomatis setelah `retensi_izin_hari` (jika pembersihan otomatis diaktifkan).

---

## Keamanan, privasi, dan keterbatasan (harap dibaca)

Yang sudah diterapkan:

- Verifikasi **nama + kode akses**; nama saja tidak cukup.
- Pesan gagal dibuat umum ("nama atau kode tidak cocok") agar orang lain tidak bisa mengecek apakah seorang anak
  terdaftar. Jika ingin pesan terpisah "nama tidak ditemukan" / "kode salah", ubah `pesan_gagal_spesifik` ke `ya`
  (lebih ramah, tetapi membocorkan nama mana yang terdaftar).
- Batas 5 percobaan salah per nama, lalu dikunci 15 menit; tiap kegagalan diperlambat.
- Token sesi acak 64 karakter, berlaku 30 menit, hanya disimpan di memori halaman (hilang saat ditutup); tidak ada data di URL atau `localStorage`.
- Hanya data jadwal anak yang terverifikasi yang dikirim ke browser. Tidak ada endpoint untuk mengunduh daftar murid.
- Validasi ulang di server untuk semua input; teks orang tua tidak bisa menjadi rumus di Sheets; `LockService`
  untuk penulisan izin; tidak ada `eval()`.
- Izin akses script dibatasi ke spreadsheet ini saja (`spreadsheets.currentonly`).

Keterbatasan yang perlu diketahui:

- **Kode akses statis bukan pengaman yang kuat.** Siapa pun yang mengetahui nama anak dan kodenya (misalnya kode
  diteruskan di grup WhatsApp) bisa melihat jadwalnya. Kode 6 karakter acak sulit ditebak, tetapi mudah dibagikan.
- Apps Script tidak bisa membaca alamat IP, jadi pembatasan percobaan berdasarkan nama anak. Penyerang yang mencoba
  banyak nama berbeda tetap dibatasi 5 tebakan per nama.
- Website tidak tahu apakah pesan WhatsApp benar-benar terkirim; itulah alasan adanya status "Menunggu konfirmasi admin".
- Sistem ini belum diuji penetrasi. Jangan menyebutnya "aman sepenuhnya". Data yang ditampilkan sengaja dibatasi
  pada jadwal (tanpa telepon, alamat, pembayaran) untuk memperkecil dampak bila kode bocor.

Opsi peningkatan keamanan:

1. Ganti kode akses secara berkala (misalnya tiap semester) dan saat ada laporan kebocoran.
2. Deploy dengan *Who has access: Anyone with Google account* dan tambahkan kolom email orang tua di sheet Murid,
   lalu cocokkan `Session.getActiveUser()` — perlu deployment *Execute as: User accessing* atau Google Workspace domain.
3. Kode sekali pakai (OTP) via WhatsApp Business API — butuh layanan berbayar.

### Tentang halaman admin terpisah

Versi 1 sengaja memakai **Google Sheets sebagai panel admin** (ditambah menu "Taman Belajar"): sudah dilindungi
login Google, gratis, dan admin tidak perlu belajar aplikasi baru. Tidak dibuat halaman admin dengan password yang
ditanam di kode, karena cara itu tidak aman. Jika kelak dibutuhkan halaman admin di web, buat deployment kedua
dengan *Execute as: User accessing the web app* + *Who has access: Only myself / domain*, sehingga Google yang
memeriksa login.
