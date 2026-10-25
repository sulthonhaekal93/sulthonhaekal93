/* Tes tampilan dengan Chromium: `node tests/ui.test.js [folder-screenshot]`
 * Halaman Index.html dirakit seperti HtmlService, dan google.script.run
 * diteruskan ke Code.gs yang berjalan di atas Google Sheets tiruan. */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createGas } = require('./gas-mock');

const dir = path.join(__dirname, '..', 'apps-script');
const shotDir = process.argv[2];
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

function buildPage(gas) {
  const boot = JSON.stringify(gas.call('getPublicSettings')).replace(/</g, '\\u003c');
  const mock = `<script>
    (function () {
      function runner(ok, fail) {
        return new Proxy({}, { get: function (_, name) {
          if (name === 'withSuccessHandler') return function (fn) { return runner(fn, fail); };
          if (name === 'withFailureHandler') return function (fn) { return runner(ok, fn); };
          return function () {
            var args = JSON.stringify([].slice.call(arguments));
            window.__gas(name, args).then(function (r) { ok && ok(r === undefined ? undefined : JSON.parse(r)); }, function (e) { fail && fail(e); });
          };
        } });
      }
      window.google = { script: { get run() { return runner(); } } };
    })();
  </script>`;
  return fs.readFileSync(path.join(dir, 'Index.html'), 'utf8')
    .replace("<?!= include('Styles'); ?>", fs.readFileSync(path.join(dir, 'Styles.html'), 'utf8'))
    .replace("<?!= include('Scripts'); ?>", fs.readFileSync(path.join(dir, 'Scripts.html'), 'utf8'))
    .replace('<?!= bootJson ?>', boot)
    .replace('<base target="_top">', '<base target="_top">' + mock);
}

