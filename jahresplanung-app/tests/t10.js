const { chromium } = require('./pw');
const T = require('./common');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'de-DE' });
  await ctx.addInitScript({ path: T.FAKEFS });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(T.URL); await p.waitForTimeout(300);
  await p.evaluate(t => { __fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'] = { data: new TextEncoder().encode(t), lm: 1000 }; }, fs.readFileSync(T.HTML, 'utf8'));
  await p.evaluate(() => commit(d => { d.urlaube.push({ id: 'u1', wer: 'Eva', von: '2027-04-01', bis: '2027-04-09' }, { id: 'u2', wer: 'Martin', von: '2027-04-05', bis: '2027-04-16' }, { id: 'u3', wer: 'Anke', von: '2027-08-02', bis: '2027-08-13' }); }));
  await p.click('#savebox'); await p.waitForTimeout(200); await p.click('.modal footer button.primary'); await p.waitForTimeout(900);
  fs.writeFileSync('ansicht2.xlsx', Buffer.from(await p.evaluate(() => Array.from(__fs.files['/Mailing/Jahresplanung – aktueller Stand.xlsx'].data))));
  await p.screenshot({ path: 'r4_saved.png' });
  console.log('ERR', errs.join(' | ') || 'keine'); await b.close();
})();
