// 0.79: Reiter „Kontenliste“ – Excel einlesen (Blatt mit „Gliederung / Standort“ und „…-Konto“), BIC aus der IBAN, Suche, Kopieren
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  // Prüfziffer und BIC
  let r = await p.evaluate(() => { const i = ibanBauen('37060193', '1234567'); return [ibanOk(i), ibanOk(i.slice(0, -1) + (i.slice(-1) === '1' ? '2' : '1')), ibanBank(i)[0], ibanSchoen(i).split(' ').length, ibanBank(ibanBauen('47650130', '1'))[0]]; });
  ok(r.join('|') === 'true|false|GENODED1PAX|6|WELADE3LXXX', 'IBAN: Prüfziffer, BIC und Name aus der Bankleitzahl: ' + r.join('|'));
  // Excel wie die echte: Formelblatt „Kontensuche“ (nur eine Gliederung) und „Kontendaten“ (alle)
  r = await p.evaluate(async () => {
    const c = v => ({ v }), I = (blz, k) => ibanSchoen(ibanBauen(blz, k));
    const kopf = ['Gliederung / Standort', 'PAX-Konto', 'BKC-Konto', 'SPK-Konto', 'VoBa-Konto'].map(c);
    const blob = xlsxBlob([
      { name: 'Kontensuche', cols: [4, 24, 30, 30, 30, 30], rows: [[], [c(''), c('Konto der Gliederung: '), c('Brakel')], [], [c(''), c(''), c('PAX-Konto')], [c(''), ...kopf], [c(''), c('Brakel'), c(I('37060120', 2)), c(I('37060193', 2)), c('0'), c('0')]] },
      { name: 'Kontendaten', cols: [24, 30, 30, 30, 30], rows: [kopf, [c('Altenbeken '), c(I('37060120', 1)), c(I('37060193', 1)), c(''), c('')], [c('Brakel'), c(I('37060120', 2)), c(I('37060193', 2)), c(I('47251550', 2)), c('')],
        [c('Hagen'), c(I('37060120', 3)), c(''), c(''), c(I('47260121', 3))], [c('Neustadt'), c('DE00 1234'), c(''), c(''), c('')]] }]);
    const R = kontenLesen(await xlsxBook(await blob.arrayBuffer()));
    return [R.blatt, R.L.map(x => x.gl + ':' + x.konten.map(k => k.art).join('+')).join(','), R.n, R.L[3].konten.filter(k => !ibanOk(k.iban)).length];
  });
  ok(r.join('|') === 'Kontendaten|Altenbeken:Pax-Bank+BKC,Brakel:Pax-Bank+BKC+Sparkasse,Hagen:Pax-Bank+Volksbank,Neustadt:Pax-Bank|8|1', 'Excel: Blatt mit den meisten Konten, Gliederung wie in der Liste geschrieben, Bankart aus der Spalte: ' + r.join('|'));
  // Reiter
  await p.evaluate(() => { D = normalize({ bedarfe: [], settings: { konten: { stand: '2026-10-30T10:00:00Z', datei: 'Konten.xlsm', liste: [
    { gl: 'Brakel', konten: [{ art: 'Pax-Bank', iban: ibanBauen('37060120', 2) }, { art: 'Sparkasse', iban: ibanBauen('47251550', 2) }] },
    { gl: 'Hagen', konten: [{ art: 'Volksbank', iban: ibanBauen('47260121', 3) }] }] } } }); SAVED_JSON = JSON.stringify(D); renderNow(); });
  ok(await p.evaluate(() => !!D.settings.konten && D.settings.konten.liste.length === 2), 'Kontenliste bleibt beim Laden erhalten (settings)');
  await p.click('header.top [data-act="konten"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [UI.view, document.querySelectorAll('.k-gl').length, document.querySelector('.k-gl .k-bic').textContent, document.querySelector('#konten-count').textContent, document.querySelector('header.top [data-act="konten"]').classList.contains('on')]);
  ok(r.join('|') === 'konten|2|GENODED1PA7|2 von 2 Gliederungen|true', 'Reiter „Kontenliste“: Karten je Gliederung mit BIC: ' + r.join('|'));
  await p.keyboard.press('Control+f'); await p.keyboard.type('hag'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [[...document.querySelectorAll('.k-gl-n')].map(x => x.textContent).join(','), document.querySelector('#konten-count').textContent, document.activeElement.id]);
  ok(r.join('|') === 'Hagen|1 von 2 Gliederungen|kq', 'Strg+F und Suche filtern beim Tippen: ' + r.join('|'));
  await p.fill('#kq', 'sparkasse'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => [...document.querySelectorAll('.k-gl-n')].map(x => x.textContent).join(',') === 'Brakel'), 'Suche auch nach der Bank');
  await p.evaluate(() => { window.KOPIE = []; navigator.clipboard.writeText = t => { KOPIE.push(t); return Promise.resolve(); }; });
  await p.click('.k-iban'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => KOPIE[0] === ibanBauen('37060120', 2)), 'Klick auf die IBAN kopiert sie (ohne Leerzeichen)');
  await p.click('header.top [data-act="tab"][data-v="aktiv"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => UI.view === 'list' && !document.querySelector('.k-gl')), 'zurück zu den Bedarfen');
  await finish(b, [p]);
})();
