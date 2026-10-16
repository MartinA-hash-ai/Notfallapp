const { chromium } = require('./pw');
const T = require('./common');
const URL = T.URL;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(URL); await p.waitForTimeout(300);
  const log = (...a) => console.log(...a);
  const nW = () => p.evaluate(() => C.warnings.filter(w => w.lvl === 'warn').length);
  log('Warnungen vorher', await nW());
  // Alle vorziehen
  await p.click('.warnbtn'); await p.waitForTimeout(100);
  await p.click('.fixall'); await p.waitForTimeout(100);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  log('Warnungen nachher', await nW(), await p.evaluate(() => C.warnings.map(w => w.text).join(' | ')));
  log('Vorlauf S Projekt-Update 1:', await p.evaluate(() => D.massnahmen.find(m => m.id === 'm3').vorlaufS));
  await p.click('.warnpanel header button');
  // Maßnahme anlegen
  await p.click('nav.tabs >> text=Jahresplanung'); await p.waitForTimeout(100);
  await p.click('button:has-text("+ Maßnahme")'); await p.waitForTimeout(200);
  const focused = await p.evaluate(() => document.activeElement && document.activeElement.dataset.fk);
  log('Fokus nach +Maßnahme:', focused);
  await p.keyboard.type('Testmailing'); await p.keyboard.press('Tab'); await p.waitForTimeout(150);
  log('Fokus nach Tab:', await p.evaluate(() => document.activeElement && document.activeElement.dataset.fk));
  const nid = await p.evaluate(() => D.massnahmen.find(m => m.name === 'Testmailing').id);
  await p.fill(`[data-fk="m:${nid}:pal"]`, '2027-05-14'); await p.$eval(`[data-fk="m:${nid}:pal"]`, e => e.blur()); await p.waitForTimeout(150);
  log('Neue Maßnahme:', await p.evaluate(id => { const x = C.byId.get(id); return [x.m.name, x.m.farbe, fmtW(x.s), fmtW(x.i), fmtW(x.pal)]; }, nid));
  // Detailplan aus Vorlage für die neue Maßnahme
  await p.evaluate(id => { createPlan(id); }, nid); await p.waitForTimeout(100);
  await p.click('.modal .tpl-complex'); await p.waitForTimeout(200);
  log('Plan angelegt, Ansicht:', await p.evaluate(() => UI.view + ' ' + UI.planSel), 'S/I:', await p.evaluate(id => { const x = C.byId.get(id); return fmtW(x.s) + ' / ' + fmtW(x.i) + ' / vS ' + x.vS; }, nid));
  // Anker ändern: Thema definieren endet am PAL -40
  { const pal = await p.evaluate(id => C.byId.get(id).pal, nid); const v = await p.evaluate(n => ds(n - 40), pal);
    await p.fill('[data-fk="st:thema:end"]', v); await p.press('[data-fk="st:thema:end"]', 'Enter'); await p.waitForTimeout(150); }
  log('I nach Ende-Änderung (Thema endet PAL-40):', await p.evaluate(id => fmtW(C.byId.get(id).i), nid));
  // Schritt löschen, auf den andere verweisen
  await p.evaluate(id => { deleteStep(id, 'gestaltung'); }, nid); await p.waitForTimeout(150);
  log('offen nach Löschen:', await p.evaluate(id => D.massnahmen.find(m => m.id === id).plan.steps.filter(s => s.anker && s.anker.art === 'offen').map(s => s.name).join(', '), nid));
  // Bearbeiten-Dialog aus dem Kalender
  await p.click('nav.tabs >> text=Jahresplanung'); await p.waitForTimeout(150);
  await p.evaluate(() => { editMassnahme('m2'); }); await p.waitForTimeout(100);
  const ins = await p.$$('.modal input');
  await ins[0].fill('Bußgeldmailing 1: Jahresdank (geändert)');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  log('Name geändert:', await p.evaluate(() => D.massnahmen.find(m => m.id === 'm2').name));
  // Folgejahr
  await p.click('nav.tabs >> text=Jahresplanung'); await p.waitForTimeout(100);
  await p.click('button:has-text("Ins Folgejahr kopieren")'); await p.waitForTimeout(100);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  log('Jahr jetzt', await p.evaluate(() => UI.year), 'Maßnahmen 2028:', await p.evaluate(() => C.ms.filter(x => x.pal != null && ymd(x.pal)[0] === 2028).map(x => x.m.name + ' ' + fmtW(x.pal)).slice(0, 4).join(' | ')));
  await p.screenshot({ path: 'mass2028.png' });
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  log('nach Undo 2028:', await p.evaluate(() => C.ms.filter(x => x.pal != null && ymd(x.pal)[0] === 2028).length));
  await p.evaluate(() => { UI.year = 2027; renderNow(); });
  // Urlaube + Agenda
  await p.evaluate(() => commit(d => { d.urlaube.push({ id: 'u1', wer: 'Eva', von: '2027-04-01', bis: '2027-04-09' }, { id: 'u2', wer: 'Martin', von: '2027-04-05', bis: '2027-04-16', notiz: 'Osterferien' }, { id: 'u3', wer: 'P/Ö', von: '2027-04-07', bis: '2027-04-08' }); d.massnahmen.find(m => m.name === 'Sommermailing').plan.steps.find(s => s.id === 'freigabe_kati').wer = 'Martin'; }));
  await p.evaluate(() => { UI.view = 'jahr'; UI.secOpen.tl = true; renderNow(); document.querySelector('[data-sec="tl"]').scrollIntoView(); }); await p.waitForTimeout(100);
  await p.fill('.sec[data-sec="ag"] input[type=date]', '2027-03-29'); await p.$eval('.sec[data-sec="ag"] input[type=date]', e => e.blur()); await p.waitForTimeout(200);
  await p.screenshot({ path: 'agenda2.png' });
  await p.evaluate(() => openUrlaub()); await p.waitForTimeout(150);
  await p.screenshot({ path: 'urlaub3.png' });
  await p.click('nav.tabs >> text=Detailpläne'); await p.waitForTimeout(150);
  await p.click('.ptab >> text=Sommermailing'); await p.waitForTimeout(150);
  await p.screenshot({ path: 'plaene3.png' });
  log('Warnungen:', await p.evaluate(() => C.warnings.filter(w => w.step).map(w => w.text).join(' | ')));
  log('ERR', errs.join('\n') || 'keine');
  await b.close();
})();
