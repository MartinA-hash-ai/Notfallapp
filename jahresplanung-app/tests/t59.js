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

  // ---- A: erste Zeile „Spenden 2027“ = alle Spenden des Jahres; Kacheln mit Daueraufträgen; Gliederungen ohne „Paderborn - “
  const a0 = await p.evaluate(() => { const r = document.querySelector('.sp-ueb tbody tr'); return [r.dataset.mid, r.querySelector('.sp-unm').textContent, r.children[5].textContent, r.children[6].textContent, document.querySelector('[data-sec="sp-m"] .sec-t').textContent, document.querySelector('[data-sec="sp-zu"] .sec-t').textContent]; });
  ok(a0[0] === 'allg:2027' && a0[1] === 'Spenden 2027' && a0[2] === '555 €' && a0[3] === '8' && a0[4] === 'Spenden 2027' && /Allgemeine Spenden \(ohne Maßnahme\) zuordnen/.test(a0[5]),
    'A: Übersicht beginnt mit „Spenden 2027“ (555 € aus 8 – ohne die Vorjahresbuchung); darunter „' + a0[5] + '“');
  const a1 = await tile();
  ok(a1[0] === '555 € | 8 Spenden · 7 Spender:innen' && /^69,38 € \| Median 45,00 €/.test(a1[1]) && /^60 € \| 2 Buchungen · 1 Spender:in · 10,8 % der Summe/.test(a1[2]), 'A: Kacheln – ' + a1.slice(0, 3).join(' ; '));
  const a2 = await p.evaluate(() => [...document.querySelectorAll('.spj-box:nth-child(2) .spj-t tbody tr')].map(r => r.children[0].textContent + ' ' + r.children[2].textContent).join(', '));
  ok(a2 === 'Hospiz Dortmund 280 €, DGS Paderborn 125 €, Gütersloh 90 €, Lage 60 €', 'A: Gliederungen nach Summe, ohne „Paderborn - “: ' + a2);
  ok(await p.evaluate(() => [...document.querySelectorAll('.sp-chart[data-chart="ycum"] svg, .sp-chart[data-chart="yweek"] svg')].length === 2 && document.querySelectorAll('.spj-b1, .spj-b2').length >= 8), 'A: Jahresverlauf und Wochen-Säulen (Einzelspenden / Daueraufträge) gezeichnet');

  // ---- B: Zweck anlegen, umbenennen, Schlagwort mit Vorschau
  await p.click('.spj-add'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => D.zwecke.length === 1 && document.activeElement === document.querySelector('.spj-name') && !!document.querySelector('.spj-ed')), 'B: „+ Zweck“ legt einen Zweck an, öffnet ihn, Name markiert');
  await p.fill('.spj-name', 'Hospizarbeit'); await p.press('.spj-name', 'Tab'); await p.waitForTimeout(200);
  await p.click('.spj-ed .sp-wordin'); await p.keyboard.type('Hospiz*'); await p.waitForTimeout(450);
  const b1 = await p.evaluate(() => [document.querySelector('.spj-prev').textContent, document.querySelectorAll('.spj-row').length, document.activeElement.classList.contains('sp-wordin')]);
  ok(/„Hospiz\*“ passt zu 2 Spenden \(130 €\)/.test(b1[0]) && b1[1] === 2 && b1[2], 'B: Vorschau beim Tippen: ' + b1[0] + ' – Liste zeigt sie, Fokus bleibt');
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  ok(JSON.stringify(await p.evaluate(() => D.zwecke[0])) .includes('"name":"Hospizarbeit"') && (await ztab())['Hospizarbeit'] === '2/130 €', 'B: Enter übernimmt Hospiz* – Hospizarbeit zählt 2 Spenden (130 €)');

  // ---- C: Konto dazu – alle Spenden aufs Hospizkonto zählen mit
  await p.selectOption('.spj-konto', 'Paderborn - Hospiz Dortmund'); await p.waitForTimeout(250);
  const c0 = await ztab();
  ok(c0['Hospizarbeit'] === '3/330 €' && c0.frei === '5/225 €' && await p.evaluate(() => document.querySelector('.sp-word.konto').textContent.startsWith('Hospiz Dortmund')), 'C: Konto „Hospiz Dortmund“ – Hospizarbeit 3 (330 €), zweckungebunden 5 (225 €)');

  // ---- D: zweiter Zweck mit Überschneidung → „zu klären“; per Klick entscheiden; Strg+Z; alle angezeigten festlegen
  await p.click('.spj-add'); await p.waitForTimeout(250);
  await p.fill('.spj-name', 'Herzenswunsch-Krankenwagen'); await p.press('.spj-name', 'Tab'); await p.waitForTimeout(200);
  await p.click('.spj-ed .sp-wordin'); await p.keyboard.type('Herzenswunsch'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
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
  await p.selectOption('.spj-listbox .sp-ch .spj-zsel', hw); await p.waitForTimeout(250);
  const d3 = await ztab();
  ok(d3['Herzenswunsch-Krankenwagen'] === '3/220 €' && !d3.offen, 'D: „alle angezeigten festlegen …“ ordnet den Klärfall dem gewählten Zweck zu');
  // einzelne Spende von Hand umhängen und wieder automatisch
  await p.click('.spj-t tr[data-z="' + hz + '"]'); await p.waitForTimeout(200);
  const k1 = await p.evaluate(() => document.querySelector('.spj-row').dataset.k);
  await p.selectOption('.spj-row[data-k="' + k1 + '"] .spj-zsel', '-'); await p.waitForTimeout(250);
  ok((await ztab())['Hospizarbeit'] === '1/50 €' && await p.evaluate(k => D.spenden.zweck[k] === '-', k1), 'D: einzelne Spende von Hand auf „zweckungebunden“ gesetzt');
  await p.click('.spj-t tr[data-z="-"]'); await p.waitForTimeout(200);
  await p.selectOption('.spj-row[data-k="' + k1 + '"] .spj-zsel', ''); await p.waitForTimeout(250);
  ok((await ztab())['Hospizarbeit'] === '2/250 €' && await p.evaluate(k => !(k in D.spenden.zweck), k1), 'D: „automatisch“ hebt die Festlegung wieder auf');

  // ---- E: Summen gehen auf; Herkunft (aus Maßnahmen / ohne Maßnahme); Filter nach Gliederung
  const e0 = await ztab(), sum = Object.values(e0).reduce((t, v) => t + +v.split('/')[1].replace(/\D/g, ''), 0);
  ok(sum === 555, 'E: Zwecke + zweckungebunden = 555 € (' + JSON.stringify(e0) + ')');
  await p.evaluate(() => { const r = SP.rows.find(r => r.name === 'Bernd Probe'); commit(d => { d.spenden.zu[r.k] = { m: 'm5', d: ds(r.d), b: r.b }; }); SPJ.z = null; renderNow(); }); await p.waitForTimeout(200);
  await p.click('.spj-her .seg-btn:has-text("aus Maßnahmen")'); await p.waitForTimeout(250);
  const e1 = await tile();
  await p.click('.spj-her .seg-btn:has-text("ohne Maßnahme")'); await p.waitForTimeout(250);
  const e2 = await tile();
  ok(/^100 € \| 1 Spende/.test(e1[0]) && /^455 € \| 7 Spenden/.test(e2[0]), 'E: Herkunft – aus Maßnahmen ' + e1[0] + ' · ohne Maßnahme ' + e2[0]);
  await p.click('.spj-her .seg-btn:has-text("alle Spenden")'); await p.waitForTimeout(200);
  await p.click('.spj-t tr[data-g="Paderborn - Lage"]'); await p.waitForTimeout(250);
  const e3 = await tile(), e4 = await p.evaluate(() => [document.querySelector('.spj-chip').textContent, document.querySelectorAll('.spj-row').length]);
  ok(/^60 € \| 2 Spenden/.test(e3[0]) && /^60 €/.test(e3[2]) && /Gliederung: Lage/.test(e4[0]) && e4[1] === 2, 'E: Klick auf „Lage“ filtert Kacheln und Liste (60 €, beide Daueraufträge)');
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
  await p.click('.spj-del'); await p.waitForTimeout(150);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(250);
  const h0 = await ztab();
  ok(await p.evaluate(() => D.zwecke.length === 1 && !Object.keys(D.spenden.zweck).length) && h0.frei === '5/225 €', 'H: Zweck gelöscht – Festlegungen weg, seine Spenden wieder zweckungebunden (' + JSON.stringify(h0) + ')');
  await finish(b, pages);
})();
