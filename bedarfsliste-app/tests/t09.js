// Alltagsfehler (0.35): Cent-Beträge, Klick direkt nach dem Bearbeiten, Reihenfolge nach Suche, Links und Markieren in der Liste,
// Spaltenrand, Fensterwechsel, lange Namen, Kreisdiagramm mit vielen Förderern, Filteranzeige, aufgeklappter Bedarf weggefiltert,
// Hinweis am Nachweis-Kreis, beschädigte Daten, Uhrzeit der Übergabe
const { chromium, ok, open, finish, fs, T } = require('./lib');
const setData = (text, d) => text.replace(/(<script type="application\/json" id="bl-data">)[\s\S]*?(<\/script>)/, (m, a, c) => a + JSON.stringify(d).replace(/</g, '\\u003c') + c);
(async () => {
  const b = await chromium.launch();
  fs.writeFileSync('vorschau.html', '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(T.PREVIEW, 'utf8') + '</body></html>');
  const p = await open(b, { file: process.cwd() + '/vorschau.html', fakefs: false });
  const R = id => `#list-body tr[data-id="${id}"]`;

  // 1. Cent
  let r = await p.evaluate(() => { const x = blank(); x.summe = 1500.40; x.foerderer.push(ff({ name: 'A', status: 'zugesagt', betrag: 1200.10, zugesagt: 1200.10 }), ff({ name: 'B', status: 'zugesagt', betrag: 300.30, zugesagt: 300.30 }));
    const F = finState(x); x.summe = 1500.80; const G = finState(x); return [F.done, F.d, finText(Object.assign(x, { summe: 1500.40 })), G.d, eur(1500.4), eur(1500)].map(v => String(v).replace(/\u00a0/g, ' ')); });
  ok(r.join('|') === 'true|0|voll gedeckt|0.4|1.500,40 €|1.500 €', 'Cent: 1.200,10 + 300,30 deckt 1.500,40 genau; Lücke 0,40 € bleibt 0,40 €: ' + r.join('|'));

  // 2. erster Klick nach dem Bearbeiten wirkt
  await p.click(R('b-aed') + ' [data-le="titel"]'); await p.keyboard.press('End'); await p.keyboard.type(' X');
  await p.click(R('b-aed') + ' [data-le="ort"]'); await p.waitForTimeout(80);
  r = await p.evaluate(() => [D.bedarfe.find(x => x.id === 'b-aed').titel.endsWith(' X'), !!document.querySelector('tr[data-id="b-aed"] td.l-meta .le-edit'), document.activeElement.className]);
  ok(r[0] && r[1], 'Liste: Name geändert, ein Klick auf den Ort öffnet gleich dessen Feld: ' + r.join('|'));
  await p.keyboard.press('Escape');
  await p.evaluate(() => oeffnen('b-mtw')); await p.waitForTimeout(150);
  const n0 = await p.evaluate(() => cur().foerderer.length);
  await p.click('.pe[data-k="warum"]'); await p.keyboard.type(' und mehr');
  await p.click('[data-act="add-foe"]'); await p.waitForTimeout(80);
  r = await p.evaluate(n => [cur().foerderer.length - n, cur().foerderer[0].warum.endsWith(' und mehr')], n0);
  ok(r.join('|') === '1|true', 'Bedarfsseite: Pro geschrieben, ein Klick auf „Förderer hinzufügen“ wirkt sofort: ' + r.join('|'));
  await p.evaluate(() => { const b = cur(); b.foerderer = b.foerderer.filter(f => f.name); changed(); zurueck(); }); await p.waitForTimeout(150);

  // 3. Reihenfolge nach Suche
  await p.fill('#q', 'sanit'); await p.click('table.list thead [data-act="sort-th"][data-k="titel"]'); await p.fill('#q', '');
  await p.evaluate(() => renderNow());
  r = await p.evaluate(() => { const t = [...document.querySelectorAll('#list-body tr[data-id]')].map(x => D.bedarfe.find(b => b.id === x.dataset.id).titel.toLowerCase()); return t.every((v, i) => !i || t[i - 1].localeCompare(v, 'de') <= 0); });
  ok(r, 'nach Suche, Sortieren und Leeren der Suche: ganze Liste nach Name sortiert');
  await p.click('table.list thead [data-act="sort-th"][data-k="titel"]'); await p.click('table.list thead [data-act="sort-th"][data-k="titel"]');

  // 10. „Filter löschen“ erscheint beim Tippen; Stichwort-Filter wirkt nicht unsichtbar im Archiv weiter
  await p.fill('#q', 'kü');
  ok(await p.evaluate(() => !document.querySelector('.list-head [data-act="clear"]').hidden), 'beim Tippen in die Suche erscheint „Filter löschen“');
  await p.fill('#q', '');
  ok(await p.evaluate(() => document.querySelector('.list-head [data-act="clear"]').hidden), 'Suche leer: „Filter löschen“ wieder weg');
  await p.evaluate(() => { UI.fSw = D.bedarfe.find(x => x.stichworte.length).stichworte[0]; renderNow(); });
  await p.click('button[data-act="tab"][data-v="archiv"]');
  r = await p.evaluate(() => [UI.fSw, document.querySelectorAll('#list-body tr[data-id]').length]);
  ok(r[0] === '' && r[1] > 0, 'Wechsel ins Archiv: Stichwort-Filter zurückgesetzt, Archiv sichtbar: ' + r.join('|'));
  await p.click('button[data-act="tab"][data-v="aktiv"]');

  // 4. Link in den Übergabe-Notizen öffnet den Link, nicht den Bedarf
  await p.evaluate(() => { const b = D.bedarfe.find(x => x.id === 'b-kueche'); b.nach.ueb.info = 'Fotos: https://fotos.beispiel.example/kueche'; changed(); renderNow(); });
  await p.click(R('b-kueche') + ' td.l-ueb a[href]');
  r = await p.evaluate(() => [UI.view, $('#toasts').textContent.includes('Beispiel-Link')]);
  ok(r.join('|') === 'list|true', 'Link in den Notizen: Link statt Bedarf (in der Vorschau nur der Hinweis): ' + r.join('|'));

  // 5. Text markieren öffnet nichts
  await p.evaluate(() => scrollTo(0, 0));
  const m = await (await p.$(R('b-mtw') + ' td.l-meta')).boundingBox();
  await p.mouse.move(m.x + 8, m.y + m.height / 2 - 18); await p.mouse.down(); await p.mouse.move(m.x + m.width - 6, m.y + m.height / 2 + 18, { steps: 6 }); await p.mouse.up();
  r = await p.evaluate(() => [UI.view, !document.querySelector('.le-edit'), String(getSelection()).trim().length > 3]);
  ok(r.join('|') === 'list|true|true', 'Text in der Liste markiert: kein Öffnen, kein Feld, Markierung bleibt: ' + r.join('|'));
  await p.evaluate(() => getSelection().removeAllRanges());

  // 6. bloßer Klick auf einen Spaltenrand legt nichts fest
  await p.click('table.list thead .col-rs[data-i="2"]');
  ok(await p.evaluate(() => localStorage.getItem('bl-colw') === null && !document.querySelector('table.list.fixed')), 'Klick auf den Spaltenrand ohne Ziehen: Breiten bleiben beweglich');

  // 7. Fensterwechsel (Alt+Tab) schließt das Feld nicht
  await p.click(R('b-kueche') + ' [data-le="titel"]');
  r = await p.evaluate(() => { const hf = document.hasFocus; document.hasFocus = () => false; document.activeElement.dispatchEvent(new FocusEvent('blur')); document.hasFocus = hf; return !!document.querySelector('.le-edit'); });
  ok(r, 'Fensterwechsel beim Bearbeiten: Feld bleibt offen');
  await p.keyboard.press('Escape');
  await p.click('button[data-act="new"]');
  r = await p.evaluate(() => { const id = D.bedarfe[0].id, hf = document.hasFocus; document.hasFocus = () => false; document.activeElement.dispatchEvent(new FocusEvent('blur')); document.hasFocus = hf; return [D.bedarfe[0].id === id, !!document.querySelector('.le-edit')]; });
  ok(r.join('|') === 'true|true', '„+ Bedarf“, dann Fensterwechsel: neue Zeile und Feld bleiben: ' + r.join('|'));
  await p.keyboard.press('Escape');

  // 8. langer Name im Feld: ganz sichtbar, deckend
  await p.click('.seg.ansicht [data-v="kompakt"]');
  await p.evaluate(() => { D.bedarfe.find(x => x.id === 'b-aed').titel = 'Defibrillatoren (AED) für den Sanitätsdienst der Gliederungen im ganzen Hochsauerlandkreis und darüber hinaus mit Schulung'; changed(); renderNow(); });
  await p.click(R('b-aed') + ' [data-le="titel"]');
  r = await p.evaluate(() => { const t = document.querySelector('textarea.le-edit'), td = t.closest('td'), a = t.getBoundingClientRect(), c = td.getBoundingClientRect();
    return [getComputedStyle(td).overflow, getComputedStyle(t).backgroundColor !== 'rgba(0, 0, 0, 0)', t.scrollHeight <= t.clientHeight + 2, Math.round(a.height) > Math.round(c.height) - 18]; });
  ok(r.join('|') === 'visible|true|true|true', 'kompakt: langer Name im Feld ganz zu sehen, deckender Hintergrund: ' + r.join('|'));
  await p.keyboard.press('Escape');

  // 11. aufgeklappter Bedarf wird weggefiltert: zuklappen statt alle Zeilen blass
  const kq = await (await p.$(R('b-mtw') + ' td.l-name')).boundingBox(); await p.mouse.click(kq.x + kq.width - 5, kq.y + 5);
  await p.evaluate(() => { UI.q = 'küche'; renderNow(); });
  r = await p.evaluate(() => [String(UI.auf), !!document.querySelector('table.list.hat-auf')]);
  ok(r.join('|') === 'null|false', 'aufgeklappter Bedarf weggefiltert: zugeklappt, nichts bleibt blass: ' + r.join('|'));
  await p.evaluate(() => { UI.q = ''; renderNow(); });
  await p.click('.seg.ansicht [data-v="voll"]');

  // 12. Hinweis am Kreis des Verwendungsnachweises
  r = await p.evaluate(() => { const e = document.querySelector('#list-body .mi[data-le="vn"]'); return [e.getAttribute('title'), e.hasAttribute('steht'), e.hasAttribute('aus"')]; });
  ok(r[0] && r[0].length > 3 && !r[1] && !r[2], 'Kreis des Verwendungsnachweises mit Hinweis („' + r[0] + '“), keine kaputten Attribute');

  // 9. Kreisdiagramm mit vielen Förderern: Beschriftungen als Liste, alles innerhalb
  await p.evaluate(() => { const b = D.bedarfe.find(x => x.id === 'b-mtw'); for (let i = 1; i <= 9; i++) b.foerderer.push(ff({ name: 'Stiftung mit recht langem Namen Nummer ' + i, betrag: 1000 * i })); changed(); oeffnen('b-mtw'); });
  await p.waitForTimeout(200);
  r = await p.evaluate(() => { const s = document.querySelector('#fin-pie svg'), vb = s.viewBox.baseVal, bb = [...s.querySelectorAll('text')].map(t => t.getBBox());
    return [s.querySelectorAll('polyline').length, s.querySelectorAll('rect.ps').length, bb.every(x => x.x >= -1 && x.y >= -1 && x.x + x.width <= vb.width + 1 && x.y + x.height <= vb.height + 1)]; });
  ok(r[0] === 0 && r[1] >= 9 && r[2], 'Kreisdiagramm mit 13 Teilen: Liste neben dem Kreis, nichts läuft über den Rand: ' + r.join('|'));

  // 13 + 14. beschädigte oder seltsame Daten: kein leeres Fenster; Uhrzeit nur als HH:MM
  const html = fs.readFileSync(T.HTML, 'utf8');
  fs.writeFileSync('kaputt.html', setData(html, { bedarfe: [{ id: 'k1', titel: 'Kaputt', summe: '1.500', freigabe: null, nach: { ueb: null }, unterlagen: [{ name: 'X', st: 'komisch' }],
    foerderer: [{ name: 'F', vn: null, status: 'bewilligt', betrag: '2.000' }] }, { id: 'k2', titel: 'Zeit', nach: { ueb: { noetig: true, termin: '2026-11-20', zeit: '<img src=x onerror="window.__xss=1">' } } }] }));
  const q = await open(b, { file: process.cwd() + '/kaputt.html', fakefs: false });
  r = await q.evaluate(() => { const x = D.bedarfe[0], f = x.foerderer[0]; return [!!document.querySelector('#list-body tr[data-id="k1"]'), x.summe, f.status, f.betrag, f.vn.st, x.unterlagen.find(u => u.name === 'X').st, D.bedarfe[1].nach.ueb.zeit, !window.__xss, !BROKEN]; });
  ok(r.join('|') === 'true|1500|geplant|2000|offen|fehlt||true|true', 'unvollständige Daten: Liste erscheint, Werte bereinigt, Uhrzeit ohne Code: ' + r.join('|'));

  await finish(b, [p, q]);
})();
