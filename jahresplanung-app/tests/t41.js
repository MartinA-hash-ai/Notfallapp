// 0.10 Verknüpfungen vorwärts: Beginn nach Ende (mehrere Vorgänger), Gelenke, farbige Kalendersymbole, Strg-Ziehen, Lösen, Warnung nach dem PAL
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1900 }); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  await p.evaluate(id => { UI.view = 'plaene'; UI.planSel = id; UI.planPxd = 11; const x = C.byId.get(id); UI.planColl = {};
    x.m.plan.steps.filter(s => s.typ === 'gruppe' && !['Selektion', 'Inhalt', 'Produktion'].includes(s.name)).forEach(s => { UI.planColl[id + ':' + s.id] = 1; }); renderNow(); }, sm);
  await p.waitForTimeout(300);
  const id = n => p.evaluate(n => C.byId.get(UI.planSel).m.plan.steps.find(s => s.name === n).id, n);
  const span = n => p.evaluate(n => { const x = C.byId.get(UI.planSel), r = x.pc.map.get(x.m.plan.steps.find(s => s.name === n).id); return [r.start, r.end]; }, n);
  const field = (n, f, scroll) => p.evaluate(([n, f, scroll]) => { const x = C.byId.get(UI.planSel), s = x.m.plan.steps.find(s => s.name === n), i = document.querySelector('[data-fk="st:' + s.id + ':' + f + '"]');
    if (scroll) i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect(); return [r.x + 30, r.y + r.height / 2]; }, [n, f, scroll]);
  const fkId = fk => fk.slice(3, fk.lastIndexOf(':'));
  const ctrlDrag = async (a, c) => { await p.keyboard.down('Control'); await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(a[0] + 30, a[1] + 20, { steps: 3 }); await p.mouse.move(c[0], c[1], { steps: 6 }); await p.waitForTimeout(120); };
  const ctrlUp = async () => { await p.mouse.up(); await p.keyboard.up('Control'); await p.waitForTimeout(250); };

  // ---- A: Umstellung der Vorlage – ein Beginn nach mehreren Enden, Termine gleich (siehe auch t40 A)
  const a = await p.evaluate(() => { const st = C.byId.get(UI.planSel).m.plan.steps, g = st.find(s => s.name === 'Gestaltung'); return [g.anker.art, predsOf(g).map(id => st.find(s => s.id === id).name).join(', '), st.some(s => s.anker && s.anker.art === 'start')]; });
  ok(a[0] === 'nach' && a[1] === 'Texte erstellen, Bilder einholen, Layoutphase' && !a[2], 'A: „Gestaltung“ beginnt nach ' + a[1] + ' – keine Rückwärts-Verknüpfungen mehr');

  // ---- B: Anzeige – Gelenke im Gantt, Kalendersymbole in Maßnahmenfarbe
  const bb = await p.evaluate(() => { const x = C.byId.get(UI.planSel), n = x.m.plan.steps.reduce((k, s) => k + predsOf(s).filter(id => document.querySelector('.g-body [data-sid="' + id + '"]') && document.querySelector('.g-body [data-sid="' + s.id + '"]')).length, 0);
    const g = x.m.plan.steps.find(s => s.name === 'Gestaltung'), split = document.querySelector('.pl-split');
    return [n, document.querySelectorAll('.g-links .lnk').length, document.querySelector('[data-fk="st:' + g.id + ':start"]').classList.contains('lk'), document.querySelector('[data-fk="st:' + g.id + ':end"]').classList.contains('lk'),
      split.style.getPropertyValue('--lkc') === inkC(x.color), getComputedStyle(document.querySelector('[data-fk="st:' + g.id + ':start"]'), '::-webkit-calendar-picker-indicator').backgroundColor]; });
  ok(bb[0] > 0 && bb[0] === bb[1], 'B: ' + bb[1] + ' Gelenke im Gantt (je Verknüpfung eins)');
  ok(bb[2] && bb[3] && bb[4], 'B: verknüpfte Daten markiert, Kalendersymbol in Maßnahmenfarbe');

  // ---- C: Hinzeigen auf Ende „Gestaltung“ → nur „Beginn Korrekturphase“ bleibt farbig, Gelenk hervorgehoben
  let f = await field('Gestaltung', 'end', true); await p.mouse.move(f[0], f[1]); await p.waitForTimeout(200);
  const c = await p.evaluate(() => { const x = C.byId.get(UI.planSel), st = x.m.plan.steps, k = st.find(s => s.name === 'Korrekturphase'), g = st.find(s => s.name === 'Gestaltung');
    return [document.querySelector('.pl-split').classList.contains('lkhl'), [...document.querySelectorAll('.lkon')].map(e => e.dataset.fk).sort().join(), 'st:' + g.id + ':end,st:' + k.id + ':start', [...document.querySelectorAll('.g-links .lnk.on')].map(e => e.dataset.a + '>' + e.dataset.b).join(), g.id + '>' + k.id]; });
  ok(c[0] && c[1] === c[2] && c[3] === c[4], 'C: Hinzeigen – Partner farbig, der Rest hellgrau, Gelenk Gestaltung → Korrekturphase hervorgehoben');
  await p.mouse.move(5, 990); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !document.querySelector('.pl-split').classList.contains('lkhl')), 'C: Wegzeigen hebt es wieder auf');

  // ---- D: Strg-Ziehen in der Tabelle: Ende „Thema definieren“ → Beginn „Bilder einholen“; nur passende Ziele
  const bi0 = await span('Bilder einholen'), th = await span('Thema definieren');
  const fa = await field('Thema definieren', 'end', true), fb = await field('Bilder einholen', 'start');
  await ctrlDrag(fa, fb);
  const d = await p.evaluate(() => { const x = C.byId.get(UI.planSel), st = x.m.plan.steps, sec = secMap(x.m.plan), th = st.find(s => s.name === 'Thema definieren');
    const tg = [...document.querySelectorAll('.pl-table input.lktarget')].map(i => st.find(s => s.id === i.dataset.fk.slice(3, i.dataset.fk.lastIndexOf(':'))));
    return [tg.length, tg.some(s => sec.get(s.id) !== sec.get(th.id)) && tg.every(s => !s.pal && s.id !== th.id), tg.some(s => s.name === 'Texte erstellen'), tg.every(s => s.typ !== 'aufgabe' || document.querySelector('[data-fk="st:' + s.id + ':start"]').classList.contains('lktarget')),
      (document.querySelector('.drag-lab') || {}).textContent || '']; });
  ok(d[0] > 0 && d[1] && !d[2] && d[3], 'D: beim Ziehen vom Ende nur passende Anfänge markiert (' + d[0] + ', auch aus anderen Abschnitten), „Texte erstellen“ (schon verknüpft) und der Briefkasten-Termin nicht');
  ok(/Ende „Thema definieren“ → Beginn „Bilder einholen“/.test(d[4]) && /beginnt dann am/.test(d[4]), 'D: Vorschau – „' + d[4] + '“');
  await ctrlUp();
  const bi1 = await span('Bilder einholen'), dd = await p.evaluate(() => { const st = C.byId.get(UI.planSel).m.plan.steps; return predsOf(st.find(s => s.name === 'Bilder einholen')).map(i => st.find(s => s.id === i).name).join(); });
  ok(dd === 'Thema definieren' && bi1[0] === th[1] && bi1[1] - bi1[0] === bi0[1] - bi0[0], 'D: „Bilder einholen“ beginnt jetzt am Ende von „Thema definieren“ (Dauer bleibt)');
  ok(await p.evaluate(() => { const st = C.byId.get(UI.planSel).m.plan.steps; return dependents(C.byId.get(UI.planSel).m.plan, st.find(s => s.name === 'Thema definieren')).length === 2; }), 'D: ein Ende mit zwei Anfängen (Texte und Bilder)');

  // ---- E: Dauer ändern – Beginn bleibt, alles danach wandert mit
  const sel = '[data-fk="st:' + await id('Thema definieren') + ':dur"]', te0 = await span('Texte erstellen'), ge0 = await span('Gestaltung');
  await p.fill(sel, '4'); await p.press(sel, 'Enter'); await p.waitForTimeout(250);
  const th2 = await span('Thema definieren'), te1 = await span('Texte erstellen'), bi2 = await span('Bilder einholen'), ge1 = await span('Gestaltung');
  ok(th2[0] === th[0] && th2[1] === th[0] + 4 && te1[0] === te0[0] + 3 && bi2[0] === bi1[0] + 3 && ge1[0] === ge0[0] + 3, 'E: „Thema definieren“ 1 → 4 Tage: Beginn bleibt, Texte, Bilder, Gestaltung … +3 Tage');

  // ---- F: über den PAL hinaus → Warnung, „Alles vor den PAL rücken“ (PAL und Dauern bleiben)
  await p.fill(sel, '24'); await p.press(sel, 'Enter'); await p.waitForTimeout(250);
  const pal = await p.evaluate(() => C.byId.get(UI.planSel).pal), fr = await span('Freigaben einholen');
  const w = await p.evaluate(() => [(document.querySelector('.plwarn') || {}).textContent || '', document.querySelectorAll('.g-bar.late').length]);
  ok(fr[1] > pal && /endet \d+ Tage? nach dem PAL/.test(w[0]) && w[1] >= 1, 'F: Warnung „' + w[0].replace(/Alles.*$/, '') + '“, Balken markiert');
  const dur0 = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.filter(s => s.typ === 'aufgabe').map(s => s.dauer).join());
  await p.click('.plwarn button.primary'); await p.waitForTimeout(300);
  const fr2 = await span('Freigaben einholen'), after = await p.evaluate(() => [C.byId.get(UI.planSel).pal, C.byId.get(UI.planSel).m.plan.steps.filter(s => s.typ === 'aufgabe').map(s => s.dauer).join(), !!document.querySelector('.plwarn')]);
  ok(after[0] === pal && after[1] === dur0 && fr2[1] === pal && !after[2], 'F: vor den PAL gerückt – PAL und Dauern gleich, „Freigaben einholen“ endet am PAL, Warnung weg');
  await p.evaluate(() => { undo(); undo(); }); await p.waitForTimeout(200);

  // ---- G: Strg-Ziehen im Gantt: Ende „Selektion einleiten“ → Beginn „Interessensabwägung“
  const gb = await p.evaluate(() => { const x = C.byId.get(UI.planSel), el = n => document.querySelector('.g-body [data-sid="' + x.m.plan.steps.find(s => s.name === n).id + '"]');
    el('Selektion einleiten').scrollIntoView({ block: 'center', inline: 'center' }); const A = el('Selektion einleiten').getBoundingClientRect(), B = el('Interessensabwägung').getBoundingClientRect(); return [[A.right - 2, A.top + A.height / 2], [B.left + 1, B.top + B.height / 2]]; });
  await ctrlDrag(gb[0], gb[1]);
  const rings = await p.evaluate(() => document.querySelectorAll('.lk-overlay .ring').length);
  await ctrlUp();
  const g = await p.evaluate(() => { const st = C.byId.get(UI.planSel).m.plan.steps, s = st.find(s => s.name === 'Interessensabwägung'), x = C.byId.get(UI.planSel); return [predsOf(s).map(i => st.find(q => q.id === i).name).join(), x.pc.map.get(s.id).start === x.pc.map.get(st.find(q => q.name === 'Selektion einleiten').id).end]; });
  ok(rings > 0 && g[0] === 'Selektion einleiten' && g[1], 'G: im Gantt verknüpft (' + rings + ' Ziele als Ringe) – „Interessensabwägung“ beginnt nach „Selektion einleiten“');

  // ---- H: nicht erlaubt – anderer Abschnitt, Kreis, Briefkasten-Termin
  const hh = await p.evaluate(() => { const pl = C.byId.get(UI.planSel).m.plan, f = n => pl.steps.find(s => s.name === n).id;
    return [canLink(pl, f('Selektion einleiten'), f('Thema definieren')), canLink(pl, f('Freigaben einholen'), f('Thema definieren')), canLink(pl, f('Produktion & Versand'), f('Briefkasten-Termin')), canLink(pl, f('Thema definieren'), f('Korrekturphase'))]; });
  ok(hh[0] && !hh[1] && !hh[2] && hh[3], 'H: über Abschnitte geht (0.10.2), im Kreis und auf den Briefkasten-Termin nicht; ein weiterer Vorgänger geht');
  // über Abschnitte: Ende „Selektion abgeschlossen“ → Beginn „Thema definieren“; dann wandert der Inhalt mit der Selektion
  await p.evaluate(() => { const pl = C.byId.get(UI.planSel).m.plan, f = n => pl.steps.find(s => s.name === n).id; linkSteps(UI.planSel, f('Selektion abgeschlossen'), f('Thema definieren')); }); await p.waitForTimeout(250);
  const sa = await span('Selektion abgeschlossen'), tz = await span('Thema definieren');
  ok(tz[0] === sa[1], 'H: „Thema definieren“ beginnt jetzt am „Selektion abgeschlossen“ (anderer Abschnitt)');
  await p.evaluate(() => { const x = C.byId.get(UI.planSel); commit(d => setStepSpan(findM(d, x.id), x.m.plan.steps.find(s => s.name === 'Selektion abgeschlossen').id, x.pc.map.get(x.m.plan.steps.find(s => s.name === 'Selektion abgeschlossen').id).end + 2, x.pc.map.get(x.m.plan.steps.find(s => s.name === 'Selektion abgeschlossen').id).end + 2)); }); await p.waitForTimeout(250);
  ok((await span('Thema definieren'))[0] === tz[0] + 2, 'H: Selektion abgeschlossen +2 Tage → Thema definieren wandert mit');
  ok(await p.evaluate(() => !!document.querySelector('.g-links .lnk') && checkData().length === 0), 'H: Gelenk über Abschnitte gezeichnet, Datenprüfung ohne Befund');
  await p.evaluate(() => { undo(); undo(); }); await p.waitForTimeout(250);

  // ---- I: Strg+Klick auf ein verknüpftes Datum → Menü zum Lösen; Termine bleiben
  f = await field('Thema definieren', 'end', true);
  await p.keyboard.down('Control'); await p.mouse.click(f[0], f[1]); await p.keyboard.up('Control'); await p.waitForTimeout(200);
  const menu = await p.evaluate(() => [...document.querySelectorAll('.menu button')].map(b => b.textContent));
  ok(menu.includes('„Thema definieren“ → „Bilder einholen“ lösen') && menu.includes('„Thema definieren“ → „Texte erstellen“ lösen') && menu.some(t => /^Alle 2 lösen$/.test(t)), 'I: Strg+Klick – ' + menu.join(' | '));
  const bi3 = await span('Bilder einholen');
  await p.click('.menu button:has-text("„Bilder einholen“")'); await p.waitForTimeout(250);
  const ii = await p.evaluate(() => { const st = C.byId.get(UI.planSel).m.plan.steps; return st.find(s => s.name === 'Bilder einholen').anker.art; });
  ok(ii === 'pal' && JSON.stringify(await span('Bilder einholen')) === JSON.stringify(bi3), 'I: gelöst – „Bilder einholen“ hängt wieder am PAL, Termin unverändert');

  // ---- K: im Gantt Strg+Klick auf einen Punkt: eine Verknüpfung → sofort gelöst, mehrere → Auswahl an der Stelle
  const pt = (a, b, side) => p.evaluate(([a, b, side]) => { const st = C.byId.get(UI.planSel).m.plan.steps, ia = st.find(s => s.name === a).id, ib = st.find(s => s.name === b).id;
    const l = LINK_PTS.list.find(l => l.a === ia && l.b === ib), q = side === 'a' ? l.pa : l.pb, bb = LINK_PTS.body.getBoundingClientRect(); return [bb.left + q.x, bb.top + q.y]; }, [a, b, side]);
  await p.evaluate(() => document.querySelector('.g-body [data-sid]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(100);
  let q = await pt('Gestaltung', 'Korrekturphase', 'b');
  await p.evaluate(([x, y]) => document.elementFromPoint(x, y).scrollIntoView({ block: 'center', inline: 'center' }), q); await p.waitForTimeout(150);
  q = await pt('Gestaltung', 'Korrekturphase', 'b');
  const ko0 = await span('Korrekturphase');
  await p.keyboard.down('Control'); await p.mouse.click(q[0], q[1]); await p.keyboard.up('Control'); await p.waitForTimeout(300);
  const k1 = await p.evaluate(() => [C.byId.get(UI.planSel).m.plan.steps.find(s => s.name === 'Korrekturphase').anker.art, !!document.querySelector('.menu'), [...document.querySelectorAll('.toast')].map(t => t.textContent).pop() || '']);
  ok(k1[0] === 'pal' && !k1[1] && JSON.stringify(await span('Korrekturphase')) === JSON.stringify(ko0) && /Strg\+Z/.test(k1[2]), 'K: Punkt mit einer Verknüpfung – sofort gelöst, Termin bleibt („' + k1[2] + '“)');
  await p.evaluate(() => undo()); await p.waitForTimeout(250);
  q = await pt('Texte erstellen', 'Gestaltung', 'b');
  await p.keyboard.down('Control'); await p.mouse.click(q[0], q[1]); await p.keyboard.up('Control'); await p.waitForTimeout(300);
  const k2 = await p.evaluate(([x, y]) => { const m = document.querySelector('.menu'); if (!m) return null; const r = m.getBoundingClientRect(); return [[...m.querySelectorAll('button')].map(b => b.textContent), Math.round(Math.abs(r.left - x)), Math.round(r.top - y)]; }, q);
  ok(k2 && k2[0].length === 4 && k2[0].includes('Alle 3 lösen') && k2[1] <= 10 && k2[2] >= 0 && k2[2] <= 12, 'K: Beginn „Gestaltung“ (drei Vorgänger) – Auswahl direkt am Punkt: ' + (k2 && k2[0].join(' | ')));
  await p.click('.menu button:has-text("„Bilder einholen“ → „Gestaltung“")'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => { const st = C.byId.get(UI.planSel).m.plan.steps; return predsOf(st.find(s => s.name === 'Gestaltung')).map(i => st.find(q => q.id === i).name).join(); }) === 'Texte erstellen,Layoutphase', 'K: nur die gewählte gelöst (Texte und Layoutphase bleiben Vorgänger)');
  await p.evaluate(() => undo()); await p.waitForTimeout(250);
  // Strg + vom Punkt ziehen verknüpft weiterhin
  q = await pt('Gestaltung', 'Korrekturphase', 'a');
  const fz = await p.evaluate(() => { const el = document.querySelector('.g-body [data-sid="' + C.byId.get(UI.planSel).m.plan.steps.find(s => s.name === 'Freigaben einholen').id + '"]').getBoundingClientRect(); return [el.left + 2, el.top + el.height / 2]; });
  await ctrlDrag(q, fz); await ctrlUp();
  ok(await p.evaluate(() => { const st = C.byId.get(UI.planSel).m.plan.steps; return predsOf(st.find(s => s.name === 'Freigaben einholen')).map(i => st.find(q => q.id === i).name).sort().join(); }) === 'Gestaltung,Korrekturphase', 'K: Strg + vom Punkt ziehen legt eine neue Verknüpfung an');
  await p.evaluate(() => undo()); await p.waitForTimeout(250);

  // ---- J: Schritt in der Mitte löschen → Kette bleibt (Nachfolger übernimmt dessen Vorgänger), Termine gleich
  const fz0 = await span('Freigaben einholen');
  await p.evaluate(() => { const x = C.byId.get(UI.planSel); deleteStep(x.id, x.m.plan.steps.find(s => s.name === 'Korrekturphase').id); }); await p.waitForTimeout(200);
  const j = await p.evaluate(() => { const st = C.byId.get(UI.planSel).m.plan.steps; return predsOf(st.find(s => s.name === 'Freigaben einholen')).map(i => st.find(q => q.id === i).name).join(); });
  ok(j === 'Gestaltung' && JSON.stringify(await span('Freigaben einholen')) === JSON.stringify(fz0), 'J: „Korrekturphase“ gelöscht – „Freigaben einholen“ beginnt nach „Gestaltung“, Termin bleibt');
  ok(await p.evaluate(() => checkData().length === 0), 'J: Datenprüfung ohne Befund');
  await finish(b, pages);
})();
