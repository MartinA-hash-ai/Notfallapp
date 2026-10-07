/* ===================================================================== Zusammenführen: wenn zwei gleichzeitig geändert haben */

// Grundregel (je Maßnahme, Urlaub, freiem Tag, Person – und darin je Feld):
// nur eine Seite hat etwas geändert → diese Änderung gilt; beide haben dasselbe Feld verschieden geändert → nachfragen.
const JS = v => JSON.stringify(v === undefined ? null : v);
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const contentOf = d => JSON.stringify(Object.assign({}, d, { meta: null }));
const sameContent = (a, b) => contentOf(a) === contentOf(b);
const MERGE_COLL = [['massnahmen', 'id'], ['urlaube', 'id'], ['sondertage', 'id'], ['ferien', 'id'], ['vorlagen', 'id'], ['personen', 'name']];

function mergeObj(b, m, t, where, conflicts, cnt) {
  b = b || {}; m = m || {}; t = t || {};
  const out = {};
  for (const f of new Set([...Object.keys(b), ...Object.keys(m), ...Object.keys(t)])) {
    const jb = JS(b[f]), jm = JS(m[f]), jt = JS(t[f]);
    let v;
    if (jm === jt) v = m[f];
    else if (jm === jb) { v = t[f]; cnt.t++; }
    else if (jt === jb) { v = m[f]; cnt.m++; }
    else { v = m[f]; conflicts.push(Object.assign({ field: f, mine: m[f], theirs: t[f] }, where)); }
    if (v !== undefined) out[f] = v;
  }
  return out;
}
function mergeList(b, m, t, key, coll, conflicts, cnt) {
  const idx = a => new Map((a || []).map(r => [r[key], r]));
  const B = idx(b), M = idx(m), T = idx(t);
  const order = [...T.keys(), ...[...M.keys()].filter(k => !T.has(k))];
  const res = [];
  for (const k of order) {
    const bv = B.get(k), mv = M.get(k), tv = T.get(k), jb = JS(bv), jm = JS(mv), jt = JS(tv);
    let v;
    if (jm === jt) v = mv;
    else if (jm === jb) { v = tv; cnt.t++; }                   // nur die anderen haben geändert (oder gelöscht)
    else if (jt === jb) { v = mv; cnt.m++; }                   // nur ich habe geändert (oder gelöscht)
    else if (mv && tv) v = mergeObj(bv, mv, tv, { coll, key: k, rec: mv }, conflicts, cnt);
    else { v = mv || tv; conflicts.push({ coll, key: k, field: null, rec: mv || tv, mine: mv, theirs: tv }); }   // gelöscht ↔ geändert
    if (v) res.push(v);
  }
  return res;
}
function merge3(base, mine, theirs) {
  const conflicts = [], cnt = { m: 0, t: 0 }, out = clone(theirs);
  for (const [coll, key] of MERGE_COLL) out[coll] = mergeList(base[coll], mine[coll], theirs[coll], key, coll, conflicts, cnt);
  out.settings = mergeObj(base.settings, mine.settings, theirs.settings, { coll: 'settings', key: null }, conflicts, cnt);
  out.feiertage = mergeObj(base.feiertage, mine.feiertage, theirs.feiertage, { coll: 'feiertage', key: null }, conflicts, cnt);
  out.spenden = {};                                          // Spenden je Buchung: wie ein Feld behandeln
  for (const sub of ['zu', 'vor', 'nein']) {
    const cf = sub === 'zu' ? conflicts : [];                  // nur echte Zuordnungen nachfragen; Vormerkungen: eigene Fassung, Ablehnungen: beide
    out.spenden[sub] = mergeObj((base.spenden || {})[sub], (mine.spenden || {})[sub], (theirs.spenden || {})[sub], { coll: 'spenden', key: sub, rec: { sub } }, cf, cnt);
    if (sub === 'nein') for (const c of cf) out.spenden.nein[c.field] = [...new Set([].concat(c.mine || [], c.theirs || []))];
  }
  out.spenden.allg = mergeObj((base.spenden || {}).allg, (mine.spenden || {}).allg, (theirs.spenden || {}).allg, { coll: 'spenden', key: 'allg' }, [], cnt);   // Regeln der allgemeinen Spenden: eigene Fassung
  out.meta = clone(theirs.meta);
  return { data: clone(out), conflicts, cnt };
}
function applyPick(data, c) {
  if (c.pick !== 'theirs') return;
  if (c.coll === 'settings' || c.coll === 'feiertage') { if (c.theirs === undefined) delete data[c.coll][c.field]; else data[c.coll][c.field] = clone(c.theirs); return; }
  if (c.coll === 'spenden') { const o = data.spenden[c.key]; if (c.theirs === undefined) delete o[c.field]; else o[c.field] = clone(c.theirs); return; }
  const key = c.coll === 'personen' ? 'name' : 'id', arr = data[c.coll], i = arr.findIndex(r => r[key] === c.key);
  if (c.field == null) { if (c.theirs) { if (i >= 0) arr[i] = clone(c.theirs); else arr.push(clone(c.theirs)); } else if (i >= 0) arr.splice(i, 1); }
  else if (i >= 0) { if (c.theirs === undefined) delete arr[i][c.field]; else arr[i][c.field] = clone(c.theirs); }
}

