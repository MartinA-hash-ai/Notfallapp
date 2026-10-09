/* ===================================================================== Rahmen: Kopfzeile, Reiter, Seitenleiste, Warnungen, Menüs */

// Drei Reiter: planen (Jahresplanung), durchführen (Detailpläne), auswerten (Auswertung). Urlaub & Feiertage und Vorlagen in den Einstellungen (⋯).
const VIEWS = [['jahr', 'Jahresplanung'], ['plaene', 'Detailpläne'], ['spenden', 'Auswertung']];
const OLD_VIEWS = { kalender: 'jahr', massnahmen: 'jahr', zeitleiste: 'jahr', agenda: 'jahr', zeit: 'jahr' };
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
  const win = [scrollX, scrollY];                           // Fensterposition: beim Neuzeichnen mit Fokus in einem Eingabefeld verschiebt der Browser sonst die Seite
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
  if (UI.view !== 'spenden') _spLastView = UI.view;
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
  if (scrollX !== win[0] || scrollY !== win[1]) scrollTo(win[0], win[1]);   // erst nach dem Kopf (layoutHeader), sonst ist die Seite kurz zu kurz
  (VIEW_FN[UI.view + ':after'] || (() => {}))(main);
  flashTarget();
  saveUI();
}

function topBar() {
  const dirty = isDirty(), nW = C.warnings.filter(w => w.lvl === 'warn').length, nI = C.warnings.length - nW;
  const pend = SP.rows.length ? spCompute().pend : 0;           // Spenden, die auf Prüfung warten
  const tab = ([k, label]) => h('button', { class: 'tab' + (UI.view === k ? ' on' : ''), onclick: () => { UI.view = k; renderNow(); $('#main').scrollTop = 0; } }, label,
    k === 'spenden' && pend ? h('span', { class: 'tab-badge', tip: pend + (pend === 1 ? ' Spende wartet' : ' Spenden warten') + ' zum Prüfen auf die Zuordnung' }, pend) : null);
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
        ['Excel-Datei (.xlsx)', exportExcel], ['Outlook-Kalender (.ics)', exportICS]]),
      presenceChip(),
      saveBox(),
      menuButton('⋯', [                                   // ab 0.15 schlank: Speicherort und Protokoll in den Einstellungen, Speichern immer automatisch
        ['Daten prüfen …', checkDialog], ['Daten zurücksetzen …', resetDialog], null,
        [(DARK ? '☀ Helles Design' : '☾ Dunkles Design'), () => setTheme(DARK ? 'light' : 'dark')],
        ['Programm-Update einspielen …', updateProgram], null,
        ['Einstellungen …', () => openSettings()]], 'right')));
}
// Daten zurücksetzen: Spenden-Zuordnungen, Exportdateien, Maßnahmen eines Jahres. Einstellungen bleiben; vorher Datensicherung.
async function resetDialog() {
  if (BROKEN) { toast('Erst die beschädigten Daten wiederherstellen (Hinweis oben).', 'err'); return; }
  const S = D.spenden, nZu = Object.keys(S.zu).length, nVor = Object.keys(S.vor).length, nAllg = Object.keys(S.allg || {}).length, nZw = Object.keys(S.zweck || {}).length;
  const files = [];
  if (FSA && ST.conn === 'ok') {
    const walk = async (dh, depth) => { for await (const [n, e] of dh.entries()) { if (e.kind === 'file' && SP_FILE_RE.test(n) && !/^(~\$|\.)/.test(n)) files.push({ dir: dh, name: n, label: dh.name + '/' + n }); else if (e.kind === 'directory' && depth < 1) await walk(e, depth + 1); } };
    try { for (const d of await spDirs()) await walk(d.h, 0); } catch (e) { console.warn(e); }
    files.sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }
  const years = [...new Set(C.ms.filter(x => x.pal != null).map(x => ymd(x.pal)[0]))].sort();
  const ofYear = y => C.ms.filter(x => x.pal != null && ymd(x.pal)[0] === y);
  const opt = { sp: nZu + nVor + nAllg + nZw > 0, rules: false, files: false, ms: false, year: years.includes(UI.year) ? UI.year : years[years.length - 1] };
  const msInfo = h('div', { class: 'muted small rs-ms' });
  const showMs = () => { const l = ofYear(opt.year); setKids(msInfo, l.length ? l.length + ' Maßnahme' + (l.length === 1 ? '' : 'n') + ': ' + l.map(x => x.m.name || '(ohne Namen)').join(', ') + (l.some(x => x.m.plan) ? ' – samt Detailplänen' : '') : 'keine Maßnahme in diesem Jahr'); };
  const cb = (k, label, sub, dis) => h('label', { class: 'check rs-opt' + (dis ? ' muted' : '') }, h('input', { type: 'checkbox', checked: opt[k], disabled: !!dis, onchange: e => { opt[k] = e.target.checked; } }), h('span', null, h('b', null, label), sub ? h('div', { class: 'muted small' }, sub) : null));
  showMs();
  const body = h('div', { class: 'form rs' },
    h('p', null, 'Vorher lädt die App automatisch eine Datensicherung (.json) herunter. Bereiche, Personen, Urlaube, Feiertage und Einstellungen bleiben. Das betrifft die gemeinsame Datei – also alle.'),
    cb('sp', 'Alle Spenden-Zuordnungen entfernen', nZu + ' zugeordnet, ' + nVor + ' von Hand in „Prüfen“' + (nAllg ? ', Regeln der allgemeinen Spenden (' + nAllg + ' Jahr' + (nAllg === 1 ? '' : 'e') + ')' : '') + (nZw ? ', ' + nZw + ' von Hand festgelegte Zwecke' : '') + ' – in allen Jahren; Auflage und Kosten der Maßnahmen und die Spendenzwecke selbst bleiben', !(nZu + nVor + nAllg + nZw)),
    cb('rules', 'Auch die Schlagwort-Regeln der Maßnahmen entfernen', null, !D.massnahmen.some(m => m.regel)),
    cb('files', 'Exportdateien der Spendeneingänge löschen', files.length ? files.length + ' Datei' + (files.length === 1 ? '' : 'en') + ': ' + files.map(f => f.label).join(', ') + ' – sie landen im Papierkorb von OneDrive/SharePoint. Ohne das tauchen die Spenden wieder unter „Offen“ auf.' : 'keine Dateien gefunden' + (ST.conn !== 'ok' ? ' (Mailing-Ordner nicht verbunden)' : ''), !files.length),
    h('div', { class: 'rs-yr' }, cb('ms', 'Maßnahmen löschen mit PAL im Jahr', null, !years.length),
      years.length ? h('select', { onchange: e => { opt.year = +e.target.value; showMs(); } }, years.map(y => h('option', { value: y, selected: y === opt.year }, y))) : null),
    msInfo);
  if (!await modal('Daten zurücksetzen', body, [['Abbrechen', false], ['Zurücksetzen …', true, 'danger']])) return;
  const del = opt.ms ? ofYear(opt.year).map(x => x.id) : [];
  const what = [opt.sp ? 'alle Spenden-Zuordnungen' : '', opt.rules ? 'die Schlagwort-Regeln' : '', opt.files ? files.length + ' Exportdatei(en)' : '', del.length ? del.length + ' Maßnahme(n) aus ' + opt.year : ''].filter(Boolean);
  if (!what.length) { toast('Nichts ausgewählt.'); return; }
  if (!await confirmBox('Wirklich zurücksetzen?', 'Entfernt werden: ' + what.join(', ') + '. Eine Datensicherung wird vorher heruntergeladen' + (opt.files ? '; gelöschte Dateien liegen im Papierkorb von OneDrive/SharePoint' : '') + '.', 'Ja, zurücksetzen')) return;
  exportJSON();
  commit(d => {
    if (opt.sp) { d.spenden.zu = {}; d.spenden.vor = {}; d.spenden.nein = {}; d.spenden.allg = {}; d.spenden.zweck = {}; }
    if (opt.rules) d.massnahmen.forEach(m => { delete m.regel; });
    if (del.length) { d.massnahmen = d.massnahmen.filter(m => !del.includes(m.id)); del.forEach(id => spForget(d, id)); }
  }, 'Zurückgesetzt: ' + what.join(', '));
  let gone = 0;
  if (opt.files) for (const f of files) { try { await f.dir.removeEntry(f.name); gone++; } catch (e) { console.warn(e); } }
  if (opt.files) { SP.cache.clear(); SP.at = null; await spScan(); }
  renderNow();
  toast('Zurückgesetzt: ' + what.join(', ') + (opt.files && gone < files.length ? ' – ' + (files.length - gone) + ' Datei(en) ließen sich nicht löschen' : '') + '.', gone < files.length && opt.files ? 'warn' : 'ok');
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
  if (!FSA && !UI.brwHidden && !UI.printing) out.append(h('div', { class: 'banner warn brw-banner' },   // Firefox, Safari, Brave: kein Speichern in den Ordner
    h('span', null, browserName() + ' kann nicht direkt in den Mailing-Ordner speichern – Änderungen landen nur als Download, die anderen sehen sie nicht. Die Jahresplanung braucht Microsoft Edge oder Google Chrome.'),
    h('button', { class: 'primary', onclick: browserDialog }, 'Edge oder Chrome als Standardbrowser …'),
    h('button', { onclick: () => { UI.brwHidden = true; renderNow(); } }, 'Ausblenden')));
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
  const zb = zipBanner(); if (zb) out.append(zb);
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
      'Bitte schließen und „' + DEFAULT_FILE + '“ im (synchronisierten) Mailing-Ordner im Windows-Explorer öffnen.'),
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
  highlight(id); syncVisBoxes();
}
function pinChip(el, id, n, t) {
  UI.pin = id; UI.pinMonth = null; UI.pinDay = n; UI.pinT = t;
  markPinned(id, el);
  highlight(id); syncVisBoxes();
}
// „Bearbeiten“ im Kalender: zum Detailplan – gibt es noch keinen, das Fenster zum Anlegen (Einfach / Komplex / Kopie)
function openPlanFor(id) {
  const x = C.byId.get(id); if (!x) return;
  if (x.m.plan) { unpin(); openPlan(id); window.scrollTo(0, 0); }
  else createPlan(id);
}
const pinEditBtn = (id, cls = '') => { const x = C.byId.get(id);
  return h('button', { class: 'mline-edit ' + cls, tip: x && x.m.plan ? 'Detailplan öffnen' : 'Noch kein Detailplan – anlegen', onclick: e => { e.stopPropagation(); openPlanFor(id); } }, 'Bearbeiten'); };
