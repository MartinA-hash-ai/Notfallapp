// 0.7 Daten: beschädigte Datei, kaputte Einträge, Fehler mitten in einer Änderung, Datumsfelder, Grenzen, Bearbeiten-Dialog
const { chromium, T, ORIG, ok, open, readF, writeF, connect, withData, banners, finish, fs } = require('./lib');
const path = require('path');
(async () => {
  const b = await chromium.launch(), pages = [];

  // ---- A: Datenteil der Datei beschädigt → nicht leer starten, Speichern gesperrt, Sicherung laden hilft
  { const f = path.resolve('kaputt.html');
    fs.writeFileSync(f, ORIG.replace(/(<script type="application\/json" id="jp-data">)([\s\S]*?)(<\/script>)/, (m, a, d, c) => a + d.slice(0, d.length >> 1) + c));
    const p = await open(b, { file: f }); pages.push(p);
    const s = await p.evaluate(() => [!!BROKEN, document.querySelector('.modal h2') && document.querySelector('.modal h2').textContent]);
    ok(s[0] && s[1] === 'Planungsdaten beschädigt', 'A: beschädigte Daten erkannt, Dialog „' + s[1] + '“');
    await p.click('.modal footer button:has-text("Nur ansehen")'); await p.waitForTimeout(100);
    await writeF(p, fs.readFileSync(f, 'utf8'), 'Jahresplanung_Aussenkommunikation.html', 1000);
    const r = await p.evaluate(async () => { commit(d => { d.massnahmen.push({ id: 'x', name: 'leer weitergearbeitet' }); }); const a = await saveAll({ manual: true }); return [a, document.querySelector('#savebox').textContent]; });
    ok(r[0] === false && /gesperrt/.test(r[1]), 'A: Speichern gesperrt („' + r[1] + '“) – die Datei wird nicht mit leerem Stand überschrieben');
    ok((await banners(p)).some(t => /beschädigt/.test(t)), 'A: Hinweis oben bleibt stehen');
    fs.writeFileSync('sicherung.json', ORIG.match(/id="jp-data">([\s\S]*?)<\/script>/)[1]);
    await p.click('.banner button:has-text("Wiederherstellen")'); await p.waitForTimeout(200);
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.modal footer button:has-text("Datensicherung laden")')]);
    await fc.setFiles('sicherung.json'); await p.waitForTimeout(400);
    const r2 = await p.evaluate(() => [!!BROKEN, D.massnahmen.length]);
    ok(!r2[0] && r2[1] >= 10, 'A: Datensicherung geladen – ' + r2[1] + ' Maßnahmen, Speichern wieder frei');
    await p.context().close(); }

  // ---- B: kaputte Einträge (z. B. aus Import) → App startet trotzdem, alle Ansichten zeichnen
  { const f = path.resolve('kaputte_eintraege.html');
    fs.writeFileSync(f, withData(ORIG, d => { d.massnahmen.push(null, 'text', { name: 42, verantwortlich: 7, plan: 'kaputt' }); d.urlaube.push(null, { wer: 5, von: '2027-03-01', bis: '2027-03-05' }); d.personen.push(null); d.massnahmen[0].plan = { steps: { a: 1 } }; }));
    const p = await open(b, { file: f }); pages.push(p);
    const r = await p.evaluate(() => ['jahr', 'zeit', 'plaene', 'urlaub'].map(v => { UI.view = v; renderNow(); return !!document.querySelector('#main') && !document.querySelector('#main .error'); }));
    ok(r.every(Boolean) && !p.errs.length, 'B: kaputte Einträge aussortiert, alle vier Ansichten fehlerfrei');
    await p.context().close(); }

  // ---- C: Fehler mitten in einer Änderung → nichts halb geändert
  { const p = await open(b); pages.push(p);
    const r = await p.evaluate(() => { const n0 = D.massnahmen[0].name, u0 = UNDO.length; const res = commit(d => { d.massnahmen[0].name = 'HALB'; throw new Error('boom'); }); return [res, D.massnahmen[0].name === n0, UNDO.length === u0, isDirty()]; });
    ok(r[0] === false && r[1] && r[2] && !r[3], 'C: Änderung vollständig zurückgenommen, nichts ungespeichert');
    await p.context().close(); }

  // ---- D: Datumsfelder
  { const p = await open(b); pages.push(p);
    const r = await p.evaluate(() => [dn('2026-02-30'), dn('0027-05-01'), dn('20277-01-06'), dn('2027-05-01') === mkdn(2027, 5, 1), ymd(mkdn(27, 5, 1))[0]]);
    ok(r[0] === null && r[1] === null && r[2] === null && r[3] && r[4] === 27, 'D: unmögliche Daten ergeben „leer“ statt 02.03./1927; Jahr 27 bleibt 27');
    const id = await p.evaluate(() => C.ms.find(x => x.m.name === 'Projekt-Update 1').id);
    const inp = p.locator(`tr[data-m="${id}"] td.pal input`);
    const v0 = await inp.inputValue();
    // fünfstelliges Jahr eintippen
    await inp.click({ position: { x: 70, y: 10 } }); await p.keyboard.type('20277'); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
    const pal1 = await p.evaluate(id => findM(D, id).pal, id);
    ok(pal1 === v0 || /^20\d\d-/.test(pal1), 'D: fünfstelliges Jahr nicht übernommen (PAL ' + pal1 + ')');
    // Teil des Datums löschen und wegklicken
    const inp2 = p.locator(`tr[data-m="${id}"] td.pal input`);
    await inp2.click({ position: { x: 20, y: 10 } }); await p.keyboard.press('Backspace'); await p.mouse.click(1500, 950); await p.waitForTimeout(300);
    const pal2 = await p.evaluate(id => findM(D, id).pal, id);
    const toasts = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
    ok(pal2 === pal1 && /unvollständig/.test(toasts), 'D: halb gelöschtes Datum nicht als „leer“ gespeichert (PAL bleibt ' + pal2 + '), Meldung: ' + toasts.slice(-60));
    // Jahr „27“ → 0027 → abgewiesen
    const inp3 = p.locator(`tr[data-m="${id}"] td.pal input`);
    await inp3.click({ position: { x: 70, y: 10 } }); await p.keyboard.type('27'); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
    const pal3 = await p.evaluate(id => findM(D, id).pal, id);
    ok(pal3 === pal1, 'D: Jahr „27“ nicht übernommen (PAL bleibt ' + pal3 + ')');
    await p.context().close(); }

  // ---- E: Tippfehler aus älteren Daten bremsen die Ansichten nicht mehr aus
  { const p = await open(b); pages.push(p);
    const r = await p.evaluate(() => {
      const x = C.ms.find(x => x.m.plan);
      commit(d => { const m = findM(d, x.id); const st = m.plan.steps.find(s => s.typ === 'aufgabe'); st.anker = { art: 'fest', datum: '2190-01-06' }; m.plan.steps.filter(s => s.typ === 'aufgabe')[1].anker = { art: 'fest', datum: '20277-01-06' }; });
      UI.planSel = x.id; UI.view = 'plaene';
      let t0 = performance.now(); renderNow(); const tPlan = performance.now() - t0;
      commit(d => { d.massnahmen.find(m => !m.plan && m.pal).vorlaufS = 36500; });
      UI.view = 'zeit'; t0 = performance.now(); renderNow(); const tTl = performance.now() - t0;
      return [Math.round(tPlan), Math.round(tTl), C.warnings.filter(w => /Datum prüfen/.test(w.text)).length];
    });
    ok(r[0] < 1500 && r[1] < 1500, 'E: Detailplan ' + r[0] + ' ms, Zeitleiste ' + r[1] + ' ms trotz Terminen in den Jahren 2190, 20277 und 1927 (vorher 5–60 s)');
    ok(r[2] >= 3, 'E: ' + r[2] + ' Warnungen „Datum prüfen“ (weit entfernt, ungültig, Start 1927)');
    await p.context().close(); }

  // ---- F: „Maßnahme bearbeiten“ überschreibt keine Änderungen, die inzwischen von anderen geladen wurden
  { const p = await open(b); pages.push(p);
    const id = await p.evaluate(() => C.ms.find(x => x.m.plan).id);
    await p.evaluate(id => { editMassnahme(id); }, id); await p.waitForTimeout(200);
    await p.evaluate(id => {                     // während der Dialog offen ist: Stand von Eva wird geladen (wie durch die Überwachung)
      const o = JSON.parse(JSON.stringify(D)); const m = o.massnahmen.find(q => q.id === id);
      m.pal = '2027-12-03'; m.hinweis = 'von Eva'; m.plan.steps.find(s => s.typ === 'aufgabe').dauer = 30; o.meta.savedAt = new Date().toISOString(); o.meta.savedBy = 'Eva';
      externalChange(o);
    }, id);
    await p.fill('.modal input:not([type])', 'Neuer Name von mir'); await p.click('.modal footer button:has-text("Übernehmen")'); await p.waitForTimeout(200);
    const r = await p.evaluate(id => { const m = findM(D, id); return [m.name, m.pal, m.hinweis, m.plan.steps.find(s => s.typ === 'aufgabe').dauer]; }, id);
    ok(r[0] === 'Neuer Name von mir' && r[1] === '2027-12-03' && r[2] === 'von Eva' && r[3] === 30, 'F: mein Name übernommen, Evas PAL/Hinweis/Detailplan bleiben: ' + JSON.stringify(r));
    await p.context().close(); }
  await finish(b, pages);
})();
