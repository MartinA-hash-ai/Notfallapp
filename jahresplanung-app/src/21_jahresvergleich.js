/* ===================================================================== Auswertung „Jahresvergleich“ (Teil 1): Kopfzahlen, Jahresverlauf mit Quartalen, Mailings vergleichen */

// Grundlage sind alle eingelesenen Spendendateien (alle Jahre). Hauptjahr = das oben gewählte Jahr; dazu bis zu drei frühere Jahre.
// Zeitraum „bis Stichtag“: jedes Jahr nur bis zu dem Tag, bis zu dem im Hauptjahr Buchungen eingelesen sind – so werden gleich lange Zeiträume verglichen.
// Sondereffekte: je Jahr eine Grenze (dieselbe wie „Ausreißer“ bei „Spenden JJJJ“, D.spenden.grenze) – Spenden darüber zählen nicht mit.
// Spender:innen werden an der IBAN erkannt (ohne IBAN: am Namen). Auswahl der Jahre, Bausteine und Mailings merkt sich jede Person selbst (UI).
const JV = { q: null, cmp: null, hov: null };                     // angeklicktes Quartal (0–3), Vergleichsjahr im Quartalsvergleich
const JV_BLOCKS = [['kpi', 'Kopfzahlen'], ['verlauf', 'Jahresverlauf & Quartale'], ['mail', 'Mailings vergleichen']];
const JV_RAMP = { 1: [4], 2: [2, 4], 3: [1, 3, 4], 4: [1, 2, 3, 4] };   // Jahre: eine Farbe, das Hauptjahr am kräftigsten
const JV_MAX_MAIL = 4, JV_QN = ['Q1', 'Q2', 'Q3', 'Q4'], JV_MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const jvDonor = r => r.iban || (r.name ? 'N:' + r.name.toUpperCase() : 'K:' + r.k);
const jvT = v => v >= 1000000 ? de0(v / 100000) + ' T€' : eur0(v);             // Cent → „305 T€“ bzw. „9.870 €“
const de0 = v => Math.round(v).toLocaleString('de-DE');
const jvShown = k => !(UI.jvHide && UI.jvHide[k]);

