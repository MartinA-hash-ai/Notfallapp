// 0.16.7/0.17 Spendenzwecke zuordnen: Zwecke links, Spenden markieren (Klick, Umschalt-Klick, Häkchen oben) und mit der Leiste unten verschieben; Reihenfolge per Ziehen
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
  // Häkchen oben (alle/teils/keine) und Leiste unten (nur sichtbar, wenn etwas markiert ist)
  const bar = () => p.evaluate(() => { const a = document.querySelector('.spj-lh .spj-all'), act = document.querySelector('.spj-act');
    return { all: a.checked ? 'alle' : a.indeterminate ? 'teils' : 'keine', on: act.classList.contains('on') && getComputedStyle(act).display !== 'none', info: act.querySelector('.spj-selinfo').textContent,
      target: act.querySelector('.spj-move').value, dis: act.querySelector('.spj-go').disabled }; });
  const rowOf = name => p.evaluate(n => [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].find(r => SP.byKey.get(r.dataset.k).name === n).dataset.k, name);
  const clickRow = async (name, mod) => { const k = await rowOf(name); await p.click('.spj-row[data-k="' + k + '"] .sp-z', mod ? { modifiers: [mod] } : {}); await p.waitForTimeout(80); };
  const move = async v => { if (v != null) await p.selectOption('.spj-act .spj-move', v); await p.click('.spj-act .spj-go'); await p.waitForTimeout(250); };
  const side = () => p.evaluate(() => [...document.querySelectorAll('.spj-zi')].map(e => e.querySelector('.spj-zn').textContent.trim() + ' ' + e.querySelector('.spj-zs').textContent + (e.classList.contains('on') ? '*' : '')));

  // ---- A: Aufbau – links die Zwecke mit Anzahl und Summe, rechts „Kein Zweck gewählt“; Liste „Zweckungebunden“ (9), nichts markiert, keine Leiste
  const a0 = await rows(), a1 = await bar(), a2 = await side();
  ok(a2.join(' | ') === 'Rikscha 3 · 60 € | Wärmebus 0 · 0 € | zweckungebunden 9 · 720 €', 'A: Seitenleiste: ' + a2.join(' | '));
  ok(await p.evaluate(() => { const s = document.querySelector('.spj-side').getBoundingClientRect(), m = document.querySelector('.spj-main').getBoundingClientRect(); return s.right <= m.left + 1 && s.width > 200 && s.width < 300 && Math.abs(s.top - m.top) < 2; }) &&
    await p.evaluate(() => document.querySelector('.spj-zh').textContent === 'Kein Zweck gewählt'), 'A: Zwecke links (Seitenleiste), Arbeitsbereich rechts – ohne Wahl „Kein Zweck gewählt“');
  ok(a0.length === 9 && a0[0] === 'Probe L' && !a0.some(n => n.endsWith('*')), 'A: Liste zeigt die 9 zweckungebundenen Spenden, nichts markiert');
  ok(a1.all === 'keine' && !a1.on && await p.evaluate(() => !document.querySelector('[data-sec="sp-zu"] .spj-row select, [data-sec="sp-zu"] .spj-row .spj-to') && document.querySelectorAll('[data-sec="sp-zu"] .spj-row .spj-cb').length === 9),
    'A: Häkchen je Zeile, keine Auswahlliste und kein „→ Zweck“ in den Zeilen, Leiste unten noch unsichtbar');

  // ---- B: Klick markiert (blau, Häkchen), zweiter Klick markiert eine zweite, erneuter Klick hebt auf; Leiste erscheint ohne dass etwas springt
  await clickRow('Probe L'); await clickRow('Probe L');
  const top0 = await p.evaluate(() => [scrollY, Math.round(document.querySelector('.spj-list').getBoundingClientRect().top), document.querySelector('.spj-list').offsetHeight]);
  await clickRow('Probe L'); await clickRow('Probe J');
  const b0 = await rows(), b1 = await bar(), b2 = await p.evaluate(() => { const r = document.querySelector('.spj-row.sel'), n = document.querySelector('.spj-row:not(.sel)'); return [getComputedStyle(r).backgroundColor, getComputedStyle(n).backgroundColor, r.getAttribute('aria-selected'), getComputedStyle(r.querySelector('.spj-cb')).backgroundColor]; });
  ok(b0.filter(n => n.endsWith('*')).join() === 'Probe L*,Probe J*', 'B: zwei Zeilen per Klick markiert (' + b0.filter(n => n.endsWith('*')).join() + ')');
  ok(b2[0] === 'rgb(227, 242, 253)' && b2[0] !== b2[1] && b2[2] === 'true' && b2[3] === 'rgb(31, 119, 180)', 'B: markierte Zeilen blau hinterlegt, Häkchen gefüllt');
  ok(b1.on && b1.info === '2 Spenden markiert · 220,00 €' && b1.all === 'teils' && b1.target === '' && b1.dis, 'B: Leiste unten erscheint: „' + b1.info + '“ – ohne gewählten Zweck kein Ziel vorbelegt, Häkchen oben „teils“');
  const top1 = await p.evaluate(() => [scrollY, Math.round(document.querySelector('.spj-list').getBoundingClientRect().top), document.querySelector('.spj-list').offsetHeight]);
  ok(JSON.stringify(top1) === JSON.stringify(top0), 'B: Seite und Liste bleiben beim Markieren stehen ' + JSON.stringify([top0, top1]));
  await clickRow('Probe L');
  ok((await rows()).filter(n => n.endsWith('*')).join() === 'Probe J*' && (await bar()).info === '1 Spende markiert · 100,00 €', 'B: zweiter Klick auf dieselbe Zeile hebt die Markierung auf');

  // ---- C: Umschalt-Klick markiert den Bereich dazwischen; Neuzeichnen (z. B. „Namen zeigen“) behält die Markierung
  await clickRow('Probe F', 'Shift');
  const c0 = (await rows()).filter(n => n.endsWith('*'));
  ok(c0.join() === 'Probe J*,Probe I*,Probe H*,Probe G*,Probe F*', 'C: Umschalt-Klick markiert J bis F (' + c0.length + ')');
  await p.click('.spj-lh label.check input'); await p.waitForTimeout(200);
  ok((await rows()).filter(n => n.endsWith('*')).length === 5 && (await bar()).info === '5 Spenden markiert · 400,00 €', 'C: Markierung bleibt nach dem Neuzeichnen (Namen zeigen)');

  // ---- D: Ziel wählen, „Verschieben“ – sie verschwinden aus der Liste; Strg+Z
  await move('zw');
  const d0 = await p.evaluate(() => [Object.entries(D.spenden.zweck).filter(([, v]) => v === 'zw').length, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length, document.querySelector('#toasts').textContent]);
  const d1 = await bar();
  ok(d0[0] === 5 && d0[1] === 4 && /5 Spenden dem Zweck „Wärmebus“ zugeordnet/.test(d0[2]), 'D: 5 markierte Spenden zum Zweck „Wärmebus“ verschoben, 4 bleiben in der Liste');
  ok(d1.all === 'keine' && !d1.on && (await side())[1] === 'Wärmebus 5 · 400 €', 'D: danach nichts mehr markiert, Leiste weg, links „Wärmebus 5 · 400 €“');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !Object.keys(D.spenden.zweck).length && document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length === 9), 'D: Strg+Z holt sie zurück');

  // ---- E: Zweck links gewählt – Ziel ist vorbelegt; Markierung bleibt beim Zweckwechsel (gleiche Liste), der Umschalter beginnt neu
  await clickRow('Probe D');
  await p.click('.spj-zi[data-z="zr"]'); await p.waitForTimeout(200);
  const e0 = await bar();
  ok((await rows()).filter(n => n.endsWith('*')).join() === 'Probe D*' && e0.target === 'zr' && !e0.dis && await p.evaluate(() => document.querySelector('.spj-zh .spj-name').value === 'Rikscha'),
    'E: links „Rikscha“ gewählt – Markierung bleibt, Ziel „Rikscha“ vorbelegt, oben der Name zum Umbenennen');
  await clickRow('Probe E'); await move();
  const e1 = await p.evaluate(() => ['Probe D', 'Probe E'].map(n => D.spenden.zweck[SP.rows.find(r => r.name === n).k]).join());
  ok(e1 === 'zr,zr' && (await side())[0] === 'Rikscha 5 · 150 € *'.replace(' *', '*'), 'E: „Verschieben“ ohne Ziel zu wählen – D und E bei „Rikscha“ (links 5 · 150 €)');
  await clickRow('Probe F');
  await p.click('.spj-lv [data-lv="zweck"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.querySelector('.spj-row.sel') && document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length === 5), 'E: Umschalter „Bei „Rikscha““ – andere Liste, keine Markierung übernommen');

  // ---- F: in „Bei Rikscha“: Häkchen oben = alle → „zweckungebunden“ (von Hand; dort ist kein Ziel vorbelegt); dann wieder „nicht festgelegt (automatisch)“
  await p.click('.spj-lh .spj-all'); await p.waitForTimeout(100);
  const f0 = await bar();
  ok(f0.all === 'alle' && f0.info === '5 Spenden markiert · 150,00 €' && f0.target === '' && f0.dis, 'F: Häkchen oben markiert alle 5; in „Bei …“ ist kein Ziel vorbelegt');
  await move('-');
  const f1 = await p.evaluate(() => [Object.values(D.spenden.zweck).filter(v => v === '-').length, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length]);
  ok(f1[0] === 5 && f1[1] === 0, 'F: alle 5 von Hand auf „zweckungebunden“ – die Liste „Bei Rikscha“ ist leer');
  await p.click('.spj-lv [data-lv="frei"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length === 12 && !document.querySelector('[data-sec="sp-zu"] .spj-row .sp-tag.hand') && document.querySelectorAll('[data-sec="sp-zu"] .spj-row.hand').length === 5),
    'F: in „Zweckungebunden“ stehen jetzt alle 12 – ohne Kennzeichen „von Hand“');
  for (const n of ['Probe A', 'Probe B']) await clickRow(n);
  await move('*');
  const f3 = await p.evaluate(() => [Object.values(D.spenden.zweck).filter(v => v === '-').length, spjCompute(2027).list.filter(e => e.z === 'zr').length, document.querySelector('#toasts').textContent]);
  ok(f3[0] === 3 && f3[1] === 2 && /2 Spenden wieder automatisch/.test(f3[2]), 'F: „nicht festgelegt (automatisch)“ – A und B fallen wieder unter die Regel „Rikscha“');
  await clickRow('Probe L'); await p.click('.spj-act .spj-selx'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => !document.querySelector('.spj-row.sel')) && !(await bar()).on, 'F: „Auswahl aufheben“ – Markierung und Leiste weg');

  // ---- G: Reihenfolge der Zwecke per Ziehen in der Seitenleiste; ⋯ → „Nach oben“; Strg+Z
  await p.dragAndDrop('.spj-zi[data-z="zw"]', '.spj-zi[data-z="zr"]', { targetPosition: { x: 40, y: 3 } }); await p.waitForTimeout(250);
  ok(await p.evaluate(() => D.zwecke.map(z => z.name).join() === 'Wärmebus,Rikscha' && [...document.querySelectorAll('.spj-zi')].slice(0, 2).map(e => e.dataset.z).join() === 'zw,zr'), 'G: „Wärmebus“ nach oben gezogen – Reihenfolge Wärmebus, Rikscha');
  await p.click('.spj-zi[data-z="zr"]'); await p.waitForTimeout(150);
  await p.click('.spj-zmenu .menu-btn'); await p.click('.menu button:has-text("Nach oben")'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => D.zwecke.map(z => z.name).join() === 'Rikscha,Wärmebus'), 'G: ⋯ → „Nach oben“ setzt Rikscha wieder an den Anfang');
  // umbenennen im Kopf
  await p.fill('.spj-zh .spj-name', 'Rikscha-Fahrten'); await p.press('.spj-zh .spj-name', 'Enter'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => D.zwecke[0].name === 'Rikscha-Fahrten' && document.querySelector('.spj-zi[data-z="zr"] .spj-zn').textContent.trim() === 'Rikscha-Fahrten'), 'G: Name oben ändern + Enter benennt den Zweck um (auch links)');
  await finish(b, pages);
})();
