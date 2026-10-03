const { chromium } = require('./pw');
const T = require('./common');
const HTML = T.HTML;
const ok = (c, m) => console.log((c ? 'OK   ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE' });
  const p = await ctx.newPage(); p.setDefaultTimeout(6000);
  p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.goto('file://' + HTML); await p.waitForTimeout(400);
  await p.mouse.move(5, 950);
  // ---------- Logo
  const l1 = await p.evaluate(() => document.querySelector('.brand .logo').src.slice(0, 22));
  await p.evaluate(() => setTheme('dark')); await p.waitForTimeout(100);
  const l2 = await p.evaluate(() => { const i = document.querySelector('.brand .logo'); return [i.src.slice(0, 26), i.complete && i.naturalWidth > 0, Math.round(i.getBoundingClientRect().width)]; });
  ok(l1.startsWith('data:image/png') && l2[0].startsWith('data:image/svg+xml') && l2[1], 'Logo hell PNG, dunkel weißes SVG ' + JSON.stringify(l2));
  await p.screenshot({ path: 'r10_dark_head.png', clip: { x: 0, y: 0, width: 700, height: 60 } });
  await p.evaluate(() => { window.__splashTest = true; showSplash(); }); await p.waitForTimeout(2000);
  await p.screenshot({ path: 'r10_dark_splash.png' });
  await p.mouse.click(800, 500); await p.waitForTimeout(500);
  // ---------- Monate
  await p.evaluate(() => { const s = document.querySelector('.sec[data-sec="kal"]'); document.querySelector('#main').scrollTop = s.offsetTop - 50; });
  await p.waitForTimeout(100);
  const mh = await p.evaluate(() => { const m = document.querySelector('.month'), hd = m.querySelector('header'), sec = document.querySelector('.sec[data-sec="kal"]'); return [getComputedStyle(sec).backgroundColor, getComputedStyle(m).backgroundColor, getComputedStyle(hd).backgroundColor]; });
  ok(new Set(mh).size === 3, 'Monate abgesetzt (Bereich / Monat / Monatskopf): ' + mh.join(' / '));
  await p.screenshot({ path: 'r10_dark_kal.png' });
  // ---------- Verbund: beim Überfahren nur eine Linie
  await p.evaluate(() => { UI.verbund = true; renderNow(); const s = document.querySelector('.sec[data-sec="kal"]'); document.querySelector('#main').scrollTop = s.offsetTop - 50; });
  const chip = await p.evaluate(() => { const x = C.ms.find(x => x.m.name === 'Projekt-Update 1'); const c = document.querySelector('.cal .chip.S[data-m="' + x.id + '"]'); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, x.id]; });
  await p.mouse.move(chip[0] - 30, chip[1]); await p.mouse.move(chip[0], chip[1], { steps: 3 }); await p.waitForTimeout(300);
  const vb = await p.evaluate(id => [document.querySelectorAll('.day.span').length, document.querySelectorAll('.vbl.hl-on').length, getComputedStyle(document.querySelector('.vbl.hl-on')).height], chip[2]);
  ok(vb[0] === 0 && vb[1] > 20, 'Verbund-Hover: Zusatzlinie ' + vb[0] + ', hervorgehobene eigene Linie ' + vb[1] + ' Segmente, Höhe ' + vb[2]);
  await p.screenshot({ path: 'r10_verbund_hover.png' });
  await p.mouse.move(5, 950);
  await p.evaluate(() => { UI.verbund = false; setTheme('light'); });
  // ---------- S bei Detailplan in der Zeitleiste ziehen
  await p.click('nav.tabs >> text=Zeitleiste'); await p.waitForTimeout(200);
  await p.evaluate(() => { UI.tlPxd = 8; renderNow(); });
  const before = await p.evaluate(() => { const x = C.ms.find(x => x.m.name === 'Sommermailing'); const e = document.querySelector('.tl-row[data-m="' + x.id + '"] .handle.h-S'); e.scrollIntoView({ block: 'center', inline: 'center' }); const r = e.getBoundingClientRect(); return { s: x.s, i: x.i, pal: x.pal, locked: e.classList.contains('locked'), x: r.x + r.width / 2, y: r.y + r.height / 2, pxd: UI._tl.pxd, dur: JSON.stringify(x.m.plan.steps.map(s => s.dauer)) }; });
  await p.mouse.move(before.x, before.y); await p.mouse.down(); await p.mouse.move(before.x - before.pxd * 3 - 1, before.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
  const after = await p.evaluate(() => { const x = C.ms.find(x => x.m.name === 'Sommermailing'); return { s: x.s, i: x.i, pal: x.pal, dur: JSON.stringify(x.m.plan.steps.map(s => s.dauer)), toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).pop() }; });
  ok(!before.locked && after.s === before.s - 3 && after.i === before.i && after.pal === before.pal && after.dur !== before.dur, 'Zeitleiste: S vom Sommermailing −3 Tage, I und PAL bleiben, Plan angepasst · ' + after.toast);
  // I ziehen
  const bi = await p.evaluate(() => { const x = C.ms.find(x => x.m.name === 'Sommermailing'); const e = document.querySelector('.tl-row[data-m="' + x.id + '"] .handle.h-I'); const r = e.getBoundingClientRect(); return { s: x.s, i: x.i, x: r.x + r.width / 2, y: r.y + r.height / 2, pxd: UI._tl.pxd }; });
  await p.mouse.move(bi.x, bi.y); await p.mouse.down(); await p.mouse.move(bi.x + bi.pxd * 2 + 1, bi.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
  const ai = await p.evaluate(() => { const x = C.ms.find(x => x.m.name === 'Sommermailing'); return { s: x.s, i: x.i }; });
  ok(ai.i === bi.i + 2 && ai.s === bi.s, 'Zeitleiste: I +2 Tage, S bleibt (' + (ai.i - bi.i) + '/' + (ai.s - bi.s) + ')');
  await p.evaluate(() => { undo(); undo(); UI.tlPxd = 0; });
  // ---------- Tabelle: S eines Plans eintippen
  await p.click('nav.tabs >> text=Jahresplanung'); await p.waitForTimeout(200);
  const sid = await p.evaluate(() => { const x = C.ms.find(x => x.m.name === 'Sommermailing'); return [x.id, ds(x.s - 7), x.i]; });
  const inp = p.locator(`[data-fk="m:${sid[0]}:S"]`);
  await inp.fill(sid[1]); await inp.press('Enter'); await p.waitForTimeout(250);
  const ts = await p.evaluate(id => { const x = C.byId.get(id); return [ds(x.s), x.i]; }, sid[0]);
  ok(ts[0] === sid[1] && ts[1] === sid[2], 'Tabelle: Start Selektion des Sommermailings eingetippt → ' + ts[0] + ', Inhalt unverändert');
  await p.evaluate(() => undo());
  // ---------- Kalender: S-Markierung eines Plans ziehen
  const cs = await p.evaluate(() => { const x = C.ms.find(x => x.m.name === 'Sommermailing'); const c = document.querySelector('.cal .chip.S[data-m="' + x.id + '"]'); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); const t = document.querySelector('.day[data-dn="' + (x.s - 1) + '"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, t.x + t.width / 2, t.y + t.height / 2, x.s, x.i]; });
  await p.mouse.move(cs[0], cs[1]); await p.mouse.down(); await p.mouse.move(cs[2], cs[3], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
  const ca = await p.evaluate(() => { const x = C.ms.find(x => x.m.name === 'Sommermailing'); return [x.s, x.i]; });
  ok(ca[0] === cs[4] - 1 && ca[1] === cs[5], 'Kalender: S-Markierung des Sommermailings einen Tag vorgezogen');
  await p.evaluate(() => undo());
  // ---------- Feiertage zweispaltig
  await p.click('nav.tabs >> text=Urlaub'); await p.waitForTimeout(200);
  const ht = await p.evaluate(() => { const t = document.querySelector('.hol2'); return [t.querySelectorAll('tbody tr').length, t.querySelectorAll('tbody tr:first-child td').length, Math.round(document.querySelector('.hcard').getBoundingClientRect().height)]; });
  ok(ht[0] === 6 && ht[1] === 8, 'Feiertage zweispaltig: ' + ht[0] + ' Zeilen × ' + ht[1] + ' Zellen, Kasten ' + ht[2] + ' px hoch');
  await p.screenshot({ path: 'r10_urlaub.png' });
  await p.evaluate(() => setTheme('dark')); await p.waitForTimeout(100); await p.screenshot({ path: 'r10_dark_urlaub.png' });
  console.log('ERR', errs.join(' | ') || 'keine'); await b.close();
})();
