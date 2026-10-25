/**
 * Dashboard Jadwal Belajar — Taman Belajar Sedjati
 * Backend Google Apps Script (V8). Wajib dipasang sebagai script yang
 * terikat (bound) ke Google Sheets: buka Sheets > Ekstensi > Apps Script.
 *
 * Fungsi yang dipanggil dari browser (google.script.run):
 *   verifyStudentAccess(namaAnak, kodeAkses)
 *   getStudentSchedule(sessionToken)
 *   getPublicSettings()
 *   logLeaveRequest(sessionToken, request)
 *
 * Semua fungsi yang namanya diakhiri garis bawah (_) bersifat privat:
 * Apps Script tidak mengizinkan browser memanggilnya.
 */

var CONFIG = {
  TZ: 'Asia/Jakarta',
  SHEETS: { MURID: 'Murid', JADWAL: 'Jadwal', IZIN: 'Perizinan', SETTING: 'Pengaturan' },
  HEADERS: {
    Murid: ['student_id', 'nama_anak', 'kode_akses', 'status_murid'],
    Jadwal: ['schedule_id', 'student_id', 'program', 'hari', 'jam_mulai', 'jam_selesai', 'tutor',
      'status_jadwal', 'tanggal_mulai', 'tanggal_selesai', 'updated_at'],
    Perizinan: ['izin_id', 'student_id', 'schedule_id', 'tanggal_pertemuan', 'alasan', 'catatan',
      'status_pengajuan', 'created_at'],
    Pengaturan: ['key', 'value']
  },
  SESSION_TTL_SECONDS: 1800,      // sesi orang tua berlaku 30 menit sejak aktivitas terakhir
  MAX_FAILED_ATTEMPTS: 5,         // percobaan salah per nama anak sebelum dikunci
  LOCK_SECONDS: 900,              // lama penguncian: 15 menit
  LEAVE_WINDOW_DAYS: 60,          // izin hanya untuk pertemuan 60 hari ke depan
  MAX_CATATAN: 300,
  ALASAN: ['Sakit', 'Keperluan keluarga', 'Lainnya'],
  STATUS_MURID: ['Aktif', 'Cuti', 'Nonaktif'],
  STATUS_JADWAL: ['Aktif', 'Nonaktif'],
  STATUS_IZIN: ['Menunggu konfirmasi admin', 'Diterima', 'Ditolak', 'Tidak ada pesan WA'],
  STATUS_IZIN_AWAL: 'Menunggu konfirmasi admin',
  DEMO_PREFIX: 'DEMO-'
};

var DEFAULT_SETTINGS = [
  ['nama_lembaga', 'Taman Belajar Sedjati', 'Nama lembaga yang tampil di website dan pesan WhatsApp.'],
  ['whatsapp_admin', '085743008511', 'Nomor WhatsApp admin penerima pesan izin (boleh 08xx atau 628xx).'],
  ['logo_url', '', 'Alamat gambar logo (https://...). Kosongkan untuk logo teks "TBS".'],
  ['info_header', 'Jadwal diperbarui oleh admin Taman Belajar Sedjati.', 'Keterangan kecil di bagian atas halaman.'],
  ['catat_izin', 'ya', '"ya" = setiap pengajuan izin dicatat di sheet Perizinan. "tidak" = hanya membuka WhatsApp.'],
  ['retensi_izin_hari', '90', 'Catatan izin yang lebih lama dari jumlah hari ini dihapus oleh pembersihan otomatis.'],
  ['pesan_gagal_spesifik', 'tidak', '"tidak" (disarankan) = pesan gagal tidak membocorkan apakah nama terdaftar. "ya" = bedakan "nama tidak ditemukan" dan "kode salah".']
];

// Hanya kunci ini yang boleh dikirim ke browser sebelum verifikasi.
var PUBLIC_SETTING_KEYS = ['nama_lembaga', 'logo_url', 'info_header'];

var HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']; // 1 = Senin ... 7 = Minggu
var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September',
  'Oktober', 'November', 'Desember'];
var HARI_ALIAS = {
  senin: 1, sen: 1, selasa: 2, sel: 2, rabu: 3, rab: 3, kamis: 4, kam: 4,
  jumat: 5, "jum'at": 5, jumaat: 5, jum: 5, sabtu: 6, sab: 6, minggu: 7, ahad: 7, min: 7
};

/* =====================================================================
 * 1. WEB APP
 * ===================================================================== */

