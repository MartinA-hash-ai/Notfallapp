// 0.28 Jahresvergleich neu: Institutionen nach Art (längstes Stichwort gewinnt, Umstellung alter Stichwortlisten), Regeln-Dialog (Stichwörter je Art, eigene Arten, von Hand, Prüfliste),
// Abschnitt „Privat & Institutionen“ (Anteil je Jahr, Arten aufklappbar, „→ privat“), eigene Auswahl je Abschnitt, „Auf einen Blick“, Farben erst ab ±5 %, PDF ohne Namen
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
  ok(a0['Lions Club Probe e.V.'] === 'i:verein' && a0['Max Muster'] === 'i:justiz' && a0['Probe Bau GmbH'] === 'i:firma' && a0['Hofgut Probe'] === 'p' && a0['Probe Vier'] === 'p',
    'A: Lions Club → Vereine, „Geldauflage“ im Verwendungszweck → Geldauflagen & Justiz, GmbH → Unternehmen; Privatleute bleiben privat');
  const a1 = await p.evaluate(() => { const n = normalize(Object.assign(clone(D), { spenden: { sworte: { name: ['Stiftung', 'Sparkasse', 'Förderkreis'], zweck: ['Kollekte'] } } })).spenden,
      m = normalize(Object.assign(clone(D), { spenden: { sworte: { name: ['Stiftung'] } } })).spenden;
    return [JSON.stringify(n.sarten.bank), JSON.stringify(n.sarten.stift.n), JSON.stringify(n.sarten.kirche), JSON.stringify(n.sarten.weitere), !('sworte' in n), JSON.stringify(m.sarten.bank.z), JSON.stringify(m.sarten.bank.n)]; });
  ok(a1[0] === '{"t":"Banken & Gewinnsparen","n":["Sparkasse"],"z":[],"o":0}' && a1[1] === '["Stiftung"]' && a1[2] === '{"t":"Kirchengemeinden","n":[],"z":["Kollekte"],"o":3}' && a1[3] === '{"t":"weitere Institutionen","n":["Förderkreis"],"z":[],"o":7}' && a1[4],
    'A: alte Stichwortlisten (0.26/0.27) werden auf die Arten verteilt – entfernte Wörter bleiben weg, eigene kommen unter „weitere Institutionen“');
  ok(a1[5] === '["Gewinnspar","Reinertrag","Zweckertrag","PS-Sparen","PS-Los","Lotterie"]' && a1[6] === '[]', 'A: fehlt die Liste für den Verwendungszweck, bleiben dort die Standardwörter');

  // ---- B: Abschnitt „Privat & Institutionen“ – Anteil je Jahr, Institutionen nach Art mit Veränderung und Mini-Verlauf
  const hk = () => p.evaluate(() => { const s = document.querySelector('[data-sec="jv-herkunft"]');
    return [[...s.querySelectorAll('.jv-pis .jv-pit')].map(t => t.textContent).join('|'), [...s.querySelectorAll('.jv-pis .jv-lv')].map(t => t.textContent).join('|'), s.querySelector('.jv-pin')?.textContent,
      [...s.querySelectorAll('.jv-arts tr')].map(t => [...t.children].slice(0, 4).map(c => c.textContent).join('|'))]; });
  const b0 = await hk();
  ok(b0[0] === '18 %|82 %|15 %|85 %' && b0[1] === '4.900 €|5.730 €' && b0[2] === 'Spender:innen 2027: 3 privat · 6 Institutionen', 'B: je Jahr ein Balken privat/Institutionen (2026: 18 % / 82 %, 2027: 15 % / 85 %), darunter die Spender:innen');
  ok(b0[3].join(' ## ') === 'Institutionen nach Art|Anzahl|2027|ggü. 2026 ## ▸Banken & Gewinnsparen|1|2.500 €|▲ +25,0 % ## ▸Stiftungen|1|1.000 €|■ ±0,0 % ## ▸Vereine & Clubs|1|500 €|▼ −16,7 % ## ▸Kirchengemeinden|1|400 €|neu ## ▸Geldauflagen & Justiz|1|300 €|neu ## ▸Unternehmen|1|150 €|■ ±0,0 % ## ▸Kommunen & Städte|0|0 €|▼ −100,0 % ## zusammen|6|4.850 €|▲ +21,2 %',
    'B: Tabelle „Institutionen nach Art“ – größte zuerst, mit Anzahl, Veränderung, „zusammen“');
  ok(await p.evaluate(() => document.querySelector('[data-sec="jv-herkunft"] .sec-t').textContent === 'Privat & Institutionen' && !document.querySelector('[data-sec="jv-herkunft"] .jv-gctl')), 'B: keine eigene Auswahl – der Abschnitt zeigt immer beide Gruppen');
  await p.click('.jv-bar .jv-grp button[data-g="privat"]'); await p.waitForTimeout(300);
  ok((await hk())[3].length === 9 && await p.evaluate(() => document.querySelector('.jv-kt tr[data-k="sum"]').children[2].textContent === '880 €'), 'B: Leiste „Privat“ – Kennzahlen nur privat (880 €), „Privat & Institutionen“ bleibt vollständig');
  await p.click('.jv-bar .jv-grp button[data-g="alle"]'); await p.waitForTimeout(300);
  // aufklappen, „→ privat“
  await p.click('[data-sec="jv-herkunft"] tr.jv-art[data-art="verein"]'); await p.waitForTimeout(300);
  const b1 = await p.evaluate(() => [...document.querySelectorAll('[data-sec="jv-herkunft"] tr.jv-artm')].map(t => [...t.children].map(c => c.textContent).join('|')).join(' ## '));
  ok(b1 === 'Lions Club Probe e.V. Name: „Lions“||500 €|600 €|→ privat', 'B: Klick auf „Vereine & Clubs“ – darunter die Zahler:innen mit Grund, 2027 und 2026, Knopf „→ privat“: ' + b1);
  await p.click('[data-sec="jv-herkunft"] tr.jv-artm .jv-topriv'); await p.waitForTimeout(300);
  const b2 = await hk();
  ok((await typ())['Lions Club Probe e.V.'] === 'p (Hand)' && b2[0] === '31 %|69 %|24 %|76 %' && !b2[3].some(r => /Vereine/.test(r)), 'B: „→ privat“ – Lions Club zählt jetzt privat, die Art verschwindet aus der Tabelle');
  await p.evaluate(() => commit(d => { delete d.spenden.styp; }, 'Test')); await p.waitForTimeout(300);

  // ---- C: Regeln-Dialog – Arten mit Stichwörtern und Treffern, eigene Art, von Hand, Prüfliste
  await p.click('.jv-iprf'); await p.waitForTimeout(300);
  const rt = () => p.evaluate(() => [...document.querySelectorAll('.jv-imodal .jv-rt tbody tr')].map(t => t.dataset.art + ':' + t.lastChild.textContent).join('|') + ' / ' + document.querySelector('.jv-imodal .jv-ires').textContent);
  const c0 = await rt();
  ok(c0 === 'bank:1|stift:1|kom:0|kirche:1|firma:1|verein:1|justiz:1 / Ergebnis 2027: 6 Institutionen · 3 privat', 'C: Dialog „Privat und Institutionen – Regeln“ – je Art Stichwörter und Treffer 2027: ' + c0);
  ok(await p.evaluate(() => { const r = document.querySelector('.jv-imodal .jv-rt tr[data-art="kom"]'); return [...r.children[1].querySelectorAll('.sp-word')].map(w => w.firstChild.textContent).join() === 'Stadt,Gemeinde,Stadtwerke,Landkreis'; }),
    'C: „Kommunen & Städte“ mit „Stadt“, „Gemeinde“, „Stadtwerke“, „Landkreis“');
  await p.fill('.jv-imodal .jv-rt tr[data-art="firma"] td:nth-child(2) .jv-iwi', 'Hofgut'); await p.press('.jv-imodal .jv-rt tr[data-art="firma"] td:nth-child(2) .jv-iwi', 'Enter'); await p.waitForTimeout(300);
  const c1 = await rt();
  ok(c1 === 'bank:1|stift:1|kom:0|kirche:1|firma:2|verein:1|justiz:1 / Ergebnis 2027: 7 Institutionen · 2 privat' && (await typ())['Hofgut Probe'] === 'i:firma' && await p.evaluate(() => D.spenden.sarten.firma.n.includes('Hofgut')),
    'C: Stichwort „Hofgut“ bei Unternehmen – Treffer 2, Ergebnis 7 Institutionen; der Standard steht jetzt in der Planungsdatei');
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
  // von Hand: Prüfliste „→ Institution ▾“ mit Art, „aufheben“
  ok(await p.evaluate(() => [...document.querySelectorAll('.jv-imodal .jv-priv tr')].map(t => t.querySelector('.jv-in').textContent + ':' + t.children[1].textContent).join('|')) === 'Probe Eins:1.100 €|Hofgut Probe:600 €|Probe Drei:200 €|Probe Vier:80 €',
    'C: Prüfliste – die größten privat eingestuften Zahler:innen (über alle Jahre); der Lions Club bleibt über „e.V.“ ein Verein');
  await p.click('.jv-imodal .jv-priv tr:has-text("Probe Vier") .jv-itog'); await p.waitForTimeout(200);
  const c4 = await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-kpop .mitem')].map(b => b.textContent).join('|'));
  await p.click('.menu.pop .jv-kpop .mitem:has-text("sonstige Institutionen")'); await p.waitForTimeout(300);
  const c5 = await p.evaluate(() => [...document.querySelectorAll('.jv-imodal .jv-hand tr')].map(t => t.querySelector('.jv-in').textContent + ':' + t.querySelector('.jv-pill').textContent).join('|'));
  ok(/^Banken & Gewinnsparen\|Stiftungen\|Kommunen & Städte\|.*\|sonstige Institutionen$/.test(c4) && c5 === 'Probe Vier:sonstige Institutionen' && (await typ())['Probe Vier'] === 'i:sonst (Hand)', 'C: „→ Institution ▾“ – Art wählen; „Probe Vier“ steht unter „Von Hand eingestuft“');
  await p.click('.jv-imodal .jv-artstd'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !D.spenden.sarten) && (await typ())['Lions Club Probe e.V.'] === 'i:verein', 'C: „Standard wiederherstellen“ – Arten und Stichwörter wie zu Beginn');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-sec="jv-herkunft"] tr.jv-art')].some(t => t.textContent.includes('sonstige Institutionen'))), 'C: in der Tabelle jetzt auch „sonstige Institutionen“');
  await p.evaluate(() => commit(d => { delete d.spenden.styp; }, 'Test')); await p.waitForTimeout(300);
  const c6 = await p.evaluate(() => { const a = clone(D), b = clone(D); b.spenden.sarten = { bank: { t: 'Banken', n: ['Sparkasse'], z: [], o: 0 } }; return describeChanges(a, b).filter(t => /Arten/.test(t)).join('|'); });
  ok(c6 === 'Jahresvergleich: Arten und Stichwörter für Institutionen geändert', 'C: Änderung der Arten wird beim Zusammenführen beschrieben');

  // ---- D: eigene Auswahl je Abschnitt (Spenderbindung, Segmente, Dauerspender:innen, Größte)
  await p.evaluate(() => { UI.secOpen['jv-top'] = true; renderNow(); }); await p.waitForTimeout(300);
  const bd = () => p.evaluate(() => [[...document.querySelectorAll('[data-sec="jv-bindung"] .jv-mt1')].map(k => k.dataset.k + ':' + k.querySelector('.jv-mtv').textContent).join('|'), document.querySelector('[data-sec="jv-bindung"] .jv-missn')?.textContent,
    document.querySelector('[data-sec="jv-bindung"] .jv-gctl').textContent, [...document.querySelectorAll('.jv-gctl')].length]);
  const d0 = await bd();
  ok(d0[0] === 'rate:75,0 %|keep:6|react:0|lost:2' && d0[1] === '2 Spender:innen · 350 €' && d0[2] === 'AllePrivatInstitutionen' && d0[3] === 2 && await p.evaluate(() => !document.querySelector('[data-sec="jv-seg"] .jv-gctl')), 'D: Bindung (alle) – Haltequote 75,0 %; eigene Auswahl bei Bindung und Größte (Segmente und Dauerspender:innen erst aufgeklappt)');
  await p.click('[data-sec="jv-bindung"] .jv-gctl button[data-g="inst"]'); await p.waitForTimeout(300);
  const d1 = await bd();
  ok(d1[0] === 'rate:80,0 %|keep:4|react:0|lost:1' && d1[1] === '1 Spender:in · 250 €' && d1[2] === 'eigene Auswahl · wie obenAllePrivatInstitutionen' && await p.evaluate(() => JSON.stringify(UI.jvGrpSec) === '{"bindung":"inst"}' && UI_KEYS.includes('jvGrpSec')),
    'D: Bindung „Institutionen“ – 80,0 % (4 von 5), es fehlt die Gemeinde; „eigene Auswahl · wie oben“, gemerkt');
  ok(await p.evaluate(() => document.querySelector('.jv-kt tr[data-k="sum"]').children[2].textContent === '5.730 €' && document.querySelectorAll('.jv-top tbody tr').length === 9), 'D: die anderen Abschnitte bleiben bei „Alle“');
  await p.click('[data-sec="jv-top"] .jv-gctl button[data-g="privat"]'); await p.waitForTimeout(300);
  const d2 = await p.evaluate(() => [[...document.querySelectorAll('.jv-top tr')].map(t => [...t.children].map(c => c.textContent).join(';')).join(' / '), JSON.stringify(UI.jvGrpSec)]);
  ok(d2[0] === ';Name;2027;2026;Veränderung;Anteil / 1.;Probe Eins;500 €;500 €;■ ±0,0 %;56,8 % / 2.;Hofgut Probe;300 €;300 €;■ ±0,0 %;34,1 % / 3.;Probe Vier;80 €;–;neu;9,1 %' && d2[1] === '{"bindung":"inst","top":"privat"}',
    'D: Größte „Privat“ – nur Privatleute, ohne Spalte „Gruppe“');
  // PDF: Titel mit eigener Auswahl, „Privat & Institutionen“ ohne Namen und Knöpfe
  await p.click('[data-sec="jv-herkunft"] tr.jv-art[data-art="bank"]'); await p.waitForTimeout(300);
  const d3 = await p.evaluate(() => { window.print = () => {}; document.querySelector('.jv-pdf').click(); return new Promise(r => setTimeout(() => {
    const pgs = [...document.querySelectorAll('#printdoc .pd-page')], h = pgs.find(x => x.querySelector('h1').textContent === 'Privat & Institutionen 2027');
    r([pgs.map(x => x.querySelector('h1').textContent).filter(t => /bindung|Größte/.test(t)).join(' | '), !!h && !h.querySelector('.jv-topriv, .jv-chev, tr.jv-artm, button') && !/Sparkasse|Stiftung der|Probe/.test(h.textContent) && h.querySelectorAll('tr.jv-art').length === 7,
      pgs.every(x => !x.querySelector('input, select, .jv-gctl, .jv-hide, .jv-drag')), !/Probe|Muster|Lions/.test(document.querySelector('#printdoc').textContent.replace(/Spendenbrücke|Probe Bau/g, ''))]); }, 300)); });
  ok(d3[0] === 'Spendenbrücke 2026 → 2027 · Spenderbindung 2027 · nur Institutionen | Größte Spender:innen 2027 · nur Privat', 'D: PDF – Titel nennen die eigene Auswahl: ' + d3[0]);
  ok(d3[1] && d3[2] && d3[3], 'D: PDF – „Privat & Institutionen“ nur mit den Arten (nicht aufgeklappt, keine Knöpfe), nirgends Namen oder Eingabefelder');
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(150);
  await p.click('[data-sec="jv-bindung"] .jv-own'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JSON.stringify(UI.jvGrpSec) === '{"top":"privat"}' && !document.querySelector('[data-sec="jv-bindung"] .jv-own')), 'D: „eigene Auswahl · wie oben“ – Bindung folgt wieder der Leiste');

  // ---- E: „Auf einen Blick“ – Satz und vier Zahlen; Farben erst ab ±5 % (Anteile ±2 Pkt.)
  const e0 = await p.evaluate(() => [document.querySelector('.jv-say').textContent, [...document.querySelectorAll('.jv-gt')].map(t => t.dataset.k + ':' + t.querySelector('.jv-gtt').textContent + '=' + t.querySelector('.jv-gtv').textContent).join(' | ')]);
  ok(e0[0] === '2027 bis 10.10.: 5.730 € – 16,9 % mehr als 2026 im gleichen Zeitraum. Hochgerechnet ≈ 5.964 €.' && e0[1] === 'sum:Spendensumme bis 10.10.=5.730 € | proj:Hochrechnung 31.12.=≈ 5.964 € | don:Spender:innen=9 | avg:Ø je Spende=318,33 €',
    'E: ' + e0[0] + ' – Kacheln Spendensumme, Hochrechnung, Spender:innen, Ø je Spende');
  const e1 = await p.evaluate(() => [jvDEl(100, 104).className, jvDEl(100, 105).className, jvDEl(100, 96).className, jvDEl(100, 94).className, jvDEl(0.5, 0.515, { pp: true }).className, jvDEl(0.5, 0.53, { pp: true }).className, jvDEl(10, 5, { inv: true }).className, jvDEl(100, 1200).textContent]);
  ok(e1.join() === 'jv-d jv-sm,jv-d jv-up,jv-d jv-sm,jv-d jv-dn,jv-d jv-sm,jv-d jv-up,jv-d jv-up,▲ ×12', 'E: +4 % / −4 % / +1,5 Pkt. ohne Farbe, ab ±5 % bzw. ±2 Pkt. grün oder rot; „weniger ist besser“ umgekehrt; ab +900 % als Faktor (×12)');
  ok(await p.evaluate(() => !document.querySelector('.jv .jv-foot, .jv .jv-kn.muted, .jv .spj-hint') && !/\* /.test(document.querySelector('.jv').textContent)), 'E: keine Fußnoten, keine Sternchen');
  await finish(b, pages);
})();
