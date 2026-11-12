// 0.53.4/0.53.5: leeres Feld bei Maßnahmen mit Detailplan sieht aus wie jedes leere Feld; Termin-Hinweise „stimmt so“ ausblenden (je Termin und Datum, für alle), wieder anzeigen
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1700 }); pages.push(p);
  // ---- A: Feiertag am PAL
  const mid = await p.evaluate(() => { const t = JSON.parse(JSON.stringify(D.massnahmen[0]));
    commit(d => { d.massnahmen.push(Object.assign(t, { id: 'lj', name: 'Landesjugend-Lager', pal: '2027-05-27', palStatus: 'fest', vorlauf: {}, ende: {}, plan: null })); });
    UI.year = 2027; UI.view = 'jahr'; UI.secOpen = { mass: true }; UI.startView = 'date'; UI.phMini = false; renderNow(); return 'lj'; });
  const ws = () => p.evaluate(() => C.warnings.filter(w => w.mid === 'lj').map(w => w.text));
  ok((await ws()).some(t => /Feiertag „Fronleichnam“/.test(t)), 'A: Warnung „PAL fällt auf den Feiertag Fronleichnam“');
  await p.click('.warnbtn'); await p.waitForTimeout(200);
  const btn = '.warnpanel .witem:has-text("Landesjugend-Lager") .wok';
  ok(await p.evaluate(() => [...document.querySelectorAll('.warnpanel .witem')].some(e => /Landesjugend/.test(e.textContent) && /stimmt so/.test(e.textContent))), 'A: im Fenster „Warnungen“ ein Knopf „✓ stimmt so“');
  const n0 = await p.evaluate(() => C.warnings.filter(w => w.lvl === 'warn').length);
  await p.click(btn); await p.waitForTimeout(250);
  const a1 = await p.evaluate(() => [C.warnings.filter(w => w.lvl === 'warn').length, JSON.stringify(D.massnahmen.find(m => m.id === 'lj').okW), C.warnOk.length, !!document.querySelector('.warnpanel .wokd'), document.querySelector('tr[data-m="lj"] td.warns')?.textContent || '']);
  ok(a1[0] === n0 - 1 && a1[1] === '["P:2027-05-27"]' && a1[2] === 1 && a1[3] && a1[4] === '', 'A: bestätigt – Warnung weg (auch in der Tabelle), unter „Als stimmt so bestätigt (1)“ ' + JSON.stringify(a1));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  ok((await ws()).length === 1, 'A: Strg+Z nimmt es zurück');
  await p.keyboard.press('Control+y'); await p.waitForTimeout(200);
  // ---- B: Termin verschoben → Hinweis kommt wieder (anderer Feiertag); zurück → wieder bestätigt
  await p.evaluate(() => commit(d => { d.massnahmen.find(m => m.id === 'lj').pal = '2027-05-25'; })); await p.waitForTimeout(150);
  ok(!(await ws()).length, 'B: an einem Werktag kein Hinweis');
  await p.evaluate(() => commit(d => { d.massnahmen.find(m => m.id === 'lj').pal = '2027-05-16'; })); await p.waitForTimeout(150);
  ok((await ws()).some(t => /Pfingstsonntag|Sonntag/.test(t)), 'B: anderes Datum mit Feiertag – Hinweis kommt wieder (Bestätigung gilt nur für 27.05.)');
  await p.evaluate(() => commit(d => { d.massnahmen.find(m => m.id === 'lj').pal = '2027-05-27'; })); await p.waitForTimeout(150);
  ok(!(await ws()).length, 'B: zurück auf 27.05. – weiter bestätigt');
  // ---- C: wieder anzeigen; gespeichert/normalisiert
  if (!await p.$('.warnpanel')) { await p.click('.warnbtn'); await p.waitForTimeout(150); }
  await p.click('.warnpanel .wokd summary'); await p.click('.warnpanel .wokd .wunok'); await p.waitForTimeout(250);
  ok((await ws()).length === 1 && await p.evaluate(() => !D.massnahmen.find(m => m.id === 'lj').okW), 'C: „wieder anzeigen“ holt die Warnung zurück');
  ok(await p.evaluate(() => { const d = JSON.parse(JSON.stringify(D)); d.massnahmen.find(m => m.id === 'lj').okW = ['P:2027-05-27', 'P:2027-05-27', 'kaputt', 5]; return JSON.stringify(normalize(d).massnahmen.find(m => m.id === 'lj').okW); }) === '["P:2027-05-27"]',
    'C: Einlesen bereinigt die Liste');
  // ---- D: Detailplan ohne Abschnitt – leeres Feld wie alle anderen (Datum: Strich mit Kalender-Feld, Werktage: „– WT“)
  await p.keyboard.press('Escape'); await p.evaluate(() => { commit(d => { d.settings.bereiche.push({ key: 'L', name: 'Laufzeit', nach: true }); }); UI.warnOpen = false; UI.phMiniN = false; UI.startViewN = 'date'; renderNow(); }); await p.waitForTimeout(150);
  const d0 = await p.evaluate(() => { const td = document.querySelector('td.ph.derived-date'); const plain = [...document.querySelectorAll('td.ph:not(.derived-date)')].find(t => t.querySelector('input.noval'));
    if (!td || !plain) return null; const a = td.querySelector('input'), b = plain.querySelector('input'); return [!!a && a.classList.contains('noval') && a.readOnly, Math.round(a.getBoundingClientRect().width) === Math.round(b.getBoundingClientRect().width), getComputedStyle(a).backgroundImage === getComputedStyle(b).backgroundImage]; });
  ok(d0 && d0.every(Boolean), 'D: Detailplan ohne diesen Bereich – dasselbe leere Feld wie in anderen Zeilen (nur nicht änderbar) ' + JSON.stringify(d0));
  await finish(b, pages);
})();
