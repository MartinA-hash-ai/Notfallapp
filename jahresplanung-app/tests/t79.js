// 0.49: „Zugeordnet“ links, „Offen“ rechts (Umschalter Zugeordnet | beide | Offen) – Spenden zwischen den Spalten und links auf eine Maßnahme ziehen;
// bei den Spendenzwecken der Zweck links, „Zweckungebunden“ rechts, ebenso mit Ziehen
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const L = (d, b, who, zw) => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000' + who, 'Probe ' + who, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - Lage"].join(';');
const csv = r => '﻿' + [HEAD, ...r].join('\r\n') + '\r\n';
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500, ui: {} }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  const rows = [L('15.03.2027', 30, '000001', 'Sommermailing A'), L('16.03.2027', 31, '000002', 'Sommermailing B'), L('17.03.2027', 40, '000003', 'Spende Rikscha'),
    L('18.03.2027', 41, '000004', 'Danke X'), L('19.03.2027', 42, '000005', 'Danke Y'), L('20.03.2027', 43, '000006', 'Wärmebus Z')];
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/e.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv(rows));
  await p.evaluate(() => commit(d => { for (const [id, name, regel] of [['sm', 'Sommer X', { worte: ['Sommermailing'], ab: 0, bis: 200 }], ['jb', 'Bericht X', null]]) {
    const c = JSON.parse(JSON.stringify(d.massnahmen[0])); Object.assign(c, { id, name, pal: '2027-03-10' }); if (regel) c.regel = regel; else delete c.regel; delete c.plan; d.massnahmen.push(c); }
    d.zwecke.push({ id: 'zr', name: 'Rikscha', farbe: '#2e7d32', worte: ['Rikscha'], konten: [], massnahmen: [] }, { id: 'zw', name: 'Wärmebus', farbe: '#e06a1b', worte: ['Wärmebus'], konten: [], massnahmen: [] }); }));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'sm'; SP.at = null; renderNow(); spScan({ manual: true }); }); await p.waitForFunction(() => SP.rows.length === 6); await p.waitForTimeout(300);
  const zuOf = mid => p.evaluate(mid => SP.rows.filter(r => (D.spenden.zu[r.k] || {}).m === mid).map(r => r.zweck).sort().join(','), mid);
  const rowSel = (pane, text) => '[data-sec="sp-zu"] [data-pane="' + pane + '"] .spj-row:has-text("' + text + '")';
  // ---- A: Maßnahme – zwei Spalten
  const a0 = await p.evaluate(() => [[...document.querySelectorAll('.spm-lists .spj-lv .seg-btn')].map(e => e.textContent + (e.classList.contains('on') ? '*' : '')).join('|'),
    [...document.querySelectorAll('.spm-panes > .spj-listbox')].map(e => e.dataset.pane + ':' + e.querySelector('.spm-pt').textContent + ':' + e.querySelectorAll('.spj-row').length).join(' ')]);
  ok(a0[0] === 'Zugeordnet*|Offen*' && a0[1] === 'zu:Zugeordnet:2 offen:Offen:4', 'A: anfangs beide an – links „Zugeordnet“ (2), rechts „Offen“ (4) ' + JSON.stringify(a0));
  // ---- A2: Filter von „Offen“ hinter „Zeitraum ändern“ (anfangs zu, ganzes Jahr); zugeklappt zeigt der Knopf, was eingestellt ist
  const f0 = await p.evaluate(() => [!!document.querySelector('.spm-filter'), document.querySelector('.spm-fbtn')?.textContent, SPUI.f.von, SPUI.f.bis]);
  ok(!f0[0] && f0[1] === 'Zeitraum ändern ▾' && f0[2] === '2027-01-01' && f0[3] === '2027-12-31', 'A2: Filter anfangs zu, Knopf „Zeitraum ändern“, ganzes Jahr ' + JSON.stringify(f0));
  await p.click('.spm-fbtn'); await p.waitForTimeout(150);
  await p.fill('.spm-filter .sp-q', 'Danke'); await p.waitForTimeout(450);
  await p.click('.spm-fbtn'); await p.waitForTimeout(150);
  const f1 = await p.evaluate(() => [!!document.querySelector('.spm-filter'), document.querySelector('.spm-fbtn').textContent, document.querySelector('.spm-fbtn').classList.contains('act'), document.querySelectorAll('[data-pane="offen"] .spj-row').length, UI.spmFOpen]);
  ok(!f1[0] && f1[1] === 'Suche „Danke“ ▾' && f1[2] && f1[3] === 2 && f1[4] === false, 'A2: zugeklappt bleibt der Filter – Knopf zeigt „Suche „Danke““, 2 Spenden ' + JSON.stringify(f1));
  await p.click('.spm-fbtn'); await p.click('.spm-freset'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelectorAll('[data-pane="offen"] .spj-row').length === 4 && !document.querySelector('.spm-freset')), 'A2: „zurücksetzen“ zeigt wieder alles');
  await p.click('.spm-fbtn'); await p.waitForTimeout(150);
  // ---- B: Ziehen
  await p.evaluate(() => document.querySelector('[data-sec="sp-zu"] .spm-panes').scrollIntoView({ block: 'center' })); await p.waitForTimeout(100);
  await p.dragAndDrop(rowSel('offen', 'Danke X'), '[data-sec="sp-zu"] [data-pane="zu"] .spj-list'); await p.waitForTimeout(300);
  ok(await zuOf('sm') === 'Danke X,Sommermailing A,Sommermailing B', 'B: „Danke X“ von „Offen“ nach links gezogen – zugeordnet');
  await p.dragAndDrop(rowSel('zu', 'Sommermailing B'), '[data-sec="sp-zu"] [data-pane="offen"] .spj-list'); await p.waitForTimeout(300);
  ok(await zuOf('sm') === 'Danke X,Sommermailing A' && await p.evaluate(() => Object.values(D.spenden.nein).some(l => l.includes('sm'))), 'B: „Sommermailing B“ nach rechts gezogen – herausgenommen (die Regel ordnet sie nicht wieder zu)');
  await p.click(rowSel('offen', 'Danke Y')); await p.click(rowSel('offen', 'Spende Rikscha'));
  await p.dragAndDrop(rowSel('offen', 'Danke Y'), '[data-sec="sp-zu"] [data-pane="zu"] .spj-list'); await p.waitForTimeout(300);
  ok(await zuOf('sm') === 'Danke X,Danke Y,Sommermailing A,Spende Rikscha', 'B: zwei markiert, eine gezogen – beide zugeordnet');
  await p.dragAndDrop(rowSel('zu', 'Danke X'), '.spm .spj-zi[data-mid="jb"]'); await p.waitForTimeout(300);
  ok(await zuOf('jb') === 'Danke X' && await zuOf('sm') === 'Danke Y,Sommermailing A,Spende Rikscha', 'B: auf „Bericht X“ links gezogen – dort zugeordnet');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
  ok(await zuOf('jb') === '' && await zuOf('sm') === 'Danke X,Danke Y,Sommermailing A,Spende Rikscha', 'B: Strg+Z nimmt es zurück');
  // ---- C: Umschalter
  await p.click('.spm-lists .seg-btn[data-tab="zu"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => [...document.querySelectorAll('.spm-panes > .spj-listbox')].map(e => e.dataset.pane).join() === 'offen' && UI.spmView === 'offen' && UI_KEYS.includes('spmView')), 'C: „Zugeordnet“ ausgeschaltet – nur „Offen“, wird gemerkt');
  await p.click('.spm-lists .seg-btn[data-tab="offen"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => UI.spmView === 'offen'), 'C: die letzte eingeschaltete Liste bleibt an');
  await p.click('.spm-lists .seg-btn[data-tab="zu"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => UI.spmView === 'beide' && document.querySelectorAll('.spm-panes > .spj-listbox').length === 2), 'C: „Zugeordnet“ wieder an – beide nebeneinander');
  // ---- D: Spendenzwecke – Zweck links, zweckungebunden rechts
  await p.evaluate(() => { UI.spMid = 'allg:2027'; SPJ.z = 'zr'; renderNow(); }); await p.waitForTimeout(300);
  const zOf = () => p.evaluate(() => { const J = spjCompute(2027); return ['zr', 'zw', SPJ_FREI].map(z => J.list.filter(e => e.z === z).map(e => e.rec.zweck).sort().join(',')).join(' | '); });
  const d0 = await p.evaluate(() => [[...document.querySelectorAll('.spj-vv .seg-btn')].map(e => e.textContent + (e.classList.contains('on') ? '*' : '')).join('|'), [...document.querySelectorAll('.spj-panes > .spj-listbox')].map(e => e.dataset.pane + ':' + e.querySelector('.spj-lh b').textContent).join(' ')]);
  ok(d0[0] === 'Zugeordnet*|Zweckungebunden*' && d0[1] === 'zweck:Rikscha frei:Zweckungebunden', 'D: Zweck gewählt – links „Rikscha“, rechts „Zweckungebunden“ ' + JSON.stringify(d0));
  await p.evaluate(() => document.querySelector('[data-sec="sp-zu"] .spj-panes').scrollIntoView({ block: 'center' })); await p.waitForTimeout(100);   // nicht während des Ziehens rollen
  const z0 = await zOf();
  await p.dragAndDrop(rowSel('frei', 'Danke X'), '[data-sec="sp-zu"] [data-pane="zweck"] .spj-list'); await p.waitForTimeout(300);
  const z1 = await zOf();
  ok(/^Danke X,Spende Rikscha \| Wärmebus Z \| /.test(z1) && !/Danke X/.test(z1.split(' | ')[2]), 'D: „Danke X“ nach links auf „Rikscha“ gezogen ' + z0 + ' → ' + z1);
  await p.dragAndDrop(rowSel('zweck', 'Spende Rikscha'), '[data-sec="sp-zu"] [data-pane="frei"] .spj-list'); await p.waitForTimeout(300);
  ok(/^Danke X \| /.test(await zOf()) && (await zOf()).split(' | ')[2].includes('Spende Rikscha'), 'D: „Spende Rikscha“ nach rechts gezogen – zweckungebunden');
  await p.dragAndDrop(rowSel('frei', 'Danke Y'), '.spj-zi[data-z="zw"]'); await p.waitForTimeout(300);
  ok((await zOf()).split(' | ')[1] === 'Danke Y,Wärmebus Z', 'D: „Danke Y“ links auf „Wärmebus“ gezogen – dort zugeordnet');
  await p.click('.spj-vv .seg-btn[data-v="frei"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => [...document.querySelectorAll('.spj-panes > .spj-listbox')].map(e => e.dataset.pane).join() === 'zweck' && UI.spjView === 'eins' && document.querySelector('.spj-lh b').textContent === 'Zugeordnet'), 'D: „Zweckungebunden“ aus – nur die Spenden des Zwecks, wird gemerkt');
  await finish(b, pages);
})();
