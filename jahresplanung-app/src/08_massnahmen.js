/* ===================================================================== Ansicht: Maßnahmen (Tabelle) und Bearbeiten-Dialog */

const ART = ['', 'aktiv', 'passiv', 'nein'];
function nextColor(y) {
  const used = new Set(C.ms.filter(x => inYear(x, y)).map(x => String(x.color).toLowerCase()));
  return (PALETTE.find(p => !used.has(p[1].toLowerCase())) || PALETTE[C.ms.length % PALETTE.length])[1];
}
function colorPicker(anchor, current, onPick) {
  closeMenu();
  const m = h('div', { class: 'menu colors', role: 'dialog', onclick: e => e.stopPropagation() },
    h('div', { class: 'sw-grid' }, PALETTE.map(([name, c]) => h('button', { class: 'sw' + (c.toLowerCase() === String(current).toLowerCase() ? ' on' : ''), style: { background: c }, tip: name, 'aria-label': name,
      onclick: () => { closeMenu(); onPick(c); } }))),
    h('label', { class: 'custom' }, 'Eigene Farbe: ', h('input', { type: 'color', value: current || '#1F77B4', onchange: e => { closeMenu(); onPick(e.target.value); } })));
  const r = anchor.getBoundingClientRect();
  m.style.top = (r.bottom + 4) + 'px'; m.style.left = Math.min(r.left, innerWidth - 240) + 'px';
  document.body.append(m);
  _openMenu = { m, btn: anchor };
}
function personList() {
  return h('datalist', { id: 'dl-personen' }, D.personen.map(p => h('option', { value: p.name })));
}
function setM(id, field, value, msg) { commit(d => { const m = findM(d, id); if (m) m[field] = value; }, msg); }
const numOrNull = v => v === '' || v == null ? null : Math.round(+v);

function addMassnahme(y) {
  const id = uid();
  commit(d => d.massnahmen.push({ id, name: 'Neue Maßnahme', farbe: nextColor(y), verantwortlich: '', auflage: null, pal: null, palStatus: 'vorläufig',
    vorlaufS: d.settings.vorlaufS, vorlaufI: d.settings.vorlaufI, art: '', hinweis: '', plan: null }), 'Maßnahme angelegt – bitte PAL eintragen');
  UI.flash = 'm:' + id; UI.focusFk = 'm:' + id + ':name';
}
async function deleteMassnahme(id) {
  const x = C.byId.get(id);
  if (!await confirmBox('Maßnahme löschen', `„${x.m.name}“ ${x.m.plan ? 'samt Detailplan ' : ''}löschen? (Strg+Z macht es rückgängig.)`, 'Löschen')) return;
  commit(d => { d.massnahmen = d.massnahmen.filter(m => m.id !== id); }, 'Gelöscht');
}
function duplicateMassnahme(id) {
  const nid = uid();
  commit(d => { const m = findM(d, id), c = JSON.parse(JSON.stringify(m)); c.id = nid; c.name = m.name + ' (Kopie)'; c.farbe = nextColor(UI.year); d.massnahmen.push(c); }, 'Kopie angelegt');
  UI.flash = 'm:' + nid;
}
async function copyToNextYear() {
  const y = UI.year, list = C.ms.filter(x => x.pal != null && ymd(x.pal)[0] === y);
  if (!list.length) { toast('Keine Maßnahmen mit PAL in ' + y); return; }
  const exists = C.ms.filter(x => x.pal != null && ymd(x.pal)[0] === y + 1).length;
  let mode = 'weekday';
  const ok = await modal('Maßnahmen ins Folgejahr kopieren', h('div', { class: 'form' },
    h('p', null, `${list.length} Maßnahmen mit PAL in ${y} werden für ${y + 1} angelegt (PAL vorläufig, Detailpläne mit 0 % Fortschritt).`),
    exists ? h('p', { class: 'warn' }, `Achtung: In ${y + 1} gibt es bereits ${exists} Maßnahmen.`) : null,
    h('label', { class: 'check' }, h('input', { type: 'radio', name: 'cm', checked: true, onchange: () => { mode = 'weekday'; } }), 'gleicher Wochentag (PAL + 52 Wochen) – empfohlen für Briefkasten-Termine'),
    h('label', { class: 'check' }, h('input', { type: 'radio', name: 'cm', onchange: () => { mode = 'date'; } }), 'gleiches Datum')),
    [['Abbrechen', false], ['Kopieren', true, 'primary']]);
  if (!ok) return;
  commit(d => {
    for (const x of list) {
      const c = JSON.parse(JSON.stringify(findM(d, x.id)));
      const [yy, mm, dd] = ymd(x.pal);
      let np = mode === 'weekday' ? x.pal + 364 : mkdn(yy + 1, mm, Math.min(dd, daysIn(yy + 1, mm)));
      if (mode === 'weekday' && ymd(np)[0] === y && ymd(np + 7)[0] === y + 1) np += 7;
      c.id = uid(); c.pal = ds(np); c.palStatus = 'vorläufig';
      c.hinweis = ('aus ' + y + ' übernommen (PAL ' + fmtD(x.pal) + ')' + (c.hinweis ? ' · ' + c.hinweis : '')).slice(0, 300);
      if (c.plan) c.plan.steps.forEach(s => { s.fortschritt = 0; if (s.anker && s.anker.art === 'fest' && s.anker.datum) s.anker.datum = ds(dn(s.anker.datum) + (np - x.pal)); });
      d.massnahmen.push(c);
    }
  }, list.length + ' Maßnahmen nach ' + (y + 1) + ' kopiert');
  UI.year = y + 1;
  renderNow();
}

