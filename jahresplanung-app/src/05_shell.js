/* ===================================================================== Rahmen: Kopfzeile, Reiter, Seitenleiste, Warnungen, Menüs */

const VIEWS = [['jahr', 'Jahresplanung'], ['zeit', 'Zeitleiste'], ['plaene', 'Detailpläne'], ['urlaub', 'Urlaub & Feiertage']];
const OLD_VIEWS = { kalender: 'jahr', massnahmen: 'jahr', zeitleiste: 'zeit', agenda: 'zeit' };
const VIEW_FN = {};                  // wird von den Ansichten befüllt
const SIDEBAR_VIEWS = new Set();

let _renderTimer = null, _pointerDown = false, _renderPending = false;
function requestRender() {
  if (_pointerDown) { _renderPending = true; return; }
  if (_renderTimer) return;
  _renderTimer = setTimeout(renderNow, 0);
}
document.addEventListener('pointerdown', () => { _pointerDown = true; }, true);
document.addEventListener('pointerup', () => { _pointerDown = false; if (_renderPending) { _renderPending = false; requestRender(); } }, true);
document.addEventListener('pointercancel', () => { _pointerDown = false; if (_renderPending) { _renderPending = false; requestRender(); } }, true);
function renderNow() {
  clearTimeout(_renderTimer); _renderTimer = null;
  if (!D) return;
  hideTip();
  const app = $('#app');
  // Fokus und Scrollpositionen merken
  const ae = document.activeElement, fk = ae && ae.dataset ? ae.dataset.fk : null;
  const selS = ae && 'selectionStart' in ae ? (() => { try { return [ae.selectionStart, ae.selectionEnd]; } catch (e) { return null; } })() : null;
  const main0 = $('#main'), sc = main0 ? [main0.scrollTop, main0.scrollLeft] : [0, 0];
  const inner = $$('[data-keep-scroll]').map(e => [e.dataset.keepScroll, e.scrollLeft, e.scrollTop]);
  derive();
  document.body.classList.toggle('printing', !!UI.printing);
  const main = h('main', { id: 'main', class: 'view-' + UI.view });
  try { (VIEW_FN[UI.view] || VIEW_FN.kalender)(main); }
  catch (e) { console.error(e); main.append(h('div', { class: 'error' }, 'Fehler in der Ansicht: ' + e.message)); }
  const showSide = SIDEBAR_VIEWS.has(UI.view) && UI.sidebar && !UI.printing;
  app.replaceChildren();
  put(app, topBar(), banners(), h('div', { class: 'body' + (showSide ? ' with-side' : '') }, showSide ? sideBar() : null, main),
    UI.warnOpen ? warnPanel() : null, h('div', { class: 'print-foot' }, 'Stand: ' + fmtD(todayDn()) + (D.meta.savedAt ? ' · gespeichert ' + fmtStamp(D.meta.savedAt) : '')));
  main.scrollTop = sc[0]; main.scrollLeft = sc[1];
  for (const [k, l, t] of inner) { const e = $('[data-keep-scroll="' + k + '"]'); if (e) { e.scrollLeft = l; e.scrollTop = t; } }
  if (fk) {
    const e = $('[data-fk="' + CSS.escape(fk) + '"]');
    if (e) { e.focus({ preventScroll: true }); if (selS && 'setSelectionRange' in e) try { e.setSelectionRange(selS[0], selS[1]); } catch (x) { /* */ } }
  }
  document.title = (isDirty() ? '● ' : '') + 'Jahresplanung ' + UI.year;
  (VIEW_FN[UI.view + ':after'] || (() => {}))(main);
  flashTarget();
  saveUI();
}

