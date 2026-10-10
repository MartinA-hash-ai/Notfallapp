// 0.11 Detailplan: P im Kopf rot, feste Dauer (⋯-Menü, Schloss), Bereichsstart anteilig (Ende bleibt), „Auf den PAL stauchen“
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1800 }); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  await p.evaluate(id => { UI.view = 'plaene'; UI.planSel = id; renderNow(); }, sm); await p.waitForTimeout(250);
  const span = n => p.evaluate(n => { const x = C.byId.get(UI.planSel), s = x.m.plan.steps.find(s => s.name === n), r = x.pc.map.get(s.id); return [r.start, r.end, +s.dauer]; }, n);   // [Beginn, Ende, Dauer in WT]
  const sid = n => p.evaluate(n => C.byId.get(UI.planSel).m.plan.steps.find(s => s.name === n).id, n);

  // ---- A: P im Kopf rot
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.ph-pal .chip')).backgroundColor) === 'rgb(227, 7, 20)', 'A: P neben „PAL“ im Kopf in Rot');

  // ---- B: ⋯ → „Dauer festlegen (fix)“ → Schloss neben der Dauer
  const gid = await sid('Gestaltung');
  const row = '.pl-row[data-rid="' + gid + '"]';
  await p.click(row + ' .c-acts .menu-btn'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => [...document.querySelectorAll('.menu button')].some(b => b.textContent === 'Dauer festlegen (fix)')), 'B: Menüpunkt „Dauer festlegen (fix)“');
  await p.click('.menu button:has-text("Dauer festlegen")'); await p.waitForTimeout(200);
  const bb = await p.evaluate(gid => [C.byId.get(UI.planSel).m.plan.steps.find(s => s.id === gid).fix, !!document.querySelector('.pl-row[data-rid="' + gid + '"] .c-dur .fixlock')], gid);
  ok(bb[0] === true && bb[1], 'B: Gestaltung hat feste Dauer, Schloss sichtbar');
  await p.click(row + ' .c-acts .menu-btn'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => [...document.querySelectorAll('.menu button')].some(b => /Dauer freigeben/.test(b.textContent))), 'B: danach „Dauer freigeben“ im Menü');
  await p.keyboard.press('Escape'); await p.mouse.click(5, 5); await p.waitForTimeout(100);

  // ---- C: Start Inhalt 10 Tage später: Ende des Abschnitts bleibt, alles anteilig kürzer, Gestaltung (fix) behält 14 Tage
  const names = ['Thema definieren', 'Texte erstellen', 'Bilder einholen', 'Gestaltung', 'Korrekturphase', 'Freigaben einholen'];
  const before = {}; for (const n of names) before[n] = await span(n);
  const ph0 = await p.evaluate(() => { const x = C.byId.get(UI.planSel); return [x.pc.ph.I.start, x.pc.ph.I.end, x.st.S, x.pal]; });
  await p.evaluate(([id, n]) => setMarkDate(id, 'I', ds(n)), [sm, ph0[0] + 10]); await p.waitForTimeout(250);
  const after = {}; for (const n of names) after[n] = await span(n);
  const ph1 = await p.evaluate(() => { const x = C.byId.get(UI.planSel); return [x.pc.ph.I.start, x.pc.ph.I.end, x.st.S, x.pal]; });
  const w10 = await p.evaluate(n => nextWorkday(n + 10), ph0[0]);
  ok(ph1[0] === w10 && ph1[1] === ph0[1] && ph1[2] === ph0[2] && ph1[3] === ph0[3], 'C: Start Inhalt +10 Tage (Werktag), Ende des Abschnitts, Selektion und PAL bleiben');
  ok(after['Gestaltung'][2] === before['Gestaltung'][2] && after['Freigaben einholen'][2] < before['Freigaben einholen'][2] && after['Texte erstellen'][2] <= before['Texte erstellen'][2], 'C: anteilig kürzer – Freigaben ' + before['Freigaben einholen'][2] + ' → ' + after['Freigaben einholen'][2] + ', Texte ' + before['Texte erstellen'][2] + ' → ' + after['Texte erstellen'][2] + ', Gestaltung (fix) behält ihre Dauer');
  const chain = await p.evaluate(() => { const x = C.byId.get(UI.planSel), st = x.m.plan.steps; return st.filter(s => predsOf(s).length).every(s => { const r = x.pc.map.get(s.id); return r.start >= Math.max(...predsOf(s).map(i => x.pc.map.get(i).end)); }); });
  ok(chain, 'C: Reihenfolge bleibt – kein Schritt beginnt vor dem Ende seiner Vorgänger');
  await p.evaluate(() => undo()); await p.waitForTimeout(200);

  // ---- D: über den PAL → „Auf den PAL stauchen“: Beginn und PAL bleiben, Gestaltung (fix) bleibt 14 Tage
  const tid = await sid('Thema definieren');
  await p.fill('[data-fk="st:' + tid + ':dur"]', '25'); await p.press('[data-fk="st:' + tid + ':dur"]', 'Enter'); await p.waitForTimeout(250);
  const d0 = await p.evaluate(() => { const x = C.byId.get(UI.planSel); return [x.pc.ph.I.start, x.pc.ph.I.end, x.pal, document.querySelectorAll('.plwarn button').length]; });
  ok(d0[1] > d0[2] && d0[3] === 3, 'D: Inhalt endet ' + (d0[1] - d0[2]) + ' Tage nach dem PAL – Warnung mit „vorrücken“, „stauchen“, „ausblenden“');
  await p.click('.plwarn button:has-text("Auf den PAL stauchen")'); await p.waitForTimeout(300);
  const d1 = await p.evaluate(() => { const x = C.byId.get(UI.planSel); return [x.pc.ph.I.start, x.pc.ph.I.end, x.pal, !!document.querySelector('.plwarn')]; });
  const g1 = await span('Gestaltung');
  ok(d1[0] === d0[0] && d1[1] <= d1[2] && d1[2] === d0[2] && !d1[3] && g1[2] === before['Gestaltung'][2], 'D: gestaucht – Beginn Inhalt und PAL bleiben, Ende ≤ PAL, Gestaltung behält ' + g1[2] + ' WT, Warnung weg');

  // ---- E: Daten: fix nur bei Aufgaben, Zusammenführen beschreibt die Änderung
  const e = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(D)); const st = o.massnahmen.find(m => m.plan).plan.steps; st.find(s => s.typ === 'meilenstein').fix = true; st.find(s => s.typ === 'aufgabe').fix = 'ja';
    const n = normalize(o); return n.massnahmen.find(m => m.plan).plan.steps.filter(s => 'fix' in s).map(s => s.typ + ':' + s.fix).join(); });
  ok(!/meilenstein|ja/.test(e), 'E: „fix“ wird beim Laden bereinigt (' + e + ')');
  await finish(b, pages);
})();
