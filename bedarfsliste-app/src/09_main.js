/* ===================================================================== Rahmen: Kopfzeile, Hinweise, Zeichnen, Bedienung, Start */

const DEMO_KEY = 'bedarfsliste-vorschau-4';
const UI = { view: 'list', id: null, tab: 'aktiv', q: '', fSw: '', det: null, kEdit: null };
const UI_KEEP = ['view', 'id', 'tab'];
const uiKey = () => (DEMO ? 'bl-ui-demo' : 'bl-ui:' + location.pathname);
function loadUI() { try { const o = JSON.parse(localStorage.getItem(uiKey()) || '{}'); for (const k of UI_KEEP) if (k in o) UI[k] = o[k]; } catch (e) { /* */ } }
function saveUI() { try { localStorage.setItem(uiKey(), JSON.stringify(Object.fromEntries(UI_KEEP.map(k => [k, UI[k]])))); } catch (e) { /* */ } }
const cur = () => D.bedarfe.find(b => b.id === UI.id) || null;

/* ---------- Darstellung: hell (Standard), dunkel oder wie Windows – eigenes Merkmal data-bl-theme, damit die Wahl auch in der Vorschau gilt */
const themeGet = () => { try { return localStorage.getItem('bl-theme') || 'light'; } catch (e) { return 'light'; } };
function applyTheme(t = themeGet()) {
  if (t === 'system') delete document.documentElement.dataset.blTheme; else document.documentElement.dataset.blTheme = t;
  try { localStorage.setItem('bl-theme', t); } catch (e) { /* */ }
}

