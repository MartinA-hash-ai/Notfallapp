// 0.12.8 Auswertung: Suchausdrücke (* ? ~ + -) für Regeln und Suche; Hilfe erst nach Verweilen; Daueraufträge einblenden/ausblenden/nur;
// mittlere Liste beginnt ganz oben; „Stk.“ und „€“ in der Übersicht; jede Spalte (auch ROI) verstellbar
const { chromium, ok, open, connect, finish } = require('./lib');
const DIR = 'Spendeneingänge 2027/';
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
let n = 0;
const line = (d, b, name, zweck, text = "'Spendengutschrift") => [d, d, b, "'TESTDE11XXX", 'DE0010000000000000' + String(++n).padStart(4, '0'), name, "'Zugang/Gutschrift", zweck, text, "'Paderborn - Test"].join(';');
const csv = rows => '﻿' + [HEAD, ...rows].join('\r\n') + '\r\n';
const EXPORT = csv([
  line('28.08.2027', '20', 'Anna Probe', 'Spende Jahresbericht'),
  line('29.08.2027', '25', 'Bernd Probe', 'Jaresbericht danke'),
  line('30.08.2027', '30', 'Carla Probe', 'JAHRESBE RICHT'),
  line('31.08.2027', '35', 'Dora Probe', 'Jahresbreicht 2027'),
  line('01.09.2027', '40', 'Emil Probe', 'Jahresbericht Trauerfall'),
  line('02.09.2027', '45', 'Fritz Probe', 'Hospiz 2027 JB'),
  line('03.09.2027', '50', 'Gina Probe', 'JB'),
  line('04.09.2027', '55', 'Hans Probe', 'Jahresberecht'),
  line('05.09.2027', '60', 'Ida Probe', 'Spende Malteser', "'Dauerauftragsgutschr"),
  line('06.09.2027', '65', 'Jan Probe', 'Weihnachtsspende')]);