function topBar() {
  const dirty = isDirty(), nW = C.warnings.filter(w => w.lvl === 'warn').length, nI = C.warnings.length - nW;
  const tab = ([k, label]) => h('button', { class: 'tab' + (UI.view === k ? ' on' : ''), onclick: () => { UI.view = k; renderNow(); $('#main').scrollTop = 0; } }, label);
  return h('header', { class: 'top' },
    h('div', { class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('div', null, h('strong', null, 'Jahresplanung Außenkommunikation'), h('span', null, 'Fundraising · Diözese Paderborn'))),
    h('div', { class: 'year' },
      h('button', { class: 'icon', 'aria-label': 'Vorjahr', onclick: () => { UI.year--; renderNow(); } }, '‹'),
      h('span', { class: 'y' }, UI.year),
      h('button', { class: 'icon', 'aria-label': 'Folgejahr', onclick: () => { UI.year++; renderNow(); } }, '›')),
    h('nav', { class: 'tabs' }, VIEWS.map(tab)),
    h('div', { class: 'actions' },
      h('button', { class: 'icon', tip: 'Rückgängig (Strg+Z)', disabled: !UNDO.length, onclick: undo }, '↶'),
      h('button', { class: 'icon', tip: 'Wiederholen (Strg+Y)', disabled: !REDO.length, onclick: redo }, '↷'),
      h('button', { class: 'warnbtn' + (nW ? ' has' : ''), tip: 'Warnungen und Hinweise für ' + UI.year, onclick: () => { UI.warnOpen = !UI.warnOpen; renderNow(); } },
        '⚠ ', nW, nI ? h('span', { class: 'sub' }, ' · ' + nI) : null),
      menuButton('Export ▾', [
        ['Excel-Datei (.xlsx)', exportExcel], ['Outlook-Kalender (.ics)', exportICS], ['Drucken / als PDF speichern', printView]]),
      h('button', { class: 'primary save' + (dirty ? ' dirty' : ''), tip: dirty ? 'Ungespeicherte Änderungen – jetzt speichern (Strg+S)' : 'Alles gespeichert', onclick: () => save() },
        dirty ? '● Speichern' : '✓ Gespeichert'),
      menuButton('⋯', [
        ['Andere Datei öffnen …', openFile], ['Speichern unter …', () => save(true)], ['Daten als JSON sichern', exportJSON], null,
        ['Einstellungen …', settingsDialog], ['Hilfe', helpDialog]], 'right')));
}

function banners() {
  const out = h('div', { class: 'banners' });
  if (openedFromDownloads() && !UI.dlHintClosed) out.append(h('div', { class: 'banner err' },
    h('span', null, 'Achtung: Diese Datei wurde aus dem Download-Ordner bzw. dem Browser geöffnet. Änderungen landen dann nicht im gemeinsamen Mailing-Ordner. ' +
      'Bitte schließen und über „Jahresplanung starten“ im (synchronisierten) Mailing-Ordner öffnen.'),
    h('button', { onclick: () => { UI.dlHintClosed = true; renderNow(); } }, 'Trotzdem hier arbeiten')));
  if (DRAFT_OFFER) out.append(h('div', { class: 'banner warn' },
    h('span', null, `In diesem Browser gibt es ungespeicherte Änderungen vom ${fmtStamp(DRAFT_OFFER.at)}.`),
    h('button', { class: 'primary', onclick: restoreDraft }, 'Wiederherstellen'),
    h('button', { onclick: () => { clearDraft(); renderNow(); } }, 'Verwerfen')));
  return out;
}

let _openMenu = null;
function menuButton(label, items, align) {
  const btn = h('button', { class: 'menu-btn', 'aria-haspopup': 'true' }, label);
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (_openMenu) { const was = _openMenu.btn === btn; closeMenu(); if (was) return; }
    const m = h('div', { class: 'menu' + (align === 'right' ? ' right' : ''), role: 'menu' },
      items.map(it => it ? h('button', { role: 'menuitem', onclick: () => { closeMenu(); it[1](); } }, it[0]) : h('hr')));
    const r = btn.getBoundingClientRect();
    m.style.top = (r.bottom + 4) + 'px';
    if (align === 'right') m.style.right = (innerWidth - r.right) + 'px'; else m.style.left = r.left + 'px';
    document.body.append(m);
    _openMenu = { m, btn };
  });
  return btn;
}
function closeMenu() { if (_openMenu) { _openMenu.m.remove(); _openMenu = null; } }
document.addEventListener('click', () => closeMenu());

