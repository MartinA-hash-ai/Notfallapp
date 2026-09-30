// 0.9.3/0.9.4 Nur ein Bereich angezeigt: die Linie zeigt, wie lange dieser Abschnitt läuft (bis zu seinem Ende statt nur den Starttag)
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  const line = mo => `.month:nth-child(${mo}) .mline[data-m="${sm}"]`;
  const span = () => p.evaluate(() => { const d = [...document.querySelectorAll('.day.span')].map(c => +c.dataset.dn); return d.length ? [Math.min(...d), Math.max(...d), d.length] : null; });
  const ph = await p.evaluate(id => { const x = C.byId.get(id); return { st: x.st, en: x.en, pal: x.pal }; }, sm);

  // ---- A: festhalten, dann S, I, P über die Buchstaben ausblenden → nur D bleibt
  await p.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: 'center' }), line(6));
  await p.click(line(6) + ' .lchips .chip >> nth=0'); await p.waitForTimeout(200);
  await p.click(line(6) + ' .lchips .chip:has-text("P")'); await p.waitForTimeout(200);
  await p.evaluate(() => { UI.show = Object.assign({}, UI.show, { S: false, I: false }); renderNow(); }); await p.waitForTimeout(200);
  const a = await span();
  ok(ph.en.D > ph.st.D && a && a[0] === ph.st.D && a[1] === ph.en.D, 'A: nur D – Linie vom Start Produktion ' + ph.st.D + ' bis zum Ende des Abschnitts ' + ph.en.D + ' (' + JSON.stringify(a) + ')');
  ok(await p.evaluate(() => !document.querySelector('.cal .day .chip.S, .cal .day .chip.I, .cal .day .chip.P')), 'A: S, I, P sind im Kalender ausgeblendet');
  ok(await p.evaluate(en => { const e = [...document.querySelectorAll('.day.span-end')]; return e.length === 1 && +e[0].dataset.dn === en; }, ph.en.D), 'A: kleiner Endstrich am letzten Tag des Abschnitts');

  // ---- B: mit PAL angezeigt endet die Linie wie bisher am PAL
  await p.evaluate(() => { UI.show = Object.assign({}, UI.show, { P: true }); renderNow(); }); await p.waitForTimeout(200);
  const bb = await span();
  ok(await p.evaluate(() => !document.querySelector('.day.span-end')), 'B: am PAL kein zusätzlicher Endstrich');
  ok(bb && bb[0] === ph.st.D && bb[1] === ph.pal, 'B: D und P – Linie von D bis PAL (' + JSON.stringify(bb) + ')');

  // ---- C: S und I angezeigt (D, P aus) → Linie läuft bis zum Ende von Inhalt
  await p.evaluate(() => { UI.show = Object.assign({}, UI.show, { S: true, I: true, D: false, P: false }); renderNow(); }); await p.waitForTimeout(200);
  const c = await span();
  ok(c && c[0] === ph.st.S && c[1] === ph.en.I, 'C: S und I – Linie von S bis zum Ende von Inhalt ' + ph.en.I + ' (' + JSON.stringify(c) + ')');

  // ---- D: Verbund-Darstellung, nur D → je Maßnahme eine Linie über den Abschnitt
  await p.evaluate(() => { UI.pin = null; UI.show = Object.assign({}, UI.show, { S: false, I: false, D: true, P: false }); UI.verbund = true; renderNow(); }); await p.waitForTimeout(200);
  const d = await p.evaluate(id => { const c = [...document.querySelectorAll('.day > .vbl[data-m="' + id + '"]')].map(e => +e.parentElement.dataset.dn); return c.length ? [Math.min(...c), Math.max(...c)] : null; }, sm);
  ok(d && d[0] === ph.st.D && d[1] === ph.en.D, 'D: Verbund – Linie über den Abschnitt Produktion (' + JSON.stringify(d) + ')');

  // ---- F: ein Schritt im Abschnitt endet nach dem PAL → Linie endet trotzdem am PAL
  await p.evaluate(() => { UI.verbund = false; renderNow(); });
  const f = await p.evaluate(id => { commit(d => { const s = d.massnahmen.find(m => m.id === id).plan.steps.find(s => s.id === 'produktion'); s.anker = { art: 'pal', offset: 6 }; });
    UI.pin = id; renderNow(); highlight(id); const x = C.byId.get(id); const c = [...document.querySelectorAll('.day.span')].map(e => +e.dataset.dn); return [x.en.D > x.pal, Math.max(...c) === x.pal, +document.querySelector('.day.span-end').dataset.dn === x.pal]; }, sm);
  ok(f[0] && f[1] && f[2], 'F: Schritt „Produktion & Versand“ endet nach dem PAL – Linie und Endstrich trotzdem am PAL (' + f + ')');
  await p.evaluate(() => undo()); await p.waitForTimeout(100);

  // ---- E: ohne Detailplan läuft der Abschnitt bis zum PAL (nicht nur bis zum nächsten Start); eingetragenes Ende gilt
  await p.evaluate(() => { UI.verbund = false; UI.show = Object.assign({}, UI.show, { S: true, I: false, D: false, P: false }); renderNow(); }); await p.waitForTimeout(150);
  const pu = await p.evaluate(() => C.ms.find(x => x.m.name === 'Projekt-Update 1').id);
  const q = await p.evaluate(id => { const x = C.byId.get(id); UI.pin = id; renderNow(); highlight(id); return { plan: !!x.m.plan, s: x.st.S, i: x.st.I, pal: x.pal }; }, pu); await p.waitForTimeout(150);
  const e = await span();
  ok(!q.plan && q.i != null && q.i < q.pal && e && e[0] === q.s && e[1] === q.pal, 'E: ohne Detailplan, nur S – Linie bis zum PAL statt bis Start Inhalt (' + JSON.stringify(e) + ')');
  await p.evaluate(([id, n]) => { commit(d => { const m = d.massnahmen.find(m => m.id === id); m.ende = { S: n }; }); renderNow(); highlight(id); }, [pu, q.pal - q.i]); await p.waitForTimeout(150);
  const e2 = await span();
  ok(e2 && e2[0] === q.s && e2[1] === q.i, 'E: mit eingetragenem Ende – Linie bis dorthin (' + JSON.stringify(e2) + ')');

  // ---- G: Detailplan – in der PAL-Zeile steht rechts das P (an der Stelle des Kalendersymbols)
  await p.evaluate(id => { UI.view = 'plaene'; UI.planSel = id; renderNow(); }, sm); await p.waitForTimeout(200);
  const g = await p.evaluate(() => { const r = document.querySelector('.pl-row.palrow'), c = r.querySelector('.paldate .palchip'), cell = r.querySelectorAll('.c-date')[1];
    return c ? [c.textContent, !!r.querySelector('.pallock'), Math.round(cell.getBoundingClientRect().right - c.getBoundingClientRect().right)] : null; });
  ok(g && g[0] === 'P' && g[1] && g[2] <= 6, 'G: PAL-Zeile mit Schloss und „P“ rechts (' + JSON.stringify(g) + ')');
  await finish(b, pages);
})();
