/* ===================================================================== Reiter „Jahresvergleich“: Kennzahlen, Jahresverlauf mit Quartalen, Mailings, Spendersegmente, Zwecke, Konten, Dauerspender:innen */

// Grundlage sind alle eingelesenen Spendendateien (alle Jahre). Hauptjahr = das oben gewählte Jahr; dazu bis zu drei frühere Jahre.
// Zeitraum „bis Stichtag“: jedes Jahr nur bis zu dem Tag, bis zu dem im Hauptjahr Buchungen eingelesen sind – so werden gleich lange Zeiträume verglichen.
// Sondereffekte: je Jahr eine Grenze (dieselbe wie „Ausreißer“ bei „Spenden JJJJ“, D.spenden.grenze); ein Schalter oben rechnet sie überall heraus oder ein.
// Veränderungen immer zum Jahr davor in der Auswahl („ggü. JJJJ“, wenn das direkte Vorjahr abgewählt ist); das Vergleichsjahr der Gegenüberstellung steht oben.
// Spender:innen werden an der IBAN erkannt (ohne IBAN: am Namen). Auswahl der Jahre, Bausteine, Kennzahlen, Zwecke, Konten und Mailings merkt sich jede Person selbst (UI).
const JV = { q: null, focus: null, sxAll: false, cum: null, kSel: new Set(), drag: null, missAll: false };   // gewähltes Quartal (0–3), hervorgehobenes Jahr; cum: Lage der Quartale im Jahresverlauf; kSel: angeklickte Kennzahlen; drag: gezogener Abschnitt
const JV_BLOCKS = [['kpi', 'Kennzahlen'], ['verlauf', 'Jahresverlauf & Quartale'], ['bruecke', 'Spendenbrücke'], ['bindung', 'Spenderbindung'], ['mail', 'Mailings vergleichen'], ['seg', 'Spendersegmente'], ['zweck', 'Zwecke über die Jahre'], ['konto', 'Konten über die Jahre'], ['dauer', 'Dauerspender:innen']];
const JV_KPIS = [['sum', 'Spendensumme'], ['don', 'Spender:innen'], ['avg', 'Ø je Spende'], ['n', 'Spenden'], ['dauer', 'Dauerspender:innen'], ['neu', 'Erstmals gespendet']];
const JV_SEG = ['ab 5.000 €', '1.000–4.999 €', '500–999 €', '250–499 €', '101–249 €', 'bis 100 €'];   // nach der Summe je Spender:in im Zeitraum
const jvSegOf = c => c <= 10000 ? 5 : c < 25000 ? 4 : c < 50000 ? 3 : c < 100000 ? 2 : c < 500000 ? 1 : 0;
const JV_MAX_MAIL = 4, JV_MAX_KONTO = 8, JV_QN = ['Q1', 'Q2', 'Q3', 'Q4'], JV_MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const jvDonor = r => r.iban || (r.name ? 'N:' + r.name.toUpperCase() : 'K:' + r.k);
const de0 = v => Math.round(v).toLocaleString('de-DE');
const jvShown = k => !(UI.jvHide && UI.jvHide[k]);
const jvKShown = k => !(UI.jvKHide && UI.jvKHide[k]);
const jvZHid = () => isObj(UI.jvZHide) ? UI.jvZHide : { [SPJ_FREI]: true, [SPJ_OFFEN]: true };   // anfangs ohne „zweckungebunden“ und „zu klären“
// blasser statt durchsichtig: Farbe mit dem Hintergrund mischen (sonst scheinen Linien durch)
const jvMix = (c, p) => 'color-mix(in srgb, ' + c + ' ' + p + '%, var(--card))';
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
  const others = sel.filter(y => y !== H), cmp = others.includes(UI.jvCmp) ? UI.jvCmp : others.length ? others[others.length - 1] : null;   // Vergleichsjahr: anfangs das Jahr davor
  const grey = others.filter(y => y !== cmp).sort((a, b) => b - a);
  const col = y => y === H ? 'var(--jvH)' : y === cmp ? 'var(--jvV)' : 'var(--jvG' + (grey.indexOf(y) > 0 ? 2 : 1) + ')';   // Hauptjahr kräftig blau, Vergleichsjahr mittelblau, ältere grau
  return { H, cand, sel, last, md, mode, col, all: ys, cmp, sx: UI.jvSxIn === true, grp: jvGrp() };
}
// Zahlen je Jahr (gecacht): Spenden im Zeitraum ohne Sondereffekte
let _jv = { key: null, val: null };
function jvData(S) {
  const P = jvPayers(), regK = jvRegKeys(), regM = jvRegular();
  const key = SP.sig + '|' + SP.rows.length + '|' + JSON.stringify(D.spenden.grenze || {}) + '|' + S.sel.join() + '|' + S.mode + '|' + (S.md || []).join('.') + '|' + S.sx + '|' + S.grp + '|' + _jvPay.key + '|' + regK.size + '|' + JSON.stringify(D.spenden.sdaNein || {});
  if (_jv.key === key && _jv.rows === SP.rows) return _jv.val;
  const okG = r => S.grp === 'alle' || (P.by.get(P.pidOf.get(jvDonor(r))).typ === 'i') === (S.grp === 'inst');   // Gruppe: alle, nur Privat, nur Institutionen
  const isDA = r => spIsDA(r) || regK.has(r.k);                     // Dauerauftrag laut Buchungstext oder regelmäßig erkannt
  const byY = new Map(); for (const r of SP.rows) { if (!okG(r)) continue; const y = ymd(r.d)[0]; if (!byY.has(y)) byY.set(y, []); byY.get(y).push(r); }
  const inZ = r => { if (S.mode !== 'stich') return true; const [, m, d] = ymd(r.d); return m < S.md[0] || (m === S.md[0] && d <= S.md[1]); };
  const yRows = y => { const g = S.sx ? null : spjGrenze(y); return (byY.get(y) || []).filter(r => (g == null || r.b <= g) && inZ(r)); };   // mit Sondereffekten, wenn eingerechnet
  const ys = [...byY.keys()].sort((a, b) => a - b), Y = new Map();
  // Daueraufträge: Abstand der Buchungen je Spender:in über alle Jahre (Median, gerundet auf 1, 2, 3, 6 oder 12 Monate) – für den Monatsbeitrag
  const daDays = new Map(); let lastD = 0;
  for (const r of SP.rows) { if (r.d > lastD) lastD = r.d; if (!spIsDA(r)) continue; const k = jvDonor(r); if (!daDays.has(k)) daDays.set(k, new Set()); daDays.get(k).add(r.d); }
  const ivl = new Map(), months = k => {
    if (ivl.has(k)) return ivl.get(k);
    if (!daDays.has(k)) { const R = regM.get(P.pidOf.get(k)), m = R ? R.m : 1; ivl.set(k, m); return m; }   // regelmäßig erkannt: Rhythmus der Erkennung
    const d = [...daDays.get(k)].sort((a, b) => a - b), gaps = []; for (let i = 1; i < d.length; i++) gaps.push(d[i] - d[i - 1]);
    let m; if (gaps.length) { gaps.sort((a, b) => a - b); const g = gaps[gaps.length >> 1] / 30.44; m = [1, 2, 3, 6, 12].reduce((b, v) => Math.abs(v - g) < Math.abs(b - g) ? v : b, 1); }
    else m = lastD - d[0] <= 45 ? 1 : 12;                            // nur eine Buchung: ganz frisch = vermutlich monatlich, sonst jährlich
    ivl.set(k, m); return m; };
  for (const y of S.sel) {
    const all = byY.get(y) || [], rows = yRows(y), g = spjGrenze(y), noOut = all.filter(r => g == null || r.b <= g), outAll = g == null ? [] : all.filter(r => r.b > g).sort((a, b) => a.d - b.d), out = outAll.filter(inZ);   // out: Sondereffekte im Zeitraum
    const don = new Map(), da = new Map(), daTxt = new Set(), kt = new Map(); let sum = 0, daSum = 0;
    for (const r of rows) { sum += r.b; const k = jvDonor(r), o = don.get(k); if (o) { o.sum += r.b; o.n++; if (r.d >= o.last.d) o.last = r; } else don.set(k, { sum: r.b, n: 1, last: r }); kt.set(r.konto || '', (kt.get(r.konto || '') || 0) + r.b);
      if (isDA(r)) { daSum += r.b; if (spIsDA(r)) daTxt.add(k); const o = da.get(k); if (!o || r.d >= o.d) da.set(k, { d: r.d, b: r.b }); } }
    let neu = null, bind = null;                                     // neu = vorher (in allen früheren Jahren mit Daten) nicht dabei – nur, wenn es das Vorjahr gibt
    if (byY.has(y - 1)) { const old = new Set(); for (const yy of ys) if (yy < y) for (const r of byY.get(yy)) old.add(jvDonor(r)); neu = 0; for (const k of don.keys()) if (!old.has(k)) neu++;
      // Bindung: Spender:innen des Vorjahres (gleicher Zeitraum) – wer ist wieder dabei, wer kam nach einer Pause zurück, wer fehlt
      const P1 = new Set(yRows(y - 1).map(jvDonor)); let keep = 0, react = 0;
      for (const k of don.keys()) { if (P1.has(k)) keep++; else if (old.has(k)) react++; }
      bind = { prev: P1.size, keep, react, first: neu, lost: P1.size - keep, rate: P1.size ? keep / P1.size : null }; }
    const seg = JV_SEG.map(() => ({ n: 0, sum: 0, g: 0 })); for (const v of don.values()) { const o = seg[jvSegOf(v.sum)]; o.n++; o.sum += v.sum; o.g += v.n; }
    let mon = 0; for (const [k, o] of da) mon += o.b / months(k);
    // Zu- und Abgänge: gegenüber den Dauerspender:innen des Vorjahres im gleichen Zeitraum
    let prev = null; if (byY.has(y - 1)) { prev = new Set(); for (const r of yRows(y - 1)) if (isDA(r)) prev.add(jvDonor(r)); }
    let plus = null, minus = null; if (prev) { plus = 0; minus = 0; for (const k of da.keys()) if (!prev.has(k)) plus++; for (const k of prev) if (!da.has(k)) minus++; }
    Y.set(y, { y, rows, noOut, sum, n: rows.length, don: don.size, avg: rows.length ? sum / rows.length : null, neu, dauer: da.size, daSum, daMon: da.size ? mon / da.size : null,
      daStart: prev ? prev.size : null, daPlus: plus, daMinus: minus, daReg: [...da.keys()].filter(k => !daTxt.has(k)).length, seg, kt, all, out, outAll, donors: don, bind, has: all.length > 0 });
  }
  Y.byY = byY; Y.inZ = inZ; Y.isDA = isDA;                           // für „Wer fehlt noch?“
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
const jvGap = (S, i) => i > 0 && S.sel[i - 1] !== S.sel[i] - 1 ? S.sel[i - 1] : null;   // Vergleich über eine Lücke: mit welchem Jahr

// Säulen je Jahr: oben die Zahl, darunter Pfeil (grün/rot) und Veränderung zum Jahr davor („ggü. JJJJ“, wenn das Vorjahr fehlt), dann die Säule, unten das Jahr – feste Breite, mittig
// sub: je Jahr [Zugänge, Abgänge] als eigene Zeile unter der Veränderung (Dauerspender:innen)
function jvLadder(S, vals, fmt, focus = null, sub = null, pp = false) {
  const n = vals.length, gaps = vals.map((v, i) => v != null && vals[i - 1] != null && (pp || vals[i - 1]) ? jvGap(S, i) : null), anyGap = gaps.some(g => g != null);
  const w = 380, bh = 54, yGap = 39, ySub = anyGap ? 53 : 42, top = 36 + (anyGap ? 12 : 0) + (sub ? 14 : 0), hgt = top + bh + 20, slot = w / 4, bw = 64, x0 = (w - n * slot) / 2 + (slot - bw) / 2;
  const mx = Math.max(1, ...vals.filter(v => v != null)) * 1.02, s = sv('svg', { viewBox: '0 0 ' + w + ' ' + hgt, class: 'jv-lad', role: 'img' });
  vals.forEach((v, i) => { const x = x0 + i * slot, cx = x + bw / 2, y = S.sel[i];
    s.append(sv('text', { x: cx, y: 12, 'text-anchor': 'middle', class: 'jv-lv' }, v == null ? '–' : fmt(v)));
    const d = i ? (pp ? (v == null || vals[i - 1] == null ? null : (v - vals[i - 1]) * 100) : jvDelta(v, vals[i - 1])) : null;   // pp: Veränderung in Prozentpunkten
    if (d != null) { const [c, a, sg] = jvArrow(d); s.append(sv('text', { x: cx, y: 27, 'text-anchor': 'middle', class: 'jv-ld' }, sv('tspan', { class: c }, a), sg + (pp ? num1(Math.abs(d) < 0.05 ? 0 : Math.abs(d)) + ' Pkt.' : jvPct(d)))); }
    if (d != null && gaps[i] != null) s.append(sv('text', { x: cx, y: yGap, 'text-anchor': 'middle', class: 'jv-lg' }, 'ggü. ' + gaps[i]));
    if (sub && sub[i]) s.append(sv('text', { x: cx, y: ySub, 'text-anchor': 'middle', class: 'jv-ld' }, sv('tspan', { class: 'jv-zu' }, '+' + de0(sub[i][0])), '  ', sv('tspan', { class: 'jv-ab' }, '−' + de0(sub[i][1]))));
    if (v != null) { const hh = Math.max(2, v / mx * bh); s.append(sv('rect', { x, y: top + bh - hh, width: bw, height: hh, rx: 3, fill: S.col(y), style: focus != null && focus !== y ? 'fill: ' + jvMix(S.col(y), 30) : null })); }
    s.append(sv('text', { x: cx, y: top + bh + 15, 'text-anchor': 'middle', class: 'sp-ax jv-ly' }, y + (y === S.H && S.mode === 'stich' ? '*' : ''))); });
  return s;
}
// Kachel: Kopf (grau abgesetzt) mit Titel und Zahl des Hauptjahres, darunter weiß die Säulen je Jahr
function jvTile(S, t, vals, fmt, big, o = {}) {
  const v = vals[vals.length - 1];
  return h('div', { class: 'jv-kpi', dataset: o.k ? { k: o.k } : {} },
    h('div', { class: 'jv-kh', tip: o.tip || null }, h('div', { class: 'jv-kt' }, t), h('div', { class: 'jv-kv' }, v == null ? '–' : big(v), o.kvs ? h('span', { class: 'jv-kvs' }, o.kvs) : null),
      o.hide ? h('button', { class: 'jv-kx', 'aria-label': t + ' ausblenden', tip: 'Kennzahl ausblenden – über „Bausteine“ wieder einblenden', onclick: o.hide }, '×') : null),
    h('div', { class: 'jv-kd' }, jvLadder(S, vals, fmt, null, o.sub, o.pp), o.note ? h('div', { class: 'jv-kn' }, o.note) : null));
}
const jvGrid = (cls, kids) => h('div', { class: cls + ' c' + (kids.length === 4 ? 2 : Math.min(3, kids.length)) }, kids);
const jvStich = S => S.md ? p2(S.md[1]) + '.' + p2(S.md[0]) + '.' : '';
const jvFoot = (S, t) => S.mode === 'stich' ? h('p', { class: 'muted small jv-foot' }, t || '* ' + S.H + ' bis Stichtag – alle Jahre bis zum ' + jvStich(S) + ' verglichen') : null;
const jvInZ = (S, d) => { if (S.mode !== 'stich') return true; const [, m, t] = ymd(d); return m < S.md[0] || (m === S.md[0] && t <= S.md[1]); };

/* ---------- Leiste: Jahre, Hauptjahr, Zeitraum, Bausteine; darunter Sondereffekte je Jahr und was dadurch ausgeblendet ist */
function jvBar(S, Y) {
  const chip = y => { const on = S.sel.includes(y), main = y === S.H;
    return h('button', { class: 'chip jv-y' + (on ? '' : ' off'), 'aria-pressed': String(on), disabled: main || null, tip: main ? 'Hauptjahr – oben im Kopf oder rechts wählen' : on ? y + ' aus dem Vergleich nehmen' : y + ' dazunehmen',
      onclick: () => { const off = new Set(UI.jvOff || []); if (on) off.add(y); else { if (S.sel.length >= 4) { toast('Höchstens vier Jahre – erst ein anderes Jahr abwählen.'); return; } off.delete(y); } UI.jvOff = [...off]; renderNow(); } },
      h('span', { class: 'dot', style: { background: on ? S.col(y) : 'var(--line2)' } }), y); };
  const setHide = (key, k, on) => { UI[key] = Object.assign({}, UI[key], { [k]: !on }); renderNow(); };
  const mv = (k, d) => { const o = jvOrder(), i = o.indexOf(k), j = i + d; if (j < 0 || j >= o.length) return; o.splice(i, 1); o.splice(j, 0, k); UI.jvOrder = o; renderNow();
    setTimeout(() => { const b = document.querySelector('.jv-bbtn'); if (b) b.click(); }, 0); };
  const blocks = () => h('div', { class: 'jv-bpop' }, h('div', { class: 'menu-head' }, 'Bausteine zeigen und ordnen'),
    jvOrder().map(k => [k, JV_BLOCKS.find(b => b[0] === k)[1]]).map(([k, t], i, a) => [h('div', { class: 'jv-brow' }, h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: jvShown(k), onchange: e => setHide('jvHide', k, e.target.checked) }), t),
        h('button', { class: 'jv-mv', disabled: !i || null, 'aria-label': t + ' nach oben', tip: 'nach oben', onclick: () => mv(k, -1) }, '↑'), h('button', { class: 'jv-mv', disabled: i === a.length - 1 || null, 'aria-label': t + ' nach unten', tip: 'nach unten', onclick: () => mv(k, 1) }, '↓')),
      k === 'kpi' ? h('div', { class: 'jv-bsub' }, JV_KPIS.map(([kk, tt]) => h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: jvKShown(kk), onchange: e => setHide('jvKHide', kk, e.target.checked) }), tt))) : null]),
    h('p', { class: 'muted small jv-bhint' }, 'Abschnitte lassen sich auch am Griff ⠿ im Kopf verschieben.'));
  let bb = null;
  bb = h('button', { class: 'jv-bbtn', onclick: e => { e.stopPropagation(); popover(bb, blocks()); } }, 'Bausteine ▾');
  const zeit = h('select', { class: 'jv-zeit', 'aria-label': 'Zeitraum', onchange: e => { UI.jvZeit = e.target.value; renderNow(); } },
    S.md ? h('option', { value: 'stich', selected: S.mode === 'stich' }, 'bis Stichtag ' + jvStich(S) + ' (letzte Buchung ' + S.H + ')') : null,
    h('option', { value: 'jahr', selected: S.mode === 'jahr' }, 'ganzes Jahr'));
  const hj = h('select', { class: 'jv-hj', 'aria-label': 'Hauptjahr', onchange: e => { UI.year = +e.target.value; renderNow(); } },
    [...new Set([...S.all].concat(S.H))].sort((a, b) => b - a).map(y => h('option', { value: y, selected: y === S.H }, y)));
  const others = S.sel.filter(y => y !== S.H).reverse();
  const vgl = others.length ? h('select', { class: 'jv-cmp', 'aria-label': 'Vergleichsjahr', onchange: e => { UI.jvCmp = +e.target.value; renderNow(); } },
    others.map(y => h('option', { value: y, selected: y === S.cmp }, y + (y === S.H - 1 ? ' (Vorjahr)' : '')))) : h('span', { class: 'muted small' }, '–');
  const sxMode = h('select', { class: 'jv-sxmode', 'aria-label': 'Sondereffekte', onchange: e => { UI.jvSxIn = e.target.value === 'in'; renderNow(); } },
    h('option', { value: 'out', selected: !S.sx }, 'herausrechnen'), h('option', { value: 'in', selected: S.sx }, 'einrechnen'));
  const grpN = { i: 0, p: 0 }; for (const o of jvPayers().by.values()) grpN[o.typ]++;
  const grpSel = h('select', { class: 'jv-grp', 'aria-label': 'Spender:innen', onchange: e => { UI.jvGrp = e.target.value; renderNow(); } },
    [['alle', 'alle'], ['privat', 'nur Privat'], ['inst', 'nur Institutionen']].map(([v, t]) => h('option', { value: v, selected: S.grp === v }, t)));
  const pdf = h('button', { class: 'jv-pdf', tip: 'PDF für die Präsentation: je Abschnitt eine Seite – so wie hier eingestellt (Jahre, Zeitraum, Sondereffekte, gezeigte Abschnitte und ihre Reihenfolge)', onclick: () => jvPrintPDF() }, 'PDF für die Präsentation');
  const outs = S.sel.slice().reverse().map(y => ({ y, aus: spjOut(spjCompute(y)) }));
  const grenze = ({ y, aus }) => { const g = spjGrenze(y);
    const inp = h('input', { class: 'jv-gr', value: g ? (g / 100).toLocaleString('de-DE') : '', placeholder: '–', inputmode: 'decimal', 'aria-label': 'Sondereffekte ' + y + ': Spenden über diesem Betrag', 'data-fk': 'jv-gr:' + y,
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
  return [h('div', { class: 'jv-bar' },
    h('div', { class: 'jv-row' }, h('span', { class: 'spj-lbl' }, 'Jahre'), S.cand.map(chip),
      h('span', { class: 'spj-lbl jv-gap' }, 'Hauptjahr'), hj, h('span', { class: 'spj-lbl jv-gap', tip: 'mit diesem Jahr vergleicht die Gegenüberstellung unter den Quartalen; es erscheint mittelblau' }, 'Vergleich mit'), vgl,
      h('span', { class: 'spj-lbl jv-gap' }, 'Zeitraum'), zeit, h('span', { class: 'jv-right' }, bb, pdf)),
    h('div', { class: 'jv-row' }, h('span', { class: 'spj-lbl', tip: 'Große Einzelfälle wie Erbschaften: Spenden über der Grenze je Jahr. „herausrechnen“ nimmt sie überall im Jahresvergleich heraus (wie bei „Spenden JJJJ“), „einrechnen“ zählt sie überall mit und markiert sie.' }, 'Sondereffekte'),
      outs.map(grenze), h('span', { class: 'jv-sxmw' }, sxMode),
      h('span', { class: 'jv-grpw' }, h('span', { class: 'spj-lbl', tip: 'Privat oder Institution (Stiftung, Firma, Bank, Gewinnsparen …) – erkannt an Stichwörtern im Namen und im Verwendungszweck, von Hand änderbar' }, 'Spender:innen'), grpSel,
        h('button', { class: 'link small jv-iprf', tip: 'Einstufung prüfen und Stichwörter bearbeiten', onclick: () => jvInstDialog() }, 'Einstufung prüfen (' + grpN.i + ' Institutionen)')), tot ? h('button', { class: 'link small jv-sxtog', 'aria-expanded': String(!!UI.jvSx), onclick: () => { UI.jvSx = !UI.jvSx; renderNow(); } },
        UI.jvSx ? 'Liste ausblenden' : (tot === 1 ? 'Sondereffekt anzeigen' : 'Sondereffekte anzeigen (' + tot + ')')) : null)),
    tot && UI.jvSx ? h('div', { class: 'jv-sxl' }, h('span', { class: 'spj-lbl' }, S.sx ? 'Eingerechnet' : 'Herausgerechnet'),
      h('div', { class: 'jv-sxw' }, h('table', { class: 'jv-sxt' }, h('tbody', null, rows)),
        outs.some(o => o.aus.length > MAXR) ? h('button', { class: 'link small jv-sxm', onclick: () => { JV.sxAll = !JV.sxAll; renderNow(); } }, JV.sxAll ? 'weniger anzeigen' : 'alle ' + tot + ' anzeigen') : null)) : null];
}

/* ---------- Kennzahlen (jede einzeln ein- und ausblendbar); Klick auf Kacheln hebt sie hervor, die anderen treten zurück – Klick daneben hebt die Auswahl auf */
function jvKApply(grid) {
  const tiles = [...grid.querySelectorAll('.jv-kpi')], on = tiles.some(t => JV.kSel.has(t.dataset.k));
  grid.classList.toggle('jv-kfocus', on);
  for (const t of tiles) { const sel = JV.kSel.has(t.dataset.k); t.classList.toggle('jv-ksel', sel); t.setAttribute('aria-pressed', String(sel)); }
}
document.addEventListener('click', e => {
  if (!JV.kSel.size || e.target.closest('[data-sec="jv-kpi"] .jv-kpi')) return;
  JV.kSel.clear(); const g = document.querySelector('[data-sec="jv-kpi"] .jv-kpis'); if (g) jvKApply(g);
});
function jvKpis(S, Y) {
  const int = v => de0(v), hide = k => () => { JV.kSel.delete(k); UI.jvKHide = Object.assign({}, UI.jvKHide, { [k]: true }); hideTip(); renderNow(); };
  const def = { sum: [o => o.sum, eur0, eur0], don: [o => o.don, int, int, 'gezählt nach IBAN (ohne IBAN: Name)'], avg: [o => o.avg, eur, eur, 'Durchschnittsspende: Spendensumme geteilt durch die Zahl der Spenden'],
    n: [o => o.n, int, int], neu: [o => o.neu, int, int, 'in keinem früheren eingelesenen Jahr dabei (Daten ab ' + Math.min(...S.all) + ') – bei einer Hausliste meist Gelegenheits- oder Institutionsspenden; im ersten Jahr nicht bestimmbar (–)'],
    dauer: [o => o.dauer, int, int, 'Buchung mit „Dauerauftrag“ im Buchungstext' + (jvRegOn() ? ' oder regelmäßig erkannt (Abschnitt „Dauerspender:innen“)' : '')] };
  const tiles = JV_KPIS.filter(([k]) => jvKShown(k)).map(([k, t]) => { const [f, fmt, big, tip] = def[k], el = jvTile(S, k === 'neu' ? 'Erstmals seit ' + Math.min(...S.all) : t, jvVals(S, Y, f), fmt, big, { k, tip, hide: hide(k) });
    const tog = () => { if (JV.kSel.has(k)) JV.kSel.delete(k); else JV.kSel.add(k); jvKApply(el.parentElement); };
    el.classList.add('click'); el.tabIndex = 0; el.setAttribute('role', 'button');
    el.addEventListener('click', e => { if (!e.target.closest('.jv-kx')) tog(); });
    el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); tog(); } });
    return el; });
  if (!tiles.length) return h('p', { class: 'muted small' }, 'Alle Kennzahlen ausgeblendet – über „Bausteine“ wieder einblenden.');
  const grid = jvGrid('jv-kpis', tiles); jvKApply(grid); return grid;
}

