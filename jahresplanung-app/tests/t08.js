const { chromium } = require('./pw');
const T = require('./common');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 768 }, locale: 'de-DE' })).newPage();
  await p.goto(T.URL); await p.waitForTimeout(300);
  console.log(await p.evaluate(() => [...document.querySelectorAll('.mtable thead th')].map(th => (th.textContent || th.className) + ':' + Math.round(th.getBoundingClientRect().width)).join(' | ')));
  await b.close();
})();
