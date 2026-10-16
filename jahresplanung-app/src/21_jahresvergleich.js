/* ===================================================================== Reiter „Jahresvergleich“: auf einen Blick, Jahresziel, Jahresverlauf, Privat & Institutionen, Brücke, Bindung, Kennzahlen, Details */

// Grundlage sind alle eingelesenen Spendendateien (alle Jahre). Hauptjahr = das oben gewählte Jahr; dazu bis zu drei frühere Jahre.
// Zeitraum „bis Stichtag“: jedes Jahr nur bis zu dem Tag, bis zu dem im Hauptjahr Buchungen eingelesen sind – so werden gleich lange Zeiträume verglichen.
// Sondereffekte: je Jahr eine Grenze (dieselbe wie „Ausreißer“ bei „Spenden JJJJ“, D.spenden.grenze); ein Schalter oben rechnet sie überall heraus oder ein.
// Veränderungen: in Tabellen und Kacheln Hauptjahr gegenüber dem Vergleichsjahr (oben), in den Säulen je Jahr zum Jahr davor; farbig erst ab 5 % (Anteile: 2 Prozentpunkte).
// Spender:innen werden an der IBAN erkannt (ohne IBAN: am Namen). Oben gilt „Alle / Privat / Institutionen“ für alles; einige Abschnitte haben eine eigene Auswahl.
// Auswahl der Jahre, Bausteine, Kennzahlen, Konten, Mailings und Reihenfolge merkt sich jede Person selbst (UI).
const JV = { q: null, focus: null, sxAll: false, cum: null, missAll: false, missOpen: false, topAll: false, artOpen: new Set() };   // gewähltes Quartal (0–3), hervorgehobenes Jahr; cum: Lage der Quartale im Jahresverlauf
const JV_BLOCKS = [['blick', 'Auf einen Blick'], ['ziel', 'Hochrechnung'], ['kpi', 'Kennzahlen'], ['verlauf', 'Jahresverlauf'], ['herkunft', 'Privat & Institutionen'], ['bruecke', 'Spendenbrücke'], ['seg', 'Spendersegmente'],
  ['bindung', 'Spenderbindung'], ['dauer', 'Dauerspender:innen'], ['mail', 'Maßnahmen vergleichen'], ['zweck', 'Zwecke über die Jahre'], ['konto', 'Konten über die Jahre'], ['top', 'Größte Spender:innen']];
const JV_DETAIL = new Set(['mail', 'zweck', 'konto', 'top']);   // Details: anfangs eingeklappt
const JV_PAIRS = [['ziel', 'kpi', 'r12'], ['zweck', 'konto'], ['bruecke', 'seg'], ['bindung', 'dauer']];   // nebeneinander, wenn sie direkt aufeinander folgen (r12: ein Drittel / zwei Drittel)
const jvPair = (k, nx) => { const p = JV_PAIRS.find(p => (p[0] === k && p[1] === nx) || (p[1] === k && p[0] === nx)); return p ? 'jv-grid2' + (p[2] ? ' ' + (p[0] === k ? p[2] : 'r' + p[2][2] + p[2][1]) : '') : null; };
const JV_GRPS = [['alle', 'Alle'], ['privat', 'Privat'], ['inst', 'Institutionen']];
const JV_KPIS = [['sum', 'Spendensumme'], ['don', 'Spender:innen'], ['avg', 'Ø je Spende'], ['n', 'Spenden'], ['dauer', 'Dauerspender:innen'], ['top', 'Anteil der größten 10 %'], ['neu', 'Erstmals gespendet']];
const JV_KOFF = new Set(['neu']);                                          // anfangs ausgeblendet (über „Bausteine“ einblenden)
const JV_SEG = ['ab 5.000 €', '1.000–4.999 €', '500–999 €', '250–499 €', '101–249 €', 'bis 100 €'];   // nach der Summe je Spender:in im Zeitraum
const JV_SEGA = [5, 4, 3, 2, 1, 0];                                               // aufsteigend: bis 100 € … ab 5.000 €
const jvSegOf = c => c <= 10000 ? 5 : c < 25000 ? 4 : c < 50000 ? 3 : c < 100000 ? 2 : c < 500000 ? 1 : 0;
const JV_MAX_MAIL = 8, JV_MAX_KONTO = 8, JV_QN = ['Q1', 'Q2', 'Q3', 'Q4'], JV_MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const jvDonor = r => r.iban || (r.name ? 'N:' + r.name.toUpperCase() : 'K:' + r.k);
const de0 = v => Math.round(v).toLocaleString('de-DE');
const jvShown = k => !(UI.jvHide && UI.jvHide[k]);
const jvKShown = k => { const o = isObj(UI.jvKHide) ? UI.jvKHide : {}; return k in o ? !o[k] : !JV_KOFF.has(k); };
// blasser statt durchsichtig: Farbe mit dem Hintergrund mischen (sonst scheinen Linien durch)
const jvMix = (c, p) => 'color-mix(in srgb, ' + c + ' ' + p + '%, var(--card))';
const jvFocus = y => { JV.focus = JV.focus === y ? null : y; hideTip(); renderNow(); };
// Auswahl Alle / Privat / Institutionen gilt überall (Leiste); nur „Privat & Institutionen“ zeigt immer beide
const jvSS = (S, k) => k === 'herkunft' && S.grp !== 'alle' ? Object.assign({}, S, { grp: 'alle' }) : S;
const jvTitle = (S, k) => JV_BLOCKS.find(b => b[0] === k)[1];   // Brücke ohne Jahre im Titel (stehen an den Balken) – passt so in die schmale Spalte
// Jahre, Hauptjahr, Stichtag
function jvSetup() {
  const H = UI.year, ys = new Set(); for (const r of SP.rows) ys.add(ymd(r.d)[0]);
  const cand = [...new Set([...ys].filter(y => y <= H).concat(H))].sort((a, b) => a - b).slice(-6);
  const off = new Set(UI.jvOff || []); let sel = cand.filter(y => y === H || !off.has(y)); if (sel.length > 4) sel = sel.slice(-4);
  const a = mkdn(H, 1, 1), b = mkdn(H, 12, 31); let last = null;
  for (const r of SP.rows) if (r.d >= a && r.d <= b && (last == null || r.d > last)) last = r.d;
  const md = last != null ? ymd(last).slice(1) : null, full = !md || (md[0] === 12 && md[1] >= 20);
  const mode = md && (UI.jvZeit === 'stich' || (UI.jvZeit !== 'jahr' && !full)) ? 'stich' : 'jahr';
  const others = sel.filter(y => y !== H), cmp = others.length ? others[others.length - 1] : null;   // Vergleichsjahr: das Vorjahr (bzw. das nächste frühere gewählte Jahr)
  const grey = others.filter(y => y !== cmp).sort((a, b) => b - a);
  const col = y => y === H ? 'var(--jvH)' : y === cmp ? 'var(--jvV)' : 'var(--jvG' + (grey.indexOf(y) > 0 ? 2 : 1) + ')';   // Hauptjahr kräftig blau, Vergleichsjahr mittelblau, ältere grau
  return { H, cand, sel, last, md, mode, col, all: ys, cmp, sx: UI.jvSxIn === true, grp: jvGrp() };
}
// Zahlen je Jahr (gecacht): Spenden im Zeitraum ohne Sondereffekte
const _jvC = new Map();                                             // bis zu vier Fassungen (Abschnitte mit eigener Auswahl)
function jvData(S) {
  const P = jvPayers(), regK = jvRegKeys(), regM = jvRegular();
  const key = SP.sig + '|' + SP.rows.length + '|' + JSON.stringify(D.spenden.grenze || {}) + '|' + S.sel.join() + '|' + S.mode + '|' + (S.md || []).join('.') + '|' + S.sx + '|' + S.grp + '|' + _jvPay.key + '|' + regK.size + '|' + JSON.stringify(D.spenden.sdaNein || {});
  const hit = _jvC.get(key); if (hit && hit.rows === SP.rows) return hit.val;
  const okG = r => S.grp === 'alle' || (P.by.get(P.pidOf.get(jvDonor(r))).typ === 'i') === (S.grp === 'inst');   // Gruppe: alle, nur Privat, nur Institutionen
  const isDA = r => spIsDA(r) || regK.has(r.k);                     // Dauerauftrag laut Buchungstext oder regelmäßig erkannt
  const byY = new Map(); for (const r of SP.rows) { if (!okG(r)) continue; const y = ymd(r.d)[0]; if (!byY.has(y)) byY.set(y, []); byY.get(y).push(r); }
  const inZ = r => { if (S.mode !== 'stich') return true; const [, m, d] = ymd(r.d); return m < S.md[0] || (m === S.md[0] && d <= S.md[1]); };
  const yRows = y => { const g = S.sx ? null : spjGrenze(y); return (byY.get(y) || []).filter(r => (g == null || r.b <= g) && inZ(r)); };   // mit Sondereffekten, wenn eingerechnet
  const ys = [...byY.keys()].sort((a, b) => a - b), Y = new Map();
  const lastY = new Map(); for (const r of SP.rows) { const y = ymd(r.d)[0]; if (!(lastY.get(y) >= r.d)) lastY.set(y, r.d); }   // vollständig = Buchungen bis Mitte Dezember eingelesen
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
    const amt = rows.map(r => r.b).sort((a, b) => a - b), mid = amt.length >> 1, med = amt.length ? (amt.length % 2 ? amt[mid] : (amt[mid - 1] + amt[mid]) / 2) : null;   // Median je Spende
    const ds = [...don.values()].map(v => v.sum).sort((a, b) => b - a), topK = Math.max(1, Math.round(ds.length / 10)), top10 = sum > 0 ? ds.slice(0, topK).reduce((t, v) => t + v, 0) / sum : null;   // Anteil der größten 10 %
    const yr = S.sx ? all : noOut, fullSum = yr.reduce((t, r) => t + r.b, 0), stSum = S.md ? yr.filter(r => jvMd(r.d, S.md)).reduce((t, r) => t + r.b, 0) : fullSum;   // ganzes Jahr / bis Stichtag (Hochrechnung)
    Y.set(y, { y, rows, noOut, sum, n: rows.length, don: don.size, avg: rows.length ? sum / rows.length : null, med, top10, topK, neu, dauer: da.size, daSum, daMon: da.size ? mon / da.size : null,
      daStart: prev ? prev.size : null, daPlus: plus, daMinus: minus, daReg: [...da.keys()].filter(k => !daTxt.has(k)).length, seg, kt, all, out, outAll, donors: don, bind,
      fullSum, stSum, complete: (lastY.get(y) || 0) >= mkdn(y, 12, 15), has: all.length > 0 });
  }
  Y.byY = byY; Y.inZ = inZ; Y.isDA = isDA;                           // für „Wer fehlt noch?“
  _jvC.delete(key); _jvC.set(key, { rows: SP.rows, val: Y }); if (_jvC.size > 4) _jvC.delete(_jvC.keys().next().value);
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
// Pfeil und Klasse: kleine Veränderungen (unter 5 %, bei Anteilen unter 2 Prozentpunkten) ohne Farbe
const jvArrow = (d, pp) => [Math.abs(d) < 0.05 ? 'jv-eq' : Math.abs(d) < (pp ? 2 : 5) ? 'jv-sm' : d > 0 ? 'jv-up' : 'jv-dn', d >= 0.05 ? '▲ ' : d <= -0.05 ? '▼ ' : '■ ', d >= 0.05 ? '+' : d <= -0.05 ? '−' : '±'];
const jvPct = d => num1(Math.abs(d) < 0.05 ? 0 : Math.abs(d)) + ' %';
const jvPctS = (d, sg) => d >= 900 ? '×' + de0(1 + d / 100) : sg + jvPct(d);   // ab +900 % als Faktor
const jvGap = (S, i) => i > 0 && S.sel[i - 1] !== S.sel[i] - 1 ? S.sel[i - 1] : null;   // Vergleich über eine Lücke: mit welchem Jahr
// Veränderung von a (Vergleich) zu b: Pfeil + Prozent; pp: Anteile (0–1) → Prozentpunkte; inv: Zunahme ist schlecht (rot); ab dem Zehnfachen als Faktor
function jvDEl(a, b, o = {}) {
  if (a == null || b == null) return h('span', { class: 'jv-d jv-eq' }, '–');
  if (!o.pp && !a) return h('span', { class: 'jv-d muted' }, b ? 'neu' : '–');
  const d = o.pp ? (b - a) * 100 : (b / a - 1) * 100; let [c, ar, sg] = jvArrow(d, o.pp);
  if (o.inv) c = c === 'jv-up' ? 'jv-dn' : c === 'jv-dn' ? 'jv-up' : c;
  return h('span', { class: 'jv-d ' + c }, ar + (!o.pp && d >= 900 ? '×' + de0(b / a) : sg + num1(Math.abs(d) < 0.05 ? 0 : Math.abs(d)) + (o.pp ? ' Pkt.' : ' %')));
}
// Mini-Verlauf über die gewählten Jahre; im Tabellenkopf stehen die Jahre genau über den Punkten
const JV_SPW = 132, jvSpx = (n, i) => n < 2 ? JV_SPW / 2 : 12 + i * (JV_SPW - 24) / (n - 1);
function jvSparkHead(S) {
  const s = sv('svg', { width: JV_SPW, height: 14, class: 'jv-sph', 'aria-hidden': 'true' });
  S.sel.forEach((y, i) => s.append(sv('text', { x: jvSpx(S.sel.length, i), y: 11, 'text-anchor': 'middle', class: y === S.H ? 'on' : null }, '’' + String(y).slice(2)))); return s;
}
function jvSpark(S, vals, fmt) {
  const Hh = 26, n = vals.length, ok = vals.filter(v => v != null), s = sv('svg', { width: JV_SPW, height: Hh, class: 'jv-spk', role: 'img' });
  if (!ok.length) return s;
  const mn = Math.min(...ok), mx = Math.max(...ok), py = v => Hh - 5 - (mx > mn ? (v - mn) / (mx - mn) : 0.5) * (Hh - 10);
  vals.forEach((v, i) => s.append(sv('line', { x1: jvSpx(n, i), x2: jvSpx(n, i), y1: 2, y2: Hh - 2, class: 'jv-spg' })));
  const pts = vals.map((v, i) => v == null ? null : jvSpx(n, i).toFixed(1) + ',' + py(v).toFixed(1)).filter(Boolean);
  if (pts.length > 1) s.append(sv('polyline', { points: pts.join(' '), class: 'jv-spl' }));
  vals.forEach((v, i) => { if (v != null) s.append(sv('circle', { cx: jvSpx(n, i), cy: py(v), r: S.sel[i] === S.H ? 4 : 2.6, fill: S.col(S.sel[i]), class: 'jv-spd' })); });
  if (fmt) setTip(s, () => h('div', null, S.sel.map((y, i) => h('div', { class: 'jv-tipr' }, h('span', { class: 'jv-ln', style: { background: S.col(y) } }), y + ': ' + (vals[i] == null ? '–' : fmt(vals[i]))))));
  return s;
}
// Auswahl Alle / Privat / Institutionen als Knopfgruppe
const jvSegc = (cur, set, cls = '') => h('span', { class: 'segc jv-segc ' + cls, role: 'group' }, JV_GRPS.map(([v, t]) => h('button', { class: v === cur ? 'on' : '', 'aria-pressed': String(v === cur), dataset: { g: v }, onclick: e => { e.stopPropagation(); set(v); } }, t)));

