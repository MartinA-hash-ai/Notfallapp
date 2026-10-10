// 0.18 „neu – bitte einmal prüfen“ bei den Spendenzwecken: beim ersten Einlesen alles Zugeordnete einmal, danach nur neue Spenden;
// Zahl am Zweck, in der Übersicht und am Reiter; „ansehen“ zeigt nur die neuen, falsche lassen sich herausnehmen, „✓ geprüft“ hebt die Markierung auf
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
let n = 0;
const line = (d, b, name, zweck) => [d, d, b, "'TESTDE11XXX", 'DE0010000000000000' + String(++n).padStart(4, '0'), name, "'Zugang/Gutschrift", zweck, "'Spendengutschrift", "'Paderborn - Test"].join(';');
const csv = rows => '﻿' + [HEAD, ...rows].join('\r\n') + '\r\n';
const put = (p, name, t, lm) => p.evaluate(([nm, t, lm]) => { __fs.files['/Mailing/Spendeneingänge 2027/' + nm] = { data: new TextEncoder().encode(t), lm }; }, [name, t, lm]);

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(() => commit(d => { d.zwecke.push({ id: 'zr', name: 'Rikscha', farbe: '#2e7d32', worte: ['Rikscha'], konten: [], massnahmen: [] }); }, 'Testzweck'));
  await put(p, 'a.csv', csv([line('02.03.2027', '10', 'Anna Probe', 'Rikscha'), line('03.03.2027', '20', 'Bernd Probe', 'Rikscha Spende'), line('04.03.2027', '30', 'Carla Probe', 'Danke'),
    line('05.03.2027', '40', 'Dora Probe', 'Rikscha Fahrt')]), 81000);
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'allg:2027'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length === 4); await p.waitForTimeout(300);
  const side = () => p.evaluate(() => { const e = document.querySelector('.spj-zi[data-z="zr"], .spj-zi'); return e ? e.querySelector('.spj-zs').textContent : ''; });
  const badge = () => p.evaluate(() => { const t = document.querySelector('nav.tabs .tab-badge'); return t ? t.textContent : ''; });
  const names = () => p.evaluate(() => [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].map(r => SP.byKey.get(r.dataset.k).name.split(' ')[0] + (r.querySelector('.sp-tag.neu') ? '+' : '')).sort().join(','));

  // ---- A: erstes Einlesen – alles, was ein Zweck per Regel bekommt, ist einmal „neu“
  const a0 = [await side(), await badge(), await p.evaluate(() => { const e = document.querySelector('.sp-ueb tr[data-mid="allg:2027"] .sp-mbadge.neu'); return e ? e.textContent : ''; }),
    await p.evaluate(() => Object.entries(D.spenden.neu).map(([k, v]) => SP.byKey.get(k).name.split(' ')[0] + ':' + v).sort().join(','))];
  ok(a0[0] === '3 neu3 · 70 €' && a0[1] === '3' && a0[2] !== '' && a0[3] === 'Anna:z,Bernd:z,Dora:z', 'A: „Rikscha“ mit „3 neu“, Hinweis in der Übersicht, am Reiter 3 (' + a0.join(' | ') + ')');
  await p.click('.spj-zi:has-text("Rikscha")'); await p.waitForTimeout(200);
  const a1 = await p.evaluate(() => [document.querySelector('.spj-zh .spj-newbar') ? document.querySelector('.spj-zh .spj-newbar').textContent : '', SPJ.z]);
  ok(a1[0] === '3 neuansehen✓ geprüft' && a1[1] === 'zr', 'A: im Kopf des Zwecks „3 neu · ansehen · ✓ geprüft“');
  await p.click('.spj-zh .spj-ok'); await p.waitForTimeout(250);
  ok(await side() === '3 · 70 €' && await badge() === '' && await p.evaluate(() => !Object.keys(D.spenden.neu).length && !document.querySelector('.spj-zh .spj-newbar')), 'A: „✓ geprüft“ – Markierung weg, Reiter ohne Zahl');
  await p.evaluate(() => undo()); await p.waitForTimeout(200);
  ok(await side() === '3 neu3 · 70 €', 'A: Strg+Z – wieder „3 neu“');
  await p.click('.spj-zh .spj-ok'); await p.waitForTimeout(250);

  // ---- B: neue Datei – nur die neuen Spenden sind markiert
  await put(p, 'b.csv', csv([line('08.03.2027', '50', 'Emil Probe', 'Rikscha'), line('09.03.2027', '60', 'Fritz Probe', 'Rikscha falsch gebucht'), line('10.03.2027', '70', 'Gina Probe', 'Weihnachten')]), 82000);
  await p.evaluate(() => spScan({ manual: true })); await p.waitForFunction(() => SP.rows.length === 7); await p.waitForTimeout(300);
  const b0 = [await side(), await badge(), await p.evaluate(() => Object.entries(D.spenden.neu).map(([k, v]) => SP.byKey.get(k).name.split(' ')[0] + ':' + v).sort().join(','))];
  ok(b0[0] === '2 neu5 · 180 €' && b0[1] === '2' && b0[2] === 'Emil:z,Fritz:z', 'B: neue Datei – „2 neu“ bei Rikscha (' + b0.join(' | ') + ')');
  await p.click('.spj-zh .spj-shownew'); await p.waitForTimeout(200);
  const b1 = [await names(), await p.evaluate(() => [SPJ.lv, SPJ.onlyNew, !!document.querySelector('.spj-onlynew.on')])];
  ok(b1[0] === 'Emil+,Fritz+' && b1[1].join() === 'zweck,true,true', 'B: „ansehen“ zeigt nur die neuen (' + b1[0] + ')');
  // falsche neue Spende herausnehmen → zweckungebunden (von Hand), die Markierung ist weg
  await p.click('[data-sec="sp-zu"] .spj-row:has-text("falsch") .sp-z'); await p.waitForTimeout(100);
  await p.selectOption('.spj-act .spj-move', '-'); await p.click('.spj-act .spj-go'); await p.waitForTimeout(250);
  const b2 = [await names(), await side(), await p.evaluate(() => { const k = SP.rows.find(r => r.name.startsWith('Fritz')).k; return [D.spenden.zweck[k], D.spenden.neu[k] || '']; })];
  ok(b2[0] === 'Emil+' && b2[1] === '1 neu4 · 120 €' && b2[2].join() === '-,', 'B: Fritz herausgenommen (zweckungebunden von Hand), nur Emil bleibt neu (' + b2[0] + ' | ' + b2[1] + ')');
  await p.click('.spj-zh .spj-ok'); await p.waitForTimeout(250);
  ok(await side() === '4 · 120 €' && await badge() === '' && await p.evaluate(() => !SPJ.onlyNew), 'B: „✓ geprüft“ – keine Markierung mehr, Liste wieder vollständig');

  // ---- C: dieselbe Datei noch einmal einlesen – nichts wird wieder „neu“
  await p.evaluate(() => { const F = __fs.files, src = F['/Mailing/Spendeneingänge 2027/b.csv']; F['/Mailing/Spendeneingänge 2027/b (2).csv'] = { data: src.data.slice(), lm: 83000 }; });
  await p.evaluate(() => spScan({ manual: true })); await p.waitForTimeout(600);
  ok(await p.evaluate(() => SP.rows.length === 7 && SP.files.length === 3), 'C: dieselbe Datei ein zweites Mal im Ordner – keine doppelten Spenden');
  ok(await side() === '4 · 120 €' && await badge() === '' && await p.evaluate(() => !Object.keys(D.spenden.neu).length), 'C: erneutes Einlesen bekannter Spenden – keine neue Markierung');
  await finish(b, pages);
})();