function doGet(e) {
  var settings = getPublicSettings();
  var template = HtmlService.createTemplateFromFile('Index');
  // Escape "<" agar isi pengaturan tidak bisa menutup tag <script>.
  template.bootJson = JSON.stringify(settings).replace(/</g, '\\u003c');
  return template.evaluate()
    .setTitle('Jadwal Belajar Anak — ' + settings.nama_lembaga)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** Dipakai di Index.html: <?!= include('Styles'); ?> */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* =====================================================================
 * 2. API UNTUK BROWSER
 * ===================================================================== */

/** Pengaturan yang aman ditampilkan ke siapa pun (tanpa nomor WA, tanpa data murid). */
function getPublicSettings() {
  var all;
  try {
    all = getSettings_();
  } catch (err) {
    all = defaultSettingsMap_();
  }
  var out = {};
  PUBLIC_SETTING_KEYS.forEach(function (k) { out[k] = String(all[k] || ''); });
  if (!out.nama_lembaga) out.nama_lembaga = 'Taman Belajar Sedjati';
  if (out.logo_url && !/^https:\/\/[^\s"'<>]+$/i.test(out.logo_url)) out.logo_url = '';
  return out;
}

/**
 * Verifikasi orang tua: nama anak + kode akses.
 * Berhasil -> token sesi (disimpan di CacheService, bukan di browser jangka panjang)
 * beserta jadwal anak tersebut. Kode akses tidak pernah dikirim balik.
 */
function verifyStudentAccess(namaAnak, kodeAkses) {
  try {
    var nama = normalizeName_(namaAnak);
    var kode = normalizeCode_(kodeAkses);
    if (nama.length < 2 || nama.length > 100) {
      return fail_('INVALID_INPUT', 'Mohon tuliskan nama anak dengan lengkap.');
    }
    if (kode.length < 4 || kode.length > 32 || !/^[A-Z0-9]+$/.test(kode)) {
      return fail_('INVALID_INPUT', 'Kode akses terdiri dari huruf dan angka. Mohon periksa kembali kode dari admin.');
    }

    var cache = CacheService.getScriptCache();
    var failKey = 'fail_' + digest_(nama);
    var fails = Number(cache.get(failKey) || 0);
    if (fails >= CONFIG.MAX_FAILED_ATTEMPTS) {
      return fail_('LOCKED', 'Terlalu banyak percobaan yang salah. Silakan coba lagi 15 menit lagi atau hubungi admin.');
    }

    var students = readTable_(CONFIG.SHEETS.MURID);
    var sameName = students.filter(function (s) { return normalizeName_(s.nama_anak) === nama; });
    var match = null;
    sameName.forEach(function (s) {
      var stored = normalizeCode_(s.kode_akses);
      if (!match && stored && clean_(s.student_id) && safeEqual_(stored, kode)) match = s;
    });

    if (!match) {
      cache.put(failKey, String(fails + 1), CONFIG.LOCK_SECONDS);
      Utilities.sleep(700); // memperlambat tebak-tebakan otomatis
      if (isOn_(getSettings_().pesan_gagal_spesifik)) {
        if (!sameName.length) {
          return fail_('NOT_FOUND', 'Nama anak belum ditemukan. Pastikan penulisan nama sama dengan yang terdaftar di Taman Belajar Sedjati.');
        }
        return fail_('WRONG_CODE', 'Kode akses salah. Mohon periksa kembali kode yang diberikan admin.');
      }
      return fail_('NO_MATCH', 'Nama anak atau kode akses tidak cocok. Periksa kembali penulisan nama dan kode dari admin.');
    }

    cache.remove(failKey);
    if (!isActive_(match.status_murid)) {
      return fail_('INACTIVE', 'Status murid saat ini ' + (clean_(match.status_murid) || 'tidak aktif') +
        ', sehingga jadwal tidak ditampilkan. Silakan hubungi admin bila ada pertanyaan.');
    }

    var token = newToken_();
    // Sesi terikat ke kode saat ini: bila admin mengganti kode, sesi lama otomatis tidak berlaku.
    cache.put('sess_' + token, clean_(match.student_id) + '|' + digest_(kode), CONFIG.SESSION_TTL_SECONDS);
    return { ok: true, token: token, data: buildSchedulePayload_(match) };
  } catch (err) {
    return serverFail_(err);
  }
}

/**
 * Ambil ulang jadwal terbaru (tombol "Perbarui Jadwal").
 * Menerima token sesi — BUKAN student_id — supaya orang lain tidak bisa
 * mengambil jadwal anak lain hanya dengan menebak ID.
 */
function getStudentSchedule(sessionToken) {
  try {
    var student = studentFromSession_(sessionToken);
    if (student.error) return student.error;
    return { ok: true, data: buildSchedulePayload_(student) };
  } catch (err) {
    return serverFail_(err);
  }
}

/**
 * Validasi pengajuan izin di server, (opsional) catat di sheet Perizinan,
 * lalu kembalikan tautan wa.me dengan pesan yang sudah disusun.
 * Status awal selalu "Menunggu konfirmasi admin": sistem tidak bisa tahu
 * apakah orang tua benar-benar menekan tombol kirim di WhatsApp.
 *
 * request = { scheduleId, tanggal: 'yyyy-MM-dd', alasan, catatan }
 */
function logLeaveRequest(sessionToken, request) {
  try {
    var student = studentFromSession_(sessionToken);
    if (student.error) return student.error;
    request = request || {};

    var payload = buildSchedulePayload_(student);
    var scheduleId = clean_(request.scheduleId);
    var sched = null;
    payload.schedules.forEach(function (s) { if (s.scheduleId === scheduleId) sched = s; });
    if (!sched) {
      return fail_('SCHEDULE_NOT_FOUND', 'Jadwal ini sudah berubah atau tidak aktif lagi. Tekan "Perbarui Jadwal" lalu coba kembali.');
    }

    var tanggal = parseDate_(request.tanggal);
    var today = payload.today;
    if (!tanggal) return fail_('INVALID_INPUT', 'Mohon pilih tanggal pertemuan yang akan ditinggalkan.');
    if (tanggal < today || tanggal > addDays_(today, CONFIG.LEAVE_WINDOW_DAYS)) {
      return fail_('INVALID_INPUT', 'Tanggal pertemuan harus antara hari ini dan ' + CONFIG.LEAVE_WINDOW_DAYS + ' hari ke depan.');
    }
    if (sched.days.indexOf(dayOfWeek_(tanggal)) === -1) {
      return fail_('INVALID_INPUT', 'Tanggal yang dipilih bukan hari ' + sched.hariText + '. Mohon pilih tanggal pertemuan yang sesuai.');
    }
    if ((sched.tanggalMulai && tanggal < sched.tanggalMulai) || (sched.tanggalSelesai && tanggal > sched.tanggalSelesai)) {
      return fail_('INVALID_INPUT', 'Tanggal tersebut di luar masa berlaku jadwal ini.');
    }

    var alasan = clean_(request.alasan);
    if (CONFIG.ALASAN.indexOf(alasan) === -1) return fail_('INVALID_INPUT', 'Mohon pilih alasan izin.');
    var catatan = String(request.catatan == null ? '' : request.catatan)
      .replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (catatan.length > CONFIG.MAX_CATATAN) {
      return fail_('INVALID_INPUT', 'Catatan terlalu panjang (maksimal ' + CONFIG.MAX_CATATAN + ' karakter).');
    }
    if (alasan === 'Lainnya' && !catatan) {
      return fail_('INVALID_INPUT', 'Untuk alasan "Lainnya", mohon tuliskan keterangan singkat di kolom catatan.');
    }

    var settings = getSettings_();
    var waNumber = normalizeWa_(settings.whatsapp_admin);
    if (!waNumber) return fail_('CONFIG_ERROR', 'Nomor WhatsApp admin belum diatur. Silakan hubungi admin secara langsung.');

    var izinId = '';
    var duplicate = false;
    var logged = isOn_(settings.catat_izin);
    if (logged) {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) {
        return fail_('BUSY', 'Sistem sedang sibuk. Mohon tunggu sebentar lalu coba lagi.');
      }
      try {
        var sid = clean_(student.student_id);
        var existing = readTable_(CONFIG.SHEETS.IZIN, true).filter(function (r) {
          return clean_(r.student_id) === sid && clean_(r.schedule_id) === scheduleId &&
            parseDate_(r.tanggal_pertemuan) === tanggal &&
            ['Ditolak', 'Tidak ada pesan WA'].indexOf(clean_(r.status_pengajuan)) === -1;
        });
        if (existing.length) {
          izinId = clean_(existing[0].izin_id);
          duplicate = true;
        } else {
          izinId = 'IZN-' + tanggal.replace(/-/g, '') + '-' + randomCode_(4);
          var sheet = getSheet_(CONFIG.SHEETS.IZIN);
          var row = [izinId, sid, scheduleId, tanggal, alasan, catatan, CONFIG.STATUS_IZIN_AWAL, nowStr_()];
          sheet.appendRow(row.map(safeCell_));
          SpreadsheetApp.flush();
        }
      } finally {
        lock.releaseLock();
      }
    }

    var message = buildWaMessage_({
      lembaga: settings.nama_lembaga || 'Taman Belajar Sedjati',
      nama: clean_(student.nama_anak),
      program: sched.program,
      tanggalLabel: formatTanggal_(tanggal),
      jam: sched.jamMulai + '–' + sched.jamSelesai,
      tutor: sched.tutor,
      alasan: alasan,
      catatan: catatan,
      izinId: izinId
    });

    return {
      ok: true,
      logged: logged,
      duplicate: duplicate,
      izinId: izinId,
      tanggalLabel: formatTanggal_(tanggal),
      message: message,
      waUrl: 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(message)
    };
  } catch (err) {
    return serverFail_(err);
  }
}

/* =====================================================================
 * 3. PENYUSUN DATA JADWAL
 * ===================================================================== */

/** Hanya data milik satu anak; tidak ada student_id, kode akses, atau data murid lain. */
function buildSchedulePayload_(student) {
  var sid = clean_(student.student_id);
  var today = todayStr_();
  var schedules = [];

  readTable_(CONFIG.SHEETS.JADWAL).forEach(function (r) {
    if (clean_(r.student_id) !== sid) return;
    if (!isActive_(r.status_jadwal)) return;                  // jadwal nonaktif tidak ditampilkan
    var days = parseDays_(r.hari);
    var start = parseTime_(r.jam_mulai);
    var end = parseTime_(r.jam_selesai);
    if (!days.length || !start || !end || end.minutes <= start.minutes) return; // baris tidak valid -> cek via menu
    var mulai = parseDate_(r.tanggal_mulai);
    var selesai = parseDate_(r.tanggal_selesai);
    if (selesai && selesai < today) return;                   // masa berlaku sudah habis
    schedules.push({
      scheduleId: clean_(r.schedule_id) || ('BARIS-' + r.__row),
      program: clean_(r.program) || 'Program belajar',
      days: days,
      dayLabels: days.map(function (d) { return HARI[d]; }),
      hariText: joinIndo_(days.map(function (d) { return HARI[d]; })),
      jamMulai: start.label,
      jamSelesai: end.label,
      startMinutes: start.minutes,
      tutor: clean_(r.tutor) || '-',
      status: mulai && mulai > today ? 'Akan dimulai' : 'Aktif',
      tanggalMulai: mulai,
      tanggalSelesai: selesai,
      tanggalMulaiLabel: mulai ? formatTanggal_(mulai, true) : '',
      tanggalSelesaiLabel: selesai ? formatTanggal_(selesai, true) : ''
    });
  });

  schedules.sort(function (a, b) {
    return (a.days[0] - b.days[0]) || (a.startMinutes - b.startMinutes) || a.program.localeCompare(b.program);
  });

  return {
    student: { nama: clean_(student.nama_anak), status: 'Aktif' },
    isDemo: sid.indexOf(CONFIG.DEMO_PREFIX) === 0,
    schedules: schedules,
    today: today,
    todayLabel: formatTanggal_(today),
    loadedAt: Utilities.formatDate(new Date(), CONFIG.TZ, 'HH.mm'),
    leaveWindowDays: CONFIG.LEAVE_WINDOW_DAYS,
    alasan: CONFIG.ALASAN.slice()
  };
}

function buildWaMessage_(d) {
  var lines = [
    "Assalamu'alaikum Admin " + d.lembaga + '.',
    '',
    'Saya ingin mengajukan izin tidak masuk untuk anak saya.',
    '',
    'Nama anak: ' + d.nama,
    'Program: ' + d.program,
    'Hari/tanggal pertemuan: ' + d.tanggalLabel,
    'Jam belajar: ' + d.jam,
    'Tutor: ' + d.tutor,
    'Alasan: ' + d.alasan,
    'Catatan: ' + (d.catatan || '-')
  ];
  if (d.izinId) lines.push('Kode pengajuan: ' + d.izinId);
  lines.push('', 'Mohon izin ketidakhadiran ini dicatat. Terima kasih.', '', "Wassalamu'alaikum.");
  return lines.join('\n');
}

function studentFromSession_(token) {
  token = String(token || '');
  var expired = { error: fail_('SESSION_EXPIRED', 'Sesi sudah berakhir. Silakan masukkan nama anak dan kode akses kembali.') };
  if (!/^[a-f0-9]{64}$/.test(token)) return expired;
  var cache = CacheService.getScriptCache();
  var session = cache.get('sess_' + token);
  if (!session) return expired;
  var sid = session.split('|')[0];
  var codeHash = session.split('|')[1];
  var student = null;
  readTable_(CONFIG.SHEETS.MURID).forEach(function (s) { if (!student && clean_(s.student_id) === sid) student = s; });
  if (!student || !normalizeCode_(student.kode_akses) || digest_(normalizeCode_(student.kode_akses)) !== codeHash) {
    cache.remove('sess_' + token); // murid dihapus atau kodenya diganti/dicabut admin
    return expired;
  }
  if (!isActive_(student.status_murid)) {
    cache.remove('sess_' + token);
    return { error: fail_('INACTIVE', 'Status murid saat ini ' + (clean_(student.status_murid) || 'tidak aktif') +
      ', sehingga jadwal tidak ditampilkan. Silakan hubungi admin bila ada pertanyaan.') };
  }
  cache.put('sess_' + token, session, CONFIG.SESSION_TTL_SECONDS); // perpanjang sesi
  return student;
}

/* =====================================================================
 * 4. BACA DATA SHEETS
 * ===================================================================== */

var MEMO_ = {}; // cache per eksekusi: setiap sheet dibaca paling banyak sekali per permintaan

function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('SPREADSHEET_NOT_BOUND');
  return ss;
}

function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('SHEET_MISSING:' + name);
  return sheet;
}

