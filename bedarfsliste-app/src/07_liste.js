/* ===================================================================== Liste aller Bedarfe, von links nach rechts so schnell wie möglich erfassbar:
   Name, Summe, Ort · Zuständig · bis wann – Freigabe – Finanzierungsplan mit Verwendungsnachweis je Förderer – Spendenübergabe. */


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

// Freigabe: Ortsführungskreis, Verwaltung, Fachreferat, Angebot – ist alles durch, steht nur noch ein Haken „freigegeben“ (Einzelheiten beim Überfahren)
function lFreigabe(b) {
  const it = Object.fromEntries(frItems(b).map(i => [i.k, i])), a = angebotUL(b);
  if (!frOffen(b).names.length) {
    const tip = [['ofk', 'Ortsführungskreis'], ['verw', 'Verwaltung'], ['fach', 'Fachreferat']].map(([k, lab]) => { const i = it[k];
      return (k === 'fach' && i.item.name ? 'Fachreferat ' + i.item.name : lab) + ': ' + frText(i) + (i.st === 'ok' && validIso(i.item.erledigt) ? ' am ' + fmtDate(i.item.erledigt) : ''); });
    return `<div class="ml fr-voll" title="${esc([...tip, 'Angebot: ' + (a ? ulText(a) : 'fehlt')].join('\n'))}">${mi('ok')}<span>freigegeben</span></div>`;
  }
  const L = [['ofk', 'Ortsführungskreis'], ['verw', 'Verwaltung'], ['fach', 'Fachreferat']].map(([k, lab]) => {
    const i = it[k];
    if (!frNeeded(i)) return `<div class="ml nn" data-le="fr" data-k="${k}" title="${esc(frText(i))}">${mi('none')}<span>${lab}</span></div>`;
    return `<div class="ml" data-le="fr" data-k="${k}">${mi(({ ok: 'ok', angefragt: 'run', nein: 'no' })[i.st] || 'off', frText(i))}<span>${lab}</span></div>`;
  });
  L.push(`<div class="ml${a && a.st === 'nn' ? ' nn' : ''}" data-le="ang">${mi(a && a.st === 'da' ? 'ok' : a && a.st === 'arbeit' ? 'run' : a && a.st === 'nn' ? 'none' : 'off', a ? 'Angebot ' + ulText(a) : 'Angebot fehlt')}<span>Angebot</span></div>`);
  return L.join('');
}
// Finanzierungsplan: je Förderer Kreis, Name, Betrag und – bei Zusage – gepunktet weiter zum Verwendungsnachweis; darunter Delta und Eigenmittel
const F_SYM = { zugesagt: 'ok', beantragt: 'run', geplant: 'off', abgelehnt: 'no' };
const EMPTY3 = '<span></span><span></span><span></span>';
// Punktlinie zur Frist des Verwendungsnachweises, von heute aus gerechnet – je knapper die Zeit, desto mehr Punkte in Farbe:
// drei Monate und mehr alles grau, darunter die ersten Punkte grün, unter einem Monat die Hälfte gelb, unter einer Woche alles rot
function zeitstrahl(f) {
  const v = f.vn; if (!v.noetig || !v.frist || v.st === 'erledigt') return '<span class="lead"></span>';
  const rest = Math.round((Date.parse(v.frist) - Date.parse(today())) / 864e5);
  const t = rest < 0 ? 'Frist seit ' + -rest + (rest === -1 ? ' Tag' : ' Tagen') + ' vorbei' : rest === 0 ? 'Frist ist heute' : 'noch ' + rest + (rest === 1 ? ' Tag' : ' Tage') + ' bis zur Frist';
  return `<span class="lead tl ${rest < 7 ? 'tl-r' : rest < 30 ? 'tl-y' : rest < 90 ? 'tl-g' : 'tl-0'}" title="${t}"><i></i></span>`;
}
function lNachweis(f, fertig) {
  const v = f.vn, a = `data-le="vn" data-fid="${f.id}"`;
  if (!v.noetig) return `<span class="lead"></span><span class="mi m-off" ${a} title="kein Verwendungsnachweis nötig"></span><span class="vt nn" ${a}>nicht nötig</span>`;
  if (fertig) return `<span class="lead"></span><span class="mi m-dot" ${a} title="erledigt"></span><span class="vt" ${a}>erledigt</span>`;
  const s = MI[({ offen: 'off', arbeit: 'run', erledigt: 'ok' })[v.st]], cal = `<button class="le-cal" data-le="vn-frist" data-fid="${f.id}" title="Frist des Verwendungsnachweises" aria-label="Frist des Verwendungsnachweises wählen">${ICON_CAL}</button>`;
  return `${zeitstrahl(f)}<span class="mi ${s[0]}" ${a} title="${esc((VN_ST.find(o => o[0] === v.st) || [])[1])}">${s[1]}</span><span class="vt" ${a}>${v.st === 'erledigt' ? 'erledigt' : (v.frist ? 'bis ' + fmtDate(v.frist) : 'Frist fehlt') + cal}</span>`;
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
const uebWann = u => u.termin ? fmtDate(u.termin) + (u.zeit ? ', ' + esc(u.zeit) + ' Uhr' : '') : '';
function lUebergabe(b) {
  const u = b.nach.ueb, F = finState(b);
  const top = !u.noetig ? '<div class="ml nn">nicht nötig</div>'
    : (u.st === 'erledigt' ? `<div class="ml">${mi('ok', 'erledigt')}<span>erledigt${u.termin ? ' am ' + fmtDate(u.termin) : ''}</span></div>`
      : u.st === 'terminiert' || u.termin ? `<div class="ml">${mi('run', 'terminiert')}<span>${uebWann(u) || 'terminiert'}</span></div>`
      : F.done && F.zu > 0 ? `<div class="ml warnl">${ICON_TRI}<span>Spendenübergabe einleiten</span></div>` : '')
      + (u.ort ? `<div class="ml-sub">${esc(u.ort)}</div>` : '');                      // ohne Zeile darüber nicht eingerückt (CSS)
  const view = top + (u.noetig && u.info.trim() ? (top ? '<div class="ue-sep"></div>' : '') + `<div class="note fmt">${fmtText(u.info)}</div>` : '');
  if (!u.noetig) return view;
  // mit Strg: großer Kreis mit Stift – öffnet Ort, Datum, Uhrzeit und Notizen zum Eintragen (bleibt offen, auch ohne Strg)
  return view + `<button class="le-ue" data-le="ueb" title="Spendenübergabe eintragen: Ort, Datum und Uhrzeit, Notizen" aria-label="Spendenübergabe eintragen">${ICON_PEN}</button>`;
}

/* ---------- Filtern und Sortieren: hohe Priorität zuerst, dann nach der nächsten Frist */
const CMP = {
  prio: b => PRIO_ORD[b.prio], titel: b => (b.titel || '').toLowerCase(), frist: b => (nextFrist(b) || {}).d || '9999',
};
// beim Sortieren jeden Wert je Bedarf nur einmal ausrechnen (sonst bei jedem Vergleich – bei vielen Bedarfen spürbar)
let SORT_MEMO = null;
const sortWert = (b, k, fn) => { if (!SORT_MEMO) return fn(b); let m = SORT_MEMO.get(b); if (!m) SORT_MEMO.set(b, m = {}); return k in m ? m[k] : (m[k] = fn(b)); };
function cmp(x, y, k) { const a = sortWert(x, 'c' + k, CMP[k]), c = sortWert(y, 'c' + k, CMP[k]); return typeof a === 'number' ? a - c : String(a).localeCompare(String(c), 'de'); }
/* Sortieren in bis zu drei Stufen: erst nach der ersten Angabe, innerhalb davon nach der zweiten, dann nach der dritten (UI.sort = [{ k, d }]).
   Leere Angaben stehen immer unten. Danach gilt die übliche Reihenfolge (Priorität, nächste Frist, Name). */
const SORT = {
  prio: { t: 'Priorität', w: ['hoch zuerst', 'niedrig zuerst'], v: b => PRIO_ORD[b.prio] },
  titel: { t: 'Name', w: ['A → Z', 'Z → A'], v: b => norm(b.titel) || null },
  summe: { t: 'Summe', w: ['klein → groß', 'groß → klein'], v: b => +b.summe || null },
  ort: { t: 'Ort', w: ['A → Z', 'Z → A'], v: b => norm(b.gliederung === DIO ? 'Diözese' : b.gliederung) || null },
  zust: { t: 'Ansprechperson', w: ['A → Z', 'Z → A'], v: b => norm((b.zust[0] || {}).n) || null },
  deadline: { t: 'Deadline', w: ['früh → spät', 'spät → früh'], v: b => b.deadline || null },
  fr: { t: 'Freigabe', w: ['freigegeben zuerst', 'ohne Freigabe zuerst'], v: b => ({ ok: 0, run: 1, off: 2, no: 3 })[frStand(b)] },
  fin: { t: 'Finanzierung', w: ['beendet zuerst', 'ohne Finanzierung zuerst'], v: b => ({ ok: 0, run: 1, no: 2, off: 3 })[finStand(b)] },
  vn: { t: 'Verwendungsnachweis', w: ['nächste Frist zuerst', 'späteste Frist zuerst'], v: b => {
    const Z = b.foerderer.filter(f => f.status === 'zugesagt'), L = Z.filter(f => f.vn.noetig), auf = L.filter(f => f.vn.st !== 'erledigt');
    return !Z.length ? null : auf.length ? '0' + (auf.map(f => f.vn.frist).filter(Boolean).sort()[0] || '9999') : L.length ? '1' : '2'; } },
  ueb: { t: 'Spendenübergabe', w: ['früh → spät', 'spät → früh'], v: b => b.nach.ueb.noetig && b.nach.ueb.termin || null },
  angelegt: { t: 'Angelegt', w: ['alt → neu', 'neu → alt'], v: b => b.angelegt || null },
};
function sortVergleich(x, y) {
  for (const s of UI.sort || []) {
    const S = SORT[s.k]; if (!S) continue;
    const a = sortWert(x, s.k, S.v), c = sortWert(y, s.k, S.v);
    if (a === c) continue;
    if (a == null) return 1; if (c == null) return -1;                                   // leer immer unten
    const r = typeof a === 'number' && typeof c === 'number' ? a - c : String(a).localeCompare(String(c), 'de');
    if (r) return s.d === 'ab' ? -r : r;
  }
  return 0;
}
// je Durchgang (z. B. ein Neuzeichnen) nur einmal filtern und sortieren; jede Änderung (changed) und jeder andere Stand verwirft das
let FCACHE = null;
function filtered() {
  const ck = ordKey();
  if (FCACHE && FCACHE.k === ck && FCACHE.ids === ORDER.ids && FCACHE.okey === ORDER.key && FCACHE.D === D && FCACHE.n === D.bedarfe.length) return FCACHE.L.slice();
  const L = filterUndSortiere();
  FCACHE = { k: ck, ids: ORDER.ids, okey: ORDER.key, D, n: D.bedarfe.length, L };
  queueMicrotask(() => { FCACHE = null; });
  return L.slice();
}
// o.arch: Archiv statt des Reiters; o.alle: ohne Suche und Filter (Reihenfolge für ↑/↓ auf der Seite eines Bedarfs, der in der Liste nicht steht)
function filterUndSortiere(o = {}) {
  const arch = o.arch != null ? o.arch : UI.tab === 'archiv', q = o.alle ? '' : norm(UI.q);
  let L = D.bedarfe.filter(b => !!b.archiv === arch);
  if (UI.fSw && !o.alle) L = L.filter(b => b.stichworte.includes(UI.fSw));
  if (UI.prioKopf === 2 && !o.alle) L = L.filter(b => b.prio === 'hoch');
  if (q) L = L.filter(b => norm([b.titel, b.gliederung, b.beschreibung, ...b.stichworte, ...b.zust.map(z => z.n), ...b.foerderer.map(f => f.name)].join(' ')).includes(q));
  const prioVorn = (x, y) => UI.prioKopf ? (x.prio === 'hoch' ? 0 : 1) - (y.prio === 'hoch' ? 0 : 1) : 0;
  SORT_MEMO = new Map();
  try { L.sort((x, y) => prioVorn(x, y) || sortVergleich(x, y) || cmp(x, y, 'prio') || cmp(x, y, 'frist') || cmp(x, y, 'titel')); } finally { SORT_MEMO = null; }
  if (!o.alle && ORDER.ids && ORDER.key === ordKey()) { const i = id => { const n = ORDER.ids.indexOf(id); return n < 0 ? 1e9 : n; }; L.sort((x, y) => i(x.id) - i(y.id)); }
  return L;
}
// Reihenfolge, solange mit Strg bearbeitet wird (Zeilen springen nicht unter dem Mauszeiger weg)
// gilt nur für die Suche, Filter und Sortierung, mit denen sie entstand – ändert sich davon etwas, wird neu geordnet
const ORDER = { ids: null, key: '' };
const ordKey = () => JSON.stringify([UI.tab, UI.q, UI.fSw, UI.prioKopf, UI.sort]);
const anyFilter = () => !!(UI.q || UI.fSw || UI.prioKopf === 2);

/* ---------- kompakte Ansicht: je Bedarf eine Zeile – Name, Summe, Ort und je Bereich nur der Stand als Kreis mit Wort.
   Grün: durch · Gelb: in Bearbeitung · Rot: abgelehnt · leerer Kreis: noch nichts · grau: nicht nötig */
const kz = (s, t, cls = '') => `<span class="kz ${cls}">${mi(s)}<span>${t}</span></span>`;
const kGrau = t => `<span class="kz nn">${t}</span>`;
// Stand der Freigabe: ok (alles da), no (etwas abgelehnt), off (noch nichts angefangen), run (dazwischen)
function frStand(b) {
  const L = frItems(b).filter(frNeeded), a = angebotUL(b);
  if (L.some(i => i.st === 'nein')) return 'no';
  if (!frOffen(b).names.length) return 'ok';
  return L.every(i => i.st === 'offen') && (!a || a.st === 'fehlt') ? 'off' : 'run';
}
// Stand der Finanzierung: off (nichts eingetragen), ok (steht), run (Anträge geplant oder offen), no (Lücke: nichts mehr offen, aber nicht gedeckt)
const finStand = b => { const F = finState(b); return !F.fs.length && !F.eig ? 'off' : F.gedeckt ? 'ok' : F.fs.some(f => f.status === 'geplant' || f.status === 'beantragt') ? 'run' : 'no'; };
const kFreigabe = b => ({ ok: kz('ok', 'freigegeben', 'k-ok'), no: kz('no', 'keine Freigabe', 'k-no'), off: kz('off', 'keine Freigabe', 'k-off'), run: kz('run', 'in Bearbeitung', 'k-run') })[frStand(b)];
function kFinanz(b) {
  const s = finStand(b), F = finState(b);
  if (s === 'ok') return kz('ok', F.done ? 'Finanzierung beendet' : 'Finanzierung steht', 'k-ok');
  if (s === 'no') return kz('no', !F.zu && F.eig && ct(F.eig) >= ct(F.S) ? 'nur Eigenmittel' : 'Lücke', 'k-no');
  return s === 'run' ? kz('run', 'in Bearbeitung', 'k-run') : kz('off', 'keine Finanzierung', 'k-off');
}
function kNachweis(b) {
  const Z = b.foerderer.filter(f => f.status === 'zugesagt'), L = Z.filter(f => f.vn.noetig);
  if (!Z.length) return kGrau('noch keine Zusage');
  if (!L.length) return kGrau('nicht nötig');
  if (L.every(f => f.vn.st === 'erledigt')) return kz('ok', 'erbracht', 'k-ok');
  if (L.some(f => f.vn.st !== 'offen')) return kz('run', 'in Bearbeitung', 'k-run');
  const fr = L.map(f => f.vn.frist).filter(Boolean).sort()[0];
  return kz('off', 'offen' + (fr ? ', bis ' + fmtDate(fr) : ''), 'k-off');
}
function kUebergabe(b) {
  const u = b.nach.ueb, F = finState(b);
  if (!u.noetig) return kGrau('nicht nötig');
  if (u.termin) return u.st === 'erledigt' ? kz('ok', uebWann(u), 'k-ok') : `<span class="kz">${uebWann(u)}</span>`;
  if (u.st === 'erledigt') return kz('ok', 'erledigt', 'k-ok');
  return F.done && F.zu > 0 ? `<span class="kz warnl" title="Finanzierung steht – Spendenübergabe einleiten">${ICON_TRI}<span>nicht geplant</span></span>` : kGrau('nicht geplant');
}
const KOMPAKT = () => UI.ansicht === 'kompakt';
// aufgeklappter Bedarf in der kompakten Liste: Finanzierung und Nachweis teilen sich zwei Spalten – der Verwendungsnachweis soll genau
// unter seiner Überschrift stehen. Dafür bekommt die Zeile den Abstand von dieser Überschrift bis zum Zellenende. Gemessen wird nach dem
// Zeichnen und jedes Mal, wenn sich die Spalten verschieben (Fenstergröße, Symbole beim Überfahren, neue Inhalte)
function aufMessen() {
  const tr = $('#list-body tr.auf'), th = $$('table.list.kompakt thead th')[6], td = tr && tr.querySelector('td.l-fin'); if (!th || !td) return;
  for (let i = 0; i < 2; i++) {                    // zweimal: die neue Breite kann die Spalten noch einmal verschieben
    const a = th.getBoundingClientRect().left, z = td.getBoundingClientRect().right, pl = parseFloat(getComputedStyle(th).paddingLeft), pr = parseFloat(getComputedStyle(td).paddingRight);
    tr.style.setProperty('--vnw', (z - a) + 'px'); tr.style.setProperty('--vtw', Math.max(90, z - pr - a - pl - 23) + 'px');   // 23: Kreis und Abstand
  }
}
const AUF_RO = typeof ResizeObserver === 'function' ? new ResizeObserver(() => aufMessen()) : null;
function aufMass() {
  aufMessen();
  if (!AUF_RO) return;
  AUF_RO.disconnect();
  if ($('#list-body tr.auf')) $$('table.list.kompakt thead th').forEach(t => AUF_RO.observe(t));
}
window.addEventListener('resize', () => aufMessen());
// Priorität ganz vorn als Stern: leer umrandet = keine Prio, gelb = Prio (Priorität „hoch“); ein Klick schaltet um
const ICON_STERN = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 1.6l1.95 3.95 4.35.63-3.15 3.07.74 4.33L8 11.53l-3.89 2.05.74-4.33L1.7 6.18l4.35-.63z"/></svg>';
const sternZelle = b => `<td class="l-star"><button class="star-p${b.prio === 'hoch' ? ' on' : ''}" data-le="prio" aria-pressed="${b.prio === 'hoch'}" title="${b.prio === 'hoch' ? 'Prio – klicken: keine Prio' : 'keine Prio – klicken: Prio'}" aria-label="Priorität">${ICON_STERN}</button></td>`;
// Name, Summe, Ort, Ansprechperson und Deadline: anklickbar ist nur das Wort selbst – ein Klick daneben klappt den Bedarf auf bzw. öffnet ihn
const wort = (k, t) => `<span class="le-w" data-le="${k}">${t}</span>`;
const nameZelle = b => `${sternZelle(b)}<td class="l-name">${wort('titel', b.titel ? esc(b.titel) : '<span class="ph">Name des Bedarfs</span>')}${b.manuell ? ` <span class="pause-t">(${esc(b.manuell)})</span>` : ''}</td>
    <td class="l-sum">${wort('summe', b.summe ? eur(b.summe) : '<span class="ph">Summe</span>')}</td>`;
const ortText = b => b.gliederung ? esc(b.gliederung === DIO ? 'Diözese' : b.gliederung) : '<span class="ph">Ort</span>';
// solange die Freigabe nicht vollständig ist, wird hinter ihr noch nichts angegangen: Finanzierung, Nachweis und Übergabe grau (ohne Farben)
function row(b) {
  const kl = (b.manuell ? 'paused' : '') + (frOffen(b).names.length ? ' ohne-fg' : '');
  const fg = frStand(b), zeig = fg === 'ok' || b.foerderer.some(f => f.status === 'zugesagt');   // kompakt ohne Freigabe und ohne Zusage: nur der Hinweis
  if (KOMPAKT() && UI.auf !== b.id) return `<tr data-act="open" data-id="${b.id}" tabindex="0" class="${kl}">${nameZelle(b)}
    <td class="l-ort"><div class="ort">${wort('ort', ortText(b))}</div></td><td class="k-fr">${kFreigabe(b)}</td>${zeig ? `<td class="k-nach">${kFinanz(b)}</td><td class="k-nach">${kNachweis(b)}</td><td class="k-nach">${kUebergabe(b)}</td>`
      : `<td class="k-nach">${kGrau(fg === 'no' ? 'Freigabe abgelehnt' : 'Freigabe ausstehend')}</td><td class="k-nach"></td><td class="k-nach"></td>`}</tr>`;
  const auf = KOMPAKT();                                  // in der kompakten Ansicht aufgeklappt: Finanzierung und Nachweis über zwei Spalten
  return `<tr data-act="open" data-id="${b.id}" tabindex="0" class="${kl}${auf ? ' auf' : ''}">${nameZelle(b)}
    <td class="l-meta"><div class="ort">${wort('ort', ortText(b))}</div><div>${wort('zust', b.zust[0] && b.zust[0].n ? esc(b.zust[0].n) : '<span class="ph">Ansprechperson</span>')}</div><div>${wort('deadline', b.deadline ? 'bis ' + fmtDate(b.deadline) : '<span class="nn">ohne Deadline</span>')}</div></td>
    <td class="l-fr">${lFreigabe(b)}</td>
    <td class="l-fin"${auf ? ' colspan="2"' : ''}>${lFinanz(b)}</td>
    <td class="l-ueb">${lUebergabe(b)}</td>
  </tr>`;
}
const NCOL = 7;
function listBody() {
  const L = filtered();
  if (!L.length) return { html: `<tr><td colspan="${KOMPAKT() ? 8 : NCOL}"><div class="empty">${UI.tab === 'archiv' ? 'Im Archiv liegt nichts' + (anyFilter() ? ', das zu den Filtern passt.' : '.') : D.bedarfe.some(b => !b.archiv) ? 'Kein Bedarf passt zu den Filtern.' : 'Noch keine Bedarfe – oben rechts mit „+ Bedarf“ den ersten anlegen.'}</div></td></tr>`, n: 0 };
  return { html: L.map(row).join(''), n: L.length };
}
// Leiste der Liste: hängt wie auf der Seite eines Bedarfs unter der Kopfzeile – so beginnen beide Seiten gleich hoch und beim Hineinschieben springt nichts
// ohne eigene Überschrift (der Reiter sagt schon „Bedarfe“ bzw. „Archiv“): links die Zahl, rechts Ansicht, Suche, Stichwort und ganz außen das „i“ für die Tastaturbefehle
const zahlText = (n, all) => n + ' von ' + all;
function listBar() {
  const arch = UI.tab === 'archiv', all = D.bedarfe.filter(b => !!b.archiv === arch), n = filtered().length, komp = KOMPAKT();
  const sws = uniq(all.flatMap(b => b.stichworte)).sort((a, c) => a.localeCompare(c, 'de'));
  return `<div class="subbar list-head">
      <span class="muted" id="list-count">${zahlText(n, all.length)}</span>
      <div class="tools">
        <div class="seg ansicht" role="group" aria-label="Ansicht der Liste"><button data-act="ansicht" data-v="voll" class="${komp ? '' : 'on'}" title="alle Angaben, Förderer einzeln">Ausführlich</button><button data-act="ansicht" data-v="kompakt" class="${komp ? 'on' : ''}" title="je Bedarf eine Zeile, je Bereich nur der Stand">Kompakt</button></div>
        <input type="search" id="q" data-ui="q" value="${esc(UI.q)}" placeholder="Suchen …" aria-label="Suchen (Strg+F)">
        <select data-ui="fSw" class="${UI.fSw ? 'on' : ''}" aria-label="Stichwort"><option value="">Stichwort: alle</option>${sws.map(v => `<option value="${esc(v)}" ${UI.fSw === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
        <button class="link" data-act="clear"${anyFilter() ? '' : ' hidden'}>Filter löschen</button>
        <button class="info kz-info" data-act="kuerzel" data-tip="Tastaturbefehle" aria-label="Tastaturbefehle anzeigen">i</button>
      </div>
    </div>`;
}
function listView() {
  const body = listBody(), komp = KOMPAKT(), colw = colwGet(komp);
  if (!komp || !UI.auf || colw) AUF_W = null;
  return `<main><section class="card list-card">
    <div class="tablewrap"><table class="list${colw ? ' fixed' : ''}${komp ? ' kompakt' : ''}${komp && UI.auf ? ' hat-auf' : ''}${AUF_W ? ' auf-fest' : ''}"${colw ? ` style="width:${colw.reduce((a, x) => a + x, 0)}px"` : AUF_W && AUF_W.min ? ` style="min-width:${AUF_W.min}px"` : ''}>${colw ? '<colgroup>' + colw.map(x => `<col style="width:${x}px">`).join('') + '</colgroup>' : AUF_W ? aufCols() : ''}<thead><tr>
      ${(komp ? ['<th class="l-star">' + kopfStern(), ...[['titel', 'Bedarf'], ['summe', 'Summe'], ['ort', 'Ort'], ['fr', 'Freigabe'], ['fin', 'Finanzierung'], ['vn', 'Verwendungsnachweis'], ['ueb', 'Spendenübergabe']].map(([k, t]) => '<th>' + sk(k, t))]
        : ['<th class="l-star">' + kopfStern(), '<th>' + sk('titel', 'Bedarf'), '<th>' + sk('summe', 'Summe'), '<th>' + sk('ort', 'Ort'), '<th class="l-fr">' + sk('fr', 'Freigabe'), `<th class="l-fin"><div class="fg fg-h"><span>${sk('fin', 'Finanzierungsplan')}</span><span>${sk('vn', 'Verwendungsnachweis')}</span></div>`, '<th class="l-ueb">' + sk('ueb', 'Spendenübergabe')])
        .map((t, i) => t + `<span class="col-rs" data-i="${i}" title="Spaltenbreite ziehen (Doppelklick: alle Spalten zurücksetzen)"></span></th>`).join('')}
    </tr></thead><tbody id="list-body">${body.html}</tbody></table></div>
  </section></main>`;
}
// Spaltenkopf zum Sortieren: Klick nimmt die Spalte als nächste Stufe dazu, weiterer Klick dreht die Richtung, der dritte nimmt sie wieder heraus
function sk(k, t) {
  const i = (UI.sort || []).findIndex(s => s.k === k), s = UI.sort && UI.sort[i];
  return `<button class="th-sort${s ? ' on' : ''}" data-act="sort-th" data-k="${k}" title="Sortieren nach ${SORT[k].t}${s ? ' – jetzt: ' + SORT[k].w[s.d === 'ab' ? 1 : 0] : ''}">${t}${s ? `<span class="so">${i + 1}${s.d === 'ab' ? '↓' : '↑'}</span>` : ''}</button>`;
}
// Stern im Spaltenkopf: 1. Klick – Rand golden, alle bleiben sichtbar, die mit Prio stehen oben; 2. Klick – ausgefüllt, nur noch die mit Prio;
// 3. Klick – wieder normal
const KOPF_STERN = ['Klick: Bedarfe mit Prio nach oben', 'Prio oben – Klick: nur noch Bedarfe mit Prio zeigen', 'nur Prio – Klick: wieder alle wie gewohnt'];
const kopfStern = () => `<button class="kopf-stern s${UI.prioKopf || 0}" data-act="prio-kopf" title="${KOPF_STERN[UI.prioKopf || 0]}" aria-label="Priorität: ${KOPF_STERN[UI.prioKopf || 0]}">${ICON_STERN}</button>`;
function sortSpalte(k) {
  const L = (UI.sort || []).slice(), i = L.findIndex(s => s.k === k);
  if (i < 0) { if (L.length >= 3) L.pop(); L.push({ k, d: 'auf' }); }
  else if (L[i].d === 'auf') L[i] = { k, d: 'ab' };
  else L.splice(i, 1);
  UI.sort = L; ORDER.ids = null; keep(renderNow);
}
/* ---------- Spaltenbreiten wie in Excel: am rechten Rand eines Spaltenkopfs ziehen – nur diese Spalte ändert sich, die rechts davon rücken mit.
   Je Ansicht eigene Breiten mit Mindestbreiten (kompakt: Freigabe, Finanzierung, Nachweis und Übergabe brauchen Platz, wenn ein Bedarf aufklappt).
   Die Breiten merkt sich der Browser; Doppelklick auf einen Rand oder das Zahnrad setzt sie zurück. */
const COLW_KEY = 'bl-colw', COL_MIN = [30, 140, 70, 90, 110, 330, 150];
const COLW_KEY_K = 'bl-colw-k', COL_MIN_K = [30, 140, 80, 90, 155, 300, 150, 140];
const colwGet = (komp = KOMPAKT()) => { try { const a = JSON.parse(localStorage.getItem(komp ? COLW_KEY_K : COLW_KEY) || 'null'); return Array.isArray(a) && a.length === (komp ? COL_MIN_K : COL_MIN).length && a.every(x => x > 0) ? a : null; } catch (e) { return null; } };
const colwSet = (a, komp = KOMPAKT()) => { const k = komp ? COLW_KEY_K : COLW_KEY; try { if (a) localStorage.setItem(k, JSON.stringify(a)); else localStorage.removeItem(k); } catch (e) { /* nur in diesem Browser */ } };
document.addEventListener('pointerdown', e => {
  const hnd = e.target.closest && e.target.closest('.col-rs'); if (!hnd || e.button !== 0) return;
  e.preventDefault();
  const table = hnd.closest('table'), i = +hnd.dataset.i, komp = table.classList.contains('kompakt'), MIN = komp ? COL_MIN_K : COL_MIN;
  const w = colwGet(komp) || [...table.querySelectorAll('thead th')].map(th => Math.round(th.getBoundingClientRect().width));
  let cg = table.querySelector('colgroup');
  if (cg && cg.classList.contains('auf-w')) { cg.remove(); cg = null; AUF_W = null; table.classList.remove('auf-fest'); table.style.minWidth = ''; }   // vorläufig festgehaltene Breiten werden zu eigenen
  if (!cg) { cg = h('colgroup', null, w.map(() => h('col'))); table.prepend(cg); }
  const cols = [...cg.children];
  const apply = () => { cols.forEach((c, k) => { c.style.width = w[k] + 'px'; }); table.style.width = w.reduce((a, x) => a + x, 0) + 'px'; table.classList.add('fixed'); };
  const x0 = e.clientX, w0 = w[i]; let gezogen = false;                          // ein bloßer Klick auf den Rand legt nichts fest
  hnd.setPointerCapture(e.pointerId); document.body.classList.add('col-resizing');
  const move = ev => { if (!gezogen && Math.abs(ev.clientX - x0) < 3) return; gezogen = true; w[i] = Math.max(MIN[i], Math.round(w0 + ev.clientX - x0)); apply(); };
  const up = () => { hnd.removeEventListener('pointermove', move); hnd.removeEventListener('pointerup', up); hnd.removeEventListener('lostpointercapture', up); document.body.classList.remove('col-resizing'); if (gezogen) colwSet(w, komp); };
  hnd.addEventListener('pointermove', move); hnd.addEventListener('pointerup', up); hnd.addEventListener('lostpointercapture', up);
});
document.addEventListener('dblclick', e => { const r = e.target.closest && e.target.closest('.col-rs'); if (r) { colwSet(null, r.closest('table').classList.contains('kompakt')); keep(renderNow); } });

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
document.addEventListener('mousedown', e => { if (!e.target.closest('.menu, [data-act="sw-pop"], [data-act="fristen"], [data-act="menu"], [data-act="info"], [data-act="circ"], [data-act="st-menu"], [data-act="more"], [data-act="fw"], [data-act="kuerzel"], input.dfeld, input.zfeld')) closeMenus(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
window.addEventListener('scroll', e => { if (!(e.target instanceof Element && e.target.closest('.menu'))) closeMenus(); }, true);
