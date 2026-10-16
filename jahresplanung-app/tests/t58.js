// 0.15.5 PDF-Export neu: Bereiche wie die Reiter (Jahresplanung, Detailpläne, Auswertung), Vorauswahl nach offenem Reiter, Auswertung im PDF
const { chromium, ok, open, finish, fs } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const nPages = f => (fs.readFileSync(f).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const areas = () => p.evaluate(() => $$('.modal .pdf-area').map(a => a.classList.contains('on') ? 1 : 0).join(''));
  const dlg = async view => { await p.evaluate(v => { if (v) { UI.view = v; renderNow(); } pdfDialog(); }, view); await p.waitForTimeout(150); };
  const close = () => p.evaluate(() => { const m = document.querySelector('.modal'); if (m) m.querySelector('header button').click(); });
  const make = async () => { await p.evaluate(() => { window.print = () => {}; }); await p.click('.modal footer button.primary'); await p.waitForTimeout(400);
    const r = await p.evaluate(() => $$('#printdoc .pd-head h1').map(e => e.textContent)); return r; };
  const done = () => p.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  // Testspenden für vier Maßnahmen und „Allgemeine Spenden“ (erfunden)
  const ids = await p.evaluate(() => {
    const y = UI.year, ms = C.ms.filter(x => inYear(x, y) && x.pal != null).slice(0, 4);
    commit(d => { let k = 0; ms.forEach((x, i) => { const m = findM(d, x.id); m.auflage = 10000 * (i + 1); if (i !== 2) m.kosten = 5000 + i * 1000;
      for (let t = 0; t < 40; t++) d.spenden.zu['t' + (k++)] = { m: x.id, d: ds(x.pal + t), b: 2000 + i * 500 }; });
      for (let t = 0; t < 10; t++) d.spenden.zu['a' + t] = { m: 'allg:' + y, d: ds(dn(y + '-03-01') + t * 7), b: 1000 }; });
    return ms.map(x => x.id);
  });

  // ---- A: Vorauswahl = Reiter, der gerade offen ist; „Urlaub & Feiertage“ ist raus
  const pre = {};
  for (const v of ['jahr', 'plaene', 'spenden', 'einstellungen']) { await dlg(v); pre[v] = await areas(); await close(); }
  ok(pre.jahr === '100' && pre.plaene === '010' && pre.spenden === '001' && pre.einstellungen === '100', 'A: Vorauswahl nach Reiter ' + JSON.stringify(pre));
  await dlg('jahr');
  const heads = await p.evaluate(() => [$$('.modal .pdf-ah').map(e => e.textContent).join('|'), /Urlaub & Feiertage/.test(document.querySelector('.modal').textContent)]);
  ok(heads[0] === 'Jahresplanung|Detailpläne|Auswertung' && !heads[1], 'A: drei Bereiche wie die Reiter, kein veralteter Bereich „Urlaub & Feiertage“ (' + heads[0] + ')');

  // ---- B: Häkchen in einem abgewählten Bereich schaltet ihn ein; Seitenzahl wird mitgerechnet
  const c0 = await p.evaluate(() => document.querySelector('.pdf-count').textContent);
  await p.evaluate(() => [...document.querySelectorAll('.modal .pdf-area[data-area="spenden"] label.check')].find(l => /Übersicht/.test(l.textContent)).querySelector('input').click());
  await p.evaluate(() => { const i = [...document.querySelectorAll('.modal .pdf-area[data-area="spenden"] label.check')].find(l => /Übersicht/.test(l.textContent)).querySelector('input'); if (!i.checked) i.click(); });
  const c1 = await p.evaluate(() => document.querySelector('.pdf-count').textContent);
  ok(await areas() === '101' && c0 !== c1, 'B: Häkchen bei „Auswertung“ schaltet den Bereich ein (' + c0 + ' → ' + c1 + ')');
  const t1 = await make();
  ok(t1[0] === 'Maßnahmen ' + 2027 && t1.includes('Auswertung 2027') && t1.includes('Rücklauf im Vergleich 2027') && t1.some(t => /^Auswertung · /.test(t)),
    'B: PDF mit Jahresplanung und Auswertung: ' + t1.join(' | '));
  await done();

  // ---- C: nur Auswertung (aus dem Reiter Auswertung): Übersicht, Vergleich, je Maßnahme eine Seite (ohne eingelesene Dateien keine Seite „Spenden 2027“ – die prüft t59)
  await dlg('spenden');
  const est = await p.evaluate(() => +document.querySelector('.pdf-count').textContent.match(/\d+/)[0]);
  const t2 = await make();
  const names = await p.evaluate(ids => ids.map(id => C.byId.get(id).m.name), ids);
  ok(t2.length === 6 && est === 6 && t2[0] === 'Auswertung 2027' && t2[1] === 'Rücklauf im Vergleich 2027' &&
    names.every((n, i) => t2[2 + i] === 'Auswertung · ' + n), 'C: Auswertung auf ' + t2.length + ' Seiten (geschätzt ' + est + '): ' + t2.join(' | '));
  const tab = await p.evaluate(() => {
    const t = document.querySelector('#printdoc .pd-spt'), rows = [...t.querySelectorAll(':scope > tbody > tr')], foot = t.querySelector(':scope > tfoot > tr');
    const cells = r => [...r.children].map(c => c.textContent);
    return { n: rows.length, allg: rows[rows.length - 1].classList.contains('allg'), first: cells(rows[0]), foot: cells(foot), inputs: t.querySelectorAll('input').length };
  });
  // Maßnahme 1: 40 × 20 € = 800 €, Kosten 5.000 €? → hier 5000 € Kosten bei 800 € Spenden
  ok(!tab.allg && tab.inputs === 0 && tab.first[5] === '800 €' && tab.first[6] === '40' && tab.first[3] === '10.000 Stk.' && tab.first[4] === '5.000 €',
    'C: Übersicht als feste Tabelle (ohne Eingabefelder), ohne Dateien keine Zeile „Spenden 2027“: ' + tab.first.slice(1, 10).join(' / '));
  ok(tab.foot[1] === 'Summe der Maßnahmen' && tab.foot[5] === (800 + 1000 + 1200 + 1400).toLocaleString('de-DE') + ' €' && tab.foot[6] === '160',
    'C: Summenzeile nur der Maßnahmen: ' + tab.foot.slice(1, 10).join(' / '));
  const ch = await p.evaluate(() => $$('#printdoc [data-chart]').map(el => { const s = el.querySelector('svg'); return el.dataset.chart + ':' + (s ? s.getAttribute('width') + 'x' + s.getAttribute('height') : '-'); }));
  ok(ch[0] === 'cmp:1000x440' && ch.slice(1).every(c => /^(span:1000x150|day:1000x150)$/.test(c)) && ch.length === 1 + 2 * 4, 'C: Grafiken in Druckbreite gezeichnet: ' + ch.slice(0, 3).join(', ') + ' … (' + ch.length + ')');
  const tiles = await p.evaluate(() => $$('#printdoc .pd-spm').map(e => e.querySelectorAll('.sp-tile').length).join(','));
  ok(tiles === '4,4,4,4', 'C: Kacheln je Maßnahme: ' + tiles);
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: 'auswertung.pdf', preferCSSPageSize: true, printBackground: true });
  await p.emulateMedia({ media: 'screen' });
  ok(nPages('auswertung.pdf') === 6, 'C: echtes PDF hat ' + nPages('auswertung.pdf') + ' Seiten – nichts läuft über');
  await done();

  // ---- D: nur eine Maßnahme („für …“) – Übersicht bleibt, Vergleich aus
  await dlg('spenden');
  await p.evaluate(id => { const s = document.querySelector('.modal .pdf-for select'); s.value = id; s.dispatchEvent(new Event('change')); }, ids[1]);
  await p.evaluate(() => [...document.querySelectorAll('.modal label.check')].find(l => /Rücklauf/.test(l.textContent)).querySelector('input').click());
  const t3 = await make();
  ok(t3.length === 2 && t3[0] === 'Auswertung 2027' && t3[1] === 'Auswertung · ' + names[1], 'D: Kennzahlen nur für „' + names[1] + '“: ' + t3.join(' | '));
  await done();

  // ---- E: „Wie aktuelle Ansicht“ in der Auswertung: gewählte Maßnahme, Vergleich nur wenn aufgeklappt
  await p.evaluate(id => { UI.view = 'spenden'; UI.spMid = id; UI.spCmp = false; UI.secOpen['sp-ueb'] = true; UI.secOpen['sp-m'] = true; renderNow(); }, ids[2]);
  await dlg();
  await p.click('.modal button:has-text("Wie aktuelle Ansicht")'); await p.waitForTimeout(100);
  const sel = await p.evaluate(() => document.querySelector('.modal .pdf-for select').value);
  const t4 = await make();
  ok(sel === ids[2] && t4.join('|') === 'Auswertung 2027|Auswertung · ' + names[2], 'E: Wie aktuelle Ansicht → ' + t4.join(' | '));
  await done();

  // ---- F: alte gespeicherte Auswahl (mit „urlaub“, alles aus) stört nicht; keine Maßnahme → Hinweis
  await p.evaluate(() => { UI.pdfOpts = { secs: { urlaub: true, mass: false, tl: false, kal: false, ag: false, plaene: false } }; UI.view = 'jahr'; renderNow(); });
  await dlg();
  const f1 = await p.evaluate(() => $$('.modal .pdf-area[data-area="jahr"] label.check input').map(i => i.checked ? 1 : 0).join(''));
  ok(f1 === '11010', 'F: alte Auswahl ohne Teile → Jahresplanung mit Tabelle, Kalender, Zeitleiste vorbelegt (' + f1 + ')');
  await p.click('.modal .mspick button:has-text("keine")');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => /Keine Maßnahme gewählt/.test(document.querySelector('#toasts').textContent) && !document.querySelector('#printdoc')), 'F: ohne Maßnahme kein PDF, Hinweis erscheint');

  // ---- G: Detailpläne ohne Plan in der Auswahl → Hinweis statt leerem PDF
  await p.evaluate(() => { UI.view = 'plaene'; renderNow(); });
  await dlg();
  await p.click('.modal .mspick button:has-text("keine")');
  await p.evaluate(() => { const x = C.ms.find(x => inYear(x, UI.year) && !x.pc); [...document.querySelectorAll('.modal .mspick label.mchk')].find(l => l.textContent.includes(x.m.name)).querySelector('input').click(); });
  const g = await p.evaluate(() => document.querySelector('.modal .pdf-info').textContent);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  ok(/Keine der gewählten Maßnahmen hat einen Detailplan/.test(g) && await p.evaluate(() => /Keine der gewählten Maßnahmen hat einen Detailplan/.test(document.querySelector('#toasts').textContent)), 'G: ' + g);
  await finish(b, pages);
})();
