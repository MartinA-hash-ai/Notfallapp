/* ===================================================================== Liste aller Bedarfe, von links nach rechts so schnell wie möglich erfassbar:
   Name, Summe, Ort · Zuständig · bis wann – Freigabe – Finanzierungsplan mit Verwendungsnachweis je Förderer – Spendenübergabe. */

const prioMark = b => `<button class="prio p-${b.prio}" data-act="prio-menu" data-id="${b.id}" title="Priorität: ${b.prio} – klicken zum Ändern" aria-label="Priorität ${b.prio}, ändern"><i></i><i></i><i></i></button>`;

/* ---------- kleine Kreise: grün mit Haken, gelb mit drei Punkten, rot mit Kreuz, leer; m-dot = vereinfacht (Thema durch) */
// Zeichen in den Kreisen als klare Grafik (keine Schriftzeichen – die sahen je nach Schrift handgemalt aus)
const ICO = {
  ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8.4l2.6 2.6L12 5.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  no: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  run: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4.6" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="11.4" cy="8" r="1.2"/></svg>',
  na: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 8h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};
const MI = { ok: ['m-ok', ICO.ok], run: ['m-run', ICO.run], no: ['m-no', ICO.no], off: ['m-off', ''], dot: ['m-dot', ''], none: ['m-none', ''] };
const mi = (s, t) => `<span class="mi ${MI[s][0]}"${t ? ` title="${esc(t)}"` : ''}>${MI[s][1]}</span>`;
const ICON_CAL = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3.5" width="12" height="10.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2 7h12M5.5 2v3M10.5 2v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const ICON_TRI = '<svg class="tri" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 15 14H1z" fill="currentColor"/><path d="M8 6v4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="12" r=".9" fill="#fff"/></svg>';