// Säulen je Jahr: oben die Zahl, darunter Pfeil (grün/rot) und Veränderung zum Jahr davor („ggü. JJJJ“, wenn das Vorjahr fehlt), dann die Säule, unten das Jahr – feste Breite, mittig
// sub: je Jahr [Zugänge, Abgänge] als eigene Zeile unter der Veränderung (Dauerspender:innen)
function jvLadder(S, vals, fmt, focus = null, sub = null, pp = false, est = null) {
  const n = vals.length, gaps = vals.map((v, i) => v != null && vals[i - 1] != null && (pp || vals[i - 1]) ? jvGap(S, i) : null), anyGap = gaps.some(g => g != null);
  const w = 380, bh = 54, yGap = 39, ySub = anyGap ? 53 : 42, top = 36 + (anyGap ? 12 : 0) + (sub ? 14 : 0), hgt = top + bh + 20, slot = w / 4, bw = 64, x0 = (w - n * slot) / 2 + (slot - bw) / 2;
  const mx = Math.max(1, ...vals.filter(v => v != null)) * 1.02, s = sv('svg', { viewBox: '0 0 ' + w + ' ' + hgt, class: 'jv-lad', role: 'img' });
  vals.forEach((v, i) => { const x = x0 + i * slot, cx = x + bw / 2, y = S.sel[i];
    s.append(sv('text', { x: cx, y: 12, 'text-anchor': 'middle', class: 'jv-lv' }, v == null ? '–' : (y === est ? '≈ ' : '') + fmt(v)));
    const d = i ? (pp ? (v == null || vals[i - 1] == null ? null : (v - vals[i - 1]) * 100) : jvDelta(v, vals[i - 1])) : null;   // pp: Veränderung in Prozentpunkten
    if (d != null) { const [c, a, sg] = jvArrow(d, pp); s.append(sv('text', { x: cx, y: 27, 'text-anchor': 'middle', class: 'jv-ld' }, sv('tspan', { class: c }, a), pp ? sg + num1(Math.abs(d) < 0.05 ? 0 : Math.abs(d)) + ' Pkt.' : jvPctS(d, sg))); }
    if (d != null && gaps[i] != null) s.append(sv('text', { x: cx, y: yGap, 'text-anchor': 'middle', class: 'jv-lg' }, 'ggü. ' + gaps[i]));
    if (sub && sub[i]) s.append(sv('text', { x: cx, y: ySub, 'text-anchor': 'middle', class: 'jv-ld' }, sv('tspan', { class: 'jv-zu' }, '+' + de0(sub[i][0])), '  ', sv('tspan', { class: 'jv-ab' }, '−' + de0(sub[i][1]))));
    if (v != null) { const hh = Math.max(2, v / mx * bh), e = y === est;                // est: hochgerechnet – blass mit gestricheltem Rand
      s.append(sv('rect', { x, y: top + bh - hh, width: bw, height: hh, rx: 3, fill: S.col(y), class: e ? 'jv-est' : null, stroke: e ? S.col(y) : null, style: focus != null && focus !== y ? 'fill: ' + jvMix(S.col(y), 30) : null })); }
    s.append(sv('text', { x: cx, y: top + bh + 15, 'text-anchor': 'middle', class: 'sp-ax jv-ly' }, String(y))); });
  return s;
}
// Kachel: Kopf (grau abgesetzt) mit Titel und Zahl des Hauptjahres, darunter weiß die Säulen je Jahr
function jvTile(S, t, vals, fmt, big, o = {}) {
  const v = 'bigv' in o ? o.bigv : vals[vals.length - 1];
  return h('div', { class: 'jv-kpi', dataset: o.k ? { k: o.k } : {} },
    h('div', { class: 'jv-kh', tip: o.tip || null }, h('div', { class: 'jv-kt' }, t), h('div', { class: 'jv-kv' }, v == null ? '–' : big(v), o.kvs ? h('span', { class: 'jv-kvs' }, o.kvs) : null),
      o.hide ? h('button', { class: 'jv-kx', 'aria-label': t + ' ausblenden', tip: 'Kennzahl ausblenden – über „Bausteine“ wieder einblenden', onclick: o.hide }, '×') : null),
    h('div', { class: 'jv-kd' }, jvLadder(S, vals, fmt, null, o.sub, o.pp, o.est), o.note ? h('div', { class: 'jv-kn' }, o.note) : null));
}
const jvGrid = (cls, kids) => h('div', { class: cls + ' c' + (kids.length === 4 ? 2 : Math.min(3, kids.length)) }, kids);
const jvStich = S => S.md ? p2(S.md[1]) + '.' + p2(S.md[0]) + '.' : '';
const jvMd = (d, md) => { const [, m, t] = ymd(d); return m < md[0] || (m === md[0] && t <= md[1]); };   // bis Monat/Tag
const jvInZ = (S, d) => { if (S.mode !== 'stich') return true; const [, m, t] = ymd(d); return m < S.md[0] || (m === S.md[0] && t <= S.md[1]); };

/* ---------- Leiste: Jahre, Hauptjahr, Vergleichsjahr, Zeitraum, Spender:innen, Sondereffekte (aufklappbar), Bausteine, PDF */
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
      k === 'kpi' ? h('div', { class: 'jv-bsub' }, JV_KPIS.map(([kk, tt]) => h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: jvKShown(kk), onchange: e => setHide('jvKHide', kk, e.target.checked) }), tt))) : null]));
  let bb = null;
  bb = h('button', { class: 'jv-bbtn', onclick: e => { e.stopPropagation(); popover(bb, blocks()); } }, 'Bausteine ▾');
  const zeit = h('select', { class: 'jv-zeit', 'aria-label': 'Zeitraum', onchange: e => { UI.jvZeit = e.target.value; renderNow(); } },
    S.md ? h('option', { value: 'stich', selected: S.mode === 'stich' }, 'bis Stichtag ' + jvStich(S) + ' (letzte Buchung ' + S.H + ')') : null,
    h('option', { value: 'jahr', selected: S.mode === 'jahr' }, 'ganzes Jahr'));
  const hj = h('select', { class: 'jv-hj', 'aria-label': 'Hauptjahr', onchange: e => { UI.year = +e.target.value; renderNow(); } },
    [...new Set([...S.all].concat(S.H))].sort((a, b) => b - a).map(y => h('option', { value: y, selected: y === S.H }, y)));
  const sxMode = h('select', { class: 'jv-sxmode', 'aria-label': 'Sondereffekte', onchange: e => { UI.jvSxIn = e.target.value === 'in'; renderNow(); } },
    h('option', { value: 'out', selected: !S.sx }, 'herausrechnen'), h('option', { value: 'in', selected: S.sx }, 'einrechnen'));
  const grp = jvSegc(S.grp, v => { UI.jvGrp = v; hideTip(); renderNow(); }, 'jv-grp');
  const pdf = h('button', { class: 'jv-pdf', tip: 'je Abschnitt eine Seite – so wie hier eingestellt', onclick: () => jvPrintPDF() }, 'PDF für die Präsentation');
  const how = h('button', { class: 'link small jv-howto', onclick: () => jvHowto() }, 'So wird gerechnet');
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
    h('td', null, fmtD(e.rec.d)), h('td', { class: 'num' }, h('b', null, eur0(e.rec.b))), h('td', { class: 'jv-sxn' }, e.rec.name || '–'),
    h('td', { class: 'jv-sxz', tip: e.rec.zweck || null }, e.rec.zweck || '–'), h('td', { class: 'muted' }, spGlied(e.rec.konto)), h('td', { class: 'muted small' }, after(e.rec) ? 'nach dem Stichtag' : null))));
  const sxBtn = h('button', { class: 'jv-sxbtn' + (UI.jvSx ? ' on' : ''), 'aria-expanded': String(!!UI.jvSx), tip: 'Große Einzelfälle wie Erbschaften: Grenze je Jahr, herausrechnen oder einrechnen', onclick: () => { UI.jvSx = !UI.jvSx; renderNow(); } },
    'Sondereffekte ', h('b', { class: tot ? 'jv-aus' : 'muted' }, tot ? tot + ' ' + (S.sx ? 'eingerechnet' : 'herausgerechnet') : 'keine'), UI.jvSx ? ' ▴' : ' ▾');
  return [h('div', { class: 'jv-bar' },
    h('div', { class: 'jv-row' }, h('span', { class: 'spj-lbl' }, 'Jahre'), S.cand.map(chip),
      h('span', { class: 'spj-lbl jv-gap' }, 'Hauptjahr'), hj, h('span', { class: 'spj-lbl jv-gap' }, 'Zeitraum'), zeit,
      h('span', { class: 'jv-grpw' }, h('span', { class: 'spj-lbl jv-gap' }, 'Spender:innen'), grp), sxBtn, h('span', { class: 'jv-right' }, how, bb, pdf)),
    UI.jvSx ? h('div', { class: 'jv-row jv-sxp' }, h('span', { class: 'spj-lbl' }, 'Grenze je Jahr'), outs.map(grenze), h('span', { class: 'jv-sxmw' }, sxMode)) : null),
    UI.jvSx && tot ? h('div', { class: 'jv-row jv-sxl' }, h('span', { class: 'spj-lbl' }, S.sx ? 'Eingerechnet' : 'Herausgerechnet'),
      h('div', { class: 'jv-sxw' }, h('table', { class: 'jv-sxt' }, h('tbody', null, rows)),
        outs.some(o => o.aus.length > MAXR) ? h('button', { class: 'link small jv-sxm', onclick: () => { JV.sxAll = !JV.sxAll; renderNow(); } }, JV.sxAll ? 'weniger anzeigen' : 'alle ' + tot + ' anzeigen') : null)) : null];
}
function jvHowto() {
  modal('So wird gerechnet', h('div', { class: 'jv-howb' }, JV_BLOCKS.filter(([k]) => JV_INFO[k]).map(([k, t]) => h('div', { class: 'jv-hw' }, h('h4', { class: 'jv-h4' }, t), h('p', null, JV_INFO[k])))),
    [['Schließen', true, 'primary']], { wide: true, cls: 'jv-howto-m' });
}

/* ---------- Auf einen Blick: vier Zahlen und die Zweckbindung */
// Zweckbindung je Jahr: zweckgebunden = alles, was zu einem Zweck gehört (auch „zu klären“ – passt zu mehreren Zwecken), zweckungebunden = passt zu keinem
const jvZb = (Z, y) => { const m = Z.get(y); if (!m) return null; let tot = 0; for (const v of m.values()) tot += v; const frei = m.get(SPJ_FREI) || 0; return tot > 0 ? { tot, frei, zg: tot - frei, p: (tot - frei) / tot } : null; };
function jvZbTile(S, Y, A, bis) {
  const head = h('div', { class: 'jv-gtt' }, 'Zweckbindung' + bis);
  if (!D.zwecke.length) return h('div', { class: 'jv-gt jv-gtz', dataset: { k: 'zweck' } }, head, h('div', { class: 'jv-gts muted' }, 'Noch keine Zwecke angelegt – unter „' + spjName(S.H) + '“ festlegen.'));
  const Z = jvZwecke(S, Y), z = jvZb(Z, S.H), za = A ? jvZb(Z, A.y) : null;
  if (!z) return h('div', { class: 'jv-gt jv-gtz', dataset: { k: 'zweck' } }, head, h('div', { class: 'jv-gtv' }, '–'));
  const pc = v => v > 0 && v < 0.01 ? '< 1 %' : de0(v * 100) + ' %', pZ = Math.round(z.p * 100), pcs = [z.p > 0 && z.p < 0.01 ? '< 1 %' : pZ + ' %', z.p < 1 && z.p > 0.99 ? '< 1 %' : (100 - pZ) + ' %'];   // die beiden Anteile ergeben 100 %
  const part = (cls, t, v, p, lab) => h('span', { class: 'jv-zbp ' + cls, style: { flexGrow: String(p), flexBasis: '0' }, tip: () => h('div', null, h('b', null, t + ' ' + S.H), h('div', null, eur0(v) + ' · ' + lab)) }, p >= 0.12 ? lab : '');
  return h('div', { class: 'jv-gt jv-gtz', dataset: { k: 'zweck' } }, head,
    h('div', { class: 'jv-zbn' }, h('div', null, h('span', null, h('i', { class: 'zg' }), 'zweckgebunden'), h('b', null, eur0(z.zg))), h('div', { class: 'r' }, h('span', null, h('i', { class: 'zf' }), 'zweckungebunden'), h('b', null, eur0(z.frei)))),
    h('div', { class: 'jv-zb', role: 'img', 'aria-label': 'zweckgebunden ' + pcs[0] + ', zweckungebunden ' + pcs[1] }, z.zg ? part('zg', 'zweckgebunden', z.zg, z.p, pcs[0]) : null, z.frei ? part('zf', 'zweckungebunden', z.frei, 1 - z.p, pcs[1]) : null),
    h('div', { class: 'jv-gts' }, za ? [jvDEl(za.p, z.p, { pp: true }), h('span', { class: 'muted' }, ' ' + A.y + ': ' + pc(za.p) + ' zweckgebunden')] : null));
}
function jvBlick(S, Y) {
  const H = Y.get(S.H) || {}, A0 = S.cmp != null ? Y.get(S.cmp) : null, A = A0 && A0.has ? A0 : null, P = jvProj(S, Y), z = jvZielV(S), bis = S.mode === 'stich' ? ' bis ' + jvStich(S) : '', r100 = v => v >= 1e6 ? Math.round(v / 10000) * 10000 : v;   // ab 10.000 € auf 100 € gerundet
  const vs = (a, b, fmt) => A ? [jvDEl(a, b), h('span', { class: 'muted' }, ' ' + A.y + ': ' + (a == null ? '–' : fmt(a)))] : null;
  const tile = (k, t, v, sub) => h('div', { class: 'jv-gt', dataset: { k } }, h('div', { class: 'jv-gtt' }, t), h('div', { class: 'jv-gtv' }, v), h('div', { class: 'jv-gts' }, sub));
  return [h('div', { class: 'jv-glance' },
    tile('sum', 'Spendensumme' + bis, eur0(H.sum || 0), vs(A && A.sum, H.sum, eur0)),
    P ? tile('proj', 'Hochrechnung 31.12.', '≈ ' + eur0(r100(P.main)), z ? de0(P.main / z * 100) + ' % vom Ziel ' + eur0(z) : 'noch kein Jahresziel')
      : tile('ziel', 'Jahresziel ' + S.H, z ? de0((H.fullSum || 0) / z * 100) + ' %' : '–', z ? eur0(H.fullSum || 0) + ' von ' + eur0(z) : 'noch kein Jahresziel'),
    tile('don', 'Spender:innen', de0(H.don || 0), vs(A && A.don, H.don, de0)),
    tile('avg', 'Ø je Spende', H.avg == null ? '–' : eur(H.avg), vs(A && A.avg, H.avg, eur)), jvZbTile(S, Y, A, bis))];
}

/* ---------- Kennzahlen als Tabelle: Vergleichsjahr, Hauptjahr, Veränderung, Verlauf über die gewählten Jahre */
function jvKpis(S, Y) {
  const int = v => de0(v), pct = v => num1(v * 100) + ' %';
  const def = { sum: [o => o.sum, eur0], don: [o => o.don, int], avg: [o => o.avg, eur], med: [o => o.med, eur], top: [o => o.top10, pct, true], n: [o => o.n, int], neu: [o => o.neu, int], dauer: [o => o.dauer, int] };
  const ks = JV_KPIS.filter(([k]) => jvKShown(k));
  if (!ks.length) return h('p', { class: 'muted small' }, 'Alle Kennzahlen ausgeblendet – über „Bausteine“ wieder einblenden.');
  const A = S.cmp != null ? Y.get(S.cmp) : null, H = Y.get(S.H) || {}, cmp = !!(A && A.has);
  return h('table', { class: 'jv-it jv-kt' }, h('thead', null, h('tr', null, h('th', null, S.mode === 'stich' ? 'bis ' + jvStich(S) : 'ganzes Jahr'), cmp ? h('th', { class: 'num' }, String(S.cmp)) : null, h('th', { class: 'num' }, String(S.H)),
      cmp ? h('th', { class: 'num' }, 'Veränderung') : null, h('th', { class: 'jv-spc' }, jvSparkHead(S)))),
    h('tbody', null, ks.map(([k, t]) => { const [f, fmt, pp] = def[k], a = cmp ? f(A) : null, b = H.has ? f(H) : null;
      return h('tr', { dataset: { k } }, h('td', { class: 'jv-kn' }, k === 'neu' ? 'Erstmals seit ' + Math.min(...S.all) : t), cmp ? h('td', { class: 'num muted' }, a == null ? '–' : fmt(a)) : null,
        h('td', { class: 'num' }, h('b', null, b == null ? '–' : fmt(b))), cmp ? h('td', { class: 'num' }, jvDEl(a, b, { pp })) : null, h('td', { class: 'jv-spc' }, jvSpark(S, jvVals(S, Y, f), fmt))); })));
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
  const q = JV.q, sx = jvSxOn(S, Y), dim = qq => q != null && qq !== q;
  const qRows = (y, qq) => jvQSrc(Y, y).filter(r => jvQOf(r.d) === qq), qOut = (y, qq) => jvSum(((Y.get(y) || {}).out || []).filter(r => jvQOf(r.d) === qq));
  const dSm = (d, gy) => { if (d == null) return null; const [c, ar, sg] = jvArrow(d); return h('div', { class: 'jv-qd' }, h('span', { class: c }, ar), h('span', { class: c === 'jv-up' || c === 'jv-dn' ? c : '' }, jvPctS(d, sg)), gy != null ? h('span', { class: 'jv-qg' }, ' ggü. ' + gy) : null); };
  // Sondereffekte je Quartal – alle des Jahres; die nach dem Stichtag stehen nur zur Information da
  const sxItem = r => { const y = ymd(r.d)[0], late = !jvInZ(S, r.d);
    return h('div', { class: 'jv-qsxi' + (late ? ' late' : ''), tip: () => h('div', null, h('b', null, fmtD(r.d) + ' · ' + eur(r.b)), h('div', null, r.name || '–'), r.zweck ? h('div', { class: 'small' }, r.zweck) : null, h('div', { class: 'muted small' }, spGlied(r.konto)),
        late ? h('div', { class: 'muted small' }, 'nach dem Stichtag ' + jvStich(S) + ' – zählt im Vergleich nicht') : null) },
      h('span', { class: 'dot', style: { background: S.col(y) } }), h('b', null, y), ' ', h('span', { class: 'jv-qsxb' }, eur0(r.b)), h('div', { class: 'muted' }, fmtS(r.d) + (late ? ' · nach dem Stichtag' : r.zweck ? ' · ' + r.zweck : ''))); };
  const sxL = sx ? h('div', { class: 'jv-qsx' }, [0, 1, 2, 3].map(qq => { const L = S.sel.flatMap(y => ((Y.get(y) || {}).outAll || []).filter(r => jvQOf(r.d) === qq));
    return h('div', { class: 'jv-qsxc' + (qq === q ? ' on' : '') + (dim(qq) ? ' dim' : '') }, L.length ? L.map(sxItem) : h('span', { class: 'muted' }, '–')); })) : null;
  // Quartale in Zahlen – Spalten genau unter den Quartalen; ganz rechts die Summe; Veränderung zum Jahr davor
  const qc = qq => (qq === q ? ' on' : '') + (dim(qq) ? ' dim' : '');
  const cell = (y, i, qq) => { if (!jvQIn(S, qq)) return h('td', { class: 'num muted' + qc(qq) }, '–');
    const v = jvSum(qRows(y, qq)), p = i ? jvSum(qRows(S.sel[i - 1], qq)) : null, o = sx ? qOut(y, qq) : 0;
    return h('td', { class: 'num' + qc(qq) }, h('div', { class: 'jv-qv' }, eur0(v)), i ? dSm(jvDelta(v, p), jvGap(S, i)) : null, o ? h('div', { class: 'jv-qo' }, 'inkl. ' + eur0(o) + ' Sondereffekte') : null); };
  const tot = y => jvSum(jvQSrc(Y, y));
  const yCell = (y, i) => { const v = tot(y), o = sx ? jvSum((Y.get(y) || {}).out || []) : 0;
    return h('td', { class: 'num jv-qy' + (q != null ? ' dim' : '') }, h('div', { class: 'jv-qv' }, eur0(v)), i ? dSm(jvDelta(v, tot(S.sel[i - 1])), jvGap(S, i)) : null, o ? h('div', { class: 'jv-qo' }, 'inkl. ' + eur0(o) + ' Sondereffekte') : null); };
  const num = h('table', { class: 'jv-qnum' }, h('colgroup', null, [0, 1, 2, 3, 4, 5].map(() => h('col'))),
    h('thead', null, h('tr', null, h('th', null, 'Quartale'), JV_QN.map((t, qq) => h('th', { class: 'num click' + qc(qq), tip: qq === q ? 'Auswahl aufheben' : jvQName(S, qq) + ' hervorheben', onclick: () => jvQPick(qq) }, jvQName(S, qq))),
      h('th', { class: 'num jv-qy' + (q != null ? ' dim' : '') }, 'Summe'))),
    h('tbody', null, S.sel.map((y, i) => h('tr', { class: y === S.H ? 'main' : '' }, h('th', null, h('span', { class: 'dot', style: { background: S.col(y) } }), String(y)),
      [0, 1, 2, 3].map(qq => cell(y, i, qq)), yCell(y, i)))));
  const qa = jvVp('qa'), qn = jvVp('qn'); if (!qa && !qn) return null;
  return h('div', { class: 'jv-qp' },
    h('div', { class: 'jv-qa' }, qa ? h('div', { class: 'sp-chart click', style: { height: '130px' }, dataset: { chart: 'jvqa' } }) : h('div', { class: 'jv-qal', dataset: { chart: 'jvqal' } }), sxL, qn ? num : null));
}
// Teile des Jahresverlaufs einzeln ein- und ausblenden (merkt sich jede Person selbst): Linie, Spenden pro Woche, Quartale als Säulen, Quartale in Zahlen; Maßnahmen als Punkte
const JV_VP = [['cum', 'Linie', 'Spendensumme seit 1. Januar, je Jahr eine Linie'], ['wk', 'Spenden pro Woche', 'Säulen je Woche im Hauptjahr: Einzelspenden und Daueraufträge'],
  ['qa', 'Quartale', 'Quartale als Säulen, die Jahre nebeneinander'], ['qn', 'Quartalszahlen', 'Quartale als Tabelle mit Veränderung zum Jahr davor'], ['ms', 'Maßnahmen', 'Maßnahmen des Hauptjahres als Punkte in ihrer Farbe (am PAL) – nur bereits verschickte']];
