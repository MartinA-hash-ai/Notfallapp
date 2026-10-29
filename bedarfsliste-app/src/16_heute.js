/* ===================================================================== Für heute auswählen und Stichwort-Filter (ab 0.61)
   „Heute“: morgens die Bedarfe anklicken, an denen heute gearbeitet wird – danach zeigt die Liste nur diese, die übrigen auf Wunsch („Alle“).
   Gilt bis Mitternacht und nur in diesem Browser. Stichwort-Filter: Kästchen anklicken setzt den Haken, noch einmal nimmt ihn weg (ab 0.62). */

const HEUTE_KEY = 'bl-heute';
let HEUTE = null;                                                 // { datum, ids, an } – an: nur die ausgewählten zeigen
try { const o = JSON.parse(localStorage.getItem(HEUTE_KEY) || 'null'); if (o && Array.isArray(o.ids)) HEUTE = o; } catch (e) { /* ohne Speicher: nichts gewählt */ }
const heuteDa = () => !!(HEUTE && HEUTE.datum === today() && HEUTE.ids.length);
const heuteAktiv = () => heuteDa() && HEUTE.an && !UI.heuteWahl && UI.tab !== 'archiv';
const heuteHat = id => heuteDa() && HEUTE.ids.includes(id);
const heuteKey = () => (heuteAktiv() ? HEUTE.ids.join(',') : '') + (UI.heuteWahl ? '|w' : '');
function heuteSpeichern() { try { if (HEUTE) localStorage.setItem(HEUTE_KEY, JSON.stringify(HEUTE)); else localStorage.removeItem(HEUTE_KEY); } catch (e) { /* nur für diese Sitzung */ } }
function heuteWaehlen() {
  closeMenus();
  if (UI.auf) UI.auf = null;
  UI.heuteWahl = new Set(heuteDa() ? HEUTE.ids : []); ORDER.ids = null; keep(renderNow);
}
function heuteFertig(ok) {
  if (ok) { const ids = [...UI.heuteWahl].filter(id => D.bedarfe.some(b => b.id === id)); HEUTE = ids.length ? { datum: today(), ids, an: true } : null; heuteSpeichern(); }
  UI.heuteWahl = null; ORDER.ids = null; keep(renderNow);
  if (ok) toast(HEUTE ? HEUTE.ids.length + (HEUTE.ids.length === 1 ? ' Bedarf' : ' Bedarfe') + ' für heute – „Alle“ zeigt wieder die ganze Liste.' : 'Auswahl für heute gelöscht.', 'ok');
}
function heuteZeigen(an) { if (!heuteDa()) return; HEUTE.an = an; heuteSpeichern(); ORDER.ids = null; keep(renderNow); }
// neuer Bedarf, während nur die von heute zu sehen sind: gehört gleich dazu (sonst verschwände er sofort)
function heuteDazu(id) { if (heuteAktiv() && !HEUTE.ids.includes(id)) { HEUTE.ids.push(id); heuteSpeichern(); } }
function heuteLeiste() {
  if (UI.tab === 'archiv') return '';
  if (UI.heuteWahl) return `<span class="heute-hw"><b>Für heute anklicken</b></span><button class="primary small" data-act="heute-fertig">Fertig</button><button class="undo-btn heute-leer" data-act="heute-leer" title="Auswahl aufheben – alle Haken weg" aria-label="Auswahl aufheben">↶</button>`;
  if (!heuteDa()) return `<button class="heute-btn" data-act="heute-wahl" title="Bedarfe für heute auswählen – dann zeigt die Liste nur diese">${ICON_SONNE}<span>Heute</span></button>`;
  return `<div class="seg heute-seg" role="group" aria-label="Für heute"><button data-act="heute-an" class="${HEUTE.an ? 'on' : ''}" title="nur die für heute gewählten zeigen">${ICON_SONNE}<span>Heute (${HEUTE.ids.length})</span></button><button data-act="heute-alle" class="${HEUTE.an ? '' : 'on'}" title="alle Bedarfe zeigen – die für heute sind markiert">Alle</button></div><button class="k-pen" data-act="heute-wahl" title="Auswahl für heute ändern" aria-label="Auswahl für heute ändern">${ICON_PEN}</button>`;
}
const ICON_SONNE = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9L13 13M3 13l1.1-1.1M11.9 4.1L13 3"/></g></svg>';
// beim Auswählen: Klick auf eine Zeile wählt sie (statt sie zu öffnen); Enter bzw. Leertaste auf der Zeile ebenso
function heuteKlick(tr) {
  const id = tr.dataset.id; if (UI.heuteWahl.has(id)) UI.heuteWahl.delete(id); else UI.heuteWahl.add(id);
  tr.classList.toggle('heute-w', UI.heuteWahl.has(id));
}
document.addEventListener('click', e => {
  if (!UI.heuteWahl || UI.view !== 'list') return;
  const tr = e.target.closest && e.target.closest('#list-body tr[data-id]'); if (!tr) return;
  e.preventDefault(); e.stopPropagation(); heuteKlick(tr);
}, true);
document.addEventListener('keydown', e => {
  if (!UI.heuteWahl || UI.view !== 'list') return;
  const tr = document.activeElement && document.activeElement.matches && document.activeElement.matches('#list-body tr[data-id]') ? document.activeElement : null;
  if (e.key === 'Escape' && !$('.menu, .modal')) { e.preventDefault(); e.stopPropagation(); heuteFertig(false); return; }
  if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); heuteKlick(tr); }
}, true);

/* ---------- Stichwort-Filter: UI.fSw = gewählte Stichworte; leer = alle */
const swAlle = () => uniq(D.bedarfe.filter(b => !!b.archiv === (UI.tab === 'archiv')).flatMap(b => b.stichworte)).sort((a, c) => a.localeCompare(c, 'de'));
function swFilterText() {
  const W = UI.fSw, A = swAlle();
  if (!W.length) return 'Stichwort: alle';
  return W.length <= 2 ? W.join(', ') : W.length + ' Stichworte';
}
function swFilterKlick(s) {
  const A = swAlle(); let W = UI.fSw.filter(x => A.includes(x));
  if (s == null) W = [];                                                 // „Alle“: Auswahl aufheben
  else { const i = W.indexOf(s); if (i >= 0) W.splice(i, 1); else W.push(s); }   // Kasten anklicken: Haken an, noch einmal: wieder weg
  UI.fSw = W; ORDER.ids = null; keep(renderNow);
  const btn = $('[data-act="sw-filter"]'); if (btn) swFilterPop(btn);
}
function swFilterPop(btn) {
  closeMenus();
  const A = swAlle(), W = UI.fSw, alle = !W.length;
  const zeile = (s, on, t) => h('button', { role: 'menuitemcheckbox', class: 'swf-z' + (on ? ' on' : ''), 'aria-checked': String(on), onclick: () => swFilterKlick(s) },
    h('span', { class: 'swf-h', 'aria-hidden': 'true' }, on ? '✓' : ''), t);
  const m = h('div', { class: 'menu swf-pop', role: 'menu' }, zeile(null, alle, 'Alle'), h('hr'),
    A.length ? A.map(s => zeile(s, W.includes(s), s)) : h('div', { class: 'muted small swf-leer' }, 'Noch keine Stichworte vergeben.'));
  placePop(m, btn, 'right');
}
