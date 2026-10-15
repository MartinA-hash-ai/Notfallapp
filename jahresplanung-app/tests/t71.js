// 0.36: Schlagworte je Maßnahme (Spalte, Bearbeiten-Dialog), Filter „Schlagworte“ in Zeitleiste und Kalender,
// einklappbare Bereichsspalten (nur Buchstaben und Häkchen), eigene Farben in der Palette
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(); const p = await open(b, { width: 1700 });
  await p.addStyleTag({ content: '.banner{display:none!important}' });
  await p.evaluate(() => {
    const ms = [['Frühjahrsmailing', '2027-03-10', '#1F77B4', ['Mailing']], ['Newsletter März', '2027-03-24', '#2CA02C', [' newsletter ', 'Newsletter']], ['Sommermailing', '2027-06-16', '#E6550D', ['mailing']],
      ['Projektbericht', '2027-08-25', '#7B3FA0', ['Print', 'Newsletter']], ['Danke-Karte', '2027-12-08', '#123456', 'kein Array']];
    commit(d => { d.urlaube = []; d.personen = [{ name: 'Team A', farbe: '#E0A100' }];
      d.massnahmen = ms.map(([n, pal, f, tags], i) => ({ id: 't' + i, name: n, farbe: f, verantwortlich: 'Team A', auflage: null, pal, palStatus: 'vorläufig', vorlauf: i === 4 ? {} : i === 1 ? { I: 21 } : { S: 63, I: 42, D: 14 }, ende: {}, art: '', hinweis: '', plan: null, tags }));
      d.farben = ['#e30714', 'falsch', '#E30714', '#00AA00']; });
    D = normalize(JSON.parse(JSON.stringify(D))); derive();
    UI.year = 2027; UI.view = 'jahr'; UI.secOpen = { mass: true, tl: true, kal: true, ag: true }; UI.tagHide = []; UI.phMini = false; UI.hiddenM.clear(); renderNow(); });
  await p.waitForTimeout(400);

  // ---- A: Daten – Schlagworte bereinigt (Leerzeichen, Doppelte, Groß/Klein einheitlich), eigene Farben geprüft
  const a0 = await p.evaluate(() => [D.massnahmen.map(m => m.tags.join('+')).join(' | '), allTags().join(','), D.farben.join(','), UI_KEYS.includes('tagHide') && UI_KEYS.includes('phMini')]);
  ok(a0[0] === 'Mailing | newsletter | Mailing | Print+newsletter | ' && a0[1] === 'Mailing,newsletter,Print' && a0[2] === '#E30714,#00AA00' && a0[3],
    'A: Schlagworte bereinigt, Groß/Klein wie zuerst geschrieben, eigene Farben als #RRGGBB ohne Doppelte: ' + a0.join(' / '));

  // ---- B: Spalte „Schlagworte“ nach „Hauptverantwortlich“; Schlagwort über die Oberfläche vergeben, vorhandenes per Klick, entfernen mit ×
  const b0 = await p.evaluate(() => [...document.querySelectorAll('.mtable thead tr:last-child th')].map(t => t.textContent.trim()).slice(2, 5).join('|'));
  ok(b0 === 'Maßnahme|Hauptverantwortlich|Schlagworte', 'B: Spalte „Schlagworte“ zwischen Hauptverantwortlich und Auflage (' + b0 + ')');
  await p.click('tr[data-m="t4"] .tagbtn'); await p.waitForTimeout(200);
  await p.fill('.tagpop .tag-in', '  Dank  '); await p.press('.tagpop .tag-in', 'Enter'); await p.waitForTimeout(250);
  await p.click('.tagpop .tagchip.add:has-text("Print")'); await p.waitForTimeout(250);
  await p.fill('.tagpop .tag-in', 'print'); await p.press('.tagpop .tag-in', 'Enter'); await p.waitForTimeout(250);
  const b1 = await p.evaluate(() => [D.massnahmen[4].tags.join('+'), [...document.querySelectorAll('.tagpop .tag-cur .tagchip')].map(e => e.firstChild.textContent).join('+'), [...document.querySelectorAll('tr[data-m="t4"] td.tags .tagchip')].map(e => e.textContent).join('+')]);
  ok(b1.join(' / ') === 'Dank+Print / Dank+Print / Dank+Print', 'B: tippen + Enter und Klick auf ein vorhandenes Schlagwort fügen hinzu, Doppelte (auch anders geschrieben) nicht: ' + b1.join(' / '));
  await p.click('.tagpop .tag-cur .tagchip:has-text("Dank") .tag-x'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => D.massnahmen[4].tags.join('+') === 'Print'), 'B: × entfernt ein Schlagwort');
  await p.keyboard.press('Escape'); await p.mouse.click(5, 5); await p.waitForTimeout(150);
  // Bearbeiten-Dialog
  await p.evaluate(() => { editMassnahme('t3'); }); await p.waitForTimeout(250);
  const b2 = await p.evaluate(() => [...document.querySelectorAll('.modal .tagedit .tag-cur .tagchip')].map(e => e.firstChild.textContent).join('+'));
  await p.fill('.modal .tagedit .tag-in', 'Bericht'); await p.press('.modal .tagedit .tag-in', 'Enter'); await p.waitForTimeout(150);
  const b3 = await p.evaluate(() => [!!document.querySelector('.modal'), D.massnahmen[3].tags.join('+')]);
  await p.click('.modal footer button:has-text("Übernehmen")'); await p.waitForTimeout(250);
  ok(b2 === 'Print+newsletter' && b3[0] && b3[1] === 'Print+newsletter' && await p.evaluate(() => D.massnahmen[3].tags.join('+') === 'Print+newsletter+Bericht'),
    'B: Bearbeiten-Dialog – Schlagworte ändern, Enter schließt den Dialog nicht, übernommen erst mit „Übernehmen“');

  // ---- C: Filter „Schlagworte“ in Zeitleiste und Kalender (gilt für beide), Häkchen der Tabelle bleiben
  const c0 = await p.evaluate(() => [...document.querySelectorAll('.tagfbtn')].map(e => e.closest('[data-sec]').dataset.sec + ':' + e.textContent).join(' | '));
  ok(c0 === 'tl:Schlagworte: alle ▾ | kal:Schlagworte: alle ▾', 'C: Knopf „Schlagworte“ in Zeitleiste und Kalender (' + c0 + ')');
  await p.click('[data-sec="tl"] .tagfbtn'); await p.waitForTimeout(200);
  const c1 = await p.evaluate(() => [...document.querySelectorAll('.tagflt .tagrow')].map(r => r.querySelector('.mchk').textContent).join(' | '));
  ok(c1 === 'Bericht1 | Dank0 | Mailing2 | newsletter2 | Print2 | ohne Schlagwort0' || c1 === 'Bericht1 | Mailing2 | newsletter2 | Print2 | ohne Schlagwort0', 'C: je Schlagwort ein Häkchen mit Anzahl, dazu „ohne Schlagwort“: ' + c1);
  await p.click('.tagflt .tagrow:has-text("newsletter") input'); await p.waitForTimeout(250);
  const vis = () => p.evaluate(() => [C.ms.filter(visibleM).map(x => x.id).join(','), [...document.querySelectorAll('[data-sec="tl"] .tl-row[data-m], [data-sec="tl"] [data-m]')].map(e => e.dataset.m).filter((v, i, a) => a.indexOf(v) === i).join(','),
    [...document.querySelectorAll('.mtable td.vis input')].map(i => i.checked ? 1 : 0).join(''), [...document.querySelectorAll('.mtable tbody tr')].map(t => t.classList.contains('hidden-m') ? 'x' : 'o').join(''), document.querySelector('[data-sec="kal"] .tagfbtn').textContent]);
  const c2 = await vis();
  ok(c2[0] === 't0,t2,t3,t4' && c2[2] === '11111' && c2[3] === 'oxooo' && c2[4] === 'Schlagworte: 4 von 5 ▾',
    'C: „newsletter“ aus – Newsletter März weg, Projektbericht bleibt (hat noch „Print“); Häkchen der Tabelle bleiben, die Zeile ist blass; Kalender zeigt dasselbe: ' + c2.join(' / '));
  await p.hover('.tagflt .tagrow:has-text("Mailing")'); await p.click('.tagflt .tagrow:has-text("Mailing") .tag-only'); await p.waitForTimeout(250);
  const c3 = await vis();
  ok(c3[0] === 't0,t2' && await p.evaluate(() => JSON.stringify(UI.tagHide.slice().sort()) === JSON.stringify(['', 'Bericht', 'Print', 'newsletter'].sort())), 'C: „nur“ bei Mailing – nur Maßnahmen mit diesem Schlagwort: ' + c3[0]);
  const c4 = await p.evaluate(() => { const ev = eventsIn(mkdn(2027, 1, 1), mkdn(2027, 12, 31)); return [...new Set(ev.map(e => e.x.id))].join(','); });
  ok(c4 === 't0,t2', 'C: Kalender-Termine nur der gefilterten Maßnahmen (' + c4 + ')');
  await p.click('.tagflt .tagflt-h button:has-text("alle")'); await p.waitForTimeout(250);
  ok((await vis())[0] === 't0,t1,t2,t3,t4', 'C: „alle“ zeigt wieder alles');
  await p.click('.tagflt .tagrow:has-text("ohne Schlagwort") input'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => JSON.stringify(UI.tagHide) === '[""]'), 'C: „ohne Schlagwort“ lässt sich getrennt ausblenden');
  await p.click('.tagflt .tagflt-h button:has-text("alle")'); await p.waitForTimeout(150);
  await p.keyboard.press('Escape'); await p.mouse.click(5, 5); await p.waitForTimeout(150);

  // ---- D: Bereichsspalten einklappen – nur Buchstaben, Häkchen bei eingetragenem Start, sonst leer (kein „–“)
  await p.click('.mtable .ph-tog'); await p.waitForTimeout(300);
  const d0 = await p.evaluate(() => [UI.phMini, [...document.querySelectorAll('.mtable thead th.h-ph')].map(t => t.textContent.trim()).join(''), [...document.querySelectorAll('.mtable tbody tr')].map(tr => [...tr.querySelectorAll('td.ph')].map(td => td.textContent || '·').join('')).join(' '),
    !document.querySelector('.mtable td.ph input'), document.querySelector('.mtable .gr-ph').textContent.trim(), [...document.querySelectorAll('.mtable thead th.h-ph')].map(t => Math.round(t.getBoundingClientRect().width)).join(','),
    (() => { const td = document.querySelector('tr[data-m="t0"] td.ph'); const f = TIPS.get(td); return typeof f === 'function' ? f() : f; })()]);
  ok(d0[0] === true && d0[1] === 'SID' && d0[2] === '✓✓✓ ·✓· ✓✓✓ ✓✓✓ ···' && d0[3] && d0[4] === 'aufklappen' && /^3[0-9],3[0-9],3[0-9]$/.test(d0[5]),
    'D: eingeklappt – Spalten S, I, D schmal, ✓ wo ein Start steht, sonst leer: ' + d0.slice(1, 6).join(' / '));
  ok(/^Start der Selektion: .*2027 · \d+ Werktage vor PAL/.test(String(d0[6]).replace(/\s+/g, ' ')) || /Selektion/.test(String(d0[6])), 'D: Zeigen auf ein Häkchen nennt das Datum (' + d0[6] + ')');
  await p.click('.mtable .ph-tog'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !UI.phMini && document.querySelectorAll('.mtable td.ph input').length > 0 && /einklappen/.test(document.querySelector('.mtable .gr-ph').textContent)), 'D: „aufklappen“ zeigt wieder die Daten');

  // ---- E: Farbwahl – eigene Farben, Farben aus anderen Maßnahmen, neue Farbe per Farbcode
  await p.click('tr[data-m="t1"] .swatch'); await p.waitForTimeout(200);
  const e0 = await p.evaluate(() => [[...document.querySelectorAll('.menu.colors .sw-own .sw')].map(s => s.getAttribute('aria-label')).join(','), [...document.querySelectorAll('.menu.colors .sw-used .sw')].map(s => s.getAttribute('aria-label')).join(',')]);
  ok(e0[0] === '#E30714,#00AA00' && e0[1] === '#123456', 'E: Farbwahl zeigt eigene Farben und Farben anderer Maßnahmen: ' + e0.join(' / '));
  await p.fill('.menu.colors .sw-hex', 'a1b2c3'); await p.click('.menu.colors .sw-ok'); await p.waitForTimeout(300);
  const e1 = await p.evaluate(() => [D.massnahmen[1].farbe, D.farben.join(',')]);
  ok(e1[0] === '#A1B2C3' && e1[1] === '#E30714,#00AA00,#A1B2C3', 'E: neue Farbe per Farbcode – Maßnahme bekommt sie, die Palette merkt sie sich: ' + e1.join(' / '));
  await p.click('tr[data-m="t0"] .swatch'); await p.waitForTimeout(200);
  await p.click('.menu.colors .sw-own .sw[aria-label="#A1B2C3"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => D.massnahmen[0].farbe === '#A1B2C3'), 'E: andere Maßnahme übernimmt die eigene Farbe genau');
  await p.click('tr[data-m="t2"] .swatch'); await p.waitForTimeout(200);
  await p.click('.menu.colors .sw-used .sw[aria-label="#123456"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => D.massnahmen[2].farbe === '#123456' && D.farben.includes('#123456')), 'E: Farbe einer anderen Maßnahme übernehmen – kommt dabei in die eigenen Farben');
  await p.click('tr[data-m="t2"] .swatch'); await p.waitForTimeout(200);
  await p.hover('.menu.colors .sw-own .swwrap:has(.sw[aria-label="#00AA00"])'); await p.click('.menu.colors .sw-own .swwrap:has(.sw[aria-label="#00AA00"]) .sw-del'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !D.farben.includes('#00AA00') && !!document.querySelector('.menu.colors') && ![...document.querySelectorAll('.menu.colors .sw-own .sw')].some(s => s.getAttribute('aria-label') === '#00AA00')), 'E: × entfernt eine eigene Farbe aus der Palette, das Fenster bleibt offen');
  await p.keyboard.press('Escape'); await p.mouse.click(5, 5);

  // ---- F: Zusammenführen – eigene Farben von beiden Seiten, gelöschte bleiben weg; Schlagworte als Feld der Maßnahme
  const f0 = await p.evaluate(() => { const base = clone(D); base.farben = ['#111111', '#222222']; const mine = clone(base), theirs = clone(base);
    mine.farben = ['#111111', '#222222', '#333333']; theirs.farben = ['#222222', '#444444'];
    mine.massnahmen[0].tags = ['A']; theirs.massnahmen[0].tags = ['B']; mine.massnahmen[1].tags = ['C'];
    const r = merge3(base, mine, theirs); return [r.data.farben.join(','), r.data.massnahmen[1].tags.join(','), r.conflicts.map(c => c.field + ':' + fieldName(c.coll, c.field) + ':' + valText(c.coll, c.field, c.mine, c.rec)).join(' | ')]; });
  ok(f0[0] === '#222222,#444444,#333333' && f0[1] === 'C' && f0[2] === 'tags:Schlagworte der Maßnahme:„A“', 'F: Zusammenführen – Farben: beide Ergänzungen, gelöschte weg; Schlagworte: Konflikt nur bei beidseitiger Änderung: ' + f0.join(' / '));
  await finish(b, [p]);
})();
