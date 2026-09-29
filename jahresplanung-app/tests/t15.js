const { chromium } = require('./pw');
const T = require('./common');
const fs = require('fs');
const NEW = T.HTML;
const OLD = require('path').join(T.FIXTURES, 'app_0.4.html');
const ok = (c, m) => console.log((c ? 'OK   ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(); const errs = [];
  // alte 0.4-Datei mit „eigenen Daten“ erzeugen
  let old = fs.readFileSync(OLD, 'utf8');
  old = old.replace(/("hinweis": ?")[^"]*(")/, '$1MEINE DATEN 0.4$2');
  fs.writeFileSync('alt_mit_daten.html', old);
  // ---------- Weg C: neue Datei öffnen, Daten aus alter Datei übernehmen
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript({ path: T.FAKEFS });
  const p = await ctx.newPage(); p.setDefaultTimeout(6000);
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + NEW); await p.waitForTimeout(400);
  const neu = fs.readFileSync(NEW, 'utf8');
  await p.evaluate(t => { __fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'] = { data: new TextEncoder().encode(t), lm: 1000 }; }, neu);
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Daten aus anderer Datei")'); await p.waitForTimeout(100);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.modal footer button.primary')]);
  await fc.setFiles('alt_mit_daten.html'); await p.waitForTimeout(300);
  const imp = await p.evaluate(() => [APP_INFO.version, D.massnahmen.some(m => m.hinweis === 'MEINE DATEN 0.4'), isDirty()]);
  ok(imp[0] === T.VERSION && imp[1], 'Weg C: neue Version ' + imp[0] + ' übernimmt Daten aus der alten Datei: ' + imp[1]);
  await p.click('#savebox'); await p.waitForTimeout(200); if (await p.$('.modal')) await p.click('.modal footer button.primary'); await p.waitForTimeout(800);
  const saved = await p.evaluate(() => new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data));
  ok(saved.includes('"version": "' + T.VERSION + '"') && saved.includes('MEINE DATEN 0.4'), 'Weg C: im Ordner gespeichert – Version 0.6 mit den alten Daten');

  // ---------- Update-Funktion 0.6 → 0.6: Erfolg mit Prüfung
  fs.writeFileSync('upd_0.6.html', neu.replace('const APP_INFO = {"version": "' + T.VERSION + '"', 'const APP_INFO = {"version": "' + T.NEWER + '"'));
  await p.evaluate(() => { window.__reloads = 0; });
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Programm-Update")'); await p.waitForTimeout(100);
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('.modal footer button.primary')]);
  await fc2.setFiles('upd_0.6.html'); await p.waitForTimeout(200);
  await Promise.all([p.waitForEvent('download'), p.click('.modal footer button.primary')]);
  await p.waitForTimeout(400);
  const s2 = await p.evaluate(() => new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data)).catch(() => null);
  const toast = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') + ' · ' + (document.querySelector('.modal h2') ? document.querySelector('.modal h2').textContent : '')).catch(() => '(neu geladen)');
  ok(s2 && s2.includes('"version": "' + T.NEWER + '"') && s2.includes('MEINE DATEN 0.4'), 'Update-Funktion: 0.6 mit Daten im Ordner · ' + toast);
  await ctx.close();

  // ---------- Update-Funktion: Ordnerwahl abgebrochen → klare Meldung + Download-Ausweg
  const ctx2 = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  await ctx2.addInitScript({ path: T.FAKEFS });
  const q = await ctx2.newPage(); q.setDefaultTimeout(6000); q.on('pageerror', e => errs.push(e.message));
  await q.goto('file://' + NEW); await q.waitForTimeout(400);
  await q.click('header .actions .menu-btn:has-text("⋯")'); await q.click('.menu button:has-text("Programm-Update")'); await q.waitForTimeout(100);
  const [fc3] = await Promise.all([q.waitForEvent('filechooser'), q.click('.modal footer button.primary')]);
  await fc3.setFiles('upd_0.6.html'); await q.waitForTimeout(200);
  await q.click('.modal footer button.primary'); await q.waitForTimeout(200);          // Übernehmen → „Speicherort wählen“
  await q.click('.modal footer button:has-text("Abbrechen")'); await q.waitForTimeout(200);
  const msg = await q.evaluate(() => document.querySelector('.modal') ? document.querySelector('.modal').innerText.replace(/\n+/g, ' / ') : '');
  const [dl] = await Promise.all([q.waitForEvent('download'), q.click('.modal button:has-text("Aktualisierte Datei herunterladen")')]);
  const f = fs.readFileSync(await dl.path(), 'utf8');
  ok(/Update nicht gespeichert/.test(msg) && dl.suggestedFilename() === 'Jahresplanung_Aussenkommunikation.html' && f.includes('"version": "' + T.NEWER + '"'),
    'Abbruch: Meldung „' + msg.slice(0, 110) + '…“, Download ' + dl.suggestedFilename() + ' mit Version 0.6');
  const inPage = await q.evaluate(v => $('#jp-app').textContent.includes('"version": "' + v + '"'), T.VERSION);
  ok(inPage, 'nach Fehlschlag bleibt das laufende Programm unverändert (kein halbes Update beim nächsten Speichern)');
  console.log('ERR', errs.join(' | ') || 'keine'); await b.close();
})();
