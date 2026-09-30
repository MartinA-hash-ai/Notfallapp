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
  document.body.append(m);
  placeMenu(m, anchor.getBoundingClientRect());
  _openMenu = { m, btn: anchor, at: performance.now() };
}
function personList() {
  return h('datalist', { id: 'dl-personen' }, D.personen.map(p => h('option', { value: p.name })));
}
function setM(id, field, value, msg) { commit(d => { const m = findM(d, id); if (m) m[field] = value; }, msg); }
const numOrNull = v => v === '' || v == null ? null : Math.round(+v);

function addMassnahme(y) {
  const id = uid();
  commit(d => d.massnahmen.push({ id, name: 'Neue Maßnahme', farbe: nextColor(y), verantwortlich: '', auflage: null, pal: null, palStatus: 'vorläufig',
    vorlauf: Object.fromEntries(d.settings.bereiche.filter(p => isNum(p.vorlauf)).map(p => [p.key, p.vorlauf])), ende: {}, art: '', hinweis: '', plan: null }), 'Maßnahme angelegt – bitte PAL eintragen');
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

/* ---------- Tabelle: je Bereich eine Spalte „Start …“ (als Datum oder als Werktage bis zum PAL), dann das PAL */
const wtView = () => UI.startView === 'wt';
const mcols = () => [
  { k: 'vis', w: 28, fixed: true }, { k: 'col', w: 30, fixed: true }, { k: 'name', w: 180, t: 'Maßnahme' }, { k: 'resp', w: 150, t: 'Hauptverantwortlich' },
  { k: 'auflage', w: 68, t: 'Auflage' },
  ...PH().map(p => ({ k: 'ph_' + p.key, w: wtView() ? 112 : 136, t: p.name, tip: 'Start ' + p.name + (wtView() ? ' – Werktage bis zum PAL' : ''), chip: p.key, phase: p.key })),
  { k: 'pal', w: 136, t: 'PAL', chip: 'P' },
  { k: 'status', w: 84, t: 'PAL-Status' }, { k: 'art', w: 66, t: 'Bitte' }, { k: 'hinweis', w: 0, t: 'Hinweis', flex: 140 }, { k: 'plan', w: 64, t: 'Plan' },
  { k: 'warns', w: 34, fixed: true }, { k: 'acts', w: 34, fixed: true }];
const colKey = c => c.phase ? c.k + (wtView() ? ':wt' : '') : c.k;
const colW = c => c.flex ? 0 : (UI.colW && UI.colW[colKey(c)]) || c.w;   // Hinweis nimmt immer den Rest
function tableWidth() { return mcols().reduce((s, c) => s + (colW(c) || c.flex || 0), 0); }
// Kopfzeile der Bereiche: „Start der“ / „Selektion“ in zwei Zeilen (eigene Bereiche: „Start“ / Name)
const PH_HEAD = { Selektion: ['Start der', 'Selektion'], Inhalt: ['Start des', 'Inhalts'], Produktion: ['Start der', 'Produktion'] };
const phHead = p => wtView() ? ['Zeit bis PAL für', p.name] : PH_HEAD[p.name] || ['Start', p.name];   // Werktage-Ansicht: „Zeit bis PAL für“ / „Selektion“
// Schalter über den Spalten der Bereiche: links Datum, rechts Werktage bis zum PAL
function viewSwitch() {
  const on = wtView(), set = v => { UI.startView = v; saveUI(); renderNow(); };
  return h('div', { class: 'vswitch' + (on ? ' on' : ''), tip: 'Starts der Bereiche als Datum oder als Werktage bis zum PAL anzeigen (das PAL bleibt ein Datum)' },
    h('button', { class: 'vs-lab' + (on ? '' : ' act'), onclick: () => set('date') }, 'Datum'),
    h('button', { class: 'vs-track', role: 'switch', 'aria-checked': String(on), 'aria-label': 'zwischen Datum und Werktagen umschalten', onclick: () => set(on ? 'date' : 'wt') }, h('span', { class: 'vs-knob' })),
    h('button', { class: 'vs-lab' + (on ? ' act' : ''), onclick: () => set('wt') }, 'Werktage'));
}
// Spaltenbreite ziehen: nur diese Spalte und ihre rechte Nachbarin ändern sich, alle anderen bleiben stehen.
// Die Breiten werden im Browser gespeichert und gelten auch nach Neustart und Programm-Update.
function colResize(ev, c) {
  ev.preventDefault(); ev.stopPropagation();
  const COLS = mcols(), table = ev.currentTarget.closest('table'), cols = $$('col', table), i = COLS.findIndex(q => q.k === c.k);
  const ths = $$('thead tr:last-child th', table), widths = ths.map(t => Math.round(t.getBoundingClientRect().width));
  let j = i + 1; while (j < COLS.length && COLS[j].fixed) j++;
  if (j >= COLS.length) j = -1;
  const minOf = k => COLS[k].flex || 40;
  const keep = JSON.parse(JSON.stringify(UI.colW || {})), x0 = ev.clientX, w0 = widths[i], wn0 = j >= 0 ? widths[j] : 0, total = widths.reduce((a, b) => a + b, 0);
  widths.forEach((w, k) => { cols[k].style.width = w + 'px'; });   // Stand einfrieren – so verrutscht beim Ziehen nichts
  table.style.width = total + 'px';
  document.body.classList.add('dragging', 'resizing');
  let dx = 0;
  const move = e => {
    dx = Math.round(e.clientX - x0);
    dx = Math.max(minOf(i) - w0, j >= 0 ? Math.min(dx, Math.max(0, wn0 - minOf(j))) : dx);
    cols[i].style.width = (w0 + dx) + 'px';
    if (j >= 0) cols[j].style.width = (wn0 - dx) + 'px'; else table.style.width = (total + dx) + 'px';
  };
  dragSession(ev, ev.currentTarget, move, okay => {
    document.body.classList.remove('dragging', 'resizing');
    if (!okay || !dx) {                                                 // abgebrochen oder nur geklickt: alte Breiten zurück
      UI.colW = keep; COLS.forEach((q, k) => { cols[k].style.width = colW(q) ? colW(q) + 'px' : ''; });
      table.style.width = 'max(100%, ' + tableWidth() + 'px)'; return;
    }
    const nw = Object.assign({}, UI.colW);
    COLS.forEach((q, k) => { if (q.flex) delete nw[colKey(q)]; else if (!q.fixed) nw[colKey(q)] = Math.round(parseFloat(cols[k].style.width)); });
    UI.colW = nw; saveUI(); renderNow();
  });
}
function setStartDate(id, key, v) {
  const x = C.byId.get(id); if (!x || x.pal == null) return;
  if (v === '' || v == null) {                           // Feld geleert: dieser Bereich entfällt bei der Maßnahme
    commit(d => { const m = findM(d, id); if (m && m.vorlauf) { m.vorlauf = Object.assign({}, m.vorlauf); delete m.vorlauf[key]; } }, x.m.name + ': ' + startLabel(key) + ' entfernt');
    return;
  }
  const n = dn(v); if (n == null) return;
  moveStartTo(id, key, n);
}
function setStartWT(id, key, v) {
  const x = C.byId.get(id); if (!x || x.pal == null) return;
  if (v === '') return setStartDate(id, key, '');
  const w = Math.round(+v);
  if (!(w >= 0 && w <= 400)) { toast('Bitte 0 bis 400 Werktage eingeben.', 'warn'); renderNow(); return; }
  moveStartTo(id, key, dateForWT(x.pal, w));
}
function massnahmenSection() {
  const y = UI.year;
  const rows = C.ms.filter(x => UI.allYears || x.pal == null || ymd(x.pal)[0] === y);
  const warnBy = new Map();
  C.warnings.forEach(w => { if (w.mid) warnBy.set(w.mid, (warnBy.get(w.mid) || []).concat(w)); });
  const tb = h('tbody');
  for (const x of rows) {
    const m = x.m, id = x.id, fk = f => 'm:' + id + ':' + f;
    const ws = warnBy.get(id) || [], resp = (m.verantwortlich || '').trim();
    const startCell = key => {
      const n = x.st[key];
      // Hinweise: Wochenende/Feiertag/Urlaub am Start, dazu Urlaub von Personen, die im Detailplan in diesem Bereich eingetragen sind
      const w = n != null ? dateWarn(n, resp) : [], pv = phaseVacations(x, key);
      const lines = w.concat(pv.map(({ s, v }) => s.wer + ': Urlaub ' + fmtS(v.von) + '–' + fmtS(v.bis) + ' („' + s.name + '“)'));
      const warnIcon = lines.length ? h('span', { class: 'wi' + (pv.length ? ' vac' : ''), tip: (pv.length ? 'Urlaub im Bereich ' + phName(key) + ':\n' : '') + lines.join('\n') }, pv.length ? '🏖' : '⚠') : null;
      const tipDate = n != null ? startLabel(key) + ': ' + fmtW(n) + (x.pal != null ? ' · ' + workdaysBefore(n, x.pal) + ' Werktage vor PAL' : '') + (x.enx[key] != null ? ' · bis ' + fmtW(x.en[key]) : '') : null;
      const pi = PH().findIndex(q => q.key === key), cellCls = 'date ph' + (wtView() ? ' wt' : '') + (pi === 0 ? ' ph-first' : '') + (pi === PH().length - 1 ? ' ph-last' : '');
      if (m.plan && !startMovable(x, key)) return h('td', { class: cellCls + ' derived-date', tip: 'Im Detailplan gehört noch kein Abschnitt zum Bereich „' + phName(key) + '“' }, h('span', { class: 'muted' }, '–'));
      if (x.pal == null) return h('td', { class: cellCls }, h('span', { class: 'muted small', tip: 'erst PAL eintragen' }, '–'), warnIcon);
      const inp = wtView()
        ? h('span', { class: 'wtbox', tip: tipDate }, h('input', { type: 'number', class: 'nospin', min: 0, max: 400, value: n != null ? workdaysBefore(n, x.pal) : '', placeholder: '–', 'data-fk': fk(key + ':wt'), onwheel: wheelStep,
            onchange: e => setStartWT(id, key, e.target.value) }), h('span', { class: 'unit' }, 'WT'))
        : dateInput(n != null ? ds(n) : '', fk(key), v => setStartDate(id, key, v), { title: tipDate || '' });
      return h('td', { class: cellCls, tip: m.plan ? 'Start ändern – die Arbeitsschritte im Detailplan passen sich an' : null }, inp, warnIcon);
    };
    tb.append(h('tr', { dataset: { m: id, flash: 'm:' + id }, class: visibleM(x) ? '' : 'hidden-m', onmouseenter: () => highlight(id), onmouseleave: () => highlight(null) },
      h('td', { class: 'vis' }, h('input', { type: 'checkbox', checked: visibleM(x), tip: 'im Kalender und in der Zeitleiste anzeigen', 'aria-label': 'anzeigen',
        onchange: e => { e.target.checked ? UI.hiddenM.delete(id) : UI.hiddenM.add(id); renderNow(); } })),
      h('td', { class: 'col' }, h('button', { class: 'swatch', style: { background: x.color }, tip: 'Farbe ändern', 'aria-label': 'Farbe ändern', onclick: e => { e.stopPropagation(); colorPicker(e.currentTarget, x.color, c => setM(id, 'farbe', c)); } })),
      h('td', { class: 'name' }, h('input', { value: m.name, title: m.name, 'data-fk': fk('name'), style: { color: inkC(x.color) }, onchange: e => setM(id, 'name', e.target.value.trim()) })),
      h('td', { class: 'resp' }, h('input', { value: m.verantwortlich || '', list: 'dl-personen', 'data-fk': fk('resp'), placeholder: '–', onchange: e => setM(id, 'verantwortlich', e.target.value.trim()) })),
      h('td', { class: 'num' }, h('input', { type: 'number', min: 0, value: m.auflage ?? '', 'data-fk': fk('auflage'), placeholder: '–', onchange: e => setM(id, 'auflage', numOrNull(e.target.value)) })),
      PH().map(p => startCell(p.key)),
      h('td', { class: 'date pal' + (m.palStatus !== 'fest' ? ' vorl' : '') }, dateInput(m.pal, fk('pal'), v => setM(id, 'pal', v || null))),
      h('td', null, h('button', { class: 'status ' + (m.palStatus === 'fest' ? 'fest' : 'vorl'), 'data-fk': fk('status'), tip: 'Klicken zum Umschalten',
        onclick: () => setM(id, 'palStatus', m.palStatus === 'fest' ? 'vorläufig' : 'fest') }, m.palStatus === 'fest' ? 'fest' : 'vorläufig')),
      h('td', { class: 'art' }, h('select', { 'data-fk': fk('art'), onchange: e => setM(id, 'art', e.target.value) }, ART.map(a => h('option', { value: a, selected: (m.art || '') === a }, a || '–')))),
      h('td', { class: 'hinweis' }, h('input', { value: m.hinweis || '', title: m.hinweis || '', 'data-fk': fk('hinweis'), placeholder: '–', onchange: e => setM(id, 'hinweis', e.target.value) })),
      h('td', { class: 'plan' }, m.plan ? h('button', { class: 'pill', tip: 'Detailplan öffnen', onclick: () => { UI.view = 'plaene'; UI.planSel = id; renderNow(); } }, 'Plan ›') :
        h('button', { class: 'pill ghost', tip: 'Arbeitsschritte mit Gantt anlegen', onclick: () => createPlan(id) }, '+ Plan')),
      h('td', { class: 'warns' }, ws.length ? h('span', { class: 'wi ' + (ws.some(w => w.lvl === 'warn') ? 'warn' : 'info'), tip: () => h('div', null, ws.map(w => h('div', null, (w.lvl === 'warn' ? '⚠ ' : 'ℹ ') + w.text))) }, ws.length) : null),
      h('td', { class: 'acts' }, menuButton('⋯', [['Bearbeiten …', () => editMassnahme(id)], ['Duplizieren', () => duplicateMassnahme(id)], ['Löschen', () => deleteMassnahme(id)]], 'right'))));
  }
  const nWarn = C.warnings.filter(w => w.mid && rows.some(x => x.id === w.mid) && w.lvl === 'warn').length;
  const COLS = mcols();
  const phs = PH(), nBefore = COLS.findIndex(c => c.phase), nAfter = COLS.length - nBefore - phs.length;
  const ths = COLS.map(c => h('th', { class: 'h-' + c.k + (c.phase ? ' h-ph' + (c.phase === phs[0].key ? ' ph-first' : '') + (c.phase === phs[phs.length - 1].key ? ' ph-last' : '') : ''), tip: c.tip || null },
    c.k === 'vis' ? h('input', { type: 'checkbox', checked: rows.every(visibleM), 'aria-label': 'alle anzeigen', tip: 'Häkchen = im Kalender und in der Zeitleiste anzeigen',
      onchange: e => { rows.forEach(x => e.target.checked ? UI.hiddenM.delete(x.id) : UI.hiddenM.add(x.id)); renderNow(); } }) :
    c.phase ? [h('span', { class: 'th2' }, h('small', null, phHead(phase(c.phase))[0]), h('span', null, phHead(phase(c.phase))[1], demoChip(c.chip))),
      h('span', { class: 'col-rs', tip: 'Spaltenbreite ziehen (Doppelklick: zurücksetzen)', onpointerdown: e => colResize(e, c), ondblclick: () => { if (UI.colW) delete UI.colW[colKey(c)]; saveUI(); renderNow(); } })] :
    [c.t || '', c.chip ? demoChip(c.chip) : null,
     c.fixed ? null : h('span', { class: 'col-rs', tip: 'Spaltenbreite ziehen (Doppelklick: zurücksetzen)', onpointerdown: e => colResize(e, c),
       ondblclick: () => { if (UI.colW) delete UI.colW[colKey(c)]; saveUI(); renderNow(); } })]));
  return {
    summary: rows.length + ' Maßnahmen' + (nWarn ? ' · ⚠ ' + nWarn : ''),
    tools: [
      h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: UI.allYears, onchange: e => { UI.allYears = e.target.checked; renderNow(); } }), 'alle Jahre'),
      h('button', { class: 'ghostbtn', onclick: copyToNextYear }, 'Ins Folgejahr kopieren …'),
      h('button', { class: 'primary', onclick: () => addMassnahme(y) }, '+ Maßnahme')],
    body: [personList(),
      h('div', { class: 'tablewrap' }, h('table', { class: 'grid mtable', style: { width: 'max(100%, ' + tableWidth() + 'px)' } },
        h('colgroup', null, COLS.map(c => h('col', { dataset: { k: c.k }, style: colW(c) ? { width: colW(c) + 'px' } : null }))),
        h('thead', null,
          phs.length ? h('tr', { class: 'grouprow' }, nBefore ? h('th', { colspan: nBefore }) : null, h('th', { class: 'gr-ph', colspan: phs.length }, viewSwitch()), nAfter ? h('th', { colspan: nAfter }) : null) : null,
          h('tr', null, ths)), tb)),
      !rows.length ? h('div', { class: 'empty' }, 'Noch keine Maßnahmen in ' + y + '. ', h('button', { class: 'link', onclick: () => addMassnahme(y) }, 'Maßnahme anlegen'),
        C.ms.some(x => x.pal != null && ymd(x.pal)[0] === y - 1) ? [' oder ', h('button', { class: 'link', onclick: () => { UI.year = y - 1; copyToNextYear(); } }, 'aus ' + (y - 1) + ' kopieren')] : null) : null],
  };
}

