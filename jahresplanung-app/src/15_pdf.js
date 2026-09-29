/* ===================================================================== PDF-Export: Bereiche und Maßnahmen wählbar, jede Seite ohne Browser-Kopf-/Fußzeile */

const PDF_SECS = [['mass', 'Maßnahmen-Übersicht'], ['kal', 'Kalender'], ['tl', 'Zeitleiste'], ['ag', 'Was steht an?'], ['plaene', 'Detailpläne (je Plan eine Seite)'], ['urlaub', 'Urlaub & Feiertage']];
const VIEW_SECS = { jahr: ['mass', 'kal'], zeit: ['tl', 'ag'], plaene: ['plaene'], urlaub: ['urlaub'] };

// Auswahlliste der Maßnahmen (für PDF- und Kalender-Export)
function msPicker(sel, list, onChange) {
  const boxes = [];
  const all = on => { list.forEach(x => on ? sel.add(x.id) : sel.delete(x.id)); boxes.forEach(b => { b.checked = on; }); onChange && onChange(); };
  return h('div', { class: 'mspick' },
    h('div', { class: 'pop-h' }, 'Maßnahmen', h('span', null, h('button', { class: 'link', onclick: e => { e.preventDefault(); all(true); } }, 'alle'), ' · ',
      h('button', { class: 'link', onclick: e => { e.preventDefault(); all(false); } }, 'keine'))),
    list.map(x => {
      const b = h('input', { type: 'checkbox', checked: sel.has(x.id), onchange: e => { e.target.checked ? sel.add(x.id) : sel.delete(x.id); onChange && onChange(); } });
      boxes.push(b);
      return h('label', { class: 'mchk' }, b, h('span', { class: 'dot', style: { background: x.color } }), h('span', { class: 'nm' }, x.m.name || '(ohne Namen)'),
        x.pc ? h('span', { class: 'muted small' }, 'Plan') : null, h('span', { class: 'pal' }, x.pal != null ? fmtS(x.pal) : ''));
    }));
}

async function pdfDialog() {
  const y = UI.year, list = C.ms.filter(x => inYear(x, y));
  const last = UI.pdfOpts || {};
  const f = {
    secs: Object.assign({ mass: true, kal: true, tl: true, ag: false, plaene: false, urlaub: false }, last.secs),
    show: Object.assign(Object.fromEntries(evKeys().map(k => [k, true])), last.show), vac: last.vac !== false, verbund: !!UI.verbund,
    ms: new Set(list.map(x => x.id)),
  };
  const wrap = h('div', { class: 'form pdfform' });
  const draw = () => {
    const cb = (obj, k, label, extra) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!obj[k], onchange: e => { obj[k] = e.target.checked; } }), label, extra || null);
    setKids(wrap, 
      h('div', { class: 'pdf-top' }, h('p', { class: 'muted small' }, 'Wähle, was ins PDF soll. Jeder Bereich beginnt auf einer neuen Seite (A4 quer).'),
        h('button', { class: 'ghostbtn', tip: 'übernimmt Reiter, Filter und angezeigte Maßnahmen von der Ansicht, die gerade offen ist', onclick: e => { e.preventDefault(); fromView(); draw(); } }, '⟲ Wie aktuelle Ansicht')),
      h('div', { class: 'pdf-cols' },
        h('div', null, h('h3', null, 'Bereiche'), h('div', { class: 'checks' }, PDF_SECS.map(([k, l]) => cb(f.secs, k, l))),
          h('h3', null, 'Termine'), h('div', { class: 'checks' }, evKeys().map(t => cb(f.show, t, TYPE_LABEL[t])), cb(f, 'vac', 'Urlaube anzeigen'),
            cb(f, 'verbund', 'Verbund-Darstellung im Kalender'))),
        msPicker(f.ms, list)));
  };
  const fromView = () => {
    f.secs = Object.fromEntries(PDF_SECS.map(([k]) => [k, (VIEW_SECS[UI.view] || []).includes(k) && (UI.secOpen[k] !== false)]));
    if (!Object.values(f.secs).some(Boolean)) f.secs.mass = true;
    f.show = Object.fromEntries(evKeys().map(k => [k, showType(k)])); f.vac = UI.showVac; f.verbund = !!UI.verbund;
    f.ms = new Set(list.filter(x => visibleM(x)).map(x => x.id));
    if (UI.view === 'plaene' && UI.planSel) { f.ms = new Set([UI.planSel]); f.secs.plaene = true; }
  };
  draw();
  const ok = await modal('PDF exportieren', wrap, [['Abbrechen', false], ['PDF erstellen', true, 'primary']], { wide: true });
  if (!ok) return;
  if (!Object.values(f.secs).some(Boolean)) { toast('Kein Bereich gewählt.', 'warn'); return; }
  if (!f.ms.size && (f.secs.mass || f.secs.kal || f.secs.tl || f.secs.plaene)) { toast('Keine Maßnahme gewählt.', 'warn'); return; }
  UI.pdfOpts = { secs: f.secs, show: f.show, vac: f.vac }; saveUI();
  printPDF(f);
}

