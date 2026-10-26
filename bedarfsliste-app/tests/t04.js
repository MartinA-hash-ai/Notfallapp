// Förderplan-Excel: Vorlage je Bedarf, leere Vorlage aus dem Build, Übernahme einer ausgefüllten Excel (neu, ergänzen, überschreiben, rückgängig)
const { chromium, ok, open, finish, fs, T } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  await p.evaluate(() => {
    const x = blank(); Object.assign(x, { titel: 'Testbedarf / MTW', gliederung: 'Paderborn', summe: 20000, deadline: '2027-06-30', beschreibung: 'Fahrzeug' });
    x.foerderer.push(ff({ name: 'Stiftung A', betrag: 5000, frist: '2027-01-15', einsch: 'w', warum: 'passt' }));
    D.bedarfe.push(x); UI.view = 'detail'; UI.id = x.id; renderNow();
  });
  let r = await p.evaluate(async () => { const g = await readFoerderplan(await vorlageBlob(cur()).arrayBuffer()); const i = g.items[0]; return [g.items.length, i.name, i.frist, i.betrag, i.einsch, i.warum, g.kennung === cur().id, g.sheet]; });
  ok(r.join('|') === '1|Stiftung A|2027-01-15|5000|w|passt|true|Förderplan', 'Vorlage je Bedarf: Förderplan und Kennung lassen sich zurücklesen: ' + r.join('|'));
  r = await p.evaluate(async () => { const bk = await xlsxBook(await vorlageBlob(cur()).arrayBuffer()), rows = bk.sheets[0].rows, val = k => (rows.find(x => x[0] === k) || [])[1];
    return [bk.sheets.filter(x => !x.hidden).map(x => x.name).join('+'), val('Summe (€)'), val('Noch offen (€)'), val('Stichwort oder Fördertopf') ?? '', rows.findIndex(x => x[0] === 'Förderer') + 1, rows[FP_HEAD_ROW - 1][1], rows[FP_HEAD_ROW][1],
      bk.sheets[1].rows.map(x => x[0]).join(' ').includes('5 bis 8 Förderer')]; });
  ok(r.join('|') === 'Förderplan+Anleitung|20000|20000||15|Stand in der Bedarfsliste|geplant|true', 'Excel beschreibt den Bedarf mit Finanzierung, Förderer mit Stand, Anleitung mit Umfang: ' + r.join('|'));
  ok(await p.evaluate(() => { const f = ff({ name: 'X' }); applyResearch(f, { stand: 'zugesagt', warum: 'w' }, 'all'); return f.stand === undefined && f.warum === 'w'; }), 'Spalte „Stand“ wird nicht eingelesen');
  // Recherche mit Copilot: Dialog mit drei Schritten, Prompt mit Bedarf und Umfang; ohne Ordner wird die Excel heruntergeladen
  await p.evaluate(() => { kiDialog(cur(), ['suchen', 'recherche']); }); await p.waitForSelector('.modal .ki-kacheln'); await p.click('.ki-fuss .link');
  r = await p.evaluate(() => [document.querySelectorAll('.ki-k').length, document.querySelector('.ki-los').textContent, document.querySelector('.ki textarea').value.replace(/\u00a0/g, ' ')]);
  ok(r[0] === 5 && r[1] === 'Auftrag kopieren' && r[2].includes('Bedarf: Testbedarf / MTW') && r[2].includes('noch offen 20.000 €') && r[2].includes('Deadline: 30.06.2027')
    && r[2].includes('5 bis 8 Förderer') && !r[2].includes('Doppelte') && r[2].includes('Nicht auf eine Gesamtsumme hinrechnen') && r[2].includes('Arbeitsdatei: „Foerderrecherche_Testbedarf_MTW_Paderborn_')
    && r[2].includes('Recherchiere im Web') && r[2].includes('brich ab') && r[2].includes('tatsächlich geöffnet') && !r[2].includes('Förder-Kartei') && r[2].includes('Zum Schluss im Chat'),
    'Dialog: drei Schritte; Prompt mit Bedarf, offener Summe, gestaffeltem Umfang ohne Zielsumme, angehängter Datei und Pflicht zur Websuche');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.ki-los')]);
  ok(/^Foerderrecherche_Testbedarf_MTW_Paderborn_[a-z0-9]{4}\.xlsx$/.test(dl.suggestedFilename()) && dl.suggestedFilename() === await p.evaluate(() => vorlageName(cur())), 'Download der Excel mit Gliederung und Kürzel: ' + dl.suggestedFilename());
  r = await p.evaluate(() => { const a = blank(), c = blank(); Object.assign(a, { titel: 'AED', gliederung: 'Brakel' }); Object.assign(c, { titel: 'AED', gliederung: 'Borchen' });
    const n = s => { const x = blank(); x.summe = s; return rechAnzahl(x); };
    return [vorlageName(a) !== vorlageName(c), /^Foerderrecherche_AED_Brakel_[a-z0-9]{4}\.xlsx$/.test(vorlageName(a)), [n(800), n(15000), n(60000), n(null)].join('|'), kurzName('Mannschaftstransportwagen (MTW) für den Sanitätsdienst', 40)]; });
  ok(r.join() === 'true,true,3 bis 5|5 bis 8|8 bis 12|5 bis 8,Mannschaftstransportwagen_MTW', 'gleicher Titel, andere Gliederung: andere Datei; Umfang nach Betrag gestaffelt; Kurzname ohne Füllwörter am Ende: ' + r.join());
  await p.click('.modal header .x');
  // Ordner nur als SharePoint-Link: aus der Adresszeile lernt die Liste, wo „Ortsgliederungen“ liegt, und baut Links für bekannte Ordner
  await p.evaluate(() => { const o = Object.assign(blank(), { titel: 'Küche' }); D.bedarfe.push(o); o.pfad = 'OneDrive - MalteserCloud\\Fundraising-Team - Diözese Paderborn - General\\Ortsgliederungen\\Büren\\RE - Küche'; o.link = ''; window.__o = o.id; });
  await p.fill('input[data-p="link"]', 'https://malteser.sharepoint.com/sites/FT/Freigegebene%20Dokumente/Forms/AllItems.aspx?id=%2Fsites%2FFT%2FFreigegebene%20Dokumente%2FGeneral%2FOrtsgliederungen%2FIserlohn%2FMTW&viewid=1');
  r = await p.evaluate(() => [!!document.querySelector('input[data-p="pfad"]'), D.bedarfe.find(x => x.id === window.__o).link, kiOrdnerPfad(cur())]);
  ok(!r[0] && r[1] === 'https://malteser.sharepoint.com/sites/FT/Freigegebene%20Dokumente/Forms/AllItems.aspx?id=%2Fsites%2FFT%2FFreigegebene%20Dokumente%2FGeneral%2FOrtsgliederungen%2FB%C3%BCren%2FRE%20-%20K%C3%BCche'
    && r[2] === 'OneDrive - MalteserCloud\\Fundraising-Team - Diözese Paderborn - General\\Ortsgliederungen\\Iserlohn\\MTW', 'kein Pfadfeld; SharePoint-Adresse gelernt, Link nachgetragen, für Cowork zurückgerechnet: ' + r.join(' | '));
  r = await p.evaluate(() => ['sehr wahrscheinlich', 'Wahrscheinlich', 'klappt', 'unsicher', 'eher nicht', 'unwahrscheinlich', 'sehr unwahrscheinlich', 'unmöglich', ''].map(einschKey).join());
  ok(r === 'sw,w,w,u,uw,uw,suw,suw,', 'Einschätzung aus Text in fünf Stufen: ' + r);
  // leere Vorlage aus dem Build
  r = await p.evaluate(async b64 => { const g = await readFoerderplan(Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer); return g && [g.items.length, g.sheet, g.kennung]; }, fs.readFileSync(T.VORLAGE).toString('base64'));
  ok(r && r[0] === 0 && r[1] === 'Förderplan' && r[2] === '', 'leere Foerderplan_Vorlage.xlsx ist lesbar');
  // ausgefüllte Excel wie von einer KI: Werte als Text, Spalten in anderer Reihenfolge, ein bekannter und ein neuer Förderer
  await p.evaluate(() => {
    const cols = ['Förderer', 'Einschätzung', 'Antragsfrist', 'Betrag beantragen (€)', 'Art', 'Antragsweg', 'Ansprechperson oder Portal', 'E-Mail', 'Weitere Fristen und Termine', 'Warum passt das?', 'Knackpunkte', 'Quellen'];
    const rows = [['Förderplan'], [], ['Kennung', 'falsch'], [], cols,
      ['Stiftung A', 'klappt wahrscheinlich', '15.01.2027', '6000', 'Stiftung', 'Portal', 'Portal A', '', 'Vergabe im März', 'neue Begründung', 'Fokus Ausstattung', 'https://a.example/satzung'],
      ['Sparkasse B', 'eher nicht', '31.03.27', '2.500', 'Sparkasse', 'E-Mail', 'Frau B', 'b@spk.example', '', 'Regionalbezug', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '']];
    window.__file = new File([xlsxBlob([{ name: 'Tabelle1', cols: cols.map(() => 12), rows }])], 'Recherche.xlsx');
    importFoerderplan(cur(), window.__file);
  });
  await p.waitForSelector('.modal');
  let t = await p.$eval('.modal', e => e.textContent);
  ok(t.includes('2 Förderer') && t.includes('im Plan: geplant') && t.includes('neu') && t.includes('nur leere Felder ergänzen'), 'Vorschau: 2 Förderer, einer schon da, einer neu');
  r = await p.evaluate(() => [document.querySelector('.imp-sum').textContent.replace(/\u00a0/g, ' '), [...document.querySelectorAll('.imp tbody tr')].map(tr => tr.querySelector('.imp-why') ? tr.querySelector('.imp-why').textContent : '').join('|')]);
  ok(r[0] === 'Neu ausgewählt: 1 Förderer, erwartet zusammen 2.500 € – noch offen sind 20.000 €.' && r[1] === 'neue Begründung|Regionalbezugohne Quelle', 'Vorschau mit Begründung, Hinweis „ohne Quelle“ und Summe der neuen Förderer: ' + r.join(' / '));
  await p.click('.imp tbody tr:nth-child(2) input'); 
  ok(await p.$eval('.imp-sum', e => e.textContent.replace(/\u00a0/g, ' ')) === 'Neu ausgewählt: 0 Förderer – noch offen sind 20.000 €.', 'Abwählen aktualisiert die Summe');
  await p.click('.imp tbody tr:nth-child(2) input');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  r = await p.evaluate(() => cur().foerderer.map(f => [f.name, f.status, f.betrag, f.frist, f.einsch, f.warum, f.art, f.weg, (f.kontakte[0] || {}).n || '', (f.kontakte[0] || {}).mail || '', f.fristInfo, f.quellen].join('|')));
  ok(r[0] === 'Stiftung A|geplant|5000|2027-01-15|w|passt|Stiftung|Portal|Portal A||Vergabe im März|https://a.example/satzung', 'ergänzen: leere Felder gefüllt, vorhandene bleiben: ' + r[0]);
  ok(r[1] === 'Sparkasse B|geplant|2500|2027-03-31|uw|Regionalbezug|Sparkasse|E-Mail|Frau B|b@spk.example||', 'neuer Förderer mit allen Angaben (Datum, Betrag, Einschätzung umgesetzt): ' + r[1]);
  ok((await p.$$('.fp')).length === 2 && (await p.$$eval('.fk-fuss .ff-n', e => e.map(x => x.textContent).join())) === 'Portal A,Frau B', 'Förderplan zeigt beide, Ansprechperson unten in der Kachel');
  // noch einmal, diesmal überschreiben
  await p.evaluate(() => { importFoerderplan(cur(), window.__file); });
  await p.waitForSelector('.modal');
  await p.click('.modal input[name="impmode"][value="all"]');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const f = cur().foerderer[0]; return [cur().foerderer.length, f.warum, f.betrag]; });
  ok(r.join('|') === '2|neue Begründung|6000', 'überschreiben: Angaben aus der Excel übernommen, nichts doppelt');
  await p.click('#toasts .toast:last-child button.link');
  r = await p.evaluate(() => cur().foerderer[0].warum);
  ok(r === 'passt', 'Rückgängig stellt den vorherigen Stand her');
  // Kontakte: je Zeile „Name; Funktion; E-Mail; Telefon“ – in beide Richtungen; höchstens drei
  r = await p.evaluate(() => { const k = kontakteAusText('Nadine Mersch; Geschäftsführung; stiftung@caritas.example; 05251 209-227\nBarbara Höltring; Referat Fördermittel; 05251 209-327\nPetra P, Vorstand\nVierte Person');
    const f = ff({ name: 'X', kontakte: k }), g = ff({ name: 'Y' }); applyResearch(g, { kontakt: 'Frau B', mail: 'b@x.example', tel: '' }, 'fill');
    return [k.length, k.map(kontaktText).join(' | '), g.kontakte.map(kontaktText).join()]; });
  ok(r[0] === 3 && r[1] === 'Nadine Mersch; Geschäftsführung; stiftung@caritas.example; 05251 209-227 | Barbara Höltring; Referat Fördermittel; ; 05251 209-327 | Petra P; Vorstand' && r[2] === 'Frau B; ; b@x.example',
    'Kontakte aus der Excel: Teile erkannt, „Name, Funktion“ getrennt, höchstens drei; allgemeine E-Mail für die erste Person: ' + r.join(' / '));
  r = await p.evaluate(() => { const n = normalize({ bedarfe: [{ id: 'a', titel: 'a', foerderer: [{ name: 'S', kontakt: 'Nadine Mersch, Geschäftsführung der Stiftung', mail: 'n@x.example', tel: '05251 1' }] }] }).bedarfe[0].foerderer[0];
    return [JSON.stringify(n.kontakte), 'kontakt' in n, 'mail' in n]; });
  ok(r.join('|') === '[{"n":"Nadine Mersch","rolle":"Geschäftsführung der Stiftung","mail":"n@x.example","tel":"05251 1"}]|false|false', 'bisherige Ansprechperson, E-Mail und Telefon werden zum ersten Kontakt: ' + r.join('|'));
  // Datei ohne Förderplan
  await p.evaluate(() => { importFoerderplan(cur(), new File([xlsxBlob([{ name: 'X', cols: [10], rows: [['irgendwas']] }])], 'x.xlsx')); });
  await p.waitForSelector('.modal');
  ok((await p.$eval('.modal', e => e.textContent)).includes('Kein Förderplan gefunden'), 'fremde Excel: verständliche Meldung');
  await finish(b, [p]);
})();
