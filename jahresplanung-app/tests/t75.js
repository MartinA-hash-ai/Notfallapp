// 0.46 Kalender: Knopf „Monate ausblenden“ – Monate einzeln (Umschalt+Klick als Bereich) oder „bis heute“ ausblenden; die übrigen rücken nach, gleiche Breite;
// je Jahr und Rechner gemerkt, das PDF zeigt immer das ganze Jahr
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1600, clock: true }); pages.push(p);
  await p.clock.setSystemTime(new Date('2027-10-21T10:00:00'));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'jahr'; UI.secOpen.kal = true; UI.calHide = {}; renderNow(); }); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => { const ms = [...document.querySelectorAll('.cal .month')];
    return { n: ms.length, first: ms[0] && ms[0].querySelector('header').textContent, rows: new Set(ms.map(m => Math.round(m.getBoundingClientRect().top))).size,
      w: [...new Set(ms.map(m => Math.round(m.getBoundingClientRect().width)))], btn: document.querySelector('.calmbtn').textContent, act: document.querySelector('.calmbtn').classList.contains('act') }; });
  const s0 = await st();
  ok(s0.n === 12 && s0.rows === 3 && s0.btn === 'Monate ausblenden ▾' && !s0.act, 'A: Knopf „Monate ausblenden“, alle 12 Monate in 3 Reihen ' + JSON.stringify(s0));
  // ---- B: „bis heute“ – Januar bis September weg, Oktober (laufender Monat) bleibt
  await p.click('.calmbtn'); await p.waitForTimeout(150);
  const tip = await p.evaluate(() => [document.querySelectorAll('.calm-pop .calm').length, document.querySelector('.calm-bis').disabled]);
  ok(tip[0] === 12 && !tip[1], 'B: Fenster mit 12 Monaten und „bis heute“');
  await p.click('.calm-bis'); await p.waitForTimeout(250);
  const s1 = await st();
  ok(s1.n === 3 && s1.first === 'Oktober 2027' && s1.rows === 1 && s1.w.length === 1 && s0.w.length === 1 && s1.w[0] === s0.w[0] && s1.btn === 'Monate: 9 ausgeblendet ▾' && s1.act,
    'B: „bis heute“ → Oktober bis Dezember in einer Reihe, gleiche Breite wie vorher, Knopf „Monate: 9 ausgeblendet“ ' + JSON.stringify(s1));
  ok(await p.evaluate(() => !!document.querySelector('.menu.pop .calm-pop') && [...document.querySelectorAll('.calm-pop .calm.off')].map(e => e.textContent).join() === 'Jan,Feb,Mär,Apr,Mai,Jun,Jul,Aug,Sep'),
    'B: Fenster bleibt offen, die ausgeblendeten Monate sind durchgestrichen');
  // ---- C: einzeln – Klick auf Nov blendet aus, Klick auf Mär wieder ein; Umschalt+Klick einen Bereich
  await p.click('.calm-pop .calm[data-m="10"]'); await p.waitForTimeout(150);
  await p.click('.calm-pop .calm[data-m="2"]'); await p.waitForTimeout(150);
  ok(JSON.stringify(await p.evaluate(() => UI.calHide['2027'])) === '[0,1,3,4,5,6,7,8,10]' && (await st()).n === 3, 'C: Klick blendet einzelne Monate aus bzw. ein (Nov weg, März wieder da)');
  await p.click('.calm-pop .calm[data-m="0"]'); await p.waitForTimeout(150);
  await p.click('.calm-pop .calm[data-m="5"]', { modifiers: ['Shift'] }); await p.waitForTimeout(150);
  ok(JSON.stringify(await p.evaluate(() => UI.calHide['2027'])) === '[6,7,8,10]', 'C: Januar ein, Umschalt+Klick auf Juni → Januar bis Juni eingeblendet');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  // ---- D: je Jahr – 2028 zeigt alles; gemerkt nach Neuladen; „alle zeigen“
  await p.evaluate(() => { UI.year = 2028; renderNow(); }); await p.waitForTimeout(200);
  const d0 = await st();
  ok(d0.n === 12 && d0.btn === 'Monate ausblenden ▾', 'D: anderes Jahr – alle Monate, „bis heute“ dort ohne Wirkung');
  await p.click('.calmbtn'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.querySelector('.calm-bis').disabled && /noch vor uns/.test(TIPS.get(document.querySelector('.calm-bis')))), 'D: 2028 liegt noch vor uns – „bis heute“ ist aus');
  await p.keyboard.press('Escape');
  await p.evaluate(() => { UI.year = 2027; saveUI(); }); await p.reload(); await p.waitForTimeout(500);
  await p.evaluate(() => { UI.view = 'jahr'; UI.secOpen.kal = true; renderNow(); }); await p.waitForTimeout(200);
  const d1 = await st();
  ok(d1.n === 8 && d1.btn === 'Monate: 4 ausgeblendet ▾', 'D: nach Neuladen gemerkt (2027: 4 ausgeblendet) ' + JSON.stringify(d1));
  // ---- E: PDF zeigt das ganze Jahr
  const e0 = await p.evaluate(() => { const c = h('div', null, calendarBody(true)); return c.querySelectorAll('.month').length; });
  ok(e0 === 12, 'E: das PDF bekommt immer alle 12 Monate');
  await p.click('.calmbtn'); await p.waitForTimeout(150); await p.click('.calm-all'); await p.waitForTimeout(200);
  ok((await st()).n === 12 && !(await p.evaluate(() => '2027' in (UI.calHide || {}))), 'E: „alle zeigen“ blendet alles wieder ein');
  // ---- F: alle ausgeblendet → Hinweis mit „Alle zeigen“
  await p.evaluate(() => calSetHidden(2027, new Set(Array.from({ length: 12 }, (_, i) => i)))); await p.waitForTimeout(200);
  ok(await p.evaluate(() => /Alle Monate sind ausgeblendet/.test(document.querySelector('.cal-none')?.textContent || '')), 'F: alles ausgeblendet → Hinweis statt leerer Fläche');
  await finish(b, pages);
})();
