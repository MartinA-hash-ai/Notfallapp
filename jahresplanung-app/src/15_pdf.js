/* ===================================================================== PDF-Export: Bereiche wie die Reiter (Jahresplanung, Detailpläne, Auswertung), Maßnahmen wählbar, jede Seite ohne Browser-Kopf-/Fußzeile */

// je Reiter die Teile, die ins PDF können (Schlüssel = Ansicht, damit der offene Reiter vorgewählt ist)
const PDF_AREAS = [
  { k: 'jahr', t: 'Jahresplanung', secs: [['mass', 'Maßnahmen (Tabelle)'], ['kal', 'Kalender'], ['tl', 'Zeitleiste'], ['ag', 'Was steht an?']] },
  { k: 'plaene', t: 'Detailpläne', secs: [['plaene', 'Detailpläne']] },
  { k: 'spenden', t: 'Auswertung', secs: [['sp', 'Übersicht: Kennzahlen aller Maßnahmen'], ['spcmp', 'Rücklauf im Vergleich (Grafik)'], ['spm', 'Kennzahlen und Grafiken']] },
];
const PDF_SUB0 = { mass: true, tl: true, kal: true, ag: false, plaene: true, sp: true, spcmp: true, spm: true };
const SEC_CLOSED0 = new Set(['tl']);                 // anfangs eingeklappte Bereiche (wie in section(..., { open: false }))

// Auswahlliste der Maßnahmen (für PDF- und Kalender-Export)
function msPicker(sel, list, onChange, title) {
  const boxes = [];
  const all = on => { list.forEach(x => on ? sel.add(x.id) : sel.delete(x.id)); boxes.forEach(b => { b.checked = on; }); onChange && onChange(); };
  return h('div', { class: 'mspick' },
    h('div', { class: 'pop-h' }, title || 'Maßnahmen', h('span', null, h('button', { class: 'link', onclick: e => { e.preventDefault(); all(true); } }, 'alle'), ' · ',
      h('button', { class: 'link', onclick: e => { e.preventDefault(); all(false); } }, 'keine'))),
    list.map(x => {
      const b = h('input', { type: 'checkbox', checked: sel.has(x.id), onchange: e => { e.target.checked ? sel.add(x.id) : sel.delete(x.id); onChange && onChange(); } });
      boxes.push(b);
      return h('label', { class: 'mchk' }, b, h('span', { class: 'dot', style: { background: x.color } }), h('span', { class: 'nm' }, x.m.name || '(ohne Namen)'),
        x.pc ? h('span', { class: 'muted small' }, 'Plan') : null, h('span', { class: 'pal' }, x.pal != null ? fmtS(x.pal) : ''));
    }));
}

