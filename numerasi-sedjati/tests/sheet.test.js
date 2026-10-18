/* Tes kirim ke Google Spreadsheet & antrean offline: `node tests/sheet.test.js` */
'use strict';
const assert = require('assert');
const P = require('../js/progress.js');
const S = require('../js/sheet.js');

let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const URL = 'https://script.google.com/macros/s/ABC123/exec';

function fakeLS() {
  const d = {};
  return { d, getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: k => { delete d[k]; } };
}
function fakeFetch(state) {
  return async (url, opts) => {
    state.calls.push({ url, opts });
    if (!state.online) throw new Error('offline');
    if (opts && opts.method === 'POST') state.rows.push(JSON.parse(opts.body));
    return { json: async () => (state.reply || { ok: true, app: 'sedjati-numeracy' }) };
  };
}

(async () => {
  // URL
  ok(S.validUrl(URL), 'URL Apps Script valid');
  ok(!S.validUrl('http://script.google.com/x') && !S.validUrl('https://evil.com/exec') && !S.validUrl('') && !S.validUrl(null), 'URL lain ditolak');

  // Catatan yang dikirim
  const p = P.newPlayer({ name: 'Dinda', group: 'sd12' });
  const G = require('../js/generator.js');
  ['first', 'first', 'help', 'wrong'].forEach(o => P.recordAnswer(p, G.generate('add', 1, G.makeCtx('starter')), o, '5'));
  const r = P.finishMission(p, 'add', 1, ['first', 'first', 'help', 'wrong'], 'mission');
  const rec = S.buildRecord(p, {}, { kind: 'mission', area: 'add', step: 1, result: r });
  ok(rec.app === 'sedjati-numeracy' && rec.playerId === p.id && rec.name === 'Dinda', 'identitas catatan');
  ok(rec.group === 'Kelas 1–2' && rec.mode === 'SD Starter', 'kelompok & mode bernama');
  ok(rec.result.kind === 'Misi' && rec.result.level === '2' && rec.result.area === 'Rumah Penjumlahan', 'jenis & area');
  ok(rec.result.mission === 'Misi 2: Penjumlahan sampai 10', 'nama misi');
  ok(rec.result.total === 4 && rec.result.first === 2 && rec.result.helped === 1 && rec.result.wrong === 1, 'rincian jawaban');
  ok(rec.result.percent === 63 && rec.result.stars === 1 && rec.result.completed === true, 'nilai, bintang, selesai');
  ok(rec.snapshot.stars === 1 && rec.snapshot.missions === 1, 'rekap bintang & misi');
  ok(/Penjumlahan|Rumah/.test(rec.snapshot.next) || rec.snapshot.next.length > 0, 'saran berikutnya ada');
  ok(rec.snapshot.ops.add.includes('dari') && rec.snapshot.ops.mul === 'Belum dicoba', 'ringkasan per operasi');
  ok(!/NaN|undefined/.test(JSON.stringify(rec)), 'tidak ada NaN/undefined');
  const recT = S.buildRecord(p, {}, { kind: 'final', area: 'add', result: { total: 6, correct: 5, first: 5, wrong: 1 } });
  ok(recT.result.kind === 'Tes Akhir' && recT.result.percent === 83 && recT.result.stars === '' && recT.result.completed === null, 'catatan tes akhir');
  const recD = S.buildRecord(p, {}, { kind: 'diagnostic', result: { total: 8, correct: 6 } });
  ok(recD.result.area === 'Beberapa area' && recD.result.percent === 75, 'catatan tes awal');

  // Tanpa URL → hanya lokal, tidak ada permintaan jaringan
  let state = { calls: [], rows: [], online: true };
  let ls = fakeLS();
  let sender = S.createSender({ getUrl: () => '', storage: ls, fetch: fakeFetch(state) });
  ok(await sender.send(rec) === 'local' && state.calls.length === 0, 'tanpa URL: tidak mengirim apa pun');

  // Online → terkirim
  sender = S.createSender({ getUrl: () => URL, storage: ls, fetch: fakeFetch(state) });
  ok(await sender.send(rec) === 'sheet' && state.rows.length === 1 && sender.pending() === 0, 'online: terkirim');
  ok(state.calls[0].opts.headers['Content-Type'].startsWith('text/plain'), 'tanpa preflight CORS');

  // Offline → antre, lalu terkirim saat online
  state.online = false;
  ok(await sender.send({ ...rec, time: 1 }) === 'queued', 'offline: masuk antrean');
  ok(await sender.send({ ...rec, time: 2 }) === 'queued' && sender.pending() === 2, 'antrean bertambah');
  ok(JSON.parse(ls.d[S.QUEUE_KEY]).length === 2, 'antrean tersimpan di perangkat');
  state.online = true;
  ok(await sender.flush() === 2 && sender.pending() === 0, 'antrean terkirim saat online');
  ok(state.rows.map(x => x.time).join() === [rec.time, 1, 2].join(), 'urutan kiriman terjaga');

  // Apps Script menolak → tetap di antrean
  state.reply = { ok: false, error: 'x' };
  ok(await sender.send({ ...rec, time: 3 }) === 'queued', 'ditolak server: tetap di antrean');
  state.reply = null;

  // Antrean dibatasi & data rusak aman
  ls.d[S.QUEUE_KEY] = '{rusak';
  ok(sender.pending() === 0, 'antrean rusak dianggap kosong');
  state.online = false;
  for (let i = 0; i < 305; i++) await sender.send({ ...rec, time: 1000 + i });
  ok(sender.pending() === 300, 'antrean dibatasi 300');

  // Tanpa localStorage → antrean di memori
  state = { calls: [], rows: [], online: false };
  sender = S.createSender({ getUrl: () => URL, storage: null, fetch: fakeFetch(state) });
  ok(await sender.send(rec) === 'queued' && sender.pending() === 1, 'tanpa localStorage: antre di memori');

  // Tes koneksi
  state = { calls: [], rows: [], online: true };
  sender = S.createSender({ getUrl: () => URL, storage: fakeLS(), fetch: fakeFetch(state) });
  ok((await sender.test(URL)).ok && state.calls[0].url.endsWith('?action=ping'), 'tes koneksi berhasil');
  state.reply = { ok: true, message: 'API English Fun Games aktif.' };
  ok(!(await sender.test(URL)).ok, 'URL game lain ditolak');
  ok(!(await sender.test('https://contoh.com')).ok, 'URL salah ditolak');
  state.online = false;
  ok(!(await sender.test(URL)).ok, 'offline: tes gagal dengan pesan');

  // URL dari pengaturan tersimpan disaring
  const st = P.sanitizeStore({ settings: { sheetUrl: URL } });
  ok(st.settings.sheetUrl === URL, 'URL valid tersimpan');
  ok(P.sanitizeStore({ settings: { sheetUrl: 'javascript:alert(1)' } }).settings.sheetUrl === '', 'URL berbahaya dibuang');

  console.log(`✔ sheet.test.js: ${checks} pengecekan lulus`);
})().catch(e => { console.error(e); process.exit(1); });
