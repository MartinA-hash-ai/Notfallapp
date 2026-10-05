// 0.12.7 Auswertung: Reiter „Auswertung Beta“, ohne Überschrift; Hinweis-Spalte; allgemeine Spenden je Jahr; Regel mit Live-Vorschau;
// ein Zuordnen-Knopf; Vergleich mit Ein-/Ausblenden; Spaltenbreiten wie in der Jahresplanung; rote P im dunklen Design (Detailplan)
const { chromium, ok, open, connect, readF, dataOf, finish, fs, MAIN } = require('./lib');
const path = require('path');
const DIR = 'Spendeneingänge 2027/';
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const line = (d, b, iban, name, zweck, konto = 'Paderborn - Test') => [d, d, b, "'TESTDE11XXX", iban, name, "'Zugang/Gutschrift", zweck, "'Spendengutschrift", "'" + konto].join(';');
const csv = rows => '﻿' + [HEAD, ...rows].join('\r\n') + '\r\n';
const TWIN = line('03.09.2027', '10', 'DE00100000000000000005', 'Paul Doppelt', 'Spende');
const HOSPIZ = line('10.09.2027', '8.500,00', "'DE00100000000000000007", 'Henriette Probe', "'SPEND E HOSPIZDIENSTE", 'Paderborn - Hospiz');
const ERIKA = line('15.09.2027', '50', 'DE00100000000000000011', 'Erika Test', 'JB Spende Erika Test');
const EXPORT1 = csv([
  line('28.08.2027', '20', 'DE00100000000000000001', 'Anna Probe', 'Spende JB'),
  line('30.08.2027', '100,00', 'DE00100000000000000002', 'Bernd Probe', 'JAHRESBE RICHT DANKE'),
  line('01.09.2027', '35', 'DE00100000000000000003', 'Carla Probe', 'JBL Lautsprecher Erstattung'),
  line('02.09.2027', '-15,00', 'DE00100000000000000004', 'Rück Lastschrift', 'Ruecklastschrift'),
  TWIN, TWIN, HOSPIZ,
  line('15.08.2027', '25', 'DE00100000000000000008', 'Dora Vorher', 'JB')]);
