// 0.52: „PDF der aktuellen Ansicht“ – ein Klick (Export ▾ oder Strg+P) druckt, was gerade zu sehen ist: auf- und zugeklappte Bereiche, angehakte/gefilterte
// Maßnahmen, eingeklappte Spalten S, I, D, ausgeblendete Monate. Zeitleiste im PDF: bis 24 Zeilen je Seite, gleichmäßig verteilt (keine Seite mit nur einer Maßnahme)
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  await p.evaluate(() => { window.print = () => { window._printed = (window._printed || 0) + 1; }; });
  const doc = () => p.evaluate(() => { const d = document.querySelector('#printdoc'); if (!d) return null;
    const r = { titles: [...d.querySelectorAll('.pd-head h1')].map(e => e.textContent), phm: d.querySelectorAll('.pd-table th.phm').length, rows: [...d.querySelectorAll('.pd-table tbody tr td.nm')].map(e => e.textContent),
      months: d.querySelectorAll('.pd-kal .month').length, status: [...d.querySelectorAll('.pd-table tbody td .status')].map(e => e.className + ':' + e.textContent),
      dotX: [...new Set([...d.querySelectorAll('.pd-page .tl-row[data-m] > .tl-lab .dot')].map(e => Math.round(e.getBoundingClientRect().left)))], tlBtn: d.querySelectorAll('.pd-page .tl-lab button').length, tlRows: [...d.querySelectorAll('.pd-page')].filter(pg => /Zeitleiste/.test(pg.querySelector('h1').textContent)).map(pg => pg.querySelectorAll('.tl-row:not(.sep)').length) };
    d.remove(); document.body.classList.remove('printdoc-mode'); return r; });
  // ---- A: Jahresplanung – Tabelle offen, Kalender zu, Zeitleiste offen; S/I/D eingeklappt; eine Maßnahme abgehakt
  const hid = await p.evaluate(() => { UI.year = 2027; UI.view = 'jahr'; UI.secOpen = { mass: true, kal: false, tl: true, ag: false }; UI.phMini = true;
    const x = C.ms.filter(x => inYear(x, 2027))[1]; UI.hiddenM = new Set([x.id]); renderNow(); return x.m.name; });
  await p.waitForTimeout(150);
  await p.click('header .actions .menu-btn:has-text("Export")'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => [...document.querySelectorAll('.menu button')].map(e => e.textContent).slice(0, 2).join('|') === 'PDF der aktuellen Ansicht|PDF zusammenstellen …'), 'A: Export ▾ – „PDF der aktuellen Ansicht“ und „PDF zusammenstellen …“');
  await p.click('.menu button:has-text("PDF der aktuellen Ansicht")'); await p.waitForTimeout(250);
  const a0 = await doc();
  ok(a0 && a0.titles.join('|') === 'Maßnahmen 2027|Zeitleiste 2027' && !await p.$('.modal'), 'A: ohne Dialog – Tabelle und Zeitleiste (offen), kein Kalender (zu) ' + JSON.stringify(a0 && a0.titles));
  ok(a0.phm === 3 && !a0.rows.includes(hid) && a0.rows.length === 9, 'A: Spalten S, I, D eingeklappt wie in der Tabelle; abgehakte Maßnahme „' + hid + '“ fehlt (' + a0.rows.length + ' Zeilen)');
  ok(await p.evaluate(() => UI.phMini === true && UI.hiddenM.size === 1 && window._printed === 1), 'A: Ansicht danach unverändert, Druckfenster geöffnet');
  ok(a0.status.length === 9 && a0.status.every(t => /^status (fest:fest|vorl:vorläufig)$/.test(t)), 'A: PAL-Status als farbiges Kästchen (fest grün, vorläufig orange) wie in der Tabelle');
  ok(a0.dotX.length === 1 && a0.tlBtn === 0, 'A: Zeitleiste – alle Maßnahmen bündig, auch die mit Detailplan (kein Aufklapp-Knopf im PDF) ' + JSON.stringify([a0.dotX, a0.tlBtn]));
  // ---- B: Kalender mit ausgeblendeten Monaten; Strg+P
  await p.evaluate(() => { UI.secOpen = { mass: false, kal: true, tl: false, ag: false }; UI.calHide = { 2027: [0, 1, 2] }; UI.phMini = false; renderNow(); }); await p.waitForTimeout(150);
  await p.keyboard.press('Control+p'); await p.waitForTimeout(250);
  const b0 = await doc();
  ok(b0 && b0.titles.join() === 'Kalender 2027' && b0.months === 9, 'B: Strg+P – nur der Kalender, ohne die 3 ausgeblendeten Monate ' + JSON.stringify(b0 && [b0.titles, b0.months]));
  await p.keyboard.press('Control+Shift+P'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => /PDF exportieren/.test(document.querySelector('.modal h2')?.textContent || '')), 'B: Strg+Umschalt+P öffnet „PDF zusammenstellen“');
  await p.click('.modal footer button:has-text("PDF erstellen")'); await p.waitForTimeout(250);
  const b1 = await doc();
  ok(b1 && b1.months === 12, 'B: im Dialog bleibt der Kalender das ganze Jahr');
  // ---- C: Detailpläne – der gewählte Plan; Einstellungen → Dialog
  const plan = await p.evaluate(() => { const x = C.ms.find(x => x.pc && inYear(x, 2027)); UI.view = 'plaene'; UI.planSel = x && x.id; renderNow(); return x && x.m.name; }); await p.waitForTimeout(150);
  await p.keyboard.press('Control+p'); await p.waitForTimeout(300);
  const c0 = await doc();
  ok(plan && c0 && c0.titles.join() === 'Detailplan ' + plan, 'C: Detailpläne – nur der gewählte Plan „' + plan + '“');
  await p.evaluate(() => { UI.view = 'einstellungen'; renderNow(); }); await p.waitForTimeout(150);
  await p.keyboard.press('Control+p'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => /PDF exportieren/.test(document.querySelector('.modal h2')?.textContent || '')), 'C: in den Einstellungen (kein eigenes PDF) öffnet sich der Dialog');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  // ---- D: Zeitleiste – Seitenaufteilung
  const d0 = await p.evaluate(() => [[17, 0], [24, 0], [25, 0], [22, 3], [49, 0], [48, 4]].map(([n, v]) => tlPdfChunks(n, v).join('+')));
  ok(d0.join(' | ') === '17 | 24 | 13+12 | 11+11 | 17+17+15 | 16+16+16', 'D: Zeilen je Seite höchstens 24, gleichmäßig, Urlaubszeilen passen auf die letzte: ' + d0.join(' | '));
  const d1 = await p.evaluate(() => { const t = JSON.parse(JSON.stringify(D.massnahmen[0])); commit(d => { for (let i = 0; i < 9; i++) d.massnahmen.push(Object.assign(JSON.parse(JSON.stringify(t)), { id: 'zz' + i, name: 'Test ' + i, plan: null })); });
    UI.view = 'jahr'; UI.secOpen = { mass: false, kal: false, tl: true, ag: false }; UI.hiddenM = new Set(); UI.showVac = false; renderNow(); return C.ms.filter(x => visibleM(x) && inYear(x, 2027)).length; });
  await p.waitForTimeout(150);
  await p.keyboard.press('Control+p'); await p.waitForTimeout(300);
  const d2 = await doc();
  ok(d1 === 19 && d2 && d2.tlRows.join() === '19', 'D: 19 Maßnahmen – Zeitleiste auf einer Seite (vorher 16 + 3) ' + JSON.stringify([d1, d2 && d2.tlRows]));
  await finish(b, pages);
})();
