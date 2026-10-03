/* ===================================================================== Spenden (Beta): Kontoauszüge einlesen, Maßnahmen zuordnen, auswerten */

// Die Exporte (CSV oder Excel) liegen im Mailing-Ordner im Unterordner „Spendeneingänge …“ (z. B. „Spendeneingänge 2027“) – einfach hineinlegen.
// Die App liest alle Dateien darin beim Öffnen des Reiters, beim Zurückkehren ins Fenster, alle zwei Minuten (solange der Reiter offen ist)
// und auf Knopfdruck. Buchungen, die in mehreren Exporten stehen (überlappende Zeiträume), zählen nur einmal.
// In der Planungsdatei stehen nur die Zuordnungen (Schlüssel → Maßnahme, Datum, Betrag); Namen, IBAN und Verwendungszweck bleiben in den Dateien.
// D.spenden: zu = zugeordnet { Schlüssel: { m, d, b (Cent) } } · vor = von Hand zur Prüfung vorgemerkt { Schlüssel: Maßnahme }
//            nein = Vorschlag einer Regel abgelehnt { Schlüssel: [Maßnahmen] }.  Regel je Maßnahme: m.regel = { worte, ab, bis } (Tage ab PAL)
const SP_DIR_RE = /^Spendeneing/i, SP_FILE_RE = /\.(csv|txt|xlsx)$/i, SP_MAX = 400, SP_TAGE = 182;
// Richtwerte (Einstellungen, standardmäßig ausgeblendet); Vorgabe aus der Mailing-Übersicht (postalische Sendungen)
const SP_RICHT0 = { an: false, resp: [2.7, 4.4], roi: [4, 5] };
const spRicht = () => Object.assign({}, SP_RICHT0, (D && D.settings && isObj(D.settings.richtwerte)) ? D.settings.richtwerte : {});
const SP = { rows: [], byKey: new Map(), files: [], dirs: [], cache: new Map(), busy: null, at: null, state: null, dups: 0, neg: 0, sig: '' };
const SPUI = { sel: { l: new Set(), m: new Set(), r: new Set() }, order: {}, last: {}, f: { q: '', von: '', bis: '' }, fmid: null };

const eur = c => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const eur0 = c => Math.round(c / 100).toLocaleString('de-DE') + ' €';
const num1 = v => v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const spCount = n => n.toLocaleString('de-DE') + (n === 1 ? ' Spende' : ' Spenden');

/* ---------- Dateien lesen: CSV (Semikolon, Komma oder Tab; UTF-8 oder Windows-1252) und Excel (.xlsx) */
function spDecode(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return new TextDecoder('utf-8').decode(u8.subarray(3));
  if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8.subarray(2));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { return new TextDecoder('windows-1252').decode(u8); }
}
function csvRows(text) {
  const nl = text.indexOf('\n'), first = nl < 0 ? text : text.slice(0, nl), cnt = c => first.split(c).length;
  const sep = [';', '\t', ','].reduce((a, c) => cnt(c) > cnt(a) ? c : a, ';');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"' && f === '') q = true;
    else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}
