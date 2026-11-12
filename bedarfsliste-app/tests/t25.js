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
  // 0.162: Geld eingegangen → grün; Trennlinie zur Spendenübergabe, Punkte genau darauf
  r = await p.evaluate(() => { UI.view = 'list'; UI.ansicht = 'voll'; const B = D.bedarfe.find(x => x.id === 'b-kueche'), u = B.nach.ueb; u.noetig = true; u.mit = B.foerderer.map(f => f.id); u.einl = {}; B.foerderer.forEach(f => u.einl[f.id] = { am: '2026-11-01', zu: 'ja' });
    const M = D.bedarfe.find(x => x.id === 'b-mtw'), f = M.foerderer.find(x => x.status === 'zugesagt'); f.eingegangen = 10000; f.eingangAm = '2026-10-02'; renderNow();
    const g = document.querySelector('tr[data-id="b-mtw"] .fr.geld .fn'), tr = document.querySelector('tr[data-id="b-kueche"]'), td = tr.querySelector('td.l-ueb'), L = td.getBoundingClientRect().left;
    return [!!g && getComputedStyle(g).color === getComputedStyle(document.documentElement).getPropertyValue('--e5ink').trim().replace(/^#(..)(..)(..)$/, (m, a, b, c) => `rgb(${parseInt(a, 16)}, ${parseInt(b, 16)}, ${parseInt(c, 16)})`),
      getComputedStyle(td, '::before').width, [...tr.querySelectorAll('.ue-pkt')].map(x => { const q = x.getBoundingClientRect(); return Math.abs(q.left + q.width / 2 - L - .5) < .6; })]; });
  ok(r[0] && r[1] === '1px' && r[2].length === 2 && r[2].every(Boolean), 'eingegangen grün; Trennlinie vor der Spendenübergabe, Punkte mittig darauf: ' + JSON.stringify(r));
  // 0.163: Rundmail für mehrere Bedarfe einer Gliederung
  await p.evaluate(() => { const n = Object.assign(blank(), { id: 'b-bue2', titel: 'Funkgeräte OV', gliederung: 'Büren', summe: 4200, zust: [Object.assign(leerZ(), { n: 'Rita Probe', mail: 'rita@x.example' })] }); D.bedarfe.push(n);
    const a = D.bedarfe.find(x => x.id === 'b-dig-bue'); if (!a.zust.some(z => z.mail)) a.zust = [Object.assign(leerZ(), { n: 'Maria Beispiel', mail: 'maria@x.example' })];
    HTMLAnchorElement.prototype.click = function () { window.__url = this.href; }; oeffnen('b-dig-bue'); });
  await p.waitForTimeout(700);
  await p.evaluate(() => { rundmail(cur(), 'zust'); }); await p.waitForSelector('.rm-chips');
  r = await p.evaluate(() => [[...document.querySelectorAll('.rm-chip')].map(c => c.textContent.trim()).join('|'), document.querySelector('.rm-bwahl').hidden]);
  ok(/^Laptop und Beamer für den Ausbildungsraum\|＋ Büren 1$/.test(r[0]) && r[1], 'Rundmail: Chip des Bedarfs, „＋ Büren 1“ (Auswahl zu): ' + r.join(' / '));
  await p.click('.rm-cplus'); await p.click('.rm-bw input'); await p.waitForTimeout(100);
  await p.click('.rm-k:has-text("Terminvereinbarung zum Interview")'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.querySelectorAll('.rm-chip:not(.rm-cplus)').length, [...document.querySelectorAll('.rm-p')].map(x => x.textContent.trim()).join(','), document.querySelector('.rm-k.on .rm-ks').textContent, !document.querySelector('.rm-iv').hidden, getComputedStyle(document.querySelector('.rm input[type=checkbox]')).accentColor]);
  ok(r[0] === 2 && /Maria Beispiel/.test(r[1]) && /Rita Probe/.test(r[1]) && r[2] === 'Kurzes Gespräch zu „Laptop und Beamer für den Ausbildungsraum“ und „Funkgeräte OV“' && r[3], 'zweiter Bedarf: Empfänger beider, Betreff mit beiden Namen, „Interview → in Arbeit“ angeboten: ' + r.join(' | '));
  await p.click('.modal .btn-row button.primary, .modal button.primary:has-text("E-Mail")'); await p.waitForTimeout(300);
  r = await p.evaluate(() => [decodeURIComponent(window.__url || ''), ['b-dig-bue', 'b-bue2'].map(id => koItems(D.bedarfe.find(x => x.id === id)).find(u => u.name === 'Interview').st).join()]);
  ok(/maria@x\.example/.test(r[0]) && /rita@x\.example/.test(r[0]) && /„Laptop und Beamer für den Ausbildungsraum“ und „Funkgeräte OV“/.test(r[0]) && r[1] === 'arbeit,arbeit', 'E-Mail an beide Gliederungs-Bedarfe; Interview bei beiden „in Arbeit“: ' + r[1]);
  await finish(b, [p]);
})();
