// 0.8.10 PDF: Maßnahmen-Tabelle mit Datum und darunter Werktagen; Kalender immer auf einer A4-Seite (schmaler Kopf, bei Bedarf verkleinert)
const { chromium, ok, open, finish, fs } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1123 }); pages.push(p);
  const nPages = f => (fs.readFileSync(f).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const build = async (secs, extra) => {
    await p.evaluate(([secs, n]) => { window.print = () => {};
      if (n) commit(d => { for (let i = 0; i < n; i++) d.massnahmen.push({ id: 'k' + i, name: 'Zusatz-Maßnahme mit etwas längerem Namen ' + i, farbe: '#1F77B4', pal: '2027-' + String(3 + (i % 9)).padStart(2, '0') + '-' + String(10 + (i % 15)).padStart(2, '0'), palStatus: 'vorläufig', vorlauf: { S: 30, I: 20, D: 10 } }); });
      printPDF({ secs, show: Object.fromEntries(evKeys().map(k => [k, true])), vac: true, verbund: false, ms: new Set(C.ms.map(x => x.id)) }); }, [secs, extra]);
    await p.waitForTimeout(300);
  };
  const done = () => p.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  // ---- A: Maßnahmen-Tabelle: oben Datum, darunter Werktage
  await build({ mass: true }, 0);
  const t = await p.evaluate(() => { const r = [...document.querySelectorAll('#printdoc .pd-table tbody tr')].find(tr => /Sommermailing/.test(tr.textContent)), td = r.querySelector('td.st');
    return [td.children.length, td.children[0].textContent, td.children[1].textContent, td.children[1].className]; });
  ok(t[0] === 2 && /^\w\w \d\d\.\d\d\.\d{4}$/.test(t[1]) && /^\d+ WT$/.test(t[2]) && t[3] === 'wt', 'A: Zelle zweizeilig „' + t[1] + '“ / „' + t[2] + '“');
  await done();

  // ---- B: Kalender auf einer Seite, Kopf ohne Logo
  await build({ kal: true }, 0);
  const k = await p.evaluate(() => { const pg = document.querySelector('#printdoc .pd-page'); return [!!pg.querySelector('.pd-head.slim'), !!pg.querySelector('.pd-head img'), pg.querySelector('.pd-kal').style.zoom || '1', pg.querySelector('.pd-kal').dataset.est]; });
  ok(k[0] && !k[1], 'B: Kalenderseite mit schmalem Kopf ohne Logo');
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: 'kal1.pdf', landscape: true, format: 'A4', printBackground: true });
  await p.emulateMedia({ media: 'screen' }); await done();
  ok(nPages('kal1.pdf') === 1, 'B: Kalender auf 1 Seite (geschätzt ' + k[3] + ' px, Verkleinerung ' + k[2] + ')');

  // ---- C: viele Maßnahmen → Kalender wird verkleinert, bleibt auf einer Seite
  await build({ kal: true }, 30);
  const z = await p.evaluate(() => { const c = document.querySelector('#printdoc .pd-kal'); return [+(c.style.zoom || 1), +c.dataset.est]; });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: 'kal2.pdf', landscape: true, format: 'A4', printBackground: true });
  await p.emulateMedia({ media: 'screen' }); await done();
  ok(z[0] < 1 && nPages('kal2.pdf') === 1, 'C: 30 weitere Maßnahmen – verkleinert auf ' + z[0] + ' (geschätzt ' + z[1] + ' px), weiterhin 1 Seite');
  await finish(b, pages);
})();
