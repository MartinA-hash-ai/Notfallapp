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
  await p.click('button[data-act="new"]'); await p.keyboard.type('Rucksäcke');
  await p.fill('input[data-p="gliederung"]', 'Iserlohn-Menden');
  await p.click('button[data-act="add-foe"]'); await p.keyboard.type('Märkische Bank eG');
  ok(!(await p.$('.det-panel')) && (await p.$eval('.fp [id^="ds-"]', e => e.textContent)) === 'Silke S · Antrag direkt', 'Kontakt zunächst eingeklappt, kurze Zusammenfassung sichtbar');
  ok(await p.evaluate(() => cur().foerderer[0].art === 'Volksbank / Bank' && document.querySelector('select.art').value === 'Volksbank / Bank'), 'Art aus der Kartei übernommen');
  await p.click('button[data-act="det"]');
  let t = await p.$eval('.det-panel', e => e.textContent);
  ok(t.includes('Aus der Förder-Kartei') && t.includes('Silke S') && t.includes('silke@mb.example') && t.includes('Antragswegdirekt') && t.includes('Hagen, Iserlohn-Menden'), 'aufgeklappt: Kartei-Angaben geordnet: ' + t.replace(/\s+/g, ' ').slice(0, 140));
  ok(!(await p.$eval('.fp [id^="fw-"]', e => e.textContent)).includes('Laut Kartei'), 'passende Region: kein Hinweis');
  await p.fill('.fp input[data-p="name"]', 'Herner Sparkasse');
  t = await p.$eval('.fp [id^="fw-"]', e => e.textContent);
  ok(t.includes('Laut Kartei zuständig für Herne') && (await p.$eval('.det-panel', e => e.textContent)).includes('nicht direkt anschreiben'), 'andere Region wird angemerkt, Kartei-Angaben wechseln mit');
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
  await finish(b, [p]);
})();
