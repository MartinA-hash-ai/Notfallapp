// 0.11 Urlaub / Abwesenheit: Knopf oben rechts in der Karte, Kalendarium (Person, Art, Tage klicken/ziehen, mehrere Zeiträume), Anzeige
// 0.11.1 ganzes Jahr im Fenster; jede Markierung behält Person und Art, die beim Markieren eingestellt waren
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500 }); pages.push(p);
  await p.evaluate(() => { UI.view = 'urlaub'; UI.year = 2027; renderNow(); }); await p.waitForTimeout(250);

  // ---- A: Knopf in der Karte oben rechts, unten keiner mehr
  const a = await p.evaluate(() => { const c = [...document.querySelectorAll('section.card')].find(s => /Urlaube \/ Abwesenheiten/.test(s.textContent)), btn = c.querySelector('.card-head .vac-add'), h2 = c.querySelector('h2');
    return [!!btn, btn && btn.getBoundingClientRect().right > c.getBoundingClientRect().right - 40, btn && Math.abs(btn.getBoundingClientRect().top - h2.getBoundingClientRect().top) < 12, !c.querySelector('.addline')]; });
  ok(a.every(Boolean), 'A: „+ neuen Urlaub eintragen“ oben rechts neben der Überschrift, unten entfernt');

  // ---- B: Dialog: Personen aus den Einstellungen, Speichern erst mit Auswahl
  await p.click('.vac-add'); await p.waitForTimeout(200);
  const bb = await p.evaluate(() => [[...document.querySelectorAll('.vd-wer option')].map(o => o.value).join(), D.personen.map(x => x.name).join(), document.querySelectorAll('.vd-month').length, document.querySelector('.modal.vacdlg footer button.primary').disabled]);
  ok(bb[0] === bb[1] && bb[2] === 12 && bb[3], 'B: Person aus der Liste (' + bb[0] + '), alle zwölf Monate, „Speichern“ noch aus');
  await p.selectOption('.vd-wer', 'Eva');
  await p.click('.vd-art .seg-btn[data-art="abwesenheit"]');
  const pos = n => p.evaluate(n => { const r = document.querySelector('.vd-day[data-dn="' + n + '"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, n);
  const day = (m, d) => p.evaluate(([m, d]) => mkdn(2027, m, d), [m, d]);
  // einzelner Tag, eine Woche gezogen, noch ein Tag; dann ein Tag wieder abgewählt
  let q = await pos(await day(6, 1)); await p.mouse.click(q[0], q[1]);
  const w0 = await pos(await day(6, 14)), w1 = await pos(await day(6, 18));
  await p.mouse.move(w0[0], w0[1]); await p.mouse.down(); await p.mouse.move(w1[0], w1[1], { steps: 6 }); await p.mouse.up();
  q = await pos(await day(7, 9)); await p.mouse.click(q[0], q[1]);
  q = await pos(await day(6, 16)); await p.mouse.click(q[0], q[1]);
  const s1 = await p.evaluate(() => [document.querySelector('.vd-sum').textContent, document.querySelectorAll('.vd-day.sel').length, document.querySelector('.modal.vacdlg footer button.primary').disabled]);
  ok(s1[1] === 6 && /4 Zeiträume · 6 Arbeitstage/.test(s1[0]) && !s1[2], 'B: Tag + Woche gezogen + Tag, einer wieder abgewählt – „' + s1[0] + '“');
  await p.fill('.vd-notiz', 'Fortbildung');
  await p.click('.modal footer button:has-text("Speichern")'); await p.waitForTimeout(250);
  const e = await p.evaluate(() => D.urlaube.filter(u => u.wer === 'Eva' && u.notiz === 'Fortbildung').map(u => u.von + '/' + u.bis + '/' + (u.art || 'urlaub')).sort().join(' '));
  ok(e === '2027-06-01/2027-06-01/abwesenheit 2027-06-14/2027-06-15/abwesenheit 2027-06-17/2027-06-18/abwesenheit 2027-07-09/2027-07-09/abwesenheit', 'B: vier Einträge als Abwesenheit gespeichert (' + e + ')');

  // ---- C: schon eingetragene Tage sind belegt und lassen sich nicht wählen
  await p.click('.vac-add'); await p.waitForTimeout(200); await p.selectOption('.vd-wer', 'Eva');
  q = await pos(await day(6, 14)); await p.mouse.click(q[0], q[1]);
  const c = await p.evaluate(n => [document.querySelector('.vd-day[data-dn="' + n + '"]').classList.contains('busy'), document.querySelectorAll('.vd-day.sel').length], await day(6, 14));
  ok(c[0] && c[1] === 0, 'C: belegter Tag gestreift, Klick wählt nichts');

  // ---- C2: Person und Art wechseln – bisher Markiertes bleibt, wie es markiert wurde
  const drag = async (a, z) => { await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(z[0], z[1], { steps: 5 }); await p.mouse.up(); };
  await p.selectOption('.vd-wer', 'Martin'); await p.click('.vd-art .seg-btn[data-art="urlaub"]');
  await drag(await pos(await day(3, 1)), await pos(await day(3, 5)));
  await p.click('.vd-art .seg-btn[data-art="abwesenheit"]');
  await drag(await pos(await day(5, 10)), await pos(await day(5, 12)));
  const c2a = await p.evaluate(n => [document.querySelector('.vd-day[data-dn="' + n + '"]').classList.contains('abw'), document.querySelectorAll('.vd-day.sel').length], await day(3, 2));
  await p.selectOption('.vd-wer', 'Eva');
  await drag(await pos(await day(8, 2)), await pos(await day(8, 4)));
  const c2b = await p.evaluate(() => [document.querySelectorAll('.vd-day.sel').length, document.querySelectorAll('.vd-sum .vd-line').length]);
  ok(!c2a[0] && c2a[1] === 8 && c2b[0] === 3 && c2b[1] === 3, 'C2: Martins Urlaub bleibt Urlaub nach Wechsel auf Abwesenheit; bei Eva nur Evas Markierungen sichtbar; Zusammenfassung mit 3 Zeilen');
  await p.click('.modal footer button:has-text("Speichern")'); await p.waitForTimeout(250);
  const c2 = await p.evaluate(() => D.urlaube.filter(u => !u.notiz).map(u => u.wer + ' ' + u.von + '–' + u.bis + ' ' + (u.art || 'urlaub')).sort().join(' | '));
  ok(c2 === 'Eva 2027-08-02–2027-08-04 abwesenheit | Martin 2027-03-01–2027-03-05 urlaub | Martin 2027-05-10–2027-05-12 abwesenheit', 'C2: gespeichert – ' + c2);

  // ---- D: Anzeige – Art in der Liste umstellbar, Abwesenheit gestreift in der Übersicht und im Kalender
  await p.evaluate(() => { commit(d => d.urlaube.push({ id: 'u-voll', wer: 'Martin', von: '2027-06-07', bis: '2027-06-11', notiz: '' })); }); await p.waitForTimeout(200);
  const d = await p.evaluate(() => { const u = D.urlaube.find(u => u.art === 'abwesenheit'); const sel = document.querySelector('[data-fk="u:' + u.id + ':art"]');
    const bars = [...document.querySelectorAll('.um-bar')].map(e => e.style.background); return [sel && sel.value, bars.some(b => /repeating-linear-gradient/.test(b)), bars.some(b => !/gradient/.test(b))]; });
  ok(d[0] === 'abwesenheit' && d[1] && d[2], 'D: Spalte „Art“ zeigt Abwesenheit; in der Übersicht Abwesenheit gestreift, Urlaub voll');
  const uid = await p.evaluate(() => D.urlaube.find(u => u.art === 'abwesenheit').id);
  await p.selectOption('[data-fk="u:' + uid + ':art"]', 'urlaub'); await p.waitForTimeout(200);
  ok(await p.evaluate(id => !('art' in D.urlaube.find(u => u.id === id)), uid), 'D: auf „Urlaub“ umgestellt (Feld entfällt)');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  await p.evaluate(() => { UI.view = 'jahr'; UI.monthLists = true; renderNow(); }); await p.waitForTimeout(250);
  const k = await p.evaluate(() => [[...document.querySelectorAll('.day .vbars span')].some(s => /gradient/.test(s.style.background)), [...document.querySelectorAll('.mvac')].some(m => /Urlaub\/Abwesenheit:.*\(abwesend\)/.test(m.textContent))]);
  ok(k[0] && k[1], 'D: Kalender – Abwesenheit gestreift, Monatsliste „Urlaub/Abwesenheit: … (abwesend)“');
  await finish(b, pages);
})();
