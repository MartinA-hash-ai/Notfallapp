/* ===================================================================== Rahmen: Kopfzeile, Hinweise, Zeichnen, Bedienung, Start */

const DEMO_KEY = 'bedarfsliste-vorschau-4';
const UI = { fEdit: null, paketWahl: null, heuteWahl: null, view: 'list', id: null, tab: 'aktiv', q: '', fSw: [], prioKopf: 0, det: null, kEdit: null, zEdit: null, ansicht: 'voll', auf: null, sort: [] };
const UI_KEEP = ['view', 'id', 'tab', 'ansicht', 'sort', 'prioKopf', 'fSw'];             // auch Prio-Sortierung und Stichwort-Filter (ab 0.62)
const uiKey = () => (DEMO ? 'bl-ui-demo' : 'bl-ui:' + location.pathname);
const SORT_SPALTEN = ['titel', 'summe', 'ort', 'fr', 'fin', 'vn', 'ueb'];
function loadUI() { try { const o = JSON.parse(localStorage.getItem(uiKey()) || '{}'); for (const k of UI_KEEP) if (k in o) UI[k] = o[k]; } catch (e) { /* */ }
  UI.sort = Array.isArray(UI.sort) ? UI.sort.filter(s => s && SORT_SPALTEN.includes(s.k)) : [];
  UI.prioKopf = [0, 1, 2].includes(UI.prioKopf) ? UI.prioKopf : 0; UI.fSw = Array.isArray(UI.fSw) ? UI.fSw.filter(s => typeof s === 'string') : []; }
function saveUI() { try { localStorage.setItem(uiKey(), JSON.stringify(Object.fromEntries(UI_KEEP.map(k => [k, UI[k]])))); } catch (e) { /* */ } }
const cur = () => D.bedarfe.find(b => b.id === UI.id) || null;

/* ---------- Darstellung: hell (Standard), dunkel oder wie Windows – eigenes Merkmal data-bl-theme, damit die Wahl auch in der Vorschau gilt */
const themeGet = () => { try { return localStorage.getItem('bl-theme') || 'light'; } catch (e) { return 'light'; } };
function applyTheme(t = themeGet()) {
  if (t === 'system') delete document.documentElement.dataset.blTheme; else document.documentElement.dataset.blTheme = t;
  try { localStorage.setItem('bl-theme', t); } catch (e) { /* */ }
}

