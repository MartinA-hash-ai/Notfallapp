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

  let r = await p.evaluate(() => [document.body.classList.contains('strg'), getComputedStyle(document.querySelector('.strg-hint')).backgroundColor === 'rgba(0, 0, 0, 0)', document.querySelector('.strg-hint').textContent]);
  ok(r.join() === 'true,true,Strg + Klick öffnet den Bedarf', 'ohne Strg: Bearbeiten aktiv, Hinweis „Strg + Klick öffnet den Bedarf“ unauffällig: ' + r.join());
  await K.down('Control');
  r = await p.evaluate(() => [document.body.classList.contains('strg'), getComputedStyle(document.querySelector('.strg-hint')).backgroundColor !== 'rgba(0, 0, 0, 0)']);
  ok(r.join() === 'false,true', 'Strg gedrückt: Bearbeiten aus, der Hinweis leuchtet');
  await K.up('Control');
  await p.hover(R('b-aed') + ' td.l-fin');
  ok(await p.$eval(R('b-aed') + ' .le-plus', e => getComputedStyle(e).display) === 'grid' && await p.$eval(R('b-mtw') + ' .le-plus', e => getComputedStyle(e).display) === 'none', '+ erscheint nur über dem Finanzierungsplan, den die Maus berührt');

  // Felder: Name, Summe, Ort, Ansprechperson, Deadline
  await p.click(R('b-aed') + ' .l-name');
  r = await p.evaluate(() => [UI.view, document.activeElement.className, document.activeElement.value]);
  ok(r.join('|') === 'list|le-edit|Defibrillatoren (AED) für den Sanitätsdienst', 'Klick auf den Namen: Feld statt Bedarf öffnen: ' + r.join('|'));
  await p.click(R('b-aed') + ' .l-name .le-edit');
  ok(await view() === 'list', 'Klick ins offene Feld öffnet den Bedarf nicht');
  await p.fill('.le-edit', 'Defibrillatoren für Lippstadt'); await p.press('.le-edit', 'Enter');
  ok((await B('b-aed')).titel === 'Defibrillatoren für Lippstadt' && (await p.$eval(R('b-aed') + ' .l-name', e => e.textContent)).startsWith('Defibrillatoren für Lippstadt'), 'Name geändert');
  const edit = async (sel, val, key = 'Enter') => { await p.click(sel); const i = '.le-edit'; await p.fill(i, val); if (await p.$(i)) await p.press(i, key); };   // ein Datum wie aus dem Kalender gilt sofort
  await edit(R('b-aed') + ' .l-sum', '5.200');
  await edit(R('b-aed') + ' [data-le="ort"]', 'Geseke');
  await edit(R('b-aed') + ' [data-le="zust"]', 'Maria Beispiel');
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
  await K.type('anna'); await K.press('ArrowDown'); await K.press('Enter');
  ok((await B('b-aed')).zust[0].n === 'Anna Muster', 'Pfeil runter und Enter übernimmt den Vorschlag');
  await p.click(R('b-aed') + ' [data-le="zust"]'); await K.press('Enter');
  ok((await B('b-aed')).zust[0].n === 'Anna Muster', 'nichts eingegeben: Wert bleibt');
  await edit(R('b-aed') + ' .l-name', 'soll nicht bleiben', 'Escape');
  ok((await B('b-aed')).titel === 'Defibrillatoren für Lippstadt', 'Esc verwirft');
  await edit(R('b-aed') + ' .l-sum', 'viel');
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
  for (let i = 0; i < 3; i++) { await p.click(R('b-dig-bue') + ' [data-le="ang"]'); seq.push(await ang('b-dig-bue')); }
  ok(seq.join() === 'da,fehlt,arbeit', 'Angebot: angefragt → liegt vor → fehlt → angefragt: ' + seq.join());
  await p.click(R('b-mtw') + ' .fn[data-le="foe"] >> nth=1');
  r = await F('b-mtw', 'Bürgerstiftung Musterstadt');
  ok(r.status === 'zugesagt' && r.zugesagt === 15000 && r.entscheidungAm === await p.evaluate(() => today()), 'Förderer in Bearbeitung → Klick → Zusage (Betrag und Datum übernommen)');
  seq.length = 0;
  for (let i = 0; i < 3; i++) { await p.click(R('b-mtw') + ' .fn[data-le="foe"] >> nth=1'); seq.push((await F('b-mtw', 'Bürgerstiftung Musterstadt')).status); }
  ok(seq.join() === 'abgelehnt,geplant,beantragt', 'Förderer: Zusage → Absage → geplant → beantragt: ' + seq.join());
  seq.length = 0;
  const vn = async () => { const f = await F('b-mtw', 'Sparkasse Musterstadt'); return f.vn.noetig ? f.vn.st : 'nicht nötig'; };
  for (let i = 0; i < 4; i++) { await p.click(R('b-mtw') + ' .vt[data-le="vn"]'); seq.push(await vn()); }
  ok(seq.join() === 'arbeit,erledigt,nicht nötig,offen', 'Verwendungsnachweis: steht aus → in Arbeit → erledigt → nicht nötig → steht aus: ' + seq.join());
  ok(await order() === before, 'beim Bearbeiten springen die Zeilen nicht (neu sortiert wird beim Zurückkommen in die Liste)');
  await p.click(R('b-klausur') + ' [data-le="fr"][data-k="ofk"]');
  ok((await B('b-klausur')).freigabe.ofk.st === 'offen' && (await p.$eval('#toasts', e => e.textContent)).includes('entfällt'), 'Diözese: Ortsführungskreis entfällt, bleibt unverändert');

  // Beträge und Eigenmittel
  await edit(R('b-mtw') + ' .fa[data-le="amt"] >> nth=2', '25.000');
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
  await p.hover(R('b-mtw') + ' .fn[data-le="foe"] >> nth=1');
  r = await p.$$eval(R('b-mtw') + ' .le-pen', b => b.map(x => getComputedStyle(x).visibility).join());
  ok(r === 'hidden,visible,hidden', 'Stift erscheint nur am Förderer unter der Maus: ' + r);
  r = await p.evaluate(sel => { const pen = document.querySelectorAll(sel + ' .le-pen')[1].getBoundingClientRect(), nm = document.querySelectorAll(sel + ' .fn-t')[1].getBoundingClientRect(),
    amt = document.querySelectorAll(sel + ' .fa[data-le="amt"]')[1].getBoundingClientRect(); return [Math.abs(pen.top + pen.height / 2 - (nm.top + 10)) < 4, pen.left >= nm.right, pen.right <= amt.left]; }, R('b-mtw'));
  ok(r.join() === 'true,true,true', 'Stift in der Zeile des Namens, rechts davon und vor dem Betrag: ' + r.join());
  await p.click(R('b-mtw') + ' .le-pen >> nth=1');
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
  r = await p.evaluate(sel => [...document.querySelectorAll(sel + ' .ue-form .le-edit')].map(e => e.getAttribute('aria-label').split(' ')[0] + '=' + e.value + (e.placeholder ? '(' + e.placeholder + ')' : '')).join(' | '), R('b-kueche'));
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
  await p.fill(R('b-kueche') + ' textarea.le-edit', 'Mit Bürgermeister und Jugendgruppe');
  ok(!!(await p.$(R('b-kueche') + ' .ue-form')), 'beim Wechsel zwischen den Feldern bleibt das Formular offen');
  await p.click(R('b-kueche') + ' .ue-ok');
  r = (await B('b-kueche')).nach.ueb;
  ok([r.ort, r.termin, r.zeit, r.st, r.info].join('|') === 'Gruppenraum Warburg|2026-12-05|15:00|terminiert|Mit Bürgermeister und Jugendgruppe', 'Übergabe eingetragen: ' + [r.ort, r.termin, r.zeit, r.st, r.info].join('|'));
  ok(await ue() === '05.12.2026, 15:00 Uhr Gruppenraum Warburg Mit Bürgermeister und Jugendgruppe' && await view() === 'list', 'Liste zeigt Termin mit Uhrzeit (auf 5 Minuten gerundet), Ort und Notizen: ' + await ue());
  r = await p.evaluate(sel => { const td = document.querySelector(sel + ' .l-ueb'), k = [...td.children].map(e => e.className.split(' ')[0]); return [getComputedStyle(td).verticalAlign, k.join()]; }, R('b-kueche'));
  ok(r[0] === 'middle' && r[1].startsWith('ml,ml-sub,ue-sep,note'), 'Übergabe mittig in der Höhe; unter dem Ort ein Strich, dann die Notizen: ' + r.join(' / '));
  ok(await p.evaluate(sel => document.querySelector(sel + ' .ue-sep').getBoundingClientRect().width === document.querySelector(sel + ' .note').getBoundingClientRect().width, R('b-kueche')), 'der Strich geht über die ganze Breite der Notizen');
  r = await p.evaluate(sel => [getComputedStyle(document.querySelector(sel + ' td.l-sum')).textAlign, getComputedStyle(document.querySelectorAll('table.list thead th')[1]).textAlign], R('b-kueche'));
  ok(r.join() === 'left,left', 'Summe linksbündig: ' + r.join());
  await p.hover(R('b-kueche') + ' .l-sum'); await p.click(R('b-kueche') + ' .le-ue');
  await p.fill(R('b-kueche') + ' [aria-label="Uhrzeit der Spendenübergabe"]', ''); await p.press(R('b-kueche') + ' [aria-label="Ort der Spendenübergabe"]', 'Enter');
  ok((await B('b-kueche')).nach.ueb.zeit === '' && (await ue()).startsWith('05.12.2026 Gruppenraum'), 'Uhrzeit geleert: nur das Datum, Enter übernimmt');

  // Spaltenbreiten wie in Excel: eine Spalte schmaler, die rechts davon rücken nach
  const ths = () => p.$$eval('table.list thead th', t => t.map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }));
  await p.evaluate(() => scrollTo(0, 0));
  const a0 = await ths(), hb = await (await p.$('.col-rs[data-i="2"]')).boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down(); await p.mouse.move(hb.x + hb.width / 2 - 30, hb.y + hb.height / 2, { steps: 6 }); await p.mouse.up();
  const a1 = await ths(), near = (x, y) => Math.abs(x - y) <= 2;
  ok(near(a1[2][1], a0[2][1] - 30) && near(a1[0][1], a0[0][1]) && near(a1[1][1], a0[1][1]) && a1.slice(3).every((c, k) => near(c[1], a0[k + 3][1]) && near(c[0], a0[k + 3][0] - 30)), 'Spalte Ort 30 px schmaler, die links bleiben, die rechts behalten ihre Breite und rücken nach: ' + JSON.stringify([a0, a1]));
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

  // Tab: weiter zum nächsten Feld, Shift+Tab zurück – beim neuen Bedarf und in jeder Zeile
  await p.click('button[data-act="new"]');
  await K.type('Zelt'); await K.press('Tab'); await K.type('900'); await K.press('Shift+Tab');
  r = await p.evaluate(() => [document.activeElement.placeholder, document.activeElement.value, D.bedarfe[0].summe]);
  ok(r.join('|') === 'Name des Bedarfs|Zelt|900', 'Tab vom Namen zur Summe, Shift+Tab zurück zum Namen: ' + r.join('|'));
  await K.press('Tab'); await K.press('Tab'); await K.type('Brakel'); await K.press('Tab');
  r = await p.evaluate(() => [document.activeElement.placeholder, D.bedarfe[0].titel, D.bedarfe[0].summe, D.bedarfe[0].gliederung]);
  ok(r.join('|') === 'Ansprechperson|Zelt|900|Brakel', 'mit Tab von Feld zu Feld durch die neue Zeile: ' + r.join('|'));
  await K.press('Escape');
  await p.click(R('b-aed') + ' .l-name'); await K.press('Tab');
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
    'm-ok:Finanzierung beendet', 'm-off:offen', 'm-off:offen, bis 31.03.2027', 'm-run:in Bearbeitung', 'm-ok:erbracht', 'nicht nötig', 'nicht geplant', '20.11.2026, 15:00 Uhr', 'nicht nötig'].join(' / '),
    'kompakte Stände für Freigabe, Finanzierung, Verwendungsnachweis und Spendenübergabe: ' + r.join(' / '));
  await p.click('.seg.ansicht [data-v="kompakt"]');
  r = await p.evaluate(() => { const rows = [...document.querySelectorAll('#list-body tr[data-id]')], hs = rows.map(x => Math.round(x.getBoundingClientRect().height));
    return [rows[0].children.length, [...document.querySelectorAll('table.list thead th')].map(x => x.textContent).join(','), JSON.parse(localStorage.getItem(uiKey())).ansicht, Math.max(...hs) - Math.min(...hs) <= 2, !document.querySelector('#list-body [data-le="zust"], #list-body [data-le="deadline"]')]; });
  ok(r.join('|') === '7|Bedarf,Summe,Ort,Freigabe,Finanzierung,Verwendungsnachweis,Spendenübergabe|kompakt|true|true', 'Knopf „Kompakt“: je Bedarf eine Zeile, Ansprechperson und Deadline ausgeblendet, Wahl gemerkt: ' + r.join('|'));
  await p.click('button[data-act="new"]'); await K.type('Funkmast'); await K.press('Enter'); await K.type('3.000'); await K.press('Enter'); await K.type('Warburg'); await K.press('Enter');
  r = await p.evaluate(() => { const x = D.bedarfe[0]; return [x.titel, x.summe, x.gliederung, !!document.querySelector('.le-edit, .cal-pop'), document.querySelector('#list-body tr[data-id]').children[0].textContent]; });
  ok(r.join('|') === 'Funkmast|3000|Warburg|false|Funkmast', 'kompakt: + Bedarf führt durch Name, Summe, Ort – dann fertig: ' + r.join('|'));
  await p.click('.seg.ansicht [data-v="voll"]');
  ok(await p.evaluate(() => UI.ansicht === 'voll' && document.querySelectorAll('#list-body tr[data-id]')[0].children.length === 6), 'Knopf „Ausführlich“: wieder alle Angaben');

  // Darstellung hell, auch wenn die umgebende Seite dunkel ist: eingebaute Bedienelemente hell
  r = await p.evaluate(() => { const st = document.createElement('style'); st.textContent = ':root[data-theme=dark], body { color-scheme: dark }'; document.head.append(st); document.documentElement.dataset.theme = 'dark';
    const box = document.createElement('div'); box.className = 'le-sug lang'; document.body.append(box);
    const v = [getComputedStyle(document.querySelector('#q')).colorScheme, getComputedStyle(box).colorScheme, getComputedStyle(box).scrollbarColor]; box.remove(); st.remove(); delete document.documentElement.dataset.theme; return v; });
  ok(r[0] === 'light' && r[1] === 'light' && r[2] !== 'auto', 'Kalender-, Uhrsymbole und Scrollbalken folgen der hellen Darstellung (nicht der dunklen Umgebung): ' + r.join(' / '));

  ok(await p.evaluate(() => document.body.classList.contains('strg')) && await view() === 'list', 'nach allem: Bearbeiten weiter aktiv, Liste bleibt');
  await p.click(R('b-mtw') + ' .l-sum', { modifiers: ['Control'] });
  ok(await view() === 'detail', 'Strg + Klick öffnet den Bedarf');
  await p.screenshot({ path: 'strg.png' });
  await finish(b, [p]);
})();
