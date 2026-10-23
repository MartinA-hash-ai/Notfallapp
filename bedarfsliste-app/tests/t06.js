// Vorschau (Artifact): zeichnet ohne Fehler, Liste von links nach rechts (Kerninfo, Freigabe, Finanzierung mit Nachweis, Übergabe), Bedarfsseite mit Phase an der Kopfzeile, rechter Spalte (Kreise), Förderplan mit Übersicht und Karten je Förderer, hell als Standard, dunkel per Einstellung, schmal ohne Querscrollen
const { chromium, ok, open, finish, fs, T } = require('./lib');
(async () => {
  const b = await chromium.launch();
  fs.writeFileSync('vorschau.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(T.PREVIEW, 'utf8') + '</body></html>');
  const file = process.cwd() + '/vorschau.html';
  const p = await open(b, { file, fakefs: false });
  let r = await p.evaluate(() => [...document.querySelectorAll('#list-body tr[data-id]')].map(e => e.dataset.id));
  ok(r[0] === 'b-mtw' && r[1] === 'b-aed', 'hohe Priorität zuerst, dann nach Frist');
  // je Zeile: Name, Summe, Ort · Zuständig · bis; Freigabe; Finanzierungsplan mit Nachweis; Spendenübergabe
  const L = id => p.evaluate(id => { const tr = document.querySelector(`tr[data-id="${id}"]`), t = e => e ? e.innerText.replace(/[✓✕]/g, '').replace(/\s+/g, ' ').trim() : '';
    return { name: t(tr.querySelector('.l-name')), sum: t(tr.querySelector('.l-sum')), meta: t(tr.querySelector('.l-meta')), frDone: !!tr.querySelector('.l-fr .done'),
      fr: [...tr.querySelectorAll('.l-fr .mi')].map(m => m.className.replace('mi m-', '')).join(), fin: [...tr.querySelectorAll('.l-fin .fr')].map(r => r.className.replace('fr', '').trim() + ':' + [...r.children].map(t).filter(Boolean).join(' ')).join(' | '),
      sym: [...tr.querySelectorAll('.l-fin .fr > .mi:first-child')].map(m => m.className.replace('mi m-', '')).join(), leads: tr.querySelectorAll('.l-fin .lead').length, ueb: t(tr.querySelector('.l-ueb')) }; }, id);
  r = await L('b-mtw');
  ok(r.name === 'Mannschaftstransportwagen (MTW) für den Sanitätsdienst (Prio)' && r.sum === '68.000 €' && r.meta === 'Paderborn Thomas Beispiel bis 30.06.2027' && r.frDone, 'Kerninfo: Name mit (Prio), Summe, Ort · Zuständig · bis; Freigabe vollständig blass: ' + JSON.stringify(r));
  ok(r.sym === 'ok,run,off' && r.leads === 1 && r.fin === ':Sparkasse Musterstadt 10.000 € bis 30.09.2027 | :Bürgerstiftung Musterstadt 15.000 € | :Beispiel-Soziallotterie 30.000 € | sum:Eigenmittel 13.000 €' && r.ueb === 'Wache Paderborn',
    'Finanzierung läuft: Kreise nach Stand, nur die Zusage führt gepunktet zum Nachweis, ohne Delta; Übergabe zeigt nur den Ort: ' + r.fin);
  r = await L('b-aed');
  ok(!r.frDone && r.fr === 'ok,off,run,ok' && r.fin.includes('sum:Delta 2.400 €') && r.sym === 'off', 'AED: Freigabe offen (Kreise), Delta 2.400 €: ' + r.fr + ' / ' + r.fin);
  ok((await L('b-rucksack')).fr === 'ok,no,off,ok', 'Rucksäcke: Verwaltung abgelehnt als roter Kreis');
  r = await L('b-waerme');
  ok(r.fin === 'strong:Beispiel-Soziallotterie 12.000 € bis 30.04.2027 | x ab:Volksbank Beispielland eG 2.000 € | x:Stadtwerke Hagen (Beispiel) 1.500 € | sum:Eigenmittel 2.000 €' && r.leads === 1 && r.ueb === 'erledigt am 05.10.2026 Hauptbahnhof Hagen',
    'Finanzierung steht: Zusage kräftig mit Nachweis, Absage und nie Angegangene blass, kein Delta: ' + r.fin);
  r = await L('b-kueche');
  ok(r.fin === 'z:Bürgerstiftung Musterstadt 5.000 € erledigt | z:Sparkasse Musterstadt 3.000 € nicht nötig | sum:Überfinanzierung 500 € | sum:Eigenmittel 2.000 €' && r.leads === 1 && r.meta.endsWith('ohne Deadline')
    && r.ueb.startsWith('Spendenübergabe einleiten Küche wird erst Ende November eingebaut'), 'Küche: erledigte Nachweise blass grün, „nicht nötig“ ohne Linie, Überfinanzierung, Dreieck mit Info: ' + r.fin + ' / ' + r.ueb);
  r = await L('b-klausur');
  ok(r.sym === 'no' && r.fin.includes('ab:Musterstiftung Ehrenamt NRW 2.000 €') && r.fin.includes('sum:Delta 2.000 € | sum:Eigenmittel 500 €') && r.ueb === 'nicht nötig' && r.meta.startsWith('Diözese'), 'Klausur: Absage durchgestrichen, Delta, Übergabe nicht nötig: ' + r.fin);
  r = await p.evaluate(() => [getComputedStyle(document.querySelector('tr[data-id="b-mtw"] .l-name')).verticalAlign, getComputedStyle(document.querySelector('tr[data-id="b-mtw"] .l-meta .ort')).fontWeight,
    getComputedStyle(document.querySelector('tr[data-id="b-klausur"] .fr.sum .fn')).color === getComputedStyle(document.querySelectorAll('tr[data-id="b-klausur"] .fr.sum .fn')[1]).color]);
  ok(r.join() === 'middle,700,true', 'Kerninfo mittig, Ort fett, Delta im selben Schwarz wie die Eigenmittel: ' + r.join());
  // Zeilen von Freigabe und Finanzierungsplan auf einer Höhe
  r = await p.evaluate(() => { const tr = document.querySelector('tr[data-id="b-mtw"]'), mid = e => { const r = e.getBoundingClientRect(); return Math.round(r.top + r.height / 2); };
    const fr = [...tr.querySelectorAll('.l-fr .ml')].map(mid), fin = [...tr.querySelectorAll('.l-fin .fr > .fn')].map(mid);
    const dots = [...tr.querySelectorAll('.l-fr .ml .mi')].map(mid); return [fr, fin, dots]; });
  ok(r[0].every((y, i) => Math.abs(y - r[1][i]) <= 1) && r[2].every((y, i) => Math.abs(y - r[0][i]) <= 1), 'Freigabe und Förderer stehen Zeile für Zeile auf einer Höhe, Punkte mittig zur Schrift: ' + JSON.stringify(r));
  // Zeitstrahl in der Punktlinie zur Frist des Verwendungsnachweises
  r = await p.evaluate(() => { const l = document.querySelector('tr[data-id="b-mtw"] .l-fin .lead.tl'); return l && [l.className, l.title]; });
  ok(r && r[0] === 'lead tl tl-g' && /^noch \d+ Tage bis zur Frist$/.test(r[1]), 'Punktlinie zur Frist: grün, solange viel Zeit ist: ' + JSON.stringify(r));
  r = await p.evaluate(() => { const d = n => new Date(Date.parse(today()) + n * 864e5).toISOString().slice(0, 10);
    const z = fr => { const x = document.createElement('div'); x.innerHTML = zeitstrahl(ff({ status: 'zugesagt', eingangAm: d(-300), vn: { noetig: true, frist: fr, st: 'offen' } })); return x.firstChild.className.replace('lead tl ', ''); };
    return [z(d(200)), z(d(30)), z(d(29)), z(d(7)), z(d(6)), z(d(-3))].join(); });
  ok(r === 'tl-g,tl-g,tl-y,tl-y,tl-r,tl-r', 'Punktlinie ab heute bis zur Frist: grün, unter einem Monat gelb, unter einer Woche rot (Geldeingang spielt keine Rolle): ' + r);
  // Bearbeiten ist der Normalzustand; die ganze Zeile wird beim Überfahren hervorgehoben
  await p.hover('tr[data-id="b-aed"] .l-sum');
  r = await p.evaluate(() => [document.body.classList.contains('strg'), getComputedStyle(document.querySelector('tr[data-id="b-aed"]')).backgroundColor]);
  ok(r.join() === 'true,rgb(243, 243, 241)', 'ohne Strg: Bearbeiten aktiv, ganze Zeile beim Überfahren grau hinterlegt: ' + r.join());
  await p.screenshot({ path: 'vorschau_liste.png', fullPage: true });
  await p.click('tr[data-id="b-mtw"] .l-name', { modifiers: ['Control'] });
  r = await p.evaluate(() => [document.querySelector('#f-titel').value, document.querySelector('.d-head input[data-p="gliederung"]').value, document.querySelector('.d-right-head input[data-p="summe"]').value, document.querySelectorAll('[data-p="summe"]').length, document.querySelector('#d-steps .cur').lastChild.textContent]);
  ok(r.join('|') === 'Mannschaftstransportwagen (MTW) für den Sanitätsdienst|Paderborn|68.000|1|Förderung', 'Kopf: Name, Gliederung und Summe oben (einmalig), Phase Förderung');
  r = await p.evaluate(() => [!!document.querySelector('header.top .subbar #d-steps'), !!document.querySelector('#d-status'), document.querySelector('#d-steps [title]').title.startsWith('Anträge stellen'), !!document.querySelector('.jump'), document.documentElement.dataset.blTheme,
    !!document.querySelector('.sum-art, [data-p="summeArt"]'), document.querySelector('.d-grid').firstElementChild.className,
    Math.abs(document.querySelector('.d-right-head').getBoundingClientRect().right - document.querySelector('.info-card').getBoundingClientRect().right) <= 2,
    Math.abs(document.querySelector('.d-right').getBoundingClientRect().top - document.querySelector('.info-card').getBoundingClientRect().top) <= 2,
    Math.abs(document.querySelector('.d-actions').getBoundingClientRect().right - document.querySelector('.d-right').getBoundingClientRect().right) <= 2,
    Math.abs((r => r.top + r.height / 2)(document.querySelector('.d-actions').getBoundingClientRect()) - (r => r.top + r.height / 2)(document.querySelector('.sum-line').getBoundingClientRect())) <= 3,
    !!document.querySelector('#d-steps li.done .st-k svg')]);
  ok(r.join() === 'true,false,true,false,light,false,d-head,true,true,true,true,true', 'Schritte an der Kopfzeile, Stand nur als Hinweis, ohne Schätzung/Angebot; Summe bündig mit dem linken Block, ⋯ und Löschen rechts über dem Freigabe-Block, der oben mit dem ersten Abschnitt abschließt; Haken als Grafik: ' + r.join());
  r = await p.evaluate(() => [...document.querySelectorAll('#fin-rows tr')].map(t => t.className + ':' + [...t.querySelector('th').childNodes].find(n => n.nodeType === 3 && n.textContent.trim()).textContent.trim() + ':' + t.querySelector('td:last-child').textContent));
  ok(r.join('|') === 'r-sum:Gesamtbedarf:100 %|r-zu:Sparkasse Musterstadt:15 %|r-be:Bürgerstiftung Musterstadt:22 %|r-ge:Beispiel-Soziallotterie:44 %', 'Förderplan-Tabelle: Gesamtbedarf, Förderer farbig nach Stand mit Anteil: ' + r.join('|'));
  r = await p.evaluate(() => [document.querySelector('#fin-eig').textContent, [...document.querySelectorAll('#sec-foe .sec-tools button')].map(x => x.className + ':' + x.textContent.trim()).join('+'), document.querySelectorAll('.card.fp').length, document.querySelectorAll('.fp .fbar, .fp select').length,
    getComputedStyle(document.querySelector('.fp .pro')).borderTopStyle, getComputedStyle(document.querySelector('.fp .pro')).backgroundColor]);
  ok(r.join() === '19 %,rech-btn:Recherche mit Copilot+icon-btn:,3,0,none,rgba(0, 0, 0, 0)', 'Eigenmittel mit Anteil, Knopf „Recherche mit Copilot“ und Upload-Symbol, je Förderer eine Karte ohne Balken und Art-Feld, Pro ohne Rahmen: ' + r.join());
  r = await p.evaluate(() => [document.querySelectorAll('#fin-pie svg.pie .ps').length, [...document.querySelectorAll('#fin-pie .ps')].map(x => x.getAttribute('class').replace('ps ', '')).join(),
    [...document.querySelectorAll('#sec-foe .fsum .swa')].map(x => x.className.replace('swa ', '')).join(), !!document.querySelector('#sec-foe .fbar'), !!document.querySelector('.ci-foot.ok'),
    Math.round(document.querySelector('#sec-foe .fsum').getBoundingClientRect().width) <= 580, document.querySelector('#fin-pie').getBoundingClientRect().left > document.querySelector('#sec-foe .fsum').getBoundingClientRect().right]);
  ok(r.join('|') === '4|zu,eig,be,ge|none,zu,be,ge,eig|false|false|true|true', 'Förderplan: Kreisdiagramm neben der schmaleren Tabelle, Farbfelder als Legende; kein Balken, kein grüner Kasten „Freigabe vollständig“: ' + r.join('|'));
  r = await p.evaluate(() => [...document.querySelectorAll('.d-right .circ')].map(c => c.className.replace('circ c-', '')).join());
  ok(r === 'ok,ok,ok,ok,ok,ok,ok,run,add', 'rechts: Freigaben und Unterlagen als Kreise: ' + r);
  ok(!!(await p.$('.d-right input[data-p="link"]')) && !!(await p.$('.d-right input[data-p="pfad"]')), 'Ordner rechts unter den Unterlagen');
  // Klick auf einen Kreis: gleich der nächste Stand, kein Menü
  const ulSt = () => p.evaluate(() => cur().unterlagen.find(u => u.name === 'Kostenplan').st);
  const kp = '.d-right .ci-row:has(input[value="Kostenplan"]) .circ';
  r = [await ulSt()];
  for (let i = 0; i < 3; i++) { await p.click(kp); r.push(await ulSt()); }
  ok(r.join() === 'arbeit,da,fehlt,arbeit' && !(await p.$('.circ-pop')) && await p.$eval(kp, e => !!e.querySelector('svg')), 'Kreis: Klick schaltet weiter (in Arbeit → vorhanden → fehlt → in Arbeit), ohne Menü, Zeichen als Grafik: ' + r.join());
  r = await p.evaluate(() => [document.querySelectorAll('.fk-grid > .card.fp.fk').length, document.querySelectorAll('#foe-f-mtw-spk .dots.lv5 .dot.on').length, document.querySelector('#foe-f-mtw-bst .st-btn').textContent.trim(), !document.querySelector('.fk .share-t, .fk .fp-title .pen, .fk-head'), document.querySelector('#foe-f-mtw-bst .fp-dates').textContent.replace(/\s+/g, ' ').trim(),
    [...document.querySelectorAll('#foe-f-mtw-spk .pc textarea')].map(e => e.placeholder.split(':')[0]).join(), getComputedStyle(document.querySelector('.fk-grid')).gridTemplateColumns.split(' ').length, document.querySelector('.fk-grid').lastElementChild.textContent.trim()]);
  ok(r[0] === 3 && r[1] === 5 && r[2] === 'beantragt ▾' && r[3] && r[4] === 'amAntwort erwartet:' && r[5] === 'Pro,Contra' && r[6] === 2 && r[7] === '+Förderer hinzufügen', 'Förderer als Kacheln: ohne Überschrift, Stift und Prozent; als letzte Kachel „+ Förderer hinzufügen“: ' + JSON.stringify(r));
  r = await p.evaluate(() => { const k = document.querySelector('#foe-f-mtw-bst'), n = k.querySelector('.fp-h'), a = k.querySelector('input.amt'), d = [...k.querySelectorAll('.fp-d input')], pc = [...k.querySelectorAll('.pc > label')].map(x => x.getBoundingClientRect());
    return [getComputedStyle(n).fontSize === getComputedStyle(a).fontSize, a.getBoundingClientRect().top - n.getBoundingClientRect().bottom <= 3, Math.round(n.getBoundingClientRect().left) === Math.round(a.getBoundingClientRect().left),
      d.map(x => x.type + ':' + x.value).join(), pc[1].top - pc[0].bottom >= 6, !!k.querySelector('.fp-title .fw-tri')]; });
  ok(r.join('|') === 'true|true|true|text:15.09.2026,text:30.11.2026|true|true', 'Name so groß wie die Summe, direkt darüber; Datum ohne Kalendersymbol; Abstand zwischen Pro und Contra; Hinweis als Dreieck: ' + r.join('|'));
  await p.hover('#foe-f-mtw-bst .fw-tri');
  ok((await p.$eval('.fw-pop', e => e.textContent)).includes('Auch im Förderplan von'), 'Dreieck überfahren: der Hinweis erscheint');
  await p.mouse.move(5, 5); await p.waitForTimeout(400);
  ok(!(await p.$('.fw-pop')), 'Maus weg: Hinweis verschwindet');
  await p.click('#foe-f-mtw-bst .fp-d input >> nth=1');
  ok(!!(await p.$('.cal-pop .cal-d.on[data-v="2026-11-30"]')), 'Klick aufs Datum öffnet den Kalender beim Datum');
  await p.click('.cal-pop .cal-d[data-v="2026-11-27"]');
  ok(await p.evaluate(() => cur().foerderer.find(f => f.id === 'f-mtw-bst').erwartet) === '2026-11-27', 'Tag gewählt: Datum übernommen');
  // Einschätzung füllt sich von rechts: der rechte Punkt allein = sehr unwahrscheinlich
  r = await p.evaluate(() => [...document.querySelectorAll('#foe-f-mtw-bst .dots .dot')].map(d => d.classList.contains('on') ? 'x' : '-').join(''));
  ok(r === '--xxx', 'Einschätzung „unsicher“: die drei rechten Punkte gefüllt: ' + r);
  // Freigaben alle da: grünes Kästchen, Überschrift „alle vorhanden“
  r = await p.evaluate(() => [!!document.querySelector('#fr-blk .fr-blk.ok'), document.querySelector('#fr-blk h3').textContent.replace(/\s+/g, ' ').trim()]);
  ok(r[0] && r[1] === 'Freigaben · alle vorhanden i', 'Freigaben vollständig: grünes Kästchen, „alle vorhanden“: ' + r[1]);
  r = await p.evaluate(() => [[...document.querySelectorAll('#fr-body .ci-n')].map(e => e.textContent).join(','), [...document.querySelectorAll('#ul-body .ci-n')].map(e => e.textContent).join(',')]);
  ok(r.join(' / ') === 'Ortsführungskreis,Verwaltung,Angebot / Konzept,Projektsteckbrief', 'Angebot bei den Freigaben, nicht mehr bei den Unterlagen: ' + r.join(' / '));
  // Förderplan und Nacharbeit einklappen
  await p.click('#sec-foe .sec-zu');
  r = await p.evaluate(() => [!!document.querySelector('#fin-pie'), document.querySelectorAll('.fk.fp').length, document.querySelector('#foe-kurz').textContent.replace(/\u00a0/g, ' '), document.querySelector('#sec-foe .sec-zu').getAttribute('aria-expanded')]);
  ok(r.join('|') === 'false|0|3 Förderer · 10.000 € zugesagt · 45.000 € noch ohne Zusage|false', 'Förderplan eingeklappt: Kreis, Tabelle und alle Förderer weg, eine Zeile Zusammenfassung: ' + r.join('|'));
  await p.click('#sec-nach .sec-zu');
  r = await p.evaluate(() => [!!document.querySelector('#nach-body'), document.querySelector('#nach-kurz').textContent]);
  ok(r[0] === false && r[1].startsWith('offen: '), 'Nacharbeit eingeklappt, offene Punkte in einer Zeile: ' + r[1]);
  await p.reload(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.querySelector('#fin-pie') && !document.querySelector('#nach-body')), 'bleibt eingeklappt (merkt sich der Browser)');
  await p.click('#sec-foe .sec-zu'); await p.click('#sec-nach .sec-zu');
  ok(await p.evaluate(() => !!document.querySelector('#fin-pie') && !!document.querySelector('#nach-body') && document.querySelectorAll('.fk.fp').length === 3), 'wieder aufgeklappt');
  // Kreisdiagramm: beim Überfahren alle Beschriftungen (Name, Betrag, Anteil), ohne Überlappung
  const pl = () => p.evaluate(() => [...document.querySelectorAll('#fin-pie .pl')].map(g => getComputedStyle(g).opacity).join());
  r = await p.evaluate(() => [getComputedStyle(document.querySelector('#fin-pie .pl-n')).fill, getComputedStyle(document.querySelector('.d-head')).color]);
  ok(await pl() === '1,1,1,1' && r[0] === 'rgb(107, 107, 107)', 'Beschriftungen am Kreis immer sichtbar, in Grau: ' + r[0]);
  const pie = await (await p.$('#fin-pie svg')).boundingBox();
  await p.mouse.move(pie.x + pie.width / 2, pie.y + pie.height / 2); await p.waitForTimeout(250);
  r = await p.evaluate(() => { const G = [...document.querySelectorAll('#fin-pie .pl')], R = G.map(g => [...g.querySelectorAll('text')].map(t => t.getBoundingClientRect()).reduce((a, c) => ({ l: Math.min(a.l, c.left), r: Math.max(a.r, c.right), t: Math.min(a.t, c.top), b: Math.max(a.b, c.bottom) }), { l: 1e9, r: -1e9, t: 1e9, b: -1e9 }));
    const hit = R.some((a, i) => R.some((c, j) => i < j && a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b));
    return [G.map(g => [...g.querySelectorAll('text')].map(t => t.textContent.replace(/\u00a0/g, ' ')).join(' ')).join(' | '), hit]; });
  ok(await pl() === '1,1,1,1' && r[0] === 'Sparkasse Musterstadt 10.000 € · 15 % | Eigenmittel 13.000 € · 19 % | Bürgerstiftung Musterstadt 15.000 € · 22 % | Beispiel-Soziallotterie 30.000 € · 44 %' && !r[1],
    'Kreis überfahren: alle Stücke beschriftet mit Name, Betrag und Anteil, nichts überlappt: ' + r[0]);
  await p.mouse.move(5, 5); await p.waitForTimeout(250);
  ok(await pl() === '1,1,1,1', 'Maus weg: Beschriftungen bleiben');
  // Klick auf ein Stück schaltet den Stand weiter; die Farbe wechselt sofort, neu aufgeteilt wird erst beim Verlassen des Kreises
  const geo = () => p.evaluate(() => [...document.querySelectorAll('#fin-pie .ps')].map(x => x.getAttribute('class').replace('ps ', '') + ':' + (x.dataset.fid || '-')).join());
  // Punkt mitten im Stück (auf der Linie zur Beschriftung, etwas nach innen) – wie ein echter Mausklick
  const sliceXY = fid => p.evaluate(fid => { const svg = document.querySelector('#fin-pie svg'), ps = [...svg.querySelectorAll('.ps')], i = ps.findIndex(x => x.dataset.fid === fid);
    const [x0, y0] = svg.querySelectorAll('.pl-l')[i].getAttribute('points').split(' ')[0].split(',').map(Number), vb = svg.viewBox.baseVal, cx = vb.width / 2, cy = vb.height / 2, pt = svg.createSVGPoint();
    pt.x = cx + 0.6 * (x0 - cx); pt.y = cy + 0.6 * (y0 - cy); const q = pt.matrixTransform(svg.getScreenCTM()); return [q.x, q.y]; }, fid);
  const g0 = await geo(), d0 = await p.$eval('#fin-pie .ps[data-fid="f-mtw-bst"]', e => e.getAttribute('d'));
  let xy = await sliceXY('f-mtw-bst'); await p.mouse.click(xy[0], xy[1]);
  r = await p.evaluate(() => [cur().foerderer.find(f => f.id === 'f-mtw-bst').status, document.querySelector('#fin-pie .ps[data-fid="f-mtw-bst"]').getAttribute('class'), document.querySelector('#fin-pie .ps[data-fid="f-mtw-bst"]').getAttribute('d')]);
  ok(r[0] === 'zugesagt' && r[1] === 'ps zu' && r[2] === d0, 'Klick auf „beantragt“: jetzt zugesagt, sofort grün, das Stück bleibt an seiner Stelle');
  ok((await p.$eval('#fin-rows', e => e.textContent)).includes('zugesagt'), 'die Tabelle daneben zeigt den neuen Stand gleich');
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  const g1 = await geo();
  ok(g0 === 'zu:f-mtw-spk,eig:-,be:f-mtw-bst,ge:f-mtw-lot' && g1 === 'zu:f-mtw-spk,zu:f-mtw-bst,eig:-,ge:f-mtw-lot', 'Maus weg: Kreis neu aufgeteilt, die Zusage rückt nach vorn: ' + g0 + ' → ' + g1);
  xy = await sliceXY('f-mtw-bst'); await p.mouse.click(xy[0], xy[1]);
  ok(await p.evaluate(() => cur().foerderer.find(f => f.id === 'f-mtw-bst').status === 'abgelehnt' && document.querySelector('#fin-pie .ps[data-fid="f-mtw-bst"]').getAttribute('class') === 'ps ab'), 'nächster Klick: abgelehnt, blass rot bis zum Verlassen');
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  ok(!(await p.$('#fin-pie .ps[data-fid="f-mtw-bst"]')), 'abgelehnt: Stück verschwindet beim Verlassen');
  await p.evaluate(() => { const f = cur().foerderer.find(x => x.id === 'f-mtw-bst'); f.status = 'beantragt'; f.zugesagt = null; f.entscheidungAm = ''; changed(); renderNow(); });
  // lange Kontaktzeile und lange Texte machen die Kachel nicht breiter (auch wenn ein Browser die Zeile nicht kürzt)
  r = await p.evaluate(() => { const st = document.createElement('style'); st.textContent = '.fk .det-btn { width: auto !important; } .fk .det-btn .ds { min-width: max-content !important; }'; document.head.append(st);
    const f = cur().foerderer.find(x => x.id === 'f-mtw-bst'), alt = JSON.stringify(f);
    Object.assign(f, { name: 'CaritasStiftung für das Erzbistum Paderborn', mail: 'stiftung@caritas-paderborn.de', kontakt: 'Nadine Mersch, Geschäftsführung der Stiftung (Referat Fördermittel DiCV: Barbara Höltring, 05251 209-327)', warum: 'Zweck: Hilfe für Alte, Kranke und Pflegebedürftige sowie Weiterbildung und Qualifizierung Ehrenamtlicher. '.repeat(3) }); renderNow();
    const res = [...document.querySelectorAll('.fk.fp')].every(c => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll('.fk-top, .pc, .fk-st, .dots-box')].every(e => e.getBoundingClientRect().right <= r.right + 1); });
    const k = [...document.querySelectorAll('.fk.fp')].map(c => c.getBoundingClientRect()), overlap = k.some((a, i) => k.some((c, j) => i < j && a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1));
    st.remove(); Object.assign(f, JSON.parse(alt)); renderNow(); return [res, overlap]; });
  ok(r.join() === 'true,false', 'Kacheln bleiben in ihrer Spalte und überlappen nicht, auch mit langer Kontaktzeile: ' + r.join());
  r = await p.evaluate(() => [getComputedStyle(document.querySelector('input.inline.sum')).fontSize, getComputedStyle(document.querySelector('.fp .pc textarea')).maxHeight, getComputedStyle(document.querySelector('.fp .pc')).rowGap]);
  ok(r.join() === '34px,56.55px,14px', 'Summe oben größer; Pro und Contra mit drei Zeilen Vorschau und mehr Abstand: ' + r.join());
  ok(await p.evaluate(() => F_ST.map(x => x[0]).join()) === 'geplant,beantragt,zugesagt,abgelehnt', 'Stände der Förderer: geplant, beantragt, zugesagt, abgelehnt (ohne „in Vorbereitung“)');
  await p.click('button[data-act="info"][data-v="ordner"]');
  ok((await p.$eval('.info-pop', e => e.textContent)).includes('Link kopieren'), 'Hinweis zum Ordner hinter dem „i“');
  await p.mouse.click(5, 300);
  await p.click('button[data-act="det"][data-v="f-mtw-spk"]');
  ok((await p.$eval('.foe-pop table.kt', e => e.textContent)).includes('Erika Beispiel') && !(await p.$('#foe-f-mtw-spk .foe-pop')), 'Kontakt als Fenster über der Seite (nicht in der Kachel): Kartei-Kontakte als Tabelle');
  await p.click('.pop-back', { position: { x: 10, y: 10 } });
  ok(!(await p.$('.foe-pop')), 'Klick daneben schließt das Fenster');
  await p.click('button[data-act="det"][data-v="f-mtw-lot"]');
  // Steckbrief: links Kontakt, rechts Bedingungen, darunter Quellen und Notizen; keine Eingabefelder, Text darunter eingerückt
  r = await p.evaluate(() => { const P = document.querySelector('.foe-pop'), lab = P.querySelector('.pA-bed .pe .lab').getBoundingClientRect(), val = P.querySelector('.pA-bed .pe .val .pv').getBoundingClientRect();
    return [[...P.querySelectorAll('.pA .sub')].map(e => e.textContent).join(','), P.querySelectorAll('.pop-body input, .pop-body textarea').length, P.querySelector('.pe[data-k="hoehe"] .val').textContent, Math.round(val.left - lab.left), [...P.querySelectorAll('.fx')].map(x => x.dataset.act).join()]; });
  ok(r[0] === 'Kontakt,Bedingungen,Quellen,Notizen' && r[1] === 0 && r[2] === 'bis 50 % der Kosten' && r[3] >= 10 && r[4] === 'web', 'Fenster als Steckbrief ohne Eingabefelder, Werte eingerückt, Knopf nur bei vorhandenem Link: ' + JSON.stringify(r));
  // Angabe anklicken → Feld; Enter übernimmt; Esc verwirft
  await p.click('.foe-pop .pe[data-k="mail"]');
  ok(await p.evaluate(() => document.activeElement.classList.contains('pe-in') && !!document.querySelector('.foe-pop')), 'Klick auf eine Angabe: Feld an derselben Stelle');
  await p.keyboard.type('info@lotterie.example'); await p.keyboard.press('Enter');
  r = await p.evaluate(() => [cur().foerderer.find(f => f.id === 'f-mtw-lot').mail, document.querySelector('.foe-pop .pe[data-k="mail"] .pv').textContent, [...document.querySelectorAll('.foe-pop .fx')].map(x => x.dataset.act).join()]);
  ok(r.join('|') === 'info@lotterie.example|info@lotterie.example|mailto,web', 'E-Mail eingetragen, Knopf zum Schreiben erscheint: ' + r.join('|'));
  await p.click('.foe-pop .pe[data-k="hoehe"]'); await p.keyboard.type(' – XXX'); await p.keyboard.press('Escape');
  ok(await p.evaluate(() => cur().foerderer.find(f => f.id === 'f-mtw-lot').hoehe === 'bis 50 % der Kosten' && !!document.querySelector('.foe-pop')), 'Esc verwirft die Änderung, das Fenster bleibt offen');
  // Quellen bearbeiten: je Link eine Zeile, danach als Links untereinander
  await p.click('.foe-pop .pe[data-k="quellen"]');
  await p.fill('.foe-pop .pe-in', 'https://www.example.org/satzung ; https://www.example.org/richtlinie');
  await p.click('.foe-pop .pA-box .sub');
  r = await p.evaluate(() => [...document.querySelectorAll('.foe-pop .ql a')].map(a => a.getAttribute('href')).join());
  ok(r === 'https://www.example.org/satzung,https://www.example.org/richtlinie', 'Quellen bearbeitet: untereinander als anklickbare Links: ' + r);
  // feste Höhe, langer Text scrollt im Fenster
  const hh = await p.$eval('.foe-pop', e => e.getBoundingClientRect().height);
  await p.evaluate(() => { cur().foerderer.find(f => f.id === 'f-mtw-lot').notiz = 'Sehr lange Notiz. '.repeat(500); keep(renderNow); });
  r = await p.evaluate(() => { const P = document.querySelector('.foe-pop'), B = P.querySelector('.pop-body'); return [Math.round(P.getBoundingClientRect().height), B.scrollHeight > B.clientHeight, getComputedStyle(B).overflowY]; });
  ok(Math.abs(r[0] - hh) <= 1 && r[1] && r[2] === 'auto', 'Fenster bleibt gleich hoch, langer Inhalt scrollt darin: ' + r.join());
  await p.evaluate(() => { cur().foerderer.find(f => f.id === 'f-mtw-lot').notiz = ''; keep(renderNow); });
  r = await p.evaluate(() => quellenZeilen('https://a.de/x ; https://b.de https://c.de\nSatzung').join('|'));
  ok(r === 'https://a.de/x|https://b.de|https://c.de|Satzung', 'Quellen werden je Zeile getrennt: ' + r);
  await p.keyboard.press('Escape');
  // Betrag beim Tippen gleich mit Tausenderpunkt
  await p.click('#amt-f-mtw-lot', { clickCount: 3 }); await p.keyboard.type('45000');
  r = await p.evaluate(() => [document.querySelector('#amt-f-mtw-lot').value, cur().foerderer.find(f => f.id === 'f-mtw-lot').betrag]);
  ok(r.join() === '45.000,45000', 'Summe beim Tippen: 45000 → 45.000: ' + r.join());
  // neuer Förderer: kein Auswahlpfeil des Browsers, eigene Vorschläge
  await p.click('.fk-grid .fk-neu'); await p.keyboard.type('Bürger');
  r = await p.evaluate(() => [document.activeElement.hasAttribute('list'), [...document.querySelectorAll('.le-sug .le-opt')].map(o => o.textContent).join()]);
  ok(r[0] === false && r[1].includes('Bürgerstiftung Musterstadt'), 'Namensfeld ohne Pfeil, Vorschläge beim Tippen: ' + r[1]);
  await p.click('.le-opt:text-is("Bürgerstiftung Musterstadt")');
  ok(await p.evaluate(() => cur().foerderer.at(-1).name === 'Bürgerstiftung Musterstadt'), 'Vorschlag übernommen');
  await p.screenshot({ path: 'vorschau_bedarf.png', fullPage: true });
  const q = await open(b, { file, fakefs: false, dark: true, width: 390 });
  r = await q.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok(r[0] <= r[1], 'schmal (390 px): kein Querscrollen der Seite (' + r.join(' / ') + ')');
  await q.click('tr[data-id="b-mtw"] .l-name', { modifiers: ['Control'] });
  r = await q.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(r !== 'rgb(20, 21, 22)', 'System dunkel, Programm bleibt hell (Standard): ' + r);
  await q.click('button[data-act="menu"]'); await q.click('#mmenu button[data-act="theme"][data-v="dark"]');
  r = await q.evaluate(() => [document.documentElement.scrollWidth, innerWidth, getComputedStyle(document.body).backgroundColor, localStorage.getItem('bl-theme')]);
  ok(r[0] <= r[1] && r[2] === 'rgb(20, 21, 22)' && r[3] === 'dark', 'schmal und dunkel (Einstellung): Bedarfsseite passt (' + r[0] + '), dunkler Hintergrund');
  await q.click('#mmenu button[data-act="theme"][data-v="system"]');
  ok(await q.evaluate(() => !document.documentElement.dataset.blTheme && getComputedStyle(document.body).backgroundColor === 'rgb(20, 21, 22)'), '„wie Windows“ folgt dem System (hier dunkel)');
  await q.click('#mmenu button[data-act="theme"][data-v="dark"]'); await q.keyboard.press('Escape');
  await q.screenshot({ path: 'vorschau_handy_dunkel.png', fullPage: true });
  await finish(b, [p, q]);
})();
