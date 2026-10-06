// 0.8.2 Werktage per Mausrad (ohne Pfeile), Detailplan-Kopf und -Tabelle, „+ Aufgabe“ als neue Zeile, einstellbare Markierungen
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const rgb = s => (s.match(/\d+/g) || []).slice(0, 3).map(Number);

  // ---- A: Werktage – keine Pfeile, Mausrad nur im angeklickten Feld
  const id = await p.evaluate(() => C.ms.find(x => x.m.name === 'Projekt-Update 1').id);
  await p.evaluate(() => { UI.startView = 'wt'; renderNow(); });
  const sel = `[data-fk="m:${id}:S:wt"]`;
  const a0 = await p.evaluate(sel => { const i = document.querySelector(sel); i.scrollIntoView({ block: 'center' }); return [+i.value, getComputedStyle(i).appearance, i.classList.contains('nospin')]; }, sel);
  ok(a0[2] && a0[1] === 'textfield', 'A: Werktage-Feld ohne Pfeile (' + a0[1] + ')');
  const box = await p.locator(sel).boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.wheel(0, -100); await p.waitForTimeout(700);
  ok(await p.evaluate(sel => +document.querySelector(sel).value, sel) === a0[0], 'A: Mausrad ohne Klick ins Feld ändert nichts (Seite scrollt)');
  const box2 = await p.locator(sel).boundingBox();
  await p.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await p.mouse.wheel(0, -100); await p.waitForTimeout(60); await p.mouse.wheel(0, -100); await p.waitForTimeout(60); await p.mouse.wheel(0, -100); await p.waitForTimeout(60); await p.mouse.wheel(0, 100);
  await p.waitForTimeout(800);
  const a1 = await p.evaluate(([id, sel]) => { const x = C.byId.get(id); return [workdaysBefore(x.st.S, x.pal), +document.querySelector(sel).value, document.activeElement === document.querySelector(sel)]; }, [id, sel]);
  ok(a1[0] === a0[0] + 2 && a1[1] === a0[0] + 2 && a1[2], 'A: im angeklickten Feld 3× hoch, 1× runter → ' + a1[0] + ' WT übernommen (vorher ' + a0[0] + '), Feld bleibt aktiv');
  const sw = await p.evaluate(() => { const g = getComputedStyle(document.querySelector('.mtable .grouprow th.gr-ph')), th = getComputedStyle(document.querySelector('.mtable th.h-ph_S')); return [g.backgroundColor, th.backgroundColor, getComputedStyle(document.querySelector('.vswitch')).fontSize]; });
  ok(rgb(sw[0]).reduce((a, c) => a + c) > rgb(sw[1]).reduce((a, c) => a + c) && parseFloat(sw[2]) < 11.5, 'A: Schalter-Kästchen heller als die Kopfzeile, Schrift kleiner ' + JSON.stringify(sw));
  await p.evaluate(() => { UI.startView = 'date'; renderNow(); });

  // ---- B: Detailplan-Kopf: Name + PAL oben, Legende oben rechts, Starts darunter, kein −/+/Zurücksetzen
  await p.evaluate(() => { UI.view = 'plaene'; UI.planSel = C.ms.find(x => x.m.name === 'Sommermailing').id; renderNow(); }); await p.waitForTimeout(200);
  const hd = await p.evaluate(() => {
    const ph = document.querySelector('.phead'), r = ph.getBoundingClientRect(), top = ph.querySelector('.ph-top'), bot = ph.querySelector('.ph-bot'), lg = ph.querySelector('.plegend').getBoundingClientRect();
    return [!!top.querySelector('h2') && !!top.querySelector('[data-fk="pl:pal"]'), !!top.querySelector('.plegend'), Math.round(r.right - lg.right), Math.round(lg.top - r.top), ['S', 'I', 'D'].every(k => bot.querySelector('[data-fk="pl:' + k + '"]')),
      !!ph.querySelector('.segs') || /Zurücksetzen/.test(ph.textContent), top.getBoundingClientRect().bottom <= bot.getBoundingClientRect().top + 1, !!bot.querySelector('button:not([disabled])')];
  });
  ok(hd[0] && hd[1] && hd[2] < 30 && hd[3] < 30 && hd[4] && !hd[5] && hd[6], 'B: Kopf – oben Name + PAL, Legende oben rechts (' + hd[2] + '/' + hd[3] + ' px vom Rand), Starts in der Zeile darunter, kein Zoom-Knopf');
  const tb = await p.evaluate(() => {
    const add = document.querySelector('.pl-table .addlink'), cs = getComputedStyle(add), nm = document.querySelector('.pl-row:not(.grp):not(.head):not(.addrow) .c-name input').getBoundingClientRect();
    const g = document.querySelector('.pl-row.grp'), gn = g.querySelector('.gname').getBoundingClientRect().width, gr = g.querySelector('.c-grest');
    const head = getComputedStyle(document.querySelector('.pl-row.head')).backgroundColor, grp = getComputedStyle(g).backgroundColor;
    const grip = getComputedStyle(document.querySelector('.rgrip')).color, typ = getComputedStyle(document.querySelector('.c-typ select')), kom = getComputedStyle(document.querySelector('.c-kom input'));
    return { txt: add.textContent, box: cs.borderTopStyle === 'none' && (cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent'), bold: +cs.fontWeight >= 700, dx: Math.round(add.getBoundingClientRect().left - nm.left),
      gn: Math.round(gn), grest: gr.textContent, gal: getComputedStyle(gr).textAlign, head, grp, grip, typA: typ.appearance, typC: typ.color, kom: [kom.fontStyle, kom.color] };
  });
  ok(tb.txt === '+ Aufgabe' && tb.box && tb.bold && Math.abs(tb.dx - 4) <= 6, 'B: „+ Aufgabe“ fett, ohne Kasten, linksbündig mit den Namen (Versatz ' + tb.dx + ' px)');
  ok(tb.gn >= 280 && /^\d+ Schritte? · \d\d\.\d\d\. – \d\d\.\d\d\.$/.test(tb.grest) && tb.gal === 'right', 'B: Abschnitt – Name ' + tb.gn + ' px breit, rechts „' + tb.grest + '“ rechtsbündig');
  ok(rgb(tb.head).reduce((a, c) => a + c) < rgb(tb.grp).reduce((a, c) => a + c), 'B: Tabellenkopf dunkler als die Abschnittszeile ' + tb.head + ' / ' + tb.grp);
  ok(rgb(tb.grip).reduce((a, c) => a + c) > 600 && tb.typA === 'none', 'B: Griff heller (' + tb.grip + '), Typ mit hellem eigenem Pfeil');
  ok(tb.kom[0] === 'italic' && rgb(tb.kom[1]).reduce((a, c) => a + c) > 400, 'B: Kommentar kursiv und hellgrau ' + tb.kom.join(' '));

  // ---- C: „+ Aufgabe“ und „Neue Aufgabe darunter“ legen die Zeile direkt an
  const c0 = await p.evaluate(() => { const x = C.byId.get(UI.planSel), st = x.m.plan.steps, g = st.find(s => s.typ === 'gruppe'), bl = groupBlocks(st).get(g.id); return [st.length, st[bl[1] - 1].id, st[bl[0] + 2].id]; });
  await p.click('.pl-table .addlink:has-text("+ Aufgabe") >> nth=0'); await p.waitForTimeout(200);
  const c1 = await p.evaluate(prev => { const x = C.byId.get(UI.planSel), st = x.m.plan.steps, i = st.findIndex(s => s.id === prev), n = st[i + 1], r = x.pc.map.get(n.id);
    return [st.length, n.name, n.typ, wtSpan(r.start, r.end) === 5 && +n.dauer === 5 ? 7 : -1, document.activeElement.dataset.fk === 'st:' + n.id + ':name', !document.querySelector('.modal')]; }, c0[1]);   // eine Woche = 5 Werktage
  ok(c1[0] === c0[0] + 1 && c1[1] === 'Neue Aufgabe' && c1[2] === 'aufgabe' && c1[3] === 7 && c1[4] && c1[5], 'C: „+ Aufgabe“ → neue Zeile am Ende des Abschnitts, eine Woche (5 WT), Name zum Überschreiben markiert, kein Fenster');
  await p.keyboard.type('Probe'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.some(s => s.name === 'Probe')), 'C: Name direkt eingetippt');
  await p.click(`.pl-row[data-rid="${c0[2]}"] .c-acts .menu-btn`); await p.waitForTimeout(150);
  await p.click('.menu button:has-text("Neue Aufgabe darunter")'); await p.waitForTimeout(200);
  ok(await p.evaluate(prev => { const st = C.byId.get(UI.planSel).m.plan.steps; return st[st.findIndex(s => s.id === prev) + 1].name === 'Neue Aufgabe'; }, c0[2]), 'C: „Neue Aufgabe darunter“ im ⋯-Menü fügt direkt unter dem Schritt ein');

  // ---- D: Markierungen einstellen
  await p.evaluate(() => { UI.view = 'jahr'; renderNow(); settingsDialog(); }); await p.waitForTimeout(250);
  await p.selectOption('.modal .btable tr[data-key="S"] .scol select', 'kraeftig'); await p.waitForTimeout(100);
  await p.fill('.modal .btable tr[data-key="S"] .zcol input', 'x'); await p.press('.modal .btable tr[data-key="S"] .zcol input', 'Tab'); await p.waitForTimeout(100);
  await p.fill('.modal .btable tr[data-key="I"] .zcol input', 'X'); await p.press('.modal .btable tr[data-key="I"] .zcol input', 'Tab'); await p.waitForTimeout(100);
  await p.fill('.modal .btable tr[data-key="P"] .zcol input', 'B'); await p.press('.modal .btable tr[data-key="P"] .zcol input', 'Tab'); await p.waitForTimeout(100);
  await p.selectOption('.modal .btable tr[data-key="P"] .scol select', 'rahmen'); await p.waitForTimeout(100);
  await p.selectOption('.modal .btable tr[data-key="I"] .scol select', 'streifen'); await p.waitForTimeout(100);
  // neuer Bereich mit dem Buchstaben P (das PAL heißt jetzt B)
  await p.fill('.modal input[placeholder="Buchstabe"]', 'p'); await p.fill('.modal input[placeholder^="Name"]', 'Prüfung');
  await p.click('.modal button:has-text("+ Bereich hinzufügen")'); await p.waitForTimeout(150);
  const st = await p.evaluate(() => [JSON.stringify(D.settings.pal), D.settings.bereiche.map(b => b.key + '/' + b.zeichen + '/' + b.stil).join(' '), [...document.querySelectorAll('.modal .btable tbody tr')].map(r => r.querySelector('.zcol input').value).join('')]);
  ok(st[0] === '{"zeichen":"B","stil":"rahmen"}' && /^S\/X\/kraeftig I\/I\/streifen D\/D\/pastell [A-OQ-Z]\/P\/pastell$/.test(st[1]) && st[2] === 'XIDPB', 'D: Einstellungen ' + st[1] + ' · PAL ' + st[0] + ' (doppeltes „X“ abgelehnt)');
  await p.click('.modal footer button:has-text("Schließen")'); await p.waitForTimeout(200);
  const vis = await p.evaluate(id => {
    const x = C.byId.get(id), s = document.querySelector('.cal .chip.S[data-m="' + id + '"]'), pc = document.querySelector('.cal .chip.P[data-m="' + id + '"]'), ic = document.querySelector('.cal .chip.I[data-m="' + id + '"]');
    const cs = getComputedStyle(s), cp = getComputedStyle(pc), ci = getComputedStyle(ic);
    return [s.textContent, cs.backgroundColor, x.color, pc.textContent, cp.backgroundColor, cp.borderTopColor, ci.backgroundImage.includes('repeating-linear-gradient'),
      [...document.querySelectorAll('.mtable thead th .chip')].map(c => c.textContent).join(''), [...document.querySelectorAll('.sec[data-sec="kal"] .tpill .chip')].map(c => c.textContent).join('')];
  }, id);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
  ok(vis[0] === 'X' && rgb(vis[1]).join(',') === hex(vis[2]), 'D: Kalender – Selektion als „X“, kräftig in der Maßnahmenfarbe');
  ok(vis[3] === 'B' && rgb(vis[4]).join(',') === '255,255,255' && rgb(vis[5]).join(',') === hex(vis[2]) && vis[6], 'D: PAL als „B“ nur mit Rahmen, Inhalt gestreift');
  ok(vis[7].startsWith('XIDP') && vis[7].endsWith('B') && vis[8] === 'XIDPB', 'D: Spaltenköpfe ' + vis[7] + ', Kalender-Knöpfe ' + vis[8]);
  const xl = await p.evaluate(async () => new TextDecoder().decode(await viewWorkbook({ year: 2027 }).arrayBuffer()));
  ok(xl.includes('B = PAL (ohne Füllung)') && xl.includes('X = Start Selektion (kräftige Farbe)'), 'D: Excel-Legende mit den neuen Zeichen');
  const nz = await p.evaluate(() => { const d = normalize(JSON.parse(JSON.stringify(D))); return [d.settings.pal.zeichen, d.settings.bereiche.map(b => b.zeichen).join('')]; });
  ok(nz[0] === 'B' && nz[1] === 'XIDP', 'D: Einstellungen bleiben beim Speichern/Laden erhalten');
  // alte Datei ohne Markierungs-Einstellungen → Voreinstellung wie bisher
  const old = await p.evaluate(() => { const d = normalize({ settings: { year: 2027, bereiche: [{ key: 'S', name: 'Selektion' }, { key: 'I', name: 'Inhalt' }, { key: 'D', name: 'Produktion' }] } }); return JSON.stringify([d.settings.pal, d.settings.bereiche.map(b => b.zeichen + b.stil)]); });
  ok(old === '[{"zeichen":"P","stil":"kraeftig"},["Spastell","Ipastell","Dpastell"]]', 'D: ohne Einstellung wie bisher (S/I/D pastell, P kräftig)');
  await finish(b, pages);
})();
