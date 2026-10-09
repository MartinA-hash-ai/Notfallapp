// 0.16 Auswertung „Spenden 2027“: alle Spenden des Jahres, Spendenzwecke (Schlagworte, Konten, Klärfälle, von Hand), Gliederungen, Daueraufträge, Herkunft, PDF
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
// erfundene Buchungen: [Datum, Betrag, Name, IBAN-Nr., Verwendungszweck, Dauerauftrag?, Konto]
const R = [['10.01.2027', 50, 'Anna Probe', 1, 'Spende Hospizdienst', 0, 'Gütersloh'], ['15.02.2027', 100, 'Bernd Probe', 2, 'Herzenswunsch Krankenwagen', 0, 'DGS Paderborn'],
  ['20.03.2027', 30, 'Carla Dauer', 3, 'Spende', 1, 'Lage'], ['20.04.2027', 30, 'Carla Dauer', 3, 'Spende', 1, 'Lage'], ['05.05.2027', 200, 'Dora Probe', 4, 'Kondolenz Trauerfall', 0, 'Hospiz Dortmund'],
  ['06.06.2027', 80, 'Emil Probe', 5, 'Hospiz Herzenswunsch', 0, 'Hospiz Dortmund'], ['07.07.2027', 40, 'Frida Probe', 6, 'Herzenswunsch', 0, 'Gütersloh'], ['08.08.2027', 25, 'Gerd Probe', 7, 'Allgemein', 0, 'DGS Paderborn'],
  ['30.12.2026', 999, 'Vorjahr Probe', 8, 'Hospiz', 0, 'Lage']];
