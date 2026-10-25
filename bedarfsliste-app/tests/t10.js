// Fachregeln (0.36): Fristen gebündelt oben, Archivieren ohne Offenes, kompakt mit Zusage, nur Eigenmittel ist nicht finanziert, Zusage ohne Betrag,
// Summe fehlt, „Diözese …“, Angebot nicht nötig, „Finanzierung steht“ überall gleich, Priorität zweistufig, „wie beantragt“
const { chromium, ok, open, finish, fs, T } = require('./lib');
(async () => {
  const b = await chromium.launch();
  fs.writeFileSync('vorschau.html', '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(T.PREVIEW, 'utf8') + '</body></html>');
  const p = await open(b, { file: process.cwd() + '/vorschau.html', fakefs: false });

  // 1. Fristen: gebündelt oben – überfällig rot, bald gelb; Verwendungsnachweis auch im Archiv; zurückgestellte Anträge nicht
  let r = await p.evaluate(() => {
    const tag = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const neu = (titel, o) => Object.assign(blank(), { titel, summe: 5000 }, o);
    D = normalize({ bedarfe: [
      neu('Funk', { id: 't1', foerderer: [ff({ name: 'Stiftung A', frist: tag(-3) }), ff({ name: 'Bank B', status: 'beantragt', erwartet: tag(5) })] }),
      neu('Alt', { id: 't2', archiv: true, foerderer: [ff({ name: 'Lotterie C', status: 'zugesagt', zugesagt: 5000, vn: { noetig: true, st: 'offen', frist: tag(2) } })] }),
      neu('Pause', { id: 't3', manuell: 'zurückgestellt', foerderer: [ff({ name: 'Stiftung D', frist: tag(1) })] }),
      neu('Später', { id: 't4', foerderer: [ff({ name: 'Stiftung E', frist: tag(40) })] }) ] });
    renderNow();
    const c = document.querySelector('#frist-chip');
    return [c.textContent, c.classList.contains('over'), fristenBald().map(x => x.b.id + ':' + x.t.split(' ')[0]).join(',')]; });
  ok(r[0] === '3 Fristen' && r[1] && r[2] === 't1:Antragsfrist,t2:Verwendungsnachweis,t1:Antwort', 'Fristen oben: 3 (eine überfällig → rot), Nachweis auch im Archiv, Zurückgestelltes und Späteres nicht: ' + r.join(' | '));
  await p.click('#frist-chip');
  r = await p.evaluate(() => [...document.querySelectorAll('.frist-pop .fp-h')].map(x => x.textContent).join('/') + ' | ' + [...document.querySelectorAll('.frist-pop .fp-row')].map(x => x.querySelector('.fp-r').textContent).join(','));
  ok(r === 'Überfällig/In den nächsten 14 Tagen | vor 3 Tagen,in 2 Tagen,in 5 Tagen', 'Liste der Fristen: überfällig und die nächsten 14 Tage: ' + r);
  await p.click('.frist-pop .fp-row:last-child');
  ok(await p.evaluate(() => UI.view === 'detail' && UI.id === 't1' && !document.querySelector('.frist-pop')), 'Klick auf eine Frist öffnet den Bedarf');
  r = await p.evaluate(() => { D.bedarfe.find(x => x.id === 't1').foerderer.forEach(f => { f.frist = ''; f.erwartet = ''; }); D.bedarfe.find(x => x.id === 't2').foerderer[0].vn.st = 'erledigt'; changed(); return document.querySelector('#frist-chip').hidden; });
  ok(r, 'nichts mehr fällig: kein Fristen-Feld');

  // 2. Archivieren ohne Offenes: keine Rückfrage
  await p.evaluate(() => { const x = D.bedarfe.find(y => y.id === 't4'); x.foerderer = []; UI.id = 't4'; UI.view = 'detail'; renderNow(); act('archive', document.body); });
  await p.waitForTimeout(200);
  r = await p.evaluate(() => [D.bedarfe.find(y => y.id === 't4').archiv, !!document.querySelector('.modal')]);
  ok(r.join('|') === 'true|false', 'nichts offen: direkt ins Archiv, ohne Rückfrage: ' + r.join('|'));

  // 4 + 5 + 8: Finanzierungsregeln
  r = await p.evaluate(() => {
    const x = Object.assign(blank(), { summe: 1000, eigenanteil: 1000 }); Object.values(x.freigabe).forEach(i => { i.st = 'ok'; }); angebotUL(x).st = 'da';
    const out = [phase(x).t];
    x.foerderer.push(ff({ name: 'A', status: 'abgelehnt', betrag: 500 })); out.push(phase(x).t, finStand(x), kFinanz(x).includes('nur Eigenmittel'));
    x.foerderer.push(ff({ name: 'B', status: 'zugesagt', betrag: 600, zugesagt: 600 })); x.eigenanteil = 400; out.push(finState(x).done);
    x.foerderer.push(ff({ name: 'C', status: 'beantragt', betrag: 300 })); const ph = phase(x); out.push(ph.t, ph.sub.includes('Antrag bei C'), foeKurz(x).includes('Finanzierung steht – Antrag bei C'), kFinanz(x).includes('Finanzierung steht'));
    return out; });
  ok(r.join('|') === 'Förderplan aufstellen|Förderer suchen|no|true|true|Finanzierung steht|true|true|true',
    'nur Eigenmittel: nicht finanziert („Förderer suchen“, kompakt „nur Eigenmittel“); mit Zusage gedeckt; offener Antrag: überall „Finanzierung steht – Antrag bei C noch offen“: ' + r.join('|'));
  r = await p.evaluate(() => { const x = Object.assign(blank(), { summe: 2000 }); x.foerderer.push(ff({ name: 'A', status: 'abgelehnt', betrag: 2000 }), ff({ name: 'B', status: 'abgelehnt', betrag: 500 })); return [finStand(x), kFinanz(x).includes('Lücke')]; });
  ok(r.join('|') === 'no|true', 'alle Förderer abgelehnt: kompakt rot „Lücke“ statt „in Bearbeitung“: ' + r.join('|'));
  r = await p.evaluate(() => { const x = Object.assign(blank(), { summe: null }); Object.values(x.freigabe).forEach(i => { i.st = 'ok'; }); angebotUL(x).st = 'da'; x.foerderer.push(ff({ name: 'A', status: 'zugesagt', betrag: 800, zugesagt: 800 }));
    const ph = phase(x), fr = frItems(Object.assign(blank(), { summe: null })).filter(i => i.k !== 'ofk').map(i => i.opt); return [ph.k, ph.t, finState(x).done, fr.join()]; });
  ok(r.join('|') === 'summe|Summe fehlt|false|true,true', 'ohne Summe: Hinweis „Summe fehlt“, nie fertig; Fachreferat und Verwaltung wie bisher nicht verlangt: ' + r.join('|'));
  r = await p.evaluate(() => { const x = Object.assign(blank(), { summe: 3000 }), f = ff({ name: 'Sachspende X', betrag: null }); x.foerderer.push(f); D.bedarfe.push(x);
    f.status = 'zugesagt'; effects(x, f, 'status', 'zugesagt', 'beantragt'); const t = $('#toasts').textContent; D.bedarfe.pop();
    return [t.includes('Zusage ohne Betrag'), foeWarnList(x, f).some(s => s.includes('Zusage ohne Betrag')), phase(x).warn.some(s => s.includes('Zusage ohne Betrag'))]; });
  ok(r.join() === 'true,true,true', 'Zusage ohne Betrag: Hinweis sofort, am Förderer (Dreieck) und im Stand: ' + r.join());

  // 6. „Diözese Paderborn“ zählt als Diözese
  r = await p.evaluate(() => ['Diözese Paderborn', 'Diözese ', 'diözese', 'Paderborn'].map(g => !!frItems(Object.assign(blank(), { gliederung: g })).find(i => i.k === 'ofk').na).join());
  ok(r === 'true,true,true,false', '„Diözese Paderborn“, „Diözese “ und „diözese“: Ortsführungskreis entfällt: ' + r);

  // 7. Angebot „nicht nötig“ erfüllt die Freigabe
  r = await p.evaluate(() => { const x = blank(); Object.values(x.freigabe).forEach(i => { i.st = 'ok'; }); x.summe = 5000; angebotUL(x).st = 'nn'; return [frOffen(x).names.join(), ulText(angebotUL(x)), normalize({ bedarfe: [x] }).bedarfe[0].unterlagen.find(u => u.name === 'Angebot').st]; });
  ok(r.join('|') === '|nicht nötig|nn', 'Angebot „nicht nötig“: Freigabe vollständig, bleibt beim Laden erhalten: ' + r.join('|'));

  // 3. kompakt: ohne vollständige Freigabe, aber mit Zusage → Finanzierung, Nachweis und Übergabe sichtbar
  r = await p.evaluate(() => { const x = Object.assign(blank(), { id: 'kz1', titel: 'Mit Zusage', summe: 4000 }); x.foerderer.push(ff({ name: 'Z', status: 'zugesagt', betrag: 4000, zugesagt: 4000 })); D.bedarfe.push(x);
    UI.view = 'list'; UI.tab = 'aktiv'; UI.ansicht = 'kompakt'; renderNow(); const c = [...document.querySelectorAll('#list-body tr[data-id="kz1"] td.k-nach')].map(t => t.textContent.trim()); UI.ansicht = 'voll'; renderNow(); return c; });
  ok(r.length === 3 && r[0] && !r[0].includes('Freigabe ausstehend') && r[1], 'kompakt: Freigabe fehlt, aber Zusage da – Finanzierung und Nachweis werden gezeigt: ' + r.join(' / '));

  // 8a. Finanzierung steht: geplante Förderer „nicht mehr nötig“, ohne Prozent
  r = await p.evaluate(() => { const x = D.bedarfe.find(y => y.id === 'kz1'); x.foerderer.push(ff({ name: 'Noch geplant', betrag: 1000 })); UI.view = 'detail'; UI.id = 'kz1'; renderNow();
    const tr = [...document.querySelectorAll('tr.r-weg')]; return [tr.length, tr[0] && tr[0].textContent.includes('nicht mehr nötig'), tr[0] && tr[0].lastElementChild.textContent.trim()]; });
  ok(r.join('|') === '1|true|', 'Finanzierung steht: geplanter Förderer „nicht mehr nötig“, ohne Prozent: ' + r.join('|'));

  // 12. leere „Zugesagte Summe“: wie beantragt
  r = await p.evaluate(() => { const x = D.bedarfe.find(y => y.id === 'kz1'), f = x.foerderer[0]; f.zugesagt = null; renderNow(); const i = document.getElementById('amt-' + f.id); return [i.value, i.placeholder]; });
  ok(r[0] === '' && r[1].startsWith('wie beantragt (4.000'), 'Zugesagte Summe leer: „wie beantragt (4.000)“ im Feld: ' + r.join(' | '));

  // 10. Priorität nur noch Prio oder keine
  r = await p.evaluate(() => normalize({ bedarfe: [{ titel: 'a', prio: 'niedrig' }, { titel: 'b', prio: 'hoch' }] }).bedarfe.map(x => x.prio).join());
  ok(r === 'mittel,hoch', 'Priorität „niedrig“ wird zu „keine Prio“: ' + r);

  await finish(b, [p]);
})();
