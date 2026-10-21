// Ersetzt die früheren Bildschirm-Skripte ohne Prüfungen (t02–t11) für das, was sonst kein Test abdeckt:
// Ins Folgejahr kopieren, Excel- und Outlook-Export, Warnungen-Fenster, Speichern bei gesperrter Excel-Ansicht und bei abgelaufener Berechtigung
const { chromium, ok, open, readF, connect, banners, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { clock: true }); pages.push(p);
  // ---- A: Ins Folgejahr kopieren – alle Maßnahmen des Jahres, Strg+Z nimmt es zurück
  const y = await p.evaluate(() => { UI.view = 'jahr'; renderNow(); return UI.year; });
  const n0 = await p.evaluate(y => [C.ms.filter(x => inYear(x, y)).length, C.ms.filter(x => inYear(x, y + 1)).length], y);
  await p.click('button:has-text("Ins Folgejahr kopieren")'); await p.waitForTimeout(150);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(250);
  const n1 = await p.evaluate(y => [UI.year, C.ms.filter(x => inYear(x, y + 1)).length], y);
  ok(n0[0] > 0 && n1[0] === y + 1 && n1[1] === n0[1] + n0[0], 'A: alle ' + n0[0] + ' Maßnahmen ins Folgejahr kopiert, Ansicht springt dorthin ' + JSON.stringify([n0, n1]));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  ok(await p.evaluate(y => C.ms.filter(x => inYear(x, y + 1)).length, y) === n0[1], 'A: Strg+Z nimmt die Kopie zurück');
  // ---- B: Excel und Outlook als Download (zurück im Ausgangsjahr, das Folgejahr ist nach Strg+Z leer)
  await p.evaluate(y => { UI.year = y; renderNow(); }, y);
  let [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportExcel())]);
  ok(/^Jahresplanung_\d{4}_Export_\d{4}-\d\d-\d\d\.xlsx$/.test(dl.suggestedFilename()), 'B: Excel-Export als ' + dl.suggestedFilename());
  await p.evaluate(() => { exportICS(); }); await p.waitForSelector('.modal .icsprev');
  [dl] = await Promise.all([p.waitForEvent('download'), p.click('.modal:has(.icsprev) footer button.primary')]);
  const ics = require('fs').readFileSync(await dl.path(), 'utf8');
  ok(/\.ics$/.test(dl.suggestedFilename()) && /^BEGIN:VCALENDAR/.test(ics) && (ics.match(/BEGIN:VEVENT/g) || []).length > 0,
    'B: Outlook-Kalender ' + dl.suggestedFilename() + ' mit ' + (ics.match(/BEGIN:VEVENT/g) || []).length + ' Terminen');
  // ---- D: Warnungen-Fenster – Eintrag anklicken springt zur Stelle, „Alle … vorziehen“ über den Knopf
  await p.click('.warnbtn'); await p.waitForTimeout(150);
  const w0 = await p.evaluate(() => [document.querySelectorAll('.warnpanel .witem').length, C.warnings.filter(w => w.lvl === 'warn' && w.fix).length, !!document.querySelector('.warnpanel .fixall')]);
  await p.click('.warnpanel .witem .wtext'); await p.waitForTimeout(250);
  const w1 = await p.evaluate(() => [UI.warnOpen, !!document.querySelector('.warnpanel'), (document.querySelector('.flash') || {}).dataset?.flash || '']);
  ok(w0[0] > 0 && !w1[0] && !w1[1] && /^(m|step):/.test(w1[2]), 'D: Klick auf eine Warnung schließt das Fenster und springt dorthin ' + JSON.stringify([w0, w1]));
  if (w0[2]) {
    await p.click('.warnbtn'); await p.waitForTimeout(150); await p.click('.warnpanel .fixall'); await p.waitForTimeout(150);
    if (await p.$('.modal footer button.primary')) { await p.click('.modal footer button.primary'); await p.waitForTimeout(250); }
    const w2 = await p.evaluate(() => [C.warnings.filter(w => w.lvl === 'warn' && w.fix).length, [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ')]);
    ok(w2[0] < w0[1] && /vorgezogen/.test(w2[1]), 'D: „Alle … vorziehen“ legt die Termine auf Arbeitstage (' + w0[1] + ' → ' + w2[0] + ')');
  } else ok(false, 'D: Beispieldaten haben keine zwei behebbaren Warnungen mehr ' + JSON.stringify(w0));
  // ---- C: Speichern – Excel-Ansicht gesperrt (Programm trotzdem gespeichert), Berechtigung abgelaufen
  const q = await open(b, { clock: true }); pages.push(q);
  ok(await connect(q) === 'ok', 'C: Ordner verbunden');
  await q.evaluate(() => { __fs.lock = 'Jahresplanung – aktueller Stand.xlsx'; commit(d => { d.massnahmen[5].hinweis = 'Lock'; }); });
  await q.click('#savebox'); await q.waitForTimeout(600);
  ok((await banners(q)).some(t => /Excel-Ansicht.*nicht aktualisiert/.test(t)) && (await readF(q)).includes('"Lock"'), 'C: Excel-Ansicht gesperrt → Hinweis, Programm trotzdem gespeichert');
  await q.evaluate(() => { __fs.lock = null; ST.conn = 'needs-permission'; commit(d => { d.massnahmen[6].hinweis = 'Neu'; }); });
  await q.waitForTimeout(200);
  ok(/Speichern aktivieren/.test(await q.textContent('#savebox')), 'C: abgelaufene Berechtigung → „Speichern aktivieren“');
  await q.click('#savebox'); await q.waitForTimeout(600);
  ok(/Gespeichert/.test(await q.textContent('#savebox')) && (await readF(q)).includes('"Neu"'), 'C: ein Klick → Berechtigung erneuert und gespeichert');
  await finish(b, pages);
})();
