// 0.9.6 Detailplan-Gantt: PAL als rotes P (ziehbar, ganzer Plan wandert mit), Balken von Tagesmitte zu Tagesmitte, Ziel = nur noch Briefkasten-Termin
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  await p.evaluate(id => { UI.view = 'plaene'; UI.planSel = id; UI.planPxd = 30; renderNow(); }, sm); await p.waitForTimeout(250);

  // ---- A: PAL-Zeile im Gantt: rotes P statt Raute
  const a = await p.evaluate(() => { const rows = [...document.querySelectorAll('.pl-table > .pl-row[data-rid]')], i = rows.findIndex(r => r.classList.contains('palrow'));
    const g = document.querySelectorAll('.g-body > .g-row')[[...document.querySelectorAll('.pl-table > .pl-row')].indexOf(rows[i]) - 1], c = g && g.querySelector('.g-pal');
    return c ? [c.textContent, getComputedStyle(c).backgroundColor, !!g.querySelector('.g-dia')] : null; });
  ok(a && a[0] === 'P' && a[1] === 'rgb(227, 7, 20)' && !a[2], 'A: Briefkasten-Termin im Gantt als rotes „P“ (' + JSON.stringify(a) + ')');

  // ---- B: Balken enden in der Tagesmitte – genau an der PAL-Linie bzw. am Meilenstein
  const bb = await p.evaluate(() => { const pl = document.querySelector('.palline').getBoundingClientRect().left, pal = document.querySelector('.g-pal').getBoundingClientRect();
    const bars = [...document.querySelectorAll('.g-bar')].map(e => e.getBoundingClientRect().right), near = bars.filter(r => Math.abs(r - pl) < 3).length;
    return [near, Math.round(Math.abs(pal.left + pal.width / 2 - pl))]; });
  ok(bb[0] >= 2 && bb[1] <= 1, 'B: ' + bb[0] + ' Balken enden genau an der PAL-Linie (Tagesmitte), das P sitzt darauf');
  const ms = await p.evaluate(() => { const x = C.byId.get(UI.planSel), s = x.m.plan.steps.find(s => s.typ === 'meilenstein' && s.anker.art === 'start'), ref = x.m.plan.steps.find(q => q.id === s.anker.ref);
    const rid = id => [...document.querySelectorAll('.pl-table > .pl-row')].findIndex(r => r.dataset.rid === id) - 1, rows = document.querySelectorAll('.g-body > .g-row');
    const d = rows[rid(s.id)].querySelector('.g-dia').getBoundingClientRect(), bar = rows[rid(ref.id)].querySelector('.g-bar').getBoundingClientRect();
    return [s.name, ref.name, Math.round(Math.abs(d.left + d.width / 2 - bar.left))]; });
  ok(ms[2] <= 1, 'B: Meilenstein „' + ms[0] + '“ sitzt genau am Balkenbeginn von „' + ms[1] + '“ (' + ms[2] + ' px)');

  // ---- C: P ziehen → PAL und alle Schritte (auch mit festem Datum) wandern mit
  await p.evaluate(id => { commit(d => { const m = d.massnahmen.find(m => m.id === id), s = m.plan.steps.find(s => s.name === 'Thema definieren'); const r = planCalc(m).map.get(s.id); s.anker = { art: 'fest', datum: ds(r.end) }; }); renderNow(); }, sm);
  const before = await p.evaluate(id => { const x = C.byId.get(id); return { pal: x.pal, ends: x.m.plan.steps.filter(s => s.typ !== 'gruppe').map(s => x.pc.map.get(s.id).end) }; }, sm);
  const pc = await p.evaluate(() => { const c = document.querySelector('.g-pal'); c.scrollIntoView({ block: 'center', inline: 'center' }); const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.mouse.move(pc[0], pc[1]); await p.mouse.down(); await p.mouse.move(pc[0] + 45, pc[1], { steps: 4 }); await p.mouse.move(pc[0] + 90, pc[1], { steps: 4 });
  const mid = await p.evaluate(() => [document.querySelector('.g-bar').style.translate, (document.querySelector('.drag-lab') || {}).textContent]);
  ok(mid[0] === '90px 0px' || mid[0] === '90px', 'C: beim Ziehen wandern die Balken schon mit (' + mid[0] + ') – „' + mid[1] + '“');
  await p.mouse.up(); await p.waitForTimeout(250);
  const after = await p.evaluate(id => { const x = C.byId.get(id); return { pal: x.pal, ends: x.m.plan.steps.filter(s => s.typ !== 'gruppe').map(s => x.pc.map.get(s.id).end) }; }, sm);
  const dated = before.ends.map((e, i) => [e, after.ends[i]]).filter(([e]) => e != null);
  ok(after.pal === before.pal + 3 && dated.every(([e, f]) => f === e + 3), 'C: PAL +3 Tage, alle ' + dated.length + ' Schritte mit Termin (auch der mit festem Datum) +3 Tage (' + (after.pal - before.pal) + ')');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  ok(await p.evaluate(([id, pal]) => C.byId.get(id).pal === pal, [sm, before.pal]), 'C: Strg+Z nimmt es zurück');

  // ---- D: Ziel und Meilenstein vereinheitlicht
  const d = await p.evaluate(() => { const row = document.querySelector('.pl-row.palrow'), t = row.querySelector('.c-typ'), sel = document.querySelector('.pl-row:not(.palrow) .c-typ select');
    return [t.textContent, getComputedStyle(t.firstElementChild).color, [...sel.options].map(o => o.textContent).join('|'), D.massnahmen.flatMap(m => m.plan ? m.plan.steps : []).filter(s => s.typ === 'ziel' && !s.pal).length, D.massnahmen.filter(m => m.plan).length]; });
  ok(d[0] === 'Ziel' && d[1] === 'rgb(227, 7, 20)', 'D: Typ der PAL-Zeile „' + d[0] + '“ in Rot');
  ok(d[2] === 'Aufgabe|Meilenstein' && d[3] === 0, 'D: Auswahl nur noch „' + d[2] + '“, keine anderen Ziele mehr in den Daten');
  const old = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(D)); const m = o.massnahmen.find(m => m.plan); m.plan.steps.find(s => s.typ === 'meilenstein').typ = 'ziel';
    const n = normalize(o); const n2 = normalize(JSON.parse(JSON.stringify(n)));
    return [n.massnahmen.flatMap(m => m.plan ? m.plan.steps : []).filter(s => s.typ === 'ziel').map(s => !!s.pal), JSON.stringify(n) === JSON.stringify(n2)]; });
  ok(old[0].length === d[4] && old[0].every(Boolean) && old[1], 'D: alte Daten – „Ziel“ wird Meilenstein, nur der Briefkasten-Termin bleibt Ziel; Umstellung stabil');

  // ---- E: P im Kalender ziehen verschiebt feste Termine ebenfalls (gleiche Regel)
  const e = await p.evaluate(id => { commit(d => { const m = d.massnahmen.find(m => m.id === id), s = m.plan.steps.find(s => s.name === 'Thema definieren'); s.anker = { art: 'fest', datum: '2027-05-03' }; shiftPal(m, 7); });
    const s = D.massnahmen.find(m => m.id === id).plan.steps.find(s => s.name === 'Thema definieren'); return s.anker.datum; }, sm);
  ok(e === '2027-05-10', 'E: PAL verschieben nimmt feste Termine mit (' + e + ')');

  // ---- F: Zeitleiste, aufgeklappter Detailplan – Schritte ebenfalls auf der Tagesmitte
  await p.evaluate(id => { UI.view = 'zeit'; tlOpen.add(id); renderNow(); }, sm); await p.waitForTimeout(250);
  const f = await p.evaluate(id => { const dia = document.querySelector('.tl-row[data-m="' + id + '"] .dia').getBoundingClientRect(), bars = [...document.querySelectorAll('.tl-row.sub .sbar')].map(e => e.getBoundingClientRect().right);
    return bars.filter(r => Math.abs(r - (dia.left + dia.width / 2)) < 2).length; }, sm);
  ok(f >= 2, 'F: Zeitleiste – ' + f + ' Schritt-Balken enden genau am PAL-Punkt');
  await finish(b, pages);
})();