/* ---------- Seitenleiste: was wird angezeigt? */
function highlight(id) {
  const main = $('#main'); if (!main) return;
  main.classList.toggle('hl', !!id);
  $$('[data-m]', main).forEach(e => e.classList.toggle('hl-on', e.dataset.m === id));
}
function sideBar() {
  const y = UI.year;
  const ms = C.ms.filter(x => inYear(x, y));
  const typeBtn = (t, label) => h('label', { class: 'tchk' }, h('input', { type: 'checkbox', checked: UI.show[t], onchange: e => { UI.show[t] = e.target.checked; renderNow(); } }),
    h('span', { class: 'chip demo ' + t }, t), label);
  const persons = [...new Set([...D.personen.map(p => p.name), ...C.vac.map(v => v.u.wer).filter(Boolean)])];
  return h('aside', { class: 'side' },
    h('button', { class: 'icon collapse', tip: 'Seitenleiste ausblenden', onclick: () => { UI.sidebar = false; renderNow(); } }, '«'),
    h('section', null, h('h3', null, 'Termine anzeigen'), typeBtn('S', 'Start Selektion'), typeBtn('I', 'Start inhaltliche Arbeit'), typeBtn('P', 'PAL (Briefkasten)')),
    h('section', null, h('h3', null, 'Maßnahmen ', h('span', { class: 'links' },
      h('button', { class: 'link', onclick: () => { UI.hiddenM.clear(); renderNow(); } }, 'alle'), ' · ',
      h('button', { class: 'link', onclick: () => { ms.forEach(x => UI.hiddenM.add(x.id)); renderNow(); } }, 'keine'))),
      ms.length ? ms.map(x => h('label', { class: 'mchk', dataset: { m: x.id }, onmouseenter: () => highlight(x.id), onmouseleave: () => highlight(null) },
        h('input', { type: 'checkbox', checked: visibleM(x), onchange: e => { e.target.checked ? UI.hiddenM.delete(x.id) : UI.hiddenM.add(x.id); renderNow(); } }),
        h('span', { class: 'dot', style: { background: x.color } }), h('span', { class: 'nm' }, x.m.name || '(ohne Namen)'),
        h('span', { class: 'pal' }, x.pal != null ? fmtS(x.pal) : ''))) : h('p', { class: 'muted small' }, 'Keine Maßnahmen in ' + y)),
    h('section', null, h('h3', null, 'Urlaub'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: UI.showVac, onchange: e => { UI.showVac = e.target.checked; renderNow(); } }), 'Urlaube anzeigen'),
      persons.map(n => h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: !UI.hiddenP.has(n), disabled: !UI.showVac, onchange: e => { e.target.checked ? UI.hiddenP.delete(n) : UI.hiddenP.add(n); renderNow(); } }),
        h('span', { class: 'vdot', style: { background: personColor(n) } }), h('span', { class: 'nm' }, n))),
      !persons.length ? h('p', { class: 'muted small' }, 'Noch keine Urlaube eingetragen.') : null),
    UI.view === 'kalender' ? h('section', null, h('h3', null, 'Kalender'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: UI.monthLists, onchange: e => { UI.monthLists = e.target.checked; renderNow(); } }), 'Terminliste unter jedem Monat')) : null,
    h('section', { class: 'legend' }, h('h3', null, 'Legende'),
      h('div', null, h('span', { class: 'lg we' }), 'Wochenende'), h('div', null, h('span', { class: 'lg hol' }), 'Feiertag NRW'),
      h('div', null, h('span', { class: 'lg today' }), 'Heute'), h('div', null, h('span', { class: 'lg vac' }), 'Urlaub (Farbe je Person)'),
      h('div', { class: 'small muted' }, 'P = kräftige Farbe, S und I = Pastellton der Maßnahme.')));
}
const vacVisible = v => UI.showVac && !UI.hiddenP.has(v.u.wer);