const jvVp = k => !(isObj(UI.jvVp) && UI.jvVp[k] === false);
const jvVpTools = () => h('span', { class: 'jv-vp' }, JV_VP.map(([k, t, tp]) => h('label', { class: 'check small' + (k === 'ms' ? ' jv-vpms' : ''), tip: tp, dataset: { vp: k } },
  h('input', { type: 'checkbox', checked: jvVp(k), onchange: e => { UI.jvVp = Object.assign({}, isObj(UI.jvVp) ? UI.jvVp : {}, { [k]: e.target.checked }); hideTip(); renderNow(); } }), t)));
// part: 'top' = Linie und Wochen, 'q' = Quartale (PDF auf zwei Seiten, wenn alles nicht auf eine passt)
function jvVerlauf(S, Y, part) {
  const cum = jvVp('cum') && part !== 'q', wk = jvVp('wk') && part !== 'q', q = part !== 'top' && (jvVp('qa') || jvVp('qn'));
  if (!cum && !wk && !q) return h('p', { class: 'muted small jv-vp0' }, 'Alle Teile ausgeblendet – oben rechts wieder einblenden.');
  const leg = cum || (q && jvVp('qa')) ? h('div', { class: 'sp-legend jv-leg' }, S.sel.map(y => h('button', { class: 'jv-legy' + (JV.focus === y ? ' on' : JV.focus != null ? ' dim' : ''), 'aria-pressed': String(JV.focus === y),
      tip: JV.focus === y ? 'Hervorhebung aufheben' : y + ' hervorheben', onclick: () => jvFocus(y) }, h('span', { class: 'jv-ln', style: { background: S.col(y) } }), y)),
    jvSxOn(S, Y) ? h('span', { class: 'jv-legsx' }, h('span', { class: 'jv-sxsw' }), 'Sondereffekt (eingerechnet)') : null) : null;
  return [leg, cum ? h('div', { class: 'sp-chart', style: { height: '250px' }, dataset: { chart: 'jvcum' } }) : null,
    wk ? h('div', { class: 'jv-wk' }, h('div', { class: 'sp-cht' }, h('b', null, 'Spenden pro Woche ' + S.H), ' ', h('span', { class: 'spj-key k1' }), h('span', { class: 'muted' }, ' Einzelspenden '), h('span', { class: 'spj-key k2' }), h('span', { class: 'muted' }, ' Daueraufträge')),
      h('div', { class: 'sp-chart', style: { height: '150px' }, dataset: { chart: 'jvwk' } })) : null,
    q ? jvQuarter(S, Y) : null];
}
// Maßnahmen des Hauptjahres als Punkte auf der Achse (wie unter „Spenden JJJJ“) – nur die schon verschickten (PAL bis heute bzw. bis zur letzten Buchung)
function jvPalMarks(svg, g, S, X) { const a = mkdn(S.H, 1, 1); spjPalMarks(svg, g, { a, b: Math.min(mkdn(S.H, 12, 31), Math.max(todayDn(), S.last || 0)) }, X); }

/* ---------- Mailings vergleichen: bis zu vier beliebige Maßnahmen (Farbe bleibt am Eintrag) */
// Vergleiche (UI.jvMv): { sets: [{ id, name, ms: [{ id, c }] }], on: gezeigte, cur: der bearbeitete } – merkt sich dieser Rechner
function jvMailDefault() { const by = spByM(); return C.ms.filter(x => x.pal != null && (by.get(x.id) || []).length).sort((a, b) => b.pal - a.pal).slice(0, 2).map((x, i) => ({ id: x.id, c: i })); }
function jvMv() {
  const v = isObj(UI.jvMv) ? UI.jvMv : {}, msOf = a => { const out = [], used = new Set();
    for (const e of Array.isArray(a) ? a : []) { if (!isObj(e) || typeof e.id !== 'string' || out.length >= JV_MAX_MAIL) continue; let c = Number.isInteger(e.c) && e.c >= 0 && e.c < JV_MAX_MAIL && !used.has(e.c) ? e.c : -1;
      if (c < 0) c = [...Array(JV_MAX_MAIL).keys()].find(k => !used.has(k)); used.add(c); out.push({ id: e.id, c }); }
    return out; };
  let sets = Array.isArray(v.sets) ? v.sets.filter(x => isObj(x) && typeof x.id === 'string' && x.id).map(x => ({ id: x.id, name: str(x.name).trim() || 'Vergleich', ms: msOf(x.ms) })) : [];
  if (!sets.length) sets = [{ id: 'v1', name: 'Vergleich 1', ms: Array.isArray(UI.jvMail) ? msOf(UI.jvMail) : jvMailDefault() }];   // bis 0.29: nur eine Auswahl
  const ids = new Set(sets.map(x => x.id)); let on = Array.isArray(v.on) ? v.on.filter(id => ids.has(id)) : []; if (!on.length) on = [sets[0].id];
  return { sets, on, cur: ids.has(v.cur) ? v.cur : on[0] };
}
const jvMvSet = fn => { const M = jvMv(); fn(M); UI.jvMv = { sets: M.sets, on: M.on, cur: M.cur }; hideTip(); renderNow(); };
// Linien der gezeigten Vergleiche: ein Vergleich – je Mailing eine eigene Farbe (bleibt am Eintrag); mehrere – je Vergleich eine Farbe, ältere Mailings heller
const JV_MCOL = ['var(--jvm1)', 'var(--jvm2)', 'var(--jvm3)', 'var(--jvm4)', 'var(--jvk4)', 'var(--jvk5)', 'var(--jvk6)', 'var(--jvk8)'], JV_MSH = [100, 70, 50, 38, 30, 25, 21, 18];
function jvMvLines(M = jvMv()) {
  const shown = M.sets.filter(x => M.on.includes(x.id)), multi = shown.length > 1, out = [];
  for (const set of shown) { const si = M.sets.indexOf(set), seen = new Set();
    const L = set.ms.filter(e => e.id && C.byId.has(e.id) && !seen.has(e.id) && seen.add(e.id)).map(e => Object.assign({ c: e.c }, jvMailStats(e.id))).filter(o => o.x).sort((a, b) => b.x.pal - a.x.pal);
    L.forEach((o, i) => out.push(Object.assign(o, { set, rank: i, col: multi ? (i ? jvMix(JV_MCOL[si % 4], JV_MSH[i] || 18) : JV_MCOL[si % 4]) : JV_MCOL[o.c % JV_MCOL.length] }))); }
  return out;
}
function jvMailStats(id) {
  const x = C.byId.get(id), list = spByM().get(id) || []; if (!x) return null;
  const s = spStats(x.m, list), sr = list.length ? spSeries(x.m, list) : null, tot = sr ? sr.cum[sr.cum.length - 1] : 0;
  let t80 = null; if (sr && tot > 0) { const i = sr.cum.findIndex(v => v >= tot * 0.8); t80 = i >= 0 ? i : null; }
  return { x, s, sr, t80 };
}
// PDF: je Vergleich (mit mindestens einer Maßnahme mit Spenden) ein Block; hgt = geschätzte Höhe in px
const JV_MPDF_H = 150;                                               // Höhe der Rücklauf-Grafik je Vergleich im PDF
function jvMailPdf(S) {
  const M = jvMv();
  return M.sets.map(x => { const L = jvMvLines(Object.assign({}, M, { on: [x.id] })); if (!L.some(o => o.sr)) return null;
    return { el: jvMails(S, true, x.id), hgt: 28 + JV_MPDF_H + 32 + L.length * 27 + (L.length > 1 ? 27 : 0) + 6 }; }).filter(Boolean);
}
function jvMails(S, pdf, only) {
  const M = only ? Object.assign({}, jvMv(), { on: [only], cur: only }) : jvMv(), cur = M.sets.find(x => x.id === M.cur) || M.sets[0], lines = jvMvLines(M), by = spByM(), multi = M.on.length > 1;
  const nm = o => o.x.m.name || '(ohne Namen)', e2 = v => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const colOf = id => { const l = lines.find(o => o.set.id === cur.id && o.x.id === id); return l ? l.col : 'var(--line2)'; };
  // links: Vergleiche (Klick auf den Namen = nur diesen zeigen, Kästchen = zusätzlich zeigen), darunter der gewählte zum Bearbeiten
  const chip = x => { const on = M.on.includes(x.id);
    return h('span', { class: 'jv-vchip' + (on ? ' on' : '') + (x.id === cur.id ? ' cur' : '') },
      h('input', { type: 'checkbox', class: 'jv-vchk', checked: on, 'aria-label': x.name + ' zusätzlich zeigen', tip: 'zusätzlich zeigen – mehrere Vergleiche gleichzeitig',
        onchange: e => jvMvSet(N => { if (e.target.checked) { if (!N.on.includes(x.id)) N.on.push(x.id); N.cur = x.id; } else { N.on = N.on.filter(k => k !== x.id); if (!N.on.length) N.on = [x.id]; if (N.cur === x.id) N.cur = N.on[0]; } }) }),
      h('button', { class: 'jv-vbtn', tip: 'nur diesen Vergleich zeigen', onclick: () => jvMvSet(N => { N.on = [x.id]; N.cur = x.id; }) }, x.name),
      M.sets.length > 1 ? h('button', { class: 'jv-vx', 'aria-label': x.name + ' löschen', tip: 'Vergleich löschen', onclick: () => delSet(x) }, '×') : null); };
  const setCur = fn => jvMvSet(N => fn(N.sets.find(x => x.id === cur.id), N));
  const free = x => [...Array(JV_MAX_MAIL).keys()].find(c => !x.ms.some(e => e.c === c));
  const opts = C.ms.filter(x => x.pal != null).sort((a, b) => b.pal - a.pal), years = [...new Set(opts.map(x => ymd(x.pal)[0]))];
  const row = (e, i) => h('div', { class: 'jv-mrow' }, h('span', { class: 'dot', style: { background: e.id ? colOf(e.id) : 'var(--line2)' } }),
    h('select', { class: 'jv-msel', 'aria-label': 'Maßnahme ' + (i + 1), onchange: ev => setCur(x => { x.ms[i] = { id: ev.target.value, c: e.c }; }) },
      h('option', { value: '', selected: !e.id, disabled: true }, 'Maßnahme wählen …'),
      years.map(y => h('optgroup', { label: String(y) }, opts.filter(x => ymd(x.pal)[0] === y).map(x => h('option', { value: x.id, selected: x.id === e.id }, (x.m.name || '(ohne Namen)') + ' · PAL ' + fmtS(x.pal) + ((by.get(x.id) || []).length ? '' : ' (noch keine Spenden)')))))),
    h('button', { class: 'sp-x', 'aria-label': 'entfernen', tip: 'aus dem Vergleich nehmen', onclick: () => setCur(x => { x.ms.splice(i, 1); }) }, '×'));
  const newSet = () => { let nid = null; jvMvSet(N => { nid = 'v' + Date.now().toString(36); N.sets.push({ id: nid, name: 'Vergleich ' + (N.sets.length + 1), ms: [{ id: '', c: 0 }] }); N.on = [nid]; N.cur = nid; });
    setTimeout(() => { const i = document.querySelector('.jv-vname'); if (i) { i.focus(); i.select(); } }, 0); };
  const delSet = d => modal('Vergleich löschen?', h('p', null, '„' + d.name + '“ wird gelöscht – die Maßnahmen selbst bleiben.'), [['Abbrechen', false], ['Löschen', true, 'primary']])
    .then(ok => { if (ok) jvMvSet(N => { N.sets = N.sets.filter(x => x.id !== d.id); N.on = N.on.filter(k => k !== d.id); if (!N.on.length) N.on = [N.sets[0].id]; if (!N.on.includes(N.cur)) N.cur = N.on[0]; }); });
  const left = pdf ? h('div', { class: 'jv-ml' }, M.sets.filter(x => M.on.includes(x.id)).map(x => h('div', { class: 'jv-vpdf' }, h('b', null, x.name),
      lines.filter(l => l.set === x).map(l => h('div', { class: 'jv-vpl' }, h('span', { class: 'dot', style: { background: l.col } }), ' ' + nm(l) + ' · PAL ' + fmtS(l.x.pal))))))
    : h('div', { class: 'jv-ml' },
      h('div', { class: 'jv-vchips' }, M.sets.map(chip), h('button', { class: 'link small jv-vnew', onclick: newSet }, '+ Neuer Vergleich')),
      h('div', { class: 'jv-vedit' },
        h('input', { class: 'jv-vname', value: cur.name, 'aria-label': 'Name des Vergleichs', onkeydown: e => { if (e.key === 'Enter') e.target.blur(); }, onchange: e => { const v = e.target.value.trim(); if (v) setCur(x => { x.name = v; }); } }),
        cur.ms.map(row),
        cur.ms.length < JV_MAX_MAIL ? h('button', { class: 'jv-madd', onclick: () => setCur(x => { x.ms.push({ id: '', c: free(x) }); }) }, '+ Maßnahme hinzufügen') : null));
  // rechts: Linien und Tabelle; bei mehreren Vergleichen je Vergleich eine Zwischenzeile; „Veränderung“: neuestes gegenüber dem vorigen Mailing
  const cols = [['Erlös', o => o.s.sum || null, eur0], ['Spenden', o => o.s.n || null, de0], ['Response', o => o.s.resp, v => num1(v) + ' %'], ['Ø je Spende', o => o.s.avg, eur0],
    ['Kosten', o => o.s.kos, v => de0(v) + ' €'], ['Erlös je 1 € Kosten', o => o.s.roi, e2], ['80 % da nach', o => o.t80, v => v + (v === 1 ? ' Tag' : ' Tagen')]];
  const dl = (A, B) => ([t, f]) => { const a = f(A), b = f(B);
    if (a == null || b == null) return h('td', { class: 'num' }, '–');
    if (t === 'Response') return h('td', { class: 'num' }, jvDEl(a / 100, b / 100, { pp: true }));
    if (t === '80 % da nach') return h('td', { class: 'num small' }, b === a ? 'gleich schnell' : Math.abs(b - a) + (Math.abs(b - a) === 1 ? ' Tag ' : ' Tage ') + (b < a ? 'schneller' : 'langsamer'));
    return h('td', { class: 'num' }, jvDEl(a, b)); };
  const body = [];
  for (const x of M.sets.filter(x => M.on.includes(x.id))) { const L = lines.filter(l => l.set === x);
    if (multi) body.push(h('tr', { class: 'jv-mgrp' }, h('td', { colspan: cols.length + 1 }, x.name)));
    for (const o of L) body.push(h('tr', null, h('td', { class: 'jv-in' }, h('span', { class: 'dot', style: { background: o.col } }), ' ' + nm(o)), cols.map(([, f, fmt]) => { const v = f(o); return h('td', { class: 'num' }, v == null ? '–' : fmt(v)); })));
    if (L.length > 1) body.push(h('tr', { class: 'jv-mdl' }, h('td', { class: 'muted', tip: nm(L[0]) + ' gegenüber ' + nm(L[1]) }, 'Veränderung'), cols.map(dl(L[1], L[0])))); }
  const tab = lines.length ? h('table', { class: 'jv-it jv-mtab' }, h('thead', null, h('tr', null, h('th', null, 'Maßnahme'), cols.map(([t]) => h('th', { class: 'num' }, t)))), h('tbody', null, body)) : null;
  if (only) return h('div', { class: 'jv-mset' }, h('h3', { class: 'jv-ph' }, cur.name), h('div', { class: 'sp-chart', style: { height: JV_MPDF_H + 'px' }, dataset: { chart: 'jvmail', set: only } }), tab);
  return h('div', { class: 'jv-mail' }, left,
    h('div', { class: 'jv-mr' }, lines.some(o => o.sr) ? h('div', { class: 'sp-chart', style: { height: '230px' }, dataset: { chart: 'jvmail' } }) : h('p', { class: 'muted small' }, 'Noch keine Maßnahme mit zugeordneten Spenden gewählt.'), tab));
}

