// 0.8.6 PDF „Wie aktuelle Ansicht“ im Detailplan: Tabelle nur eingeklappt, wenn sie es gerade ist; eingeklappte Abschnitte wie zu sehen
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  const run = async (compact, coll) => {
    await p.evaluate(([id, c, coll]) => { UI.view = 'plaene'; UI.planSel = id; UI.planCompact = c; UI.planColl = coll ? { [id + ':' + C.byId.get(id).m.plan.steps[0].id]: 1 } : {}; renderNow(); window.print = () => {}; }, [sm, compact, coll]);
    await p.evaluate(() => { pdfDialog(); }); await p.waitForTimeout(200);
    const def = await p.evaluate(() => [...document.querySelectorAll('.modal label.check')].find(l => /nur Arbeitsschritte/.test(l.textContent)).querySelector('input').checked);
    await p.click('.modal button:has-text("Wie aktuelle Ansicht")'); await p.waitForTimeout(100);
    await p.click('.modal footer button.primary'); await p.waitForTimeout(300);
    const r = await p.evaluate(id => { const pl = document.querySelector('#printdoc .pd-plan'), g = pl.querySelector('.g-head');
      return { compact: pl.querySelector('.pl-split').classList.contains('compact'), cols: pl.querySelectorAll('.pl-row.head > div').length, gw: parseFloat(g.style.width),
        rows: pl.querySelectorAll('.pl-row[data-rid]').length, all: C.byId.get(id).m.plan.steps.length, after: [UI.planCompact, Object.keys(UI.planColl).length] }; }, sm);
    await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    return Object.assign(r, { def });
  };
  const full = await run(false, false);
  ok(!full.def && !full.compact && full.cols === 9 && full.gw <= 432, 'A: Ansicht mit allen Spalten → PDF mit allen Spalten (' + full.cols + ' Spalten), Gantt passt aufs Blatt (' + Math.round(full.gw) + ' px)');
  ok(full.rows === full.all && full.after[0] === false, 'A: alle Zeilen im PDF, Ansicht danach unverändert');
  const comp = await run(true, false);
  ok(comp.def && comp.compact && comp.cols === 3, 'B: eingeklappte Tabelle → PDF nur mit Arbeitsschritten und breitem Gantt (Häkchen im Dialog vorbelegt)');
  const coll = await run(false, true);
  ok(!coll.compact && coll.rows < coll.all && coll.after[1] === 1, 'C: eingeklappter Abschnitt bleibt im PDF eingeklappt (' + coll.rows + ' von ' + coll.all + ' Zeilen), in der Ansicht weiter eingeklappt');
  // ohne „Wie aktuelle Ansicht“: Häkchen im Dialog entscheidet
  await p.evaluate(id => { UI.view = 'plaene'; UI.planSel = id; UI.planCompact = false; UI.planColl = {}; renderNow(); }, sm);
  await p.evaluate(() => { pdfDialog(); }); await p.waitForTimeout(200);
  await p.evaluate(() => { const l = [...document.querySelectorAll('.modal label.check')]; l.find(q => /Detailpläne \(je Plan/.test(q.textContent)).querySelector('input').click(); l.find(q => /nur Arbeitsschritte/.test(q.textContent)).querySelector('input').click(); });
  await p.click('.modal footer button.primary'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => [...document.querySelectorAll('#printdoc .pd-plan .pl-split')].every(s => s.classList.contains('compact')) && UI.planCompact === false), 'D: Häkchen „nur Arbeitsschritte“ gesetzt → alle Detailpläne eingeklappt gedruckt, Ansicht bleibt');
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await finish(b, pages);
})();
