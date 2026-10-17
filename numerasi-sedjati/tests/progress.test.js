/* Tes progres, penyimpanan & adaptasi: `node tests/progress.test.js` */
'use strict';
const assert = require('assert');
const P = require('../js/progress.js');
const G = require('../js/generator.js');

let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const eq = (a, b, m) => { checks++; assert.deepStrictEqual(a, b, m); };

function fakeLS(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; }
  };
}
const q = (area, step) => G.generate(area, step, G.makeCtx('starter'));

// --- Nama
eq(P.sanitizeName('  <b>Dinda</b>  '), 'bDinda/b', 'tag dibuang');
eq(P.sanitizeName(''), 'Tamu', 'nama kosong jadi Tamu');
ok(P.sanitizeName('A'.repeat(200)).length === 20, 'nama dipotong 20 huruf');

// --- Data tersimpan rusak / tidak ada
[null, 42, 'teks', [], { players: 'x' }, { players: { bad: 1, 'p1': 'x' } }, { players: { p1: { name: 5, missions: { 'add-9': {}, 'add-1': { stars: 99, completed: 'ya' } }, ops: { add: { attempted: -3, recent: [1, 7, 'a'] } } } }, currentId: 'p1' }]
  .forEach(raw => {
    const s = P.sanitizeStore(raw);
    ok(s.version === 1 && typeof s.players === 'object' && typeof s.settings.sound === 'boolean', 'store aman untuk ' + JSON.stringify(raw));
  });
{
  const s = P.sanitizeStore({ players: { p1: { name: 5, missions: { 'add-9': {}, 'add-1': { stars: 99, completed: 'ya' } }, ops: { add: { attempted: -3, recent: [1, 7, 'a'] } } } }, currentId: 'p1' });
  const p = s.players.p1;
  ok(p && p.name === '5', 'nama non-string dirapikan');
  ok(!p.missions['add-9'], 'misi tidak valid dibuang');
  ok(p.missions['add-1'].stars === 3 && p.missions['add-1'].completed === false, 'bintang dibatasi & boolean dicek');
  ok(p.ops.add.attempted === 0 && p.ops.add.recent.length === 1, 'statistik negatif/aneh dibersihkan');
  ok(s.currentId === 'p1', 'pemain aktif dipertahankan');
}

// --- Penyimpanan: kosong, rusak, tidak tersedia, simpan-muat
{
  const st = P.createStorage(() => fakeLS());
  ok(st.available && st.load().status === 'empty', 'penyimpanan kosong');
  const ls = fakeLS({ [P.KEY]: '{rusak' });
  const st2 = P.createStorage(() => ls);
  const r = st2.load();
  ok(r.status === 'corrupt' && Object.keys(r.store.players).length === 0, 'JSON rusak tidak membuat crash');
  ok(ls.data[P.KEY + ':rusak'] === '{rusak', 'data rusak dicadangkan');
  const st3 = P.createStorage(() => { throw new Error('SecurityError'); });
  ok(!st3.available && st3.load().status === 'unavailable' && st3.save({}) === false, 'localStorage tidak tersedia ditangani');
  const full = fakeLS(); full.setItem = (k) => { if (k !== '__sna_probe__') throw new Error('QuotaExceeded'); };
  ok(P.createStorage(() => full).save({}) === false, 'memori penuh ditangani');
}

// --- Alur pemain
const ls = fakeLS();
const storage = P.createStorage(() => ls);
const store = P.defaultStore();
const p = P.newPlayer({ name: 'Bima', group: 'sd12' });
store.players[p.id] = p; store.currentId = p.id;
ok(p.mode === 'starter', 'mode mengikuti kelompok');

// Ketersediaan misi (SD Starter mulai di langkah 2)
ok(P.isAvailable(p, store.settings, 'add', 0) && P.isAvailable(p, store.settings, 'add', 1), 'misi awal terbuka');
ok(!P.isAvailable(p, store.settings, 'add', 2), 'misi lanjutan terkunci');
ok(P.isAvailable(p, store.settings, 'count', 3), 'Kebun Angka selalu terbuka');
ok(P.isAvailable(p, { unlockAll: true }, 'mix', 4), 'guru bisa membuka semua');

// Rekomendasi pertama
let rec = P.recommend(p, store.settings);
eq([rec.area, rec.step], ['add', 1], 'rekomendasi pertama SD Starter: tambah sampai 10');

// Misi bagus → bintang 3, selesai, misi berikutnya terbuka
const good = Array(8).fill('first');
const r1 = P.finishMission(p, 'add', 1, good, 'mission');
ok(r1.stars === 3 && r1.completed, '8/8 benar = 3 bintang');
ok(P.isAvailable(p, store.settings, 'add', 2), 'misi berikutnya terbuka setelah selesai');
// Misi buruk tidak menghapus bintang lama
const r2 = P.finishMission(p, 'add', 1, Array(8).fill('wrong'), 'mission');
ok(r2.stars === 0 && !r2.completed, 'misi gagal tidak selesai');
ok(P.mission(p, 'add', 1).stars === 3 && P.mission(p, 'add', 1).completed, 'bintang & status selesai tidak hilang');
eq(P.totalStars(p), 3, 'total bintang tetap');
// Setelah gagal → rekomendasi mengulang (lebih mudah)
rec = P.recommend(p, store.settings);
eq([rec.area, rec.step], ['add', 0], 'setelah kesulitan, turun satu langkah');
ok(/mudah/.test(rec.reason), 'alasan ramah');

