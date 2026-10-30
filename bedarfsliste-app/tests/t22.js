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
  ok(await p.evaluate(() => !!UI.mehrWahl && !!document.querySelector('[data-act="mehr-los"][disabled]')), 'Knopf „Bearbeiten“: Auswahl beginnt, „Bearbeiten …“ erst mit Auswahl');
  for (const id of ['a', 'b', 'c']) await p.click(`#list-body tr[data-id="${id}"] .l-sum`);
  let r = await p.evaluate(() => [UI.mehrWahl.size, document.querySelector('[data-act="mehr-los"]').textContent, document.querySelectorAll('#list-body tr.heute-w').length]);
  ok(r.join('|') === '3|3 bearbeiten …|3', 'drei angeklickt: ' + r.join('|'));
  await p.click('[data-act="mehr-los"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, [...document.querySelectorAll('.mw-f .mw-fn b')].map(x => x.textContent).join(','), document.querySelector('.mw-f:not(.mw-alle) .muted').textContent]);
  ok(r[0] === '3 Bedarfe gemeinsam bearbeiten' && r[1] === 'Alle Förderer,Stiftung A,Bank B' && /bei 2 von 3/.test(r[2]), 'Fenster: vorhandene Förderer mit „bei x von n“: ' + r.join(' | '));
  const knopf = async (zeile, text) => { await p.evaluate(([z, t]) => { const row = [...document.querySelectorAll('.mw-z')].find(x => x.querySelector('.mw-l').textContent.startsWith(z)); [...row.querySelectorAll('button')].find(x => x.textContent === t).click(); }, [zeile, text]); };
  await knopf('Prio', 'Prio setzen'); await knopf('Ortsführungskreis', 'freigegeben'); await knopf('Fachreferat', 'in Bearbeitung');
  await p.evaluate(() => { const s = [...document.querySelectorAll('.mw-f')].find(x => x.textContent.includes('Stiftung A')).querySelector('select'); s.value = 'zugesagt'; s.dispatchEvent(new Event('change')); });
  await p.evaluate(() => { const s = [...document.querySelectorAll('.mw-f')].find(x => x.textContent.includes('Bank B')).querySelector('select'); s.value = 'weg'; s.dispatchEvent(new Event('change')); });
  await p.fill('.mw-neu input[aria-label="Neuer Förderer"]', 'Lotterie L'); await p.fill('.mw-neu input.num', '250');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const g = id => D.bedarfe.find(x => x.id === id);
    return [['a', 'b', 'c', 'd'].map(id => g(id).prio).join(','), g('a').freigabe.ofk.st + '/' + g('b').freigabe.ofk.st + '/' + g('c').freigabe.ofk.st, g('a').freigabe.fach.st + ':' + !!g('a').freigabe.fach.angefragt,
      g('a').foerderer.map(f => f.name + ':' + f.status + ':' + (foeAmt(f) || 0)).join(','), g('b').foerderer.map(f => f.name + ':' + f.status).join(','), g('c').foerderer.map(f => f.name + ':' + f.betrag).join(','), g('d').foerderer[0].status, UI.mehrWahl]; });
  ok(r[0] === 'hoch,hoch,hoch,mittel', 'Prio bei den dreien gesetzt, beim vierten nicht: ' + r[0]);
  ok(r[1] === 'ok/ok/offen', 'Ortsführungskreis freigegeben (bei der Diözese entfällt er): ' + r[1]);
  ok(r[2] === 'angefragt:true', 'Fachreferat in Bearbeitung, mit Datum: ' + r[2]);
  ok(r[3] === 'Stiftung A:zugesagt:1000,Lotterie L:geplant:250', 'Stiftung A zugesagt (Betrag übernommen), Bank B entfernt, Lotterie dazu: ' + r[3]);
  ok(r[4] === 'Stiftung A:zugesagt,Lotterie L:geplant' && r[5] === 'Lotterie L:250' && r[6] === 'beantragt' && r[7] === null, 'bei den anderen ebenso, der nicht gewählte unverändert, Auswahl beendet: ' + r.slice(4).join(' | '));
  r = await p.evaluate(() => document.querySelector('.toast') && document.querySelector('.toast').textContent);
  ok(/3 Bedarfe geändert/.test(r) && /Zusage ohne Betrag/.test(r), 'ein Hinweis am Ende (mit Zusage ohne Betrag bei „Funk“): ' + r);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => D.bedarfe.every(x => x.prio === 'mittel') && D.bedarfe.find(x => x.id === 'a').foerderer.length === 2), 'Strg+Z nimmt alles auf einmal zurück');
  // Alle + Esc
  await p.click('[data-act="mehr-wahl"]'); await p.click('[data-act="mehr-alle"]'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => UI.mehrWahl.size === 4), '„Alle“ wählt alle in der Liste');
  await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => !UI.mehrWahl && !document.querySelector('[data-act="mehr-los"]')), 'Esc beendet die Auswahl');
  // Spendenübergabe in der Liste: Punkt je Förderer, der dabei sein soll; grün = kommt; Linie, wenn eingeladen oder kommt
  r = await p.evaluate(() => { const x = D.bedarfe.find(y => y.id === 'a'); x.foerderer.forEach(f => { f.status = 'zugesagt'; f.zugesagt = 500; });
    x.nach.ueb.mit = x.foerderer.map(f => f.id); x.nach.ueb.einl = { [x.foerderer[0].id]: { am: '2026-10-28', zu: 'ja' } }; changed(); renderNow();
    const tr = document.querySelector('#list-body tr[data-id="a"]'); return [[...tr.querySelectorAll('td.l-fin .ue-weg')].map(w => (w.classList.contains('an') ? 'linie' : '-') + '/' + (w.querySelector('.ue-pkt.ok') ? 'grün' : 'grau')).join(','), tr.querySelector('td.l-ueb').classList.contains('mit-pkt')]; });
  ok(r.join('|') === 'linie/grün,-/grau|true', 'Liste: Punkte für die Übergabe (grün mit Linie = kommt, grau = vorgesehen): ' + r.join('|'));
  await finish(b, [p]);
})();
