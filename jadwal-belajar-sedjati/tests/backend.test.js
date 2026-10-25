/* Tes backend Code.gs dengan Google Sheets tiruan: `node tests/backend.test.js` */
'use strict';
const assert = require('assert');
const { createGas } = require('./gas-mock');

let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const plain = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const eq = (a, b, m) => { checks++; assert.deepStrictEqual(plain(a), plain(b), m); };

const gas = createGas();
const { call, ctx, sheets } = gas;
const sheetRows = n => sheets.get(n).data;
const setCell = (sheetName, matchCol, matchVal, col, val) => {
  const data = sheetRows(sheetName);
  const h = data[0];
  const row = data.find(r => r[h.indexOf(matchCol)] === matchVal);
  row[h.indexOf(col)] = val;
};

// ---------- Helper parsing ----------
eq(ctx.parseTime_('15.30'), { label: '15.30', minutes: 930 }, 'jam titik');
eq(ctx.parseTime_('15:30:00').label, '15.30', 'jam detik');
eq(ctx.parseTime_('3:30 PM').label, '15.30', 'jam AM/PM');
eq(ctx.parseTime_('25.00'), null, 'jam tidak valid');
eq(ctx.parseDate_('1/7/2026'), '2026-07-01', 'tanggal dd/mm/yyyy');
eq(ctx.parseDate_('2026-02-30'), '', 'tanggal mustahil');
eq(JSON.parse(JSON.stringify(ctx.parseDays_("Jum'at dan Sabtu"))), [5, 6], 'hari jamak');
eq(JSON.parse(JSON.stringify(ctx.parseDays_('Rabu, senin, Rabu'))), [1, 3], 'hari unik & urut');
eq(ctx.normalizeWa_('085743008511'), '6285743008511', 'WA 08');
eq(ctx.normalizeWa_('+62 857-4300-8511'), '6285743008511', 'WA +62');
eq(ctx.normalizeWa_('123'), '', 'WA tidak valid');
eq(ctx.formatTanggal_('2026-10-26'), 'Senin, 26 Oktober 2026', 'format tanggal Indonesia');
eq(ctx.safeCell_('=HYPERLINK("x")'), '\'=HYPERLINK("x")', 'cegah rumus');

// ---------- Belum di-setup ----------
let r = call('verifyStudentAccess', 'Ahmad Fauzan', 'DEMO01');
eq(r.code, 'NOT_READY', 'sheet belum ada -> pesan ramah');
eq(call('getPublicSettings').nama_lembaga, 'Taman Belajar Sedjati', 'pengaturan default sebelum setup');

// ---------- Setup ----------
call('setupSpreadsheet');
eq([...sheets.keys()].sort(), ['Jadwal', 'Murid', 'Pengaturan', 'Perizinan'], 'empat sheet dibuat');
eq(sheetRows('Jadwal')[0].slice(0, 11), ctx.CONFIG.HEADERS.Jadwal, 'header Jadwal');
call('setupSpreadsheet'); // dijalankan ulang: tidak menggandakan pengaturan
eq(sheetRows('Pengaturan').filter(rw => rw[0] === 'whatsapp_admin').length, 1, 'setup idempoten');
const pub = call('getPublicSettings');
eq(Object.keys(pub).sort(), ['info_header', 'logo_url', 'nama_lembaga'], 'pengaturan publik tanpa nomor WA');

// ---------- Demo ----------
call('loadDemoData');
eq(call('checkData'), [], 'data demo lolos pemeriksaan');

// ---------- Verifikasi ----------
r = call('verifyStudentAccess', '  ahmad   FAUZAN ', 'demo-01');
ok(r.ok, 'nama tidak peka huruf besar, kode dinormalisasi');
ok(/^[a-f0-9]{64}$/.test(r.token), 'token sesi 64 heks');
const tokenAhmad = r.token;
const d = r.data;
eq(d.student.nama, 'Ahmad Fauzan', 'nama anak');
ok(d.isDemo, 'ditandai demo');
eq(d.schedules.map(s => s.program), ['Bahasa Inggris', 'Matematika'], 'dua program, jadwal nonaktif disembunyikan, urut hari');
eq(d.schedules[0].hariText, 'Senin dan Rabu', 'label hari jamak');
eq([d.schedules[0].jamMulai, d.schedules[0].jamSelesai, d.schedules[0].tutor], ['15.30', '16.30', 'Kak Aisyah'], 'jam & tutor');
const json = JSON.stringify(r);
['DEMO01', 'DEMO02', 'DEMO-001', 'student_id', 'kode', 'Aisyah Putri', 'Raihan', '0857', '62857'].forEach(s =>
  ok(!json.includes(s), 'payload tidak memuat ' + s));