/**
 * Baca sheet sebagai array objek {header: nilai}. Memakai getDisplayValues()
 * (teks persis seperti yang dilihat admin) agar jam dan tanggal tidak
 * bergeser karena konversi zona waktu.
 */
function readTable_(name, fresh) {
  if (!fresh && MEMO_[name]) return MEMO_[name];
  var values = getSheet_(name).getDataRange().getDisplayValues();
  var headers = (values[0] || []).map(function (h) { return String(h).trim().toLowerCase(); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('').trim() === '') continue;
    var obj = { __row: i + 1 };
    headers.forEach(function (h, c) { if (h) obj[h] = row[c]; });
    rows.push(obj);
  }
  MEMO_[name] = rows;
  return rows;
}

function getSettings_() {
  if (MEMO_.__settings) return MEMO_.__settings;
  var map = defaultSettingsMap_();
  var sheet = getSpreadsheet_().getSheetByName(CONFIG.SHEETS.SETTING);
  if (sheet) {
    readTable_(CONFIG.SHEETS.SETTING).forEach(function (r) {
      var k = clean_(r.key).toLowerCase();
      if (k) map[k] = clean_(r.value);
    });
  }
  MEMO_.__settings = map;
  return map;
}

function defaultSettingsMap_() {
  var map = {};
  DEFAULT_SETTINGS.forEach(function (s) { map[s[0]] = s[1]; });
  return map;
}