// Zuständige fertig bearbeitet: neue oder geänderte Personen (gegenüber dem Stand vor dem Bearbeiten) – dauerhaft in die Personenliste? (fragt nach)
let ZSNAP = '[]';
function zustFertig(b) {
  const vor = JSON.parse(ZSNAP || '[]').map(c => JSON.stringify(c)); ZSNAP = '[]';
  const L = b.zust.filter(c => !vor.includes(JSON.stringify(c)));
  if (L.length) personenBestaetigen(L, b.gliederung);
}
/* ---------- Kopfzeile */
// Speicherstand als Symbol: grüne Diskette = gespeichert, gelbes drehendes Rad = speichert gerade; Uhrzeit beim Überfahren.
// Was einen Klick braucht (Ordner wählen, Konflikt, Fehler), steht weiter als Text da.
const ICON_DISK = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M5 3.5h11.5L20.5 7.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7.5 3.5v5h8v-5M7.5 20.5v-6h9v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const ICON_RAD = '<svg class="rad" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="2.4"/><path d="M12 4a8 8 0 0 1 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
function saveBox(dirty = isDirty()) {
  if (DEMO) return '';
  const t = ST.lastSave ? ST.lastSave.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
  let label, cls = 'save', tip;
  if (!FSA) { label = dirty ? '● Speichern' : '✓ Gespeichert'; cls += dirty ? ' primary' : ''; tip = 'Speichern lädt die Datei herunter (Browser ohne Ordnerzugriff)'; }
  else if (ST.saving) return `<button id="savebox" class="save sym laeuft" data-act="save" title="Wird gespeichert …" aria-label="Wird gespeichert">${ICON_RAD}</button>`;
  else if (BROKEN) { label = '⚠ Speichern gesperrt'; cls += ' primary'; tip = 'Die Daten dieser Datei waren beschädigt – siehe Hinweis oben'; }
  else if (ST.newer) { label = '⚠ Neustart nötig'; cls += ' primary'; tip = 'Im Ordner liegt eine neuere Programmversion – siehe Hinweis oben'; }
  else if (ST.conflict) { label = '⚠ Zwei Stände'; cls += ' primary'; tip = 'Die Datei wurde woanders geändert – siehe Hinweis oben'; }
  else if (ST.conn === 'none') { label = 'Speichern …'; cls += ' primary'; tip = 'Einmal den Ordner wählen – danach speichert die Liste automatisch'; }
  else if (ST.conn === 'needs-permission') { label = 'Speichern aktivieren'; cls += ' primary'; tip = 'Ein Klick: der Browser fragt, ob die Liste den Ordner bearbeiten darf'; }
  else if (ST.fail && dirty) { label = '⚠ Nicht gespeichert'; cls += ' primary'; tip = 'Speichern fehlgeschlagen: ' + ST.fail.msg + '. Neuer Versuch läuft automatisch – oder hier klicken.'; }
  else if (dirty) return `<button id="savebox" class="save sym laeuft" data-act="save" title="Wird gespeichert … (Strg+S speichert sofort)" aria-label="Wird gespeichert">${ICON_RAD}</button>`;
  else return `<button id="savebox" class="save sym ok" data-act="save" title="${esc('Gespeichert' + (t ? ' um ' + t + ' Uhr' : ''))}" aria-label="Gespeichert">${ICON_DISK}</button>`;
  return `<button id="savebox" class="${cls}" data-act="save" title="${esc(tip)}">${esc(label)}</button>`;
}
function updateSaveUI() {
  const box = $('#savebox'), dirty = isDirty();
  if (box) box.outerHTML = saveBox(dirty);
  document.title = (dirty ? '● ' : '') + 'Bedarfsliste';
}
// Förder-Kartei oben: nur, wenn etwas zu tun ist (Zugriff erlauben, Problem, keine Kartei) – läuft alles, steht nichts da (Zahnrad → Förder-Kartei)
function karteiChip() {
  if (DEMO) return '';
  if (KR.zugriff) return `<button class="kchip warn" data-act="kartei-erlauben" title="${esc('Die verknüpfte Kartei „' + D.settings.karteiLink + '“ lesen – ein Klick, der Browser fragt einmal nach')}">Förder-Kartei: Zugriff erlauben</button>`;
  if (KR.err) return `<button class="kchip warn" data-act="kartei" title="${esc(KR.err)}">Förder-Kartei: Problem</button>`;
  if (KR.list.length) return '';
  if (ST.conn !== 'ok') return '<button class="kchip" data-act="kartei" title="Die Kartei wird aus dem Ordner der Bedarfsliste gelesen">Förder-Kartei: Ordner verbinden</button>';
  return '<button class="kchip warn" data-act="kartei" title="Keine passende Excel im Ordner gefunden – klicken zum Wählen">Förder-Kartei wählen</button>';
}
// Feld der Hinweise oben (gebündelt statt in der ohnehin bunten Liste), gestaffelt: rot „jetzt fällig“ (heute oder überfällig),
// gelb „bald fällig“ (in den nächsten 14 Tagen), grau „Infos“ – es steht nur die dringendste Stufe da, die anderen im Hinweis beim Überfahren (Zusage ohne Betrag, Gliederung laut Kartei, Antrag ohne vollständige Freigabe).
// Ein Klick zeigt die Liste; ein Eintrag springt zu der Stelle, die ihn auslöst, und lässt sie kurz aufleuchten
function infosAlle() {
  const L = [];
  for (const b of D.bedarfe) {
    if (b.archiv || b.manuell) continue;
    if (phase(b).warn.some(w => /Freigabe ist aber nicht vollständig/.test(w))) L.push({ b, z: 'frei', t: 'Antrag läuft, Freigabe noch nicht vollständig' });
    for (const f of b.foerderer) for (const x of foeHinweise(b, f))
      L.push({ b, z: x.k, fid: f.id, t: x.k === 'amt' ? 'Zusage ohne Betrag: ' + short(f.name) : short(f.name) + ' – laut Kartei nicht für ' + b.gliederung });
  }
  return L;
}
function hinweise() { const F = D ? fristenBald() : []; return { jetzt: F.filter(x => x.n <= 0), bald: F.filter(x => x.n > 0), infos: D ? infosAlle() : [] }; }
function fristChip() {
  const H = hinweise(), n = H.jetzt.length + H.bald.length + H.infos.length, ni = H.infos.length;
  if (!n) return '<span id="frist-chip" hidden></span>';
  const [cls, k, w] = H.jetzt.length ? [' over', H.jetzt.length, 'jetzt fällig'] : H.bald.length ? ['', H.bald.length, 'bald fällig'] : [' nur-info', ni, ni === 1 ? 'Info' : 'Infos'];
  const tip = [H.jetzt.length && H.jetzt.length + ' jetzt fällig', H.bald.length && H.bald.length + ' in den nächsten ' + FRIST_TAGE + ' Tagen fällig', ni && ni + (ni === 1 ? ' Info' : ' Infos')].filter(Boolean).join(', ');
  return `<button id="frist-chip" class="frist-chip${cls}" data-act="fristen" aria-haspopup="menu" title="${tip} – klicken für die Liste">${ICON_TRI}<span>${k} ${w}</span></button>`;
}
function fristPop(btn) {
  closeMenus();
  const H = hinweise(), rel = n => n === 0 ? 'heute' : n === 1 ? 'morgen' : n === -1 ? 'gestern' : n < 0 ? 'vor ' + -n + ' Tagen' : 'in ' + n + ' Tagen';
  const ziel = (x, cls) => ({ class: 'fp-row' + cls, role: 'menuitem', 'data-act': 'ziel', 'data-id': x.b.id, 'data-z': x.z, 'data-fid': x.fid || null });
  const bed = x => h('span', { class: 'fp-b' }, (x.b.titel || '(ohne Namen)') + (x.b.archiv ? ' · im Archiv' : x.b.manuell ? ' · ' + x.b.manuell : ''));
  const frist = x => h('button', ziel(x, x.n <= 0 ? ' over' : ''), h('span', { class: 'fp-d' }, fmtDate(x.d)), h('span', { class: 'fp-t' }, x.t), h('span', { class: 'fp-r' }, rel(x.n)), bed(x));
  const info = x => h('button', ziel(x, ' fp-info'), h('span', { class: 'fp-d', html: '<i class="fp-i">i</i>' }), h('span', { class: 'fp-t' }, x.t), bed(x));
  const grp = (t, M, f) => M.length ? [h('div', { class: 'fp-h' }, t), ...M.map(f)] : [];
  placePop(h('div', { class: 'menu frist-pop', role: 'menu' }, ...grp('Jetzt fällig', H.jetzt, frist), ...grp('Bald fällig · in den nächsten ' + FRIST_TAGE + ' Tagen', H.bald, frist), ...grp('Infos', H.infos, info)), btn, 'right');
}
// Eintrag im Feld der Hinweise: zur Stelle, die ihn auslöst, und sie kurz aufleuchten lassen. In der Liste in der Zeile des Bedarfs (kompakt:
// aufgeklappt); steht er dort nicht (Suche, Filter, Archiv, zurückgestellt) oder ist man auf der Seite eines Bedarfs: auf seiner Seite
const ZIEL_LISTE = { deadline: '[data-le="deadline"]', frist: '.fn[data-fid="§"]', erwartet: '.fn[data-fid="§"]', kartei: '.fn[data-fid="§"]', amt: '.fa[data-fid="§"]', vn: '.vt[data-fid="§"]', ueb: 'td.l-ueb > :first-child', frei: 'td.l-fr .ml' };
const ZIEL_SEITE = { deadline: '#d-meta .d-dl', frist: '#foe-§ [data-dp="frist"]', erwartet: '#foe-§ [data-dp="erwartet"]', kartei: '#foe-§ .fp-title', amt: '#amt-§', vn: '#nl-§', ueb: '#sec-nach .ue-termin', frei: '#fr-blk' };
const ZIEL_BEREICH = { frist: 'foe', erwartet: 'foe', kartei: 'foe', amt: 'foe', vn: 'nach', ueb: 'nach' };
function springZu(id, z, fid) {
  const b = D.bedarfe.find(x => x.id === id); if (!b) return;
  closeMenus();
  const sel = S => (S[z] || ':not(*)').replace(/§/g, CSS.escape(fid || ''));
  if (UI.view === 'list' && filtered().some(x => x.id === id)) {
    if (KOMPAKT() && UI.auf !== id) aufklappen(id);
    const tr = zeileEl(id); if (!tr) return;
    const L = [...tr.querySelectorAll(sel(ZIEL_LISTE))];
    blitz(L.length ? L : [tr.querySelector('.l-name .le-w')]); zeileFokus(id);
    return;
  }
  const ber = ZIEL_BEREICH[z], los = () => blitz([$(sel(ZIEL_SEITE)) || $('#f-titel')]);
  if (UI.view !== 'detail' || UI.id !== id) return oeffnen(id, { offen: ber, danach: los });
  if (ber && zuGet(b, ber)) { zuSet(b, ber, false); keep(renderNow); }
  los();
}
// kurz aufleuchten lassen: rot hinterlegt, springt kurz hervor – nach dem Hinscrollen
function blitz(els) {
  els = els.filter(Boolean); if (!els.length) return;
  els[0].scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  for (const el of els) {
    el.classList.remove('blitz'); void el.offsetWidth; el.classList.add('blitz');
    const weg = e => { if (e.target === el) { el.classList.remove('blitz'); el.removeEventListener('animationend', weg); } };
    el.addEventListener('animationend', weg);
  }
}
const ICON_GEAR = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/></svg>';
// in der Ansicht eines Bedarfs hängt unter der Kopfzeile die Leiste mit Phase und Stand
function headerHtml() {
  const b = UI.view === 'detail' ? cur() : null;
  const nA = D.bedarfe.filter(b => !b.archiv).length, nR = D.bedarfe.length - nA;
  const brand = DEMO ? '<div class="mark"></div>' : `<img class="logo light" src="${LOGO}" alt="Malteser"><img class="logo dark" src="${LOGO_DARK}" alt="Malteser">`;
  const tab = (k, l, n) => `<button class="tab ${UI.tab === k && UI.view === 'list' ? 'on' : ''}" data-act="tab" data-v="${k}">${l}<span class="cnt">${n}</span></button>`;
  return `<header class="top">
    <div class="brand">${brand}<div><strong>Bedarfsliste</strong><span>Fundraising · Diözese Paderborn</span></div></div>
    <nav class="tabs" aria-label="Ansicht">${tab('aktiv', 'Bedarfe', nA)}${tab('archiv', 'Archiv', nR)}</nav>
    <div class="actions">${fristChip()}${karteiChip()}${saveBox()}<button class="undo-btn" data-act="undo" title="Letzte Änderung rückgängig machen (Strg+Z)" aria-label="Rückgängig">↶</button>${UI.view === 'list' ? kiListeKnopf() : ''}<button class="primary" data-act="new">+ Bedarf</button><button class="icon gear" data-act="menu" aria-label="Einstellungen" title="Einstellungen: Darstellung hell oder dunkel, Sicherung, Update">${ICON_GEAR}</button></div>
    ${b ? `<div class="subbar"><button class="back" data-act="back">‹ Alle Bedarfe</button><div id="d-steps">${steps(b)}</div></div>` : listBar()}
  </header>`;
}
function bannersHtml() {
  const B = [], ban = (cls, text, btns = '') => B.push(`<div class="banner ${cls}"><span>${text}</span>${btns}</div>`);
  if (DEMO) ban('', '<b>Vorschau</b> mit erfundenen Beispieldaten. Änderungen merkt sich nur dieser Browser; Speichern, Förder-Kartei und Excel gibt es in der Programmdatei.', '<button class="link" data-act="demo-reset">Beispieldaten zurücksetzen</button>');
  if (BROKEN) ban('err', 'Die Daten dieser Datei lassen sich nicht lesen (' + esc(BROKEN.reason) + '). Damit nichts überschrieben wird, speichert die Liste nicht.', '<button class="primary" data-act="restore">Datensicherung laden …</button>');
  if (ST.newer) ban('err', 'Im Ordner liegt eine neuere Version der Bedarfsliste (' + esc(ST.newer.version) + '). Bitte neu laden, damit nichts mit der alten Version überschrieben wird.', '<button class="primary" data-act="reload">Neu laden</button>');
  if (ST.conflict) {
    const c = ST.conflict, o = c.other, n = x => x.bedarfe.length + (x.bedarfe.length === 1 ? ' Bedarf' : ' Bedarfe');
    const text = c.grund === 'leer' ? 'Im Ordner liegt jetzt eine leere Bedarfsliste – hier sind es ' + n(D) + '. Wurde die Datei versehentlich ersetzt?'
      : c.grund === 'ohne' ? 'Die Datei im Ordner wurde durch eine Fassung ohne Speicherdatum ersetzt (z. B. eine frisch kopierte Programmdatei, ' + n(o) + '). Hier sind es ' + n(D) + '.'
      : c.grund === 'aelter' ? 'Im Ordner liegt jetzt ein älterer Stand (gespeichert ' + esc(fmtStamp(o.meta.savedAt)) + ', ' + n(o) + ') als hier (' + esc(fmtStamp(D.meta.savedAt)) + ', ' + n(D) + ') – z. B. von OneDrive wiederhergestellt.'
      : 'Die Datei wurde woanders gespeichert (' + esc(fmtStamp(o.meta && o.meta.savedAt)) + '), während hier ungespeicherte Änderungen offen sind.';
    ban('err', text + ' Der Stand, der nicht gewählt wird, wird als Sicherung heruntergeladen.', '<button data-act="conflict-theirs">Stand aus der Datei laden</button><button class="primary" data-act="conflict-mine">Meinen Stand behalten</button>');
  }
  if (ST.zweiTab) ban('err', 'Diese Bedarfsliste ist noch in einem anderen Fenster oder Tab offen. Bitte nur in einem davon arbeiten und das andere schließen – sonst überschreiben sich die Änderungen gegenseitig.');
  if (ST.zipUpd && !ST.newer && UI.zipHide !== ST.zipUpd.name + '@' + ST.zipUpd.info.version) ban('upd', 'Im Ordner liegt das Update-Paket „' + esc(ST.zipUpd.name) + '“ mit Version ' + esc(ST.zipUpd.info.version) + ' – installiert ist Version ' + esc(APP_INFO.version) + '.', '<button class="primary" data-act="zip-go">Jetzt einspielen …</button><button data-act="zip-later">Später</button>');
  if (DRAFT_OFFER) ban('', 'In diesem Browser liegen ungespeicherte Änderungen vom ' + esc(fmtStamp(DRAFT_OFFER.at)) + '.', '<button class="primary" data-act="draft-restore">Wiederherstellen</button><button data-act="draft-drop">Verwerfen</button>');
  if (!DEMO && !FSA) ban('', 'Dieser Browser kann nicht direkt in den Ordner speichern – „Speichern“ lädt die Datei dann herunter. Mit Microsoft Edge oder Google Chrome speichert die Liste automatisch.');
  if (FSA && ST.conn === 'none') ban('', 'Einmal den Ordner wählen, in dem diese Datei liegt – dann speichert die Liste automatisch und liest deine Förder-Kartei mit ein.', '<button class="primary" data-act="connect">Ordner wählen …</button>');
  if (FSA && ST.conn === 'needs-permission') ban('', 'Ein Klick irgendwo in die Liste, dann fragt der Browser, ob sie den Ordner wieder bearbeiten darf („Bearbeiten zulassen“).');
  if (KR.cut) ban('', 'Die Förder-Kartei „' + esc(KR.name) + '“ ist bis ganz unten formatiert und deshalb sehr groß. Gelesen wurde nur der vordere Teil – in Excel die leeren Zeilen unter der Tabelle löschen, dann geht es schneller.');
  return B.length ? '<div class="banners">' + B.join('') + '</div>' : '';
}

