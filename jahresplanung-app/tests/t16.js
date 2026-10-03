const { chromium } = require('./pw');
const T = require('./common');
const fs = require('fs');
const NEW = T.HTML;
const ok = (c, m) => console.log((c ? 'OK   ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const neu = fs.readFileSync(NEW, 'utf8');
  // Datensicherung wie vom Update erzeugt
  const ctx0 = await b.newContext(); const p0 = await ctx0.newPage(); await p0.goto('file://' + NEW); await p0.waitForTimeout(300);
  fs.writeFileSync('sicherung.json', await p0.evaluate(() => { D.massnahmen[0].hinweis = 'AUS DER SICHERUNG'; return JSON.stringify(D); })); await ctx0.close();

  // 1) falscher Ordner verbunden → Warnung
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript({ path: T.FAKEFS });
  const p = await ctx.newPage(); p.setDefaultTimeout(6000); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + NEW); await p.waitForTimeout(400);
  await p.evaluate(t => { __fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'] = { data: new TextEncoder().encode(t), lm: 1000 }; }, neu);
  await p.click('#savebox'); await p.waitForTimeout(200); await p.click('.modal footer button.primary'); await p.waitForTimeout(600);
  const ban = await p.evaluate(() => [...document.querySelectorAll('.banner')].map(b => b.innerText).join(' || '));
  ok(/gespeichert wird aber in den Ordner „Mailing“/.test(ban), 'Warnung bei falschem Ordner: ' + ban.slice(0, 160));
  await p.screenshot({ path: 'r9_banner.png', clip: { x: 0, y: 0, width: 1400, height: 140 } });
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Einstellungen")'); await p.waitForTimeout(150);
  const st = await p.evaluate(() => document.querySelector('.verbox').innerText);
  ok(/Geöffnete Datei: .*jahresplanung-app/.test(st) && /passt nicht/.test(st), 'Einstellungen zeigen Datei und Speicherort: ' + st.replace(/\n/g, ' / '));
  await p.click('.modal footer button.primary');

  // 2) Aufräumen: Speicherort neu wählen (richtiger Ordner), Sicherung übernehmen
  await p.evaluate(t => {
    __fs.files['/jahresplanung-app/Jahresplanung_Aussenkommunikation.html'] = { data: new TextEncoder().encode(t), lm: 1000 };
    const orig = window.showDirectoryPicker;
    window.showDirectoryPicker = async () => { const d = await orig(); return Object.assign({}, d, { name: 'jahresplanung-app',
      getFileHandle: async (n, o) => { const k = '/jahresplanung-app/' + n; if (!__fs.files[k]) { if (o && o.create) __fs.files[k] = { data: new Uint8Array(), lm: 4000 }; else throw new DOMException('nf', 'NotFoundError'); }
        return { kind: 'file', name: n, getFile: async () => new File([__fs.files[k].data], n, { lastModified: __fs.files[k].lm }),
          createWritable: async () => { const parts = []; return { write: async x => parts.push(x), close: async () => { __fs.files[k] = { data: new Uint8Array(await new Blob(parts).arrayBuffer()), lm: 6000 + (++__fs.n) }; } }; } }; } }); };
  }, neu);
  await p.click('.banner button:has-text("Speicherort neu wählen")'); await p.waitForTimeout(200);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(700);
  const ban2 = await p.evaluate(() => [...document.querySelectorAll('.banner')].map(b => b.innerText).join(' || '));
  ok(!/gespeichert wird aber/.test(ban2), 'nach „Speicherort neu wählen“ keine Warnung mehr');
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Daten aus anderer Datei")'); await p.waitForTimeout(100);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.modal footer button.primary')]);
  await fc.setFiles('sicherung.json'); await p.waitForTimeout(3500);   // automatisches Speichern
  const saved = await p.evaluate(() => new TextDecoder().decode(__fs.files['/jahresplanung-app/Jahresplanung_Aussenkommunikation.html'].data));
  ok(saved.includes('AUS DER SICHERUNG') && saved.includes('"version": "0.5.2"'), 'Sicherung übernommen und im richtigen Ordner gespeichert (Version 0.5.2)');
  console.log('Knopf:', await p.textContent('#savebox'));
  console.log('ERR', errs.join(' | ') || 'keine'); await b.close();
})();