// Jahre, Hauptjahr, Stichtag
function jvSetup() {
  const H = UI.year, ys = new Set(); for (const r of SP.rows) ys.add(ymd(r.d)[0]);
  const cand = [...new Set([...ys].filter(y => y <= H).concat(H))].sort((a, b) => a - b).slice(-6);
  const off = new Set(UI.jvOff || []); let sel = cand.filter(y => y === H || !off.has(y)); if (sel.length > 4) sel = sel.slice(-4);
  const a = mkdn(H, 1, 1), b = mkdn(H, 12, 31); let last = null;
  for (const r of SP.rows) if (r.d >= a && r.d <= b && (last == null || r.d > last)) last = r.d;
  const md = last != null ? ymd(last).slice(1) : null, full = !md || (md[0] === 12 && md[1] >= 20);
  const mode = md && (UI.jvZeit === 'stich' || (UI.jvZeit !== 'jahr' && !full)) ? 'stich' : 'jahr';
  const col = y => 'var(--jv' + JV_RAMP[sel.length][sel.indexOf(y)] + ')';
  return { H, cand, sel, last, md, mode, col, all: ys };
}
// Zahlen je Jahr (gecacht): Spenden im Zeitraum ohne Sondereffekte
let _jv = { key: null, val: null };
function jvData(S) {
  const key = SP.sig + '|' + SP.rows.length + '|' + JSON.stringify(D.spenden.grenze || {}) + '|' + S.sel.join() + '|' + S.mode + '|' + (S.md || []).join('.');
  if (_jv.key === key && _jv.rows === SP.rows) return _jv.val;
  const byY = new Map(); for (const r of SP.rows) { const y = ymd(r.d)[0]; if (!byY.has(y)) byY.set(y, []); byY.get(y).push(r); }
  const inZ = r => { if (S.mode !== 'stich') return true; const [, m, d] = ymd(r.d); return m < S.md[0] || (m === S.md[0] && d <= S.md[1]); };
  const ys = [...byY.keys()].sort((a, b) => a - b), Y = new Map();
  for (const y of S.sel) {
    const g = spjGrenze(y), all = byY.get(y) || [], rows = all.filter(r => (g == null || r.b <= g) && inZ(r)), noOut = all.filter(r => g == null || r.b <= g);
    const don = new Set(), da = new Set(); let sum = 0;
    for (const r of rows) { sum += r.b; const k = jvDonor(r); don.add(k); if (spIsDA(r)) da.add(k); }
    let neu = null;                                                  // neu = vorher (in allen früheren Jahren mit Daten) nicht dabei – nur, wenn es das Vorjahr gibt
    if (byY.has(y - 1)) { const old = new Set(); for (const yy of ys) if (yy < y) for (const r of byY.get(yy)) old.add(jvDonor(r)); neu = 0; for (const k of don) if (!old.has(k)) neu++; }
    Y.set(y, { y, rows, noOut, sum, n: rows.length, don: don.size, avg: don.size ? sum / don.size : null, neu, dauer: da.size, has: all.length > 0 });
  }
  _jv = { key, rows: SP.rows, val: Y };
  return Y;
}
// Säulen je Jahr: oben die Zahl, darunter Pfeil (grün/rot) und Veränderung zum Vorjahr, dann die Säule, unten das Jahr
function jvLadder(S, vals, fmt) {
  const n = vals.length, w = 380, bh = 54, top = 36, hgt = top + bh + 20, bw = Math.min(64, (w - (n - 1) * 26) / n), gap = n > 1 ? (w - n * bw) / (n - 1) : 0, x0 = n === 1 ? (w - bw) / 2 : 0;
  const mx = Math.max(1, ...vals.filter(v => v != null)) * 1.02, s = sv('svg', { viewBox: '0 0 ' + w + ' ' + hgt, class: 'jv-lad', role: 'img' });
  vals.forEach((v, i) => { const x = x0 + i * (bw + gap), cx = x + bw / 2, y = S.sel[i];
    s.append(sv('text', { x: cx, y: 12, 'text-anchor': 'middle', class: 'jv-lv' }, v == null ? '–' : fmt(v)));
    const p = i ? vals[i - 1] : null;
    if (v != null && p) { const d = (v / p - 1) * 100, up = d >= 0.05, dn = d <= -0.05;
      s.append(sv('text', { x: cx, y: 27, 'text-anchor': 'middle', class: 'jv-ld' }, sv('tspan', { class: up ? 'jv-up' : dn ? 'jv-dn' : 'jv-eq' }, up ? '▲ ' : dn ? '▼ ' : '■ '),
        (up ? '+' : dn ? '−' : '±') + num1(Math.abs(d) < 0.05 ? 0 : Math.abs(d)) + ' %')); }
    if (v != null) { const hh = Math.max(2, v / mx * bh); s.append(sv('rect', { x, y: top + bh - hh, width: bw, height: hh, rx: 3, fill: S.col(y) })); }
    s.append(sv('text', { x: cx, y: top + bh + 15, 'text-anchor': 'middle', class: 'sp-ax jv-ly' }, y + (y === S.H && S.mode === 'stich' ? '*' : ''))); });
  return s;
}
function jvBlock(k, title, ...kids) {
  return h('div', { class: 'jv-blk', dataset: { jv: k } }, h('div', { class: 'jv-bh' }, h('h3', null, title),
    h('button', { class: 'link small jv-hide', tip: 'Baustein ausblenden – über „Bausteine“ wieder einblenden', onclick: () => { UI.jvHide = Object.assign({}, UI.jvHide, { [k]: true }); renderNow(); } }, 'ausblenden')), ...kids);
}
const jvStich = S => S.md ? p2(S.md[1]) + '.' + p2(S.md[0]) + '.' : '';

