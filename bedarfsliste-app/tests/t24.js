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
  r = await p.evaluate(() => [peSatz(), peEinweisung(), peAuftragText()]);
  ok(/Auftrag E-Mail-Auswertung\.txt/.test(r[0]) && /HINTERGRUND/.test(r[1]) && /Probelauf/.test(r[1]) && r[1].includes(r[0]) && /KEINE geplante Aufgabe/.test(r[1]) && /- koordination:/.test(r[2]) && /Gesendete/.test(r[2]), 'Satz für den Wochenlauf und Einweisung (Zugriff, Probelauf, keine geplante Aufgabe); Auftrag sucht auch Koordination: ' + r[0]);
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
  r = await p.evaluate(() => [[...document.querySelectorAll('.pe2-rows .pe2-row')].map(z => z.querySelector('.pe2-ic').className.replace('pe2-ic k-', '') + (z.querySelector('.pe2-hw') ? ':' + z.querySelector('.pe2-hw').textContent : '')).join(' / '), document.querySelector('.pe2-progress b').textContent, document.querySelector('.pe2-row.sel .pe2-who').textContent, document.querySelector('.pe2-los').textContent]);
  ok(r[0] === 'accept / accept / accept / open:unsicher / open:ohne Bedarf' && r[1] === '3 von 5 entschieden' && /^Absage/.test(r[2]) && r[3] === '3 übernehmen', 'Prüffenster: sichere vorgewählt, unsichere und nicht zuzuordnende offen, Start beim ersten offenen: ' + r.join(' | '));
  r = await p.evaluate(() => [...document.querySelectorAll('.pe2-rows .pe2-gk')].map(g => g.querySelector('.pe2-gt').textContent + ' – ' + g.querySelector('.pe2-gn').textContent));
  ok(r.length === 2 && /^Zelt für den Katastrophenschutz · Brakel – 4 Änderungen · 1 offen$/.test(r[0]) && /^Ohne Bedarf/.test(r[1]), '0.149: links nach Vorgang gruppiert (ein Kopf je Bedarf): ' + r.join(' | '));
  const kreis = () => p.evaluate(() => document.querySelector('.pe2-rows .pe2-row .pe2-ic').className.replace('pe2-ic k-', ''));
  const folge = []; for (let i = 0; i < 4; i++) { await p.click('.pe2-rows .pe2-row .pe2-ic >> nth=0'); await p.waitForTimeout(40); folge.push(await kreis()); }
  ok(folge.join() === 'reject,later,open,accept', '0.151: Kreis = Entscheidung, Klick schaltet ✓ → ✕ → später → offen → ✓: ' + folge.join());
  await p.click('.pe2-row:has-text("Absage")'); await p.waitForTimeout(60);
  r = await p.evaluate(() => [document.querySelector('.pe2-val.old').textContent, document.querySelector('.pe2-val.new').textContent, document.querySelector('.pe2-val.new').classList.contains('t-err'), document.querySelector('.pe2-crumb').textContent]);
  ok(r[0] === 'geplant · 2.000\u00a0€' && /^abgelehnt/.test(r[1]) && r[2] && r[3] === 'bei Stiftung Test', 'Rechts: nur noch der Förderer (kein Pfad), bisher → neu in der Farbe des Stands: ' + r.join(' | '));
  await p.keyboard.press('s'); await p.waitForTimeout(80);
  r = await p.evaluate(() => [document.querySelector('.pe2-row.sel .pe2-hw').textContent, !!document.querySelector('.pe2-zu .pe2-sf-in')]);
  ok(r.join() === 'ohne Bedarf,true', 'Taste S: später, weiter zum nicht zuzuordnenden – mit Auswahl des Bedarfs: ' + r.join());
  await p.keyboard.press('a'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => document.querySelector('.pe2-zu .pe2-sf-in').classList.contains('warn') && /Erst einen Bedarf wählen/.test(document.querySelector('.pe2-status').textContent)), 'Übernehmen ohne Bedarf: Hinweis „Erst einen Bedarf wählen“');
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
  // 0.146: Vorgang ohne Bedarf und Förderer im Überblick → im Prüffenster neuen Bedarf und Förderer anlegen
  await writeF(p, ['=== VORSCHLAG ===', 'Art: antrag', 'Vorhaben: Drohne für den Bevölkerungsschutz', 'Gliederung: Geseke', 'Förderername: Teststiftung Nord', 'Datum: 01.11.2026', 'Antwort bis: 03.12.2026', 'Sicherheit: unsicher', 'Mail: 06.11.2026 | info@teststiftung.example | Ihr Antrag', 'Zitat: „Ihr Antrag kommt am 03.12.2026 vor das Gremium.“'].join('\n'), 'Förderrecherche/Posteingang 2026-11-05.txt');
  await p.evaluate(() => peScan()); await p.waitForTimeout(200);
  await p.click('header.top .pe-chip'); await p.waitForSelector('.pe2-modal');
  await p.click('.pe2-zu .pe2-sf-in'); await p.waitForTimeout(60);
  r = await p.evaluate(() => [document.querySelector('.pe2-row.sel .pe2-hw').textContent === 'ohne Bedarf' ? '?' : 'x', String(!document.querySelector('.pe2-crumb')), document.querySelector('.pe2-sf-o b').textContent]);
  ok(r[0] === '?' && r[1] === 'true' && /^＋ Neuer Bedarf: „Drohne für den Bevölkerungsschutz“ \(Geseke\)$/.test(r[2]), 'nicht zuzuordnen: erkannter Förderer und Vorhaben, Auswahl „＋ Neuer Bedarf“: ' + r.join(' | '));
  // 0.149: Suchfeld statt Auswahlliste – leer alle Bedarfe, Suchwörter filtern (auch nach Förderer)
  r = await p.evaluate(() => [document.querySelectorAll('.pe2-sf-o').length, D.bedarfe.filter(b => !b.archiv).length]);
  ok(r[0] === r[1] + 1, 'Suchfeld leer: alle Bedarfe + „Neu“ zum Blättern: ' + r.join('|'));
  await p.keyboard.type('zelt brakel'); await p.waitForTimeout(60);
  r = await p.evaluate(() => [...document.querySelectorAll('.pe2-sf-o b')].map(o => o.textContent));
  ok(r.length === 2 && /Zelt/.test(r[1]), 'Suche „zelt brakel“: nur der passende Bedarf (+ Neu): ' + r.join('|'));
  await p.fill('.pe2-zu .pe2-sf-in', 'stiftung test'); await p.waitForTimeout(60);
  r = await p.evaluate(() => [...document.querySelectorAll('.pe2-sf-o')].map(o => o.textContent));
  ok(r.length >= 2 && r.slice(1).every(t => /Stiftung Test/.test(t)), 'Suche nach Förderer findet den Bedarf: ' + r.length);
  await p.fill('.pe2-zu .pe2-sf-in', 'xyzxyz'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => /Kein Bedarf gefunden/.test(document.querySelector('.pe2-sf-l').textContent)), 'Suche ohne Treffer: Hinweis, „Neu“ bleibt');
  await p.click('.pe2-sf-o.neu'); await p.waitForTimeout(80);
  r = await p.evaluate(() => [document.querySelectorAll('.pe2-sf-in')[0].value, document.querySelector('.pe2-val.new').textContent, !document.querySelector('.pe2-neuhw') && /angelegt/.test(document.querySelector('.pe2-sf-notiz').textContent) && document.querySelector('.pe2-sf-in').classList.contains('gesetzt'), document.querySelectorAll('.pe2-sf-in')[1].value]);
  ok(/^Neu: Drohne für den Bevölkerungsschutz \(Geseke\)/.test(r[0]) && /Entscheidung bis 03\.12\.2026/.test(r[1]) && r[2] && /Teststiftung Nord/.test(r[3]), 'Neuer Bedarf gewählt: Feld grün „Neu: …“, kein lila Kasten, Förderer neu aus der Mail, Entscheidung bis: ' + r.join(' | '));
  await p.keyboard.press('a'); await p.waitForTimeout(80); await p.click('.pe2-los'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const B = D.bedarfe.find(x => x.titel === 'Drohne für den Bevölkerungsschutz'); return B ? [B.gliederung, B.foerderer.map(f => f.name + ':' + f.status + ':' + f.beantragtAm + ':' + f.erwartet).join(), 'peNeu' in B] : ['fehlt']; });
  ok(r.join('|') === 'Geseke|Teststiftung Nord:beantragt:2026-11-01:2026-12-03|false', 'übernommen: neuer Bedarf mit neuem Förderer, beantragt, Entscheidung bis: ' + r.join('|'));
  // 0.150: mehrere Mails eines Vorhabens – Bedarf einmal wählen, Förderer beim Bedarf vorausgewählt (nicht neu)
  await writeF(p, ['=== VORSCHLAG ===', 'Art: zusage', 'Vorhaben: Zelt Brakel', 'Förderername: Sparkasse Testhausen', 'Betrag: 3000', 'Sicherheit: sicher', 'Mail: 03.11.2026 | Erste Absenderin | Zusage', '',
    '=== VORSCHLAG ===', 'Art: antrag', 'Vorhaben: Zelt Brakel', 'Förderername: Sparkasse Testhausen', 'Datum: 01.11.2026', 'Sicherheit: sicher', 'Mail: 01.11.2026 | Zweiter Absender | Antrag'].join('\n'), 'Förderrecherche/Posteingang 2026-11-04.txt');
  await p.evaluate(() => peScan()); await p.waitForTimeout(200);
  await p.click('header.top .pe-chip'); await p.waitForSelector('.pe2-modal');
  await p.waitForTimeout(150); await p.click('.pe2-zu .pe2-sf-in'); await p.keyboard.type('zelt brakel'); await p.waitForTimeout(60); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [...document.querySelectorAll('.pe2-sf-in')].map(i => i.value + (i.classList.contains('gesetzt') ? '+' : '')).concat([...document.querySelectorAll('.pe2-sf-notiz')].map(n => n.textContent)));
  ok(r[0] === 'Zelt für den Katastrophenschutz+' && r[1] === 'Sparkasse Testhausen+' && r.includes('✓ aus der Mail erkannt'), 'Förderer schon beim Bedarf: vorausgewählt statt „＋ Neu“: ' + r.join('|'));
  await p.click('.pe2-row:not(.sel) >> nth=0'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.querySelector('.pe2-sf-in').value, [...document.querySelectorAll('.pe2-sf-notiz')].map(n => n.textContent).join('/')]);
  ok(r[0] === 'Zelt für den Katastrophenschutz' && /✓ aus erster Mail übernommen/.test(r[1]), 'zweite Mail desselben Vorhabens: Bedarf übernommen mit Hinweis dahinter: ' + r.join('|'));
  await p.click('.pe2-foot button:text-is("Alle verwerfen")'); await p.click('.pe2-los'); await p.waitForTimeout(250);
  // „Keine Vorschläge“: kein Hinweis
  await writeF(p, 'Keine Vorschläge', 'Förderrecherche/Posteingang 2026-11-07.txt');
  await p.evaluate(() => peScan()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.querySelector('.pe-chip') && PE.laeufe.some(l => l.datum === '2026-11-07' && /Keine Vorschläge/.test(l.erg))), '„Keine Vorschläge“ (ältere Einzeldatei): kein Hinweis, Lauf bekannt');
  // 0.147: eine feste Datei „Posteingang.txt“ mit Läufen; Anzeige „geprüft …“ auch ohne Vorschläge
  ok(await p.evaluate(() => Object.keys(__fs.files).some(k => k.endsWith('/Förderrecherche/Posteingang.txt')) && /Lege je Lauf eine NEUE Textdatei in deinem Arbeitsordner an \(OneDrive „Dokumente\/Cowork“\)/.test(peAuftragText()) && /Schreibe NICHT in den SharePoint-Ordner/.test(peAuftragText()) && /##### LAUF/.test(peAuftragText()) && /^LETZTER LAUF: /m.test(peUeberblickText())), 'Programm legt „Posteingang.txt“ an; Auftrag (0.157): je Lauf eine neue Datei in „Dokumente/Cowork“, nichts in SharePoint; Überblick mit LETZTER LAUF');
  const heute = await p.evaluate(() => today());
  await writeF(p, ['POSTEINGANG – Kopf', '##### LAUF ' + heute + ' 06:02 #####', 'Lauf-Ergebnis: Keine Vorschläge'].join('\r\n'), 'Förderrecherche/Posteingang.txt');
  await p.evaluate(() => peScan()); await p.waitForTimeout(250);
  r = await p.evaluate(() => [(document.querySelector('header.top .pe-stat') || {}).textContent, !!document.querySelector('header.top .pe-chip')]);
  ok(/geprüft heute 06:02/.test(r[0]) && !r[1], 'Lauf ohne Ergebnis: oben „geprüft heute 06:02 ✓“: ' + r.join('|'));
  await writeF(p, ['POSTEINGANG – Kopf', '##### LAUF ' + heute + ' 06:02 #####', 'Lauf-Ergebnis: Keine Vorschläge', '', '##### LAUF ' + heute + ' 09:15 #####', 'Lauf-Ergebnis: 1 Vorschlag', '=== VORSCHLAG ===', 'Art: zusage', 'Bedarf: b1', 'Förderer: f2', 'Betrag: 2000', 'Sicherheit: sicher', 'Mail: 06.11.2026 | Stiftung Test | Zusage'].join('\r\n'), 'Förderrecherche/Posteingang.txt');
  await p.evaluate(() => peScan()); await p.waitForTimeout(250);
  r = await p.evaluate(() => [PE.L.length, PE.L[0] && PE.L[0].key, (document.querySelector('header.top .pe-chip') || {}).textContent]);
  ok(r[0] === 1 && /^L.* 09:15#0$/.test(r[1]) && /1 Vorschlag aus E-Mails/.test(r[2]), 'angehängter Lauf: neuer Vorschlag erkannt (Kennung je Lauf): ' + r.join('|'));
  await p.click('header.top .pe-chip'); await p.waitForSelector('.pe2-modal'); await p.click('.pe2-los'); await p.waitForTimeout(250);
  await p.evaluate(() => peScan()); await p.waitForTimeout(200);
  r = await p.evaluate(() => [PE.L.length, D.bedarfe.find(x => x.id === 'b1').foerderer[1].status, (document.querySelector('header.top .pe-stat') || {}).textContent]);
  ok(r[0] === 0 && r[1] === 'zugesagt' && /geprüft heute 09:15/.test(r[2]), 'übernommen; dieselbe Datei meldet ihn nicht erneut; Anzeige zeigt den letzten Lauf: ' + r.join('|'));
  await p.click('header.top .pe-stat'); r = await p.evaluate(() => [...document.querySelectorAll('.pe-laeufe .pe-lz')].map(x => x.textContent).join(' / ')); await p.keyboard.press('Escape');
  ok(/09:15.*1 Vorschlag.*06:02.*Keine Vorschläge/.test(r), 'Klick: Liste der letzten Läufe: ' + r);
  // 0.148: Mail „Danke für Ihr Kommen heute … Pressetext“ → Übergabe erledigt mit Vertreter vor Ort; Presse-Person ausgewählt statt Notiz
  await p.evaluate(() => { personenSetzen([{ n: 'Anke Beispiel', rolle: 'Referentin Presse', fach: 'Presse und Öffentlichkeit', mail: 'a@x.example' }]); const B = D.bedarfe.find(x => x.id === 'b1'); B.foerderer[0].kontakte = [Object.assign(leerK(), { n: 'Michael Testmann', rolle: 'Regionalleitung' })]; B.foerderer[0].status = 'zugesagt'; changed(); });
  const tx = await p.evaluate(() => new TextDecoder().decode(__fs.files[Object.keys(__fs.files).find(k => k.endsWith('/Förderrecherche/Posteingang.txt'))].data));
  await writeF(p, tx + ['', '##### LAUF ' + heute + ' 10:00 #####', 'Lauf-Ergebnis: 2 Vorschläge', '=== VORSCHLAG ===', 'Art: uebergabe_erfolgt', 'Bedarf: b1', 'Förderername: Sparkasse Testhausen', 'Person: Herr Testmann', 'Datum: 09.11.2026', 'Sicherheit: sicher', 'Mail: 09.11.2026 | Anke Beispiel | Pressetext',
    '=== VORSCHLAG ===', 'Art: presse', 'Bedarf: b1', 'Person: Anke Beispiel', 'Wert: Pressemitteilung, Entwurf an Förderer zur Abstimmung', 'Sicherheit: sicher', 'Mail: 09.11.2026 | Anke Beispiel | Pressetext'].join('\r\n'), 'Förderrecherche/Posteingang.txt');
  await p.evaluate(() => peScan()); await p.waitForTimeout(200);
  await p.click('header.top .pe-chip'); await p.waitForSelector('.pe2-modal'); await p.click('.pe2-los'); await p.waitForTimeout(250);
  r = await p.evaluate(() => { const B = D.bedarfe.find(x => x.id === 'b1'), u = B.nach.ueb, f = B.foerderer[0]; return [u.st, u.termin, (u.einl[f.id] || {}).zu, (u.vorOrt[f.id] || {}).n, (u.vorOrt[f.id] || {}).pos, presseGewaehlt(B).map(p => p.n).join(), /Entwurf an Förderer/.test(u.info)]; });
  ok(r.join('|') === 'erledigt|2026-11-09|ja|Michael Testmann|Regionalleitung|Anke Beispiel|true', 'Übergabe erledigt, Förderer kommt, Vertreter vor Ort aus den Kontakten; Presse-Person ausgewählt: ' + r.join('|'));
  r = await p.evaluate(() => [kGleich({ n: 'Birgitt Pohle' }, { n: 'Birgit Pohle' }), kGleich({ n: 'Frau Pohle', mail: 'b@x.example' }, { n: 'Birgitt Pohle', mail: 'B@x.example' }), kGleich({ n: 'Birgitt Pohle' }, { n: 'Anna Pohle' })]);
  ok(r.join() === 'true,true,false', '„Neuer Kontakt“ nur bei wirklich neuer Person (andere Schreibweise, gleiche E-Mail zählen als dieselbe): ' + r.join());
  // Einstellungen
  await p.evaluate(() => { einstellungen(); }); await p.waitForSelector('.einst-modal');
  await p.click('.einst-e[data-k="mail-ausw"]'); await p.waitForSelector('.pe-einst-modal');
  await p.click('.pe-eg:nth-of-type(3) .pe-eh input').catch(() => p.evaluate(() => document.querySelectorAll('.pe-eh input')[2].click()));
  await p.click('.pe-einst-modal footer button.primary'); await p.waitForTimeout(300);
  r = await p.evaluate(() => [D.settings.mailAusw.C, /- fl_frist:/.test(peAuftragText())]);
  ok(r.join() === 'true,true', 'Einstellungen: Gruppe C eingeschaltet → Auftrag sucht auch neue Fristen: ' + r.join());
  // 0.157: je Lauf eine Datei im Arbeitsordner von Copilot (OneDrive „Dokumente/Cowork“, auch Unterordner)
  await p.evaluate(async () => { const o = await showDirectoryPicker(); __fs.files['/Ordner/Cowork/Ergebnisse/Posteingang_LAUF_2026-11-20_06-05.txt'] = { data: new TextEncoder().encode('\ufeff##### LAUF 2026-11-20 06:05 #####\nLauf-Ergebnis: 1 Vorschlag\n\n=== VORSCHLAG ===\nArt: zusage\nBedarf: b1\nFörderer: f2\nBetrag: 2500\nSicherheit: sicher\nMail: 19.11.2026 | Stiftung Test | Zusage'), lm: 99001 };
    __fs.files['/Ordner/Cowork/Notiz.txt'] = { data: new TextEncoder().encode('x'), lm: 99002 };
    PE.cw = await o.getDirectoryHandle('Cowork'); D.settings.coworkOrdner = 'Cowork'; await peScan(); });
  await p.waitForTimeout(400);
  r = await p.evaluate(() => [PE.L.filter(v => /^L2026-11-20 06:05#/.test(v.key)).length, PE.laeufe.some(l => l.datum === '2026-11-20' && l.zeit === '06:05'), /##### LAUF 2026-11-20 06:05 #####/.test(new TextDecoder().decode(__fs.files['/Ordner/Förderrecherche/Posteingang.txt'].data))]);
  ok(r.join('|') === '1|true|true', 'Cowork-Ordner: Datei aus dem Unterordner eingelesen, Lauf bekannt, unverändert an Posteingang.txt angehängt: ' + r.join('|'));
  await p.evaluate(() => peScan()); await p.waitForTimeout(300);
  r = await p.evaluate(() => [PE.L.filter(v => /^L2026-11-20 06:05#/.test(v.key)).length, (new TextDecoder().decode(__fs.files['/Ordner/Förderrecherche/Posteingang.txt'].data).match(/LAUF 2026-11-20 06:05/g) || []).length]);
  ok(r.join('|') === '1|1', 'zweites Einlesen: nicht doppelt angezeigt und nicht doppelt angehängt: ' + r.join('|'));
  // 0.158: tief verschachtelt (Tasks/<Aufgabe>/output), Betrag mit Komma
  await p.evaluate(async () => { __fs.files['/Ordner/Cowork/Tasks/Aufgabe-2026-11-21/output/Posteingang_LAUF_2026-11-21_06-05.txt'] = { data: new TextEncoder().encode('##### LAUF 2026-11-21 06:05 #####\r\nLauf-Ergebnis: 1 Vorschlag\r\n=== VORSCHLAG ===\r\nArt: zusage\r\nBedarf: b1\r\nFörderer: f2\r\nBetrag: 4994,97\r\nSicherheit: sicher'), lm: 99003 }; await peScan(); });
  r = await p.evaluate(() => { const v = PE.L.find(x => /^L2026-11-21 06:05#/.test(x.key)); return [!!v, v && peBetrag(v.betrag), PE.cwInfo.n]; });
  ok(r.join('|') === 'true|4994.97|2', 'Cowork: Datei in Tasks/…/output gefunden, Betrag 4994,97 gelesen, Zähler für die Einstellungen: ' + r.join('|'));
  // 0.159: „Jetzt abholen“ sagt, was gefunden wurde
  await p.evaluate(() => { peEinstDialog(); }); await p.waitForSelector('.pe-cw-info'); await p.waitForTimeout(200);
  await p.click('.pe-cw button.link:text-is("Jetzt abholen")'); await p.waitForTimeout(500);
  r = [await p.evaluate(() => document.querySelector('.pe-cw-info').textContent)];
  await p.evaluate(async () => { for (const k of Object.keys(__fs.files)) if (k.startsWith('/Ordner/Cowork/') && /LAUF/.test(k)) delete __fs.files[k]; });
  await p.click('.pe-cw button.link:text-is("Jetzt abholen")'); await p.waitForTimeout(500);
  r.push(await p.evaluate(() => document.querySelector('.pe-cw-info').textContent));
  ok(/^Gefunden: 2 Lauf-Dateien, zuletzt „Posteingang_LAUF_2026-11-21_06-05\.txt“/.test(r[0]) && /Keine Datei „Posteingang_LAUF_…“ gefunden.*liegt: Notiz\.txt/.test(r[1]), 'Jetzt abholen: Rückmeldung mit Fund bzw. mit dem Inhalt des Ordners: ' + r.join(' || '));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  r = await p.evaluate(async () => { __fs.perm = 'prompt'; await peScan(); renderNow(); return [PE.cwZ, (document.querySelector('header.top [data-act="pe-cw-erlauben"]') || {}).textContent || '']; });
  await p.evaluate(() => { __fs.perm = 'granted'; });
  ok(r[0] === 'zugriff', 'ohne Freigabe des Browsers: Zustand „zugriff“ (Knopf oben, wenn keine Vorschläge offen): ' + r.join('|'));
  // 0.160: gemeldeter neuer Bedarf = normaler Vorschlag, „Neu: …“ vorgewählt, beim Übernehmen angelegt
  await p.evaluate(() => { __fs.perm = 'granted'; for (const k of Object.keys(__fs.files)) if (k.startsWith('/Ordner/Cowork/')) delete __fs.files[k]; });
  await writeF(p, ['=== VORSCHLAG ===', 'Art: neuer_bedarf', 'Vorhaben: LKW-Führerscheine Einsatzdienste', 'Gliederung: Geseke', 'Betrag: 2400', 'Wert: Anfrage, ob LKW-Führerscheinerweiterungen förderbar sind.', 'Sicherheit: unsicher', 'Mail: 10.11.2026 | Kollege | Führerscheine'].join('\n'), 'Förderrecherche/Posteingang 2026-11-03.txt');
  await p.evaluate(() => peScan()); await p.waitForTimeout(250);
  r = await p.evaluate(() => { const v = PE.L.find(x => x.art === 'neuer_bedarf'); return v ? peKind(v, peWirkung(v, {})) : 'fehlt'; });
  ok(r === 'unassigned', 'neuer Bedarf ist ein normaler Vorschlag (kein reiner Hinweis): ' + r);
  await p.click('header.top .pe-chip'); await p.waitForSelector('.pe2-modal'); await p.waitForTimeout(150);
  await p.click('.pe2-row:has-text("Neuer Bedarf angemeldet")'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.querySelector('.pe2-sf-in').value, document.querySelector('.pe2-val.new').textContent, PE.L.filter(x => x.art === 'neuer_bedarf').some(x => peKind(x, peWirkung(x, {})) === 'info')]);
  ok(r[0] === 'Neu: LKW-Führerscheine Einsatzdienste (Geseke)' && /wird angelegt/.test(r[1]) && !r[2], 'Prüffenster: „Neu: …“ vorgewählt, nicht mehr unter „nur Info“: ' + r.join(' | '));
  await p.keyboard.press('a'); await p.waitForTimeout(80); await p.click('.pe2-los'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const B = D.bedarfe.find(x => x.titel === 'LKW-Führerscheine Einsatzdienste'); return B ? [B.gliederung, B.summe, B.beschreibung] : ['fehlt']; });
  ok(r.join('|') === 'Geseke|2400|Anfrage, ob LKW-Führerscheinerweiterungen förderbar sind.', 'übernommen: neuer Bedarf mit Gliederung, Summe und Beschreibung: ' + r.join('|'));
  // 0.161: Koordination aus E-Mails (auch Gesendete): Interview angestoßen, Angebot liegt vor
  r = await p.evaluate(() => { const B = D.bedarfe.find(x => x.id === 'b1'), I = koItems(B);
    const v1 = { art: 'koordination', bedarf: 'b1', wert: 'Interview', ergebnis: 'in Arbeit' }, v2 = { art: 'koordination', bedarf: 'b1', wert: 'Angebot', ergebnis: 'erledigt' };
    const w1 = peWirkung(v1), w2 = peWirkung(v2); w1.fn(); w2.fn(); return [w1.nachher, w2.nachher, I.map(u => u.name + ':' + u.st).join(',')]; });
  ok(r.join('|') === 'Interview: in Arbeit|Angebot: liegt vor|Interview:arbeit,Angebot:da,Konzept:fehlt', 'Koordination aus E-Mails: Interview in Arbeit, Angebot liegt vor: ' + r.join('|'));
  // 0.161: Wochenlauf – ab Freitag gelb, Klick bietet den Auftrag zum Kopieren
  r = await p.evaluate(() => { const res = [];
    for (const [t, lauf] of [['2026-11-13', '2026-11-06'], ['2026-11-12', '2026-11-06'], ['2026-11-13', '2026-11-10']]) { PE.laeufe = [{ datum: lauf, zeit: '06:00', erg: 'Keine Vorschläge' }]; res.push(peFaellig(t)); }
    PE.laeufe = [{ datum: '2026-11-06', zeit: '06:00', erg: 'Keine Vorschläge' }]; return res; });
  ok(r.join() === 'true,false,false', 'Wochenlauf: Freitag ohne Lauf in dieser Woche fällig, Donnerstag noch nicht, mit Lauf diese Woche nicht: ' + r.join());
  await p.evaluate(() => { PE.L = []; renderNow(); }); await p.click('header.top .pe-stat'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !!document.querySelector('.pe-laeufe .pe-kopie')), 'Klick aufs Brief-Symbol: „Auftrag für Cowork kopieren“');
  await finish(b, [p]);
})();
