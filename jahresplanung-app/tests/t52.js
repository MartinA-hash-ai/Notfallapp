// 0.14: Abschnitt löschen (mit Rückfrage, PAL bleibt), Urlaubsfenster ohne Hinweistexte, Ferienzeiten,
// feste Verknüpfungen (verknüpfte Termine haben immer dasselbe Datum – die Kette wandert mit)
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1800 }); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  await p.evaluate(id => { UI.view = 'plaene'; UI.year = 2027; UI.planSel = id; renderNow(); }, sm); await p.waitForTimeout(250);
  const P = () => p.evaluate(() => { const x = C.byId.get(UI.planSel), st = x.m.plan.steps, out = {};
    for (const s of st) { if (s.typ === 'gruppe') continue; const r = x.pc.map.get(s.id) || {}; out[s.name + (out[s.name] ? '#2' : '')] = { id: s.id, a: r.start, e: r.end, dur: +s.dauer, an: JSON.stringify(s.anker) }; }
    return out; });
  const gid = name => p.evaluate(n => C.byId.get(UI.planSel).m.plan.steps.find(s => s.typ === 'gruppe' && s.name === n).id, name);

  // ---- A: Abschnitt löschen – Rückfrage „Alle Aufgaben darin mitlöschen“ (vorausgewählt)
  const gi = await gid('Inhalt');
  const openDel = async g => { await p.click('.pl-row.grp[data-rid="' + g + '"] .c-acts .menu-btn'); await p.click('.menu button:has-text("Abschnitt löschen")'); await p.waitForTimeout(150); };
  await openDel(gi);
  const a0 = await p.evaluate(() => { const m = document.querySelector('.modal'); return m && [m.querySelector('h2').textContent, m.querySelector('.gdel-opt input').checked, m.querySelector('.gdel-opt').textContent, m.querySelector('footer button.danger').textContent]; });
  ok(a0 && a0[0] === 'Abschnitt „Inhalt“ löschen' && a0[1] === true && /Alle Aufgaben darin mitlöschen \(7 Schritte\)/.test(a0[2]) && a0[3] === 'Löschen', 'A: Rückfrage – ' + (a0 && a0.slice(0, 3).join(' · ')));
  await p.click('.modal .gdel-opt input'); await p.click('.modal footer button.danger'); await p.waitForTimeout(200);
  const a1 = await p.evaluate(() => { const st = C.byId.get(UI.planSel).m.plan.steps; return [st.some(s => s.typ === 'gruppe' && s.name === 'Inhalt'), st.filter(s => ['Thema definieren', 'Gestaltung', 'Freigaben einholen'].includes(s.name)).length]; });
  ok(!a1[0] && a1[1] === 3, 'A: Häkchen weg → nur die Abschnittszeile gelöscht, die Aufgaben bleiben');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  const before = await P(), a1n = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.length);
  await openDel(gi); await p.click('.modal footer button.danger'); await p.waitForTimeout(200);
  const a2 = await p.evaluate(() => { const st = C.byId.get(UI.planSel).m.plan.steps; return [st.some(s => s.typ === 'gruppe' && s.name === 'Inhalt'), st.filter(s => ['Thema definieren', 'Texte erstellen', 'Bilder einholen', 'Layoutphase', 'Gestaltung', 'Korrekturphase', 'Freigaben einholen'].includes(s.name)).length, st.length]; });
  ok(!a2[0] && a2[1] === 4 && a2[2] === a1n - 8, 'A: mit Häkchen → Abschnitt und seine 7 Schritte gelöscht (die gleichnamigen im Dankbrief/Flankierung bleiben) ' + JSON.stringify(a2));
  const after = await P();
  ok(after['Selektion erstellen'].e === before['Selektion erstellen'].e && after['Produktion & Versand'].e === before['Produktion & Versand'].e, 'A: die übrigen Termine bleiben gleich');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  // Abschnitt mit dem Briefkasten-Termin: der PAL bleibt immer
  await openDel(await gid('Produktion'));
  ok(await p.evaluate(() => /Briefkasten-Termin \(PAL\) bleibt in jedem Fall/.test(document.querySelector('.modal').textContent)), 'A: Hinweis „Der Briefkasten-Termin (PAL) bleibt …“');
  await p.click('.modal footer button.danger'); await p.waitForTimeout(200);
  const a3 = await p.evaluate(() => { const x = C.byId.get(UI.planSel), st = x.m.plan.steps; return [st.filter(s => s.pal).length, st.some(s => s.name === 'Angebotsanfrage' || s.name === 'Übergabe an Lettershop'), ds(x.pc.map.get(st.find(s => s.pal).id).end), ds(x.pal)]; });
  ok(a3[0] === 1 && !a3[1] && a3[2] === a3[3], 'A: Abschnitt „Produktion“ samt Aufgaben gelöscht – der Briefkasten-Termin (PAL ' + a3[3] + ') bleibt');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);

  // ---- B: feste Verknüpfungen – Ende des Vorgängers = Beginn des Nachfolgers (Übergabetag, auch übers Wochenende)
  const b0 = await P();
  ok(b0['Texte erstellen'].a === b0['Thema definieren'].e && b0['Korrekturphase'].a === b0['Gestaltung'].e && b0['Freigaben einholen'].a === b0['Korrekturphase'].e, 'B: verknüpfte Termine zeigen dasselbe Datum');
  await p.evaluate(tid => commit(d => { findM(d, UI.planSel).plan.steps.find(s => s.id === tid).dauer = 6; }), b0['Texte erstellen'].id); await p.waitForTimeout(150);
  const b1 = await P(), wdOf = n => p.evaluate(n => fmtW(n), n);
  ok(await wdOf(b1['Texte erstellen'].e) === 'Mo 03.05.2027' && b1['Gestaltung'].a === b1['Texte erstellen'].e, 'B: Fr 23.04. + 6 WT endet Fr 30.04. → Ende ist der Übergabetag Mo 03.05. (Sa = 1. Mai), „Gestaltung“ beginnt am selben Tag (' + await wdOf(b1['Gestaltung'].a) + ')');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);

  // ---- C: Nachfolger verschieben → Vorgänger (und alles davor) wandern mit, der Abstand bleibt 0
  const c0 = await P();
  await p.evaluate(([sid, a, e]) => commit(d => setStepSpan(findM(d, UI.planSel), sid, a + 5, e + 5, true)), [c0['Korrekturphase'].id, c0['Korrekturphase'].a, c0['Korrekturphase'].e]); await p.waitForTimeout(150);
  const c1 = await P();
  ok(await wdOf(c1['Korrekturphase'].a) === await p.evaluate(n => fmtW(nextWorkday(n)), c0['Korrekturphase'].a + 5) && c1['Korrekturphase'].dur === 2 && JSON.parse(c1['Korrekturphase'].an).offset === 0,
    'C: „Korrekturphase“ verschoben → ' + await wdOf(c1['Korrekturphase'].a) + ', Dauer 2 WT, Verknüpfung ohne Abstand');
  ok(c1['Gestaltung'].e === c1['Korrekturphase'].a && c1['Gestaltung'].dur === c0['Gestaltung'].dur && c1['Freigaben einholen'].a === c1['Korrekturphase'].e,
    'C: „Gestaltung“ (Vorgänger) endet am neuen Beginn ' + await wdOf(c1['Gestaltung'].e) + ', Dauer bleibt; „Freigaben einholen“ folgt');
  ok(c1['Thema definieren'].a > c0['Thema definieren'].a && c1['Texte erstellen'].a === c1['Thema definieren'].e && c1['Bilder einholen'].e <= c1['Gestaltung'].a && c1['Layoutphase'].e <= c1['Gestaltung'].a,
    'C: die ganze Kette davor wandert mit (Thema definieren ' + await wdOf(c0['Thema definieren'].a) + ' → ' + await wdOf(c1['Thema definieren'].a) + ')');
  ok(c1['Briefkasten-Termin'].e === c0['Briefkasten-Termin'].e && c1['Selektion erstellen'].e === c0['Selektion erstellen'].e, 'C: PAL und nicht verknüpfte Schritte bleiben');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  // früher beginnen lassen (linker Rand): Vorgänger rücken nach vorn, das Ende bleibt
  const c2 = await p.evaluate(([sid, a, e]) => { commit(d => setStepSpan(findM(d, UI.planSel), sid, a - 3, e)); return 0; }, [c0['Gestaltung'].id, c0['Gestaltung'].a, c0['Gestaltung'].e]); await p.waitForTimeout(150);
  const c3 = await P();
  ok(c3['Gestaltung'].e === c0['Gestaltung'].e && c3['Gestaltung'].a < c0['Gestaltung'].a && c3['Texte erstellen'].e === c3['Gestaltung'].a && c3['Thema definieren'].a < c0['Thema definieren'].a && c3['Gestaltung'].dur > c0['Gestaltung'].dur,
    'C: „Gestaltung“ beginnt früher (' + await wdOf(c3['Gestaltung'].a) + ', ' + c3['Gestaltung'].dur + ' WT) – „Texte erstellen“ und „Thema definieren“ rücken nach vorn, das Ende bleibt');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  // Vorgänger hinten verlängern: Nachfolger rücken nach hinten
  await p.evaluate(([sid, a, e]) => commit(d => setStepSpan(findM(d, UI.planSel), sid, a, e + 7)), [c0['Gestaltung'].id, c0['Gestaltung'].a, c0['Gestaltung'].e]); await p.waitForTimeout(150);
  const c4 = await P();
  ok(c4['Gestaltung'].a === c0['Gestaltung'].a && c4['Korrekturphase'].a === c4['Gestaltung'].e && c4['Korrekturphase'].a > c0['Korrekturphase'].a && c4['Freigaben einholen'].a === c4['Korrekturphase'].e,
    'C: „Gestaltung“ hinten verlängert – Korrekturphase und Freigaben rücken nach hinten');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  // im Gantt mit der Maus ziehen
  const bar = await p.$('.g-bar[data-sid="' + c0['Freigaben einholen'].id + '"]'), bb = await bar.boundingBox();
  const pxd = await p.evaluate(() => { const x = C.byId.get(UI.planSel), bs = [...document.querySelectorAll('.g-bar[data-sid]')].map(e => [x.pc.map.get(e.dataset.sid), e.getBoundingClientRect()]).filter(([r]) => r && r.end > r.start);
    const [r1, e1] = bs[0], [r2, e2] = bs.find(([r]) => r.start !== r1.start); return (e2.left - e1.left) / (r2.start - r1.start); });
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width / 2 + 7 * pxd, bb.y + bb.height / 2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(250);
  const c5 = await P();
  ok(c5['Freigaben einholen'].a > c0['Freigaben einholen'].a && c5['Korrekturphase'].e === c5['Freigaben einholen'].a && c5['Gestaltung'].e === c5['Korrekturphase'].a && c5['Freigaben einholen'].dur === c0['Freigaben einholen'].dur,
    'C: im Gantt gezogen: „Freigaben einholen“ ' + await wdOf(c0['Freigaben einholen'].a) + ' → ' + await wdOf(c5['Freigaben einholen'].a) + ', die Vorgänger hängen dran');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  // Meilenstein-Kette bis zum PAL: „Produktion & Versand“ hängt an „Übergabe an Lettershop“ – der PAL bleibt fest
  await p.evaluate(([sid, a, e]) => commit(d => setStepSpan(findM(d, UI.planSel), sid, a - 2, e - 2, true)), [c0['Produktion & Versand'].id, c0['Produktion & Versand'].a, c0['Produktion & Versand'].e]); await p.waitForTimeout(150);
  const c6 = await P();
  ok(c6['Übergabe an Lettershop'].e === c6['Produktion & Versand'].a && c6['Übergabe an Lettershop'].e < c0['Übergabe an Lettershop'].e && c6['Briefkasten-Termin'].e === c0['Briefkasten-Termin'].e, 'C: Meilenstein davor wandert mit, der PAL bleibt');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);

  // ---- D: Strg-Verknüpfung: der Nachfolger springt ohne Abstand an das Ende
  await p.evaluate(([a, b]) => linkSteps(UI.planSel, a, b), [c0['Interessensabwägung'].id, c0['Angebotsanfrage'].id]); await p.waitForTimeout(150);
  const d0 = await P();
  ok(JSON.parse(d0['Angebotsanfrage'].an).offset === 0 && d0['Angebotsanfrage'].a === d0['Interessensabwägung'].e, 'D: neu verknüpft → beginnt am Ende des Vorgängers (' + await wdOf(d0['Angebotsanfrage'].a) + ')');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  // ---- E: Abstand aus einer früheren Version → Hinweis „Angleichen“
  await p.evaluate(sid => commit(d => { findM(d, UI.planSel).plan.steps.find(s => s.id === sid).anker.offset = 3; }), c0['Korrekturphase'].id); await p.waitForTimeout(200);
  const e0 = await p.evaluate(() => { const bn = document.querySelector('.banner.plgap'); return bn && bn.textContent; });
  ok(e0 && /„Korrekturphase“ beginnt nicht direkt am Ende seines Vorgängers/.test(e0), 'E: Hinweis bei Abstand – ' + (e0 || 'fehlt'));
  await p.click('.banner.plgap button.primary'); await p.waitForTimeout(200);
  const e1 = await P();
  ok(JSON.parse(e1['Korrekturphase'].an).offset === 0 && e1['Korrekturphase'].a === e1['Gestaltung'].e && await p.evaluate(() => !document.querySelector('.banner.plgap')), 'E: „Angleichen“ → dasselbe Datum, Hinweis weg');

  // ---- F: Urlaubsfenster ohne die Hinweistexte
  await p.evaluate(() => { openUrlaub(); }); await p.waitForTimeout(200);
  await p.click('.vac-add'); await p.waitForTimeout(200);
  const f0 = await p.evaluate(() => { const m = document.querySelector('.modal.vacdlg'); return [!!m.querySelector('.vd-hint'), /Wochenenden und Feiertage sind grau/.test(m.textContent), /Tage anklicken oder/.test(m.textContent), !!m.querySelector('.vd-wer'), [...m.querySelectorAll('.vd-art .seg-btn')].map(x => x.textContent).join('/')]; });
  ok(!f0[0] && !f0[1] && !f0[2] && f0[3] && f0[4] === 'Urlaub/Abwesenheit', 'F: Urlaubsfenster ohne „Wochenenden und Feiertage sind grau …“ und „Tage anklicken …“');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);

  // ---- G: Ferienzeiten eintragen (ohne Person, Art „Ferien“, Notiz)
  ok(await p.evaluate(() => { const bt = document.querySelector('.hcard .fer-add'); return bt && bt.textContent === '+ Ferienzeiten eintragen'; }), 'G: Knopf „+ Ferienzeiten eintragen“ in der Karte Feiertage NRW');
  await p.click('.hcard .fer-add'); await p.waitForTimeout(200);
  const g0 = await p.evaluate(() => { const m = document.querySelector('.modal.ferdlg'); return m && [m.querySelector('h2').textContent, !!m.querySelector('.vd-wer'), [...m.querySelectorAll('.vd-art .seg-btn')].map(x => x.textContent).join('/'), !!m.querySelector('.vd-notiz'), /Person/.test(m.querySelector('.vd-top').textContent)]; });
  ok(g0 && g0[0] === 'Ferienzeiten eintragen' && !g0[1] && !g0[4] && g0[2] === 'Ferientage' && g0[3], 'G: Fenster „Ferienzeiten eintragen“ ohne Person, Art „Ferientage“, mit Notiz');
  await p.fill('.ferdlg .vd-notiz', 'Sommerferien');
  const dayBox = n => p.evaluate(n => { const r = document.querySelector('.ferdlg .vd-day[data-dn="' + n + '"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, n);
  const [fa, fb] = await p.evaluate(() => [mkdn(2027, 7, 15), mkdn(2027, 7, 21)]);
  const pa = await dayBox(fa), pb = await dayBox(fb);
  await p.mouse.move(pa.x, pa.y); await p.mouse.down(); await p.mouse.move(pb.x, pb.y, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(100);
  ok(await p.evaluate(() => /Ferien neu: 15\.07\.–21\.07\. \(7 Tage\)/.test(document.querySelector('.ferdlg .vd-sum').textContent)), 'G: Zusammenfassung „Ferien neu: 15.07.–21.07. (7 Tage)“');
  await p.click('.ferdlg footer button.primary'); await p.waitForTimeout(250);
  const g1 = await p.evaluate(() => JSON.stringify(D.ferien.map(({ von, bis, notiz }) => ({ von, bis, notiz }))));
  ok(g1 === '[{"von":"2027-07-15","bis":"2027-07-21","notiz":"Sommerferien"}]', 'G: gespeichert ' + g1);
  const g2 = await p.evaluate(() => [document.querySelectorAll('.hcard .fertable tr').length, document.querySelector('.hcard .fertable input[data-fk$=":notiz"]').value, !!document.querySelector('.umatrix .ferrow .um-bar.fer'), document.querySelectorAll('.umatrix .um-bg .fer').length > 0]);
  ok(g2[0] === 1 && g2[1] === 'Sommerferien' && g2[2] && g2[3], 'G: Liste „Ferienzeiten“ in der Feiertage-Karte, Zeile „Ferien“ in der Übersicht');
  // Ferien sind keine freien Tage
  ok(await p.evaluate(() => isWorkday(mkdn(2027, 7, 15)) && workdays(mkdn(2027, 7, 15), mkdn(2027, 7, 21)) === 5), 'G: Ferientage zählen weiter als Werktage');
  // im Urlaubsfenster blass im Hintergrund
  await p.click('.vac-add'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => { const d = document.querySelector('.vacdlg .vd-day[data-dn="' + mkdn(2027, 7, 16) + '"]'); return d.classList.contains('fer') && /Ferien: Sommerferien/.test(d.title); }), 'G: im Urlaubsfenster sind Ferientage markiert');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  // bearbeiten: wieder öffnen, einen Tag herausnehmen
  await p.click('.hcard .fer-add'); await p.waitForTimeout(200);
  const pc2 = await dayBox(fb); await p.mouse.click(pc2.x, pc2.y); await p.waitForTimeout(80);
  await p.click('.ferdlg footer button.primary'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => D.ferien.length === 1 && D.ferien[0].bis === '2027-07-20' && D.ferien[0].notiz === 'Sommerferien'), 'G: Tag herausgenommen – Zeitraum bis 20.07., Notiz bleibt');
  // Kalender und Zeitleiste
  await p.evaluate(() => { UI.view = 'jahr'; UI.secOpen.kal = true; UI.secOpen.tl = true; renderNow(); }); await p.waitForTimeout(400);
  const g3 = await p.evaluate(() => [!!document.querySelector('.day.fer[data-dn="' + mkdn(2027, 7, 16) + '"]'), !document.querySelector('.day.fer[data-dn="' + mkdn(2027, 7, 22) + '"]'), document.querySelectorAll('.tl-bg .fer').length]);
  ok(g3[0] && g3[1] && g3[2] >= 1, 'G: Kalender und Zeitleiste zeigen die Ferien (' + g3.join(',') + ')');
  // Datenprüfung, Zusammenführen, Änderungsprotokoll
  const g4 = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(D)); o.ferien.push({ id: 'fx', von: '2027-08-10', bis: '2027-08-01', notiz: 'kaputt' });
    return [checkData(o).some(c => /Ferien „kaputt“: Ende .* liegt vor dem Beginn/.test(c.text)), describeChanges(D, o).join(' | ')]; });
  ok(g4[0] && /Ferien „kaputt“ 10\.08\.–01\.08\. angelegt/.test(g4[1]), 'G: Datenprüfung und Änderungsprotokoll kennen Ferien (' + g4[1] + ')');
  const g5 = await p.evaluate(() => { const base = JSON.parse(JSON.stringify(D)), mine = JSON.parse(JSON.stringify(D)), theirs = JSON.parse(JSON.stringify(D));
    mine.ferien.push({ id: 'f1', von: '2027-10-04', bis: '2027-10-15', notiz: 'Herbstferien' }); theirs.ferien[0].notiz = 'Sommerferien NRW';
    const r = merge3(base, mine, theirs); return [r.conflicts.length, r.data.ferien.map(f => f.notiz).join(',')]; });
  ok(g5[0] === 0 && g5[1] === 'Sommerferien NRW,Herbstferien', 'G: gleichzeitig geändert → beides zusammengeführt (' + g5[1] + ')');
  await finish(b, pages);
})();
