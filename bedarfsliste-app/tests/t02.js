// Speichern im Ordner: automatisch nach Änderungen, Datei öffnet mit den Daten, Änderung von außen wird geladen, zwei Stände werden erkannt
const { chromium, ok, open, skip, readF, writeF, connect, dataOf, verOf, finish, fs, T } = require('./lib');
const setData = (text, d) => text.replace(/(<script type="application\/json" id="bl-data">)[\s\S]*?(<\/script>)/, (m, a, c) => a + JSON.stringify(d).replace(/</g, '\\u003c') + c);
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { clock: true });
  ok(await connect(p) === 'ok', 'Ordner verbunden');
  await p.click('button[data-act="new"]'); await p.keyboard.type('MTW'); await p.keyboard.press('Enter'); await p.keyboard.press('Escape');
  await skip(p, 2600);
  let t = await readF(p);
  ok(dataOf(t).bedarfe[0].titel === 'MTW' && verOf(t) === T.VERSION, 'automatisch gespeichert (Version ' + verOf(t) + ')');
  ok(await p.$eval('#savebox', e => e.classList.contains('ok') && e.title.startsWith('Gespeichert')), 'Diskette zeigt „Gespeichert“');
  fs.writeFileSync('Bedarfsliste.html', t);
  const q = await open(b, { file: process.cwd() + '/Bedarfsliste.html', fakefs: false });
  ok(await q.evaluate(() => D.bedarfe[0].titel) === 'MTW', 'gespeicherte Datei öffnet mit den Daten');
  // Änderung von außen (z. B. am zweiten Rechner gespeichert)
  let d = dataOf(t); d.bedarfe[0].titel = 'MTW (anderer Rechner)'; d.meta.savedAt = '2099-01-01T00:00:00.000Z';
  await writeF(p, setData(t, d)); await skip(p, 15500);
  ok(await p.evaluate(() => D.bedarfe[0].titel) === 'MTW (anderer Rechner)', 'Änderung von außen geladen');
  // zwei Stände: hier ungespeichert, dort neu gespeichert
  await p.evaluate(() => { document.activeElement.blur(); D.bedarfe[0].beschreibung = 'lokal'; changed(); });
  d = dataOf(await readF(p)); d.bedarfe[0].titel = 'dort'; d.meta.savedAt = '2099-02-01T00:00:00.000Z';
  await writeF(p, setData(t, d)); await skip(p, 2600);
  ok(await p.evaluate(() => !!ST.conflict) && (await p.$eval('.banners', e => e.textContent)).includes('woanders gespeichert'), 'zwei Stände erkannt, Hinweis oben');
  await p.click('button[data-act="conflict-mine"]'); await p.waitForTimeout(300);
  d = dataOf(await readF(p));
  ok(d.bedarfe[0].beschreibung === 'lokal' && !(await p.evaluate(() => !!ST.conflict)), 'meinen Stand behalten: gespeichert');
  await finish(b, [p, q]);
})();