/* =====================================================================
 * 5. NORMALISASI & VALIDASI
 * ===================================================================== */

function clean_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

function normalizeName_(v) {
  var s = String(v == null ? '' : v);
  if (s.normalize) s = s.normalize('NFKC');
  return s.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
}

function normalizeCode_(v) {
  return String(v == null ? '' : v).toUpperCase().replace(/[\s\-.]/g, '');
}

function isActive_(status) {
  return clean_(status).toLowerCase() === 'aktif';
}

function isOn_(v) {
  return ['ya', 'yes', 'true', '1', 'aktif', 'on'].indexOf(clean_(v).toLowerCase()) !== -1;
}

/** "Senin, Rabu" / "senin dan rabu" / "Sen/Rab" -> [1, 3] */
function parseDays_(v) {
  var parts = clean_(v).toLowerCase().split(/\s*(?:,|;|\/|&|\+|\bdan\b)\s*/);
  var days = [];
  parts.forEach(function (p) {
    p = p.replace(/[^a-z']/g, '');
    var d = HARI_ALIAS[p];
    if (d && days.indexOf(d) === -1) days.push(d);
  });
  return days.sort(function (a, b) { return a - b; });
}

/** "15.30", "15:30", "15:30:00", "3:30 PM" -> {label:'15.30', minutes:930} */
function parseTime_(v) {
  var s = clean_(v).toLowerCase();
  var m = s.match(/^(\d{1,2})[.:](\d{2})(?:[.:]\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  var h = Number(m[1]);
  var min = Number(m[2]);
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    if (m[3] === 'pm' && h !== 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return { label: pad2_(h) + '.' + pad2_(min), minutes: h * 60 + min };
}

/** "2026-07-01", "1/7/2026", "01-07-2026" (hari/bulan/tahun) -> "2026-07-01"; selain itu "" */
function parseDate_(v) {
  var s = clean_(v);
  var y, mo, d, m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    y = +m[1]; mo = +m[2]; d = +m[3];
  } else if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/))) {
    d = +m[1]; mo = +m[2]; y = +m[3];
  } else {
    return '';
  }
  var dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
  return y + '-' + pad2_(mo) + '-' + pad2_(d);
}

/** 08xx / +62 8xx / 628xx -> "628xx" */
function normalizeWa_(v) {
  var digits = String(v == null ? '' : v).replace(/\D/g, '');
  if (digits.indexOf('0') === 0) digits = '62' + digits.slice(1);
  else if (digits.indexOf('8') === 0) digits = '62' + digits;
  return /^62\d{8,13}$/.test(digits) ? digits : '';
}

/** Cegah teks orang tua dibaca sebagai rumus oleh Google Sheets. */
function safeCell_(v) {
  var s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* =====================================================================
 * 6. TANGGAL (selalu Asia/Jakarta)
 * ===================================================================== */

function todayStr_() {
  return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
}

function nowStr_() {
  return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss');
}

function isoToUtc_(iso) {
  var p = iso.split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
}

function addDays_(iso, n) {
  var dt = isoToUtc_(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.getUTCFullYear() + '-' + pad2_(dt.getUTCMonth() + 1) + '-' + pad2_(dt.getUTCDate());
}

/** 1 = Senin ... 7 = Minggu */
function dayOfWeek_(iso) {
  return isoToUtc_(iso).getUTCDay() || 7;
}

/** "2026-10-26" -> "Senin, 26 Oktober 2026" (atau "26 Oktober 2026" bila tanpaHari) */
function formatTanggal_(iso, tanpaHari) {
  var dt = isoToUtc_(iso);
  var s = dt.getUTCDate() + ' ' + BULAN[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear();
  return tanpaHari ? s : HARI[dayOfWeek_(iso)] + ', ' + s;
}

function joinIndo_(arr) {
  if (arr.length <= 1) return arr.join('');
  return arr.slice(0, -1).join(', ') + ' dan ' + arr[arr.length - 1];
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

/* =====================================================================
 * 7. UTILITAS
 * ===================================================================== */

function fail_(code, message) {
  return { ok: false, code: code, message: message };
}

function serverFail_(err) {
  console.error(err && err.stack ? err.stack : err);
  var msg = String(err && err.message || err);
  if (/SHEET_MISSING|SPREADSHEET_NOT_BOUND/.test(msg)) {
    return fail_('NOT_READY', 'Data jadwal belum siap. Mohon hubungi admin Taman Belajar Sedjati.');
  }
  return fail_('SERVER_ERROR', 'Maaf, terjadi gangguan saat mengambil data. Silakan coba beberapa saat lagi.');
}

function digest_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 40);
}

/** Token 64 karakter heksadesimal dari dua UUID acak. */
function newToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
}

/** Kode acak tanpa huruf/angka yang mirip (0/O, 1/I/L). */
function randomCode_(len) {
  var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
  var out = '';
  for (var i = 0; i < len; i++) out += alphabet.charAt(((bytes[i] + 256) % 256) % alphabet.length);
  return out;
}

/* =====================================================================
 * 8. PANEL ADMIN DI GOOGLE SHEETS
 * ===================================================================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Taman Belajar')
    .addItem('1. Siapkan struktur spreadsheet', 'setupSpreadsheet')
    .addItem('2. Lengkapi ID & kode akses yang kosong', 'fillMissingIds')
    .addItem('3. Periksa kesalahan data', 'checkData')
    .addSeparator()
    .addItem('Hapus catatan izin lama sekarang', 'cleanupOldLeaveRequests')
    .addItem('Aktifkan pembersihan izin otomatis (harian)', 'installCleanupTrigger')
    .addSeparator()
    .addItem('Muat data DEMO (untuk uji coba)', 'loadDemoData')
    .addItem('Hapus semua data DEMO', 'removeDemoData')
    .addToUi();
}

/** Simple trigger: isi updated_at otomatis saat admin mengubah baris di sheet Jadwal. */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    if (sheet.getName() !== CONFIG.SHEETS.JADWAL) return;
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim().toLowerCase(); });
    var col = headers.indexOf('updated_at') + 1;
    if (!col) return;
    var first = Math.max(2, e.range.getRow());
    var last = e.range.getLastRow();
    if (last < first) return;
    if (e.range.getColumn() === col && e.range.getNumColumns() === 1) return;
    var stamp = nowStr_();
    var vals = [];
    for (var r = first; r <= last; r++) vals.push([stamp]);
    sheet.getRange(first, col, vals.length, 1).setValues(vals);
  } catch (err) {
    console.error(err);
  }
}

