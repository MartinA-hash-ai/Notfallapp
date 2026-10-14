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
  ok(a2 === 'Auf einen Blick|Hochrechnung|Kennzahlen|Jahresverlauf & Quartale|Privat & Institutionen|Spendenbrücke|Spendersegmente|Spenderbindung|Dauerspender:innen|Maßnahmen vergleichen|Zwecke über die Jahre|Konten über die Jahre|Größte Spender:innen / Spendensumme+|Spender:innen+|Ø je Spende+|Spenden+|Dauerspender:innen+|Anteil der größten 10 %+|Erstmals gespendet-',
    'A: „Bausteine“ – alle Bausteine, unter „Kennzahlen“ jede Kennzahl einzeln (ohne Median; „Erstmals“ anfangs aus)');
  await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-bsub label')].find(l => l.textContent === 'Spenden').querySelector('input').click()); await p.waitForTimeout(250);
  const a3 = await p.evaluate(() => [[...document.querySelectorAll('.jv-kt tbody tr')].map(t => t.dataset.k).join(), JSON.stringify(UI.jvKHide), UI_KEYS.includes('jvKHide'), !!document.querySelector('.menu.pop .jv-bpop')]);
  ok(a3[0] === 'sum,don,avg,dauer,top' && a3[1] === '{"n":true}' && a3[2] && a3[3], 'A: „Spenden“ ausgeblendet – Zeile weg, gemerkt; „Bausteine“ bleibt offen');
  await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-bsub label')].find(l => l.textContent === 'Erstmals gespendet').querySelector('input').click()); await p.waitForTimeout(250);
  await p.evaluate(() => [...document.querySelectorAll('.menu.pop .jv-bsub label')].find(l => l.textContent === 'Spenden').querySelector('input').click()); await p.waitForTimeout(250);
  ok(await p.evaluate(() => [...document.querySelectorAll('.jv-kt tbody tr')].map(t => t.dataset.k).join() === 'sum,don,avg,n,dauer,top,neu' && JSON.stringify(UI.jvKHide) === '{"n":false,"neu":false}'), 'A: „Erstmals“ eingeblendet, „Spenden“ wieder da');
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

  // ---- D: Spendersegmente – je gewähltem Jahr eine Zeile: links Anteil an den Spender:innen, rechts an der Summe (nebeneinander); keine Bänder; ein Satz darunter
  const d0 = await p.evaluate(() => { const c = document.querySelector('[data-chart="jvseg"]');
    return [[...document.querySelectorAll('.jv-seglg > span')].map(s => s.textContent).join('|'), [...c.querySelectorAll('.jv-sgt')].map(t => t.textContent).join('|'), [...c.querySelectorAll('.jv-pisy')].map(t => t.textContent + (t.classList.contains('on') ? '*' : '')).join('|'),
      c.querySelectorAll('rect.jv-sgb').length, c.querySelectorAll('.jv-sgr, .jv-sgb.old').length, [...c.querySelectorAll('.jv-sgp')].map(t => t.textContent).join('|'), [...c.querySelectorAll('.jv-lv')].map(t => t.textContent).join('|'),
      document.querySelector('.jv-ins')?.textContent, !document.querySelector('.jv-gctl'), Math.round(c.getBoundingClientRect().height)]; });
  ok(d0[0] === 'bis 100 €|101–249 €|250–499 €|500–999 €|1.000–4.999 €|ab 5.000 €' && d0[1] === 'Spender:innen|Spendensumme' && d0[2] === '2025|2026*' && d0[3] === 10 && d0[4] === 0,
    'D: Legende von klein nach groß; je Jahr (2025, 2026) eine Zeile – Spender:innen und Summe nebeneinander; keine Bänder dazwischen');
  ok(d0[5] === '25 %|75 %|9 %|91 %|50 %|25 %|25 %|8 %|5%|87 %' && d0[6] === '4|560 €|4|5.780 €' && d0[7] == null && d0[8] && await p.evaluate(() => { const c = document.querySelector('[data-chart="jvseg"]'), l = document.querySelector('.jv-seglg'); return !!(c.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING); }),
    'D: Anteile im Balken (knappe Abschnitte kleiner ohne Leerzeichen), hinter jedem Balken die Gesamtzahl; Legende unter der Grafik, kein Satz mehr; keine eigene Auswahl im Abschnitt');
  const dt = await p.evaluate(() => [...document.querySelectorAll('[data-chart="jvseg"] .jv-sgrow.main .jv-sgb')].map(r => { const f = TIPS.get(r); const v = typeof f === 'function' ? f() : f; return typeof v === 'string' ? v : v.textContent; }).join(' | '));
  ok(dt === '50 % · 2 Spender:innen | 25 % · 1 Spender:in | 25 % · 1 Spender:in | 8 % · 480 € | 5 % · 300 € | 87 % · 5.000 €', 'D: Zeigen nennt nur Anteil und absolute Zahl: ' + dt);
  const d1 = await p.evaluate(() => { const g = [...document.querySelectorAll('[data-chart="jvseg"] .jv-sgrow')], r = g.find(x => x.classList.contains('old')).querySelector('.jv-sgb');
    return [g.map(x => x.classList.contains('main') ? 'H' : 'o').join(''), getComputedStyle(r).fillOpacity, getComputedStyle(g.find(x => x.classList.contains('main')).querySelector('.jv-sgb')).fillOpacity]; });
  await p.mouse.move(2, 2); await p.waitForTimeout(250);
  const d3 = await p.evaluate(() => { const o = document.querySelector('[data-chart="jvseg"] .jv-sgrow.old'), m = document.querySelector('[data-chart="jvseg"] .jv-sgrow.main'), cs = e => getComputedStyle(e);
    return [cs(o.querySelector('.jv-sgp')).opacity, cs(o.querySelector('.jv-lv')).opacity, cs(m.querySelector('.jv-sgp')).opacity, cs(o.querySelector('.jv-pisy')).fontWeight, cs(m.querySelector('.jv-pisy')).fontWeight]; });
  await p.hover('[data-chart="jvseg"] .jv-sgrow.old .jv-sgb', { force: true }); await p.waitForTimeout(250);
  const d2 = await p.evaluate(() => getComputedStyle(document.querySelector('[data-chart="jvseg"] .jv-sgrow.old .jv-sgb')).fillOpacity);
  ok(d1[0] === 'oH' && d1[1] === '0.3' && d1[2] === '1' && d2 === '1', 'D: Hauptjahr kräftig, die Vorjahre blass und dünn – beim Zeigen kräftig und dick');
  ok(d3.join() === '0,0,1,400,700', 'D: Vorjahre ohne Zahlen (erst beim Zeigen), Jahreszahl dezent: ' + d3.join());
  await p.click('[data-sec="jv-seg"] .jv-dens'); await p.waitForTimeout(350);
  const d4 = await p.evaluate(() => { const o = document.querySelector('[data-chart="jvseg"] .jv-sgrow.old'), cs = e => getComputedStyle(e);
    return [cs(o.querySelector('.jv-sgp')).opacity, cs(o.querySelector('.jv-sgb')).transform, cs(o.querySelector('.jv-sgb')).fillOpacity, document.querySelector('[data-sec="jv-seg"] .jv-dens').textContent, UI.jvSegFull, UI_KEYS.includes('jvSegFull')].join(); });
  await p.click('[data-sec="jv-seg"] .jv-dens'); await p.waitForTimeout(350);
  ok(d4 === '1,none,1,kompakt,true,true' && await p.evaluate(() => UI.jvSegFull === false), 'D: „ausführlich“ – alle Jahre breit mit Zahlen; „kompakt“ wieder schmal (gemerkt)');
  const d5 = await p.evaluate(() => { const r = [...document.querySelectorAll('[data-chart="jvseg"] .jv-sgrow.main .jv-sgb')].map(e => [+e.getAttribute('x'), +e.getAttribute('width')]); return r.length > 1 ? Math.round((r[1][0] - (r[0][0] + r[0][1])) * 10) / 10 : null; });
  ok(d5 === 3, 'D: 3 px Abstand zwischen den Segmenten (' + d5 + ')');
  ok(d0[9] === 2 * 26 + 24 + 4, 'D: Höhe wächst mit der Zahl der Jahre (' + d0[9] + ' px bei zwei Jahren)');
  const d6 = await p.evaluate(() => { const g = document.querySelector('[data-chart="jvseg"]'), c = g.getBoundingClientRect(), m = g.querySelector('.jv-sgrow.main');
    const col = n => getComputedStyle(document.documentElement).getPropertyValue('--jvs' + n).trim().toLowerCase();
    const fills = [...g.querySelectorAll('.jv-sgb')].map(r => r.getAttribute('fill') + '=' + getComputedStyle(r).fill), tx = [...g.querySelectorAll('.jv-sgp')].map(t => (t.classList.contains('inv') ? 'w' : 'd') + getComputedStyle(t).fill);
    return [[1, 2, 3, 4, 5, 6].map(col).join(','), fills.find(f => f.startsWith('var(--jvs1)')), tx.every(t => t === 'wrgb(255, 255, 255)' || t === 'drgb(29, 29, 27)') && tx.some(t => t[0] === 'w') && tx.some(t => t[0] === 'd'),
      Math.round(Math.max(...[...m.querySelectorAll('.jv-sgb')].map(r => r.getBoundingClientRect().right)) - c.left), Math.round(c.width), [...m.querySelectorAll('.jv-sgb')].filter(r => r.getBoundingClientRect().right < c.left + c.width / 2).length, tx.join(' ')]; });
  ok(d6[0] === '#1b6f46,#58b07a,#d6b318,#e3731f,#c92a46,#6e1a2a' && d6[1] === 'var(--jvs1)=rgb(27, 111, 70)', 'D: Segmente von Grün (bis 100 €) über Gelb und Orange bis Dunkelrot (ab 5.000 €): ' + d6[0]);
  ok(d6[2] && d6[5] >= 2 && d6[3] <= d6[4], 'D: Zahlen auf den Segmenten weiß oder dunkel (je nach Farbe); Spender:innen-Balken links, Summe rechts: ' + d6.slice(3).join(' / '));
  // Dunkelmodus: keine dunkle Schrift auf dunklem Grund (Zahlen neben/auf Balken, Tabellen, Kacheln)
  const dk = await p.evaluate(async () => { setTheme('dark'); UI.jvSegFull = true; UI.jvPiFull = true; for (const k of ['seg', 'herkunft', 'bruecke', 'top', 'zweck', 'konto', 'dauer']) UI.secOpen['jv-' + k] = true; renderNow(); await new Promise(r => setTimeout(r, 400));
    const rgb = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: a[0], g: a[1], b: a[2], a: a.length > 3 ? a[3] : 1 }; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const vis = e => { for (let x = e; x && x.nodeType === 1; x = x.parentElement || x.parentNode) { const cs = getComputedStyle(x); if (+cs.opacity < 0.5 || cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
    const under = e => { if (e instanceof SVGElement) { const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;   // Balken unter der Zahl?
        const bar = [...e.parentNode.querySelectorAll('rect')].reverse().find(b => { const q = b.getBoundingClientRect(), f = rgb(getComputedStyle(b).fill); return f && f.a > 0.5 && +getComputedStyle(b).fillOpacity > 0.5 && q.left <= cx && q.right >= cx && q.top <= cy && q.bottom >= cy; }); if (bar) return rgb(getComputedStyle(bar).fill); }
      for (let x = e instanceof SVGElement ? e.ownerSVGElement : e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c && c.a > 0.9) return c; } return { r: 0, g: 0, b: 0, a: 1 }; };
    const bad = []; for (const e of document.querySelectorAll('.jv *')) { const svgT = e instanceof SVGElement && e.tagName === 'text'; if (!svgT && (e instanceof SVGElement || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))) continue;
      if (e.closest('#printdoc') || !e.getClientRects().length || !vis(e)) continue; const fg = rgb(svgT ? getComputedStyle(e).fill : getComputedStyle(e).color); if (!fg || fg.a < 0.5) continue; const k = cr(fg, under(e));
      if (k < 3) bad.push(e.textContent.trim().slice(0, 20) + ' (' + (e.getAttribute('class') || e.tagName) + ', ' + k.toFixed(1) + ')'); }
    setTheme('light'); UI.jvSegFull = false; UI.jvPiFull = false; renderNow(); return bad; });
  ok(dk.length === 0, 'D: Dunkelmodus – alle Zahlen und Texte im Jahresvergleich gut lesbar (Kontrast ≥ 3:1)' + (dk.length ? ': ' + dk.slice(0, 8).join(' · ') : ''));

  // ---- E: Zwecke über die Jahre – Tabelle mit Hauptjahr, Veränderung, Mini-Verlauf (Jahre im Kopf); zweckungebunden unten
  const zw = await p.evaluate(() => [...document.querySelectorAll('[data-sec="jv-zweck"] tr')].map(t => [...t.children].map(c => c.textContent.trim()).join('|')));
  ok(zw.join(' ## ') === '|2026|ggü. 2025|’25’26 ## Hospizarbeit|5.000 €|neu| ## Rikscha|300 €|▲ +100,0 %| ## zweckungebunden|480 €|▲ +17,1 %|' && await p.evaluate(() => !document.querySelector('[data-sec="jv-zweck"] .jv-pk') && document.querySelectorAll('[data-sec="jv-zweck"] .jv-spk').length === 3),
    'E: Zwecke als Tabelle – je Zweck 2026, Veränderung und Mini-Verlauf; keine Linien-Grafik mehr');
  ok(await p.evaluate(() => [...document.querySelectorAll('.jv-grid2')].map(g => [...g.children].map(e => e.dataset.sec).join('/')).join(' ') === 'jv-ziel/jv-kpi jv-bruecke/jv-seg jv-bindung/jv-dauer jv-zweck/jv-konto'), 'E: nebeneinander: Hochrechnung/Kennzahlen, Brücke/Segmente, Bindung/Dauerspender:innen, Zwecke/Konten');
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
  await p.click('.menu.pop .jv-brow:has-text("Kennzahlen") .jv-mv[aria-label$="nach unten"]'); await p.waitForTimeout(400);
  const i0 = await p.evaluate(() => [JSON.stringify(UI.jvOrder), [...document.querySelectorAll('#main .sec')].map(e => e.dataset.sec.replace('jv-', '')).join(), !!document.querySelector('.menu.pop .jv-bpop'), UI_KEYS.includes('jvOrder'), [...document.querySelectorAll('.jv-grid2')].length]);
  ok(i0[0] === '["blick","ziel","verlauf","kpi","herkunft","bruecke","seg","bindung","dauer","mail","zweck","konto","top"]' && i0[1].startsWith('blick,ziel,verlauf,kpi,herkunft,') && i0[2] && i0[3] && i0[4] === 3,
    'I: „↓“ bei Kennzahlen – steht jetzt unter dem Jahresverlauf (nicht mehr neben der Hochrechnung), gemerkt; „Bausteine“ bleibt offen');
  await p.keyboard.press('Escape');
  await p.evaluate(() => { UI.jvOrder = undefined; renderNow(); }); await p.waitForTimeout(300);
  await p.setViewportSize({ width: 1400, height: 6600 }); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);   // Griff und Ziel gleichzeitig im Bild
  const gp = await p.evaluate(() => { const g = document.querySelector('[data-sec="jv-top"] .sec-h .jv-drag').getBoundingClientRect(), t = document.querySelector('[data-sec="jv-mail"] .sec-h').getBoundingClientRect();
    return [g.x + g.width / 2, g.y + g.height / 2, t.x + 200, t.y + 6]; });
  await p.mouse.move(gp[0], gp[1]); await p.mouse.down(); await p.mouse.move(gp[0] + 4, gp[1] - 20, { steps: 4 }); await p.mouse.move(gp[2], gp[3], { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(400);
  await p.setViewportSize({ width: 1400, height: 1000 });
  const i1 = await p.evaluate(() => [...document.querySelectorAll('#main .sec')].map(e => e.dataset.sec.replace('jv-', '')).join());
  ok(i1 === 'blick,ziel,kpi,verlauf,herkunft,bruecke,seg,bindung,dauer,top,mail,zweck,konto', 'I: „Größte Spender:innen“ am Griff über „Maßnahmen vergleichen“ gezogen – steht jetzt davor (' + i1 + ')');
  await p.evaluate(() => { UI.jvOrder = undefined; renderNow(); }); await p.waitForTimeout(300);
  const i2 = await p.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; document.querySelector('.jv-pdf').click(); return new Promise(r => setTimeout(() => r([window.__printed,
    [...document.querySelectorAll('#printdoc .pd-page .pd-head h1')].map(e => e.textContent).join(' | '), document.body.classList.contains('printdoc-mode'), document.querySelectorAll('#printdoc [data-chart] svg').length,
    /Sondereffekte herausgerechnet · Vergleich mit 2025/.test(document.querySelector('#printdoc .pd-head span').textContent), document.querySelectorAll('#printdoc input, #printdoc select, #printdoc .jv-hide').length]), 300)); });
  ok(i2[0] === 1 && i2[1] === 'Auf einen Blick 2026 | Hochrechnung 2026 · Kennzahlen 2026 | Jahresverlauf & Quartale 2026 | Quartale in Zahlen 2026 | Privat & Institutionen 2026 | Spendenbrücke 2025 → 2026 · Spendersegmente | Spenderbindung 2026 · Dauerspender:innen 2026 | Maßnahmen vergleichen | Zwecke über die Jahre · Konten über die Jahre | Größte Spender:innen 2026' && i2[2] && i2[3] >= 4 && i2[4],
    'I: „PDF für die Präsentation“ – gleiche Reihenfolge wie am Bildschirm, Paare auf einer Seite, Einstellungen im Kopf: ' + i2[1]);
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('#printdoc') && !document.body.classList.contains('printdoc-mode')), 'I: nach dem Drucken ist die Druckansicht wieder weg');
  // ein Abschnitt mit Fehler: das PDF entsteht trotzdem, die Seite nennt den Fehler, oben ein Hinweis
  const i3 = await p.evaluate(() => { const keep = jvBindung; window.jvBindung = () => { throw new Error('Testfehler'); };
    window.print = () => { window.__printed = (window.__printed || 0) + 1; }; window.__printed = 0; document.querySelector('.jv-pdf').click();
    return new Promise(r => setTimeout(() => { window.jvBindung = keep;
      r([window.__printed, /Dieser Abschnitt konnte nicht erstellt werden \(Testfehler\)/.test(document.querySelector('#printdoc').textContent), document.querySelectorAll('#printdoc .pd-page').length, /Im PDF fehlt etwas: Spenderbindung: Testfehler/.test(document.body.textContent)]); }, 300)); });
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(150);
  ok(i3[0] === 1 && i3[1] && i3[2] >= 10 && i3[3], 'I: PDF auch dann, wenn ein Abschnitt einen Fehler hat – die Seite nennt ihn, oben ein Hinweis (' + JSON.stringify(i3) + ')');
  // ---- H: Bausteine ausblenden – Zwecke weg, Konten über die ganze Breite
  await p.click('[data-sec="jv-zweck"] .jv-hide'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !document.querySelector('[data-sec="jv-zweck"]') && [...document.querySelectorAll('.jv-grid2')].length === 3 && !!document.querySelector('.jv > [data-sec="jv-konto"]')), 'H: „Zwecke“ ausgeblendet – „Konten“ allein über die ganze Breite');
  await finish(b, pages);
})();
