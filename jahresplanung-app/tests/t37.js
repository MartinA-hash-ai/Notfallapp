// 0.9.2 Festgehaltene Maßnahme: Buchstaben in der Terminzeile blenden Bereiche aus/ein (wie die Knöpfe oben)
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  const line = mo => `.month:nth-child(${mo}) .mline[data-m="${sm}"]`;
  const chips = mo => p.evaluate(sel => { const l = document.querySelector(sel); return l ? [...l.querySelectorAll('.lchips .chip')].map(c => c.textContent + (c.classList.contains('off') ? '-' : '')).join('') : null; }, line(mo));

  // ---- A: ohne Festhalten: Klick auf die Zeile hält fest, Buchstaben schalten noch nichts
  await p.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: 'center' }), line(6));
  await p.click(line(6) + ' .lchips .chip >> nth=0'); await p.waitForTimeout(200);
  ok(await p.evaluate(id => UI.pin === id && showType('D') && showType('P'), sm), 'A: erster Klick hält die Maßnahme fest, blendet nichts aus');

  // ---- B: festgehalten: Klick auf D blendet Produktion aus, P und die anderen bleiben
  ok(await chips(6) === 'DP', 'B: Juni-Zeile „' + await chips(6) + '“');
  await p.click(line(6) + ' .lchips .chip:has-text("D")'); await p.waitForTimeout(250);
  const r = await p.evaluate(id => [UI.pin === id, showType('D'), showType('P'), showType('S'), document.querySelectorAll('.cal .day .chip.D').length, document.querySelectorAll('.cal .day .chip.P[data-m="' + id + '"]').length,
    [...document.querySelectorAll('.tpill')].find(b => /Produktion/.test(b.textContent)).classList.contains('on')], sm);
  ok(r[0] && !r[1] && r[2] && r[3] && r[4] === 0 && r[5] === 1 && !r[6], 'B: D ausgeblendet (auch der Knopf oben), P und S bleiben, Maßnahme bleibt festgehalten');
  ok(await chips(6) === 'D-P', 'B: D bleibt blass in der Zeile zum Wiedereinblenden („' + await chips(6) + '“)');
  const ln = await p.evaluate(id => { const x = C.byId.get(id); return [...document.querySelectorAll('.day.span')].map(c => +c.dataset.dn).filter(n => n > x.st.D && n < x.pal).length > 0; }, sm);
  ok(ln, 'B: Verbindungslinie läuft ohne D weiter bis zum PAL');

  // ---- C: blasses D anklicken → wieder da
  await p.click(line(6) + ' .lchips .chip.off'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => showType('D')) && await chips(6) === 'DP', 'C: Klick auf das blasse D blendet Produktion wieder ein');

  // ---- D: alle Termine eines Monats ausgeblendet → Zeile bleibt mit blassen Buchstaben
  await p.click(line(4) + ' .lchips .chip:has-text("S")'); await p.waitForTimeout(200);
  await p.click(line(4) + ' .lchips .chip:has-text("I")'); await p.waitForTimeout(200);
  ok(await chips(4) === 'S-I-' && await p.evaluate(id => UI.pin === id, sm), 'D: April-Zeile bleibt mit „' + await chips(4) + '“ – so lässt sich alles wieder einblenden');
  await p.click(line(4) + ' .lchips .chip.off >> nth=0'); await p.click(line(4) + ' .lchips .chip.off >> nth=0'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => showType('S') && showType('I')), 'D: beide wieder eingeblendet');
  await finish(b, pages);
})();