/* ---------- Leiste: Jahre, Hauptjahr, Zeitraum, Bausteine; darunter Sondereffekte je Jahr */
function jvBar(S, Y) {
  const chip = y => { const on = S.sel.includes(y), main = y === S.H;
    return h('button', { class: 'chip jv-y' + (on ? '' : ' off'), 'aria-pressed': String(on), disabled: main || null, tip: main ? 'Hauptjahr – oben im Kopf oder rechts wählen' : on ? y + ' aus dem Vergleich nehmen' : y + ' dazunehmen',
      onclick: () => { const off = new Set(UI.jvOff || []); if (on) off.add(y); else { if (S.sel.length >= 4) { toast('Höchstens vier Jahre – erst ein anderes Jahr abwählen.'); return; } off.delete(y); } UI.jvOff = [...off]; renderNow(); } },
      h('span', { class: 'dot', style: { background: on ? S.col(y) : 'var(--line2)' } }), y); };
  const blocks = () => h('div', null, h('div', { class: 'menu-head' }, 'Bausteine zeigen'),
    JV_BLOCKS.map(([k, t]) => h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: jvShown(k), onchange: e => { UI.jvHide = Object.assign({}, UI.jvHide, { [k]: !e.target.checked }); renderNow(); } }), t)),
    h('p', { class: 'muted small', style: { margin: '6px 4px 0' } }, 'Weitere Bausteine und das PDF für die Präsentation kommen mit dem nächsten Update.'));
  let bb = null;
  bb = h('button', { class: 'jv-bbtn', onclick: e => { e.stopPropagation(); popover(bb, blocks()); } }, 'Bausteine ▾');
  const zeit = h('select', { class: 'jv-zeit', 'aria-label': 'Zeitraum', onchange: e => { UI.jvZeit = e.target.value; renderNow(); } },
    S.md ? h('option', { value: 'stich', selected: S.mode === 'stich' }, 'bis Stichtag ' + jvStich(S) + ' (letzte Buchung ' + S.H + ')') : null,
    h('option', { value: 'jahr', selected: S.mode === 'jahr' }, 'ganzes Jahr'));
  const hj = h('select', { class: 'jv-hj', 'aria-label': 'Hauptjahr', onchange: e => { UI.year = +e.target.value; renderNow(); } },
    [...new Set([...S.all].concat(S.H))].sort((a, b) => b - a).map(y => h('option', { value: y, selected: y === S.H }, y)));
  const grenze = y => { const g = spjGrenze(y), aus = spjOut(spjCompute(y));
    const inp = h('input', { class: 'jv-gr', value: g ? (g / 100).toLocaleString('de-DE') : '', placeholder: '–', inputmode: 'decimal', 'aria-label': 'Sondereffekte ' + y + ': Spenden über diesem Betrag ausblenden', 'data-fk': 'jv-gr:' + y,
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
      onchange: e => { const v = e.target.value.trim(), c = v ? spCents(v) : null; if (v && !(c > 0)) { e.target.value = g ? (g / 100).toLocaleString('de-DE') : ''; toast('Bitte einen Betrag eingeben, z. B. 10.000'); return; } spjSetGrenze(y, c ? Math.round(c) : null); } });
    return h('span', { class: 'jv-sx' }, h('span', { class: 'dot', style: { background: S.col(y) } }), h('b', null, y), h('span', { class: 'muted' }, 'über'), inp, h('span', { class: 'muted' }, '€'),
      aus.length ? h('span', { class: 'jv-aus', tip: () => h('div', null, h('b', null, spCount(aus.length) + ' ausgeblendet'), aus.slice(0, 10).map(e => h('div', { class: 'small' }, fmtD(e.rec.d) + ' · ' + eur(e.rec.b) + (e.rec.zweck ? ' · ' + e.rec.zweck : '')))) },
        aus.length + ' · ' + eur0(aus.reduce((t, e) => t + e.rec.b, 0))) : null); };
  return h('div', { class: 'jv-bar' },
    h('div', { class: 'jv-row' }, h('span', { class: 'spj-lbl' }, 'Jahre'), S.cand.map(chip),
      h('span', { class: 'spj-lbl jv-gap' }, 'Hauptjahr'), hj, h('span', { class: 'spj-lbl jv-gap' }, 'Zeitraum'), zeit, h('span', { class: 'jv-right' }, bb)),
    h('div', { class: 'jv-row' }, h('span', { class: 'spj-lbl', tip: 'Große Einzelfälle wie Erbschaften: Spenden über der Grenze zählen im Vergleich (und bei „Spenden JJJJ“) nicht mit – je Jahr, gilt für alle, die die Planung öffnen.' }, 'Sondereffekte ausblenden'),
      S.sel.slice().reverse().map(grenze)));
}

/* ---------- Kopfzahlen */
function jvKpis(S, Y) {
  const tile = (t, get, fmt, big, tip) => { const vals = S.sel.map(y => { const o = Y.get(y); return o && o.has ? get(o) : null; }), v = vals[vals.length - 1];
    return h('div', { class: 'jv-kpi', tip: tip || null }, h('div', { class: 'jv-kt' }, t), h('div', { class: 'jv-kv' }, v == null ? '–' : big(v)), jvLadder(S, vals, fmt)); };
  const int = v => de0(v);
  return h('div', { class: 'jv-kpis' },
    tile('Spendensumme', o => o.sum, jvT, eur0),
    tile('Spender:innen', o => o.don, int, int, 'gezählt nach IBAN (ohne IBAN: Name)'),
    tile('Ø je Spender:in', o => o.avg, v => eur0(v), v => eur(v), 'Spendensumme geteilt durch die Zahl der Spender:innen'),
    tile('Spenden', o => o.n, int, int),
    tile('Neue Spender:innen', o => o.neu, int, int, 'in keinem früheren Jahr mit eingelesenen Daten dabei – im ersten Jahr mit Daten nicht bestimmbar (–)'),
    tile('Dauerspender:innen', o => o.dauer, int, int, 'mindestens eine Buchung mit „Dauerauftrag“ im Buchungstext'));
}

