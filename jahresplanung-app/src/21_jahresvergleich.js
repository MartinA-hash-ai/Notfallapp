/* ===================================================================== Auswertung „Jahresvergleich“: Kennzahlen, Jahresverlauf mit Quartalen, Mailings, Spendersegmente, Zwecke, Konten, Dauerspender:innen */

// Grundlage sind alle eingelesenen Spendendateien (alle Jahre). Hauptjahr = das oben gewählte Jahr; dazu bis zu drei frühere Jahre.
// Zeitraum „bis Stichtag“: jedes Jahr nur bis zu dem Tag, bis zu dem im Hauptjahr Buchungen eingelesen sind – so werden gleich lange Zeiträume verglichen.
// Sondereffekte: je Jahr eine Grenze (dieselbe wie „Ausreißer“ bei „Spenden JJJJ“, D.spenden.grenze) – Spenden darüber zählen nicht mit.
// Spender:innen werden an der IBAN erkannt (ohne IBAN: am Namen). Auswahl der Jahre, Bausteine, Kennzahlen, Zwecke, Konten und Mailings merkt sich jede Person selbst (UI).
const JV = { q: null, cmp: null, focus: null, segCmp: null, sxAll: false };   // Quartal (0–3) und Vergleichsjahr im Quartalsvergleich, hervorgehobenes Jahr, Vergleichsjahr der Segmente
const JV_BLOCKS = [['kpi', 'Kennzahlen'], ['verlauf', 'Jahresverlauf & Quartale'], ['mail', 'Mailings vergleichen'], ['seg', 'Spendersegmente'], ['zweck', 'Zwecke über die Jahre'], ['konto', 'Konten über die Jahre'], ['dauer', 'Dauerspender:innen']];
const JV_KPIS = [['sum', 'Spendensumme'], ['don', 'Spender:innen'], ['avg', 'Ø je Spender:in'], ['n', 'Spenden'], ['neu', 'Neue Spender:innen'], ['dauer', 'Dauerspender:innen']];
const JV_SEG = ['ab 5.000 €', '1.000–4.999 €', '500–999 €', '250–499 €', '101–249 €', 'bis 100 €'];   // nach der Summe je Spender:in im Zeitraum
const jvSegOf = c => c <= 10000 ? 5 : c < 25000 ? 4 : c < 50000 ? 3 : c < 100000 ? 2 : c < 500000 ? 1 : 0;
const JV_RAMP = { 1: [4], 2: [2, 4], 3: [1, 3, 4], 4: [1, 2, 3, 4] };   // Jahre: eine Farbe, das Hauptjahr am kräftigsten
const JV_MAX_MAIL = 4, JV_MAX_KONTO = 8, JV_QN = ['Q1', 'Q2', 'Q3', 'Q4'], JV_MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const jvDonor = r => r.iban || (r.name ? 'N:' + r.name.toUpperCase() : 'K:' + r.k);
const jvT = v => v >= 1000000 ? de0(v / 100000) + ' T€' : eur0(v);             // Cent → „305 T€“ bzw. „9.870 €“
const de0 = v => Math.round(v).toLocaleString('de-DE');
const jvShown = k => !(UI.jvHide && UI.jvHide[k]);
const jvKShown = k => !(UI.jvKHide && UI.jvKHide[k]);
const jvZHid = () => isObj(UI.jvZHide) ? UI.jvZHide : { [SPJ_FREI]: true, [SPJ_OFFEN]: true };   // anfangs ohne „zweckungebunden“ und „zu klären“
const jvFocus = y => { JV.focus = JV.focus === y ? null : y; hideTip(); renderNow(); };

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
  const yRows = y => { const g = spjGrenze(y); return (byY.get(y) || []).filter(r => (g == null || r.b <= g) && inZ(r)); };
  const ys = [...byY.keys()].sort((a, b) => a - b), Y = new Map();
  // Daueraufträge: Abstand der Buchungen je Spender:in über alle Jahre (Median, gerundet auf 1, 2, 3, 6 oder 12 Monate) – für den Monatsbeitrag
  const daDays = new Map(); let lastD = 0;
  for (const r of SP.rows) { if (r.d > lastD) lastD = r.d; if (!spIsDA(r)) continue; const k = jvDonor(r); if (!daDays.has(k)) daDays.set(k, new Set()); daDays.get(k).add(r.d); }
  const ivl = new Map(), months = k => {
    if (ivl.has(k)) return ivl.get(k);
    const d = [...daDays.get(k)].sort((a, b) => a - b), gaps = []; for (let i = 1; i < d.length; i++) gaps.push(d[i] - d[i - 1]);
    let m; if (gaps.length) { gaps.sort((a, b) => a - b); const g = gaps[gaps.length >> 1] / 30.44; m = [1, 2, 3, 6, 12].reduce((b, v) => Math.abs(v - g) < Math.abs(b - g) ? v : b, 1); }
    else m = lastD - d[0] <= 45 ? 1 : 12;                            // nur eine Buchung: ganz frisch = vermutlich monatlich, sonst jährlich
    ivl.set(k, m); return m; };
  for (const y of S.sel) {
    const all = byY.get(y) || [], rows = yRows(y), g = spjGrenze(y), noOut = all.filter(r => g == null || r.b <= g);
    const don = new Map(), da = new Map(), kt = new Map(); let sum = 0, daSum = 0;
    for (const r of rows) { sum += r.b; const k = jvDonor(r); don.set(k, (don.get(k) || 0) + r.b); kt.set(r.konto || '', (kt.get(r.konto || '') || 0) + r.b);
      if (spIsDA(r)) { daSum += r.b; const o = da.get(k); if (!o || r.d >= o.d) da.set(k, { d: r.d, b: r.b }); } }
    let neu = null;                                                  // neu = vorher (in allen früheren Jahren mit Daten) nicht dabei – nur, wenn es das Vorjahr gibt
    if (byY.has(y - 1)) { const old = new Set(); for (const yy of ys) if (yy < y) for (const r of byY.get(yy)) old.add(jvDonor(r)); neu = 0; for (const k of don.keys()) if (!old.has(k)) neu++; }
    const seg = JV_SEG.map(() => ({ n: 0, sum: 0 })); for (const v of don.values()) { const o = seg[jvSegOf(v)]; o.n++; o.sum += v; }
    let mon = 0; for (const [k, o] of da) mon += o.b / months(k);
    // Zu- und Abgänge: gegenüber den Dauerspender:innen des Vorjahres im gleichen Zeitraum
    let prev = null; if (byY.has(y - 1)) { prev = new Set(); for (const r of yRows(y - 1)) if (spIsDA(r)) prev.add(jvDonor(r)); }
    let plus = null, minus = null; if (prev) { plus = 0; minus = 0; for (const k of da.keys()) if (!prev.has(k)) plus++; for (const k of prev) if (!da.has(k)) minus++; }
    Y.set(y, { y, rows, noOut, sum, n: rows.length, don: don.size, avg: don.size ? sum / don.size : null, neu, dauer: da.size, daSum, daMon: da.size ? mon / da.size : null,
      daStart: prev ? prev.size : null, daPlus: plus, daMinus: minus, seg, kt, has: all.length > 0 });
  }
  _jv = { key, rows: SP.rows, val: Y };
  return Y;
}
// Summe je Zweck und Jahr (Zuordnung wie bei „Spenden JJJJ“)
function jvZwecke(S, Y) {
  const out = new Map();
  for (const y of S.sel) { const o = Y.get(y), m = new Map(); out.set(y, m); if (!o || !o.has) continue;
    const keep = new Set(o.rows.map(r => r.k));
    for (const e of spjCompute(y).list) if (keep.has(e.rec.k)) m.set(e.z, (m.get(e.z) || 0) + e.rec.b); }
  return out;
}
const jvVals = (S, Y, f) => S.sel.map(y => { const o = Y.get(y); return o && o.has ? f(o) : null; });
const jvDelta = (v, p) => v == null || !p ? null : (v / p - 1) * 100;
const jvArrow = d => d >= 0.05 ? ['jv-up', '▲ ', '+'] : d <= -0.05 ? ['jv-dn', '▼ ', '−'] : ['jv-eq', '■ ', '±'];
const jvPct = d => num1(Math.abs(d) < 0.05 ? 0 : Math.abs(d)) + ' %';

