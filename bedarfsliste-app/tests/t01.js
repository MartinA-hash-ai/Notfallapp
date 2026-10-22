// Grundtest: leere Datei startet, ein Bedarf läuft per Bedienung durch alle Phasen, nichts wird aus dem Internet geladen
const { chromium, ok, open, finish } = require('./lib');
const status = p => p.$eval('#d-status', e => e.textContent);
// Kreis so oft anklicken, bis der gewünschte Stand erreicht ist (jeder Klick schaltet einen Stand weiter)
const KREIS = { angefragt: 'run', ok: 'ok', nein: 'no', offen: 'off', da: 'ok', arbeit: 'run', fehlt: 'no' };
const setCirc = async (p, sel, v) => { for (let i = 0; i < 5 && (await p.$eval(sel, e => e.className)) !== 'circ c-' + KREIS[v]; i++) await p.click(sel); };
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  ok(await p.$eval('#list-body', e => e.textContent.includes('Noch keine Bedarfe')), 'leere Liste mit Hinweis');
  ok(await p.$$eval('.tools select', s => s.map(x => x.getAttribute('aria-label')).join()) === 'Stichwort' && !!(await p.$('#q')), 'über der Liste nur Suche und Stichwort');
  await p.click('button[data-act="new"]');
  await p.keyboard.type('Defibrillator Test');
  let r = await p.evaluate(() => [D.bedarfe[0].titel, document.querySelectorAll('[data-p="titel"]').length, document.querySelector('#f-titel').placeholder, document.querySelector('input[data-p="gliederung"]').placeholder, document.querySelector('input[data-p="summe"]').placeholder,
    [...document.querySelectorAll('#sec-eck .lab')].map(e => e.textContent.trim()).join(','), !!document.querySelector('#d-title')]);
  ok(r.join('|') === 'Defibrillator Test|1|Bedarf|Gliederung (Ort oder Diözese)|Summe|Zuständig,Deadline i,Stichwort oder Fördertopf i,Beschreibung|false', 'Name nur einmal, oben direkt änderbar; Felder darunter: ' + r.join('|'));
  await p.fill('input[data-p="gliederung"]', 'Paderborn');
  await p.fill('input[data-p="summe"]', '1.500'); await p.press('input[data-p="summe"]', 'Tab');
  r = await p.evaluate(() => [D.bedarfe[0].summe, D.bedarfe[0].gliederung, document.querySelector('input[data-p="summe"]').value]);
  ok(r.join('|') === '1500|Paderborn|1.500', 'Gliederung und Summe oben geändert: ' + r.join('|'));
  ok((await status(p)).includes('Es fehlt: Ortsführungskreis, Fachreferat, Verwaltung, Angebot'), 'ab 1.000 €: Stand nennt Freigaben und das Angebot');
  await p.fill('input[data-p="summe"]', 'abc'); await p.press('input[data-p="summe"]', 'Tab');
  r = await p.evaluate(() => [D.bedarfe[0].summe, document.querySelector('input[data-p="summe"]').value]);
  ok(r[0] === 1500 && r[1] === '1.500', 'keine Zahl: nicht übernommen, alter Wert zurück');
  await p.fill('input[data-p="summe"]', '800'); await p.press('input[data-p="summe"]', 'Tab');
  r = await p.evaluate(() => [document.querySelector('#fr-body').textContent.split('nicht nötig').length - 1, document.querySelectorAll('#fr-body .circ').length, !document.querySelector('#fr-body [data-p$=".notiz"]')]);
  ok(r.join() === '2,3,true', 'unter 1.000 €: drei Kreise, Fachreferat und Verwaltung „nicht nötig“, keine Notizfelder');
  ok((await status(p)) === 'Es fehlt: Ortsführungskreis, Angebot', 'unter 1.000 €: es fehlen nur Ortsführungskreis und Angebot');
  await setCirc(p, '#fr-ofk .circ', 'angefragt');
  r = await p.evaluate(() => [D.bedarfe[0].freigabe.ofk.angefragt === today(), document.querySelector('#fr-ofk .circ').className, !!document.querySelector('#fr-ofk input[type=date]')]);
  ok(r.join() === 'true,circ c-run,true', 'angefragt: gelber Kreis, Datum gesetzt und sichtbar: ' + r.join());
  await setCirc(p, '#fr-ofk .circ', 'offen');
  ok(await p.evaluate(() => D.bedarfe[0].freigabe.ofk.st === 'offen'), 'zurück auf „noch nicht angefragt“');
  await setCirc(p, '#fr-fach .circ', 'angefragt');
  ok((await status(p)).includes('Fachreferat'), 'unter 1.000 €, aber angefragt: Fachreferat zählt jetzt');
  await setCirc(p, '#fr-fach .circ', 'nein');
  ok((await p.$eval('#fr-fach .circ', e => e.className)) === 'circ c-no' && (await status(p)).startsWith('Freigabe abgelehnt'), 'abgelehnt: roter Kreis, Stand „Freigabe abgelehnt“');
  await setCirc(p, '#fr-fach .circ', 'offen');
  await p.fill('input[data-p="freigabe.fach.name"]', 'Notfallvorsorge');
  ok(await p.evaluate(() => D.bedarfe[0].freigabe.fach.name === 'Notfallvorsorge'), 'Fachreferat: Name direkt im Feld eintragen');
  await setCirc(p, '#fr-ofk .circ', 'ok');
  const ang = await p.evaluate(() => angebotUL(cur()).id);
  await setCirc(p, `.circ[data-uid="${ang}"]`, 'da');
  ok((await status(p)).includes('Förderplan aufstellen') && (await p.$eval(`.circ[data-uid="${ang}"]`, e => e.className)) === 'circ c-ok', 'Ortsführungskreis und Angebot (grüner Kreis) → Förderplan aufstellen');
  await p.fill('#ul-new', 'Bilder'); await p.press('#ul-new', 'Enter');
  r = await p.evaluate(() => [...document.querySelectorAll('#ul-body .ci-row:not(.add)')].map(e => (e.querySelector('.ci-n') || e.querySelector('input')).textContent || e.querySelector('input').value).join());
  ok(r === 'Konzept,Projektsteckbrief,Angebot,Bilder' && !!(await p.$('#ul-body [data-act="rm-ul"]')), 'weitere Unterlage hinzugefügt, nur sie lässt sich entfernen');
  await p.click('#ul-body [data-act="rm-ul"]');
  await p.click('button[data-act="add-foe"]');
  await p.keyboard.type('Sparkasse X');
  await p.fill('.fp input[data-p="betrag"]', '800');
  ok((await status(p)).includes('Anträge stellen') && (await p.$eval('.share-t', e => e.textContent)).includes('100 %'), 'Förderer geplant → Anträge stellen; Anteil 100 %');
  await p.click('.fp .st-btn'); await p.click('.st-pop button[data-v="zugesagt"]');
  r = await p.evaluate(() => { const f = D.bedarfe[0].foerderer[0]; return [f.zugesagt, f.beantragtAm === today(), D.bedarfe[0].nach.ueb.mit.includes(f.id), document.querySelector('.fp input.amt').dataset.p, document.querySelector('.fp .st-btn').textContent.trim(), document.querySelector('.fp input.amt').getAttribute('aria-label')]; });
  ok(r.join() === '800,true,true,zugesagt,zugesagt ▾,Zugesagte Summe', 'Stand über den Knopf: zugesagt, Summe und Datum vorbelegt');
  await p.click('.fp .dot:nth-child(2)');   // die Punkte füllen sich von rechts: der zweite von links ist Stufe 4
  ok(await p.evaluate(() => D.bedarfe[0].foerderer[0].einsch === 'w' && document.querySelectorAll('.fp .dots.lv4 .dot.on').length === 4), 'Einschätzung: vier Punkte = wahrscheinlich');
  ok((await status(p)).includes('Geldeingang offen'), 'Stand: Geldeingang offen');
  await p.click('button[data-act="geld"]'); await p.click('button[data-act="geld-ok"]');
  r = await p.evaluate(() => [D.bedarfe[0].foerderer[0].eingegangen, document.querySelector('#d-status').textContent, document.querySelector('#d-steps .cur').textContent]);
  ok(r[0] === 800 && r[1].includes('Spendenübergabe') && r[1].includes('Pressemitteilung') && r[2] === 'Nacharbeit', 'Geld eingegangen → Phase Nacharbeit: ' + r[1]);
  await p.click('[data-p="nach.ueb.st"][data-v="erledigt"]'); await p.click('[data-p="nach.pm.st"][data-v="veroeff"]');
  ok((await status(p)).includes('Alles erledigt'), 'Nacharbeit erledigt → abgeschlossen');
  await p.click('button[data-act="back"]');
  r = await p.evaluate(() => { const tr = document.querySelector('#list-body tr[data-id]'), td = [...tr.querySelectorAll('td')].map(e => e.innerText.replace(/\s+/g, ' ').trim());
    return [td.length, td[0], td[1], td[2], !!tr.querySelector('.l-fr .done'), tr.querySelector('.l-fin .fr.z .fn').textContent, tr.querySelector('.l-fin .vt.nn').textContent, !tr.querySelector('.l-fin .lead'), td[5], !tr.querySelector('.phase, button.prio')]; });
  ok(r.join('|') === '6|Defibrillator Test|800 €|Paderborn – ohne Deadline|true|Sparkasse X|nicht nötig|true|erledigt|true', 'Liste: Name, Summe, Ort; Freigabe blass grün; Förderer blass grün ohne Nachweis; Übergabe erledigt: ' + r.join('|'));
  await p.click('#list-body tr[data-id]');
  await p.click('.d-head button.prio'); await p.click('#pmenu button[data-v="hoch"]');
  await p.click('button[data-act="back"]');
  ok(await p.evaluate(() => D.bedarfe[0].prio === 'hoch' && document.querySelector('#list-body tr[data-id] .prio-t').textContent === '(Prio)'), 'Priorität hoch (auf der Seite des Bedarfs) → „(Prio)“ hinter dem Namen');
  await p.click('#list-body tr[data-id]');
  await p.click('button[data-act="more"]'); await p.click('#mmenu button[data-v="zurückgestellt"]');
  ok(await p.evaluate(() => D.bedarfe[0].manuell === 'zurückgestellt'), '„⋯“: zurückgestellt');
  await p.click('button[data-act="back"]');
  ok(await p.evaluate(() => document.querySelector('#list-body tr.paused .pause-t').textContent === '(zurückgestellt)'), 'Liste: zurückgestellt steht hinter dem Namen');
  await p.click('#list-body tr[data-id]');
  await p.click('button[data-act="more"]'); await p.click('#mmenu button[data-v=""]');
  ok(await p.evaluate(() => D.bedarfe[0].manuell === ''), '„⋯“: wieder aufgenommen');
  await p.click('button[data-act="more"]'); await p.click('#mmenu button[data-act="archive"]');
  ok(await p.evaluate(() => D.bedarfe[0].archiv && !document.querySelector('#list-body tr[data-id]')), '„⋯“: archiviert, aus der Liste verschwunden');
  await p.click('#toasts button.link');
  ok(await p.evaluate(() => !D.bedarfe[0].archiv && !!document.querySelector('#list-body tr[data-id]')), 'Rückgängig holt ihn zurück');
  await p.click('#list-body tr[data-id]'); await p.click('button[data-act="del"]');
  await p.waitForSelector('.modal'); await p.click('.modal footer button.primary');
  ok(await p.evaluate(() => D.bedarfe.length === 0 && UI.view === 'list'), 'roter Knopf: nach Rückfrage gelöscht');
  await p.click('#toasts button.link');
  ok(await p.evaluate(() => D.bedarfe.length === 1), 'Löschen rückgängig gemacht');
  // Daten aus 0.1: Angebot war Teil der Freigabe, Einschätzung dreistufig
  r = await p.evaluate(() => { const n = normalize({ bedarfe: [{ id: 'alt', titel: 'alt', freigabe: { angebot: { st: 'ok' }, trotzdem: true }, unterlagen: [{ name: 'Konzept', st: 'da', fest: true }, { name: 'Bilder', st: 'da' }], foerderer: [{ name: 'A', einsch: 'gut' }, { name: 'B', einsch: 'schwierig' }] }] }).bedarfe[0];
    return [n.unterlagen.map(u => u.name + ':' + u.st).join(), 'angebot' in n.freigabe, 'trotzdem' in n.freigabe, n.foerderer.map(f => f.einsch).join()]; });
  ok(r.join('|') === 'Konzept:da,Projektsteckbrief:fehlt,Angebot:da,Bilder:da|false|false|w,uw', 'Daten aus 0.1 werden übernommen: ' + r.join('|'));
  // Daten bis 0.5: Sachbericht getrennt, Verwendungsnachweis nur erledigt ja/nein
  r = await p.evaluate(() => normalize({ bedarfe: [{ id: 'alt5', foerderer: [
    { name: 'A', sb: { noetig: true, frist: '2027-01-31', erledigt: true }, vn: { noetig: true, frist: '2027-03-31', erledigt: false } },
    { name: 'B', sb: { noetig: true, frist: '2027-05-31', erledigt: false }, vn: { noetig: false, frist: '', erledigt: false } },
    { name: 'C', vn: { noetig: true, frist: '2026-12-31', erledigt: true } }] }] }).bedarfe[0].foerderer.map(f => [f.vn.noetig, f.vn.frist, f.vn.st, 'sb' in f, 'erledigt' in f.vn].join()));
  ok(r.join('|') === 'true,2027-01-31,arbeit,false,false|true,2027-05-31,offen,false,false|true,2026-12-31,erledigt,false,false', 'Sachbericht geht im Verwendungsnachweis auf, drei Stände: ' + r.join('|'));
  ok(!p.reqs.length, 'keine Anfragen ins Internet' + (p.reqs.length ? ': ' + p.reqs.join(', ') : ''));
  await finish(b, [p]);
})();