/* ---------- Jahresverlauf mit Quartalen; Klick auf ein Quartal öffnet den Quartalsvergleich darunter */
const jvQOf = (y, d) => Math.floor((ymd(d)[1] - 1) / 3);
function jvQuarter(S, Y) {
  const q = JV.q; if (q == null) return null;
  const others = S.sel.filter(y => y !== S.H), cmp = others.includes(JV.cmp) ? JV.cmp : others[others.length - 1];
  const qs = (y, qq) => ((Y.get(y) || {}).rows || []).filter(r => jvQOf(y, r.d) === qq).reduce((t, r) => t + r.b, 0);
  const cur = qs(S.H, q), prev = cmp != null ? qs(cmp, q) : null, d = prev ? (cur / prev - 1) * 100 : null;
  const fullCmp = cmp != null ? ((Y.get(cmp) || {}).noOut || []) : [], fullQ = fullCmp.filter(r => jvQOf(cmp, r.d) === q).reduce((t, r) => t + r.b, 0), fullSum = fullCmp.reduce((t, r) => t + r.b, 0);
  const nQ = ((Y.get(S.H) || {}).rows || []).filter(r => jvQOf(S.H, r.d) === q);
  const delta = d == null ? null : h('span', { class: 'delta ' + (d >= 0.05 ? 'up' : d <= -0.05 ? 'down' : 'eq') }, (d >= 0.05 ? '▲ +' : d <= -0.05 ? '▼ −' : '■ ±') + num1(Math.abs(d)) + ' %');
  return h('div', { class: 'jv-qp' },
    h('div', { class: 'jv-qh' }, h('b', null, JV_QN[q] + ' im Vergleich'), S.mode === 'stich' ? h('span', { class: 'muted small' }, 'jedes Jahr bis ' + jvStich(S)) : null,
      others.length ? [h('span', { class: 'muted small jv-gap' }, 'verglichen mit'), h('select', { class: 'jv-cmp', onchange: e => { JV.cmp = +e.target.value; renderNow(); } }, others.slice().reverse().map(y => h('option', { value: y, selected: y === cmp }, y)))] : null,
      h('button', { class: 'link small jv-qx', onclick: () => { JV.q = null; renderNow(); } }, '× schließen')),
    h('div', { class: 'jv-qg' },
      h('div', null, h('div', { class: 'jv-st' }, 'Alle Quartale – ' + JV_QN[q] + ' hervorgehoben'), h('div', { class: 'sp-chart', style: { height: '190px' }, dataset: { chart: 'jvqa' } })),
      h('div', null, h('div', { class: 'jv-st' }, JV_QN[q] + ' nach Monaten'), h('div', { class: 'sp-chart', style: { height: '190px' }, dataset: { chart: 'jvqm' } })),
      h('div', { class: 'jv-qt' },
        h('div', { class: 'jv-tile' }, h('div', { class: 'muted small' }, JV_QN[q] + ' ' + S.H), h('div', { class: 'jv-tv' }, eur0(cur)), delta ? [delta, h('span', { class: 'muted small' }, ' ggü. ' + JV_QN[q] + ' ' + cmp)] : null),
        cmp != null ? h('div', { class: 'jv-tile' }, h('div', { class: 'muted small' }, 'Anteil ' + JV_QN[q] + ' am ganzen Jahr ' + cmp), h('div', { class: 'jv-tv' }, fullSum ? Math.round(fullQ / fullSum * 100) + ' %' : '–'),
          h('div', { class: 'jv-meter' }, h('span', { style: { width: (fullSum ? fullQ / fullSum * 100 : 0).toFixed(1) + '%', background: S.col(cmp) } }))) : null,
        h('div', { class: 'jv-tile' }, h('div', { class: 'muted small' }, 'Spenden in ' + JV_QN[q] + ' ' + S.H), h('div', { class: 'jv-tv' }, de0(nQ.length)), h('div', { class: 'muted small' }, nQ.length ? 'Ø ' + eur(cur / nQ.length) : '')))));
}