const TL_PER_PAGE = 16;
function printPDF(f) {
  const keys = ['show', 'hiddenM', 'showVac', 'hiddenP', 'monthLists', 'tlPlans', 'tlPxd', 'planSel', 'planCompact', 'planColl', 'planPxd', 'view', 'verbund', '_tl', '_pl'];
  const keep = {}; keys.forEach(k => { keep[k] = UI[k] instanceof Set ? new Set(UI[k]) : UI[k] && typeof UI[k] === 'object' ? JSON.parse(JSON.stringify(UI[k])) : UI[k]; });
  UI.show = { ...f.show }; UI.showVac = f.vac; UI.verbund = !!f.verbund; UI.hiddenP = new Set(); UI.monthLists = true; UI.tlPlans = false; UI.tlPxd = 0;
  UI.hiddenM = new Set(C.ms.filter(x => !f.ms.has(x.id)).map(x => x.id));
  UI.planCompact = true; UI.planColl = {}; UI.planPxd = 0;
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

function buildPrintDoc(f) {
  const y = UI.year;
  const stand = 'Stand ' + fmtD(todayDn()) + (D.meta.savedAt ? ' · gespeichert ' + fmtStamp(D.meta.savedAt) : '');
  const head = title => h('header', { class: 'pd-head' }, h('img', { src: LOGO, alt: 'Malteser' }),
    h('div', null, h('h1', null, title), h('span', null, 'Fundraising · Diözese Paderborn')), h('span', { class: 'pd-stand' }, stand));
  // Seitenrahmen: Kopf- und Fußabstand wiederholen sich auf jeder Druckseite
  const page = (title, ...content) => h('section', { class: 'pd-page' }, h('table', { class: 'pd-frame' },
    h('thead', null, h('tr', null, h('td', null, h('div', { class: 'pd-sp' })))),
    h('tbody', null, h('tr', null, h('td', null, head(title), content))),
    h('tfoot', null, h('tr', null, h('td', null, h('div', { class: 'pd-sp' }))))));
  const ms = C.ms.filter(x => f.ms.has(x.id) && inYear(x, y));
  const pages = [];
  if (f.secs.mass) {
    const chipH = t => h('span', { class: 'chip demo ' + (t === 'P' ? 'P' : 'ph') }, t);
    pages.push(page('Maßnahmen ' + y, h('table', { class: 'pd-table' },
      h('thead', null, h('tr', null, h('th'), h('th', null, 'Maßnahme'), h('th', null, 'Hauptverantwortlich'), h('th', null, 'Auflage'),
        PH().map(p => h('th', null, 'Start ' + p.name + ' ', chipH(p.key))), h('th', null, 'PAL ', chipH('P')), h('th', null, 'PAL-Status'), h('th', null, 'Bitte'), h('th', null, 'Hinweis'))),
      h('tbody', null, ms.map(x => h('tr', null,
        h('td', null, h('span', { class: 'dot', style: { background: x.color } })),
        h('td', { class: 'nm', style: { color: inkC(x.color) } }, x.m.name),
        h('td', null, x.m.verantwortlich || ''), h('td', { class: 'num' }, isNum(x.m.auflage) ? (+x.m.auflage).toLocaleString('de-DE') : ''),
        PH().map(p => h('td', null, x.st[p.key] != null ? fmtW(x.st[p.key]) + (x.pal != null ? ' · ' + workdaysBefore(x.st[p.key], x.pal) + ' WT' : '') : '–')), h('td', { class: 'pal' + (x.m.palStatus !== 'fest' ? ' vorl' : '') }, fmtW(x.pal)),
        h('td', null, x.m.palStatus), h('td', null, x.m.art || ''), h('td', { class: 'hinweis' }, x.m.hinweis || '')))))));
  }
  if (f.secs.kal) pages.push(page('Kalender ' + y, calendarBody()));
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
  if (f.secs.urlaub) {
    const box = h('div', { class: 'pd-urlaub' });
    VIEW_FN.urlaub(box);
    $$('.view-head, datalist, .addline, button, .screen-only', box).forEach(e => e.remove());
    pages.push(page('Urlaub & Feiertage ' + y, box));
  }
  if (pages.length) pages[pages.length - 1].classList.add('last');
  return h('div', { id: 'printdoc' }, pages);
}
