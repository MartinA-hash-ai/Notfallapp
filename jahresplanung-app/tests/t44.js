// 0.12 Spenden (Beta): Exporte (CSV/Excel) aus „Spendeneingänge …“ einlesen, doppelte Buchungen nur einmal, Regeln → „Prüfen“ → zuordnen,
// Kennzahlen und Grafiken (0.12.1: Verwendungszweck immer sichtbar, Daueraufträge markiert, „Alle zurück“), Datenschutz (keine Namen/IBAN in der Planungsdatei), Zusammenführen, Löschen einer Maßnahme
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
  await rows[0].click(); await rows[1].click({ modifiers: ['Shift'] });
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

  // ---- E: neue Datei kommt später dazu → passende Spende erscheint von selbst in „Prüfen“
  const DA = ['20.09.2027', '20.09.2027', '15', "'TESTDE11XXX", 'DE00100000000000000032', 'Dora Dauer', "'Zugang/Gutschrift", 'Spende Malteser Lage', "'Dauerauftragsgutschr", "'Paderborn - Lage"].join(';');
  await writeText(p, DIR + 'export4.csv', csv([ERIKA, line('25.09.2027', '40', 'DE00100000000000000031', 'Neu Nachzügler', 'Danke JB'), DA]));
  await p.evaluate(() => spScan({ manual: true })); await p.waitForTimeout(400);
  const e = await p.evaluate(() => ({ n: SP.rows.length, mid: [...document.querySelectorAll('.sp-col.mid .sp-row')].map(e => SP.byKey.get(e.dataset.k).name).join(','), badge: document.querySelector('.tab-badge')?.textContent }));
  ok(e.n === 13 && e.mid === 'Neu Nachzügler' && e.badge === '1', 'E: neue Datei eingelesen (13 Buchungen) – „Neu Nachzügler“ wartet in „Prüfen“, Reiter zeigt 1');
  await p.fill('.sp-q', ''); await p.waitForTimeout(450);
  const da = await p.evaluate(() => { const r = [...document.querySelectorAll('.sp-col:first-child .sp-row.da')]; return [r.length, r[0] && r[0].querySelector('.sp-tag.da')?.textContent, document.querySelectorAll('.sp-col:first-child .sp-row').length]; });
  ok(da[0] === 1 && da[1] === 'Dauerauftrag' && da[2] > 1, 'E: Dauerauftrag bleibt in der Liste, farbig markiert mit „Dauerauftrag“');

  // ---- F: Kennzahlen mit Auflage und Kosten
  await p.fill('.sp-auf', '1000'); await p.press('.sp-auf', 'Tab'); await p.waitForTimeout(150);
  await p.fill('.sp-kos', '500'); await p.press('.sp-kos', 'Tab'); await p.waitForTimeout(250);
  const f = await p.evaluate(() => [...document.querySelectorAll('.sp-tile')].map(t => t.textContent));
  ok(f.length === 4 && /^Spendensumme9\.876 €6 Spenden/.test(f[0]) && /^Ø-Spende/.test(f[1]) && /Responsequote0,6 %bei Auflage 1\.000▼ unter Richtwert/.test(f[2]) && /ROI19,8/.test(f[3]) && /über Richtwert/.test(f[3]),
    'F: vier Kacheln – Spendensumme, Ø-Spende, Responsequote 0,6 % (unter Richtwert), ROI 19,8');
  const fl = await p.evaluate(() => { const t = document.querySelectorAll('.sp-tile'), r = i => t[i].getBoundingClientRect(); return [Math.abs(r(0).top - r(1).top) < 3, r(2).top > r(0).bottom - 2, Math.abs(r(2).left - r(0).left) < 3, document.querySelector('.sp-charts').getBoundingClientRect().left > r(1).right]; });
  ok(fl.every(Boolean), 'F: 2×2 angeordnet (Responsequote/ROI unter Summe/Ø), Grafiken rechts daneben');
  ok(await p.evaluate(() => { const m = D.massnahmen.find(m => m.id === 'm5'); return m.kosten === 500 && m.auflage === 1000; }), 'F: Auflage und Kosten an der Maßnahme gespeichert');

  // ---- G: Grafiken rechts – Zeitspanne (kumuliert) und Spenden pro Tag; kein Abschnitt „Verlauf“ mehr
  const g = await p.evaluate(() => ({ bars: document.querySelectorAll('[data-chart="day"] .sp-bar').length, pal: !!document.querySelector('[data-chart="day"] .sp-palbox'),
    line: !!document.querySelector('[data-chart="span"] .sp-line'), end: document.querySelector('[data-chart="span"] .sp-endl')?.textContent, title: document.querySelector('.sp-cht')?.textContent, verlauf: !!document.querySelector('[data-sec="sp-verlauf"]') }));
  ok(g.bars === 6 && g.pal && g.line && g.end === '9.876 €' && /28\.08\.2027 – 23\.09\.2027 \(27 Tage\)/.test(g.title) && !g.verlauf,
    'G: Spenden pro Tag (6 Säulen), Zeitspanne „' + g.title + '“ bis ' + g.end + ', rotes P am PAL; Abschnitt „Verlauf“ entfernt');
  const ov = await p.$('[data-chart="span"] .sp-ov'), bx = await ov.boundingBox();
  await p.mouse.move(bx.x + bx.width * 0.6, bx.y + bx.height / 2); await p.mouse.move(bx.x + bx.width * 0.61, bx.y + bx.height / 2); await p.waitForTimeout(150);
  const g2 = await p.evaluate(() => [document.querySelector('#tip').classList.contains('on'), document.querySelector('#tip').textContent, document.querySelector('[data-chart="span"] .sp-xh').getAttribute('visibility')]);
  ok(g2[0] && /€/.test(g2[1]) && g2[2] === 'visible', 'G: Fadenkreuz mit Hinweis „' + g2[1].slice(0, 60) + '“');
  const hit = await p.$$('[data-chart="day"] .sp-hit'), hb = await hit[0].boundingBox();
  await p.mouse.move(5, 5); await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height - 3); await p.waitForTimeout(150);
  ok(/PAL/.test(await p.evaluate(() => document.querySelector('#tip').textContent)), 'G: Maus auf einem Tag zeigt Betrag und Tag ab PAL');
  await p.mouse.move(5, 5);

  // ---- H: zweite Maßnahme → Vergleich; Übersichtstabelle
  await p.selectOption('.sp-msel', 'm4'); await p.waitForTimeout(250);
  await p.fill('.sp-q', 'Nachzügler'); await p.waitForTimeout(450);
  const h0 = await p.evaluate(() => [document.querySelectorAll('.sp-col:first-child .sp-row').length, document.querySelector('.sp-col:first-child .sp-tag.other')?.textContent, document.querySelectorAll('.sp-col.mid .sp-row').length]);
  ok(h0[0] === 1 && h0[1] === 'auch: Jahresbericht' && h0[2] === 0, 'H: bei „Sommermailing“ steht der Vorschlag für „Jahresbericht“ links mit Hinweis „' + h0[1] + '“, nicht in „Prüfen“');
  await p.fill('.sp-q', 'Lautsprecher'); await p.waitForTimeout(450);
  await p.dblclick('.sp-col:first-child .sp-row'); await p.waitForTimeout(250);
  await p.dblclick('.sp-col.mid .sp-row'); await p.waitForTimeout(250);
  const h1 = await p.evaluate(() => ({ cmp: document.querySelectorAll('[data-chart="cmp"] .sp-line').length, leg: document.querySelector('[data-chart="cmp"] .sp-legend')?.textContent,
    rows: [...document.querySelectorAll('.sp-ueb tbody tr')].filter(r => r.children[5].textContent !== '–').map(r => r.children[0].textContent.trim() + '=' + r.children[4].textContent).join(' | '),
    pend: document.querySelector('.sp-ueb tr[data-mid="m5"] .sp-pend')?.textContent, foot: document.querySelector('.sp-ueb tfoot')?.textContent }));
  ok(h1.cmp === 2 && /Sommermailing/.test(h1.leg) && /Jahresbericht/.test(h1.leg), 'H: Vergleich der Rückläufe mit 2 Linien und Legende');
  ok(h1.rows === 'Sommermailing=35 € | Jahresbericht=9.876 €' && h1.pend === '1' && /Summe.*9\.911 €/.test(h1.foot), 'H: Übersicht – ' + h1.rows + ', 1 in Prüfung bei Jahresbericht, Summenzeile');

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