/* ---------- Warnungen */
function goTo(w) {
  UI.warnOpen = false;
  if (w.step) { UI.view = 'plaene'; UI.planSel = w.mid; UI.flash = 'step:' + w.step; }
  else if (w.mid) { UI.view = 'jahr'; UI.secOpen.mass = true; UI.flash = 'm:' + w.mid; }
  else if (w.n != null) { UI.view = 'zeit'; UI.secOpen.tl = true; UI.flash = 'n:' + w.n; }
  renderNow();
}
function fixDate(w) {
  const x = C.byId.get(w.mid); if (!x || x.pal == null) return;
  commit(d => { const m = findM(d, w.mid); if (w.fix.t === 'S') m.vorlaufS = x.pal - w.fix.to; else m.vorlaufI = x.pal - w.fix.to; },
    x.m.name + ': ' + (w.fix.t === 'S' ? 'Start Selektion' : 'Start Inhalt') + ' → ' + fmtW(w.fix.to));
}
async function fixAll(list) {
  if (!await confirmBox('Alle vorziehen', list.length + ' Starts werden auf den jeweils vorherigen Arbeitstag gelegt (Vorlauf wird angepasst). Strg+Z macht es rückgängig.', 'Vorziehen')) return;
  commit(d => { for (const w of list) { const x = C.byId.get(w.mid), m = findM(d, w.mid); if (!x || !m) continue; if (w.fix.t === 'S') m.vorlaufS = x.pal - w.fix.to; else m.vorlaufI = x.pal - w.fix.to; } }, list.length + ' Starts vorgezogen');
}
function warnPanel() {
  const W = C.warnings, warn = W.filter(w => w.lvl === 'warn'), info = W.filter(w => w.lvl !== 'warn');
  const vorl = C.ms.filter(x => x.pal != null && ymd(x.pal)[0] === UI.year && x.m.palStatus !== 'fest').length;
  const item = w => h('div', { class: 'witem ' + w.lvl },
    h('button', { class: 'wtext', onclick: () => goTo(w) }, w.text),
    w.fix ? h('button', { class: 'wfix', tip: 'Vorlauf so ändern, dass der Termin auf den vorherigen Arbeitstag fällt', onclick: () => fixDate(w) }, 'auf ' + fmtWS(w.fix.to) + ' vorziehen') : null);
  return h('aside', { class: 'warnpanel' },
    h('header', null, h('h2', null, 'Warnungen ' + UI.year), h('button', { class: 'icon', 'aria-label': 'Schließen', onclick: () => { UI.warnOpen = false; renderNow(); } }, '✕')),
    h('div', { class: 'wbody' },
      vorl ? h('p', { class: 'wsum' }, vorl + ' PAL-Termine sind noch vorläufig.') : null,
      warn.length ? [h('h3', null, 'Bitte prüfen (' + warn.length + ')'),
        warn.filter(w => w.fix).length > 1 ? h('button', { class: 'fixall', onclick: () => fixAll(warn.filter(w => w.fix)) }, 'Alle ' + warn.filter(w => w.fix).length + ' Starts am Wochenende/Feiertag auf den Arbeitstag davor legen') : null,
        warn.map(item)] : h('p', { class: 'ok' }, '✓ Keine Konflikte gefunden.'),
      info.length ? [h('h3', null, 'Hinweise (' + info.length + ')'), info.map(item)] : null,
      h('p', { class: 'muted small' }, 'Geprüft werden: Starts am Wochenende oder Feiertag, PAL an Sonn-/Feiertagen, Termine im Urlaub (des/der Verantwortlichen), ' +
        'Arbeitsschritte im Urlaub der zugeordneten Person, überfällige Schritte und mehr als ' + D.settings.maxStarts + ' Starts pro Kalenderwoche.')));
}

