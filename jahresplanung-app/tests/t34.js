// 0.8.11 Kopfzeile: bei schmalem Fenster kommen die Reiter in eine eigene zweite Zeile (oben Logo, Titel, Jahr, Knöpfe)
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const pos = p => p.evaluate(() => { const t = document.querySelector('header.top'), y = s => Math.round(document.querySelector('header.top ' + s).getBoundingClientRect().top);
    return { two: t.classList.contains('two-rows'), brand: y('.brand'), year: y('.year'), tabs: y('nav.tabs'), acts: y('.actions'), h: Math.round(t.getBoundingClientRect().height), toph: getComputedStyle(document.documentElement).getPropertyValue('--toph') }; });
  const wide = await open(b, { width: 1600 }); pages.push(wide);
  const w = await pos(wide);
  ok(!w.two && Math.abs(w.tabs - w.brand) < 12, 'A: breites Fenster – alles in einer Zeile (' + w.h + ' px)');
  for (const width of [1300, 1000]) {
    const p = await open(b, { width }); pages.push(p);
    const r = await pos(p);
    ok(r.two && r.tabs > r.brand + 25 && Math.abs(r.acts - r.brand) < 12 && Math.abs(r.year - r.brand) < 12 && r.toph === r.h + 'px', 'B: ' + width + ' px – Logo, Titel, Jahr und Knöpfe oben, Reiter darunter (' + r.h + ' px)');
    await p.click('nav.tabs >> text=Zeitleiste'); await p.waitForTimeout(150);
    ok((await pos(p)).two && await p.evaluate(() => UI.view === 'zeit'), 'B: ' + width + ' px – nach Reiterwechsel weiter zweizeilig');
  }
  // Fenster wird breiter → wieder einzeilig
  const p = pages[pages.length - 1];
  await p.setViewportSize({ width: 1600, height: 1000 }); await p.waitForTimeout(200);
  ok(!(await pos(p)).two, 'C: Fenster breiter gezogen → wieder eine Zeile');
  await finish(b, pages);
})();