/* ---------- Kopfzeile */
function saveBox() {
  if (DEMO) return '';
  const dirty = isDirty(), t = ST.lastSave ? ST.lastSave.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
  let label, cls = 'save', tip;
  if (!FSA) { label = dirty ? '● Speichern' : '✓ Gespeichert'; cls += dirty ? ' primary' : ''; tip = 'Speichern lädt die Datei herunter (Browser ohne Ordnerzugriff)'; }
  else if (ST.saving) { label = 'Speichert …'; tip = 'wird gespeichert'; }
  else if (BROKEN) { label = '⚠ Speichern gesperrt'; cls += ' primary'; tip = 'Die Daten dieser Datei waren beschädigt – siehe Hinweis oben'; }
  else if (ST.newer) { label = '⚠ Neustart nötig'; cls += ' primary'; tip = 'Im Ordner liegt eine neuere Programmversion – siehe Hinweis oben'; }
  else if (ST.conflict) { label = '⚠ Zwei Stände'; cls += ' primary'; tip = 'Die Datei wurde woanders geändert – siehe Hinweis oben'; }
  else if (ST.conn === 'none') { label = 'Speichern …'; cls += ' primary'; tip = 'Einmal den Ordner wählen – danach speichert die Liste automatisch'; }
  else if (ST.conn === 'needs-permission') { label = 'Speichern aktivieren'; cls += ' primary'; tip = 'Ein Klick: der Browser fragt, ob die Liste den Ordner bearbeiten darf'; }
  else if (ST.fail && dirty) { label = '⚠ Nicht gespeichert'; cls += ' primary'; tip = 'Speichern fehlgeschlagen: ' + ST.fail.msg + '. Neuer Versuch läuft automatisch – oder hier klicken.'; }
  else if (dirty) { label = '● wird gespeichert …'; tip = 'Jetzt speichern (Strg+S)'; }
  else { label = '✓ Gespeichert' + (t ? ' ' + t : ''); cls += ' ok'; tip = 'Alles gespeichert'; }
  return `<button id="savebox" class="${cls}" data-act="save" title="${esc(tip)}">${esc(label)}</button>`;
}
function updateSaveUI() {
  const box = $('#savebox');
  if (box) box.outerHTML = saveBox();
  document.title = (isDirty() ? '● ' : '') + 'Bedarfsliste';
}
function karteiChip() {
  if (DEMO) return `<button class="kchip ok" data-act="kartei-info">Förder-Kartei · ${KR.list.length} Beispiel-Förderer</button>`;
  if (KR.err) return `<button class="kchip warn" data-act="kartei" title="${esc(KR.err)}">Förder-Kartei: Problem</button>`;
  if (KR.list.length) return `<button class="kchip ok" data-act="kartei" title="${esc('aus „' + KR.name + '“, eingelesen ' + (KR.at ? KR.at.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '') + ' – klicken zum Wählen oder neu Einlesen')}">Förder-Kartei · ${KR.list.length} Förderer</button>`;
  if (ST.conn !== 'ok') return '<button class="kchip" data-act="kartei" title="Die Kartei wird aus dem Ordner der Bedarfsliste gelesen">Förder-Kartei: Ordner verbinden</button>';
  return '<button class="kchip warn" data-act="kartei" title="Keine passende Excel im Ordner gefunden – klicken zum Wählen">Förder-Kartei wählen</button>';
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
    <div class="actions">${karteiChip()}${saveBox()}<button class="primary" data-act="new">+ Bedarf</button><button class="icon gear" data-act="menu" aria-label="Einstellungen" title="Einstellungen: Darstellung hell oder dunkel, Sicherung, Update">${ICON_GEAR}</button></div>
    ${b ? `<div class="subbar"><button class="back" data-act="back">‹ Alle Bedarfe</button><div id="d-steps">${steps(b)}</div></div>` : ''}
  </header>`;
}
function bannersHtml() {
  const B = [], ban = (cls, text, btns = '') => B.push(`<div class="banner ${cls}"><span>${text}</span>${btns}</div>`);
  if (DEMO) ban('', '<b>Vorschau</b> mit erfundenen Beispieldaten. Änderungen merkt sich nur dieser Browser; Speichern, Förder-Kartei und Excel gibt es in der Programmdatei.', '<button class="link" data-act="demo-reset">Beispieldaten zurücksetzen</button>');
  if (BROKEN) ban('err', 'Die Daten dieser Datei lassen sich nicht lesen (' + esc(BROKEN.reason) + '). Damit nichts überschrieben wird, speichert die Liste nicht.', '<button class="primary" data-act="restore">Datensicherung laden …</button>');
  if (ST.newer) ban('err', 'Im Ordner liegt eine neuere Version der Bedarfsliste (' + esc(ST.newer.version) + '). Bitte neu laden, damit nichts mit der alten Version überschrieben wird.', '<button class="primary" data-act="reload">Neu laden</button>');
  if (ST.conflict) ban('err', 'Die Datei wurde woanders gespeichert (' + esc(fmtStamp(ST.conflict.other.meta && ST.conflict.other.meta.savedAt)) + '), während hier ungespeicherte Änderungen offen sind.', '<button data-act="conflict-theirs">Stand aus der Datei laden</button><button class="primary" data-act="conflict-mine">Meinen Stand behalten</button>');
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
    const fk = ae && ae.closest && ae.closest('#app') ? (ae.id ? '#' + CSS.escape(ae.id) : ae.dataset && ae.dataset.p ? `[data-p="${ae.dataset.p}"]` + (ae.dataset.fid ? `[data-fid="${ae.dataset.fid}"]` : '') + (ae.dataset.uid ? `[data-uid="${ae.dataset.uid}"]` : '') : null) : null;
    let sel = null; try { sel = ae && 'selectionStart' in ae ? [ae.selectionStart, ae.selectionEnd] : null; } catch (e) { /* */ }
    const b = UI.view === 'detail' ? cur() : null;
    if (UI.view === 'detail' && !b) UI.view = 'list';
    // Liste: Reihenfolge bleibt, solange man in ihr arbeitet (Zeilen springen nicht weg); neu sortiert wird beim Zurückkommen
    if (UI.view !== 'list') ORDER.ids = null; else if (!ORDER.ids) ORDER.ids = filtered().map(x => x.id);
    if (!b || !b.foerderer.some(f => f.id === UI.det)) UI.det = null;
    if (UI.kEdit !== UI.det) UI.kEdit = null;
    PIE_HOLD = false;
    app.innerHTML = headerHtml() + bannersHtml() + (b ? bedarfView(b) : listView());
    strgSet(CTRL_NOW);
    if (fk) { const e = $(fk, app); if (e) { e.focus({ preventScroll: true }); if (sel && 'setSelectionRange' in e) try { e.setSelectionRange(sel[0], sel[1]); } catch (x) { /* */ } } }
    document.title = (isDirty() ? '● ' : '') + 'Bedarfsliste';
    saveUI();
  } finally { _rendering = false; }
}
function keep(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }
// neu zeichnen, aber nicht mitten im Tippen
function safeRender() {
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.closest('#app')) { ae.addEventListener('blur', () => setTimeout(() => keep(renderNow), 0), { once: true }); return; }
  keep(renderNow);
}
function swap(id, html, force) { const el = document.getElementById(id); if (!el || (!force && el.contains(document.activeElement))) return; el.innerHTML = html; }
// nach jeder Eingabe: nur die abgeleiteten Teile neu zeichnen, das Eingabefeld behält den Fokus
function refresh() {
  const b = cur();
  if (UI.view !== 'detail' || !b) return;
  swap('d-meta', metaRest(b)); swap('d-steps', steps(b));
  swap('fr-blk', frBlock(b)); if (!PIE_HOLD) swap('fin-pie', finPie(b)); swap('fin-rows', finRows(b)); swap('fin-eig', finEigPct(b)); swap('link-btn', linkBtn(b)); swap('copy-btn', copyBtn(b));
  b.foerderer.forEach(f => { swap('fw-' + f.id, foeWarn(b, f)); swap('dk-' + f.id, detKartei(f)); swap('ds-' + f.id, detSummary(f)); swap('sh-' + f.id, foeShare(b, f)); });
  swap('nach-body', nachBody(b)); swap('foe-kurz', esc(foeKurz(b)));
}

/* ---------- Bedienung */
function effects(b, base, p, v) {
  const m = p.match(/^freigabe\.(\w+)\.st$/);
  if (m) {
    const it = b.freigabe[m[1]];
    if (v === 'offen') { it.angefragt = ''; it.erledigt = ''; }
    if (v === 'angefragt') { if (!it.angefragt) it.angefragt = today(); it.erledigt = ''; }
    if ((v === 'ok' || v === 'nein') && !it.erledigt) it.erledigt = today();
  }
  if (p === 'status' && base !== b) {
    const f = base;
    if (['beantragt', 'zugesagt', 'abgelehnt'].includes(v) && !f.beantragtAm) f.beantragtAm = today();
    if (v === 'zugesagt' || v === 'abgelehnt') { if (!f.entscheidungAm) f.entscheidungAm = today(); } else f.entscheidungAm = '';
    if (v === 'zugesagt') { if (f.zugesagt == null) f.zugesagt = f.betrag; if (b.nach.ueb.noetig && !b.nach.ueb.mit.includes(f.id)) b.nach.ueb.mit.push(f.id); }
    if (v === 'abgelehnt') b.nach.ueb.mit = b.nach.ueb.mit.filter(id => id !== f.id);
  }
}
function baseOf(el, b) {
  if (el.dataset.fid) return b.foerderer.find(f => f.id === el.dataset.fid);
  if (el.dataset.uid) return b.unterlagen.find(u => u.id === el.dataset.uid);
  return b;
}
function addZust() {
  const b = cur(), el = $('#zust-new'), v = el ? el.value.trim() : '';
  if (!b || !v) return;
  if (!b.zust.includes(v)) b.zust.push(v);
  el.value = ''; changed(); swap('zust-chips', zustChips(b), true);
}
function addUl(refocus) {
  const b = cur(), el = $('#ul-new'), v = el ? el.value.trim() : '';
  if (!b || !v) return;
  b.unterlagen.push(UL(v, 'fehlt')); el.value = ''; changed(); swap('ul-body', unterlagenList(b), true);
  if (refocus) { const n = $('#ul-new'); if (n) n.focus(); }
}
function copyPath(b) {
  const p = unquote(b.pfad || '').trim(); if (!p) return;
  const done = () => toast('Pfad kopiert. Im Explorer: Strg+L, dann Strg+V', 'ok');
  const fail = () => { const el = $('input[data-p="pfad"]'); if (el) { el.focus(); el.select(); } toast('Pfad markiert – jetzt mit Strg+C kopieren'); };
  try { navigator.clipboard.writeText(p).then(done, fail); } catch (e) { fail(); }
}
const undoTo = before => () => { D = normalize(JSON.parse(before)); changed(); keep(renderNow); };
function mainMenu(btn) {
  closeMenus();
  const item = (act, label, v) => h('button', { role: 'menuitem', 'data-act': act, 'data-v': v || '' }, label);
  const th = themeGet();
  const m = h('div', { class: 'menu', id: 'mmenu', role: 'menu' },
    h('div', { class: 'menu-row' }, h('span', null, 'Darstellung'), ...[['light', 'hell'], ['dark', 'dunkel'], ['system', 'wie Windows']].map(([v, l]) =>
      h('button', { class: 'mini-btn' + (th === v ? ' on' : ''), 'data-act': 'theme', 'data-v': v }, l))),
    h('hr'),
    colwGet() ? item('colw-reset', 'Spaltenbreiten der Liste zurücksetzen') : null,
    item('vorlage-leer', 'Leere Förderplan-Vorlage (Excel)'),
    DEMO ? null : item('kartei', 'Förder-Kartei wählen oder neu einlesen …'),
    h('hr'),
    DEMO ? null : item('backup', 'Datensicherung herunterladen (.json)'),
    DEMO ? null : item('restore', 'Datensicherung laden …'),
    DEMO ? null : item('update', 'Programm-Update einspielen …'),
    h('hr'),
    item('about', 'Über die Bedarfsliste (Version ' + APP_INFO.version + ')'));
  document.body.append(m);
  const r = btn.getBoundingClientRect();
  m.style.top = (r.bottom + 4) + 'px'; m.style.right = Math.max(8, innerWidth - r.right) + 'px';
  const f = m.querySelector('button'); if (f) f.focus();
}
function about() {
  modal('Bedarfsliste ' + APP_INFO.version, h('div', { class: 'help' },
    h('p', null, 'Strategischer Überblick über die Bedarfe der Diözese: Freigabe, Unterlagen, Förderplan und Nacharbeit. Programm und Daten stecken zusammen in dieser einen Datei; es wird nichts ins Internet gesendet.'),
    ...CHANGELOG.slice(0, 5).map(c => h('div', null, h('h3', null, 'Version ' + c.version + (c.date ? ' · ' + fmtDate(c.date.slice(0, 10)) : '')), h('ul', null, c.items.map(i => h('li', null, i)))))), null, { wide: true });
}

// leer gebliebene Kontakte entfernen, wenn das Fenster beim Bearbeiten geschlossen wird
function kAufraeumen(b) { const f = b && b.foerderer.find(x => x.id === UI.kEdit); if (f && f.kontakte.some(kontaktLeer)) { f.kontakte = f.kontakte.filter(c => !kontaktLeer(c)); changed(); } }
async function act(k, a, e) {
  const b = cur();
  switch (k) {
    case 'tab': UI.tab = a.dataset.v; UI.view = 'list'; ORDER.ids = null; renderNow(); scrollTo(0, 0); return;
    case 'open': UI.view = 'detail'; UI.id = a.dataset.id; renderNow(); scrollTo(0, 0); return;
    case 'back': UI.view = 'list'; renderNow(); scrollTo(0, 0); return;
    case 'new': neuerBedarf(); return;
    case 'clear': Object.assign(UI, { q: '', fSw: '' }); keep(renderNow); return;
    case 'info': if ($('.info-pop')) { closeMenus(); return; } infoPop(a, INFO[a.dataset.v] || ''); return;
    case 'fw': if ($('.fw-pop')) closeMenus(); else fwPop(a); return;
    case 'st-menu': stMenu(a); return;
    case 'more': if ($('#mmenu')) closeMenus(); else moreMenu(a); return;
    case 'pen': { const el = $(`#foe-${a.dataset.fid} .fp-h`); if (el) { el.focus(); el.select(); } return; }
    case 'prio-menu': e.stopPropagation(); prioMenu(a); return;
    case 'prio-set': { const x = D.bedarfe.find(y => y.id === a.dataset.id); if (x) { x.prio = a.dataset.v; changed(); } closeMenus(); keep(renderNow); return; }
    case 'menu': if ($('#mmenu')) closeMenus(); else mainMenu(a); return;
    case 'colw-reset': colwSet(null); closeMenus(); keep(renderNow); return;
    case 'theme': applyTheme(a.dataset.v); $$('#mmenu .mini-btn').forEach(x => x.classList.toggle('on', x === a)); return;
    case 'about': closeMenus(); about(); return;
    case 'save': closeMenus(); if (FSA && ST.conn === 'none') await connectFolder(); else saveAll({}); renderNow(); return;
    case 'connect': await connectFolder(); renderNow(); return;
    case 'kartei': closeMenus(); if (ST.conn !== 'ok' && !await connectFolder()) return; await karteiChoose(); return;
    case 'kartei-info': toast('In der Programmdatei liest die Liste deine Excel „Banken- und Stiftungsübersicht“ aus dem Ordner ein. Hier stehen erfundene Förderer.'); return;
    case 'backup': closeMenus(); saveBackup(); return;
    case 'restore': closeMenus(); openBackup(); return;
    case 'update': closeMenus(); updateProgram(); return;
    case 'vorlage-leer': closeMenus(); vorlageDownload(null); return;
    case 'reload': window.__blReload = true; location.reload(); return;
    case 'conflict-mine': resolveConflict('mine'); return;
    case 'conflict-theirs': resolveConflict('theirs'); return;
    case 'zip-go': { const z = ST.zipUpd; const f = z && await z.handle.getFile().catch(() => null); if (!f) { toast('Das Paket ist nicht mehr da.', 'warn'); ST.zipUpd = null; renderNow(); return; } updateProgram(Object.assign(await programFromFile(f), { pkg: z })); return; }
    case 'zip-later': UI.zipHide = ST.zipUpd.name + '@' + ST.zipUpd.info.version; renderNow(); return;
    case 'draft-restore': restoreDraft(); return;
    case 'draft-drop': clearDraft(); renderNow(); return;
    case 'demo-reset': { const before = JSON.stringify(D); D = normalize({ bedarfe: demoBedarfe() }); changed(); UI.view = 'list'; renderNow(); toast('Beispieldaten wiederhergestellt', 'ok', undoTo(before)); return; }
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
      setPath(base, p, v); effects(b, base, p, v); changed(); break;
    }
    case 'archive': { const before = JSON.stringify(D); b.archiv = true; changed(); UI.view = 'list'; renderNow(); scrollTo(0, 0); toast(`„${b.titel || 'Bedarf'}“ liegt jetzt im Archiv`, 'ok', undoTo(before)); return; }
    case 'unarchive': b.archiv = false; changed(); toast('Wieder in der Liste der Bedarfe', 'ok'); break;
    case 'del': {
      if (!await confirmBox('Bedarf löschen?', '„' + (b.titel || 'Neuer Bedarf') + '“ wird mit Förderplan und Nacharbeit gelöscht. Direkt danach lässt sich das noch rückgängig machen.', 'Löschen')) return;
      const before = JSON.stringify(D); D.bedarfe = D.bedarfe.filter(x => x !== b); changed(); UI.view = 'list'; renderNow(); scrollTo(0, 0); toast('Bedarf gelöscht', 'ok', undoTo(before)); return;
    }
    case 'rm-zust': b.zust.splice(+a.dataset.i, 1); changed(); swap('zust-chips', zustChips(b), true); return;
    case 'rm-ul': b.unterlagen = b.unterlagen.filter(u => u.id !== a.dataset.uid); changed(); break;
    case 'add-foe': {
      const f = ff({}); b.foerderer.push(f); changed(); keep(renderNow);
      const el = $(`#foe-${f.id} input[data-p="name"]`); if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
      return;
    }
    case 'rm-foe': {
      const f0 = b.foerderer.find(f => f.id === a.dataset.fid);
      if (!await confirmBox('Förderer entfernen?', '„' + ((f0 && f0.name) || 'Ohne Namen') + '“ wird mit Summe, Stand, Pro und Contra aus dem Förderplan entfernt. Direkt danach lässt sich das noch rückgängig machen.', 'Entfernen')) return;
      const before = JSON.stringify(D); b.foerderer = b.foerderer.filter(f => f.id !== a.dataset.fid); b.nach.ueb.mit = b.nach.ueb.mit.filter(id => id !== a.dataset.fid); changed(); keep(renderNow); toast('Förderer entfernt', 'ok', undoTo(before)); return; }
    case 'pie-st': {                                                               // Stand am Kreisdiagramm weiterschalten (neu aufgeteilt beim Verlassen)
      const f = b.foerderer.find(x => x.id === a.dataset.fid); if (!f) return;
      const v = ROT_FOE[f.status] || 'geplant'; f.status = v; effects(b, f, 'status', v); changed();
      a.setAttribute('class', 'ps ' + (v === 'abgelehnt' ? 'ab' : segKind(f)));
      PIE_HOLD = true; refresh();
      const pie = a.closest('#fin-pie');
      if (pie && !pie.dataset.wart) { pie.dataset.wart = '1'; pie.addEventListener('mouseleave', () => { PIE_HOLD = false; keep(renderNow); }, { once: true }); }
      return;
    }
    case 'zu': zuSet(a.dataset.v, !zuGet(a.dataset.v)); break;
    case 'pe': popEdit(a); return;
    case 'det': UI.det = a.dataset.v; break;
    case 'det-zu': kAufraeumen(b); UI.det = null; UI.kEdit = null; break;
    case 'web': {                                                                   // Website öffnen – mit dem, was gerade eingetragen ist
      const f = b.foerderer.find(x => x.id === a.dataset.fid); if (!f) return;
      const u = webUrl(f.web); if (!u) { toast('Erst einen Link eintragen (https://…).', 'warn'); return; }
      if (DEMO && /\.example(\/|$)/.test(u)) { toast('Beispiel-Link: In der Programmdatei öffnet sich hier die Seite im Browser.'); return; }
      window.open(u, '_blank', 'noopener'); return;
    }
    // Kontakte im Fenster: Stift → bearbeiten, + → weiterer (höchstens drei), × → entfernen, ☆ → Hauptkontakt, Fertig → leere entfernen
    case 'k-edit': case 'k-neu': {
      const f = b.foerderer.find(x => x.id === a.dataset.fid); if (!f) return;
      if (k === 'k-neu' && f.kontakte.length < MAX_KONTAKTE) { f.kontakte.push(leerK()); changed(); }
      UI.kEdit = f.id; keep(renderNow);
      const L = $$('.foe-pop .k-ed'), z = k === 'k-neu' ? L[L.length - 1] : L[0], inp = z && z.querySelector('input'); if (inp) inp.focus();
      return;
    }
    case 'k-weg': case 'k-haupt': {
      const f = b.foerderer.find(x => x.id === a.dataset.fid); if (!f) return;
      const [c] = f.kontakte.splice(+a.dataset.i, 1); if (k === 'k-haupt' && c) f.kontakte.unshift(c);
      changed(); break;
    }
    case 'k-fertig': { const f = b.foerderer.find(x => x.id === a.dataset.fid); if (f) { f.kontakte = f.kontakte.filter(c => !kontaktLeer(c)); changed(); } UI.kEdit = null; break; }
    case 'geld': geldPop(a); return;
    case 'mit': { const m = b.nach.ueb.mit, i = m.indexOf(a.dataset.fid); if (i >= 0) m.splice(i, 1); else m.push(a.dataset.fid); changed(); break; }
    case 'copy-path': copyPath(b); return;
    case 'vorlage': rechDialog(b); return;
    case 'import': if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; } importFoerderplan(b); return;
    default: return;
  }
  keep(renderNow);
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (!a || !(a.closest('#app') || a.closest('.menu') || a.closest('#toasts'))) return;
  if (a.disabled) return;
  act(a.dataset.act, a, e);
});
document.addEventListener('keydown', e => {
  const el = e.target;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!DEMO) saveAll({}); return; }
  if (e.key === 'Escape' && UI.det && !$('.menu, .modal, .cal-pop')) { kAufraeumen(cur()); UI.det = null; UI.kEdit = null; keep(renderNow); return; }
  if (e.key === 'Enter' && el.matches && el.matches('tr[data-act="open"]')) { e.preventDefault(); act('open', el, e); }
  if (e.key === 'Enter' && el.id === 'zust-new') { e.preventDefault(); addZust(); }
  if (e.key === 'Enter' && el.id === 'ul-new') { e.preventDefault(); addUl(true); }
  if (e.key === 'Enter' && el.id === 'f-titel') { e.preventDefault(); el.blur(); }
  if (e.key === 'Enter' && el.classList && el.classList.contains('inline') && el.tagName === 'INPUT' && el.type !== 'date') { e.preventDefault(); el.blur(); }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.closest || !el.closest('#app')) return;
  if (el.dataset.ui === 'q') {
    UI.q = el.value; const r = listBody(); swap('list-body', r.html, true);
    const c = $('#list-count'); if (c) c.textContent = r.n + ' von ' + D.bedarfe.filter(b => !!b.archiv === (UI.tab === 'archiv')).length;
    return;
  }
  if (!el.dataset.p || el.type === 'checkbox' || el.tagName === 'SELECT') return;
  const b = cur(); if (!b) return;
  const base = baseOf(el, b);
  if ('num' in el.dataset) { liveNum(el); const v = deNum(el.value); if (v === null) return; setPath(base, el.dataset.p, v === '' ? null : v); }
  else {
    // „Als Pfad kopieren“ (Strg+Umschalt+C) setzt Anführungszeichen – die braucht der Explorer nicht
    if (el.dataset.p === 'pfad' && /^\s*"|"\s*$/.test(el.value)) el.value = unquote(el.value);
    setPath(base, el.dataset.p, el.value);
  }
  if (el.dataset.p === 'name' && el.dataset.fid && !base.art) {               // Förderer aus der Kartei: Art gleich mit eintragen
    const k = kartei(base.name), art = k ? artFromKartei(k, base.name) : '';
    if (art) { base.art = art; const s = $('#art-' + base.id); if (s) { s.value = art; s.classList.remove('empty'); } }
  }
  changed(); refresh();
});
document.addEventListener('change', e => {
  const el = e.target;
  if (!el.closest || !el.closest('#app')) return;
  if (el.id === 'zust-new') { addZust(); return; }
  if (el.id === 'ul-new') { addUl(false); return; }
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
  D = normalize(d || emptyData()); SAVED_JSON = JSON.stringify(D);
  if (broken) BROKEN = { reason: broken.replace(/^JSON\.parse: /, '').slice(0, 120) };
  if (!DEMO) checkDraft();
  renderNow();
  if (DEMO) return;
  restoreFolder().then(() => { renderNow(); askPermissionOnFirstClick(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (isDirty() && ST.conn === 'ok' && !ST.conflict) saveAll({ auto: true }); }
    else karteiScan();
  });
  window.addEventListener('beforeunload', e => { if (isDirty() && !window.__blReload) { saveDraft(); e.preventDefault(); e.returnValue = ''; } });
}
document.addEventListener('DOMContentLoaded', boot);
