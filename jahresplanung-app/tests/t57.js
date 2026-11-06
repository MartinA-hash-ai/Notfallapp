// 0.15.4: Zeitleiste – Bereiche und PAL ein-/ausblenden wie im Kalender (gleiche Knöpfe, gleiche Einstellung)
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1600 }); pages.push(p);
  await p.evaluate(() => { UI.year = 2027; UI.view = 'jahr'; UI.secOpen.tl = true; UI.secOpen.kal = true; UI.show = {}; renderNow(); }); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => { const tl = document.querySelector('[data-sec="tl"]'), vis = e => e && getComputedStyle(e).display !== 'none';
    return { pills: [...tl.querySelectorAll('.sec-h .tpill')].map(b => (b.classList.contains('on') ? '+' : '-') + b.textContent).join(' '),
      S: tl.querySelectorAll('.tl-track .seg[data-k="S"]').length + tl.querySelectorAll('.tl-track .handle.h-S').length,
      I: tl.querySelectorAll('.tl-track .seg[data-k="I"]').length, P: [...tl.querySelectorAll('.tl-track .dia')].filter(vis).length,
      kalS: document.querySelectorAll('[data-sec="kal"] .cal .chip.S').length }; });
  const a0 = await st();
  ok(/^\+SSelektion \+IInhalt \+DProduktion \+PPAL/.test(a0.pills) && a0.S > 0 && a0.I > 0 && a0.P > 0, 'A: Zeitleiste hat die Knöpfe ' + a0.pills + ' – alles sichtbar');
  await p.click('[data-sec="tl"] .sec-h .tpill:has-text("Selektion")'); await p.waitForTimeout(200);
  const a1 = await st();
  ok(a1.S === 0 && a1.I === a0.I && a1.P === a0.P && /-SSelektion/.test(a1.pills), 'A: „Selektion“ ausgeblendet – keine S-Balken/-Griffe mehr, Inhalt und PAL bleiben');
  ok(a1.kalS === 0, 'A: gilt auch im Kalender (eine gemeinsame Einstellung)');
  await p.click('[data-sec="tl"] .sec-h .tpill:has-text("PAL")'); await p.waitForTimeout(200);
  ok((await st()).P === 0, 'A: PAL ausgeblendet – keine PAL-Rauten in der Zeitleiste');
  await p.click('[data-sec="kal"] .sec-h .tpill:has-text("Selektion")'); await p.click('[data-sec="kal"] .sec-h .tpill:has-text("PAL")'); await p.waitForTimeout(200);
  const a3 = await st();
  ok(a3.S === a0.S && a3.P === a0.P, 'A: im Kalender wieder eingeblendet → auch in der Zeitleiste wieder da');
  await finish(b, pages);
})();
