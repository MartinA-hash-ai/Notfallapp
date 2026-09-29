/* ===================================================================== Zusammenführen: wenn zwei gleichzeitig geändert haben */

// Grundregel (je Maßnahme, Urlaub, freiem Tag, Person – und darin je Feld):
// nur eine Seite hat etwas geändert → diese Änderung gilt; beide haben dasselbe Feld verschieden geändert → nachfragen.
const JS = v => JSON.stringify(v === undefined ? null : v);
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const contentOf = d => JSON.stringify(Object.assign({}, d, { meta: null }));
const sameContent = (a, b) => contentOf(a) === contentOf(b);
const MERGE_COLL = [['massnahmen', 'id'], ['urlaube', 'id'], ['sondertage', 'id'], ['personen', 'name']];

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
  out.meta = clone(theirs.meta);
  return { data: clone(out), conflicts, cnt };
}
function applyPick(data, c) {
  if (c.pick !== 'theirs') return;
  if (c.coll === 'settings' || c.coll === 'feiertage') { if (c.theirs === undefined) delete data[c.coll][c.field]; else data[c.coll][c.field] = clone(c.theirs); return; }
  const key = c.coll === 'personen' ? 'name' : 'id', arr = data[c.coll], i = arr.findIndex(r => r[key] === c.key);
  if (c.field == null) { if (c.theirs) { if (i >= 0) arr[i] = clone(c.theirs); else arr.push(clone(c.theirs)); } else if (i >= 0) arr.splice(i, 1); }
  else if (i >= 0) { if (c.theirs === undefined) delete arr[i][c.field]; else arr[i][c.field] = clone(c.theirs); }
}

/* ---------- Anzeige */
const FIELD_LABEL = { name: 'Name', pal: 'PAL', palStatus: 'PAL-Status', vorlaufS: 'Start Selektion', vorlaufI: 'Start Inhalt', verantwortlich: 'Hauptverantwortlich',
  auflage: 'Auflage', art: 'Bitte', hinweis: 'Hinweis', farbe: 'Farbe', plan: 'Detailplan', wer: 'Person', von: 'von', bis: 'bis', notiz: 'Notiz', datum: 'Datum', year: 'Planungsjahr' };
function recLabel(coll, rec, key) {
  rec = rec || {};
  if (coll === 'massnahmen') return 'Maßnahme „' + (rec.name || '(ohne Namen)') + '“';
  if (coll === 'urlaube') return 'Urlaub ' + (rec.wer || '?') + ' ' + fmtS(dn(rec.von)) + '–' + fmtS(dn(rec.bis) ?? dn(rec.von));
  if (coll === 'sondertage') return 'Freier Tag „' + (rec.name || 'ohne Namen') + '“ ' + fmtS(dn(rec.datum));
  if (coll === 'personen') return 'Person ' + (rec.name || key);
  if (coll === 'feiertage') return 'Feiertage';
  return 'Einstellungen';
}
function valText(coll, field, v, rec) {
  if (field == null) return v ? 'behalten' : 'gelöscht';
  if (coll === 'feiertage') return !v ? 'wie gesetzlich' : v.off ? 'abgeschaltet' : [v.name, v.datum ? 'am ' + fmtD(dn(v.datum)) : ''].filter(Boolean).join(' ') || 'geändert';
  if (v == null || v === '') return '–';
  if (['pal', 'von', 'bis', 'datum'].includes(field)) return fmtW(dn(v));
  if (field === 'vorlaufS' || field === 'vorlaufI') { const p = dn(rec && rec.pal); return p != null && isNum(v) ? fmtW(p - v) : v + ' Tage vor PAL'; }
  if (field === 'plan') return v && v.steps ? v.steps.length + ' Schritte' : 'kein Detailplan';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
  return String(v).slice(0, 80);
}
const fieldName = (coll, f) => coll === 'feiertage' ? fmtD(dn(f)) : FIELD_LABEL[f] || f;

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
    const key = it.coll === 'personen' ? 'name' : 'id', arr = out[it.coll], i = arr.findIndex(r => r[key] === it.key);
    if (i >= 0) arr[i] = clone(it.rec); else arr.push(clone(it.rec));
  }
  return normalize(out);
}
