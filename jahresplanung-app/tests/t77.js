// 0.48: „Vergleichen“ oben rechts im Kasten der Maßnahme (Auswahl in der ersten Grafik, siehe t47 F); Maßnahmen-Regeln einklappbar (anfangs zu);
// gelbe Treffer bei allen zugeordneten Spenden (auch älteren ohne gespeicherte Regel); Reiter „Zugeordnet“ ohne Zahl, keine Anzahl/Summe daneben
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const p2 = x => String(x).padStart(2, '0');
const L = (d, b, who, zw) => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000' + who, 'Probe ' + who, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - Lage"].join(';');
const csv = r => '﻿' + [HEAD, ...r].join('\r\n') + '\r\n';
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500, ui: {} }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  const rows = []; for (let i = 0; i < 6; i++) rows.push(L(p2(12 + i) + '.03.2027', 30 + i, '00000' + i, 'Sommermailing Spende ' + i));
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/e.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv(rows));
  await p.evaluate(() => commit(d => { const c = JSON.parse(JSON.stringify(d.massnahmen[0])); Object.assign(c, { id: 'sm', name: 'Sommermailing X', pal: '2027-03-10', regel: { worte: ['Sommermailing'], ab: 0, bis: 200 } }); delete c.plan; d.massnahmen.push(c); }));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'sm'; SP.at = null; renderNow(); spScan({ manual: true }); }); await p.waitForFunction(() => SP.rows.length === 6); await p.waitForTimeout(300);
  // ---- A: Regeln der Maßnahme anfangs zu, Knopf im Kopf
  const a0 = await p.evaluate(() => [!!document.querySelector('.spm .spj-rules'), document.querySelector('.spm .spj-tog')?.textContent, Object.values(D.spenden.zu).filter(z => z.m === 'sm').length]);
  ok(!a0[0] && a0[1] === 'Regeln (1) ▾' && a0[2] === 6, 'A: Regeln der Maßnahme anfangs zu, im Kopf „Regeln (1)“ – die Regel ordnet trotzdem zu ' + JSON.stringify(a0));
  await p.click('.spm .spj-tog'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !!document.querySelector('.spm .spj-rules .sp-wordin') && UI.spmRulesOpen === true && UI_KEYS.includes('spmRulesOpen') && /▴/.test(document.querySelector('.spm .spj-tog').textContent)), 'A: Klick öffnet die Regeln (mit Schlagwort-Feld), wird gemerkt');
  await p.click('.spm .spj-tog'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('.spm .spj-rules')), 'A: nochmal Klick – wieder zu');
  // ---- B: Liste „Zugeordnet“ – ohne Zahl, ohne „N Spenden · Summe“; alle Treffer gelb, auch ohne gespeicherte Regel
  const b0 = await p.evaluate(() => [[...document.querySelectorAll('.spm-lists .spj-lv .seg-btn')].map(e => e.textContent).join('|'), document.querySelector('.spm-listbox .spj-lh').textContent, document.querySelectorAll('.spm-listbox mark.sp-hl').length]);
  ok(b0[0] === 'Zugeordnet|Offen' && !/Spenden ·|€/.test(b0[1]) && b0[2] === 6, 'B: Reiter „Zugeordnet|Offen“ ohne Zahl, keine Anzahl/Summe daneben, 6 Treffer gelb ' + JSON.stringify(b0));
  await p.evaluate(() => { for (const z of Object.values(D.spenden.zu)) if (z.m === 'sm') delete z.r; renderNow(); }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.querySelectorAll('.spm-listbox mark.sp-hl').length === 6), 'B: auch ältere Zuordnungen ohne gespeicherte Regel sind gelb markiert');
  // ---- C: „Vergleichen“ – nur da, wenn eine andere Maßnahme Spenden hat
  ok(await p.evaluate(() => !document.querySelector('.sp-cmpbtn') && !document.querySelector('.sp-cmpbox')), 'C: ohne andere Maßnahme mit Spenden kein Knopf „Vergleichen“, keine Vergleichsgrafik unten');
  await finish(b, pages);
})();
