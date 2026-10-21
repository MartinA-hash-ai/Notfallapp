// Vorschau (Artifact): zeichnet ohne Fehler, Phasen und Priorität sichtbar, Bedarfsseite mit Kartei, hell/dunkel, schmal ohne Querscrollen
const { chromium, ok, open, finish, fs, T } = require('./lib');
(async () => {
  const b = await chromium.launch();
  fs.writeFileSync('vorschau.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(T.PREVIEW, 'utf8') + '</body></html>');
  const file = process.cwd() + '/vorschau.html';
  const p = await open(b, { file, fakefs: false });
  let r = await p.evaluate(() => [...document.querySelectorAll('tr.grp')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  ok(r.join(' / ') === '▾Phase 1 · Freigabe3 / ▾Phase 2 · Förderung3 / ▾Phase 3 · Nacharbeit1', 'nach Phase gruppiert: ' + r.join(' / '));
  r = await p.evaluate(() => [...document.querySelectorAll('#list-body tr[data-id]')].map(e => e.dataset.id));
  ok(r[0] === 'b-aed' && r.indexOf('b-mtw') === 3, 'innerhalb der Phase: hohe Priorität zuerst');
  await p.screenshot({ path: 'vorschau_liste.png', fullPage: true });
  await p.click('tr[data-id="b-mtw"]');
  r = await p.evaluate(() => [document.querySelector('#d-steps .cur').textContent, document.querySelectorAll('.foe').length, document.querySelector('#fk-f-mtw-spk').textContent.includes('Erika Beispiel')]);
  ok(r.join('|') === 'Förderung|3|true', 'Bedarfsseite: Phase Förderung, 3 Förderer, Kartei-Kontakt');
  await p.click('button[data-act="res"][data-v="f-mtw-lot"]');
  ok(await p.$eval('#foe-f-mtw-lot .res-grid', e => e.querySelector('[data-p="hoehe"]').value === 'bis 50 % der Kosten'), 'Recherche-Details aufklappbar');
  await p.screenshot({ path: 'vorschau_bedarf.png', fullPage: true });
  const q = await open(b, { file, fakefs: false, dark: true, width: 390 });
  r = await q.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok(r[0] <= r[1], 'schmal (390 px): kein Querscrollen der Seite (' + r.join(' / ') + ')');
  await q.click('tr[data-id="b-waerme"]');
  r = await q.evaluate(() => [document.documentElement.scrollWidth, innerWidth, getComputedStyle(document.body).backgroundColor]);
  ok(r[0] <= r[1] && r[2] === 'rgb(20, 21, 22)', 'schmal und dunkel: Bedarfsseite passt, dunkler Hintergrund');
  await q.screenshot({ path: 'vorschau_handy_dunkel.png', fullPage: true });
  await finish(b, [p, q]);
})();