function unpin() {
  if (!UI.pin) return;
  UI.pin = null; UI.pinMonth = null; UI.pinDay = null; UI.pinT = null;
  clearPinMarks();
  highlight(null); syncVisBoxes();                  // Tabelle zeigt wieder die vorherige Auswahl
}
document.addEventListener('click', e => { if (UI.pin && !e.target.closest('.mline, .chip, .mline-edit, .modal, .backdrop, .menu')) unpin(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.pin && !$('.modal')) unpin(); });
function closeMenu() { if (_openMenu) { _openMenu.m.remove(); _openMenu = null; } }
document.addEventListener('click', () => closeMenu());
// Menüs stehen fest am Bildschirm: beim Scrollen der Seite (nicht im Menü selbst) schließen
document.addEventListener('scroll', e => { if (_openMenu && performance.now() - (_openMenu.at || 0) > 300 && !(e.target instanceof Node && _openMenu.m.contains(e.target))) closeMenu(); }, true);
// Warnliste beginnt unter der Kopfzeile – die kann bei 150 % Skalierung zweizeilig sein
// Kopfzeile: passt nicht alles in eine Zeile, kommen die Reiter (Jahresplanung … Urlaub & Feiertage) in eine eigene zweite Zeile;
// oben bleiben Logo, Titel, Jahr und die Knöpfe rechts
function layoutHeader() {
  const t = $('header.top'); if (!t) return;
  t.classList.remove('two-rows');
  const kids = [...t.children].filter(e => e.offsetParent !== null), bottom0 = kids.length ? Math.min(...kids.map(e => e.offsetTop + e.offsetHeight)) : 0;
  if (kids.some(e => e.offsetTop >= bottom0)) t.classList.add('two-rows');   // umgebrochen: ein Teil beginnt unterhalb der ersten Zeile
}
function syncTopHeight() { layoutHeader(); const t = $('header.top'); if (t) document.documentElement.style.setProperty('--toph', Math.round(t.getBoundingClientRect().height) + 'px'); }
window.addEventListener('resize', syncTopHeight);

