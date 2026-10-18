/*
 * GOOGLE SPREADSHEET (opsional) — Sedjati Numeracy Adventure
 * ---------------------------------------------------------------
 * Jika URL Apps Script diisi (config.js atau menu Panduan), setiap
 * misi/tes yang selesai dikirim ke spreadsheet guru:
 *   - tab "Riwayat"     : satu baris per misi/tes
 *   - tab "Rekap Siswa" : satu baris per anak (selalu terbaru)
 * Jika internet putus, data disimpan dulu di antrean perangkat dan
 * dikirim ulang otomatis. Penyimpanan lokal tetap berjalan seperti biasa.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./curriculum.js'), require('./progress.js'));
  else { root.SNA = root.SNA || {}; root.SNA.Sheet = factory(root.SNA.Curriculum, root.SNA.Progress); }
})(typeof self !== 'undefined' ? self : this, function (C, P) {
  'use strict';

  const QUEUE_KEY = 'sedjati-numeracy-adventure:antrean';
  const MAX_QUEUE = 300;
  const URL_RE = /^https:\/\/script\.google(usercontent)?\.com\/[^\s"'<>]+$/;

  const validUrl = u => typeof u === 'string' && URL_RE.test(u.trim());
  const pct = v => (v == null ? '' : Math.round(v * 100));

  /* Ringkasan kondisi anak saat ini (untuk tab "Rekap Siswa") */
  function snapshot(p, settings) {
    let attempted = 0, points = 0;
    const ops = {};
    C.OPS.forEach(o => {
      const s = P.opStatus(p, o.id);
      attempted += s.attempted; points += s.first + 0.5 * s.helped;
      ops[o.id] = s.attempted ? `${s.label} · ${pct(s.accuracy)}% dari ${s.attempted} soal` : 'Belum dicoba';
    });
    const rec = P.recommend(p, settings || {});
    const ini = p.assess.initial;
    return {
      stars: P.totalStars(p),
      missions: P.completedCount(p),
      badges: P.BADGES.filter(b => p.badges[b.id]).map(b => b.name).join(', '),
      attempted,
      accuracy: attempted ? Math.round(points / attempted * 100) : '',
      ops,
      needsPractice: C.OPS.filter(o => P.opStatus(p, o.id).needsPractice).map(o => o.name).join(', '),
      next: rec ? `${C.AREA_BY_ID[rec.area].name}: ${C.AREA_BY_ID[rec.area].steps[rec.step].title}` : 'Semua misi selesai',
      initial: ini ? Object.keys(ini.areas).map(a => `${C.AREA_BY_ID[a].name} ${ini.areas[a].correct}/${ini.areas[a].total}`).join('; ') : '',
      finals: Object.keys(p.assess.final).map(a => `${C.AREA_BY_ID[a].name} ${p.assess.final[a].correct}/${p.assess.final[a].total}`).join('; ')
    };
  }

  /*
   * Satu catatan yang dikirim ke spreadsheet.
   * info: { kind: 'mission'|'review'|'diagnostic'|'final', area, step, result, note }
   */
  function buildRecord(p, settings, info) {
    const group = (C.GROUPS.find(g => g.id === p.group) || {}).name || '';
    const r = info.result || {};
    const a = C.AREA_BY_ID[info.area];
    const kindName = { mission: 'Misi', review: 'Latihan Ulang', diagnostic: 'Tes Awal', final: 'Tes Akhir' }[info.kind] || 'Misi';
    const result = {
      kind: kindName,
      level: a ? String(a.level) : '',
      area: a ? a.name : (info.kind === 'diagnostic' ? 'Beberapa area' : ''),
      mission: a && info.kind === 'mission' ? `Misi ${info.step + 1}: ${a.steps[info.step].title}` : (info.kind === 'review' ? 'Soal-soal yang sulit' : ''),
      total: r.total || 0,
      first: r.first || 0,
      helped: r.helped || 0,
      wrong: r.wrong || 0,
      percent: r.score != null ? pct(r.score) : (r.total ? Math.round((r.correct || 0) / r.total * 100) : ''),
      stars: info.kind === 'mission' ? (r.stars || 0) : '',
      completed: info.kind === 'mission' ? !!r.completed : null,
      note: info.note || '',
      newBadges: (r.newBadges || []).map(b => b.name).join(', ')
    };
    return {
      app: 'sedjati-numeracy', v: 1, time: Date.now(),
      playerId: p.id, name: p.name, group, mode: C.MODES[p.mode].name,
      result, snapshot: snapshot(p, settings)
    };
  }

  /*
   * Pengirim dengan antrean offline.
   * opts: { getUrl(), storage (localStorage atau null), fetch }
   */
  function createSender(opts) {
    const ls = opts.storage;
    const doFetch = opts.fetch;
    let memQueue = [];
    let flushing = null;

    const readQ = () => {
      if (!ls) return memQueue.slice();
      try { const q = JSON.parse(ls.getItem(QUEUE_KEY) || '[]'); return Array.isArray(q) ? q.filter(x => x && x.app === 'sedjati-numeracy') : []; }
      catch (e) { return []; }
    };
    const writeQ = q => {
      const trimmed = q.slice(-MAX_QUEUE);
      if (!ls) { memQueue = trimmed; return; }
      try { ls.setItem(QUEUE_KEY, JSON.stringify(trimmed)); } catch (e) { memQueue = trimmed; }
    };

    async function post(rec, url) {
      // text/plain agar tidak ada preflight CORS ke Apps Script
      const res = await doFetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(rec) });
      const j = await res.json();
      if (!j || !j.ok) throw new Error((j && j.error) || 'gagal');
    }

    async function flush() {
      const url = opts.getUrl();
      if (!validUrl(url)) return 0;
      if (flushing) return flushing;
      flushing = (async () => {
        const q = readQ();
        if (!q.length) return 0;
        let sent = 0;
        const left = [];
        for (let i = 0; i < q.length; i++) {
          try { await post(q[i], url); sent++; }
          catch (e) { left.push(...q.slice(i)); break; } // berhenti saat gagal, coba lagi nanti
        }
        // gabungkan dengan catatan baru yang masuk selama pengiriman
        const now = readQ();
        writeQ(left.concat(now.slice(q.length)));
        return sent;
      })();
      try { return await flushing; } finally { flushing = null; }
    }

    // Hasil: 'sheet' (terkirim), 'queued' (menunggu internet), 'local' (spreadsheet belum diatur)
    async function send(rec) {
      const url = opts.getUrl();
      if (!validUrl(url)) return 'local';
      writeQ(readQ().concat([rec]));
      await flush();
      return readQ().some(x => x.time === rec.time && x.playerId === rec.playerId) ? 'queued' : 'sheet';
    }

    async function test(url) {
      if (!validUrl(url)) return { ok: false, error: 'URL harus diawali https://script.google.com/ dan berakhiran /exec' };
      try {
        const res = await doFetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=ping');
        const j = await res.json();
        if (j && j.ok && j.app === 'sedjati-numeracy') return { ok: true };
        if (j && j.ok) return { ok: false, error: 'URL ini milik aplikasi lain. Pakai Apps Script dari folder numerasi-sedjati/apps-script.' };
        return { ok: false, error: 'Apps Script menjawab dengan galat.' };
      } catch (e) {
        return { ok: false, error: 'Tidak bisa terhubung. Cek internet dan pastikan akses "Siapa saja".' };
      }
    }

    return { send, flush, test, pending: () => readQ().length };
  }

  return { validUrl, snapshot, buildRecord, createSender, QUEUE_KEY };
});
