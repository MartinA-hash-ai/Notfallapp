// 0.143: E-Mail-Auswertung mit Copilot Cowork – Auftrag und Überblick im Ordner, Vorschläge einlesen, prüfen, übernehmen, rückgängig
const { chromium, ok, open, connect, writeF, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b);
  await connect(p);
  await p.evaluate(() => {
    const B = Object.assign(blank(), { id: 'b1', titel: 'Zelt für den Katastrophenschutz', gliederung: 'Brakel', summe: 6000 });
    B.foerderer.push(ff({ id: 'f1', name: 'Sparkasse Testhausen', status: 'beantragt', betrag: 3000 }), ff({ id: 'f2', name: 'Stiftung Test', status: 'geplant', betrag: 2000 }));
    D.bedarfe.push(B); changed(); renderNow();
  });
  // Auftrag und Überblick schreiben
  let r = await p.evaluate(async () => { await peSchreiben(true); const F = Object.keys(__fs.files); const t = n => { const k = F.find(x => x.endsWith('/Förderrecherche/' + n)); return k ? new TextDecoder().decode(__fs.files[k].data) : ''; };
    const a = t('Auftrag E-Mail-Auswertung.txt'), u = t('Überblick für Copilot.txt'); return [a.includes('Gesendete Elemente'), a.includes('=== VORSCHLAG ==='), /- zusage:/.test(a), /- freigabe:/.test(a), /- fl_frist:/.test(a), u.includes('[b1] Zelt für den Katastrophenschutz'), u.includes('[f1] Sparkasse Testhausen')]; });
  ok(r.join() === 'true,true,true,true,false,true,true', 'Auftragsdatei (A und B, C aus) und Überblick mit Kennungen im Ordner „Förderrecherche“: ' + r.join());
  r = await p.evaluate(() => PE_SATZ);
  ok(/Auftrag E-Mail-Auswertung\.txt/.test(r), 'Ein Satz für die geplante Aufgabe in Cowork: ' + r);
  // Vorschläge von Copilot
  await writeF(p, ['=== VORSCHLAG ===', 'Art: zusage', 'Bedarf: [b1]', 'Förderer: f1', 'Datum: 05.11.2026', 'Betrag: 3.000', 'Sicherheit: sicher', 'Mail: 05.11.2026 | Sparkasse | Ihr Antrag', 'Zitat: „Wir freuen uns, 3.000 € zu bewilligen.“', '',
    '=== VORSCHLAG ===', 'Art: freigabe', 'Bedarf: b1', 'Wert: ofk', 'Ergebnis: ok', 'Datum: 04.11.2026', 'Sicherheit: sicher', '',
    '=== VORSCHLAG ===', 'Art: uebergabe_termin', 'Bedarf: b1', 'Datum: 12.12.2026', 'Uhrzeit: 10:30', 'Ort: Wache Brakel', 'Sicherheit: sicher', '',
    '=== VORSCHLAG ===', 'Art: absage', 'Bedarf: b1', 'Förderer: f2', 'Grund: Budget erschöpft', 'Sicherheit: unsicher', '',
    '=== VORSCHLAG ===', 'Art: zusage', 'Bedarf: b9', 'Förderer: fx', 'Betrag: 500', 'Sicherheit: sicher'].join('\r\n'), 'Förderrecherche/Posteingang 2026-11-06.txt');
  await p.evaluate(() => peScan()); await p.waitForTimeout(250);
  r = await p.evaluate(() => [PE.L.length, (document.querySelector('header.top .pe-chip') || {}).textContent]);
  ok(r[0] === 5 && /5 Vorschläge aus E-Mails/.test(r[1]) && /2 unsicher/.test(r[1]), 'Hinweis oben: 5 Vorschläge aus E-Mails, 2 unsicher: ' + r.join('|'));
  await p.click('header.top .pe-chip'); await p.waitForSelector('.pe2-modal');
  r = await p.evaluate(() => [[...document.querySelectorAll('.pe2-rows .pe2-row')].map(z => z.querySelector('.pe2-ic').textContent + (z.querySelector('.pe2-dec') || {}).textContent).join(' / '), document.querySelector('.pe2-progress b').textContent, document.querySelector('.pe2-row.sel .pe2-what').textContent, document.querySelector('.pe2-los').textContent]);
  ok(r[0] === '✓übernehmen / ✓übernehmen / ✓übernehmen / !offen / ?offen' && r[1] === '3 von 5 entschieden' && /^Absage/.test(r[2]) && r[3] === '3 übernehmen', 'Prüffenster: sichere vorgewählt, unsichere und nicht zuzuordnende offen, Start beim ersten offenen: ' + r.join(' | '));
  r = await p.evaluate(() => [document.querySelector('.pe2-val.old').textContent, document.querySelector('.pe2-val.new').textContent, document.querySelector('.pe2-val.new').classList.contains('t-err'), document.querySelector('.pe2-crumb').textContent]);
  ok(r[0] === 'geplant · 2.000\u00a0€' && /^abgelehnt/.test(r[1]) && r[2] && /Zelt für den Katastrophenschutz \(Brakel\) › Förderplan › Stiftung Test/.test(r[3]), 'Rechts: Pfad, bisher → neu in der Farbe des Stands: ' + r.join(' | '));
  await p.keyboard.press('s'); await p.waitForTimeout(80);
  r = await p.evaluate(() => [document.querySelector('.pe2-row.sel .pe2-ic').textContent, !!document.querySelector('.pe2-zu select')]);
  ok(r.join() === '?,true', 'Taste S: später, weiter zum nicht zuzuordnenden – mit Auswahl des Bedarfs: ' + r.join());
  await p.keyboard.press('a'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => document.querySelector('.pe2-zu select').classList.contains('warn') && /Erst einen Bedarf wählen/.test(document.querySelector('.pe2-status').textContent)), 'Übernehmen ohne Bedarf: Hinweis „Erst einen Bedarf wählen“');
  await p.keyboard.press('Escape'); await p.keyboard.press('x'); await p.waitForTimeout(80);
  await p.click('.pe2-los'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const B = D.bedarfe.find(x => x.id === 'b1'), f = B.foerderer[0]; return [f.status, f.zugesagt, f.entscheidungAm, B.freigabe.ofk.st, B.freigabe.ofk.erledigt, B.nach.ueb.termin, B.nach.ueb.zeit, B.nach.ueb.ort, B.foerderer[1].status, PE.L.length, (document.querySelector('.pe-chip') || {}).textContent, (document.querySelector('.pe2-toast') || {}).textContent]; });
  ok(r.slice(0, 10).join('|') === 'zugesagt|3000|2026-11-05|ok|2026-11-04|2026-12-12|10:30|Wache Brakel|geplant|1' && /1 Vorschlag für später/.test(r[10]) && /3 Änderungen eingetragen/.test(r[11]), 'übernommen: Zusage, Freigabe, Termin; Absage bleibt für später, Ignoriertes ist weg; Meldung unten: ' + r.join('|'));
  await p.evaluate(() => peScan()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => PE.L.length) === 1, 'nach erneutem Lesen: nur der Vorschlag für später bleibt');
  await p.click('.pe2-undo'); await p.waitForSelector('.pe2-modal'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [D.bedarfe.find(x => x.id === 'b1').foerderer[0].status, document.querySelectorAll('.pe2-rows .pe2-row').length]);
  ok(r.join('|') === 'beantragt|5', '↶ Rückgängig: Änderungen zurück, Fenster wieder offen mit allen Vorschlägen: ' + r.join('|'));
  await p.click('.pe2-foot button:text-is("Alle verwerfen")'); await p.click('.pe2-los'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => PE.L.length === 0 && !document.querySelector('.pe-chip') && D.bedarfe.find(x => x.id === 'b1').foerderer[0].status === 'beantragt'), 'Alle verwerfen + bestätigen: nichts geändert, Hinweis weg');
  // „Keine Vorschläge“: kein Hinweis
  await writeF(p, 'Keine Vorschläge', 'Förderrecherche/Posteingang 2026-11-07.txt');
  await p.evaluate(() => peScan()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.querySelector('.pe-chip') && PE.letzte === 'Posteingang 2026-11-07.txt'), '„Keine Vorschläge“: kein Hinweis, letzter Lauf bekannt');
  // Einstellungen
  await p.evaluate(() => { einstellungen(); }); await p.waitForSelector('.einst-modal');
  await p.click('.einst-e[data-k="mail-ausw"]'); await p.waitForSelector('.pe-einst-modal');
  await p.click('.pe-eg:nth-of-type(3) .pe-eh input').catch(() => p.evaluate(() => document.querySelectorAll('.pe-eh input')[2].click()));
  await p.click('.pe-einst-modal footer button.primary'); await p.waitForTimeout(300);
  r = await p.evaluate(() => [D.settings.mailAusw.C, /- fl_frist:/.test(peAuftragText())]);
  ok(r.join() === 'true,true', 'Einstellungen: Gruppe C eingeschaltet → Auftrag sucht auch neue Fristen: ' + r.join());
  await finish(b, [p]);
})();