/* ---------- Spendersegmente: je Jahr eine Zeile – links Anteil an den Spender:innen, rechts an der Spendensumme; Legende darunter */
function jvSegBig(o) { return o && o.has ? { n: o.seg[0].n + o.seg[1].n, sum: o.seg[0].sum + o.seg[1].sum } : null; }   // ab 1.000 €
function jvSeg(S, Y) {
  return [h('div', { class: 'sp-chart', style: { height: jvSegH(jvSegYears(S, Y).length) + 'px' }, dataset: { chart: 'jvseg' } }),
    h('div', { class: 'jv-seglg' }, JV_SEGA.map((i, j) => h('span', null, h('i', { style: { background: 'var(--jvs' + (j + 1) + ')' } }), JV_SEG[i])))];
}

/* ---------- Zwecke und Konten über die Jahre: Tabelle mit Hauptjahr, Veränderung und Mini-Verlauf (Jahre im Kopf) */
function jvZweckSer(S, Y) {
  const Z = jvZwecke(S, Y), val = id => S.sel.map(y => Y.get(y) && Y.get(y).has ? (Z.get(y).get(id) || 0) : null);
  return D.zwecke.map(z => ({ id: z.id, name: z.name || '(ohne Namen)', col: z.farbe || '#888' }))
    .concat({ id: SPJ_FREI, name: 'zweckungebunden', col: 'var(--faint)', mut: true }, S.sel.some(y => Z.get(y).get(SPJ_OFFEN)) ? { id: SPJ_OFFEN, name: 'zu klären', col: 'var(--warn)', mut: true } : [])
    .map(it => Object.assign(it, { vals: val(it.id) }));
}
function jvValTab(S, rows, extra) {
  const iH = S.sel.indexOf(S.H), iA = S.cmp != null ? S.sel.indexOf(S.cmp) : -1;
  return h('table', { class: 'jv-it jv-vt' }, h('thead', null, h('tr', null, h('th'), h('th', { class: 'num' }, String(S.H)), iA >= 0 ? h('th', { class: 'num' }, 'ggü. ' + S.cmp) : null, h('th', { class: 'jv-spc' }, jvSparkHead(S)), extra ? h('th') : null)),
    h('tbody', null, rows.map(r => h('tr', { class: r.mut ? 'mut' : '' }, h('td', { class: 'jv-in' }, h('span', { class: 'dot', style: { background: r.col } }), ' ' + r.name),
      h('td', { class: 'num' }, h('b', null, r.vals[iH] == null ? '–' : eur0(r.vals[iH]))), iA >= 0 ? h('td', { class: 'num' }, jvDEl(r.vals[iA], r.vals[iH])) : null,
      h('td', { class: 'jv-spc' }, jvSpark(S, r.vals, eur0)), extra ? h('td', { class: 'num' }, extra(r)) : null))));
}
function jvZweck(S, Y) {
  const iH = S.sel.indexOf(S.H), ser = jvZweckSer(S, Y).filter(s => s.vals.some(v => v));
  if (!ser.length) return h('p', { class: 'muted small' }, D.zwecke.length ? 'Keine Spenden im Zeitraum.' : 'Noch keine Spendenzwecke angelegt (unter „Spenden JJJJ“).');
  return jvValTab(S, ser.sort((a, b) => (a.mut ? 1 : 0) - (b.mut ? 1 : 0) || (b.vals[iH] || 0) - (a.vals[iH] || 0)));
}
function jvKonto(S, Y) {
  const L = jvKontoList(S, Y), set = nl => { UI.jvKonten = nl.map(e => ({ k: e.k, c: e.c })); hideTip(); renderNow(); };
  const rows = L.map((e, i) => ({ k: e.k, i, name: spGlied(e.k), col: 'var(--jvk' + (e.c + 1) + ')', vals: S.sel.map(y => Y.get(y) && Y.get(y).has ? (Y.get(y).kt.get(e.k) || 0) : null) }));
  if (!rows.length) return h('p', { class: 'muted small' }, 'Kein Konto gewählt.');
  return jvValTab(S, rows, r => h('button', { class: 'sp-x', 'aria-label': r.name + ' entfernen', tip: 'aus dem Vergleich nehmen', onclick: () => set(L.filter((_, j) => j !== r.i)) }, '×'));
}
function jvKontoTools(S, Y) {
  const L = jvKontoList(S, Y), set = nl => { UI.jvKonten = nl.map(e => ({ k: e.k, c: e.c })); hideTip(); renderNow(); };
  const tot = new Map(); for (const y of S.sel) { const o = Y.get(y); if (o) for (const [k, v] of o.kt) tot.set(k, (tot.get(k) || 0) + v); }
  const rest = [...tot].filter(([k]) => !L.some(e => e.k === k)).sort((a, b) => b[1] - a[1]);
  let add = null;
  add = L.length < JV_MAX_KONTO && rest.length ? h('button', { class: 'jv-madd small jv-kadd', onclick: e => { e.stopPropagation();
    popover(add, h('div', { class: 'jv-kpop' }, h('div', { class: 'menu-head' }, 'Konto hinzufügen'), rest.map(([k, v]) => h('button', { class: 'mitem', onclick: () => { closeMenu();
      set(L.concat({ k, c: [...Array(JV_MAX_KONTO).keys()].find(c => !L.some(x => x.c === c)) })); } }, h('span', null, spGlied(k)), h('span', { class: 'muted small' }, eur0(v)))))); } }, '+ Konto') : null;
  return [add, Array.isArray(UI.jvKonten) ? h('button', { class: 'link small jv-ktop', onclick: () => { UI.jvKonten = undefined; renderNow(); } }, 'die 5 größten') : null];
}

/* ---------- Dauerspender:innen: Anzahl (mit Zu- und Abgängen), Summe, Ø Monatsbeitrag – Hauptjahr gegenüber Vergleichsjahr */
function jvDauer(S, Y) {
  const H = Y.get(S.H) || {}, A0 = S.cmp != null ? Y.get(S.cmp) : null, A = A0 && A0.has ? A0 : null;
  const t = (k, ti, v, a, fmt, extra) => h('div', { class: 'jv-mt1', dataset: { k } }, h('div', { class: 'jv-mtt' }, ti), h('div', { class: 'jv-mtv' }, v == null ? '–' : fmt(v)),
    h('div', { class: 'jv-mts' }, A ? [jvDEl(a, v), h('span', { class: 'muted' }, ' · ' + A.y + ': ' + (a == null ? '–' : fmt(a)))] : null), extra || null);
  const flow = H.daStart != null ? h('div', { class: 'jv-flow' }, h('b', null, de0(H.daStart)), h('span', { class: 'muted' }, '→'), h('span', { class: 'jv-zut' }, '+' + de0(H.daPlus) + ' neu'),
    h('span', { class: 'jv-abt' }, '−' + de0(H.daMinus) + ' beendet'), h('span', { class: 'muted' }, '→'), h('b', null, de0(H.dauer || 0))) : null;
  const reg = jvRegOn() && H.daReg ? h('div', { class: 'jv-kvs' }, 'davon ' + de0(H.daReg) + ' an regelmäßigen Buchungen erkannt') : null;
  return h('div', { class: 'jv-mts3' },
    t('dauer', 'Dauerspender:innen', H.dauer, A ? A.dauer : null, de0, [flow, reg]),
    t('daSum', 'Summe aus Daueraufträgen', H.daSum, A ? A.daSum : null, eur0),
    t('daMon', 'Ø Monatsbeitrag', H.daMon, A ? A.daMon : null, eur));
}
function jvKontoList(S, Y) {
  let L = Array.isArray(UI.jvKonten) ? UI.jvKonten.filter(e => e && typeof e.k === 'string') : null;
  if (!L) {                                                          // anfangs die fünf größten Konten (Summe der gewählten Jahre)
    const tot = new Map(); for (const y of S.sel) { const o = Y.get(y); if (o) for (const [k, v] of o.kt) if (k) tot.set(k, (tot.get(k) || 0) + v); }
    L = [...tot].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k], i) => ({ k, c: i }));
  }
  return L;
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
  if (!jvBridgeData(S, Y)) return [h('p', { class: 'muted small' }, 'Für die Brücke braucht es oben ein Vergleichsjahr mit Daten.')];
  return [h('div', { class: 'sp-chart', style: { height: (6 * JV_BRH) + 'px' }, dataset: { chart: 'jvbr' } })];
}
// links je Stufe Personen und Betrag (Jahre mit Summe), rechts der Balken; Zeigen nennt die Stufe. Im PDF (kein Zeigen) steht die Stufe klein darüber
const JV_BRH = 30, jvPers = n => n === 1 ? '1 Person' : de0(n) + ' Personen';
function jvDrawBridge(el, S, Y) {
  const B = jvBridgeData(S, Y); if (!B) return;
  const pdf = !!el.closest('#printdoc'), rh = pdf ? 38 : JV_BRH, W = Math.max(260, Math.floor(+el.dataset.w || el.clientWidth));
  const svg = sv('svg', { width: W, height: 6 * rh, class: 'sp-svg', role: 'img' }); el.replaceChildren(svg); el.style.height = 6 * rh + 'px';
  const sg = v => (v >= 0 ? '+' : '−') + eur0(Math.abs(v));
  const steps = [['start', 'Summe ' + B.a.y, B.start, null, B.a.y + ' (' + eur0(B.start) + ')'], ['neu', 'neu / wieder dabei', B.neu.sum, B.neu], ['mehr', 'mehr gegeben', B.mehr.sum, B.mehr],
    ['weniger', 'weniger gegeben', -B.weniger.sum, B.weniger], ['aus', 'ausgeblieben', -B.aus.sum, B.aus], ['ende', 'Summe ' + B.b.y, B.end, null, B.b.y + ' (' + eur0(B.end) + ')']];
  let run = 0; const bars = steps.map(([k, t, v, o, yl]) => { let lo, hi; if (k === 'start' || k === 'ende') { lo = 0; hi = v; run = v; } else { lo = run; hi = run + v; run = hi; }
    return { k, t, v, o, lab: yl || jvPers(o.n) + ' (' + sg(v) + ')', lo: Math.min(lo, hi), hi: Math.max(lo, hi), end: run }; });
  const labs = bars.map((b, i) => { const t = sv('text', { x: 0, y: i * rh + (pdf && b.o ? 29 : rh / 2 + 4.5), class: 'jv-brt' + (b.o ? '' : ' y') }, b.lab); svg.append(t); return t; });
  const lw = Math.min(W * 0.5, Math.ceil(Math.max(...labs.map((t, i) => jvTW(t, (bars[i].o ? '400' : '700') + ' 12.5px')))) + 14), pw = W - lw - 6;
  const mx = Math.max(1, ...bars.map(b => b.hi)), X = v => lw + v / mx * pw, by = i => i * rh + (pdf ? 18 : (rh - 16) / 2), bh = pdf ? 14 : 16;
  bars.forEach((b, i) => {
    if (pdf && b.o) svg.append(sv('text', { x: 0, y: i * rh + 12, class: 'jv-brst' }, b.t));
    const fill = b.k === 'start' ? S.col(B.a.y) : b.k === 'ende' ? S.col(B.b.y) : b.v >= 0 ? 'var(--jvplus)' : 'var(--jvminus)';
    const g = sv('g', { class: 'jv-brrow' }), hit = sv('rect', { x: 0, y: i * rh, width: W, height: rh, class: 'jv-sghit' }), r = sv('rect', { x: X(b.lo), y: by(i), width: Math.max(1.5, X(b.hi) - X(b.lo)), height: bh, rx: 3, fill, class: 'jv-bar' });
    setTip(hit, b.t); setTip(r, b.t); g.append(hit, r); svg.insertBefore(g, labs[0]);
    if (i < bars.length - 1) { const xx = X(b.end); svg.insertBefore(sv('line', { x1: xx, x2: xx, y1: by(i) + bh, y2: by(i + 1), class: 'jv-brl' }), labs[0]); }
  });
}

