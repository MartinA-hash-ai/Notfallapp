// Förder-Kartei: Excel im Ordner wird gelesen (verbundene Zellen, Kontakte, Antragsweg, Historie), Änderungen kommen an, Fehler werden gemeldet
const { chromium, ok, open, skip, connect, finish } = require('./lib');
const KARTEI = 'Banken- und Stiftungsübersicht.xlsx';
async function writeKartei(p, kontakt) {
  await p.evaluate(async ([kontakt, name]) => {
    const R = (o, n = 22) => { const r = []; for (const [c, v] of Object.entries(o)) r[colIdx(c + '1')] = v; return Array.from({ length: n }, (x, i) => r[i] ?? ''); };
    const banken = [R({ H: 'VV = Vorstandsvorsitzende', I: 'Entscheidungsträger (anschreiben)', L: 'Entscheidungsträger (nicht direkt anschreiben)' }), R({ F: 'Antragswesen', I: 'Antragsweg', S: 'Historie' }),
      R({ E: 'Gliederung', F: 'Direkt', G: 'Portal', H: 'Notizen', I: 'Kontakt 1', J: 'Mail', K: 'Telefon', L: 'Kontakt 2', M: 'Mail', N: 'Telefon', R: 'i', S: 2026, T: 2025 }),
      R({ C: 'Herner Sparkasse', E: 'Herne', F: 'WAHR', G: '', I: 'Anna A', J: 'anna@spk.example', L: 'Bernd B (V)', M: 'bernd@spk.example', R: 'i' }),
      R({ C: 'Märkische Bank eG', E: 'Hagen', F: 'WAHR', I: kontakt, J: 'silke@mb.example', K: '02331 1', T: '1.000 € Folierung', R: 'i' }),
      R({ E: 'Iserlohn-Menden', F: 'WAHR', R: 'i' }),
      R({ B: 'Sparkasse', C: 'Sparkasse PDH', E: 'Lage', I: 'Kay K (VV)', R: 'i' }),
      R({ E: 'Borchen', R: 'i' })];
    for (let i = 0; i < 300; i++) banken.push(R({ R: 'i' }));
    const stift = [[], R({ E: 'Antragswesen', I: 'Kontakt', N: 'Historie' }, 17),
      R({ D: 'Gliederung', E: 'Mail', F: 'Portal', G: 'Förderschwerpunkte', H: 'Notizen', I: 'Homepage', J: 'Ansprechperson', K: 'Mail', L: 'Telefon', M: 'i', N: '2026', O: '2025' }, 17),
      R({ B: 'Bürgerstiftung Musterstadt', D: 'Paderborn', E: 'WAHR', F: 'FALSCH', G: 'Bevölkerungsschutz', I: 'https://www.bst.example', J: 'Petra P', K: 'Mail', L: '05251 3', O: '4.800€ - Defis' }, 17),
      R({ B: 'Aktion Beispiel', D: 'alle', E: 'FALSCH', F: 'WAHR', I: 'https://antrag.example', J: '-' }, 17)];
    const blob = xlsxBlob([{ name: 'Banken', cols: Array(22).fill(10), rows: banken, merges: ['C5:C6', 'B7:B8', 'C7:C8'] }, { name: 'Stiftungen', cols: Array(17).fill(10), rows: stift }]);
    __fs.files['/Ordner/' + name] = { data: new Uint8Array(await blob.arrayBuffer()), lm: 70000 + (++__fs.n) };
  }, [kontakt, KARTEI]);
}
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { clock: true });
  await writeKartei(p, 'Silke S');
  ok(await connect(p) === 'ok', 'Ordner verbunden');
  await p.waitForTimeout(300);
  let r = await p.evaluate(() => ({ n: KR.list.length, name: KR.name, names: KR.list.map(k => k.name), mb: kartei('Märkische Bank eG'), hs: kartei('herner  sparkasse'), pdh: kartei('Sparkasse PDH'), bst: kartei('Bürgerstiftung Musterstadt'), ab: kartei('Aktion Beispiel') }));
  ok(r.n === 5 && r.name === 'Banken- und Stiftungsübersicht.xlsx', 'Kartei gefunden und gelesen: ' + r.names.join(', '));
  ok(r.mb && r.mb.gl.join() === 'Hagen,Iserlohn-Menden' && r.mb.kontakte[0].n === 'Silke S' && r.mb.kontakte[0].t === '02331 1' && r.mb.hist['2025'] === '1.000 € Folierung', 'verbundene Zellen: Märkische Bank für Hagen und Iserlohn-Menden, mit Kontakt und Historie');
  ok(r.hs && r.hs.weg.join() === 'direkt' && !r.hs.kontakte[0].nicht && r.hs.kontakte[1].nicht && r.hs.kontakte[1].m === 'bernd@spk.example', 'Groß/klein egal; Antragsweg „direkt“; Kontakt 2 „nicht direkt anschreiben“');
  ok(r.pdh && r.pdh.gl.join() === 'Lage,Borchen', 'Sparkasse PDH für Lage und Borchen');
  ok(r.bst && r.bst.weg.join() === 'per Mail' && r.bst.web === 'https://www.bst.example' && r.bst.schwer === 'Bevölkerungsschutz' && r.bst.kontakte[0].m === '' && r.bst.hist['2025'] === '4.800€ - Defis', 'Stiftung: per Mail, Homepage, Schwerpunkte, „Mail“ ohne Adresse ignoriert');
  ok(r.ab && r.ab.weg.join() === 'Portal' && r.ab.kontakte.length === 0 && r.ab.gl.join() === 'alle', 'Aktion: Portal, „-“ ist kein Kontakt');
  ok((await p.$eval('.kchip', e => e.textContent)) === 'Förder-Kartei · 5 Förderer', 'Kopfzeile zeigt die Kartei');
  // im Förderplan
  await p.click('button[data-act="new"]'); await p.keyboard.type('Rucksäcke'); await p.keyboard.press('Enter'); await p.keyboard.press('Escape');
  await p.click('#list-body tr[data-id] .l-name', { modifiers: ['Control'] });
  await p.fill('input[data-p="gliederung"]', 'Iserlohn-Menden');
  await p.click('button[data-act="add-foe"]'); await p.keyboard.type('Märkische Bank eG');
  r = await p.$eval('.fp .fk-fuss', e => [e.querySelector('.ff-n').textContent, [...e.querySelectorAll('a.fi')].map(a => a.getAttribute('href') + '=' + a.dataset.tip).join(), e.querySelector('.ff-mehr').textContent]);
  ok(!(await p.$('.foe-pop')) && r.join('|') === 'Silke S|tel:023311=02331 1,mailto:silke@mb.example=silke@mb.example|Weitere Infos →', 'Kachel unten: Ansprechperson aus der Kartei mit Telefon- und E-Mail-Symbol, rechts „Weitere Infos →“: ' + r.join('|'));
  ok(await p.evaluate(() => cur().foerderer[0].art === 'Volksbank / Bank' && !document.querySelector('select.art')), 'Art aus der Kartei übernommen (nur in den Daten, kein Auswahlfeld mehr)');
  await p.click('button[data-act="det"]');
  let t = await p.$eval('.foe-pop .det-k', e => e.textContent);
  ok(t.includes('Aus der Förder-Kartei') && t.includes('Antragswegdirekt') && t.includes('Hagen, Iserlohn-Menden')
    , 'Fenster mit Kartei-Angaben: ' + t.replace(/\s+/g, ' ').slice(0, 140));
  ok(await p.$eval('.foe-pop .k1.kartei', e => e.textContent.includes('Silke S') && e.textContent.includes('Kartei')) && await p.$eval('.foe-pop .k1.kartei a[href^="mailto:"]', e => e.getAttribute('href')) === 'mailto:silke@mb.example',
    'Kontakte aus der Kartei in der Kontaktliste, mit Vermerk, E-Mail als Link');
  await p.keyboard.press('Escape');
  ok(!(await p.$('.foe-pop')), 'Esc schließt das Fenster');
  ok(!(await p.$('.fp .fw-tri')), 'passende Region: kein Hinweis-Dreieck');
  await p.fill('.fp input[data-p="name"]', 'Herner Sparkasse'); await p.press('.fp input[data-p="name"]', 'Tab');
  await p.hover('.fp .fw-tri');
  t = await p.$eval('.fw-pop', e => e.textContent);
  await p.click('button[data-act="det"]');
  ok(t.includes('Laut Kartei zuständig für Herne') && (await p.$$eval('.foe-pop .k1.kartei', e => e.map(x => x.textContent).join())).includes('nicht direkt anschreiben'), 'andere Region: rotes Dreieck hinter dem Namen, beim Überfahren der Hinweis; Kartei-Angaben wechseln mit');
  await p.click('.foe-pop button.x');
  // Kartei in Excel geändert → nach etwa einer Minute neu gelesen
  await writeKartei(p, 'Silke Neu');
  await skip(p, 15000); await skip(p, 15000); await skip(p, 15000); await skip(p, 15000); await p.waitForTimeout(400);
  ok(await p.evaluate(() => kartei('Märkische Bank eG').kontakte[0].n) === 'Silke Neu', 'geänderter Kontakt aus der Excel übernommen');
  // gerade nicht lesbar (in Excel geöffnet): Meldung, bisherige Kartei bleibt
  r = await p.evaluate(async name => { __fs.unreadable = name; KR.stamp = null; await karteiScan(true); __fs.unreadable = null; return [KR.err, KR.list.length]; }, 'Banken- und Stiftungsübersicht.xlsx');
  ok(/nicht lesbar/.test(r[0]) && r[1] === 5, 'nicht lesbar: Meldung, Kartei bleibt: ' + r[0]);
  // sehr großes Blatt: nur der Anfang wird gelesen
  r = await p.evaluate(async () => { const f = __fs.files['/Ordner/Banken- und Stiftungsübersicht.xlsx']; const bk = await xlsxBook(f.data.buffer.slice(0), { max: 5000 }); return [bk.sheets[0].cut, bk.sheets[0].rows.length > 3, parseKartei(bk).length]; });
  ok(r[0] && r[1] && r[2] >= 1, 'großes Blatt: Anfang gelesen, Rest übersprungen (' + r[2] + ' Förderer)');
  // Recherche mit Copilot (öffnet die Auswahl des Copilot-Knopfs mit „Förderer suchen“ und „Förderrecherche“): Excel im Unterordner „Förderrecherche“,
  // mit Kartei-Auszug für die Gliederung (ohne Kontaktdaten); ausgefüllt wieder übernehmen
  await p.click('button[data-act="vorlage"]'); await p.waitForSelector('.modal .ki-kacheln'); await p.click('.ki-fuss .link');
  r = await p.evaluate(() => [document.querySelector('.ki-los').textContent.replace('Auftrag kopieren', 'Excel anlegen und Prompt kopieren'), document.querySelector('.ki textarea').value,
    [...document.querySelectorAll('.ki-k.on')].map(e => e.dataset.k).join()]);
  ok(r[0] === 'Excel anlegen und Prompt kopieren' && r[2] === 'suchen,recherche' && r[1].includes('Gliederung: Iserlohn-Menden') && r[1].includes('Bezug zu Iserlohn-Menden') && r[1].includes('Blatt „Förder-Kartei“') && r[1].includes('Unterordner „Förderrecherche“'), 'mit Ordner: „Excel anlegen“, Prompt nennt Gliederung, Kartei-Blatt und die angehängte Datei');
  await p.click('.ki-los'); await p.waitForTimeout(200);
  const RP = '/Ordner/Förderrecherche/' + await p.evaluate(() => vorlageName(cur()));
  r = await p.evaluate(async rp => { const f = __fs.files[rp]; if (!f) return null; const bk = await xlsxBook(f.data.buffer.slice(0)); const k = bk.sheets[2];
    return [bk.sheets.filter(x => !x.hidden).map(x => x.name).join('+'), k.rows.slice(4).map(x => x[0]).join(','), JSON.stringify(k.rows).includes('silke'), k.rows[4][6], k.rows[3].includes('Notizen'), !!document.querySelector('.ki-erg'), document.querySelector('.ki-erg').textContent]; }, RP);
  ok(r && r[0] === 'Förderplan+Anleitung+Förder-Kartei' && r[1] === 'Märkische Bank eG,Aktion Beispiel' && !r[2] && r[3] === '2025: 1.000 € Folierung' && !r[4] && r[5] && r[6] === 'Ergebnis von Cowork übernehmen',
    'Excel im Ordner angelegt; Kartei-Blatt nur mit den Zuständigen, eigene Gliederung zuerst, Historie, ohne Kontaktdaten und Notizen: ' + JSON.stringify(r));
  // gleich übernehmen, obwohl Copilot noch nichts eingetragen hat: Hinweis statt leerer Vorschau
  await p.click('.ki-erg');
  await p.waitForFunction(() => [...document.querySelectorAll('.modal h2')].some(e => e.textContent === 'Noch kein Ergebnis'));
  t = await p.$eval('.modal', e => e.textContent);
  ok(t.includes('Noch kein Ergebnis') && t.includes('als eigene Datei gespeichert') && t.includes('Andere Datei wählen'), 'unveränderte Excel: Hinweis mit möglichen Gründen und „Andere Datei wählen“');
  await p.click('.modal footer button:first-child'); await p.waitForTimeout(100);
  // Copilot hat das Ergebnis als Kopie neben die Datei gelegt („… (1).xlsx“) – die neueste passende Datei wird genommen
  await p.evaluate(async rp => {
    const cols = ['Förderer', 'Stand in der Bedarfsliste', 'Erwartete Summe (€)', 'Pro – warum passt das?', 'Quellen'];
    const rows = [['Förderplan'], [], ['Kennung', cur().id], [], cols, ['Herner Sparkasse', 'geplant', '', '', ''], ['Stiftung Neu', '', '3000', 'Fördert Ausstattung im Ehrenamt', 'https://neu.example'], ['Lotterie Neu', '', '2.000', 'Regionalbezug', '']];
    __fs.files[rp.replace(/\.xlsx$/, ' (1).xlsx')] = { data: new Uint8Array(await xlsxBlob([{ name: 'Förderplan', cols: cols.map(() => 12), rows }]).arrayBuffer()), lm: 90000 };
  }, RP);
  await p.click('button[data-act="vorlage"]'); await p.waitForSelector('.modal .ki-kacheln');
  await p.click('.ki-erg'); await p.waitForSelector('.modal .imp');
  t = await p.$eval('.modal', e => e.textContent.replace(/\u00a0/g, ' '));
  ok(t.includes('3 Förderer') && t.includes('Neu ausgewählt: 2 Förderer, erwartet zusammen 5.000 €') && t.includes('im Plan: geplant'), '„Excel übernehmen“ liest die Datei aus dem Ordner und zeigt die Vorschläge: ' + t.replace(/\s+/g, ' ').slice(0, 160));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  r = await p.evaluate(() => cur().foerderer.map(f => f.name + ':' + f.status + ':' + (f.betrag ?? '')).join(','));
  ok(r === 'Herner Sparkasse:geplant:,Stiftung Neu:geplant:3000,Lotterie Neu:geplant:2000', 'neue Förderer mit Summe im Förderplan, vorhandener nicht doppelt: ' + r);
  // Personen-Excel: Kontaktdaten der Zuständigen, von Copilot oder von Hand gepflegt; die Liste liest alle „Personen…xlsx“ im Ordner
  const pers = (name, rows, lm) => p.evaluate(async ([name, rows, lm]) => { __fs.files['/Ordner/' + name] = { data: new Uint8Array(await xlsxBlob([{ name: 'Personen', cols: rows[0].map(() => 14), rows }]).arrayBuffer()), lm }; }, [name, rows, lm]);
  await p.evaluate(() => { cur().zust = [{ n: 'Paula Person', rolle: '', mail: '', tel: '0170 eigene' }, { n: 'Otto Ohne', rolle: '', mail: '', tel: '' }]; changed(); renderNow(); });
  await p.click('#sec-eck .k-cop'); await p.waitForSelector('.modal .rech-steps');
  r = await p.evaluate(() => [document.querySelector('.rech-steps li button').textContent, document.querySelector('.rech-prompt').value]);
  ok(r[0] === 'Excel anlegen' && r[1].includes('- Paula Person (Iserlohn-Menden)\n- Otto Ohne (Iserlohn-Menden)') && r[1].includes('die angehängte Excel „Personen.xlsx“') && r[1].length < 1100,
    'Kontaktdaten mit Copilot: noch keine Excel; kurzer Auftrag nennt die Zuständigen mit Gliederung (' + r[1].length + ' Zeichen)');
  await p.click('.rech-steps li button'); await p.waitForTimeout(200);
  r = await p.evaluate(async () => { const f = __fs.files['/Ordner/Personen.xlsx']; if (!f) return null; const bk = await xlsxBook(f.data.buffer.slice(0));
    return [bk.sheets.map(s => s.name).join('+'), bk.sheets[0].rows[0].join('|'), bk.sheets[0].rows.slice(1).filter(x => x[0]).map(x => x[0] + ':' + x[2] + ':' + x[4]).join(','), document.querySelector('.rech-steps li button').disabled]; });
  ok(r && r[0] === 'Personen+Anleitung' && r[1] === 'Name|Position|Gliederung / Dienststelle|E-Mail|Telefon|Handy|Quelle|Stand' && r[2].includes('Otto Ohne:Iserlohn-Menden:') && r[2].includes('Paula Person:Iserlohn-Menden:0170 eigene') && r[3],
    'Personen.xlsx im Ordner angelegt, mit allen Personen, die die Liste kennt; danach nicht noch einmal: ' + JSON.stringify(r));
  // Copilot füllt die Datei; eine zweite, neuere Fassung mit Vor- und Nachname in zwei Spalten – die neueste gilt, Eigenes bleibt
  await pers('Personen.xlsx', [['Name', 'Position', 'Gliederung / Dienststelle', 'E-Mail', 'Telefon', 'Quelle', 'Stand'], ['Paula Person', 'Ortsbeauftragte', 'Iserlohn-Menden', 'paula@malteser.example', '02371 1', 'Outlook', '2026-10-23'],
    ['Otto Ohne', 'Kassenwart', '', '', '02371 2', '', '']], 95000);
  await pers('Personen (2).xlsx', [['Name', 'Handy'], ['Paula Person', '0171 9']], 94000);
  await pers('Personen (1).xlsx', [['Vorname', 'Nachname', 'Funktion', 'E-Mail-Adresse', 'Telefon'], ['Otto', 'Ohne', '', 'otto@malteser.example', '02371 22']], 96000);
  await p.click('.rech-steps li:nth-child(3) .rech-btns button:last-child'); await p.waitForTimeout(250);
  r = await p.evaluate(() => [cur().zust.map(kontaktText).join(' | '), document.querySelector('.modal .rech-steps li:nth-child(3)').textContent, PR.list.length]);
  ok(r[0] === 'Paula Person; Ortsbeauftragte; paula@malteser.example; 0170 eigene | Otto Ohne; Kassenwart; otto@malteser.example; 02371 22' && r[1].includes('Ergänzt: Paula Person (Position, E-Mail, Handy) · Otto Ohne (Position, E-Mail, Telefon)') && !r[1].includes('Noch nicht'),
    'Excel einlesen: leere Angaben ergänzt, eigene bleiben, die neueste Datei gilt (auch mit Vor- und Nachname): ' + r.join(' / '));
  await p.click('.modal footer button'); await p.waitForTimeout(100);
  r = await p.evaluate(async () => { await karteiScan(true); return [SRC.zust().includes('Paula Person'), JSON.stringify(zustVorbild('paula  person')), KR.name]; });
  ok(r[0] && r[1] === '{"n":"Paula Person","rolle":"Ortsbeauftragte","mail":"paula@malteser.example","tel":"02371 1","mobil":"0171 9"}' && r[2] === 'Banken- und Stiftungsübersicht.xlsx',
    'die Liste kennt die Personen: Vorschlag beim Namen, Angaben kommen mit; die Förder-Kartei bleibt dieselbe: ' + r.join(' / '));
  // ein weiterer Bedarf mit einer bekannten Person: beim nächsten Einlesen ergänzt
  await p.evaluate(async () => { const x = blank(); x.titel = 'Zelt'; x.zust = [Object.assign(leerK(), { n: 'Otto Ohne' })]; D.bedarfe.push(x); changed(); await personenScan(true); });
  ok(await p.evaluate(() => kontaktText(D.bedarfe.find(x => x.titel === 'Zelt').zust[0])) === 'Otto Ohne; Kassenwart; otto@malteser.example; 02371 22', 'Zuständige in anderen Bedarfen werden aus der Personen-Excel ergänzt');
  await finish(b, [p]);
})();
