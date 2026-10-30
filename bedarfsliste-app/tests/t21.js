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
    { gl: 'Hagen', konten: [{ art: 'Volksbank', iban: ibanBauen('47260121', 3) }, { art: 'Sparkasse', iban: ibanBauen('45050001', 3) }] }] } } }); SAVED_JSON = JSON.stringify(D); renderNow(); });
  ok(await p.evaluate(() => !!D.settings.konten && D.settings.konten.liste.length === 2), 'Kontenliste bleibt beim Laden erhalten (settings)');
  await p.click('header.top [data-act="konten"]'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [UI.view, document.querySelector('.modal.k-modal h2').textContent, [...document.querySelectorAll('.k-tab thead th')].map(t => t.querySelector('.k-th') ? t.querySelector('.k-th').textContent : t.textContent).join(','),
    document.querySelectorAll('.k-tab tbody tr').length, document.querySelector('.k-tab thead th.k-haupt .k-th-bic').textContent, document.activeElement.className]);
  ok(r.join('|') === 'list|Kontenliste der Gliederungen|Gliederung,Spendenkonto Pax-Bank,Sparkasse,Volksbank|2|BIC GENODED1PA7|k-such', 'Fenster: Spalten wie in der Excel, BIC im Kopf, Suche hat den Fokus: ' + r.join('|'));
  r = await p.evaluate(() => [...document.querySelectorAll('.k-tab tbody tr')].map(t => t.querySelector('.k-gl').textContent + ':' + [...t.querySelectorAll('td')].map(td => td.querySelector('.k-iban') ? (td.querySelector('.k-bic-w') ? td.querySelector('.k-bic-w').textContent : 'iban') : '-').join('/')).join(','));
  ok(r === 'Brakel:iban/BIC WELADED1HXB/-,Hagen:-/BIC WELADE3HXXX/iban', 'je Zeile die Konten; BIC beim Konto, wenn die Spalte verschiedene Banken hat: ' + r);
  await p.keyboard.type('hag'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => [...document.querySelectorAll('.k-tab tbody .k-gl')].map(x => x.textContent).join(',') === 'Hagen'), 'Suche filtert beim Tippen');
  await p.evaluate(() => { window.KOPIE = []; navigator.clipboard.writeText = t => { KOPIE.push(t); return Promise.resolve(); }; });
  await p.fill('.k-such', ''); await p.waitForTimeout(50);
  await p.hover('.k-tab tbody tr:first-child td.k-haupt'); await p.click('.k-tab tbody tr:first-child td.k-haupt .k-kopie'); await p.waitForTimeout(80);
  r = await p.evaluate(() => [KOPIE[0] === ibanBauen('37060120', 2), document.querySelector('.k-tab tbody tr:first-child td.k-haupt .k-kopie').classList.contains('ok')]);
  ok(r.join('|') === 'true|true', 'Kopierzeichen kopiert die IBAN (ohne Leerzeichen) und zeigt einen Haken: ' + r.join('|'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => !document.querySelector('.k-modal')), 'Esc schließt das Fenster');
  await finish(b, [p]);
})();
