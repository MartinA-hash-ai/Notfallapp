const { chromium } = require('./pw');
const T = require('./common');
const fs = require('fs');
const HTML = T.HTML;
const ok = (c, m) => console.log((c ? 'OK   ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE', acceptDownloads: true });
  await ctx.addInitScript({ path: T.FAKEFS });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.goto('file://' + HTML); await p.waitForTimeout(400);
  await p.evaluate(() => { try { localStorage.setItem('jp-savehint', '1'); } catch (e) {} });

  // ---------- Startbildschirm
  await p.evaluate(() => { window.__splashTest = true; showSplash(); });
  await p.waitForTimeout(300);
  const sp = await p.evaluate(() => { const s = document.querySelector('.splash'); return s && [s.querySelector('svg') ? 1 : 0, s.querySelector('.splash-logo') ? 1 : 0, s.querySelector('.splash-ver').textContent]; });
  ok(sp && sp[0] && sp[1] && sp[2] === 'Version ' + T.VERSION, 'Startbildschirm: Animation, Logo, ' + (sp && sp[2]));
  const fills = await p.evaluate(() => [...new Set([...document.querySelectorAll('.splash svg [fill], .splash svg [stroke]')].flatMap(e => [e.getAttribute('fill'), e.getAttribute('stroke')]).filter(c => c && c !== 'none'))]);
  ok(fills.every(c => /rgb\((227,7,20|165,0,15)\)/.test(c)), 'Farben der Animation: ' + fills.join(' '));
  await p.mouse.click(800, 500); await p.waitForTimeout(600);
  ok(!(await p.$('.splash')), 'Klick überspringt den Startbildschirm');

  // ---------- Warnknopf
  const wb = await p.evaluate(() => { const list = C.warnings.filter(w => w.fix); commit(d => list.forEach(w => applyFix(d, w))); renderNow(); const b = document.querySelector('.warnbtn'); return [b.className, b.textContent]; });
  ok(wb[0] === 'warnbtn' && wb[1].startsWith('✓'), 'Warnknopf ohne Warnungen: ' + JSON.stringify(wb));
  // hängengebliebene Maus: pointerdown ohne pointerup, danach Änderung → nächste Mausbewegung zeichnet neu
  await p.evaluate(() => { document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, buttons: 1 })); undo(); });
  await p.waitForTimeout(150);
  const st1 = await p.evaluate(() => document.querySelector('.warnbtn').className);
  await p.mouse.move(700, 600); await p.mouse.move(710, 610); await p.waitForTimeout(150);
  const st2 = await p.evaluate(() => document.querySelector('.warnbtn').className);
  ok(st2 === 'warnbtn has', 'Anzeige holt verpasstes Neuzeichnen nach (vorher „' + st1 + '“, nach Mausbewegung „' + st2 + '“)');

  // ---------- Verbund-Darstellung
  await p.click('.sec[data-sec="kal"] label:has-text("Verbund-Darstellung") input'); await p.waitForTimeout(200);
  const vb = await p.evaluate(() => [UI.verbund, document.querySelectorAll('.cal.verbund .vbl').length, Math.max(...[...document.querySelectorAll('.vbl')].map(e => +e.style.getPropertyValue('--ln'))) + 1]);
  ok(vb[0] && vb[1] > 100, 'Verbund-Darstellung an: ' + vb[1] + ' Liniensegmente, ' + vb[2] + ' Spuren');
  await p.evaluate(() => { const s = document.querySelector('.sec[data-sec="kal"]'); document.querySelector('#main').scrollTop = s.offsetTop - 50; });
  await p.waitForTimeout(100);
  await p.screenshot({ path: 'r8_verbund.png' });
  await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; DARK = true; renderNow(); const s = document.querySelector('.sec[data-sec="kal"]'); document.querySelector('#main').scrollTop = s.offsetTop - 50; });
  await p.waitForTimeout(150);
  await p.screenshot({ path: 'r8_verbund_dark.png' });
  await p.evaluate(() => { document.querySelector('#main').scrollTop = 0; });
  await p.screenshot({ path: 'r8_dark_jahr.png' });
  const dk = await p.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('.sec')).backgroundColor]);
  ok(dk[0] !== dk[1], 'Darkmode: Hintergrund ' + dk[0] + ' / Kasten ' + dk[1]);
  await p.evaluate(() => { UI.view = 'jahr'; UI.secOpen.tl = true; renderNow(); document.querySelector('[data-sec="tl"]').scrollIntoView(); }); await p.waitForTimeout(150); await p.screenshot({ path: 'r8_dark_zeit.png' });
  await p.evaluate(() => openUrlaub()); await p.waitForTimeout(150); await p.screenshot({ path: 'r8_dark_urlaub.png' });
  await p.evaluate(() => { setTheme('light'); });
  await p.screenshot({ path: 'r8_urlaub.png' });
  const hc = await p.evaluate(() => { const c = document.querySelector('.hcard'); return [Math.round(c.getBoundingClientRect().height), /lassen sich ändern|Brückentage oder/.test(c.textContent)]; });
  ok(!hc[1], 'Feiertage-Kasten ohne Erklärtexte, Höhe ' + hc[0] + ' px');
  await p.click('nav.tabs >> text=Jahresplanung'); await p.waitForTimeout(150);

  // ---------- Outlook-Vorschau
  await p.click('header button:has-text("Export")'); await p.click('.menu button:has-text("Outlook")'); await p.waitForTimeout(150);
  await p.click('.modal button:has-text("nur Start Selektion")'); await p.waitForTimeout(100);
  const pv1 = await p.evaluate(() => [...document.querySelectorAll('.icsev')].map(e => e.textContent));
  await p.click('.modal button:has-text("alle Starts + PAL")'); await p.waitForTimeout(100);
  const pv2 = await p.evaluate(() => [document.querySelectorAll('.icsev').length, [...document.querySelectorAll('.icsgrp')][0].textContent.slice(0, 160)]);
  await p.screenshot({ path: 'r8_ics.png' });
  // eine Maßnahme abwählen → deren Termine verschwinden aus der Liste
  await p.click('.icsgrp >> nth=0 >> input'); await p.waitForTimeout(100);
  const pv3 = await p.evaluate(() => [document.querySelectorAll('.icsev').length, document.querySelector('.modal .calcline').textContent]);
  ok(pv1.length && pv1.every(t => /Start Selektion/.test(t)) && pv1.length === 10 && pv2[0] === 32 && pv3[0] === 29,
    'Terminliste im Outlook-Export: nur S ' + pv1.length + ', S+I+P ' + pv2[0] + ', ohne 1. Maßnahme ' + pv3[0] + ' (' + pv3[1] + ') · ' + pv2[1]);
  await p.click('.modal footer button:has-text("Abbrechen")');

  // ---------- PDF mit Verbund-Darstellung
  await p.evaluate(() => { window.print = () => {}; printPDF({ secs: { kal: true }, show: { S: true, I: true, P: true }, vac: true, verbund: true, ms: new Set(C.ms.map(x => x.id)) }); });
  await p.waitForTimeout(300); await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: 'r8_kal.pdf', preferCSSPageSize: true, printBackground: true });
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  console.log('ERR', errs.join(' | ') || 'keine'); await b.close();
})();
