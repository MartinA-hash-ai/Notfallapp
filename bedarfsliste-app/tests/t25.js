// 0.156: Liste – ganz abgeschlossene Bedarfe zeigen hinter dem Ort nur „✓ abgeschlossen (archiviert in X Tagen)“;
// Sprung aus den Hinweisen (kompakt): der Bedarf bleibt aufgeklappt und gewählt, auch beim Klick daneben
const { chromium, ok, open, finish, T } = require('./lib');
(async () => {
  const b = await chromium.launch(); const p = await open(b, { file: T.PREVIEW, fakefs: false, width: 1440, height: 950 });
  let r = await p.evaluate(() => { const B = D.bedarfe.find(x => x.id === 'b-waerme'); B.foerderer.forEach(f => { if (f.status === 'zugesagt') { f.vn.st = 'erledigt'; f.eingegangen = true; } });
    B.autoArchiv = isoDate(new Date(Date.parse(today()) + 23 * 864e5)); B.fertigGefragt = true; UI.ansicht = 'kompakt'; renderNow();
    const tr = document.querySelector('tr[data-id="b-waerme"]'); return [phase(B).step, tr.querySelectorAll('td').length, tr.querySelector('td.k-abg').textContent.trim(), !!tr.querySelector('.l-ueb, .k-fr')]; });
  ok(r.join('|') === '3|5|abgeschlossen (archiviert in 23 Tagen)|false', 'kompakt: abgeschlossen nur Stern, Name, Summe, Ort und „abgeschlossen (archiviert in 23 Tagen)“: ' + r.join('|'));
  r = await p.evaluate(() => { UI.ansicht = 'voll'; renderNow(); const tr = document.querySelector('tr[data-id="b-waerme"]'); return [tr.querySelectorAll('td').length, tr.querySelector('td.k-abg').textContent.trim()]; });
  ok(r.join('|') === '5|abgeschlossen (archiviert in 23 Tagen)', 'ausführlich: ebenso nur „abgeschlossen“: ' + r.join('|'));
  await p.evaluate(() => { const B = D.bedarfe.find(x => x.id === 'b-waerme'); B.autoArchiv = ''; UI.ansicht = 'kompakt'; renderNow(); });
  ok(await p.evaluate(() => document.querySelector('tr[data-id="b-waerme"] td.k-abg').textContent.trim()) === 'abgeschlossen', 'ohne Archiv-Datum: nur „abgeschlossen“');
  // Sprung aus den Hinweisen
  await p.click('header.top .frist-chip'); await p.waitForTimeout(250);
  await p.click('.frist-pop .fp-row >> nth=0'); await p.waitForTimeout(900);
  const id = await p.evaluate(() => UI.auf);
  await p.mouse.click(1400, 800); await p.waitForTimeout(400);
  r = await p.evaluate(() => [UI.auf, !!document.querySelector('#list-body tr.auf'), document.activeElement && document.activeElement.dataset.id]);
  ok(id && r[0] === id && r[1] && r[2] === id, 'nach dem Sprung: Klick auf den freien Bereich lässt den Bedarf aufgeklappt und gewählt: ' + id + ' / ' + r.join('|'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !UI.auf), 'Esc klappt ihn wieder zu');
  await p.click('#list-body tr[data-id="b-mtw"]'); await p.waitForTimeout(400); await p.mouse.click(1400, 800); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !UI.auf), 'normal aufgeklappt: Klick daneben klappt wie bisher zu');
  await finish(b, [p]);
})();