/* ---------- Anzeige */
const FIELD_LABEL = { name: 'Name', pal: 'PAL', palStatus: 'PAL-Status', vorlauf: 'Starts der Bereiche', ende: 'Enden der Bereiche', bereiche: 'Bereiche', verantwortlich: 'Hauptverantwortlich',
  auflage: 'Auflage', kosten: 'Kosten', regel: 'Spendenregel', art: 'Spendenbitte', hinweis: 'Hinweis', farbe: 'Farbe', plan: 'Detailplan', wer: 'Person', von: 'von', bis: 'bis', notiz: 'Notiz', datum: 'Datum', year: 'Planungsjahr' };
function recLabel(coll, rec, key) {
  rec = rec || {};
  if (coll === 'massnahmen') return 'Maßnahme „' + (rec.name || '(ohne Namen)') + '“';
  if (coll === 'urlaube') return vacKind(rec) + ' ' + (rec.wer || '?') + ' ' + fmtS(dn(rec.von)) + '–' + fmtS(dn(rec.bis) ?? dn(rec.von));
  if (coll === 'vorlagen') return 'Vorlage „' + (rec.name || 'ohne Namen') + '“';
  if (coll === 'ferien') return 'Ferien' + (rec.notiz ? ' „' + rec.notiz + '“' : '') + ' ' + fmtS(dn(rec.von)) + '–' + fmtS(dn(rec.bis) ?? dn(rec.von));
  if (coll === 'sondertage') return 'Freier Tag „' + (rec.name || 'ohne Namen') + '“ ' + fmtS(dn(rec.datum));
  if (coll === 'personen') return 'Person ' + (rec.name || key);
  if (coll === 'feiertage') return 'Feiertage';
  if (coll === 'spenden') return rec && rec.n ? rec.n + ' Spendenzuordnung' + (rec.n === 1 ? '' : 'en') + ', die hier fehlen' : key === 'vor' ? 'Spende zur Prüfung' : key === 'nein' ? 'abgelehnter Vorschlag' : 'Spendenzuordnung';
  return 'Einstellungen';
}
function valText(coll, field, v, rec) {
  if (field == null) return v ? 'behalten' : 'gelöscht';
  if (coll === 'spenden') {
    const mn = id => '„' + spMName(id) + '“', sub = rec && rec.sub;
    if (v == null) return sub === 'zu' ? 'nicht zugeordnet' : '–';
    return sub === 'zu' ? 'zugeordnet zu ' + mn(v.m) : sub === 'vor' ? 'zur Prüfung bei ' + mn(v) : 'abgelehnt bei ' + [].concat(v).map(mn).join(', ');
  }
  if (coll === 'feiertage') return !v ? 'wie gesetzlich' : v.off ? 'abgeschaltet' : [v.name, v.datum ? 'am ' + fmtD(dn(v.datum)) : ''].filter(Boolean).join(' ') || 'geändert';
  if (v == null || v === '') return '–';
  if (['pal', 'von', 'bis', 'datum'].includes(field)) return fmtW(dn(v));
  if (field === 'vorlauf' || field === 'ende') { const p = dn(rec && rec.pal); const e = Object.entries(v || {}); return e.length ? e.map(([k, n]) => k + ' ' + (p != null ? fmtS(p - n) : n + ' T.')).join(' · ') : '–'; }
  if (field === 'bereiche' && Array.isArray(v)) return v.map(p => (p.zeichen || p.key) + ' ' + p.name + (p.stil && p.stil !== 'pastell' ? ' (' + (STILE[p.stil] || p.stil) + ')' : '') + (p.linie && p.linie !== 'auto' ? ' Linie ' + (LINIEN[p.linie] || p.linie) : '')).join(', ');
  if (coll === 'settings' && field === 'pal' && v && typeof v === 'object') return 'PAL-Markierung ' + (v.zeichen || 'P') + ' (' + (STILE[v.stil] || v.stil || '') + ')';
  if (field === 'plan') return v && v.steps ? v.steps.length + ' Schritte' : 'kein Detailplan';
  if (field === 'kosten') return eur(Math.round(+v * 100));
  if (field === 'regel') { const r = v || {}, p = dn(rec && rec.pal); return ((r.worte || []).map(w => '„' + w + '“').join(', ') || 'ohne Schlagwort') + (p != null && (isNum(r.ab) || isNum(r.bis)) ? ' (' + (isNum(r.ab) ? fmtS(p + r.ab) : '…') + '–' + (isNum(r.bis) ? fmtS(p + r.bis) : '…') + ')' : '') + (r.ohneDA ? ', ohne Daueraufträge' : ''); }
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
  return String(v).slice(0, 80);
}
const fieldName = (coll, f) => coll === 'feiertage' ? fmtD(dn(f)) : coll === 'spenden' ? spKeyLabel(f) : FIELD_LABEL[f] || f;

