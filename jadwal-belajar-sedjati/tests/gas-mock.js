/* Tiruan minimal Google Apps Script (SpreadsheetApp, CacheService, dll.)
 * untuk menjalankan Code.gs + DemoData.gs di Node tanpa akun Google. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function makeSheet(name, ss) {
  const sheet = {
    data: [],
    name,
    getName: () => name,
    getLastRow() {
      for (let r = sheet.data.length - 1; r >= 0; r--) if (sheet.data[r].some(v => String(v) !== '')) return r + 1;
      return 0;
    },
    getLastColumn() {
      let max = 0;
      sheet.data.forEach(row => row.forEach((v, c) => { if (String(v) !== '') max = Math.max(max, c + 1); }));
      return max;
    },
    ensure(r, c) {
      while (sheet.data.length < r) sheet.data.push([]);
      sheet.data.forEach(row => { while (row.length < c) row.push(''); });
    },
    getRange(r, c, nr = 1, nc = 1) { return makeRange(sheet, r, c, nr, nc); },
    getDataRange() { return makeRange(sheet, 1, 1, Math.max(sheet.getLastRow(), 1), Math.max(sheet.getLastColumn(), 1)); },
    appendRow(row) {
      const r = sheet.getLastRow() + 1;
      sheet.ensure(r, row.length);
      row.forEach((v, i) => { sheet.data[r - 1][i] = toDisplay(v); });
    },
    deleteRow(r) { sheet.data.splice(r - 1, 1); },
    setFrozenRows() {}, setColumnWidth() {}
  };
  return sheet;
}
// Sheets mengubah teks berawalan apostrof menjadi teks biasa (apostrof tak terlihat).
function toDisplay(v) { const s = String(v == null ? '' : v); return s.startsWith("'") ? s.slice(1) : s; }

function makeRange(sheet, r, c, nr, nc) {
  const range = {
    getSheet: () => sheet, getRow: () => r, getLastRow: () => r + nr - 1, getColumn: () => c, getNumColumns: () => nc,
    getDisplayValues() {
      sheet.ensure(r + nr - 1, c + nc - 1);
      return sheet.data.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc).map(String));
    },
    getValues() { return range.getDisplayValues(); },
    setValues(vals) {
      sheet.ensure(r + vals.length - 1, c + vals[0].length - 1);
      vals.forEach((row, i) => row.forEach((v, j) => { sheet.data[r - 1 + i][c - 1 + j] = toDisplay(v); }));
      return range;
    },
    setValue(v) { return range.setValues([[v]]); },
    setNumberFormat: () => range, setDataValidation: () => range, setFontWeight: () => range,
    setBackground: () => range, setFontColor: () => range, setNotes: () => range
  };
  return range;
}

function createGas(opts = {}) {
  const sheets = new Map();
  const ss = {
    getSheetByName: n => sheets.get(n) || null,
    insertSheet: n => { const s = makeSheet(n, ss); sheets.set(n, s); return s; },
    getSheets: () => [...sheets.values()],
    deleteSheet: s => sheets.delete(s.name),
    setSpreadsheetTimeZone() {}
  };
  const cacheStore = new Map();
  const logs = [];
  const fmtParts = (d, tz) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(d).map(p => [p.type, p.value]));
  const validationBuilder = () => { const b = { requireValueInList: () => b, setAllowInvalid: () => b, build: () => ({}) }; return b; };

  const context = {
    console: { log: m => logs.push(String(m)), error: m => logs.push('ERR ' + m) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => (opts.unbound ? null : ss),
      getUi: () => { throw new Error('No UI in test'); },
      flush() {},
      newDataValidation: validationBuilder
    },
    CacheService: { getScriptCache: () => ({
      get: k => (cacheStore.has(k) ? cacheStore.get(k) : null),
      put: (k, v) => cacheStore.set(k, String(v)),
      remove: k => cacheStore.delete(k)
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => { const t = { timeBased: () => t, everyDays: () => t, atHour: () => t, inTimezone: () => t, create: () => t }; return t; } },
    HtmlService: {},
    Utilities: {
      formatDate(d, tz, fmt) {
        const p = fmtParts(d, tz);
        return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day)
          .replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
      },
      getUuid: () => crypto.randomUUID(),
      sleep() {},
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => [...crypto.createHash('sha256').update(String(s), 'utf8').digest()].map(b => (b > 127 ? b - 256 : b))
    }
  };
  vm.createContext(context);
  const dir = path.join(__dirname, '..', 'apps-script');
  ['Code.gs', 'DemoData.gs'].forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), context, { filename: f }));

  /** Tiap panggilan = satu eksekusi Apps Script baru (memo direset), hasil di-serialisasi seperti google.script.run. */
  function call(fn, ...args) {
    context.MEMO_ = {};
    const res = context[fn](...JSON.parse(JSON.stringify(args)));
    return res === undefined ? undefined : JSON.parse(JSON.stringify(res));
  }
  return { ctx: context, ss, sheets, cacheStore, logs, call };
}

module.exports = { createGas };
