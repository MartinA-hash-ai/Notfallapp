/* ===================================================================== Auswertung „Spenden JJJJ“: alle Spenden des Jahres – Zwecke, Gliederungen, Daueraufträge, Jahresverlauf */

// Grundlage sind die eingelesenen Dateien im Ordner „Spendeneingänge …“ (Verwendungszweck und Konto stehen nur dort) –
// gezählt wird jede Spende des Jahres, egal ob sie einer Maßnahme zugeordnet ist.
// Zwecke (D.zwecke) zählen automatisch: Schlagwort im Verwendungszweck oder Konto (Spalte „Personenname“ = Gliederung).
// Passt eine Spende zu mehreren Zwecken, wird sie erst gezählt, wenn man sie einmal geklärt hat. Was zu keinem Zweck passt, ist zweckungebunden.
// Von Hand festgelegt: D.spenden.zweck[Schlüssel] = Zweck-Id oder „-“ (zweckungebunden).
const SPJ_FREI = '-', SPJ_OFFEN = '?', SPJ_MAX = 200;
const SPJ = { z: null, g: null, typed: '', more: 0, lv: 'frei' };   // gewählte Zeile (Zweck / Gliederung) – filtert Kacheln und Grafiken; Vorschau beim Tippen; lv: Liste „zweckungebunden“ oder „beim Zweck“
const spjName = y => 'Spenden ' + y;
const spDispName = x => x.allg ? spjName(x.allg) : x.m.name || '(ohne Namen)';
const spjHer = () => ['mass', 'ohne'].includes(UI.spHer) ? UI.spHer : 'alle';

// Gliederung aus dem Konto: der gemeinsame Anfang („Paderborn - …“) wird weggelassen
let _spjPre = { sig: null, pre: '' };
function spjPrefix() {
  if (_spjPre.sig === SP.sig && _spjPre.n === SP.rows.length) return _spjPre.pre;
  const cnt = new Map(); let n = 0, pre = '';
  for (const r of SP.rows) { if (!r.konto) continue; n++; const m = /^(.+?)\s+[-–]\s+\S/.exec(r.konto); if (m) cnt.set(m[1], (cnt.get(m[1]) || 0) + 1); }
  for (const [p, c] of cnt) if (c >= n * 0.8) pre = p;
  _spjPre = { sig: SP.sig, n: SP.rows.length, pre };
  return pre;
}
function spGlied(k) {
  k = str(k).trim(); if (!k) return '(ohne Angabe)';
  const p = spjPrefix();
  return p && k.startsWith(p) && k.length > p.length ? k.slice(p.length).replace(/^\s*[-–]\s*/, '') || k : k;
}

// Prüffunktion eines Zwecks: ausschließende Schlagworte zuerst, dann Maßnahme (der die Spende zugeordnet ist), Konto, Schlagworte → Grund des Treffers oder null
const _spjM = new Map();
function spjMatcher(z) {
  const key = JSON.stringify([z.worte || [], z.konten || [], z.massnahmen || []]);
  let f = _spjM.get(key); if (f) return f;
  const tests = (z.worte || []).map(spTerm).filter(Boolean), pos = tests.filter(t => !t.neg), neg = tests.filter(t => t.neg), kt = new Set(z.konten || []), mt = new Set(z.massnahmen || []);
  f = (rec, mid) => {
    for (const t of neg) if (t.test(rec)) return null;
    if (mid && mt.has(mid)) { const x = C.byId.get(mid); return 'Maßnahme ' + ((x && x.m.name) || '?'); }
    if (kt.has(rec.konto)) return 'Konto ' + spGlied(rec.konto);
    for (const t of pos) if (t.test(rec)) return t.word;
    return null;
  };
  if (_spjM.size > 200) _spjM.clear();
  _spjM.set(key, f);
  return f;
}
// alle Spenden des Jahres mit Zweck, Herkunft (Maßnahme oder nicht) und Dauerauftrag – nur neu rechnen, wenn sich etwas geändert hat
let _spj = { key: null, val: null };
function spjCompute(y) {
  const cmp = spCompute(), key = _spCmp.key + '|' + y + '|' + JSON.stringify(D.zwecke);
  if (_spj.key === key && _spj.rows === SP.rows) return _spj.val;
  const a = mkdn(+y, 1, 1), b = mkdn(+y, 12, 31), ids = new Set(D.zwecke.map(z => z.id)), fs = D.zwecke.map(z => [z.id, spjMatcher(z)]), list = [];
  for (const rec of SP.rows) {
    if (rec.d < a || rec.d > b) continue;
    const m = cmp.assigned(rec.k), hits = []; for (const [id, f] of fs) { const w = f(rec, m); if (w) hits.push({ id, w }); }
    const hv = D.spenden.zweck[rec.k], hand = hv === SPJ_FREI || ids.has(hv);
    list.push({ rec, hits, hand, z: hand ? hv : hits.length === 1 ? hits[0].id : hits.length ? SPJ_OFFEN : SPJ_FREI, mass: !!m && !isAllg(m), m, da: spIsDA(rec) });
  }
  const missing = Object.entries(D.spenden.zu).filter(([k, z]) => !SP.byKey.has(k) && dn(z.d) >= a && dn(z.d) <= b).length;   // zugeordnet, aber keine Datei mehr
  _spj = { key, rows: SP.rows, val: { y: +y, a, b, list, missing } };
  return _spj.val;
}
// gefiltert nach Herkunft und – sofern nicht ausgenommen – nach gewähltem Zweck / gewählter Gliederung
function spjSet(J, o = {}) {
  const her = spjHer();
  return J.list.filter(e => (her === 'alle' || (her === 'mass') === e.mass) && (o.noZ || SPJ.z == null || e.z === SPJ.z) && (o.noG || SPJ.g == null || e.rec.konto === SPJ.g));
}
function spjStats(set) {
  const acc = () => ({ n: 0, sum: 0 }), add = (o, b) => { o.n++; o.sum += b; };
  const s = { n: 0, sum: 0, da: acc(), zg: acc(), frei: acc(), offen: acc(), mass: acc(), ohne: acc(), daSp: new Set(), sp: new Set() };
  const bs = [];
  for (const e of set) {
    const b = e.rec.b, who = e.rec.iban || e.rec.name; add(s, b); bs.push(b);
    if (who) s.sp.add(who);
    if (e.da) { add(s.da, b); if (who) s.daSp.add(who); }
    add(e.z === SPJ_FREI ? s.frei : e.z === SPJ_OFFEN ? s.offen : s.zg, b);
    add(e.mass ? s.mass : s.ohne, b);
  }
  bs.sort((p, q) => p - q);
  s.avg = s.n ? s.sum / s.n : null;
  s.med = s.n ? (s.n % 2 ? bs[(s.n - 1) / 2] : (bs[s.n / 2 - 1] + bs[s.n / 2]) / 2) : null;
  return s;
}
const spjWho = n => n.toLocaleString('de-DE') + (n === 1 ? ' Spender:in' : ' Spender:innen');
const spjPct = (v, tot) => tot ? num1(v / tot * 100) + ' %' : '–';