/* ---------- Mailings vergleichen: bis zu vier beliebige Maßnahmen (Farbe bleibt am Eintrag) */
function jvMailList() {
  let L = Array.isArray(UI.jvMail) ? UI.jvMail.filter(e => e && (e.id === '' || C.byId.has(e.id))) : null;
  if (!L) {                                                        // beim ersten Mal: die zwei jüngsten Maßnahmen mit Spenden
    const by = spByM(), ms = C.ms.filter(x => x.pal != null && (by.get(x.id) || []).length).sort((a, b) => b.pal - a.pal).slice(0, 2);
    L = ms.map((x, i) => ({ id: x.id, c: i }));
  }
  return L;
}
const jvMailSet = L => { UI.jvMail = L.map(e => ({ id: e.id, c: e.c })); renderNow(); };
function jvMailStats(id) {
  const x = C.byId.get(id), list = spByM().get(id) || []; if (!x) return null;
  const s = spStats(x.m, list), sr = list.length ? spSeries(x.m, list) : null, tot = sr ? sr.cum[sr.cum.length - 1] : 0;
  let t80 = null; if (sr && tot > 0) { const i = sr.cum.findIndex(v => v >= tot * 0.8); t80 = i >= 0 ? i : null; }
  return { x, s, sr, t80 };
}
function jvMails(S) {
  const L = jvMailList(), by = spByM();
  const opts = C.ms.filter(x => x.pal != null).sort((a, b) => b.pal - a.pal), years = [...new Set(opts.map(x => ymd(x.pal)[0]))];
  const row = (e, i) => h('div', { class: 'jv-mrow' }, h('span', { class: 'dot', style: { background: 'var(--jvm' + (e.c + 1) + ')' } }),
    h('select', { class: 'jv-msel', 'aria-label': 'Mailing ' + (i + 1), onchange: ev => { const nl = L.slice(); nl[i] = { id: ev.target.value, c: e.c }; jvMailSet(nl); } },
      h('option', { value: '', selected: !e.id, disabled: true }, 'Mailing wählen …'),
      years.map(y => h('optgroup', { label: String(y) }, opts.filter(x => ymd(x.pal)[0] === y).map(x => h('option', { value: x.id, selected: x.id === e.id }, (x.m.name || '(ohne Namen)') + ' · PAL ' + fmtS(x.pal) + ((by.get(x.id) || []).length ? '' : ' (noch keine Spenden)')))))),
    h('button', { class: 'sp-x', 'aria-label': 'entfernen', tip: 'aus dem Vergleich nehmen', onclick: () => jvMailSet(L.filter((_, j) => j !== i)) }, '×'));
  const free = () => [0, 1, 2, 3].find(c => !L.some(e => e.c === c));
  const st = L.filter(e => e.id).map(e => Object.assign({ c: e.c }, jvMailStats(e.id))).filter(o => o.x);
  const bars = (t, get, fmt) => { const vals = st.map(get), mx = Math.max(0, ...vals.filter(v => v != null));
    return h('div', { class: 'jv-kb' }, h('div', { class: 'jv-st' }, t), st.map((o, i) => h('div', { class: 'jv-kbr', tip: (o.x.m.name || '') + ': ' + (vals[i] == null ? '–' : fmt(vals[i])) },
      h('span', { class: 'jv-kbb', style: { width: (vals[i] && mx ? Math.max(3, vals[i] / mx * 90) : 0) + 'px', background: 'var(--jvm' + (o.c + 1) + ')' } }), h('span', null, vals[i] == null ? '–' : fmt(vals[i]))))); };
  return h('div', { class: 'jv-mail' },
    h('div', { class: 'jv-ml' }, L.map(row), L.length < JV_MAX_MAIL ? h('button', { class: 'jv-madd', onclick: () => jvMailSet(L.concat({ id: '', c: free() })) }, '+ Mailing hinzufügen') : null,
      !L.length ? h('p', { class: 'muted small' }, 'Mailings auswählen, um ihren Rücklauf zu vergleichen – egal aus welchem Jahr.') : null),
    h('div', null, h('div', { class: 'jv-st' }, 'Rücklauf kumuliert ab PAL'),
      st.length ? h('div', { class: 'sp-chart', style: { height: '230px' }, dataset: { chart: 'jvmail' } }) : h('p', { class: 'muted small' }, 'Noch kein Mailing mit zugeordneten Spenden gewählt.'),
      st.length ? h('div', { class: 'jv-kbs' }, bars('Erlös', o => o.s.sum || null, eur0), bars('Response', o => o.s.resp, v => num1(v) + ' %'), bars('Ø-Spende', o => o.s.avg, eur),
        bars('ROI', o => o.s.roi, v => num1(v)), bars('Tage bis 80 % da', o => o.t80, v => v + (v === 1 ? ' Tag' : ' Tage'))) : null));
}