/* ---------- Jahresverlauf mit Quartalen; Klick auf ein Jahr hebt es hervor, Klick auf ein Quartal hebt es im Quartalsvergleich darunter hervor */
const jvQOf = d => Math.floor((ymd(d)[1] - 1) / 3);
// Quartal schon begonnen? Im Modus „bis Stichtag“ zählen Quartale nach dem Stichtag nicht; das Quartal mit dem Stichtag heißt „Q4 (bis 06.10.)“
const jvQIn = (S, q) => S.mode !== 'stich' || q * 3 + 1 <= S.md[0];
const jvQName = (S, q) => JV_QN[q] + (S.mode === 'stich' && Math.floor((S.md[0] - 1) / 3) === q ? ' (bis ' + jvStich(S) + ')' : '');
// Sondereffekte eingerechnet (Schalter oben)? Dann sind sie in den Zeilen schon enthalten – hier nur zum Kennzeichnen
const jvAnyOut = (S, Y) => S.sel.some(y => ((Y.get(y) || {}).outAll || []).length);
const jvSxOn = (S, Y) => S.sx && jvAnyOut(S, Y);
const jvQSrc = (Y, y) => (Y.get(y) || {}).rows || [];
const jvSum = rs => rs.reduce((t, r) => t + r.b, 0);
const jvQPick = q => { JV.q = JV.q === q ? null : q; hideTip(); renderNow(); };
function jvQuarter(S, Y) {
  const q = JV.q, cmp = S.cmp, sx = jvSxOn(S, Y), stich = S.mode === 'stich', dim = qq => q != null && qq !== q;
  const qRows = (y, qq) => jvQSrc(Y, y).filter(r => jvQOf(r.d) === qq), qOut = (y, qq) => jvSum(((Y.get(y) || {}).out || []).filter(r => jvQOf(r.d) === qq));
  // Gegenüberstellung: das gewählte Quartal – ohne Auswahl der ganze Zeitraum
  const st = y => { const rs = q == null ? jvQSrc(Y, y) : qRows(y, q), sum = jvSum(rs); return { sum, n: rs.length, avg: rs.length ? sum / rs.length : null, don: new Set(rs.map(jvDonor)).size }; };
  const a = st(S.H), b = cmp != null ? st(cmp) : null;
  const dEl = d => { if (d == null) return h('span', { class: 'muted' }, '–'); const [c, ar, sg] = jvArrow(d); return h('span', { class: 'delta ' + (c === 'jv-up' ? 'up' : c === 'jv-dn' ? 'down' : 'eq') }, ar + sg + jvPct(d)); };
  const dSm = (d, gy) => { if (d == null) return null; const [c, ar, sg] = jvArrow(d); return h('div', { class: 'jv-qd' }, h('span', { class: c }, ar), sg + jvPct(d), gy != null ? h('span', { class: 'jv-qg' }, ' ggü. ' + gy) : null); };
  // Sondereffekte je Quartal – alle des Jahres; die nach dem Stichtag stehen nur zur Information da
  const sxItem = r => { const y = ymd(r.d)[0], late = !jvInZ(S, r.d);
    return h('div', { class: 'jv-qsxi' + (late ? ' late' : ''), tip: () => h('div', null, h('b', null, fmtD(r.d) + ' · ' + eur(r.b)), h('div', null, r.name || '–'), r.zweck ? h('div', { class: 'small' }, r.zweck) : null, h('div', { class: 'muted small' }, spGlied(r.konto)),
        late ? h('div', { class: 'muted small' }, 'nach dem Stichtag ' + jvStich(S) + ' – zählt im Vergleich nicht') : null) },
      h('span', { class: 'dot', style: { background: S.col(y) } }), h('b', null, y), ' ', h('span', { class: 'jv-qsxb' }, eur(r.b)), h('div', { class: 'muted' }, fmtS(r.d) + (late ? ' · nach dem Stichtag' : r.zweck ? ' · ' + r.zweck : ''))); };
  const sxL = sx ? h('div', { class: 'jv-qsx' }, [0, 1, 2, 3].map(qq => { const L = S.sel.flatMap(y => ((Y.get(y) || {}).outAll || []).filter(r => jvQOf(r.d) === qq));
    return h('div', { class: 'jv-qsxc' + (qq === q ? ' on' : '') + (dim(qq) ? ' dim' : '') }, L.length ? L.map(sxItem) : h('span', { class: 'muted' }, '–')); })) : null;
  // Quartale in Zahlen – Spalten genau unter den Quartalen; ganz rechts die Summe; Klick auf ein Quartal hebt es hervor
  const qc = qq => (qq === q ? ' on' : '') + (dim(qq) ? ' dim' : '');
  const cell = (y, i, qq) => { if (!jvQIn(S, qq)) return h('td', { class: 'num muted' + qc(qq) }, '–');
    const v = jvSum(qRows(y, qq)), p = i ? jvSum(qRows(S.sel[i - 1], qq)) : null, o = sx ? qOut(y, qq) : 0;
    return h('td', { class: 'num' + qc(qq) }, h('div', { class: 'jv-qv' }, eur(v)), i ? dSm(jvDelta(v, p), jvGap(S, i)) : null, o ? h('div', { class: 'jv-qo' }, 'inkl. ' + eur(o) + ' Sondereffekte') : null); };
  const tot = y => jvSum(jvQSrc(Y, y));
  const yCell = (y, i) => { const v = tot(y), o = sx ? jvSum((Y.get(y) || {}).out || []) : 0;
    return h('td', { class: 'num jv-qy' + (q != null ? ' dim' : '') }, h('div', { class: 'jv-qv' }, eur(v)), i ? dSm(jvDelta(v, tot(S.sel[i - 1])), jvGap(S, i)) : null, o ? h('div', { class: 'jv-qo' }, 'inkl. ' + eur(o) + ' Sondereffekte') : null); };
  const num = h('table', { class: 'jv-qnum' }, h('colgroup', null, [0, 1, 2, 3, 4, 5].map(() => h('col'))),
    h('thead', null, h('tr', null, h('th'), JV_QN.map((t, qq) => h('th', { class: 'num click' + qc(qq), tip: qq === q ? 'Auswahl aufheben' : jvQName(S, qq) + ' hervorheben', onclick: () => jvQPick(qq) }, jvQName(S, qq))),
      h('th', { class: 'num jv-qy' + (q != null ? ' dim' : '') }, 'Summe' + (stich ? ' (bis ' + jvStich(S) + ')' : '')))),
    h('tbody', null, S.sel.map((y, i) => h('tr', { class: y === S.H ? 'main' : '' }, h('th', null, h('span', { class: 'dot', style: { background: S.col(y) } }), y + (y === S.H && stich ? '*' : '')),
      [0, 1, 2, 3].map(qq => cell(y, i, qq)), yCell(y, i)))));
  // Gegenüberstellung mit dem Vergleichsjahr (oben gewählt) – an jeder Überschrift „im Vergleich zu …“
  const vgl = cmp != null ? h('span', { class: 'jv-qvgl' }, ' im Vergleich zu ' + cmp) : null;
  const tile = (t, f, fmt) => h('div', { class: 'jv-qcti' }, h('div', { class: 'jv-st' }, t, vgl ? vgl.cloneNode(true) : null), h('div', { class: 'jv-tv' }, f(a) == null ? '–' : fmt(f(a))),
    b ? h('div', { class: 'jv-qctb' }, h('span', { class: 'muted' }, cmp + ': ' + (f(b) == null ? '–' : fmt(f(b)))), dEl(jvDelta(f(a), f(b)))) : null);
  const what = q == null ? S.H + (stich ? ' bis ' + jvStich(S) : '') : jvQName(S, q) + ' ' + S.H;
  return h('div', { class: 'jv-qp' },
    h('div', { class: 'jv-qh' }, h('b', null, q == null ? 'Quartale im Vergleich' : JV_QN[q] + ' im Vergleich'), stich ? h('span', { class: 'muted small' }, 'jedes Jahr bis ' + jvStich(S)) : null,
      sx ? h('span', { class: 'jv-qsxn small' }, 'mit Sondereffekten') : null,
      q != null ? h('button', { class: 'link small jv-qx', onclick: () => jvQPick(q) }, 'Auswahl aufheben') : h('span', { class: 'muted small jv-qx' }, 'Klick auf ein Quartal hebt es hervor')),
    h('div', { class: 'jv-qa' }, h('div', { class: 'jv-st' }, q == null ? 'Alle Quartale' : 'Alle Quartale – ' + JV_QN[q] + ' hervorgehoben'), h('div', { class: 'sp-chart click', style: { height: '200px' }, dataset: { chart: 'jvqa' } }), sxL,
      h('div', { class: 'jv-st jv-qtt' }, 'Quartale in Zahlen'), num),
    h('div', { class: 'jv-qcmp' }, h('div', { class: 'jv-qch' }, h('b', null, what), cmp != null ? h('span', { class: 'muted small' }, 'im Vergleich zu ' + cmp, h('span', { class: 'jv-qhint' }, ' – Vergleichsjahr oben in der Leiste')) : null),
      h('div', { class: 'jv-qct' }, tile('Spendensumme', o => o.sum, eur), tile('Spenden', o => o.n, de0), tile('Ø je Spende', o => o.avg, eur), tile('Spender:innen', o => o.don, de0))));
}
function jvVerlauf(S, Y) {
  return [h('div', { class: 'sp-legend jv-leg' }, S.sel.map(y => h('button', { class: 'jv-legy' + (JV.focus === y ? ' on' : JV.focus != null ? ' dim' : ''), 'aria-pressed': String(JV.focus === y),
      tip: JV.focus === y ? 'Hervorhebung aufheben' : y + ' hervorheben', onclick: () => jvFocus(y) }, h('span', { class: 'jv-ln', style: { background: S.col(y) } }), y)),
    h('span', { class: 'muted' }, '· Klick auf ein Jahr oder ein Quartal hebt es hervor'),
    jvSxOn(S, Y) ? h('span', { class: 'jv-legsx' }, h('span', { class: 'jv-sxsw' }), 'Sondereffekt (eingerechnet)') : null),
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
    h('button', { class: 'sp-x', 'aria-label': 'entfernen', tip: 'aus dem Vergleich nehmen', onclick: () => jvMailSet(L.filter((_, j) => j !== i)) }, '×'),
    e.id && C.byId.has(e.id) ? h('span', { class: 'jv-mname' }, (C.byId.get(e.id).m.name || '(ohne Namen)') + ' · PAL ' + fmtS(C.byId.get(e.id).pal)) : null);   // im PDF statt der Auswahl
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
      st.length ? h('div', { class: 'jv-kbs' }, bars('Erlös', o => o.s.sum || null, eur), bars('Response', o => o.s.resp, v => num1(v) + ' %'), bars('Ø-Spende', o => o.s.avg, eur),
        bars('ROI', o => o.s.roi, v => num1(v)), bars('Tage bis 80 % da', o => o.t80, v => v + (v === 1 ? ' Tag' : ' Tage'))) : null));
}

