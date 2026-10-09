// 0.16.8 Zeitstrahl „Eingelesen 2027“: welche Zeiträume aus den Dateien eingelesen sind, Lücken rot, seit der letzten Buchung gelb
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
let n = 0;
const file = dates => '﻿' + [HEAD, ...dates.map(d => { const [y, m, t] = d.split('-'), s = t + '.' + m + '.' + y; n++;
  return [s, s, String(10 + n), "'TESTDE11XXX", 'DE00100000000000' + String(n).padStart(6, '0'), 'Probe ' + n, "'Zugang/Gutschrift", 'Spende', "'Spendengutschrift", "'Paderborn - Lage"].join(';'); })].join('\r\n') + '\r\n';
// erfundene Exporte: a und b überschneiden sich, dann fehlt Mitte Mai bis Juni, c und d liegen nur einen Werktag (Fr 01.10.) auseinander, e ist aus 2026
const F = { a: ['2027-01-04', '2027-02-15', '2027-03-31'], b: ['2027-03-01', '2027-04-20', '2027-05-14'], c: ['2027-07-01', '2027-08-15', '2027-09-30'], d: ['2027-10-04', '2027-10-29'], e: ['2026-12-14', '2026-12-30'] };

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1400 }); pages.push(p);
  ok(await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; renderNow(); return !document.querySelector('.sp-cov'); }), 'A: ohne verbundenen Ordner kein Zeitstrahl');
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.clock.setFixedTime(new Date('2027-11-15T10:00:00'));          // „heute“ = 15.11.2027
  await p.evaluate(F => { for (const [k, t] of Object.entries(F)) __fs.files['/Mailing/Spendeneingänge 2027/' + k + '.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; },
    Object.fromEntries(Object.entries(F).map(([k, d]) => [k, file(d)])));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length === 13); await p.waitForTimeout(300);

  // ---- B: Abschnitte – Januar (Neujahr + Wochenende vor der ersten Buchung) zählt mit, Lücke 15.05.–30.06., ein fehlender Werktag (01.10.) ist keine Lücke
  const segs = () => p.evaluate(() => [...document.querySelectorAll('.sp-cov-s')].map(e => e.dataset.k + ' ' + e.dataset.s + '–' + e.dataset.e));
  const b0 = await segs();
  ok(b0.join(' | ') === 'cov 01.01.2027–14.05.2027 | gap 15.05.2027–30.06.2027 | cov 01.07.2027–29.10.2027 | open 30.10.2027–15.11.2027', 'B: Abschnitte ' + b0.join(' | '));
  ok(await p.evaluate(() => { const t = document.querySelector('.sp-cov-track').getBoundingClientRect(), m = document.querySelector('.sp-cov-today').getBoundingClientRect(); return Math.abs((m.left + 1 - t.left) / t.width - 318.5 / 365) < 0.004; }), 'B: Strich für heute (15.11.)');
  const b1 = await p.evaluate(() => [document.querySelector('.sp-cov-i').textContent, document.querySelector('.sp-cov-l').textContent,
    (() => { const t = document.querySelector('.sp-cov-track').getBoundingClientRect(), g = document.querySelector('.sp-cov-s.gap').getBoundingClientRect(); return [(g.left - t.left) / t.width, g.width / t.width]; })(),
    document.querySelectorAll('.sp-cov-ml span').length, document.querySelector('.sp-cov-ml span').textContent]);
  ok(b1[0] === 'eingelesen bis 29.10.2027 · ⚠ Lücke 15.05.–30.06.2027' && b1[1] === 'Eingelesen 2027', 'B: Text rechts: „' + b1[0] + '“');
  ok(Math.abs(b1[2][0] - 134 / 365) < 0.005 && Math.abs(b1[2][1] - 47 / 365) < 0.005 && b1[3] === 12 && b1[4] === 'Jan', 'B: Lücke an der richtigen Stelle (' + (b1[2][0] * 100).toFixed(1) + ' %, ' + (b1[2][1] * 100).toFixed(1) + ' % breit), Monate Jan–Dez darunter');
  const b2 = await p.evaluate(() => { const g = spCoverage(2027).segs[0]; return [g.n, g.files.sort().join(',')]; });
  ok(b2[0] === 6 && b2[1] === 'a.csv,b.csv', 'B: erster Abschnitt: 6 Spenden aus a.csv und b.csv (Überschneidung zählt einmal)');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.sp-cov-s.cov')).backgroundColor !== getComputedStyle(document.querySelector('.sp-cov-track')).backgroundColor &&
    /gradient/.test(getComputedStyle(document.querySelector('.sp-cov-s.gap')).backgroundImage)), 'B: eingelesen gefüllt, Lücke schraffiert');
  // Tooltip der Lücke
  await p.hover('.sp-cov-s.gap'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => /Lücke 15\.05\.–30\.06\.2027/.test(document.body.textContent.slice(-2000)) && /keine Datei eingelesen/.test(document.body.textContent.slice(-2000))), 'B: Hinweis beim Zeigen auf die Lücke');
  await p.mouse.move(5, 5);

  // ---- C: seit der letzten Buchung gelb; Wochenende + Feiertag + ein Werktag sind noch nicht „offen“; vor Jahresbeginn nichts offen
  const c0 = await p.evaluate(() => [spCoverage(2027, mkdn(2027, 11, 2)).segs.map(g => g.k).join(','), spCoverage(2027, mkdn(2026, 10, 9)).segs.map(g => g.k).join(',')]);
  ok(c0[0] === 'cov,gap,cov' && c0[1] === 'cov,gap,cov', 'C: heute 02.11. (nach Wochenende und Allerheiligen) noch nichts offen; ebenso vor Jahresbeginn (' + c0.join(' / ') + ')');

  // ---- D: Jahr ohne Daten; Daten aus 2026 zählen nur im Jahr 2026
  await p.evaluate(() => { UI.year = 2028; renderNow(); }); await p.waitForTimeout(150);
  const d0 = await p.evaluate(() => [document.querySelector('.sp-cov-i').textContent, document.querySelectorAll('.sp-cov-s.cov').length]);
  ok(d0[0] === 'noch keine Spenden aus 2028 eingelesen' && d0[1] === 0, 'D: 2028: „' + d0[0] + '“');
  await p.evaluate(() => { UI.year = 2026; renderNow(); }); await p.waitForTimeout(150);
  const d1 = await segs();
  ok(d1.join(' | ') === 'gap 01.01.2026–13.12.2026 | cov 14.12.2026–30.12.2026', 'D: 2026: ' + d1.join(' | '));
  await finish(b, pages);
})();