const EXPORT2 = csv([TWIN, TWIN, HOSPIZ, ERIKA, line('18.09.2027', '30', 'DE00100000000000000012', 'Emil Klein', 'jb danke')]);
const writeBytes = (p, name, bytes) => p.evaluate(([n, b]) => { __fs.files['/Mailing/' + n] = { data: new Uint8Array(b), lm: 70000 + (++__fs.n) }; }, [name, [...bytes]]);
const writeText = (p, name, text) => writeBytes(p, name, Buffer.from(text, 'utf8'));

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await writeText(p, DIR + 'export1.csv', EXPORT1);
  await writeText(p, DIR + 'export2.csv', EXPORT2);
  await writeBytes(p, DIR + 'export3.xlsx', fs.readFileSync(path.join(__dirname, 'fixtures', 'spenden_test.xlsx')));
  await writeText(p, DIR + '~$export3.xlsx', 'Sperrdatei');
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'm5'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length > 0); await p.waitForTimeout(300);

  // ---- A: Reiter und Kopf
  const a = await p.evaluate(() => [[...document.querySelectorAll('nav.tabs .tab')].pop().textContent, !document.querySelector('#main .view-head'), !/Exporte \(CSV oder Excel\)/.test(document.querySelector('#main').textContent),
    !!document.querySelector('[data-sec="sp-ueb"] .sec-h .tools button'), document.querySelector('[data-sec="sp-zu"] .sec-t').textContent]);
  ok(/^AuswertungBeta/.test(a[0]) && a[1] && a[2] && a[3] && a[4] === 'Spenden zuordnen', 'A: Reiter „' + a[0] + '“, keine Überschrift „Spenden 2027“ und kein Erklärsatz; Einlesen-Knöpfe im Kopf der Übersicht; „Spenden zuordnen“');

  // ---- B: Hinweis-Spalte = Hinweis aus der Jahresplanung
  await p.fill('[data-fk="sp-hin:m5"]', 'Thema: Jahresbericht 26/27'); await p.press('[data-fk="sp-hin:m5"]', 'Tab'); await p.waitForTimeout(200);
  const bb = await p.evaluate(() => [D.massnahmen.find(m => m.id === 'm5').hinweis, [...document.querySelectorAll('.sp-ueb thead th')].map(t => t.textContent).slice(0, 3).join(',')]);
  ok(bb[0] === 'Thema: Jahresbericht 26/27' && bb[1] === 'Maßnahme,Hinweis,PAL', 'B: Spalte „Hinweis“ nach „Maßnahme“; Eingabe landet im Hinweis der Maßnahme (wie in der Jahresplanung)');

  // ---- C: Regel mit Live-Vorschau: Tippen filtert „Offen“, Enter übernimmt
  await p.click('.sp-wordin'); await p.keyboard.type('JB'); await p.waitForTimeout(450);
  const c1 = await p.evaluate(() => [[...document.querySelectorAll('.sp-col:first-child .sp-row')].map(e => SP.byKey.get(e.dataset.k).name).sort().join(', '), document.querySelector('.sp-col:first-child .sp-ch').textContent, !(D.massnahmen.find(m => m.id === 'm5').regel), document.activeElement && document.activeElement.className]);
  ok(c1[0] === 'Anna Probe, Emil Klein, Erika Test, Max Muster' && /Vorschau für „JB“/.test(c1[1]) && c1[2] && c1[3] === 'sp-wordin', 'C: beim Tippen zeigt „Offen“ sofort die passenden (' + c1[0] + '), Regel noch unverändert, Eingabe behält den Fokus');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const c2 = await p.evaluate(() => [JSON.stringify(D.massnahmen.find(m => m.id === 'm5').regel.worte), document.querySelectorAll('.sp-col.mid .sp-row').length, document.querySelectorAll('.sp-col:first-child .sp-row').length]);
  ok(c2[0] === '["JB"]' && c2[1] === 4 && c2[2] === 6, 'C: Enter übernimmt „JB“ – 4 in der Mitte, „Offen“ wieder ungefiltert (6)');

  // ---- D: ein Knopf zum Zuordnen (markierte oder alle), Knöpfe einzeilig
  const d0 = await p.evaluate(() => { const f = document.querySelector('.sp-col.mid .sp-cf'), bs = [...f.querySelectorAll('button')]; return [bs.map(b => b.textContent).join(' | '), new Set(bs.map(b => Math.round(b.getBoundingClientRect().top))).size]; });
  ok(d0[0] === '← Alle zurück | ← Markierte zurück | Alle 4 zuordnen →' && d0[1] === 1, 'D: mittlere Spalte – drei Knöpfe in einer Zeile („' + d0[0] + '“)');
  await p.click('.sp-col.mid .sp-row:first-child'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.querySelector('.sp-col.mid .sp-cf button.primary').textContent === '1 markierte zuordnen →'), 'D: mit Markierung heißt der Knopf „1 markierte zuordnen →“');
  await p.click('.sp-col.mid .sp-cf button.primary'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => Object.keys(D.spenden.zu).length === 1 && document.querySelectorAll('.sp-col.mid .sp-row').length === 3), 'D: nur die markierte zugeordnet, 3 bleiben in der Mitte');
  await p.click('.sp-col.mid .sp-cf button.primary'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => Object.keys(D.spenden.zu).length === 4), 'D: ohne Markierung ordnet derselbe Knopf alle zu');

  // ---- E: allgemeine Spenden des Jahres
  const e0 = await p.evaluate(() => { const r = document.querySelector('.sp-ueb tbody tr'); return [r.dataset.mid, r.children[0].textContent.trim(), !r.querySelector('input')]; });
  ok(e0[0] === 'allg:2027' && e0[1] === 'Allgemeine Spenden 2027' && e0[2], 'E: erste Zeile der Übersicht: „Allgemeine Spenden 2027“ (ohne Auflage/Kosten)');
  await p.click('.sp-ueb tbody tr:first-child td:first-child'); await p.waitForTimeout(300);
  const e1 = await p.evaluate(() => [document.querySelector('.sp-mname').textContent, document.querySelectorAll('.sp-tile').length, !document.querySelector('.sp-erl'), document.querySelector('[data-fk="sp-fvon"]') ? 1 : 0, SPUI.f.von + '…' + SPUI.f.bis, document.querySelector('.sp-rule').textContent]);
  ok(e1[0] === 'Allgemeine Spenden 2027' && e1[1] === 2 && e1[2] && e1[4] === '2027-01-01…2027-12-31' && /Kalenderjahr 2027/.test(e1[5]) && /Daueraufträge vorschlagen/.test(e1[5]),
    'E: gewählt – Name groß, 2 Kacheln (Summe, Ø), kein Erlös; Zeitraum = Kalenderjahr; Häkchen „Daueraufträge vorschlagen“');
  await writeText(p, DIR + 'da.csv', csv([['20.09.2027', '20.09.2027', '15', "'TESTDE11XXX", 'DE00100000000000000032', 'Dora Dauer', "'Zugang/Gutschrift", 'Spende Malteser Lage', "'Dauerauftragsgutschr", "'Paderborn - Lage"].join(';'),
    ['20.10.2027', '20.10.2027', '15', "'TESTDE11XXX", 'DE00100000000000000032', 'Dora Dauer', "'Zugang/Gutschrift", 'Spende Malteser Lage', "'Dauerauftragsgutschr", "'Paderborn - Lage"].join(';')]));
  await p.evaluate(() => spScan({ manual: true })); await p.waitForTimeout(400);
  await p.click('.sp-noda input'); await p.waitForTimeout(300);
  const e2 = await p.evaluate(() => [[...document.querySelectorAll('.sp-col.mid .sp-row')].map(e => SP.byKey.get(e.dataset.k).name).join(','), JSON.stringify(D.spenden.allg), document.querySelector('.tab-badge')?.textContent]);
  ok(e2[0] === 'Dora Dauer,Dora Dauer' && e2[1] === '{"2027":{"regel":{"worte":[],"da":true}}}' && e2[2] === '2', 'E: „Daueraufträge vorschlagen“ – beide Daueraufträge in der Mitte, Regel gespeichert, Reiter zeigt 2');
  await p.click('.sp-col.mid .sp-cf button.primary'); await p.waitForTimeout(300);
  const e3 = await p.evaluate(() => [Object.values(D.spenden.zu).filter(z => z.m === 'allg:2027').length, document.querySelector('.sp-tile .sp-tv').textContent, document.querySelector('.sp-ueb tbody tr').children[5].textContent,
    document.querySelector('.sp-ueb tfoot')?.textContent || '', checkData().filter(c => /gelöschten Maßnahme/.test(c.text)).length]);
  ok(e3[0] === 2 && e3[1] === '30 €' && e3[2] === '30 €' && /Summe der Maßnahmen.*175 €|Summe der Maßnahmen/.test(e3[3]) && !/205/.test(e3[3]) && e3[4] === 0, 'E: zugeordnet (30 €) – in der Übersicht, nicht in der Summe der Maßnahmen, keine „gelöschte Maßnahme“ in der Datenprüfung');
  const e4 = await p.evaluate(() => { const n = normalize(JSON.parse(JSON.stringify(D))); return [Object.values(n.spenden.zu).filter(z => z.m === 'allg:2027').length, JSON.stringify(n.spenden.allg)]; });
  ok(e4[0] === 2 && e4[1] === '{"2027":{"regel":{"worte":[],"da":true}}}', 'E: bleibt nach dem Neuladen erhalten');
  const e5 = await p.evaluate(() => { const base = JSON.parse(JSON.stringify(D)), mine = JSON.parse(JSON.stringify(D)), theirs = JSON.parse(JSON.stringify(D)); theirs.spenden.zu.xyz = { m: 'm5', d: '2027-09-01', b: 100 }; const r = merge3(base, mine, theirs); return [JSON.stringify(r.data.spenden.allg), !!r.data.spenden.zu.xyz, r.conflicts.length]; });
  ok(e5[0] === '{"2027":{"regel":{"worte":[],"da":true}}}' && e5[1] && e5[2] === 0, 'E: Zusammenführen behält die Regel der allgemeinen Spenden');

  // ---- F: Vergleich – Maßnahmen ein- und ausblenden
  await p.click('.sp-ueb tr[data-mid="m4"] td:first-child'); await p.waitForTimeout(250);
  await p.evaluate(() => { UI.spFilt = true; renderNow(); }); await p.waitForTimeout(100);
  await p.fill('.sp-q', 'Lautsprecher'); await p.waitForTimeout(450);
  await p.click('.sp-col:first-child .sp-row'); await p.waitForTimeout(250);
  await p.click('.sp-col.mid .sp-cf button.primary'); await p.waitForTimeout(250);
  await p.click('.sp-cmptog'); await p.waitForTimeout(250);
  const f0 = await p.evaluate(() => [[...document.querySelectorAll('.sp-cpill')].map(b => b.textContent).join(','), document.querySelectorAll('[data-chart="cmp"] .sp-line').length]);
  ok(f0[0] === 'Sommermailing,Jahresbericht' && f0[1] === 2, 'F: Knöpfe je Maßnahme über dem Vergleich, beide Linien sichtbar');
  await p.click('.sp-cpill:has-text("Sommermailing")'); await p.waitForTimeout(250);
  const f1 = await p.evaluate(() => [document.querySelectorAll('[data-chart="cmp"] .sp-line').length, document.querySelector('.sp-cpill.off')?.textContent, JSON.stringify(UI.spCmpOff), document.querySelector('.sp-ueb tbody tr.on')?.dataset.mid]);
  ok(f1[0] === 1 && f1[1] === 'Sommermailing' && f1[2] === '["m4"]' && f1[3] === 'm4', 'F: Klick blendet „Sommermailing“ im Vergleich aus – die Auswahl in der Tabelle bleibt');
  await p.click('.sp-cpill:has-text("Sommermailing")'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.querySelectorAll('[data-chart="cmp"] .sp-line').length === 2), 'F: nochmal klicken blendet sie wieder ein');

  // ---- G: Spaltenbreite wie in der Jahresplanung – nur die Spalte und ihre rechte Nachbarin ändern sich
  const ths = () => p.evaluate(() => [...document.querySelectorAll('.sp-ueb thead th')].map(t => Math.round(t.getBoundingClientRect().width)));
  const w0 = await ths(), rs = await p.$('.sp-ueb thead th:nth-child(3) .col-rs'); await rs.scrollIntoViewIfNeeded(); const rb = await rs.boundingBox();
  await p.mouse.move(rb.x + 3, rb.y + rb.height / 2); await p.mouse.down(); await p.mouse.move(rb.x + 43, rb.y + rb.height / 2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250);
  const w1 = await ths();
  ok(Math.abs(w1[2] - w0[2] - 40) <= 2 && Math.abs(w0[3] - w1[3] - 40) <= 2 && w1[0] === w0[0] && w1[5] === w0[5], 'G: „PAL“ 40 px breiter gezogen – „Auflage“ daneben 40 px schmaler, übrige Spalten bleiben');

  // ---- H: dunkles Design – P im Detailplan rot (Kopf und PAL-Zeile)
  await p.evaluate(() => { setTheme('dark'); UI.view = 'plaene'; UI.planSel = 'm4'; renderNow(); }); await p.waitForTimeout(300);
  const hh = await p.evaluate(() => { const red = getComputedStyle(document.documentElement).getPropertyValue('--red').trim(), c = document.createElement('i'); c.style.color = red; document.body.append(c); const want = getComputedStyle(c).color; c.remove();
    const bg = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; }; return [bg('.ph-pal .chip.demo.P'), bg('.pl-row .paldate .palchip'), want, document.documentElement.dataset.theme]; });
  ok(hh[3] === 'dark' && hh[0] === hh[2] && hh[1] === hh[2], 'H: dunkles Design – P im Kopf und in der PAL-Zeile rot (' + hh[0] + ')');
  await finish(b, pages);
})();
