// 0.27 Jahresvergleich: Median je Spende, Anteil der größten 10 %, „Größte Spender:innen“, Hochrechnung bis Jahresende (mit Spanne), Jahresziel je Jahr und Auswahl
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
  await p.waitForFunction(() => SP.at && SP.rows.length > 40); await p.waitForTimeout(400);

  // ---- A: Kennzahlen – Median je Spende, Anteil der größten 10 %
  const tile = (sec, t) => p.evaluate(([sec, t]) => { const k = [...document.querySelectorAll('[data-sec="jv-' + sec + '"] .jv-kpi')].find(k => k.querySelector('.jv-kt').textContent === t);
    return k ? [k.querySelector('.jv-kv').firstChild.textContent, [...k.querySelectorAll('.jv-lv')].map(e => e.textContent).join('|'), [...k.querySelectorAll('.jv-ld')].map(e => e.textContent).join('|'), (k.querySelector('.jv-kvs') || {}).textContent || ''] : null; }, [sec, t]);
  const a0 = await tile('kpi', 'Median je Spende'), a1 = await tile('kpi', 'Ø je Spende'), a2 = await tile('kpi', 'Anteil der größten 10 %');
  ok(a0 && a0[0] === '100,00 €' && a1[0] === '191,67 €', 'A: „Median je Spende“ 100,00 € neben Ø je Spende 191,67 € (eine große Spende verzerrt den Durchschnitt)');
  ok(a2 && a2[0] === '43,5 %' && a2[1] === '66,7 %|50,0 %|43,5 %' && a2[2] === '▼ −16,7 Pkt.|▼ −6,5 Pkt.', 'A: „Anteil der größten 10 %“ 43,5 % – je Jahr ' + (a2 || []).slice(1, 3).join(' / '));

  // ---- B: Hochrechnung bis 31.12. – Stand × (Jahressumme ÷ Summe bis Stichtag) im Vergleichsjahr, Spanne über alle vollständigen Jahre
  const b0 = await p.evaluate(() => { const S = jvSetup(), P = jvProj(S, jvData(S)); return P && [P.ist, P.main, P.base.y, Math.round(P.lo), Math.round(P.hi), P.ref.map(r => r.y).join()].join(','); });
  ok(b0 === '230000,345000,2026,345000,383333,2025,2026', 'B: Stand 2.300 € × 3.000/2.000 (2026) = 3.450 €; mit 2025: 3.833 € (' + b0 + ')');
  const b1 = await tile('ziel', 'Jahressumme – 2027 hochgerechnet'), b2 = await tile('ziel', 'Bis 10.10. erreicht');
  ok(b1 && b1[0] === '≈ 3.450 €' && b1[1] === '2.500 €|3.000 €|≈ 3.450 €' && b1[3] === 'Spanne 3.450 € – 3.833 € (nach 2025, 2026)' && await p.evaluate(() => document.querySelectorAll('[data-sec="jv-ziel"] rect.jv-est').length === 1),
    'B: Kachel „Jahressumme – 2027 hochgerechnet“: ganze Jahre, 2027 gestrichelt mit ≈, Spanne darunter');
  ok(b2 && b2[0] === '66,7 %' && b2[1] === '60,0 %|66,7 %|–' && b2[3] === 'der Jahressumme 2026', 'B: „Bis 10.10. erreicht“ – 2025: 60 %, 2026: 66,7 % der Jahressumme');
  ok(await p.evaluate(() => !!document.querySelector('[data-chart="jvcum"] polyline.jv-proj') && [...document.querySelectorAll('[data-chart="jvcum"] .jv-plab')].map(t => t.textContent).join() === '≈ 3.450 €'),
    'B: im Jahresverlauf gestrichelt bis 31.12., am Ende „≈ 3.450 €“');

  // ---- C: Jahresziel – eintragen, Fortschritt, gilt je Auswahl
  const zb = () => p.evaluate(() => { const b = document.querySelector('.jv-zbox'); return [b.querySelector('.jv-kv').textContent, [...b.querySelectorAll('.jv-zl')].map(e => e.textContent).join(' | '), [...b.querySelectorAll('.jv-zbar span')].map(e => e.style.width).join(), b.querySelector('.jv-ztxt').textContent]; });
  const c0 = await zb();
  ok(c0[0] === '–' && c0[2] === '' && /^Noch kein Ziel eingetragen/.test(c0[3]), 'C: ohne Ziel – „–“, keine Balken, Hinweis');
  await p.fill('.jv-ziel', '4.000'); await p.press('.jv-ziel', 'Enter'); await p.waitForTimeout(400);
  const c1 = await zb();
  ok(await p.evaluate(() => JSON.stringify(D.spenden.ziel)) === '{"2027":400000}' && c1[0] === '4.000 €' && c1[1] === 'Stand 10.10.2.300 € · 57,5 % | Hochrechnung 31.12.≈ 3.450 € · 86,3 %' && c1[2] === '57.5%,86.3%',
    'C: Ziel 4.000 € – Stand 57,5 %, Hochrechnung 86,3 %, als Balken');
  ok(c1[3] === 'Bis zum Ziel fehlen noch 1.700 €. Hochrechnung 550 € unter dem Ziel. Nach dem 10.10. kamen 2026 noch 1.000 € dazu.', 'C: ' + c1[3]);
  ok(await p.evaluate(() => !!document.querySelector('[data-chart="jvcum"] line.jv-zline') && document.querySelector('[data-chart="jvcum"] .jv-zlab').textContent === 'Ziel 4.000 €'), 'C: Ziel als waagerechte Linie im Jahresverlauf');
  await p.selectOption('.jv-grp', 'privat'); await p.waitForTimeout(300);
  const c2 = await zb();
  ok(c2[0] === '–' && await p.evaluate(() => document.querySelector('.jv-zbox .jv-kt').textContent === 'Jahresziel 2027 · nur Privat' && !document.querySelector('[data-chart="jvcum"] line.jv-zline')), 'C: „nur Privat“ hat ein eigenes Ziel (noch leer)');
  await p.selectOption('.jv-grp', 'alle'); await p.waitForTimeout(300);
  const c3 = await p.evaluate(() => { const a = clone(D), b = clone(D); delete a.spenden.ziel; b.spenden.ziel = { 2027: 400000, '2027p': 250000 }; return describeChanges(a, b).filter(t => /^Jahresziel/.test(t)).join('|'); });
  ok(c3 === 'Jahresziel 2027: 4.000 €|Jahresziel 2027 (nur Privat): 2.500 €', 'C: Änderungen am Ziel beim Zusammenführen beschrieben: ' + c3);

  // ---- D: Größte Spender:innen
  const d0 = await p.evaluate(() => [document.querySelector('.jv-topsum').textContent, [...document.querySelectorAll('.jv-top tbody tr')].map(t => [...t.children].map(c => c.textContent).join(';')).join(' / ')]);
  ok(d0[0] === 'Die größten 10 % (1 Spender:in) geben 43,5 % der Spendensumme 2027 bis 10.10. (2026: 50,0 %), die 3 größten zusammen 100,0 %.', 'D: ' + d0[0]);
  ok(d0[1] === '1.;Probe A;privat;1.000,00 €;1.000,00 €;■ ±0,0 %;43,5 %;43,5 % / 2.;Probe B;privat;1.000,00 €;1.000,00 €;■ ±0,0 %;43,5 %;87,0 % / 3.;Probe C;privat;300,00 €;–;neu;13,0 %;100,0 %',
    'D: Tabelle mit Rang, Name, Gruppe, Summe, Vorjahr, Veränderung, Anteil, kumuliert');

  // ---- E: Reihenfolge – neue Bausteine hinter ihrem Vorgänger, wenn jemand schon eine eigene Reihenfolge hat; PDF
  const e0 = await p.evaluate(() => { UI.jvOrder = ['verlauf', 'kpi', 'mail', 'seg', 'zweck', 'konto', 'dauer', 'bruecke', 'bindung']; return jvOrder().join(); });
  ok(e0 === 'verlauf,kpi,ziel,mail,seg,zweck,konto,dauer,bruecke,bindung,top', 'E: alte eigene Reihenfolge – „Jahresziel“ hinter „Kennzahlen“, „Größte“ hinter „Spenderbindung“: ' + e0);
  await p.evaluate(() => { UI.jvOrder = undefined; renderNow(); }); await p.waitForTimeout(300);
  const e1 = await p.evaluate(() => { window.print = () => {}; document.querySelector('.jv-pdf').click(); return new Promise(r => setTimeout(() => {
    const pg = t => [...document.querySelectorAll('#printdoc .pd-page')].find(x => x.querySelector('h1').textContent === t);
    const z = pg('Jahresziel & Hochrechnung 2027'), t = pg('Größte Spender:innen 2027');
    r([!!z, z && !z.querySelector('input'), z && z.querySelectorAll('.jv-zbar').length, !!t, t && [...t.querySelectorAll('th')].map(e => e.textContent).join('|'), t && !/Probe/.test(t.textContent)]); }, 300)); });
  ok(e1[0] && e1[1] && e1[2] === 2 && e1[3] && e1[4] === '|Gruppe|Summe 2027|2026|Veränderung|Anteil|kumuliert' && e1[5], 'E: PDF – Jahresziel ohne Eingabefeld, „Größte Spender:innen“ ohne Namen');
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(150);

  // ---- F: vollständiges Hauptjahr – keine Hochrechnung; Daten überstehen Laden und Zusammenführen
  await p.evaluate(() => { UI.year = 2026; renderNow(); }); await p.waitForTimeout(400);
  const f0 = await p.evaluate(() => [jvProj(jvSetup(), jvData(jvSetup())), [...document.querySelectorAll('[data-sec="jv-ziel"] .jv-kt')].map(e => e.textContent).join('|'), [...document.querySelectorAll('.jv-zbox .jv-zl')].map(e => e.textContent).join(' | '), !!document.querySelector('[data-chart="jvcum"] polyline.jv-proj')]);
  ok(f0[0] === null && f0[1] === 'Jahressumme|Jahresziel 2026' && f0[2] === 'Ist 20263.000 €' && !f0[3], 'F: 2026 vollständig – keine Hochrechnung, nur Jahressumme und Ziel (' + f0[2] + ')');
  const f1 = await p.evaluate(() => { const base = clone(D), mine = clone(D), theirs = clone(D);
    mine.spenden.ziel = { 2027: 400000, 2026: 300000 }; theirs.spenden.ziel = { 2027: 400000, '2027p': 250000 };
    const m = merge3(base, mine, theirs).data, n = normalize(clone(m)), bad = normalize(Object.assign(clone(D), { spenden: { ziel: { x: 5, '2027q': 5, 2028: -1, 2029: 'a', 2030: 99.6 } } }));
    return [JSON.stringify(Object.entries(n.spenden.ziel).sort()), JSON.stringify(bad.spenden.ziel)]; });
  ok(f1[0] === '[["2026",300000],["2027",400000],["2027p",250000]]' && f1[1] === '{"2030":100}', 'F: Ziele werden zusammengeführt; Unsinn fällt beim Laden heraus');
  await finish(b, pages);
})();
