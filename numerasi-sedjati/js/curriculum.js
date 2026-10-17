/*
 * KURIKULUM — Sedjati Numeracy Adventure
 * ---------------------------------------------------------------
 * Enam area = enam level kemampuan (bukan kelas sekolah).
 * Setiap area punya beberapa "langkah" (misi) yang makin menantang.
 * Generator soal untuk setiap langkah ada di generator.js dengan
 * urutan indeks yang sama.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SNA = root.SNA || {}; root.SNA.Curriculum = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const AREAS = [
    {
      id: 'count', level: 1, name: 'Kebun Angka', icon: '🌱', op: 'count',
      skill: 'Mengenal angka & membilang',
      blurb: 'Kenal angka, hitung benda, dan bandingkan banyaknya.',
      steps: [
        { title: 'Kenal Angka 1–5', mission: 'Bantu Pak Tani Menghitung Bibit!', goal: 'Mengenal angka 1 sampai 5 dan mencocokkannya dengan banyak benda.', concept: 'Tunjuk dan hitung setiap benda satu kali. Angka terakhir yang kita sebut adalah banyaknya benda.' },
        { title: 'Hitung sampai 10', mission: 'Panen Buah di Kebun Angka!', goal: 'Menghitung benda sampai 10 dan mengenali lambang angkanya.', concept: 'Hitung pelan-pelan sambil menunjuk: satu, dua, tiga, … sampai benda terakhir.' },
        { title: 'Lebih Banyak, Lebih Sedikit', mission: 'Kandang Siapa yang Lebih Ramai?', goal: 'Membandingkan dua kelompok benda dan dua angka.', concept: 'Hitung setiap kelompok, lalu bandingkan. Angka yang lebih besar berarti bendanya lebih banyak.' },
        { title: 'Hitung sampai 20', mission: 'Jalan-jalan Menghitung sampai 20!', goal: 'Menghitung benda sampai 20 dan mengurutkan angka.', concept: 'Kelompokkan per lima atau sepuluh agar mudah dihitung. Sepuluh dan empat menjadi empat belas.' }
      ]
    },
    {
      id: 'add', level: 2, name: 'Rumah Penjumlahan', icon: '🏠', op: 'add',
      skill: 'Penjumlahan',
      blurb: 'Gabungkan dua kelompok benda menjadi satu.',
      steps: [
        { title: 'Penjumlahan sampai 5', mission: 'Bantu Beni Mengumpulkan Apel!', goal: 'Menggabungkan dua kelompok kecil, hasilnya sampai 5.', concept: 'Menjumlah artinya menggabungkan. Kumpulkan kedua kelompok, lalu hitung semuanya.' },
        { title: 'Penjumlahan sampai 10', mission: 'Isi Keranjang Mangga!', goal: 'Menjumlahkan dua bilangan dengan hasil sampai 10.', concept: 'Mulai dari bilangan pertama, lalu hitung maju sebanyak bilangan kedua.' },
        { title: 'Penjumlahan sampai 20', mission: 'Lompat di Garis Bilangan!', goal: 'Menjumlahkan dengan hasil sampai 20 memakai garis bilangan.', concept: 'Di garis bilangan, menambah berarti melompat ke kanan.' },
        { title: 'Dua Angka tanpa Menyimpan', mission: 'Menghitung Buku Perpustakaan', goal: 'Menjumlahkan bilangan dua angka tanpa menyimpan.', concept: 'Jumlahkan satuan dengan satuan, puluhan dengan puluhan.', tag: 'Siap tantangan' },
        { title: 'Dua Angka dengan Menyimpan', mission: 'Tukar 10 Satuan Jadi 1 Puluhan!', goal: 'Menjumlahkan bilangan dua angka dengan menyimpan.', concept: 'Jika satuan berjumlah 10 atau lebih, tukar 10 satuan menjadi 1 puluhan (disimpan).', tag: 'Siap tantangan' }
      ]
    },
    {
      id: 'sub', level: 3, name: 'Taman Pengurangan', icon: '🌳', op: 'sub',
      skill: 'Pengurangan',
      blurb: 'Ambil sebagian benda, lalu hitung sisanya.',
      steps: [
        { title: 'Pengurangan sampai 5', mission: 'Mangga yang Dipetik', goal: 'Mengambil benda dari kelompok kecil (sampai 5) dan menghitung sisanya.', concept: 'Mengurangi artinya mengambil. Hitung benda yang masih tersisa.' },
        { title: 'Pengurangan sampai 10', mission: 'Kue di Piring Nenek', goal: 'Mengurangi bilangan sampai 10.', concept: 'Mulai dari bilangan pertama, lalu hitung mundur sebanyak yang diambil.' },
        { title: 'Pengurangan sampai 20', mission: 'Hitung Mundur di Taman', goal: 'Mengurangi sampai 20 dan mencari selisih.', concept: 'Di garis bilangan, mengurangi berarti melompat ke kiri.' },
        { title: 'Dua Angka tanpa Meminjam', mission: 'Kelereng Dodi', goal: 'Mengurangi bilangan dua angka tanpa meminjam.', concept: 'Kurangi satuan dengan satuan, puluhan dengan puluhan.', tag: 'Siap tantangan' },
        { title: 'Dua Angka dengan Meminjam', mission: 'Pinjam Satu Puluhan!', goal: 'Mengurangi bilangan dua angka dengan meminjam.', concept: 'Jika satuan atas lebih kecil, pinjam 1 puluhan dan ubah menjadi 10 satuan.', tag: 'Siap tantangan' }
      ]
    },
    {
      id: 'mul', level: 4, name: 'Jembatan Perkalian', icon: '🌉', op: 'mul', tkOptional: true,
      skill: 'Perkalian',
      blurb: 'Kelompok yang sama banyak dan penjumlahan berulang.',
      steps: [
        { title: 'Kelompok 2 dan 5', mission: 'Menata Telur di Piring', goal: 'Memahami perkalian sebagai kelompok yang sama banyak (isi 2 atau 5).', concept: '3 × 2 artinya 3 kelompok, setiap kelompok berisi 2: 2 + 2 + 2 = 6.' },
        { title: 'Kelompok 10', mission: 'Ikat Lidi Sepuluhan', goal: 'Menghitung kelompok berisi 10.', concept: 'Hitung loncat sepuluh: 10, 20, 30, …' },
        { title: 'Perkalian 1–5', mission: 'Barisan Kursi Kelas', goal: 'Perkalian 1 sampai 5 dengan susunan baris (larik).', concept: 'Susunan baris: banyak baris × isi setiap baris.' },
        { title: 'Perkalian 1–10', mission: 'Menyeberang Jembatan Perkalian', goal: 'Fakta perkalian 1 sampai 10.', concept: 'Gunakan hitung loncat dan pola. 4 × 7 sama hasilnya dengan 7 × 4.' },
        { title: 'Perkalian Lebih Besar', mission: 'Gudang Panen Desa', goal: 'Mengalikan bilangan dua angka dengan satu angka.', concept: 'Pecah menjadi puluhan dan satuan: 23 × 4 = (20 × 4) + (3 × 4).', tag: 'Siap tantangan' }
      ]
    },
    {
      id: 'div', level: 5, name: 'Pasar Pembagian', icon: '🏪', op: 'div', tkOptional: true,
      skill: 'Pembagian',
      blurb: 'Berbagi sama rata dan membuat kelompok.',
      steps: [
        { title: 'Berbagi Sama Rata', mission: 'Bagi Permen untuk Teman!', goal: 'Membagi benda sama rata dengan cara membagikan satu per satu.', concept: 'Bagikan satu-satu bergiliran sampai habis. Setiap anak harus dapat sama banyak.' },
        { title: 'Pembagian Kecil', mission: 'Mengisi Keranjang Telur', goal: 'Pembagian bilangan kecil: berbagi dan mengelompokkan.', concept: '12 ÷ 3 bisa berarti 12 dibagi ke 3 anak, atau 12 dikelompokkan isi 3.' },
        { title: 'Fakta Pembagian', mission: 'Lapak Buah di Pasar', goal: 'Menggunakan perkalian untuk menyelesaikan pembagian.', concept: 'Pembagian adalah kebalikan perkalian. Karena 4 × 5 = 20, maka 20 ÷ 5 = 4.' },
        { title: 'Pembagian Lebih Besar', mission: 'Pedagang Grosir Pasar', goal: 'Pembagian bilangan yang lebih besar tanpa sisa.', concept: 'Pecah bilangannya: 84 ÷ 4 = (80 ÷ 4) + (4 ÷ 4) = 20 + 1.', tag: 'Siap tantangan' },
        { title: 'Pembagian Bersisa', mission: 'Ada yang Tersisa!', goal: 'Pembagian yang menghasilkan sisa.', concept: 'Kadang benda tidak bisa dibagi habis. Yang tidak kebagian disebut sisa.', tag: 'Siap tantangan' }
      ]
    },
    {
      id: 'mix', level: 6, name: 'Pulau Tantangan', icon: '🏝️', op: 'mix',
      skill: 'Operasi campuran',
      blurb: 'Pilih operasi yang tepat dan pecahkan soal cerita.',
      steps: [
        { title: 'Pilih Operasi', mission: 'Tanda Apa yang Hilang?', goal: 'Memilih operasi (+, −, ×, ÷) yang membuat kalimat matematika benar.', concept: 'Coba setiap tanda satu per satu, lalu cek hasilnya.' },
        { title: 'Soal Campuran', mission: 'Jelajah Pulau Tantangan', goal: 'Menyelesaikan soal penjumlahan, pengurangan, perkalian, dan pembagian secara acak.', concept: 'Baca tandanya dulu, baru hitung.' },
        { title: 'Pola Bilangan', mission: 'Jejak Pola di Pasir', goal: 'Menemukan aturan pola dan melengkapinya.', concept: 'Lihat perubahan dari satu bilangan ke bilangan berikutnya.' },
        { title: 'Soal Cerita', mission: 'Cerita dari Desa', goal: 'Menyelesaikan soal cerita satu atau dua langkah.', concept: 'Cari apa yang diketahui, apa yang ditanya, lalu kerjakan langkah demi langkah.', tag: 'Siap tantangan' },
        { title: 'Urutan Operasi', mission: 'Kunci Peti Harta', goal: 'Menghitung dengan urutan operasi yang benar.', concept: 'Kerjakan yang di dalam kurung dulu, lalu × dan ÷, baru + dan −.', tag: 'Siap tantangan' }
      ]
    }
  ];

  const AREA_BY_ID = {};
  AREAS.forEach(a => { AREA_BY_ID[a.id] = a; });

  /* Statistik dicatat per operasi matematika */
  const OPS = [
    { id: 'count', name: 'Membilang', icon: '🔢' },
    { id: 'add', name: 'Penjumlahan', icon: '➕' },
    { id: 'sub', name: 'Pengurangan', icon: '➖' },
    { id: 'mul', name: 'Perkalian', icon: '✖️' },
    { id: 'div', name: 'Pembagian', icon: '➗' },
    { id: 'mix', name: 'Penalaran campuran', icon: '🧩' }
  ];

  /* Mode belajar */
  const MODES = {
    tk: { id: 'tk', name: 'Mode TK', desc: 'Benda besar, instruksi singkat, 3 pilihan jawaban, tanpa waktu.', start: 0, questions: 5, choices: 3 },
    starter: { id: 'starter', name: 'SD Starter', desc: 'Kelas 1–3: hitung benda, garis bilangan, kalimat matematika sederhana.', start: 1, questions: 8, choices: 4 },
    challenge: { id: 'challenge', name: 'SD Challenge', desc: 'Kelas 4–6: bilangan lebih besar, soal cerita, operasi campuran.', start: 2, questions: 10, choices: 4 }
  };

  const GROUPS = [
    { id: 'tk', name: 'TK', mode: 'tk' },
    { id: 'sd12', name: 'Kelas 1–2', mode: 'starter' },
    { id: 'sd34', name: 'Kelas 3–4', mode: 'starter' },
    { id: 'sd56', name: 'Kelas 5–6', mode: 'challenge' }
  ];

  return { AREAS, AREA_BY_ID, OPS, MODES, GROUPS };
});