/* ---------- Zeichnen */
const app = document.getElementById('app');
let _rendering = false;
function renderNow() {
  if (!D || _rendering) return;
  _rendering = true;
  try {
    closeMenus();
    const ae = document.activeElement;
    const pk = ae && ae.dataset && ['p', 'dp', 'zp'].find(x => ae.dataset[x]);                 // Feld mit Pfad (auch Datum und Uhrzeit)
    const fk = ae && ae.closest && ae.closest('#app') ? (ae.id ? '#' + CSS.escape(ae.id) : pk ? `[data-${pk}="${ae.dataset[pk]}"]` + (ae.dataset.fid ? `[data-fid="${ae.dataset.fid}"]` : '') + (ae.dataset.uid ? `[data-uid="${ae.dataset.uid}"]` : '') : null) : null;
    let sel = null; try { sel = ae && 'selectionStart' in ae ? [ae.selectionStart, ae.selectionEnd] : null; } catch (e) { /* */ }
    const b = UI.view === 'detail' ? cur() : null;
    if (UI.view === 'detail' && !b) UI.view = 'list';
    // Liste: Reihenfolge bleibt, solange man in ihr arbeitet (Zeilen springen nicht weg); neu sortiert wird beim Zurückkommen
    if (UI.view !== 'list') ORDER.ids = null;
    else if (!ORDER.ids || ORDER.key !== ordKey() || filtered().some(x => !ORDER.ids.includes(x.id))) { ORDER.ids = null; ORDER.ids = filtered().map(x => x.id); ORDER.key = ordKey(); }
    if (UI.auf && (UI.view !== 'list' || !filtered().some(x => x.id === UI.auf))) UI.auf = null;    // aufgeklappter Bedarf weggefiltert oder weg: zuklappen
    if (UI.view !== 'list' || UI.ansicht !== 'kompakt') UI.auf = null;              // aufgeklappter Bedarf der kompakten Liste
    if (!b || !b.foerderer.some(f => f.id === UI.det)) UI.det = null;
    if (UI.kEdit !== UI.det) UI.kEdit = null;
    if (UI.fEdit && UI.fEdit !== (b && b.id)) {                                     // Seite verlassen: Fachreferat fertig bearbeitet
      const z = D.bedarfe.find(x => x.id === UI.fEdit); UI.fEdit = null;
      if (z) { const f = z.freigabe.fach; if ((f.pers || []).some(kontaktLeer)) { f.pers = f.pers.filter(c => !kontaktLeer(c)); changed(); } setTimeout(() => wennFrei(() => fachFertig(z)), 0); }
    }
    if (UI.zEdit && UI.zEdit !== (b && b.id)) {                                     // Seite verlassen: Zuständige fertig bearbeitet, leere fallen weg
      const z = D.bedarfe.find(x => x.id === UI.zEdit); UI.zEdit = null;
      if (z && z.zust.some(kontaktLeer)) { z.zust = z.zust.filter(c => !kontaktLeer(c)); changed(); }
      if (z) setTimeout(() => wennFrei(() => zustFertig(z)), 0);
    }
    PIE_HOLD = false;
    app.innerHTML = headerHtml() + bannersHtml() + (b ? bedarfView(b) : listView());
    aufMass();
    strgSet(CTRL_NOW);
    if (fk) { const e = $(fk, app); if (e) { e.focus({ preventScroll: true }); if (sel && 'setSelectionRange' in e) try { e.setSelectionRange(sel[0], sel[1]); } catch (x) { /* */ } } }
    document.title = (isDirty() ? '● ' : '') + 'Bedarfsliste';
    saveUI();
  } finally { _rendering = false; }
}
function keep(fn) { const y = window.scrollY, tw = $('.tablewrap'), x = tw ? tw.scrollLeft : 0; fn(); window.scrollTo(0, y); const t2 = $('.tablewrap'); if (t2 && x) t2.scrollLeft = x; }
// wird gerade getippt oder ist ein Feld zum Bearbeiten offen (auch Schreibfelder mit Formatierung, Übergabe-Fenster)? Dann nicht
// neu zeichnen – und keinen Stand von außen still übernehmen, der Text im offenen Feld ginge sonst verloren
const offenesFeld = () => !!$('.le-edit, .ue-form, .pe-in');               // Felder, die erst beim Verlassen übernehmen
function beschaeftigt() {
  const ae = document.activeElement;
  if (ae && ae !== document.body && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable)) return true;
  return offenesFeld();
}
// neu zeichnen, aber nicht mitten im Tippen: dann kurz danach noch einmal versuchen
let SR_T = null;
function safeRender() {
  clearTimeout(SR_T); SR_T = null;
  if (beschaeftigt()) { SR_T = setTimeout(safeRender, 400); return; }
  keep(renderNow);
}
function swap(id, html, force) { const el = document.getElementById(id); if (!el || (!force && el.contains(document.activeElement))) return; el.innerHTML = html; }
// nach jeder Eingabe: nur die abgeleiteten Teile neu zeichnen, das Eingabefeld behält den Fokus
function refresh() {
  const b = cur();
  if (UI.view !== 'detail' || !b) return;
  swap('d-meta', metaRest(b)); swap('d-steps', steps(b)); swap('d-sw', swHead(b));
  swap('fr-blk', frBlock(b)); if (!PIE_HOLD) swap('fin-pie', finPie(b)); swap('fin-rows', finRows(b)); swap('fin-eig', finEigPct(b)); swap('link-btn', linkBtn(b)); swap('link-hw', linkHinweis(b)); swap('fach-pers', fachBlock(b));
  b.foerderer.forEach(f => { swap('fw-' + f.id, foeWarn(b, f)); swap('fuss-' + f.id, fussKontakt(f)); swap('sh-' + f.id, foeShare(b, f)); });
  swap('nach-body', nachBody(b)); swap('foe-kurz', esc(foeKurz(b)));
}