/* ---------- Aktionen (alle mit Strg+Z rückgängig) */
function spjSetZweck(keys, v, msg) {
  commit(d => { for (const k of keys) { if (v) d.spenden.zweck[k] = v; else delete d.spenden.zweck[k]; } },
    msg || (keys.length === 1 ? 'Zweck einer Spende ' : 'Zweck von ' + keys.length + ' Spenden ') + (v ? 'festgelegt' : 'wieder automatisch'));
}
function spjAddZweck() {
  const used = new Set(D.zwecke.map(z => z.farbe.toLowerCase())), id = uid();
  const farbe = (PALETTE.find(p => !used.has(p[1].toLowerCase())) || PALETTE[D.zwecke.length % PALETTE.length])[1];
  let n = 1; while (D.zwecke.some(z => z.name === 'Neuer Zweck' + (n > 1 ? ' ' + n : ''))) n++;
  SPJ.z = id; SPJ.g = null; SPJ.typed = ''; SPJ.lv = 'frei'; SPJ.focusName = true;                // vor dem Neuzeichnen: der neue Zweck ist gleich gewählt, Name zum Überschreiben markiert
  commit(d => { d.zwecke.push({ id, name: 'Neuer Zweck' + (n > 1 ? ' ' + n : ''), farbe, worte: [], konten: [], massnahmen: [] }); }, 'Spendenzweck angelegt');
}
function spjEditZweck(id, fn, msg) { commit(d => { const z = d.zwecke.find(q => q.id === id); if (z) fn(z); }, msg); }
async function spjDelZweck(z) {
  const nHand = Object.values(D.spenden.zweck).filter(v => v === z.id).length;
  if (!await confirmBox('Zweck löschen', 'Den Zweck „' + z.name + '“ löschen? Seine Spenden zählen danach wieder automatisch' + (nHand ? ' (auch die ' + nHand + ' von Hand festgelegten)' : '') + '. Strg+Z holt ihn zurück.', 'Löschen')) return;
  commit(d => { d.zwecke = d.zwecke.filter(q => q.id !== z.id); for (const [k, v] of Object.entries(d.spenden.zweck)) if (v === z.id) delete d.spenden.zweck[k]; }, 'Spendenzweck „' + z.name + '“ gelöscht');
  SPJ.z = null;
}
function spjMoveZweck(id, dir) {
  commit(d => { const i = d.zwecke.findIndex(q => q.id === id), j = i + dir; if (i < 0 || j < 0 || j >= d.zwecke.length) return; [d.zwecke[i], d.zwecke[j]] = [d.zwecke[j], d.zwecke[i]]; }, 'Reihenfolge der Spendenzwecke geändert');
}

