// 0.13.5: „Daten zurücksetzen …“ (Spenden-Zuordnungen, Exportdateien, Maßnahmen eines Jahres – mit Datensicherung);
// neue Exporte landen im Ordner „Spendeneingänge JJJJ“ des Jahres, aus dem die Buchungen stammen;
// 0.13.6: neue Maßnahme mit nur einem PAL bekommt keine Starts; „+ Detailplan anlegen“ rot
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
let n = 0;
const line = (d, b, name, zweck) => [d, d, b, "'TESTDE11XXX", 'DE0010000000000000' + String(++n).padStart(4, '0'), name, "'Zugang/Gutschrift", zweck, "'Spendengutschrift", "'Paderborn - Test"].join(';');
const csv = rows => '﻿' + [HEAD, ...rows].join('\r\n') + '\r\n';
const files = p => p.evaluate(() => Object.keys(__fs.files).filter(k => /Spendeneing/.test(k)).map(k => k.replace('/Mailing/', '')).sort().join(','));

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/alt.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv([line('03.09.2027', '20', 'Anna Probe', 'JB')]));
  await p.evaluate(() => { UI.year = 2026; UI.view = 'spenden'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length === 1); await p.waitForTimeout(200);

  // ---- A: Export mit Buchungen aus 2026 landet in „Spendeneingänge 2026“ (nicht im vorhandenen Ordner 2027)
  await p.evaluate(t => spAddFiles([new File([t], '20261005_export.csv')]), csv([line('05.10.2026', '50', 'Bernd Probe', 'Herbst'), line('06.10.2026', '30', 'Carla Probe', 'Herbst')]));
  await p.waitForSelector('.modal'); await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  ok(await files(p) === 'Spendeneingänge 2026/20261005_export.csv,Spendeneingänge 2027/alt.csv', 'A: 2026er Export im Ordner „Spendeneingänge 2026“ abgelegt (' + await files(p) + ')');

  // ---- B: Testdaten: zwei Maßnahmen mit PAL 2026, Zuordnungen von Hand, eine ausgeschlossene Spende, allgemeine Regel
  await p.evaluate(() => {
    const k = w => SP.rows.find(r => r.name.startsWith(w)).k, ks = [k('Anna'), k('Bernd'), k('Carla')];
    commit(d => {
      for (const [id, nm, pal] of [['t26a', 'Test 2026 A', '2026-05-04'], ['t26b', 'Test 2026 B', '2026-09-21']]) { const c = JSON.parse(JSON.stringify(d.massnahmen.find(m => !m.plan))); Object.assign(c, { id, name: nm, pal, regel: { worte: ['Herbst'], ab: 0, bis: 60 } }); d.massnahmen.push(c); }
      const r = SP.byKey.get(ks[1]), q = SP.byKey.get(ks[0]);
      d.spenden.zu[ks[1]] = { m: 't26b', d: ds(r.d), b: r.b }; d.spenden.zu[ks[0]] = { m: 'm5', d: ds(q.d), b: q.b }; d.spenden.nein[ks[2]] = ['t26b'];
      d.spenden.allg = { 2026: { regel: { worte: ['Spende'], da: true } } };
    });
  });
  const n27 = await p.evaluate(() => D.massnahmen.filter(m => m.pal && m.pal.startsWith('2027')).length);

  // ---- C: Dialog „Daten zurücksetzen …“
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Daten zurücksetzen")'); await p.waitForTimeout(250);
  const c0 = await p.evaluate(() => { const m = document.querySelector('.modal'); return [m.querySelector('h2').textContent, [...m.querySelectorAll('.rs-opt')].map(l => (l.querySelector('input').checked ? '☑' : '☐') + l.querySelector('b').textContent).join(' | '), m.querySelector('.rs-yr select').value, m.querySelector('.rs-ms').textContent, m.textContent]; });
  ok(c0[0] === 'Daten zurücksetzen' && /^☑Alle Spenden-Zuordnungen entfernen \| ☐Auch die Schlagwort-Regeln/.test(c0[1]) && /☐Exportdateien der Spendeneingänge löschen \| ☐Maßnahmen löschen/.test(c0[1]) && c0[2] === '2026' && /^2 Maßnahmen: Test 2026 A, Test 2026 B/.test(c0[3]),
    'C: Auswahl – ' + c0[1] + ' · Jahr ' + c0[2] + ': ' + c0[3]);
  ok(/2 zugeordnet, 1 ausgeschlossen/.test(c0[4]) && /2 Dateien: Spendeneingänge 2026\/20261005_export\.csv, Spendeneingänge 2027\/alt\.csv/.test(c0[4]) && /Datensicherung/.test(c0[4]), 'C: zeigt, was betroffen ist (Zuordnungen, Dateien, Datensicherung)');
  await p.click('.modal .rs-opt:has-text("Exportdateien") input'); await p.click('.modal .rs-yr .rs-opt input');
  await p.click('.modal footer button.danger'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => /Wirklich zurücksetzen/.test(document.querySelector('.modal h2').textContent)), 'C: zweite Rückfrage');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.modal footer button.primary')]);
  await p.waitForTimeout(600);
  const c1 = await p.evaluate(() => [Object.keys(D.spenden.zu).length, Object.keys(D.spenden.nein).length, JSON.stringify(D.spenden.allg || {}), D.massnahmen.filter(m => /^Test 2026/.test(m.name)).length, SP.rows.length,
    D.massnahmen.some(m => m.regel), D.massnahmen.filter(m => m.pal && m.pal.startsWith('2027')).length]);
  ok(/^Jahresplanung_Daten_.*\.json$/.test(dl.suggestedFilename()), 'C: vorher Datensicherung heruntergeladen (' + dl.suggestedFilename() + ')');
  ok(c1[0] === 0 && c1[1] === 0 && c1[2] === '{}' && c1[3] === 0 && c1[4] === 0 && c1[6] === n27, 'C: keine Zuordnungen mehr, 2026 leer, keine Spenden mehr eingelesen – die ' + n27 + ' Maßnahmen aus 2027 bleiben');
  ok(c1[5] === false, 'C: Regeln der gelöschten Maßnahmen weg (andere hatten keine)');
  ok(await files(p) === '', 'C: Exportdateien gelöscht');
  await p.evaluate(() => { UI.year = 2026; UI.view = 'jahr'; renderNow(); }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelectorAll('.mtable tbody tr[data-m]').length === 0), 'C: Jahresplanung 2026 ist leer');

  // ---- D: Strg+Z holt die Planungsdaten zurück (Dateien nicht)
  await p.evaluate(() => undo()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => Object.keys(D.spenden.zu).length === 2 && D.massnahmen.some(m => m.name === 'Test 2026 A')), 'D: Strg+Z macht das Zurücksetzen der Daten rückgängig');
  // ---- E: neue Maßnahme – nur PAL, keine automatischen Starts (Selektion, Inhalt, Produktion)
  await p.evaluate(() => { UI.year = 2027; UI.view = 'jahr'; UI.secOpen.mass = true; renderNow(); }); await p.waitForTimeout(150);
  await p.click('button:has-text("+ Maßnahme")'); await p.waitForTimeout(200);
  const nid = await p.evaluate(() => D.massnahmen[D.massnahmen.length - 1].id);
  await p.fill('[data-fk="m:' + nid + ':pal"]', '2027-05-14'); await p.$eval('[data-fk="m:' + nid + ':pal"]', e => e.blur()); await p.waitForTimeout(200);
  const e0 = await p.evaluate(id => { const x = C.byId.get(id); return [ds(x.pal), JSON.stringify(x.m.vorlauf), Object.keys(x.st).length, [...document.querySelectorAll('.mtable tr[data-m="' + id + '"] td.ph input[type=date]')].map(i => i.value).join('|')]; }, nid);
  ok(e0[0] === '2027-05-14' && e0[1] === '{}' && e0[2] === 0 && !/\d/.test(e0[3]), 'E: neue Maßnahme mit PAL 14.05.2027 – keine Starts eingetragen (' + e0[1] + ')');
  await p.fill('.mtable tr[data-m="' + nid + '"] td.ph input[type=date] >> nth=0', '2027-03-01'); await p.press('.mtable tr[data-m="' + nid + '"] td.ph input[type=date] >> nth=0', 'Enter'); await p.waitForTimeout(200);
  ok(await p.evaluate(id => ds(C.byId.get(id).st.S) === '2027-03-01' && C.byId.get(id).st.I == null, nid), 'E: Selektion von Hand eingetragen – Inhalt bleibt leer');
  // ---- F: „+ Detailplan anlegen“ ist rot
  await p.evaluate(() => { UI.view = 'plaene'; renderNow(); }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => { const b = [...document.querySelectorAll('.ptabs button')].find(x => /Detailplan anlegen/.test(x.textContent)); return b && b.classList.contains('primary'); }), 'F: „+ Detailplan anlegen“ als roter Knopf');
  await finish(b, pages);
})();