/* ---------- Bedienung */
// Folgen eines neuen Stands (alt: der Stand davor, sofern bekannt). Was zum alten Stand gehörte, fällt weg: wer nicht mehr zugesagt ist,
// hat keine Zusage, keinen Geldeingang und ist nicht bei der Übergabe; zurück auf „geplant“ heißt: noch nicht beantragt
function effects(b, base, p, v, alt) {
  const m = p.match(/^freigabe\.(\w+)\.st$/);
  if (m) {
    const it = b.freigabe[m[1]];
    if (v === 'offen') { it.angefragt = ''; it.erledigt = ''; }
    if (v === 'angefragt') { if (!it.angefragt) it.angefragt = today(); it.erledigt = ''; }
    if ((v === 'ok' || v === 'nein') && (!it.erledigt || (alt && alt !== v))) it.erledigt = today();
  }
  if (p === 'status' && base !== b) {
    const f = base, ent = s => s === 'zugesagt' || s === 'abgelehnt';
    if (alt === v) return;
    if (v === 'geplant') { f.beantragtAm = ''; f.entscheidungAm = ''; }
    if (['beantragt', 'zugesagt', 'abgelehnt'].includes(v) && !f.beantragtAm) f.beantragtAm = today();
    if (v === 'beantragt') f.entscheidungAm = '';
    if (ent(v) && (!f.entscheidungAm || ent(alt))) f.entscheidungAm = today();
    if (alt === 'zugesagt') { f.zugesagt = null; f.eingegangen = null; f.eingangAm = ''; b.nach.ueb.mit = b.nach.ueb.mit.filter(id => id !== f.id); }
    if (v === 'zugesagt') { if (f.zugesagt == null) f.zugesagt = f.betrag; if (b.nach.ueb.noetig && !b.nach.ueb.mit.includes(f.id)) b.nach.ueb.mit.push(f.id);
      if (!foeAmt(f)) toast('Zusage ohne Betrag bei „' + (f.name || 'Förderer') + '“ – bitte die zugesagte Summe eintragen (bei einer Sachspende ihren Wert).', 'warn'); }
    if (v === 'abgelehnt') b.nach.ueb.mit = b.nach.ueb.mit.filter(id => id !== f.id);
  }
}
// schnelles Weiterklicken (Liste, Kreisdiagramm): ist das Geld schon da, nicht per Klick umschalten – nur bewusst auf der Seite des Bedarfs
const geldDa = f => f.status === 'zugesagt' && (f.eingegangen != null || !!f.eingangAm);
const geldDaHinweis = () => toast('Das Geld ist schon eingegangen – den Stand bitte auf der Seite des Bedarfs ändern.', 'warn');
function baseOf(el, b) {
  if (el.dataset.fid) return b.foerderer.find(f => f.id === el.dataset.fid);
  if (el.dataset.uid) return b.unterlagen.find(u => u.id === el.dataset.uid);
  return b;
}
function addUl(refocus) {
  const b = cur(), el = $('#ul-new'), v = el ? el.value.trim() : '';
  if (!b || !v) return;
  b.unterlagen.push(UL(v, 'fehlt')); el.value = ''; changed(); swap('ul-body', unterlagenList(b), true);
  if (refocus) { const n = $('#ul-new'); if (n) n.focus(); }
}
// Übersicht der Tastaturbefehle („i“ oben rechts in der Liste, Zahnrad → „Tastaturbefehle …“)
function kuerzelInfo() { closeMenus(); modal('Tastaturbefehle', h('div', null, kuerzelTabelle()), [['Tasten anpassen …', 'anp', 'link'], ['Schließen', false, 'primary']]).then(v => { if (v === 'anp') tastenDialog(); }); }
function mainMenu(btn) {
  closeMenus();
  const item = (act, label, v, cls) => h('button', { role: 'menuitem', 'data-act': act, 'data-v': v || '', class: cls || null }, label), kopf = t => h('div', { class: 'menu-kopf' }, t);
  const th = themeGet();
  const m = h('div', { class: 'menu', id: 'mmenu', role: 'menu' },
    h('div', { class: 'menu-row' }, h('span', null, 'Darstellung'), ...[['light', 'hell'], ['dark', 'dunkel'], ['system', 'wie Windows']].map(([v, l]) =>
      h('button', { class: 'mini-btn' + (th === v ? ' on' : ''), 'data-act': 'theme', 'data-v': v }, l))),
    colwGet(false) || colwGet(true) ? item('colw-reset', 'Spaltenbreiten der Liste zurücksetzen') : null,
    DEMO ? null : h('hr'), DEMO ? null : item('update', 'Programm-Update einspielen …', '', 'dick'),
    h('hr'), kopf('Excel einlesen'),
    DEMO ? null : item('upl', 'UPL (Investitionsabfrage) …'),
    DEMO ? null : item('pers-import', 'Kontakte für die Personenliste …'),
    DEMO ? null : item('kartei', 'Förder-Kartei' + (KR.list.length ? ' (' + KR.list.length + ' Förderer)' : '') + ' – wählen oder verknüpfen …'),
    h('hr'), kopf('Vorlagen herunterladen'),
    item('upl-vorlage', 'UPL-Vorlage für Copilot/Cowork'),
    item('vorlage-leer', 'Förderplan-Vorlage (leer)'),
    DEMO ? null : h('hr'), DEMO ? null : kopf('Datensicherung'),
    DEMO ? null : item('backup', 'Herunterladen (.json)'),
    DEMO ? null : item('restore', 'Laden …'),
    h('hr'), kopf('Einstellungen'),
    item('vorlagen', 'E-Mail-Vorlagen (Rundmail) …'),
    item('pers-liste', 'Personenliste bearbeiten …'),
    item('fach-haupt', 'Hauptansprechpersonen der Fachreferate …'),
    item('tasten', 'Tastaturbefehle …'),
    item('about', 'Über die Bedarfsliste und Tastaturbefehle (Version ' + APP_INFO.version + ')'));
  document.body.append(m);
  const r = btn.getBoundingClientRect();
  m.style.top = (r.bottom + 4) + 'px'; m.style.right = Math.max(8, innerWidth - r.right) + 'px';
  const f = m.querySelector('button'); if (f) f.focus();
}
// Erklärung der Textformatierung (Zahnrad und „i“ bei den Notizen)
function fmtInfo() {
  const z = (ein, aus) => h('tr', null, h('td', null, h('code', null, ein)), h('td', { html: aus }));
  modal('Texte formatieren', h('div', { class: 'help' },
    h('p', null, 'In der Beschreibung eines Bedarfs und in Notizen, Fristen, Fördersumme und Eigenanteil im Fenster eines Förderers lassen sich Texte einfach gestalten – wie in Chat-Programmen:'),
    h('table', { class: 'imp fmt-tab' }, h('thead', null, h('tr', null, h('th', null, 'Eingabe'), h('th', null, 'Ergebnis'))), h('tbody', null,
      z('* Punkt  oder  - Punkt', fmtText('* Punkt') + '<span class="muted small">sofort beim Tippen; Umschalt+Enter: nächster Punkt</span>'), z('1. Schritt', fmtText('1. Schritt')), z('*wichtig*', fmtText('*wichtig*')), z('_Hinweis_', fmtText('_Hinweis_')),
      z('+wichtig+', fmtText('+wichtig+')), z('~erledigt~', fmtText('~erledigt~')), z('https://…', 'wird ein anklickbarer Link'))),
    h('p', { class: 'muted small' }, 'Aufzählung: „* “ oder „- “ am Zeilenanfang wird beim Tippen sofort zum Punkt •. Umschalt+Enter setzt den nächsten Punkt (bei „1. “ die nächste Nummer), Enter geht in eine neue Zeile ohne Punkt. Strg+Enter oder Klick daneben übernimmt den Text.'),
    h('p', { class: 'muted small' }, 'Am einfachsten: ein Wort markieren – darüber erscheinen Knöpfe für fett, kursiv, unterstrichen, durchgestrichen und Aufzählung (auch Strg+B, Strg+I, Strg+U); die Formatierung ist sofort zu sehen. Die Zeichen links gehen beim Tippen genauso; sie müssen direkt am Wort stehen (*so*, nicht * so *).')),
    [['OK', true, 'primary']]);
}
function about() {
  modal('Bedarfsliste ' + APP_INFO.version, h('div', { class: 'help' },
    h('p', null, 'Strategischer Überblick über die Bedarfe der Diözese: Freigabe, Unterlagen, Förderplan und Nacharbeit. Programm und Daten stecken zusammen in dieser einen Datei; es wird nichts ins Internet gesendet.'),
    h('h3', null, 'Tastaturbefehle'), kuerzelTabelle(), h('h3', null, 'Was zuletzt neu ist'),
    ...CHANGELOG.slice(0, 5).map(c => h('div', null, h('h3', null, 'Version ' + c.version + (c.date ? ' · ' + fmtDate(c.date.slice(0, 10)) : '')), h('ul', null, c.items.map(i => h('li', null, i)))))), null, { wide: true });
}

