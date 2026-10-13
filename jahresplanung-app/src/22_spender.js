/* ===================================================================== Jahresvergleich: Spender:innen – Privat oder Institution, regelmäßige Spenden (Dauerspender:innen ohne „Dauerauftrag“) */

// Zahler:in = IBAN (ohne IBAN: Name). In der Planungsdatei steht nur ein Kürzel (Hash), keine Kontonummer.
// Institution: Stichwort einer Art (Banken, Stiftungen, Kommunen …) im Namen des Kontoinhabers oder im Verwendungszweck; passen mehrere, zählt das längste Wort
// („Stadtsparkasse“ → Sparkasse, „Kirchengemeinde“ vor „Gemeinde“). Von Hand umstellbar (D.spenden.styp: „p“, „i“ oder „i:art“).
// Kurze Stichwörter (bis 4 Zeichen, z. B. „AG“, „e.V.“) zählen nur als ganzes Wort, längere auch mitten im Wort („Stiftung“ → „Bürgerstiftung“).
const JV_SONST = 'sonst';
function jvArten() {
  const s = D.spenden.sarten;
  if (!isObj(s)) return JV_ARTEN.map((a, i) => ({ id: a.id, t: a.t, n: a.n.slice(), z: a.z.slice(), o: i }));
  return Object.entries(s).map(([id, a]) => ({ id, t: a.t, n: a.n || [], z: a.z || [], o: isNum(a.o) ? a.o : 99 })).sort((x, y) => x.o - y.o);
}
const jvArtName = id => id === JV_SONST ? 'sonstige Institutionen' : ((jvArten().find(a => a.id === id) || {}).t || 'sonstige Institutionen');
const jvKwRe = w => { const t = w.toLowerCase().replace(/\s+/g, ''), core = t.replace(/[^a-zäöüß0-9]/g, ''), esc = t.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  return core.length <= 4 || /\.$/.test(t) ? new RegExp('(^|[^a-zäöüß0-9])' + esc + '(?=$|[^a-zäöüß0-9])') : new RegExp(esc); };   // kurz: ganzes Wort; lang: auch im Wort
const jvNormTxt = s => ' ' + str(s).toLowerCase().replace(/e\.\s+v\./g, 'e.v.').replace(/\s+/g, ' ') + ' ';
const jvPid = r => spHash(jvDonor(r));

// alle Zahler:innen mit Einstufung und Art (gecacht)
let _jvPay = { key: null, val: null };
function jvPayers() {
  const key = SP.sig + '|' + SP.rows.length + '|' + JSON.stringify(D.spenden.sarten || null) + '|' + JSON.stringify(D.spenden.styp || {});
  if (_jvPay.key === key && _jvPay.rows === SP.rows) return _jvPay.val;
  const A = jvArten(), ids = new Set(A.map(a => a.id)), man = D.spenden.styp || {};
  const re = f => A.flatMap((a, i) => a[f].map(w => ({ w, a: a.id, i, len: w.replace(/\s+/g, '').length, re: jvKwRe(w) })));
  const nameRe = re('n'), zweckRe = re('z');
  const best = (L, txt) => { let b = null; for (const x of L) if (x.re.test(txt) && (!b || x.len > b.len || (x.len === b.len && x.i < b.i))) b = x; return b; };   // längstes passendes Wort
  const by = new Map(), pidOf = new Map();
  for (const r of SP.rows) {
    const dk = jvDonor(r); let pid = pidOf.get(dk); if (!pid) { pid = spHash(dk); pidOf.set(dk, pid); }
    let o = by.get(pid); if (!o) by.set(pid, o = { pid, dk, name: r.name || '', iban: r.iban || '', n: 0, sum: 0, first: r.d, last: r.d, why: null, autoArt: null });
    o.n++; o.sum += r.b; if (r.d < o.first) o.first = r.d; if (r.d > o.last) { o.last = r.d; if (r.name) o.name = r.name; }
    if (!o.why) { const m = best(nameRe, jvNormTxt(r.name)) || null, z = m ? null : best(zweckRe, jvNormTxt(r.zweck));
      if (m) { o.why = 'Name: „' + m.w + '“'; o.autoArt = m.a; } else if (z) { o.why = 'Verwendungszweck: „' + z.w + '“'; o.autoArt = z.a; } }
  }
  for (const o of by.values()) { const h = man[o.pid] || null; o.auto = o.why ? 'i' : 'p'; o.hand = h; o.typ = h ? h[0] : o.auto;
    o.art = o.typ !== 'i' ? null : h && h.length > 2 && ids.has(h.slice(2)) ? h.slice(2) : o.autoArt || JV_SONST; }
  _jvPay = { key, rows: SP.rows, val: { by, pidOf } };
  return _jvPay.val;
}
const jvTypOf = r => { const P = jvPayers(), pid = P.pidOf.get(jvDonor(r)), o = pid && P.by.get(pid); return o ? o.typ : 'p'; };
const jvGrp = () => ['privat', 'inst'].includes(UI.jvGrp) ? UI.jvGrp : 'alle';
const jvGrpName = g => g === 'privat' ? 'nur Privat' : g === 'inst' ? 'nur Institutionen' : 'alle Spender:innen';
// von Hand einstufen: v = 'p', 'i:art' oder null (aufheben); stimmt es mit der Erkennung überein, braucht es keinen Eintrag
function jvSetTyp(o, v, msg) {
  if (v === 'p' && o.auto === 'p') v = null;
  if (v && v.startsWith('i:') && o.auto === 'i' && o.autoArt === v.slice(2)) v = null;
  commit(d => { const x = Object.assign({}, d.spenden.styp); if (v) x[o.pid] = v; else delete x[o.pid]; if (Object.keys(x).length) d.spenden.styp = x; else delete d.spenden.styp; }, msg);
}
// Arten ändern: beim ersten Mal wird der Standard in die Planungsdatei übernommen
function jvSetArten(fn, msg) { commit(d => { const L = jvArten().map(a => Object.assign({}, a, { n: a.n.slice(), z: a.z.slice() })); fn(L); const o = {}; L.forEach((a, i) => { o[a.id] = { t: a.t, n: a.n, z: a.z, o: i }; }); d.spenden.sarten = o; }, msg); }

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

