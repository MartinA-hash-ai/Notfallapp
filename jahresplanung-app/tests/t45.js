// 0.12.1 keine „überfällig“-Hinweise: Termine werden nicht gegen das heutige Datum geprüft (z. B. Testmailing in der Vergangenheit)
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  await p.evaluate(() => {
    commit(d => { const m = JSON.parse(JSON.stringify(d.massnahmen.find(m => m.plan))); m.id = 'alt'; m.name = 'Testmailing 2016'; m.pal = '2016-06-17'; m.plan.steps.forEach(s => { s.fortschritt = 0; }); d.massnahmen.push(m); });
    UI.year = 2016; UI.view = 'zeit'; UI.agendaFrom = todayDn() - 7; renderNow();
  }); await p.waitForTimeout(300);
  const r = await p.evaluate(() => [C.warnings.filter(w => /überfällig/.test(w.text)).length, C.ms.find(x => x.id === 'alt').pc.map.size, !!document.querySelector('.aweek.overdue'), /Überfällig/.test(document.body.textContent)]);
  ok(r[0] === 0 && r[1] > 5, 'Detailplan mit Terminen in 2016, nichts erledigt – keine Warnung „überfällig“');
  ok(!r[2] && !r[3], '„Was steht an?“ ohne Abschnitt „Überfällig“');
  await finish(b, pages);
})();
