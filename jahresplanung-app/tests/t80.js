// 0.51: Regel-Fenster auch bei den Spendenzwecken (Schlagwort, Zeitraum, Konten; Vorschau rechts) und Vorschläge bei Maßnahmen
// (Begriffe/Konten, die ab dem PAL auffällig häufiger sind – Klick bereitet eine neue Regel vor)
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const L = (d, b, who, zw, kto = 'Lage') => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000' + who, 'Probe ' + who, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - " + kto].join(';');
const csv = r => '﻿' + [HEAD, ...r].join('\r\n') + '\r\n';
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500, clock: new Date('2027-10-15T10:00:00') }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  const rows = [L('10.02.2027', 20, '000001', 'Rikscha A'), L('10.08.2027', 21, '000002', 'Rikscha B'), L('05.05.2027', 22, '000003', 'Spende', 'Nord'), L('06.06.2027', 23, '000004', 'Rikscha Nord', 'Nord'),
    // für die Vorschläge der Maßnahme (PAL 01.09.): davor nur „Danke“, danach „Wärmebus“, „WB“ und Konto Süd
    L('10.06.2027', 10, '000010', 'Herzlichen Dank Spende'), L('10.07.2027', 10, '000011', 'Herzlichen Dank Spende'), L('10.08.2027', 10, '000012', 'Herzlichen Dank Spende'),
    L('05.09.2027', 30, '000020', 'Wärmebus Herbst', 'Süd'), L('06.09.2027', 31, '000021', 'Wärmebus Herbst', 'Süd'), L('07.09.2027', 32, '000022', 'Wärmebus Herbst', 'Süd'),
    L('08.09.2027', 33, '000023', 'Brief WB', 'Süd'), L('09.09.2027', 34, '000024', 'Brief WB'), L('10.09.2027', 35, '000025', 'Herzlichen Dank Spende')];
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/e.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv(rows));
  await p.evaluate(() => commit(d => { d.zwecke.push({ id: 'zr', name: 'Rikscha', farbe: '#2e7d32', worte: ['Rikscha'], konten: [], massnahmen: [] });
    const c = JSON.parse(JSON.stringify(d.massnahmen[0])); Object.assign(c, { id: 'wb', name: 'Wärmebus-Brief', pal: '2027-09-01' }); delete c.plan; delete c.regel; d.massnahmen.push(c); }));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'allg:2027'; UI.spjRulesOpen = true; SP.at = null; renderNow(); spScan({ manual: true }); }); await p.waitForFunction(() => SP.rows.length === 13); await p.waitForTimeout(300);
  await p.click('.spj-zi[data-z="zr"]'); await p.waitForTimeout(200);
  const inZ = () => p.evaluate(() => spjCompute(2027).list.filter(e => e.z === 'zr').map(e => e.rec.zweck).sort().join(','));
  const setDate = async (fk, v) => { await p.fill('[data-fk="' + fk + '"]', v); await p.press('[data-fk="' + fk + '"]', 'Enter'); await p.waitForTimeout(200); };
  // ---- A: Zweck – Regel ändern: Zeitraum
  ok(await inZ() === 'Rikscha A,Rikscha B,Rikscha Nord' && !!await p.$('.spj-rules .sp-newrule'), 'A: Zweck „Rikscha“ – drei Spenden, in der Regelzeile „+ neue Regel“');
  await p.click('.spj-rules .sp-rule[data-w="Rikscha"] .sp-rw'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('.spj-red .sp-red-h b').textContent === 'Regel ändern' && document.querySelector('.spj-red .sp-wordin').value === 'Rikscha' && /leer = immer/.test(document.querySelector('.spj-red').textContent)), 'A: Klick auf die Regel öffnet „Regel ändern“, Zeitraum leer = immer');
  await setDate('spj-evon', '2027-01-01'); await setDate('spj-ebis', '2027-06-30');
  await p.click('.spj-eapply'); await p.waitForTimeout(300);
  ok(await inZ() === 'Rikscha A,Rikscha Nord' && await p.evaluate(() => JSON.stringify(D.zwecke[0].zr)) === '{"Rikscha":{"von":"2027-01-01","bis":"2027-06-30"}}' && await p.evaluate(() => document.querySelector('.spj-rules .sp-rule .sp-wzr').textContent) === '01.01.–30.06.',
    'A: „Rikscha“ nur 01.01.–30.06. – die Spende im August ist wieder zweckungebunden');
  // ---- B: neue Regel – Zeitraum vorbelegt, nur Konto → Vorschau rechts, Zweck links
  await p.click('.spj-rules .sp-newrule'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('[data-fk="spj-evon"]').value === '2027-01-01' && document.querySelector('[data-fk="spj-ebis"]').value === '2027-06-30'), 'B: neue Regel übernimmt den Zeitraum der vorigen');
  await p.click('.spj-red .sp-kopt[data-k="Paderborn - Nord"]'); await p.waitForTimeout(300);
  const b0 = await p.evaluate(() => [[...document.querySelectorAll('.spj-panes > .spj-listbox')].map(e => e.dataset.pane).join(), [...document.querySelectorAll('[data-pane="prev"] .spj-row')].map(e => SP.byKey.get(e.dataset.k).zweck).join()]);
  ok(b0[0] === 'zweck,prev' && b0[1] === 'Spende', 'B: Konto angekreuzt – rechts die Vorschau (nur die zweckungebundene „Spende“), links bleibt der Zweck ' + JSON.stringify(b0));
  await p.click('.spj-eapply'); await p.waitForTimeout(300);
  ok(await inZ() === 'Rikscha A,Rikscha Nord,Spende' && await p.evaluate(() => D.zwecke[0].worte.join() === 'Rikscha,*' && JSON.stringify(D.zwecke[0].zr['*']) === '{"von":"2027-01-01","bis":"2027-06-30","k":["Paderborn - Nord"]}'),
    'B: Regel „jeder Verwendungszweck · Konto, 01.01.–30.06.“ übernommen');
  // ---- C: nur Konto ohne Zeitraum = wie bisher „alle Spenden auf diesem Konto“
  await p.click('.spj-rules .sp-newrule'); await p.waitForTimeout(200);
  await setDate('spj-evon', ''); await setDate('spj-ebis', '');
  await p.click('.spj-red .sp-kopt[data-k="Paderborn - Lage"]'); await p.waitForTimeout(200);
  await p.click('.spj-eapply'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => D.zwecke[0].konten.join() === 'Paderborn - Lage') && (await inZ()).includes('Rikscha B'), 'C: nur Konto, kein Zeitraum → Konto-Regel wie bisher (alle Spenden darauf)');
  // ---- D: Vorschläge bei der Maßnahme
  await p.evaluate(() => { UI.spMid = 'wb'; renderNow(); }); await p.waitForTimeout(300);
  ok(!await p.$('.spm-sugbar'), 'D: Vorschläge anfangs zu');
  await p.click('.spm-sugtog'); await p.waitForTimeout(250);
  const d0 = await p.evaluate(() => [[...document.querySelectorAll('.spm-sug')].map(e => (e.dataset.w || 'K:' + e.dataset.k) + '=' + e.querySelector('.spj-sug-n').textContent + '/' + e.querySelector('.spm-sug-why').textContent).join(' | '), UI.spmSugOpen, UI_KEYS.includes('spmSugOpen')]);
  ok(/Wärmebus=3\/nur ab PAL/.test(d0[0]) && /WB=2\/nur ab PAL/.test(d0[0]) && /K:Paderborn - Süd=4\//.test(d0[0]) && !/Dank/.test(d0[0]) && d0[1] && d0[2], 'D: Vorschläge – Begriffe und Konto, die erst ab dem PAL auftauchen, nicht „Dank“ (kam vorher auch) ' + JSON.stringify(d0));
  await p.click('.spm-sug[data-k="Paderborn - Süd"] .spj-sw-l'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('.spm-red .sp-wordin').value === '' && JSON.stringify(SPUI.ed.k) === '["Paderborn - Süd"]' && document.querySelectorAll('.spm-listbox.prev .spj-row').length === 4),
    'D: Konto-Vorschlag → neue Regel mit dem Konto, ohne Schlagwort (Vorschau: die 4 Spenden darauf)');
  await p.click('.spm-red .spj-prevx'); await p.waitForTimeout(200);
  await p.click('.spm-sug[data-w="Wärmebus"] .spj-sw-l'); await p.waitForTimeout(300);
  const d1 = await p.evaluate(() => [document.querySelector('.spm-red .sp-red-h b')?.textContent, document.querySelector('.spm-red .sp-wordin').value, document.querySelectorAll('.spm-listbox.prev .spj-row').length, document.querySelector('.spm-sug[data-w="Wärmebus"]').classList.contains('on')]);
  ok(d1.join('|') === 'Neue Regel|Wärmebus|3|true', 'D: Klick auf den Vorschlag öffnet „Neue Regel“ mit dem Wort, Vorschau mit 3 Spenden ' + JSON.stringify(d1));
  await p.click('.spm-red .sp-kopt[data-k="Paderborn - Süd"]'); await p.waitForTimeout(200);
  await p.click('.spm-apply'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JSON.stringify(D.massnahmen.find(m => m.id === 'wb').regel)) === '{"worte":["Wärmebus"],"ab":0,"bis":182,"zr":{"Wärmebus":{"ab":0,"bis":182,"k":["Paderborn - Süd"]}}}' && !await p.$('.spm-sug[data-w="Wärmebus"]') && !await p.$('.spm-sug[data-k]'),
    'D: übernommen mit Konto – der Vorschlag verschwindet (auch das Konto: dort ist nur noch eine Spende offen)');
  await finish(b, pages);
})();
