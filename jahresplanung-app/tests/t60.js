// 0.16.5 Vorschläge für Schlagworte: wiederkehrende Begriffe (mit Tippfehler-Varianten, Wortpaaren) aus den zweckungebundenen Spenden, per Klick übernehmen
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
// erfundene Buchungen: [Tag im März, Betrag, Name, Verwendungszweck]
const R = [[2, 50, 'Anna Probe', 'Spende Rikscha'], [3, 40, 'Bernd Probe', 'Für die Rikscha'], [4, 30, 'Carla Probe', 'Riksha Spende'], [5, 20, 'Dora Probe', 'Rickscha Malteser'],
  [6, 10, 'Emil Probe', 'Rikscha'], [7, 25, 'Frida Probe', 'Wärmebus'], [8, 25, 'Gerd Probe', 'Wärmebus'], [9, 25, 'Hanna Probe', 'Wärmebus'], [10, 25, 'Ida Probe', 'Waermebus'],
  [11, 60, 'Jan Probe', 'Herzenswunsch Krankenwagen'], [12, 60, 'Karl Probe', 'Herzenswunsch Krankenwagen'], [13, 60, 'Lena Probe', 'Herzenswunsch Krankenwagen'],
  [14, 15, 'Hans Müller', 'Spende Müller'], [15, 15, 'Hans Müller', 'Spende Müller'], [16, 15, 'Hans Müller', 'Spende Müller'],
  [17, 20, 'Mia Probe', 'Hauptstr 5'], [18, 20, 'Nils Probe', 'Hauptstr 7'], [19, 20, 'Olga Probe', 'Hauptstr 9'],
  [20, 30, 'Paul Probe', 'Jubiläum'], [21, 30, 'Rita Probe', 'Jubiläum'], [22, 10, 'Sven Probe', 'Spende Danke'], [23, 10, 'Tina Probe', 'Spende Danke'], [24, 10, 'Udo Probe', 'Spende Danke']];
