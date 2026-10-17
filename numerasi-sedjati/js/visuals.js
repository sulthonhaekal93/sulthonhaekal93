/*
 * VISUAL BENDA — Sedjati Numeracy Adventure
 * ---------------------------------------------------------------
 * Menggambar benda (emoji), kelompok, larik, garis bilangan, dan
 * blok nilai tempat. Juga menyediakan interaksi "Hitung Benda":
 *   enableCount     — ketuk benda satu per satu untuk menghitung
 *   enableTakeaway  — ketuk benda yang diambil (pengurangan)
 *   enableGroups    — ketuk setiap kelompok (hitung loncat)
 *   enableShare     — bagikan benda ke piring (pembagian)
 * dan guide() untuk "kita hitung bersama" saat anak perlu bantuan.
 */
(function () {
  'use strict';

  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const STEP_MS = 420;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function sizeClass(n) {
    if (n <= 5) return 'sz-xl';
    if (n <= 10) return 'sz-l';
    if (n <= 20) return 'sz-m';
    return 'sz-s';
  }

  function makeObj(emoji) {
    const s = el('span', 'obj');
    const g = el('span', 'obj-e', emoji);
    g.setAttribute('aria-hidden', 'true');
    s.appendChild(g);
    return s;
  }

  // Benda dikelompokkan per 5 agar mudah dihitung (atau per "by")
  function objRow(n, emoji, by) {
    const wrap = el('div', 'objs');
    const items = [];
    const size = by || 5;
    let chunk = null;
    for (let i = 0; i < n; i++) {
      if (i % size === 0) { chunk = el('span', by ? 'chunk basket' : 'chunk'); wrap.appendChild(chunk); }
      const o = makeObj(emoji);
      chunk.appendChild(o);
      items.push(o);
    }
    return { wrap, items };
  }

  function badge(item, n) {
    let b = item.querySelector('.obj-n');
    if (!b) { b = el('span', 'obj-n'); b.setAttribute('aria-hidden', 'true'); item.appendChild(b); }
    b.textContent = n;
    item.classList.add('counted');
  }

  function clearBadges(items) {
    items.forEach(it => { const b = it.querySelector('.obj-n'); if (b) b.remove(); it.classList.remove('counted', 'hl'); });
  }

  function makeTappable(node, label, handler) {
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-label', label);
    node.classList.add('tappable');
    const fire = e => { e.preventDefault(); handler(); };
    node.addEventListener('click', fire);
    node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
  }

  function untap(node) {
    node.removeAttribute('tabindex');
    node.setAttribute('aria-disabled', 'true');
    node.classList.remove('tappable');
  }

  /*
   * render(v) → api { el, items, groups, guide(done), destroy(), enable*() }
   */
  function render(v) {
    const root = el('div', 'vis vis-' + v.kind);
    const desc = el('p', 'sr-only');
    const api = { el: root, items: [], groups: [], timers: [], v };
    const later = (fn, ms) => { const t = setTimeout(fn, reduceMotion() ? 0 : ms); api.timers.push(t); return t; };
    api.destroy = () => { api.timers.forEach(clearTimeout); api.timers = []; };

    // Hitung bersama: beri nomor pada benda satu per satu
    function countAlong(items, done, startAt) {
      clearBadges(items);
      let i = 0;
      const stepFn = () => {
        if (i >= items.length) { if (done) done(); return; }
        const it = items[i];
        it.classList.add('hl');
        badge(it, (startAt || 0) + i + 1);
        i++;
        later(stepFn, STEP_MS);
      };
      stepFn();
    }

    const label = v.label || 'benda';

    switch (v.kind) {
      case 'objects': {
        const r = objRow(v.n, v.emoji, v.groupBy);
        root.classList.add(v.mini ? 'sz-mini' : sizeClass(v.n));
        root.appendChild(r.wrap);
        api.items = r.items;
        desc.textContent = `Gambar ${v.n} ${label}.`;
        api.guide = done => countAlong(api.items, done);
        break;
      }
      case 'join': {
        root.classList.add(sizeClass(v.a + v.b));
        const ga = el('div', 'grp'), gb = el('div', 'grp');
        const ra = objRow(v.a, v.emoji), rb = objRow(v.b, v.emoji);
        ga.appendChild(ra.wrap); ga.appendChild(el('span', 'grp-cap', String(v.a)));
        gb.appendChild(rb.wrap); gb.appendChild(el('span', 'grp-cap', String(v.b)));
        root.appendChild(ga);
        root.appendChild(el('span', 'vis-sign', '+'));
        root.appendChild(gb);
        api.items = ra.items.concat(rb.items);
        desc.textContent = `Gambar ${v.a} ${label} dan ${v.b} ${label}.`;
        api.guide = done => countAlong(api.items, done);
        break;
      }
      case 'takeaway': {
        root.classList.add(sizeClass(v.total));
        const g = el('div', 'grp');
        const r = objRow(v.total, v.emoji);
        g.appendChild(r.wrap);
        root.appendChild(g);
        api.items = r.items;
        desc.textContent = `Gambar ${v.total} ${label}, ${v.remove} di antaranya diambil.`;
        // Ambil benda dari belakang sampai jumlah yang diambil = v.remove
        const takeLast = (done) => {
          const already = api.items.filter(it => it.classList.contains('gone')).length;
          const need = Math.max(0, v.remove - already);
          const targets = api.items.filter(it => !it.classList.contains('gone')).slice(-need);
          if (!need) { if (done) done(); return; }
          let i = 0;
          const stepFn = () => {
            if (i >= targets.length) { if (done) later(done, 300); return; }
            targets[i].classList.add('gone');
            i++;
            later(stepFn, STEP_MS);
          };
          stepFn();
        };
        api.autoTakeaway = () => later(() => takeLast(), 700);
        api.guide = done => takeLast(() => countAlong(api.items.filter(it => !it.classList.contains('gone')), done));
        break;
      }
      case 'groups':
      case 'array': {
        const isArr = v.kind === 'array';
        const g = isArr ? v.rows : v.groups, each = isArr ? v.cols : v.each;
        root.classList.add(sizeClass(g * each));
        for (let i = 0; i < g; i++) {
          const grp = el('div', isArr ? 'arow' : 'plate');
          const inner = el('span', 'plate-in');
          for (let j = 0; j < each; j++) { const o = makeObj(v.emoji); inner.appendChild(o); api.items.push(o); }
          grp.appendChild(inner);
          const cap = el('span', 'grp-sum');
          grp.appendChild(cap);
          root.appendChild(grp);
          api.groups.push(grp);
        }
        desc.textContent = isArr ? `Susunan ${g} baris, setiap baris ${each}.` : `${g} kelompok, setiap kelompok berisi ${each} ${label}.`;
        api.guide = done => {
          api.groups.forEach(x => { x.classList.remove('hl'); x.querySelector('.grp-sum').textContent = ''; });
          let i = 0;
          const stepFn = () => {
            if (i >= api.groups.length) { if (done) done(); return; }
            api.groups[i].classList.add('hl');
            api.groups[i].querySelector('.grp-sum').textContent = String((i + 1) * each);
            i++;
            later(stepFn, STEP_MS + 150);
          };
          stepFn();
        };
        api.each = each;
        break;
      }
      case 'tens': {
        for (let i = 0; i < v.groups; i++) {
          const rodWrap = el('div', 'rod-wrap');
          rodWrap.appendChild(rod());
          rodWrap.appendChild(el('span', 'grp-sum'));
          root.appendChild(rodWrap);
          api.groups.push(rodWrap);
        }
        desc.textContent = `${v.groups} ikat, setiap ikat berisi 10.`;
        api.guide = done => {
          let i = 0;
          const stepFn = () => {
            if (i >= api.groups.length) { if (done) done(); return; }
            api.groups[i].classList.add('hl');
            api.groups[i].querySelector('.grp-sum').textContent = String((i + 1) * 10);
            i++;
            later(stepFn, STEP_MS);
          };
          stepFn();
        };
        break;
      }
      case 'share': {
        root.classList.add(sizeClass(v.total));
        const pile = el('div', 'pile');
        const pileIn = el('div', 'objs');
        for (let i = 0; i < v.total; i++) { const o = makeObj(v.emoji); pileIn.appendChild(o); api.items.push(o); }
        pile.appendChild(pileIn);
        const kids = el('div', 'kids');
        const plates = [];
        const kidFaces = ['🧒', '👧', '👦', '🧒🏽', '👧🏽'];
        for (let i = 0; i < v.groups; i++) {
          const k = el('div', 'kid');
          const face = el('span', 'kid-face', kidFaces[i % kidFaces.length]);
          face.setAttribute('aria-hidden', 'true');
          const plate = el('div', 'kid-plate');
          k.appendChild(face); k.appendChild(plate);
          kids.appendChild(k);
          plates.push(plate);
        }
        root.appendChild(pile);
        root.appendChild(kids);
        desc.textContent = `${v.total} ${label} akan dibagi ke ${v.groups} anak.`;
        api.plates = plates;
        let next = 0;
        api.shareOne = () => {
          const remaining = api.items.filter(it => it.parentNode === pileIn);
          if (!remaining.length) return false;
          const it = remaining[0];
          plates[next % plates.length].appendChild(it);
          it.classList.add('pop');
          next++;
          return remaining.length - 1;
        };
        api.shareAll = done => {
          const stepFn = () => {
            const left = api.shareOne();
            if (left === false || left === 0) { if (done) later(done, 200); return; }
            later(stepFn, 260);
          };
          stepFn();
        };
        api.guide = done => api.shareAll(done);
        api.pileEmpty = () => !api.items.some(it => it.parentNode === pileIn);
        break;
      }
      case 'compare': {
        root.classList.add(sizeClass(Math.max(v.a, v.b) * 2));
        const mk = (name, n) => {
          const box = el('div', 'cmp-box');
          box.appendChild(el('span', 'cmp-tag', name));
          const r = objRow(n, v.emoji);
          box.appendChild(r.wrap);
          root.appendChild(box);
          return r.items;
        };
        const ia = mk('A', v.a), ib = mk('B', v.b);
        api.items = ia.concat(ib);
        desc.textContent = `Kelompok A berisi ${v.a}, kelompok B berisi ${v.b}.`;
        api.guide = done => { clearBadges(api.items); countAlong(ia, () => countAlong(ib, done)); };
        break;
      }
      case 'numberline': {
        const line = el('div', 'nl');
        const ticks = [];
        for (let i = v.min; i <= v.max; i++) {
          const t = el('span', 'nl-tick');
          t.appendChild(el('span', 'nl-dot'));
          t.appendChild(el('span', 'nl-num', String(i)));
          if (v.marks && v.marks.includes(i)) t.classList.add('mark');
          if (v.start === i) t.classList.add('start');
          line.appendChild(t);
          ticks.push(t);
        }
        if (Number.isInteger(v.jump)) {
          const note = el('p', 'nl-note', v.jump >= 0 ? `Mulai dari ${v.start}, lompat ${v.jump} kali ke kanan ➜` : `⬅ Mulai dari ${v.start}, lompat ${-v.jump} kali ke kiri`);
          root.appendChild(note);
        }
        const scroller = el('div', 'nl-scroll');
        scroller.appendChild(line);
        root.appendChild(scroller);
        desc.textContent = `Garis bilangan dari ${v.min} sampai ${v.max}.`;
        api.guide = done => {
          if (!Number.isInteger(v.jump) || !v.jump) { ticks.forEach(t => { if (t.classList.contains('mark')) t.classList.add('hl'); }); if (done) done(); return; }
          ticks.forEach(t => t.classList.remove('hop', 'end'));
          const dir = v.jump > 0 ? 1 : -1;
          let k = 1;
          const stepFn = () => {
            if (k > Math.abs(v.jump)) { const endT = ticks[v.start + v.jump - v.min]; if (endT) endT.classList.add('end'); if (done) done(); return; }
            const t = ticks[v.start + dir * k - v.min];
            if (t) { t.classList.add('hop'); t.querySelector('.nl-dot').textContent = String(k); }
            k++;
            later(stepFn, STEP_MS);
          };
          stepFn();
        };
        break;
      }
      case 'place': {
        const mkNum = n => {
          const box = el('div', 'pv');
          const blocks = el('div', 'pv-blocks');
          const tens = Math.floor(n / 10), ones = n % 10;
          const tw = el('div', 'pv-tens');
          for (let i = 0; i < tens; i++) tw.appendChild(rod(true));
          const ow = el('div', 'pv-ones');
          for (let i = 0; i < ones; i++) ow.appendChild(el('span', 'cube'));
          blocks.appendChild(tw); blocks.appendChild(ow);
          box.appendChild(blocks);
          const cap = el('span', 'pv-cap');
          cap.textContent = `${tens} puluhan, ${ones} satuan`;
          box.appendChild(cap);
          return box;
        };
        root.appendChild(mkNum(v.a));
        root.appendChild(el('span', 'vis-sign', v.op === '+' ? '+' : '−'));
        root.appendChild(mkNum(v.b));
        desc.textContent = `Blok puluhan dan satuan untuk ${v.a} dan ${v.b}.`;
        api.guide = done => { root.classList.add('hl'); if (done) done(); };
        break;
      }
      default:
        api.guide = done => { if (done) done(); };
    }

    root.appendChild(desc);

    /* ---------- Interaksi "Hitung Benda" ---------- */
    api.enableCount = (onDone, onTick) => {
      let c = 0;
      api.items.forEach((it, i) => {
        makeTappable(it, `${label} ke-${i + 1}`, () => {
          if (it.classList.contains('counted')) return;
          c++;
          badge(it, c);
          it.classList.add('hl');
          untap(it);
          if (onTick) onTick(c);
          if (c === api.items.length && onDone) onDone(c);
        });
      });
    };

    api.enableTakeaway = (onDone, onTick) => {
      let gone = 0, finished = false;
      api.items.forEach((it, i) => {
        makeTappable(it, `ambil ${label} ke-${i + 1}`, () => {
          if (finished) return;
          if (it.classList.contains('gone')) { it.classList.remove('gone'); gone--; }
          else { it.classList.add('gone'); gone++; }
          if (onTick) onTick(gone);
          if (gone === v.remove) {
            finished = true;
            api.items.forEach(untap);
            if (onDone) onDone();
          }
        });
      });
    };

    api.enableGroups = (onDone, onTick) => {
      let k = 0;
      api.groups.forEach((g, i) => {
        makeTappable(g, `kelompok ke-${i + 1}`, () => {
          if (g.classList.contains('hl')) return;
          k++;
          g.classList.add('hl');
          g.querySelector('.grp-sum').textContent = String(k * api.each);
          untap(g);
          if (onTick) onTick(k * api.each);
          if (k === api.groups.length && onDone) onDone();
        });
      });
    };

    api.enableShare = (onDone) => {
      const bar = el('div', 'share-bar');
      const one = el('button', 'btn btn-soft', 'Bagikan 1 🤲');
      const all = el('button', 'btn btn-ghost', 'Bagikan semua');
      one.type = 'button'; all.type = 'button';
      bar.appendChild(one); bar.appendChild(all);
      root.appendChild(bar);
      let finished = false;
      const check = () => {
        if (!finished && api.pileEmpty()) { finished = true; one.disabled = true; all.disabled = true; if (onDone) onDone(); }
      };
      one.addEventListener('click', () => { api.shareOne(); check(); });
      all.addEventListener('click', () => { one.disabled = true; all.disabled = true; api.shareAll(check); });
      api.items.forEach(it => makeTappable(it, `bagikan ${label}`, () => {
        if (it.closest('.kid-plate')) return;
        api.shareOne(); check();
      }));
      api.guide = done => { one.disabled = true; all.disabled = true; api.shareAll(() => { check(); if (done) done(); }); };
    };

    return api;
  }

  function rod(small) {
    const r = el('span', small ? 'rod rod-s' : 'rod');
    for (let i = 0; i < 10; i++) r.appendChild(el('span', 'rod-c'));
    r.setAttribute('aria-hidden', 'true');
    return r;
  }

  window.SNA = window.SNA || {};
  window.SNA.Visual = { render, reduceMotion };
})();
