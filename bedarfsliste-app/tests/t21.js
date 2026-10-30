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
  r = await p.evaluate(() => [document.querySelector('.modal.k-modal h2').textContent, [...document.querySelectorAll('.k-tab thead th')].map(t => t.querySelector('.k-th') ? t.querySelector('.k-th').textContent : t.textContent).join(','),
    document.querySelectorAll('.k-tab tbody tr').length, document.querySelector('.k-tab thead th.k-haupt .k-bic').textContent.trim(), document.activeElement.className, !document.querySelector('.k-fuss'), !!document.querySelector('.k-modal header .k-stift')]);
  ok(r.join('|') === 'Kontenliste der Gliederungen|Gliederung,Spendenkonto,Sparkasse,Volksbank|2|BIC GENODED1PA7|k-such|true|true', 'Fenster: Spalten, BIC im Kopf, Suche hat den Fokus, ohne Stand/Einlesen, Stift oben: ' + r.join('|'));
  // ohne Suche: in der Spalte Sparkasse zwei verschiedene Banken → BIC und Bank unter der IBAN
  r = await p.evaluate(() => [...document.querySelectorAll('.k-tab tbody tr')].map(t => t.querySelector('.k-gl').textContent + ':' + [...t.querySelectorAll('td')].map(td => td.querySelector('.k-iban') ? (td.querySelector('.k-bic') ? td.querySelector('.k-bic').textContent.trim() + '+' + (td.querySelector('.k-bank') ? 'Bank' : '') : 'iban') : '-').join('/')).join(','));
  ok(r === 'Brakel:iban/BIC WELADED1HXB+Bank/-,Hagen:-/BIC WELADE3HXXX+Bank/iban', 'ohne Suche: BIC und Bank unter der IBAN, wenn die Spalte verschiedene Banken hat: ' + r);
  await p.keyboard.type('hag'); await p.waitForTimeout(80);
  r = await p.evaluate(() => [[...document.querySelectorAll('.k-tab tbody .k-gl')].map(x => x.textContent).join(','), [...document.querySelectorAll('.k-tab thead th')].slice(1).map(t => t.querySelector('.k-bic') ? t.querySelector('.k-bic').textContent.trim() + '|' + t.querySelector('.k-bank').textContent : '-').join(','), !document.querySelector('.k-tab tbody .k-bic')]);
  ok(r[0] === 'Hagen' && /BIC WELADE3HXXX\|Sparkasse/.test(r[1]) && /BIC DGPBDE3MXXX\|/.test(r[1]) && r[2], 'Suche „hag“: nur Hagen, BIC und Name der Bank stehen jetzt im Kopf: ' + r.join(' # '));
  await p.evaluate(() => { window.KOPIE = []; navigator.clipboard.writeText = t => { KOPIE.push(t); return Promise.resolve(); }; });
  await p.fill('.k-such', ''); await p.waitForTimeout(50);
  await p.click('.k-tab tbody tr:first-child td.k-haupt .k-iban'); await p.waitForTimeout(60);
  await p.click('.k-tab thead th.k-haupt .k-bic'); await p.waitForTimeout(60);
  r = await p.evaluate(() => [KOPIE[0] === ibanBauen('37060120', 2), KOPIE[1], document.querySelector('.k-tab tbody tr:first-child td.k-haupt .k-iban').classList.contains('ok')]);
  ok(r.join('|') === 'true|GENODED1PA7|true', 'Klick auf die IBAN kopiert sie, Klick auf die BIC die BIC, mit Haken: ' + r.join('|'));
  // Stift: bearbeiten statt kopieren
  await p.click('.k-modal .k-stift'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => document.querySelector('.k-modal .k-stift').classList.contains('on') && document.querySelectorAll('.k-tab .k-in').length === 2 * 4), 'Stift: Felder zum Bearbeiten (Name und drei Konten je Gliederung)');
  await p.evaluate(() => { const f = document.querySelector('.k-in[data-gl="Hagen"][data-art="Pax-Bank"]'); f.value = ibanBauen('37060120', 9); f.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.evaluate(() => { const f = document.querySelector('.k-in[data-gl="Brakel"][data-art="Sparkasse"]'); f.value = ''; f.dispatchEvent(new Event('change', { bubbles: true })); });
  r = await p.evaluate(() => { const L = D.settings.konten.liste; return [L.find(x => x.gl === 'Hagen').konten.map(k => k.art).join('+'), L.find(x => x.gl === 'Brakel').konten.map(k => k.art).join('+')]; });
  ok(r.join('|') === 'Pax-Bank+Sparkasse+Volksbank|Pax-Bank', 'IBAN eingetragen bzw. geleert – gespeichert: ' + r.join('|'));
  await p.click('.k-neu'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => D.settings.konten.liste.length === 3 && document.activeElement.classList.contains('k-gl-in')), '„+ Gliederung“ legt eine Zeile an, der Name ist gleich zum Tippen bereit');
  await p.click('.k-modal .k-stift'); await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => !document.querySelector('.k-modal')), 'Esc schließt das Fenster');
  await finish(b, [p]);
})();
