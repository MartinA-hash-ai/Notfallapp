// Programm-Update: Paket im Ordner wird gemeldet, eingespielt, die Daten bleiben
const { chromium, ok, open, readF, connect, dataOf, verOf, finish, ORIG } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b, {});
  ok(await connect(p) === 'ok', 'Ordner verbunden');
  await p.evaluate(async () => { const x = blank(); x.titel = 'bleibt'; D.bedarfe.push(x); changed(); await saveAll({}); });
  const neu = ORIG.replace(/const APP_INFO = \{"version": "[^"]+"/, 'const APP_INFO = {"version": "99.0"').replace('<strong>Bedarfsliste</strong>', '<strong>Bedarfsliste NEU</strong>');
  await p.evaluate(async html => { const z = zipBlob([{ name: 'Bedarfsliste.html', data: html }], 'application/zip'); __fs.files['/Ordner/Bedarfsliste_Update.zip'] = { data: new Uint8Array(await z.arrayBuffer()), lm: 80000 }; await scanUpdatePkg(); renderNow(); }, neu);
  ok((await p.$eval('.banners', e => e.textContent)).includes('Update-Paket „Bedarfsliste_Update.zip“ mit Version 99.0'), 'Update-Paket im Ordner wird gemeldet');
  await p.click('button[data-act="zip-go"]'); await p.waitForSelector('.modal');
  await p.click('.modal footer button.primary');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('Update gespeichert')), null, { timeout: 5000 });
  const t = await readF(p), files = await p.evaluate(() => Object.keys(__fs.files));
  ok(verOf(t) === '99.0' && t.includes('Bedarfsliste NEU'), 'neues Programm gespeichert');
  ok(dataOf(t).bedarfe.some(x => x.titel === 'bleibt'), 'Daten sind erhalten');
  ok(!files.includes('/Ordner/Bedarfsliste_Update.zip'), 'Paket danach aus dem Ordner entfernt');
  await finish(b, [p]);
})();
