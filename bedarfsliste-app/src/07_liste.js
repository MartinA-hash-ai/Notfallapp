/* ===================================================================== Liste aller Bedarfe, von links nach rechts so schnell wie möglich erfassbar:
   Name, Summe, Ort · Zuständig · bis wann – Freigabe – Finanzierungsplan mit Verwendungsnachweis je Förderer – Spendenübergabe. */

const prioMark = b => `<button class="prio p-${b.prio}" data-act="prio-menu" data-id="${b.id}" title="Priorität: ${b.prio} – klicken zum Ändern" aria-label="Priorität ${b.prio}, ändern"><i></i><i></i><i></i></button>`;
// Balken der Finanzierung (Seite des Bedarfs): je Förderer ein Stück (Farbe nach Stand)
function segBar(b, opts = {}) {
  const F = fin(b), segs = finSegs(b), tot = segs.reduce((a, s) => a + s.v, 0), max = Math.max(F.S, tot, 1);
  return `<div class="fbar${opts.big ? ' big' : ''}" role="img" aria-label="${esc(finText(b))}">`
    + segs.map(s => `<span class="fb ${s.k}" style="width:${(s.v / max * 100).toFixed(2)}%" title="${esc(s.name + ': ' + eur(s.v) + ' (' + KIND_L[s.k] + ')')}"></span>`).join('')
    + (tot > F.S && F.S > 0 ? `<span class="fmark" style="left:${(F.S / max * 100).toFixed(2)}%" title="Bedarf ${eur(F.S)}"></span>` : '') + '</div>';
}
const LEGEND_FIN = Object.entries(KIND_L).map(([k, l]) => `<span class="lg"><i class="swa ${k}"></i>${l}</span>`).join('');