// leer gebliebene Kontakte entfernen, wenn das Fenster beim Bearbeiten geschlossen wird
// wessen Kontakte: die eines Förderers (Knopf mit data-fid, im Fenster) oder die Zuständigen des Bedarfs (oben auf der Seite)
function kZiel(b, a) {
  if (a.dataset.fach) return { o: b.freigabe.fach, p: 'pers', ui: 'fEdit', id: b.id, box: '#fach-pers', max: 30, neu: leerZ };   // Personen beim Fachreferat
  if (!a.dataset.fid) return { o: b, p: 'zust', ui: 'zEdit', id: b.id, box: '#sec-eck', max: MAX_ZUST, neu: leerZ };
  const f = b.foerderer.find(x => x.id === a.dataset.fid);
  return f && { o: f, p: 'kontakte', ui: 'kEdit', id: f.id, box: '.foe-pop', max: MAX_KONTAKTE, neu: leerK };
}
// Zuständige bearbeiten: beim Namen Vorschläge aus allen Bedarfen; ein bekannter Name bringt Position, E-Mail und Telefon mit (nur in leere Zeilen)
document.addEventListener('focusin', e => {
  const inp = e.target;
  if (!inp.matches || !inp.matches('#sec-eck .k-li-n') || inp.dataset.sug) return;
  inp.dataset.sug = '1';
  const ergaenzen = () => {
    const b = cur(), z = b && getPath(b, inp.dataset.p.replace(/\.n$/, '')), v = z && zustVorbild(z.n, z); if (!v) return;   // Zuständige oder Fachreferat
    let neu = false;
    for (const p of ZUST_F) if (!(z[p] || '').trim() && v[p]) { z[p] = v[p]; neu = true; const x = inp.parentNode.querySelector('.k-li-' + p); if (x) x.value = v[p]; }
    if (neu) changed();
  };
  const key = suggest(inp, SRC.zust, () => { inp.dispatchEvent(new Event('input', { bubbles: true })); ergaenzen(); });
  inp.addEventListener('keydown', ev => { if (key(ev)) ev.preventDefault(); });
  inp.addEventListener('change', ergaenzen);
});
// Stichworte über das + im Kopf: eintippen und Enter (oder einen Vorschlag wählen) – es kommt als Marke dazu, das Feld bleibt für das
// nächste offen; Getipptes ohne Enter geht beim Schließen nicht verloren
function swPop(btn) {
  closeMenus();
  const b = cur(); if (!b) return;
  const inp = h('input', { type: 'text', class: 'sw-in', placeholder: 'Stichwort oder Fördertopf', 'aria-label': 'Stichwort oder Fördertopf hinzufügen', autocomplete: 'off' });
  const dazu = () => {
    const v = inp.value.trim(); inp.value = ''; if (!v) return;
    if (!b.stichworte.some(s => norm(s) === norm(v))) { b.stichworte.push(v); changed(); swap('d-sw', swHead(b), true); }
    setTimeout(() => { if (document.activeElement === inp) inp.dispatchEvent(new Event('focus')); });   // Liste wieder zeigen: gleich das nächste anklicken
  };
  const key = suggest(inp, () => SRC.stichwort().filter(s => !b.stichworte.includes(s)), dazu, { erster: false, all: true });   // gleich beim Öffnen alle vorhandenen
  inp.addEventListener('keydown', e => { if (key(e)) { e.preventDefault(); return; } if (e.key === 'Enter') { e.preventDefault(); dazu(); } else if (e.key === 'Escape') { dazu(); closeMenus(); } });
  inp.addEventListener('blur', () => dazu());
  placePop(h('div', { class: 'menu sw-pop' }, inp, h('div', { class: 'muted small' }, 'Enter fügt hinzu – gleich das nächste eintippen')), btn, 'right');
  inp.focus();
}
// Wechsel Liste ↔ Bedarf: der Bedarf gleitet von rechts über die Liste und beim Zurückgehen wieder hinaus (ohne Bewegung, wenn der
// Browser das nicht kann oder in Windows die Animationen ausgeschaltet sind). Die Liste steht danach wieder an derselben Stelle.
let LISTE_Y = 0;
function uebergang(r, fn) {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { fn(); return; }
  const html = document.documentElement; html.dataset.vt = r;
  document.startViewTransition(fn).finished.finally(() => { if (html.dataset.vt === r) delete html.dataset.vt; });
}
// o.offen: Förderplan bzw. Nacharbeit gleich aufgeklappt ('foe', 'nach'); o.danach: nach dem Zeichnen (z. B. zur Stelle springen)
// „+ Bedarf“ auf der Seite eines Bedarfs: gleich eine leere Seite zum Ausfüllen; bleibt sie unberührt, verschwindet sie beim Verlassen wieder
let NEU_LEER = null;
function neuerBedarfSeite() {
  const nb = blank(); D.bedarfe.unshift(nb); UI.tab = 'aktiv'; changed(); heuteDazu(nb.id);
  leerWeg(); NEU_LEER = { id: nb.id, s: JSON.stringify(nb) };
  oeffnen(nb.id, { danach: () => { const t = $('#f-titel'); if (t) t.focus(); } });
}
function leerWeg(bleibt) {
  const n = NEU_LEER; if (!n || n.id === bleibt) return;
  NEU_LEER = null; const i = D.bedarfe.findIndex(x => x.id === n.id);
  if (i >= 0 && JSON.stringify(D.bedarfe[i]) === n.s) { D.bedarfe.splice(i, 1); changed(); }
}
function oeffnen(id, o = {}) {
  leerWeg(id);
  if (UI.view === 'list') { LISTE_Y = scrollY; NAV = filtered().map(x => x.id); }
  closeMenus(); klickRuhe(); UI.view = 'detail'; UI.id = id; ZU = null;
  const b = D.bedarfe.find(x => x.id === id); if (b && o.offen) { ZU = zuStd(b); ZU[o.offen] = false; }
  uebergang('vor', () => { renderNow(); scrollTo(0, 0); if (o.danach) o.danach(); });
  setTimeout(kiCheck, 300);                                                        // Ergebnis von Copilot oder Cowork da?
}
// zurück: die Liste steht, wo sie war; der Fokus liegt auf dem Bedarf, von dem man kommt (mit ↑/↓ auf der Seite weitergeblättert: er wird ins Bild geholt)
function zurueck() { leerWeg(); closeMenus(); klickRuhe(); const id = UI.id; UI.view = 'list'; uebergang('zurueck', () => { renderNow(); scrollTo(0, LISTE_Y); zeileFokus(id); zeileZeigen(id); }); }
// Seite eines Bedarfs: ↓ / ↑ öffnen den nächsten bzw. vorigen Bedarf – in der Reihenfolge, die die Liste beim Öffnen hatte
// (steht er dort nicht, z. B. aus den Hinweisen geöffnet: die Liste mit Suche und Filtern, sonst alle Bedarfe seines Reiters)
let NAV = [];
function blaettern(d) {
  const b = cur(); if (!b) return;
  if (!NAV.includes(b.id)) { const L = filtered().map(x => x.id); NAV = L.includes(b.id) ? L : filterUndSortiere({ arch: !!b.archiv, alle: true }).map(x => x.id); }
  const L = NAV.filter(id => D.bedarfe.some(x => x.id === id)), id = L[L.indexOf(b.id) + d];
  if (!id) { toast(d > 0 ? 'Das ist der letzte Bedarf der Liste.' : 'Das ist der erste Bedarf der Liste.'); return; }
  leerWeg(id); closeMenus(); UI.id = id; UI.det = null; ZU = null;
  uebergang(d > 0 ? 'runter' : 'hoch', () => { renderNow(); scrollTo(0, 0); });
  setTimeout(kiCheck, 300);
}
// ← führt zurück zur Liste (dort öffnet → wieder einen Bedarf)
document.addEventListener('keydown', e => {
  const d = taste(e, 'd-naechster') ? 1 : taste(e, 'd-voriger') ? -1 : 0;           // Tasten: Zahnrad → Tastaturbefehle
  if (!d || UI.view !== 'detail' || UI.det || e.defaultPrevented) return;
  const el = document.activeElement;
  if ($('.menu, .modal, .le-sug, .fmt-bar, .foe-pop') || (el && el.closest && el.closest('input, textarea, select, [contenteditable]'))) return;
  e.preventDefault(); blaettern(d);
});
// Ein Feld übernimmt beim Verlassen und zeichnet neu – passiert das zwischen Drücken und Loslassen der Maus, verwirft der Browser den Klick
// (sein Ziel gibt es nicht mehr). Dann den Klick an das gleiche Element an derselben Stelle weitergeben, sonst bräuchte es zwei Klicks.
const KLICK = { el: null, sig: '' };
const klickZiel = t => t && t.closest ? t.closest('[data-le], [data-act], button, a[href], input, select, textarea, #list-body td') : null;
const klickSig = el => el ? [el.tagName, ...['act', 'le', 'fid', 'id', 'k', 'uid', 'v', 'p', 'kind', 'i'].map(k => el.dataset[k] || '')].join('|') : '';
document.addEventListener('pointerdown', e => { const el = e.button === 0 ? klickZiel(e.target) : null; KLICK.el = el; KLICK.sig = klickSig(el); }, true);
document.addEventListener('pointerup', e => {
  const el = KLICK.el; KLICK.el = null;
  if (!el || el.isConnected || e.button !== 0) return;
  const neu = klickZiel(e.target); if (!neu || klickSig(neu) !== KLICK.sig) return;
  let kam = false; const merk = () => { kam = true; };
  document.addEventListener('click', merk, { capture: true, once: true });
  setTimeout(() => { document.removeEventListener('click', merk, true); if (kam || !neu.isConnected) return; if (/^(INPUT|SELECT|TEXTAREA)$/.test(neu.tagName)) neu.focus(); else neu.click(); }, 0);
}, true);
// Doppelklick: der zweite Klick träfe sonst, was nach dem ersten erscheint (aufgeklappte Zeile, Seite des Bedarfs, wieder die Liste) –
// kurz nach so einem Wechsel zählt der zweite Klick eines Doppelklicks nicht. Bewusst einzeln geklickt geht weiterhin sofort.
let KLICK_RUHE = 0;
function klickRuhe() { KLICK_RUHE = performance.now() + 600; }
window.addEventListener('click', e => { if (e.detail > 1 && performance.now() < KLICK_RUHE) { e.preventDefault(); e.stopPropagation(); } }, true);
// Esc auf der Seite eines Bedarfs (nicht in einem Feld, Fenster oder Menü): zurück zur Liste
document.addEventListener('keydown', e => {
  if (!taste(e, 'd-zurueck') || UI.view !== 'detail' || UI.det || e.defaultPrevented) return;
  const el = document.activeElement;
  if ($('.menu, .modal, .cal-pop, .zeit-pop, .le-sug, .fmt-bar, .foe-pop') || (el && el.closest && el.closest('input, textarea, select, [contenteditable]'))) return;
  e.preventDefault(); zurueck();
}, true);
// zurückstellen bzw. verwerfen: fragt nach dem Grund (darf leer bleiben); „Wieder aufnehmen“ vergisst ihn
async function manuellSetzen(b, v, nurGrund) {
  if (!v) { b.manuell = ''; b.grundM = ''; changed(); keep(renderNow); return; }
  const w = v === 'verworfen' ? 'Verworfen' : 'Zurückgestellt';
  const t = await textFrage(nurGrund ? 'Begründung ändern' : v === 'verworfen' ? 'Bedarf verwerfen' : 'Bedarf zurückstellen', w + ', weil …', nurGrund ? b.grundM : '', 'Begründung – erscheint in der Liste (kann leer bleiben)', nurGrund ? 'Übernehmen' : v === 'verworfen' ? 'Verwerfen' : 'Zurückstellen');
  if (t == null) return;
  b.manuell = v; b.grundM = t.trim(); changed(); keep(renderNow);
}
function kAufraeumen(b) { const f = b && b.foerderer.find(x => x.id === UI.kEdit); if (f && f.kontakte.some(kontaktLeer)) { f.kontakte = f.kontakte.filter(c => !kontaktLeer(c)); changed(); } }
async function act(k, a, e) {
  const b = cur();
  switch (k) {
    case 'tab': if (UI.tab !== a.dataset.v) { UI.fSw = []; UI.heuteWahl = null; UI.paketWahl = null; } UI.tab = a.dataset.v; UI.view = 'list'; ORDER.ids = null; renderNow(); scrollTo(0, 0); return;   // Stichwörter je Reiter verschieden: Filter dort nicht unsichtbar weiterwirken lassen
    case 'open': oeffnen(a.dataset.id); return;
    case 'back': zurueck(); return;
    case 'sort-th': sortSpalte(a.dataset.k); return;
    case 'new': if (UI.view === 'detail') neuerBedarfSeite(); else neuerBedarf(); return;   // auf der Seite eines Bedarfs: gleich eine leere Seite
    case 'clear': Object.assign(UI, { q: '', fSw: [], prioKopf: 0 }); ORDER.ids = null; keep(renderNow); return;
    case 'prio-kopf': UI.prioKopf = ((UI.prioKopf || 0) + 1) % 3; ORDER.ids = null; keep(renderNow); return;
    case 'info': if ($('.info-pop')) { closeMenus(); return; } infoPop(a, INFO[a.dataset.v] || ''); return;
    case 'fw': if ($('.fw-pop')) closeMenus(); else fwPop(a); return;
    case 'st-menu': stMenu(a); return;
    case 'more': if ($('#mmenu')) closeMenus(); else moreMenu(a); return;
    case 'pen': { const el = $(`#foe-${a.dataset.fid} .fp-h`); if (el) { el.focus(); el.select(); } return; }
    case 'menu': if ($('#mmenu')) closeMenus(); else mainMenu(a); return;
    case 'colw-reset': colwSet(null, false); colwSet(null, true); closeMenus(); keep(renderNow); return;
    case 'theme': applyTheme(a.dataset.v); $$('#mmenu .mini-btn').forEach(x => x.classList.toggle('on', x === a)); return;
    case 'about': closeMenus(); about(); return;
    case 'undo': undo(); return;
    case 'fristen': if ($('.frist-pop')) closeMenus(); else fristPop(a); return;
    case 'ziel': springZu(a.dataset.id, a.dataset.z, a.dataset.fid); return;
    case 'ansicht': UI.ansicht = a.dataset.v === 'kompakt' ? 'kompakt' : 'voll'; keep(renderNow); return;
    case 'fmt-info': closeMenus(); fmtInfo(); return;
    case 'save': closeMenus(); if (FSA && ST.conn === 'none') await connectFolder(); else saveAll({}); renderNow(); return;
    case 'connect': await connectFolder(); renderNow(); return;
    case 'kartei': closeMenus(); if (ST.conn !== 'ok' && !await connectFolder()) return; await karteiChoose(); return;
    case 'kartei-erlauben': await karteiErlauben(); return;
    case 'kartei-info': toast('In der Programmdatei liest die Liste deine Excel „Banken- und Stiftungsübersicht“ aus dem Ordner ein. Hier stehen erfundene Förderer.'); return;
    case 'backup': closeMenus(); saveBackup(); return;
    case 'restore': closeMenus(); openBackup(); return;
    case 'kuerzel': closeMenus(); kuerzelInfo(); return;
    case 'tasten': tastenDialog(); return;
    case 'ki-liste': kiListeDialog(); return;
    case 'sw-filter': if ($('.swf-pop')) closeMenus(); else swFilterPop(a); return;
    case 'heute-wahl': UI.paketWahl = null; heuteWaehlen(); return;
    case 'paket-wahl': paketWaehlen(true); return;
    case 'paket-ende': paketWaehlen(false); return;
    case 'paket-leer': if (UI.paketWahl) { UI.paketWahl.clear(); keep(renderNow); } return;
    case 'paket-los': paketDialog(); return;
    case 'heute-fertig': heuteFertig(true); return;
    case 'heute-abbr': heuteFertig(false); return;
    case 'heute-leer': if (UI.heuteWahl) { UI.heuteWahl.clear(); keep(renderNow); } return;
    case 'heute-an': heuteZeigen(true); return;
    case 'heute-alle': heuteZeigen(false); return;
    case 'vorlagen': vorlagenDialog(); return;
    case 'fach-haupt': fachHauptDialog(); return;
    case 'pers-liste': personenListeDialog(); return;
    case 'upl-vorlage': closeMenus(); download('UPL_Vorlage.xlsx', await uplVorlageBlob()); return;
    case 'upl': { closeMenus(); const f = await pickFile('.xlsx'); if (f) await uplImport(f); return; }
    case 'ueb': closeMenus(); if (ST.conn !== 'ok' && !await connectFolder()) return; toast(await ueSchreiben(true) ? '„' + UEB_DATEI + '“ neben der Liste aktualisiert' : 'Noch keine Förderer – oder die Datei ist gerade in Excel geöffnet.', 'ok'); return;
    case 'pers-import': { closeMenus(); if (ST.conn !== 'ok' && !await connectFolder()) return; const f = await pickFile('.xlsx'); if (f) personenDatei(f); return; }
    case 'update': closeMenus(); updateProgram(); return;
    case 'vorlage-leer': closeMenus(); vorlageDownload(null); return;
    case 'reload': window.__blReload = true; location.reload(); return;
    case 'conflict-mine': resolveConflict('mine'); return;
    case 'conflict-theirs': resolveConflict('theirs'); return;
    case 'zip-go': { const z = ST.zipUpd; const f = z && await z.handle.getFile().catch(() => null); if (!f) { toast('Das Paket ist nicht mehr da.', 'warn'); ST.zipUpd = null; renderNow(); return; } updateProgram(Object.assign(await programFromFile(f), { pkg: z })); return; }
    case 'zip-later': UI.zipHide = ST.zipUpd.name + '@' + ST.zipUpd.info.version; renderNow(); return;
    case 'draft-restore': restoreDraft(); return;
    case 'draft-drop': dropOffer(); renderNow(); return;
    case 'demo-reset': { const before = JSON.stringify(D); D = normalize({ bedarfe: demoBedarfe() }); changed(); UI.view = 'list'; renderNow(); toast('Beispieldaten wiederhergestellt', 'ok', undoGanz(before)); return; }
    case 'link': {
      let host = ''; try { host = new URL(a.getAttribute('href')).hostname; } catch (er) { /* ungültiger Link */ }
      if (DEMO && host.endsWith('.example')) { e.preventDefault(); toast('Beispiel-Link: In der Programmdatei öffnet sich hier der Ordner bzw. die Seite im Browser.'); }
      return;
    }
  }
  if (!b || UI.view !== 'detail') return;
  switch (k) {
    case 'circ': circNext(a); break;
    case 'set': {
      const base = baseOf(a, b), p = a.dataset.p; let v = a.dataset.v;
      if (v === 'true') v = true; else if (v === 'false') v = false;
      if (a.dataset.toggle != null && getPath(base, p) === v) v = a.dataset.toggle;   // zweiter Klick auf den gewählten Stand nimmt ihn zurück
      if (p === 'manuell') { closeMenus(); manuellSetzen(b, v); return; }
      const alt = getPath(base, p); setPath(base, p, v); effects(b, base, p, v, alt); changed(); break;
    }
    case 'archive': {
      closeMenus();
      const offen = archivOffen(b);
      if (offen.length && !await confirmBox('Noch nicht alles erledigt', 'Noch offen: ' + offen.join(' · ') + '. Trotzdem ins Archiv?', 'Trotzdem archivieren')) return;
      b.archiv = true; changed(); UI.view = 'list'; renderNow(); scrollTo(0, 0); klickRuhe();
      toast(`„${b.titel || 'Bedarf'}“ liegt jetzt im Archiv`, 'ok', () => { if (D.bedarfe.includes(b) && b.archiv) { b.archiv = false; changed(); ORDER.ids = null; keep(renderNow); } }); return; }
    case 'unarchive': b.archiv = false; changed(); toast('Wieder in der Liste der Bedarfe', 'ok'); break;
    case 'del': {
      closeMenus();
      if (!await confirmBox('Bedarf löschen?', '„' + (b.titel || 'Neuer Bedarf') + '“ wird mit Förderplan und Nacharbeit gelöscht. Direkt danach lässt sich das noch rückgängig machen. Abgeschlossene Bedarfe lieber archivieren: Gelöschte fehlen auch in der Förderer-Übersicht.', 'Löschen')) return;
      const i = D.bedarfe.indexOf(b); D.bedarfe = D.bedarfe.filter(x => x !== b); changed(); UI.view = 'list'; renderNow(); scrollTo(0, 0); klickRuhe();
      toast('Bedarf gelöscht', 'ok', () => { if (!D.bedarfe.includes(b)) { D.bedarfe.splice(Math.min(i, D.bedarfe.length), 0, b); changed(); ORDER.ids = null; keep(renderNow); } }); return;
    }
    case 'rm-ul': b.unterlagen = b.unterlagen.filter(u => u.id !== a.dataset.uid); changed(); break;
    case 'add-foe': {
      const f = ff({}); b.foerderer.push(f); changed(); keep(renderNow);
      const el = $(`#foe-${f.id} input[data-p="name"]`); if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
      return;
    }
    case 'rm-foe': {
      const f0 = b.foerderer.find(f => f.id === a.dataset.fid);
      if (!await confirmBox('Förderer entfernen?', '„' + ((f0 && f0.name) || 'Ohne Namen') + '“ wird mit Summe, Stand, Pro und Contra aus dem Förderplan entfernt. Direkt danach lässt sich das noch rückgängig machen.', 'Entfernen')) return;
      if (!f0) return;
      const i = b.foerderer.indexOf(f0), mit = b.nach.ueb.mit.includes(f0.id);
      b.foerderer = b.foerderer.filter(f => f !== f0); b.nach.ueb.mit = b.nach.ueb.mit.filter(id => id !== f0.id); changed(); keep(renderNow);
      toast('Förderer entfernt', 'ok', () => { if (D.bedarfe.includes(b) && !b.foerderer.includes(f0)) { b.foerderer.splice(Math.min(i, b.foerderer.length), 0, f0); if (mit && !b.nach.ueb.mit.includes(f0.id)) b.nach.ueb.mit.push(f0.id); changed(); keep(renderNow); } }); return; }
    case 'pie-st': {                                                               // Stand am Kreisdiagramm weiterschalten (neu aufgeteilt beim Verlassen)
      const f = b.foerderer.find(x => x.id === a.dataset.fid); if (!f) return;
      if (geldDa(f)) return geldDaHinweis();
      const alt = f.status, v = ROT_FOE[alt] || 'geplant'; f.status = v; effects(b, f, 'status', v, alt); changed();
      a.setAttribute('class', 'ps ' + (v === 'abgelehnt' ? 'ab' : segKind(f)));
      PIE_HOLD = true; refresh();
      const pie = a.closest('#fin-pie');
      if (pie && !pie.dataset.wart) { pie.dataset.wart = '1'; pie.addEventListener('mouseleave', () => { PIE_HOLD = false; keep(renderNow); }, { once: true }); }
      return;
    }
    case 'zu': zuSet(b, a.dataset.v, !zuGet(b, a.dataset.v)); break;
    case 'pe': { const v = a.querySelector(':scope > .val');               // Klick auf den Scrollbalken (lange Beschreibung) ist kein Bearbeiten
      if (v && e && e.target === v && e.offsetX >= v.clientWidth) return; popEdit(a); return; }
    case 'det': UI.det = a.dataset.v; break;
    case 'det-zu': kAufraeumen(b); UI.det = null; UI.kEdit = null; break;
    case 'web': {                                                                   // Website öffnen – mit dem, was gerade eingetragen ist
      const f = b.foerderer.find(x => x.id === a.dataset.fid); if (!f) return;
      const u = webUrl(f.web); if (!u) { toast('Erst einen Link eintragen (https://…).', 'warn'); return; }
      if (DEMO && /\.example(\/|$)/.test(u)) { toast('Beispiel-Link: In der Programmdatei öffnet sich hier die Seite im Browser.'); return; }
      window.open(u, '_blank', 'noopener'); return;
    }
    // Kontakte im Fenster und Zuständige oben auf der Seite: Stift → bearbeiten, + → weiterer (höchstens drei), × → entfernen, ☆ → nach vorn, Fertig → leere entfernen
    case 'k-edit': case 'k-neu': {
      const z = kZiel(b, a); if (!z) return;
      if (z.ui === 'fEdit') { if (k === 'k-neu') fachDialog(b); else fachBearbeiten(b); return; }   // Fachreferat: „+“ sucht, Stift bearbeitet
      if (k === 'k-neu' && z.ui === 'zEdit' && !a.dataset.leer) { personenSuche(b); return; }   // weitere Zuständige: erst in der Personenliste suchen
      if (k === 'k-neu' && z.o[z.p].length < z.max) { z.o[z.p].push(z.neu()); changed(); }
      if (z.ui === 'zEdit' && UI.zEdit !== z.id) ZSNAP = JSON.stringify(z.o.zust.filter(c => k === 'k-neu' ? c !== z.o.zust[z.o.zust.length - 1] : true));   // Stand vor dem Bearbeiten
      UI[z.ui] = z.id; keep(renderNow);
      const L = $$(z.box + ' .k-ed'), e = k === 'k-neu' ? L[L.length - 1] : L[0], inp = e && e.querySelector('input'); if (inp) inp.focus();
      return;
    }
    // Fachreferat: Stift → Personen beim Bedarf; Stern je Bedarf; einmalige Frage nach der Hauptansprechperson des Fachreferats
    case 'fach-stern': { const f = b.freigabe.fach; f.stern = f.stern === a.dataset.k ? '' : a.dataset.k; changed(); swap('fach-pers', fachBlock(b), true); return; }
    case 'fach-std': fachHauptSetzen(b.freigabe.fach.name, a.dataset.k); swap('fach-pers', fachBlock(b), true); return;
    case 'rundmail': rundmail(b, a.dataset.v); return;
    case 'ics': icsLaden(b); return;
    case 'presse-wahl': { const u = b.nach.ueb, L = (u.presseAus || []).slice(), i = L.indexOf(a.dataset.k); if (i >= 0) L.splice(i, 1); else L.push(a.dataset.k); u.presseAus = L; changed(); break; }
    case 'k-weg': case 'k-haupt': {
      const z = kZiel(b, a); if (!z) return;
      const [c] = z.o[z.p].splice(+a.dataset.i, 1); if (k === 'k-haupt' && c) z.o[z.p].unshift(c);
      changed(); break;
    }
    case 'k-fertig': { const z = kZiel(b, a); if (z) { z.o[z.p] = z.o[z.p].filter(c => !kontaktLeer(c)); changed(); UI[z.ui] = null; if (z.ui === 'zEdit') zustFertig(b); if (z.ui === 'fEdit') fachFertig(b); } else UI.kEdit = null; break; }
    case 'sw-weg': b.stichworte.splice(+a.dataset.i, 1); changed(); break;
    case 'sw-pop': swPop(a); return;
    case 'prio-stern': b.prio = b.prio === 'hoch' ? 'mittel' : 'hoch'; changed(); break;     // Stern im Kopf der Seite: Prio an oder aus
    case 'grund-m': manuellSetzen(b, b.manuell, true); return;
    case 'deadline': calPop(a, b.deadline, v => { b.deadline = v || ''; changed(); keep(renderNow); }, { clear: 'Deadline entfernen' }); return;
    case 'geld': geldPop(a); return;
    case 'mit': { const m = b.nach.ueb.mit, i = m.indexOf(a.dataset.fid); if (i >= 0) m.splice(i, 1); else m.push(a.dataset.fid); changed(); break; }
    case 'vorlage': kiDialog(b, ['suchen', 'recherche']); return;
    case 'ki-erg': kiErgebnis(b); return;
    case 'ki': if (KI_NEU[b.id] && !DEMO) kiErgebnis(b); else kiDialog(b); return;          // roter Punkt: gleich das Ergebnis von Cowork zeigen
    case 'import': if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; } importFoerderplan(b); return;
    default: return;
  }
  keep(renderNow);
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (!a || !(a.closest('#app') || a.closest('.menu') || a.closest('#toasts') || a.closest('#peek'))) return;
  if (a.disabled) return;
  act(a.dataset.act, a, e);
});
document.addEventListener('keydown', e => {
  const el = e.target;
  if (taste(e, 'g-save')) { e.preventDefault(); if (!DEMO) saveAll({}); return; }
  // Strg+Z außerhalb von Eingabefeldern: letzte Änderung zurück (in Feldern macht der Browser das Tippen rückgängig)
  if (taste(e, 'g-undo') && !(el.closest && el.closest('input, textarea, select, [contenteditable]'))) { e.preventDefault(); undo(); return; }
  if (e.key === 'Escape' && UI.det && !$('.menu, .modal, .cal-pop')) { kAufraeumen(cur()); UI.det = null; UI.kEdit = null; keep(renderNow); return; }
  if (e.key === 'Enter' && el.id === 'ul-new') { e.preventDefault(); addUl(true); }
  if (e.key === 'Enter' && el.id === 'f-titel') { e.preventDefault(); el.blur(); }
  if (e.key === 'Enter' && el.classList && el.classList.contains('inline') && el.tagName === 'INPUT' && el.type !== 'date') { e.preventDefault(); el.blur(); }
});
let Q_T = null;
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.closest || !el.closest('#app')) return;
  if (el.dataset.ui === 'q') {
    if (UI.auf) aufklappen(null);
    UI.q = el.value;
    const zeig = () => { Q_T = null; const r = listBody(); swap('list-body', r.html, true);
      const c = $('#list-count'); if (c) c.textContent = zahlText(r.n, D.bedarfe.filter(b => !!b.archiv === (UI.tab === 'archiv')).length);
      const x = $('.list-head [data-act="clear"]'); if (x) x.hidden = !anyFilter(); };
    clearTimeout(Q_T); if (D.bedarfe.length > 150) Q_T = setTimeout(zeig, 150); else zeig();   // viele Bedarfe: erst nach einer kurzen Tipp-Pause
    return;
  }
  if (!el.dataset.p || el.type === 'checkbox' || el.tagName === 'SELECT') return;
  const b = cur(); if (!b) return;
  const base = baseOf(el, b);
  if ('num' in el.dataset) { liveNum(el); const v = deNum(el.value); if (v === null) return; setPath(base, el.dataset.p, v === '' ? null : v); }
  else {
    // Pfad aus dem Explorer eingefügt: gleich in den SharePoint-Link umwandeln (der Pfad bleibt für Cowork gemerkt)
    if (el.dataset.p === 'link' && !el.dataset.fid && istPfad(el.value)) { const l = ordnerLink(el.value); if (l) { b.pfad = l.pfad; el.value = l.link; toast('Pfad aus dem Explorer in einen SharePoint-Link umgewandelt.', 'ok'); } }
    setPath(base, el.dataset.p, el.value);
    // SharePoint-Link aus der Adresszeile: daraus lernt die Liste, wo „Ortsgliederungen“ liegt, und trägt fehlende Links bei anderen Bedarfen nach
    if (el.dataset.p === 'link' && !el.dataset.fid && spLernen(el.value)) { const n = spNachziehen(); if (n) toast('SharePoint-Link bei ' + n + (n === 1 ? ' weiterem Bedarf' : ' weiteren Bedarfen') + ' nachgetragen', 'ok'); }
  }
  UNDO.tipp = b.id + '|' + (el.dataset.fid || el.dataset.uid || '') + '|' + el.dataset.p;      // Tippen im selben Feld = ein Rückgängig-Schritt
  changed(); refresh();
});
document.addEventListener('change', e => {
  const el = e.target;
  if (!el.closest || !el.closest('#app')) return;
  if (el.id === 'ul-new') { addUl(false); return; }
  if (el.dataset.p === 'name' && el.dataset.fid) { const b = cur(), f = b && b.foerderer.find(x => x.id === el.dataset.fid); if (f && karteiFuellen(b, f)) { changed(); keep(renderNow); } return; }   // fertig getippt: Angaben aus der Kartei
  if (el.dataset.ui && el.dataset.ui !== 'q') { UI[el.dataset.ui] = el.type === 'checkbox' ? el.checked : el.value; keep(renderNow); return; }
  if (!el.dataset.p || !(el.type === 'checkbox' || el.tagName === 'SELECT')) return;
  const b = cur(); if (!b) return;
  setPath(baseOf(el, b), el.dataset.p, el.type === 'checkbox' ? el.checked : el.value);
  changed(); keep(renderNow);
});
document.addEventListener('focusout', e => {
  const el = e.target;
  if (!el.dataset || !('num' in el.dataset) || !el.dataset.p) return;
  const b = cur(); if (!b) return;
  const v = deNum(el.value), base = baseOf(el, b);
  if (v === null) { toast('„' + el.value + '“ ist keine Zahl – nicht übernommen (z. B. 1500 oder 1.234,50).', 'warn'); el.value = fmtNum(getPath(base, el.dataset.p)); return; }
  el.value = fmtNum(v === '' ? null : v);
});

