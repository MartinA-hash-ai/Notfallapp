// 0.15: Urlaub/Abwesenheit der zugeordneten Person verlängert ihre Aufgaben (Info bei den Warnungen), Ferien grau wie Wochenenden,
// schlankes ⋯-Menü (Speichern immer automatisch, Speicherort und Änderungsprotokoll in den Einstellungen), „Auswertung“ ohne „Beta“,
// Zahl der Spenden in „Prüfen“ je Maßnahme
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
let n = 0;
const line = (d, b, name, zweck) => [d, d, b, "'TESTDE11XXX", 'DE0010000000000000' + String(++n).padStart(4, '0'), name, "'Zugang/Gutschrift", zweck, "'Spendengutschrift", "'Paderborn - Test"].join(';');
const csv = rows => '﻿' + [HEAD, ...rows].join('\r\n') + '\r\n';
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1700 }); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  await p.evaluate(id => { UI.view = 'plaene'; UI.year = 2027; UI.planSel = id; renderNow(); }, sm); await p.waitForTimeout(250);
  const P = () => p.evaluate(() => { const x = C.byId.get(UI.planSel), out = {}; for (const s of x.m.plan.steps) { if (s.typ === 'gruppe' || out[s.name]) continue; const r = x.pc.map.get(s.id) || {}; out[s.name] = { id: s.id, a: r.start, e: r.end, dur: +s.dauer, away: r.away || 0 }; } return out; });
  const W = n => p.evaluate(n => fmtW(n), n);

  // ---- A: Urlaub der zugeordneten Person verlängert die Aufgabe (vorwärts verknüpft)
  const a0 = await P();
  await p.evaluate(([t, b]) => commit(d => { const st = findM(d, UI.planSel).plan.steps; st.find(s => s.id === t).wer = 'Eva'; st.find(s => s.id === b).wer = 'Eva'; }), [a0['Texte erstellen'].id, a0['Bilder einholen'].id]); await p.waitForTimeout(150);
  ok((await P())['Texte erstellen'].e === a0['Texte erstellen'].e, 'A: ohne Urlaub ändert die Zuordnung nichts');
  await p.evaluate(() => commit(d => { d.urlaube.push({ id: 'u-eva', wer: 'Eva', von: '2027-04-26', bis: '2027-04-27', notiz: '' }); }, 'Urlaub')); await p.waitForTimeout(200);
  const a1 = await P();
  ok(a1['Texte erstellen'].a === a0['Texte erstellen'].a && a1['Texte erstellen'].dur === 5 && a1['Texte erstellen'].away === 2 && a1['Texte erstellen'].e > a0['Texte erstellen'].e,
    'A: „Texte erstellen“ (5 WT, Eva hat Mo/Di Urlaub) – Beginn bleibt, Ende ' + await W(a0['Texte erstellen'].e) + ' → ' + await W(a1['Texte erstellen'].e) + ', +2 Werktage');
  ok(await p.evaluate(([a, e]) => wtSpan(a, e) === 7 && wtSpan(a, e, awayDays('Eva')) === 5, [a1['Texte erstellen'].a, a1['Texte erstellen'].e]), 'A: im Zeitraum 7 Werktage, davon 5 für Eva');
  ok(a1['Gestaltung'].a === a1['Texte erstellen'].e && a1['Gestaltung'].a > a0['Gestaltung'].a, 'A: der verknüpfte Nachfolger „Gestaltung“ rückt mit (' + await W(a1['Gestaltung'].a) + ')');
  // am PAL hängende Aufgabe: Ende bleibt, Beginn früher
  ok(a1['Bilder einholen'].e === a0['Bilder einholen'].e && a1['Bilder einholen'].a < a0['Bilder einholen'].a && a1['Bilder einholen'].away === 2, 'A: „Bilder einholen“ (hängt am PAL) beginnt 2 Werktage früher – ' + await W(a1['Bilder einholen'].a));
  // Anzeige: „+2“ in der Zeile statt Warnung, Info bei den Warnungen
  const a2 = await p.evaluate(tid => { const row = document.querySelector('.pl-row[data-rid="' + tid + '"]'); return [row.querySelector('.wi.vacx') && row.querySelector('.wi.vacx').textContent, row.classList.contains('conflict'), !!document.querySelector('.g-bar.vacx[data-sid="' + tid + '"]'),
    C.warnings.filter(w => w.step === tid).map(w => w.lvl + ': ' + w.text).join(' | ')]; }, a1['Texte erstellen'].id);
  ok(a2[0] === '+2' && !a2[1] && a2[2] && /^info: Sommermailing › Texte erstellen: \+2 Werktage wegen Urlaub Eva \(26\.04\.–27\.04\.\)$/.test(a2[3]), 'A: Zeile mit „+2“, keine Warnung – Info: ' + a2[3]);
  // Abwesenheit zählt genauso
  await p.evaluate(() => commit(d => { d.urlaube.find(u => u.id === 'u-eva').art = 'abwesenheit'; })); await p.waitForTimeout(150);
  ok((await P())['Texte erstellen'].away === 2 && await p.evaluate(() => C.warnings.some(w => /\+2 Werktage wegen Abwesenheit Eva/.test(w.text))), 'A: Abwesenheit verlängert genauso');
  // Verschieben: die Dauer für Eva bleibt 5 WT
  await p.evaluate(([sid, a, e]) => commit(d => setStepSpan(findM(d, UI.planSel), sid, a - 7, e - 7, true)), [a1['Bilder einholen'].id, a1['Bilder einholen'].a, a1['Bilder einholen'].e]); await p.waitForTimeout(150);
  const a3 = (await P())['Bilder einholen'];
  ok(a3.dur === 5 && a3.away === 0 && a3.e < a1['Bilder einholen'].e, 'A: eine Woche früher verschoben (vor den Urlaub) – 5 WT ohne Verlängerung');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  // am Ende ziehen über den Urlaub: die Dauer zählt nur Evas Werktage
  await p.evaluate(([sid, a]) => commit(d => setStepSpan(findM(d, UI.planSel), sid, a, mkdn(2027, 4, 29))), [a1['Texte erstellen'].id, a1['Texte erstellen'].a]); await p.waitForTimeout(150);
  ok((await P())['Texte erstellen'].dur === 2, 'A: Ende auf Do 29.04. gezogen → 2 WT (Fr + Mi; Mo/Di Urlaub)');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  // feste Dauer: keine Verlängerung, dafür Warnung
  await p.evaluate(tid => commit(d => { findM(d, UI.planSel).plan.steps.find(s => s.id === tid).fix = true; }), a1['Texte erstellen'].id); await p.waitForTimeout(150);
  const a4 = await P(), a4w = await p.evaluate(tid => C.warnings.filter(w => w.step === tid).map(w => w.lvl).join(), a1['Texte erstellen'].id);
  ok(a4['Texte erstellen'].e === a0['Texte erstellen'].e && a4['Texte erstellen'].away === 0 && a4w === 'warn', 'A: Aufgabe mit fester Dauer wird nicht verlängert – Warnung „Eva hat Urlaub“');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  // Urlaub löschen → wieder wie vorher
  await p.evaluate(() => commit(d => { d.urlaube = d.urlaube.filter(u => u.id !== 'u-eva'); })); await p.waitForTimeout(150);
  const a5 = await P();
  ok(a5['Texte erstellen'].e === a0['Texte erstellen'].e && a5['Bilder einholen'].a === a0['Bilder einholen'].a, 'A: Urlaub gelöscht – Termine wie vorher');

  // ---- B: Ferien grau wie Wochenenden
  await p.evaluate(() => { commit(d => { d.ferien.push({ id: 'f1', von: '2027-07-12', bis: '2027-07-23', notiz: 'Sommerferien' }); }); UI.view = 'jahr'; UI.secOpen.kal = true; renderNow(); }); await p.waitForTimeout(300);
  const b0 = await p.evaluate(() => { const bg = n => getComputedStyle(document.querySelector('.day[data-dn="' + n + '"]')).backgroundColor; return [bg(mkdn(2027, 7, 14)), bg(mkdn(2027, 7, 10)), bg(mkdn(2027, 7, 28)), isWorkday(mkdn(2027, 7, 14)), bg(mkdn(2027, 7, 17))]; });
  const lum = c => c.match(/\d+/g).slice(0, 3).reduce((a, b) => a + +b, 0);
  ok(lum(b0[1]) < lum(b0[0]) && b0[0] !== b0[2] && b0[4] === b0[1] && b0[3], 'B: Ferientag im Kalender grau, etwas heller als ein Wochenende (' + b0[0] + ' / Wochenende ' + b0[1] + ' / normal ' + b0[2] + '); Samstag in den Ferien bleibt Wochenende; Ferientag bleibt ein Werktag');

  // ---- C: ⋯-Menü schlank, Speicherort und Änderungsprotokoll in den Einstellungen, ohne Hilfe; Speichern immer automatisch
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.waitForTimeout(100);
  const c0 = await p.evaluate(() => [...document.querySelectorAll('.menu button')].map(e => e.textContent).join(' | '));
  ok(!/Automatisch speichern|Speicherort|Änderungsprotokoll|Urlaub|Hilfe/.test(c0) && /Einstellungen …$/.test(c0) && /Daten prüfen/.test(c0) && /Programm-Update/.test(c0), 'C: ⋯-Menü – ' + c0);
  await p.keyboard.press('Escape'); await p.evaluate(() => document.body.click());
  await p.evaluate(() => openSettings('allgemein')); await p.waitForTimeout(200);
  const c1 = await p.evaluate(() => [!!document.querySelector('.sett-body .sett-folder'), document.querySelector('.sett-body .sett-store').textContent, !!document.querySelector('.sett-body .sett-log')]);
  ok(c1[0] && /noch kein Speicherort gewählt/.test(c1[1]) && c1[2], 'C: Einstellungen → Allgemein: „Speicherort (Mailing-Ordner) neu wählen …“ und „Änderungsprotokoll anzeigen …“');
  await p.click('.sett-body .sett-log'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !!document.querySelector('.modal .logview')), 'C: Änderungsprotokoll öffnet sich');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => typeof helpDialog === 'undefined' && !UI_KEYS.includes('autoSave')), 'C: Hilfe entfernt; „Automatisch speichern“ wird nicht mehr gemerkt (immer an)');

  // ---- D: Auswertung ohne „Beta“; Zahl der Spenden in „Prüfen“ je Maßnahme
  ok(await p.evaluate(() => !/Beta/.test(document.querySelector('nav.tabs').textContent)), 'D: Reiter „Auswertung“ ohne „Beta“');
  const q = await open(b); pages.push(q);
  ok(await connect(q) === 'ok', 'D: Mailing-Ordner verbunden');
  const [m1, m2] = await q.evaluate(() => { const l = C.ms.filter(x => x.pal != null && ymd(x.pal)[0] === 2027 && x.pal < mkdn(2027, 9, 1)); return [l[l.length - 1].id, l[l.length - 2].id]; });
  await q.evaluate(([t, m1]) => { __fs.files['/Mailing/Spendeneingänge 2027/e.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; commit(d => { d.massnahmen.find(m => m.id === m1).regel = { worte: ['Herbst'] }; }); },
    [csv([line('05.09.2027', '50', 'Anna Probe', 'Herbst'), line('06.09.2027', '30', 'Bernd Probe', 'Herbst Spende'), line('07.09.2027', '20', 'Carla Probe', 'Danke')]), m1]);
  await q.evaluate(m1 => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = m1; SP.at = null; renderNow(); }, m1);
  await q.waitForFunction(() => SP.at && SP.rows.length === 3); await q.waitForTimeout(300);
  await q.evaluate(m2 => { const k = SP.rows.find(r => r.name === 'Carla Probe').k; commit(d => { d.spenden.vor[k] = m2; }); }, m2); await q.waitForTimeout(200);
  const d0 = await q.evaluate(([m1, m2]) => { const bd = id => { const e = document.querySelector('.sp-ueb tr[data-mid="' + id + '"] .sp-mbadge'); return e ? e.textContent : ''; };
    return [bd(m1), bd(m2), document.querySelector('nav.tabs .tab-badge').textContent, document.querySelectorAll('.sp-ueb .sp-mbadge').length]; }, [m1, m2]);
  ok(d0[0] === '2' && d0[1] === '1' && d0[2] === '3' && d0[3] === 2, 'D: rote Zahl je Maßnahme – Regel-Treffer 2, von Hand vorgemerkt 1; am Reiter 3 (' + d0.join(',') + ')');
  await q.evaluate(() => { UI.secOpen['sp-ueb'] = false; renderNow(); }); await q.waitForTimeout(150);
  ok(await q.evaluate(() => /in „Prüfen“: .*\(2\).*\(1\)|in „Prüfen“: .*\(1\).*\(2\)/.test(document.querySelector('[data-sec="sp-ueb"]').textContent)), 'D: eingeklappt nennt die Übersicht, wo noch geprüft werden muss');
  await finish(b, pages);
})();