/* ---------- Bearbeiten-Dialog (aus Kalender und Zeitleiste) */
async function editMassnahme(id) {
  const x = C.byId.get(id); if (!x) return;
  const m = JSON.parse(JSON.stringify(x.m)), orig = JSON.parse(JSON.stringify(x.m));
  const row = (label, inp, hint) => h('label', { class: 'frow' }, h('span', null, label), inp, hint ? h('small', null, hint) : null);
  const sw = h('button', { class: 'swatch big', style: { background: m.farbe }, onclick: e => { e.preventDefault(); e.stopPropagation(); colorPicker(sw, m.farbe, c => { m.farbe = c; sw.style.background = c; }); } });
  const calc = h('div', { class: 'calcline' });
  m.vorlauf = Object.assign({}, m.vorlauf); m.ende = Object.assign({}, m.ende);
  // je Bereich: Start (Datum) und optional ein eigenes Ende; ohne Ende läuft der Bereich bis zum nächsten Start
  const inS = {}, inE = {}, wtS = {};
  for (const p of PH()) {
    inS[p.key] = h('input', { type: 'date', oninput: e => { const v = dn(e.target.value), pal = dn(m.pal); if (pal == null) return; if (v == null) delete m.vorlauf[p.key]; else m.vorlauf[p.key] = pal - v; upd(true); } });
    inE[p.key] = h('input', { type: 'date', tip: 'optional – leer: bis zum nächsten Start', oninput: e => { const v = dn(e.target.value), pal = dn(m.pal); if (pal == null) return; if (v == null) delete m.ende[p.key]; else m.ende[p.key] = pal - v; upd(true); } });
    wtS[p.key] = h('span', { class: 'muted small' });
  }
  const upd = keepInputs => {
    const pal = dn(m.pal);
    if (m.plan) { const pc = planCalc(m); calc.textContent = PH().map(p => pc.ph[p.key] ? p.name + ' ' + fmtS(pc.ph[p.key].start) + '–' + fmtS(pc.ph[p.key].end) : null).filter(Boolean).join(' · ') + ' (aus Detailplan)'; return; }
    for (const p of PH()) {
      const v = m.vorlauf[p.key], e = m.ende[p.key], st = pal != null && isNum(v) ? pal - v : null, en = pal != null && isNum(e) ? pal - e : null;
      if (!keepInputs) { inS[p.key].value = st != null ? ds(st) : ''; inE[p.key].value = en != null ? ds(en) : ''; }
      inS[p.key].disabled = inE[p.key].disabled = pal == null;
      wtS[p.key].textContent = st != null ? workdaysBefore(st, pal) + ' WT vor PAL' : '';
    }
    calc.textContent = pal == null ? 'Erst den PAL eintragen – die Starts der Bereiche verschieben sich mit dem PAL.' : 'Ohne eigenes Ende läuft ein Bereich bis zum nächsten Start (der letzte bis zum PAL).';
  };
  upd();
  const phaseRows = m.plan ? null : h('div', { class: 'phgrid' }, h('span'), h('span', { class: 'muted small' }, 'Start'), h('span'), h('span', { class: 'muted small' }, 'Ende (optional)'),
    PH().map(p => [h('span', null, demoChip(p.key), ' ', p.name), inS[p.key], wtS[p.key], inE[p.key]]));
  const body = h('div', { class: 'form' }, personList(),
    row('Maßnahme', h('input', { value: m.name, oninput: e => { m.name = e.target.value; } })),
    h('div', { class: 'frow' }, h('span', null, 'Farbe'), sw),
    row('PAL (Briefkasten-Termin)', h('div', { class: 'inl' }, h('input', { type: 'date', value: m.pal || '', oninput: e => { m.pal = e.target.value || null; upd(); } }),
      h('select', { onchange: e => { m.palStatus = e.target.value; } }, ['vorläufig', 'fest'].map(v => h('option', { value: v, selected: m.palStatus === v }, 'PAL ' + v))))),
    phaseRows,
    calc,
    row('Hauptverantwortlich', h('input', { value: m.verantwortlich || '', list: 'dl-personen', oninput: e => { m.verantwortlich = e.target.value.trim(); } }), 'Urlaub dieser Person wird bei den Terminen geprüft'),
    row('Auflage', h('input', { type: 'number', min: 0, value: m.auflage ?? '', oninput: e => { m.auflage = numOrNull(e.target.value); } })),
    row('Art der Zuwendungs-/Zuweisungsbitte', h('select', { onchange: e => { m.art = e.target.value; } }, ART.map(a => h('option', { value: a, selected: (m.art || '') === a }, a || '–')))),
    row('Hinweis', h('textarea', { rows: 2, oninput: e => { m.hinweis = e.target.value; } }, m.hinweis || '')));
  const res = await modal('Maßnahme bearbeiten', body, [['Löschen', 'del', 'danger left'], ['Abbrechen', false], ['Übernehmen', true, 'primary']]);
  if (res === 'del') return deleteMassnahme(id);
  if (res !== true) return;
  // nur, was im Dialog geändert wurde – was jemand anderes inzwischen geändert hat (z. B. der Detailplan), bleibt erhalten
  const changedKeys = [...new Set([...Object.keys(orig), ...Object.keys(m)])].filter(k => JSON.stringify(orig[k]) !== JSON.stringify(m[k]));
  if (!changedKeys.length) return;
  if (!findM(D, id)) { toast('Diese Maßnahme wurde inzwischen gelöscht – die Änderung wurde nicht übernommen.', 'warn'); return; }
  commit(d => {
    const cur = findM(d, id);
    for (const k of changedKeys) {
      if (k === 'vorlauf' || k === 'ende') {                  // je Bereich einzeln, damit Änderungen anderer an anderen Bereichen bleiben
        cur[k] = Object.assign({}, cur[k]);
        for (const b of new Set([...Object.keys(orig[k] || {}), ...Object.keys(m[k] || {})])) if ((orig[k] || {})[b] !== m[k][b]) { if (m[k][b] === undefined) delete cur[k][b]; else cur[k][b] = m[k][b]; }
      } else if (m[k] === undefined) delete cur[k]; else cur[k] = JSON.parse(JSON.stringify(m[k]));
    }
  }, 'Änderung übernommen');
}
