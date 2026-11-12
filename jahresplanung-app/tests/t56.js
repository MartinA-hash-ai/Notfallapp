// 0.15.2: Browser ohne Ordnerzugriff (Firefox, Safari, Brave): Hinweis-Leiste mit Erklärung und Anleitung, Edge oder Chrome als Standardbrowser festzulegen
const { chromium, ok, finish, T } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'de-DE', acceptDownloads: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0' });
  await ctx.addInitScript(() => { delete Window.prototype.showDirectoryPicker; delete window.showDirectoryPicker; delete Window.prototype.showSaveFilePicker; delete window.showSaveFilePicker; });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); pages.push(p);
  await p.goto('file://' + T.HTML); await p.waitForTimeout(500);
  const a = await p.evaluate(() => { const bn = document.querySelector('.brw-banner'); return [FSA, bn && bn.textContent]; });
  ok(a[0] === false && /^Firefox kann nicht direkt in den Mailing-Ordner speichern/.test(a[1] || '') && /Edge oder Chrome als Standardbrowser/.test(a[1]), 'A: Hinweis-Leiste – ' + a[1]);
  await p.click('.brw-banner button.primary'); await p.waitForTimeout(150);
  const d = await p.evaluate(() => { const m = document.querySelector('.modal'); return [m.querySelector('h2').textContent, m.textContent, m.querySelector('a.brw-btn').getAttribute('href')]; });
  ok(d[0] === 'Edge oder Chrome als Standardbrowser' && /nur Microsoft Edge und Google Chrome/.test(d[1]) && /In Firefox landet jede Änderung nur als Download/.test(d[1]) && /„Apps“ → „Standard-Apps“/.test(d[1]) && d[2] === 'ms-settings:defaultapps' && /Öffnen mit“ → „Microsoft Edge/.test(d[1]),
    'A: Erklärung mit Anleitung, Knopf zu den Windows-Einstellungen (' + d[2] + ') und Weg ohne Wechsel');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  // Speichern = Download, danach ebenfalls der Weg zur Anleitung
  await p.evaluate(() => commit(d => { d.massnahmen[0].hinweis = 'Firefox-Test'; })); await p.waitForTimeout(100);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#savebox')]); await p.waitForTimeout(200);
  const s = await p.evaluate(() => { const m = document.querySelector('.modal'); return [m.querySelector('h2').textContent, [...m.querySelectorAll('footer button')].map(x => x.textContent).join(' | ')]; });
  ok(dl.suggestedFilename() === 'Jahresplanung_Aussenkommunikation.html' && s[0] === 'Als Download gespeichert' && s[1] === 'Edge oder Chrome einrichten … | OK', 'B: Speichern lädt herunter – ' + s[1]);
  await p.click('.modal footer button:has-text("Edge oder Chrome einrichten")'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('.modal h2').textContent === 'Edge oder Chrome als Standardbrowser'), 'B: „Edge oder Chrome einrichten …“ öffnet die Anleitung');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  await p.click('.brw-banner button:has-text("Ausblenden")'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !document.querySelector('.brw-banner')), 'C: Hinweis lässt sich für diese Sitzung ausblenden');
  // in Edge/Chrome keine Leiste
  const q = await (await b.newContext()).newPage(); pages.push(q); q.errs = []; q.on('pageerror', e => q.errs.push(e.message));
  await q.goto('file://' + T.HTML); await q.waitForTimeout(400);
  ok(await q.evaluate(() => FSA && !document.querySelector('.brw-banner')), 'C: in Chrome/Edge keine Leiste');
  await finish(b, pages);
})();
