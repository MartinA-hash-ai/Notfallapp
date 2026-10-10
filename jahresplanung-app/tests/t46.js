// 0.12.5 Stresstest-Funde: PAL nachträglich geändert (Zuordnungen vor dem PAL lösen), Reiterwechsel liest neue Dateien, Regel ohne PAL aus,
// Zeitraum nie verkehrt, deutsche Zahleneingabe (Kosten/Auflage), Zusammenführen ohne Rückfrage zu Ausschlüssen; ab 0.18: die Regel wandert mit dem PAL, Hinweis nur für von Hand Zugeordnetes
const { chromium, ok, open, connect, readF, dataOf, finish, fs, MAIN } = require('./lib');
const path = require('path');
const DIR = 'Spendeneingänge 2027/';
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const line = (d, b, iban, name, zweck, konto = 'Paderborn - Test') => [d, d, b, "'TESTDE11XXX", iban, name, "'Zugang/Gutschrift", zweck, "'Spendengutschrift", "'" + konto].join(';');
const csv = rows => '﻿' + [HEAD, ...rows].join('\r\n') + '\r\n';
const TWIN = line('03.09.2027', '10', 'DE00100000000000000005', 'Paul Doppelt', 'Spende');
const HOSPIZ = line('10.09.2027', '8.500,00', "'DE00100000000000000007", 'Henriette Probe', "'SPEND E HOSPIZDIENSTE", 'Paderborn - Hospiz');
const ERIKA = line('15.09.2027', '50', 'DE00100000000000000011', 'Erika Test', 'JB Spende Erika Test');
const EXPORT1 = csv([
  line('28.08.2027', '20', 'DE00100000000000000001', 'Anna Probe', 'Spende JB'),
  line('30.08.2027', '100,00', 'DE00100000000000000002', 'Bernd Probe', 'JAHRESBE RICHT DANKE'),
  line('01.09.2027', '35', 'DE00100000000000000003', 'Carla Probe', 'JBL Lautsprecher Erstattung'),
  line('02.09.2027', '-15,00', 'DE00100000000000000004', 'Rück Lastschrift', 'Ruecklastschrift'),
  TWIN, TWIN, HOSPIZ,
  line('15.08.2027', '25', 'DE00100000000000000008', 'Dora Vorher', 'JB')]);
