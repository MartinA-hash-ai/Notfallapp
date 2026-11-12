// 0.49/0.51: Regeln einer Maßnahme aus Schlagwort, Zeitraum und Konto – „+ neue Regel“ bzw. Klick auf eine Regel öffnet das Regel-Fenster;
// eine neue Regel übernimmt den Zeitraum der vorigen; leeres Schlagwort + Konto = alles auf diesem Konto; „Zeitraum für alle Regeln übernehmen“
const { chromium, ok, open, connect, readF, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const L = (d, b, who, zw, kto = 'Lage') => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000' + who, 'Probe ' + who, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - " + kto].join(';');
const csv = r => '﻿' + [HEAD, ...r].join('\r\n') + '\r\n';
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  const rows = [L('15.03.2027', 30, '000001', 'Sommermailing A'), L('20.06.2027', 31, '000002', 'Sommermailing spät'), L('20.03.2027', 40, '000003', 'SM27 B'), L('20.10.2027', 41, '000004', 'SM27 C'),
    L('25.03.2027', 50, '000005', 'Spende Nord', 'Nord'), L('26.03.2027', 51, '000006', 'Danke', 'Lage')];
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/e.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv(rows));
  await p.evaluate(() => commit(d => { const c = JSON.parse(JSON.stringify(d.massnahmen[0])); Object.assign(c, { id: 'sm', name: 'Sommer X', pal: '2027-03-10', regel: { worte: ['Sommermailing'], ab: 0, bis: 200 } }); delete c.plan; d.massnahmen.push(c); }));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'sm'; SP.at = null; renderNow(); spScan({ manual: true }); }); await p.waitForFunction(() => SP.rows.length === 6); await p.waitForTimeout(300);
  const zu = () => p.evaluate(() => SP.rows.filter(r => (D.spenden.zu[r.k] || {}).m === 'sm').map(r => r.zweck).sort().join(','));
  const regel = () => p.evaluate(() => JSON.stringify(D.massnahmen.find(m => m.id === 'sm').regel));
  const chips = () => p.evaluate(() => [...document.querySelectorAll('.spm-rules .sp-rule')].map(e => [...e.children].filter(c => !c.classList.contains('sp-x')).map(c => c.textContent).join(' ')).join(' | '));
  const setDate = async (fk, v) => { await p.fill('[data-fk="' + fk + '"]', v); await p.press('[data-fk="' + fk + '"]', 'Enter'); await p.waitForTimeout(200); };
  const nord = await p.evaluate(() => spGlied('Paderborn - Nord'));
  ok(await zu() === 'Sommermailing A,Sommermailing spät' && await chips() === 'Sommermailing 10.03.–26.09.' && !!await p.$('.spm-rules .sp-newrule'), 'A: Regel als Kästchen „Sommermailing 10.03.–26.09.“, daneben „+ neue Regel“');
  // ---- B: Klick auf die Regel – ändern
  await p.click('.spm-rules .sp-rule .sp-rw'); await p.waitForTimeout(200);
  const b0 = await p.evaluate(() => [document.querySelector('.spm-red .sp-red-h b').textContent, document.querySelector('.spm-red .sp-wordin').value, document.querySelector('[data-fk="sp-eab"]').value, document.querySelector('[data-fk="sp-ebis"]').value, document.querySelector('.spm-red').textContent.includes('+0 bis +200 Tage ab PAL')]);
  ok(b0.join('|') === 'Regel ändern|Sommermailing|2027-03-10|2027-09-26|true', 'B: Klick öffnet „Regel ändern“ mit Schlagwort und Zeitraum ' + JSON.stringify(b0));
  await setDate('sp-ebis', '2027-04-30');
  ok(await regel() === '{"worte":["Sommermailing"],"ab":0,"bis":200}', 'B: Datum ändern allein übernimmt noch nichts');
  await p.click('.spm-apply'); await p.waitForTimeout(300);
  ok(await regel() === '{"worte":["Sommermailing"],"ab":0,"bis":200,"zr":{"Sommermailing":{"ab":0,"bis":51}}}' && await zu() === 'Sommermailing A' && !await p.$('.spm-red'), 'B: „Änderung übernehmen“ – Ende 30.04., nur noch die Spende im März');
  // ---- C: neue Regel übernimmt den Zeitraum der vorigen; Vorschau rechts, „Zugeordnet“ bleibt links
  await p.click('.spm-rules .sp-newrule'); await p.waitForTimeout(200);
  const c0 = await p.evaluate(() => [document.querySelector('.spm-red .sp-red-h b').textContent, document.querySelector('[data-fk="sp-eab"]').value, document.querySelector('[data-fk="sp-ebis"]').value, document.activeElement.classList.contains('sp-wordin')]);
  ok(c0.join('|') === 'Neue Regel|2027-03-10|2027-04-30|true', 'C: „+ neue Regel“ – Zeitraum der vorigen Regel vorbelegt, Fokus im Schlagwort ' + JSON.stringify(c0));
  await p.keyboard.type('SM27'); await p.waitForTimeout(400);
  const c1 = await p.evaluate(() => [[...document.querySelectorAll('.spm-panes > .spj-listbox')].map(e => e.dataset.pane).join(), [...document.querySelectorAll('.spm-listbox.prev .spj-row')].map(e => SP.byKey.get(e.dataset.k).zweck).join()]);
  ok(c1[0] === 'zu,prev' && c1[1] === 'SM27 B', 'C: Vorschau rechts mit „SM27 B“ (Oktober liegt außerhalb), links bleibt „Zugeordnet“ ' + JSON.stringify(c1));
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(/"zr":\{"Sommermailing":\{"ab":0,"bis":51\},"SM27":\{"ab":0,"bis":51\}\}/.test(await regel()) && await zu() === 'SM27 B,Sommermailing A', 'C: Enter übernimmt „SM27“ mit 10.03.–30.04.');
  // ---- D: Regel nur mit Konto (ohne Schlagwort)
  await p.click('.spm-rules .sp-newrule'); await p.waitForTimeout(200);
  await setDate('sp-ebis', '2027-12-31');
  await p.click('.spm-red .sp-kopt[data-k="Paderborn - Nord"]'); await p.waitForTimeout(300);
  const d0 = await p.evaluate(() => [...document.querySelectorAll('.spm-listbox.prev .spj-row')].map(e => SP.byKey.get(e.dataset.k).zweck).join() + '|' + document.querySelector('.spm-listbox.prev .spj-lh b').textContent);
  ok(d0 === 'Spende Nord|Vorschau Konto ' + nord, 'D: Konto angekreuzt, Schlagwort leer – Vorschau: alles auf diesem Konto im Zeitraum (' + d0 + ')');
  await p.click('.spm-apply'); await p.waitForTimeout(300);
  ok(/"\*":\{"ab":0,"bis":296,"k":\["Paderborn - Nord"\]\}/.test(await regel()) && (await zu()).includes('Spende Nord') && (await chips()).endsWith('jeder Verwendungszweck 10.03.–31.12. ' + nord), 'D: Regel „jeder Verwendungszweck · ' + nord + '“ ordnet „Spende Nord“ zu – ' + await chips());
  ok(await p.evaluate(() => [...document.querySelectorAll('.spm-listbox .spj-row .sp-tag.rule')].some(t => /^Konto /.test(t.textContent))), 'D: in der Liste steht als Grund „Konto …“');
  // ---- E: SM27 ändern – Ende 31.12.; Beginn nach dem Ende → Ende rückt mit; Abbrechen
  await p.click('.spm-rules .sp-rule[data-w="SM27"] .sp-rw'); await p.waitForTimeout(200);
  await setDate('sp-ebis', '2027-12-31'); await p.click('.spm-apply'); await p.waitForTimeout(300);
  ok((await zu()).includes('SM27 C') && /"SM27":\{"ab":0,"bis":296\}/.test(await regel()), 'E: „SM27“ bis 31.12. – Oktober-Spende dazu, „Sommermailing“ behält seinen Zeitraum');
  await p.click('.spm-rules .sp-rule[data-w="SM27"] .sp-rw'); await p.waitForTimeout(200);
  await setDate('sp-eab', '2028-02-01');
  ok(await p.evaluate(() => document.querySelector('[data-fk="sp-ebis"]').value === '2028-02-01'), 'E: Beginn nach dem Ende → Ende rückt mit');
  await p.click('.spm-red .spj-prevx'); await p.waitForTimeout(200);
  ok(/"SM27":\{"ab":0,"bis":296\}/.test(await regel()) && !await p.$('.spm-red'), 'E: Abbrechen lässt die Regel unverändert');
  // ---- F: Zeitraum für alle Regeln übernehmen (Konten bleiben)
  await p.click('.spm-rules .sp-rule[data-w="SM27"] .sp-rw'); await p.waitForTimeout(200);
  await p.click('.spm-red .sp-wzr-all'); await p.waitForTimeout(300);
  ok(await regel() === '{"worte":["Sommermailing","SM27","*"],"ab":0,"bis":296,"zr":{"*":{"k":["Paderborn - Nord"]}}}' && await zu() === 'SM27 B,SM27 C,Sommermailing A,Sommermailing spät,Spende Nord',
    'F: „Zeitraum für alle Regeln übernehmen“ – ein Zeitraum, das Konto der dritten Regel bleibt');
  // ---- G: in der Datei; Einlesen bereinigt
  await p.click('#savebox'); await p.waitForTimeout(600);
  ok((await readF(p)).includes('"zr":{"*":{"k":["Paderborn - Nord"]}}'), 'G: Regeln mit Konto stehen in der Programmdatei');
  ok(await p.evaluate(() => { const d = JSON.parse(JSON.stringify(D)); d.massnahmen.find(m => m.id === 'sm').regel.zr = { SM27: { ab: '3', bis: 'x', k: ['A', '', 'A', 5] }, weg: { ab: 1 } }; normalize(d); return JSON.stringify(d.massnahmen.find(m => m.id === 'sm').regel.zr); }) === '{"SM27":{"ab":3,"k":["A","5"]}}',
    'G: Einlesen bereinigt Zeitraum und Konten (nur Zahlen, nur vorhandene Schlagworte, Konten ohne Doppelte)');
  await finish(b, pages);
})();
