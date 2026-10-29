// 0.66: Förderer schnell eintippen – Name, Enter → Summe, Enter → nächster Förderer
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  const K = p.keyboard;
  await p.evaluate(() => { D = normalize({ bedarfe: [Object.assign(blank(), { id: 'x', titel: 'Zelt', summe: 5000, gliederung: 'Brakel' })] }); SAVED_JSON = JSON.stringify(D); undoReset(); oeffnen('x'); });
  await p.waitForTimeout(200);
  await p.click('button[data-act="add-foe"]'); await p.waitForTimeout(100);
  await K.type('Förderer Eins'); await K.press('Enter'); await p.waitForTimeout(100);
  let r = await p.evaluate(() => [document.activeElement.id.startsWith('amt-'), cur().foerderer[0].name]);
  ok(r.join('|') === 'true|Förderer Eins', 'Name, Enter: Schreibmarke in der Summe: ' + r.join('|'));
  await K.type('1500'); await K.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [cur().foerderer.length, cur().foerderer[0].betrag, document.activeElement.matches('input.fp-h[data-p="name"]'), document.activeElement.value]);
  ok(r.join('|') === '2|1500|true|', 'Summe, Enter: nächster Förderer angelegt, Schreibmarke im Namen: ' + r.join('|'));
  await K.type('Förderer Zwei'); await K.press('Escape'); await K.press('Enter'); await p.waitForTimeout(100); await K.type('800'); await K.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [cur().foerderer.map(f => f.name + ':' + f.betrag).join(','), document.activeElement.matches('input.fp-h[data-p="name"]')]);
  ok(r.join('|') === 'Förderer Eins:1500,Förderer Zwei:800,:null|true', 'Kette läuft weiter: ' + r.join('|'));
  // im leeren Namen noch einmal Enter → Summe des leeren; Enter dort legt keinen weiteren leeren an
  await K.press('Enter'); await p.waitForTimeout(100); await K.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(() => cur().foerderer.length);
  ok(r === 3, 'ein leerer Förderer wird wiederverwendet, kein zweiter leerer: ' + r);
  await finish(b, [p]);
})();
