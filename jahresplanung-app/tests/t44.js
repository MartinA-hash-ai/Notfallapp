// 0.12 Spenden (Beta): Exporte (CSV/Excel) aus „Spendeneingänge …“ einlesen, doppelte Buchungen nur einmal, Regeln → „Prüfen“ → zuordnen,
// Kennzahlen und Grafiken (0.12.6: Klick in „Offen“ schiebt nach „Prüfen“, Filter oben rechts, „Prüfen“ ohne Kopf, Vergleich zum Ausklappen; 0.12.4: Filter eingeklappt, Regel ohne Daueraufträge, „Regel neu anwenden“, Erlös, Spaltenbreiten; 0.12.3: Kasten einklappbar, Wochenenden, Richtwerte aus den Einstellungen, Listen bündig, Häkchen für Daueraufträge; 0.12.2: Name groß in Maßnahmenfarbe, Auflage/Kosten in der Übersicht, Filter ab PAL, Daueraufträge ausblendbar, Grafik ab PAL; 0.12.1: Verwendungszweck immer sichtbar, Daueraufträge markiert, „Alle zurück“), Datenschutz (keine Namen/IBAN in der Planungsdatei), Zusammenführen, Löschen einer Maßnahme
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

  // ---- A: Einlesen und Abgleich
  const a = await p.evaluate(() => ({ n: SP.rows.length, dups: SP.dups, neg: SP.neg, files: SP.files.map(f => f.name + ':' + (f.err || f.recs.length)).join(' '), twins: SP.rows.filter(r => r.name === 'Paul Doppelt').map(r => r.k).join(' '),
    hospiz: SP.rows.filter(r => r.b === 850000).length, max: SP.rows.find(r => r.name === 'Max Muster')?.b, status: document.querySelector('.sp-status')?.textContent }));
  ok(a.n === 11 && a.dups === 4 && a.neg === 1, 'A: 11 verschiedene Buchungen aus 3 Dateien, 4 doppelte übersprungen, 1 Abbuchung ignoriert (' + JSON.stringify(a) + ')');
  ok(/-2$/.test(a.twins.split(' ')[1] || '') && a.hospiz === 1 && a.max === 7550, 'A: zwei gleiche Spenden am selben Tag zählen doppelt; 8.500,00 und 75,50 (Excel) richtig gelesen');
  ok(!/~\$/.test(a.files) && /3 Dateien · 11 Buchungen/.test(a.status), 'A: Excel-Sperrdatei übergangen, Status „' + a.status + '“');

  // ---- A2: Kasten der Maßnahme – Name groß in ihrer Farbe, keine doppelten Angaben; Filter „von“ = PAL
  const a2 = await p.evaluate(() => { const n = document.querySelector('[data-sec="sp-m"] .sec-h .sp-mname'), c = document.createElement('i'); c.style.color = inkC(C.byId.get('m5').color); document.body.append(c);
    const want = getComputedStyle(c).color; c.remove(); return [n && n.textContent, n && getComputedStyle(n).color === want, !document.querySelector('[data-sec="sp-m"] select, [data-sec="sp-m"] input'), document.querySelector('.sp-filter.closed')?.textContent, !!document.querySelector('[data-fk="sp-kos:m5"]'), !document.querySelector('.sp-q')]; });
  ok(a2[0] === 'Jahresbericht' && a2[1] && a2[2] && /^ab 27\.08\.2027 bis 25\.02\.2028$/.test(a2[3]) && a2[4] && a2[5], 'A2: „Jahresbericht“ groß in Maßnahmenfarbe; Auflage und Kosten in der Übersicht; Filter in „Offen“ eingeklappt („' + a2[3] + '“)');
  const tg = await p.evaluate(() => { const b = document.querySelector('.sp-col:first-child .sp-ch .sp-ftog'), c = document.querySelector('.sp-col:first-child').getBoundingClientRect(); return [b && b.textContent, b && c.right - b.getBoundingClientRect().right < 20, b && b.getBoundingClientRect().top - c.top < 30]; });
  ok(tg[0] === 'Filter ▸' && tg[1] && tg[2], 'A2: „Filter ▸“ oben rechts im Kasten „Offen“');
  const mh = await p.evaluate(() => [document.querySelector('.sp-col.mid .sp-ch').textContent, document.querySelector('.sp-col.mid').textContent.includes('Vorschläge'), document.querySelector('.sp-col.mid .sp-empty')]);
  ok(mh[0] === '' && !mh[1] && !mh[2], 'A2: mittlere Spalte ohne Überschrift, Erklärung und Leer-Text');
  await p.click('.sp-ftog'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('[data-fk="sp-fvon"]').value === '2027-08-27' && !!document.querySelector('.sp-q') && UI.spFilt === true), 'A2: „Filter ▸“ klappt Suche, Zeitraum (ab PAL) und Daueraufträge auf');

  // ---- A3: Listen der drei Spalten beginnen auf derselben Höhe, Knöpfe unten bündig; kein Betragsfilter; Kasten einklappbar
  const a3 = await p.evaluate(() => { const t = [...document.querySelectorAll('.sp-col .sp-list')].map(l => Math.round(l.getBoundingClientRect().top)), f = [...document.querySelectorAll('.sp-col .sp-cf')].map(l => Math.round(l.getBoundingClientRect().top));
    return [t.join(','), f.join(','), !document.querySelector('.sp-min'), !!document.querySelector('.sp-filter label.sp-da input[type=checkbox]')]; });
  ok(new Set(a3[0].split(',')).size === 1 && new Set(a3[1].split(',')).size === 1 && a3[2] && a3[3], 'A3: Listen beginnen bündig (' + a3[0] + '), Knöpfe bündig, kein Betragsfilter, Häkchen „Daueraufträge ausblenden“');
  await p.click('[data-sec="sp-m"] .sec-tog'); await p.waitForTimeout(200);
  const a4 = await p.evaluate(() => [!document.querySelector('[data-sec="sp-m"] .sp-tile'), document.querySelector('[data-sec="sp-m"] .sec-sum')?.textContent]);
  await p.click('[data-sec="sp-m"] .sec-tog'); await p.waitForTimeout(200);
  ok(a4[0] && /noch keine Spenden/.test(a4[1]) && await p.evaluate(() => !!document.querySelector('[data-sec="sp-m"] .sp-tile')), 'A3: Kasten der Maßnahme ein- und ausklappbar (zu: „' + a4[1] + '“)');

  // ---- B: Regel „JB“ → Vorschläge in „Prüfen“ (ganzes Wort, im Zeitraum ab PAL)
  await p.fill('.sp-wordin', 'JB'); await p.press('.sp-wordin', 'Enter'); await p.waitForTimeout(250);
  const bb = await p.evaluate(() => ({ regel: JSON.stringify(D.massnahmen.find(m => m.id === 'm5').regel), mid: [...document.querySelectorAll('.sp-col.mid .sp-row')].map(e => SP.byKey.get(e.dataset.k).name).sort().join(', '),
    badge: document.querySelector('.tab-badge')?.textContent, tag: document.querySelector('.sp-col.mid .sp-tag.rule')?.textContent }));
  ok(bb.regel === '{"worte":["JB"],"ab":0,"bis":182}' && bb.mid === 'Anna Probe, Emil Klein, Erika Test, Max Muster' && bb.badge === '4' && bb.tag === 'JB',
    'B: Regel JB (Zeitraum PAL … +182 T.) – in „Prüfen“: ' + bb.mid + ' (nicht „JBL“, nicht vor dem PAL); Reiter zeigt ' + bb.badge);
  await p.fill('.sp-wordin', 'Jahresbericht'); await p.press('.sp-wordin', 'Enter'); await p.waitForTimeout(250);
  const b2 = await p.evaluate(() => [...document.querySelectorAll('.sp-col.mid .sp-row')].length);
  ok(b2 === 5, 'B: „Jahresbericht“ findet auch „JAHRESBE RICHT“ (Zeilenumbruch der Bank) – jetzt 5 in „Prüfen“');
  const bz = await p.evaluate(() => [[...document.querySelectorAll('.sp-col.mid .sp-z')].map(e => e.textContent).join(' | '), document.querySelectorAll('.sp-col.mid .sp-n').length]);
  ok(/Spende JB/.test(bz[0]) && /JAHRESBE RICHT DANKE/.test(bz[0]) && bz[1] === 0, 'B: Verwendungszweck steht in jeder Zeile (' + bz[0].slice(0, 50) + ' …), Namen nur auf Wunsch');

  // ---- C: einen Vorschlag ablehnen, Rest zuordnen; Zuordnung lösen → zurück in „Prüfen“
  const rowOf = (col, name) => p.evaluate(([c, n]) => { const e = [...document.querySelectorAll('.sp-col' + c + ' .sp-row')].find(e => SP.byKey.get(e.dataset.k).name === n); return e && e.dataset.k; }, [col, name]);
  const kB = await rowOf('.mid', 'Bernd Probe');
  await p.click('.sp-col.mid .sp-row[data-k="' + kB + '"]');
  await p.click('.sp-col.mid .sp-cf button:has-text("Markierte zurück")'); await p.waitForTimeout(250);
  const c1 = await p.evaluate(k => [document.querySelectorAll('.sp-col.mid .sp-row').length, JSON.stringify(D.spenden.nein[k]), !!document.querySelector('.sp-col:first-child .sp-row[data-k="' + k + '"]')], kB);
  ok(c1[0] === 4 && c1[1] === '["m5"]' && c1[2], 'C: abgelehnt → links bei „Offen“, die Regel schlägt sie nicht wieder vor');
  await p.click('.sp-col.mid .sp-cf button.primary'); await p.waitForTimeout(250);
  const c2 = await p.evaluate(() => ({ zu: Object.values(D.spenden.zu).map(z => Object.keys(z).join('') + ':' + z.m).join(' '), sum: Object.values(D.spenden.zu).reduce((s, z) => s + z.b, 0),
    right: document.querySelectorAll('.sp-col:last-child .sp-row').length, badge: document.querySelector('.tab-badge')?.textContent || '', tile: document.querySelector('.sp-tile .sp-tv').textContent }));
  ok(c2.right === 4 && c2.sum === 17550 && /^(mdb:m5 ?){4}$/.test(c2.zu) && c2.badge === '' && c2.tile === '176 €', 'C: 4 zugeordnet (175,50 €), gespeichert nur m/d/b; Reiter-Hinweis weg; Kachel ' + c2.tile);
  const kE = await rowOf(':last-child', 'Erika Test');
  await p.dblclick('.sp-col:last-child .sp-row[data-k="' + kE + '"]'); await p.waitForTimeout(250);
  const c3 = await p.evaluate(k => [!D.spenden.zu[k], D.spenden.vor[k], document.querySelectorAll('.sp-col.mid .sp-row').length], kE);
  ok(c3[0] && c3[1] === 'm5' && c3[2] === 1, 'C: Doppelklick rechts löst die Zuordnung – Spende wieder in „Prüfen“');
  await p.evaluate(() => undo()); await p.waitForTimeout(200);
  ok(await p.evaluate(k => D.spenden.zu[k]?.m === 'm5', kE), 'C: Strg+Z stellt die Zuordnung wieder her');

  // ---- D: von Hand – links suchen, Bereich markieren, → Prüfen, zuordnen; „als Regel übernehmen“
  await p.fill('.sp-q', 'Hospiz'); await p.waitForTimeout(450);
  const d0 = await p.evaluate(() => [...document.querySelectorAll('.sp-col:first-child .sp-row')].map(e => SP.byKey.get(e.dataset.k).name));
  ok(d0.length === 2 && d0.includes('Henriette Probe') && d0.includes('Firma Beispiel GmbH'), 'D: Suche „Hospiz“ findet ' + d0.join(', ') + ' (auch „HOSPIZDIENSTE“)');
  const rows = await p.$$('.sp-col:first-child .sp-row');
  await rows[0].click({ modifiers: ['Control'] }); await rows[1].click({ modifiers: ['Shift'] });
  const d1 = await p.evaluate(() => [SPUI.sel.l.size, document.querySelector('.sp-col:first-child .sp-cf button').textContent]);
  ok(d1[0] === 2 && /\(2\)/.test(d1[1]), 'D: Umschalt+Klick markiert beide – „' + d1[1] + '“');
  await p.click('.sp-col:first-child .sp-cf button:first-child'); await p.waitForTimeout(250);
  const d2 = await p.evaluate(() => [...document.querySelectorAll('.sp-col.mid .sp-tag')].map(t => t.textContent).join(','));
  ok(d2 === 'von Hand,von Hand', 'D: beide in „Prüfen“, markiert als „von Hand“');
  await p.click('.sp-col.mid .sp-cf button:has-text("Alle zurück")'); await p.waitForTimeout(250);
  const d3 = await p.evaluate(() => [document.querySelectorAll('.sp-col.mid .sp-row').length, Object.keys(D.spenden.vor).length, document.querySelectorAll('.sp-col:first-child .sp-row').length]);
  ok(d3[0] === 0 && d3[1] === 0 && d3[2] === 2, 'D: „← Alle zurück“ schickt alles aus „Prüfen“ ohne Markieren zurück zu „Offen“');
  await p.evaluate(() => undo()); await p.waitForTimeout(200);
  await p.click('.sp-col.mid .sp-cf button.primary'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => Object.keys(D.spenden.zu).length === 6 && !Object.keys(D.spenden.vor).length), 'D: Strg+Z holt sie zurück; zugeordnet – 6 Spenden bei „Jahresbericht“');

  // ---- D2: einfacher Klick in „Offen“ schiebt die Spende sofort nach „Prüfen“; ein Doppelklick schiebt nicht zwei
  await p.fill('.sp-q', ''); await p.waitForTimeout(450);
  const l0 = await p.evaluate(() => [...document.querySelectorAll('.sp-col:first-child .sp-row')].map(e => e.dataset.k));
  await p.click('.sp-col:first-child .sp-row[data-k="' + l0[0] + '"]'); await p.waitForTimeout(250);
  const d4 = await p.evaluate(k => [D.spenden.vor[k], !document.querySelector('.sp-col:first-child .sp-row[data-k="' + k + '"]'), !!document.querySelector('.sp-col.mid .sp-row[data-k="' + k + '"]')], l0[0]);
  ok(d4[0] === 'm5' && d4[1] && d4[2], 'D2: Klick auf eine offene Spende – verschwindet links, steht in der Mitte');
  await p.dblclick('.sp-col:first-child .sp-row[data-k="' + l0[1] + '"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => Object.keys(D.spenden.vor).length === 2), 'D2: Doppelklick schiebt nur diese eine (nicht zusätzlich die nächste)');
  await p.evaluate(() => { undo(); undo(); renderNow(); }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => Object.keys(D.spenden.vor).length === 0), 'D2: Strg+Z holt beide zurück');

  // ---- E: neue Datei kommt später dazu → passende Spende erscheint von selbst in „Prüfen“
  const DA = ['20.09.2027', '20.09.2027', '15', "'TESTDE11XXX", 'DE00100000000000000032', 'Dora Dauer', "'Zugang/Gutschrift", 'Spende Malteser Lage', "'Dauerauftragsgutschr", "'Paderborn - Lage"].join(';');
  await writeText(p, DIR + 'export4.csv', csv([ERIKA, line('25.09.2027', '40', 'DE00100000000000000031', 'Neu Nachzügler', 'Danke JB'), DA]));
  await p.evaluate(() => spScan({ manual: true })); await p.waitForTimeout(400);
  const e = await p.evaluate(() => ({ n: SP.rows.length, mid: [...document.querySelectorAll('.sp-col.mid .sp-row')].map(e => SP.byKey.get(e.dataset.k).name).join(','), badge: document.querySelector('.tab-badge')?.textContent }));
  ok(e.n === 13 && e.mid === 'Neu Nachzügler' && e.badge === '1', 'E: neue Datei eingelesen (13 Buchungen) – „Neu Nachzügler“ wartet in „Prüfen“, Reiter zeigt 1');
  await p.fill('.sp-q', ''); await p.waitForTimeout(450);
  const da = await p.evaluate(() => { const r = [...document.querySelectorAll('.sp-col:first-child .sp-row.da')]; return [r.length, r[0] && r[0].querySelector('.sp-tag.da')?.textContent, document.querySelectorAll('.sp-col:first-child .sp-row').length]; });
  ok(da[0] === 1 && da[1] === 'Dauerauftrag' && da[2] > 1, 'E: Dauerauftrag bleibt in der Liste, farbig markiert mit „Dauerauftrag“');
  await p.click('.sp-filter .sp-da input'); await p.waitForTimeout(200);
  const da2 = await p.evaluate(() => [document.querySelectorAll('.sp-col:first-child .sp-row.da').length, document.querySelector('.sp-filter .sp-da').textContent, UI.spHideDA, document.querySelector('.sp-filter .sp-da input').checked]);
  ok(da2[0] === 0 && da2[1] === 'Daueraufträge ausblenden' && da2[2] && da2[3], 'E: Häkchen bei „Daueraufträge ausblenden“ blendet sie aus');
  await p.click('.sp-filter .sp-da input'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelectorAll('.sp-col:first-child .sp-row.da').length === 1), 'E: nochmal klicken zeigt sie wieder');
  await p.click('.sp-col.mid .sp-cf button:has-text("Alle zurück")'); await p.waitForTimeout(250);
  const re1 = await p.evaluate(() => [document.querySelectorAll('.sp-col.mid .sp-row').length, document.querySelector('.sp-reapply').textContent, document.querySelector('.sp-reapply').disabled]);
  ok(re1[0] === 0 && re1[1] === '↻ Regel neu anwenden (2)' && !re1[2], 'E: aus Versehen „Alle zurück“ – Knopf „' + re1[1] + '“ (auch der in C abgelehnte Vorschlag)');
  await p.click('.sp-reapply'); await p.waitForTimeout(250);
  const re2 = await p.evaluate(() => [[...document.querySelectorAll('.sp-col.mid .sp-row')].map(e => SP.byKey.get(e.dataset.k).name).join(','), document.querySelector('.sp-reapply').disabled]);
  ok(re2[0] === 'Bernd Probe,Neu Nachzügler' && re2[1], 'E: „Regel neu anwenden“ holt alle passenden Vorschläge zurück nach „Prüfen“ (' + re2[0] + ')');
  await p.click('.sp-col.mid .sp-row:first-child'); await p.click('.sp-col.mid .sp-cf button:has-text("Markierte zurück")'); await p.waitForTimeout(250);
  await p.fill('.sp-wordin', 'Lage'); await p.press('.sp-wordin', 'Enter'); await p.waitForTimeout(250);
  const nd1 = await p.evaluate(() => [...document.querySelectorAll('.sp-col.mid .sp-row.da')].length);
  await p.click('.sp-noda input'); await p.waitForTimeout(250);
  const nd2 = await p.evaluate(() => [document.querySelectorAll('.sp-col.mid .sp-row.da').length, D.massnahmen.find(m => m.id === 'm5').regel.ohneDA]);
  ok(nd1 === 1 && nd2[0] === 0 && nd2[1] === true, 'E: Regel mit „Lage“ schlägt den Dauerauftrag vor – Häkchen „Daueraufträge ausschließen“ nimmt ihn heraus');
  await p.click('.sp-word:has-text("Lage") .sp-x'); await p.click('.sp-noda input'); await p.waitForTimeout(250);

  // ---- F: Kennzahlen mit Auflage und Kosten
  await p.fill('[data-fk="sp-auf:m5"]', '1000'); await p.press('[data-fk="sp-auf:m5"]', 'Tab'); await p.waitForTimeout(150);
  await p.fill('[data-fk="sp-kos:m5"]', '500'); await p.press('[data-fk="sp-kos:m5"]', 'Tab'); await p.waitForTimeout(250);
  const f = await p.evaluate(() => [...document.querySelectorAll('.sp-tile')].map(t => t.textContent));
  ok(f.length === 4 && /^Spendensumme9\.876 €6 Spenden/.test(f[0]) && /^Ø-Spende/.test(f[1]) && /^Responsequote0,6 %bei Auflage 1\.000$/.test(f[2]) && /^ROI19,8Kosten 500 €$/.test(f[3]),
    'F: vier Kacheln – Spendensumme, Ø-Spende, Responsequote 0,6 %, ROI 19,8 – ohne Richtwerte');
  ok(await p.evaluate(() => !/Richtwert/.test(document.querySelector('#main').textContent)), 'F: Richtwerte ausgeblendet (Kacheln, Übersicht, Erklärung)');
  // Richtwerte in den Einstellungen einschalten und ändern
  await p.evaluate(() => { settingsDialog(); }); await p.waitForTimeout(250);
  await p.click('.modal label.check:has-text("Richtwerte bei den Kennzahlen anzeigen") input'); await p.waitForTimeout(150);
  const rws = await p.$$('.modal .rw-in'); await rws[1].fill('5'); await rws[1].press('Tab'); await p.waitForTimeout(150);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(250);
  const rw = await p.evaluate(() => [JSON.stringify(D.settings.richtwerte), [...document.querySelectorAll('.sp-tile')].map(t => t.textContent).slice(2).join(' | '), document.querySelector('.sp-ueb tr[data-mid="m5"] td.below') ? 1 : 0]);
  ok(rw[0] === '{"an":true,"resp":[2.7,5],"roi":[4,5]}' && /▼ unter Richtwert 2,7–5,0 %/.test(rw[1]) && /▲ über Richtwert 4,0–5,0/.test(rw[1]) && rw[2] === 1, 'F: Einstellungen – Richtwerte eingeschaltet und angepasst (' + rw[1] + ')');
  await p.evaluate(() => undo()); await p.evaluate(() => undo()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !D.settings.richtwerte && !/Richtwert/.test(document.querySelector('#main').textContent)), 'F: Strg+Z – wieder ausgeblendet');
  const fl = await p.evaluate(() => { const t = document.querySelectorAll('.sp-tile'), r = i => t[i].getBoundingClientRect(); return [Math.abs(r(0).top - r(1).top) < 3, r(2).top > r(0).bottom - 2, Math.abs(r(2).left - r(0).left) < 3, document.querySelector('.sp-charts').getBoundingClientRect().left > r(1).right]; });
  ok(fl.every(Boolean), 'F: 2×2 angeordnet (Responsequote/ROI unter Summe/Ø), Grafiken rechts daneben');
  ok(await p.evaluate(() => { const m = D.massnahmen.find(m => m.id === 'm5'); return m.kosten === 500 && m.auflage === 1000; }), 'F: Auflage und Kosten an der Maßnahme gespeichert');
  const er = await p.evaluate(() => { const e = document.querySelector('.sp-tiles .sp-erl'), t = document.querySelectorAll('.sp-tile'); return [e && e.className, e && e.textContent, e && e.getBoundingClientRect().top > t[2].getBoundingClientRect().bottom - 2, e && Math.abs(e.getBoundingClientRect().width - (t[1].getBoundingClientRect().right - t[0].getBoundingClientRect().left)) < 3,
    getComputedStyle(document.querySelector('.sp-tl')).fontWeight]; });
  ok(/pos/.test(er[0]) && /^Erlös9\.376 €Spenden 9\.876 € − Kosten 500 €$/.test(er[1]) && er[2] && er[3] && +er[4] >= 600, 'F: grüne Zeile „Erlös 9.376 €“ unter den Kacheln über die ganze Breite; Namen der Kennzahlen fett');

  // ---- G: Grafiken rechts – Zeitspanne (kumuliert) und Spenden pro Tag; kein Abschnitt „Verlauf“ mehr
  const g = await p.evaluate(() => ({ bars: document.querySelectorAll('[data-chart="day"] .sp-bar').length, pal: !!document.querySelector('[data-chart="day"] .sp-palbox'),
    line: !!document.querySelector('[data-chart="span"] .sp-line'), end: document.querySelector('[data-chart="span"] .sp-endl')?.textContent, title: document.querySelector('.sp-cht')?.textContent, verlauf: !!document.querySelector('[data-sec="sp-verlauf"]') }));
  const we = await p.evaluate(() => { const r = [...document.querySelectorAll('[data-chart="day"] .sp-we')], pc = getComputedStyle(document.querySelector('[data-chart="day"] .sp-palbox')).fill; return [r.length, pc]; });
  ok(we[0] >= 4 && !/227, 7, 20|255, 59, 59/.test(we[1]), 'G: Wochenenden grau hinterlegt (' + we[0] + ' Streifen), P am PAL grau statt rot (' + we[1] + ')');
  ok(g.bars === 6 && g.pal && g.line && g.end === '9.876 €' && /28\.08\.2027 – 23\.09\.2027 \(27 Tage\)/.test(g.title) && !g.verlauf,
    'G: Spenden pro Tag (6 Säulen), Zeitspanne „' + g.title + '“ bis ' + g.end + ', rotes P am PAL; Abschnitt „Verlauf“ entfernt');
  const ov = await p.$('[data-chart="span"] .sp-ov'), bx = await ov.boundingBox();
  await p.mouse.move(bx.x + bx.width * 0.6, bx.y + bx.height / 2); await p.mouse.move(bx.x + bx.width * 0.61, bx.y + bx.height / 2); await p.waitForTimeout(150);
  const g2 = await p.evaluate(() => [document.querySelector('#tip').classList.contains('on'), document.querySelector('#tip').textContent, document.querySelector('[data-chart="span"] .sp-xh').getAttribute('visibility')]);
  ok(g2[0] && /€/.test(g2[1]) && g2[2] === 'visible', 'G: Fadenkreuz mit Hinweis „' + g2[1].slice(0, 60) + '“');
  await p.evaluate(() => { SPUI.f.von = '2027-08-01'; renderNow(); }); await p.waitForTimeout(200);
  const kDora = await p.evaluate(() => SP.rows.find(r => r.name === 'Dora Vorher').k);
  await p.dblclick('.sp-col:first-child .sp-row[data-k="' + kDora + '"]'); await p.waitForTimeout(250);
  await p.dblclick('.sp-col.mid .sp-row[data-k="' + kDora + '"]'); await p.waitForTimeout(300);
  const g3 = await p.evaluate(k => [document.querySelector('.sp-cht').textContent, document.querySelector('.sp-col:last-child .sp-row[data-k="' + k + '"] .sp-tag.other')?.textContent, document.querySelector('[data-chart="span"] .sp-endl').textContent], kDora);
  ok(/28\.08\.2027 – 23\.09\.2027 \(27 Tage\).*inkl\. 1 Spende vor dem PAL \(25,00 €\)/.test(g3[0]) && g3[1] === 'vor dem PAL' && g3[2] === '9.901 €',
    'G: Spende vor dem PAL verlängert die Grafik nicht (' + g3[0].replace(/^.*?· /, '') + '), zählt in der Summe (' + g3[2] + '), Markierung „vor dem PAL“');
  await p.dblclick('.sp-col:last-child .sp-row[data-k="' + kDora + '"]'); await p.waitForTimeout(300);
  const g4 = await p.evaluate(() => [document.querySelector('.sp-cht').textContent, document.querySelector('[data-chart="span"] .sp-endl').textContent, document.querySelector('.sp-tile .sp-tv').textContent]);
  ok(!/vor dem PAL/.test(g4[0]) && g4[1] === '9.876 €' && g4[2] === '9.876 €', 'G: wieder herausgenommen – Grafik und Kennzahlen sofort aktualisiert (' + g4[1] + ')');
  await p.click('.sp-col.mid .sp-row[data-k="' + kDora + '"]'); await p.click('.sp-col.mid .sp-cf button:has-text("Markierte zurück")'); await p.waitForTimeout(250);
  await p.evaluate(() => { spResetFilter(findM(D, 'm5')); renderNow(); }); await p.waitForTimeout(200);
  const hit = await p.$$('[data-chart="day"] .sp-hit'), hb = await hit[0].boundingBox();
  await p.mouse.move(5, 5); await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height - 3); await p.waitForTimeout(150);
  ok(/PAL/.test(await p.evaluate(() => document.querySelector('#tip').textContent)), 'G: Maus auf einem Tag zeigt Betrag und Tag ab PAL');
  await p.mouse.move(5, 5);

  // ---- H: zweite Maßnahme → Vergleich; Übersichtstabelle
  await p.click('.sp-ueb tr[data-mid="m4"] td:first-child'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => UI.spMid === 'm4' && document.querySelector('.sp-mname').textContent === 'Sommermailing'), 'H: Klick auf die Zeile in der Übersicht wählt „Sommermailing“');
  await p.fill('.sp-q', 'Nachzügler'); await p.waitForTimeout(450);
  const h0 = await p.evaluate(() => [document.querySelectorAll('.sp-col:first-child .sp-row').length, document.querySelector('.sp-col:first-child .sp-tag.other')?.textContent, document.querySelectorAll('.sp-col.mid .sp-row').length]);
  ok(h0[0] === 1 && h0[1] === 'auch: Jahresbericht' && h0[2] === 0, 'H: bei „Sommermailing“ steht der Vorschlag für „Jahresbericht“ links mit Hinweis „' + h0[1] + '“, nicht in „Prüfen“');
  await p.fill('.sp-q', 'Lautsprecher'); await p.waitForTimeout(450);
  await p.dblclick('.sp-col:first-child .sp-row'); await p.waitForTimeout(250);
  await p.dblclick('.sp-col.mid .sp-row'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !document.querySelector('[data-chart="cmp"]') && /▸ Rücklauf im Vergleich/.test(document.querySelector('.sp-cmptog').textContent) && !/Responsequote =/.test(document.querySelector('[data-sec="sp-ueb"]').textContent)),
    'H: „Rücklauf im Vergleich“ eingeklappt; Erklärzeile zur Responsequote entfernt');
  await p.click('.sp-cmptog'); await p.waitForTimeout(250);
  const h1 = await p.evaluate(() => ({ cmp: document.querySelectorAll('[data-chart="cmp"] .sp-line').length, leg: document.querySelector('[data-chart="cmp"] .sp-legend')?.textContent,
    rows: [...document.querySelectorAll('.sp-ueb tbody tr')].filter(r => r.children[5].textContent !== '–').map(r => r.children[0].textContent.trim() + '=' + r.children[4].textContent).join(' | '),
    cols: [...document.querySelectorAll('.sp-ueb thead th')].map(t => t.textContent).join(','), foot: document.querySelector('.sp-ueb tfoot')?.textContent }));
  ok(h1.cmp === 2 && /Sommermailing/.test(h1.leg) && /Jahresbericht/.test(h1.leg), 'H: Vergleich der Rückläufe mit 2 Linien und Legende');
  ok(h1.rows === 'Sommermailing=35 € | Jahresbericht=9.876 €' && !/Prüfung/.test(h1.cols) && /Summe.*9\.911 €/.test(h1.foot), 'H: Übersicht – ' + h1.rows + ', ohne Spalte „in Prüfung“, Summenzeile');

  const rs = await p.$('.sp-ueb thead th:first-child .col-rs'); await rs.scrollIntoViewIfNeeded(); const rb = await rs.boundingBox(), w0 = await p.evaluate(() => Math.round(document.querySelector('.sp-ueb thead th').getBoundingClientRect().width));
  await p.mouse.move(rb.x + 3, rb.y + rb.height / 2); await p.mouse.down(); await p.mouse.move(rb.x + 63, rb.y + rb.height / 2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250);
  const cw = await p.evaluate(() => [UI.spColW && UI.spColW.name, Math.round(document.querySelector('.sp-ueb thead th').getBoundingClientRect().width)]);
  ok(Math.abs(cw[0] - (w0 + 60)) <= 2 && Math.abs(cw[1] - cw[0]) <= 2, 'H: Spalte „Maßnahme“ in der Übersicht breiter gezogen (' + w0 + ' → ' + cw[1] + ' px), gemerkt');
  await p.dblclick('.sp-ueb thead th:first-child .col-rs'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !UI.spColW.name), 'H: Doppelklick setzt die Breite zurück');

  // ---- I: Datenschutz – in der Planungsdatei keine Namen, IBAN, Verwendungszwecke
  await p.evaluate(() => saveAll({ manual: true })); await p.waitForTimeout(600);
  const txt = await readF(p), data = dataOf(txt);
  ok(Object.keys(data.spenden.zu).length === 7 && !/Erika|DE0010000|Spende JB|HOSPIZ/.test(JSON.stringify(data)), 'I: gespeichert – 7 Zuordnungen, keine Namen/IBAN/Verwendungszwecke in der Datei');
  ok(/Spenden: 1 der Maßnahme „Sommermailing“ zugeordnet/.test(JSON.stringify(data.log)), 'I: Änderungsprotokoll nennt die Zuordnung');

  // ---- J: Zusammenführen (zwei haben gleichzeitig zugeordnet) und Maßnahme löschen
  const j = await p.evaluate(() => {
    const base = JSON.parse(JSON.stringify(D)), mine = JSON.parse(JSON.stringify(D)), theirs = JSON.parse(JSON.stringify(D));
    mine.spenden.zu.aaa = { m: 'm5', d: '2027-09-01', b: 100 }; theirs.spenden.zu.bbb = { m: 'm4', d: '2027-09-02', b: 200 }; delete theirs.spenden.zu[Object.keys(base.spenden.zu)[0]];
    const r = merge3(base, mine, theirs);
    return [r.conflicts.length, !!r.data.spenden.zu.aaa, !!r.data.spenden.zu.bbb, Object.keys(r.data.spenden.zu).length];
  });
  ok(j[0] === 0 && j[1] && j[2] && j[3] === 8, 'J: Zusammenführen übernimmt beide Seiten (eigene + fremde Zuordnung, fremdes Lösen)');
  await p.evaluate(() => { commit(d => { d.massnahmen = d.massnahmen.filter(m => m.id !== 'm4'); spForget(d, 'm4'); }); }); await p.waitForTimeout(200);
  const j2 = await p.evaluate(() => [Object.values(D.spenden.zu).some(z => z.m === 'm4'), Object.keys(D.spenden.zu).length, checkData().filter(c => /Spenden-Zuordnung/.test(c.text)).length]);
  ok(!j2[0] && j2[1] === 6 && j2[2] === 0, 'J: Maßnahme gelöscht → ihre Zuordnung entfernt, Datenprüfung ohne Befund');
  await p.evaluate(() => { D.spenden.zu.zzz = { m: 'weg', d: '2027-09-01', b: 1 }; });
  ok(await p.evaluate(() => checkData().some(c => /1 Spenden-Zuordnung zu einer gelöschten Maßnahme/.test(c.text))), 'J: Datenprüfung findet Zuordnung zu gelöschter Maßnahme');
  await p.evaluate(() => { delete D.spenden.zu.zzz; undo(); renderNow(); }); await p.waitForTimeout(200);

  // ---- K: Datei über „+ Datei hinzufügen“ ablegen (gleicher Name, anderer Inhalt → „(2)“)
  const tmp = path.join(__dirname, 'out', 'export1.csv');
  fs.writeFileSync(tmp, csv([line('26.09.2027', '60', 'DE00100000000000000041', 'Upload Test', 'JB Upload')]));
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.view-head button:has-text("Datei hinzufügen")')]);
  await fc.setFiles(tmp); await p.waitForTimeout(700);
  const k = await p.evaluate(() => [Object.keys(__fs.files).filter(n => n.includes('Spendeneingänge 2027/')).map(n => n.split('/').pop()).sort().join(','), SP.rows.some(r => r.name === 'Upload Test')]);
  ok(/export1 \(2\)\.csv/.test(k[0]) && k[1], 'K: Datei abgelegt als „export1 (2).csv“ (nichts überschrieben) und eingelesen');

  // ---- L: ohne Ordner – Hinweis statt Fehler; Auswertung aus der Planungsdatei bleibt
  const p2 = await open(b); pages.push(p2);
  await p2.evaluate(d => { loadData(normalize(d)); UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'm5'; renderNow(); }, data); await p2.waitForTimeout(300);
  const l = await p2.evaluate(() => [!!document.querySelector('.banner.sp-notice'), document.querySelectorAll('.sp-col:last-child .sp-row').length, document.querySelectorAll('.sp-col:last-child .sp-tag.gone').length, document.querySelector('.sp-tile .sp-tv').textContent]);
  ok(l[0] && l[1] === 6 && l[2] === 6 && l[3] === '9.876 €', 'L: ohne verbundenen Ordner Hinweis; Zugeordnetes und Kennzahlen kommen aus der Planungsdatei (' + l[3] + ')');
  await finish(b, pages);
})();
