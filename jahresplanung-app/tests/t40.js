// 0.9.7 Abschnitte unabhängig: Verschieben nimmt keine Schritte anderer Abschnitte mit (innerhalb weiter verknüpft); Hinweis „hängt an …“
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  const dates = id => p.evaluate(id => { const x = C.byId.get(id); return Object.fromEntries(x.m.plan.steps.filter(s => s.typ !== 'gruppe').map(s => [s.name + '#' + s.id, x.pc.map.get(s.id).end])); }, id);
  const secOf = (id, ids) => p.evaluate(([id, ids]) => { const st = C.byId.get(id).m.plan.steps; let g = ''; const out = {}; for (const s of st) { if (s.typ === 'gruppe') g = s.name; else out[s.name + '#' + s.id] = g; } return out; }, [id, ids]);

  // ---- A: keine Verknüpfungen über Abschnitte mehr (Vorlage Komplex), Termine unverändert
  const a = await p.evaluate(() => D.massnahmen.filter(m => m.plan).map(m => { const sec = new Map(); let g = ''; for (const s of m.plan.steps) { if (s.typ === 'gruppe') g = s.id; else sec.set(s.id, g); }
    return m.plan.steps.filter(s => s.anker && (s.anker.art === 'start' || s.anker.art === 'ende') && sec.get(s.anker.ref) !== sec.get(s.id)).length; }).reduce((x, y) => x + y, 0));
  ok(a === 0, 'A: keine Schritte hängen an Schritten anderer Abschnitte (' + a + ')');
  const tpl = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(D)), m = o.massnahmen.find(m => m.name === 'Sommermailing'); m.plan = JSON.parse(JSON.stringify(MAILING_TEMPLATE)); m.plan.steps.forEach(s => { s.wer = ''; });
    const before = (() => { const c = JSON.parse(JSON.stringify(m)); migratePlan(c.plan, PH().map(p => p.key)); ensurePalStep(c.plan); const r = planCalc(c).map; return c.plan.steps.filter(s => s.typ !== 'gruppe').map(s => r.get(s.id).end); })();
    const n = normalize(o).massnahmen.find(m => m.name === 'Sommermailing'), r = planCalc(n).map; return [before.join(), n.plan.steps.filter(s => s.typ !== 'gruppe').map(s => r.get(s.id).end).join()]; });
  ok(tpl[0] === tpl[1], 'A: beim Umstellen (Laden) bleiben alle Termine gleich');

  // ---- B: Schritt im Inhalt ziehen → Inhalt-Kette wandert mit, Selektion und Produktion bleiben
  await p.evaluate(id => { UI.view = 'plaene'; UI.planSel = id; UI.planPxd = 20; renderNow(); }, sm); await p.waitForTimeout(250);
  const d0 = await dates(sm), sec = await secOf(sm);
  const bar = name => p.evaluate(name => { const rows = [...document.querySelectorAll('.pl-table > .pl-row')], i = rows.findIndex(r => !r.classList.contains('grp') && r.querySelector('.c-name input') && r.querySelector('.c-name input').value === name);
    const e = document.querySelectorAll('.g-body > .g-row')[i - 1].querySelector('.g-bar'); e.scrollIntoView({ block: 'center', inline: 'center' }); const q = e.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, name);
  let c = await bar('Freigaben einholen');
  await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(c[0] + 40, c[1], { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(250);
  const d1 = await dates(sm), moved = Object.keys(d0).filter(k => d1[k] !== d0[k]);
  ok(moved.length > 1 && moved.every(k => sec[k] === 'Inhalt'), 'B: „Freigaben einholen“ +2 Tage – mitgewandert nur im Inhalt: ' + moved.map(k => k.split('#')[0]).join(', '));

  // ---- C: Abschnitt Selektion ziehen → Inhalt bleibt
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  const gs = await p.evaluate(() => { const rows = [...document.querySelectorAll('.pl-table > .pl-row')], i = rows.findIndex(r => r.classList.contains('grp')); const e = document.querySelectorAll('.g-body > .g-row')[i - 1].querySelector('.g-sum'); e.scrollIntoView({ block: 'center', inline: 'center' }); const q = e.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; });
  await p.mouse.move(gs[0], gs[1]); await p.mouse.down(); await p.mouse.move(gs[0] + 100, gs[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250);
  const d2 = await dates(sm), m2 = Object.keys(d0).filter(k => d2[k] !== d0[k]);
  ok(m2.length && m2.every(k => sec[k] === 'Selektion'), 'C: Abschnitt Selektion +5 Tage – nur Selektion verändert (' + m2.length + ' Schritte)');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);

  // ---- D: alte Daten, in denen der Inhalt an der Selektion hängt (wie in der Test-Maßnahme) → Selektion verschieben lässt Inhalt stehen
  const pu = await p.evaluate(() => C.ms.find(x => x.m.name === 'Projekt-Update 1').id);
  const dd = await p.evaluate(id => { const o = JSON.parse(JSON.stringify(D)), m = o.massnahmen.find(m => m.id === id); m.pal = '2027-10-28';
    m.plan = { marks: {}, steps: [{ id: 'gS', typ: 'gruppe', name: 'Selektion', bereich: 'S' }, { id: 'tS', typ: 'aufgabe', name: 'Selektion', dauer: 30, anker: { art: 'pal', offset: -40 } },
      { id: 'gI', typ: 'gruppe', name: 'Inhalt', bereich: 'I' }, { id: 'tI', typ: 'aufgabe', name: 'Inhalt', dauer: 23, anker: { art: 'ende', ref: 'tS', offset: 40 } },
      { id: 'gD', typ: 'gruppe', name: 'Druck', bereich: 'D' }, { id: 'tD', typ: 'aufgabe', name: 'Druck', dauer: 7, anker: { art: 'pal', offset: 0 } }] };
    D = normalize(o); derive(); renderNow(); const x = C.byId.get(id); return [x.m.plan.steps.find(s => s.id === 'tI').anker.art, x.st.I]; }, pu);
  ok(dd[0] === 'pal', 'D: Inhalt hing an der Selektion – beim Laden am PAL festgemacht (Termin bleibt)');
  await p.evaluate(id => { UI.planSel = id; renderNow(); }, pu); await p.waitForTimeout(200);
  c = await bar('Selektion');
  await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(c[0] + 100, c[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(250);
  const d3 = await p.evaluate(id => { const x = C.byId.get(id); return [x.st.S, x.st.I]; }, pu);
  ok(d3[1] === dd[1], 'D: Selektion verschoben – Inhalt bleibt am ' + d3[1]);

  // ---- E: Hinweis am Balken: woran er hängt und wer daran hängt
  await p.evaluate(id => { UI.planSel = id; renderNow(); }, sm); await p.waitForTimeout(200);
  c = await bar('Korrekturphase'); await p.mouse.move(c[0], c[1]); await p.waitForTimeout(350);
  const t1 = await p.evaluate(() => document.querySelector('#tip').textContent);
  c = await bar('Gestaltung'); await p.mouse.move(c[0], c[1]); await p.waitForTimeout(350);
  const t2 = await p.evaluate(() => document.querySelector('#tip').textContent);
  ok(/hängt am Beginn von „Freigaben einholen“/.test(t1) && /daran hängen: .*„Texte erstellen“/.test(t2), 'E: Hinweise – „' + t1.match(/hängt[^·]*/)[0].trim() + '“ · „' + (t2.match(/daran hängen.*$/) || [''])[0] + '“');
  await finish(b, pages);
})();