/* ---------- Einstellungen, Hilfe */
async function settingsDialog() {
  const f = { name: UI.userName, max: D.settings.maxStarts, vs: D.settings.vorlaufS, vi: D.settings.vorlaufI, year: D.settings.year };
  const row = (label, inp, hint) => h('label', { class: 'frow' }, h('span', null, label), inp, hint ? h('small', null, hint) : null);
  const ok = await modal('Einstellungen', h('div', { class: 'form' },
    row('Dein Name', h('input', { value: f.name, oninput: e => { f.name = e.target.value; } }), 'wird beim Speichern vermerkt („gespeichert von …“), nur in diesem Browser'),
    row('Max. Starts pro Kalenderwoche', h('input', { type: 'number', min: 1, max: 20, value: f.max, oninput: e => { f.max = +e.target.value; } }), 'darüber erscheint eine Warnung'),
    row('Standard-Vorlauf Selektion (Tage)', h('input', { type: 'number', min: 0, value: f.vs, oninput: e => { f.vs = +e.target.value; } }), 'für neue Maßnahmen'),
    row('Standard-Vorlauf Inhalt (Tage)', h('input', { type: 'number', min: 0, value: f.vi, oninput: e => { f.vi = +e.target.value; } })),
    row('Planungsjahr beim Öffnen', h('input', { type: 'number', min: 2000, max: 2100, value: f.year, oninput: e => { f.year = +e.target.value; } }))),
    [['Abbrechen', false], ['Übernehmen', true, 'primary']]);
  if (!ok) return;
  UI.userName = f.name.trim();
  commit(d => { d.settings.maxStarts = f.max || 2; d.settings.vorlaufS = f.vs; d.settings.vorlaufI = f.vi; d.settings.year = f.year || d.settings.year; });
  renderNow();
}
function helpDialog() {
  const p = t => h('p', null, t);
  modal('Hilfe', h('div', { class: 'help' },
    h('h3', null, 'Starten'),
    p('Im Mailing-Ordner auf „Jahresplanung starten“ doppelklicken – das Programm öffnet sich in einem eigenen Fenster. Geht das nicht (z. B. weil die IT Startdateien sperrt), im Unterordner „Jahresplanung (Programmdatei)“ die HTML-Datei doppelklicken.'),
    p('Wer den Ordner nur in Teams oder im Browser sieht: einmalig in Teams unter „Dateien“ auf „Synchronisieren“ klicken. Danach liegt der Ordner im Windows-Explorer und der Start funktioniert. Direkt aus der Teams-/SharePoint-Weboberfläche läuft das Programm nicht.'),
    h('h3', null, 'Speichern'),
    p('Alles steckt in dieser einen HTML-Datei: das Programm und deine Daten. „Speichern“ schreibt die Datei zurück. Beim ersten Speichern fragt der Browser, wohin – dann dieselbe Datei auswählen und ersetzen. Danach speichert Strg+S direkt.'),
    p('Funktioniert am besten im Microsoft Edge oder Google Chrome. In anderen Browsern wird die Datei heruntergeladen; dann die alte Datei damit ersetzen.'),
    h('h3', null, 'Im Team'),
    p('Die Datei in einen gemeinsamen Teams-/SharePoint-Ordner legen, der per OneDrive auf dem PC synchronisiert ist, und von dort öffnen. Es kann immer nur eine Person gleichzeitig sinnvoll bearbeiten: Hat jemand anderes zwischenzeitlich gespeichert, warnt die App vor dem Überschreiben.'),
    h('h3', null, 'Datenschutz'),
    p('Die App arbeitet komplett offline: Es werden keine Daten ins Internet gesendet und nichts nachgeladen. Wer die Datei hat, sieht alle Daten – also nur intern ablegen.'),
    h('h3', null, 'Bedienung'),
    p('Jahresplanung: oben die Maßnahmen, darunter der Kalender – beide Bereiche lassen sich mit ▾ ein- und ausklappen. Maus über einen Tag oder eine Markierung zeigt die Details. Markierung ziehen: P verschiebt das ganze Projekt (S und I wandern mit), S oder I verschiebt nur dieses Datum. Klick öffnet die Maßnahme.'),
    p('Zeitleiste: Klick auf einen Monat zoomt hinein, mit gedrückter Maus auf freier Fläche nach links/rechts schieben. Balken ziehen verschiebt den PAL, die Griffe S und I ändern den Vorlauf. Darunter „Was steht an?“. Strg+Z macht jede Änderung rückgängig.'),
    p('Maßnahmen mit Detailplan (z. B. Sommer- und Weihnachtsmailing) berechnen Start Selektion und Start Inhalt aus den Arbeitsschritten – wie im Excel-Gantt.')), null, { wide: true });
}

/* ---------- Tastatur */
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase(), inField = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
  if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); setTimeout(() => save(), 30); }
  else if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey && !inField) { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey)) && !inField) { e.preventDefault(); redo(); }
});
window.addEventListener('beforeunload', e => { if (D && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('beforeprint', () => { if (!UI.printing) { UI.printing = true; renderNow(); } });