const line = ([t, b, name, zw], i) => { const d = String(t).padStart(2, '0') + '.03.2027'; return [d, d, String(b), "'TESTDE11XXX", 'DE0010000000000000' + String(i).padStart(4, '0'), name, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - Lage"].join(';'); };
const csv = '﻿' + [HEAD, ...R.map(line)].join('\r\n') + '\r\n';

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/export.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv);
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'allg:2027'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length === 23); await p.waitForTimeout(300);
  const sugs = () => p.evaluate(() => [...document.querySelectorAll('.spj-sug')].map(e => e.querySelector('.spj-sw-l').textContent + ' ' + e.querySelector('.spj-sug-n').textContent + (e.querySelector('.spj-sug-v')?.textContent ? ' [' + e.querySelector('.spj-sug-v').textContent + ']' : '')));

  // ---- A: Vorschläge – häufige Begriffe, Tippfehler zusammengefasst, Wortpaar; ohne Füllwörter, Namen, Adressen, Seltenes
  const a0 = await sugs();
  ok(a0.length === 3 && /^Rikscha 5 Spenden · 150 € \[auch: (rickscha, riksha|riksha, rickscha)\]$/.test(a0[0]) && /^Wärmebus 4 Spenden · 100 € \[auch: waermebus\]$/.test(a0[1]) && /^Herzenswunsch Krankenwagen 3 Spenden · 180 €$/.test(a0[2]),
    'A: Vorschläge – ' + a0.join(' | '));
  ok(await p.evaluate(() => [...document.querySelectorAll('.spj-sw-l')].every(b => !/Müller|Hauptstr|Jubiläum|^Spende|Danke/.test(b.textContent))), 'A: keine Namen der Spender:innen, Adressteile, Füllwörter oder Begriffe unter drei Spenden');
  ok(await p.evaluate(() => document.querySelectorAll('.spj-sug .spj-to').length === 3 && [...document.querySelectorAll('.spj-sug .spj-to')].every(b => /neuer Zweck/.test(b.textContent))), 'A: ohne gewählten Zweck nur „+ neuer Zweck“');

  // ---- B: Klick auf den Begriff zeigt die Spenden als Vorschau (Regel mit ~ für die Tippfehler)
  await p.click('.spj-sug[data-w="rikscha"] .spj-sw-l'); await p.waitForTimeout(250);
  const b0 = await p.evaluate(() => [document.querySelector('.spj-lh').textContent, [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].map(r => SP.byKey.get(r.dataset.k).zweck).sort().join(',')]);
  ok(/Vorschau „~Rikscha“5 Spenden zweckungebunden/.test(b0[0]) && b0[1] === 'Für die Rikscha,Rickscha Malteser,Rikscha,Riksha Spende,Spende Rikscha', 'B: Vorschau „~Rikscha“ – alle fünf Schreibweisen');
  await p.click('.spj-prevx'); await p.waitForTimeout(200);

  // ---- C: „+ neuer Zweck“ legt den Zweck mit Schlagwort an – der Vorschlag verschwindet, die Liste wird kleiner
  const h0 = await p.evaluate(() => [document.querySelector('.spj-sugs').offsetHeight, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length]);
  await p.click('.spj-sug[data-w="wärmebus"] .spj-to'); await p.waitForTimeout(300);
  const c0 = await p.evaluate(() => { const z = D.zwecke.find(z => z.name === 'Wärmebus'); return [z && z.worte.join(), SPJ.z === (z && z.id), spjCompute(2027).list.filter(e => e.z === (z && z.id)).length,
    document.querySelector('.spj-sugs').offsetHeight, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length]; });
  ok(c0[0] === '~Wärmebus' && c0[1] && c0[2] === 4, 'C: „+ neuer Zweck“ – Zweck „Wärmebus“ mit „~Wärmebus“ angelegt und gewählt, zählt 4 Spenden (auch „Waermebus“)');
  ok(!(await sugs()).some(t => /^Wärmebus/.test(t)) && c0[4] === h0[1] - 4 && c0[3] === h0[0], 'C: Vorschlag verschwindet, Liste der zweckungebundenen um 4 kleiner, Vorschlagskasten gleich hoch (' + c0[3] + ' px)');

  // ---- D: mit gewähltem Zweck: „+ zu „Wärmebus““ fügt das Schlagwort hinzu
  ok(await p.evaluate(() => [...document.querySelectorAll('.spj-sug[data-w="rikscha"] .spj-to')].map(b => b.textContent).join('|') === '+ zu „Wärmebus“|+ neuer Zweck'), 'D: mit gewähltem Zweck zusätzlich „+ zu „Wärmebus““');
  await p.click('.spj-sug[data-w="rikscha"] .spj-to'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const z = D.zwecke.find(z => z.name === 'Wärmebus'); return z.worte.join() === '~Wärmebus,~Rikscha' && spjCompute(2027).list.filter(e => e.z === z.id).length === 9; }) &&
    !(await sugs()).some(t => /^Rikscha/.test(t)), 'D: „~Rikscha“ beim Zweck – 9 Spenden, Vorschlag weg');

  // ---- E: ausblenden (für alle, in der Datei) und zurückholen; Strg+Z
  await p.click('.spj-sug[data-w="herzenswunsch krankenwagen"] .sp-x'); await p.waitForTimeout(250);
  const e0 = await p.evaluate(() => [JSON.stringify(D.spenden.ignor), document.querySelectorAll('.spj-sug').length, document.querySelector('.spj-sugign')?.textContent]);
  ok(e0[0] === '{"herzenswunsch krankenwagen":1}' && e0[1] === 0 && /1 ausgeblendet – zurückholen/.test(e0[2]), 'E: „×“ blendet den Vorschlag aus (gespeichert) – „1 ausgeblendet – zurückholen“');
  ok(await p.evaluate(() => { const n = normalize(JSON.parse(JSON.stringify(D))); const base = JSON.parse(JSON.stringify(D)), th = JSON.parse(JSON.stringify(D)); th.spenden.ignor = Object.assign({}, th.spenden.ignor, { jubiläum: 1 });
    const m = normalize(merge3(base, JSON.parse(JSON.stringify(D)), th).data); return JSON.stringify(n.spenden.ignor) === '{"herzenswunsch krankenwagen":1}' && Object.keys(m.spenden.ignor).length === 2; }), 'E: bleibt nach dem Neuladen und beim Zusammenführen erhalten');
  await p.click('.spj-sugign'); await p.waitForTimeout(250);
  ok((await sugs()).length === 1 && await p.evaluate(() => !Object.keys(D.spenden.ignor || {}).length), 'E: „zurückholen“ zeigt ihn wieder');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
  ok((await sugs()).length === 0, 'E: Strg+Z macht das Zurückholen rückgängig');

  // ---- F: einklappbar; schnell genug auch bei vielen Spenden
  await p.click('.spj-sugtog'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.querySelector('.spj-sugs') && UI.spjSug === false), 'F: Vorschläge lassen sich einklappen (bleibt gemerkt)');
  const f0 = await p.evaluate(() => {
    const voc = Array.from({ length: 3000 }, (_, i) => 'wort' + String.fromCharCode(97 + i % 26) + String.fromCharCode(97 + (i * 7) % 26) + String.fromCharCode(97 + (i * 13) % 26) + 'x'.repeat(i % 4));
    const list = Array.from({ length: 6000 }, (_, i) => ({ rec: { k: 'x' + i, b: 1000, zweck: voc[(i * 31) % 3000] + ' ' + voc[(i * 17) % 3000] + ' Spende', name: 'Name' + i }, z: '-', hand: false }));
    const t0 = performance.now(), r = spjSuggest({ list }); return [Math.round(performance.now() - t0), r.list.length];
  });
  ok(f0[0] < 1500, 'F: 6.000 Spenden mit 3.000 verschiedenen Wörtern in ' + f0[0] + ' ms ausgewertet (' + f0[1] + ' Vorschläge)');
  await finish(b, pages);
})();