/* ---------- Ansicht */
function spjView(y) {
  if (!SP.rows.length) return h('div', { class: 'spj-empty muted' }, ST.conn !== 'ok' ? 'Mailing-Ordner nicht verbunden – die Übersicht über alle Spenden des Jahres rechnet mit den eingelesenen Spendendateien.' :
    SP.busy ? 'Spendendateien werden eingelesen …' : 'Noch keine Buchungen eingelesen – Export der Spendeneingänge mit „+ Buchung hinzufügen“ ablegen.');
  const J = spjCompute(y);
  if (SPJ.z != null && SPJ.z !== SPJ_FREI && SPJ.z !== SPJ_OFFEN && !D.zwecke.some(z => z.id === SPJ.z)) SPJ.z = null;
  const set = spjSet(J), her = spjHer(), zName = id => id === SPJ_FREI ? 'zweckungebunden' : id === SPJ_OFFEN ? 'zu klären' : (D.zwecke.find(z => z.id === id) || {}).name || '?';
  const seg = (v, label) => h('button', { class: 'seg-btn' + (her === v ? ' on' : ''), 'aria-pressed': String(her === v), onclick: () => { UI.spHer = v; SPJ.more = 0; renderNow(); } }, label);
  const chip = (label, clear) => h('span', { class: 'spj-chip' }, label, h('button', { class: 'sp-x', 'aria-label': 'Filter aufheben', tip: 'Filter aufheben', onclick: () => { clear(); SPJ.more = 0; renderNow(); } }, '×'));
  return h('div', { class: 'spj' },
    h('div', { class: 'spj-bar' },
      h('span', { class: 'spj-lbl' }, 'Herkunft'), h('span', { class: 'segs spj-her' }, seg('alle', 'alle Spenden'), seg('mass', 'aus Maßnahmen'), seg('ohne', 'ohne Maßnahme')),
      SPJ.z != null ? chip('Zweck: ' + zName(SPJ.z), () => { SPJ.z = null; SPJ.typed = ''; }) : null,
      SPJ.g != null ? chip('Gliederung: ' + spGlied(SPJ.g), () => { SPJ.g = null; }) : null,
      SPJ.z == null && SPJ.g == null ? h('span', { class: 'muted small' }, 'Klick auf einen Zweck oder eine Gliederung filtert Kacheln, Grafiken und die Liste unter „Spendenzwecke zuordnen“.') : null,
      J.missing ? h('span', { class: 'warn small', tip: 'Diese Spenden sind Maßnahmen zugeordnet, stehen aber in keiner Datei im Ordner „Spendeneingänge …“ mehr – ohne Verwendungszweck und Konto fehlen sie in dieser Übersicht.' },
        '⚠ ' + spCount(J.missing) + ' ohne Datei') : null),
    h('div', { class: 'sp-kpi' }, spjTiles(set), spjCharts(J.y)),
    h('div', { class: 'spj-tabs' }, spjZweckTable(spjSet(J, { noZ: true })), spjGliedTable(spjSet(J, { noG: true }))));
}
function spjTiles(set) {
  const s = spjStats(set);
  const tile = (label, value, sub, tip) => h('div', { class: 'sp-tile', tip: tip || null }, h('div', { class: 'sp-tl' }, label), h('div', { class: 'sp-tv' }, value), sub ? h('div', { class: 'sp-ts' }, sub) : null);
  return h('div', { class: 'sp-tiles spj-tiles' },
    tile('Spendensumme', s.n ? eur0(s.sum) : '–', spCount(s.n) + (s.sp.size ? ' · ' + spjWho(s.sp.size) : ''), 'Spender:innen gezählt nach IBAN (ohne IBAN: Name)'),
    tile('Ø-Spende', s.avg != null ? eur(s.avg) : '–', s.med != null ? 'Median ' + eur(s.med) : null, 'Der Median ist die mittlere Spende – große Einzelspenden verzerren ihn kaum.'),
    tile('Daueraufträge', s.da.n ? eur0(s.da.sum) : '–', s.da.n ? s.da.n.toLocaleString('de-DE') + (s.da.n === 1 ? ' Buchung' : ' Buchungen') + ' · ' + spjWho(s.daSp.size) + ' · ' + spjPct(s.da.sum, s.sum) + ' der Summe' : 'keine erkannt',
      'Dauerauftrag laut Buchungstext der Bank (z. B. „Dauerauftragsgutschrift“); Spender:innen nach IBAN'),
    tile('Zweckgebunden', s.n ? eur0(s.zg.sum) : '–', s.n ? spjPct(s.zg.sum, s.sum) + ' · zweckungebunden ' + eur0(s.frei.sum) + (s.offen.n ? ' · ' + s.offen.n + ' zu klären' : '') : null,
      'Spenden, die zu einem der Zwecke unten passen'),
    h('div', { class: 'sp-erl spj-herk', tip: 'aus Maßnahmen = einer Maßnahme zugeordnet; ohne Maßnahme = allgemein abgehakt oder noch offen' },
      h('span', null, 'aus Maßnahmen ', h('b', null, eur0(s.mass.sum)), ' (' + s.mass.n.toLocaleString('de-DE') + ')'),
      h('span', null, 'ohne Maßnahme ', h('b', null, eur0(s.ohne.sum)), ' (' + s.ohne.n.toLocaleString('de-DE') + ')')));
}
function spjCharts(y, all) {
  const ds0 = Object.assign({ y: String(y) }, all ? { all: '1' } : {});
  return h('div', { class: 'sp-charts' },
    h('div', { class: 'sp-cht' }, h('b', null, 'Jahresverlauf'), h('span', { class: 'muted' }, ' · Spendensumme kumuliert; Punkte unten = PAL der Maßnahmen')),
    h('div', { class: 'sp-chart', style: { height: '170px' }, dataset: Object.assign({ chart: 'ycum' }, ds0) }),          // feste Höhe: beim Neuzeichnen springt nichts
    h('div', { class: 'sp-cht' }, h('b', null, 'Spenden pro Woche'), ' ', h('span', { class: 'spj-key k1' }), h('span', { class: 'muted' }, ' Einzelspenden '), h('span', { class: 'spj-key k2' }), h('span', { class: 'muted' }, ' Daueraufträge')),
    h('div', { class: 'sp-chart', style: { height: '150px' }, dataset: Object.assign({ chart: 'yweek' }, ds0) }));
}
// Tabelle der Zwecke (ohne Zweck-Filter, damit alle Zeilen sichtbar bleiben); Klick wählt einen Zweck
function spjZweckTable(set, print) {
  const by = new Map(), tot = set.reduce((t, e) => t + e.rec.b, 0);
  for (const e of set) { const o = by.get(e.z) || { n: 0, sum: 0 }; o.n++; o.sum += e.rec.b; by.set(e.z, o); }
  const rows = [...D.zwecke.map(z => ({ id: z.id, name: z.name, color: z.farbe })), { id: SPJ_FREI, name: 'zweckungebunden', color: null }]
    .map(r => Object.assign(r, by.get(r.id) || { n: 0, sum: 0 }));
  const off = by.get(SPJ_OFFEN), max = Math.max(1, ...rows.map(r => r.sum));
  const row = r => h('tr', { class: 'spj-r' + (SPJ.z === r.id && !print ? ' on' : '') + (r.id === SPJ_FREI ? ' frei' : '') + (r.id === SPJ_OFFEN ? ' offen' : ''), dataset: { z: r.id },
    onclick: print ? null : () => { SPJ.z = SPJ.z === r.id ? null : r.id; SPJ.typed = ''; SPJ.more = 0; SPJ.lv = 'frei'; renderNow(); } },
    h('td', { class: 'spj-nm' }, r.id === SPJ_OFFEN ? '⚠ ' : h('span', { class: 'dot' + (r.color ? '' : ' ring'), style: r.color ? { background: r.color } : null }), r.name),
    h('td', { class: 'num' }, r.n.toLocaleString('de-DE')), h('td', { class: 'num' }, eur0(r.sum)), h('td', { class: 'num' }, spjPct(r.sum, tot)),
    h('td', { class: 'num' }, r.n ? eur(r.sum / r.n) : '–'),
    h('td', { class: 'spj-bc' }, h('span', { class: 'spj-b', style: { width: (r.sum / max * 100).toFixed(1) + '%', background: r.color || 'var(--faint)' } })));
  return h('div', { class: 'spj-box' },
    h('div', { class: 'spj-h' }, h('b', null, 'Spendenzwecke'),
      print ? null : h('span', { class: 'info', tip: 'Ein Zweck zählt automatisch alle Spenden, deren Verwendungszweck zu einem seiner Schlagworte passt oder die auf eines seiner Konten gehen. Was zu keinem Zweck passt, ist zweckungebunden. Passt eine Spende zu mehreren Zwecken, steht sie unter „zu klären“, bis du dich einmal entschieden hast.' }, 'ⓘ'),
      null),
    h('table', { class: 'grid spj-t' },
      h('thead', null, h('tr', null, h('th', null, 'Zweck'), h('th', { class: 'num' }, 'Spenden'), h('th', { class: 'num' }, 'Summe'), h('th', { class: 'num' }, 'Anteil'), h('th', { class: 'num' }, 'Ø-Spende'), h('th'))),
      h('tbody', null, rows.map(row), off ? row({ id: SPJ_OFFEN, name: 'zu klären: passt zu mehreren', n: off.n, sum: off.sum, color: null }) : null),
      h('tfoot', null, h('tr', null, h('td', null, 'Summe'), h('td', { class: 'num' }, set.length.toLocaleString('de-DE')), h('td', { class: 'num' }, eur0(tot)), h('td', { class: 'num' }, tot ? '100 %' : '–'),
        h('td', { class: 'num' }, set.length ? eur(tot / set.length) : '–'), h('td')))),
    !D.zwecke.length && !print ? h('p', { class: 'muted small spj-hint' }, 'Noch keine Zwecke – unten unter „Spendenzwecke zuordnen“ mit „+ Zweck“ anlegen.') : null);
}
function spjGliedTable(set, print) {
  const by = new Map(), tot = set.reduce((t, e) => t + e.rec.b, 0);
  for (const e of set) { const k = e.rec.konto || ''; const o = by.get(k) || { k, n: 0, sum: 0 }; o.n++; o.sum += e.rec.b; by.set(k, o); }
  const rows = [...by.values()].sort((a, b) => b.sum - a.sum), max = Math.max(1, ...rows.map(r => r.sum));
  return h('div', { class: 'spj-box' },
    h('div', { class: 'spj-h' }, h('b', null, 'Gliederungen'), print ? null : h('span', { class: 'info', tip: 'Konto laut Spalte „Personenname“ im Export – also die Gliederung bzw. Geschäftsstelle, auf deren Konto die Spende einging.' }, 'ⓘ')),
    h('div', { class: print ? 'spj-gall' : 'spj-gscroll', 'data-keep-scroll': print ? null : 'spj-g' }, h('table', { class: 'grid spj-t' },
      h('thead', null, h('tr', null, h('th', null, 'Gliederung'), h('th', { class: 'num' }, 'Spenden'), h('th', { class: 'num' }, 'Summe'), h('th', { class: 'num' }, 'Anteil'), h('th'))),
      h('tbody', null, rows.map(r => h('tr', { class: 'spj-r' + (SPJ.g === r.k && !print ? ' on' : ''), dataset: { g: r.k },
        onclick: print ? null : () => { SPJ.g = SPJ.g === r.k ? null : r.k; SPJ.more = 0; renderNow(); } },
        h('td', { class: 'spj-nm' }, spGlied(r.k)), h('td', { class: 'num' }, r.n.toLocaleString('de-DE')), h('td', { class: 'num' }, eur0(r.sum)), h('td', { class: 'num' }, spjPct(r.sum, tot)),
        h('td', { class: 'spj-bc' }, h('span', { class: 'spj-b', style: { width: (r.sum / max * 100).toFixed(1) + '%' } }))))),
      rows.length ? null : h('tfoot', null, h('tr', null, h('td', { colspan: 5, class: 'muted small' }, 'keine Spenden im Filter'))))));
}
// Zweck bearbeiten: Name, Farbe, Schlagworte (wie bei den Maßnahmen, ohne Zeitraum), Konten – Eingabefelder immer links, Einträge rechts daneben
function spjEditor(J, z) {
  let tq = null;
  const add = () => { const w = SPJ.typed.trim(); SPJ.typed = ''; if (w && !z.worte.includes(w)) spjEditZweck(z.id, q => { q.worte.push(w); }, 'Zweck „' + z.name + '“: Schlagwort „' + w + '“'); else renderNow(); };
  const konten = [...new Set(J.list.map(e => e.rec.konto).filter(Boolean))].filter(k => !z.konten.includes(k)).sort((a, b) => spGlied(a).localeCompare(spGlied(b), 'de'));
  const by = spByM(), zm = z.massnahmen || [], mass = C.ms.filter(x => inYear(x, J.y) && !zm.includes(x.id));          // Maßnahmen des Jahres, die noch nicht dabei sind
  const sw = h('button', { class: 'spj-sw', style: { background: z.farbe }, 'aria-label': 'Farbe wählen', tip: 'Farbe wählen', onclick: e => { e.stopPropagation(); colorPicker(sw, z.farbe, c => spjEditZweck(z.id, q => { q.farbe = c; }, 'Zweck „' + z.name + '“: Farbe')); } });
  const i = D.zwecke.findIndex(q => q.id === z.id);
  return h('div', { class: 'spj-ed' },
    h('div', { class: 'spj-er' },
      h('span', { class: 'sp-rl' }, 'Zweck'),
      h('span', { class: 'spj-ein' }, sw, h('input', { class: 'spj-name', value: z.name, 'data-fk': 'spj-name', onchange: e => { const v = e.target.value.trim(); if (v && v !== z.name) spjEditZweck(z.id, q => { q.name = v; }, 'Spendenzweck umbenannt in „' + v + '“'); } })),
      h('span', { class: 'spj-items' },
        h('button', { class: 'icon', disabled: i <= 0, tip: 'in der Liste nach oben', 'aria-label': 'nach oben', onclick: () => spjMoveZweck(z.id, -1) }, '↑'),
        h('button', { class: 'icon', disabled: i >= D.zwecke.length - 1, tip: 'in der Liste nach unten', 'aria-label': 'nach unten', onclick: () => spjMoveZweck(z.id, 1) }, '↓'),
        h('button', { class: 'link danger spj-del', onclick: () => spjDelZweck(z) }, 'Zweck löschen'))),
    h('div', { class: 'spj-er' },
      h('span', { class: 'sp-rl' }, 'Schlagworte', h('span', { class: 'info', tip: () => h('div', null, h('div', { class: 'sp-help-lead' }, 'Spenden, deren Verwendungszweck zu einem Schlagwort passt, zählen für diesen Zweck – das ganze Jahr, auch rückwirkend. Beim Tippen zeigt die Liste unten nur die Spenden, die noch keinem Zweck zugeordnet sind.'), spHelp()) }, ' ⓘ')),
      h('span', { class: 'spj-ein' }, spDelayTip(h('input', { class: 'sp-wordin', value: SPJ.typed, placeholder: z.worte.length ? '+ Schlagwort' : 'Schlagwort, z. B. Hospiz* – Enter', 'data-fk': 'spj-word',
        oninput: e => { SPJ.typed = e.target.value; clearTimeout(tq); tq = setTimeout(renderNow, 200); },
        onkeydown: e => { if (e.key === 'Enter' || e.key === ',' || e.key === ';') { e.preventDefault(); clearTimeout(tq); add(); } else if (e.key === 'Escape') { SPJ.typed = ''; renderNow(); } } }), spHelp)),
      h('span', { class: 'spj-items' }, z.worte.length ? z.worte.map(w => h('span', { class: 'sp-word' }, w, h('button', { class: 'sp-x', 'aria-label': w + ' entfernen', tip: '„' + w + '“ entfernen',
        onclick: () => spjEditZweck(z.id, q => { q.worte = q.worte.filter(x => x !== w); }, 'Zweck „' + z.name + '“: Schlagwort „' + w + '“ entfernt') }, '×'))) : h('span', { class: 'muted small' }, 'noch keine'))),
    h('div', { class: 'spj-er' },
      h('span', { class: 'sp-rl' }, 'Konten', h('span', { class: 'info', tip: 'Alle Spenden auf diese Konten (Gliederungen) zählen für den Zweck – z. B. das Hospizkonto.' }, ' ⓘ')),
      h('span', { class: 'spj-ein' }, h('select', { class: 'spj-konto', disabled: !konten.length, onchange: e => { const k = e.target.value; if (k) spjEditZweck(z.id, q => { q.konten.push(k); }, 'Zweck „' + z.name + '“: Konto ' + spGlied(k)); } },
        h('option', { value: '' }, konten.length ? '+ Konto hinzufügen …' : 'keine weiteren Konten'), konten.map(k => h('option', { value: k }, spGlied(k))))),
      h('span', { class: 'spj-items' }, z.konten.length ? z.konten.map(k => h('span', { class: 'sp-word konto' }, spGlied(k), h('button', { class: 'sp-x', 'aria-label': spGlied(k) + ' entfernen',
        onclick: () => spjEditZweck(z.id, q => { q.konten = q.konten.filter(x => x !== k); }, 'Zweck „' + z.name + '“: Konto entfernt') }, '×'))) : h('span', { class: 'muted small' }, 'keine'))),
    h('div', { class: 'spj-er' },
      h('span', { class: 'sp-rl' }, 'Maßnahmen', h('span', { class: 'info', tip: 'Alle Spenden, die dieser Maßnahme zugeordnet sind (Auswertung → Maßnahme → Spenden zuordnen), zählen für den Zweck – auch die, in deren Verwendungszweck nur eine Spendennummer steht, und auch künftige.' }, ' ⓘ')),
      h('span', { class: 'spj-ein' }, h('select', { class: 'spj-mass', disabled: !mass.length, onchange: e => { const id = e.target.value, x = C.byId.get(id); if (id) spjEditZweck(z.id, q => { q.massnahmen = (q.massnahmen || []).concat(id); }, 'Zweck „' + z.name + '“: alle Spenden der Maßnahme „' + ((x && x.m.name) || '?') + '“'); } },
        h('option', { value: '' }, mass.length ? '+ Maßnahme hinzufügen …' : 'keine weiteren Maßnahmen'), mass.map(x => h('option', { value: x.id }, (x.m.name || '(ohne Namen)') + (by.get(x.id) ? ' (' + by.get(x.id).length + ')' : ''))))),
      h('span', { class: 'spj-items' }, zm.length ? zm.map(id => { const x = C.byId.get(id), n = (by.get(id) || []).length;
        return h('span', { class: 'sp-word mass', style: x ? { borderColor: x.color } : null, tip: n ? spCount(n) + ' zugeordnet' : 'noch keine Spenden zugeordnet' }, x ? h('span', { class: 'dot', style: { background: x.color } }) : null, x ? x.m.name || '(ohne Namen)' : '(Maßnahme fehlt)',
          h('button', { class: 'sp-x', 'aria-label': 'Maßnahme entfernen', onclick: () => spjEditZweck(z.id, q => { q.massnahmen = (q.massnahmen || []).filter(v => v !== id); }, 'Zweck „' + z.name + '“: Maßnahme entfernt') }, '×')); }) :
        h('span', { class: 'muted small' }, 'keine'))));
}
// Bereich „Spendenzwecke zuordnen“: Zweck wählen, Schlagworte und Konten pflegen, Spenden prüfen und festlegen – feste Höhen, damit nichts springt
function spjAssign(y) {
  if (!SP.rows.length) return { body: h('div', { class: 'spj-empty muted' }, 'Sobald Spendendateien eingelesen sind, lassen sich hier Zwecke anlegen und zuordnen.') };
  const J = spjCompute(y), set = J.list, by = new Map();                 // Zählung über alle Spenden – wie die Liste darunter
  for (const e of set) by.set(e.z, (by.get(e.z) || 0) + 1);
  const zSel = SPJ.z != null && SPJ.z !== SPJ_FREI && SPJ.z !== SPJ_OFFEN ? D.zwecke.find(z => z.id === SPJ.z) : null;
  const pill = (id, label, color, cls) => h('button', { class: 'spj-pill' + (SPJ.z === id ? ' on' : '') + (cls ? ' ' + cls : ''), 'aria-pressed': String(SPJ.z === id), dataset: { z: id },
    onclick: () => { SPJ.z = SPJ.z === id ? null : id; SPJ.typed = ''; SPJ.more = 0; SPJ.lv = 'frei'; renderNow(); } },
    color ? h('span', { class: 'dot', style: { background: color } }) : null, label, h('span', { class: 'spj-pn' }, (by.get(id) || 0).toLocaleString('de-DE')));
  return { body: h('div', { class: 'spj-zu' },
    h('div', { class: 'spj-pills' }, D.zwecke.map(z => pill(z.id, z.name, z.farbe)), pill(SPJ_FREI, 'zweckungebunden', null, 'frei'),
      by.get(SPJ_OFFEN) ? pill(SPJ_OFFEN, '⚠ zu klären', null, 'offen') : null,
      h('button', { class: 'spj-add', onclick: spjAddZweck }, '+ Zweck')),
    h('div', { class: 'spj-edwrap' },
      zSel ? spjEditor(J, zSel) : h('div', { class: 'spj-ed none' }, h('span', { class: 'muted' }, D.zwecke.length ? 'Einen Zweck wählen, um seine Schlagworte und Konten zu bearbeiten – oder mit „+ Zweck“ einen neuen anlegen.' :
        'Noch keine Zwecke – mit „+ Zweck“ beginnen, z. B. „Hospizarbeit“ mit dem Schlagwort Hospiz* oder dem Konto der Gliederung.')),
      spjSugPanel(J, zSel)),
    spjList(J)) };
}

