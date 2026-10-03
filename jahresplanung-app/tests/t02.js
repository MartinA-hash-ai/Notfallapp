const { chromium } = require('./pw');
const T = require('./common');
const fs = require('fs');
const URL = T.URL;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE', acceptDownloads: true });
  await ctx.addInitScript({ path: T.FAKEFS });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(URL); await p.waitForTimeout(300);
  const log = (...a) => console.log(...a);

  // --- Urlaub über die Oberfläche anlegen
  await p.click('text=Urlaub & Feiertage');
  await p.click('button:has-text("+ Urlaub")'); await p.waitForTimeout(100);
  // 0.11: Kalendarium – Person wählen, 01.–09.04.2027 ziehen, speichern
  await p.evaluate(() => { if (!D.personen.some(x => x.name === 'Eva')) commit(d => d.personen.push({ name: 'Eva', farbe: '#1565C0' })); });
  if (!(await p.$('.vd-wer option[value="Eva"]'))) { await p.click('.modal footer button:has-text("Abbrechen")'); await p.click('button:has-text("+ Urlaub")'); await p.waitForTimeout(100); }
  await p.selectOption('.vd-wer', 'Eva');
  await p.evaluate(() => { while (!document.querySelector('.vd-day[data-dn="' + mkdn(2027, 4, 1) + '"]')) document.querySelector('.vd-nav button:last-child').click(); });
  { const pos = n => p.evaluate(n => { const r = document.querySelector('.vd-day[data-dn="' + n + '"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, n);
    const a = await pos(await p.evaluate(() => mkdn(2027, 4, 1))), z = await pos(await p.evaluate(() => mkdn(2027, 4, 9)));
    await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(z[0], z[1], { steps: 5 }); await p.mouse.up(); }
  await p.click('.modal footer button:has-text("Speichern")'); await p.waitForTimeout(150);
  let rows = await p.$$('table.utable tbody tr');
  log('Urlaubszeilen nach +:', rows.length);
  await p.evaluate(() => { commit(d => { d.urlaube.push({ id: 'u2', wer: 'Martin', von: '2027-04-05', bis: '2027-04-16', notiz: 'Osterferien' }, { id: 'u3', wer: 'P/Ö', von: '2027-04-07', bis: '2027-04-08', notiz: '' }, { id: 'u4', wer: 'Anke', von: '2027-08-02', bis: '2027-08-13', notiz: '' }); }); });
  await p.waitForTimeout(150);
  log('Urlaube:', JSON.stringify(await p.evaluate(() => D.urlaube.map(u => [u.wer, u.von, u.bis]))), 'Personen:', await p.evaluate(() => D.personen.map(x => x.name).join(',')));
  await p.screenshot({ path: 'urlaub2.png' });

  // --- Kalender: Tooltip über Tag mit Urlauben und Chip
  await p.click('nav.tabs >> text=Jahresplanung');
  await p.waitForTimeout(150);
  const apr = (await p.$$('section.month'))[3];
  const cells = await apr.$$('.day:not(.out)');
  await cells[6].hover(); await p.waitForTimeout(120);  // 7. April
  log('Tooltip Tag:', (await p.textContent('#tip')).replace(/\s+/g, ' '));
  await apr.screenshot({ path: 'april.png' });
  const chipEl = await apr.$('.chip.I');
  await chipEl.hover(); await p.waitForTimeout(120);
  log('Tooltip Chip:', (await p.textContent('#tip')).replace(/\s+/g, ' '));
  log('hervorgehoben:', await p.$$eval('main .chip.hl-on', e => e.length), 'gedimmt aktiv:', await p.$eval('main', m => m.classList.contains('hl')));
  await p.screenshot({ path: 'kal_hover.png' });

  // --- Zeitleiste: PAL von Projekt-Update 1 ziehen (+7 Tage), dann S-Griff
  await p.click('nav.tabs >> text=Zeitleiste'); await p.waitForTimeout(200);
  const pxd = await p.evaluate(() => UI._tl.pxd);
  const row = await p.$('.tl-row[data-m="m3"]');
  const dia = await row.$('.dia'); const bb = await dia.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down();
  await p.mouse.move(bb.x + bb.width / 2 + 7 * pxd, bb.y + bb.height / 2, { steps: 6 });
  log('Drag-Label:', (await p.textContent('.drag-lab')).replace(/\s+/g, ' '));
  await p.mouse.up(); await p.waitForTimeout(150);
  log('PAL nach Ziehen:', await p.evaluate(() => D.massnahmen.find(m => m.id === 'm3').pal), 'dirty:', await p.evaluate(() => isDirty()));
  const hs = await (await p.$('.tl-row[data-m="m3"] .handle.h-S')).boundingBox();
  await p.mouse.move(hs.x + 5, hs.y + 10); await p.mouse.down(); await p.mouse.move(hs.x + 5 - 10 * pxd, hs.y + 10, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
  log('Vorlauf S nach Griff:', await p.evaluate(() => D.massnahmen.find(m => m.id === 'm3').vorlauf.S));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  log('nach Strg+Z Vorlauf S:', await p.evaluate(() => D.massnahmen.find(m => m.id === 'm3').vorlauf.S));
  await p.screenshot({ path: 'tl2.png' });

  // --- Detailplan: Dauer „Selektion erstellen“ 52 -> 60
  await p.click('nav.tabs >> text=Detailpläne'); await p.waitForTimeout(150);
  const durInp = await p.$('[data-fk="st:sel_erstellen:dur"]');
  await durInp.fill('60'); await durInp.press('Enter'); await durInp.evaluate(e => e.blur()); await p.waitForTimeout(150);
  log('Sommer S / Vorlauf:', await p.evaluate(() => { const x = C.ms.find(x => x.m.name === 'Sommermailing'); return fmtW(x.s) + ' / ' + (x.pal - x.s); }));
  await p.screenshot({ path: 'plaene2.png' });

  // --- Warnungen
  await p.click('.warnbtn'); await p.waitForTimeout(100);
  log('Warnungen:', await p.$$eval('.witem', e => e.map(x => x.textContent).join(' | ')));
  await p.screenshot({ path: 'warn.png' });
  await p.click('.warnpanel header button');

  // --- Speichern in simulierten Ordner und wieder öffnen
  await p.evaluate(t => { __fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'] = { data: new TextEncoder().encode(t), lm: 1000 }; }, fs.readFileSync(T.HTML, 'utf8'));
  await p.click('#savebox'); await p.waitForTimeout(200); await p.click('.modal footer button.primary'); await p.waitForTimeout(800);
  const written = await p.evaluate(() => new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data));
  fs.writeFileSync('saved.html', written);
  log('gespeichert:', written.length, 'Bytes; dirty:', await p.evaluate(() => isDirty()), 'Button:', await p.textContent('#savebox'));
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push('p2: ' + e.message));
  await p2.goto('file://' + process.cwd() + '/saved.html'); await p2.waitForTimeout(300);
  log('neu geladen: Urlaube', await p2.evaluate(() => D.urlaube.length), 'PAL m3', await p2.evaluate(() => D.massnahmen.find(m => m.id === 'm3').pal),
      'Dauer sel_erstellen', await p2.evaluate(() => D.massnahmen.find(m => m.name === 'Sommermailing').plan.steps.find(s => s.id === 'sel_erstellen').dauer), 'savedAt', await p2.evaluate(() => D.meta.savedAt));

  // --- Exporte
  let [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportExcel())]);
  await dl.saveAs('export.xlsx'); log('Excel:', dl.suggestedFilename());
  await p.evaluate(() => { setTimeout(() => { const btn = [...document.querySelectorAll('.modal footer button')].find(b => b.textContent.includes('erstellen')); btn.click(); }, 100); });
  [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportICS())]);
  await dl.saveAs('export.ics'); log('ICS:', dl.suggestedFilename());

  // --- Druck als PDF
  await p.click('nav.tabs >> text=Jahresplanung'); await p.waitForTimeout(100);
  await p.evaluate(() => { UI.printing = true; renderNow(); });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: 'kalender.pdf', format: 'A4', landscape: true, printBackground: true });
  await p.evaluate(() => { UI.view = 'zeit'; renderNow(); });
  await p.pdf({ path: 'zeitleiste.pdf', format: 'A4', landscape: true, printBackground: true });
  await p.evaluate(() => { UI.view = 'jahr'; renderNow(); });
  await p.pdf({ path: 'massnahmen.pdf', format: 'A4', landscape: true, printBackground: true });
  await p.evaluate(() => { UI.view = 'plaene'; renderNow(); });
  await p.pdf({ path: 'plaene.pdf', format: 'A4', landscape: true, printBackground: true });
  log('ERR', errs.join('\n') || 'keine');
  await b.close();
})();