// Säulen je Jahr: oben die Zahl, darunter Pfeil (grün/rot) und Veränderung zum Vorjahr, dann die Säule, unten das Jahr – feste Breite, mittig
function jvLadder(S, vals, fmt, focus = null) {
  const n = vals.length, w = 380, bh = 54, top = 36, hgt = top + bh + 20, slot = w / 4, bw = 64, x0 = (w - n * slot) / 2 + (slot - bw) / 2;
  const mx = Math.max(1, ...vals.filter(v => v != null)) * 1.02, s = sv('svg', { viewBox: '0 0 ' + w + ' ' + hgt, class: 'jv-lad', role: 'img' });
  vals.forEach((v, i) => { const x = x0 + i * slot, cx = x + bw / 2, y = S.sel[i];
    s.append(sv('text', { x: cx, y: 12, 'text-anchor': 'middle', class: 'jv-lv' }, v == null ? '–' : fmt(v)));
    const d = i ? jvDelta(v, vals[i - 1]) : null;
    if (d != null) { const [c, a, sg] = jvArrow(d); s.append(sv('text', { x: cx, y: 27, 'text-anchor': 'middle', class: 'jv-ld' }, sv('tspan', { class: c }, a), sg + jvPct(d))); }
    if (v != null) { const hh = Math.max(2, v / mx * bh); s.append(sv('rect', { x, y: top + bh - hh, width: bw, height: hh, rx: 3, fill: S.col(y), opacity: focus != null && focus !== y ? 0.3 : 1 })); }
    s.append(sv('text', { x: cx, y: top + bh + 15, 'text-anchor': 'middle', class: 'sp-ax jv-ly' }, y + (y === S.H && S.mode === 'stich' ? '*' : ''))); });
  return s;
}
// Kachel: Kopf (grau abgesetzt) mit Titel und Zahl des Hauptjahres, darunter weiß die Säulen je Jahr
function jvTile(S, t, vals, fmt, big, o = {}) {
  const v = vals[vals.length - 1];
  return h('div', { class: 'jv-kpi', dataset: o.k ? { k: o.k } : {} },
    h('div', { class: 'jv-kh', tip: o.tip || null }, h('div', { class: 'jv-kt' }, t), h('div', { class: 'jv-kv' }, v == null ? '–' : big(v)),
      o.hide ? h('button', { class: 'jv-kx', 'aria-label': t + ' ausblenden', tip: 'Kennzahl ausblenden – über „Bausteine“ wieder einblenden', onclick: o.hide }, '×') : null),
    h('div', { class: 'jv-kd' }, jvLadder(S, vals, fmt)));
}
const jvGrid = (cls, kids) => h('div', { class: cls + ' c' + (kids.length === 4 ? 2 : Math.min(3, kids.length)) }, kids);
function jvBlock(k, title, head, ...kids) {
  return h('div', { class: 'jv-blk', dataset: { jv: k } }, h('div', { class: 'jv-bh' }, h('h3', null, title), head || null,
    h('button', { class: 'link small jv-hide', tip: 'Baustein ausblenden – über „Bausteine“ wieder einblenden', onclick: () => { UI.jvHide = Object.assign({}, UI.jvHide, { [k]: true }); renderNow(); } }, 'ausblenden')), ...kids);
}
const jvStich = S => S.md ? p2(S.md[1]) + '.' + p2(S.md[0]) + '.' : '';
const jvFoot = (S, t) => S.mode === 'stich' ? h('p', { class: 'muted small jv-foot' }, t || '* ' + S.H + ' bis Stichtag – alle Jahre bis zum ' + jvStich(S) + ' verglichen') : null;
const jvCmpSel = (S, cur, set, cls) => { const others = S.sel.filter(y => y !== S.H);
  return others.length ? h('span', { class: 'jv-cmpw' }, h('span', { class: 'muted small' }, 'verglichen mit'),
    h('select', { class: cls, onchange: e => { set(+e.target.value); renderNow(); } }, others.slice().reverse().map(y => h('option', { value: y, selected: y === cur }, y)))) : null; };
const jvCmpOf = (S, v) => { const others = S.sel.filter(y => y !== S.H); return others.includes(v) ? v : others.length ? others[others.length - 1] : null; };

