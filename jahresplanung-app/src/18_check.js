/* ===================================================================== Datenprüfung: Auffälligkeiten finden und Reparatur vorschlagen */

// Jeder Fund: Text, vorgeschlagene Reparatur (Beschriftung) und eine Funktion, die sie auf den Datenstand d anwendet
function checkData(d = D) {
  const out = [], keys = PH().map(p => p.key);
  const add = (text, label, fix) => out.push({ text, label, fix, on: true });
  for (const m of d.massnahmen) {
    const nm = '„' + (m.name || '(ohne Namen)') + '“', mid = m.id, M = dd => findM(dd, mid);
    if (m.pal && dn(m.pal) == null) add(nm + ': PAL „' + m.pal + '“ ist kein gültiges Datum', 'PAL leeren (danach neu eintragen)', dd => { M(dd).pal = null; });
    if (str(m.verantwortlich) !== str(m.verantwortlich).trim()) add(nm + ': Hauptverantwortlich „' + m.verantwortlich + '“ mit Leerzeichen am Rand', 'Leerzeichen entfernen', dd => { M(dd).verantwortlich = str(M(dd).verantwortlich).trim(); });
    for (const k of Object.keys(m.vorlauf || {})) {
      if (!keys.includes(k)) add(nm + ': Start für den nicht mehr vorhandenen Bereich „' + k + '“', 'entfernen', dd => { delete M(dd).vorlauf[k]; });
      else if (m.vorlauf[k] < 0) add(nm + ': ' + startLabel(k) + ' liegt nach dem PAL', startLabel(k) + ' entfernen', dd => { delete M(dd).vorlauf[k]; });
    }
    for (const k of Object.keys(m.ende || {})) {
      if (!keys.includes(k) || !isNum((m.vorlauf || {})[k])) add(nm + ': Ende für „' + k + '“ ohne Start', 'entfernen', dd => { delete M(dd).ende[k]; });
      else if (m.ende[k] > m.vorlauf[k]) add(nm + ': Ende von „' + phName(k) + '“ liegt vor dessen Start', 'Ende entfernen', dd => { delete M(dd).ende[k]; });
    }
    if (!m.plan) continue;
    const pc = planCalc(m);
    let cycleFixed = false;
    for (const s of m.plan.steps) {
      if (s.typ === 'gruppe') continue;
      const sid = s.id, S = dd => M(dd).plan.steps.find(q => q.id === sid), sn = nm + ' › „' + (s.name || '?') + '“';
      const a = s.anker || {}, r = pc.map.get(sid) || {};
      if (a.art === 'fest' && dn(a.datum) == null) add(sn + ': Datum „' + (a.datum || '') + '“ ungültig', 'Termin lösen (neu eintragen)', dd => { S(dd).anker = { art: 'offen' }; });
      else if (a.art === 'nach' && predsOf(s).some(id => !m.plan.steps.some(q => q.id === id && q.typ !== 'gruppe')))
        add(sn + ': beginnt nach einem gelöschten Schritt', 'Verknüpfung entfernen', dd => { const q = S(dd), ok = predsOf(q).filter(id => M(dd).plan.steps.some(z => z.id === id && z.typ !== 'gruppe')); if (ok.length) q.anker.refs = ok; else q.anker = { art: 'pal', offset: 0 }; });
      else if ((a.art === 'start' || a.art === 'ende') && !m.plan.steps.some(q => q.id === a.ref)) add(sn + ': hängt an einem gelöschten Schritt', 'an den PAL hängen', dd => { S(dd).anker = { art: 'pal', offset: 0 }; });
      else if (r.err === 'Zirkelbezug' && !cycleFixed) { cycleFixed = true; add(sn + ': Zirkelbezug (Schritte hängen im Kreis voneinander ab)', 'Kreis lösen: diesen Schritt an den PAL hängen', dd => { S(dd).anker = { art: 'pal', offset: 0 }; }); }
      if (s.typ === 'aufgabe' && !(isNum(s.dauer) && +s.dauer >= 0 && +s.dauer <= MAX_DAUER && Math.round(+s.dauer) === +s.dauer))
        add(sn + ': Dauer „' + s.dauer + '“ ungültig', 'auf ' + clamp(Math.round(+s.dauer || 0), 0, MAX_DAUER) + ' Tage setzen', dd => { S(dd).dauer = clamp(Math.round(+S(dd).dauer || 0), 0, MAX_DAUER); });
      if (str(s.wer) !== str(s.wer).trim()) add(sn + ': Person „' + s.wer + '“ mit Leerzeichen am Rand', 'Leerzeichen entfernen', dd => { S(dd).wer = str(S(dd).wer).trim(); });
    }
  }
  for (const u of d.urlaube) {
    const uid0 = u.id, U = dd => dd.urlaube.find(q => q.id === uid0), un = 'Urlaub ' + (u.wer || '?');
    const a = dn(u.von), b = dn(u.bis);
    if (a == null) add(un + ': Beginn „' + (u.von || '') + '“ ungültig', 'Urlaub löschen', dd => { dd.urlaube = dd.urlaube.filter(q => q.id !== uid0); });
    else if (u.bis && b == null) add(un + ' ab ' + fmtD(a) + ': Ende „' + u.bis + '“ ungültig', 'Ende = Beginn setzen', dd => { U(dd).bis = U(dd).von; });
    else if (b != null && b < a) add(un + ': Ende ' + fmtD(b) + ' liegt vor dem Beginn ' + fmtD(a), 'Beginn und Ende tauschen', dd => { const x = U(dd); [x.von, x.bis] = [x.bis, x.von]; });
    if (str(u.wer) !== str(u.wer).trim()) add(un + ': Name mit Leerzeichen am Rand', 'Leerzeichen entfernen', dd => { U(dd).wer = str(U(dd).wer).trim(); });
  }
  for (const s of d.sondertage) if (dn(s.datum) == null) { const sid = s.id; add('Freier Tag „' + (s.name || '?') + '“: Datum „' + (s.datum || '') + '“ ungültig', 'löschen', dd => { dd.sondertage = dd.sondertage.filter(q => q.id !== sid); }); }
  const mids = new Set(d.massnahmen.map(m => m.id)), S = d.spenden || { zu: {}, vor: {}, nein: {} };
  const orphan = Object.values(S.zu).filter(z => !mids.has(z.m)).length + Object.values(S.vor).filter(v => !mids.has(v)).length + Object.values(S.nein).filter(a => a.some(v => !mids.has(v))).length;
  if (orphan) add(orphan + ' Spenden-Zuordnung' + (orphan === 1 ? '' : 'en') + ' zu einer gelöschten Maßnahme', 'entfernen (die Spenden gelten wieder als offen)', dd => {
    const ok = new Set(dd.massnahmen.map(m => m.id)), T = dd.spenden;
    for (const k of Object.keys(T.zu)) if (!ok.has(T.zu[k].m)) delete T.zu[k];
    for (const k of Object.keys(T.vor)) if (!ok.has(T.vor[k])) delete T.vor[k];
    for (const k of Object.keys(T.nein)) { const a = T.nein[k].filter(v => ok.has(v)); if (a.length) T.nein[k] = a; else delete T.nein[k]; }
  });
  const names = new Map();
  for (const p of d.personen) names.set(p.name, (names.get(p.name) || 0) + 1);
  for (const [n, c] of names) if (c > 1) add('Person „' + n + '“ steht ' + c + '× in der Liste', 'doppelte Einträge entfernen', dd => { let seen = false; dd.personen = dd.personen.filter(p => p.name !== n || (!seen && (seen = true))); });
  return out;
}
const checkSig = list => list.map(i => i.text).join('|');
async function checkDialog() {
  const list = checkData();
  if (!list.length) { toast('Datenprüfung: keine Auffälligkeiten.', 'ok'); return; }
  const ok = await modal('Datenprüfung', h('div', { class: 'form mergeform' },
    h('p', null, list.length + ' Auffälligkeit' + (list.length === 1 ? '' : 'en') + ' gefunden. Angehakte Vorschläge werden repariert (Strg+Z macht es rückgängig).'),
    list.map(it => h('div', { class: 'mrow' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: it.on, onchange: e => { it.on = e.target.checked; } }),
      h('span', null, h('b', null, it.text), h('div', { class: 'muted small' }, '→ ' + it.label)))))),
    [['Schließen', false], ['Reparieren', true, 'primary']], { wide: true });
  if (ok) {
    const todo = list.filter(i => i.on);
    if (todo.length && commit(d => { for (const it of todo) it.fix(d); }, todo.length + ' Auffälligkeit' + (todo.length === 1 ? '' : 'en') + ' repariert')) UI.checkSeen = null;
  } else { UI.checkSeen = checkSig(list); saveUI(); }
  renderNow();
}