// Freigabe: Ortsführungskreis, Verwaltung, Fachreferat, Angebot – ist alles durch, wird der Block blass grün
function lFreigabe(b) {
  const it = Object.fromEntries(frItems(b).map(i => [i.k, i]));
  const L = [['ofk', 'Ortsführungskreis'], ['verw', 'Verwaltung'], ['fach', 'Fachreferat']].map(([k, lab]) => {
    const i = it[k];
    if (!frNeeded(i)) return `<div class="ml nn" data-le="fr" data-k="${k}" title="${esc(frText(i))}">${mi('none')}<span>${lab}</span></div>`;
    return `<div class="ml" data-le="fr" data-k="${k}">${mi(({ ok: 'ok', angefragt: 'run', nein: 'no' })[i.st] || 'off', frText(i))}<span>${lab}</span></div>`;
  });
  const a = angebotUL(b);
  L.push(`<div class="ml" data-le="ang">${mi(a && a.st === 'da' ? 'ok' : a && a.st === 'arbeit' ? 'run' : 'off', a ? 'Angebot ' + ulText(a) : 'Angebot fehlt')}<span>Angebot</span></div>`);
  return frOffen(b).names.length ? L.join('') : `<div class="done" title="Freigabe vollständig">${L.join('')}</div>`;
}
// Finanzierungsplan: je Förderer Kreis, Name, Betrag und – bei Zusage – gepunktet weiter zum Verwendungsnachweis; darunter Delta und Eigenmittel
const F_SYM = { zugesagt: 'ok', beantragt: 'run', geplant: 'off', abgelehnt: 'no' };
const EMPTY3 = '<span></span><span></span><span></span>';
// Zeitstrahl in der Punktlinie zur Frist: füllt sich von links (ab Geldeingang bzw. Zusage, sonst 90 Tage vorher) bis zur Frist –
// grau, ab einem Monat vorher gelb, ab einer Woche vorher rot
function zeitstrahl(f) {
  const v = f.vn; if (!v.frist || v.st === 'erledigt') return '<span class="lead"></span>';
  const T = 864e5, end = Date.parse(v.frist), now = Date.parse(today()), rest = Math.round((end - now) / T);
  const s0 = Date.parse(f.eingangAm || f.entscheidungAm || ''), start = isNaN(s0) || s0 >= end ? end - 90 * T : s0;
  const p = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const t = rest < 0 ? 'Frist seit ' + -rest + (rest === -1 ? ' Tag' : ' Tagen') + ' vorbei' : rest === 0 ? 'Frist ist heute' : 'noch ' + rest + (rest === 1 ? ' Tag' : ' Tage') + ' bis zur Frist';
  return `<span class="lead tl ${rest <= 7 ? 'tl-r' : rest <= 30 ? 'tl-y' : 'tl-g'}" style="--p:${(p * 100).toFixed(1)}%" title="${t}"></span>`;
}
function lNachweis(f, fertig) {
  const v = f.vn, a = `data-le="vn" data-fid="${f.id}"`;
  if (!v.noetig) return `<span></span><span></span><span class="vt nn" ${a}>nicht nötig</span>`;
  if (fertig) return `<span class="lead"></span><span class="mi m-dot" ${a} title="erledigt"></span><span class="vt" ${a}>erledigt</span>`;
  const s = MI[({ offen: 'off', arbeit: 'run', erledigt: 'ok' })[v.st]], cal = `<button class="le-cal" data-le="vn-frist" data-fid="${f.id}" title="Frist des Verwendungsnachweises" aria-label="Frist des Verwendungsnachweises wählen">${ICON_CAL}</button>`;
  return `${zeitstrahl(f)}<span class="mi ${s[0]}" ${a} title=""${esc((VN_ST.find(o => o[0] === v.st) || [])[1])}">${s[1]}</span><span class="vt" ${a}>${v.st === 'erledigt' ? 'erledigt' : (v.frist ? 'bis ' + fmtDate(v.frist) : 'Frist fehlt') + cal}</span>`;
}
function lFinanz(b) {
  const F = finState(b), R = [];
  for (const f of F.fs) {
    const t = esc((f.name || '(ohne Namen)') + ': ' + F_ST_L[f.status]), a = `data-fid="${f.id}"`, ab = f.status === 'abgelehnt' ? ' ab' : '';
    const sym = s => `<span class="mi ${MI[s][0]}" data-le="foe" ${a}>${MI[s][1]}</span>`;
    const pen = `<button class="le-pen" data-le="foe-name" ${a} title="Förderer umbenennen" aria-label="Förderer umbenennen">${ICON_PEN}</button>`;
    const nm = `<span class="fn" data-le="foe" ${a}><span class="fn-t">${esc(f.name || '(ohne Namen)')}</span>${pen}</span><span class="fa" data-le="amt" ${a}>${eur(foeAmt(f))}</span>`;
    if (!F.done) R.push(`<div class="fr${ab}" title="${t}">${sym(F_SYM[f.status])}${nm}${f.status === 'zugesagt' ? lNachweis(f, false) : EMPTY3}</div>`);
    else if (f.status !== 'zugesagt') R.push(`<div class="fr x${ab}" title="${t}">${sym('dot')}${nm}${EMPTY3}</div>`);
    else { const fertig = !f.vn.noetig || f.vn.st === 'erledigt'; R.push(`<div class="fr ${fertig ? 'z' : 'strong'}" title="${t}">${sym('dot')}${nm}${lNachweis(f, fertig)}</div>`); }
  }
  R.push('<div class="fline"></div>');
  if (F.d) R.push(`<div class="fr sum"><span></span><span class="fn">${F.d > 0 ? 'Delta' : 'Überfinanzierung'}</span><span class="fa">${eur(Math.abs(F.d))}</span>${EMPTY3}</div><div class="fline"></div>`);
  R.push(`<div class="fr sum"><span></span><span class="fn">Eigenmittel</span><span class="fa" data-le="eig">${eur(F.eig)}</span>${EMPTY3}</div>`);
  return `<div class="fg">${R.join('')}</div><button class="le-plus" data-le="add" title="Förderer hinzufügen – Enter: weiter zum Betrag, dann speichern; Shift+Enter: speichern und nächster Förderer" aria-label="Förderer hinzufügen">+</button>`;
}
// Spendenübergabe: steht die Finanzierung und ist noch nichts vereinbart, ein oranges Dreieck; darunter die Info dazu
const uebWann = u => u.termin ? fmtDate(u.termin) + (u.zeit ? ', ' + u.zeit + ' Uhr' : '') : '';
function lUebergabe(b) {
  const u = b.nach.ueb, F = finState(b);
  const top = !u.noetig ? '<div class="ml nn">nicht nötig</div>'
    : (u.st === 'erledigt' ? `<div class="ml">${mi('ok', 'erledigt')}<span>erledigt${u.termin ? ' am ' + fmtDate(u.termin) : ''}</span></div>`
      : u.st === 'terminiert' || u.termin ? `<div class="ml">${mi('run', 'terminiert')}<span>${uebWann(u) || 'terminiert'}</span></div>`
      : F.done && F.zu > 0 ? `<div class="ml warnl">${ICON_TRI}<span>Spendenübergabe einleiten</span></div>` : '')
      + (u.ort ? `<div class="ml-sub">${esc(u.ort)}</div>` : '');                      // ohne Zeile darüber nicht eingerückt (CSS)
  const view = top + (u.noetig && u.info.trim() ? (top ? '<div class="ue-sep"></div>' : '') + `<div class="note">${esc(u.info)}</div>` : '');
  if (!u.noetig) return view;
  // mit Strg: großer Kreis mit Stift – öffnet Ort, Datum, Uhrzeit und Notizen zum Eintragen (bleibt offen, auch ohne Strg)
  return view + `<button class="le-ue" data-le="ueb" title="Spendenübergabe eintragen: Ort, Datum und Uhrzeit, Notizen" aria-label="Spendenübergabe eintragen">${ICON_PEN}</button>`;
}

