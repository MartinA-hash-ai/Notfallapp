// Grundtest: leere Datei startet, ein Bedarf läuft per Bedienung durch alle Phasen, nichts wird aus dem Internet geladen
const { chromium, ok, open, finish } = require('./lib');
// der Stand steht als Hinweis an den Schritten oben (beim Überfahren)
const status = p => p.$eval('#d-steps [title]', e => e.title);
// Kreis so oft anklicken, bis der gewünschte Stand erreicht ist (jeder Klick schaltet einen Stand weiter)
const KREIS = { angefragt: 'run', ok: 'ok', nein: 'no', offen: 'off', da: 'ok', arbeit: 'run', fehlt: 'no' };
const setCirc = async (p, sel, v) => { for (let i = 0; i < 5 && (await p.$eval(sel, e => e.className)) !== 'circ c-' + KREIS[v]; i++) await p.click(sel); };
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  ok(await p.$eval('#list-body', e => e.textContent.includes('Noch keine Bedarfe')), 'leere Liste mit Hinweis');
  ok(await p.$$eval('.tools select', s => s.map(x => x.getAttribute('aria-label')).join()) === 'Stichwort' && !!(await p.$('#q')), 'über der Liste nur Suche und Stichwort');
  // „+ Bedarf“: neue Zeile in der Liste, der Reihe nach Name → Summe → …; Strg + Klick öffnet den Bedarf
  await p.click('button[data-act="new"]');
  let r = await p.evaluate(() => [UI.view, document.querySelectorAll('#list-body tr[data-id]').length, document.activeElement.classList.contains('le-edit'), document.activeElement.placeholder,
    [...document.querySelectorAll('#list-body tr[data-id] .ph')].map(e => e.textContent).join(',')]);
  ok(r.join('|') === 'list|1|true|Name des Bedarfs|Name des Bedarfs,Summe,Ort,Ansprechperson', '„+ Bedarf“: neue Zeile in der Liste, Feld für den Namen offen, leere Felder mit blassem Platzhalter: ' + r.join('|'));
  await p.keyboard.type('Defibrillator Test'); await p.keyboard.press('Enter');
  r = await p.evaluate(() => [D.bedarfe[0].titel, document.activeElement.placeholder]);
  ok(r.join('|') === 'Defibrillator Test|Summe', 'Enter: Name übernommen, weiter zur Summe: ' + r.join('|'));
  await p.keyboard.press('Escape');
  await p.click('button[data-act="new"]'); await p.keyboard.press('Escape');
  ok(await p.evaluate(() => D.bedarfe.length === 1 && document.querySelectorAll('#list-body tr[data-id]').length === 1), 'neuer Bedarf ohne Namen (Esc) verschwindet wieder');
  await p.click('#list-body tr[data-id] [data-le="titel"]');
  ok(await p.evaluate(() => UI.view === 'list' && !!document.querySelector('#list-body .le-edit')), 'ohne Strg: Klick auf den Namen bearbeitet ihn, der Bedarf bleibt zu');
  await p.keyboard.press('Escape');
  await p.click('#list-body tr[data-id] .l-name', { modifiers: ['Control'] });
  ok(await p.evaluate(() => UI.view === 'detail'), 'Strg + Klick öffnet den Bedarf');
  r = await p.evaluate(() => [D.bedarfe[0].titel, document.querySelectorAll('[data-p="titel"]').length, document.querySelector('#f-titel').placeholder, document.querySelector('input[data-p="gliederung"]').placeholder, document.querySelector('input[data-p="summe"]').placeholder,
    [...document.querySelectorAll('#sec-eck .sub, #sec-eck .lab')].map(e => e.textContent.trim()).join(','), !!document.querySelector('#d-title')]);
  ok(r.join('|') === 'Defibrillator Test|1|Bedarf|Gliederung (Ort oder Diözese)|Summe|Zuständig,Beschreibung i|false', 'Name nur einmal, oben direkt änderbar; Felder darunter: ' + r.join('|'));
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
  ok(r.join() === '2,4,true', 'unter 1.000 €: vier Kreise (mit Angebot), Fachreferat und Verwaltung „nicht nötig“, keine Notizfelder');
  ok((await status(p)) === 'Es fehlt: Ortsführungskreis, Angebot', 'unter 1.000 €: es fehlen nur Ortsführungskreis und Angebot');
  await setCirc(p, '#fr-ofk .circ', 'angefragt');
  r = await p.evaluate(() => [D.bedarfe[0].freigabe.ofk.angefragt === today(), document.querySelector('#fr-ofk .circ').className, document.querySelector('#fr-ofk input.dfeld').value === fmtDate(today())]);
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
  ok(r === 'Konzept,Projektsteckbrief,Bilder' && !!(await p.$('#ul-body [data-act="rm-ul"]')), 'weitere Unterlage hinzugefügt, nur sie lässt sich entfernen; das Angebot steht bei den Freigaben');
  ok(!!(await p.$(`#fr-body .circ[data-uid="${ang}"]`)), 'Angebot als Kreis im Block der Freigaben');
  await p.click('#ul-body [data-act="rm-ul"]');
  await p.click('button[data-act="add-foe"]');
  await p.keyboard.type('Sparkasse X');
  await p.fill('.fp input[data-p="betrag"]', '800');
  ok((await status(p)).includes('Anträge stellen') && (await p.$eval('#fin-rows', e => e.textContent)).includes('100 %'), 'Förderer geplant → Anträge stellen; Anteil 100 %');
  await p.click('.fp .st-btn'); await p.click('.st-pop button[data-v="zugesagt"]');
  r = await p.evaluate(() => { const f = D.bedarfe[0].foerderer[0]; return [f.zugesagt, f.beantragtAm === today(), D.bedarfe[0].nach.ueb.mit.includes(f.id), document.querySelector('.fp input.amt').dataset.p, document.querySelector('.fp .st-btn').textContent.trim(), document.querySelector('.fp input.amt').getAttribute('aria-label')]; });
  ok(r.join() === '800,true,true,zugesagt,zugesagt ▾,Zugesagte Summe', 'Stand über den Knopf: zugesagt, Summe und Datum vorbelegt');
  await p.click('.fp .dot:nth-child(2)');   // die Punkte füllen sich von rechts: der zweite von links ist Stufe 4
  ok(await p.evaluate(() => D.bedarfe[0].foerderer[0].einsch === 'w' && document.querySelectorAll('.fp .dots.lv4 .dot.on').length === 4), 'Einschätzung: vier Punkte = wahrscheinlich');
  ok((await status(p)).includes('Geldeingang offen'), 'Stand: Geldeingang offen');
  ok(await p.$eval('.fk-st .geld-link', e => e.textContent.trim()) === '→ Geldeingang bestätigen' && await p.$eval('.fk-st .fp-d span', e => e.textContent) === 'am', 'Zusage: „am …“ hinter dem Stand, daneben „→ Geldeingang bestätigen“ als Link');
  r = await p.$eval('.fk-st .geld-link', e => { const s = getComputedStyle(e), row = e.parentElement.getBoundingClientRect(); return [s.color === getComputedStyle(document.querySelector('.fk .fp-h')).color, s.textDecorationLine, Math.abs(e.getBoundingClientRect().right - row.right) <= 2]; });
  ok(r.join() === 'true,underline,true', 'Link „Geldeingang bestätigen“ in normaler Schriftfarbe, unterstrichen, rechtsbündig: ' + r.join());
  await p.click('button[data-act="geld"]'); await p.click('.cal-pop .cal-d.heute');
  r = await p.evaluate(() => [D.bedarfe[0].foerderer[0].eingegangen, document.querySelector('#d-steps [title]').title, document.querySelector('#d-steps .cur').lastChild.textContent]);
  ok(await p.$eval('.fk-st .geld.ok', e => e.textContent.trim()) === 'eingegangen am ' + await p.evaluate(() => fmtDate(today())) && !!(await p.$('.fk-st .geld.ok .pen')), 'Geld eingegangen: grüner Haken, „eingegangen am …“ und Stift, ohne Betrag');
  const g = await p.$eval('.fk-st', e => [e.querySelectorAll('.st-btn, .fp-dates').length, Math.abs(e.querySelector('.geld.ok').getBoundingClientRect().left - e.getBoundingClientRect().left) <= 1]);
  ok(g.join() === '0,true', 'nach dem Geldeingang kein Stand-Feld und kein Datum mehr, „eingegangen am …“ ganz links: ' + g.join());
  await p.click('.fk-st .geld.ok .pen'); await p.click('.cal-pop .cal-f button');
  ok(!!(await p.$('.fk-st .st-btn')) && !!(await p.$('.fk-st .geld-link')) && await p.evaluate(() => D.bedarfe[0].foerderer[0].eingegangen) == null, 'Stift → „Eingang zurücknehmen“: Stand, Datum und Link sind wieder da');
  await p.click('button[data-act="geld"]'); await p.click('.cal-pop .cal-d.heute');
  ok(r[0] === 800 && r[1].includes('Spendenübergabe') && r[1].includes('Pressemitteilung') && r[2] === 'Nacharbeit', 'Geld eingegangen → Phase Nacharbeit: ' + r[1]);
  ok(await p.evaluate(() => D.bedarfe[0].foerderer[0].vn.noetig === true) && r[1].includes('Verwendungsnachweis'), 'Verwendungsnachweis standardmäßig nötig');
  await p.click('[data-p="nach.ueb.st"][data-v="erledigt"]'); await p.click('[data-p="nach.pm.st"][data-v="veroeff"]'); await p.click('[data-p="vn.st"][data-v="erledigt"]');
  ok((await status(p)).includes('Alles erledigt'), 'Nacharbeit erledigt → abgeschlossen');
  await p.click('button[data-act="back"]');
  r = await p.evaluate(() => { const tr = document.querySelector('#list-body tr[data-id]'), td = [...tr.querySelectorAll('td')].map(e => e.innerText.replace(/\s+/g, ' ').trim());
    return [td.length, td[1], td[2], td[3], tr.querySelector('.l-fr').innerText.trim() === 'freigegeben', tr.querySelector('.l-fin .fr.z .fn').textContent, tr.querySelector('.l-fin .vt').textContent, !!tr.querySelector('.l-fin .fr.z .lead'), td[6], !tr.querySelector('.phase, button.prio')]; });
  ok(r.join('|') === '7|Defibrillator Test|800 €|Paderborn Ansprechperson ohne Deadline|true|Sparkasse X|erledigt|true|erledigt|true', 'Liste: Name, Summe, Ort; Freigabe nur „freigegeben“; Förderer blass grün, Nachweis erledigt; Übergabe erledigt: ' + r.join('|'));
  await p.click('#list-body tr[data-id] .l-name', { modifiers: ['Control'] });
  ok(await p.evaluate(() => !document.querySelector('.d-head .prio, .d-head [data-act="prio-menu"]') && !document.querySelector('.d-head .d-star').classList.contains('on')), 'Seite des Bedarfs: nur ein Stern statt Balken');
  await p.click('.d-head .d-star');
  ok(await p.evaluate(() => document.querySelector('.d-head .d-star').classList.contains('on')), 'Stern auf der Seite des Bedarfs wird gelb');
  await p.click('button[data-act="back"]');
  ok(await p.evaluate(() => D.bedarfe[0].prio === 'hoch' && document.querySelector('#list-body tr[data-id="' + D.bedarfe[0].id + '"] .l-star .star-p').classList.contains('on') && !document.querySelector('.prio-t')), 'Stern auf der Seite des Bedarfs → gelber Stern vorn in der Liste');
  await p.click('#list-body tr[data-id] .l-name', { modifiers: ['Control'] });
  await p.click('button[data-act="more"]'); await p.click('#mmenu button[data-v="zurückgestellt"]');
  ok(await p.evaluate(() => D.bedarfe[0].manuell === 'zurückgestellt'), '„⋯“: zurückgestellt');
  await p.click('button[data-act="back"]');
  ok(await p.evaluate(() => document.querySelector('#list-body tr.paused .pause-t').textContent === '(zurückgestellt)'), 'Liste: zurückgestellt steht hinter dem Namen');
  await p.click('#list-body tr[data-id] .l-name', { modifiers: ['Control'] });
  await p.click('button[data-act="more"]'); await p.click('#mmenu button[data-v=""]');
  ok(await p.evaluate(() => D.bedarfe[0].manuell === ''), '„⋯“: wieder aufgenommen');
  await p.click('button[data-act="more"]'); await p.click('#mmenu button[data-act="archive"]');
  ok(await p.evaluate(() => D.bedarfe[0].archiv && !document.querySelector('#list-body tr[data-id]')), '„⋯“: archiviert, aus der Liste verschwunden');
  await p.click('#toasts button.link');
  ok(await p.evaluate(() => !D.bedarfe[0].archiv && !!document.querySelector('#list-body tr[data-id]')), 'Rückgängig holt ihn zurück');
  await p.click('#list-body tr[data-id] .l-name', { modifiers: ['Control'] });
  ok(!(await p.$('.d-actions [data-act="del"]')) && await p.$$eval('.d-actions button', L => L.length) === 1, 'Kopf: nur noch „⋯“, Löschen steckt darin');
  await p.click('button[data-act="more"]'); await p.click('#mmenu button[data-act="del"]');
  await p.waitForSelector('.modal'); await p.click('.modal footer button.primary');
  ok(await p.evaluate(() => D.bedarfe.length === 0 && UI.view === 'list'), '„⋯“ → Bedarf löschen: nach Rückfrage gelöscht');
  await p.click('#toasts button.link');
  ok(await p.evaluate(() => D.bedarfe.length === 1), 'Löschen rückgängig gemacht');
  // ab 0.17: Verwendungsnachweis standardmäßig nötig (gespeicherte Daten einmalig umgestellt, Archiv und Fälle mit Frist nicht), „in Vorbereitung“ → geplant
  r = await p.evaluate(() => { const mk = arch => ({ id: 'x' + arch, titel: 'x', archiv: arch, foerderer: [{ name: 'A', status: 'vorb', vn: { noetig: false, frist: '', st: 'offen' } }, { name: 'B', status: 'zugesagt', vn: { noetig: false, frist: '2027-01-01', st: 'offen' } }] });
    const n = normalize({ meta: { savedAt: '2026-10-01T00:00:00Z', rev: 3 }, bedarfe: [mk(false), mk(true)] });
    const m = n.bedarfe[0].foerderer.map(f => f.vn.noetig + ':' + f.status).join();
    n.bedarfe[0].foerderer[0].vn.noetig = false; const again = normalize(JSON.parse(JSON.stringify(n)));
    return [m, n.bedarfe[1].foerderer[0].vn.noetig, n.meta.vnStd, again.bedarfe[0].foerderer[0].vn.noetig, normalize({ bedarfe: [mk(false)] }).bedarfe[0].foerderer[0].vn.noetig, ff({}).vn.noetig].join('|'); });
  ok(r === 'true:geplant,false:zugesagt|false|1|false|false|true', 'Verwendungsnachweis: neu standardmäßig nötig; gespeicherte Daten einmalig umgestellt (ohne Archiv, ohne Fälle mit Frist), danach bleibt „nicht nötig“; „in Vorbereitung“ wird geplant: ' + r);
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
