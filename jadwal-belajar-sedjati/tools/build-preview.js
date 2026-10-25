/* Membuat satu file HTML pratinjau (tanpa akun Google) dari kode yang sama:
 *   node tools/build-preview.js <output.html>
 * Code.gs + DemoData.gs berjalan di browser di atas Google Sheets tiruan
 * (data hanya di memori), dan di bawah halaman ada simulasi panel Sheets. */
'use strict';
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'apps-script');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const out = process.argv[2] || path.join(__dirname, '..', 'preview.html');

const backend = `
<script>
/* ===== Google Apps Script tiruan (browser) ===== */
(function () {
  function toDisplay(v) { var s = String(v == null ? '' : v); return s.charAt(0) === "'" ? s.slice(1) : s; }
  function makeRange(sheet, r, c, nr, nc) {
    var range = {
      getSheet: function () { return sheet; }, getRow: function () { return r; }, getLastRow: function () { return r + nr - 1; },
      getColumn: function () { return c; }, getNumColumns: function () { return nc; },
      getDisplayValues: function () { sheet.ensure(r + nr - 1, c + nc - 1); return sheet.data.slice(r - 1, r - 1 + nr).map(function (row) { return row.slice(c - 1, c - 1 + nc).map(String); }); },
      getValues: function () { return range.getDisplayValues(); },
      setValues: function (vals) { sheet.ensure(r + vals.length - 1, c + vals[0].length - 1); vals.forEach(function (row, i) { row.forEach(function (v, j) { sheet.data[r - 1 + i][c - 1 + j] = toDisplay(v); }); }); return range; },
      setValue: function (v) { return range.setValues([[v]]); }
    };
    ['setNumberFormat', 'setDataValidation', 'setFontWeight', 'setBackground', 'setFontColor', 'setNotes'].forEach(function (k) { range[k] = function () { return range; }; });
    return range;
  }
  function makeSheet(name) {
    var sheet = { data: [], name: name };
    sheet.getName = function () { return name; };
    sheet.getLastRow = function () { for (var r = sheet.data.length - 1; r >= 0; r--) if (sheet.data[r].some(function (v) { return String(v) !== ''; })) return r + 1; return 0; };
    sheet.getLastColumn = function () { var m = 0; sheet.data.forEach(function (row) { row.forEach(function (v, c) { if (String(v) !== '') m = Math.max(m, c + 1); }); }); return m; };
    sheet.ensure = function (r, c) { while (sheet.data.length < r) sheet.data.push([]); sheet.data.forEach(function (row) { while (row.length < c) row.push(''); }); };
    sheet.getRange = function (r, c, nr, nc) { return makeRange(sheet, r, c, nr || 1, nc || 1); };
    sheet.getDataRange = function () { return makeRange(sheet, 1, 1, Math.max(sheet.getLastRow(), 1), Math.max(sheet.getLastColumn(), 1)); };
    sheet.appendRow = function (row) { var r = sheet.getLastRow() + 1; sheet.ensure(r, row.length); row.forEach(function (v, i) { sheet.data[r - 1][i] = toDisplay(v); }); };
    sheet.deleteRow = function (r) { sheet.data.splice(r - 1, 1); };
    sheet.setFrozenRows = sheet.setColumnWidth = function () {};
    return sheet;
  }
  var sheets = {};
  var order = [];
  var ss = {
    getSheetByName: function (n) { return sheets[n] || null; },
    insertSheet: function (n) { sheets[n] = makeSheet(n); order.push(n); return sheets[n]; },
    getSheets: function () { return order.map(function (n) { return sheets[n]; }); },
    deleteSheet: function (s) { delete sheets[s.name]; order = order.filter(function (n) { return n !== s.name; }); },
    setSpreadsheetTimeZone: function () {}
  };
  var cache = {};
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').replace(/(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-');
  }
  function bytesOf(s) { // hash 32 byte sederhana (cukup untuk pratinjau, bukan kriptografi)
    var out = [];
    for (var k = 0; k < 32; k++) { var h = 2166136261 ^ k; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } out.push(((h >>> 0) % 256) - 128); }
    return out;
  }
  function parts(d, tz) {
    var o = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  var env = {
    SpreadsheetApp: { getActiveSpreadsheet: function () { return ss; }, getUi: function () { throw new Error('no ui'); }, flush: function () {},
      newDataValidation: function () { var b = { requireValueInList: function () { return b; }, setAllowInvalid: function () { return b; }, build: function () { return {}; } }; return b; } },
    CacheService: { getScriptCache: function () { return { get: function (k) { return k in cache ? cache[k] : null; }, put: function (k, v) { cache[k] = String(v); }, remove: function (k) { delete cache[k]; } }; } },
    LockService: { getScriptLock: function () { return { tryLock: function () { return true; }, waitLock: function () {}, releaseLock: function () {} }; } },
    ScriptApp: { getProjectTriggers: function () { return []; }, deleteTrigger: function () {}, newTrigger: function () { var t = {}; ['timeBased', 'everyDays', 'atHour', 'inTimezone', 'create'].forEach(function (k) { t[k] = function () { return t; }; }); return t; } },
    HtmlService: {},
    Utilities: {
      formatDate: function (d, tz, f) { var p = parts(d, tz); return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second); },
      getUuid: uuid, sleep: function () {},
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: function (a, s) { return bytesOf(String(s)); }
    }
  };
  window.__GAS__ = (function (SpreadsheetApp, CacheService, LockService, ScriptApp, HtmlService, Utilities) {
/*__CODE__*/
    return {
      call: function (fn, args) { MEMO_ = {}; return eval(fn).apply(null, args); },
      onEdit: function (e) { MEMO_ = {}; onEdit(e); }
    };
  })(env.SpreadsheetApp, env.CacheService, env.LockService, env.ScriptApp, env.HtmlService, env.Utilities);
  window.__GAS__.sheets = sheets;
  window.__GAS__.order = function () { return order.slice(); };
  window.__GAS__.reset = function () {
    Object.keys(sheets).forEach(function (k) { delete sheets[k]; }); order.length = 0;
    Object.keys(cache).forEach(function (k) { delete cache[k]; });
    window.__GAS__.call('setupSpreadsheet', []);
    window.__GAS__.call('loadDemoData', []);
  };
  window.__GAS__.reset();

  var PUBLIC = ['verifyStudentAccess', 'getStudentSchedule', 'logLeaveRequest', 'getPublicSettings'];
  function runner(ok, fail) {
    var r = { withSuccessHandler: function (fn) { return runner(fn, fail); }, withFailureHandler: function (fn) { return runner(ok, fn); } };
    PUBLIC.forEach(function (name) {
      r[name] = function () {
        var args = JSON.parse(JSON.stringify([].slice.call(arguments)));
        setTimeout(function () {
          if (window.__OFFLINE__) { fail && fail(new Error('offline')); return; }
          try {
            var res = window.__GAS__.call(name, args);
            ok && ok(res === undefined ? undefined : JSON.parse(JSON.stringify(res)));
            window.dispatchEvent(new Event('gas-change'));
          } catch (e) { console.error(e); fail && fail(e); }
        }, 350);
      };
    });
    return r;
  }
  window.google = { script: { get run() { return runner(); } } };
})();
</script>`;