/* ---------- Spendersegmente: links Spender:innen, rechts Spendensumme – die oben gewählten Jahre untereinander, an jedem Balken Jahr und Zahl */
const jvSegRowH = n => 12 + n * 15;
const jvSegYears = S => S.sel;
function jvSeg(S) {
  return [h('div', { class: 'sp-legend jv-leg' }, S.sel.map(y => h('span', null, h('span', { class: 'jv-sw', style: { background: S.col(y) } }), y + (y === S.H ? ' (Hauptjahr)' : '')))),
    h('div', { class: 'sp-chart', style: { height: (26 + 6 * jvSegRowH(S.sel.length) + 6) + 'px' }, dataset: { chart: 'jvseg' } }),
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

/* ---------- Dauerspender:innen: Anzahl, Summe, Ø Monatsbeitrag je Jahr; auf Wunsch Zu- und Abgänge unter der Anzahl */
function jvDauer(S, Y) {
  const int = v => de0(v), zu = !!UI.jvDaZu;
  const sub = zu ? S.sel.map(y => { const o = Y.get(y) || {}; return o.daPlus == null ? null : [o.daPlus, o.daMinus]; }) : null;
  return [jvGrid('jv-kpis', [
    jvTile(S, 'Dauerspender:innen im Jahr', jvVals(S, Y, o => o.dauer), int, int, { tip: 'Buchung mit „Dauerauftrag“ im Buchungstext' + (jvRegOn() ? ' oder regelmäßig erkannt' : ''), sub,
      kvs: jvRegOn() && (Y.get(S.H) || {}).daReg ? 'davon ' + de0(Y.get(S.H).daReg) + ' an regelmäßigen Buchungen erkannt' : null,
      note: zu ? h('span', null, h('span', { class: 'jv-zut' }, '+ Zugänge'), ' / ', h('span', { class: 'jv-abt' }, '− Abgänge'), ' gegenüber dem Vorjahr' + (S.mode === 'stich' ? ' (jeweils bis ' + jvStich(S) + ')' : '')) : null }),
    jvTile(S, 'Summe aus Daueraufträgen', jvVals(S, Y, o => o.daSum), eur0, eur0),
    jvTile(S, 'Ø Monatsbeitrag', jvVals(S, Y, o => o.daMon), v => eur(v), v => eur(v), { tip: 'je Dauerspender:in der letzte Betrag im Zeitraum, auf einen Monat umgerechnet (vierteljährlich ÷ 3, jährlich ÷ 12 – erkannt am Abstand der Buchungen)' })])];
}

/* ---------- Spendenbrücke: vom Vergleichsjahr zum Hauptjahr – neu/wieder, mehr, weniger, ausgeblieben (je Spender:in, gleicher Zeitraum) */
function jvBridgeData(S, Y) {
  const A = S.cmp != null && Y.get(S.cmp), B = Y.get(S.H);
  if (!A || !A.has || !B) return null;
  const st = () => ({ sum: 0, n: 0, top: [] }), neu = st(), mehr = st(), weniger = st(), aus = st();
  const add = (o, v, d) => { o.sum += v; o.n++; o.top.push([d.last.name || '(ohne Namen)', v]); };
  for (const [k, b] of B.donors) { const a = A.donors.get(k); if (!a) add(neu, b.sum, b); else if (b.sum > a.sum) add(mehr, b.sum - a.sum, b); else if (b.sum < a.sum) add(weniger, a.sum - b.sum, b); }
  for (const [k, a] of A.donors) if (!B.donors.has(k)) add(aus, a.sum, a);
  for (const o of [neu, mehr, weniger, aus]) o.top = o.top.sort((x, y) => y[1] - x[1]).slice(0, 5);
  return { a: A, b: B, start: A.sum, end: B.sum, neu, mehr, weniger, aus, gleich: [...B.donors.keys()].filter(k => A.donors.has(k) && A.donors.get(k).sum === B.donors.get(k).sum).length };
}
function jvBruecke(S, Y) {
  const B = jvBridgeData(S, Y);
  if (!B) return [h('p', { class: 'muted small' }, 'Für die Brücke braucht es oben ein Vergleichsjahr mit Daten.')];
  const d = B.end - B.start;
  return [h('div', { class: 'jv-brsum' }, h('b', null, B.a.y + ' → ' + B.b.y + (S.mode === 'stich' ? ' (jeweils bis ' + jvStich(S) + ')' : '')), ': ', eur(B.start), ' → ', eur(B.end), ' ',
      (() => { const [c, ar, sg] = jvArrow(jvDelta(B.end, B.start) || 0); return h('span', { class: 'delta ' + (c === 'jv-up' ? 'up' : c === 'jv-dn' ? 'down' : 'eq') }, ar + sg + eur(Math.abs(d)) + (B.start ? ' (' + sg + jvPct(Math.abs(d) / B.start * 100) + ')' : '')); })(),
      S.grp !== 'alle' ? h('span', { class: 'muted small' }, ' · ' + jvGrpName(S.grp)) : null),
    h('div', { class: 'sp-chart', style: { height: '280px' }, dataset: { chart: 'jvbr' } }),
    h('p', { class: 'muted small jv-foot' }, spjWho(B.neu.n) + ' neu oder wieder dabei · ' + spjWho(B.mehr.n) + ' mit mehr, ' + spjWho(B.weniger.n) + ' mit weniger, ' + B.gleich + ' mit gleich viel · ' + spjWho(B.aus.n) + ' ausgeblieben')];
}
function jvDrawBridge(el, S, Y) {
  const B = jvBridgeData(S, Y); if (!B) return;
  const { svg, g } = spFrame(el, 280, 96); g.mr = 30; g.pw = g.W - g.ml - g.mr; g.mt = 30; g.ph = g.H - g.mt - g.mb - 16;
  const steps = [['start', String(B.a.y), B.start, null], ['neu', 'neu / wieder dabei', B.neu.sum, B.neu], ['mehr', 'mehr gegeben', B.mehr.sum, B.mehr],
    ['weniger', 'weniger gegeben', -B.weniger.sum, B.weniger], ['aus', 'ausgeblieben', -B.aus.sum, B.aus], ['ende', String(B.b.y), B.end, null]];
  let run = 0; const bars = steps.map(([k, t, v, o]) => { let lo, hi; if (k === 'start' || k === 'ende') { lo = 0; hi = v; run = v; } else { lo = run; hi = run + v; run = hi; } return { k, t, v, o, lo: Math.min(lo, hi), hi: Math.max(lo, hi), end: run }; });
  const mx = Math.max(1, ...bars.map(b => b.hi)), Yv = spYAxis(svg, g, mx / 100), y0 = g.mt + g.ph, n = bars.length, cw = g.pw / n, bw = Math.min(90, cw * 0.62);
  bars.forEach((b, i) => {
    const x = g.ml + i * cw + (cw - bw) / 2, y1 = Yv(b.hi / 100), y2 = Yv(b.lo / 100), fill = b.k === 'start' ? S.col(B.a.y) : b.k === 'ende' ? S.col(B.b.y) : b.v >= 0 ? 'var(--jvplus)' : 'var(--jvminus)';
    const r = sv('rect', { x, y: y1, width: bw, height: Math.max(1.5, y2 - y1), rx: 3, fill, class: 'jv-bar' });
    setTip(r, () => h('div', null, h('b', null, b.t + ': ' + (b.o ? (b.v >= 0 ? '+' : '−') : '') + eur(Math.abs(b.v))), b.o ? h('div', { class: 'small' }, spjWho(b.o.n)) : null,
      b.o && b.o.top.length ? [h('div', { class: 'muted small' }, 'größte Beiträge:'), b.o.top.map(([nm, v]) => h('div', { class: 'small' }, nm + ': ' + eur(v)))] : null));
    svg.append(r);
    svg.append(sv('text', { x: x + bw / 2, y: y1 - 6, 'text-anchor': 'middle', class: 'jv-lv' }, (b.o ? (b.v >= 0 ? '+' : '−') : '') + eur0(Math.abs(b.v))));
    svg.append(sv('text', { x: x + bw / 2, y: y0 + 16, 'text-anchor': 'middle', class: 'sp-ax' + (b.o ? '' : ' jv-ly') }, b.t));
    if (b.o) svg.append(sv('text', { x: x + bw / 2, y: y0 + 30, 'text-anchor': 'middle', class: 'sp-ax' }, spjWho(b.o.n)));
    if (i < n - 1) { const yy = Yv(b.end / 100); svg.append(sv('line', { x1: x + bw, x2: x + cw, y1: yy, y2: yy, class: 'jv-brl' })); }
  });
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
}

/* ---------- Spenderbindung: Haltequote, gehalten, wieder dabei, nicht wieder gespendet; „Wer fehlt noch?“ */
function jvMissing(S, Y, mode) {
  const y = S.H, byY = Y.byY; if (!byY.has(y - 1)) return null;
  const g = S.sx ? null : spjGrenze(y - 1), cur = new Set((byY.get(y) || []).map(jvDonor)), by = new Map();
  const src = (byY.get(y - 1) || []).filter(r => (mode !== 'stich' || Y.inZ(r)) && (g == null || r.b <= g));   // Sondereffekte (z. B. Nachlass) nur, wenn eingerechnet
  for (const r of src) { const k = jvDonor(r); if (cur.has(k)) continue; let o = by.get(k); if (!o) by.set(k, o = { k, name: '', iban: r.iban || '', sum: 0, n: 0, last: r, da: false });
    o.sum += r.b; o.n++; if (r.d >= o.last.d) o.last = r; if (Y.isDA(r)) o.da = true; }
  for (const o of by.values()) { o.name = o.last.name || '(ohne Namen)'; o.typ = jvTypOf(o.last); }
  return [...by.values()].sort((a, b) => b.sum - a.sum);
}
async function jvClip(txt, what) {
  try { await navigator.clipboard.writeText(txt); toast(what + ' kopiert', 'ok'); }
  catch (e) { const t = h('textarea', { style: 'position:fixed;left:-9999px' }); t.value = txt; document.body.append(t); t.select(); try { document.execCommand('copy'); toast(what + ' kopiert', 'ok'); } catch (x) { toast('Kopieren nicht möglich', 'warn'); } t.remove(); }
}
function jvBindung(S, Y, pdf) {
  const pct = v => num1(v * 100) + ' %', int = v => de0(v), b = f => jvVals(S, Y, o => o.bind ? f(o.bind) : null);
  const tiles = jvGrid('jv-kpis c4', [
    jvTile(S, 'Haltequote', b(x => x.rate), pct, pct, { pp: true, tip: 'Anteil der Spender:innen des Vorjahres (gleicher Zeitraum), die wieder gespendet haben – Veränderung in Prozentpunkten' }),
    jvTile(S, 'Gehalten', b(x => x.keep), int, int, { tip: 'im Vorjahr und in diesem Jahr gespendet' }),
    jvTile(S, 'Wieder dabei nach Pause', b(x => x.react), int, int, { tip: 'im Vorjahr nicht, aber in einem früheren Jahr' }),
    jvTile(S, 'Nicht wieder gespendet', b(x => x.lost), int, int, { tip: 'im Vorjahr ja, in diesem Jahr (bis zum Stichtag) nicht' })]);
  // Wer fehlt noch?
  const mode = UI.jvMiss === 'stich' && S.mode === 'stich' ? 'stich' : 'jahr', L = jvMissing(S, Y, mode);
  if (!L) return [tiles, jvFoot(S), h('h4', { class: 'jv-h4' }, 'Wer fehlt noch?'), h('p', { class: 'muted small' }, 'Für ' + (S.H - 1) + ' gibt es keine eingelesenen Buchungen.')];
  const MAX = 15, show = JV.missAll ? L : L.slice(0, MAX), sum = L.reduce((t, o) => t + o.sum, 0);
  if (pdf) return [tiles, jvFoot(S), h('p', { class: 'jv-missh' }, h('b', null, 'Wer fehlt noch? '), (mode === 'stich' ? (S.H - 1) + ' bis ' + jvStich(S) : 'Im ganzen Jahr ' + (S.H - 1)) + ' gespendet, in ' + S.H + ' noch nicht: ',
    h('b', null, spjWho(L.length) + ' · ' + eur(sum)))];   // in der Präsentation keine Namen
  const csvRows = () => [['Name', 'IBAN', 'Spenden ' + (S.H - 1), 'Summe ' + (S.H - 1), 'letzte Spende', 'Betrag', 'Dauerspender:in', 'Gruppe']]
    .concat(L.map(o => [o.name, o.iban, o.n, (o.sum / 100).toFixed(2).replace('.', ','), fmtD(o.last.d), (o.last.b / 100).toFixed(2).replace('.', ','), o.da ? 'ja' : '', o.typ === 'i' ? 'Institution' : 'privat']));
  const csv = () => '﻿' + csvRows().map(r => r.map(v => /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v).join(';')).join('\r\n') + '\r\n';
  const sel = S.mode === 'stich' ? h('select', { class: 'jv-miss', 'aria-label': 'Vorjahr', onchange: e => { UI.jvMiss = e.target.value; renderNow(); } },
    h('option', { value: 'jahr', selected: mode === 'jahr' }, 'im ganzen Jahr ' + (S.H - 1)), h('option', { value: 'stich', selected: mode === 'stich' }, (S.H - 1) + ' bis ' + jvStich(S))) : h('b', null, String(S.H - 1));
  return [tiles, jvFoot(S),
    h('div', { class: 'jv-missh' }, h('h4', { class: 'jv-h4' }, 'Wer fehlt noch?'), h('span', { class: 'muted small' }, 'gespendet'), sel, h('span', { class: 'muted small' }, ', in ' + S.H + ' noch nicht:'),
      h('b', null, spjWho(L.length) + ' · ' + eur(sum)),
      h('span', { class: 'jv-right' }, h('button', { class: 'small jv-mcopy', disabled: !L.length || null, onclick: () => jvClip(csvRows().map(r => r.join('\t')).join('\n'), 'Liste') }, 'Liste kopieren'),
        h('button', { class: 'small jv-mcsv', disabled: !L.length || null, onclick: () => download('Wer_fehlt_noch_' + S.H + '.csv', new Blob([csv()], { type: 'text/csv;charset=utf-8' })) }, 'Als CSV speichern'))),
    L.length ? h('table', { class: 'jv-it jv-mt' }, h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', { class: 'num' }, 'Spenden ' + (S.H - 1)), h('th', { class: 'num' }, 'Summe ' + (S.H - 1)), h('th', null, 'letzte Spende'), h('th'))),
      h('tbody', null, show.map(o => h('tr', null, h('td', { class: 'jv-in' }, o.name), h('td', { class: 'num' }, o.n), h('td', { class: 'num' }, eur(o.sum)), h('td', { class: 'small' }, fmtD(o.last.d) + ' · ' + eur(o.last.b)),
        h('td', null, o.da ? h('span', { class: 'sp-tag da' }, 'Dauerspender:in') : null, o.typ === 'i' ? h('span', { class: 'sp-tag' }, 'Institution') : null)))))
      : h('p', { class: 'muted small' }, 'Alle aus ' + (S.H - 1) + ' haben schon wieder gespendet.'),
    L.length > MAX ? h('button', { class: 'link small jv-mall', onclick: () => { JV.missAll = !JV.missAll; renderNow(); } }, JV.missAll ? 'weniger anzeigen' : 'alle ' + L.length + ' anzeigen') : null];
}

/* ---------- Reiter „Jahresvergleich“: oben die Leiste (bleibt beim Scrollen stehen), darunter je Baustein ein Abschnitt – Reihenfolge per Griff ⠿ oder ↑/↓ unter „Bausteine“ */
// Erklärungen (ⓘ am Abschnitt): wie gerechnet wird
const JV_INFO = {
  kpi: 'Spendensumme: alle Spenden im Zeitraum (Sondereffekte je nach Schalter oben). Spender:innen: gezählt nach IBAN, ohne IBAN nach Name – wer von zwei Konten spendet, zählt doppelt. Ø je Spende: Summe ÷ Zahl der Spenden. Neue Spender:innen: in keinem früheren eingelesenen Jahr dabei („neu seit“ dem ersten Jahr mit Daten). Dauerspender:innen: mindestens eine Buchung mit „Dauerauftrag“ im Buchungstext – Lastschriften erkennt die App daran nicht. Veränderung: zum Jahr davor; fehlt das direkte Vorjahr in der Auswahl, steht „ggü. JJJJ“ dabei. Klick auf Kacheln hebt sie hervor.',
  verlauf: 'Linie: Spendensumme seit 1. Januar aufaddiert, je Jahr eine Linie; bei „bis Stichtag“ zählen in Kennzahlen, Säulen und Tabelle nur die Spenden bis zu dem Tag, bis zu dem im Hauptjahr Buchungen eingelesen sind – die Linien früherer Jahre laufen zur Orientierung weiter. Quartale: Q1 Jan–März usw., das laufende heißt „Qx (bis …)“. Sondereffekte (Raute, braunrot) nur, wenn oben „einrechnen“ gewählt ist. Gegenüberstellung: Hauptjahr gegenüber dem Vergleichsjahr oben.',
  mail: 'Je Mailing die Spenden, die ihm zugeordnet sind (Regel oder von Hand), ab dem PAL aufaddiert – Spenden ohne Zuordnung zählen nicht, die Wirkung eines Mailings kann also größer sein. Response: Spenden ÷ Auflage. Ø-Spende: Erlös ÷ Spenden. ROI: Erlös ÷ Kosten. Tage bis 80 % da: nach wie vielen Tagen ab PAL 80 % des bisherigen Erlöses eingegangen waren.',
  seg: 'Je Spender:in (IBAN, sonst Name) die Summe im Zeitraum, danach das Segment. Bei „bis Stichtag“ rutschen manche in ein niedrigeres Segment als im ganzen Jahr. Links die Zahl der Spender:innen, rechts ihre Summe – je Jahr ein Balken.',
  zweck: 'Zuordnung wie unter „Spenden JJJJ“: Schlagworte im Verwendungszweck, Konten, Maßnahmen. „zweckungebunden“ = passt zu keinem Zweck, „zu klären“ = passt zu mehreren und ist noch nicht entschieden. Klick auf einen Zweck blendet ihn ein oder aus.',
  konto: 'Konto bzw. Gliederung aus der Spalte „Personenname“ der Bankdatei (der gemeinsame Anfang wie „Paderborn -“ wird weggelassen). Anfangs die fünf größten Konten der gewählten Jahre; „+ Konto“ nimmt weitere dazu.',
  bruecke: 'Wie kommt es von der Summe des Vergleichsjahres zur Summe des Hauptjahres? Je Spender:in (IBAN, sonst Name) im gleichen Zeitraum: neu oder wieder dabei (im Vergleichsjahr nicht), mehr gegeben, weniger gegeben, ausgeblieben (im Vergleichsjahr ja, im Hauptjahr bisher nicht). Zeigen einer Säule nennt die größten Beiträge. Mit „nur Privat“ oben bleiben Stiftungen, Firmen und Gewinnsparen außen vor.',
  bindung: 'Haltequote: Anteil der Spender:innen des Vorjahres (gleicher Zeitraum), die im Jahr wieder gespendet haben. Gehalten: wieder dabei. Wieder dabei nach Pause: im Vorjahr nicht, aber in einem früheren Jahr. Nicht wieder gespendet: im Vorjahr ja, in diesem Jahr (bis zum Stichtag) nicht. „Wer fehlt noch?“: alle aus dem Vorjahr, die in diesem Jahr noch nicht gespendet haben (Sondereffekte wie Nachlässe nur, wenn sie eingerechnet sind) – als Liste zum Kopieren oder als CSV (mit IBAN zum Abgleich mit der Spenderdatenbank).',
  dauer: 'Dauerspender:innen: Buchung mit „Dauerauftrag“ im Buchungstext – oder (Schalter) regelmäßig erkannt: gleicher Betrag (Erhöhungen erlaubt) am etwa gleichen Tag im Monat, mindestens dreimal monatlich, vierteljährlich, halb- oder jährlich (halb- und jährlich mit gleichem Verwendungszweck), nur Privat; „erkannte prüfen“ zeigt die Liste. Summe: alle diese Buchungen. Ø Monatsbeitrag: je Dauerspender:in der letzte Betrag im Zeitraum, auf einen Monat umgerechnet (Rhythmus aus dem Abstand der Buchungen: vierteljährlich ÷ 3, jährlich ÷ 12). Zu- und Abgänge: gegenüber den Dauerspender:innen des Vorjahres im gleichen Zeitraum.',
};
function jvOrder() { const ks = JV_BLOCKS.map(b => b[0]), o = Array.isArray(UI.jvOrder) ? UI.jvOrder.filter(k => ks.includes(k)) : []; return [...new Set(o.concat(ks))]; }
function jvMoveTo(src, dst, after) {
  if (src === dst) return;
  const o = jvOrder().filter(k => k !== src); o.splice(o.indexOf(dst) + (after ? 1 : 0), 0, src); UI.jvOrder = o; renderNow();
}
// Abschnitt ziehen: Griff im Kopf; beim Darüberziehen zeigt eine Linie, wo er landet (neben-/untereinander je nach Lage)
function jvDnd(el, k) {
  const side = e => { const r = el.getBoundingClientRect(), row = !!el.closest('.jv-grid2'); return row ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2; };
  const clear = () => el.classList.remove('jv-drop-a', 'jv-drop-b');
  el.addEventListener('dragover', e => { if (!JV.drag || JV.drag === k) return; e.preventDefault(); const a = side(e); el.classList.toggle('jv-drop-a', a); el.classList.toggle('jv-drop-b', !a); });
  el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) clear(); });
  el.addEventListener('drop', e => { if (!JV.drag) return; e.preventDefault(); const a = side(e); clear(); const src = JV.drag; JV.drag = null; jvMoveTo(src, k, a); });
}
const jvGrip = (k, t) => h('span', { class: 'jv-drag', draggable: 'true', role: 'img', 'aria-label': t + ' verschieben', tip: 'ziehen, um „' + t + '“ an eine andere Stelle zu verschieben',
  ondragstart: e => { JV.drag = k; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'jv:' + k); document.body.classList.add('jv-dragging'); hideTip(); },
  ondragend: () => { JV.drag = null; document.body.classList.remove('jv-dragging'); $$('.jv-drop-a, .jv-drop-b').forEach(x => x.classList.remove('jv-drop-a', 'jv-drop-b')); } }, '⠿');