/**
 * Membuat sheet Murid, Jadwal, Perizinan, Pengaturan beserta header,
 * format, pilihan dropdown, dan catatan bantuan. Aman dijalankan ulang:
 * data yang sudah ada tidak dihapus.
 */
function setupSpreadsheet() {
  var ss = getSpreadsheet_();
  ss.setSpreadsheetTimeZone(CONFIG.TZ);
  var warnings = [];
  var GREEN = '#15803D';

  Object.keys(CONFIG.HEADERS).forEach(function (name) {
    var headers = CONFIG.HEADERS[name];
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    var current = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues()[0]
      : [];
    var isEmpty = sheet.getLastRow() === 0;
    var same = headers.every(function (h, i) { return String(current[i] || '').trim().toLowerCase() === h; });
    if (isEmpty || (!same && sheet.getLastRow() <= 1)) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else if (!same) {
      warnings.push('Header sheet "' + name + '" berbeda dari standar. Periksa urutan kolom: ' + headers.join(', '));
    }
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold').setBackground(GREEN).setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    headers.forEach(function (h, i) { sheet.setColumnWidth(i + 1, h === 'nama_anak' || h === 'program' || h === 'catatan' || h === 'value' ? 220 : 140); });
  });

  var max = 1000;
  var murid = ss.getSheetByName(CONFIG.SHEETS.MURID);
  murid.getRange(2, 1, max, 4).setNumberFormat('@'); // semua teks: kode akses "012345" tidak kehilangan angka 0
  setDropdown_(murid.getRange(2, 4, max, 1), CONFIG.STATUS_MURID);
  setNotes_(murid, [
    'ID unik murid, contoh S001. Boleh dikosongkan lalu pakai menu "Lengkapi ID & kode akses".',
    'Nama lengkap anak, persis seperti yang akan diketik orang tua.',
    'Kode rahasia untuk orang tua (huruf/angka, min. 4, disarankan 6). Bagikan hanya ke orang tua murid tersebut.',
    'Aktif = jadwal bisa dilihat. Cuti/Nonaktif = orang tua melihat pesan "murid tidak aktif".'
  ]);

  var jadwal = ss.getSheetByName(CONFIG.SHEETS.JADWAL);
  jadwal.getRange(2, 1, max, 8).setNumberFormat('@');           // id, program, hari, jam sebagai teks
  jadwal.getRange(2, 9, max, 2).setNumberFormat('yyyy-mm-dd');  // tanggal_mulai, tanggal_selesai
  jadwal.getRange(2, 11, max, 1).setNumberFormat('@');
  setDropdown_(jadwal.getRange(2, 8, max, 1), CONFIG.STATUS_JADWAL);
  setNotes_(jadwal, [
    'ID unik jadwal, contoh J001. Boleh dikosongkan lalu pakai menu "Lengkapi ID & kode akses".',
    'student_id dari sheet Murid. Satu anak boleh punya banyak baris jadwal.',
    'Nama program, contoh: Bahasa Inggris, Sempoa, Calistung.',
    'Hari belajar. Satu hari ("Senin") atau beberapa ("Senin, Rabu").',
    'Jam mulai format 24 jam, contoh 15.30 atau 15:30.',
    'Jam selesai format 24 jam, contoh 16.30.',
    'Nama tutor, contoh: Kak Aisyah.',
    'Aktif = tampil. Nonaktif = disembunyikan dari orang tua.',
    'Opsional. Tanggal jadwal mulai berlaku (yyyy-mm-dd).',
    'Opsional. Setelah tanggal ini jadwal otomatis tidak tampil.',
    'Terisi otomatis setiap baris diubah.'
  ]);

  var izin = ss.getSheetByName(CONFIG.SHEETS.IZIN);
  izin.getRange(2, 1, max, 3).setNumberFormat('@');
  izin.getRange(2, 4, max, 1).setNumberFormat('yyyy-mm-dd');
  izin.getRange(2, 5, max, 4).setNumberFormat('@');
  setDropdown_(izin.getRange(2, 7, max, 1), CONFIG.STATUS_IZIN);
  setNotes_(izin, [
    'Kode pengajuan; sama dengan "Kode pengajuan" di pesan WhatsApp.', '', '', '', '',
    'Keterangan dari orang tua.',
    'Awalnya "Menunggu konfirmasi admin" — sistem TIDAK tahu apakah pesan WhatsApp benar-benar dikirim. Ubah setelah membaca WhatsApp.',
    'Waktu pengajuan dibuat (WIB).'
  ]);

  var setting = ss.getSheetByName(CONFIG.SHEETS.SETTING);
  var existingKeys = setting.getLastRow() > 1
    ? setting.getRange(2, 1, setting.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return r[0].trim().toLowerCase(); })
    : [];
  setting.getRange(1, 3).setValue('keterangan').setFontWeight('bold').setBackground(GREEN).setFontColor('#FFFFFF');
  setting.setColumnWidth(3, 420);
  DEFAULT_SETTINGS.forEach(function (s) {
    if (existingKeys.indexOf(s[0]) === -1) setting.appendRow(s);
  });
  setting.getRange(2, 2, Math.max(setting.getLastRow() - 1, 1), 1).setNumberFormat('@');

  ['Sheet1', 'Lembar1', 'Lembar 1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  SpreadsheetApp.flush();
  var msg = 'Struktur spreadsheet siap.\n\nSheet: Murid, Jadwal, Perizinan, Pengaturan.\nZona waktu: Asia/Jakarta.' +
    (warnings.length ? '\n\nPerhatian:\n- ' + warnings.join('\n- ') : '');
  alert_(msg);
  return msg;
}

