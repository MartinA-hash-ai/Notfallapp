// Strg gedrückt halten: in der Liste direkt bearbeiten (Felder, Stände per Klick weiterdrehen, + für Förderer); ohne Strg öffnet der Klick den Bedarf
const { chromium, ok, open, finish, fs, T } = require('./lib');
(async () => {
  const b = await chromium.launch();
  fs.writeFileSync('vorschau.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(T.PREVIEW, 'utf8') + '</body></html>');
  const p = await open(b, { file: process.cwd() + '/vorschau.html', fakefs: false });
  const R = id => `#list-body tr[data-id="${id}"]`, K = p.keyboard;
  const B = id => p.evaluate(id => JSON.parse(JSON.stringify(D.bedarfe.find(x => x.id === id))), id);
  const F = (id, name) => p.evaluate(([id, n]) => JSON.parse(JSON.stringify(D.bedarfe.find(x => x.id === id).foerderer.find(f => f.name === n))), [id, name]);
  const view = () => p.evaluate(() => UI.view);

  await p.click(R('b-aed') + ' .l-name');
  ok(await view() === 'detail', 'ohne Strg: Klick öffnet den Bedarf');
  await p.click('button[data-act="back"]');

  await K.down('Control');
  let r = await p.evaluate(() => [document.body.classList.contains('strg'), getComputedStyle(document.querySelector('.strg-hint')).backgroundColor !== 'rgba(0, 0, 0, 0)']);
  ok(r.join() === 'true,true', 'Strg gedrückt: Bearbeitungsmodus sichtbar');
  await p.hover(R('b-aed') + ' td.l-fin');
  ok(await p.$eval(R('b-aed') + ' .le-plus', e => getComputedStyle(e).display) === 'grid' && await p.$eval(R('b-mtw') + ' .le-plus', e => getComputedStyle(e).display) === 'none', '+ erscheint nur über dem Finanzierungsplan, den die Maus berührt');

  // Felder: Name, Summe, Ort, Ansprechperson, Deadline
  await p.click(R('b-aed') + ' .l-name');
  r = await p.evaluate(() => [UI.view, document.activeElement.className, document.activeElement.value]);
  ok(r.join('|') === 'list|le-edit|Defibrillatoren (AED) für den Sanitätsdienst', 'Strg + Klick auf den Namen: Feld statt Bedarf öffnen: ' + r.join('|'));
  await K.up('Control');
  await p.click(R('b-aed') + ' .l-name .le-edit');
  ok(await view() === 'list', 'Klick ins offene Feld öffnet den Bedarf nicht');
  await p.fill('.le-edit', 'Defibrillatoren für Lippstadt'); await p.press('.le-edit', 'Enter');
  ok((await B('b-aed')).titel === 'Defibrillatoren für Lippstadt' && (await p.$eval(R('b-aed') + ' .l-name', e => e.textContent)).startsWith('Defibrillatoren für Lippstadt'), 'Name geändert (Strg darf beim Tippen los sein)');
  const edit = async (sel, val, key = 'Enter') => { await K.down('Control'); await p.click(sel); await K.up('Control'); const i = '.le-edit'; await p.fill(i, val); if (await p.$(i)) await p.press(i, key); };   // ein Datum wie aus dem Kalender gilt sofort
  await edit(R('b-aed') + ' .l-sum', '5.200');
  await edit(R('b-aed') + ' [data-le="ort"]', 'Geseke');
  await edit(R('b-aed') + ' [data-le="zust"]', 'Maria Beispiel');
  await edit(R('b-aed') + ' [data-le="deadline"]', '2027-05-15');
  r = await B('b-aed');
  ok([r.summe, r.gliederung, r.zust.join(), r.deadline].join('|') === '5200|Geseke|Maria Beispiel|2027-05-15', 'Summe, Ort, Ansprechperson und Deadline geändert: ' + [r.summe, r.gliederung, r.zust.join(), r.deadline].join('|'));
  ok((await p.$eval(R('b-aed') + ' .l-meta', e => e.innerText.replace(/\s+/g, ' ').trim())) === 'Geseke Maria Beispiel bis 15.05.2027', 'Liste zeigt die neuen Angaben');
  // schlichtes Feld: leer mit blassem Namen, ohne Rahmen, nichts verschiebt sich; Vorschläge beim Tippen
  const xs = () => p.evaluate(sel => [...document.querySelectorAll(sel + ' td')].map(td => Math.round(td.getBoundingClientRect().left)).join(), R('b-aed'));
  const x0 = await xs();
  await K.down('Control'); await p.click(R('b-aed') + ' [data-le="ort"]'); await K.up('Control');
  r = await p.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); return [e.value, e.placeholder, cs.borderTopWidth, cs.borderBottomWidth, e.hasAttribute('list')]; });
  ok(r.join('|') === '|Ort oder Gliederung|0px|1px|false', 'Feld beginnt leer mit blassem „Ort oder Gliederung“, nur eine Linie darunter, ohne Auswahlpfeil: ' + r.join('|'));
  ok(await xs() === x0, 'nichts verschiebt sich, das Feld bleibt in seiner Spalte');
  await K.type('pader');
  r = await p.$$eval('.le-sug .le-opt', o => o.map(x => x.textContent));
  ok(r.includes('Paderborn'), 'Vorschläge beim Tippen gefiltert: ' + r.join());
  await p.click('.le-opt:text-is("Paderborn")');
  ok((await B('b-aed')).gliederung === 'Paderborn' && !(await p.$('.le-sug')), 'Klick auf einen Vorschlag übernimmt ihn');
  await K.down('Control'); await p.click(R('b-aed') + ' [data-le="zust"]'); await K.up('Control');
  await K.type('anna'); await K.press('ArrowDown'); await K.press('Enter');
  ok((await B('b-aed')).zust[0] === 'Anna Muster', 'Pfeil runter und Enter übernimmt den Vorschlag');
  await K.down('Control'); await p.click(R('b-aed') + ' [data-le="zust"]'); await K.up('Control'); await K.press('Enter');
  ok((await B('b-aed')).zust[0] === 'Anna Muster', 'nichts eingegeben: Wert bleibt');
  await edit(R('b-aed') + ' .l-name', 'soll nicht bleiben', 'Escape');
  ok((await B('b-aed')).titel === 'Defibrillatoren für Lippstadt', 'Esc verwirft');
  await edit(R('b-aed') + ' .l-sum', 'viel');
  ok((await B('b-aed')).summe === 5200 && (await p.$eval('#toasts', e => e.textContent)).includes('keine Zahl'), 'keine Zahl: nicht übernommen, Hinweis');

  // Stände per Klick weiterdrehen
  await K.down('Control');
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
  ok(await order() === before, 'solange Strg gedrückt ist, springen die Zeilen nicht');
  await p.click(R('b-klausur') + ' [data-le="fr"][data-k="ofk"]');
  ok((await B('b-klausur')).freigabe.ofk.st === 'offen' && (await p.$eval('#toasts', e => e.textContent)).includes('entfällt'), 'Diözese: Ortsführungskreis entfällt, bleibt unverändert');
  await K.up('Control');

  // Beträge und Eigenmittel
  await edit(R('b-mtw') + ' .fa[data-le="amt"] >> nth=2', '25.000');
  await edit(R('b-aed') + ' [data-le="eig"]', '400');
  ok((await F('b-mtw', 'Beispiel-Soziallotterie')).betrag === 25000 && (await B('b-aed')).eigenanteil === 400, 'Betrag eines Förderers und Eigenmittel geändert');

  // + : weiteren Förderer hinzufügen
  await K.down('Control');
  await p.hover(R('b-aed') + ' td.l-fin'); await p.click(R('b-aed') + ' .le-plus');
  await K.up('Control');
  ok(await p.evaluate(() => document.activeElement.getAttribute('aria-label')) === 'Neuer Förderer', '+ öffnet Felder für Name und Betrag');
  r = await p.evaluate(sel => {
    const n = document.querySelector('.le-new'), kids = [...n.parentElement.children], nm = n.querySelector('[aria-label="Neuer Förderer"]'), am = n.querySelector('[aria-label="Betrag in Euro"]');
    const a = am.getBoundingClientRect(), other = document.querySelector(sel + ' .fa[data-le="amt"]').getBoundingClientRect();
    return [kids.indexOf(n) < kids.findIndex(k => k.classList.contains('fline')), nm.getBoundingClientRect().right <= a.left, Math.abs(a.right - other.right) < 2, nm.placeholder, am.placeholder, getComputedStyle(am).borderTopWidth];
  }, R('b-aed'));
  ok(r.join() === 'true,true,true,Förderer,Betrag in Euro,0px', 'neue Zeile unter den Förderern, über Delta und Eigenmittel; Name endet vor den Beträgen, Betrag in deren Spalte, ohne Rahmen: ' + r.join());
  await K.type('Sparkasse Musterstadt'); await K.press('Enter');
  ok(await p.evaluate(() => document.activeElement.getAttribute('aria-label')) === 'Betrag in Euro', 'Enter springt zum Betrag');
  await K.type('1.000'); await K.press('Enter');
  r = await F('b-aed', 'Sparkasse Musterstadt');
  ok(r && r.status === 'geplant' && r.betrag === 1000 && r.art === 'Sparkasse' && (await p.$eval(R('b-aed') + ' .l-fin', e => e.innerText)).includes('Sparkasse Musterstadt'), 'neuer Förderer geplant, mit Betrag und Art aus der Kartei');

  // Stift ganz rechts: Förderer umbenennen
  await K.down('Control');
  await p.hover(R('b-mtw') + ' .fn[data-le="foe"] >> nth=1');
  r = await p.$$eval(R('b-mtw') + ' .le-pen', b => b.map(x => getComputedStyle(x).visibility).join());
  ok(r === 'hidden,visible,hidden', 'Stift erscheint nur am Förderer unter der Maus: ' + r);
  await p.click(R('b-mtw') + ' .le-pen >> nth=1'); await K.up('Control');
  r = await p.evaluate(sel => { const e = document.activeElement, a = document.querySelector(sel + ' .fa[data-le="amt"]').getBoundingClientRect(); return [e.value, e.placeholder, e.getBoundingClientRect().right <= a.left]; }, R('b-mtw'));
  ok(r.join('|') === 'Bürgerstiftung Musterstadt|Förderer|true', 'Stift: Name zum Ändern, Feld endet vor den Beträgen: ' + r.join('|'));
  await p.fill('.le-edit', 'Bürgerstiftung Beispielstadt'); await p.press('.le-edit', 'Enter');
  ok(!!(await F('b-mtw', 'Bürgerstiftung Beispielstadt')), 'Förderer umbenannt');

  // Kalender beim Verwendungsnachweis
  await p.evaluate(() => { D.bedarfe.find(x => x.id === 'b-mtw').foerderer[0].vn.frist = ''; renderNow(); });
  ok((await p.$eval(R('b-mtw') + ' .vt[data-le="vn"]', e => e.textContent)) === 'Frist fehlt' && await p.$eval(R('b-mtw') + ' .le-cal', e => getComputedStyle(e).display) === 'none', 'ohne Strg: „Frist fehlt“, kein Kalender');
  await K.down('Control');
  ok(await p.$eval(R('b-mtw') + ' .le-cal', e => getComputedStyle(e).display) !== 'none', 'mit Strg: Kalender direkt daneben');
  await p.click(R('b-mtw') + ' .le-cal'); await K.up('Control'); await p.mouse.move(5, 5);   // der Kalender schluckt das Loslassen – die nächste Mausbewegung zählt
  ok(await p.evaluate(() => document.activeElement.type) === 'date', 'Klick auf den Kalender: Datum wählen');
  await p.fill('.le-edit', '2027-08-31');
  ok((await F('b-mtw', 'Sparkasse Musterstadt')).vn.frist === '2027-08-31' && (await p.$eval(R('b-mtw') + ' .vt[data-le="vn"]', e => e.textContent)) === 'bis 31.08.2027', 'Frist aus dem Kalender gleich übernommen');

  // Spendenübergabe: Ort, Datum und Uhrzeit, Notizen
  const ue = () => p.$eval(R('b-kueche') + ' .l-ueb', e => e.innerText.replace(/\s+/g, ' ').trim());
  r = await ue(); ok(r.startsWith('Spendenübergabe einleiten'), 'ohne Strg: Dreieck wie bisher: ' + r);
  await K.down('Control');
  r = await p.$$eval(R('b-kueche') + ' .ue-l', l => l.map(x => x.textContent.trim() + (x.classList.contains('ue-leer') ? '(blass)' : '')).join(' | '));
  ok(r === 'Ort(blass) | Datum und Uhrzeit(blass) | Küche wird erst Ende November eingebaut – Übergabe danach, damit es Fotos von der fertigen Küche gibt.', 'mit Strg: Ort, Datum und Uhrzeit (blass), Notizen: ' + r);
  await p.click(R('b-kueche') + ' [data-le="ueb-ort"]'); await K.up('Control');
  await K.type('Gruppenraum Warburg'); await K.press('Enter');
  await K.down('Control'); await p.click(R('b-kueche') + ' [data-le="ueb-termin"]'); await K.up('Control');
  ok(await p.evaluate(() => document.activeElement.type) === 'datetime-local', 'Datum und Uhrzeit mit Kalender');
  await p.fill('.le-edit', '2026-12-05T15:00');
  await K.down('Control'); await p.click(R('b-kueche') + ' [data-le="ueb-info"]'); await K.up('Control');
  ok((await p.evaluate(() => document.activeElement.value)).startsWith('Küche wird erst'), 'Notizen zum Ändern vorbelegt');
  await p.fill('.le-edit', 'Mit Bürgermeister und Jugendgruppe'); await p.press('.le-edit', 'Enter');
  r = (await B('b-kueche')).nach.ueb;
  ok([r.ort, r.termin, r.zeit, r.st, r.info].join('|') === 'Gruppenraum Warburg|2026-12-05|15:00|terminiert|Mit Bürgermeister und Jugendgruppe', 'Übergabe eingetragen: ' + [r.ort, r.termin, r.zeit, r.st, r.info].join('|'));
  ok(await ue() === '05.12.2026, 15:00 Uhr Gruppenraum Warburg Mit Bürgermeister und Jugendgruppe', 'Liste zeigt Termin mit Uhrzeit, Ort und Notizen: ' + await ue());

  ok(!(await p.evaluate(() => document.body.classList.contains('strg'))) && await view() === 'list', 'Strg losgelassen: Bearbeitungsmodus aus, Liste bleibt');
  await p.click(R('b-mtw') + ' .l-sum');
  ok(await view() === 'detail', 'danach öffnet ein Klick ohne Strg wieder den Bedarf');
  await p.screenshot({ path: 'strg.png' });
  await finish(b, [p]);
})();
