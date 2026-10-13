// 0.21–0.28 Jahresvergleich: Kennzahlen als Tabelle (einzeln ausblenden), Sondereffekte als Liste unter der Leiste, Jahr hervorheben, Spendersegmente (Grafik mit Bändern),
// Zwecke und Konten als Tabellen nebeneinander, Dauerspender:innen (drei Kacheln, Zu-/Abgänge), ⓘ kurz, Reihenfolge, PDF
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const p2 = x => String(x).padStart(2, '0');
const L = (d, b, who, zw, da, kt) => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000000' + who, 'Probe ' + who, "'Zugang/Gutschrift", zw, da ? "'Dauerauftragsgutschr" : "'Spendengutschrift", "'Paderborn - " + kt].join(';');
// erfundene Buchungen: 1 Dauerauftrag 20 € monatlich (beide Jahre), 2 Dauerauftrag 10 € monatlich (nur 2025), 3 Dauerauftrag 60 € vierteljährlich (nur 2026),
// 4 einmal 5.000 € Hospizarbeit (2026), 5 Rikscha 150 € / 300 €, 6 50 € (2025), 7 Erbschaft 30.000 € (2026)
const y25 = [], y26 = [];
for (let m = 1; m <= 12; m++) { y25.push(L('05.' + p2(m) + '.2025', 20, 1, 'Spende', true, 'Lage'), L('06.' + p2(m) + '.2025', 10, 2, 'Spende', true, 'Lage')); y26.push(L('05.' + p2(m) + '.2026', 20, 1, 'Spende', true, 'Lage'));
  if (m % 3 === 0) y26.push(L('07.' + p2(m) + '.2026', 60, 3, 'Spende', true, 'Brakel')); }
y25.push(L('12.04.2025', 150, 5, 'Rikscha', false, 'Brakel'), L('20.05.2025', 50, 6, 'Spende', false, 'Siegen'));
y26.push(L('03.03.2026', 5000, 4, 'Spende Hospizarbeit', false, 'Hospiz'), L('12.04.2026', 300, 5, 'Rikscha', false, 'Brakel'), L('15.06.2026', 30000, 7, 'Nachlass Probe', false, 'Lage'));
const csv = r => '﻿' + [HEAD, ...r].join('\r\n') + '\r\n';

