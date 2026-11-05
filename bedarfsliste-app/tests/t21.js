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
  // 0.125: Kontenliste über den Knopf in der Seitenleiste links (oben kein Reiter mehr)
  ok(await p.evaluate(() => !document.querySelector('header.top [data-act="konten"]') && [...document.querySelectorAll('.seitenleiste .sl-k')].map(b => b.getAttribute('aria-label')).join() === 'Verwendungszweck,Kontenliste,Gebietsnummern'), 'Seitenleiste links: Verwendungszweck, Kontenliste, Gebietsnummern; Kontenliste nicht mehr oben');
  await p.click('.seitenleiste [data-act="konten"]', { force: true }); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.querySelector('.modal.k-modal h2').textContent, [...document.querySelectorAll('.k-tab thead th')].map(t => t.querySelector('.k-th') ? t.querySelector('.k-th').textContent : t.textContent).join(','),
    document.querySelectorAll('.k-tab tbody tr').length, !document.querySelector('.k-tab thead .k-bic'), document.activeElement.className, !document.querySelector('.k-fuss'), !!document.querySelector('.k-modal header .k-stift')]);
  ok(r.join('|') === 'Kontenliste der Gliederungen|Gliederung,Spendenkonto,Sparkasse,Volksbank|2|true|k-such|true|true', 'Fenster: Spalten ohne BIC im Kopf, Suche hat den Fokus, Stift oben: ' + r.join('|'));
  r = await p.evaluate(() => { const td = document.querySelector('.k-tab tbody tr:first-child td.k-haupt'), m = td.querySelector('.k-mehr'), cs = getComputedStyle(td);
    return [td.querySelector('.k-bic').textContent.trim(), td.querySelector('.k-bank').tagName, getComputedStyle(m).opacity, cs.textAlign, cs.verticalAlign, (() => { const w = document.querySelector('.k-wrap'); return w.scrollWidth <= w.clientWidth; })()]; });
  ok(r.join('|') === 'BIC GENODED1PA7|BUTTON|0|center|middle|true', 'Jede Zelle: BIC und Bank (kopierbar) zunächst verborgen, Inhalt zentriert, kein waagerechter Scrollbalken: ' + r.join('|'));
  await p.hover('.k-tab tbody tr:first-child td.k-haupt'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.k-tab tbody tr:first-child td.k-haupt .k-mehr')).opacity) === '1', 'Beim Darüberfahren erscheinen BIC und Bank');
  await p.evaluate(() => { window.KOPIE = []; navigator.clipboard.writeText = t => { KOPIE.push(t); return Promise.resolve(); }; });
  await p.click('.k-tab tbody tr:first-child td.k-haupt .k-iban'); await p.waitForTimeout(60);
  await p.click('.k-tab tbody tr:first-child td.k-haupt .k-bic'); await p.waitForTimeout(60);
  await p.click('.k-tab tbody tr:first-child td.k-haupt .k-bank'); await p.waitForTimeout(60);
  r = await p.evaluate(() => [KOPIE[0] === ibanBauen('37060120', 2), KOPIE[1], !!KOPIE[2] && KOPIE[2].length > 3, document.querySelector('.k-tab tbody tr:first-child td.k-haupt .k-iban').classList.contains('ok')]);
  ok(r.join('|') === 'true|GENODED1PA7|true|true', 'Klick kopiert IBAN, BIC und den Namen der Bank, mit Haken: ' + r.join('|'));
  await p.focus('.k-such'); await p.keyboard.type('hag'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => [...document.querySelectorAll('.k-tab tbody .k-gl')].map(x => x.textContent).join(',')) === 'Hagen', 'Suche „hag“: nur Hagen');
  await p.fill('.k-such', ''); await p.waitForTimeout(50);
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
  // 0.125: Gebietsnummern und Verwendungszweck aus der Seitenleiste
  await p.evaluate(() => { document.querySelectorAll('.backdrop').forEach(b => b.remove()); });
  await p.click('.seitenleiste [data-act="sl-gebiet"]', { force: true }); await p.waitForSelector('.sl-tab');
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, document.querySelectorAll('.sl-tab tbody tr').length]);
  ok(r.join('|') === 'Gebietsnummern|45', 'Gebietsnummern: Fenster mit allen 45 Gliederungen: ' + r.join('|'));
  await p.fill('.sl-modal .k-such', 'brak'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => [...document.querySelectorAll('.sl-tab tbody tr')].map(t => t.textContent.trim()).join()) === '160808Brakel', 'Suche „brak“ findet Brakel mit 160808');
  await p.evaluate(() => { document.querySelectorAll('.backdrop').forEach(b => b.remove()); });
  await p.click('.seitenleiste [data-act="sl-zweck"]', { force: true }); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, document.querySelectorAll('.sl-tab tbody tr.sl-gr').length, document.querySelectorAll('.sl-tab tbody tr:not(.sl-gr)').length]);
  ok(r.join('|') === 'Verwendungszweck – Kostenstellen|16|99', 'Verwendungszweck: 99 Kostenstellen in 16 Bereichen: ' + r.join('|'));
  await p.fill('.sl-modal .k-such', 'trauer'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => [...document.querySelectorAll('.sl-tab tbody tr')].map(t => t.textContent.trim()).join('/')) === 'Hospiz/2450Trauerarbeit', 'Suche „trauer“: Bereich Hospiz, 2450 Trauerarbeit');
  await p.evaluate(() => { document.querySelectorAll('.backdrop').forEach(b => b.remove()); });
  await finish(b, [p]);
})();
