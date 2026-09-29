// 0.7 Ziehen abbrechen (Rechtsklick, Esc, Strg+Z) und „Alle vorziehen“ in der richtigen Reihenfolge
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const stuck = () => p.evaluate(() => [document.body.classList.contains('dragging'), !!document.querySelector('.drag-lab, .chip.ghost'), !!DRAG]);
  const center = sel => p.evaluate(sel => { const e = document.querySelector(sel); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  const id = await p.evaluate(() => C.ms.find(x => x.m.name === 'Projekt-Update 1').id);
  const pal0 = await p.evaluate(id => findM(D, id).pal, id);

  // ---- A: Kalender – P ziehen, dabei Rechtsklick
  let [x, y] = await center(`.cal .chip.P[data-m="${id}"]`);
  await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 60, y, { steps: 5 });
  await p.mouse.down({ button: 'right' }); await p.mouse.up({ button: 'right' }); await p.waitForTimeout(100);
  await p.mouse.up(); await p.waitForTimeout(150);
  let s = await stuck();
  ok(!s[0] && !s[1] && !s[2] && await p.evaluate(id => findM(D, id).pal, id) === pal0, 'A: Kalender – Rechtsklick bricht ab, nichts hängt, PAL unverändert ' + JSON.stringify(s));

  // ---- B: Zeitleiste – PAL-Balken ziehen, Rechtsklick, danach normaler Klick woanders
  await p.click('nav.tabs >> text=Zeitleiste'); await p.waitForTimeout(200);
  [x, y] = await center(`.tl-row[data-m="${id}"] .dia`);
  await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 80, y, { steps: 5 });
  await p.evaluate(() => window.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  await p.mouse.up(); await p.waitForTimeout(100);
  await p.mouse.move(x + 200, y + 5); await p.mouse.click(x + 200, y + 5); await p.waitForTimeout(150);
  s = await stuck();
  ok(!s[0] && !s[1] && !s[2] && await p.evaluate(id => findM(D, id).pal, id) === pal0, 'B: Zeitleiste – nach Rechtsklick verschiebt ein späterer Klick nichts mehr ' + JSON.stringify(s));

  // ---- C: Zeitleiste – Strg+Z während des Ziehens wird ignoriert, Esc bricht ab
  const u0 = await p.evaluate(() => { commit(d => { d.massnahmen[0].hinweis = 'für Strg+Z'; }); return UNDO.length; });
  [x, y] = await center(`.tl-row[data-m="${id}"] .dia`);
  await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 80, y, { steps: 5 });
  await p.keyboard.press('Control+z'); await p.keyboard.press('Escape'); await p.mouse.up(); await p.waitForTimeout(150);
  const r = await p.evaluate(([id, u0]) => [UNDO.length === u0, D.massnahmen[0].hinweis, findM(D, id).pal], [id, u0]);
  ok(r[0] && r[1] === 'für Strg+Z' && r[2] === pal0, 'C: Strg+Z während des Ziehens ignoriert, Esc bricht ab (PAL ' + r[2] + ')');

  // ---- D: Detailplan – Balken ziehen, Esc
  await p.click('nav.tabs >> text=Detailpläne'); await p.waitForTimeout(200);
  const before = await p.evaluate(() => JSON.stringify(findM(D, UI.planSel).plan));
  [x, y] = await center('.g-bar');
  await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 60, y, { steps: 5 });
  await p.keyboard.press('Escape'); await p.mouse.up(); await p.waitForTimeout(150);
  s = await stuck();
  ok(!s[0] && !s[1] && !s[2] && await p.evaluate(() => JSON.stringify(findM(D, UI.planSel).plan)) === before, 'D: Detailplan – Esc bricht ab, Plan unverändert');
  // normales Ziehen funktioniert weiterhin
  [x, y] = await center('.g-bar');
  await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 40, y, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
  ok(await p.evaluate(() => JSON.stringify(findM(D, UI.planSel).plan)) !== before, 'D: normales Ziehen verschiebt den Schritt weiterhin');

  // ---- E: „Alle vorziehen“ – PAL am Sonntag, Start Selektion am Samstag
  const e = await p.evaluate(() => {
    UI.view = 'jahr';
    commit(d => { d.massnahmen = d.massnahmen.filter(m => m.plan); d.massnahmen.push({ id: 'fx', name: 'Vorziehtest', farbe: '#1F77B4', pal: '2027-03-14', palStatus: 'fest', vorlaufS: 36, vorlaufI: 1 }); });
    derive();
    const w = C.warnings.filter(w => w.fix && w.mid === 'fx').map(w => w.fix.t + ' → ' + fmtW(w.fix.to));
    return w;
  });
  await p.evaluate(() => { fixAll(C.warnings.filter(w => w.fix && w.mid === 'fx')); }); await p.waitForTimeout(150);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  const e2 = await p.evaluate(() => { derive(); const x = C.byId.get('fx'); return [fmtW(x.s), fmtW(x.i), fmtW(x.pal), C.warnings.filter(w => w.fix && w.mid === 'fx').length]; });
  ok(e2[3] === 0 && !/^(Sa|So)/.test(e2[0]) && !/^(Sa|So)/.test(e2[1]) && !/^So/.test(e2[2]), 'E: Alle vorziehen – vorher ' + e.join(', ') + ' · nachher S ' + e2[0] + ', I ' + e2[1] + ', PAL ' + e2[2] + ', keine Warnung übrig');

  // ---- F: einzelnes PAL-Vorziehen zieht ein dadurch aufs Wochenende gerutschtes S mit
  const f = await p.evaluate(() => {
    commit(d => { const m = findM(d, 'fx'); m.pal = '2027-03-21'; m.vorlaufS = 6; m.vorlaufI = 5; });   // PAL So 21.03., S Mo 15.03. – PAL auf Sa schiebt S auf So 14.03.
    derive(); const w = C.warnings.find(w => w.fix && w.mid === 'fx' && w.fix.t === 'P'); fixDate(w); derive();
    const x = C.byId.get('fx'); return [fmtW(x.pal), fmtW(x.s), C.warnings.filter(w => w.fix && w.mid === 'fx').map(w => w.text)];
  });
  ok(!/^(Sa|So)/.test(f[1]) && /^Sa/.test(f[0]), 'F: PAL vorgezogen auf ' + f[0] + ', S mitgezogen auf ' + f[1] + (f[2].length ? ' · übrig: ' + f[2].join('; ') : ''));
  await finish(b, pages);
})();
