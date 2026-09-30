/* ===================================================================== Zusammengefasste Ansichten mit ein-/ausklappbaren Bereichen */

function section(key, title, fn, opts = {}) {
  const open = UI.secOpen[key] !== undefined ? UI.secOpen[key] : opts.open !== false;
  const toggle = () => { UI.secOpen[key] = !open; renderNow(); };
  let content = null;
  if (open) { try { content = fn(); } catch (e) { console.error(e); content = { body: [h('div', { class: 'error' }, 'Fehler: ' + e.message)] }; } }
  const sum = open ? content && content.summary : (opts.closedSummary ? opts.closedSummary() : null);
  return h('section', { class: 'sec' + (open ? '' : ' closed'), dataset: { sec: key } },
    h('header', { class: 'sec-h' },
      h('button', { class: 'sec-tog', 'aria-expanded': String(open), onclick: toggle, tip: open ? 'einklappen' : 'ausklappen' },
        h('span', { class: 'chev' }, open ? '▾' : '▸'), h('span', { class: 'sec-t' }, title)),
      sum ? h('span', { class: 'sec-sum' }, sum) : null,
      opts.info ? h('span', { class: 'info', tip: opts.info }, 'ⓘ') : null,
      open && content && content.lead ? h('div', { class: 'tools lead' }, content.lead) : null,
      open && content && content.tools ? h('div', { class: 'tools' }, content.tools) : null),
    open && content ? h('div', { class: 'sec-b' }, content.body) : null);
}

