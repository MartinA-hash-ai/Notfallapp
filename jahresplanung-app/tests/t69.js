// 0.27/0.28 Jahresvergleich: Median je Spende, Anteil der größten 10 %, „Größte Spender:innen“, Hochrechnung bis Jahresende (mit Spanne, auch in „Auf einen Blick“), Jahresziel je Jahr und Auswahl
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const p2 = x => String(x).padStart(2, '0');
// alles erfunden: A spendet jeden Monat 100 €, B einmal im Jahr groß, zu Weihnachten vier weitere; 2027 nur bis 10.10.
const L = (d, b, nr, name, zw = 'Spende') => [d, d, String(b), "'TESTDE11XXX", 'DE0010000000000000' + nr, name, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - Lage"].join(';');
const year = y => { const r = [];
  for (let m = 1; m <= (y === 2027 ? 10 : 12); m++) r.push(L('05.' + p2(m) + '.' + y, 100, '0001', 'Probe A'));
  r.push(L('01.03.' + y, y === 2025 ? 500 : 1000, '0002', 'Probe B'));
  if (y < 2027) for (let i = 1; i <= 4; i++) r.push(L('15.12.' + y, 200, '001' + i, 'Probe W' + i, 'Weihnachtsspende'));
  if (y === 2027) r.push(L('10.10.2027', 300, '0003', 'Probe C'));
  return '﻿' + [HEAD, ...r].join('\r\n') + '\r\n'; };

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1400, height: 1000 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(F => { for (const [y, t] of Object.entries(F)) __fs.files['/Mailing/Spendeneingänge ' + y + '/e' + y + '.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; },
    Object.fromEntries([2025, 2026, 2027].map(y => [y, year(y)])));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'vergleich'; SP.at = null; renderNow(); });
  await p.evaluate(() => { UI.jvKHide = { med: false }; UI.secOpen['jv-top'] = true; renderNow(); }); await p.waitForTimeout(300);

  // ---- A: Kennzahlen – Median je Spende, Anteil der größten 10 %
  const row = k => p.evaluate(k => { const t = document.querySelector('.jv-kt tr[data-k="' + k + '"]'); return t ? [...t.children].slice(0, 4).map(c => c.textContent).join('|') + '#' + t.querySelectorAll('circle').length : null; }, k);
  const a0 = await row('med'), a1 = await row('avg'), a2 = await row('top');
  ok(a0 === null && /^Ø je Spende\|\S+ €\|191,67 €\|/.test(a1) && await p.evaluate(() => !JV_KPIS.some(k => k[0] === 'med')), 'A: kein „Median je Spende“ mehr; Ø je Spende 191,67 €');
  ok(a2 === 'Anteil der größten 10 %|50,0 %|43,5 %|▼ −6,5 Pkt.#3', 'A: „Anteil der größten 10 %“ 43,5 % – ggü. 2026 in Prozentpunkten: ' + a2);

  // ---- B: Hochrechnung bis 31.12. – Stand × (Jahressumme ÷ Summe bis Stichtag) im Vergleichsjahr, Spanne über alle vollständigen Jahre
  const tile = (sec, t) => p.evaluate(([sec, t]) => { const k = [...document.querySelectorAll('[data-sec="jv-' + sec + '"] .jv-kpi')].find(k => k.querySelector('.jv-kt').textContent === t);
    return k ? [k.querySelector('.jv-kv').firstChild.textContent, [...k.querySelectorAll('.jv-lv')].map(e => e.textContent).join('|'), [...k.querySelectorAll('.jv-ld')].map(e => e.textContent).join('|'), (k.querySelector('.jv-kvs') || {}).textContent || ''] : null; }, [sec, t]);
  const b0 = await p.evaluate(() => { const S = jvSetup(), P = jvProj(S, jvData(S)); return P && [P.ist, P.main, P.base.y, Math.round(P.lo), Math.round(P.hi), P.ref.map(r => r.y).join()].join(','); });
  ok(b0 === '230000,345000,2026,345000,383333,2025,2026', 'B: Stand 2.300 € × 3.000/2.000 (2026) = 3.450 €; mit 2025: 3.833 € (' + b0 + ')');
  const b1 = await tile('ziel', 'Jahressumme – 2027 hochgerechnet'), b2 = await tile('ziel', 'Bis 10.10. erreicht');
  ok(b1 && b1[0] === '≈ 3.450 €' && b1[1] === '2.500 €|3.000 €|≈ 3.450 €' && b1[3] === '' && await p.evaluate(() => document.querySelectorAll('[data-sec="jv-ziel"] rect.jv-est').length === 1),
    'B: Kachel „Jahressumme – 2027 hochgerechnet“: ganze Jahre, 2027 gestrichelt mit ≈; keine Formel unter der Zahl');
  const b1t = await p.evaluate(() => TIPS.get(document.querySelector('[data-sec="jv-ziel"] .jv-kh')));
  ok(b1t === '2027 hochgerechnet – prozentual: Stand 10.10. 2.300 € × 1,50 ≈ 3.450 €. Der Faktor kommt aus 2026: Jahressumme 3.000 € ÷ 2.000 € bis 10.10. · Spanne 3.450 € – 3.833 € (je nach Vergleichsjahr)', 'B: Zeigen erklärt die Rechnung: ' + b1t);
  ok(!b2 && await p.evaluate(() => !document.querySelector('.jv-zbox') && TIPS.get(document.querySelector('[data-sec="jv-ziel"] .sec-h .info')) === 'Prozentual: Stand × (Jahressumme ÷ Summe bis zum gleichen Tag) im Vergleichsjahr.'),
    'B: keine Kästen „Bis … erreicht“ und „Jahresziel“ mehr; ⓘ nennt die Rechnung');
  ok(await p.evaluate(() => { const g = document.querySelector('.jv-grid2.r12'), a = g && g.children[0].getBoundingClientRect(), b = g && g.children[1].getBoundingClientRect();
    return g && g.children[0].dataset.sec === 'jv-ziel' && g.children[1].dataset.sec === 'jv-kpi' && Math.abs(b.width / a.width - 2) < 0.1; }), 'B: „Hochrechnung“ (ein Drittel) und „Kennzahlen“ (zwei Drittel) nebeneinander');
  ok(await p.evaluate(() => !!document.querySelector('[data-chart="jvcum"] polyline.jv-proj') && [...document.querySelectorAll('[data-chart="jvcum"] .jv-plab')].map(t => t.textContent).join() === '≈ 3.450 €'),
    'B: im Jahresverlauf gestrichelt bis 31.12., am Ende „≈ 3.450 €“');
  const bl = () => p.evaluate(() => [!document.querySelector('.jv-say'), [...document.querySelectorAll('.jv-gt:not(.jv-gtz)')].map(t => t.dataset.k + ':' + t.querySelector('.jv-gtv').textContent + ' / ' + t.querySelector('.jv-gts').textContent).join(' ## ')]);
  const b3 = await bl();
  ok(b3[0] === true && b3[1].startsWith('sum:2.300 € / ▲ +15,0 % 2026: 2.000 € ## proj:≈ 3.450 € / noch kein Jahresziel ## don:3 / '),
    'B: „Auf einen Blick“ – vier Zahlen (kein Satz mehr), die Hochrechnung als zweite');

  // ---- C: Jahresziel – unter der Kachel eintragen (kleines Fenster), gilt je Auswahl
  const zr = () => p.evaluate(() => document.querySelector('[data-sec="jv-ziel"] .jv-zrow2')?.textContent);
  ok(await zr() === '+ Jahresziel eintragen', 'C: ohne Ziel – „+ Jahresziel eintragen“ unter der Kachel');
  await p.click('.jv-zedit'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('.menu.pop .jv-zpop .menu-head').textContent === 'Jahresziel 2027' && document.activeElement === document.querySelector('.menu.pop .jv-ziel')), 'C: kleines Fenster „Jahresziel 2027“, Eingabe hat den Fokus');
  await p.fill('.jv-ziel', '4.000'); await p.press('.jv-ziel', 'Enter'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => JSON.stringify(D.spenden.ziel)) === '{"2027":400000}' && await zr() === 'Jahresziel 4.000 €ändern' && await p.evaluate(() => !document.querySelector('.menu.pop .jv-zpop')),
    'C: Ziel 4.000 € – unter der Kachel „Jahresziel 4.000 €“ mit „ändern“ (ohne Prozent)');
  ok(await p.evaluate(() => !!document.querySelector('[data-chart="jvcum"] line.jv-zline') && document.querySelector('[data-chart="jvcum"] .jv-zlab').textContent === 'Ziel 4.000 €'), 'C: Ziel als waagerechte Linie im Jahresverlauf');
  const c1b = await bl();
  ok(/proj:≈ 3\.450 € \/ 86 % vom Ziel 4\.000 €/.test(c1b[1]), 'C: „Auf einen Blick“ nennt den Anteil am Ziel');
  await p.click('.jv-bar .jv-grp button[data-g="privat"]'); await p.waitForTimeout(300);
  const c2 = await zr();
  await p.click('.jv-zedit'); await p.waitForTimeout(200);
  ok(c2 === '+ Jahresziel eintragen' && await p.evaluate(() => document.querySelector('.menu.pop .jv-zpop .menu-head').textContent === 'Jahresziel 2027 · nur Privat' && !document.querySelector('[data-chart="jvcum"] line.jv-zline')), 'C: „nur Privat“ hat ein eigenes Ziel (noch leer)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.click('.jv-bar .jv-grp button[data-g="alle"]'); await p.waitForTimeout(300);
  await p.click('.jv-zedit'); await p.waitForTimeout(200);
  await p.fill('.jv-ziel', 'abc'); await p.click('.jv-zok'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => JSON.stringify(D.spenden.ziel) === '{"2027":400000}' && !!document.querySelector('.menu.pop .jv-zpop')), 'C: Unsinn wird nicht übernommen, das Fenster bleibt offen');
  await p.click('.jv-zdel'); await p.waitForTimeout(300);
  const c4 = await zr();
  await p.click('.jv-zedit'); await p.waitForTimeout(200); await p.fill('.jv-ziel', '4.000'); await p.click('.jv-zok'); await p.waitForTimeout(300);
  ok(c4 === '+ Jahresziel eintragen' && await p.evaluate(() => JSON.stringify(D.spenden.ziel)) === '{"2027":400000}', 'C: „entfernen“ löscht das Ziel, „Übernehmen“ trägt es wieder ein');
  const c3 = await p.evaluate(() => { const a = clone(D), b = clone(D); delete a.spenden.ziel; b.spenden.ziel = { 2027: 400000, '2027p': 250000 }; return describeChanges(a, b).filter(t => /^Jahresziel/.test(t)).join('|'); });
  ok(c3 === 'Jahresziel 2027: 4.000 €|Jahresziel 2027 (nur Privat): 2.500 €', 'C: Änderungen am Ziel beim Zusammenführen beschrieben: ' + c3);

  // ---- D: Größte Spender:innen – Balken „größte 10 % / übrige“, kurzer Satz zum Vergleichsjahr, Tabelle
  const d0 = await p.evaluate(() => [[...document.querySelectorAll('.jv-conc > div')].map(d => d.textContent + ' @' + d.style.width).join(' | '), document.querySelector('.jv-topsum').textContent,
    [...document.querySelectorAll('.jv-top tr')].map(t => [...t.children].map(c => c.textContent).join(';')).join(' / ')]);
  ok(d0[0] === 'größte 10 % · 1 Spender:in · 43,5 % @43.5% | übrige 2 · 56,5 % @' && d0[1] === '2026: die größten 10 % gaben 50,0 %.', 'D: Balken „größte 10 % · 1 Spender:in · 43,5 %“, darunter „' + d0[1] + '“');
  ok(d0[2] === ';Name;Verwendungszweck;Gruppe;2027;2026;Veränderung;Anteil / 1.;Probe A;Spende;privat;1.000 €;1.000 €;■ ±0,0 %;43,5 % / 2.;Probe B;Spende;privat;1.000 €;1.000 €;■ ±0,0 %;43,5 % / 3.;Probe C;Spende;privat;300 €;–;neu;13,0 %',
    'D: Tabelle mit Rang, Name, Verwendungszweck, Gruppe, Summe, Vergleichsjahr, Veränderung, Anteil – ohne „kumuliert“');

  // ---- E: Reihenfolge – neue Bausteine hinter ihrem Vorgänger; eigene Reihenfolge aus 0.28 bekommt die Kennzahlen einmalig neben die Hochrechnung; PDF
  const e0 = await p.evaluate(() => { UI.jvOrder = ['verlauf', 'kpi', 'mail', 'seg', 'zweck', 'konto', 'dauer', 'bruecke', 'bindung']; return jvOrder().join(); });
  ok(e0 === 'blick,ziel,verlauf,herkunft,kpi,mail,seg,zweck,konto,top,dauer,bruecke,bindung', 'E: alte eigene Reihenfolge – neue Bausteine hinter ihrem Vorgänger: ' + e0);
  const e0b = await p.evaluate(() => { UI.jvOrdV = undefined; UI.jvOrder = ['blick', 'ziel', 'verlauf', 'herkunft', 'bruecke', 'bindung', 'kpi', 'top', 'mail', 'seg', 'zweck', 'konto', 'dauer'];
    const a = jvOrder().join(); UI.jvOrder = ['blick', 'ziel', 'verlauf', 'kpi', 'herkunft', 'bruecke', 'bindung', 'mail', 'seg', 'zweck', 'konto', 'dauer', 'top']; return [a, jvOrder().join(), UI.jvOrdV, UI_KEYS.includes('jvOrdV')]; });
  ok(e0b[0] === 'blick,ziel,kpi,verlauf,herkunft,bruecke,seg,bindung,dauer,top,mail,zweck,konto' && e0b[1] === 'blick,ziel,verlauf,kpi,herkunft,bruecke,bindung,mail,seg,zweck,konto,dauer,top' && e0b[2] === 31 && e0b[3],
    'E: eigene Reihenfolge aus 0.28 – einmalig Kennzahlen neben die Hochrechnung, Segmente neben die Brücke, Dauerspender:innen neben die Bindung; danach bleibt eine neue eigene Reihenfolge, wie sie ist');
  const e0c = await p.evaluate(() => { UI.jvOrdV = 29; UI.jvOrder = ['blick', 'ziel', 'verlauf', 'kpi', 'herkunft', 'bruecke', 'bindung', 'mail', 'seg', 'zweck', 'konto', 'dauer', 'top']; return jvOrder().join(); });
  ok(e0c === 'blick,ziel,verlauf,kpi,herkunft,bruecke,seg,bindung,dauer,mail,zweck,konto,top', 'E: eigene Reihenfolge aus 0.29/0.30 – nur Segmente und Dauerspender:innen rücken, die Kennzahlen bleiben, wo sie sind');
  await p.evaluate(() => { UI.jvOrder = undefined; renderNow(); }); await p.waitForTimeout(300);
  const e1 = await p.evaluate(() => { window.print = () => {}; jvPrintPDF(); return new Promise(r => setTimeout(() => {
    const pg = t => [...document.querySelectorAll('#printdoc .pd-page')].find(x => x.querySelector('h1').textContent === t);
    const z = pg('Auf einen Blick · Hochrechnung · Kennzahlen 2027'), t = pg('Größte Spender:innen 2027'), bk = z && z.querySelector('[data-jvk="blick"]');
    r([!!z, z && !z.querySelector('input, .jv-zedit'), z && z.querySelector('.jv-zrow2')?.textContent, z && !!z.querySelector('.jv-grid2.r12 .jv-kt'), !!t, t && [...t.querySelectorAll('th')].map(e => e.textContent).join('|'), t && /Probe B/.test(t.textContent), bk && bk.querySelectorAll('.jv-gt').length + ':' + bk.querySelectorAll('.jv-gtz').length]); }, 300)); });
  ok(e1[0] && e1[1] && e1[2] === 'Jahresziel 4.000 €' && e1[3] && e1[4] && e1[5] === '|Name|Verwendungszweck|Gruppe|2027|2026|Veränderung|Anteil' && e1[6] && e1[7] === '5:1',
    'E: PDF – „Auf einen Blick“ (vier Zahlen und Zweckbindung), Hochrechnung und Kennzahlen auf einer Seite (Ziel als Zeile, ohne Knopf), „Größte Spender:innen“ mit Namen');
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(150);

  // ---- F: vollständiges Hauptjahr – keine Hochrechnung; Daten überstehen Laden und Zusammenführen
  await p.evaluate(() => { UI.year = 2026; renderNow(); }); await p.waitForTimeout(400);
  const f0 = await p.evaluate(() => [jvProj(jvSetup(), jvData(jvSetup())), [...document.querySelectorAll('[data-sec="jv-ziel"] .jv-kpi .jv-kt')].map(e => e.textContent).join('|'), document.querySelector('[data-sec="jv-ziel"] .jv-zrow2')?.textContent,
    !!document.querySelector('[data-chart="jvcum"] polyline.jv-proj'), [...document.querySelectorAll('.jv-gt')].map(t => t.dataset.k).join()]);
  ok(f0[0] === null && f0[1] === 'Jahressumme' && f0[2] === '+ Jahresziel eintragen' && !f0[3] && f0[4] === 'sum,ziel,don,avg,zweck', 'F: 2026 vollständig – keine Hochrechnung, nur die Jahressumme; oben statt der Hochrechnung das Jahresziel');
  const f1 = await p.evaluate(() => { const base = clone(D), mine = clone(D), theirs = clone(D);
    mine.spenden.ziel = { 2027: 400000, 2026: 300000 }; theirs.spenden.ziel = { 2027: 400000, '2027p': 250000 };
    const m = merge3(base, mine, theirs).data, n = normalize(clone(m)), bad = normalize(Object.assign(clone(D), { spenden: { ziel: { x: 5, '2027q': 5, 2028: -1, 2029: 'a', 2030: 99.6 } } }));
    return [JSON.stringify(Object.entries(n.spenden.ziel).sort()), JSON.stringify(bad.spenden.ziel)]; });
  ok(f1[0] === '[["2026",300000],["2027",400000],["2027p",250000]]' && f1[1] === '{"2030":100}', 'F: Ziele werden zusammengeführt; Unsinn fällt beim Laden heraus');
  await finish(b, pages);
})();