/* ---------- Tabelle */
VIEW_FN.massnahmen = main => {
  const y = UI.year;
  const rows = C.ms.filter(x => UI.allYears || x.pal == null || ymd(x.pal)[0] === y);
  const warnBy = new Map();
  C.warnings.forEach(w => { if (w.mid) warnBy.set(w.mid, (warnBy.get(w.mid) || []).concat(w)); });
  const tb = h('tbody');
  for (const x of rows) {
    const m = x.m, id = x.id, fk = f => 'm:' + id + ':' + f;
    const ws = warnBy.get(id) || [];
    const dateCell = (n, warnList) => h('td', { class: 'calc' + (n != null && ymd(n)[0] !== y ? ' other' : '') },
      h('span', null, fmtW(n)), warnList.length ? h('span', { class: 'wi', tip: warnList.join('\n') }, '⚠') : null);
    const resp = (m.verantwortlich || '').trim();
    tb.append(h('tr', { dataset: { m: id, flash: 'm:' + id } },
      h('td', { class: 'col' }, h('button', { class: 'swatch', style: { background: x.color }, tip: 'Farbe ändern', 'aria-label': 'Farbe ändern', onclick: e => { e.stopPropagation(); colorPicker(e.currentTarget, x.color, c => setM(id, 'farbe', c)); } })),
      h('td', { class: 'name' }, h('input', { value: m.name, 'data-fk': fk('name'), style: { color: mix(x.color, 0.1, '#000000') }, onchange: e => setM(id, 'name', e.target.value.trim()) })),
      h('td', null, h('input', { value: m.verantwortlich || '', list: 'dl-personen', 'data-fk': fk('resp'), placeholder: '–', onchange: e => setM(id, 'verantwortlich', e.target.value.trim()) })),
      h('td', { class: 'num' }, h('input', { type: 'number', min: 0, value: m.auflage ?? '', 'data-fk': fk('auflage'), placeholder: '–', onchange: e => setM(id, 'auflage', numOrNull(e.target.value)) })),
      dateCell(x.s, x.s != null ? dateWarn(x.s, resp) : []),
      h('td', { class: 'num' }, m.plan ? h('span', { class: 'derived', tip: 'aus dem Detailplan berechnet' }, x.vS ?? '–') :
        h('input', { type: 'number', min: 0, value: m.vorlaufS ?? '', 'data-fk': fk('vs'), onchange: e => setM(id, 'vorlaufS', numOrNull(e.target.value)) })),
      dateCell(x.i, x.i != null ? dateWarn(x.i, resp) : []),
      h('td', { class: 'num' }, m.plan ? h('span', { class: 'derived', tip: 'aus dem Detailplan berechnet' }, x.vI ?? '–') :
        h('input', { type: 'number', min: 0, value: m.vorlaufI ?? '', 'data-fk': fk('vi'), onchange: e => setM(id, 'vorlaufI', numOrNull(e.target.value)) })),
      h('td', { class: 'pal' + (m.palStatus !== 'fest' ? ' vorl' : '') },
        dateInput(m.pal, fk('pal'), v => setM(id, 'pal', v || null)),
        h('span', { class: 'wdn' }, x.pal != null ? WD[wd(x.pal)] : '')),
      h('td', null, h('button', { class: 'status ' + (m.palStatus === 'fest' ? 'fest' : 'vorl'), 'data-fk': fk('status'), tip: 'Klicken zum Umschalten',
        onclick: () => setM(id, 'palStatus', m.palStatus === 'fest' ? 'vorläufig' : 'fest') }, m.palStatus === 'fest' ? 'fest' : 'vorläufig')),
      h('td', null, h('select', { 'data-fk': fk('art'), onchange: e => setM(id, 'art', e.target.value) }, ART.map(a => h('option', { value: a, selected: (m.art || '') === a }, a || '–')))),
      h('td', { class: 'hinweis' }, h('input', { value: m.hinweis || '', 'data-fk': fk('hinweis'), placeholder: '–', onchange: e => setM(id, 'hinweis', e.target.value) })),
      h('td', { class: 'plan' }, m.plan ? h('button', { class: 'pill', onclick: () => { UI.view = 'plaene'; UI.planSel = id; renderNow(); } }, 'Detailplan ›') :
        h('button', { class: 'pill ghost', tip: 'Arbeitsschritte mit Gantt anlegen', onclick: () => createPlan(id) }, '+ Plan')),
      h('td', { class: 'warns' }, ws.length ? h('span', { class: 'wi ' + (ws.some(w => w.lvl === 'warn') ? 'warn' : 'info'), tip: () => h('div', null, ws.map(w => h('div', null, (w.lvl === 'warn' ? '⚠ ' : 'ℹ ') + w.text))) }, ws.length) : null),
      h('td', { class: 'acts' }, menuButton('⋯', [['Bearbeiten …', () => editMassnahme(id)], ['Duplizieren', () => duplicateMassnahme(id)], ['Löschen', () => deleteMassnahme(id)]], 'right'))));
  }
  const head = ['', 'Maßnahme', 'Verantwortlich', 'Auflage', 'Start Selektion', 'Vorlauf S', 'Start inhaltl. Arbeit', 'Vorlauf I', 'PAL', 'Status', 'Art der Bitte', 'Hinweis', 'Detailplan', '', ''];
  put(main, 
    h('div', { class: 'view-head' },
      h('h1', null, 'Maßnahmen ' + (UI.allYears ? '(alle Jahre)' : y)),
      h('div', { class: 'tools' },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: UI.allYears, onchange: e => { UI.allYears = e.target.checked; renderNow(); } }), 'alle Jahre'),
        h('button', { onclick: copyToNextYear }, 'Ins Folgejahr kopieren …'),
        h('button', { class: 'primary', onclick: () => addMassnahme(y) }, '+ Maßnahme'))),
    h('p', { class: 'muted hint' }, 'Sortiert automatisch nach PAL. Start Selektion = PAL − Vorlauf Selektion, Start inhaltliche Arbeit = PAL − Vorlauf Inhalt (Kalendertage). Bei Maßnahmen mit Detailplan kommen die Vorläufe aus den Arbeitsschritten.'),
    personList(),
    h('div', { class: 'tablewrap' }, h('table', { class: 'grid mtable' },
      h('thead', null, h('tr', null, head.map((t, i) => h('th', { class: ['col', 'name', '', 'num', 'calc', 'num', 'calc', 'num', 'pal', '', '', 'hinweis', 'plan', 'warns', 'acts'][i] || '' }, t)))), tb)),
    !rows.length ? h('div', { class: 'empty' }, 'Noch keine Maßnahmen in ' + y + '. ', h('button', { class: 'link', onclick: () => addMassnahme(y) }, 'Maßnahme anlegen'),
      C.ms.some(x => x.pal != null && ymd(x.pal)[0] === y - 1) ? [' oder ', h('button', { class: 'link', onclick: () => { UI.year = y - 1; copyToNextYear(); } }, 'aus ' + (y - 1) + ' kopieren')] : null) : null);
};
VIEW_FN['massnahmen:after'] = () => {
  if (UI.focusFk) { const e = $('[data-fk="' + CSS.escape(UI.focusFk) + '"]'); if (e) { e.focus(); e.select && e.select(); } UI.focusFk = null; }
};