VIEW_FN.vergleich = main => {
  if ((SP.at == null || _spLastView !== 'vergleich') && !SP.busy && ST.conn === 'ok') spScan();   // beim Öffnen des Reiters neu einlesen (unveränderte Dateien kommen aus dem Speicher)
  _spLastView = 'vergleich';
  if (!SP.rows.length) { put(main, spNotice(), h('div', { class: 'spj-empty muted' }, ST.conn !== 'ok' ? 'Der Jahresvergleich rechnet mit den eingelesenen Spendendateien – dafür den Mailing-Ordner verbinden.' : SP.busy ? 'Spendendateien werden eingelesen …' : 'Noch keine Buchungen eingelesen.')); return; }
  const S = jvSetup(), Y = jvData(S), hidden = JV_BLOCKS.filter(([k]) => !jvShown(k));
  if (JV.focus != null && !S.sel.includes(JV.focus)) JV.focus = null;
  const hide = k => h('button', { class: 'link small jv-hide', tip: 'Abschnitt ausblenden – über „Bausteine“ wieder einblenden', onclick: () => { UI.jvHide = Object.assign({}, UI.jvHide, { [k]: true }); hideTip(); renderNow(); } }, 'ausblenden');
  const B = jvSecDefs(S, Y), title = k => JV_BLOCKS.find(b => b[0] === k)[1];
  const sec = k => { const d = B[k], el = section('jv-' + k, title(k), () => ({ body: d.body(), tools: [d.tools ? d.tools() : null, hide(k), jvGrip(k, title(k))] }),
    { tools: () => [hide(k), jvGrip(k, title(k))], closedSummary: d.sum || null, info: JV_INFO[k] }); jvDnd(el, k); return el; };
  // Reihenfolge; Zwecke und Konten nebeneinander, wenn sie direkt aufeinander folgen
  const order = jvOrder().filter(jvShown), out = [];
  for (let i = 0; i < order.length; i++) {
    const k = order[i], nx = order[i + 1];
    if ((k === 'zweck' && nx === 'konto') || (k === 'konto' && nx === 'zweck')) { out.push(h('div', { class: 'jv-grid2' }, sec(k), sec(nx))); i++; }
    else out.push(sec(k));
  }
  put(main, h('div', { class: 'jv' }, spNotice(), ...jvBar(S, Y), out,
    hidden.length ? h('p', { class: 'muted small' }, 'Ausgeblendet: ' + hidden.map(b => b[1]).join(', ') + ' – über „Bausteine“ wieder einblenden.') : null));
};
// Inhalt je Abschnitt (auch fürs PDF)
function jvSecDefs(S, Y) {
  const H = Y.get(S.H) || {}, bis = S.H + (S.mode === 'stich' ? ' bis ' + jvStich(S) : '');
  return {
    kpi: { body: () => [jvKpis(S, Y), jvFoot(S)], sum: () => bis + ': ' + eur0(H.sum || 0) + ' · ' + spjWho(H.don || 0) + ' · ' + spCount(H.n || 0) },
    verlauf: { body: () => jvVerlauf(S, Y), sum: () => S.sel.join(', ') + (S.mode === 'stich' ? ' – jedes Jahr bis ' + jvStich(S) : '') },
    mail: { body: () => jvMails(S), sum: () => { const L = jvMailList().filter(e => e.id && C.byId.has(e.id)); return L.length ? L.map(e => C.byId.get(e.id).m.name || '(ohne Namen)').join(', ') : 'noch kein Mailing gewählt'; } },
    seg: { body: () => jvSeg(S), sum: () => 'nach Summe je Spender:in · ' + S.sel.join(', ') },
    zweck: { body: () => jvZweck(S, Y), sum: () => D.zwecke.length + (D.zwecke.length === 1 ? ' Zweck' : ' Zwecke') },
    konto: { body: () => jvKonto(S, Y), sum: () => jvKontoList(S, Y).map(e => spGlied(e.k)).join(', ') },
    dauer: { body: () => [...jvDauer(S, Y), jvFoot(S)], sum: () => bis + ': ' + spjWho(H.dauer || 0) + (H.daMon ? ' · Ø ' + eur(H.daMon) + ' im Monat' : ''),
      tools: () => [h('label', { class: 'check small jv-dareg', tip: 'Spender:innen ohne „Dauerauftrag“ im Buchungstext, die mit gleichem Betrag in festem Rhythmus spenden, als Dauerspender:innen mitzählen' },
          h('input', { type: 'checkbox', checked: jvRegOn(), onchange: e => { UI.jvDaReg = e.target.checked; renderNow(); } }), 'regelmäßige Buchungen mitzählen'),
        h('button', { class: 'link small jv-daprf', onclick: () => jvRegDialog() }, 'erkannte prüfen (' + jvRegular().size + ')'),
        h('button', { class: 'jv-dazu small', 'aria-pressed': String(!!UI.jvDaZu), onclick: () => { UI.jvDaZu = !UI.jvDaZu; renderNow(); } }, UI.jvDaZu ? 'Zu- und Abgänge ausblenden' : 'Zu- und Abgänge einblenden')] },
    bruecke: { body: () => jvBruecke(S, Y), sum: () => { const B = jvBridgeData(S, Y); return B ? B.a.y + ' → ' + B.b.y + ': ' + (B.end >= B.start ? '+' : '−') + eur0(Math.abs(B.end - B.start)) : 'Vergleichsjahr fehlt'; } },
    bindung: { body: () => jvBindung(S, Y), sum: () => { const b = (Y.get(S.H) || {}).bind; return b && b.rate != null ? 'Haltequote ' + S.H + ': ' + num1(b.rate * 100) + ' %' : 'Vorjahr ohne Daten'; } },
  };
}
VIEW_FN['vergleich:after'] = main => { for (const el of $$('[data-chart]', main)) try { spDraw(el); } catch (e) { console.error(e); } };

