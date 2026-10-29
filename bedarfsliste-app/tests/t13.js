// Tastatur und Ansicht (0.39): ↓/↑ auf der Seite eines Bedarfs öffnen den nächsten/vorigen, kompakt aufgeklappt klappen ↑/↓ den nächsten auf,
// E ändert den Namen, Strg+F springt in die Suche, „i“ oben rechts mit den Tastaturbefehlen, dezente Sterne, Leiste ohne Überschrift,
// Kopf der Bedarfsseite (nur „⋯“, Löschen darin, graues + unten am Strich), eigener Kalender und Uhrzeit auf der Bedarfsseite, Dreieck am Förderer grau/rot
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  const K = p.keyboard;
  await p.evaluate(() => {
    D = normalize({ bedarfe: ['Anna', 'Berta', 'Cäsar', 'Dora'].map((t, i) => Object.assign(blank(), { id: 'k' + i, titel: t, summe: 100 * (i + 1), gliederung: 'Paderborn', prio: i === 2 ? 'hoch' : 'mittel' })) });
    SAVED_JSON = JSON.stringify(D); undoReset(); UI.ansicht = 'voll'; UI.sort = [{ k: 'titel', d: 'auf' }]; UI.prioKopf = 0; ORDER.ids = null; renderNow(); document.activeElement.blur();
  });
  const zustand = () => p.evaluate(() => [UI.view, UI.id, UI.auf || '-', (document.activeElement.dataset || {}).id || document.activeElement.tagName].join('|'));

  // Leiste: ohne Überschrift und Hinweistext, rechts außen das „i“
  let r = await p.evaluate(() => { const L = document.querySelector('.list-head'), i = L.querySelector('.kz-info'), t = L.querySelector('.tools');
    return [!L.querySelector('h2, .strg-hint'), L.querySelector('#list-count').textContent, !!i && t.lastElementChild === i, i && i.dataset.tip]; });
  ok(r.join('|') === 'true|4 von 4|true|Tastaturbefehle', 'Leiste: keine Überschrift, kein Hinweistext; ganz rechts das „i“ (Hinweis „Tastaturbefehle“): ' + r.join('|'));
  await p.hover('.list-head .kz-info');
  ok(await p.evaluate(() => (document.querySelector('.tip-pop') || {}).textContent === 'Tastaturbefehle'), 'beim Überfahren des „i“: „Tastaturbefehle“');
  await p.click('.list-head .kz-info');
  r = await p.$eval('.modal', e => [e.querySelector('h2, h3, header').textContent, e.textContent.includes('Strg+F'), e.textContent.includes('nächsten Bedarf der Liste öffnen'), [...e.querySelectorAll('tr.kz-g')].map(x => x.textContent).join('/')]);
  ok(r[0].includes('Tastaturbefehle') && r[1] && r[2] && r[3] === 'In der Liste/Auf der Seite eines Bedarfs/In Feldern/Überall', 'Klick aufs „i“: Tastaturbefehle nach Bereichen: ' + r.join('|'));
  await p.click('.modal footer button.primary');

  // Sterne ohne Prio ganz dezent
  r = await p.evaluate(() => { const c = q => getComputedStyle(document.querySelector(q)).color, ghost = getComputedStyle(document.documentElement).getPropertyValue('--ghost').trim();
    const rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')';
    return [c('#list-body tr[data-id="k0"] .star-p') === rgb(ghost), c('#list-body tr[data-id="k2"] .star-p') !== rgb(ghost)]; });
  ok(r.join() === 'true,true', 'Stern ohne Prio in der blassen Farbe, mit Prio gelb: ' + r.join());

  // Strg+F: in die Suche; steht man schon darin, darf der Browser suchen
  await p.evaluate(() => document.activeElement.blur());
  await K.press('Control+f');
  r = await p.evaluate(() => { const q = document.activeElement, ev = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true }); q.dispatchEvent(ev); return [q.id, ev.defaultPrevented]; });
  ok(r.join('|') === 'q|false', 'Strg+F: in die Suche; noch einmal: die Suche des Browsers: ' + r.join('|'));
  await p.evaluate(() => { document.activeElement.blur(); UI.q = ''; renderNow(); });
  await K.press('/');
  ok(await p.evaluate(() => document.activeElement.id !== 'q'), '„/“ springt nicht mehr in die Suche');

  // E ändert den Namen (F2 belegt Vivaldi)
  await p.evaluate(() => zeileFokus('k1'));
  await K.press('e'); await K.press('End'); await K.type('2'); await K.press('Enter');
  r = await p.evaluate(() => [D.bedarfe.find(x => x.id === 'k1').titel, document.activeElement.dataset.id]);
  ok(r.join('|') === 'Berta2|k1', 'E: Namen ändern, Enter übernimmt, Fokus bleibt auf der Zeile: ' + r.join('|'));

  // Seite eines Bedarfs: ↓ / ↑ in der Reihenfolge der Liste
  await p.evaluate(() => zeileFokus('k0')); await K.press('Enter'); await p.waitForTimeout(50);
  const seq = [await zustand()];
  await K.press('ArrowDown'); seq.push(await p.evaluate(() => UI.id));
  await K.press('ArrowDown'); seq.push(await p.evaluate(() => UI.id));
  await K.press('ArrowUp'); seq.push(await p.evaluate(() => UI.id));
  ok(seq.join(',') === 'detail|k0|-|BODY,k1,k2,k1', '↓ ↓ ↑ auf der Seite: nächster, nächster, voriger Bedarf: ' + seq.join(','));
  await K.press('ArrowDown'); await K.press('ArrowDown'); await K.press('ArrowDown');
  r = await p.evaluate(() => [UI.id, document.querySelector('#toasts').textContent.includes('letzte Bedarf')]);
  ok(r.join('|') === 'k3|true', 'am Ende der Liste: bleibt beim letzten, mit Hinweis: ' + r.join('|'));
  await p.click('#f-titel'); await K.press('ArrowUp');
  ok(await p.evaluate(() => UI.id === 'k3' && document.activeElement.id === 'f-titel'), 'im Namensfeld: ↑ bewegt den Cursor, blättert nicht');
  await p.evaluate(() => document.activeElement.blur());
  await p.click('[data-act="more"]'); await K.press('ArrowUp');
  ok(await p.evaluate(() => UI.id === 'k3'), 'bei offenem Menü: kein Blättern');
  await K.press('Escape'); await K.press('Escape'); await p.waitForTimeout(80);
  r = await zustand();
  ok(r === 'list|k3|-|k3', 'Esc: zurück zur Liste, Fokus auf dem Bedarf, bei dem man stand: ' + r);
  // aus einer gefilterten Liste geöffnet: ↑/↓ bleiben in ihr; ein Bedarf, der dort nicht steht (z. B. über einen Link geöffnet): alle Bedarfe des Reiters
  await p.evaluate(() => { UI.q = 'anna'; ORDER.ids = null; renderNow(); oeffnen('k0'); document.querySelector('#toasts').innerHTML = ''; });
  await K.press('ArrowDown');
  r = await p.evaluate(() => [UI.id, document.querySelector('#toasts').textContent.includes('letzte Bedarf')]);
  ok(r.join('|') === 'k0|true', 'aus der gefilterten Liste (nur Anna) geöffnet: ↓ bleibt in ihr: ' + r.join('|'));
  await p.evaluate(() => { UI.q = 'xyz'; oeffnen('k2'); });
  await K.press('ArrowDown');
  r = await p.evaluate(() => UI.id);
  ok(r === 'k3', 'Bedarf steht in keiner Liste (über einen Link geöffnet): ↓ geht zum nächsten aller Bedarfe: ' + r);
  await p.evaluate(() => { UI.q = ''; zurueck(); });

  // kompakt: ist ein Bedarf aufgeklappt, klappen ↑/↓ gleich den nächsten auf
  await p.evaluate(() => { UI.ansicht = 'kompakt'; renderNow(); zeileFokus('k0'); });
  await K.press('Enter'); const s2 = [await zustand()];
  await K.press('ArrowDown'); s2.push(await zustand());
  await K.press('ArrowDown'); s2.push(await zustand());
  await K.press('ArrowUp'); s2.push(await zustand());
  ok(s2.join(',') === 'list|k3|k0|k0,list|k3|k1|k1,list|k3|k2|k2,list|k3|k1|k1', 'kompakt aufgeklappt: ↓ ↓ ↑ klappen den nächsten bzw. vorigen auf: ' + s2.join(','));
  await K.press('Escape');
  await K.press('ArrowDown');
  ok(await zustand() === 'list|k3|-|k2', 'zugeklappt: ↓ geht wieder nur von Zeile zu Zeile');
  await p.evaluate(() => { UI.ansicht = 'voll'; renderNow(); });

  // Kopf der Bedarfsseite: nur „⋯“ (Löschen steckt darin); Stichwort-+ grau, unten bündig mit dem Strich vor der Summe
  await p.evaluate(() => oeffnen('k2'));
  r = await p.evaluate(() => { const plus = document.querySelector('.sw-plus'), rh = document.querySelector('.d-right-head').getBoundingClientRect(), pr = plus.getBoundingClientRect();
    const rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')', faint = getComputedStyle(document.documentElement).getPropertyValue('--faint').trim();
    return [document.querySelectorAll('.d-actions button').length, !!document.querySelector('.d-actions [data-act="del"]'), getComputedStyle(plus).color === rgb(faint), Math.abs(pr.bottom - rh.bottom) <= 3]; });
  ok(r.join('|') === '1|false|true|true', 'Kopf: nur „⋯“, kein Mülleimer; + grau und unten bündig mit dem Strich: ' + r.join('|'));
  await p.click('[data-act="more"]');
  r = await p.$$eval('#mmenu button', L => L.map(x => x.textContent.trim()).join('/'));
  ok(r.endsWith('Archivieren/Bedarf löschen …'), '„⋯“: ganz unten „Bedarf löschen …“: ' + r);
  await p.click('#mmenu [data-act="del"]'); await p.waitForSelector('.modal');
  ok(await p.evaluate(() => !document.querySelector('#mmenu')), 'Rückfrage zum Löschen: Menü ist zu');
  await p.click('.modal footer button:not(.primary)');

  // Freigabe „angefragt am“, Spendenübergabe und Nachweis: eigener Kalender, Uhrzeit mit Rädern, tippen geht auch
  await p.evaluate(() => { const x = cur(); x.freigabe.ofk.st = 'angefragt'; x.freigabe.ofk.angefragt = '2026-10-01'; x.nach.ueb.noetig = true; x.foerderer.push(ff({ name: 'Stiftung Z', status: 'zugesagt', betrag: 300, zugesagt: 300 })); changed(); ZU = null; zuSet(x, 'nach', false); renderNow(); });
  ok(await p.evaluate(() => !document.querySelector('#app input[type=date], #app input[type=time]')), 'keine Datumsfelder des Browsers mehr auf der Bedarfsseite');
  await p.click('#fr-ofk input.dfeld');
  ok(await p.evaluate(() => !!document.querySelector('.cal-pop .cal-d.on[data-v="2026-10-01"]')), 'Freigabe „angefragt am“: Klick öffnet den eigenen Kalender auf dem Datum');
  await p.click('.cal-pop .cal-d[data-v="2026-10-05"]');
  ok(await p.evaluate(() => cur().freigabe.ofk.angefragt === '2026-10-05'), 'Tag gewählt: übernommen');
  await p.fill('#sec-nach .ue-termin input.dfeld', '7.11.2026'); await K.press('Tab');
  await p.waitForTimeout(50);
  r = await p.evaluate(() => [cur().nach.ueb.termin, cur().nach.ueb.st, !!document.querySelector('.zeit-pop')]);
  ok(r.join('|') === '2026-11-07|terminiert|true', 'Termin getippt: übernommen, Übergabe „terminiert“, mit Tab weiter zur Uhrzeit (Räder offen): ' + r.join('|'));
  await p.click('.zeit-pop .zeit-col[data-k="h"] [data-v="14"]'); await p.click('.zeit-pop .zeit-col[data-k="m"] [data-v="45"]');
  ok(await p.evaluate(() => cur().nach.ueb.zeit === '14:45' && !document.querySelector('.zeit-pop')), 'Uhrzeit über die Räder: 14:45');
  await p.fill('#sec-nach input.zfeld', 'abc'); await K.press('Enter');
  r = await p.evaluate(() => [cur().nach.ueb.zeit, document.querySelector('#sec-nach input.zfeld').value, document.querySelector('#toasts').textContent.includes('keine Uhrzeit')]);
  ok(r.join('|') === '14:45|14:45|true', 'Unsinn als Uhrzeit: nicht übernommen, Hinweis: ' + r.join('|'));
  const fid = await p.evaluate(() => cur().foerderer[0].id);
  await p.fill(`#nl-${fid} input.dfeld`, '31.3.2027'); await K.press('Enter');
  ok(await p.evaluate(() => cur().foerderer[0].vn.frist === '2027-03-31'), 'Frist des Verwendungsnachweises getippt: übernommen');

  // Dreieck am Förderer: rot bei Zusage ohne Betrag, grau, wenn er nur auch bei anderen Bedarfen steht
  r = await p.evaluate(() => { const x = cur(); x.foerderer[0].zugesagt = null; x.foerderer[0].betrag = null; D.bedarfe.find(y => y.id === 'k0').foerderer.push(ff({ name: 'Stiftung Y' })); x.foerderer.push(ff({ name: 'Stiftung Y' })); changed(); renderNow();
    const t = f => { const e = document.querySelector(`#fw-${f.id} .fw-tri`); return e ? (e.classList.contains('grau') ? 'grau' : 'rot') : '-'; };
    return [t(x.foerderer[0]), t(x.foerderer[1]), infosAlle().filter(i => i.b === x).map(i => i.t).join(', ')]; });
  ok(r.join('|') === 'rot|grau|Antrag läuft, Freigabe noch nicht vollständig, Zusage ohne Betrag: Stiftung Z', 'Dreieck: rot bei Zusage ohne Betrag (oben als Info), grau bei „auch im Förderplan von“ (oben nicht): ' + r.join('|'));

  await finish(b, [p]);
})();
