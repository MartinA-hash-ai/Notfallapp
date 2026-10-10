// 0.15.1: Urlaub ↔ Aufgaben dynamisch – eintragen, verkürzen, löschen, anders zuordnen, ganzer Abschnitt, Rückgängig, Laden/Speichern,
// Urlaub über das Kalender-Fenster; Sicherung speichern/hochladen in den Einstellungen (nicht mehr in den Menüs)
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1700 }); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  await p.evaluate(id => { UI.view = 'plaene'; UI.year = 2027; UI.planSel = id; renderNow(); }, sm); await p.waitForTimeout(250);
  const P = () => p.evaluate(() => { const x = C.byId.get(UI.planSel), out = {}; for (const s of x.m.plan.steps) { if (s.typ === 'gruppe' || out[s.name]) continue; const r = x.pc.map.get(s.id) || {}; out[s.name] = { id: s.id, a: r.start, e: r.end, dur: +s.dauer, away: r.away || 0, wer: s.wer }; } return out; });
  const W = n => p.evaluate(n => fmtW(n), n);
  const setWer = (sid, w) => p.evaluate(([sid, w]) => commit(d => { findM(d, UI.planSel).plan.steps.find(s => s.id === sid).wer = w; }), [sid, w]);
  const vac = (id, wer, von, bis, art) => p.evaluate(v => commit(d => { d.urlaube = d.urlaube.filter(u => u.id !== v.id); d.urlaube.push(v); }), Object.assign({ id, wer, von, bis, notiz: '' }, art ? { art } : {}));
  const s0 = await P(), T = s0['Texte erstellen'], G = s0['Gestaltung'];   // Texte erstellen: Fr 23.04. + 5 WT (nach „Thema definieren“), danach Gestaltung
  await setWer(T.id, 'Martin');

  // ---- A: Urlaub eintragen → länger; verkürzen → weniger; löschen → wie vorher
  await vac('u1', 'Martin', '2027-04-26', '2027-04-28'); await p.waitForTimeout(100);
  const a1 = await P();
  ok(a1['Texte erstellen'].away === 3 && a1['Texte erstellen'].dur === 5 && a1['Texte erstellen'].a === T.a && await p.evaluate(([a, e]) => wtSpan(a, e, awayDays('Martin')), [a1['Texte erstellen'].a, a1['Texte erstellen'].e]) === 5,
    'A: 3 Tage Urlaub → „Texte erstellen“ +3 WT (' + await W(T.e) + ' → ' + await W(a1['Texte erstellen'].e) + '), Martin hat weiter 5 Arbeitstage');
  ok(a1['Gestaltung'].a === a1['Texte erstellen'].e, 'A: Nachfolger „Gestaltung“ beginnt am neuen Ende');
  await vac('u1', 'Martin', '2027-04-26', '2027-04-26'); await p.waitForTimeout(100);
  const a2 = await P();
  ok(a2['Texte erstellen'].away === 1 && a2['Texte erstellen'].e < a1['Texte erstellen'].e && a2['Gestaltung'].a === a2['Texte erstellen'].e, 'A: Urlaub auf 1 Tag gekürzt → nur noch +1 WT (' + await W(a2['Texte erstellen'].e) + ')');
  await p.evaluate(() => commit(d => { d.urlaube = d.urlaube.filter(u => u.id !== 'u1'); })); await p.waitForTimeout(100);
  const a3 = await P();
  ok(a3['Texte erstellen'].e === T.e && a3['Texte erstellen'].away === 0 && a3['Gestaltung'].a === G.a, 'A: Urlaub gelöscht (abgesagt) → wieder 5 WT, Termine wie vorher');

  // ---- B: anders zuordnen → passt sich an die neue Person an
  await vac('u2', 'Martin', '2027-04-26', '2027-04-27'); await vac('u3', 'Kati', '2027-04-29', '2027-04-29'); await p.waitForTimeout(100);
  ok((await P())['Texte erstellen'].away === 2, 'B: Martin hat 2 Tage Urlaub → +2');
  await setWer(T.id, 'Eva'); await p.waitForTimeout(100);
  const b1 = await P();
  ok(b1['Texte erstellen'].away === 0 && b1['Texte erstellen'].e === T.e, 'B: an Eva übergeben (kein Urlaub) → wieder 5 WT, Ende ' + await W(b1['Texte erstellen'].e));
  await setWer(T.id, 'Kati'); await p.waitForTimeout(100);
  const b2 = await P();
  ok(b2['Texte erstellen'].away === 1 && b2['Texte erstellen'].e > T.e, 'B: an Kati übergeben (1 Tag Urlaub) → +1 WT');
  await setWer(T.id, ''); await p.waitForTimeout(100);
  ok((await P())['Texte erstellen'].e === T.e, 'B: niemand zugeordnet → 5 WT');
  // ganzer Abschnitt einer Person
  const gi = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.find(s => s.typ === 'gruppe' && s.name === 'Inhalt').id);
  await p.evaluate(gid => setGroupPerson(UI.planSel, gid, 'Martin'), gi); await p.waitForTimeout(150);
  const b3 = await P();
  ok(b3['Texte erstellen'].wer === 'Martin' && b3['Texte erstellen'].away === 2 && b3['Bilder einholen'].away === 2, 'B: ganzer Abschnitt „Inhalt“ → Martin: beide betroffenen Aufgaben +2');
  await p.evaluate(gid => setGroupPerson(UI.planSel, gid, 'Eva'), gi); await p.waitForTimeout(150);
  const b4 = await P();
  ok(b4['Texte erstellen'].e === T.e && b4['Bilder einholen'].a === s0['Bilder einholen'].a, 'B: Abschnitt an Eva → alle Termine wieder wie ohne Urlaub');

  // ---- C: Rückgängig/Wiederholen, Speichern/Laden – nichts wird doppelt verlängert
  await setWer(T.id, 'Martin'); await p.waitForTimeout(100);
  const c0 = (await P())['Texte erstellen'];
  await p.evaluate(() => { undo(); }); await p.waitForTimeout(100);
  ok((await P())['Texte erstellen'].e === T.e, 'C: Strg+Z (Zuordnung zurück) → wieder kurz');
  await p.evaluate(() => { redo(); }); await p.waitForTimeout(100);
  ok((await P())['Texte erstellen'].e === c0.e, 'C: Strg+Y → wieder verlängert');
  const c1 = await p.evaluate(() => { const n = normalize(JSON.parse(JSON.stringify(D))), m = n.massnahmen.find(q => q.id === UI.planSel), s = m.plan.steps.find(q => q.name === 'Texte erstellen'); HOLSRC = n; const r = planCalc(m).map.get(s.id); HOLSRC = null; return [+s.dauer, r.end]; });
  ok(c1[0] === 5 && c1[1] === c0.e, 'C: gespeichert wird die Dauer (5 WT), nicht die Verlängerung – nach dem Laden gleiches Ende');
  // Urlaub ändert sich in einer anderen Sitzung (z. B. Kollegin trägt ein): neuer Stand wird geladen → Termine passen sich an
  await p.evaluate(() => { const o = JSON.parse(JSON.stringify(D)); o.urlaube = o.urlaube.filter(u => u.id !== 'u2'); o.meta.savedAt = new Date().toISOString(); SAVED_JSON = JSON.stringify(D); externalChange(o, 123); });   // ohne eigene offene Änderungen wird der neue Stand übernommen await p.waitForTimeout(200);
  ok((await P())['Texte erstellen'].e === T.e, 'C: Urlaub von anderer Stelle gelöscht → nach dem Neuladen wieder 5 WT');

  // ---- D: Urlaub über das Kalender-Fenster eintragen und wieder herausnehmen
  await p.evaluate(() => openSettings('urlaub')); await p.waitForTimeout(200);
  await p.click('.vac-add'); await p.waitForTimeout(200);
  await p.selectOption('.vacdlg .vd-wer', 'Martin');
  const box = n => p.evaluate(n => { const r = document.querySelector('.vacdlg .vd-day[data-dn="' + n + '"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, n);
  const [d1, d2] = await p.evaluate(() => [mkdn(2027, 4, 26), mkdn(2027, 4, 27)]);
  const q1 = await box(d1), q2 = await box(d2);
  await p.mouse.move(q1.x, q1.y); await p.mouse.down(); await p.mouse.move(q2.x, q2.y, { steps: 3 }); await p.mouse.up();
  await p.click('.vacdlg footer button.primary'); await p.waitForTimeout(250);
  await p.evaluate(id => { UI.view = 'plaene'; UI.planSel = id; renderNow(); }, sm); await p.waitForTimeout(200);
  const d0 = await P(), chip = await p.evaluate(tid => { const e = document.querySelector('.pl-row[data-rid="' + tid + '"] .wi.vacx'); return e && e.textContent; }, T.id);
  ok(d0['Texte erstellen'].away === 2 && chip === '+2', 'D: Urlaub im Fenster eingetragen → Detailplan zeigt „+2“, Ende ' + await W(d0['Texte erstellen'].e));
  await p.evaluate(() => openSettings('urlaub')); await p.waitForTimeout(200);
  await p.click('.vac-add'); await p.waitForTimeout(200);
  await p.selectOption('.vacdlg .vd-wer', 'Martin');
  const q3 = await box(d2); await p.mouse.click(q3.x, q3.y);
  await p.click('.vacdlg footer button.primary'); await p.waitForTimeout(250);
  ok((await P())['Texte erstellen'].away === 1, 'D: einen Tag wieder herausgenommen → „+1“');

  // ---- E: Sicherung speichern/hochladen in den Einstellungen, nicht mehr in den Menüs
  await p.evaluate(() => openSettings('allgemein')); await p.waitForTimeout(200);
  const e0 = await p.evaluate(() => [[...document.querySelectorAll('.sett-backup button')].map(x => x.textContent).join(' | ')]);
  ok(e0[0] === 'Sicherung speichern … | Sicherung hochladen …', 'E: Einstellungen → Allgemein: ' + e0[0]);
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.waitForTimeout(100);
  const e1 = await p.evaluate(() => [...document.querySelectorAll('.menu button')].map(x => x.textContent).join(' | '));
  await p.evaluate(() => document.body.click()); await p.keyboard.press('Escape');
  await p.click('header .actions .menu-btn:has-text("Export")'); await p.waitForTimeout(100);
  const e2 = await p.evaluate(() => [...document.querySelectorAll('.menu button')].map(x => x.textContent).join(' | '));
  await p.keyboard.press('Escape'); await p.evaluate(() => document.body.click());
  ok(!/übernehmen|Kopie|JSON|Sicherung/.test(e1) && !/Datensicherung|JSON/.test(e2), 'E: ⋯ – ' + e1 + ' · Export – ' + e2);
  // speichern (Download, da kein Dateidialog) und wieder hochladen
  const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => { delete window.showSaveFilePicker; saveBackup(); })]);
  const fs = require('fs'), path = require('path'), file = path.join(__dirname, 'out', 'sicherung55.json');
  await dl.saveAs(file);
  ok(/^Jahresplanung_Sicherung_\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()) && JSON.parse(fs.readFileSync(file, 'utf8')).urlaube.some(u => u.wer === 'Martin'), 'E: „Sicherung speichern“ – ' + dl.suggestedFilename());
  await p.evaluate(() => commit(d => { d.massnahmen[0].name = 'GEÄNDERT'; })); await p.waitForTimeout(100);
  await p.click('.sett-backup .sett-bload'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /Sicherung hochladen/.test(document.querySelector('.modal h2').textContent) && /vorher als Sicherung heruntergeladen/.test(document.querySelector('.modal').textContent)), 'E: Rückfrage „Sicherung hochladen“');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.modal footer button.primary')]);
  const [dl2] = await Promise.all([p.waitForEvent('download'), fc.setFiles(file)]); await p.waitForTimeout(400);
  ok(/^Jahresplanung_Daten_/.test(dl2.suggestedFilename()), 'E: vor dem Hochladen wurde der aktuelle Stand gesichert (' + dl2.suggestedFilename() + ')');
  ok(await p.evaluate(() => D.massnahmen[0].name !== 'GEÄNDERT'), 'E: Sicherung hochgeladen – Stand zurück (vorher wurde der aktuelle Stand heruntergeladen)');
  await finish(b, pages);
})();
