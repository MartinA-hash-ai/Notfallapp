// 0.16.7 Spendenzwecke zuordnen: Spenden in der Liste markieren (Klick, Umschalt-Klick, „Alle auswählen“) und gesammelt verschieben
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
// erfundene Buchungen: 12 Spenden im März 2027, Betrag = 10 € × Tag
const R = Array.from({ length: 12 }, (_, i) => [i + 1, 10 * (i + 1), 'Probe ' + String.fromCharCode(65 + i), i < 3 ? 'Rikscha' : 'Spende ' + (i + 1)]);
const line = ([t, b, name, zw], i) => { const d = String(t).padStart(2, '0') + '.03.2027'; return [d, d, String(b), "'TESTDE11XXX", 'DE0010000000000000' + String(i).padStart(4, '0'), name, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - Lage"].join(';'); };
const csv = '﻿' + [HEAD, ...R.map(line)].join('\r\n') + '\r\n';

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/export.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv);
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'allg:2027'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length === 12); await p.waitForTimeout(300);
  await p.evaluate(() => commit(d => { d.zwecke.push({ id: 'zr', name: 'Rikscha', farbe: '#2e7d32', worte: ['Rikscha'], konten: [], massnahmen: [] }, { id: 'zw', name: 'Wärmebus', farbe: '#1565c0', worte: [], konten: [], massnahmen: [] }); }, 'Testzwecke'));
  await p.waitForTimeout(250);
  const rows = () => p.evaluate(() => [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].map(r => SP.byKey.get(r.dataset.k).name + (r.classList.contains('sel') ? '*' : '')));
  const bar = () => p.evaluate(() => { const s = document.querySelector('.spj-selbar'); return { all: s.querySelector('.spj-all').textContent, info: s.querySelector('.spj-selinfo').textContent, dis: s.querySelector('.spj-move').disabled, any: s.classList.contains('any') }; });
  const rowOf = name => p.evaluate(n => [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].find(r => SP.byKey.get(r.dataset.k).name === n).dataset.k, name);
  const clickRow = async (name, mod) => { const k = await rowOf(name); await p.click('.spj-row[data-k="' + k + '"] .sp-z', mod ? { modifiers: [mod] } : {}); await p.waitForTimeout(80); };

  // ---- A: Ausgangslage – Liste „Zweckungebunden“ (9 Spenden), nichts markiert, Verschieben gesperrt
  const a0 = await rows(), a1 = await bar();
  ok(a0.length === 9 && a0[0] === 'Probe L' && !a0.some(n => n.endsWith('*')), 'A: Liste zeigt die 9 zweckungebundenen Spenden, nichts markiert');
  ok(a1.all === 'Alle auswählen (9)' && /Zeilen anklicken/.test(a1.info) && a1.dis && !a1.any, 'A: Leiste: „' + a1.all + '“, Hinweis, „verschieben nach …“ gesperrt');
  ok(await p.evaluate(() => !document.querySelector('[data-sec="sp-zu"] .spj-row select')), 'A: keine Auswahlliste mehr in jeder Zeile');

  // ---- B: Klick markiert (blau), zweiter Klick markiert eine zweite, erneuter Klick hebt auf
  await clickRow('Probe L'); await clickRow('Probe L');
  const top0 = await p.evaluate(() => scrollY);
  await clickRow('Probe L'); await clickRow('Probe J');
  const b0 = await rows(), b1 = await bar(), b2 = await p.evaluate(() => { const r = document.querySelector('.spj-row.sel'), n = document.querySelector('.spj-row:not(.sel)'); return [getComputedStyle(r).backgroundColor, getComputedStyle(n).backgroundColor, r.getAttribute('aria-selected')]; });
  ok(b0.filter(n => n.endsWith('*')).join() === 'Probe L*,Probe J*', 'B: zwei Zeilen per Klick markiert (' + b0.filter(n => n.endsWith('*')).join() + ')');
  ok(b2[0] === 'rgb(227, 242, 253)' && b2[0] !== b2[1] && b2[2] === 'true', 'B: markierte Zeilen sind blau hinterlegt (' + b2[0] + ')');
  ok(b1.info === '2 Spenden markiert · 220,00 €' && !b1.dis && b1.any, 'B: Leiste zählt mit: „' + b1.info + '“, Verschieben frei');
  const top1 = await p.evaluate(() => scrollY);
  ok(top1 === top0, 'B: Seite bleibt beim Markieren stehen (' + top0 + ' → ' + top1 + ')');
  await clickRow('Probe L');
  ok((await rows()).filter(n => n.endsWith('*')).join() === 'Probe J*' && (await bar()).info === '1 Spende markiert · 100,00 €', 'B: zweiter Klick auf dieselbe Zeile hebt die Markierung auf');

  // ---- C: Umschalt-Klick markiert den Bereich dazwischen; Neuzeichnen (z. B. „Namen zeigen“) behält die Markierung
  await clickRow('Probe F', 'Shift');
  const c0 = (await rows()).filter(n => n.endsWith('*'));
  ok(c0.join() === 'Probe J*,Probe I*,Probe H*,Probe G*,Probe F*', 'C: Umschalt-Klick markiert J bis F (' + c0.length + ')');
  await p.click('.spj-lh label.check input'); await p.waitForTimeout(200);
  ok((await rows()).filter(n => n.endsWith('*')).length === 5 && (await bar()).info === '5 Spenden markiert · 400,00 €', 'C: Markierung bleibt nach dem Neuzeichnen (Namen zeigen)');

  // ---- D: markierte Spenden einem Zweck zuordnen – sie verschwinden aus der Liste; Strg+Z
  await p.selectOption('.spj-selbar .spj-move', 'zw'); await p.waitForTimeout(250);
  const d0 = await p.evaluate(() => [Object.entries(D.spenden.zweck).filter(([, v]) => v === 'zw').length, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length, document.querySelector('#toasts').textContent]);
  const d1 = await bar();
  ok(d0[0] === 5 && d0[1] === 4 && /5 Spenden dem Zweck „Wärmebus“ zugeordnet/.test(d0[2]), 'D: 5 markierte Spenden zum Zweck „Wärmebus“ verschoben, 4 bleiben in der Liste');
  ok(d1.all === 'Alle auswählen (4)' && d1.dis && !d1.any, 'D: danach ist nichts mehr markiert');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !Object.keys(D.spenden.zweck).length && document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length === 9), 'D: Strg+Z holt sie zurück');

  // ---- E: Klick auf „→ Zweck“ in einer Zeile markiert nicht; Wechsel der Liste beginnt die Markierung neu
  await p.click('.spj-pill[data-z="zr"]'); await p.waitForTimeout(200);
  await clickRow('Probe D');
  const kD = await rowOf('Probe E'); await p.click('.spj-row[data-k="' + kD + '"] .spj-to'); await p.waitForTimeout(250);
  const e0 = await p.evaluate(() => [D.spenden.zweck[[...SP.rows].find(r => r.name === 'Probe E').k], [...document.querySelectorAll('.spj-row.sel')].map(r => SP.byKey.get(r.dataset.k).name).join()]);
  ok(e0[0] === 'zr' && e0[1] === 'Probe D', 'E: „→ Rikscha“ ordnet nur diese Spende zu und ändert die Markierung nicht (' + e0[1] + ')');
  await p.click('.spj-lv [data-lv="zweck"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.querySelector('.spj-row.sel') && document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length === 4), 'E: Umschalter „Bei „Rikscha““ – andere Liste, keine Markierung übernommen');

  // ---- F: in der Liste „Bei Rikscha“: alle auswählen → „zweckungebunden“ (von Hand); dann wieder „nicht festgelegt (automatisch)“
  await p.click('.spj-selbar .spj-all'); await p.waitForTimeout(100);
  const f0 = await bar();
  ok(f0.all === 'Auswahl aufheben' && f0.info === '4 Spenden markiert · 110,00 €', 'F: „Alle auswählen“ markiert alle 4, Knopf wird zu „Auswahl aufheben“');
  await p.selectOption('.spj-selbar .spj-move', '-'); await p.waitForTimeout(250);
  const f1 = await p.evaluate(() => [Object.values(D.spenden.zweck).filter(v => v === '-').length, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length]);
  ok(f1[0] === 4 && f1[1] === 0, 'F: alle 4 von Hand auf „zweckungebunden“ – die Liste „Bei Rikscha“ ist leer');
  await p.click('.spj-lv [data-lv="frei"]'); await p.waitForTimeout(200);
  const f2 = await p.evaluate(() => [document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length, document.querySelectorAll('[data-sec="sp-zu"] .spj-row .sp-tag.hand').length, document.querySelector('[data-sec="sp-zu"] .spj-row.hand .sp-tag.hand')?.textContent]);
  ok(f2[0] === 12 && f2[1] === 0 && await p.evaluate(() => document.querySelectorAll('[data-sec="sp-zu"] .spj-row.hand').length === 4), 'F: in „Zweckungebunden“ stehen jetzt alle 12 – ohne Kennzeichen „von Hand“');
  for (const n of ['Probe A', 'Probe B']) await clickRow(n);
  await p.selectOption('.spj-selbar .spj-move', '*'); await p.waitForTimeout(250);
  const f3 = await p.evaluate(() => [Object.values(D.spenden.zweck).filter(v => v === '-').length, spjCompute(2027).list.filter(e => e.z === 'zr').length, document.querySelector('#toasts').textContent]);
  ok(f3[0] === 2 && f3[1] === 2 && /2 Spenden wieder automatisch/.test(f3[2]), 'F: „nicht festgelegt (automatisch)“ – A und B fallen wieder unter die Regel „Rikscha“');
  // Auswahl aufheben per Knopf
  await clickRow('Probe L'); await p.click('.spj-selbar .spj-selx'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => !document.querySelector('.spj-row.sel')) && (await bar()).dis, 'F: „Auswahl aufheben“ hebt die Markierung auf');
  await finish(b, pages);
})();