/* ---------- Vorschläge: wiederkehrende Begriffe in den Verwendungszwecken der zweckungebundenen Spenden (läuft nur im Browser) */
// Füllwörter und Begriffe ohne Aussage über den Zweck; Wörter aus dem Namen der Spenderin/des Spenders und Adressteile fallen ebenfalls weg
const SPJ_STOP = new Set(('spende spenden spendet gespendet spendenbetrag spend malteser malteserhilfsdienst hilfsdienst diözese dioezese paderborn danke dank dankeschön dankeschoen ' +
  'vielen herzlichen herzliche herzlich gruss gruß grüße gruesse liebe lieben für fuer und oder der die das den dem des ein eine einen einem einer mit von vom zum zur bei ' +
  'aus auf als auch nach sowie wie ihr ihre ihren unsere unser unseren mein meine meinen dein deine sein seine euer eure dies diese dieser dieses ' +
  'dauerauftrag dauerauftragsgutschr dauerauftragsgutschrift gutschrift überweisung ueberweisung sepa lastschrift einzug mandat referenz kundenreferenz ' +
  'verwendungszweck betrag euro monat monatlich monatliche monatlichen jährlich jaehrlich jahr jahres januar februar märz maerz april juni juli august september ' +
  'oktober november dezember spendenquittung spendenbescheinigung zuwendungsbestätigung zuwendungsbestaetigung bescheinigung quittung bitte adresse anschrift ' +
  'strasse straße familie frau herr herrn eheleute').split(' '));