/* ---------- Leiste: Jahre, Hauptjahr, Zeitraum, Bausteine; darunter Sondereffekte je Jahr und was dadurch ausgeblendet ist */
function jvBar(S, Y) {
  const chip = y => { const on = S.sel.includes(y), main = y === S.H;
    return h('button', { class: 'chip jv-y' + (on ? '' : ' off'), 'aria-pressed': String(on), disabled: main || null, tip: main ? 'Hauptjahr – oben im Kopf oder rechts wählen' : on ? y + ' aus dem Vergleich nehmen' : y + ' dazunehmen',
      onclick: () => { const off = new Set(UI.jvOff || []); if (on) off.add(y); else { if (S.sel.length >= 4) { toast('Höchstens vier Jahre – erst ein anderes Jahr abwählen.'); return; } off.delete(y); } UI.jvOff = [...off]; renderNow(); } },
      h('span', { class: 'dot', style: { background: on ? S.col(y) : 'var(--line2)' } }), y); };
  const setHide = (key, k, on) => { UI[key] = Object.assign({}, UI[key], { [k]: !on }); renderNow(); };
  const blocks = () => h('div', { class: 'jv-bpop' }, h('div', { class: 'menu-head' }, 'Bausteine zeigen'),
    JV_BLOCKS.map(([k, t]) => [h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: jvShown(k), onchange: e => setHide('jvHide', k, e.target.checked) }), t),
      k === 'kpi' ? h('div', { class: 'jv-bsub' }, JV_KPIS.map(([kk, tt]) => h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: jvKShown(kk), onchange: e => setHide('jvKHide', kk, e.target.checked) }), tt))) : null]));
  let bb = null;
  bb = h('button', { class: 'jv-bbtn', onclick: e => { e.stopPropagation(); popover(bb, blocks()); } }, 'Bausteine ▾');
  const zeit = h('select', { class: 'jv-zeit', 'aria-label': 'Zeitraum', onchange: e => { UI.jvZeit = e.target.value; renderNow(); } },
    S.md ? h('option', { value: 'stich', selected: S.mode === 'stich' }, 'bis Stichtag ' + jvStich(S) + ' (letzte Buchung ' + S.H + ')') : null,
    h('option', { value: 'jahr', selected: S.mode === 'jahr' }, 'ganzes Jahr'));
  const hj = h('select', { class: 'jv-hj', 'aria-label': 'Hauptjahr', onchange: e => { UI.year = +e.target.value; renderNow(); } },
    [...new Set([...S.all].concat(S.H))].sort((a, b) => b - a).map(y => h('option', { value: y, selected: y === S.H }, y)));
  const outs = S.sel.slice().reverse().map(y => ({ y, aus: spjOut(spjCompute(y)) }));
  const grenze = ({ y, aus }) => { const g = spjGrenze(y);
    const inp = h('input', { class: 'jv-gr', value: g ? (g / 100).toLocaleString('de-DE') : '', placeholder: '–', inputmode: 'decimal', 'aria-label': 'Sondereffekte ' + y + ': Spenden über diesem Betrag ausblenden', 'data-fk': 'jv-gr:' + y,
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
      onchange: e => { const v = e.target.value.trim(), c = v ? spCents(v) : null; if (v && !(c > 0)) { e.target.value = g ? (g / 100).toLocaleString('de-DE') : ''; toast('Bitte einen Betrag eingeben, z. B. 10.000'); return; } spjSetGrenze(y, c ? Math.round(c) : null); } });
    return h('span', { class: 'jv-sx' }, h('span', { class: 'dot', style: { background: S.col(y) } }), h('b', null, y), h('span', { class: 'muted' }, 'über'), inp, h('span', { class: 'muted' }, '€'),
      aus.length ? h('span', { class: 'jv-aus' }, aus.length + ' · ' + eur0(aus.reduce((t, e) => t + e.rec.b, 0))) : null); };
  // ausgeblendete Spenden je Jahr – damit man beurteilen kann, was herausgenommen ist
  const MAXR = 5, tot = outs.reduce((t, o) => t + o.aus.length, 0), after = r => S.mode === 'stich' && (() => { const [, m, d] = ymd(r.d); return m > S.md[0] || (m === S.md[0] && d > S.md[1]); })();
  const rows = outs.flatMap(({ y, aus }) => (JV.sxAll ? aus : aus.slice(0, MAXR)).map((e, i) => h('tr', { class: i ? '' : 'first' },
    h('td', { class: 'jv-sxy' }, i ? null : [h('span', { class: 'dot', style: { background: S.col(y) } }), h('b', null, y)]),
    h('td', null, fmtD(e.rec.d)), h('td', { class: 'num' }, h('b', null, eur(e.rec.b))), h('td', { class: 'jv-sxn' }, e.rec.name || '–'),
    h('td', { class: 'jv-sxz', tip: e.rec.zweck || null }, e.rec.zweck || '–'), h('td', { class: 'muted' }, spGlied(e.rec.konto)), h('td', { class: 'muted small' }, after(e.rec) ? 'nach dem Stichtag' : null))));
  return h('div', { class: 'jv-bar' },
    h('div', { class: 'jv-row' }, h('span', { class: 'spj-lbl' }, 'Jahre'), S.cand.map(chip),
      h('span', { class: 'spj-lbl jv-gap' }, 'Hauptjahr'), hj, h('span', { class: 'spj-lbl jv-gap' }, 'Zeitraum'), zeit, h('span', { class: 'jv-right' }, bb)),
    h('div', { class: 'jv-row' }, h('span', { class: 'spj-lbl', tip: 'Große Einzelfälle wie Erbschaften: Spenden über der Grenze zählen im Vergleich (und bei „Spenden JJJJ“) nicht mit – je Jahr, gilt für alle, die die Planung öffnen.' }, 'Sondereffekte ausblenden'),
      outs.map(grenze)),
    tot ? h('div', { class: 'jv-row jv-sxl' }, h('span', { class: 'spj-lbl' }, 'Ausgeblendet'),
      h('div', { class: 'jv-sxw' }, h('table', { class: 'jv-sxt' }, h('tbody', null, rows)),
        outs.some(o => o.aus.length > MAXR) ? h('button', { class: 'link small jv-sxm', onclick: () => { JV.sxAll = !JV.sxAll; renderNow(); } }, JV.sxAll ? 'weniger anzeigen' : 'alle ' + tot + ' anzeigen') : null)) : null);
}

