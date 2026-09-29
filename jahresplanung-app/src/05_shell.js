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
// Neu zeichnen erst nach dem Loslassen der Maus (sonst gehen Klicks verloren). Geht das Loslassen verloren
// (z. B. weil der Browser beim Klick eine Berechtigungsfrage zeigt), holt die nächste Mausbewegung es nach.
function releasePointer() { _pointerDown = false; if (_renderPending) { _renderPending = false; requestRender(); } }
document.addEventListener('pointerdown', () => { _pointerDown = true; }, true);
document.addEventListener('pointerup', releasePointer, true);
document.addEventListener('pointercancel', releasePointer, true);
document.addEventListener('pointermove', e => { if (_pointerDown && e.buttons === 0) releasePointer(); }, true);
window.addEventListener('blur', releasePointer);
document.addEventListener('visibilitychange', releasePointer);
let _rendering = false;
function renderNow() {
  clearTimeout(_renderTimer); _renderTimer = null;
  if (!D) return;
  if (_rendering) { requestRender(); return; }            // z. B. ein Feld verliert beim Neuzeichnen den Fokus und will selbst neu zeichnen
  if (DRAG) DRAG.cancel();                                  // Ziehen sauber beenden, bevor das Element verschwindet
  _rendering = true;
  try { renderInner(); } finally { _rendering = false; }
}
function renderInner() {
  hideTip();
  const app = $('#app');
  // Fokus und Scrollpositionen merken
  const ae = document.activeElement, fk = ae && ae.dataset ? ae.dataset.fk : null;
  const selS = ae && 'selectionStart' in ae ? (() => { try { return [ae.selectionStart, ae.selectionEnd]; } catch (e) { return null; } })() : null;
  const main0 = $('#main'), sc = main0 ? [main0.scrollTop, main0.scrollLeft] : [0, 0];
  const inner = $$('[data-keep-scroll]').map(e => [e.dataset.keepScroll, e.scrollLeft, e.scrollTop]);
  try { derive(); }
  catch (e) {                                               // Daten lassen sich nicht auswerten: nicht leer weiterarbeiten, sondern sichern lassen
    console.error(e);
    $('#app').replaceChildren(h('div', { class: 'fatal' }, h('h2', null, 'Die Daten lassen sich nicht anzeigen'), h('p', null, String((e && e.message) || e)),
      h('p', null, 'Bitte die Daten sichern und die Datei an den/die Verantwortliche(n) geben. Nichts wurde überschrieben.'),
      h('button', { class: 'primary', onclick: exportJSON }, 'Daten sichern (.json)'), ' ', h('button', { onclick: () => openFile() }, 'Datensicherung laden …')));
    return;
  }
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
  syncTopHeight();
  (VIEW_FN[UI.view + ':after'] || (() => {}))(main);
  flashTarget();
  saveUI();
}

function topBar() {
  const dirty = isDirty(), nW = C.warnings.filter(w => w.lvl === 'warn').length, nI = C.warnings.length - nW;
  const tab = ([k, label]) => h('button', { class: 'tab' + (UI.view === k ? ' on' : ''), onclick: () => { UI.view = k; renderNow(); $('#main').scrollTop = 0; } }, label);
  return h('header', { class: 'top' },
    h('div', { class: 'brand' }, h('img', { class: 'logo', src: logoSrc(), alt: 'Malteser' }), h('div', null, h('strong', null, 'Jahresplanung Außenkommunikation'), h('span', null, 'Fundraising · Diözese Paderborn'))),
    h('div', { class: 'year' },
      h('button', { class: 'icon', 'aria-label': 'Vorjahr', onclick: () => { UI.year--; renderNow(); } }, '‹'),
      h('span', { class: 'y' }, UI.year),
      h('button', { class: 'icon', 'aria-label': 'Folgejahr', onclick: () => { UI.year++; renderNow(); } }, '›')),
    h('nav', { class: 'tabs' }, VIEWS.map(tab)),
    h('div', { class: 'actions' },
      h('button', { class: 'icon', tip: 'Rückgängig (Strg+Z)', disabled: !UNDO.length, onclick: undo, 'data-repeat': true }, '↶'),
      h('button', { class: 'icon', tip: 'Wiederholen (Strg+Y)', disabled: !REDO.length, onclick: redo, 'data-repeat': true }, '↷'),
      h('button', { class: 'warnbtn' + (nW ? ' has' : ''), tip: (nW ? nW + ' Warnung' + (nW > 1 ? 'en' : '') : 'Keine Warnungen') + (nI ? ', ' + nI + ' Hinweis' + (nI > 1 ? 'e' : '') : '') + ' für ' + UI.year,
        onclick: () => { UI.warnOpen = !UI.warnOpen; renderNow(); } },
        nW ? '⚠ ' + nW : '✓', nI ? h('span', { class: 'sub' }, ' · ' + nI) : null),
      menuButton('Export ▾', [
        ['PDF exportieren …', pdfDialog], null,
        ['Excel-Datei (.xlsx)', exportExcel], ['Outlook-Kalender (.ics)', exportICS], null,
        ['Datensicherung exportieren (.json)', exportJSON], ['Datensicherung importieren …', openFile]]),
      presenceChip(),
      saveBox(),
      menuButton('⋯', [
        [(UI.autoSave === false ? '☐' : '☑') + ' Automatisch speichern', () => { UI.autoSave = UI.autoSave === false; saveUI(); if (UI.autoSave && isDirty()) scheduleAutosave(); renderNow(); toast('Automatisch speichern ' + (UI.autoSave ? 'an' : 'aus')); }],
        ['Speicherort (Mailing-Ordner) neu wählen …', async () => { ST.conn = 'none'; ST.dir = null; await connectFolder(); renderNow(); }], null,
        ['Daten aus anderer Datei übernehmen …', openFile], ['Kopie speichern unter …', saveCopy], ['Daten als JSON sichern', exportJSON], null,
        ['Änderungsprotokoll …', logDialog], ['Daten prüfen …', checkDialog], null,
        [(DARK ? '☀ Helles Design' : '☾ Dunkles Design'), () => setTheme(DARK ? 'light' : 'dark')],
        ['Programm-Update einspielen …', updateProgram], null,
        ['Einstellungen …', settingsDialog], ['Hilfe', helpDialog]], 'right')));
}

