/*
 * MESIN SOAL — Sedjati Numeracy Adventure
 * ---------------------------------------------------------------
 * Semua soal dibuat langsung di perangkat (tanpa AI / internet).
 * GEN[area][langkah](ctx) membuat satu soal. generate() menambahkan
 * pengecekan: jawaban benar selalu ada di pilihan, pilihan tidak
 * kembar, tidak ada NaN/Infinity/negatif, pembagian selalu bulat
 * (kecuali langkah "bersisa"), dan soal tidak berulang dalam satu sesi.
 *
 * Bentuk soal:
 * {
 *   key, area, step, op,          // identitas & operasi untuk statistik
 *   prompt, equation,             // teks soal & kalimat matematika (boleh null)
 *   answer, numeric,              // jawaban (string) & apakah berupa bilangan
 *   choices: [{value, label, visual?}],
 *   visual, manip,                // gambar benda & jenis interaksi benda
 *   hint: [..], explain: [..],    // bantuan (tanpa jawaban) & penjelasan lengkap
 *   correctMsg, calc              // pesan benar & data cek hitungan (untuk tes)
 * }
 * Konvensi Indonesia: 3 × 2 = 2 + 2 + 2 (3 kelompok berisi 2).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SNA = root.SNA || {}; root.SNA.Gen = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Acak ---------- */
  let rng = Math.random;
  const int = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const chance = p => rng() < p;
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- Kata & benda ---------- */
  const SATUAN = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  function terbilang(n) {
    if (!Number.isInteger(n) || n < 0) return String(n);
    if (n < 12) return SATUAN[n];
    if (n < 20) return SATUAN[n - 10] + ' belas';
    if (n < 100) {
      const t = Math.floor(n / 10), o = n % 10;
      return SATUAN[t] + ' puluh' + (o ? ' ' + SATUAN[o] : '');
    }
    if (n === 100) return 'seratus';
    return String(n);
  }

  const OBJ = [
    { e: '🍎', n: 'apel' }, { e: '🥭', n: 'mangga' }, { e: '📘', n: 'buku' },
    { e: '🌼', n: 'bunga' }, { e: '🐔', n: 'ayam' }, { e: '🐟', n: 'ikan' },
    { e: '🧱', n: 'balok mainan' }, { e: '🍌', n: 'pisang' }, { e: '🥚', n: 'telur' },
    { e: '🍪', n: 'kue' }, { e: '🎈', n: 'balon' }, { e: '🍊', n: 'jeruk' }
  ];
  // Benda tema misi (sesuai judul misi), dipakai sebagian besar waktu
  const THEME = { 'add-0': 'apel', 'add-1': 'mangga', 'sub-0': 'mangga', 'sub-1': 'kue', 'mul-0': 'telur', 'count-1': 'mangga' };
  let theme = null;
  const pickObj = () => (theme && chance(0.75) ? OBJ.find(o => o.n === theme) : pick(OBJ));
  const BIG_OBJ = ['kelereng', 'buku', 'telur', 'jeruk', 'pensil', 'kerupuk'];
  const FRUIT = ['apel', 'mangga', 'jeruk', 'pisang'];
  const NAMES = ['Beni', 'Sari', 'Dodi', 'Ayu', 'Rani', 'Bima', 'Putri', 'Udin', 'Lala', 'Tono', 'Wati', 'Raka'];

  const seq = (from, to) => {
    const out = [];
    if (from <= to) for (let i = from; i <= to; i++) out.push(i);
    else for (let i = from; i >= to; i--) out.push(i);
    return out.join(', ');
  };
  const MINUS = '−';

  /* ---------- Pilihan jawaban ---------- */
  // Pilihan bilangan: jawaban + kesalahan umum (extras) + angka di sekitarnya.
  function numericChoices(ans, count, extras, maxVal) {
    const out = [ans];
    const seen = new Set([ans]);
    const add = v => {
      if (out.length >= count) return;
      if (!Number.isInteger(v) || v < 0) return;
      if (maxVal != null && v > maxVal) return;
      if (seen.has(v)) return;
      seen.add(v); out.push(v);
    };
    shuffle(extras || []).forEach(add);
    const near = ans >= 20 ? [1, -1, 10, -10, 2, -2] : [1, -1, 2, -2];
    shuffle(near).forEach(d => add(ans + d));
    [3, -3, 4, -4, 5, -5, 11, -11, 9, -9].forEach(d => add(ans + d));
    let guard = 0;
    while (out.length < count && guard++ < 200) add(int(0, Math.max(ans * 2, 10)));
    return shuffle(out).map(v => ({ value: String(v), label: String(v) }));
  }

  function textChoices(correct, wrongs, count) {
    const out = [correct];
    shuffle(wrongs).forEach(w => {
      if (out.length < count && !out.some(o => o.value === w.value)) out.push(w);
    });
    return shuffle(out);
  }

  /* Rangkai soal standar */
  function mk(o, ctx) {
    const q = Object.assign({
      equation: null, visual: null, manip: null, hint: [], explain: [],
      numeric: true, correctMsg: 'Hebat! Jawabanmu benar.'
    }, o);
    q.answer = String(q.answer);
    if (!q.choices) {
      q.choices = numericChoices(Number(q.answer), ctx.choices, o.extras || [], o.maxChoice);
    }
    delete q.extras; delete q.maxChoice;
    return q;
  }

  /* ================= KEBUN ANGKA ================= */
  function countObjects(min, max, ctx) {
    const n = int(min, max), o = pickObj();
    return mk({
      key: 'count:obj:' + n, op: 'count',
      prompt: pick([`Ada berapa ${o.n}?`, `Hitung ${o.n} ini. Ada berapa?`]),
      visual: { kind: 'objects', n, emoji: o.e, label: o.n },
      manip: 'count', answer: n, maxChoice: 20,
      hint: ['Tunjuk setiap benda satu kali sambil menghitung.', 'Angka terakhir yang kamu sebut adalah banyaknya benda.'],
      explain: [`Kita hitung bersama: ${seq(1, n)}.`, `Jadi ada ${n} ${o.n}.`],
      correctMsg: `Hebat! Ada ${n} ${o.n}.`
    }, ctx);
  }

  function matchQuantity(min, max, ctx) {
    const n = int(min, max), o = pickObj();
    const vals = [n];
    let guard = 0;
    while (vals.length < ctx.choices && guard++ < 100) {
      const v = int(Math.max(1, min - 1), max + 1);
      if (!vals.includes(v)) vals.push(v);
    }
    const choices = shuffle(vals).map(v => ({
      value: String(v), label: `${v} ${o.n}`, visual: { kind: 'objects', n: v, emoji: o.e, mini: true }
    }));
    return mk({
      key: 'count:match:' + n, op: 'count',
      prompt: `Mana kelompok yang berisi ${terbilang(n)} (${n}) ${o.n}?`,
      equation: String(n), answer: n, choices,
      hint: [`Angka ${n} dibaca "${terbilang(n)}".`, 'Hitung isi setiap kelompok, lalu cari yang sama dengan angka itu.'],
      explain: [`Angka ${n} dibaca "${terbilang(n)}".`, `Kelompok yang benar berisi ${n} ${o.n}: ${seq(1, n)}.`],
      correctMsg: `Hebat! Itu ${n} ${o.n}.`
    }, ctx);
  }

  function recognizeNumeral(max, ctx) {
    const n = int(0, max), o = pickObj();
    return mk({
      key: 'count:read:' + n, op: 'count',
      prompt: `Mana angka ${terbilang(n)}?`,
      visual: n > 0 ? { kind: 'objects', n, emoji: o.e, label: o.n } : null,
      answer: n, maxChoice: 20,
      hint: [n > 0 ? `Hitung bendanya: ada sebanyak angka ${terbilang(n)}.` : 'Nol artinya tidak ada benda sama sekali.'],
      explain: [`"${terbilang(n)}" ditulis ${n}.`],
      correctMsg: `Hebat! Itu angka ${n}, dibaca ${terbilang(n)}.`
    }, ctx);
  }

  function compareGroups(ctx) {
    const o = pickObj();
    const same = chance(0.2);
    const a = int(1, 10);
    let b = same ? a : int(1, 10);
    if (!same) while (b === a) b = int(1, 10);
    const askMore = chance(0.5);
    let answer;
    if (a === b) answer = 'S';
    else answer = (askMore ? (a > b) : (a < b)) ? 'A' : 'B';
    const choices = [
      { value: 'A', label: 'Kelompok A' }, { value: 'B', label: 'Kelompok B' }, { value: 'S', label: 'Sama banyak' }
    ];
    const word = askMore ? 'lebih banyak' : 'lebih sedikit';
    const big = Math.max(a, b), small = Math.min(a, b);
    const expl = a === b ? `Kelompok A ada ${a}, kelompok B ada ${b}. Keduanya sama banyak.`
      : `${big} lebih banyak dari ${small}, jadi kelompok ${answer === 'A' ? 'A' : 'B'} ${word}.`;
    return mk({
      key: `count:cmp:${a}:${b}:${askMore}`, op: 'count', numeric: false,
      prompt: `${o.n[0].toUpperCase() + o.n.slice(1)} di kelompok mana yang ${word}?`,
      visual: { kind: 'compare', a, b, emoji: o.e },
      answer, choices,
      hint: ['Hitung kelompok A, lalu hitung kelompok B.', 'Bandingkan kedua angkanya.'],
      explain: [`Kelompok A ada ${a}. Kelompok B ada ${b}.`, expl],
      correctMsg: a === b ? `Hebat! Keduanya sama, masing-masing ${a}.` : `Hebat! Kelompok ${answer} ${word}.`
    }, ctx);
  }

  function compareNumbers(ctx) {
    const a = int(0, 20);
    let b = int(0, 20);
    while (b === a) b = int(0, 20);
    const askBig = chance(0.5);
    const ans = askBig ? Math.max(a, b) : Math.min(a, b);
    const other = ans === a ? b : a;
    return mk({
      key: `count:cmpn:${Math.min(a, b)}:${Math.max(a, b)}:${askBig}`, op: 'count',
      prompt: `Mana yang lebih ${askBig ? 'besar' : 'kecil'}: ${a} atau ${b}?`,
      visual: { kind: 'numberline', min: 0, max: 20, marks: [a, b] },
      answer: ans,
      choices: shuffle([{ value: String(a), label: String(a) }, { value: String(b), label: String(b) }]),
      hint: ['Lihat garis bilangan. Angka di sebelah kanan lebih besar.'],
      explain: [`Di garis bilangan, ${Math.max(a, b)} ada di sebelah kanan ${Math.min(a, b)}.`, `Jadi ${ans} lebih ${askBig ? 'besar' : 'kecil'} dari ${other}.`],
      correctMsg: `Hebat! ${ans} lebih ${askBig ? 'besar' : 'kecil'} dari ${other}.`
    }, ctx);
  }

  function numberNeighbor(ctx) {
    const n = int(5, 19);
    const after = chance(0.6);
    const ans = after ? n + 1 : n - 1;
    return mk({
      key: `count:nb:${n}:${after}`, op: 'count',
      prompt: after ? `Angka berapa yang datang sesudah ${n}?` : `Angka berapa yang datang sebelum ${n}?`,
      equation: after ? `${n}, ?` : `?, ${n}`,
      visual: { kind: 'numberline', min: 0, max: 20, marks: [n] },
      answer: ans, maxChoice: 21,
      hint: [after ? 'Sesudah berarti satu langkah ke kanan di garis bilangan.' : 'Sebelum berarti satu langkah ke kiri di garis bilangan.'],
      explain: [after ? `Sesudah ${n} adalah ${n} + 1.` : `Sebelum ${n} adalah ${n} ${MINUS} 1.`, `Jawabannya ${ans}.`],
      correctMsg: `Hebat! ${after ? 'Sesudah' : 'Sebelum'} ${n} adalah ${ans}.`
    }, ctx);
  }

  /* ================= PENJUMLAHAN ================= */
  function addStory(a, b, objName, name) {
    return pick([
      `${name} memiliki ${a} ${objName}. Ia menemukan ${b} ${objName} lagi. Berapa jumlah ${objName} ${name} sekarang?`,
      `Di keranjang ada ${a} ${objName}. Ibu menambahkan ${b} ${objName}. Berapa ${objName} di keranjang sekarang?`,
      `${name} punya ${a} ${objName}, lalu diberi ${b} ${objName} oleh temannya. Berapa ${objName} ${name} sekarang?`
    ]);
  }

  function addQ(a, b, step, ctx) {
    const s = a + b;
    const big = step >= 3;
    const o = big ? { e: null, n: pick(BIG_OBJ) } : pickObj();
    const name = pick(NAMES);
    let visual = null, manip = null, hint, explain;
    if (step <= 2) {
      const useLine = step === 2 ? chance(0.5) : (step === 1 && chance(0.3));
      if (useLine) {
        visual = { kind: 'numberline', min: 0, max: step === 2 ? 20 : 10, start: a, jump: b };
        hint = [`Mulai dari ${a} di garis bilangan.`, `Lompat ke kanan ${b} kali.`];
        explain = [`Mulai dari ${a}, lompat ${b} kali ke kanan: ${seq(a + 1, s)}.`, `Jadi ${a} + ${b} = ${s}.`];
      } else {
        visual = { kind: 'join', a, b, emoji: o.e, label: o.n };
        manip = 'count';
        hint = [`Ada ${a} ${o.n} dan ${b} ${o.n}.`, 'Gabungkan, lalu hitung semuanya satu per satu.'];
        explain = [`${a} ${o.n} ditambah ${b} ${o.n}.`, `Kita hitung semuanya: ${seq(1, s)}.`, `Jadi ${a} + ${b} = ${s}.`];
      }
    } else {
      visual = { kind: 'place', a, b, op: '+' };
      const ao = a % 10, bo = b % 10, at = a - ao, bt = b - bo;
      if (ao + bo >= 10) {
        hint = [`Jumlahkan satuan dulu: ${ao} + ${bo}.`, 'Jika 10 atau lebih, tukar 10 satuan menjadi 1 puluhan.'];
        explain = [
          `Satuan: ${ao} + ${bo} = ${ao + bo}. Tulis ${(ao + bo) % 10}, simpan 1 puluhan.`,
          `Puluhan: ${at} + ${bt} + 10 = ${at + bt + 10}.`,
          `Jadi ${a} + ${b} = ${s}.`
        ];
      } else {
        hint = [`Jumlahkan satuan: ${ao} + ${bo}.`, `Lalu jumlahkan puluhan: ${at} + ${bt}.`];
        explain = [`Satuan: ${ao} + ${bo} = ${ao + bo}.`, `Puluhan: ${at} + ${bt} = ${at + bt}.`, `Jadi ${a} + ${b} = ${s}.`];
      }
    }
    const extras = [s - 1, s + 1];
    if (step === 4) extras.push(s - 10, s + 10);
    if (step >= 3) extras.push(Math.abs(a - b));
    return mk({
      key: `add:${a}+${b}`, op: 'add',
      prompt: (ctx.mode === 'challenge' && step >= 3 && chance(0.4)) ? `Berapa hasil ${a} + ${b}?` : addStory(a, b, o.n, name),
      equation: `${a} + ${b} = ?`,
      visual, manip, answer: s, extras, hint, explain,
      correctMsg: `Hebat! ${a} + ${b} = ${s}.` + (big ? '' : ` Sekarang ada ${s} ${o.n}!`),
      calc: { op: '+', a, b }
    }, ctx);
  }

  const ADD = [
    ctx => { const a = int(1, 4); const b = int(1, 5 - a); return addQ(a, b, 0, ctx); },
    ctx => { const a = int(1, 9); const b = int(1, 10 - a); return addQ(a, b, 1, ctx); },
    ctx => { const s = int(11, 20); const a = int(Math.max(2, s - 10), Math.min(15, s - 1)); return addQ(a, s - a, 2, ctx); },
    ctx => {
      const at = int(1, 7), bt = int(1, 8 - at), ao = int(0, 8), bo = int(0, 9 - ao);
      return addQ(at * 10 + ao, bt * 10 + bo, 3, ctx);
    },
    ctx => {
      // satuan berjumlah ≥ 10 (menyimpan); hasil ≤ 99 (SD Challenge boleh sampai 198)
      const ao = int(2, 9), bo = int(Math.max(1, 10 - ao), 9);
      const maxT = ctx.mode === 'challenge' ? 9 : 8;
      const at = int(1, maxT - 1);
      const bt = ctx.mode === 'challenge' ? int(1, 9) : int(1, Math.max(1, 8 - at));
      return addQ(at * 10 + ao, bt * 10 + bo, 4, ctx);
    }
  ];

  /* ================= PENGURANGAN ================= */
  function subQ(a, b, step, ctx) {
    const d = a - b;
    const big = step >= 3;
    const o = big ? { e: null, n: pick(BIG_OBJ) } : pickObj();
    const name = pick(NAMES);
    const diffMode = step === 2 && chance(0.25);
    let visual = null, manip = null, hint, explain, prompt;
    if (diffMode) {
      const name2 = pick(NAMES.filter(x => x !== name));
      prompt = `${name} punya ${a} ${o.n}. ${name2} punya ${b} ${o.n}. Berapa selisih ${o.n} mereka?`;
      visual = { kind: 'numberline', min: 0, max: 20, start: a, jump: -b };
      hint = ['Selisih artinya berapa lebih banyak.', `Mulai dari ${a}, lompat ke kiri ${b} kali.`];
      explain = [`Selisih dicari dengan pengurangan: ${a} ${MINUS} ${b}.`, `Dari ${a} mundur ${b} kali: ${seq(a - 1, d)}.`, `Jadi selisihnya ${d}.`];
    } else {
      const tpl = [
        `${name} punya ${a} ${o.n}. Sebanyak ${b} ${o.n} diberikan kepada temannya. Berapa ${o.n} yang tersisa?`,
        `Ada ${a} ${o.n} di meja. ${name} mengambil ${b} ${o.n}. Berapa ${o.n} yang masih ada?`
      ];
      if (FRUIT.includes(o.n)) tpl.push(`Di pohon ada ${a} ${o.n}. Sebanyak ${b} ${o.n} dipetik. Berapa ${o.n} yang masih di pohon?`);
      prompt = pick(tpl);
      if (step <= 2) {
        const useLine = step === 2 ? chance(0.4) : (step === 1 && chance(0.25));
        if (useLine) {
          visual = { kind: 'numberline', min: 0, max: step === 2 ? 20 : 10, start: a, jump: -b };
          hint = [`Mulai dari ${a} di garis bilangan.`, `Lompat ke kiri ${b} kali.`];
          explain = [`Mulai dari ${a}, lompat ${b} kali ke kiri: ${seq(a - 1, d)}.`, `Jadi ${a} ${MINUS} ${b} = ${d}.`];
        } else {
          visual = { kind: 'takeaway', total: a, remove: b, emoji: o.e, label: o.n };
          manip = 'takeaway';
          hint = [`Ada ${a} ${o.n}. Ambil ${b} ${o.n}.`, 'Hitung yang masih tersisa.'];
          explain = [`Mula-mula ada ${a} ${o.n}.`, `${b} ${o.n} diambil. Sisanya kita hitung: ${d > 0 ? seq(1, d) : 'tidak ada'}.`, `Jadi ${a} ${MINUS} ${b} = ${d}.`];
        }
      } else {
        visual = { kind: 'place', a, b, op: '-' };
        const ao = a % 10, bo = b % 10, at = a - ao, bt = b - bo;
        if (ao < bo) {
          hint = [`Satuan atas (${ao}) lebih kecil dari ${bo}.`, 'Pinjam 1 puluhan, ubah menjadi 10 satuan.'];
          explain = [
            `Pinjam 1 puluhan: satuan menjadi ${ao + 10}. ${ao + 10} ${MINUS} ${bo} = ${ao + 10 - bo}.`,
            `Puluhan: ${at - 10} ${MINUS} ${bt} = ${at - 10 - bt}.`,
            `Jadi ${a} ${MINUS} ${b} = ${d}.`
          ];
        } else {
          hint = [`Kurangi satuan: ${ao} ${MINUS} ${bo}.`, `Lalu kurangi puluhan: ${at} ${MINUS} ${bt}.`];
          explain = [`Satuan: ${ao} ${MINUS} ${bo} = ${ao - bo}.`, `Puluhan: ${at} ${MINUS} ${bt} = ${at - bt}.`, `Jadi ${a} ${MINUS} ${b} = ${d}.`];
        }
      }
    }
    const extras = [d + 1, d - 1, a + b];
    if (step === 4) {
      const ao = a % 10, bo = b % 10;
      extras.push(Math.floor(a / 10) * 10 - Math.floor(b / 10) * 10 + Math.abs(ao - bo), d + 10);
    }
    return mk({
      key: `sub:${a}-${b}`, op: 'sub',
      prompt: (ctx.mode === 'challenge' && step >= 3 && chance(0.4)) ? `Berapa hasil ${a} ${MINUS} ${b}?` : prompt,
      equation: `${a} ${MINUS} ${b} = ?`,
      visual, manip, answer: d, extras, hint, explain,
      correctMsg: diffMode ? `Hebat! Selisihnya ${d}.` : `Hebat! ${a} ${MINUS} ${b} = ${d}.` + (big ? '' : ` Tersisa ${d} ${o.n}.`),
      calc: { op: '-', a, b }
    }, ctx);
  }

  const SUB = [
    ctx => { const a = int(2, 5); return subQ(a, int(1, a - 1), 0, ctx); },
    ctx => { const a = int(3, 10); return subQ(a, int(1, a - 1), 1, ctx); },
    ctx => { const a = int(11, 20); return subQ(a, int(2, Math.min(12, a - 1)), 2, ctx); },
    ctx => {
      const at = int(2, 9), bt = int(1, at - 1), ao = int(1, 9), bo = int(0, ao);
      return subQ(at * 10 + ao, bt * 10 + bo, 3, ctx);
    },
    ctx => {
      const at = int(3, 9), bt = int(1, at - 1), ao = int(0, 8), bo = int(ao + 1, 9);
      return subQ(at * 10 + ao, bt * 10 + bo, 4, ctx);
    }
  ];

  /* ================= PERKALIAN ================= */
  function mulExplainRepeated(g, each) {
    const parts = Array(g).fill(each).join(' + ');
    return `${parts} = ${g * each}`;
  }

  function mulQ(g, each, step, ctx) {
    const p = g * each;
    const name = pick(NAMES);
    let visual = null, manip = null, prompt, hint, explain;
    const extras = [g + each, p + each, p - each, p + 1, p - 1];
    if (step === 0) {
      const o = pickObj();
      visual = { kind: 'groups', groups: g, each, emoji: o.e, label: o.n };
      manip = 'groups';
      prompt = pick([
        `Ada ${g} piring. Setiap piring berisi ${each} ${o.n}. Berapa semua ${o.n}?`,
        `${name} membuat ${g} kelompok ${o.n}. Setiap kelompok ada ${each}. Berapa ${o.n} semuanya?`
      ]);
      hint = [`Ada ${g} kelompok, setiap kelompok berisi ${each}.`, `Tambahkan ${each} sebanyak ${g} kali.`];
      explain = [`Ada ${g} kelompok, setiap kelompok berisi ${each}.`, mulExplainRepeated(g, each), `Jadi ${g} × ${each} = ${p}.`];
    } else if (step === 1) {
      visual = { kind: 'tens', groups: g };
      prompt = pick([
        `Setiap ikat berisi 10 lidi. Ada ${g} ikat. Berapa jumlah lidi semuanya?`,
        `${name} membeli ${g} kotak pensil. Setiap kotak berisi 10 pensil. Berapa pensil semuanya?`
      ]);
      hint = ['Hitung loncat sepuluh-sepuluh.'];
      explain = [`Hitung loncat sepuluh: ${Array.from({ length: g }, (_, i) => (i + 1) * 10).join(', ')}.`, `Jadi ${g} × 10 = ${p}.`];
    } else if (step === 2 || step === 3) {
      const showArray = p <= 30;
      if (showArray) {
        visual = { kind: 'array', rows: g, cols: each, emoji: pick(['🪑', '🌷', '🍓', '🧁', '🥚']) };
        manip = 'groups';
      }
      prompt = pick([
        `Kursi disusun ${g} baris. Setiap baris ada ${each} kursi. Berapa kursi semuanya?`,
        `Berapa hasil ${g} × ${each}?`,
        `${name} membeli ${g} bungkus kue. Setiap bungkus berisi ${each} kue. Berapa kue semuanya?`
      ]);
      hint = [`${g} × ${each} artinya ${each} ditambah sebanyak ${g} kali.`, `Hitung loncat ${each}.`];
      explain = [
        g <= 6 ? mulExplainRepeated(g, each) : `Hitung loncat ${each}: ${Array.from({ length: g }, (_, i) => (i + 1) * each).join(', ')}.`,
        `Jadi ${g} × ${each} = ${p}.`
      ];
    } else {
      // dua angka × satu angka, dipecah per nilai tempat
      const t = Math.floor(g / 10) * 10, o = g % 10;
      prompt = pick([
        `Setiap peti berisi ${each} karung beras. Ada ${g} peti. Berapa karung semuanya?`,
        `Berapa hasil ${g} × ${each}?`
      ]);
      // catatan: pada soal ini g adalah bilangan dua angka (banyak kelompok)
      hint = [`Pecah ${g} menjadi ${t} dan ${o}.`, `Hitung ${t} × ${each} dan ${o} × ${each}, lalu jumlahkan.`];
      explain = [`${t} × ${each} = ${t * each}.`, `${o} × ${each} = ${o * each}.`, `${t * each} + ${o * each} = ${p}. Jadi ${g} × ${each} = ${p}.`];
      extras.push(t * each + o, p + 10, p - 10);
    }
    return mk({
      key: `mul:${g}x${each}`, op: 'mul', prompt,
      equation: `${g} × ${each} = ?`,
      visual, manip, answer: p, extras, hint, explain,
      correctMsg: `Hebat! ${g} × ${each} = ${p}.`,
      calc: { op: '*', a: g, b: each }
    }, ctx);
  }

  const MUL = [
    ctx => mulQ(int(1, 5), pick([2, 5]), 0, ctx),
    ctx => mulQ(int(1, 9), 10, 1, ctx),
    ctx => { let a = int(1, 5), b = int(1, 5); if (a === 1 && b === 1) b = int(2, 5); return mulQ(a, b, 2, ctx); },
    ctx => mulQ(int(2, 10), int(2, 10), 3, ctx),
    ctx => mulQ(int(12, ctx.mode === 'challenge' ? 99 : 49), int(2, 9), 4, ctx)
  ];

  /* ================= PEMBAGIAN ================= */
  function divQ(d, q, step, ctx, style) {
    const total = d * q;
    const name = pick(NAMES);
    let visual = null, manip = null, prompt, hint, explain, correctMsg;
    const extras = [q + 1, q - 1, total - d, d];
    if (style === 'share') {
      const o = pick([{ e: '🍬', n: 'permen' }, { e: '🍪', n: 'kue' }, { e: '🍊', n: 'jeruk' }, { e: '🍎', n: 'apel' }]);
      prompt = `Ada ${total} ${o.n}. ${name} membaginya sama rata kepada ${d} anak. Berapa ${o.n} yang didapat setiap anak?`;
      if (total <= 20) { visual = { kind: 'share', total, groups: d, emoji: o.e, label: o.n }; manip = 'share'; }
      hint = [`Bagikan ${o.n} satu per satu bergiliran ke ${d} anak.`, 'Hitung isi satu piring.'];
      explain = [`Bagikan ${total} ${o.n} satu per satu ke ${d} anak sampai habis.`, `Setiap anak mendapat ${q} ${o.n}. Cek: ${d} × ${q} = ${total}.`, `Jadi ${total} ÷ ${d} = ${q}.`];
      correctMsg = `Hebat! ${total} ÷ ${d} = ${q}. Setiap anak mendapat ${q} ${o.n}!`;
    } else if (style === 'group') {
      prompt = `Ada ${total} telur. Setiap keranjang diisi ${d} telur. Berapa keranjang yang dibutuhkan?`;
      if (total <= 20) visual = { kind: 'objects', n: total, emoji: '🥚', label: 'telur', groupBy: d };
      hint = [`Buat kelompok isi ${d}.`, 'Hitung ada berapa kelompok.'];
      explain = [`Kelompokkan ${total} telur, setiap keranjang ${d} telur.`, `Ada ${q} keranjang. Cek: ${q} × ${d} = ${total}.`, `Jadi ${total} ÷ ${d} = ${q}.`];
      correctMsg = `Hebat! ${total} ÷ ${d} = ${q}. Butuh ${q} keranjang.`;
    } else if (step <= 2) {
      prompt = pick([
        `Berapa hasil ${total} ÷ ${d}?`,
        `Pedagang punya ${total} jeruk. Jeruk itu dimasukkan ke ${d} kantong sama banyak. Berapa jeruk di setiap kantong?`
      ]);
      if (total <= 30 && d <= 6) visual = { kind: 'array', rows: d, cols: q, emoji: '🍊' };
      hint = [`Cari bilangan yang jika dikali ${d} hasilnya ${total}.`, `${d} × ? = ${total}`];
      explain = [`Ingat perkalian: ${d} × ${q} = ${total}.`, `Jadi ${total} ÷ ${d} = ${q}.`];
      correctMsg = `Hebat! ${total} ÷ ${d} = ${q}, karena ${d} × ${q} = ${total}.`;
    } else {
      const tq = Math.floor(q / 10) * 10, oq = q - tq;
      prompt = pick([
        `Pedagang grosir punya ${total} bungkus mi. Mi dibagi sama rata ke ${d} warung. Berapa bungkus untuk setiap warung?`,
        `Berapa hasil ${total} ÷ ${d}?`
      ]);
      hint = [`Mulai dari ${d} × ${tq} = ${d * tq}.`, `Sisanya ${total - d * tq}, bagi lagi dengan ${d}.`];
      explain = [`${d} × ${tq} = ${d * tq}. Sisa ${total} ${MINUS} ${d * tq} = ${total - d * tq}.`, `${total - d * tq} ÷ ${d} = ${oq}.`, `${tq} + ${oq} = ${q}. Jadi ${total} ÷ ${d} = ${q}.`];
      correctMsg = `Hebat! ${total} ÷ ${d} = ${q}.`;
      extras.push(q + 10, q - 10);
    }
    return mk({
      key: `div:${total}/${d}`, op: 'div', prompt,
      equation: `${total} ÷ ${d} = ?`,
      visual, manip, answer: q, extras, hint, explain, correctMsg,
      calc: { op: '/', a: total, b: d }
    }, ctx);
  }

  function divRemainderQ(ctx) {
    const d = int(2, 9), q = int(1, 10), r = int(1, d - 1);
    const total = d * q + r;
    const lab = (a, b) => `${a} sisa ${b}`;
    const correct = { value: lab(q, r), label: lab(q, r) };
    const wrongs = [
      { value: lab(q + 1, r), label: lab(q + 1, r) },
      { value: lab(q, r + 1), label: lab(q, r + 1) },
      { value: lab(q - 1 >= 0 ? q - 1 : q + 2, r + d), label: lab(q - 1 >= 0 ? q - 1 : q + 2, r + d) },
      { value: lab(q + 1, Math.max(0, r - 1)), label: lab(q + 1, Math.max(0, r - 1)) }
    ].filter(w => w.value !== correct.value);
    return mk({
      key: `div:${total}/${d}r`, op: 'div', numeric: false,
      prompt: `Ada ${total} kue dibagi ke ${d} piring sama banyak. Berapa kue di setiap piring, dan berapa sisanya?`,
      equation: `${total} ÷ ${d} = ?`,
      answer: correct.value, choices: textChoices(correct, wrongs, ctx.choices),
      hint: [`Cari perkalian ${d} yang paling dekat dengan ${total}, tetapi tidak lebih.`, 'Sisa harus lebih kecil dari pembaginya.'],
      explain: [`${d} × ${q} = ${d * q}. ${total} ${MINUS} ${d * q} = ${r}.`, `Sisa ${r} lebih kecil dari ${d}, jadi sudah benar.`, `Jadi ${total} ÷ ${d} = ${q} sisa ${r}.`],
      correctMsg: `Hebat! ${total} ÷ ${d} = ${q} sisa ${r}.`,
      calc: { op: '/r', a: total, b: d }
    }, ctx);
  }

  const DIV = [
    ctx => divQ(int(2, 3), int(1, 4), 0, ctx, 'share'),
    ctx => divQ(int(2, 5), int(1, 5), 1, ctx, chance(0.55) ? 'share' : 'group'),
    ctx => divQ(int(2, 10), int(2, 10), 2, ctx),
    ctx => divQ(int(2, 9), int(11, ctx.mode === 'challenge' ? 40 : 25), 3, ctx),
    ctx => divRemainderQ(ctx)
  ];

  /* ================= PULAU TANTANGAN ================= */
  const OPSYM = ['+', MINUS, '×', '÷'];
  function applyOp(a, sym, b) {
    if (sym === '+') return a + b;
    if (sym === MINUS) return a >= b ? a - b : null;
    if (sym === '×') return a * b;
    if (sym === '÷') return (b !== 0 && a % b === 0) ? a / b : null;
    return null;
  }

  function chooseOpQ(ctx) {
    for (let tries = 0; tries < 50; tries++) {
      const sym = pick(OPSYM);
      let a, b;
      if (sym === '+') { a = int(1, 9); b = int(1, 9); }
      else if (sym === MINUS) { a = int(5, 15); b = int(1, a - 1); }
      else if (sym === '×') { a = int(2, 5); b = int(2, 5); }
      else { b = int(2, 5); a = b * int(2, 5); }
      const c = applyOp(a, sym, b);
      const matches = OPSYM.filter(s => applyOp(a, s, b) === c);
      if (matches.length !== 1) continue; // misal 2 + 2 = 2 × 2 — ambigu, ulangi
      const lines = OPSYM.map(s => {
        const v = applyOp(a, s, b);
        return `${a} ${s} ${b} = ${v === null ? 'tidak bisa' : v}`;
      });
      const correct = { value: sym, label: sym };
      const wrongs = OPSYM.filter(s => s !== sym).map(s => ({ value: s, label: s }));
      return mk({
        key: `mix:op:${a}${sym}${b}`, op: 'mix', numeric: false,
        prompt: 'Tanda apa yang tepat untuk mengisi kotak?',
        equation: `${a} ☐ ${b} = ${c}`,
        answer: sym, choices: textChoices(correct, wrongs, ctx.choices),
        hint: ['Coba setiap tanda satu per satu.', `Mana yang hasilnya ${c}?`],
        explain: [lines.join(' · '), `Yang hasilnya ${c} adalah tanda ${sym}.`],
        correctMsg: `Hebat! ${a} ${sym} ${b} = ${c}.`
      }, ctx);
    }
    return ADD[1](ctx);
  }

  function mixedFactQ(ctx) {
    const g = pick([() => ADD[2](ctx), () => SUB[2](ctx), () => MUL[2](ctx), () => DIV[1](ctx), () => MUL[3](ctx)]);
    return g();
  }

  function patternQ(ctx) {
    let terms, rule, ruleText;
    if (ctx.mode === 'challenge' && chance(0.25)) {
      const s = int(1, 3), f = pick([2, 3]);
      terms = [s, s * f, s * f * f, s * f * f * f, s * f * f * f * f];
      rule = `dikali ${f}`; ruleText = `Setiap langkah dikali ${f}.`;
    } else {
      const d = pick([2, 3, 4, 5, 10, -2, -3, -5]);
      const s = d > 0 ? int(0, 20) : int(Math.abs(d) * 4, Math.abs(d) * 4 + 20);
      terms = [0, 1, 2, 3, 4].map(i => s + i * d);
      rule = d > 0 ? `bertambah ${d}` : `berkurang ${-d}`;
      ruleText = `Setiap langkah ${rule}.`;
    }
    const blank = int(1, 4);
    const ans = terms[blank];
    const shown = terms.map((t, i) => i === blank ? '?' : String(t)).join(', ');
    const prev = terms[blank - 1];
    return mk({
      key: `mix:pat:${terms.join(',')}:${blank}`, op: 'mix',
      prompt: 'Lengkapi pola bilangan ini!',
      equation: shown,
      answer: ans, extras: [ans + 1, ans - 1, prev],
      hint: ['Lihat dua bilangan yang berurutan.', 'Apa yang berubah dari satu bilangan ke bilangan berikutnya?'],
      explain: [ruleText, `Sesudah ${prev}, ${rule} menjadi ${ans}.`],
      correctMsg: `Hebat! Polanya ${rule}, jadi jawabannya ${ans}.`
    }, ctx);
  }

  function wordProblemQ(ctx) {
    const name = pick(NAMES);
    const t = int(0, 3);
    if (t === 0) {
      const a = int(2, 5), b = int(2, 6), c = int(1, a * b - 1), ans = a * b - c;
      return mk({
        key: `mix:wp0:${a}:${b}:${c}`, op: 'mix',
        prompt: `${name} membeli ${a} bungkus permen. Setiap bungkus berisi ${b} permen. Ia memberikan ${c} permen kepada adiknya. Berapa permen ${name} sekarang?`,
        answer: ans, extras: [a * b + c, a * b, a + b - c >= 0 ? a + b - c : ans + 2],
        hint: ['Langkah 1: hitung semua permen dulu (perkalian).', 'Langkah 2: kurangi permen yang diberikan.'],
        explain: [`Langkah 1: ${a} × ${b} = ${a * b} permen.`, `Langkah 2: ${a * b} ${MINUS} ${c} = ${ans}.`, `Jadi permen ${name} sekarang ${ans}.`],
        correctMsg: `Hebat! ${a} × ${b} ${MINUS} ${c} = ${ans} permen.`
      }, ctx);
    }
    if (t === 1) {
      for (let k = 0; k < 30; k++) {
        const a = int(2, 6), b = int(2, 6), total = a * b;
        const divs = [2, 3, 4, 5, 6].filter(x => total % x === 0 && x !== total);
        if (!divs.length) continue;
        const c = pick(divs), ans = total / c;
        return mk({
          key: `mix:wp1:${a}:${b}:${c}`, op: 'mix',
          prompt: `Di kebun ada ${a} pohon mangga. Setiap pohon berbuah ${b} mangga. Semua mangga dipetik lalu dibagi sama rata ke ${c} keranjang. Berapa mangga di setiap keranjang?`,
          answer: ans, extras: [total, ans + 1, ans - 1],
          hint: ['Langkah 1: hitung semua mangga (perkalian).', 'Langkah 2: bagi sama rata ke keranjang (pembagian).'],
          explain: [`Langkah 1: ${a} × ${b} = ${total} mangga.`, `Langkah 2: ${total} ÷ ${c} = ${ans}.`, `Jadi setiap keranjang berisi ${ans} mangga.`],
          correctMsg: `Hebat! ${total} ÷ ${c} = ${ans} mangga per keranjang.`
        }, ctx);
      }
    }
    if (t === 2) {
      const a = int(5, 30), b = int(2, 15), c = int(1, a + b - 1), ans = a + b - c;
      return mk({
        key: `mix:wp2:${a}:${b}:${c}`, op: 'mix',
        prompt: `${name} punya ${a} kelereng. Ia mendapat ${b} kelereng dari kakaknya, lalu ${c} kelereng hilang saat bermain. Berapa kelereng ${name} sekarang?`,
        answer: ans, extras: [a + b + c, a + b, ans + 1],
        hint: ['Langkah 1: kelereng bertambah (penjumlahan).', 'Langkah 2: kelereng hilang (pengurangan).'],
        explain: [`Langkah 1: ${a} + ${b} = ${a + b}.`, `Langkah 2: ${a + b} ${MINUS} ${c} = ${ans}.`, `Jadi kelereng ${name} sekarang ${ans}.`],
        correctMsg: `Hebat! ${a} + ${b} ${MINUS} ${c} = ${ans} kelereng.`
      }, ctx);
    }
    const p = int(2, 5), n = int(2, 4);
    const cost = p * n;
    const m = [10, 20, 50].find(x => x > cost);
    const ans = m - cost;
    return mk({
      key: `mix:wp3:${p}:${n}:${m}`, op: 'mix',
      prompt: `Harga 1 buku tulis ${p} ribu rupiah. ${name} membeli ${n} buku dan membayar dengan uang ${m} ribu rupiah. Berapa ribu rupiah kembaliannya?`,
      answer: ans, extras: [cost, m + cost, ans + 1],
      hint: ['Langkah 1: hitung harga semua buku.', 'Langkah 2: uang yang dibayar dikurangi harga buku.'],
      explain: [`Langkah 1: ${n} × ${p} = ${cost} ribu rupiah.`, `Langkah 2: ${m} ${MINUS} ${cost} = ${ans}.`, `Jadi kembaliannya ${ans} ribu rupiah.`],
      correctMsg: `Hebat! Kembaliannya ${ans} ribu rupiah.`
    }, ctx);
  }

  function orderOpsQ(ctx) {
    const t = int(0, 3);
    let expr, ans, hint, explain, extras;
    if (t === 0) {
      const a = int(2, 20), b = int(2, 9), c = int(2, 9);
      expr = `${a} + ${b} × ${c}`; ans = a + b * c;
      extras = [(a + b) * c];
      hint = ['Kerjakan perkalian lebih dulu.'];
      explain = [`Perkalian dulu: ${b} × ${c} = ${b * c}.`, `Lalu ${a} + ${b * c} = ${ans}.`];
    } else if (t === 1) {
      const a = int(2, 9), b = int(2, 9), c = int(1, a * b - 1);
      expr = `${a} × ${b} ${MINUS} ${c}`; ans = a * b - c;
      extras = [a * (b - c) >= 0 ? a * (b - c) : ans + 3];
      hint = ['Kerjakan perkalian lebih dulu.'];
      explain = [`Perkalian dulu: ${a} × ${b} = ${a * b}.`, `Lalu ${a * b} ${MINUS} ${c} = ${ans}.`];
    } else if (t === 2) {
      const a = int(2, 9), b = int(2, 9), c = int(2, 6);
      expr = `(${a} + ${b}) × ${c}`; ans = (a + b) * c;
      extras = [a + b * c];
      hint = ['Kerjakan yang di dalam kurung lebih dulu.'];
      explain = [`Kurung dulu: ${a} + ${b} = ${a + b}.`, `Lalu ${a + b} × ${c} = ${ans}.`];
    } else {
      const c = int(2, 6), q = int(2, 9), b = c * q, a = int(q, q + 30);
      expr = `${a} ${MINUS} ${b} ÷ ${c}`; ans = a - q;
      extras = [(a - b) >= 0 && (a - b) % c === 0 ? (a - b) / c : ans + 2];
      hint = ['Kerjakan pembagian lebih dulu.'];
      explain = [`Pembagian dulu: ${b} ÷ ${c} = ${q}.`, `Lalu ${a} ${MINUS} ${q} = ${ans}.`];
    }
    extras.push(ans + 1, ans - 1);
    return mk({
      key: `mix:ord:${expr}`, op: 'mix',
      prompt: 'Hitung dengan urutan yang benar!',
      equation: `${expr} = ?`,
      answer: ans, extras,
      hint: hint.concat(['Urutan: kurung → × dan ÷ → + dan −.']),
      explain: explain.concat([`Jadi ${expr} = ${ans}.`]),
      correctMsg: `Hebat! ${expr} = ${ans}.`
    }, ctx);
  }

  const COUNT = [
    ctx => pick([countObjects, matchQuantity])(1, 5, ctx),
    ctx => {
      const r = rng();
      if (r < 0.45) return countObjects(3, 10, ctx);
      if (r < 0.75) return matchQuantity(2, 9, ctx);
      return recognizeNumeral(10, ctx);
    },
    ctx => chance(0.6) ? compareGroups(ctx) : compareNumbers(ctx),
    ctx => chance(0.6) ? countObjects(11, 20, ctx) : numberNeighbor(ctx)
  ];

  const MIX = [chooseOpQ, mixedFactQ, patternQ, wordProblemQ, orderOpsQ];

  const GEN = { count: COUNT, add: ADD, sub: SUB, mul: MUL, div: DIV, mix: MIX };

  /* ---------- Validasi ---------- */
  function validate(q) {
    const errs = [];
    if (!q || typeof q !== 'object') return ['bukan objek'];
    if (typeof q.prompt !== 'string' || !q.prompt.trim()) errs.push('prompt kosong');
    if (typeof q.answer !== 'string' || !q.answer) errs.push('jawaban kosong');
    const text = [q.prompt, q.equation, q.correctMsg].concat(q.hint || [], q.explain || []).join(' ');
    if (/NaN|Infinity|undefined|null/.test(text)) errs.push('teks tidak valid: ' + text);
    if (q.numeric) {
      const n = Number(q.answer);
      if (!Number.isInteger(n) || n < 0) errs.push('jawaban bukan bilangan cacah: ' + q.answer);
    }
    if (!Array.isArray(q.choices) || q.choices.length < 2) errs.push('pilihan kurang');
    else {
      const vals = q.choices.map(c => c.value);
      if (new Set(vals).size !== vals.length) errs.push('pilihan kembar');
      if (vals.filter(v => v === q.answer).length !== 1) errs.push('jawaban tidak ada di pilihan');
      if (q.numeric && vals.some(v => !/^\d+$/.test(v))) errs.push('pilihan bukan bilangan cacah');
    }
    if (q.calc) {
      const { op, a, b } = q.calc;
      let v = null;
      if (op === '+') v = a + b;
      if (op === '-') v = a - b;
      if (op === '*') v = a * b;
      if (op === '/') { if (b === 0 || a % b !== 0) errs.push('pembagian tidak bulat'); else v = a / b; }
      if (op === '/r') { if (b === 0) errs.push('bagi nol'); else v = `${Math.floor(a / b)} sisa ${a % b}`; }
      if (v !== null && String(v) !== q.answer) errs.push(`hitungan salah ${a}${op}${b}=${q.answer}`);
    }
    const vis = q.visual;
    if (vis) {
      const nums = ['n', 'a', 'b', 'total', 'remove', 'groups', 'each', 'rows', 'cols'].filter(k => k in vis).map(k => vis[k]);
      if (nums.some(v => !Number.isInteger(v) || v < 0)) errs.push('visual tidak valid');
      const count = vis.kind === 'objects' ? vis.n : vis.kind === 'join' ? vis.a + vis.b : vis.kind === 'takeaway' ? vis.total
        : vis.kind === 'groups' ? vis.groups * vis.each : vis.kind === 'array' ? vis.rows * vis.cols : vis.kind === 'share' ? vis.total : 0;
      if (count > 30) errs.push('benda terlalu banyak untuk dihitung');
    }
    return errs;
  }

  /* Konteks dari mode belajar */
  function makeCtx(mode, choiceCount) {
    const m = mode === 'tk' || mode === 'challenge' ? mode : 'starter';
    return { mode: m, choices: choiceCount || (m === 'tk' ? 3 : 4) };
  }

  /*
   * Buat soal yang valid. avoid = Set kunci soal yang sudah muncul
   * di sesi ini supaya tidak berulang (jika masih memungkinkan).
   */
  function generate(area, step, ctx, avoid) {
    const gens = GEN[area];
    if (!gens) throw new Error('Area tidak dikenal: ' + area);
    const s = Math.max(0, Math.min(gens.length - 1, step | 0));
    const c = ctx || makeCtx('starter');
    theme = THEME[area + '-' + s] || null;
    let fallback = null;
    for (let i = 0; i < 40; i++) {
      const q = gens[s](c);
      if (validate(q).length) continue;
      q.area = area; q.step = s;
      if (!fallback) fallback = q;
      if (!avoid || !avoid.has(q.key)) return q;
    }
    if (fallback) return fallback;
    // Cadangan aman (seharusnya tidak pernah terjadi)
    const q = addQ(1, 1, 0, c);
    q.area = area; q.step = s;
    return q;
  }

  function stepCount(area) { return GEN[area] ? GEN[area].length : 0; }

  return {
    generate, validate, makeCtx, stepCount, terbilang, shuffle, numericChoices,
    setRandom(fn) { rng = typeof fn === 'function' ? fn : Math.random; },
    _GEN: GEN
  };
});
