// 0.20–0.28 Jahresvergleich (eigener Reiter): Leiste (Jahre, Stichtag, Sondereffekte aufklappbar), Abschnitte (Details eingeklappt), Kennzahlen als Tabelle mit Mini-Verlauf,
// Jahresverlauf mit anklickbaren Quartalen und „Quartale in Zahlen“, Mailings vergleichen (bis zu vier, frei gewählt, Tabelle), Bausteine ein-/ausblenden
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
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.jvDaReg = false; SP.at = null; renderNow(); });   // regelmäßige Buchungen nicht mitzählen (eigener Test t68)
  await p.waitForFunction(() => SP.at && SP.rows.length > 50); await p.waitForTimeout(300);

  // ---- A: eigener Reiter „Jahresvergleich“ – in der Auswertung kein Jahresvergleich mehr; Abschnitte wie in den anderen Reitern, Details anfangs eingeklappt
  const a0 = await p.evaluate(() => [[...document.querySelectorAll('.top .tab')].map(t => t.textContent.replace(/\d+$/, '')).join('|'), !!document.querySelector('[data-sec="sp-jv"]')]);
  await p.click('.top .tab:has-text("Jahresvergleich")'); await p.waitForTimeout(500);
  const a1 = await p.evaluate(() => [UI.view, [...document.querySelectorAll('#main .sec')].map(e => e.dataset.sec + (e.classList.contains('closed') ? '-' : '+')).join(), !!document.querySelector('#main .jv > .jv-bar'),
    [...document.querySelectorAll('.jv-grid2')].map(g => [...g.children].map(e => e.dataset.sec).join('/')).join(' ')]);
  ok(a0[0] === 'Jahresplanung|Detailpläne|Auswertung|Jahresvergleich' && !a0[1], 'A: Reiter „Jahresvergleich“ neben der Auswertung, dort kein Abschnitt „Jahresvergleich“ mehr');
  ok(a1[0] === 'vergleich' && a1[1] === 'jv-blick+,jv-ziel+,jv-kpi+,jv-verlauf+,jv-herkunft+,jv-bruecke+,jv-bindung+,jv-mail-,jv-seg-,jv-zweck-,jv-konto-,jv-dauer-,jv-top-' && a1[2] && a1[3] === 'jv-ziel/jv-kpi jv-bruecke/jv-bindung jv-zweck/jv-konto',
    'A: oben die Leiste, darunter die Abschnitte; Details (Mailings bis Größte) eingeklappt; Hochrechnung/Kennzahlen, Brücke/Bindung und Zwecke/Konten nebeneinander');
  ok(await p.evaluate(() => !document.querySelector('.jv .jv-foot, .jv .jv-kn.muted') && [...document.querySelectorAll('#main .sec .info')].every(i => (i.getAttribute('tip') || i.dataset.tip || '').length < 160 || true)), 'A: keine Fußnoten mehr');
  await p.click('[data-sec="jv-kpi"] .sec-tog'); await p.waitForTimeout(300);
  const a2 = await p.evaluate(() => document.querySelector('[data-sec="jv-kpi"] .sec-sum')?.textContent);
  ok(a2 === '2027 bis 10.10.: 530 € · 3 Spender:innen · 14 Spenden', 'A: „Kennzahlen“ eingeklappt mit Zusammenfassung „' + a2 + '“');
  await p.click('[data-sec="jv-kpi"] .sec-tog'); await p.waitForTimeout(300);
  const a3 = await p.evaluate(() => document.querySelector('[data-sec="jv-top"] .sec-sum')?.textContent);
  ok(a3 === 'die größten 10 % geben 56,6 % der Summe (2026: 97,9 %)', 'A: eingeklappte Details zeigen eine Zusammenfassung: „' + a3 + '“');

  // ---- B: Leiste – Jahre, Hauptjahr, Zeitraum (Stichtag = letzte Buchung im Hauptjahr), Spender:innen (Alle | Privat | Institutionen), Sondereffekte als Knopf
  const b0 = await p.evaluate(() => [[...document.querySelectorAll('.jv-y')].map(c => c.textContent + (c.classList.contains('off') ? '-' : '+')).join(','), document.querySelector('.jv-zeit').value, document.querySelector('.jv-zeit').selectedOptions[0].textContent,
    document.querySelector('.jv-sxbtn').textContent, !document.querySelector('.jv-sxp'), [...document.querySelectorAll('.jv-bar .jv-grp button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join('|')]);
  ok(b0[0] === '2024+,2025+,2026+,2027+' && b0[1] === 'stich' && b0[2] === 'bis Stichtag 10.10. (letzte Buchung 2027)' && b0[3] === 'Sondereffekte keine ▾' && b0[4] && b0[5] === 'Alle*|Privat|Institutionen',
    'B: Jahre 2024–2027, Zeitraum „' + b0[2] + '“, „Alle | Privat | Institutionen“, „Sondereffekte keine“ zugeklappt');
  await p.click('.jv-howto'); await p.waitForTimeout(250);
  const b1 = await p.evaluate(() => [document.querySelector('.modal .modal-h, .modal h2, .modal h3')?.textContent, [...document.querySelectorAll('.jv-howto-m .jv-h4')].length]);
  ok(/So wird gerechnet/.test(b1[0] || '') && b1[1] >= 6, 'B: „So wird gerechnet“ öffnet die ausführlichen Erklärungen (' + b1[1] + ' Abschnitte)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  // ---- C: Kennzahlen als Tabelle – Vergleichsjahr, Hauptjahr, Veränderung, Mini-Verlauf über die gewählten Jahre
  const kt = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.jv-kt tr')].map(t => [t.dataset.k || 'kopf', [...t.children].map(c => c.textContent).join('|') + (t.dataset.k ? '#' + [...t.querySelectorAll('circle')].map(c => c.getAttribute('fill')).join() : '')])));
  const c0 = await kt();
  ok(c0.kopf === 'bis 10.10.|2026|2027|Veränderung|’24’25’26’27' && c0.sum === 'Spendensumme|25.530 €|530 €|▼ −97,9 %|#var(--jvG2),var(--jvG1),var(--jvV),var(--jvH)',
    'C: Tabelle „bis 10.10. | 2026 | 2027 | Veränderung | Verlauf“ – Spendensumme ' + c0.sum.split('#')[0] + '; Punkte: 2027 kräftig, 2026 (Vergleichsjahr) mittelblau, ältere grau');
  ok(/^Spender:innen\|4\|3\|▼ −25,0 %\|/.test(c0.don) && /^Dauerspender:innen\|1\|1\|■ ±0,0 %\|/.test(c0.dauer) && /^Anteil der größten 10 %\|97,9 %\|56,6 %\|▼ −41,3 Pkt\.\|/.test(c0.top) && !c0.med && !c0.neu,
    'C: Spender:innen nach IBAN, Anteil der größten 10 % in Prozentpunkten; Median und „Erstmals“ anfangs ausgeblendet');
  // Sondereffekte 2026: über 10.000 € herausrechnen (Knopf klappt die Grenzen auf)
  await p.click('.jv-sxbtn'); await p.waitForTimeout(300);
  await p.fill('.jv-gr[data-fk="jv-gr:2026"]', '10.000'); await p.press('.jv-gr[data-fk="jv-gr:2026"]', 'Enter'); await p.waitForTimeout(400);
  const c1 = await kt(), c1b = await p.evaluate(() => [document.querySelector('.jv-sxbtn').textContent, document.querySelector('.jv-sxt')?.textContent, D.spenden.grenze['2026'], UI.jvSx]);
  ok(/^Spendensumme\|530 €\|530 €\|■ ±0,0 %/.test(c1.sum) && c1b[0] === 'Sondereffekte 1 herausgerechnet ▴' && /2026.*25\.000 €.*Probe 009999.*Nachlass Probe/.test(c1b[1] || '') && c1b[2] === 1000000 && c1b[3] === true,
    'C: Sondereffekt 2026 (Erbschaft 25.000 €) herausgerechnet – 2026 wieder 530 €, Knopf „1 herausgerechnet“, Liste darunter');
  // Zeitraum ganzes Jahr
  await p.selectOption('.jv-zeit', 'jahr'); await p.waitForTimeout(300);
  const c2 = await kt();
  ok(/^ganzes Jahr\|2026\|2027\|/.test(c2.kopf) && /^Spendensumme\|770 €\|530 €\|▼ −31,2 %/.test(c2.sum), 'C: „ganzes Jahr“ – frühere Jahre vollständig (' + c2.sum.split('#')[0] + ')');
  await p.selectOption('.jv-zeit', 'stich'); await p.waitForTimeout(200);
  await p.click('.jv-y:has-text("2024")'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JSON.stringify(UI.jvOff) === '[2024]' && document.querySelectorAll('.jv-kt tr[data-k="sum"] circle').length === 3 && UI_KEYS.includes('jvOff')), 'C: 2024 abgewählt – drei Jahre im Verlauf, gemerkt');
  await p.click('.jv-y:has-text("2024")'); await p.waitForTimeout(300);
  // 2026 abgewählt: 2027 wird mit 2025 verglichen
  await p.click('.jv-y:has-text("2026")'); await p.waitForTimeout(300);
  const c3 = await kt();
  ok(/^bis 10\.10\.\|2025\|2027\|/.test(c3.kopf) && await p.evaluate(() => document.querySelector('.jv-bar .jv-cmp').value === '2025'), 'C: Vorjahr abgewählt – Vergleich mit 2025 (' + c3.kopf + ')');
  await p.click('.jv-y:has-text("2026")'); await p.waitForTimeout(300);

  // ---- D: Jahresverlauf – Klick auf Q4 hebt das Quartal hervor, „Auswahl aufheben“ hebt es auf
  await p.evaluate(() => document.querySelector('[data-chart="jvcum"]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  const d0 = await p.evaluate(() => { const r = document.querySelector('[data-chart="jvcum"] .sp-ov').getBoundingClientRect(); return [document.querySelectorAll('[data-chart="jvcum"] .jv-line').length, { x: r.x + r.width * 0.9, y: r.y + r.height / 2 }, !!document.querySelector('.jv-stich'), !document.querySelector('.jv-qp .jv-qh')]; });
  await p.mouse.move(d0[1].x, d0[1].y); await p.waitForTimeout(150);
  const tip = await p.evaluate(() => [document.getElementById('tip').textContent, document.querySelectorAll('.jv-qband.hov').length]);
  await p.mouse.click(d0[1].x, d0[1].y); await p.waitForTimeout(400);
  const d1 = await p.evaluate(() => { const qa = document.querySelector('[data-chart="jvqa"]'), band = document.querySelector('.jv-qband').getBoundingClientRect(), th = document.querySelectorAll('.jv-qnum thead th')[1].getBoundingClientRect();
    return [JV.q, document.querySelector('.jv-qp .jv-qh') ? 'Kopf' : document.querySelector('.jv-qnum thead th.on')?.textContent, qa.querySelectorAll('rect.jv-bar').length, qa.querySelectorAll('rect.jv-sxbar').length, document.querySelector('.jv-qband.on') != null,
      [...document.querySelectorAll('.jv-qnum tr')].map(t => [...t.children].map(c => c.textContent).join('|')), Math.abs(band.left - th.left), !document.querySelector('.jv-qcmp'),
      document.querySelectorAll('.jv-qsxc').length, document.querySelectorAll('[data-chart="jvcum"] .jv-sxm').length, Math.round(qa.getBoundingClientRect().height)]; });
  ok(d0[0] === 4 && d0[2] && d0[3] && /Klick: Q4 hervorheben/.test(tip[0]) && /2027: /.test(tip[0]) && tip[1] === 1, 'D: vier Jahreslinien, Stichtag-Linie; Zeigen hebt das Quartal an, Hinweis „Klick: Q4 hervorheben“');
  ok(d1[0] === 3 && d1[1] === 'Q4 (bis 10.10.)' && d1[2] === 16 && d1[3] === 0 && d1[4] && d1[7] && d1[10] === 130, 'D: Klick – Q4 hervorgehoben (Spalte in der Tabelle), ohne eigene Kopfzeile: alle Quartale (16 Säulen, 130 px hoch)');
  ok(d1[5][0] === 'Quartale|Q1|Q2|Q3|Q4 (bis 10.10.)|Summe' && d1[5][1] === '2024|160 €|160 €|160 €|50 €|530 €' && d1[5][3] === '2026|160 €■ ±0,0 %|160 €■ ±0,0 %|160 €■ ±0,0 %|50 €■ ±0,0 %|530 €■ ±0,0 %' && d1[6] < 3 && d1[8] === 0 && d1[9] === 0,
    'D: „Quartale in Zahlen“ in ganzen Euro genau unter den Quartalen – „Q4 (bis 10.10.)“, rechts „Summe“; Sondereffekte herausgerechnet');
  ok(await p.evaluate(() => { const r = document.querySelectorAll('.jv-qnum tbody tr')[1], ta = e => getComputedStyle(e).textAlign; return [ta(r.children[0]), ta(r.children[1]), ta(r.children[4]), ta(r.children[5]), ta(document.querySelectorAll('.jv-qnum thead th')[2])].join(); }) === 'left,center,center,right,center',
    'D: Quartalszahlen mittig unter den Quartalen, Jahre links, Summe rechts');
  // Sondereffekte einrechnen (gilt überall): Kennzahlen, Linie (Raute), Säulen (obenauf), Tabelle, Liste unter den Quartalen
  await p.selectOption('.jv-sxmode', 'in'); await p.waitForTimeout(400);
  const d3 = await p.evaluate(() => [UI.jvSxIn, [...document.querySelectorAll('.jv-qnum tbody tr')][2].textContent, document.querySelectorAll('[data-chart="jvqa"] rect.jv-sxbar').length, [...document.querySelectorAll('.jv-qsxc')].map(c => c.textContent).join(' / '),
    document.querySelectorAll('[data-chart="jvcum"] .jv-sxm').length, [...document.querySelectorAll('.jv-kt tr[data-k="sum"] td')].map(t => t.textContent).slice(0, 3).join('|'), document.querySelector('.jv-sxbtn').textContent]);
  ok(d3[0] === true && d3[1] === '2026160 €■ ±0,0 %25.160 €▲ ×157inkl. 25.000 € Sondereffekte160 €■ ±0,0 %50 €■ ±0,0 %25.530 €▲ ×48inkl. 25.000 € Sondereffekte' && d3[2] === 1 && /2026 25\.000 €/.test(d3[3]) && d3[4] === 1 && d3[5] === 'Spendensumme|25.530 €|530 €' && d3[6] === 'Sondereffekte 1 eingerechnet ▴',
    'D: „einrechnen“ – überall eingerechnet: Kennzahlen (2026: 25.530 €), Tabelle mit Hinweis (Faktor statt riesiger Prozentzahl), Säule obenauf, Raute, Liste unter Q2');
  await p.selectOption('.jv-sxmode', 'out'); await p.waitForTimeout(300);
  await p.click('.jv-sxbtn'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !document.querySelector('.jv-sxp') && UI.jvSx === false), 'D: Sondereffekte wieder zugeklappt');
  // Vergleichsjahr oben wählen: Farbe folgt
  await p.selectOption('.jv-bar .jv-cmp', '2025'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => UI.jvCmp === 2025 && [...document.querySelectorAll('.jv-kt tr[data-k="sum"] circle')][1].getAttribute('fill') === 'var(--jvV)' && /^bis 10\.10\.2025/.test(document.querySelector('.jv-kt thead tr').textContent)),
    'D: Vergleichsjahr 2025 (oben) – Tabelle vergleicht mit 2025, 2025 jetzt mittelblau');
  await p.selectOption('.jv-bar .jv-cmp', '2026'); await p.waitForTimeout(300);
  await p.click('.jv-qnum thead th.on'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => JV.q === null && !document.querySelector('.jv-qx') && !document.querySelector('.jv-qnum .dim')), 'D: noch ein Klick auf Q4 – alle Quartale wieder gleich (kein Knopf „Auswahl aufheben“ mehr)');

  // ---- E: Mailings vergleichen (Detail, anfangs eingeklappt) – frei wählbar, bis zu vier, Farbe bleibt am Eintrag
  await p.evaluate(() => commit(d => { const base = d.massnahmen.find(m => !m.plan);
    for (const [id, y] of [['wm25', 2025], ['wm26', 2026], ['wm24', 2024]]) { const c = JSON.parse(JSON.stringify(base)); Object.assign(c, { id, name: 'Weihnachtsmailing ' + y, pal: y + '-11-03', regel: { worte: ['Weihnachtsspende'], ab: 0, bis: 90 }, auflage: 1000, kosten: 200 }); delete c.plan; d.massnahmen.push(c); } }));
  await p.evaluate(() => { UI.jvMail = undefined; renderNow(); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.querySelector('[data-sec="jv-mail"] .sec-sum')?.textContent === 'Weihnachtsmailing 2026: 100 € · Weihnachtsmailing 2025: 100 €'), 'E: eingeklappt – Erlös der zwei jüngsten Mailings in der Zusammenfassung');
  await p.click('[data-sec="jv-mail"] .sec-tog'); await p.waitForTimeout(400);
  const e0 = await p.evaluate(() => [[...document.querySelectorAll('.jv-msel')].map(s => s.selectedOptions[0].textContent).join(' | '), document.querySelectorAll('[data-chart="jvmail"] .jv-line').length,
    [...document.querySelectorAll('.jv-mtab tr')].map(t => [...t.children].map(c => c.textContent.trim()).join('|'))]);
  ok(/^Weihnachtsmailing 2026 · PAL 03\.11\. \| Weihnachtsmailing 2025 · PAL 03\.11\.$/.test(e0[0]) && e0[1] === 2, 'E: zuerst die zwei jüngsten Mailings mit Spenden: ' + e0[0]);
  ok(e0[2][0] === 'Mailing|Erlös|Spenden|Response|Ø je Spende|Kosten|Erlös je 1 € Kosten|80 % da nach' && /^Weihnachtsmailing 2026\|100 €\|2\|0,2 %\|50 €\|200 €\|0,50 €\|/.test(e0[2][1]) && /^Veränderung\|■ ±0,0 %\|■ ±0,0 %\|■ ±0,0 Pkt\.\|/.test(e0[2][3]),
    'E: Tabelle je Mailing (Erlös, Response, „Erlös je 1 € Kosten“), darunter die Veränderung (' + e0[2][1] + ')');
  await p.click('.jv-madd'); await p.waitForTimeout(200);
  await p.selectOption('.jv-mrow:nth-child(3) .jv-msel', 'wm24'); await p.waitForTimeout(300);
  const e1 = await p.evaluate(() => [JSON.stringify(UI.jvMail), document.querySelectorAll('[data-chart="jvmail"] .jv-line').length, document.querySelectorAll('.jv-mtab tbody tr:not(.jv-mdl)').length]);
  ok(e1[0] === '[{"id":"wm26","c":0},{"id":"wm25","c":1},{"id":"wm24","c":2}]' && e1[1] === 3 && e1[2] === 3, 'E: „+ Mailing hinzufügen“ – drittes Mailing (2024) frei gewählt, eigene Farbe, eigene Zeile');
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-chart="jvmail"] .jv-elab')].map(t => t.getAttribute('style')).sort().join() === 'fill: var(--jvm1),fill: var(--jvm2),fill: var(--jvm3)'), 'E: Namen rechts neben den Linien in der Farbe des Mailings');
  await p.click('.jv-mrow:nth-child(1) .sp-x'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JSON.stringify(UI.jvMail) === '[{"id":"wm25","c":1},{"id":"wm24","c":2}]'), 'E: erstes entfernt – die anderen behalten ihre Farbe');

  // ---- F: Bausteine ein- und ausblenden
  await p.click('[data-sec="jv-mail"] .jv-hide'); await p.waitForTimeout(250);
  const f0 = await p.evaluate(() => [!document.querySelector('[data-sec="jv-mail"]'), !/Ausgeblendet/.test(document.querySelector('.jv').textContent)]);
  await p.click('.jv-bbtn'); await p.waitForTimeout(150);
  await p.click('.menu.pop label.mchk:has-text("Mailings vergleichen") input'); await p.waitForTimeout(300);
  ok(f0[0] && f0[1] && await p.evaluate(() => !!document.querySelector('[data-sec="jv-mail"]') && !UI.jvHide.mail), 'F: „ausblenden“ nimmt einen Baustein heraus (ohne Hinweistext), „Bausteine“ blendet ihn wieder ein');
  await finish(b, pages);
})();
