// In der Liste direkt bearbeiten ist der Normalzustand (Felder, Stände per Klick weiterdrehen, + für Förderer); Strg + Klick öffnet den Bedarf
const { chromium, ok, open, finish, fs, T } = require('./lib');
(async () => {
  const b = await chromium.launch();
  fs.writeFileSync('vorschau.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(T.PREVIEW, 'utf8') + '</body></html>');
  const p = await open(b, { file: process.cwd() + '/vorschau.html', fakefs: false });
  const R = id => `#list-body tr[data-id="${id}"]`, K = p.keyboard;
  const B = id => p.evaluate(id => JSON.parse(JSON.stringify(D.bedarfe.find(x => x.id === id))), id);
  const F = (id, name) => p.evaluate(([id, n]) => JSON.parse(JSON.stringify(D.bedarfe.find(x => x.id === id).foerderer.find(f => f.name === n))), [id, name]);
  const view = () => p.evaluate(() => UI.view);

  await p.click(R('b-aed') + ' .l-name', { modifiers: ['Control'] });
  ok(await view() === 'detail', 'Strg + Klick öffnet den Bedarf');
  await p.click('button[data-act="back"]');

  let r = await p.evaluate(() => [document.body.classList.contains('strg'), !document.querySelector('.strg-hint, .list-head h2'), document.querySelector('#list-count').textContent]);
  ok(r.join() === 'true,true,8 von 8', 'ohne Strg: Bearbeiten aktiv; Leiste ohne Überschrift und ohne Hinweistext, nur die Zahl: ' + r.join());
  await K.down('Control');
  ok(await p.evaluate(() => !document.body.classList.contains('strg')), 'Strg gedrückt: Bearbeiten aus');
  await K.up('Control');
  await p.hover(R('b-aed') + ' td.l-fin');
  ok(await p.$eval(R('b-aed') + ' .le-plus', e => getComputedStyle(e).display) === 'grid' && await p.$eval(R('b-mtw') + ' .le-plus', e => getComputedStyle(e).display) === 'none', '+ erscheint nur über dem Finanzierungsplan, den die Maus berührt');

  // Felder: Name, Summe, Ort, Ansprechperson, Deadline
  await p.click(R('b-aed') + ' [data-le="titel"]');
  r = await p.evaluate(() => [UI.view, document.activeElement.className, document.activeElement.value]);
  ok(r.join('|') === 'list|le-edit|Defibrillatoren (AED) für den Sanitätsdienst', 'Klick auf den Namen: Feld statt Bedarf öffnen: ' + r.join('|'));
  await p.click(R('b-aed') + ' .l-name .le-edit');
  ok(await view() === 'list', 'Klick ins offene Feld öffnet den Bedarf nicht');
  await p.fill('.le-edit', 'Defibrillatoren für Lippstadt'); await p.press('.le-edit', 'Enter');
  ok((await B('b-aed')).titel === 'Defibrillatoren für Lippstadt' && (await p.$eval(R('b-aed') + ' .l-name', e => e.textContent)).startsWith('Defibrillatoren für Lippstadt'), 'Name geändert');
  const edit = async (sel, val, key = 'Enter') => { await p.click(sel); const i = '.le-edit'; await p.fill(i, val); if (await p.$(i)) await p.press(i, key); };   // ein Datum wie aus dem Kalender gilt sofort
  await edit(R('b-aed') + ' [data-le="summe"]', '5.200');
  await edit(R('b-aed') + ' [data-le="ort"]', 'Geseke');
  await edit(R('b-aed') + ' [data-le="zust"]', 'Maria Beispiel');
  // neue Ansprechperson: Frage, ob sie dauerhaft in die Personenliste soll – hier nur für diesen Bedarf
  const persFrage = async () => { await p.waitForTimeout(450); const m = await p.$('.modal footer button:not(.primary)'); if (m) { await m.click(); await p.waitForTimeout(100); } return !!m; };
  ok(await persFrage(), 'neue Ansprechperson: Frage nach der Personenliste');
  // Deadline: eigener Kalender, direkt geöffnet
  const pick = async iso => { for (let k = 0; k < 24 && !(await p.$(`.cal-pop [data-v="${iso}"]`)); k++) await p.click('.cal-pop .cal-nav[data-d="1"]'); await p.click(`.cal-pop [data-v="${iso}"]`); };
  await p.click(R('b-aed') + ' [data-le="deadline"]');
  ok(await p.$eval('.cal-pop .cal-h', e => e.textContent.trim()) === '‹März 2027›' && !!(await p.$('.cal-pop .cal-d.on[data-v="2027-03-31"]')), 'Deadline: Kalender öffnet im Monat der Deadline, der Tag ist markiert');
  await pick('2027-05-15');
  r = await B('b-aed');
  ok([r.summe, r.gliederung, r.zust.map(z => z.n).join(), r.deadline].join('|') === '5200|Geseke|Maria Beispiel|2027-05-15', 'Summe, Ort, Ansprechperson und Deadline geändert: ' + [r.summe, r.gliederung, r.zust.map(z => z.n).join(), r.deadline].join('|'));
  ok((await p.$eval(R('b-aed') + ' .l-meta', e => e.innerText.replace(/\s+/g, ' ').trim())) === 'Geseke Maria Beispiel bis 15.05.2027', 'Liste zeigt die neuen Angaben');
  // schlichtes Feld: leer mit blassem Namen, ohne Rahmen, nichts verschiebt sich; Vorschläge beim Tippen
  const xs = () => p.evaluate(sel => [...document.querySelectorAll(sel + ' td')].map(td => Math.round(td.getBoundingClientRect().left)).join(), R('b-aed'));
  const x0 = await xs();
  await p.click(R('b-aed') + ' [data-le="ort"]');
  r = await p.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); return [e.value, e.placeholder, cs.borderTopWidth, cs.borderBottomWidth, e.hasAttribute('list')]; });
  ok(r.join('|') === '|Ort oder Gliederung|0px|1px|false', 'Feld beginnt leer mit blassem „Ort oder Gliederung“, nur eine Linie darunter, ohne Auswahlpfeil: ' + r.join('|'));
  ok(await xs() === x0, 'nichts verschiebt sich, das Feld bleibt in seiner Spalte');
  await K.type('pader');
  r = await p.$$eval('.le-sug .le-opt', o => o.map(x => x.textContent));
  ok(r.includes('Paderborn'), 'Vorschläge beim Tippen gefiltert: ' + r.join());
  await p.click('.le-opt:text-is("Paderborn")');
  ok((await B('b-aed')).gliederung === 'Paderborn' && !(await p.$('.le-sug')), 'Klick auf einen Vorschlag übernimmt ihn');
  await p.click(R('b-aed') + ' [data-le="zust"]');
  await K.type('anna'); await K.press('ArrowDown'); await K.press('Enter'); await persFrage();
  ok((await B('b-aed')).zust[0].n === 'Anna Muster', 'Pfeil runter und Enter übernimmt den Vorschlag');
  await p.click(R('b-aed') + ' [data-le="zust"]'); await K.press('Enter');
  ok((await B('b-aed')).zust[0].n === 'Anna Muster', 'nichts eingegeben: Wert bleibt');
  await edit(R('b-aed') + ' [data-le="titel"]', 'soll nicht bleiben', 'Escape');
  ok((await B('b-aed')).titel === 'Defibrillatoren für Lippstadt', 'Esc verwirft');
  await edit(R('b-aed') + ' [data-le="summe"]', 'viel');
  ok((await B('b-aed')).summe === 5200 && (await p.$eval('#toasts', e => e.textContent)).includes('keine Zahl'), 'keine Zahl: nicht übernommen, Hinweis');

  // Stände per Klick weiterdrehen
  const order = () => p.$$eval('#list-body tr[data-id]', t => t.map(x => x.dataset.id).join());
  const before = await order();
  const seq = [];
  for (let i = 0; i < 4; i++) { await p.click(R('b-aed') + ' [data-le="fr"][data-k="verw"]'); seq.push((await B('b-aed')).freigabe.verw.st); }
  ok(seq.join() === 'angefragt,ok,nein,offen', 'Verwaltung: offen → angefragt → zugestimmt → abgelehnt → offen: ' + seq.join());
  await p.click(R('b-aed') + ' [data-le="fr"][data-k="verw"]');
  ok((await B('b-aed')).freigabe.verw.angefragt === await p.evaluate(() => today()), 'angefragt: Datum wie auf der Seite des Bedarfs gesetzt');
  const ang = async id => (await B(id)).unterlagen.find(u => u.name === 'Angebot').st;
  seq.length = 0;
  ok(!(await p.$(R('b-dig-bue') + ' [data-le="ang"]')) && await ang('b-dig-bue') === 'arbeit', 'das Angebot steht nicht mehr in der Liste (Unterlage auf der Seite des Bedarfs)');
  await p.click(R('b-mtw') + ' .fn[data-le="foe"][data-fid="f-mtw-bst"]');
  r = await F('b-mtw', 'Bürgerstiftung Musterstadt');
  ok(r.status === 'zugesagt' && r.zugesagt === 15000 && r.entscheidungAm === await p.evaluate(() => today()), 'Förderer in Bearbeitung → Klick → Zusage (Betrag und Datum übernommen)');
  seq.length = 0;
  for (let i = 0; i < 3; i++) { await p.click(R('b-mtw') + ' .fn[data-le="foe"][data-fid="f-mtw-bst"]'); seq.push((await F('b-mtw', 'Bürgerstiftung Musterstadt')).status); }
  ok(seq.join() === 'abgelehnt,geplant,beantragt', 'Förderer: Zusage → Absage → geplant → beantragt: ' + seq.join());
  seq.length = 0;
  const vn = async () => { const f = await F('b-mtw', 'Sparkasse Musterstadt'); return f.vn.noetig ? f.vn.st : 'nicht nötig'; };
  for (let i = 0; i < 3; i++) { await p.click(R('b-mtw') + ' .vt[data-le="vn"]'); seq.push(await vn()); }
  ok(seq.join() === 'erledigt,nicht nötig,offen', 'Verwendungsnachweis (ab 0.70 ohne „in Arbeit“): steht aus → erledigt → nicht nötig → steht aus: ' + seq.join());
  ok(await order() === before, 'beim Bearbeiten springen die Zeilen nicht (neu sortiert wird beim Zurückkommen in die Liste)');
  ok(await p.$eval(R('b-klausur') + ' td.l-fr', e => e.querySelector('.fr-voll').innerText.trim() === 'freigegeben' && !e.querySelector('[data-le="fr"]')), 'Freigabe vollständig: nur „freigegeben“, nichts zum Weiterschalten (darunter das Angebot)');
  await p.evaluate(() => { D.bedarfe.find(x => x.id === 'b-klausur').freigabe.verw.st = 'offen'; changed(); keep(renderNow); });   // das Angebot zählt nicht mehr zur Freigabe
  await p.click(R('b-klausur') + ' [data-le="fr"][data-k="ofk"]');
  ok((await B('b-klausur')).freigabe.ofk.st === 'offen' && (await p.$eval('#toasts', e => e.textContent)).includes('entfällt'), 'Diözese: Ortsführungskreis entfällt, bleibt unverändert');

  // Beträge und Eigenmittel
  await edit(R('b-mtw') + ' .fa[data-le="amt"][data-fid="f-mtw-lot"]', '25.000');
  await edit(R('b-aed') + ' [data-le="eig"]', '400');
  ok((await F('b-mtw', 'Beispiel-Soziallotterie')).betrag === 25000 && (await B('b-aed')).eigenanteil === 400, 'Betrag eines Förderers und Eigenmittel geändert');

  // + : weiteren Förderer hinzufügen
  await p.hover(R('b-aed') + ' td.l-fin'); await p.click(R('b-aed') + ' .le-plus');
  ok(await p.evaluate(() => document.activeElement.getAttribute('aria-label')) === 'Neuer Förderer', '+ öffnet Felder für Name und Betrag');
  r = await p.evaluate(sel => {
    const n = document.querySelector('.le-new'), kids = [...n.parentElement.children], nm = n.querySelector('[aria-label="Neuer Förderer"]'), am = n.querySelector('[aria-label="Betrag in Euro"]');
    const a = am.getBoundingClientRect(), other = document.querySelector(sel + ' .fa[data-le="amt"]').getBoundingClientRect();
    return [kids.indexOf(n) < kids.findIndex(k => k.classList.contains('fline')), nm.getBoundingClientRect().right <= a.left, Math.abs(a.right - other.right) < 2, nm.placeholder, am.placeholder, getComputedStyle(am).borderTopWidth];
  }, R('b-aed'));
  ok(r.join() === 'true,true,true,Förderer,Betrag in Euro,0px', 'neue Zeile unter den Förderern, über Delta und Eigenmittel; Name endet vor den Beträgen, Betrag in deren Spalte, ohne Rahmen: ' + r.join());
  await K.type('Sparkasse Musterstadt'); await K.press('Enter');
  ok(await p.evaluate(() => document.activeElement.getAttribute('aria-label')) === 'Betrag in Euro', 'Enter springt zum Betrag');
  await K.type('1.000'); await K.press('Shift+Enter');
  r = await F('b-aed', 'Sparkasse Musterstadt');
  ok(r && r.status === 'geplant' && r.betrag === 1000 && r.art === 'Sparkasse' && (await p.$eval(R('b-aed') + ' .l-fin', e => e.innerText)).includes('Sparkasse Musterstadt'), 'neuer Förderer geplant, mit Betrag und Art aus der Kartei');
  ok(await p.evaluate(sel => !!document.querySelector(sel + ' .le-new') && document.activeElement.getAttribute('aria-label') === 'Neuer Förderer', R('b-aed')), 'Shift+Enter: gespeichert und gleich die nächste leere Zeile, der Cursor steht im Namen');
  await K.type('Stadt Lippstadt'); await K.press('Enter'); await K.type('500'); await K.press('Shift+Enter');
  await K.type('Kreis Soest'); await K.press('Enter'); await K.type('250'); await K.press('Enter');
  r = await p.evaluate(() => D.bedarfe.find(x => x.id === 'b-aed').foerderer.map(f => f.name + ':' + f.betrag).slice(-3).join());
  ok(r === 'Sparkasse Musterstadt:1000,Stadt Lippstadt:500,Kreis Soest:250' && !(await p.$('.le-new')), 'drei Förderer nacheinander nur mit der Tastatur; Enter schließt ab: ' + r);

  // Stift ganz rechts: Förderer umbenennen
  await p.hover(R('b-mtw') + ' .fn[data-le="foe"][data-fid="f-mtw-bst"]');
  r = await p.$$eval(R('b-mtw') + ' .le-pen', b => b.map(x => getComputedStyle(x).visibility).join());
  ok(r === 'hidden,hidden,visible', 'Stift erscheint nur am Förderer unter der Maus (Bürgerstiftung steht nach der Einschätzung an dritter Stelle): ' + r);
  r = await p.evaluate(sel => { const pen = document.querySelectorAll(sel + ' .le-pen')[2].getBoundingClientRect(), nm = document.querySelectorAll(sel + ' .fn-t')[2].getBoundingClientRect(),
    amt = document.querySelectorAll(sel + ' .fa[data-le="amt"]')[2].getBoundingClientRect(); return [Math.abs(pen.top + pen.height / 2 - (nm.top + 10)) < 4, pen.left >= nm.right, pen.right <= amt.left]; }, R('b-mtw'));
  ok(r.join() === 'true,true,true', 'Stift in der Zeile des Namens, rechts davon und vor dem Betrag: ' + r.join());
  await p.click(R('b-mtw') + ' .le-pen >> nth=2');
  r = await p.evaluate(sel => { const e = document.activeElement, a = document.querySelector(sel + ' .fa[data-le="amt"]').getBoundingClientRect(); return [e.value, e.placeholder, e.getBoundingClientRect().right <= a.left]; }, R('b-mtw'));
  ok(r.join('|') === 'Bürgerstiftung Musterstadt|Förderer|true', 'Stift: Name zum Ändern, Feld endet vor den Beträgen: ' + r.join('|'));
  await p.fill('.le-edit', 'Bürgerstiftung Beispielstadt'); await p.press('.le-edit', 'Enter');
  ok(!!(await F('b-mtw', 'Bürgerstiftung Beispielstadt')), 'Förderer umbenannt');

  // Kalender beim Verwendungsnachweis
  await p.evaluate(() => { D.bedarfe.find(x => x.id === 'b-mtw').foerderer[0].vn.frist = ''; renderNow(); });
  await K.down('Control');
  ok((await p.$eval(R('b-mtw') + ' .vt[data-le="vn"]', e => e.textContent)) === 'Frist fehlt' && await p.$eval(R('b-mtw') + ' .le-cal', e => getComputedStyle(e).display) === 'none', 'mit Strg (Ansicht): „Frist fehlt“, kein Kalender');
  await K.up('Control');
  await p.hover(R('b-aed') + ' .l-sum');
  ok(await p.$eval(R('b-mtw') + ' .le-cal', e => getComputedStyle(e).display) === 'none', 'Kalender nur in der Zeile unter der Maus');
  await p.hover(R('b-mtw') + ' .l-sum');
  ok(await p.$eval(R('b-mtw') + ' .le-cal', e => getComputedStyle(e).display) !== 'none', 'ohne Strg, Maus auf der Zeile: Kalender direkt daneben');
  await p.click(R('b-mtw') + ' .le-cal');
  r = await p.evaluate(() => { const c = document.querySelector('.cal-pop'); return c && [getComputedStyle(c).backgroundColor, getComputedStyle(c.querySelector('.cal-h b')).color]; });
  ok(r && r.join() === 'rgb(255, 255, 255),rgb(38, 38, 38)', 'Klick auf den Kalender: Monatsansicht sofort offen, in der hellen Darstellung hell: ' + r);
  await pick('2027-08-31');
  ok((await F('b-mtw', 'Sparkasse Musterstadt')).vn.frist === '2027-08-31' && (await p.$eval(R('b-mtw') + ' .vt[data-le="vn"]', e => e.textContent)) === 'bis 31.08.2027', 'Frist aus dem Kalender gleich übernommen');

  // Spendenübergabe: ein Kreis mit Stift, der Ort, Datum, Uhrzeit und Notizen öffnet
  const ue = () => p.$eval(R('b-kueche') + ' .l-ueb', e => e.innerText.replace(/\s+/g, ' ').trim());
  await K.down('Control');
  r = await ue(); ok(r.startsWith('Spendenübergabe einleiten') && await p.$eval(R('b-kueche') + ' .le-ue', e => getComputedStyle(e).display) === 'none', 'mit Strg (Ansicht): Dreieck, kein Kreis: ' + r);
  await K.up('Control');
  await p.mouse.move(5, 5);
  ok(await p.$eval(R('b-kueche') + ' .le-ue', e => getComputedStyle(e).display) === 'none', 'Kreis mit Stift nur in der Zeile unter der Maus');
  await p.hover(R('b-kueche') + ' .l-sum');
  r = await p.$eval(R('b-kueche') + ' .le-ue', e => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return [cs.display, cs.borderTopLeftRadius, Math.round(b.width) >= 26]; });
  ok(r.join() === 'grid,50%,true', 'ohne Strg: großer Kreis mit Stift: ' + r.join());
  await p.click(R('b-kueche') + ' .le-ue'); await p.mouse.move(5, 5);
  r = await p.evaluate(sel => [...document.querySelectorAll(sel + ' .ue-form .le-edit, ' + sel + ' .ue-form .ue-info')].map(e => e.getAttribute('aria-label').split(' ')[0] + '=' + (e.isContentEditable ? richText(e) : e.value) + '(' + (e.placeholder || e.dataset.ph) + ')').join(' | '), R('b-kueche'));
  ok(r === 'Ort=(Ort) | Datum=(Datum) | Uhrzeit=(Uhrzeit) | Notizen=Küche wird erst Ende November eingebaut – Übergabe danach, damit es Fotos von der fertigen Küche gibt.(Notizen)', 'Felder offen: ' + r);
  await p.fill(R('b-kueche') + ' [aria-label="Ort der Spendenübergabe"]', 'Gruppenraum Warburg');
  await p.click(R('b-kueche') + ' [aria-label="Datum der Spendenübergabe"]');
  ok(!!(await p.$('.cal-pop')), 'Datum: Kalender öffnet beim Hineinklicken');
  await pick('2026-12-05');
  r = await p.evaluate(() => [document.activeElement.getAttribute('aria-label'), [...document.querySelectorAll('.zeit-pop .zeit-col')].map(c => [...c.children].map(x => x.textContent).join(' '))]);
  ok(r[0] === 'Uhrzeit der Spendenübergabe' && r[1].length === 2 && r[1][0].split(' ').length === 24 && r[1][1] === '00 05 10 15 20 25 30 35 40 45 50 55', 'nach dem Tag gleich zur Uhrzeit: ein Rad für die Stunden, eins für die Minuten in 5er-Schritten: ' + r[1][1]);
  await p.click('.zeit-pop .zeit-col[data-k="h"] .zeit-v[data-v="15"]');
  ok(await p.$eval(R('b-kueche') + ' [aria-label="Uhrzeit der Spendenübergabe"]', e => e.value) === '15:00' && !!(await p.$('.zeit-pop')), 'Stunde gewählt: 15:00, die Räder bleiben offen');
  await p.click('.zeit-pop .zeit-col[data-k="m"] .zeit-v[data-v="30"]');
  r = await p.evaluate(sel => [document.querySelector(sel + ' [aria-label="Uhrzeit der Spendenübergabe"]').value, !document.querySelector('.zeit-pop'), document.activeElement.getAttribute('aria-label')], R('b-kueche'));
  ok(r.join('|') === '15:30|true|Notizen zur Spendenübergabe', 'Minute gewählt: 15:30, Räder zu, weiter zu den Notizen: ' + r.join('|'));
  await p.fill(R('b-kueche') + ' [aria-label="Uhrzeit der Spendenübergabe"]', '15:02');
  await p.click(R('b-kueche') + ' .ue-info'); await K.press('Control+A'); await K.type('Mit Bürgermeister und *Jugendgruppe*');
  ok(!!(await p.$(R('b-kueche') + ' .ue-form')), 'beim Wechsel zwischen den Feldern bleibt das Formular offen');
  await p.click(R('b-kueche') + ' .ue-ok');
  r = (await B('b-kueche')).nach.ueb;
  ok([r.ort, r.termin, r.zeit, r.st, r.info].join('|') === 'Gruppenraum Warburg|2026-12-05|15:00|terminiert|Mit Bürgermeister und *Jugendgruppe*', 'Übergabe eingetragen (Notizen mit Formatierung): ' + [r.ort, r.termin, r.zeit, r.st, r.info].join('|'));
  ok(await p.evaluate(sel => document.querySelector(sel + ' .note.fmt b').textContent, R('b-kueche')) === 'Jugendgruppe', 'Notizen in der Liste formatiert');
  ok(await ue() === '05.12.2026, 15:00 Uhr Gruppenraum Warburg Mit Bürgermeister und Jugendgruppe' && await view() === 'list', 'Liste zeigt Termin mit Uhrzeit (auf 5 Minuten gerundet), Ort und Notizen: ' + await ue());
  r = await p.evaluate(sel => { const td = document.querySelector(sel + ' .l-ueb'), k = [...td.children].map(e => e.className.split(' ')[0]); return [getComputedStyle(td).verticalAlign, k.join()]; }, R('b-kueche'));
  ok(r[0] === 'middle' && r[1].startsWith('ml,ml-sub,ue-sep,note'), 'Übergabe mittig in der Höhe; unter dem Ort ein Strich, dann die Notizen: ' + r.join(' / '));
  ok(await p.evaluate(sel => document.querySelector(sel + ' .ue-sep').getBoundingClientRect().width === document.querySelector(sel + ' .note').getBoundingClientRect().width, R('b-kueche')), 'der Strich geht über die ganze Breite der Notizen');
  r = await p.evaluate(sel => [getComputedStyle(document.querySelector(sel + ' td.l-sum')).textAlign, getComputedStyle(document.querySelectorAll('table.list thead th')[2]).textAlign], R('b-kueche'));
  ok(r.join() === 'left,left', 'Summe linksbündig: ' + r.join());
  await p.hover(R('b-kueche') + ' .l-sum'); await p.click(R('b-kueche') + ' .le-ue');
  await p.fill(R('b-kueche') + ' [aria-label="Uhrzeit der Spendenübergabe"]', ''); await p.press(R('b-kueche') + ' [aria-label="Ort der Spendenübergabe"]', 'Enter');
  ok((await B('b-kueche')).nach.ueb.zeit === '' && (await ue()).startsWith('05.12.2026 Gruppenraum'), 'Uhrzeit geleert: nur das Datum, Enter übernimmt');

  // Spaltenbreiten wie in Excel: eine Spalte schmaler, die rechts davon rücken nach
  const ths = () => p.$$eval('table.list thead th', t => t.map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }));
  await p.evaluate(() => scrollTo(0, 0));
  const a0 = await ths(), hb = await (await p.$('.col-rs[data-i="3"]')).boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down(); await p.mouse.move(hb.x + hb.width / 2 - 30, hb.y + hb.height / 2, { steps: 6 }); await p.mouse.up();
  const a1 = await ths(), near = (x, y) => Math.abs(x - y) <= 2;
  ok(near(a1[3][1], a0[3][1] - 30) && [0, 1, 2].every(i => near(a1[i][1], a0[i][1])) && a1.slice(4).every((c, k) => near(c[1], a0[k + 4][1]) && near(c[0], a0[k + 4][0] - 30)), 'Spalte Ort 30 px schmaler, die links bleiben, die rechts behalten ihre Breite und rücken nach: ' + JSON.stringify([a0, a1]));
  await p.evaluate(() => keep(renderNow));
  ok(JSON.stringify(await ths()) === JSON.stringify(a1) && !!(await p.evaluate(() => localStorage.getItem('bl-colw'))), 'Breiten bleiben nach dem Neuzeichnen (der Browser merkt sie sich)');
  await p.dblclick('.col-rs[data-i="1"]');
  ok(!(await p.$('table.list colgroup')) && !(await p.evaluate(() => localStorage.getItem('bl-colw'))), 'Doppelklick auf einen Rand: alle Spalten wieder automatisch');

  // „+ Bedarf“: neue Zeile oben, Name → Summe → Ort → Ansprechperson → Deadline nur mit Enter
  await p.click('button[data-act="new"]');
  await K.type('Funkgeräte'); await K.press('Enter'); await K.type('1.200'); await K.press('Enter');
  await K.type('Brakel'); await K.press('Enter'); await K.type('Max Muster'); await K.press('Enter');
  ok(!!(await p.$('.cal-pop')), 'nach der Ansprechperson öffnet der Kalender für die Deadline');
  await pick('2027-04-30');
  r = await p.evaluate(() => { const x = D.bedarfe[0]; return [x.titel, x.summe, x.gliederung, x.zust.map(z => z.n).join(), x.deadline, document.querySelector('#list-body tr[data-id]').dataset.id === x.id, UI.view]; });
  ok(r.join('|') === 'Funkgeräte|1200|Brakel|Max Muster|2027-04-30|true|list', 'neuer Bedarf ganz oben in der Liste, alles nur mit der Tastatur: ' + r.join('|'));
  ok(await persFrage(), 'neue Ansprechperson „Max Muster“: die Frage nach der Personenliste kommt erst, wenn die Eingabe fertig ist');

  // Tab: weiter zum nächsten Feld, Shift+Tab zurück – beim neuen Bedarf und in jeder Zeile
  await p.click('button[data-act="new"]');
  await K.type('Zelt'); await K.press('Tab'); await K.type('900'); await K.press('Shift+Tab');
  r = await p.evaluate(() => [document.activeElement.placeholder, document.activeElement.value, D.bedarfe[0].summe]);
  ok(r.join('|') === 'Name des Bedarfs|Zelt|900', 'Tab vom Namen zur Summe, Shift+Tab zurück zum Namen: ' + r.join('|'));
  await K.press('Tab'); await K.press('Tab'); await K.type('Brakel'); await K.press('Tab');
  r = await p.evaluate(() => [document.activeElement.placeholder, D.bedarfe[0].titel, D.bedarfe[0].summe, D.bedarfe[0].gliederung]);
  ok(r.join('|') === 'Ansprechperson|Zelt|900|Brakel', 'mit Tab von Feld zu Feld durch die neue Zeile: ' + r.join('|'));
  await K.press('Escape');
  await p.click(R('b-aed') + ' [data-le="titel"]'); await K.press('Tab');
  ok(await p.evaluate(() => document.activeElement.placeholder) === 'Summe', 'auch in einer vorhandenen Zeile: Tab springt vom Namen zur Summe');
  await K.press('Escape');

  // kompakte Ansicht: je Bereich nur der Stand als Kreis mit Wort
  r = await p.evaluate(() => {
    const t = html => { const d = document.createElement('div'); d.innerHTML = html; const m = d.querySelector('.mi'); return (m ? m.className.replace('mi ', '') + ':' : '') + d.textContent.trim(); };
    const x = blank(); x.summe = 5000; x.gliederung = 'Brakel';
    const out = [t(kFreigabe(x)), t(kFinanz(x)), t(kNachweis(x)), t(kUebergabe(x))];
    x.freigabe.ofk.st = 'angefragt'; out.push(t(kFreigabe(x)));
    x.freigabe.verw.st = 'nein'; out.push(t(kFreigabe(x)));
    Object.assign(x.freigabe, { ofk: Object.assign(x.freigabe.ofk, { st: 'ok' }), fach: Object.assign(x.freigabe.fach, { st: 'ok' }), verw: Object.assign(x.freigabe.verw, { st: 'ok' }) }); angebotUL(x).st = 'da'; out.push(t(kFreigabe(x)));
    x.foerderer.push(ff({ name: 'A', betrag: 3000, status: 'beantragt' })); out.push(t(kFinanz(x)));
    x.eigenanteil = 2000; Object.assign(x.foerderer[0], { status: 'zugesagt', zugesagt: 3000 }); out.push(t(kFinanz(x)), t(kNachweis(x)));
    x.foerderer[0].vn.frist = '2027-03-31'; out.push(t(kNachweis(x)));
    x.foerderer[0].vn.st = 'arbeit'; out.push(t(kNachweis(x)));
    x.foerderer[0].vn.st = 'erledigt'; out.push(t(kNachweis(x)));
    x.foerderer[0].vn.noetig = false; out.push(t(kNachweis(x)), t(kUebergabe(x)));
    Object.assign(x.nach.ueb, { termin: '2026-11-20', zeit: '15:00', st: 'terminiert' }); out.push(t(kUebergabe(x)));
    x.nach.ueb.noetig = false; out.push(t(kUebergabe(x)));
    return out; });
  ok(r.join(' / ') === ['m-off:keine Freigabe', 'm-off:keine Finanzierung', 'noch keine Zusage', 'nicht geplant', 'm-run:in Bearbeitung', 'm-no:keine Freigabe', 'm-ok:freigegeben', 'm-run:in Bearbeitung',
    'm-ok:Finanzierung beendet', 'm-off:offen', 'm-off:offen, bis 31.03.2027', 'm-run:in Bearbeitung', 'm-ok:erbracht', 'nicht nötig', 'nicht geplant', '20.11.2026, 15:00 Uhr', 'keine Übergabe'].join(' / '),
    'kompakte Stände für Freigabe, Finanzierung, Verwendungsnachweis und Spendenübergabe: ' + r.join(' / '));
  await p.click('.seg.ansicht [data-v="kompakt"]');
  r = await p.evaluate(() => { const rows = [...document.querySelectorAll('#list-body tr[data-id]')], hs = rows.map(x => Math.round(x.getBoundingClientRect().height));
    return [rows[0].children.length, [...document.querySelectorAll('table.list thead th')].map(x => x.textContent).join(','), JSON.parse(localStorage.getItem(uiKey())).ansicht, Math.max(...hs) - Math.min(...hs) <= 2, !document.querySelector('#list-body [data-le="zust"], #list-body [data-le="deadline"]')]; });
  ok(r.join('|') === '8|,Bedarf,Summe,Ort,Freigabe,Finanzierung,Verwendungsnachweis,Spendenübergabe|kompakt|true|true', 'Knopf „Kompakt“: je Bedarf eine Zeile, Ansprechperson und Deadline ausgeblendet, Wahl gemerkt: ' + r.join('|'));
  r = await p.evaluate(() => [...document.querySelectorAll('#list-body tr[data-id]')].map(tr => { const b = D.bedarfe.find(x => x.id === tr.dataset.id), c = [...tr.querySelectorAll('td.k-nach')].map(t => t.textContent.trim());
    return frStand(b) === 'ok' ? c.every(Boolean) : c[0] === (frStand(b) === 'no' ? 'Freigabe abgelehnt' : 'Freigabe ausstehend') && !c[1] && !c[2]; }));
  ok(r.every(Boolean) && await p.evaluate(() => D.bedarfe.some(b => !b.archiv && frStand(b) !== 'ok')), 'kompakt ohne Freigabe: Finanzierung „Freigabe ausstehend“, Nachweis und Übergabe leer; freigegebene wie gewohnt: ' + r.join(','));
  await p.click('button[data-act="new"]'); await K.type('Funkmast'); await K.press('Enter'); await K.type('3.000'); await K.press('Enter'); await K.type('Warburg'); await K.press('Enter');
  r = await p.evaluate(() => { const x = D.bedarfe[0]; return [x.titel, x.summe, x.gliederung, !!document.querySelector('.le-edit, .cal-pop'), document.querySelector('#list-body tr[data-id]').children[1].textContent]; });
  ok(r.join('|') === 'Funkmast|3000|Warburg|false|Funkmast', 'kompakt: + Bedarf führt durch Name, Summe, Ort – dann fertig: ' + r.join('|'));
  // Umschalt+Enter: gleich der nächste Bedarf, direkt darunter – ohne Maus viele hintereinander
  await p.click('button[data-act="new"]'); await K.type('Eins'); await K.press('Enter'); await K.type('100'); await K.press('Enter'); await K.type('Brakel'); await K.press('Shift+Enter');
  await K.type('Zwei'); await K.press('Tab'); await K.type('200'); await K.press('Shift+Enter');
  await K.type('Drei'); await K.press('Shift+Enter'); await K.press('Shift+Enter');
  r = await p.evaluate(() => [[...document.querySelectorAll('#list-body tr[data-id]')].slice(0, 4).map(t => t.children[1].textContent).join(','), D.bedarfe.filter(x => ['Eins', 'Zwei', 'Drei'].includes(x.titel)).map(x => x.titel + ':' + (x.summe || '') + ':' + x.gliederung).sort().join(','), D.bedarfe.some(x => !x.titel), !!document.querySelector('.le-edit')]);
  ok(r.join('|') === 'Eins,Zwei,Drei,Funkmast|Drei::,Eins:100:Brakel,Zwei:200:|false|false', 'Umschalt+Enter legt gleich den nächsten Bedarf darunter an; leer gelassen verschwindet er wieder: ' + r.join('|'));
  // Strg+Klick klappt einen Bedarf ausführlich auf (bearbeitbar), noch einmal Strg+Klick öffnet ihn; ein Klick daneben klappt ihn zu
  await p.click(R('b-mtw') + ' .l-sum', { modifiers: ['Control'] });
  r = await p.evaluate(() => { const tr = document.querySelector('#list-body tr[data-id="b-mtw"]'); return [UI.view, tr.classList.contains('auf'), tr.children.length, !!tr.querySelector('.l-fin[colspan="2"] .fg'), !!tr.querySelector('[data-le="zust"]'), document.querySelectorAll('#list-body tr.auf').length]; });
  ok(r.join('|') === 'list|true|7|true|true|1', 'Strg+Klick: dieser Bedarf ausführlich (Förderer, Ansprechperson …), die anderen bleiben kompakt: ' + r.join('|'));
  await p.evaluate(() => { const f = D.bedarfe.find(x => x.id === 'b-mtw').foerderer[0]; Object.assign(f, { status: 'zugesagt' }); f.vn.noetig = true; changed(); relist(D.bedarfe.find(x => x.id === 'b-mtw')); });
  await p.setViewportSize({ width: 1690, height: 900 }); await p.mouse.move(1200, 300); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const th = $$('table.list thead th'), vn = document.querySelector('#list-body tr.auf .l-fin .mi[data-le="vn"]'), k = document.querySelector('#list-body tr:not(.auf) td:nth-child(7) .kz'), fa = document.querySelector('#list-body tr.auf .l-fin .fa');
    return vn && k ? [Math.round(Math.abs(vn.getBoundingClientRect().left - k.getBoundingClientRect().left)), fa.getBoundingClientRect().right <= th[6].getBoundingClientRect().left] : null; });
  ok(r && r[0] <= 2 && r[1], 'aufgeklappt: der Verwendungsnachweis steht unter seiner Überschrift, die Beträge davor unter „Finanzierung“: ' + JSON.stringify(r));
  await p.setViewportSize({ width: 1500, height: 900 });
  await p.click(R('b-mtw') + ' [data-le="zust"]');
  ok(await p.evaluate(() => !!document.querySelector('#list-body tr.auf .le-edit') && UI.auf === 'b-mtw'), 'im aufgeklappten Bedarf wie gewohnt bearbeiten');
  await K.press('Escape');
  await p.click(R('b-aed') + ' .l-sum', { modifiers: ['Control'] });
  ok(await p.evaluate(() => UI.auf === 'b-aed' && document.querySelectorAll('#list-body tr.auf').length === 1), 'Strg+Klick auf einen anderen: der klappt auf, der vorige zu');
  await p.mouse.click(700, 5); await p.waitForTimeout(50);
  await p.click('main', { position: { x: 5, y: 5 } });
  ok(await p.evaluate(() => !UI.auf && !document.querySelector('#list-body tr.auf')), 'Klick daneben klappt ihn wieder zu');
  await p.click(R('b-mtw') + ' .l-sum', { modifiers: ['Control'] }); await p.click(R('b-mtw') + ' .l-sum', { modifiers: ['Control'] });
  ok(await p.evaluate(() => UI.view === 'detail' && UI.id === 'b-mtw'), 'noch einmal Strg+Klick öffnet den Bedarf');
  await p.click('button[data-act="back"]');
  ok(await p.evaluate(() => UI.view === 'list' && !UI.auf && UI.ansicht === 'kompakt'), 'zurück in der Liste: wieder alles kompakt');
  // ohne Strg: Klick aufs Wort ändert es; daneben klappt der Bedarf auf (Spalten bleiben, die anderen werden blass), noch ein Klick daneben öffnet ihn
  const daneben = async sel => { const q = await (await p.$(sel)).boundingBox(); await p.mouse.click(q.x + 3, q.y + 3); };
  const spalten = () => p.evaluate(() => $$('table.list thead th').map(t => Math.round(t.getBoundingClientRect().width)).join());
  const sp0 = await spalten();
  await p.click(R('b-kueche') + ' [data-le="ort"]');
  ok(await p.evaluate(() => !!document.querySelector('#list-body tr[data-id="b-kueche"] .le-edit') && !UI.auf && UI.view === 'list'), 'kompakt: Klick auf das Wort (Ort) ändert es');
  await K.press('Escape');
  await daneben(R('b-kueche') + ' td.l-name');
  r = await p.evaluate(() => [UI.view, UI.auf, !document.querySelector('.le-edit'), $$('table.list thead th').map(t => Math.round(t.getBoundingClientRect().width)).join(), +getComputedStyle(document.querySelector('#list-body tr[data-id]:not(.auf) > td > *')).opacity, +getComputedStyle(document.querySelector('#list-body tr.auf > td > *')).opacity]);
  ok(r[0] === 'list' && r[1] === 'b-kueche' && r[2] && r[3] === sp0 && r[4] < .5 && r[5] === 1, 'Klick neben den Namen klappt auf; Spaltenbreiten bleiben gleich, die anderen Bedarfe blass: ' + JSON.stringify(r) + ' / ' + sp0);
  await p.click(R('b-aed') + ' [data-le="titel"]');
  ok(await p.evaluate(() => UI.auf === 'b-aed' && !document.querySelector('.le-edit')), 'Klick auf eine blasse Zeile holt diese nach vorn (statt ein Wort darin zu ändern)');
  await K.press('Escape');
  ok(await p.evaluate(() => !UI.auf && !document.querySelector('table.list.hat-auf, table.list.auf-fest')) && await spalten() === sp0, 'Esc klappt zu, Spalten wie vorher');
  r = await p.evaluate(() => { const t = document.querySelector('table.list.kompakt'), td = document.querySelector('#list-body tr[data-id] > td'); return [getComputedStyle(t).borderCollapse, getComputedStyle(td).backgroundColor !== 'rgba(0, 0, 0, 0)']; });
  ok(r.join() === 'separate,true', 'kompakt: jede Zeile malt Hintergrund und Linie selbst – beim Aufgleiten rutscht alles zusammen: ' + r.join());
  // Spaltenbreiten auch kompakt ziehen, mit Mindestbreiten; eigene Breiten bleiben beim Aufklappen stehen
  const zieh = async (i, dx) => { const q = await (await p.$(`table.list.kompakt thead .col-rs[data-i="${i}"]`)).boundingBox(); await p.mouse.move(q.x + 4, q.y + q.height / 2); await p.mouse.down(); await p.mouse.move(q.x + 4 + dx, q.y + q.height / 2, { steps: 4 }); await p.mouse.up(); };
  await zieh(5, -250); await zieh(1, 60);
  r = await p.evaluate(() => [$$('table.list thead th').map(t => Math.round(t.getBoundingClientRect().width)), JSON.parse(localStorage.getItem('bl-colw-k') || 'null'), localStorage.getItem('bl-colw')]);
  ok(r[0][5] === 300 && r[1] && r[1].length === 8 && r[1][5] === 300 && r[1][1] === r[0][1] && r[2] === null, 'kompakt: Spalten ziehen – Finanzierung nicht schmaler als 300 px, gemerkt (getrennt von „Ausführlich“): ' + JSON.stringify(r));
  const sp1 = await spalten(); await daneben(R('b-kueche') + ' td.l-name');
  ok(await p.evaluate(() => UI.auf === 'b-kueche') && await spalten() === sp1, 'eigene Breiten bleiben beim Aufklappen stehen');
  await K.press('Escape');
  await p.dblclick('table.list.kompakt thead .col-rs[data-i="1"]');
  ok(await p.evaluate(() => localStorage.getItem('bl-colw-k') === null) && await spalten() === sp0, 'Doppelklick auf einen Rand: kompakte Breiten zurückgesetzt');
  await daneben(R('b-kueche') + ' td.k-fr'); await daneben(R('b-kueche') + ' td.l-sum');
  ok(await p.evaluate(() => UI.view === 'detail' && UI.id === 'b-kueche'), 'Klick neben die Freigabe klappt auf, danach Klick neben die Summe öffnet den Bedarf');
  await p.click('button[data-act="back"]');
  await p.click('.seg.ansicht [data-v="voll"]');
  ok(await p.evaluate(() => UI.ansicht === 'voll' && document.querySelectorAll('#list-body tr[data-id]')[0].children.length === 7), 'Knopf „Ausführlich“: wieder alle Angaben');
  for (const td of ['td.l-meta', 'td.l-fr', 'td.l-ueb']) {
    await daneben(R('b-kueche') + ' ' + td);
    ok(await p.evaluate(() => UI.view === 'detail' && UI.id === 'b-kueche'), 'ausführlich: Klick daneben (' + td + ') öffnet den Bedarf');
    await p.click('button[data-act="back"]');
  }

  // Priorität als Stern ganz vorn: Klick schaltet Prio an und aus; Stern im Kopf: 1. Klick Prio nach oben, 2. Klick nur Prio, 3. Klick normal
  r = await p.evaluate(() => [...document.querySelectorAll('table.list thead th')][0].querySelector('[data-act="prio-kopf"]') !== null && !document.querySelector('[data-act="f-prio"], .prio-filter') && [...document.querySelectorAll('#list-body tr[data-id]')].every(t => t.firstElementChild.matches('td.l-star')));
  ok(r, 'erste Spalte: Stern (Kopf mit Prio-Stern, kein Knopf „nur Prio“ mehr)');
  const stern = id => p.evaluate(id => [D.bedarfe.find(b => b.id === id).prio, document.querySelector(`#list-body tr[data-id="${id}"] .star-p`).classList.contains('on')].join(':'), id);
  r = [await stern('b-kueche')]; await p.click(R('b-kueche') + ' .star-p'); r.push(await stern('b-kueche')); await p.click(R('b-kueche') + ' .star-p'); r.push(await stern('b-kueche'));
  ok(r.join(' → ') === 'mittel:false → hoch:true → mittel:false' && await view() === 'list', 'Klick auf den Stern: Prio an (gelb), noch einmal: aus; der Bedarf bleibt zu: ' + r.join(' → '));
  r = await p.evaluate(() => getComputedStyle(document.querySelector('#list-body tr[data-id="b-mtw"] .star-p.on svg path')).fill);
  ok(r === 'rgb(245, 192, 0)', 'Prio-Stern gelb gefüllt: ' + r);
  const kopf = () => p.evaluate(() => {
    const ids = [...document.querySelectorAll('#list-body tr[data-id]')].map(t => t.dataset.id), hoch = ids.map(id => D.bedarfe.find(b => b.id === id).prio === 'hoch');
    const k = document.querySelector('[data-act="prio-kopf"]'), path = getComputedStyle(k.querySelector('svg path'));
    return { n: ids.length, alle: D.bedarfe.filter(b => !b.archiv).length, nHoch: hoch.filter(Boolean).length, vorn: hoch.every((h, i) => !i || hoch[i - 1] || !h), nurHoch: hoch.every(Boolean), s: k.className, fill: path.fill, stroke: path.stroke, clear: !!document.querySelector('[data-act="clear"]:not([hidden])') };
  });
  const k0 = await kopf();
  await p.click('[data-act="prio-kopf"]'); const k1 = await kopf();
  ok(k1.s.includes('s1') && k1.fill === 'none' && k1.stroke === 'rgb(210, 154, 23)' && k1.n === k1.alle && k1.nHoch > 0 && k1.vorn && !k1.nurHoch && !k1.clear, '1. Klick auf den Kopf-Stern: Rand golden, alle da, Bedarfe mit Prio oben: ' + JSON.stringify(k1));
  await p.click('[data-act="prio-kopf"]'); const k2 = await kopf();
  ok(k2.s.includes('s2') && k2.fill === 'rgb(245, 192, 0)' && k2.nurHoch && k2.n === k1.nHoch && !k2.clear, '2. Klick: Stern ausgefüllt, nur noch Bedarfe mit Prio (kein „Filter löschen“ mehr, ab 0.63): ' + JSON.stringify(k2));
  await p.click('[data-act="prio-kopf"]'); const k3 = await kopf();
  ok(k3.s.includes('s0') && k3.n === k0.n && k3.fill === 'none' && !k3.clear, '3. Klick: wieder normal, alle wie vorher: ' + JSON.stringify(k3));
  await p.click('.seg.ansicht [data-v="kompakt"]');
  ok(await p.evaluate(() => !!document.querySelector('table.list thead th:first-child [data-act="prio-kopf"]')), 'Kopf-Stern auch in der kompakten Ansicht');
  await p.click('.seg.ansicht [data-v="voll"]');
  // Sortieren in bis zu drei Stufen: Spaltenköpfe nehmen die Spalte als nächste Stufe dazu (Klick: aufwärts, nochmal: abwärts, nochmal: heraus)
  const reihe = () => p.evaluate(() => [...document.querySelectorAll('#list-body tr[data-id]')].map(t => t.dataset.id));
  const vorher = await reihe();
  await p.click('table.list thead [data-act="sort-th"][data-k="summe"]');
  r = await p.evaluate(() => { const S = [...document.querySelectorAll('#list-body tr[data-id]')].map(t => +(D.bedarfe.find(b => b.id === t.dataset.id).summe || 0)).filter(Boolean); return [S.every((v, i) => !i || S[i - 1] <= v), $('table.list thead [data-k="summe"] .so').textContent, JSON.stringify(UI.sort)]; });
  ok(r.join('|') === 'true|1↑|[{"k":"summe","d":"auf"}]', 'Klick auf „Summe“: aufsteigend sortiert, Marke „1↑“: ' + r.join('|'));
  await p.click('table.list thead [data-act="sort-th"][data-k="summe"]');
  r = await p.evaluate(() => { const S = [...document.querySelectorAll('#list-body tr[data-id]')].map(t => +(D.bedarfe.find(b => b.id === t.dataset.id).summe || 0)).filter(Boolean); return [S.every((v, i) => !i || S[i - 1] >= v), $('table.list thead [data-k="summe"] .so').textContent]; });
  ok(r.join('|') === 'true|1↓', 'noch ein Klick: absteigend: ' + r.join('|'));
  await p.click('table.list thead [data-act="sort-th"][data-k="summe"]');
  ok(JSON.stringify(await reihe()) === JSON.stringify(vorher) && !(await p.$('table.list thead .so')), 'dritter Klick: Spalte wieder heraus, übliche Reihenfolge');
  ok(!(await p.$('[data-act="sort-menu"], .sort-btn')), 'kein Knopf „Sortieren“ mehr – sortiert wird über die Spaltenköpfe');
  await p.click('table.list thead [data-act="sort-th"][data-k="fr"]'); await p.click('table.list thead [data-act="sort-th"][data-k="summe"]');
  r = await p.evaluate(() => { const L = [...document.querySelectorAll('#list-body tr[data-id]')].map(t => D.bedarfe.find(b => b.id === t.dataset.id)), fr = L.map(b => ({ ok: 0, run: 1, off: 2, no: 3 })[frStand(b)]);
    const gut = L.every((b, i) => !i || fr[i - 1] < fr[i] || (fr[i - 1] === fr[i] && (!+b.summe || (+L[i - 1].summe && +L[i - 1].summe <= +b.summe))));   // leere Summe unten
    return [gut, ['fr', 'summe'].map(k => $(`table.list thead [data-k="${k}"] .so`).textContent).join(), JSON.parse(localStorage.getItem(uiKey())).sort.map(s => s.k + ':' + s.d).join()]; });
  ok(r.join('|') === 'true|1↑,2↑|fr:auf,summe:auf', 'Spaltenköpfe in zwei Stufen: zuerst Freigabe, darin Summe; gemerkt: ' + r.join('|'));
  r = await p.evaluate(() => { localStorage.setItem(uiKey(), JSON.stringify(Object.assign(JSON.parse(localStorage.getItem(uiKey())), { sort: [{ k: 'deadline', d: 'auf' }, { k: 'fr', d: 'ab' }] }))); loadUI(); const x = JSON.stringify(UI.sort); UI.sort = []; renderNow(); return x; });
  ok(r === '[{"k":"fr","d":"ab"}]', 'gemerkte Sortierung nach Deadline (früher übers Menü) fällt weg – es gibt keinen Spaltenkopf dafür: ' + r);
  // Kopf der Liste hängt als Leiste unter der Kopfzeile, so hoch wie die Leiste auf der Seite eines Bedarfs: beide Seiten beginnen gleich hoch
  const oben = () => p.evaluate(() => [!!document.querySelector('header.top .subbar'), document.querySelector('header.top .subbar').getBoundingClientRect().height, document.querySelector('#app > main').getBoundingClientRect().top + scrollY]);
  const o1 = await oben(); await p.evaluate(() => oeffnen('b-mtw')); const o2 = await oben(); await p.evaluate(() => zurueck());
  ok(o1[0] && o1.join() === o2.join(), 'Liste und Bedarf: Leiste unter der Kopfzeile gleich hoch, Inhalt beginnt an derselben Stelle: ' + o1.join() + ' / ' + o2.join());
  ok(await p.evaluate(() => !!document.querySelector('header.top .subbar.list-head #q') && !!document.querySelector('header.top #list-count') && !document.querySelector('main .list-head')), 'Suche, Anzahl und Ansicht stehen in der Leiste oben, die Tabelle als Kasten darunter');
  // Leiste unter der Kopfzeile bündig mit dem Kasten darunter – auch auf breiten Bildschirmen (Inhalt höchstens 1680 px breit)
  await p.setViewportSize({ width: 1900, height: 900 });
  const buendig = () => p.evaluate(() => { const c = document.querySelector('#app > main > *').getBoundingClientRect(), bar = document.querySelector('header.top .subbar'), k = [...bar.children].filter(x => x.getBoundingClientRect().width);
    return [Math.round(k[0].getBoundingClientRect().left - c.left), Math.round(c.right - Math.max(...k.map(x => x.getBoundingClientRect().right)))]; });
  const bl = await buendig(); await p.evaluate(() => oeffnen('b-mtw')); const bd = await buendig(); await p.evaluate(() => zurueck());
  ok(bl[0] === 0 && bl[1] === 0 && bd[0] === 0, 'Leiste bündig mit dem Kasten: Liste links und rechts, Bedarf links: ' + bl.join() + ' / ' + bd.join());
  await p.setViewportSize({ width: 1500, height: 900 });
  // ohne vollständige Freigabe: Finanzierung, Nachweis und Übergabe grau (ohne Farben)
  r = await p.evaluate(() => ['b-aed', 'b-mtw'].map(id => { const tr = document.querySelector(`#list-body tr[data-id="${id}"]`), c = tr.querySelector('td.l-fin > .fg'); return tr.classList.contains('ohne-fg') + ':' + getComputedStyle(c).filter + ':' + getComputedStyle(tr.querySelector('td.l-fr > *')).filter; }));
  ok(r.join(' / ') === 'true:grayscale(1):none / false:none:none', 'AED ohne Freigabe: alles hinter der Freigabe grau; MTW freigegeben: farbig: ' + r.join(' / '));
  // Strg halten über einem Bedarf: Streifen und Griff auf Höhe der Zeile; Klick auf den Griff öffnet; Esc führt zurück an dieselbe Stelle
  await p.evaluate(() => scrollTo(0, 120));
  const zb = await (await p.$(R('b-kueche'))).boundingBox();
  await p.mouse.move(zb.x + 200, zb.y + zb.height / 2); await K.down('Control'); await p.mouse.move(zb.x + 210, zb.y + zb.height / 2); await p.waitForTimeout(80);
  r = await p.evaluate(() => { const g = $('#peek .peek-g'), tr = document.querySelector('#list-body tr[data-id="b-kueche"]').getBoundingClientRect(), q = g.getBoundingClientRect();
    return [$('#peek').classList.contains('an'), g.dataset.id, Math.abs(q.top + q.height / 2 - (tr.top + tr.height / 2)) < 2, Math.round(innerWidth - q.right)]; });
  ok(r.join('|') === 'true|b-kueche|true|12', 'Strg + Maus über einem Bedarf: Streifen rechts, Griff auf Höhe der Zeile: ' + r.join('|'));
  await K.up('Control'); await p.waitForTimeout(30);
  ok(await p.evaluate(() => !$('#peek').classList.contains('an')), 'Strg losgelassen: Streifen wieder weg');
  await K.down('Control'); await p.mouse.move(zb.x + 220, zb.y + zb.height / 2); await p.mouse.move(1480, zb.y + zb.height / 2, { steps: 6 });
  await p.click('#peek .peek-g'); await K.up('Control');
  ok(await p.evaluate(() => UI.view === 'detail' && UI.id === 'b-kueche' && !$('#peek').classList.contains('an')), 'Klick auf den Griff öffnet den Bedarf (auf dem Weg dorthin bleibt der Streifen stehen)');
  await p.click('#sec-eck .pe[data-k="beschreibung"]'); await K.press('Escape');
  ok(await p.evaluate(() => UI.view === 'detail'), 'Esc in einem offenen Feld bleibt auf der Seite');
  await p.mouse.click(5, 300); await K.press('Escape');
  r = await p.evaluate(() => [UI.view, Math.round(scrollY)]);
  ok(r.join() === 'list,120', 'Esc auf der Seite: zurück zur Liste, an dieselbe Stelle: ' + r.join());
  await p.evaluate(() => scrollTo(0, 0));

  // Darstellung hell, auch wenn die umgebende Seite dunkel ist: eingebaute Bedienelemente hell
  r = await p.evaluate(() => { const st = document.createElement('style'); st.textContent = ':root[data-theme=dark], body { color-scheme: dark }'; document.head.append(st); document.documentElement.dataset.theme = 'dark';
    const box = document.createElement('div'); box.className = 'le-sug lang'; document.body.append(box);
    const v = [getComputedStyle(document.querySelector('#q')).colorScheme, getComputedStyle(box).colorScheme, getComputedStyle(box).scrollbarColor]; box.remove(); st.remove(); delete document.documentElement.dataset.theme; return v; });
  ok(r[0] === 'light' && r[1] === 'light' && r[2] !== 'auto', 'Kalender-, Uhrsymbole und Scrollbalken folgen der hellen Darstellung (nicht der dunklen Umgebung): ' + r.join(' / '));

  ok(await p.evaluate(() => document.body.classList.contains('strg')) && await view() === 'list', 'nach allem: Bearbeiten weiter aktiv, Liste bleibt');
  await p.click(R('b-mtw') + ' .l-sum', { modifiers: ['Control'] });
  ok(await view() === 'detail', 'Strg + Klick öffnet den Bedarf');
  await p.screenshot({ path: 'strg.png' });
  // mit Animationen: beim Aufklappen gleitet die Zeile auf, die Zeilen darunter rutschen mit
  const m = await open(b, { file: process.cwd() + '/vorschau.html', fakefs: false, motion: true });
  await m.click('.seg.ansicht [data-v="kompakt"]');
  const q = await (await m.$('#list-body tr[data-id="b-mtw"] td.l-name')).boundingBox(); await m.mouse.click(q.x + 3, q.y + 3);
  r = await m.evaluate(() => { const A = document.getAnimations(); return [UI.auf, A.filter(a => a.effect.target.matches('#list-body tr.auf td')).length, A.filter(a => a.effect.target.matches('#list-body tr:not(.auf)')).length]; });
  ok(r[0] === 'b-mtw' && r[1] > 0 && r[2] > 0, 'Aufklappen gleitet: Zeile zieht sich auf, die darunter rutschen mit: ' + r.join('|'));
  await m.waitForTimeout(450); await m.mouse.click(q.x + 3, q.y + 3);
  await m.waitForFunction(() => document.getAnimations().some(a => a.effect.pseudoElement), null, { timeout: 2000 }).catch(() => {});
  r = await m.evaluate(() => [UI.view, document.documentElement.dataset.vt, document.getAnimations().map(a => a.effect.pseudoElement).filter(Boolean).sort().join()]);
  ok(r[0] === 'detail' && r[1] === 'vor' && r[2].includes('::view-transition-new(bl-inhalt)') && r[2].includes('::view-transition-new(bl-leiste)'), 'kompakt → Bedarf: Inhalt und Leiste gleiten von rechts herein: ' + r.join(' | '));
  await finish(b, [p, m]);
})();
