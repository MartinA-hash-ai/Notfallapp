// 0.68: Adressen als Excel (herunterladen, ausfüllen, einlesen), Route zur Spendenübergabe über Google Maps (ab DGS oder zu Hause)
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  await p.evaluate(() => {
    D = normalize({ bedarfe: [Object.assign(blank(), { id: 'x', titel: 'Zelt', summe: 5000, gliederung: 'Brakel' })] }); SAVED_JSON = JSON.stringify(D); undoReset();
    window.OPEN = []; window.open = u => { OPEN.push(u); return null; };
  });
  // Excel: Kopf, DGS, alle Gliederungen, freie Zeilen; hin und zurück ohne Verlust
  let r = await p.evaluate(async () => {
    D.settings.adressen = { [DIO]: 'Kilianstraße 26, 33098 Paderborn', Brakel: 'Am Markt 1, 33034 Brakel', 'Dienststelle Hagen': 'Hauptstraße 5, 58095 Hagen' };
    const bk = await xlsxBook(await adressenBlob().arrayBuffer()), sh = bk.sheets[0];
    const R = adressenLesen(bk);
    return [sh.name, sh.rows[0].join('|'), sh.rows[1].join('|'), sh.rows.filter(z => z[0] === 'Gliederung').length === GL_LIST.length, JSON.stringify(R)];
  });
  ok(r[0] === 'Adressen' && r[1] === 'Art|Name|Straße und Hausnummer|PLZ|Ort' && r[2] === 'DGS|Diözesangeschäftsstelle Paderborn|Kilianstraße 26|33098|Paderborn' && r[3]
    && r[4] === JSON.stringify({ [String('Diözese')]: 'Kilianstraße 26, 33098 Paderborn', Brakel: 'Am Markt 1, 33034 Brakel', 'Dienststelle Hagen': 'Hauptstraße 5, 58095 Hagen' }), 'Adressen-Excel: Aufbau und hin und zurück: ' + r.join(' / '));
  // ausgefüllte Excel über das Zahnrad einlesen (eine neue, eine geänderte)
  const buf = await p.evaluate(async () => {
    const S = [{ name: 'Adressen', cols: [16, 40, 36, 9, 24], rows: [['Art', 'Name', 'Straße und Hausnummer', 'PLZ', 'Ort'], ['DGS', 'Diözesangeschäftsstelle Paderborn', 'Kilianstraße 26', 33098, 'Paderborn'],
      ['Gliederung', 'Brakel', 'Neuer Weg 2', '33034', 'Brakel'], ['Gliederung', 'Hagen', 'Ringstraße 9', '58097', 'Hagen'], ['Dienststelle', '', '', '', '']] }];
    return [...new Uint8Array(await (await xlsxBlob(S)).arrayBuffer())];
  });
  await p.click('button[data-act="menu"]'); await p.click('#mmenu button[data-act="adressen-alle"]'); await p.waitForTimeout(100);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.modal .ad-excel button:text-is("Excel einlesen …")')]);
  await fc.setFiles({ name: 'Adressen.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(buf) });
  await p.waitForSelector('.modal h2:text-is("Adressen übernehmen?")');
  r = await p.$eval('.modal p', e => e.textContent);
  ok(r.startsWith('1 neue und 1 geänderte Adressen'), 'Rückfrage zählt neue und geänderte: ' + r);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [D.settings.adressen.Brakel, D.settings.adressen.Hagen, D.settings.adressen['Dienststelle Hagen'], document.querySelectorAll('.modal').length]);
  ok(r.join('|') === 'Neuer Weg 2, 33034 Brakel|Ringstraße 9, 58097 Hagen|Hauptstraße 5, 58095 Hagen|0', 'übernommen, Fehlendes bleibt, Fenster zu: ' + r.join('|'));

  // Route: Vorschlag übernehmen, dann ab DGS und ab zu Hause (fragt einmal, merkt sich im Browser)
  await p.evaluate(() => { oeffnen('x'); }); await p.waitForTimeout(150);
  await p.evaluate(() => { zuSet(cur(), 'nach', false); renderNow(); });
  ok(await p.evaluate(() => !document.querySelector('.ue-route')), 'ohne Ort: keine Route');
  await p.click('#sec-nach .ort-vor'); await p.waitForTimeout(100);
  await p.click('.ue-route [data-v="dgs"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => decodeURIComponent(OPEN.pop() || ''));
  ok(r === 'https://www.google.com/maps/dir/?api=1&origin=Kilianstraße 26, 33098 Paderborn&destination=Neuer Weg 2, 33034 Brakel&travelmode=driving', 'Route ab DGS: ' + r);
  await p.click('.ue-route [data-v="heim"]'); await p.waitForTimeout(150);
  await p.keyboard.type('Gartenweg 3, 33100 Paderborn'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [decodeURIComponent(OPEN.pop() || ''), localStorage.getItem('bl-start-heim')]);
  ok(r[0].includes('origin=Gartenweg 3, 33100 Paderborn&destination=Neuer Weg 2') && r[1] === 'Gartenweg 3, 33100 Paderborn', 'ab zu Hause: fragt einmal, merkt sich nur im Browser: ' + r.join(' | '));
  ok(await p.evaluate(() => !JSON.stringify(D).includes('Gartenweg')), 'die Heimadresse steht nicht in der Bedarfsliste');
  await p.click('.ue-route [data-v="heim"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !document.querySelector('.modal') && OPEN.length === 1), 'beim zweiten Mal ohne Frage');
  await finish(b, [p]);
})();