async function pdfDialog() {
  const y = UI.year, list = C.ms.filter(x => inYear(x, y)), by = spByM(), allg = spAllgX(y);
  const last = UI.pdfOpts || {}, area0 = PDF_AREAS.some(a => a.k === UI.view) ? UI.view : 'jahr';
  const f = {
    area: Object.fromEntries(PDF_AREAS.map(a => [a.k, a.k === area0])),          // Vorauswahl: der Reiter, der gerade offen ist
    sub: Object.fromEntries(Object.keys(PDF_SUB0).map(k => [k, k !== 'plaene' && last.secs && typeof last.secs[k] === 'boolean' ? last.secs[k] : PDF_SUB0[k]])),
    show: Object.assign(Object.fromEntries(evKeys().map(k => [k, true])), last.show), vac: last.vac !== false, verbund: !!UI.verbund,
    ms: new Set(list.map(x => x.id)), spOne: '',
    planCompact: !!UI.planCompact, planColl: null,        // Detailplan wie eingestellt: Tabelle eingeklappt nur, wenn sie es gerade ist
  };
  const subsOf = k => PDF_AREAS.find(a => a.k === k).secs.map(([s]) => s);
  const fillArea = k => { if (!subsOf(k).some(s => f.sub[s])) subsOf(k).forEach(s => { f.sub[s] = PDF_SUB0[s]; }); };
  fillArea(area0);
  const secsNow = () => Object.fromEntries(PDF_AREAS.flatMap(a => a.secs.map(([s]) => [s, !!f.area[a.k] && !!f.sub[s]])));
  const sel = () => list.filter(x => f.ms.has(x.id));
  const plans = () => sel().filter(x => x.pc);
  const hasSp = x => (by.get(x.id) || []).length > 0;
  const cmpIds = () => sel().filter(x => hasSp(x) && x.pal != null).map(x => x.id);
  const spPages = () => f.spOne ? [f.spOne] : [...sel().filter(hasSp).map(x => x.id), ...(hasSp(allg) ? [allg.id] : [])];
  const estimate = () => {
    const s = secsNow(), n = sel().length;
    return (s.mass ? Math.max(1, Math.ceil(n / 20)) : 0) + (s.tl ? Math.max(1, Math.ceil(n / TL_PER_PAGE)) : 0) + (s.kal ? 1 : 0) + (s.ag ? 1 : 0) +
      (s.plaene ? plans().length : 0) + (s.sp ? 1 : 0) + (s.spcmp && cmpIds().length >= 2 ? 1 : 0) + (s.spm ? spPages().length : 0);
  };
  const areasBox = h('div', { class: 'pdf-areas' }), countEl = h('p', { class: 'pdf-count small' });
  const drawAreas = () => {
    const on = k => () => { f.area[k] = true; };
    const cb = (obj, k, label, opts = {}) => h('label', { class: 'check' + (opts.sub ? ' sub' : '') }, h('input', { type: 'checkbox', checked: !!obj[k],
      onchange: e => { obj[k] = e.target.checked; if (e.target.checked && opts.area) on(opts.area)(); drawAreas(); } }), label);
    const pill = (isOn, label, chip, tog) => h('button', { type: 'button', class: 'tpill' + (isOn ? ' on' : ''), 'aria-pressed': String(isOn), tip: (isOn ? 'ausblenden: ' : 'einblenden: ') + label,
      onclick: e => { e.preventDefault(); tog(); drawAreas(); } }, chip, label);
    const body = {
      jahr: () => [h('div', { class: 'checks' }, cb(f.sub, 'mass', 'Maßnahmen (Tabelle)', { area: 'jahr' }),          // Reihenfolge wie im PDF
        cb(f.sub, 'kal', 'Kalender', { area: 'jahr' }), cb(f, 'verbund', 'Verbund-Darstellung', { sub: true, area: 'jahr' }), cb(f.sub, 'tl', 'Zeitleiste', { area: 'jahr' }), cb(f.sub, 'ag', 'Was steht an?', { area: 'jahr' })),
        h('div', { class: 'pdf-lbl' }, 'Termine in Kalender, Zeitleiste und „Was steht an?“'),
        h('div', { class: 'pdf-pills' }, evKeys().map(t => pill(!!f.show[t], phName(t), demoChip(t), () => { f.show[t] = !f.show[t]; })),
          pill(!!f.vac, 'Urlaub', h('span', { class: 'lg vac' }), () => { f.vac = !f.vac; }))],
      plaene: () => [h('p', { class: 'pdf-info' }, plans().length ? 'Je Plan eine Seite – ' + plans().length + (plans().length === 1 ? ' Plan' : ' Pläne') + ' bei den gewählten Maßnahmen.' :
        'Keine der gewählten Maßnahmen hat einen Detailplan.'),
        h('div', { class: 'checks' }, cb(f, 'planCompact', 'nur Arbeitsschritte (Tabelle eingeklappt, Gantt breiter)', { area: 'plaene' }))],
      spenden: () => {
        const opts = [...list.filter(hasSp), ...(hasSp(allg) ? [allg] : [])];
        if (f.spOne && !opts.some(x => x.id === f.spOne)) f.spOne = '';
        return [h('div', { class: 'checks' }, cb(f.sub, 'sp', 'Übersicht: Kennzahlen aller Maßnahmen', { area: 'spenden' }),
          cb(f.sub, 'spcmp', 'Rücklauf im Vergleich (Grafik)', { area: 'spenden' }),
          cmpIds().length < 2 && f.sub.spcmp ? h('span', { class: 'pdf-note' }, 'braucht mindestens zwei Maßnahmen mit Spenden und PAL') : null,
          cb(f.sub, 'spm', 'Kennzahlen und Grafiken je Maßnahme', { area: 'spenden' }),
          h('label', { class: 'pdf-for' }, 'für ', h('select', { onchange: e => { f.spOne = e.target.value; f.sub.spm = true; on('spenden')(); drawAreas(); } },
            h('option', { value: '', selected: !f.spOne }, 'alle gewählten mit Spenden'),
            opts.map(x => h('option', { value: x.id, selected: f.spOne === x.id }, x.m.name || '(ohne Namen)'))))),
          !opts.length ? h('p', { class: 'pdf-note' }, 'Noch keine Spenden zugeordnet – die Übersicht zeigt dann nur Auflage und Kosten.') : null];
      },
    };
    setKids(areasBox, PDF_AREAS.map(a => h('div', { class: 'pdf-area' + (f.area[a.k] ? ' on' : ''), dataset: { area: a.k } },
      h('label', { class: 'pdf-ah' }, h('input', { type: 'checkbox', checked: !!f.area[a.k], onchange: e => { f.area[a.k] = e.target.checked; if (e.target.checked) fillArea(a.k); drawAreas(); } }), a.t),
      h('div', { class: 'pdf-ab' }, body[a.k]()))));
    const n = estimate();
    countEl.textContent = n ? 'Das PDF hat etwa ' + n + (n === 1 ? ' Seite' : ' Seiten') + ' (A4 quer).' : 'Noch nichts gewählt.';
  };
  const wrap = h('div', { class: 'form pdfform' });
  const draw = () => {
    setKids(wrap,
      h('div', { class: 'pdf-top' }, h('p', { class: 'muted small' }, 'Bereiche wählen – jeder Teil beginnt auf einer neuen Seite.'),
        h('button', { class: 'ghostbtn', tip: 'übernimmt Reiter, auf- und zugeklappte Bereiche, Filter und angezeigte Maßnahmen von der Ansicht, die gerade offen ist', onclick: e => { e.preventDefault(); fromView(); draw(); } }, '⟲ Wie aktuelle Ansicht')),
      areasBox, msPicker(f.ms, list, drawAreas, 'Maßnahmen (gelten für alle Bereiche)'), countEl);
    drawAreas();
  };
  const fromView = () => {
    const isOpen = k => UI.secOpen[k] !== undefined ? UI.secOpen[k] : !SEC_CLOSED0.has(k);
    f.area = Object.fromEntries(PDF_AREAS.map(a => [a.k, a.k === area0]));
    if (area0 === 'jahr') ['mass', 'tl', 'kal', 'ag'].forEach(k => { f.sub[k] = isOpen(k); });
    if (area0 === 'spenden') { f.sub.sp = isOpen('sp-ueb'); f.sub.spcmp = isOpen('sp-ueb') && !!UI.spCmp; f.sub.spm = isOpen('sp-m'); f.spOne = f.sub.spm ? UI.spMid || '' : ''; }
    if (!subsOf(area0).some(s => f.sub[s])) f.sub[subsOf(area0)[0]] = true;
    f.show = Object.fromEntries(evKeys().map(k => [k, showType(k)])); f.vac = UI.showVac; f.verbund = !!UI.verbund;
    f.ms = new Set(list.filter(x => area0 === 'spenden' || visibleM(x)).map(x => x.id));          // die Auswertung zeigt immer alle Maßnahmen des Jahres
    if (area0 === 'plaene' && UI.planSel) f.ms = new Set([UI.planSel]);
    f.planCompact = !!UI.planCompact; f.planColl = JSON.parse(JSON.stringify(UI.planColl || {}));   // eingeklappte Tabelle und Abschnitte wie gerade zu sehen
  };
  draw();
  const ok = await modal('PDF exportieren', wrap, [['Abbrechen', false], ['PDF erstellen', true, 'primary']], { wide: true, cls: 'pdfmodal' });
  if (!ok) return;
  const secs = secsNow();
  if (!Object.values(secs).some(Boolean)) { toast('Kein Bereich gewählt.', 'warn'); return; }
  if (!f.ms.size && ['mass', 'kal', 'tl', 'plaene', 'sp', 'spcmp'].some(k => secs[k]) && !(secs.spm && f.spOne)) { toast('Keine Maßnahme gewählt.', 'warn'); return; }
  if (!estimate()) { toast(secs.plaene ? 'Keine der gewählten Maßnahmen hat einen Detailplan.' : 'Für diese Auswahl gibt es nichts zu drucken.', 'warn'); return; }
  UI.pdfOpts = { secs: f.sub, show: f.show, vac: f.vac }; saveUI();
  printPDF({ secs, show: f.show, vac: f.vac, verbund: f.verbund, ms: f.ms, planCompact: f.planCompact, planColl: f.planColl, spOne: f.spOne });
}

