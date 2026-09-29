const { chromium } = require('./pw');
const T = require('./common');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, locale: 'de-DE' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(T.URL); await p.waitForTimeout(300);
  await p.screenshot({ path: 'r3_1366_jahr.png' });
  const tw = await p.evaluate(() => { const w = document.querySelector('.tablewrap'); return [w.scrollWidth, w.clientWidth]; });
  console.log('Tabelle scrollWidth/clientWidth', tw);
  await p.click('nav.tabs >> text=Detailpläne'); await p.waitForTimeout(200); await p.screenshot({ path: 'r3_1366_plan.png' });
  await p.click('nav.tabs >> text=Zeitleiste'); await p.waitForTimeout(200); await p.screenshot({ path: 'r3_1366_zeit.png' });
  await p.click('nav.tabs >> text=Jahresplanung'); await p.waitForTimeout(100);
  await p.evaluate(() => { UI.printing = true; renderNow(); }); await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: 'r3_jahr.pdf', format: 'A4', landscape: true, printBackground: true });
  console.log('ERR', errs.join(' | ') || 'keine'); await b.close();
})();