/* ---------- Privat & Institutionen: Anteil je Jahr; Institutionen nach Art (aufklappbar, „→ privat“); Regeln im Dialog */
function jvHerkData(S) {
  const Y = jvData(Object.assign({}, S, { grp: 'alle' })), P = jvPayers(), out = new Map();
  for (const y of S.sel) { const o = Y.get(y), r = { has: !!(o && o.has), p: 0, i: 0, pn: new Set(), inn: new Set(), art: new Map() };
    if (r.has) for (const x of o.rows) { const pid = P.pidOf.get(jvDonor(x)), q = P.by.get(pid);
      if (q && q.typ === 'i') { r.i += x.b; r.inn.add(pid); let a = r.art.get(q.art); if (!a) r.art.set(q.art, a = { sum: 0, don: new Map() }); a.sum += x.b; const d = a.don.get(pid); if (d) d.sum += x.b; else a.don.set(pid, { sum: x.b, o: q }); }
      else { r.p += x.b; r.pn.add(pid); } }
    out.set(y, r); }
  return out;
}
function jvHerkunft(S, pdf) {
  const HD = jvHerkData(S), H = HD.get(S.H), A0 = S.cmp != null ? HD.get(S.cmp) : null, A = A0 && A0.has ? A0 : null;
  const ys = S.sel.filter(y => HD.get(y).has), mx = Math.max(1, ...ys.map(y => HD.get(y).p + HD.get(y).i)), W = 600, lab = 52, vw = 6, bw = W - lab - vw;
  const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + (ys.length * 40 + 4), class: 'jv-pis' + (UI.jvPiFull || pdf ? ' jv-full' : ''), role: 'img' });
  ys.forEach((y, k) => { const r = HD.get(y), tot = r.p + r.i, yy = 2 + k * 40, wp = r.p / mx * bw, wi = r.i / mx * bw;
    const row = sv('g', { class: 'jv-pirow ' + (y === S.H ? 'main' : 'old') }); svg.append(row);
    row.append(sv('rect', { x: 0, y: yy - 6, width: W, height: 38, class: 'jv-sghit' }), sv('text', { x: 0, y: yy + 18, class: 'jv-pisy' + (y === S.H ? ' on' : '') }, String(y)));
    const tip = () => h('div', null, h('b', null, String(y)), h('div', null, 'privat: ' + eur0(r.p) + ' · ' + spjWho(r.pn.size)), h('div', null, 'Institutionen: ' + eur0(r.i) + ' · ' + de0(r.inn.size)));
    const rp = sv('rect', { x: lab, y: yy, width: Math.max(0, wp - 1), height: 26, rx: 4, class: 'jv-pp' }), ri = sv('rect', { x: lab + wp + 1, y: yy, width: Math.max(0, wi - 1), height: 26, rx: 4, class: 'jv-pi' });
    setTip(rp, tip); setTip(ri, tip); row.append(rp, ri);
    if (tot && wp > 44) row.append(sv('text', { x: lab + 9, y: yy + 17.5, class: 'jv-pit' }, de0(r.p / tot * 100) + ' %'));
    if (tot && wi > 44) row.append(sv('text', { x: lab + wp + 9, y: yy + 17.5, class: 'jv-pit i' }, de0(r.i / tot * 100) + ' %')); });
  const left = h('div', { class: 'jv-pil' }, h('div', { class: 'jv-pikey' }, h('span', null, h('i', { class: 'p' }), 'Privat'), h('span', null, h('i', { class: 'i' }), 'Institutionen')), svg,
    H && H.has ? h('p', { class: 'jv-pin' }, 'Spender:innen ' + S.H + ': ', h('b', null, de0(H.pn.size) + ' privat'), ' · ', h('b', null, de0(H.inn.size) + ' Institutionen')) : null);
  // Institutionen nach Art
  const arts = jvArten().concat({ id: JV_SONST, t: 'sonstige Institutionen' }), val = (id, y) => { const r = HD.get(y); return r && r.has ? ((r.art.get(id) || {}).sum || 0) : null; };
  const used = arts.filter(a => S.sel.some(y => val(a.id, y))).sort((a, b) => (val(b.id, S.H) || 0) - (val(a.id, S.H) || 0));
  const rows = [];
  for (const a of used) {
    const open = !pdf && JV.artOpen.has(a.id), cH = H && H.art.get(a.id) ? H.art.get(a.id).don.size : 0;
    rows.push(h('tr', { class: 'jv-art' + (pdf ? '' : ' click') + (open ? ' open' : ''), dataset: { art: a.id }, onclick: pdf ? null : () => { if (JV.artOpen.has(a.id)) JV.artOpen.delete(a.id); else JV.artOpen.add(a.id); renderNow(); } },
      h('td', { class: 'jv-in' }, pdf ? null : h('span', { class: 'jv-chev' }, open ? '▾' : '▸'), a.t), h('td', { class: 'num' }, de0(cH)), h('td', { class: 'num' }, h('b', null, eur0(val(a.id, S.H) || 0))),
      A ? h('td', { class: 'num' }, jvDEl(val(a.id, S.cmp), val(a.id, S.H))) : null, h('td', { class: 'jv-spc' }, jvSpark(S, S.sel.map(y => val(a.id, y)), eur0))));
    if (open) { const L = H && H.art.get(a.id) ? [...H.art.get(a.id).don.values()].sort((x, z) => z.sum - x.sum) : [], Ad = A && A.art.get(a.id) ? A.art.get(a.id).don : new Map();
      for (const d of L) rows.push(h('tr', { class: 'jv-artm' }, h('td', { class: 'jv-in' }, d.o.name || '(ohne Namen)', ' ', d.o.hand ? h('span', { class: 'sp-tag' }, 'von Hand') : h('span', { class: 'muted small' }, d.o.why || '')),
        h('td'), h('td', { class: 'num' }, eur0(d.sum)), A ? h('td', { class: 'num muted' }, Ad.get(d.o.pid) ? eur0(Ad.get(d.o.pid).sum) : '–') : null,
        h('td', { class: 'jv-spc' }, h('button', { class: 'small jv-topriv', onclick: e => { e.stopPropagation(); jvSetTyp(d.o, 'p', (d.o.name || 'Zahler:in') + ' als privat eingestuft'); } }, '→ privat'))));
      if (!L.length) rows.push(h('tr', { class: 'jv-artm' }, h('td', { class: 'muted small', colspan: A ? 5 : 4 }, 'in ' + S.H + ' bisher keine'))); }
  }
  const right = used.length ? h('table', { class: 'jv-it jv-arts' }, h('thead', null, h('tr', null, h('th', null, 'Institutionen nach Art'), h('th', { class: 'num' }, 'Anzahl'), h('th', { class: 'num' }, String(S.H)),
      A ? h('th', { class: 'num' }, 'ggü. ' + S.cmp) : null, h('th', { class: 'jv-spc' }, jvSparkHead(S)))),
    h('tbody', null, rows, h('tr', { class: 'jv-artsum' }, h('td', null, 'zusammen'), h('td', { class: 'num' }, de0(H && H.has ? H.inn.size : 0)), h('td', { class: 'num' }, h('b', null, eur0(H && H.has ? H.i : 0))),
      A ? h('td', { class: 'num' }, jvDEl(A.i, H && H.has ? H.i : null)) : null, h('td', { class: 'jv-spc' }, jvSpark(S, S.sel.map(y => HD.get(y).has ? HD.get(y).i : null), eur0)))))
    : h('p', { class: 'muted small' }, 'Keine Institutionen erkannt – unter „Regeln ansehen und ändern“ lassen sich Stichwörter ergänzen.');
  return h('div', { class: 'jv-pi2' }, left, right);
}

