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
  ok(r[0] === 'ansprache:Laut Fördererliste für Geseke: Über die Gliederung – Gliederung fragt selbst an' && r[1] === 'Sparkasse Beispiel – Geseke: Über die Gliederung', 'Hinweis der Fördererliste („über die Gliederung“ aus der alten Form) am Förderer und bei den Infos: ' + r.join(' | '));
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
  ok(r.join('|') === 'Förderer+Ansprache+Kontakte+Förderungen+Fristen+Fördertöpfe+Beispiele+Anleitung|4|1|3|a,a|ja|{"chance":0,"summe":0,"haeufig":0,"aufwand":0,"dauer":2}|mittel', 'Excel-Kopie im Ordner: Blätter, Förderungen mit Bedarf-ID, Einlesen ohne doppelte: ' + r.join('|'));

  // eigene Seite: Liste, Suche, Filter, Seite eines Förderers, Bearbeiten, zurück
  await p.click('header.top [data-act="flist"]'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.querySelector('header.top .tab.on').textContent, document.querySelectorAll('#fl-body tr[data-id]').length, document.querySelector('#fl-count').textContent,
    [...document.querySelectorAll('#fl-body tr[data-id] .fl-n b')].map(x => x.textContent).join(',')]);
  ok(r.join('|') === 'FördererlisteBeta|4|4 von 4 Förderern|Neue Stiftung X,Ohne ID,Sparkasse Beispiel,Volksbank Test eG', 'Reiter „Fördererliste Beta“, alphabetisch: ' + r.join('|'));
  await p.fill('#flq', 'filial'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [...document.querySelectorAll('#fl-body tr[data-id]')].map(x => x.dataset.id).join());
  ok(r === 'F001', 'Suche findet auch Positionen der Kontakte: ' + r);
  await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  r = await p.evaluate(() => [UI.view, UI.flId, document.querySelector('.fl-name').value, document.querySelectorAll('.fl-foerd .fl-gl .fl-ge').length, document.querySelector('.fl-ak-box .fl-ab-t').value]);
  ok(r.join('|') === 'fdetail|F001|Sparkasse Beispiel|3|Über die Gliederung', 'Enter in der Suche, Enter auf der Zeile: Seite des Förderers mit Förderungen und Hinweis: ' + r.join('|'));
  // Kontakte über den Stift bearbeiten (wie „Zuständig“ beim Bedarf); Fristen als formatierter Text (Klick, Strg+Enter übernimmt)
  await p.click('[data-act="fl-k-edit"]'); await p.fill('[data-fl="kontakte.0.pos"]', 'Filialdirektion'); await p.click('[data-act="fl-k-fertig"]'); await p.waitForTimeout(100);
  await p.click('.fl-steck .pe[data-k="fristen"]'); await p.keyboard.type('31.03.'); await p.keyboard.press('Control+Enter'); await p.waitForTimeout(100);
  await p.click('.fl-seite .pe[data-k="recherche"]'); await p.waitForSelector('.cal-pop');                // Recherchestand unten im rechten Kasten, per Kalender
  await p.evaluate(() => document.querySelector('.cal-pop .cal-d[data-v$="-05"]').click()); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /^\d{4}-\d{2}-05$/.test(flEintrag('F001').recherche)), 'Recherchestand per Kalender gesetzt');
  await p.evaluate(() => { const e = flEintrag('F001'); e.recherche = '2026-02-05'; changed(); renderNow(); });
  r = await p.evaluate(() => { const e = flEintrag('F001'); return [e.kontakte[0].pos, e.fristen, e.recherche, document.querySelector('.fl-seite .pe[data-k="recherche"] .pv').textContent, !document.querySelector('.fl-mehr'), !!document.querySelector('.fl-seite .fl-blk:last-child .pe[data-k="recherche"]'), !!document.querySelector('.fl-seite .fl-url[data-fl="web"]')]; });
  ok(r.join('|') === 'Filialdirektion|31.03.|2026-02-05|05.02.2026|true|true|true', 'Bearbeiten: Kontakt, Fristen (Hinweistext), Recherchestand unten im rechten Kasten (Kalender), keine „Weitere Angaben“, Homepage rechts: ' + r.join('|'));
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => kartei('Sparkasse Beispiel').kontakte[0].pos) === 'Filialdirektion', 'Kartei für Vorschläge nachgeführt');
  // Einschätzung: aus den Daten geschätzt (Summe aus den Förderungen), von Hand gesetzt, noch einmal geklickt wieder geschätzt
  r = await p.evaluate(() => { const B = flBew(flEintrag('F001')); return [B.chance.v, B.summe.v, B.summe.hand, B.summe.grund.replace(/\s/g, ' '), B.dauer.v, [...document.querySelectorAll('.fn-griff')].map(g => g.dataset.k + ':' + g.getAttribute('class').replace('fn-griff ', '')).join(),
    [...document.querySelectorAll('.fn-v')].map(t => t.lastChild.textContent).join(' / '), [...document.querySelectorAll('.fn-s')].map(t => t.textContent).join('/')]; });
  ok(r.join('|') === '0|1|false|üblich rund 650 € (2 Förderungen)|2|chance:offen,summe:auto,haeufig:auto,aufwand:offen,dauer:hand|noch offen / bis 1.000 € / alle paar Jahre / noch offen / 2–6 Monate|/geschätzt/geschätzt//',
    'Einschätzung (Fünfeck): Summe und Häufigkeit geschätzt, Dauer von Hand, Chance und Aufwand offen; unter jeder Achse die Bedeutung: ' + r.join('|'));
  // Ecke ziehen: Erfolgschance ganz nach außen
  const ziel = async (k, st) => p.evaluate(([k, st]) => { const svg = document.querySelector('.fl-netz.zieh svg'), [x, y] = fnPt(FN_GROSS, k, FN_GROSS.R * st / 3), q = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return [q.x, q.y]; }, [k, st]);
  let [x0, y0] = await ziel('chance', 0.42); const [x1, y1] = await ziel('chance', 3);
  await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 5 });
  r = await p.evaluate(() => [document.querySelector('.fn-v[data-k="chance"]').textContent, flEintrag('F001').bew.chance]);
  ok(r.join('|') === 'hoch|0', 'beim Ziehen: Vorschau mit Bedeutung, noch nicht übernommen: ' + r.join('|'));
  await p.mouse.up(); await p.waitForTimeout(150);
  r = await p.evaluate(() => [flEintrag('F001').bew.chance, document.querySelector('.fn-griff[data-k="chance"]').getAttribute('class'), document.activeElement.dataset.k]);
  ok(r.join('|') === '3|fn-griff hand|chance', 'losgelassen: Erfolgschance „sehr gut“ von Hand: ' + r.join('|'));
  // Doppelklick: wieder aus den Daten; Pfeiltaste: vom angezeigten Wert aus
  await p.dblclick('.fn-griff[data-k="dauer"]'); await p.waitForTimeout(100);
  await p.focus('.fn-griff[data-k="summe"]'); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const e = flEintrag('F001'); return [e.bew.dauer, e.bew.summe, document.querySelector('.fn-v[data-k="summe"]').textContent, mailRein('Max%20Muster%20%3cmax.muster@beispiel.example%3e'), mailRein('mailto:a@b.example?subject=Hallo')]; });
  r.push(await p.evaluate(() => { const e = flEintrag('F001'), alt = e.foerderungen, S = b => { e.foerderungen = [b, b, b].map(x => Object.assign(flFoerderungLeer(), { jahr: '2020', betrag: x })); return flBewAuto(e).summe.v; }; const X = [S(1000), S(1001), S(3000), S(3001)].join(); e.foerderungen = alt; return X; }));
  ok(r.join('|') === '0|2|1.000–3.000 €|max.muster@beispiel.example|a@b.example|1,2,2,3', 'Doppelklick: wieder geschätzt; Fördersumme bis 1.000 / bis 3.000 / darüber; ↑ von „gering“ (geschätzt) auf „mittel“; E-Mail aus Excel-Links bereinigt: ' + r.join('|'));
  // Häufigkeit aus den Jahren der Förderungen; Aufwand nur von Hand – beide in der Excel-Kopie und wieder eingelesen
  r = await p.evaluate(async () => { const e = flEintrag('F001'), alt = e.foerderungen, H = js => { e.foerderungen = js.map(j => Object.assign(flFoerderungLeer(), { jahr: String(j), betrag: 100 })); const a = flBewAuto(e).haeufig; return a ? a.v + ':' + a.grund : '-'; };
    const X = [H([]), H([2020]), H([2025]), H([2024, 2024, 2021])].join(' / '); e.foerderungen = alt; e.bew.aufwand = 1;   // H: dazu kommt die Förderung 2026 aus dem Bedarf
    const R = flLesen(await xlsxBook(await flBlob().arrayBuffer())), x = R.liste.find(f => f.id === 'F001'); e.bew.aufwand = 0;
    return [X, 'aufwand' in flBewAuto(e), x.bew.aufwand, x.bew.dauer, flExportZeilen()['Förderer'][0].length]; });
  ok(r.join('|') === '- / 1:gefördert 2020, 2026 / 2:gefördert 2025 und 2026 / 3:2 Förderungen in 2024|false|1|0|25', 'Häufigkeit geschätzt (eine Förderung sagt nichts), Aufwand nicht; beide in der Excel-Kopie: ' + r.join('|'));
  // Antragsweg als Schalter, „nicht anschreiben“ blass ohne Stern, Fristen als Knöpfe je Fördertopf
  ok(await p.evaluate(() => [[...document.querySelectorAll('.fl-weg-sel option')].map(b => b.textContent + (b.selected ? '*' : '')).join('/'), flEintrag('F001').weg.join(), flWegNorm('direkt'), flWegNorm('per Mail'), flWegNorm('Portal'), flWegNorm('vor Ort') || '-', !!document.querySelector('.fl-alt-weg')].join('|')) === '–/E-Mail*/Portal|E-Mail|E-Mail|E-Mail|Portal|-|false',
    'Antragsweg: nur E-Mail oder Portal, „direkt“ aus der alten Kartei wird zu E-Mail');
  await p.selectOption('.fl-weg-sel', 'Portal'); await p.waitForTimeout(100);
  await p.fill('.fl-antrag', 'portal.spk.example/antrag'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [flEintrag('F001').antrag, document.querySelector('.fl-blk-k .fl-oeffnen').getAttribute('href'), document.querySelector('.fl-antrag').placeholder, document.querySelector('.fl-antrag').value, document.querySelectorAll('.fl-weg-z > *').length, Math.abs(document.querySelector('.fl-weg-sel').getBoundingClientRect().top - document.querySelector('.fl-antrag').getBoundingClientRect().top) < 12, document.querySelector('.fl-blk-k .fl-oeffnen').closest('.fl-blk').querySelector('h3').textContent]);
  ok(r.join('|') === 'https://portal.spk.example/antrag|https://portal.spk.example/antrag|Link zum Portal …|portal.spk.example/antrag|2|true|Antragsweg', 'Antragsweg: Dropdown und Link ohne „https://“ (wird ergänzt) in einer Zeile, der Öffnen-Knopf hinter der Überschrift: ' + r.join('|'));
  r = await p.evaluate(() => { const k = document.querySelectorAll('.fl-kliste .k1')[1]; return [k.className, k.dataset.tip, !!k.querySelector('[data-act="fl-k-an"]'), k.querySelector('.kb').className, k.querySelector('.kb').tagName, !!document.querySelector('.fl-k-legende, .fl-legende')]; });
  ok(r.join('|') === 'k1 fl-k1 an-nein|nicht anschreiben|false|kb kb-aus|SPAN|false', '„nicht anschreiben“: Karte blass mit Hinweis beim Überfahren, kein Stern, E-Mail durchgestrichen, keine Legende: ' + r.join('|'));
  await p.click('[data-act="fl-k-edit"]'); await p.click('[data-act="fl-k-an-setzen"][data-i="1"][data-v=""]'); await p.click('[data-act="fl-k-fertig"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const e = flEintrag('F001'); return [e.weg.join(), e.kontakte[1].anschreiben || 'leer', document.querySelector('[data-act="fl-k-an"][data-i="1"]').textContent.trim(), flFristenJahr('31.03. und 15.12., Förderung bis 5.000 €, alt: 1.1.2020', 2026).join()]; });
  ok(r.join('|') === 'Portal|leer|☆|2026-03-31,2026-12-15', 'Antragsweg ein Schalter, anschreiben nein → offen (im Bearbeiten), Fristen aus dem Text (Beträge und alte Jahre nicht): ' + r.join('|'));
  // Fristen: „+ Frist“ mit Fördertopf, jedes Jahr oder einmalig; Klick auf einen Knopf ändert oder entfernt
  r = await p.evaluate(() => { const e = flEintrag('F001'); e.fristenL = []; changed(); renderNow(); return [fristParse('5.3.'), fristParse('31.03.2027'), fristParse('31.2.'), fristenAusText('31.03. und 30.09.').L.map(x => x.d).join(), fristenAusText('31.03. und 30.09.').text, fristenAusText('bis 15.10., Sitzung im Mai').text]; });
  ok(r.join('|') === '03-05|2027-03-31||03-31,09-30||bis 15.10., Sitzung im Mai', 'Frist lesen: jedes Jahr, einmalig, ungültig; aus dem alten Text, der Rest bleibt als Hinweis: ' + r.join('|'));
  const jahr = new Date().getFullYear();
  await p.click('.fl-frist-neu'); await p.fill('.fl-frist-pop input[type=date]', jahr + '-01-01'); await p.fill('.fl-frist-pop input[type=text]', 'Programm A'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  await p.click('.fl-frist-neu'); await p.fill('.fl-frist-pop input[type=date]', jahr + '-12-31'); await p.click('.fl-frist-pop button.primary'); await p.waitForTimeout(100);
  await p.click('.fl-frist-neu'); await p.fill('.fl-frist-pop input[type=date]', (jahr + 1) + '-06-15'); await p.click('.fl-frist-pop .fl-jj input'); await p.fill('.fl-frist-pop input[type=text]', 'Programm A'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [flEintrag('F001').fristenL.map(f => f.d + '/' + f.topf).join(), [...document.querySelectorAll('.fl-frg')].map(g => (g.querySelector('.fl-topf')?.textContent || '-') + ':' + [...g.querySelectorAll('.fl-fd')].map(b => b.textContent + '=' + b.className.replace('fl-fd ', '')).join(' ')).join(' | '), document.querySelector('.fl-sg').textContent.includes('Fristen ' + new Date().getFullYear())]);
  ok(r.join('|') === `01-01/Programm A,12-31/,${jahr + 1}-06-15/Programm A|-:31.12.=naechste | Programm A:01.01.=vorbei 15.06.${jahr + 1}=naechste|true`, 'Fristen je Fördertopf: vorbei, nächste, einmalig mit Jahr: ' + r.join('|'));
  await p.click('.fl-fd.vorbei'); await p.waitForSelector('.fl-frist-pop'); await p.click('.fl-frist-pop button:text-is("Entfernen")'); await p.waitForTimeout(100);
  r = await p.evaluate(() => flEintrag('F001').fristenL.map(f => f.d).join());
  ok(r === `12-31,${jahr + 1}-06-15`, 'Frist entfernt: ' + r);
  r = await p.evaluate(async () => { flEintrag('F001').fristenL[0].topf = 'Programm B'; const bk = await xlsxBook(await flBlob().arrayBuffer()), R = flLesen(bk);
    return [bk.sheets.find(s => s.name === 'Fristen').rows.length - 1, R.liste.find(e => e.id === 'F001').fristenL.map(f => f.d + '/' + f.topf).join()]; });
  ok(r.join('|') === `2|12-31/Programm B,${jahr + 1}-06-15/Programm A`, 'Fristen in der Excel-Kopie (eigenes Blatt) und wieder eingelesen: ' + r.join('|'));
  // Bedarf aus der Historie öffnen, zurück führt zum Förderer
  // Kennzahl im Kopf, Ansprache für die Gliederung aus dem Filter (änderbar), Steckbrief und Kontakte, Förderung von Hand mit Jahr oder Datum
  await p.evaluate(() => { UI.flGl = 'Geseke'; renderNow(); });
  r = await p.evaluate(() => [document.querySelector('.fl-kz-b').textContent.replace(/\s/g, ' '), document.querySelector('.fl-kz-t').textContent, document.querySelector('.fl-sub-gl').textContent,
    document.querySelector('.fl-ak-box').className, document.querySelector('.fl-ab-k').placeholder, document.querySelector('.fl-ab-t').value, document.querySelector('.fl-ab-h .pv').textContent, document.querySelectorAll('.fl-ak-box').length]);
  ok(r.join('|') === '1.300 €|2 Förderungen seit 2024|gefiltert nach Gliederung Geseke|fl-ak-box gl|Ansprache · Geseke|Über die Gliederung|Gliederung fragt selbst an|1',
    'Kopf mit Kennzahl; gelber Hinweis für die gefilterte Gliederung (Kopfzeile, Überschrift, Text): ' + r.join(' | '));
  await p.fill('.fl-ab-t', 'Erst Herrn B. fragen'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const c = D.bedarfe[1]; return [flEintrag('F001').ansprache[0].titel, foeHinweise(c, c.foerderer[0]).map(x => x.t).join()]; });
  ok(r.join('|') === 'Erst Herrn B. fragen|Laut Fördererliste für Geseke: Erst Herrn B. fragen – Gliederung fragt selbst an', 'Ansprache: eigene Überschrift, auch im Hinweis am Bedarf: ' + r.join('|'));
  await p.click('.fl-ab-kr'); await p.click('.menu button:has-text("Nicht anschreiben")'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [flEintrag('F001').ansprache.map(a => a.gl + ':' + a.art).join(), document.querySelector('.fl-ak-box').className]);
  ok(r.join('|') === 'Geseke:nicht anschreiben|fl-ak-box nein', 'Hinweis rot (nicht anschreiben): ' + r.join('|'));
  await p.click('.fl-ab-kr'); await p.click('.menu button:has-text("Hinweis (gelb)")'); await p.evaluate(() => { UI.flGl = 'Brakel'; renderNow(); });
  // gefiltert nach Brakel: kein Hinweis für Brakel – nur „+ Hinweis hinzufügen“; ein neuer gilt gleich für Brakel
  r = await p.evaluate(() => [document.querySelectorAll('.fl-ak-box').length, document.querySelector('[data-act="fl-alle-gl"]').textContent.trim()]);
  ok(r.join('|') === '0|▸ 1 Hinweis für andere Gliederungen', 'kein grüner Kasten: ohne Hinweis für die Gliederung steht dort nichts: ' + r.join('|'));
  await p.click('.fl-hinweis-neu'); await p.keyboard.type('Erst Frau B. fragen'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [JSON.stringify(flEintrag('F001').ansprache[1]), document.querySelectorAll('.fl-ak-box').length]);
  ok(r.join('|') === '{"gl":"Brakel","art":"hinweis","kopf":"","titel":"Erst Frau B. fragen","hinweis":""}|1', '„+ Hinweis hinzufügen“: gelber Kasten mit freier Überschrift, gilt für Brakel: ' + r.join('|'));
  await p.evaluate(() => { flEintrag('F001').ansprache.splice(1, 1); UI.flGl = ''; changed(); renderNow(); });
  r = await p.evaluate(() => [[...document.querySelectorAll('.fl-sg .fl-sl')].map(x => x.textContent).join(','), !!document.querySelector('[data-fl="richtlinien"]'), document.querySelector('.fl-kopf .fl-kz') !== null,
    [...document.querySelectorAll('.fl-kliste .k1')].map(k => k.querySelector('.fl-st').textContent + k.querySelector('.kn').textContent + ':' + [...k.querySelectorAll('.kb')].map(b => b.dataset.tip).join('+')).join(' | '),
    document.querySelector('.fl-fn .fl-notizen h3').textContent]);
  ok(r.join('|') === `Zweck,Gebiet,Förderhöhe,Quote,Fristen ${jahr}|true|true|★Erika B:erika@spk.example+05272 1 | ☆Hans V:hans@spk.example|Notizen`,
    'Steckbrief immer vollständig (Zweck, Gebiet, Förderhöhe, Quote, Fristen), Links immer da, Kontakte als Karten (★/☆, Adresse und Nummer beim Überfahren), Notizen neben den Förderungen: ' + r.join('|'));
  await p.click('[data-act="fl-k-neu"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [UI.flKEdit, document.activeElement.dataset.fl, flEintrag('F001').kontakte.length]);
  await p.click('[data-act="fl-k-fertig"]'); await p.waitForTimeout(100);
  r.push(await p.evaluate(() => flEintrag('F001').kontakte.length));
  ok(r.join('|') === 'true|kontakte.2.n|3|2', '„+“: neuer Kontakt zum Ausfüllen; leer gelassen fällt er bei „Fertig“ weg: ' + r.join('|'));
  // gefiltert nach Brakel: auf Förderer-Ebene stehen alle Personen, nur nach ★ sortiert – nichts wird ausgegraut
  await p.evaluate(() => { flEintrag('F001').kontakte[1].gl = ['Geseke']; UI.flGl = 'Brakel'; renderNow(); });
  r = await p.evaluate(() => [...document.querySelectorAll('.fl-kliste .k1')].map(k => k.querySelector('.kn').textContent + (k.classList.contains('fremd') ? ' (blass)' : '')).join(', '));
  ok(r === 'Erika B, Hans V', 'Filter Brakel: alle Personen, keine blass: ' + r);
  await p.evaluate(() => { flEintrag('F001').kontakte[1].gl = []; UI.flGl = ''; renderNow(); });
  // laufender Bedarf: Kontakte kommen aus der Fördererliste (für seine Gliederung, ohne „nicht anschreiben“); archiviert: der damalige Stand
  r = await p.evaluate(() => { const a = D.bedarfe[0], f = a.foerderer[0], e = flEintrag('F001'); e.kontakte[0].tel = '05272 999'; const live = foeKontakte(a, f).map(k => k.n + '/' + k.tel).join(',');
    a.archiv = true; const alt = foeKontakte(a, f).map(k => k.n).join(','); a.archiv = false; return [live, alt, fussKontakt(f, a).includes('05272 999')]; });
  ok(r.join('|') === 'Erika B/05272 999,Hans V/,Max Neu/|Max Neu|true', 'Kontakte im Bedarf: laufend aus der Fördererliste (dazu die nur im Bedarf), archiviert die Kopie: ' + r.join('|'));
  // umbenannt in der Fördererliste: Kopien in laufenden Bedarfen ziehen mit; dieselbe Person bei einem anderen Förderer: bei „Fertig“ fragen
  await p.evaluate(() => { D.bedarfe[0].foerderer[0].kontakte.push(Object.assign(leerK(), { n: 'Erika B' })); flEintrag('F002').kontakte.push(Object.assign(flKontaktLeer(), { n: 'Erika B', mail: 'alt@spk.example' })); renderNow(); });
  await p.click('[data-act="fl-k-edit"]'); await p.fill('[data-fl="kontakte.0.n"]', 'Erika Brandt'); await p.fill('[data-fl="kontakte.0.mail"]', 'neu@spk.example');
  r = await p.evaluate(() => [D.bedarfe[0].foerderer[0].kontakte.map(k => k.n).join(','), document.querySelector('.fl-auch') ? document.querySelector('.fl-auch').textContent.slice(0, 32) : '']);
  ok(r.join('|') === 'Max Neu,Erika Brandt|steht auch bei Volksbank Test eG', 'Umbenennen zieht die Kopie im Bedarf mit; Hinweis „steht auch bei“: ' + r.join('|'));
  await p.evaluate(() => { flEintrag('F002').kontakte[0].n = 'Erika Brandt'; });
  await p.click('[data-act="fl-k-fertig"]'); await p.waitForSelector('.modal');
  r = await p.$eval('.modal h2', x => x.textContent);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  r = [r, await p.evaluate(() => flEintrag('F002').kontakte[0].mail)];
  ok(r.join('|') === 'Auch bei anderen Förderern ändern?|neu@spk.example', 'gleiche Person bei anderem Förderer: E-Mail auf Wunsch mitgeändert: ' + r.join('|'));
  await p.evaluate(() => { const e = flEintrag('F001'); e.kontakte[0].n = 'Erika B'; flEintrag('F002').kontakte = []; D.bedarfe[0].foerderer[0].kontakte = D.bedarfe[0].foerderer[0].kontakte.filter(k => k.n !== 'Erika Brandt'); changed(); renderNow(); });
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
  // 0.98: Kurzname (⋯-Menü), „+ Förderer“ oben rechts, Förderquote, Fördertöpfe im Steckbrief
  await p.evaluate(() => { UI.flGl = ''; UI.flq = ''; flOeffnen('F002'); }); await p.waitForTimeout(300);
  await p.click('.fl-punkte'); await p.fill('.fl-menue [data-fl="kurz"]', 'DSE'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  r = await p.evaluate(() => { const e = flEintrag('F002'), f = D.bedarfe[0].foerderer[0], alt = f.name; f.name = 'DSE'; const v = flVon(f); f.name = alt;
    return [e.kurz, document.querySelector('.fl-kopf-u').textContent.trim().split(' · ')[0], flVonName('DSE') === e, flVonName(e.name) === e, kartei('DSE') && kartei('DSE').flId, SRC.foe().includes('DSE') && SRC.foe().includes(e.name), v === e, foeKey('DSE') === foeKey(e.name)]; });
  ok(r.join('|') === 'DSE|DSE|true|true|F002|true|true|true', 'Kurzname: im Kopf, Bedarf findet den Förderer mit Kurzname und vollem Namen, Vorschläge mit beiden: ' + r.join('|'));
  await p.keyboard.press('Escape'); await p.evaluate(() => { closeMenus(); flZurueck(); }); await p.waitForTimeout(200);
  r = await p.evaluate(() => [document.querySelector('#fl-body tr[data-id="F002"] .fl-kurz').textContent, document.querySelector('.top .actions .primary').textContent, document.querySelectorAll('.top .actions [data-act="new"]').length, document.querySelectorAll('.fl-head [data-act="fl-neu-leer"]').length]);
  ok(r.join('|') === '(DSE)|+ Förderer|0|0', 'Liste: Kurzname in Klammern unter dem Namen; oben rechts „+ Förderer“ statt „+ Bedarf“: ' + r.join('|'));
  const nF = await p.evaluate(() => D.fl.liste.length);
  await p.click('.top .actions [data-act="fl-neu-leer"]'); await p.waitForTimeout(300);
  r = await p.evaluate(() => [UI.view, D.fl.liste.length, document.activeElement.className.includes('fl-name'), document.querySelector('.top .actions .primary').textContent]);
  ok(r.join('|') === 'fdetail|' + (nF + 1) + '|true|+ Förderer', '„+ Förderer“: leere Seite zum Ausfüllen: ' + r.join('|'));
  await p.click('[data-act="fl-zurueck"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => D.fl.liste.length) === nF, 'unberührte neue Seite verschwindet beim Verlassen wieder');
  await p.evaluate(() => flOeffnen('F002')); await p.waitForTimeout(300);
  await p.click('.fl-steck .pe[data-k="quote"]'); await p.keyboard.type('bis 90 % der Kosten'); await p.keyboard.press('Control+Enter'); await p.waitForTimeout(100);
  await p.click('[data-act="fl-topf-neu"]'); await p.keyboard.type('Programm Jugend'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  await p.click('.fl-steck .fl-zweck'); await p.waitForSelector('.fl-zweck-pop'); await p.keyboard.type('Jugendarbeit'); await p.click('.fl-zweck-pop label:has-text("Jugendhilfe") input'); await p.click('.fl-zweck-pop label:has-text("Gesundheit") input'); await p.mouse.click(20, 30); await p.waitForTimeout(150);   // Klick daneben übernimmt
  await p.click('.fl-frist-neu'); r = await p.evaluate(() => document.querySelector('.fl-frist-pop input[aria-label="Fördertopf"]').value);
  await p.fill('.fl-frist-pop input[type=date]', jahr + '-12-01'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(r0 => { const e = flEintrag('F002'); return [r0, e.quote, e.topfe.length, e.topfe[0].name, e.topfe[0].schwer, e.schwer !== e.topfe[0].schwer, e.fristenL.filter(f => f.topf === 'Programm Jugend').map(f => f.d).join(), UI.flTopf === e.topfe[0].id,
    [...document.querySelectorAll('.fl-tpb')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join('/'), [...document.querySelectorAll('.fl-sg .fl-sl')].map(x => x.textContent).join(','), document.querySelectorAll('.fl-fd').length]; }, r);
  ok(r.join('|') === `Programm Jugend|bis 90 % der Kosten|1|Programm Jugend|Jugendarbeit, Gesundheit, Jugendhilfe|true|12-01|true|Programm Jugend*/+ Fördertopf|Name,Kurzname,Zweck,Gebiet,Förderhöhe,Quote,Fristen ${new Date().getFullYear()}|1`,
    'Fördertopf: eigene Angaben und Fristen, Name vorbelegt, kein „Allgemein“-Knopf mehr: ' + r.join('|'));
  await p.fill('[data-fl="topfe.0.name"]', 'Jugendprogramm'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(async () => { const e = flEintrag('F002'), bk = await xlsxBook(await flBlob().arrayBuffer()), R = flLesen(bk), x = R.liste.find(y => y.id === 'F002');
    return [e.fristenL.filter(f => f.topf === 'Jugendprogramm').length, bk.sheets.find(s => s.name === 'Fördertöpfe').rows.length - 1, x.topfe.map(t => t.name + ':' + t.schwer).join(), x.quote, x.kurz, flStufe(FL_BEW[2], 'mehrmals jährlich'), flStufe(FL_BEW[2], 'jährlich'), flStufe(FL_BEW[2], 'einmal im Jahr'), flStufe(FL_BEW[2], 'alle paar Jahre')]; });
  ok(r.join('|') === '1|1|Jugendprogramm:Jugendarbeit, Gesundheit, Jugendhilfe|bis 90 % der Kosten|DSE|3|2|2|1', 'Fördertopf umbenannt: Fristen gehen mit; Excel mit Blatt „Fördertöpfe“, Förderquote, Kurzname; Stufen „jährlich“ vs. „mehrmals jährlich“: ' + r.join('|'));
  await p.click('[data-act="fl-topf-weg"]'); await p.waitForSelector('.modal'); await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  r = await p.evaluate(() => [flEintrag('F002').topfe.length, UI.flTopf, document.querySelectorAll('.fl-tpb').length, flEintrag('F002').fristenL.length > 0]);
  ok(r.join('|') === '0||1|true', 'Fördertopf nach Rückfrage entfernt: der Förderer hat wieder seinen eigenen Steckbrief, die Fristen bleiben: ' + r.join('|'));
  await p.evaluate(() => flZurueck()); await p.waitForTimeout(150);
  await p.evaluate(() => { UI.view = 'flist'; renderNow(); });
  r = await p.evaluate(() => [!document.querySelector('[data-act="fl-zwecke"]'), MHD_ZWECKE.length, mhdZweckeIn('Kultur und Musik').length, mhdZweckeIn('Bevölkerungsschutz, Ehrenamt, Jugend').map(z => z.nr).join(), [...new Set(MHD_ZWECKE.map(z => z.nr).filter(Boolean))].join()]);
  ok(r.join('|') === 'true|14|0|4,12,25|2,3,4,7,9,10,11,12,15,19,25', 'Zwecke der Malteser nur als Abgleich hinterlegt (kein Knopf), Nummern wie im Freistellungsbescheid; Kultur zählt nicht: ' + r.join('|'));
  // 0.100: Netz in der Liste ohne Beschriftung und Tooltip, Suche nach Einschätzung, Fördertopf mit Kurzname, Jahresspalte, Kontakt-Symbole
  await p.evaluate(() => { UI.flBewQ = flQNull(); UI.flSuch = false; UI.flq = ''; UI.flGl = ''; UI.view = 'flist'; renderNow(); }); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const n = document.querySelector('#fl-body .fl-netz'); return [n.hasAttribute('data-tip'), !!n.querySelector('.fn-l'), getComputedStyle(n.querySelector('.fn-l')).opacity, !!document.querySelector('.fl-lupe'), getComputedStyle(document.querySelector('table.fl-tab thead th')).position]; });
  ok(r.join('|') === 'false|true|0|true|sticky', 'Liste: Netz ohne Tooltip, Beschriftung zunächst unsichtbar, Lupe im Reiter, Kopfzeile dockt an: ' + r.join('|'));
  await p.hover('#fl-body tr[data-id] .fl-netz'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => +getComputedStyle(document.querySelector('#fl-body tr[data-id]:hover .fn-l')).opacity > 0.5), 'Beim Überfahren der Zeile erscheint die Beschriftung');
  await p.click('.fl-lupe'); await p.waitForSelector('.fl-such .fn-griff'); const alle = await p.evaluate(() => flGefiltert().length);
  r = await p.evaluate(() => [[...document.querySelectorAll('.fl-such .fn-v')].map(t => t.textContent).join('/'), document.querySelector('.fl-such .fn-l') && [...document.querySelectorAll('.fl-such .fn-l')].map(t => t.textContent).join()]);
  ok(r.join('|') === 'egal/egal/egal/egal/egal|Erfolgschance,Fördersumme,Häufigkeit,Aufwand,Dauer', 'Suchfeld unter dem Reiter: Netz mit „egal“ an jeder Achse: ' + r.join('|'));
  await p.focus('.fl-such .fn-griff[data-k="summe"]'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [UI.flBewQ.summe, flGefiltert().map(e => flBew(e).summe.v).every(v => v >= 2), document.querySelector('.fl-such .fn-v[data-k="summe"]').textContent, document.querySelector('#fl-such-n').textContent === flGefiltert().length + ' Treffer', document.querySelector('.fl-lupe').classList.contains('an')]);
  ok(r.join('|') === '2|true|1.000–3.000 €|true|true', 'Suche: Fördersumme mindestens „mittel“ – alle Treffer haben mittel oder besser: ' + r.join('|'));
  r = await p.evaluate(() => { const n = flGefiltert().length; UI.flBewQ.chance = 3; const m = flGefiltert().map(e => flBew(e).chance.v); UI.flBewQ = flQNull(); return [n < D.fl.liste.length || n === D.fl.liste.length, m.every(v => v === 3), flGefiltert().length === D.fl.liste.length]; });
  ok(r.join('|') === 'true|true|true', 'Suche mit mehreren Achsen: alle müssen erfüllt sein; zurückgesetzt: alle Förderer');
  await p.click('.fl-lupe'); ok(await p.evaluate(() => !document.querySelector('.fl-such')), 'Lupe schließt das Suchfeld wieder');
  await p.evaluate(() => { flEintrag('F002').topfe = [Object.assign(flTopfLeer('Ehrenamt gewinnen. Engagement binden. Zivilgesellschaft stärken.'), { id: 't1', kurz: 'EGE' })]; flEintrag('F002').fristenL = []; UI.flTopf = 't1'; flOeffnen('F002'); UI.flTopf = 't1'; renderNow(); }); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const b = document.querySelector('.fl-tpb.on'); return [b.textContent, b.title, getComputedStyle(b).backgroundColor === getComputedStyle(document.querySelector('.fl-seg button.on') || b).backgroundColor || true, document.querySelector('.fl-tpn .fl-in').value.slice(0, 12), !!document.querySelector('.fl-muell svg'), !document.querySelector('[data-act="fl-topf-weg"].link')]; });
  ok(r.join('|') === 'EGE|Ehrenamt gewinnen. Engagement binden. Zivilgesellschaft stärken.|true|Ehrenamt gew|true|true', 'Fördertopf: Kurzname auf dem Knopf, voller Name beim Überfahren und in der Zeile, Mülleimer statt „entfernen“: ' + r.join('|'));
  await p.fill('[data-fl="topfe.0.kurz"]', 'EGS'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.querySelector('.fl-tpb.on').textContent, flEintrag('F002').topfe[0].kurz]);
  ok(r.join('|') === 'EGS|EGS', 'Kurzname des Fördertopfs änderbar: ' + r.join('|'));
  await p.evaluate(() => { const e = flEintrag('F002'); e.topfe = []; UI.flTopf = ''; e.foerderungen = [Object.assign(flFoerderungLeer(), { jahr: '2025', betrag: 500, zweck: 'Helme', gl: ['Brakel'], quelle: 'Kartei' })]; e.kontakte = [Object.assign(flKontaktLeer(), { n: 'Karla K', pos: 'Leitung', mail: 'k@vb.example', anschreiben: 'ja' })]; changed(); flOeffnen('F002'); }); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const g = [...document.querySelectorAll('.fl-gk')].find(x => /^20\d\d$/.test(x.querySelector('b').textContent)); return [...g.children].map(c => c.textContent.replace(/\s/g, ' ')).join(' / '); });
  ok(/^20\d\d \/ Förderungen \d+( · \d+ Absagen?)? \/ [\d.]+ €$/.test(r), 'Jahresspalte in drei Zeilen: ' + r);
  r = await p.evaluate(() => [!document.querySelector('.fl-seite .fl-h-z'), !!document.querySelector('.fl-rechts > .fl-hz .fl-hinweis-neu') || !!document.querySelector('.fl-seite .fl-ak-box'), !document.querySelector('.fl-seite .fl-sub2')]);
  ok(r.join('|') === 'true|true|true', 'Rechts: keine Überschrift „Einschätzung / außen = günstiger“; „+ Hinweis“ über dem Kasten (nur ohne Hinweis)');
  await p.click('[data-act="fl-k-edit"]');
  r = await p.evaluate(() => [[...document.querySelectorAll('.fl-ani')[0].querySelectorAll('.fl-ab')].map(b => b.dataset.v + ':' + b.dataset.tip).join(' | '), document.querySelector('.fl-an-z span').textContent, document.querySelectorAll('.fl-ani')[0].querySelectorAll('svg').length]);
  ok(r.join('|') === 'ja:Priorität – wird zuerst angeschrieben | :Offen – nicht festgelegt, z. B. in CC | nein:Nicht anschreiben|anschreiben:|3', 'Kontakt bearbeiten: drei Sprechblasen-Symbole mit Erklärung beim Überfahren: ' + r.join('|'));
  await p.click('.fl-ani .fl-ab-nein'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => flEintrag('F002').kontakte[0].anschreiben === 'nein' && document.querySelector('.fl-ani .fl-ab-nein').classList.contains('on')), 'Symbol „nicht anschreiben“ setzt den Wert');
  await p.click('[data-act="fl-k-fertig"]'); await p.evaluate(() => { flEintrag('F002').kontakte[0].anschreiben = 'ja'; flZurueck(); }); await p.waitForTimeout(150);
  // 0.101: Krone (Großförderer), Art oben als Dropdown, Steckbrief mit Fördertöpfen ohne Überschrift, Suchfeld schließt bei Klick daneben
  await p.evaluate(() => { const e = flEintrag('F002'); e.gross = false; e.bew.summe = 3; UI.flTopf = ''; changed(); flOeffnen('F002'); renderNow(); }); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const k = document.querySelector('.fn-krone'); return [!!k, k.classList.contains('an'), k.dataset.tip, document.querySelector('.fn-v[data-k="summe"]').textContent]; });
  ok(r.join('|') === 'true|false|> 10.000 € möglich|> 3.000 €', 'Netz: bei „> 3.000 €“ eine hellgraue Krone mit Hinweis „> 10.000 € möglich“: ' + r.join('|'));
  await p.evaluate(() => document.querySelector('.fn-krone').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await p.waitForTimeout(150);
  r = await p.evaluate(() => [flEintrag('F002').gross, document.querySelector('.fn-krone').classList.contains('an')]);
  ok(r.join('|') === 'true|true', 'Klick auf die Krone: gelb, Förderer ist Großförderer: ' + r.join('|'));
  await p.evaluate(() => { UI.view = 'flist'; renderNow(); }); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const z = document.querySelector('#fl-body tr[data-id="F002"] .fl-krone-l'); return [!!z, z && z.dataset.tip, document.querySelectorAll('#fl-body .fl-krone-l').length, getComputedStyle(document.querySelector('table.fl-tab')).tableLayout, getComputedStyle(document.querySelector('#fl-body td.fl-te')).verticalAlign]; });
  ok(r.join('|') === 'true|> 10.000 € möglich|1|fixed|middle', 'Liste: kleine Krone am Namen nur beim Großförderer; feste Spaltenbreiten; Netz mittig in der Zeile: ' + r.join('|'));
  const b0 = await p.evaluate(() => document.querySelector('table.fl-tab').getBoundingClientRect().width);
  await p.click('.fl-lupe'); await p.waitForSelector('.fl-such');
  r = await p.evaluate(() => [[...document.querySelectorAll('.fl-such .fl-l')].length || [...document.querySelectorAll('.fl-such .fn-l')].map(t => t.textContent).join(), document.querySelector('.fl-such').getBoundingClientRect().width <= 310, !document.querySelector('.fl-such-k'), document.querySelector('.fl-such-r').textContent]);
  ok(r.join('|') === 'Erfolgschance,Fördersumme,Häufigkeit,Aufwand,Dauer|true|true|↶', 'Suchfeld: alle fünf Achsen benannt, schmal, kein Text darüber, Pfeil-zurück statt „zurücksetzen“: ' + r.join('|'));
  await p.keyboard.press('Tab'); await p.focus('.fl-such .fn-griff[data-k="summe"]'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(150);
  ok(Math.abs(await p.evaluate(() => document.querySelector('table.fl-tab').getBoundingClientRect().width) - b0) < 2, 'Suchergebnis ändert die Breite der Tabelle nicht');
  await p.mouse.click(20, 700); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('.fl-such') && !UI.flSuch), 'Klick neben das Suchfeld schließt es');
  await p.evaluate(() => { UI.flBewQ = flQNull(); flOeffnen('F002'); }); await p.waitForTimeout(300);
  r = await p.evaluate(() => [!!document.querySelector('.fl-kopf-u select.fl-art-sel'), document.querySelector('.fl-kopf-u .fl-kurz-k').textContent, !document.querySelector('.fl-menue')]);
  await p.selectOption('.fl-art-sel', 'Stiftung'); await p.waitForTimeout(150);
  r.push(await p.evaluate(() => flEintrag('F002').art));
  ok(r.join('|') === 'true|DSE|true|Stiftung', 'Art oben als Dropdown (Kurzname davor): ' + r.join('|'));
  await p.evaluate(() => { const e = flEintrag('F002'); e.topfe = [Object.assign(flTopfLeer('Programm X'), { id: 't9' })]; UI.flTopf = ''; changed(); renderNow(); }); await p.waitForTimeout(200);
  r = await p.evaluate(() => [document.querySelector('.fl-steck h3') === null, getComputedStyle(document.querySelector('.fl-topfw')).justifyContent, document.querySelector('.fl-tpb.neu').getBoundingClientRect().left > document.querySelector('.fl-tpb.on').getBoundingClientRect().right]);
  ok(r.join('|') === 'true|flex-start|true', 'Mit Fördertöpfen: Wort „Steckbrief“ entfällt, Knöpfe linksbündig, „+ Fördertopf“ rechts: ' + r.join('|'));
  await p.evaluate(() => { flEintrag('F002').topfe = []; flEintrag('F002').gross = true; flEintrag('F002').bew.summe = 0; changed(); flZurueck(); });
  r = await p.evaluate(async () => { const bk = await xlsxBook(await flBlob().arrayBuffer()), R = flLesen(bk); return [R.liste.find(e => e.id === 'F002').gross, R.liste.filter(e => e.gross).length]; });
  ok(r.join('|') === 'true|1', 'Großförderer in der Excel-Kopie und wieder eingelesen: ' + r.join('|'));
  // 0.102: Förderhöhe von … bis …, Gebiet mit Vorschlägen, Fristen-Knopf, Liste mit Kurzname hinter dem Namen und zwei Zeilen
  await p.evaluate(() => { const e = flEintrag('F002'); e.hoehe = 'bis 10.000 €'; e.hoeheVon = null; e.hoeheBis = null; e.gl = []; UI.flTopf = ''; changed(); flOeffnen('F002'); renderNow(); }); await p.waitForTimeout(300);
  r = await p.evaluate(() => [document.querySelector('.fl-hoehe .val').textContent, !!document.querySelector('.fl-frg .fl-fds .fl-frist-neu'), getComputedStyle(document.querySelector('.fl-frist-neu')).borderStyle]);
  ok(r.join('|') === 'bis 10.000 €|true|dashed', 'Förderhöhe: älterer Freitext bleibt; „+ Frist“ gestrichelt direkt bei den Fristen: ' + r.join('|'));
  await p.click('.fl-hoehe'); r = await p.evaluate(() => [...document.querySelectorAll('.fl-hoehe-f')].map(x => x.value).join('/'));
  await p.keyboard.type('1x2a00'); await p.keyboard.press('Tab'); await p.keyboard.press('Control+a'); await p.keyboard.press('Delete'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  r = [r, ...(await p.evaluate(() => { const e = flEintrag('F002'); return [e.hoeheVon, e.hoeheBis, e.hoehe, document.querySelector('.fl-hoehe .val').textContent.replace(/\s/g, ' ')]; }))];
  ok(r.join('|') === '/10000|1200|1200||1.200 €', 'Förderhöhe: zwei Zahlenfelder (Freitext vorbelegt), nur Ziffern, nur „von“ → Betrag in beide Felder: ' + r.join('|'));
  await p.click('.fl-hoehe'); await p.keyboard.press('Control+a'); await p.keyboard.press('Delete'); await p.keyboard.press('Tab'); await p.keyboard.type('7500'); await p.click('.fl-kopf .fl-name'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [flEintrag('F002').hoeheVon, flEintrag('F002').hoeheBis, document.querySelector('.fl-hoehe .val').textContent.replace(/\s/g, ' ')]);
  ok(r.join('|') === '|7500|bis 7.500 €', 'Förderhöhe: nur „bis“; Klick daneben übernimmt: ' + r.join('|'));
  await p.click('.fl-hoehe'); await p.keyboard.press('Control+a'); await p.keyboard.press('Delete'); await p.keyboard.press('Tab'); await p.keyboard.press('Control+a'); await p.keyboard.press('Delete'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.querySelector('.fl-hoehe .val').textContent, document.querySelector('.fl-hoehe .val').classList.contains('leer')]);
  ok(r.join('|') === 'Förderhöhe eintragen …|true', 'Förderhöhe: beide leer → „Förderhöhe eintragen …“ blass: ' + r.join('|'));
  await p.evaluate(() => { flEintrag('F002').hoeheVon = 1000; flEintrag('F002').hoeheBis = 15000; changed(); });
  r = await p.evaluate(async () => { const bk = await xlsxBook(await flBlob().arrayBuffer()), x = flLesen(bk).liste.find(y => y.id === 'F002'); return [x.hoeheVon, x.hoeheBis, flHoeheKlar(x).replace(/\s/g, ' ')]; });
  ok(r.join('|') === '1000|15000|von 1.000 € bis 15.000 €', 'Förderhöhe in der Excel-Kopie (von/bis) und wieder eingelesen: ' + r.join('|'));
  await p.click('.fl-sg [data-fl="gl"]'); await p.keyboard.type('Ges'); await p.waitForSelector('.le-sug');
  r = await p.evaluate(() => [...document.querySelectorAll('.le-sug .le-opt')].map(x => x.textContent).join()); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  await p.keyboard.type(', Bra'); await p.waitForSelector('.le-sug'); await p.click('.fl-kopf .fl-name'); await p.waitForTimeout(150);
  r += '|' + await p.evaluate(() => flEintrag('F002').gl.join());
  ok(/^Geseke/.test(r) && /\|Geseke,Brakel$/.test(r), 'Gebiet: Vorschläge beim Tippen, Enter übernimmt den obersten, Klick daneben ebenso: ' + r);
  await p.click('.fl-steck .fl-zweck'); await p.waitForSelector('.fl-zweck-pop'); await p.keyboard.type('Eigener Zweck'); await p.click('.fl-zweck-pop label:has-text("Ehe und Familie") input'); await p.focus('.fl-zweck-frei'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(() => flEintrag('F002').schwer);
  ok(r === 'Eigener Zweck, Ehe und Familie', 'Zweck: Freitext zuerst, dann die Auswahl, mit Komma: ' + r);
  await p.evaluate(() => { const e = flEintrag('F002'); e.gl = ['Brakel', 'Geseke', 'Büren', 'Paderborn', 'Hagen', 'Dortmund', 'Siegen', 'Höxter', 'Warburg', 'Lippstadt', 'Soest', 'Iserlohn-Menden', 'Marsberg', 'Meschede']; e.kurz = 'DSE'; changed(); UI.view = 'flist'; renderNow(); }); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const t = document.querySelector('#fl-body tr[data-id="F002"]'), g = t.querySelector('.fl-g .fl-clamp'), n = t.querySelector('.fl-n'); return [g.scrollHeight > g.clientHeight, g.dataset.tip.split(', ').length, getComputedStyle(g).webkitLineClamp, n.querySelector('b + .fl-kurz') !== null, t.querySelector('.fl-z .fl-clamp').dataset.tip]; });
  ok(r.join('|') === 'true|14|2|true|Eigener Zweck, Ehe und Familie', 'Liste: Gebiet auf zwei Zeilen gekürzt, alle im Hover-Text mit Komma; Kurzname hinter dem Namen: ' + r.join('|'));
  // 0.103: Suche nach einer Gliederung zeigt „alle Gliederungen“ immer mit; Hinweis über dem Netz-Kasten; Förderhöhe in einer Zeile
  r = await p.evaluate(() => { UI.view = 'flist'; UI.flGl = ''; const e = flEintrag('F002'); e.gl = ['alle']; const f3 = flEintrag('F003'); f3.gl = ['Dortmund']; const o = []; for (const q of ['dortmun', 'Dortmund', 'dortm']) { UI.flq = q; o.push(flGefiltert().map(x => x.id).join('+')); } UI.flq = ''; return o; });
  ok(r[0] === r[1] && r[1] === r[2] && r[0] === 'F003+F002', 'Suche nach Dortmund: Teil und ganzer Name zeigen dasselbe, „alle Gliederungen“ sind dabei: ' + r.join(' / '));
  await p.evaluate(() => { flEintrag('F002').ansprache = []; UI.flTopf = ''; flOeffnen('F002'); renderNow(); }); await p.waitForTimeout(200);
  const top0 = await p.evaluate(() => document.querySelector('.fl-ps').getBoundingClientRect().top);
  await p.evaluate(() => { const e = flEintrag('F002'); e.ansprache = [{ gl: '', art: 'hinweis', kopf: '', titel: 'Wichtig', hinweis: '' }]; e.hoeheVon = null; e.hoeheBis = null; UI.flTopf = ''; UI.flq = ''; flOeffnen('F002'); renderNow(); }); await p.waitForTimeout(300);
  r = await p.evaluate(top0 => { const b = document.querySelector('.fl-kopf .fl-hinw .fl-ak-box'), k = document.querySelector('.fl-rechts .card.fl-seite'), l = document.querySelector('.fl-ps'); return [!!b, !k.querySelector('.fl-ak-box'), b.getBoundingClientRect().bottom <= k.getBoundingClientRect().top + 1, Math.abs(k.getBoundingClientRect().top - l.getBoundingClientRect().top) < 2, !document.querySelector('.fl-ab-gl'), !document.querySelector('.fl-hz'), !document.querySelector('.fl-ab-h'), Math.abs(l.getBoundingClientRect().top - top0) < 1, Math.abs((b.getBoundingClientRect().top - document.querySelector('main.fl-detail').getBoundingClientRect().top) - (k.getBoundingClientRect().top - b.getBoundingClientRect().bottom)) < 2]; }, top0);
  ok(r.join('|') === 'true|true|true|true|true|true|true|true|true', 'Hinweis steht im Kopf über dem Kasten mit dem Netz, nichts verschiebt sich, gleicher Abstand oben und unten, ohne „gilt für“ und ohne leere Textzeile; „+ Hinweis“ verschwindet: ' + r.join('|'));
  await p.click('.fl-hoehe'); r = await p.evaluate(() => { const a = document.querySelectorAll('.fl-hoehe-f'), w = document.querySelector('.fl-hoehe-in').getBoundingClientRect(); return [Math.abs(a[0].getBoundingClientRect().top - a[1].getBoundingClientRect().top) < 3, a[0].getBoundingClientRect().width < 130, w.height < 40]; });
  ok(r.join('|') === 'true|true|true', 'Förderhöhe bearbeiten: „von … € bis … €“ in einer Zeile, Felder nur so breit wie nötig: ' + r.join('|'));
  await p.keyboard.press('Escape'); await p.evaluate(() => flZurueck());
  // 0.107: Excel-Vorlage und Auftrag für Copilot, Einlesen über das ⋯-Menü
  await p.evaluate(() => { const e = flEintrag('F002'); Object.assign(e, { notiz: '', art: '', kurz: '', schwer: '', gl: [], quote: 'alt', web: '', weg: [], antrag: '', gross: false, hoeheVon: null, hoeheBis: null, hoehe: '', recherche: '' }); e.bew = { chance: 0, summe: 0, haeufig: 0, aufwand: 0, dauer: 0 }; e.fristenL = []; e.topfe = []; e.kontakte = []; UI.view = 'flist'; changed(); flOeffnen('F002'); renderNow(); }); await p.waitForTimeout(300);
  await p.click('.fl-punkte'); r = await p.evaluate(() => [...document.querySelectorAll('.fl-menue [data-act^="fl-copilot"]')].map(b => b.dataset.act).join());
  ok(r === 'fl-copilot-dialog', '⋯-Menü: ein Eintrag „Mit Copilot ausfüllen …“ (Vorlage, Auftrag und Einlesen in einem Fenster): ' + r);
  ok(await p.evaluate(() => !document.querySelector('.fl-menue [data-fl="status"]') && /Mit Copilot ausfüllen/.test(document.querySelector('.fl-menue').textContent) && !/Recherche vorbereiten|Ausgefüllte Vorlage/.test(document.querySelector('.fl-menue').textContent)), '⋯-Menü: ohne Status, ohne die beiden alten Einträge');
  r = await p.evaluate(async () => { const e = flEintrag('F002'), bk = await xlsxBook(await flcVorlageBlob(e).arrayBuffer()), st = bk.sheets.find(x => x.name === 'Steckbrief'), pr = flcPrompt(e);
    return [bk.sheets.map(x => x.name).join('+'), st.rows.length - 1, FLC_FELDER.length, st.rows[1][1], pr.includes('Volksbank Test eG') && pr.includes(FLC_DATEI) && /Quelle/.test(pr) && /nichts/i.test(pr), flcLesen(bk) !== null]; });
  ok(r.join('|') === 'Anleitung+Steckbrief+Fristen+Fördertöpfe+Beispiele+Kontakte+Quellen+Auswahlwerte|25|25|Volksbank Test eG|true|true', 'Vorlage: sieben Blätter, ein Feld je Zeile, Name vorbelegt; Auftrag nennt Förderer, Datei und Quellenpflicht: ' + r.join('|'));
  const datei = await p.evaluate(async () => { const S = [['Feld', 'Wert', 'Erkl', 'Sicherheit', 'Quelle', 'Anm'], ['Name des Förderers (voller Name)', 'Volksbank Test eG', '', 'sicher', 'https://q.example', ''], ['Kurzname (intern)', 'VBT', '', 'unsicher', '', ''], ['Art', 'Stiftung', '', 'sicher', 'https://q.example/a', ''],
      ['Förderzweck (Freitext)', 'Ehrenamt', '', 'sicher', '', ''], ['Zwecke der Malteser (Auswahl, mehrere mit Komma)', 'Gesundheit, Jugendhilfe, Kultur', '', 'sicher', '', ''], ['Fördergebiet (Gliederungen, Komma getrennt)', 'Dortmund, Hagen', '', 'sicher', '', ''],
      ['Förderhöhe von (€)', '1.000', '', 'sicher', '', ''], ['Förderhöhe bis (€)', 10000, '', 'sicher', '', ''], ['Förderquote', 'bis 80 %', '', 'sicher', '', ''], ['Homepage', 'www.x.example', '', 'sicher', '', ''], ['Antragsweg', 'Portal', '', 'sicher', '', ''],
      ['Antrag an (E-Mail-Adresse oder Link zum Portal)', 'portal.x.example', '', 'sicher', '', ''], ['Häufigkeit', 'jährlich', '', 'sicher', '', ''], ['Aufwand', 'mäßig', '', 'sicher', '', ''], ['Dauer bis zur Entscheidung', '2–6 Monate', '', 'sicher', '', ''], ['Großförderer (ja = über 10.000 € möglich)', 'ja', '', 'sicher', '', ''], ['Was wird gefördert?', '- Ausstattung für Ehrenamtliche', '', 'sicher', 'https://q.example', ''], ['Was wird nicht gefördert?', '- laufende Kosten', '', 'sicher', '', ''], ['Wie tickt der Förderer? (Zusammenfassung, 2–3 Sätze)', 'Fördert lokal und ehrenamtsnah.', '', 'sicher', '', ''], ['Förderargumentation: Argumente, die ziehen', '- Ehrenamt (Satzung)', '', 'sicher', '', ''], ['Förderargumentation: Stolpersteine', '- Eigenanteil 20 %', '', 'sicher', '', '']];
    const F = [['Frist', 'Jedes Jahr', 'Fördertopf', 'Sicherheit', 'Quelle'], ['31.03.', 'ja', 'Topf A', 'sicher', 'q'], ['15.09.2027', 'nein', '', 'sicher', ''], ['bald', 'ja', '', 'sicher', '']];
    const T = [['Fördertopf', 'Kurzname', 'Förderzweck', 'Gebiet', 'von', 'bis', 'Quote', 'Sicherheit', 'Quelle'], ['Topf A', 'TA', 'Jugend', 'alle', 500, 2000, 'bis 80 %', 'sicher', 'q']];
    const K = [['Name', 'Position', 'E-Mail', 'Telefon', 'Gliederungen', 'Anschreiben', 'Sicherheit', 'Quelle'], ['Frau K', 'Leitung', 'K@X.example', '0231 1', 'Dortmund', '', 'sicher', ''], ['Herr U', '', 'u@x.example', '', '', '', 'unsicher', '']];
    const Q = [['Link', 'Was', 'Am'], ['https://q.example', 'Richtlinien', '01.11.2026']];
    const bl = (name, rows) => ({ name, cols: rows[0].map(() => 20), rows });
    return Array.from(new Uint8Array(await xlsxBlob([bl('Steckbrief', S), bl('Fristen', F), bl('Fördertöpfe', T), bl('Kontakte', K), bl('Quellen', Q)]).arrayBuffer())); });
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => { closeMenus(); flcEinlesen(); })]);
  await fc2.setFiles({ name: 'ausgefuellt.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(datei) }); await p.waitForSelector('.flc-r');
  r = await p.evaluate(() => [[...document.querySelectorAll('.flc-r')].filter(z => z.classList.contains('unsicher')).map(z => z.querySelector('b').textContent).join(), [...document.querySelectorAll('.flc-r')].find(z => /Förderquote/.test(z.textContent)).querySelector('input').checked === false, [...document.querySelectorAll('.flc-r input')].filter(c => c.disabled).length]);
  ok(r.join('|').startsWith('Kurzname,') && /\|true\|1$/.test(r.join('|')), 'Vorschau: Unsicheres markiert und nicht angekreuzt, Ersetzendes (Förderquote) nicht angekreuzt, ungültiges Datum nicht wählbar: ' + r.join('|'));
  r = await p.evaluate(() => { const c = [...document.querySelectorAll('.flc-c')]; return [c.length > 10, [...new Set(c.map(x => x.getBoundingClientRect().left))].length, document.querySelector('.flc-w.fmt b') && document.querySelector('.flc-w.fmt b').textContent, !!document.querySelector('.flc-w.fmt ul')]; });
  ok(r.join('|') === 'true|1|Gefördert:|true', 'Fenster: alle Häkchen in einer Spalte, Formatierung (fett, Aufzählung) direkt dargestellt: ' + r.join('|'));
  await p.click('.flc-r:has-text("Förderzweck") .flc-w'); await p.keyboard.type(', Zusatz'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => [...document.querySelectorAll('.flc-r')].find(z => z.querySelector('b').textContent === 'Förderzweck').querySelector('.flc-w').textContent.includes('Jugendhilfe, Zusatz')), 'Fenster: Text einer Angabe per Klick änderbar');
  await p.click('.flc-r:has-text("An die Notizen anhängen") .flc-w'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const ed = document.querySelector('.flc-r .pe-rich'); return [!!ed, !!(ed && ed.querySelector('b')), !!(ed && /\*Gefördert/.test(ed.textContent))]; });
  ok(r.join('|') === 'true|true|false', '0.127: Notizen im Übernehmen-Fenster formatiert bearbeiten (fett bleibt fett, keine Sternchen): ' + r.join('|'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !document.querySelector('.flc-r .pe-rich') && !!document.querySelector('.flc-modal')), 'Esc beendet das Bearbeiten, das Fenster bleibt offen');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const e = flEintrag('F002'); return [e.kurz, e.art, e.schwer, e.gl.join(', '), e.hoeheVon + '-' + e.hoeheBis, e.quote, e.web, e.weg.join(), e.antrag, [e.bew.haeufig, e.bew.aufwand, e.bew.dauer].join(), e.gross, e.fristenL.map(f => f.d + '/' + f.topf).sort().join(), e.topfe.map(t => t.name + ':' + t.hoeheVon).join(), e.kontakte.map(k => k.n + ':' + k.mail).join(), e.notiz.includes('https://q.example'), e.notiz.includes('*Gefördert:*\n- Ausstattung für Ehrenamtliche') && e.notiz.includes('*Stolpersteine:*\n- Eigenanteil 20 %') && e.notiz.includes('*So tickt der Förderer:*'), e.recherche === today()]; });
  ok(r.join('|') === '|Stiftung|Ehrenamt, Gesundheit, Jugendhilfe, Zusatz|Dortmund, Hagen|1000-10000|alt|https://www.x.example|Portal|https://portal.x.example|2,2,2|true|03-31/Topf A,2027-09-15/Topf A|Topf A:500|Frau K:K@X.example|false|true|true',
    'Einlesen: neue sichere Angaben übernommen, Unsicheres und Vorhandenes (Förderquote) nicht, Kultur weggelassen, ungültige Frist nicht: ' + r.join('|'));
  await p.evaluate(() => undo()); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const e = flEintrag('F002'); return [e.art, e.schwer, e.gl.length, e.topfe.length, e.fristenL.length, e.kontakte.length, e.quote, e.gross, e.notiz]; });
  ok(r.join('|') === '||0|0|0|0|alt|false|', 'Einlesen der Copilot-Vorlage lässt sich mit einem Rückgängig ganz zurücknehmen: ' + r.join('|'));
  // 0.110: Rückgängig auch für die Fördererliste (Einlesen, Tippen), Notizen höchstens 20 Zeilen, „;“ im Fristen-Hinweis = neue Zeile
  await p.evaluate(() => { const e = flEintrag('F002'); Object.assign(e, { kurz: '', quote: '', fristen: '' }); changed(); UNDO.stack = []; undoReset(); flOeffnen('F002'); renderNow(); }); await p.waitForTimeout(300);
  await p.click('.fl-punkte'); await p.fill('.fl-menue [data-fl="kurz"]', 'A'); await p.keyboard.type('BC'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  r = await p.evaluate(() => [flEintrag('F002').kurz, UNDO.stack.length]);
  ok(r.join('|') === 'ABC|1', 'Tippen im selben Feld der Fördererliste ist ein Rückgängig-Schritt: ' + r.join('|'));
  await p.evaluate(() => undo()); await p.waitForTimeout(300);
  r = await p.evaluate(() => [flEintrag('F002').kurz, UI.view]);
  ok(r.join('|') === '|fdetail', 'Rückgängig: Kurzname wieder leer: ' + r.join('|'));
  const nT = await p.evaluate(() => flEintrag('F002').topfe.length);
  await p.evaluate(() => { const e = flEintrag('F002'); e.topfe.push(Object.assign(flTopfLeer('Neu'), { id: 'tt' })); e.fristen = 'laufend; Sitzung im März; Antrag per Portal'; changed(); renderNow(); });
  await p.evaluate(() => undo()); await p.waitForTimeout(200);
  r = await p.evaluate(() => [flEintrag('F002').topfe.length, flEintrag('F002').fristen]);
  ok(r.join('|') === nT + '|', 'Rückgängig: Fördertopf und Hinweis wieder weg: ' + r.join('|'));
  await p.evaluate(() => { const e = flEintrag('F002'); e.fristen = 'laufend; Sitzung im März; Antrag per Portal'; e.notiz = Array.from({ length: 40 }, (_, i) => 'Zeile ' + (i + 1)).join('\n\n'); changed(); renderNow(); }); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const v = document.querySelector('.fl-notizen .pe .val'), cs = getComputedStyle(v), f = document.querySelector('.fl-ft-text .pv'); return [cs.overflowY, v.scrollHeight > v.clientHeight, Math.round(v.clientHeight / parseFloat(cs.lineHeight)) <= 20, (f.innerHTML.match(/<br>|<p/g) || []).length >= 2 || f.querySelectorAll('div, p, li').length >= 3, flEintrag('F002').fristen.includes(';') && !flEintrag('F002').fristen.includes('\n')]; });
  ok(r.join('|') === 'auto|true|true|true|true', 'Notizen: höchstens 20 Zeilen, dann Scrollbalken; Fristen-Hinweis bricht nach „;“ um (Text selbst unverändert): ' + r.join('|'));
  // 0.111: Fördertöpfe haben Steckbrief, Einschätzung, Links und Notizen für sich; kein „Allgemein“; Copilot-Vorlage je Fördertopf
  await p.evaluate(() => { const e = flEintrag('F002'); Object.assign(e, { topfe: [], topfMig: false, web: 'https://e.example', notiz: 'Alt', schwer: 'Basis', gl: ['Brakel'], quote: 'Q', gross: false, hoeheVon: null, hoeheBis: null, hoehe: '', weg: [], antrag: '', fristen: '', kurz: '', art: 'Stiftung' }); e.bew = { chance: 0, summe: 2, haeufig: 0, aufwand: 0, dauer: 0 }; e.fristenL = [{ id: 'x1', d: '03-31', topf: '' }]; UI.flTopf = ''; UNDO.stack = []; changed(); undoReset(); flOeffnen('F002'); renderNow(); }); await p.waitForTimeout(300);
  await p.click('[data-act="fl-topf-neu"]'); await p.keyboard.type('Programm A'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const e = flEintrag('F002'), a = e.topfe[0]; return [a.web, a.bew.summe, a.notiz, a.schwer, a.gl.join(), a.quote, e.fristenL[0].topf, e.topfMig, [...document.querySelectorAll('.fl-tpb')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join('/'), !document.querySelector('.fl-steck h3')]; });
  ok(r.join('|') === 'https://e.example|2|Alt|Basis|Brakel|Q|Programm A|true|Programm A*/+ Fördertopf|true', 'Erster Fördertopf übernimmt die bisherigen Angaben und Fristen des Förderers; kein „Allgemein“, kein „Steckbrief“-Wort: ' + r.join('|'));
  await p.click('[data-act="fl-topf-neu"]'); await p.keyboard.type('Programm B'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const b = flEintrag('F002').topfe[1]; return [b.web, b.notiz, b.schwer, Object.values(b.bew).join(), b.gl.length, UI.flTopf === b.id, document.querySelector('.fl-notizen .pe .val').classList.contains('leer')]; });
  ok(r.join('|') === '|||0,0,0,0,0|0|true|true', 'Weiterer Fördertopf beginnt leer: ' + r.join('|'));
  await p.click('.fl-notizen .pe'); await p.keyboard.type('Nur B'); await p.keyboard.press('Control+Enter'); await p.waitForTimeout(150);
  await p.selectOption('.fl-weg-sel', 'Portal'); await p.fill('.fl-antrag', 'b.example'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  await p.evaluate(() => { fnSetzen('chance', 3); fnSetzen('summe', 3); }); await p.waitForTimeout(150);
  await p.click('.fn-krone'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const e = flEintrag('F002'), [a, b] = e.topfe; return [a.notiz, b.notiz, e.notiz, a.weg.join(), b.weg.join(), b.antrag, a.bew.chance, b.bew.chance, b.gross, a.gross, flBewFuer(e).chance.v, flBewFuer(e).summe.v, flEff(e).gross, flEff(e).web, document.querySelectorAll('.fl-seite .fl-blk h3').length > 3]; });
  ok(r.slice(0, 4).join('|') === 'Alt|Nur B|Alt|' && r[4] === 'Portal' && r[5] === 'https://b.example' && r[6] === 0 && r[7] === 3 && r[8] === true && r[9] === false && r[10] === 3 && r[11] === 3 && r[12] === true && r[13] === 'https://e.example', 'Notizen, Antragsweg, Link, Einschätzung und Krone gelten je Fördertopf; die Übersicht fasst zusammen (beste Werte, Krone, erste Homepage): ' + r.join('|'));
  await p.click('.fl-tpb:has-text("Programm A")'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.querySelector('.fl-notizen .pe .pv').textContent.trim(), document.querySelector('.fl-weg-sel').value, document.querySelector('.fn-v[data-k="chance"]').textContent]);
  ok(r.join('|') === 'Alt||noch offen', 'Wechsel zu Programm A: seine eigenen Notizen, sein Antragsweg, seine Einschätzung: ' + r.join('|'));
  r = await p.evaluate(async () => { const e = flEintrag('F002'); e.topfe[1].recherche = '2026-10-01'; e.topfe[1].fristen = 'laufend'; const bk = await xlsxBook(await flBlob().arrayBuffer()), x = flLesen(bk).liste.find(y => y.id === 'F002'), b = x.topfe[1];
    return [x.topfe.length, b.name, b.notiz, b.web, b.weg.join(), b.antrag, b.gross, b.bew.chance + '/' + b.bew.summe, b.recherche, b.fristen, x.topfe[0].bew.summe, x.topfe[0].notiz]; });
  ok(r.join('|') === '2|Programm B|Nur B||Portal|https://b.example|true|3/3|2026-10-01|laufend|2|Alt', 'Excel-Kopie: Steckbrief, Einschätzung, Links und Notizen je Fördertopf überstehen Schreiben und Einlesen: ' + r.join('|'));
  // alter Stand: Töpfe bekommen, was ihnen aus den Angaben des Förderers fehlt (einmalig)
  r = await p.evaluate(() => { const x = flNorm({ liste: [{ id: 'Z1', name: 'Alt', web: 'https://alt.example', notiz: 'N', bew: { summe: 2 }, fristenL: [{ d: '05-01', topf: '' }], topfe: [{ name: 'T1' }, { name: 'T2', web: 'https://t2.example' }] }] }), e = x.liste[0], y = flNorm(JSON.parse(JSON.stringify(x))).liste[0];
    const erg = [e.topfe[0].web, e.topfe[1].web, e.topfe[0].notiz, e.topfe[1].notiz === 'N', e.topfe[0].bew.summe, e.fristenL[0].topf, e.topfMig, y.topfe[0].web]; e.topfe[1].notiz = ''; const z = flNorm(JSON.parse(JSON.stringify(x))).liste[0];
    return [...erg, z.topfe[1].notiz === '']; });
  ok(r.join('|') === 'https://alt.example|https://t2.example|N|true|2|T1|true|https://alt.example|true', 'Älterer Stand: Töpfe erben einmalig, was ihnen fehlt (Fristen zum ersten Topf); erneutes Laden ändert nichts mehr: ' + r.join('|'));
  // Rückfrage beim Entfernen; Fristen des Topfs gehen mit, beim letzten Topf zurück an den Förderer
  await p.click('.fl-tpb:has-text("Programm B")'); await p.click('[data-act="fl-topf-weg"]'); await p.waitForSelector('.modal'); await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const e = flEintrag('F002'); return [e.topfe.map(t => t.name).join(), UI.flTopf, document.querySelector('.fl-tpb.on').textContent]; });
  ok(r.join('|') === 'Programm A||Programm A', 'Fördertopf entfernt (nach Rückfrage): der nächste ist gewählt: ' + r.join('|'));
  await p.evaluate(() => undo()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => flEintrag('F002').topfe.length) === 2, 'Rückgängig holt den entfernten Fördertopf zurück');
  // Copilot je Fördertopf: Dialog, Vorlage, Auftrag
  await p.evaluate(() => { UI.flTopf = flEintrag('F002').topfe[1].id; renderNow(); }); await p.click('.fl-punkte'); await p.click('[data-act="fl-copilot-dialog"]'); await p.waitForSelector('.flc-dlg');
  r = await p.evaluate(async () => { const e = flEintrag('F002'), b = e.topfe[1], z = { modus: 'topf', topf: b, name: b.name }, bk = await xlsxBook(await flcVorlageBlob(e, z).arrayBuffer()), st = bk.sheets.find(x => x.name === 'Steckbrief'), pr = flcPrompt(e, z);
    return [[...document.querySelectorAll('.flc-dlg .flc-zo')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '*' : '') + (l.querySelector('input').disabled ? '(aus)' : '')).join('/'), [...document.querySelectorAll('.flc-dlg select option')].map(o => o.textContent + (o.selected ? '*' : '')).join('/'), bk.sheets.map(x => x.name).join('+'), st.rows[1][0], st.rows[1][1], st.rows.some(x => /^Art$/.test(x[0])), pr.includes('„Programm B“') && pr.includes('nur für diesen einen Fördertopf'), flcLesen(bk).modus]; });
  ok(r.join('|') === 'Förderer allgemein(aus)/Ein bestimmter Fördertopf*|Programm A – noch nicht recherchiert/Programm B – noch nicht recherchiert*/Neuer Fördertopf …|Anleitung+Steckbrief+Fristen+Beispiele+Kontakte+Quellen+Auswahlwerte|Name des Fördertopfs (voller Name)|Programm B|false|true|topf', 'Dialog: erst „Förderer allgemein“ oder „bestimmter Fördertopf“ (allgemein gesperrt, sobald es Töpfe gibt), Töpfe ohne Recherche gekennzeichnet; Vorlage je Topf ohne Blatt „Fördertöpfe“ und ohne „Art“, Auftrag nennt den Topf: ' + r.join('|'));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  // Einlesen je Fördertopf: vorhandener Topf (nach Namen gewählt) oder neuer
  const topfDatei = (name, zweck) => p.evaluate(async ([name, zweck]) => { const q = 'https://q.example/r.pdf';
    const S = [['Feld', 'Wert', 'E', 'Sicherheit', 'Quelle', 'Anm'], ['Name des Fördertopfs (voller Name)', name, '', 'sicher', q, ''], ['Förderzweck (Freitext)', zweck, '', 'sicher', q, ''], ['Fördergebiet (Gliederungen, Komma getrennt)', 'Hagen', '', 'sicher', q, ''], ['Förderhöhe bis (€)', 2000, '', 'sicher', q, ''], ['Aufwand', 'einfach', '', 'sicher', q, ''], ['Was wird gefördert?', '- Ausstattung', '', 'sicher', q, '']];
    const F = [['Frist', 'Jedes Jahr', 'Sicherheit', 'Quelle'], ['15.06.', 'ja', 'sicher', q]];
    const bl = (n, rows) => ({ name: n, cols: rows[0].map(() => 20), rows });
    return Array.from(new Uint8Array(await xlsxBlob([bl('Steckbrief', S), bl('Fristen', F)]).arrayBuffer())); }, [name, zweck]);
  let dat = await topfDatei('Programm B', 'Jugendarbeit');
  await p.click('.fl-punkte'); let [fc3] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => { closeMenus(); flcEinlesen(); })]);
  await fc3.setFiles({ name: 'b.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(dat) }); await p.waitForSelector('.flc-r');
  r = await p.evaluate(() => [[...document.querySelectorAll('.flc-ziel .flc-zo')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '*' : '')).join('/'), [...document.querySelectorAll('.flc-r b')].map(b => b.textContent).join()]);
  ok(r[0] === 'Programm A/Programm B*/Neuer Fördertopf „Programm B“', 'Einlesen: Ziel ist der Topf mit gleichem Namen vorgewählt, andere Töpfe oder ein neuer sind wählbar: ' + r.join(' | '));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const [a, b] = flEintrag('F002').topfe; return [b.schwer, b.gl.join(), b.hoeheBis, b.bew.aufwand, b.notiz, flEintrag('F002').fristenL.some(f => f.d === '06-15' && f.topf === 'Programm B'), a.schwer, a.gl.join(), a.bew.aufwand, UI.flTopf === b.id]; });
  ok(r.join('|') === 'Jugendarbeit|Hagen|2000|3|Nur B|true|Basis|Brakel|0|true', 'Einlesen in einen vorhandenen Topf: nur dieser Topf ändert sich (Steckbrief, Einschätzung, Fristen mit seinem Namen; vorhandene Notizen bleiben, der Block ist nicht vorgewählt): ' + r.join('|'));
  dat = await topfDatei('Programm C', 'Ehrenamt');
  await p.click('.fl-punkte'); [fc3] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => { closeMenus(); flcEinlesen(); })]);
  await fc3.setFiles({ name: 'c.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(dat) }); await p.waitForSelector('.flc-r');
  r = await p.evaluate(() => [[...document.querySelectorAll('.flc-ziel .flc-zo')].map(l => l.querySelector('input').checked ? l.textContent.trim() : '').join('')]);
  ok(r[0] === 'Neuer Fördertopf „Programm C“', 'Einlesen: unbekannter Topfname → „Neuer Fördertopf“ vorgewählt: ' + r.join('|'));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const e = flEintrag('F002'), c = e.topfe[2]; return [e.topfe.length, c && c.name, c && c.schwer, c && c.web, UI.flTopf === (c && c.id), e.fristenL.some(f => f.d === '06-15' && f.topf === 'Programm C')]; });
  ok(r.join('|') === '3|Programm C|Ehrenamt||true|true', 'Einlesen als neuer Fördertopf: leer angelegt (erbt nichts vom Förderer), mit den eingelesenen Angaben und Fristen: ' + r.join('|'));
  await p.evaluate(() => { flEintrag('F002').topfe = []; flEintrag('F002').topfMig = false; changed(); flZurueck(); });
  // 0.112/0.114: Förderer mit mehreren Fördertöpfen: eine hohe Zeile, rechts daneben je Topf eine Zeile; Suche und Filter wirken je Topf
  await p.evaluate(() => { const e = flEintrag('F002'); const A = Object.assign(flTopfLeer('Programm A'), { id: 'ta', gl: ['Brakel'], schwer: 'Jugend', bew: { chance: 0, summe: 3, haeufig: 0, aufwand: 0, dauer: 0 } }), B = Object.assign(flTopfLeer('Programm B'), { id: 'tb', kurz: 'PB', gl: ['Hagen'], schwer: 'Senioren', bew: { chance: 0, summe: 1, haeufig: 0, aufwand: 0, dauer: 0 }, gross: true });
    e.topfe = [A, B]; e.topfMig = true; e.gl = []; e.schwer = ''; UI.flGl = ''; UI.flq = ''; UI.flBewQ = flQNull(); UI.flSuch = false; UI.flZu = {}; UI.view = 'flist'; changed(); renderNow(); }); await p.waitForTimeout(250);
  r = await p.evaluate(() => { const rows = [...document.querySelectorAll('#fl-body tr[data-id="F002"]')]; return [rows.length, rows.map(x => x.classList.contains('fl-tr-t') ? 'T' : 'K').join(''), rows[0].querySelector('.fl-tg').textContent.trim(), rows[0].querySelector('.fl-n').rowSpan, rows[0].querySelector('.fl-tn').textContent.trim(), rows[0].querySelectorAll('.fl-te svg').length, rows[1].querySelectorAll('.fl-te svg').length, rows[1].querySelectorAll('.fl-krone-l').length, rows[0].querySelectorAll('.fl-n .fl-krone-l').length, rows[0].querySelector('.fl-k').rowSpan, rows[1].querySelectorAll('.fl-n').length]; });
  ok(r.join('|') === '2|TT|▾ 2 Fördertöpfe|2|Programm A|1|1|1|1|2|0', 'Liste: eine hohe Förderer-Zeile (über beide Töpfe), rechts daneben je Topf eine Zeile mit eigenem Netz; Krone am Topf und am Förderer: ' + r.join('|'));
  await p.evaluate(() => { flEintrag('F002').kurz = 'VBT'; UI.flTopf = ''; renderNow(); }); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const td = document.querySelector('#fl-body tr[data-id="F002"] td.fl-n'); return [td.querySelector('.fl-nm').textContent.trim(), td.dataset.tip]; });
  ok(r.join('|') === 'VBT|Volksbank Test eG', 'Mehrere Fördertöpfe: der Förderer steht mit der Kurzform (voller Name als Hinweis): ' + r.join('|'));
  await p.click('#fl-body tr[data-id="F002"] td.fl-n .fl-nm'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => [UI.view, UI.flId].join()) === 'fdetail,F002', 'Klick auf den Förderer in der hohen Zeile öffnet den Förderer');
  await p.evaluate(() => { flZurueck(); }); await p.waitForTimeout(250);
  await p.click('#fl-body tr[data-id="F002"] .fl-tg'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const rows = [...document.querySelectorAll('#fl-body tr[data-id="F002"]')]; return [rows.length, rows[0].querySelector('.fl-tg').textContent.trim(), rows[0].querySelector('.fl-g .fl-clamp').textContent.replace(/\s/g, ' ').trim(), rows[0].querySelectorAll('.fl-te svg').length, UI.view, rows[0].querySelector('.fl-tn').textContent.trim()]; });
  ok(r.join('|') === '1|▸ 2 Fördertöpfe|Brakel, Hagen|0|flist|Programm A, Programm B', 'Einklappen: eine Zeile mit zusammengefasstem Gebiet und den Topfnamen, ohne Netz (Klick öffnet den Förderer nicht): ' + r.join('|'));
  await p.click('#fl-body tr[data-id="F002"] .fl-tg');
  await p.evaluate(() => { UI.flGl = 'Hagen'; renderNow(); }); await p.waitForTimeout(150);
  r = await p.evaluate(() => [[...document.querySelectorAll('#fl-body tr[data-id="F002"]')].map(x => x.querySelector('.fl-tn b').textContent).join('+'), [...document.querySelector('#fl-body tr[data-id="F002"] .fl-tg').textContent.trim().split(' ')].slice(0, 4).join(' ')]);
  ok(r.join('|') === 'Programm B|▾ 1 von 2', 'Filter Gliederung Hagen: nur der Topf, der zu Hagen passt: ' + r.join('|'));
  await p.evaluate(() => { UI.flGl = ''; UI.flBewQ = Object.assign(flQNull(), { summe: 3 }); renderNow(); }); await p.waitForTimeout(150);
  r = await p.evaluate(() => [[...document.querySelectorAll('#fl-body tr[data-id="F002"]')].map(x => x.querySelector('.fl-tn b').textContent).join('+'), flGefiltert().length]);
  ok(r[0] === 'Programm A', 'Mindestwerte (Summe > 3.000 €): nur Programm A – kein Misch-Netz mehr: ' + r.join('|'));
  await p.evaluate(() => { UI.flBewQ = flQNull(); UI.flq = 'senioren'; renderNow(); }); await p.waitForTimeout(150);
  r = await p.evaluate(() => [...document.querySelectorAll('#fl-body tr[data-id="F002"]')].map(x => x.querySelector('.fl-tn b').textContent).join('+'));
  ok(r === 'Programm B', 'Suche nach „senioren“ (Zweck von Programm B): Förderer mit diesem Topf: ' + r);
  // 0.116: Fördersumme aus der Förderhöhe; Warnhinweis unter dem Namen; kein blauer Rahmen; Ansprechperson-Zelle in der hinterlegten Zeile
  r = await p.evaluate(() => { UI.flq = ''; const e = flEintrag('F002'), [A, B] = e.topfe; A.hoeheVon = null; A.hoeheBis = 500; B.hoeheVon = 1000; B.hoeheBis = 9000; A.bew.summe = 0; B.bew.summe = 0;
    const a = flBew(e, A).summe, b = flBew(e, B).summe; A.bew.summe = 2; const c = flBew(e, A).summe; A.bew.summe = 0; return [a.v, a.hand, a.grund, b.v, b.grund, c.v, c.hand]; });
  ok(r.join('|') === '1|false|Förderhöhe bis 500 €|3|Förderhöhe von 1.000 € bis 9.000 €|2|true', 'Fördersumme im Netz aus der Förderhöhe des Topfs geschätzt (Mitte bei „von … bis“); von Hand eingeschätzt geht vor: ' + r.join('|'));
  await p.evaluate(() => { const e = flEintrag('F002'); e.kontakte = [Object.assign(flKontaktLeer(), { n: 'Frau K', pos: 'Leitung' })]; e.ansprache = [{ gl: 'Hagen', art: 'hinweis', titel: 'Über die Gliederung', kopf: '', hinweis: '' }]; changed(); renderNow(); }); await p.waitForTimeout(150);
  await p.mouse.move(2, 2);
  r = await p.evaluate(() => { const rows = [...document.querySelectorAll('#fl-body tr[data-id="F002"]')], n = rows[0].querySelector('td.fl-n'); rows[0].focus(); const k = rows[0].querySelector('td.fl-k'), soft = getComputedStyle(document.documentElement).getPropertyValue('--soft').trim();
    return [!!n.querySelector('.fl-ansp'), n.querySelector('.fl-nm').compareDocumentPosition(n.querySelector('.fl-ansp')) & Node.DOCUMENT_POSITION_FOLLOWING ? 'unter' : 'davor', rows.some(x => x.querySelector('.fl-g .fl-ansp')), rows[0].querySelectorAll('.fl-te circle.auto').length, getComputedStyle(rows[0]).outlineStyle, (() => { const pr = document.createElement('div'); pr.style.background = 'var(--soft)'; document.body.appendChild(pr); const c = getComputedStyle(pr).backgroundColor; pr.remove(); return getComputedStyle(k).backgroundColor === c; })(), k.rowSpan, rows.length, k.className]; });
  ok(r.join('|') === 'true|unter|false|1|none|true|2|2|fl-k fl-rs', 'Liste: Warndreieck unter dem Förderernamen, Netz mit geschätzter Fördersumme, kein Fokusrahmen, Ansprechperson-Zelle wie die Topf-Zeilen hinterlegt: ' + r.join('|'));
  await p.evaluate(() => { const e = flEintrag('F002'); e.kontakte = []; e.ansprache = []; const [A, B] = e.topfe; A.hoeheBis = null; B.hoeheVon = null; B.hoeheBis = null; changed(); renderNow(); });
  await p.evaluate(() => { UI.flq = ''; renderNow(); }); await p.waitForTimeout(100);
  await p.click('#fl-body tr.fl-tr-t[data-topf="tb"]'); await p.waitForTimeout(300);
  r = await p.evaluate(() => [UI.view, UI.flId, UI.flTopf, document.querySelector('.fl-tpb.on').textContent]);
  ok(r.join('|') === 'fdetail|F002|tb|PB', 'Klick auf eine Topf-Zeile öffnet den Förderer mit diesem Topf: ' + r.join('|'));
  await p.evaluate(() => { flEintrag('F002').topfe = []; flEintrag('F002').topfMig = false; UI.flTopf = ''; changed(); flZurueck(); });
  // 0.113: Abfrage „Förderer allgemein oder bestimmter Fördertopf“; Förderer-Vorlage mit allen Angaben je Topf; jeder neue Topf erbt vom Förderer
  await p.evaluate(() => { const e = flEintrag('F002'); Object.assign(e, { notiz: '', anschrift: '', schwer: '', gl: [], recherche: '', web: '', weg: [], antrag: '', gross: false }); e.bew = { chance: 0, summe: 0, haeufig: 0, aufwand: 0, dauer: 0 }; e.fristenL = []; e.topfe = []; e.topfMig = false; e.kontakte = []; UI.flTopf = ''; changed(); flOeffnen('F002'); renderNow(); }); await p.waitForTimeout(250);
  await p.click('.fl-punkte'); await p.click('[data-act="fl-copilot-dialog"]'); await p.waitForSelector('.flc-dlg');
  r = await p.evaluate(async () => { const e = flEintrag('F002'), bk = await xlsxBook(await flcVorlageBlob(e).arrayBuffer()), tp = bk.sheets.find(x => x.name === 'Fördertöpfe'), pr = flcPrompt(e);
    return [[...document.querySelectorAll('.flc-dlg .flc-zo')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '*' : '') + (l.querySelector('input').disabled ? '(aus)' : '')).join('/'), [...document.querySelectorAll('.flc-dlg select option')].map(o => o.textContent).join('/'), document.querySelector('.flc-unter').hidden, tp.rows[0].length, pr.includes('BUDGET je Förderer: höchstens 12') && flcPrompt(e, { modus: 'foerderer', variante: 'B' }).includes('Vorfilter')]; });
  ok(r.join('|') === 'Förderer allgemein*/Ein bestimmter Fördertopf|Neuer Fördertopf …|true|24|true', 'Dialog ohne Töpfe: „Förderer allgemein“ vorgewählt, Topf-Auswahl erst nach Klick; Vorlage: Töpfe-Blatt mit allen Angaben (24 Spalten), Auftrag Variante A (klein), umstellbar auf B (groß, mit Vorfilter): ' + r.join('|'));
  await p.click('.flc-dlg input[value="t"]'); r = await p.evaluate(() => [document.querySelector('.flc-unter').hidden, document.querySelector('.flc-neuname').hidden]);
  ok(r.join() === 'false,false', 'Dialog: „Ein bestimmter Fördertopf“ zeigt die Auswahl (neuer Topf mit Namensfeld)');
  // 0.118: ohne Erklärtexte; nach „Vorlage herunterladen“ erscheint ein Feld zum Hineinziehen der ausgefüllten Excel
  await p.click('.flc-dlg input[value="e"]');
  r = await p.evaluate(() => [/Wofür soll Copilot|Danach in Copilot/.test(document.querySelector('.flc-dlg').textContent), document.querySelector('.flc-drop').hidden, document.querySelector('.modal h2').textContent]);
  ok(r.join() === 'false,false,Mit Copilot ausfüllen', 'Fenster „Mit Copilot ausfüllen“: ohne Erklärtexte, Ablagefeld sofort sichtbar: ' + r.join());
  r = await p.evaluate(() => { const pr = flcPrompt(flEintrag('F002')); return [/Keine Wiederholungen/.test(pr), /nicht in den Notizen wiederholen/.test(pr), /nur, was über den Förderzweck hinausgeht/.test(pr)]; });
  ok(r.join() === 'true,true,true', 'Auftrag: Wiederholungen ausdrücklich ausgeschlossen (Förderzweck nicht noch einmal in den Notizen): ' + r.join());
  const ablegen = (name, xlsx) => p.evaluate(async ([name, xlsx]) => { const e = flEintrag('F002'), dt = new DataTransfer(), b = xlsx ? await flcVorlageBlob(e) : new Blob(['x']);
    dt.items.add(new File([b], name)); const z = document.querySelector('.flc-drop'); z.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); z.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, [name, xlsx]);
  await ablegen('notiz.txt', false); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !!document.querySelector('.flc-dlg')), 'Ablagefeld: andere Dateien werden abgewiesen, das Fenster bleibt');
  await ablegen('ausgefuellt.xlsx', true); await p.waitForSelector('.flc-r');
  ok(await p.evaluate(() => !document.querySelector('.flc-dlg') && !!document.querySelector('.flc-modal')), 'Excel ins Ablagefeld gezogen: Recherche-Fenster schließt, das Einlesen öffnet sich');
  await p.click('.modal footer button:not(.primary)'); await p.waitForTimeout(150);
  const dsee = await p.evaluate(async () => { const q = 'https://q.example/r';
    const S = [['Feld', 'Wert', 'E', 'Sicherheit', 'Quelle', 'Anm'], ['Name des Förderers (voller Name)', 'Volksbank Test eG', '', 'sicher', q, ''], ['Anschrift', 'Hauptstr. 1, 33098 Paderborn', '', 'sicher', q, ''], ['Aufwand', 'mäßig', '', 'sicher', q, ''], ['Wie tickt der Förderer? (Zusammenfassung, 2–3 Sätze)', 'Fördert Ehrenamt.', '', 'sicher', q, '']];
    const zeile = o => FLC_TSP.map(([n]) => o[n] === undefined ? '' : o[n]);
    const T = [FLC_TSP.map(c => c[0]),
      zeile({ 'Fördertopf (voller Name)': 'Mikroförderung', 'Förderzweck': 'Ehrenamt', 'Fördergebiet (Gliederungen)': 'alle', 'Förderhöhe bis (€)': 3000, 'Sicherheit': 'sicher', 'Antragsweg': 'E-Mail', 'Antrag an (E-Mail oder Link)': 'mikro@x.example', 'Aufwand': 'einfach', 'Was wird gefördert?': '- Kleinprojekte' }),
      zeile({ 'Fördertopf (voller Name)': 'action!', 'Förderzweck': 'Jugend', 'Fördergebiet (Gliederungen)': 'Hagen', 'Förderhöhe bis (€)': 5000, 'Sicherheit': 'sicher', 'Antragsweg': 'Portal', 'Antrag an (E-Mail oder Link)': 'portal.x.example', 'Häufigkeit': 'jährlich', 'Förderrichtlinien (Link)': 'x.example/r.pdf', 'Was wird nicht gefördert?': '- Personal', 'Wie tickt das Programm? (2–3 Sätze)': 'Jugendnah.' }),
      zeile({ 'Fördertopf (voller Name)': 'Nur Name', 'Sicherheit': 'sicher' })];
    const bl = (name, rows) => ({ name, cols: rows[0].map(() => 20), rows });
    return Array.from(new Uint8Array(await xlsxBlob([bl('Steckbrief', S), bl('Fördertöpfe', T)]).arrayBuffer())); });
  await p.click('.fl-punkte'); const [fc4] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => { closeMenus(); flcEinlesen(); })]);
  await fc4.setFiles({ name: 'dsee.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(dsee) }); await p.waitForSelector('.flc-r');
  const tabs = () => p.evaluate(() => [...document.querySelectorAll('.flc-tab')].map(b => b.childNodes[0].textContent + (b.querySelector('.flc-neu') ? '*' : '') + ':' + b.querySelector('small').textContent + (b.classList.contains('on') ? '!' : '')).join('/'));
  const titel = () => p.evaluate(() => [[...document.querySelectorAll('.flc-r:not(.erbe) > .flc-k > b')].map(b => b.textContent).join(), [...document.querySelectorAll('.flc-r.erbe > .flc-k > b')].map(b => b.textContent).join()]);
  r = [await tabs(), ...(await titel())];
  ok(r[0] === 'Förderer:4/4!/Mikroförderung*:8/8/action!*:9/9/Nur Name*:0/1' && r[1] === 'Anschrift,Aufwand,An die Notizen anhängen,Recherchestand (Förderer)' && r[2] === '', 'Vorschau: Reiter „Förderer“ und je Fördertopf; der Förderer-Reiter zeigt nur die Angaben zum Förderer: ' + r.join(' | '));
  await p.click('.flc-tab:has-text("action!")'); r = [await tabs(), ...(await titel())];
  ok(r[0].includes('action!*:9/9!') && r[1] === 'Fördertopf anlegen,Förderzweck,Fördergebiet,Förderhöhe,Antragsweg,Antrag an (Link),Förderrichtlinien,Häufigkeit,Notizen' && r[2] === 'Anschrift,Aufwand,An die Notizen anhängen', 'Reiter eines Fördertopfs: seine eigenen Angaben, darunter was er vom Förderer übernimmt (fehlende Felder und Achsen; die Notizen des Förderers werden angehängt): ' + r.join(' | '));
  await p.click('.flc-r:has-text("Fördertopf anlegen") input'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [[...document.querySelectorAll('.flc-r input')].filter(c => c.disabled).length, document.querySelectorAll('.flc-r.erbe').length, document.querySelector('.flc-tab.on small').textContent]);
  ok(r.join('|') === '8|0|0/9', 'Ohne „Fördertopf anlegen“ sind seine übrigen Angaben gesperrt und zählen nicht: ' + r.join('|'));
  await p.click('.flc-r:has-text("Fördertopf anlegen") input'); await p.click('.flc-tab:has-text("Nur Name")');
  r = await p.evaluate(() => [document.querySelectorAll('.flc-r:not(.erbe)').length, document.querySelector('.flc-r input').checked, /nur den Namen geliefert/.test(document.querySelector('.flc-r').textContent)]);
  ok(r.join('|') === '1|false|true', 'Topf nur mit Namen: nicht vorgewählt, mit Hinweis auf die Einzelrecherche: ' + r.join('|'));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const e = flEintrag('F002'), [m, a] = e.topfe; return [e.topfe.map(t => t.name).join(), m.schwer + '/' + m.weg.join() + '/' + m.antrag + '/' + m.bew.aufwand, a.schwer + '/' + a.gl.join() + '/' + a.weg.join() + '/' + a.antrag + '/' + a.richtlinien + '/' + a.bew.haeufig, a.anschrift, m.anschrift, a.notiz.includes('*Nicht gefördert:*\n- Personal') && a.notiz.includes('*So tickt der Förderer:*\nJugendnah.'), m.notiz.includes('*Gefördert:*\n- Kleinprojekte'), m.recherche === today() && a.recherche === today(), e.topfMig]; });
  ok(r.join('|') === 'Mikroförderung,action!|Ehrenamt/E-Mail/mikro@x.example/3|Jugend/Hagen/Portal/https://portal.x.example/https://x.example/r.pdf/2|Hauptstr. 1, 33098 Paderborn|Hauptstr. 1, 33098 Paderborn|true|true|true|true', 'Einlesen: jeder Fördertopf bekommt seine eigenen Angaben und erbt Fehlendes vom Förderer (nicht nur der erste); Recherchestand je Topf: ' + r.join('|'));
  await p.evaluate(() => undo()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => flEintrag('F002').topfe.length) === 0, 'Einlesen mit mehreren Fördertöpfen: ein Rückgängig nimmt alles zurück');
  await p.evaluate(() => { flZurueck(); });
  // 0.120: Fördersumme aus dem Höchstbetrag; Förderer-Angaben gehen beim Einlesen in jeden neuen Topf (nichts verborgen); Beispiele
  r = await p.evaluate(() => { const o = { hoeheVon: 1000, hoeheBis: 5000, hoehe: '' }, a = flBewHoehe(o), b = flBewHoehe({ hoeheVon: 1000, hoeheBis: 1000, hoehe: '' }), c = flBewHoehe({ hoeheVon: null, hoeheBis: null, hoehe: 'bis 2.500 Euro' }), d = flBewHoehe({ hoeheVon: null, hoeheBis: null, hoehe: 'bis 90 % der Kosten' });
    return [a.v, b.v, c.v, d]; });
  ok(r.join('|') === '3|1|2|', 'Fördersumme aus der Förderhöhe: der Höchstbetrag zählt (1.000–5.000 € → > 3.000 €), alter Freitext nur mit Euro: ' + r.join('|'));
  await p.evaluate(() => { const e = flEintrag('F002'); Object.assign(e, { notiz: '', anschrift: '', schwer: '', gl: [], recherche: '', web: '', weg: [], antrag: '', gross: false, hoeheVon: null, hoeheBis: null, hoehe: '', beispiele: [] }); e.bew = { chance: 0, summe: 1, haeufig: 0, aufwand: 0, dauer: 0 }; e.fristenL = []; e.topfe = []; e.topfMig = false; e.kontakte = []; UI.flTopf = ''; changed(); flOeffnen('F002'); renderNow(); }); await p.waitForTimeout(250);
  await p.click('.fl-hoehe'); await p.fill('.fl-hoehe-f >> nth=0', '1000'); await p.fill('.fl-hoehe-f >> nth=1', '5000'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const e = flEintrag('F002'), B = flBew(e); return [e.bew.summe, B.summe.v, B.summe.hand, B.summe.grund]; });
  ok(r.join('|') === '0|3|false|Förderhöhe von 1.000 € bis 5.000 €', 'Neue Förderhöhe: die von Hand gesetzte Fördersumme wird verworfen, das Netz schätzt aus der Höhe: ' + r.join('|'));
  await p.evaluate(() => { const e = flEintrag('F002'); e.hoeheVon = null; e.hoeheBis = null; changed(); renderNow(); });
  const bingo = await p.evaluate(async () => { const q = 'https://q.example/b';
    const S = [['Feld', 'Wert', 'E', 'Sicherheit', 'Quelle', 'Anm'], ['Name des Förderers (voller Name)', 'Volksbank Test eG', '', 'sicher', q, ''], ['Anschrift', 'Weg 1, 12345 Ort', '', 'sicher', q, ''], ['Was wird gefördert?', '- Dankformate', '', 'sicher', q, ''], ['Wie tickt der Förderer? (Zusammenfassung, 2–3 Sätze)', 'Landesnah.', '', 'sicher', q, '']];
    const zeile = o => FLC_TSP.map(([n]) => o[n] === undefined ? '' : o[n]);
    const T = [FLC_TSP.map(c => c[0]), zeile({ 'Fördertopf (voller Name)': 'Projektförderung', 'Förderzweck': 'Ehrenamt', 'Förderhöhe von (€)': 1000, 'Förderhöhe bis (€)': 5000, 'Sicherheit': 'sicher' }),
      zeile({ 'Fördertopf (voller Name)': 'Local Hero', 'Förderzweck': 'Engagement vor Ort', 'Förderhöhe bis (€)': 1000, 'Sicherheit': 'sicher', 'Weitere Notizen': '- Auswahl durch Vermittlungsstellen' })];
    const Bs = [['Fördertopf (leer = Förderer allgemein)', 'Schlagwort', 'Beschreibung', 'Ort', 'Jahr', 'Betrag', 'Sicherheit', 'Quelle'], ['', 'Ehrenamtstag', 'Dankfest für Engagierte.', 'Essen', 2026, 1680, 'sicher', q], ['Local Hero', 'Kältebus', 'Preis für einen Kältebus.', 'Köln', 2025, 1000, 'sicher', q]];
    const bl = (name, rows) => ({ name, cols: rows[0].map(() => 20), rows });
    return Array.from(new Uint8Array(await xlsxBlob([bl('Steckbrief', S), bl('Fördertöpfe', T), bl('Beispiele', Bs)]).arrayBuffer())); });
  await p.evaluate(() => closeMenus()); const [fc5] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => { flcEinlesen(); })]);
  await fc5.setFiles({ name: 'bingo.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(bingo) }); await p.waitForSelector('.flc-r');
  r = [await tabs(), ...(await titel())];
  ok(r[1].includes('Ehrenamtstag'), 'Vorschau: Beispiele des Förderers im Reiter „Förderer“: ' + r.join(' | '));
  await p.click('.flc-tab:has-text("Local Hero")'); r = [await tabs(), ...(await titel())];
  ok(r[1] === 'Fördertopf anlegen,Förderzweck,Förderhöhe,Notizen,Kältebus' && r[2] === 'Anschrift,An die Notizen anhängen,Ehrenamtstag', 'Reiter „Local Hero“: eigene Angaben und Beispiel, dazu vom Förderer Anschrift, Notizen (angehängt) und dessen Beispiel: ' + r.join(' | '));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const e = flEintrag('F002'), [P, H] = e.topfe; return [e.topfe.map(t => t.name).join(), P.notiz.includes('*Gefördert:*\n- Dankformate'), H.notiz.startsWith('*Weiteres:*\n- Auswahl') && H.notiz.includes('*Zum Förderer allgemein:*') && H.notiz.includes('Landesnah.'), H.anschrift, P.beispiele.map(b => b.titel).join(), H.beispiele.map(b => b.titel).join(), flBew(e, P).summe.v, flBew(e, H).summe.v]; });
  ok(r.join('|') === 'Projektförderung,Local Hero|true|true|Weg 1, 12345 Ort|Ehrenamtstag|Kältebus,Ehrenamtstag|3|1', 'Einlesen: Notizen und Beispiele des Förderers stehen in jedem Topf (bei eigenen Notizen angehängt), nichts bleibt verborgen; Netz je Topf aus seiner Höhe: ' + r.join('|'));
  // Beispiele auf der Seite: Schlagworte, Klick zeigt die Beschreibung, löschen, hinzufügen
  await p.evaluate(() => { UI.flTopf = flEintrag('F002').topfe[1].id; renderNow(); }); await p.waitForTimeout(200);
  r = await p.evaluate(() => [[...document.querySelectorAll('.fl-bsp .fl-bsp-c')].map(b => b.textContent.trim()).join('/'), (() => { const a = document.querySelector('.fl-bsp').getBoundingClientRect(), l = document.querySelector('.fl-fn').getBoundingClientRect(); return Math.abs(a.bottom - l.bottom) < 2 || (a.bottom > l.bottom && Math.abs(a.height - 110) < 2); })()]);
  ok(r.join('|') === 'Kältebus 2025/Ehrenamtstag 2026|true', 'Kasten „Beispiele“: Schlagworte mit Jahr, reicht bis zum unteren Rand der linken Kästen (mindestens 110 px hoch): ' + r.join('|'));
  await p.click('.fl-bsp-c >> nth=0'); await p.waitForSelector('.fl-bsp-pop');
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, document.querySelector('.fl-bsp-pop').textContent]);
  ok(r[0] === 'Kältebus' && r[1].includes('Preis für einen Kältebus.') && r[1].includes('Köln · 2025 · 1.000'), 'Klick auf ein Beispiel: Fenster mit Beschreibung, Ort, Jahr und Betrag: ' + r.join(' | '));
  await p.click('.modal footer button:has-text("Löschen")'); await p.waitForTimeout(200);
  await p.click('[data-act="fl-bsp-neu"]'); await p.waitForSelector('.fl-bsp-form'); await p.fill('.fl-bsp-form input >> nth=0', 'Sanitätsrucksack'); await p.fill('.fl-bsp-form textarea', 'Ausstattung für den Sanitätsdienst.'); await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  r = await p.evaluate(() => flEintrag('F002').topfe[1].beispiele.map(b => b.titel + ':' + b.text).join('/'));
  ok(r === 'Ehrenamtstag:Dankfest für Engagierte./Sanitätsrucksack:Ausstattung für den Sanitätsdienst.', 'Beispiel löschen und „+ Beispiel“ hinzufügen: ' + r);
  r = await p.evaluate(async () => { const R = flLesen(await xlsxBook(await flBlob().arrayBuffer())), e = R.liste.find(x => x.id === 'F002'); return e.topfe.map(t => t.name + ':' + t.beispiele.map(b => b.titel + '/' + b.jahr).join('+')).join(' '); });
  ok(r === 'Projektförderung:Ehrenamtstag/2026 Local Hero:Ehrenamtstag/2026+Sanitätsrucksack/', 'Excel-Kopie: Beispiele je Topf hin und zurück: ' + r);
  await p.evaluate(() => { const e = flEintrag('F002'); e.topfe = []; e.topfMig = false; e.beispiele = []; UI.flTopf = ''; changed(); flZurueck(); });
  // 0.121: KI-Recherche für mehrere Förderer: auswählen, Vorlagen als ZIP, gemeinsamer Auftrag, mehrere Dateien/ZIP einlesen
  await p.evaluate(() => { const a = D.fl.liste.find(x => x.id !== 'F002'), b = flEintrag('F002'); UI.flTestA = a.id; a.quote = ''; b.quote = ''; a.anschrift = ''; b.anschrift = ''; UI.view = 'flist'; UI.flq = ''; UI.flGl = ''; changed(); renderNow(); }); await p.waitForTimeout(200);
  await p.click('[data-act="fl-serie"]'); await p.click('#fl-body tr[data-id="' + await p.evaluate(() => UI.flTestA) + '"]'); await p.click('#fl-body tr[data-id="F002"]'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [[...UI.flWahl].sort().join() === [UI.flTestA, 'F002'].sort().join(), document.querySelector('[data-act="fl-serie-los"]').textContent, document.querySelectorAll('#fl-body tr.fl-gew').length, UI.view]);
  ok(r.join('|') === 'true|Recherche für 2 Förderer …|2|flist', 'KI-Recherche: Förderer anklicken markiert sie (öffnet sie nicht): ' + r.join('|'));
  await p.click('[data-act="fl-serie-los"]'); await p.waitForSelector('.fl-serie-dlg');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.fl-serie-dlg .flc-knoepfe button:first-child')]);
  r = await p.evaluate(async () => { const L = D.fl.liste.filter(e => UI.flWahl.has(e.id)), out = [];
    for (const e of L) { const R = flcLesen(await xlsxBook(await flcVorlageBlob(e).arrayBuffer())); out.push(flSerieDatei(e) === flSerieDatei(e) && R.fid === e.id); }
    const pr = flcSeriePrompt(L); return [out.join(' ') + ' ' + flSerieDatei(flEintrag('F002')), L.every(e => pr.includes(e.name) && pr.includes(flSerieDatei(e))) && pr.includes('AUSFÜLLREGELN') && pr.includes('VORGEHEN') && pr.includes('TYPISCH FÜR KLEINE FÖRDERER') && pr.includes('Keine Wiederholungen') && !pr.includes('[Name]')]; });
  ok(dl.suggestedFilename() === 'KI-Recherche_2_Foerderer.zip' && r.join('|') === 'true true Recherche_F002_VBT.xlsx|true', 'Vorlagen als ZIP (je Förderer eine Datei mit ID), gemeinsamer Auftrag mit allen Förderern und den Regeln: ' + dl.suggestedFilename() + ' ' + r.join('|'));
  await p.evaluate(async () => { const mk = async (e, quote, mitId) => { const bk = await flcVorlageBlob(e).arrayBuffer(), B = await xlsxBook(bk);
      const S = [['Feld', 'Wert', 'E', 'Sicherheit', 'Quelle', 'Anm'], ['Name des Förderers (voller Name)', e.name, '', 'sicher', '', ''], ['Förderquote', quote, '', 'sicher', 'https://q.example', '']];
      const bl = (name, rows) => ({ name, cols: rows[0].map(() => 20), rows });
      const sh = [bl('Steckbrief', S)]; if (mitId) sh.unshift(bl('Anleitung', [['Förderer-Vorlage'], ['Förderer-ID: ' + e.id + ' (nicht ändern)']]));
      return new Uint8Array(await xlsxBlob(sh).arrayBuffer()); };
    const z = zipBlob([{ name: 'x/Recherche_eins_ausgefuellt.xlsx', data: await mk(flEintrag(UI.flTestA), 'bis 50 %', true) }, { name: 'zwei_ausgefuellt.xlsx', data: await mk(flEintrag('F002'), 'bis 70 %', false) }], 'application/zip');
    const dt = new DataTransfer(); dt.items.add(new File([z], 'ergebnis.zip')); const d = document.querySelector('.fl-serie-dlg .flc-drop');
    d.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); d.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await p.waitForSelector('.flc-r'); const flTestName = await p.evaluate(() => flEintrag(UI.flTestA).name); r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, [...document.querySelectorAll('.flc-sf')].map(x => x.className.replace('flc-sf ', '') + ':' + x.querySelector('.flc-sf-n').textContent).join(' / '), [...document.querySelectorAll('.modal footer button')].map(b => b.textContent).join('/'), !!document.querySelector('.flc-bt, .flc-zaehl, .flc-hint')].join(' | '));
  ok(r.startsWith('Welche Angaben sollen übernommen werden? | jetzt:') && r.includes(' / wartet:') && r.endsWith('| Recherche beenden/Überspringen/Übernehmen | false'), 'ZIP mit zwei Dateien: links die Förderer (erster jetzt, zweiter folgt), neue Überschrift, ohne Dateizeile, Zähler und Erklärtext: ' + r);
  await p.click('.modal footer button.primary'); await p.waitForFunction(() => document.querySelectorAll('.flc-sf.ok').length === 1);
  r = await p.evaluate(() => [...document.querySelectorAll('.flc-sf')].map(x => x.className.replace('flc-sf ', '') + ':' + x.querySelector('.flc-sf-n').textContent).join(' / '));
  ok(r.startsWith('ok:') && r.endsWith(' / jetzt:VBT'), 'Zweite Datei ohne ID über den Namen zugeordnet, die erste links als übernommen markiert: ' + r);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const x = [flEintrag(UI.flTestA).quote, flEintrag('F002').quote, UI.flWahl, !!document.querySelector('.modal')]; delete UI.flTestA; return x; });
  ok(r.join('|') === 'bis 50 %|bis 70 %||false', 'Beide Förderer haben ihre eigenen Angaben, Auswahl beendet: ' + r.join('|'));
  // 0.122: Auftrag in zwei Varianten – A klein/lokal, B groß/überregional; Regeln nur einmal, Unterschiede als Parameter
  r = await p.evaluate(() => { const k = { name: 'Bürgerstiftung Test', web: 'https://bs.example', art: 'Stiftung', topfe: [] }, g = { name: 'Lotterie Test', web: 'https://lo.example', art: 'Soziallotterie', topfe: [] };
    const A = flcAuftrag([k], flcVariante(k), flSerieDatei), B = flcAuftrag([g], flcVariante(g), flSerieDatei), RA = flcAusfuellregeln('A'), RB = flcAusfuellregeln('B');
    return [flcVariante(k), flcVariante(g), flcVariante({ art: 'Öffentlich' }), flcVariante({ art: 'Sparkasse' }), A.includes('höchstens 12 geöffnete') && A.includes('TYPISCH FÜR KLEINE') && A.includes('bis zu 4 nachweislich') && !A.includes('Name des Topfs') && !A.includes('Topf-Notizen'),
      B.includes('höchstens 40 geöffnete') && B.includes('Vorfilter') && B.includes('bis zu 8 nachweislich') && B.includes('Name des Topfs, Quelle') && B.includes('Topf-Notizen wiederholen nichts aus dem Steckbrief') && B.includes('per Vorfilter ausgeschlossen'),
      A.includes('1. Bürgerstiftung Test – Homepage: https://bs.example – Datei: '), RA.split('\n').length === RB.split('\n').length && A.includes(RA) && B.includes(RB)]; });
  ok(r.join('|') === 'A|B|B|A|true|true|true|true', 'Auftrag: Vorschlag nach Art (Soziallotterie/Öffentlich → groß), Variante A mit Budget 12 und 4 Beispielen, B mit Budget 40, Vorfilter, 8 Beispielen und Topf-Name; Ausfüllregeln aus einer Quelle: ' + r.join('|'));
  await p.evaluate(() => { const a = D.fl.liste.find(x => x.id !== 'F002'), b = flEintrag('F002'); UI.flTA = [a.art, b.art]; a.art = 'Soziallotterie'; b.art = 'Stiftung'; UI.flWahl = new Set([a.id, b.id]); UI.view = 'flist'; renderNow(); flSerieDialog(); }); await p.waitForSelector('.fl-serie-dlg');
  r = await p.evaluate(() => [[...document.querySelectorAll('.fl-serie-dlg .flc-var-k')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join('/'), !document.querySelector('.flc-var-h').hidden && /Gemischte Auswahl/.test(document.querySelector('.flc-var-h').textContent)]);
  ok(r.join('|') === 'klein / lokal*/groß / überregional|true', 'KI-Recherche: Umfang wählbar, gemischte Auswahl (klein und groß) zeigt einen Hinweis: ' + r.join('|'));
  await p.click('.modal footer button.primary'); await p.evaluate(() => { const a = D.fl.liste.find(x => x.id !== 'F002'), b = flEintrag('F002'); [a.art, b.art] = UI.flTA; delete UI.flTA; UI.flWahl = null; renderNow(); });
  // 0.123: KI-Recherche als Fenster unter dem Knopf; Förderhöhe mit nur einem Betrag = „bis“; Tasten; Trennlinie verschiebbar; Kennzeichen im Übernehmen-Fenster
  await p.evaluate(() => { UI.view = 'flist'; UI.flWahl = null; renderNow(); }); await p.click('[data-act="fl-serie"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [!!document.querySelector('.fl-serie-pop'), document.querySelector('.fl-sp-h').textContent, !!document.querySelector('.fl-serie-pop [data-act="fl-serie-los"]')]);
  ok(r.join('|') === 'true|Wähle einen oder mehrere Förderer aus – einfach in der Liste anklicken.|false', 'KI-Recherche: Fenster unter dem Knopf mit Hinweis, noch ohne Recherche-Knopf: ' + r.join('|'));
  await p.click('#fl-body tr[data-id="F002"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.querySelector('.fl-serie-pop [data-act="fl-serie-los"]').textContent, document.querySelector('.fl-sp-h').textContent]);
  ok(r[0] === 'Recherche für 1 Förderer …' && r[1].startsWith('1 Förderer ausgewählt'), 'Nach dem Anklicken erscheint „Recherche für 1 Förderer …“: ' + r.join('|'));
  await p.click('.fl-serie-btn'); ok(await p.evaluate(() => UI.flWahl === null && !document.querySelector('.fl-serie-pop')), 'Knopf noch einmal: KI-Recherche beendet');
  r = await p.evaluate(() => [JSON.stringify(flcHoehe(null, 12000)), JSON.stringify(flcHoehe(12000, 12000)), JSON.stringify(flcHoehe(12000, null)), JSON.stringify(flcHoehe(500, 3000)), flHoeheKlar(Object.assign({ hoehe: '' }, flcHoehe(12000, 12000)))]);
  ok(r.join('|') === '{"hoeheVon":null,"hoeheBis":12000}|{"hoeheVon":null,"hoeheBis":12000}|{"hoeheVon":null,"hoeheBis":12000}|{"hoeheVon":500,"hoeheBis":3000}|bis 12.000 €', 'Förderhöhe aus der Recherche: ein Betrag (auch zweimal derselbe) = „bis …“, nur eine echte Spanne mit „von“: ' + r.join('|'));
  // Tasten: dieselben wie in der Bedarfsliste (Standard: Pfeile), auf der Seite nächster/voriger Förderer
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); }); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  r = await p.evaluate(() => { const L = [...document.querySelectorAll('#fl-body tr[data-id]')]; return [L.indexOf(document.activeElement), document.activeElement.dataset.id]; });
  const zweite = r[1]; ok(r[0] === 1, 'Fördererliste: Pfeil runter geht von Zeile zu Zeile: ' + r.join('|'));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => UI.view + ':' + UI.flId) === 'fdetail:' + zweite, 'Pfeil rechts (wie „Bedarf öffnen“) öffnet den Förderer');
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(300);
  r = await p.evaluate(() => { const L = flGefiltert().map(e => e.id); return [UI.view, L.indexOf(UI.flId)]; });
  ok(r.join('|') === 'fdetail|0', 'Auf der Seite: Pfeil hoch öffnet den vorigen Förderer der Liste: ' + r.join('|'));
  await p.evaluate(() => { flZurueck(); }); await p.waitForTimeout(250);
  // Trennlinie zwischen Förderer und Töpfen ziehen
  await p.evaluate(() => { const e = flEintrag('F002'); e.topfe = [flTopfLeer('Topf X'), flTopfLeer('Topf Y')]; e.topfMig = true; UI.flZu = {}; changed(); renderNow(); }); await p.waitForTimeout(200);
  const g = await p.locator('#fl-body .fl-split').first().boundingBox();
  await p.mouse.move(g.x + 4, g.y + 10); await p.mouse.down(); await p.mouse.move(g.x + 104, g.y + 10, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.querySelector('col.fl-c1').style.width, document.querySelector('col.fl-c2').style.width, localStorage.getItem('bl-fl-split'), UI.view]);
  ok(parseFloat(r[0]) > 12 && parseFloat(r[0]) + parseFloat(r[1]) === 26 && r[2] === String(parseFloat(r[0])) && r[3] === 'flist', 'Trennlinie gezogen: Förderer-Spalte breiter, Töpfe schmaler (zusammen gleich), gemerkt, Förderer nicht geöffnet: ' + r.join('|'));
  await p.evaluate(() => { localStorage.removeItem('bl-fl-split'); const e = flEintrag('F002'); e.topfe = []; e.topfMig = false; changed(); renderNow(); });
  // 0.126: alle Fördertöpfe auf/zu; KI-Recherche mit Ablagefeld gleich im kleinen Fenster
  await p.evaluate(() => { const e = flEintrag('F002'); e.topfe = [flTopfLeer('Topf X'), flTopfLeer('Topf Y')]; e.topfMig = true; UI.flZu = {}; UI.flWahl = null; UI.view = 'flist'; changed(); renderNow(); }); await p.waitForTimeout(150);
  r = await p.evaluate(() => document.querySelector('.fl-zu-alle').textContent.trim()); await p.click('.fl-zu-alle'); await p.waitForTimeout(100);
  const r2 = await p.evaluate(() => [document.querySelector('.fl-zu-alle').textContent.trim(), document.querySelectorAll('#fl-body tr[data-id="F002"]').length, !!UI.flZu.F002]);
  ok(r === '▾ Töpfe einklappen' && r2.join('|') === '▸ Töpfe aufklappen|1|true', 'Alle Fördertöpfe mit einem Klick einklappen: ' + r + ' → ' + r2.join('|'));
  await p.click('.fl-zu-alle'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.querySelectorAll('#fl-body tr[data-id="F002"]').length) === 2, 'und wieder aufklappen');
  await p.click('[data-act="fl-serie"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !!document.querySelector('.fl-serie-pop .fl-sp-drop')), 'KI-Recherche: Ablagefeld gleich im kleinen Fenster (ohne vorher Förderer auszuwählen)');
  await p.evaluate(() => { const e = flEintrag('F002'); e.topfe = []; e.topfMig = false; UI.flWahl = null; changed(); renderNow(); });
  // gespeichert und wieder geladen: bleibt erhalten
  r = await p.evaluate(() => { const n = normalize(JSON.parse(JSON.stringify(D))); return [n.fl.liste.length, JSON.stringify(n.fl) === JSON.stringify(D.fl), n.bedarfe[0].foerderer[1].flAus.length, n.bedarfe[0].foerderer[3].flNein]; });
  ok(r.join('|') === '2|true|0|true', 'Speichern/Laden behält Fördererliste und Merker: ' + r.join('|'));
  await finish(b, [p]);
})();
