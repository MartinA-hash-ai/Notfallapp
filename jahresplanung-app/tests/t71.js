// 0.36: Schlagworte je Maßnahme (Spalte, Bearbeiten-Dialog), Filter „Schlagworte“ in Zeitleiste und Kalender,
// einklappbare Bereichsspalten (nur Buchstaben und Häkchen), eigene Farben in der Palette; 0.37: Filterleiste oben (Schlagworte, Verantwortlich), dockt beim Scrollen an
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(); const p = await open(b, { width: 1700 });
  await p.addStyleTag({ content: '.banner{display:none!important}' });
  await p.evaluate(() => {
    const ms = [['Frühjahrsmailing', '2027-03-10', '#1F77B4', ['Mailing']], ['Newsletter März', '2027-03-24', '#2CA02C', [' newsletter ', 'Newsletter']], ['Sommermailing', '2027-06-16', '#E6550D', ['mailing']],
      ['Projektbericht', '2027-08-25', '#7B3FA0', ['Print', 'Newsletter']], ['Danke-Karte', '2027-12-08', '#123456', 'kein Array']];
    commit(d => { d.urlaube = []; d.personen = [{ name: 'Team A', farbe: '#E0A100' }];
      d.massnahmen = ms.map(([n, pal, f, tags], i) => ({ id: 't' + i, name: n, farbe: f, verantwortlich: i === 4 ? '' : i % 2 ? 'Team B' : 'Team A', auflage: null, pal, palStatus: 'vorläufig', vorlauf: i === 4 ? {} : i === 1 ? { I: 21 } : { S: 63, I: 42, D: 14 }, ende: {}, art: '', hinweis: '', plan: null, tags }));
      d.farben = ['#e30714', 'falsch', '#E30714', '#00AA00']; });
    D = normalize(JSON.parse(JSON.stringify(D))); derive();
    UI.year = 2027; UI.view = 'jahr'; UI.secOpen = { mass: true, tl: true, kal: true, ag: true }; UI.tagHide = []; UI.phMini = false; UI.hiddenM.clear(); renderNow(); });
  await p.waitForTimeout(400);

  // ---- A: Daten – Schlagworte bereinigt (Leerzeichen, Doppelte, Groß/Klein einheitlich), eigene Farben geprüft
  const a0 = await p.evaluate(() => [D.massnahmen.map(m => m.tags.join('+')).join(' | '), allTags().join(','), D.farben.join(','), UI_KEYS.includes('tagHide') && UI_KEYS.includes('phMini')]);
  ok(a0[0] === 'Mailing | newsletter | Mailing | Print+newsletter | ' && a0[1] === 'Mailing,newsletter,Print' && a0[2] === '#E30714,#00AA00' && a0[3],
    'A: Schlagworte bereinigt, Groß/Klein wie zuerst geschrieben, eigene Farben als #RRGGBB ohne Doppelte: ' + a0.join(' / '));

  // ---- B: Spalte „Schlagworte“ nach „Verantwortlich“; Schlagwort über die Oberfläche vergeben, vorhandenes per Klick, entfernen mit ×
  const b0 = await p.evaluate(() => [...document.querySelectorAll('.mtable thead tr:last-child th')].map(t => t.textContent.trim()).slice(2, 5).join('|'));
  ok(b0 === 'Maßnahme|Verantwortlich|Schlagworte', 'B: Spalte „Schlagworte“ zwischen Verantwortlich und Auflage (' + b0 + ')');
  const pop = () => p.evaluate(() => !!document.querySelector('.tagpop'));
  await p.click('tr[data-m="t4"] .tagbtn'); await p.waitForTimeout(200);
  await p.fill('.tagpop .tag-in', '  Dank  '); await p.press('.tagpop .tag-in', 'Enter'); await p.waitForTimeout(250);
  const bA = await pop();
  await p.click('tr[data-m="t4"] .tagbtn'); await p.waitForTimeout(200);
  await p.click('.tagpop .tagchip.add:has-text("Print")'); await p.waitForTimeout(250);
  const bB = await pop();
  await p.click('tr[data-m="t4"] .tagbtn'); await p.waitForTimeout(200);
  await p.fill('.tagpop .tag-in', 'print'); await p.press('.tagpop .tag-in', 'Enter'); await p.waitForTimeout(250);
  const b1 = await p.evaluate(() => [D.massnahmen[4].tags.join('+'), [...document.querySelectorAll('.tagpop .tag-cur .tagchip')].map(e => e.firstChild.textContent).join('+'), [...document.querySelectorAll('tr[data-m="t4"] td.tags .tagchip')].map(e => e.textContent).join('+')]);
  ok(b1.join(' / ') === 'Dank+Print / Dank+Print / Dank+Print' && !bA && !bB, 'B: tippen + Enter und Klick auf ein vorhandenes Schlagwort fügen hinzu – das Fenster schließt danach; Doppelte (auch anders geschrieben) nicht: ' + b1.join(' / '));
  await p.click('.tagpop .tag-cur .tagchip:has-text("Dank") .tag-x'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => D.massnahmen[4].tags.join('+') === 'Print') && await pop(), 'B: × entfernt ein Schlagwort (das Fenster bleibt offen)');
  await p.keyboard.press('Escape'); await p.mouse.click(5, 5); await p.waitForTimeout(150);
  // Bearbeiten-Dialog
  await p.evaluate(() => { editMassnahme('t3'); }); await p.waitForTimeout(250);
  const b2 = await p.evaluate(() => [...document.querySelectorAll('.modal .tagedit .tag-cur .tagchip')].map(e => e.firstChild.textContent).join('+'));
  await p.fill('.modal .tagedit .tag-in', 'Bericht'); await p.press('.modal .tagedit .tag-in', 'Enter'); await p.waitForTimeout(150);
  const b3 = await p.evaluate(() => [!!document.querySelector('.modal'), D.massnahmen[3].tags.join('+')]);
  await p.click('.modal footer button:has-text("Übernehmen")'); await p.waitForTimeout(250);
  ok(b2 === 'Print+newsletter' && b3[0] && b3[1] === 'Print+newsletter' && await p.evaluate(() => D.massnahmen[3].tags.join('+') === 'Print+newsletter+Bericht'),
    'B: Bearbeiten-Dialog – Schlagworte ändern, Enter schließt den Dialog nicht, übernommen erst mit „Übernehmen“');

  // ---- C: Filter auf Höhe der Überschrift „Maßnahmen“ (mittig), dockt beim Scrollen an; Schlagworte und Verantwortlich; gilt für Tabelle, Zeitleiste, Kalender; Häkchen der Tabelle bleiben
  // Klick: nur diesen, jeder weitere Klick nimmt einen dazu; Strg+Klick: einzeln abwählen; das Fenster schließt nur per Klick daneben
  const c0 = await p.evaluate(() => { const f = document.querySelector('.fbar-in').getBoundingClientRect(), hd = document.querySelector('[data-sec="mass"] .sec-h').getBoundingClientRect(), m = document.querySelector('#main').getBoundingClientRect();
    return [[...document.querySelectorAll('.fbar .fbtn')].map(e => e.textContent).join(' | '), document.querySelectorAll('[data-sec="tl"] .tagfbtn, [data-sec="kal"] .tagfbtn').length,
      Math.round((f.top + f.bottom) / 2 - (hd.top + hd.bottom) / 2), Math.round((f.left + f.right) / 2 - (m.left + m.right) / 2)]; });
  ok(c0[0] === 'Verantwortlich: alle ▾ | Schlagworte: alle ▾' && c0[1] === 0 && Math.abs(c0[2]) <= 4 && Math.abs(c0[3]) <= 4, 'C: Filter „Verantwortlich“ (links) und „Schlagworte“ auf Höhe der Überschrift „Maßnahmen“, mittig: ' + c0.join(' / '));
  const row = t => '.tagflt .tagrow:has-text("' + t + '")', isOpen = () => p.evaluate(() => !!document.querySelector('.menu.pop .tagflt'));
  await p.click('.fbar .tagfbtn'); await p.waitForTimeout(200);
  const c1 = await p.evaluate(() => [...document.querySelectorAll('.tagflt .tagrow')].map(r => r.textContent).join(' | '));
  ok(c1 === 'Bericht1 | Mailing2 | newsletter2 | Print2 | ohne Schlagwort0', 'C: je Schlagwort eine Zeile mit Anzahl, dazu „ohne Schlagwort“: ' + c1);
  const vis = () => p.evaluate(() => [C.ms.filter(visibleM).map(x => x.id).join(','), [...document.querySelectorAll('.mtable tbody tr[data-m]')].map(e => e.dataset.m).join(','), (document.querySelector('.flt-note') || {}).textContent || '',
    [...document.querySelectorAll('.fbar .fbtn')].map(e => e.textContent).join(' | '), (document.querySelector('.fbar-n') || {}).textContent, UI.hiddenM.size]);
  await p.click(row('Mailing')); await p.waitForTimeout(250);
  const k1 = await vis(), o1 = await isOpen();
  await p.click(row('Print')); await p.waitForTimeout(250);
  const k2 = await vis();
  await p.click(row('Print')); await p.waitForTimeout(250);
  const k3 = await vis();
  ok(k1[0] === 't0,t2' && k2[0] === 't0,t2,t3,t4' && k3[0] === 't0,t2' && o1 && await isOpen(), 'C: Klick auf „Mailing“ – nur Mailing; Klick auf „Print“ nimmt es dazu, nochmal Klick nimmt es wieder weg; das Fenster bleibt offen: ' + [k1[0], k2[0], k3[0]].join(' → '));
  await p.click(row('Mailing')); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !UI.tagHide.length) && (await vis())[0] === 't0,t1,t2,t3,t4', 'C: wird der letzte abgewählt, ist wieder alles gewählt');
  await p.click(row('newsletter'), { modifiers: ['Control'] }); await p.waitForTimeout(250);
  const c2 = await vis();
  ok(c2[0] === 't0,t2,t3,t4' && c2[1] === 't0,t2,t3,t4' && c2[2] === '1 Maßnahme durch den Filter ausgeblendet – Filter aufheben' && c2[3] === 'Verantwortlich: alle ▾ | Schlagworte: 4 von 5 ▾' && c2[4] === '4 von 5' && c2[5] === 0,
    'C: Strg+Klick auf „newsletter“ – nur das abgewählt: Newsletter März fehlt in Tabelle, Zeitleiste und Kalender, Projektbericht bleibt (hat noch „Print“); Häkchen bleiben: ' + c2.join(' / '));
  const c4 = await p.evaluate(() => { const ev = eventsIn(mkdn(2027, 1, 1), mkdn(2027, 12, 31)); return [...new Set(ev.map(e => e.x.id))].join(','); });
  ok(c4 === 't0,t2,t3,t4', 'C: Kalender-Termine nur der gefilterten Maßnahmen (' + c4 + ')');
  await p.click(row('ohne Schlagwort'), { modifiers: ['Control'] }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => JSON.stringify(UI.tagHide.slice().sort()) === '["","newsletter"]'), 'C: „ohne Schlagwort“ lässt sich getrennt abwählen');
  await p.mouse.wheel(0, 800); await p.waitForTimeout(400);
  const o2 = await isOpen();
  await p.mouse.click(1650, 650); await p.waitForTimeout(200);
  ok(o2 && !(await isOpen()), 'C: beim Scrollen bleibt das Fenster offen, ein Klick daneben schließt es');
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(150);
  await p.click('.fbar .tagfbtn'); await p.waitForTimeout(200); await p.click('.tagflt .tagflt-h button:has-text("alle")'); await p.waitForTimeout(200);
  ok((await vis())[0] === 't0,t1,t2,t3,t4', 'C: „alle“ zeigt wieder alles');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  // Verantwortlich
  await p.click('.fbar .respfbtn'); await p.waitForTimeout(200);
  const r0 = await p.evaluate(() => [...document.querySelectorAll('.tagflt .tagrow')].map(r => r.textContent).join(' | '));
  ok(r0 === 'Team A2 | Team B2 | ohne Verantwortliche:n1', 'C: „Verantwortlich“ – je Verantwortliche:r eine Zeile mit Anzahl, dazu „ohne“: ' + r0);
  await p.click(row('Team B'), { modifiers: ['Control'] }); await p.waitForTimeout(250);
  const r1 = await vis();
  ok(r1[0] === 't0,t2,t4' && r1[1] === 't0,t2,t4' && r1[3] === 'Verantwortlich: 2 von 3 ▾ | Schlagworte: alle ▾' && await p.evaluate(() => UI_KEYS.includes('respHide')), 'C: Strg+Klick auf Team B – deren Maßnahmen fehlen überall: ' + r1.slice(0, 2).join(' / '));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.click('.fbar .tagfbtn'); await p.waitForTimeout(200); await p.click(row('Print'), { modifiers: ['Control'] }); await p.waitForTimeout(250);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok((await vis())[0] === 't0,t2', 'C: Schlagwort- und Verantwortlich-Filter wirken zusammen – Team B aus, „Print“ aus: Danke-Karte (nur Print) fällt auch weg');
  const bdS = () => p.evaluate(() => { const cs = s => getComputedStyle(document.querySelector(s)), pr = document.createElement('i'); pr.style.color = 'var(--focus)'; document.body.append(pr); const foc = getComputedStyle(pr).color; pr.remove();
    return [cs('.fbar-in').borderTopColor, cs('.fbar .respfbtn').borderTopColor, cs('.fbar .respfbtn').color === foc, foc]; });
  const bd = await bdS();
  await p.click('.fbar .fbar-x'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !UI.tagHide.length && !UI.respHide.length && C.ms.filter(visibleM).length === 5 && !document.querySelector('.fbar-x')), 'C: „aufheben“ setzt beide zurück');
  const bd2 = await bdS();
  ok(bd[2] && !bd2[2] && bd[0] === bd2[0] && bd[1] === bd2[1] && bd[0] !== bd[3], 'C: aktiver Filter – nur die Schrift des Feldes farbig, weder Feld noch Filterleiste blau umrandet: ' + bd.join(' / ') + ' | ohne Filter: ' + bd2.join(' / '));
  // Filter bleibt beim Scrollen oben stehen
  await p.evaluate(() => { document.querySelector('[data-sec="kal"]').scrollIntoView({ block: 'start' }); scrollBy(0, 300); }); await p.waitForTimeout(250);
  const c5 = await p.evaluate(() => [Math.round(document.querySelector('.fbar-in').getBoundingClientRect().top), Math.round(document.querySelector('header.top').getBoundingClientRect().bottom), Math.round(scrollY)]);
  ok(c5[0] - c5[1] >= 4 && c5[0] - c5[1] <= 12 && c5[2] > 500, 'C: beim Scrollen bleibt der Filter oben stehen (unter dem Kopf): ' + c5.join(' / '));
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(150);

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