const writeText = (p, name, text) => p.evaluate(([nm, b]) => { __fs.files['/Mailing/' + nm] = { data: new Uint8Array(b), lm: 80000 + (++__fs.n) }; }, [name, [...Buffer.from(text, 'utf8')]]);

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await writeText(p, DIR + 'export.csv', EXPORT);
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'm5'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length > 0); await p.waitForTimeout(300);

  // ---- A: Suchausdrücke direkt am Matcher
  const names = await p.evaluate(() => {
    const run = (w, all) => { const f = spMatcher(w, all); return SP.rows.filter(r => f(r)).map(r => r.name.split(' ')[0]).sort().join(','); };
    return {
      plain: run(['Jahresbericht']), star: run(['*bericht']), star2: run(['Jahres*']), q: run(['Jahresber?cht']), fuzzy: run(['~Jahresbericht']),
      both: run(['JB + 2027']), excl: run(['*bericht', '-Trauer']), andnot: run(['Jahresbericht + -Trauer']), only: run(['-Trauer']), onlyAll: run(['-Trauer'], true),
      jb: run(['JB']), star3: run(['Hos*JB'])
    };
  });
  ok(names.plain === 'Anna,Carla,Emil', 'A: „Jahresbericht“ – ganzes Wort, auch getrennt („JAHRESBE RICHT“): ' + names.plain);
  ok(names.star === 'Anna,Bernd,Carla,Emil', 'A: „*bericht“ – Platzhalter findet auch „Jaresbericht“: ' + names.star);
  ok(names.star2 === 'Anna,Carla,Dora,Emil,Hans', 'A: „Jahres*“ – alles, was mit „Jahres“ beginnt: ' + names.star2);
  ok(names.q === 'Anna,Carla,Emil,Hans', 'A: „Jahresber?cht“ – genau ein Zeichen frei (auch „Jahresberecht“): ' + names.q);
  ok(names.fuzzy === 'Anna,Bernd,Carla,Dora,Emil,Hans', 'A: „~Jahresbericht“ – kleine Tippfehler (fehlender, vertauschter, falscher Buchstabe): ' + names.fuzzy);
  ok(names.both === 'Fritz', 'A: „JB + 2027“ – beide müssen vorkommen: ' + names.both);
  ok(names.excl === 'Anna,Bernd,Carla' && names.andnot === 'Anna,Carla', 'A: „-Trauer“ schließt aus (' + names.excl + '), „Jahresbericht + -Trauer“ ebenso (' + names.andnot + ')');
  ok(names.only === '' && names.onlyAll.split(',').length === 9, 'A: nur ausschließend – als Regel nichts, in der Suche alle übrigen (' + names.onlyAll.split(',').length + ')');
  ok(names.jb === 'Fritz,Gina' && names.star3 === '', 'A: „JB“ bleibt ganzes Wort; „Hos*JB“ greift nicht über Wortgrenzen (' + names.jb + '|' + names.star3 + ')');

  // ---- B: Regel mit Platzhalter über die Oberfläche
  await p.click('.sp-wordin'); await p.keyboard.type('*bericht'); await p.waitForTimeout(450);
  const b0 = await p.evaluate(() => [...document.querySelectorAll('.sp-col:first-child .sp-row')].map(e => SP.byKey.get(e.dataset.k).name.split(' ')[0]).sort().join(','));
  ok(b0 === 'Anna,Bernd,Carla,Emil', 'B: Live-Vorschau mit „*bericht“: ' + b0);
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  await p.click('.sp-wordin'); await p.keyboard.type('-Trauer'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const b1 = await p.evaluate(() => [JSON.stringify(D.massnahmen.find(m => m.id === 'm5').regel.worte), [...document.querySelectorAll('.sp-col.mid .sp-row')].map(e => SP.byKey.get(e.dataset.k).name.split(' ')[0]).sort().join(','),
    [...document.querySelectorAll('.sp-col.mid .sp-tag.rule')].map(t => t.textContent).join(',')]);
  ok(b1[0] === '["*bericht","-Trauer"]' && b1[1] === 'Anna,Bernd,Carla' && b1[2] === '*bericht,*bericht,*bericht', 'B: Regel „*bericht“ + „-Trauer“ – drei zum Prüfen (' + b1[1] + '), markiert mit „*bericht“');

  // ---- C: Hilfe erst nach Verweilen über dem Schlagwort-Feld, ⓘ sofort
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  const wi = await p.$('.sp-wordin'); await wi.scrollIntoViewIfNeeded(); const wb = await wi.boundingBox();
  await p.mouse.move(wb.x + 20, wb.y + wb.height / 2, { steps: 3 }); await p.waitForTimeout(800);
  const c0 = await p.evaluate(() => document.getElementById('tip').classList.contains('on'));
  await p.waitForTimeout(1600);
  const c1 = await p.evaluate(() => { const t = document.getElementById('tip'); return [t.classList.contains('on'), !!t.querySelector('.sp-help'), t.textContent]; });
  ok(!c0 && c1[0] && c1[1] && /\*bericht/.test(c1[2]) && /~Jahresbericht/.test(c1[2]) && /-Trauer/.test(c1[2]), 'C: Hilfe zu den Suchausdrücken erscheint erst nach etwa 2 s über dem Schlagwort-Feld');
  await p.mouse.move(5, 5, { steps: 2 }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.getElementById('tip').classList.contains('on')), 'C: Maus weg – Hilfe verschwindet');
  const ib = await (await p.$('.sp-rule .info')).boundingBox();
  await p.mouse.move(ib.x + 3, ib.y + 3, { steps: 2 }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !!document.querySelector('#tip.on .sp-help')), 'C: ⓘ an „Regel“ zeigt die Hilfe sofort');
  await p.mouse.move(5, 5, { steps: 2 });

  // ---- D: Suche in „Offen“ versteht dieselben Ausdrücke; Daueraufträge: einblenden / ausblenden / nur
  await p.evaluate(() => { UI.spFilt = true; renderNow(); }); await p.waitForTimeout(100);
  const offen = () => p.evaluate(() => [...document.querySelectorAll('.sp-col:first-child .sp-row')].map(e => SP.byKey.get(e.dataset.k).name.split(' ')[0]).sort().join(','));
  await p.fill('.sp-q', '~Weihnachtspende'); await p.waitForTimeout(450);
  const d0 = await offen();
  await p.fill('.sp-q', ''); await p.waitForTimeout(450);
  await p.selectOption('.sp-filter .sp-da select', 'nur'); await p.waitForTimeout(250);
  const d1 = [await offen(), await p.evaluate(() => UI.spDA)];
  await p.selectOption('.sp-filter .sp-da select', 'ohne'); await p.waitForTimeout(250);
  const d2 = await offen();
  await p.click('.sp-ftog'); await p.waitForTimeout(200);
  const d3 = await p.evaluate(() => document.querySelector('.sp-filter').textContent);
  ok(d0 === 'Jan' && d1[0] === 'Ida' && d1[1] === 'nur' && !/Ida/.test(d2) && /Jan/.test(d2) && /ohne Daueraufträge/.test(d3),
    'D: Suche „~Weihnachtspende“ findet „Weihnachtsspende“; „nur Daueraufträge“ → ' + d1[0] + '; „ausblenden“ → ohne Ida; eingeklappt „· ohne Daueraufträge“');
  await p.evaluate(() => { UI.spHideDA = true; UI.spDA = undefined; renderNow(); }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => spDAMode() === 'ohne'), 'D: alte Einstellung „Daueraufträge ausblenden“ wird übernommen');
  await p.evaluate(() => { UI.spHideDA = false; UI.spDA = 'alle'; UI.spFilt = false; renderNow(); }); await p.waitForTimeout(150);

  // ---- E: mittlere Liste beginnt ganz oben, Knöpfe bündig mit den Nachbarn
  const e0 = await p.evaluate(() => { const c = [...document.querySelectorAll('.sp-col')].map(e => e.getBoundingClientRect()), l = [...document.querySelectorAll('.sp-col .sp-list')].map(e => e.getBoundingClientRect()),
    f = [...document.querySelectorAll('.sp-col .sp-cf')].map(e => Math.round(e.getBoundingClientRect().top)); return [Math.round(l[1].top - c[1].top), Math.round(l[0].top - c[0].top), new Set(f).size, Math.round(l[1].bottom - l[0].bottom), c[1].height - c[0].height]; });
  ok(e0[0] <= 2 && e0[1] > 30 && e0[2] === 1 && Math.abs(e0[3]) <= 2 && Math.abs(e0[4]) <= 2, 'E: mittlere Liste beginnt oben in der Spalte (' + e0[0] + ' px statt ' + e0[1] + ' px), unten bündig, Spalten gleich hoch');

  // ---- F: Einheiten in der Übersicht
  await p.click('.sp-col.mid .sp-cf button.primary'); await p.waitForTimeout(250);
  await p.fill('[data-fk="sp-auf:m5"]', '5000'); await p.press('[data-fk="sp-auf:m5"]', 'Tab'); await p.waitForTimeout(200);
  await p.fill('[data-fk="sp-kos:m5"]', '1234,5'); await p.press('[data-fk="sp-kos:m5"]', 'Tab'); await p.waitForTimeout(200);
  const f0 = await p.evaluate(() => { const r = document.querySelector('.sp-ueb tr[data-mid="m5"]'), u = r.querySelectorAll('.sp-unit'), m = D.massnahmen.find(x => x.id === 'm5');
    return [u.length, u[0] && u[0].textContent + '|' + u[0].querySelector('input').value, u[1] && u[1].textContent + '|' + u[1].querySelector('input').value, m.auflage, m.kosten, document.querySelector('.sp-ueb tfoot')?.textContent || ''];
  });
  ok(f0[0] === 2 && f0[1] === 'Stk.|5.000' && f0[2] === '€|1.234,50' && f0[3] === 5000 && f0[4] === 1234.5, 'F: hinter der Auflage „Stk.“, hinter den Kosten „€“ (' + f0[1] + ', ' + f0[2] + ')');
  ok(/5\.000 Stk\./.test(f0[5]) && /1\.235 €/.test(f0[5]), 'F: Summenzeile mit „Stk.“ und „€“');
  const f1 = await p.evaluate(() => { const r = document.querySelector('.sp-ueb tr[data-mid="m5"]'), td = r.children[3], i = td.querySelector('input'), u = td.querySelector('i'); return [i.getBoundingClientRect().right <= u.getBoundingClientRect().left, u.getBoundingClientRect().right <= td.getBoundingClientRect().right]; });
  ok(f1[0] && f1[1], 'F: Einheit steht rechts neben dem Eingabefeld, innerhalb der Zelle');

  // ---- G: jede Spalte verstellbar – auch ROI (rechts ein leerer Rest)
  const ths = () => p.evaluate(() => [...document.querySelectorAll('.sp-ueb thead th')].map(t => Math.round(t.getBoundingClientRect().width)));
  const g0 = await p.evaluate(() => { const th = [...document.querySelectorAll('.sp-ueb thead th')]; return [th.length, th.filter(t => t.querySelector('.col-rs')).length, th[th.length - 1].classList.contains('sp-rest'), th[th.length - 2].textContent]; });
  ok(g0[0] === 11 && g0[1] === 10 && g0[2] && g0[3] === 'ROI', 'G: 10 Spalten mit Griff, rechts ein leerer Rest ohne Griff');
  const w0 = await ths(), rs = await p.$('.sp-ueb thead th:nth-child(10) .col-rs'); await rs.scrollIntoViewIfNeeded(); const rb = await rs.boundingBox();
  await p.mouse.move(rb.x + 3, rb.y + rb.height / 2); await p.mouse.down(); await p.mouse.move(rb.x + 63, rb.y + rb.height / 2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250);
  const w1 = await ths(), wu = await p.evaluate(() => UI.spColW && UI.spColW.roi);
  ok(Math.abs(w1[9] - w0[9] - 60) <= 2 && w1.slice(0, 9).join() === w0.slice(0, 9).join() && wu === w1[9], 'G: ROI 60 px breiter gezogen (' + w0[9] + ' → ' + w1[9] + '), übrige Spalten bleiben, gemerkt');
  const hb = await (await p.$('.sp-ueb thead th:nth-child(2) .col-rs')).boundingBox();
  await p.mouse.move(hb.x + 3, hb.y + hb.height / 2); await p.mouse.down(); await p.mouse.move(hb.x - 80, hb.y + hb.height / 2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250);
  const w2 = await ths();
  ok(Math.abs(w0[1] - w2[1] - 80) <= 5 && Math.abs(w2[2] - w1[2] - (w0[1] - w2[1])) <= 1 && w2[0] === w1[0] && w2[9] === w1[9], 'G: „Hinweis“ ist jetzt auch eine feste Spalte – 80 px schmaler, „PAL“ daneben breiter');
  const g3 = await p.evaluate(() => { const t = document.querySelector('.sp-ueb'), box = t.parentElement; return [Math.round(t.getBoundingClientRect().width), Math.round(box.getBoundingClientRect().width), box.scrollWidth <= box.clientWidth + 1]; });
  ok(g3[0] >= g3[1] - 2 && g3[2], 'G: Tabelle füllt die Breite (' + g3[0] + ' / ' + g3[1] + ' px), kein Querscrollen nötig');
  await finish(b, pages);
})();