function setDropdown_(range, list) {
  range.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(list, true).setAllowInvalid(false).build());
}

function setNotes_(sheet, notes) {
  sheet.getRange(1, 1, 1, notes.length).setNotes([notes]);
}

/** Isi student_id, kode_akses, dan schedule_id yang masih kosong. */
function fillMissingIds() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var filled = { murid: 0, kode: 0, jadwal: 0 };
  try {
    var murid = getSheet_(CONFIG.SHEETS.MURID);
    var mv = murid.getDataRange().getDisplayValues();
    var usedIds = mv.slice(1).map(function (r) { return r[0].trim(); });
    var usedCodes = mv.slice(1).map(function (r) { return normalizeCode_(r[2]); });
    var next = nextNumber_(usedIds, 'S');
    for (var i = 1; i < mv.length; i++) {
      if (!mv[i][1].trim()) continue;
      if (!mv[i][0].trim()) {
        mv[i][0] = 'S' + ('000' + next++).slice(-3);
        filled.murid++;
      }
      if (!mv[i][2].trim()) {
        var code;
        do { code = randomCode_(6); } while (usedCodes.indexOf(code) !== -1);
        usedCodes.push(code);
        mv[i][2] = code;
        filled.kode++;
      }
      if (!mv[i][3].trim()) mv[i][3] = 'Aktif';
    }
    if (mv.length > 1) murid.getRange(2, 1, mv.length - 1, 4).setValues(mv.slice(1).map(function (r) { return r.slice(0, 4); }));

    var jadwal = getSheet_(CONFIG.SHEETS.JADWAL);
    var jv = jadwal.getDataRange().getDisplayValues();
    var nextJ = nextNumber_(jv.slice(1).map(function (r) { return r[0].trim(); }), 'J');
    var changed = false;
    for (var j = 1; j < jv.length; j++) {
      if (!jv[j][0].trim() && jv[j][1].trim()) {
        jadwal.getRange(j + 1, 1).setValue('J' + ('000' + nextJ++).slice(-3));
        filled.jadwal++;
        changed = true;
      }
      if (jv[j][1].trim() && !jv[j][7].trim()) {
        jadwal.getRange(j + 1, 8).setValue('Aktif');
        changed = true;
      }
    }
    if (changed) SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  var msg = 'Selesai.\n- student_id baru: ' + filled.murid + '\n- kode akses baru: ' + filled.kode +
    '\n- schedule_id baru: ' + filled.jadwal + '\n\nBagikan kode akses hanya kepada orang tua murid yang bersangkutan.';
  alert_(msg);
  return filled;
}

