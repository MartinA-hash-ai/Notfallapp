// Excel-Übernahme (0.37): Förderplan-Blatt flexibel, Summen- und Hinweiszeilen, Telefonnummern, Überschrift-Varianten, Platzhalter,
// gemerkte Fassung der Personen-Excel, Namensabgleich, „überschreiben“ nur Geändertes, seltene Excel-Eigenheiten, Konfliktkopie der Kartei
const { chromium, ok, open, connect, writeBin, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b);
  ok(await connect(p) === 'ok', 'Ordner verbunden');

  // 1 + 2. Förderplan: Spalte davor eingefügt, Überschrift umbenannt, Summen- und Hinweiszeilen, Anleitung wird nie gelesen, neues Blatt kommt dazu
  let r = await p.evaluate(async () => {
    const plan = { name: 'Förderplan', cols: [6, 30, 14, 14, 14], rows: [['Förderplan'], [], ['Nr.', 'Förderer (Name)', 'Art', 'Antragsfrist', 'Erwartete Summe (€)'],
      [1, 'Stiftung A', 'Stiftung', '15.01.2027', 5000], ['', 'Summe', '', '', 5000], ['', 'Hinweis: alle Angaben geprüft'], ['', 'nicht gefunden']] };
    const anl = { name: 'Anleitung', cols: [30, 80], rows: [['Spalte', 'Was gehört hinein'], ['Förderer', 'Name'], ['Art', 'Auswahl'], ['Antragsfrist', 'Datum']] };
    const neu = { name: 'Ergebnisse', cols: [30, 14, 14], rows: [['Förderer', 'Erwartete Summe (€)', 'Antragsweg'], ['Bank B', '15,000', 'Portal'], ['Stiftung A', '', 'E-Mail']] };
    const g = await readFoerderplan(await xlsxBlob([plan, anl, neu]).arrayBuffer());
    return g && [g.sheet, g.items.map(it => it.name + ':' + (it.betrag ?? '') + ':' + (it.frist || '') + ':' + (it.weg || '')).join(',')]; });
  ok(r && r[0] === 'Förderplan' && r[1] === 'Stiftung A:5000:2027-01-15:E-Mail,Bank B:15000::Portal',
    'Förderplan: „Nr.“ davor, „Förderer (Name)“, Summe/Hinweis übergangen, Anleitung nicht gelesen, neues Blatt ergänzt: ' + JSON.stringify(r));

  // 3. Telefonnummern: Vorlagen schreiben Text-Format, als Zahl gelesene Nummern bekommen ihre 0 zurück
  r = await p.evaluate(async () => {
    const z = zipIndex(await personenBlob().arrayBuffer()), st = await zipText(z, 'xl/styles.xml'), sh = await zipText(z, 'xl/worksheets/sheet1.xml');
    const book = await xlsxBook(await xlsxBlob([{ name: 'Personen', cols: [20, 20, 20], rows: [['Name', 'E-Mail', 'Telefon', 'Handy'], ['Max Muster', 'max@x.example', 5251123456, 1701234567]] }]).arrayBuffer());
    return [st.includes('numFmtId="49"'), parsePersonen(book).map(x => x.tel + '|' + x.mobil).join()]; });
  ok(r[0] && r[1] === '05251123456|01701234567', 'Telefon: Vorlage mit Text-Format, als Zahl gespeicherte Nummer mit führender 0: ' + r.join(' / '));

  // 4 + 5. Überschriften-Varianten und Platzhalter
  r = await p.evaluate(async () => {
    const bk = async rows => xlsxBook(await xlsxBlob([{ name: 'P', cols: [20, 20, 20, 20, 20], rows }]).arrayBuffer());
    const a = parsePersonen(await bk([['Vorname', 'Name', 'Position', 'E-Mail', 'Telefon'], ['Max', 'Muster', 'k. A.', 'nicht gefunden', '–'], ['Erika', 'Beispiel', 'Leitung', 'erika@x.example', '05251 1']]));
    const c = parsePersonen(await bk([['Name, Vorname', 'Mail'], ['Mustermann, Max', 'mm@x.example'], ['Summe', '']]));
    const k = parseKartei(await bk([['Förderer', 'Gliederungen', 'Kontakt', 'Mail', 'Telefon'], ['Sparkasse X', 'Paderborn', 'Frau Y', 'k. A.', 5251999], ['Summe', 'alle', '', '', '']]));
    return [a.map(x => [x.n, x.rolle, x.mail, x.tel].join(';')).join(' | '), c.map(x => x.n + ';' + x.mail).join(' | '), k.map(x => x.name + ':' + x.gl.join('/') + ':' + x.kontakte.map(y => y.n + '/' + y.m + '/' + y.t).join()).join(' | ')]; });
  ok(r[0] === 'Max Muster;;; | Erika Beispiel;Leitung;erika@x.example;05251 1', 'Personen: „Vorname“ + „Name“ zusammengesetzt, Platzhalter leer: ' + r[0]);
  ok(r[1] === 'Max Mustermann;mm@x.example', '„Name, Vorname“ → „Max Mustermann“, Summenzeile übergangen: ' + r[1]);
  ok(r[2] === 'Sparkasse X:Paderborn:Frau Y//05251999', 'Kartei: „Gliederungen“ erkannt, Summenzeile übergangen, Platzhalter leer, Telefon mit 0: ' + r[2]);

  // 7. Namensabgleich
  r = await p.evaluate(() => [['Muster Stiftung e.V.', 'Muster Stiftung e. V.'], ['Sparkasse Paderborn–Detmold', 'Sparkasse Paderborn - Detmold'], ['Dr. Max Mustermann', 'Max Mustermann'], ['Bürger­stiftung', 'Bürgerstiftung'], ['„Aktion“ Mensch', 'Aktion Mensch'], ['Stiftung A', 'Stiftung B']].map(([x, y]) => kkey(x) === kkey(y)).join());
  ok(r === 'true,true,true,true,true,false', 'Namensabgleich: e.V./e. V., Striche, Titel, Trennzeichen, Anführungszeichen gleich; Verschiedenes bleibt verschieden: ' + r);

  // 6. Personen-Excel: einmal je Fassung ergänzen – Gelöschtes bleibt gelöscht, bis die Excel sich ändert
  r = await p.evaluate(() => {
    const x = Object.assign(blank(), { titel: 'Pxl' }); x.zust = [Object.assign(leerZ(), { n: 'Erika Beispiel' })]; D.bedarfe.push(x);
    personenSetzen([{ n: 'Erika Beispiel', rolle: 'Leitung', mail: 'erika@x.example', tel: '05251 1', mobil: '' }]); PR.stamp = 'A';
    personenErgaenzen(); const z = x.zust[0], a = z.mail; z.mail = ''; personenErgaenzen(); const b2 = z.mail; PR.stamp = 'B'; personenErgaenzen();
    return [a, b2, z.mail, normalize(JSON.parse(JSON.stringify(D))).bedarfe.find(y => y.titel === 'Pxl').zust[0].pxl]; });
  ok(r.join('|') === 'erika@x.example||erika@x.example|B', 'Personen-Excel: ergänzt, gelöschte Mail bleibt weg, erst eine neue Fassung füllt wieder (gemerkt beim Speichern): ' + r.join('|'));

  // 8. „überschreiben“: nur was Copilot in der Excel geändert hat; was in der Liste seitdem geändert wurde, bleibt; Zugesagte bleiben
  await p.evaluate(() => {
    const x = Object.assign(blank(), { id: 'imp1', titel: 'Import', summe: 9000 });
    x.foerderer.push(ff({ name: 'Stiftung A', warum: 'alt', notiz: 'alt', betrag: 3000 }), ff({ name: 'Bank Z', status: 'zugesagt', zugesagt: 2000, betrag: 2000, warum: 'zu alt' }));
    D.bedarfe.push(x); UI.view = 'detail'; UI.id = 'imp1'; renderNow();
  });
  r = await p.evaluate(async () => {
    const b0 = cur(), orig = await xlsxBook(await vorlageBlob(b0).arrayBuffer());
    const kl = JSON.parse(JSON.stringify(b0)); kl.foerderer[0].notiz = 'Copilot neu'; kl.foerderer[1].warum = 'Copilot will ändern';
    const neu = await xlsxBook(await vorlageBlob(normalize({ bedarfe: [kl] }).bedarfe[0]).arrayBuffer());
    b0.foerderer[0].warum = 'in der Liste geändert'; changed();
    const sheets = [{ name: 'Förderplan', cols: FP_COLS.map(c => c.w), rows: neu.sheets[0].rows }, { name: '_Stand', hidden: true, cols: [30, 100], rows: orig.sheets.find(s => s.name === '_Stand').rows }];
    window.__f = new File([xlsxBlob(sheets)], 'copilot.xlsx'); importFoerderplan(b0, window.__f); return orig.sheets.find(s => s.name === '_Stand').hidden; });
  await p.waitForSelector('.modal');
  await p.click('.modal input[name="impmode"][value="all"]'); await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  r = [r, ...await p.evaluate(() => { const [a, z] = cur().foerderer; return [a.warum, a.notiz, z.warum]; })];
  ok(r.join('|') === 'true|in der Liste geändert|Copilot neu|zu alt', '„überschreiben“: nur von Copilot Geändertes (Notiz), eigene Änderung (Pro) bleibt, zugesagter Förderer unangetastet; Stand-Blatt ausgeblendet: ' + r.join('|'));

  // 9. seltene Excel-Eigenheiten: _x000D_, ausgeblendete Blätter, Hyperlinks (echt und als Formel), Datum t="d", 1904-Datum, <x:…>, <t/>
  r = await p.evaluate(async () => {
    const X = '<?xml version="1.0" encoding="UTF-8"?>';
    const wb = X + '<x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><x:workbookPr date1904="1"/><x:sheets>'
      + '<x:sheet name="Förderplan" sheetId="1" r:id="rId1"/><x:sheet name="Archiv" sheetId="2" state="hidden" r:id="rId2"/></x:sheets></x:workbook>';
    const rels = X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="ws" Target="worksheets/sheet2.xml"/></Relationships>';
    const ss = X + '<x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:si><x:t>Förderer</x:t></x:si><x:si><x:t>E-Mail</x:t></x:si><x:si><x:t>kontakt@stiftung.example_x000D_</x:t></x:si>'
      + '<x:si><x:r><x:t/></x:r><x:r><x:t>Stiftung C</x:t></x:r></x:si><x:si><x:t>Website oder Portal-Link</x:t></x:si><x:si><x:t>Website</x:t></x:si><x:si><x:t>Antragsfrist</x:t></x:si><x:si><x:t>Quellen</x:t></x:si></x:sst>';
    const s1 = X + '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><x:sheetData>'
      + '<x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="s"><x:v>1</x:v></x:c><x:c r="C1" t="s"><x:v>4</x:v></x:c><x:c r="D1" t="s"><x:v>6</x:v></x:c><x:c r="E1" t="s"><x:v>7</x:v></x:c></x:row>'
      + '<x:row r="2"><x:c r="A2" t="s"><x:v>3</x:v></x:c><x:c r="B2" t="s"><x:v>2</x:v></x:c><x:c r="C2" t="s"><x:v>5</x:v></x:c><x:c r="D2"><x:v>45306</x:v></x:c><x:c r="E2" t="str"><x:f>HYPERLINK("https://satzung.example/c","Satzung")</x:f></x:c></x:row>'
      + '</x:sheetData><x:hyperlinks><x:hyperlink ref="C2" r:id="rIdL"/></x:hyperlinks></x:worksheet>';
    const s1r = X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdL" Type="hl" Target="https://www.stiftung-c.example/foerderung" TargetMode="External"/></Relationships>';
    const s2 = X + '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="s"><x:v>6</x:v></x:c><x:c r="C1" t="s"><x:v>1</x:v></x:c></x:row>'
      + '<x:row r="2"><x:c r="A2" t="inlineStr"><x:is><x:t>Versteckt</x:t></x:is></x:c><x:c r="B2" t="d"><x:v>2027-03-01T00:00:00</x:v></x:c></x:row></x:sheetData></x:worksheet>';
    const blob = zipBlob([{ name: 'xl/workbook.xml', data: wb }, { name: 'xl/_rels/workbook.xml.rels', data: rels }, { name: 'xl/sharedStrings.xml', data: ss },
      { name: 'xl/worksheets/sheet1.xml', data: s1 }, { name: 'xl/worksheets/_rels/sheet1.xml.rels', data: s1r }, { name: 'xl/worksheets/sheet2.xml', data: s2 }], 'application/zip');
    const buf = await blob.arrayBuffer(), bk = await xlsxBook(buf), g = await readFoerderplan(buf), it = g.items[0];
    return [bk.date1904, bk.sheets[1].hidden, bk.sheets[1].rows[1][1], g.items.length, it.name, it.mail, it.web, it.frist, it.quellen]; });
  ok(r.join('|') === 'true|true|2027-03-01|1|Stiftung C|kontakt@stiftung.example|https://www.stiftung-c.example/foerderung|2028-01-16|https://satzung.example/c',
    'Excel-Eigenheiten: 1904-Datum, ausgeblendetes Blatt übergangen, <x:…>, <t/>, _x000D_ weg, Hyperlink und HYPERLINK-Formel als Adresse, Datum t="d": ' + r.join('|'));
  r = await p.evaluate(async () => { const z = zipIndex(await xlsxBlob([{ name: 'S', cols: [10, 10, 10], rows: [['A￾B', NaN, 'x'.repeat(40000)]] }]).arrayBuffer()), t = await zipText(z, 'xl/worksheets/sheet1.xml');
    return [t.includes('￾'), t.includes('NaN'), (t.match(/x+/g) || []).reduce((m, s) => Math.max(m, s.length), 0)]; });
  ok(r.join('|') === 'false|false|32767', 'Schreiben: ungültige Zeichen und NaN weg, Zellen auf 32.767 Zeichen begrenzt: ' + r.join('|'));

  // 10. Kartei: die OneDrive-Konfliktkopie wird nicht dem Original vorgezogen; ohne „Gliederung“ eine verständliche Meldung
  const xl = rows => p.evaluate(async rows => { const u = new Uint8Array(await xlsxBlob([{ name: 'K', cols: [20, 20], rows }]).arrayBuffer()); let s = ''; u.forEach(c => { s += String.fromCharCode(c); }); return btoa(s); }, rows);
  await writeBin(p, await xl([['Förderer', 'Gliederung'], ['Alte Kopie', 'Paderborn']]), 'Banken- und Stiftungsübersicht-LAPTOP-7.xlsx');
  await writeBin(p, await xl([['Förderer', 'Gliederung'], ['Original', 'Paderborn']]), 'Banken- und Stiftungsübersicht.xlsx');
  r = await p.evaluate(async () => { await karteiScan(true); return [KR.name, KR.list.map(k => k.name).join()]; });
  ok(r.join('|') === 'Banken- und Stiftungsübersicht.xlsx|Original', 'Kartei: Original statt Konfliktkopie gelesen: ' + r.join('|'));
  await writeBin(p, await xl([['Förderer', 'Ort'], ['X', 'Y']]), 'Banken- und Stiftungsübersicht.xlsx');
  r = await p.evaluate(async () => { await karteiScan(true); return KR.err || ''; });
  ok(/keine Tabelle mit einer Spalte „Gliederung“/.test(r), 'Kartei ohne Spalte „Gliederung“: verständliche Meldung statt 0 Förderer: ' + r);

  await finish(b, [p]);
})();
