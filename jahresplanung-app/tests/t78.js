// 0.49: Zeitraum je Schlagwort – Datum am Schlagwort öffnet Beginn/Ende; ein neues Schlagwort übernimmt den Zeitraum des vorigen; „für alle übernehmen“
const { chromium, ok, open, connect, readF, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const L = (d, b, who, zw) => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000' + who, 'Probe ' + who, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - Lage"].join(';');
const csv = r => '﻿' + [HEAD, ...r].join('\r\n') + '\r\n';
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  const rows = [L('15.03.2027', 30, '000001', 'Sommermailing A'), L('20.06.2027', 31, '000002', 'Sommermailing spät'), L('20.03.2027', 40, '000003', 'SM27 B'), L('20.10.2027', 41, '000004', 'SM27 C')];
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/e.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv(rows));
  await p.evaluate(() => commit(d => { const c = JSON.parse(JSON.stringify(d.massnahmen[0])); Object.assign(c, { id: 'sm', name: 'Sommer X', pal: '2027-03-10', regel: { worte: ['Sommermailing'], ab: 0, bis: 200 } }); delete c.plan; d.massnahmen.push(c); }));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'sm'; SP.at = null; renderNow(); spScan({ manual: true }); }); await p.waitForFunction(() => SP.rows.length === 4); await p.waitForTimeout(300);
  const zu = () => p.evaluate(() => SP.rows.filter(r => (D.spenden.zu[r.k] || {}).m === 'sm').map(r => r.zweck).sort().join(','));
  ok(await zu() === 'Sommermailing A,Sommermailing spät' && /^10\.03\.–26\.09\.$/.test(await p.textContent('.sp-wzr')), 'A: am Schlagwort steht sein Zeitraum (10.03.–26.09.), beide Sommermailing-Spenden zugeordnet');
  // ---- B: Zeitraum eines Schlagworts ändern
  await p.click('.sp-wzr[data-w="Sommermailing"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /Zeitraum für „Sommermailing“/.test(document.querySelector('.sp-wzrpop').textContent) && /\+0 bis \+200 Tage ab PAL/.test(document.querySelector('.sp-wzrpop').textContent)), 'B: Klick öffnet Beginn/Ende mit „+0 bis +200 Tage ab PAL“');
  await p.fill('[data-fk="sp-rbis:Sommermailing"]', '2027-04-30'); await p.press('[data-fk="sp-rbis:Sommermailing"]', 'Enter'); await p.waitForTimeout(250);
  const b1 = await p.evaluate(() => [JSON.stringify(D.massnahmen.find(m => m.id === 'sm').regel.zr), document.querySelector('.sp-wzr').textContent, !!document.querySelector('.sp-wzrpop'), document.querySelector('.sp-wzrpop .tagflt-n').textContent]);
  ok(b1[0] === '{"Sommermailing":{"ab":0,"bis":51}}' && b1[1] === '10.03.–30.04.' && b1[2] && /\+0 bis \+51/.test(b1[3]) && await zu() === 'Sommermailing A', 'B: Ende 30.04. – nur noch die Spende im März zugeordnet, Fenster bleibt offen ' + JSON.stringify(b1));
  await p.mouse.click(5, 300); await p.waitForTimeout(150);
  // ---- C: neues Schlagwort übernimmt den Zeitraum des vorigen
  await p.fill('.sp-wordin', 'SM27'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelectorAll('.spm-listbox.prev .spj-row').length === 1), 'C: Vorschau „SM27“ nur mit der Spende im Zeitraum des vorigen Schlagworts');
  await p.press('.sp-wordin', 'Enter'); await p.waitForTimeout(300);
  const c1 = await p.evaluate(() => [JSON.stringify(D.massnahmen.find(m => m.id === 'sm').regel.zr.SM27), document.querySelector('.sp-wzr[data-w="SM27"]').textContent]);
  ok(c1[0] === '{"ab":0,"bis":51}' && c1[1] === '10.03.–30.04.' && await zu() === 'SM27 B,Sommermailing A', 'C: „SM27“ übernimmt 10.03.–30.04. – ordnet „SM27 B“ zu, „SM27 C“ (Oktober) nicht ' + JSON.stringify(c1));
  // ---- D: eigener Zeitraum für SM27, Sommermailing bleibt
  await p.click('.sp-wzr[data-w="SM27"]'); await p.waitForTimeout(150);
  await p.fill('[data-fk="sp-rbis:SM27"]', '2027-12-31'); await p.press('[data-fk="sp-rbis:SM27"]', 'Enter'); await p.waitForTimeout(250);
  ok(await zu() === 'SM27 B,SM27 C,Sommermailing A' && await p.textContent('.sp-wzr[data-w="Sommermailing"]') === '10.03.–30.04.', 'D: „SM27“ bis 31.12. – Oktober-Spende dazu, „Sommermailing“ behält seinen Zeitraum');
  await p.fill('[data-fk="sp-rab:SM27"]', '2028-02-01'); await p.press('[data-fk="sp-rab:SM27"]', 'Enter'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => { const o = D.massnahmen.find(m => m.id === 'sm').regel.zr.SM27; return o.ab === o.bis && o.ab === 328; }), 'D: Beginn nach dem Ende → Ende rückt mit');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
  // ---- E: für alle übernehmen; gespeichert in der Datei
  await p.click('.sp-wzrpop .sp-wzr-all'); await p.waitForTimeout(250);
  const e1 = await p.evaluate(() => { const r = D.massnahmen.find(m => m.id === 'sm').regel; return [r.zr, r.ab, r.bis, [...document.querySelectorAll('.sp-wzr')].map(e => e.textContent).join('|')]; });
  ok(e1[0] === undefined && e1[1] === 0 && e1[2] === 296 && e1[3] === '10.03.–31.12.|10.03.–31.12.' && await zu() === 'SM27 B,SM27 C,Sommermailing A,Sommermailing spät', 'E: „für alle Schlagworte übernehmen“ – ein Zeitraum für beide ' + JSON.stringify(e1));
  await p.mouse.click(5, 300); await p.waitForTimeout(150);
  await p.click('.sp-wzr[data-w="SM27"]'); await p.fill('[data-fk="sp-rbis:SM27"]', '2027-11-30'); await p.press('[data-fk="sp-rbis:SM27"]', 'Enter'); await p.waitForTimeout(150);
  await p.click('#savebox'); await p.waitForTimeout(600);
  ok(/"zr":\{"SM27":\{"ab":0,"bis":265\}\}/.test(await readF(p)), 'E: Zeitraum je Schlagwort steht in der Programmdatei');
  ok(await p.evaluate(() => { const d = JSON.parse(JSON.stringify(D)); d.massnahmen.find(m => m.id === 'sm').regel.zr = { SM27: { ab: '3', bis: 'x' }, weg: { ab: 1 } }; normalize(d); return JSON.stringify(d.massnahmen.find(m => m.id === 'sm').regel.zr); }) === '{"SM27":{"ab":3}}',
    'E: Einlesen bereinigt den Zeitraum (nur Zahlen, nur vorhandene Schlagworte)');
  await finish(b, pages);
})();