const SPJ_ADDR = /(str|strasse|straße|weg|allee|platz|gasse|ring|damm|ufer)$/;
const SPJ_SUG_MIN = 2;                                               // ab zwei Spenden vorschlagen
const SPJ_CODE_STOP = new Set('eur sepa iban bic nr str ev gmbh ag kg ug ohg im am an zu in um ab bis per pdf de nrw usw ca'.split(' '));   // keine Kürzel
const spjCap = t => t.replace(/(^|\s)\p{L}/gu, c => c.toUpperCase());
let _spjSug = { key: null, val: null };
function spjSuggest(J) {
  const ign = (D.spenden && D.spenden.ignor) || {}, key = _spj.key + '|' + JSON.stringify(ign);
  if (_spjSug.key === key && _spjSug.list === J.list) return _spjSug.val;
  const pool = J.list.filter(e => e.z === SPJ_FREI && !e.hand), amt = new Map(pool.map(e => [e.rec.k, e.rec.b])), words = new Map(), pairs = new Map();
  const add = (mp, t, k) => { let o = mp.get(t); if (!o) mp.set(t, o = { t, keys: new Set() }); o.keys.add(k); };
  const codes = new Map();                                           // Kürzel wie JB, HWK: groß geschrieben, 2–4 Buchstaben (nicht in Texten, die ganz in Großbuchstaben stehen)
  for (const e of pool) {
    const raw = e.rec.zweck || '', own = new Set(spWords(e.rec.name)), toks = spWords(raw), caps = new Set();
    if (!/\p{Lu}{5,}/u.test(raw)) for (const c of raw.match(/(?<![\p{L}\p{N}])\p{Lu}{2,4}(?![\p{L}\p{N}])/gu) || []) { const l = c.toLowerCase(); if (!SPJ_CODE_STOP.has(l) && !SPJ_STOP.has(l)) { caps.add(l); codes.set(l, c); } }
    const ok = toks.map(t => (caps.has(t) || (t.length >= 4 && !/\d/.test(t) && !SPJ_STOP.has(t) && !SPJ_ADDR.test(t))) && !own.has(t));
    toks.forEach((t, i) => { if (!ok[i]) return; add(words, t, e.rec.k); if (ok[i + 1]) add(pairs, t + ' ' + toks[i + 1], e.rec.k); });
  }
  // ähnliche Schreibweisen zusammenfassen (wie die ~-Suche: ab 8 Buchstaben zwei, sonst ein Zeichen Abstand) – Kopf ist die häufigste Form
  const all = [...words.values()].sort((a, b) => b.keys.size - a.keys.size || a.t.localeCompare(b.t)), byFirst = new Map(), used = new Map(), groups = [];
  for (const w of all) { const f = w.t[0]; if (!byFirst.has(f)) byFirst.set(f, []); byFirst.get(f).push(w); }
  all.forEach((w, i) => {
    if (used.has(w.t)) return;
    const g = { label: w.t, keys: new Set(w.keys), vars: [] }; used.set(w.t, g);
    if (w.t.length >= 5 && w.keys.size >= 2 && i < 400) { const max = w.t.length >= 8 ? 2 : 1;          // nur die 400 häufigsten Wörter suchen Varianten (hält es schnell)
      for (const u of byFirst.get(w.t[0])) if (!used.has(u.t) && Math.abs(u.t.length - w.t.length) <= max && spLev(u.t, w.t, max) <= max) { used.set(u.t, g); g.vars.push(u.t); u.keys.forEach(k => g.keys.add(k)); } }
    groups.push(g);
  });
  // gleicher Wortanfang („Trauer“, „Trauerfall“, „Trauerspende“) → eine Regel „Trauer*“ (nicht bei Tippfehler-Gruppen und Kürzeln)
  for (const g of groups.slice().sort((a, b) => a.label.length - b.label.length).slice(0, 800)) {
    if (g.gone || g.vars.length || g.label.length < 5 || codes.has(g.label)) continue;
    const ext = byFirst.get(g.label[0]).filter(u => u.t.length > g.label.length && u.t.startsWith(g.label));
    if (!ext.length) continue;
    for (const u of ext) { u.keys.forEach(k => g.keys.add(k)); g.vars.push(u.t); const o = used.get(u.t); if (o && o !== g && o.label === u.t) o.gone = true; }
    g.prefix = true;
  }
  // Wortpaare, die fast immer zusammen stehen („Herzenswunsch Krankenwagen“), statt der Einzelwörter
  for (const p of [...pairs.values()].sort((a, b) => b.keys.size - a.keys.size)) {
    if (p.keys.size < SPJ_SUG_MIN) break;
    const [a, b] = p.t.split(' '), ga = used.get(a), gb = used.get(b);
    if (!ga || !gb || ga === gb || ga.gone || gb.gone || p.keys.size < 0.8 * Math.max(ga.keys.size, gb.keys.size)) continue;
    ga.gone = gb.gone = true; groups.push({ label: p.t, keys: p.keys, vars: [], phrase: true });
  }
  const list = groups.filter(g => !g.gone && g.keys.size >= SPJ_SUG_MIN && !ign[g.label]).map(g => Object.assign(g, {
    n: g.keys.size, sum: [...g.keys].reduce((t, k) => t + amt.get(k), 0),
    word: codes.has(g.label) && !g.phrase ? codes.get(g.label) : g.prefix ? spjCap(g.label) + '*' : (g.vars.length ? '~' : '') + spjCap(g.label) }))
    .sort((a, b) => b.n - a.n || b.sum - a.sum);
  _spjSug = { key, list: J.list, val: { list, ign: Object.keys(ign).length } };
  return _spjSug.val;
}
function spjIgnore(label, on) {
  commit(d => { const o = Object.assign({}, d.spenden.ignor); if (on) o[label] = 1; else delete o[label]; d.spenden.ignor = o; }, on ? 'Vorschlag „' + spjCap(label) + '“ ausgeblendet' : 'Vorschlag wieder eingeblendet');
}
// Vorschläge rechts neben Zweck, Schlagworten, Konten und Maßnahmen – grau hinterlegt, gleich hoch wie der Bearbeitungsbereich (scrollt innen)
function spjSugPanel(J, zSel) {
  const S = spjSuggest(J), shown = S.list.slice(0, 60);
  const addTo = g => spjEditZweck(zSel.id, q => { if (!q.worte.includes(g.word)) q.worte.push(g.word); }, 'Zweck „' + zSel.name + '“: Schlagwort „' + g.word + '“ (Vorschlag)');
  const newZ = g => {
    const used = new Set(D.zwecke.map(z => z.farbe.toLowerCase())), id = uid(), farbe = (PALETTE.find(p => !used.has(p[1].toLowerCase())) || PALETTE[D.zwecke.length % PALETTE.length])[1];
    const name = g.word.replace(/^~|\*$/g, '');
    SPJ.z = id; SPJ.g = null; SPJ.typed = ''; SPJ.lv = 'frei';
    commit(d => { d.zwecke.push({ id, name, farbe, worte: [g.word], konten: [], massnahmen: [] }); }, 'Spendenzweck „' + name + '“ aus Vorschlag angelegt');
  };
  const rule = g => g.prefix ? 'alle Wörter, die mit „' + spjCap(g.label) + '“ beginnen' : g.vars.length ? 'auch ähnliche Schreibweisen' : 'genau dieses Wort';
  const item = g => h('div', { class: 'spj-sug' + (SPJ.typed === g.word ? ' on' : ''), dataset: { w: g.label, rule: g.word, vars: g.vars.join(',') } },
    h('button', { class: 'spj-sw-l', onclick: () => { SPJ.typed = SPJ.typed === g.word ? '' : g.word; SPJ.more = 0; renderNow(); },
      tip: () => h('div', null, h('b', null, 'Regel „' + g.word + '“'), h('div', null, rule(g) + (g.vars.length ? ': ' + g.vars.slice(0, 8).join(', ') + (g.vars.length > 8 ? ' …' : '') : '')),
        h('div', { class: 'muted small' }, 'Klick: passende Spenden unten als Vorschau zeigen')) }, g.word),
    h('span', { class: 'spj-sug-n muted small' }, g.n + ' · ' + eur0(g.sum)),
    h('span', { class: 'spj-sug-b' },
      zSel ? h('button', { class: 'spj-to', tip: 'Schlagwort „' + g.word + '“ zum Zweck „' + zSel.name + '“ hinzufügen', onclick: () => addTo(g) }, '+ übernehmen') : null,
      h('button', { class: 'spj-to ghost', tip: 'neuen Zweck „' + g.word.replace(/^~|\*$/g, '') + '“ mit dem Schlagwort „' + g.word + '“ anlegen', onclick: () => newZ(g) }, '+ neu'),
      h('button', { class: 'sp-x', 'aria-label': 'Vorschlag ausblenden', tip: 'diesen Vorschlag dauerhaft ausblenden (für alle)', onclick: () => spjIgnore(g.label, true) }, '×')));
  return h('div', { class: 'spj-sugp' }, h('div', { class: 'spj-sugp-in' },
    h('div', { class: 'spj-sugh' }, h('b', null, 'Vorschläge'),
      h('span', { class: 'muted small' }, S.list.length ? S.list.length + (S.list.length === 1 ? ' Begriff' : ' Begriffe') : 'keine'),
      h('span', { class: 'info', tip: 'Wiederkehrende Begriffe in den Verwendungszwecken der zweckungebundenen Spenden (ab ' + SPJ_SUG_MIN + ' Spenden): ähnliche Schreibweisen werden mit „~“ zusammengefasst, gleiche Wortanfänge mit „*“, Kürzel wie JB oder HWK erkannt. Füllwörter, Namen der Spender:innen und Adressteile zählen nicht. „+ übernehmen“ fügt das Schlagwort dem gewählten Zweck hinzu – was ein Zweck erfasst, verschwindet von hier.' }, 'ⓘ'),
      S.ign ? h('button', { class: 'link small spj-sugign', tip: 'ausgeblendete Vorschläge wieder anzeigen', onclick: () => commit(d => { d.spenden.ignor = {}; }, 'Ausgeblendete Vorschläge wieder eingeblendet') }, S.ign + ' ausgeblendet') : null),
    h('div', { class: 'spj-sugs', 'data-keep-scroll': 'spj-sugs' }, shown.length ? shown.map(item) : h('div', { class: 'muted small spj-sug0' }, 'Keine wiederkehrenden Begriffe in den zweckungebundenen Spenden.'))));
}
// Liste unter „Spendenzwecke zuordnen“: standardmäßig alle zweckungebundenen Spenden (beim Tippen nur die mit dem Schlagwort) – was ein Schlagwort
// einem Zweck zuordnet, verschwindet daraus; mit „→ Zweck“ direkt dem gewählten Zweck zuordnen. Umschaltbar auf die Spenden, die schon beim
// gewählten Zweck sind; „zu klären“ über den Knopf oben. Die Filter der Auswertung gelten hier nicht. Die Liste hat immer dieselbe Höhe.
function spjList(J) {
  const typed = SPJ.typed.trim(), zn = id => id === SPJ_FREI ? 'zweckungebunden' : id === SPJ_OFFEN ? 'zu klären' : (D.zwecke.find(z => z.id === id) || {}).name || '?';
  const sumOf = l => l.reduce((t, e) => t + e.rec.b, 0);
  // immer alle Spenden des Jahres – die Filter der Auswertung oben (Herkunft, Gliederung) gelten hier nicht
  const zSel = SPJ.z != null && SPJ.z !== SPJ_FREI && SPJ.z !== SPJ_OFFEN && D.zwecke.some(z => z.id === SPJ.z) ? SPJ.z : null, base = J.list;
  const frei = base.filter(e => e.z === SPJ_FREI);
  let list, title, sub, lv = null;
  if (typed) {
    const f = spjMatcher({ worte: [typed], konten: [] }), hit = base.filter(e => f(e.rec));
    list = hit.filter(e => e.z === SPJ_FREI && !e.hand);                    // nur die, die das Schlagwort tatsächlich zum Zweck holen würde
    title = 'Vorschau „' + typed + '“';
    sub = spCount(list.length) + ' zweckungebunden (' + eur(sumOf(list)) + ')' + (hit.length > list.length ? ' · ' + (hit.length - list.length) + ' weitere schon erfasst' : '') + ' – Enter übernimmt';
  } else {
    if (SPJ.z === SPJ_OFFEN) { list = base.filter(e => e.z === SPJ_OFFEN); title = zn(SPJ.z); }
    else if (zSel && SPJ.lv === 'zweck') { list = base.filter(e => e.z === zSel); lv = 'zweck'; }
    else { list = frei; title = 'Zweckungebunden'; lv = zSel ? 'frei' : null; }      // Standard: alle zweckungebundenen Spenden
    sub = spCount(list.length) + ' · ' + eur(sumOf(list));
  }
  list = list.slice().sort((a, b) => b.rec.d - a.rec.d || b.rec.b - a.rec.b);
  const lim = SPJ_MAX + SPJ.more;
  const zSelect = (e, keys) => h('select', { class: 'spj-zsel', onchange: ev => spjSetZweck(keys, ev.target.value) },
    h('option', { value: '', selected: !e || !e.hand }, e ? (e.hand ? 'automatisch' : 'auto: ' + zn(e.z)) : 'alle angezeigten festlegen …'),
    D.zwecke.map(z => h('option', { value: z.id, selected: !!e && e.hand && e.z === z.id }, z.name)),
    h('option', { value: SPJ_FREI, selected: !!e && e.hand && e.z === SPJ_FREI }, 'zweckungebunden'));
  const row = e => { const r = e.rec;
    return h('div', { class: 'spj-row' + (e.z === SPJ_OFFEN ? ' offen' : '') + (e.hand ? ' hand' : ''), dataset: { k: r.k }, tip: () => spTip(r) },
      h('span', { class: 'sp-d' }, fmtD(r.d)), h('span', { class: 'sp-b' }, eur(r.b)), h('span', { class: 'spj-g' }, spGlied(r.konto)),
      UI.spDet ? h('span', { class: 'sp-n' }, r.name || '') : null, h('span', { class: 'sp-z' }, r.zweck || '–'),
      h('span', { class: 'spj-tags' }, e.da ? h('span', { class: 'sp-tag da' }, 'Dauerauftrag') : null, e.hits.map(t => h('span', { class: 'sp-tag rule', style: { borderColor: (D.zwecke.find(z => z.id === t.id) || {}).farbe }, tip: 'passt zu „' + zn(t.id) + '“ (' + t.w + ')' },
        e.z === SPJ_OFFEN && !e.hand ? h('button', { class: 'spj-pick', tip: 'dem Zweck „' + zn(t.id) + '“ zuordnen', onclick: ev => { ev.stopPropagation(); spjSetZweck([r.k], t.id, 'Spende dem Zweck „' + zn(t.id) + '“ zugeordnet'); } }, '→ ' + zn(t.id)) :
        SPJ.z === t.id ? t.w : zn(t.id))),          // im gewählten Zweck: warum die Spende passt (Schlagwort oder Konto)
        zSel && e.z !== zSel ? h('button', { class: 'spj-to', tip: 'dem Zweck „' + zn(zSel) + '“ zuordnen', onclick: ev => { ev.stopPropagation(); spjSetZweck([r.k], zSel, 'Spende dem Zweck „' + zn(zSel) + '“ zugeordnet'); } }, '→ ' + zn(zSel)) : null),
      zSelect(e, [r.k]));
  };
  return h('div', { class: 'spj-listbox' + (typed ? ' prev' : '') },
    h('div', { class: 'spj-lh' }, lv ? h('span', { class: 'segs spj-lv' },
      h('button', { class: 'seg-btn' + (lv === 'frei' ? ' on' : ''), dataset: { lv: 'frei' }, onclick: () => { SPJ.lv = 'frei'; SPJ.more = 0; renderNow(); } }, 'Zweckungebunden (' + frei.length.toLocaleString('de-DE') + ')'),
      h('button', { class: 'seg-btn' + (lv === 'zweck' ? ' on' : ''), dataset: { lv: 'zweck' }, onclick: () => { SPJ.lv = 'zweck'; SPJ.more = 0; renderNow(); } },
        'Bei „' + zn(zSel) + '“ (' + base.filter(e => e.z === zSel).length.toLocaleString('de-DE') + ')')) : h('b', null, title),
      h('span', { class: 'spj-sub muted small' }, sub),
      typed ? h('button', { class: 'link small spj-prevx', onclick: () => { SPJ.typed = ''; renderNow(); } }, 'Vorschau schließen') : null,
      h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!UI.spDet, onchange: e => { UI.spDet = e.target.checked; renderNow(); } }), 'Namen zeigen'),
      zSelect(null, list.map(e => e.rec.k))),
    h('div', { class: 'spj-list', 'data-keep-scroll': 'spj-list' }, list.slice(0, lim).map(row),
      list.length > lim ? h('button', { class: 'link spj-more', onclick: () => { SPJ.more += 300; renderNow(); } }, '… ' + (list.length - lim).toLocaleString('de-DE') + ' weitere anzeigen') : null,
      !list.length ? h('div', { class: 'sp-empty muted small' }, typed ? 'Keine weiteren Spenden ohne Zweck mit diesem Schlagwort.' : 'Keine Spenden.') : null));
}

