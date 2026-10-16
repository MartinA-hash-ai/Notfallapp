const { chromium } = require('./pw');
const T = require('./common');
const fs = require('fs');
const HTML = T.HTML;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE' });
  await ctx.addInitScript({ path: T.FAKEFS });
  const p = await ctx.newPage(); p.setDefaultTimeout(6000);
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + HTML); await p.waitForTimeout(300);
  const orig = fs.readFileSync(HTML, 'utf8');
  await p.evaluate(t => { __fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'] = { data: new TextEncoder().encode(t), lm: 1000 }; __fs.files['/Mailing/Jahresplanung starten.cmd'] = { data: new Uint8Array([1]), lm: 1000 }; }, orig);
  const log = (...a) => console.log(...a);
  log('Knopf vorher:', await p.textContent('#savebox'));
  await p.evaluate(() => commit(d => { d.massnahmen[0].hinweis = 'Test 1'; UI.userName = 'Martin'; }));
  await p.waitForTimeout(200);
  log('Banner:', await p.$eval('.banner span', e => e.textContent).catch(() => '-'), '| Knopf:', await p.textContent('#savebox'));
  await p.click('#savebox'); await p.waitForTimeout(200);
  log('Dialog:', (await p.textContent('.modal h2')));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(800);
  const files = await p.evaluate(() => Object.fromEntries(Object.entries(__fs.files).map(([k, v]) => [k, [v.data.length, v.lm]])));
  log('Dateien:', JSON.stringify(files));
  log('Knopf nach Speichern:', await p.textContent('#savebox'), 'dirty:', await p.evaluate(() => isDirty()));
  const xlsx = await p.evaluate(() => Array.from(__fs.files['/Mailing/Jahresplanung – aktueller Stand.xlsx'].data));
  fs.writeFileSync('ansicht.xlsx', Buffer.from(xlsx));
  const saved1 = await p.evaluate(() => new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data));
  log('HTML enthält Änderung:', saved1.includes('Test 1'), 'savedBy Martin:', saved1.includes('"savedBy":"Martin"'));
  // Autospeichern
  await p.evaluate(() => commit(d => { d.massnahmen[1].hinweis = 'Auto 2'; }));
  log('Knopf direkt nach Änderung:', await p.textContent('#savebox'));
  await p.waitForTimeout(3500);
  const saved2 = await p.evaluate(() => new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data));
  log('Autospeichern:', saved2.includes('Auto 2'), 'Knopf:', await p.textContent('#savebox'));
  // Fremde Änderung ohne eigene offene Änderungen -> automatisch laden
  await p.evaluate(() => {
    const t = new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data);
    const m = t.match(/(<script type="application\/json" id="jp-data">)([\s\S]*?)(<\/script>)/);
    const d = JSON.parse(m[2]); d.massnahmen[2].hinweis = 'Von Eva'; d.meta.savedAt = new Date(Date.now() + 1000).toISOString(); d.meta.savedBy = 'Eva';
    __fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'] = { data: new TextEncoder().encode(t.replace(m[2], JSON.stringify(d).replace(/</g, '\\u003c'))), lm: 9000 };
  });
  await p.waitForTimeout(16000);
  log('Fremder Stand geladen:', await p.evaluate(() => D.massnahmen[2].hinweis), await p.$$eval('.toast', e => e.map(x => x.textContent).slice(-1)[0]));
  // Konflikt: eigene Änderung offen (Autospeichern aus) + fremde Änderung
  await p.evaluate(() => { UI.autoSave = false; commit(d => { d.massnahmen[3].hinweis = 'Meins'; }); });
  await p.evaluate(() => {
    const t = new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data);
    const m = t.match(/(<script type="application\/json" id="jp-data">)([\s\S]*?)(<\/script>)/);
    const d = JSON.parse(m[2]); d.massnahmen[4].hinweis = 'Eva 2'; d.meta.savedAt = new Date(Date.now() + 5000).toISOString(); d.meta.savedBy = 'Eva';
    __fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'] = { data: new TextEncoder().encode(t.replace(m[2], JSON.stringify(d).replace(/</g, '\\u003c'))), lm: 9500 };
  });
  await p.click('#savebox'); await p.waitForTimeout(500);
  log('Konflikt-Banner:', await p.$eval('.banner.err span', e => e.textContent).catch(() => '-'), '| Knopf:', await p.textContent('#savebox'));
  await p.screenshot({ path: 'r4_konflikt.png' });
  await p.click('.banner.err button.primary'); await p.waitForTimeout(800);
  const saved3 = await p.evaluate(() => new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data));
  log('Meins gespeichert:', saved3.includes('Meins'), 'Eva 2 überschrieben:', !saved3.includes('Eva 2'));
  // Excel gesperrt
  await p.evaluate(() => { __fs.lock = 'Jahresplanung – aktueller Stand.xlsx'; commit(d => { d.massnahmen[5].hinweis = 'Lock'; }); });
  await p.click('#savebox'); await p.waitForTimeout(600);
  log('Excel gesperrt Banner:', await p.$$eval('.banner.warn span', e => e.map(x => x.textContent.slice(0, 60)).join(' | ')));
  // neuer Start: Berechtigung abgelaufen
  await p.evaluate(() => { __fs.lock = null; ST.conn = 'needs-permission'; commit(d => { d.massnahmen[6].hinweis = 'Neu'; }); });
  await p.waitForTimeout(200);
  log('Knopf ohne Berechtigung:', await p.textContent('#savebox'));
  await p.click('#savebox'); await p.waitForTimeout(600);
  log('nach Aktivieren:', await p.textContent('#savebox'), 'gespeichert:', (await p.evaluate(() => new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data))).includes('"Neu"'));
  log('ERR', errs.join('\n') || 'keine');
  await b.close();
})();