// Nilai: benar setelah bantuan = ½
const sc = P.scoreOf(['first', 'help', 'wrong', 'first']);
ok(Math.abs(sc.score - 0.625) < 1e-9 && sc.stars === 1 && sc.completed, 'perhitungan nilai (62,5% = 1 bintang)');
ok(!P.scoreOf(['first', 'wrong', 'wrong']).completed, 'di bawah 60% belum selesai');
eq(P.scoreOf(['first', 'first', 'first', 'help']).stars, 2, '87,5% = 2 bintang');

// Statistik per operasi & penguasaan tidak dari satu kuis
for (let i = 0; i < 8; i++) P.recordAnswer(p, q('mul', 2), 'first', '6');
let st = P.opStatus(p, 'mul');
ok(st.attempted === 8 && st.level === 'practice', 'satu kuis singkat belum "dikuasai"');
for (let i = 0; i < 20; i++) P.recordAnswer(p, q('mul', 2), 'first', '6');
st = P.opStatus(p, 'mul');
ok(st.level === 'fluent', 'banyak benar tapi belum 2 sesi bagus → "Mulai lancar"');
P.finishMission(p, 'mul', 2, good, 'mission'); P.finishMission(p, 'mul', 2, good, 'mission');
ok(P.opStatus(p, 'mul').level === 'mastered', 'dikuasai setelah latihan berulang');
ok(P.opStatus(p, 'div').label === 'Belum dicoba', 'operasi belum dicoba');
for (let i = 0; i < 6; i++) P.recordAnswer(p, q('sub', 1), 'wrong', '0');
ok(P.opStatus(p, 'sub').needsPractice, 'pengurangan perlu latihan');
ok(P.reviewSteps(p).some(x => x.area === 'sub'), 'soal sulit masuk latihan ulang');
ok(p.history.length <= 80, 'riwayat dibatasi');

// Lencana: diperoleh dari capaian, tidak dicabut
P.finishMission(p, 'add', 0, good, 'mission'); P.finishMission(p, 'add', 2, good, 'mission');
ok(p.badges.tambah, 'Jago Penjumlahan setelah 3 misi ≥ 2 bintang');
P.finishMission(p, 'add', 2, Array(8).fill('wrong'), 'mission');
ok(p.badges.tambah, 'lencana tidak hilang setelah salah');

// Tes awal
const plan = P.diagnosticPlan('starter');
ok(plan.length === 4, 'rencana tes awal SD Starter');
eq(P.diagnosticNextStep('add', 1, true), 2, 'naik jika benar');
eq(P.diagnosticNextStep('add', 1, false), 0, 'turun jika salah');
const p2 = P.newPlayer({ group: 'sd56' });
P.applyDiagnostic(p2, [{ area: 'add', probe: 3, answers: [{ step: 3, ok: true }, { step: 4, ok: true }] }, { area: 'sub', probe: 3, answers: [{ step: 3, ok: false }, { step: 2, ok: false }] }]);
ok(p2.base.add === 4 && p2.base.sub === 1, 'titik awal dari tes awal');
ok(P.isAvailable(p2, {}, 'add', 4), 'misi sesuai hasil tes awal terbuka');
ok(!P.compareAssessment(p2, 'add').enough, 'tidak klaim peningkatan tanpa tes akhir');

// Tes akhir
ok(!P.canFinal(p2, 'add'), 'tes akhir butuh 2 misi');
ok(P.canFinal(p, 'add') && P.finalPlan(p, 'add').length === 6, 'rencana tes akhir 6 soal');
const fin = P.applyFinal(p, 'add', [{ step: 2, ok: true }, { step: 1, ok: false }]);
ok(fin.correct === 1 && fin.steps[1].c === 0, 'hasil tes akhir per langkah');

// Simpan & muat ulang
ok(storage.save(store), 'tersimpan');
const back = storage.load();
ok(back.status === 'ok' && back.store.players[p.id].name === 'Bima', 'dimuat ulang');
eq(P.totalStars(back.store.players[p.id]), P.totalStars(p), 'bintang sama setelah dimuat');
eq(Object.keys(back.store.players[p.id].badges).sort(), Object.keys(p.badges).sort(), 'lencana sama setelah dimuat');
ok(back.store.players[p.id].assess.final.add.correct === 1, 'tes akhir tersimpan');

// TK: perkalian/pembagian tidak disarankan sebelum tambah sampai 10
const tk = P.newPlayer({ group: 'tk' });
rec = P.recommend(tk, {});
eq(rec.area, 'count', 'TK mulai dari Kebun Angka');
ok(tk.mode === 'tk' && P.diagnosticPlan('tk').every(x => ['count', 'add', 'sub'].includes(x.area)), 'tes awal TK hanya membilang, tambah, kurang');

console.log(`✔ progress.test.js: ${checks} pengecekan lulus`);
