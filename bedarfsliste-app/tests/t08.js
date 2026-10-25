// Datensicherheit (0.34): Speichern während des Tippens, Beträge mit Punkt, „31. März“ bleibt Text, fremde Stände nur mit Rückfrage,
// Entwurf bleibt bis zur Entscheidung, Update und „Meinen Stand behalten“ achten auf Konflikt und neuere Version, Doppelklick,
// Förderer-Stand ohne Altlasten, kein Neuzeichnen mitten im Tippen, „Rückgängig“ nur für die eine Aktion, zweiter Tab
const { chromium, ok, open, readF, writeF, connect, dataOf, finish, fs, T } = require('./lib');
const setData = (text, d) => text.replace(/(<script type="application\/json" id="bl-data">)[\s\S]*?(<\/script>)/, (m, a, c) => a + JSON.stringify(d).replace(/</g, '\\u003c') + c);
(async () => {
  const b = await chromium.launch();
  const p = await open(b);
  ok(await connect(p) === 'ok', 'Ordner verbunden');
  await p.evaluate(() => { D.bedarfe.push(Object.assign(blank(), { id: 'b1', titel: 'Eins' }), Object.assign(blank(), { id: 'b2', titel: 'Zwei' })); changed(); });
  await p.evaluate(() => saveAll());

  // 1. Tippen während des Speicherns: gilt nicht als gespeichert, bleibt im Entwurf und wird nachgespeichert
  let r = await p.evaluate(async () => {
    const orig = ST.html.createWritable.bind(ST.html);
    ST.html.createWritable = async () => { const w = await orig(); return { write: d => w.write(d), close: async () => { await new Promise(x => setTimeout(x, 400)); return w.close(); } }; };
    D.bedarfe[0].titel = 'A'; changed();
    const pr = saveAll(); await new Promise(x => setTimeout(x, 100));
    D.bedarfe[0].titel = 'B'; changed();
    await pr; ST.html.createWritable = orig;
    const dr = JSON.parse(localStorage.getItem(draftKey()) || 'null');
    return [isDirty(), dr && dr.data.bedarfe[0].titel];
  });
  ok(r.join('|') === 'true|B', 'während des Speicherns getippt: bleibt „ungespeichert“ und im Entwurf: ' + r.join('|'));
  await p.waitForTimeout(2600);
  r = dataOf(await readF(p)).bedarfe[0].titel;
  ok(r === 'B' && !(await p.evaluate(() => isDirty())), 'kurz danach nachgespeichert: ' + r);
  // Datei direkt nach dem Schreiben kurz gesperrt (OneDrive): trotzdem gespeichert, kein falscher Konflikt
  r = await p.evaluate(async () => {
    const orig = ST.html.createWritable.bind(ST.html);
    ST.html.createWritable = async () => { const w = await orig(); return { write: d => w.write(d), close: async () => { await w.close(); __fs.unreadable = 'Bedarfsliste.html'; setTimeout(() => { __fs.unreadable = null; }, 300); } }; };
    D.bedarfe[0].titel = 'C'; changed(); const okk = await saveAll(); ST.html.createWritable = orig;
    await new Promise(x => setTimeout(x, 400));
    D.bedarfe[0].titel = 'D'; changed(); const ok2 = await saveAll();
    return [okk, ok2, !!ST.conflict, isDirty()];
  });
  ok(r.join('|') === 'true|true|false|false', 'Datei nach dem Schreiben kurz gesperrt: gespeichert, danach kein falscher Konflikt: ' + r.join('|'));

  // 2. Beträge mit Punkt oder englisch
  r = await p.evaluate(() => ['1500.00', '99.9', '1.500', '1.500.50', '1,500.00', '15,000', '10.000 Euro', '1.234,50', '1,5', '12.5 €'].map(deNum).join(' '));
  ok(r === '1500 99.9 1500 1500.5 1500 15000 10000 1234.5 1.5 12.5', 'Zahlen: Dezimalpunkt, englisch, „Euro“: ' + r);
  r = await p.evaluate(() => { const i = document.createElement('input'); const live = v => { i.value = v; liveNum(i); return i.value; };
    return [live('1500.'), live('1500.0'), live('1500.00'), live('1,500.00'), live('15000'), live('1.50'), live('1.500')].join(' '); });
  ok(r === '1500. 1500.0 1500.00 1.500,00 15.000 1.50 1.500', 'beim Tippen: Dezimalpunkt bleibt stehen, Tausender wie gewohnt: ' + r);
  await p.evaluate(() => oeffnen('b2')); await p.waitForTimeout(150);
  await p.fill('.d-right-head input[data-p="summe"]', ''); await p.type('.d-right-head input[data-p="summe"]', '1500.00'); await p.keyboard.press('Tab');
  r = await p.evaluate(() => D.bedarfe.find(x => x.id === 'b2').summe);
  ok(r === 1500, 'Summe „1500.00“ auf der Seite des Bedarfs getippt: ' + r);

  // 3. „31. März“ am Zeilenanfang bleibt Text, „1. 2. 3.“ bleibt eine Liste
  r = await p.evaluate(() => {
    const t1 = '31. März: Antragsschluss\n30. September: zweite Runde', t2 = '1. erstens\n2. zweitens', t3 = '2. Halbjahr beantragen', t4 = '1. März: Frist';
    const rund = t => { const d = document.createElement('div'); d.innerHTML = fmtText(t, true); return richText(d); };
    return [!/<ol/.test(fmtText(t1)), rund(t1) === t1, (fmtText(t2).match(/<li>/g) || []).length, rund(t2) === t2, !/<ol/.test(fmtText(t3)), !/<ol/.test(fmtText(t4))]; });
  ok(r.join() === 'true,true,2,true,true,true', '„31. März“, „2. Halbjahr“, „1. März“ bleiben Text, „1./2.“ eine Liste – unverändert beim Bearbeiten: ' + r.join());

  // 4. Stand von außen: leer, älter oder ohne Speicherdatum → Rückfrage statt still ersetzen; der verworfene Stand wird gesichert
  await p.evaluate(() => zurueck()); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const n = D.bedarfe.length, out = [];
    for (const o of [{ bedarfe: [], meta: { savedAt: '2099-01-01T00:00:00.000Z' } }, { bedarfe: [blank()], meta: { savedAt: '2000-01-01T00:00:00.000Z' } }, { bedarfe: [blank()] }]) {
      ST.conflict = null; externalChange(o, null); out.push(ST.conflict && ST.conflict.grund); }
    out.push(D.bedarfe.length === n); return out; });
  ok(r.join() === 'leer,aelter,ohne,true', 'leer / älter / ohne Speicherdatum: nicht still übernommen, sondern gefragt: ' + r.join());
  await p.evaluate(() => renderNow());
  ok((await p.$eval('.banners', e => e.textContent)).includes('ohne Speicherdatum'), 'Hinweis nennt den Grund');
  const dl = p.waitForEvent('download', { timeout: 3000 }).catch(() => null);
  await p.click('button[data-act="conflict-theirs"]');
  const d1 = await dl;
  ok(!!d1 && /Sicherung_.*mein-Stand\.json$/.test(d1.suggestedFilename()), '„Stand aus der Datei laden“: mein Stand wird vorher gesichert: ' + (d1 && d1.suggestedFilename()));
  await p.evaluate(() => { D = normalize({ bedarfe: [Object.assign(blank(), { id: 'b1', titel: 'Eins' }), Object.assign(blank(), { id: 'b2', titel: 'Zwei' })] }); changed(); renderNow(); });
  await p.evaluate(() => saveAll({ trotzKonflikt: true }));
  r = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(D)); o.bedarfe[0].titel = 'von drüben'; o.meta.savedAt = '2099-03-01T00:00:00.000Z'; externalChange(o, null); return [!ST.conflict, D.bedarfe[0].titel]; });
  ok(r.join('|') === 'true|von drüben', 'echter neuerer Stand ohne offene Änderungen: still übernommen wie bisher: ' + r.join('|'));

  // 9. offenes Schreibfeld: kein Neuzeichnen, fremder Stand wird nicht still übernommen
  await p.evaluate(() => oeffnen('b1')); await p.waitForTimeout(150);
  await p.evaluate(() => { const f = ff({ name: 'Stiftung X' }); cur().foerderer.push(f); changed(); renderNow(); });
  await p.click('.pe[data-k="warum"]'); await p.keyboard.type('wichtiger Grund');
  r = await p.evaluate(() => { safeRender(); const o = JSON.parse(JSON.stringify(D)); o.meta.savedAt = '2099-04-01T00:00:00.000Z'; o.bedarfe[0].titel = 'fremd'; externalChange(o, null);
    return [!!document.querySelector('.pe-in'), !!ST.conflict, D.bedarfe[0].titel]; });
  ok(r.join('|') === 'true|true|von drüben', 'beim Schreiben: Feld bleibt offen, fremder Stand wird erst angeboten: ' + r.join('|'));
  await p.keyboard.press('Escape'); await p.evaluate(() => { ST.conflict = null; UI.det = null; renderNow(); });

  // 6. Update: nicht bei offenem Konflikt, nicht über eine neuere Version im Ordner
  r = await p.evaluate(() => { ST.conflict = { other: { bedarfe: [] }, grund: 'leer' }; updateProgram({ text: 'x', name: 'x' }); const t = $('#toasts').textContent; ST.conflict = null; return t.includes('Erst den Hinweis oben klären'); });
  ok(r, 'Update bei offenem Konflikt: abgelehnt mit Hinweis');
  const orig = await readF(p);
  await writeF(p, orig.replace(/const APP_INFO = \{"version": "[^"]+"/, 'const APP_INFO = {"version": "99.0"'));
  await p.evaluate(t => { updateProgram({ text: t, name: 'Bedarfsliste.html' }); }, orig.replace(/const APP_INFO = \{"version": "[^"]+"/, 'const APP_INFO = {"version": "98.0"'));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(400);
  r = await p.$eval('.modal', e => e.textContent).catch(() => '');
  ok(r.includes('Update nicht nötig') && r.includes('99.0') && /"version": "99\.0"/.test(await readF(p)), 'Update 98.0, im Ordner liegt schon 99.0: nichts überschrieben: ' + r.slice(0, 80));
  await p.click('.modal footer button'); await writeF(p, orig);

  // 8. Förderer-Stand durchklicken: nichts bleibt hängen; ist das Geld da, kein Umschalten per Klick
  r = await p.evaluate(() => { const b = cur(), f = b.foerderer[0]; f.betrag = 2400; const L = [];
    for (let i = 0; i < 4; i++) { const alt = f.status, v = ROT_FOE[alt]; f.status = v; effects(b, f, 'status', v, alt); L.push(v); }
    const a = [f.status, f.zugesagt, f.eingegangen, f.beantragtAm, f.entscheidungAm];
    f.betrag = 3000; for (const v of ['beantragt', 'zugesagt']) { const alt = f.status; f.status = v; effects(b, f, 'status', v, alt); }
    return [L.join('>'), a.map(x => x == null ? '-' : x || '-').join(','), f.zugesagt]; });
  ok(r[1] === 'geplant,-,-,-,-' && r[2] === 3000, 'einmal rundherum: Zusage, Eingang und Daten weg; neue Zusage mit neuem Betrag: ' + JSON.stringify(r));
  r = await p.evaluate(() => { const b = cur(), f = b.foerderer[0]; f.status = 'zugesagt'; f.zugesagt = 3000; f.eingegangen = 3000; f.eingangAm = '2026-10-01'; changed(); UI.view = 'list'; renderNow(); return f.id; });
  await p.click(`#list-body tr[data-id="b1"] .fn[data-fid="${r}"]`).catch(() => p.click(`#list-body tr[data-id="b1"] [data-le="foe"][data-fid="${r}"]`));
  r = await p.evaluate(() => [D.bedarfe[0].foerderer[0].status, $('#toasts').textContent.includes('schon eingegangen')]);
  ok(r.join('|') === 'zugesagt|true', 'Geld schon eingegangen: Klick in der Liste schaltet nicht um, Hinweis: ' + r.join('|'));

  // 10. „Rückgängig“ nimmt nur die eine Aktion zurück
  await p.evaluate(() => oeffnen('b1')); await p.waitForTimeout(150);
  await p.click('button[data-act="more"]'); await p.click('#mmenu button[data-act="archive"]').catch(() => p.evaluate(() => act('archive', document.body)));
  await p.waitForSelector('.modal', { timeout: 2000 }).catch(() => null);
  r = await p.$eval('.modal', e => e.textContent).catch(() => '');
  ok(r.includes('Noch offen') && r.includes('Verwendungsnachweis'), 'Archivieren mit offenem Verwendungsnachweis: erst Rückfrage: ' + r.slice(0, 120));
  await p.click('.modal footer button.primary');
  await p.evaluate(() => { D.bedarfe.find(x => x.id === 'b2').beschreibung = 'danach geändert'; changed(); });
  await p.click('#toasts .toast:last-child button.link');
  r = await p.evaluate(() => [D.bedarfe.find(x => x.id === 'b1').archiv, D.bedarfe.find(x => x.id === 'b2').beschreibung]);
  ok(r.join('|') === 'false|danach geändert', 'Archivieren rückgängig: nur das, die spätere Änderung bleibt: ' + r.join('|'));

  // 5. Entwurf: bleibt beim Start beiseite, bis entschieden ist; Datei neuer als der Entwurf → erst fragen
  const t0 = await readF(p), d0 = dataOf(t0);
  fs.writeFileSync('Bedarfsliste.html', t0);
  const q = await open(b, { file: process.cwd() + '/Bedarfsliste.html' });
  await q.evaluate(([base]) => { const d = JSON.parse(JSON.stringify(D)); d.bedarfe[0].titel = 'aus dem Entwurf'; localStorage.setItem(draftKey(), JSON.stringify({ base, at: '2026-10-24T10:00:00.000Z', data: d })); }, [d0.meta.savedAt]);
  await q.reload(); await q.waitForTimeout(300);
  r = await q.evaluate(() => [!!DRAFT_OFFER, !!localStorage.getItem(offerKey()), !localStorage.getItem(draftKey())]);
  ok(r.join() === 'true,true,true', 'Entwurf aus der letzten Sitzung beiseitegelegt und angeboten: ' + r.join());
  r = await q.evaluate(() => { D.bedarfe[1].titel = 'neu getippt'; changed(); return [!!DRAFT_OFFER, JSON.parse(localStorage.getItem(offerKey())).data.bedarfe[0].titel]; });
  ok(r.join('|') === 'true|aus dem Entwurf', 'neue Änderung überschreibt den angebotenen Entwurf nicht: ' + r.join('|'));
  await q.evaluate(() => { DRAFT_OFFER.base = '2000-01-01T00:00:00.000Z'; restoreDraft(); }); await q.waitForTimeout(150);
  r = await q.$eval('.modal', e => e.textContent).catch(() => '');
  ok(r.includes('Die Datei ist neuer als diese Änderungen'), 'Datei nach dem Entwurf gespeichert: erst Rückfrage');
  const dl2 = q.waitForEvent('download', { timeout: 3000 }).catch(() => null);
  await q.click('.modal footer button.primary'); const d2 = await dl2;
  r = await q.evaluate(() => [D.bedarfe[0].titel, !DRAFT_OFFER, !localStorage.getItem(offerKey())]);
  ok(r.join('|') === 'aus dem Entwurf|true|true' && !!d2, 'trotzdem wiederhergestellt, der Stand der Datei vorher gesichert: ' + r.join('|'));

  // 5c. dieselbe Datei in zwei Tabs: Warnung
  const q2 = await q.context().newPage(); await q2.goto('file://' + process.cwd() + '/Bedarfsliste.html'); await q2.waitForTimeout(400);
  r = await Promise.all([q, q2].map(x => x.evaluate(() => !!ST.zweiTab && document.querySelector('.banners').textContent.includes('anderen Fenster oder Tab'))));
  ok(r.join() === 'true,true', 'zweiter Tab mit derselben Datei: Warnung in beiden: ' + r.join());
  await q2.close(); await q.waitForTimeout(300);
  ok(await q.evaluate(() => !ST.zweiTab), 'zweiter Tab geschlossen: Warnung weg');

  // 6b. „Meinen Stand behalten“, obwohl im Ordner eine neuere Version liegt: alte Version wird nicht zurückgeschrieben
  await q.evaluate(() => { window.saveAll = async () => { localStorage.setItem('t08-gespeichert', '1'); return true; }; ST.newer = { version: '99.0' }; ST.conflict = { other: { bedarfe: [] }, grund: 'leer' }; resolveConflict('mine'); }).catch(() => {});
  await q.waitForTimeout(800);
  r = await q.evaluate(() => [localStorage.getItem('t08-gespeichert'), !!DRAFT_OFFER]);
  ok(r[0] === null && r[1], '„Meinen Stand behalten“ bei neuerer Version im Ordner: nichts überschrieben, mein Stand kommt als Entwurf wieder: ' + r.join('|'));

  // 7. Doppelklick: der zweite Klick zählt nach Aufklappen/Öffnen nicht
  fs.writeFileSync('vorschau.html', '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(T.PREVIEW, 'utf8') + '</body></html>');
  const v = await open(b, { file: process.cwd() + '/vorschau.html', fakefs: false });
  await v.click('.seg.ansicht [data-v="kompakt"]');
  const vor = await v.evaluate(() => JSON.stringify(D.bedarfe.find(x => x.id === 'b-aed').freigabe));
  await v.dblclick('#list-body tr[data-id="b-aed"] td.k-fr .kz');
  r = await v.evaluate(v0 => [UI.auf, JSON.stringify(D.bedarfe.find(x => x.id === 'b-aed').freigabe) === v0], vor);
  ok(r.join('|') === 'b-aed|true', 'Doppelklick auf die Freigabe einer zugeklappten Zeile: klappt auf, ändert nichts: ' + r.join('|'));
  await v.keyboard.press('Escape'); await v.click('.seg.ansicht [data-v="voll"]');
  const n0 = await v.evaluate(() => D.bedarfe.find(x => x.id === 'b-kueche').foerderer.length);
  await v.$eval('#list-body tr[data-id="b-kueche"]', e => e.scrollIntoView({ block: 'center' }));
  const q3 = await (await v.$('#list-body tr[data-id="b-kueche"] td.l-meta')).boundingBox();
  await v.mouse.dblclick(q3.x + 3, q3.y + 3); await v.waitForTimeout(200);
  r = await v.evaluate(n => [UI.view, D.bedarfe.find(x => x.id === 'b-kueche').foerderer.length === n, !document.querySelector('.modal')], n0);
  ok(r.join('|') === 'detail|true|true', 'Doppelklick neben ein Wort: öffnet den Bedarf, der zweite Klick löst dort nichts aus: ' + r.join('|'));

  await finish(b, [p, q, v]);
})();
