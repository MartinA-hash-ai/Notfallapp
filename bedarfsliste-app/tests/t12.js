// Tempo und Bedienung (0.38): Rückgängig mit Unterschieden, Entwurf gedrosselt, einmal filtern je Neuzeichnen, Suche bei vielen Bedarfen entprellt,
// Tastatur (↑/↓, Enter, F2, Leertaste, „/“, Esc, Tab, Kalender), Kürzel-Übersicht, kein 5-px-Scrollbalken, Scrollposition, Mindestbreite nach Verkleinern
const { chromium, ok, open, finish, fs, T } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { file: T.HTML, fakefs: false });
  const K = p.keyboard;

  // Rückgängig: je Schritt nur die geänderten Bedarfe
  let r = await p.evaluate(() => {
    D = normalize({ bedarfe: Array.from({ length: 40 }, (x, i) => Object.assign(blank(), { id: 'u' + i, titel: 'Bedarf ' + i, summe: 1000 + i })) }); SAVED_JSON = JSON.stringify(D); undoReset(); renderNow();
    const out = [];
    D.bedarfe[3].titel = 'Geändert'; changed(); const s = UNDO.stack[UNDO.stack.length - 1]; out.push(s.alt.length, s.alt[0][0], s.neu.length, !!s.ordnung);
    D.settings.kartei = 'x.xlsx'; changed();
    D.bedarfe = D.bedarfe.filter(x => x.id !== 'u5'); changed();
    const nb = Object.assign(blank(), { id: 'neu1', titel: 'Neu' }); D.bedarfe.unshift(nb); changed();
    UNDO.tipp = 'u7|summe'; D.bedarfe.find(x => x.id === 'u7').summe = 1; changed(); UNDO.tipp = 'u7|summe'; D.bedarfe.find(x => x.id === 'u7').summe = 12; changed();
    out.push(UNDO.stack.length);
    undo(); out.push(D.bedarfe.find(x => x.id === 'u7').summe);
    undo(); out.push(D.bedarfe[0].id);
    undo(); out.push(D.bedarfe.map(x => x.id).indexOf('u5'));
    undo(); out.push(D.settings.kartei || '-');
    undo(); out.push(D.bedarfe.find(x => x.id === 'u3').titel, UNDO.stack.length);
    D.bedarfe[1].titel = 'hin'; changed(); D.bedarfe[1].titel = 'Bedarf 1'; changed(); out.push(UNDO.stack.length);
    return out; });
  ok(r.join('|') === '1|u3|0|false|5|1007|u0|5|-|Bedarf 3|0|0',
    'Rückgängig speichert nur Geändertes; Tippen = ein Schritt; Löschen, Neu, Einstellungen und Reihenfolge kommen richtig zurück; Hin-und-zurück ist kein Schritt: ' + r.join('|'));

  // Entwurf im Browser gedrosselt
  r = await p.evaluate(async () => { localStorage.removeItem(draftKey()); D.bedarfe[0].titel = 'Entwurf?'; changed(); const sofort = !!localStorage.getItem(draftKey()); await new Promise(x => setTimeout(x, 1700)); return [sofort, !!localStorage.getItem(draftKey())]; });
  ok(r.join('|') === 'false|true', 'Entwurf im Browser nicht bei jedem Tastendruck, sondern kurz danach: ' + r.join('|'));

  // je Neuzeichnen nur einmal filtern und sortieren; Suche bei vielen Bedarfen entprellt
  r = await p.evaluate(() => { let n = 0; const orig = window.filterUndSortiere; window.filterUndSortiere = () => { n++; return orig(); }; renderNow(); window.filterUndSortiere = orig; return n; });
  ok(r === 1, 'je Neuzeichnen nur einmal gefiltert und sortiert (vorher bis zu fünfmal): ' + r);
  const t300 = await p.evaluate(() => { D = normalize({ bedarfe: Array.from({ length: 320 }, (x, i) => Object.assign(blank(), { id: 'v' + i, titel: (i % 7 ? 'Zelt ' : 'Funk ') + i, summe: 500 + i })) }); SAVED_JSON = JSON.stringify(D); undoReset();
    const t = fn => { const a = performance.now(); fn(); return Math.round(performance.now() - a); };
    return { render: t(() => renderNow()), changed: t(() => { D.bedarfe[1].titel = 'x'; changed(); }), sortiert: t(() => { UI.sort = [{ k: 'fin', d: 'auf' }, { k: 'summe', d: 'ab' }]; ORDER.ids = null; renderNow(); }) }; });
  console.log('Zeiten bei 320 Bedarfen (ms):', JSON.stringify(t300));
  ok(t300.render < 1500 && t300.changed < 200 && t300.sortiert < 1500, 'bei 320 Bedarfen flüssig genug: ' + JSON.stringify(t300));
  await p.evaluate(() => { UI.sort = []; renderNow(); });
  await p.fill('#q', 'funk');
  r = await p.evaluate(() => document.querySelectorAll('#list-body tr[data-id]').length);
  await p.waitForTimeout(250);
  const r2 = await p.evaluate(() => document.querySelectorAll('#list-body tr[data-id]').length);
  ok(r === 320 && r2 === 46, 'Suche bei vielen Bedarfen: erst nach kurzer Tipp-Pause gefiltert: ' + r + ' → ' + r2);
  await p.fill('#q', ''); await p.waitForTimeout(250);

  // Tastatur
  await p.evaluate(() => { D = normalize({ bedarfe: ['Anna', 'Berta', 'Cäsar'].map((t, i) => Object.assign(blank(), { id: 'k' + i, titel: t, summe: 100 * (i + 1), deadline: '2027-03-1' + i })) }); SAVED_JSON = JSON.stringify(D); undoReset(); UI.ansicht = 'voll'; UI.sort = [{ k: 'titel', d: 'auf' }]; ORDER.ids = null; renderNow(); document.activeElement.blur(); });
  const fokus = () => p.evaluate(() => { const e = document.activeElement; return e.matches('tr[data-id]') ? e.dataset.id : e.className || e.tagName; });
  await K.press('ArrowDown'); const f1 = await fokus(); await K.press('ArrowDown'); const f2 = await fokus(); await K.press('End'); const f3 = await fokus(); await K.press('ArrowUp'); const f4 = await fokus();
  ok([f1, f2, f3, f4].join() === 'k0,k1,k2,k1', '↓ ↓ Ende ↑: von Bedarf zu Bedarf: ' + [f1, f2, f3, f4].join());
  await K.press(' ');
  r = await p.evaluate(() => [D.bedarfe.find(x => x.id === 'k1').prio, document.activeElement.dataset.id]);
  ok(r.join('|') === 'hoch|k1', 'Leertaste: Prio-Stern an, Fokus bleibt auf der Zeile: ' + r.join('|'));
  await K.press('F2'); await K.press('End'); await K.type(' B.'); await K.press('Tab');
  r = await p.evaluate(() => [D.bedarfe.find(x => x.id === 'k1').titel, document.activeElement.className, document.activeElement.placeholder]);
  ok(r[0] === 'Berta B.' && r[1].includes('le-edit') && r[2] === 'Summe', 'F2 ändert den Namen, Tab übernimmt und geht zur Summe: ' + r.join('|'));
  await K.press('Escape');
  ok(await fokus() === 'k1', 'Esc im Feld: Fokus zurück auf der Zeile');
  await K.press('Enter'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => UI.view === 'detail' && UI.id === 'k1'), 'Enter öffnet den Bedarf (ausführliche Ansicht)');
  await K.press('Escape'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => UI.view === 'list') && await fokus() === 'k1', 'Esc zurück: Fokus auf dem Bedarf, von dem man kommt');
  await p.evaluate(() => { UI.ansicht = 'kompakt'; renderNow(); document.querySelector('#list-body tr[data-id="k0"]').focus(); });
  await K.press('Enter');
  r = await p.evaluate(() => [UI.auf, UI.view, document.activeElement.dataset.id]);
  ok(r.join('|') === 'k0|list|k0', 'kompakt: Enter klappt auf, Fokus bleibt: ' + r.join('|'));
  await K.press('Escape');
  ok(await p.evaluate(() => !UI.auf && document.activeElement.dataset.id === 'k0'), 'Esc klappt zu, Fokus bleibt');
  await K.press('Enter'); await K.press('Enter'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => UI.view === 'detail' && UI.id === 'k0'), 'kompakt: Enter, Enter öffnet');
  await K.press('Escape'); await p.waitForTimeout(150);
  await K.press('/');
  ok(await p.evaluate(() => document.activeElement.id === 'q'), '„/“ springt in die Suche');
  await p.evaluate(() => { document.activeElement.blur(); UI.ansicht = 'voll'; renderNow(); });
  // Kalender mit der Tastatur
  await p.click('#list-body tr[data-id="k2"] [data-le="deadline"]');
  r = await p.evaluate(() => document.activeElement.dataset.v);
  await K.press('ArrowRight'); await K.press('ArrowDown'); await K.press('Enter');
  r = [r, await p.evaluate(() => D.bedarfe.find(x => x.id === 'k2').deadline)];
  ok(r.join('|') === '2027-03-12|2027-03-20', 'Kalender: öffnet auf dem Datum, → und ↓ wandern, Enter übernimmt: ' + r.join('|'));
  await p.click('button[data-act="menu"]'); await p.click('#mmenu button[data-act="kuerzel"]');
  ok((await p.$eval('.modal', e => e.textContent)).includes('F2'), 'Zahnrad → Tastenkürzel: Übersicht');
  await p.click('.modal footer button');

  // kein 5-px-Scrollbalken; waagrechte Scrollposition bleibt beim Neuzeichnen
  r = await p.evaluate(() => { const t = document.querySelector('.tablewrap'); return t.scrollWidth - t.clientWidth; });
  ok(r <= 0, 'kein kleiner waagrechter Scrollbalken in der Tabelle: ' + r);
  await p.setViewportSize({ width: 900, height: 900 }); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const t = document.querySelector('.tablewrap'); t.scrollLeft = 150; const a = t.scrollLeft; keep(renderNow); return [a, document.querySelector('.tablewrap').scrollLeft]; });
  ok(r[0] > 0 && r[0] === r[1], 'Neuzeichnen: Tabelle bleibt waagrecht, wo sie war: ' + r.join('|'));
  // aufgeklappt, dann Fenster kleiner: keine feste Mindestbreite mehr
  await p.setViewportSize({ width: 1500, height: 900 });
  await p.evaluate(() => { UI.ansicht = 'kompakt'; renderNow(); aufklappen('k1'); });
  const m0 = await p.evaluate(() => document.querySelector('table.list').style.minWidth);
  await p.setViewportSize({ width: 1100, height: 900 }); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.querySelector('table.list').style.minWidth, document.querySelector('table.list').classList.contains('auf-fest')]);
  ok(m0 && r[0] === '' && r[1], 'aufgeklappt und Fenster verkleinert: Spalten bleiben anteilig, keine alte Mindestbreite: ' + m0 + ' → ' + JSON.stringify(r));

  await finish(b, [p]);
})();
