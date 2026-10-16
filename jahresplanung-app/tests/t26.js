// 0.8 Sollte-Punkte und Ideen: Doppelklicks, Farbwahl im Dialog, Warnliste/Menüs am Rand, PDF-Zeitleiste, Anwesenheit, Protokoll, Datenprüfung
const { chromium, T, ORIG, ok, open, readF, writeF, connect, dataOf, withData, banners, finish, fs } = require('./lib');
const path = require('path');
(async () => {
  const b = await chromium.launch(), pages = [];

  // ---- A: Doppelklicks
  { const p = await open(b); pages.push(p);
    await p.evaluate(() => { commit(d => { d.urlaube.push({ id: 'v1', wer: 'Eva', von: '2027-03-01', bis: '2027-03-05' }, { id: 'v2', wer: 'Eva', von: '2027-04-01', bis: '2027-04-02' }); }); UI.view = 'urlaub'; renderNow(); });
    await p.dblclick('button[aria-label="Urlaub löschen"] >> nth=0'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => D.urlaube.length) === 1, 'A: Doppelklick auf ✕ löscht nur einen Urlaub');
    await p.evaluate(() => { UI.view = 'jahr'; renderNow(); });
    const n0 = await p.evaluate(() => D.massnahmen.length);
    await p.dblclick('button:has-text("+ Maßnahme")'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => D.massnahmen.length) === n0 + 1, 'A: Doppelklick auf „+ Maßnahme“ legt nur eine an');
    const id = await p.evaluate(() => C.ms.find(x => x.m.name === 'Projekt-Update 1').id);
    const c = await p.evaluate(id => { const e = document.querySelector('.cal .chip.S[data-m="' + id + '"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, id);
    await p.mouse.click(c[0], c[1]); await p.waitForTimeout(150);
    await p.dblclick('.mline .mline-edit >> nth=0'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => !!document.querySelector('.modal')), 'A: Doppelklick auf „Bearbeiten“ – das Fenster bleibt offen');
    await p.click('.modal footer button:has-text("Abbrechen")'); await p.waitForTimeout(150);
    await p.evaluate(id => { editMassnahme(id); }, id); await p.waitForTimeout(200);
    // Farbwahl im Bearbeiten-Fenster
    await p.click('.modal .swatch.big'); await p.waitForTimeout(150);
    const sw = await p.evaluate(() => { const s = document.querySelector('.menu.colors .sw:not(.on)'); const r = s.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return [top === s, s.style.background]; });
    ok(sw[0], 'A: Farbfelder liegen über dem Fenster und sind klickbar');
    await p.click('.menu.colors .sw:not(.on) >> nth=0'); await p.click('.modal footer button:has-text("Übernehmen")'); await p.waitForTimeout(150);
    ok(await p.evaluate(id => findM(D, id).farbe, id) !== '#2CA02C', 'A: neue Farbe übernommen (' + await p.evaluate(id => findM(D, id).farbe, id) + ')');
    await p.context().close(); }

  // ---- B: 150 % Skalierung (1280 px): Warnliste verdeckt die Knöpfe nicht; ⋯-Menü der letzten Zeile bleibt im Fenster
  { const p = await open(b, { width: 1280 }); pages.push(p);
    await p.evaluate(() => { UI.warnOpen = true; renderNow(); }); await p.waitForTimeout(150);
    const r = await p.evaluate(() => { const hd = document.querySelector('header.top').getBoundingClientRect(), wp = document.querySelector('.warnpanel').getBoundingClientRect(); const sv = document.querySelector('#savebox').getBoundingClientRect(); return [Math.round(hd.bottom), Math.round(wp.top), document.elementFromPoint(sv.x + sv.width / 2, sv.y + sv.height / 2).id]; });
    ok(r[1] >= r[0] && r[2] === 'savebox', 'B: Warnliste beginnt unter der Kopfzeile (' + r[1] + ' ≥ ' + r[0] + '), Speichern bleibt klickbar');
    await p.evaluate(() => { UI.warnOpen = false; renderNow(); });
    await p.setViewportSize({ width: 1280, height: 600 });
    await p.evaluate(() => { const rows = document.querySelectorAll('.mtable tbody tr'); rows[rows.length - 1].scrollIntoView({ block: 'end' }); });
    await p.click('.mtable tbody tr:last-child .acts .menu-btn'); await p.waitForTimeout(150);
    const m = await p.evaluate(() => { const r = document.querySelector('.menu').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), innerHeight]; });
    ok(m[0] >= 0 && m[1] <= m[2], 'B: ⋯-Menü der letzten Tabellenzeile liegt im Fenster (' + m[0] + '–' + m[1] + ' von ' + m[2] + ')');
    await p.context().close(); }

  // ---- C: PDF-Zeitleiste mit vielen Maßnahmen: mehrere Seiten, jede mit Monatsleiste
  { const p = await open(b); pages.push(p);
    const r = await p.evaluate(() => {
      commit(d => { for (let i = 0; i < 40; i++) d.massnahmen.push({ id: 'z' + i, name: 'Test ' + i, farbe: '#1F77B4', pal: ds(mkdn(2027, 2, 1) + i * 7), palStatus: 'vorläufig', vorlauf: { S: 60, I: 40, D: 15 } }); });
      window.print = () => {};
      printPDF({ secs: { tl: true }, show: { S: true, I: true, D: true, P: true }, vac: true, verbund: false, ms: new Set(C.ms.map(x => x.id)) });
      const pg = [...document.querySelectorAll('#printdoc .pd-page')];
      return [pg.length, pg.every(q => q.querySelector('.tl-months')), pg.map(q => q.querySelectorAll('.tl-row[data-m]').length).join('+'), UI._tl && UI._tl.pxd > 0];
    });
    ok(r[0] >= 3 && r[1], 'C: Zeitleiste im PDF auf ' + r[0] + ' Seiten (' + r[2] + ' Maßnahmen), jede mit Monatsleiste');
    await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await p.context().close(); }

  // ---- D: Anwesenheit, Änderungsprotokoll, Datenprüfung
  { const p = await open(b); pages.push(p); await connect(p);
    await p.evaluate(() => presenceTick()); await p.waitForTimeout(300);
    const files = await p.evaluate(() => Object.keys(__fs.files).filter(k => /Anwesenheit|automatisch/.test(k) || /anwesend-/.test(k)));
    ok(files.length === 1 && /Jahresplanung \(automatisch\)\/anwesend-/.test(files[0]), 'D: eigene Anwesenheitsdatei angelegt: ' + files[0]);
    await p.evaluate(() => { __fs.files['/Mailing/Jahresplanung (automatisch)/anwesend-eva.json'] = { data: new TextEncoder().encode(JSON.stringify({ name: 'Eva', inst: 'eva', since: new Date(Date.now() - 600000).toISOString(), at: new Date().toISOString(), edit: new Date(Date.now() - 60000).toISOString() })), lm: 1 }; });
    await p.evaluate(() => presenceTick()); await p.waitForTimeout(300); await p.evaluate(() => renderNow());
    const pr = await p.evaluate(() => [document.querySelector('.presence') && document.querySelector('.presence').textContent, [...document.querySelectorAll('.banner')].some(b => /Eva arbeitet gerade/.test(b.textContent))]);
    ok(/Eva/.test(pr[0] || '') && pr[1], 'D: Anzeige „' + pr[0] + '“ und Hinweis „Eva arbeitet gerade ebenfalls …“');
    // Protokoll
    await p.evaluate(() => { const x = C.ms.find(q => q.m.name === 'Jahresbericht'); commit(d => { findM(d, x.id).pal = '2027-09-03'; }); });
    await p.waitForTimeout(3500);
    const lg = await p.evaluate(() => { const e = D.log[D.log.length - 1]; return e ? [e.by, e.items.join(' | ')] : null; });
    ok(lg && lg[0] === 'Martin' && /Jahresbericht.*PAL.*03\.09\.2027/.test(lg[1]), 'D: Protokoll: ' + JSON.stringify(lg));
    ok(dataOf(await readF(p)).log.length >= 1, 'D: Protokoll steht in der gespeicherten Datei');
    const x = await p.evaluate(() => new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung – aktueller Stand.xlsx'].data));
    ok(x.includes('Änderungen') && x.includes('Jahresbericht'), 'D: Excel-Ansicht hat ein Blatt „Änderungen“');
    await p.evaluate(() => { logDialog(); }); await p.waitForTimeout(150);
    ok(/Jahresbericht/.test(await p.evaluate(() => document.querySelector('.modal .logview').textContent)), 'D: Änderungsprotokoll-Fenster zeigt den Eintrag');
    await p.click('.modal footer button'); await p.waitForTimeout(100);
    // Datenprüfung
    await p.evaluate(() => { commit(d => { d.urlaube.push({ id: 'kaputt', wer: 'Eva ', von: '2027-05-10', bis: '2027-05-03' }); d.massnahmen[0].verantwortlich = ' Martin'; }); renderNow(); });
    ok((await banners(p)).some(t => /Datenprüfung: 3 Auffälligkeiten/.test(t)), 'D: Hinweis „Datenprüfung: 3 Auffälligkeiten“');
    await p.click('.banner button:has-text("Ansehen")'); await p.waitForTimeout(150);
    await p.click('.modal footer button:has-text("Reparieren")'); await p.waitForTimeout(150);
    const fx = await p.evaluate(() => { const u = D.urlaube.find(q => q.id === 'kaputt'); return [u.von, u.bis, u.wer, D.massnahmen[0].verantwortlich, checkData().length]; });
    ok(fx[0] === '2027-05-03' && fx[1] === '2027-05-10' && fx[2] === 'Eva' && fx[3] === 'Martin' && fx[4] === 0, 'D: repariert: ' + JSON.stringify(fx));
    await p.context().close(); }
  await finish(b, pages);
})();
