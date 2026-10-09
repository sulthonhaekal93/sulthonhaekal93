/*
 * APP — tampilan, alur permainan, penyimpanan, papan prestasi.
 */
(function () {
  'use strict';
  const E = window.EFG;
  const CFG = window.APP_CONFIG || {};
  const LEVELS = E.LEVELS;

  // ================= util =================
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* abaikan */ } }
  };
  const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms || 2200);
  }
  function confirmBox(text) {
    return new Promise((resolve) => {
      $('#confirm-text').textContent = text;
      const m = $('#modal-confirm'); m.classList.remove('hidden');
      const done = (v) => { m.classList.add('hidden'); $('#confirm-yes').onclick = $('#confirm-no').onclick = null; resolve(v); };
      $('#confirm-yes').onclick = () => done(true);
      $('#confirm-no').onclick = () => done(false);
    });
  }

  function picHTML(item, cls) {
    cls = cls || '';
    if (item.swatch) return `<span class="pic swatch ${cls}" style="background:${esc(item.p)}"></span>`;
    if (item.num) return `<span class="pic num ${cls}">${esc(item.v)}</span>`;
    if (item.nopic) return cls === 'tiny' ? '' : `<span class="pic nopic ${cls}">📝</span>`;
    return `<span class="pic emoji ${cls}">${esc(item.p)}</span>`;
  }

  // ================= suara =================
  const state = { player: null, game: null, theme: null, level: null, sound: LS.get('efg_sound', true), lastBoardFrom: 'menu' };
  let audioCtx = null;
  function beep(freqs, dur, type) {
    if (!state.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      let t = audioCtx.currentTime;
      freqs.forEach((f) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = type || 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + dur);
        t += dur * 0.8;
      });
    } catch (e) { /* tidak ada audio */ }
  }
  const sfx = {
    good: () => beep([660, 880], 0.14),
    bad: () => beep([220, 160], 0.18, 'square'),
    tap: () => beep([520], 0.05),
    win: () => beep([523, 659, 784, 1047], 0.16)
  };
  function speak(text) {
    if (!state.sound || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 0.85;
      const v = speechSynthesis.getVoices().find((x) => /^en(-|_)(US|GB)/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* abaikan */ }
  }

  // ================= daftar game =================
  const GAMES = {
    tts: { name: 'TTS', full: 'Teka-Teki Silang', icon: '🧩', desc: 'Isi kotak dengan kata yang tepat', fastSec: 25, unit: 'kata' },
    wordsearch: { name: 'Word Search', full: 'Cari Kata', icon: '🔍', desc: 'Temukan kata yang tersembunyi', fastSec: 15, unit: 'kata' },
    susunkata: { name: 'Susun Kata', full: 'Susun Huruf', icon: '🔤', desc: 'Susun huruf menjadi kata', fastSec: 12, unit: 'soal' },
    match: { name: 'Match Picture', full: 'Cocokkan Gambar', icon: '🖼️', desc: 'Pilih kata yang cocok dengan gambar', fastSec: 6, unit: 'soal' },
    kalimat: { name: 'Susun Kalimat', full: 'Susun Kalimat', icon: '📝', desc: 'Susun kata menjadi kalimat', fastSec: 18, unit: 'soal' }
  };
  const LEVEL_INFO = {
    tts: ['Gambar + arti, huruf pertama dibantu', 'Gambar + arti sebagai petunjuk', 'Hanya arti bahasa Indonesia'],
    wordsearch: ['Kotak 10×10, mendatar & menurun', 'Kotak 12×12, ditambah diagonal', 'Kotak 14×14, semua arah, kata disembunyikan'],
    susunkata: ['Gambar + arti + suara', 'Gambar + suara', 'Hanya arti, ada huruf pengecoh'],
    match: ['3 pilihan + arti', '4 pilihan', '4 pilihan mirip + batas waktu'],
    kalimat: ['Kalimat pendek + arti', 'Kalimat sedang + arti', 'Kalimat panjang, arti disembunyikan']
  };

  // ================= navigasi =================
  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== 'screen-' + id));
    if (id !== 'result') $('#confetti').innerHTML = '';
    $('#topbar').classList.toggle('hidden', id === 'start' || !state.player);
    window.scrollTo(0, 0);
    state.screen = id;
  }

  function renderPlayerChip() {
    const p = state.player;
    $('#player-chip').innerHTML = p ? `👦 ${esc(p.name)}${p.kelas ? ' · Kelas ' + esc(p.kelas) : ''}` : '';
    $('#btn-sound').textContent = state.sound ? '🔊' : '🔇';
  }

  function renderMenu() {
    $('#menu-greet').textContent = `Halo, ${state.player.name}! 👋`;
    $('#game-list').innerHTML = Object.keys(GAMES).map((k) => {
      const g = GAMES[k];
      return `<button class="game-card" data-game="${k}"><span class="gc-icon">${g.icon}</span><span class="gc-name">${g.name}</span><span class="gc-desc">${g.desc}</span></button>`;
    }).join('');
    $$('#game-list .game-card').forEach((b) => b.onclick = () => { sfx.tap(); state.game = b.dataset.game; renderThemes(); show('theme'); });
    show('menu');
  }
  function renderThemes() {
    const g = GAMES[state.game];
    $('#theme-title').textContent = `${g.icon} ${g.name} — Pilih Tema`;
    $('#theme-list').innerHTML = E.ALL_THEMES.map((t) =>
      `<button class="theme-card" data-theme="${t.id}"><span class="tc-icon">${t.icon}</span><span class="tc-name">${esc(t.name)}</span><span class="tc-en">${esc(t.en)}</span></button>`).join('');
    $$('#theme-list .theme-card').forEach((b) => b.onclick = () => { sfx.tap(); state.theme = b.dataset.theme; renderLevels(); show('level'); });
  }
  function themeName(id) { const t = E.ALL_THEMES.find((x) => x.id === id); return t ? t.name : id; }
  function renderLevels() {
    const g = GAMES[state.game];
    $('#level-title').textContent = `${g.icon} ${g.name} · ${themeName(state.theme)}`;
    const best = bestScores();
    $('#level-list').innerHTML = [1, 2, 3].map((L) => {
      const lv = LEVELS[L];
      const b = best[`${state.game}|${state.theme}|${L}`];
      const stars = b ? '⭐'.repeat(b.stars) + '☆'.repeat(3 - b.stars) : '☆☆☆';
      return `<button class="level-card lv${L}" data-level="${L}">
        <span class="lc-icon">${lv.icon}</span>
        <span class="lc-body"><span class="lc-name">Level ${L} · ${lv.name}</span>
        <span class="lc-desc">${lv.count} soal · ${LEVEL_INFO[state.game][L - 1]}</span></span>
        <span class="lc-stars" title="Bintang terbaik">${stars}</span></button>`;
    }).join('');
    $$('#level-list .level-card').forEach((b) => b.onclick = () => { sfx.tap(); state.level = Number(b.dataset.level); startGame(); });
  }

  // ================= sesi permainan =================
  let session = null;
  function startGame() {
    const g = GAMES[state.game];
    session = {
      game: state.game, theme: state.theme, level: state.level,
      total: 0, done: 0, correct: 0, points: 0, hints: 0,
      start: Date.now(), ended: false, timers: []
    };
    $('#g-title').textContent = `${g.icon} ${g.name} · ${themeName(state.theme)} · Level ${state.level}`;
    $('#game-area').innerHTML = '';
    $('#game-area').className = 'game-' + state.game;
    show('game');
    clearInterval(startGame._tick);
    startGame._tick = setInterval(updateHud, 1000);
    Runners[state.game]($('#game-area'), state.theme, state.level);
    updateHud();
  }
  function updateHud() {
    if (!session) return;
    $('#g-progress').textContent = `${session.done}/${session.total}`;
    $('#g-score').textContent = session.points;
    $('#g-timer').textContent = fmtTime((Date.now() - session.start) / 1000);
    $('#g-bar').style.width = (session.total ? (session.done / session.total) * 100 : 0) + '%';
  }
  function stopTimers() {
    if (!session) return;
    session.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    session.timers = [];
  }
  function later(fn, ms) { const s = session; const t = setTimeout(() => { if (session === s && !s.ended) fn(); }, ms); session.timers.push(t); return t; }

  async function quitGame() {
    if (session && !session.ended && !(await confirmBox('Keluar dari permainan? Skor tidak akan disimpan.'))) return;
    endSession();
    renderLevels(); show('level');
  }
  function endSession() {
    clearInterval(startGame._tick);
    stopTimers();
    if (session) session.ended = true;
    try { speechSynthesis.cancel(); } catch (e) { /* abaikan */ }
  }

  // ================= GAME: Match Picture =================
  const Runners = {};
  Runners.match = function (area, theme, level) {
    const n = LEVELS[level].count;
    const all = E.wordPool(theme, level, { needPic: true });
    const qs = all.slice(0, n);
    const nOpt = level === 1 ? 3 : 4;
    session.total = qs.length;
    let i = 0;

    function similar(a, b) {
      let s = 0;
      if (a.w[0] === b.w[0]) s += 2;
      if (Math.abs(a.w.length - b.w.length) <= 1) s += 1;
      if (a.theme === b.theme) s += 1;
      return s + Math.random();
    }
    function next() {
      if (i >= qs.length) return finishGame();
      const q = qs[i];
      let others = all.filter((x) => x.w !== q.w && x.p !== q.p);
      if (level === 3) others.sort((a, b) => similar(q, b) - similar(q, a));
      else others = E.shuffle(others);
      const opts = E.shuffle([q].concat(others.slice(0, nOpt - 1)));
      area.innerHTML = `
        <div class="q-card">
          <div class="q-pic">${picHTML(q, 'big')}</div>
          ${level === 1 ? `<div class="q-hint">Artinya: <b>${esc(q.id)}</b></div>` : ''}
          ${level === 3 ? '<div class="countdown"><div class="countdown-bar" id="cd-bar"></div></div>' : ''}
          <p class="q-ask">Gambar apakah ini?</p>
          <div class="options opt${nOpt}">${opts.map((o) => `<button class="opt-btn" data-w="${esc(o.w)}">${esc(o.w)}</button>`).join('')}</div>
        </div>`;
      let answered = false;
      const qStart = Date.now();
      const answer = (btn) => {
        if (answered) return; answered = true;
        const ok = btn && btn.dataset.w === q.w;
        $$('.opt-btn', area).forEach((b) => {
          b.disabled = true;
          if (b.dataset.w === q.w) b.classList.add('correct');
        });
        if (ok) { session.correct++; session.points += 10; sfx.good(); }
        else { if (btn) btn.classList.add('wrong'); sfx.bad(); }
        speak(q.w);
        session.done++; i++; updateHud();
        later(next, ok ? 1100 : 1700);
      };
      $$('.opt-btn', area).forEach((b) => b.onclick = () => answer(b));
      if (level === 3) {
        const limit = 12000;
        const bar = $('#cd-bar', area);
        const iv = setInterval(() => {
          const left = Math.max(0, limit - (Date.now() - qStart));
          if (bar) bar.style.width = (left / limit * 100) + '%';
          if (left <= 0 || answered) { clearInterval(iv); if (!answered) answer(null); }
        }, 100);
        session.timers.push(iv);
      }
    }
    next();
  };

  // ================= GAME: Susun Kata =================
  Runners.susunkata = function (area, theme, level) {
    const qs = E.wordPool(theme, level).slice(0, LEVELS[level].count);
    session.total = qs.length;
    let i = 0;

    function scramble(word) {
      let letters = word.split('');
      if (level === 3) {
        const abc = 'abcdefghijklmnopqrstuvwxyz';
        for (let k = 0; k < 2; k++) letters.push(abc[Math.floor(Math.random() * 26)]);
      }
      for (let t = 0; t < 10; t++) {
        const s = E.shuffle(letters);
        if (s.join('') !== letters.join('') || new Set(word).size < 2) return s;
      }
      return E.shuffle(letters);
    }
    function next() {
      if (i >= qs.length) return finishGame();
      const q = qs[i];
      let attempts = 0;
      const tiles = scramble(q.w).map((ch, k) => ({ ch, k, used: false }));
      let slots = new Array(q.w.length).fill(null);
      const clue = level === 3
        ?`<div class="q-word-id">${esc(q.id)}</div>`
        : `<div class="q-pic">${picHTML(q, 'big')}</div>${level === 1 || q.nopic ? `<div class="q-hint">Artinya: <b>${esc(q.id)}</b></div>` : ''}`;
      area.innerHTML = `
        <div class="q-card">
          ${clue}
          <p class="q-ask">Susun huruf menjadi kata yang benar!</p>
          <div class="slots" id="slots"></div>
          <div class="tiles" id="tiles"></div>
          <div class="msg" id="msg"></div>
          <div class="actions">
            ${level < 3 ? '<button class="btn" id="b-say">🔊 Dengar</button>' : ''}
            <button class="btn" id="b-clear">↺ Ulang</button>
            <button class="btn btn-ghost" id="b-skip">Lewati ⏭</button>
          </div>
        </div>`;
      const renderTiles = () => {
        $('#slots', area).innerHTML = slots.map((s, k) => `<button class="slot ${s ? 'filled' : ''}" data-k="${k}">${s ? esc(s.ch) : ''}</button>`).join('');
        $('#tiles', area).innerHTML = tiles.map((t, k) => `<button class="tile ${t.used ? 'used' : ''}" data-k="${k}" ${t.used ? 'disabled' : ''}>${esc(t.ch)}</button>`).join('');
        $$('.tile', area).forEach((b) => b.onclick = () => {
          const t = tiles[b.dataset.k]; const free = slots.indexOf(null);
          if (t.used || free < 0) return;
          sfx.tap(); t.used = true; slots[free] = t; renderTiles();
          if (slots.indexOf(null) < 0) check();
        });
        $$('.slot', area).forEach((b) => b.onclick = () => {
          const s = slots[b.dataset.k]; if (!s || locked) return;
          s.used = false; slots[b.dataset.k] = null; renderTiles();
        });
      };
      let locked = false;
      const reset = () => { tiles.forEach((t) => { t.used = false; }); slots = new Array(q.w.length).fill(null); renderTiles(); };
      const finishQ = (ok, pts) => {
        locked = true;
        session.done++; i++;
        if (ok) { session.correct++; session.points += pts; }
        updateHud();
        later(next, ok ? 1200 : 2200);
      };
      const check = () => {
        const guess = slots.map((s) => s.ch).join('');
        if (guess === q.w) {
          sfx.good(); speak(q.w);
          $('#slots', area).classList.add('ok');
          $('#msg', area).innerHTML = `✅ Hebat! <b>${esc(q.w)}</b> = ${esc(q.id)}`;
          finishQ(true, attempts === 0 ? 10 : 5);
        } else {
          attempts++; sfx.bad();
          $('#slots', area).classList.add('shake');
          setTimeout(() => $('#slots', area) && $('#slots', area).classList.remove('shake'), 500);
          if (attempts >= 2) {
            $('#msg', area).innerHTML = `❌ Jawaban yang benar: <b>${esc(q.w)}</b>`;
            speak(q.w); finishQ(false, 0);
          } else {
            $('#msg', area).textContent = '❌ Belum tepat, coba sekali lagi!';
            later(reset, 600);
          }
        }
      };
      renderTiles();
      const say = $('#b-say', area); if (say) say.onclick = () => speak(q.w);
      $('#b-clear', area).onclick = () => { if (!locked) reset(); };
      $('#b-skip', area).onclick = () => {
        if (locked) return;
        $('#msg', area).innerHTML = `⏭ Jawabannya: <b>${esc(q.w)}</b>`; finishQ(false, 0);
      };
      if (level === 1) later(() => speak(q.w), 300);
    }
    next();
  };

  // ================= GAME: Susun Kalimat =================
  Runners.kalimat = function (area, theme, level) {
    const qs = E.buildSentences(theme, level, LEVELS[level].count);
    session.total = qs.length;
    let i = 0;
    function next() {
      if (i >= qs.length) return finishGame();
      const q = qs[i];
      let attempts = 0, locked = false, hintUsed = false;
      let order = E.shuffle(q.tokens.map((t, k) => k));
      for (let t = 0; t < 10 && order.every((v, k) => q.tokens[v] === q.tokens[k]); t++) order = E.shuffle(order);
      const tiles = order.map((k) => ({ text: q.tokens[k], used: false }));
      let answer = [];
      area.innerHTML = `
        <div class="q-card">
          <div class="q-pic small">${picHTML(q.word)}</div>
          <div class="q-hint" id="trans">${level < 3 ? `🇮🇩 ${esc(q.id)}` : '<button class="btn btn-small" id="b-trans">💡 Lihat arti</button>'}</div>
          <p class="q-ask">Susun kata-kata menjadi kalimat yang benar!</p>
          <div class="sentence-box" id="answer"></div>
          <div class="word-tiles" id="wtiles"></div>
          <div class="msg" id="msg"></div>
          <div class="actions">
            <button class="btn" id="b-say">🔊 Dengar</button>
            <button class="btn" id="b-clear">↺ Ulang</button>
            <button class="btn btn-ghost" id="b-skip">Lewati ⏭</button>
          </div>
        </div>`;
      const render = () => {
        $('#answer', area).innerHTML = answer.length
          ? answer.map((t, k) => `<button class="wtile placed" data-k="${k}">${esc(t.text)}</button>`).join('')
          : '<span class="placeholder">Ketuk kata di bawah…</span>';
        $('#wtiles', area).innerHTML = tiles.map((t, k) => `<button class="wtile ${t.used ? 'used' : ''}" data-k="${k}" ${t.used ? 'disabled' : ''}>${esc(t.text)}</button>`).join('');
        $$('#wtiles .wtile', area).forEach((b) => b.onclick = () => {
          const t = tiles[b.dataset.k]; if (t.used || locked) return;
          sfx.tap(); t.used = true; answer.push(t); render();
          if (answer.length === tiles.length) check();
        });
        $$('#answer .wtile', area).forEach((b) => b.onclick = () => {
          if (locked) return;
          const t = answer.splice(Number(b.dataset.k), 1)[0]; t.used = false; render();
        });
      };
      const reset = () => { tiles.forEach((t) => { t.used = false; }); answer = []; render(); };
      const finishQ = (ok, pts) => {
        locked = true; session.done++; i++;
        if (ok) { session.correct++; session.points += pts; }
        $('#trans', area).innerHTML = `🇮🇩 ${esc(q.id)}`;
        updateHud(); later(next, ok ? 1600 : 2600);
      };
      const check = () => {
        if (answer.map((t) => t.text).join(' ') === q.en) {
          sfx.good(); speak(q.en);
          $('#answer', area).classList.add('ok');
          $('#msg', area).textContent = '✅ Benar sekali!';
          let pts = attempts === 0 ? 10 : 5; if (hintUsed) pts = Math.min(pts, 7);
          finishQ(true, pts);
        } else {
          attempts++; sfx.bad();
          $('#answer', area).classList.add('shake');
          setTimeout(() => $('#answer', area) && $('#answer', area).classList.remove('shake'), 500);
          if (attempts >= 2) {
            $('#msg', area).innerHTML = `❌ Jawaban yang benar:<br><b>${esc(q.en)}</b>`;
            speak(q.en); finishQ(false, 0);
          } else {
            $('#msg', area).textContent = '❌ Urutannya belum tepat, coba lagi!';
            later(reset, 700);
          }
        }
      };
      render();
      const bt = $('#b-trans', area);
      if (bt) bt.onclick = () => { hintUsed = true; session.hints++; $('#trans', area).innerHTML = `🇮🇩 ${esc(q.id)}`; };
      $('#b-say', area).onclick = () => speak(q.en);
      $('#b-clear', area).onclick = () => { if (!locked) reset(); };
      $('#b-skip', area).onclick = () => {
        if (locked) return;
        $('#msg', area).innerHTML = `⏭ Jawabannya:<br><b>${esc(q.en)}</b>`; finishQ(false, 0);
      };
    }
    next();
  };

  // ================= GAME: Word Search =================
  Runners.wordsearch = function (area, theme, level) {
    const n = LEVELS[level].count;
    const ws = E.buildWordSearch(E.wordPool(theme, level, { maxLen: E.WS_SIZE[level] }), n, level);
    const words = ws.placed;
    session.total = words.length;
    const colors = ['#ff8a80', '#82b1ff', '#b9f6ca', '#ffd180', '#ea80fc', '#a7ffeb', '#ffff8d', '#ff80ab', '#8c9eff', '#ccff90', '#ffab91', '#80d8ff', '#cfd8dc', '#f4ff81', '#b388ff'];
    const found = new Set();
    const size = ws.size;

    const clueHTML = (w, k) => {
      const isFound = found.has(k);
      let label;
      if (level === 1) label = `${picHTML(w.item, 'tiny')} ${esc(w.word)}`;
      else if (level === 2) label = esc(w.word);
      else label = isFound ? `${esc(w.word)} <small>(${esc(w.item.id)})</small>` : `${esc(w.item.id)} <small>(${w.word.length} huruf)</small>`;
      return `<li class="${isFound ? 'found' : ''}" style="${isFound ? 'background:' + colors[k % colors.length] : ''}">${label}</li>`;
    };
    area.innerHTML = `
      <p class="q-ask">${level === 3 ? 'Cari kata bahasa Inggris dari arti di bawah ini!' : 'Temukan semua kata di bawah ini!'} <small>(geser atau ketuk huruf awal lalu huruf akhir)</small></p>
      <div class="ws-wrap">
        <div class="ws-grid" id="wsgrid" style="--n:${size}">
          ${ws.grid.map((row, r) => row.map((ch, c) => `<div class="ws-cell" data-r="${r}" data-c="${c}">${ch}</div>`).join('')).join('')}
        </div>
        <ul class="ws-words" id="wswords"></ul>
      </div>
      <div class="actions">
        <button class="btn" id="b-hint">💡 Bantuan</button>
        <button class="btn btn-primary" id="b-done">Selesai ✔</button>
      </div>`;
    const renderWords = () => { $('#wswords', area).innerHTML = words.map(clueHTML).join(''); };
    renderWords();
    const grid = $('#wsgrid', area);
    const cellEl = (r, c) => grid.children[r * size + c];
    let start = null, cur = [];

    function lineCells(a, b) {
      const dr = Math.sign(b[0] - a[0]), dc = Math.sign(b[1] - a[1]);
      const lr = Math.abs(b[0] - a[0]), lc = Math.abs(b[1] - a[1]);
      if (!(lr === 0 || lc === 0 || lr === lc)) return null;
      const len = Math.max(lr, lc) + 1, out = [];
      for (let k = 0; k < len; k++) out.push([a[0] + dr * k, a[1] + dc * k]);
      return out;
    }
    function paint(cells) {
      $$('.ws-cell.sel', grid).forEach((x) => x.classList.remove('sel'));
      (cells || []).forEach(([r, c]) => cellEl(r, c).classList.add('sel'));
    }
    function cellFromEvent(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || !el.classList.contains('ws-cell')) return null;
      return [Number(el.dataset.r), Number(el.dataset.c)];
    }
    function tryWord(cells) {
      const s = cells.map(([r, c]) => ws.grid[r][c]).join('');
      const rev = s.split('').reverse().join('');
      const k = words.findIndex((w, idx) => !found.has(idx) && (w.word === s || w.word === rev) &&
        (cells.length === w.cells.length));
      if (k < 0) return false;
      found.add(k);
      const col = colors[k % colors.length];
      cells.forEach(([r, c]) => { const el = cellEl(r, c); el.classList.add('found'); el.style.background = col; });
      session.done++; session.correct++; session.points += 10;
      sfx.good(); speak(words[k].item.w); renderWords(); updateHud();
      if (found.size === words.length) later(finishGame, 900);
      return true;
    }
    let dragging = false, moved = false;
    grid.addEventListener('pointerdown', (e) => {
      const cell = cellFromEvent(e); if (!cell) return;
      e.preventDefault();
      if (start && (start[0] !== cell[0] || start[1] !== cell[1])) {
        // mode ketuk: ketukan kedua
        const cells = lineCells(start, cell);
        if (cells && tryWord(cells)) { /* ok */ } else sfx.bad();
        start = null; paint([]); return;
      }
      start = cell; cur = [cell]; dragging = true; moved = false; paint(cur);
    });
    grid.addEventListener('pointermove', (e) => {
      if (!dragging || !start) return;
      const cell = cellFromEvent(e); if (!cell) return;
      const cells = lineCells(start, cell);
      if (cells) { cur = cells; if (cells.length > 1) moved = true; paint(cur); }
    });
    const up = () => {
      if (!dragging) return; dragging = false;
      if (moved && cur.length > 1) {
        if (!tryWord(cur)) sfx.bad();
        start = null; paint([]);
      }
    };
    grid.addEventListener('pointerup', up);
    grid.addEventListener('pointercancel', up);
    document.addEventListener('pointerup', up);

    $('#b-hint', area).onclick = () => {
      const left = words.map((w, k) => k).filter((k) => !found.has(k));
      if (!left.length) return;
      const k = E.pick(left); const [r, c] = words[k].cells[0];
      session.hints++; session.points = Math.max(0, session.points - 3); updateHud();
      const el = cellEl(r, c); el.classList.add('hint');
      setTimeout(() => el.classList.remove('hint'), 2500);
      toast(`💡 Huruf pertama sebuah kata berkedip (−3 poin)`);
    };
    $('#b-done', area).onclick = async () => {
      if (found.size < words.length && !(await confirmBox(`Masih ada ${words.length - found.size} kata belum ditemukan. Selesai sekarang?`))) return;
      finishGame();
    };
  };

  // ================= GAME: TTS =================
  Runners.tts = function (area, theme, level) {
    const n = LEVELS[level].count;
    const cw = E.buildCrossword(E.wordPool(theme, level), n, { 1: 13, 2: 14, 3: 15 }[level]);
    session.total = cw.entries.length;
    const R = cw.rows, C = cw.cols;
    const solved = new Set();
    const cellWords = {}; // "r,c" -> [entryIdx]
    cw.entries.forEach((e, k) => {
      for (let i = 0; i < e.word.length; i++) {
        const r = e.r + (e.dir === 'down' ? i : 0), c = e.c + (e.dir === 'across' ? i : 0);
        (cellWords[r + ',' + c] = cellWords[r + ',' + c] || []).push(k);
      }
    });
    const cellsOf = (e) => Array.from({ length: e.word.length }, (_, i) => [e.r + (e.dir === 'down' ? i : 0), e.c + (e.dir === 'across' ? i : 0)]);
    const locked = {}; // sel huruf bantuan
    if (level === 1) cw.entries.forEach((e) => { locked[e.r + ',' + e.c] = true; });

    const clue = (e) => {
      const it = e.item;
      if (level === 3) return esc(it.id);
      return `${picHTML(it, 'tiny')} ${esc(it.id)}`;
    };
    const clueList = (dir) => cw.entries.map((e, k) => e.dir === dir
      ? `<li data-k="${k}" class="${solved.has(k) ? 'solved' : ''}"><b>${e.num}.</b> ${clue(e)} <small>(${e.word.length})</small></li>` : '').join('');

    let gridHTML = '';
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const ch = cw.grid[r][c];
        if (!ch) { gridHTML += '<div class="cw-block"></div>'; continue; }
        const num = cw.numAt[r + ',' + c];
        const pre = locked[r + ',' + c] ? ch : '';
        gridHTML += `<div class="cw-cell ${pre ? 'given' : ''}" data-r="${r}" data-c="${c}">${num ? `<span class="cw-num">${num}</span>` : ''}<input maxlength="2" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" inputmode="text" value="${pre}" ${pre ? 'readonly' : ''} aria-label="baris ${r + 1} kolom ${c + 1}"></div>`;
      }
    }
    area.innerHTML = `
      <p class="q-ask">Isi kotak dengan kata bahasa Inggris yang tepat! Ketuk kotak, lalu ketik hurufnya.</p>
      <div class="cw-layout">
        <div class="cw-grid" id="cwgrid" style="--cols:${C};--rows:${R}">${gridHTML}</div>
        <div class="cw-clues">
          <div class="cw-active" id="cwactive">Ketuk sebuah kotak untuk mulai</div>
          <h4>➡️ Mendatar</h4><ol id="cl-across"></ol>
          <h4>⬇️ Menurun</h4><ol id="cl-down"></ol>
        </div>
      </div>
      <div class="actions">
        <button class="btn" id="b-hint">💡 Bantuan Huruf</button>
        <button class="btn" id="b-check">🔎 Cek Jawaban</button>
        <button class="btn btn-primary" id="b-done">Selesai ✔</button>
      </div>`;
    const grid = $('#cwgrid', area);
    const input = (r, c) => { const el = grid.children[r * C + c]; return el ? $('input', el) : null; };
    let active = -1, dir = 'across';

    const renderClues = () => {
      $('#cl-across', area).innerHTML = clueList('across');
      $('#cl-down', area).innerHTML = clueList('down');
      $$('.cw-clues li', area).forEach((li) => {
        if (Number(li.dataset.k) === active) li.classList.add('active');
        li.onclick = () => { const e = cw.entries[li.dataset.k]; setActive(Number(li.dataset.k)); focusCell(firstEmpty(e)); };
      });
    };
    function firstEmpty(e) {
      const cells = cellsOf(e);
      return cells.find(([r, c]) => !input(r, c).value) || cells[0];
    }
    function setActive(k) {
      active = k; dir = cw.entries[k].dir;
      $$('.cw-cell.hl', grid).forEach((x) => x.classList.remove('hl'));
      cellsOf(cw.entries[k]).forEach(([r, c]) => grid.children[r * C + c].classList.add('hl'));
      const e = cw.entries[k];
      $('#cwactive', area).innerHTML = `<b>${e.num} ${e.dir === 'across' ? 'Mendatar' : 'Menurun'}:</b> ${clue(e)} <small>(${e.word.length} huruf)</small>`;
      renderClues();
    }
    function focusCell(rc) { const el = input(rc[0], rc[1]); if (el) el.focus(); }
    function wordValue(e) { return cellsOf(e).map(([r, c]) => (input(r, c).value || ' ').toUpperCase()).join(''); }
    function updateSolved(markWrong) {
      cw.entries.forEach((e, k) => {
        const v = wordValue(e);
        const cells = cellsOf(e);
        if (v === e.word) {
          if (!solved.has(k)) { solved.add(k); sfx.good(); speak(e.item.w); }
          cells.forEach(([r, c]) => grid.children[r * C + c].classList.add('ok'));
        } else {
          if (solved.has(k)) solved.delete(k);
          if (markWrong && !v.includes(' ')) cells.forEach(([r, c]) => {
            const el = grid.children[r * C + c];
            if (!el.classList.contains('ok')) { el.classList.add('bad'); setTimeout(() => el.classList.remove('bad'), 1500); }
          });
        }
      });
      // sel yang tidak lagi milik kata yang benar
      $$('.cw-cell.ok', grid).forEach((el) => {
        const ks = cellWords[el.dataset.r + ',' + el.dataset.c] || [];
        if (!ks.some((k) => solved.has(k))) el.classList.remove('ok');
      });
      session.done = solved.size; session.correct = solved.size;
      session.points = Math.max(0, solved.size * 10 - session.hints * 2);
      updateHud(); renderClues();
      if (solved.size === cw.entries.length) later(finishGame, 1000);
    }
    function move(r, c, step) {
      if (active < 0) return;
      const cells = cellsOf(cw.entries[active]);
      let idx = cells.findIndex(([rr, cc]) => rr === r && cc === c);
      for (let t = 0; t < cells.length; t++) {
        idx += step;
        if (idx < 0 || idx >= cells.length) return;
        const [nr, nc] = cells[idx];
        if (!locked[nr + ',' + nc]) { focusCell([nr, nc]); return; }
      }
    }

    $$('.cw-cell input', grid).forEach((inp) => {
      const cell = inp.parentElement, r = Number(cell.dataset.r), c = Number(cell.dataset.c);
      const ks = cellWords[r + ',' + c];
      inp.addEventListener('focus', () => {
        if (active >= 0 && ks.indexOf(active) >= 0) { setActive(active); return; }
        const same = ks.find((k) => cw.entries[k].dir === dir);
        setActive(same != null ? same : ks[0]);
      });
      inp.addEventListener('click', () => {
        if (ks.length > 1 && document.activeElement === inp && inp._clicked) {
          setActive(ks.find((k) => k !== active));
        }
        inp._clicked = true;
      });
      inp.addEventListener('blur', () => { inp._clicked = false; });
      inp.addEventListener('input', () => {
        if (locked[r + ',' + c]) return;
        const v = inp.value.replace(/[^a-zA-Z]/g, '');
        inp.value = v ? v.slice(-1).toUpperCase() : '';
        if (inp.value) { sfx.tap(); move(r, c, 1); }
        updateSolved(false);
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !inp.value) { e.preventDefault(); move(r, c, -1); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(r, c, 1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(r, c, -1); }
      });
    });
    renderClues();

    $('#b-hint', area).onclick = () => {
      let k = active;
      if (k < 0 || solved.has(k)) k = cw.entries.findIndex((e, idx) => !solved.has(idx));
      if (k < 0) return;
      const e = cw.entries[k];
      const cells = cellsOf(e).filter(([r, c]) => (input(r, c).value || '').toUpperCase() !== cw.grid[r][c]);
      if (!cells.length) return;
      const [r, c] = cells[0];
      const el = input(r, c); el.value = cw.grid[r][c]; el.readOnly = true;
      locked[r + ',' + c] = true; el.parentElement.classList.add('given');
      session.hints++; setActive(k); updateSolved(false);
      toast('💡 Satu huruf dibuka (−2 poin)');
    };
    $('#b-check', area).onclick = () => {
      updateSolved(true);
      toast(`✅ ${solved.size} dari ${cw.entries.length} kata sudah benar`);
    };
    $('#b-done', area).onclick = async () => {
      updateSolved(false);
      if (solved.size < cw.entries.length && !(await confirmBox(`Baru ${solved.size} dari ${cw.entries.length} kata benar. Selesai sekarang?`))) return;
      finishGame();
    };
  };

  // ================= hasil & lencana =================
  const BADGES = [
    { id: 'first', icon: '🎉', name: 'Langkah Pertama', desc: 'Menyelesaikan permainan pertama' },
    { id: 'star', icon: '⭐', name: 'Bintang Kelas', desc: 'Mendapat nilai minimal 80' },
    { id: 'perfect', icon: '🏅', name: 'Sempurna', desc: 'Semua jawaban benar (nilai 100)' },
    { id: 'fast', icon: '⚡', name: 'Secepat Kilat', desc: 'Menjawab dengan cepat dan nilai minimal 70' },
    { id: 'brave', icon: '💪', name: 'Pemberani', desc: 'Menyelesaikan Level 3 (Sulit)' },
    { id: 'nohint', icon: '🧠', name: 'Otak Cemerlang', desc: 'Nilai minimal 80 tanpa memakai bantuan' },
    { id: 'master', icon: '👑', name: 'Juara Bahasa Inggris', desc: 'Mendapat 3 bintang di Level 3' },
    { id: 'explorer', icon: '🧭', name: 'Penjelajah Game', desc: 'Memainkan kelima jenis permainan' },
    { id: 'rainbow', icon: '🌈', name: 'Pelangi Tema', desc: 'Bermain di 5 tema berbeda' },
    { id: 'diligent', icon: '📚', name: 'Rajin Belajar', desc: 'Menyelesaikan 10 permainan' },
    { id: 'champion', icon: '🏆', name: 'Pantang Menyerah', desc: 'Menyelesaikan 25 permainan' }
  ];
  const profileKey = () => 'efg_profile_' + state.player.name.toLowerCase() + '|' + (state.player.kelas || '');
  function getProfile() { return LS.get(profileKey(), { plays: 0, games: {}, themes: {}, badges: {}, history: [] }); }
  function bestScores() {
    if (!state.player) return {};
    const best = {};
    getProfile().history.forEach((h) => {
      const k = `${h.game}|${h.theme}|${h.level}`;
      if (!best[k] || h.stars > best[k].stars) best[k] = h;
    });
    return best;
  }

  function finishGame() {
    if (!session || session.ended) return;
    endSession();
    const s = session;
    const g = GAMES[s.game];
    const dur = Math.round((Date.now() - s.start) / 1000);
    const max = s.total * 10;
    const percent = max ? Math.round((s.points / max) * 100) : 0;
    const stars = percent >= 90 ? 3 : percent >= 70 ? 2 : percent >= 50 ? 1 : 0;
    const prof = getProfile();
    prof.plays++; prof.games[s.game] = 1; prof.themes[s.theme] = 1;
    const earned = [];
    const cond = {
      first: prof.plays >= 1,
      star: percent >= 80,
      perfect: percent >= 100,
      fast: percent >= 70 && s.total && dur / s.total <= g.fastSec,
      brave: s.level === 3,
      nohint: percent >= 80 && s.hints === 0,
      master: s.level === 3 && stars === 3,
      explorer: Object.keys(prof.games).length >= 5,
      rainbow: Object.keys(prof.themes).length >= 5,
      diligent: prof.plays >= 10,
      champion: prof.plays >= 25
    };
    const thisRound = [];
    BADGES.forEach((b) => {
      if (!cond[b.id]) return;
      if (['star', 'perfect', 'fast', 'brave', 'nohint', 'master'].indexOf(b.id) >= 0) thisRound.push(b.id);
      if (!prof.badges[b.id]) { prof.badges[b.id] = new Date().toISOString(); earned.push(b); }
    });
    const rec = {
      timestamp: new Date().toISOString(), name: state.player.name, kelas: state.player.kelas || '',
      game: s.game, gameName: g.name, theme: s.theme, themeName: themeName(s.theme), level: s.level,
      score: s.points, maxScore: max, correct: s.correct, total: s.total, percent, stars,
      duration: dur, hints: s.hints, badges: thisRound.join(',')
    };
    prof.history.unshift(rec); prof.history = prof.history.slice(0, 100);
    LS.set(profileKey(), prof);
    const all = LS.get('efg_results', []); all.unshift(rec); LS.set('efg_results', all.slice(0, 1000));

    const msg = percent >= 90 ? 'Luar biasa! 🎉' : percent >= 70 ? 'Hebat sekali! 👏' : percent >= 50 ? 'Bagus, terus berlatih! 💪' : 'Jangan menyerah, ayo coba lagi! 🌱';
    $('#result-box').innerHTML = `
      <div class="res-stars">${[1, 2, 3].map((k) => `<span class="${k <= stars ? 'on' : ''}">★</span>`).join('')}</div>
      <h2>${msg}</h2>
      <p class="res-sub">${esc(state.player.name)} · ${g.icon} ${g.name} · ${esc(themeName(s.theme))} · Level ${s.level}</p>
      <div class="res-stats">
        <div><b>${percent}</b><span>Nilai</span></div>
        <div><b>${s.points}</b><span>Poin</span></div>
        <div><b>${s.correct}/${s.total}</b><span>Benar</span></div>
        <div><b>${fmtTime(dur)}</b><span>Waktu</span></div>
      </div>
      ${earned.length ? `<div class="new-badges"><h3>🎖️ Lencana Baru!</h3>${earned.map((b) => `<div class="badge on"><span>${b.icon}</span><b>${b.name}</b><small>${b.desc}</small></div>`).join('')}</div>` : ''}
      <p class="save-status" id="save-status">⏳ Menyimpan skor…</p>
      <div class="actions wrap">
        <button class="btn btn-primary" id="r-again">🔁 Main Lagi</button>
        ${s.level < 3 ? '<button class="btn btn-success" id="r-next">⏩ Level Berikutnya</button>' : ''}
        <button class="btn" id="r-board">🏆 Papan Prestasi</button>
        <button class="btn btn-ghost" id="r-menu">🏠 Pilih Game</button>
      </div>`;
    show('result');
    if (stars >= 2) { sfx.win(); confetti(); } else if (stars === 1) sfx.good();
    $('#r-again').onclick = () => startGame();
    const nx = $('#r-next'); if (nx) nx.onclick = () => { state.level++; startGame(); };
    $('#r-board').onclick = () => openBoard('result', { game: s.game, theme: s.theme, level: s.level });
    $('#r-menu').onclick = () => renderMenu();
    saveResult(rec).then((st) => {
      const el = $('#save-status'); if (!el) return;
      el.textContent = st === 'sheet' ? '✅ Skor tersimpan ke Google Spreadsheet'
        : st === 'queued' ? '⚠️ Gagal terhubung ke spreadsheet. Skor disimpan di perangkat & akan dikirim ulang otomatis.'
        : '💾 Skor tersimpan di perangkat ini (Google Spreadsheet belum diatur).';
    });
  }

  function confetti() {
    const box = $('#confetti'); box.innerHTML = '';
    const cols = ['#ff7675', '#fdcb6e', '#55efc4', '#74b9ff', '#a29bfe', '#fd79a8'];
    for (let k = 0; k < 80; k++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = cols[k % cols.length];
      p.style.animationDelay = Math.random() * 0.8 + 's';
      p.style.animationDuration = 2 + Math.random() * 1.5 + 's';
      box.appendChild(p);
    }
    setTimeout(() => { box.innerHTML = ''; }, 4000);
  }

  // ================= Google Spreadsheet =================
  const apiUrl = () => String(LS.get('efg_api_url', '') || CFG.SHEET_API_URL || '').trim();
  async function postToSheet(rec, url) {
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(rec) });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'gagal');
  }
  async function saveResult(rec) {
    const url = apiUrl();
    if (!url) return 'local';
    try { await postToSheet(rec, url); return 'sheet'; } catch (e) {
      const q = LS.get('efg_queue', []); q.push(rec); LS.set('efg_queue', q.slice(-200));
      return 'queued';
    }
  }
  async function flushQueue() {
    const url = apiUrl(); if (!url) return;
    const q = LS.get('efg_queue', []); if (!q.length) return;
    const left = [];
    for (const rec of q) { try { await postToSheet(rec, url); } catch (e) { left.push(rec); } }
    LS.set('efg_queue', left);
    if (q.length > left.length) toast(`☁️ ${q.length - left.length} skor tertunda berhasil dikirim`);
  }

  // ================= Papan Prestasi =================
  let boardFrom = 'menu';
  function fillSelect(sel, opts, val) {
    sel.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`).join('');
  }
  function openBoard(from, filter) {
    boardFrom = from || 'menu';
    filter = filter || { game: 'all', theme: 'all', level: 'all' };
    fillSelect($('#f-game'), [['all', '🎮 Semua Game']].concat(Object.keys(GAMES).map((k) => [k, GAMES[k].icon + ' ' + GAMES[k].name])), filter.game);
    fillSelect($('#f-theme'), [['all', '📚 Semua Tema']].concat(E.ALL_THEMES.map((t) => [t.id, t.icon + ' ' + t.name])), filter.theme);
    fillSelect($('#f-level'), [['all', '📶 Semua Level'], [1, 'Level 1 · Mudah'], [2, 'Level 2 · Sedang'], [3, 'Level 3 · Sulit']], filter.level);
    switchTab('rank');
    show('board');
    loadBoard();
  }
  let boardReq = 0;
  async function loadBoard() {
    const f = { game: $('#f-game').value, theme: $('#f-theme').value, level: $('#f-level').value };
    const my = ++boardReq;
    const list = $('#board-list'), note = $('#board-note');
    list.innerHTML = '<p class="loading">⏳ Memuat peringkat…</p>';
    let rows = null, source = 'local', mode;
    const url = apiUrl();
    if (url) {
      try {
        const q = new URLSearchParams(Object.assign({ action: 'leaderboard', limit: 50 }, f));
        const res = await fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + q.toString());
        const j = await res.json();
        if (j.ok) { rows = j.rows; mode = j.mode; source = 'sheet'; }
      } catch (e) { /* jatuh ke data lokal */ }
    }
    if (my !== boardReq) return;
    if (!rows) { const ag = E.aggregate(LS.get('efg_results', []), f); rows = ag.rows; mode = ag.mode; }
    note.textContent = (source === 'sheet' ? '☁️ Data dari Google Spreadsheet' : '💾 Data dari perangkat ini' + (url ? ' (spreadsheet tidak dapat dihubungi)' : '')) +
      ' · ' + (mode === 'total' ? 'Total poin semua permainan' : 'Poin terbaik tiap pemain');
    if (!rows.length) { list.innerHTML = '<p class="empty">Belum ada skor. Ayo jadi yang pertama! 🚀</p>'; return; }
    const me = state.player ? state.player.name.toLowerCase() : '';
    const medal = ['🥇', '🥈', '🥉'];
    list.innerHTML = `<table class="board"><thead><tr><th>#</th><th>Nama</th><th>Kelas</th><th>Poin</th><th>Main</th></tr></thead><tbody>
      ${rows.slice(0, 50).map((r, k) => `<tr class="${String(r.name).toLowerCase() === me ? 'me' : ''}"><td>${medal[k] || k + 1}</td><td>${esc(r.name)}</td><td>${esc(r.kelas || '-')}</td><td><b>${esc(r.score)}</b></td><td>${esc(r.plays)}×</td></tr>`).join('')}
      </tbody></table>`;
  }
  function renderBadges() {
    const box = $('#tab-badges');
    if (!state.player) { box.innerHTML = '<p class="empty">Masukkan nama dulu untuk melihat lencanamu.</p>'; return; }
    const prof = getProfile();
    const got = BADGES.filter((b) => prof.badges[b.id]).length;
    box.innerHTML = `<p class="board-note">${esc(state.player.name)} sudah mengumpulkan <b>${got}</b> dari ${BADGES.length} lencana · ${prof.plays} permainan selesai</p>
      <div class="badges">${BADGES.map((b) => `<div class="badge ${prof.badges[b.id] ? 'on' : ''}"><span>${prof.badges[b.id] ? b.icon : '🔒'}</span><b>${b.name}</b><small>${b.desc}</small></div>`).join('')}</div>`;
  }
  function renderHistory() {
    const box = $('#tab-history');
    if (!state.player) { box.innerHTML = '<p class="empty">Masukkan nama dulu untuk melihat riwayatmu.</p>'; return; }
    const h = getProfile().history;
    if (!h.length) { box.innerHTML = '<p class="empty">Belum ada riwayat permainan.</p>'; return; }
    box.innerHTML = `<table class="board"><thead><tr><th>Game</th><th>Tema</th><th>Lv</th><th>Nilai</th><th>⭐</th></tr></thead><tbody>
      ${h.slice(0, 50).map((r) => `<tr><td>${GAMES[r.game] ? GAMES[r.game].icon : ''} ${esc(r.gameName)}</td><td>${esc(r.themeName)}</td><td>${esc(r.level)}</td><td>${esc(r.percent)}</td><td>${'⭐'.repeat(r.stars) || '-'}</td></tr>`).join('')}
      </tbody></table>`;
  }
  function switchTab(tab) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    $$('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.id !== 'tab-' + tab));
    if (tab === 'badges') renderBadges();
    if (tab === 'history') renderHistory();
  }

  // ================= pengaturan =================
  function openSettings() {
    $('#inp-api').value = apiUrl();
    $('#api-status').textContent = apiUrl() ? '' : 'Belum terhubung — skor hanya disimpan di perangkat ini.';
    $('#modal-settings').classList.remove('hidden');
  }
  async function testApi(url) {
    const st = $('#api-status');
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { st.textContent = '❌ URL harus diawali https://script.google.com/…'; return false; }
    st.textContent = '⏳ Menghubungi…';
    try {
      const res = await fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=ping');
      const j = await res.json();
      st.textContent = j.ok ? '✅ Terhubung! ' + (j.message || '') : '❌ ' + (j.error || 'Respons tidak dikenal');
      return !!j.ok;
    } catch (e) {
      st.textContent = '❌ Tidak bisa terhubung. Pastikan Web App di-deploy dengan akses "Anyone" (Siapa saja).';
      return false;
    }
  }

  // ================= mulai =================
  function init() {
    const title = CFG.APP_TITLE || 'English Fun Games';
    $('#app-title').textContent = title; document.title = title;
    if (CFG.SCHOOL_NAME) $('#school-name').textContent = '· ' + CFG.SCHOOL_NAME;
    const last = LS.get('efg_last_player', null);
    if (last) { $('#inp-name').value = last.name || ''; $('#inp-class').value = last.kelas || ''; }

    $('#form-start').onsubmit = (e) => {
      e.preventDefault();
      const name = $('#inp-name').value.replace(/\s+/g, ' ').trim();
      if (name.length < 2) { $('#start-error').textContent = 'Nama minimal 2 huruf ya 😊'; return; }
      if (!/[a-zA-Z]/.test(name)) { $('#start-error').textContent = 'Nama harus berisi huruf.'; return; }
      $('#start-error').textContent = '';
      state.player = { name: name.slice(0, 30), kelas: $('#inp-class').value };
      LS.set('efg_last_player', state.player);
      renderPlayerChip(); sfx.win();
      // aktifkan suara di iOS (butuh interaksi pengguna)
      try { if ('speechSynthesis' in window) speechSynthesis.getVoices(); } catch (err) { /* abaikan */ }
      renderMenu();
    };
    $('#btn-home').onclick = async () => {
      if (state.screen === 'game' && session && !session.ended) {
        if (!(await confirmBox('Kembali ke menu? Skor permainan ini tidak akan disimpan.'))) return;
        endSession();
      }
      renderMenu();
    };
    $('#player-chip').onclick = async () => {
      if (state.screen === 'game' && session && !session.ended) return;
      if (await confirmBox('Ganti pemain?')) { state.player = null; show('start'); }
    };
    $('#btn-sound').onclick = () => { state.sound = !state.sound; LS.set('efg_sound', state.sound); renderPlayerChip(); if (state.sound) sfx.tap(); };
    const boardBtn = async () => {
      if (state.screen === 'game' && session && !session.ended) {
        if (!(await confirmBox('Buka papan prestasi? Permainan ini akan dihentikan.'))) return;
        endSession();
      }
      openBoard(state.screen === 'board' ? boardFrom : state.screen);
    };
    $('#btn-board').onclick = boardBtn;
    $('#btn-board-start').onclick = () => openBoard('start');
    $('#btn-board-back').onclick = () => {
      if (boardFrom === 'start' || !state.player) show('start');
      else if (boardFrom === 'result') show('result');
      else if (boardFrom === 'game' || boardFrom === 'menu') renderMenu();
      else show(boardFrom);
    };
    $$('.tab').forEach((t) => t.onclick = () => switchTab(t.dataset.tab));
    ['#f-game', '#f-theme', '#f-level'].forEach((s) => $(s).onchange = loadBoard);
    $$('[data-back]').forEach((b) => b.onclick = () => {
      const to = b.dataset.back;
      if (to === 'menu') renderMenu(); else show(to);
    });
    $('#btn-quit').onclick = quitGame;

    $('#btn-settings').onclick = openSettings;
    $('#btn-api-close').onclick = () => $('#modal-settings').classList.add('hidden');
    $('#btn-api-test').onclick = () => testApi($('#inp-api').value.trim());
    $('#btn-api-save').onclick = async () => {
      const url = $('#inp-api').value.trim();
      if (!url) { LS.set('efg_api_url', ''); $('#api-status').textContent = 'URL dihapus. Skor disimpan di perangkat.'; return; }
      if (await testApi(url)) { LS.set('efg_api_url', url); toast('✅ Pengaturan disimpan'); flushQueue(); setTimeout(() => $('#modal-settings').classList.add('hidden'), 800); }
    };

    window.addEventListener('beforeunload', (e) => {
      if (state.screen === 'game' && session && !session.ended) { e.preventDefault(); e.returnValue = ''; }
    });
    window.addEventListener('online', flushQueue);
    renderPlayerChip();
    show('start');
    flushQueue();
  }

  // dipakai untuk pengujian otomatis
  window.EFG_APP = { state, get session() { return session; }, finishGame };
  init();
})();
