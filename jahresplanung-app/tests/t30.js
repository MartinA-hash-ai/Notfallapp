// 0.8.5 Maßnahmen-Tabelle: Kopf in der Werktage-Ansicht, leeres Datum als hellgrauer Strich, dezente Kalendersymbole
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const head = () => p.evaluate(() => ['S', 'I', 'D'].map(k => { const t = document.querySelector('.mtable th.h-ph_' + k + ' .th2'); return t.children[0].textContent + ' / ' + t.children[1].textContent; }).join(' | '));

  // ---- A: Kopf je Ansicht
  const hd = await head();
  await p.evaluate(() => { UI.startView = 'wt'; renderNow(); });
  const hw = await head();
  await p.evaluate(() => { UI.startView = 'date'; renderNow(); });
  ok(hd === 'Start der / SelektionS | Start des / InhaltsI | Start der / ProduktionD' && hw === 'Zeit bis PAL für / SelektionS | Zeit bis PAL für / InhaltI | Zeit bis PAL für / ProduktionD',
    'A: Kopf Datum „' + hd + '“ · Werktage „' + hw + '“');

  // ---- B: leeres Datum → hellgrauer Strich mit Kalendersymbol, beim Anklicken wieder normales Feld
  const id = await p.evaluate(() => C.ms.find(x => x.m.name === 'Projekt-Update 1').id);
  const sel = `[data-fk="m:${id}:D"]`;
  const e0 = await p.evaluate(sel => { const i = document.querySelector(sel), cs = getComputedStyle(i), full = document.querySelector(sel.replace(':D"', ':S"'));
    return [i.value, i.classList.contains('noval'), Math.round(i.getBoundingClientRect().width), cs.backgroundImage.includes('svg'), getComputedStyle(i, '::-webkit-datetime-edit').display,
      Math.round(i.getBoundingClientRect().top - full.getBoundingClientRect().top), [...document.styleSheets].flatMap(sh => [...sh.cssRules]).some(r => /\.mtable input\[type="?date"?\]::-webkit-calendar-picker-indicator/.test(r.selectorText || '') && +r.style.opacity < 0.5) ? '0.3' : '1']; }, sel);
  ok(e0[0] === '' && e0[1] && e0[2] <= 46 && e0[3] && Math.abs(e0[5]) <= 3, 'B: leerer Start Produktion als Strich mit Kalendersymbol (' + e0[2] + ' px breit, auf einer Linie mit den Daten)');
  ok(+e0[6] < 0.5, 'B: Kalendersymbol dezent (Deckkraft ' + e0[6] + ')');
  const bb = await p.locator(sel).boundingBox();
  await p.mouse.click(bb.x + 8, bb.y + bb.height / 2); await p.waitForTimeout(150);        // auf den Strich klicken
  const e1 = await p.evaluate(sel => { const i = document.querySelector(sel); return [Math.round(i.getBoundingClientRect().width), document.activeElement === i, i.classList.contains('noval')]; }, sel);
  ok(e1[0] > 80 && e1[1] && !e1[2], 'B: Klick auf den Strich öffnet das volle Datumsfeld zum Eintippen (' + e1[0] + ' px, Fokus ' + e1[1] + ')');
  await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(100);
  ok(await p.evaluate(sel => document.querySelector(sel).classList.contains('noval'), sel), 'B: nichts eingetragen und verlassen → wieder Strich');
  await p.fill(sel, '2027-04-01'); await p.press(sel, 'Enter'); await p.waitForTimeout(200);
  const e2 = await p.evaluate(([id, sel]) => [ds(C.byId.get(id).st.D), document.querySelector(sel).classList.contains('noval')], [id, sel]);
  ok(e2[0] === '2027-04-01' && !e2[1], 'B: Datum eingetragen (' + e2[0] + '), Strich verschwindet');
  await p.evaluate(() => { addMassnahme(2027); renderNow(); });
  const pal = await p.evaluate(() => { const m = D.massnahmen[D.massnahmen.length - 1]; const i = document.querySelector('[data-fk="m:' + m.id + ':pal"]'); return [i.classList.contains('noval'), Math.round(i.getBoundingClientRect().width)]; });
  ok(pal[0] && pal[1] <= 46, 'B: neue Maßnahme ohne PAL – ebenfalls Strich statt „tt.mm.jjjj“');
  await finish(b, pages);
})();
