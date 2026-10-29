// 0.65: Vorschau zum Bearbeiten (anklicken, × entfernt), offene Punkte und Quellen unter die Beschreibung, Explorer-Pfad → SharePoint-Link
// 0.64: KI-Knopf in der Liste – „Bedarf aus Daten erstellen“ mit Copilot (Text einfügen) oder Cowork (Datei im Ordner „Förderrecherche“, meldet sich selbst)
const { chromium, ok, open, connect, writeF, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b);
  await connect(p);
  await p.evaluate(() => {
    personenSetzen([{ n: 'Thorsten Heß', fach: 'Notfallvorsorge', mail: 'th@x.example' }]);
    D.bedarfe.push(Object.assign(blank(), { id: 'alt', titel: 'Defibrillator Sanitätsdienst', gliederung: 'Brakel' })); changed(); renderNow();
  });

  // Knopf links neben „+ Bedarf“, nur in der Liste
  let r = await p.evaluate(() => { const k = document.querySelector('.actions .ki-liste'); return [!!k, k && k.nextElementSibling.dataset.act, !!k.querySelector('svg')]; });
  ok(r.join('|') === 'true|new|true', 'KI-Knopf links neben „+ Bedarf“: ' + r.join('|'));
  await p.click('.actions .ki-liste');
  r = await p.$$eval('.modal .ki-k', L => L.map(k => k.querySelector('b').textContent).join(','));
  ok(r === 'Bedarf aus Daten erstellen', 'Kacheln: ' + r);
  await p.click('.modal .ki-k[data-k="neu"]');
  await p.click('.modal button:text-is("Prompt ansehen")');
  r = await p.$eval('.modal .ki-prompt textarea', t => t.value);
  ok(r.includes('genau ein neuer Bedarf') && r.includes('Nichts erfinden, nichts schätzen') && r.includes('```text\n#BEDARF\nName:') && r.includes('#ZUSTÄNDIGE') && r.includes('Notfallvorsorge') && !r.includes('Neuer Bedarf_'),
    'Copilot-Prompt: ein Bedarf, nichts erfinden, fester Block, Fachreferate zur Auswahl');

  // Copilot-Antwort mit typischen Eigenheiten einlesen
  const antwort = ['Ich habe folgende Angaben gefunden …', '```text', '**#BEDARF**', '**Name:** Defibrillator für die Jugendgruppe', '- Ort: Malteser Hilfsdienst Brakel', 'Summe: ca. 2.450,00 €', 'Summe ist: Angebot',
    'Deadline: 31.03.2027', 'Prio: hoch | normal', 'Stichworte: AED, Jugend', 'Fachreferat: Notfallvorsorge', 'Ordner:', '#BESCHREIBUNG', 'Die Jugendgruppe braucht einen **AED** für Übungen.', '', '- Einsatz bei Ferienfreizeiten',
    '#FREIGABEN', 'Ortsführungskreis: zugestimmt am 12.10.2026', 'Fachreferat: angefragt am 20.10.2026', 'Verwaltung:', '#UNTERLAGEN', 'Angebot: vorhanden', 'Konzept: fehlt', 'Fotos: in Arbeit',
    '#ZUSTÄNDIGE', 'Name: Max Muster', 'Position: Ortsbeauftragter', 'E-Mail: max.muster@x.example', 'Telefon: 05272 1234', '', 'Name: Max Muster', '#FÖRDERER', 'Name: Sparkasse Höxter', 'Stand: beantragt', 'Summe: 1.000',
    '#QUELLEN', '- E-Mail von Max Muster, 10.10.2026', '#OFFEN', '- Verwaltung: nichts genannt', '```'].join('\n');
  await p.fill('.modal .ki-antwort textarea', antwort);
  await p.click('.modal button:text-is("Einlesen …")'); await p.waitForTimeout(200);
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, document.querySelector('.modal .nv-name').value, [...document.querySelectorAll('.modal .nv-warn li')].map(l => l.textContent).join(' / '),
    [...document.querySelectorAll('.modal .nv-dl dd')].map(d => d.textContent).slice(0, 4).join(' / '), document.querySelector('.modal .nv-offen').textContent]);
  ok(r[0] === 'Neuen Bedarf anlegen?' && r[1] === 'Defibrillator für die Jugendgruppe' && r[2].includes('Ähnlicher Bedarf schon vorhanden: „Defibrillator Sanitätsdienst“ (Brakel)')
    && r[3] === 'Brakel / 2.450 € (Angebot) / 31.03.2027 / hoch' === false && r[3].startsWith('Brakel / 2.450 € (Angebot) / 31.03.2027 / ☆ keine Prio') && r[4].includes('Verwaltung: nichts genannt'),
    'Vorschau: Name, Ort aus „Malteser Hilfsdienst Brakel“, Summe, Deadline, Prio nicht ausgefüllt = leer, ähnlicher Bedarf, offen laut KI: ' + r.join(' | '));
  // in der Vorschau ändern: Stichwort weg, eines dazu, Summe anklicken und ändern, Prio an, Förderer weg
  await p.click('.modal .nv-dl .pchip:has-text("Jugend") .x');
  await p.fill('.modal .nv-sw', 'Defi'); await p.press('.modal .nv-sw', 'Enter');
  await p.click('.modal .nv-dl dd.nv-e:has-text("2.450")'); await p.fill('.modal .nv-in', '2.600'); await p.press('.modal .nv-in', 'Enter');
  await p.click('.modal .nv-dl dd.nv-e:has-text("31.03.2027")'); await p.fill('.modal .nv-in', 'irgendwann'); await p.press('.modal .nv-in', 'Enter');
  await p.click('.modal .nv-prio');
  await p.click('.modal .nv-dl .pchip:has-text("Sparkasse") .x');
  r = await p.evaluate(() => [[...document.querySelectorAll('.modal .nv-dl dd')].map(d => d.textContent).slice(0, 5).join(' / '), !!document.querySelector('.modal .nv-offen input:checked'), !!document.querySelector('.modal .nv-q input:checked'),
    [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('Deadline: „irgendwann“ passt nicht'))]);
  ok(r.join('|') === 'Brakel / 2.600 € (Angebot) / 31.03.2027 / ★ hoch / AED×Defi×|true|true|true', 'Vorschau bearbeitet (Unpassendes bleibt beim alten Wert); offene Punkte und Quellen sind zum Übernehmen angehakt: ' + r.join('|'));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const x = cur(), F = x.freigabe;
    return [UI.view, x.titel, x.gliederung, x.summe, x.summeArt, x.deadline, x.prio, x.stichworte.join(','), F.fach.name, F.ofk.st + ':' + F.ofk.erledigt, F.fach.st + ':' + F.fach.angefragt, F.verw.st,
      x.unterlagen.map(u => u.name + ':' + u.st).join(','), x.zust.map(z => z.n + ':' + z.rolle + ':' + z.mail + ':' + z.tel).join(','), x.foerderer.map(f => f.name + ':' + f.status + ':' + f.betrag).join(','), x.link, x.beschreibung]; });
  ok(r.slice(0, 16).join('|') === 'detail|Defibrillator für die Jugendgruppe|Brakel|2600|Angebot|2027-03-31|hoch|AED,Defi|Notfallvorsorge|ok:2026-10-12|angefragt:2026-10-20|offen|Angebot:da,Interview:fehlt,Konzept:fehlt,Projektsteckbrief:fehlt,Fotos:arbeit|Max Muster:Ortsbeauftragter:max.muster@x.example:05272 1234||',
    'angelegt und geöffnet, alles übernommen, nichts dazuerfunden: ' + r.slice(0, 16).join('|'));
  ok(r[16] === 'Die Jugendgruppe braucht einen *AED* für Übungen.\n\n- Einsatz bei Ferienfreizeiten\n\n*Offen laut KI:*\n- Verwaltung: nichts genannt\n\n*Quellen:*\n- E-Mail von Max Muster, 10.10.2026', 'Beschreibung mit Formatierung, darunter offene Punkte und Quellen: ' + JSON.stringify(r[16]));
  await p.waitForSelector('.modal h2:text-is("In die Personenliste übernehmen?")', { timeout: 3000 }).catch(() => {});
  r = await p.evaluate(() => document.querySelector('.modal h2') && document.querySelector('.modal h2').textContent);
  ok(r === 'In die Personenliste übernehmen?', 'danach: neue Person für die Personenliste anbieten: ' + r);
  await p.click('.modal footer button:text-is("Nur für diesen Bedarf")');
  // Pfad aus dem Explorer ins Ordner-Feld → SharePoint-Link
  await p.fill('#sec-frei input[data-p="link"]', String.raw`C:\Users\ArndtMa3\OneDrive - MalteserCloud\Fundraising-Team - Diözese Paderborn - General\1601_Diözese_Pojekte\Ladesäulen`); await p.waitForTimeout(150);
  r = await p.evaluate(() => [cur().link, cur().pfad.split('\\').pop(), document.querySelector('#sec-frei input[data-p="link"]').value === cur().link, [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('in einen SharePoint-Link umgewandelt'))]);
  ok(r.join('|') === 'https://maltesercloud.sharepoint.com/sites/Fundraising-Team-DizesePaderborn/Freigegebene%20Dokumente/Forms/AllItems.aspx?id=%2Fsites%2FFundraising-Team-DizesePaderborn%2FFreigegebene%20Dokumente%2FGeneral%2F1601_Di%C3%B6zese_Pojekte%2FLades%C3%A4ulen|Ladesäulen|true|true',
    'Explorer-Pfad eingefügt: wird zum SharePoint-Link, der Pfad bleibt für Cowork gemerkt: ' + r.join('|'));
  ok(await p.evaluate(() => !document.querySelector('.actions .ki-liste') && !!document.querySelector('.ki-btn')), 'auf der Seite eines Bedarfs: kein zweiter KI-Knopf oben');
  await p.evaluate(() => zurueck()); await p.waitForTimeout(150);

  // nichts Brauchbares eingefügt
  await p.click('.actions .ki-liste'); await p.click('.modal .ki-k[data-k="neu"]');
  await p.fill('.modal .ki-antwort textarea', 'Ich konnte die Datei leider nicht öffnen.'); await p.click('.modal button:text-is("Einlesen …")'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !!document.querySelector('.modal .ki-antwort') && [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('Kein Bedarf gefunden'))), 'ohne Block: Hinweis, Fenster bleibt');

  // Cowork: Datei anlegen, Prompt nennt sie, ausgefüllt meldet sich die Liste
  await p.click('.modal .ki-wo button:text-is("Cowork")');
  await p.click('.modal button:text-is("Auftrag kopieren")'); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const n = Object.keys(__fs.files).find(k => /\/Förderrecherche\/Neuer Bedarf_.*\.txt$/.test(k)); return [n, n && new TextDecoder().decode(__fs.files[n].data), document.querySelector('.modal .ki-prompt textarea') ? document.querySelector('.modal .ki-prompt textarea').value : ''];});
  const datei = r[0] && r[0].split('/').pop();
  ok(!!datei && r[1].includes('#BEDARF\r\nName:\r\nOrt:') && r[1].includes('Summe ist:\r\n') && r[2].includes('„' + datei + '“') && r[2].includes('Mehrere Quellen'), 'Cowork: Datei mit leerem Aufbau angelegt, Prompt nennt sie: ' + datei);
  await p.click('.modal header .x');
  await p.evaluate(() => { eingangScan(); }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('.modal')), 'leere Datei: keine Meldung');
  await writeF(p, '﻿#BEDARF\r\nName: Zelt für den Katastrophenschutz\r\nOrt: Diözese\r\nSumme: 6.000\r\n#BESCHREIBUNG\r\nZelt aus drei Quellen.\r\n#OFFEN\r\n- Ansprechperson fehlt', 'Förderrecherche/' + datei);
  await p.evaluate(() => { eingangScan(); }); await p.waitForTimeout(250);
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, document.querySelector('.modal').textContent.includes('Zelt für den Katastrophenschutz'), document.querySelector('.actions .ki-liste').classList.contains('neu')]);
  ok(r.join('|') === 'Neuer Bedarf von Cowork|true|true', 'ausgefüllt: Liste meldet sich, Punkt am KI-Knopf: ' + r.join('|'));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(300);
  r = await p.evaluate(() => [cur().titel, cur().gliederung, cur().summe, einFertig().length, D.bedarfe.length]);
  ok(r.slice(0, 4).join('|') === 'Zelt für den Katastrophenschutz|Diözese|6000|1', 'Cowork-Bedarf angelegt und als übernommen gemerkt: ' + r.join('|'));
  await p.evaluate(() => { zurueck(); localStorage.removeItem('bl-eingang'); }); await p.waitForTimeout(150);
  await p.evaluate(() => { eingangScan(); }); await p.waitForTimeout(150);
  r = await p.evaluate(() => [!document.querySelector('.modal'), document.querySelector('.actions .ki-liste').classList.contains('neu')]);
  ok(r.join('|') === 'true|false', 'derselbe Stand wird nicht noch einmal gemeldet, Punkt weg: ' + r.join('|'));

  // „Später“: der Punkt bleibt, Meldung nur einmal
  await writeF(p, '#BEDARF\nName: Funkgeräte\nOrt: Hagen', 'Förderrecherche/Neuer Bedarf_x.txt');
  await p.evaluate(() => { eingangScan(); }); await p.waitForTimeout(200);
  await p.click('.modal footer button:text-is("Später")'); await p.waitForTimeout(100);
  await p.evaluate(() => { eingangScan(); }); await p.waitForTimeout(200);
  r = await p.evaluate(() => [!document.querySelector('.modal'), document.querySelector('.actions .ki-liste').classList.contains('neu')]);
  ok(r.join('|') === 'true|true', '„Später“: keine zweite Meldung, Punkt bleibt: ' + r.join('|'));
  await p.click('.actions .ki-liste'); await p.waitForSelector('.modal .ki-flag', { timeout: 3000 }).catch(() => {});
  ok(await p.evaluate(() => !!document.querySelector('.modal .ki-flag') && document.querySelector('.modal .ki-flag').textContent.includes('Funkgeräte')), 'im KI-Fenster oben: Hinweis auf den vorbereiteten Bedarf');

  await finish(b, [p]);
})();