// Zip lesen (Excel-Dateien sind Zip-Archive); entpackt wird mit dem Browser (DecompressionStream)
function zipIndex(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), out = new Map(), dec = new TextDecoder();
  let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('keine gültige Excel-Datei');
  let p = dv.getUint32(e + 16, true);
  for (let i = 0, n = dv.getUint16(e + 10, true); i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    out.set(dec.decode(u8.subarray(p + 46, p + 46 + nl)), { meth: dv.getUint16(p + 10, true), csz: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) });
    p += 46 + nl + xl + cl;
  }
  return { u8, dv, out };
}
async function zipText(z, name) {
  const e = z.out.get(name); if (!e) return null;
  const st = e.off + 30 + z.dv.getUint16(e.off + 26, true) + z.dv.getUint16(e.off + 28, true), data = z.u8.subarray(st, st + e.csz);
  if (e.meth === 0) return new TextDecoder().decode(data);
  if (e.meth !== 8) throw new Error('Excel-Datei mit unbekannter Komprimierung');
  return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
}
const colIdx = ref => { let c = 0; for (const ch of ref.replace(/\d+$/, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
async function xlsxRows(buf) {
  const z = zipIndex(buf), P = s => new DOMParser().parseFromString(s, 'application/xml');
  let path = 'xl/worksheets/sheet1.xml';
  const wbx = await zipText(z, 'xl/workbook.xml'), sheet = wbx && P(wbx).getElementsByTagName('sheet')[0], rid = sheet && sheet.getAttribute('r:id');
  const rels = rid && await zipText(z, 'xl/_rels/workbook.xml.rels');
  if (rels) for (const r of P(rels).getElementsByTagName('Relationship')) if (r.getAttribute('Id') === rid) { const t = r.getAttribute('Target'); path = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, ''); }
  const ssx = await zipText(z, 'xl/sharedStrings.xml'), ss = [];
  if (ssx) for (const si of P(ssx).getElementsByTagName('si')) ss.push([...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
  const shx = await zipText(z, path); if (!shx) throw new Error('kein Tabellenblatt gefunden');
  const rows = [];
  for (const row of P(shx).getElementsByTagName('row')) {
    const r = []; let ci = 0;
    for (const c of row.getElementsByTagName('c')) {
      const ref = c.getAttribute('r'); if (ref) ci = colIdx(ref);
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], vt = v ? v.textContent : '';
      r[ci++] = t === 's' ? ss[+vt] ?? '' : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map(x => x.textContent).join('') : t === 'str' || t === 'e' || t === 'b' ? vt : vt !== '' ? +vt : '';
    }
    rows.push(Array.from(r, x => x ?? ''));
  }
  return rows;
}

/* ---------- Spalten erkennen, Werte deuten, Schlüssel bilden */
const SP_COLS = [['d', /^(buchungsdatum|buchungstag|datum)$/], ['v', /^(valuta|valutadatum|wertstellung)/], ['b', /^betrag/], ['bic', /blz|bic/], ['iban', /iban|kontonummer/],
  ['name', /^(kontoinhaber|auftraggeber|name)/], ['typ', /^typ$/], ['zweck', /^verwendungszweck/], ['text', /^buchungstext/], ['konto', /^personenname$/]];
const spClean = v => String(v ?? '').replace(/^'+/, '').replace(/\s+/g, ' ').trim();
const spSqueeze = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
function spHeader(row) {
  const map = {}, used = new Set(), cells = row.map(v => spClean(v).toLowerCase());
  for (const [k, rx] of SP_COLS) { const i = cells.findIndex((c, j) => !used.has(j) && rx.test(c)); if (i >= 0) { map[k] = i; used.add(i); } }
  return map;
}
function spDate(v) {
  if (typeof v === 'number') return v > 20000 && v < 80000 ? Math.floor(v) - 25569 : null;   // Excel-Datum
  const s = spClean(v); let q;
  if ((q = /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/.exec(s))) return dn((q[3].length === 2 ? '20' + q[3] : q[3]) + '-' + q[2] + '-' + q[1]);
  if ((q = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return dn(q[1] + '-' + q[2] + '-' + q[3]);
  return null;
}
function spCents(v) {
  if (typeof v === 'number') return Math.round(v * 100);
  let s = spClean(v).replace(/EUR|€|\s/gi, ''), neg = false;
  if (/^[-–]|[-–]$/.test(s)) { neg = true; s = s.replace(/[-–]/g, ''); }
  s = s.replace(/^\+/, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const c = Math.round(parseFloat(s) * 100);
  return neg ? -c : c;
}
// Kurzer Schlüssel je Buchung (cyrb53); identische Zeilen innerhalb einer Datei bekommen -2, -3 … (zwei gleiche Spenden am selben Tag zählen doppelt)
function spHash(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function spRecords(rows) {
  let hi = -1, map = null;
  for (let i = 0; i < Math.min(rows.length, 15) && hi < 0; i++) { const mp = spHeader(rows[i]); if (mp.d != null && mp.b != null) { hi = i; map = mp; } }
  if (hi < 0) return { err: 'Spalten „Buchungsdatum“ und „Betrag“ nicht gefunden' };
  const recs = [], cnt = new Map(); let neg = 0, bad = 0;
  for (const r of rows.slice(hi + 1)) {
    const g = k => map[k] != null ? r[map[k]] : '';
    const d = spDate(g('d')), b = spCents(g('b'));
    if (d == null || b == null) { bad++; continue; }
    if (b <= 0) { neg++; continue; }                         // Abbuchungen, Rücklastschriften: keine Spenden
    const rec = { d, v: spDate(g('v')), b, bic: spClean(g('bic')), iban: spClean(g('iban')).replace(/\s/g, '').toUpperCase(), name: spClean(g('name')), typ: spClean(g('typ')),
      zweck: spClean(g('zweck')), text: spClean(g('text')), konto: spClean(g('konto')) };
    rec.sq = spSqueeze(rec.zweck);
    const base = [rec.d, rec.v ?? '', rec.b, rec.iban, rec.name.toUpperCase(), rec.zweck.toUpperCase(), rec.text.toUpperCase()].join('|');
    const n = (cnt.get(base) || 0) + 1; cnt.set(base, n);
    rec.k = spHash(base) + (n > 1 ? '-' + n : '');
    recs.push(rec);
  }
  return { recs, neg, bad };
}

/* ---------- Ordner „Spendeneingänge …“ durchsuchen und alle Dateien zusammenführen */
async function spDirs() {
  const out = [], seen = new Set();
  for (const r of [ST.htmlDir, ST.dir]) {
    if (!r || seen.has(r)) continue; seen.add(r);
    try { for await (const [n, e] of r.entries()) if (e.kind === 'directory' && SP_DIR_RE.test(n)) out.push({ h: e, name: n, path: r.name + '/' + n }); } catch (x) { /* Ordner gerade nicht lesbar */ }
  }
  return out.filter((d, i) => out.findIndex(o => o.path === d.path) === i);
}
async function spCollect(d, path, out, depth) {
  for await (const [n, e] of d.entries()) {
    if (/^(~\$|\.)/.test(n)) continue;                          // Sperrdateien von Excel, versteckte Dateien
    if (e.kind === 'file' && SP_FILE_RE.test(n)) out.push({ h: e, path: path + '/' + n, name: n });
    else if (e.kind === 'directory' && depth < 1) await spCollect(e, path + '/' + n, out, depth + 1);
  }
}
async function spReadFile(name, buf) {
  const rows = /\.xlsx$/i.test(name) ? await xlsxRows(buf) : csvRows(spDecode(buf));
  return spRecords(rows);
}
function spScan(opts = {}) {
  if (SP.busy) return SP.busy;
  SP.busy = (async () => {
    try {
      if (!FSA || ST.conn !== 'ok' || !ST.htmlDir) { SP.state = 'nofolder'; return; }
      const dirs = await spDirs(), list = [];
      for (const d of dirs) try { await spCollect(d.h, d.path, list, 0); } catch (x) { /* */ }
      const files = [];
      for (const fe of list) {
        let f;
        try { f = await fe.h.getFile(); } catch (e) { files.push({ path: fe.path, name: fe.name, err: 'nicht lesbar (wird vielleicht noch synchronisiert)' }); continue; }
        const c = SP.cache.get(fe.path);
        if (c && c.lm === f.lastModified && c.size === f.size) { files.push(c); continue; }
        let r;
        try { r = await spReadFile(f.name, await f.arrayBuffer()); } catch (e) { r = { err: (e && e.message) || String(e) }; }
        const ent = Object.assign({ path: fe.path, name: fe.name, lm: f.lastModified, size: f.size }, r);
        if (!r.err) SP.cache.set(fe.path, ent);
        files.push(ent);
      }
      const by = new Map(); let dups = 0, neg = 0;
      for (const e of files) {
        if (e.err) continue;
        neg += e.neg;
        for (const r of e.recs) { const o = by.get(r.k); if (o) { dups++; if (!o.files.includes(e.name)) o.files.push(e.name); } else by.set(r.k, Object.assign({}, r, { files: [e.name] })); }
      }
      const before = SP.rows.length, sig = [...by.keys()].length + '|' + files.map(f => f.path + ':' + (f.lm || f.err)).join(',');
      SP.rows = [...by.values()].sort((a, b) => a.d - b.d || b.b - a.b);
      SP.byKey = by; SP.files = files; SP.dirs = dirs.map(d => d.name); SP.dups = dups; SP.neg = neg; SP.at = Date.now();
      SP.state = dirs.length ? 'ok' : 'nodir';
      if (opts.manual) toast(SP.state === 'nodir' ? 'Noch kein Ordner „Spendeneingänge …“ im Mailing-Ordner.' : SP.rows.length.toLocaleString('de-DE') + ' Buchungen aus ' + files.filter(f => !f.err).length + ' Datei(en) eingelesen' +
        (SP.rows.length > before && before ? ' – ' + (SP.rows.length - before) + ' neu' : '') + '.', 'ok');
      if (sig !== SP.sig || opts.manual) { SP.sig = sig; requestRender(); }
    } catch (e) { console.warn(e); SP.state = 'err'; SP.err = (e && e.message) || String(e); requestRender(); }
    finally { SP.busy = null; }
  })();
  return SP.busy;
}
setInterval(() => { if (D && UI.view === 'spenden' && !document.hidden && ST.conn === 'ok' && !DRAG) spScan(); }, 120000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && D && UI.view === 'spenden' && ST.conn === 'ok') spScan(); });
window.addEventListener('focus', () => { if (D && UI.view === 'spenden' && ST.conn === 'ok') spScan(); });   // Fenster wieder vorn (z. B. aus dem Explorer)
let _spLastView = null;

// Dateien in den Ordner legen (Knopf oder Hineinziehen) – danach neu einlesen
async function spAddFiles(files) {
  files = [...files];
  if (!files.length) return;
  if (!FSA || ST.conn !== 'ok' || !ST.htmlDir) { toast('Bitte zuerst den Mailing-Ordner verbinden (oben „Speichern“).', 'warn'); return; }
  const bad = files.filter(f => !SP_FILE_RE.test(f.name));
  if (bad.length) toast('Nur CSV- und Excel-Dateien (.csv, .xlsx): ' + bad.map(f => f.name).join(', ') + ' übersprungen.', 'warn');
  const ok = files.filter(f => SP_FILE_RE.test(f.name)); if (!ok.length) return;
  try {
    const dirs = await spDirs(), want = 'Spendeneingänge ' + UI.year;
    const dir = (dirs.find(d => d.name === want) || dirs.sort((a, b) => b.name.localeCompare(a.name))[0] || {}).h || await ST.htmlDir.getDirectoryHandle(want, { create: true });
    for (const f of ok) {
      const buf = new Uint8Array(await f.arrayBuffer());
      let name = f.name, i = 1;
      for (;;) {                                                  // gleicher Name mit anderem Inhalt: nicht überschreiben, sondern „(2)“ anhängen
        let ex = null; try { ex = await (await dir.getFileHandle(name)).getFile(); } catch (e) { break; }
        if (ex.size === buf.length && crc32(new Uint8Array(await ex.arrayBuffer())) === crc32(buf)) { name = null; break; }
        name = f.name.replace(/(\.[^.]+)$/, ' (' + (++i) + ')$1');
      }
      if (!name) continue;
      const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(buf); await w.close();
    }
  } catch (e) { console.warn(e); toast('Datei ließ sich nicht ablegen: ' + ((e && e.message) || e), 'err'); return; }
  await spScan({ manual: true });
}
function spPickFiles() {
  const inp = h('input', { type: 'file', multiple: true, accept: '.csv,.txt,.xlsx', style: 'display:none', onchange: () => { spAddFiles(inp.files); inp.remove(); } });
  document.body.append(inp); inp.click();
}
async function spMakeDir() {
  if (ST.conn !== 'ok' || !ST.htmlDir) return;
  try { await ST.htmlDir.getDirectoryHandle('Spendeneingänge ' + UI.year, { create: true }); toast('Ordner „Spendeneingänge ' + UI.year + '“ angelegt – dort einfach die Exporte hineinlegen.', 'ok'); }
  catch (e) { toast('Ordner ließ sich nicht anlegen: ' + ((e && e.message) || e), 'err'); }
  await spScan();
}

/* ---------- Regeln: Schlagworte im Verwendungszweck, innerhalb eines Zeitraums (Tage ab PAL – wandert mit, wenn sich der PAL verschiebt) */
// Groß/klein egal. Ein Schlagwort passt als ganzes Wort („JB“ nicht in „JBL“); längere Begriffe (ab 6 Zeichen) auch,
// wenn die Bank sie durch Leerzeichen oder Zeilenumbruch trennt („JAHRESBE RICHT“).
const _spMatch = new Map();
function spMatcher(words) {
  const key = JSON.stringify(words);
  if (_spMatch.has(key)) return _spMatch.get(key);
  const tests = words.map(w => {
    const t = str(w).trim(); if (!t) return null;
    const sq = spSqueeze(t);
    return { word: t, sq: sq.length >= 6 ? sq : null,
      rx: new RegExp('(?<![\\p{L}\\p{N}])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*') + '(?![\\p{L}\\p{N}])', 'iu') };
  }).filter(Boolean);
  const f = rec => { for (const t of tests) if (t.rx.test(rec.zweck) || (t.sq && rec.sq.includes(t.sq))) return t.word; return null; };
  if (_spMatch.size > 300) _spMatch.clear();
  _spMatch.set(key, f);
  return f;
}
function spRange(m) {
  const r = (m && m.regel) || {}, pal = dn(m && m.pal);
  return { a: pal != null && isNum(r.ab) ? pal + +r.ab : null, b: pal != null && isNum(r.bis) ? pal + +r.bis : null };
}
// Vorschläge aller Regeln, Zuordnungen; offen = weder zugeordnet noch bei der Maßnahme zur Prüfung
let _spCmp = { key: null, val: null };
function spCompute() {                                           // wird bei jedem Neuzeichnen gebraucht (Hinweis am Reiter) – nur neu rechnen, wenn sich etwas geändert hat
  const key = SP.sig + '|' + JSON.stringify(D.massnahmen.map(m => [m.id, m.regel, m.pal])) + '|' + JSON.stringify(D.spenden);
  if (_spCmp.key !== key || _spCmp.rows !== SP.rows) _spCmp = { key, rows: SP.rows, val: spComputeNow() };
  return _spCmp.val;
}
// Regel einer Maßnahme als Prüffunktion: Zeitraum, ggf. ohne Daueraufträge, Schlagworte → passendes Schlagwort oder null
function spRuleOf(m) {
  const r = m && m.regel; if (!r || !r.worte || !r.worte.length || dn(m.pal) == null) return null;   // ohne PAL keine Vorschläge (sonst unbegrenzt über alle Jahre)
  const f = spMatcher(r.worte), rg = spRange(m), noDA = r.ohneDA === true;
  return { id: m.id, test: rec => (rg.a != null && rec.d < rg.a) || (rg.b != null && rec.d > rg.b) || (noDA && spIsDA(rec)) ? null : f(rec) };
}
function spComputeNow() {
  const S = D.spenden, mids = new Set(D.massnahmen.map(m => m.id)), rules = D.massnahmen.map(spRuleOf).filter(Boolean);
  const assigned = k => { const z = S.zu[k]; return z && mids.has(z.m) ? z.m : null; };
  const sugg = new Map(); let pend = 0;
  for (const rec of SP.rows) {
    if (assigned(rec.k)) continue;
    let list = null;
    for (const ru of rules) {
      const no = S.nein[rec.k]; if (no && no.includes(ru.id)) continue;
      const w = ru.test(rec); if (w) (list || (list = [])).push({ id: ru.id, w });
    }
    if (list) sugg.set(rec.k, list);
    if (list || (S.vor[rec.k] && mids.has(S.vor[rec.k]))) pend++;
  }
  return { sugg, pend, assigned };
}
const spInCheck = (cmp, k, mid) => D.spenden.vor[k] === mid || (cmp.sugg.get(k) || []).some(s => s.id === mid);
function spPart(mid, cmp) {
  const L = [], M = [], R = [];
  for (const rec of SP.rows) {
    const a = cmp.assigned(rec.k);
    if (a) { if (a === mid) R.push(rec); continue; }
    (spInCheck(cmp, rec.k, mid) ? M : L).push(rec);
  }
  for (const [k, z] of Object.entries(D.spenden.zu)) if (z.m === mid && !SP.byKey.has(k)) R.push({ k, d: dn(z.d), b: z.b, gone: true, zweck: '', name: '', text: '', konto: '', files: [] });
  R.sort((a, b) => a.d - b.d || b.b - a.b);
  return { L, M, R };
}
// alle Zuordnungen je Maßnahme (aus der Planungsdatei – die Auswertung braucht die Dateien nicht)
function spByM() {
  const out = new Map();
  for (const z of Object.values(D.spenden.zu)) { const n = dn(z.d); if (n == null) continue; if (!out.has(z.m)) out.set(z.m, []); out.get(z.m).push({ d: n, b: z.b }); }
  return out;
}
function spStats(m, list) {
  list = list || [];
  const n = list.length, sum = list.reduce((s, z) => s + z.b, 0), bs = list.map(z => z.b).sort((a, b) => a - b);
  const med = n ? (n % 2 ? bs[(n - 1) / 2] : (bs[n / 2 - 1] + bs[n / 2]) / 2) : null;
  const auf = isNum(m.auflage) && +m.auflage > 0 ? +m.auflage : null, kos = isNum(m.kosten) && +m.kosten > 0 ? +m.kosten : null;
  return { n, sum, avg: n ? sum / n : null, med, auf, kos, resp: auf && n ? n / auf * 100 : null, roi: kos ? sum / 100 / kos : null, net: kos != null ? sum - Math.round(kos * 100) : null };
}

/* ---------- Aktionen (alle mit Strg+Z rückgängig) */
function spUnNein(d, k, mid) { const a = (d.spenden.nein[k] || []).filter(x => x !== mid); if (a.length) d.spenden.nein[k] = a; else delete d.spenden.nein[k]; }
function spMove(keys, act, mid) {
  keys = [...keys]; if (act === 'assign') keys = keys.filter(k => SP.byKey.has(k)); if (!keys.length) return;
  const cmp = spCompute(), m = findM(D, mid), nm = '„' + ((m && m.name) || '?') + '“';
  const sum = keys.reduce((s, k) => s + ((SP.byKey.get(k) || D.spenden.zu[k] || {}).b || 0), 0), what = spCount(keys.length) + ' (' + eur(sum) + ')';
  if (act === 'stage') commit(d => { for (const k of keys) { d.spenden.vor[k] = mid; spUnNein(d, k, mid); } }, what + ' zur Prüfung vorgemerkt');
  else if (act === 'unstage') commit(d => {
    for (const k of keys) {
      if (d.spenden.vor[k] === mid) delete d.spenden.vor[k];
      if ((cmp.sugg.get(k) || []).some(s => s.id === mid)) d.spenden.nein[k] = [...new Set([...(d.spenden.nein[k] || []), mid])];   // Regel schlägt sie nicht wieder vor
    }
  }, what + ' zurück zu „Offen“');
  else if (act === 'assign') commit(d => {
    for (const k of keys) { const r = SP.byKey.get(k); if (!r) continue; d.spenden.zu[k] = { m: mid, d: ds(r.d), b: r.b }; delete d.spenden.vor[k]; }
  }, what + ' ' + nm + ' zugeordnet');
  else if (act === 'release') commit(d => {                       // Zuordnung lösen, ganz zurück zu „Offen“; die Regel schlägt sie nicht wieder vor
    const ru = spRuleOf(findM(d, mid));
    for (const k of keys) { delete d.spenden.zu[k]; if (d.spenden.vor[k] === mid) delete d.spenden.vor[k]; const r = SP.byKey.get(k); if (ru && r && ru.test(r)) d.spenden.nein[k] = [...new Set([...(d.spenden.nein[k] || []), mid])]; }
  }, what + ' gelöst – zurück zu „Offen“');
  else if (act === 'unassign') commit(d => {
    for (const k of keys) { if (!d.spenden.zu[k]) continue; delete d.spenden.zu[k]; if (SP.byKey.has(k)) { d.spenden.vor[k] = mid; spUnNein(d, k, mid); } }
  }, what + ' zurück in „Prüfen“');
  Object.values(SPUI.sel).forEach(s => s.clear());
}
function spSetRule(mid, fn, msg) {
  return commit(d => {
    const m = findM(d, mid); if (!m) return;
    const r = Object.assign({ worte: [] }, m.regel); r.worte = (r.worte || []).slice();
    fn(r, m);
    if (!r.worte.length && !isNum(r.ab) && !isNum(r.bis)) delete m.regel; else m.regel = r;
  }, msg);
}
function spAddWord(mid, w) {
  w = str(w).trim().replace(/\s+/g, ' ');
  if (!w) return;
  const m = findM(D, mid); if (!m) return;
  if (((m.regel || {}).worte || []).some(x => x.toLowerCase() === w.toLowerCase())) { toast('„' + w + '“ steht schon in der Regel.'); return; }
  const before = spPart(mid, spCompute()).M.length;
  if (spSetRule(mid, (r, mm) => { r.worte.push(w); if (dn(mm.pal) != null && !isNum(r.ab) && !isNum(r.bis)) { r.ab = 0; r.bis = SP_TAGE; } })) {
    const n = spPart(mid, spCompute()).M.length - before;
    toast('Regel um „' + w + '“ ergänzt – ' + (n > 0 ? spCount(n) + ' neu in „Prüfen“' : 'im Moment keine weitere passende Spende') + '.', 'ok');
  }
}
// Regel neu anwenden: Vorschläge, die mit „zurück“ abgelehnt wurden, kommen wieder in „Prüfen“
function spRejected(mid, cmp) {
  const ru = spRuleOf(findM(D, mid)); if (!ru) return [];
  return SP.rows.filter(rec => !cmp.assigned(rec.k) && (D.spenden.nein[rec.k] || []).includes(mid) && ru.test(rec)).map(rec => rec.k);
}
function spReapply(mid) {
  const keys = spRejected(mid, spCompute()); if (!keys.length) return;
  commit(d => { for (const k of keys) spUnNein(d, k, mid); }, 'Regel neu angewendet – ' + spCount(keys.length) + ' wieder in „Prüfen“');
}
// Zuordnungen und Vormerkungen einer gelöschten Maßnahme entfernen
function spForget(d, mid) {
  const S = d.spenden; if (!S) return;
  for (const k of Object.keys(S.zu)) if (S.zu[k].m === mid) delete S.zu[k];
  for (const k of Object.keys(S.vor)) if (S.vor[k] === mid) delete S.vor[k];
  for (const k of Object.keys(S.nein)) spUnNein(d, k, mid);
}
const spKeyLabel = k => { const r = SP.byKey.get(k) || (D && D.spenden.zu[k]); return r ? 'Spende vom ' + fmtD(typeof r.d === 'number' ? r.d : dn(r.d)) + ' über ' + eur(r.b) : 'Spende ' + k; };

/* ---------- Ansicht */
function spPickM(list) {
  if (list.some(x => x.id === UI.spMid)) return UI.spMid;
  const t = todayDn(), past = list.filter(x => x.pal != null && x.pal <= t);
  return ((past.length ? past[past.length - 1] : list[0]) || {}).id || null;
}
// Zuordnen beginnt am PAL: „von“ = PAL, „bis“ = Ende des Regel-Zeitraums (sonst PAL + 182 Tage)
function spResetFilter(m) {
  const rg = spRange(m), pal = dn(m.pal), b = rg.b ?? (pal != null ? pal + SP_TAGE : null);
  SPUI.f = { q: '', von: pal != null ? ds(pal) : '', bis: b != null ? ds(b) : '' };
}
function spFilter(list) {
  const f = SPUI.f, fa = dn(f.von), fb = dn(f.bis), q = f.q.trim();
  const zm = q ? spMatcher([q]) : null, ql = q.toLowerCase();
  return list.filter(r => (fa == null || r.d >= fa) && (fb == null || r.d <= fb) && !(UI.spHideDA && spIsDA(r)) &&
    (!q || zm(r) || [r.name, r.konto, r.text].some(t => t && t.toLowerCase().includes(ql))));
}
function spTip(r) {
  const line = (k, v) => v ? h('div', null, h('span', { class: 'muted' }, k + ': '), v) : null;
  return h('div', { class: 'sp-tipbox' }, h('b', null, eur(r.b) + ' · ' + fmtW(r.d)),
    r.gone ? h('div', { class: 'muted' }, 'Steht in keiner Datei im Ordner mehr – Datum und Betrag sind in der Planung gespeichert.') : [
      line('Name', r.name), line('IBAN', r.iban), line('Verwendungszweck', r.zweck), line('Buchungstext', r.text), line('Konto', r.konto),
      r.v != null && r.v !== r.d ? line('Valuta', fmtD(r.v)) : null, line('Datei', r.files.join(', '))]);
}
function spStatus() {
  if (!FSA) return h('span', { class: 'muted small' }, 'Dieser Browser kann keine Ordner lesen – bitte Edge verwenden.');
  if (ST.conn !== 'ok') return null;
  const ok = SP.files.filter(f => !f.err), bad = SP.files.filter(f => f.err);
  return h('span', { class: 'sp-status muted small', tip: () => h('div', null, h('b', null, 'Eingelesene Dateien'),
    SP.dirs.length ? h('div', { class: 'muted' }, 'Ordner: ' + SP.dirs.join(', ')) : null,
    SP.files.map(f => h('div', null, f.path.split('/').slice(1).join('/') + ': ' + (f.err ? '⚠ ' + f.err : f.recs.length + ' Buchungen' + (f.neg ? ' (+' + f.neg + ' Abbuchungen ignoriert)' : '') + (f.bad ? ' · ⚠ ' + f.bad + ' Zeile' + (f.bad === 1 ? '' : 'n') + ' ohne lesbares Datum/Betrag' : '')))),
    !SP.files.length ? h('div', { class: 'muted' }, 'Noch keine Dateien.') : null,
    SP.dups ? h('div', { class: 'muted' }, SP.dups + ' Buchungen standen in mehreren Dateien und zählen nur einmal.') : null) },
  SP.busy && !SP.at ? 'liest ein …' : ok.length + ' Datei' + (ok.length === 1 ? '' : 'en') + ' · ' + SP.rows.length.toLocaleString('de-DE') + ' Buchungen' + (SP.at ? ' · ' + new Date(SP.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr' : ''),
  bad.length ? h('span', { class: 'warn' }, ' · ⚠ ' + bad.length + ' nicht lesbar') : null);
}
function spNotice() {
  if (!FSA) return null;
  if (ST.conn !== 'ok') return h('div', { class: 'banner sp-notice' }, h('span', null, 'Die Spendeneingänge liegen im Mailing-Ordner. Dafür muss die App mit dem Ordner verbunden sein. Die Auswertung bisheriger Zuordnungen geht auch so.'),
    h('button', { class: 'primary', onclick: async () => { if (await connectFolder()) { SP.at = null; renderNow(); } } }, 'Mailing-Ordner verbinden …'));
  if (SP.state === 'nodir') return h('div', { class: 'banner sp-notice' }, h('span', null, 'Im Mailing-Ordner gibt es noch keinen Ordner „Spendeneingänge …“. Dort hinein kommen die Exporte (CSV oder Excel) – überlappende Zeiträume sind kein Problem.'),
    h('button', { class: 'primary', onclick: spMakeDir }, 'Ordner „Spendeneingänge ' + UI.year + '“ anlegen'), h('button', { onclick: spPickFiles }, 'Datei hinzufügen …'));
  if (SP.state === 'err') return h('div', { class: 'banner sp-notice err' }, h('span', null, 'Einlesen fehlgeschlagen: ' + SP.err), h('button', { onclick: () => spScan({ manual: true }) }, 'Nochmal'));
  return null;
}
function spOverview(ms, cmp, mid, by) {
  const rows = ms.map(x => ({ x, s: spStats(x.m, by.get(x.id)) })), R = spRicht();
  const tot = rows.reduce((t, r) => ({ n: t.n + r.s.n, sum: t.sum + r.s.sum, auf: t.auf + (r.s.n && r.s.auf ? r.s.auf : 0), kos: t.kos + (r.s.n && r.s.kos ? r.s.kos : 0) }), { n: 0, sum: 0, auf: 0, kos: 0 });
  const cell = (v, cls) => h('td', { class: 'num' + (cls ? ' ' + cls : '') }, v);
  const rt = (v, [lo, hi]) => v == null || !R.an ? '' : v < lo ? ' below' : v > hi ? ' above' : ' within';
  const ids = rows.filter(r => r.s.n && r.x.pal != null).map(r => r.x.id);
  return [
    h('div', { class: 'tablewrap' }, h('table', { class: 'grid sp-ueb', style: { width: 'max(100%, ' + SP_UCOLS.reduce((t, c) => t + spColW(c), 0) + 'px)' } },
      h('colgroup', null, SP_UCOLS.map((c, i) => h('col', { style: i < SP_UCOLS.length - 1 ? { width: spColW(c) + 'px' } : null }))),
      h('thead', null, h('tr', null, SP_UCOLS.map((c, i) => h('th', { class: i > 1 ? 'num' : '' }, c.t,
        i < SP_UCOLS.length - 1 ? h('span', { class: 'col-rs', tip: 'Spaltenbreite ziehen (Doppelklick: zurücksetzen)', onpointerdown: e => spColResize(e, i),
          ondblclick: () => { if (UI.spColW) delete UI.spColW[c.k]; saveUI(); renderNow(); } }) : null)))),
      h('tbody', null, rows.map(({ x, s }) => h('tr', { class: 'sp-urow' + (x.id === mid ? ' on' : ''), dataset: { mid: x.id }, onclick: () => { UI.spMid = x.id; renderNow(); } },
        h('td', null, h('span', { class: 'dot', style: { background: x.color } }), ' ', x.m.name || '(ohne Namen)'),
        h('td', null, x.pal != null ? fmtD(x.pal) : '–'),
        h('td', { class: 'num inp' }, numField(x.m.auflage, 0, v => setM(x.id, 'auflage', v, 'Auflage geändert'), { class: 'numf sp-auf', 'data-fk': 'sp-auf:' + x.id, onclick: e => e.stopPropagation() })),
        h('td', { class: 'num inp' }, numField(x.m.kosten, 2, v => spSetKosten(x.id, v), { class: 'numf sp-kos', 'data-fk': 'sp-kos:' + x.id, onclick: e => e.stopPropagation(),
          tip: 'Gesamtkosten der Maßnahme in € (Druck, Porto, Lettershop …), z. B. 1.234,50' })),
        cell(s.n ? eur0(s.sum) : '–'), cell(s.n || '–'), cell(s.avg != null ? eur(s.avg) : '–'),
        cell(s.resp != null ? num1(s.resp) + ' %' : '–', rt(s.resp, R.resp)), cell(s.roi != null ? num1(s.roi) : '–', rt(s.roi, R.roi))))),
      tot.n ? h('tfoot', null, h('tr', null, h('td', null, 'Summe'), h('td'), cell(tot.auf ? tot.auf.toLocaleString('de-DE') : '–'), cell(tot.kos ? eur0(tot.kos * 100) : '–'), cell(eur0(tot.sum)), cell(tot.n),
        cell(eur(tot.sum / tot.n)), cell(tot.auf ? num1(tot.n / tot.auf * 100) + ' %' : '–'), cell(tot.kos ? num1(tot.sum / 100 / tot.kos) : '–'))) : null)),
    h('p', { class: 'muted small' }, 'Responsequote = Anzahl Spenden ÷ Auflage' + (R.an ? ' (Richtwert ' + num1(R.resp[0]) + '–' + num1(R.resp[1]) + ' %)' : '') + '. ROI = Spendensumme ÷ Kosten, also Spenden je 1 € Kosten' +
      (R.an ? ' (Richtwert ' + num1(R.roi[0]) + '–' + num1(R.roi[1]) + ')' : '') + '. Summen nur über Maßnahmen mit Spenden. Auflage und Kosten hier direkt eintragen. Zeile anklicken wählt die Maßnahme.'),
    ids.length >= 2 ? [h('h3', null, 'Rücklauf im Vergleich (kumuliert, Tage nach PAL)'), h('div', { class: 'sp-chart', dataset: { chart: 'cmp', ids: ids.join(',') } })] : null];
}
const SP_UCOLS = [{ k: 'name', w: 240, t: 'Maßnahme' }, { k: 'pal', w: 104, t: 'PAL' }, { k: 'auf', w: 104, t: 'Auflage' }, { k: 'kos', w: 112, t: 'Kosten' }, { k: 'sum', w: 130, t: 'Spendensumme' },
  { k: 'n', w: 84, t: 'Anzahl' }, { k: 'avg', w: 112, t: 'Ø-Spende' }, { k: 'resp', w: 124, t: 'Responsequote' }, { k: 'roi', w: 80, t: 'ROI' }];
const spColW = c => (UI.spColW && UI.spColW[c.k]) || c.w;
// Spaltenbreite ziehen: nur diese Spalte ändert sich, die letzte nimmt den Rest
function spColResize(ev, i) {
  ev.preventDefault(); ev.stopPropagation();
  const table = ev.currentTarget.closest('table'), col = $$('col', table)[i], w0 = Math.round(ev.currentTarget.parentElement.getBoundingClientRect().width), x0 = ev.clientX;
  document.body.classList.add('dragging', 'resizing');
  let w = w0;
  dragSession(ev, ev.currentTarget, e => { w = Math.max(50, Math.round(w0 + e.clientX - x0)); col.style.width = w + 'px'; }, okay => {
    document.body.classList.remove('dragging', 'resizing');
    if (!okay || w === w0) { col.style.width = spColW(SP_UCOLS[i]) + 'px'; return; }
    UI.spColW = Object.assign({}, UI.spColW, { [SP_UCOLS[i].k]: w }); saveUI(); renderNow();
  });
}
function spSetKosten(mid, v) {
  commit(d => { const m = findM(d, mid); if (!m) return; if (v == null || v === '' || !isNum(v)) delete m.kosten; else m.kosten = Math.round(+v * 100) / 100; }, 'Kosten geändert');
}
function spTiles(x, s) {
  const tile = (label, value, sub, rt, tipText) => h('div', { class: 'sp-tile', tip: tipText || null }, h('div', { class: 'sp-tl' }, label), h('div', { class: 'sp-tv' }, value), sub ? h('div', { class: 'sp-ts' }, sub) : null,
    rt ? h('div', { class: 'sp-rt ' + rt[0] }, rt[1]) : null);
  const R = spRicht(), judge = (v, [lo, hi], txt) => v == null || !R.an ? null : v < lo ? ['below', '▼ unter Richtwert ' + txt] : v > hi ? ['above', '▲ über Richtwert ' + txt] : ['within', '✓ im Richtwert ' + txt];
  return h('div', { class: 'sp-tiles' },
    tile('Spendensumme', s.n ? eur0(s.sum) : '–', spCount(s.n)),
    tile('Ø-Spende', s.avg != null ? eur(s.avg) : '–', s.med != null ? 'Median ' + eur(s.med) : null, null, 'Der Median ist die mittlere Spende – große Einzelspenden verzerren ihn kaum.'),
    tile('Responsequote', s.resp != null ? num1(s.resp) + ' %' : '–', s.auf ? 'bei Auflage ' + s.auf.toLocaleString('de-DE') : 'Auflage fehlt', judge(s.resp, R.resp, num1(R.resp[0]) + '–' + num1(R.resp[1]) + ' %')),
    tile('ROI', s.roi != null ? num1(s.roi) : '–', s.kos ? 'Kosten ' + eur0(s.kos * 100) : 'Kosten fehlen', judge(s.roi, R.roi, num1(R.roi[0]) + '–' + num1(R.roi[1])), 'Spendensumme ÷ Kosten: so viel Euro Spenden je 1 € Kosten'),
    h('div', { class: 'sp-erl' + (s.net == null ? '' : s.net >= 0 ? ' pos' : ' neg'), tip: 'Erlös = Spendensumme minus Kosten der Maßnahme' },
      h('span', { class: 'sp-el' }, 'Erlös'), h('b', null, s.net != null ? (s.net < 0 ? '− ' : '') + eur0(Math.abs(s.net)) : '–'),
      h('span', { class: 'sp-es' }, s.net != null ? 'Spenden ' + eur0(s.sum) + ' − Kosten ' + eur0(s.kos * 100) : 'Kosten fehlen – in der Übersicht eintragen')));
}
function spRuleBar(x, cmp) {
  const m = x.m, r = m.regel || { worte: [] }, pal = x.pal, rg = spRange(m), mid = x.id, rej = spRejected(mid, cmp).length;
  let typed = '';
  const add = () => { if (typed.trim()) { spAddWord(mid, typed); typed = ''; } };
  const setDay = (which, v) => { const n = dn(v); spSetRule(mid, rr => {
    if (n == null) { delete rr[which]; return; }
    rr[which] = n - pal;
    if (isNum(rr.ab) && isNum(rr.bis) && rr.ab > rr.bis) { if (which === 'ab') rr.bis = rr.ab; else rr.ab = rr.bis; }   // Ende nie vor dem Beginn
  }, 'Zeitraum der Regel geändert'); };
  return h('div', { class: 'sp-rule' },
    h('span', { class: 'sp-rl' }, 'Regel', h('span', { class: 'info', tip: 'Spenden, deren Verwendungszweck eines der Schlagworte enthält und die im Zeitraum eingehen, landen automatisch in „Prüfen“ – auch aus später hinzugefügten Dateien. ' +
      'Groß/klein ist egal. Ein Schlagwort zählt nur als ganzes Wort („JB“ nicht in „JBL“); längere Begriffe (ab 6 Zeichen) auch, wenn die Bank sie trennt („JAHRESBE RICHT“). Der Zeitraum hängt am PAL und wandert mit.' }, ' ⓘ')),
    (r.worte || []).map(w => h('span', { class: 'sp-word' }, w, h('button', { class: 'sp-x', 'aria-label': w + ' entfernen', tip: '„' + w + '“ aus der Regel nehmen',
      onclick: () => spSetRule(mid, rr => { rr.worte = rr.worte.filter(z => z !== w); }, 'Schlagwort „' + w + '“ entfernt') }, '×'))),
    h('input', { class: 'sp-wordin', placeholder: (r.worte || []).length ? '+ Schlagwort' : 'Schlagwort oder Code, z. B. JB – Enter', 'data-fk': 'sp-word',
      oninput: e => { typed = e.target.value; }, onkeydown: e => { if (e.key === 'Enter' || e.key === ',' || e.key === ';') { e.preventDefault(); add(); } }, onblur: add }),
    h('span', { class: 'sp-rl' }, 'Zeitraum'),
    pal == null ? h('span', { class: 'warn small' }, 'ohne PAL ist die Regel aus – bitte PAL eintragen') : [
      dateInput(rg.a != null ? ds(rg.a) : '', 'sp-rab', v => setDay('ab', v)), '–', dateInput(rg.b != null ? ds(rg.b) : '', 'sp-rbis', v => setDay('bis', v)),
      h('span', { class: 'muted small' }, rg.a != null || rg.b != null ? (rg.a != null ? (rg.a - pal >= 0 ? '+' : '') + (rg.a - pal) : '…') + ' bis ' + (rg.b != null ? '+' + (rg.b - pal) : '…') + ' Tage ab PAL' : '')],
    h('label', { class: 'check small sp-noda', tip: 'Daueraufträge (laut Buchungstext) schlägt die Regel nicht vor' },
      h('input', { type: 'checkbox', checked: r.ohneDA === true, onchange: e => spSetRule(mid, rr => { if (e.target.checked) rr.ohneDA = true; else delete rr.ohneDA; }, e.target.checked ? 'Regel: Daueraufträge ausgeschlossen' : 'Regel: Daueraufträge wieder eingeschlossen') }),
      'Daueraufträge ausschließen'),
    (r.worte || []).length ? h('button', { class: 'sp-reapply', disabled: !rej, onclick: () => spReapply(mid),
      tip: rej ? spCount(rej) + ' passen zur Regel, wurden aber mit „zurück“ nach „Offen“ geschickt – „neu anwenden“ holt sie wieder in „Prüfen“' : 'Alle Spenden, die zur Regel passen, stehen schon in „Prüfen“ oder sind zugeordnet' },
      '↻ Regel neu anwenden' + (rej ? ' (' + rej + ')' : '')) : null);
}
const x0pal = mid => { const x = C.byId.get(mid); return x ? x.pal : null; };
const spIsDA = r => /dauerauftrag/i.test((r.text || '') + ' ' + (r.typ || ''));
function spRow(r, col, cmp, mid, ctl) {
  const tags = [], sg = cmp.sugg.get(r.k) || [], nameOf = id => { const o = C.byId.get(id); return o ? o.m.name || '(ohne Namen)' : '?'; };
  if (col === 'm') { const mine = sg.find(s => s.id === mid); tags.push(mine ? h('span', { class: 'sp-tag rule', tip: 'passt zur Regel (Schlagwort „' + mine.w + '“)' }, mine.w) : h('span', { class: 'sp-tag' }, 'von Hand')); }
  const others = [...new Set(sg.filter(s => s.id !== mid).map(s => s.id).concat(D.spenden.vor[r.k] && D.spenden.vor[r.k] !== mid && C.byId.has(D.spenden.vor[r.k]) ? [D.spenden.vor[r.k]] : []))];
  if (col !== 'r' && others.length) tags.push(h('span', { class: 'sp-tag other', tip: 'Wird auch bei ' + others.map(id => '„' + nameOf(id) + '“').join(', ') + ' zur Prüfung angezeigt. Sobald sie einer Maßnahme zugeordnet ist, verschwindet sie bei den anderen.' }, 'auch: ' + others.map(nameOf).join(', ')));
  if (r.gone) tags.push(h('span', { class: 'sp-tag gone' }, 'nicht mehr im Ordner'));
  if (col !== 'l' && x0pal(mid) != null && r.d < x0pal(mid)) tags.push(h('span', { class: 'sp-tag other', tip: 'Eingang vor dem PAL der Maßnahme – gehört sie wirklich dazu?' }, 'vor dem PAL'));
  const da = spIsDA(r);
  if (da) tags.push(h('span', { class: 'sp-tag da', tip: 'Dauerauftrag (laut Buchungstext)' }, 'Dauerauftrag'));
  return h('div', { class: 'sp-row' + (da ? ' da' : '') + (SPUI.sel[col].has(r.k) ? ' sel' : ''), dataset: { k: r.k }, tip: () => spTip(r),
    onclick: e => ctl.click(e, col, r.k), ondblclick: () => ctl.dbl(col, r.k) },
    h('span', { class: 'sp-d' }, fmtD(r.d)), h('span', { class: 'sp-b' }, eur(r.b)),
    UI.spDet ? h('span', { class: 'sp-n' }, r.name || '') : null, h('span', { class: 'sp-z' }, r.gone ? '' : r.zweck || '–'),
    h('span', { class: 'sp-tags' }, tags));
}
// Zugeordnete Spenden vor dem PAL – meist, weil der PAL nachträglich verschoben wurde: einmal lösen statt einzeln suchen
function spPreNotice(x, R) {
  if (x.pal == null) return null;
  const pre = R.filter(r => r.d < x.pal); if (!pre.length) return null;
  const sum = pre.reduce((t, r) => t + r.b, 0);
  return h('div', { class: 'banner sp-notice sp-pre' }, h('span', null, spCount(pre.length) + ' (' + eur(sum) + ') ' + (pre.length === 1 ? 'ist' : 'sind') + ' zugeordnet, aber vor dem PAL (' + fmtD(x.pal) + ') eingegangen – vielleicht wurde der PAL geändert.'),
    h('button', { class: 'primary', onclick: () => spMove(pre.map(r => r.k), 'release', x.id) }, 'Diese ' + pre.length + ' lösen (zurück zu „Offen“)'));
}
function spAssign(x, cmp) {
  const mid = x.id, P = spPart(mid, cmp);
  if (SPUI.fmid !== mid || SPUI.fpal !== x.pal) { spResetFilter(x.m); SPUI.fmid = mid; SPUI.fpal = x.pal; Object.values(SPUI.sel).forEach(s => s.clear()); }
  const L = spFilter(P.L), cols = { l: L, m: P.M, r: P.R }, nDA = UI.spHideDA ? P.L.filter(spIsDA).length : 0;
  for (const c of Object.keys(cols)) { const keys = new Set(cols[c].map(r => r.k)); for (const k of [...SPUI.sel[c]]) if (!keys.has(k)) SPUI.sel[c].delete(k); SPUI.order[c] = cols[c].map(r => r.k); }
  const btn = {}, lists = {};
  const sumOf = (c, keys) => cols[c].filter(r => !keys || keys.has(r.k)).reduce((s, r) => s + r.b, 0);
  const sync = () => {
    const n = c => SPUI.sel[c].size;
    btn.lSel.disabled = !n('l'); btn.lSel.textContent = 'Markierte → Prüfen' + (n('l') ? ' (' + n('l') + ')' : '');
    btn.mBack.disabled = !n('m'); btn.mBack.textContent = '← Markierte zurück' + (n('m') ? ' (' + n('m') + ')' : '');
    btn.mSel.disabled = !n('m'); btn.mSel.textContent = 'Markierte zuordnen →' + (n('m') ? ' (' + n('m') + ')' : '');
    btn.rBack.disabled = !n('r'); btn.rBack.textContent = '← Markierte zurück in „Prüfen“' + (n('r') ? ' (' + n('r') + ')' : '');
  };
  const act = { l: 'stage', m: 'assign', r: 'unassign' };
  const ctl = {
    click: (e, c, k) => {
      const sel = SPUI.sel[c], ord = SPUI.order[c];
      if (e.shiftKey && SPUI.last[c] && ord.includes(SPUI.last[c])) { const [a, b] = [ord.indexOf(SPUI.last[c]), ord.indexOf(k)].sort((p, q) => p - q); for (let i = a; i <= b; i++) sel.add(ord[i]); }
      else if (sel.has(k)) sel.delete(k); else sel.add(k);
      SPUI.last[c] = k;
      for (const el of $$('.sp-row', lists[c])) el.classList.toggle('sel', sel.has(el.dataset.k));
      sync();
    },
    dbl: (c, k) => spMove([k], act[c], mid),
  };
  const list = (c, empty) => {
    const box = lists[c] = h('div', { class: 'sp-list', 'data-keep-scroll': 'sp-' + c });
    put(box, cols[c].slice(0, SP_MAX).map(r => spRow(r, c, cmp, mid, ctl)));
    if (cols[c].length > SP_MAX) box.append(h('div', { class: 'sp-more muted small' }, '… und ' + (cols[c].length - SP_MAX).toLocaleString('de-DE') + ' weitere' + (c === 'l' ? ' – Filter eingrenzen' : '')));
    if (!cols[c].length) box.append(h('div', { class: 'sp-empty muted small' }, empty));
    return box;
  };
  const head = (c, title, extra) => h('div', { class: 'sp-ch' }, h('b', null, title), h('span', { class: 'muted small' }, spCount(cols[c].length) + ' · ' + eur(sumOf(c)) + (extra || '')));
  let tq = null;
  const fset = (k, v, now) => { SPUI.f[k] = v; clearTimeout(tq); if (now) renderNow(); else tq = setTimeout(renderNow, 250); };
  btn.lSel = h('button', { onclick: () => spMove(SPUI.sel.l, 'stage', mid) });
  btn.lAll = h('button', { disabled: !L.length, onclick: async () => { if (L.length > 200 && !await confirmBox('Viele Spenden', L.length.toLocaleString('de-DE') + ' Spenden auf einmal nach „Prüfen“ schieben? (Strg+Z macht es rückgängig.)', 'Ja, alle')) return; spMove(L.map(r => r.k), 'stage', mid); } }, 'Alle ' + L.length.toLocaleString('de-DE') + ' → Prüfen');
  btn.mBack = h('button', { onclick: () => spMove(SPUI.sel.m, 'unstage', mid) });
  btn.mAllBack = h('button', { disabled: !P.M.length, tip: 'alle Spenden aus „Prüfen“ zurück zu „Offen“ – Strg+Z holt sie zurück', onclick: () => spMove(P.M.map(r => r.k), 'unstage', mid) }, '← Alle zurück');
  btn.mSel = h('button', { onclick: () => spMove(SPUI.sel.m, 'assign', mid) });
  btn.mAll = h('button', { class: 'primary', disabled: !P.M.length, onclick: () => spMove(P.M.map(r => r.k), 'assign', mid) }, 'Alle ' + P.M.length.toLocaleString('de-DE') + ' zuordnen →');
  btn.rBack = h('button', { onclick: () => spMove(SPUI.sel.r, 'unassign', mid) });
  const f = SPUI.f;
  const box = h('div', null,
    spRuleBar(x, cmp),
    spPreNotice(x, P.R),
    h('div', { class: 'sp-cols' + (UI.spDet ? ' det' : '') },
      h('div', { class: 'sp-col' }, head('l', 'Offen', L.length !== P.L.length ? ' (gefiltert, ' + P.L.length.toLocaleString('de-DE') + ' offen insgesamt)' : ''),
        !UI.spFilt ? h('div', { class: 'sp-filter closed' }, h('button', { class: 'link sp-ftog', onclick: () => { UI.spFilt = true; renderNow(); } }, 'Filter ▸'),
          h('span', { class: 'muted small' }, [f.von || f.bis ? (f.von ? 'ab ' + fmtD(dn(f.von)) : '') + (f.bis ? ' bis ' + fmtD(dn(f.bis)) : '') : 'alle Daten',
            f.q.trim() ? ' · Suche „' + f.q.trim() + '“' : '', UI.spHideDA ? ' · ohne Daueraufträge' : ''].join(''))) :
        h('div', { class: 'sp-filter' }, h('button', { class: 'link sp-ftog', onclick: () => { UI.spFilt = false; renderNow(); } }, 'Filter ▾'),
          h('input', { type: 'search', class: 'sp-q', placeholder: 'suchen (Verwendungszweck, Name …)', value: f.q, 'data-fk': 'sp-q', oninput: e => fset('q', e.target.value) }),
          dateInput(f.von, 'sp-fvon', v => fset('von', v, true)), '–', dateInput(f.bis, 'sp-fbis', v => fset('bis', v, true)),
          h('label', { class: 'check small sp-da', tip: 'Daueraufträge (laut Buchungstext) in „Offen“ nicht anzeigen' + (nDA ? ' – gerade ' + nDA + ' ausgeblendet' : '') },
            h('input', { type: 'checkbox', checked: !!UI.spHideDA, onchange: e => { UI.spHideDA = e.target.checked; renderNow(); } }), 'Daueraufträge ausblenden'),
          h('button', { class: 'link', disabled: !f.q.trim(), tip: 'Suchbegriff als Schlagwort in die Regel übernehmen – passende Spenden (auch künftige) landen dann automatisch in „Prüfen“', onclick: () => { const w = f.q; SPUI.f.q = ''; spAddWord(mid, w); } }, 'als Regel übernehmen')),
        list('l', ST.conn !== 'ok' ? 'Mailing-Ordner nicht verbunden.' : !SP.rows.length ? 'Noch keine Buchungen eingelesen.' : 'Keine offene Spende im Filter.'),
        h('div', { class: 'sp-cf' }, btn.lSel, btn.lAll)),
      h('div', { class: 'sp-col mid' }, head('m', 'Prüfen'),
        h('div', { class: 'sp-hint muted small' }, 'Vorschläge der Regel und von Hand gewählte Spenden. Erst „zuordnen“ zählt sie für die Maßnahme.'),
        list('m', 'Hier landen Spenden, die zur Regel passen oder die du links markierst und mit „→ Prüfen“ herüberholst.'),
        h('div', { class: 'sp-cf' }, btn.mAllBack, btn.mBack, btn.mSel, btn.mAll)),
      h('div', { class: 'sp-col' }, head('r', 'Zugeordnet'),
        h('div', { class: 'sp-hint muted small' }, 'Diese Spenden zählen für die Maßnahme.'),
        list('r', 'Noch nichts zugeordnet.'),
        h('div', { class: 'sp-cf' }, btn.rBack))),
    h('p', { class: 'muted small' }, 'Klick markiert, Umschalt+Klick markiert einen Bereich, Doppelklick schiebt eine Spende einen Schritt weiter (rechts: zurück in „Prüfen“). Alles lässt sich mit Strg+Z rückgängig machen.'));
  sync();
  return { body: box, tools: h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!UI.spDet, onchange: e => { UI.spDet = e.target.checked; renderNow(); } }), 'Namen zeigen') };
}
VIEW_FN.spenden = main => {
  const y = UI.year;
  if ((SP.at == null || _spLastView !== 'spenden') && !SP.busy && ST.conn === 'ok') spScan();   // beim Öffnen des Reiters neu einlesen (unveränderte Dateien kommen aus dem Speicher)
  _spLastView = 'spenden';
  const ms = C.ms.filter(x => inYear(x, y)), mid = spPickM(ms), x = mid ? C.byId.get(mid) : null;
  if (mid) UI.spMid = mid;
  const cmp = spCompute(), by = spByM();
  main.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); main.classList.add('sp-drop'); } });
  main.addEventListener('dragleave', e => { if (e.target === main) main.classList.remove('sp-drop'); });
  main.addEventListener('drop', e => { if (!e.dataTransfer.files.length) return; e.preventDefault(); main.classList.remove('sp-drop'); spAddFiles(e.dataTransfer.files); });
  const s = x ? spStats(x.m, by.get(x.id)) : null, P = x ? spPart(x.id, cmp) : null;   // Kennzahlen und Spalten der gewählten Maßnahme
  put(main,
    h('div', { class: 'view-head' }, h('h1', null, 'Spenden ' + y + ' ', h('span', { class: 'beta' }, 'Beta')),
      h('div', { class: 'tools' }, spStatus(), h('button', { disabled: ST.conn !== 'ok', onclick: () => spScan({ manual: true }) }, '↻ Neu einlesen'), h('button', { onclick: spPickFiles }, '+ Datei hinzufügen …')),
      h('p', { class: 'muted small' }, 'Exporte (CSV oder Excel) in den Ordner „Spendeneingänge …“ im Mailing-Ordner legen – oder hierher ziehen. Doppelte Buchungen aus überlappenden Exporten zählen nur einmal. ' +
        'In der Planungsdatei stehen nur Zuordnung, Datum und Betrag; Namen und Verwendungszweck bleiben in den Exporten.')),
    spNotice(),
    section('sp-ueb', 'Übersicht ' + y, () => ({ body: spOverview(ms, cmp, mid, by) }), { closedSummary: () => 'aufklappen, um die Maßnahme zu wechseln' }),
    !x ? h('div', { class: 'empty' }, 'Keine Maßnahmen in ' + y + '.') : [
      section('sp-m', h('span', { class: 'sp-mname', style: { color: inkC(x.color) } }, x.m.name || '(ohne Namen)'),
        () => ({ body: h('div', { class: 'sp-kpi' }, spTiles(x, s), spCharts(x, by.get(mid))) }),
        { closedSummary: () => s.n ? eur0(s.sum) + ' aus ' + spCount(s.n) : 'noch keine Spenden zugeordnet' }),
      section('sp-zu', 'Zuordnen', () => spAssign(x, cmp), { closedSummary: () => spCount(P.R.length) + ' zugeordnet · ' + spCount(P.M.length) + ' in Prüfung' })]);
};
VIEW_FN['spenden:after'] = main => { for (const el of $$('[data-chart]', main)) try { spDraw(el); } catch (e) { console.error(e); } };