// Wer hat die Jahresplanung gerade noch geöffnet? (aus den Anwesenheitsdateien im Mailing-Ordner)
const presName = o => o.name ? (o.name === UI.userName ? o.name + ' (anderes Fenster)' : o.name) : 'Jemand ohne Namen';
const editingNow = o => o.edit && Date.now() - Date.parse(o.edit) < 5 * 60000;
function presenceChip() {
  const os = PRESENCE.others; if (!os.length) return null;
  return h('span', { class: 'presence' + (os.some(editingNow) ? ' busy' : ''), tip: () => h('div', null, h('b', null, 'Ebenfalls geöffnet:'),
    os.map(o => h('div', null, presName(o) + ' · seit ' + fmtStamp(o.since).replace(/^.*?, /, '') + (o.edit ? ' · zuletzt geändert ' + fmtStamp(o.edit).replace(/^.*?, /, '') : ' · noch nichts geändert'))),
    h('div', { class: 'muted small' }, 'Angabe über OneDrive – kann etwa eine Minute nachhinken.')) }, '👥 ' + os.map(presName).join(', '));
}
function banners() {
  const out = h('div', { class: 'banners' });
  if (FSA && ST.conn === 'ok' && !UI.userName && !UI.nameLater) out.append(nameBanner());
  const busy = PRESENCE.others.filter(editingNow);
  if (busy.length && !UI.presClosed) out.append(h('div', { class: 'banner warn' },
    h('span', null, busy.map(presName).join(', ') + (busy.length > 1 ? ' arbeiten' : ' arbeitet') + ' gerade ebenfalls in der Jahresplanung (letzte Änderung vor ' +
      Math.max(1, Math.round((Date.now() - Math.max(...busy.map(o => Date.parse(o.edit)))) / 60000)) + ' Min.). Bitte absprechen, wer ändert – sonst entstehen Konflikte.'),
    h('button', { onclick: () => { UI.presClosed = true; renderNow(); } }, 'Ausblenden')));
  const chk = BROKEN ? [] : checkData();
  if (chk.length && UI.checkSeen !== checkSig(chk)) out.append(h('div', { class: 'banner warn' },
    h('span', null, 'Datenprüfung: ' + chk.length + ' Auffälligkeit' + (chk.length === 1 ? '' : 'en') + ' in den Daten (z. B. ' + chk[0].text + '). Die App schlägt Reparaturen vor.'),
    h('button', { class: 'primary', onclick: checkDialog }, 'Ansehen …'),
    h('button', { onclick: () => { UI.checkSeen = checkSig(chk); saveUI(); renderNow(); } }, 'Ausblenden')));
  if (BROKEN) out.append(h('div', { class: 'banner err' },
    h('span', null, 'Die Planungsdaten dieser Datei sind beschädigt. Speichern ist gesperrt, damit nichts überschrieben wird.'),
    h('button', { class: 'primary', onclick: brokenDialog }, 'Wiederherstellen …')));
  if (ST.newer) out.append(h('div', { class: 'banner err' },
    h('span', null, 'Im Mailing-Ordner liegt eine neuere Programmversion (' + ST.newer.version + (ST.newer.by ? ', eingespielt von ' + ST.newer.by : '') + '). Dieses Fenster läuft noch mit Version ' + APP_INFO.version +
      ' und speichert deshalb nicht mehr – sonst käme die alte Version zurück.' + (isDirty() ? ' Deine ungespeicherten Änderungen werden nach dem Neustart angeboten.' : '')),
    h('button', { class: 'primary', onclick: reloadForNewer }, 'Jetzt neu starten')));
  if (FSA && ST.conn === 'ok' && inCopy() && ST.mainExists) out.append(h('div', { class: 'banner err' },
    h('span', null, 'Geöffnet ist „' + currentFileName() + '“ – eine Kopie. Die gemeinsame Planung steht in „' + DEFAULT_FILE + '“; Änderungen hier landen nur in der Kopie.'),
    h('button', { class: 'primary', onclick: openMainFile }, 'Hauptdatei öffnen')));
  for (const c of ST.copies.filter(c => !copyHidden(c))) out.append(h('div', { class: 'banner warn' },
    h('span', null, 'Im Mailing-Ordner liegt die Kopie „' + c.name + '“' + (c.meta.savedAt ? ' (gespeichert ' + fmtStamp(c.meta.savedAt) + (c.meta.savedBy ? ' von ' + c.meta.savedBy : '') + ')' : '') +
      (c.same ? ' – inhaltlich gleich wie hier.' : '. So etwas legt OneDrive an, wenn zwei Personen gleichzeitig gespeichert haben – darin können Änderungen stehen, die hier fehlen.')),
    h('button', { class: 'primary', onclick: () => handleCopy(c) }, c.same ? 'Wegräumen …' : 'Vergleichen …'),
    h('button', { onclick: () => { UI.copiesSeen = Object.assign({}, UI.copiesSeen, { [c.key]: 1 }); saveUI(); renderNow(); } }, 'Ausblenden')));
  if (ST.fail && isDirty() && ST.fail.n >= 2 && ST.conn === 'ok') out.append(h('div', { class: 'banner warn' },
    h('span', null, 'Speichern klappt gerade nicht (' + ST.fail.msg + '). Die App versucht es automatisch weiter; deine Änderungen sind so lange im Browser gesichert. ' +
      'Bleibt das so: prüfen, ob OneDrive läuft und die Datei nicht anderweitig geöffnet ist.'),
    h('button', { class: 'primary', onclick: () => saveAll({ manual: true }) }, 'Jetzt erneut versuchen')));
  if (ST.conflict) {
    const o = ST.conflict.other.meta || {};
    out.append(h('div', { class: 'banner err' },
      h('span', null, (o.savedBy || 'Jemand') + ' hat ' + fmtStamp(o.savedAt) + ' einen neueren Stand gespeichert, während du Änderungen gemacht hast. Am besten zusammenführen: Änderungen beider Seiten bleiben erhalten, bei Überschneidungen fragt die App nach.'),
      h('button', { class: 'primary', onclick: () => resolveConflict('merge') }, 'Zusammenführen …'),
      h('button', { onclick: () => resolveConflict('theirs') }, 'Nur Stand von ' + (o.savedBy || 'der Datei') + ' laden'),
      h('button', { onclick: () => resolveConflict('mine') }, 'Nur meinen Stand speichern')));
  } else if (FSA && ST.conn !== 'ok' && isDirty()) out.append(h('div', { class: 'banner warn' },
    h('span', null, 'Deine Änderungen sind noch nicht gespeichert.' + (ST.conn === 'needs-permission' ? ' Ein Klick genügt – der Browser fragt kurz, ob die App den Ordner bearbeiten darf.' : ' Einmal den Mailing-Ordner wählen, danach speichert die App automatisch.')),
    h('button', { class: 'primary', onclick: () => save() }, ST.conn === 'needs-permission' ? 'Speichern aktivieren' : 'Speicherort wählen')));
  if (ST.xlsxErr && !UI.xlsxErrClosed) out.append(h('div', { class: 'banner warn' },
    h('span', null, 'Die Excel-Ansicht „' + VIEW_XLSX + '“ konnte nicht aktualisiert werden (ist sie gerade in Excel geöffnet?). Das Programm selbst ist gespeichert; beim nächsten Speichern versucht es die App erneut.'),
    h('button', { onclick: () => { UI.xlsxErrClosed = true; renderNow(); } }, 'Ausblenden')));
  const mm = folderMismatch();
  if (mm) out.append(h('div', { class: 'banner err' },
    h('span', null, 'Achtung: Geöffnet ist die Datei aus „' + mm.opened + '“, gespeichert wird aber in den Ordner „' + mm.connected + '“. So arbeiten zwei Kopien aneinander vorbei.'),
    h('button', { class: 'primary', onclick: async () => { ST.conn = 'none'; ST.dir = null; ST.html = null; await connectFolder(); renderNow(); } }, 'Speicherort neu wählen')));
  if (openedFromDownloads() && !UI.dlHintClosed) out.append(h('div', { class: 'banner err' },
    h('span', null, 'Achtung: Diese Datei wurde aus dem Download-Ordner bzw. dem Browser geöffnet. Änderungen landen dann nicht im gemeinsamen Mailing-Ordner. ' +
      'Bitte schließen und über „Jahresplanung starten“ im (synchronisierten) Mailing-Ordner öffnen.'),
    h('button', { onclick: () => { UI.dlHintClosed = true; renderNow(); } }, 'Trotzdem hier arbeiten')));
  if (DRAFT_OFFER) out.append(h('div', { class: 'banner warn' },
    h('span', null, `In diesem Browser gibt es ungespeicherte Änderungen vom ${fmtStamp(DRAFT_OFFER.at)}.` +
      (DRAFT_OFFER.sameBase ? '' : ' Die Datei wurde seitdem neu gespeichert' + (D.meta.savedBy ? ' (von ' + D.meta.savedBy + ')' : '') + ' – beim Wiederherstellen werden beide Stände zusammengeführt.')),
    h('button', { class: 'primary', onclick: restoreDraft }, DRAFT_OFFER.sameBase ? 'Wiederherstellen' : 'Zusammenführen …'),
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
      items.map(it => it === false ? null : it ? h('button', { role: 'menuitem', onclick: () => { closeMenu(); it[1](); } }, it[0]) : h('hr')));   // false = weglassen, null = Trennlinie
    document.body.append(m);
    placeMenu(m, btn.getBoundingClientRect(), align);
    _openMenu = { m, btn, at: performance.now() };
  });
  return btn;
}
// Klick auf eine Markierung (S, I, D, P …) oder eine Zeile der Terminliste hält die Maßnahme hervorgehoben;
// „Bearbeiten“ steht dann hinter jeder Zeile dieser Maßnahme in der Terminliste (ohne Terminliste unter der Markierung)
const clearPinMarks = () => { $$('.mline-edit').forEach(b => b.remove()); $$('.mline.pinned, .chip.pinned').forEach(l => l.classList.remove('pinned')); };
function markPinned(id, chipEl) {
  clearPinMarks();
  if (chipEl) chipEl.classList.add('pinned');
  const lines = $$('.mline[data-m="' + CSS.escape(id) + '"]');
  lines.forEach(l => { l.classList.add('pinned'); l.append(pinEditBtn(id)); });
  if (!lines.length && chipEl) { const cell = chipEl.closest('.day'); if (cell) cell.append(pinEditBtn(id, 'chip-edit')); }
}
function pinMassnahme(el, id, month) {
  UI.pin = id; UI.pinMonth = month; UI.pinDay = null; UI.pinT = null;
  markPinned(id, null);
  highlight(id);
}
function pinChip(el, id, n, t) {
  UI.pin = id; UI.pinMonth = null; UI.pinDay = n; UI.pinT = t;
  markPinned(id, el);
  highlight(id);
}
const pinEditBtn = (id, cls = '') => h('button', { class: 'mline-edit ' + cls, tip: 'Maßnahme bearbeiten', onclick: e => { e.stopPropagation(); editMassnahme(id); } }, 'Bearbeiten');
function unpin() {
  if (!UI.pin) return;
  UI.pin = null; UI.pinMonth = null; UI.pinDay = null; UI.pinT = null;
  clearPinMarks();
  highlight(null);
}
document.addEventListener('click', e => { if (UI.pin && !e.target.closest('.mline, .chip, .mline-edit, .modal, .backdrop, .menu')) unpin(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.pin && !$('.modal')) unpin(); });
function closeMenu() { if (_openMenu) { _openMenu.m.remove(); _openMenu = null; } }
document.addEventListener('click', () => closeMenu());
// Menüs stehen fest am Bildschirm: beim Scrollen der Seite (nicht im Menü selbst) schließen
document.addEventListener('scroll', e => { if (_openMenu && performance.now() - (_openMenu.at || 0) > 300 && !(e.target instanceof Node && _openMenu.m.contains(e.target))) closeMenu(); }, true);
// Warnliste beginnt unter der Kopfzeile – die kann bei 150 % Skalierung zweizeilig sein
function syncTopHeight() { const t = $('header.top'); if (t) document.documentElement.style.setProperty('--toph', Math.round(t.getBoundingClientRect().height) + 'px'); }
window.addEventListener('resize', syncTopHeight);