// Drei-Wege-Zusammenführung mit Rückfrage bei echten Überschneidungen; liefert die neuen Daten oder null (abgebrochen)
async function mergeWithUI(base, mine, theirs, who) {
  const r = merge3(base, mine, theirs);
  if (!r.conflicts.length) return normalize(r.data);
  r.conflicts.forEach(c => { c.pick = 'mine'; });
  const row = (c, i) => {
    const rec = c.rec || c.mine || c.theirs;
    const opt = (which, label, v) => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'mc' + i, checked: c.pick === which, onchange: () => { c.pick = which; } }),
      h('b', null, label + ': '), valText(c.coll, c.field, v, rec));
    return h('div', { class: 'mrow' }, h('div', { class: 'mlab' }, recLabel(c.coll, rec, c.key), c.field != null ? ' › ' + fieldName(c.coll, c.field) : ''),
      opt('mine', 'deine Fassung', c.mine), opt('theirs', who, c.theirs));
  };
  const ok = await modal('Änderungen zusammenführen', h('div', { class: 'form mergeform' },
    h('p', null, 'Übernommen: ' + r.cnt.t + ' Änderung' + (r.cnt.t === 1 ? '' : 'en') + ' von ' + who + ' und ' + r.cnt.m + ' eigene. ' +
      'Bei ' + r.conflicts.length + ' Punkt' + (r.conflicts.length === 1 ? '' : 'en') + ' wurde dasselbe unterschiedlich geändert – bitte wählen:'),
    r.conflicts.map(row)), [['Abbrechen', false], ['Zusammenführen', true, 'primary']], { wide: true });
  if (!ok) return null;
  r.conflicts.forEach(c => applyPick(r.data, c));
  return normalize(r.data);
}

