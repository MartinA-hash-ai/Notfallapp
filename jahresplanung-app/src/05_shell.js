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
    h('div', { class: 'brand' }, h('img', { class: 'logo', src: LOGO, alt: 'Malteser' }), h('div', null, h('strong', null, 'Jahresplanung Außenkommunikation'), h('span', null, 'Fundraising · Diözese Paderborn'))),
    h('div', { class: 'year' },
      h('button', { class: 'icon', 'aria-label': 'Vorjahr', onclick: () => { UI.year--; renderNow(); } }, '‹'),
      h('span', { class: 'y' }, UI.year),
      h('button', { class: 'icon', 'aria-label': 'Folgejahr', onclick: () => { UI.year++; renderNow(); } }, '›')),
    h('nav', { class: 'tabs' }, VIEWS.map(tab)),
    h('div', { class: 'actions' },
      h('button', { class: 'icon', tip: 'Rückgängig (Strg+Z)', disabled: !UNDO.length, onclick: undo }, '↶'),
      h('button', { class: 'icon', tip: 'Wiederholen (Strg+Y)', disabled: !REDO.length, onclick: redo }, '↷'),
      h('button', { class: 'warnbtn' + (nW ? ' has' : ''), tip: (nW ? nW + ' Warnung' + (nW > 1 ? 'en' : '') : 'Keine Warnungen') + (nI ? ', ' + nI + ' Hinweis' + (nI > 1 ? 'e' : '') : '') + ' für ' + UI.year,
        onclick: () => { UI.warnOpen = !UI.warnOpen; renderNow(); } },
        nW ? '⚠ ' + nW : '✓', nI ? h('span', { class: 'sub' }, ' · ' + nI) : null),
      menuButton('Export ▾', [
        ['PDF exportieren …', pdfDialog], null,
        ['Excel-Datei (.xlsx)', exportExcel], ['Outlook-Kalender (.ics)', exportICS], null,
        ['Datensicherung exportieren (.json)', exportJSON], ['Datensicherung importieren …', openFile]]),
      saveBox(),
      menuButton('⋯', [
        [(UI.autoSave === false ? '☐' : '☑') + ' Automatisch speichern', () => { UI.autoSave = UI.autoSave === false; saveUI(); if (UI.autoSave && isDirty()) scheduleAutosave(); renderNow(); toast('Automatisch speichern ' + (UI.autoSave ? 'an' : 'aus')); }],
        ['Speicherort (Mailing-Ordner) neu wählen …', async () => { ST.conn = 'none'; ST.dir = null; await connectFolder(); renderNow(); }], null,
        ['Daten aus anderer Datei übernehmen …', openFile], ['Kopie speichern unter …', saveCopy], ['Daten als JSON sichern', exportJSON], null,
        [(DARK ? '☀ Helles Design' : '☾ Dunkles Design'), () => setTheme(DARK ? 'light' : 'dark')],
        ['Programm-Update einspielen …', updateProgram], null,
        ['Einstellungen …', settingsDialog], ['Hilfe', helpDialog]], 'right')));
}