/* ---------- Seitenleiste: was wird angezeigt? */
function highlight(id) {
  const main = $('#main'); if (!main) return;
  if (!id && UI.pin && UI.view === 'jahr' && C.byId.has(UI.pin)) id = UI.pin;   // nach dem Überfahren zurück zur festgehaltenen Maßnahme
  main.classList.toggle('hl', !!id);
  $$('[data-m]', main).forEach(e => e.classList.toggle('hl-on', e.dataset.m === id));
  $$('.day.span', main).forEach(c => { c.classList.remove('span'); c.style.removeProperty('--hcl'); c.style.removeProperty('--hcr'); });
  const x = id && C.byId.get(id);
  if (!x || UI.verbund) return;                  // Verbund-Darstellung: die eigene Linie wird per CSS betont
  const pts = [...Object.values(x.st), x.pal].filter(v => v != null).sort((p, q) => p - q);
  if (pts.length < 2) return;
  const a = Math.min(...pts), b = Math.max(...pts), cells = new Map($$('.day[data-dn]', main).map(c => [+c.dataset.dn, c]));
  for (let n = a; n <= b; n++) {
    const c = cells.get(n); if (!c) continue;
    const [l, r] = lineHalves(n, pts, x.color);
    c.classList.add('span'); c.style.setProperty('--hcl', l); c.style.setProperty('--hcr', r);
  }
}
function sideBar() {
  const y = UI.year;
  const ms = C.ms.filter(x => inYear(x, y));
  const typeBtn = (t, label) => h('label', { class: 'tchk' }, h('input', { type: 'checkbox', checked: showType(t), onchange: e => { UI.show[t] = e.target.checked; renderNow(); } }),
    h('span', { class: 'chip demo ' + (t === 'P' ? 'P' : 'ph') }, t), label);
  const persons = [...new Set([...D.personen.map(p => p.name), ...C.vac.map(v => v.u.wer).filter(Boolean)])];
  return h('aside', { class: 'side' },
    h('button', { class: 'icon collapse', tip: 'Seitenleiste ausblenden', onclick: () => { UI.sidebar = false; renderNow(); } }, '«'),
    h('section', null, h('h3', null, 'Termine anzeigen'), evKeys().map(t => typeBtn(t, TYPE_LABEL[t]))),
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
// Termin auf den Arbeitstag davor legen (bei Detailplänen passt sich die Dauer eines Schritts an)
function applyFix(d, w) {
  const m = findM(d, w.mid), pal = dn(m && m.pal);
  if (!m || pal == null) return false;
  if (w.fix.t === 'P') { m.pal = ds(w.fix.to); return true; }
  if (m.plan) return !!adjustMark(m, w.fix.t, w.fix.to);
  m.vorlauf = Object.assign({}, m.vorlauf, { [w.fix.t]: pal - w.fix.to });
  return true;
}
const FIX_LABEL = new Proxy({}, { get: (o, t) => startLabel(t) });
// Vorziehen in Runden: erst alle PAL-Termine (sie verschieben S und I mit), dann S/I neu prüfen – bis nichts mehr übrig ist.
// Nur innerhalb von commit aufrufen (d ist dann D, derive() rechnet mit dem geänderten Stand).
function fixRounds(d, mids, types) {
  let n = 0;
  for (let round = 0; round < 8; round++) {
    derive();
    const ws = C.warnings.filter(w => w.fix && mids.has(w.mid) && (!types || types(w)));
    if (!ws.length) break;
    const ps = ws.filter(w => w.fix.t === 'P'), batch = (ps.length ? ps : ws).slice().sort((a, b) => (b.n ?? 0) - (a.n ?? 0));   // späteste zuerst
    let done = 0;
    for (const w of batch) if (applyFix(d, w)) done++;
    n += done;
    if (!done) break;
  }
  return n;
}
function fixDate(w) {
  const x = C.byId.get(w.mid); if (!x) return;
  const had = new Set(C.warnings.filter(q => q.mid === w.mid && q.fix).map(q => q.fix.t));
  const st0 = Object.assign({}, x.st);
  commit(d => {
    if (!applyFix(d, w) || w.fix.t !== 'P') return;
    // PAL vorgezogen: S und I wandern mit – rutschen sie dadurch neu aufs Wochenende, gleich mit vorziehen
    fixRounds(d, new Set([w.mid]), q => q.fix.t !== 'P' && !had.has(q.fix.t));
  });
  derive();
  const y = C.byId.get(w.mid), more = y ? PH().map(p => [p.key, st0[p.key], y.st[p.key]]).filter(([t, a, b]) => w.fix.t === 'P' && a != null && b != null && b !== a - (x.pal - y.pal)) : [];
  toast(x.m.name + ': ' + FIX_LABEL[w.fix.t] + ' → ' + fmtW(w.fix.to) + (more.length ? ' · ' + more.map(([t, , b]) => FIX_LABEL[t] + ' → ' + fmtW(b)).join(' · ') : '') +
    (x.m.plan && (w.fix.t !== 'P' || more.length) ? ' (Dauer im Detailplan angepasst)' : ''));
}
async function fixAll(list) {
  if (!await confirmBox('Alle vorziehen', list.length + ' Termine werden auf den jeweils vorherigen Arbeitstag gelegt (ein PAL auf Samstag bleibt erlaubt). Zuerst die PAL-Termine, danach Start Selektion und Start Inhalt – so landet nichts neu am Wochenende. Bei Detailplänen passt sich die Dauer eines Arbeitsschritts an. Strg+Z macht es rückgängig.', 'Vorziehen')) return;
  const mids = new Set(list.map(w => w.mid));
  let n = 0;
  commit(d => { n = fixRounds(d, mids); });
  derive();
  const left = C.warnings.filter(w => w.fix && mids.has(w.mid)).length;
  toast(n + ' Termin' + (n === 1 ? '' : 'e') + ' vorgezogen' + (left ? ' – ' + left + ' ließ' + (left === 1 ? '' : 'en') + ' sich nicht automatisch lösen (siehe Warnungen)' : ''), left ? 'warn' : 'ok');
}
function warnPanel() {
  const W = C.warnings, warn = W.filter(w => w.lvl === 'warn'), info = W.filter(w => w.lvl !== 'warn');
  const vorl = C.ms.filter(x => x.pal != null && ymd(x.pal)[0] === UI.year && x.m.palStatus !== 'fest').length;
  const item = w => h('div', { class: 'witem ' + w.lvl },
    h('button', { class: 'wtext', onclick: () => goTo(w) }, w.text),
    w.fix ? h('button', { class: 'wfix', tip: w.fix.t === 'P' ? 'PAL auf den Tag davor legen (Samstag ist erlaubt)' : 'Termin auf den vorherigen Arbeitstag legen', onclick: () => fixDate(w) }, 'auf ' + fmtWS(w.fix.to) + ' vorziehen') : null);
  return h('aside', { class: 'warnpanel' },
    h('header', null, h('h2', null, 'Warnungen ' + UI.year), h('button', { class: 'icon', 'aria-label': 'Schließen', onclick: () => { UI.warnOpen = false; renderNow(); } }, '✕')),
    h('div', { class: 'wbody' },
      vorl ? h('p', { class: 'wsum' }, vorl + ' PAL-Termine sind noch vorläufig.') : null,
      warn.length ? [h('h3', null, 'Bitte prüfen (' + warn.length + ')'),
        warn.filter(w => w.fix).length > 1 ? h('button', { class: 'fixall', onclick: () => fixAll(warn.filter(w => w.fix)) }, 'Alle ' + warn.filter(w => w.fix).length + ' Termine am Wochenende/Feiertag auf den Arbeitstag davor legen') : null,
        warn.map(item)] : h('p', { class: 'ok' }, '✓ Keine Konflikte gefunden.'),
      info.length ? [h('h3', null, 'Hinweise (' + info.length + ')'), info.map(item)] : null,
      h('p', { class: 'muted small' }, 'Geprüft werden: Starts am Wochenende oder Feiertag, PAL an Sonn-/Feiertagen, Termine im Urlaub der hauptverantwortlichen Person, ' +
        'Arbeitsschritte im Urlaub der zugeordneten Person und überfällige Schritte.')));
}

/* ---------- Einstellungen, Hilfe */
/* ---------- Darstellung: hell / dunkel / wie Windows */
const MQ_DARK = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const t = UI.theme || 'light';
  DARK = t === 'dark' || (t === 'system' && !!MQ_DARK && MQ_DARK.matches);
  document.documentElement.dataset.theme = DARK ? 'dark' : 'light';
}
if (MQ_DARK && MQ_DARK.addEventListener) MQ_DARK.addEventListener('change', () => { if (UI.theme === 'system') { applyTheme(); renderNow(); } });
function setTheme(t) { UI.theme = t; saveUI(); applyTheme(); renderNow(); }
const fmtIsoLocal = s => { if (!s) return '–'; const [d, t] = s.split('T'); const [y, m, dd] = d.split('-'); return dd + '.' + m + '.' + y + (t ? ', ' + t.slice(0, 5) + ' Uhr' : ''); };

/* ---------- Bereiche verwalten */
function bUsage(k) {
  const m = D.massnahmen.filter(q => !q.plan && q.vorlauf && isNum(q.vorlauf[k])).length, pl = D.massnahmen.filter(q => q.plan && q.plan.steps.some(s => s.typ === 'gruppe' && s.bereich === k)).length;
  return [m ? m + ' Maßnahme' + (m > 1 ? 'n' : '') : '', pl ? pl + ' Detailpl' + (pl > 1 ? 'äne' : 'an') : ''].filter(Boolean).join(' · ');
}
async function removeBereich(k) {
  const u = bUsage(k);
  if (!await confirmBox('Bereich entfernen', 'Bereich „' + k + ' · ' + phName(k) + '“ entfernen?' + (u ? ' Er wird bei ' + u + ' verwendet: die Starts dieses Bereichs werden gelöscht, Abschnitte in Detailplänen verlieren die Zuordnung (die Arbeitsschritte bleiben).' : ''), 'Entfernen')) return;
  commit(d => {
    d.settings.bereiche = d.settings.bereiche.filter(q => q.key !== k);
    for (const m of d.massnahmen) {
      if (m.vorlauf) delete m.vorlauf[k];
      if (m.ende) delete m.ende[k];
      if (m.plan) { m.plan.steps.forEach(s => { if (s.bereich === k) delete s.bereich; }); if (m.plan.marks) delete m.plan.marks[k]; }
    }
  }, 'Bereich ' + k + ' entfernt');
}

/* ---------- Einstellungen: alles wirkt sofort, Personen hier zentral verwalten */
async function settingsDialog() {
  const wrap = h('div', { class: 'form settings' });
  let showLog = false, newName = '', newKey = '', newBName = '';
  const row = (label, inp, hint) => h('div', { class: 'frow' }, h('span', null, label), inp, hint ? h('small', null, hint) : null);
  const usage = n => {
    const u = D.urlaube.filter(v => v.wer === n).length, m = D.massnahmen.filter(q => q.verantwortlich === n).length,
      st = D.massnahmen.reduce((a, q) => a + (q.plan?.steps || []).filter(s => s.wer === n && s.typ !== 'gruppe').length, 0);
    return [u ? u + ' Urlaub' + (u > 1 ? 'e' : '') : '', m ? m + '× hauptverantwortlich' : '', st ? st + ' Schritt' + (st > 1 ? 'e' : '') : ''].filter(Boolean).join(' · ');
  };
  const draw = () => {
    const theme = UI.theme || 'light';
    const radio = (v, l) => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'theme', checked: theme === v, onchange: () => { setTheme(v); draw(); } }), l);
    setKids(wrap, 
      h('h3', null, 'Allgemein'),
      row('Dein Name', h('input', { value: UI.userName || '', onchange: e => { UI.userName = e.target.value.trim(); saveUI(); } }), 'wird beim Speichern vermerkt („gespeichert von …“), nur in diesem Browser'),
      row('Planungsjahr', h('input', { type: 'number', min: 2000, max: 2099, value: D.settings.year, onchange: e => { const v = +e.target.value; if (v >= 2000 && v <= 2099) commit(d => { d.settings.year = v; }); } }),
        'mit diesem Jahr öffnet die App; die Excel-Ansicht in Teams zeigt immer dieses Jahr'),
      h('h3', null, 'Darstellung'),
      h('div', { class: 'inl theme-pick' }, radio('light', 'Hell'), radio('dark', 'Dunkel'), radio('system', 'wie Windows')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: UI.splash !== false, onchange: e => { UI.splash = e.target.checked; saveUI(); } }), 'Startbildschirm mit Animation beim Öffnen zeigen'),
      h('h3', null, 'Bereiche'),
      h('p', { class: 'muted small' }, 'Die Phasen jeder Maßnahme bis zum PAL, in zeitlicher Reihenfolge. Der Buchstabe erscheint im Kalender, in der Zeitleiste und in der Tabelle; im Detailplan wird jeder Abschnitt einem Bereich zugeordnet. Ohne eigenes Ende läuft ein Bereich bis zum nächsten Start. P ist für das PAL reserviert.'),
      h('table', { class: 'grid ptable btable' }, h('tbody', null, PH().map((b, i) => h('tr', null,
        h('td', { class: 'pcol' }, h('span', { class: 'chip demo ph' }, b.key)),
        h('td', null, h('input', { value: b.name, 'aria-label': 'Name des Bereichs ' + b.key, onchange: e => { const nv = e.target.value.trim(); if (nv) commit(d => { d.settings.bereiche[i].name = nv; }); draw(); } })),
        h('td', { class: 'muted small' }, bUsage(b.key) || 'nicht verwendet'),
        h('td', { class: 'acts' },
          h('button', { class: 'icon', tip: 'früher', 'aria-label': 'früher', 'data-repeat': true, disabled: i === 0, onclick: () => { commit(d => { const l = d.settings.bereiche; [l[i - 1], l[i]] = [l[i], l[i - 1]]; }); draw(); } }, '↑'),
          h('button', { class: 'icon', tip: 'später', 'aria-label': 'später', 'data-repeat': true, disabled: i === PH().length - 1, onclick: () => { commit(d => { const l = d.settings.bereiche; [l[i + 1], l[i]] = [l[i], l[i + 1]]; }); draw(); } }, '↓'),
          h('button', { class: 'icon', tip: 'entfernen', 'aria-label': 'entfernen', onclick: async () => { await removeBereich(b.key); draw(); } }, '✕')))))),
      h('div', { class: 'inl addline' },
        h('input', { placeholder: 'Buchstabe', maxlength: 1, style: 'width:86px', value: newKey, oninput: e => { newKey = e.target.value.toUpperCase(); e.target.value = newKey; } }),
        h('input', { placeholder: 'Name, z. B. Versand', value: newBName, oninput: e => { newBName = e.target.value; }, onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addB(); } } }),
        h('button', { class: 'addbtn', onclick: e => { e.preventDefault(); addB(); } }, '+ Bereich hinzufügen')),
      h('h3', null, 'Personen'),
      h('p', { class: 'muted small' }, 'Die Farbe gilt für Urlaube und Arbeitsschritte. Umbenennen ändert den Namen überall (Urlaube, Hauptverantwortliche, Arbeitsschritte).'),
      h('table', { class: 'grid ptable' }, h('tbody', null, D.personen.map(p => {
        const used = usage(p.name);
        return h('tr', null,
          h('td', { class: 'pcol' }, h('input', { type: 'color', value: p.farbe, 'aria-label': 'Farbe von ' + p.name, onchange: e => { commit(d => { d.personen.find(q => q.name === p.name).farbe = e.target.value; }); draw(); } })),
          h('td', null, h('input', { value: p.name, 'aria-label': 'Name', onchange: e => { renamePersonTo(p.name, e.target.value); draw(); } })),
          h('td', { class: 'muted small' }, used || 'nicht verwendet'),
          h('td', { class: 'acts' }, used ? null : h('button', { class: 'icon', tip: 'entfernen', 'aria-label': 'entfernen', onclick: () => { commit(d => { d.personen = d.personen.filter(q => q.name !== p.name); }); draw(); } }, '✕')));
      }))),
      h('div', { class: 'inl addline' }, h('input', { placeholder: 'neue Person', value: newName, oninput: e => { newName = e.target.value; },
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addP(); } } }), h('button', { class: 'addbtn', onclick: e => { e.preventDefault(); addP(); } }, '+ Person hinzufügen')),
      h('h3', null, 'Version'),
      h('div', { class: 'verbox' },
        h('div', null, h('b', null, 'Programmversion ' + APP_INFO.version), h('span', { class: 'muted' }, ' · Stand ' + fmtIsoLocal(APP_INFO.date))),
        h('div', { class: 'muted small' }, 'Geöffnete Datei: ' + (localPath() || location.href)),
        h('div', { class: 'muted small' + (folderMismatch() ? ' warn' : '') }, 'Speichert in: ' + (ST.conn === 'ok' && ST.dir ? 'Ordner „' + ST.dir.name + '“' + (folderMismatch() ? ' – passt nicht zur geöffneten Datei!' : '') : ST.conn === 'needs-permission' ? 'Ordner „' + (ST.dir ? ST.dir.name : '?') + '“ (Freigabe fehlt noch)' : 'noch kein Speicherort gewählt')),
        h('div', { class: 'muted small' }, 'Datenstand Nr. ' + (+D.meta.rev || 0) + (D.meta.savedAt ? ' · zuletzt gespeichert ' + fmtStamp(D.meta.savedAt) + (D.meta.savedBy ? ' von ' + D.meta.savedBy : '') : ' · noch nicht gespeichert')),
        h('button', { class: 'link', onclick: e => { e.preventDefault(); showLog = !showLog; draw(); } }, showLog ? 'Änderungen ausblenden' : 'Was ist neu? (Änderungen anzeigen)')),
      showLog ? h('div', { class: 'changelog' }, CHANGELOG.map(c => h('div', { class: 'cl-v' },
        h('div', { class: 'cl-h' }, h('b', null, 'Version ' + c.version), h('span', { class: 'muted small' }, ' · ' + fmtIsoLocal(c.date))),
        h('ul', null, c.items.map(t => h('li', null, t)))))) : null);
  };
  const addB = () => {
    const k = newKey.trim().toUpperCase(), nm = newBName.trim();
    if (!PHASE_KEY_RE.test(k)) { toast('Bitte einen Buchstaben A–Z wählen (P ist für das PAL reserviert).', 'warn'); return; }
    if (PH().some(q => q.key === k)) { toast('„' + k + '“ ist schon vergeben.', 'warn'); return; }
    if (!nm) { toast('Bitte einen Namen für den Bereich eingeben.', 'warn'); return; }
    commit(d => { d.settings.bereiche.push({ key: k, name: nm, vorlauf: null }); }, 'Bereich ' + k + ' · ' + nm + ' angelegt');
    newKey = ''; newBName = ''; draw();
  };
  const addP = () => {
    const nv = newName.trim(); if (!nv) return;
    if (D.personen.some(q => q.name === nv)) { toast('„' + nv + '“ gibt es schon.', 'warn'); return; }
    commit(d => { const used = new Set(d.personen.map(q => q.farbe)); d.personen.push({ name: nv, farbe: PERSON_COLORS.find(c => !used.has(c)) || '#888888' }); });
    newName = ''; draw();
  };
  draw();
  await modal('Einstellungen', wrap, [['Schließen', true, 'primary']], { wide: true });
  renderNow();
}
function helpDialog() {
  const p = t => h('p', null, t);
  modal('Hilfe', h('div', { class: 'help' },
    h('h3', null, 'Starten'),
    p('Im Mailing-Ordner auf „Jahresplanung starten“ doppelklicken – das Programm öffnet sich in einem eigenen Fenster. Geht das nicht (z. B. weil die IT Startdateien sperrt), im Unterordner „Jahresplanung (Programmdatei)“ die HTML-Datei doppelklicken.'),
    p('Wer den Ordner nur in Teams oder im Browser sieht: einmalig in Teams unter „Dateien“ auf „Synchronisieren“ klicken. Danach liegt der Ordner im Windows-Explorer und der Start funktioniert. Direkt aus der Teams-/SharePoint-Weboberfläche läuft das Programm nicht.'),
    h('h3', null, 'Speichern'),
    p('Beim ersten Mal einmal den Mailing-Ordner wählen und „Bearbeiten zulassen“. Danach speichert die App automatisch wenige Sekunden nach jeder Änderung – in die Programmdatei und in die Ansichts-Excel „' + VIEW_XLSX + '“. Bei jedem neuen Start fragt der Browser einmal kurz nach („Speichern aktivieren“).'),
    p('Die Excel-Ansicht ist für alle, die nur in Teams hineinschauen: Sie zeigt immer den zuletzt gespeicherten Stand (Übersicht, Kalender, Zeitleiste, Termine, Detailpläne, Urlaub). Sie ist schreibgeschützt; Änderungen dort würden beim nächsten Speichern überschrieben.'),
    h('h3', null, 'Im Team'),
    p('Es sollte immer nur eine Person gleichzeitig ändern. Die App prüft alle 15 Sekunden, ob jemand anderes gespeichert hat: Ohne eigene offene Änderungen lädt sie den neuen Stand automatisch, sonst bietet sie an, beide Stände zusammenzuführen (bei Überschneidungen fragt sie nach).'),
    p('Haben zwei Personen fast gleichzeitig gespeichert, legt OneDrive manchmal eine Kopie mit dem Computernamen an (z. B. „…-LAPTOP.html“). Die App meldet solche Kopien; über „Vergleichen …“ lassen sich fehlende Einträge übernehmen, danach wird die Kopie weggeräumt.'),
    p('Nach einem Programm-Update bitte alle offenen App-Fenster schließen und neu öffnen. Ein Fenster mit älterer Version merkt das und speichert nicht mehr, bis es neu gestartet wurde.'),
    p('Oben rechts zeigt „👥 Name“, wer die Jahresplanung gerade ebenfalls geöffnet hat (über OneDrive, kann etwa eine Minute nachhinken). Unter ⋯ → „Änderungsprotokoll“ steht, wer wann was geändert hat.'),
    h('h3', null, 'Bereiche'),
    p('Jede Maßnahme läuft in Bereichen auf das PAL zu – ' + PH().map(q => q.key + ' = ' + q.name).join(', ') + ', P = PAL. Ein Bereich beginnt an seinem Start und läuft bis zum nächsten Start (der letzte bis zum PAL); im Bearbeiten-Fenster kann er ein eigenes Ende bekommen. In den Einstellungen lassen sich Bereiche umbenennen, umsortieren und neue mit eigenem Buchstaben anlegen. In der Tabelle zeigt der Umschalter „📅 Datum | ⏱ Werktage“ die Starts als Datum oder als Werktage bis zum PAL.'),
    p('Im Detailplan gehört jeder Abschnitt zu einem Bereich (Auswahl am Abschnitt). Der früheste Schritt des Abschnitts ist dessen Start – oder der Schritt, der im ⋯-Menü als „Beginn“ festgelegt ist.'),
    h('h3', null, 'Datenschutz'),
    p('Die App arbeitet komplett offline: Es werden keine Daten ins Internet gesendet und nichts nachgeladen. Wer die Datei hat, sieht alle Daten – also nur intern ablegen.'),
    h('h3', null, 'Bedienung'),
    p('Jahresplanung: oben die Maßnahmen, darunter der Kalender – beide Bereiche lassen sich mit ▾ ein- und ausklappen. Maus über einen Tag oder eine Markierung zeigt die Details. Markierung ziehen: P verschiebt das ganze Projekt (alle Bereiche wandern mit), ein Start verschiebt nur diesen Bereich. Klick hält die Maßnahme hervorgehoben, „Bearbeiten“ steht dann hinter ihren Zeilen in der Terminliste.'),
    p('Zeitleiste: Mausrad zoomt, Klick auf einen Monat zoomt hinein, Klick auf den Namen einer Maßnahme zeigt sie ganz. Mit gedrückter Maus auf freier Fläche nach links/rechts schieben. Balken ziehen verschiebt den PAL, die Griffe mit Buchstaben verschieben nur diesen Start. Darunter „Was steht an?“. Strg+Z macht jede Änderung rückgängig.'),
    p('Detailpläne: Abschnitte mit ▾ ein- und ausklappen, Zeilen am ⋮⋮-Griff hoch/runter ziehen. Balken im Gantt ziehen verschiebt den Schritt, an den Enden ziehen ändert die Dauer; die Farbe zeigt, wer zugeordnet ist. ‹ zwischen Tabelle und Gantt blendet die Spalten aus.'),
    p('Maßnahmen mit Detailplan (z. B. Sommer- und Weihnachtsmailing) berechnen die Starts der Bereiche aus den Arbeitsschritten – wie im Excel-Gantt.')), null, { wide: true });
}

/* ---------- Tastatur */
document.addEventListener('keydown', e => {
  if (DRAG) return;
  const k = e.key.toLowerCase(), inField = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
  if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); if ($('.modal')) return; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); setTimeout(() => save(), 30); }
  else if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey && !inField) { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey)) && !inField) { e.preventDefault(); redo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'p' && !$('.modal')) { e.preventDefault(); pdfDialog(); }
});
window.addEventListener('beforeunload', e => { if (D && isDirty() && !window.__jpReload) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('beforeprint', () => { if (!UI.printing) { UI.printing = true; renderNow(); } });
