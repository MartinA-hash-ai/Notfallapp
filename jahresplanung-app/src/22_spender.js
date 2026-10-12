/* ===================================================================== Jahresvergleich: Spender:innen – Privat oder Institution, regelmäßige Spenden (Dauerspender:innen ohne „Dauerauftrag“) */

// Zahler:in = IBAN (ohne IBAN: Name). In der Planungsdatei steht nur ein Kürzel (Hash), keine Kontonummer.
// Institution: Stichwort im Namen des Kontoinhabers (Rechtsform, Stiftung, Bank, Pfarrei …) oder im Verwendungszweck (Gewinnsparen, Kollekte …);
// von Hand umstellbar (D.spenden.styp). Kurze Stichwörter (bis 4 Zeichen, z. B. „AG“, „e.V.“) zählen nur als ganzes Wort, längere auch mitten im Wort („Stiftung“ → „Bürgerstiftung“).
const JV_INST_NAME = ['Stiftung', 'Sparkasse', 'Volksbank', 'Raiffeisenbank', 'Bank', 'Gewinnspar', 'Verein', 'Verband', 'Kirchengemeinde', 'Pfarrei', 'Pfarramt', 'Kirchenvorstand',
  'Bistum', 'Erzbistum', 'Caritas', 'Gemeinde', 'Stadtwerke', 'Landkreis', 'Amtsgericht', 'Landgericht', 'Staatsanwaltschaft', 'Justiz', 'Firma', 'Holding', 'Lions', 'Rotary', 'Kolping', 'Schützen',
  'GmbH', 'gGmbH', 'mbH', 'AG', 'KG', 'OHG', 'GbR', 'e.V.', 'eV', 'eG', 'UG', 'KGaA', 'Co.'];
const JV_INST_ZWECK = ['Gewinnspar', 'Reinertrag', 'Zweckertrag', 'PS-Sparen', 'PS-Los', 'Lotterie', 'Kollekte', 'Geldauflage', 'Bußgeld', 'Bussgeld'];
const jvInstWorte = f => { const w = (D.spenden.sworte || {})[f]; return Array.isArray(w) ? w : f === 'name' ? JV_INST_NAME : JV_INST_ZWECK; };
const jvKwRe = w => { const t = w.toLowerCase().replace(/\s+/g, ''), core = t.replace(/[^a-zäöüß0-9]/g, ''), esc = t.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  return core.length <= 4 || /\.$/.test(t) ? new RegExp('(^|[^a-zäöüß0-9])' + esc + '(?=$|[^a-zäöüß0-9])') : new RegExp(esc); };   // kurz: ganzes Wort; lang: auch im Wort
const jvNormTxt = s => ' ' + str(s).toLowerCase().replace(/e\.\s+v\./g, 'e.v.').replace(/\s+/g, ' ') + ' ';
const jvPid = r => spHash(jvDonor(r));