function nextNumber_(ids, prefix) {
  var max = 0;
  ids.forEach(function (id) {
    var m = String(id).match(new RegExp('^' + prefix + '(\\d+)$'));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return max + 1;
}

/** Laporan kesalahan isian agar admin tahu baris mana yang tidak tampil di website. */
function checkData() {
  var problems = [];
  var students = readTable_(CONFIG.SHEETS.MURID, true);
  var ids = {};
  var nameCode = {};
  students.forEach(function (s) {
    var where = 'Murid baris ' + s.__row + ': ';
    var id = clean_(s.student_id);
    if (!id) problems.push(where + 'student_id kosong.');
    else if (ids[id]) problems.push(where + 'student_id "' + id + '" dipakai lebih dari sekali.');
    ids[id] = true;
    if (!clean_(s.nama_anak)) problems.push(where + 'nama_anak kosong.');
    var code = normalizeCode_(s.kode_akses);
    if (!code) problems.push(where + 'kode_akses kosong (orang tua tidak bisa masuk).');
    else if (code.length < 6 || !/^[A-Z0-9]+$/.test(code)) problems.push(where + 'kode_akses sebaiknya 6+ huruf/angka.');
    var key = normalizeName_(s.nama_anak) + '|' + code;
    if (code && nameCode[key]) problems.push(where + 'nama dan kode akses sama dengan murid lain.');
    nameCode[key] = true;
    if (CONFIG.STATUS_MURID.indexOf(clean_(s.status_murid)) === -1) problems.push(where + 'status_murid harus Aktif, Cuti, atau Nonaktif.');
  });

  var schedIds = {};
  readTable_(CONFIG.SHEETS.JADWAL, true).forEach(function (r) {
    var where = 'Jadwal baris ' + r.__row + ': ';
    var sid = clean_(r.schedule_id);
    if (!sid) problems.push(where + 'schedule_id kosong.');
    else if (schedIds[sid]) problems.push(where + 'schedule_id "' + sid + '" dipakai lebih dari sekali.');
    schedIds[sid] = true;
    if (!ids[clean_(r.student_id)]) problems.push(where + 'student_id "' + clean_(r.student_id) + '" tidak ada di sheet Murid.');
    if (!parseDays_(r.hari).length) problems.push(where + 'hari "' + clean_(r.hari) + '" tidak dikenali (contoh: Senin, Rabu).');
    var a = parseTime_(r.jam_mulai);
    var b = parseTime_(r.jam_selesai);
    if (!a) problems.push(where + 'jam_mulai "' + clean_(r.jam_mulai) + '" tidak valid (contoh 15.30).');
    if (!b) problems.push(where + 'jam_selesai "' + clean_(r.jam_selesai) + '" tidak valid (contoh 16.30).');
    if (a && b && b.minutes <= a.minutes) problems.push(where + 'jam_selesai harus setelah jam_mulai.');
    if (clean_(r.tanggal_mulai) && !parseDate_(r.tanggal_mulai)) problems.push(where + 'tanggal_mulai tidak valid.');
    if (clean_(r.tanggal_selesai) && !parseDate_(r.tanggal_selesai)) problems.push(where + 'tanggal_selesai tidak valid.');
    var m = parseDate_(r.tanggal_mulai);
    var s2 = parseDate_(r.tanggal_selesai);
    if (m && s2 && s2 < m) problems.push(where + 'tanggal_selesai lebih awal dari tanggal_mulai.');
    if (CONFIG.STATUS_JADWAL.indexOf(clean_(r.status_jadwal)) === -1) problems.push(where + 'status_jadwal harus Aktif atau Nonaktif.');
  });

  if (!normalizeWa_(getSettings_().whatsapp_admin)) problems.push('Pengaturan: whatsapp_admin tidak valid.');

  var msg = problems.length
    ? 'Ditemukan ' + problems.length + ' hal yang perlu diperbaiki:\n\n- ' + problems.slice(0, 40).join('\n- ') +
      (problems.length > 40 ? '\n... dan ' + (problems.length - 40) + ' lainnya.' : '')
    : 'Data terlihat rapi. Tidak ada kesalahan yang ditemukan.';
  alert_(msg);
  return problems;
}

/** Hapus catatan izin yang lebih lama dari "retensi_izin_hari" (default 90 hari). */
function cleanupOldLeaveRequests() {
  var days = Math.max(7, Number(getSettings_().retensi_izin_hari) || 90);
  var cutoff = addDays_(todayStr_(), -days);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var removed = 0;
  try {
    var sheet = getSheet_(CONFIG.SHEETS.IZIN);
    var values = sheet.getDataRange().getDisplayValues();
    var col = values[0].map(function (h) { return h.trim().toLowerCase(); }).indexOf('created_at');
    for (var i = values.length - 1; i >= 1; i--) {
      var created = parseDate_(String(values[i][col]).slice(0, 10));
      if (created && created < cutoff) {
        sheet.deleteRow(i + 1);
        removed++;
      }
    }
  } finally {
    lock.releaseLock();
  }
  alert_(removed + ' catatan izin yang lebih lama dari ' + days + ' hari telah dihapus.');
  return removed;
}

function installCleanupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cleanupOldLeaveRequests') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cleanupOldLeaveRequests').timeBased().everyDays(1).atHour(2).inTimezone(CONFIG.TZ).create();
  alert_('Pembersihan otomatis aktif: setiap hari sekitar pukul 02.00 WIB.');
}

/** Tampilkan pesan bila dijalankan dari menu Sheets; diam bila dari editor atau trigger. */
function alert_(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (err) {
    console.log(msg);
  }
}