r = call('verifyStudentAccess', 'Aisyah Putri', 'DEMO02');
eq(r.data.schedules.map(s => s.program), ['Sempoa'], 'jadwal yang masa berlakunya lewat tidak tampil');

eq(call('verifyStudentAccess', 'Ahmad Fauzan', 'SALAH1').code, 'NO_MATCH', 'kode salah -> pesan umum');
eq(call('verifyStudentAccess', 'Tidak Ada', 'DEMO01').code, 'NO_MATCH', 'nama tak dikenal -> pesan umum');
eq(call('verifyStudentAccess', 'Aisyah Putri', 'DEMO01').code, 'NO_MATCH', 'kode murid lain ditolak');
eq(call('verifyStudentAccess', 'A', 'DEMO01').code, 'INVALID_INPUT', 'nama terlalu pendek');
eq(call('verifyStudentAccess', 'Ahmad', 'x<1>').code, 'INVALID_INPUT', 'kode berkarakter aneh');
eq(call('verifyStudentAccess', 'Budi Contoh', 'DEMO04').code, 'INACTIVE', 'murid nonaktif');

setCell('Pengaturan', 'key', 'pesan_gagal_spesifik', 'value', 'ya');
eq(call('verifyStudentAccess', 'Tidak Ada', 'DEMO01').code, 'NOT_FOUND', 'mode spesifik: nama tidak ditemukan');
eq(call('verifyStudentAccess', 'Muhammad Raihan', 'SALAH1').code, 'WRONG_CODE', 'mode spesifik: kode salah');
setCell('Pengaturan', 'key', 'pesan_gagal_spesifik', 'value', 'tidak');

for (let i = 0; i < 5; i++) call('verifyStudentAccess', 'Muhammad Raihan', 'SALAH' + i);
eq(call('verifyStudentAccess', 'Muhammad Raihan', 'DEMO03').code, 'LOCKED', 'dikunci setelah 5 kali salah');
eq(call('verifyStudentAccess', 'Aisyah Putri', 'DEMO02').ok, true, 'kunci hanya untuk nama itu');

// ---------- Sesi & perubahan jadwal ----------
eq(call('getStudentSchedule', 'abc').code, 'SESSION_EXPIRED', 'token palsu ditolak');
eq(call('getStudentSchedule', 'a'.repeat(64)).code, 'SESSION_EXPIRED', 'token tak dikenal ditolak');
setCell('Jadwal', 'schedule_id', 'DEMO-J01', 'tutor', 'Kak Nadia');
setCell('Jadwal', 'schedule_id', 'DEMO-J01', 'jam_mulai', '16:00');
setCell('Jadwal', 'schedule_id', 'DEMO-J01', 'jam_selesai', '17.00');
r = call('getStudentSchedule', tokenAhmad);
eq([r.data.schedules[0].tutor, r.data.schedules[0].jamMulai], ['Kak Nadia', '16.00'], 'perubahan admin langsung terbaca');
setCell('Jadwal', 'schedule_id', 'DEMO-J02', 'status_jadwal', 'Nonaktif');
eq(call('getStudentSchedule', tokenAhmad).data.schedules.length, 1, 'jadwal dinonaktifkan hilang');
setCell('Jadwal', 'schedule_id', 'DEMO-J02', 'status_jadwal', 'Aktif');
setCell('Jadwal', 'schedule_id', 'DEMO-J01', 'jam_mulai', '15.30');
setCell('Jadwal', 'schedule_id', 'DEMO-J01', 'jam_selesai', '16.30');
setCell('Jadwal', 'schedule_id', 'DEMO-J01', 'tutor', 'Kak Aisyah');

