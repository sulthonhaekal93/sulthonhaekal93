/**
 * English Fun Games — penyimpan skor di Google Spreadsheet
 * ---------------------------------------------------------------
 * Cara pakai singkat (lihat README.md untuk versi lengkap):
 * 1. Buat Google Spreadsheet baru.
 * 2. Menu Ekstensi > Apps Script, hapus isi Code.gs, tempel file ini.
 * 3. Simpan, pilih fungsi "setup", klik Jalankan, izinkan akses.
 * 4. Terapkan (Deploy) > Deployment baru > jenis "Aplikasi web":
 *      Jalankan sebagai : Saya (Me)
 *      Yang memiliki akses: Siapa saja (Anyone)
 * 5. Salin URL aplikasi web (berakhiran /exec) ke config.js
 *    atau ke menu ⚙️ Pengaturan di website.
 */

var SHEET_NAME = 'Skor';
var HEADERS = [
  'Waktu', 'Nama', 'Kelas', 'Game', 'Tema', 'Level', 'Poin', 'Poin Maks',
  'Benar', 'Jumlah Soal', 'Nilai', 'Bintang', 'Durasi (detik)', 'Bantuan',
  'Lencana', 'Kode Game', 'Kode Tema'
];
// indeks kolom (mulai 0) yang dipakai untuk peringkat
var COL = { name: 1, kelas: 2, level: 5, score: 6, stars: 11, game: 15, theme: 16 };

function setup() {
  var sh = getSheet_();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sh);
  return 'Sheet "' + SHEET_NAME + '" siap.';
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#ffd54f');
    sh.setColumnWidth(2, 160);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Cegah teks dianggap rumus (=, +, -, @) dan batasi panjang.
function clean_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s.slice(0, max || 60);
}
function num_(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'leaderboard') {
      var res = leaderboard_(p.game || 'all', p.theme || 'all', p.level || 'all', Math.min(num_(p.limit) || 20, 100));
      return json_({ ok: true, mode: res.mode, rows: res.rows });
    }
    return json_({ ok: true, message: 'API English Fun Games aktif.' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var d = JSON.parse(e.postData.contents);
    var name = clean_(d.name, 30);
    if (!name) return json_({ ok: false, error: 'Nama kosong' });
    var total = Math.max(0, Math.min(num_(d.total), 50));
    var maxScore = total * 10;
    var score = Math.max(0, Math.min(num_(d.score), maxScore));
    getSheet_().appendRow([
      new Date(), name, clean_(d.kelas, 10), clean_(d.gameName, 30), clean_(d.themeName, 40),
      num_(d.level), score, maxScore, num_(d.correct), total,
      num_(d.percent), num_(d.stars), num_(d.duration), num_(d.hints),
      clean_(d.badges, 120), clean_(d.game, 20), clean_(d.theme, 20)
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* abaikan */ }
  }
}

/**
 * Semua filter "all" -> total poin semua permainan per pemain.
 * Ada filter -> poin terbaik per pemain.
 */
function leaderboard_(game, theme, level, limit) {
  var sh = getSheet_();
  var last = sh.getLastRow();
  var total = game === 'all' && theme === 'all' && String(level) === 'all';
  if (last < 2) return { mode: total ? 'total' : 'best', rows: [] };
  var data = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var map = {};
  data.forEach(function (r) {
    if (game !== 'all' && r[COL.game] !== game) return;
    if (theme !== 'all' && r[COL.theme] !== theme) return;
    if (String(level) !== 'all' && String(r[COL.level]) !== String(level)) return;
    var name = String(r[COL.name] || '').replace(/^'/, '').trim();
    if (!name) return;
    var kelas = String(r[COL.kelas] || '');
    var k = name.toLowerCase() + '|' + kelas;
    var cur = map[k] || { name: name, kelas: kelas, score: 0, plays: 0, stars: 0 };
    var sc = num_(r[COL.score]);
    cur.score = total ? cur.score + sc : Math.max(cur.score, sc);
    cur.plays += 1;
    cur.stars += num_(r[COL.stars]);
    map[k] = cur;
  });
  var rows = Object.keys(map).map(function (k) { return map[k]; })
    .sort(function (a, b) { return b.score - a.score || b.stars - a.stars; })
    .slice(0, limit);
  return { mode: total ? 'total' : 'best', rows: rows };
}
