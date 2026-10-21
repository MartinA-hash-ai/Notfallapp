/* ===================================================================== Liste aller Bedarfe: Priorität am Namen, Summe gleich daneben, Deadline, Phase als farbiges Feld,
   Finanzierung mit den Förderern. Zuständige, Freigabe und Unterlagen stehen erst auf der Seite des Bedarfs. */

const prioMark = b => `<button class="prio p-${b.prio}" data-act="prio-menu" data-id="${b.id}" title="Priorität: ${b.prio} – klicken zum Ändern" aria-label="Priorität ${b.prio}, ändern"><i></i><i></i><i></i></button>`;
function phaseChip(p) {
  const dots = p.step < 0 ? '' : '<span class="dots" aria-hidden="true">' + [0, 1, 2, 3].map(i => `<i class="${i < p.step || p.step === 3 ? 'd' : i === p.step ? 'c' : ''}"></i>`).join('') + '</span>';
  return `<span class="phase ${phCls(p)}">${dots}${esc(phaseName(p))}</span>`;
}
const stLine = p => p.t && p.step >= 0 ? `<div class="st-line${p.bad ? ' bad' : ''}"><b>${esc(p.t)}</b>${p.sub ? ': ' + esc(p.sub) : ''}</div>` : '';
// Balken der Finanzierung: je Förderer ein Stück (Farbe nach Stand); hl = Förderer, der hervorgehoben wird (die anderen blass)
function segBar(b, opts = {}) {
  const F = fin(b), segs = finSegs(b), tot = segs.reduce((a, s) => a + s.v, 0), max = Math.max(F.S, tot, 1);
  return `<div class="fbar${opts.big ? ' big' : ''}${opts.hl ? ' hl' : ''}" role="img" aria-label="${esc(finText(b))}">`
    + segs.map(s => `<span class="fb ${s.k}${opts.hl && s.id === opts.hl ? ' on' : ''}" style="width:${(s.v / max * 100).toFixed(2)}%" title="${esc(s.name + ': ' + eur(s.v) + ' (' + KIND_L[s.k] + ')')}"></span>`).join('')
    + (tot > F.S && F.S > 0 ? `<span class="fmark" style="left:${(F.S / max * 100).toFixed(2)}%" title="Bedarf ${eur(F.S)}"></span>` : '') + '</div>';
}
function finCell(b) {
  const F = fin(b), segs = finSegs(b);
  const top = F.S ? `<div class="fc-top"><b>${eur(F.gedeckt)}</b> von ${eur(F.S)} gedeckt <span class="muted">· ${Math.round(F.gedeckt / F.S * 100)} %</span></div>` : '<div class="fc-top faint">Summe fehlt</div>';
  const list = segs.length ? '<div class="fc-list">' + segs.map(s => `<div class="fc-i" title="${esc(s.name + ': ' + KIND_L[s.k])}"><i class="swa ${s.k}"></i><span class="n">${esc(short(s.name))}</span><span class="v">${eur(s.v)}</span></div>`).join('') + '</div>'
    : '<div class="sub">noch kein Förderer</div>';
  return top + segBar(b) + list;
}
const LEGEND_FIN = Object.entries(KIND_L).map(([k, l]) => `<span class="lg"><i class="swa ${k}"></i>${l}</span>`).join('');
const glName = b => b.gliederung === DIO ? 'Diözese (ohne Gliederung)' : (b.gliederung || 'Gliederung fehlt');

/* ---------- Filtern und Sortieren */
const CMP = {
  prio: b => PRIO_ORD[b.prio], titel: b => (b.titel || '').toLowerCase(), zust: b => (b.zust[0] || '~').toLowerCase(), summe: b => -(+b.summe || 0),
  deadline: b => b.deadline || '9999', stand: b => { const p = phase(b); return p.step < 0 ? 9 : p.step; }, fin: b => { const F = fin(b); return F.S ? F.gedeckt / F.S : 9; },
  frist: b => (nextFrist(b) || {}).d || '9999',
};
function cmp(x, y, k) { const a = CMP[k](x), c = CMP[k](y); return typeof a === 'number' ? a - c : String(a).localeCompare(String(c), 'de'); }
function filtered() {
  const arch = UI.tab === 'archiv', q = norm(UI.q);
  let L = D.bedarfe.filter(b => !!b.archiv === arch);
  if (UI.fGl) L = L.filter(b => glName(b) === UI.fGl);
  if (UI.fZu) L = L.filter(b => b.zust.includes(UI.fZu));
  if (UI.fPh) L = L.filter(b => phaseName(phase(b)) === UI.fPh);
  if (UI.fPr) L = L.filter(b => b.prio === UI.fPr);
  if (UI.fSw) L = L.filter(b => b.stichwort === UI.fSw);
  if (q) L = L.filter(b => norm([b.titel, b.gliederung, b.beschreibung, b.stichwort, ...b.zust, ...b.foerderer.map(f => f.name)].join(' ')).includes(q));
  const chain = [UI.sort, ...['prio', 'frist', 'titel'].filter(k => k !== UI.sort)];
  return L.sort((x, y) => { for (let i = 0; i < chain.length; i++) { const r = cmp(x, y, chain[i]) * (i === 0 ? UI.dir : 1); if (r) return r; } return 0; });
}
const anyFilter = () => !!(UI.q || UI.fGl || UI.fZu || UI.fPh || UI.fPr || UI.fSw);