/* ---------- Regeln: Arten mit Stichwörtern, von Hand eingestufte, größte privat eingestufte zum Prüfen */
function jvArtPick(anchor, o, after) {                                 // „→ Institution ▾“: Art wählen
  popover(anchor, h('div', { class: 'jv-kpop' }, h('div', { class: 'menu-head' }, 'Als Institution einstufen'),
    jvArten().concat({ id: JV_SONST, t: 'sonstige Institutionen' }).map(a => h('button', { class: 'mitem', onclick: () => { closeMenu(); jvSetTyp(o, 'i:' + a.id, (o.name || 'Zahler:in') + ' als „' + a.t + '“ eingestuft'); if (after) after(); } }, a.t))));
}
function jvInstDialog() {
  const box = h('div', { class: 'jv-inst' });
  let q = '';
  const draw = () => {
    const P = jvPayers(), all = [...P.by.values()], A = jvArten(), y = UI.year, a0 = mkdn(y, 1, 1), a1 = mkdn(y, 12, 31);
    const inY = new Set(); for (const r of SP.rows) if (r.d >= a0 && r.d <= a1) inY.add(P.pidOf.get(jvDonor(r)));
    const hits = id => all.filter(o => o.typ === 'i' && o.art === id && inY.has(o.pid)).length;
    const chips = (a, f) => { let inp = null;
      const add = () => { const v = inp.value.trim(); inp.value = ''; if (!v || a[f].includes(v)) return; jvSetArten(L => { const x = L.find(z => z.id === a.id); if (!x[f].includes(v)) x[f].push(v); }, 'Stichwort „' + v + '“ bei „' + a.t + '“ ergänzt'); draw(); };
      return h('div', { class: 'jv-iwl' }, a[f].map(w => h('span', { class: 'sp-word' }, w, h('button', { class: 'sp-x', 'aria-label': w + ' entfernen', onclick: () => { jvSetArten(L => { const x = L.find(z => z.id === a.id); x[f] = x[f].filter(z => z !== w); }, 'Stichwort „' + w + '“ bei „' + a.t + '“ entfernt'); draw(); } }, '×'))),
        inp = h('input', { class: 'jv-iwi', placeholder: '+', 'aria-label': 'Stichwort für ' + a.t, onkeydown: e => { if (e.key === 'Enter') add(); }, onblur: () => { if (inp.value.trim()) add(); } })); };
    const rules = h('table', { class: 'jv-rt' }, h('thead', null, h('tr', null, h('th', null, 'Art'), h('th', null, 'im Namen'), h('th', null, 'im Verwendungszweck'), h('th', { class: 'num' }, 'Treffer ' + y))),
      h('tbody', null, A.map(a => h('tr', { dataset: { art: a.id } }, h('td', { class: 'jv-rart' }, a.t, !JV_ARTEN.some(x => x.id === a.id) && !a.n.length && !a.z.length ? h('button', { class: 'link small', onclick: () => { jvSetArten(L => { L.splice(L.findIndex(x => x.id === a.id), 1); }, 'Art „' + a.t + '“ entfernt'); draw(); } }, 'entfernen') : null),
        h('td', null, chips(a, 'n')), h('td', null, chips(a, 'z')), h('td', { class: 'num' }, de0(hits(a.id)))))));
    const addArt = () => { const t = (window.prompt('Name der neuen Art (z. B. „Serviceclubs“):') || '').trim(); if (!t) return; let id = 'a' + spHash(t).slice(0, 6).toLowerCase().replace(/[^a-z0-9]/g, 'x');
      jvSetArten(L => { if (!L.some(x => x.id === id)) L.push({ id, t, n: [], z: [] }); }, 'Art „' + t + '“ angelegt'); draw(); };
    const hand = all.filter(o => o.hand).sort((a, b) => b.sum - a.sum);
    const pill = o => o.typ === 'i' ? h('span', { class: 'jv-pill i' }, jvArtName(o.art)) : h('span', { class: 'jv-pill p' }, 'privat');
    const priv = all.filter(o => o.typ === 'p' && (!q || (o.name || '').toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.sum - a.sum).slice(0, q ? 40 : 8);
    const srch = h('input', { class: 'jv-isrch', type: 'search', placeholder: 'Name suchen …', value: q, oninput: e => { q = e.target.value; draw(); const s = box.querySelector('.jv-isrch'); s.focus(); s.setSelectionRange(q.length, q.length); } });
    const iN = all.filter(o => o.typ === 'i' && inY.has(o.pid)), pN = all.filter(o => o.typ === 'p' && inY.has(o.pid));
    box.replaceChildren(
      h('p', { class: 'jv-ilead' }, 'Steht eines dieser Wörter im ', h('b', null, 'Namen'), ' des Kontoinhabers oder im ', h('b', null, 'Verwendungszweck'), ', zählt die Zahlung als Institution der jeweiligen Art – alle anderen als privat. Lange Wörter greifen auch im Wort (Bürgerstiftung), kurze Abkürzungen nur einzeln (AG, e.V.).'),
      rules,
      h('div', { class: 'jv-ifoot' }, h('button', { class: 'link small jv-addart', onclick: addArt }, '+ Art hinzufügen'),
        D.spenden.sarten ? h('button', { class: 'link small jv-artstd', onclick: () => { commit(d => { delete d.spenden.sarten; }, 'Arten und Stichwörter auf den Standard zurückgesetzt'); draw(); } }, 'Standard wiederherstellen') : null),
      h('div', { class: 'jv-icols' },
        h('div', { class: 'jv-ibox' }, h('h4', { class: 'jv-h4' }, 'Von Hand eingestuft (' + hand.length + ')'),
          hand.length ? h('table', { class: 'jv-it jv-hand' }, h('tbody', null, hand.map(o => h('tr', null, h('td', { class: 'jv-in' }, o.name || '(ohne Namen)', o.why ? h('div', { class: 'muted small' }, 'Treffer ' + o.why.replace(/^[^:]*: /, '')) : null),
            h('td', { class: 'num' }, pill(o)), h('td', { class: 'num' }, h('button', { class: 'small jv-unhand', onclick: () => { jvSetTyp(o, null, (o.name || 'Zahler:in') + ': Einstufung von Hand aufgehoben'); draw(); } }, 'aufheben')))))) : h('p', { class: 'muted small' }, '–')),
        h('div', { class: 'jv-ibox' }, h('h4', { class: 'jv-h4' }, 'Prüfen: größte privat eingestufte Zahler:innen'), srch,
          h('table', { class: 'jv-it jv-priv' }, h('tbody', null, priv.map(o => { let b = null; b = h('button', { class: 'small jv-itog', onclick: e => { e.stopPropagation(); jvArtPick(b, o, draw); } }, '→ Institution ▾');
            return h('tr', null, h('td', { class: 'jv-in' }, o.name || '(ohne Namen)'), h('td', { class: 'num' }, eur0(o.sum)), h('td', { class: 'num' }, b)); }))))),
      h('p', { class: 'jv-ires' }, 'Ergebnis ' + y + ': ', h('b', null, de0(iN.length) + ' Institutionen'), ' · ', h('b', null, de0(pN.length) + ' privat')));
  };
  draw();
  modal('Privat und Institutionen – Regeln', box, [['Schließen', true, 'primary']], { wide: true, cls: 'jv-imodal' }).then(() => renderNow());
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
