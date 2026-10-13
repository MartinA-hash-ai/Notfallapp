// 0.26–0.28 Jahresvergleich: Privat oder Institution (Stichwörter je Art in Name und Verwendungszweck, von Hand umstellbar, Auswahl in der Leiste),
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
  await p.evaluate(() => { UI.secOpen['jv-dauer'] = true; renderNow(); }); await p.waitForTimeout(300);

  // ---- A: Einstufung – Stichwort im Namen (auch mitten im Wort), im Verwendungszweck, kurze Abkürzungen nur als ganzes Wort; je Institution die Art
  const typ = () => p.evaluate(() => Object.fromEntries([...jvPayers().by.values()].map(o => [o.name, o.typ + (o.art ? ':' + o.art : '') + (o.why ? ' ' + o.why : '') + (o.hand ? ' (Hand)' : '')])));
  const a0 = await typ();
  ok(a0['Buergerstiftung Lage'] === 'i:stift Name: „Stiftung“' && a0['Volksbank Probe eG'] === 'i:bank Name: „Volksbank“' && a0['Muster Bau GmbH'] === 'i:firma Name: „GmbH“' && a0['Max Probe'] === 'i:bank Verwendungszweck: „Gewinnspar“',
    'A: Institution – „Buergerstiftung“ (Stiftung im Wort), Volksbank (längstes Wort gewinnt vor „eG“), GmbH; „Max Probe“ über „Reinertrag Gewinnsparen“ im Verwendungszweck (Banken & Gewinnsparen)');
  ok(a0['Agnes Probe'] === 'p' && a0['Erika Bankert'] === 'p' && Object.values(a0).filter(v => v[0] === 'i').length === 4, 'A: „Agnes“ (AG) und „Bankert“ (Bank) bleiben privat – kurze Stichwörter nur als ganzes Wort; 4 Institutionen');
  ok(await p.evaluate(() => document.querySelectorAll('.jv-bar .jv-grp button').length === 3 && document.querySelector('[data-sec="jv-herkunft"] .jv-iprf')?.textContent === 'Regeln ansehen und ändern'),
    'A: in der Leiste „Alle | Privat | Institutionen“, im Abschnitt „Privat & Institutionen“ der Knopf „Regeln ansehen und ändern“');

  // ---- B: Auswahl in der Leiste – alle / nur Privat / nur Institutionen
  const kp = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.jv-kt tbody tr')].map(t => [t.dataset.k, t.children[2].textContent])));
  const b0 = await kp();
  await p.click('.jv-bar .jv-grp button[data-g="privat"]'); await p.waitForTimeout(300);
  const b1 = await kp();
  await p.click('.jv-bar .jv-grp button[data-g="inst"]'); await p.waitForTimeout(300);
  const b2 = await kp();
  ok(b0.sum === '3.095 €' && b0.don === '11' && b1.sum === '945 €' && b1.don === '8' && b2.sum === '2.150 €' && b2.don === '3',
    'B: 2027 bis 10.10. – alle 3.095 € (11), nur Privat 945 € (8), nur Institutionen 2.150 € (3)');
  ok(await p.evaluate(() => UI.jvGrp === 'inst' && UI_KEYS.includes('jvGrp') && document.querySelector('.jv-bar .jv-grp button.on').dataset.g === 'inst'), 'B: Auswahl wird gemerkt');
  await p.click('.jv-bar .jv-grp button[data-g="alle"]'); await p.waitForTimeout(300);

  // ---- C: von Hand umstellen (Prüfliste im Regeln-Dialog bzw. „→ privat“ unter der Art), Stichwort entfernen, Standard wiederherstellen
  await p.click('[data-sec="jv-herkunft"] tr.jv-art[data-art="bank"]'); await p.waitForTimeout(300);
  await p.click('[data-sec="jv-herkunft"] tr.jv-artm:has-text("Max Probe") .jv-topriv'); await p.waitForTimeout(300);
  await p.click('.jv-iprf'); await p.waitForTimeout(300);
  await p.fill('.jv-isrch', 'Agnes'); await p.waitForTimeout(200);
  await p.click('.jv-imodal .jv-priv tr:has-text("Agnes Probe") .jv-itog'); await p.waitForTimeout(200);
  await p.click('.menu.pop .jv-kpop .mitem:has-text("Vereine & Clubs")'); await p.waitForTimeout(300);
  const c1 = await typ(), c1s = await p.evaluate(() => [JSON.stringify(Object.values(D.spenden.styp || {}).sort()), JSON.stringify(D.spenden).includes('DE00') || JSON.stringify(D.spenden).includes('Probe'),
    [...document.querySelectorAll('.jv-imodal .jv-hand tr')].map(t => t.querySelector('.jv-in').firstChild.textContent + ':' + t.querySelector('.jv-pill').textContent).join('|')]);
  ok(c1['Max Probe'] === 'p Verwendungszweck: „Gewinnspar“ (Hand)' && c1['Agnes Probe'] === 'i:verein (Hand)' && c1s[0] === '["i:verein","p"]' && !c1s[1],
    'C: „Max Probe“ → privat, „Agnes Probe“ → Institution (Vereine & Clubs), von Hand; in der Planungsdatei nur Kürzel, kein Name und keine IBAN');
  ok(c1s[2] === 'Max Probe:privat|Agnes Probe:Vereine & Clubs', 'C: im Dialog unter „Von Hand eingestuft“: ' + c1s[2]);
  await p.click('.jv-imodal .jv-hand tr:has-text("Agnes Probe") .jv-unhand'); await p.waitForTimeout(300);
  ok((await typ())['Agnes Probe'] === 'p' && await p.evaluate(() => JSON.stringify(Object.values(D.spenden.styp))) === '["p"]', 'C: „aufheben“ – Agnes Probe wieder automatisch (privat)');
  await p.click('.jv-imodal .jv-rt tr[data-art="stift"] .sp-x[aria-label="Stiftung entfernen"]'); await p.waitForTimeout(300);
  const c2 = await typ(), c2s = await p.evaluate(() => [!D.spenden.sarten.stift.n.includes('Stiftung'), !!document.querySelector('.jv-imodal .jv-artstd')]);
  await p.click('.jv-imodal .jv-artstd'); await p.waitForTimeout(300);
  const c3 = await typ();
  ok(c2['Buergerstiftung Lage'] === 'p' && c2s[0] && c2s[1] && c3['Buergerstiftung Lage'] === 'i:stift Name: „Stiftung“' && await p.evaluate(() => !D.spenden.sarten && !D.spenden.sworte),
    'C: Stichwort „Stiftung“ entfernt – Bürgerstiftung privat; „Standard wiederherstellen“ – wieder Institution');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => commit(d => { delete d.spenden.styp; }, 'Test')); await p.waitForTimeout(200);   // zurück auf automatisch

  // ---- D: regelmäßige Spenden als Dauerspender:innen
  const reg = () => p.evaluate(() => [...jvRegular().values()].map(o => o.name + ':' + o.rh + ':' + o.n).sort().join('|'));
  const d0 = await reg();
  ok(d0 === 'Probe Drei:vierteljährlich:11|Probe Sechs:jährlich:3|Probe Zwei:monatlich:33',
    'D: erkannt – monatlich (Erhöhung 15 → 20 €, Tag 15./16.), vierteljährlich, jährlich (gleiches Datum, Betrag, Zweck): ' + d0);
  ok(!/Fünf|Vier|Volksbank|Eins|Agnes/.test(d0), 'D: nicht erkannt – Sommer-/Weihnachtsspender (Datum und Zweck wechseln), reiner Weihnachtsspender, Institution (Volksbank), schon markierter Dauerauftrag, zwei gleiche Spenden');
  const da = () => p.evaluate(() => { const k = document.querySelector('[data-sec="jv-dauer"] .jv-mt1[data-k="dauer"]');
    return [k.querySelector('.jv-mtv').textContent, (k.querySelector('.jv-kvs') || {}).textContent || '', document.querySelector('.jv-daprf')?.textContent]; });
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

  // ---- E: Spenderbindung 2027 gegenüber 2026 (jeweils bis 10.10.) – vier kleine Kacheln, „Wer fehlt noch?“ als Zeile mit „Liste ▸“
  const bt = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-sec="jv-bindung"] .jv-mt1')].map(k => [k.dataset.k, k.querySelector('.jv-mtv').textContent + ' (' + k.querySelector('.jv-mts').textContent + ')'])));
  const e0 = await bt();
  ok(e0.rate === '77,8 % (▼ −7,9 Pkt. · 2026: 85,7 %)' && /^7 /.test(e0.keep) && /^1 /.test(e0.react) && /^2 /.test(e0.lost),
    'E: Haltequote 77,8 % (−7,9 Pkt. ggü. 85,7 %), 7 gehalten, 1 nach Pause zurück (Probe Elf), 2 nicht wieder (Stiftung, Probe Zehn)');
  const ms = () => p.evaluate(() => [[...document.querySelectorAll('.jv-mt tbody tr')].map(t => t.querySelector('.jv-in').textContent + (t.textContent.includes('Institution') ? '(I)' : '')).join('|'), document.querySelector('.jv-missn')?.textContent]);
  const e2 = await ms();
  ok(e2[0] === '' && e2[1] === '2 Spender:innen · 2.030 €' && await p.evaluate(() => document.querySelector('.jv-mopen').textContent === 'Liste ▸'), 'E: „Wer fehlt noch?“ – erst nur die Zahl (2026 bis 10.10., passt zu „nicht wieder“): ' + e2[1]);
  await p.click('.jv-mopen'); await p.waitForTimeout(300);
  const e3 = await ms();
  ok(e3[0] === 'Buergerstiftung Lage(I)|Probe Zehn' && await p.evaluate(() => document.querySelector('.jv-miss').value === 'stich'), 'E: „Liste ▸“ – größte zuerst, Institution markiert: ' + e3[0]);
  await p.selectOption('.jv-miss', 'jahr'); await p.waitForTimeout(300);
  const e4 = await ms();
  ok(e4[0] === 'Buergerstiftung Lage(I)|Probe Vier|Probe Zehn' && e4[1] === '3 Spender:innen · 2.110 €', 'E: „im ganzen Jahr 2026“ – mit dem Weihnachtsspender: ' + e4.join(' · '));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.jv-mcsv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '').trim().split(/\r\n/);
  ok(dl.suggestedFilename() === 'Wer_fehlt_noch_2027.csv' && csv[0] === 'Name;IBAN;Spenden 2026;Summe 2026;letzte Spende;Betrag;Dauerspender:in;Gruppe' && csv.length === 4 &&
    csv[1] === 'Buergerstiftung Lage;DE00100000000000008001;1;2000,00;15.06.2026;2000,00;;Institution' && csv[2] === 'Probe Vier;DE00100000000000000004;1;80,00;20.11.2026;80,00;;privat',
    'E: „Als CSV speichern“ – mit IBAN zum Abgleich in der Spenderdatenbank: ' + csv[1]);
  await p.click('.jv-bar .jv-grp button[data-g="privat"]'); await p.waitForTimeout(300);
  const e5 = await bt(), e6 = await ms();
  ok(/^85,7 %/.test(e5.rate) && /^1 /.test(e5.lost) && e6[0] === 'Probe Vier|Probe Zehn', 'E: nur Privat – Haltequote 85,7 %, fehlen nur Probe Vier und Probe Zehn');
  await p.click('.jv-bar .jv-grp button[data-g="alle"]'); await p.waitForTimeout(300);

  // ---- F: Spendenbrücke 2026 → 2027 (jeweils bis 10.10.) – waagerecht, kompakt
  const f0 = await p.evaluate(() => { const B = jvBridgeData(jvSetup(), jvData(jvSetup())); return [B.start, B.neu.sum, B.neu.n, B.mehr.sum, B.mehr.n, B.weniger.sum, B.weniger.n, B.aus.sum, B.aus.n, B.end, B.gleich].join(','); });
  ok(f0 === '380000,103500,4,30000,1,1000,1,203000,2,309500,5', 'F: 3.800 € + neu/wieder 1.035 € (4) + mehr 300 € (1) − weniger 10 € (1) − ausgeblieben 2.030 € (2) = 3.095 €; 5 gleich: ' + f0);
  const f1 = await p.evaluate(() => { const c = document.querySelector('[data-chart="jvbr"]');
    return [document.querySelector('[data-sec="jv-bruecke"] .sec-t').textContent, [...c.querySelectorAll('.jv-brt')].map(t => t.textContent).join('|'), [...c.querySelectorAll('.jv-lv')].map(t => t.textContent).join('|'), c.querySelectorAll('rect.jv-bar').length,
      [...c.querySelectorAll('.sp-ax')].map(t => t.textContent).join('|'), Math.round(c.getBoundingClientRect().height), !!c.closest('.jv-grid2')]; });
  ok(f1[0] === 'Spendenbrücke 2026 → 2027' && f1[1] === '2026|neu / wieder dabei|mehr gegeben|weniger gegeben|ausgeblieben|2027' && f1[2] === '3.800 €|+1.035 €|+300 €|−10 €|−2.030 €|3.095 €' && f1[3] === 6,
    'F: waagerecht – sechs Stufen mit Betrag: ' + f1[2]);
  ok(f1[4] === '4 Spender:innen|1 Spender:in|1 Spender:in|2 Spender:innen' && f1[5] <= 230 && f1[6], 'F: unter jeder Stufe die Zahl der Spender:innen; kompakt (' + f1[5] + ' px) neben der Spenderbindung');

  // ---- G: Neue Felder überstehen Normalisieren und Zusammenführen; „Erstmals seit …“ statt „Neue Spender:innen“
  const g0 = await p.evaluate(() => { const base = clone(D), mine = clone(D), theirs = clone(D);
    mine.spenden.styp = { a1: 'i:bank' }; theirs.spenden.styp = { b2: 'p' }; mine.spenden.sarten = { bank: { t: 'Banken', n: ['Sparkasse'], z: [], o: 0 } }; theirs.spenden.sdaNein = { c3: 1 };
    const m = merge3(base, mine, theirs).data, n = normalize(clone(m)), bad = normalize(Object.assign(clone(D), { spenden: { styp: { x: 'q', y: 'i', z: 'i:Bad Id!', w: 'i:kom' }, sdaNein: { z: 0 }, sarten: 'kaputt' } }));
    return [JSON.stringify(Object.entries(n.spenden.styp).sort()), JSON.stringify(n.spenden.sarten), JSON.stringify(n.spenden.sdaNein), JSON.stringify(bad.spenden.styp), !bad.spenden.sdaNein && !bad.spenden.sarten]; });
  ok(g0[0] === '[["a1","i:bank"],["b2","p"]]' && g0[1] === '{"bank":{"t":"Banken","n":["Sparkasse"],"z":[],"o":0}}' && g0[2] === '{"c3":1}' && g0[3] === '{"y":"i","w":"i:kom"}' && g0[4],
    'G: Einstufung (mit Art), Arten und Ausnahmen werden zusammengeführt; Unsinn fällt beim Laden heraus');
  await p.evaluate(() => { UI.jvKHide = { neu: false }; renderNow(); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('.jv-kt tr[data-k="neu"] .jv-kn')?.textContent === 'Erstmals seit 2025' && !/Neue Spender/.test(document.querySelector('.jv-kt').textContent)), 'G: Zeile heißt „Erstmals seit 2025“');
  ok(await p.evaluate(() => ['bruecke', 'bindung', 'herkunft'].every(k => { const i = document.querySelector('[data-sec="jv-' + k + '"] .sec-h .info'); return i && TIPS.get(i) && TIPS.get(i).length > 20; })), 'G: Brücke, Bindung, Privat & Institutionen mit ⓘ');
  await finish(b, pages);
})();
