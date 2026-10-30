// 0.88: Fördererliste (Beta) – Verknüpfung mit den Bedarfen, Förderungen und Absagen aus den Bedarfen, roter Knopf „In Fördererliste übernehmen?“,
// neue Kontakte, Grund einer Absage, Frage beim Archivieren, Ansprache je Gliederung, Kartei-Ersatz, eigene Seite, Excel-Kopie im Ordner, Einlesen
const { chromium, ok, open, connect, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b);
  ok(await connect(p) === 'ok', 'Ordner verbunden');
  await p.evaluate(() => {
    const F = o => Object.assign(ff({}), o);
    D = normalize({ bedarfe: [
      Object.assign(blank(), { id: 'a', titel: 'Zelt Brakel', gliederung: 'Brakel', summe: 5000, foerderer: [
        F({ id: 'f1', name: 'Sparkasse Beispiel', status: 'zugesagt', zugesagt: 1000, eingegangen: 1000, eingangAm: '2026-05-02' }),
        F({ id: 'f2', name: 'Neue Stiftung X', status: 'zugesagt', zugesagt: 500, eingegangen: 500, eingangAm: '2026-05-10', kontakte: [{ n: 'Eva Neu', rolle: 'Vorstand', mail: 'eva@x.example', tel: '' }] }),
        F({ id: 'f3', name: 'Volksbank Test eG', status: 'abgelehnt', betrag: 800, entscheidungAm: '2026-04-01' })] }),
      Object.assign(blank(), { id: 'c', titel: 'AED Geseke', gliederung: 'Geseke', foerderer: [F({ id: 'f5', name: 'Sparkasse Beispiel', status: 'geplant', betrag: 900 })] })],
      fl: { liste: [
        { id: 'F001', name: 'Sparkasse Beispiel', art: 'Sparkasse', gl: ['Brakel', 'Geseke'], weg: ['direkt'], ansprache: [{ gl: 'Geseke', art: 'über die Gliederung', hinweis: 'Gliederung fragt selbst an' }],
          kontakte: [{ n: 'Erika B', pos: 'Filialleitung', mail: 'erika@spk.example', tel: '05272 1', gl: ['Brakel'], anschreiben: 'ja' }, { n: 'Hans V', pos: 'Vorstandsvorsitz', mail: 'hans@spk.example', anschreiben: 'nein' }],
          foerderungen: [{ jahr: '2024', betrag: 300, zweck: 'Helme', gl: ['Brakel'], quelle: 'Kartei' }] },
        { id: 'F002', name: 'Volksbank Test eG', art: 'Volks- und Raiffeisenbank', gl: ['Brakel'] },
        { id: '', name: 'Ohne ID', art: 'Quatsch', status: 'weg' }] } });
    flStart(); SAVED_JSON = JSON.stringify(D); undoReset(); renderNow();
  });
  // Daten und Verknüpfung
  let r = await p.evaluate(() => { const [a, c] = D.bedarfe; return [D.fl.liste.map(e => e.id + ':' + e.art + ':' + e.status).join(','), a.foerderer.map(f => f.flId || '-').join(','), c.foerderer[0].flId]; });
  ok(r.join('|') === 'F001:Sparkasse:aktiv,F002:Volks- und Raiffeisenbank:aktiv,F003:Quatsch:aktiv|F001,-,F002|F001', 'Laden: fehlende ID ergänzt, unbekannter Stand bereinigt, eigene Art bleibt; gleiche Namen verknüpft (auch in anderen Bedarfen): ' + r.join('|'));
  r = await p.evaluate(() => [flHistorie(flEintrag('F001')).map(x => [x.jahr, x.ergebnis, x.betrag, x.zweck, x.quelle, x.bedarfId || ''].join('/')).join(' ; '), flHistorie(flEintrag('F002')).map(x => x.ergebnis + '/' + x.zweck + '/' + x.bedarfId).join(),
    flLaufend(flEintrag('F001')).map(x => x.b.titel).join()]);
  ok(r[0] === '2026/gefördert/1000/Zelt Brakel/Bedarfsliste/a ; 2024/gefördert/300/Helme/Kartei/' && r[1] === 'abgelehnt/Zelt Brakel/a' && r[2] === 'AED Geseke',
    'Förderungen: aus dem Bedarf (Geldeingang) und aus der Kartei, Absage aus dem Bedarf, laufender Antrag: ' + r.join(' | '));
  // Ansprache je Gliederung → Hinweis am Förderer und oben bei den Infos
  r = await p.evaluate(() => { const c = D.bedarfe[1]; return [foeHinweise(c, c.foerderer[0]).map(x => x.k + ':' + x.t).join(), infosAlle().filter(x => x.z === 'ansprache').map(x => x.t).join()]; });
  ok(r[0] === 'ansprache:Laut Fördererliste für Geseke: über die Gliederung – Gliederung fragt selbst an' && r[1] === 'Sparkasse Beispiel – Geseke: über die Gliederung', 'Ansprache „über die Gliederung“ als Hinweis: ' + r.join(' | '));
  // statt Kartei-Excel: Vorschläge, Kontakte mit Position, „nicht anschreiben“ bleibt draußen; kein Kartei-Feld oben
  r = await p.evaluate(() => { const a = D.bedarfe[0], f = ff({ name: 'Sparkasse Beispiel' }); a.foerderer.push(f); karteiFuellen(a, f); a.foerderer.pop();
    return [f.kontakte.map(k => k.n + '/' + k.rolle).join(), f.flId, f.art, f.notiz.split('\n')[0], !document.querySelector('.kchip'), KR.list.length]; });
  ok(r.join('|') === 'Erika B/Filialleitung|F001|Sparkasse|Laut Fördererliste bisher gefördert:|true|3', 'Förderer anlegen: Angaben aus der Fördererliste (Position, ohne „nicht anschreiben“), verknüpft: ' + r.join('|'));

  // Seite des Bedarfs: Zeile „Fördererliste: …“, roter Knopf, Grund der Absage
  await p.evaluate(() => oeffnen('a', { offen: 'foe' })); await p.waitForTimeout(200);
  r = await p.evaluate(() => ['f1', 'f2', 'f3'].map(id => { const c = document.querySelector('#foe-' + id); return (c.querySelector('.fl-zeile') ? c.querySelector('.fl-zeile').textContent.trim() : '') + ' / ' + ((c.querySelector('.fl-grund-link') || {}).textContent || ''); }));
  ok(r[0].startsWith('Fördererliste: Sparkasse Beispiel') && r[1].startsWith('In Fördererliste übernehmen?') && r[2].startsWith('Fördererliste: Volksbank Test eG') && r[2].endsWith('→ Grund der Absage eintragen'),
    'Kacheln: verknüpft als Link, nach dem Geldeingang roter Knopf, bei der Absage „Grund eintragen“ statt Geldeingang: ' + r.join(' | '));
  r = await p.evaluate(() => infosAlle().filter(x => x.z === 'fl').map(x => x.t).join());
  ok(r === 'Neue Stiftung X – Geld da, in Fördererliste übernehmen?', 'Hinweis oben: Geld da, Förderer fehlt in der Liste: ' + r);
  await p.click('#foe-f3 .fl-grund-link'); await p.waitForSelector('.modal textarea');
  await p.fill('.modal textarea', 'Budget erschöpft'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [D.bedarfe[0].foerderer[2].grund, document.querySelector('#foe-f3 .fl-grund').textContent.trim(), flHistorie(flEintrag('F002'))[0].grund]);
  ok(r.join('|') === 'Budget erschöpft|Grund: Budget erschöpft|Budget erschöpft', 'Grund der Absage per Fenster, steht in der Kachel und in der Fördererliste: ' + r.join('|'));
  // Maske: neu anlegen (Name, Art geraten, Gliederung des Bedarfs, Kontakte zum Anhaken)
  await p.click('#foe-f2 .fl-rot'); await p.waitForSelector('.modal .fl-maske');
  r = await p.evaluate(() => { const m = document.querySelector('.modal'); return [m.querySelector('h2').textContent, m.querySelector('.fl-m-neu input').value, m.querySelector('.fl-m-neu select').value, m.querySelectorAll('.fl-m-neu input')[1].value,
    [...m.querySelectorAll('.fl-kw')].map(k => k.querySelector('b').textContent + ':' + k.querySelector('input').checked).join(), [...m.querySelectorAll('footer button')].map(x => x.textContent).join(',')]; });
  ok(r.join('|') === 'In die Fördererliste übernehmen|Neue Stiftung X|Stiftung|Brakel|Eva Neu:true|Nicht in die Liste,Abbrechen,Übernehmen', 'Maske vorbefüllt: ' + r.join('|'));
  await p.selectOption('.modal .fl-kw select', 'ja');
  await p.click('.modal footer button:text-is("Übernehmen")'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const e = D.fl.liste.find(x => x.name === 'Neue Stiftung X'); return [e.id, e.art, e.gl.join(), e.kontakte.map(k => k.n + '/' + k.pos + '/' + k.anschreiben + '/' + k.gl).join(), D.bedarfe[0].foerderer[1].flId,
    document.querySelector('#foe-f2 .fl-zeile').textContent.trim().startsWith('Fördererliste: Neue Stiftung X'), flHistorie(e).map(x => x.betrag + '/' + x.zweck).join()]; });
  ok(r.join('|') === 'F004|Stiftung|Brakel|Eva Neu/Vorstand/ja/Brakel|F004|true|500/Zelt Brakel', 'übernommen: neuer Eintrag mit Kontakt, verknüpft, Förderung steht von selbst drin: ' + r.join('|'));
  // neuer Kontakt bei einem verknüpften Förderer → „übernehmen?“; „Nicht übernehmen“ fragt nicht wieder
  await p.evaluate(() => { D.bedarfe[0].foerderer[0].kontakte.push({ n: 'Max Neu', rolle: 'Marktbereichsleitung', mail: '', tel: '' }); changed(); renderNow(); });
  r = await p.$eval('#foe-f1 .fl-rot', e => e.textContent);
  ok(r === 'Neuer Kontakt – übernehmen?', 'neuer Kontakt im Bedarf: roter Knopf ' + r);
  await p.click('#foe-f1 .fl-rot'); await p.waitForSelector('.modal .fl-kw');
  await p.click('.modal footer button:text-is("Nicht übernehmen")'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [D.bedarfe[0].foerderer[0].flAus.join(), !!document.querySelector('#foe-f1 .fl-rot'), flEintrag('F001').kontakte.length]);
  ok(r.join('|') === 'max neu|false|2', 'nicht übernommen: gemerkt, Knopf weg, Liste unverändert: ' + r.join('|'));
  // Archivieren: Geld eingegangen, Förderer fehlt in der Liste → nachfragen
  await p.evaluate(() => { D.bedarfe[0].foerderer.push(ff({ id: 'f4', name: 'Unbekannt GmbH', status: 'zugesagt', zugesagt: 200, eingegangen: 200, eingangAm: '2026-06-01' })); changed(); renderNow(); window.__r = 'warte'; flArchivPruefen(cur()).then(v => { window.__r = v; }); });
  await p.waitForSelector('.modal');
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, document.querySelector('.modal p').textContent, [...document.querySelectorAll('.modal footer button')].map(x => x.textContent).join(',')]);
  ok(r[0] === 'Noch nicht in der Fördererliste' && r[1].includes('„Unbekannt GmbH“') && r[2] === 'Abbrechen,Ohne übernehmen archivieren,Übernehmen …', 'Archivieren: Frage nach den fehlenden Förderern: ' + r.join(' | '));
  await p.click('.modal footer button:text-is("Ohne übernehmen archivieren")'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => window.__r) === true, '„Ohne übernehmen archivieren“ lässt archivieren');
  // „Nicht in die Liste“ und „Verknüpfung lösen“
  await p.click('#foe-f4 .fl-rot'); await p.waitForSelector('.modal .fl-maske'); await p.click('.modal footer button:text-is("Nicht in die Liste")'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [D.bedarfe[0].foerderer[3].flNein, !!document.querySelector('#foe-f4 .fl-rot'), infosAlle().filter(x => x.z === 'fl').length]);
  ok(r.join('|') === 'true|false|0', '„Nicht in die Liste“: kein Knopf, kein Hinweis mehr: ' + r.join('|'));
  await p.evaluate(() => document.querySelector('#foe-f3 .fl-mini').click()); await p.waitForTimeout(500);
  r = await p.evaluate(() => [D.bedarfe[0].foerderer[2].flId, D.bedarfe[0].foerderer[2].flNein, flHistorie(flEintrag('F002')).length]);
  ok(r.join('|') === '|true|0', 'Verknüpfung gelöst: bleibt gelöst (trotz gleichem Namen): ' + r.join('|'));

  // Kopie „Fördererliste.xlsx“ im Ordner nach dem Speichern; beim Einlesen zählen nur die eigenen Förderungen (die aus den Bedarfen liest das Programm selbst)
  await p.evaluate(() => { flEintrag('F001').bew.dauer = 2; saveAll({}); }); await p.waitForTimeout(2600);
  r = await p.evaluate(async () => { const f = __fs.files['/Ordner/Fördererliste.xlsx']; if (!f || !f.data.length) return ['fehlt'];
    const bk = await xlsxBook(f.data.buffer.slice(0)), R = flLesen(bk), fo = bk.sheets.find(s => s.name === 'Förderungen');
    return [bk.sheets.map(s => s.name).join('+'), R.liste.length, R.liste[0].foerderungen.length, fo.rows.length - 1, fo.rows.filter(x => x[9] === 'Bedarfsliste').map(x => x[10]).join(), R.liste.find(e => e.id === 'F004').kontakte[0].anschreiben, JSON.stringify(R.liste[0].bew), bk.sheets[0].rows[1][15]]; });
  ok(r.join('|') === 'Förderer+Ansprache+Kontakte+Förderungen+Anleitung|4|1|3|a,a|ja|{"chance":0,"dauer":2,"summe":0}|mittel', 'Excel-Kopie im Ordner: Blätter, Förderungen mit Bedarf-ID, Einlesen ohne doppelte: ' + r.join('|'));

  // eigene Seite: Liste, Suche, Filter, Seite eines Förderers, Bearbeiten, zurück
  await p.click('header.top [data-act="flist"]'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.querySelector('header.top .tab.on').textContent, document.querySelectorAll('#fl-body tr[data-id]').length, document.querySelector('#fl-count').textContent,
    [...document.querySelectorAll('#fl-body tr[data-id] .fl-n b')].map(x => x.textContent).join(',')]);
  ok(r.join('|') === 'FördererlisteBeta|4|4 von 4 Förderern|Neue Stiftung X,Ohne ID,Sparkasse Beispiel,Volksbank Test eG', 'Reiter „Fördererliste Beta“, alphabetisch: ' + r.join('|'));
  await p.fill('#flq', 'filial'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [...document.querySelectorAll('#fl-body tr[data-id]')].map(x => x.dataset.id).join());
  ok(r === 'F001', 'Suche findet auch Positionen der Kontakte: ' + r);
  await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  r = await p.evaluate(() => [UI.view, UI.flId, document.querySelector('.fl-name').value, document.querySelectorAll('.fl-foerd .fl-gl .fl-ge').length, document.querySelector('.fl-a select').value]);
  ok(r.join('|') === 'fdetail|F001|Sparkasse Beispiel|3|über die Gliederung', 'Enter in der Suche, Enter auf der Zeile: Seite des Förderers mit Förderungen und Ansprache: ' + r.join('|'));
  // Kontakte über den Stift bearbeiten (wie „Zuständig“ beim Bedarf); Fristen als formatierter Text (Klick, Strg+Enter übernimmt)
  await p.click('[data-act="fl-k-edit"]'); await p.fill('[data-fl="kontakte.0.pos"]', 'Filialdirektion'); await p.click('[data-act="fl-k-fertig"]'); await p.waitForTimeout(100);
  await p.click('.fl-steck .pe[data-k="fristen"]'); await p.keyboard.type('31.03.'); await p.keyboard.press('Control+Enter'); await p.waitForTimeout(100);
  await p.click('.fl-mehr-k'); await p.waitForTimeout(100);                     // Recherche-Stand steht unter „Weitere Angaben“
  await p.fill('[data-fl="recherche"]', '5.2.2026'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const e = flEintrag('F001'); return [e.kontakte[0].pos, e.fristen, e.recherche, document.querySelector('[data-fl="recherche"]').value]; });
  ok(r.join('|') === 'Filialdirektion|31.03.|2026-02-05|05.02.2026', 'Bearbeiten: Kontakt, Fristen (formatierter Text), Datum: ' + r.join('|'));
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => kartei('Sparkasse Beispiel').kontakte[0].pos) === 'Filialdirektion', 'Kartei für Vorschläge nachgeführt');
  // Einschätzung: aus den Daten geschätzt (Summe aus den Förderungen), von Hand gesetzt, noch einmal geklickt wieder geschätzt
  r = await p.evaluate(() => { const B = flBew(flEintrag('F001')); return [B.chance.v, B.summe.v, B.summe.hand, B.summe.grund.replace(/\s/g, ' '), B.dauer.v, [...document.querySelectorAll('.fn-griff')].map(g => g.dataset.k + ':' + g.getAttribute('class').replace('fn-griff ', '')).join(),
    [...document.querySelectorAll('.fn-v')].map(t => t.lastChild.textContent).join(' / '), [...document.querySelectorAll('.fn-s')].map(t => t.textContent).join('/')]; });
  ok(r.join('|') === '0|1|false|üblich rund 650 € (2 Förderungen)|2|chance:offen,dauer:hand,summe:auto|noch offen / 1–6 Monate / unter 5.000 €|//geschätzt',
    'Einschätzung: Summe geschätzt, Dauer von Hand, Chance offen; unter jeder Achse die Bedeutung: ' + r.join('|'));
  // Ecke ziehen: Erfolgschance ganz nach außen
  const ziel = async (k, st) => p.evaluate(([k, st]) => { const svg = document.querySelector('.fl-netz.zieh svg'), [x, y] = fnPt(FN_GROSS, k, FN_GROSS.R * st / 3), q = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return [q.x, q.y]; }, [k, st]);
  let [x0, y0] = await ziel('chance', 0.42); const [x1, y1] = await ziel('chance', 3);
  await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 5 });
  r = await p.evaluate(() => [document.querySelector('.fn-v[data-k="chance"]').textContent, flEintrag('F001').bew.chance]);
  ok(r.join('|') === 'sehr gut (über 75 %)|0', 'beim Ziehen: Vorschau mit Bedeutung, noch nicht übernommen: ' + r.join('|'));
  await p.mouse.up(); await p.waitForTimeout(150);
  r = await p.evaluate(() => [flEintrag('F001').bew.chance, document.querySelector('.fn-griff[data-k="chance"]').getAttribute('class'), document.activeElement.dataset.k]);
  ok(r.join('|') === '3|fn-griff hand|chance', 'losgelassen: Erfolgschance „sehr gut“ von Hand: ' + r.join('|'));
  // Doppelklick: wieder aus den Daten; Pfeiltaste: vom angezeigten Wert aus
  await p.dblclick('.fn-griff[data-k="dauer"]'); await p.waitForTimeout(100);
  await p.focus('.fn-griff[data-k="summe"]'); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const e = flEintrag('F001'); return [e.bew.dauer, e.bew.summe, document.querySelector('.fn-v[data-k="summe"]').textContent, mailRein('Max%20Muster%20%3cmax.muster@beispiel.example%3e'), mailRein('mailto:a@b.example?subject=Hallo')]; });
  ok(r.join('|') === '0|2|5.000–10.000 €|max.muster@beispiel.example|a@b.example', 'Doppelklick: wieder geschätzt; ↑ von „gering“ (geschätzt) auf „mittel“; E-Mail aus Excel-Links bereinigt: ' + r.join('|'));
  // Antragsweg als Schalter, „anschreiben“ per Klick, Fristen dieses Jahres aus dem Text
  ok(await p.evaluate(() => [[...document.querySelectorAll('.fl-weg-z .fl-seg button')].map(b => b.textContent).join('/'), document.querySelector('.fl-alt-weg').textContent].join('|')) === 'per E-Mail/Portal|bisher: direkt',
    'Antragsweg: nur per E-Mail oder Portal, „direkt“ aus der Kartei bleibt als Hinweis');
  await p.click('.fl-seg button[data-act="fl-antrag"][data-v="Portal"]'); await p.waitForTimeout(100);
  await p.click('[data-act="fl-k-an"][data-i="1"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const e = flEintrag('F001'); return [e.weg.join(), e.kontakte[1].anschreiben || 'leer', document.querySelector('[data-act="fl-k-an"][data-i="1"]').textContent.trim(), flFristenJahr('31.03. und 15.12., Förderung bis 5.000 €, alt: 1.1.2020', 2026).join()]; });
  ok(r.join('|') === 'Portal|leer|○|2026-03-31,2026-12-15', 'Antragsweg ein Schalter, anschreiben nein → offen, Fristen aus dem Text (Beträge und alte Jahre nicht): ' + r.join('|'));
  // Bedarf aus der Historie öffnen, zurück führt zum Förderer
  // Kennzahl im Kopf, Ansprache für die Gliederung aus dem Filter (änderbar), Steckbrief und Kontakte, Förderung von Hand mit Jahr oder Datum
  await p.evaluate(() => { UI.flGl = 'Geseke'; renderNow(); });
  r = await p.evaluate(() => [document.querySelector('.fl-kz-b').textContent.replace(/\s/g, ' '), document.querySelector('.fl-kz-t').textContent, document.querySelector('.fl-sub-gl').textContent,
    document.querySelector('.fl-ak-box').className, document.querySelector('.fl-ab-2').textContent.replace(/\s+/g, ' ').trim(), document.querySelector('.fl-ab-h').value]);
  ok(r.join('|') === '1.300 €|2 Förderungen seit 2024|gefiltert nach Gliederung Geseke|fl-ak-box gl|!Über die Gliederung▾|Gliederung fragt selbst an',
    'Kopf mit Kennzahl; Ansprache-Kasten für die gefilterte Gliederung: ' + r.join(' | '));
  await p.click('.fl-ab-2'); await p.click('.menu button:has-text("Nicht anschreiben")'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [flEintrag('F001').ansprache.map(a => a.gl + ':' + a.art).join(), document.querySelector('.fl-ak-box').className]);
  ok(r.join('|') === 'Geseke:nicht anschreiben|fl-ak-box nein', 'Ansprache im Kasten geändert: ' + r.join('|'));
  await p.click('.fl-ab-2'); await p.click('.menu button:has-text("Über die Gliederung")'); await p.evaluate(() => { UI.flGl = ''; renderNow(); });
  r = await p.evaluate(() => [[...document.querySelectorAll('.fl-sg .fl-sl')].map(x => x.textContent).join(','), !!document.querySelector('[data-fl="richtlinien"]'), document.querySelector('.fl-kopf .fl-kz') !== null,
    [...document.querySelectorAll('.fl-kliste .k1')].map(k => k.querySelector('.fl-st').textContent + k.querySelector('.kn').textContent + ':' + [...k.querySelectorAll('.kb')].map(b => b.dataset.tip).join('+')).join(' | '),
    document.querySelector('.fl-fn .fl-notizen h3').textContent]);
  ok(r.join('|') === 'Förderzweck,Fördergebiet,Förderhöhe,Antragsweg,Fristen|true|true|✓Erika B:erika@spk.example+05272 1 | ○Hans V:hans@spk.example|Notizen',
    'Steckbrief immer vollständig, Links immer da, Kontakte als Karten (✓/○/✕, Adresse und Nummer beim Überfahren), Notizen neben den Förderungen: ' + r.join('|'));
  await p.click('[data-act="fl-k-neu"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [UI.flKEdit, document.activeElement.dataset.fl, flEintrag('F001').kontakte.length]);
  await p.click('[data-act="fl-k-fertig"]'); await p.waitForTimeout(100);
  r.push(await p.evaluate(() => flEintrag('F001').kontakte.length));
  ok(r.join('|') === 'true|kontakte.2.n|3|2', '„+“: neuer Kontakt zum Ausfüllen; leer gelassen fällt er bei „Fertig“ weg: ' + r.join('|'));
  await p.click('[data-act="fl-g-neu"]'); await p.waitForTimeout(100);
  const gi = await p.evaluate(() => flEintrag('F001').foerderungen.length - 1);
  await p.fill(`[data-fl="foerderungen.${gi}.datum"]`, '12.04.2025'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  r = await p.evaluate(gi => { const g = flEintrag('F001').foerderungen[gi]; return [g.jahr, g.datum, g.quelle]; }, gi);
  ok(r.join('|') === '2025|2025-04-12|von Hand', 'Förderung von Hand: Datum setzt auch das Jahr: ' + r.join('|'));
  await p.evaluate(gi => { flEintrag('F001').foerderungen.splice(gi, 1); changed(); renderNow(); }, gi);
  await p.click('.fl-foerd .fl-bed[data-id="a"]'); await p.waitForTimeout(200);
  r = await p.evaluate(() => [UI.view, UI.id, document.querySelector('.subbar .back').textContent]);
  ok(r.join('|') === 'detail|a|‹ Sparkasse Beispiel', 'Klick auf den Bedarf öffnet ihn, „zurück“ heißt wie der Förderer: ' + r.join('|'));
  await p.click('.subbar .back'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => UI.view + '|' + UI.flId) === 'fdetail|F001', 'zurück auf der Seite des Förderers');
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => UI.view) === 'flist', 'Esc: zurück zur Fördererliste');
  // Einstieg über die Gliederung: Suche nach ihrem Namen oder Filter (zählt auch Förderer für alle); Spalten der Übersicht
  await p.fill('#flq', 'geseke'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => [...document.querySelectorAll('#fl-body tr[data-id]')].map(x => x.dataset.id).join()) === 'F001', 'Suche nach einer Gliederung findet ihre Förderer');
  await p.fill('#flq', ''); await p.evaluate(() => { flEintrag('F002').gl = ['alle']; }); await p.selectOption('select[data-ui="flGl"]', 'Brakel'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [[...document.querySelectorAll('#fl-body tr[data-id]')].map(x => x.dataset.id).join(), [...document.querySelectorAll('.fl-tab thead th')].map(t => t.textContent).join(','),
    document.querySelector('#fl-body tr[data-id="F001"] .fl-kn').textContent, document.querySelectorAll('#fl-body tr[data-id="F001"] .fl-fi').length, document.querySelector('#fl-body tr[data-id="F002"] .fl-g').textContent, !!document.querySelector('section.card.list-card #fl-body')]);
  ok(r[0] === 'F004,F001,F002' && r[1] === 'Förderer,Fördergebiet,Förderzweck,Fristen ' + new Date().getFullYear() + ',Einschätzung,Ansprechperson' && r[2] === 'Erika B' && r[3] === 2 && r[4] === 'alle Gliederungen' && r[5],
    'Filter Brakel (mit „alle“), Spalten, Ansprechperson mit Telefon und E-Mail, weißer Kasten: ' + r.join(' | '));
  await p.selectOption('select[data-ui="flGl"]', '');
  // Excel einlesen: ersetzt die Liste (nach Rückfrage); weggefallene Einträge verlieren ihre Verknüpfung
  const buf = await p.evaluate(async () => { const L = D.fl.liste; const alt = D.fl; D.fl = flNorm({ liste: JSON.parse(JSON.stringify(L.filter(e => e.id !== 'F004'))) }); D.fl.liste[0].notiz = 'neu eingelesen';
    const blob = flBlob(); D.fl = alt; return [...new Uint8Array(await blob.arrayBuffer())]; });
  await p.click('[data-act="fl-excel-menu"]');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.menu button:text-is("Excel einlesen … (ersetzt die Liste)")')]);
  await fc.setFiles({ name: 'Fördererliste.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(buf) });
  await p.waitForSelector('.modal h2:text-is("Fördererliste übernehmen?")');
  r = await p.$eval('.modal p', e => e.textContent);
  ok(r.startsWith('3 Förderer mit 2 Kontakten und 1 Förderung') && r.includes('ersetzt die bisherige Fördererliste (4 Förderer)'), 'Rückfrage vor dem Ersetzen: ' + r);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [D.fl.liste.length, D.fl.liste.find(e => e.id === 'F001').notiz, D.bedarfe[0].foerderer.map(f => f.flId || '-').join(), document.querySelectorAll('#fl-body tr[data-id]').length]);
  ok(r.join('|') === '3|neu eingelesen|F001,-,-,-|3', 'eingelesen: Liste ersetzt, Verknüpfungen bleiben bei gleicher ID: ' + r.join('|'));
  // Förderer löschen: Verknüpfung in den Bedarfen fällt weg
  await p.evaluate(() => flOeffnen('F001')); await p.waitForTimeout(150);
  await p.click('[data-act="fl-menue"]'); await p.click('.fl-menue [data-act="fl-weg"]'); await p.waitForSelector('.modal'); await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [UI.view, D.fl.liste.map(e => e.id).join(), D.bedarfe.flatMap(b => b.foerderer.map(f => f.flId || '-')).join()]);
  ok(r.join('|') === 'flist|F002,F003|-,-,-,-,-', 'gelöscht, Verknüpfungen gelöst: ' + r.join('|'));
  // gespeichert und wieder geladen: bleibt erhalten
  r = await p.evaluate(() => { const n = normalize(JSON.parse(JSON.stringify(D))); return [n.fl.liste.length, JSON.stringify(n.fl) === JSON.stringify(D.fl), n.bedarfe[0].foerderer[1].flAus.length, n.bedarfe[0].foerderer[3].flNein]; });
  ok(r.join('|') === '2|true|0|true', 'Speichern/Laden behält Fördererliste und Merker: ' + r.join('|'));
  await finish(b, [p]);
})();
