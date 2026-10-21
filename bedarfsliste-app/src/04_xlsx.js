/* ===================================================================== Excel lesen und schreiben (ohne Bibliothek; Excel-Dateien sind ZIP-Archive mit XML) */

/* ---------- ZIP schreiben (ohne Kompression) */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipBlob(files, type) {
  const enc = new TextEncoder(), parts = [], central = [];
  const now = new Date();
  const dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dtime, true); lh.setUint16(12, ddate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dtime, true); ch.setUint16(14, ddate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type });
}

/* ---------- ZIP lesen; entpackt wird mit dem Browser (DecompressionStream) */
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
function zipRaw(z, name) {
  const e = z.out.get(name); if (!e) return null;
  const st = e.off + 30 + z.dv.getUint16(e.off + 26, true) + z.dv.getUint16(e.off + 28, true);
  return { e, data: z.u8.subarray(st, st + e.csz) };
}
async function zipText(z, name) {
  const r = zipRaw(z, name); if (!r) return null;
  if (r.e.meth === 0) return new TextDecoder().decode(r.data);
  if (r.e.meth !== 8) throw new Error('Excel-Datei mit unbekannter Komprimierung');
  return new Response(new Blob([r.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
}
// nur den Anfang entpacken (sehr große Blätter, z. B. bis Zeile 1.048.576 durchformatiert): { text, cut }
async function zipTextHead(z, name, max) {
  const r = zipRaw(z, name); if (!r) return null;
  if (r.e.meth === 0) { const t = new TextDecoder().decode(r.data); return { text: t.slice(0, max), cut: t.length > max }; }
  if (r.e.meth !== 8) throw new Error('Excel-Datei mit unbekannter Komprimierung');
  const rd = new Blob([r.data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).pipeThrough(new TextDecoderStream()).getReader();
  let text = '', cut = false;
  for (;;) { const { value, done } = await rd.read(); if (done) break; text += value; if (text.length > max) { cut = true; break; } }
  if (cut) { rd.cancel().catch(() => {}); text = text.slice(0, text.lastIndexOf('</row>') + 6); }
  return { text, cut };
}

/* ---------- Excel-Arbeitsmappe lesen: alle Blätter als Zeilen (Arrays); verbundene Zellen tragen überall den Wert der ersten Zelle */
const xattr = (s, n) => { const q = new RegExp('(?:^|\\s)' + n + '="([^"]*)"').exec(s); return q ? q[1] : null; };
const xunesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (m, c) => String.fromCodePoint(parseInt(c, 16))).replace(/&#(\d+);/g, (m, c) => String.fromCodePoint(+c)).replace(/&amp;/g, '&');
const colIdx = ref => { let c = 0; for (const ch of ref.replace(/\d+$/, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
const tTexts = s => [...s.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(x => xunesc(x[1])).join('');
function sheetRows(xml, ss) {
  const rows = [], rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = rowRe.exec(xml))) {
    const r = xattr(m[1], 'r'), ri = r ? +r - 1 : rows.length, cells = [];
    let ci = 0, c;
    if (m[2]) {
      cellRe.lastIndex = 0;
      while ((c = cellRe.exec(m[2]))) {
        const ref = xattr(c[1], 'r'); if (ref) ci = colIdx(ref);
        const t = xattr(c[1], 't'), inner = c[2] || '', v = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
        cells[ci++] = t === 's' ? (ss[+v] ?? '') : t === 'inlineStr' ? tTexts(inner) : t === 'b' ? v === '1' : t === 'str' || t === 'e' ? (v != null ? xunesc(v) : '') : (v != null && v !== '' ? +v : '');
      }
    }
    rows[ri] = Array.from(cells, x => x ?? '');
  }
  const merges = [...xml.matchAll(/<mergeCell\b[^>]*ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)];
  for (const [, c1, r1, c2, r2] of merges) {
    const a = colIdx(c1), b = colIdx(c2), top = +r1 - 1, bot = +r2 - 1, v = (rows[top] || [])[a];
    if (v === '' || v == null || bot - top > 500) continue;
    for (let r = top; r <= bot; r++) { rows[r] = rows[r] || []; for (let k = a; k <= b; k++) if (rows[r][k] === '' || rows[r][k] == null) rows[r][k] = v; }
  }
  return Array.from(rows, r => r ? Array.from(r, x => x ?? '') : []);
}
async function xlsxBook(buf, opts = {}) {
  const z = zipIndex(buf), max = opts.max || 4e6;
  const wbx = await zipText(z, 'xl/workbook.xml') || '', rels = await zipText(z, 'xl/_rels/workbook.xml.rels') || '';
  const target = {};
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) target[xattr(m[1], 'Id')] = xattr(m[1], 'Target');
  const ssx = await zipText(z, 'xl/sharedStrings.xml'), ss = ssx ? [...ssx.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(x => tTexts(x[1])) : [];
  const sheets = [];
  for (const m of wbx.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = xunesc(xattr(m[1], 'name') || ''), t = target[xattr(m[1], 'r:id')];
    if (!t) continue;
    const path = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
    const got = await zipTextHead(z, path, max); if (!got) continue;
    sheets.push({ name, rows: sheetRows(got.text, ss), cut: got.cut });
  }
  return { sheets };
}

/* ---------- Excel schreiben
   Zelle: Wert oder { v, t: 'd' (Datum JJJJ-MM-TT), st: { b, i, sz, color, fill, h, v, wrap, border } }
   Blatt: { name, cols: [Breiten], rows: [[Zellen]], merges: ['A1:H1'], heights: { Zeile: pt }, freeze: 'A12', lists: [{ ref: 'B12:B300', items: [...] }] } */
const xesc = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = i => { let s = ''; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
const argb = hex => 'FF' + String(hex).replace('#', '').toUpperCase().padStart(6, '0');
function xlsxBlob(sheets) {
  const fonts = [], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'], xfs = [], idx = { font: new Map(), fill: new Map(), border: new Map(), xf: new Map() };
  const fontId = st => {
    const k = [st.b ? 1 : 0, st.i ? 1 : 0, st.sz || 10, st.color || ''].join('|');
    if (!idx.font.has(k)) { idx.font.set(k, fonts.length); fonts.push('<font>' + (st.b ? '<b/>' : '') + (st.i ? '<i/>' : '') + '<sz val="' + (st.sz || 10) + '"/>' + (st.color ? '<color rgb="' + argb(st.color) + '"/>' : '') + '<name val="Calibri"/><family val="2"/></font>'); }
    return idx.font.get(k);
  };
  const fillId = hex => {
    if (!hex) return 0;
    if (!idx.fill.has(hex)) { idx.fill.set(hex, fills.length); fills.push('<fill><patternFill patternType="solid"><fgColor rgb="' + argb(hex) + '"/><bgColor indexed="64"/></patternFill></fill>'); }
    return idx.fill.get(hex);
  };
  const borderId = kind => {
    if (!kind) return 0;
    if (!idx.border.has(kind)) {
      const side = t => '<' + t + ' style="thin"><color rgb="FFD9D9D9"/></' + t + '>';
      idx.border.set(kind, borders.length); borders.push('<border>' + side('left') + side('right') + side('top') + side('bottom') + '<diagonal/></border>');
    }
    return idx.border.get(kind);
  };
  const xfId = (st, t) => {
    st = st || {};
    const k = JSON.stringify([st.b, st.i, st.sz, st.color, st.fill, st.h, st.v, st.wrap, st.border, t || '']);
    if (!idx.xf.has(k)) {
      const al = st.h || st.v || st.wrap ? '<alignment' + (st.h ? ' horizontal="' + st.h + '"' : '') + (st.v ? ' vertical="' + st.v + '"' : '') + (st.wrap ? ' wrapText="1"' : '') + '/>' : '';
      const nf = t === 'd' ? 164 : t === 'n' ? 3 : 0;
      idx.xf.set(k, xfs.length);
      xfs.push('<xf numFmtId="' + nf + '" fontId="' + fontId(st) + '" fillId="' + fillId(st.fill) + '" borderId="' + borderId(st.border) + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"' + (al ? ' applyAlignment="1">' + al + '</xf>' : '/>'));
    }
    return idx.xf.get(k);
  };
  xfId({});
  const cellXml = (c, ref) => {
    if (c == null || c === '') return '';
    const o = typeof c === 'object' ? c : { v: c };
    const empty = o.v == null || o.v === '';
    const s = xfId(o.st, empty ? (o.t || null) : o.t || (typeof o.v === 'number' ? 'n' : null));
    if (empty) return o.st ? '<c r="' + ref + '" s="' + s + '"/>' : '';
    if (o.t === 'd') return validIso(o.v) ? '<c r="' + ref + '" s="' + s + '"><v>' + (Date.parse(o.v + 'T00:00:00Z') / 864e5 + 25569) + '</v></c>' : '';
    if (typeof o.v === 'number') return '<c r="' + ref + '" s="' + s + '"><v>' + o.v + '</v></c>';
    return '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + xesc(o.v) + '</t></is></c>';
  };
  const refRC = ref => { const m = ref.match(/^([A-Z]+)(\d+)$/); return [colIdx(m[1]), +m[2] - 1]; };
  const sheetXml = sh => {
    const rows = sh.rows.map((row, r) => {
      const ht = sh.heights && sh.heights[r];
      return '<row r="' + (r + 1) + '"' + (ht ? ' ht="' + ht + '" customHeight="1"' : '') + '>' + (row || []).map((c, j) => cellXml(c, colName(j) + (r + 1))).join('') + '</row>';
    }).join('');
    let pane = '';
    if (sh.freeze) {
      const [x, y] = refRC(sh.freeze);
      pane = '<pane' + (x ? ' xSplit="' + x + '"' : '') + (y ? ' ySplit="' + y + '"' : '') + ' topLeftCell="' + sh.freeze + '" activePane="' + (x && y ? 'bottomRight' : y ? 'bottomLeft' : 'topRight') + '" state="frozen"/>';
    }
    const lists = (sh.lists || []).map(l => '<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="' + l.ref + '"><formula1>"' + xesc(l.items.join(',')) + '"</formula1></dataValidation>');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"' + (sh.grid === false ? ' showGridLines="0"' : '') + '>' + pane + '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/><cols>' + sh.cols.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' +
      '<sheetData>' + rows + '</sheetData>' +
      (sh.merges && sh.merges.length ? '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(m => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>' : '') +
      (lists.length ? '<dataValidations count="' + lists.length + '">' + lists.join('') + '</dataValidations>' : '') +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
  };
  const sheetXmls = sheets.map(sheetXml);                    // zuerst die Blätter: dabei entstehen die Formate
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy"/></numFmts>' +
    '<fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts><fills count="' + fills.length + '">' + fills.join('') + '</fills>' +
    '<borders count="' + borders.length + '">' + borders.join('') + '</borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs><cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map((s, i) => '<sheet name="' + xesc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', data: styles },
    ...sheetXmls.map((x, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: x })),
  ];
  return zipBlob(files, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
