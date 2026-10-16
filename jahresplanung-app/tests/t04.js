const { chromium } = require('./pw');
const T = require('./common');
const URL = T.URL;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(300);
  const log = (...a) => console.log(...a);
  await p.evaluate(() => { localStorage.setItem('jp-savehint', '1'); window.__w = []; window.showSaveFilePicker = async () => ({ name: 'T.html', getFile: async () => ({ size: 0, lastModified: Date.now(), text: async () => '' }),
    createWritable: async () => ({ write: async t => { window.__w.push(t); }, close: async () => {} }) }); });
  await p.click('nav.tabs >> text=Jahresplanung'); await p.waitForTimeout(100);
  await p.click('[data-fk="m:m5:name"]'); await p.keyboard.press('End'); await p.keyboard.type(' 2027');
  await p.click('button.save'); await p.waitForTimeout(300);
  const w = await p.evaluate(() => window.__w);
  log('Saves:', w.length, 'enthält neuen Namen:', w.length ? w[w.length - 1].includes('Jahresbericht 2027') : false, 'dirty:', await p.evaluate(() => isDirty()));
  // Entwurf: neue Sitzung, ändern ohne Speichern, neu laden
  await p.close(); const ctx2 = await b.newContext({ locale: 'de-DE' }); const p2 = await ctx2.newPage(); p2.setDefaultTimeout(5000); p2.on('dialog', d => d.accept()); p2.on('pageerror', e => errs.push('p2: ' + e.message));
  await p2.goto(URL); await p2.waitForTimeout(300);
  await p2.evaluate(() => commit(d => { d.massnahmen[0].hinweis = 'Entwurfstest'; }));
  await p2.waitForTimeout(100);
  await p2.reload(); await p2.waitForTimeout(400);
  log('Banner:', await p2.$eval('.banner span', e => e.textContent).catch(() => 'kein Banner'));
  await p2.click('.banner button.primary'); await p2.waitForTimeout(150);
  log('wiederhergestellt:', await p2.evaluate(() => D.massnahmen[0].hinweis), 'dirty:', await p2.evaluate(() => isDirty()));
  log('ERR', errs.join('\n') || 'keine');
  await b.close();
})();
