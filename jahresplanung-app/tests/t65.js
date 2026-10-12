// 0.19.1 Zusammenfassung „Buchungen hinzugefügt“: Felder anklickbar – Überschneidungen (mit Dateinamen, auch zwischen neuen Dateien),
// doppelte Spenden (Datum, Betrag, Verwendungszweck, „auch in“), ganze Breite / schmaler, zurück; „Per Regel neu …“ fragt und führt zur Prüfung
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const p2 = x => String(x).padStart(2, '0');
const L = (d, b, i, zw) => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000' + String(i).padStart(6, '0'), 'Probe ' + i, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - Lage"].join(';');
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
  await p.waitForSelector('.modal .sp-addsum2'); await p.waitForTimeout(400);
  const tiles = () => p.evaluate(() => [...document.querySelectorAll('.sp-addsum2 > div')].map(d => d.className.replace('sp-as-', '') + ':' + d.textContent));

  // ---- A: drei Felder, anklickbar (Hover dunkler)
  const a0 = await tiles();
  ok(a0[0] === 'ov warn click:Zeiträume überschneiden sichdoppelte Buchungen zählen nur einmal' && a0[1] === 'dup click:16 doppelte Spenden erkanntnicht noch einmal gezählt' && /^rules click:Per Regel neu zugeordnet.*Rikscha \(19\)$/.test(a0[2]),
    'A: Überschneidung, 16 doppelte, Regel „Rikscha“ (19) – alle drei anklickbar');
  const bg0 = await p.evaluate(() => getComputedStyle(document.querySelector('.sp-as-dup')).backgroundColor);
  await p.hover('.sp-as-dup'); await p.waitForTimeout(250);
  ok(await p.evaluate(b0 => getComputedStyle(document.querySelector('.sp-as-dup')).backgroundColor !== b0, bg0), 'A: beim Zeigen wird das Feld dunkler');

  // ---- B: Überschneidungen – Dateien als Balken, Paare mit gemeinsamem Zeitraum und gleichen Buchungen (auch zwischen zwei neuen Dateien)
  await p.click('.sp-as-ov'); await p.waitForTimeout(200);
  const b0 = await p.evaluate(() => { const d = document.querySelector('.sp-as-det'); return [[...d.querySelectorAll('.sp-ovl-n')].map(e => e.textContent).join(','), d.querySelectorAll('.sp-ovl-x').length,
    [...d.querySelectorAll('.sp-ovl-l li')].map(e => e.textContent), d.classList.contains('wide')]; });
  ok(b0[0] === 'jan.csv,jan_nochmal.csv,feb.csv,mrz.csv' && b0[1] === 4 && !b0[3], 'B: Klick – vier Dateien als Balken, Überschneidungen markiert (' + b0[0] + ')');
  ok(b0[2][0] === '„jan_nochmal.csv“ und „jan.csv“gemeinsam: 20.01.–31.01.2023 · 12 gleiche Buchungen (zählen einmal)' && b0[2][1] === '„mrz.csv“ und „feb.csv“ (beide neu)gemeinsam: 25.02.–28.02.2023 · 4 gleiche Buchungen (zählen einmal)',
    'B: Paare mit Dateinamen, gemeinsamem Zeitraum und Anzahl gleicher Buchungen – auch zwischen zwei neuen Dateien');
  await p.click('.sp-det-wide'); await p.waitForTimeout(150);
  const b1 = await p.evaluate(() => { const d = document.querySelector('.sp-as-det'), m = document.querySelector('.sp-addsum2').getBoundingClientRect(), r = d.getBoundingClientRect(); return [d.classList.contains('wide'), Math.round(r.width) === Math.round(m.width), getComputedStyle(d.querySelector('.sp-ovl-d')).display, document.querySelectorAll('.sp-addsum2 > div').length]; });
  ok(b1[0] && b1[1] && b1[2] !== 'none' && b1[3] === 3, 'B: „ganze Breite“ – Details über die ganze Breite (mit Zeiträumen), die anderen Felder bleiben darunter sichtbar');
  await p.click('.sp-det-copy'); await p.waitForTimeout(200);
  const rep = await p.evaluate(() => navigator.clipboard.readText().catch(() => '')).catch(() => '');
  ok(await p.evaluate(() => /Bericht kopiert – ohne Namen, IBAN und Verwendungszweck/.test(document.querySelector('#toasts').textContent)) && (!rep || (/Überschneidung „mrz\.csv“ \(25\.02\.–31\.03\.2023\) mit „feb\.csv“/.test(rep) && !/Hospizarbeit|Probe|DE00/.test(rep))),
    'B: „Bericht kopieren“ – Dateien, Zeiträume, Anzahl; ohne Namen, IBAN und Verwendungszweck');
  await p.click('.sp-det-wide'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('.sp-as-det').classList.contains('wide')), 'B: „schmaler“ – wieder im Feld');
  await p.click('.sp-det-back'); await p.waitForTimeout(150);
  ok(JSON.stringify(await tiles()) === JSON.stringify(a0), 'B: „← zurück“ – die drei Felder wie vorher');

  // ---- C: doppelte Spenden – Datum, Betrag, Verwendungszweck; „auch in“ auf ganzer Breite
  await p.click('.sp-as-dup'); await p.waitForTimeout(200);
  const c0 = await p.evaluate(() => { const rows = [...document.querySelectorAll('.sp-as-det .sp-dup-t tr')]; return [rows.length, rows[0].children[0].textContent, rows[0].children[1].textContent, getComputedStyle(rows[0].querySelector('.sp-dup-w')).display, rows[0].querySelector('.sp-z').textContent]; });
  ok(c0[0] === 16 && c0[1] === '20.01.2023' && c0[2] === '30,00 €' && c0[3] === 'none' && /Hospizarbeit/.test(c0[4]), 'B: 16 doppelte – Datum, Betrag, Verwendungszweck (gekürzt, schmal)');
  await p.click('.sp-det-wide'); await p.waitForTimeout(150);
  const c1 = await p.evaluate(() => { const r = document.querySelector('.sp-as-det .sp-dup-t tr'); return [getComputedStyle(r.querySelector('.sp-dup-w')).display, r.querySelector('.sp-dup-w').textContent, getComputedStyle(r.querySelector('.sp-z')).whiteSpace]; });
  ok(c1[0] !== 'none' && c1[1] === 'auch in jan.csv' && c1[2] === 'normal', 'C: ganze Breite – Verwendungszweck vollständig, „auch in jan.csv“');
  await p.click('.sp-det-back'); await p.waitForTimeout(150);

  // ---- D: „Per Regel neu zugeordnet“ – Rückfrage im Feld; Abbrechen; „Ja, prüfen“ schließt und führt zum Zweck (nur neue)
  await p.click('.sp-addsum2 .sp-rchip'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /„Rikscha“: 19 Spenden jetzt prüfen\?Das Fenster schließt sich, und es geht zu dem Spendenzweck\./.test(document.querySelector('.sp-as-ask').textContent)), 'D: Klick auf „Rikscha“ – Rückfrage „jetzt prüfen?“');
  await p.click('.sp-ask-no'); await p.waitForTimeout(150);
  ok(JSON.stringify(await tiles()) === JSON.stringify(a0), 'D: „Abbrechen“ – Feld wieder wie vorher');
  await p.click('.sp-as-rules'); await p.waitForTimeout(150); await p.click('.sp-ask-go'); await p.waitForTimeout(600);
  const d0 = await p.evaluate(() => [!!document.querySelector('.modal'), UI.view, UI.year, UI.spMid, SPJ.z, SPJ.lv, SPJ.onlyNew, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length,
    [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].every(r => r.querySelector('.sp-tag.neu')), (t => t > -5 && t < innerHeight / 2)(document.querySelector('[data-sec="sp-zu"]').getBoundingClientRect().top)]);
  ok(d0.slice(0, 7).join() === 'false,spenden,2023,allg:2023,zr,zweck,true' && d0[7] === 19 && d0[8] && d0[9], 'D: „Ja, prüfen“ – Fenster zu, „Spenden 2023“, Zweck „Rikscha“, nur die 19 neuen, Bereich im Bild ' + JSON.stringify(d0));
  await finish(b, pages);
})();
