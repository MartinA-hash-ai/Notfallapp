// 0.76: kompakte Liste – aufgeklappter Bedarf bleibt aufgeklappt, wenn man von seiner Seite zurückkommt (auch nach dem Weiterblättern);
// Übergang zurück: die alte Seite bekommt eine eigene Ebene (springt nicht mit der Scrollposition der Liste); Kästen der Nacharbeit ohne Rahmen
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  await p.evaluate(() => {
    D = normalize({ bedarfe: ['A', 'B', 'C'].map((t, i) => Object.assign(blank(), { id: 'x' + i, titel: 'Bedarf ' + t, summe: 1000 * (3 - i) })) }); SAVED_JSON = JSON.stringify(D); undoReset();
    UI.ansicht = 'kompakt'; renderNow();
  });
  await p.click('#list-body tr[data-id="x0"] .l-name'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => UI.auf === 'x0'), 'Klick klappt den Bedarf auf');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => UI.view === 'detail' && UI.id === 'x0' && UI.auf === 'x0'), 'auf seiner Seite: aufgeklappt bleibt gemerkt');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  let r = await p.evaluate(() => [UI.view, UI.auf, !!document.querySelector('#list-body tr.auf[data-id="x0"]'), document.activeElement.closest('tr') && document.activeElement.closest('tr').dataset.id]);
  ok(r.join('|') === 'list|x0|true|x0', 'zurück: weiter aufgeklappt, Fokus auf ihm: ' + r.join('|'));
  // auf der Seite weitergeblättert: aufgeklappt ist dann der, von dem man kommt
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(150);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [UI.auf, document.querySelectorAll('#list-body tr.auf').length]);
  ok(r.join('|') === 'x1|1', 'weitergeblättert: der Bedarf, von dem man kommt, ist aufgeklappt: ' + r.join('|'));
  // nichts aufgeklappt: bleibt zu
  await p.evaluate(() => aufklappen(null)); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !UI.auf && !document.querySelector('#list-body tr.auf')), 'war nichts aufgeklappt, bleibt alles zu');
  // Übergang: alte Seite mit eigener Ebene, danach wieder ohne
  r = await p.evaluate(() => { let im = null; const sv = document.startViewTransition; document.startViewTransition = f => { im = document.querySelector('#app > main').classList.contains('vt-alt'); f(); return { finished: Promise.resolve() }; };
    const mm = window.matchMedia; window.matchMedia = q => /reduce/.test(q) ? { matches: false } : mm(q);
    oeffnen('x2'); window.matchMedia = mm; document.startViewTransition = sv; return [im, document.querySelector('#app > main').classList.contains('vt-alt')]; });
  ok(r.join('|') === 'true|false', 'Übergang: alte Seite als eigene Ebene, die neue nicht: ' + r.join('|'));
  // Kästen der Nacharbeit: grau wie die Karten oben, ohne Rahmen
  await p.evaluate(() => { const x = cur(); x.foerderer.push(ff({ name: 'Stiftung', status: 'zugesagt', betrag: 500 })); zuSet(x, 'nach', false); changed(); renderNow(); });
  r = await p.evaluate(() => { const t = getComputedStyle(document.querySelector('.ue-teil')), v = getComputedStyle(document.querySelector('.vn-b')), k = document.querySelector('.ue-teil').parentElement.closest('.grid.two');
    return [t.borderTopStyle === 'none' || t.borderTopWidth === '0px', v.borderTopStyle === 'none' || v.borderTopWidth === '0px', t.backgroundColor === v.backgroundColor]; });
  ok(r.join('|') === 'true|true|true', 'Nacharbeit: Kästen ohne Rahmen, gleiches Grau: ' + r.join('|'));
  // 0.77: Symbole bei Zuständig mit denselben Abständen wie beim Fachreferat; Einladung raus grau statt grün
  r = await p.evaluate(() => { const g = s => getComputedStyle(document.querySelector(s)).columnGap; return [g('#sec-eck .eck-l > .sub'), g('#fach-pers .sub.fach-kopf')]; });
  ok(r[0] === r[1], 'Abstände der Symbole gleich: ' + r.join('|'));
  await p.evaluate(() => { const x = cur(); x.nach.ueb.einl = { [x.foerderer[0].id]: { am: '2026-10-28', zu: 'ja' } }; changed(); renderNow(); });
  r = await p.evaluate(() => { const e = document.querySelector('[data-act="einl-raus"]'), z = document.querySelector('[data-act="einl-zu"]'); return [e.classList.contains('raus'), !e.classList.contains('ok'), z.classList.contains('ok')]; });
  ok(r.join('|') === 'true|true|true', 'Eingeladen grau, nur die Zusage grün: ' + r.join('|'));
  // 0.77: beim Seitenwechsel bleibt die Kopfzeile obenauf (eigene Ebene über den gleitenden Seiten)
  r = await p.evaluate(() => { document.documentElement.dataset.vt = 'zurueck'; const n = getComputedStyle(document.querySelector('header.top')).viewTransitionName; delete document.documentElement.dataset.vt; return n; });
  ok(r === 'bl-kopf', 'Kopfzeile beim Übergang mit eigener Ebene: ' + r);
  await finish(b, [p]);
})();
