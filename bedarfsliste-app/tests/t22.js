// 0.80: mehrere Bedarfe gemeinsam bearbeiten – Prio, Freigaben, Förderer (Stand, entfernen, hinzufügen); ein Schritt zum Rückgängigmachen
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  await p.evaluate(() => {
    const x = (id, t, gl, F) => Object.assign(blank(), { id, titel: t, summe: 2000, gliederung: gl, foerderer: F.map(([name, status, betrag]) => ff({ name, status, betrag })) });
    D = normalize({ bedarfe: [x('a', 'Zelt', 'Brakel', [['Stiftung A', 'beantragt', 1000], ['Bank B', 'geplant', 500]]), x('b', 'Funk', 'Hagen', [['Stiftung A', 'geplant', null]]),
      x('c', 'Küche', 'Diözese', []), x('d', 'Bleibt', 'Brakel', [['Stiftung A', 'beantragt', 300]])] }); SAVED_JSON = JSON.stringify(D); undoReset(); renderNow();
  });
  await p.click('[data-act="mehr-wahl"]'); await p.waitForTimeout(80);
  let r = await p.evaluate(() => [!!UI.mehrWahl, !!document.querySelector('[data-act="mehr-los"][disabled]'), document.querySelector('#list-body tr:first-child').dataset.vorlage, document.querySelector('tr[data-vorlage] .mv-s').textContent]);
  ok(r.join('|') === 'true|true|1|erst Bedarfe anklicken', 'Knopf „Bearbeiten“: oben eine leere Vorlage, „Übertragen“ erst mit Auswahl: ' + r.join('|'));
  for (const id of ['a', 'b', 'c']) await p.click(`#list-body tr[data-id="${id}"] .l-sum`);
  r = await p.evaluate(() => [UI.mehrWahl.size, document.querySelector('[data-act="mehr-los"]').textContent, document.querySelectorAll('#list-body tr.heute-w').length, document.querySelector('tr[data-vorlage] .mv-s').textContent]);
  ok(r.join('|') === '3|Auf 3 übertragen|3|gilt für 3 ausgewählte Bedarfe', 'drei angeklickt: ' + r.join('|'));
  // Vorlage bearbeiten wie eine Zeile: Summe, Ort, Prio, Freigaben, Förderer
  const V = 'tr[data-vorlage]';
  await p.click(V + ' [data-le="summe"]'); await p.keyboard.type('4000'); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  await p.click(V + ' [data-le="ort"]'); await p.keyboard.type('Brakel'); await p.waitForTimeout(50); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  if (await p.$('.le-edit')) { await p.keyboard.press('Enter'); await p.waitForTimeout(80); }
  r = await p.evaluate(() => [MEHR.T.summe, MEHR.T.gliederung, D.bedarfe.find(x => x.id === 'a').summe, !!document.querySelector('tr[data-vorlage]')]);
  ok(r[0] === 4000 && r[2] === 2000 && r[3], 'Summe in der Vorlage eingetragen, die Bedarfe noch unverändert: ' + r.join('|'));
  await p.click(V + ' .star-p'); await p.waitForTimeout(50);
  await p.click(V + ' [data-le="fr"][data-k="ofk"]'); await p.click(V + ' [data-le="fr"][data-k="ofk"]'); await p.waitForTimeout(50);   // offen → in Bearbeitung → freigegeben
  await p.click(V + ' [data-le="fr"][data-k="fach"]'); await p.waitForTimeout(50);                                                      // → in Bearbeitung
  r = await p.evaluate(() => [MEHR.T.prio, MEHR.T.freigabe.ofk.st, MEHR.T.freigabe.fach.st, [...MEHR.beruehrt].sort().join(',')]);
  ok(r.join('|') === 'hoch|ok|angefragt|fr.fach,fr.ofk,prio', 'Prio und Freigaben in der Vorlage angeklickt: ' + r.join('|'));
  // Förderer in der Vorlage: neu (mit Betrag) und einer, der schon da ist (Stiftung A → zugesagt)
  await p.evaluate(() => { const T = MEHR.T; T.foerderer.push(ff({ name: 'Lotterie L', betrag: 250 }), ff({ name: 'Stiftung A', status: 'zugesagt' })); T.foerderer[0].vn.frist = '2027-06-30'; relist(T); });
  await p.click('[data-act="mehr-los"]'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const g = id => D.bedarfe.find(x => x.id === id);
    return [['a', 'b', 'c', 'd'].map(id => g(id).prio + ':' + g(id).summe).join(','), g('a').freigabe.ofk.st + '/' + g('b').freigabe.ofk.st + '/' + g('c').freigabe.ofk.st, g('a').freigabe.fach.st + ':' + !!g('a').freigabe.fach.angefragt + ':' + g('a').freigabe.verw.st,
      g('a').foerderer.map(f => f.name + ':' + f.status + ':' + (foeAmt(f) || 0)).join(','), g('c').foerderer.map(f => f.name + ':' + f.status + ':' + f.vn.frist).join(','), g('d').foerderer[0].status, UI.mehrWahl, !!document.querySelector('tr[data-vorlage]')]; });
  ok(r[0] === 'hoch:4000,hoch:4000,hoch:4000,mittel:2000', 'Prio und Summe bei den dreien, beim vierten nicht: ' + r[0]);
  ok(r[1] === 'ok/ok/ok', 'Ortsführungskreis freigegeben (auch beim bisherigen Diözesan-Bedarf, der jetzt den Ort Brakel hat): ' + r[1]);
  ok(r[2] === 'angefragt:true:offen', 'Fachreferat in Bearbeitung, Verwaltung (nicht angeklickt) unverändert: ' + r[2]);
  ok(r[3] === 'Stiftung A:zugesagt:1000,Bank B:geplant:500,Lotterie L:geplant:250', 'schon da: Stiftung A zugesagt (Betrag bleibt), neu: Lotterie mit Betrag: ' + r[3]);
  ok(r[4] === 'Lotterie L:geplant:2027-06-30,Stiftung A:zugesagt:' && r[5] === 'beantragt' && r[6] === null && r[7] === false, 'neue Förderer mit Frist des Nachweises; nicht ausgewählter unverändert; Vorlage weg: ' + r.slice(4).join(' | '));
  r = await p.evaluate(() => document.querySelector('.toast') && document.querySelector('.toast').textContent);
  ok(/3 Bedarfe geändert/.test(r), 'ein Hinweis am Ende: ' + r);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => D.bedarfe.every(x => x.prio === 'mittel') && D.bedarfe.find(x => x.id === 'a').foerderer.length === 2), 'Strg+Z nimmt alles auf einmal zurück');
  // kompakt: ein Klick auf die Freigabe der Vorlage gibt alle frei
  await p.evaluate(() => { UI.ansicht = 'kompakt'; renderNow(); });
  await p.click('[data-act="mehr-wahl"]'); await p.click('[data-act="mehr-alle"]'); await p.waitForTimeout(60);
  await p.click('tr[data-vorlage] td.k-fr'); await p.waitForTimeout(60);
  r = await p.evaluate(() => [UI.mehrWahl.size, ['ofk', 'fach', 'verw'].map(k => MEHR.T.freigabe[k].st).join(','), MEHR.beruehrt.size]);
  ok(r.join('|') === '4|ok,ok,ok|3', 'kompakt: „Alle“ wählt alle, Klick auf die Freigabe der Vorlage gibt alle frei: ' + r.join('|'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => !UI.mehrWahl && !document.querySelector('tr[data-vorlage]')), 'Esc beendet, ohne etwas zu ändern');
  await p.evaluate(() => { UI.ansicht = 'voll'; renderNow(); });
  // Spendenübergabe in der Liste: Punkt je Förderer, der dabei sein soll; grün = kommt; Linie, wenn eingeladen oder kommt
  r = await p.evaluate(() => { const x = D.bedarfe.find(y => y.id === 'a'); x.foerderer.forEach(f => { f.status = 'zugesagt'; f.zugesagt = 500; });
    x.nach.ueb.mit = x.foerderer.map(f => f.id); x.nach.ueb.einl = { [x.foerderer[0].id]: { am: '2026-10-28', zu: 'ja' } }; changed(); renderNow();
    const tr = document.querySelector('#list-body tr[data-id="a"]'); return [[...tr.querySelectorAll('td.l-fin .ue-weg')].map(w => (w.classList.contains('an') ? 'linie' : '-') + '/' + (w.querySelector('.ue-pkt.ok') ? 'grün' : 'grau')).join(','), tr.querySelector('td.l-ueb').classList.contains('mit-pkt')]; });
  ok(r.join('|') === 'linie/grün,-/grau|true', 'Liste: Punkte für die Übergabe (grün mit Linie = kommt, grau = vorgesehen): ' + r.join('|'));
  await finish(b, [p]);
})();
