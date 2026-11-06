// Grundtest: alle Ansichten zeichnen ohne Fehler, und die App lädt nichts aus dem Internet
const { chromium } = require('./pw');
const T = require('./common');
const ok = (c, m) => console.log((c ? 'OK   ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE' });
  const errs = [], reqs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(e.message));
  p.on('request', r => { if (!/^(file|blob|data):/.test(r.url())) reqs.push(r.url()); });
  await p.goto(T.URL); await p.waitForTimeout(400);
  for (const v of ['jahr', 'plaene', 'urlaub', 'spenden']) {
    const r = await p.evaluate(v => { UI.view = v; renderNow(); return [!!document.querySelector('#main'), !document.querySelector('#main .error')]; }, v);
    await p.screenshot({ path: 'ansicht_' + v + '.png' });
    ok(r[0] && r[1], 'Ansicht ' + v + ' ohne Fehler');
  }
  const r = await p.evaluate(() => { const x = C.ms.find(x => x.m.name === 'Sommermailing'); return [x && x.s != null && x.i != null, C.ms.length]; });
  ok(r[0] && r[1] >= 10, 'Startdaten geladen: ' + r[1] + ' Maßnahmen, Sommermailing mit S und I aus dem Detailplan');
  ok(!reqs.length, 'keine Anfragen ins Internet' + (reqs.length ? ': ' + reqs.join(', ') : ''));
  console.log('ERR', errs.join(' | ') || 'keine');
  await b.close();
})();