function row(b) {
  const p = phase(b), nf = nextFrist(b), dash = '<span class="faint">–</span>';
  return `<tr data-act="open" data-id="${b.id}" tabindex="0" class="${b.manuell ? 'paused' : ''}">
    <td class="c-titel"><div class="tline">${prioMark(b)}<span class="t">${esc(b.titel || '(ohne Namen)')}</span></div><div class="sub">${esc(glName(b))}${b.stichwort ? ` <span class="chip sw">${esc(b.stichwort)}</span>` : ''}</div></td>
    <td class="num c-sum">${b.summe ? '<b>' + eur(b.summe) + '</b>' + `<div class="sub">${esc(b.summeArt)}</div>` : dash}</td>
    <td>${b.deadline ? fmtDate(b.deadline) : dash}</td>
    <td class="c-st">${phaseChip(p)}${p.warn.length ? ` <span class="wicon" title="${esc(p.warn.join(' · '))}" aria-label="${esc(p.warn.join(' · '))}">⚠</span>` : ''}${stLine(p)}</td>
    <td class="c-fin">${finCell(b)}</td>
    <td class="c-fr">${nf ? `<div class="${urg(nf.d)}">${fmtDate(nf.d)}</div><div class="sub">${esc(nf.t)} · ${rel(nf.d)}</div>` : dash}</td>
  </tr>`;
}
const NCOL = 6;
function listBody() {
  const L = filtered();
  if (!L.length) return { html: `<tr><td colspan="${NCOL}"><div class="empty">${UI.tab === 'archiv' ? 'Im Archiv liegt nichts' + (anyFilter() ? ', das zu den Filtern passt.' : '.') : D.bedarfe.some(b => !b.archiv) ? 'Kein Bedarf passt zu den Filtern.' : 'Noch keine Bedarfe – oben rechts mit „+ Bedarf“ den ersten anlegen.'}</div></td></tr>`, n: 0 };
  return { html: L.map(row).join(''), n: L.length };
}
function listView() {
  const arch = UI.tab === 'archiv', all = D.bedarfe.filter(b => !!b.archiv === arch);
  const sel = (key, lab, vals, labels) => `<select data-ui="${key}" class="${UI[key] ? 'on' : ''}" aria-label="${lab}"><option value="">${lab}: alle</option>`
    + (labels || uniq(vals).sort((a, c) => a.localeCompare(c, 'de')).map(v => [v, v])).map(([v, l]) => `<option value="${esc(v)}" ${UI[key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('') + '</select>';
  const th = (k, lab, cls = '') => `<button class="th ${UI.sort === k ? 'on' : ''} ${cls}" data-act="sort" data-v="${k}">${lab}${UI.sort === k ? (UI.dir > 0 ? ' ▲' : ' ▼') : ''}</button>`;
  const body = listBody();
  const phs = [...PHASES.map(p => p.t), 'Zurückgestellt', 'Verworfen'].filter(t => all.some(b => phaseName(phase(b)) === t));
  return `<main><section class="card">
    <div class="list-head">
      <h2>${arch ? 'Archiv' : 'Bedarfe'}</h2><span class="muted" id="list-count">${body.n} von ${all.length}</span>
      <div class="tools">
        <input type="search" id="q" data-ui="q" value="${esc(UI.q)}" placeholder="Suchen …" aria-label="Suchen">
        ${sel('fPh', 'Phase', null, phs.map(t => [t, t]))}${sel('fPr', 'Priorität', null, PRIO.filter(([v]) => all.some(b => b.prio === v)))}
        ${sel('fGl', 'Gliederung', all.map(glName))}${sel('fZu', 'Zuständig', all.flatMap(b => b.zust))}${sel('fSw', 'Stichwort', all.map(b => b.stichwort))}
        ${anyFilter() ? '<button class="link" data-act="clear">Filter löschen</button>' : ''}
      </div>
    </div>
    <div class="tablewrap"><table class="list"><thead><tr>
      <th class="c-titel">${th('prio', 'Prio')} · ${th('titel', 'Bedarf')}</th><th class="r">${th('summe', 'Summe')}</th><th>${th('deadline', 'Deadline')}</th>
      <th>${th('stand', 'Phase und Stand')}</th><th>${th('fin', 'Finanzierung')}</th><th>${th('frist', 'Nächste Frist')}</th>
    </tr></thead><tbody id="list-body">${body.html}</tbody></table></div>
    <div class="legend">
      <span class="lg"><span class="prio p-hoch"><i></i><i></i><i></i></span>hoch</span><span class="lg"><span class="prio p-mittel"><i></i><i></i><i></i></span>mittel</span><span class="lg"><span class="prio p-niedrig"><i></i><i></i><i></i></span>niedrig</span>
      <span class="sep"></span>${LEGEND_FIN}
    </div>
  </section></main>`;
}
// Priorität direkt in der Liste ändern: kleines Menü am Balken
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
function placePop(m, btn) {
  document.body.append(m);
  const r = btn.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = (r.bottom + 4 + m.offsetHeight > innerHeight ? Math.max(8, r.top - m.offsetHeight - 4) : r.bottom + 4) + 'px';
}
function closeMenus() { $$('.menu').forEach(m => m.remove()); }
document.addEventListener('mousedown', e => { if (!e.target.closest('.menu, [data-act="prio-menu"], [data-act="menu"], [data-act="info"]')) closeMenus(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
window.addEventListener('scroll', closeMenus, true);
