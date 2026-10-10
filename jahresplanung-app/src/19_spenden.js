/* ===================================================================== Spenden (Beta): Kontoauszüge einlesen, Maßnahmen zuordnen, auswerten */

// Die Exporte (CSV oder Excel) liegen im Mailing-Ordner im Unterordner „Spendeneingänge …“ (z. B. „Spendeneingänge 2027“) – einfach hineinlegen.
// Die App liest alle Dateien darin beim Öffnen des Reiters, beim Zurückkehren ins Fenster, alle zwei Minuten (solange der Reiter offen ist)
// und auf Knopfdruck. Buchungen, die in mehreren Exporten stehen (überlappende Zeiträume), zählen nur einmal.
// In der Planungsdatei stehen nur die Zuordnungen (Schlüssel → Maßnahme, Datum, Betrag); Namen, IBAN und Verwendungszweck bleiben in den Dateien.
// D.spenden: zu = zugeordnet { Schlüssel: { m, d, b (Cent), r? (von der Regel) } } · nein = ausgeschlossen { Schlüssel: [Maßnahmen] }
//            neu = neu eingelesen, noch nicht geprüft { Schlüssel: 'm'/'z' } · bek = schon eingelesen { Jahr: [Schlüssel] }.  Regel je Maßnahme: m.regel = { worte, ab, bis } (Tage ab PAL)
const SP_DIR_RE = /^Spendeneing/i, SP_FILE_RE = /\.(csv|txt|xlsx)$/i, SP_MAX = 400, SP_TAGE = 182;
// Richtwerte (Einstellungen, standardmäßig ausgeblendet); Vorgabe aus der Mailing-Übersicht (postalische Sendungen)
const SP_RICHT0 = { an: false, resp: [2.7, 4.4], roi: [4, 5] };
const spRicht = () => Object.assign({}, SP_RICHT0, (D && D.settings && isObj(D.settings.richtwerte)) ? D.settings.richtwerte : {});
const SP = { rows: [], byKey: new Map(), files: [], dirs: [], cache: new Map(), busy: null, at: null, state: null, dups: 0, neg: 0, sig: '' };
const SPUI = { typed: '', skip: new Set(), skipFor: '', tab: 'zu', klaeren: false, sel: new Set(), selCtx: '', anchor: null, moveTo: null, onlyNew: false, more: 0, f: { q: '', von: '', bis: '' }, fmid: null, fpal: null };

// Allgemeine Spenden: je Jahr ein Topf unabhängig von den Maßnahmen (z. B. Daueraufträge) – zugeordnet als „allg:JJJJ“
const SP_ALLG = 'allg:', isAllg = id => typeof id === 'string' && /^allg:\d{4}$/.test(id);
function spAllgX(y) {
  const id = SP_ALLG + y, cfg = ((D && D.spenden && D.spenden.allg) || {})[y] || {};
  const m = { id, name: 'Allgemeine Spenden ' + y, pal: null, farbe: '#8a8f98', regel: cfg.regel, allg: +y };
  return { id, m, pal: null, color: m.farbe, allg: +y };
}
const spX = id => isAllg(id) ? spAllgX(id.slice(5)) : C.byId.get(id);
const spMObj = (d, id) => isAllg(id) ? spAllgX(id.slice(5)).m : findM(d, id);
const spMName = id => { const x = isAllg(id) ? spAllgX(id.slice(5)) : C && C.byId.get(id); return x ? x.m.name || '(ohne Namen)' : (D && findM(D, id) || {}).name || '?'; };
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
      if (D && D.spenden) spRegister();                              // neue Spenden merken, Regeln abgleichen, Neues markieren
    } catch (e) { console.warn(e); SP.state = 'err'; SP.err = (e && e.message) || String(e); requestRender(); }
    finally { SP.busy = null; }
  })();
  return SP.busy;
}
setInterval(() => { if (D && UI.view === 'spenden' && !document.hidden && ST.conn === 'ok' && !DRAG) spScan(); }, 120000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && D && UI.view === 'spenden' && ST.conn === 'ok') spScan(); });
window.addEventListener('focus', () => { if (D && UI.view === 'spenden' && ST.conn === 'ok') spScan(); });   // Fenster wieder vorn (z. B. aus dem Explorer)
let _spLastView = null;

