// 0.20–0.23 Jahresvergleich (eigener Reiter): Jahre wählen, Stichtag, Sondereffekte je Jahr, Kennzahlen mit Säulen je Jahr (Zahl, Veränderung, Säule, Jahr),
// Jahresverlauf mit anklickbaren Quartalen (Vergleich darunter: alle Quartale, das Quartal in den Jahren, Gegenüberstellung), Mailings vergleichen (bis zu vier, frei gewählt), Bausteine ein-/ausblenden
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const p2 = x => String(x).padStart(2, '0');
// erfundene Buchungen: je Jahr feste Spender:innen A–F, dazu neue; 2027 nur bis 10.10.
const L = (d, b, who, zw = 'Spende', da = false) => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000' + who, 'Probe ' + who, "'Zugang/Gutschrift", zw, da ? "'Dauerauftragsgutschr" : "'Spendengutschrift", "'Paderborn - Lage"].join(';');
const year = y => { const r = [];
  for (let m = 1; m <= 12; m++) { if (y === 2027 && m > 10) break;
    r.push(L('05.' + p2(m) + '.' + y, 20, '000001', 'Spende', true));                       // Dauerauftrag A, jeden Monat
    if (m % 3 === 0) r.push(L('10.' + p2(m) + '.' + y, 100, '000002'));                       // B jedes Quartal
    if (m === 11 || m === 12) r.push(L('20.' + p2(m) + '.' + y, 50, '0001' + y + m, 'Weihnachtsspende'));   // je Jahr neue Weihnachtsspender:innen
  }
  r.push(L('10.10.' + y, 30, '000003'));                                                       // C am Stichtag
  if (y === 2026) r.push(L('15.06.2026', 25000, '009999', 'Nachlass Probe'));                    // Erbschaft
  return '﻿' + [HEAD, ...r].join('\r\n') + '\r\n'; };

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1400, height: 1000 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(F => { for (const [y, t] of Object.entries(F)) __fs.files['/Mailing/Spendeneingänge ' + y + '/e' + y + '.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; },
    Object.fromEntries([2024, 2025, 2026, 2027].map(y => [y, year(y)])));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length > 50); await p.waitForTimeout(300);

  // ---- A: eigener Reiter „Jahresvergleich“ – in der Auswertung kein Jahresvergleich mehr; Abschnitte wie in den anderen Reitern
  const a0 = await p.evaluate(() => [[...document.querySelectorAll('.top .tab')].map(t => t.textContent.replace(/\d+$/, '')).join('|'), !!document.querySelector('[data-sec="sp-jv"]')]);
  await p.click('.top .tab:has-text("Jahresvergleich")'); await p.waitForTimeout(500);
  const a1 = await p.evaluate(() => [UI.view, [...document.querySelectorAll('#main .sec')].map(e => e.dataset.sec).join(), !!document.querySelector('#main .jv > .jv-bar'), document.querySelector('.jv-grid2') ? [...document.querySelectorAll('.jv-grid2 > .sec')].map(e => e.dataset.sec).join() : '']);
  ok(a0[0] === 'Jahresplanung|Detailpläne|Auswertung|Jahresvergleich' && !a0[1], 'A: Reiter „Jahresvergleich“ neben der Auswertung, dort kein Abschnitt „Jahresvergleich“ mehr');
  ok(a1[0] === 'vergleich' && a1[1] === 'jv-kpi,jv-verlauf,jv-mail,jv-seg,jv-zweck,jv-konto,jv-dauer' && a1[2] && a1[3] === 'jv-zweck,jv-konto', 'A: oben die Leiste, darunter die Abschnitte; Zwecke und Konten nebeneinander');
  await p.click('[data-sec="jv-kpi"] .sec-tog'); await p.waitForTimeout(300);
  const a2 = await p.evaluate(() => document.querySelector('[data-sec="jv-kpi"] .sec-sum')?.textContent);
  ok(a2 === '2027 bis 10.10.: 530 € · 3 Spender:innen · 14 Spenden', 'A: „Kennzahlen“ eingeklappt mit Zusammenfassung „' + a2 + '“');
  await p.click('[data-sec="jv-kpi"] .sec-tog'); await p.waitForTimeout(300);

  // ---- B: Leiste – Jahre, Hauptjahr, Zeitraum (Stichtag = letzte Buchung im Hauptjahr), Sondereffekte je Jahr
  const b0 = await p.evaluate(() => [[...document.querySelectorAll('.jv-y')].map(c => c.textContent + (c.classList.contains('off') ? '-' : '+')).join(','), document.querySelector('.jv-zeit').value, document.querySelector('.jv-zeit').selectedOptions[0].textContent,
    [...document.querySelectorAll('.jv-sx b')].map(e => e.textContent).join()]);
  ok(b0[0] === '2024+,2025+,2026+,2027+' && b0[1] === 'stich' && b0[2] === 'bis Stichtag 10.10. (letzte Buchung 2027)' && b0[3] === '2027,2026,2025,2024', 'B: Jahre 2024–2027, Zeitraum „' + b0[2] + '“, Sondereffekte je Jahr');
  // ---- C: Kennzahlen – große Zahl = Hauptjahr, je Jahr: Zahl, Veränderung (Pfeil + %), Säule, Jahr
  const kp = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-sec="jv-kpi"] .jv-kpi')].map(k => [k.querySelector('.jv-kt').textContent, [k.querySelector('.jv-kv').textContent,
    [...k.querySelectorAll('.jv-lv')].map(t => t.textContent).join('|'), [...k.querySelectorAll('.jv-ld')].map(t => t.textContent).join('|'), [...k.querySelectorAll('.jv-ly')].map(t => t.textContent).join('|'), k.querySelectorAll('rect').length]])));
  const c0 = await kp();
  ok(c0['Spendensumme'][0] === '530 €' && c0['Spendensumme'][1] === '530 €|530 €|25.530 €|530 €' && c0['Spendensumme'][3] === '2024|2025|2026|2027*' && c0['Spendensumme'][4] === 4,
    'C: Spendensumme 530 € (2027 bis 10.10.) – je Jahr bis zum Stichtag: ' + c0['Spendensumme'][1]);
  ok(c0['Spendensumme'][2] === '■ ±0,0 %|▲ +4.717,0 %|▼ −97,9 %', 'C: Veränderung zum Vorjahr über jeder Säule (erstes Jahr ohne): ' + c0['Spendensumme'][2]);
  ok(c0['Spender:innen'][0] === '3' && c0['Neue Spender:innen'][1] === '–|0|1|0' && c0['Dauerspender:innen'][0] === '1' && !/%/.test(c0['Spendensumme'][0]),
    'C: Spender:innen nach IBAN (3), neue Spender:innen im ersten Jahr nicht bestimmbar (–), Dauerspender:innen 1 – keine Prozentangabe neben der großen Zahl');
  // Sondereffekte 2026: über 10.000 € ausblenden
  await p.fill('.jv-gr[data-fk="jv-gr:2026"]', '10.000'); await p.press('.jv-gr[data-fk="jv-gr:2026"]', 'Enter'); await p.waitForTimeout(400);
  const c1 = await kp();
  ok(c1['Spendensumme'][1] === '530 €|530 €|530 €|530 €' && await p.evaluate(() => D.spenden.grenze['2026'] === 1000000 && /1 · 25\.000 €/.test(document.querySelector('.jv-sx .jv-aus')?.textContent || '')), 'C: Sondereffekt 2026 (Erbschaft 25.000 €) ausgeblendet – 2026 wieder 530 €, Hinweis „1 · 25.000 €“');
  // Zeitraum ganzes Jahr; Jahr abwählen
  await p.selectOption('.jv-zeit', 'jahr'); await p.waitForTimeout(300);
  const c2 = await kp();
  ok(c2['Spendensumme'][1] === '770 €|770 €|770 €|530 €' && c2['Spendensumme'][3] === '2024|2025|2026|2027', 'C: „ganzes Jahr“ – frühere Jahre vollständig (' + c2['Spendensumme'][1] + ')');
  await p.selectOption('.jv-zeit', 'stich'); await p.waitForTimeout(200);
  await p.click('.jv-y:has-text("2024")'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JSON.stringify(UI.jvOff) === '[2024]' && document.querySelectorAll('[data-sec="jv-kpi"] .jv-kpi')[0].querySelectorAll('rect').length === 3 && UI_KEYS.includes('jvOff')), 'C: 2024 abgewählt – drei Jahre, gemerkt');
  await p.click('.jv-y:has-text("2024")'); await p.waitForTimeout(300);

  // ---- D: Jahresverlauf – Klick auf Q4 öffnet den Quartalsvergleich, „× schließen“ schließt ihn
  await p.evaluate(() => document.querySelector('[data-chart="jvcum"]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  const d0 = await p.evaluate(() => { const r = document.querySelector('[data-chart="jvcum"] .sp-ov').getBoundingClientRect(); return [document.querySelectorAll('[data-chart="jvcum"] .jv-line').length, { x: r.x + r.width * 0.9, y: r.y + r.height / 2 }, !!document.querySelector('.jv-stich')]; });
  await p.mouse.move(d0[1].x, d0[1].y); await p.waitForTimeout(150);
  const tip = await p.evaluate(() => [document.getElementById('tip').textContent, document.querySelectorAll('.jv-qband.hov').length]);
  await p.mouse.click(d0[1].x, d0[1].y); await p.waitForTimeout(400);
  const d1 = await p.evaluate(() => { const qa = document.querySelector('[data-chart="jvqa"]'), band = document.querySelector('.jv-qband').getBoundingClientRect(), th = document.querySelectorAll('.jv-qnum thead th')[1].getBoundingClientRect();
    return [JV.q, document.querySelector('.jv-qp .jv-qh b')?.textContent, qa.querySelectorAll('rect.jv-bar').length, qa.querySelectorAll('rect.jv-sxbar').length, document.querySelector('.jv-qband.on') != null,
      [...document.querySelectorAll('.jv-qnum tr')].map(t => [...t.children].map(c => c.textContent).join('|')), Math.abs(band.left - th.left), !document.querySelector('.jv-qn') && !/Anteil/.test(document.querySelector('.jv-qp').textContent),
      [...document.querySelectorAll('.jv-qsxc')].map(c => c.textContent).join(' / '), document.querySelectorAll('[data-chart="jvcum"] .jv-sxm').length]; });
  ok(d0[0] === 4 && d0[2] && /Klick: Q4 vergleichen/.test(tip[0]) && /2027: /.test(tip[0]) && tip[1] === 1, 'D: vier Jahreslinien, Stichtag-Linie; Zeigen hebt das Quartal hervor, Hinweis „Klick: Q4 vergleichen“');
  ok(d1[0] === 3 && d1[1] === 'Q4 im Vergleich' && d1[2] === 17 && d1[3] === 1 && d1[4] && d1[7], 'D: Klick – „Q4 im Vergleich“: alle Quartale (16 Säulen + Sondereffekt obenauf), keine Säulen in der Mitte, kein „Anteil am Jahr“');
  ok(d1[5][0] === '|Q1|Q2|Q3|Q4 (bis 10.10.)|Summe (bis 10.10.)' && d1[5][1] === '2024|160,00 €|160,00 €|160,00 €|50,00 €|530,00 €' && d1[5][3] === '2026|160,00 €■ ±0,0 %|25.160,00 €▲ +15.625,0 %inkl. 25.000,00 € Sondereffekte|160,00 €■ ±0,0 %|50,00 €■ ±0,0 %|25.530,00 €▲ +4.717,0 %inkl. 25.000,00 € Sondereffekte',
    'D: „Quartale in Zahlen“ – laufendes Quartal „Q4 (bis 10.10.)“, rechts „Summe“, Sondereffekte eingerechnet (' + d1[5][3].slice(0, 70) + '…)');
  ok(d1[6] < 3 && /2026 25\.000,00 €/.test(d1[8]) && d1[9] === 1, 'D: Tabelle genau unter den Quartalen des Jahresverlaufs; der Sondereffekt steht unter Q2 und als Raute auf der Linie');
  const d2 = await p.evaluate(() => [document.querySelector('.jv-qcmp .jv-qch b').textContent, document.querySelector('.jv-qcmp .jv-cmp').value, [...document.querySelectorAll('.jv-qcti')].map(t => t.textContent).join(' | ')]);
  ok(d2[0] === 'Q4 (bis 10.10.) 2027' && d2[1] === '2026' && d2[2] === 'Spendensumme50,00 €2026: 50,00 €■ ±0,0 % | Spenden22026: 2■ ±0,0 % | Ø je Spende25,00 €2026: 25,00 €■ ±0,0 % | Spender:innen22026: 2■ ±0,0 %',
    'D: darunter „verglichen mit 2026“ – Summe, Spenden, Ø je Spende, Spender:innen');
  await p.click('.jv-legsx input'); await p.waitForTimeout(400);
  const d3 = await p.evaluate(() => [UI.jvQsx, [...document.querySelectorAll('.jv-qnum tbody tr')][2].textContent, document.querySelectorAll('[data-chart="jvqa"] rect.jv-sxbar').length, !!document.querySelector('.jv-qsx'), document.querySelectorAll('[data-chart="jvcum"] .jv-sxm').length]);
  ok(d3[0] === false && d3[1] === '2026160,00 €■ ±0,0 %160,00 €■ ±0,0 %160,00 €■ ±0,0 %50,00 €■ ±0,0 %530,00 €■ ±0,0 %' && d3[2] === 0 && !d3[3] && d3[4] === 0, 'D: „Sondereffekte zeigen“ aus – nicht mehr eingerechnet, keine Liste, keine Raute');
  await p.click('.jv-legsx input'); await p.waitForTimeout(300);
  await p.click('.jv-qx'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => JV.q === null && !document.querySelector('.jv-qp')), 'D: „× schließen“ blendet den Quartalsvergleich aus');

  // ---- E: Mailings vergleichen – frei wählbar, bis zu vier, Farbe bleibt am Eintrag
  await p.evaluate(() => commit(d => { const base = d.massnahmen.find(m => !m.plan);
    for (const [id, y] of [['wm25', 2025], ['wm26', 2026], ['wm24', 2024]]) { const c = JSON.parse(JSON.stringify(base)); Object.assign(c, { id, name: 'Weihnachtsmailing ' + y, pal: y + '-11-03', regel: { worte: ['Weihnachtsspende'], ab: 0, bis: 90 }, auflage: 1000, kosten: 200 }); delete c.plan; d.massnahmen.push(c); } }));
  await p.evaluate(() => { UI.jvMail = undefined; renderNow(); }); await p.waitForTimeout(400);
  const e0 = await p.evaluate(() => [[...document.querySelectorAll('.jv-msel')].map(s => s.selectedOptions[0].textContent).join(' | '), document.querySelectorAll('[data-chart="jvmail"] .jv-line').length,
    [...document.querySelectorAll('.jv-kb')].map(k => k.querySelector('.jv-st').textContent + ':' + [...k.querySelectorAll('.jv-kbr')].map(r => r.textContent).join('/')).join(' ; ')]);
  ok(/^Weihnachtsmailing 2026 · PAL 03\.11\. \| Weihnachtsmailing 2025 · PAL 03\.11\.$/.test(e0[0]) && e0[1] === 2, 'E: zuerst die zwei jüngsten Mailings mit Spenden: ' + e0[0]);
  ok(/Erlös:100,00 €\/100,00 €/.test(e0[2]) && /Response:0,2 %\/0,2 %/.test(e0[2]) && /ROI:0,5\/0,5/.test(e0[2]), 'E: Erlös, Response, ROI je Mailing (' + e0[2].slice(0, 90) + '…)');
  await p.click('.jv-madd'); await p.waitForTimeout(200);
  await p.selectOption('.jv-mrow:nth-child(3) .jv-msel', 'wm24'); await p.waitForTimeout(300);
  const e1 = await p.evaluate(() => [JSON.stringify(UI.jvMail), document.querySelectorAll('[data-chart="jvmail"] .jv-line').length]);
  ok(e1[0] === '[{"id":"wm26","c":0},{"id":"wm25","c":1},{"id":"wm24","c":2}]' && e1[1] === 3, 'E: „+ Mailing hinzufügen“ – drittes Mailing (2024) frei gewählt, eigene Farbe');
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-chart="jvmail"] .jv-elab')].map(t => t.getAttribute('style')).sort().join() === 'fill: var(--jvm1),fill: var(--jvm2),fill: var(--jvm3)'), 'E: Namen rechts neben den Linien in der Farbe des Mailings');
  await p.click('.jv-mrow:nth-child(1) .sp-x'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JSON.stringify(UI.jvMail) === '[{"id":"wm25","c":1},{"id":"wm24","c":2}]'), 'E: erstes entfernt – die anderen behalten ihre Farbe');

  // ---- F: Bausteine ein- und ausblenden
  await p.click('[data-sec="jv-mail"] .jv-hide'); await p.waitForTimeout(250);
  const f0 = await p.evaluate(() => [!document.querySelector('[data-sec="jv-mail"]'), /Ausgeblendet: Mailings vergleichen/.test(document.querySelector('.jv').textContent)]);
  await p.click('.jv-bbtn'); await p.waitForTimeout(150);
  await p.click('.menu.pop label.mchk:has-text("Mailings vergleichen") input'); await p.waitForTimeout(300);
  ok(f0[0] && f0[1] && await p.evaluate(() => !!document.querySelector('[data-sec="jv-mail"]') && !UI.jvHide.mail), 'F: „ausblenden“ nimmt einen Baustein heraus, „Bausteine“ blendet ihn wieder ein');
  await finish(b, pages);
})();
