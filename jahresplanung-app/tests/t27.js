// 0.8.1 Maßnahmentabelle (Köpfe zweizeilig, Schalter Datum/Werktage, graue Bereichsspalten, Spaltenbreite nur mit Nachbarspalte, bleibt erhalten)
// und neuer Dialog „Detailplan anlegen“ (PAL Pflicht, Datum ↔ Werktage, Einfach / Komplex / Kopie)
const { chromium, T, ORIG, ok, open, finish, fs } = require('./lib');
const path = require('path');
(async () => {
  const b = await chromium.launch(), pages = [];
  const cols = p => p.evaluate(() => [...document.querySelectorAll('.mtable thead tr:last-child th')].map(t => { const r = t.getBoundingClientRect(); return { k: t.className.match(/h-(\S+)/)[1], x: Math.round(r.left), w: Math.round(r.width) }; }));
  const drag = async (p, k, dx) => {
    const g = await p.evaluate(k => { const r = document.querySelector('.mtable th.h-' + k + ' .col-rs').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, k);
    await p.mouse.move(g[0], g[1]); await p.mouse.down(); await p.mouse.move(g[0] + dx, g[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
  };
  const same = (a, b, skip) => a.filter(c => !skip.includes(c.k)).every(c => { const d = b.find(q => q.k === c.k); return d && Math.abs(d.x - c.x) <= 1 && Math.abs(d.w - c.w) <= 1; });

  // ---- A: Köpfe, Ausrichtung, Graustufe, Schalter
  { const f = path.resolve('breiten.html'); fs.writeFileSync(f, ORIG);
    const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    let p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); pages.push(p);
    await p.goto('file://' + f); await p.waitForTimeout(400);
    const hd = await p.evaluate(() => ['S', 'I', 'D'].map(k => { const t = document.querySelector('.mtable th.h-ph_' + k + ' .th2'); return t.children[0].textContent + ' / ' + t.children[1].textContent; }));
    ok(hd.join(' | ') === 'Start der / SelektionS | Start des / InhaltsI | Start der / ProduktionD', 'A: Köpfe zweizeilig: ' + hd.join(' | '));
    const al = await p.evaluate(() => { const th = document.querySelector('.mtable th.h-ph_S'), inp = document.querySelector('.mtable td.ph input[type=date]'), l = th.querySelector('.th2 small').getBoundingClientRect().left - th.getBoundingClientRect().left;
      return [getComputedStyle(th).textAlign, getComputedStyle(inp).textAlign, Math.round(l)]; });
    ok(/left|start/.test(al[0]) && /left|start/.test(al[1]) && al[2] < 12, 'A: Kopf und Datum linksbündig ' + JSON.stringify(al));
    const bg = await p.evaluate(() => { const r = document.querySelector('.mtable tbody tr'), ph = r.querySelector('td.ph'), nm = r.querySelector('td.name'), cs = getComputedStyle(ph);
      return [cs.backgroundColor, getComputedStyle(nm).backgroundColor, cs.borderLeftWidth, cs.borderLeftStyle, [...r.querySelectorAll('td.ph')].length]; });
    ok(bg[0] !== bg[1] && bg[2] === '1px' && bg[3] === 'solid' && bg[4] === 3, 'A: Bereichsspalten grau hinterlegt und mit Strichen getrennt ' + JSON.stringify(bg));
    const sw = await p.evaluate(() => { const g = document.querySelector('.mtable .grouprow th.gr-ph').getBoundingClientRect(), s = document.querySelector('.mtable th.h-ph_S').getBoundingClientRect(), d = document.querySelector('.mtable th.h-ph_D').getBoundingClientRect();
      return [Math.round(g.left - s.left), Math.round(g.right - d.right), getComputedStyle(document.querySelector('.mtable .grouprow th.gr-ph')).backgroundColor, getComputedStyle(document.querySelector('.mtable th.h-ph_S')).backgroundColor,
        !!document.querySelector('.sec[data-sec="mass"] .segs'), document.querySelector('.vswitch').textContent]; });
    ok(sw[0] === 0 && sw[1] === 0 && sw[2] !== sw[3] && !sw[4] && sw[5] === 'DatumWerktage', 'A: Schalter „Datum – Werktage“ genau über den drei Spalten, heller als der Kopf, alter Umschalter weg ' + JSON.stringify(sw));
    await p.click('.vswitch .vs-track'); await p.waitForTimeout(150);
    const w1 = await p.evaluate(() => [UI.startView, document.querySelectorAll('.mtable td.ph input[type=number]').length > 0, document.querySelector('.vswitch').classList.contains('on'), document.querySelector('.vswitch .vs-track').getAttribute('aria-checked')]);
    await p.click('.vswitch .vs-track'); await p.waitForTimeout(150);
    const w2 = await p.evaluate(() => [UI.startView, document.querySelectorAll('.mtable td.ph input[type=number]').length, document.querySelectorAll('.mtable td.ph input[type=date]').length > 0]);
    ok(w1[0] === 'wt' && w1[1] && w1[2] && w1[3] === 'true' && w2[0] === 'date' && w2[1] === 0 && w2[2], 'A: Schalter wechselt Werktage ↔ Datum ' + JSON.stringify([w1, w2]));
    await p.click('.vswitch .vs-lab:has-text("Werktage")'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => UI.startView) === 'wt', 'A: Klick auf das Wort „Werktage“ schaltet ebenfalls');
    await p.click('.vswitch .vs-lab:has-text("Datum")'); await p.waitForTimeout(150);
    await p.screenshot({ path: 'r81_tabelle.png', clip: { x: 0, y: 150, width: 1600, height: 330 } });

    // ---- B: Spaltenbreite – nur die rechte Nachbarspalte ändert sich
    let c0 = await cols(p);
    await drag(p, 'name', 40);
    let c1 = await cols(p);
    const d = k => c1.find(q => q.k === k).w - c0.find(q => q.k === k).w;
    ok(Math.abs(d('name') - 40) <= 2 && Math.abs(d('resp') + 40) <= 2 && same(c0, c1, ['name', 'resp']), 'B: „Maßnahme“ +' + d('name') + ' → „Hauptverantwortlich“ ' + d('resp') + ', alle anderen Spalten bleiben stehen');
    c0 = c1; await drag(p, 'ph_S', 24); c1 = await cols(p);
    ok(Math.abs(d('ph_S') - 24) <= 2 && Math.abs(d('ph_I') + 24) <= 2 && same(c0, c1, ['ph_S', 'ph_I']), 'B: Start Selektion +' + d('ph_S') + ' → Start Inhalt ' + d('ph_I') + ', Rest unverändert');
    c0 = c1; await drag(p, 'bitte', 30); c1 = await cols(p);
    ok(Math.abs(d('bitte') - 30) <= 2 && Math.abs(d('hinweis') + 30) <= 2 && same(c0, c1, ['bitte', 'hinweis']), 'B: „Spendenbitte“ +' + d('bitte') + ' → „Hinweis“ ' + d('hinweis') + ', Rest unverändert');
    c0 = c1; await drag(p, 'resp', -500); c1 = await cols(p);
    ok(c1.find(q => q.k === 'resp').w >= 39 && same(c0, c1, ['resp', 'auflage']), 'B: sehr schmal ziehen stoppt bei ' + c1.find(q => q.k === 'resp').w + ' px');
    await drag(p, "resp", 0);                                              // Klick ohne Ziehen ändert nichts
    const c2 = await cols(p);
    ok(same(c1, c2, []), 'B: Klick ohne Ziehen ändert nichts');
    // Abbrechen mit Esc
    const g = await p.evaluate(() => { const r = document.querySelector('.mtable th.h-name .col-rs').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await p.mouse.move(g[0], g[1]); await p.mouse.down(); await p.mouse.move(g[0] + 60, g[1], { steps: 5 }); await p.keyboard.press('Escape'); await p.mouse.up(); await p.waitForTimeout(150);
    ok(same(c2, await cols(p), []), 'B: Esc beim Ziehen stellt die alten Breiten wieder her');

    // ---- C: Breiten bleiben nach Neustart und nach einem Update (andere Programmversion, gleicher Ort)
    await p.close();
    p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); pages.push(p);
    await p.goto('file://' + f); await p.waitForTimeout(400);
    ok(same(c2, await cols(p), []), 'C: nach Neustart gleiche Spaltenbreiten');
    await p.close();
    fs.writeFileSync(f, ORIG.replace(/const APP_INFO = \{"version": "[^"]+"/, 'const APP_INFO = {"version": "98.0"'));
    p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); pages.push(p);
    await p.goto('file://' + f); await p.waitForTimeout(400);
    ok(await p.evaluate(() => APP_INFO.version) === '98.0' && same(c2, await cols(p), []), 'C: nach Programm-Update gleiche Spaltenbreiten');
    await ctx.close(); }

  // ---- D: Dialog „Detailplan anlegen“
  { const p = await open(b); pages.push(p);
    const id = await p.evaluate(() => { addMassnahme(2027); renderNow(); return D.massnahmen[D.massnahmen.length - 1].id; });
    await p.evaluate(id => { createPlan(id); }, id); await p.waitForTimeout(150);
    const btn = await p.evaluate(() => [...document.querySelectorAll('.modal .np-big b')].map(e => e.textContent).concat(document.querySelector('.modal .np-copybtn').textContent,
      document.querySelector('.modal .np-big.tpl-simple').getBoundingClientRect().left < document.querySelector('.modal .np-big.tpl-complex').getBoundingClientRect().left));
    ok(btn.join('|') === 'Einfach|Komplex|Kopie aus vorherigem Plan …|true', 'D: Knöpfe ' + btn.join(' | '));
    await p.click('.modal .tpl-simple'); await p.waitForTimeout(150);
    const nopal = await p.evaluate(() => [!!document.querySelector('.modal'), document.querySelector('.modal .np-msg').textContent, document.querySelector('[data-fk="np:pal"]').classList.contains('bad')]);
    ok(nopal[0] && /PAL/.test(nopal[1]) && nopal[2], 'D: ohne PAL geht es nicht weiter: „' + nopal[1] + '“');
    await p.fill('[data-fk="np:pal"]', '2027-06-18'); await p.waitForTimeout(50);
    await p.fill('[data-fk="np:S:wt"]', '40'); await p.waitForTimeout(50);
    await p.fill('[data-fk="np:I"]', '2027-05-10'); await p.waitForTimeout(50);
    const v1 = await p.evaluate(() => [document.querySelector('[data-fk="np:S"]').value, document.querySelector('[data-fk="np:I:wt"]').value, document.querySelector('[data-fk="np:D"]').value, document.querySelector('[data-fk="np:D:wt"]').value]);
    const e1 = await p.evaluate(() => [ds(dateForWT(dn('2027-06-18'), 40)), String(workdaysBefore(dn('2027-05-10'), dn('2027-06-18')))]);
    ok(v1[0] === e1[0] && v1[1] === e1[1], 'D: 40 WT → Datum ' + v1[0] + '; Datum 10.05. → ' + v1[1] + ' WT');
    await p.fill('[data-fk="np:pal"]', '2027-06-25'); await p.waitForTimeout(50);
    const v2 = await p.evaluate(() => [document.querySelector('[data-fk="np:S"]').value, document.querySelector('[data-fk="np:S:wt"]').value, document.querySelector('[data-fk="np:I"]').value, document.querySelector('[data-fk="np:I:wt"]').value]);
    const e2 = await p.evaluate(() => [ds(dateForWT(dn('2027-06-25'), 40)), String(workdaysBefore(dn('2027-05-10'), dn('2027-06-25')))]);
    ok(v2[0] === e2[0] && v2[1] === '40' && v2[2] === '2027-05-10' && v2[3] === e2[1], 'D: PAL geändert → Werktage-Start wandert mit (' + v2[0] + '), Datums-Start bleibt (' + v2[2] + ', jetzt ' + v2[3] + ' WT)');
    await p.fill('[data-fk="np:D"]', '2027-07-01'); await p.click('.modal .tpl-simple'); await p.waitForTimeout(150);
    ok(await p.evaluate(() => !!document.querySelector('.modal') && /nach dem PAL/.test(document.querySelector('.modal .np-msg').textContent)), 'D: Start nach dem PAL wird abgelehnt');
    await p.fill('[data-fk="np:D"]', ''); await p.waitForTimeout(50);
    await p.click('.modal .tpl-simple'); await p.waitForTimeout(250);
    const r = await p.evaluate(id => { const x = C.byId.get(id); return [!document.querySelector('.modal'), x.m.pal, ds(x.st.S), ds(x.st.I), x.st.D != null, x.m.plan.steps.filter(s => s.typ === 'gruppe').map(s => s.bereich).join(''), UI.view]; }, id);
    ok(r[0] && r[1] === '2027-06-25' && r[2] === e2[0] && r[3] === '2027-05-10' && r[4] && r[5] === 'SID' && r[6] === 'plaene', 'D: Einfach → Plan mit Abschnitten ' + r[5] + ', PAL ' + r[1] + ', S ' + r[2] + ', I ' + r[3]);

    // Komplex: Aufbau der Mailing-Vorlage, ohne Personen; Starts aus der Maßnahme bleiben
    const id2 = await p.evaluate(() => C.ms.find(x => !x.m.plan && x.pal != null).id);
    const pre = await p.evaluate(id => { const x = C.byId.get(id); return [ds(x.st.S), ds(x.st.I)]; }, id2);
    await p.evaluate(id => { createPlan(id); }, id2); await p.waitForTimeout(150);
    const pv = await p.evaluate(() => [document.querySelector('[data-fk="np:S"]').value, document.querySelector('[data-fk="np:I"]').value]);
    ok(pv[0] === pre[0] && pv[1] === pre[1], 'D: Starts der Maßnahme vorbelegt (' + pv.join(', ') + ')');
    await p.click('.modal .tpl-complex'); await p.waitForTimeout(250);
    const k = await p.evaluate(id => { const x = C.byId.get(id), st = x.m.plan.steps, tpl = ensurePalStep(migratePlan(JSON.parse(JSON.stringify(MAILING_TEMPLATE)), PH().map(p => p.key))).steps;
      return [st.length === tpl.length, st.map(s => s.name).join() === tpl.map(s => s.name).join(), st.every(s => !s.wer), tpl.some(s => s.wer), ds(x.st.S), ds(x.st.I)]; }, id2);
    ok(k[0] && k[1] && k[2] && k[3] && k[4] === pre[0] && k[5] === pre[1], 'D: Komplex → Aufbau wie Mailing-Vorlage, ohne Personen, Starts ' + k[4] + ' / ' + k[5]);

    // Kopie aus vorherigem Plan
    const id3 = await p.evaluate(() => C.ms.find(x => !x.m.plan && x.pal != null).id);
    await p.evaluate(id => { createPlan(id); }, id3); await p.waitForTimeout(150);
    ok(await p.evaluate(() => !document.querySelector('.modal .np-src')), 'D: Planliste erst nach Klick auf „Kopie …“');
    await p.click('.modal .tpl-copy'); await p.waitForTimeout(100);
    const list = await p.evaluate(() => [...document.querySelectorAll('.modal .np-src')].map(e => e.textContent));
    ok(list.some(t => /Sommermailing/.test(t)), 'D: Auswahl: ' + list.map(t => t.split(' · ')[0]).join(', '));
    await p.click('.modal .np-src:has-text("Sommermailing")'); await p.waitForTimeout(250);
    const cp = await p.evaluate(id => { const x = C.byId.get(id), sm = C.ms.find(q => q.m.name === 'Sommermailing'); return [x.m.plan.steps.map(s => s.name).join() === sm.m.plan.steps.map(s => s.name).join(), x.m.plan.steps.every(s => !s.fortschritt), x.m.plan.steps.every(s => !sm.m.plan.steps.some(q => q.id === s.id) || true)]; }, id3);
    ok(cp[0] && cp[1], 'D: Kopie des Sommermailing-Plans angelegt, Fortschritt zurückgesetzt');

    // Abbrechen legt nichts an
    const id4 = await p.evaluate(() => C.ms.find(x => !x.m.plan && x.pal != null).id);
    await p.evaluate(id => { createPlan(id); }, id4); await p.waitForTimeout(150);
    await p.screenshot({ path: 'r81_neuerplan.png' });
    await p.click('.modal footer button:has-text("Abbrechen")'); await p.waitForTimeout(150);
    ok(await p.evaluate(id => !C.byId.get(id).m.plan && !document.querySelector('.modal'), id4), 'D: Abbrechen legt keinen Plan an');
    await p.context().close(); }
  await finish(b, pages);
})();
