const { chromium } = require('./pw');
const T = require('./common');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, hh] of [[1600, 1000], [1366, 768]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: hh }, locale: 'de-DE' })).newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(T.URL); await p.waitForTimeout(300);
    await p.evaluate(() => { const s = document.querySelector('.sec[data-sec="kal"]'); window.scrollTo(0, 0); document.querySelector('#main').scrollTop = s.offsetTop - 60; });
    await p.waitForTimeout(100);
    await p.screenshot({ path: 'r5_' + w + '.png' });
    const hdr = await p.evaluate(() => { const hd = document.querySelector('.sec[data-sec="kal"] .sec-h'); return hd.getBoundingClientRect().height; });
    console.log(w, 'Kalender-Kopf Höhe', hdr);
    await p.click('nav.tabs >> text=Zeitleiste'); await p.waitForTimeout(150); await p.screenshot({ path: 'r5_zeit_' + w + '.png' });
  }
  console.log('ERR', errs.join(' | ') || 'keine'); await b.close();
})();
