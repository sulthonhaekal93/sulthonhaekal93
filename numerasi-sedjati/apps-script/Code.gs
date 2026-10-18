/**
 * Sedjati Numeracy Adventure — penyimpan hasil belajar di Google Spreadsheet
 * ---------------------------------------------------------------
 * Cara pakai singkat (lihat README.md untuk versi lengkap):
 * 1. Buat Google Spreadsheet baru.
 * 2. Menu Ekstensi > Apps Script, hapus isi Code.gs, tempel file ini.
 * 3. Simpan, pilih fungsi "setup", klik Jalankan, izinkan akses.
 * 4. Terapkan (Deploy) > Deployment baru > jenis "Aplikasi web":
 *      Jalankan sebagai : Saya (Me)
 *      Yang memiliki akses: Siapa saja (Anyone)
 * 5. Salin URL aplikasi web (berakhiran /exec) ke config.js
 *    atau ke menu Panduan > Google Spreadsheet di website.
 *
 * Dua sheet dibuat otomatis:
 *  - "Riwayat"     : satu baris setiap misi / tes yang selesai.
 *  - "Rekap Siswa" : satu baris per anak, selalu diperbarui ke data terbaru.
 */

var HISTORY = 'Riwayat';
var SUMMARY = 'Rekap Siswa';

var HISTORY_HEADERS = [
  'Waktu', 'Nama', 'Kelompok', 'Mode', 'Jenis', 'Level', 'Area', 'Misi',
  'Jumlah Soal', 'Benar Langsung', 'Benar Setelah Mencoba', 'Belum Benar',
  'Nilai (%)', 'Bintang', 'Selesai', 'Keterangan', 'Lencana Baru', 'ID Pemain'
];

var SUMMARY_HEADERS = [
  'ID Pemain', 'Nama', 'Kelompok', 'Mode', 'Terakhir Aktif', 'Total Bintang',
  'Misi Selesai', 'Lencana', 'Soal Dicoba', 'Ketepatan Latihan (%)',
  'Membilang', 'Penjumlahan', 'Pengurangan', 'Perkalian', 'Pembagian', 'Campuran',
  'Perlu Latihan', 'Saran Berikutnya', 'Tes Awal', 'Tes Akhir'
];
var OPS = ['count', 'add', 'sub', 'mul', 'div', 'mix'];

function setup() {
  getSheet_(SUMMARY, SUMMARY_HEADERS, '#bbf7d0');
  var sh = getSheet_(HISTORY, HISTORY_HEADERS, '#fde68a');
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sh);
  return 'Sheet "' + HISTORY + '" dan "' + SUMMARY + '" siap.';
}

function getSheet_(name, headers, color) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground(color);
    sh.setColumnWidth(2, 150);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Cegah teks dianggap rumus (=, +, -, @) dan batasi panjang.
function clean_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s.slice(0, max || 60);
}
function num_(v, max) {
  var n = Number(v);
  if (!isFinite(n) || n < 0) return 0;
  return max ? Math.min(n, max) : n;
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true, app: 'sedjati-numeracy', message: 'API Sedjati Numeracy Adventure aktif.' });
  return json_({ ok: true, app: 'sedjati-numeracy', message: 'API Sedjati Numeracy Adventure aktif.' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var d = JSON.parse(e.postData.contents);
    if (d.app !== 'sedjati-numeracy') return json_({ ok: false, error: 'Data bukan dari Sedjati Numeracy Adventure' });
    var pid = clean_(d.playerId, 40);
    if (!/^p[a-z0-9]{1,40}$/i.test(pid)) return json_({ ok: false, error: 'ID pemain tidak valid' });
    var name = clean_(d.name, 30) || 'Tamu';
    var r = d.result || {};
    var when = new Date(num_(d.time) || Date.now());

    getSheet_(HISTORY, HISTORY_HEADERS, '#fde68a').appendRow([
      when, name, clean_(d.group, 20), clean_(d.mode, 20), clean_(r.kind, 20),
      clean_(r.level, 10), clean_(r.area, 40), clean_(r.mission, 80),
      num_(r.total, 100), num_(r.first, 100), num_(r.helped, 100), num_(r.wrong, 100),
      num_(r.percent, 100), num_(r.stars, 3), r.completed === true ? 'Ya' : (r.completed === false ? 'Belum' : ''),
      clean_(r.note, 300), clean_(r.newBadges, 200), pid
    ]);

    var s = d.snapshot || {};
    var ops = s.ops || {};
    var row = [
      pid, name, clean_(d.group, 20), clean_(d.mode, 20), when,
      num_(s.stars, 1000), num_(s.missions, 100), clean_(s.badges, 300),
      num_(s.attempted, 1000000), num_(s.accuracy, 100)
    ].concat(OPS.map(function (o) { return clean_(ops[o], 80); })).concat([
      clean_(s.needsPractice, 200), clean_(s.next, 120), clean_(s.initial, 300), clean_(s.finals, 400)
    ]);
    upsert_(getSheet_(SUMMARY, SUMMARY_HEADERS, '#bbf7d0'), pid, row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* abaikan */ }
  }
}

// Perbarui baris anak yang sudah ada (berdasarkan ID Pemain), atau tambahkan baris baru.
function upsert_(sh, pid, row) {
  var last = sh.getLastRow();
  if (last >= 2) {
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === pid) {
        sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
        return;
      }
    }
  }
  sh.appendRow(row);
}