const EXPORT2 = csv([TWIN, TWIN, HOSPIZ, ERIKA, line('18.09.2027', '30', 'DE00100000000000000012', 'Emil Klein', 'jb danke')]);
const writeBytes = (p, name, bytes) => p.evaluate(([n, b]) => { __fs.files['/Mailing/' + n] = { data: new Uint8Array(b), lm: 70000 + (++__fs.n) }; }, [name, [...bytes]]);
const writeText = (p, name, text) => writeBytes(p, name, Buffer.from(text, 'utf8'));

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await writeText(p, DIR + 'export1.csv', EXPORT1);
  await writeText(p, DIR + 'export2.csv', EXPORT2);
  await writeBytes(p, DIR + 'export3.xlsx', fs.readFileSync(path.join(__dirname, 'fixtures', 'spenden_test.xlsx')));
  await writeText(p, DIR + '~$export3.xlsx', 'Sperrdatei');
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'm5'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length > 0); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => ({ zu: Object.values(D.spenden.zu).filter(z => z.m === 'm5').length, pre: document.querySelector('.sp-pre')?.textContent || '', tile: document.querySelector('.sp-tile .sp-tv')?.textContent,
    warn: C.warnings.filter(w => /vor dem PAL/.test(w.text)).map(w => w.text).join(' | ') }));

  // ---- A: PAL zuerst falsch (einen Monat zu früh), Regel ordnet zu, dann PAL korrigiert – die Regel wandert mit
  await p.evaluate(() => { commit(d => { d.massnahmen.find(m => m.id === 'm5').pal = '2027-07-27'; }); renderNow(); }); await p.waitForTimeout(200);
  await p.fill('.sp-wordin', 'JB'); await p.press('.sp-wordin', 'Enter'); await p.waitForTimeout(300);
  const a0 = await st();
  ok(a0.zu === 5 && !a0.pre && !a0.warn, 'A: mit falschem PAL (27.07.) ordnet die Regel 5 zu, kein Hinweis');
  await p.evaluate(() => { UI.view = 'jahr'; renderNow(); commit(d => { d.massnahmen.find(m => m.id === 'm5').pal = '2027-09-17'; }); }); await p.waitForTimeout(200);
  const a1 = await st();
  ok(a1.zu === 2 && !a1.warn, 'A: PAL auf 17.09. korrigiert – der Zeitraum der Regel wandert mit: die 3 Spenden davor fallen heraus, 2 bleiben, keine Warnung');
  await p.click('nav.tabs >> text=Auswertung'); await p.waitForTimeout(400);
  ok((await st()).tile === '106 €' && !(await st()).pre, 'A: Kennzahlen aktualisiert (106 €), kein Hinweis „vor dem PAL“');
  // von Hand Zugeordnetes bleibt – vor dem PAL gibt es dafür Hinweis und Knopf
  await p.evaluate(() => { const r = SP.rows.find(r => r.name === 'Dora Vorher'); spAssignTo([r.k], 'm5'); }); await p.waitForTimeout(300);
  const a2 = await st();
  ok(a2.zu === 3 && /^1 Spende \(25,00 €\) ist zugeordnet, aber vor dem PAL \(17\.09\.2027\) eingegangen/.test(a2.pre) && /Jahresbericht: 1 zugeordnete Spende vor dem PAL/.test(a2.warn),
    'A: von Hand zugeordnete Spende vor dem PAL – Hinweis „' + a2.pre.slice(0, 60) + '…“ und in der Hinweisliste');
  await p.click('.sp-pre button'); await p.waitForTimeout(300);
  const a3 = await st();
  ok(a3.zu === 2 && !a3.pre && a3.tile === '106 €' && !a3.warn, 'A: „Diese 1 herausnehmen“ – Kennzahlen und Hinweise aktualisiert');
  await p.evaluate(() => saveAll({ manual: true })); await p.waitForTimeout(500);
  const re = dataOf(await readF(p));
  ok(Object.values(re.spenden.zu).filter(z => z.m === 'm5').length === 2 && re.massnahmen.find(m => m.id === 'm5').pal === '2027-09-17', 'A: gespeichert – nach dem Neuladen bleibt es so (2 Zuordnungen, PAL 17.09.)');

  // ---- B: neue Datei, während ein anderer Reiter offen ist → beim Wechsel auf „Spenden“ eingelesen
  await p.evaluate(() => { UI.view = 'jahr'; UI.secOpen.tl = true; renderNow(); }); await p.waitForTimeout(200);
  await writeText(p, DIR + 'neu.csv', csv([line('01.10.2027', '77', 'DE00100000000000000099', 'Neu Eingang', 'JB neu')]));
  await p.click('nav.tabs >> text=Auswertung'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => SP.rows.some(r => r.name === 'Neu Eingang')), 'B: Wechsel auf den Reiter liest die neue Datei sofort ein');

  // ---- C: Regel ohne PAL ist aus; D: Zeitraum-Ende nie vor dem Beginn
  const c = await p.evaluate(() => { commit(d => { const m = d.massnahmen.find(m => m.id === 'm3'); m.pal = null; m.regel = { worte: ['Spende'] }; }); return [[...spCompute().hits.values()].every(l => l.every(s => s.id !== 'm3')), spRuleOf(findM(D, 'm3')), Object.values(D.spenden.zu).some(z => z.m === 'm3')]; });
  ok(c[0] && c[1] === null && !c[2], 'C: Maßnahme ohne PAL – ihre Regel ordnet nichts zu (sonst unbegrenzt über alle Jahre)');
  await p.evaluate(() => undo());
  await p.evaluate(() => { UI.view = 'spenden'; renderNow(); }); await p.waitForTimeout(150);
  await p.fill('[data-fk="sp-rbis"]', '2027-09-01'); await p.press('[data-fk="sp-rbis"]', 'Tab'); await p.waitForTimeout(150);
  await p.fill('[data-fk="sp-rab"]', '2027-10-01'); await p.press('[data-fk="sp-rab"]', 'Tab'); await p.waitForTimeout(200);
  const dd = await p.evaluate(() => { const r = D.massnahmen.find(m => m.id === 'm5').regel; return [r.ab, r.bis]; });
  ok(dd[0] === 14 && dd[1] === 14, 'D: Beginn nach dem Ende gesetzt → Ende rückt mit (beide +14 Tage ab PAL)');

  // ---- E: deutsche Zahleneingabe
  const typeIn = async (sel, t) => { await p.click(sel, { clickCount: 3 }); await p.keyboard.type(t); await p.keyboard.press('Tab'); await p.waitForTimeout(200); };
  await typeIn('[data-fk="sp-kos:m5"]', '1.234,50');
  const e1 = await p.evaluate(() => [D.massnahmen.find(m => m.id === 'm5').kosten, document.querySelector('[data-fk="sp-kos:m5"]').value]);
  await typeIn('[data-fk="sp-kos:m5"]', '1234,5');
  const e2 = await p.evaluate(() => D.massnahmen.find(m => m.id === 'm5').kosten);
  await typeIn('[data-fk="sp-kos:m5"]', 'viel');
  const e3 = await p.evaluate(() => [D.massnahmen.find(m => m.id === 'm5').kosten, document.querySelector('[data-fk="sp-kos:m5"]').value, [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ')]);
  await typeIn('[data-fk="sp-auf:m5"]', '1.500');
  const e4 = await p.evaluate(() => [D.massnahmen.find(m => m.id === 'm5').auflage, document.querySelector('[data-fk="sp-auf:m5"]').value]);
  ok(e1[0] === 1234.5 && e1[1] === '1.234,50' && e2 === 1234.5 && e3[0] === 1234.5 && e3[1] === '1.234,50' && /keine Zahl/.test(e3[2]) && e4[0] === 1500 && e4[1] === '1.500',
    'E: Kosten „1.234,50“ und „1234,5“ → 1.234,50 €; „viel“ abgelehnt; Auflage „1.500“ → 1.500');
  await p.evaluate(() => { UI.view = 'jahr'; UI.secOpen.mass = true; renderNow(); }); await p.waitForTimeout(250);
  await typeIn('[data-fk="m:m4:auflage"]', '2.300');
  ok(await p.evaluate(() => D.massnahmen.find(m => m.id === 'm4').auflage === 2300), 'E: auch in der Maßnahmen-Tabelle: Auflage „2.300“ → 2300 (vorher 2,3 → 2)');

  // ---- F: Zusammenführen – Ausschlüsse, Neu-Markierungen und eingelesene Spenden ohne Rückfrage, Zuordnungen mit
  const f = await p.evaluate(() => {
    const k = SP.rows[0].k, k2 = SP.rows[1].k, k3 = SP.rows[2].k, base = JSON.parse(JSON.stringify(D)), mine = JSON.parse(JSON.stringify(D)), theirs = JSON.parse(JSON.stringify(D));
    mine.spenden.nein[k2] = ['m5']; theirs.spenden.nein[k2] = ['m4']; mine.spenden.neu[k3] = 'm'; theirs.spenden.bek['2030'] = ['xx1']; mine.spenden.bek['2030'] = ['xx2'];
    const r1 = merge3(base, mine, theirs);
    mine.spenden.zu[k] = { m: 'm5', d: '2027-09-01', b: 1 }; theirs.spenden.zu[k] = { m: 'm4', d: '2027-09-01', b: 1 };
    const r2 = merge3(base, mine, theirs);
    return [r1.conflicts.length, JSON.stringify(r1.data.spenden.nein[k2]), r1.data.spenden.neu[k3], r1.data.spenden.bek['2030'].sort().join(), r2.conflicts.length, r2.conflicts[0] && r2.conflicts[0].coll];
  });
  ok(f[0] === 0 && f[1] === '["m5","m4"]' && f[2] === 'm' && f[3] === 'xx1,xx2' && f[4] === 1 && f[5] === 'spenden', 'F: Ausschlüsse beider Seiten zusammengelegt, Neu-Markierung und eingelesene Spenden ohne Rückfrage; nur echte Zuordnungskonflikte werden nachgefragt');

  // ---- G: sehr viele Spenden auf einmal → Rückfrage
  await p.evaluate(() => { UI.view = 'spenden'; renderNow(); }); await p.waitForTimeout(150);
  const many = []; for (let i = 0; i < 230; i++) many.push(line('2' + (i % 8) + '.09.2027', String(10 + i), 'DE001000000000000' + String(10000 + i), 'Viele ' + i, 'Sammelspende'));
  await writeText(p, DIR + 'viele.csv', csv(many)); await p.evaluate(() => spScan({ manual: true })); await p.waitForTimeout(500);
  await p.evaluate(() => { SPUI.tab = 'offen'; renderNow(); }); await p.waitForTimeout(200);
  await p.click('.spm-listbox .spj-lh .spj-all'); await p.waitForTimeout(200);
  const g = await p.evaluate(() => [SPUI.sel.size, document.querySelector('.spj-act.on .spj-selinfo')?.textContent, document.querySelectorAll('.spm-listbox .spj-row').length]);
  ok(g[0] >= 230 && /^2\d\d Spenden markiert/.test(g[1]) && g[2] <= 400, 'G: über 200 Spenden – Häkchen oben markiert alle (' + g[1] + '), die Liste zeigt höchstens 400 auf einmal');
  await p.click('.spj-act .spj-go'); await p.waitForTimeout(300);
  const g2 = await p.evaluate(() => Object.values(D.spenden.zu).filter(z => z.m === 'm5' && !z.r).length);
  await p.evaluate(() => undo()); await p.waitForTimeout(200);
  ok(g2 >= 230 && await p.evaluate(() => Object.values(D.spenden.zu).filter(z => z.m === 'm5' && !z.r).length === 0), 'G: „Zuordnen“ ordnet alle von Hand zu (' + g2 + '), Strg+Z nimmt es zurück');

  // ---- H: unlesbare Zeilen werden gemeldet
  await writeText(p, DIR + 'kaputt.csv', csv(['31.02.2027;31.02.2027;20;X;DE1;A;T;JB;S;K', line('02.09.2027', '20', 'DE00100000000000000777', 'Gut', 'ok')]));
  await p.evaluate(() => spScan({ manual: true })); await p.waitForTimeout(400);
  const hh = await p.evaluate(() => { const f = SP.files.find(f => f.name === 'kaputt.csv'); return [f && f.bad, f && f.recs.length]; });
  ok(hh[0] === 1 && hh[1] === 1, 'H: Zeile mit unmöglichem Datum (31.02.) wird gezählt und im Datei-Hinweis gemeldet');
  await finish(b, pages);
})();