const TL_PER_PAGE = 16;
function printPDF(f) {
  const keys = ['show', 'hiddenM', 'showVac', 'hiddenP', 'monthLists', 'tlPlans', 'tlPxd', 'planSel', 'planCompact', 'planColl', 'planPxd', 'view', 'verbund', '_tl', '_pl'];
  const keep = {}; keys.forEach(k => { keep[k] = UI[k] instanceof Set ? new Set(UI[k]) : UI[k] && typeof UI[k] === 'object' ? JSON.parse(JSON.stringify(UI[k])) : UI[k]; });
  UI.show = { ...f.show }; UI.showVac = f.vac; UI.verbund = !!f.verbund; UI.hiddenP = new Set(); UI.monthLists = true; UI.tlPlans = false; UI.tlPxd = 0;
  UI.hiddenM = new Set(C.ms.filter(x => !f.ms.has(x.id)).map(x => x.id));
  UI.planCompact = f.planCompact ?? !!keep.planCompact; UI.planColl = f.planColl || {}; UI.planPxd = 0;
  UI.printing = true;
  derive();
  let doc;
  try { doc = buildPrintDoc(f); }
  finally { Object.assign(UI, keep); UI.printing = false; derive(); }
  $$('#printdoc').forEach(e => e.remove());
  document.body.append(doc);
  document.body.classList.add('printdoc-mode');
  const title = document.title;
  document.title = 'Jahresplanung_' + UI.year + '_' + ds(todayDn());       // Vorschlag für den Dateinamen
  PRINT_TITLE = title;
  setTimeout(() => window.print(), 80);
}
let PRINT_TITLE = null;
window.addEventListener('afterprint', () => {
  $$('#printdoc').forEach(e => e.remove()); document.body.classList.remove('printdoc-mode');
  if (PRINT_TITLE != null) { document.title = PRINT_TITLE; PRINT_TITLE = null; }
});

