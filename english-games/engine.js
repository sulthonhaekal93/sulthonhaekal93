/*
 * ENGINE — logika murni (tanpa tampilan): pengambilan soal,
 * pembuat kalimat, pembuat TTS, pembuat word search, peringkat.
 */
(function (root) {
  'use strict';
  const DATA = root.EFG_DATA;

  // ---------- util ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  function article(word) {
    const w = word.toLowerCase();
    if (/^(uni|use|eu|one)/.test(w)) return 'a';
    if (/^hour/.test(w)) return 'an';
    return /^[aeiou]/.test(w) ? 'an' : 'a';
  }

  // ---------- kata ----------
  const THEMES = DATA.themes.map((t) => {
    const words = t.words.map(([w, id, p, d]) => {
      const o = { w, id, p, d, theme: t.id };
      if (t.kind === 'color') o.swatch = true;
      if (t.kind === 'number') { o.num = true; o.v = Number(p); }
      if (!p) o.nopic = true;
      return o;
    });
    return Object.assign({}, t, { words });
  });
  const THEME_BY_ID = {};
  THEMES.forEach((t) => { THEME_BY_ID[t.id] = t; });
  const ALL_THEMES = THEMES.concat([Object.assign({}, DATA.mixed, { words: [] })]);

  function themeWords(themeId) {
    if (themeId === 'mixed') return THEMES.reduce((acc, t) => acc.concat(t.words), []);
    return (THEME_BY_ID[themeId] || THEMES[0]).words;
  }

  const PREF = { 1: [1, 2, 3], 2: [2, 1, 3], 3: [3, 2, 1] };

  /**
   * Ambil kata untuk sebuah level. Kata dengan tingkat yang sesuai
   * didahulukan, lalu ditambah dari tingkat lain bila kurang.
   * opts.needPic: hanya kata yang punya gambar (dan gambar tidak kembar)
   * opts.maxLen : panjang maksimum kata
   */
  function wordPool(themeId, level, opts) {
    opts = opts || {};
    let ws = themeWords(themeId).filter((x) => /^[a-z]+$/.test(x.w));
    if (opts.needPic) ws = ws.filter((x) => !x.nopic);
    if (opts.maxLen) ws = ws.filter((x) => x.w.length <= opts.maxLen);
    const order = PREF[level] || PREF[1];
    const ranked = shuffle(ws).sort((a, b) => order.indexOf(a.d) - order.indexOf(b.d));
    // buang kata kembar (kata sama di tema berbeda / gambar sama)
    const seenW = new Set(), seenP = new Set(), out = [];
    ranked.forEach((x) => {
      if (seenW.has(x.w)) return;
      if (opts.needPic && seenP.has(x.p)) return;
      seenW.add(x.w); seenP.add(x.p); out.push(x);
    });
    return out;
  }

  // ---------- kalimat ----------
  function fillTemplate(tpl, word) {
    const t = DATA.noThe.indexOf(word.w) >= 0 ? word.w : 'the ' + word.w;
    const map = {
      '{a}': article(word.w), '{w}': word.w, '{W}': cap(word.w), '{t}': t,
      '{id}': word.id, '{Id}': cap(word.id)
    };
    return tpl.replace(/\{(a|w|W|t|id|Id)\}/g, (m) => map[m]);
  }
  function templateFits(cond, word) {
    if (!cond) return true;
    if (cond.ex && cond.ex.indexOf(word.w) >= 0) return false;
    if (cond.min != null && !(word.v >= cond.min)) return false;
    if (cond.max != null && !(word.v <= cond.max)) return false;
    return true;
  }
  function buildSentences(themeId, level, n) {
    const themes = themeId === 'mixed' ? THEMES : [THEME_BY_ID[themeId] || THEMES[0]];
    const out = [], seen = new Set(), usedWords = new Set();
    let tries = 0;
    while (out.length < n && tries < 2000) {
      tries++;
      const th = pick(themes);
      const tpls = th.sentences[level] || th.sentences[1];
      const tpl = pick(tpls);
      const pool = wordPool(th.id, level).slice(0, 18).filter((w) => templateFits(tpl[2], w));
      if (!pool.length) continue;
      let word = pick(pool);
      if (usedWords.has(word.w) && tries < 600) continue;
      const en = fillTemplate(tpl[0], word);
      if (seen.has(en)) continue;
      seen.add(en); usedWords.add(word.w);
      out.push({ en, id: fillTemplate(tpl[1], word), word, tokens: en.split(' ') });
    }
    return out;
  }

  // ---------- TTS (crossword) ----------
  /**
   * Membuat TTS dari daftar kata. Mencoba berulang kali dan mengambil
   * hasil dengan kata terbanyak (maksimum `target`).
   */
  function buildCrossword(words, target, maxSize, attempts) {
    attempts = attempts || 160;
    let best = null;
    const list = words.filter((x) => x.w.length <= maxSize);
    for (let a = 0; a < attempts; a++) {
      const res = tryCrossword(list, target, maxSize, a);
      if (!best || res.placed.length > best.placed.length ||
         (res.placed.length === best.placed.length && res.area < best.area)) best = res;
      if (best.placed.length >= target && a > 25) break;
    }
    return normalizeCrossword(best);
  }

  function tryCrossword(list, target, maxSize, attempt) {
    // kata pilihan pertama didahulukan, sedikit diacak
    const primary = shuffle(list.slice(0, target));
    const extra = shuffle(list.slice(target));
    let order = primary.concat(extra);
    // kata terpanjang di awal membantu persilangan
    if (attempt % 2 === 0) {
      const longest = primary.slice().sort((a, b) => b.w.length - a.w.length)[0];
      order = [longest].concat(order.filter((x) => x !== longest));
    }
    const cells = new Map(); // "r,c" -> {ch, dirs:Set}
    const placed = [];
    let minR = 0, maxR = 0, minC = 0, maxC = 0;
    const key = (r, c) => r + ',' + c;

    function canPlace(w, r, c, dir) {
      const dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0;
      const len = w.length;
      const nMinR = Math.min(minR, r), nMaxR = Math.max(maxR, r + dr * (len - 1));
      const nMinC = Math.min(minC, c), nMaxC = Math.max(maxC, c + dc * (len - 1));
      if (nMaxR - nMinR + 1 > maxSize || nMaxC - nMinC + 1 > maxSize) return -1;
      if (cells.has(key(r - dr, c - dc)) || cells.has(key(r + dr * len, c + dc * len))) return -1;
      let inter = 0;
      for (let i = 0; i < len; i++) {
        const rr = r + dr * i, cc = c + dc * i;
        const cell = cells.get(key(rr, cc));
        if (cell) {
          if (cell.ch !== w[i] || cell.dirs.has(dir)) return -1;
          inter++;
        } else {
          // sel baru tidak boleh menempel pada huruf di sampingnya
          if (cells.has(key(rr + dc, cc + dr)) || cells.has(key(rr - dc, cc - dr))) return -1;
        }
      }
      return inter;
    }
    function put(item, r, c, dir) {
      const w = item.w, dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0;
      for (let i = 0; i < w.length; i++) {
        const k = key(r + dr * i, c + dc * i);
        if (!cells.has(k)) cells.set(k, { ch: w[i], dirs: new Set() });
        cells.get(k).dirs.add(dir);
      }
      minR = Math.min(minR, r); maxR = Math.max(maxR, r + dr * (w.length - 1));
      minC = Math.min(minC, c); maxC = Math.max(maxC, c + dc * (w.length - 1));
      placed.push({ item, r, c, dir });
    }

    for (const item of order) {
      if (placed.length >= target) break;
      const w = item.w;
      if (!placed.length) { put(item, 0, 0, Math.random() < 0.5 ? 'across' : 'down'); continue; }
      const cands = [];
      cells.forEach((cell, k) => {
        const [r, c] = k.split(',').map(Number);
        for (let i = 0; i < w.length; i++) {
          if (w[i] !== cell.ch) continue;
          ['across', 'down'].forEach((dir) => {
            if (cell.dirs.has(dir)) return;
            const sr = dir === 'down' ? r - i : r, sc = dir === 'across' ? c - i : c;
            const inter = canPlace(w, sr, sc, dir);
            if (inter > 0) cands.push({ r: sr, c: sc, dir, inter });
          });
        }
      });
      if (!cands.length) continue;
      const maxInter = Math.max.apply(null, cands.map((x) => x.inter));
      const top = cands.filter((x) => x.inter === maxInter);
      // seimbangkan arah mendatar / menurun
      const acrossCount = placed.filter((p) => p.dir === 'across').length;
      const wantDir = acrossCount * 2 > placed.length ? 'down' : 'across';
      const pref = top.filter((x) => x.dir === wantDir);
      const ch = pick(pref.length && Math.random() < 0.7 ? pref : top);
      put(item, ch.r, ch.c, ch.dir);
    }
    return { placed, minR, minC, rows: maxR - minR + 1, cols: maxC - minC + 1, area: (maxR - minR + 1) * (maxC - minC + 1) };
  }

  function normalizeCrossword(res) {
    const grid = [];
    for (let r = 0; r < res.rows; r++) grid.push(new Array(res.cols).fill(null));
    const entries = res.placed.map((p) => ({
      item: p.item, word: p.item.w.toUpperCase(), dir: p.dir,
      r: p.r - res.minR, c: p.c - res.minC
    }));
    entries.forEach((e) => {
      for (let i = 0; i < e.word.length; i++) {
        const r = e.r + (e.dir === 'down' ? i : 0), c = e.c + (e.dir === 'across' ? i : 0);
        grid[r][c] = e.word[i];
      }
    });
    // penomoran: urut baris lalu kolom
    const starts = {};
    entries.forEach((e) => { starts[e.r + ',' + e.c] = true; });
    let n = 0;
    const numAt = {};
    for (let r = 0; r < res.rows; r++) {
      for (let c = 0; c < res.cols; c++) {
        if (starts[r + ',' + c]) numAt[r + ',' + c] = ++n;
      }
    }
    entries.forEach((e) => { e.num = numAt[e.r + ',' + e.c]; });
    entries.sort((a, b) => a.num - b.num || (a.dir === 'across' ? -1 : 1));
    return { rows: res.rows, cols: res.cols, grid, entries, numAt };
  }

  // ---------- Word Search ----------
  const WS_DIRS = {
    1: [[0, 1], [1, 0]],
    2: [[0, 1], [1, 0], [1, 1]],
    3: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]]
  };
  const WS_SIZE = { 1: 10, 2: 12, 3: 14 };

  function buildWordSearch(pool, count, level) {
    const size = WS_SIZE[level] || 10;
    const dirs = WS_DIRS[level] || WS_DIRS[1];
    let best = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const grid = [];
      for (let r = 0; r < size; r++) grid.push(new Array(size).fill(''));
      const placed = [];
      const candidates = pool.filter((x) => x.w.length <= size);
      const order = candidates.slice(0, count).sort((a, b) => b.w.length - a.w.length)
        .concat(candidates.slice(count));
      for (const item of order) {
        if (placed.length >= count) break;
        const w = item.w.toUpperCase();
        let ok = false;
        for (let t = 0; t < 200 && !ok; t++) {
          const [dr, dc] = pick(dirs);
          const r = Math.floor(Math.random() * size), c = Math.floor(Math.random() * size);
          const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
          if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
          let fits = true;
          for (let i = 0; i < w.length; i++) {
            const g = grid[r + dr * i][c + dc * i];
            if (g && g !== w[i]) { fits = false; break; }
          }
          if (!fits) continue;
          const cellsArr = [];
          for (let i = 0; i < w.length; i++) {
            grid[r + dr * i][c + dc * i] = w[i];
            cellsArr.push([r + dr * i, c + dc * i]);
          }
          placed.push({ item, word: w, cells: cellsArr });
          ok = true;
        }
      }
      if (!best || placed.length > best.placed.length) best = { grid, placed, size };
      if (placed.length >= count) break;
    }
    const letters = 'ABCDEFGHIJKLMNOPRSTUWY';
    best.grid.forEach((row) => {
      for (let c = 0; c < row.length; c++) if (!row[c]) row[c] = letters[Math.floor(Math.random() * letters.length)];
    });
    return best;
  }

  // ---------- Peringkat ----------
  /**
   * rows: [{name,kelas,game,theme,level,score,stars}]
   * Bila semua filter "all" -> total skor semua permainan per pemain.
   * Bila ada filter -> skor terbaik per pemain.
   */
  function aggregate(rows, f) {
    f = f || {};
    const game = f.game || 'all', theme = f.theme || 'all', level = String(f.level || 'all');
    const total = game === 'all' && theme === 'all' && level === 'all';
    const map = new Map();
    rows.forEach((r) => {
      if (game !== 'all' && r.game !== game) return;
      if (theme !== 'all' && r.theme !== theme) return;
      if (level !== 'all' && String(r.level) !== level) return;
      const name = String(r.name || '').trim();
      if (!name) return;
      const k = name.toLowerCase() + '|' + String(r.kelas || '');
      const cur = map.get(k) || { name, kelas: r.kelas || '', score: 0, plays: 0, stars: 0 };
      const sc = Number(r.score) || 0;
      cur.score = total ? cur.score + sc : Math.max(cur.score, sc);
      cur.plays += 1;
      cur.stars += Number(r.stars) || 0;
      map.set(k, cur);
    });
    return { mode: total ? 'total' : 'best', rows: Array.from(map.values()).sort((a, b) => b.score - a.score || b.stars - a.stars) };
  }

  root.EFG = {
    THEMES, ALL_THEMES, THEME_BY_ID, LEVELS: DATA.levels,
    shuffle, pick, cap, article, themeWords, wordPool, fillTemplate,
    buildSentences, buildCrossword, buildWordSearch, aggregate, WS_SIZE
  };
})(typeof window !== 'undefined' ? window : globalThis);