// ---------- Perizinan ----------
const today = ctx.todayStr_();
const nextDow = (dow, from = today) => { for (let i = 0; i < 8; i++) { const x = ctx.addDays_(from, i); if (ctx.dayOfWeek_(x) === dow) return x; } };
const senin = nextDow(1);
r = call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J01', tanggal: senin, alasan: 'Sakit', catatan: 'Sedang demam.' });
ok(r.ok && r.logged && /^IZN-\d{8}-[A-Z0-9]{4}$/.test(r.izinId), 'izin dicatat dengan kode');
ok(r.waUrl.startsWith('https://wa.me/6285743008511?text='), 'tautan wa.me nomor internasional');
const msg = decodeURIComponent(r.waUrl.split('?text=')[1]);
eq(msg, r.message, 'pesan di-encode utuh');
[
  "Assalamu'alaikum Admin Taman Belajar Sedjati.", 'Nama anak: Ahmad Fauzan', 'Program: Bahasa Inggris',
  'Hari/tanggal pertemuan: ' + ctx.formatTanggal_(senin), 'Jam belajar: 15.30–16.30', 'Tutor: Kak Aisyah',
  'Alasan: Sakit', 'Catatan: Sedang demam.', 'Kode pengajuan: ' + r.izinId, "Wassalamu'alaikum."
].forEach(line => ok(msg.split('\n').includes(line), 'baris pesan: ' + line));
const izinRows = sheetRows('Perizinan').slice(1).filter(rw => rw[0]);
eq(izinRows.length, 1, 'satu baris izin');
eq(izinRows[0].slice(1, 7), ['DEMO-001', 'DEMO-J01', senin, 'Sakit', 'Sedang demam.', 'Menunggu konfirmasi admin'], 'isi baris izin & status awal jujur');

const dup = call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J01', tanggal: senin, alasan: 'Sakit', catatan: '' });
ok(dup.ok && dup.duplicate && dup.izinId === r.izinId, 'pengajuan ganda memakai kode yang sama');
eq(sheetRows('Perizinan').slice(1).filter(rw => rw[0]).length, 1, 'tidak ada baris ganda');