/* ---------- Kennzahlen (jede einzeln ein- und ausblendbar) */
function jvKpis(S, Y) {
  const int = v => de0(v), hide = k => () => { UI.jvKHide = Object.assign({}, UI.jvKHide, { [k]: true }); hideTip(); renderNow(); };
  const def = { sum: [o => o.sum, jvT, eur0], don: [o => o.don, int, int, 'gezählt nach IBAN (ohne IBAN: Name)'], avg: [o => o.avg, v => eur0(v), v => eur(v), 'Spendensumme geteilt durch die Zahl der Spender:innen'],
    n: [o => o.n, int, int], neu: [o => o.neu, int, int, 'in keinem früheren Jahr mit eingelesenen Daten dabei – im ersten Jahr mit Daten nicht bestimmbar (–)'],
    dauer: [o => o.dauer, int, int, 'mindestens eine Buchung mit „Dauerauftrag“ im Buchungstext'] };
  const tiles = JV_KPIS.filter(([k]) => jvKShown(k)).map(([k, t]) => { const [f, fmt, big, tip] = def[k]; return jvTile(S, t, jvVals(S, Y, f), fmt, big, { k, tip, hide: hide(k) }); });
  return tiles.length ? jvGrid('jv-kpis', tiles) : h('p', { class: 'muted small' }, 'Alle Kennzahlen ausgeblendet – über „Bausteine“ wieder einblenden.');
}

/* ---------- Jahresverlauf mit Quartalen; Klick auf ein Jahr hebt es hervor, Klick auf ein Quartal öffnet den Quartalsvergleich darunter */
const jvQOf = d => Math.floor((ymd(d)[1] - 1) / 3);
function jvQuarter(S, Y) {
  const q = JV.q; if (q == null) return null;
  const cmp = jvCmpOf(S, JV.cmp), Q = JV_QN[q];
  const st = y => { const rs = ((Y.get(y) || {}).rows || []).filter(r => jvQOf(r.d) === q), sum = rs.reduce((t, r) => t + r.b, 0);
    return { sum, n: rs.length, avg: rs.length ? sum / rs.length : null, don: new Set(rs.map(jvDonor)).size }; };
  const a = st(S.H), b = cmp != null ? st(cmp) : null;
  const dEl = d => { if (d == null) return h('span', { class: 'muted' }, '–'); const [c, ar, sg] = jvArrow(d); return h('span', { class: 'delta ' + (c === 'jv-up' ? 'up' : c === 'jv-dn' ? 'down' : 'eq') }, ar + sg + jvPct(d)); };
  const tr = (t, f, fmt) => h('tr', null, h('th', null, t), h('td', { class: 'num' }, f(a) == null ? '–' : fmt(f(a))),
    b ? h('td', { class: 'num muted' }, f(b) == null ? '–' : fmt(f(b))) : null, b ? h('td', null, dEl(jvDelta(f(a), f(b)))) : null);
  return h('div', { class: 'jv-qp' },
    h('div', { class: 'jv-qh' }, h('b', null, Q + ' im Vergleich'), S.mode === 'stich' ? h('span', { class: 'muted small' }, 'jedes Jahr bis ' + jvStich(S)) : null,
      h('button', { class: 'link small jv-qx', onclick: () => { JV.q = null; renderNow(); } }, '× schließen')),
    h('div', { class: 'jv-qg' },
      h('div', null, h('div', { class: 'jv-st' }, 'Alle Quartale – ' + Q + ' hervorgehoben'), h('div', { class: 'sp-chart', style: { height: '190px' }, dataset: { chart: 'jvqa' } })),
      h('div', { class: 'jv-qn' }, h('div', { class: 'jv-st' }, Q + ' in den Jahren'), jvLadder(S, jvVals(S, Y, o => st(o.y).sum), jvT, JV.focus)),
      h('div', { class: 'jv-qc' }, h('div', { class: 'jv-qch' }, jvCmpSel(S, cmp, v => { JV.cmp = v; }, 'jv-cmp')),
        h('table', { class: 'jv-qtab' }, h('thead', null, h('tr', null, h('th'), h('th', { class: 'num' }, Q + ' ' + S.H), b ? h('th', { class: 'num' }, Q + ' ' + cmp) : null, b ? h('th') : null)),
          h('tbody', null, tr('Spendensumme', o => o.sum, eur0), tr('Spenden', o => o.n, de0), tr('Ø je Spende', o => o.avg, eur), tr('Spender:innen', o => o.don, de0))))));
}
function jvVerlauf(S, Y) {
  return [h('div', { class: 'sp-legend jv-leg' }, S.sel.map(y => h('button', { class: 'jv-legy' + (JV.focus === y ? ' on' : JV.focus != null ? ' dim' : ''), 'aria-pressed': String(JV.focus === y),
      tip: JV.focus === y ? 'Hervorhebung aufheben' : y + ' hervorheben', onclick: () => jvFocus(y) }, h('span', { class: 'jv-ln', style: { background: S.col(y) } }), y)),
    h('span', { class: 'muted' }, '· Klick auf ein Jahr hebt es hervor, Klick auf ein Quartal vergleicht es darunter')),
  h('div', { class: 'sp-chart', style: { height: '250px' }, dataset: { chart: 'jvcum' } }), jvQuarter(S, Y)];
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

/* ---------- Spendersegmente: links Spender:innen, rechts Spendensumme – Hauptjahr kräftig, Vergleichsjahr hell */
function jvSeg(S) {
  const cmp = jvCmpOf(S, JV.segCmp);
  return [h('div', { class: 'sp-legend jv-leg' }, h('span', null, h('span', { class: 'jv-sw', style: { background: S.col(S.H) } }), S.H + ' (Hauptjahr)'),
      cmp != null ? h('span', null, h('span', { class: 'jv-sw', style: { background: S.col(cmp) } }), String(cmp)) : null),
    h('div', { class: 'sp-chart', style: { height: '276px' }, dataset: { chart: 'jvseg' } }),
    jvFoot(S, '* Summe je Spender:in im Zeitraum – ' + S.H + ' bis Stichtag, alle Jahre bis zum ' + jvStich(S))];
}

/* ---------- Zwecke und Konten über die Jahre: je Zweck / Konto eine Linie */
function jvZweckSer(S, Y) {
  const Z = jvZwecke(S, Y), hid = jvZHid(), val = id => S.sel.map(y => Y.get(y) && Y.get(y).has ? (Z.get(y).get(id) || 0) : null);
  const items = D.zwecke.map(z => ({ id: z.id, name: z.name || '(ohne Namen)', col: z.farbe || '#888' }))
    .concat({ id: SPJ_FREI, name: 'zweckungebunden', col: 'var(--faint)' }, S.sel.some(y => Z.get(y).get(SPJ_OFFEN)) ? { id: SPJ_OFFEN, name: 'zu klären', col: 'var(--warn)' } : []);
  return items.map(it => Object.assign(it, { vals: val(it.id), off: !!hid[it.id] }));
}
function jvZweck(S, Y) {
  const ser = jvZweckSer(S, Y), hid = jvZHid();
  const tog = it => { const o = Object.assign({}, hid); if (it.off) delete o[it.id]; else o[it.id] = true; UI.jvZHide = o; hideTip(); renderNow(); };
  return [h('div', { class: 'jv-picks' }, ser.map(it => h('button', { class: 'chip jv-pk' + (it.off ? ' off' : ''), 'aria-pressed': String(!it.off), tip: it.off ? 'einblenden' : 'ausblenden', onclick: () => tog(it) },
      h('span', { class: 'jv-ln', style: { background: it.off ? 'var(--line2)' : it.col } }), it.name)),
    !D.zwecke.length ? h('span', { class: 'muted small' }, 'Noch keine Spendenzwecke angelegt (unter „Spenden JJJJ“).') : null),
  h('div', { class: 'sp-chart', style: { height: '260px' }, dataset: { chart: 'jvzw' } }), jvFoot(S)];
}
function jvKontoList(S, Y) {
  let L = Array.isArray(UI.jvKonten) ? UI.jvKonten.filter(e => e && typeof e.k === 'string') : null;
  if (!L) {                                                          // anfangs die fünf größten Konten (Summe der gewählten Jahre)
    const tot = new Map(); for (const y of S.sel) { const o = Y.get(y); if (o) for (const [k, v] of o.kt) if (k) tot.set(k, (tot.get(k) || 0) + v); }
    L = [...tot].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k], i) => ({ k, c: i }));
  }
  return L;
}
function jvKontoSer(S, Y) {
  return jvKontoList(S, Y).map(e => ({ id: e.k, c: e.c, name: spGlied(e.k), col: 'var(--jvk' + (e.c + 1) + ')', vals: S.sel.map(y => Y.get(y) && Y.get(y).has ? (Y.get(y).kt.get(e.k) || 0) : null) }));
}
function jvKonto(S, Y) {
  const L = jvKontoList(S, Y), set = nl => { UI.jvKonten = nl.map(e => ({ k: e.k, c: e.c })); hideTip(); renderNow(); };
  const tot = new Map(); for (const y of S.sel) { const o = Y.get(y); if (o) for (const [k, v] of o.kt) tot.set(k, (tot.get(k) || 0) + v); }
  const rest = [...tot].filter(([k]) => !L.some(e => e.k === k)).sort((a, b) => b[1] - a[1]);
  let add = null;
  add = L.length < JV_MAX_KONTO && rest.length ? h('button', { class: 'jv-madd small jv-kadd', onclick: e => { e.stopPropagation();
    popover(add, h('div', { class: 'jv-kpop' }, h('div', { class: 'menu-head' }, 'Konto hinzufügen'), rest.map(([k, v]) => h('button', { class: 'mitem', onclick: () => { closeMenu();
      set(L.concat({ k, c: [...Array(JV_MAX_KONTO).keys()].find(c => !L.some(x => x.c === c)) })); } }, h('span', null, spGlied(k)), h('span', { class: 'muted small' }, eur0(v)))))); } }, '+ Konto') : null;
  return [h('div', { class: 'jv-picks' }, L.map((e, i) => h('span', { class: 'chip jv-pk' }, h('span', { class: 'jv-ln', style: { background: 'var(--jvk' + (e.c + 1) + ')' } }), spGlied(e.k),
      h('button', { class: 'sp-x', 'aria-label': 'entfernen', tip: 'aus dem Vergleich nehmen', onclick: () => set(L.filter((_, j) => j !== i)) }, '×'))), add,
    Array.isArray(UI.jvKonten) ? h('button', { class: 'link small jv-ktop', onclick: () => { UI.jvKonten = undefined; renderNow(); } }, 'die 5 größten') : null),
  h('div', { class: 'sp-chart', style: { height: '260px' }, dataset: { chart: 'jvkt' } }), jvFoot(S)];
}

