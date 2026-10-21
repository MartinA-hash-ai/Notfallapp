// 0.40 Jahresvergleich: Zweckbindung in „Auf einen Blick“; Jahresverlauf mit Spenden pro Woche, Teile einzeln ein-/ausblendbar, Maßnahmen als Punkte; kein Ausblenden/Verschieben mehr in den Kästen
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const p2 = x => String(x).padStart(2, '0');
// alles erfunden: A spendet monatlich 100 € (zweckungebunden), B per Dauerauftrag 20 €, C für die Hospizarbeit; 2027 dazu Rikscha und eine Spende für beides (zu klären); 2027 nur bis 10.10.
const L = (d, b, nr, name, zw = 'Spende', da = false) => [d, d, String(b), "'TESTDE11XXX", 'DE0010000000000000' + nr, name, "'Zugang/Gutschrift", zw, da ? "'Dauerauftragsgutschr" : "'Spendengutschrift", "'Paderborn - Lage"].join(';');
const year = y => { const r = [];
  for (let m = 1; m <= (y === 2027 ? 10 : 12); m++) r.push(L('05.' + p2(m) + '.' + y, 100, '0001', 'Probe A'), L('05.' + p2(m) + '.' + y, 20, '0002', 'Probe B', 'Dauerauftrag Spende', true));
  r.push(L('10.03.' + y, y === 2027 ? 600 : 400, '0003', 'Probe C', 'Spende Hospizarbeit'));
  if (y === 2027) r.push(L('10.10.2027', 300, '0004', 'Probe D', 'Rikscha'), L('10.10.2027', 100, '0005', 'Probe E', 'Hospizarbeit und Rikscha'));
  return '﻿' + [HEAD, ...r].join('\r\n') + '\r\n'; };

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1400, height: 1000 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(F => { for (const [y, t] of Object.entries(F)) __fs.files['/Mailing/Spendeneingänge ' + y + '/e' + y + '.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; },
    Object.fromEntries([2026, 2027].map(y => [y, year(y)])));
  await p.evaluate(() => { commit(d => { d.zwecke = []; const base = JSON.parse(JSON.stringify(d.massnahmen.find(m => !m.plan)));
    const mk = (id, name, pal, farbe) => { const c = JSON.parse(JSON.stringify(base)); Object.assign(c, { id, name, pal, farbe }); delete c.plan; delete c.regel; return c; };
    d.massnahmen = [mk('m1', 'Frühjahrsmailing', '2027-03-01', '#1F77B4'), mk('m2', 'Weihnachtsmailing', '2027-11-20', '#C62828'), mk('m0', 'Sommermailing', '2026-06-10', '#2CA02C')]; });
    UI.year = 2027; UI.view = 'vergleich'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length > 40, null, { timeout: 30000 }); await p.waitForTimeout(500);

  // ---- A: „Auf einen Blick“ – fünfte Kachel Zweckbindung
  const z0 = await p.evaluate(() => { const t = document.querySelector('[data-sec="jv-blick"] .jv-gtz'); return t && [t.dataset.k, t.querySelector('.jv-gtt').textContent, t.querySelector('.jv-gts').textContent, document.querySelectorAll('[data-sec="jv-blick"] .jv-gt').length]; });
  ok(z0 && z0[0] === 'zweck' && z0[1] === 'Zweckbindung bis 10.10.' && /Noch keine Zwecke angelegt – unter „Spenden 2027“ festlegen/.test(z0[2]) && z0[3] === 5, 'A: ohne Zwecke – Kachel „Zweckbindung“ mit Hinweis: ' + JSON.stringify(z0));
  await p.evaluate(() => { commit(d => { d.zwecke = [{ id: 'zh', name: 'Hospizarbeit', farbe: '#2e7d32', worte: ['Hospizarbeit'], konten: [], massnahmen: [] }, { id: 'zr', name: 'Rikscha', farbe: '#1565c0', worte: ['Rikscha'], konten: [], massnahmen: [] }]; }); }); await p.waitForTimeout(400);
  const z1 = await p.evaluate(() => { const t = document.querySelector('[data-sec="jv-blick"] .jv-gtz'), cs = e => getComputedStyle(e);
    return [[...t.querySelectorAll('.jv-zbn > div')].map(e => e.textContent).join(' | '), [...t.querySelectorAll('.jv-zbp')].map(e => e.className.replace('jv-zbp ', '') + ':' + e.textContent + ':' + Math.round(e.getBoundingClientRect().width)).join(' | '),
      !t.querySelector('.jv-gts'), t.querySelector('.jv-zb').getAttribute('aria-label'), cs(t.querySelector('.jv-zbp.zg')).backgroundColor !== cs(t.querySelector('.jv-zbp.zf')).backgroundColor]; });
  const w = z1[1].split(' | ').map(s => +s.split(':')[2]);
  ok(z1[0] === 'zweckgebunden1.000 € | zweckungebunden1.200 €' && /^zg:45 %:\d+ \| zf:55 %:\d+$/.test(z1[1]) && Math.abs(w[0] / (w[0] + w[1]) - 1000 / 2200) < 0.02 && z1[4],
    'A: zweckgebunden 1.000 € (Hospiz 600 + Rikscha 300 + „zu klären“ 100), zweckungebunden 1.200 € – Balken 45 % | 55 %, Breite anteilig: ' + z1.slice(0, 2).join(' / '));
  ok(z1[2] === true && z1[3] === 'zweckgebunden 45 %, zweckungebunden 55 %', 'A: unter dem Balken keine Vergleichszeile mehr');
  const z2 = await p.evaluate(() => { const f = TIPS.get(document.querySelector('.jv-gtz .jv-zbp.zg')); const v = typeof f === 'function' ? f() : f; return v && (v.textContent || v); });
  ok(z2 === 'zweckgebunden 20271.000 € · 45 %', 'A: Zeigen auf den Balken nennt Betrag und Anteil: ' + z2);

  // ---- B: Titel „Jahresverlauf“; Spenden pro Woche zwischen Linie und Quartalen; kein Ausblenden/Verschieben in den Kästen
  const b0 = await p.evaluate(() => { const s = document.querySelector('[data-sec="jv-verlauf"]'), kids = [...s.querySelectorAll('.sec-b [data-chart], .sec-b .jv-qnum')].map(e => e.dataset.chart || 'qnum');
    return [s.querySelector('.sec-t').textContent, kids.join(','), [...s.querySelectorAll('.sec-h .jv-vp label')].map(l => l.dataset.vp + (l.querySelector('input').checked ? '+' : '-')).join(' '), s.querySelector('.jv-wk .sp-cht').textContent,
      !document.querySelector('.jv .sec-h .jv-hide, .jv .sec-h .jv-drag, .jv [draggable="true"]'), JV_BLOCKS.find(x => x[0] === 'verlauf')[1]]; });
  ok(b0[0] === 'Jahresverlauf' && b0[5] === 'Jahresverlauf' && b0[1] === 'jvcum,jvwk,jvqa,qnum' && b0[3] === 'Spenden pro Woche 2027  Einzelspenden  Daueraufträge',
    'B: „Jahresverlauf“ – Linie, darunter Spenden pro Woche, dann Quartale als Säulen und in Zahlen: ' + b0[1]);
  ok(b0[2] === 'cum+ wk+ qa+ qn+ ms+' && b0[4], 'B: oben rechts je Teil ein Häkchen (Linie, Spenden pro Woche, Quartale, Quartalszahlen, Maßnahmen); kein „ausblenden“ und kein Griff in den Kästen');
  const b1 = await p.evaluate(() => { const el = document.querySelector('[data-chart="jvwk"]'), b1 = el.querySelectorAll('rect.spj-b1').length, b2 = el.querySelectorAll('rect.spj-b2').length, hits = [...el.querySelectorAll('rect.sp-hit')];
    const t = i => { const f = TIPS.get(hits[i]); const v = typeof f === 'function' ? f() : f; return v.textContent; };
    const cum = document.querySelector('[data-chart="jvcum"] svg .sp-base'), wk = el.querySelector('svg .sp-base');
    return [b1, b2, hits.length, t(9), Math.round(+cum.getAttribute('x1') - +wk.getAttribute('x1')), Math.round(+cum.getAttribute('x2') - +wk.getAttribute('x2'))]; });
  ok(b1[0] === 11 && b1[1] === 10 && b1[2] === 53 && b1[3] === '720,00 €05.03. – 11.03.Einzelspenden: 700,00 € (2)Daueraufträge: 20,00 € (1)Klick: alle Spenden dieser Woche in der Auswertung ansehen' && !b1[4] && !b1[5],
    'B: Spenden pro Woche – Einzelspenden und Daueraufträge übereinander, 53 Wochen, Zeigen nennt beides; gleiche Breite wie der Jahresverlauf: ' + JSON.stringify(b1));

  // ---- C: Maßnahmen als Punkte in ihrer Farbe – nur Hauptjahr und schon verschickt; abschaltbar
  const c0 = await p.evaluate(() => ['jvcum', 'jvwk'].map(k => [...document.querySelectorAll('[data-chart="' + k + '"] circle.spj-palm')].map(c => c.getAttribute('fill')).join()).join(' / ') + ' # ' + C.byId.get('m1').color);
  ok(c0 === '#1F77B4 / #1F77B4 # #1F77B4', 'C: Frühjahrsmailing (PAL 01.03.2027) als Punkt in seiner Farbe – in Linie und Wochen; Weihnachtsmailing (noch nicht verschickt) und 2026 nicht: ' + c0);
  const c1 = await p.evaluate(() => { const h = document.querySelector('[data-chart="jvcum"] .spj-palhit'); const f = TIPS.get(h); const v = typeof f === 'function' ? f() : f; return v.textContent; });
  ok(/^FrühjahrsmailingPAL Mo 01\.03\.2027/.test(c1), 'C: Zeigen nennt Maßnahme und PAL: ' + c1);
  await p.click('[data-sec="jv-verlauf"] [data-vp="ms"] input'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.querySelector('[data-sec="jv-verlauf"] circle.spj-palm') && UI.jvVp.ms === false && UI_KEYS.includes('jvVp')), 'C: Häkchen „Maßnahmen“ aus – keine Punkte mehr, gemerkt');
  await p.click('[data-sec="jv-verlauf"] [data-vp="ms"] input'); await p.waitForTimeout(400);

  // ---- D: Teile einzeln ausblenden; Quartalszahlen ohne Säulen stehen trotzdem unter den Quartalen
  const parts = () => p.evaluate(() => [...document.querySelectorAll('[data-sec="jv-verlauf"] .sec-b [data-chart], [data-sec="jv-verlauf"] .sec-b .jv-qnum')].map(e => e.dataset.chart || 'qnum').join(','));
  const vp = async k => { await p.click('[data-sec="jv-verlauf"] [data-vp="' + k + '"] input'); await p.waitForTimeout(350); };
  await vp('wk'); const d0 = await parts();
  await vp('qa'); const d1 = await parts(), d1a = await p.evaluate(() => { const svg = document.querySelector('[data-chart="jvcum"] svg'), q = [...svg.querySelectorAll('.jv-qband')].map(r => svg.getBoundingClientRect().left + +r.getAttribute('x')),
    th = [...document.querySelectorAll('.jv-qnum thead th')].slice(1, 5).map(t => t.getBoundingClientRect().left); return q.map((x, i) => Math.round(Math.abs(x - th[i]))); });
  await vp('cum'); await vp('qn'); const d2 = await p.evaluate(() => document.querySelector('[data-sec="jv-verlauf"] .sec-b').textContent);
  ok(d0 === 'jvcum,jvqa,qnum' && d1 === 'jvcum,jvqal,qnum' && d1a.every(v => v <= 3), 'D: ohne Wochen, dann ohne Säulen – die Quartalszahlen stehen weiter genau unter den Quartalen der Linie: ' + d0 + ' / ' + d1 + ' / ' + d1a);
  ok(d2 === 'Alle Teile ausgeblendet – oben rechts wieder einblenden.' && await p.evaluate(() => JSON.stringify(UI.jvVp)) === '{"ms":true,"wk":false,"qa":false,"cum":false,"qn":false}', 'D: alles aus – Hinweis statt leerem Kasten');

  // ---- E: PDF so wie eingestellt – passt nicht alles auf eine Seite, kommen die Quartale auf die nächste
  const pdf = () => p.evaluate(() => { window.print = () => {}; jvPrintPDF(); return new Promise(r => setTimeout(() => { const pg = [...document.querySelectorAll('#printdoc .pd-page')].filter(x => /^Jahresverlauf/.test(x.querySelector('h1').textContent));
    const out = pg.map(x => x.querySelector('h1').textContent + ':' + [...x.querySelectorAll('[data-chart], .jv-qnum')].map(e => e.dataset.chart || 'qnum').join('+') + ':' + x.querySelectorAll('circle.spj-palm').length);
    window.dispatchEvent(new Event('afterprint')); r(out.join(' | ')); }, 300)); });
  await p.evaluate(() => { UI.jvVp = {}; renderNow(); }); await p.waitForTimeout(300);
  const e0 = await pdf();
  await p.evaluate(() => { UI.jvVp = { wk: false }; renderNow(); }); await p.waitForTimeout(300);
  const e1 = await pdf();
  await p.evaluate(() => { UI.jvVp = { qa: false, qn: false, ms: false }; renderNow(); }); await p.waitForTimeout(300);
  const e2 = await pdf();
  ok(e0 === 'Jahresverlauf 2027:jvcum+jvwk:2 | Jahresverlauf 2027 – Quartale:jvqa+qnum:0', 'E: PDF – alles an: Linie und Wochen (mit Maßnahmen-Punkten), Quartale auf der nächsten Seite: ' + e0);
  ok(e1 === 'Jahresverlauf 2027:jvcum+jvqa+qnum:1' && e2 === 'Jahresverlauf 2027:jvcum+jvwk:0', 'E: PDF – ohne Wochen bzw. ohne Quartale alles auf einer Seite, ausgeblendete Teile fehlen auch im PDF: ' + e1 + ' / ' + e2);
  await p.evaluate(() => { UI.jvVp = {}; renderNow(); }); await p.waitForTimeout(300);

  // ---- F (0.41): Leiste – „bis Stichtag (10.10.)“, ohne „Spender:innen“, „entfernt“, ⓘ statt „So wird gerechnet“, „+ Buchung hinzufügen“, kein eigener PDF-Knopf
  await p.evaluate(() => { commit(d => { d.spenden.grenze = { 2027: 50000 }; }); }); await p.waitForTimeout(400);
  const f0 = await p.evaluate(() => { const bar = document.querySelector('.jv-bar');
    return [document.querySelector('.jv-zeit').selectedOptions[0].textContent, [...bar.querySelectorAll('.spj-lbl')].map(e => e.textContent).join('|'), document.querySelector('.jv-sxbtn').textContent, bar.querySelector('.jv-howto').textContent,
      !!bar.querySelector('.jv-pdf') || /PDF|So wird gerechnet/.test(bar.textContent), bar.querySelector('.jv-add.primary')?.textContent]; });
  ok(f0[0] === 'bis Stichtag (10.10.)' && f0[1] === 'Jahre|Hauptjahr|Zeitraum' && f0[2] === 'Sondereffekte 1 entfernt ▾' && f0[3] === 'ⓘ' && !f0[4] && f0[5] === '+ Buchung hinzufügen',
    'F: Leiste – Zeitraum „bis Stichtag (10.10.)“, kein Wort „Spender:innen“ vor den drei Knöpfen, „1 entfernt“, ⓘ, roter Knopf „+ Buchung hinzufügen“, kein PDF-Knopf: ' + JSON.stringify(f0));
  await p.click('.jv-bar .jv-howto'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => /So wird gerechnet/.test(document.querySelector('.modal').textContent)), 'F: ⓘ öffnet „So wird gerechnet“');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), p.click('.jv-bar .jv-add')]);
  ok(!!fc && fc.isMultiple(), 'F: „+ Buchung hinzufügen“ öffnet die Dateiauswahl (wie in der Auswertung)');
  await p.evaluate(() => { commit(d => { d.spenden.grenze = {}; }); }); await p.waitForTimeout(300);

  // ---- G (0.41): Export → PDF exportieren mit Jahresvergleich (2 × 2 Kästen); Zweckbindung im PDF in der ersten Zeile, auch bei schmalerer Seite; Größte Spender:innen mit Namen
  await p.evaluate(() => { pdfDialog(); }); await p.waitForTimeout(400);
  const g0 = await p.evaluate(() => { const a = document.querySelector('.pdf-areas'); return [[...a.querySelectorAll('.pdf-ah')].map(e => e.textContent).join('|'), getComputedStyle(a).gridTemplateColumns.split(' ').length,
    [...a.querySelectorAll('.pdf-area')].filter(e => e.classList.contains('on')).map(e => e.dataset.area).join(), document.querySelector('.pdf-area[data-area="vergleich"]').textContent, document.querySelector('.pdf-count').textContent]; });
  ok(g0[0] === 'Jahresplanung|Detailpläne|Auswertung|Jahresvergleich' && g0[1] === 2 && g0[2] === 'vergleich' && /Wie im Reiter eingestellt: \d+ Bausteine, Jahre 2026, 2027, bis Stichtag \(10\.10\.\)/.test(g0[3]) && /etwa \d+ Seiten/.test(g0[4]),
    'G: PDF-Fenster – vier Kästen (2 × 2), im Reiter Jahresvergleich ist er vorgewählt: ' + g0.slice(2).join(' / '));
  await p.evaluate(() => { window.print = () => { window.__pr = (window.__pr || 0) + 1; }; }); await p.click('.modal button.primary'); await p.waitForTimeout(900);
  await p.emulateMedia({ media: 'print' }); await p.setViewportSize({ width: 1047, height: 740 }); await p.waitForTimeout(400);
  const g1 = await p.evaluate(() => { const pgs = [...document.querySelectorAll('#printdoc .pd-page')], t = pgs.find(x => /^Größte/.test(x.querySelector('h1').textContent)), tl = [...document.querySelectorAll('#printdoc .jv-gt')].map(e => Math.round(e.getBoundingClientRect().top));
    return [window.__pr, pgs[0].querySelector('h1').textContent, document.title, new Set(tl).size, tl.length, t && [...t.querySelectorAll('th')].map(e => e.textContent).join('|'), t && /Probe C/.test(t.textContent), pgs.every(x => x.classList.contains('jv-print'))]; });
  ok(g1[0] === 1 && g1[1] === 'Auf einen Blick · Hochrechnung · Kennzahlen 2027' && /^Jahresvergleich_2027_/.test(g1[2]) && g1[7], 'G: „PDF erstellen“ druckt den Jahresvergleich (Dateiname „Jahresvergleich_…“): ' + g1.slice(1, 3).join(' / '));
  ok(g1[3] === 1 && g1[4] === 5, 'G: PDF bei schmalerer Seite (mit Rand) – alle fünf Kacheln in einer Zeile, die Zweckbindung rechts daneben');
  ok(g1[5] === '|Name|Verwendungszweck|2027|2026|Veränderung|Anteil' || g1[5] === '|Name|Verwendungszweck|Gruppe|2027|2026|Veränderung|Anteil', 'G: Größte Spender:innen im PDF mit Namen und Verwendungszweck: ' + g1[5]);
  ok(g1[6], 'G: Name „Probe C“ steht im PDF');
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.emulateMedia({ media: 'screen' }); await p.setViewportSize({ width: 1400, height: 1000 });
  await finish(b, pages);
})();