// Zwei Stände ohne gemeinsamen Ausgangspunkt vergleichen (z. B. OneDrive-Konfliktkopie): auswählen, was übernommen wird
async function compareDialog(other, label) {
  const items = [];
  for (const [coll, key] of MERGE_COLL) {
    const M = new Map(D[coll].map(r => [r[key], r])), O = new Map((other[coll] || []).map(r => [r[key], r]));
    for (const [k, o] of O) {
      const m = M.get(k);
      if (!m) items.push({ coll, key: k, kind: 'new', rec: o, take: true });
      else if (JS(m) !== JS(o)) items.push({ coll, key: k, kind: 'diff', rec: o, mine: m, take: false,
        fields: [...new Set([...Object.keys(m), ...Object.keys(o)])].filter(f => f !== 'id' && JS(m[f]) !== JS(o[f])) });
    }
    for (const [k, m] of M) if (!O.has(k)) items.push({ coll, key: k, kind: 'only', rec: m });
  }
  if (JS(D.feiertage) !== JS(other.feiertage)) items.push({ coll: 'feiertage', kind: 'diff', rec: other.feiertage, take: false, fields: [] });
  const oz = (other.spenden || {}).zu || {}, onlyThere = Object.keys(oz).filter(k => !D.spenden.zu[k]);
  if (onlyThere.length) items.push({ coll: 'spenden', kind: 'new', rec: { n: onlyThere.length }, keys: onlyThere, take: true });
  const act = items.filter(i => i.kind !== 'only');
  if (!act.length) { await modal('Keine Unterschiede', h('p', null, 'In ' + label + ' steht nichts, was hier fehlt oder anders ist.')); return normalize(clone(D)); }
  const line = it => {
    const cb = h('input', { type: 'checkbox', checked: it.take, onchange: e => { it.take = e.target.checked; } });
    return h('div', { class: 'mrow' }, h('label', { class: 'check' }, cb, h('b', null, recLabel(it.coll, it.rec, it.key))),
      it.kind === 'diff' && it.fields.length ? h('div', { class: 'mdiff muted small' }, it.fields.map(f =>
        h('div', null, fieldName(it.coll, f) + ': hier ' + valText(it.coll, f, it.mine[f], it.mine) + ' · dort ' + valText(it.coll, f, it.rec[f], it.rec)))) : null);
  };
  const sec = (title, list, hint) => list.length ? [h('h3', null, title + ' (' + list.length + ')'), hint ? h('p', { class: 'muted small' }, hint) : null, list.map(line)] : null;
  const only = items.filter(i => i.kind === 'only');
  const ok = await modal('Vergleichen und übernehmen', h('div', { class: 'form mergeform' },
    h('p', null, 'Vergleich des aktuellen Stands mit ' + label + '. Angehakte Einträge werden von dort übernommen.'),
    sec('Nur dort vorhanden', items.filter(i => i.kind === 'new'), 'meist neu angelegt – standardmäßig übernehmen'),
    sec('Unterschiedlich', items.filter(i => i.kind === 'diff'), 'welche Fassung neuer ist, lässt sich nicht erkennen – bitte prüfen'),
    only.length ? [h('h3', null, 'Nur hier vorhanden (' + only.length + ')'), h('p', { class: 'muted small' }, only.map(i => recLabel(i.coll, i.rec, i.key)).join(' · ') + ' – bleibt erhalten')] : null),
    [['Abbrechen', false], ['Übernehmen', true, 'primary']], { wide: true });
  if (!ok) return null;
  const out = clone(D);
  for (const it of act) {
    if (!it.take) continue;
    if (it.coll === 'feiertage') { out.feiertage = clone(it.rec); continue; }
    if (it.coll === 'spenden') { for (const k of it.keys) { out.spenden.zu[k] = clone(oz[k]); delete out.spenden.vor[k]; } continue; }
    const key = it.coll === 'personen' ? 'name' : 'id', arr = out[it.coll], i = arr.findIndex(r => r[key] === it.key);
    if (i >= 0) arr[i] = clone(it.rec); else arr.push(clone(it.rec));
  }
  return normalize(out);
}

