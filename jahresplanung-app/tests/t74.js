// 0.44: Größte Spender:innen mit Verwendungszweck; Klick in die Grafik einer Maßnahme sucht die Spenden in „Zugeordnet“ heraus (gelb);
// Jahresvergleich: Klick auf eine Woche springt in die Auswertung und zeigt alle Spenden dieser Woche, Lupe als Mauszeiger und Hinweis
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const p2 = x => String(x).padStart(2, '0');
const L = (d, b, who, zw, da = false) => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000' + who, 'Probe ' + who, "'Zugang/Gutschrift", zw, da ? "'Dauerauftragsgutschr" : "'Spendengutschrift", "'Paderborn - Lage"].join(';');
const year = y => { const r = [];
  for (let m = 1; m <= 12; m++) { if (y === 2027 && m > 10) break;
    r.push(L('05.' + p2(m) + '.' + y, 20, '000001', 'Dauerauftrag Hospizdienst', true));
    if (m % 3 === 0) r.push(L('10.' + p2(m) + '.' + y, 100 + m, '000002', m === 6 ? 'Für die Rikscha' : 'Spende Kinderhospiz Lage'));
    if (m === 3) for (let i = 0; i < 6; i++) r.push(L(p2(15 + i) + '.03.' + y, 30 + i, '0003' + i + y, 'Sommermailing Spende ' + i));
  }
  r.push(L('10.10.' + y, 900, '000003', 'Großspende Wärmebus'));
  return '﻿' + [HEAD, ...r].join('\r\n') + '\r\n'; };

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1400 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(F => { for (const [y, t] of Object.entries(F)) __fs.files['/Mailing/Spendeneingänge ' + y + '/e' + y + '.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; },
    Object.fromEntries([2026, 2027].map(y => [y, year(y)])));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; SP.at = null; renderNow(); spScan({ manual: true }); }); await p.waitForFunction(() => SP.rows.length > 40); await p.waitForTimeout(300);

  // ---- A: Größte Spender:innen – Verwendungszweck (der mit der größten Summe), mehrere Texte: „+1“ und alle im Hinweisfenster
  await p.evaluate(() => { UI.view = 'vergleich'; UI.secOpen['jv-top'] = true; renderNow(); }); await p.waitForTimeout(400);
  const a0 = await p.evaluate(() => [[...document.querySelectorAll('.jv-top thead th')].map(e => e.textContent).join('|'),
    [...document.querySelectorAll('.jv-top tbody tr')].slice(0, 3).map(r => r.children[1].textContent + ' / ' + r.querySelector('.jv-zw').textContent)]);
  ok(/^\|Name\|Verwendungszweck\|/.test(a0[0]) && a0[1].join(' | ') === 'Probe 000003 / Großspende Wärmebus | Probe 000002 / Spende Kinderhospiz Lage+1 | Probe 000001 / Dauerauftrag Hospizdienst',
    'A: Spalte „Verwendungszweck“ neben dem Namen: ' + a0[1].join(' | '));
  await p.hover('.jv-top tbody tr:nth-child(2) .jv-zw'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const t = document.getElementById('tip'); return /2 verschiedene Verwendungszwecke/.test(t.textContent) && /212 € · Spende Kinderhospiz Lage/.test(t.textContent) && /Für die Rikscha/.test(t.textContent); }), 'A: Hinweisfenster zeigt beide Verwendungszwecke mit Betrag');
  await p.mouse.move(5, 5);

  // ---- B: Jahresverlauf → Spenden pro Woche: Lupe, Hinweis, Klick springt in die Auswertung mit allen Spenden der Woche
  await p.evaluate(() => { SPJ.z = 'irgendwas'; SPJ.typed = 'xyz'; document.querySelector('[data-chart="jvwk"]').scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(300);
  const wk = await p.evaluate(() => Math.floor((mkdn(2027, 3, 15) - mkdn(2027, 1, 1)) / 7)), hit = (await p.$$('[data-chart="jvwk"] .sp-hit'))[wk], hb = await hit.boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.waitForTimeout(300);
  const b0 = await p.evaluate(i => [getComputedStyle(document.querySelectorAll('[data-chart="jvwk"] .sp-hit')[i]).cursor, document.getElementById('tip').textContent], wk);
  ok(b0[0] === 'zoom-in' && /Klick: alle Spenden dieser Woche in der Auswertung ansehen/.test(b0[1]), 'B: Woche – Mauszeiger Lupe, Hinweis „Klick: alle Spenden dieser Woche in der Auswertung ansehen“');
  ok(await p.evaluate(() => { const H = [...document.querySelectorAll('[data-chart="jvwk"] .sp-hit')]; return H.filter(x => x.classList.contains('click')).length === new Set(spjCompute(2027).list.map(e => Math.floor((e.rec.d - mkdn(2027, 1, 1)) / 7))).size; }),
    'B: nur Wochen mit Spenden sind anklickbar');
  await p.mouse.click(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.waitForTimeout(1200);
  const b1 = await p.evaluate(() => [UI.view, UI.year, UI.spMid, SPJ.z, SPJ.typed, document.querySelector('[data-sec="sp-zu"] .spj-lh b').textContent,
    [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row.flash')].map(r => r.querySelector('.sp-d').textContent).join(','), (t => t > -5 && t < innerHeight / 2)(document.querySelector('[data-sec="sp-zu"]').getBoundingClientRect().top)]);
  ok(b1.slice(0, 6).join() === 'spenden,2027,allg:2027,,,Alle Spenden 2027' && b1[6] === '18.03.2027,17.03.2027,16.03.2027,15.03.2027' && b1[7],
    'B: Klick → Auswertung 2027, „Alle Spenden 2027“ (kein Zweck, keine Suche), die 4 Spenden der Woche leuchten, Bereich im Bild ' + JSON.stringify(b1));

  // ---- C: Maßnahme gewählt – Klick auf einen Balken bzw. in die Linie sucht die Spenden unter „Zugeordnet“ heraus
  await p.evaluate(() => commit(d => { const c = JSON.parse(JSON.stringify(d.massnahmen[0])); Object.assign(c, { id: 'sm27', name: 'Sommermailing 2027', pal: '2027-03-12', regel: { worte: ['Sommermailing'], ab: 0, bis: 90 } }); d.massnahmen.push(c); }));
  await p.evaluate(() => { UI.spMid = 'sm27'; renderNow(); SPUI.tab = 'offen'; renderNow(); }); await p.waitForTimeout(400);
  const bars = await p.$$('[data-chart="day"] .sp-hit.click');
  ok(bars.length === 6, 'C: Spenden pro Tag – die 6 Tage mit Spenden sind anklickbar (' + bars.length + ')');
  await bars[2].scrollIntoViewIfNeeded(); const cb = await bars[2].boundingBox();
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.waitForTimeout(300);
  ok(await p.evaluate(() => getComputedStyle(document.querySelectorAll('[data-chart="day"] .sp-hit.click')[2]).cursor === 'zoom-in' && /Klick: diese Spenden unten in der Liste heraussuchen/.test(document.getElementById('tip').textContent)),
    'C: Balken – Lupe und Hinweis');
  await p.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.waitForTimeout(300);
  const c0 = await p.evaluate(() => [SPUI.tab, [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row.jump')].map(r => r.querySelector('.sp-d').textContent).join(','), document.querySelector('#toasts').textContent]);
  ok(c0[0] === 'zu' && c0[1] === '17.03.2027' && /1 Spende vom 17\.03\.2027 unten unter „Spenden zuordnen“ \(Zugeordnet\) herausgesucht/.test(c0[2]), 'C: Klick → Reiter „Zugeordnet“, die Spende vom 17.03. ist markiert ' + JSON.stringify(c0.slice(0, 2)));
  await p.evaluate(() => document.querySelector('[data-sec="sp-zu"] .spj-list').scrollIntoView({ block: 'center' })); await p.waitForTimeout(500);
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row.flash')].map(r => r.querySelector('.sp-d').textContent).join(',')) === '17.03.2027', 'C: …und leuchtet gelb auf, sobald die Liste im Bild ist');
  await p.evaluate(() => { SPUI.tab = 'offen'; renderNow(); document.querySelector('[data-chart="span"]').scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(300);
  const ov = await (await p.$('[data-chart="span"] .sp-ov')).boundingBox();
  await p.mouse.click(ov.x + 2, ov.y + ov.height / 2); await p.waitForTimeout(300);
  const c1 = await p.evaluate(() => [SPUI.tab, [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row.jump')].map(r => r.querySelector('.sp-d').textContent).join(',')]);
  ok(c1[0] === 'zu' && c1[1] === '15.03.2027', 'C: Klick in die Linie am PAL (ohne Spende) → nächster Tag mit Spenden, 15.03. ' + JSON.stringify(c1));
  await finish(b, pages);
})();