async function run(viewport, label) {
  const gas = createGas();
  gas.call('setupSpreadsheet');
  gas.call('loadDemoData');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  let offline = false;
  await page.exposeFunction('__gas', async (name, args) => {
    await new Promise(r => setTimeout(r, 150));
    if (offline) throw new Error('offline');
    const res = gas.call(name, ...JSON.parse(args));
    return res === undefined ? undefined : JSON.stringify(res);
  });
  await page.setContent(buildPage(gas), { waitUntil: 'load' });
  const shot = async n => shotDir && page.screenshot({ path: path.join(shotDir, label + '-' + n + '.png'), fullPage: true });

  // Awal: hanya formulir, tanpa data murid.
  ok(await page.isVisible('#viewLogin') && !(await page.isVisible('#viewDash')), label + ': hanya form verifikasi');
  const html0 = await page.content();
  ok(!html0.includes('Aisyah Putri') && !html0.includes('DEMO01'), label + ': tidak ada data murid di halaman awal');
  ok(await page.getAttribute('#inNama', 'placeholder') === 'Cari nama anak...', label + ': placeholder');
  await shot('1-login');

  await page.click('#btnLogin');
  ok((await page.textContent('#loginMsg')).includes('nama anak'), label + ': validasi form kosong');

  await page.fill('#inNama', 'Ahmad Fauzan');
  await page.fill('#inKode', 'SALAH9');
  await page.click('#btnLogin');
  await page.waitForFunction(() => !document.getElementById('btnLogin').disabled && !document.getElementById('loginMsg').hidden && document.getElementById('loginMsg').textContent.includes('tidak cocok'));
  ok(true, label + ': kode salah ditolak');
  await shot('2-salah');

  await page.fill('#inNama', 'budi contoh');
  await page.fill('#inKode', 'demo04');
  await page.click('#btnLogin');
  await page.waitForFunction(() => document.getElementById('loginMsg').textContent.includes('Nonaktif'));
  ok(true, label + ': murid nonaktif');

  offline = true;
  await page.fill('#inNama', 'ahmad fauzan');
  await page.fill('#inKode', 'demo01');
  await page.click('#btnLogin');
  await page.waitForFunction(() => document.getElementById('loginMsg').textContent.includes('koneksi internet'));
  ok(true, label + ': gangguan koneksi');
  offline = false;

  await page.fill('#inKode', 'demo01');
  await page.click('#btnLogin');
  await page.waitForSelector('#viewDash:not([hidden])');
  ok((await page.textContent('#childName')) === 'Ahmad Fauzan', label + ': nama anak tampil');
  ok(await page.isVisible('#demoBanner'), label + ': pita DATA DEMO');
  ok((await page.inputValue('#inKode')) === '', label + ': kode dihapus dari form');
  const cards = await page.$$eval('#scheduleList .sched h3', els => els.map(e => e.textContent));
  ok(JSON.stringify(cards) === JSON.stringify(['Bahasa Inggris', 'Matematika']), label + ': dua kartu program ' + cards);
  ok((await page.textContent('#scheduleList')).includes('Senin dan Rabu'), label + ': hari jamak');
  ok((await page.$$('#scheduleList [data-izin]')).length === 2, label + ': tombol izin per kartu');
  await shot('3-daftar');

  await page.click('#tabDay');
  ok(await page.isVisible('#scheduleDays') && !(await page.isVisible('#scheduleList')), label + ': tampilan per hari');
  const days = await page.$$eval('#scheduleDays .day', els => els.map(e => e.querySelector('.day-head span').textContent));
  ok(days.join(',') === 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu', label + ': 7 hari berurutan');
  ok((await page.$$('#scheduleDays .day-empty')).length === 4, label + ': hari tanpa jadwal diberi keterangan');
  await shot('4-perhari');
  await page.click('#tabList');

  // Admin mengganti tutor -> Perbarui Jadwal.
  const data = gas.sheets.get('Jadwal').data;
  data.find(r => r[0] === 'DEMO-J02')[6] = 'Kak Fajar';
  await page.click('#btnRefresh');
  await page.waitForFunction(() => document.getElementById('scheduleList').textContent.includes('Kak Fajar'));
  ok(true, label + ': perubahan tutor muncul setelah Perbarui Jadwal');

  // Modal izin
  await page.click('#scheduleList [data-izin="DEMO-J01"]');
  await page.waitForSelector('#modal:not([hidden])');
  ok((await page.textContent('#izNama')) === 'Ahmad Fauzan' && (await page.textContent('#izProgram')) === 'Bahasa Inggris', label + ': modal terisi otomatis');
  const opts = await page.$$eval('#izTanggal option', os => os.map(o => o.textContent).slice(1));
  ok(opts.length > 0 && opts.every(t => /^(Senin|Rabu), /.test(t)), label + ': hanya tanggal Senin/Rabu');
  await page.click('#btnIzin');
  ok((await page.textContent('#izinMsg')).includes('Formulir belum lengkap'), label + ': validasi izin');
  await shot('5-modal');
  await page.selectOption('#izTanggal', { index: 1 });
  await page.click('.chip:has-text("Sakit")');
  await page.fill('#izCatatan', 'Sedang demam.');
  await page.click('#btnIzin');
  await page.waitForSelector('#izinDone:not([hidden])');
  const href = await page.getAttribute('#waLink', 'href');
  ok(href.startsWith('https://wa.me/6285743008511?text='), label + ': tautan WhatsApp admin');
  const msg = decodeURIComponent(href.split('?text=')[1]);
  ok(msg.includes('Program: Bahasa Inggris') && msg.includes('Hari/tanggal pertemuan: ' + opts[0].replace(' (hari ini)', '')) && msg.includes('Jam belajar: 15.30–16.30'), label + ': isi pesan sesuai');
  ok((await page.textContent('#sendNote')).includes('tekan tombol Kirim'), label + ': pengingat tekan Kirim');
  ok((await page.textContent('#doneCode')).includes('menunggu konfirmasi admin'), label + ': status jujur');
  await shot('6-whatsapp');
  await page.click('#izinDone [data-close]');
  ok(!(await page.isVisible('#modal')), label + ': modal tertutup');

  // Tidak ada scroll horizontal di HP.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 0, label + ': tanpa scroll horizontal (' + overflow + ')');

  await page.click('#btnLogout');
  ok(await page.isVisible('#viewLogin') && !(await page.content()).includes('Kak Fajar'), label + ': keluar menghapus jadwal dari layar');

  ok(errors.length === 0, label + ': tanpa error JS: ' + errors.join(' | '));
  await browser.close();
}

(async () => {
  if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
  await run({ width: 390, height: 844 }, 'hp');
  await run({ width: 1280, height: 860 }, 'desktop');
  console.log('ui: ' + checks + ' pemeriksaan lulus');
})().catch(e => { console.error(e); process.exit(1); });