/* ---------- Grafiken: Jahresverlauf (kumuliert) und Spenden pro Woche (Einzelspenden / Daueraufträge) */
const MON_S = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
function spjMonths(svg, g, J, X0) {
  for (let m = 0; m < 12; m++) {
    const n = mkdn(J.y, m + 1, 1), x = X0(n - J.a), x2 = X0((m === 11 ? J.b + 1 : mkdn(J.y, m + 2, 1)) - J.a);
    if (m) svg.append(sv('line', { class: 'sp-grid spj-mon', x1: x, x2: x, y1: g.mt, y2: g.mt + g.ph }));
    svg.append(sv('text', { class: 'sp-ax', x: (x + x2) / 2, y: g.mt + g.ph + 16, 'text-anchor': 'middle' }, MON_S[m]));
  }
}
function spjDraw(el) {
  const J = spjCompute(el.dataset.y), set = el.dataset.all ? J.list : spjSet(J), days = J.b - J.a + 1;
  if (!set.length) { el.replaceChildren(h('div', { class: 'muted small spj-none' }, 'Keine Spenden im Filter.')); return; }
  if (el.dataset.chart === 'ycum') {
    const day = new Array(days).fill(0), cnt = new Array(days).fill(0);
    for (const e of set) { day[e.rec.d - J.a] += e.rec.b; cnt[e.rec.d - J.a]++; }
    const cum = []; day.reduce((t, v, i) => (cum[i] = t + v), 0);
    let L = days - 1; while (L > 0 && !cnt[L]) L--;
    const { svg, g } = spFrame(el, 170, 70), X = i => g.ml + (i + 0.5) / days * g.pw, X0 = i => g.ml + i / days * g.pw, y0 = g.mt + g.ph;
    const Y = spYAxis(svg, g, cum[L] / 100);
    spjMonths(svg, g, J, X0);
    const pts = cum.slice(0, L + 1).map((v, i) => X(i).toFixed(1) + ',' + Y(v / 100).toFixed(1));
    svg.append(sv('path', { class: 'sp-area spj-area', d: 'M' + X(0) + ',' + y0 + 'L' + pts.join('L') + 'L' + X(L) + ',' + y0 + 'Z' }),
      sv('polyline', { class: 'sp-line spj-line', points: pts.join(' ') }), sv('circle', { class: 'sp-dot spj-dot', cx: X(L), cy: Y(cum[L] / 100), r: 4.5 }),
      sv('text', { class: 'sp-endl', x: X(L) + 9, y: Y(cum[L] / 100) + 4 }, eur0(cum[L])),
      sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
    spCross(svg, g, {
      at: px => clamp(Math.round((px - g.ml) / g.pw * days - 0.5), 0, L), x: X,
      dots: i => [sv('circle', { class: 'sp-dot spj-dot', cx: X(i), cy: Y(cum[i] / 100), r: 4.5 })],
      tip: i => h('div', null, h('b', null, eur(cum[i])), h('div', { class: 'muted small' }, 'bis ' + fmtW(J.a + i)), cnt[i] ? h('div', null, 'an diesem Tag: ' + eur(day[i]) + ' (' + spCount(cnt[i]) + ')') : null) });
    spjPalMarks(svg, g, J, X);                                     // nach dem Fadenkreuz – liegen obenauf
    return;
  }
  const nb = Math.ceil(days / 7), one = new Array(nb).fill(0), da = new Array(nb).fill(0), n1 = new Array(nb).fill(0), n2 = new Array(nb).fill(0);
  for (const e of set) { const i = Math.floor((e.rec.d - J.a) / 7); if (e.da) { da[i] += e.rec.b; n2[i]++; } else { one[i] += e.rec.b; n1[i]++; } }
  const { svg, g } = spFrame(el, 150, 70), X0 = i => g.ml + i / days * g.pw, y0 = g.mt + g.ph, pw = g.pw / nb, bw = Math.max(2, pw - 3);
  const Y = spYAxis(svg, g, Math.max(...one.map((v, i) => v + da[i])) / 100);
  spjMonths(svg, g, J, X0);
  for (let i = 0; i < nb; i++) {
    const grp = sv('g', { class: 'sp-bin' }), bx = g.ml + i * pw + (pw - bw) / 2, yd = Y(da[i] / 100), yt = Y((da[i] + one[i]) / 100);
    if (da[i]) grp.append(sv('rect', { class: 'spj-b2', x: bx, y: yd, width: bw, height: y0 - yd }));
    if (one[i]) grp.append(sv('rect', { class: 'spj-b1', x: bx, y: yt, width: bw, height: yd - yt }));
    const hit = sv('rect', { class: 'sp-hit', x: g.ml + i * pw, y: g.mt, width: pw, height: g.ph }), a = J.a + i * 7, b = Math.min(J.b, a + 6);
    setTip(hit, () => h('div', null, h('b', null, eur(one[i] + da[i])), h('div', { class: 'muted small' }, fmtS(a) + ' – ' + fmtS(b)),
      h('div', null, 'Einzelspenden: ' + eur(one[i]) + ' (' + n1[i] + ')'), h('div', null, 'Daueraufträge: ' + eur(da[i]) + ' (' + n2[i] + ')')));
    grp.append(hit); svg.append(grp);
  }
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
  spjPalMarks(svg, g, J, i => g.ml + (i + 0.5) / days * g.pw);
}
// PAL der Maßnahmen als Punkte auf der Achse – mit großer Trefferfläche; beim Hinzeigen eine Linie durchs Diagramm
function spjPalMarks(svg, g, J, X) {
  const y0 = g.mt + g.ph, by = spByM();
  for (const x of C.ms.filter(x => x.pal != null && x.pal >= J.a && x.pal <= J.b)) {
    const cx = X(x.pal - J.a), list = by.get(x.id) || [], hit = sv('rect', { class: 'spj-palhit', x: cx - 10, y: y0 - 12, width: 20, height: 24 });
    setTip(hit, () => h('div', null, h('b', null, x.m.name || '(ohne Namen)'), h('div', { class: 'muted small' }, 'PAL ' + fmtW(x.pal)),
      list.length ? h('div', null, 'zugeordnet: ' + eur0(list.reduce((t, z) => t + z.b, 0)) + ' aus ' + spCount(list.length)) : h('div', { class: 'muted small' }, 'noch keine Spenden zugeordnet')));
    svg.append(sv('g', { class: 'spj-palg' }, sv('line', { class: 'spj-palv', x1: cx, x2: cx, y1: g.mt, y2: y0, stroke: x.color }),
      sv('circle', { class: 'spj-palm', cx, cy: y0, r: 5, fill: x.color }), hit));
  }
}
