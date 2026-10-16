// 0.7 Gleichzeitiges Arbeiten: Konflikt zusammenführen, OneDrive-Konfliktkopie, Arbeiten in einer Kopie, Entwurf mit anderem Ausgangsstand
const { chromium, T, ORIG, MAIN, ok, open, readF, writeF, connect, dataOf, withData, banners, finish, fs } = require('./lib');
const path = require('path');
(async () => {
  const b = await chromium.launch(), pages = [];
  const evaSaves = (text, fn) => withData(text, d => { d.meta.savedAt = new Date(Date.now() + 5000).toISOString(); d.meta.savedBy = 'Eva'; d.meta.rev = (d.meta.rev || 0) + 1; fn(d); });

  // ---- A: beide ändern Verschiedenes → Zusammenführen ohne Rückfrage
  { const p = await open(b); pages.push(p); await connect(p);
    await p.evaluate(() => { UI.autoSave = false; commit(d => { d.massnahmen[1].hinweis = 'MEIN HINWEIS'; }); });
    const theirs = evaSaves(await readF(p), d => { d.massnahmen[2].pal = '2027-06-18'; d.massnahmen.push({ id: 'evaneu', name: 'Evas neue Maßnahme', farbe: '#1F77B4', pal: '2027-08-20', palStatus: 'vorläufig', vorlauf: { S: 70, I: 50 } }); });
    await writeF(p, theirs);
    await p.evaluate(() => saveAll({ manual: true })); await p.waitForTimeout(300);
    ok(await p.evaluate(() => !!ST.conflict), 'A: Konflikt erkannt');
    ok((await banners(p)).some(t => /Zusammenführen/.test(t)), 'A: Hinweis mit „Zusammenführen …“');
    await p.evaluate(() => { UI.autoSave = true; });
    await p.click('.banner button:has-text("Zusammenführen")'); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => [!!document.querySelector('.modal'), D.massnahmen[1].hinweis, D.massnahmen[2].pal, D.massnahmen.some(m => m.id === 'evaneu'), !!ST.conflict]);
    ok(!r[0] && r[1] === 'MEIN HINWEIS' && r[2] === '2027-06-18' && r[3] && !r[4], 'A: ohne Rückfrage zusammengeführt – mein Hinweis, Evas PAL und Evas neue Maßnahme sind da');
    const saved = dataOf(await readF(p));
    ok(saved.massnahmen[1].hinweis === 'MEIN HINWEIS' && saved.massnahmen[2].pal === '2027-06-18' && saved.massnahmen.some(m => m.id === 'evaneu'), 'A: so auch gespeichert');
    await p.context().close(); }

  // ---- B: beide ändern dasselbe Feld → Rückfrage, Auswahl wird übernommen
  { const p = await open(b); pages.push(p); await connect(p);
    await p.evaluate(() => { UI.autoSave = false; commit(d => { d.massnahmen[3].pal = '2027-05-07'; d.massnahmen[4].hinweis = 'nur ich'; }); });
    await writeF(p, evaSaves(await readF(p), d => { d.massnahmen[3].pal = '2027-05-14'; }));
    await p.evaluate(() => saveAll({ manual: true })); await p.waitForTimeout(300);
    await p.evaluate(() => { UI.autoSave = true; });
    await p.click('.banner button:has-text("Zusammenführen")'); await p.waitForTimeout(300);
    const q = await p.evaluate(() => document.querySelector('.modal') ? document.querySelector('.modal').innerText.replace(/\s+/g, ' ') : '');
    ok(/PAL/.test(q) && /Eva/.test(q) && /1 Punkt/.test(q), 'B: Rückfrage zum PAL: „' + q.slice(0, 150) + '…“');
    await p.click('.modal .mrow label:has-text("Eva") input'); await p.click('.modal footer button.primary'); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => [D.massnahmen[3].pal, D.massnahmen[4].hinweis]);
    ok(r[0] === '2027-05-14' && r[1] === 'nur ich', 'B: gewählt „Eva“ → PAL ' + r[0] + ', meine andere Änderung bleibt (' + r[1] + ')');
    await p.context().close(); }

  // ---- C: OneDrive-Konfliktkopie im Ordner → Vergleichen, übernehmen, wegräumen
  { const p = await open(b); pages.push(p); await connect(p);
    const copy = evaSaves(await readF(p), d => { d.massnahmen.push({ id: 'ausKopie', name: 'Maßnahme aus der Kopie', farbe: '#2CA02C', pal: '2027-09-10', palStatus: 'vorläufig', vorlauf: { S: 70, I: 50 } }); d.massnahmen[5].hinweis = 'anders in der Kopie'; });
    await writeF(p, copy, 'Jahresplanung_Aussenkommunikation-LAPTOP-EVA.html');
    await p.evaluate(() => scanCopies()); await p.waitForTimeout(300); await p.evaluate(() => renderNow());
    ok((await banners(p)).some(t => /LAPTOP-EVA/.test(t) && /gleichzeitig/.test(t)), 'C: Hinweis auf die Konfliktkopie');
    await p.click('.banner button:has-text("Vergleichen")'); await p.waitForTimeout(300);
    const q = await p.evaluate(() => document.querySelector('.modal').innerText.replace(/\s+/g, ' '));
    ok(/Nur dort vorhanden \(1\)/i.test(q) && /Unterschiedlich \(1\)/i.test(q), 'C: Vergleich zeigt 1 neue und 1 abweichende Maßnahme' + (/Unterschiedlich \(1\)/i.test(q) ? '' : ': ' + q.slice(0, 600)));
    await p.click('.modal footer button.primary'); await p.waitForTimeout(300);            // Standard: nur das Neue übernehmen
    ok(/wegräumen/i.test(await p.evaluate(() => document.querySelector('.modal h2').textContent)), 'C: danach Frage „Kopie wegräumen?“');
    await p.click('.modal footer button.primary'); await p.waitForTimeout(3500);
    const files = await p.evaluate(() => Object.keys(__fs.files));
    const d = dataOf(await readF(p));
    ok(d.massnahmen.some(m => m.id === 'ausKopie') && d.massnahmen[5].hinweis !== 'anders in der Kopie', 'C: neue Maßnahme übernommen und gespeichert, abweichende (nicht angehakt) nicht');
    ok(!files.includes('/Mailing/Jahresplanung_Aussenkommunikation-LAPTOP-EVA.html') && files.includes('/Mailing/Konfliktkopien (erledigt)/Jahresplanung_Aussenkommunikation-LAPTOP-EVA.html'), 'C: Kopie in „Konfliktkopien (erledigt)“ verschoben');
    ok(!(await banners(p)).some(t => /LAPTOP-EVA/.test(t)), 'C: Hinweis verschwunden');
    await p.context().close(); }

  // ---- D: App aus einer Kopie gestartet → Hinweis „Hauptdatei öffnen“
  { const copyFile = path.resolve('Jahresplanung_Aussenkommunikation (1).html');
    fs.writeFileSync(copyFile, ORIG);
    const p = await open(b, { file: copyFile }); pages.push(p);
    await writeF(p, ORIG, 'Jahresplanung_Aussenkommunikation (1).html', 1000);
    await connect(p);
    await p.evaluate(() => scanCopies()); await p.waitForTimeout(300); await p.evaluate(() => renderNow());
    ok((await banners(p)).some(t => /eine Kopie/.test(t) && /Hauptdatei öffnen/.test(t)), 'D: Hinweis „Geöffnet ist … eine Kopie“ mit Knopf „Hauptdatei öffnen“');
    await p.context().close(); }

  // ---- E: ungespeicherte Änderung im Browser, inzwischen hat Eva gespeichert → Zusammenführen statt Verwerfen
  { const f = path.resolve('entwurf.html');
    fs.writeFileSync(f, withData(ORIG, d => { d.meta.savedAt = '2026-09-28T10:00:00.000Z'; }));
    const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
    let p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); pages.push(p);
    await p.goto('file://' + f); await p.waitForTimeout(300);
    await p.evaluate(() => commit(d => { d.massnahmen[1].hinweis = 'MEIN ENTWURF'; }));
    await p.close();
    fs.writeFileSync(f, withData(fs.readFileSync(f, 'utf8'), d => { d.meta.savedAt = '2026-09-29T09:00:00.000Z'; d.meta.savedBy = 'Eva'; d.massnahmen[2].hinweis = 'EVA'; }));
    p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); pages.push(p);
    await p.goto('file://' + f); await p.waitForTimeout(400);
    const bn = await banners(p);
    ok(bn.some(t => /ungespeicherte Änderungen/.test(t) && /zusammengeführt/.test(t)), 'E: Entwurf wird angeboten (nicht mehr still verworfen)');
    await p.click('.banner button:has-text("Zusammenführen")'); await p.waitForTimeout(400);
    const r = await p.evaluate(() => [D.massnahmen[1].hinweis, D.massnahmen[2].hinweis]);
    ok(r[0] === 'MEIN ENTWURF' && r[1] === 'EVA', 'E: beide Änderungen erhalten: ' + r.join(' / '));
    await ctx.close(); }
  await finish(b, pages);
})();
