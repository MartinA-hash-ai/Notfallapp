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
  let r = await p.evaluate(() => [!!UI.mehrWahl, !!document.querySelector('[data-act="mehr-los"][disabled]'), !document.querySelector('tr[data-vorlage]')]);
  ok(r.join('|') === 'true|true|true', 'Knopf „Bearbeiten“: Auswahl beginnt, keine Vorlage in der Liste: ' + r.join('|'));
  for (const id of ['a', 'b', 'd']) await p.click(`#list-body tr[data-id="${id}"] .l-sum`);
  r = await p.evaluate(() => [UI.mehrWahl.size, document.querySelector('[data-act="mehr-los"]').textContent]);
  ok(r.join('|') === '3|3 Bedarfe bearbeiten …', 'drei angeklickt: ' + r.join('|'));
  await p.click('[data-act="mehr-los"]'); await p.waitForTimeout(150);
  const V = '#mehr-body tr[data-vorlage]';
  r = await p.evaluate(() => [document.querySelector('.modal.mv-modal h2').textContent, document.querySelectorAll('#mehr-body tr').length, [...document.querySelectorAll('#mehr-body .fn-t')].map(x => x.textContent).join(','), document.querySelectorAll('#mehr-body .ml.mv-unv').length]);
  ok(r.join('|') === '3 Bedarfe gemeinsam bearbeiten|1|Stiftung A|3', 'Fenster mit einer Zeile; Stiftung A steht bei allen und ist schon da; Freigaben „unverändert“: ' + r.join('|'));
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.mv-modal header h2')).display === 'none' && !document.querySelector('.mv-modal .mv p') && !document.querySelector('.mv-modal footer button') && document.activeElement.classList.contains('mv-ok')), 'ohne Überschrift, Hinweis und „Abbrechen“; „Übernehmen“ oben');
  await p.click(V + ' [data-le="summe"]'); await p.keyboard.type('4000'); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  await p.click(V + ' [data-le="ort"]'); await p.keyboard.type('Brakel'); await p.waitForTimeout(50); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  if (await p.$('.le-edit')) { await p.keyboard.press('Enter'); await p.waitForTimeout(80); }
  ok(await p.evaluate(() => !!document.querySelector('.modal.mv-modal') && MEHR.T.summe === 4000 && MEHR.T.gliederung === 'Brakel'), 'Summe und Ort im Fenster eingetragen, Fenster bleibt offen (Enter/Esc schließen nur das Feld)');
  await p.click(V + ' .star-p');
  await p.click(V + ' [data-le="fr"][data-k="ofk"]');                                       // → freigegeben
  await p.click(V + ' [data-le="fr"][data-k="verw"]'); await p.click(V + ' [data-le="fr"][data-k="verw"]');   // → freigegeben → in Bearbeitung
  await p.click(V + ' [data-le="fr"][data-k="fach"]');                                       // → freigegeben
  r = await p.evaluate(() => [MEHR.T.freigabe.ofk.st, MEHR.T.freigabe.verw.st, MEHR.T.freigabe.fach.st, document.querySelectorAll('#mehr-body .ml.mv-unv').length]);
  ok(r.join('|') === 'ok|angefragt|ok|0', 'alle drei Freigaben anklickbar: ' + r.join('|'));
  // Stiftung A (bei allen): Stand → zugesagt, Nachweis-Frist, Übergabe „kommt“; neuer Förderer mit Betrag
  await p.click(V + ' [data-le="foe"]'); await p.click(V + ' [data-le="foe"]'); await p.waitForTimeout(50);   // verschiedene Stände → „geplant“ → beantragt → zugesagt
  r = await p.evaluate(() => MEHR.T.foerderer[0].status); ok(r === 'zugesagt', 'Stand des gemeinsamen Förderers weitergeschaltet: ' + r);
  await p.click(V + ' [data-le="vn-frist"]'); await p.waitForTimeout(60); await p.evaluate(() => { const d = document.querySelector('.cal-pop .cal-d'); d.click(); });
  await p.click(V + ' [data-le="ue-mit"]'); await p.click(V + ' [data-le="ue-mit"]'); await p.waitForTimeout(50);   // dabei → kommt
  await p.click(V + ' .le-plus'); await p.keyboard.type('Lotterie L'); await p.keyboard.press('Enter'); await p.keyboard.type('250'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [MEHR.T.foerderer.map(f => f.name).join(','), MEHR.ue.get(MEHR.T.foerderer[0].id), !!MEHR.T.foerderer[0].vn.frist]);
  ok(r.join('|') === 'Stiftung A,Lotterie L|kommt|true', 'Frist, Übergabe und neuer Förderer im Fenster: ' + r.join('|'));
  await p.click('.modal.mv-modal header .mv-ok'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const g = id => D.bedarfe.find(x => x.id === id), A = g('a').foerderer.find(f => f.name === 'Stiftung A');
    return [['a', 'b', 'c', 'd'].map(id => g(id).prio + ':' + g(id).summe + ':' + g(id).gliederung).join(','), ['a', 'b', 'd'].map(id => ['ofk', 'verw', 'fach'].map(k => g(id).freigabe[k].st).join('/')).join(','),
      A.status + ':' + (foeAmt(A) || 0) + ':' + !!A.vn.frist + ':' + g('a').nach.ueb.mit.includes(A.id) + ':' + ((g('a').nach.ueb.einl || {})[A.id] || {}).zu,
      g('a').foerderer.map(f => f.name + ':' + (foeAmt(f) || 0)).join(','), g('c').foerderer.length, UI.mehrWahl, !document.querySelector('.modal')]; });
  ok(r[0] === 'hoch:4000:Brakel,hoch:4000:Brakel,mittel:2000:Diözese,hoch:4000:Brakel', 'Prio, Summe, Ort bei den dreien, beim vierten nicht: ' + r[0]);
  ok(r[1] === 'ok/angefragt/ok,ok/angefragt/ok,ok/angefragt/ok', 'Freigaben bei allen: ' + r[1]);
  ok(r[2] === 'zugesagt:1000:true:true:ja', 'Stiftung A zugesagt (Betrag bleibt), Frist gesetzt, bei der Übergabe dabei und kommt: ' + r[2]);
  ok(r[3] === 'Stiftung A:1000,Bank B:500,Lotterie L:250' && r[4] === 0 && r[5] === null && r[6], 'neuer Förderer mit Betrag dazu; nicht ausgewählter unverändert; Fenster zu, Auswahl beendet: ' + r.slice(3).join(' | '));
  r = await p.evaluate(() => document.querySelector('.toast') && document.querySelector('.toast').textContent);
  ok(/3 Bedarfe geändert/.test(r), 'ein Hinweis am Ende: ' + r);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => D.bedarfe.every(x => x.prio === 'mittel') && D.bedarfe.find(x => x.id === 'a').foerderer.length === 2), 'Strg+Z nimmt alles auf einmal zurück');
  // Abbrechen ändert nichts; „alle freigeben“ im Kopf
  await p.click('[data-act="mehr-wahl"]'); await p.click('[data-act="mehr-alle"]'); await p.click('[data-act="mehr-los"]'); await p.waitForTimeout(100);
  await p.click('.mv-alle'); await p.waitForTimeout(50);
  ok(await p.evaluate(() => ['ofk', 'fach', 'verw'].every(k => MEHR.T.freigabe[k].st === 'ok') && MEHR.beruehrt.size === 3), '„alle freigeben“ im Spaltenkopf');
  await p.click('.modal.mv-modal header .x'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => D.bedarfe.every(x => x.freigabe.ofk.st !== 'ok') && !!UI.mehrWahl), '× ändert nichts, die Auswahl bleibt');
  await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => !UI.mehrWahl), 'Esc beendet die Auswahl');
  await p.click('[data-act="mehr-wahl"]'); ok(await p.evaluate(() => document.querySelector('[data-act="mehr-ende"]').textContent === '×'), '„Beenden“ ist ein Kästchen mit ×'); await p.click('[data-act="mehr-ende"]');
  // kompakt: Punkte für die Übergabe vor dem Stand
  r = await p.evaluate(() => { const x = D.bedarfe.find(y => y.id === 'a'), f = x.foerderer[0]; f.status = 'zugesagt'; x.nach.ueb.mit = [f.id]; UI.ansicht = 'kompakt'; renderNow(); const n = document.querySelectorAll('#list-body tr[data-id="a"] .k-ue-p i').length; UI.ansicht = 'voll'; renderNow(); return n; });
  ok(r === 1, 'kompakte Liste: Punkt für den Förderer, der bei der Übergabe dabei ist: ' + r);
  // Spendenübergabe in der Liste: Punkt je Förderer, der dabei sein soll; grün = kommt; Linie, wenn eingeladen oder kommt
  r = await p.evaluate(() => { const x = D.bedarfe.find(y => y.id === 'a'); x.foerderer.forEach(f => { f.status = 'zugesagt'; f.zugesagt = 500; });
    x.nach.ueb.mit = x.foerderer.map(f => f.id); x.nach.ueb.einl = { [x.foerderer[0].id]: { am: '2026-10-28', zu: 'ja' } }; changed(); renderNow();
    const tr = document.querySelector('#list-body tr[data-id="a"]'); return [[...tr.querySelectorAll('td.l-fin .ue-weg')].map(w => (w.classList.contains('an') ? 'linie' : '-') + '/' + (w.querySelector('.ue-pkt.p-ja') ? 'grün' : 'grau')).join(','), tr.querySelector('td.l-ueb').classList.contains('mit-pkt')]; });
  ok(r.join('|') === 'linie/grün,-/grau|true', 'Liste: Punkte für die Übergabe (grün mit Linie = kommt, grau = vorgesehen): ' + r.join('|'));
  await finish(b, [p]);
})();