// alle Zahler:innen mit Einstufung (gecacht)
let _jvPay = { key: null, val: null };
function jvPayers() {
  const key = SP.sig + '|' + SP.rows.length + '|' + JSON.stringify(D.spenden.sworte || null) + '|' + JSON.stringify(D.spenden.styp || {});
  if (_jvPay.key === key && _jvPay.rows === SP.rows) return _jvPay.val;
  const nameRe = jvInstWorte('name').map(w => [w, jvKwRe(w)]), zweckRe = jvInstWorte('zweck').map(w => [w, jvKwRe(w)]), man = D.spenden.styp || {};
  const by = new Map(), pidOf = new Map();
  for (const r of SP.rows) {
    const dk = jvDonor(r); let pid = pidOf.get(dk); if (!pid) { pid = spHash(dk); pidOf.set(dk, pid); }
    let o = by.get(pid); if (!o) by.set(pid, o = { pid, dk, name: r.name || '', iban: r.iban || '', n: 0, sum: 0, first: r.d, last: r.d, why: null });
    o.n++; o.sum += r.b; if (r.d < o.first) o.first = r.d; if (r.d > o.last) { o.last = r.d; if (r.name) o.name = r.name; }
    if (!o.why) { const nm = jvNormTxt(r.name), zw = jvNormTxt(r.zweck);
      for (const [w, re] of nameRe) if (re.test(nm)) { o.why = 'Name: „' + w + '“'; break; }
      if (!o.why) for (const [w, re] of zweckRe) if (re.test(zw)) { o.why = 'Verwendungszweck: „' + w + '“'; break; } }
  }
  for (const o of by.values()) { o.auto = o.why ? 'i' : 'p'; o.hand = man[o.pid] || null; o.typ = o.hand || o.auto; }
  _jvPay = { key, rows: SP.rows, val: { by, pidOf } };
  return _jvPay.val;
}
const jvTypOf = r => { const P = jvPayers(), pid = P.pidOf.get(jvDonor(r)), o = pid && P.by.get(pid); return o ? o.typ : 'p'; };
const jvGrp = () => ['privat', 'inst'].includes(UI.jvGrp) ? UI.jvGrp : 'alle';
const jvGrpName = g => g === 'privat' ? 'nur Privat' : g === 'inst' ? 'nur Institutionen' : 'alle Spender:innen';

// regelmäßige Spenden (nur Privat, nur wer keine Buchung mit „Dauerauftrag“ hat): gleicher Betrag (Erhöhung bis +50 % erlaubt) am etwa gleichen Tag im Monat (± 4),
// mindestens drei Buchungen im Rhythmus; halb- und jährlich zusätzlich mit gleichem Verwendungszweck – sonst sähen Antworten auf Sommer- und Weihnachtsmailing aus wie ein Dauerauftrag
const JV_RH = [
  { k: 'monatlich', m: 1, lo: 25, hi: 35, min: 3 },
  { k: 'vierteljährlich', m: 3, lo: 80, hi: 100, min: 3 },
  { k: 'halbjährlich', m: 6, lo: 170, hi: 195, min: 3, same: true },
  { k: 'jährlich', m: 12, lo: 360, hi: 370, min: 3, same: true, exact: true },     // jährlich nur bei genau gleichem Betrag
];
const jvDom = d => ymd(d)[2], jvDomOk = (a, b) => { const x = Math.abs(jvDom(a) - jvDom(b)); return Math.min(x, 31 - x) <= 4; };
function jvChain(g, R) {
  const okAmt = (a, b) => R.exact ? a.b === b.b : b.b >= a.b && b.b <= a.b * 1.5, okZw = (a, b) => !R.same || (!!a.sq && a.sq === b.sq);
  let best = [];
  for (let i = 0; i < g.length && g.length - i > best.length; i++) {
    const ch = [g[i]]; let cur = g[i];
    for (let j = i + 1; j < g.length; j++) { const gap = g[j].d - cur.d; if (gap < R.lo) continue; if (gap > R.hi) break; if (okAmt(cur, g[j]) && jvDomOk(cur.d, g[j].d) && okZw(cur, g[j])) { ch.push(g[j]); cur = g[j]; } }
    if (ch.length > best.length) best = ch;
  }
  return best.length >= R.min ? best : null;
}
let _jvReg = { key: null, val: null };
function jvRegular() {
  const P = jvPayers(), key = P === _jvReg.P && _jvReg.rows === SP.rows ? _jvReg.key : null;
  if (key) return _jvReg.val;
  const by = new Map(), out = new Map();
  for (const r of SP.rows) { const pid = P.pidOf.get(jvDonor(r)); if (!by.has(pid)) by.set(pid, []); by.get(pid).push(r); }
  for (const [pid, list] of by) {
    const o = P.by.get(pid); if (!o || o.typ === 'i' || list.some(spIsDA)) continue;
    const g = list.slice().sort((a, b) => a.d - b.d); let best = null;
    for (const R of JV_RH) { const ch = jvChain(g, R); if (ch && (!best || ch.length > best.ch.length)) best = { R, ch }; }
    if (!best) continue;
    const ch = best.ch;
    out.set(pid, { pid, name: o.name, rh: best.R.k, m: best.R.m, b: ch[ch.length - 1].b, first: ch[0].d, last: ch[ch.length - 1].d, n: ch.length, keys: new Set(ch.map(r => r.k)) });
  }
  _jvReg = { key: 1, P, rows: SP.rows, val: out };
  return out;
}
const jvRegOn = () => UI.jvDaReg !== false;
function jvRegKeys() { const R = jvRegular(), no = D.spenden.sdaNein || {}, ks = new Set(); if (!jvRegOn()) return ks; for (const [pid, o] of R) if (!no[pid]) for (const k of o.keys) ks.add(k); return ks; }

