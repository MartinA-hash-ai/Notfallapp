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
  // 0.158: abgeschlossene unten (vor den zurückgestellten)
  r = await p.evaluate(() => { const ids = [...document.querySelectorAll('#list-body tr[data-id]')].map(tr => tr.dataset.id), L = filtered(), i = ids.indexOf('b-waerme'), z = L.findIndex(b => b.manuell);
    return [i, ids.length, z < 0 || i < z, L.slice(i + 1).every(b => b.manuell)]; });
  ok(r[2] && r[3] && r[0] >= 0, 'abgeschlossener Bedarf rutscht nach unten, vor die zurückgestellten: ' + r.join('|'));
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
  // 0.158: Förderplan – Förderer unter dem Kreisdiagramm ein- und ausblenden
  await p.evaluate(() => { oeffnen('b-mtw'); }); await p.waitForTimeout(700);
  r = [await p.evaluate(() => [document.querySelectorAll('.fk-grid .fk-card, .fk-grid > [id^="foe-"]').length > 0, !!document.querySelector('#sec-foe .fk-zu')])];
  await p.click('#sec-foe .fk-zu'); await p.waitForTimeout(200);
  r.push(await p.evaluate(() => [!document.querySelector('.fk-grid'), !!document.querySelector('#fin-pie svg'), document.querySelector('#sec-foe .fk-zu').getAttribute('aria-expanded')]));
  await p.click('#sec-foe .fk-zu'); await p.waitForTimeout(200);
  r.push(await p.evaluate(() => !!document.querySelector('.fk-grid')));
  ok(r[0].join() === 'true,true' && r[1].join() === 'true,true,false' && r[2], 'Förderer ausblenden: Kreisdiagramm bleibt, Pfeil unten mittig schaltet zurück: ' + JSON.stringify(r));
  // 0.158: Netz – neu angelegter Förderer (ohne Häufigkeit/Aufwand im Speicher): Ziehen bleibt stehen
  r = await p.evaluate(() => { const e = D.fl.liste[0]; e.bew = { chance: 0, dauer: 0, summe: 0 }; UI.view = 'fdetail'; UI.flId = e.id; renderNow(); fnSetzen('haeufig', 3); fnSetzen('aufwand', 1); return [e.bew.haeufig, e.bew.aufwand, flBew(e)['haeufig'].v]; });
  ok(r.join() === '3,1,3', 'Netz: Häufigkeit und Aufwand lassen sich auch ohne vorhandenen Wert setzen: ' + r.join());
  ok(await p.evaluate(() => Object.keys(flLeer().bew).length === 5), 'neuer Förderer hat alle fünf Achsen');
  await finish(b, [p]);
})();