/* ---------- Bearbeiten-Dialog (aus Kalender und Zeitleiste) */
async function editMassnahme(id) {
  const x = C.byId.get(id); if (!x) return;
  const m = JSON.parse(JSON.stringify(x.m));
  const row = (label, inp, hint) => h('label', { class: 'frow' }, h('span', null, label), inp, hint ? h('small', null, hint) : null);
  const sw = h('button', { class: 'swatch big', style: { background: m.farbe }, onclick: e => { e.preventDefault(); e.stopPropagation(); colorPicker(sw, m.farbe, c => { m.farbe = c; sw.style.background = c; }); } });
  const calc = h('div', { class: 'calcline' });
  const upd = () => {
    const pal = dn(m.pal);
    if (m.plan) { const pc = planCalc(m); calc.textContent = 'Start Selektion ' + fmtW(pc.s) + ' · Start Inhalt ' + fmtW(pc.i) + ' (aus Detailplan)'; return; }
    const s = pal != null && isNum(m.vorlaufS) ? pal - m.vorlaufS : null, i = pal != null && isNum(m.vorlaufI) ? pal - m.vorlaufI : null;
    calc.textContent = 'Start Selektion ' + fmtW(s) + ' · Start inhaltliche Arbeit ' + fmtW(i);
  };
  upd();
  const body = h('div', { class: 'form' }, personList(),
    row('Maßnahme', h('input', { value: m.name, oninput: e => { m.name = e.target.value; } })),
    h('div', { class: 'frow' }, h('span', null, 'Farbe'), sw),
    row('PAL (Briefkasten-Termin)', h('div', { class: 'inl' }, h('input', { type: 'date', value: m.pal || '', oninput: e => { m.pal = e.target.value || null; upd(); } }),
      h('select', { onchange: e => { m.palStatus = e.target.value; } }, ['vorläufig', 'fest'].map(v => h('option', { value: v, selected: m.palStatus === v }, 'PAL ' + v))))),
    m.plan ? null : row('Vorlauf Selektion / Inhalt (Tage)', h('div', { class: 'inl' },
      h('input', { type: 'number', min: 0, value: m.vorlaufS ?? '', oninput: e => { m.vorlaufS = numOrNull(e.target.value); upd(); } }),
      h('input', { type: 'number', min: 0, value: m.vorlaufI ?? '', oninput: e => { m.vorlaufI = numOrNull(e.target.value); upd(); } }))),
    calc,
    row('Verantwortlich', h('input', { value: m.verantwortlich || '', list: 'dl-personen', oninput: e => { m.verantwortlich = e.target.value.trim(); } }), 'Urlaub dieser Person wird bei den Terminen geprüft'),
    row('Auflage', h('input', { type: 'number', min: 0, value: m.auflage ?? '', oninput: e => { m.auflage = numOrNull(e.target.value); } })),
    row('Art der Zuwendungs-/Zuweisungsbitte', h('select', { onchange: e => { m.art = e.target.value; } }, ART.map(a => h('option', { value: a, selected: (m.art || '') === a }, a || '–')))),
    row('Hinweis', h('textarea', { rows: 2, oninput: e => { m.hinweis = e.target.value; } }, m.hinweis || '')));
  const res = await modal('Maßnahme bearbeiten', body, [['Löschen', 'del', 'danger left'], ['Abbrechen', false], ['Übernehmen', true, 'primary']]);
  if (res === 'del') return deleteMassnahme(id);
  if (res !== true) return;
  commit(d => { const i = d.massnahmen.findIndex(q => q.id === id); if (i >= 0) d.massnahmen[i] = m; }, 'Änderung übernommen');
}
