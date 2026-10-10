// 0.16.5–0.17 Vorschläge für Schlagworte: wiederkehrende Begriffe (Tippfehler „~“, Wortanfänge „*“, Kürzel, Wortpaare) aus den zweckungebundenen Spenden – als Zeile über der Liste
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
// erfundene Buchungen: [Tag im März, Betrag, Name, Verwendungszweck]
const R = [[2, 50, 'Anna Probe', 'Spende Rikscha'], [3, 40, 'Bernd Probe', 'Für die Rikscha'], [4, 30, 'Carla Probe', 'Riksha Spende'], [5, 20, 'Dora Probe', 'Rickscha Malteser'],
  [6, 10, 'Emil Probe', 'Rikscha'], [7, 25, 'Frida Probe', 'Wärmebus'], [8, 25, 'Gerd Probe', 'Wärmebus'], [9, 25, 'Hanna Probe', 'Wärmebus'], [10, 25, 'Ida Probe', 'Waermebus'],
  [11, 60, 'Jan Probe', 'Herzenswunsch Krankenwagen'], [12, 60, 'Karl Probe', 'Herzenswunsch Krankenwagen'], [13, 60, 'Lena Probe', 'Herzenswunsch Krankenwagen'],
  [14, 15, 'Hans Müller', 'Spende Müller'], [15, 15, 'Hans Müller', 'Spende Müller'], [16, 15, 'Hans Müller', 'Spende Müller'],
  [17, 20, 'Mia Probe', 'Hauptstr 5'], [18, 20, 'Nils Probe', 'Hauptstr 7'], [19, 20, 'Olga Probe', 'Hauptstr 9'],
  [20, 30, 'Paul Probe', 'Jubiläum'], [21, 30, 'Rita Probe', 'Jubiläum'], [22, 10, 'Sven Probe', 'Spende Danke'], [23, 10, 'Tina Probe', 'Spende Danke'], [24, 10, 'Udo Probe', 'Spende Danke'],
  [25, 5, 'Vera Probe', 'Geburtstag Oma']];