/* ---------- Ansicht */
function jvView() {
  if (!SP.rows.length) return h('div', { class: 'spj-empty muted' }, ST.conn !== 'ok' ? 'Mailing-Ordner nicht verbunden – der Jahresvergleich rechnet mit den eingelesenen Spendendateien.' : 'Noch keine Buchungen eingelesen.');
  const S = jvSetup(), Y = jvData(S), hidden = JV_BLOCKS.filter(([k]) => !jvShown(k));
  return h('div', { class: 'jv' }, jvBar(S, Y),
    jvShown('kpi') ? jvBlock('kpi', 'Kopfzahlen', jvKpis(S, Y), S.mode === 'stich' ? h('p', { class: 'muted small jv-foot' }, '* ' + S.H + ' bis Stichtag – alle Jahre bis zum ' + jvStich(S) + ' verglichen') : null) : null,
    jvShown('verlauf') ? jvBlock('verlauf', 'Jahresverlauf & Quartale',
      h('div', { class: 'sp-legend jv-leg' }, S.sel.map(y => h('span', null, h('span', { class: 'jv-ln', style: { background: S.col(y) } }), y)), h('span', { class: 'muted' }, '· Klick auf ein Quartal vergleicht es darunter')),
      h('div', { class: 'sp-chart', style: { height: '250px' }, dataset: { chart: 'jvcum' } }), jvQuarter(S, Y)) : null,
    jvShown('mail') ? jvBlock('mail', 'Mailings vergleichen', jvMails(S)) : null,
    hidden.length ? h('p', { class: 'muted small' }, 'Ausgeblendet: ' + hidden.map(b => b[1]).join(', ') + ' – über „Bausteine“ wieder einblenden.') : null);
}
function jvSummary() {
  if (!SP.rows.length) return null;
  const S = jvSetup(), o = jvData(S).get(S.H);
  return S.H + (S.mode === 'stich' ? ' bis ' + jvStich(S) : '') + ': ' + (o ? eur0(o.sum) + ' aus ' + spCount(o.n) : '–') + ' · Vergleich mit ' + (S.sel.length - 1) + (S.sel.length === 2 ? ' Jahr' : ' Jahren');
}