/* ---------- Filtern und Sortieren: hohe Priorität zuerst, dann nach der nächsten Frist */
const CMP = {
  prio: b => PRIO_ORD[b.prio], titel: b => (b.titel || '').toLowerCase(), frist: b => (nextFrist(b) || {}).d || '9999',
};
function cmp(x, y, k) { const a = CMP[k](x), c = CMP[k](y); return typeof a === 'number' ? a - c : String(a).localeCompare(String(c), 'de'); }
function filtered() {
  const arch = UI.tab === 'archiv', q = norm(UI.q);
  let L = D.bedarfe.filter(b => !!b.archiv === arch);
  if (UI.fSw) L = L.filter(b => b.stichwort === UI.fSw);
  if (q) L = L.filter(b => norm([b.titel, b.gliederung, b.beschreibung, b.stichwort, ...b.zust, ...b.foerderer.map(f => f.name)].join(' ')).includes(q));
  L.sort((x, y) => cmp(x, y, 'prio') || cmp(x, y, 'frist') || cmp(x, y, 'titel'));
  if (ORDER.ids) { const i = id => { const n = ORDER.ids.indexOf(id); return n < 0 ? 1e9 : n; }; L.sort((x, y) => i(x.id) - i(y.id)); }
  return L;
}
// Reihenfolge, solange mit Strg bearbeitet wird (Zeilen springen nicht unter dem Mauszeiger weg)
const ORDER = { ids: null };
const anyFilter = () => !!(UI.q || UI.fSw);