/* ---------- Dauerspender:innen: Anzahl, Summe, Ø Monatsbeitrag je Jahr; Zu- und Abgänge als Brücke Anfang → neu → beendet → Ende */
function jvDauer(S, Y) {
  const int = v => de0(v), mx = Math.max(1, ...S.sel.map(y => { const o = Y.get(y) || {}; return Math.max(o.dauer || 0, o.daStart || 0, (o.daStart || 0) + (o.daPlus || 0)); }));
  return [jvGrid('jv-kpis', [
    jvTile(S, 'Dauerspender:innen im Jahr', jvVals(S, Y, o => o.dauer), int, int, { tip: 'mindestens eine Buchung mit „Dauerauftrag“ im Buchungstext' }),
    jvTile(S, 'Summe aus Daueraufträgen', jvVals(S, Y, o => o.daSum), jvT, eur0),
    jvTile(S, 'Ø Monatsbeitrag', jvVals(S, Y, o => o.daMon), v => eur(v), v => eur(v), { tip: 'je Dauerspender:in der letzte Betrag im Zeitraum, auf einen Monat umgerechnet (vierteljährlich ÷ 3, jährlich ÷ 12 – erkannt am Abstand der Buchungen)' })]),
  h('h4', { class: 'jv-h4' }, 'Zu- und Abgänge je Jahr'),
  h('div', { class: 'jv-brs', style: { gridTemplateColumns: 'repeat(' + S.sel.length + ', minmax(0, 1fr))' } }, S.sel.map(y => jvBridge(S, Y.get(y), mx)))];
}
function jvBridge(S, o, mx) {
  const y = o.y, w = 280, base = 122, top = 26, sc = (base - top) / mx, Yb = v => base - v * sc, bw = 46, gx = 66, s = sv('svg', { viewBox: '0 0 ' + w + ' 146', class: 'jv-brsvg', role: 'img' });
  const bar = (i, a, b, fill, lab, tip) => { const x = 8 + i * gx, y1 = Yb(Math.max(a, b)), y2 = Yb(Math.min(a, b)), r = sv('rect', { x, y: y1, width: bw, height: Math.max(2, y2 - y1), rx: 3, fill, class: 'jv-bar' });
    setTip(r, tip); s.append(r, sv('text', { x: x + bw / 2, y: y1 - 5, 'text-anchor': 'middle', class: 'jv-lv' }, lab)); return x; };
  const lab = t => sv('text', { x: 8 + t[0] * gx + bw / 2, y: base + 15, 'text-anchor': 'middle', class: 'sp-ax' }, t[1]);
  const title = h('div', { class: 'jv-brt' }, h('b', null, y), y === S.H && S.mode === 'stich' ? h('span', { class: 'muted small' }, ' (bis ' + jvStich(S) + ')') : null);
  if (!o.has) return h('div', { class: 'jv-brg' }, title, h('p', { class: 'muted small' }, 'Keine Buchungen.'));
  if (o.daStart == null) { bar(3, 0, o.dauer, S.col(y), de0(o.dauer), o.dauer + ' Dauerspender:innen ' + y); s.append(lab([3, 'Ende']));
    return h('div', { class: 'jv-brg' }, title, s, h('p', { class: 'muted small jv-brn' }, 'Vorjahr ohne Daten – Zu- und Abgänge nicht bestimmbar.')); }
  const a = o.daStart, p = o.daPlus, m = o.daMinus, e = o.dauer, vj = y - 1 + (S.mode === 'stich' ? ' (bis ' + jvStich(S) + ')' : '');
  const x0 = bar(0, 0, a, 'var(--jvbase)', de0(a), a + ' Dauerspender:innen ' + vj),
    x1 = bar(1, a, a + p, 'var(--jvm1)', '+' + de0(p), p + ' neu: ' + y + ' Dauerauftrag, ' + vj + ' nicht'),
    x2 = bar(2, a + p, e, 'var(--jvk8)', '−' + de0(m), m + ' beendet: ' + vj + ' Dauerauftrag, ' + y + ' nicht mehr'),
    x3 = bar(3, 0, e, S.col(y), de0(e), e + ' Dauerspender:innen ' + y);
  [[x0 + bw, x1, a], [x1 + bw, x2, a + p], [x2 + bw, x3, e]].forEach(([u, v, val]) => s.append(sv('line', { x1: u, x2: v, y1: Yb(val), y2: Yb(val), class: 'jv-brl' })));
  [[0, 'Anfang'], [1, 'neu'], [2, 'beendet'], [3, 'Ende']].forEach(t => s.append(lab(t)));
  return h('div', { class: 'jv-brg' }, title, s);
}

