// 0.78: ohne Schritt „Abgeschlossen“; Nacharbeit erledigt → Frage „ins Archiv?“ (sonst in 30 Tagen von selbst); Menü ohne „Spaltenbreiten“;
// Suche: Enter springt in den ersten Bedarf; Sprung aus den Hinweisen leuchtet in der Farbe des Hinweises; Ordner per Ziehen
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  await p.evaluate(() => {
    const fast = (id, titel, gl) => { const x = Object.assign(blank(), { id, titel, summe: 1000, gliederung: gl });
      for (const k of ['ofk', 'fach', 'verw']) x.freigabe[k].st = 'ok'; x.freigabe.fach.name = 'Ausbildung';
      x.foerderer.push(ff({ name: 'Stiftung A', status: 'zugesagt', betrag: 1000, zugesagt: 1000, eingegangen: 1000 })); x.foerderer[0].vn.st = 'erledigt';
      x.nach.ueb.st = 'terminiert'; return x; };
    const a = fast('a', 'Zelt Brakel', 'Brakel'), c = fast('c', 'Schon fertig', 'Brakel'); c.nach.ueb.st = 'erledigt';
    a.pfad = ''; const d = fast('d', 'Funk Brakel', 'Brakel'); d.link = 'https://x.sharepoint.com/sites/f/Freigegebene%20Dokumente/Forms/AllItems.aspx?id=' + encodeURIComponent('/sites/f/Freigegebene Dokumente/Ortsgliederungen/Brakel/Funk');
    for (const x of [a, c, d]) delete x.fertigGefragt;   // wie ältere Daten
    D = normalize({ bedarfe: [a, c, d, Object.assign(blank(), { id: 'p', titel: 'Paderborner Zelt', gliederung: 'Paderborn' })] }); SAVED_JSON = JSON.stringify(D); undoReset(); renderNow();
  });
  // ältere Daten: schon erledigte Bedarfe nicht nachträglich fragen
  ok(await p.evaluate(() => D.bedarfe.find(x => x.id === 'c').fertigGefragt === true && D.bedarfe.find(x => x.id === 'a').fertigGefragt === false), 'beim Laden: schon erledigte gelten als gefragt');
  // Schritte ohne „Abgeschlossen“
  await p.evaluate(() => oeffnen('a')); await p.waitForTimeout(150);
  let r = await p.evaluate(() => [...document.querySelectorAll('.steps li')].map(l => l.textContent.trim()).join(','));
  ok(r === '1Freigabe,2Förderung,3Nacharbeit' || /^Freigabe,Förderung,Nacharbeit$/.test(r.replace(/\d/g, '')), 'drei Schritte, ohne „Abgeschlossen“: ' + r);
  // Übergabe erledigt → Frage
  await p.evaluate(() => { cur().nach.ueb.st = 'erledigt'; changed(); renderNow(); }); await p.waitForTimeout(800);
  r = await p.evaluate(() => [document.querySelector('.modal h2') && document.querySelector('.modal h2').textContent, !!document.querySelector('.modal .fertig-auto input:checked')]);
  ok(r.join('|') === 'Bedarf abgeschlossen|true', 'Nacharbeit erledigt: Frage, Häkchen „in 30 Tagen“ gesetzt: ' + r.join('|'));
  await p.click('.modal footer button:not(.primary)'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const x = cur(); return [x.archiv, x.autoArchiv === isoDate(new Date(Date.now() + 30 * 864e5)), phase(x).sub]; });
  ok(r[0] === false && r[1] === true && /von selbst ins Archiv/.test(r[2]), '„Später“: in 30 Tagen von selbst: ' + r.join('|'));
  // wieder etwas offen → gilt nicht mehr; erneut erledigt → erneut gefragt, „Jetzt archivieren“
  await p.evaluate(() => { cur().nach.ueb.st = 'terminiert'; changed(); }); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !cur().autoArchiv && !cur().fertigGefragt && !document.querySelector('.modal')), 'wieder offen: automatisches Archivieren entfällt');
  await p.evaluate(() => { cur().nach.ueb.st = 'erledigt'; changed(); }); await p.waitForTimeout(800);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => D.bedarfe.find(x => x.id === 'a').archiv && UI.view === 'list'), '„Jetzt archivieren“: im Archiv, zurück in der Liste');
  // Tag gekommen: von selbst ins Archiv
  await p.evaluate(() => { const x = D.bedarfe.find(y => y.id === 'c'); x.autoArchiv = '2020-01-01'; autoArchivieren(); });
  ok(await p.evaluate(() => D.bedarfe.find(x => x.id === 'c').archiv), 'Tag gekommen: von selbst ins Archiv');
  // Menü ohne Spaltenbreiten
  await p.evaluate(() => { colwSet([100, 100, 100, 100, 100, 100, 100, 100], false); renderNow(); });
  await p.click('header.top [data-act="menu"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !!document.querySelector('#mmenu') && !document.querySelector('[data-act="colw-reset"]')), 'Menü: „Spaltenbreiten zurücksetzen“ ist weg');
  r = await p.evaluate(() => [...document.querySelectorAll('#mmenu > button')].map(b => b.textContent.trim()).join('/'));
  ok(/^(Programm-Update einspielen …\/)?Einstellungen …$/.test(r) && true, '0.134: Zahnrad schlank – nur Darstellung, Update und Einstellungen: ' + r);
  await p.click('#mmenu [data-act="einst"]'); await p.waitForSelector('.einst-modal');
  r = await p.evaluate(() => [[...document.querySelectorAll('.einst-g h3')].map(x => x.textContent).join('/'), [...document.querySelectorAll('.einst-e')].map(x => x.dataset.k).join(','), !/Kontakte für die Personenliste|Vorlage/.test(document.querySelector('.einst').textContent) || !/UPL-Vorlage|Förderplan-Vorlage/.test(document.querySelector('.einst').textContent)]);
  ok(r[0].startsWith('Personen/E-Mail/Bedienung') && r[1].startsWith('pers-liste,vorlagen,tasten') && !/konten-ein|adressen-alle|fach-haupt/.test(r[1]) && r[2], 'Fenster „Einstellungen“ mit Gruppen, ohne Kontakte-Import und Vorlagen: ' + r.join(' | '));
  await p.click('.einst-modal .einst-e[data-k="tasten"]'); await p.waitForSelector('.modal table.tasten');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('.einst-modal')), 'Nach dem Schließen eines Fensters zurück in die Einstellungen');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  // 0.135: Personenliste neu – Gruppen links, Karten rechts, Stern im Fachreferat; kein Mitscrollen im Hintergrund
  await p.evaluate(() => { const P = (n, rolle, gl, fach) => ({ n, rolle, gl, fach, mail: n.split(' ')[0].toLowerCase() + '@x.example', tel: '', mobil: '' });
    personenSetzen([P('Anna Beispiel', 'Referentin', 'Diözese', 'Soziales Ehrenamt'), P('Ben Muster', 'Sachbearbeitung', 'Diözese', 'Soziales Ehrenamt'), P('Clara Exempel', 'Koordination', 'Hagen', 'Soziales Ehrenamt'),
      P('Erik Test', 'Referent', 'Diözese', 'Notfallvorsorge'), P('Frieda Muster', 'Leitung', 'Brakel', ''), P('Georg Beispiel', 'Beauftragter', 'Paderborn', ''), P('Hanna Probe', 'Leitung', 'Paderborn', 'Notfallvorsorge'), P('Ida Muster', '', 'Büren', ''), P('Jan Test', '', '', '')]);
    personenListeDialog(); }); await p.waitForSelector('.pl2-modal');
  r = await p.evaluate(() => [document.querySelectorAll('.pl2-nav .pl2-ni').length > 3, document.querySelectorAll('.pl2-karten .pl2-k').length, getComputedStyle(document.documentElement).overflow]);
  ok(r[0] && r[1] === 9 && r[2] === 'hidden', 'Personenliste: Gruppen links, alle 9 Personen als Karten, Seite dahinter scrollt nicht: ' + r.join('|'));
  await p.click('.pl2-ni:has-text("Soziales Ehrenamt")'); await p.waitForTimeout(80);
  r = await p.evaluate(() => [document.querySelectorAll('.pl2-k').length, document.querySelectorAll('.pl2-st').length]);
  ok(r.join() === '3,3', 'Fachreferat Soziales Ehrenamt: 3 Personen, jede mit Stern: ' + r.join());
  await p.click('.pl2-k:has-text("Ben Muster") .pl2-st'); await p.waitForTimeout(50);
  ok(await p.evaluate(() => document.querySelector('.pl2-k.haupt b').textContent) === 'Ben Muster', 'Stern macht Ben Muster zur Hauptansprechperson');
  await p.hover('.pl2-k:has-text("Clara Exempel")'); await p.click('.pl2-k:has-text("Clara Exempel") .pl2-pen');
  await p.fill('.pl2-form .pl2-f-rolle input', 'Koordination Besuchsdienst'); await p.click('.pl2-form button.primary');
  await p.click('.pl2-modal footer button.primary'); await p.waitForTimeout(200);
  r = await p.evaluate(() => [D.settings.fachHaupt['soziales ehrenamt'] === kkey('Ben Muster'), PR.list.find(x => x.n === 'Clara Exempel').rolle, getComputedStyle(document.documentElement).overflow]);
  ok(r.join('|') === 'true|Koordination Besuchsdienst|visible', 'Speichern: Hauptansprechperson und geänderte Position übernommen, Seite scrollt wieder: ' + r.join('|'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  await p.keyboard.press('Escape'); await p.evaluate(() => { colwSet(null, false); renderNow(); });
  // Suche + Enter → erster Bedarf
  await p.keyboard.press('Control+f'); await p.keyboard.type('Brakel'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.activeElement.closest && document.activeElement.closest('tr') ? document.activeElement.closest('tr').dataset.id : document.activeElement.id, document.querySelectorAll('#list-body tr[data-id]').length]);
  ok(r.join('|') === 'd|1', 'Suche + Enter: Fokus im ersten gefundenen Bedarf: ' + r.join('|'));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => UI.view === 'detail' && UI.id === 'd'), 'danach gehen die Tasten wieder in der Liste (→ öffnet)');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  await p.evaluate(() => { UI.q = ''; renderNow(); });
  // Sprung aus den Hinweisen: Farbe
  r = await p.evaluate(() => { const L = []; for (const f of ['gelb', 'info', undefined]) { const el = document.createElement('span'); document.body.append(el); blitz([el], f); L.push(el.className); el.remove(); } return L.join(','); });
  ok(r === 'blitz b-gelb,blitz b-info,blitz', 'Aufleuchten in der Farbe des Hinweises: ' + r);
  // Ordner per Ziehen: Link als Text direkt, Ordner aus dem Explorer: Vorschlag aus ähnlichen Bedarfen
  await p.evaluate(() => oeffnen('p')); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !!document.querySelector('.o-link')), 'Feld „OneDrive / SharePoint“ nimmt Gezogenes an');
  await p.evaluate(() => ordnerAblegen(cur(), { txt: 'https://x.sharepoint.com/sites/f/Ordner', name: '', eintrag: null }));
  ok(await p.evaluate(() => cur().link === 'https://x.sharepoint.com/sites/f/Ordner'), 'Link aus dem Browser: direkt übernommen');
  await p.evaluate(() => { cur().gliederung = 'Brakel'; void ordnerAblegen(cur(), { txt: '', name: 'Zelt', eintrag: { isDirectory: true, name: 'Zelt' }, hnd: null }); }); await p.waitForTimeout(200);
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, document.querySelector('.modal input.tf-feld').value, /Ortsgliederungen%2FBrakel%2FZelt|Ortsgliederungen\/Brakel\/Zelt/.test(document.querySelector('.or-vor').textContent)]);
  ok(r.join('|') === 'Wo liegt „Zelt“?|Ortsgliederungen\\Brakel|true', 'Ordner aus dem Explorer: Ort vorgeschlagen (wie beim ähnlichen Bedarf), Link in der Vorschau: ' + r.join('|'));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /Brakel%2FZelt/.test(cur().link) && cur().pfad === 'Ortsgliederungen\\Brakel\\Zelt'), 'übernommen: Link und Pfad');
  await finish(b, [p]);
})();
