// 0.13: drei Reiter (Jahresplanung mit Zeitleiste und „Was steht an?“, Detailpläne, Auswertung); Urlaub & Feiertage über ⋯ und Einstellungen;
// Mausrad blättert weiter, Zeitleiste ohne eigene Filter, Detailpläne nur mit PAL im gewählten Jahr, wenn das Blättern außerhalb der Zeitleiste begann; „Prüfen“ als Korb; Alle markieren; Update direkt aus dem ZIP-Paket
const { chromium, ok, open, connect, finish, fs, T, ORIG } = require('./lib');
const { execSync } = require('child_process');
const DIR = 'Spendeneingänge 2027/';
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
let n = 0;
const line = (d, b, name, zweck) => [d, d, b, "'TESTDE11XXX", 'DE0010000000000000' + String(++n).padStart(4, '0'), name, "'Zugang/Gutschrift", zweck, "'Spendengutschrift", "'Paderborn - Test"].join(';');
const EXPORT = '﻿' + [HEAD, line('28.08.2027', '20', 'Anna Probe', 'Spende'), line('29.08.2027', '25', 'Bernd Probe', 'JB danke'), line('30.08.2027', '30', 'Carla Probe', 'Danke'),
  line('31.08.2027', '35', 'Dora Probe', 'Gruss')].join('\r\n') + '\r\n';
