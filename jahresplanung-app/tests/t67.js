// 0.21–0.25 Jahresvergleich: Kennzahlen einzeln ausblenden, Säulen mittig, ausgeblendete Sondereffekte als Liste, Jahr hervorheben,
// Spendersegmente (Jahre wählbar, Jahr und Zahl am Balken), Zwecke und Konten nebeneinander, Dauerspender:innen (Kacheln, Zu-/Abgänge per Schalter)
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
  await p.waitForFunction(() => SP.at && SP.rows.length === 45); await p.waitForTimeout(400);

  // ---- A: Kennzahlen – Kopf abgesetzt, Säulen bei zwei Jahren mittig nebeneinander, einzeln ausblenden
  const a0 = await p.evaluate(() => { const k = document.querySelector('[data-sec="jv-kpi"] .jv-kpi'); return [document.querySelector('[data-sec="jv-kpi"] .sec-t').textContent, k.querySelector('.jv-kh .jv-kt').textContent, k.querySelector('.jv-kh .jv-kv').textContent,
    getComputedStyle(k.querySelector('.jv-kh')).backgroundColor !== getComputedStyle(k.querySelector('.jv-kd')).backgroundColor, getComputedStyle(k.querySelector('.jv-kh')).borderBottomStyle,
    [...k.querySelectorAll('.jv-lad rect')].map(r => r.getAttribute('x')).join(), document.querySelectorAll('[data-sec="jv-kpi"] .jv-kpi').length]; });
  ok(a0[0] === 'Kennzahlen' && a0[1] === 'Spendensumme' && a0[2] === '5.780 €' && a0[3] && a0[4] === 'solid', 'A: „Kennzahlen“ – Titel und Zahl im abgesetzten Kopf mit Linie darunter, Säulen auf weißem Grund');
  ok(a0[5] === '110.5,205.5' && a0[6] === 6, 'A: zwei Jahre – die Säulen stehen mittig nebeneinander (x ' + a0[5] + ')');
  await p.hover('[data-sec="jv-kpi"] .jv-kpi[data-k="n"]'); await p.click('[data-sec="jv-kpi"] .jv-kpi[data-k="n"] .jv-kx'); await p.waitForTimeout(250);
  await p.hover('[data-sec="jv-kpi"] .jv-kpi[data-k="neu"]'); await p.click('[data-sec="jv-kpi"] .jv-kpi[data-k="neu"] .jv-kx'); await p.waitForTimeout(250);
  const a1 = await p.evaluate(() => [[...document.querySelectorAll('[data-sec="jv-kpi"] .jv-kpi')].map(k => k.dataset.k).join(), document.querySelector('[data-sec="jv-kpi"] .jv-kpis').className, JSON.stringify(UI.jvKHide), UI_KEYS.includes('jvKHide')]);
  ok(a1[0] === 'sum,don,avg,dauer' && /\bc2\b/.test(a1[1]) && a1[2] === '{"n":true,"neu":true}' && a1[3], 'A: „Spenden“ und „Neue Spender:innen“ ausgeblendet – vier Kacheln in zwei Spalten, gemerkt');
  // Klick auf Kacheln: hervorheben, die anderen treten zurück; noch ein Klick nimmt sie heraus; Klick daneben hebt die Auswahl auf
  const kf = () => p.evaluate(() => [document.querySelector('[data-sec="jv-kpi"] .jv-kpis').classList.contains('jv-kfocus'), [...document.querySelectorAll('[data-sec="jv-kpi"] .jv-kpi.jv-ksel')].map(k => k.dataset.k).join(),
    getComputedStyle(document.querySelector('[data-sec="jv-kpi"] .jv-kpi[data-k="avg"]')).opacity]);
  await p.click('[data-sec="jv-kpi"] .jv-kpi[data-k="sum"]'); await p.click('[data-sec="jv-kpi"] .jv-kpi[data-k="don"]'); await p.waitForTimeout(250);
  const k0 = await kf();
  await p.click('[data-sec="jv-kpi"] .jv-kpi[data-k="sum"]'); await p.waitForTimeout(250);
  const k1 = await kf();
  await p.click('[data-sec="jv-kpi"] .sec-h', { position: { x: 400, y: 10 } }); await p.waitForTimeout(250);
  const k2 = await kf();
  ok(k0[0] && k0[1] === 'sum,don' && +k0[2] < 0.5 && k1[1] === 'don' && !k2[0] && k2[1] === '' && k2[2] === '1', 'A: Klick auf Kacheln hebt sie hervor (die anderen blass), noch ein Klick nimmt sie heraus, Klick daneben zeigt wieder alle');
  await p.click('.jv-bbtn'); await p.waitForTimeout(150);
  const a2 = await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-bpop .jv-brow label.mchk')].map(l => l.textContent).join('|') + ' / ' + [...document.querySelectorAll('.menu.pop .jv-bsub label')].map(l => l.textContent + (l.querySelector('input').checked ? '+' : '-')).join('|'));
  ok(a2 === 'Kennzahlen|Jahresverlauf & Quartale|Mailings vergleichen|Spendersegmente|Zwecke über die Jahre|Konten über die Jahre|Dauerspender:innen / Spendensumme+|Spender:innen+|Ø je Spende+|Spenden-|Neue Spender:innen-|Dauerspender:innen+',
    'A: „Bausteine“ – alle Bausteine, unter „Kennzahlen“ jede Kennzahl einzeln (Ø je Spende statt je Spender:in)');
  await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-bsub label')].find(l => l.textContent === 'Spenden').querySelector('input').click()); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !!document.querySelector('[data-sec="jv-kpi"] .jv-kpi[data-k="n"]') && !UI.jvKHide.n), 'A: über „Bausteine“ wieder eingeblendet');
  await p.keyboard.press('Escape');

  // ---- B: Sondereffekte – die ausgeblendeten Spenden je Jahr als Liste
  ok(await p.evaluate(() => !document.querySelector('.jv-sxt') && /Sondereffekt anzeigen/.test(document.querySelector('.jv-sxtog').textContent) && document.querySelector('.jv-sxmode').value === 'out'), 'B: Sondereffekte anfangs herausgerechnet, ihre Liste zu');
  await p.click('.jv-sxtog'); await p.waitForTimeout(250);
  const b0 = await p.evaluate(() => [...document.querySelectorAll('.jv-sxt tr')].map(r => [...r.children].map(c => c.textContent).join('|')));
  ok(b0.length === 1 && b0[0] === '2026|15.06.2026|30.000,00 €|Probe 7|Nachlass Probe|Lage|', 'B: „Herausgerechnet“ – 2026: 15.06.2026, 30.000,00 €, Name, Verwendungszweck, Gliederung');
  ok(await p.evaluate(() => !document.querySelector('.jv-bar .jv-sxt') && !!document.querySelector('.jv > .jv-sxl .jv-sxt') && getComputedStyle(document.querySelector('.jv-bar')).position === 'sticky'),
    'B: die Leiste bleibt beim Scrollen stehen, die Liste steht darunter (scrollt mit)');

  // ---- C: Jahresverlauf – Klick auf ein Jahr hebt es hervor, die anderen werden blass; noch einmal: wieder alle
  await p.click('.jv-legy:has-text("2025")'); await p.waitForTimeout(300);
  const c0 = await p.evaluate(() => [JV.focus, document.querySelectorAll('[data-chart="jvcum"] polyline.jv-dim').length, document.querySelectorAll('[data-chart="jvcum"] polyline').length, document.querySelector('.jv-legy.on')?.textContent, document.querySelectorAll('.jv-legy.dim').length]);
  ok(c0.join() === '2025,1,2,2025,1', 'C: Klick auf „2025“ – 2025 hervorgehoben, 2026 blass');
  await p.evaluate(() => document.querySelector('[data-chart="jvcum"] .jv-elab:not(.jv-dim)').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JV.focus === null && !document.querySelector('[data-chart="jvcum"] .jv-dim')), 'C: Klick auf die Beschriftung des hervorgehobenen Jahres – wieder alle gleich');

  // ---- D: Spendersegmente – die oben gewählten Jahre, an jedem Balken Jahr und Zahl, keine Prozente; Ø je Spende im Hinweis
  const d0 = await p.evaluate(() => { const v = [...document.querySelectorAll('[data-chart="jvseg"] .jv-sgv')].map(t => t.textContent), out = [];
    for (let i = 0; i < v.length; i += 4) out.push(v.slice(i, i + 4).join(' / '));
    return [[...document.querySelectorAll('[data-sec="jv-seg"] .jv-leg > span')].map(c => c.textContent).join('|'), out, /%/.test(document.querySelector('[data-chart="jvseg"]').textContent),
      [...document.querySelectorAll('[data-chart="jvseg"] .jv-sgl')].map(t => t.textContent).join('|'), !document.querySelector('.jv-segy')]; });
  ok(d0[0] === '2025|2026 (Hauptjahr)' && d0[3] === 'ab 5.000 €|1.000–4.999 €|500–999 €|250–499 €|101–249 €|bis 100 €' && !d0[2] && d0[4], 'D: sechs Segmente, die oben gewählten Jahre, keine eigene Jahresauswahl, keine Prozentangaben');
  ok(JSON.stringify(d0[1]) === JSON.stringify(['2025: 0 / 2025: 0 € / 2026: 1 / 2026: 5.000 €', '2025: 0 / 2025: 0 € / 2026: 0 / 2026: 0 €', '2025: 0 / 2025: 0 € / 2026: 0 / 2026: 0 €',
    '2025: 0 / 2025: 0 € / 2026: 1 / 2026: 300 €', '2025: 3 / 2025: 510 € / 2026: 2 / 2026: 480 €', '2025: 1 / 2025: 50 € / 2026: 0 / 2026: 0 €']), 'D: an jedem Balken Jahr und Zahl: ' + d0[1].join(' · '));

  // ---- E: Zwecke über die Jahre – Linie je Zweck, „zweckungebunden“ anfangs aus, Klick blendet ein
  const zw = () => p.evaluate(() => [[...document.querySelectorAll('[data-sec="jv-zweck"] .jv-pk')].map(c => c.textContent + (c.classList.contains('off') ? '-' : '+')).join('|'), document.querySelectorAll('[data-chart="jvzw"] polyline').length,
    [...document.querySelectorAll('[data-chart="jvzw"] .jv-elab, [data-chart="jvzw"] .jv-elv')].map(t => t.textContent).join('|')]);
  const e0 = await zw();
  ok(e0[0] === 'Hospizarbeit+|Rikscha+|zweckungebunden-' && e0[1] === 2 && e0[2] === 'Hospizarbeit|5.000 €|Rikscha|300 €▲ +100,0 %', 'E: Zwecke als Linien, rechts Wert 2026 und Veränderung (' + e0[2] + ')');
  await p.click('[data-sec="jv-zweck"] .jv-pk:has-text("zweckungebunden")'); await p.waitForTimeout(300);
  const e1 = await zw();
  ok(e1[1] === 3 && /zweckungebunden\|480 €▲ \+17,1 %/.test(e1[2]) && JSON.stringify(await p.evaluate(() => UI.jvZHide)) === '{"?":true}', 'E: „zweckungebunden“ eingeblendet (410 € → 480 €), gemerkt');

  ok(await p.evaluate(() => [...document.querySelectorAll('.jv-grid2 > .sec')].map(e => e.dataset.sec).join() === 'jv-zweck,jv-konto'), 'E: Zwecke und Konten nebeneinander');
  // ---- F: Konten über die Jahre – anfangs die größten, entfernen, „+ Konto“, „die 5 größten“
  const kt = () => p.evaluate(() => [[...document.querySelectorAll('[data-sec="jv-konto"] .jv-pk')].map(c => c.textContent.replace('×', '')).join('|'), document.querySelectorAll('[data-chart="jvkt"] polyline').length]);
  const f0 = await kt();
  ok(f0[0] === 'Hospiz|Brakel|Lage|Siegen' && f0[1] === 4, 'F: die größten Konten (' + f0[0] + '), je Konto eine Linie');
  await p.click('[data-sec="jv-konto"] .jv-pk:has-text("Brakel") .sp-x'); await p.waitForTimeout(250);
  await p.click('.jv-kadd'); await p.waitForTimeout(150);
  const f1 = await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-kpop .mitem')].map(b => b.textContent).join('|'));
  await p.click('.menu.pop .jv-kpop .mitem'); await p.waitForTimeout(250);
  const f2 = await p.evaluate(() => [JSON.stringify(UI.jvKonten.map(e => [e.k.replace('Paderborn - ', ''), e.c])), !!document.querySelector('.jv-ktop')]);
  ok(f1 === 'Brakel690 €' && f2[0] === '[["Hospiz",0],["Lage",2],["Siegen",3],["Brakel",1]]' && f2[1], 'F: Brakel entfernt und über „+ Konto“ wieder dazu – die anderen behalten ihre Farbe ' + f2[0]);
  await p.click('.jv-ktop'); await p.waitForTimeout(250);
  ok((await kt())[0] === 'Hospiz|Brakel|Lage|Siegen' && await p.evaluate(() => UI.jvKonten === undefined), 'F: „die 5 größten“ – wieder die größten Konten');

  // ---- G: Dauerspender:innen – Anzahl, Summe, Ø Monatsbeitrag; Zu- und Abgänge (Anfang, neu, beendet, Ende)
  const g0 = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-sec="jv-dauer"] .jv-kpi')].map(k => [k.querySelector('.jv-kt').textContent, k.querySelector('.jv-kv').textContent + ' (' + [...k.querySelectorAll('.jv-lv')].map(t => t.textContent).join('|') + ')'])));
  ok(g0['Dauerspender:innen im Jahr'] === '2 (2|2)' && g0['Summe aus Daueraufträgen'] === '480 € (360 €|480 €)' && g0['Ø Monatsbeitrag'] === '20,00 € (15,00 €|20,00 €)',
    'G: 2 Dauerspender:innen, 480 € aus Daueraufträgen, Ø Monatsbeitrag 20,00 € (vierteljährlich 60 € = 20 € im Monat)');
  ok(await p.evaluate(() => !document.querySelector('[data-sec="jv-dauer"] .jv-brg') && !document.querySelector('[data-sec="jv-dauer"] .jv-zu')), 'G: keine Brücken; Zu- und Abgänge anfangs aus');
  await p.click('[data-sec="jv-dauer"] .jv-dazu'); await p.waitForTimeout(300);
  const g1 = await p.evaluate(() => { const k = document.querySelector('[data-sec="jv-dauer"] .jv-kpi'); return [[...k.querySelectorAll('.jv-zu, .jv-ab')].map(t => t.textContent).join('|'), k.querySelector('.jv-kn')?.textContent, document.querySelector('.jv-dazu').textContent, UI.jvDaZu]; });
  ok(g1[0] === '+1|−1' && /\+ Zugänge \/ − Abgänge gegenüber dem Vorjahr/.test(g1[1]) && g1[2] === 'Zu- und Abgänge ausblenden' && g1[3] === true, 'G: „Zu- und Abgänge einblenden“ – 2026: +1 / −1 unter der Anzahl (2025 ohne Vorjahr)');
  // ---- I: ⓘ je Abschnitt, Farben, Reihenfolge (↑/↓ unter „Bausteine“ und Ziehen am Griff), PDF für die Präsentation
  ok(await p.evaluate(() => ['kpi', 'verlauf', 'mail', 'seg', 'zweck', 'konto', 'dauer'].every(k => { const i = document.querySelector('[data-sec="jv-' + k + '"] .sec-h .info'); return i && TIPS.get(i) && TIPS.get(i).length > 60; })),
    'I: jeder Abschnitt hat ein ⓘ mit der Rechenregel');
  ok(await p.evaluate(() => [...document.querySelector('[data-sec="jv-kpi"] .jv-kpi').querySelectorAll('rect')].map(r => r.getAttribute('fill')).join() === 'var(--jvV),var(--jvH)'), 'I: Hauptjahr kräftig blau, Vergleichsjahr (Vorjahr) mittelblau');
  await p.click('.jv-bbtn'); await p.waitForTimeout(150);
  await p.click('.menu.pop .jv-brow:has-text("Kennzahlen") .jv-mv[aria-label$="nach unten"]'); await p.waitForTimeout(400);
  const i0 = await p.evaluate(() => [JSON.stringify(UI.jvOrder), [...document.querySelectorAll('#main .sec')].map(e => e.dataset.sec).join(), !!document.querySelector('.menu.pop .jv-bpop'), UI_KEYS.includes('jvOrder')]);
  ok(i0[0] === '["verlauf","kpi","mail","seg","zweck","konto","dauer"]' && i0[1].startsWith('jv-verlauf,jv-kpi,') && i0[2] && i0[3], 'I: „↓“ bei Kennzahlen – Kennzahlen stehen jetzt unter dem Jahresverlauf, gemerkt; „Bausteine“ bleibt offen');
  await p.keyboard.press('Escape');
  await p.setViewportSize({ width: 1400, height: 3400 }); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);   // Griff und Ziel gleichzeitig im Bild
  const gp = await p.evaluate(() => { const g = document.querySelector('[data-sec="jv-dauer"] .sec-h .jv-drag').getBoundingClientRect(), t = document.querySelector('[data-sec="jv-mail"] .sec-h').getBoundingClientRect();
    return [g.x + g.width / 2, g.y + g.height / 2, t.x + 200, t.y + 6]; });
  await p.mouse.move(gp[0], gp[1]); await p.mouse.down(); await p.mouse.move(gp[0] + 4, gp[1] - 20, { steps: 4 }); await p.mouse.move(gp[2], gp[3], { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(400);
  await p.setViewportSize({ width: 1400, height: 1000 });
  const i1 = await p.evaluate(() => [...document.querySelectorAll('#main .sec')].map(e => e.dataset.sec.replace('jv-', '')).join());
  ok(i1 === 'verlauf,kpi,dauer,mail,seg,zweck,konto', 'I: „Dauerspender:innen“ am Griff über „Mailings“ gezogen – steht jetzt davor (' + i1 + ')');
  await p.evaluate(() => { UI.jvOrder = undefined; renderNow(); }); await p.waitForTimeout(300);
  const i2 = await p.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; document.querySelector('.jv-pdf').click(); return new Promise(r => setTimeout(() => r([window.__printed,
    [...document.querySelectorAll('#printdoc .pd-page .pd-head h1')].map(e => e.textContent).join(' | '), document.body.classList.contains('printdoc-mode'), document.querySelectorAll('#printdoc [data-chart] svg').length,
    /Sondereffekte herausgerechnet · Vergleich mit 2025/.test(document.querySelector('#printdoc .pd-head span').textContent)]), 300)); });
  ok(i2[0] === 1 && i2[1] === 'Kennzahlen 2026 | Jahresverlauf & Quartale 2026 | Quartale in Zahlen 2026 | Mailings vergleichen | Spendersegmente | Zwecke über die Jahre · Konten über die Jahre | Dauerspender:innen 2026' && i2[2] && i2[3] >= 5 && i2[4],
    'I: „PDF für die Präsentation“ – je Abschnitt eine Seite in der eingestellten Reihenfolge, Zwecke und Konten auf einer Seite, mit Einstellungen im Kopf');
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('#printdoc') && !document.body.classList.contains('printdoc-mode')), 'I: nach dem Drucken ist die Druckansicht wieder weg');
  // ---- H: Bausteine ausblenden – Zwecke weg, Konten über die ganze Breite
  await p.click('[data-sec="jv-zweck"] .jv-hide'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !document.querySelector('[data-sec="jv-zweck"]') && !document.querySelector('.jv-grid2') && !!document.querySelector('.jv > [data-sec="jv-konto"]')), 'H: „Zwecke“ ausgeblendet – „Konten“ allein über die ganze Breite');
  await finish(b, pages);
})();