/* ---------- Grafiken (SVG): Zeitspanne (kumuliert), Spenden pro Tag, Vergleich der Maßnahmen */
const SVG_NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, ...kids) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
}
function niceTicks(max, n = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / n, p = 10 ** Math.floor(Math.log10(raw)), st = [1, 2, 2.5, 5, 10].map(f => f * p).find(s => s >= raw), out = [];
  for (let v = 0; v < max + st * 0.999; v += st) out.push(Math.round(v * 100) / 100);
  return out;
}
const tickLab = v => v.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';
// Tage von PAL (bzw. der ersten Spende) bis zur letzten Spende, mindestens vier Wochen
// Grafiken beginnen am PAL (ohne PAL: an der ersten Spende) und laufen bis zur letzten Spende, mindestens vier Wochen.
// Eingänge vor dem PAL verlängern die Zeitachse nicht – sie stecken in der Summe ab dem PAL und werden genannt.
function spSeries(m, list) {
  const pal = dn(m.pal), lo0 = Math.min(...list.map(z => z.d)), d0 = pal ?? lo0;
  const pre = list.filter(z => z.d < d0), main = list.filter(z => z.d >= d0), hi = main.length ? Math.max(...main.map(z => z.d)) : d0;
  const d1 = Math.min(d0 + 730, Math.max(hi, d0 + 27)), days = d1 - d0 + 1, preSum = pre.reduce((t, z) => t + z.b, 0);
  const day = new Array(days).fill(0), cnt = new Array(days).fill(0);
  for (const z of main) { const i = z.d - d0; if (i < days) { day[i] += z.b; cnt[i]++; } }
  const cum = []; day.reduce((t, v, i) => (cum[i] = t + v), preSum);
  const lo = main.length ? Math.min(...main.map(z => z.d)) : null;
  return { pal, lo, hi, d0, d1, days, day, cnt, cum, last: Math.min(hi, d1) - d0, pre: pre.length, preSum };
}
function spCharts(x, list) {
  if (!list || !list.length) return h('div', { class: 'sp-charts empty muted small' }, 'Sobald Spenden zugeordnet sind, stehen hier die Zeitspanne der Eingänge und die Spenden pro Tag.');
  const sr = spSeries(x.m, list);
  return h('div', { class: 'sp-charts' },
    h('div', { class: 'sp-cht' }, h('b', null, 'Zeitspanne der Eingänge'), h('span', { class: 'muted' }, sr.lo != null ? ' · ' + fmtD(sr.lo) + ' – ' + fmtD(sr.hi) + ' (' + (sr.hi - sr.lo + 1) + ' Tage), Summe kumuliert' : ''),
      sr.pre ? h('span', { class: 'warn small' }, ' · inkl. ' + spCount(sr.pre) + ' vor dem PAL (' + eur(sr.preSum) + ')') : null),
    h('div', { class: 'sp-chart', dataset: { chart: 'span', mid: x.id } }),
    h('div', { class: 'sp-cht' }, h('b', null, 'Spenden pro Tag'), h('span', { class: 'muted' }, ' · grau hinterlegt: Wochenenden')),
    h('div', { class: 'sp-chart', dataset: { chart: 'day', mid: x.id } }));
}
const spDayLab = (sr, n) => fmtW(n) + (sr.pal != null && n >= sr.pal ? ' · Tag ' + (n - sr.pal) + ' ab PAL' : sr.pal != null ? ' · vor dem PAL' : '');
function spXTicks(svg, g, sr, X) {
  const pxd = g.pw / sr.days, step = [7, 14, 28, 56, 91, 182].find(s => s * pxd >= 58) || 365, a = sr.pal ?? sr.d0, y0 = g.mt + g.ph;
  for (let n = a - Math.floor((a - sr.d0) / step) * step; n <= sr.d1; n += step) svg.append(sv('text', { class: 'sp-ax', x: X(n - sr.d0), y: y0 + 16, 'text-anchor': 'middle' }, fmtS(n)));
}
function spFrame(el, H, ml = 70) {
  const W = Math.max(320, Math.floor(el.clientWidth)), g = { W, H, ml, mr: 70, mt: 18, mb: 26 };
  g.pw = W - g.ml - g.mr; g.ph = H - g.mt - g.mb;
  const svg = sv('svg', { width: W, height: H, class: 'sp-svg', role: 'img' });
  el.replaceChildren(svg);
  return { svg, g };
}
function spYAxis(svg, g, max) {
  const ticks = niceTicks(max), top = ticks[ticks.length - 1] || 1, Y = v => g.mt + g.ph - v / top * g.ph;
  for (const t of ticks) svg.append(sv('line', { class: 'sp-grid', x1: g.ml, x2: g.ml + g.pw, y1: Y(t), y2: Y(t) }), sv('text', { class: 'sp-ax', x: g.ml - 8, y: Y(t) + 4, 'text-anchor': 'end' }, tickLab(t)));
  return Y;
}
function spPalMark(svg, g, x) {
  svg.append(sv('line', { class: 'sp-pal', x1: x, x2: x, y1: g.mt - 4, y2: g.mt + g.ph }),
    sv('rect', { class: 'sp-palbox', x: x - 7, y: g.mt - 16, width: 14, height: 14, rx: 3 }), sv('text', { class: 'sp-paltx', x, y: g.mt - 5, 'text-anchor': 'middle' }, sym('P')));
}
function spDraw(el) {
  const kind = el.dataset.chart, by = spByM();
  if (kind === 'cmp') return spDrawCmp(el, el.dataset.ids.split(',').filter(id => C.byId.has(id) && by.get(id)), by);
  const x = C.byId.get(el.dataset.mid), list = x && by.get(x.id);
  if (!list || !list.length) return;
  const sr = spSeries(x.m, list), { svg, g } = spFrame(el, 150, 62);
  const X = i => g.ml + (i + 0.5) / sr.days * g.pw, y0 = g.mt + g.ph;
  spWeekends(svg, g, sr);
  if (kind === 'span') spDrawSpan(svg, g, x, sr, X); else spDrawDay(svg, g, x, sr, X);
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
  spXTicks(svg, g, sr, X);
  if (sr.pal != null) spPalMark(svg, g, g.ml + (sr.pal - sr.d0) / sr.days * g.pw);
}
// Wochenenden grau hinterlegt (Sa + So als ein Streifen)
function spWeekends(svg, g, sr) {
  const pxd = g.pw / sr.days;
  for (let i = 0; i < sr.days; i++) {
    if (wd(sr.d0 + i) < 5) continue;
    let j = i; while (j + 1 < sr.days && wd(sr.d0 + j + 1) >= 5) j++;
    svg.append(sv('rect', { class: 'sp-we', x: g.ml + i * pxd, y: g.mt, width: (j - i + 1) * pxd, height: g.ph }));
    i = j;
  }
}
// Zeitspanne: Summe der zugeordneten Spenden, aufaddiert vom PAL bis zur letzten Spende
function spDrawSpan(svg, g, x, sr, X) {
  const Y = spYAxis(svg, g, sr.cum[sr.days - 1] / 100), y0 = g.mt + g.ph, L = sr.last;
  const pts = sr.cum.slice(0, L + 1).map((v, i) => X(i).toFixed(1) + ',' + Y(v / 100).toFixed(1));
  svg.append(sv('path', { class: 'sp-area', fill: x.color, d: 'M' + X(0) + ',' + y0 + 'L' + pts.join('L') + 'L' + X(L) + ',' + y0 + 'Z' }),
    sv('polyline', { class: 'sp-line', stroke: x.color, points: pts.join(' ') }),
    sv('circle', { class: 'sp-dot', cx: X(L), cy: Y(sr.cum[L] / 100), r: 4.5, fill: x.color }),
    sv('text', { class: 'sp-endl', x: X(L) + 9, y: Y(sr.cum[L] / 100) + 4 }, eur0(sr.cum[L])));
  spCross(svg, g, {
    at: px => clamp(Math.round((px - g.ml) / g.pw * sr.days - 0.5), 0, L), x: X,
    dots: i => [sv('circle', { class: 'sp-dot', cx: X(i), cy: Y(sr.cum[i] / 100), r: 4.5, fill: x.color })],
    tip: i => h('div', null, h('b', null, eur(sr.cum[i])), h('div', { class: 'muted small' }, 'bis ' + spDayLab(sr, sr.d0 + i)),
      sr.cnt[i] ? h('div', null, 'an diesem Tag: ' + eur(sr.day[i]) + ' (' + spCount(sr.cnt[i]) + ')') : null) });
}
// Spenden pro Tag: eine Säule je Tag – zeigt, wann viel hereinkommt und wann es abebbt
function spDrawDay(svg, g, x, sr, X) {
  const Y = spYAxis(svg, g, Math.max(...sr.day) / 100), y0 = g.mt + g.ph, pxd = g.pw / sr.days;
  const bw = Math.min(24, Math.max(1, pxd - (pxd >= 5 ? 2 : 1)));
  for (let i = 0; i < sr.days; i++) {
    const grp = sv('g', { class: 'sp-bin' });
    if (sr.day[i]) {
      const bx = X(i) - bw / 2, top = Y(sr.day[i] / 100), r = Math.min(4, bw / 2, y0 - top);
      grp.append(sv('path', { class: 'sp-bar', fill: x.color, d: `M${bx},${y0}V${top + r}Q${bx},${top} ${bx + r},${top}H${bx + bw - r}Q${bx + bw},${top} ${bx + bw},${top + r}V${y0}Z` }));
    }
    const hit = sv('rect', { class: 'sp-hit', x: g.ml + i * pxd, y: g.mt, width: pxd, height: g.ph });
    setTip(hit, () => h('div', null, h('b', null, sr.day[i] ? eur(sr.day[i]) : 'keine Spenden'), sr.cnt[i] ? h('div', null, spCount(sr.cnt[i])) : null, h('div', { class: 'muted small' }, spDayLab(sr, sr.d0 + i))));
    grp.append(hit); svg.append(grp);
  }
}
function spDrawCmp(el, ids, by) {
  const ser = ids.map(id => {
    const x = C.byId.get(id), list = by.get(id).filter(z => z.d >= x.pal), last = Math.max(0, ...list.map(z => z.d - x.pal));
    const day = []; for (const z of list) day[z.d - x.pal] = (day[z.d - x.pal] || 0) + z.b;
    const cum = []; for (let t = 0, s = 0; t <= last; t++) { s += day[t] || 0; cum[t] = s; }
    return { x, cum, last };
  }).filter(s => s.cum[s.last] > 0);
  if (ser.length < 2) { el.replaceChildren(); return; }
  const T = Math.min(365, Math.max(56, ...ser.map(s => s.last))), { svg, g } = spFrame(el, 230, 70);
  g.mr = 150; g.pw = g.W - g.ml - g.mr;
  const X = t => g.ml + t / T * g.pw, Y = spYAxis(svg, g, Math.max(...ser.map(s => s.cum[Math.min(s.last, T)])) / 100), y0 = g.mt + g.ph;
  for (let t = 0; t <= T; t += T > 120 ? 28 : 14) svg.append(sv('text', { class: 'sp-ax', x: X(t), y: y0 + 16, 'text-anchor': 'middle' }, t === 0 ? 'PAL' : '+' + t + ' T.'));
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
  const ends = [];
  for (const s of ser) {
    const L = Math.min(s.last, T), pts = s.cum.slice(0, L + 1).map((v, t) => X(t).toFixed(1) + ',' + Y(v / 100).toFixed(1));
    svg.append(sv('polyline', { class: 'sp-line', stroke: s.x.color, points: pts.join(' ') }), sv('circle', { class: 'sp-dot', cx: X(L), cy: Y(s.cum[L] / 100), r: 4.5, fill: s.x.color }));
    ends.push({ y: Y(s.cum[L] / 100), x: X(L), s });
  }
  if (ser.length <= 4) {                                          // Namen am Linienende, solange sie sich nicht überlappen
    ends.sort((a, b) => a.y - b.y);
    if (ends.every((e, i) => !i || e.y - ends[i - 1].y >= 13)) for (const e of ends) svg.append(sv('text', { class: 'sp-endl', x: e.x + 9, y: e.y + 4 }, (e.s.x.m.name || '?').slice(0, 22)));
  }
  el.prepend(h('div', { class: 'sp-legend' }, ser.map(s => h('span', null, h('span', { class: 'sp-lkey', style: { background: s.x.color } }), s.x.m.name || '(ohne Namen)'))));
  spCross(svg, g, {
    at: px => clamp(Math.round((px - g.ml) / g.pw * T), 0, T), x: X,
    dots: t => ser.filter(s => t <= s.last).map(s => sv('circle', { class: 'sp-dot', cx: X(t), cy: Y(s.cum[t] / 100), r: 4.5, fill: s.x.color })),
    tip: t => h('div', null, h('div', { class: 'muted small' }, t === 0 ? 'am PAL' : t + ' Tage nach dem PAL'),
      ser.map(s => ({ s, v: s.cum[Math.min(t, s.last)] })).sort((a, b) => b.v - a.v).map(({ s, v }) => h('div', { class: 'sp-tiprow' },
        h('span', { class: 'sp-lkey', style: { background: s.x.color } }), h('b', null, eur0(v)), ' ', h('span', { class: 'muted' }, s.x.m.name || '?')))) });
}
// Fadenkreuz: senkrechte Linie folgt der Maus, rastet am nächsten Tag ein; Werte im Hinweisfenster
function spCross(svg, g, cfg) {
  const line = sv('line', { class: 'sp-xh', y1: g.mt, y2: g.mt + g.ph, visibility: 'hidden' }), dots = sv('g', { class: 'sp-xdots' });
  const ov = sv('rect', { class: 'sp-ov', x: g.ml, y: g.mt, width: g.pw, height: g.ph });
  svg.append(line, dots, ov);
  ov.addEventListener('mousemove', ev => {
    const i = cfg.at(ev.clientX - svg.getBoundingClientRect().left), xx = cfg.x(i);
    line.setAttribute('x1', xx); line.setAttribute('x2', xx); line.setAttribute('visibility', 'visible');
    dots.replaceChildren(...cfg.dots(i));
    tipEl.replaceChildren(cfg.tip(i)); tipEl.classList.add('on'); placeTip(ev);
  });
  ov.addEventListener('mouseleave', () => { line.setAttribute('visibility', 'hidden'); dots.replaceChildren(); hideTip(); });
}