/* ---------- Filterleiste (ersetzt die Seitenleiste) */
function popover(anchor, content) {
  closeMenu();
  const m = h('div', { class: 'menu pop', onclick: e => e.stopPropagation() }, content);
  document.body.append(m);
  placeMenu(m, anchor.getBoundingClientRect());
  _openMenu = { m, btn: anchor, at: performance.now() };
}
/* ---------- Anzeige-Einstellungen (einzeln, damit sie im jeweiligen Bereich sitzen können) */
function typePills() {
  const typeBtn = (t, label) => h('button', { class: 'tpill' + (showType(t) ? ' on' : ''), 'aria-pressed': String(showType(t)), tip: (showType(t) ? 'ausblenden: ' : 'einblenden: ') + label,
    onclick: () => { UI.show[t] = !showType(t); renderNow(); } }, h('span', { class: 'chip demo ' + (t === 'P' ? 'P' : 'ph') }, t), label);
  return evKeys().map(t => typeBtn(t, phName(t)));
}
const syncPop = (e, on) => $$('input[type=checkbox]', e.target.closest('.menu')).forEach(c => { c.checked = on; });
function massnahmenDropdown() {
  const y = UI.year, ms = C.ms.filter(x => inYear(x, y)), shown = ms.filter(visibleM).length;
  const mBtn = h('button', { class: 'fbtn', onclick: e => { e.stopPropagation(); popover(mBtn, h('div', null,
    h('div', { class: 'pop-h' }, 'Maßnahmen anzeigen', h('span', null,
      h('button', { class: 'link', onclick: e => { UI.hiddenM.clear(); syncPop(e, true); renderNow(); } }, 'alle'), ' · ',
      h('button', { class: 'link', onclick: e => { ms.forEach(x => UI.hiddenM.add(x.id)); syncPop(e, false); renderNow(); } }, 'keine'))),
    ms.map(x => h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: visibleM(x), onchange: ev => { ev.target.checked ? UI.hiddenM.delete(x.id) : UI.hiddenM.add(x.id); renderNow(); } }),
      h('span', { class: 'dot', style: { background: x.color } }), h('span', { class: 'nm' }, x.m.name || '(ohne Namen)'), h('span', { class: 'pal' }, x.pal != null ? fmtS(x.pal) : ''))))); } },
    'Maßnahmen: ', h('b', null, shown === ms.length ? 'alle' : shown + ' von ' + ms.length), ' ▾');
  return mBtn;
}
function vacDropdown() {
  const persons = [...new Set([...D.personen.map(p => p.name), ...C.vac.map(v => v.u.wer).filter(Boolean)])];
  const vBtn = h('button', { class: 'fbtn', onclick: e => { e.stopPropagation(); popover(vBtn, h('div', null,
    h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: UI.showVac, onchange: ev => { UI.showVac = ev.target.checked; renderNow(); } }), h('b', null, 'Urlaube anzeigen')),
    persons.map(n => h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: !UI.hiddenP.has(n), onchange: ev => { ev.target.checked ? UI.hiddenP.delete(n) : UI.hiddenP.add(n); renderNow(); } }),
      h('span', { class: 'vdot', style: { background: personColor(n) } }), h('span', { class: 'nm' }, n))),
    !persons.length ? h('p', { class: 'muted small' }, 'Noch keine Urlaube eingetragen.') : null)); } },
    'Urlaub: ', h('b', null, UI.showVac ? (UI.hiddenP.size ? 'teilweise' : 'an') : 'aus'), ' ▾');
  return vBtn;
}
function vacPill() {
  const on = UI.showVac && !UI.hiddenP.size;
  return h('button', { class: 'tpill' + (on ? ' on' : ''), 'aria-pressed': String(on), tip: on ? 'alle Urlaube ausblenden' : 'alle Urlaube einblenden',
    onclick: () => { if (on) UI.showVac = false; else { UI.showVac = true; UI.hiddenP.clear(); } renderNow(); } }, h('span', { class: 'lg vac' }), 'Urlaub');
}
const legendInline = () => h('span', { class: 'legend-inline' }, h('span', { class: 'lg we' }), 'Wochenende', h('span', { class: 'lg hol' }), 'Feiertag', h('span', { class: 'lg vac' }), 'Urlaub', h('span', { class: 'lg today' }), 'heute');
function filterBar(extra) {
  return h('div', { class: 'filterbar' }, massnahmenDropdown(), vacDropdown(), extra, legendInline());
}
/* ---------- Reiter „Jahresplanung“: Maßnahmen + Kalender */
VIEW_FN.jahr = main => {
  put(main,
    section('mass', 'Maßnahmen ' + (UI.allYears ? '(alle Jahre)' : UI.year), massnahmenSection, {
      info: 'Sortiert automatisch nach PAL. Je Bereich (' + PH().map(p => p.key + ' ' + p.name).join(', ') + ') steht der Start – als Datum oder als Werktage bis zum PAL (Schalter „Datum – Werktage“ über den Spalten der Bereiche). Die Starts wandern mit, wenn sich der PAL verschiebt; bei Maßnahmen mit Detailplan ergeben sie sich aus den Abschnitten. 🏖 = jemand, der im Detailplan in diesem Bereich eingetragen ist, hat Urlaub. Häkchen links = im Kalender anzeigen. Spaltenbreite am rechten Rand der Überschrift ziehen – dabei ändert sich nur die Nachbarspalte rechts; die Breiten bleiben auch nach Neustart und Update erhalten (Doppelklick = Standard).',
      closedSummary: () => C.ms.filter(x => x.pal != null && ymd(x.pal)[0] === UI.year).length + ' Maßnahmen' }),
    section('kal', 'Kalender ' + UI.year, () => ({
      lead: [typePills(), vacPill(), h('span', { class: 'sep' }),
        h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: UI.monthLists, onchange: e => { UI.monthLists = e.target.checked; renderNow(); } }), 'Terminliste unter den Monaten'),
        h('label', { class: 'check small', tip: 'verbindet die Starts der Bereiche und das PAL jeder Maßnahme dauerhaft mit einer Linie in ihrer Farbe' },
          h('input', { type: 'checkbox', checked: !!UI.verbund, onchange: e => { UI.verbund = e.target.checked; renderNow(); } }), 'Verbund-Darstellung')],
      tools: [legendInline()],
      body: [calendarBody()] }), {
      info: 'Maus über Tag oder Markierung zeigt Details. Klick auf eine Markierung (' + evKeys().join(', ') + ') oder eine Zeile der Terminliste hält die Maßnahme hervorgehoben – „Bearbeiten“ steht dann hinter ihren Zeilen in der Terminliste. Klick woanders oder Esc hebt das auf. Markierung ziehen: P verschiebt das ganze Projekt (alle Bereiche wandern mit), ein Start verschiebt nur diesen Bereich. Die Linie wird vom ersten Bereich bis zum PAL kräftiger. Strg+Z macht es rückgängig.' }));
};
VIEW_FN['jahr:after'] = () => {
  if (UI.pin) highlight(UI.pin);                 // festgehaltene Maßnahme nach dem Neuzeichnen wieder hervorheben
  if (UI.focusFk) { const e = $('[data-fk="' + CSS.escape(UI.focusFk) + '"]'); if (e) { e.focus(); e.select && e.select(); } UI.focusFk = null; }
};

/* ---------- Reiter „Zeitleiste“: Zeitleiste + Was steht an? */
VIEW_FN.zeit = main => {
  put(main, filterBar(),
    section('tl', 'Zeitleiste ' + UI.year, timelineSection, {
      info: 'Mausrad zoomt, Klick auf einen Monat zoomt hinein, Klick auf den Namen zeigt die ganze Maßnahme; mit gedrückter Maus auf freier Fläche nach links/rechts schieben. Je Bereich ein Balken (hell → kräftig bis zum PAL); überlappen Bereiche, liegen sie übereinander. Balken ziehen verschiebt den PAL (alle Bereiche wandern mit), die Griffe mit Buchstaben verschieben nur diesen Start. Doppelklick auf den Balken öffnet die Maßnahme.' }),
    section('ag', 'Was steht an?', () => Object.assign(agendaSection(), { lead: typePills() }), { info: 'Termine, Arbeitsschritte, Urlaube und Feiertage der nächsten Wochen. Mit den Knöpfen der Bereiche und PAL wählst du, welche Termine in der Liste stehen. Häkchen = Arbeitsschritt erledigt.' }));
};
VIEW_FN['zeit:after'] = () => timelineAfter();