// Zeitraum einer eingelesenen Datei (erste und letzte Buchung)
const spSpan = recs => recs && recs.length ? recs.reduce((a, r) => [Math.min(a[0], r.d), Math.max(a[1], r.d)], [Infinity, -Infinity]) : null;
// Dateien in den Ordner legen (Knopf oder Hineinziehen) – danach neu einlesen und kurz zusammenfassen, was neu ist
async function spAddFiles(files) {
  files = [...files];
  if (!files.length) return;
  if (!FSA || ST.conn !== 'ok' || !ST.htmlDir) { toast('Bitte zuerst den Mailing-Ordner verbinden (oben „Speichern“).', 'warn'); return; }
  const bad = files.filter(f => !SP_FILE_RE.test(f.name));
  if (bad.length) toast('Nur CSV- und Excel-Dateien (.csv, .xlsx): ' + bad.map(f => f.name).join(', ') + ' übersprungen.', 'warn');
  const ok = files.filter(f => SP_FILE_RE.test(f.name)); if (!ok.length) return;
  if (!SP.at) await spScan();                                    // Vergleich braucht den bisherigen Stand
  const known = new Set(SP.byKey.keys()), oldFiles = (SP.files || []).filter(e => !e.err && e.recs && e.recs.length).map(e => ({ name: e.name, span: spSpan(e.recs) })), report = [];
  try {
    const dirs = await spDirs();
    const dirFor = async y => {                                   // Ordner „Spendeneingänge JJJJ“ des Jahres, aus dem die Buchungen stammen
      const want = 'Spendeneingänge ' + y, ex = dirs.find(d => d.name === want); if (ex) return ex.h;
      const hd = await ST.htmlDir.getDirectoryHandle(want, { create: true }); dirs.push({ h: hd, name: want, path: want }); return hd;
    };
    for (const f of ok) {
      const buf = new Uint8Array(await f.arrayBuffer());
      let parsed = null; try { parsed = await spReadFile(f.name, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)); } catch (e) { parsed = { err: (e && e.message) || String(e) }; }
      const ys = new Map(); for (const r of (parsed && parsed.recs) || []) { const y = ymd(r.d)[0]; ys.set(y, (ys.get(y) || 0) + 1); }
      const dir = await dirFor(ys.size ? [...ys].sort((a, b) => b[1] - a[1])[0][0] : UI.year);
      let name = f.name, i = 1, dupOf = null;
      for (;;) {                                                  // gleicher Name mit anderem Inhalt: nicht überschreiben, sondern „(2)“ anhängen
        let ex = null; try { ex = await (await dir.getFileHandle(name)).getFile(); } catch (e) { break; }
        if (ex.size === buf.length && crc32(new Uint8Array(await ex.arrayBuffer())) === crc32(buf)) { dupOf = name; name = null; break; }
        name = f.name.replace(/(\.[^.]+)$/, ' (' + (++i) + ')$1');
      }
      report.push({ name: f.name, saved: name, dupOf, parsed });
      if (!name) continue;
      const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(buf); await w.close();
    }
  } catch (e) { console.warn(e); toast('Datei ließ sich nicht ablegen: ' + ((e && e.message) || e), 'err'); return; }
  await spScan();
  spAddReport(report, known, oldFiles);
}
// Zusammenfassung nach dem Hinzufügen: neu, doppelt, Zeiträume; die neuen Spenden in einer kurzen Liste (rollbar)
// Zusammenfassung nach „+ Buchung hinzufügen“: oben Zeitraum, Anzahl und Summe der neuen Spenden; darunter Überschneidung,
// doppelte Buchungen und erkannte Regeln; dann die neuen Spenden – passt eine Regel, steht ihr Schlagwort farbig am Zeilenende
function spAddReport(report, known, oldFiles) {
  const seen = new Set(), fresh = [];
  let dup = 0, neg = 0, bad = 0, over = false;
  const errs = [];
  for (const r of report) {
    const P = r.parsed || {};
    if (P.err) { errs.push(r.name + ' (' + P.err + ')'); continue; }
    const recs = P.recs || [], span = spSpan(recs);
    for (const rec of recs) { if (known.has(rec.k) || seen.has(rec.k)) dup++; else { seen.add(rec.k); fresh.push(SP.byKey.get(rec.k) || rec); } }
    neg += P.neg || 0; bad += P.bad || 0;
    if (span && oldFiles.some(o => o.name !== r.dupOf && o.span && o.span[0] <= span[1] && span[0] <= o.span[1])) over = true;
  }
  fresh.sort((a, b) => a.d - b.d || b.b - a.b);
  const cmp = spCompute(), sum = fresh.reduce((t, r) => t + r.b, 0), fs = spSpan(fresh), n = fresh.length;
  // wohin die neuen Spenden per Regel gefallen sind: Maßnahme, Spendenzweck oder „zu klären“ (passt zu mehreren Regeln)
  const zw = new Map(); for (const y of new Set(fresh.map(r => ymd(r.d)[0]))) for (const e of spjCompute(y).list) zw.set(e.rec.k, e);
  const catsOf = r => { const out = [], mid = cmp.assigned(r.k), hl = cmp.hits.get(r.k) || [], e = zw.get(r.k);
    if (mid && !isAllg(mid)) { const x = spX(mid), g = hl.find(q => q.id === mid); out.push({ key: 'm' + mid, label: spMName(mid), c: x ? x.color : '#7F7F7F', tip: 'Maßnahme „' + spMName(mid) + '“' + (g ? ' – Schlagwort „' + g.w + '“' : '') }); }
    else if (hl.length > 1) out.push({ key: 'k', label: '⚠ zu klären', c: '#b45309', tip: 'passt zu mehreren Maßnahmen: ' + hl.map(q => spMName(q.id)).join(', ') });
    if (e && e.z !== SPJ_FREI && !e.hand) { const z = D.zwecke.find(q => q.id === e.z); out.push(z ? { key: 'z' + z.id, label: z.name, c: z.farbe, tip: 'Spendenzweck „' + z.name + '“' } : { key: 'zk', label: '⚠ Zweck zu klären', c: '#b45309', tip: 'passt zu mehreren Spendenzwecken' }); }
    return out; };
  const chip = (g, extra) => h('span', { class: 'sp-rchip', style: { background: pastel(g.c), borderColor: g.c, color: inkC(g.c) }, tip: g.tip }, g.label, extra || null);
  const rules = new Map();                                    // Ziel → Anzahl
  for (const r of fresh) for (const g of catsOf(r)) rules.set(g.key, Object.assign({}, g, { n: ((rules.get(g.key) || {}).n || 0) + 1 }));
  const box = (cls, big, label) => h('div', { class: cls }, h('b', null, big), h('span', null, label));
  modal('Buchungen hinzugefügt', h('div', { class: 'sp-addrep' },
    h('div', { class: 'sp-addsum' },
      box('sp-as-span', fs ? (fs[0] === fs[1] ? fmtD(fs[0]) : fmtD(fs[0]) + ' – ' + fmtD(fs[1])) : '–', 'Spenden hinzugefügt'),
      box('sp-as-n', n.toLocaleString('de-DE'), n === 1 ? 'neue Spende' : 'neue Spenden'),
      box('sp-as-sum', eur(sum), 'Gesamtsumme')),
    h('div', { class: 'sp-addsum sp-addsum2' },
      h('div', { class: 'sp-as-ov' + (over ? ' warn' : '') }, h('span', null, over ? 'Zeiträume überschneiden sich' : 'Zeiträume überschneiden sich nicht'),
        over ? h('small', null, 'doppelte Buchungen zählen nur einmal') : null),
      h('div', { class: 'sp-as-dup' }, h('span', null, dup ? dup.toLocaleString('de-DE') + (dup === 1 ? ' doppelte Spende erkannt' : ' doppelte Spenden erkannt') : 'Keine doppelten Spenden erkannt'),
        dup ? h('small', null, 'nicht noch einmal gezählt') : null),
      h('div', { class: 'sp-as-rules' }, h('span', null, rules.size ? 'Per Regel neu zugeordnet – dort als „neu“ markiert, bitte einmal prüfen' : 'Keine neue Spende fällt unter eine Regel'),
        rules.size ? h('div', { class: 'sp-rchips' }, [...rules.values()].sort((p, q) => q.n - p.n).map(g => chip(g, h('small', null, ' (' + g.n + ')')))) : null)),
    n ? h('div', { class: 'sp-addlist' }, h('table', { class: 'grid' }, h('tbody', null, fresh.map(r => h('tr', null,
        h('td', null, fmtD(r.d)), h('td', { class: 'num' }, eur(r.b)), UI.spDet ? h('td', null, r.name || '') : null, h('td', { class: 'sp-z' }, r.zweck || '–'),
        h('td', { class: 'sp-rc' }, catsOf(r).map(g => chip(g)))))))) :
      h('p', { class: 'muted' }, 'Keine neuen Spenden – alle Buchungen waren schon eingelesen.'),
    errs.length ? h('p', { class: 'warn small' }, 'Nicht lesbar: ' + errs.join(', ')) : null,
    neg || bad ? h('p', { class: 'muted small' }, [neg ? neg + ' Abbuchungen/Rücklastschriften übersprungen' : '', bad ? bad + ' Zeilen ohne gültiges Datum oder Betrag' : ''].filter(Boolean).join(' · ')) : null),
    [['Schließen', true, 'primary']], { wide: true, cls: 'sp-addw' });
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
// Suchausdrücke für Regeln und Suche (Groß/klein egal):
//   JB           ganzes Wort („JB“ nicht in „JBL“); ab 6 Zeichen auch, wenn die Bank trennt („JAHRESBE RICHT“)
//   *bericht     * = beliebig viele Buchstaben/Ziffern im Wort (Jahresbericht, Jaresbericht …); Jahres* · J*bericht
//   Jahresber?cht  ? = genau ein Buchstabe/Ziffer
//   ~Jahresbericht ungefähr: kleine Tippfehler erlaubt (1 Zeichen, ab 8 Zeichen 2)
//   JB + 2026    beide müssen vorkommen
//   -Trauer      ausschließen: Spenden mit diesem Wort schlägt die Regel nicht vor
const SP_HILFE = [['JB', 'ganzes Wort (nicht „JBL“); längere Wörter auch, wenn die Bank sie trennt'], ['*bericht', '* = beliebige Buchstaben/Ziffern im Wort – auch „Jaresbericht“; ebenso Jahres* oder J*bericht'],
  ['Jahresber?cht', '? = genau ein beliebiges Zeichen'], ['~Jahresbericht', 'ungefähr: kleine Tippfehler erlaubt'], ['JB + 2026', 'beide müssen im Verwendungszweck stehen'],
  ['Starke Hilfe', 'Wortfolge (Leerzeichen dazwischen egal)'], ['-Trauer', 'ausschließen: Spenden mit diesem Wort nicht vorschlagen']];
const spHelp = () => h('div', { class: 'sp-help' }, h('b', null, 'So lässt sich filtern'), h('table', null, SP_HILFE.map(([k, t]) => h('tr', null, h('td', null, h('code', null, k)), h('td', null, t)))),
  h('div', { class: 'muted small' }, 'Mehrere Schlagworte: eines davon genügt. Groß/klein ist egal.'));
const spWords = s => (String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
function spLev(a, b, max) {                                        // Levenshtein-Abstand mit Abbruch über „max“
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function spTerm(t) {
  t = str(t).trim(); if (!t) return null;
  if (/\S\s*\+\s*\S/.test(t)) {                                  // „A + B“: alle Teile; „A + -B“: A, aber nicht B
    const parts = t.split('+').map(spTerm).filter(Boolean);
    return parts.some(p => !p.neg) ? { word: t, test: rec => parts.every(p => p.neg ? !p.test(rec) : p.test(rec)) } : parts.length ? { word: t, neg: true, test: rec => parts.some(p => p.test(rec)) } : null;
  }
  if (/^[-!]./.test(t)) { const inner = spTerm(t.slice(1)); return inner && { word: t, neg: true, test: inner.test }; }
  if (t.startsWith('~') && t.length > 1) {                          // ungefähr: Wort (oder zwei getrennte Wortteile) mit kleinem Abstand
    const w = t.slice(1).toLowerCase().replace(/\s+/g, ''), max = w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0;
    return { word: t, test: rec => { const ws = spWords(rec.zweck); for (let i = 0; i < ws.length; i++) { if (spLev(ws[i], w, max) <= max) return true; if (i + 1 < ws.length && spLev(ws[i] + ws[i + 1], w, max) <= max) return true; } return false; } };
  }
  const esc = x => x.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  if (/[*?]/.test(t)) {                                              // Platzhalter innerhalb eines Wortes
    const rx = new RegExp('(?<![\\p{L}\\p{N}])' + esc(t).replace(/\*/g, '[\\p{L}\\p{N}]*').replace(/\?/g, '[\\p{L}\\p{N}]').replace(/\s+/g, '\\s*') + '(?![\\p{L}\\p{N}])', 'iu');
    const lit = spSqueeze(t.replace(/[*?]/g, '')), sx = lit.length >= 6 ? new RegExp(t.toLowerCase().split(/([*?])/).map(x => x === '*' ? '[\\p{L}\\p{N}]{0,15}' : x === '?' ? '[\\p{L}\\p{N}]' : esc(spSqueeze(x))).join(''), 'u') : null;
    return { word: t, test: rec => rx.test(rec.zweck) || (sx && sx.test(rec.sq)) };   // ab 6 festen Zeichen auch, wenn die Bank trennt
  }
  const sq = spSqueeze(t), rx = new RegExp('(?<![\\p{L}\\p{N}])' + esc(t).replace(/[*?]/g, '\\$&').replace(/\s+/g, '\\s*') + '(?![\\p{L}\\p{N}])', 'iu');
  return { word: t, test: rec => rx.test(rec.zweck) || (sq.length >= 6 && rec.sq.includes(sq)) };
}
// Mehrere Schlagworte: eines genügt; ausschließende verhindern den Treffer. Ergebnis: das passende Schlagwort oder null.
// all = true (Suche): nur ausschließende Begriffe → alles andere passt
const _spMatch = new Map();
function spMatcher(words, all) {
  const key = JSON.stringify(words) + (all ? '|a' : '');
  if (_spMatch.has(key)) return _spMatch.get(key);
  const tests = words.map(spTerm).filter(Boolean), pos = tests.filter(t => !t.neg), neg = tests.filter(t => t.neg);
  const f = rec => { for (const t of neg) if (t.test(rec)) return null; if (!pos.length) return all && neg.length ? neg[0].word : null; for (const t of pos) if (t.test(rec)) return t.word; return null; };
  if (_spMatch.size > 300) _spMatch.clear();
  _spMatch.set(key, f);
  return f;
}
function spRange(m) {
  if (m && m.allg) return { a: mkdn(m.allg, 1, 1), b: mkdn(m.allg, 12, 31) };   // allgemeine Spenden: das Kalenderjahr
  const r = (m && m.regel) || {}, pal = dn(m && m.pal);
  return { a: pal != null && isNum(r.ab) ? pal + +r.ab : null, b: pal != null && isNum(r.bis) ? pal + +r.bis : null };
}
// Ab 0.18 ordnen die Regeln der Maßnahmen selbst zu (wie bei den Spendenzwecken): passt genau eine Regel, ist die Spende der Maßnahme zugeordnet
// (gespeichert in D.spenden.zu mit r: 1 – so stimmt die Auswertung auch ohne die Dateien); passen mehrere, ist sie „zu klären“ (nicht zugeordnet).
// Von Hand Zugeordnetes (ohne r) bleibt, wie es ist; ausgeschlossene Spenden (nein) ordnet die Regel dieser Maßnahme nicht zu.
let _spHits = { key: null, val: null };
function spHits(d) {                                              // Schlüssel → [{ id, w }] aller passenden Regeln (ohne ausgeschlossene)
  const key = SP.sig + '|' + SP.rows.length + '|' + JSON.stringify(d.massnahmen.map(m => [m.id, m.pal, m.regel])) + '|' + JSON.stringify(d.spenden.nein);
  if (_spHits.key === key && _spHits.rows === SP.rows) return _spHits.val;
  const S = d.spenden, rules = d.massnahmen.map(spRuleOf).filter(Boolean), hits = new Map();
  if (rules.length) for (const rec of SP.rows) {
    const no = S.nein[rec.k]; let list = null;
    for (const ru of rules) { if (no && no.includes(ru.id)) continue; const w = ru.test(rec); if (w) (list || (list = [])).push({ id: ru.id, w }); }
    if (list) hits.set(rec.k, list);
  }
  _spHits = { key, rows: SP.rows, val: hits };
  return hits;
}
// Zuordnungen der Regeln abgleichen – läuft bei jeder Änderung mit (commit) und nach dem Einlesen; ohne eingelesene Dateien wird nichts angefasst
function spSyncZu(d) {
  if (!SP.at || !d || !d.spenden || !d.massnahmen) return 0;
  const S = d.spenden, hits = spHits(d); let n = 0;
  for (const rec of SP.rows) {
    const z = S.zu[rec.k]; if (z && !z.r) continue;              // von Hand zugeordnet
    const hl = hits.get(rec.k), want = hl && hl.length === 1 ? hl[0].id : null;
    if (want) { if (!z || z.m !== want || z.d !== ds(rec.d) || z.b !== rec.b) { S.zu[rec.k] = { m: want, d: ds(rec.d), b: rec.b, r: 1 }; n++; } }
    else if (z) { delete S.zu[rec.k]; spUnflag(d, rec.k, 'm'); n++; }
  }
  return n;
}
function spUnflag(d, k, f) { const S = d.spenden; if (!S.neu || !S.neu[k]) return; const v = S.neu[k].replace(f, ''); if (v) S.neu[k] = v; else delete S.neu[k]; }
// Stand für die Anzeige: Zuordnung, Treffer, „zu klären“ (mehrere Regeln), neue Spenden je Maßnahme
let _spCmp = { key: null, val: null };
function spCompute() {                                           // wird bei jedem Neuzeichnen gebraucht (Hinweis am Reiter) – nur neu rechnen, wenn sich etwas geändert hat
  const key = SP.sig + '|' + JSON.stringify(D.massnahmen.map(m => [m.id, m.regel, m.pal])) + '|' + JSON.stringify(D.spenden);
  if (_spCmp.key !== key || _spCmp.rows !== SP.rows) _spCmp = { key, rows: SP.rows, val: spComputeNow() };
  return _spCmp.val;
}
// Regel einer Maßnahme als Prüffunktion: Zeitraum, ggf. ohne Daueraufträge, Schlagworte → passendes Schlagwort oder null
function spRuleOf(m) {
  const r = m && m.regel, words = r && r.worte && r.worte.length;
  if (!r || !(words || (m.allg && r.da))) return null;
  if (!m.allg && dn(m.pal) == null) return null;                     // ohne PAL keine Regel (sonst unbegrenzt über alle Jahre)
  const f = words ? spMatcher(r.worte) : null, rg = spRange(m), noDA = r.ohneDA === true, allDA = m.allg && r.da === true;
  return { id: m.id, test: rec => {
    if ((rg.a != null && rec.d < rg.a) || (rg.b != null && rec.d > rg.b)) return null;
    const da = spIsDA(rec);
    if (noDA && da) return null;
    if (allDA && da) return 'Dauerauftrag';
    return f ? f(rec) : null;
  } };
}
function spComputeNow() {
  const S = D.spenden, ids = new Set(D.massnahmen.map(m => m.id)), valid = id => ids.has(id) || isAllg(id);
  const hits = spHits(D), assigned = k => { const z = S.zu[k]; return z && valid(z.m) ? z.m : null; };
  const konf = [], konfBy = new Map(), neuBy = new Map(); let neuM = 0;
  for (const rec of SP.rows) {
    if (assigned(rec.k)) continue;
    const hl = hits.get(rec.k); if (!hl || hl.length < 2) continue;
    konf.push(rec); for (const g of hl) konfBy.set(g.id, (konfBy.get(g.id) || 0) + 1);
  }
  for (const [k, z] of Object.entries(S.zu)) if (z.r && ids.has(z.m) && /m/.test(S.neu[k] || '')) { neuBy.set(z.m, (neuBy.get(z.m) || 0) + 1); neuM++; }
  return { hits, assigned, konf, konfBy, neuBy, neuM, pend: konf.length + neuM };
}
// rote Zahl am Reiter „Auswertung“: neue Spenden bei Maßnahmen und Zwecken, Spenden, die zu mehreren Maßnahmen oder Zwecken passen
function spAttention() {
  const c = spCompute(); let n = c.pend;
  if (D.zwecke.length) { const J = spjCompute(UI.year); for (const e of J.list) if (e.neu || e.z === SPJ_OFFEN) n++; }
  return n;
}
// Spenden einer Maßnahme: zugeordnet (auch aus nicht mehr vorhandenen Dateien), offen = keiner Maßnahme zugeordnet
function spPart(mid, cmp) {
  const L = [], R = [];
  for (const rec of SP.rows) { const a = cmp.assigned(rec.k); if (a === mid) R.push(rec); else if (!a) L.push(rec); }
  for (const [k, z] of Object.entries(D.spenden.zu)) if (z.m === mid && !SP.byKey.has(k)) R.push({ k, d: dn(z.d), b: z.b, gone: true, zweck: '', name: '', text: '', konto: '', files: [] });
  R.sort((a, b) => a.d - b.d || b.b - a.b);
  return { L, R };
}
// Nach dem Einlesen: neue Spenden merken; fallen sie per Regel in eine Maßnahme (m) oder einen Zweck (z), bekommen sie die Markierung „neu“
// (bis jemand bei der Maßnahme bzw. dem Zweck „geprüft“ drückt). Beim allerersten Einlesen gilt alles als neu – einmal durchsehen.
function spRegister() {
  if (!D || !SP.at || !D.spenden) return 0;
  const known = new Set(); for (const a of Object.values(D.spenden.bek || {})) for (const k of a) known.add(k);
  const fresh = SP.rows.filter(r => !known.has(r.k)); let flagged = 0;
  commit(d => {
    spSyncZu(d);
    if (!fresh.length) return;
    const B = Object.assign({}, d.spenden.bek), add = {}, lo = new Date().getFullYear() - 3;
    for (const r of fresh) { const y = String(ymd(r.d)[0]); (add[y] || (add[y] = [])).push(r.k); }
    for (const [y, ks] of Object.entries(add)) B[y] = (B[y] || []).concat(ks);
    for (const y of Object.keys(B)) if (+y < lo) delete B[y];      // ältere Jahre vergessen
    d.spenden.bek = B;
    const N = Object.assign({}, d.spenden.neu), inZweck = spjRuleZweck(d);
    for (const r of fresh) { const z = d.spenden.zu[r.k], f = (z && z.r ? 'm' : '') + (inZweck(r) ? 'z' : ''); if (f) { N[r.k] = f; flagged++; } }
    d.spenden.neu = N;
  });
  if (flagged) toast(spCount(flagged) + ' neu bei Maßnahmen oder Zwecken – dort markiert, bitte einmal prüfen.', 'ok');
  return flagged;
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

/* ---------- Aktionen (alle mit Strg+Z rückgängig; die Regeln gleichen danach von selbst ab) */
function spUnNein(d, k, mid) { const a = (d.spenden.nein[k] || []).filter(x => x !== mid); if (a.length) d.spenden.nein[k] = a; else delete d.spenden.nein[k]; }
const spWhat = keys => spCount(keys.length) + ' (' + eur(keys.reduce((s, k) => s + ((SP.byKey.get(k) || D.spenden.zu[k] || {}).b || 0), 0)) + ')';
// von Hand zuordnen (auch: „zu klären“ entscheiden) – eine ausgeschlossene Spende ist damit wieder zugelassen
function spAssignTo(keys, mid) {
  keys = [...keys].filter(k => SP.byKey.has(k)); if (!keys.length || !mid) return;
  commit(d => { for (const k of keys) { const r = SP.byKey.get(k); d.spenden.zu[k] = { m: mid, d: ds(r.d), b: r.b }; spUnNein(d, k, mid); spUnflag(d, k, 'm'); } }, spWhat(keys) + ' „' + spMName(mid) + '“ zugeordnet');
}
// aus der Maßnahme nehmen: die Regel ordnet sie danach nicht wieder zu
function spExclude(keys, mid) {
  keys = [...keys]; if (!keys.length) return;
  commit(d => {
    const ru = spRuleOf(spMObj(d, mid));
    for (const k of keys) { const z = d.spenden.zu[k]; if (z && z.m === mid) delete d.spenden.zu[k]; const r = SP.byKey.get(k);
      if (ru && r && ru.test(r)) d.spenden.nein[k] = [...new Set([...(d.spenden.nein[k] || []), mid])]; spUnflag(d, k, 'm'); }
  }, spWhat(keys) + ' aus „' + spMName(mid) + '“ genommen');
}
// ausgeschlossene wieder zulassen: passt nur diese Regel, ordnet sie wieder zu
function spReadmit(keys, mid) {
  keys = [...keys]; if (!keys.length) return;
  commit(d => { for (const k of keys) spUnNein(d, k, mid); }, spWhat(keys) + ' für „' + spMName(mid) + '“ wieder zugelassen');
}
// neue Spenden einer Maßnahme als geprüft markieren
function spChecked(mid) {
  commit(d => { for (const [k, z] of Object.entries(d.spenden.zu)) if (z.m === mid) spUnflag(d, k, 'm'); }, 'Neue Spenden bei „' + spMName(mid) + '“ geprüft');
}
function spSetRule(mid, fn, msg) {
  return commit(d => {
    const m = spMObj(d, mid); if (!m) return;
    const r = Object.assign({ worte: [] }, m.regel); r.worte = (r.worte || []).slice();
    fn(r, m);
    if (isAllg(mid)) {                                              // allgemeine Spenden: Regel in D.spenden.allg[Jahr] (alt, seit 0.16 Spendenzwecke)
      const y = mid.slice(5); d.spenden.allg = Object.assign({}, d.spenden.allg);
      if (!r.worte.length && !r.da) delete d.spenden.allg[y]; else d.spenden.allg[y] = { regel: Object.assign({ worte: r.worte }, r.da ? { da: true } : {}) };
    } else if (!r.worte.length && !isNum(r.ab) && !isNum(r.bis)) delete m.regel; else m.regel = r;
  }, msg);
}
// Schlagwort übernehmen (Enter oder „Regel übernehmen“): abgewählte Spenden der Vorschau werden ausgeschlossen, die übrigen ordnet die Regel zu
function spAddWord(mid, w, skip) {
  w = str(w).trim().replace(/\s+/g, ' ');
  if (!w) return;
  const m = spMObj(D, mid); if (!m) return;
  if (((m.regel || {}).worte || []).some(x => x.toLowerCase() === w.toLowerCase())) { toast('„' + w + '“ steht schon in der Regel.'); return; }
  const before = spPart(mid, spCompute()).R.length;
  if (spSetRule(mid, (r, mm) => { r.worte.push(w); if (!mm.allg && dn(mm.pal) != null && !isNum(r.ab) && !isNum(r.bis)) { r.ab = 0; r.bis = SP_TAGE; }
    for (const k of skip || []) D.spenden.nein[k] = [...new Set([...(D.spenden.nein[k] || []), mid])]; })) {
    const n = spPart(mid, spCompute()).R.length - before;
    toast('Regel um „' + w + '“ ergänzt – ' + (n > 0 ? spCount(n) + ' zugeordnet' : 'im Moment keine weitere Spende zugeordnet') + (skip && skip.size ? ', ' + skip.size + ' ausgeschlossen' : '') + '.', 'ok');
  }
}
// ausgeschlossene Spenden, die zur Regel passen
function spRejected(mid, cmp) {
  const ru = spRuleOf(spMObj(D, mid)); if (!ru) return [];
  return SP.rows.filter(rec => !cmp.assigned(rec.k) && (D.spenden.nein[rec.k] || []).includes(mid) && ru.test(rec));
}
// Zuordnungen und Ausschlüsse einer gelöschten Maßnahme entfernen
function spForget(d, mid) {
  const S = d.spenden; if (!S) return;
  for (const k of Object.keys(S.zu)) if (S.zu[k].m === mid) delete S.zu[k];
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
  const rg = spRange(m), pal = m.allg ? rg.a : dn(m.pal), b = rg.b ?? (pal != null ? pal + SP_TAGE : null);
  SPUI.f = { q: '', von: pal != null ? ds(pal) : '', bis: b != null ? ds(b) : '' };
}
// Daueraufträge in „Offen“: alle / ohne / nur
const spDAMode = () => UI.spDA === 'ohne' || UI.spDA === 'nur' ? UI.spDA : UI.spHideDA ? 'ohne' : 'alle';
function spFilter(list) {
  const f = SPUI.f, fa = dn(f.von), fb = dn(f.bis), q = f.q.trim();
  const zm = q ? spMatcher([q], true) : null, ql = q.toLowerCase(), plain = !/[*?~+]|^[-!]/.test(q), tw = SPUI.typed.trim(), tm = tw ? spMatcher([tw], true) : null, da = spDAMode();
  return list.filter(r => (fa == null || r.d >= fa) && (fb == null || r.d <= fb) && (da === 'alle' || (da === 'ohne') !== spIsDA(r)) && (!tm || tm(r)) &&
    (!q || zm(r) || (plain && [r.name, r.konto, r.text].some(t => t && t.toLowerCase().includes(ql)))));
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
/* ---------- Zeitstrahl: welche Zeiträume des Jahres sind eingelesen? Jede Datei deckt die Tage von ihrer ersten bis zur letzten Buchung ab.
   An Wochenenden und Feiertagen wird nicht gebucht; ein einzelner Werktag ohne Spende kommt vor – ab zwei fehlenden Werktagen ist es eine Lücke (rot).
   Seit der letzten Buchung bis gestern Fehlendes ist gelb (die Buchungen von heute können noch nicht im Export sein). */
const SP_GAP_WT = 1;
function spCoverage(y, t = todayDn()) {
  const a = mkdn(y, 1, 1), b = mkdn(y, 12, 31), wt = (s, e) => { let n = 0; for (let d = s; d <= e; d++) if (isWorkday(d)) n++; return n; };
  const spans = [];
  for (const f of SP.files) {
    if (f.err || !f.recs || !f.recs.length) continue;
    const r = spSpan(f.recs); if (r[1] < a || r[0] > b) continue;
    spans.push({ s: Math.max(a, r[0]), e: Math.min(b, r[1]), files: [f.name] });
  }
  spans.sort((p, q) => p.s - q.s || p.e - q.e);
  const cov = [];
  for (const sp of spans) {
    const l = cov[cov.length - 1];
    if (l && (sp.s <= l.e + 1 || wt(l.e + 1, sp.s - 1) <= SP_GAP_WT)) { l.e = Math.max(l.e, sp.e); if (!l.files.includes(sp.files[0])) l.files.push(sp.files[0]); }
    else cov.push({ s: sp.s, e: sp.e, files: sp.files.slice() });
  }
  const segs = [], now = Math.min(t, b);
  if (cov.length && cov[0].s > a) { if (wt(a, cov[0].s - 1) <= SP_GAP_WT) cov[0].s = a; else segs.push({ k: 'gap', s: a, e: cov[0].s - 1 }); }   // vor der ersten Datei
  cov.forEach((c, i) => {
    c.n = 0; c.sum = 0; for (const r of SP.rows) if (r.d >= c.s && r.d <= c.e) { c.n++; c.sum += r.b; }
    segs.push(Object.assign({ k: 'cov' }, c));
    const nx = cov[i + 1]; if (nx) segs.push({ k: 'gap', s: c.e + 1, e: nx.s - 1, wt: wt(c.e + 1, nx.s - 1) });
  });
  const last = cov.length ? cov[cov.length - 1].e : a - 1;
  const upto = t <= b ? now - 1 : b;                                                 // heute zählt nicht mit – außer das Jahr ist schon vorbei
  if (now > last && wt(last + 1, upto) > (cov.length ? SP_GAP_WT : 0)) segs.push({ k: 'open', s: last + 1, e: now, wt: wt(last + 1, upto) });   // seit der letzten Buchung nichts eingelesen
  for (const g of segs) if (g.k !== 'cov' && g.wt == null) g.wt = wt(g.s, g.e);
  return { y, a, b, t, cov, segs, last: cov.length ? last : null };
}
function spCovBar(y) {
  if (ST.conn !== 'ok' || !SP.at) return null;
  const C0 = spCoverage(y), days = C0.b - C0.a + 1, pct = n => (n / days * 100).toFixed(3) + '%', dd = n => fmtD(n).slice(0, 6);
  const span = (s, e) => s === e ? fmtD(s) : dd(s) + '–' + fmtD(e);
  const tipOf = g => g.k === 'cov' ? h('div', null, h('b', null, 'Eingelesen ' + span(g.s, g.e)), h('div', null, spCount(g.n) + ' · ' + eur(g.sum)),
      h('div', { class: 'muted small' }, (g.files.length === 1 ? 'Datei: ' : 'Dateien: ') + g.files.join(', '))) :
    g.k === 'gap' ? h('div', null, h('b', null, 'Lücke ' + span(g.s, g.e)), h('div', null, 'Für diesen Zeitraum ist keine Datei eingelesen (' + g.wt + (g.wt === 1 ? ' Werktag' : ' Werktage') + ').')) :
    h('div', null, h('b', null, 'Noch nicht eingelesen: ' + span(g.s, g.e)), h('div', null, 'Seit der letzten eingelesenen Buchung fehlen ' + g.wt + (g.wt === 1 ? ' Werktag' : ' Werktage') + ' (ohne heute).'));
  const gaps = C0.segs.filter(g => g.k === 'gap'), open = C0.segs.find(g => g.k === 'open');
  const info = !C0.cov.length ? h('span', { class: 'muted' }, 'noch keine Spenden aus ' + y + ' eingelesen') : [
    h('span', null, C0.cov.length === 1 ? 'eingelesen ' + span(C0.cov[0].s, C0.cov[0].e) : 'eingelesen bis ' + fmtD(C0.last)),
    gaps.length ? h('span', { class: 'sp-cov-w' }, ' · ⚠ ' + (gaps.length === 1 ? 'Lücke ' + span(gaps[0].s, gaps[0].e) : gaps.length + ' Lücken')) : null,
    open && !gaps.length ? h('span', { class: 'muted' }, ' · seit ' + dd(open.s) + ' noch nichts') : null];
  return h('div', { class: 'sp-cov' },
    h('span', { class: 'sp-cov-l', tip: 'Welche Zeiträume aus den Dateien im Ordner „Spendeneingänge …“ eingelesen sind. Jede Datei zählt von ihrer ersten bis zur letzten Buchung; ' +
      'Wochenenden und Feiertage zählen nicht; ein einzelner Werktag ohne Buchung ist keine Lücke, ab zwei fehlenden Werktagen ist sie rot.' }, 'Eingelesen ' + y),
    h('div', { class: 'sp-cov-bar' },
      h('div', { class: 'sp-cov-track' },
        MON_S.map((m, i) => i ? h('i', { class: 'sp-cov-m', style: { left: pct(mkdn(y, i + 1, 1) - C0.a) } }) : null),
        C0.segs.map(g => h('div', { class: 'sp-cov-s ' + g.k, dataset: { k: g.k, s: fmtD(g.s), e: fmtD(g.e) }, style: { left: pct(g.s - C0.a), width: pct(g.e - g.s + 1) }, tip: () => tipOf(g) })),
        C0.t >= C0.a && C0.t <= C0.b ? h('i', { class: 'sp-cov-today', style: { left: pct(C0.t - C0.a + 0.5) }, tip: 'heute' }) : null),
      h('div', { class: 'sp-cov-ml' }, MON_S.map((m, i) => h('span', { style: { left: pct(mkdn(y, i + 1, 1) - C0.a), width: pct((i === 11 ? C0.b + 1 : mkdn(y, i + 2, 1)) - mkdn(y, i + 1, 1)) } }, m)))),
    h('span', { class: 'sp-cov-i small' }, info));
}
function spNotice() {
  if (!FSA) return null;
  if (ST.conn !== 'ok') return h('div', { class: 'banner sp-notice' }, h('span', null, 'Die Spendeneingänge liegen im Mailing-Ordner. Dafür muss die App mit dem Ordner verbunden sein. Die Auswertung bisheriger Zuordnungen geht auch so.'),
    h('button', { class: 'primary', onclick: async () => { if (await connectFolder()) { SP.at = null; renderNow(); } } }, 'Mailing-Ordner verbinden …'));
  if (SP.state === 'nodir') return h('div', { class: 'banner sp-notice' }, h('span', null, 'Im Mailing-Ordner gibt es noch keinen Ordner „Spendeneingänge …“. Dort hinein kommen die Exporte (CSV oder Excel) – überlappende Zeiträume sind kein Problem.'),
    h('button', { class: 'primary', onclick: spMakeDir }, 'Ordner „Spendeneingänge ' + UI.year + '“ anlegen'), h('button', { onclick: spPickFiles }, '+ Buchung hinzufügen'));
  if (SP.state === 'err') return h('div', { class: 'banner sp-notice err' }, h('span', null, 'Einlesen fehlgeschlagen: ' + SP.err), h('button', { onclick: () => spScan({ manual: true }) }, 'Nochmal'));
  return null;
}
function spOverview(ms, cmp, mid, by) {
  const yl = x => x.allg && SP.rows.length ? spjCompute(x.allg).list.map(e => ({ d: e.rec.d, b: e.rec.b })) : by.get(x.id);   // „Spenden JJJJ“: alle Spenden des Jahres
  const rows = ms.map(x => ({ x, s: spStats(x.m, yl(x)) })), R = spRicht(), real = rows.filter(r => !r.x.allg);
  const tot = real.reduce((t, r) => ({ n: t.n + r.s.n, sum: t.sum + r.s.sum, auf: t.auf + (r.s.n && r.s.auf ? r.s.auf : 0), kos: t.kos + (r.s.n && r.s.kos ? r.s.kos : 0) }), { n: 0, sum: 0, auf: 0, kos: 0 });
  const cell = (v, cls) => h('td', { class: 'num' + (cls ? ' ' + cls : '') }, v);
  const rt = (v, [lo, hi]) => v == null || !R.an ? '' : v < lo ? ' below' : v > hi ? ' above' : ' within';
  const ids = real.filter(r => r.s.n && r.x.pal != null).map(r => r.x.id), stop = e => e.stopPropagation();
  const row = ({ x, s }) => h('tr', { class: 'sp-urow' + (x.id === mid ? ' on' : '') + (x.allg ? ' allg' : ''), dataset: { mid: x.id }, onclick: () => { UI.spMid = x.id; renderNow(); } },
    h('td', { class: 'sp-uname' }, h('div', { class: 'sp-un' }, h('span', { class: 'dot', style: { background: x.color } }), h('span', { class: 'sp-unm' }, spDispName(x)),
      x.allg && SP.rows.length && spjCompute(x.allg).list.some(e => e.z === SPJ_OFFEN) ? h('span', { class: 'tab-badge sp-mbadge warn', tip: 'Spenden passen zu mehreren Zwecken – unter „Spendenzwecke zuordnen“ klären' },
        spjCompute(x.allg).list.filter(e => e.z === SPJ_OFFEN).length) : null,
      x.allg && SP.rows.length && spjCompute(x.allg).list.some(e => e.neu) ? h('span', { class: 'tab-badge sp-mbadge neu', tip: 'neu eingelesene Spenden bei Spendenzwecken – unter „Spendenzwecke zuordnen“ prüfen' },
        spjCompute(x.allg).list.filter(e => e.neu).length) : null,
      cmp.neuBy.get(x.id) ? h('span', { class: 'tab-badge sp-mbadge neu', tip: cmp.neuBy.get(x.id) + (cmp.neuBy.get(x.id) === 1 ? ' Spende ist' : ' Spenden sind') + ' nach dem Einlesen neu zugeordnet – bitte prüfen' }, cmp.neuBy.get(x.id)) : null,
      cmp.konfBy.get(x.id) ? h('span', { class: 'tab-badge sp-mbadge warn', tip: cmp.konfBy.get(x.id) + (cmp.konfBy.get(x.id) === 1 ? ' Spende passt' : ' Spenden passen') + ' auch zu einer anderen Maßnahme – unter „zu klären“ entscheiden' }, cmp.konfBy.get(x.id)) : null)),
    x.allg ? h('td', { class: 'muted small' }, 'alle Spenden des Jahres – Zwecke, Gliederungen, Daueraufträge') :
      h('td', { class: 'inp' }, h('input', { class: 'sp-hin', value: x.m.hinweis || '', placeholder: '–', 'data-fk': 'sp-hin:' + x.id, onclick: stop, title: x.m.hinweis || '',
        onchange: e => setM(x.id, 'hinweis', e.target.value, 'Hinweis geändert') })),
    h('td', null, x.pal != null ? fmtD(x.pal) : '–'),
    x.allg ? cell('–') : h('td', { class: 'num inp' }, h('span', { class: 'sp-unit' }, numField(x.m.auflage, 0, v => setM(x.id, 'auflage', v, 'Auflage geändert'), { class: 'numf sp-auf', 'data-fk': 'sp-auf:' + x.id, onclick: stop }), h('i', null, 'Stk.'))),
    x.allg ? cell('–') : h('td', { class: 'num inp' }, h('span', { class: 'sp-unit' }, numField(x.m.kosten, 2, v => spSetKosten(x.id, v), { class: 'numf sp-kos', 'data-fk': 'sp-kos:' + x.id, onclick: stop,
      tip: 'Gesamtkosten der Maßnahme in € (Druck, Porto, Lettershop …), z. B. 1.234,50' }), h('i', null, '€'))),
    cell(s.n ? eur0(s.sum) : '–'), cell(s.n || '–'), cell(s.avg != null ? eur(s.avg) : '–'),
    cell(s.resp != null ? num1(s.resp) + ' %' : '–', rt(s.resp, R.resp)), cell(s.roi != null ? num1(s.roi) : '–', rt(s.roi, R.roi)), h('td', { class: 'sp-rest' }));
  return [
    h('div', { class: 'tablewrap' }, h('table', { class: 'grid sp-ueb', style: { width: 'max(100%, ' + spTableW() + 'px)' } },
      h('colgroup', null, SP_UCOLS.map(c => h('col', { style: spColW(c) ? { width: spColW(c) + 'px' } : null }))),
      h('thead', null, h('tr', null, SP_UCOLS.map((c, i) => h('th', { class: (i > 2 ? 'num' : '') + (c.rest ? ' sp-rest' : '') }, c.t || null,
        c.rest ? null : h('span', { class: 'col-rs', tip: 'Spaltenbreite ziehen (Doppelklick: zurücksetzen)', onpointerdown: e => spColResize(e, i),
          ondblclick: () => { if (UI.spColW) delete UI.spColW[c.k]; saveUI(); renderNow(); } }))))),
      h('tbody', null, rows.map(row)),
      tot.n ? h('tfoot', null, h('tr', null, h('td', null, 'Summe der Maßnahmen'), h('td'), h('td'), cell(tot.auf ? tot.auf.toLocaleString('de-DE') + ' Stk.' : '–'), cell(tot.kos ? eur0(tot.kos * 100) : '–'), cell(eur0(tot.sum)), cell(tot.n),
        cell(eur(tot.sum / tot.n)), cell(tot.auf ? num1(tot.n / tot.auf * 100) + ' %' : '–'), cell(tot.kos ? num1(tot.sum / 100 / tot.kos) : '–'), h('td', { class: 'sp-rest' }))) : null)),
    ids.length >= 2 ? h('div', { class: 'sp-cmpbox' }, h('button', { class: 'link sp-cmptog', 'aria-expanded': String(!!UI.spCmp), onclick: () => { UI.spCmp = !UI.spCmp; renderNow(); } },
      (UI.spCmp ? '▾ ' : '▸ ') + 'Rücklauf im Vergleich (kumuliert, Tage nach PAL)'),
      UI.spCmp ? [h('div', { class: 'sp-cpills' }, ids.map(id => { const x = C.byId.get(id), off = (UI.spCmpOff || []).includes(id);
        return h('button', { class: 'sp-cpill' + (off ? ' off' : ''), 'aria-pressed': String(!off), tip: off ? 'im Vergleich einblenden' : 'im Vergleich ausblenden',
          onclick: () => { const o = new Set(UI.spCmpOff || []); if (off) o.delete(id); else o.add(id); UI.spCmpOff = [...o]; renderNow(); } },
          h('span', { class: 'sp-cdot', style: { background: off ? 'transparent' : x.color, borderColor: x.color } }), x.m.name || '(ohne Namen)'); })),
        h('div', { class: 'sp-chart', style: { height: '230px' }, dataset: { chart: 'cmp', ids: ids.filter(id => !(UI.spCmpOff || []).includes(id)).join(',') } })] : null) : null];
}
// Spalten der Übersicht; ganz rechts ein leerer Rest, damit sich jede Spalte (auch ROI) verstellen lässt.
// Breite ziehen wie in der Jahresplanung: nur diese Spalte und ihre rechte Nachbarin ändern sich
const SP_UCOLS = [{ k: 'name', w: 220, t: 'Maßnahme' }, { k: 'hin', w: 220, t: 'Hinweis' }, { k: 'pal', w: 100, t: 'PAL' }, { k: 'auf', w: 118, t: 'Auflage' }, { k: 'kos', w: 124, t: 'Kosten' },
  { k: 'sum', w: 126, t: 'Spendensumme' }, { k: 'n', w: 80, t: 'Anzahl' }, { k: 'avg', w: 108, t: 'Ø-Spende' }, { k: 'resp', w: 120, t: 'Responsequote' }, { k: 'roi', w: 76, t: 'ROI' },
  { k: 'rest', w: 0, flex: 0, rest: true, t: '' }];
const spColW = c => c.rest ? 0 : (UI.spColW && UI.spColW[c.k]) || c.w;
const spTableW = () => SP_UCOLS.reduce((t, c) => t + spColW(c), 0);
function spColResize(ev, i) {
  ev.preventDefault(); ev.stopPropagation();
  const COLS = SP_UCOLS, table = ev.currentTarget.closest('table'), cols = $$('col', table);
  const widths = $$('thead th', table).map(t => Math.round(t.getBoundingClientRect().width)), j = i + 1 < COLS.length ? i + 1 : -1, minOf = k => COLS[k].rest ? 0 : 50;
  const keep = JSON.parse(JSON.stringify(UI.spColW || {})), x0 = ev.clientX, w0 = widths[i], wn0 = j >= 0 ? widths[j] : 0, total = widths.reduce((a, b) => a + b, 0);
  widths.forEach((w, k) => { cols[k].style.width = w + 'px'; });   // Stand einfrieren – so verrutscht beim Ziehen nichts
  table.style.width = total + 'px';
  document.body.classList.add('dragging', 'resizing');
  let dx = 0;
  dragSession(ev, ev.currentTarget, e => {
    dx = Math.round(e.clientX - x0);
    dx = Math.max(minOf(i) - w0, j >= 0 ? Math.min(dx, Math.max(0, wn0 - minOf(j))) : dx);
    cols[i].style.width = (w0 + dx) + 'px';
    if (j >= 0) cols[j].style.width = (wn0 - dx) + 'px'; else table.style.width = (total + dx) + 'px';
  }, okay => {
    document.body.classList.remove('dragging', 'resizing');
    if (!okay || !dx) {                                           // abgebrochen oder nur geklickt: alte Breiten zurück (ohne Neuzeichnen – sonst geht ein Doppelklick verloren)
      UI.spColW = keep; COLS.forEach((c, k) => { cols[k].style.width = spColW(c) ? spColW(c) + 'px' : ''; }); table.style.width = 'max(100%, ' + spTableW() + 'px)'; return;
    }
    const nw = Object.assign({}, UI.spColW);
    COLS.forEach((c, k) => { if (!c.rest) nw[c.k] = Math.round(parseFloat(cols[k].style.width)); });
    UI.spColW = nw; saveUI(); renderNow();
  });
}
function spSetKosten(mid, v) {
  commit(d => { const m = findM(d, mid); if (!m) return; if (v == null || v === '' || !isNum(v)) delete m.kosten; else m.kosten = Math.round(+v * 100) / 100; }, 'Kosten geändert');
}
function spTiles(x, s) {
  const tile = (label, value, sub, rt, tipText) => h('div', { class: 'sp-tile', tip: tipText || null }, h('div', { class: 'sp-tl' }, label), h('div', { class: 'sp-tv' }, value), sub ? h('div', { class: 'sp-ts' }, sub) : null,
    rt ? h('div', { class: 'sp-rt ' + rt[0] }, rt[1]) : null);
  const R = spRicht(), judge = (v, [lo, hi], txt) => v == null || !R.an ? null : v < lo ? ['below', '▼ unter Richtwert ' + txt] : v > hi ? ['above', '▲ über Richtwert ' + txt] : ['within', '✓ im Richtwert ' + txt];
  if (x.allg) return h('div', { class: 'sp-tiles allg' }, tile('Spendensumme', s.n ? eur0(s.sum) : '–', spCount(s.n)),
    tile('Ø-Spende', s.avg != null ? eur(s.avg) : '–', s.med != null ? 'Median ' + eur(s.med) : null));
  return h('div', { class: 'sp-tiles' },
    tile('Spendensumme', s.n ? eur0(s.sum) : '–', spCount(s.n)),
    tile('Ø-Spende', s.avg != null ? eur(s.avg) : '–', s.med != null ? 'Median ' + eur(s.med) : null, null, 'Der Median ist die mittlere Spende – große Einzelspenden verzerren ihn kaum.'),
    tile('Responsequote', s.resp != null ? num1(s.resp) + ' %' : '–', s.auf ? spCount(s.n) : 'Auflage fehlt', judge(s.resp, R.resp, num1(R.resp[0]) + '–' + num1(R.resp[1]) + ' %')),
    tile('ROI', s.roi != null ? num1(s.roi) : '–', s.kos ? 'Kosten ' + eur0(s.kos * 100) : 'Kosten fehlen', judge(s.roi, R.roi, num1(R.roi[0]) + '–' + num1(R.roi[1])), 'Spendensumme ÷ Kosten: so viel Euro Spenden je 1 € Kosten'),
    h('div', { class: 'sp-erl' + (s.net == null ? '' : s.net >= 0 ? ' pos' : ' neg'), tip: 'Erlös = Spendensumme minus Kosten der Maßnahme' + (s.net != null ? ': ' + eur0(s.sum) + ' − ' + eur0(s.kos * 100) : '') },
      h('span', { class: 'sp-el' }, 'Erlös'), h('b', null, s.net != null ? (s.net < 0 ? '− ' : '') + eur0(Math.abs(s.net)) : '–'),
      s.net == null ? h('span', { class: 'sp-es' }, 'Kosten fehlen – in der Tabelle eintragen') : null));
}
// Hinweis erst nach kurzem Verweilen mit der Maus (z. B. die Suchhilfe über dem Schlagwort-Feld)
function spDelayTip(el, content, ms = 2000) {
  let t = null, last = null;
  el.addEventListener('mousemove', ev => { last = ev; });
  el.addEventListener('mouseenter', ev => { last = ev; clearTimeout(t); t = setTimeout(() => { if (!el.isConnected || !el.matches(':hover')) return; tipEl.replaceChildren(content()); tipEl.classList.add('on'); placeTip(last); }, ms); });
  el.addEventListener('mouseleave', () => { clearTimeout(t); hideTip(); });
  el.addEventListener('keydown', () => { clearTimeout(t); hideTip(); });
  return el;
}
const x0pal = mid => { const x = spX(mid); return x ? x.pal : null; };
const spIsDA = r => /dauerauftrag/i.test((r.text || '') + ' ' + (r.typ || ''));
// Zugeordnete Spenden vor dem PAL – meist, weil der PAL nachträglich verschoben wurde (von Hand Zugeordnetes; die Regel hält sich an ihren Zeitraum)
function spPreNotice(x, R) {
  if (x.pal == null) return null;
  const pre = R.filter(r => r.d < x.pal); if (!pre.length) return null;
  const sum = pre.reduce((t, r) => t + r.b, 0);
  return h('div', { class: 'banner sp-notice sp-pre' }, h('span', null, spCount(pre.length) + ' (' + eur(sum) + ') ' + (pre.length === 1 ? 'ist' : 'sind') + ' zugeordnet, aber vor dem PAL (' + fmtD(x.pal) + ') eingegangen – vielleicht wurde der PAL geändert.'),
    h('button', { class: 'primary', onclick: () => spExclude(pre.map(r => r.k), x.id) }, 'Diese ' + pre.length + ' herausnehmen'));
}

/* ---------- Spenden zuordnen (Maßnahme) – seit 0.18 wie „Spendenzwecke zuordnen“: links die Maßnahmen des Jahres, rechts die gewählte mit ihrer Regel
   in einer Zeile. Beim Tippen eines Schlagworts zeigt die Liste, was die Regel zuordnen würde – Häkchen weg = ausschließen, „Regel übernehmen“ ordnet zu.
   Darunter „Zugeordnet“ (neu Eingelesenes markiert, bis „geprüft“) und „Offen“: Klick markiert, die Leiste unten handelt. „zu klären“: passt zu mehreren Regeln. */
function spmSide(ms, cmp, x) {
  const by = spByM();
  const item = o => {
    const on = !SPUI.klaeren && o.id === x.id, list = by.get(o.id) || [], sum = list.reduce((t, z) => t + z.b, 0), neu = cmp.neuBy.get(o.id) || 0;
    return h('div', { class: 'spj-zi' + (on ? ' on' : ''), dataset: { mid: o.id }, role: 'button', tabindex: '0', 'aria-pressed': String(on), style: { '--zc': o.color },
      onclick: () => { SPUI.klaeren = false; UI.spMid = o.id; renderNow(); }, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } } },
      h('span', { class: 'spj-zn' }, h('span', { class: 'dot', style: { background: o.color } }), o.m.name || '(ohne Namen)'),
      h('span', { class: 'spj-zs' }, neu ? h('span', { class: 'spj-neu', tip: neu + (neu === 1 ? ' Spende ist' : ' Spenden sind') + ' nach dem Einlesen neu dazugekommen – bitte einmal prüfen' }, neu + ' neu') : null,
        list.length.toLocaleString('de-DE') + ' · ' + eur0(sum)));
  };
  return h('div', { class: 'spj-side' }, h('div', { class: 'spj-side-in', 'data-keep-scroll': 'spm-side' },
    h('div', { class: 'spj-sh' }, h('span', null, 'Maßnahmen ' + UI.year)),
    ms.map(item),
    !ms.length ? h('p', { class: 'muted small spj-side0' }, 'Keine Maßnahmen in ' + UI.year + '.') : null,
    cmp.konf.length || SPUI.klaeren ? [h('div', { class: 'spj-sep' }),
      h('div', { class: 'spj-zi offen' + (SPUI.klaeren ? ' on' : ''), dataset: { mid: '?' }, role: 'button', tabindex: '0', 'aria-pressed': String(!!SPUI.klaeren),
        onclick: () => { SPUI.klaeren = true; SPUI.typed = ''; renderNow(); }, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } } },
        h('span', { class: 'spj-zn' }, '⚠ zu klären'), h('span', { class: 'spj-zs' }, cmp.konf.length.toLocaleString('de-DE')))] : null));
}
function spmHead(x, cmp) {
  if (SPUI.klaeren) return h('div', { class: 'spj-zh offen' }, h('span', { class: 'spj-zw' }, '⚠'), h('span', { class: 'spj-zt' }, 'zu klären'),
    h('span', { class: 'spj-zst muted' }, spCount(cmp.konf.length) + ' · ' + eur0(cmp.konf.reduce((t, r) => t + r.b, 0))));
  const R = spPart(x.id, cmp).R, neu = cmp.neuBy.get(x.id) || 0;
  return h('div', { class: 'spj-zh' }, h('span', { class: 'spm-dot', style: { background: x.color } }), h('span', { class: 'spj-zt', style: { color: inkC(x.color) } }, x.m.name || '(ohne Namen)'),
    h('span', { class: 'spj-zst muted' }, (x.pal != null ? 'PAL ' + fmtD(x.pal) : 'ohne PAL') + ' · ' + spCount(R.length) + ' · ' + eur0(R.reduce((t, r) => t + r.b, 0))),
    neu ? h('span', { class: 'spj-newbar' }, h('span', { class: 'spj-neu' }, neu + ' neu'),
      h('button', { class: 'link small spj-shownew', onclick: () => { SPUI.tab = 'zu'; SPUI.onlyNew = true; SPUI.typed = ''; SPUI.more = 0; renderNow(); } }, 'ansehen'),
      h('button', { class: 'spj-ok', tip: 'Die neuen Spenden gehören zu „' + (x.m.name || '') + '“ – Markierung „neu“ aufheben. Falsche vorher markieren und herausnehmen.', onclick: () => spChecked(x.id) }, '✓ geprüft')) : null);
}
// Regel in einer Zeile: Schlagworte, „+ Schlagwort“ (Tippen = Vorschau), Zeitraum ab PAL, ohne Daueraufträge, ausgeschlossene
function spmRules(x, cmp) {
  if (SPUI.klaeren) return h('div', { class: 'spj-rules none muted small' }, 'Diese Spenden passen zu den Regeln mehrerer Maßnahmen – in der Zeile die richtige wählen oder markieren und zuordnen.');
  const m = x.m, r = m.regel || { worte: [] }, pal = x.pal, rg = spRange(m), mid = x.id, rej = spRejected(mid, cmp).length;
  let tq = null;
  const add = () => { const w = SPUI.typed.trim(), skip = new Set(SPUI.skip); SPUI.typed = ''; SPUI.skip = new Set(); if (w) spAddWord(mid, w, skip); else renderNow(); };
  const setDay = (which, v) => { const n = dn(v); spSetRule(mid, rr => {
    if (n == null) { delete rr[which]; return; }
    rr[which] = n - pal;
    if (isNum(rr.ab) && isNum(rr.bis) && rr.ab > rr.bis) { if (which === 'ab') rr.bis = rr.ab; else rr.ab = rr.bis; }   // Ende nie vor dem Beginn
  }, 'Zeitraum der Regel geändert'); };
  return h('div', { class: 'spj-rules spm-rules' },
    h('span', { class: 'spj-rl', tip: () => h('div', null, h('div', { class: 'sp-help-lead' }, 'Spenden, deren Verwendungszweck zu einem Schlagwort passt und die im Zeitraum eingehen, ordnet die Regel der Maßnahme zu – auch aus später eingelesenen Dateien (dann als „neu“ markiert). ' +
      'Beim Tippen zeigt die Liste, welche Spenden dazukämen; Häkchen weg = ausschließen. Passt eine Spende zu mehreren Maßnahmen, steht sie unter „zu klären“. Der Zeitraum hängt am PAL und wandert mit.'), spHelp()) }, 'ordnet zu:'),
    (r.worte || []).map(w => h('span', { class: 'sp-word' }, w, h('button', { class: 'sp-x', 'aria-label': w + ' entfernen', tip: '„' + w + '“ aus der Regel nehmen – die Spenden, die nur darüber zugeordnet sind, fallen wieder heraus',
      onclick: () => spSetRule(mid, rr => { rr.worte = rr.worte.filter(z => z !== w); }, 'Schlagwort „' + w + '“ entfernt') }, '×'))),
    !(r.worte || []).length ? h('span', { class: 'muted small' }, 'noch kein Schlagwort') : null,
    h('span', { class: 'spj-ein' }, spDelayTip(h('input', { class: 'sp-wordin', value: SPUI.typed, placeholder: '+ Schlagwort', 'aria-label': 'Schlagwort hinzufügen', 'data-fk': 'sp-word',
      oninput: e => { SPUI.typed = e.target.value; clearTimeout(tq); tq = setTimeout(renderNow, 180); },
      onkeydown: e => { if (e.key === 'Enter' || e.key === ',' || e.key === ';') { e.preventDefault(); clearTimeout(tq); add(); } else if (e.key === 'Escape') { SPUI.typed = ''; renderNow(); } } }), spHelp)),
    h('span', { class: 'spm-zr' }, h('span', { class: 'spj-rl' }, 'Zeitraum'),
      pal == null ? h('span', { class: 'warn small' }, 'ohne PAL ist die Regel aus – bitte PAL eintragen') : [
        dateInput(rg.a != null ? ds(rg.a) : '', 'sp-rab', v => setDay('ab', v)), '–', dateInput(rg.b != null ? ds(rg.b) : '', 'sp-rbis', v => setDay('bis', v)),
        h('span', { class: 'muted small' }, rg.a != null || rg.b != null ? (rg.a != null ? (rg.a - pal >= 0 ? '+' : '') + (rg.a - pal) : '…') + ' bis ' + (rg.b != null ? '+' + (rg.b - pal) : '…') + ' Tage ab PAL' : '')]),
    h('label', { class: 'check small sp-noda', tip: 'Daueraufträge (laut Buchungstext) ordnet die Regel nicht zu' },
      h('input', { type: 'checkbox', checked: r.ohneDA === true, onchange: e => spSetRule(mid, rr => { if (e.target.checked) rr.ohneDA = true; else delete rr.ohneDA; }, e.target.checked ? 'Regel: Daueraufträge ausgeschlossen' : 'Regel: Daueraufträge wieder eingeschlossen') }),
      'ohne Daueraufträge'),
    rej ? h('button', { class: 'link small spm-rej', tip: 'passen zur Regel, wurden aber herausgenommen – ansehen und ggf. wieder zulassen', onclick: () => { SPUI.tab = 'aus'; SPUI.typed = ''; SPUI.more = 0; renderNow(); } }, rej + ' ausgeschlossen') : null);
}
// Liste: Vorschau beim Tippen (Häkchen = wird zugeordnet), sonst „Zugeordnet“ / „Offen“ / „Ausgeschlossen“ bzw. „zu klären“
function spmList(x, cmp) {
  const mid = x.id, S = D.spenden, typed = SPUI.typed.trim(), P = spPart(mid, cmp), sumOf = l => l.reduce((t, r) => t + r.b, 0), byDate = (a, b) => b.d - a.d || b.b - a.b;
  const yms = C.ms.filter(o => inYear(o, UI.year)), nm = id => spMName(id);
  const tagsOf = (rec, mode) => {
    const t = [], hl = cmp.hits.get(rec.k) || [], z = S.zu[rec.k];
    if (mode === 'zu') { const my = hl.find(g => g.id === mid);
      t.push(z && !z.r ? h('span', { class: 'sp-tag hand', tip: 'von Hand zugeordnet' }, 'von Hand') : my ? h('span', { class: 'sp-tag rule', tip: 'passt zur Regel (Schlagwort „' + my.w + '“)' }, my.w) : null); }
    if (mode !== 'zu' && hl.length > 1 && !cmp.assigned(rec.k)) t.push(h('span', { class: 'sp-tag other', tip: 'passt zu mehreren Regeln – unter „zu klären“ entscheiden' }, 'zu klären: ' + hl.map(g => nm(g.id)).join(' / ')));
    if (mode === 'offen' && (S.nein[rec.k] || []).includes(mid)) t.push(h('span', { class: 'sp-tag gone', tip: 'aus dieser Maßnahme herausgenommen' }, 'ausgeschlossen'));
    if (rec.gone) t.push(h('span', { class: 'sp-tag gone' }, 'nicht mehr im Ordner'));
    if (mode === 'zu' && x.pal != null && rec.d < x.pal) t.push(h('span', { class: 'sp-tag other', tip: 'Eingang vor dem PAL der Maßnahme – gehört sie wirklich dazu?' }, 'vor dem PAL'));
    if (spIsDA(rec)) t.push(h('span', { class: 'sp-tag da', tip: 'Dauerauftrag (laut Buchungstext)' }, 'Dauerauftrag'));
    return t;
  };
  if (SPUI.fmid !== mid || SPUI.fpal !== x.pal) { spResetFilter(x.m); SPUI.fmid = mid; SPUI.fpal = x.pal; SPUI.tab = 'zu'; SPUI.onlyNew = false; SPUI.more = 0; }
  // ---- Vorschau beim Tippen: was die Regel mit diesem Schlagwort zuordnen würde
  if (typed && !SPUI.klaeren) {
    const rg0 = spRange(x.m), pal = x.pal, a = rg0.a ?? pal, b = rg0.b ?? (pal != null ? pal + SP_TAGE : null), noDA = ((x.m.regel || {}).ohneDA === true), f = spMatcher([typed]);
    const match = pal == null ? [] : SP.rows.filter(rec => (a == null || rec.d >= a) && (b == null || rec.d <= b) && !(noDA && spIsDA(rec)) && f(rec));
    const cand = match.filter(rec => !cmp.assigned(rec.k)).sort(byDate), mine = match.filter(rec => cmp.assigned(rec.k) === mid).length, other = match.length - cand.length - mine;
    if (SPUI.skipFor !== mid + '|' + typed) { SPUI.skipFor = mid + '|' + typed; SPUI.skip = new Set(cand.filter(rec => (S.nein[rec.k] || []).includes(mid)).map(rec => rec.k)); }
    const ticked = () => cand.filter(rec => !SPUI.skip.has(rec.k));
    const head = () => { const tk = ticked();
      const cb = h('input', { type: 'checkbox', class: 'spj-all', checked: cand.length > 0 && !SPUI.skip.size, disabled: !cand.length, 'aria-label': 'alle an/aus',
        onchange: () => { SPUI.skip = SPUI.skip.size ? new Set() : new Set(cand.map(r => r.k)); upd(); } });
      cb.indeterminate = SPUI.skip.size > 0 && SPUI.skip.size < cand.length;
      return h('div', { class: 'spj-lh' }, cb, h('b', null, 'Vorschau „' + typed + '“'),
        h('span', { class: 'spj-sub muted small' }, tk.length + ' von ' + spCount(cand.length) + ' (' + eur(sumOf(tk)) + ') würden zugeordnet' + (mine ? ' · ' + mine + ' schon hier' : '') + (other ? ' · ' + other + ' bei anderen Maßnahmen' : '')),
        h('button', { class: 'primary spm-apply', disabled: pal == null, tip: 'Schlagwort in die Regel übernehmen – Spenden ohne Häkchen werden ausgeschlossen', onclick: () => {
          const skip = new Set(SPUI.skip); SPUI.typed = ''; SPUI.skip = new Set(); spAddWord(mid, typed, skip); } }, 'Regel übernehmen'),
        h('button', { class: 'link small spj-prevx', onclick: () => { SPUI.typed = ''; renderNow(); } }, 'Abbrechen')); };
    const row = rec => { const on = !SPUI.skip.has(rec.k);
      return h('div', { class: 'spj-row' + (on ? ' sel' : ''), dataset: { k: rec.k }, role: 'option', 'aria-selected': String(on), tip: () => spTip(rec),
        onclick: ev => { if (ev.target.closest('button, a, input, select')) return; if (SPUI.skip.has(rec.k)) SPUI.skip.delete(rec.k); else SPUI.skip.add(rec.k); upd(); } },
        h('span', { class: 'spj-cb', 'aria-hidden': 'true' }), h('span', { class: 'sp-d' }, fmtD(rec.d)), h('span', { class: 'sp-b' }, eur(rec.b)), h('span', { class: 'spj-g' }, spGlied(rec.konto)),
        UI.spDet ? h('span', { class: 'sp-n' }, rec.name || '') : null, h('span', { class: 'sp-z' }, rec.zweck || '–'),
        h('span', { class: 'spj-tags' }, (cmp.hits.get(rec.k) || []).filter(g => g.id !== mid).length ? h('span', { class: 'sp-tag other', tip: 'passt auch zur Regel einer anderen Maßnahme – steht danach unter „zu klären“' },
          'auch: ' + (cmp.hits.get(rec.k) || []).filter(g => g.id !== mid).map(g => nm(g.id)).join(', ')) : null,
          (S.nein[rec.k] || []).includes(mid) ? h('span', { class: 'sp-tag gone' }, 'ausgeschlossen') : null, spIsDA(rec) ? h('span', { class: 'sp-tag da' }, 'Dauerauftrag') : null),
        h('span', { class: 'spj-how' })); };
    let box = null;
    const upd = () => { if (!box) return; box.querySelector('.spj-lh').replaceWith(head());
      for (const el of box.querySelectorAll('.spj-row')) { const on = !SPUI.skip.has(el.dataset.k); el.classList.toggle('sel', on); el.setAttribute('aria-selected', String(on)); } };
    box = h('div', { class: 'spj-listbox spm-listbox prev' }, head(),
      h('div', { class: 'spj-listwrap' }, h('div', { class: 'spj-list', 'data-keep-scroll': 'spm-list', role: 'listbox', 'aria-multiselectable': 'true' },
        cand.slice(0, SP_MAX).map(row), cand.length > SP_MAX ? h('div', { class: 'sp-more muted small' }, '… und ' + (cand.length - SP_MAX) + ' weitere') : null,
        !cand.length ? h('div', { class: 'sp-empty muted small' }, pal == null ? 'Ohne PAL ist die Regel aus.' : 'Keine offene Spende im Zeitraum passt zu „' + typed + '“.') : null)));
    return box;
  }
  // ---- Listen mit Markieren
  const tab = SPUI.klaeren ? 'klaeren' : SPUI.tab === 'aus' && spRejected(mid, cmp).length ? 'aus' : SPUI.tab === 'offen' ? 'offen' : 'zu';
  const neuK = new Set(P.R.filter(r => { const z = S.zu[r.k]; return z && z.r && /m/.test(S.neu[r.k] || ''); }).map(r => r.k));
  if (!neuK.size) SPUI.onlyNew = false;
  let list = tab === 'klaeren' ? cmp.konf.slice() : tab === 'aus' ? spRejected(mid, cmp) : tab === 'offen' ? spFilter(P.L) : P.R.slice();
  if (tab === 'zu' && SPUI.onlyNew) list = list.filter(r => neuK.has(r.k));
  list.sort(byDate);
  const ctx = [UI.year, mid, tab, SPUI.onlyNew].join('|');
  if (SPUI.selCtx !== ctx) { SPUI.sel = new Set(); SPUI.anchor = null; SPUI.selCtx = ctx; SPUI.moveTo = null; }
  const inList = new Set(list.map(r => r.k)); for (const k of SPUI.sel) if (!inList.has(k)) SPUI.sel.delete(k);
  const lim = SP_MAX + SPUI.more, selRecs = () => list.filter(r => SPUI.sel.has(r.k)), keys = () => selRecs().map(r => r.k);
  const done = () => { SPUI.sel = new Set(); SPUI.anchor = null; };
  const allBox = () => { const n = selRecs().length, full = n > 0 && n === list.length;
    const cb = h('input', { type: 'checkbox', class: 'spj-all', checked: full, disabled: !list.length, 'aria-label': full ? 'Auswahl aufheben' : 'alle auswählen', tip: full ? 'Auswahl aufheben' : 'alle ' + list.length.toLocaleString('de-DE') + ' auswählen',
      onchange: ev => { SPUI.sel = full ? new Set() : new Set(list.map(r => r.k)); SPUI.anchor = null; selUpd(ev.currentTarget); } });
    cb.indeterminate = n > 0 && !full; return cb; };
  const target = (def, excl) => { let go = null; const opts = yms.filter(o => o.id !== excl);
    const ok = v => opts.some(o => o.id === v), d0 = ok(SPUI.moveTo) ? SPUI.moveTo : ok(def) ? def : '';
    const s = h('select', { class: 'spj-zsel spj-move', 'aria-label': 'Maßnahme', onchange: e => { SPUI.moveTo = e.target.value; go.disabled = !e.target.value; } },
      h('option', { value: '', selected: !d0, disabled: true }, 'Maßnahme wählen …'), opts.map(o => h('option', { value: o.id, selected: d0 === o.id }, o.m.name || '(ohne Namen)')));
    go = h('button', { class: 'primary spj-go', disabled: !d0, onclick: () => { if (s.value) { const ks = keys(); done(); spAssignTo(ks, s.value); } } }, 'Zuordnen');
    return [s, go]; };
  const act = () => { const sel = selRecs();
    return h('div', { class: 'spj-act' + (sel.length ? ' on' : '') },
      h('b', { class: 'spj-selinfo' }, spCount(sel.length) + ' markiert · ' + eur(sumOf(sel))),
      tab === 'zu' ? [h('button', { class: 'spm-excl', tip: 'aus der Maßnahme nehmen – die Regel ordnet sie nicht wieder zu', onclick: () => { const ks = keys(); done(); spExclude(ks, mid); } }, 'Herausnehmen'),
        h('span', { class: 'muted' }, 'oder zuordnen zu'), target('', mid)] :
      tab === 'aus' ? h('button', { class: 'primary spm-readmit', onclick: () => { const ks = keys(); done(); spReadmit(ks, mid); } }, 'Wieder zulassen') :
      [h('span', { class: 'muted' }, 'zuordnen zu'), target(tab === 'offen' ? mid : '', null)],
      h('button', { class: 'link small spj-selx', onclick: ev => { done(); selUpd(ev.currentTarget); } }, 'Auswahl aufheben')); };
  const selUpd = el => { const box = el.closest('.spj-listbox'); if (!box) return;
    for (const r of box.querySelectorAll('.spj-row')) { const on = SPUI.sel.has(r.dataset.k); r.classList.toggle('sel', on); r.setAttribute('aria-selected', String(on)); }
    box.querySelector('.spj-all').replaceWith(allBox()); box.querySelector('.spj-act').replaceWith(act()); };
  const pick = (ev, i) => { if (ev.target.closest('button, select, input, a')) return;
    const k = list[i].k;
    if (ev.shiftKey && SPUI.anchor != null) { const a = list.findIndex(r => r.k === SPUI.anchor);
      if (a >= 0) { for (let j = Math.min(a, i); j <= Math.max(a, i); j++) SPUI.sel.add(list[j].k); selUpd(ev.currentTarget); return; } }
    if (SPUI.sel.has(k)) { SPUI.sel.delete(k); if (SPUI.anchor === k) SPUI.anchor = null; } else { SPUI.sel.add(k); SPUI.anchor = k; }
    selUpd(ev.currentTarget); };
  const row = (rec, i) => { const on = SPUI.sel.has(rec.k), z = S.zu[rec.k];
    return h('div', { class: 'spj-row' + (tab === 'klaeren' ? ' offen' : '') + (on ? ' sel' : ''), dataset: { k: rec.k }, role: 'option', 'aria-selected': String(on), tip: () => spTip(rec),
      onmousedown: ev => { if (ev.shiftKey) ev.preventDefault(); }, onclick: ev => pick(ev, i) },
      h('span', { class: 'spj-cb', 'aria-hidden': 'true' }),
      h('span', { class: 'sp-d' }, fmtD(rec.d)), h('span', { class: 'sp-b' }, eur(rec.b)), h('span', { class: 'spj-g' }, spGlied(rec.konto)),
      UI.spDet ? h('span', { class: 'sp-n' }, rec.name || '') : null, h('span', { class: 'sp-z' }, rec.gone ? '' : rec.zweck || '–'),
      h('span', { class: 'spj-tags' }, tab === 'klaeren' ? (cmp.hits.get(rec.k) || []).map(g => h('button', { class: 'spj-pick', tip: 'der Maßnahme „' + nm(g.id) + '“ zuordnen (passt über „' + g.w + '“)',
        onclick: ev => { ev.stopPropagation(); spAssignTo([rec.k], g.id); } }, '→ ' + nm(g.id))) : tagsOf(rec, tab)),
      h('span', { class: 'spj-how' }, tab === 'zu' && z && z.r && neuK.has(rec.k) ? h('span', { class: 'sp-tag neu', tip: 'nach dem Einlesen neu zugeordnet – noch nicht geprüft' }, 'neu') : null));
  };
  const daM = spDAMode(), f = SPUI.f;
  let tq = null;
  const fset = (k, v, now) => { SPUI.f[k] = v; clearTimeout(tq); if (now) renderNow(); else tq = setTimeout(renderNow, 250); };
  const nAus = spRejected(mid, cmp).length;
  const seg = (k, label) => h('button', { class: 'seg-btn' + (tab === k ? ' on' : ''), dataset: { tab: k }, onclick: () => { SPUI.tab = k; SPUI.more = 0; renderNow(); } }, label);
  return h('div', { class: 'spj-listbox spm-listbox' },
    h('div', { class: 'spj-lh' }, allBox(),
      tab === 'klaeren' ? h('b', null, 'Zu klären') : h('span', { class: 'segs spj-lv' }, seg('zu', 'Zugeordnet (' + P.R.length.toLocaleString('de-DE') + ')'), seg('offen', 'Offen'), nAus ? seg('aus', 'Ausgeschlossen (' + nAus + ')') : null),
      h('span', { class: 'spj-sub muted small' }, spCount(list.length) + ' · ' + eur(sumOf(list)) + (tab === 'offen' && list.length !== P.L.length ? ' (im Filter)' : '')),
      tab === 'zu' && neuK.size ? h('button', { class: 'spj-onlynew' + (SPUI.onlyNew ? ' on' : ''), 'aria-pressed': String(!!SPUI.onlyNew), onclick: () => { SPUI.onlyNew = !SPUI.onlyNew; SPUI.more = 0; renderNow(); } }, 'nur neue (' + neuK.size + ')') : null,
      h('span', { class: 'muted small spj-clickhint' }, 'Klick auf eine Zeile markiert'),
      h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!UI.spDet, onchange: e => { UI.spDet = e.target.checked; renderNow(); } }), 'Namen zeigen')),
    tab === 'offen' ? h('div', { class: 'spm-filter' },
      h('span', { class: 'spj-rl' }, 'Zeitraum'), dateInput(f.von, 'sp-fvon', v => fset('von', v, true)), '–', dateInput(f.bis, 'sp-fbis', v => fset('bis', v, true)),
      h('label', { class: 'small sp-da', tip: 'Daueraufträge (laut Buchungstext) anzeigen, ausblenden oder nur sie zeigen' }, 'Daueraufträge ',
        h('select', { 'data-fk': 'sp-da', onchange: e => { UI.spDA = e.target.value; UI.spHideDA = false; renderNow(); } },
          [['alle', 'einblenden'], ['ohne', 'ausblenden'], ['nur', 'nur Daueraufträge']].map(([v, t]) => h('option', { value: v, selected: daM === v }, t)))),
      spDelayTip(h('input', { type: 'search', class: 'sp-q', placeholder: 'suchen (Verwendungszweck, Name …)', value: f.q, 'data-fk': 'sp-q', oninput: e => fset('q', e.target.value) }), spHelp)) : null,
    h('div', { class: 'spj-listwrap' },
      h('div', { class: 'spj-list', 'data-keep-scroll': 'spm-list', role: 'listbox', 'aria-multiselectable': 'true' }, list.slice(0, lim).map(row),
        list.length > lim ? h('button', { class: 'link spj-more', onclick: () => { SPUI.more += 300; renderNow(); } }, '… ' + (list.length - lim).toLocaleString('de-DE') + ' weitere anzeigen') : null,
        !list.length ? h('div', { class: 'sp-empty muted small' }, tab === 'zu' ? (SPUI.onlyNew ? 'Keine neuen Spenden.' : 'Noch nichts zugeordnet – Schlagwort eintragen oder unter „Offen“ markieren und zuordnen.') :
          tab === 'offen' ? (ST.conn !== 'ok' ? 'Mailing-Ordner nicht verbunden.' : !SP.rows.length ? 'Noch keine Buchungen eingelesen.' : 'Keine offene Spende im Filter.') : 'Keine.') : null),
      act()));
}
function spAssign(x, cmp) {
  const ms = C.ms.filter(o => inYear(o, UI.year));
  if (SPUI.klaeren && !cmp.konf.length) SPUI.klaeren = false;
  const R = spPart(x.id, cmp).R;
  return { body: h('div', null, SPUI.klaeren ? null : spPreNotice(x, R),
    h('div', { class: 'spj-zu spm' }, spmSide(ms, cmp, x), h('div', { class: 'spj-main' }, spmHead(x, cmp), spmRules(x, cmp), spmList(x, cmp)))) };
}
VIEW_FN.spenden = main => {
  const y = UI.year;
  if ((SP.at == null || _spLastView !== 'spenden') && !SP.busy && ST.conn === 'ok') spScan();   // beim Öffnen des Reiters neu einlesen (unveränderte Dateien kommen aus dem Speicher)
  _spLastView = 'spenden';
  const real = C.ms.filter(x => inYear(x, y)), allg = spAllgX(y), ms = [allg, ...real];
  const mid = ms.some(o => o.id === UI.spMid) ? UI.spMid : spPickM(real) || allg.id, x = ms.find(o => o.id === mid);
  UI.spMid = mid;
  const cmp = spCompute(), by = spByM();
  main.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); main.classList.add('sp-drop'); } });
  main.addEventListener('dragleave', e => { if (e.target === main) main.classList.remove('sp-drop'); });
  main.addEventListener('drop', e => {
    main.classList.remove('sp-drop');
    const fl = [...e.dataTransfer.files].filter(f => !/\.zip$/i.test(f.name)); if (!fl.length) return;   // ZIP = Update-Paket (siehe 03_store)
    e.preventDefault(); e.spHandled = true; spAddFiles(fl);
  });
  const s = spStats(x.m, by.get(x.id)), P = spPart(x.id, cmp);   // Kennzahlen und Spenden der gewählten Maßnahme
  const tools = () => [spStatus(), h('button', { disabled: ST.conn !== 'ok', onclick: () => spScan({ manual: true }) }, '↻ Neu einlesen'), h('button', { class: 'primary', onclick: spPickFiles, tip: 'Export der Spendeneingänge (CSV oder Excel) wählen – die App legt ihn im Ordner „Spendeneingänge …“ ab, liest ihn ein und zeigt, was neu ist' }, '+ Buchung hinzufügen')];
  put(main,
    spNotice(),
    spCovBar(y),
    section('sp-ueb', 'Maßnahmen ' + y, () => ({ body: spOverview(ms, cmp, mid, by) }), { tools, closedSummary: () => {
      const neu = ms.filter(o => cmp.neuBy.get(o.id)).map(o => (o.m.name || '(ohne Namen)') + ' (' + cmp.neuBy.get(o.id) + ')');
      return 'aufklappen, um die Maßnahme zu wechseln' + (neu.length ? ' · neu: ' + neu.join(', ') : '') + (cmp.konf.length ? ' · ' + cmp.konf.length + ' zu klären' : ''); } }),
    x.allg ? section('sp-m', spjName(y), () => ({ body: spjView(y) }), {          // alle Spenden des Jahres: Zwecke, Gliederungen, Daueraufträge
      info: 'Alle Spenden des Jahres aus den eingelesenen Dateien – egal, ob sie einer Maßnahme zugeordnet sind. Mit „Herkunft“ lassen sich die Spenden aus Maßnahmen oder die ohne Maßnahme getrennt ansehen.',
      closedSummary: () => { if (!SP.rows.length) return 'Spendendateien noch nicht eingelesen'; const st = spjStats(spjCompute(y).list); return eur0(st.sum) + ' aus ' + spCount(st.n); } }) :
    section('sp-m', h('span', { class: 'sp-mname', style: { color: inkC(x.color) } }, x.m.name || '(ohne Namen)'),
      () => ({ body: h('div', { class: 'sp-kpi' }, spTiles(x, s), spCharts(x, by.get(mid))) }),
      { closedSummary: () => s.n ? eur0(s.sum) + ' aus ' + spCount(s.n) : 'noch keine Spenden zugeordnet' }),
    x.allg ? section('sp-zu', 'Spendenzwecke zuordnen', () => spjAssign(y), {          // Auswertung oben, Zuordnung der Zwecke hier – getrennt
      info: 'Links die Zwecke, rechts der gewählte Zweck mit seinen Regeln (Schlagworte im Verwendungszweck, Konten, Maßnahmen) – die Spenden des ganzen Jahres zählen dann automatisch. Darunter die Spenden ohne Zweck: Klick markiert, die Leiste unten verschiebt. Passt eine Spende zu mehreren Zwecken, steht sie unter „zu klären“.',
      closedSummary: () => { if (!SP.rows.length) return null; const n = spjCompute(y).list.filter(e => e.z === SPJ_OFFEN).length; return D.zwecke.length + (D.zwecke.length === 1 ? ' Zweck' : ' Zwecke') + (n ? ' · ' + n + ' zu klären' : ''); } }) :
    section('sp-zu', 'Spenden zuordnen', () => spAssign(x, cmp), {
      info: 'Links die Maßnahmen des Jahres, rechts die gewählte mit ihrer Regel (Schlagworte, Zeitraum ab PAL) – passende Spenden ordnet die Regel selbst zu, auch aus später eingelesenen Dateien (dann als „neu“ markiert). Beim Tippen eines Schlagworts zeigt die Liste, was dazukäme: Häkchen weg = ausschließen. Einzelne Spenden: unter „Offen“ markieren und zuordnen.',
      closedSummary: () => spCount(P.R.length) + ' zugeordnet' + (cmp.neuBy.get(x.id) ? ' · ' + cmp.neuBy.get(x.id) + ' neu' : '') + (cmp.konf.length ? ' · ' + cmp.konf.length + ' zu klären' : '') }));
};
VIEW_FN['spenden:after'] = main => {
  for (const el of $$('[data-chart]', main)) try { spDraw(el); } catch (e) { console.error(e); }
  if (SPJ.focusName) { SPJ.focusName = false; const e = $('.spj-name', main); if (e) { e.focus(); e.select(); } }   // neuer Zweck: Namen gleich überschreiben
  const sg = $('.spj-sugbar:not(.all) .spj-sugs', main), more = $('.spj-sugmore', main);          // „alle N“ nur, wenn nicht alle Vorschläge in die Zeile passen
  if (sg && more) more.classList.toggle('hide', sg.scrollHeight <= sg.clientHeight + 2);
};

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
    h('div', { class: 'sp-chart', style: { height: '150px' }, dataset: { chart: 'span', mid: x.id } }),
    h('div', { class: 'sp-cht' }, h('b', null, 'Spenden pro Tag'), h('span', { class: 'muted' }, ' · grau hinterlegt: Wochenenden')),
    h('div', { class: 'sp-chart', style: { height: '150px' }, dataset: { chart: 'day', mid: x.id } }));
}
const spDayLab = (sr, n) => fmtW(n) + (sr.pal != null && n >= sr.pal ? ' · Tag ' + (n - sr.pal) + ' ab PAL' : sr.pal != null ? ' · vor dem PAL' : '');
function spXTicks(svg, g, sr, X) {
  const pxd = g.pw / sr.days, step = [7, 14, 28, 56, 91, 182].find(s => s * pxd >= 58) || 365, a = sr.pal ?? sr.d0, y0 = g.mt + g.ph;
  for (let n = a - Math.floor((a - sr.d0) / step) * step; n <= sr.d1; n += step) svg.append(sv('text', { class: 'sp-ax', x: X(n - sr.d0), y: y0 + 16, 'text-anchor': 'middle' }, fmtS(n)));
}
function spFrame(el, H, ml = 70) {
  const W = Math.max(320, Math.floor(+el.dataset.w || el.clientWidth)), g = { W, H, ml, mr: 70, mt: 18, mb: 26 };
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
  if (kind === 'ycum' || kind === 'yweek') return spjDraw(el);
  if (kind === 'cmp') { const ids = el.dataset.ids.split(',').filter(id => C.byId.has(id) && by.get(id)); if (!ids.length) { el.replaceChildren(h('p', { class: 'muted small' }, 'Alle Maßnahmen ausgeblendet – oben wieder einblenden.')); return; } return spDrawCmp(el, ids, by); }
  const x = spX(el.dataset.mid), list = x && by.get(x.id);
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
  if (!ser.length) { el.replaceChildren(); return; }
  const T = Math.min(365, Math.max(56, ...ser.map(s => s.last))), { svg, g } = spFrame(el, +el.dataset.h || 230, 70);
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
