// 0.26 Jahresvergleich: Privat oder Institution (Stichwörter in Name und Verwendungszweck, von Hand umstellbar, Filter in der Leiste),
// regelmäßige Spenden ohne „Dauerauftrag“ als Dauerspender:innen (Schalter, Prüfliste, Ausnahmen), Spenderbindung mit „Wer fehlt noch?“ (Liste, CSV), Spendenbrücke
const { chromium, ok, open, connect, finish, fs } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const p2 = x => String(x).padStart(2, '0');
// alles erfunden; IBAN = DE00… + Nummer
const L = (d, b, nr, name, zw = 'Spende', da = false) => [d, d, String(b), "'TESTDE11XXX", 'DE0010000000000000' + nr, name, "'Zugang/Gutschrift", zw, da ? "'Dauerauftragsgutschr" : "'Spendengutschrift", "'Paderborn - Lage"].join(';');
const year = y => { const r = [], last = y === 2027 ? 10 : 12;
  for (let m = 1; m <= last; m++) {
    r.push(L('05.' + p2(m) + '.' + y, 20, '0001', 'Probe Eins', 'Spende', true));                                  // Dauerauftrag laut Buchungstext
    if (y < 2027 || m <= 9) r.push(L(p2(m % 2 ? 15 : 16) + '.' + p2(m) + '.' + y, y === 2025 ? 15 : 20, '0002', 'Probe Zwei', 'Spende Malteser'));   // monatlich ohne Markierung, 2026 erhöht
    if (m % 3 === 0) r.push(L('10.' + p2(m) + '.' + y, 50, '0003', 'Probe Drei'));                                 // vierteljährlich
    if (y === 2027 && m <= 10) r.push(L('01.' + p2(m) + '.' + y, 50, '8004', 'Volksbank Probe eG'));                // Institution, monatlich – zählt nie als Dauerspender:in
  }
  r.push(L('01.03.' + y, 200, '0006', 'Probe Sechs', 'Jahresspende'));                                             // jährlich gleich: Datum, Betrag, Zweck
  r.push(L({ 2025: '15.06.2025', 2026: '22.06.2026', 2027: '12.06.2027' }[y], 100, '0005', 'Probe Fünf', 'Sommerspende'));   // Sommer und Weihnachten, gleicher Betrag, Datum wechselt
  if (y < 2027) r.push(L(y === 2025 ? '15.12.2025' : '18.12.2026', 100, '0005', 'Probe Fünf', 'Weihnachtsspende'));
  if (y < 2027) r.push(L('20.11.' + y, y === 2025 ? 50 : 80, '0004', 'Probe Vier', 'Weihnachtsspende'));             // nur Weihnachten
  if (y < 2027) r.push(L('15.06.' + y, 2000, '8001', 'Buergerstiftung Lage', 'Foerderung Hospiz'));                  // Stiftung (Wort im Namen)
  if (y > 2025) r.push(L('12.03.' + y, y === 2026 ? 900 : 1200, '8002', 'Max Probe', 'Reinertrag Gewinnsparen ' + (y - 1)));   // Gewinnsparen über ein Privatkonto
  if (y === 2027) r.push(L('10.02.2027', 450, '8003', 'Muster Bau GmbH'), L('10.10.2027', 60, '0008', 'Erika Bankert'), L('01.08.2027', 25, '0011', 'Probe Elf'));
  if (y > 2025) r.push(L('10.05.' + y, y === 2026 ? 40 : 30, '0007', 'Agnes Probe'));
  if (y === 2025) r.push(L('01.04.2025', 25, '0011', 'Probe Elf'));
  if (y === 2026) r.push(L('01.04.2026', 30, '0010', 'Probe Zehn'));
  return '﻿' + [HEAD, ...r].join('\r\n') + '\r\n'; };

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1400, height: 1000 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(F => { for (const [y, t] of Object.entries(F)) __fs.files['/Mailing/Spendeneingänge ' + y + '/e' + y + '.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; },
    Object.fromEntries([2025, 2026, 2027].map(y => [y, year(y)])));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'vergleich'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length > 80); await p.waitForTimeout(400);

  // ---- A: Einstufung – Stichwort im Namen (auch mitten im Wort), im Verwendungszweck, kurze Abkürzungen nur als ganzes Wort
  const typ = () => p.evaluate(() => Object.fromEntries([...jvPayers().by.values()].map(o => [o.name, o.typ + (o.why ? ' ' + o.why : '') + (o.hand ? ' (Hand)' : '')])));
  const a0 = await typ();
  ok(a0['Buergerstiftung Lage'] === 'i Name: „Stiftung“' && a0['Volksbank Probe eG'] === 'i Name: „Volksbank“' && a0['Muster Bau GmbH'] === 'i Name: „GmbH“' && a0['Max Probe'] === 'i Verwendungszweck: „Gewinnspar“',
    'A: Institution – „Buergerstiftung“ (Stiftung im Wort), Volksbank, GmbH; „Max Probe“ über „Reinertrag Gewinnsparen“ im Verwendungszweck');
  ok(a0['Agnes Probe'] === 'p' && a0['Erika Bankert'] === 'p' && Object.values(a0).filter(v => v[0] === 'i').length === 4, 'A: „Agnes“ (AG) und „Bankert“ (Bank) bleiben privat – kurze Stichwörter nur als ganzes Wort; 4 Institutionen');
  ok(await p.evaluate(() => !!document.querySelector('.jv-grp') && /Einstufung prüfen \(4 Institutionen\)/.test(document.querySelector('.jv-iprf').textContent)), 'A: in der Leiste „Spender:innen“ und „Einstufung prüfen (4 Institutionen)“');

  // ---- B: Filter in der Leiste – alle / nur Privat / nur Institutionen
  const kp = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-sec="jv-kpi"] .jv-kpi')].map(k => [k.querySelector('.jv-kt').textContent, k.querySelector('.jv-kv').textContent])));
  const b0 = await kp();
  await p.selectOption('.jv-grp', 'privat'); await p.waitForTimeout(300);
  const b1 = await kp();
  await p.selectOption('.jv-grp', 'inst'); await p.waitForTimeout(300);
  const b2 = await kp();
  ok(b0['Spendensumme'] === '3.095 €' && b0['Spender:innen'] === '11' && b1['Spendensumme'] === '945 €' && b1['Spender:innen'] === '8' && b2['Spendensumme'] === '2.150 €' && b2['Spender:innen'] === '3',
    'B: 2027 bis 10.10. – alle 3.095 € (11), nur Privat 945 € (8), nur Institutionen 2.150 € (3)');
  ok(await p.evaluate(() => UI.jvGrp === 'inst' && UI_KEYS.includes('jvGrp')), 'B: Auswahl wird gemerkt');
  await p.selectOption('.jv-grp', 'alle'); await p.waitForTimeout(300);

  // ---- C: Prüfdialog – von Hand umstellen, Stichwort entfernen und Standard wiederherstellen
  await p.click('.jv-iprf'); await p.waitForTimeout(300);
  const inst = () => p.evaluate(() => [...document.querySelectorAll('.jv-imodal .jv-it')][0] ? [...[...document.querySelectorAll('.jv-imodal .jv-it')][0].querySelectorAll('tbody tr')].map(t => t.querySelector('.jv-in').textContent).join('|') : '');
  const c0 = await inst();
  ok(c0 === 'Buergerstiftung Lage|Max Probe|Volksbank Probe eG|Muster Bau GmbH', 'C: Dialog „Privat und Institution“ – als Institution eingestuft, größte zuerst: ' + c0);
  await p.click('.jv-imodal .jv-it tr:has-text("Max Probe") .jv-itog'); await p.waitForTimeout(300);
  await p.fill('.jv-isrch', 'Agnes'); await p.waitForTimeout(200);
  await p.click('.jv-imodal tr:has-text("Agnes Probe") .jv-itog'); await p.waitForTimeout(300);
  const c1 = await typ(), c1s = await p.evaluate(() => [JSON.stringify(Object.values(D.spenden.styp || {}).sort()), JSON.stringify(D.spenden).includes('DE00') || JSON.stringify(D.spenden).includes('Probe')]);
  ok(c1['Max Probe'] === 'p Verwendungszweck: „Gewinnspar“ (Hand)' && c1['Agnes Probe'] === 'i (Hand)' && c1s[0] === '["i","p"]' && !c1s[1],
    'C: „Max Probe“ → privat, „Agnes Probe“ → Institution, von Hand; in der Planungsdatei nur Kürzel, kein Name und keine IBAN');
  ok(await p.evaluate(() => [...document.querySelectorAll('.jv-imodal .jv-it')][0].textContent.includes('von Hand')), 'C: Grund „von Hand“ in der Liste');
  await p.click('.jv-imodal .jv-iw:has-text("Stichwörter im Namen") .sp-x[aria-label="Stiftung entfernen"]'); await p.waitForTimeout(300);
  const c2 = await typ(), c2s = await p.evaluate(() => [!(D.spenden.sworte.name || []).includes('Stiftung'), !!document.querySelector('.jv-imodal .jv-iw:has(b) button.link')]);
  await p.click('.jv-imodal .jv-iw:first-child button.link'); await p.waitForTimeout(300);
  const c3 = await typ();
  ok(c2['Buergerstiftung Lage'] === 'p' && c2s[0] && c2s[1] && c3['Buergerstiftung Lage'] === 'i Name: „Stiftung“' && await p.evaluate(() => !D.spenden.sworte),
    'C: Stichwort „Stiftung“ entfernt – Bürgerstiftung privat; „Standard wiederherstellen“ – wieder Institution');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // zurück auf automatisch
  await p.evaluate(() => commit(d => { delete d.spenden.styp; }, 'Test')); await p.waitForTimeout(200);

  // ---- D: regelmäßige Spenden als Dauerspender:innen
  const reg = () => p.evaluate(() => [...jvRegular().values()].map(o => o.name + ':' + o.rh + ':' + o.n).sort().join('|'));
  const d0 = await reg();
  ok(d0 === 'Probe Drei:vierteljährlich:11|Probe Sechs:jährlich:3|Probe Zwei:monatlich:33',
    'D: erkannt – monatlich (Erhöhung 15 → 20 €, Tag 15./16.), vierteljährlich, jährlich (gleiches Datum, Betrag, Zweck): ' + d0);
  ok(!/Fünf|Vier|Volksbank|Eins|Agnes/.test(d0), 'D: nicht erkannt – Sommer-/Weihnachtsspender (Datum und Zweck wechseln), reiner Weihnachtsspender, Institution (Volksbank), schon markierter Dauerauftrag, zwei gleiche Spenden');
  const da = () => p.evaluate(() => { const k = [...document.querySelectorAll('[data-sec="jv-dauer"] .jv-kpi')].find(k => k.querySelector('.jv-kt').textContent === 'Dauerspender:innen im Jahr');
    return [k.querySelector('.jv-kv').firstChild.textContent, (k.querySelector('.jv-kvs') || {}).textContent || '', document.querySelector('.jv-daprf')?.textContent]; });   // Unterzeile steht in der großen Zahl
  const d1 = await da();
  ok(d1[0] === '4' && d1[1] === 'davon 3 an regelmäßigen Buchungen erkannt' && d1[2] === 'erkannte prüfen (3)', 'D: Dauerspender:innen 2027: 4 – „davon 3 an regelmäßigen Buchungen erkannt“, „erkannte prüfen (3)“: ' + d1.join(' / '));
  await p.click('.jv-daprf'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => [...document.querySelectorAll('.jv-imodal tbody tr')].map(t => t.querySelector('.jv-in').textContent).join('|')) === 'Probe Zwei|Probe Drei|Probe Sechs', 'D: Prüfliste – zuletzt gespendet zuerst');
  await p.click('.jv-imodal tr:has-text("Probe Sechs") input[type=checkbox]'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const d2 = await da();
  ok(d2[0] === '3' && d2[1] === 'davon 2 an regelmäßigen Buchungen erkannt' && await p.evaluate(() => Object.keys(D.spenden.sdaNein || {}).length === 1), 'D: Häkchen bei „Probe Sechs“ weg – 3 Dauerspender:innen, als Ausnahme gemerkt: ' + d2.join(' / '));
  await p.uncheck('.jv-dareg input'); await p.waitForTimeout(300);
  const d3 = await da();
  ok(d3[0] === '1' && d3[1] === '' && await p.evaluate(() => UI.jvDaReg === false && UI_KEYS.includes('jvDaReg')), 'D: Schalter „regelmäßige Buchungen mitzählen“ aus – nur der markierte Dauerauftrag (1)');
  await p.check('.jv-dareg input'); await p.waitForTimeout(300);

  // ---- E: Spenderbindung 2027 gegenüber 2026 (jeweils bis 10.10.)
  const bt = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-sec="jv-bindung"] .jv-kpi')].map(k => [k.querySelector('.jv-kt').textContent, k.querySelector('.jv-kv').textContent])));
  const e0 = await bt();
  ok(e0['Haltequote'] === '77,8 %' && e0['Gehalten'] === '7' && e0['Wieder dabei nach Pause'] === '1' && e0['Nicht wieder gespendet'] === '2',
    'E: Haltequote 77,8 % (7 von 9 aus 2026 wieder dabei), 1 nach Pause zurück (Probe Elf), 2 nicht wieder (Stiftung, Probe Zehn)');
  const e1 = await p.evaluate(() => { const k = [...document.querySelectorAll('[data-sec="jv-bindung"] .jv-kpi')].find(k => k.querySelector('.jv-kt').textContent === 'Haltequote'); return [...k.querySelectorAll('.jv-ld')].map(t => t.textContent).join('|'); });
  ok(e1 === '▼ −7,9 Pkt.', 'E: Veränderung der Haltequote in Prozentpunkten (2026: 85,7 % → 2027: 77,8 %): ' + e1);
  const ms = () => p.evaluate(() => [[...document.querySelectorAll('.jv-mt tbody tr')].map(t => t.querySelector('.jv-in').textContent + (t.textContent.includes('Institution') ? '(I)' : '')).join('|'), document.querySelector('.jv-missh > b')?.textContent]);
  const e2 = await ms();
  ok(e2[0] === 'Buergerstiftung Lage(I)|Probe Vier|Probe Zehn' && e2[1] === '3 Spender:innen · 2.110,00 €', 'E: „Wer fehlt noch?“ (ganzes Jahr 2026) – größte zuerst, Institution markiert: ' + e2.join(' · '));
  await p.selectOption('.jv-miss', 'stich'); await p.waitForTimeout(300);
  const e3 = await ms();
  ok(e3[0] === 'Buergerstiftung Lage(I)|Probe Zehn' && e3[1] === '2 Spender:innen · 2.030,00 €', 'E: „2026 bis 10.10.“ – ohne den Weihnachtsspender: ' + e3.join(' · '));
  await p.selectOption('.jv-miss', 'jahr'); await p.waitForTimeout(200);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.jv-mcsv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '').trim().split(/\r\n/);
  ok(dl.suggestedFilename() === 'Wer_fehlt_noch_2027.csv' && csv[0] === 'Name;IBAN;Spenden 2026;Summe 2026;letzte Spende;Betrag;Dauerspender:in;Gruppe' && csv.length === 4 &&
    csv[1] === 'Buergerstiftung Lage;DE00100000000000008001;1;2000,00;15.06.2026;2000,00;;Institution' && csv[2] === 'Probe Vier;DE00100000000000000004;1;80,00;20.11.2026;80,00;;privat',
    'E: „Als CSV speichern“ – mit IBAN zum Abgleich in der Spenderdatenbank: ' + csv[1]);
  await p.selectOption('.jv-grp', 'privat'); await p.waitForTimeout(300);
  const e4 = await bt(), e5 = await ms();
  ok(e4['Haltequote'] === '85,7 %' && e4['Nicht wieder gespendet'] === '1' && e5[0] === 'Probe Vier|Probe Zehn', 'E: nur Privat – Haltequote 85,7 %, fehlen nur Probe Vier und Probe Zehn');
  await p.selectOption('.jv-grp', 'alle'); await p.waitForTimeout(300);

  // ---- F: Spendenbrücke 2026 → 2027 (jeweils bis 10.10.)
  const f0 = await p.evaluate(() => { const B = jvBridgeData(jvSetup(), jvData(jvSetup())); return [B.start, B.neu.sum, B.neu.n, B.mehr.sum, B.mehr.n, B.weniger.sum, B.weniger.n, B.aus.sum, B.aus.n, B.end, B.gleich].join(','); });
  ok(f0 === '380000,103500,4,30000,1,1000,1,203000,2,309500,5', 'F: 3.800 € + neu/wieder 1.035 € (4) + mehr 300 € (1) − weniger 10 € (1) − ausgeblieben 2.030 € (2) = 3.095 €; 5 gleich: ' + f0);
  const f1 = await p.evaluate(() => [document.querySelector('.jv-brsum').textContent, document.querySelector('[data-sec="jv-bruecke"] .jv-foot').textContent, document.querySelectorAll('[data-sec="jv-bruecke"] svg rect').length]);
  ok(/^2026 → 2027 \(jeweils bis 10\.10\.\): 3\.800,00 € → 3\.095,00 €/.test(f1[0]) && f1[1] === '4 Spender:innen neu oder wieder dabei · 1 Spender:in mit mehr, 1 Spender:in mit weniger, 5 mit gleich viel · 2 Spender:innen ausgeblieben' && f1[2] >= 6,
    'F: Kopfzeile, sechs Säulen und Fußzeile: ' + f1[1]);

  // ---- G: Neue Felder überstehen Normalisieren und Zusammenführen; „Erstmals seit …“ statt „Neue Spender:innen“
  const g0 = await p.evaluate(() => { const base = clone(D), mine = clone(D), theirs = clone(D);
    mine.spenden.styp = { a1: 'i' }; theirs.spenden.styp = { b2: 'p' }; mine.spenden.sworte = { name: ['Stiftung'] }; theirs.spenden.sdaNein = { c3: 1 };
    const m = merge3(base, mine, theirs).data, n = normalize(clone(m)), bad = normalize(Object.assign(clone(D), { spenden: { styp: { x: 'q', y: 'i' }, sdaNein: { z: 0 }, sworte: { name: 'kaputt' } } }));
    return [JSON.stringify(Object.entries(n.spenden.styp).sort()), JSON.stringify(n.spenden.sworte), JSON.stringify(n.spenden.sdaNein), JSON.stringify(bad.spenden.styp), !bad.spenden.sdaNein && !bad.spenden.sworte]; });
  ok(g0[0] === '[["a1","i"],["b2","p"]]' && g0[1] === '{"name":["Stiftung"]}' && g0[2] === '{"c3":1}' && g0[3] === '{"y":"i"}' && g0[4], 'G: Einstufung, Stichwörter und Ausnahmen werden zusammengeführt; Unsinn fällt beim Laden heraus');
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-sec="jv-kpi"] .jv-kt')].some(t => t.textContent === 'Erstmals seit 2025') && ![...document.querySelectorAll('.jv-kt')].some(t => /Neue Spender/.test(t.textContent))), 'G: Kachel heißt „Erstmals seit 2025“');
  ok(await p.evaluate(() => ['bruecke', 'bindung'].every(k => { const i = document.querySelector('[data-sec="jv-' + k + '"] .sec-h .info'); return i && TIPS.get(i) && TIPS.get(i).length > 60; })), 'G: Brücke und Bindung mit ⓘ');
  await finish(b, pages);
})();
