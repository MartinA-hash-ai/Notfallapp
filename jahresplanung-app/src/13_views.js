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
  const r = anchor.getBoundingClientRect();
  m.style.top = (r.bottom + 4) + 'px'; m.style.left = Math.min(r.left, innerWidth - 300) + 'px';
  document.body.append(m);
  _openMenu = { m, btn: anchor };
}
/* ---------- Anzeige-Einstellungen (einzeln, damit sie im jeweiligen Bereich sitzen können) */
function typePills() {
  const typeBtn = (t, label) => h('button', { class: 'tpill' + (UI.show[t] ? ' on' : ''), 'aria-pressed': String(UI.show[t]), tip: (UI.show[t] ? 'ausblenden: ' : 'einblenden: ') + label,
    onclick: () => { UI.show[t] = !UI.show[t]; renderNow(); } }, h('span', { class: 'chip demo ' + t }, t), label);
  return [typeBtn('S', 'Selektion'), typeBtn('I', 'Inhalt'), typeBtn('P', 'PAL')];
}
function massnahmenDropdown() {
  const y = UI.year, ms = C.ms.filter(x => inYear(x, y)), shown = ms.filter(visibleM).length;
  const mBtn = h('button', { class: 'fbtn', onclick: e => { e.stopPropagation(); popover(mBtn, h('div', null,
    h('div', { class: 'pop-h' }, 'Maßnahmen anzeigen', h('span', null, h('button', { class: 'link', onclick: () => { UI.hiddenM.clear(); renderNow(); closeMenu(); } }, 'alle'), ' · ',
      h('button', { class: 'link', onclick: () => { ms.forEach(x => UI.hiddenM.add(x.id)); renderNow(); closeMenu(); } }, 'keine'))),
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
const legendInline = () => h('span', { class: 'legend-inline' }, h('span', { class: 'lg we' }), 'Wochenende', h('span', { class: 'lg hol' }), 'Feiertag', h('span', { class: 'lg vac' }), 'Urlaub', h('span', { class: 'lg today' }), 'heute');
function filterBar(extra) {
  return h('div', { class: 'filterbar' }, typePills(), h('span', { class: 'sep' }), massnahmenDropdown(), vacDropdown(), extra, legendInline());
}
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
  const r = anchor.getBoundingClientRect();
  m.style.top = (r.bottom + 4) + 'px'; m.style.left = Math.min(r.left, innerWidth - 300) + 'px';
  document.body.append(m);
  _openMenu = { m, btn: anchor };
}
function filterBar(extra) {
  const y = UI.year, ms = C.ms.filter(x => inYear(x, y)), shown = ms.filter(visibleM).length;
  const persons = [...new Set([...D.personen.map(p => p.name), ...C.vac.map(v => v.u.wer).filter(Boolean)])];
  const typeBtn = (t, label) => h('button', { class: 'tpill' + (UI.show[t] ? ' on' : ''), 'aria-pressed': String(UI.show[t]), tip: (UI.show[t] ? 'ausblenden: ' : 'einblenden: ') + label,
    onclick: () => { UI.show[t] = !UI.show[t]; renderNow(); } }, h('span', { class: 'chip demo ' + t }, t), label);
  const mBtn = h('button', { class: 'fbtn', onclick: e => { e.stopPropagation(); popover(mBtn, h('div', null,
    h('div', { class: 'pop-h' }, 'Maßnahmen anzeigen', h('span', null, h('button', { class: 'link', onclick: () => { UI.hiddenM.clear(); renderNow(); closeMenu(); } }, 'alle'), ' · ',
      h('button', { class: 'link', onclick: () => { ms.forEach(x => UI.hiddenM.add(x.id)); renderNow(); closeMenu(); } }, 'keine'))),
    ms.map(x => h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: visibleM(x), onchange: ev => { ev.target.checked ? UI.hiddenM.delete(x.id) : UI.hiddenM.add(x.id); renderNow(); } }),
      h('span', { class: 'dot', style: { background: x.color } }), h('span', { class: 'nm' }, x.m.name || '(ohne Namen)'), h('span', { class: 'pal' }, x.pal != null ? fmtS(x.pal) : ''))))); } },
    'Maßnahmen: ', h('b', null, shown === ms.length ? 'alle' : shown + ' von ' + ms.length), ' ▾');
  const vBtn = h('button', { class: 'fbtn', onclick: e => { e.stopPropagation(); popover(vBtn, h('div', null,
    h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: UI.showVac, onchange: ev => { UI.showVac = ev.target.checked; renderNow(); } }), h('b', null, 'Urlaube anzeigen')),
    persons.map(n => h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: !UI.hiddenP.has(n), onchange: ev => { ev.target.checked ? UI.hiddenP.delete(n) : UI.hiddenP.add(n); renderNow(); } }),
      h('span', { class: 'vdot', style: { background: personColor(n) } }), h('span', { class: 'nm' }, n))),
    !persons.length ? h('p', { class: 'muted small' }, 'Noch keine Urlaube eingetragen.') : null)); } },
    'Urlaub: ', h('b', null, UI.showVac ? (UI.hiddenP.size ? 'teilweise' : 'an') : 'aus'), ' ▾');
  return h('div', { class: 'filterbar' },
    typeBtn('S', 'Selektion'), typeBtn('I', 'Inhalt'), typeBtn('P', 'PAL'), h('span', { class: 'sep' }), mBtn, vBtn, extra,
    h('span', { class: 'legend-inline' }, h('span', { class: 'lg we' }), 'Wochenende', h('span', { class: 'lg hol' }), 'Feiertag', h('span', { class: 'lg vac' }), 'Urlaub', h('span', { class: 'lg today' }), 'heute'));
}

