/**
 * DATA DEMO — HANYA UNTUK UJI COBA.
 *
 * Semua murid demo memakai student_id berawalan "DEMO-" dan website
 * menampilkan pita kuning "DATA DEMO" saat data ini dibuka.
 * Jalankan menu "Taman Belajar > Hapus semua data DEMO" sebelum link
 * website dibagikan ke orang tua, lalu isi dengan data murid sebenarnya.
 *
 * Kode akses demo:
 *   Ahmad Fauzan    -> DEMO01  (2 program: Bahasa Inggris & Matematika, + 1 jadwal nonaktif)
 *   Aisyah Putri    -> DEMO02
 *   Muhammad Raihan -> DEMO03
 *   Budi Contoh     -> DEMO04  (status Nonaktif, untuk menguji pesan "murid tidak aktif")
 */

function demoRows_() {
  var today = todayStr_();
  var mulai = addDays_(today, -30);
  var selesai = addDays_(today, 180);
  var lalu = addDays_(today, -10);
  var now = nowStr_();
  return {
    murid: [
      ['DEMO-001', 'Ahmad Fauzan', 'DEMO01', 'Aktif'],
      ['DEMO-002', 'Aisyah Putri', 'DEMO02', 'Aktif'],
      ['DEMO-003', 'Muhammad Raihan', 'DEMO03', 'Aktif'],
      ['DEMO-004', 'Budi Contoh', 'DEMO04', 'Nonaktif']
    ],
    jadwal: [
      ['DEMO-J01', 'DEMO-001', 'Bahasa Inggris', 'Senin, Rabu', '15.30', '16.30', 'Kak Aisyah', 'Aktif', mulai, selesai, now],
      ['DEMO-J02', 'DEMO-001', 'Matematika', 'Kamis', '16.00', '17.00', 'Kak Dini', 'Aktif', mulai, selesai, now],
      ['DEMO-J03', 'DEMO-002', 'Sempoa', 'Selasa', '16.00', '17.00', 'Kak Rina', 'Aktif', mulai, selesai, now],
      ['DEMO-J04', 'DEMO-003', 'Calistung', 'Rabu', '15.30', '16.30', 'Kak Dini', 'Aktif', mulai, selesai, now],
      // Jadwal yang sudah tidak berlaku: tidak boleh tampil di website.
      ['DEMO-J05', 'DEMO-001', 'Bahasa Inggris (kelas lama)', 'Jumat', '15.00', '16.00', 'Kak Aisyah', 'Nonaktif', mulai, selesai, now],
      ['DEMO-J06', 'DEMO-002', 'Mengaji (sudah selesai)', 'Sabtu', '09.00', '10.00', 'Kak Rina', 'Aktif', mulai, lalu, now]
    ]
  };
}

function loadDemoData() {
  var ss = getSpreadsheet_();
  if (!ss.getSheetByName(CONFIG.SHEETS.MURID)) setupSpreadsheet();
  removeDemoRows_();
  var rows = demoRows_();
  var murid = getSheet_(CONFIG.SHEETS.MURID);
  var jadwal = getSheet_(CONFIG.SHEETS.JADWAL);
  murid.getRange(murid.getLastRow() + 1, 1, rows.murid.length, 4).setValues(rows.murid);
  jadwal.getRange(jadwal.getLastRow() + 1, 1, rows.jadwal.length, 11).setValues(rows.jadwal);
  SpreadsheetApp.flush();
  alert_('Data DEMO dimuat.\n\nCoba di website:\n- Ahmad Fauzan / DEMO01\n- Aisyah Putri / DEMO02\n' +
    '- Muhammad Raihan / DEMO03\n- Budi Contoh / DEMO04 (murid nonaktif)\n\n' +
    'PENTING: hapus data DEMO sebelum website dibagikan ke orang tua.');
}

function removeDemoData() {
  var removed = removeDemoRows_();
  alert_('Data DEMO dihapus: ' + removed + ' baris.');
}

function removeDemoRows_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var removed = 0;
  try {
    [CONFIG.SHEETS.MURID, CONFIG.SHEETS.JADWAL, CONFIG.SHEETS.IZIN].forEach(function (name) {
      var sheet = getSpreadsheet_().getSheetByName(name);
      if (!sheet) return;
      var values = sheet.getDataRange().getDisplayValues();
      var col = values[0].map(function (h) { return h.trim().toLowerCase(); }).indexOf('student_id');
      if (col === -1) return;
      for (var i = values.length - 1; i >= 1; i--) {
        if (String(values[i][col]).indexOf(CONFIG.DEMO_PREFIX) === 0) {
          sheet.deleteRow(i + 1);
          removed++;
        }
      }
    });
  } finally {
    lock.releaseLock();
  }
  return removed;
}
