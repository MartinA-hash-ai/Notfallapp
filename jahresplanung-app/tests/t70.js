// 0.28/0.29 Jahresvergleich: Institutionen nach Art (längstes Stichwort gewinnt, Umstellung alter Stichwortlisten), Regeln-Dialog (Stichwörter je Art, eigene Arten, von Hand, Listen Privat | Institutionen),
// Abschnitt „Privat & Institutionen“ (Anteil je Jahr, Arten aufklappbar, „→ privat“), Auswahl nur in der Leiste, „Auf einen Blick“, Farben erst ab ±5 %, PDF ohne Namen
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const p2 = x => String(x).padStart(2, '0');
// alles erfunden; IBAN = DE00… + Nummer
const L = (d, b, nr, name, zw = 'Spende') => [d, d, String(b), "'TESTDE11XXX", 'DE0010000000000000' + nr, name, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - Lage"].join(';');
const year = y => { const r = [];
  for (let m = 1; m <= (y === 2027 ? 10 : 12); m++) r.push(L('10.' + p2(m) + '.' + y, 50, '0001', 'Probe Eins'));          // privat, jeden Monat
  r.push(L('15.06.' + y, 300, '0002', 'Hofgut Probe'));                                                                       // privat (bis jemand „Hofgut“ als Stichwort einträgt)
  if (y === 2026) r.push(L('01.03.2026', 100, '0003', 'Probe Drei'), L('18.12.2026', 100, '0003', 'Probe Drei', 'Weihnachtsspende'), L('01.08.2026', 250, '8006', 'Gemeinde Probe'));
  if (y === 2027) r.push(L('01.05.2027', 80, '0004', 'Probe Vier'), L('05.09.2027', 400, '8003', 'Kath. Kirchengemeinde St. Probe'), L('07.07.2027', 300, '8005', 'Max Muster', 'Geldauflage 12 Ds 34/27'));
  r.push(L('12.03.' + y, y === 2026 ? 2000 : 2500, '8001', 'Stadtsparkasse Lage'), L('20.04.' + y, 1000, '8002', 'Bürgerstiftung der Stadt Lage'),
    L('15.05.' + y, y === 2026 ? 600 : 500, '8004', 'Lions Club Probe e.V.'), L('01.02.' + y, 150, '8007', 'Probe Bau GmbH'));
  return '﻿' + [HEAD, ...r].join('\r\n') + '\r\n'; };

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1400, height: 1000 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(F => { for (const [y, t] of Object.entries(F)) __fs.files['/Mailing/Spendeneingänge ' + y + '/e' + y + '.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; },
    Object.fromEntries([2026, 2027].map(y => [y, year(y)])));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'vergleich'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length > 30); await p.waitForTimeout(400);

  // ---- A: Arten – passt mehr als ein Stichwort, gewinnt das längste; Name vor Verwendungszweck
  const typ = () => p.evaluate(() => Object.fromEntries([...jvPayers().by.values()].map(o => [o.name, o.typ + (o.art ? ':' + o.art : '') + (o.hand ? ' (Hand)' : '')])));
  const a0 = await typ();
  ok(a0['Stadtsparkasse Lage'] === 'i:bank' && a0['Bürgerstiftung der Stadt Lage'] === 'i:stift' && a0['Kath. Kirchengemeinde St. Probe'] === 'i:kirche' && a0['Gemeinde Probe'] === 'i:kom',
    'A: „Stadtsparkasse“ → Banken (Sparkasse vor Stadt), „Bürgerstiftung der Stadt“ → Stiftungen, „Kirchengemeinde“ → Kirchengemeinden (nicht Kommunen), „Gemeinde Probe“ → Kommunen');
  ok(a0['Lions Club Probe e.V.'] === 'i:verein' && a0['Max Muster'] === 'p' && a0['Probe Bau GmbH'] === 'i:firma' && a0['Hofgut Probe'] === 'p' && a0['Probe Vier'] === 'p',
    'A: Lions Club → Vereine, GmbH → Unternehmen; „Geldauflage“ ist keine Art mehr (eigenes Konto); Privatleute bleiben privat');
  const a1 = await p.evaluate(() => { const n = normalize(Object.assign(clone(D), { spenden: { sworte: { name: ['Stiftung', 'Sparkasse', 'Förderkreis', 'Amtsgericht'], zweck: ['Kollekte', 'Geldauflage'] } } })).spenden,
      m = normalize(Object.assign(clone(D), { spenden: { sworte: { name: ['Stiftung'] } } })).spenden;
    return [JSON.stringify(n.sarten.bank), JSON.stringify(n.sarten.stift.n), JSON.stringify(n.sarten.kirche), JSON.stringify(n.sarten.weitere), !('sworte' in n), JSON.stringify(m.sarten.bank.z), JSON.stringify(m.sarten.bank.n)]; });
  ok(a1[0] === '{"t":"Banken & Gewinnsparen","n":["Sparkasse"],"z":[],"o":0}' && a1[1] === '["Stiftung"]' && a1[2] === '{"t":"Kirchengemeinden","n":[],"z":["Kollekte"],"o":3}' && a1[3] === '{"t":"weitere Institutionen","n":["Förderkreis"],"z":[],"o":6}' && a1[4],
    'A: alte Stichwortlisten (0.26/0.27) werden auf die Arten verteilt – entfernte Wörter (auch Geldauflage, Amtsgericht) bleiben weg, eigene kommen unter „weitere Institutionen“');
  const a2 = await p.evaluate(() => { const x = normalize(Object.assign(clone(D), { spenden: { sarten: { justiz: { t: 'Geldauflagen & Justiz', n: ['Amtsgericht'], z: ['Geldauflage'], o: 6 }, bank: { t: 'Banken', n: ['Sparkasse'], z: [], o: 0 } } } })).spenden.sarten;
    return [Object.keys(x).join(), JV_ARTEN.map(a => a.id).join()]; });
  ok(a2[0] === 'bank' && a2[1] === 'bank,stift,kom,kirche,firma,verein', 'A: „Geldauflagen & Justiz“ fällt auch aus gespeicherten Regeln heraus');
  ok(a1[5] === '["Gewinnspar","Reinertrag","Zweckertrag","PS-Sparen","PS-Los","Lotterie"]' && a1[6] === '[]', 'A: fehlt die Liste für den Verwendungszweck, bleiben dort die Standardwörter');

  // ---- B: Abschnitt „Privat & Institutionen“ – Anteil je Jahr, Institutionen nach Art mit Veränderung und Mini-Verlauf
  const hk = () => p.evaluate(() => { const s = document.querySelector('[data-sec="jv-herkunft"]');
    return [[...s.querySelectorAll('.jv-pis .jv-pit')].map(t => t.textContent).join('|'), [...s.querySelectorAll('.jv-pis .jv-lv')].map(t => t.textContent).join('|'), s.querySelector('.jv-pin')?.textContent,
      [...s.querySelectorAll('.jv-arts tr')].map(t => [...t.children].slice(0, 4).map(c => c.textContent).join('|'))]; });
  const b0 = await hk();
  ok(b0[0] === '18 %|82 %|21 %|79 %' && b0[1] === '' && b0[2] === 'Spender:innen 2027: 4 privat · 5 Institutionen', 'B: je Jahr ein Balken privat/Institutionen (2026: 18 % / 82 %, 2027: 21 % / 79 %) ohne Summe dahinter, darunter die Spender:innen');
  ok(b0[3].join(' ## ') === 'Institutionen nach Art|Anzahl|2027|ggü. 2026 ## ▸Banken & Gewinnsparen|1|2.500 €|▲ +25,0 % ## ▸Stiftungen|1|1.000 €|■ ±0,0 % ## ▸Vereine & Clubs|1|500 €|▼ −16,7 % ## ▸Kirchengemeinden|1|400 €|neu ## ▸Unternehmen|1|150 €|■ ±0,0 % ## ▸Kommunen & Städte|0|0 €|▼ −100,0 % ## zusammen|5|4.550 €|▲ +13,7 %',
    'B: Tabelle „Institutionen nach Art“ – größte zuerst, mit Anzahl, Veränderung, „zusammen“');
  const dens = () => p.evaluate(() => { const g = [...document.querySelectorAll('[data-sec="jv-herkunft"] .jv-pirow')], cs = e => getComputedStyle(e);
    return [g.map(x => x.classList.contains('main') ? 'H' : 'o').join(''), cs(g[0].querySelector('.jv-pit')).opacity, cs(g[0].querySelector('.jv-pp')).transform !== 'none', cs(g[1].querySelector('.jv-pit')).opacity, document.querySelector('[data-sec="jv-herkunft"] .jv-dens').textContent].join(); });
  const b0c = await dens();
  await p.click('[data-sec="jv-herkunft"] .jv-dens'); await p.waitForTimeout(350);
  const b0d = await dens(), b0e = await p.evaluate(() => [UI.jvPiFull, UI_KEYS.includes('jvPiFull'), document.querySelector('[data-sec="jv-herkunft"] .jv-pis').classList.contains('jv-full')].join());
  await p.click('[data-sec="jv-herkunft"] .jv-dens'); await p.waitForTimeout(350);
  ok(b0c === 'oH,0,true,1,ausführlich' && b0d === 'oH,1,false,1,kompakt' && b0e === 'true,true,true' && await dens() === b0c,
    'B: Vorjahr schmal ohne Zahlen, Hauptjahr breit; „ausführlich“ zeigt alle breit mit Zahlen, „kompakt“ wieder schmal – gemerkt');
  ok(await p.evaluate(() => document.querySelector('[data-sec="jv-herkunft"] .sec-t').textContent === 'Privat & Institutionen' && !document.querySelector('[data-sec="jv-herkunft"] .jv-gctl')), 'B: keine eigene Auswahl – der Abschnitt zeigt immer beide Gruppen');
  await p.click('.jv-bar .jv-grp button[data-g="privat"]'); await p.waitForTimeout(300);
  ok((await hk())[3].length === 8 && await p.evaluate(() => document.querySelector('.jv-kt tr[data-k="sum"]').children[2].textContent === '1.180 €'), 'B: Leiste „Privat“ – Kennzahlen nur privat (1.180 €), „Privat & Institutionen“ bleibt vollständig');
  await p.click('.jv-bar .jv-grp button[data-g="alle"]'); await p.waitForTimeout(300);
  // aufklappen, „→ privat“
  await p.click('[data-sec="jv-herkunft"] tr.jv-art[data-art="verein"]'); await p.waitForTimeout(300);
  const b1 = await p.evaluate(() => [...document.querySelectorAll('[data-sec="jv-herkunft"] tr.jv-artm')].map(t => [...t.children].map(c => c.textContent).join('|')).join(' ## '));
  ok(b1 === 'Lions Club Probe e.V. Name: „Lions“||500 €|600 €|→ privat', 'B: Klick auf „Vereine & Clubs“ – darunter die Zahler:innen mit Grund, 2027 und 2026, Knopf „→ privat“: ' + b1);
  await p.click('[data-sec="jv-herkunft"] tr.jv-artm .jv-topriv'); await p.waitForTimeout(300);
  const b2 = await hk();
  ok((await typ())['Lions Club Probe e.V.'] === 'p (Hand)' && b2[0] === '31 %|69 %|29 %|71 %' && !b2[3].some(r => /Vereine/.test(r)), 'B: „→ privat“ – Lions Club zählt jetzt privat, die Art verschwindet aus der Tabelle');
  await p.evaluate(() => commit(d => { delete d.spenden.styp; }, 'Test')); await p.waitForTimeout(300);

  // ---- C: Regeln-Dialog – Arten mit Stichwörtern und Treffern, eigene Art, von Hand, Prüfliste
  await p.click('.jv-iprf'); await p.waitForTimeout(300);
  const rt = () => p.evaluate(() => [...document.querySelectorAll('.jv-imodal .jv-rt tbody tr')].map(t => t.dataset.art + ':' + t.lastChild.textContent).join('|') + ' / ' + document.querySelector('.jv-imodal .jv-ires').textContent);
  const c0 = await rt();
  ok(c0 === 'bank:1|stift:1|kom:0|kirche:1|firma:1|verein:1 / Ergebnis 2027: 5 Institutionen · 4 privat', 'C: Dialog „Privat und Institutionen – Regeln“ – je Art Stichwörter und Treffer 2027: ' + c0);
  ok(await p.evaluate(() => { const r = document.querySelector('.jv-imodal .jv-rt tr[data-art="kom"]'); return [...r.children[1].querySelectorAll('.sp-word')].map(w => w.firstChild.textContent).join() === 'Stadt,Gemeinde,Stadtwerke,Landkreis'; }),
    'C: „Kommunen & Städte“ mit „Stadt“, „Gemeinde“, „Stadtwerke“, „Landkreis“');
  await p.fill('.jv-imodal .jv-rt tr[data-art="firma"] td:nth-child(2) .jv-iwi', 'Hofgut'); await p.press('.jv-imodal .jv-rt tr[data-art="firma"] td:nth-child(2) .jv-iwi', 'Enter'); await p.waitForTimeout(300);
  const c1 = await rt();
  ok(c1 === 'bank:1|stift:1|kom:0|kirche:1|firma:2|verein:1 / Ergebnis 2027: 6 Institutionen · 3 privat' && (await typ())['Hofgut Probe'] === 'i:firma' && await p.evaluate(() => D.spenden.sarten.firma.n.includes('Hofgut')),
    'C: Stichwort „Hofgut“ bei Unternehmen – Treffer 2, Ergebnis 6 Institutionen; der Standard steht jetzt in der Planungsdatei');
  await p.click('.jv-imodal .jv-rt tr[data-art="firma"] .sp-x[aria-label="Hofgut entfernen"]'); await p.waitForTimeout(300);
  // eigene Art: gleich lange Wörter – die Art weiter oben gewinnt; ohne „Lions“ bei den Vereinen greift die neue Art
  await p.evaluate(() => { window.prompt = () => 'Serviceclubs'; });
  await p.click('.jv-imodal .jv-addart'); await p.waitForTimeout(300);
  const nid = await p.evaluate(() => Object.keys(D.spenden.sarten).find(k => D.spenden.sarten[k].t === 'Serviceclubs'));
  await p.fill('.jv-imodal .jv-rt tr[data-art="' + nid + '"] td:nth-child(2) .jv-iwi', 'Lions'); await p.press('.jv-imodal .jv-rt tr[data-art="' + nid + '"] td:nth-child(2) .jv-iwi', 'Enter'); await p.waitForTimeout(300);
  const c2 = (await typ())['Lions Club Probe e.V.'];
  await p.click('.jv-imodal .jv-rt tr[data-art="verein"] .sp-x[aria-label="Lions entfernen"]'); await p.waitForTimeout(300);
  const c3 = (await typ())['Lions Club Probe e.V.'];
  ok(!!nid && c2 === 'i:verein' && c3 === 'i:' + nid && await p.evaluate(id => document.querySelector('.jv-imodal .jv-rt tr[data-art="' + id + '"]').lastChild.textContent === '1', nid),
    'C: „+ Art hinzufügen“ (Serviceclubs) mit „Lions“ – bei gleich langen Wörtern gewinnt die obere Art; ohne „Lions“ bei den Vereinen zählt der Club zu den Serviceclubs');
  await p.click('.jv-imodal .jv-rt tr[data-art="' + nid + '"] .sp-x[aria-label="Lions entfernen"]'); await p.waitForTimeout(300);
  await p.click('.jv-imodal .jv-rt tr[data-art="' + nid + '"] button.link:has-text("entfernen")'); await p.waitForTimeout(300);
  ok(await p.evaluate(id => !D.spenden.sarten[id] && !document.querySelector('.jv-imodal .jv-rt tr[data-art="' + id + '"]'), nid), 'C: leere eigene Art lässt sich wieder entfernen');
  // zwei Listen: Privat | Institutionen – Name, Verwendungszweck, Zahl der Spenden, Summe im Hauptjahr; Suche über Name und Verwendungszweck
  const ls = () => p.evaluate(() => [...document.querySelectorAll('.jv-imodal .jv-lbox')].map(b => [b.querySelector('.jv-h4').textContent,
    [...b.querySelectorAll('tbody tr')].map(t => [...t.children].slice(0, 4).map(x => x.textContent).join('|')).join(' ## ')]));
  const c7 = await ls();
  ok(c7[0][0] === 'Privat (4 · 1.180 €)' && c7[0][1] === 'Probe Eins|Spende|10|500 € ## Hofgut Probe|Spende|1|300 € ## Max Muster|Geldauflage 12 Ds 34/27|1|300 € ## Probe Vier|Spende|1|80 €',
    'C: Liste „Privat“ 2027 – Name, Verwendungszweck, Spenden, Summe (größte zuerst): ' + c7[0][1]);
  ok(c7[1][0] === 'Institutionen (5 · 4.550 €)' && c7[1][1].split(' ## ')[0] === 'Stadtsparkasse LageBanken & Gewinnsparen ▾ Treffer „Sparkasse“|Spende|1|2.500 €' && c7[1][1].split(' ## ').length === 5,
    'C: Liste „Institutionen“ – mit Art und Grund: ' + c7[1][1].split(' ## ')[0]);
  ok(await p.evaluate(() => [...document.querySelectorAll('.jv-imodal .jv-lt thead th')].slice(0, 5).map(t => t.textContent).join('|')) === 'Name|Verwendungszweck 2027|Anz.|Summe|', 'C: Spalten Name, Verwendungszweck, Anzahl, Summe');
  await p.fill('.jv-isrch', 'geldauflage'); await p.waitForTimeout(250);
  const c8 = await ls();
  ok(c8[0][1] === 'Max Muster|Geldauflage 12 Ds 34/27|1|300 €' && c8[1][0] === 'Institutionen (0 · 0 €)' && await p.evaluate(() => /Keine Treffer/.test(document.querySelector('.jv-imodal .jv-icols').textContent)),
    'C: Suche findet auch im Verwendungszweck („geldauflage“ → Max Muster)');
  await p.fill('.jv-isrch', ''); await p.waitForTimeout(250);
  await p.click('.jv-imodal .jv-instl tr:has-text("Probe Bau GmbH") .jv-artch'); await p.waitForTimeout(200);
  await p.click('.menu.pop .jv-kpop .mitem:has-text("Vereine & Clubs")'); await p.waitForTimeout(300);
  const c9 = [(await typ())['Probe Bau GmbH'], await p.evaluate(() => [...document.querySelectorAll('.jv-imodal .jv-instl tbody tr')].find(t => t.textContent.includes('Probe Bau GmbH')).querySelector('.jv-iwhy').textContent)];
  await p.click('.jv-imodal .jv-instl tr:has-text("Probe Bau GmbH") .jv-topriv'); await p.waitForTimeout(300);
  const c10 = [(await typ())['Probe Bau GmbH'], (await ls())[0][1].includes('Probe Bau GmbH')];
  await p.click('.jv-imodal .jv-hand tr:has-text("Probe Bau GmbH") .jv-unhand'); await p.waitForTimeout(300);
  ok(c9[0] === 'i:verein (Hand)' && c9[1] === 'Vereine & Clubs ▾ von Hand' && c10[0] === 'p (Hand)' && c10[1] && (await typ())['Probe Bau GmbH'] === 'i:firma',
    'C: in der Liste Art ändern (Unternehmen → Vereine), „→ privat“ schiebt in die linke Liste, „aufheben“ stellt die Erkennung wieder her');
  await p.click('.jv-imodal .jv-priv tr:has-text("Probe Vier") .jv-itog'); await p.waitForTimeout(200);
  const c4 = await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-kpop .mitem')].map(b => b.textContent).join('|'));
  await p.click('.menu.pop .jv-kpop .mitem:has-text("sonstige Institutionen")'); await p.waitForTimeout(300);
  const c5 = await p.evaluate(() => [...document.querySelectorAll('.jv-imodal .jv-hand tr')].map(t => t.querySelector('.jv-in').firstChild.textContent + ':' + t.querySelector('.jv-pill').textContent).join('|'));
  ok(/^Banken & Gewinnsparen\|Stiftungen\|Kommunen & Städte\|.*\|sonstige Institutionen$/.test(c4) && c5 === 'Probe Vier:sonstige Institutionen' && (await typ())['Probe Vier'] === 'i:sonst (Hand)', 'C: „→ Institution ▾“ – Art wählen; „Probe Vier“ steht unter „Von Hand eingestuft“');
  await p.click('.jv-imodal .jv-artstd'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !D.spenden.sarten) && (await typ())['Lions Club Probe e.V.'] === 'i:verein', 'C: „Standard wiederherstellen“ – Arten und Stichwörter wie zu Beginn');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-sec="jv-herkunft"] tr.jv-art')].some(t => t.textContent.includes('sonstige Institutionen'))), 'C: in der Tabelle jetzt auch „sonstige Institutionen“');
  await p.evaluate(() => commit(d => { delete d.spenden.styp; }, 'Test')); await p.waitForTimeout(300);
  const c6 = await p.evaluate(() => { const a = clone(D), b = clone(D); b.spenden.sarten = { bank: { t: 'Banken', n: ['Sparkasse'], z: [], o: 0 } }; return describeChanges(a, b).filter(t => /Arten/.test(t)).join('|'); });
  ok(c6 === 'Jahresvergleich: Arten und Stichwörter für Institutionen geändert', 'C: Änderung der Arten wird beim Zusammenführen beschrieben');

  // ---- D: Auswahl Alle / Privat / Institutionen nur oben in der Leiste – gilt für Bindung, Segmente, Dauerspender:innen, Größte
  await p.evaluate(() => { UI.secOpen['jv-top'] = true; UI.secOpen['jv-seg'] = true; UI.secOpen['jv-dauer'] = true; UI.jvGrpSec = { bindung: 'inst' }; renderNow(); }); await p.waitForTimeout(300);
  const bd = () => p.evaluate(() => [[...document.querySelectorAll('[data-sec="jv-bindung"] .jv-mt1')].map(k => k.dataset.k + ':' + k.querySelector('.jv-mtv').textContent).join('|'), document.querySelector('[data-sec="jv-bindung"] .jv-missn')?.textContent]);
  const d0 = await bd();
  ok(d0[0] === 'rate:75,0 %|keep:6|react:0|lost:2' && d0[1] === '2 Spender:innen · 350 €' && await p.evaluate(() => !document.querySelector('.jv-gctl, .jv-own') && !UI_KEYS.includes('jvGrpSec')),
    'D: keine eigene Auswahl mehr in den Abschnitten (eine alte gemerkte Auswahl zählt nicht) – Bindung zeigt alle: Haltequote 75,0 %');
  await p.click('.jv-bar .jv-grp button[data-g="inst"]'); await p.waitForTimeout(300);
  const d1 = await bd();
  ok(d1[0] === 'rate:80,0 %|keep:4|react:0|lost:1' && d1[1] === '1 Spender:in · 250 €', 'D: Leiste „Institutionen“ – Bindung 80,0 % (4 von 5), es fehlt die Gemeinde');
  await p.click('.jv-bar .jv-grp button[data-g="privat"]'); await p.waitForTimeout(300);
  const d2 = await p.evaluate(() => [...document.querySelectorAll('.jv-top tr')].map(t => [...t.children].map(c => c.textContent).join(';')).join(' / '));
  ok(d2 === ';Name;2027;2026;Veränderung;Anteil / 1.;Probe Eins;500 €;500 €;■ ±0,0 %;42,4 % / 2.;Hofgut Probe;300 €;300 €;■ ±0,0 %;25,4 % / 3.;Max Muster;300 €;–;neu;25,4 % / 4.;Probe Vier;80 €;–;neu;6,8 %',
    'D: Leiste „Privat“ – Größte nur Privatleute, ohne Spalte „Gruppe“');
  // PDF: Auswahl im Kopf jeder Seite, „Privat & Institutionen“ ohne Namen und Knöpfe
  await p.click('[data-sec="jv-herkunft"] tr.jv-art[data-art="bank"]'); await p.waitForTimeout(300);
  const d3 = await p.evaluate(() => { window.print = () => {}; jvPrintPDF(); return new Promise(r => setTimeout(() => {
    const pgs = [...document.querySelectorAll('#printdoc .pd-page')], h = pgs.find(x => x.querySelector('h1').textContent === 'Privat & Institutionen 2027');
    r([pgs.map(x => x.querySelector('h1').textContent).filter(t => /bindung|Größte/.test(t)).join(' | '), !!h && !h.querySelector('.jv-topriv, .jv-chev, tr.jv-artm, button') && !/Sparkasse|Stiftung der|Probe/.test(h.textContent) && h.querySelectorAll('tr.jv-art').length === 6,
      pgs.every(x => !x.querySelector('input, select, .jv-gctl, .jv-hide, .jv-drag')), pgs.filter(x => !/^Größte/.test(x.querySelector('h1').textContent)).every(x => !/Probe|Muster|Lions/.test(x.textContent.replace(/Spendenbrücke|Probe Bau/g, ''))),
      pgs.every(x => /· nur Privat$/.test(x.querySelector('.pd-head span').textContent))]); }, 300)); });
  ok(d3[0] === 'Spenderbindung · Dauerspender:innen · Zwecke · Konten 2027 | Größte Spender:innen 2027' && d3[4], 'D: PDF – Titel ohne eigene Auswahl, die Auswahl der Leiste steht im Kopf jeder Seite („nur Privat“)');
  ok(d3[1] && d3[2] && d3[3], 'D: PDF – „Privat & Institutionen“ nur mit den Arten (nicht aufgeklappt, keine Knöpfe), nirgends Namen oder Eingabefelder');
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(150);
  await p.click('.jv-bar .jv-grp button[data-g="alle"]'); await p.waitForTimeout(300);

  // ---- E: „Auf einen Blick“ – Satz und vier Zahlen; Farben erst ab ±5 % (Anteile ±2 Pkt.)
  const e0 = await p.evaluate(() => [!document.querySelector('.jv-say'), [...document.querySelectorAll('.jv-gt:not(.jv-gtz)')].map(t => t.dataset.k + ':' + t.querySelector('.jv-gtt').textContent + '=' + t.querySelector('.jv-gtv').textContent).join(' | ')]);
  ok(e0[0] && e0[1] === 'sum:Spendensumme bis 10.10.=5.730 € | proj:Hochrechnung 31.12.=≈ 5.964 € | don:Spender:innen=9 | avg:Ø je Spende=318,33 €',
    'E: „Auf einen Blick“ – vier Kacheln Spendensumme, Hochrechnung, Spender:innen, Ø je Spende, kein Satz');
  const e1 = await p.evaluate(() => [jvDEl(100, 104).className, jvDEl(100, 105).className, jvDEl(100, 96).className, jvDEl(100, 94).className, jvDEl(0.5, 0.515, { pp: true }).className, jvDEl(0.5, 0.53, { pp: true }).className, jvDEl(10, 5, { inv: true }).className, jvDEl(100, 1200).textContent]);
  ok(e1.join() === 'jv-d jv-sm,jv-d jv-up,jv-d jv-sm,jv-d jv-dn,jv-d jv-sm,jv-d jv-up,jv-d jv-up,▲ ×12', 'E: +4 % / −4 % / +1,5 Pkt. ohne Farbe, ab ±5 % bzw. ±2 Pkt. grün oder rot; „weniger ist besser“ umgekehrt; ab +900 % als Faktor (×12)');
  ok(await p.evaluate(() => !document.querySelector('.jv .jv-foot, .jv .jv-kn.muted, .jv .spj-hint') && !/\* /.test(document.querySelector('.jv').textContent)), 'E: keine Fußnoten, keine Sternchen');
  await finish(b, pages);
})();