/* ---------- Reiter „Jahresplanung“: Maßnahmen + Kalender */
VIEW_FN.jahr = main => {
  put(main,
    section('mass', 'Maßnahmen ' + (UI.allYears ? '(alle Jahre)' : UI.year), massnahmenSection, {
      info: 'Sortiert automatisch nach PAL. Start Selektion = PAL − Vorlauf Selektion, Start inhaltliche Arbeit = PAL − Vorlauf Inhalt (Kalendertage). Bei Maßnahmen mit Detailplan kommen die Vorläufe aus den Arbeitsschritten. Häkchen links = im Kalender anzeigen.',
      closedSummary: () => C.ms.filter(x => x.pal != null && ymd(x.pal)[0] === UI.year).length + ' Maßnahmen' }),
    section('kal', 'Kalender ' + UI.year, () => ({
      lead: [typePills(), h('span', { class: 'sep' }), vacDropdown(),
        h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: UI.monthLists, onchange: e => { UI.monthLists = e.target.checked; renderNow(); } }), 'Terminliste unter den Monaten')],
      tools: [legendInline()],
      body: [calendarBody()] }), {
      info: 'Maus über Tag oder Markierung zeigt Details. Markierung anklicken = bearbeiten. Markierung ziehen: P verschiebt das ganze Projekt (S und I wandern mit), S oder I verschiebt nur dieses Datum. Strg+Z macht es rückgängig.' }));
};
VIEW_FN['jahr:after'] = () => {
  if (UI.focusFk) { const e = $('[data-fk="' + CSS.escape(UI.focusFk) + '"]'); if (e) { e.focus(); e.select && e.select(); } UI.focusFk = null; }
};

/* ---------- Reiter „Zeitleiste“: Zeitleiste + Was steht an? */
VIEW_FN.zeit = main => {
  put(main, filterBar(),
    section('tl', 'Zeitleiste ' + UI.year, timelineSection, {
      info: 'Klick auf einen Monat zoomt hinein; mit gedrückter Maus auf freier Fläche nach links/rechts schieben. Balken ziehen verschiebt den PAL (S und I wandern mit), die Griffe S und I ändern den Vorlauf. Doppelklick öffnet die Maßnahme.' }),
    section('ag', 'Was steht an?', agendaSection, { info: 'Termine, Arbeitsschritte, Urlaube und Feiertage der nächsten Wochen. Häkchen = Arbeitsschritt erledigt.' }));
};
VIEW_FN['zeit:after'] = () => timelineAfter();
