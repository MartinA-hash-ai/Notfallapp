/* ===================================================================== Exporte: Excel (.xlsx), Outlook (.ics), Drucken/PDF */

/* ---------- ZIP (ohne Kompression) für .xlsx */
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

/* ---------- minimale Excel-Arbeitsmappe */
const xesc = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = i => { let s = ''; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
function xlsxBlob(sheets) {
  // Stile: 0 Standard, 1 Kopf, 2 Datum, 3 Datum mit Wochentag, 4 Umbruch, ab 5 Farbfelder
  const fills = [], fillIdx = new Map();
  const fillStyle = hex => { hex = String(hex).replace('#', '').toUpperCase(); if (!fillIdx.has(hex)) { fillIdx.set(hex, 5 + fills.length); fills.push(hex); } return fillIdx.get(hex); };
  const rowsXml = sh => sh.rows.map((row, r) => '<row r="' + (r + 1) + '">' + row.map((c, j) => {
    if (c == null || c === '' || (typeof c === 'object' && (c.v == null || c.v === ''))) return '';
    const o = typeof c === 'object' ? c : { v: c };
    const ref = colName(j) + (r + 1);
    let s = r === 0 ? 1 : (o.s || 0);
    if (o.fill) s = fillStyle(o.fill);
    if (o.t === 'd' || o.t === 'dw') return '<c r="' + ref + '" s="' + (o.t === 'dw' ? 3 : 2) + '"><v>' + (o.v + 25569) + '</v></c>';
    if (typeof o.v === 'number') return '<c r="' + ref + '" s="' + s + '"><v>' + o.v + '</v></c>';
    return '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + xesc(o.v) + '</t></is></c>';
  }).join('') + '</row>').join('');
  const sheetXml = sh => {
    const last = colName(sh.cols.length - 1) + Math.max(1, sh.rows.length);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/><cols>' + sh.cols.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' +
      '<sheetData>' + rowsXml(sh) + '</sheetData>' + (sh.rows.length > 1 ? '<autoFilter ref="A1:' + last + '"/>' : '') +
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/></worksheet>';
  };
  const sheetXmls = sheets.map(sheetXml);           // füllt dabei die Farbfelder
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy"/><numFmt numFmtId="165" formatCode="[$-407]ddd\\ dd\\.mm\\.yyyy"/></numFmts>' +
    '<fonts count="3"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts>' +
    '<fills count="' + (3 + fills.length) + '"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF404040"/><bgColor indexed="64"/></patternFill></fill>' +
    fills.map(f => '<fill><patternFill patternType="solid"><fgColor rgb="FF' + f + '"/><bgColor indexed="64"/></patternFill></fill>').join('') + '</fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="' + (5 + fills.length) + '"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    fills.map((f, i) => '<xf numFmtId="0" fontId="' + (onColor('#' + f) === '#ffffff' ? 2 : 0) + '" fillId="' + (3 + i) + '" borderId="0" xfId="0" applyFont="1" applyFill="1"/>').join('') +
    '</cellXfs><cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map((s, i) => '<sheet name="' + xesc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets>' +
      '<definedNames>' + sheets.map((s, i) => s.rows.length > 1 ? '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + xesc(s.name) + '\'!$A$1:$' + colName(s.cols.length - 1) + '$' + s.rows.length + '</definedName>' : '').join('') + '</definedNames></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', data: styles },
    ...sheetXmls.map((x, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: x })),
  ];
  return zipBlob(files, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
const D_ = n => n == null ? null : { v: n, t: 'dw' };

function exportExcel() {
  const y = UI.year, a = mkdn(y, 1, 1), b = mkdn(y, 12, 31);
  const ms = C.ms.filter(x => (x.pal != null && ymd(x.pal)[0] === y) || inYear(x, y));
  const colorName = hex => (PALETTE.find(p => p[1].toLowerCase() === String(hex).toLowerCase()) || [hex])[0];
  const sheets = [];
  sheets.push({ name: 'Maßnahmen ' + y, cols: [30, 12, 16, 10, 16, 10, 16, 10, 16, 11, 12, 40, 10],
    rows: [['Maßnahme', 'Farbe', 'Verantwortlich', 'Auflage', 'Start Selektion', 'Vorlauf Selektion (Tage)', 'Start inhaltliche Arbeit', 'Vorlauf Inhalt (Tage)', 'PAL', 'PAL-Status', 'Art der Bitte', 'Hinweis', 'Detailplan'],
      ...ms.map(x => [x.m.name, { v: colorName(x.color), fill: x.color }, x.m.verantwortlich, isNum(x.m.auflage) ? +x.m.auflage : x.m.auflage, D_(x.s), x.vS, D_(x.i), x.vI, D_(x.pal),
        x.m.palStatus, x.m.art, x.m.hinweis, x.m.plan ? 'ja' : ''])] });
  const ev = eventsIn(a, b, true);
  sheets.push({ name: 'Termine ' + y, cols: [16, 6, 30, 24, 16, 50],
    rows: [['Datum', 'KW', 'Maßnahme', 'Termin', 'Verantwortlich', 'Hinweis'],
      ...ev.map(e => {
        const notes = [];
        const hn = holName(e.n); if (hn) notes.push('Feiertag: ' + hn); else if (wd(e.n) >= 5) notes.push(WDL[wd(e.n)]);
        const away = vacOn(e.n); if (away.length) notes.push('Urlaub: ' + [...new Set(away.map(v => v.u.wer))].join(', '));
        return [D_(e.n), isoWeek(e.n), { v: e.x.m.name, fill: e.t === 'P' ? e.x.color : pastel(e.x.color) }, TYPE_LABEL[e.t], e.x.m.verantwortlich, notes.join(' · ')];
      })] });
  const pr = [['Maßnahme', 'Abschnitt', 'Arbeitsschritt', 'Typ', 'Zugeordnet', 'Kommentar', 'Start', 'Dauer (Tage)', 'Ende', 'Fortschritt (%)']];
  for (const x of ms) if (x.pc) {
    let grp = '';
    for (const s of x.m.plan.steps) {
      if (s.typ === 'gruppe') { grp = s.name; continue; }
      const r = x.pc.map.get(s.id) || {};
      pr.push([x.m.name, grp, s.name, STEP_TYPES[s.typ], s.wer, s.kommentar, D_(r.start), s.typ === 'aufgabe' ? +s.dauer || 0 : null, D_(r.end), +s.fortschritt || 0]);
    }
  }
  sheets.push({ name: 'Detailpläne', cols: [24, 22, 28, 12, 14, 24, 16, 10, 16, 12], rows: pr });
  sheets.push({ name: 'Urlaub', cols: [18, 16, 16, 12, 30],
    rows: [['Wer', 'Von', 'Bis', 'Arbeitstage', 'Notiz'], ...C.vac.filter(v => v.bis >= a && v.von <= b).sort((p, q) => p.von - q.von)
      .map(v => [{ v: v.u.wer, fill: pastel(personColor(v.u.wer)) }, D_(v.von), D_(v.bis), workdays(v.von, v.bis), v.u.notiz])] });
  const hols = [...holidaysNRW(y)].map(([n, t]) => [n, t]).concat(D.sondertage.filter(s => dn(s.datum) != null && ymd(dn(s.datum))[0] === y).map(s => [dn(s.datum), s.name + ' (eigener freier Tag)']))
    .sort((p, q) => p[0] - q[0]);
  sheets.push({ name: 'Feiertage ' + y, cols: [16, 36], rows: [['Datum', 'Feiertag'], ...hols.map(([n, t]) => [D_(n), t])] });
  download('Jahresplanung_' + y + '_Export_' + ds(todayDn()) + '.xlsx', xlsxBlob(sheets));
  toast('Excel-Datei erstellt', 'ok');
}

/* ---------- Outlook / Kalender (.ics) */
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function icsFold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = '', lim = 75;
  for (const ch of line) {
    if (enc.encode(cur + ch).length > lim) { out.push(cur); cur = ch; lim = 74; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const icsDate = n => ds(n).replace(/-/g, '');
function icsEvent(uidv, a, b, summary, desc) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return ['BEGIN:VEVENT', 'UID:' + uidv + '@jahresplanung.local', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + icsDate(a), 'DTEND;VALUE=DATE:' + icsDate(b + 1),
    'SUMMARY:' + icsEsc(summary), desc ? 'DESCRIPTION:' + icsEsc(desc) : null, 'CATEGORIES:Jahresplanung', 'TRANSP:TRANSPARENT',
    'X-MICROSOFT-CDO-BUSYSTATUS:FREE', 'END:VEVENT'].filter(Boolean);
}
async function exportICS() {
  const y = UI.year;
  const o = { S: true, I: true, P: true, onlyVisible: false, steps: true, vac: false };
  const cb = (k, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o[k], onchange: e => { o[k] = e.target.checked; } }), label);
  const ok = await modal('Termine für Outlook exportieren', h('div', { class: 'form' },
    h('p', null, `Erstellt eine Kalenderdatei (.ics) mit den Terminen ${y}. In Outlook: Datei öffnen → „Als neuen Kalender öffnen“ oder importieren.`),
    h('div', { class: 'checks' }, cb('S', 'Start Selektion'), cb('I', 'Start inhaltliche Arbeit'), cb('P', 'PAL (Briefkasten-Termin)'),
      cb('steps', 'Meilensteine und Arbeitsschritte aus Detailplänen'), cb('vac', 'Urlaube'), cb('onlyVisible', 'nur die in der Seitenleiste angezeigten Maßnahmen')),
    h('p', { class: 'muted small' }, 'Hinweis: Wiederholter Import legt die Termine in Outlook ggf. doppelt an. Am übersichtlichsten ist ein eigener Kalender „Jahresplanung“, den du vor einem neuen Import löschst.')),
    [['Abbrechen', false], ['Kalenderdatei erstellen', true, 'primary']]);
  if (!ok) return;
  const a = mkdn(y, 1, 1), b = mkdn(y, 12, 31), L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jahresplanung Aussenkommunikation//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsEsc('Jahresplanung ' + y)];
  let n = 0;
  for (const x of C.ms) {
    if (o.onlyVisible && !visibleM(x)) continue;
    for (const [t, k, lab] of TYPES) {
      if (!o[t] || x[k] == null || x[k] < a || x[k] > b) continue;
      L.push(...icsEvent(x.id + '-' + t + '-' + ds(x[k]), x[k], x[k], (t === 'P' ? 'PAL' : lab) + ' · ' + x.m.name,
        [x.m.name, TYPE_LABEL[t] + ': ' + fmtW(x[k]), x.pal != null && t !== 'P' ? 'PAL: ' + fmtW(x.pal) : '', t === 'P' && x.m.palStatus !== 'fest' ? 'PAL noch vorläufig' : '', x.m.verantwortlich ? 'Verantwortlich: ' + x.m.verantwortlich : '', x.m.hinweis].filter(Boolean).join('\n')));
      n++;
    }
    if (o.steps && x.pc) for (const s of x.m.plan.steps) {
      const r = x.pc.map.get(s.id);
      if (!r || r.start == null || s.typ === 'gruppe' || r.end < a || r.start > b) continue;
      const isPoint = s.typ !== 'aufgabe';
      L.push(...icsEvent(x.id + '-' + s.id + '-' + ds(r.start), r.start, isPoint ? r.start : Math.max(r.start, r.end - 1),
        (isPoint ? '◆ ' : '') + s.name + ' · ' + x.m.name, [s.wer ? 'Zugeordnet: ' + s.wer : '', s.kommentar, isPoint ? '' : 'bis ' + fmtW(r.end)].filter(Boolean).join('\n')));
      n++;
    }
  }
  if (o.vac) for (const v of C.vac) if (v.bis >= a && v.von <= b) { L.push(...icsEvent('u-' + v.u.id, v.von, v.bis, 'Urlaub: ' + (v.u.wer || '?'), v.u.notiz)); n++; }
  L.push('END:VCALENDAR');
  download('Jahresplanung_' + y + '.ics', new Blob([L.map(icsFold).join('\r\n') + '\r\n'], { type: 'text/calendar' }));
  toast(n + ' Termine exportiert', 'ok');
}

/* ---------- Drucken / PDF */
function printView() {
  UI.printing = true; renderNow();
  setTimeout(() => { window.print(); }, 60);
}
window.addEventListener('afterprint', () => { if (UI.printing) { UI.printing = false; renderNow(); } });