/* ---------- PDF für die Präsentation: je gezeigtem Abschnitt eine Seite (A4 quer), so wie eingestellt */
const jvQCols = (W, ml = 96, mr = 150) => { const pw = W - ml - mr, q = [0, 90, 181, 273, 365].map(d => d / 365 * pw); return [ml, q[1] - q[0], q[2] - q[1], q[3] - q[2], q[4] - q[3], mr]; };
function jvPrintDoc() {
  const S = jvSetup(), Y = jvData(S), B = jvSecDefs(S, Y), title = k => JV_BLOCKS.find(b => b[0] === k)[1];
  const stand = 'Stand ' + fmtD(todayDn()) + (D.meta.savedAt ? ' · gespeichert ' + fmtStamp(D.meta.savedAt) : '');
  const sub = 'Jahre ' + S.sel.join(', ') + ' · ' + (S.mode === 'stich' ? 'jedes Jahr bis ' + jvStich(S) : 'ganze Jahre') + ' · Sondereffekte ' + (S.sx ? 'eingerechnet' : 'herausgerechnet') + (S.cmp != null ? ' · Vergleich mit ' + S.cmp : '') + (S.grp !== 'alle' ? ' · ' + jvGrpName(S.grp) : '');
  const page = (t, ...content) => h('section', { class: 'pd-page jv jv-print' }, h('table', { class: 'pd-frame' },
    h('thead', null, h('tr', null, h('td', null, h('div', { class: 'pd-sp' })))),
    h('tbody', null, h('tr', null, h('td', null, h('header', { class: 'pd-head' }, h('img', { src: LOGO, alt: 'Malteser' }), h('div', null, h('h1', null, t), h('span', null, sub)), h('span', { class: 'pd-stand' }, stand)), content))),
    h('tfoot', null, h('tr', null, h('td', null, h('div', { class: 'pd-sp' }))))));
  const pages = [], order = jvOrder().filter(jvShown);
  for (let i = 0; i < order.length; i++) {
    const k = order[i], nx = order[i + 1];
    if (k === 'verlauf') {                                             // Jahresverlauf mit Säulen auf einer Seite, „Quartale in Zahlen“ und Gegenüberstellung auf der nächsten
      const body = jvVerlauf(S, Y), qp = body[2], qa = qp && qp.querySelector('.jv-qa'), num = qa && qa.querySelector('.jv-qnum'), ntt = qa && qa.querySelector('.jv-qtt'), cmp = qp && qp.querySelector('.jv-qcmp');
      if (num) { num.remove(); ntt.remove(); cmp.remove(); }
      pages.push(page('Jahresverlauf & Quartale ' + S.H, body));
      if (num) { const w = jvQCols(PD_CHART_W); num.querySelectorAll('col').forEach((c, j) => { c.style.width = w[j].toFixed(1) + 'px'; }); pages.push(page('Quartale in Zahlen ' + S.H, h('div', { class: 'jv-qa' }, num), cmp)); }
    } else if ((k === 'zweck' && nx === 'konto') || (k === 'konto' && nx === 'zweck')) {
      pages.push(page(title(k) + ' · ' + title(nx), h('div', { class: 'jv-grid2' }, h('div', null, h('h3', { class: 'jv-ph' }, title(k)), B[k].body()), h('div', null, h('h3', { class: 'jv-ph' }, title(nx)), B[nx].body())))); i++;
    } else if (k === 'bindung') pages.push(page(title(k) + ' ' + S.H, jvBindung(S, Y, true)));
    else if (k === 'bruecke') { const BD = jvBridgeData(S, Y); pages.push(page(title(k) + (BD ? ' ' + BD.a.y + ' → ' + BD.b.y : ''), B[k].body())); }
    else pages.push(page(title(k) + (k === 'kpi' || k === 'dauer' ? ' ' + S.H : ''), B[k].body()));
  }
  if (pages.length) pages[pages.length - 1].classList.add('last');
  const doc = h('div', { id: 'printdoc' }, pages);
  for (const el of $$('[data-chart]', doc)) { el.dataset.w = String(el.closest('.jv-grid2') ? Math.floor((PD_CHART_W - 20) / 2) : PD_CHART_W); try { spDraw(el); } catch (e) { console.error(e); } }
  return doc;
}
function jvPrintPDF() {
  if (!jvOrder().some(jvShown)) { toast('Kein Abschnitt eingeblendet.', 'warn'); return; }
  hideTip(); closeMenu();
  const doc = jvPrintDoc();
  $$('#printdoc').forEach(e => e.remove());
  document.body.append(doc);
  document.body.classList.add('printdoc-mode');
  PRINT_TITLE = document.title;
  document.title = 'Jahresvergleich_' + UI.year + '_' + ds(todayDn());   // Vorschlag für den Dateinamen
  setTimeout(() => window.print(), 80);
}

