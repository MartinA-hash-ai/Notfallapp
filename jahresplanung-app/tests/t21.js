// 0.7 Speichern: Update-Schutz, automatische Wiederholung, unlesbare Datei, Excel-Jahr, Warnung bei älterem Update
const { chromium, T, ORIG, ok, open, readF, writeF, connect, withData, verOf, banners, finish, fs } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];

  // ---- A: Kollegin hat eine neuere Version eingespielt, mein altes Fenster ist noch offen
  { const p = await open(b); pages.push(p);
    ok(await connect(p) === 'ok', 'A: Ordner verbunden');
    const newer = withData((await readF(p)).replace('const APP_INFO = {"version": "' + T.VERSION + '"', 'const APP_INFO = {"version": "' + T.NEWER + '"'),
      d => { d.meta.savedAt = new Date(Date.now() + 5000).toISOString(); d.meta.savedBy = 'Eva'; d.massnahmen[2].hinweis = 'von Eva'; });
    await writeF(p, newer);
    await p.waitForTimeout(16000);                                         // Überwachung (alle 15 s)
    const st = await p.evaluate(() => [ST.newer && ST.newer.version, D.massnahmen[2].hinweis, document.querySelector('#savebox').textContent]);
    ok(st[0] === T.NEWER && st[1] === 'von Eva', 'A: neuere Version erkannt (' + st[0] + '), Evas Daten geladen, Knopf „' + st[2] + '“');
    ok((await banners(p)).some(t => /neuere Programmversion/.test(t)), 'A: Hinweis „neuere Programmversion – Jetzt neu starten“');
    await p.evaluate(() => commit(d => { d.massnahmen[1].hinweis = 'altes Fenster'; }));
    await p.waitForTimeout(3500);
    const after = await readF(p);
    ok(verOf(after) === T.NEWER && !after.includes('altes Fenster'), 'A: altes Fenster schreibt NICHT zurück (Datei bleibt Version ' + verOf(after) + ')');
    const man = await p.evaluate(async () => { const r = await saveAll({ manual: true }); return [r, [...document.querySelectorAll('.toast')].map(t => t.textContent).pop()]; });
    ok(man[0] === false && /neuere Programmversion/.test(man[1] || ''), 'A: auch Strg+S speichert nicht: „' + (man[1] || '').slice(0, 70) + '…“');
    const dr = await p.evaluate(() => { saveDraft(); const d = JSON.parse(localStorage.getItem(draftKey())); return [!!d, d && !!d.baseData, d && d.data.massnahmen[1].hinweis]; });
    ok(dr[0] && dr[1] && dr[2] === 'altes Fenster', 'A: ungespeicherte Änderung liegt für den Neustart im Browser bereit (mit Ausgangsstand)');
    await p.context().close(); }

  // ---- B: Datei kurz gesperrt → automatisch erneut speichern
  { const p = await open(b); pages.push(p); await connect(p);
    await p.evaluate(() => { __fs.lock = 'Jahresplanung_Aussenkommunikation.html'; commit(d => { d.massnahmen[1].hinweis = 'GESPERRT'; }); });
    await p.waitForTimeout(3300);
    const btn = await p.textContent('#savebox');
    ok(/Nicht gespeichert/.test(btn), 'B: während der Sperre zeigt der Knopf „' + btn + '“ (statt „wird gespeichert …“)');
    await p.evaluate(() => { __fs.lock = null; });
    await p.waitForTimeout(6500);
    const t = await readF(p);
    ok(t.includes('"hinweis":"GESPERRT"') && !(await p.evaluate(() => isDirty())), 'B: nach Ende der Sperre automatisch gespeichert, Knopf „' + await p.textContent('#savebox') + '“');
    await p.context().close(); }

  // ---- C: Datei im Ordner gerade unlesbar (halb synchronisiert) → nicht überschreiben
  { const p = await open(b); pages.push(p); await connect(p);
    const good = await readF(p);
    await writeF(p, '<!DOCTYPE html><html><body>halb');
    await p.evaluate(() => commit(d => { d.massnahmen[1].hinweis = 'C'; }));
    await p.waitForTimeout(3300);
    ok((await readF(p)).startsWith('<!DOCTYPE html><html><body>halb'), 'C: unlesbare Datei wird nicht blind überschrieben');
    await writeF(p, good);                                                   // Synchronisierung fertig
    await p.waitForTimeout(6500);
    const t = await readF(p);
    ok(t.includes('"hinweis":"C"'), 'C: danach automatisch gespeichert');
    await p.context().close(); }

  // ---- D: Excel-Ansicht zeigt immer das Planungsjahr, egal welches Jahr gerade angesehen wird
  { const p = await open(b); pages.push(p); await connect(p);
    const py = await p.evaluate(() => { UI.year = D.settings.year + 1; renderNow(); commit(d => { d.massnahmen[1].hinweis = 'D'; }); return D.settings.year; });
    await p.waitForTimeout(3500);
    const x = await p.evaluate(() => new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung – aktueller Stand.xlsx'].data));
    ok(x.includes('Jahresplanung Außenkommunikation ' + py) && !x.includes('Jahresplanung Außenkommunikation ' + (py + 1)), 'D: Excel-Ansicht zeigt ' + py + ', obwohl ' + (py + 1) + ' angesehen wird');
    ok(await p.evaluate(() => UI.year) === py + 1, 'D: die eigene Ansicht bleibt beim angesehenen Jahr');
    await p.context().close(); }

  // ---- E: Programm-Update mit einer älteren Datei → Rückfrage
  { const p = await open(b); pages.push(p); await connect(p);
    fs.writeFileSync('alt_0.1.html', ORIG.replace('const APP_INFO = {"version": "' + T.VERSION + '"', 'const APP_INFO = {"version": "0.1"'));
    await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Programm-Update")'); await p.waitForTimeout(100);
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.modal footer button.primary')]);
    await fc.setFiles('alt_0.1.html'); await p.waitForTimeout(300);
    const q = await p.evaluate(() => document.querySelector('.modal') ? document.querySelector('.modal').innerText : '');
    ok(/Ältere Version/.test(q) && /zurückgestuft/.test(q), 'E: Warnung vor Zurückstufen: „' + q.replace(/\s+/g, ' ').slice(0, 90) + '…“');
    await p.click('.modal footer button:has-text("Abbrechen")'); await p.waitForTimeout(200);
    ok(verOf(await readF(p)) === T.VERSION, 'E: nach Abbrechen bleibt Version ' + T.VERSION);
    await p.context().close(); }
  await finish(b, pages);
})();