(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1400, height: 1000 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  await p.evaluate(F => { __fs.files['/Mailing/Spendeneingänge 2025/e.csv'] = { data: new TextEncoder().encode(F[0]), lm: 81000 }; __fs.files['/Mailing/Spendeneingänge 2026/e.csv'] = { data: new TextEncoder().encode(F[1]), lm: 81000 }; }, [csv(y25), csv(y26)]);
  await p.evaluate(() => { commit(d => { d.zwecke.push({ id: 'zh', name: 'Hospizarbeit', farbe: '#2e7d32', worte: ['Hospizarbeit'], konten: [], massnahmen: [] }, { id: 'zr', name: 'Rikscha', farbe: '#1565c0', worte: ['Rikscha'], konten: [], massnahmen: [] });
    d.spenden.grenze = { 2026: 1000000 }; });
    UI.year = 2026; UI.view = 'vergleich'; UI.jvZeit = 'jahr'; SP.at = null; renderNow(); });
  await p.evaluate(() => { for (const k of ['seg', 'zweck', 'konto', 'dauer']) UI.secOpen['jv-' + k] = true; renderNow(); }); await p.waitForTimeout(400);

  // ---- A: Kennzahlen als Tabelle – Vergleichsjahr, Hauptjahr, Veränderung, Mini-Verlauf; einzeln über „Bausteine“ ausblenden
  const kt = () => p.evaluate(() => [...document.querySelectorAll('.jv-kt tr')].map(t => (t.dataset.k || 'kopf') + ':' + [...t.children].map(c => c.textContent).join('|')));
  const a0 = await kt();
  ok(a0[0] === 'kopf:ganzes Jahr|2025|2026|Veränderung|’25’26' && a0[1] === 'sum:Spendensumme|560 €|5.780 €|▲ ×10|' && a0[3] === 'avg:Ø je Spende|21,54 €|321,11 €|▲ ×15|' && a0[6] === 'top:Anteil der größten 10 %|42,9 %|86,5 %|▲ +43,6 Pkt.|',
    'A: Tabelle „ganzes Jahr | 2025 | 2026 | Veränderung“ – große Sprünge als Faktor (×10), Anteile in Prozentpunkten');
  ok(await p.evaluate(() => [...document.querySelectorAll('.jv-kt tr[data-k="sum"] circle')].map(r => r.getAttribute('fill')).join() === 'var(--jvV),var(--jvH)' && !document.querySelector('.jv-kt .jv-kx')),
    'A: Mini-Verlauf – Hauptjahr kräftig blau, Vergleichsjahr mittelblau; kein × in der Tabelle');
  await p.click('.jv-bbtn'); await p.waitForTimeout(150);
  const a2 = await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-bpop .jv-brow label.mchk')].map(l => l.textContent).join('|') + ' / ' + [...document.querySelectorAll('.menu.pop .jv-bsub label')].map(l => l.textContent + (l.querySelector('input').checked ? '+' : '-')).join('|'));
  ok(a2 === 'Auf einen Blick|Jahresziel & Hochrechnung|Jahresverlauf & Quartale|Privat & Institutionen|Spendenbrücke|Spenderbindung|Kennzahlen|Mailings vergleichen|Spendersegmente|Zwecke über die Jahre|Konten über die Jahre|Dauerspender:innen|Größte Spender:innen / Spendensumme+|Spender:innen+|Ø je Spende+|Median je Spende-|Spenden+|Dauerspender:innen+|Anteil der größten 10 %+|Erstmals gespendet-',
    'A: „Bausteine“ – alle Bausteine, unter „Kennzahlen“ jede Kennzahl einzeln (Median und „Erstmals“ anfangs aus)');
  await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-bsub label')].find(l => l.textContent === 'Spenden').querySelector('input').click()); await p.waitForTimeout(250);
  const a3 = await p.evaluate(() => [[...document.querySelectorAll('.jv-kt tbody tr')].map(t => t.dataset.k).join(), JSON.stringify(UI.jvKHide), UI_KEYS.includes('jvKHide'), !!document.querySelector('.menu.pop .jv-bpop')]);
  ok(a3[0] === 'sum,don,avg,dauer,top' && a3[1] === '{"n":true}' && a3[2] && a3[3], 'A: „Spenden“ ausgeblendet – Zeile weg, gemerkt; „Bausteine“ bleibt offen');
  await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-bsub label')].find(l => l.textContent === 'Median je Spende').querySelector('input').click()); await p.waitForTimeout(250);
  await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-bsub label')].find(l => l.textContent === 'Spenden').querySelector('input').click()); await p.waitForTimeout(250);
  ok(await p.evaluate(() => [...document.querySelectorAll('.jv-kt tbody tr')].map(t => t.dataset.k).join() === 'sum,don,avg,med,n,dauer,top' && JSON.stringify(UI.jvKHide) === '{"n":false,"med":false}'), 'A: Median eingeblendet, „Spenden“ wieder da');
  await p.keyboard.press('Escape');

  // ---- B: Sondereffekte – Knopf in der Leiste klappt Grenzen und Liste auf; die Liste steht unter der festen Leiste
  ok(await p.evaluate(() => !document.querySelector('.jv-sxt') && document.querySelector('.jv-sxbtn').textContent === 'Sondereffekte 1 herausgerechnet ▾' && !document.querySelector('.jv-sxmode')), 'B: Sondereffekte anfangs zu – Knopf „1 herausgerechnet“');
  await p.click('.jv-sxbtn'); await p.waitForTimeout(250);
  const b0 = await p.evaluate(() => [...document.querySelectorAll('.jv-sxt tr')].map(r => [...r.children].map(c => c.textContent).join('|')));
  ok(b0.length === 1 && b0[0] === '2026|15.06.2026|30.000 €|Probe 7|Nachlass Probe|Lage|', 'B: „Herausgerechnet“ – 2026: 15.06.2026, 30.000 €, Name, Verwendungszweck, Gliederung');
  ok(await p.evaluate(() => !document.querySelector('.jv-bar .jv-sxt') && !!document.querySelector('.jv > .jv-sxl .jv-sxt') && !!document.querySelector('.jv-bar .jv-sxp .jv-sxmode') && getComputedStyle(document.querySelector('.jv-bar')).position === 'sticky'),
    'B: Grenzen und „herausrechnen/einrechnen“ in der festen Leiste, die Liste darunter (scrollt mit)');
  await p.click('.jv-sxbtn'); await p.waitForTimeout(250);

  // ---- C: Jahresverlauf – Klick auf ein Jahr hebt es hervor, die anderen werden blass; noch einmal: wieder alle
  await p.click('.jv-legy:has-text("2025")'); await p.waitForTimeout(300);
  const c0 = await p.evaluate(() => [JV.focus, document.querySelectorAll('[data-chart="jvcum"] polyline.jv-dim').length, document.querySelectorAll('[data-chart="jvcum"] polyline').length, document.querySelector('.jv-legy.on')?.textContent, document.querySelectorAll('.jv-legy.dim').length]);
  ok(c0.join() === '2025,1,2,2025,1', 'C: Klick auf „2025“ – 2025 hervorgehoben, 2026 blass');
  await p.evaluate(() => document.querySelector('[data-chart="jvcum"] .jv-elab:not(.jv-dim)').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JV.focus === null && !document.querySelector('[data-chart="jvcum"] .jv-dim')), 'C: Klick auf die Beschriftung des hervorgehobenen Jahres – wieder alle gleich');

  // ---- D: Spendersegmente – oben Anteil an den Spender:innen, unten an der Summe, Bänder dazwischen, dünne Balken = Vergleichsjahr; ein Satz darunter
  const d0 = await p.evaluate(() => { const c = document.querySelector('[data-chart="jvseg"]');
    return [[...document.querySelectorAll('.jv-seglg > span')].map(s => s.textContent).join('|'), [...c.querySelectorAll('.jv-sgt')].map(t => t.textContent).join('|'), c.querySelectorAll('rect.jv-sgb:not(.old)').length, c.querySelectorAll('rect.jv-sgb.old').length,
      c.querySelectorAll('.jv-sgr').length, [...c.querySelectorAll('.jv-sgp')].map(t => t.textContent).join('|'), document.querySelector('.jv-ins')?.textContent, document.querySelector('[data-sec="jv-seg"] .jv-gctl') != null]; });
  ok(d0[0] === 'bis 100 €|101–249 €|250–499 €|500–999 €|1.000–4.999 €|ab 5.000 €' && d0[1] === 'Spender:innen|Spendensumme' && d0[2] === 6 && d0[3] === 4 && d0[4] === 3,
    'D: Legende von klein nach groß; zwei Balken (Spender:innen, Summe) für 2026, ein Band je besetztem Segment (3), dünne Balken für 2025');
  ok(d0[5] === '50 %|8 %|25 %|5 %|25 %|87 %' && d0[6] === 'Ab 1.000 €: 1 Spender:in (25 %) gibt 87 % der Summe – 2025: 0 Spender:innen mit 0 %.' && d0[7], 'D: Anteile an den Balken, darunter ein Satz: ' + d0[6] + '; eigene Auswahl „Alle | Privat | Institutionen“ im Kopf');

  // ---- E: Zwecke über die Jahre – Tabelle mit Hauptjahr, Veränderung, Mini-Verlauf (Jahre im Kopf); zweckungebunden unten
  const zw = await p.evaluate(() => [...document.querySelectorAll('[data-sec="jv-zweck"] tr')].map(t => [...t.children].map(c => c.textContent.trim()).join('|')));
  ok(zw.join(' ## ') === '|2026|ggü. 2025|’25’26 ## Hospizarbeit|5.000 €|neu| ## Rikscha|300 €|▲ +100,0 %| ## zweckungebunden|480 €|▲ +17,1 %|' && await p.evaluate(() => !document.querySelector('[data-sec="jv-zweck"] .jv-pk') && document.querySelectorAll('[data-sec="jv-zweck"] .jv-spk').length === 3),
    'E: Zwecke als Tabelle – je Zweck 2026, Veränderung und Mini-Verlauf; keine Linien-Grafik mehr');
  ok(await p.evaluate(() => [...document.querySelectorAll('.jv-grid2')].map(g => [...g.children].map(e => e.dataset.sec).join('/')).join(' ') === 'jv-bruecke/jv-bindung jv-zweck/jv-konto'), 'E: Zwecke und Konten nebeneinander');
  // ---- F: Konten über die Jahre – anfangs die größten, × entfernt, „+ Konto“, „die 5 größten“
  const ko = () => p.evaluate(() => [...document.querySelectorAll('[data-sec="jv-konto"] tbody tr')].map(t => t.querySelector('.jv-in').textContent.trim() + ':' + t.children[1].textContent).join('|'));
  ok(await ko() === 'Hospiz:5.000 €|Brakel:540 €|Lage:240 €|Siegen:0 €', 'F: die größten Konten als Tabelle (Summe aller gewählten Jahre)');
  await p.click('[data-sec="jv-konto"] .sp-x[aria-label="Brakel entfernen"]'); await p.waitForTimeout(250);
  await p.click('.jv-kadd'); await p.waitForTimeout(150);
  const f1 = await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-kpop .mitem')].map(b => b.textContent).join('|'));
  await p.click('.menu.pop .jv-kpop .mitem'); await p.waitForTimeout(250);
  const f2 = await p.evaluate(() => [JSON.stringify(UI.jvKonten.map(e => [e.k.replace('Paderborn - ', ''), e.c])), !!document.querySelector('.jv-ktop')]);
  ok(f1 === 'Brakel690 €' && f2[0] === '[["Hospiz",0],["Lage",2],["Siegen",3],["Brakel",1]]' && f2[1], 'F: Brakel entfernt und über „+ Konto“ wieder dazu – die anderen behalten ihre Farbe ' + f2[0]);
  await p.click('.jv-ktop'); await p.waitForTimeout(250);
  ok(await ko() === 'Hospiz:5.000 €|Brakel:540 €|Lage:240 €|Siegen:0 €' && await p.evaluate(() => UI.jvKonten === undefined), 'F: „die 5 größten“ – wieder die größten Konten');

  // ---- G: Dauerspender:innen – drei Kacheln (Anzahl, Summe, Ø Monatsbeitrag) mit Veränderung, darunter Zu- und Abgänge
  const g0 = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-sec="jv-dauer"] .jv-mt1')].map(t => [t.dataset.k, t.querySelector('.jv-mtv').textContent + ' (' + t.querySelector('.jv-mts').textContent + ')'])));
  ok(g0.dauer === '2 (■ ±0,0 % · 2025: 2)' && g0.daSum === '480 € (▲ +33,3 % · 2025: 360 €)' && g0.daMon === '20,00 € (▲ +33,3 % · 2025: 15,00 €)',
    'G: 2 Dauerspender:innen, 480 € aus Daueraufträgen, Ø Monatsbeitrag 20,00 € (vierteljährlich 60 € = 20 € im Monat)');
  ok(await p.evaluate(() => document.querySelector('[data-sec="jv-dauer"] .jv-flow')?.textContent === '2→+1 neu−1 beendet→2' && !document.querySelector('.jv-dazu')), 'G: Zu- und Abgänge immer sichtbar: 2 → +1 neu −1 beendet → 2');

  // ---- I: ⓘ kurz, „So wird gerechnet“ ausführlich; Reihenfolge (↑/↓ unter „Bausteine“ und Ziehen am Griff), PDF für die Präsentation
  const i9 = await p.evaluate(() => [...document.querySelectorAll('#main .sec-h .info')].map(i => (TIPS.get(i) || '').length));
  ok(i9.length === 13 && i9.every(n => n > 20 && n <= 100), 'I: jeder Abschnitt hat ein kurzes ⓘ (' + Math.max(...i9) + ' Zeichen höchstens)');
  await p.click('.jv-bbtn'); await p.waitForTimeout(150);
  await p.click('.menu.pop .jv-brow:has-text("Kennzahlen") .jv-mv[aria-label$="nach oben"]'); await p.waitForTimeout(400);
  const i0 = await p.evaluate(() => [JSON.stringify(UI.jvOrder), [...document.querySelectorAll('#main .sec')].map(e => e.dataset.sec.replace('jv-', '')).join(), !!document.querySelector('.menu.pop .jv-bpop'), UI_KEYS.includes('jvOrder'), [...document.querySelectorAll('.jv-grid2')].length]);
  ok(i0[0] === '["blick","ziel","verlauf","herkunft","bruecke","kpi","bindung","mail","seg","zweck","konto","dauer","top"]' && i0[1].startsWith('blick,ziel,verlauf,herkunft,bruecke,kpi,bindung,') && i0[2] && i0[3] && i0[4] === 1,
    'I: „↑“ bei Kennzahlen – steht jetzt zwischen Brücke und Bindung (die beiden nicht mehr nebeneinander), gemerkt; „Bausteine“ bleibt offen');
  await p.keyboard.press('Escape');
  await p.evaluate(() => { UI.jvOrder = undefined; renderNow(); }); await p.waitForTimeout(300);
  await p.setViewportSize({ width: 1400, height: 6600 }); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);   // Griff und Ziel gleichzeitig im Bild
  const gp = await p.evaluate(() => { const g = document.querySelector('[data-sec="jv-dauer"] .sec-h .jv-drag').getBoundingClientRect(), t = document.querySelector('[data-sec="jv-mail"] .sec-h').getBoundingClientRect();
    return [g.x + g.width / 2, g.y + g.height / 2, t.x + 200, t.y + 6]; });
  await p.mouse.move(gp[0], gp[1]); await p.mouse.down(); await p.mouse.move(gp[0] + 4, gp[1] - 20, { steps: 4 }); await p.mouse.move(gp[2], gp[3], { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(400);
  await p.setViewportSize({ width: 1400, height: 1000 });
  const i1 = await p.evaluate(() => [...document.querySelectorAll('#main .sec')].map(e => e.dataset.sec.replace('jv-', '')).join());
  ok(i1 === 'blick,ziel,verlauf,herkunft,bruecke,bindung,kpi,dauer,mail,seg,zweck,konto,top', 'I: „Dauerspender:innen“ am Griff über „Mailings“ gezogen – steht jetzt davor (' + i1 + ')');
  await p.evaluate(() => { UI.jvOrder = undefined; renderNow(); }); await p.waitForTimeout(300);
  const i2 = await p.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; document.querySelector('.jv-pdf').click(); return new Promise(r => setTimeout(() => r([window.__printed,
    [...document.querySelectorAll('#printdoc .pd-page .pd-head h1')].map(e => e.textContent).join(' | '), document.body.classList.contains('printdoc-mode'), document.querySelectorAll('#printdoc [data-chart] svg').length,
    /Sondereffekte herausgerechnet · Vergleich mit 2025/.test(document.querySelector('#printdoc .pd-head span').textContent), document.querySelectorAll('#printdoc input, #printdoc select, #printdoc .jv-hide').length]), 300)); });
  ok(i2[0] === 1 && i2[1] === 'Auf einen Blick 2026 | Jahresziel & Hochrechnung 2026 | Jahresverlauf & Quartale 2026 | Quartale in Zahlen 2026 | Privat & Institutionen 2026 | Spendenbrücke 2025 → 2026 · Spenderbindung 2026 | Kennzahlen 2026 | Mailings vergleichen | Spendersegmente | Zwecke über die Jahre · Konten über die Jahre | Dauerspender:innen 2026 | Größte Spender:innen 2026' && i2[2] && i2[3] >= 4 && i2[4],
    'I: „PDF für die Präsentation“ – gleiche Reihenfolge wie am Bildschirm, Paare auf einer Seite, Einstellungen im Kopf: ' + i2[1]);
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('#printdoc') && !document.body.classList.contains('printdoc-mode')), 'I: nach dem Drucken ist die Druckansicht wieder weg');
  // ---- H: Bausteine ausblenden – Zwecke weg, Konten über die ganze Breite
  await p.click('[data-sec="jv-zweck"] .jv-hide'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !document.querySelector('[data-sec="jv-zweck"]') && [...document.querySelectorAll('.jv-grid2')].length === 1 && !!document.querySelector('.jv > [data-sec="jv-konto"]')), 'H: „Zwecke“ ausgeblendet – „Konten“ allein über die ganze Breite');
  await finish(b, pages);
})();