/* ---------- kleine Kreise: grün mit Haken, gelb mit drei Punkten, rot mit Kreuz, leer; m-dot = vereinfacht (Thema durch) */
const DOTS3 = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4.6" cy="8" r="1.15"/><circle cx="8" cy="8" r="1.15"/><circle cx="11.4" cy="8" r="1.15"/></svg>';
const MI = { ok: ['m-ok', '✓'], run: ['m-run', DOTS3], no: ['m-no', '✕'], off: ['m-off', ''], dot: ['m-dot', ''], none: ['m-none', ''] };
const mi = (s, t) => `<span class="mi ${MI[s][0]}"${t ? ` title="${esc(t)}"` : ''}>${MI[s][1]}</span>`;
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
const F_SYM = { zugesagt: 'ok', beantragt: 'run', vorb: 'run', geplant: 'off', abgelehnt: 'no' };
const EMPTY3 = '<span></span><span></span><span></span>';
function lNachweis(f, fertig) {
  const v = f.vn, a = `data-le="vn" data-fid="${f.id}"`;
  if (!v.noetig) return `<span></span><span></span><span class="vt nn" ${a}>nicht nötig</span>`;
  if (fertig) return `<span class="lead"></span><span class="mi m-dot" ${a} title="erledigt"></span><span class="vt" ${a}>erledigt</span>`;
  return `<span class="lead"></span><span class="mi ${MI[({ offen: 'off', arbeit: 'run', erledigt: 'ok' })[v.st]][0]}" ${a} title="${esc((VN_ST.find(o => o[0] === v.st) || [])[1])}">${MI[({ offen: 'off', arbeit: 'run', erledigt: 'ok' })[v.st]][1]}</span><span class="vt" ${a}>${v.st === 'erledigt' ? 'erledigt' : v.frist ? 'bis ' + fmtDate(v.frist) : 'Frist fehlt'}</span>`;
}
function lFinanz(b) {
  const F = finState(b), R = [];
  for (const f of F.fs) {
    const t = esc((f.name || '(ohne Namen)') + ': ' + F_ST_L[f.status]), a = `data-fid="${f.id}"`, ab = f.status === 'abgelehnt' ? ' ab' : '';
    const sym = s => `<span class="mi ${MI[s][0]}" data-le="foe" ${a}>${MI[s][1]}</span>`;
    const nm = `<span class="fn" data-le="foe" ${a}>${esc(f.name || '(ohne Namen)')}</span><span class="fa" data-le="amt" ${a}>${eur(foeAmt(f))}</span>`;
    if (!F.done) R.push(`<div class="fr${ab}" title="${t}">${sym(F_SYM[f.status])}${nm}${f.status === 'zugesagt' ? lNachweis(f, false) : EMPTY3}</div>`);
    else if (f.status !== 'zugesagt') R.push(`<div class="fr x${ab}" title="${t}">${sym('dot')}${nm}${EMPTY3}</div>`);
    else { const fertig = !f.vn.noetig || f.vn.st === 'erledigt'; R.push(`<div class="fr ${fertig ? 'z' : 'strong'}" title="${t}">${sym('dot')}${nm}${lNachweis(f, fertig)}</div>`); }
  }
  R.push('<div class="fline"></div>');
  if (F.d) R.push(`<div class="fr sum"><span></span><span class="fn">${F.d > 0 ? 'Delta' : 'Überfinanzierung'}</span><span class="fa">${eur(Math.abs(F.d))}</span>${EMPTY3}</div><div class="fline"></div>`);
  R.push(`<div class="fr sum"><span></span><span class="fn">Eigenmittel</span><span class="fa" data-le="eig">${eur(F.eig)}</span>${EMPTY3}</div>`);
  return `<div class="fg">${R.join('')}</div><button class="le-plus" data-le="add" title="Förderer hinzufügen" aria-label="Förderer hinzufügen">+</button>`;
}
// Spendenübergabe: steht die Finanzierung und ist noch nichts vereinbart, ein oranges Dreieck; darunter die Info dazu
function lUebergabe(b) {
  const u = b.nach.ueb, F = finState(b), ort = u.ort ? `<div class="ml-sub">${esc(u.ort)}</div>` : '';
  const top = !u.noetig ? '<div class="ml nn">nicht nötig</div>'
    : u.st === 'erledigt' ? `<div class="ml">${mi('ok', 'erledigt')}<span>erledigt${u.termin ? ' am ' + fmtDate(u.termin) : ''}</span></div>${ort}`
    : u.st === 'terminiert' || u.termin ? `<div class="ml">${mi('run', 'terminiert')}<span>${u.termin ? fmtDate(u.termin) : 'terminiert'}</span></div>${ort}`
    : F.done && F.zu > 0 ? `<div class="ml warnl">${ICON_TRI}<span>Spendenübergabe einleiten</span></div>` : '';
  return top + (u.noetig && u.info.trim() ? `<div class="note">${esc(u.info)}</div>` : '');
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
    <td class="l-name" data-le="titel">${esc(b.titel || '(ohne Namen)')}${tag}</td>
    <td class="l-sum" data-le="summe">${b.summe ? eur(b.summe) : '<span class="faint">–</span>'}</td>
    <td class="l-meta"><div class="ort" data-le="ort">${esc(b.gliederung === DIO ? 'Diözese' : b.gliederung || '–')}</div><div data-le="zust">${esc(b.zust[0] || '–')}</div><div data-le="deadline">${b.deadline ? 'bis ' + fmtDate(b.deadline) : '<span class="nn">ohne Deadline</span>'}</div></td>
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
  const sws = uniq(all.map(b => b.stichwort)).sort((a, c) => a.localeCompare(c, 'de'));
  return `<main><section class="card">
    <div class="list-head">
      <h2>${arch ? 'Archiv' : 'Bedarfe'}</h2><span class="muted" id="list-count">${body.n} von ${all.length}</span><span class="strg-hint" title="Mit gedrückter Strg-Taste: Name, Summe, Ort, Ansprechperson und Deadline anklicken und ändern; Freigabe, Stand der Förderer und Verwendungsnachweis drehen per Klick einen Stand weiter; + fügt einen Förderer hinzu">Strg halten: direkt bearbeiten</span>
      <div class="tools">
        <input type="search" id="q" data-ui="q" value="${esc(UI.q)}" placeholder="Suchen …" aria-label="Suchen">
        <select data-ui="fSw" class="${UI.fSw ? 'on' : ''}" aria-label="Stichwort"><option value="">Stichwort: alle</option>${sws.map(v => `<option value="${esc(v)}" ${UI.fSw === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
        ${anyFilter() ? '<button class="link" data-act="clear">Filter löschen</button>' : ''}
      </div>
    </div>
    <div class="tablewrap"><table class="list"><thead><tr>
      <th>Bedarf</th><th class="r">Summe</th><th></th><th class="l-fr">Freigabe</th>
      <th class="l-fin"><div class="fg fg-h"><span>Finanzierungsplan</span><span>Verwendungsnachweis</span></div></th><th class="l-ueb">Spendenübergabe</th>
    </tr></thead><tbody id="list-body">${body.html}</tbody></table></div>
    ${dl('dl-gl', [DIO, ...GL_LIST, ...D.bedarfe.map(x => x.gliederung)])}${dl('dl-zust', D.bedarfe.flatMap(x => x.zust))}${dl('dl-kartei', KR.list.map(k => k.name))}
  </section></main>`;
}
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
document.addEventListener('mousedown', e => { if (!e.target.closest('.menu, [data-act="prio-menu"], [data-act="menu"], [data-act="info"], [data-act="circ"], [data-act="st-menu"], [data-act="more"]')) closeMenus(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
window.addEventListener('scroll', closeMenus, true);
