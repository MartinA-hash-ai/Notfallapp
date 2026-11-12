// 0.54: Outlook-Export neu – Maßnahmen auswählen (Suche, Verantwortlich, „ab heute“), Start der Maßnahme (frühester Termin) und Start der Abschnitte
// mit Puffer in Werktagen, Aufgaben einer Person einzeln auswählen; immer eine Datei; Auswahl wird gemerkt
const { chromium, ok, open, finish } = require('./lib');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500, clock: new Date('2027-01-10T09:00:00') }); pages.push(p);
  // Testdaten: Verantwortliche und Aufgaben mit Datum für „Testperson“ (Phantasienamen)
  await p.evaluate(() => { UI.year = 2027; UI.icsOpts = undefined;
    commit(d => { d.massnahmen[1].verantwortlich = 'Erika'; d.massnahmen[2].verantwortlich = 'Erika';
      for (const m of d.massnahmen) if (m.plan) m.plan.steps.forEach((s, i) => { if (s.typ !== 'gruppe' && i % 3 === 1) s.wer = 'Testperson'; }); });
    renderNow(); });
  // ---- A: frühester Termin
  const a0 = await p.evaluate(() => C.ms.map(x => { const v = [...PHV().map(q => x.st[q.key]), x.pal, ...(x.pc ? [...x.pc.map.values()].map(r => r.start) : [])].filter(n => n != null);
    return icsFirst(x) === Math.min(...v); }).every(Boolean));
  ok(a0, 'A: Start der Maßnahme = frühester Termin (Bereiche, Detailplan-Schritte, PAL)');
  // ---- B: Dialog – nichts ausgewählt, Start an (5 WT), Abschnitte aus, keine Zeitraum-/Datei-Optionen mehr
  await p.evaluate(() => { exportICS(); }); await p.waitForSelector('.modal .icsprev');
  const b0 = await p.evaluate(() => { const m = document.querySelector('.modal'); return [m.querySelector('.ics-count b').textContent, m.querySelector('[data-opt="start"]').classList.contains('on'), m.querySelector('[data-opt="ab"]').classList.contains('on'),
    m.querySelector('[data-opt="start"] input').value, /Zeitraum|je Maßnahme|je Terminart|Schnellauswahl/.test(m.textContent), m.querySelectorAll('input[type=radio]').length]; });
  ok(b0[0] === '0' && b0[1] && !b0[2] && b0[3] === '5' && !b0[4] && !b0[5], 'B: Grundzustand – 0 Termine, Start an mit 5 WT, Abschnitte aus, keine Zeitraum-/Datei-Optionen ' + JSON.stringify(b0));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('.modal') && /Keine Termine/.test(document.body.textContent)), 'B: ohne Auswahl kein Download, Hinweis');
  // ---- C: alle auswählen – Chip-Datum = 5 Werktage vor dem Start; Puffer + verschiebt
  await p.evaluate(() => { exportICS(); }); await p.waitForSelector('.modal .icsprev');
  await p.click('.modal .ics-an button:has-text("alle")'); await p.waitForTimeout(100);
  const c0 = await p.evaluate(() => { const vis = [...document.querySelectorAll('.icsm')]; return [vis.length, document.querySelectorAll('.icsm.on').length, document.querySelectorAll('.icsc.k-start').length, +document.querySelector('.ics-count b').textContent,
    vis.length === C.ms.filter(x => inYear(x, 2027) && Math.max(...[x.pal, ...Object.values(x.st)].filter(n => n != null)) >= todayDn()).length]; });
  ok(c0[0] > 5 && c0[1] === c0[0] && c0[2] === c0[0] && c0[3] > 0 && c0[3] <= c0[0] && c0[4], 'C: „alle“ wählt alle sichtbaren Maßnahmen, je ein Start-Chip ' + JSON.stringify(c0));
  const chipOf = async id => p.evaluate(id => { const c = document.querySelector(`.icsc[data-key="${id}:start"] .d`); return c ? c.textContent : null; }, id);
  const mid = await p.evaluate(() => { const x = C.ms.find(x => !x.pc && icsFirst(x) > todayDn() + 30); return x.id; });
  const exp = n => p.evaluate(([id, n]) => fmtWS(dateForWT(icsFirst(C.byId.get(id)), n)), [mid, n]);
  ok(await chipOf(mid) === await exp(5), 'C: Chip zeigt den Erinnerungstag (5 Werktage vorher) ' + await chipOf(mid));
  await p.click('.ics-opt[data-opt="start"] .ics-pm[aria-label="mehr"]'); await p.waitForTimeout(80);
  ok(await chipOf(mid) === await exp(6) && await p.evaluate(() => document.querySelector('[data-opt="start"] input').value) === '6', 'C: „+“ → 6 WT vorher ' + await chipOf(mid));
  // ---- D: Abschnitte an – Bereiche als Chips, einzeln abwählbar
  await p.click('.ics-opt[data-opt="ab"] .ics-sw'); await p.waitForTimeout(100);
  const d0 = await p.evaluate(id => [[...document.querySelectorAll(`.icsm[data-m="${id}"] .icsc.k-ab .ics-k`)].map(e => e.textContent).join(''), +document.querySelector('.ics-count b').textContent,
    document.querySelector('[data-opt="ab"] input').value], mid);
  ok(/^SI/.test(d0[0]) && d0[2] === '2', 'D: Abschnitte an – Chips ' + d0[0] + ' (Puffer 2 WT), ' + d0[1] + ' Termine');
  await p.click(`.icsm[data-m="${mid}"] .icsc.k-ab >> nth=0`); await p.waitForTimeout(100);
  const d1 = await p.evaluate(id => [document.querySelector(`.icsm[data-m="${id}"] .icsc.k-ab`).classList.contains('off'), +document.querySelector('.ics-count b').textContent], mid);
  ok(d1[0] && d1[1] === d0[1] - 1, 'D: Chip anklicken → abgewählt, ein Termin weniger ' + JSON.stringify(d1));
  const pl = await p.evaluate(() => { const x = C.ms.find(x => x.pc && x.m.plan.steps.some(s => s.typ === 'gruppe')); return [x.id, x.m.plan.steps.filter(s => s.typ === 'gruppe').length, document.querySelectorAll(`.icsm[data-m="${x.id}"] .icsc.k-ab`).length]; });
  ok(pl[2] > 0 && pl[2] <= pl[1], 'D: bei Detailplänen die Abschnitte des Plans ' + JSON.stringify(pl));
  // ---- E: Filter – Suche und Verantwortlich; die Auswahl bleibt
  const nAll = await p.evaluate(() => +document.querySelector('.ics-count b').textContent);
  await p.fill('.ics-q', 'weihnacht'); await p.waitForTimeout(100);
  const e0 = await p.evaluate(() => [[...document.querySelectorAll('.icsm .nm')].map(e => e.textContent), +document.querySelector('.ics-count b').textContent, document.activeElement.classList.contains('ics-q')]);
  ok(e0[0].length >= 1 && e0[0].every(t => /weihnacht/i.test(t)) && e0[1] === nAll && e0[2], 'E: Suche zeigt nur Treffer, Auswahl bleibt, Fokus bleibt im Suchfeld ' + JSON.stringify(e0));
  await p.fill('.ics-q', ''); await p.waitForTimeout(80);
  await p.selectOption('.ics-resp', 'Erika'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.querySelectorAll('.icsm').length) === 2, 'E: Filter Verantwortlich „Erika“ → 2 Maßnahmen');
  await p.click('.modal .ics-an button:has-text("keine")'); await p.waitForTimeout(80);
  await p.selectOption('.ics-resp', ''); await p.waitForTimeout(80);
  const e1 = await p.evaluate(() => [document.querySelectorAll('.icsm').length, document.querySelectorAll('.icsm.on').length]);
  ok(e1[1] === e1[0] - 2, 'E: „keine“ wirkt nur auf die sichtbaren (gefilterten) Maßnahmen ' + JSON.stringify(e1));
  // ---- F: Aufgaben einer Person
  await p.click('.ics-tabs [data-tab="tasks"]'); await p.waitForTimeout(80);
  await p.selectOption('.ics-person', 'Testperson'); await p.waitForTimeout(100);
  const f0 = await p.evaluate(() => [document.querySelectorAll('.icst').length, document.querySelectorAll('.icst.on').length, icsTasks('Testperson', C.ms).filter(t => t.b >= todayDn()).length]);
  ok(f0[0] > 3 && f0[1] === 0 && f0[0] === f0[2], 'F: Aufgaben von „Testperson“: ' + f0[0] + ' (kommende), keine vorausgewählt');
  const before = await p.evaluate(() => +document.querySelector('.ics-count b').textContent);
  await p.click('.icst >> nth=0'); await p.click('.icst >> nth=2'); await p.waitForTimeout(100);
  const f1 = await p.evaluate(() => [document.querySelectorAll('.icst.on').length, +document.querySelector('.ics-count b').textContent, document.querySelector('.ics-count').textContent]);
  ok(f1[0] === 2 && f1[1] === before + 2 && /Aufgaben/.test(f1[2]), 'F: zwei Aufgaben einzeln ausgewählt – zählen mit in die eine Datei ' + JSON.stringify(f1));
  // ---- G: Download – eine Datei mit allen Terminen
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.modal footer button.primary')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8'), uids = [...ics.matchAll(/^UID:(.*)$/gm)].map(m => m[1]), sums = [...ics.matchAll(/^SUMMARY:(.*)$/gm)].map(m => m[1]);
  ok(/^Jahresplanung_2027\.ics$/.test(dl.suggestedFilename()) && uids.length === f1[1] && new Set(uids).size === uids.length && (ics.match(/DTSTART;VALUE=DATE:/g) || []).length === uids.length
    && sums.filter(s => / – Start /.test(s)).length > 0 && sums.filter(s => / · /.test(s)).length === 2,
    'G: eine Datei ' + dl.suggestedFilename() + ' mit ' + uids.length + ' Terminen (Starts, Abschnitte, 2 Aufgaben) – z. B. ' + sums[0]);
  const g1 = await p.evaluate(id => { const x = C.byId.get(id), n = icsFirst(x); return ds(dateForWT(n, 6)).replace(/-/g, ''); }, mid);
  ok(new RegExp('UID:' + mid + '-start@[^\\r]*\\r\\n(?:[^\\r]*\\r\\n)?DTSTART;VALUE=DATE:' + g1).test(ics), 'G: Start-Termin liegt 6 Werktage vor dem Start (' + g1 + ')');
  // ---- H: beim nächsten Öffnen ist alles wie zuletzt
  await p.evaluate(() => { exportICS(); }); await p.waitForSelector('.modal .icsprev');
  const h0 = await p.evaluate(() => [UI_KEYS.includes('icsOpts'), document.querySelector('.ics-tabs .on').dataset.tab, document.querySelector('.ics-person').value, document.querySelectorAll('.icst.on').length, +document.querySelector('.ics-count b').textContent]);
  ok(h0[0] && h0[1] === 'tasks' && h0[2] === 'Testperson' && h0[3] === 2 && h0[4] === f1[1], 'H: Auswahl, Puffer und Person werden gemerkt ' + JSON.stringify(h0));
  // ---- I: „ab heute“ aus → auch vergangene Termine
  await p.click('.ics-tabs [data-tab="ms"]'); await p.waitForTimeout(80);
  const i0 = await p.evaluate(() => document.querySelectorAll('.icsm').length);
  await p.click('.ics-fut'); await p.waitForTimeout(80);
  const i1 = await p.evaluate(() => [document.querySelectorAll('.icsm').length, C.ms.filter(x => inYear(x, 2027)).length, UI.icsOpts.fut]);
  ok(i1[0] === i1[1] && i1[0] >= i0, 'I: „ab heute“ aus – alle Maßnahmen des Jahres ' + JSON.stringify([i0, i1]));
  await p.click('.modal footer button:has-text("Abbrechen")'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => UI.icsOpts.fut === false), 'I: auch beim Abbrechen gemerkt');
  await finish(b, pages);
})();