const selasa = nextDow(2);
eq(call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J01', tanggal: selasa, alasan: 'Sakit' }).code, 'INVALID_INPUT', 'hari tidak sesuai jadwal');
eq(call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J01', tanggal: ctx.addDays_(senin, -7), alasan: 'Sakit' }).code, 'INVALID_INPUT', 'tanggal lampau');
eq(call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J01', tanggal: ctx.addDays_(senin, 70), alasan: 'Sakit' }).code, 'INVALID_INPUT', 'terlalu jauh');
eq(call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J01', tanggal: senin, alasan: 'Liburan' }).code, 'INVALID_INPUT', 'alasan di luar daftar');
eq(call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J01', tanggal: senin, alasan: 'Lainnya', catatan: '  ' }).code, 'INVALID_INPUT', 'Lainnya wajib catatan');
eq(call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J01', tanggal: senin, alasan: 'Sakit', catatan: 'x'.repeat(301) }).code, 'INVALID_INPUT', 'catatan terlalu panjang');
eq(call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J03', tanggal: nextDow(2), alasan: 'Sakit' }).code, 'SCHEDULE_NOT_FOUND', 'jadwal anak lain ditolak');
eq(call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J05', tanggal: nextDow(5), alasan: 'Sakit' }).code, 'SCHEDULE_NOT_FOUND', 'jadwal nonaktif ditolak');
eq(call('logLeaveRequest', 'x', { scheduleId: 'DEMO-J01', tanggal: senin, alasan: 'Sakit' }).code, 'SESSION_EXPIRED', 'izin tanpa sesi ditolak');

const kamis = nextDow(4);
r = call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J02', tanggal: kamis, alasan: 'Lainnya', catatan: '=HYPERLINK("http://x")\nbaris2' });
ok(r.ok, 'izin kedua');
const last = sheetRows('Perizinan').slice(1).filter(rw => rw[0]).pop();
eq(last[5], '=HYPERLINK("http://x") baris2', 'catatan satu baris, disimpan sebagai teks (apostrof)');

setCell('Pengaturan', 'key', 'catat_izin', 'value', 'tidak');
r = call('logLeaveRequest', tokenAhmad, { scheduleId: 'DEMO-J02', tanggal: ctx.addDays_(kamis, 7), alasan: 'Keperluan keluarga' });
ok(r.ok && !r.logged && !r.izinId && !r.message.includes('Kode pengajuan'), 'mode tanpa pencatatan');
eq(sheetRows('Perizinan').slice(1).filter(rw => rw[0]).length, 2, 'tidak menambah baris');
setCell('Pengaturan', 'key', 'catat_izin', 'value', 'ya');

// ---------- Admin menonaktifkan murid / mencabut kode di tengah sesi ----------
setCell('Murid', 'student_id', 'DEMO-001', 'status_murid', 'Cuti');
eq(call('getStudentSchedule', tokenAhmad).code, 'INACTIVE', 'murid cuti -> sesi berhenti');
eq(call('getStudentSchedule', tokenAhmad).code, 'SESSION_EXPIRED', 'sesi dihapus');
setCell('Murid', 'student_id', 'DEMO-001', 'status_murid', 'Aktif');

// ---------- Kode akses diganti admin -> sesi lama berakhir ----------
const tokAisyah = call('verifyStudentAccess', 'Aisyah Putri', 'DEMO02').token;
eq(call('getStudentSchedule', tokAisyah).ok, true, 'sesi Aisyah aktif');
setCell('Murid', 'student_id', 'DEMO-002', 'kode_akses', 'BARU22');
eq(call('getStudentSchedule', tokAisyah).code, 'SESSION_EXPIRED', 'kode diganti -> sesi lama berakhir');
setCell('Murid', 'student_id', 'DEMO-002', 'kode_akses', 'DEMO02');
eq(call('getStudentSchedule', tokAisyah).code, 'SESSION_EXPIRED', 'sesi tetap terhapus');

// ---------- Retensi ----------
const izin = sheets.get('Perizinan');
izin.appendRow(['IZN-LAMA', 'DEMO-001', 'DEMO-J01', '2020-01-06', 'Sakit', '', 'Diterima', '2020-01-05 10:00:00']);
eq(call('cleanupOldLeaveRequests'), 1, 'izin lama dihapus');
eq(sheetRows('Perizinan').slice(1).filter(rw => rw[0]).length, 2, 'izin baru tetap');

// ---------- Lengkapi ID ----------
sheets.get('Murid').appendRow(['', 'Murid Baru', '', '']);
sheets.get('Jadwal').appendRow(['', 'S001', 'Tahfidz', 'Sabtu', '08.00', '09.00', 'Kak Umar', '', '', '', '']);
const filled = call('fillMissingIds');
eq(filled, { murid: 1, kode: 1, jadwal: 1 }, 'ID & kode diisi');
const baru = sheetRows('Murid').find(rw => rw[1] === 'Murid Baru');
ok(baru[0] === 'S001' && /^[A-HJKMNP-Z2-9]{6}$/.test(baru[2]) && baru[3] === 'Aktif', 'murid baru: S001 + kode 6 karakter');
r = call('verifyStudentAccess', 'murid baru', baru[2].toLowerCase());
ok(r.ok && r.data.schedules[0].program === 'Tahfidz' && !r.data.isDemo, 'murid baru bisa masuk, bukan demo');
eq(r.data.schedules[0].scheduleId, 'J001', 'schedule_id J001');

// ---------- Cek data menemukan kesalahan ----------
sheets.get('Jadwal').appendRow(['J009', 'S999', 'X', 'Senen', '17.00', '16.00', '', 'Aktif', '', '', '']);
const problems = call('checkData');
ok(problems.some(p => p.includes('S999')) && problems.some(p => p.includes('Senen')) && problems.some(p => p.includes('setelah jam_mulai')), 'checkData melaporkan baris salah');
sheets.get('Jadwal').deleteRow(sheets.get('Jadwal').getLastRow());

// ---------- Hapus demo ----------
call('removeDemoData');
const allText = JSON.stringify([...sheets.values()].map(s => s.data));
ok(!allText.includes('DEMO-'), 'semua data demo terhapus');
eq(call('verifyStudentAccess', 'Ahmad Fauzan', 'DEMO01').code, 'NO_MATCH', 'demo tidak bisa dipakai lagi');

// ---------- Fungsi yang dipanggil frontend benar-benar ada ----------
const fs = require('fs');
const scripts = fs.readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Scripts.html'), 'utf8');
const called = [...scripts.matchAll(/callServer\('(\w+)'/g)].map(m => m[1]);
ok(called.length >= 3, 'frontend memanggil server');
called.forEach(fn => ok(typeof ctx[fn] === 'function' && !fn.endsWith('_'), 'fungsi server ada & publik: ' + fn));

console.log('backend: ' + checks + ' pemeriksaan lulus');