/* ---------- Prüfen: Privat und Institution */
function jvInstDialog() {
  const box = h('div', { class: 'jv-inst' });
  let q = '';
  const setTyp = (pid, v, msg) => { commit(d => { const o = Object.assign({}, d.spenden.styp); if (v) o[pid] = v; else delete o[pid]; if (Object.keys(o).length) d.spenden.styp = o; else delete d.spenden.styp; }, msg); draw(); };
  const setWorte = (f, list, msg) => { commit(d => { const o = Object.assign({}, d.spenden.sworte); if (list) o[f] = list; else delete o[f]; if (Object.keys(o).length) d.spenden.sworte = o; else delete d.spenden.sworte; }, msg); draw(); };
  const chips = (f, t) => { const L = jvInstWorte(f), own = Array.isArray((D.spenden.sworte || {})[f]);
    let inp = null;
    const add = () => { const v = inp.value.trim(); if (!v || L.includes(v)) { inp.value = ''; return; } setWorte(f, L.concat(v), 'Stichwort „' + v + '“ für Institutionen ergänzt'); };
    return h('div', { class: 'jv-iw' }, h('div', { class: 'jv-iwh' }, h('b', null, t), own ? h('button', { class: 'link small', onclick: () => setWorte(f, null, 'Stichwörter für Institutionen zurückgesetzt') }, 'Standard wiederherstellen') : null),
      h('div', { class: 'jv-iwl' }, L.map(w => h('span', { class: 'sp-word' }, w, h('button', { class: 'sp-x', 'aria-label': w + ' entfernen', onclick: () => setWorte(f, L.filter(x => x !== w), 'Stichwort „' + w + '“ für Institutionen entfernt') }, '×'))),
        inp = h('input', { class: 'jv-iwi', placeholder: '+ Stichwort', onkeydown: e => { if (e.key === 'Enter') add(); } }))); };
  const row = (o, btn) => h('tr', null, h('td', { class: 'jv-in' }, o.name || '(ohne Namen)'), h('td', { class: 'muted small' }, o.hand ? 'von Hand' : o.why || '–'),
    h('td', { class: 'num' }, de0(o.n)), h('td', { class: 'num' }, eur(o.sum)), h('td', { class: 'small muted' }, fmtD(o.last)), h('td', null, btn));
  const draw = () => {
    const P = jvPayers(), all = [...P.by.values()], inst = all.filter(o => o.typ === 'i').sort((a, b) => b.sum - a.sum);
    const priv = all.filter(o => o.typ === 'p' && (!q || (o.name || '').toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.sum - a.sum).slice(0, q ? 60 : 25);
    const tbl = (list, f) => list.length ? h('table', { class: 'jv-it' }, h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', null, 'Grund'), h('th', { class: 'num' }, 'Spenden'), h('th', { class: 'num' }, 'Summe (alle Jahre)'), h('th', null, 'zuletzt'), h('th'))),
      h('tbody', null, list.map(f))) : h('p', { class: 'muted small' }, '–');
    const srch = h('input', { class: 'jv-isrch', type: 'search', placeholder: 'Name suchen …', value: q, oninput: e => { q = e.target.value; draw(); const s = box.querySelector('.jv-isrch'); s.focus(); s.setSelectionRange(q.length, q.length); } });
    box.replaceChildren(
      h('p', { class: 'muted small' }, 'Die App stuft Zahler:innen als Institution ein, wenn ein Stichwort im Namen des Kontoinhabers oder im Verwendungszweck steht. Alle anderen gelten als privat. Hier lässt sich jede Einstufung von Hand ändern – sie gilt für alle, die die Planung öffnen.'),
      h('div', { class: 'jv-iws' }, chips('name', 'Stichwörter im Namen'), chips('zweck', 'Stichwörter im Verwendungszweck')),
      h('h4', { class: 'jv-h4' }, 'Als Institution eingestuft (' + inst.length + ')'),
      tbl(inst, o => row(o, h('button', { class: 'small jv-itog', onclick: () => setTyp(o.pid, o.auto === 'p' ? null : 'p', (o.name || 'Zahler:in') + ' als privat eingestuft') }, '→ privat'))),
      h('h4', { class: 'jv-h4' }, q ? 'Privat eingestuft – Suche „' + q + '“' : 'Größte privat eingestufte Zahler:innen – hier verstecken sich oft Firmen ohne Rechtsform im Namen'), srch,
      tbl(priv, o => row(o, h('button', { class: 'small jv-itog', onclick: () => setTyp(o.pid, o.auto === 'i' ? null : 'i', (o.name || 'Zahler:in') + ' als Institution eingestuft') }, '→ Institution'))));
  };
  draw();
  modal('Privat und Institution', box, [['Schließen', true, 'primary']], { wide: true, cls: 'jv-imodal' });
}

/* ---------- Prüfen: regelmäßig erkannte Dauerspender:innen */
function jvRegDialog() {
  const box = h('div', { class: 'jv-inst' });
  const draw = () => {
    const R = [...jvRegular().values()].sort((a, b) => b.last - a.last || b.b - a.b), no = D.spenden.sdaNein || {};
    const tog = (o, on) => commit(d => { const x = Object.assign({}, d.spenden.sdaNein); if (on) delete x[o.pid]; else x[o.pid] = 1; if (Object.keys(x).length) d.spenden.sdaNein = x; else delete d.spenden.sdaNein; },
      (o.name || 'Zahler:in') + (on ? ' wieder als Dauerspender:in gezählt' : ' nicht als Dauerspender:in gezählt'));
    box.replaceChildren(
      h('p', { class: 'muted small' }, 'Ohne „Dauerauftrag“ im Buchungstext, aber mit gleichem Betrag (Erhöhungen erlaubt) am etwa gleichen Tag im Monat, mindestens dreimal im Rhythmus: monatlich, vierteljährlich, halbjährlich oder jährlich – halb- und jährlich zusätzlich mit gleichem Verwendungszweck, jährlich mit genau gleichem Betrag. Nur Privat. Häkchen weg = zählt nicht als Dauerspender:in.'),
      R.length ? h('table', { class: 'jv-it' }, h('thead', null, h('tr', null, h('th'), h('th', null, 'Name'), h('th', null, 'Rhythmus'), h('th', { class: 'num' }, 'Betrag'), h('th', null, 'seit'), h('th', null, 'zuletzt'), h('th', { class: 'num' }, 'Buchungen'))),
        h('tbody', null, R.map(o => h('tr', { class: no[o.pid] ? 'off' : '' }, h('td', null, h('input', { type: 'checkbox', checked: !no[o.pid], 'aria-label': (o.name || '') + ' zählt als Dauerspender:in', onchange: e => { tog(o, e.target.checked); draw(); } })),
          h('td', { class: 'jv-in' }, o.name || '(ohne Namen)'), h('td', null, o.rh), h('td', { class: 'num' }, eur(o.b)), h('td', { class: 'small' }, fmtD(o.first)), h('td', { class: 'small' }, fmtD(o.last)), h('td', { class: 'num' }, o.n)))))
        : h('p', { class: 'muted' }, 'Keine regelmäßigen Spenden ohne „Dauerauftrag“ gefunden.'));
  };
  draw();
  modal('Regelmäßig erkannte Dauerspender:innen', box, [['Schließen', true, 'primary']], { wide: true, cls: 'jv-imodal' });
}
