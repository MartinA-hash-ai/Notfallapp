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
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button[data-act="vorlage"]')]);
  ok(dl.suggestedFilename() === 'Foerderplan_Testbedarf_MTW.xlsx', 'Download der Vorlage: ' + dl.suggestedFilename());
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
  ok(t.includes('2 Förderer') && t.includes('schon im Förderplan') && t.includes('neu') && t.includes('nur leere Felder ergänzen'), 'Vorschau: 2 Förderer, einer schon da, einer neu');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  r = await p.evaluate(() => cur().foerderer.map(f => [f.name, f.status, f.betrag, f.frist, f.einsch, f.warum, f.art, f.weg, f.kontakt, f.mail, f.fristInfo, f.quellen].join('|')));
  ok(r[0] === 'Stiftung A|geplant|5000|2027-01-15|w|passt|Stiftung|Portal|Portal A||Vergabe im März|https://a.example/satzung', 'ergänzen: leere Felder gefüllt, vorhandene bleiben: ' + r[0]);
  ok(r[1] === 'Sparkasse B|geplant|2500|2027-03-31|uw|Regionalbezug|Sparkasse|E-Mail|Frau B|b@spk.example||', 'neuer Förderer mit allen Angaben (Datum, Betrag, Einschätzung umgesetzt): ' + r[1]);
  ok((await p.$$('.fp')).length === 2 && (await p.$eval('.d-left', e => e.textContent)).includes('Portal A · Portal'), 'Förderplan zeigt beide, Recherche-Zusammenfassung sichtbar');
  // noch einmal, diesmal überschreiben
  await p.evaluate(() => { importFoerderplan(cur(), window.__file); });
  await p.waitForSelector('.modal');
  await p.click('.modal input[name="impmode"][value="all"]');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const f = cur().foerderer[0]; return [cur().foerderer.length, f.warum, f.betrag]; });
  ok(r.join('|') === '2|neue Begründung|6000', 'überschreiben: Angaben aus der Excel übernommen, nichts doppelt');
  await p.click('#toasts button.link');
  r = await p.evaluate(() => cur().foerderer[0].warum);
  ok(r === 'passt', 'Rückgängig stellt den vorherigen Stand her');
  // Datei ohne Förderplan
  await p.evaluate(() => { importFoerderplan(cur(), new File([xlsxBlob([{ name: 'X', cols: [10], rows: [['irgendwas']] }])], 'x.xlsx')); });
  await p.waitForSelector('.modal');
  ok((await p.$eval('.modal', e => e.textContent)).includes('Kein Förderplan gefunden'), 'fremde Excel: verständliche Meldung');
  await finish(b, [p]);
})();
