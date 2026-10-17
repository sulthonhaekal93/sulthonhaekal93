/*
 * Tes ujung-ke-ujung di browser sungguhan (Playwright + Chromium).
 *   npm install --no-save playwright   (sekali saja)
 *   node tests/e2e.test.js
 * Set SHOTS=folder untuk menyimpan tangkapan layar.
 */
'use strict';
const assert = require('assert');
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright'); }

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOTS = process.env.SHOTS || '';
const KEY = 'sedjati-numeracy-adventure:v1';
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); console.log('  ✓ ' + m); };

async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); }

async function noOverflow(page, label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  ok(r.sw <= r.w, `${label}: tidak ada geser horizontal (${r.sw} ≤ ${r.w})`);
}

async function clickByValue(page, value) {
  await page.evaluate(v => {
    const b = Array.from(document.querySelectorAll('#answers .choice')).find(x => x.dataset.value === v && !x.disabled);
    if (!b) throw new Error('pilihan tidak ditemukan: ' + v);
    b.click();
  }, value);
}

async function current(page) {
  return page.evaluate(() => {
    const c = window.SNA.App.session && window.SNA.App.session.cur;
    if (!c) return null;
    return {
      type: c.interaction.type, method: c.interaction.type === 'count' ? c.interaction.answer : c.interaction.type,
      ans: c.q.answer, manip: c.q.manip, numeric: c.q.numeric, choices: c.q.choices.map(x => x.value),
      remove: c.q.visual ? c.q.visual.remove : 0, area: c.q.area, step: c.q.step, done: c.done
    };
  });
}

/* Jawab soal aktif lewat UI. mode: 'right' | 'wrong' */
async function answer(page, mode) {
  const c = await current(page);
  const answersShown = await page.locator('#answers .choice, #answers .keypad').count();
  if (c.type === 'count' && !answersShown) {
    if (c.manip === 'count') {
      while (await page.locator('#stage .obj.tappable').count()) await page.locator('#stage .obj.tappable').first().click();
    } else if (c.manip === 'takeaway') {
      for (let i = 0; i < c.remove; i++) await page.locator('#stage .obj.tappable').nth(i).click();
    } else if (c.manip === 'groups') {
      while (await page.locator('#stage .tappable').count()) await page.locator('#stage .tappable').first().click();
    }
    await page.waitForSelector('#answers .choice, #answers .keypad');
  }
  let value = c.ans;
  if (mode === 'wrong') {
    if (await page.locator('#answers .keypad').count()) value = String(Number(c.ans) + 1);
    else {
      value = await page.evaluate(a => {
        const b = Array.from(document.querySelectorAll('#answers .choice')).find(x => !x.disabled && x.dataset.value !== a);
        return b ? b.dataset.value : a; // hanya tersisa jawaban benar
      }, c.ans);
    }
  }
  if (await page.locator('#answers .keypad').count()) {
    for (const ch of value) await page.click(`#answers .key[data-d="${ch}"]`);
    await page.click('#answers [data-ok]');
  } else {
    await clickByValue(page, value);
  }
  return c;
}

async function playMission(page, pattern) {
  // pattern: array 'right'|'wrong-right'|'wrong-wrong' per soal; berulang jika kurang
  let i = 0;
  for (let guard = 0; guard < 40; guard++) {
    if (await page.locator('#screen-summary:not([hidden])').count()) return;
    const p = pattern[i % pattern.length];
    if (p === 'right') await answer(page, 'right');
    else {
      await answer(page, 'wrong');
      await page.waitForSelector('#feedback.fb-try');
      if (p === 'wrong-right') await answer(page, 'right');
      else await answer(page, 'wrong');
    }
    await page.waitForSelector('#feedback [data-next]');
    i++;
    await page.click('#feedback [data-next]');
  }
  throw new Error('misi tidak selesai');
}

