// 0.9 Namensauswahl mit allen Personen, Abschnitt als Ganzes verschieben, Briefkasten-Termin (PAL) als eigener Abschnitt,
// ein helles Ziehfenster mit Werktagen, „Spendenbitte“
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  await p.evaluate(id => { UI.view = 'plaene'; UI.planSel = id; renderNow(); }, sm); await p.waitForTimeout(200);

  // ---- A: Namensauswahl zeigt immer alle Personen
  const sid = await p.evaluate(id => { const x = C.byId.get(id), s = x.m.plan.steps.find(q => q.typ === 'aufgabe' && !q.wer); return s.id; }, sm);
  await p.evaluate(([id, sid]) => commit(d => { findM(d, id).plan.steps.find(q => q.id === sid).wer = 'Martin'; }), [sm, sid]); await p.waitForTimeout(150);
  const sel = `[data-fk="st:${sid}:wer"]`;
  await p.click(sel); await p.waitForTimeout(200);
  const names = await p.evaluate(() => [...document.querySelectorAll('.menu.pcombo .pc-item')].map(b => b.textContent));
  const all = await p.evaluate(() => D.personen.map(q => q.name));
  ok(names[0] === '– niemand' && all.every(n => names.includes(n)) && all.length >= 3, 'A: bei eingetragenem „Martin“ zeigt die Liste alle Namen: ' + names.join(', '));
  await p.click('.menu.pcombo .pc-item:has-text("Eva")'); await p.waitForTimeout(200);
  ok(await p.evaluate(([id, sid]) => findM(D, id).plan.steps.find(q => q.id === sid).wer, [sm, sid]) === 'Eva' && !(await p.$('.menu.pcombo')), 'A: Klick auf „Eva“ übernimmt den Namen');
  await p.click(sel); await p.fill(sel, 'Neue Kollegin'); await p.waitForTimeout(100);
  const hint = await p.evaluate(() => (document.querySelector('.menu.pcombo .pc-new') || {}).textContent || '');
  await p.press(sel, 'Enter'); await p.waitForTimeout(200);
  const nk = await p.evaluate(([id, sid]) => [findM(D, id).plan.steps.find(q => q.id === sid).wer, D.personen.some(q => q.name === 'Neue Kollegin')], [sm, sid]);
  ok(/neue Person/.test(hint) && nk[0] === 'Neue Kollegin' && nk[1], 'A: neuer Name eintippen + Enter legt die Person an ' + JSON.stringify([hint, nk]));
  await p.click(sel); await p.waitForTimeout(150); await p.click('.menu.pcombo .pc-item.none'); await p.waitForTimeout(200);
  ok(await p.evaluate(([id, sid]) => findM(D, id).plan.steps.find(q => q.id === sid).wer, [sm, sid]) === '', 'A: „– niemand“ leert das Feld');
  await p.click(sel); await p.waitForTimeout(150); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  ok(await p.evaluate(([id, sid]) => findM(D, id).plan.steps.find(q => q.id === sid).wer, [sm, sid]) === all[0], 'A: Pfeiltasten + Enter wählen (' + all[0] + ')');

  // ---- B: Briefkasten-Termin (PAL) ist eine feste, rote Zeile im Plan (kein eigener Abschnitt)
  const pal = await p.evaluate(id => { const st = C.byId.get(id).m.plan.steps, i = st.findIndex(s => s.pal), row = document.querySelector('.pl-row.palrow'), inp = row.querySelector('.c-name input'), cs = getComputedStyle(inp);
    return [i >= 0 && st[i].name, st.slice(0, i).reverse().find(q => q.typ === 'gruppe').name, st.filter(q => q.pal).length, st.some(q => q.typ === 'gruppe' && q.pal), cs.color, cs.fontWeight,
      row.querySelector('.paltyp').textContent, !!row.querySelector('.pallock'), !!row.querySelector('input[type=date]'), (row.querySelector('.paldate') || {}).textContent]; }, sm);
  ok(pal[0] === 'Briefkasten-Termin' && pal[1] === 'Produktion' && pal[2] === 1 && !pal[3], 'B: Briefkasten-Termin als Zeile im Abschnitt „' + pal[1] + '“, kein eigener Abschnitt');
  ok(/^rgb\(227, 7, 20\)$/.test(pal[4]) && +pal[5] < 600 && pal[6] === 'Ziel', 'B: rot, nicht fett, Typ „Ziel“');
  ok(pal[7] && !pal[8] && /^\d\d\.\d\d\.\d{4}P$/.test(pal[9]), 'B: Datum fest (' + pal[9] + ') mit Schloss und P, kein Eingabefeld');
  const allPlans = await p.evaluate(() => C.ms.filter(x => x.m.plan).map(x => x.m.plan.steps.filter(s => s.pal).length).join(','));
  ok(/^(1,)*1$/.test(allPlans), 'B: jeder Detailplan hat genau einen Briefkasten-Termin (' + allPlans + ')');
  const pid = await p.evaluate(id => C.byId.get(id).m.plan.steps.find(s => s.pal).id, sm);
  await p.evaluate(([id, pid]) => deleteStep(id, pid), [sm, pid]); await p.waitForTimeout(100);
  ok(await p.evaluate(([id, pid]) => findM(D, id).plan.steps.some(s => s.id === pid), [sm, pid]), 'B: Briefkasten-Termin lässt sich nicht löschen');
  const dia = await p.evaluate(pid => { const rows = [...document.querySelectorAll('.pl-table > .pl-row:not(.head)')], i = rows.findIndex(r => r.dataset.rid === pid), e = document.querySelectorAll('.g-body > .g-row')[i].querySelector('.g-pal');
    e.scrollIntoView({ block: 'center', inline: 'center' }); const q = e.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2, UI._pl.pxd]; }, pid);
  const pal0 = await p.evaluate(id => findM(D, id).pal, sm);
  await p.mouse.move(dia[0], dia[1]); await p.mouse.down(); await p.mouse.move(dia[0] + 2 * dia[2], dia[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
  ok(await p.evaluate(([id, p0]) => dn(findM(D, id).pal) === dn(p0) + 2, [sm, pal0]), 'B: das P im Gantt verschiebt das PAL (0.9.6: ganzer Plan wandert mit)');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  const fresh = await p.evaluate(() => { const mk = steps => normalize({ settings: { year: 2027 }, massnahmen: [{ id: 'q', name: 'Q', pal: '2027-05-01', plan: { steps } }] }).massnahmen[0].plan.steps.map(s => s.id + (s.pal ? '*' : '')).join(',');
    const base = () => [{ id: 'g1', typ: 'gruppe', name: 'Produktion' }, { id: 'a', typ: 'aufgabe', name: 'A', dauer: 5, anker: { art: 'pal', offset: -5 } }];
    return [mk(base().concat({ id: 'z', typ: 'ziel', name: 'Briefkasten-Termin', anker: { art: 'pal', offset: 0 } }, { id: 'g2', typ: 'gruppe', name: 'Dankbrief' })),
      mk(base().concat({ id: 'g-pal-z', typ: 'gruppe', name: 'Briefkasten-Termin (PAL)', pal: true }, { id: 'z', typ: 'ziel', name: 'Briefkasten-Termin', pal: true, anker: { art: 'pal', offset: 0 } }, { id: 'g2', typ: 'gruppe', name: 'Dankbrief' }))]; });
  ok(fresh[0] === 'g1,a,z*,g2' && fresh[1] === 'g1,a,z*,g2', 'B: alte Pläne und der PAL-Abschnitt aus 0.9 werden umgestellt (' + fresh.join(' | ') + ')');
  const idem = await p.evaluate(() => { const a = JSON.stringify(D), b = JSON.stringify(normalize(JSON.parse(a))); const n1 = normalize({ settings: { year: 2027 }, massnahmen: [{ id: 'q', name: 'Q', pal: '2027-05-01', plan: { steps: [{ id: 'g1', typ: 'gruppe', name: 'X' }] } }] }), n2 = normalize(JSON.parse(JSON.stringify(n1)));
    return [a === b, JSON.stringify(n1) === JSON.stringify(n2), n1.massnahmen[0].plan.steps.map(s => s.typ + (s.pal ? '*' : '')).join(',')]; });
  ok(idem[0] && idem[1] && idem[2] === 'gruppe,ziel*', 'B: erneutes Prüfen ändert nichts mehr (Plan ohne Briefkasten-Termin bekommt einen: ' + idem[2] + ')');

  // ---- C: Abschnitt als Ganzes verschieben (Gantt-Balken ziehen)
  const grp = await p.evaluate(id => { const x = C.byId.get(id), st = x.m.plan.steps, g = st.find(s => s.typ === 'gruppe' && s.bereich === 'I'), bl = groupBlocks(st).get(g.id);
    return { gid: g.id, ids: st.slice(bl[0] + 1, bl[1]).map(s => s.id), pos: st.slice(bl[0] + 1, bl[1]).map(s => { const r = x.pc.map.get(s.id); return [r.start, r.end]; }), pal: x.pal }; }, sm);
  const pxd = await p.evaluate(() => UI._pl.pxd);
  const gs = await p.evaluate(gid => { const rows = [...document.querySelectorAll('.pl-table > .pl-row:not(.head)')], i = rows.findIndex(r => r.dataset.rid === gid), e = document.querySelectorAll('.g-body > .g-row')[i].querySelector('.g-sum');
    e.scrollIntoView({ block: 'center', inline: 'center' }); const q = e.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, grp.gid);
  await p.mouse.move(gs[0], gs[1]); await p.mouse.down(); await p.mouse.move(gs[0] + 7 * pxd, gs[1], { steps: 6 });
  const during = await p.evaluate(() => [document.querySelectorAll('.drag-lab').length, !!document.querySelector('#tip.on'), document.querySelector('.drag-lab') && getComputedStyle(document.querySelector('.drag-lab')).backgroundColor]);
  await p.mouse.up(); await p.waitForTimeout(250);
  const after = await p.evaluate(([id, ids]) => { const x = C.byId.get(id); return [ids.map(i => { const r = x.pc.map.get(i); return [r.start, r.end]; }), x.pal]; }, [sm, grp.ids]);
  // ab 0.13.7 zählen Dauern in Werktagen: Feiertage im neuen Zeitraum (Himmelfahrt, Pfingsten, Fronleichnam) verschieben einzelne Termine um 1–2 Tage mehr
  const sh = after[0].map((r, i) => [r[0] - grp.pos[i][0], r[1] - grp.pos[i][1]]);
  // ab 0.14: die Dauer (WT) bleibt, das Ende ist der Übergabetag – mit Himmelfahrt und Pfingstmontag im neuen Zeitraum bis zu +3 Tage
  const durSame = await p.evaluate(([id, ids]) => { const x = C.byId.get(id); return ids.every(i => { const s = x.m.plan.steps.find(q => q.id === i), r = x.pc.map.get(i); return s.typ !== 'aufgabe' || wtSpan(r.start, r.end) === +s.dauer; }); }, [sm, grp.ids]);
  ok(sh[0][0] === 7 && sh.every(([a, e]) => a >= 4 && a <= 10 && e >= 4 && e <= 10) && durSame && after[1] === grp.pal, 'C: Abschnitt „Inhalt“ um 7 Tage gezogen – alle ' + grp.ids.length + ' Schritte +7 (Feiertage im Zeitraum: ±3), Dauern (WT) bleiben, PAL bleibt (' + sh.map(x => x.join('/')).join(' ') + ')');
  ok(during[0] === 1 && !during[1] && during[2] === 'rgb(255, 255, 255)', 'C: beim Ziehen nur ein (helles) Fenster');
  await p.evaluate(() => undo()); await p.waitForTimeout(100);
  await p.evaluate(([id, gid]) => { shiftGroupDialog(id, gid); }, [sm, grp.gid]); await p.waitForTimeout(150);
  const newStart = await p.evaluate(v => ds(v + 14), Math.min(...grp.pos.map(r => r[0])));
  await p.fill('.modal input[type=date]', newStart); await p.click('.modal footer button.primary'); await p.waitForTimeout(250);
  const after2 = await p.evaluate(([id, ids]) => ids.map(i => C.byId.get(id).pc.map.get(i).start), [sm, grp.ids]);
  const sh2 = after2.map((v, i) => v - grp.pos[i][0]);
  const nsd = await p.evaluate(v => nextWorkday(dn(v)), newStart);   // 06.05.2027 ist Christi Himmelfahrt → Freitag
  const ok2 = await p.evaluate(([id, ids]) => { const x = C.byId.get(id); return ids.every(i => { const s = x.m.plan.steps.find(q => q.id === i), r = x.pc.map.get(i);
    return (s.typ !== 'aufgabe' || wtSpan(r.start, r.end) === +s.dauer) && predsOf(s).every(a => !ids.includes(a) || x.pc.map.get(a).end <= r.start); }); }, [sm, grp.ids]);
  // ab 0.14: Dauern (WT) bleiben, Verknüpfte beginnen am Übergabetag – Himmelfahrt, Pfingstmontag und Wochenenden schieben einzelne Schritte bis zu 4 Tage weiter
  ok(Math.min(...after2) === nsd && sh2.every(v => v >= 14 && v <= 18) && ok2, 'C: „Abschnitt verschieben …“ auf neuen Beginn ' + newStart + ' → beginnt am ' + await p.evaluate(n => fmtW(n), nsd) + ', alle Schritte +14 Tage und mehr (Feiertage; ' + sh2.join(' ') + '), Dauern und Verknüpfungen bleiben');
  await p.evaluate(() => undo()); await p.waitForTimeout(100);

  // ---- D: Hinweis am Balken ohne „Ziehen = …“, in Werktagen
  const bar = await p.evaluate(id => { const x = C.byId.get(id), s = x.m.plan.steps.find(q => q.typ === 'aufgabe' && x.pc.map.get(q.id).end - x.pc.map.get(q.id).start >= 7), r = x.pc.map.get(s.id);
    const rows = [...document.querySelectorAll('.pl-table > .pl-row:not(.head)')], i = rows.findIndex(q => q.dataset.rid === s.id), e = document.querySelectorAll('.g-body > .g-row')[i].querySelector('.g-bar');
    e.scrollIntoView({ block: 'center', inline: 'center' }); const q = e.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2, stepWT(r.start, r.end)]; }, sm);
  await p.mouse.move(bar[0], bar[1] - 1); await p.mouse.move(bar[0], bar[1]); await p.waitForTimeout(300);
  const tip = await p.evaluate(() => document.querySelector('#tip').innerText);
  ok(!/Ziehen/.test(tip) && /· \d+ WT/.test(tip) && tip.includes(bar[2] + ' WT') && !/Tage/.test(tip), 'D: Hinweis „' + tip.replace(/\n/g, ' / ') + '“');

  // ---- E: Spendenbitte
  await p.evaluate(() => { UI.view = 'jahr'; renderNow(); }); await p.waitForTimeout(200);
  const sp = await p.evaluate(() => { const th = document.querySelector('.mtable th.h-bitte'), s = document.querySelector('.mtable td.art select'), cs = getComputedStyle(s); return [th.textContent.trim(), cs.appearance, cs.backgroundImage.includes('svg')]; });
  ok(sp[0] === 'Spendenbitte' && sp[1] === 'none' && sp[2], 'E: Spalte „Spendenbitte“ mit dezentem Pfeil');
  await finish(b, pages);
})();
