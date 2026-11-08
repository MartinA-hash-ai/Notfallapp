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
  ok(r[0] === 5 && /5 Vorschläge aus E-Mails/.test(r[1]), 'Hinweis oben: 5 Vorschläge aus E-Mails: ' + r.join('|'));
  await p.click('header.top .pe-chip'); await p.waitForSelector('.pe-modal');
  r = await p.evaluate(() => [...document.querySelectorAll('.pe-z')].map(z => (z.querySelector('input').checked ? '+' : '-') + (z.querySelector('input').disabled ? 'x' : '') + z.querySelector('.pe-zt b').textContent).join(' / '));
  ok(r === '+Zusage / +Freigabe (OFK, Fachreferat, Verwaltung) / +Termin der Spendenübergabe / -Absage / -xZusage', 'Prüffenster: sichere vorgewählt, unsichere nicht, nicht zuzuordnende gesperrt: ' + r);
  await p.click('.pe-modal footer button.primary'); await p.waitForTimeout(250);
  r = await p.evaluate(() => { const B = D.bedarfe.find(x => x.id === 'b1'), f = B.foerderer[0]; return [f.status, f.zugesagt, f.entscheidungAm, B.freigabe.ofk.st, B.freigabe.ofk.erledigt, B.nach.ueb.termin, B.nach.ueb.zeit, B.nach.ueb.ort, B.foerderer[1].status, PE.L.length, !document.querySelector('.pe-chip')]; });
  ok(r.join('|') === 'zugesagt|3000|2026-11-05|ok|2026-11-04|2026-12-12|10:30|Wache Brakel|geplant|0|true', 'übernommen: Zusage mit Betrag, Freigabe OFK, Übergabe-Termin; Absage (nicht angehakt) bleibt; Hinweis weg: ' + r.join('|'));
  await p.evaluate(() => peScan()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => PE.L.length) === 0, 'dieselbe Datei wird nicht noch einmal gemeldet');
  await p.click('.toast button'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => D.bedarfe.find(x => x.id === 'b1').foerderer[0].status) === 'beantragt', '↶ macht die Übernahme rückgängig');
  await p.evaluate(() => peScan()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => PE.L.length) === 5, 'nach ↶ stehen die Vorschläge wieder zur Prüfung bereit');
  await p.click('header.top .pe-chip'); await p.waitForSelector('.pe-modal'); await p.click('.pe-modal footer button:text-is("Verwerfen")'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => PE.L.length === 0 && D.bedarfe.find(x => x.id === 'b1').foerderer[0].status === 'beantragt'), 'Verwerfen: nichts geändert, Hinweis weg');
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
