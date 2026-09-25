/* ===================================================================== Excel: Schreiber (ohne Bibliothek) und die Ansichts-Excel */

const xesc = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = i => { let s = ''; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
const argb = hex => 'FF' + String(hex).replace('#', '').toUpperCase().padStart(6, '0');

/* Zelle: Wert oder { v, t: 'd' | 'dw' | 'ds', st: { b, i, sz, color, fill, h, v, wrap, border } }
   Blatt: { name, cols: [Breiten], rows: [[Zellen]], merges: ['A1:H1'], heights: { Zeile: pt }, freeze: 'C5',
            filter: 'A4:K20', protect: true, grid: false, landscape: true } */
function xlsxBlob(sheets, wb = {}) {
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
      const c = kind === 'dark' ? 'FF7F7F7F' : 'FFD9D9D9', side = t => '<' + t + ' style="thin"><color rgb="' + c + '"/></' + t + '>';
      idx.border.set(kind, borders.length); borders.push('<border>' + side('left') + side('right') + side('top') + side('bottom') + '<diagonal/></border>');
    }
    return idx.border.get(kind);
  };
  const NUM = { d: 164, dw: 165, ds: 166 };
  const xfId = (st, t) => {
    st = st || {};
    const k = JSON.stringify([st.b, st.i, st.sz, st.color, st.fill, st.h, st.v, st.wrap, st.border, t || '']);
    if (!idx.xf.has(k)) {
      const al = st.h || st.v || st.wrap ? '<alignment' + (st.h ? ' horizontal="' + st.h + '"' : '') + (st.v ? ' vertical="' + st.v + '"' : '') + (st.wrap ? ' wrapText="1"' : '') + '/>' : '';
      const nf = NUM[t] || 0;
      idx.xf.set(k, xfs.length);
      xfs.push('<xf numFmtId="' + nf + '" fontId="' + fontId(st) + '" fillId="' + fillId(st.fill) + '" borderId="' + borderId(st.border) + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"' + (al ? ' applyAlignment="1">' + al + '</xf>' : '/>'));
    }
    return idx.xf.get(k);
  };
  xfId({});                                                             // Standardformat = 0
  const cellXml = (c, ref) => {
    if (c == null || c === '') return '';
    const o = typeof c === 'object' ? c : { v: c };
    const s = xfId(o.st, o.v == null || o.v === '' ? null : o.t);
    if (o.v == null || o.v === '') return o.st ? '<c r="' + ref + '" s="' + s + '"/>' : '';
    if (o.t === 'd' || o.t === 'dw' || o.t === 'ds') return '<c r="' + ref + '" s="' + s + '"><v>' + (o.v + 25569) + '</v></c>';
    if (typeof o.v === 'number') return '<c r="' + ref + '" s="' + s + '"><v>' + o.v + '</v></c>';
    return '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + xesc(o.v) + '</t></is></c>';
  };
  const refRC = ref => { const m = ref.match(/^([A-Z]+)(\d+)$/); let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return [c - 1, +m[2] - 1]; };
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
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<sheetViews><sheetView workbookViewId="0"' + (sh.grid === false ? ' showGridLines="0"' : '') + '>' + pane + '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="14"/><cols>' + sh.cols.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' +
      '<sheetData>' + rows + '</sheetData>' +
      (sh.protect ? '<sheetProtection sheet="1" objects="1" scenarios="1" formatColumns="0" formatRows="0" autoFilter="0" sort="0"/>' : '') +
      (sh.filter ? '<autoFilter ref="' + sh.filter + '"/>' : '') +
      (sh.merges && sh.merges.length ? '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(m => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>' : '') +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="' + (sh.landscape === false ? 'portrait' : 'landscape') + '" fitToWidth="1" fitToHeight="' + (sh.onePage ? 1 : 0) + '"/></worksheet>';
  };
  const sheetXmls = sheets.map(sheetXml);
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="3"><numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy"/><numFmt numFmtId="165" formatCode="[$-407]ddd\\ dd\\.mm\\.yyyy"/><numFmt numFmtId="166" formatCode="[$-407]ddd\\ dd\\.mm\\."/></numFmts>' +
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
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      (wb.readOnly ? '<fileSharing readOnlyRecommended="1"/>' : '') + '<sheets>' +
      sheets.map((s, i) => '<sheet name="' + xesc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets>' +
      (sheets.some(s => s.filter) ? '<definedNames>' + sheets.map((s, i) => s.filter ? '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + xesc(s.name) + '\'!' + s.filter.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2') + '</definedName>' : '').join('') + '</definedNames>' : '') + '</workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', data: styles },
    ...sheetXmls.map((x, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: x })),
  ];
  return zipBlob(files, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/* ---------- Ansichts-Excel: gleicher Stand wie im Programm, zum Anschauen (auch in Teams) */
const XS = {
  head: { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true },
  title: { b: true, sz: 15 },
  note: { i: true, sz: 9, color: '#6B6B6B' },
  sub: { b: true, sz: 11 },
};
const XD = (n, t = 'dw', st) => n == null ? '' : { v: n, t, st };
const darker = c => mix(c, 0.15, '#000000');

function viewWorkbook(opts = {}) {
  const y = UI.year, a = mkdn(y, 1, 1), b = mkdn(y, 12, 31), protect = opts.protect !== false;
  const stand = D.meta.savedAt ? 'Stand: gespeichert ' + fmtStamp(D.meta.savedAt) + (D.meta.savedBy ? ' von ' + D.meta.savedBy : '') : 'Stand: ' + fmtD(todayDn());
  const hint = protect ? 'Nur zur Ansicht – bearbeitet wird im Programm („Jahresplanung starten“). Änderungen hier werden beim nächsten Speichern überschrieben. ' + stand : stand;
  const ms = C.ms.filter(x => (x.pal != null && ymd(x.pal)[0] === y) || inYear(x, y));
  const warnBy = new Map();
  C.warnings.forEach(w => { if (w.mid) warnBy.set(w.mid, (warnBy.get(w.mid) || []).concat(w.text.replace(/^[^:]+: /, ''))); });
  const sheets = [];

  // 1. Übersicht
  {
    const rows = [[{ v: 'Jahresplanung Außenkommunikation ' + y, st: XS.title }], [{ v: hint, st: XS.note }], [],
      ['', 'Maßnahme', 'Start Selektion', 'Start inhaltliche Arbeit', 'PAL', 'PAL-Status', 'Verantwortlich', 'Art der Bitte', 'Auflage', 'Hinweis', 'Bitte prüfen'].map(t => ({ v: t, st: XS.head }))];
    for (const x of ms) {
      const bd = { border: 'thin', v: 'top' };
      rows.push([{ v: '', st: { fill: x.color, border: 'thin' } }, { v: x.m.name, st: { ...bd, b: true, color: darker(x.color) } },
        XD(x.s, 'dw', bd), XD(x.i, 'dw', bd), XD(x.pal, 'dw', { ...bd, b: true }), { v: x.m.palStatus, st: bd }, { v: x.m.verantwortlich || '', st: bd },
        { v: x.m.art || '', st: bd }, isNum(x.m.auflage) ? { v: +x.m.auflage, st: bd } : { v: '', st: bd }, { v: x.m.hinweis || '', st: { ...bd, wrap: true } },
        { v: (warnBy.get(x.id) || []).join('; '), st: { ...bd, wrap: true, color: '#B45309' } }]);
    }
    sheets.push({ name: 'Übersicht', cols: [2.5, 30, 15, 17, 15, 11, 15, 12, 9, 40, 55], rows, merges: ['A1:K1', 'A2:K2'], heights: { 0: 22, 3: 30 },
      freeze: 'C5', filter: ms.length ? 'A4:K' + (4 + ms.length) : null, protect, grid: false });
  }

  // 2. Kalender: 12 Monate wie im Programm (S/I/P farbig)
  {
    const rows = [], merges = [], heights = {}, CW = 9, cols = [];
    for (let k = 0; k < 4; k++) cols.push(3.2, 5.4, 5.4, 5.4, 5.4, 5.4, 5.4, 5.4, 1.4);
    const set = (r, c, v) => { (rows[r] = rows[r] || [])[c] = v; };
    set(0, 0, { v: 'Jahresplanung Außenkommunikation ' + y + ' – Kalender', st: XS.title }); merges.push('A1:AI1'); heights[0] = 22;
    set(1, 0, { v: hint, st: XS.note }); merges.push('A2:AI2');
    set(2, 0, { v: 'P = PAL (kräftige Farbe der Maßnahme) · S = Start Selektion · I = Start inhaltliche Arbeit (Pastellton) · hellgrau = Wochenende · dunkelgrau = Feiertag NRW', st: { sz: 9, color: '#404040' } }); merges.push('A3:AI3');
    const evAll = eventsIn(a, b, true), byDay = new Map();
    evAll.forEach(e => { if (!byDay.has(e.n)) byDay.set(e.n, []); byDay.get(e.n).push(e); });
    let r = 4;
    for (let band = 0; band < 3; band++) {
      const lists = [];
      for (let k = 0; k < 4; k++) {
        const mo = band * 4 + k + 1, c0 = k * CW, first = mkdn(y, mo, 1), last = first + daysIn(y, mo) - 1, start = first - wd(first);
        set(r, c0, { v: MON[mo - 1] + ' ' + y, st: { b: true, sz: 11, color: '#FFFFFF', fill: '#404040', v: 'center' } });
        for (let j = 1; j < 8; j++) set(r, c0 + j, { v: '', st: { fill: '#404040' } });
        merges.push(colName(c0) + (r + 1) + ':' + colName(c0 + 7) + (r + 1));
        set(r + 1, c0, { v: 'KW', st: { sz: 7, color: '#999999', h: 'center' } });
        WD.forEach((d, j) => set(r + 1, c0 + 1 + j, { v: d, st: { sz: 8, b: true, color: j >= 5 ? '#999999' : '#595959', h: 'center' } }));
        for (let w = 0; w < 6; w++) {
          const ws = start + 7 * w;
          set(r + 2 + w, c0, ws <= last ? { v: isoWeek(ws), st: { sz: 7, color: '#AAAAAA', h: 'center', v: 'top' } } : '');
          for (let d = 0; d < 7; d++) {
            const n = ws + d;
            if (n < first || n > last) { set(r + 2 + w, c0 + 1 + d, { v: '', st: { fill: '#FAFAFA', border: 'thin' } }); continue; }
            const evs = byDay.get(n) || [], hn = holName(n);
            const st = { h: 'center', v: 'top', wrap: true, sz: 9, border: 'thin' };
            const p = evs.find(e => e.t === 'P'), f = p || evs[0];
            if (f) Object.assign(st, f.t === 'P' ? { fill: f.x.color, color: onColor(f.x.color), b: true } : { fill: pastel(f.x.color), color: darker(f.x.color), b: true });
            else if (hn) Object.assign(st, { fill: '#CFCFCF', b: true, color: '#262626' });
            else if (d >= 5) Object.assign(st, { fill: '#EDEDED', color: '#808080' });
            set(r + 2 + w, c0 + 1 + d, { v: ymd(n)[2] + (evs.length ? '\n' + evs.map(e => e.t).join(' ') : ''), st });
          }
        }
        // Terminliste unter dem Monat
        const lines = [], per = new Map();
        const hols = []; for (let n = first; n <= last; n++) { const hn = holName(n); if (hn) hols.push(fmtS(n) + ' ' + hn); }
        if (hols.length) lines.push({ v: hols.join(' · '), st: { sz: 8, color: '#8C8C8C' } });
        for (let n = first; n <= last; n++) for (const e of byDay.get(n) || []) { if (!per.has(e.x.id)) per.set(e.x.id, { x: e.x, ev: [] }); per.get(e.x.id).ev.push(e); }
        for (const { x, ev } of per.values()) lines.push({ v: x.m.name + ':  ' + ev.map(e => e.t + ' ' + fmtS(e.n)).join(' · '), st: { sz: 8, b: true, color: darker(x.color) } });
        const vm = C.vac.filter(v => v.bis >= first && v.von <= last);
        if (vm.length) lines.push({ v: 'Urlaub: ' + vm.map(v => (v.u.wer || '?') + ' ' + fmtS(Math.max(v.von, first)) + (v.bis > v.von ? '–' + fmtS(Math.min(v.bis, last)) : '')).join(', '), st: { sz: 8, color: '#8A6D00' } });
        lists.push(lines);
      }
      heights[r] = 17;
      for (let w = 0; w < 6; w++) heights[r + 2 + w] = 27;
      const L = Math.max(1, ...lists.map(l => l.length));
      for (let k = 0; k < 4; k++) {
        const c0 = k * CW;
        for (let li = 0; li < L; li++) {
          const rr = r + 8 + li, cell = lists[k][li];
          if (cell && cell.v.length > 62) { cell.st = { ...cell.st, wrap: true, v: 'top' }; heights[rr] = 22; }
          set(rr, c0, cell || '');
          merges.push(colName(c0) + (rr + 1) + ':' + colName(c0 + 7) + (rr + 1));
        }
      }
      for (let li = 0; li < L; li++) heights[r + 8 + li] = heights[r + 8 + li] || 12;
      r += 8 + L + 1;
    }
    sheets.push({ name: 'Kalender', cols, rows, merges, heights, protect, grid: false, onePage: true });
  }

  // 3. Zeitleiste nach Kalenderwochen
  {
    const weeks = []; for (let n = a - wd(a); n <= b; n += 7) weeks.push(n);
    const rows = [], merges = [], heights = { 0: 22, 3: 13 }, W0 = 2;
    rows.push([{ v: 'Jahresplanung Außenkommunikation ' + y + ' – Zeitleiste nach Kalenderwochen', st: XS.title }]);
    rows.push([{ v: hint, st: XS.note }]);
    merges.push('A1:' + colName(W0 + weeks.length - 1) + '1', 'A2:' + colName(W0 + weeks.length - 1) + '2');
    const mRow = [{ v: '', st: {} }, ''], kRow = [{ v: 'Maßnahme', st: { b: true, sz: 9 } }, { v: 'PAL', st: { b: true, sz: 9 } }];
    let prevM = null, mStart = W0;
    weeks.forEach((n, j) => {
      const mo = ymd(n + 3)[1];
      if (mo !== prevM) {
        if (prevM != null && j + W0 - 1 > mStart) merges.push(colName(mStart) + '3:' + colName(j + W0 - 1) + '3');
        const span = weeks.slice(j).findIndex(q => ymd(q + 3)[1] !== mo);
        mRow[j + W0] = { v: span === 1 ? '' : MON[mo - 1], st: { b: true, sz: 9, fill: '#F2F2F2', border: 'thin' } };
        prevM = mo; mStart = j + W0;
      } else mRow[j + W0] = { v: '', st: { fill: '#F2F2F2', border: 'thin' } };
      kRow[j + W0] = { v: isoWeek(n), st: { sz: 7, color: '#808080', h: 'center' } };
    });
    if (weeks.length + W0 - 1 > mStart) merges.push(colName(mStart) + '3:' + colName(weeks.length + W0 - 1) + '3');
    rows.push(mRow, kRow);
    for (const x of ms) {
      const row = [{ v: x.m.name, st: { b: true, color: darker(x.color), border: 'thin' } }, XD(x.pal, 'ds', { sz: 9, border: 'thin' })];
      weeks.forEach((n, j) => {
        const e = n + 6, has = v => v != null && v >= n && v <= e;
        const st = { sz: 7, h: 'center', v: 'center', border: 'thin', b: true };
        let v = '';
        const selEnd = x.i != null ? x.i : x.pal;
        if (has(x.pal)) { Object.assign(st, { fill: x.color, color: onColor(x.color) }); v = 'P'; }
        else if (x.i != null && x.pal != null && x.i <= e && x.pal >= n) { Object.assign(st, { fill: midtone(x.color), color: darker(x.color) }); v = has(x.i) ? 'I' : ''; }
        else if (x.s != null && selEnd != null && x.s <= e && selEnd > n) { Object.assign(st, { fill: pastel(x.color), color: darker(x.color) }); v = has(x.s) ? 'S' : ''; }
        row[j + W0] = { v, st };
      });
      rows.push(row);
    }
    rows.push([]);
    const people = [...new Set(C.vac.filter(v => v.bis >= a && v.von <= b).map(v => v.u.wer || '?'))].sort((p, q) => p.localeCompare(q, 'de'));
    if (people.length) {
      rows.push([{ v: 'Urlaub (Arbeitstage je Woche)', st: XS.sub }]);
      for (const p of people) {
        const row = [{ v: p, st: { border: 'thin' } }, ''];
        weeks.forEach((n, j) => {
          const cnt = C.vac.filter(v => (v.u.wer || '?') === p).reduce((s, v) => s + (v.bis >= n && v.von <= n + 6 ? workdays(Math.max(v.von, n), Math.min(v.bis, n + 6)) : 0), 0);
          row[j + W0] = cnt ? { v: cnt, st: { sz: 7, h: 'center', border: 'thin', fill: pastel(personColor(p)) } } : { v: '', st: { border: 'thin' } };
        });
        rows.push(row);
      }
      const row = [{ v: 'gleichzeitig im Urlaub', st: { i: true, sz: 9, border: 'thin' } }, ''];
      weeks.forEach((n, j) => {
        const cnt = people.filter(p => C.vac.some(v => (v.u.wer || '?') === p && v.bis >= n && v.von <= n + 6 && workdays(Math.max(v.von, n), Math.min(v.bis, n + 6)) > 0)).length;
        row[j + W0] = cnt > 1 ? { v: cnt, st: { sz: 7, b: true, h: 'center', border: 'thin', fill: cnt > 2 ? '#F4B6B0' : '#FFD8A8' } } : { v: '', st: { border: 'thin' } };
      });
      rows.push(row, []);
    }
    const max = +D.settings.maxStarts || 2, lrow = [{ v: 'Starts je Woche (S + I)', st: { b: true, sz: 9, border: 'thin' } }, ''];
    weeks.forEach((n, j) => {
      const cnt = C.ms.reduce((s, x) => s + [x.s, x.i].filter(v => v != null && v >= n && v <= n + 6).length, 0);
      lrow[j + W0] = cnt ? { v: cnt, st: { sz: 7, b: true, h: 'center', border: 'thin', fill: cnt > max ? '#F4B6B0' : '#E7EAEE' } } : { v: '', st: { border: 'thin' } };
    });
    rows.push(lrow);
    sheets.push({ name: 'Zeitleiste', cols: [30, 11, ...weeks.map(() => 2.9)], rows, merges, heights, freeze: 'C5', protect, grid: false });
  }

  // 4. Termine (chronologisch)
  {
    const ev = eventsIn(a, b, true);
    const rows = [['Datum', 'KW', 'Maßnahme', 'Termin', 'Verantwortlich', 'Hinweis'].map(t => ({ v: t, st: XS.head })),
      ...ev.map(e => {
        const notes = [];
        const hn = holName(e.n); if (hn) notes.push('Feiertag: ' + hn); else if (wd(e.n) >= 5) notes.push(WDL[wd(e.n)]);
        const away = vacOn(e.n); if (away.length) notes.push('Urlaub: ' + [...new Set(away.map(v => v.u.wer))].join(', '));
        return [XD(e.n), isoWeek(e.n), { v: e.x.m.name, st: e.t === 'P' ? { fill: e.x.color, color: onColor(e.x.color), b: true } : { fill: pastel(e.x.color), color: darker(e.x.color) } },
          TYPE_LABEL[e.t], e.x.m.verantwortlich || '', notes.join(' · ')];
      })];
    sheets.push({ name: 'Termine', cols: [16, 5, 30, 24, 16, 50], rows, freeze: 'A2', filter: rows.length > 1 ? 'A1:F' + rows.length : null, protect });
  }

  // 5. Detailpläne
  {
    const rows = [['Maßnahme', 'Abschnitt', 'Arbeitsschritt', 'Typ', 'Zugeordnet', 'Kommentar', 'Start', 'Dauer (Tage)', 'Ende', 'Fortschritt (%)'].map(t => ({ v: t, st: XS.head }))];
    for (const x of ms) if (x.pc) {
      let grp = '';
      for (const s of x.m.plan.steps) {
        if (s.typ === 'gruppe') { grp = s.name; continue; }
        const r = x.pc.map.get(s.id) || {};
        rows.push([{ v: x.m.name, st: { color: darker(x.color), b: true } }, grp, s.name, STEP_TYPES[s.typ], s.wer || '', s.kommentar || '', XD(r.start), s.typ === 'aufgabe' ? +s.dauer || 0 : '', XD(r.end), s.typ === 'aufgabe' ? +s.fortschritt || 0 : '']);
      }
    }
    sheets.push({ name: 'Detailpläne', cols: [24, 22, 28, 12, 14, 24, 16, 10, 16, 12], rows, freeze: 'A2', filter: rows.length > 1 ? 'A1:J' + rows.length : null, protect });
  }

  // 6. Urlaub und Feiertage
  {
    const rows = [['Wer', 'Von', 'Bis', 'Arbeitstage', 'Notiz'].map(t => ({ v: t, st: XS.head })),
      ...C.vac.filter(v => v.bis >= a && v.von <= b).sort((p, q) => p.von - q.von)
        .map(v => [{ v: v.u.wer || '?', st: { fill: pastel(personColor(v.u.wer)) } }, XD(v.von), XD(v.bis), workdays(v.von, v.bis), v.u.notiz || ''])];
    rows.push([], [{ v: 'Feiertage NRW ' + y, st: XS.sub }]);
    const hols = [...holidaysNRW(y)].concat(D.sondertage.filter(s => dn(s.datum) != null && ymd(dn(s.datum))[0] === y).map(s => [dn(s.datum), (s.name || 'freier Tag') + ' (eigener freier Tag)']))
      .sort((p, q) => p[0] - q[0]);
    hols.forEach(([n, t]) => rows.push([XD(n), { v: t, st: {} }]));
    sheets.push({ name: 'Urlaub & Feiertage', cols: [18, 16, 16, 12, 30], rows, freeze: 'A2', protect });
  }
  return xlsxBlob(sheets, { readOnly: protect });
}
function exportExcel() {
  download('Jahresplanung_' + UI.year + '_Export_' + ds(todayDn()) + '.xlsx', viewWorkbook({ protect: false }));
  toast('Excel-Datei erstellt', 'ok');
}