const line = ([t, b, name, zw], i) => { const d = String(t).padStart(2, '0') + '.03.2027'; return [d, d, String(b), "'TESTDE11XXX", 'DE0010000000000000' + String(i).padStart(4, '0'), name, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - Lage"].join(';'); };
const csv = '﻿' + [HEAD, ...R.map(line)].join('\r\n') + '\r\n';

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/export.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv);
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'allg:2027'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length === 24); await p.waitForTimeout(300);
  const sugs = () => p.evaluate(() => [...document.querySelectorAll('.spj-sug')].map(e => e.querySelector('.spj-sw-l').textContent + ' ' + e.querySelector('.spj-sug-n').textContent + (e.dataset.vars ? ' [' + e.dataset.vars + ']' : '')));
  const hideSug = async w => { await p.hover('.spj-sug[data-w="' + w + '"]'); await p.click('.spj-sug[data-w="' + w + '"] .sp-x'); await p.waitForTimeout(250); };   // „×“ erscheint beim Hinzeigen
  const move = async v => { await p.selectOption('.spj-act .spj-move', v); await p.click('.spj-act .spj-go'); await p.waitForTimeout(300); };

  // ---- A: Vorschläge – häufige Begriffe, Tippfehler zusammengefasst, Wortpaar; ohne Füllwörter, Namen, Adressen, Seltenes
  const a0 = await sugs();
  ok(a0.length === 4 && /^~Rikscha 5 \[(rickscha,riksha|riksha,rickscha)\]$/.test(a0[0]) && /^~Wärmebus 4 \[waermebus\]$/.test(a0[1]) && /^Herzenswunsch Krankenwagen 3$/.test(a0[2]) && /^Jubiläum 2$/.test(a0[3]) &&
    await p.evaluate(() => spjSuggest(spjCompute(2027)).list.map(g => eur0(g.sum)).join() === '150 €,100 €,180 €,60 €'),
    'A: Vorschläge (ab zwei Spenden) – ' + a0.join(' | '));
  ok(await p.evaluate(() => [...document.querySelectorAll('.spj-sw-l')].every(b => !/Müller|Hauptstr|^Spende|Danke|Geburtstag/.test(b.textContent))), 'A: keine Namen der Spender:innen, Adressteile, Füllwörter oder Einzelfälle');
  ok(await p.evaluate(() => document.querySelectorAll('.spj-sug .spj-to').length === 4 && [...document.querySelectorAll('.spj-sug .spj-to')].every(b => b.textContent === '+' && b.getAttribute('aria-label') === 'als neuen Zweck anlegen')), 'A: ohne gewählten Zweck legt „+“ einen neuen Zweck an');
  const a1 = await p.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(), sb = r('.spj-sugbar'), m = r('.spj-main');
    return [r('.spj-rules').bottom <= sb.top + 1, sb.bottom <= r('.spj-listbox').top + 1, Math.round(sb.height), Math.round(sb.width) === Math.round(m.width), getComputedStyle(document.querySelector('.spj-sugbar')).backgroundColor]; });
  ok(a1[0] && a1[1] && a1[2] <= 40 && a1[3] && a1[4] !== 'rgba(0, 0, 0, 0)', 'A: Vorschläge als eine graue Zeile (' + a1[2] + ' px) zwischen Regeln und Liste, über die ganze Breite');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.spj-sugmore')).visibility === 'hidden'), 'A: alle vier passen in die Zeile – kein „alle N ▾“');

  // ---- B: Klick auf den Begriff zeigt die Spenden als Vorschau (Regel mit ~ für die Tippfehler)
  await p.click('.spj-sug[data-w="rikscha"] .spj-sw-l'); await p.waitForTimeout(250);
  const b0 = await p.evaluate(() => [document.querySelector('.spj-lh').textContent, [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].map(r => SP.byKey.get(r.dataset.k).zweck).sort().join(',')]);
  ok(/Vorschau „~Rikscha“5 Spenden zweckungebunden/.test(b0[0]) && b0[1] === 'Für die Rikscha,Rickscha Malteser,Rikscha,Riksha Spende,Spende Rikscha', 'B: Vorschau „~Rikscha“ – alle fünf Schreibweisen');
  await p.click('.spj-prevx'); await p.waitForTimeout(200);

  // ---- C: „+ neuer Zweck“ legt den Zweck mit Schlagwort an – der Vorschlag verschwindet, die Liste wird kleiner
  const h0 = await p.evaluate(() => [document.querySelector('.spj-sugbar').offsetHeight, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length]);
  await p.click('.spj-sug[data-w="wärmebus"] .spj-to'); await p.waitForTimeout(300);
  const c0 = await p.evaluate(() => { const z = D.zwecke.find(z => z.name === 'Wärmebus'); return [z && z.worte.join(), SPJ.z === (z && z.id), spjCompute(2027).list.filter(e => e.z === (z && z.id)).length,
    document.querySelector('.spj-sugbar').offsetHeight, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length]; });
  ok(c0[0] === '~Wärmebus' && c0[1] && c0[2] === 4 && await p.evaluate(() => document.querySelector('.spj-zi.on .spj-zn').textContent.trim() === 'Wärmebus'), 'C: „+“ ohne Zweck – Zweck „Wärmebus“ mit „~Wärmebus“ angelegt und links gewählt, zählt 4 Spenden (auch „Waermebus“)');
  ok(!(await sugs()).some(t => /Wärmebus/.test(t)) && c0[4] === h0[1] - 4 && c0[3] === h0[0], 'C: Vorschlag verschwindet, Liste der zweckungebundenen um 4 kleiner, Vorschlagsfeld gleich hoch (' + c0[3] + ' px)');

  // ---- D: mit gewähltem Zweck: „+ zu „Wärmebus““ fügt das Schlagwort hinzu
  ok(await p.evaluate(() => document.querySelector('.spj-sug[data-w="rikscha"] .spj-to').getAttribute('aria-label') === 'zu Wärmebus hinzufügen'), 'D: mit gewähltem Zweck fügt „+“ das Schlagwort dem Zweck hinzu');
  await p.click('.spj-sug[data-w="rikscha"] .spj-to'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => { const z = D.zwecke.find(z => z.name === 'Wärmebus'); return z.worte.join() === '~Wärmebus,~Rikscha' && spjCompute(2027).list.filter(e => e.z === z.id).length === 9; }) &&
    !(await sugs()).some(t => /Rikscha/.test(t)), 'D: „~Rikscha“ beim Zweck – 9 Spenden, Vorschlag weg');

  // ---- E: ausblenden (für alle, in der Datei) und zurückholen; Strg+Z
  await hideSug('herzenswunsch krankenwagen');
  const e0 = await p.evaluate(() => [JSON.stringify(D.spenden.ignor), document.querySelectorAll('.spj-sug').length, document.querySelector('.spj-sugign')?.textContent]);
  ok(e0[0] === '{"herzenswunsch krankenwagen":1}' && e0[1] === 1 && e0[2] === 'Ausgeblendet (1)', 'E: „×“ blendet den Vorschlag aus (gespeichert) – Knopf „Ausgeblendet (1)“');
  ok(await p.evaluate(() => { const n = normalize(JSON.parse(JSON.stringify(D))); const base = JSON.parse(JSON.stringify(D)), th = JSON.parse(JSON.stringify(D)); th.spenden.ignor = Object.assign({}, th.spenden.ignor, { jubiläum: 1 });
    const m = normalize(merge3(base, JSON.parse(JSON.stringify(D)), th).data); return JSON.stringify(n.spenden.ignor) === '{"herzenswunsch krankenwagen":1}' && Object.keys(m.spenden.ignor).length === 2; }), 'E: bleibt nach dem Neuladen und beim Zusammenführen erhalten');
  await p.click('.spj-sugign'); await p.waitForTimeout(150); await p.click('.spj-ig .spj-to'); await p.waitForTimeout(250);
  ok((await sugs()).length === 2 && await p.evaluate(() => !Object.keys(D.spenden.ignor || {}).length), 'E: „Ausgeblendet (1)“ → „einblenden“ zeigt ihn wieder');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
  ok((await sugs()).length === 1, 'E: Strg+Z macht das Zurückholen rückgängig');

  // ---- F: Kürzel (JB) und gleiche Wortanfänge (Trauer, Trauerfall, Trauerspende → Trauer*); schnell genug auch bei vielen Spenden
  const more = [[1, 25, 'Wim Probe', 'JB 25-26'], [2, 25, 'Xaver Probe', 'JB 25-26'], [3, 30, 'Yvonne Probe', 'Spende JB'], [4, 50, 'Zora Probe', 'Trauer'], [5, 40, 'Albert Probe', 'Trauerfall Schmidt'],
    [6, 20, 'Berta Probe', 'Trauerspende'], [7, 10, 'Cäsar Probe', 'SPEND E HOSPIZDIENSTE DORTMUND'], [8, 10, 'Doris Probe', 'SPEND E RETTUNGSDIENST DO']];
  const csv2 = '\ufeff' + [HEAD, ...more.map(([t, b, n, z], i) => { const d = String(t).padStart(2, '0') + '.04.2027'; return [d, d, String(b), "'TESTDE11XXX", 'DE0020000000000000' + String(i).padStart(4, '0'), n, "'Zugang/Gutschrift", z, "'Spendengutschrift", "'Paderborn - Lage"].join(';'); })].join('\r\n') + '\r\n';
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/april.csv'] = { data: new TextEncoder().encode(t), lm: 82000 }; }, csv2);
  await p.evaluate(() => spScan({ manual: true })); await p.waitForFunction(() => SP.rows.length === 32); await p.waitForTimeout(300);
  const f1 = await sugs();
  ok(f1.some(t => /^JB 3$/.test(t)) && f1.some(t => /^Trauer\* 3 \[(trauerfall,trauerspende|trauerspende,trauerfall)\]$/.test(t)) && await p.evaluate(() => spjSuggest(spjCompute(2027)).list.filter(g => /^(JB|Trauer\*)$/.test(g.word)).map(g => g.word + eur0(g.sum)).sort().join() === 'JB80 €,Trauer*110 €') && !f1.some(t => /^(DO|SPEND|DORTMUND|Schmidt)\b/i.test(t)),
    'F: Kürzel „JB“ (auch in „JB 25-26“) und „Trauer*“ (Trauer, Trauerfall, Trauerspende) – ' + f1.join(' | '));
  ok(await p.evaluate(() => spjCompute(2027).list.filter(e => spjMatcher({ worte: ['Trauer*'], konten: [] })(e.rec)).length === 3 && spjCompute(2027).list.filter(e => spjMatcher({ worte: ['JB'], konten: [] })(e.rec)).length === 3),
    'F: die Regeln „Trauer*“ und „JB“ erfassen genau die gezählten Spenden');
  const f0 = await p.evaluate(() => {
    const voc = Array.from({ length: 3000 }, (_, i) => 'wort' + String.fromCharCode(97 + i % 26) + String.fromCharCode(97 + (i * 7) % 26) + String.fromCharCode(97 + (i * 13) % 26) + 'x'.repeat(i % 4));
    const list = Array.from({ length: 6000 }, (_, i) => ({ rec: { k: 'x' + i, b: 1000, zweck: voc[(i * 31) % 3000] + ' ' + voc[(i * 17) % 3000] + ' Spende', name: 'Name' + i }, z: '-', hand: false }));
    const t0 = performance.now(), r = spjSuggest({ list }); return [Math.round(performance.now() - t0), r.list.length];
  });
  ok(f0[0] < 1500, 'F: 6.000 Spenden mit 3.000 verschiedenen Wörtern in ' + f0[0] + ' ms ausgewertet (' + f0[1] + ' Vorschläge)');

  // ---- G: von Hand auf „zweckungebunden“ gesetzte Spenden (z. B. alle markiert und dorthin verschoben) blockieren Vorschläge und Regeln nicht
  await p.evaluate(() => { SPJ.z = null; SPJ.typed = ''; renderNow(); }); await p.waitForTimeout(150);
  await p.click('.spj-lh .spj-all'); await move('-');
  const g0 = await p.evaluate(() => [spjCompute(2027).list.filter(e => e.z === '-' && e.hand).length, spjCompute(2027).list.filter(e => e.z === '-').length, document.querySelector('.spj-unhand')?.textContent]);
  const g1 = await sugs();
  ok(g0[0] === g0[1] && g0[0] > 10 && g1.some(t => /^Trauer\*/.test(t)) && g1.some(t => /^JB /.test(t)) && /von Hand festgelegt – wieder automatisch/.test(g0[2]),
    'G: alle ' + g0[0] + ' zweckungebundenen von Hand festgelegt – Vorschläge bleiben (' + g1.length + '), Knopf „' + g0[2] + '“');
  await p.click('.spj-zi:has-text("Wärmebus")'); await p.waitForTimeout(200);
  const n0 = await p.evaluate(() => spjCompute(2027).list.filter(e => e.z === D.zwecke.find(z => z.name === 'Wärmebus').id).length);
  await p.click('.spj-sug[data-w="trauer"] .spj-to'); await p.waitForTimeout(300);
  const g2 = await p.evaluate(() => { const z = D.zwecke.find(z => z.name === 'Wärmebus'), tr = SP.rows.filter(r => /trauer/i.test(r.zweck)).map(r => r.k);
    return [spjCompute(2027).list.filter(e => e.z === z.id).length, tr.every(k => !(k in D.spenden.zweck)), Object.values(D.spenden.zweck).filter(v => v === '-').length]; });
  ok(g2[0] === n0 + 3 && g2[1] && g2[2] === g0[0] - 3, 'G: „+“ (Trauer*) holt die drei passenden Spenden trotz Markierung von Hand zum Zweck (' + n0 + ' → ' + g2[0] + '), die übrigen bleiben markiert');
  await p.click('.spj-unhand'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !Object.values(D.spenden.zweck).some(v => v === '-') && !document.querySelector('.spj-unhand')), 'G: „… wieder automatisch“ hebt die Markierung von Hand auf');

  // ---- H: gewählter Vorschlag bleibt beim Wechsel des Zwecks stehen; „von Hand“ nur beim Zweck, nicht in „Zweckungebunden“
  await p.evaluate(() => { if (D.zwecke.length < 2) commit(d => { d.zwecke.push({ id: 'zt', name: 'Testzweck', farbe: '#1565c0', worte: [], konten: [], massnahmen: [] }); }, 'Testzweck'); });
  const pills = await p.evaluate(() => D.zwecke.slice(0, 2).map(z => z.id));
  await p.click('.spj-zi[data-z="' + pills[0] + '"]'); await p.waitForTimeout(150);
  const w = await p.evaluate(() => document.querySelector('.spj-sug').dataset.w);
  await p.click('.spj-sug[data-w="' + w + '"] .spj-sw-l'); await p.waitForTimeout(200);
  await p.click('.spj-zi[data-z="' + pills[1] + '"]'); await p.waitForTimeout(200);
  const hh0 = await p.evaluate(w => [SPJ.z, SPJ.typed, document.querySelector('.spj-sug[data-w="' + w + '"]').classList.contains('on'), document.querySelector('.spj-lh b')?.textContent, document.querySelector('.spj-rules .sp-wordin').value], w);
  ok(hh0[0] === pills[1] && hh0[1] && hh0[2] && /^Vorschau/.test(hh0[3]) && hh0[4] === hh0[1], 'H: Vorschlag „' + hh0[1] + '“ bleibt nach dem Zweckwechsel gewählt (Vorschau und Eingabefeld)');
  ok(await p.evaluate(n => document.querySelector('.spj-prev-add').textContent === '+ zu „' + n + '“' && document.querySelector('.spj-prev-new').textContent === '+ als neuer Zweck', await p.evaluate(id => D.zwecke.find(z => z.id === id).name, pills[1])),
    'H: im Kopf der Vorschau „+ zu „…““ (gewählter Zweck) und „+ als neuer Zweck“');
  await p.click('.spj-zi[data-z="' + pills[0] + '"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !!SPJ.typed), 'H: auch beim Zurückwechseln');
  await p.click('.spj-prevx'); await p.waitForTimeout(150);
  const k0 = await p.evaluate(() => document.querySelector('[data-sec="sp-zu"] .spj-row').dataset.k);
  await p.click('.spj-row[data-k="' + k0 + '"] .sp-d'); await move('-');
  const hh1 = await p.evaluate(k => [D.spenden.zweck[k], !!document.querySelector('.spj-row[data-k="' + k + '"]'), document.querySelectorAll('[data-sec="sp-zu"] .spj-row .sp-tag.hand').length], k0);
  ok(hh1[0] === '-' && hh1[1] && hh1[2] === 0, 'H: von Hand auf „zweckungebunden“ gesetzt – in der Liste „Zweckungebunden“ ohne Kennzeichen');
  await p.click('.spj-row[data-k="' + k0 + '"] .sp-d'); await move(pills[0]); await p.click('.spj-lv [data-lv="zweck"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(k => document.querySelector('.spj-row[data-k="' + k + '"] .sp-tag.hand')?.textContent === 'von Hand', k0), 'H: beim Zweck („Bei …“) steht „von Hand“');

  // ---- I: ausgeblendete Vorschläge: Knopf „Ausgeblendet (N)“ oben rechts, einzeln oder alle wieder einblenden
  await p.click('.spj-lv [data-lv="frei"]'); await p.evaluate(() => commit(d => { d.spenden.ignor = {}; }, 'Test')); await p.waitForTimeout(200);
  const ws = await p.evaluate(() => [...document.querySelectorAll('.spj-sug')].slice(0, 2).map(e => e.dataset.w));
  for (const x of ws) await hideSug(x);
  const i0 = await p.evaluate(() => { const b = document.querySelector('.spj-sugign'), hd = document.querySelector('.spj-sugbar').getBoundingClientRect(), r = b.getBoundingClientRect(); return [b.textContent, hd.right - r.right < 20]; });
  ok(i0[0] === 'Ausgeblendet (2)' && i0[1], 'I: nach zweimal „×“: Knopf „' + i0[0] + '“ oben rechts im Vorschlagsfeld');
  await p.click('.spj-sugign'); await p.waitForTimeout(150);
  const i1 = await p.evaluate(() => [[...document.querySelectorAll('.spj-ig')].map(e => e.dataset.w).sort().join(','), document.querySelectorAll('.spj-sugs .spj-sug:not(.spj-ig)').length]);
  ok(i1[0] === ws.slice().sort().join(',') && i1[1] === 0, 'I: Klick zeigt die ausgeblendeten Begriffe (' + i1[0] + ')');
  await p.click('.spj-ig[data-w="' + ws[0] + '"] .spj-to'); await p.waitForTimeout(200);
  const i2 = await p.evaluate(w => [document.querySelector('.spj-sugign')?.textContent, Object.keys(D.spenden.ignor).join(), document.querySelectorAll('.spj-ig').length], ws[0]);
  ok(i2[0] === 'Ausgeblendet (1)' && i2[1] === ws[1] && i2[2] === 1, 'I: „einblenden“ holt „' + ws[0] + '“ zurück, einer bleibt ausgeblendet');
  await p.click('.spj-ignall'); await p.waitForTimeout(200);
  const i3 = await p.evaluate(ws => [!document.querySelector('.spj-sugign'), !Object.keys(D.spenden.ignor).length, ws.every(w => !!document.querySelector('.spj-sug[data-w="' + w + '"]'))], ws);
  ok(i3.every(Boolean), 'I: „alle einblenden“ – beide Vorschläge wieder da, Knopf verschwindet');
  await finish(b, pages);
})();
