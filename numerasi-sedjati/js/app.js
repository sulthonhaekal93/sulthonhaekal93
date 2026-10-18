/*
 * APLIKASI — Sedjati Numeracy Adventure
 * ---------------------------------------------------------------
 * Mengatur layar, alur misi (tujuan → konsep → contoh → soal →
 * umpan balik → ringkasan → rekomendasi), tes awal/akhir,
 * dasbor progres, dan pengaturan.
 */
(function () {
  'use strict';

  const SNA = window.SNA;
  const C = SNA.Curriculum, G = SNA.Gen, P = SNA.Progress, V = SNA.Visual;

  /* ---------- Bantuan DOM ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const pct = v => (v == null ? '–' : Math.round(v * 100) + '%');
  const starsHtml = (n, max = 3) => Array.from({ length: max }, (_, i) =>
    `<span class="st ${i < n ? 'on' : ''}" aria-hidden="true">★</span>`).join('') + `<span class="sr-only">${n} dari ${max} bintang</span>`;
  const fmtDate = t => {
    try { return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  };

  /* ---------- Data ---------- */
  const storage = P.createStorage(() => window.localStorage);
  const loaded = storage.load();
  let store = loaded.store;
  const player = () => store.players[store.currentId] || null;

  /* ---------- Google Spreadsheet (opsional) ---------- */
  const sheetUrl = () => String(store.settings.sheetUrl || (window.SNA_CONFIG && window.SNA_CONFIG.SHEET_API_URL) || '').trim();
  const Sheet = SNA.Sheet.createSender({
    getUrl: sheetUrl,
    storage: storage.available ? (() => { try { return window.localStorage; } catch (e) { return null; } })() : null,
    fetch: (u, o) => window.fetch(u, o)
  });
  // Kirim hasil misi/tes; tampilkan statusnya di layar ringkasan
  function report(info) {
    const p = player();
    if (!p || !window.fetch) return;
    const el = $('#syncNote');
    if (!SNA.Sheet.validUrl(sheetUrl())) { if (el) el.textContent = '💾 Tersimpan di perangkat ini.'; return; }
    if (el) el.textContent = '☁️ Mengirim ke spreadsheet guru…';
    Sheet.send(SNA.Sheet.buildRecord(p, store.settings, info)).then(st => {
      const e2 = $('#syncNote');
      if (!e2) return;
      e2.textContent = st === 'sheet' ? '✅ Tersimpan di perangkat & spreadsheet guru.'
        : '💾 Tersimpan di perangkat. Akan dikirim ke spreadsheet saat internet tersambung.';
    }).catch(() => { /* abaikan */ });
  }
  async function flushSheet() {
    const n = await Sheet.flush().catch(() => 0);
    if (n) toast(`☁️ ${n} hasil tertunda berhasil dikirim ke spreadsheet.`);
  }
  window.addEventListener('online', flushSheet);
  function save() {
    if (!storage.available) return;
    if (!storage.save(store)) toast('Progres belum bisa disimpan. Memori perangkat mungkin penuh.');
  }

  function showStorageNote() {
    const n = $('#storageNote');
    if (loaded.status === 'unavailable') {
      n.textContent = 'Penyimpanan perangkat tidak tersedia (mungkin mode penyamaran). Permainan tetap bisa dimainkan, tetapi progres hilang saat halaman ditutup.';
      n.hidden = false;
    } else if (loaded.status === 'corrupt') {
      n.textContent = 'Data progres lama tidak bisa dibaca, jadi permainan dimulai dari awal. Data lama disimpan sebagai cadangan.';
      n.hidden = false;
    }
  }

  /* ---------- Suara: ucapan (id-ID) & efek lembut ---------- */
  const Speech = {
    voice: null,
    init() {
      if (!('speechSynthesis' in window)) return;
      const pickVoice = () => {
        try {
          const vs = window.speechSynthesis.getVoices();
          this.voice = vs.find(v => /^id([-_]|$)/i.test(v.lang)) || null;
        } catch (e) { /* abaikan */ }
      };
      pickVoice();
      try { window.speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) { /* abaikan */ }
    },
    speak(text) {
      if (!store.settings.sound || !('speechSynthesis' in window) || !text) return;
      try {
        window.speechSynthesis.cancel();
        const clean = String(text).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]/gu, '').replace(/×/g, ' kali ').replace(/÷/g, ' dibagi ').replace(/−/g, ' kurang ').replace(/\+/g, ' tambah ').replace(/=/g, ' sama dengan ').replace(/\?/g, ' berapa ');
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = 'id-ID'; u.rate = 0.92; u.pitch = 1.05;
        if (this.voice) u.voice = this.voice;
        window.speechSynthesis.speak(u);
      } catch (e) { /* abaikan */ }
    },
    stop() { try { window.speechSynthesis.cancel(); } catch (e) { /* abaikan */ } }
  };

  const Sfx = {
    ctx: null,
    tone(freqs, dur) {
      if (!store.settings.sound) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = this.ctx || new AC();
        const t0 = this.ctx.currentTime;
        freqs.forEach((f, i) => {
          const o = this.ctx.createOscillator(), g = this.ctx.createGain();
          o.type = 'sine'; o.frequency.value = f;
          const s = t0 + i * dur;
          g.gain.setValueAtTime(0.0001, s);
          g.gain.exponentialRampToValueAtTime(0.12, s + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
          o.connect(g); g.connect(this.ctx.destination);
          o.start(s); o.stop(s + dur + 0.02);
        });
      } catch (e) { /* abaikan */ }
    },
    good() { this.tone([660, 880], 0.14); },
    soft() { this.tone([440], 0.18); },
    win() { this.tone([523, 659, 784, 1047], 0.13); }
  };

  /* ---------- Toast & dialog konfirmasi ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  function confirmBox(opts) {
    return new Promise(resolve => {
      const m = $('#modal');
      $('#modalTitle').textContent = opts.title;
      $('#modalText').textContent = opts.text;
      const ok = $('#modalOk'), cancel = $('#modalCancel');
      ok.textContent = opts.ok || 'Ya';
      ok.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
      cancel.textContent = opts.cancel || 'Batal';
      const prevFocus = document.activeElement;
      m.hidden = false;
      cancel.focus();
      const close = val => {
        m.hidden = true;
        ok.removeEventListener('click', onOk); cancel.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKey);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        resolve(val);
      };
      const onOk = () => close(true), onCancel = () => close(false);
      const onKey = e => {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Tab') { // jaga fokus di dalam dialog
          const f = [cancel, ok];
          const i = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
      };
      ok.addEventListener('click', onOk); cancel.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKey);
    });
  }

  /* ---------- Navigasi layar ---------- */
  let current = 'home';
  const routeArgs = {};
  let activeVisual = null;

  function show(id, opts) {
    opts = opts || {};
    if (current === 'play' && id !== 'play') endTimers();
    Speech.stop();
    $$('.screen').forEach(s => { s.hidden = s.id !== 'screen-' + id; });
    current = id;
    document.body.dataset.screen = id;
    updateTopbar();
    window.scrollTo(0, 0);
    const h = $('#screen-' + id + ' h1');
    if (h && !opts.noFocus) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    if (opts.push !== false) {
      try { history.pushState({ screen: id }, '', '#' + id); } catch (e) { /* abaikan */ }
    }
  }

  // Tombol "kembali" di HP: arahkan ke layar yang aman
  window.addEventListener('popstate', e => {
    const target = (e.state && e.state.screen) || 'home';
    const safe = ['home', 'map', 'progress', 'guide', 'profile'];
    if (current === 'play' || current === 'intro' || current === 'summary') { S = null; endTimers(); goMap(false); return; }
    if (target === 'area' && routeArgs.area) { renderArea(routeArgs.area, false); return; }
    if (!safe.includes(target)) { goMap(false); return; }
    if (target === 'home') { renderHome(); show('home', { push: false }); return; }
    if (!player() && target !== 'guide') { renderHome(); show('home', { push: false }); return; }
    if (target === 'map') goMap(false);
    else if (target === 'progress') renderProgress(routeArgs.progressTab || 'child', false);
    else if (target === 'guide') renderGuide(false);
    else renderProfile('select', false);
  });

  function updateTopbar() {
    const p = player();
    const chip = $('#playerChip');
    if (p) {
      chip.hidden = false;
      $('#chipName').textContent = p.name;
      $('#chipStars').textContent = P.totalStars(p);
    } else chip.hidden = true;
    const on = store.settings.sound;
    const sb = $('#soundBtn');
    sb.setAttribute('aria-pressed', String(on));
    sb.setAttribute('aria-label', on ? 'Suara aktif. Ketuk untuk mematikan.' : 'Suara mati. Ketuk untuk menyalakan.');
    $('#soundIcon').textContent = on ? '🔊' : '🔈';
    document.body.classList.toggle('mode-tk', !!(p && p.mode === 'tk'));
  }

  let pendingAfterProfile = null;
  function requirePlayer(next) {
    if (player()) { next(); return; }
    pendingAfterProfile = next;
    renderProfile(Object.keys(store.players).length ? 'select' : 'create');
  }

  /* ================= BERANDA ================= */
  function renderHome() {
    const p = player();
    const wb = $('#welcomeBack');
    if (p) { wb.hidden = false; wb.textContent = `Selamat datang kembali, ${p.name}! 👋`; }
    else wb.hidden = true;
  }

  /* ================= PROFIL PEMAIN ================= */
  function renderProfile(view, push) {
    const sec = $('#screen-profile');
    const players = Object.values(store.players).sort((a, b) => b.createdAt - a.createdAt);
    if (view === 'select' && players.length) {
      sec.innerHTML = `
        <div class="screen-head"><button class="back" type="button" data-go="home">← Beranda</button></div>
        <h1>Siapa yang bermain?</h1>
        <p class="lead">Pilih namamu, atau buat pemain baru.</p>
        <ul class="player-list">
          ${players.map(p => `
            <li><button class="player-btn ${p.id === store.currentId ? 'is-current' : ''}" type="button" data-pick="${esc(p.id)}">
              <span class="pb-avatar" aria-hidden="true">${esc(p.name.slice(0, 1).toUpperCase())}</span>
              <span class="pb-text"><b class="pb-name">${esc(p.name)}</b><small>${esc(groupName(p.group))} · ${esc(C.MODES[p.mode].name)} · ⭐ ${P.totalStars(p)}</small></span>
            </button></li>`).join('')}
        </ul>
        <div class="btn-row">
          <button class="btn btn-primary" type="button" data-new>➕ Pemain baru</button>
          <button class="btn btn-ghost" type="button" data-guest>Main sebagai Tamu</button>
        </div>`;
      $$('[data-pick]', sec).forEach(b => b.addEventListener('click', () => {
        store.currentId = b.dataset.pick; save(); afterProfile();
      }));
      $('[data-new]', sec).addEventListener('click', () => renderProfile('create'));
      $('[data-guest]', sec).addEventListener('click', createGuest);
      show('profile', { push });
      return;
    }

    const editing = view === 'edit' && player();
    const p = editing ? player() : null;
    const g0 = p ? p.group : 'sd12';
    const m0 = p ? p.mode : C.GROUPS.find(g => g.id === g0).mode;
    const a0 = p ? p.answerStyle : 'mix';
    sec.innerHTML = `
      <div class="screen-head"><button class="back" type="button" ${editing ? 'data-go="progress"' : (players.length ? 'data-view="select"' : 'data-go="home"')}>← Kembali</button></div>
      <h1>${editing ? 'Ubah profil' : 'Kenalan dulu, yuk!'}</h1>
      <p class="lead">${editing ? 'Ubah mode belajar kapan saja sesuai kemampuan anak.' : 'Cukup nama panggilan saja. Tidak perlu mendaftar.'}</p>
      <form class="card form" id="profileForm" novalidate>
        <label class="field">
          <span class="field-label">Nama panggilan</span>
          <input type="text" name="name" maxlength="20" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Contoh: Dinda" value="${p ? esc(p.name) : ''}">
          <small class="field-help">Boleh dikosongkan. Jangan isi nama lengkap atau data pribadi.</small>
        </label>
        <fieldset class="field">
          <legend class="field-label">Kelompok belajar</legend>
          <div class="seg seg-4">
            ${C.GROUPS.map(g => `<label class="seg-opt"><input type="radio" name="group" value="${g.id}" ${g.id === g0 ? 'checked' : ''}><span>${esc(g.name)}</span></label>`).join('')}
          </div>
        </fieldset>
        <fieldset class="field">
          <legend class="field-label">Mode belajar</legend>
          <div class="mode-list">
            ${Object.values(C.MODES).map(m => `<label class="mode-opt"><input type="radio" name="mode" value="${m.id}" ${m.id === m0 ? 'checked' : ''}><span><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></span></label>`).join('')}
          </div>
          <small class="field-help">Mode menyesuaikan kelompok, tetapi boleh diubah. Level dipilih berdasarkan kemampuan, bukan hanya kelas.</small>
        </fieldset>
        <fieldset class="field" id="answerField">
          <legend class="field-label">Cara menjawab</legend>
          <div class="seg seg-3">
            <label class="seg-opt"><input type="radio" name="answer" value="mix" ${a0 === 'mix' ? 'checked' : ''}><span>Campur</span></label>
            <label class="seg-opt"><input type="radio" name="answer" value="choice" ${a0 === 'choice' ? 'checked' : ''}><span>Pilih jawaban</span></label>
            <label class="seg-opt"><input type="radio" name="answer" value="type" ${a0 === 'type' ? 'checked' : ''}><span>Ketik angka</span></label>
          </div>
        </fieldset>
        <label class="check" id="timedField">
          <input type="checkbox" name="timed" ${p && p.timed ? 'checked' : ''}>
          <span><b>Tantangan waktu (opsional)</b><small>Ada penghitung 30 detik per soal. Tidak ada hukuman jika waktu habis.</small></span>
        </label>
        <div class="btn-row">
          <button class="btn btn-primary btn-lg" type="submit">${editing ? 'Simpan perubahan' : 'Simpan & lanjut'}</button>
          ${editing ? '' : '<button class="btn btn-ghost" type="button" data-guest>Main sebagai Tamu</button>'}
        </div>
      </form>
      ${editing ? '<div class="danger-zone"><button class="btn btn-danger-ghost" type="button" data-delete>Hapus pemain ini</button></div>' : ''}`;

    const form = $('#profileForm', sec);
    const F = form.elements; // pakai elements: form.name adalah atribut form, bukan input
    let modeTouched = editing;
    const syncFields = () => {
      const mode = F.mode.value;
      $('#timedField', sec).hidden = mode !== 'challenge';
      $('#answerField', sec).hidden = mode === 'tk';
    };
    $$('input[name="group"]', form).forEach(r => r.addEventListener('change', () => {
      if (!modeTouched) {
        const m = C.GROUPS.find(g => g.id === F.group.value).mode;
        const target = $(`input[name="mode"][value="${m}"]`, form);
        if (target) target.checked = true;
      }
      syncFields();
    }));
    $$('input[name="mode"]', form).forEach(r => r.addEventListener('change', () => { modeTouched = true; syncFields(); }));
    syncFields();
    const back = $('[data-view="select"]', sec);
    if (back) back.addEventListener('click', () => renderProfile('select'));
    const guest = $('[data-guest]', sec);
    if (guest) guest.addEventListener('click', createGuest);
    const del = $('[data-delete]', sec);
    if (del) del.addEventListener('click', async () => {
      const okDel = await confirmBox({ title: 'Hapus pemain?', text: `Semua progres ${p.name} di perangkat ini akan dihapus dan tidak bisa dikembalikan.`, ok: 'Ya, hapus', danger: true });
      if (!okDel) return;
      delete store.players[p.id];
      store.currentId = null; save();
      toast('Pemain sudah dihapus.');
      renderHome(); show('home');
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const info = {
        name: F.namedItem('name').value, group: F.group.value, mode: F.mode.value,
        answerStyle: F.answer.value, timed: F.timed.checked
      };
      if (editing) {
        p.name = P.sanitizeName(info.name);
        p.group = C.GROUPS.some(g => g.id === info.group) ? info.group : p.group;
        p.mode = C.MODES[info.mode] ? info.mode : p.mode;
        p.answerStyle = ['mix', 'choice', 'type'].includes(info.answerStyle) ? info.answerStyle : 'mix';
        p.timed = info.timed && p.mode === 'challenge';
        save(); toast('Profil tersimpan.');
        renderProgress('child');
        return;
      }
      if (Object.keys(store.players).length >= 40) { toast('Sudah ada 40 pemain. Hapus pemain lama di Panduan.'); return; }
      const np = P.newPlayer(info);
      store.players[np.id] = np; store.currentId = np.id; save();
      renderWelcome(np);
    });
    show('profile', { push });
  }

  function createGuest() {
    const np = P.newPlayer({ name: 'Tamu', group: 'sd12' });
    store.players[np.id] = np; store.currentId = np.id; save();
    renderWelcome(np);
  }

  function renderWelcome(p) {
    const sec = $('#screen-profile');
    sec.innerHTML = `
      <div class="welcome card">
        <div class="big-emoji" aria-hidden="true">🎒</div>
        <h1>Halo, <span class="name-wrap">${esc(p.name)}</span>!</h1>
        <p class="lead">Mau ikut <b>Tes Awal</b> singkat? Ada ${P.diagnosticPlan(p.mode).length * 2} soal tanpa waktu, untuk mencari misi yang paling cocok. Tidak ada nilai salah di sini.</p>
        <div class="btn-col">
          <button class="btn btn-primary btn-lg" type="button" data-diag>Ikut Tes Awal 📝</button>
          <button class="btn btn-ghost btn-lg" type="button" data-skip>Langsung ke Peta 🗺️</button>
        </div>
      </div>`;
    $('[data-diag]', sec).addEventListener('click', () => startDiagnostic());
    $('[data-skip]', sec).addEventListener('click', afterProfile);
    show('profile');
  }

  function afterProfile() {
    const next = pendingAfterProfile;
    pendingAfterProfile = null;
    if (next) next(); else goMap();
  }

  const groupName = id => (C.GROUPS.find(g => g.id === id) || C.GROUPS[1]).name;

  /* ================= PETA BELAJAR ================= */
  function goMap(push) {
    if (!player()) { renderHome(); show('home', { push }); return; }
    renderMap(push);
  }

  function stepLabel(area, step) {
    const a = C.AREA_BY_ID[area];
    return `${a.name} · Misi ${step + 1}: ${a.steps[step].title}`;
  }

  function renderMap(push) {
    const p = player();
    const rec = P.recommend(p, store.settings);
    const sec = $('#screen-map');
    const recHtml = rec ? (() => {
      const a = C.AREA_BY_ID[rec.area], s = a.steps[rec.step];
      return `
        <div class="rec card">
          <span class="rec-ic" aria-hidden="true">${a.icon}</span>
          <div class="rec-body">
            <p class="eyebrow">Misi untukmu</p>
            <h2>${esc(s.mission)}</h2>
            <p class="muted">${esc(a.name)} · ${esc(s.title)}</p>
            <p class="rec-why">${esc(rec.reason)}</p>
          </div>
          <button class="btn btn-primary" type="button" data-rec>Ayo main! ▶</button>
        </div>`;
    })() : `<div class="rec card"><span class="rec-ic" aria-hidden="true">🏆</span><div class="rec-body"><h2>Semua misi sudah selesai!</h2><p class="rec-why">Hebat sekali! Coba Tes Akhir di setiap level, atau ulangi misi favoritmu.</p></div></div>`;

    sec.innerHTML = `
      <div class="map-head">
        <div class="mh-text">
          <h1>Halo, <span class="name-wrap">${esc(p.name)}</span>! <span aria-hidden="true">👋</span></h1>
          <p class="muted">${esc(C.MODES[p.mode].name)} · ⭐ ${P.totalStars(p)} bintang · ${P.completedCount(p)} misi selesai</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-switch>Ganti pemain</button>
      </div>
      ${recHtml}
      ${p.assess.initial ? '' : `<button class="card diag-card" type="button" data-diag><span aria-hidden="true">📝</span><span><b>Tes Awal (opsional)</b><small>Bantu kami memilih misi yang pas untukmu.</small></span><span class="chev" aria-hidden="true">›</span></button>`}
      <h2 class="section-title">Peta Petualangan</h2>
      <ol class="trail">
        ${C.AREAS.map(a => {
          const pr = P.areaProgress(p, a.id);
          const isRec = rec && rec.area === a.id;
          const explore = p.mode === 'tk' && a.tkOptional;
          const allDone = pr.done === pr.total;
          return `<li class="stop ${isRec ? 'is-rec' : ''}">
            <button class="stop-btn" type="button" data-area="${a.id}">
              <span class="stop-ic" aria-hidden="true">${a.icon}</span>
              <span class="stop-text">
                <small class="stop-level">Level ${a.level}${explore ? ' · Eksplorasi' : ''}</small>
                <b>${esc(a.name)}</b>
                <small class="muted">${esc(a.skill)}</small>
                <span class="bar" aria-hidden="true"><span style="width:${Math.round(pr.done / pr.total * 100)}%"></span></span>
                <small class="stop-meta">${pr.done}/${pr.total} misi · ⭐ ${pr.stars}/${pr.maxStars}</small>
              </span>
              ${isRec ? '<span class="tag tag-rec">Disarankan</span>' : allDone ? '<span class="tag tag-done">Selesai ✓</span>' : ''}
            </button>
          </li>`;
        }).join('')}
      </ol>`;
    const recBtn = $('[data-rec]', sec);
    if (recBtn) recBtn.addEventListener('click', () => renderIntro(rec.area, rec.step));
    const diag = $('[data-diag]', sec);
    if (diag) diag.addEventListener('click', () => startDiagnostic());
    $('[data-switch]', sec).addEventListener('click', () => renderProfile('select'));
    $$('[data-area]', sec).forEach(b => b.addEventListener('click', () => renderArea(b.dataset.area)));
    show('map', { push });
  }

  /* ================= AREA (DAFTAR MISI) ================= */
  function renderArea(areaId, push) {
    const p = player();
    if (!p || !C.AREA_BY_ID[areaId]) { goMap(); return; }
    routeArgs.area = areaId;
    const a = C.AREA_BY_ID[areaId];
    const rec = P.recommend(p, store.settings);
    const sec = $('#screen-area');
    const fin = p.assess.final[areaId];
    sec.innerHTML = `
      <div class="screen-head"><button class="back" type="button" data-go="map">← Peta</button></div>
      <div class="area-head">
        <span class="area-ic" aria-hidden="true">${a.icon}</span>
        <div><p class="eyebrow">Level ${a.level}${p.mode === 'tk' && a.tkOptional ? ' · Eksplorasi (opsional)' : ''}</p><h1>${esc(a.name)}</h1><p class="muted">${esc(a.blurb)}</p></div>
      </div>
      <ol class="missions">
        ${a.steps.map((s, i) => {
          const m = P.mission(p, areaId, i);
          const avail = P.isAvailable(p, store.settings, areaId, i);
          const isRec = rec && rec.area === areaId && rec.step === i;
          const status = m && m.completed ? 'Selesai' : isRec ? 'Disarankan' : avail ? (m ? 'Coba lagi' : 'Terbuka') : 'Terkunci';
          const inner = `
            <span class="ms-num" aria-hidden="true">${avail ? i + 1 : '🔒'}</span>
            <span class="ms-text">
              <b>${esc(s.title)}</b>
              <small>${esc(s.mission)}</small>
              ${s.tag ? `<small class="ms-tag">${esc(s.tag)}</small>` : ''}
              ${!avail ? '<small class="muted">Selesaikan misi sebelumnya untuk membuka.</small>' : ''}
            </span>
            <span class="ms-side">
              <span class="ms-stars">${starsHtml(m ? m.stars : 0)}</span>
              <span class="tag ${m && m.completed ? 'tag-done' : isRec ? 'tag-rec' : avail ? 'tag-open' : 'tag-lock'}">${status}</span>
            </span>`;
          return `<li class="ms ${avail ? '' : 'is-locked'} ${isRec ? 'is-rec' : ''}">${avail
            ? `<button class="ms-btn" type="button" data-step="${i}" aria-label="Misi ${i + 1}: ${esc(s.title)}. ${status}.">${inner}</button>`
            : `<div class="ms-btn" aria-label="Misi ${i + 1}: ${esc(s.title)}. Terkunci.">${inner}</div>`}</li>`;
        }).join('')}
      </ol>
      <div class="card final-card">
        <h2>📋 Tes Akhir Level</h2>
        ${fin ? `<p>Hasil terakhir: <b>${fin.correct} dari ${fin.total}</b> benar (${fmtDate(fin.t)}).</p>` : ''}
        ${P.canFinal(p, areaId)
          ? `<p class="muted">6 soal baru yang mirip dengan misi yang sudah kamu selesaikan. Tanpa waktu.</p><button class="btn btn-soft" type="button" data-final>Mulai Tes Akhir</button>`
          : '<p class="muted">Selesaikan 2 misi di level ini untuk membuka Tes Akhir.</p>'}
      </div>`;
    $$('[data-step]', sec).forEach(b => b.addEventListener('click', () => renderIntro(areaId, Number(b.dataset.step))));
    const fb = $('[data-final]', sec);
    if (fb) fb.addEventListener('click', () => startFinal(areaId));
    show('area', { push });
  }

  /* ================= PENGANTAR MISI ================= */
  function renderIntro(areaId, step) {
    const p = player();
    if (!p) { goMap(); return; }
    const a = C.AREA_BY_ID[areaId], s = a.steps[step];
    const ctx = G.makeCtx(p.mode);
    const ex = G.generate(areaId, step, ctx);
    const sec = $('#screen-intro');
    const n = C.MODES[p.mode].questions;
    sec.innerHTML = `
      <div class="screen-head"><button class="back" type="button" data-back-area>← ${esc(a.name)}</button></div>
      <p class="eyebrow">Level ${a.level} · ${esc(a.name)} · Misi ${step + 1}</p>
      <h1>${esc(s.mission)}</h1>
      <div class="card goal">
        <p class="goal-label">🎯 Tujuan belajar</p>
        <p>${esc(s.goal)}</p>
      </div>
      <div class="card concept">
        <div class="concept-row">
          <p class="concept-text">💡 ${esc(s.concept)}</p>
          <button class="icon-btn icon-soft" type="button" data-speak aria-label="Dengarkan penjelasan"><span aria-hidden="true">🔊</span></button>
        </div>
      </div>
      <div class="card example">
        <p class="goal-label">👀 Contoh</p>
        <p class="ex-prompt">${esc(ex.prompt)}</p>
        <div class="ex-visual"></div>
        ${ex.equation ? `<p class="equation eq-sm">${esc(ex.equation).replace('?', `<b class="eq-ans">${esc(ex.answer)}</b>`).replace('☐', `<b class="eq-ans">${esc(ex.answer)}</b>`)}</p>` : `<p class="equation eq-sm">Jawaban: <b class="eq-ans">${esc(ex.answer)}</b></p>`}
        <ol class="steps">${ex.explain.map(l => `<li>${esc(l)}</li>`).join('')}</ol>
        ${ex.visual ? '<button class="btn btn-ghost btn-sm" type="button" data-replay>↻ Lihat lagi</button>' : ''}
      </div>
      <div class="start-row">
        <button class="btn btn-primary btn-xl" type="button" data-start>Mulai Misi ▶</button>
        <p class="muted">${n} soal · ${p.timed ? 'dengan penghitung waktu (tanpa hukuman)' : 'tanpa batas waktu'}</p>
      </div>`;
    let vis = null;
    const box = $('.ex-visual', sec);
    const drawExample = () => {
      if (vis) vis.destroy();
      box.innerHTML = '';
      if (!ex.visual) return;
      vis = V.render(ex.visual);
      box.appendChild(vis.el);
      setTimeout(() => vis.guide && vis.guide(), 400);
    };
    drawExample();
    activeVisual = vis;
    const rp = $('[data-replay]', sec);
    if (rp) rp.addEventListener('click', drawExample);
    $('[data-speak]', sec).addEventListener('click', () => Speech.speak(s.goal + '. ' + s.concept));
    $('[data-back-area]', sec).addEventListener('click', () => renderArea(areaId));
    $('[data-start]', sec).addEventListener('click', () => { if (vis) vis.destroy(); startMission(areaId, step, ex.key); });
    show('intro');
    if (store.settings.autoRead && p.mode === 'tk') Speech.speak(s.mission + '. ' + s.goal);
  }

  /* ================= SESI BERMAIN ================= */
  let S = null;              // sesi aktif
  const sitting = { start: Date.now(), missions: 0 };
  let timerInt = null;

  function endTimers() { if (timerInt) { clearInterval(timerInt); timerInt = null; } if (activeVisual) { activeVisual.destroy(); } }

  function baseSession(kind, extra) {
    const p = player();
    return Object.assign({
      kind, ctx: G.makeCtx(p.mode), seen: new Set(), results: [], index: 0,
      streakRight: 0, streakWrong: 0, ease: 0, note: '', similar: false, bonusCount: 0, cur: null
    }, extra);
  }

  function startMission(area, step, exampleKey) {
    const p = player();
    S = baseSession('mission', { area, step, total: C.MODES[p.mode].questions });
    if (exampleKey) S.seen.add(exampleKey);
    nextQuestion();
  }

  function startReview() {
    const p = player();
    const steps = P.reviewSteps(p);
    if (!steps.length) { toast('Belum ada soal sulit untuk diulang. Hebat!'); return; }
    S = baseSession('review', { area: steps[0].area, step: steps[0].step, reviewSteps: steps, total: 5 });
    nextQuestion();
  }

  function startDiagnostic() {
    const p = player();
    const plan = P.diagnosticPlan(p.mode);
    S = baseSession('diagnostic', {
      plan, areaIdx: 0, qInArea: 0,
      diag: plan.map(x => ({ area: x.area, probe: x.probe, answers: [] })),
      total: plan.length * 2
    });
    nextQuestion();
  }

  function startFinal(area) {
    const p = player();
    const plan = P.finalPlan(p, area);
    if (!plan.length) { toast('Selesaikan 2 misi dulu, ya.'); return; }
    // hindari soal yang baru saja dikerjakan saat latihan
    const avoid = new Set(p.history.map(h => h.key).filter(Boolean));
    S = baseSession('final', { area, plan, answers: [], total: plan.length, seen: avoid });
    nextQuestion();
  }

  const isAssessment = () => S && (S.kind === 'diagnostic' || S.kind === 'final');

  /* Pilih soal berikutnya sesuai jenis sesi & adaptasi */
  function nextQuestion(bonus) {
    endTimers();
    const p = player();
    let area = S.area, step = S.step, tag = '';
    if (S.kind === 'diagnostic') {
      const d = S.diag[S.areaIdx];
      area = d.area;
      step = S.qInArea === 0 ? d.probe : P.diagnosticNextStep(d.area, d.probe, d.answers[0].ok);
    } else if (S.kind === 'final') {
      step = S.plan[S.index];
    } else if (S.kind === 'review') {
      const r = S.reviewSteps[S.index % S.reviewSteps.length];
      area = r.area; step = r.step;
    } else if (bonus) {
      step = Math.min(S.step + 1, G.stepCount(area) - 1);
      tag = '⭐ Soal Tantangan (tidak mengurangi nilai)';
    } else if (S.ease < 0) {
      step = Math.max(0, S.step - 1);
    }
    if (!bonus && S.note) { tag = S.note; S.note = ''; }
    else if (!bonus && S.similar) tag = 'Soal mirip — ayo coba lagi!';
    S.similar = false;

    const q = G.generate(area, step, S.ctx, S.seen);
    S.seen.add(q.key);
    S.cur = { q, attempts: 0, bonus: !!bonus, tag, wrong: new Set(), done: false, interaction: pickInteraction(q, p) };
    renderPlay();
  }

  /* Tiga jenis interaksi: pilih jawaban, hitung benda, susun angka */
  function pickInteraction(q, p) {
    const canBuild = q.numeric && p.mode !== 'tk';
    let answer = 'choice';
    if (canBuild) {
      if (p.answerStyle === 'type') answer = 'builder';
      else if (p.answerStyle === 'mix') answer = Math.random() < (p.mode === 'challenge' ? 0.6 : 0.4) ? 'builder' : 'choice';
    }
    if (isAssessment()) return { type: answer, answer };
    const manipChance = p.mode === 'tk' ? 0.65 : p.mode === 'starter' ? 0.4 : 0.2;
    if (q.manip && q.manip !== 'share' && Math.random() < manipChance) return { type: 'count', answer };
    return { type: answer, answer };
  }

  const TYPE_LABEL = { choice: '👆 Pilih Jawaban', count: '✋ Hitung Benda', builder: '🔢 Susun Angka' };

  function renderPlay() {
    const p = player();
    const { q, interaction } = S.cur;
    const sec = $('#screen-play');
    const doneCount = S.kind === 'diagnostic' ? S.diag.reduce((s, d) => s + d.answers.length, 0) : S.index;
    const title = S.kind === 'mission' ? C.AREA_BY_ID[S.area].steps[S.step].mission
      : S.kind === 'review' ? 'Latihan Ulang Soal Sulit'
      : S.kind === 'diagnostic' ? 'Tes Awal'
      : 'Tes Akhir · ' + C.AREA_BY_ID[S.area].name;
    const dots = Array.from({ length: S.total }, (_, i) => {
      let cls = '';
      if (i < doneCount) {
        if (isAssessment()) cls = 'done';
        else cls = S.results[i] === 'first' ? 'ok' : S.results[i] === 'help' ? 'help' : 'learn';
      } else if (i === doneCount) cls = 'now';
      return `<span class="dot ${cls}"></span>`;
    }).join('');
    const eqHtml = q.equation ? esc(q.equation).replace('?', '<span class="qmark" id="qmark">?</span>') : '';
    const manipText = {
      count: `Ketuk setiap ${q.visual && q.visual.label ? esc(q.visual.label) : 'benda'} untuk menghitungnya.`,
      takeaway: q.visual ? `Ketuk ${q.visual.remove} ${esc(q.visual.label || 'benda')} untuk diambil.` : '',
      groups: 'Ketuk setiap kelompok untuk hitung loncat.'
    };
    sec.innerHTML = `
      <div class="play-top">
        <button class="back" type="button" data-exit>✕ Keluar</button>
        <div class="play-title"><b>${esc(title)}</b><small>Soal ${Math.min(doneCount + 1, S.total)} dari ${S.total}${S.cur.bonus ? ' · bonus' : ''}</small></div>
      </div>
      <div class="dots" aria-hidden="true">${dots}</div>
      ${p.timed && S.kind === 'mission' && !S.cur.bonus ? '<div class="timer" aria-hidden="true"><span id="timerBar"></span></div><p class="timer-note" id="timerNote" hidden>Waktu habis — tidak apa-apa, lanjutkan tanpa waktu.</p>' : ''}
      <div class="chips">
        <span class="chip">${isAssessment() ? '📝 Tes · tanpa waktu' : TYPE_LABEL[interaction.type]}</span>
        ${S.cur.tag ? `<span class="chip chip-note">${esc(S.cur.tag)}</span>` : ''}
      </div>
      <div class="qcard card">
        <div class="prompt-row">
          <p class="prompt" id="prompt">${esc(q.prompt)}</p>
          <button class="icon-btn icon-soft" type="button" data-speak aria-label="Bacakan soal"><span aria-hidden="true">🔊</span></button>
        </div>
        <div class="stage" id="stage"></div>
        ${interaction.type === 'count' ? `<p class="manip-note" id="manipNote">${manipText[q.manip] || ''}</p>` : ''}
        ${eqHtml ? `<p class="equation ${q.equation.length > 16 ? 'eq-long' : ''}" aria-label="Kalimat matematika: ${esc(q.equation)}">${eqHtml}</p>` : ''}
        <div class="answers" id="answers"></div>
      </div>
      <div class="feedback" id="feedback" role="status" aria-live="polite" hidden></div>`;

    $('[data-exit]', sec).addEventListener('click', exitSession);
    $('[data-speak]', sec).addEventListener('click', () => Speech.speak(q.prompt));

    // Gambar
    activeVisual = null;
    if (q.visual) {
      const vis = V.render(q.visual);
      $('#stage', sec).appendChild(vis.el);
      activeVisual = vis;
      if (interaction.type === 'count') {
        const reveal = () => {
          const note = $('#manipNote');
          if (note) note.textContent = 'Bagus! Sekarang pilih atau tulis jawabanmu.';
          renderAnswers(true);
        };
        const tick = n => { if (p.mode === 'tk') Speech.speak(String(n)); };
        if (q.manip === 'count') vis.enableCount(reveal, tick);
        else if (q.manip === 'takeaway') vis.enableTakeaway(reveal);
        else if (q.manip === 'groups') vis.enableGroups(reveal, tick);
      } else {
        if (q.manip === 'share') vis.enableShare(() => {});
        if (q.visual.kind === 'takeaway' && vis.autoTakeaway) vis.autoTakeaway();
      }
    } else $('#stage', sec).remove();

    if (interaction.type !== 'count') renderAnswers(false);
    else $('#answers', sec).innerHTML = '<p class="muted center">Jawaban muncul setelah kamu selesai.</p>';

    show('play', { push: false, noFocus: true });
    const pr = $('#prompt', sec);
    pr.setAttribute('tabindex', '-1'); pr.focus({ preventScroll: true });
    if (store.settings.autoRead && p.mode === 'tk') Speech.speak(q.prompt);
    startTimer();
  }

  function startTimer() {
    const p = player();
    if (!(p.timed && S.kind === 'mission' && !S.cur.bonus)) return;
    const bar = $('#timerBar');
    if (!bar) return;
    const total = 30, t0 = Date.now();
    timerInt = setInterval(() => {
      const left = Math.max(0, total - (Date.now() - t0) / 1000);
      bar.style.width = (left / total * 100) + '%';
      if (left <= 0) {
        clearInterval(timerInt); timerInt = null;
        const n = $('#timerNote'); if (n) n.hidden = false;
      }
    }, 250);
  }

  function renderAnswers(fromManip) {
    const { q, interaction } = S.cur;
    const box = $('#answers');
    const method = interaction.type === 'count' ? interaction.answer : interaction.type;
    if (method === 'builder' && q.numeric) renderBuilder(box, q);
    else renderChoices(box, q);
    if (fromManip) box.scrollIntoView({ behavior: V.reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }

  function renderChoices(box, q) {
    const hasVisual = q.choices.some(c => c.visual);
    const isOp = q.choices.every(c => c.value.length === 1 && /[+−×÷]/.test(c.value));
    box.innerHTML = `<div class="choices ${hasVisual ? 'choices-vis' : ''} ${isOp ? 'choices-op' : ''} n${q.choices.length}" role="group" aria-label="Pilihan jawaban"></div>`;
    const grid = box.firstChild;
    q.choices.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.dataset.value = c.value;
      if (c.visual) {
        const vis = V.render(c.visual);
        b.appendChild(vis.el);
        b.setAttribute('aria-label', c.label);
      } else {
        b.textContent = c.label;
      }
      b.addEventListener('click', () => submit(c.value, b));
      grid.appendChild(b);
    });
  }

  function renderBuilder(box, q) {
    const maxLen = Math.min(4, Math.max(2, q.answer.length + 1));
    box.innerHTML = `
      <div class="builder">
        <p class="sr-only" id="buildLabel">Susun jawabanmu dengan tombol angka, lalu tekan Cek.</p>
        <output class="build-display" id="buildDisplay" aria-labelledby="buildLabel" aria-live="polite">&nbsp;</output>
        <div class="keypad" role="group" aria-label="Tombol angka">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button type="button" class="key" data-d="${d}">${d}</button>`).join('')}
          <button type="button" class="key key-del" data-del aria-label="Hapus satu angka">⌫</button>
          <button type="button" class="key" data-d="0">0</button>
          <button type="button" class="key key-ok" data-ok aria-label="Cek jawaban">Cek ✓</button>
        </div>
      </div>`;
    let val = '';
    const disp = $('#buildDisplay', box);
    const update = () => {
      disp.innerHTML = val ? esc(val) : '&nbsp;';
      const qm = $('#qmark'); if (qm) { qm.textContent = val || '?'; qm.classList.toggle('filled', !!val); }
    };
    const press = d => { if (S.cur.done) return; if (val.length < maxLen) { val = (val === '0' ? '' : val) + d; update(); } };
    const del = () => { if (S.cur.done) return; val = val.slice(0, -1); update(); };
    const ok = () => {
      if (S.cur.done) return;
      if (!val) { toast('Tulis jawabanmu dulu dengan tombol angka, ya.'); return; }
      const given = String(Number(val));
      const wasWrong = given !== q.answer;
      submit(given, null);
      if (wasWrong && !S.cur.done) { val = ''; update(); }
    };
    $$('[data-d]', box).forEach(b => b.addEventListener('click', () => press(b.dataset.d)));
    $('[data-del]', box).addEventListener('click', del);
    $('[data-ok]', box).addEventListener('click', ok);
    S.cur.keyHandler = e => {
      if (current !== 'play' || !$('#modal').hidden) return;
      if (e.target && e.target.tagName === 'INPUT') return;
      if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { del(); e.preventDefault(); }
      else if (e.key === 'Enter' && document.activeElement && !document.activeElement.closest('.keypad, .feedback')) { ok(); e.preventDefault(); }
    };
  }

  document.addEventListener('keydown', e => { if (S && S.cur && S.cur.keyHandler && !S.cur.done) S.cur.keyHandler(e); });

  /* ---------- Menilai jawaban & umpan balik ---------- */
  function submit(value, btn) {
    const cur = S.cur;
    if (!cur || cur.done) return;
    const q = cur.q;
    const ok = value === q.answer;
    cur.attempts++;
    if (timerInt) { clearInterval(timerInt); timerInt = null; }

    // Tes: satu kali jawab, umpan balik netral agar tidak menegangkan
    if (isAssessment()) {
      cur.done = true;
      lockAnswers();
      if (btn) btn.classList.add('picked');
      if (S.kind === 'diagnostic') S.diag[S.areaIdx].answers.push({ step: q.step, ok });
      else S.answers.push({ step: q.step, ok });
      showFeedback('neutral', 'Jawaban tersimpan 👍', 'Terima kasih! Ayo lanjut ke soal berikutnya.', []);
      return;
    }

    if (ok) {
      cur.done = true;
      lockAnswers();
      if (btn) btn.classList.add('correct');
      markCorrectChoice();
      const outcome = cur.attempts === 1 ? 'first' : 'help';
      Sfx.good();
      finalizeQuestion(outcome, value);
      const extra = outcome === 'help' ? ['Kamu berhasil setelah mencoba lagi. Itu namanya pantang menyerah! 💪'] : [];
      const lines = extra.concat(q.explain.slice(-1));
      showFeedback('ok', q.correctMsg, pick(['Pintar sekali!', 'Keren!', 'Mantap!', 'Luar biasa!']), outcome === 'first' ? [] : lines);
      celebrate();
      if (store.settings.sound) Speech.speak(q.correctMsg);
      return;
    }

    // Salah percobaan pertama: bantu dulu, jangan langsung beri jawaban
    if (cur.attempts === 1) {
      if (btn) { btn.classList.add('wrong'); btn.disabled = true; btn.setAttribute('aria-label', btn.textContent + ' (sudah dicoba)'); }
      cur.wrong.add(value);
      Sfx.soft();
      let dir = [];
      if (q.numeric && /^\d+$/.test(value)) dir = [Number(value) > Number(q.answer) ? 'Jawabanmu sedikit terlalu besar.' : 'Jawabanmu sedikit terlalu kecil.'];
      showFeedback('try', 'Tidak apa-apa, kita coba bersama, ya!', '', dir.concat(q.hint), true);
      if (activeVisual && activeVisual.guide && S.cur.interaction.type !== 'count') activeVisual.guide();
      if (store.settings.sound) Speech.speak('Tidak apa-apa, kita coba bersama, ya. ' + q.hint.join(' '));
      return;
    }

    // Salah lagi: tunjukkan cara lengkap & jawabannya, lalu soal mirip
    cur.done = true;
    lockAnswers();
    if (btn) btn.classList.add('wrong');
    markCorrectChoice();
    finalizeQuestion('wrong', value);
    showFeedback('learn', 'Ayo kita lihat caranya bersama', `Jawaban yang benar: ${q.answer}`, q.explain);
    if (activeVisual && activeVisual.guide) activeVisual.guide();
    if (store.settings.sound) Speech.speak('Ayo kita lihat caranya. ' + q.explain.join(' '));
  }

  function lockAnswers() { $$('#answers button').forEach(b => { b.disabled = true; }); }
  function markCorrectChoice() {
    const b = $$('#answers .choice').find(x => x.dataset.value === S.cur.q.answer);
    if (b) b.classList.add('correct');
    const qm = $('#qmark');
    if (qm) { qm.textContent = S.cur.q.answer; qm.classList.add('filled'); }
  }

  function celebrate() {
    if (V.reduceMotion()) return;
    const card = $('.qcard');
    if (!card) return;
    const burst = document.createElement('div');
    burst.className = 'burst';
    burst.setAttribute('aria-hidden', 'true');
    burst.innerHTML = '<span>⭐</span><span>✨</span><span>⭐</span><span>🌟</span><span>✨</span>';
    card.appendChild(burst);
    setTimeout(() => burst.remove(), 1100);
  }

  /* Catat hasil & atur kesulitan untuk soal berikutnya */
  function finalizeQuestion(outcome, given) {
    const p = player();
    P.recordAnswer(p, S.cur.q, outcome, given);
    if (S.cur.bonus) { save(); return; } // soal tantangan tidak memengaruhi nilai misi
    S.results.push(outcome);
    if (outcome === 'first') { S.streakRight++; S.streakWrong = 0; }
    else if (outcome === 'help') { S.streakRight = 0; }
    else { S.streakWrong++; S.streakRight = 0; S.similar = true; }
    if (S.kind === 'mission') {
      if (S.ease < 0 && S.streakRight >= 2) { S.ease = 0; S.note = 'Hebat! Ayo kembali ke soal misi.'; }
      else if (S.ease === 0 && S.streakWrong >= 2 && S.step > 0) { S.ease = -1; S.streakWrong = 0; S.note = 'Kita coba yang sedikit lebih mudah dulu, ya.'; S.similar = false; }
    }
    save();
  }

  function showFeedback(kind, title, msg, lines, retry) {
    const fb = $('#feedback');
    const icons = { ok: '🎉', try: '🤗', learn: '🧠', neutral: '📝' };
    fb.className = 'feedback fb-' + kind;
    const lastQ = S.kind === 'diagnostic'
      ? (S.qInArea === 1 && S.areaIdx === S.diag.length - 1)
      : (S.index + (S.cur.bonus ? 0 : 1) >= S.total);
    const canBonus = kind === 'ok' && S.kind === 'mission' && !S.cur.bonus && S.streakRight >= 3 && S.bonusCount < 2
      && S.step < G.stepCount(S.area) - 1 && S.ease === 0 && !lastQ;
    fb.innerHTML = `
      <div class="fb-icon" aria-hidden="true">${icons[kind]}</div>
      <div class="fb-body">
        <h2 class="fb-title">${esc(title)}</h2>
        ${msg ? `<p class="fb-msg">${esc(msg)}</p>` : ''}
        ${lines && lines.length ? `<ol class="steps">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ol>` : ''}
        ${retry ? '<p class="fb-msg"><b>Coba sekali lagi, kamu pasti bisa!</b></p>' : ''}
      </div>
      ${retry ? '' : `<div class="fb-actions">
        ${canBonus ? '<button class="btn btn-soft" type="button" data-bonus>⭐ Coba Soal Tantangan</button>' : ''}
        <button class="btn btn-primary btn-lg" type="button" data-next>${lastQ ? 'Lihat Hasil 🏁' : 'Lanjut ▶'}</button>
      </div>`}`;
    fb.hidden = false;
    const nx = $('[data-next]', fb);
    if (nx) { nx.addEventListener('click', advance); setTimeout(() => nx.focus({ preventScroll: true }), 50); }
    const bb = $('[data-bonus]', fb);
    if (bb) bb.addEventListener('click', () => { S.bonusCount++; S.streakRight = 0; nextQuestion(true); });
    fb.scrollIntoView({ behavior: V.reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }

  function advance() {
    if (S.kind === 'diagnostic') {
      S.qInArea++;
      if (S.qInArea >= 2) { S.qInArea = 0; S.areaIdx++; }
      if (S.areaIdx >= S.diag.length) { finishDiagnostic(); return; }
      nextQuestion();
      return;
    }
    if (!S.cur.bonus) S.index++;
    if (S.index >= S.total) { finishSession(); return; }
    nextQuestion();
  }

  async function exitSession() {
    const okExit = await confirmBox({
      title: 'Keluar dari misi?',
      text: isAssessment() ? 'Tes belum selesai dan hasilnya tidak disimpan. Kamu bisa mengulanginya kapan saja.' : 'Misi belum selesai. Bintang yang sudah kamu dapat sebelumnya tetap aman, dan kamu bisa mengulanginya kapan saja.',
      ok: 'Ya, keluar', cancel: 'Lanjut main'
    });
    if (!okExit) return;
    const s = S; S = null;
    endTimers();
    if (s && (s.kind === 'mission' || s.kind === 'final')) renderArea(s.area);
    else goMap();
  }

  /* ================= RINGKASAN ================= */
  function finishSession() {
    const p = player();
    endTimers();
    if (S.kind === 'final') { finishFinal(); return; }
    const r = P.finishMission(p, S.area, S.step, S.results, S.kind);
    save();
    sitting.missions++;
    const a = C.AREA_BY_ID[S.area], s = a.steps[S.step];
    const rec = P.recommend(p, store.settings);
    const nextAvail = S.kind === 'mission' && S.step + 1 < a.steps.length && P.isAvailable(p, store.settings, S.area, S.step + 1);
    const needBreak = sitting.missions >= 3 || Date.now() - sitting.start > 20 * 60 * 1000;
    if (r.completed) Sfx.win();
    const sec = $('#screen-summary');
    const session = S;
    sec.innerHTML = `
      <div class="summary card">
        <div class="big-emoji" aria-hidden="true">${r.completed ? '🎉' : '🌱'}</div>
        <h1>${session.kind === 'review' ? 'Latihan ulang selesai!' : r.completed ? 'Misi Selesai!' : 'Kerja bagus, terus berlatih!'}</h1>
        <p class="lead">${esc(session.kind === 'review' ? 'Kamu sudah mengulang soal-soal yang sulit.' : s.mission)}</p>
        ${session.kind === 'mission' ? `<div class="big-stars">${starsHtml(r.stars)}</div>` : ''}
        ${session.kind === 'mission' && r.stars > r.prevStars && r.prevStars > 0 ? '<p class="tag tag-rec center-tag">Rekor bintang baru!</p>' : ''}
        ${session.kind === 'mission' && !r.completed ? `<p class="muted">Dapatkan minimal 60% untuk menyelesaikan misi. ${r.prevStars ? 'Bintangmu sebelumnya tetap aman.' : ''}</p>` : ''}
        <ul class="result-list">
          <li><span aria-hidden="true">✅</span> Benar langsung: <b>${r.first}</b> dari ${r.total}</li>
          <li><span aria-hidden="true">💪</span> Benar setelah mencoba lagi: <b>${r.helped}</b></li>
          <li><span aria-hidden="true">🧠</span> Belajar dari penjelasan: <b>${r.wrong}</b></li>
        </ul>
      </div>
      ${r.newBadges.length ? `<div class="card new-badges"><h2>Lencana baru!</h2><ul class="badge-grid">${r.newBadges.map(b => `<li class="badge on"><span class="b-ic" aria-hidden="true">${b.icon}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></li>`).join('')}</ul></div>` : ''}
      ${session.kind === 'mission' ? `<div class="card"><h2>Yang kamu pelajari</h2><p>${esc(s.goal)}</p><p class="muted">💡 ${esc(s.concept)}</p></div>` : ''}
      ${needBreak ? '<div class="card break-card"><span aria-hidden="true">🧃</span><p><b>Waktunya istirahat sebentar?</b> Minum air, regangkan badan, lalu main lagi nanti. Otak juga butuh istirahat!</p></div>' : ''}
      ${rec ? `<div class="card rec-small"><p class="eyebrow">Saran berikutnya</p><p><b>${esc(stepLabel(rec.area, rec.step))}</b></p><p class="muted">${esc(rec.reason)}</p><button class="btn btn-primary" type="button" data-rec>Ayo lanjut ▶</button></div>` : ''}
      <div class="btn-row">
        ${session.kind === 'mission' ? '<button class="btn btn-soft" type="button" data-again>↻ Main lagi</button>' : ''}
        ${nextAvail && !(rec && rec.area === session.area && rec.step === session.step + 1) ? '<button class="btn btn-soft" type="button" data-next-step>Misi berikutnya ▶</button>' : ''}
        <button class="btn btn-ghost" type="button" data-go="map">🗺️ Ke peta</button>
      </div>
      <p class="sync-note" id="syncNote" role="status"></p>`;
    const recB = $('[data-rec]', sec);
    if (recB) recB.addEventListener('click', () => renderIntro(rec.area, rec.step));
    const again = $('[data-again]', sec);
    if (again) again.addEventListener('click', () => startMission(session.area, session.step));
    const ns = $('[data-next-step]', sec);
    if (ns) ns.addEventListener('click', () => renderIntro(session.area, session.step + 1));
    S = null;
    show('summary');
    report({ kind: session.kind, area: session.area, step: session.step, result: r });
  }

  function finishDiagnostic() {
    const p = player();
    const areas = P.applyDiagnostic(p, S.diag);
    save();
    S = null;
    const rec = P.recommend(p, store.settings);
    const sec = $('#screen-summary');
    sec.innerHTML = `
      <div class="summary card">
        <div class="big-emoji" aria-hidden="true">🧭</div>
        <h1>Tes Awal selesai!</h1>
        <p class="lead">Terima kasih sudah mencoba. Sekarang kami tahu misi yang pas untukmu.</p>
        <ul class="result-list">
          ${Object.keys(areas).map(a => `<li><span aria-hidden="true">${C.AREA_BY_ID[a].icon}</span> ${esc(C.AREA_BY_ID[a].name)}: mulai dari <b>${esc(C.AREA_BY_ID[a].steps[areas[a].start].title)}</b></li>`).join('')}
        </ul>
        <p class="muted">Misi yang lebih mudah tetap terbuka untuk dimainkan.</p>
      </div>
      ${rec ? `<div class="card rec-small"><p class="eyebrow">Misi pertamamu</p><p><b>${esc(stepLabel(rec.area, rec.step))}</b></p><button class="btn btn-primary" type="button" data-rec>Ayo mulai ▶</button></div>` : ''}
      <div class="btn-row"><button class="btn btn-ghost" type="button" data-go="map">🗺️ Ke peta</button></div>
      <p class="sync-note" id="syncNote" role="status"></p>`;
    const recB = $('[data-rec]', sec);
    if (recB) recB.addEventListener('click', () => renderIntro(rec.area, rec.step));
    show('summary');
    const tot = Object.values(areas).reduce((t, x) => ({ c: t.c + x.correct, n: t.n + x.total }), { c: 0, n: 0 });
    report({
      kind: 'diagnostic', result: { total: tot.n, correct: tot.c, first: tot.c, wrong: tot.n - tot.c },
      note: 'Mulai dari: ' + Object.keys(areas).map(a => `${C.AREA_BY_ID[a].name} → ${C.AREA_BY_ID[a].steps[areas[a].start].title} (${areas[a].correct}/${areas[a].total})`).join('; ')
    });
  }

  function finishFinal() {
    const p = player();
    const area = S.area;
    const res = P.applyFinal(p, area, S.answers);
    save();
    S = null;
    const a = C.AREA_BY_ID[area];
    const shown = [], practice = [];
    Object.keys(res.steps).forEach(k => {
      const st = res.steps[k], name = a.steps[k].title;
      if (st.c === st.n) shown.push(name); else practice.push(name);
    });
    const cmp = P.compareAssessment(p, area);
    const rec = P.recommend(p, store.settings);
    const sec = $('#screen-summary');
    sec.innerHTML = `
      <div class="summary card">
        <div class="big-emoji" aria-hidden="true">📋</div>
        <h1>Tes Akhir ${esc(a.name)} selesai!</h1>
        <p class="lead"><b>${res.correct} dari ${res.total}</b> soal benar.</p>
        ${shown.length ? `<p>✅ <b>Sudah ditunjukkan:</b> ${shown.map(esc).join(', ')}</p>` : ''}
        ${practice.length ? `<p>🌱 <b>Perlu latihan lagi:</b> ${practice.map(esc).join(', ')}</p>` : ''}
        <p class="muted">${esc(cmp.text)}</p>
      </div>
      ${rec ? `<div class="card rec-small"><p class="eyebrow">Saran berikutnya</p><p><b>${esc(stepLabel(rec.area, rec.step))}</b></p><button class="btn btn-primary" type="button" data-rec>Ayo lanjut ▶</button></div>` : ''}
      <div class="btn-row"><button class="btn btn-ghost" type="button" data-go="map">🗺️ Ke peta</button></div>
      <p class="sync-note" id="syncNote" role="status"></p>`;
    const recB = $('[data-rec]', sec);
    if (recB) recB.addEventListener('click', () => renderIntro(rec.area, rec.step));
    show('summary');
    report({
      kind: 'final', area, result: { total: res.total, correct: res.correct, first: res.correct, wrong: res.total - res.correct },
      note: [shown.length ? 'Sudah ditunjukkan: ' + shown.join(', ') : '', practice.length ? 'Perlu latihan: ' + practice.join(', ') : ''].filter(Boolean).join(' | ')
    });
  }

  /* ================= PROGRES BELAJAR ================= */
  function renderProgress(tab, push) {
    const p = player();
    if (!p) { requirePlayer(() => renderProgress(tab)); return; }
    routeArgs.progressTab = tab;
    const sec = $('#screen-progress');
    const rec = P.recommend(p, store.settings);
    const tabs = `
      <div class="tabs" role="tablist" aria-label="Jenis tampilan progres">
        <button class="tab" role="tab" type="button" aria-selected="${tab === 'child'}" data-tab="child">🧒 Untuk Anak</button>
        <button class="tab" role="tab" type="button" aria-selected="${tab === 'adult'}" data-tab="adult">👨‍👩‍👧 Orang Tua &amp; Guru</button>
      </div>`;
    const badgesEarned = P.BADGES.filter(b => p.badges[b.id]).length;
    let body;
    if (tab === 'child') {
      body = `
        <div class="card kid-card">
          <span class="pb-avatar big" aria-hidden="true">${esc(p.name.slice(0, 1).toUpperCase())}</span>
          <div class="kid-text"><h2 class="name-wrap">${esc(p.name)}</h2><p class="muted">${esc(groupName(p.group))} · ${esc(C.MODES[p.mode].name)}</p></div>
        </div>
        <div class="stat-row">
          <div class="stat"><b>${P.totalStars(p)}</b><span>⭐ Bintang</span></div>
          <div class="stat"><b>${P.completedCount(p)}</b><span>✅ Misi selesai</span></div>
          <div class="stat"><b>${badgesEarned}</b><span>🏅 Lencana</span></div>
        </div>
        ${rec ? `<div class="card rec-small"><p class="eyebrow">Ayo main berikutnya</p><p><b>${esc(stepLabel(rec.area, rec.step))}</b></p><button class="btn btn-primary" type="button" data-rec>Main ▶</button></div>` : ''}
        <h2 class="section-title">Misi per level</h2>
        <ul class="area-mini">
          ${C.AREAS.map(a => { const pr = P.areaProgress(p, a.id); return `<li><span aria-hidden="true">${a.icon}</span><span class="am-name">${esc(a.name)}</span><span class="am-meta">${pr.done}/${pr.total} · ⭐ ${pr.stars}</span></li>`; }).join('')}
        </ul>
        <h2 class="section-title">Koleksi lencana</h2>
        <ul class="badge-grid">
          ${P.BADGES.map(b => `<li class="badge ${p.badges[b.id] ? 'on' : ''}"><span class="b-ic" aria-hidden="true">${p.badges[b.id] ? b.icon : '🔒'}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small><span class="sr-only">${p.badges[b.id] ? 'Sudah didapat' : 'Belum didapat'}</span></li>`).join('')}
        </ul>
        <div class="btn-row"><button class="btn btn-ghost" type="button" data-edit>✏️ Ubah profil</button></div>`;
    } else {
      const ops = C.OPS.map(o => ({ o, s: P.opStatus(p, o.id) }));
      const tot = ops.reduce((acc, x) => { acc.att += x.s.attempted; acc.first += x.s.first; acc.help += x.s.helped; return acc; }, { att: 0, first: 0, help: 0 });
      const weak = ops.filter(x => x.s.needsPractice);
      const hard = p.history.filter(h => h.outcome !== 'first').slice(0, 6);
      const ini = p.assess.initial;
      const finals = Object.keys(p.assess.final);
      body = `
        <div class="card">
          <h2>Ringkasan ${esc(p.name)}</h2>
          <div class="stat-row">
            <div class="stat"><b>${tot.att}</b><span>Soal dicoba</span></div>
            <div class="stat"><b>${tot.first}</b><span>Benar langsung</span></div>
            <div class="stat"><b>${tot.att ? pct((tot.first + 0.5 * tot.help) / tot.att) : '–'}</b><span>Ketepatan latihan</span></div>
          </div>
          <p class="muted small">Ketepatan latihan: benar langsung = 1, benar setelah mencoba lagi = ½.</p>
        </div>
        <div class="card">
          <h2>Kemampuan per operasi</h2>
          <ul class="op-list">
            ${ops.map(({ o, s }) => `
              <li class="op-row lvl-${s.level}">
                <span class="op-ic" aria-hidden="true">${o.icon}</span>
                <span class="op-name"><b>${esc(o.name)}</b><small>${s.attempted ? `${s.first} benar langsung dari ${s.attempted} soal · ketepatan ${pct(s.accuracy)} · 20 soal terakhir ${pct(s.recentAcc)}` : 'Belum dicoba'}</small></span>
                <span class="tag lvl">${esc(s.label)}</span>
              </li>`).join('')}
          </ul>
          <details class="legend"><summary>Arti status</summary>
            <ul>
              <li><b>Sedang berlatih</b>: sudah mencoba, masih membangun pemahaman.</li>
              <li><b>Mulai lancar</b>: minimal 10 soal dengan ketepatan terbaru ≥ 70%.</li>
              <li><b>Dikuasai</b>: minimal 20 soal, ketepatan terbaru ≥ 85%, dan minimal 2 sesi dengan nilai ≥ 80%. Satu kuis singkat tidak cukup untuk disebut menguasai.</li>
            </ul>
          </details>
        </div>
        <div class="card">
          <h2>Level yang diselesaikan</h2>
          <ul class="area-mini">
            ${C.AREAS.map(a => { const pr = P.areaProgress(p, a.id); return `<li><span aria-hidden="true">${a.icon}</span><span class="am-name">Level ${a.level} · ${esc(a.name)}</span><span class="am-meta">${pr.done}/${pr.total} misi${pr.done === pr.total ? ' ✓' : ''}</span></li>`; }).join('')}
          </ul>
        </div>
        <div class="card">
          <h2>Perlu latihan tambahan</h2>
          ${weak.length ? `<ul class="plain">${weak.map(({ o, s }) => `<li>${o.icon} <b>${esc(o.name)}</b> — ketepatan terbaru ${pct(s.recentAcc)}. Ajak anak berlatih dengan benda nyata.</li>`).join('')}</ul>` : '<p class="muted">Belum ada area yang menonjol perlu bantuan (atau datanya belum cukup).</p>'}
          ${hard.length ? `<h3>Soal yang sulit baru-baru ini</h3><ul class="hard-list">${hard.map(h => `<li><span class="hq">${esc(h.q)}</span><span class="muted">jawaban anak: ${esc(h.given || '–')} · benar: <b>${esc(h.answer)}</b>${h.outcome === 'help' ? ' · berhasil setelah mencoba lagi' : ''}</span></li>`).join('')}</ul>
            <button class="btn btn-soft" type="button" data-review>🔁 Latihan Ulang Soal Sulit</button>` : ''}
        </div>
        <div class="card">
          <h2>Tes awal &amp; tes akhir</h2>
          ${!ini && !finals.length ? '<p class="muted">Belum ada tes. Tes Awal bisa diikuti dari peta; Tes Akhir terbuka setelah 2 misi selesai di sebuah level.</p>' : ''}
          ${ini ? `<h3>Tes awal (${fmtDate(ini.t)})</h3><ul class="plain">${Object.keys(ini.areas).map(a => `<li>${C.AREA_BY_ID[a].icon} ${esc(C.AREA_BY_ID[a].name)}: ${ini.areas[a].correct}/${ini.areas[a].total} benar → mulai di <b>${esc(C.AREA_BY_ID[a].steps[ini.areas[a].start || 0].title)}</b></li>`).join('')}</ul>` : ''}
          ${finals.length ? `<h3>Tes akhir</h3><ul class="plain">${finals.map(a => {
            const f = p.assess.final[a]; const ar = C.AREA_BY_ID[a];
            const ok = Object.keys(f.steps || {}).filter(k => f.steps[k].c === f.steps[k].n).map(k => ar.steps[k].title);
            const no = Object.keys(f.steps || {}).filter(k => f.steps[k].c < f.steps[k].n).map(k => ar.steps[k].title);
            return `<li>${ar.icon} <b>${esc(ar.name)}</b>: ${f.correct}/${f.total} benar (${fmtDate(f.t)})
              ${ok.length ? `<br><small>✅ Ditunjukkan: ${ok.map(esc).join(', ')}</small>` : ''}
              ${no.length ? `<br><small>🌱 Perlu latihan: ${no.map(esc).join(', ')}</small>` : ''}
              <br><small class="muted">${esc(P.compareAssessment(p, a).text)}</small></li>`;
          }).join('')}</ul>` : ''}
        </div>
        <div class="card">
          <h2>Aktivitas terbaru</h2>
          ${p.sessions.length ? `<ul class="activity">${p.sessions.slice(0, 8).map(s => `<li><span class="act-date">${esc(fmtDate(s.t))}</span><span class="act-name">${s.kind === 'review' ? 'Latihan ulang' : esc(stepLabel(s.area, s.step))}</span><span class="act-score">${s.first}/${s.total} langsung benar · ${pct(s.score)}${s.kind === 'mission' ? ' · ' + '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars) : ''}</span></li>`).join('')}</ul>` : '<p class="muted">Belum ada aktivitas.</p>'}
        </div>
        <div class="btn-row">
          <button class="btn btn-ghost" type="button" data-edit>✏️ Ubah profil</button>
          <button class="btn btn-danger-ghost" type="button" data-reset>Reset progres pemain ini</button>
        </div>`;
    }
    sec.innerHTML = `
      <div class="screen-head"><button class="back" type="button" data-go="map">← Peta</button></div>
      <h1>Progres Belajar</h1>
      ${tabs}
      <div class="tab-panel" role="tabpanel">${body}</div>`;
    $$('[data-tab]', sec).forEach(b => b.addEventListener('click', () => renderProgress(b.dataset.tab, false)));
    const r = $('[data-rec]', sec); if (r) r.addEventListener('click', () => renderIntro(rec.area, rec.step));
    const e = $('[data-edit]', sec); if (e) e.addEventListener('click', () => renderProfile('edit'));
    const rv = $('[data-review]', sec); if (rv) rv.addEventListener('click', startReview);
    const rs = $('[data-reset]', sec); if (rs) rs.addEventListener('click', resetCurrent);
    show('progress', { push, noFocus: push === false });
  }

  async function resetCurrent() {
    const p = player();
    if (!p) return;
    const okReset = await confirmBox({ title: 'Reset progres?', text: `Semua bintang, lencana, dan riwayat ${p.name} di perangkat ini akan dihapus. Nama dan mode tetap.`, ok: 'Ya, reset', danger: true });
    if (!okReset) return;
    const fresh = P.newPlayer({ name: p.name, group: p.group, mode: p.mode, answerStyle: p.answerStyle, timed: p.timed });
    fresh.id = p.id; fresh.createdAt = p.createdAt;
    store.players[p.id] = fresh; save();
    toast('Progres sudah direset.');
    if (current === 'progress') renderProgress('adult', false); else renderGuide(false);
  }

  /* ================= PANDUAN & PENGATURAN ================= */
  function renderGuide(push) {
    const sec = $('#screen-guide');
    const p = player();
    sec.innerHTML = `
      <div class="screen-head"><button class="back" type="button" data-go="home">← Beranda</button></div>
      <h1>Panduan Orang Tua &amp; Guru</h1>
      <div class="card prose">
        <h2>Tentang permainan</h2>
        <p>Sedjati Numeracy Adventure membantu anak memahami konsep matematika lewat benda, kelompok, dan garis bilangan — bukan sekadar menghafal. Fokus utamanya penjumlahan, pengurangan, perkalian, dan pembagian.</p>
        <h2>Alur setiap misi</h2>
        <ol>
          <li>Anak melihat <b>tujuan belajar</b>, penjelasan singkat, dan <b>contoh</b>.</li>
          <li>Anak menjawab soal dengan tiga cara: <b>pilih jawaban</b>, <b>hitung benda</b> (ketuk benda), atau <b>susun angka</b>.</li>
          <li>Jika salah, permainan memberi bantuan dan kesempatan mencoba lagi. Jika masih salah, cara lengkapnya ditunjukkan lalu diberi soal mirip.</li>
          <li>Jika anak sering salah, soal otomatis menjadi lebih mudah. Jika sering benar, tersedia soal tantangan opsional.</li>
          <li>Di akhir misi ada ringkasan dan saran misi berikutnya.</li>
        </ol>
        <h2>Enam level kemampuan</h2>
        <ul>${C.AREAS.map(a => `<li>${a.icon} <b>Level ${a.level} · ${esc(a.name)}</b> — ${esc(a.blurb)}</li>`).join('')}</ul>
        <p>Level menunjukkan <b>kemampuan</b>, bukan kelas sekolah. Anak boleh mulai di level mana pun yang terbuka. <b>Tes Awal</b> (opsional) membantu memilih titik awal.</p>
        <h2>Tiga mode</h2>
        <ul>${Object.values(C.MODES).map(m => `<li><b>${esc(m.name)}</b> — ${esc(m.desc)}</li>`).join('')}</ul>
        <p>Untuk Mode TK, perkalian dan pembagian bersifat <b>eksplorasi</b> (kelompok sama banyak dan berbagi), tidak wajib.</p>
        <h2>Tips mendampingi</h2>
        <ul>
          <li>Main 10–15 menit saja, lalu istirahat. Permainan akan mengingatkan.</li>
          <li>Puji usaha dan cara berpikir, bukan hanya jawaban benar.</li>
          <li>Ulangi dengan benda nyata: kelereng, kancing, buah, atau stik es krim.</li>
          <li>Minta anak menjelaskan caranya: "Bagaimana kamu tahu?"</li>
          <li>Tidak ada peringkat antar anak. Bandingkan anak dengan dirinya sendiri.</li>
        </ul>
      </div>
      <div class="card">
        <h2>Pengaturan</h2>
        <label class="check"><input type="checkbox" id="setSound" ${store.settings.sound ? 'checked' : ''}><span><b>Suara</b><small>Efek suara lembut dan pembacaan soal.</small></span></label>
        <label class="check"><input type="checkbox" id="setRead" ${store.settings.autoRead ? 'checked' : ''}><span><b>Bacakan soal otomatis (Mode TK)</b><small>Memakai suara bawaan perangkat jika tersedia.</small></span></label>
        <label class="check"><input type="checkbox" id="setUnlock" ${store.settings.unlockAll ? 'checked' : ''}><span><b>Buka semua misi</b><small>Untuk guru yang ingin memilih misi tertentu.</small></span></label>
      </div>
      <div class="card" id="sheetCard">
        <h2>Google Spreadsheet (untuk guru)</h2>
        <p class="muted">Hubungkan agar hasil belajar semua anak terkumpul di satu spreadsheet: tab <b>Riwayat</b> (setiap misi/tes) dan <b>Rekap Siswa</b> (satu baris per anak). Cara membuat URL ada di README.</p>
        <label class="field">
          <span class="field-label">URL Apps Script (berakhiran /exec)</span>
          <input type="text" id="sheetUrlInput" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(store.settings.sheetUrl || '')}">
          <small class="field-help">${window.SNA_CONFIG && SNA.Sheet.validUrl(window.SNA_CONFIG.SHEET_API_URL) && !store.settings.sheetUrl ? 'Saat ini memakai URL dari config.js.' : 'Kosongkan untuk memakai URL dari config.js (jika ada).'}</small>
        </label>
        <p class="sync-note" id="sheetStatus" role="status">${SNA.Sheet.validUrl(sheetUrl()) ? '✅ Terhubung.' : 'Belum terhubung.'} ${Sheet.pending() ? `⏳ ${Sheet.pending()} hasil menunggu dikirim.` : ''}</p>
        <div class="btn-row">
          <button class="btn btn-soft" type="button" data-sheet-save>Tes koneksi &amp; simpan</button>
          ${Sheet.pending() && SNA.Sheet.validUrl(sheetUrl()) ? '<button class="btn btn-ghost" type="button" data-sheet-flush>Kirim yang tertunda</button>' : ''}
        </div>
      </div>
      <div class="card">
        <h2>Data &amp; privasi</h2>
        <p>Progres selalu disimpan di browser perangkat ini: nama panggilan, kelompok, mode, dan hasil latihan. Tidak ada iklan dan tidak ada obrolan.</p>
        <p>${SNA.Sheet.validUrl(sheetUrl()) ? 'Google Spreadsheet <b>terhubung</b>: setiap misi dan tes yang selesai juga dikirim ke spreadsheet milik guru/sekolah (nama panggilan, kelompok, dan hasil belajar).' : 'Google Spreadsheet belum dihubungkan, jadi tidak ada data yang dikirim ke internet.'}</p>
        <p class="muted">${storage.available ? 'Penyimpanan perangkat: aktif.' : 'Penyimpanan perangkat: tidak tersedia — progres hilang saat halaman ditutup.'} Jumlah pemain: ${Object.keys(store.players).length}.</p>
        <div class="btn-row">
          ${p ? '<button class="btn btn-danger-ghost" type="button" data-reset>Reset progres pemain ini</button>' : ''}
          <button class="btn btn-danger-ghost" type="button" data-wipe>Hapus semua data</button>
        </div>
      </div>`;
    const bind = (id, key) => $(id, sec).addEventListener('change', e => { store.settings[key] = e.target.checked; save(); updateTopbar(); });
    bind('#setSound', 'sound'); bind('#setRead', 'autoRead'); bind('#setUnlock', 'unlockAll');
    const rs = $('[data-reset]', sec); if (rs) rs.addEventListener('click', resetCurrent);
    $('[data-sheet-save]', sec).addEventListener('click', async () => {
      const url = $('#sheetUrlInput', sec).value.trim();
      const st = $('#sheetStatus', sec);
      if (!url) {
        store.settings.sheetUrl = ''; save();
        st.textContent = SNA.Sheet.validUrl(sheetUrl()) ? 'URL dikosongkan. Memakai URL dari config.js.' : 'URL dihapus. Progres hanya disimpan di perangkat.';
        return;
      }
      st.textContent = '⏳ Mengetes koneksi…';
      const r = await Sheet.test(url);
      if (!r.ok) { st.textContent = '❌ ' + r.error; return; }
      store.settings.sheetUrl = url; save();
      st.textContent = '✅ Terhubung dan tersimpan.';
      toast('Spreadsheet terhubung.');
      flushSheet();
    });
    const fl = $('[data-sheet-flush]', sec);
    if (fl) fl.addEventListener('click', async () => { await flushSheet(); renderGuide(false); });
    $('[data-wipe]', sec).addEventListener('click', async () => {
      const okWipe = await confirmBox({ title: 'Hapus semua data?', text: 'Semua pemain dan progres di perangkat ini akan dihapus dan tidak bisa dikembalikan.', ok: 'Ya, hapus semua', danger: true });
      if (!okWipe) return;
      const keepUrl = store.settings.sheetUrl;
      store = P.defaultStore(); store.settings.sheetUrl = keepUrl; storage.clear(); save();
      toast('Semua data sudah dihapus.');
      renderHome(); show('home');
    });
    show('guide', { push });
  }

  /* ---------- Tombol global ---------- */
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) {
      const t = go.dataset.go;
      if (current === 'play' && S) { exitSession(); return; }
      if (t === 'home') { renderHome(); show('home'); }
      else if (t === 'map') goMap();
      else if (t === 'progress') renderProgress('child');
      else if (t === 'guide') renderGuide();
      return;
    }
    const act = e.target.closest('[data-action]');
    if (act) {
      const a = act.dataset.action;
      if (a === 'start') requirePlayer(goMap);
      else if (a === 'levels') requirePlayer(goMap);
      else if (a === 'progress') requirePlayer(() => renderProgress('child'));
      else if (a === 'guide') renderGuide();
    }
  });

  $('#playerChip').addEventListener('click', () => { if (current === 'play' && S) { exitSession(); return; } renderProgress('child'); });
  $('#soundBtn').addEventListener('click', () => {
    store.settings.sound = !store.settings.sound;
    if (!store.settings.sound) Speech.stop();
    save(); updateTopbar();
    toast(store.settings.sound ? 'Suara dinyalakan.' : 'Suara dimatikan.');
  });

  /* ---------- Mulai ---------- */
  Speech.init();
  flushSheet();
  showStorageNote();
  renderHome();
  show('home', { push: false, noFocus: true });
  try { history.replaceState({ screen: 'home' }, '', location.pathname + location.search); } catch (e) { /* abaikan */ }

  // Untuk pengujian otomatis
  window.SNA.App = { get session() { return S; }, get store() { return store; } };
})();