(async () => {
  const browser = await pw.chromium.launch();
  const errors = [];
  const newPage = async (vp, init) => {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
    await page.goto(URL);
    return page;
  };

  console.log('A. Beranda, profil, tes awal (320px)');
  let page = await newPage({ width: 320, height: 640 });
  ok(await page.isVisible('text=Belajar, Bermain, Berhitung!'), 'tagline tampil');
  ok(await page.isHidden('#playerChip'), 'belum ada pemain → chip tersembunyi');
  await noOverflow(page, 'beranda 320');
  await shot(page, 'a1-home-320');
  await page.click('[data-action=start]');
  ok(await page.isVisible('#profileForm'), 'tombol Mulai Petualangan membuka profil');
  await page.fill('input[name=name]', 'Muhammad Abdurrahman Wahid Panjang Sekali');
  await page.check('input[name=group][value=sd12]', { force: true });
  await noOverflow(page, 'profil 320');
  await shot(page, 'a2-profile-320');
  await page.click('#profileForm button[type=submit]');
  ok(await page.isVisible('[data-diag]'), 'tawaran tes awal muncul');
  let stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  const pid = stored.currentId;
  ok(stored.players[pid].name.length === 20, 'nama panjang dipotong 20 huruf');
  await page.click('[data-diag]');
  for (let i = 0; i < 8; i++) {
    await page.waitForSelector('#answers .choice, #answers .keypad');
    await answer(page, i % 3 === 2 ? 'wrong' : 'right');
    ok(await page.isVisible('#feedback.fb-neutral'), `tes awal soal ${i + 1}: umpan balik netral`);
    await page.click('#feedback [data-next]');
  }
  ok(await page.isVisible('text=Tes Awal selesai!'), 'tes awal selesai');
  stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  ok(stored.players[pid].assess.initial && Object.keys(stored.players[pid].assess.initial.areas).length === 4, 'hasil tes awal tersimpan');
  await shot(page, 'a3-diag-result-320');
  await page.click('[data-go=map]:visible');
  ok(await page.isVisible('.trail'), 'peta tampil');
  ok(await page.locator('.stop').count() === 6, '6 area di peta');
  ok(await page.isHidden('[data-diag]'), 'kartu tes awal hilang setelah dikerjakan');
  await noOverflow(page, 'peta 320');
  await shot(page, 'a4-map-320');
  const chipW = await page.evaluate(() => document.querySelector('#playerChip').getBoundingClientRect().right);
  ok(chipW <= 320, 'nama panjang tidak merusak bar atas');

  console.log('B. Pilih level, misi, umpan balik');
  await page.click('[data-area=add]');
  ok(await page.locator('.missions .ms').count() === 5, 'area penjumlahan punya 5 misi');
  ok(await page.locator('.ms.is-locked button').count() === 0, 'misi terkunci bukan tombol');
  await noOverflow(page, 'area 320');
  await shot(page, 'b1-area-320');
  await page.click('.ms-btn[data-step="1"]');
  ok(await page.isVisible('text=Tujuan belajar'), 'pengantar misi menampilkan tujuan');
  ok(await page.isVisible('.example .equation'), 'pengantar menampilkan contoh');
  await noOverflow(page, 'pengantar 320');
  await shot(page, 'b2-intro-320');
  await page.click('[data-start]');
  await page.waitForSelector('#screen-play:not([hidden])');
  await noOverflow(page, 'soal 320');
  await shot(page, 'b3-play-320');
  // Soal 1: salah → bantuan → benar
  await answer(page, 'wrong');
  ok(await page.isVisible('text=Tidak apa-apa, kita coba bersama, ya!'), 'salah pertama: pesan ramah & coba lagi');
  ok(await page.locator('#feedback [data-next]').count() === 0, 'belum boleh lanjut, coba lagi dulu');
  await shot(page, 'b4-try-320');
  await answer(page, 'right');
  ok(await page.isVisible('#feedback.fb-ok'), 'benar setelah mencoba lagi');
  ok(await page.isVisible('text=pantang menyerah'), 'pujian usaha');
  await page.click('#feedback [data-next]');
  // Soal 2: salah dua kali → penjelasan + jawaban
  await answer(page, 'wrong'); await page.waitForSelector('#feedback.fb-try'); await answer(page, 'wrong');
  ok(await page.isVisible('#feedback.fb-learn') && await page.isVisible('text=Jawaban yang benar'), 'salah kedua: penjelasan lengkap');
  await noOverflow(page, 'penjelasan 320');
  await shot(page, 'b5-learn-320');
  await page.click('#feedback [data-next]');
  ok(await page.isVisible('.chip-note'), 'soal berikutnya ditandai "soal mirip"');
  await playMission(page, ['right']);
  ok(await page.isVisible('#screen-summary .big-stars'), 'ringkasan dengan bintang');
  ok(await page.isVisible('text=Benar langsung'), 'ringkasan rinci');
  await noOverflow(page, 'ringkasan 320');
  await shot(page, 'b6-summary-320');
  stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  const m = stored.players[pid].missions['add-1'];
  ok(m && m.completed && m.stars >= 2, `misi tersimpan selesai (${m && m.stars} bintang)`);
  ok(stored.players[pid].ops.add.attempted >= 8, 'statistik penjumlahan bertambah');
  const chipStars = await page.textContent('#chipStars');
  ok(Number(chipStars) === m.stars, 'bintang di bar atas ikut berubah');

  console.log('C. Main lagi (restart) & keluar');
  await page.click('[data-again]');
  ok(await page.isVisible('#screen-play:not([hidden])'), 'Main lagi memulai ulang misi');
  await page.click('[data-exit]');
  ok(await page.isVisible('#modal:not([hidden])'), 'konfirmasi keluar');
  await page.click('#modalCancel');
  ok(await page.isVisible('#screen-play:not([hidden])'), 'batal keluar → tetap bermain');
  await playMission(page, ['wrong-wrong']);
  stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  ok(stored.players[pid].missions['add-1'].stars === m.stars, 'bintang lama tidak hilang setelah misi buruk');
  ok(await page.isVisible('text=Kerja bagus, terus berlatih!'), 'misi kurang berhasil tetap disemangati');

  console.log('D. Progres & reset');
  await page.click('#playerChip');
  ok(await page.isVisible('text=Koleksi lencana'), 'dasbor anak');
  await noOverflow(page, 'progres anak 320');
  await shot(page, 'd1-progress-child-320');
  await page.click('[data-tab=adult]');
  ok(await page.isVisible('text=Kemampuan per operasi'), 'dasbor orang tua');
  ok(await page.isVisible('text=Soal yang sulit baru-baru ini'), 'daftar soal sulit');
  await noOverflow(page, 'progres dewasa 320');
  await shot(page, 'd2-progress-adult-320');
  await page.click('[data-review]');
  ok(await page.isVisible('text=Latihan Ulang Soal Sulit'), 'latihan ulang dimulai');
  await playMission(page, ['right']);
  ok(await page.isVisible('text=Latihan ulang selesai!'), 'latihan ulang selesai');
  await page.click('#playerChip');
  await page.click('[data-tab=adult]');
  await page.click('[data-reset]');
  await page.click('#modalCancel');
  stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  ok(Object.keys(stored.players[pid].missions).length > 0, 'batal reset → progres tetap');
  await page.click('[data-reset]');
  await page.click('#modalOk');
  stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  ok(Object.keys(stored.players[pid].missions).length === 0 && stored.players[pid].name.length === 20, 'reset menghapus progres, nama tetap');

  console.log('E. Muat ulang halaman & tombol kembali');
  await page.reload();
  ok(await page.isVisible('#welcomeBack'), 'pemain diingat setelah muat ulang');
  await page.click('[data-action=levels]');
  ok(await page.isVisible('.trail'), 'Pilih Level → peta');
  await page.click('[data-area=sub]');
  await page.goBack();
  ok(await page.isVisible('.trail'), 'tombol kembali browser → peta');
  await page.close();

  console.log('F. Mode TK: hitung benda, pembagian berbagi (390px)');
  page = await newPage({ width: 390, height: 844 });
  await page.click('[data-action=start]');
  await page.check('input[name=group][value=tk]', { force: true });
  ok(await page.isHidden('#answerField'), 'TK: pilihan cara menjawab disembunyikan');
  await page.click('#profileForm button[type=submit]');
  await page.click('[data-skip]');
  ok((await page.textContent('.rec')).includes('Kebun Angka'), 'TK disarankan mulai dari Kebun Angka');
  await page.click('[data-rec]');
  await page.click('[data-start]');
  for (let i = 0; i < 5; i++) {
    const c = await current(page);
    ok(c.choices.length <= 3, `TK soal ${i + 1}: maksimal 3 pilihan`);
    ok(await page.locator('#answers .keypad').count() === 0, `TK soal ${i + 1}: tanpa ketik angka`);
    await answer(page, 'right');
    await page.click('#feedback [data-next]');
  }
  ok(await page.isVisible('text=Misi Selesai!'), 'misi TK selesai');
  await shot(page, 'f1-tk-summary-390');
  // Buka misi pembagian (eksplorasi) & coba bagikan permen
  await page.click('[data-go=map]:visible');
  await page.click('[data-area=div]');
  ok(await page.isVisible('#screen-area >> text=Eksplorasi'), 'TK: pembagian ditandai eksplorasi');
  await page.click('.ms-btn[data-step="0"]');
  await page.click('[data-start]');
  ok(await page.locator('#stage .vis-share').count() === 1, 'pembagian: anak membagikan benda');
  await page.click('#stage .share-bar .btn-soft');
  ok(await page.locator('#stage .kid-plate .obj').count() === 1, 'Bagikan 1 memindahkan satu benda');
  await page.click('#stage .share-bar .btn-ghost');
  await page.waitForFunction(() => !document.querySelector('#stage .pile .obj'));
  ok(true, 'Bagikan semua menghabiskan tumpukan');
  await shot(page, 'f2-share-390');
  await page.close();

  console.log('G. Data rusak & penyimpanan tidak tersedia');
  page = await newPage({ width: 768, height: 1024 }, `localStorage.setItem('${KEY}', '{ini bukan json');`);
  ok(await page.isVisible('#storageNote'), 'data rusak: pesan ditampilkan');
  await page.click('[data-action=start]');
  ok(await page.isVisible('#profileForm'), 'data rusak: aplikasi tetap jalan');
  await page.close();
  page = await newPage({ width: 768, height: 1024 }, `localStorage.setItem('${KEY}', JSON.stringify({players:{p1:{name:'<img src=x onerror=alert(1)>', missions:{'add-1':{stars:'x'}}, ops:5}}, currentId:'p1'}));`);
  ok(await page.locator('img').count() === 0, 'nama berbahaya tidak dirender sebagai HTML');
  await page.click('[data-action=progress]');
  ok(await page.isVisible('text=Koleksi lencana'), 'data aneh tetap bisa dibuka');
  await page.close();
  page = await newPage({ width: 1280, height: 900 }, `Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError'); } });`);
  ok(await page.isVisible('#storageNote'), 'tanpa localStorage: pesan ditampilkan');
  await page.click('[data-action=start]');
  await page.click('[data-guest]');
  await page.click('[data-skip]');
  await page.click('[data-rec]');
  await page.click('[data-start]');
  await answer(page, 'right');
  ok(await page.isVisible('#feedback.fb-ok'), 'tanpa localStorage: tetap bisa bermain');
  await page.close();

  console.log('H. Tata letak tablet & desktop, panduan, hapus semua');
  for (const vp of [{ width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
    page = await newPage(vp);
    await noOverflow(page, `beranda ${vp.width}`);
    await shot(page, `h-home-${vp.width}`);
    await page.click('[data-action=start]');
    await page.click('[data-guest]');
    await page.click('[data-skip]');
    await noOverflow(page, `peta ${vp.width}`);
    await shot(page, `h-map-${vp.width}`);
    await page.click('[data-area=mul]');
    await page.click('.ms-btn[data-step="0"]');
    await page.click('[data-start]');
    await noOverflow(page, `soal ${vp.width}`);
    await shot(page, `h-play-${vp.width}`);
    await playMission(page, ['right', 'wrong-right']);
    await page.click('[data-go=map]:visible');
    await page.click('.brand');
    await page.click('[data-action=guide]');
    ok(await page.isVisible('text=Enam level kemampuan'), 'panduan tampil');
    await noOverflow(page, `panduan ${vp.width}`);
    await page.click('#setUnlock');
    let st = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    ok(st.settings.unlockAll === true, 'pengaturan tersimpan');
    await page.click('#soundBtn');
    st = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    ok(st.settings.sound === false, 'tombol suara berfungsi');
    await page.click('[data-wipe]');
    await page.click('#modalOk');
    st = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
    ok(!st || Object.keys(st.players).length === 0, 'hapus semua data');
    ok(await page.isVisible('#screen-home:not([hidden])'), 'kembali ke beranda');
    await page.close();
  }

  console.log('I. SD Challenge: susun angka, tantangan waktu, tes akhir');
  page = await newPage({ width: 412, height: 915 });
  await page.click('[data-action=start]');
  await page.check('input[name=group][value=sd56]', { force: true });
  await page.check('input[name=answer][value=type]', { force: true });
  await page.check('input[name=timed]');
  await page.click('#profileForm button[type=submit]');
  await page.click('[data-skip]');
  await page.click('[data-area=div]');
  await page.click('.ms-btn[data-step="2"]');
  await page.click('[data-start]');
  ok(await page.isVisible('.timer'), 'penghitung waktu opsional tampil');
  ok(await page.locator('#answers .keypad').count() === 1, 'mode ketik: papan angka tampil');
  await page.keyboard.type('9');
  ok((await page.textContent('#buildDisplay')).includes('9'), 'papan angka mendukung keyboard');
  await page.click('#answers [data-del]');
  await shot(page, 'i1-builder-412');
  await playMission(page, ['right']);
  await page.click('[data-go=map]:visible');
  await page.click('[data-area=div]');
  await page.click('.ms-btn[data-step="1"]');
  await page.click('[data-start]');
  await playMission(page, ['right']);
  await page.click('[data-go=map]:visible');
  await page.click('[data-area=div]');
  await page.click('[data-final]');
  for (let i = 0; i < 6; i++) { await answer(page, i === 0 ? 'wrong' : 'right'); await page.click('#feedback [data-next]'); }
  ok(await page.isVisible('text=5 dari 6'), 'hasil tes akhir tepat');
  ok(await page.isVisible('text=Belum cukup data'), 'tidak klaim peningkatan tanpa tes awal');
  await shot(page, 'i2-final-412');
  await page.close();

  await browser.close();
  ok(errors.length === 0, 'tidak ada error JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\n✔ e2e.test.js: ${checks} pengecekan lulus`);
})().catch(e => { console.error(e); process.exit(1); });
