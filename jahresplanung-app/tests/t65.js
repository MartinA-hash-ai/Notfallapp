// 0.42 Zusammenfassung „Buchungen hinzugefügt“: oben das Ergebnis (grün / orange), „Was kam hinzu“ als Zeitstrahl je Datei, je Punkt eine Zeile
// (Auffälligkeiten, schon da mit Liste, lückenlos, per Regel → Prüfen); Liste der neuen Spenden eingeklappt; Bericht kopieren
// 0.47: Zuordnungen in zwei Bereichen (Maßnahmen | Spendenzwecke) und Schritt für Schritt im Fenster prüfen – Häkchen weg = gehört nicht dazu, „zu klären“ mit Auswahl, überspringen, Abschluss
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const p2 = x => String(x).padStart(2, '0');
const L = (d, b, i, zw, k = 'Paderborn - Lage') => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000' + String(i).padStart(6, '0'), 'Probe ' + i, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'" + k].join(';');
const mk = (m, from, to) => { const r = []; for (let t = from; t <= to; t++) r.push(L(p2(t) + '.' + p2(m) + '.2023', 10 + t, m * 100 + t, t % 3 ? 'Spende für die Hospizarbeit in Lage, herzlichen Dank und viele Grüße an das ganze Team' : 'Spende Rikscha')); return r; };
const csv = r => '﻿' + [HEAD, ...r].join('\r\n') + '\r\n';

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1300, height: 950 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(() => commit(d => { d.zwecke.push({ id: 'zr', name: 'Rikscha', farbe: '#2e7d32', worte: ['Rikscha'], konten: [], massnahmen: [] }); }));
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2023/jan.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv(mk(1, 2, 31)));
  await p.evaluate(() => { UI.year = 2023; UI.view = 'spenden'; renderNow(); spScan({ manual: true }); }); await p.waitForFunction(() => SP.rows.length === 30); await p.waitForTimeout(300);
  await p.evaluate(() => { for (const e of spjCompute(2023).list) if (e.neu) spUnflag(D, e.rec.k, 'z'); renderNow(); });       // Januar schon geprüft
  // neu: Januar ab dem 20. noch einmal (überschneidet die vorhandene Datei), Februar, März mit Ende Februar (überschneidet Februar – beide neu)
  const files = { 'jan_nochmal.csv': csv(mk(1, 20, 31)), 'feb.csv': csv(mk(2, 1, 28)), 'mrz.csv': csv([...mk(2, 25, 28), ...mk(3, 1, 31)]) };
  await p.evaluate(fs => spAddFiles(Object.entries(fs).map(([n, t]) => new File([t], n))), files);
  await p.waitForSelector('.modal .sp-ar'); await p.waitForTimeout(400);
  const st = () => p.evaluate(() => { const m = document.querySelector('.modal'); return m && {
    res: m.querySelector('.sp-ar-res').textContent, warn: m.querySelector('.sp-ar-res').classList.contains('warn'),
    lanes: [...m.querySelectorAll('.sp-ar-lane')].filter(l => l.querySelector('.sp-ar-nm')).map(l => l.querySelector('.sp-ar-nm').textContent + ':' + [...l.querySelectorAll('.sp-ar-seg')].map(g => g.className.replace('sp-ar-seg ', '')).join('+') + ':' + l.querySelector('.sp-ar-rt').textContent),
    axis: [...m.querySelectorAll('.sp-ar-axis .ax span')].map(e => e.textContent).join('|'), key: [...m.querySelectorAll('.sp-ar-key > span')].map(e => e.textContent).join('|'),
    rows: [...m.querySelectorAll('.sp-ar-row')].map(r => (r.classList.contains('warn') ? '!' : r.classList.contains('todo') ? '●' : r.classList.contains('none') ? '–' : '✓') + ' ' + r.querySelector('.sp-ar-tx').textContent),
    list: !!m.querySelector('.sp-addlist'),
    asg: [...m.querySelectorAll('.sp-ar-col')].map(c => c.querySelector('.sp-ar-ch').textContent + ':' + [...c.querySelectorAll('.sp-ar-trow')].map(r => r.textContent).join(',')).join(' | ') }; });

  // ---- A: Ergebnis grün, Zeitstrahl je Datei (neu / schon da), Achse, Legende nur mit dem, was vorkommt
  const a0 = await st();
  ok(a0.res === '✓59 neue Spenden · 1.492,00 €01.02.–31.03.2023 · aus 3 Dateien' && !a0.warn, 'A: oben das Ergebnis, grün: ' + a0.res);
  ok(a0.lanes.join(' | ') === 'bisher eingelesen:old:02.01.–31.01.2023 | jan_nochmal.csv:dup:alle 12 schon da | feb.csv:new:28 neu | mrz.csv:new+dup:31 neu · 4 schon da',
    'A: „Was kam hinzu“ – bisher eingelesen, je Datei neu (blau) und schon da (schraffiert): ' + a0.lanes.join(' | '));
  ok(a0.axis === 'Jan|Feb|Mär' && a0.key === 'bisher eingelesen|schon da – zählt einmal|neu übernommen', 'A: Achse ' + a0.axis + ', Legende nur mit dem, was vorkommt: ' + a0.key);
  ok(a0.rows.join(' | ') === '✓ 16 Buchungen waren schon da – nicht doppelt gezählt | ✓ Eingelesen jetzt lückenlos vom 01.01. bis 31.03.2023' && !a0.list,
    'A: je Punkt eine Zeile; die Liste der neuen Spenden ist eingeklappt: ' + a0.rows.join(' | '));
  ok(a0.asg === 'Maßnahmen–: | Spendenzwecke19:Rikscha19' && await p.evaluate(() => document.querySelector('.sp-ar-start').textContent === 'Zuordnungen prüfen →'),
    'A: darunter zwei Bereiche – Maßnahmen (keine) | Spendenzwecke mit „Rikscha 19“, Knopf „Zuordnungen prüfen →“: ' + a0.asg);

  // ---- B: „Liste“ bei schon da – Datum, Betrag, Verwendungszweck, aus welcher Datei; neue Spenden aufklappen
  await p.click('.sp-ar-row .sp-ar-tog'); await p.waitForTimeout(200);
  const b0 = await p.evaluate(() => { const rows = [...document.querySelectorAll('.sp-ar-sub .sp-ar-t tr')]; return [rows.length, [...rows[0].children].map(c => c.textContent).join(' | ')]; });
  ok(b0[0] === 16 && /^20\.01\.2023 \| 30,00 € \| Spende für die Hospizarbeit.* \| auch in „jan\.csv“$/.test(b0[1]), 'B: „Liste“ – 16 Buchungen, die schon da waren: ' + b0[1].slice(0, 60) + ' …');
  await p.click('.sp-ar-row .sp-ar-tog'); await p.click('.sp-ar-foot .sp-ar-tog'); await p.waitForTimeout(200);
  const b1 = await p.evaluate(() => [document.querySelectorAll('.sp-ar-sub').length, document.querySelectorAll('.sp-addlist tr').length, document.querySelectorAll('.sp-addlist .sp-rchip').length, document.querySelector('.sp-ar-foot .sp-ar-tog').textContent]);
  ok(b1[0] === 0 && b1[1] === 59 && b1[2] === 19 && b1[3] === 'Die 59 neuen Spenden ansehen ▴', 'B: „Die 59 neuen Spenden ansehen“ klappt die Liste auf, 19 mit „Rikscha“ am Zeilenende');

  // ---- C: Bericht kopieren – Dateien, Zeiträume, Anzahl; ohne Namen, IBAN, Verwendungszweck
  await p.click('.sp-ar-copy'); await p.waitForTimeout(200);
  const rep = await p.evaluate(() => navigator.clipboard.readText().catch(() => '')).catch(() => '');
  ok(await p.evaluate(() => /Bericht kopiert – ohne Namen, IBAN und Verwendungszweck/.test(document.querySelector('#toasts').textContent)) && (!rep || (/Gleicher Zeitraum: „jan_nochmal\.csv“ und „jan\.csv“: 20\.01\.–31\.01\.2023 · 12 gleiche Buchungen/.test(rep) && !/Hospizarbeit|Probe|DE00/.test(rep))),
    'C: „Bericht kopieren“ – Dateien, Zeiträume, Anzahl; ohne Namen, IBAN und Verwendungszweck');

  // ---- D: Prüfen im Fenster – Schritt „Spendenzweck · Rikscha“, zwei abwählen → „17 bestätigen · 2 ohne Zweck“, Abschluss, zurück zur Übersicht
  await p.click('.sp-ar-start'); await p.waitForTimeout(200);
  const ds = () => p.evaluate(() => ({ stp: [...document.querySelectorAll('.sp-ar-stepper .sp-ar-sgrp')].map(g => g.textContent).join(' | '), area: document.querySelector('.sp-ar-area')?.textContent,
    name: document.querySelector('.sp-ar-st b')?.textContent, n: document.querySelectorAll('.sp-ar-list .sp-ar-sr:not(.head)').length, ok: document.querySelector('.sp-ar-ok')?.textContent,
    hl: document.querySelectorAll('.sp-ar-list mark.sp-hl').length, done: document.querySelector('.sp-ar-dt')?.textContent, sum: [...document.querySelectorAll('.sp-ar-dl')].map(e => e.textContent).join(' | ') }));
  const d0 = await ds();
  ok(d0.stp === 'SpendenzweckeRikscha19' && d0.area === 'Spendenzweck' && d0.name === 'Rikscha' && d0.n === 19 && d0.ok === '✓ 19 bestätigen' && d0.hl === 19,
    'D: Schritt „Spendenzweck · Rikscha“ – oben die Schritte, 19 Spenden mit Häkchen, das Schlagwort gelb: ' + JSON.stringify(d0));
  await p.click('.sp-ar-list .sp-ar-sr:not(.head) >> nth=0'); await p.click('.sp-ar-list .sp-ar-sr:not(.head) >> nth=1'); await p.waitForTimeout(150);
  const d1 = await ds(), off = await p.evaluate(() => [...document.querySelectorAll('.sp-ar-list .sp-ar-sr.off')].length);
  ok(d1.ok === '✓ 17 bestätigen · 2 ohne Zweck' && off === 2, 'D: zwei abgewählt – „' + d1.ok + '“, die Zeilen sind durchgestrichen');
  await p.click('.sp-ar-ok'); await p.waitForTimeout(250);
  const d2 = await ds(), d2d = await p.evaluate(() => [Object.values(D.spenden.zweck).filter(v => v === '-').length, spjCompute(2023).list.filter(e => e.z === 'zr' && e.neu).length, spjCompute(2023).list.filter(e => e.z === 'zr').length]);
  ok(d2.done === 'Alles geprüft' && d2.sum === 'Spendenzwecke17 bestätigt · 2 ohne Zweck' && d2d.join() === '2,0,27', 'D: bestätigt – „Alles geprüft“, Rikscha 27 (10 vom Januar + 17 neue, nicht mehr neu), 2 von Hand zweckungebunden ' + JSON.stringify([d2, d2d]));
  await p.click('.sp-ar-done .sp-ar-back'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /Rikscha✓/.test(document.querySelector('.sp-ar-asg').textContent) && !document.querySelector('.sp-ar-start') && /alles geprüft/.test(document.querySelector('.sp-ar-asg').textContent)),
    'D: zurück in der Übersicht – „Rikscha ✓“, „✓ alles geprüft“');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !Object.values(D.spenden.zweck).length && spjCompute(2023).list.filter(e => e.z === 'zr' && e.neu).length === 19), 'D: Strg+Z nimmt den Schritt zurück');
  await p.click('.modal footer button:has-text("Schließen")'); await p.waitForTimeout(150);

  // ---- E: Problemfall – gleicher Zeitraum desselben Kontos ohne gleiche Buchung, Datei nicht lesbar, Lücke; anderes Konto im selben Zeitraum ist normal
  const mkB = (m, from, to, k) => { const r = []; for (let t = from; t <= to; t++) r.push(L(p2(t) + '.' + p2(m) + '.2023', 50 + t, 9000 + m * 100 + t, 'Spende Wärmebus', k)); return r; };
  const files2 = { 'mrz_bank2.csv': csv(mkB(3, 27, 31)), 'konto_b.csv': csv(mkB(3, 20, 24, 'Paderborn - Brakel')), 'kaputt.xlsx': 'kein Excel', 'mai.csv': csv(mk(5, 2, 31)) };
  await p.evaluate(fs => spAddFiles(Object.entries(fs).map(([n, t]) => new File([t], n))), files2);
  await p.waitForSelector('.modal .sp-ar'); await p.waitForTimeout(400);
  const e0 = await st();
  ok(e0.warn && /^!\d+ neue Spenden · [\d.,]+ €20\.03\.–31\.05\.2023 · aus 3 von 4 Dateien – bitte 3 Punkte prüfen$/.test(e0.res), 'E: orange, „aus 3 von 4 Dateien – bitte 3 Punkte prüfen“: ' + e0.res);
  ok(e0.rows.slice(0, 3).join(' | ') === '! „mrz_bank2.csv“ und „mrz.csv“ haben beide den 27.03.–31.03.2023 – aber keine Buchung ist gleichvielleicht ein anderer Export der Bank – bitte prüfen, ob diese Tage jetzt doppelt zählen | ! „kaputt.xlsx“ ließ sich nicht lesenkeine gültige Excel-Datei – nichts davon übernommen | ! Lücke: vom 03.04. bis 01.05.2023 ist nichts eingelesen18 Werktage – fehlt eine Datei?'
    || /^! „mrz_bank2\.csv“ und „mrz\.csv“ haben beide den 27\.03\.–31\.03\.2023 – aber keine Buchung ist gleich.* \| ! „kaputt\.xlsx“ ließ sich nicht lesen.* \| ! Lücke: vom \d\d\.04\. bis \d\d\.05\.2023 ist nichts eingelesen/.test(e0.rows.slice(0, 3).join(' | ')),
    'E: die Auffälligkeiten stehen oben: ' + e0.rows.slice(0, 3).join(' | '));
  ok(!e0.rows.some(r => /konto_b/.test(r)) && e0.lanes.some(l => /^konto_b\.csv:new:5 neu$/.test(l)) && e0.lanes.some(l => /^mrz_bank2\.csv:new\+warn:5 neu · 5 Tage prüfen$/.test(l)) && e0.lanes.some(l => /^kaputt\.xlsx::–$/.test(l)) && /zu prüfen/.test(e0.key),
    'E: Zeitstrahl – „zu prüfen“ orange, die nicht lesbare Datei durchgestrichen; ein anderes Konto im selben Zeitraum ist keine Auffälligkeit: ' + e0.lanes.join(' | '));
  await p.click('.sp-ar-row.warn .sp-ar-tog'); await p.waitForTimeout(200);
  const e1 = await p.evaluate(() => [...document.querySelectorAll('.sp-ar-sub .sp-ar-t tr')].map(r => r.lastElementChild.textContent));
  ok(e1.length === 10 && e1.filter(t => t === 'in „mrz_bank2.csv“').length === 5 && e1.filter(t => t === 'in „mrz.csv“').length === 5, 'E: „Buchungen ansehen“ – die Buchungen beider Dateien in diesen Tagen (' + e1.length + ')');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);

  // ---- F: Maßnahme und Zweck zugleich – zwei Bereiche, „zu klären“ mit Auswahl, überspringen, „Weiter prüfen“
  await p.evaluate(() => commit(d => { for (const [id, nm, w] of [['hm', 'Hospizmailing 2023', 'Hospiz'], ['tm', 'Trauermailing 2023', 'Trauer']]) {
    const c = JSON.parse(JSON.stringify(d.massnahmen[0])); Object.assign(c, { id, name: nm, pal: '2023-06-01', regel: { worte: [w], ab: 0, bis: 60 } }); d.massnahmen.push(c); } }));
  const mkF = () => { const r = []; for (let t = 1; t <= 24; t++) r.push(L(p2(t) + '.06.2023', 20 + t, 60000 + t, t % 4 === 0 ? 'Hospiz Trauer' : t % 3 === 0 ? 'Spende Hospiz' : t % 3 === 1 ? 'Spende Rikscha' : 'Hospiz und Rikscha')); return r; };
  await p.evaluate(t => spAddFiles([new File([t], 'jun.csv')]), csv(mkF()));
  await p.waitForSelector('.modal .sp-ar'); await p.waitForTimeout(400);
  // 24 Spenden: 6× „Hospiz Trauer“ (zu klären), 6× „Hospiz“, 6× „Rikscha“, 6× „Hospiz und Rikscha“
  const f0 = await st(), f0n = await p.evaluate(() => document.querySelector('.sp-ar-asgf').textContent);
  ok(f0.asg === 'Maßnahmen18:Hospizmailing 202312,⚠zu klären6 | Spendenzwecke12:Rikscha12' && /6 in beiden Bereichen/.test(f0n),
    'F: Bereiche – Maßnahmen 18 (Hospizmailing 12, zu klären 6) | Spendenzwecke 12 (Rikscha 12), „6 in beiden Bereichen“: ' + f0.asg);
  await p.click('.sp-ar-start'); await p.waitForTimeout(200);
  const f1 = await ds();
  ok(f1.stp === 'MaßnahmenHospizmailing 202312⚠zu klären6 | SpendenzweckeRikscha12' && f1.area === 'Maßnahme' && f1.name === 'Hospizmailing 2023' && f1.n === 12, 'F: erst die Maßnahmen – Schritt „Hospizmailing 2023“ (12) ' + JSON.stringify(f1));
  await p.click('.sp-ar-ok'); await p.waitForTimeout(250);
  const f2 = await ds(), f2p = await p.evaluate(() => [document.querySelectorAll('.sp-ar-sr.kl').length, [...document.querySelector('.sp-ar-sr.kl .sp-ar-picks').children].map(b => b.textContent).join(','), document.querySelector('.sp-ar-ok').disabled]);
  ok(f2.area === 'Maßnahme · zu klären' && f2.name === 'Passt zu mehreren' && f2p.join('|') === '6|Hospizmailing 2023,Trauermailing 2023|true' && /Hospizmailing 2023✓/.test(f2.stp),
    'F: dann „zu klären“ – je Spende die Wahl Hospizmailing / Trauermailing, „zuordnen“ erst nach einer Wahl ' + JSON.stringify([f2, f2p]));
  await p.click('.sp-ar-sr.kl >> nth=0 >> .sp-ar-pick >> nth=1'); await p.click('.sp-ar-sr.kl >> nth=1 >> .sp-ar-pick >> nth=1'); await p.waitForTimeout(150);
  ok((await ds()).ok === '✓ 2 zuordnen', 'F: zwei gewählt – „✓ 2 zuordnen“');
  await p.click('.sp-ar-ok'); await p.waitForTimeout(250);
  const f3 = await ds(), f3d = await p.evaluate(() => [Object.values(D.spenden.zu).filter(z => z.m === 'tm').length, spCompute().konf.filter(r => r.d >= mkdn(2023, 6, 1)).length,
    Object.entries(D.spenden.zu).filter(([k, z]) => z.m === 'hm' && /m/.test(D.spenden.neu[k] || '')).length]);
  ok(f3.area === 'Spendenzweck' && f3.name === 'Rikscha' && f3d.join() === '2,4,0', 'F: 2 bei „Trauermailing“, 4 bleiben zu klären, Hospizmailing nicht mehr neu – weiter mit „Spendenzweck · Rikscha“ ' + JSON.stringify(f3d));
  await p.click('.sp-ar-skip'); await p.waitForTimeout(200);
  const f4 = await ds();
  ok(f4.done === 'Geprüft – bis auf 1 Schritt' && f4.sum === 'Maßnahmen14 bestätigt' && await p.evaluate(() => /Übersprungenes bleibt als „neu“ markiert/.test(document.querySelector('.sp-ar-done').textContent)),
    'F: „überspringen“ – Abschluss nennt den offenen Schritt; Maßnahmen 14 bestätigt ' + JSON.stringify(f4));
  await p.click('.sp-ar-done .sp-ar-back'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.querySelector('.sp-ar-start').textContent === 'Weiter prüfen →'), 'F: in der Übersicht „Weiter prüfen →“');
  await p.click('.sp-ar-start'); await p.waitForTimeout(200);
  ok((await ds()).name === 'Rikscha', 'F: „Weiter prüfen“ springt zum übersprungenen Schritt');
  await p.click('.sp-ar-ok'); await p.waitForTimeout(250);
  ok((await ds()).done === 'Alles geprüft' && await p.evaluate(() => !spjCompute(2023).list.some(e => e.z === 'zr' && e.neu && e.rec.d >= mkdn(2023, 6, 1))), 'F: bestätigt – „Alles geprüft“, die Juni-Spenden bei Rikscha nicht mehr neu');
  await p.click('.modal footer button:has-text("Schließen")'); await p.waitForTimeout(150);
  // nur Maßnahme
  const jul = []; for (let t = 1; t <= 4; t++) jul.push(L(p2(t) + '.07.2023', 30 + t, 70000 + t, 'Spende Hospiz'));
  await p.evaluate(t => spAddFiles([new File([t], 'jul.csv')]), csv(jul));
  await p.waitForSelector('.modal .sp-ar'); await p.waitForTimeout(400);
  ok((await st()).asg === 'Maßnahmen4:Hospizmailing 20234 | Spendenzwecke–:', 'F: nur Maßnahme – der Bereich Spendenzwecke sagt „keine“');
  await finish(b, pages);
})();