const writeBytes = (p, name, bytes, lm) => p.evaluate(([nm, b, l]) => { __fs.files['/Mailing/' + nm] = { data: new Uint8Array(b), lm: l || 80000 + (++__fs.n) }; }, [name, [...bytes], lm]);
// ZIP-Paket wie aus build.py: Startdatei + Programmdatei
const mkZip = (out, html) => {
  fs.writeFileSync('upd_inner.html', html);
  execSync('python3 -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],\'w\',zipfile.ZIP_DEFLATED); z.writestr(\'Jahresplanung starten.cmd\',\'@echo off\'); z.write(\'upd_inner.html\',\'Jahresplanung_Aussenkommunikation.html\'); z.close()" ' + out);
  return fs.readFileSync(out);
};
const withVer = v => ORIG.replace('const APP_INFO = {"version": "' + T.VERSION + '"', 'const APP_INFO = {"version": "' + v + '"');
const savedVer = p => p.evaluate(() => (new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data).match(/const APP_INFO = \{"version": "([^"]+)"/) || [])[1]);
const savedHas = (p, t) => p.evaluate(t => new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data).includes(t), t);

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(() => { UI.year = 2027; UI.view = 'jahr'; renderNow(); }); await p.waitForTimeout(200);

  // ---- A: drei Reiter; Jahresplanung = Maßnahmen, Zeitleiste (eingeklappt), Kalender, Was steht an?
  const a = await p.evaluate(() => [[...document.querySelectorAll('nav.tabs .tab')].map(t => t.childNodes[0].textContent).join('|'), [...document.querySelectorAll('#main > .sec')].map(s => s.dataset.sec).join(','),
    document.querySelector('[data-sec="tl"]').classList.contains('closed'), !document.querySelector('.tl'), document.querySelector('[data-sec="tl"] .sec-t').textContent]);
  ok(a[0] === 'Jahresplanung|Detailpläne|Auswertung' && a[1] === 'mass,tl,kal,ag' && a[2] && a[3] && a[4] === 'Zeitleiste 2027',
    'A: Reiter „' + a[0] + '“; Jahresplanung: ' + a[1] + ' – Zeitleiste anfangs eingeklappt');
  await p.click('[data-sec="tl"] .sec-tog'); await p.waitForTimeout(250);
  const a2 = await p.evaluate(() => [document.querySelectorAll('.tl .tl-row[data-m]').length, !!document.querySelector('[data-sec="tl"] .fbtn'), UI.secOpen.tl, !!document.querySelector('[data-sec="kal"] .cal, [data-sec="kal"] .month')]);
  ok(a2[0] > 5 && a2[1] && a2[2] === true, 'A: aufgeklappt – Gantt mit ' + a2[0] + ' Maßnahmen und Filter (Maßnahmen, Urlaub) direkt unter der Tabelle');
  ok(await p.evaluate(() => OLD_VIEWS.zeit === 'jahr' && !VIEWS.some(v => v[0] === 'zeit' || v[0] === 'urlaub')), 'A: gespeicherte alte Ansicht „Zeitleiste“ öffnet die Jahresplanung');

  // ---- A3: ohne Anzahl „N Maßnahmen“, Zeitleiste ohne „Maßnahmen: alle“ und „Detailpläne“, „Urlaub“ rechts, eingeklappt ohne Text
  const a3 = await p.evaluate(() => [document.querySelector('[data-sec="mass"] .sec-h').textContent, [...document.querySelectorAll('[data-sec="tl"] .sec-h .tools')].map(t => (t.classList.contains('lead') ? 'L:' : 'R:') + t.textContent).join(' | ')]);
  ok(!/\d+ Maßnahmen/.test(a3[0]) && /^R:Urlaub: an/.test(a3[1]) && !/Maßnahmen:|Detailpläne/.test(a3[1]), 'A: Kopf „' + a3[0].slice(0, 40) + '“ ohne Anzahl; Zeitleiste: ' + a3[1].slice(0, 50));
  await p.click('[data-sec="tl"] .sec-tog'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('[data-sec="tl"] .sec-sum')), 'A: eingeklappte Zeitleiste ohne Zusatztext');
  await p.click('[data-sec="tl"] .sec-tog'); await p.waitForTimeout(200);

  // ---- B: Mausrad – Blättern, das außerhalb begann, läuft über die Zeitleiste weiter; nach kurzer Pause zoomt es
  await p.evaluate(() => document.querySelector('.tl').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  const px0 = await p.evaluate(() => UI._tl.pxd), y0 = await p.evaluate(() => scrollY);
  const hb = await (await p.$('[data-sec="tl"] .sec-h')).boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + 10); await p.mouse.wheel(0, 120); await p.waitForTimeout(60);
  const tb = await p.evaluate(() => { const r = document.querySelector('.tl-bodywrap').getBoundingClientRect(); return { x: r.x + 600, y: r.y + 60 }; });
  await p.mouse.move(tb.x, tb.y); await p.mouse.wheel(0, 120); await p.waitForTimeout(250);
  const b1 = await p.evaluate(() => [UI._tl.pxd, scrollY]);
  ok(b1[0] === px0 && b1[1] > y0, 'B: Seite geblättert, Maus läuft über die Zeitleiste – kein Zoom, die Seite blättert weiter (' + y0 + ' → ' + b1[1] + ')');
  await p.waitForTimeout(500);
  const tb2 = await p.evaluate(() => { const r = document.querySelector('.tl-bodywrap').getBoundingClientRect(); return { x: r.x + 600, y: r.y + 60 }; });
  await p.mouse.move(tb2.x, tb2.y); await p.mouse.wheel(0, -120); await p.waitForTimeout(300);
  const b2 = await p.evaluate(() => UI._tl.pxd);
  ok(b2 > px0 * 1.1, 'B: nach kurzer Pause zoomt das Mausrad über der Zeitleiste (' + px0.toFixed(2) + ' → ' + b2.toFixed(2) + ')');
  await p.mouse.move(5, 500);

  // ---- C: Urlaub & Feiertage über ⋯ – eigene Seite ohne Reiter, „← zurück“
  await p.click('nav.tabs >> text=Detailpläne'); await p.waitForTimeout(200);
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Urlaub & Feiertage")'); await p.waitForTimeout(250);
  const c0 = await p.evaluate(() => [UI.view, document.querySelector('#main h1').textContent, document.querySelectorAll('nav.tabs .tab.on').length, !!document.querySelector('.view-head .backbtn')]);
  ok(c0[0] === 'urlaub' && /^Urlaub & Feiertage 2027/.test(c0[1]) && c0[2] === 0 && c0[3], 'C: ⋯ → „Urlaub & Feiertage …“ öffnet die Seite (kein Reiter markiert, Knopf „← zurück“)');
  await p.click('.view-head .backbtn'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => UI.view === 'plaene'), 'C: „← zurück“ führt zu den Detailplänen zurück');
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Einstellungen")'); await p.waitForTimeout(250);
  await p.click('.modal .sett-urlaub'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.querySelector('.modal') && UI.view === 'urlaub'), 'C: Einstellungen → „Urlaub & Feiertage öffnen …“ schließt das Fenster und öffnet die Seite');
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Urlaub / Abwesenheit eintragen")'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !!document.querySelector('.modal') && /Urlaub|Abwesenheit/.test(document.querySelector('.modal h2').textContent)), 'C: ⋯ → „Urlaub / Abwesenheit eintragen …“ öffnet direkt das Eintragen');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.click('.view-head .backbtn'); await p.waitForTimeout(200);

  // ---- D: Warnung mit Datum springt zur aufgeklappten Zeitleiste in der Jahresplanung
  await p.evaluate(() => { UI.secOpen.tl = false; UI.view = 'plaene'; renderNow(); goTo({ n: mkdn(2027, 6, 1) }); }); await p.waitForTimeout(250);
  ok(await p.evaluate(() => UI.view === 'jahr' && UI.secOpen.tl === true && !!document.querySelector('.tl')), 'D: Hinweis mit Datum öffnet die Zeitleiste in der Jahresplanung');

  // ---- D2: Detailpläne – nur Pläne mit PAL im gewählten Jahr
  const tabs = () => p.evaluate(() => [...document.querySelectorAll('.ptabs .ptab')].map(t => t.childNodes[1].textContent).join(','));
  const wm = await p.evaluate(() => { const x = C.ms.find(q => q.m.name === 'Weihnachtsmailing'); commit(d => { findM(d, x.id).pal = '2026-11-26'; }); return x.id; });
  await p.evaluate(() => { UI.view = 'plaene'; UI.year = 2027; renderNow(); }); await p.waitForTimeout(200);
  const d0 = await tabs();
  await p.evaluate(() => { UI.year = 2026; renderNow(); }); await p.waitForTimeout(200);
  const d1 = [await tabs(), await p.evaluate(() => C.byId.get(UI.planSel).m.name)];
  await p.evaluate(() => { UI.year = 2025; renderNow(); }); await p.waitForTimeout(200);
  const d2 = await p.evaluate(() => document.querySelector('#main .empty')?.textContent || '');
  ok(d0 === 'Sommermailing' && d1[0] === 'Weihnachtsmailing' && d1[1] === 'Weihnachtsmailing' && /Noch kein Detailplan mit PAL in 2025/.test(d2),
    'D: 2027 nur „' + d0 + '“, 2026 nur „' + d1[0] + '“ (PAL 26.11.2026), 2025: „' + d2.slice(0, 40) + '…“');
  await p.evaluate(() => { UI.year = 2027; UI.view = 'jahr'; UI.allYears = true; UI.secOpen.mass = true; renderNow(); }); await p.waitForTimeout(200);
  await p.click('.mtable tr[data-m="' + wm + '"] td.plan button'); await p.waitForTimeout(200);
  ok(await p.evaluate(id => UI.view === 'plaene' && UI.year === 2026 && UI.planSel === id, wm), 'D: „Plan ›“ bei einer Maßnahme aus 2026 öffnet ihren Plan und wechselt ins Jahr 2026');
  await p.evaluate(() => { UI.allYears = false; UI.year = 2027; renderNow(); });

  // ---- E: Auswertung – „Maßnahmen 2027“, Hinweis leer = „–“, Prüfen als Korb, Alle markieren
  await writeBytes(p, DIR + 'export.csv', Buffer.from(EXPORT, 'utf8'));
  await p.evaluate(() => { UI.view = 'spenden'; UI.spMid = 'm5'; SP.at = null; renderNow(); });
  await p.waitForFunction(() => SP.at && SP.rows.length > 0); await p.waitForTimeout(300);
  const e0 = await p.evaluate(() => [document.querySelector('[data-sec="sp-ueb"] .sec-t').textContent, document.querySelector('.sp-hin').placeholder]);
  ok(e0[0] === 'Maßnahmen 2027' && e0[1] === '–', 'E: Überschrift „' + e0[0] + '“, leerer Hinweis zeigt „' + e0[1] + '“ wie in der Jahresplanung');
  await p.click('.sp-wordin'); await p.keyboard.type('JB'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const nm = () => p.evaluate(() => [...document.querySelectorAll('.sp-col.mid .sp-row')].map(e => SP.byKey.get(e.dataset.k).name.split(' ')[0]).sort().join(','));
  await p.click('.sp-col:first-child .sp-row:has-text("Spende")'); await p.waitForTimeout(250);
  const e1 = await nm();
  await p.evaluate(() => { UI.spMid = 'm4'; renderNow(); }); await p.waitForTimeout(250);
  const e2 = [await nm(), await p.evaluate(() => document.querySelector('.sp-col.mid .sp-tag').textContent)];
  ok(e1 === 'Anna,Bernd' && e2[0] === 'Anna' && e2[1] === 'von Hand', 'E: bei „Jahresbericht“ von Hand nach „Prüfen“ (' + e1 + ') – beim Wechsel zu „Sommermailing“ bleibt Anna liegen, der Regel-Vorschlag „JB“ (Bernd) nicht');
  await p.click('.sp-col.mid .sp-cf button.primary'); await p.waitForTimeout(250);
  const e3 = await p.evaluate(() => Object.values(D.spenden.zu).map(z => z.m).join(','));
  ok(e3 === 'm4', 'E: „zuordnen“ ordnet sie der gewählten Maßnahme (Sommermailing) zu');
  await p.evaluate(() => { UI.spMid = 'm5'; renderNow(); }); await p.waitForTimeout(250);
  ok(await nm() === 'Bernd', 'E: zurück bei „Jahresbericht“: nur noch der Regel-Vorschlag in „Prüfen“');
  await p.evaluate(() => { UI.spMid = 'm4'; renderNow(); }); await p.waitForTimeout(200);
  await p.click('.sp-col:first-child .sp-cf button:has-text("→ Prüfen") >> nth=1'); await p.waitForTimeout(250);
  await p.click('.sp-col.mid .sp-cf button.primary'); await p.waitForTimeout(250);
  const r0 = await p.evaluate(() => document.querySelectorAll('.sp-col:last-child .sp-row').length);
  await p.click('.sp-col:last-child .sp-mark'); await p.waitForTimeout(100);
  const r1 = await p.evaluate(() => [SPUI.sel.r.size, document.querySelector('.sp-col:last-child .sp-mark').textContent, document.querySelector('.sp-col:last-child .sp-cf button:not(.sp-mark)').textContent]);
  ok(r0 >= 3 && r1[0] === r0 && r1[1] === 'Markierung aufheben' && new RegExp('\\(' + r0 + '\\)').test(r1[2]), 'E: „Zugeordnet“ – „Alle markieren“ markiert alle ' + r0 + ' („' + r1[2] + '“)');
  await p.click('.sp-col:last-child .sp-mark'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => SPUI.sel.r.size === 0 && document.querySelector('.sp-col:last-child .sp-mark').textContent === 'Alle markieren'), 'E: nochmal klicken hebt die Markierung auf');

  // ---- F: Update direkt aus dem ZIP – im Dialog gewählt (ohne Entpacken)
  await p.evaluate(() => commit(d => { d.massnahmen[0].hinweis = 'MEINE DATEN 0.13'; })); await p.waitForTimeout(100);
  await p.click('#savebox'); await p.waitForTimeout(500);
  mkZip('upd_a.zip', withVer('99.0'));
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Programm-Update")'); await p.waitForTimeout(150);
  const f0 = await p.evaluate(() => document.querySelector('.modal').innerText);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.modal footer button.primary')]);
  ok(/\.zip/.test(fc.element ? await fc.element().getAttribute('accept') : '') && /entpacken ist nicht nötig/.test(f0), 'F: Dialog nimmt das ZIP-Paket („entpacken ist nicht nötig“)');
  await fc.setFiles('upd_a.zip'); await p.waitForTimeout(400);
  const f1 = await p.evaluate(() => document.querySelector('.modal') ? document.querySelector('.modal').innerText.replace(/\n/g, ' / ') : '');
  const [bk] = await Promise.all([p.waitForEvent('download'), p.click('.modal footer button.primary')]);
  await p.waitForTimeout(700);
  ok(/Version 99\.0/.test(f1) && /upd_a\.zip/.test(f1) && await savedVer(p) === '99.0' && await savedHas(p, 'MEINE DATEN 0.13') && /\.json$/.test(bk.suggestedFilename()),
    'F: Version 99.0 aus „upd_a.zip“ eingespielt, eigene Daten erhalten, Sicherung ' + bk.suggestedFilename());

  // ---- G: Update-Paket im Mailing-Ordner – die App meldet es selbst; danach wird das Paket entfernt
  const q = await open(b); pages.push(q);
  ok(await connect(q) === 'ok', 'G: zweites Fenster verbunden');
  await writeBytes(q, 'Jahresplanung_fuer_Mailing-Ordner (1).zip', mkZip('upd_old.zip', withVer('0.1')));
  await q.evaluate(() => scanUpdatePkg()); await q.waitForTimeout(300);
  ok(await q.evaluate(() => !document.querySelector('.banner.upd') && !ST.zipUpd), 'G: Paket mit älterer Version im Ordner – keine Meldung');
  await writeBytes(q, 'Jahresplanung_fuer_Mailing-Ordner.zip', mkZip('upd_b.zip', withVer('99.1')));
  await q.evaluate(() => scanUpdatePkg()); await q.waitForTimeout(400);
  const g0 = await q.evaluate(() => { const bn = document.querySelector('.banner.upd'); return bn ? bn.textContent : ''; });
  ok(/Update-Paket „Jahresplanung_fuer_Mailing-Ordner\.zip“ mit Version 99\.1/.test(g0), 'G: Hinweis oben: „' + g0.slice(0, 90) + '…“');
  await q.click('.banner.upd button.primary'); await q.waitForTimeout(400);
  const g1 = await q.evaluate(() => [document.querySelector('.modal h2').textContent, !!document.querySelector('.modal input[type=checkbox]:checked'), document.querySelector('.modal').innerText]);
  ok(g1[0] === 'Update übernehmen?' && g1[1] && /danach aus dem Mailing-Ordner löschen/.test(g1[2]), 'G: „Jetzt einspielen …“ fragt nach – Häkchen „Update-Paket danach … löschen“ gesetzt');
  await Promise.all([q.waitForEvent('download'), q.click('.modal footer button.primary')]);
  await q.waitForTimeout(700);
  const g2 = await q.evaluate(() => [Object.keys(__fs.files).filter(k => /\.zip$/.test(k)).join(',')]);
  ok(await savedVer(q) === '99.1' && g2[0] === '/Mailing/Jahresplanung_fuer_Mailing-Ordner (1).zip', 'G: Version 99.1 eingespielt, das Paket ist aus dem Ordner entfernt (übrig: ältere ' + g2[0].split('/').pop() + ')');

  // ---- H: ZIP ins Fenster ziehen
  const r = await open(b); pages.push(r);
  ok(await connect(r) === 'ok', 'H: drittes Fenster verbunden');
  const zipB = [...mkZip('upd_c.zip', withVer('99.2'))];
  await r.evaluate(bytes => { const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(bytes)], 'Jahresplanung_fuer_Mailing-Ordner.zip')); document.querySelector('#main').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, zipB);
  await r.waitForTimeout(500);
  const h0 = await r.evaluate(() => document.querySelector('.modal') ? document.querySelector('.modal').innerText : '');
  ok(/Update übernehmen\?/.test(h0) && /Version 99\.2/.test(h0), 'H: ZIP ins Fenster gezogen – „Update übernehmen?“ mit Version 99.2');
  await r.click('.modal footer button:has-text("Abbrechen")'); await r.waitForTimeout(150);
  await r.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'notiz.txt')); document.querySelector('#main').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await r.waitForTimeout(250);
  ok(await r.evaluate(() => !document.querySelector('.modal') && /Update-Paket \(\.zip\)/.test(document.querySelector('.toast, #toasts')?.textContent || document.body.textContent)), 'H: andere Datei ins Fenster gezogen – nur ein Hinweis, die App bleibt offen');
  await finish(b, pages);
})();