/* ---------- Start */
function boot() {
  loadUI(); applyTheme();
  document.body.append(h('div', { id: 'toasts', 'aria-live': 'polite' }));
  let d = null, broken = null;
  if (DEMO) {
    try { d = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) { d = null; }
    if (!isData(d)) d = { bedarfe: demoBedarfe() };
    karteiSet(DEMO_KARTEI.map(k => Object.assign({ gl: [], kontakte: [], hist: {}, weg: [], notiz: '', schwer: '', web: '' }, k)));
  } else {
    const el = $('#bl-data'), raw = el ? el.textContent.trim() : '';
    if (raw) try { d = JSON.parse(raw); if (!isData(d)) throw new Error('keine Bedarfsliste gefunden'); } catch (e) { console.error(e); broken = (e && e.message) || String(e); d = null; }
  }
  // lässt sich ein Teil der Daten nicht verarbeiten: Hinweis „beschädigt“ mit „Datensicherung laden“ statt einer leeren Seite; gespeichert wird dann nicht
  const kaputt = e => { console.error(e); return 'Daten lassen sich nicht verarbeiten – ' + ((e && e.message) || e); };
  try { D = normalize(d || emptyData()); } catch (e) { broken = broken || kaputt(e); D = normalize(emptyData()); }
  SAVED_JSON = JSON.stringify(D); undoReset();
  if (broken) BROKEN = { reason: broken.replace(/^JSON\.parse: /, '').slice(0, 120) };
  if (!DEMO) checkDraft();
  try { renderNow(); } catch (e) { if (!BROKEN) BROKEN = { reason: kaputt(e).slice(0, 120) }; D = normalize(emptyData()); SAVED_JSON = JSON.stringify(D); undoReset(); renderNow(); }
  if (DEMO) return;
  restoreFolder().then(() => { renderNow(); askPermissionOnFirstClick(); }, e => { console.warn(e); ST.conn = 'none'; renderNow(); });
  // dieselbe Datei in einem zweiten Fenster oder Tab? Dann warnen – sonst überschreiben sich die Stände gegenseitig
  try {
    const kanal = new BroadcastChannel('bl:' + location.pathname), ich = uid('tab');
    kanal.onmessage = e => {
      const m = e.data || {}; if (m.von === ich) return;
      if (m.t === 'hallo') kanal.postMessage({ t: 'da', von: ich });
      const zwei = m.t !== 'weg'; if (ST.zweiTab !== zwei) { ST.zweiTab = zwei; safeRender(); }
    };
    kanal.postMessage({ t: 'hallo', von: ich });
    window.addEventListener('pagehide', () => kanal.postMessage({ t: 'weg', von: ich }));
  } catch (e) { /* Browser ohne BroadcastChannel */ }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (isDirty()) { saveDraft(); if (ST.conn === 'ok' && !ST.conflict) saveAll({ auto: true }); } }
    else { karteiScan(); personenScan(); kiCheck(); kiScan(); eingangScan(); }
  });
  window.addEventListener('beforeunload', e => { if (isDirty() && !window.__blReload) { saveDraft(); e.preventDefault(); e.returnValue = ''; } });
}
document.addEventListener('DOMContentLoaded', boot);