/* ---------- Jahresziel & Hochrechnung */
// Hochrechnung bis 31.12.: Stand im Hauptjahr × (Jahressumme ÷ Summe bis zum Stichtag) eines vollständigen Vergleichsjahres; Spanne über alle gewählten vollständigen Jahre
function jvProj(S, Y) {
  const H = Y.get(S.H); if (!H || !H.has || !S.md || H.complete) return null;
  const ref = S.sel.filter(y => y < S.H).map(y => Y.get(y)).filter(o => o && o.has && o.complete && o.stSum > 0).map(o => ({ y: o.y, f: o.fullSum / o.stSum, st: o.stSum, full: o.fullSum }));
  if (!ref.length) return null;
  const base = ref.find(r => r.y === S.cmp) || ref[ref.length - 1], ist = H.fullSum, v = ref.map(r => ist * r.f);
  return { ist, main: ist * base.f, base, ref, lo: Math.min(...v), hi: Math.max(...v) };
}
const jvZielKey = S => S.H + (S.grp === 'privat' ? 'p' : S.grp === 'inst' ? 'i' : '');
const jvZielV = S => { const v = (D.spenden.ziel || {})[jvZielKey(S)]; return isNum(v) && v > 0 ? v : null; };
function jvSetZiel(S, c) {
  const k = jvZielKey(S); if ((jvZielV(S) || null) === (c || null)) return;
  commit(d => { const o = Object.assign({}, d.spenden.ziel); if (c) o[k] = c; else delete o[k]; if (Object.keys(o).length) d.spenden.ziel = o; else delete d.spenden.ziel; },
    'Jahresziel ' + S.H + (S.grp !== 'alle' ? ' (' + jvGrpName(S.grp) + ')' : '') + (c ? ': ' + eur0(c) : ' entfernt'));
}
const jvF2 = v => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function jvZielPop(anchor, S) {
  const z = jvZielV(S), inp = h('input', { class: 'jv-ziel', value: z ? (z / 100).toLocaleString('de-DE') : '', placeholder: 'z. B. 160.000', inputmode: 'decimal', 'aria-label': 'Jahresziel in Euro', 'data-fk': 'jv-ziel' });
  const save = () => { const v = inp.value.trim(), c = v ? spCents(v) : null; if (v && !(c > 0)) { toast('Bitte einen Betrag eingeben, z. B. 160.000'); return; } closeMenu(); jvSetZiel(S, c ? Math.round(c) : null); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  popover(anchor, h('div', { class: 'jv-zpop' }, h('div', { class: 'menu-head' }, 'Jahresziel ' + S.H + (S.grp !== 'alle' ? ' · ' + jvGrpName(S.grp) : '')),
    h('label', { class: 'jv-zin' }, inp, '€'),
    h('div', { class: 'jv-zpb' }, z ? h('button', { class: 'link small jv-zdel', onclick: () => { closeMenu(); jvSetZiel(S, null); } }, 'entfernen') : null, h('button', { class: 'primary small jv-zok', onclick: save }, 'Übernehmen'))));
  setTimeout(() => inp.focus(), 0);
}
function jvZielSec(S, Y, pdf) {
  const P = jvProj(S, Y), H = Y.get(S.H) || {}, z = jvZielV(S), ist = H.fullSum || 0, st = jvStich(S), f = P ? P.main / P.ist : null;
  const tip = P ? S.H + ' hochgerechnet – prozentual: Stand ' + st + ' ' + eur0(ist) + ' × ' + jvF2(f) + ' ≈ ' + eur0(P.main) + '. Der Faktor kommt aus ' + P.base.y + ': Jahressumme ' + eur0(P.base.full) + ' ÷ ' + eur0(P.base.st) + ' bis ' + st
      + (P.ref.length > 1 ? ' · Spanne ' + eur0(P.lo) + ' – ' + eur0(P.hi) + ' (je nach Vergleichsjahr)' : '')
    : 'Jahressumme der gewählten Jahre';
  let btn = null;
  btn = pdf ? null : h('button', { class: 'link small jv-zedit', onclick: e => { e.stopPropagation(); jvZielPop(btn, S); } }, z ? 'ändern' : '+ Jahresziel eintragen');
  const zl = z || btn ? h('div', { class: 'jv-zrow2' }, z ? [h('span', null, 'Jahresziel' + (S.grp !== 'alle' ? ' (' + jvGrpName(S.grp) + ')' : '') + ' '), h('b', null, eur0(z))] : null, btn) : null;
  return jvTile(S, P ? 'Jahressumme – ' + S.H + ' hochgerechnet' : 'Jahressumme', jvVals(S, Y, o => o.y === S.H && P ? P.main : o.fullSum), eur0, v => (P ? '≈ ' : '') + eur0(v),
    { k: 'proj', est: P ? S.H : null, tip, note: zl });
}

/* ---------- Größte Spender:innen: wie viel hängt an wenigen? */
function jvTop(S, Y, pdf) {
  const o = Y.get(S.H); if (!o || !o.has || !o.sum) return [h('p', { class: 'muted small' }, 'Im Hauptjahr keine Spenden im Zeitraum.')];
  let A = S.cmp != null ? Y.get(S.cmp) : null; if (A && !A.has) A = null;
  const pct = v => num1(v * 100) + ' %', L = [...o.donors.entries()].sort((a, b) => b[1].sum - a[1].sum), N = Math.min(L.length, JV.topAll ? 25 : 10), grp = S.grp === 'alle';
  const conc = h('div', { class: 'jv-conc' }, h('div', { class: 'a', style: { width: (o.top10 * 100).toFixed(1) + '%' } }, 'größte 10 % · ' + spjWho(o.topK) + ' · ' + pct(o.top10)),
    h('div', { class: 'b' }, 'übrige ' + de0(o.don - o.topK) + ' · ' + pct(1 - o.top10)));
  const rows = L.slice(0, N).map(([k, d], i) => { const a = A && A.donors.get(k);
    return h('tr', null, h('td', { class: 'num muted' }, (i + 1) + '.'), pdf ? null : h('td', { class: 'jv-in' }, d.last.name || '(ohne Namen)'),
      grp ? h('td', null, jvTypOf(d.last) === 'i' ? h('span', { class: 'sp-tag' }, 'Institution') : h('span', { class: 'muted small' }, 'privat')) : null,
      h('td', { class: 'num' }, h('b', null, eur0(d.sum))), A ? h('td', { class: 'num muted' }, a ? eur0(a.sum) : '–') : null,
      A ? h('td', { class: 'num' }, a ? jvDEl(a.sum, d.sum) : h('span', { class: 'muted' }, 'neu')) : null, h('td', { class: 'num' }, pct(d.sum / o.sum))); });
  return [conc, A && A.top10 != null ? h('p', { class: 'jv-topsum' }, A.y + ': die größten 10 % gaben ' + pct(A.top10) + '.') : null,
    h('table', { class: 'jv-it jv-top' }, h('thead', null, h('tr', null, h('th'), pdf ? null : h('th', null, 'Name'), grp ? h('th', null, 'Gruppe') : null, h('th', { class: 'num' }, String(S.H)),
      A ? h('th', { class: 'num' }, String(A.y)) : null, A ? h('th', { class: 'num' }, 'Veränderung') : null, h('th', { class: 'num' }, 'Anteil'))), h('tbody', null, rows)),
    !pdf && L.length > 10 ? h('button', { class: 'link small jv-tall', onclick: () => { JV.topAll = !JV.topAll; renderNow(); } }, JV.topAll ? 'nur die größten 10' : 'die größten 25 zeigen') : null];
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
  const H = (Y.get(S.H) || {}).bind, A0 = S.cmp != null ? Y.get(S.cmp) : null, A = A0 && A0.bind ? A0.bind : null, pct = v => num1(v * 100) + ' %';
  if (!H) return [h('p', { class: 'muted small' }, 'Für ' + (S.H - 1) + ' gibt es keine eingelesenen Buchungen.')];
  const t = (k, ti, f, fmt, o = {}) => { const v = f(H), a = A ? f(A) : null;
    return h('div', { class: 'jv-mt1', dataset: { k } }, h('div', { class: 'jv-mtt' }, ti), h('div', { class: 'jv-mtv' }, v == null ? '–' : fmt(v)),
      h('div', { class: 'jv-mts' }, A ? [jvDEl(a, v, o), h('span', { class: 'muted' }, ' · ' + S.cmp + ': ' + (a == null ? '–' : fmt(a)))] : null)); };
  const tiles = h('div', { class: 'jv-mts4' }, t('rate', 'Haltequote', x => x.rate, pct, { pp: true }), t('keep', 'Gehalten', x => x.keep, de0), t('react', 'Wieder dabei nach Pause', x => x.react, de0),
    t('lost', 'Nicht wieder gespendet', x => x.lost, de0, { inv: true }));
  // Wer fehlt noch? – anfangs bis zum Stichtag (passt dann zu „Nicht wieder gespendet“)
  const mode = UI.jvMiss === 'jahr' || (UI.jvMiss === 'stich' && S.mode === 'stich') ? UI.jvMiss : S.mode === 'stich' ? 'stich' : 'jahr', L = jvMissing(S, Y, mode);
  const ys = S.sel.filter(y => (Y.get(y) || {}).bind), yOpen = !!UI.jvBindY && ys.length > 1;
  const ybtn = !pdf && ys.length > 1 ? h('div', { class: 'jv-byh' }, h('button', { class: 'small jv-byopen', 'aria-expanded': String(yOpen), onclick: () => { UI.jvBindY = !yOpen; renderNow(); } }, yOpen ? 'Vorjahre ▾' : 'Vorjahre ▸')) : null;
  const ytab = yOpen ? h('table', { class: 'jv-it jv-byt' }, h('thead', null, h('tr', null, h('th'), h('th', { class: 'num' }, 'Haltequote'), h('th', { class: 'num' }, 'Gehalten'), h('th', { class: 'num' }, 'Wieder dabei nach Pause'),
      h('th', { class: 'num' }, 'Nicht wieder gespendet'), h('th', { class: 'num', tip: 'Spender:innen im Vorjahr (gleicher Zeitraum) – die Basis der Haltequote' }, 'Basis Vorjahr'))),
    h('tbody', null, ys.map(y => { const b = Y.get(y).bind;
      return h('tr', { class: y === S.H ? 'main' : '' }, h('th', null, h('span', { class: 'dot', style: { background: S.col(y) } }), String(y)), h('td', { class: 'num' }, b.rate == null ? '–' : pct(b.rate)),
        h('td', { class: 'num' }, de0(b.keep)), h('td', { class: 'num' }, de0(b.react)), h('td', { class: 'num' }, de0(b.lost)), h('td', { class: 'num muted' }, de0(b.prev))); }))) : null;
  if (!L) return [tiles, ybtn, ytab];
  const sum = L.reduce((s, o) => s + o.sum, 0);
  const head = h('div', { class: 'jv-missh' }, h('b', null, 'Wer fehlt noch?'), h('b', { class: 'jv-missn' }, spjWho(L.length) + ' · ' + eur0(sum)),
    pdf ? null : h('span', { class: 'jv-right' }, h('button', { class: 'small jv-mopen', 'aria-expanded': String(JV.missOpen), onclick: () => { JV.missOpen = !JV.missOpen; renderNow(); } }, JV.missOpen ? 'Liste ▾' : 'Liste ▸')));
  if (pdf || !JV.missOpen) return [tiles, ybtn, ytab, head];        // in der Präsentation keine Namen
  const MAX = 15, show = JV.missAll ? L : L.slice(0, MAX);
  const csvRows = () => [['Name', 'IBAN', 'Spenden ' + (S.H - 1), 'Summe ' + (S.H - 1), 'letzte Spende', 'Betrag', 'Dauerspender:in', 'Gruppe']]
    .concat(L.map(o => [o.name, o.iban, o.n, (o.sum / 100).toFixed(2).replace('.', ','), fmtD(o.last.d), (o.last.b / 100).toFixed(2).replace('.', ','), o.da ? 'ja' : '', o.typ === 'i' ? 'Institution' : 'privat']));
  const csv = () => '﻿' + csvRows().map(r => r.map(v => /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v).join(';')).join('\r\n') + '\r\n';
  const sel = S.mode === 'stich' ? h('select', { class: 'jv-miss', 'aria-label': 'Vorjahr', onchange: e => { UI.jvMiss = e.target.value; renderNow(); } },
    h('option', { value: 'stich', selected: mode === 'stich' }, (S.H - 1) + ' bis ' + jvStich(S)), h('option', { value: 'jahr', selected: mode === 'jahr' }, 'im ganzen Jahr ' + (S.H - 1))) : h('b', null, String(S.H - 1));
  return [tiles, ybtn, ytab, head,
    h('div', { class: 'jv-mbar' }, h('span', { class: 'muted small' }, 'gespendet'), sel, h('span', { class: 'muted small' }, 'in ' + S.H + ' noch nicht'),
      h('span', { class: 'jv-right' }, h('button', { class: 'small jv-mcopy', disabled: !L.length || null, onclick: () => jvClip(csvRows().map(r => r.join('\t')).join('\n'), 'Liste') }, 'Liste kopieren'),
        h('button', { class: 'small jv-mcsv', disabled: !L.length || null, onclick: () => download('Wer_fehlt_noch_' + S.H + '.csv', new Blob([csv()], { type: 'text/csv;charset=utf-8' })) }, 'Als CSV speichern'))),
    L.length ? h('table', { class: 'jv-it jv-mt' }, h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', { class: 'num' }, 'Spenden ' + (S.H - 1)), h('th', { class: 'num' }, 'Summe ' + (S.H - 1)), h('th', null, 'letzte Spende'), h('th'))),
      h('tbody', null, show.map(o => h('tr', null, h('td', { class: 'jv-in' }, o.name), h('td', { class: 'num' }, o.n), h('td', { class: 'num' }, eur0(o.sum)), h('td', { class: 'small' }, fmtD(o.last.d)),
        h('td', null, o.da ? h('span', { class: 'sp-tag da' }, 'Dauerspender:in') : null, o.typ === 'i' ? h('span', { class: 'sp-tag' }, 'Institution') : null)))))
      : h('p', { class: 'muted small' }, 'Alle aus ' + (S.H - 1) + ' haben schon wieder gespendet.'),
    L.length > MAX ? h('button', { class: 'link small jv-mall', onclick: () => { JV.missAll = !JV.missAll; renderNow(); } }, JV.missAll ? 'weniger anzeigen' : 'alle ' + L.length + ' anzeigen') : null];
}

/* ---------- Reiter „Jahresvergleich“: oben die Leiste (bleibt beim Scrollen stehen), darunter je Baustein ein Abschnitt – zeigen und ordnen unter „Bausteine“ */
// ⓘ am Abschnitt: ein Satz; die Rechenwege stehen gesammelt unter „So wird gerechnet“
const JV_TIP = {
  blick: 'Das Wichtigste auf einen Blick, dazu der Anteil zweckgebundener Spenden.',
  ziel: 'Prozentual: Stand × (Jahressumme ÷ Summe bis zum gleichen Tag) im Vergleichsjahr.',
  verlauf: 'Summe seit 1. Januar je Jahr, Spenden pro Woche, Quartale – Teile oben rechts ein- und ausblenden.',
  herkunft: 'Privat oder Institution – erkannt an Stichwörtern, unter „Regeln“ änderbar.',
  bruecke: 'Woher kommt die Veränderung zum Vergleichsjahr? Zeigen auf einen Balken nennt die Stufe.',
  bindung: 'Wie viele Spender:innen des Vorjahres wieder gespendet haben.',
  kpi: 'Werte im gewählten Zeitraum, Veränderung zum Vergleichsjahr.',
  mail: 'Rücklauf ab PAL, nur zugeordnete Spenden.',
  seg: 'Je Spender:in zählt die Summe im Zeitraum, nicht die Einzelspende: 12 × 20 € = 240 € → „101–249 €“.',
  zweck: 'Summe je Zweck im Zeitraum.',
  konto: 'Summe je Konto im Zeitraum.',
  dauer: 'Daueraufträge plus erkannte regelmäßige Spenden.',
  top: 'Wie stark das Ergebnis an wenigen hängt.',
};
const JV_INFO = {
  blick: 'Spendensumme, Spender:innen und Ø je Spende im gewählten Zeitraum, Veränderung gegenüber dem Vergleichsjahr oben. Hochrechnung und Jahresziel wie unter „Hochrechnung“, hier ab 10.000 € auf 100 € gerundet. Farbig sind Veränderungen erst ab 5 %. Zweckbindung: zweckgebunden ist, was zu einem Zweck gehört (Zuordnung wie unter „Spenden JJJJ“, auch „zu klären“ – passt zu mehreren Zwecken), zweckungebunden der Rest; darunter der Anteil im Vergleichsjahr, Veränderung in Prozentpunkten.',
  ziel: 'Hochrechnung bis 31.12. – prozentual, nicht als fester Betrag: Stand im Hauptjahr × Faktor. Der Faktor kommt aus dem Vergleichsjahr: Jahressumme ÷ Summe bis zum gleichen Tag. Beispiel: Im Vergleichsjahr waren bis 12.10. 80.000 € da, im ganzen Jahr 128.000 € – Faktor 1,6. Steht das Hauptjahr am 12.10. bei 75.000 €, ergibt das ≈ 120.000 € (und nicht 75.000 € + 48.000 € = 123.000 €). Läuft das Jahr bisher schwächer, wird also auch der Rest (z. B. Weihnachten) entsprechend kleiner angenommen. Die Spanne rechnet dasselbe mit jedem gewählten vollständigen Jahr (Buchungen bis Mitte Dezember eingelesen). Jahresziel: unter der Kachel eintragen – je Jahr und Auswahl oben (Alle / Privat / Institutionen), steht in der Planungsdatei und gilt für alle. Sondereffekte je nach Schalter oben.',
  verlauf: 'Linie: Spendensumme seit 1. Januar aufaddiert, je Jahr eine Linie; Klick auf ein Jahr hebt es hervor. Bei „bis Stichtag“ zählen in Säulen und Tabelle nur die Spenden bis zu dem Tag, bis zu dem im Hauptjahr Buchungen eingelesen sind – die Linien früherer Jahre laufen zur Orientierung weiter. Gestrichelt: Hochrechnung bis 31.12., waagerecht gestrichelt: das Jahresziel. Quartale: Q1 Jan–März usw., das laufende heißt „Qx (bis …)“; Klick auf ein Quartal hebt es hervor, noch ein Klick hebt die Auswahl auf. In der Tabelle die Veränderung zum Jahr davor. Sondereffekte (Raute) nur, wenn oben eingerechnet. Spenden pro Woche: nur das Hauptjahr, Einzelspenden und Daueraufträge übereinander. Maßnahmen: Punkte in der Farbe der Maßnahme am PAL, nur Maßnahmen des Hauptjahres, die schon verschickt sind; Zeigen nennt Name, PAL und zugeordnete Spenden. Linie, Spenden pro Woche, Quartale, Quartalszahlen und Maßnahmen lassen sich oben rechts einzeln ein- und ausblenden – das gilt auch fürs PDF.',
  herkunft: 'Balken: Anteil privat und Institutionen je Jahr – das Hauptjahr breit, die Vorjahre schmal (beim Zeigen mit Zahlen), „ausführlich“ zeigt alle breit. Jede Zahler:in (IBAN, sonst Name) ist privat oder eine Institution. Institution heißt: ein Stichwort einer Art (Banken & Gewinnsparen, Stiftungen, Kommunen & Städte …) steht im Namen des Kontoinhabers oder im Verwendungszweck; passen mehrere, zählt das längste Wort („Stadtsparkasse“ → Banken). Lange Wörter greifen auch mitten im Wort (Bürgerstiftung), kurze Abkürzungen nur einzeln (AG, e.V.). Unter „Regeln ansehen und ändern“ lassen sich Stichwörter und Arten ändern und einzelne Zahler:innen von Hand einstufen; ein Klick auf eine Art zeigt ihre Institutionen. Das gilt für alle, die die Planung öffnen; in der Planungsdatei steht dafür nur ein Kürzel – kein Name, keine IBAN.',
  bruecke: 'Wie kommt es von der Summe des Vergleichsjahres zur Summe des Hauptjahres? Je Spender:in (IBAN, sonst Name) im gleichen Zeitraum, von oben nach unten: neu oder wieder dabei (im Vergleichsjahr nicht), mehr gegeben, weniger gegeben, ausgeblieben (im Vergleichsjahr ja, im Hauptjahr bisher nicht) – jeweils mit Zahl der Personen und Betrag. Zeigen auf einen Balken nennt die Stufe; im PDF steht sie über der Zeile.',
  bindung: 'Haltequote: Anteil der Spender:innen des Vorjahres (gleicher Zeitraum), die im Jahr wieder gespendet haben. Gehalten: wieder dabei. Wieder dabei nach Pause: im Vorjahr nicht, aber in einem früheren Jahr. Nicht wieder gespendet: im Vorjahr ja, in diesem Jahr (bis zum Stichtag) nicht. „Wer fehlt noch?“: alle aus dem Vorjahr (anfangs bis zum Stichtag, wahlweise das ganze Vorjahr), die in diesem Jahr noch nicht gespendet haben (Sondereffekte wie Nachlässe nur, wenn eingerechnet) – als Liste zum Kopieren oder als CSV mit IBAN zum Abgleich mit der Spenderdatenbank; im PDF nur Anzahl und Summe. „Vorjahre“ zeigt dieselben Werte für jedes oben gewählte Jahr.',
  kpi: 'Spendensumme: alle Spenden im Zeitraum (Sondereffekte je nach Schalter oben). Spender:innen: gezählt nach IBAN, ohne IBAN nach Name – wer von zwei Konten spendet, zählt doppelt. Ø je Spende: Summe ÷ Zahl der Spenden. Anteil der größten 10 %: wie viel der Summe von den 10 % größten Spender:innen kommt. Erstmals seit JJJJ: in keinem früheren eingelesenen Jahr dabei. Dauerspender:innen: siehe dort. Veränderung: Hauptjahr gegenüber dem Vergleichsjahr; rechts der Verlauf über die gewählten Jahre. Weitere Kennzahlen unter „Bausteine“.',
  mail: 'Vergleiche: beliebig viele Zusammenstellungen anlegen (z. B. Sommermailings, Wintermailings, Jahresberichte) – Klick auf den Namen zeigt nur diesen Vergleich, das Kästchen davor zeigt ihn zusätzlich, × löscht ihn; die Vergleiche merkt sich dieser Rechner. Ein Vergleich allein: je Maßnahme eine Farbe; mehrere: je Vergleich eine Farbe, ältere Maßnahmen heller. Je Maßnahme die Spenden, die ihr zugeordnet sind (Regel oder von Hand), ab dem PAL aufaddiert – Spenden ohne Zuordnung zählen nicht. Response: Spenden ÷ Auflage. Ø je Spende: Erlös ÷ Spenden. Erlös je 1 € Kosten: Erlös ÷ Kosten. 80 % da nach: nach wie vielen Tagen ab PAL 80 % des bisherigen Erlöses eingegangen waren. „Veränderung“: die neueste gegenüber der vorigen Maßnahme des Vergleichs.',
  seg: 'Segment nach der Summe je Spender:in im Zeitraum (alle Spenden zusammengezählt, erkannt an IBAN, sonst Name) – nicht nach der einzelnen Spende: Wer 12 × 20 € gibt, steht mit 240 € bei „101–249 €“. Je gewähltem Jahr eine Zeile: links der Anteil der Segmente an den Spender:innen, rechts an der Spendensumme, jeweils mit der Gesamtzahl. Farben von Grün (bis 100 €) bis Dunkelrot (ab 5.000 €). Zeigen auf einen Abschnitt nennt Anteil und absolute Zahl. Das Hauptjahr breit, die Vorjahre schmal – beim Zeigen breit mit Zahlen; „ausführlich“ zeigt alle Jahre breit. Mehr Jahre: oben in der Leiste dazunehmen. Bei „bis Stichtag“ zählt nur die Summe bis zu diesem Tag – manche stehen dann in einem niedrigeren Segment als im ganzen Jahr.',
  zweck: 'Zuordnung wie unter „Spenden JJJJ“: Schlagworte im Verwendungszweck, Konten, Maßnahmen. „zweckungebunden“ = passt zu keinem Zweck, „zu klären“ = passt zu mehreren und ist noch nicht entschieden. Rechts der Verlauf über die gewählten Jahre.',
  konto: 'Konto bzw. Gliederung aus der Spalte „Personenname“ der Bankdatei (der gemeinsame Anfang wie „Paderborn -“ wird weggelassen). Anfangs die fünf größten Konten der gewählten Jahre; „+ Konto“ nimmt weitere dazu, × nimmt eines heraus.',
  dauer: 'Dauerspender:innen: Buchung mit „Dauerauftrag“ im Buchungstext – oder (Schalter) regelmäßig erkannt: gleicher Betrag (Erhöhungen erlaubt) am etwa gleichen Tag im Monat, mindestens dreimal monatlich, vierteljährlich, halb- oder jährlich (halb- und jährlich mit gleichem Verwendungszweck), nur Privat; „erkannte prüfen“ zeigt die Liste. Unter der Anzahl: Dauerspender:innen des Vorjahres → neu dazu, beendet → dieses Jahr (gleicher Zeitraum). Summe: alle diese Buchungen. Ø Monatsbeitrag: je Dauerspender:in der letzte Betrag, auf einen Monat umgerechnet.',
  top: 'Je Spender:in (IBAN, sonst Name) die Summe im Zeitraum, größte zuerst. Die größten 10 %: bei 500 Spender:innen die 50 mit der höchsten Summe – je höher ihr Anteil, desto mehr hängt das Ergebnis an wenigen. Daneben die Summe im Vergleichsjahr (gleicher Zeitraum). Im PDF für die Präsentation ohne Namen.',
};
function jvOrder() {
  if (!Array.isArray(UI.jvOrder)) UI.jvOrdV = 31;                                    // ohne eigene Reihenfolge nichts umzustellen
  else if (UI.jvOrdV !== 31) { const o = UI.jvOrder.slice();   // 0.29: Kennzahlen neben die Hochrechnung
    const after = (a, b) => { if (o.includes(a) && o.includes(b)) { o.splice(o.indexOf(b), 1); o.splice(o.indexOf(a) + 1, 0, b); } };
    if (UI.jvOrdV !== 29) after('ziel', 'kpi');                       // 0.29: Kennzahlen neben die Hochrechnung
    after('bruecke', 'seg'); after('bindung', 'dauer');              // 0.32: Segmente neben die Brücke, Dauerspender:innen neben die Bindung
    UI.jvOrder = o; UI.jvOrdV = 31; }
  const ks = JV_BLOCKS.map(b => b[0]), o = [...new Set(Array.isArray(UI.jvOrder) ? UI.jvOrder.filter(k => ks.includes(k)) : [])];
  for (const k of ks) if (!o.includes(k)) { const prev = ks.slice(0, ks.indexOf(k)).reverse().find(p => o.includes(p)); o.splice(prev ? o.indexOf(prev) + 1 : 0, 0, k); }   // neue Bausteine hinter ihren Vorgänger
  return o;
}
VIEW_FN.vergleich = main => {
  if ((SP.at == null || _spLastView !== 'vergleich') && !SP.busy && ST.conn === 'ok') spScan();   // beim Öffnen des Reiters neu einlesen (unveränderte Dateien kommen aus dem Speicher)
  _spLastView = 'vergleich';
  if (!SP.rows.length) { put(main, spNotice(), h('div', { class: 'spj-empty muted' }, ST.conn !== 'ok' ? 'Der Jahresvergleich rechnet mit den eingelesenen Spendendateien – dafür den Mailing-Ordner verbinden.' : SP.busy ? 'Spendendateien werden eingelesen …' : 'Noch keine Buchungen eingelesen.')); return; }
  const S = jvSetup(), Y = jvData(S);
  if (JV.focus != null && !S.sel.includes(JV.focus)) JV.focus = null;
  const sec = k => { const Sk = jvSS(S, k), d = jvSecDefs(Sk, jvData(Sk))[k], t = jvTitle(Sk, k);   // ein- und ausblenden, Reihenfolge: unter „Bausteine“
    const el = section('jv-' + k, t, () => ({ body: d.body(), tools: d.tools ? d.tools() : null }), { closedSummary: d.sum || null, info: JV_TIP[k], open: !JV_DETAIL.has(k) });
    el.dataset.jvk = k; return el; };
  // Reihenfolge; Paare (Zwecke/Konten, Brücke/Bindung) nebeneinander, wenn sie direkt aufeinander folgen
  const order = jvOrder().filter(jvShown), out = [];
  for (let i = 0; i < order.length; i++) {
    const k = order[i], nx = order[i + 1];
    const pc = jvPair(k, nx);
    if (pc) { out.push(h('div', { class: pc }, sec(k), sec(nx))); i++; }
    else out.push(sec(k));
  }
  put(main, h('div', { class: 'jv' }, spNotice(), ...jvBar(S, Y), out));
};
// Inhalt je Abschnitt (auch fürs PDF): body, Zusammenfassung im eingeklappten Kopf, Werkzeuge im Kopf
function jvSecDefs(S, Y) {
  const H = Y.get(S.H) || {}, A0 = S.cmp != null ? Y.get(S.cmp) : null, A = A0 && A0.has ? A0 : null, bis = S.H + (S.mode === 'stich' ? ' bis ' + jvStich(S) : '');
  const dTxt = (a, b) => { const d = jvDelta(b, a); return d == null ? '' : ' (' + (d >= 0 ? '+' : '−') + de0(Math.abs(d)) + ' %)'; };
  const top3 = rows => { const iH = S.sel.indexOf(S.H), iA = S.cmp != null ? S.sel.indexOf(S.cmp) : -1;
    return rows.filter(r => !r.mut && r.vals[iH]).sort((a, b) => b.vals[iH] - a.vals[iH]).slice(0, 3).map(r => r.name + ' ' + eur0(r.vals[iH]) + (iA >= 0 ? dTxt(r.vals[iA], r.vals[iH]) : '')).join(' · ') || '–'; };
  return {
    blick: { body: () => jvBlick(S, Y), sum: () => bis + ': ' + eur0(H.sum || 0) + (A ? dTxt(A.sum, H.sum) : '') },
    ziel: { body: () => jvZielSec(S, Y), sum: () => { const P = jvProj(S, Y), z = jvZielV(S); return (P ? 'Stand ' : 'Ist ') + eur0(H.fullSum || 0) + (P ? ' · hochgerechnet ≈ ' + eur0(P.main) : '') + (z ? ' · Ziel ' + eur0(z) : ''); } },
    verlauf: { body: () => jvVerlauf(S, Y), sum: () => S.sel.join(', ') + (S.mode === 'stich' ? ' – jedes Jahr bis ' + jvStich(S) : ''), tools: () => [jvVpTools()] },
    herkunft: { body: () => jvHerkunft(S), sum: () => { const r = jvHerkData(S).get(S.H); return r && r.has && r.p + r.i ? S.H + ': privat ' + de0(r.p / (r.p + r.i) * 100) + ' % · Institutionen ' + de0(r.i / (r.p + r.i) * 100) + ' %' : '–'; },
      tools: () => [jvDensBtn('jvPiFull'), h('button', { class: 'small jv-iprf', onclick: () => jvInstDialog() }, 'Regeln ansehen und ändern')] },
    bruecke: { body: () => jvBruecke(S, Y), sum: () => { const B = jvBridgeData(S, Y); return B ? B.a.y + ' → ' + B.b.y + ': ' + (B.end >= B.start ? '+' : '−') + eur0(Math.abs(B.end - B.start)) : 'Vergleichsjahr fehlt'; } },
    bindung: { body: () => jvBindung(S, Y), sum: () => { const b = H.bind; return b && b.rate != null ? 'Haltequote ' + S.H + ': ' + num1(b.rate * 100) + ' %' : 'Vorjahr ohne Daten'; } },
    kpi: { body: () => jvKpis(S, Y), sum: () => bis + ': ' + eur0(H.sum || 0) + ' · ' + spjWho(H.don || 0) + ' · ' + spCount(H.n || 0) },
    mail: { body: () => jvMails(S), sum: () => { const M = jvMv(), L = jvMvLines(M), on = M.sets.filter(x => M.on.includes(x.id));
      return L.length ? on.map(x => x.name + ': ' + L.filter(l => l.set === x).map(l => (l.x.m.name || '(ohne Namen)') + ' ' + eur0(l.s.sum || 0)).join(', ')).join(' · ') : 'noch keine Maßnahme gewählt'; } },
    seg: { body: () => jvSeg(S, Y), tools: () => [jvDensBtn('jvSegFull')], sum: () => { const b = jvSegBig(H); return b && H.don ? 'ab 1.000 €: ' + spjWho(b.n) + (b.n === 1 ? ' gibt ' : ' geben ') + (H.sum ? de0(b.sum / H.sum * 100) : 0) + ' % der Summe' : '–'; } },
    zweck: { body: () => jvZweck(S, Y), sum: () => top3(jvZweckSer(S, Y)) },
    konto: { body: () => jvKonto(S, Y), sum: () => top3(jvKontoList(S, Y).map(e => ({ name: spGlied(e.k), vals: S.sel.map(y => Y.get(y) && Y.get(y).has ? (Y.get(y).kt.get(e.k) || 0) : null) }))),
      tools: () => jvKontoTools(S, Y) },
    dauer: { body: () => jvDauer(S, Y), sum: () => bis + ': ' + spjWho(H.dauer || 0) + (H.daMon ? ' · Ø ' + eur(H.daMon) + ' im Monat' : '') + (jvRegOn() && H.daReg ? ' · ' + de0(H.daReg) + ' an regelmäßigen Buchungen erkannt' : ''),
      tools: () => [h('label', { class: 'check small jv-dareg', tip: 'Spender:innen ohne „Dauerauftrag“ im Buchungstext, die mit gleichem Betrag in festem Rhythmus spenden, als Dauerspender:innen mitzählen' },
          h('input', { type: 'checkbox', checked: jvRegOn(), onchange: e => { UI.jvDaReg = e.target.checked; renderNow(); } }), 'regelmäßige Buchungen mitzählen'),
        h('button', { class: 'link small jv-daprf', onclick: () => jvRegDialog() }, 'erkannte prüfen (' + jvRegular().size + ')')] },
    top: { body: () => jvTop(S, Y), sum: () => H.top10 != null ? 'die größten 10 % geben ' + num1(H.top10 * 100) + ' % der Summe' + (A && A.top10 != null ? ' (' + A.y + ': ' + num1(A.top10 * 100) + ' %)' : '') : '–' },
  };
}
VIEW_FN['vergleich:after'] = main => { for (const el of $$('[data-chart]', main)) try { spDraw(el); } catch (e) { console.error(e); } };

/* ---------- PDF für die Präsentation: je gezeigtem Abschnitt eine Seite (A4 quer), so wie eingestellt */
const jvQCols = (W, ml = 96, mr = 150) => { const pw = W - ml - mr, q = [0, 90, 181, 273, 365].map(d => d / 365 * pw); return [ml, q[1] - q[0], q[2] - q[1], q[3] - q[2], q[4] - q[3], mr]; };
let jvPdfErr = [];
const JV_PD_W = 1040;                                                // px – Inhaltsbreite der A4-Querseite (297 mm − 2 × 10 mm)
function jvPrintDoc() {
  jvPdfErr = [];
  const S = jvSetup(), title = k => JV_BLOCKS.find(b => b[0] === k)[1];
  const stand = 'Stand ' + fmtD(todayDn()) + (D.meta.savedAt ? ' · gespeichert ' + fmtStamp(D.meta.savedAt) : '');
  const sub = 'Jahre ' + S.sel.join(', ') + ' · ' + (S.mode === 'stich' ? 'jedes Jahr bis ' + jvStich(S) : 'ganze Jahre') + ' · Sondereffekte ' + (S.sx ? 'eingerechnet' : 'herausgerechnet') + (S.cmp != null ? ' · Vergleich mit ' + S.cmp : '') + (S.grp !== 'alle' ? ' · ' + jvGrpName(S.grp) : '');
  const page = (k, t, ...content) => h('section', { class: 'pd-page jv jv-print', dataset: { jvk: k } }, h('table', { class: 'pd-frame' },
    h('thead', null, h('tr', null, h('td', null, h('div', { class: 'pd-sp' })))),
    h('tbody', null, h('tr', null, h('td', null, h('header', { class: 'pd-head' }, h('img', { src: LOGO, alt: 'Malteser' }), h('div', null, h('h1', null, t), h('span', null, sub)), h('span', { class: 'pd-stand' }, stand)), content))),
    h('tfoot', null, h('tr', null, h('td', null, h('div', { class: 'pd-sp' }))))));
  // je Abschnitt: Inhalt fürs PDF (ohne Namen, ohne Eingabefelder) und Titel (mit eigener Auswahl, falls abweichend)
  const part = k => { try { return part0(k); } catch (e) { console.error(e); jvPdfErr.push(jvTitle(S, k) + ': ' + e.message);
    return { body: h('p', { class: 'muted' }, 'Dieser Abschnitt konnte nicht erstellt werden (' + e.message + ').'), t: jvTitle(S, k) }; } };
  const part0 = k => { const Sk = jvSS(S, k), Yk = jvData(Sk);
    const body = k === 'bindung' ? jvBindung(Sk, Yk, true) : k === 'ziel' ? jvZielSec(Sk, Yk, true) : k === 'top' ? jvTop(Sk, Yk, true) : k === 'herkunft' ? jvHerkunft(Sk, true) : k === 'mail' ? jvMails(Sk, true) : jvSecDefs(Sk, Yk)[k].body();
    const t = jvTitle(Sk, k) + (['blick', 'kpi', 'dauer', 'ziel', 'bindung', 'top', 'herkunft'].includes(k) ? ' ' + S.H : k === 'bruecke' && Sk.cmp != null ? ' ' + Sk.cmp + ' → ' + S.H : '');
    return { body, t }; };
  // Seiten: zusammengehörige Abschnitte auf eine Seite (Reihenfolge wie im Jahresvergleich, eine Gruppe steht dort, wo ihr erster Abschnitt steht)
  const pages = [], order = jvOrder().filter(jvShown), done = new Set(), has = k => order.includes(k);
  const blk = (k, hd) => { const a = part(k); return { t: a.t, el: h('div', { class: 'jv-pdb', dataset: { jvk: k } }, hd ? h('h3', { class: 'jv-ph' }, a.t) : null, a.body) }; };
  const duo = (a, b, cls) => { const A = has(a) ? blk(a, true) : null, B = has(b) ? blk(b, true) : null;
    return A && B ? h('div', { class: 'jv-grid2' + (cls ? ' ' + cls : '') }, A.el, B.el) : (A || B) ? (A || B).el : null; };
  const name = k => JV_BLOCKS.find(b => b[0] === k)[1].replace(' über die Jahre', '');
  const ttl = (ks, yr) => ks.filter(has).map(name).join(' · ') + (yr ? ' ' + S.H : '');
  const GROUP = { blick: 'ueb', ziel: 'ueb', kpi: 'ueb', seg: 'seg', bruecke: 'seg', bindung: 'bind', dauer: 'bind', zweck: 'bind', konto: 'bind' };
  for (const k of order) {
    if (done.has(k)) continue;
    const gk = GROUP[k], mem = gk ? order.filter(x => GROUP[x] === gk) : [k]; mem.forEach(x => done.add(x));
    if (gk === 'ueb') {                                                // Auf einen Blick, darunter Hochrechnung | Kennzahlen
      const top = has('blick') ? blk('blick', false).el : null, row = duo('ziel', 'kpi', 'r12');
      pages.push(page(k, ttl(['blick', 'ziel', 'kpi'], true), top, top && row ? h('div', { class: 'jv-pdgap' }) : null, row));
    } else if (gk === 'seg') {                                         // Segmente über die ganze Breite, die Brücke darunter auf der halben Breite
      const a = has('seg') ? blk('seg', has('bruecke')) : null, b = has('bruecke') ? blk('bruecke', true) : null;
      pages.push(page(k, a && b ? 'Spendersegmente · ' + b.t : (a || b).t, a && a.el, a && b ? h('div', { class: 'jv-pdgap' }) : null, b && h('div', { class: 'jv-pdhalf' }, b.el)));
    } else if (gk === 'bind') {                                        // Bindung | Dauerspender:innen, darunter Zwecke | Konten
      const r1 = duo('bindung', 'dauer'), r2 = duo('zweck', 'konto');
      pages.push(page(k, ttl(['bindung', 'dauer', 'zweck', 'konto'], has('bindung') || has('dauer')), r1, r1 && r2 ? h('div', { class: 'jv-pdgap' }) : null, r2));
    } else if (k === 'verlauf') {                                      // Linie, Wochen und Quartale – passt nicht alles auf eine Seite, kommen die Quartale auf die nächste
      const Yv = jvData(S), hTop = (jvVp('cum') ? 280 : 0) + (jvVp('wk') ? 176 : 0), hQ = (jvVp('qa') ? 140 : 0) + (jvVp('qn') ? 40 + S.sel.length * 46 : 0) + (jvVp('qa') || jvVp('qn') ? 30 : 0);
      if (!hTop || !hQ || hTop + hQ <= 640) pages.push(page(k, 'Jahresverlauf ' + S.H, jvVerlauf(S, Yv)));
      else pages.push(page(k, 'Jahresverlauf ' + S.H, jvVerlauf(S, Yv, 'top')), page(k, 'Jahresverlauf ' + S.H + ' – Quartale', jvVerlauf(S, Yv, 'q')));
    } else if (k === 'mail') {                                         // je Vergleich Grafik und Tabelle – zwei Vergleiche auf einer Seite, wenn sie hinpassen
      let blocks = []; try { blocks = jvMailPdf(jvSS(S, k)); } catch (e) { console.error(e); jvPdfErr.push(jvTitle(S, k) + ': ' + e.message); }
      if (!blocks.length) { pages.push(page(k, jvTitle(S, k), h('p', { class: 'muted' }, 'Noch keine Maßnahme mit zugeordneten Spenden im Vergleich.'))); continue; }
      for (let i = 0; i < blocks.length; i++) { const a = blocks[i], b = blocks[i + 1];
        if (b && a.hgt + b.hgt + 16 <= 670) { pages.push(page(k, jvTitle(S, k), a.el, h('div', { class: 'jv-pdgap' }), b.el)); i++; } else pages.push(page(k, jvTitle(S, k), a.el)); }
    } else { const a = part(k); pages.push(page(k, a.t, a.body)); }
  }
  if (pages.length) pages[pages.length - 1].classList.add('last');
  const doc = h('div', { id: 'printdoc' }, pages);
  for (const el of $$('[data-chart]', doc)) { const g = el.closest('.jv-grid2'), m = g && /\br(\d)(\d)\b/.exec(g.className), a = m ? +m[1] : 1, b = m ? +m[2] : 1;
    el.dataset.w = String(g ? Math.floor((JV_PD_W - 20) * (g.firstElementChild.contains(el) ? a : b) / (a + b)) : el.closest('.jv-pdhalf') ? Math.floor((JV_PD_W - 20) / 2) : JV_PD_W); try { spDraw(el); } catch (e) { console.error(e); } }
  return doc;
}
function jvPrintPDF() {
  if (!jvOrder().some(jvShown)) { toast('Kein Abschnitt eingeblendet.', 'warn'); return; }
  hideTip(); closeMenu();
  let doc;
  try { doc = jvPrintDoc(); }
  catch (e) { console.error(e); $$('#printdoc').forEach(x => x.remove()); document.body.classList.remove('printdoc-mode'); toast('PDF konnte nicht erstellt werden: ' + e.message, 'warn'); return; }
  $$('#printdoc').forEach(e => e.remove());
  document.body.append(doc);
  document.body.classList.add('printdoc-mode');
  PRINT_TITLE = document.title;
  document.title = 'Jahresvergleich_' + UI.year + '_' + ds(todayDn());   // Vorschlag für den Dateinamen
  if (jvPdfErr.length) toast('Im PDF fehlt etwas: ' + jvPdfErr.join(' · '), 'warn');
  setTimeout(() => { try { window.print(); } catch (e) { toast('Drucken nicht möglich: ' + e.message, 'warn'); window.dispatchEvent(new Event('afterprint')); } }, 80);
}

/* ---------- Grafiken (Abschnitt mit eigener Auswahl: data-jvk am Abschnitt bzw. an der PDF-Seite) */
function jvDraw(el) {
  const kk = (el.closest('[data-jvk]') || { dataset: {} }).dataset.jvk, S = jvSS(jvSetup(), kk), Y = jvData(S), kind = el.dataset.chart;
  if (kind === 'jvcum') return jvDrawCum(el, S, Y);
  if (kind === 'jvqa') return jvDrawQ(el, S, Y);
  if (kind === 'jvqal') { const m = jvQM(el); return jvQAlign(el, m.ml, m.mr, k => m.ml + [0, 90, 181, 273, 365][k] / 365 * (m.W - m.ml - m.mr)); }   // Quartalszahlen ohne Säulen: trotzdem unter den Quartalen
  if (kind === 'jvwk') return jvDrawWk(el, S, Y);
  if (kind === 'jvmail') return jvDrawMail(el);
  if (kind === 'jvseg') return jvDrawSeg(el, S, Y);
  if (kind === 'jvbr') return jvDrawBridge(el, S, Y);
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
  const P = jvProj(S, Y), zl = jvZielV(S), sH = ser.find(s => s.y === S.H), sB = P && sH && ser.find(s => s.y === P.base.y);
  const fx = (i, len) => g.ml + (i + 0.5) / len * g.pw, mx = Math.max(...ser.map(s => s.cum[s.L]), sB ? P.main : 0, zl || 0), Yv = spYAxis(svg, g, mx / 100), y0 = g.mt + g.ph;
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
  if (sB) {                                                           // Hochrechnung: ab dem Stichtag wie im Vergleichsjahr
    const at = i => { const [, m, d] = ymd(sH.a + i); return clamp(mkdn(sB.y, m, m === 2 ? Math.min(d, 28) : d) - sB.a, 0, sB.len - 1); }, i0 = clamp(mkdn(S.H, S.md[0], S.md[1]) - sH.a, 0, sH.len - 1), b0 = sB.cum[at(i0)];
    if (b0 > 0) { const pts = []; for (let i = i0; i < sH.len; i++) pts.push(fx(i, sH.len).toFixed(1) + ',' + Yv(sH.cum[i0] * sB.cum[at(i)] / b0 / 100).toFixed(1));
      const pl = sv('polyline', { class: 'jv-proj', points: pts.join(' '), stroke: S.col(S.H) }); svg.append(pl);
      labs.push({ proj: true, y: Yv(P.main / 100), x: fx(sH.len - 1, sH.len) }); } }
  if (zl) { const yy = Yv(zl / 100); svg.append(sv('line', { class: 'jv-zline', x1: g.ml, x2: g.ml + g.pw, y1: yy, y2: yy }), sv('text', { class: 'jv-zlab', x: g.ml + 6, y: yy - 5 }, 'Ziel ' + eur0(zl))); }
  labs.sort((a, b) => a.y - b.y); for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
  for (const l of labs) {
    if (l.proj) { const t = sv('text', { class: 'jv-elab jv-plab', x: l.x + 8, y: l.y + 4 }, '≈ ' + eur0(P.main)); setTip(t, S.H + ' hochgerechnet mit dem Verlauf ' + P.base.y); svg.append(t); continue; } const t = sv('text', { class: 'jv-elab click' + (dim(l.s.y) ? ' jv-dim' : '') + (F === l.s.y ? ' on' : ''), x: l.x + 8, y: l.y + 4 }, l.s.y + ' · ' + eur0(l.s.cum[l.s.L]));
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
  if (jvVp('ms')) { const lenH = mkdn(S.H, 12, 31) - mkdn(S.H, 1, 1) + 1; jvPalMarks(svg, g, S, i => fx(i, lenH)); }
}
// Spenden pro Woche im Hauptjahr (wie unter „Spenden JJJJ“): Einzelspenden und Daueraufträge (laut Buchungstext) übereinander, Monate genau unter dem Jahresverlauf
function jvDrawWk(el, S, Y) {
  const o = Y.get(S.H), rows = o ? (S.sx ? o.all : o.noOut) : [], sxK = new Set(S.sx && o ? o.outAll.map(r => r.k) : []);
  if (!rows.length) { el.replaceChildren(h('div', { class: 'muted small spj-none' }, 'Keine Spenden ' + S.H + '.')); return; }
  const J = { y: S.H, a: mkdn(S.H, 1, 1), b: mkdn(S.H, 12, 31) }, days = J.b - J.a + 1, nb = Math.ceil(days / 7), one = new Array(nb).fill(0), da = new Array(nb).fill(0), n1 = new Array(nb).fill(0), n2 = new Array(nb).fill(0), sxv = new Array(nb).fill(0);
  for (const r of rows) { const i = Math.floor((r.d - J.a) / 7); if (i < 0 || i >= nb) continue; if (spIsDA(r)) { da[i] += r.b; n2[i]++; } else { one[i] += r.b; n1[i]++; } if (sxK.has(r.k)) sxv[i] += r.b; }
  const { svg, g } = spFrame(el, 150, 96); g.mr = 150; g.pw = g.W - g.ml - g.mr;   // wie der Jahresverlauf: links 96, rechts 150
  const X0 = i => g.ml + i / days * g.pw, y0 = g.mt + g.ph, pw = g.pw / nb, bw = Math.max(2, pw - 3);
  const Yv = spYAxis(svg, g, Math.max(1, ...one.map((v, i) => v + da[i])) / 100);
  spjMonths(svg, g, J, X0);
  for (let i = 0; i < nb; i++) {
    const grp = sv('g', { class: 'sp-bin' }), bx = g.ml + i * pw + (pw - bw) / 2, yd = Yv(da[i] / 100), yt = Yv((da[i] + one[i]) / 100);
    if (da[i]) grp.append(sv('rect', { class: 'spj-b2', x: bx, y: yd, width: bw, height: y0 - yd }));
    if (one[i]) grp.append(sv('rect', { class: 'spj-b1', x: bx, y: yt, width: bw, height: yd - yt }));
    const hit = sv('rect', { class: 'sp-hit', x: g.ml + i * pw, y: g.mt, width: pw, height: g.ph }), a = J.a + i * 7, b = Math.min(J.b, a + 6);
    setTip(hit, () => h('div', null, h('b', null, eur(one[i] + da[i])), h('div', { class: 'muted small' }, fmtS(a) + ' – ' + fmtS(b)),
      h('div', null, 'Einzelspenden: ' + eur(one[i]) + ' (' + n1[i] + ')'), h('div', null, 'Daueraufträge: ' + eur(da[i]) + ' (' + n2[i] + ')'), sxv[i] ? h('div', { class: 'jv-qo' }, 'darin ' + eur0(sxv[i]) + ' Sondereffekte') : null));
    grp.append(hit); svg.append(grp);
  }
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
  if (jvVp('ms')) jvPalMarks(svg, g, S, i => g.ml + (i + 0.5) / days * g.pw);
}
// Quartale: je Quartal die Jahre nebeneinander, genau unter dem Quartal des Jahresverlaufs; Sondereffekte (wenn gezeigt) obenauf
function jvDrawQ(el, S, Y) {
  const q = JV.q, F = JV.focus, sx = jvSxOn(S, Y), sumQ = (rs, gi) => rs.reduce((t, r) => t + (jvQOf(r.d) === gi ? r.b : 0), 0);
  const vals = [0, 1, 2, 3].map(gi => S.sel.map(y => { const o = Y.get(y) || {}, e = sx ? sumQ(o.out || [], gi) : 0; return [sumQ(o.rows || [], gi) - e, e]; }));   // [ohne Sondereffekte, Sondereffekte obenauf]
  const mx = Math.max(1, ...vals.flat().map(v => v[0] + v[1]));
  const { W, ml, mr } = jvQM(el);
  const g = { W, H: 130, ml, mr, mt: 8, mb: 22 }; g.pw = W - ml - mr; g.ph = g.H - g.mt - g.mb;
  const svg = sv('svg', { width: W, height: g.H, class: 'sp-svg', role: 'img' }); el.replaceChildren(svg);
  const Yv = spYAxis(svg, g, mx / 100), y0 = g.mt + g.ph, n = S.sel.length, qx = k => g.ml + [0, 90, 181, 273, 365][k] / 365 * g.pw;
  [0, 1, 2, 3].forEach(gi => { const gw = qx(gi + 1) - qx(gi), bw = Math.max(3, Math.min(24, (gw - 40) / n - 4)), x0 = qx(gi) + (gw - n * (bw + 4) + 4) / 2;
    S.sel.forEach((y, j) => { const [v, e] = vals[gi][j], k = (q != null && gi !== q ? 0.35 : 1) * (F != null && F !== y ? 0.35 : 1), x = x0 + j * (bw + 4), mix = c => k < 1 ? 'fill: ' + jvMix(c, Math.round(k * 100)) : null;
      const yb = Yv(v / 100), ye = Yv((v + e) / 100), r = sv('rect', { x, y: yb, width: bw, height: Math.max(0.5, y0 - yb), rx: 3, fill: S.col(y), style: mix(S.col(y)), class: 'jv-bar' });
      const tip = () => h('div', null, h('b', null, jvQName(S, gi) + ' ' + y), h('div', null, eur0(v + e)), e ? h('div', { class: 'jv-qo' }, 'darin ' + eur0(e) + ' Sondereffekte') : null);
      setTip(r, tip); svg.append(r);
      if (e) { const t = sv('rect', { x, y: ye, width: bw, height: Math.max(1, yb - ye), rx: 3, class: 'jv-bar jv-sxbar', style: mix('var(--jvsx)') }); setTip(t, tip); svg.append(t); } });
    svg.append(sv('text', { class: 'sp-ax' + (gi === q ? ' jv-qlab on' : ''), x: qx(gi) + gw / 2, y: y0 + 15, 'text-anchor': 'middle' }, jvQName(S, gi))); });
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
  svg.addEventListener('click', ev => { const x = ev.clientX - svg.getBoundingClientRect().left; for (let k = 0; k < 4; k++) if (x >= qx(k) && x < qx(k + 1)) return jvQPick(k); });
  jvQAlign(el, ml, mr, qx);
}
// Ränder wie der Jahresverlauf (spFrame 96 / rechts 150) – im PDF stehen beide bündig
function jvQM(el) {
  const W = Math.max(320, Math.floor(+el.dataset.w || el.clientWidth)), scope = el.closest('.pd-page, [data-sec]') || document, cum = scope.querySelector('[data-chart="jvcum"] svg');
  let ml = 96, mr = 150;
  if (cum && JV.cum) { const cr = cum.getBoundingClientRect(), er = el.getBoundingClientRect(); if (cr.width && er.width) { ml = cr.left + JV.cum.ml - er.left; mr = er.right - (cr.left + JV.cum.ml + JV.cum.pw); } }
  return { W, ml, mr };
}
function jvQAlign(el, ml, mr, qx) {
  const scope = el.closest('.pd-page, [data-sec]') || document;
  // Sondereffekte und „Quartale in Zahlen“ darunter an denselben Quartalen ausrichten
  const wrap = el.parentElement, w = [ml, ...[0, 1, 2, 3].map(k => qx(k + 1) - qx(k)), mr].map(v => Math.max(0, v).toFixed(1) + 'px');
  const lst = wrap && wrap.querySelector('.jv-qsx'); if (lst) Object.assign(lst.style, { paddingLeft: w[0], paddingRight: w[5], gridTemplateColumns: w.slice(1, 5).join(' ') });
  if (wrap) wrap.querySelectorAll('.jv-qnum col').forEach((c, i) => { c.style.width = w[i]; });
  // gewähltes Quartal: ein Rahmen vom Jahresverlauf über die Säulen bis zu den Zahlen
  const host = el.closest('.sec-b');
  if (host && !el.closest('#printdoc')) { host.querySelectorAll('.jv-qframe').forEach(f => f.remove());
    const band = scope.querySelector('[data-chart="jvcum"] .jv-qband.on'), tab = wrap && wrap.querySelector('.jv-qnum');
    if (JV.q != null && band && tab) { const hr = host.getBoundingClientRect(), br = band.getBoundingClientRect(), tr = tab.getBoundingClientRect();
      host.style.position = 'relative';
      host.append(h('div', { class: 'jv-qframe', style: { left: (br.left - hr.left - 3).toFixed(1) + 'px', width: (br.width + 6).toFixed(1) + 'px', top: (br.top - hr.top - 3).toFixed(1) + 'px', height: (tr.bottom - br.top + 6).toFixed(1) + 'px' } })); } }
}
// Mailings: Rücklauf kumuliert ab PAL
function jvDrawMail(el) {
  const M = jvMv(), st = jvMvLines(el.dataset.set ? Object.assign({}, M, { on: [el.dataset.set] }) : M).filter(o => o.sr);
  if (!st.length) return;
  const days = clamp(Math.max(...st.map(o => o.sr.last)), 30, 180), { svg, g } = spFrame(el, el.dataset.set ? JV_MPDF_H : 230, 70);
  g.mr = 175; g.pw = g.W - g.ml - g.mr;
  const mx = Math.max(...st.map(o => o.sr.cum[Math.min(days, o.sr.cum.length - 1)])), Yv = spYAxis(svg, g, mx / 100), y0 = g.mt + g.ph, X = d => g.ml + d / days * g.pw;
  const step = days > 120 ? 30 : days > 60 ? 15 : 10;
  for (let d = 0; d <= days; d += step) svg.append(sv('text', { class: 'sp-ax', x: X(d), y: y0 + 16, 'text-anchor': 'middle' }, d ? '+' + d + ' Tage' : 'PAL'));
  svg.append(sv('line', { class: 'sp-base', x1: g.ml, x2: g.ml + g.pw, y1: y0, y2: y0 }));
  const labs = [];
  for (const o of st) { const last = Math.min(days, o.sr.cum.length - 1), pts = [];
    for (let d = 0; d <= last; d++) pts.push(X(d).toFixed(1) + ',' + Yv(o.sr.cum[d] / 100).toFixed(1));
    svg.append(sv('polyline', { class: 'jv-line', points: pts.join(' '), style: 'stroke: ' + o.col, 'stroke-width': 2.2 }));
    labs.push({ o, x: X(last), y: Yv(o.sr.cum[last] / 100) }); }
  labs.sort((a, b) => a.y - b.y); for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
  for (let i = labs.length - 1, lim = y0 - 6; i >= 0; i--, lim -= 13) { if (labs[i].y > lim) labs[i].y = lim; else break; }   // unten nicht über die Achse hinaus
  for (const l of labs) svg.append(sv('text', { class: 'jv-elab', style: 'fill: color-mix(in srgb, ' + l.o.col + ' 72%, var(--ink))', x: g.ml + g.pw + 8, y: l.y + 4 }, (l.o.x.m.name || '?').replace(/\s*\d{4}$/, '').slice(0, 22) + ' ’' + String(ymd(l.o.x.pal)[0]).slice(2)));
  spCross(svg, g, { at: px => clamp(Math.round((px - g.ml) / g.pw * days), 0, days), x: X,
    dots: d => st.map(o => sv('circle', { cx: X(d), cy: Yv(o.sr.cum[Math.min(d, o.sr.cum.length - 1)] / 100), r: 4, style: 'fill: ' + o.col, stroke: 'var(--card)', 'stroke-width': 2 })),
    tip: d => h('div', null, h('b', null, d ? d + ' Tage nach dem PAL' : 'am PAL'), st.map(o => h('div', { class: 'jv-tipr' }, h('span', { class: 'jv-ln', style: { background: o.col } }), (o.x.m.name || '?') + ': ' + eur0(o.sr.cum[Math.min(d, o.sr.cum.length - 1)])))) });
}
// Spendersegmente: je gewähltem Jahr ein Balken – oben Anteil der Segmente an den Spender:innen, unten an der Summe; rechts die Gesamtzahl
const jvDensBtn = key => h('button', { class: 'small jv-dens', 'aria-pressed': String(!!UI[key]), tip: UI[key] ? 'Vorjahre wieder schmal, Zahlen beim Zeigen' : 'alle Jahre als breite Balken mit Zahlen',
  onclick: () => { UI[key] = !UI[key]; hideTip(); renderNow(); } }, UI[key] ? 'kompakt' : 'ausführlich');
const jvSegYears = (S, Y) => S.sel.filter(y => { const o = Y.get(y); return o && o.has && o.don; });
const JV_SGR = 26, JV_SGT = 24, jvSegH = n => Math.max(1, n) * JV_SGR + JV_SGT + 4;
const JV_SGINV = [true, false, false, false, true, true];
const jvSgPct = p => p > 0 && p < 1 ? '< 1 %' : de0(p) + ' %';
const jvTW = (t, font) => { let m = 0; try { m = t.getComputedTextLength(); } catch (e) { m = 0; } if (m > 0) return m;   // Textbreite – ohne Darstellung (PDF) über ein Canvas gemessen
  const c = jvTW.c || (jvTW.c = document.createElement('canvas').getContext('2d')); c.font = font + ' ' + getComputedStyle(document.body).fontFamily; return c.measureText(t.textContent).width; };   // weiße Zahl auf Grün, Rot, Dunkelrot; dunkle auf Hellgrün, Gelb, Orange
// Spender:innen links, Spendensumme rechts – je gewähltem Jahr eine Zeile; Vorjahre schmal (beim Zeigen breit mit Zahlen)
function jvDrawSeg(el, S, Y) {
  const ys = jvSegYears(S, Y);
  if (!ys.length) { el.replaceChildren(h('div', { class: 'muted small spj-none' }, 'Keine Spenden im Zeitraum.')); return; }
  const W = Math.max(420, Math.floor(+el.dataset.w || el.clientWidth)), x0 = 42, gap = 20, colW = (W - x0 - gap) / 2;
  const svg = sv('svg', { width: W, height: jvSegH(ys.length), class: 'sp-svg' + (UI.jvSegFull || el.closest('#printdoc') ? ' jv-full' : ''), role: 'img' }); el.replaceChildren(svg);
  const blocks = [['n', 'Spender:innen', o => de0(o.don), 44], ['sum', 'Spendensumme', o => eur0(o.sum), 78]];
  blocks.forEach(([, t], b) => svg.append(sv('text', { x: x0 + b * (colW + gap), y: 14, class: 'jv-sgt' }, t)));
  ys.forEach((y, i) => { const o = Y.get(y), yy = JV_SGT + i * JV_SGR;
    const row = sv('g', { class: 'jv-sgrow' + (y === S.H ? ' main' : ' old') }); svg.append(row);
    row.append(sv('rect', { x: 0, y: yy - 3, width: W, height: JV_SGR, class: 'jv-sghit' }), sv('text', { x: 0, y: yy + 14.5, class: 'jv-pisy' + (y === S.H ? ' on' : '') }, String(y)));
    blocks.forEach(([f, t, tot, tw], b) => { const bx = x0 + b * (colW + gap), bw = colW - tw, T = o.seg.reduce((a, x) => a + x[f], 0); let c = 0;
      JV_SEGA.forEach((si, j) => { const v = o.seg[si][f], x = bx + (T ? c / T : 0) * bw, w = T ? v / T * bw : 0; c += v; if (w < 0.5) return;
        const r = sv('rect', { x: x + 1.5, y: yy, width: Math.max(0.5, w - 3), height: 20, rx: 3, fill: 'var(--jvs' + (j + 1) + ')', class: 'jv-sgb' });
        const pc = v / T * 100; setTip(r, () => h('div', null, jvSgPct(pc) + ' · ' + (f === 'n' ? spjWho(v) : eur0(v))));
        row.append(r);
        if (w >= 12) { const t = sv('text', { x: x + w / 2, y: yy + 14.5, 'text-anchor': 'middle', class: 'jv-sgp' + (JV_SGINV[j] ? ' inv' : '') }, jvSgPct(pc)); row.append(t);   // passt nicht: kleiner und ohne Leerzeichen, sonst nur beim Zeigen
          if (jvTW(t, '700 12px') + 6 > w) { if (pc < 1) t.remove(); else { t.textContent = de0(pc) + '%'; t.setAttribute('style', 'font-size: 10px'); if (jvTW(t, '700 10px') + 2 > w) t.remove(); } } } });
      row.append(sv('text', { x: bx + bw + 6, y: yy + 14.5, class: 'jv-lv' }, tot(o))); }); });
}
