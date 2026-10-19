// 0.42 Zusammenfassung „Buchungen hinzugefügt“: oben das Ergebnis (grün / orange), „Was kam hinzu“ als Zeitstrahl je Datei, je Punkt eine Zeile
// (Auffälligkeiten, schon da mit Liste, lückenlos, per Regel → Prüfen); Liste der neuen Spenden eingeklappt; Bericht kopieren
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
    rows: [...m.querySelectorAll('.sp-ar-row')].map(r => (r.classList.contains('warn') ? '!' : r.classList.contains('todo') ? '●' : '✓') + ' ' + r.querySelector('.sp-ar-tx').textContent),
    list: !!m.querySelector('.sp-addlist') }; });

  // ---- A: Ergebnis grün, Zeitstrahl je Datei (neu / schon da), Achse, Legende nur mit dem, was vorkommt
  const a0 = await st();
  ok(a0.res === '✓59 neue Spenden · 1.492,00 €01.02.–31.03.2023 · aus 3 Dateien' && !a0.warn, 'A: oben das Ergebnis, grün: ' + a0.res);
  ok(a0.lanes.join(' | ') === 'bisher eingelesen:old:02.01.–31.01.2023 | jan_nochmal.csv:dup:alle 12 schon da | feb.csv:new:28 neu | mrz.csv:new+dup:31 neu · 4 schon da',
    'A: „Was kam hinzu“ – bisher eingelesen, je Datei neu (blau) und schon da (schraffiert): ' + a0.lanes.join(' | '));
  ok(a0.axis === 'Jan|Feb|Mär' && a0.key === 'neu übernommen|schon da – zählt einmal|bisher eingelesen', 'A: Achse ' + a0.axis + ', Legende nur mit dem, was vorkommt: ' + a0.key);
  ok(a0.rows.join(' | ') === '✓ 16 Buchungen waren schon da – nicht doppelt gezählt | ✓ Eingelesen jetzt lückenlos vom 01.01. bis 31.03.2023 | ● 19 neue Spenden per Regel bei Rikscha – bitte einmal prüfen' && !a0.list,
    'A: je Punkt eine Zeile; die Liste der neuen Spenden ist eingeklappt: ' + a0.rows.join(' | '));

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

  // ---- D: „Prüfen“ – Fenster zu, „Spenden 2023“, Zweck „Rikscha“, nur die neuen
  await p.click('.sp-ar-row.todo .sp-ar-go'); await p.waitForTimeout(600);
  const d0 = await p.evaluate(() => [!!document.querySelector('.modal'), UI.view, UI.year, UI.spMid, SPJ.z, SPJ.lv, SPJ.onlyNew, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length,
    [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].every(r => r.querySelector('.sp-tag.neu')), (t => t > -5 && t < innerHeight / 2)(document.querySelector('[data-sec="sp-zu"]').getBoundingClientRect().top)]);
  ok(d0.slice(0, 7).join() === 'false,spenden,2023,allg:2023,zr,zweck,true' && d0[7] === 19 && d0[8] && d0[9], 'D: „Prüfen“ – Fenster zu, „Spenden 2023“, Zweck „Rikscha“, nur die 19 neuen, Bereich im Bild ' + JSON.stringify(d0));

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
  await finish(b, pages);
})();
