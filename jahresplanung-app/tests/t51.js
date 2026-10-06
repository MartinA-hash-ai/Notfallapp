// 0.13.7: Dauer im Detailplan in Werktagen (Mo–Fr ohne Feiertage) – Umstellung alter Pläne, Eingabe links, Plan erstellen, Verschieben
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1800 }); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);

  // ---- A: alte Pläne (Kalendertage) werden beim Laden auf Werktage umgestellt
  const a = await p.evaluate(id => { const m = D.massnahmen.find(q => q.id === id), x = C.byId.get(id);
    const bad = m.plan.steps.filter(s => s.typ === 'aufgabe').filter(s => { const r = x.pc.map.get(s.id); return r.start != null && wtSpan(r.start, r.end) !== +s.dauer; });
    const wkStart = m.plan.steps.filter(s => s.typ === 'aufgabe').filter(s => { const r = x.pc.map.get(s.id); return r.start != null && !isWorkday(r.start); });
    return [m.plan.wt, bad.length, wkStart.length, m.plan.steps.filter(s => s.typ === 'aufgabe').length]; }, sm);
  ok(a[0] === true && a[1] === 0 && a[2] === 0, 'A: Plan auf Werktage umgestellt – bei allen ' + a[3] + ' Aufgaben passt die Dauer (WT) zu Beginn und Ende, keine beginnt am Wochenende/Feiertag');
  const raw = await p.evaluate(() => { const r = JSON.parse(document.getElementById('jp-data').textContent); return [r.massnahmen.filter(m => m.plan).every(m => !m.plan.wt), normalize(r).massnahmen.filter(m => m.plan).every(m => m.plan.wt === true)]; });
  ok(raw[0] && raw[1], 'A: Startdaten ohne Kennzeichen → nach dem Laden in Werktagen (einmalig, kein zweites Umrechnen)');
  const twice = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(D)), n = normalize(JSON.parse(JSON.stringify(o))); return JSON.stringify(o.massnahmen.map(m => m.plan && m.plan.steps.map(s => s.dauer))) === JSON.stringify(n.massnahmen.map(m => m.plan && m.plan.steps.map(s => s.dauer))); });
  ok(twice, 'A: erneutes Laden ändert die Dauern nicht');

  // ---- B: links Dauer in Werktagen anzeigen und eingeben
  await p.evaluate(id => { UI.view = 'plaene'; UI.year = 2027; UI.planSel = id; renderNow(); }, sm); await p.waitForTimeout(250);
  const tid = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.find(s => s.name === 'Thema definieren').id);
  const b0 = await p.evaluate(tid => { const c = document.querySelector('.pl-row[data-rid="' + tid + '"] .c-dur'); return [c.querySelector('.unit') && c.querySelector('.unit').textContent, c.querySelector('input').value, document.querySelector('.pl-row.head .c-dur, .pl-head .c-dur') ? 1 : 0]; }, tid);
  ok(b0[0] === 'WT', 'B: Dauer links mit „WT“ (Wert ' + b0[1] + ')');
  const tip = await p.evaluate(tid => { const i = document.querySelector('.pl-row[data-rid="' + tid + '"] .c-dur input'); return TIPS.get(i); }, tid);
  ok(/Werktagen/.test(tip), 'B: Hinweis „Dauer in Werktagen …“');
  const r0 = await p.evaluate(tid => { const x = C.byId.get(UI.planSel); return x.pc.map.get(tid); }, tid);
  await p.fill('[data-fk="st:' + tid + ':dur"]', '3'); await p.press('[data-fk="st:' + tid + ':dur"]', 'Enter'); await p.waitForTimeout(250);
  const b1 = await p.evaluate(([tid, st]) => { const x = C.byId.get(UI.planSel), r = x.pc.map.get(tid), te = x.m.plan.steps.find(s => s.name === 'Texte erstellen'), rt = x.pc.map.get(te.id);
    return [r.start === st, r.end === addWT(st, 3), +x.m.plan.steps.find(s => s.id === tid).dauer, rt.start === nextWorkday(r.end), fmtW(r.start) + ' – ' + fmtW(r.end)]; }, [tid, r0.start]);
  ok(b1[0] && b1[1] && b1[2] === 3 && b1[3], 'B: 3 Werktage eingetragen → ' + b1[4] + ' (Wochenende/Feiertage zählen nicht), der nächste Schritt beginnt am folgenden Werktag');

  // ---- C: Balken übers Wochenende verschieben – die Dauer (WT) bleibt
  const c0 = await p.evaluate(tid => { const x = C.byId.get(UI.planSel), m = JSON.parse(JSON.stringify(x.m)), r = x.pc.map.get(tid); setStepSpan(m, tid, r.start + 4, r.end + 4, true); const r2 = planCalc(m).map.get(tid); return [+m.plan.steps.find(s => s.id === tid).dauer, isWorkday(r2.start), wtSpan(r2.start, r2.end)]; }, tid);
  ok(c0[0] === 3 && c0[1] && c0[2] === 3, 'C: um 4 Tage verschoben – Beginn auf einem Werktag, Dauer bleibt 3 WT');

  // ---- D: „Detailplan anlegen“ mit „Werktage bis PAL“ – der Plan rechnet in Werktagen
  const nid = await p.evaluate(() => { addMassnahme(2027); const m = D.massnahmen[D.massnahmen.length - 1]; commit(d => { const q = d.massnahmen.find(z => z.id === m.id); q.name = 'WT-Test'; q.pal = '2027-10-15'; }); renderNow(); return m.id; });
  await p.evaluate(id => { createPlan(id); }, nid); await p.waitForTimeout(200);
  await p.fill('[data-fk="np:S:wt"]', '40'); await p.dispatchEvent('[data-fk="np:S:wt"]', 'input');
  await p.fill('[data-fk="np:I:wt"]', '20'); await p.dispatchEvent('[data-fk="np:I:wt"]', 'input'); await p.waitForTimeout(100);
  await p.click('.modal .tpl-simple'); await p.waitForTimeout(300);
  const d0 = await p.evaluate(id => { const x = C.byId.get(id), pal = x.pal, t = x.m.plan.steps.filter(s => s.typ === 'aufgabe');
    return [x.m.plan.wt, workdaysBefore(x.st.S, pal), workdaysBefore(x.st.I, pal), t.map(s => s.name + ' ' + s.dauer).join(', '), t.every(s => { const r = x.pc.map.get(s.id); return wtSpan(r.start, r.end) === +s.dauer; })]; }, nid);
  ok(d0[0] === true && d0[1] === 40 && d0[2] === 20 && d0[4], 'D: Plan angelegt mit S = 40 WT und I = 20 WT vor dem PAL; Schritte in Werktagen (' + d0[3] + ')');
  await finish(b, pages);
})();
