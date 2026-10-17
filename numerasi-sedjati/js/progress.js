/*
 * PROGRES, PENYIMPANAN & ADAPTASI — Sedjati Numeracy Adventure
 * ---------------------------------------------------------------
 * Semua data disimpan di localStorage perangkat (tanpa server).
 * Struktur data sengaja rapi & berversi agar nanti mudah dipindah
 * ke backend (satu objek "store" berisi daftar pemain).
 *
 * Data yang disimpan hanya: nama panggilan, kelompok belajar, mode,
 * dan hasil latihan. Tidak ada data pribadi sensitif.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./curriculum.js'));
  else { root.SNA = root.SNA || {}; root.SNA.Progress = factory(root.SNA.Curriculum); }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  const KEY = 'sedjati-numeracy-adventure:v1';
  const VERSION = 1;
  const AREA_IDS = C.AREAS.map(a => a.id);
  const OP_IDS = C.OPS.map(o => o.id);
  const MAX_PLAYERS = 40;

  /* ---------- Bantuan validasi ---------- */
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const nat = (v, d = 0) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
  const clamp = (v, a, b, d) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const stepsOf = area => (C.AREA_BY_ID[area] ? C.AREA_BY_ID[area].steps.length : 0);
  const validStep = (area, s) => AREA_IDS.includes(area) && Number.isInteger(s) && s >= 0 && s < stepsOf(area);
  const missionKey = (area, step) => `${area}-${step}`;

  /* Nama panggilan: rapikan, buang karakter aneh, maksimal 20 huruf */
  function sanitizeName(s) {
    const clean = String(s == null ? '' : s)
      .replace(/[\u0000-\u001F\u007F<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 20)
      .trim();
    return clean || 'Tamu';
  }

  function defaultSettings() { return { sound: true, autoRead: true, unlockAll: false }; }
  function defaultStore() { return { version: VERSION, currentId: null, players: {}, settings: defaultSettings() }; }

  function emptyOps() {
    const o = {};
    OP_IDS.forEach(id => { o[id] = { attempted: 0, first: 0, helped: 0, wrong: 0, recent: [] }; });
    return o;
  }

  function newId() { return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

  function newPlayer(info) {
    info = info || {};
    const group = C.GROUPS.some(g => g.id === info.group) ? info.group : 'sd12';
    const groupMode = C.GROUPS.find(g => g.id === group).mode;
    const mode = C.MODES[info.mode] ? info.mode : groupMode;
    return {
      id: newId(),
      name: sanitizeName(info.name),
      group, mode,
      answerStyle: ['mix', 'choice', 'type'].includes(info.answerStyle) ? info.answerStyle : 'mix',
      timed: info.timed === true && mode === 'challenge',
      createdAt: Date.now(),
      base: {},           // langkah awal per area (hasil tes awal)
      missions: {},       // { 'add-1': {plays, completed, stars, best, goodRuns, last, lastAt} }
      ops: emptyOps(),    // statistik per operasi
      history: [],        // soal terakhir (terbaru di depan)
      sessions: [],       // sesi terakhir (terbaru di depan)
      badges: {},         // { id: waktu diperoleh }
      helpedTotal: 0,     // benar setelah mencoba lagi
      assess: { initial: null, final: {} }
    };
  }

  /* ---------- Sanitasi data tersimpan ---------- */
  function sanitizeAssessAreas(obj, withSteps) {
    const out = {};
    if (!isObj(obj)) return out;
    AREA_IDS.forEach(a => {
      const r = obj[a];
      if (!isObj(r)) return;
      const total = nat(r.total), correct = Math.min(nat(r.correct), total);
      if (!total) return;
      const item = { correct, total, t: num(r.t, 0) };
      if (Number.isInteger(r.start) && validStep(a, r.start)) item.start = r.start;
      if (withSteps && isObj(r.steps)) {
        item.steps = {};
        Object.keys(r.steps).forEach(k => {
          const s = Number(k), v = r.steps[k];
          if (validStep(a, s) && isObj(v)) {
            const n = nat(v.n); if (n) item.steps[s] = { c: Math.min(nat(v.c), n), n };
          }
        });
      }
      out[a] = item;
    });
    return out;
  }

  function sanitizePlayer(pr, id) {
    if (!isObj(pr)) return null;
    const p = newPlayer({ name: pr.name, group: pr.group, mode: pr.mode, answerStyle: pr.answerStyle, timed: pr.timed });
    p.id = id;
    p.createdAt = num(pr.createdAt, Date.now());
    if (isObj(pr.base)) AREA_IDS.forEach(a => { if (validStep(a, pr.base[a])) p.base[a] = pr.base[a]; });
    if (isObj(pr.missions)) {
      Object.keys(pr.missions).forEach(k => {
        const m = /^([a-z]+)-(\d)$/.exec(k);
        const v = pr.missions[k];
        if (!m || !validStep(m[1], Number(m[2])) || !isObj(v)) return;
        p.missions[k] = {
          plays: nat(v.plays), completed: v.completed === true, stars: clamp(nat(v.stars), 0, 3, 0),
          best: clamp(v.best, 0, 1, 0), goodRuns: nat(v.goodRuns), last: clamp(v.last, 0, 1, 0), lastAt: num(v.lastAt, 0)
        };
      });
    }
    if (isObj(pr.ops)) {
      OP_IDS.forEach(o => {
        const v = pr.ops[o];
        if (!isObj(v)) return;
        p.ops[o] = {
          attempted: nat(v.attempted), first: nat(v.first), helped: nat(v.helped), wrong: nat(v.wrong),
          recent: Array.isArray(v.recent) ? v.recent.filter(x => x === 0 || x === 0.5 || x === 1).slice(-20) : []
        };
      });
    }
    if (Array.isArray(pr.history)) {
      p.history = pr.history.filter(h => isObj(h) && validStep(h.area, h.step) && OP_IDS.includes(h.op)).slice(0, 80).map(h => ({
        t: num(h.t, 0), area: h.area, step: h.step, op: h.op, key: str(h.key, 60), q: str(h.q, 80), answer: str(h.answer, 20),
        given: str(h.given, 20), outcome: ['first', 'help', 'wrong'].includes(h.outcome) ? h.outcome : 'wrong'
      }));
    }
    if (Array.isArray(pr.sessions)) {
      p.sessions = pr.sessions.filter(s => isObj(s) && validStep(s.area, s.step)).slice(0, 30).map(s => ({
        t: num(s.t, 0), kind: ['mission', 'review'].includes(s.kind) ? s.kind : 'mission', area: s.area, step: s.step,
        total: nat(s.total), first: nat(s.first), helped: nat(s.helped), wrong: nat(s.wrong),
        score: clamp(s.score, 0, 1, 0), stars: clamp(nat(s.stars), 0, 3, 0), completed: s.completed === true
      }));
    }
    if (isObj(pr.badges)) BADGES.forEach(b => { if (Number.isFinite(pr.badges[b.id])) p.badges[b.id] = pr.badges[b.id]; });
    p.helpedTotal = nat(pr.helpedTotal);
    if (isObj(pr.assess)) {
      if (isObj(pr.assess.initial)) {
        const areas = sanitizeAssessAreas(pr.assess.initial.areas, false);
        if (Object.keys(areas).length) p.assess.initial = { t: num(pr.assess.initial.t, 0), areas };
      }
      p.assess.final = sanitizeAssessAreas(pr.assess.final, true);
    }
    return p;
  }

  function sanitizeStore(raw) {
    const s = defaultStore();
    if (!isObj(raw)) return s;
    if (isObj(raw.settings)) Object.keys(s.settings).forEach(k => { if (typeof raw.settings[k] === 'boolean') s.settings[k] = raw.settings[k]; });
    if (isObj(raw.players)) {
      Object.keys(raw.players).slice(0, MAX_PLAYERS).forEach(id => {
        if (!/^p[a-z0-9]{1,40}$/i.test(id)) return;
        const p = sanitizePlayer(raw.players[id], id);
        if (p) s.players[id] = p;
      });
    }
    if (typeof raw.currentId === 'string' && s.players[raw.currentId]) s.currentId = raw.currentId;
    return s;
  }

  /* ---------- Penyimpanan ---------- */
  function createStorage(getLS) {
    let ls = null, available = false;
    try {
      ls = getLS();
      const probe = '__sna_probe__';
      ls.setItem(probe, '1'); ls.removeItem(probe);
      available = true;
    } catch (e) { available = false; }
    return {
      get available() { return available; },
      load() {
        if (!available) return { store: defaultStore(), status: 'unavailable' };
        let raw;
        try { raw = ls.getItem(KEY); } catch (e) { return { store: defaultStore(), status: 'unavailable' }; }
        if (raw == null) return { store: defaultStore(), status: 'empty' };
        try {
          return { store: sanitizeStore(JSON.parse(raw)), status: 'ok' };
        } catch (e) {
          try { ls.setItem(KEY + ':rusak', raw); } catch (x) { /* abaikan */ }
          return { store: defaultStore(), status: 'corrupt' };
        }
      },
      save(store) {
        if (!available) return false;
        try { ls.setItem(KEY, JSON.stringify(store)); return true; } catch (e) { return false; }
      },
      clear() { try { if (ls) ls.removeItem(KEY); } catch (e) { /* abaikan */ } }
    };
  }

  /* ---------- Misi & ketersediaan ---------- */
  function mission(p, area, step) { return p.missions[missionKey(area, step)] || null; }
  function isCompleted(p, area, step) { const m = mission(p, area, step); return !!(m && m.completed); }

  /* Langkah awal: hasil tes awal jika ada, jika tidak sesuai mode */
  function startStep(p, area) {
    const n = stepsOf(area);
    const s = Number.isInteger(p.base[area]) ? p.base[area] : C.MODES[p.mode].start;
    return Math.max(0, Math.min(n - 1, s));
  }

  /* Misi terbuka jika: Kebun Angka (selalu), ≤ langkah awal, misi sebelumnya selesai, atau guru membuka semua */
  function isAvailable(p, settings, area, step) {
    if (!validStep(area, step)) return false;
    if (settings && settings.unlockAll) return true;
    if (area === 'count') return true;
    const modeStart = Math.min(stepsOf(area) - 1, C.MODES[p.mode].start);
    if (step <= Math.max(startStep(p, area), modeStart)) return true;
    return isCompleted(p, area, step - 1);
  }

  function areaProgress(p, area) {
    const n = stepsOf(area);
    let done = 0, stars = 0;
    for (let i = 0; i < n; i++) { const m = mission(p, area, i); if (m) { if (m.completed) done++; stars += m.stars; } }
    return { done, total: n, stars, maxStars: n * 3 };
  }

  function totalStars(p) { return Object.values(p.missions).reduce((s, m) => s + (m.stars || 0), 0); }
  function completedCount(p) { return Object.values(p.missions).filter(m => m.completed).length; }
  function countCompleted(p, area, minStars) {
    let c = 0;
    for (let i = 0; i < stepsOf(area); i++) { const m = mission(p, area, i); if (m && m.completed && m.stars >= minStars) c++; }
    return c;
  }

  /* ---------- Lencana (berdasarkan capaian belajar, bukan kecepatan) ---------- */
  const BADGES = [
    { id: 'penjelajah', name: 'Penjelajah Angka', icon: '🧭', desc: 'Menyelesaikan misi di 3 area berbeda.', check: p => AREA_IDS.filter(a => countCompleted(p, a, 1) > 0).length >= 3 },
    { id: 'pemetik', name: 'Pemetik Angka', icon: '🌱', desc: 'Menyelesaikan 3 misi di Kebun Angka.', check: p => countCompleted(p, 'count', 1) >= 3 },
    { id: 'tambah', name: 'Jago Penjumlahan', icon: '➕', desc: 'Menyelesaikan 3 misi penjumlahan dengan minimal 2 bintang.', check: p => countCompleted(p, 'add', 2) >= 3 },
    { id: 'kurang', name: 'Sahabat Pengurangan', icon: '➖', desc: 'Menyelesaikan 3 misi pengurangan dengan minimal 2 bintang.', check: p => countCompleted(p, 'sub', 2) >= 3 },
    { id: 'kali', name: 'Ahli Perkalian', icon: '✖️', desc: 'Menyelesaikan 3 misi perkalian dengan minimal 2 bintang.', check: p => countCompleted(p, 'mul', 2) >= 3 },
    { id: 'bagi', name: 'Pahlawan Pembagian', icon: '➗', desc: 'Menyelesaikan 3 misi pembagian dengan minimal 2 bintang.', check: p => countCompleted(p, 'div', 2) >= 3 },
    { id: 'gigih', name: 'Pantang Menyerah', icon: '💪', desc: 'Berhasil menjawab benar setelah mencoba lagi sebanyak 10 kali.', check: p => p.helpedTotal >= 10 },
    { id: 'juara', name: 'Juara Numerasi Sedjati', icon: '🏆', desc: 'Meraih 4 lencana operasi dan menyelesaikan 2 misi Pulau Tantangan.', check: p => ['tambah', 'kurang', 'kali', 'bagi'].every(b => p.badges[b]) && countCompleted(p, 'mix', 1) >= 2 }
  ];

  /* Lencana tidak pernah dicabut; fungsi ini hanya menambah yang baru */
  function evaluateBadges(p) {
    const earned = [];
    BADGES.forEach(b => {
      if (!p.badges[b.id] && b.check(p)) { p.badges[b.id] = Date.now(); earned.push(b); }
    });
    return earned;
  }

  /* ---------- Mencatat jawaban latihan ---------- */
  // outcome: 'first' = benar percobaan pertama, 'help' = benar setelah bantuan, 'wrong' = belum benar
  function recordAnswer(p, q, outcome, given) {
    const op = OP_IDS.includes(q.op) ? q.op : 'mix';
    const s = p.ops[op];
    s.attempted++;
    if (outcome === 'first') s.first++;
    else if (outcome === 'help') { s.helped++; p.helpedTotal++; }
    else s.wrong++;
    s.recent.push(outcome === 'first' ? 1 : outcome === 'help' ? 0.5 : 0);
    if (s.recent.length > 20) s.recent = s.recent.slice(-20);
    p.history.unshift({
      t: Date.now(), area: q.area, step: q.step, op, key: str(q.key, 60),
      q: str(q.equation || q.prompt, 80), answer: str(q.answer, 20), given: str(String(given == null ? '' : given), 20), outcome
    });
    if (p.history.length > 80) p.history.length = 80;
  }

  function scoreOf(results) {
    const total = results.length;
    const first = results.filter(r => r === 'first').length;
    const helped = results.filter(r => r === 'help').length;
    const wrong = total - first - helped;
    const score = total ? (first + 0.5 * helped) / total : 0;
    const stars = score >= 0.9 ? 3 : score >= 0.75 ? 2 : score >= 0.6 ? 1 : 0;
    return { total, first, helped, wrong, score, stars, completed: score >= 0.6 };
  }

  /* Akhir misi: simpan bintang terbaik (bintang lama tidak pernah hilang) */
  function finishMission(p, area, step, results, kind) {
    const r = scoreOf(results);
    const k = kind === 'review' ? 'review' : 'mission';
    let prevStars = 0;
    if (k === 'mission' && validStep(area, step)) {
      const key = missionKey(area, step);
      const m = p.missions[key] || { plays: 0, completed: false, stars: 0, best: 0, goodRuns: 0, last: 0, lastAt: 0 };
      prevStars = m.stars;
      m.plays++;
      m.completed = m.completed || r.completed;
      m.stars = Math.max(m.stars, r.stars);
      m.best = Math.max(m.best, r.score);
      if (r.score >= 0.8) m.goodRuns++;
      m.last = r.score; m.lastAt = Date.now();
      p.missions[key] = m;
    }
    p.sessions.unshift(Object.assign({ t: Date.now(), kind: k, area, step }, r));
    if (p.sessions.length > 30) p.sessions.length = 30;
    r.prevStars = prevStars;
    r.newBadges = evaluateBadges(p);
    return r;
  }

  /* ---------- Status kemampuan per operasi ----------
   * Dibedakan: jumlah soal dicoba, ketepatan latihan, dan penguasaan
   * (penguasaan butuh ≥ 20 soal, ketepatan terbaru ≥ 85%, dan
   * minimal 2 sesi dengan nilai ≥ 80% — bukan dari satu kuis saja).
   */
  function opStatus(p, op) {
    const s = p.ops[op] || { attempted: 0, first: 0, helped: 0, wrong: 0, recent: [] };
    const accuracy = s.attempted ? (s.first + 0.5 * s.helped) / s.attempted : null;
    const recentAcc = s.recent.length ? s.recent.reduce((a, b) => a + b, 0) / s.recent.length : null;
    const goodSessions = p.sessions.filter(x => C.AREA_BY_ID[x.area] && C.AREA_BY_ID[x.area].op === op && x.score >= 0.8).length;
    let level = 'none', label = 'Belum dicoba';
    if (s.attempted > 0) {
      if (s.attempted >= 20 && recentAcc >= 0.85 && goodSessions >= 2) { level = 'mastered'; label = 'Dikuasai'; }
      else if (s.attempted >= 10 && recentAcc >= 0.7) { level = 'fluent'; label = 'Mulai lancar'; }
      else { level = 'practice'; label = 'Sedang berlatih'; }
    }
    const needsPractice = s.attempted >= 5 && recentAcc !== null && recentAcc < 0.6;
    return Object.assign({}, s, { accuracy, recentAcc, goodSessions, level, label, needsPractice });
  }

  /* ---------- Rekomendasi misi berikutnya ---------- */
  const ORDER = {
    tk: { areas: ['count', 'add', 'sub', 'mul', 'div'], offset: { count: 0, add: 0.5, sub: 1, mul: 2.5, div: 3 } },
    starter: { areas: ['add', 'sub', 'mul', 'div', 'mix'], offset: { add: 0, sub: 0.5, mul: 1, div: 1.5, mix: 2.5 } },
    challenge: { areas: ['add', 'sub', 'mul', 'div', 'mix'], offset: { add: 0, sub: 0.5, mul: 1, div: 1.5, mix: 2.5 } }
  };

  function recommend(p, settings) {
    const last = p.sessions.find(s => s.kind === 'mission');
    // 1) Sesi terakhir masih sulit → ulangi (atau turun satu langkah)
    if (last && !last.completed && validStep(last.area, last.step)) {
      const easier = last.score < 0.4 && last.step > 0;
      return {
        area: last.area, step: easier ? last.step - 1 : last.step,
        reason: easier ? 'Kita ulang yang sedikit lebih mudah dulu, ya.' : 'Yuk, coba misi ini sekali lagi. Kamu pasti makin bisa!'
      };
    }
    const ord = ORDER[p.mode] || ORDER.starter;
    const areas = ord.areas.slice();
    // Kebun Angka jadi prasyarat singkat untuk SD jika membilang perlu latihan
    if (p.mode !== 'tk' && opStatus(p, 'count').needsPractice) areas.unshift('count');
    // 2) Operasi yang ketepatannya rendah → latihan lagi di misi terakhir area itu
    for (const a of areas) {
      const op = C.AREA_BY_ID[a].op;
      if (opStatus(p, op).needsPractice) {
        const s = p.sessions.find(x => x.area === a && x.kind === 'mission');
        if (s) return { area: a, step: s.step, reason: 'Latihan lagi agar makin lancar.' };
      }
    }
    // 3) Misi berikutnya yang belum selesai, diselang-seling antar area
    let best = null;
    areas.forEach(a => {
      if (p.mode === 'tk' && (a === 'mul' || a === 'div') && !isCompleted(p, 'add', 1)) return; // eksplorasi setelah tambah sampai 10
      const from = a === 'count' && p.mode !== 'tk' ? 0 : startStep(p, a);
      let s = null;
      for (let i = from; i < stepsOf(a); i++) {
        if (!isCompleted(p, a, i) && isAvailable(p, settings, a, i)) { s = i; break; }
      }
      if (s === null) return;
      const score = (s - from) + (a === 'count' && p.mode !== 'tk' ? -1 : (ord.offset[a] || 0));
      if (!best || score < best.score) best = { area: a, step: s, score };
    });
    if (best) {
      const fresh = !p.sessions.length;
      return { area: best.area, step: best.step, reason: fresh ? 'Misi pertama yang cocok untukmu.' : 'Misi berikutnya yang cocok untukmu.' };
    }
    return null;
  }

  /* ---------- Tes awal (diagnostik, opsional) ---------- */
  function diagnosticPlan(mode) {
    if (mode === 'tk') return [{ area: 'count', probe: 1 }, { area: 'add', probe: 0 }, { area: 'sub', probe: 0 }];
    if (mode === 'challenge') return [{ area: 'add', probe: 3 }, { area: 'sub', probe: 3 }, { area: 'mul', probe: 2 }, { area: 'div', probe: 2 }, { area: 'mix', probe: 1 }];
    return [{ area: 'add', probe: 1 }, { area: 'sub', probe: 1 }, { area: 'mul', probe: 0 }, { area: 'div', probe: 0 }];
  }
  // Soal kedua: naik satu langkah jika soal pertama benar, turun jika salah
  function diagnosticNextStep(area, probe, firstOk) {
    return firstOk ? Math.min(probe + 1, stepsOf(area) - 1) : Math.max(probe - 1, 0);
  }
  function diagnosticStart(probe, answers) {
    const ok = answers.filter(a => a.ok).map(a => a.step);
    return ok.length ? Math.max.apply(null, ok) : Math.max(probe - 2, 0);
  }
  // results: [{area, probe, answers:[{step, ok}]}]
  function applyDiagnostic(p, results) {
    const areas = {};
    results.forEach(r => {
      if (!validStep(r.area, r.probe)) return;
      const start = diagnosticStart(r.probe, r.answers);
      areas[r.area] = { correct: r.answers.filter(a => a.ok).length, total: r.answers.length, start, t: Date.now() };
      p.base[r.area] = start;
    });
    p.assess.initial = { t: Date.now(), areas };
    return areas;
  }

  /* ---------- Tes akhir level ---------- */
  function canFinal(p, area) { return countCompleted(p, area, 1) >= 2; }
  // 6 soal dari misi yang sudah selesai (soal baru, bukan soal yang sama)
  function finalPlan(p, area) {
    const done = [];
    for (let i = stepsOf(area) - 1; i >= 0; i--) if (isCompleted(p, area, i)) done.push(i);
    if (!done.length) return [];
    return Array.from({ length: 6 }, (_, i) => done[i % done.length]);
  }
  function applyFinal(p, area, answers) {
    const steps = {};
    answers.forEach(a => { steps[a.step] = steps[a.step] || { c: 0, n: 0 }; steps[a.step].n++; if (a.ok) steps[a.step].c++; });
    const res = { correct: answers.filter(a => a.ok).length, total: answers.length, steps, t: Date.now() };
    p.assess.final[area] = res;
    return res;
  }

  function compareAssessment(p, area) {
    const ini = p.assess.initial && p.assess.initial.areas[area];
    const fin = p.assess.final[area];
    if (!ini || !fin) return { enough: false, text: 'Belum cukup data untuk membandingkan tes awal dan tes akhir.' };
    return {
      enough: true,
      text: `Tes awal ${ini.correct}/${ini.total} benar → tes akhir ${fin.correct}/${fin.total} benar. Tes awal hanya 2 soal per area dan tingkat soalnya bisa berbeda, jadi ini gambaran kasar, bukan bukti pasti peningkatan.`
    };
  }

  /* ---------- Latihan ulang soal sulit ---------- */
  function reviewSteps(p) {
    const tally = {};
    p.history.slice(0, 40).forEach(h => {
      if (h.outcome === 'first') return;
      const k = missionKey(h.area, h.step);
      tally[k] = (tally[k] || 0) + (h.outcome === 'wrong' ? 2 : 1);
    });
    return Object.keys(tally).sort((a, b) => tally[b] - tally[a]).slice(0, 3).map(k => {
      const [area, step] = k.split('-');
      return { area, step: Number(step) };
    });
  }

  return {
    KEY, VERSION, BADGES,
    sanitizeName, defaultStore, defaultSettings, newPlayer, sanitizeStore, createStorage,
    missionKey, mission, isCompleted, startStep, isAvailable, areaProgress, totalStars, completedCount, countCompleted,
    evaluateBadges, recordAnswer, scoreOf, finishMission, opStatus, recommend,
    diagnosticPlan, diagnosticNextStep, diagnosticStart, applyDiagnostic,
    canFinal, finalPlan, applyFinal, compareAssessment, reviewSteps
  };
});
