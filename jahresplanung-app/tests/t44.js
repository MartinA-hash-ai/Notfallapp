// 0.12 Spenden (Beta): Exporte (CSV/Excel) aus „Spendeneingänge …“ einlesen, doppelte Buchungen nur einmal, Regeln → zuordnen (ab 0.18 ohne „Prüfen“: Vorschau mit Häkchen, neu Eingelesenes markiert),
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

  // Hilfen für den Bereich „Spenden zuordnen“ (ab 0.18: links die Maßnahmen, rechts Regel und Liste)
  const names = () => p.evaluate(() => [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].map(e => (SP.byKey.get(e.dataset.k) || {}).name).sort().join(', '));
  const rowK = name => p.evaluate(n => { const e = [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].find(e => (SP.byKey.get(e.dataset.k) || {}).name === n); return e && e.dataset.k; }, name);
  const clickRow = async (name, mod) => { const k = await rowK(name); await p.click('[data-sec="sp-zu"] .spj-row[data-k="' + k + '"] .sp-z', mod ? { modifiers: [mod] } : {}); await p.waitForTimeout(80); };
  const tab = async t => { await p.click('.spm-listbox .seg-btn[data-tab="' + t + '"]'); await p.waitForTimeout(200); };
  const typeWord = async w => { await p.fill('[data-sec="sp-zu"] .sp-wordin', ''); await p.click('[data-sec="sp-zu"] .sp-wordin'); await p.keyboard.type(w); await p.waitForTimeout(450); };

  // ---- A2: Kasten der Maßnahme – Name groß in ihrer Farbe; darunter links die Maßnahmen, rechts Regel und Liste
  const a2 = await p.evaluate(() => { const n = document.querySelector('[data-sec="sp-m"] .sec-h .sp-mname'), c = document.createElement('i'); c.style.color = inkC(C.byId.get('m5').color); document.body.append(c);
    const want = getComputedStyle(c).color; c.remove(); return [n && n.textContent, n && getComputedStyle(n).color === want, !document.querySelector('[data-sec="sp-m"] select, [data-sec="sp-m"] input'), !!document.querySelector('[data-fk="sp-kos:m5"]'),
      document.querySelector('.spm .spj-zi.on .spj-zn')?.textContent, document.querySelector('.spm .spj-zh .spj-zt')?.textContent, !!document.querySelector('.spm-rules .sp-wordin'), [...document.querySelectorAll('.spm-listbox .seg-btn')].map(b => b.textContent).join('|')]; });
  ok(a2[0] === 'Jahresbericht' && a2[1] && a2[2] && a2[3], 'A2: „Jahresbericht“ groß in Maßnahmenfarbe; Auflage und Kosten in der Übersicht');
  ok(a2[4] === 'Jahresbericht' && a2[5] === 'Jahresbericht' && a2[6] && a2[7] === 'Zugeordnet (0)|Offen', 'A2: links die Maßnahmen (Jahresbericht gewählt), rechts Kopf, Regelzeile mit „+ Schlagwort“, Reiter „' + a2[7] + '“');
  await tab('offen');
  const a3 = await p.evaluate(() => [document.querySelector('[data-fk="sp-fvon"]')?.value, document.querySelector('[data-fk="sp-fbis"]')?.value, [...document.querySelectorAll('.spm-filter .sp-da select option')].map(o => o.textContent).join('|'), !!document.querySelector('.spm-filter .sp-q'), !document.querySelector('.sp-min')]);
  ok(a3[0] === '2027-08-27' && a3[1] === '2028-02-25' && a3[2] === 'einblenden|ausblenden|nur Daueraufträge' && a3[3] && a3[4], 'A3: „Offen“ mit Filter – Zeitraum ab PAL (' + a3[0] + ' – ' + a3[1] + '), Daueraufträge, Suche; kein Betragsfilter');
  await tab('zu');
  await p.click('[data-sec="sp-m"] .sec-tog'); await p.waitForTimeout(200);
  const a4 = await p.evaluate(() => [!document.querySelector('[data-sec="sp-m"] .sp-tile'), document.querySelector('[data-sec="sp-m"] .sec-sum')?.textContent]);
  await p.click('[data-sec="sp-m"] .sec-tog'); await p.waitForTimeout(200);
  ok(a4[0] && /noch keine Spenden/.test(a4[1]) && await p.evaluate(() => !!document.querySelector('[data-sec="sp-m"] .sp-tile')), 'A3: Kasten der Maßnahme ein- und ausklappbar (zu: „' + a4[1] + '“)');

  // ---- B: Schlagwort tippen → Vorschau mit Häkchen (ganzes Wort, im Zeitraum ab PAL); Enter übernimmt – die Regel ordnet selbst zu
  await typeWord('JB');
  const b0 = await p.evaluate(() => [document.querySelector('.spm-listbox .spj-lh').textContent, document.querySelectorAll('.spm-listbox .spj-row.sel').length]);
  ok(/^Vorschau „JB“4 von 4 Spenden \(175,50 €\) würden zugeordnet/.test(b0[0]) && b0[1] === 4 && await names() === 'Anna Probe, Emil Klein, Erika Test, Max Muster',
    'B: Vorschau „JB“ – ' + await names() + ' mit Häkchen (nicht „JBL“, nicht vor dem PAL)');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const bb = await p.evaluate(() => ({ regel: JSON.stringify(D.massnahmen.find(m => m.id === 'm5').regel), zu: Object.values(D.spenden.zu).map(z => z.m + (z.r ? '/r' : '')).join(','), badge: document.querySelector('.tab-badge')?.textContent || '',
    tag: document.querySelector('.spm-listbox .spj-row .sp-tag.rule')?.textContent, side: document.querySelector('.spm .spj-zi.on .spj-zs')?.textContent }));
  ok(bb.regel === '{"worte":["JB"],"ab":0,"bis":182}' && bb.zu === 'm5/r,m5/r,m5/r,m5/r' && bb.badge === '' && bb.tag === 'JB' && bb.side === '4 · 176 €' && await names() === 'Anna Probe, Emil Klein, Erika Test, Max Muster',
    'B: Regel JB (Zeitraum PAL … +182 T.) ordnet die vier zu (von der Regel, nicht „neu“ – die Vorschau war die Prüfung); links „' + bb.side + '“');
  await typeWord('Jahresbericht');
  ok(await names() === 'Bernd Probe' && /1 von 1 Spende/.test(await p.evaluate(() => document.querySelector('.spm-listbox .spj-lh').textContent)), 'B: „Jahresbericht“ findet auch „JAHRESBE RICHT“ (Zeilenumbruch der Bank)');
  await clickRow('Bernd Probe');
  const b1 = await p.evaluate(() => [document.querySelectorAll('.spm-listbox .spj-row.sel').length, document.querySelector('.spm-listbox .spj-lh').textContent]);
  ok(b1[0] === 0 && /^Vorschau „Jahresbericht“0 von 1 Spende/.test(b1[1]), 'B: Klick nimmt das Häkchen weg – „' + b1[1].split('würden')[0] + '“');
  await p.click('.spm-apply'); await p.waitForTimeout(300);
  const kB = await p.evaluate(() => SP.rows.find(r => r.name === 'Bernd Probe').k);
  const b2 = await p.evaluate(k => [JSON.stringify(D.massnahmen.find(m => m.id === 'm5').regel.worte), JSON.stringify(D.spenden.nein[k]), !D.spenden.zu[k], document.querySelector('.spm-rej')?.textContent], kB);
  ok(b2[0] === '["JB","Jahresbericht"]' && b2[1] === '["m5"]' && b2[2] && b2[3] === '1 ausgeschlossen', 'B: „Regel übernehmen“ – Schlagwort dazu, Bernd ohne Häkchen ausgeschlossen („' + b2[3] + '“)');
  const bz = await p.evaluate(() => [[...document.querySelectorAll('.spm-listbox .sp-z')].map(e => e.textContent).join(' | '), document.querySelectorAll('.spm-listbox .sp-n').length]);
  ok(/Spende JB/.test(bz[0]) && bz[1] === 0, 'B: Verwendungszweck steht in jeder Zeile (' + bz[0].slice(0, 40) + ' …), Namen nur auf Wunsch');

  // ---- C: eine Spende herausnehmen (Regel ordnet sie nicht wieder zu); Strg+Z; ausgeschlossene wieder zulassen
  const c0 = await p.evaluate(() => Object.values(D.spenden.zu).map(z => Object.keys(z).join('')).join(' '));
  ok(/^(mdbr ?){4}$/.test(c0), 'C: gespeichert nur m/d/b und „r“ (von der Regel)');
  await clickRow('Erika Test');
  ok(await p.evaluate(() => document.querySelector('.spj-act.on .spj-selinfo').textContent === '1 Spende markiert · 50,00 €'), 'C: Zeile anklicken – Leiste unten mit „Herausnehmen“');
  await p.click('.spj-act .spm-excl'); await p.waitForTimeout(250);
  const kE = await p.evaluate(() => SP.rows.find(r => r.name === 'Erika Test').k);
  const c1 = await p.evaluate(k => [!D.spenden.zu[k], JSON.stringify(D.spenden.nein[k]), document.querySelectorAll('.spm-listbox .spj-row').length, document.querySelector('.spm-rej').textContent], kE);
  ok(c1[0] && c1[1] === '["m5"]' && c1[2] === 3 && c1[3] === '2 ausgeschlossen', 'C: „Herausnehmen“ – Erika nicht mehr zugeordnet, ausgeschlossen (die Regel holt sie nicht zurück)');
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); undo(); }); await p.waitForTimeout(200);
  ok(await p.evaluate(k => D.spenden.zu[k]?.m === 'm5' && !D.spenden.nein[k], kE), 'C: Strg+Z stellt die Zuordnung wieder her');
  await tab('aus');
  ok(await names() === 'Bernd Probe', 'C: Reiter „Ausgeschlossen (1)“ zeigt Bernd');
  await clickRow('Bernd Probe'); await p.click('.spj-act .spm-readmit'); await p.waitForTimeout(250);
  ok(await p.evaluate(k => D.spenden.zu[k]?.r === 1 && !D.spenden.nein[k], kB), 'C: „Wieder zulassen“ – die Regel ordnet Bernd zu');
  await p.evaluate(() => undo()); await p.waitForTimeout(200);
  ok(await p.evaluate(k => !D.spenden.zu[k] && D.spenden.nein[k]?.[0] === 'm5', kB) && await p.evaluate(() => Object.values(D.spenden.zu).reduce((s, z) => s + z.b, 0)) === 17550,
    'C: Strg+Z – Bernd wieder ausgeschlossen; zugeordnet 4 (175,50 €)');

  // ---- D: von Hand – unter „Offen“ suchen, mit Umschalt-Klick markieren, zuordnen
  await tab('offen');
  await p.fill('.spm-filter .sp-q', 'Hospiz'); await p.waitForTimeout(450);
  const d0 = (await names()).split(', ');
  ok(d0.length === 2 && d0.includes('Henriette Probe') && d0.includes('Firma Beispiel GmbH'), 'D: Suche „Hospiz“ findet ' + d0.join(', ') + ' (auch „HOSPIZDIENSTE“)');
  const dk = await p.evaluate(() => [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].map(e => e.dataset.k));
  await p.click('[data-sec="sp-zu"] .spj-row[data-k="' + dk[0] + '"] .sp-z'); await p.click('[data-sec="sp-zu"] .spj-row[data-k="' + dk[1] + '"] .sp-z', { modifiers: ['Shift'] }); await p.waitForTimeout(100);
  const d1 = await p.evaluate(() => [SPUI.sel.size, document.querySelector('.spj-act .spj-move').value, document.querySelector('.spj-act').textContent]);
  ok(d1[0] === 2 && d1[1] === 'm5' && /2 Spenden markiert/.test(d1[2]), 'D: Klick + Umschalt-Klick markiert beide – Ziel „Jahresbericht“ vorbelegt');
  await p.click('.spj-act .spj-go'); await p.waitForTimeout(250);
  await tab('zu');
  const d2 = await p.evaluate(() => [Object.keys(D.spenden.zu).length, [...document.querySelectorAll('.spm-listbox .sp-tag.hand')].length]);
  ok(d2[0] === 6 && d2[1] === 2, 'D: zugeordnet – 6 Spenden bei „Jahresbericht“, zwei davon „von Hand“');
  await p.fill('.spm-filter .sp-q', '').catch(() => {}); await p.evaluate(() => { SPUI.f.q = ''; });

  // ---- E: neue Datei kommt später dazu → passende Spende ordnet die Regel selbst zu, markiert als „neu“ (Hinweis am Reiter, links, oben)
  const DA = ['20.09.2027', '20.09.2027', '15', "'TESTDE11XXX", 'DE00100000000000000032', 'Dora Dauer', "'Zugang/Gutschrift", 'Spende Malteser Lage', "'Dauerauftragsgutschr", "'Paderborn - Lage"].join(';');
  await writeText(p, DIR + 'export4.csv', csv([ERIKA, line('25.09.2027', '40', 'DE00100000000000000031', 'Neu Nachzügler', 'Danke JB'), DA]));
  await p.evaluate(() => spScan({ manual: true })); await p.waitForTimeout(500);
  const kN = await p.evaluate(() => SP.rows.find(r => r.name === 'Neu Nachzügler').k);
  const e = await p.evaluate(k => ({ n: SP.rows.length, zu: D.spenden.zu[k], neu: D.spenden.neu[k], badge: document.querySelector('.tab-badge')?.textContent, side: document.querySelector('.spm .spj-zi.on .spj-neu')?.textContent,
    head: document.querySelector('.spm .spj-newbar')?.textContent, row: document.querySelector('.spm-listbox .spj-row[data-k="' + k + '"] .sp-tag.neu')?.textContent, ueb: document.querySelector('.sp-ueb tr[data-mid="m5"] .sp-mbadge.neu')?.textContent }), kN);
  ok(e.n === 13 && e.zu && e.zu.m === 'm5' && e.zu.r === 1 && e.neu === 'm', 'E: neue Datei eingelesen (13 Buchungen) – „Neu Nachzügler“ von der Regel zugeordnet und als neu markiert');
  ok(e.badge === '1' && e.side === '1 neu' && e.head === '1 neuansehen✓ geprüft' && e.row === 'neu' && e.ueb === '1', 'E: Hinweise – Reiter „1“, links „1 neu“, oben „1 neu · ansehen · ✓ geprüft“, Zeile „neu“, Übersicht „1“');
  await p.click('.spm .spj-shownew'); await p.waitForTimeout(200);
  ok(await names() === 'Neu Nachzügler' && await p.evaluate(() => document.querySelector('.spj-onlynew.on')?.textContent === 'nur neue (1)'), 'E: „ansehen“ zeigt nur die neuen');
  await clickRow('Neu Nachzügler'); await p.click('.spj-act .spm-excl'); await p.waitForTimeout(250);
  const e2 = await p.evaluate(k => [!D.spenden.zu[k], !D.spenden.neu[k], document.querySelector('.tab-badge')?.textContent || '', !document.querySelector('.spm .spj-newbar')], kN);
  ok(e2.every(x => x === true || x === ''), 'E: falsche neue Spende herausgenommen – Hinweise weg');
  await p.evaluate(() => undo()); await p.waitForTimeout(200);
  await p.click('.spm .spj-ok'); await p.waitForTimeout(250);
  ok(await p.evaluate(k => D.spenden.zu[k]?.m === 'm5' && !D.spenden.neu[k] && !document.querySelector('.tab-badge') && !document.querySelector('.spm .spj-newbar'), kN), 'E: oder „✓ geprüft“ – bleibt zugeordnet, Markierung „neu“ weg');
  await clickRow('Neu Nachzügler'); await p.click('.spj-act .spm-excl'); await p.waitForTimeout(250);   // für die Zahlen unten wieder heraus
  await tab('offen');
  const da = await p.evaluate(() => { const r = [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].filter(e => e.querySelector('.sp-tag.da')); return [r.length, r[0] && r[0].querySelector('.sp-tag.da').textContent, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length]; });
  ok(da[0] === 1 && da[1] === 'Dauerauftrag' && da[2] > 1, 'E: Dauerauftrag steht in „Offen“, markiert mit „Dauerauftrag“');
  await p.selectOption('.spm-filter .sp-da select', 'ohne'); await p.waitForTimeout(200);
  const da2 = await p.evaluate(() => [[...document.querySelectorAll('[data-sec="sp-zu"] .spj-row .sp-tag.da')].length, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length, UI.spDA]);
  ok(da2[0] === 0 && da2[1] > 0 && da2[2] === 'ohne', 'E: „Daueraufträge: ausblenden“ blendet sie aus');
  await p.selectOption('.spm-filter .sp-da select', 'nur'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length === 1), 'E: „nur Daueraufträge“ zeigt nur den einen Dauerauftrag');
  await p.selectOption('.spm-filter .sp-da select', 'alle'); await p.waitForTimeout(200);
  await typeWord('Lage'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const kD = await p.evaluate(() => SP.rows.find(r => r.name === 'Dora Dauer').k);
  const nd1 = await p.evaluate(k => D.spenden.zu[k]?.m, kD);
  await p.click('.spm-rules .sp-noda input'); await p.waitForTimeout(250);
  const nd2 = await p.evaluate(k => [!D.spenden.zu[k], D.massnahmen.find(m => m.id === 'm5').regel.ohneDA], kD);
  ok(nd1 === 'm5' && nd2[0] && nd2[1] === true, 'E: Regel mit „Lage“ ordnet den Dauerauftrag zu – Häkchen „ohne Daueraufträge“ nimmt ihn heraus');
  await p.click('.spm-rules .sp-word:has-text("Lage") .sp-x'); await p.click('.spm-rules .sp-noda input'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => Object.values(D.spenden.zu).filter(z => z.m === 'm5').length === 6), 'E: „Lage“ wieder entfernt – 6 zugeordnet');

  // ---- F: Kennzahlen mit Auflage und Kosten
  await p.fill('[data-fk="sp-auf:m5"]', '1000'); await p.press('[data-fk="sp-auf:m5"]', 'Tab'); await p.waitForTimeout(150);
  await p.fill('[data-fk="sp-kos:m5"]', '500'); await p.press('[data-fk="sp-kos:m5"]', 'Tab'); await p.waitForTimeout(250);
  const f = await p.evaluate(() => [...document.querySelectorAll('.sp-tile')].map(t => t.textContent));
  ok(f.length === 4 && /^Spendensumme9\.876 €6 Spenden/.test(f[0]) && /^Ø-Spende/.test(f[1]) && /^Responsequote0,6 %6 Spenden$/.test(f[2]) && /^ROI19,8Kosten 500 €$/.test(f[3]),
    'F: vier Kacheln – Spendensumme, Ø-Spende, Responsequote 0,6 % (darunter die absolute Zahl: 6 Spenden), ROI 19,8 – ohne Richtwerte');
  ok(await p.evaluate(() => !/Richtwert/.test(document.querySelector('#main').textContent)), 'F: Richtwerte ausgeblendet (Kacheln, Übersicht, Erklärung)');
  // Richtwerte in den Einstellungen einschalten und ändern
  await p.evaluate(() => { openSettings('allgemein'); }); await p.waitForTimeout(250);
  await p.click('.sett-body label.check:has-text("Richtwerte bei den Kennzahlen anzeigen") input'); await p.waitForTimeout(150);
  const rws = await p.$$('.sett-body .rw-in'); await rws[1].fill('5'); await rws[1].press('Tab'); await p.waitForTimeout(150);
  await p.click('.view-head .backbtn'); await p.waitForTimeout(250);
  const rw = await p.evaluate(() => [JSON.stringify(D.settings.richtwerte), [...document.querySelectorAll('.sp-tile')].map(t => t.textContent).slice(2).join(' | '), document.querySelector('.sp-ueb tr[data-mid="m5"] td.below') ? 1 : 0]);
  ok(rw[0] === '{"an":true,"resp":[2.7,5],"roi":[4,5]}' && /▼ unter Richtwert 2,7–5,0 %/.test(rw[1]) && /▲ über Richtwert 4,0–5,0/.test(rw[1]) && rw[2] === 1, 'F: Einstellungen – Richtwerte eingeschaltet und angepasst (' + rw[1] + ')');
  await p.evaluate(() => undo()); await p.evaluate(() => undo()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !D.settings.richtwerte && !/Richtwert/.test(document.querySelector('#main').textContent)), 'F: Strg+Z – wieder ausgeblendet');
  const fl = await p.evaluate(() => { const t = document.querySelectorAll('.sp-tile'), r = i => t[i].getBoundingClientRect(); return [Math.abs(r(0).top - r(1).top) < 3, r(2).top > r(0).bottom - 2, Math.abs(r(2).left - r(0).left) < 3, document.querySelector('.sp-charts').getBoundingClientRect().left > r(1).right]; });
  ok(fl.every(Boolean), 'F: 2×2 angeordnet (Responsequote/ROI unter Summe/Ø), Grafiken rechts daneben');
  ok(await p.evaluate(() => { const m = D.massnahmen.find(m => m.id === 'm5'); return m.kosten === 500 && m.auflage === 1000; }), 'F: Auflage und Kosten an der Maßnahme gespeichert');
  const er = await p.evaluate(() => { const e = document.querySelector('.sp-tiles .sp-erl'), t = document.querySelectorAll('.sp-tile'); return [e && e.className, e && e.textContent, e && e.getBoundingClientRect().top > t[2].getBoundingClientRect().bottom - 2, e && Math.abs(e.getBoundingClientRect().width - (t[1].getBoundingClientRect().right - t[0].getBoundingClientRect().left)) < 3,
    getComputedStyle(document.querySelector('.sp-tl')).fontWeight]; });
  ok(/pos/.test(er[0]) && /^Erlös9\.376 €$/.test(er[1]) && er[2] && er[3] && +er[4] >= 600, 'F: grüne Zeile „Erlös 9.376 €“ unter den Kacheln über die ganze Breite; Namen der Kennzahlen fett');

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
  await p.evaluate(() => { SPUI.tab = 'offen'; SPUI.f.von = '2027-08-01'; renderNow(); }); await p.waitForTimeout(200);
  const kDora = await p.evaluate(() => SP.rows.find(r => r.name === 'Dora Vorher').k);
  await p.click('[data-sec="sp-zu"] .spj-row[data-k="' + kDora + '"] .sp-z'); await p.click('.spj-act .spj-go'); await p.waitForTimeout(300);
  await tab('zu');
  const g3 = await p.evaluate(k => [document.querySelector('.sp-cht').textContent, document.querySelector('[data-sec="sp-zu"] .spj-row[data-k="' + k + '"] .sp-tag.other')?.textContent, document.querySelector('[data-chart="span"] .sp-endl').textContent,
    document.querySelector('.banner.sp-pre')?.textContent], kDora);
  ok(/28\.08\.2027 – 23\.09\.2027 \(27 Tage\).*inkl\. 1 Spende vor dem PAL \(25,00 €\)/.test(g3[0]) && g3[1] === 'vor dem PAL' && g3[2] === '9.901 €' && /1 Spende \(25,00 €\) ist zugeordnet, aber vor dem PAL/.test(g3[3]),
    'G: Spende vor dem PAL (von Hand) verlängert die Grafik nicht (' + g3[0].replace(/^.*?· /, '') + '), zählt in der Summe (' + g3[2] + '), Markierung „vor dem PAL“ und Hinweis darüber');
  await p.click('.banner.sp-pre button'); await p.waitForTimeout(300);
  const g4 = await p.evaluate(() => [document.querySelector('.sp-cht').textContent, document.querySelector('[data-chart="span"] .sp-endl').textContent, document.querySelector('.sp-tile .sp-tv').textContent]);
  ok(!/vor dem PAL/.test(g4[0]) && g4[1] === '9.876 €' && g4[2] === '9.876 €', 'G: wieder herausgenommen – Grafik und Kennzahlen sofort aktualisiert (' + g4[1] + ')');
  await p.evaluate(() => { spResetFilter(findM(D, 'm5')); renderNow(); }); await p.waitForTimeout(200);
  const hit = await p.$$('[data-chart="day"] .sp-hit'), hb = await hit[0].boundingBox();
  await p.mouse.move(5, 5); await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height - 3); await p.waitForTimeout(150);
  ok(/PAL/.test(await p.evaluate(() => document.querySelector('#tip').textContent)), 'G: Maus auf einem Tag zeigt Betrag und Tag ab PAL');
  await p.mouse.move(5, 5);

  // ---- H: zweite Maßnahme → Vergleich; Übersichtstabelle
  await p.click('.sp-ueb tr[data-mid="m4"] td:first-child'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => UI.spMid === 'm4' && document.querySelector('.sp-mname').textContent === 'Sommermailing'), 'H: Klick auf die Zeile in der Übersicht wählt „Sommermailing“');
  ok(await p.evaluate(() => document.querySelector('.spm .spj-zi.on .spj-zn').textContent === 'Sommermailing' && SPUI.tab === 'zu'), 'H: … auch links in „Spenden zuordnen“ gewählt, Reiter „Zugeordnet“');
  await tab('offen');
  await p.fill('.spm-filter .sp-q', 'Lautsprecher'); await p.waitForTimeout(450);
  await p.click('[data-sec="sp-zu"] .spj-row .sp-z'); await p.click('.spj-act .spj-go'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => Object.values(D.spenden.zu).filter(z => z.m === 'm4').length === 1), 'H: „JBL Lautsprecher“ von Hand „Sommermailing“ zugeordnet');
  ok(await p.evaluate(() => !document.querySelector('[data-chart="cmp"]') && /▸ Rücklauf im Vergleich/.test(document.querySelector('.sp-cmptog').textContent) && !/Responsequote =/.test(document.querySelector('[data-sec="sp-ueb"]').textContent)),
    'H: „Rücklauf im Vergleich“ eingeklappt; Erklärzeile zur Responsequote entfernt');
  await p.click('.sp-cmptog'); await p.waitForTimeout(250);
  const h1 = await p.evaluate(() => ({ cmp: document.querySelectorAll('[data-chart="cmp"] .sp-line').length, leg: document.querySelector('.sp-cpills')?.textContent,
    rows: [...document.querySelectorAll('.sp-ueb tbody tr')].filter(r => r.children[6].textContent !== '–').map(r => r.children[0].querySelector('.sp-unm').textContent.trim() + '=' + r.children[5].textContent).join(' | '),
    cols: [...document.querySelectorAll('.sp-ueb thead th')].map(t => t.textContent).join(','), foot: document.querySelector('.sp-ueb tfoot')?.textContent }));
  ok(h1.cmp === 2 && /Sommermailing/.test(h1.leg) && /Jahresbericht/.test(h1.leg), 'H: Vergleich der Rückläufe mit 2 Linien und Legende');
  ok(/^Spenden 2027=[\d.]+ € \| Sommermailing=35 € \| Jahresbericht=9\.876 €$/.test(h1.rows) && !/Prüfung/.test(h1.cols) && /Summe.*9\.911 €/.test(h1.foot), 'H: Übersicht – ' + h1.rows + ' (oben alle Spenden des Jahres), ohne Spalte „in Prüfung“, Summenzeile nur der Maßnahmen');

  const rs = await p.$('.sp-ueb thead th:first-child .col-rs'); await rs.evaluate(e => e.scrollIntoView({ block: 'center' })); const rb = await rs.boundingBox(), w0 = await p.evaluate(() => Math.round(document.querySelector('.sp-ueb thead th').getBoundingClientRect().width));
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

  // ---- K: Datei über „+ Buchung hinzufügen“ ablegen (gleicher Name, anderer Inhalt → „(2)“), danach Zusammenfassung
  const tmp = path.join(__dirname, 'out', 'export1.csv');
  fs.writeFileSync(tmp, csv([line('26.09.2027', '60', 'DE00100000000000000041', 'Upload Test', 'JB Upload')]));
  const kb = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-sec="sp-ueb"] .tools button')].find(x => /Buchung hinzufügen/.test(x.textContent)); return b ? [b.textContent, b.classList.contains('primary')] : null; });
  ok(kb && kb[0] === '+ Buchung hinzufügen' && kb[1], 'K: Knopf „+ Buchung hinzufügen“ (rot)');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-sec="sp-ueb"] .tools button:has-text("Buchung hinzufügen")')]);
  await fc.setFiles(tmp); await p.waitForTimeout(700);
  const repOf = () => p.evaluate(() => { const m = document.querySelector('.modal'), l = m && m.querySelector('.sp-addlist'), r = l && l.querySelector('tr');
    return m ? { h2: m.querySelector('h2').textContent, top: [...m.querySelectorAll('.sp-addsum:not(.sp-addsum2) > div')].map(d => d.textContent).join(' | '),
      low: [...m.querySelectorAll('.sp-addsum2 > div')].map(d => d.textContent).join(' | '), rows: l ? [...l.querySelectorAll('tr')].map(q => q.textContent).join(' / ') : '', n: l ? l.querySelectorAll('tr').length : 0,
      old: !!m.querySelector('.sp-addfiles, h3'), scroll: l ? [l.scrollHeight > l.clientHeight, Math.round(l.clientHeight / r.getBoundingClientRect().height)] : null,
      chips: [...m.querySelectorAll('.sp-addlist .sp-rc .sp-rchip')].map(c => c.textContent + '@' + c.style.borderColor), rchips: [...m.querySelectorAll('.sp-as-rules .sp-rchip')].map(c => c.textContent) } : null; });
  const rep = await repOf();
  ok(rep && rep.h2 === 'Buchungen hinzugefügt' && rep.top === '26.09.2027Spenden hinzugefügt | 1neue Spende | 60,00 €Gesamtsumme' && /^Zeiträume überschneiden sich( nicht)? \| Keine doppelten Spenden erkannt \| /.test(rep.low) && /26\.09\.2027.*60,00 €.*JB Upload/.test(rep.rows) && !rep.old,
    'K: Zusammenfassung in sechs Feldern – ' + (rep ? rep.top + ' || ' + rep.low + ' · ' + rep.rows : 'fehlt'));
  const mc = await p.evaluate(() => { const c = C.byId.get('m5').color, t = document.createElement('i'); t.style.borderColor = c; return t.style.borderColor; });
  ok(rep && rep.rchips.join() === 'Jahresbericht (1)' && rep.chips.length === 1 && rep.chips[0] === 'Jahresbericht@' + mc && /Per Regel neu zugeordnet/.test(rep.low),
    'K: von der Regel zugeordnet – Feld „' + (rep && rep.rchips.join()) + '“, Zeilenende mit der Maßnahme in ihrer Farbe (' + (rep && rep.chips.join()) + ')');
  ok(await p.evaluate(() => { const r = SP.rows.find(r => r.name === 'Upload Test'); return D.spenden.zu[r.k]?.m === 'm5' && D.spenden.neu[r.k] === 'm'; }), 'K: und als „neu“ markiert');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('.modal')), 'K: Zusammenfassung lässt sich wegklicken');
  const k = await p.evaluate(() => [Object.keys(__fs.files).filter(n => n.includes('Spendeneingänge 2027/')).map(n => n.split('/').pop()).sort().join(','), SP.rows.some(r => r.name === 'Upload Test')]);
  ok(/export1 \(2\)\.csv/.test(k[0]) && k[1], 'K: Datei abgelegt als „export1 (2).csv“ (nichts überschrieben) und eingelesen');
  // dieselbe Datei nochmal + eine größere, die sich überschneidet: doppelt erkannt, Liste rollbar (etwa 10 sichtbar)
  const big = path.join(__dirname, 'out', 'export_sept.csv');
  fs.writeFileSync(big, csv([line('26.09.2027', '60', 'DE00100000000000000041', 'Upload Test', 'JB Upload'),
    ...Array.from({ length: 24 }, (_, i) => line(String(10 + (i % 18)).padStart(2, '0') + '.09.2027', String(5 + i), 'DE001000000000000009' + String(i).padStart(2, '0'), 'Neu ' + i, 'Spende Neu ' + i))]));
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-sec="sp-ueb"] .tools button:has-text("Buchung hinzufügen")')]);
  await fc2.setFiles([tmp, big]); await p.waitForTimeout(900);
  const rep2 = await repOf();
  ok(rep2 && rep2.top === '10.09.2027 – 27.09.2027Spenden hinzugefügt | 24neue Spenden | 396,00 €Gesamtsumme' && /^Zeiträume überschneiden sich(doppelte Buchungen zählen nur einmal)? \| 2 doppelte Spenden erkannt/.test(rep2.low) && !rep2.old,
    'K: zweimal dieselbe Buchung + 24 neue: ' + (rep2 ? rep2.top + ' || ' + rep2.low : 'fehlt'));
  ok(rep2 && rep2.n === 24 && rep2.scroll[0] && rep2.scroll[1] >= 9 && rep2.scroll[1] <= 11, 'K: Liste der neuen Spenden zeigt etwa ' + (rep2 && rep2.scroll[1]) + ' Zeilen, der Rest ist rollbar');
  ok(rep2 && /Keine neue Spende fällt unter eine Regel$/.test(rep2.low) && !rep2.chips.length, 'K: keine Regel passt → „Keine neue Spende fällt unter eine Regel“');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('.modal')), 'K: auch mit Esc wegklickbar');

  // ---- L: ohne Ordner – Hinweis statt Fehler; Auswertung aus der Planungsdatei bleibt
  const p2 = await open(b); pages.push(p2);
  await p2.evaluate(d => { loadData(normalize(d)); UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'm5'; renderNow(); }, data); await p2.waitForTimeout(300);
  const l = await p2.evaluate(() => [!!document.querySelector('.banner.sp-notice'), document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length, document.querySelectorAll('[data-sec="sp-zu"] .spj-row .sp-tag.gone').length, document.querySelector('.sp-tile .sp-tv').textContent]);
  ok(l[0] && l[1] === 6 && l[2] === 6 && l[3] === '9.876 €', 'L: ohne verbundenen Ordner Hinweis; Zugeordnetes und Kennzahlen kommen aus der Planungsdatei (' + l[3] + ')');
  await finish(b, pages);
})();