// Fungsi Code.gs dipanggil lewat nama; ganti eval dengan tabel fungsi agar tidak memakai eval.
const code = read('Code.gs') + '\n' + read('DemoData.gs');
const fnTable = '{' + ['verifyStudentAccess', 'getStudentSchedule', 'logLeaveRequest', 'getPublicSettings', 'setupSpreadsheet',
  'loadDemoData', 'removeDemoData', 'fillMissingIds', 'checkData', 'cleanupOldLeaveRequests'].map(f => f + ':' + f).join(',') + '}';
const backendFinal = backend
  .replace('/*__CODE__*/', code.replace(/\$/g, '$$$$'))
  .replace('return eval(fn).apply(null, args);', 'return (' + fnTable + ')[fn].apply(null, args);');

const sheetPanel = `
<section class="sim wrap" aria-labelledby="simTitle">
  <div class="sim-head">
    <div>
      <p class="sim-eyebrow">Mode pratinjau</p>
      <h2 id="simTitle">Simulasi Google Sheets (admin)</h2>
      <p class="muted small">Ubah sel di bawah seperti admin mengedit Sheets, lalu tekan "Perbarui Jadwal" di atas. Data hanya tersimpan di browser ini dan kembali seperti semula saat halaman dimuat ulang.</p>
    </div>
    <div class="sim-actions">
      <button type="button" class="btn btn-soft" id="simCheck">Periksa kesalahan data</button>
      <button type="button" class="btn btn-soft" id="simFill">Lengkapi ID &amp; kode akses</button>
      <button type="button" class="btn btn-ghost" id="simReset">Kembalikan data demo</button>
      <label class="sim-offline"><input type="checkbox" id="simOffline"> Simulasikan internet putus</label>
    </div>
  </div>
  <div id="simReport" class="alert alert-info" hidden></div>
  <div class="tabs sim-tabs" role="tablist" id="simTabs"></div>
  <div class="sim-table-wrap"><table class="sim-table" id="simTable"></table></div>
  <button type="button" class="btn btn-ghost" id="simAddRow">+ Tambah baris</button>
  <div class="sim-codes">
    <strong>Akun demo untuk dicoba:</strong>
    Ahmad Fauzan / DEMO01 (2 program) · Aisyah Putri / DEMO02 · Muhammad Raihan / DEMO03 · Budi Contoh / DEMO04 (murid nonaktif)
  </div>
</section>
<style>
  .preview-bar { background: #111827; color: #F9FAFB; font-size: 13px; padding-block: 10px; }
  .preview-bar .wrap { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .preview-bar strong { color: var(--yellow); }
  .sim { margin-top: 8px; padding-block: 24px 40px; border-top: 2px dashed var(--line); }
  .sim-head { display: grid; gap: 14px; }
  .sim-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--orange); }
  .sim h2 { font-size: 20px; margin: 2px 0 6px; }
  .sim-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .sim-actions .btn { min-height: 42px; font-size: 14px; padding: 8px 14px; }
  .sim-offline { display: inline-flex; gap: 6px; align-items: center; font-weight: 500; margin: 0; font-size: 14px; }
  .sim-tabs { grid-template-columns: repeat(4, 1fr); }
  .sim-tabs button { font-size: 13px; padding: 8px 4px; }
  .sim-table-wrap { overflow-x: auto; background: var(--white); border-radius: var(--radius-sm); box-shadow: var(--shadow); }
  .sim-table { border-collapse: collapse; font-size: 13px; min-width: 100%; }
  .sim-table th { background: var(--green); color: #fff; text-align: left; padding: 8px; white-space: nowrap; font-weight: 600; }
  .sim-table td { border-top: 1px solid var(--line); padding: 0; }
  .sim-table td.rn, .sim-table th.rn { color: var(--muted); background: var(--bg); text-align: center; padding: 6px; font-variant-numeric: tabular-nums; }
  .sim-table input { border: 0; padding: 8px; width: 100%; min-width: 110px; font-size: 13px; background: transparent; }
  .sim-table input:focus { outline: 2px solid var(--yellow); background: var(--yellow-soft); }
  .sim-table tr.flash td { background: var(--yellow-soft); }
  #simAddRow { margin-top: 10px; min-height: 40px; font-size: 14px; }
  .sim-codes { margin-top: 16px; font-size: 13px; background: var(--yellow-soft); color: #713F12; padding: 12px 14px; border-radius: var(--radius-sm); }
  #simReport ul { margin: 6px 0 0; padding-left: 18px; }
</style>
<script>
(function () {
  var G = window.__GAS__;
  var current = 'Jadwal';
  var tabs = ['Murid', 'Jadwal', 'Perizinan', 'Pengaturan'];
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function renderTabs() {
    $('simTabs').innerHTML = tabs.map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (t === current) + '" data-t="' + t + '">' + t + '</button>';
    }).join('');
  }
  function renderTable() {
    var sh = G.sheets[current];
    if (!sh) { $('simTable').innerHTML = ''; return; }
    var data = sh.data.filter(function (row, i) { return i === 0 || row.some(function (v) { return v !== ''; }); });
    var head = data[0] || [];
    var html = '<thead><tr><th class="rn">#</th>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>';
    for (var r = 1; r < data.length; r++) {
      var rowIndex = sh.data.indexOf(data[r]);
      html += '<tr><td class="rn">' + (rowIndex + 1) + '</td>' + head.map(function (_, c) {
        return '<td><input id="c-' + current + '-' + rowIndex + '-' + c + '" data-r="' + rowIndex + '" data-c="' + c + '" value="' + esc(data[r][c] == null ? '' : data[r][c]) + '" aria-label="' + esc(head[c]) + ' baris ' + (rowIndex + 1) + '"></td>';
      }).join('') + '</tr>';
    }
    if (data.length <= 1) html += '<tr><td class="rn"></td><td colspan="' + head.length + '" style="padding:12px;color:var(--muted)">Belum ada baris.</td></tr>';
    $('simTable').innerHTML = html + '</tbody>';
  }
  function render() { renderTabs(); renderTable(); }
  function report(title, items) {
    var el = $('simReport');
    el.innerHTML = '<div><strong>' + esc(title) + '</strong>' + (items && items.length ? '<ul>' + items.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    el.hidden = false;
  }
  $('simTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-t]'); if (!b) return;
    current = b.getAttribute('data-t'); render();
  });
  $('simTable').addEventListener('change', function (e) {
    var inp = e.target; if (!inp.matches('input[data-r]')) return;
    var sh = G.sheets[current]; var r = +inp.getAttribute('data-r'); var c = +inp.getAttribute('data-c');
    sh.ensure(r + 1, c + 1); sh.data[r][c] = inp.value;
    G.onEdit({ range: sh.getRange(r + 1, c + 1) }); // updated_at otomatis seperti onEdit di Sheets
    var focusId = inp.id; renderTable();
    var tr = document.getElementById(focusId); if (tr) tr.closest('tr').classList.add('flash');
  });
  $('simAddRow').addEventListener('click', function () {
    var sh = G.sheets[current]; var w = (sh.data[0] || []).length;
    var r = sh.getLastRow() + 1; sh.ensure(r, w); renderTable();
    var first = document.getElementById('c-' + current + '-' + (r - 1) + '-' + (current === 'Murid' || current === 'Jadwal' ? 1 : 0));
    if (first) first.focus();
  });
  $('simCheck').addEventListener('click', function () {
    var p = G.call('checkData', []);
    report(p.length ? 'Ditemukan ' + p.length + ' hal yang perlu diperbaiki:' : 'Data terlihat rapi. Tidak ada kesalahan yang ditemukan.', p);
  });
  $('simFill').addEventListener('click', function () {
    var f = G.call('fillMissingIds', []);
    report('Selesai: ' + f.murid + ' student_id, ' + f.kode + ' kode akses, ' + f.jadwal + ' schedule_id baru.'); render();
  });
  $('simReset').addEventListener('click', function () {
    G.reset(); $('simReport').hidden = true; render();
    report('Data demo dikembalikan. Jika sedang masuk di atas, tekan "Keluar" lalu masuk lagi.');
  });
  $('simOffline').addEventListener('change', function () { window.__OFFLINE__ = this.checked; });
  window.addEventListener('gas-change', function () { if (current === 'Perizinan') renderTable(); else { var b = document.querySelector('[data-t="Perizinan"]'); if (b) b.textContent = 'Perizinan (' + (G.sheets.Perizinan.getLastRow() - 1) + ')'; } });
  render();
})();
</script>`;

let index = read('Index.html');
const bodyStart = index.indexOf('<body>') + '<body>'.length;
const bodyEnd = index.indexOf('</body>');
let body = index.slice(bodyStart, bodyEnd)
  .replace('<script>window.__BOOT__ = <?!= bootJson ?>;</script>', '<script>window.__BOOT__ = window.__GAS__.call("getPublicSettings", []);</script>')
  .replace("<?!= include('Scripts'); ?>", read('Scripts.html'))
  .replace('<footer class="footer wrap">', sheetPanel + '\n  <footer class="footer wrap">');

const html = `<title>Jadwal Belajar Sedjati</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
${read('Styles.html')}
<style>:root { color-scheme: light; } body { background: var(--bg); }</style>
${backendFinal}
<div class="preview-bar"><div class="wrap"><strong>PRATINJAU</strong><span>Kode website asli dengan data demo di browser. Setelah di-deploy, data dibaca dari Google Sheets Anda.</span></div></div>
${body}`;
fs.writeFileSync(out, html);
console.log('Pratinjau ditulis ke ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