// Kalender auf eine A4-Seite: Höhe aus festen Zeilenhöhen (Druck-CSS) abschätzen, bei Bedarf verkleinern.
// 210 mm Seite − 2 × 9 mm Rand − schmaler Kopf ≈ 690 px; mit Reserve für andere Schriften/Browser 620 px.
const CAL_FIT = 620;
function fitCalendar(box) {
  const months = $$('.month', box), verbund = !!$('.cal.verbund', box);
  const hMonth = m => {
    const mhol = $('.mhol', m), lines = $$('.mline', m).length + (mhol ? Math.ceil(mhol.textContent.length / 58) : 0);
    return 17 + 11 + 6 * ((verbund ? 22 : 19) + 1) + 8 + 11 * lines;
  };
  let total = 0;
  for (let i = 0; i < months.length; i += 4) total += Math.max(...months.slice(i, i + 4).map(hMonth));
  total += 5 * (Math.ceil(months.length / 4) - 1) + 4;
  if (total > CAL_FIT) box.style.zoom = String(Math.max(0.6, CAL_FIT / total).toFixed(3));
  box.dataset.est = String(total);
}
function buildPrintDoc(f) {
  const y = UI.year;
  const stand = 'Stand ' + fmtD(todayDn()) + (D.meta.savedAt ? ' · gespeichert ' + fmtStamp(D.meta.savedAt) : '');
  const head = title => h('header', { class: 'pd-head' }, h('img', { src: LOGO, alt: 'Malteser' }),
    h('div', null, h('h1', null, title), h('span', null, 'Fundraising · Diözese Paderborn')), h('span', { class: 'pd-stand' }, stand));
  // schmaler Kopf ohne Logo (Kalender: alles muss auf eine Seite)
  const slimHead = title => h('header', { class: 'pd-head slim' }, h('h1', null, title), h('span', { class: 'pd-stand' }, stand));
  // Seitenrahmen: Kopf- und Fußabstand wiederholen sich auf jeder Druckseite
  const frame = (hd, content) => h('section', { class: 'pd-page' }, h('table', { class: 'pd-frame' },
    h('thead', null, h('tr', null, h('td', null, h('div', { class: 'pd-sp' })))),
    h('tbody', null, h('tr', null, h('td', null, hd, content))),
    h('tfoot', null, h('tr', null, h('td', null, h('div', { class: 'pd-sp' }))))));
  const page = (title, ...content) => frame(head(title), content);
  const ms = C.ms.filter(x => f.ms.has(x.id) && inYear(x, y));
  const pages = [];
  if (f.secs.mass) {
    const chipH = t => demoChip(t);
    pages.push(page('Maßnahmen ' + y, h('table', { class: 'pd-table' },
      h('thead', null, h('tr', null, h('th'), h('th', null, 'Maßnahme'), h('th', null, 'Hauptverantwortlich'), h('th', null, 'Auflage'),
        PH().map(p => h('th', null, 'Start ' + p.name + ' ', chipH(p.key))), h('th', null, 'PAL ', chipH('P')), h('th', null, 'PAL-Status'), h('th', null, 'Spendenbitte'), h('th', null, 'Hinweis'))),
      h('tbody', null, ms.map(x => h('tr', null,
        h('td', null, h('span', { class: 'dot', style: { background: x.color } })),
        h('td', { class: 'nm', style: { color: inkC(x.color) } }, x.m.name),
        h('td', null, x.m.verantwortlich || ''), h('td', { class: 'num' }, isNum(x.m.auflage) ? (+x.m.auflage).toLocaleString('de-DE') : ''),
        PH().map(p => h('td', { class: 'st' }, x.st[p.key] != null ? [h('div', null, fmtW(x.st[p.key])), x.pal != null ? h('div', { class: 'wt' }, workdaysBefore(x.st[p.key], x.pal) + ' WT') : null] : '–')),   // oben Datum, darunter Werktage
        h('td', { class: 'pal' + (x.m.palStatus !== 'fest' ? ' vorl' : '') }, fmtW(x.pal)),
        h('td', null, x.m.palStatus), h('td', null, x.m.art || ''), h('td', { class: 'hinweis' }, x.m.hinweis || '')))))));
  }
  if (f.secs.kal) { const cal = h('div', { class: 'pd-kal' }, calendarBody()); fitCalendar(cal); pages.push(frame(slimHead('Kalender ' + y), cal)); }
  // Zeitleiste seitenweise: je Seite höchstens TL_PER_PAGE Maßnahmen, jede Seite mit eigener Monatsleiste, Urlaube auf der letzten
  if (f.secs.tl) {
    const all = C.ms.filter(x => visibleM(x) && inYear(x, y)), n = Math.max(1, Math.ceil(all.length / TL_PER_PAGE));
    for (let i = 0; i < n; i++) {
      const part = all.slice(i * TL_PER_PAGE, (i + 1) * TL_PER_PAGE);
      pages.push(page('Zeitleiste ' + y + (n > 1 ? ' (' + (i + 1) + '/' + n + ')' : ''), timelineSection({ only: new Set(part.map(x => x.id)), rangeRows: all, noVac: i < n - 1 }).body));
    }
  }
  if (f.secs.ag) { const a = agendaSection(); pages.push(page('Was steht an? · ' + (a.summary || ''), a.body)); }
  if (f.secs.plaene) for (const x of ms.filter(x => x.pc)) {
    UI.planSel = x.id;
    const box = h('div', { class: 'pd-plan' });
    VIEW_FN.plaene(box);
    $$('.view-head, .ptabs, .phead .tools, datalist', box).forEach(e => e.remove());
    pages.push(page('Detailplan ' + x.m.name, box));
  }
  if (f.secs.sp || f.secs.spcmp || f.secs.spm) pages.push(...spPrintPages(f, ms, page));
  if (pages.length) pages[pages.length - 1].classList.add('last');
  const doc = h('div', { id: 'printdoc' }, pages);
  for (const el of $$('[data-chart]', doc)) { el.dataset.w = el.dataset.w || String(PD_CHART_W); try { spDraw(el); } catch (e) { console.error(e); } }   // Grafiken der Auswertung in Druckbreite
  return doc;
}