/* ---------- Ansicht */
function jvView() {
  if (!SP.rows.length) return h('div', { class: 'spj-empty muted' }, ST.conn !== 'ok' ? 'Mailing-Ordner nicht verbunden – der Jahresvergleich rechnet mit den eingelesenen Spendendateien.' : 'Noch keine Buchungen eingelesen.');
  const S = jvSetup(), Y = jvData(S), hidden = JV_BLOCKS.filter(([k]) => !jvShown(k));
  if (JV.focus != null && !S.sel.includes(JV.focus)) JV.focus = null;
  const zk = [jvShown('zweck') ? jvBlock('zweck', 'Zwecke über die Jahre', null, ...jvZweck(S, Y)) : null, jvShown('konto') ? jvBlock('konto', 'Konten über die Jahre', null, ...jvKonto(S, Y)) : null].filter(Boolean);
  return h('div', { class: 'jv' }, jvBar(S, Y),
    jvShown('kpi') ? jvBlock('kpi', 'Kennzahlen', null, jvKpis(S, Y), jvFoot(S)) : null,
    jvShown('verlauf') ? jvBlock('verlauf', 'Jahresverlauf & Quartale', null, ...jvVerlauf(S, Y)) : null,
    jvShown('mail') ? jvBlock('mail', 'Mailings vergleichen', null, jvMails(S)) : null,
    jvShown('seg') ? jvBlock('seg', 'Spendersegmente', jvCmpSel(S, jvCmpOf(S, JV.segCmp), v => { JV.segCmp = v; }, 'jv-segcmp'), ...jvSeg(S)) : null,
    zk.length === 2 ? h('div', { class: 'jv-grid2' }, zk) : zk,
    jvShown('dauer') ? jvBlock('dauer', 'Dauerspender:innen', null, ...jvDauer(S, Y), jvFoot(S)) : null,
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
  if (kind === 'jvqa') return jvDrawQ(el, S, Y);
  if (kind === 'jvmail') return jvDrawMail(el);
  if (kind === 'jvseg') return jvDrawSeg(el, S, Y);
  if (kind === 'jvzw') return jvDrawLines(el, S, jvZweckSer(S, Y).filter(s => !s.off && s.vals.some(v => v)), 'Kein Zweck eingeblendet.');
  if (kind === 'jvkt') return jvDrawLines(el, S, jvKontoSer(S, Y), 'Kein Konto gewählt.');
}
// Jahresverlauf: Summe kumuliert über das Jahr, Jahre übereinander; Quartale als Felder (Zeigen hebt hervor, Klick vergleicht); hervorgehobenes Jahr kräftig, die anderen blass
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
  const labs = [], F = JV.focus, dim = y => F != null && F !== y;
  for (const s of ser.slice().sort((a, b) => (a.y === F) - (b.y === F))) {          // das hervorgehobene Jahr zuletzt (obenauf)
    const pts = []; for (let i = 0; i <= s.L; i++) pts.push(fx(i, s.len).toFixed(1) + ',' + Yv(s.cum[i] / 100).toFixed(1));
    svg.append(sv('polyline', { class: 'jv-line' + (dim(s.y) ? ' jv-dim' : ''), points: pts.join(' '), stroke: S.col(s.y), 'stroke-width': s.y === F ? 3.5 : s.y === S.H ? 3 : 2 }));
    svg.append(sv('circle', { cx: fx(s.L, s.len), cy: Yv(s.cum[s.L] / 100), r: 4, fill: S.col(s.y), class: 'jv-end' + (dim(s.y) ? ' jv-dim' : '') }));
    labs.push({ s, y: Yv(s.cum[s.L] / 100), x: fx(s.L, s.len) });
  }
  labs.sort((a, b) => a.y - b.y); for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
  for (const l of labs) { const t = sv('text', { class: 'jv-elab click' + (dim(l.s.y) ? ' jv-dim' : '') + (F === l.s.y ? ' on' : ''), x: l.x + 8, y: l.y + 4 }, l.s.y + ' · ' + jvT(l.s.cum[l.s.L]));
    t.addEventListener('click', () => jvFocus(l.s.y)); setTip(t, F === l.s.y ? 'Hervorhebung aufheben' : l.s.y + ' hervorheben'); svg.append(t); }
  // Zeigen: Linie + Werte aller Jahre; Quartal darunter hervorheben; Klick: Quartal vergleichen
  const line = sv('line', { class: 'sp-xh', y1: g.mt, y2: y0, visibility: 'hidden' }), ov = sv('rect', { class: 'sp-ov click', x: g.ml, y: g.mt, width: g.pw, height: g.ph });
  svg.append(line, ov);
  const at = ev => clamp(Math.floor((ev.clientX - svg.getBoundingClientRect().left - g.ml) / g.pw * 365), 0, 364);
  ov.addEventListener('mousemove', ev => { const i = at(ev), x = fx(i, 365), q = i < 90 ? 0 : i < 181 ? 1 : i < 273 ? 2 : 3;
    line.setAttribute('x1', x); line.setAttribute('x2', x); line.setAttribute('visibility', 'visible');
    bands.forEach((b, k) => b.classList.toggle('hov', k === q));
    const d = mkdn(2001, 1, 1) + i, [, m, t] = ymd(d);
    tipEl.replaceChildren(h('div', null, h('b', null, 'bis ' + p2(t) + '.' + p2(m) + '.'), ser.slice().reverse().map(s => { const j = Math.min(i, s.L); return h('div', { class: 'jv-tipr' + (s.y === F ? ' on' : '') }, h('span', { class: 'jv-ln', style: { background: S.col(s.y) } }), s.y + ': ' + eur0(s.cum[j]) + (i > s.L ? ' (Stand ' + fmtS(mkdn(s.y, 1, 1) + s.L) + ')' : '')); }),
      h('div', { class: 'muted small' }, 'Klick: ' + JV_QN[q] + (JV.q === q ? ' schließen' : ' vergleichen'))));
    tipEl.classList.add('on'); placeTip(ev); });
  ov.addEventListener('mouseleave', () => { line.setAttribute('visibility', 'hidden'); bands.forEach(b => b.classList.remove('hov')); hideTip(); });
  ov.addEventListener('click', ev => { const i = at(ev), q = i < 90 ? 0 : i < 181 ? 1 : i < 273 ? 2 : 3; JV.q = JV.q === q ? null : q; hideTip(); renderNow(); });
}
// Quartalsvergleich: alle Quartale, das gewählte kräftig – Säulen je Jahr nebeneinander
function jvDrawQ(el, S, Y) {
  const q = JV.q, F = JV.focus, val = (y, gi) => ((Y.get(y) || {}).rows || []).reduce((t, r) => t + (jvQOf(r.d) === gi ? r.b : 0), 0);
  const vals = [0, 1, 2, 3].map(gi => S.sel.map(y => val(y, gi))), mx = Math.max(1, ...vals.flat());
  const { svg, g } = spFrame(el, 190, 62); g.mr = 8; g.pw = g.W - g.ml - g.mr;
  const Yv = spYAxis(svg, g, mx / 100), y0 = g.mt + g.ph, gw = g.pw / 4, n = S.sel.length, bw = Math.min(26, (gw - 16) / n - 3);
  [0, 1, 2, 3].forEach(gi => { const x0 = g.ml + gi * gw + (gw - n * (bw + 3) + 3) / 2;
    S.sel.forEach((y, j) => { const v = vals[gi][j], yy = Yv(v / 100), op = (gi === q ? 1 : 0.35) * (F != null && F !== y ? 0.35 : 1);
      const r = sv('rect', { x: x0 + j * (bw + 3), y: yy, width: bw, height: Math.max(0.5, y0 - yy), rx: 3, fill: S.col(y), opacity: op, class: 'jv-bar' });
      setTip(r, () => h('div', null, h('b', null, JV_QN[gi] + ' ' + y), h('div', null, eur0(v)))); svg.append(r); });
    svg.append(sv('text', { class: 'sp-ax' + (gi === q ? ' jv-qlab on' : ''), x: g.ml + gi * gw + gw / 2, y: y0 + 16, 'text-anchor': 'middle' }, JV_QN[gi])); });
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
// Spendersegmente: Mitte die Segmente, links Spender:innen, rechts Spendensumme; je Segment Vergleichsjahr (oben, hell) und Hauptjahr (unten, kräftig)
function jvDrawSeg(el, S, Y) {
  const cmp = jvCmpOf(S, JV.segCmp), A = Y.get(S.H), B = cmp != null ? Y.get(cmp) : null;
  if (!A || !A.has) { el.replaceChildren(h('div', { class: 'muted small spj-none' }, 'Keine Spenden im Hauptjahr.')); return; }
  const W = Math.max(560, Math.floor(el.clientWidth)), rowH = 40, top = 26, H = top + 6 * rowH + 6, cx = W / 2, lab = 124, half = cx - lab / 2 - (W < 900 ? 110 : 150);
  const svg = sv('svg', { width: W, height: H, class: 'sp-svg', role: 'img' }); el.replaceChildren(svg);
  const sets = [B && B.has ? [B, S.col(cmp)] : null, [A, S.col(S.H)]].filter(Boolean), mxN = Math.max(1, ...sets.flatMap(([o]) => o.seg.map(s => s.n))), mxS = Math.max(1, ...sets.flatMap(([o]) => o.seg.map(s => s.sum)));
  svg.append(sv('text', { x: cx - lab / 2 - 10, y: 14, 'text-anchor': 'end', class: 'jv-sgh' }, '← Spender:innen'), sv('text', { x: cx + lab / 2 + 10, y: 14, class: 'jv-sgh' }, 'Spendensumme →'));
  JV_SEG.forEach((t, i) => { const y = top + i * rowH, a = A.seg[i], b = B && B.has ? B.seg[i] : null;
    svg.append(sv('rect', { x: cx - lab / 2, y: y + 2, width: lab, height: rowH - 8, rx: 6, class: 'jv-sgbox' }), sv('text', { x: cx, y: y + rowH / 2 + 2, 'text-anchor': 'middle', class: 'jv-sgl' }, t));
    sets.forEach(([o, c], k) => { const by = y + (sets.length === 2 ? 4 + k * 14 : 11), wn = o.seg[i].n / mxN * half, ws = o.seg[i].sum / mxS * half;
      svg.append(sv('rect', { x: cx - lab / 2 - 6 - wn, y: by, width: Math.max(wn, o.seg[i].n ? 2 : 0), height: 12, rx: 3, fill: c }), sv('rect', { x: cx + lab / 2 + 6, y: by, width: Math.max(ws, o.seg[i].sum ? 2 : 0), height: 12, rx: 3, fill: c })); });
    const ty = y + (sets.length === 2 ? 4 + 14 : 11) + 10, wnMax = Math.max(a.n, b ? b.n : 0) / mxN * half, wsMax = Math.max(a.sum, b ? b.sum : 0) / mxS * half;
    const dn = b ? a.n - b.n : null, ds = b ? jvDelta(a.sum, b.sum) : null;
    const tl = sv('text', { x: cx - lab / 2 - 12 - wnMax, y: ty, 'text-anchor': 'end', class: 'jv-sgv' }, de0(a.n));
    if (dn != null) { const [c, ar, sg] = jvArrow(dn); tl.append(sv('tspan', { class: c, dx: 6 }, ar), sv('tspan', null, sg + de0(Math.abs(dn)))); }
    const trt = sv('text', { x: cx + lab / 2 + 12 + wsMax, y: ty, class: 'jv-sgv' }, eur0(a.sum));
    if (ds != null) { const [c, ar, sg] = jvArrow(ds); trt.append(sv('tspan', { class: c, dx: 6 }, ar), sv('tspan', null, sg + jvPct(ds))); }
    svg.append(tl, trt);
    const hit = sv('rect', { x: 0, y, width: W, height: rowH - 4, class: 'jv-sghit' });
    setTip(hit, () => h('div', null, h('b', null, t), [[S.H, a], b ? [cmp, b] : null].filter(Boolean).map(([yy, s]) => h('div', { class: 'jv-tipr' }, h('span', { class: 'jv-ln', style: { background: S.col(yy) } }),
      yy + ': ' + spjWho(s.n) + ' · ' + eur0(s.sum) + (s.n ? ' · Ø ' + eur0(s.sum / s.n) : ''))))); svg.append(hit); });
}
// Zwecke / Konten: x = Jahre, je Reihe eine Linie mit Punkten; rechts Name, Wert des Hauptjahres und Veränderung zum Vorjahr
function jvDrawLines(el, S, ser, empty) {
  if (!ser.length) { el.replaceChildren(h('div', { class: 'muted small spj-none' }, empty)); return; }
  const { svg, g } = spFrame(el, 260, 62); g.mr = clamp(Math.round(g.W * 0.34), 150, 220); g.pw = g.W - g.ml - g.mr;
  const n = S.sel.length, X = i => n === 1 ? g.ml + g.pw / 2 : g.ml + 14 + i / (n - 1) * (g.pw - 28), y0 = g.mt + g.ph;
  const mx = Math.max(1, ...ser.flatMap(s => s.vals.filter(v => v != null))), Yv = spYAxis(svg, g, mx / 100);
  S.sel.forEach((y, i) => svg.append(sv('text', { class: 'sp-ax jv-ly', x: X(i), y: y0 + 16, 'text-anchor': 'middle' }, y + (y === S.H && S.mode === 'stich' ? '*' : ''))));
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
  const labs = [];
  for (const s of ser) {
    const pts = s.vals.map((v, i) => v == null ? null : [X(i), Yv(v / 100)]).filter(Boolean);
    if (pts.length > 1) svg.append(sv('polyline', { class: 'jv-line', points: pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), stroke: s.col, 'stroke-width': 2.2 }));
    for (const p of pts) svg.append(sv('circle', { cx: p[0], cy: p[1], r: 4, fill: s.col, class: 'jv-end' }));
    const li = s.vals.length - 1; if (s.vals[li] != null) labs.push({ s, y: Yv(s.vals[li] / 100) });
  }
  const two = labs.length <= 5, gap = two ? 30 : 15;                 // bis fünf Reihen zweizeilig, sonst einzeilig
  labs.sort((a, b) => a.y - b.y); for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < gap) labs[i].y = labs[i - 1].y + gap;
  const over = labs.length ? labs[labs.length - 1].y - (g.H - (two ? 16 : 6)) : 0; if (over > 0) labs.forEach(l => { l.y -= over; });
  for (const { s, y } of labs) { const v = s.vals[s.vals.length - 1], d = jvDelta(v, s.vals[s.vals.length - 2]), x = g.ml + g.pw + 10;
    const val = [jvT(v)]; if (d != null) { const [c, ar, sg] = jvArrow(d); val.push(sv('tspan', { class: c, dx: 5 }, ar), sv('tspan', null, sg + jvPct(d))); }
    if (two) svg.append(sv('text', { x, y: y - 2, class: 'jv-elab' }, s.name.length > 24 ? s.name.slice(0, 23) + '…' : s.name), sv('text', { x, y: y + 12, class: 'jv-elv' }, ...val));
    else svg.append(sv('text', { x, y: y + 4, class: 'jv-elv' }, sv('tspan', { class: 'jv-eln' }, (s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name) + ' '), ...val)); }
  spCross(svg, g, { at: px => n === 1 ? 0 : clamp(Math.round((px - g.ml - 14) / (g.pw - 28) * (n - 1)), 0, n - 1), x: X,
    dots: i => ser.filter(s => s.vals[i] != null).map(s => sv('circle', { cx: X(i), cy: Yv(s.vals[i] / 100), r: 5, fill: s.col, stroke: 'var(--card)', 'stroke-width': 2 })),
    tip: i => h('div', null, h('b', null, S.sel[i] + (S.sel[i] === S.H && S.mode === 'stich' ? ' bis ' + jvStich(S) : '')),
      ser.filter(s => s.vals[i] != null).sort((a, b) => b.vals[i] - a.vals[i]).map(s => { const d = i ? jvDelta(s.vals[i], s.vals[i - 1]) : null;
        return h('div', { class: 'jv-tipr' }, h('span', { class: 'jv-ln', style: { background: s.col } }), s.name + ': ' + eur0(s.vals[i]) + (d != null ? ' (' + (d >= 0 ? '+' : '−') + jvPct(d) + ')' : '')); })) });
}