/* ---------- Änderungsprotokoll: lesbare Beschreibung, was sich zwischen zwei Ständen geändert hat */
function describeChanges(a, b, max = 12) {
  const out = [];
  for (const [coll, key] of MERGE_COLL) {
    const A = new Map((a[coll] || []).map(r => [r[key], r])), B = new Map((b[coll] || []).map(r => [r[key], r]));
    for (const [k, r] of B) {
      const o = A.get(k), lab = recLabel(coll, r, k);
      if (!o) { out.push(lab + ' angelegt'); continue; }
      if (JS(o) === JS(r)) continue;
      for (const f of [...new Set([...Object.keys(o), ...Object.keys(r)])].filter(f => JS(o[f]) !== JS(r[f]))) {
        if (f === 'plan') out.push(lab + ': ' + planChange(o.plan, r.plan));
        else if (f === 'vorlauf' || f === 'ende') {
          const pa = dn(o.pal), pb = dn(r.pal), va = o[f] || {}, vb = r[f] || {};
          for (const ph of new Set([...Object.keys(va), ...Object.keys(vb)])) if (va[ph] !== vb[ph])
            out.push(lab + ': ' + (f === 'ende' ? 'Ende ' + phName(ph) : startLabel(ph)) + ' ' + (va[ph] != null && pa != null ? fmtS(pa - va[ph]) : '–') + ' → ' + (vb[ph] != null && pb != null ? fmtS(pb - vb[ph]) : '–'));
        } else out.push(lab + ': ' + fieldName(coll, f) + ' ' + valText(coll, f, o[f], o) + ' → ' + valText(coll, f, r[f], r));
      }
    }
    for (const [k, o] of A) if (!B.has(k)) out.push(recLabel(coll, o, k) + ' gelöscht');
  }
  if (JS(a.feiertage) !== JS(b.feiertage)) out.push('Feiertage geändert');
  const za = (a.spenden || {}).zu || {}, zb = (b.spenden || {}).zu || {}, plus = new Map(), minus = new Map(), cnt1 = (mp, k) => mp.set(k, (mp.get(k) || 0) + 1);
  for (const [k, z] of Object.entries(zb)) if (!za[k] || za[k].m !== z.m) cnt1(plus, z.m);
  for (const [k, z] of Object.entries(za)) if (!zb[k] || zb[k].m !== z.m) cnt1(minus, z.m);
  const mName = id => { if (isAllg(id)) return '„Allgemeine Spenden ' + id.slice(5) + '“'; const m = (b.massnahmen || []).find(q => q.id === id) || (a.massnahmen || []).find(q => q.id === id); return '„' + ((m && m.name) || '?') + '“'; };
  for (const [id, n] of plus) out.push('Spenden: ' + n + ' der Maßnahme ' + mName(id) + ' zugeordnet');
  for (const [id, n] of minus) out.push('Spenden: ' + n + ' Zuordnung' + (n === 1 ? '' : 'en') + ' bei ' + mName(id) + ' gelöst');
  const sa = a.settings || {}, sb = b.settings || {};
  if (JS(sa.bereiche) !== JS(sb.bereiche)) out.push('Bereiche: ' + (sb.bereiche || []).map(p => (p.zeichen || p.key) + ' ' + p.name).join(', '));
  if (JS(sa.pal) !== JS(sb.pal)) out.push('PAL-Markierung: ' + ((sb.pal || {}).zeichen || 'P') + ' (' + (STILE[(sb.pal || {}).stil] || '') + ')');
  if (sa.year !== sb.year) out.push('Planungsjahr ' + sa.year + ' → ' + sb.year);
  if (JS(sa.richtwerte) !== JS(sb.richtwerte)) out.push('Richtwerte der Spenden-Kennzahlen geändert');
  return out.length > max ? out.slice(0, max).concat('… und ' + (out.length - max) + ' weitere Änderungen') : out;
}
function planChange(p, q) {
  if (!p) return 'Detailplan angelegt';
  if (!q) return 'Detailplan entfernt';
  const A = new Map(p.steps.map(s => [s.id, s])), B = new Map(q.steps.map(s => [s.id, s])), parts = [];
  const what = (o, s, k) => k === 'dauer' ? 'Dauer ' + (+o.dauer || 0) + ' → ' + (+s.dauer || 0) + ' WT' : k === 'wer' ? 'Person ' + (o.wer || '–') + ' → ' + (s.wer || '–')
    : k === 'fortschritt' ? (+s.fortschritt >= 100 ? 'erledigt' : 'Fortschritt ' + (+s.fortschritt || 0) + ' %') : k === 'bereich' ? 'Bereich ' + (s.bereich ? s.bereich + ' ' + phName(s.bereich) : '–')
    : k === 'anker' ? 'Termin verschoben' : k === 'name' ? 'umbenannt (vorher „' + o.name + '“)' : k === 'typ' ? 'jetzt ' + (STEP_TYPES[s.typ] || s.typ) : k === 'kommentar' ? 'Kommentar geändert' : k === 'fix' ? (s.fix ? 'Dauer festgelegt' : 'Dauer freigegeben') : k;
  for (const [id, s] of B) {
    const o = A.get(id);
    if (!o) parts.push('„' + s.name + '“ neu');
    else if (JS(o) !== JS(s)) parts.push('„' + s.name + '“ ' + ['name', 'dauer', 'wer', 'anker', 'bereich', 'typ', 'fortschritt', 'kommentar', 'fix'].filter(k => JS(o[k]) !== JS(s[k])).map(k => what(o, s, k)).join(', '));
  }
  for (const [id, s] of A) if (!B.has(id)) parts.push('„' + s.name + '“ gelöscht');
  if (!parts.length && JS(p.marks) !== JS(q.marks)) parts.push('Beginn eines Bereichs neu festgelegt');
  if (!parts.length) parts.push('Reihenfolge geändert');
  return 'Detailplan: ' + parts.slice(0, 4).join('; ') + (parts.length > 4 ? ' … (' + (parts.length - 4) + ' weitere)' : '');
}
function logDialog() {
  let q = '';
  const list = h('div', { class: 'logview' });
  const draw = () => {
    const ents = (D.log || []).slice().reverse().filter(e => !q || (e.by || '').toLowerCase().includes(q) || (e.items || []).some(t => t.toLowerCase().includes(q)));
    setKids(list, ents.length ? ents.slice(0, 200).map(e => h('div', { class: 'logent' },
      h('div', { class: 'loghead' }, h('b', null, fmtStamp(e.at)), e.by ? ' · ' + e.by : ''),
      h('ul', null, (e.items || []).map(t => h('li', null, t))))) : h('p', { class: 'muted' }, q ? 'Nichts gefunden.' : 'Noch keine Änderungen protokolliert – das Protokoll beginnt mit Version 0.8.'));
  };
  draw();
  modal('Änderungsprotokoll', h('div', { class: 'form' },
    h('p', { class: 'muted small' }, 'Bei jedem Speichern hält die App fest, wer was geändert hat (die letzten ' + LOG_MAX + ' Speicherungen). Neueste oben.'),
    h('input', { placeholder: 'suchen, z. B. „Sommermailing“ oder „Eva“', oninput: e => { q = e.target.value.trim().toLowerCase(); draw(); } }), list), null, { wide: true });
}