/* ---------- Seitenleiste: was wird angezeigt? */
function highlight(id) {
  const main = $('#main'); if (!main) return;
  if (!id && UI.pin && UI.view === 'jahr' && C.byId.has(UI.pin)) id = UI.pin;   // nach dem Überfahren zurück zur festgehaltenen Maßnahme
  main.classList.toggle('hl', !!id);
  $$('[data-m]', main).forEach(e => e.classList.toggle('hl-on', e.dataset.m === id));
  $$('.day.span', main).forEach(c => { c.classList.remove('span', 'span-end'); c.style.removeProperty('--hcl'); c.style.removeProperty('--hcr'); c.style.removeProperty('--hce'); });
  const x = id && C.byId.get(id);
  if (!x || UI.verbund) return;                  // Verbund-Darstellung: die eigene Linie wird per CSS betont
  const pts = spanPts(x);          // ausgeblendete Bereiche gehören nicht zur Linie, der letzte angezeigte läuft bis zu seinem Ende
  if (pts.length < 2) return;
  const a = pts[0].n, b = pts[pts.length - 1].n, cells = new Map($$('.day[data-dn]', main).map(c => [+c.dataset.dn, c]));
  for (let n = a; n <= b; n++) {
    const c = cells.get(n); if (!c) continue;
    const [l, r] = lineHalves(n, pts, x.color);
    c.classList.add('span'); c.style.setProperty('--hcl', l); c.style.setProperty('--hcr', r);
  }
  const ec = pts[pts.length - 1].k === null && cells.get(b);          // Ende des Abschnitts ohne eigenen Termin: kleiner Strich
  if (ec) { ec.classList.add('span-end'); ec.style.setProperty('--hce', x.color); }
}
function sideBar() {
  const y = UI.year;
  const ms = C.ms.filter(x => inYear(x, y));
  const typeBtn = (t, label) => h('label', { class: 'tchk' }, h('input', { type: 'checkbox', checked: showType(t), onchange: e => { UI.show[t] = e.target.checked; renderNow(); } }),
    demoChip(t), label);
  const persons = [...new Set([...D.personen.map(p => p.name), ...C.vac.map(v => v.u.wer).filter(Boolean)])];
  return h('aside', { class: 'side' },
    h('button', { class: 'icon collapse', tip: 'Seitenleiste ausblenden', onclick: () => { UI.sidebar = false; renderNow(); } }, '«'),
    h('section', null, h('h3', null, 'Termine anzeigen'), evKeys().map(t => typeBtn(t, TYPE_LABEL[t]))),
    h('section', null, h('h3', null, 'Maßnahmen ', h('span', { class: 'links' },
      h('button', { class: 'link', onclick: () => { UI.hiddenM.clear(); renderNow(); } }, 'alle'), ' · ',
      h('button', { class: 'link', onclick: () => { ms.forEach(x => UI.hiddenM.add(x.id)); renderNow(); } }, 'keine'))),
      ms.length ? ms.map(x => h('label', { class: 'mchk', dataset: { m: x.id }, onmouseenter: () => highlight(x.id), onmouseleave: () => highlight(null) },
        h('input', { type: 'checkbox', checked: visibleM(x), onclick: e => { toggleVisible(x.id, ms, e); renderNow(); } }),
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
  if (w.step) { const x = C.byId.get(w.mid); UI.view = 'plaene'; UI.planSel = w.mid; UI.flash = 'step:' + w.step; if (x && x.pal != null) UI.year = ymd(x.pal)[0]; }
  else if (w.mid) { UI.view = 'jahr'; UI.secOpen.mass = true; UI.flash = 'm:' + w.mid; }
  else if (w.n != null) { UI.view = 'jahr'; UI.secOpen.tl = true; UI.flash = 'n:' + w.n; }
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
        'Arbeitsschritte im Urlaub der zugeordneten Person.')));
}

/* ---------- Einstellungen */
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
// Markierungen: Vorschau in zwei Beispielfarben, Zeichen ändern (eindeutig), Aussehen wählen
const symOwner = z => sym('P') === z ? 'P' : (PH().find(q => sym(q.key) === z) || {}).key || null;
function markPreview(k) {
  return [demoChip(k), ...['#C2185B', '#1F77B4'].map(c => h('span', { class: 'chip', style: chipStyle(k, c) }, sym(k)))];
}
function setSym(k, v) {
  const z = String(v || '').trim().toUpperCase();
  if (z === sym(k)) return;
  if (!SYM_RE.test(z)) { toast('Bitte einen Buchstaben (A–Z) oder eine Ziffer eingeben.', 'warn'); return; }
  const who = symOwner(z); if (who && who !== k) { toast('„' + z + '“ ist schon vergeben (' + phName(who) + ').', 'warn'); return; }
  commit(d => { if (k === 'P') d.settings.pal = Object.assign({}, DEF_PAL, d.settings.pal, { zeichen: z }); else { const b = d.settings.bereiche.find(q => q.key === k); if (b) b.zeichen = z; } }, phName(k) + ': Zeichen ' + z);
}
function lineSelect(k, draw) {
  return h('select', { 'aria-label': 'Linie ' + phName(k), onchange: e => { const v = e.target.value;
    commit(d => { const b = d.settings.bereiche.find(q => q.key === k); if (b) b.linie = v; }); draw(); } },
    Object.entries(LINIEN).map(([v, l]) => h('option', { value: v, selected: lineOf(k) === v }, l)));
}
function linePreview(k, i) {
  const n = PH().length, f = n > 1 ? (n - 1 - i) / (n - 1) : 1;
  return h('span', { class: 'lprev' }, ['#C2185B', '#1F77B4'].map(c => h('span', { class: 'lp ln-' + lineOf(k), style: { background: lineBg(k, c, f), '--c': c } })));
}
function stilSelect(k, draw) {
  return h('select', { 'aria-label': 'Aussehen ' + phName(k), onchange: e => { const v = e.target.value;
    commit(d => { if (k === 'P') d.settings.pal = Object.assign({}, DEF_PAL, d.settings.pal, { stil: v }); else { const b = d.settings.bereiche.find(q => q.key === k); if (b) b.stil = v; } }); draw(); } },
    Object.entries(STILE).map(([v, l]) => h('option', { value: v, selected: stilOf(k) === v }, l)));
}
async function removeBereich(k) {
  const u = bUsage(k);
  if (!await confirmBox('Bereich entfernen', 'Bereich „' + sym(k) + ' · ' + phName(k) + '“ entfernen?' + (u ? ' Er wird bei ' + u + ' verwendet: die Starts dieses Bereichs werden gelöscht, Abschnitte in Detailplänen verlieren die Zuordnung (die Arbeitsschritte bleiben).' : ''), 'Entfernen')) return;
  commit(d => {
    d.settings.bereiche = d.settings.bereiche.filter(q => q.key !== k);
    for (const m of d.massnahmen) {
      if (m.vorlauf) delete m.vorlauf[k];
      if (m.ende) delete m.ende[k];
      if (m.plan) { m.plan.steps.forEach(s => { if (s.bereich === k) delete s.bereich; }); if (m.plan.marks) delete m.plan.marks[k]; }
    }
  }, 'Bereich ' + sym(k) + ' entfernt');
}

/* ---------- Einstellungen: alles wirkt sofort, Personen hier zentral verwalten */
// Einstellungen: eigene Seite ohne Reiter, links die Rubriken (auch Urlaub & Feiertage und die Vorlagen der Detailpläne);
// „← zurück“ führt zur vorherigen Ansicht
const SETT_TABS = [['allgemein', 'Allgemein'], ['bereiche', 'Bereiche & Personen'], ['urlaub', 'Urlaub & Feiertage'], ['vorlagen', 'Vorlagen für Detailpläne'], ['version', 'Version']];
const SETT = { showLog: false, newName: '', newKey: '', newBName: '' };
function openSettings(tab) {
  if (UI.view !== 'einstellungen') UI._backView = UI.view;
  if (tab) UI.settTab = tab;
  UI.view = 'einstellungen'; hideTip(); renderNow(); window.scrollTo(0, 0);
}
function closeSettings() {
  UI.tplSel = null;
  UI.view = VIEW_FN[UI._backView] && !['einstellungen', 'urlaub'].includes(UI._backView) ? UI._backView : 'jahr'; renderNow(); window.scrollTo(0, 0);
}
const settingsDialog = () => openSettings();
const openUrlaub = () => openSettings('urlaub');
const closeUrlaub = closeSettings;
VIEW_FN.einstellungen = main => {
  const tab = SETT_TABS.some(t => t[0] === UI.settTab) ? UI.settTab : (UI.settTab = 'allgemein');
  const body = h('div', { class: 'sett-body sett-' + tab });
  put(main, h('div', { class: 'view-head' }, h('button', { class: 'ghostbtn backbtn screen-only', onclick: closeSettings, tip: 'zurück zur vorherigen Ansicht' }, '← zurück'), h('h1', null, 'Einstellungen')),
    h('div', { class: 'sett-page' },
      h('nav', { class: 'sett-nav screen-only' }, SETT_TABS.map(([k, l]) => h('button', { class: 'sett-tab' + (k === tab ? ' on' : ''), dataset: { tab: k }, onclick: () => { UI.settTab = k; if (k !== 'vorlagen') UI.tplSel = null; hideTip(); renderNow(); window.scrollTo(0, 0); } }, l))),
      body));
  if (tab === 'urlaub') VIEW_FN.urlaub(body, true);
  else if (tab === 'vorlagen') tplSettings(body);
  else put(body, settingsParts()[tab]);
};
VIEW_FN['einstellungen:after'] = main => { if (UI.settTab === 'urlaub' || (UI.settTab === 'vorlagen' && UI.tplSel)) VIEW_FN['plaene:after'](main); };
function settingsParts() {
  let { showLog, newName, newKey, newBName } = SETT;
  const draw = () => { Object.assign(SETT, { showLog, newName, newKey, newBName }); renderNow(); };
  const row = (label, inp, hint) => h('div', { class: 'frow' }, h('span', null, label), inp, hint ? h('small', null, hint) : null);
  const usage = n => {
    const u = D.urlaube.filter(v => v.wer === n).length, m = D.massnahmen.filter(q => q.verantwortlich === n).length,
      st = D.massnahmen.reduce((a, q) => a + (q.plan?.steps || []).filter(s => s.wer === n && s.typ !== 'gruppe').length, 0);
    return [u ? u + ' Urlaub' + (u > 1 ? 'e' : '') : '', m ? m + '× hauptverantwortlich' : '', st ? st + ' Schritt' + (st > 1 ? 'e' : '') : ''].filter(Boolean).join(' · ');
  };
  const out = {};
  {
    const RICHT = [h('h3', null, 'Spenden: Richtwerte'),
      (() => { const R = spRicht(), set = fn => { commit(d => { const r = Object.assign({}, SP_RICHT0, d.settings.richtwerte); r.resp = r.resp.slice(); r.roi = r.roi.slice(); fn(r); d.settings.richtwerte = r; }); draw(); };
        const num = (v, k, i) => h('input', { type: 'number', step: '0.1', min: 0, class: 'rw-in', value: v, 'aria-label': 'Richtwert', onchange: e => { const n = parseFloat(e.target.value); if (n >= 0) set(r => { r[k][i] = n; if (r[k][0] > r[k][1]) r[k].reverse(); }); } });
        return [h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: R.an, onchange: e => set(r => { r.an = e.target.checked; }) }), 'Richtwerte bei den Kennzahlen anzeigen (unter / im / über Richtwert)'),
          row('Responsequote (%)', h('div', { class: 'inl' }, num(R.resp[0], 'resp', 0), '–', num(R.resp[1], 'resp', 1))),
          row('ROI (Spenden je 1 € Kosten)', h('div', { class: 'inl' }, num(R.roi[0], 'roi', 0), '–', num(R.roi[1], 'roi', 1)))]; })()];
    const theme = UI.theme || 'light';
    const radio = (v, l) => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'theme', checked: theme === v, onchange: () => { setTheme(v); draw(); } }), l);
    out.allgemein = h('div', { class: 'form settings' },
      h('h3', null, 'Allgemein'),
      row('Dein Name', h('input', { value: UI.userName || '', onchange: e => { UI.userName = e.target.value.trim(); saveUI(); } }), 'wird beim Speichern vermerkt („gespeichert von …“), nur in diesem Browser'),
      row('Planungsjahr', h('input', { type: 'number', min: 2000, max: 2099, value: D.settings.year, onchange: e => { const v = +e.target.value; if (v >= 2000 && v <= 2099) commit(d => { d.settings.year = v; }); } }),
        'mit diesem Jahr öffnet die App; die Excel-Ansicht in Teams zeigt immer dieses Jahr'),
      h('h3', null, 'Speicherort'),
      h('div', { class: 'inl sett-store' },
        h('button', { class: 'sett-folder', onclick: async e => { e.preventDefault(); ST.conn = 'none'; ST.dir = null; await connectFolder(); renderNow(); } }, 'Speicherort (Mailing-Ordner) neu wählen …'),
        h('span', { class: 'muted small' + (folderMismatch() ? ' warn' : '') }, ST.conn === 'ok' && ST.dir ? 'Ordner „' + ST.dir.name + '“ – Änderungen werden automatisch gespeichert' + (folderMismatch() ? ' (passt nicht zur geöffneten Datei!)' : '')
          : ST.conn === 'needs-permission' ? 'Ordner „' + (ST.dir ? ST.dir.name : '?') + '“ (Freigabe fehlt noch)' : 'noch kein Speicherort gewählt')),
      h('h3', null, 'Datensicherung'),
      h('div', { class: 'inl sett-backup' },
        h('button', { class: 'sett-bsave', onclick: e => { e.preventDefault(); saveBackup(); } }, 'Sicherung speichern …'),
        h('button', { class: 'sett-bload', onclick: e => { e.preventDefault(); openFile(); } }, 'Sicherung hochladen …')),
      h('p', { class: 'muted small' }, 'Die App speichert laufend in die Programmdatei im Mailing-Ordner – das ist keine eigene Sicherung. Frühere Stände dieser Datei stehen im Versionsverlauf von SharePoint/OneDrive. „Sicherung speichern“ legt alle Planungsdaten als eigene Datei (.json) ab, z. B. vor größeren Umbauten; „Sicherung hochladen“ holt einen solchen Stand zurück.'),
      h('h3', null, 'Änderungsprotokoll'),
      h('div', { class: 'inl' }, h('button', { class: 'sett-log', onclick: e => { e.preventDefault(); logDialog(); } }, 'Änderungsprotokoll anzeigen …'), h('span', { class: 'muted small' }, 'wer wann was geändert hat')),
      h('h3', null, 'Darstellung'),
      h('div', { class: 'inl theme-pick' }, radio('light', 'Hell'), radio('dark', 'Dunkel'), radio('system', 'wie Windows')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: UI.splash !== false, onchange: e => { UI.splash = e.target.checked; saveUI(); } }), 'Startbildschirm mit Animation beim Öffnen zeigen'),
      RICHT);
    out.bereiche = h('div', { class: 'form settings' },
      h('h3', null, 'Bereiche und Markierungen'),
      h('p', { class: 'muted small' }, 'Die Phasen jeder Maßnahme bis zum PAL, in zeitlicher Reihenfolge. Das Zeichen erscheint als Markierung im Kalender, in der Zeitleiste, in der Tabelle und in den Exporten. Die Linie ist das Teilstück des Bereichs: Verbindungslinie im Kalender und Balken in der Zeitleiste (im Detailplan bleiben die Abschnitte einheitlich grau). „Abgestuft“ = von hell (erster Bereich) nach kräftig (letzter). Im Detailplan wird jeder Abschnitt einem Bereich zugeordnet. Ohne eigenes Ende läuft ein Bereich bis zum nächsten Start.'),
      h('table', { class: 'grid ptable btable' },
        h('thead', null, h('tr', null, h('th', null, 'Vorschau'), h('th', null, 'Zeichen'), h('th', null, 'Begriff'), h('th', null, 'Markierung'), h('th', null, 'Linie'), h('th'), h('th'))),
        h('tbody', null, PH().map((b, i) => h('tr', { dataset: { key: b.key } },
        h('td', { class: 'prev' }, markPreview(b.key)),
        h('td', { class: 'zcol' }, h('input', { value: sym(b.key), maxlength: 1, 'aria-label': 'Zeichen für ' + b.name, onchange: e => { setSym(b.key, e.target.value); draw(); } })),
        h('td', null, h('input', { value: b.name, 'aria-label': 'Name des Bereichs ' + sym(b.key), onchange: e => { const nv = e.target.value.trim(); if (nv) commit(d => { d.settings.bereiche[i].name = nv; }); draw(); } })),
        h('td', { class: 'scol' }, stilSelect(b.key, draw)),
        h('td', { class: 'lcol' }, lineSelect(b.key, draw), linePreview(b.key, i)),
        h('td', { class: 'muted small' }, bUsage(b.key) || 'nicht verwendet'),
        h('td', { class: 'acts' },
          h('button', { class: 'icon', tip: 'früher', 'aria-label': 'früher', 'data-repeat': true, disabled: i === 0, onclick: () => { commit(d => { const l = d.settings.bereiche; [l[i - 1], l[i]] = [l[i], l[i - 1]]; }); draw(); } }, '↑'),
          h('button', { class: 'icon', tip: 'später', 'aria-label': 'später', 'data-repeat': true, disabled: i === PH().length - 1, onclick: () => { commit(d => { const l = d.settings.bereiche; [l[i + 1], l[i]] = [l[i], l[i + 1]]; }); draw(); } }, '↓'),
          h('button', { class: 'icon', tip: 'entfernen', 'aria-label': 'entfernen', onclick: async () => { await removeBereich(b.key); draw(); } }, '✕')))),
        h('tr', { class: 'palrow', dataset: { key: 'P' } },
          h('td', { class: 'prev' }, markPreview('P')),
          h('td', { class: 'zcol' }, h('input', { value: sym('P'), maxlength: 1, 'aria-label': 'Zeichen für das PAL', onchange: e => { setSym('P', e.target.value); draw(); } })),
          h('td', null, h('b', null, 'PAL'), h('span', { class: 'muted small' }, ' (Briefkasten, fest)')),
          h('td', { class: 'scol' }, stilSelect('P', draw)),
          h('td', { class: 'muted small' }, 'Punkt – keine Linie'), h('td'), h('td')))),
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
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addP(); } } }), h('button', { class: 'addbtn', onclick: e => { e.preventDefault(); addP(); } }, '+ Person hinzufügen')));
    out.version = h('div', { class: 'form settings' },
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
  }
  const addB = () => {
    const z = newKey.trim().toUpperCase(), nm = newBName.trim();
    if (!SYM_RE.test(z)) { toast('Bitte einen Buchstaben (A–Z) oder eine Ziffer wählen.', 'warn'); return; }
    const who = symOwner(z); if (who) { toast('„' + z + '“ ist schon vergeben (' + phName(who) + ').', 'warn'); return; }
    if (!nm) { toast('Bitte einen Namen für den Bereich eingeben.', 'warn'); return; }
    // interner Schlüssel: der Buchstabe selbst, wenn frei – sonst ein anderer freier (das angezeigte Zeichen bleibt „z“)
    const keys = new Set(PH().map(q => q.key)), k = PHASE_KEY_RE.test(z) && !keys.has(z) ? z : [...'ABCDEFGHIJKLMNOQRSTUVWXYZ'].find(c => !keys.has(c));
    if (!k) { toast('Es sind schon zu viele Bereiche angelegt.', 'warn'); return; }
    commit(d => { d.settings.bereiche.push({ key: k, name: nm, vorlauf: null, zeichen: z, stil: 'pastell' }); }, 'Bereich ' + z + ' · ' + nm + ' angelegt');
    newKey = ''; newBName = ''; draw();
  };
  const addP = () => {
    const nv = newName.trim(); if (!nv) return;
    if (D.personen.some(q => q.name === nv)) { toast('„' + nv + '“ gibt es schon.', 'warn'); return; }
    commit(d => { const used = new Set(d.personen.map(q => q.farbe)); d.personen.push({ name: nv, farbe: PERSON_COLORS.find(c => !used.has(c)) || '#888888' }); });
    newName = ''; draw();
  };
  return out;
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
