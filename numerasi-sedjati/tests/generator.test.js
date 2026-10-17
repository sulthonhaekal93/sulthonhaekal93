/* Tes mesin soal: jalankan dengan `node tests/generator.test.js` */
'use strict';
const assert = require('assert');
const G = require('../js/generator.js');
const C = require('../js/curriculum.js');

let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };
const MODES = ['tk', 'starter', 'challenge'];
const N = 600;

// 1) Setiap soal di setiap langkah & mode valid
for (const area of C.AREAS) {
  ok(area.steps.length === G.stepCount(area.id), `jumlah langkah ${area.id} sama dengan generator`);
  for (let step = 0; step < area.steps.length; step++) {
    for (const mode of MODES) {
      const ctx = G.makeCtx(mode);
      for (let i = 0; i < N; i++) {
        const q = G.generate(area.id, step, ctx);
        const tag = `${area.id}/${step}/${mode}: ${q.equation || q.prompt} → ${q.answer} [${q.choices.map(c => c.value)}]`;
        ok(G.validate(q).length === 0, 'valid: ' + tag + ' ' + G.validate(q).join(';'));
        const vals = q.choices.map(c => c.value);
        ok(vals.includes(q.answer), 'jawaban ada di pilihan: ' + tag);
        ok(new Set(vals).size === vals.length, 'pilihan tidak kembar: ' + tag);
        ok(q.choices.length <= ctx.choices, 'jumlah pilihan sesuai mode: ' + tag);
        if (mode === 'tk') ok(q.choices.length <= 3, 'TK maksimal 3 pilihan: ' + tag);
        const text = JSON.stringify(q);
        ok(!/NaN|Infinity/.test(text), 'tidak ada NaN/Infinity: ' + tag);
        if (q.numeric) {
          const n = Number(q.answer);
          ok(Number.isInteger(n) && n >= 0, 'jawaban bilangan cacah: ' + tag);
          vals.forEach(v => ok(Number.isInteger(Number(v)) && Number(v) >= 0, 'pilihan bilangan cacah: ' + tag));
        }
        // Hitungan benar untuk operasi dasar
        if (q.calc) {
          const { op, a, b } = q.calc;
          ok(Number.isFinite(a) && Number.isFinite(b), 'operan terhingga: ' + tag);
          if (op === '+') ok(a + b === Number(q.answer), 'penjumlahan benar: ' + tag);
          if (op === '-') { ok(a - b === Number(q.answer), 'pengurangan benar: ' + tag); ok(a - b >= 0, 'tidak negatif: ' + tag); }
          if (op === '*') ok(a * b === Number(q.answer), 'perkalian benar: ' + tag);
          if (op === '/') { ok(b !== 0, 'tidak bagi nol: ' + tag); ok(a % b === 0 && a / b === Number(q.answer), 'pembagian bulat & benar: ' + tag); }
          if (op === '/r') { ok(b !== 0, 'tidak bagi nol: ' + tag); ok(q.answer === `${Math.floor(a / b)} sisa ${a % b}` && a % b > 0, 'pembagian bersisa benar: ' + tag); }
        }
        // Rentang angka sesuai level
        if (area.id === 'add' && q.calc) {
          const s = q.calc.a + q.calc.b;
          if (step === 0) ok(s <= 5, 'tambah ≤ 5: ' + tag);
          if (step === 1) ok(s <= 10, 'tambah ≤ 10: ' + tag);
          if (step === 2) ok(s <= 20 && s > 10, 'tambah 11–20: ' + tag);
          if (step === 3) ok((q.calc.a % 10) + (q.calc.b % 10) < 10 && s < 100, 'tanpa menyimpan: ' + tag);
          if (step === 4) ok((q.calc.a % 10) + (q.calc.b % 10) >= 10, 'dengan menyimpan: ' + tag);
        }
        if (area.id === 'sub' && q.calc) {
          if (step === 0) ok(q.calc.a <= 5, 'kurang ≤ 5: ' + tag);
          if (step === 1) ok(q.calc.a <= 10, 'kurang ≤ 10: ' + tag);
          if (step === 2) ok(q.calc.a <= 20, 'kurang ≤ 20: ' + tag);
          if (step === 3) ok(q.calc.a % 10 >= q.calc.b % 10, 'tanpa meminjam: ' + tag);
          if (step === 4) ok(q.calc.a % 10 < q.calc.b % 10, 'dengan meminjam: ' + tag);
        }
        if (area.id === 'mul' && q.calc) {
          if (step === 0) ok([2, 5].includes(q.calc.b) && q.calc.a <= 5, 'kelompok 2 & 5: ' + tag);
          if (step === 1) ok(q.calc.b === 10, 'kelompok 10: ' + tag);
          if (step === 2) ok(q.calc.a <= 5 && q.calc.b <= 5, 'tabel 1–5: ' + tag);
          if (step === 3) ok(q.calc.a <= 10 && q.calc.b <= 10, 'tabel 1–10: ' + tag);
        }
        if (area.id === 'div' && q.calc && step <= 3) ok(q.calc.op === '/', 'pembagian awal tanpa sisa: ' + tag);
        if (area.id === 'div' && step === 0) ok(Number(q.answer) <= 4 && q.calc.b <= 3, 'berbagi kecil: ' + tag);
        // Benda bisa dihitung (tidak terlalu banyak)
        if (q.visual && q.manip) ok(['count', 'takeaway', 'groups', 'share'].includes(q.manip), 'jenis interaksi dikenal: ' + tag);
        ok(q.area === area.id && q.step === step, 'area & langkah tercatat: ' + tag);
        ok(Array.isArray(q.explain) && q.explain.length > 0 && Array.isArray(q.hint) && q.hint.length > 0, 'ada bantuan & penjelasan: ' + tag);
        ok(q.hint.every(h => !h.includes(`= ${q.answer}.`) || area.id === 'mix' || area.id === 'div'), 'bantuan tidak langsung membocorkan hasil: ' + tag);
      }
    }
  }
}

// 2) Soal tidak berulang dalam satu sesi pendek
for (const [area, step] of [['add', 1], ['sub', 1], ['mul', 2], ['div', 2], ['mix', 2]]) {
  const seen = new Set();
  const ctx = G.makeCtx('starter');
  for (let i = 0; i < 8; i++) {
    const q = G.generate(area, step, ctx, seen);
    ok(!seen.has(q.key), `soal ${area}/${step} tidak berulang dalam sesi (${q.key})`);
    seen.add(q.key);
  }
}

// 3) Posisi jawaban benar teracak (tidak bisa ditebak dari posisi tombol)
const pos = [0, 0, 0, 0];
for (let i = 0; i < 4000; i++) {
  const q = G.generate('add', 1, G.makeCtx('starter'));
  pos[q.choices.findIndex(c => c.value === q.answer)]++;
}
pos.forEach((c, i) => ok(c > 4000 * 0.15 && c < 4000 * 0.35, `posisi ${i} jawaban benar seimbang (${c})`));

// 4) Terbilang
ok(G.terbilang(0) === 'nol' && G.terbilang(11) === 'sebelas' && G.terbilang(14) === 'empat belas' && G.terbilang(20) === 'dua puluh' && G.terbilang(37) === 'tiga puluh tujuh', 'terbilang');

// 5) Area tak dikenal ditolak
assert.throws(() => G.generate('xyz', 0));
checks++;

console.log(`✔ generator.test.js: ${checks} pengecekan lulus`);
