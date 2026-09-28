/* ===================================================================== PDF-Jahresübersicht: Seite 1 Maßnahmen, Seite 2 Kalender, Seite 3 Zeitleiste */

function printYearPDF() {
  const keep = { show: { ...UI.show }, hiddenM: new Set(UI.hiddenM), showVac: UI.showVac, hiddenP: new Set(UI.hiddenP), monthLists: UI.monthLists, tlPlans: UI.tlPlans, tlPxd: UI.tlPxd };
  // in der PDF immer alles zeigen
  UI.show = { S: true, I: true, P: true }; UI.hiddenM = new Set(); UI.showVac = true; UI.hiddenP = new Set(); UI.monthLists = true; UI.tlPlans = false; UI.tlPxd = 0;
  UI.printing = true;
  derive();
  let doc;
  try { doc = buildPrintDoc(); }
  finally { Object.assign(UI, keep); UI.printing = false; }
  $$('#printdoc').forEach(e => e.remove());
  document.body.append(doc);
  document.body.classList.add('printdoc-mode');
  setTimeout(() => window.print(), 80);
}
window.addEventListener('afterprint', () => { $$('#printdoc').forEach(e => e.remove()); document.body.classList.remove('printdoc-mode'); });

function buildPrintDoc() {
  const y = UI.year;
  const stand = 'Stand ' + fmtD(todayDn()) + (D.meta.savedAt ? ' · zuletzt gespeichert ' + fmtStamp(D.meta.savedAt) + (D.meta.savedBy ? ' von ' + D.meta.savedBy : '') : '');
  const head = title => h('header', { class: 'pd-head' }, h('img', { src: LOGO, alt: 'Malteser' }),
    h('div', null, h('h1', null, title), h('span', null, 'Jahresplanung Außenkommunikation ' + y + ' · Fundraising Diözese Paderborn')), h('span', { class: 'pd-stand' }, stand));
  const ms = C.ms.filter(x => (x.pal != null && ymd(x.pal)[0] === y) || inYear(x, y));
  const chipH = t => h('span', { class: 'chip demo ' + t }, t);
  const table = h('table', { class: 'pd-table' },
    h('thead', null, h('tr', null, h('th'), h('th', null, 'Maßnahme'), h('th', null, 'Hauptverantwortlich'), h('th', null, 'Auflage'),
      h('th', null, chipH('S'), ' Start Selektion'), h('th', null, chipH('I'), ' Start Inhalt'), h('th', null, chipH('P'), ' PAL'), h('th', null, 'Status'), h('th', null, 'Bitte'), h('th', null, 'Hinweis'))),
    h('tbody', null, ms.map(x => h('tr', null,
      h('td', null, h('span', { class: 'dot', style: { background: x.color } })),
      h('td', { class: 'nm', style: { color: mix(x.color, 0.15, '#000000') } }, x.m.name),
      h('td', null, x.m.verantwortlich || ''), h('td', { class: 'num' }, isNum(x.m.auflage) ? (+x.m.auflage).toLocaleString('de-DE') : ''),
      h('td', null, fmtW(x.s)), h('td', null, fmtW(x.i)), h('td', { class: 'pal' }, fmtW(x.pal)),
      h('td', null, x.m.palStatus), h('td', null, x.m.art || ''), h('td', { class: 'hinweis' }, x.m.hinweis || '')))));
  const tl = timelineSection();
  return h('div', { id: 'printdoc' },
    h('section', { class: 'pd-page' }, head('Maßnahmen ' + y), table),
    h('section', { class: 'pd-page' }, head('Kalender ' + y), calendarBody()),
    h('section', { class: 'pd-page last' }, head('Zeitleiste ' + y), tl.body));
}