const line = ([d, b, name, i, zw, da, k]) => [d, d, String(b), "'TESTDE11XXX", 'DE0010000000000000' + String(i).padStart(4, '0'), name, "'Zugang/Gutschrift", zw, da ? "'Dauerauftragsgutschr" : "'Spendengutschrift", "'Paderborn - " + k].join(';');
const csv = '﻿' + [HEAD, ...R.map(line)].join('\r\n') + '\r\n';

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/export.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv);
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'allg:2027'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length === 9); await p.waitForTimeout(300);
  const tile = () => p.evaluate(() => [...document.querySelectorAll('.spj-tiles .sp-tile')].map(t => t.querySelector('.sp-tv').textContent + ' | ' + (t.querySelector('.sp-ts') || {}).textContent));
  const ztab = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.spj-box:first-child .spj-t tbody tr')].map(r => [r.dataset.z === '-' ? 'frei' : r.dataset.z === '?' ? 'offen' : r.querySelector('.spj-nm').textContent, r.children[1].textContent + '/' + r.children[2].textContent])));
  const zid = name => p.evaluate(n => D.zwecke.find(z => z.name === n).id, name);
  const move = async v => { await p.selectOption('.spj-act .spj-move', v); await p.click('.spj-act .spj-go'); await p.waitForTimeout(250); };   // markierte Spenden verschieben

  // ---- A: erste Zeile „Spenden 2027“ = alle Spenden des Jahres; Kacheln mit Daueraufträgen; Gliederungen ohne „Paderborn - “
  const a0 = await p.evaluate(() => { const r = document.querySelector('.sp-ueb tbody tr'); return [r.dataset.mid, r.querySelector('.sp-unm').textContent, r.children[5].textContent, r.children[6].textContent, document.querySelector('[data-sec="sp-m"] .sec-t').textContent, document.querySelector('[data-sec="sp-zu"] .sec-t').textContent]; });
  ok(a0[0] === 'allg:2027' && a0[1] === 'Spenden 2027' && a0[2] === '555 €' && a0[3] === '8' && a0[4] === 'Spenden 2027' && a0[5] === 'Spendenzwecke zuordnen' && await p.evaluate(() => !document.querySelector('.sp-col')),
    'A: Übersicht beginnt mit „Spenden 2027“ (555 € aus 8 – ohne die Vorjahresbuchung); darunter „' + a0[5] + '“');
  const a1 = await tile();
  ok(a1[0] === '555 € | 8 Spenden · 7 Spender:innen' && /^69,38 € \| Median 45,00 €/.test(a1[1]) && /^60 € \| 2 Buchungen · 1 Spender:in · 10,8 % der Summe/.test(a1[2]), 'A: Kacheln – ' + a1.slice(0, 3).join(' ; '));
  const a2 = await p.evaluate(() => [...document.querySelectorAll('.spj-box:nth-child(2) .spj-t tbody tr')].map(r => r.children[0].textContent + ' ' + r.children[2].textContent).join(', '));
  ok(a2 === 'Hospiz Dortmund 280 €, DGS Paderborn 125 €, Gütersloh 90 €, Lage 60 €', 'A: Gliederungen nach Summe, ohne „Paderborn - “: ' + a2);
  ok(await p.evaluate(() => [...document.querySelectorAll('.sp-chart[data-chart="ycum"] svg, .sp-chart[data-chart="yweek"] svg')].length === 2 && document.querySelectorAll('.spj-b1, .spj-b2').length >= 8), 'A: Jahresverlauf und Wochen-Säulen (Einzelspenden / Daueraufträge) gezeichnet');
  const a3 = await p.evaluate(() => { const n = C.ms.filter(x => x.pal != null && x.pal >= mkdn(2027, 1, 1) && x.pal <= mkdn(2027, 12, 31)).length, h = document.querySelector('[data-chart="yweek"] .spj-palhit');
    return [n, document.querySelectorAll('[data-chart="ycum"] .spj-palhit').length, document.querySelectorAll('[data-chart="yweek"] .spj-palhit').length, +h.getAttribute('width'), +h.getAttribute('height')]; });
  ok(a3[0] > 0 && a3[1] === a3[0] && a3[2] === a3[0] && a3[3] >= 20 && a3[4] >= 20, 'A: PAL-Punkte in beiden Grafiken (' + a3[0] + ' je Grafik), Trefferfläche ' + a3[3] + '×' + a3[4] + ' px');
  const hb = await p.evaluate(() => { const r = document.querySelector('[data-chart="ycum"] .spj-palhit').getBoundingClientRect(); return [r.x + r.width / 2, r.y + 3]; });
  await p.evaluate(() => document.querySelector('[data-chart="ycum"]').scrollIntoView());
  const hb2 = await p.evaluate(() => { const r = document.querySelector('[data-chart="ycum"] .spj-palhit').getBoundingClientRect(); return [r.x + r.width / 2, r.y + 3]; });
  await p.mouse.move(hb2[0], hb2[1]); await p.waitForTimeout(350);
  ok(await p.evaluate(() => /PAL /.test((document.querySelector('#tip') || {}).textContent || '')), 'A: Hinzeigen auf einen PAL-Punkt (Rand der Trefferfläche) zeigt Maßnahme und PAL');
  await p.mouse.move(5, 5);

  // ---- B: Zweck anlegen, umbenennen, Schlagwort mit Vorschau
  await p.click('.spj-add'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => D.zwecke.length === 1 && document.activeElement === document.querySelector('.spj-name') && !!document.querySelector('.spj-rules .sp-wordin') && document.querySelector('.spj-zi.on .spj-zn').textContent === 'Neuer Zweck'), 'B: „+ Zweck“ legt einen Zweck an, wählt ihn links, Name oben markiert');
  await p.fill('.spj-name', 'Hospizarbeit'); await p.press('.spj-name', 'Tab'); await p.waitForTimeout(200);
  await p.click('.spj-rules .sp-wordin'); await p.keyboard.type('Hospiz*'); await p.waitForTimeout(450);
  const b1 = await p.evaluate(() => [document.querySelector('.spj-lh').textContent, document.querySelectorAll('.spj-row').length, document.activeElement.classList.contains('sp-wordin')]);
  ok(/Vorschau „Hospiz\*“2 Spenden zweckungebunden \(130,00 €\)\+ zu „Hospizarbeit“\+ als neuer Zweck/.test(b1[0]) && b1[1] === 2 && b1[2], 'B: Vorschau beim Tippen im Kopf der Liste: ' + b1[0].split('Namen')[0] + ' – Liste zeigt sie, Fokus bleibt');
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  ok(JSON.stringify(await p.evaluate(() => D.zwecke[0])) .includes('"name":"Hospizarbeit"') && (await ztab())['Hospizarbeit'] === '2/130 €', 'B: Enter übernimmt Hospiz* – Hospizarbeit zählt 2 Spenden (130 €)');

  // ---- C: Konto dazu – alle Spenden aufs Hospizkonto zählen mit
  await p.selectOption('.spj-addsel', 'k:Paderborn - Hospiz Dortmund'); await p.waitForTimeout(250);
  const c0 = await ztab();
  ok(c0['Hospizarbeit'] === '3/330 €' && c0.frei === '5/225 €' && await p.evaluate(() => document.querySelector('.sp-word.konto').textContent.startsWith('Konto Hospiz Dortmund')), 'C: Konto „Hospiz Dortmund“ – Hospizarbeit 3 (330 €), zweckungebunden 5 (225 €)');

  // ---- D: zweiter Zweck mit Überschneidung → „zu klären“; per Klick entscheiden; Strg+Z; alle angezeigten festlegen
  await p.click('.spj-add'); await p.waitForTimeout(250);
  await p.fill('.spj-name', 'Herzenswunsch-Krankenwagen'); await p.press('.spj-name', 'Tab'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('[data-sec="sp-zu"]').scrollIntoView()); await p.waitForTimeout(100);
  const y0 = await p.evaluate(() => [scrollY, document.querySelector('.spj-list').offsetHeight, Math.round(document.querySelector('.spj-rules').getBoundingClientRect().top)]);
  await p.click('.spj-rules .sp-wordin'); await p.keyboard.type('Herzenswunsch'); await p.waitForTimeout(450);
  const d00 = await p.evaluate(() => [document.querySelector('.spj-lh').textContent, [...document.querySelectorAll('.spj-row')].map(r => SP.byKey.get(r.dataset.k).name).sort().join(','),
    scrollY, document.querySelector('.spj-list').offsetHeight, Math.round(document.querySelector('.spj-rules').getBoundingClientRect().top)]);
  ok(/2 Spenden zweckungebunden \(140,00 €\) · 1 weitere schon erfasst/.test(d00[0]) && d00[1] === 'Bernd Probe,Frida Probe', 'D: Vorschau zeigt nur Spenden ohne Zweck (' + d00[1] + ') – die schon bei „Hospizarbeit“ erfasste nicht');
  ok(d00[2] === y0[0] && d00[3] === y0[1] && d00[4] === y0[2], 'D: beim Tippen bleibt die Seite stehen – Liste gleich hoch (' + d00[3] + ' px), Fensterposition unverändert ' + JSON.stringify([y0, d00.slice(2)]));
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const d0 = await ztab();
  ok(d0['Hospizarbeit'] === '2/250 €' && d0['Herzenswunsch-Krankenwagen'] === '2/140 €' && d0.offen === '1/80 €' && d0.frei === '3/85 €', 'D: Überschneidung (Hospiz + Herzenswunsch) steht unter „zu klären“: ' + JSON.stringify(d0));
  ok(await p.evaluate(() => { SPJ.z = null; renderNow(); return /1 zu klären/.test(document.querySelectorAll('.spj-tiles .sp-tile')[3].textContent); }), 'D: Kachel „Zweckgebunden“ weist auf den Klärfall hin (ohne gewählten Zweck)');
  await p.click('.spj-t tr[data-z="?"]'); await p.waitForTimeout(250);
  const d1 = await p.evaluate(() => [...document.querySelectorAll('.spj-row .spj-pick')].map(b => b.textContent).join(','));
  ok(d1 === '→ Hospizarbeit,→ Herzenswunsch-Krankenwagen', 'D: Klärfall zeigt beide Zwecke zur Wahl (' + d1 + ')');
  await p.click('.spj-row .spj-pick'); await p.waitForTimeout(250);
  const hz = await zid('Hospizarbeit'), hw = await zid('Herzenswunsch-Krankenwagen');
  const d2 = await ztab();
  ok(d2['Hospizarbeit'] === '3/330 €' && !d2.offen && await p.evaluate(id => Object.values(D.spenden.zweck).join() === id, hz), 'D: Klick „→ Hospizarbeit“ – von Hand festgelegt, kein Klärfall mehr');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
  ok((await ztab()).offen === '1/80 €' && await p.evaluate(() => !Object.keys(D.spenden.zweck).length), 'D: Strg+Z macht die Entscheidung rückgängig');
  await p.click('.spj-t tr[data-z="?"]'); await p.waitForTimeout(150);
  if (!(await p.evaluate(() => SPJ.z === '?'))) { await p.click('.spj-t tr[data-z="?"]'); await p.waitForTimeout(150); }
  await p.click('.spj-lh .spj-all'); await move(hw);
  const d3 = await ztab();
  ok(d3['Herzenswunsch-Krankenwagen'] === '3/220 €' && !d3.offen, 'D: Häkchen „alle“ + „Verschieben“ ordnet den Klärfall dem gewählten Zweck zu');
  // einzelne Spende von Hand umhängen und wieder automatisch
  await p.click('.spj-t tr[data-z="' + hz + '"]'); await p.waitForTimeout(200);
  // Zweck gewählt: unten stehen immer die Spenden noch ohne Zweck – Zeile anklicken, die Leiste unten hat den Zweck schon als Ziel
  const l0 = await p.evaluate(() => [[...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].map(r => SP.byKey.get(r.dataset.k).name).sort().join(','),
    document.querySelectorAll('[data-sec="sp-zu"] .spj-row .spj-to').length, document.querySelector('.spj-lv .seg-btn.on').textContent]);
  ok(l0[0] === 'Carla Dauer,Carla Dauer,Gerd Probe' && l0[1] === 0 && /^Zweckungebunden \(3\)/.test(l0[2]), 'D: Zweck gewählt – die Liste zeigt standardmäßig alle zweckungebundenen Spenden (' + l0[0] + '), kein „→ Zweck“ mehr je Zeile');
  await p.evaluate(() => [...document.querySelectorAll('.spj-row')].find(r => SP.byKey.get(r.dataset.k).name === 'Gerd Probe').querySelector('.sp-z').click()); await p.waitForTimeout(100);
  ok(await p.evaluate(id => document.querySelector('.spj-act.on .spj-move').value === id && /^1 Spende markiert · 25,00 €/.test(document.querySelector('.spj-act').textContent), hz), 'D: Zeile angeklickt – Leiste unten mit Ziel „Hospizarbeit“ vorbelegt');
  await p.click('.spj-act .spj-go'); await p.waitForTimeout(250);
  const l1 = await p.evaluate(() => [document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length, Object.values(D.spenden.zweck).filter(v => v === D.zwecke[0].id).length]);
  ok(l1[0] === 2 && l1[1] === 1 && (await ztab())['Hospizarbeit'] === '3/275 €', 'D: „Verschieben“ ordnet zu – die Spende verschwindet aus der Liste, Hospizarbeit 3 (275 €)');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
  await p.click('.spj-lv [data-lv="zweck"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(id => [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].every(r => spjCompute(2027).list.find(e => e.rec.k === r.dataset.k).z === id) && document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length === 2, hz),
    'D: Umschalter „Bei „Hospizarbeit““ zeigt die schon zugeordneten Spenden');
  const k1 = await p.evaluate(() => document.querySelector('[data-sec="sp-zu"] .spj-row').dataset.k);
  await p.click('.spj-row[data-k="' + k1 + '"] .sp-d');
  ok(await p.evaluate(() => document.querySelector('.spj-act .spj-move').value === '' && document.querySelector('.spj-act .spj-go').disabled), 'D: in „Bei …“ ist kein Ziel vorbelegt (Verschieben gesperrt)');
  await move('-');
  ok((await ztab())['Hospizarbeit'] === '1/50 €' && await p.evaluate(k => D.spenden.zweck[k] === '-', k1), 'D: einzelne Spende von Hand auf „zweckungebunden“ gesetzt');
  await p.click('.spj-t tr[data-z="-"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(k => !!document.querySelector('.spj-row.hand[data-k="' + k + '"]') && !document.querySelector('.spj-row[data-k="' + k + '"] .sp-tag.hand'), k1), 'D: Zeile steht in „Zweckungebunden“ – ohne Kennzeichen „von Hand“');
  await p.click('.spj-row[data-k="' + k1 + '"] .sp-d'); await move('*');
  ok((await ztab())['Hospizarbeit'] === '2/250 €' && await p.evaluate(k => !(k in D.spenden.zweck), k1), 'D: „nicht festgelegt (automatisch)“ hebt die Festlegung wieder auf');

  // ---- E: Summen gehen auf; Herkunft (aus Maßnahmen / ohne Maßnahme); Filter nach Gliederung
  const e0 = await ztab(), sum = Object.values(e0).reduce((t, v) => t + +v.split('/')[1].replace(/\D/g, ''), 0);
  ok(sum === 555, 'E: Zwecke + zweckungebunden = 555 € (' + JSON.stringify(e0) + ')');
  await p.evaluate(() => { const r = SP.rows.find(r => r.name === 'Bernd Probe'); commit(d => { d.spenden.zu[r.k] = { m: 'm5', d: ds(r.d), b: r.b }; }); SPJ.z = null; renderNow(); }); await p.waitForTimeout(200);
  await p.click('.spj-her .seg-btn:has-text("aus Maßnahmen")'); await p.waitForTimeout(250);
  const e1 = await tile(), e1l = await p.evaluate(() => [document.querySelector('.spj-lh b')?.textContent, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length]);
  await p.click('.spj-her .seg-btn:has-text("ohne Maßnahme")'); await p.waitForTimeout(250);
  const e2 = await tile();
  ok(/^100 € \| 1 Spende/.test(e1[0]) && /^455 € \| 7 Spenden/.test(e2[0]), 'E: Herkunft – aus Maßnahmen ' + e1[0] + ' · ohne Maßnahme ' + e2[0]);
  ok(e1l[0] === 'Zweckungebunden' && e1l[1] === 3, 'E: die Zuordnungsliste zeigt trotz Herkunft-Filter alle zweckungebundenen (' + e1l[1] + ')');
  await p.click('.spj-her .seg-btn:has-text("alle Spenden")'); await p.waitForTimeout(200);
  await p.click('.spj-t tr[data-g="Paderborn - Lage"]'); await p.waitForTimeout(250);
  const e3 = await tile(), e4 = await p.evaluate(() => [document.querySelector('.spj-chip').textContent, document.querySelectorAll('.spj-row').length]);
  ok(/^60 € \| 2 Spenden/.test(e3[0]) && /^60 €/.test(e3[2]) && /Gliederung: Lage/.test(e4[0]) && e4[1] === 3, 'E: Klick auf „Lage“ filtert die Kacheln (60 €, beide Daueraufträge) – die Zuordnungsliste bleibt vollständig (' + e4[1] + ')');
  ok(await p.evaluate(() => { const w = document.querySelector('.spj-gscroll'); return getComputedStyle(w).maxHeight === '213px' && getComputedStyle(w).overflowY === 'auto'; }), 'E: Gliederungen-Tabelle höchstens 7 Zeilen hoch, Rest per Scrollen');
  await p.click('.spj-chip .sp-x'); await p.waitForTimeout(200);
  ok(/^555 €/.test((await tile())[0]), 'E: × hebt den Filter auf');

  // ---- F: gespeichert, normalize, Zusammenführen (beide legen Zwecke an), Protokoll
  const f0 = await p.evaluate(() => { const n = normalize(JSON.parse(JSON.stringify(D))); return [n.zwecke.map(z => z.name + ':' + z.worte.join('+') + ':' + z.konten.length).join(','), Object.keys(n.spenden.zweck).length]; });
  ok(f0[0] === 'Hospizarbeit:Hospiz*:1,Herzenswunsch-Krankenwagen:Herzenswunsch:0' && f0[1] === 1, 'F: normalize behält Zwecke und Festlegungen (' + f0[0] + ')');
  const f1 = await p.evaluate(() => {
    const base = JSON.parse(JSON.stringify(D)), mine = JSON.parse(JSON.stringify(D)), theirs = JSON.parse(JSON.stringify(D));
    mine.zwecke.push({ id: 'zm', name: 'Auslandshilfe', farbe: '#2CA02C', worte: ['Ausland*'], konten: [] });
    theirs.zwecke.push({ id: 'zt', name: 'Jugend', farbe: '#E6550D', worte: ['Jugend'], konten: [] }); theirs.spenden.zweck.x1 = 'zt';
    const r = merge3(base, mine, theirs), n = normalize(r.data);
    return [n.zwecke.map(z => z.name).sort().join(','), n.spenden.zweck.x1, r.conflicts.length];
  });
  ok(f1[0] === 'Auslandshilfe,Herzenswunsch-Krankenwagen,Hospizarbeit,Jugend' && f1[1] === 'zt' && f1[2] === 0, 'F: Zusammenführen – Zwecke beider Seiten bleiben (' + f1[0] + ')');
  ok(await p.evaluate(() => { const t = describeChanges(Object.assign({}, D, { zwecke: [], spenden: Object.assign({}, D.spenden, { zweck: {} }) }), D).join(' | '); return /Spendenzweck „Hospizarbeit“ angelegt/.test(t) && /den Zweck von Hand festgelegt/.test(t); }), 'F: Änderungsprotokoll nennt neue Zwecke und Festlegungen');

  // ---- G: PDF – „Spenden 2027“ auf zwei Seiten
  await p.evaluate(() => { window.print = () => {}; pdfDialog(); }); await p.waitForTimeout(250);
  await p.evaluate(() => { const s = document.querySelector('.modal .pdf-for select'); s.value = 'allg:2027'; s.dispatchEvent(new Event('change')); });
  const g0 = await p.evaluate(() => [[...document.querySelectorAll('.modal .pdf-for option')].map(o => o.textContent).pop(), document.querySelector('.pdf-count').textContent]);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(400);
  const g1 = await p.evaluate(() => [[...document.querySelectorAll('#printdoc .pd-head h1')].map(e => e.textContent).join(' | '), document.querySelectorAll('#printdoc .pd-spj .spj-t tbody tr').length,
    document.querySelectorAll('#printdoc [data-chart="ycum"] svg, #printdoc [data-chart="yweek"] svg').length, document.querySelectorAll('#printdoc .spj-sel, #printdoc .spj-ed').length]);
  ok(g0[0] === 'Spenden 2027' && /3 Seiten/.test(g0[1]) && g1[0] === 'Auswertung 2027 | Auswertung · Spenden 2027 | Spenden 2027 · Zwecke und Gliederungen' && g1[1] === 3 + 4 && g1[2] === 2 && g1[3] === 0,
    'G: PDF – ' + g1[0] + ' (' + g0[1] + '); Tabellen der Zwecke und Gliederungen, beide Grafiken');
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  // ---- H: Zweck löschen (mit Rückfrage) nimmt seine Festlegungen mit
  await p.evaluate(() => { SPJ.z = D.zwecke[1].id; renderNow(); }); await p.waitForTimeout(150);
  await p.click('.spj-zmenu .menu-btn'); await p.click('.menu button:has-text("Zweck löschen")'); await p.waitForTimeout(150);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(250);
  const h0 = await ztab();
  ok(await p.evaluate(() => D.zwecke.length === 1 && !Object.keys(D.spenden.zweck).length) && h0.frei === '5/225 €', 'H: Zweck gelöscht – Festlegungen weg, seine Spenden wieder zweckungebunden (' + JSON.stringify(h0) + ')');

  // ---- I: alle Spenden einer Maßnahme einem Zweck zuordnen (auch ohne Schlagwort im Verwendungszweck)
  await p.evaluate(() => { SPJ.z = null; SPJ.g = null; UI.spHer = 'alle'; renderNow(); }); await p.waitForTimeout(150);
  await p.click('.spj-add'); await p.waitForTimeout(250);
  await p.fill('.spj-name', 'Mailing-Zweck'); await p.press('.spj-name', 'Tab'); await p.waitForTimeout(200);
  const mName = await p.evaluate(() => C.byId.get('m5').m.name);
  const i0 = await p.evaluate(() => [...document.querySelectorAll('.spj-addsel option')].map(o => o.value));
  await p.selectOption('.spj-addsel', 'm:m5'); await p.waitForTimeout(250);
  const i1 = await ztab();
  ok(i0.includes('m:m5') && i1['Mailing-Zweck'] === '1/100 €' && await p.evaluate(() => D.zwecke[1].massnahmen.join() === 'm5' && /•?/.test(document.querySelector('.sp-word.mass').textContent)),
    'I: Maßnahme „' + mName + '“ hinzugefügt – ihre zugeordnete Spende zählt für den Zweck (1/100 €), obwohl kein Schlagwort passt');
  await p.evaluate(() => { const g = SP.rows.find(r => r.name === 'Gerd Probe'); commit(d => { d.spenden.zu[g.k] = { m: 'm5', d: ds(g.d), b: g.b }; }); }); await p.waitForTimeout(250);
  const i2 = await ztab();
  ok(i2['Mailing-Zweck'] === '2/125 €' && i2.frei === '3/100 €', 'I: später der Maßnahme zugeordnete Spenden zählen automatisch mit (2/125 €)');
  await p.click('.spj-lv [data-lv="zweck"]'); await p.waitForTimeout(200);
  const i3 = await p.evaluate(() => [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row .sp-tag.rule')].map(t => t.textContent).join(','));
  ok(i3 === 'Maßnahme ' + mName + ',Maßnahme ' + mName, 'I: in der Liste steht als Grund „Maßnahme …“ (' + i3 + ')');
  await p.evaluate(() => { const r = SP.rows.find(r => r.name === 'Dora Probe'); commit(d => { d.spenden.zu[r.k] = { m: 'm5', d: ds(r.d), b: r.b }; }); }); await p.waitForTimeout(250);
  ok((await ztab()).offen === '1/200 €', 'I: Spende der Maßnahme, die auch zum Hospizkonto passt, steht unter „zu klären“');
  ok(await p.evaluate(() => { const c = JSON.parse(JSON.stringify(D)); c.zwecke[1].massnahmen.push('gibtsnicht'); return normalize(c).zwecke[1].massnahmen.join(); }) === 'm5', 'I: normalize behält die Maßnahme, verwirft unbekannte');
  await finish(b, pages);
})();
