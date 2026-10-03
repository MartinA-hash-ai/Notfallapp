const { chromium } = require('./pw');
const T = require('./common');
const URL = T.URL;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(URL); await p.waitForTimeout(300);
  const log = (...a) => console.log(...a);
  await p.evaluate(() => commit(d => { d.urlaube.push({ id: 'u1', wer: 'Eva', von: '2027-04-01', bis: '2027-04-09' }, { id: 'u2', wer: 'Martin', von: '2027-04-05', bis: '2027-04-16' }); }));
  await p.waitForTimeout(100);
  log('Reiter:', await p.$$eval('nav.tabs .tab', e => e.map(x => x.textContent).join(' | ')));
  await p.screenshot({ path: 'r2_jahr.png' });
  await p.screenshot({ path: 'r2_jahr_full.png', fullPage: true });
  // Maßnahmen einklappen
  await p.click('.sec[data-sec="mass"] .sec-tog'); await p.waitForTimeout(100);
  await p.screenshot({ path: 'r2_jahr_zu.png' });
  // P ziehen: Projekt-Update 1 (m3) PAL 23.04. -> 30.04. (eine Woche runter)
  const chipP = await p.$('.day[data-dn] .chip.P[data-m="m3"]');
  const bb = await chipP.boundingBox();
  const target = await p.evaluate(() => { const c = document.querySelector('.day[data-dn="' + (dn('2027-04-30')) + '"]'); const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(bb.x + 5, bb.y + 5); await p.mouse.down();
  await p.mouse.move(bb.x + 20, bb.y + 15, { steps: 3 });
  await p.mouse.move(target.x, target.y, { steps: 8 });
  log('Drag-Label:', (await p.textContent('.drag-lab')).replace(/\s+/g, ' '), 'Markierte Zellen:', await p.$$eval('.day.drop', e => e.map(c => c.dataset.drop + fmtS(+c.dataset.dn)).join(',')));
  await p.screenshot({ path: 'r2_drag.png' });
  await p.mouse.up(); await p.waitForTimeout(150);
  log('nach P-Ziehen:', await p.evaluate(() => { const x = C.byId.get('m3'); return [fmtW(x.pal), fmtW(x.s), fmtW(x.i), x.vS, x.vI].join(' / '); }));
  // S ziehen: Projekt-Update 1 S um 1 Tag nach links
  const chipS = await p.$('.day[data-dn] .chip.S[data-m="m3"]');
  const sb = await chipS.boundingBox();
  const sNow = await p.evaluate(() => C.byId.get('m3').s);
  const t2 = await p.evaluate(n => { const c = document.querySelector('.day[data-dn="' + n + '"]'); const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sNow - 1);
  await p.mouse.move(sb.x + 5, sb.y + 5); await p.mouse.down(); await p.mouse.move(t2.x, t2.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150);
  log('nach S-Ziehen:', await p.evaluate(() => { const x = C.byId.get('m3'); return [fmtW(x.pal), fmtW(x.s), fmtW(x.i), x.vS, x.vI].join(' / '); }));
  // Klick ohne Ziehen öffnet Dialog
  const chipI = await p.$('.day[data-dn] .chip.I[data-m="m3"]'); await chipI.click(); await p.waitForTimeout(150);
  log('Dialog offen:', await p.$$eval('.modal', e => e.length)); await p.keyboard.press('Escape');
  // S bei Detailplan-Maßnahme ziehen -> Hinweis
  const cS = await p.$('.day[data-dn] .chip.S[data-m="m4"]'); const cb = await cS.boundingBox();
  await p.mouse.move(cb.x + 5, cb.y + 5); await p.mouse.down(); await p.mouse.move(cb.x + 60, cb.y + 5, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(100);
  log('Toast:', await p.$$eval('.toast', e => e.map(x => x.textContent).slice(-1)[0]));
  // Zeitleiste: Monat anklicken, dann schieben
  await p.click('nav.tabs >> text=Zeitleiste'); await p.waitForTimeout(200);
  await p.screenshot({ path: 'r2_zeit.png' });
  const mz = await p.$('.tl-months .mz[data-mz="' + (await p.evaluate(() => dn('2027-06-01'))) + '"]');
  await mz.click(); await p.waitForTimeout(250);
  const st = await p.evaluate(() => ({ pxd: UI._tl.pxd, left: document.querySelector('.tl').scrollLeft, w: document.querySelector('.tl').clientWidth }));
  log('Zoom Juni:', JSON.stringify(st));
  await p.screenshot({ path: 'r2_zoom.png' });
  const tlb = await (await p.$('.tl')).boundingBox();
  const px = tlb.x + 900, py = tlb.y + tlb.height - 40;   // Zeile „Starts je Woche“, freie Fläche
  await p.mouse.move(px, py); await p.mouse.down(); await p.mouse.move(px - 300, py, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(100);
  log('nach Schieben scrollLeft:', await p.evaluate(() => document.querySelector('.tl').scrollLeft));
  await p.screenshot({ path: 'r2_zeit_full.png', fullPage: true });
  // Warnung -> Sprung zur Maßnahme
  await p.click('.warnbtn'); await p.waitForTimeout(100); await p.click('.witem .wtext'); await p.waitForTimeout(300);
  log('nach Warnungsklick:', await p.evaluate(() => UI.view + ' mass=' + UI.secOpen.mass));
  log('ERR', errs.join('\n') || 'keine');
  await b.close();
})();
