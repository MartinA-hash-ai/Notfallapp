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

  // ---- B: Briefkasten-Termin (PAL) ist ein eigener Abschnitt
  const pal = await p.evaluate(id => { const st = C.byId.get(id).m.plan.steps, gi = st.findIndex(s => s.typ === 'gruppe' && s.pal), s = st[gi + 1];
    return [gi >= 0, s && s.pal && s.name, st[gi - 1] && st.slice(0, gi).reverse().find(q => q.typ === 'gruppe').name, st.filter(q => q.pal).length,
      getComputedStyle(document.querySelector('.pl-row.palrow .c-name input')).color, getComputedStyle(document.querySelector('.pl-row.palgrp .gname input')).color, document.querySelector('.pl-row.palrow .paltyp').textContent]; }, sm);
  ok(pal[0] && pal[1] === 'Briefkasten-Termin' && pal[2] === 'Produktion' && pal[3] === 2, 'B: eigener Abschnitt mit dem Briefkasten-Termin direkt nach „' + pal[2] + '“');
  ok(/^rgb\(227, 7, 20\)$/.test(pal[4]) && pal[4] === pal[5] && pal[6] === 'PAL', 'B: Briefkasten-Termin und Abschnitt rot, Typ „PAL“');
  const allPlans = await p.evaluate(() => C.ms.filter(x => x.m.plan).map(x => x.m.plan.steps.filter(s => s.pal).length).join(','));
  ok(/^(2,)*2$/.test(allPlans), 'B: jeder Detailplan hat den PAL-Abschnitt (' + allPlans + ')');
  const pid = await p.evaluate(id => C.byId.get(id).m.plan.steps.find(s => s.pal && s.typ !== 'gruppe').id, sm);
  await p.evaluate(([id, pid]) => deleteStep(id, pid), [sm, pid]); await p.waitForTimeout(100);
  ok(await p.evaluate(([id, pid]) => findM(D, id).plan.steps.some(s => s.id === pid), [sm, pid]), 'B: Briefkasten-Termin lässt sich nicht löschen');
  await p.fill(`[data-fk="st:${pid}:end"]`, '2027-06-25'); await p.press(`[data-fk="st:${pid}:end"]`, 'Enter'); await p.waitForTimeout(200);
  ok(await p.evaluate(id => findM(D, id).pal, sm) === '2027-06-25', 'B: Datum am Briefkasten-Termin ändern = PAL ändern');
  await p.evaluate(() => undo()); await p.waitForTimeout(100);
  const fresh = await p.evaluate(() => { const d = normalize({ settings: { year: 2027 }, massnahmen: [{ id: 'q', name: 'Q', pal: '2027-05-01', plan: { steps: [{ id: 'g1', typ: 'gruppe', name: 'Produktion' }, { id: 'a', typ: 'aufgabe', name: 'A', dauer: 5, anker: { art: 'pal', offset: -5 } }, { id: 'z', typ: 'ziel', name: 'Briefkasten-Termin', anker: { art: 'pal', offset: 0 } }, { id: 'g2', typ: 'gruppe', name: 'Dankbrief' }] } }] });
    return d.massnahmen[0].plan.steps.map(s => s.id).join(','); });
  ok(fresh === 'g1,a,g-pal-z,z,g2', 'B: alte Pläne werden umgestellt (' + fresh + ')');
  const idem = await p.evaluate(() => { const a = JSON.stringify(D), b = JSON.stringify(normalize(JSON.parse(a))); const n1 = normalize({ settings: { year: 2027 }, massnahmen: [{ id: 'q', name: 'Q', pal: '2027-05-01', plan: { steps: [{ id: 'g1', typ: 'gruppe', name: 'X' }] } }] }), n2 = normalize(JSON.parse(JSON.stringify(n1)));
    return [a === b, JSON.stringify(n1) === JSON.stringify(n2), n1.massnahmen[0].plan.steps.map(s => s.typ + (s.pal ? '*' : '')).join(',')]; });
  ok(idem[0] && idem[1] && idem[2] === 'gruppe,gruppe*,ziel*', 'B: erneutes Prüfen ändert nichts mehr (auch bei Plan ohne Briefkasten-Termin: ' + idem[2] + ')');

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
  ok(after[0].every((r, i) => r[0] - grp.pos[i][0] === 7 && r[1] - grp.pos[i][1] === 7) && after[1] === grp.pal, 'C: Abschnitt „Inhalt“ um 7 Tage gezogen – alle ' + grp.ids.length + ' Schritte +7, PAL bleibt');
  ok(during[0] === 1 && !during[1] && during[2] === 'rgb(255, 255, 255)', 'C: beim Ziehen nur ein (helles) Fenster');
  await p.evaluate(() => undo()); await p.waitForTimeout(100);
  await p.evaluate(([id, gid]) => { shiftGroupDialog(id, gid); }, [sm, grp.gid]); await p.waitForTimeout(150);
  const newStart = await p.evaluate(v => ds(v + 14), Math.min(...grp.pos.map(r => r[0])));
  await p.fill('.modal input[type=date]', newStart); await p.click('.modal footer button.primary'); await p.waitForTimeout(250);
  const after2 = await p.evaluate(([id, ids]) => ids.map(i => C.byId.get(id).pc.map.get(i).start), [sm, grp.ids]);
  ok(after2.every((v, i) => v - grp.pos[i][0] === 14), 'C: „Abschnitt verschieben …“ auf neuen Beginn ' + newStart + ' → alle Schritte +14 Tage');
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
