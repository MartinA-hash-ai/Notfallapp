// 0.8.8 Kalender-Hinweis je Termin eine Zeile; Häkchen-Logik „alle an → Klick zeigt nur diese“
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);

  // ---- A: Hinweis am Kästchen
  const id = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  await p.evaluate(id => document.querySelector('.cal .chip.S[data-m="' + id + '"]').scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(250);
  const c = await p.evaluate(id => { const q = document.querySelector('.cal .chip.S[data-m="' + id + '"]').getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, id);
  await p.mouse.move(c[0], c[1]); await p.waitForTimeout(300);
  const t = await p.evaluate(() => [...document.querySelectorAll('#tip .tt-row')].map(r => [r.textContent, Math.round(r.getBoundingClientRect().height), r.classList.contains('cur')]));
  ok(t.length === 4 && t.every(r => r[1] <= 22) && /^SStart Selektion: \w\w \d\d\.\d\d\.\d{4} · \d+ WT$/.test(t[0][0]) && t[0][2] && /^PPAL: \w\w \d\d\.\d\d\.\d{4}$/.test(t[3][0]),
    'A: je Termin eine Zeile – ' + t.map(r => r[0]).join(' | '));
  ok(t.every(r => !/bis |vor PAL/.test(r[0])), 'A: ohne „bis …“ und „vor PAL“');
  await p.mouse.move(5, 900);

  // ---- B: Häkchen in der Maßnahmen-Tabelle
  const vis = () => p.evaluate(() => [...document.querySelectorAll('.mtable tbody tr')].map(r => r.querySelector('td.vis input').checked ? 1 : 0).join(''));
  const box = i => `.mtable tbody tr:nth-child(${i}) td.vis input`;
  const all = await vis();
  ok(/^1+$/.test(all), 'B: Ausgang – alle angehakt (' + all + ')');
  await p.click(box(3)); await p.waitForTimeout(150);
  const v1 = await vis();
  ok(v1 === all.split('').map((_, i) => i === 2 ? '1' : '0').join(''), 'B: alle an, Klick auf die 3. → nur die 3. angehakt (' + v1 + ')');
  await p.click(box(5)); await p.waitForTimeout(150);
  const v2 = await vis();
  ok(v2 === all.split('').map((_, i) => i === 2 || i === 4 ? '1' : '0').join(''), 'B: gemischt – Klick auf die 5. schaltet nur diese dazu (' + v2 + ')');
  await p.click(box(3)); await p.click(box(5)); await p.waitForTimeout(150);
  const v3 = await vis();
  ok(/^1+$/.test(v3), 'B: letzte abgewählt → wieder alle angehakt (' + v3 + ')');
  await p.click('.mtable thead th.h-vis input'); await p.waitForTimeout(150);
  ok(/^0+$/.test(await vis()), 'B: Kopf-Häkchen → keine');
  await p.click(box(2)); await p.waitForTimeout(150);
  const v4 = await vis();
  ok(v4 === all.split('').map((_, i) => i === 1 ? '1' : '0').join(''), 'B: alle aus, Klick auf die 2. → nur die 2. angehakt (' + v4 + ')');
  const cal = await p.evaluate(() => { const on = C.ms.filter(visibleM).map(x => x.id); return [on.length, [...document.querySelectorAll('.cal .chip[data-m]')].every(ch => on.includes(ch.dataset.m))]; });
  ok(cal[0] === 1 && cal[1], 'B: Kalender zeigt nur noch diese Maßnahme');
  await p.click('.mtable thead th.h-vis input'); await p.waitForTimeout(150);
  ok(/^1+$/.test(await vis()), 'B: Kopf-Häkchen → wieder alle');
  await p.click(box(4), { modifiers: ['Control'] }); await p.waitForTimeout(150);
  const v5 = await vis();
  ok(v5 === all.split('').map((_, i) => i === 3 ? '0' : '1').join(''), 'B: Strg+Klick schaltet nur diese eine aus (' + v5 + ')');
  await p.click('.mtable thead th.h-vis input'); await p.click('.mtable thead th.h-vis input'); await p.waitForTimeout(150);

  // ---- D: Klick im Kalender → in der Tabelle nur diese angehakt; wieder lösen → vorherige Auswahl
  await p.evaluate(() => { UI.hiddenM.clear(); renderNow(); });
  await p.click(box(2)); await p.click(box(4)); await p.waitForTimeout(150);          // Auswahl: 2. und 4.
  const before = await vis();
  const pid = await p.evaluate(() => document.querySelector('.mtable tbody tr:nth-child(4)').dataset.m);
  const cc = await p.evaluate(pid => { const e = document.querySelector('.cal .chip[data-m="' + pid + '"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, pid);
  await p.mouse.click(cc[0], cc[1]); await p.waitForTimeout(200);
  const pinned = await vis();
  ok(before === all.split('').map((_, i) => i === 1 || i === 3 ? '1' : '0').join('') && pinned === all.split('').map((_, i) => i === 3 ? '1' : '0').join(''), 'D: Auswahl ' + before + ' → Klick im Kalender auf die 4. → Tabelle ' + pinned);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(await vis() === before, 'D: im Kalender wieder gelöst → Tabelle zeigt die vorherige Auswahl (' + await vis() + ')');
  await p.mouse.click(cc[0], cc[1]); await p.waitForTimeout(200);
  await p.click(box(6)); await p.waitForTimeout(150);
  ok(await vis() === all.split('').map((_, i) => i === 3 || i === 5 ? '1' : '0').join('') && await p.evaluate(() => !UI.pin), 'D: angeklickt, dann Häkchen bei der 6. → 4. und 6. ausgewählt (' + await vis() + ')');

  // ---- C: Zeitleiste folgt der Auswahl in der Tabelle (kein eigener Maßnahmen-Filter mehr)
  await p.evaluate(() => { UI.hiddenM.clear(); UI.pin = null; UI.view = 'jahr'; UI.secOpen.tl = true; renderNow(); }); await p.waitForTimeout(200);
  await p.click(box(2)); await p.waitForTimeout(150);
  const pop = await p.evaluate(() => [document.querySelectorAll('.tl-row[data-m]').length, [...document.querySelectorAll('[data-sec="tl"] .fbtn')].map(b => b.textContent).join('|')]);
  ok(pop[0] === 1 && /^Urlaub: /.test(pop[1]) && !pop[1].includes('Maßnahmen'), 'C: Häkchen in der Tabelle → Zeitleiste zeigt nur diese (' + pop[0] + ' Zeile), dort nur noch „' + pop[1] + '“');
  await finish(b, pages);
})();
