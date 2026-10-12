// 0.19 Spenden JJJJ: Liste ohne Zweck = alle Spenden; Zweckwechsel behält „Bei Zweck“; Jahreswechsel behält den Zweck; Treffer der Regel hervorgehoben;
// Klick in die Jahresgrafik sucht den Tag in der Liste (ohne Seitensprung, Aufleuchten erst im Bild); Ausreißer-Grenze; ⓘ zum Anklicken
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
let n = 0;
const p2 = x => String(x).padStart(2, '0');
const line = (d, b, name, zw, konto = 'Paderborn - Lage') => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000' + String(++n).padStart(6, '0'), name, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'" + konto].join(';');
// erfundene Buchungen: ein Jahr lang werktags kleine Spenden, dazu eine Erbschaft und Spenden mit Zweck-Schlagworten
const rows = [];
for (let i = 0; i < 250; i++) { const d = new Date(2027, 0, 4 + i); if (d.getDay() === 0 || d.getDay() === 6) continue; rows.push(line(p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.2027', 10 + i % 30, 'Probe ' + i, 'Spende')); }
rows.push(line('15.03.2027', 1000, 'Probe ABC', 'Spende ABC Lage, Probe'), line('16.03.2027', 70, 'Probe Hospiz', 'Danke HOSPIZ BE RICHT'), line('17.03.2027', 40, 'Probe Konto', 'Spende', 'Paderborn - Brakel'),
  line('18.06.2027', 25000, 'Probe Erbe', 'Nachlass Probe'), line('20.01.2028', 80, 'Probe Neu', 'Spende ABC'));
const csv = '﻿' + [HEAD, ...rows].join('\r\n') + '\r\n';

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1400, height: 900 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/e.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv);
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'allg:2027'; UI.secOpen['sp-ueb'] = false; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length > 150); await p.waitForTimeout(300);
  await p.evaluate(() => commit(d => { d.zwecke.push({ id: 'za', name: 'ABC', farbe: '#2e7d32', worte: ['ABC'], konten: [], massnahmen: [] },
    { id: 'zh', name: 'Hospiz', farbe: '#1565c0', worte: ['Hospizbericht'], konten: ['Paderborn - Brakel'], massnahmen: [] }); }, 'Testzwecke'));
  await p.waitForTimeout(250);
  const rowOf = (who, q) => p.evaluate(([w, q]) => { const r = [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].find(e => SP.byKey.get(e.dataset.k).name === w); return r ? r.querySelector(q).innerHTML : null; }, [who, q]);

  // ---- A: ohne Zweck alle Spenden; Hinweistext unter den Filtern weg, Erklärung hinter ⓘ (Klick)
  const a0 = await p.evaluate(() => [document.querySelector('.spj-lh b').textContent, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length, spjCompute(2027).list.length,
    /Klick auf einen Zweck oder eine Gliederung filtert/.test(document.getElementById('main').textContent), /Links einen Zweck wählen/.test(document.getElementById('main').textContent)]);
  ok(a0[0] === 'Alle Spenden 2027' && a0[1] === Math.min(200, a0[2]) && !a0[3] && !a0[4], 'A: ohne gewählten Zweck „Alle Spenden 2027“ (' + a0[1] + ' von ' + a0[2] + ' gezeigt), keine Hinweistexte');
  await p.click('.spj-rules .infobtn'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /Links einen Zweck wählen oder mit „\+ Zweck“ anlegen/.test(document.querySelector('.infopop')?.textContent || '')), 'A: Klick auf ⓘ zeigt die Erklärung');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !document.querySelector('.infopop')), 'A: Esc schließt sie wieder');

  // ---- B: Hervorhebung – Schlagwort im Verwendungszweck, von der Bank getrennt, Konto als Gliederung; in der Vorschau das getippte Wort
  const b0 = [await rowOf('Probe ABC', '.sp-z'), await rowOf('Probe Hospiz', '.sp-z'), await rowOf('Probe Konto', '.spj-g'), await rowOf('Probe 3', '.sp-z')];
  ok(b0[0] === 'Spende <mark class="sp-hl">ABC</mark> Lage, Probe' && b0[1] === 'Danke <mark class="sp-hl">HOSPIZ BE RICHT</mark>' && b0[2] === '<mark class="sp-hl">Brakel</mark>' && b0[3] === 'Spende',
    'B: Regel „ABC“ hervorgehoben, „Hospizbericht“ auch getrennt geschrieben, Konto-Regel markiert die Gliederung (' + b0.slice(0, 3).join(' | ') + ')');
  await p.evaluate(() => { const k = SP.rows.find(r => r.name === 'Probe ABC').k; spjSetZweck([k], 'zh', 'von Hand'); }); await p.waitForTimeout(200);
  ok(await rowOf('Probe ABC', '.sp-z') === 'Spende ABC Lage, Probe', 'B: von Hand zugeordnet – nichts hervorgehoben');
  await p.evaluate(() => undo()); await p.waitForTimeout(200);
  await p.click('.spj-zi[data-z="za"]'); await p.waitForTimeout(150);
  await p.fill('.spj-rules .sp-wordin', 'Nachlass'); await p.waitForTimeout(450);
  ok(await rowOf('Probe Erbe', '.sp-z') === '<mark class="sp-hl">Nachlass</mark> Probe', 'B: Vorschau – das getippte Schlagwort ist hervorgehoben');
  await p.evaluate(() => { SPJ.typed = ''; renderNow(); }); await p.waitForTimeout(150);
  // Maßnahmen: Regelwort in „Zugeordnet“
  await p.evaluate(() => { const x = C.ms.find(o => o.pal != null && ymd(o.pal)[0] === 2027 && o.pal < mkdn(2027, 3, 1)); commit(d => { findM(d, x.id).regel = { worte: ['ABC'], ab: 0, bis: 120 }; }); UI.spMid = x.id; renderNow(); });
  await p.waitForTimeout(250);
  ok(await p.evaluate(() => { const r = [...document.querySelectorAll('.spm-listbox .spj-row')].find(e => SP.byKey.get(e.dataset.k).name === 'Probe ABC'); return r && r.querySelector('.sp-z').innerHTML === 'Spende <mark class="sp-hl">ABC</mark> Lage, Probe'; }),
    'B: auch bei „Spenden zuordnen“ einer Maßnahme ist das Schlagwort der Regel hervorgehoben');

  // ---- C: Zweckwechsel behält „Bei Zweck“; Jahreswechsel: Spenden des neuen Jahres mit demselben Zweck (gibt es ihn nicht: alle)
  await p.evaluate(() => { UI.spMid = 'allg:2027'; renderNow(); }); await p.waitForTimeout(200);
  await p.click('.spj-zi[data-z="za"]'); await p.waitForTimeout(150); await p.click('.spj-lv [data-lv="zweck"]'); await p.waitForTimeout(150);
  await p.click('.spj-zi[data-z="zh"]'); await p.waitForTimeout(200);
  const c0 = await p.evaluate(() => [SPJ.lv, document.querySelector('.spj-lv .seg-btn.on').textContent, [...document.querySelectorAll('[data-sec="sp-zu"] .spj-row')].map(e => SP.byKey.get(e.dataset.k).name).sort().join(',')]);
  ok(c0[0] === 'zweck' && /^Bei „Hospiz“/.test(c0[1]) && c0[2] === 'Probe Hospiz,Probe Konto', 'C: Zweck gewechselt – die Liste zeigt weiter die Spenden beim Zweck (' + c0[2] + ')');
  await p.evaluate(() => { const x = C.ms.find(o => o.pal != null && ymd(o.pal)[0] === 2027); UI.spMid = x.id; renderNow(); UI.year = 2028; renderNow(); }); await p.waitForTimeout(250);
  const c1 = await p.evaluate(() => [UI.spMid, SPJ.z, SPJ.lv, document.querySelector('[data-sec="sp-m"] .sec-t').textContent]);
  ok(c1.join() === 'allg:2028,zh,zweck,Spenden 2028', 'C: von einer Maßnahme 2027 ins Jahr 2028 – „Spenden 2028“, Zweck „Hospiz“ bleibt gewählt (' + c1.join() + ')');
  await p.evaluate(() => { commit(d => { d.zwecke = d.zwecke.filter(z => z.id !== 'zh'); }); UI.year = 2027; renderNow(); }); await p.waitForTimeout(250);
  ok(await p.evaluate(() => UI.spMid === 'allg:2027' && SPJ.z == null && document.querySelector('.spj-lh b').textContent === 'Alle Spenden 2027'), 'C: Zweck gibt es nicht mehr – alle Spenden');
  await p.evaluate(() => undo()); await p.waitForTimeout(200);

  // ---- D: Klick in die Jahresgrafik – die Seite bleibt stehen, die Liste rollt zum Tag; Aufleuchten erst, wenn die Liste im Bild ist
  await p.evaluate(() => { SPJ.z = null; renderNow(); document.querySelector('[data-chart="ycum"]').scrollIntoView({ block: 'end' }); }); await p.waitForTimeout(250);
  const d0 = await p.evaluate(() => { const ov = document.querySelector('[data-chart="ycum"] .sp-ov').getBoundingClientRect(), J = spjCompute(2027), days = J.b - J.a + 1, i = mkdn(2027, 3, 16) - J.a;
    return { x: ov.x + (i + 0.5) / days * ov.width, y: ov.y + ov.height / 2, sy: scrollY, vis: document.querySelector('[data-sec="sp-zu"] .spj-list').getBoundingClientRect().top < innerHeight }; });
  await p.mouse.move(d0.x, d0.y); await p.waitForTimeout(80);
  const tipD = await p.evaluate(() => document.getElementById('tip').textContent);
  await p.mouse.click(d0.x, d0.y); await p.waitForTimeout(400);
  const d1 = await p.evaluate(() => [scrollY, document.querySelector('[data-sec="sp-zu"] .spj-list').scrollTop, [...document.querySelectorAll('.spj-row.jump')].map(r => r.querySelector('.sp-d').textContent),
    document.querySelectorAll('.spj-row.flash').length, document.querySelector('#toasts').textContent]);
  ok(!d0.vis && d1[0] === d0.sy && d1[1] > 1000 && d1[2].length >= 2 && d1[2].every(t => t === '16.03.2027') && d1[3] === 0 && /vom 16\.03\.2027 unten unter „Spendenzwecke zuordnen“ herausgesucht/.test(d1[4]) && /Klick: Spenden dieses Tages/.test(tipD),
    'D: Klick auf den 16.03. – Seite bleibt stehen, Liste rollt (' + d1[1] + ' px) zu den ' + d1[2].length + ' Spenden, noch nichts leuchtet (Liste nicht im Bild)');
  await p.evaluate(() => document.querySelector('[data-sec="sp-zu"] .spj-listbox').scrollIntoView({ block: 'center' })); await p.waitForTimeout(400);
  const d2 = await p.evaluate(() => { const l = document.querySelector('[data-sec="sp-zu"] .spj-list').getBoundingClientRect(), f = document.querySelector('.spj-row.flash'); return [document.querySelectorAll('.spj-row.flash').length, f ? Math.round(f.getBoundingClientRect().top - l.top) : -1]; });
  ok(d2[0] === d1[2].length && d2[1] >= 0 && d2[1] < 40, 'D: hingescrollt – die Spenden des Tages leuchten kurz auf, oben in der Liste (' + d2.join(', ') + ')');
  await p.waitForTimeout(3200);
  ok(await p.evaluate(() => !document.querySelector('.spj-row.flash, .spj-row.jump') && SPJ.flash == null), 'D: danach wieder normal');
  // Woche mit gewähltem Zweck: die Liste zeigt die Spenden beim Zweck
  await p.evaluate(() => { SPJ.z = 'za'; SPJ.lv = 'frei'; renderNow(); document.querySelector('[data-chart="yweek"]').scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(250);
  const wk = await p.evaluate(() => { const J = spjCompute(2027), i = Math.floor((mkdn(2027, 3, 15) - J.a) / 7), r = document.querySelectorAll('[data-chart="yweek"] .sp-hit')[i].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.click(wk.x, wk.y); await p.waitForTimeout(300);
  ok(await p.evaluate(() => SPJ.lv === 'zweck' && [...document.querySelectorAll('.spj-row.jump')].map(r => SP.byKey.get(r.dataset.k).name).join() === 'Probe ABC'), 'D: Wochenbalken mit gewähltem Zweck „ABC“ – Liste „Bei ABC“, die Spende der Woche herausgesucht');

  // ---- E: Ausreißer – „über 10.000 € ausblenden“: Kacheln, Tabellen, Grafik, Übersicht ohne die Erbschaft; Liste unverändert; gespeichert, Protokoll, Strg+Z
  await p.evaluate(() => { SPJ.z = null; renderNow(); window.scrollTo(0, 0); }); await p.waitForTimeout(150);
  const sum = () => p.evaluate(() => document.querySelector('.spj-tiles .sp-tile .sp-tv').textContent);
  const e0 = [await sum(), await p.evaluate(() => document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length)];
  await p.fill('.spj-grenze', '10.000'); await p.press('.spj-grenze', 'Enter'); await p.waitForTimeout(300);
  const e1 = await p.evaluate(() => [D.spenden.grenze, document.querySelector('.spj-gr .spj-aus')?.textContent, document.querySelector('.spj-tiles .sp-tile .sp-tv').textContent, document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length,
    spjStats(spjBase(spjCompute(2027))).n, spjCompute(2027).list.length, describeChanges(JSON.parse(UNDO[UNDO.length - 1]), D).includes('Spenden 2027: Spenden über 10.000 € in der Statistik ausgeblendet')]);
  ok(JSON.stringify(e1[0]) === '{"2027":1000000}' && e1[1] === '1 ausgeblendet · 25.000 €×' && e1[2] !== e0[0] && e1[3] === e0[1] && e1[4] === e1[5] - 1 && e1[6],
    'E: Grenze 10.000 € – „1 ausgeblendet · 25.000 €“, Spendensumme ' + e0[0] + ' → ' + e1[2] + ', Liste unverändert, gespeichert und im Protokoll');
  ok(await p.evaluate(() => { const m = normalize(JSON.parse(JSON.stringify(D))), base = JSON.parse(JSON.stringify(D)), th = JSON.parse(JSON.stringify(D)); th.spenden.grenze = {}; base.spenden.grenze = {};
    const r = normalize(merge3(base, JSON.parse(JSON.stringify(D)), th).data); return m.spenden.grenze['2027'] === 1000000 && r.spenden.grenze['2027'] === 1000000; }), 'E: bleibt beim Laden und Zusammenführen erhalten');
  await p.evaluate(() => { UI.secOpen['sp-m'] = false; renderNow(); }); await p.waitForTimeout(100);
  ok(await p.evaluate(() => /1 Ausreißer ausgeblendet/.test(document.querySelector('[data-sec="sp-m"]').textContent)), 'E: eingeklappt nennt „1 Ausreißer ausgeblendet“');
  await p.evaluate(() => { UI.secOpen['sp-m'] = true; renderNow(); }); await p.waitForTimeout(100);
  await p.evaluate(() => undo()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !(D.spenden.grenze || {})['2027'] && !document.querySelector('.spj-gr .spj-aus')) && await sum() === e0[0], 'E: Strg+Z – alle Spenden zählen wieder');
  await p.fill('.spj-grenze', 'abc'); await p.press('.spj-grenze', 'Enter'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !(D.spenden.grenze || {})['2027'] && document.querySelector('.spj-grenze').value === ''), 'E: ungültige Eingabe wird nicht übernommen');
  await finish(b, pages);
})();