function row(b) {
  const tag = b.manuell ? ` <span class="pause-t">(${esc(b.manuell)})</span>` : b.prio === 'hoch' ? ' <span class="prio-t">(Prio)</span>' : '';
  return `<tr data-act="open" data-id="${b.id}" tabindex="0" class="${b.manuell ? 'paused' : ''}">
    <td class="l-name" data-le="titel">${b.titel ? esc(b.titel) : '<span class="ph">Name des Bedarfs</span>'}${tag}</td>
    <td class="l-sum" data-le="summe">${b.summe ? eur(b.summe) : '<span class="ph">Summe</span>'}</td>
    <td class="l-meta"><div class="ort" data-le="ort">${b.gliederung ? esc(b.gliederung === DIO ? 'Diözese' : b.gliederung) : '<span class="ph">Ort</span>'}</div><div data-le="zust">${b.zust[0] ? esc(b.zust[0]) : '<span class="ph">Ansprechperson</span>'}</div><div data-le="deadline">${b.deadline ? 'bis ' + fmtDate(b.deadline) : '<span class="nn">ohne Deadline</span>'}</div></td>
    <td class="l-fr">${lFreigabe(b)}</td>
    <td class="l-fin">${lFinanz(b)}</td>
    <td class="l-ueb">${lUebergabe(b)}</td>
  </tr>`;
}
const NCOL = 6;
function listBody() {
  const L = filtered();
  if (!L.length) return { html: `<tr><td colspan="${NCOL}"><div class="empty">${UI.tab === 'archiv' ? 'Im Archiv liegt nichts' + (anyFilter() ? ', das zu den Filtern passt.' : '.') : D.bedarfe.some(b => !b.archiv) ? 'Kein Bedarf passt zu den Filtern.' : 'Noch keine Bedarfe – oben rechts mit „+ Bedarf“ den ersten anlegen.'}</div></td></tr>`, n: 0 };
  return { html: L.map(row).join(''), n: L.length };
}
function listView() {
  const arch = UI.tab === 'archiv', all = D.bedarfe.filter(b => !!b.archiv === arch), body = listBody();
  const sws = uniq(all.map(b => b.stichwort)).sort((a, c) => a.localeCompare(c, 'de')), colw = colwGet();
  return `<main><section class="card">
    <div class="list-head">
      <h2>${arch ? 'Archiv' : 'Bedarfe'}</h2><span class="muted" id="list-count">${body.n} von ${all.length}</span><span class="strg-hint" title="Name, Summe, Ort, Ansprechperson und Deadline anklicken und ändern; Freigabe, Stand der Förderer und Verwendungsnachweis drehen per Klick einen Stand weiter; + fügt einen Förderer hinzu. Mit gedrückter Strg-Taste öffnet ein Klick den Bedarf.">Strg + Klick öffnet den Bedarf</span>
      <div class="tools">
        <input type="search" id="q" data-ui="q" value="${esc(UI.q)}" placeholder="Suchen …" aria-label="Suchen">
        <select data-ui="fSw" class="${UI.fSw ? 'on' : ''}" aria-label="Stichwort"><option value="">Stichwort: alle</option>${sws.map(v => `<option value="${esc(v)}" ${UI.fSw === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
        ${anyFilter() ? '<button class="link" data-act="clear">Filter löschen</button>' : ''}
      </div>
    </div>
    <div class="tablewrap"><table class="list${colw ? ' fixed' : ''}"${colw ? ` style="width:${colw.reduce((a, x) => a + x, 0)}px"` : ''}>${colw ? '<colgroup>' + colw.map(x => `<col style="width:${x}px">`).join('') + '</colgroup>' : ''}<thead><tr>
      ${['<th>Bedarf', '<th>Summe', '<th>', '<th class="l-fr">Freigabe', '<th class="l-fin"><div class="fg fg-h"><span>Finanzierungsplan</span><span>Verwendungsnachweis</span></div>', '<th class="l-ueb">Spendenübergabe']
        .map((t, i) => t + `<span class="col-rs" data-i="${i}" title="Spaltenbreite ziehen (Doppelklick: alle Spalten zurücksetzen)"></span></th>`).join('')}
    </tr></thead><tbody id="list-body">${body.html}</tbody></table></div>
  </section></main>`;
}
/* ---------- Spaltenbreiten wie in Excel: am rechten Rand eines Spaltenkopfs ziehen – nur diese Spalte ändert sich, die rechts davon rücken mit.
   Die Breiten merkt sich der Browser; Doppelklick auf einen Rand oder das Zahnrad setzt alle zurück. */
const COLW_KEY = 'bl-colw', COL_MIN = [140, 70, 90, 110, 330, 150];
const colwGet = () => { try { const a = JSON.parse(localStorage.getItem(COLW_KEY) || 'null'); return Array.isArray(a) && a.length === NCOL && a.every(x => x > 0) ? a : null; } catch (e) { return null; } };
const colwSet = a => { try { if (a) localStorage.setItem(COLW_KEY, JSON.stringify(a)); else localStorage.removeItem(COLW_KEY); } catch (e) { /* nur in diesem Browser */ } };
document.addEventListener('pointerdown', e => {
  const hnd = e.target.closest && e.target.closest('.col-rs'); if (!hnd || e.button !== 0) return;
  e.preventDefault();
  const table = hnd.closest('table'), i = +hnd.dataset.i;
  const w = colwGet() || [...table.querySelectorAll('thead th')].map(th => Math.round(th.getBoundingClientRect().width));
  let cg = table.querySelector('colgroup');
  if (!cg) { cg = h('colgroup', null, w.map(() => h('col'))); table.prepend(cg); }
  const cols = [...cg.children];
  const apply = () => { cols.forEach((c, k) => { c.style.width = w[k] + 'px'; }); table.style.width = w.reduce((a, x) => a + x, 0) + 'px'; table.classList.add('fixed'); };
  apply();
  const x0 = e.clientX, w0 = w[i];
  hnd.setPointerCapture(e.pointerId); document.body.classList.add('col-resizing');
  const move = ev => { w[i] = Math.max(COL_MIN[i], Math.round(w0 + ev.clientX - x0)); apply(); };
  const up = () => { hnd.removeEventListener('pointermove', move); hnd.removeEventListener('pointerup', up); document.body.classList.remove('col-resizing'); colwSet(w); };
  hnd.addEventListener('pointermove', move); hnd.addEventListener('pointerup', up);
});
document.addEventListener('dblclick', e => { if (e.target.closest && e.target.closest('.col-rs')) { colwSet(null); keep(renderNow); } });

// Priorität ändern: kleines Menü am Balken (Seite des Bedarfs)
function prioMenu(btn) {
  closeMenus();
  const b = D.bedarfe.find(x => x.id === btn.dataset.id); if (!b) return;
  const m = h('div', { class: 'menu', id: 'pmenu', role: 'menu' }, PRIO.map(([v, l]) =>
    h('button', { role: 'menuitem', class: v === b.prio ? 'on' : '', 'data-act': 'prio-set', 'data-id': b.id, 'data-v': v, html: `<span class="prio p-${v}"><i></i><i></i><i></i></span> ${l}` })));
  placePop(m, btn);
  m.querySelector('button.on, button').focus();
}
// kleines Fenster mit einem Hinweis (statt Hilfetext unter dem Feld)
function infoPop(btn, text) {
  closeMenus();
  placePop(h('div', { class: 'menu info-pop', role: 'tooltip' }, text), btn);
}
function placePop(m, btn, align) {
  document.body.append(m);
  const r = btn.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(align === 'right' ? r.right - m.offsetWidth : r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = (r.bottom + 4 + m.offsetHeight > innerHeight ? Math.max(8, r.top - m.offsetHeight - 4) : r.bottom + 4) + 'px';
}
function closeMenus() { $$('.menu').forEach(m => m.remove()); }
document.addEventListener('mousedown', e => { if (!e.target.closest('.menu, [data-act="prio-menu"], [data-act="menu"], [data-act="info"], [data-act="circ"], [data-act="st-menu"], [data-act="more"], [data-act="fw"], input.dfeld')) closeMenus(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
window.addEventListener('scroll', e => { if (!(e.target instanceof Element && e.target.closest('.menu'))) closeMenus(); }, true);
