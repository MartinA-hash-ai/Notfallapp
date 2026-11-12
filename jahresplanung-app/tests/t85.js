// 0.54.1: Dauer im Detailplan ändern – zur freien Seite hin: hängen am Ende andere Schritte (z. B. ein Kick-off, nach dem alles beginnt) und ist der Beginn frei,
// bleibt das Ende und der Beginn rückt nach vorn; hängt der Beginn an einem Vorgänger (oder hängt gar nichts dran), bleibt der Beginn und das Ende wandert
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1800 }); pages.push(p);
  await p.evaluate(() => {
    const st = (id, name, dauer, anker) => ({ id, typ: 'aufgabe', name, dauer, fortschritt: 0, wer: '', kommentar: '', anker });
    commit(d => { const m = JSON.parse(JSON.stringify(d.massnahmen[0])); Object.assign(m, { id: 'kp1', name: 'Kick-off-Test', pal: '2027-06-18', palStatus: 'fest', vorlauf: {}, ende: {},
      plan: { wt: true, steps: [{ id: 'g1', typ: 'gruppe', name: 'Vorbereitung' },
        st('ko', 'KickOff', 14, { art: 'fest', datum: '2027-03-10' }),
        st('a', 'Konzept', 5, { art: 'nach', refs: ['ko'], offset: 0 }),
        st('c', 'Abstimmung', 2, { art: 'nach', refs: ['a'], offset: 0 }),
        st('iso', 'Einzelaufgabe', 3, { art: 'fest', datum: '2027-04-01' }),
        st('dd', 'Vorlauf Einzel', 2, { art: 'start', ref: 'iso', offset: 0 })] } }); d.massnahmen.push(m); });
    UI.view = 'plaene'; UI.year = 2027; UI.planSel = 'kp1'; renderNow(); });
  await p.waitForTimeout(250);
  const span = id => p.evaluate(id => { const r = C.byId.get('kp1').pc.map.get(id); return [r.start, r.end]; }, id);
  const setDur = async (id, v) => { const s = `[data-fk="st:${id}:dur"]`; await p.fill(s, String(v)); await p.press(s, 'Enter'); await p.waitForTimeout(250); };
  const k0 = await span('ko'), a0 = await span('a'), c0 = await span('c'), i0 = await span('iso'), d0 = await span('dd');
  ok(await p.evaluate(() => { const pl = C.byId.get('kp1').m.plan, s = id => pl.steps.find(q => q.id === id); return [durKeepsEnd(pl, s('ko')), !durKeepsEnd(pl, s('a')), !durKeepsEnd(pl, s('c')), !durKeepsEnd(pl, s('iso')), durKeepsEnd(pl, s('dd'))].every(Boolean); }),
    'A: Regel – KickOff (am Ende hängt Konzept) und „Vorlauf Einzel“ (Ende am Beginn der Einzelaufgabe) halten das Ende; verknüpfte Beginne und Einzelschritte den Beginn');
  // ---- B: KickOff 14 → 20 WT: Ende bleibt, Beginn rückt vor, Konzept/Abstimmung bleiben
  await setDur('ko', 20);
  const k1 = await span('ko'), a1 = await span('a'), c1 = await span('c'), s20 = await p.evaluate(e => subWT(e, 20), k0[1]);
  ok(k1[1] === k0[1] && k1[0] === s20 && a1.join() === a0.join() && c1.join() === c0.join() && await p.evaluate(() => +C.byId.get('kp1').m.plan.steps.find(s => s.id === 'ko').dauer) === 20,
    'B: KickOff 14 → 20 WT – Ende ' + await p.evaluate(n => fmtD(n), k1[1]) + ' bleibt, Beginn ' + await p.evaluate(n => fmtD(n), k1[0]) + ', alles danach bleibt');
  await setDur('ko', 10);
  const k2 = await span('ko');
  ok(k2[1] === k0[1] && k2[0] === await p.evaluate(e => subWT(e, 10), k0[1]), 'B: auch kürzer (10 WT) – Ende bleibt, Beginn rückt nach hinten');
  // ---- C: Konzept 5 → 8 WT: Beginn bleibt (hängt am KickOff), Ende und Abstimmung wandern
  await setDur('a', 8);
  const a2 = await span('a'), c2 = await span('c');
  ok(a2[0] === a0[0] && a2[1] === await p.evaluate(a => handover(addWT(a, 8), C.byId.get('kp1').pal), a0[0]) && c2[0] > c0[0], 'C: Konzept 5 → 8 WT – Beginn bleibt, Abstimmung rückt nach ' + JSON.stringify([a0, a2, c0, c2, await p.evaluate(a => handover(addWT(a, 8), C.byId.get('kp1').pal), a0[0])]));
  // ---- D: Einzelaufgabe ohne Verknüpfung am Ende: Beginn bleibt; „Vorlauf Einzel“ hängt mit dem Ende am Beginn der Einzelaufgabe → Ende bleibt
  await setDur('dd', 4);
  const d1 = await span('dd');
  ok(d1[1] === d0[1] && d1[0] === await p.evaluate(e => subWT(e, 4), d0[1]), 'D: „Vorlauf Einzel“ 2 → 4 WT – Ende (am Beginn der Einzelaufgabe) bleibt');
  await setDur('iso', 6);
  const i1 = await span('iso');
  ok(i1[0] === i0[0] && i1[1] === await p.evaluate(a => handover(addWT(a, 6), C.byId.get('kp1').pal), i0[0]), 'D: Einzelaufgabe 3 → 6 WT – an ihrem Beginn hängt „Vorlauf Einzel“, also bleibt der Beginn, das Ende wandert');
  // ---- E: Strg+Z
  await p.evaluate(() => { document.activeElement.blur(); undo(); }); await p.waitForTimeout(200);
  ok((await span('iso')).join() === i0.join(), 'E: Strg+Z nimmt die letzte Änderung zurück');
  await finish(b, pages);
})();