// Auswertung: eine Seite mit der Übersicht (Kennzahlen, Summen, Vergleichsgrafik), dann je Maßnahme eine Seite mit Kacheln und Grafiken
const PD_CHART_W = 1000;                             // px – passt in die A4-Querseite (277 mm ≈ 1047 px) samt Rahmen
function spPrintPages(f, ms, page) {
  const y = UI.year, by = spByM(), R = spRicht(), allg = spAllgX(y), out = [];
  const rows = ms.map(x => ({ x, s: spStats(x.m, by.get(x.id)) })), ga = spStats(allg.m, by.get(allg.id));
  const rt = (v, [lo, hi]) => v == null || !R.an ? '' : v < lo ? 'below' : v > hi ? 'above' : 'within';
  const td = (v, cls) => h('td', { class: 'num' + (cls ? ' ' + cls : '') }, v);
  const top = [];
  if (f.secs.sp) {
    const real = rows.filter(r => r.s.n);
    const tot = real.reduce((t, r) => ({ n: t.n + r.s.n, sum: t.sum + r.s.sum, auf: t.auf + (r.s.auf || 0), kos: t.kos + (r.s.kos || 0) }), { n: 0, sum: 0, auf: 0, kos: 0 });
    const row = ({ x, s }, cls) => h('tr', { class: cls || null },
      h('td', null, h('span', { class: 'dot', style: { background: x.color } })), h('td', { class: 'nm', style: { color: x.allg ? null : inkC(x.color) } }, x.m.name || '(ohne Namen)'),
      h('td', null, x.pal != null ? fmtD(x.pal) : '–'), td(s.auf ? s.auf.toLocaleString('de-DE') + ' Stk.' : '–'), td(s.kos ? eur0(s.kos * 100) : '–'),
      td(s.n ? eur0(s.sum) : '–'), td(s.n || '–'), td(s.avg != null ? eur(s.avg) : '–'),
      td(s.resp != null ? num1(s.resp) + ' %' : '–', rt(s.resp, R.resp)), td(s.roi != null ? num1(s.roi) : '–', rt(s.roi, R.roi)),
      td(s.net != null && s.n ? (s.net < 0 ? '− ' : '') + eur0(Math.abs(s.net)) : '–', s.net != null && s.n ? (s.net < 0 ? 'below' : '') : ''),
      h('td', { class: 'hinweis' }, x.allg ? 'Spenden ohne Maßnahme, z. B. Daueraufträge' : x.m.hinweis || ''));
    top.push(h('table', { class: 'pd-table pd-spt' },
      h('thead', null, h('tr', null, h('th'), h('th', null, 'Maßnahme'), h('th', null, 'PAL'), ['Auflage', 'Kosten', 'Spendensumme', 'Anzahl', 'Ø-Spende', 'Responsequote', 'ROI', 'Erlös'].map(t => h('th', { class: 'num' }, t)), h('th', null, 'Hinweis'))),
      h('tbody', null, rows.map(r => row(r)), ga.n ? row({ x: allg, s: ga }, 'allg') : null),
      tot.n ? h('tfoot', null, h('tr', null, h('td'), h('td', null, 'Summe der Maßnahmen'), h('td'), td(tot.auf ? tot.auf.toLocaleString('de-DE') + ' Stk.' : '–'), td(tot.kos ? eur0(tot.kos * 100) : '–'),
        td(eur0(tot.sum)), td(tot.n), td(eur(tot.sum / tot.n)), td(tot.auf ? num1(tot.n / tot.auf * 100) + ' %' : '–'), td(tot.kos ? num1(tot.sum / 100 / tot.kos) : '–'), td(''), h('td'))) : null),
      h('p', { class: 'pd-note' }, 'Summen ohne „Allgemeine Spenden“; Auflage und Kosten nur von Maßnahmen mit Spenden. ROI = Spendensumme ÷ Kosten, Erlös = Spendensumme − Kosten.' +
        (R.an ? ' Richtwerte: Responsequote ' + num1(R.resp[0]) + '–' + num1(R.resp[1]) + ' %, ROI ' + num1(R.roi[0]) + '–' + num1(R.roi[1]) + ' (grün = erreicht, orange = darunter).' : '')));
  }
  const ids = rows.filter(r => r.s.n && r.x.pal != null).map(r => r.x.id);
  if (top.length) out.push(page('Auswertung ' + y, top));
  if (f.secs.spcmp && ids.length >= 2) out.push(page('Rücklauf im Vergleich ' + y, h('div', { class: 'pd-cmp' },          // eigene Seite – passt unter einer langen Tabelle nicht mehr hin
    h('div', { class: 'sp-cht' }, h('b', null, 'Spendensumme kumuliert'), h('span', { class: 'muted' }, ' · Tage nach dem PAL der jeweiligen Maßnahme')),
    h('div', { class: 'sp-chart', dataset: { chart: 'cmp', ids: ids.join(','), h: '440' } }),
    h('div', { class: 'pd-legend' }, ids.map(id => { const x = C.byId.get(id), s = spStats(x.m, by.get(id));
      return h('span', null, h('span', { class: 'dot', style: { background: x.color } }), (x.m.name || '(ohne Namen)') + ' · ' + eur0(s.sum)); })))));
  if (f.secs.spm) {
    const xs = f.spOne ? [spX(f.spOne)].filter(Boolean) : [...rows.filter(r => r.s.n).map(r => r.x), ...(ga.n ? [allg] : [])];
    for (const x of xs) {
      const list = by.get(x.id) || [], s = spStats(x.m, list), m = x.m;
      const meta = x.allg ? ['Spenden ohne Maßnahme, z. B. Daueraufträge'] : [x.pal != null ? 'PAL ' + fmtD(x.pal) : 'ohne PAL', s.auf ? 'Auflage ' + s.auf.toLocaleString('de-DE') + ' Stk.' : null,
        s.kos ? 'Kosten ' + eur0(s.kos * 100) : null, m.art || null, m.hinweis ? 'Hinweis: ' + m.hinweis : null].filter(Boolean);
      out.push(page('Auswertung · ' + (m.name || '(ohne Namen)'), h('div', { class: 'pd-spm' }, h('p', { class: 'pd-meta' }, meta.join(' · ')), spTiles(x, s), spCharts(x, list))));
    }
  }
  return out;
}