/* ---------- Grafiken */
function jvDraw(el) {
  const S = jvSetup(), Y = jvData(S), kind = el.dataset.chart;
  if (kind === 'jvcum') return jvDrawCum(el, S, Y);
  if (kind === 'jvqa') return jvDrawQ(el, S, Y);
  if (kind === 'jvmail') return jvDrawMail(el);
  if (kind === 'jvseg') return jvDrawSeg(el, S, Y);
  if (kind === 'jvbr') return jvDrawBridge(el, S, Y);
  if (kind === 'jvzw') return jvDrawLines(el, S, jvZweckSer(S, Y).filter(s => !s.off && s.vals.some(v => v)), 'Kein Zweck eingeblendet.');
  if (kind === 'jvkt') return jvDrawLines(el, S, jvKontoSer(S, Y), 'Kein Konto gewählt.');
}
// Jahresverlauf: Summe kumuliert über das Jahr, Jahre übereinander; Quartale als Felder (Zeigen hebt hervor, Klick vergleicht); hervorgehobenes Jahr kräftig, die anderen blass
function jvDrawCum(el, S, Y) {
  const { svg, g } = spFrame(el, 250, 96), ser = [], sx = jvSxOn(S, Y);
  g.mr = 150; g.pw = g.W - g.ml - g.mr;                               // rechts Platz für „2026 · 111.250 €“
  for (const y of S.sel) {
    const o = Y.get(y); if (!o) continue;
    const a = mkdn(y, 1, 1), len = mkdn(y, 12, 31) - a + 1, day = new Array(len).fill(0); let L = -1;
    for (const r of sx ? o.all : o.noOut) { const i = r.d - a; day[i] += r.b; if (i > L) L = i; }
    if (L < 0) continue;
    const cum = []; day.reduce((t, v, i) => (cum[i] = t + v), 0);
    ser.push({ y, a, len, cum, L, out: sx ? o.outAll : [] });
  }
  if (!ser.length) { el.replaceChildren(h('div', { class: 'muted small spj-none' }, 'Keine Spenden in den gewählten Jahren.')); return; }
  const fx = (i, len) => g.ml + (i + 0.5) / len * g.pw, mx = Math.max(...ser.map(s => s.cum[s.L])), Yv = spYAxis(svg, g, mx / 100), y0 = g.mt + g.ph;
  const qx = q => g.ml + [0, 90, 181, 273, 365][q] / 365 * g.pw;
  JV.cum = { ml: g.ml, pw: g.pw };
  const bands = [0, 1, 2, 3].map(q => { const r = sv('rect', { class: 'jv-qband' + (JV.q === q ? ' on' : ''), x: qx(q), y: g.mt, width: qx(q + 1) - qx(q), height: g.ph, rx: 4 }); svg.append(r); return r; });
  [0, 1, 2, 3].forEach(q => svg.append(sv('text', { class: 'sp-ax jv-qlab' + (JV.q === q ? ' on' : ''), x: (qx(q) + qx(q + 1)) / 2, y: g.mt - 5, 'text-anchor': 'middle' }, JV_QN[q] + (JV.q === q ? ' ✓' : ''))));
  for (let m = 0; m < 12; m++) svg.append(sv('text', { class: 'sp-ax', x: g.ml + (mkdn(2001, m + 1, 15) - mkdn(2001, 1, 1)) / 365 * g.pw, y: y0 + 16, 'text-anchor': 'middle' }, JV_MON[m]));
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
  if (S.mode === 'stich') { const sd = mkdn(2001, S.md[0], Math.min(S.md[1], 28)) - mkdn(2001, 1, 1), x = fx(sd, 365);
    svg.append(sv('line', { class: 'jv-stich', x1: x, x2: x, y1: g.mt, y2: y0 }), sv('text', { class: 'jv-stx', x: x + 4, y: g.mt + 11 }, 'Stichtag ' + jvStich(S))); }
  const labs = [], F = JV.focus, dim = y => F != null && F !== y;
  for (const s of ser.slice().sort((a, b) => (a.y === F) - (b.y === F))) {          // das hervorgehobene Jahr zuletzt (obenauf)
    const pts = []; for (let i = 0; i <= s.L; i++) pts.push(fx(i, s.len).toFixed(1) + ',' + Yv(s.cum[i] / 100).toFixed(1));
    svg.append(sv('polyline', { class: 'jv-line' + (dim(s.y) ? ' jv-dim' : ''), points: pts.join(' '), stroke: S.col(s.y), style: dim(s.y) ? 'stroke: ' + jvMix(S.col(s.y), 22) : null, 'stroke-width': s.y === F ? 3.5 : s.y === S.H ? 3 : 2 }));
    svg.append(sv('circle', { cx: fx(s.L, s.len), cy: Yv(s.cum[s.L] / 100), r: 4, fill: S.col(s.y), style: dim(s.y) ? 'fill: ' + jvMix(S.col(s.y), 22) : null, class: 'jv-end' + (dim(s.y) ? ' jv-dim' : '') }));
    labs.push({ s, y: Yv(s.cum[s.L] / 100), x: fx(s.L, s.len) });
  }
  labs.sort((a, b) => a.y - b.y); for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
  for (const l of labs) { const t = sv('text', { class: 'jv-elab click' + (dim(l.s.y) ? ' jv-dim' : '') + (F === l.s.y ? ' on' : ''), x: l.x + 8, y: l.y + 4 }, l.s.y + ' · ' + eur0(l.s.cum[l.s.L]));
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
      h('div', { class: 'muted small' }, 'Klick: ' + (JV.q === q ? 'Auswahl aufheben' : JV_QN[q] + ' hervorheben'))));
    tipEl.classList.add('on'); placeTip(ev); });
  ov.addEventListener('mouseleave', () => { line.setAttribute('visibility', 'hidden'); bands.forEach(b => b.classList.remove('hov')); hideTip(); });
  ov.addEventListener('click', ev => { const i = at(ev); jvQPick(i < 90 ? 0 : i < 181 ? 1 : i < 273 ? 2 : 3); });
  // Sondereffekte als Raute auf der Linie (über der Klickfläche, damit sie sich zeigen lassen)
  for (const s of ser) for (const r of s.out) { const i = r.d - s.a, x = fx(i, s.len), yy = Yv(s.cum[i] / 100);
    const m = sv('path', { d: `M${x} ${yy - 6}L${x + 6} ${yy}L${x} ${yy + 6}L${x - 6} ${yy}Z`, class: 'jv-sxm' + (dim(s.y) ? ' jv-dim' : '') });
    setTip(m, () => h('div', null, h('b', null, 'Sondereffekt ' + fmtD(r.d)), h('div', null, eur(r.b) + (r.name ? ' · ' + r.name : '')), r.zweck ? h('div', { class: 'small' }, r.zweck) : null)); svg.append(m); }
}
// Quartalsvergleich: alle Quartale – je Quartal die Jahre nebeneinander, genau unter dem Quartal des Jahresverlaufs; Sondereffekte (wenn gezeigt) obenauf
function jvDrawQ(el, S, Y) {
  const q = JV.q, F = JV.focus, sx = jvSxOn(S, Y), sumQ = (rs, gi) => rs.reduce((t, r) => t + (jvQOf(r.d) === gi ? r.b : 0), 0);
  const vals = [0, 1, 2, 3].map(gi => S.sel.map(y => { const o = Y.get(y) || {}, e = sx ? sumQ(o.out || [], gi) : 0; return [sumQ(o.rows || [], gi) - e, e]; }));   // [ohne Sondereffekte, Sondereffekte obenauf]
  const mx = Math.max(1, ...vals.flat().map(v => v[0] + v[1]));
  const W = Math.max(320, Math.floor(+el.dataset.w || el.clientWidth)), scope = el.closest('.pd-page, [data-sec]') || document, cum = scope.querySelector('[data-chart="jvcum"] svg');
  let ml = 96, mr = 150;                                             // wie der Jahresverlauf (spFrame 96 / rechts 150) – im PDF stehen beide bündig
  if (cum && JV.cum) { const cr = cum.getBoundingClientRect(), er = el.getBoundingClientRect(); if (cr.width && er.width) { ml = cr.left + JV.cum.ml - er.left; mr = er.right - (cr.left + JV.cum.ml + JV.cum.pw); } }
  const g = { W, H: 200, ml, mr, mt: 10, mb: 24 }; g.pw = W - ml - mr; g.ph = g.H - g.mt - g.mb;
  const svg = sv('svg', { width: W, height: g.H, class: 'sp-svg', role: 'img' }); el.replaceChildren(svg);
  const Yv = spYAxis(svg, g, mx / 100), y0 = g.mt + g.ph, n = S.sel.length, qx = k => g.ml + [0, 90, 181, 273, 365][k] / 365 * g.pw;
  [0, 1, 2, 3].forEach(gi => { const gw = qx(gi + 1) - qx(gi), bw = Math.max(3, Math.min(34, (gw - 24) / n - 4)), x0 = qx(gi) + (gw - n * (bw + 4) + 4) / 2;
    S.sel.forEach((y, j) => { const [v, e] = vals[gi][j], k = (q != null && gi !== q ? 0.35 : 1) * (F != null && F !== y ? 0.35 : 1), x = x0 + j * (bw + 4), mix = c => k < 1 ? 'fill: ' + jvMix(c, Math.round(k * 100)) : null;
      const yb = Yv(v / 100), ye = Yv((v + e) / 100), r = sv('rect', { x, y: yb, width: bw, height: Math.max(0.5, y0 - yb), rx: 3, fill: S.col(y), style: mix(S.col(y)), class: 'jv-bar' });
      const tip = () => h('div', null, h('b', null, jvQName(S, gi) + ' ' + y), h('div', null, eur(v + e)), e ? h('div', { class: 'jv-qo' }, 'darin ' + eur(e) + ' Sondereffekte') : null);
      setTip(r, tip); svg.append(r);
      if (e) { const t = sv('rect', { x, y: ye, width: bw, height: Math.max(1, yb - ye), rx: 3, class: 'jv-bar jv-sxbar', style: mix('var(--jvsx)') }); setTip(t, tip); svg.append(t); } });
    svg.append(sv('text', { class: 'sp-ax' + (gi === q ? ' jv-qlab on' : ''), x: qx(gi) + gw / 2, y: y0 + 16, 'text-anchor': 'middle' }, jvQName(S, gi))); });
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
  svg.addEventListener('click', ev => { const x = ev.clientX - svg.getBoundingClientRect().left; for (let k = 0; k < 4; k++) if (x >= qx(k) && x < qx(k + 1)) return jvQPick(k); });
  // Sondereffekte und „Quartale in Zahlen“ darunter an denselben Quartalen ausrichten
  const wrap = el.parentElement, w = [ml, ...[0, 1, 2, 3].map(k => qx(k + 1) - qx(k)), mr].map(v => Math.max(0, v).toFixed(1) + 'px');
  const lst = wrap && wrap.querySelector('.jv-qsx'); if (lst) Object.assign(lst.style, { paddingLeft: w[0], paddingRight: w[5], gridTemplateColumns: w.slice(1, 5).join(' ') });
  if (wrap) wrap.querySelectorAll('.jv-qnum col').forEach((c, i) => { c.style.width = w[i]; });
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
  for (const l of labs) svg.append(sv('text', { class: 'jv-elab', style: 'fill: var(--jvm' + (l.o.c + 1) + ')', x: g.ml + g.pw + 8, y: l.y + 4 }, (l.o.x.m.name || '?').replace(/\s*\d{4}$/, '').slice(0, 22) + ' ’' + String(ymd(l.o.x.pal)[0]).slice(2)));
  spCross(svg, g, { at: px => clamp(Math.round((px - g.ml) / g.pw * days), 0, days), x: X,
    dots: d => st.map(o => sv('circle', { cx: X(d), cy: Yv(o.sr.cum[Math.min(d, o.sr.cum.length - 1)] / 100), r: 4, fill: 'var(--jvm' + (o.c + 1) + ')', stroke: 'var(--card)', 'stroke-width': 2 })),
    tip: d => h('div', null, h('b', null, d ? d + ' Tage nach dem PAL' : 'am PAL'), st.map(o => h('div', { class: 'jv-tipr' }, h('span', { class: 'jv-ln', style: { background: 'var(--jvm' + (o.c + 1) + ')' } }), (o.x.m.name || '?') + ': ' + eur0(o.sr.cum[Math.min(d, o.sr.cum.length - 1)])))) });
}
// Spendersegmente: Mitte die Segmente, links Spender:innen, rechts Spendensumme; je Segment die gewählten Jahre untereinander, an jedem Balken Jahr und Zahl
function jvDrawSeg(el, S, Y) {
  const ys = jvSegYears(S).filter(y => Y.get(y) && Y.get(y).has);
  if (!ys.length) { el.replaceChildren(h('div', { class: 'muted small spj-none' }, 'Keine Spenden in den gewählten Jahren.')); return; }
  const n = ys.length, rowH = jvSegRowH(n), W = Math.max(560, Math.floor(+el.dataset.w || el.clientWidth)), top = 26, H = top + 6 * rowH + 6, cx = W / 2, lab = 124, half = cx - lab / 2 - (W < 900 ? 120 : 160);
  const svg = sv('svg', { width: W, height: H, class: 'sp-svg', role: 'img' }); el.replaceChildren(svg);
  const segs = ys.map(y => Y.get(y).seg), mxN = Math.max(1, ...segs.flatMap(sg => sg.map(s => s.n))), mxS = Math.max(1, ...segs.flatMap(sg => sg.map(s => s.sum)));
  svg.append(sv('text', { x: cx - lab / 2 - 10, y: 14, 'text-anchor': 'end', class: 'jv-sgh' }, '← Spender:innen'), sv('text', { x: cx + lab / 2 + 10, y: 14, class: 'jv-sgh' }, 'Spendensumme →'));
  JV_SEG.forEach((t, i) => { const y = top + i * rowH;
    svg.append(sv('rect', { x: cx - lab / 2, y: y + 3, width: lab, height: rowH - 8, rx: 6, class: 'jv-sgbox' }), sv('text', { x: cx, y: y + rowH / 2 + 2, 'text-anchor': 'middle', class: 'jv-sgl' }, t));
    ys.forEach((yr, k) => { const s = segs[k][i], by = y + 6 + k * 15, wn = s.n / mxN * half, ws = s.sum / mxS * half;
      svg.append(sv('rect', { x: cx - lab / 2 - 6 - wn, y: by, width: Math.max(wn, s.n ? 2 : 0), height: 11, rx: 3, fill: S.col(yr) }),
        sv('rect', { x: cx + lab / 2 + 6, y: by, width: Math.max(ws, s.sum ? 2 : 0), height: 11, rx: 3, fill: S.col(yr) }),
        sv('text', { x: cx - lab / 2 - 12 - wn, y: by + 9.5, 'text-anchor': 'end', class: 'jv-sgv' }, sv('tspan', { class: 'jv-sgy' }, yr + ': '), de0(s.n)),
        sv('text', { x: cx + lab / 2 + 12 + ws, y: by + 9.5, class: 'jv-sgv' }, sv('tspan', { class: 'jv-sgy' }, yr + ': '), eur0(s.sum))); });
    const hit = sv('rect', { x: 0, y, width: W, height: rowH - 2, class: 'jv-sghit' });
    setTip(hit, () => h('div', null, h('b', null, t), ys.map((yr, k) => { const s = segs[k][i]; return h('div', { class: 'jv-tipr' }, h('span', { class: 'jv-ln', style: { background: S.col(yr) } }),
      yr + ': ' + spjWho(s.n) + ' · ' + eur(s.sum) + (s.g ? ' · Ø je Spende ' + eur(s.sum / s.g) : '')); }))); svg.insertBefore(hit, svg.firstChild); });
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
  const gl = jvGap(S, n - 1);
  for (const { s, y } of labs) { const v = s.vals[s.vals.length - 1], d = jvDelta(v, s.vals[s.vals.length - 2]), x = g.ml + g.pw + 10;
    const val = [eur0(v)]; if (d != null) { const [c, ar, sg] = jvArrow(d); val.push(sv('tspan', { class: c, dx: 5 }, ar), sv('tspan', null, sg + jvPct(d) + (gl != null ? ' ggü. ' + gl : ''))); }
    if (two) svg.append(sv('text', { x, y: y - 2, class: 'jv-elab' }, s.name.length > 24 ? s.name.slice(0, 23) + '…' : s.name), sv('text', { x, y: y + 12, class: 'jv-elv' }, ...val));
    else svg.append(sv('text', { x, y: y + 4, class: 'jv-elv' }, sv('tspan', { class: 'jv-eln' }, (s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name) + ' '), ...val)); }
  spCross(svg, g, { at: px => n === 1 ? 0 : clamp(Math.round((px - g.ml - 14) / (g.pw - 28) * (n - 1)), 0, n - 1), x: X,
    dots: i => ser.filter(s => s.vals[i] != null).map(s => sv('circle', { cx: X(i), cy: Yv(s.vals[i] / 100), r: 5, fill: s.col, stroke: 'var(--card)', 'stroke-width': 2 })),
    tip: i => h('div', null, h('b', null, S.sel[i] + (S.sel[i] === S.H && S.mode === 'stich' ? ' bis ' + jvStich(S) : '')),
      ser.filter(s => s.vals[i] != null).sort((a, b) => b.vals[i] - a.vals[i]).map(s => { const d = i ? jvDelta(s.vals[i], s.vals[i - 1]) : null;
        return h('div', { class: 'jv-tipr' }, h('span', { class: 'jv-ln', style: { background: s.col } }), s.name + ': ' + eur0(s.vals[i]) + (d != null ? ' (' + (d >= 0 ? '+' : '−') + jvPct(d) + (jvGap(S, i) != null ? ' ggü. ' + jvGap(S, i) : '') + ')' : '')); })) });
}