/* ---------- Grafiken */
function jvDraw(el) {
  const S = jvSetup(), Y = jvData(S), kind = el.dataset.chart;
  if (kind === 'jvcum') return jvDrawCum(el, S, Y);
  if (kind === 'jvqa' || kind === 'jvqm') return jvDrawQ(el, S, Y, kind);
  if (kind === 'jvmail') return jvDrawMail(el);
}
// Jahresverlauf: Summe kumuliert über das Jahr, Jahre übereinander; Quartale als Felder (Zeigen hebt hervor, Klick vergleicht)
function jvDrawCum(el, S, Y) {
  const { svg, g } = spFrame(el, 250, 70), ser = [];
  g.mr = 112; g.pw = g.W - g.ml - g.mr;                               // rechts Platz für „2026 · 111 T€“
  for (const y of S.sel) {
    const o = Y.get(y); if (!o) continue;
    const a = mkdn(y, 1, 1), len = mkdn(y, 12, 31) - a + 1, day = new Array(len).fill(0); let L = -1;
    for (const r of o.noOut) { const i = r.d - a; day[i] += r.b; if (i > L) L = i; }
    if (L < 0) continue;
    const cum = []; day.reduce((t, v, i) => (cum[i] = t + v), 0);
    ser.push({ y, len, cum, L });
  }
  if (!ser.length) { el.replaceChildren(h('div', { class: 'muted small spj-none' }, 'Keine Spenden in den gewählten Jahren.')); return; }
  const fx = (i, len) => g.ml + (i + 0.5) / len * g.pw, mx = Math.max(...ser.map(s => s.cum[s.L])), Yv = spYAxis(svg, g, mx / 100), y0 = g.mt + g.ph;
  const qx = q => g.ml + [0, 90, 181, 273, 365][q] / 365 * g.pw;
  const bands = [0, 1, 2, 3].map(q => { const r = sv('rect', { class: 'jv-qband' + (JV.q === q ? ' on' : ''), x: qx(q), y: g.mt, width: qx(q + 1) - qx(q), height: g.ph, rx: 4 }); svg.append(r); return r; });
  [0, 1, 2, 3].forEach(q => svg.append(sv('text', { class: 'sp-ax jv-qlab' + (JV.q === q ? ' on' : ''), x: (qx(q) + qx(q + 1)) / 2, y: g.mt - 5, 'text-anchor': 'middle' }, JV_QN[q] + (JV.q === q ? ' ✓' : ''))));
  for (let m = 0; m < 12; m++) svg.append(sv('text', { class: 'sp-ax', x: g.ml + (mkdn(2001, m + 1, 15) - mkdn(2001, 1, 1)) / 365 * g.pw, y: y0 + 16, 'text-anchor': 'middle' }, JV_MON[m]));
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
  if (S.mode === 'stich') { const sd = mkdn(2001, S.md[0], Math.min(S.md[1], 28)) - mkdn(2001, 1, 1), x = fx(sd, 365);
    svg.append(sv('line', { class: 'jv-stich', x1: x, x2: x, y1: g.mt, y2: y0 }), sv('text', { class: 'jv-stx', x: x + 4, y: g.mt + 11 }, 'Stichtag ' + jvStich(S))); }
  const labs = [];
  for (const s of ser) {
    const pts = []; for (let i = 0; i <= s.L; i++) pts.push(fx(i, s.len).toFixed(1) + ',' + Yv(s.cum[i] / 100).toFixed(1));
    svg.append(sv('polyline', { class: 'jv-line', points: pts.join(' '), stroke: S.col(s.y), 'stroke-width': s.y === S.H ? 3 : 2 }));
    svg.append(sv('circle', { cx: fx(s.L, s.len), cy: Yv(s.cum[s.L] / 100), r: 4, fill: S.col(s.y), class: 'jv-end' }));
    labs.push({ s, y: Yv(s.cum[s.L] / 100), x: fx(s.L, s.len) });
  }
  labs.sort((a, b) => a.y - b.y); for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
  for (const l of labs) svg.append(sv('text', { class: 'jv-elab', x: l.x + 8, y: l.y + 4 }, l.s.y + ' · ' + jvT(l.s.cum[l.s.L])));
  // Zeigen: Linie + Werte aller Jahre; Quartal darunter hervorheben; Klick: Quartal vergleichen
  const line = sv('line', { class: 'sp-xh', y1: g.mt, y2: y0, visibility: 'hidden' }), ov = sv('rect', { class: 'sp-ov click', x: g.ml, y: g.mt, width: g.pw, height: g.ph });
  svg.append(line, ov);
  const at = ev => clamp(Math.floor((ev.clientX - svg.getBoundingClientRect().left - g.ml) / g.pw * 365), 0, 364);
  ov.addEventListener('mousemove', ev => { const i = at(ev), x = fx(i, 365), q = i < 90 ? 0 : i < 181 ? 1 : i < 273 ? 2 : 3;
    line.setAttribute('x1', x); line.setAttribute('x2', x); line.setAttribute('visibility', 'visible');
    bands.forEach((b, k) => b.classList.toggle('hov', k === q));
    const d = mkdn(2001, 1, 1) + i, [, m, t] = ymd(d);
    tipEl.replaceChildren(h('div', null, h('b', null, 'bis ' + p2(t) + '.' + p2(m) + '.'), ser.slice().reverse().map(s => { const j = Math.min(i, s.L); return h('div', { class: 'jv-tipr' }, h('span', { class: 'jv-ln', style: { background: S.col(s.y) } }), s.y + ': ' + eur0(s.cum[j]) + (i > s.L ? ' (Stand ' + fmtS(mkdn(s.y, 1, 1) + s.L) + ')' : '')); }),
      h('div', { class: 'muted small' }, 'Klick: ' + JV_QN[q] + (JV.q === q ? ' schließen' : ' vergleichen'))));
    tipEl.classList.add('on'); placeTip(ev); });
  ov.addEventListener('mouseleave', () => { line.setAttribute('visibility', 'hidden'); bands.forEach(b => b.classList.remove('hov')); hideTip(); });
  ov.addEventListener('click', ev => { const i = at(ev), q = i < 90 ? 0 : i < 181 ? 1 : i < 273 ? 2 : 3; JV.q = JV.q === q ? null : q; hideTip(); renderNow(); });
}
// Quartalsvergleich: alle Quartale (das gewählte kräftig) bzw. das gewählte nach Monaten – Säulen je Jahr nebeneinander
function jvDrawQ(el, S, Y, kind) {
  const q = JV.q, groups = kind === 'jvqa' ? [0, 1, 2, 3] : [q * 3, q * 3 + 1, q * 3 + 2];
  const val = (y, gi) => ((Y.get(y) || {}).rows || []).reduce((t, r) => { const m = ymd(r.d)[1] - 1; return t + ((kind === 'jvqa' ? Math.floor(m / 3) : m) === gi ? r.b : 0); }, 0);
  const vals = groups.map(gi => S.sel.map(y => val(y, gi))), mx = Math.max(1, ...vals.flat());
  const { svg, g } = spFrame(el, 190, 62); g.mr = 8; g.pw = g.W - g.ml - g.mr;
  const Yv = spYAxis(svg, g, mx / 100), y0 = g.mt + g.ph, gw = g.pw / groups.length, n = S.sel.length, bw = Math.min(26, (gw - 16) / n - 3);
  groups.forEach((gi, k) => { const hi = kind === 'jvqm' || gi === q, x0 = g.ml + k * gw + (gw - n * (bw + 3) + 3) / 2;
    S.sel.forEach((y, j) => { const v = vals[k][j], yy = Yv(v / 100), r = sv('rect', { x: x0 + j * (bw + 3), y: yy, width: bw, height: Math.max(0.5, y0 - yy), rx: 3, fill: S.col(y), opacity: hi ? 1 : 0.35, class: 'jv-bar' });
      setTip(r, () => h('div', null, h('b', null, (kind === 'jvqa' ? JV_QN[gi] : JV_MON[gi]) + ' ' + y), h('div', null, eur0(v)))); svg.append(r); });
    svg.append(sv('text', { class: 'sp-ax' + (kind === 'jvqa' && gi === q ? ' jv-qlab on' : ''), x: g.ml + k * gw + gw / 2, y: y0 + 16, 'text-anchor': 'middle' }, kind === 'jvqa' ? JV_QN[gi] : JV_MON[gi])); });
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
}
// Mailings: Rücklauf kumuliert ab PAL
function jvDrawMail(el) {
  const L = jvMailList().filter(e => e.id), st = L.map(e => Object.assign({ c: e.c }, jvMailStats(e.id))).filter(o => o.x && o.sr);
  if (!st.length) return;
  const days = clamp(Math.max(...st.map(o => o.sr.last)), 30, 180), { svg, g } = spFrame(el, 230, 70);
  g.mr = 175; g.pw = g.W - g.ml - g.mr;
  const mx = Math.max(...st.map(o => o.sr.cum[Math.min(days, o.sr.cum.length - 1)])), Yv = spYAxis(svg, g, mx / 100), y0 = g.mt + g.ph, X = d => g.ml + d / days * g.pw;
  const step = days > 120 ? 30 : days > 60 ? 15 : 10;
  for (let d = 0; d <= days; d += step) svg.append(sv('text', { class: 'sp-ax', x: X(d), y: y0 + 16, 'text-anchor': 'middle' }, d ? '+' + d + ' Tage' : 'PAL'));
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
  const labs = [];
  for (const o of st) { const last = Math.min(days, o.sr.cum.length - 1), pts = [];
    for (let d = 0; d <= last; d++) pts.push(X(d).toFixed(1) + ',' + Yv(o.sr.cum[d] / 100).toFixed(1));
    svg.append(sv('polyline', { class: 'jv-line', points: pts.join(' '), stroke: 'var(--jvm' + (o.c + 1) + ')', 'stroke-width': 2.2 }));
    labs.push({ o, x: X(last), y: Yv(o.sr.cum[last] / 100) }); }
  labs.sort((a, b) => a.y - b.y); for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
  for (const l of labs) svg.append(sv('text', { class: 'jv-elab', x: g.ml + g.pw + 8, y: l.y + 4 }, (l.o.x.m.name || '?').replace(/\s*\d{4}$/, '').slice(0, 22) + ' ’' + String(ymd(l.o.x.pal)[0]).slice(2)));
  spCross(svg, g, { at: px => clamp(Math.round((px - g.ml) / g.pw * days), 0, days), x: X,
    dots: d => st.map(o => sv('circle', { cx: X(d), cy: Yv(o.sr.cum[Math.min(d, o.sr.cum.length - 1)] / 100), r: 4, fill: 'var(--jvm' + (o.c + 1) + ')', stroke: 'var(--card)', 'stroke-width': 2 })),
    tip: d => h('div', null, h('b', null, d ? d + ' Tage nach dem PAL' : 'am PAL'), st.map(o => h('div', { class: 'jv-tipr' }, h('span', { class: 'jv-ln', style: { background: 'var(--jvm' + (o.c + 1) + ')' } }), (o.x.m.name || '?') + ': ' + eur0(o.sr.cum[Math.min(d, o.sr.cum.length - 1)])))) });
}