function banners() {
  const out = h('div', { class: 'banners' });
  if (ST.conflict) {
    const o = ST.conflict.other.meta || {};
    out.append(h('div', { class: 'banner err' },
      h('span', null, (o.savedBy || 'Jemand') + ' hat ' + fmtStamp(o.savedAt) + ' einen neueren Stand gespeichert, während du Änderungen gemacht hast. Welcher Stand soll gelten?'),
      h('button', { onclick: () => resolveConflict(false) }, 'Stand von ' + (o.savedBy || 'der Datei') + ' laden'),
      h('button', { class: 'primary', onclick: () => resolveConflict(true) }, 'Meinen Stand speichern')));
  } else if (FSA && ST.conn !== 'ok' && isDirty()) out.append(h('div', { class: 'banner warn' },
    h('span', null, 'Deine Änderungen sind noch nicht gespeichert.' + (ST.conn === 'needs-permission' ? ' Ein Klick genügt – der Browser fragt kurz, ob die App den Ordner bearbeiten darf.' : ' Einmal den Mailing-Ordner wählen, danach speichert die App automatisch.')),
    h('button', { class: 'primary', onclick: () => save() }, ST.conn === 'needs-permission' ? 'Speichern aktivieren' : 'Speicherort wählen')));
  if (ST.xlsxErr && !UI.xlsxErrClosed) out.append(h('div', { class: 'banner warn' },
    h('span', null, 'Die Excel-Ansicht „' + VIEW_XLSX + '“ konnte nicht aktualisiert werden (ist sie gerade in Excel geöffnet?). Das Programm selbst ist gespeichert; beim nächsten Speichern versucht es die App erneut.'),
    h('button', { onclick: () => { UI.xlsxErrClosed = true; renderNow(); } }, 'Ausblenden')));
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
  $$('.day.span', main).forEach(c => { c.classList.remove('span', 'span-s', 'span-e'); c.style.removeProperty('--hc'); });
  const x = id && C.byId.get(id);
  if (!x) return;
  const pts = [x.s, x.i, x.pal].filter(v => v != null);
  if (pts.length < 2) return;
  const a = Math.min(...pts), b = Math.max(...pts), cells = new Map($$('.day[data-dn]', main).map(c => [+c.dataset.dn, c]));
  for (let n = a; n <= b; n++) {
    const c = cells.get(n); if (!c) continue;
    c.classList.add('span'); if (n === a) c.classList.add('span-s'); if (n === b) c.classList.add('span-e');
    c.style.setProperty('--hc', x.color);
  }
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
// Termin auf den Arbeitstag davor legen (bei Detailplänen passt sich die Dauer eines Schritts an)
function applyFix(d, w) {
  const m = findM(d, w.mid), pal = dn(m && m.pal);
  if (!m || pal == null) return false;
  if (w.fix.t === 'P') { m.pal = ds(w.fix.to); return true; }
  if (m.plan) return !!adjustMark(m, w.fix.t, w.fix.to);
  if (w.fix.t === 'S') m.vorlaufS = pal - w.fix.to; else m.vorlaufI = pal - w.fix.to;
  return true;
}
const FIX_LABEL = { S: 'Start Selektion', I: 'Start Inhalt', P: 'PAL' };
function fixDate(w) {
  const x = C.byId.get(w.mid); if (!x) return;
  commit(d => applyFix(d, w), x.m.name + ': ' + FIX_LABEL[w.fix.t] + ' → ' + fmtW(w.fix.to) + (x.m.plan && w.fix.t !== 'P' ? ' (Dauer im Detailplan angepasst)' : ''));
}
async function fixAll(list) {
  if (!await confirmBox('Alle vorziehen', list.length + ' Termine werden auf den jeweils vorherigen Arbeitstag gelegt (ein PAL auf Samstag bleibt erlaubt). Bei Detailplänen passt sich die Dauer eines Arbeitsschritts an. Strg+Z macht es rückgängig.', 'Vorziehen')) return;
  // nacheinander, weil sich Termine derselben Maßnahme gegenseitig beeinflussen können
  commit(d => { for (const w of list) applyFix(d, w); }, list.length + ' Termine vorgezogen');
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

/* ---------- Einstellungen: alles wirkt sofort, Personen hier zentral verwalten */
async function settingsDialog() {
  const wrap = h('div', { class: 'form settings' });
  let showLog = false, newName = '';
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
      row('Planungsjahr beim Öffnen', h('input', { type: 'number', min: 2000, max: 2100, value: D.settings.year, onchange: e => { const v = +e.target.value; if (v >= 2000 && v <= 2100) commit(d => { d.settings.year = v; }); } })),
      h('h3', null, 'Darstellung'),
      h('div', { class: 'inl theme-pick' }, radio('light', 'Hell'), radio('dark', 'Dunkel'), radio('system', 'wie Windows')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: UI.splash !== false, onchange: e => { UI.splash = e.target.checked; saveUI(); } }), 'Startbildschirm mit Animation beim Öffnen zeigen'),
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
        h('div', { class: 'muted small' }, 'Datenstand Nr. ' + (+D.meta.rev || 0) + (D.meta.savedAt ? ' · zuletzt gespeichert ' + fmtStamp(D.meta.savedAt) + (D.meta.savedBy ? ' von ' + D.meta.savedBy : '') : ' · noch nicht gespeichert')),
        h('button', { class: 'link', onclick: e => { e.preventDefault(); showLog = !showLog; draw(); } }, showLog ? 'Änderungen ausblenden' : 'Was ist neu? (Änderungen anzeigen)')),
      showLog ? h('div', { class: 'changelog' }, CHANGELOG.map(c => h('div', { class: 'cl-v' },
        h('div', { class: 'cl-h' }, h('b', null, 'Version ' + c.version), h('span', { class: 'muted small' }, ' · ' + fmtIsoLocal(c.date))),
        h('ul', null, c.items.map(t => h('li', null, t)))))) : null);
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
    p('Es sollte immer nur eine Person gleichzeitig ändern. Die App prüft alle 15 Sekunden, ob jemand anderes gespeichert hat: Ohne eigene offene Änderungen lädt sie den neuen Stand automatisch, sonst fragt sie, welcher Stand gelten soll.'),
    h('h3', null, 'Datenschutz'),
    p('Die App arbeitet komplett offline: Es werden keine Daten ins Internet gesendet und nichts nachgeladen. Wer die Datei hat, sieht alle Daten – also nur intern ablegen.'),
    h('h3', null, 'Bedienung'),
    p('Jahresplanung: oben die Maßnahmen, darunter der Kalender – beide Bereiche lassen sich mit ▾ ein- und ausklappen. Maus über einen Tag oder eine Markierung zeigt die Details. Markierung ziehen: P verschiebt das ganze Projekt (S und I wandern mit), S oder I verschiebt nur dieses Datum. Klick öffnet die Maßnahme.'),
    p('Zeitleiste: Mausrad zoomt, Klick auf einen Monat zoomt hinein, Klick auf den Namen einer Maßnahme zeigt sie ganz. Mit gedrückter Maus auf freier Fläche nach links/rechts schieben. Balken ziehen verschiebt den PAL, die Griffe S und I verschieben nur diesen Start. Darunter „Was steht an?“. Strg+Z macht jede Änderung rückgängig.'),
    p('Detailpläne: Abschnitte mit ▾ ein- und ausklappen, Zeilen am ⋮⋮-Griff hoch/runter ziehen. Balken im Gantt ziehen verschiebt den Schritt, an den Enden ziehen ändert die Dauer; die Farbe zeigt, wer zugeordnet ist. ‹ zwischen Tabelle und Gantt blendet die Spalten aus.'),
    p('Maßnahmen mit Detailplan (z. B. Sommer- und Weihnachtsmailing) berechnen Start Selektion und Start Inhalt aus den Arbeitsschritten – wie im Excel-Gantt.')), null, { wide: true });
}

/* ---------- Tastatur */
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase(), inField = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
  if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); setTimeout(() => save(), 30); }
  else if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey && !inField) { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey)) && !inField) { e.preventDefault(); redo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'p' && !$('.modal')) { e.preventDefault(); pdfDialog(); }
});
window.addEventListener('beforeunload', e => { if (D && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('beforeprint', () => { if (!UI.printing) { UI.printing = true; renderNow(); } });
