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
    return { name: t(tr.querySelector('.l-name')), sum: t(tr.querySelector('.l-sum')), meta: t(tr.querySelector('.l-meta')), frDone: !!tr.querySelector('.l-fr .fr-voll') && tr.querySelector('.l-fr .fr-voll').innerText.trim() === 'freigegeben' && !tr.querySelector('.l-fr [data-le="fr"]'),
      fr: [...tr.querySelectorAll('.l-fr .mi')].map(m => m.className.replace('mi m-', '')).join(), fin: [...tr.querySelectorAll('.l-fin .fr')].map(r => r.className.replace('fr', '').trim() + ':' + [...r.children].map(t).filter(Boolean).join(' ')).join(' | '),
      sym: [...tr.querySelectorAll('.l-fin .fr > .mi:first-child')].map(m => m.className.replace('mi m-', '')).join(), leads: tr.querySelectorAll('.l-fin .lead').length, ueb: t(tr.querySelector('.l-ueb')) }; }, id);
  r = await L('b-mtw');
  ok(r.name === 'Mannschaftstransportwagen (MTW) für den Sanitätsdienst' && r.sum === '68.000 €' && r.meta === 'Paderborn Thomas Beispiel bis 30.06.2027' && r.frDone && r.fr === 'ok', 'Kerninfo: Name mit (Prio), Summe, Ort · Zuständig · bis; Freigabe vollständig: nur ein Haken „freigegeben“ (das Angebot steht nicht in der Liste): ' + JSON.stringify(r));
  ok(r.sym === 'ok,off,run' && r.leads === 1 && r.fin === ':Sparkasse Musterstadt 10.000 € bis 30.09.2027 | :Beispiel-Soziallotterie 30.000 € | :Bürgerstiftung Musterstadt 15.000 € | sum:Eigenmittel 13.000 €' && r.ueb === 'Wache Paderborn',
    'Finanzierung läuft: Zusage oben, dann nach Einschätzung; Kreise nach Stand, nur die Zusage führt gepunktet zum Nachweis, ohne Delta; Übergabe zeigt nur den Ort: ' + r.fin);
  r = await L('b-aed');
  ok(!r.frDone && r.fr === 'ok,off,run' && r.fin.includes('sum:Delta 2.400 €') && r.sym === 'off', 'AED: Freigabe offen (Kreise), Delta 2.400 €: ' + r.fr + ' / ' + r.fin);
  ok((await L('b-rucksack')).fr === 'ok,no,off', 'Rucksäcke: Verwaltung abgelehnt als roter Kreis');
  r = await L('b-waerme');
  ok(r.fin === 'strong:Beispiel-Soziallotterie 12.000 € bis 30.04.2027 | x:Stadtwerke Hagen (Beispiel) 1.500 € | x ab:Volksbank Beispielland eG 2.000 € | sum:Eigenmittel 2.000 €' && r.leads === 1 && r.ueb === 'erledigt am 05.10.2026 Hauptbahnhof Hagen',
    'Finanzierung steht: Zusage kräftig mit Nachweis, Absage und nie Angegangene blass, kein Delta: ' + r.fin);
  r = await L('b-kueche');
  ok(r.fin === 'z:Bürgerstiftung Musterstadt 5.000 € erledigt | z:Sparkasse Musterstadt 3.000 € nicht nötig | sum:Überfinanzierung 500 € | sum:Eigenmittel 2.000 €' && r.leads === 2 && r.meta.endsWith('ohne Deadline')
    && await p.evaluate(() => document.querySelectorAll('tr[data-id="b-kueche"] .l-fin .mi[data-le="vn"]').length === 2 && !!document.querySelector('tr[data-id="b-kueche"] .l-fin .mi.m-off[data-le="vn"]'))
    && r.ueb.startsWith('Spendenübergabe einleiten Küche wird erst Ende November eingebaut'), 'Küche: erledigte Nachweise blass grün, auch „nicht nötig“ mit Linie und leerem Kreis, Überfinanzierung, Dreieck mit Info: ' + r.fin + ' / ' + r.ueb);
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
  ok(r && r[0] === 'lead tl tl-0' && /^noch \d+ Tage bis zur Frist$/.test(r[1]), 'Punktlinie zur Frist: drei Monate und mehr – ganz grau: ' + JSON.stringify(r));
  r = await p.evaluate(() => { const d = n => new Date(Date.parse(today()) + n * 864e5).toISOString().slice(0, 10);
    const z = fr => { const x = document.createElement('div'); x.innerHTML = zeitstrahl(ff({ status: 'zugesagt', eingangAm: d(-300), vn: { noetig: true, frist: fr, st: 'offen' } })); return x.firstChild.className.replace('lead tl ', ''); };
    return [z(d(200)), z(d(90)), z(d(89)), z(d(30)), z(d(29)), z(d(7)), z(d(6)), z(d(-3))].join(); });
  ok(r === 'tl-0,tl-0,tl-g,tl-g,tl-y,tl-y,tl-r,tl-r', 'Punktlinie: ab drei Monaten grau, darunter grün, unter einem Monat gelb, unter einer Woche rot (Geldeingang spielt keine Rolle): ' + r);
  r = await p.evaluate(() => { const t = document.querySelector('tr[data-id="b-mtw"] .l-fin .lead.tl'), w = k => { t.className = 'lead tl ' + k; const q = t.firstChild.getBoundingClientRect().width / t.getBoundingClientRect().width; return Math.round(q * 100); };
    const out = ['tl-0', 'tl-g', 'tl-y', 'tl-r'].map(k => k + ':' + w(k) + ':' + getComputedStyle(t.firstChild).borderBottomColor); t.className = 'lead tl tl-0'; return out; });
  ok(/^tl-0:0:.*,tl-g:30:rgb\(.*,tl-y:55:rgb\(224, 164, 0\),tl-r:100:/.test(r.join()) && r[1].split(':')[2] !== r[3].split(':')[2], 'farbiger Anteil der Punkte: grau 0 %, grün ein Drittel, gelb die Hälfte, rot ganz: ' + r.join(' | '));
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
  ok(r.join('|') === 'r-sum:Gesamtbedarf:100 %|r-zu:Sparkasse Musterstadt:15 %|r-ge:Beispiel-Soziallotterie:44 %|r-be:Bürgerstiftung Musterstadt:22 %', 'Förderplan-Tabelle: Gesamtbedarf, Förderer farbig nach Stand mit Anteil, Zusage oben, dann nach Einschätzung: ' + r.join('|'));
  r = await p.evaluate(() => [document.querySelector('#fin-eig').textContent, [...document.querySelectorAll('#sec-foe .sec-tools button')].map(x => x.className + ':' + x.textContent.trim()).join('+'), document.querySelectorAll('.card.fp').length, document.querySelectorAll('.fp .fbar, .fp select').length,
    getComputedStyle(document.querySelector('.fp .pro')).borderTopStyle, getComputedStyle(document.querySelector('.fp .pro')).backgroundColor]);
  ok(r.join() === '19 %,icon-btn:,3,0,none,rgba(0, 0, 0, 0)', 'Eigenmittel mit Anteil, nur das Upload-Symbol, je Förderer eine Karte ohne Balken und Art-Feld, Pro ohne Rahmen: ' + r.join());
  r = await p.evaluate(() => [document.querySelectorAll('#fin-pie svg.pie .ps').length, [...document.querySelectorAll('#fin-pie .ps')].map(x => x.getAttribute('class').replace('ps ', '')).join(),
    [...document.querySelectorAll('#sec-foe .fsum .swa')].map(x => x.className.replace('swa ', '')).join(), !!document.querySelector('#sec-foe .fbar'), !!document.querySelector('.ci-foot.ok'),
    Math.round(document.querySelector('#sec-foe .fsum').getBoundingClientRect().width) <= 580, document.querySelector('#fin-pie').getBoundingClientRect().left > document.querySelector('#sec-foe .fsum').getBoundingClientRect().right]);
  ok(r.join('|') === '4|zu,eig,be,ge|none,zu,ge,be,eig|false|false|true|true', 'Förderplan: Kreisdiagramm neben der schmaleren Tabelle, Farbfelder als Legende; kein Balken, kein grüner Kasten „Freigabe vollständig“: ' + r.join('|'));
  r = await p.evaluate(() => [...document.querySelectorAll('.d-right .circ')].map(c => c.className.replace('circ c-', '')).join());
  ok(r === 'ok,ok,ok,ok,no,ok,ok,ok,run,add', 'rechts: Freigaben und Unterlagen als Kreise (Angebot oben, dann das neue Interview, noch offen): ' + r);
  ok(!!(await p.$('.d-right input[data-p="link"]')) && !(await p.$('input[data-p="pfad"]')), 'Ordner rechts unter den Unterlagen, nur als Link');
  // Klick auf einen Kreis: gleich der nächste Stand, kein Menü
  const ulSt = () => p.evaluate(() => cur().unterlagen.find(u => u.name === 'Kostenplan').st);
  const kp = '.d-right .ci-row:has(input[value="Kostenplan"]) .circ';
  r = [await ulSt()];
  for (let i = 0; i < 3; i++) { await p.click(kp); r.push(await ulSt()); }
  ok(r.join() === 'arbeit,da,fehlt,arbeit' && !(await p.$('.circ-pop')) && await p.$eval(kp, e => !!e.querySelector('svg')), 'Kreis: Klick schaltet weiter (in Arbeit → vorhanden → fehlt → in Arbeit), ohne Menü, Zeichen als Grafik: ' + r.join());
  r = await p.evaluate(() => [document.querySelectorAll('.fk-grid > .card.fp.fk').length, document.querySelectorAll('#foe-f-mtw-spk .dots.lv5 .dot.on').length, document.querySelector('#foe-f-mtw-bst .st-btn').textContent.trim(), !document.querySelector('.fk .share-t, .fk .fp-title .pen, .fk-head'), document.querySelector('#foe-f-mtw-bst .fp-dates').textContent.replace(/\s+/g, ' ').trim(),
    [...document.querySelectorAll('#foe-f-mtw-spk .pc > div')].map(e => e.className + (e.querySelector('.pe-pc[data-fmt]') ? '' : '?')).join(), getComputedStyle(document.querySelector('.fk-grid')).gridTemplateColumns.split(' ').length, document.querySelector('.fk-grid').lastElementChild.textContent.trim()]);
  ok(r[0] === 3 && r[1] === 5 && r[2] === 'beantragt ▾' && r[3] && r[4] === 'amAntwort erwartet:' && r[5] === 'pro,contra' && r[6] === 2 && r[7] === '+Förderer hinzufügen', 'Förderer als Kacheln: ohne Überschrift, Stift und Prozent; als letzte Kachel „+ Förderer hinzufügen“: ' + JSON.stringify(r));
  r = await p.evaluate(() => { const k = document.querySelector('#foe-f-mtw-bst'), n = k.querySelector('.fp-h'), a = k.querySelector('input.amt'), d = [...k.querySelectorAll('.fp-d input')], pc = [...k.querySelectorAll('.pc > div')].map(x => x.getBoundingClientRect());
    return [getComputedStyle(n).fontSize === getComputedStyle(a).fontSize, a.getBoundingClientRect().top - n.getBoundingClientRect().bottom <= 3, Math.round(n.getBoundingClientRect().left) === Math.round(a.getBoundingClientRect().left),
      d.map(x => x.type + ':' + x.value).join(), pc[1].top - pc[0].bottom >= 6, !!k.querySelector('.fp-title .fw-tri')]; });
  ok(r.join('|') === 'true|true|true|text:15.09.2026,text:30.11.2026|true|true', 'Name so groß wie die Summe, direkt darüber; Datum ohne Kalendersymbol; Abstand zwischen Pro und Contra; Hinweis als Dreieck: ' + r.join('|'));
  await p.$eval('#foe-f-mtw-bst', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);   // erst scrollen (Scrollen schließt Hinweise), dann überfahren
  await p.mouse.move(5, 5); await p.hover('#foe-f-mtw-bst .fw-tri');
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
  ok(r.join(' / ') === 'Ortsführungskreis,Fachreferat,Verwaltung / Angebot,Interview,Konzept,Projektsteckbrief', 'Angebot oben bei den Unterlagen, dann das Interview; nicht bei den Freigaben: ' + r.join(' / '));
  // Förderplan und Nacharbeit einklappen – beim Öffnen je nach Phase: Förderung läuft → Förderplan offen, Nacharbeit zu
  r = await p.evaluate(() => [!!document.querySelector('#fin-pie'), !!document.querySelector('#nach-body'), (document.querySelector('#nach-kurz') || {}).textContent]);
  ok(r[0] === true && r[1] === false && /^offen: /.test(r[2]), 'Förderung läuft: Förderplan aufgeklappt, Nacharbeit eingeklappt mit den offenen Punkten: ' + r.join('|'));
  await p.click('#sec-foe .sec-zu');
  r = await p.evaluate(() => [!!document.querySelector('#fin-pie'), document.querySelectorAll('.fk.fp').length, document.querySelector('#foe-kurz').textContent.replace(/\u00a0/g, ' '), document.querySelector('#sec-foe .sec-zu').getAttribute('aria-expanded')]);
  ok(r.join('|') === 'false|0|3 Förderer · 10.000 € zugesagt · 45.000 € noch ohne Zusage|false', 'Förderplan eingeklappt: Kreis, Tabelle und alle Förderer weg, eine Zeile Zusammenfassung: ' + r.join('|'));
  await p.click('#sec-nach .sec-zu');
  ok(await p.evaluate(() => !!document.querySelector('#nach-body') && !document.querySelector('#fin-pie')), 'Nacharbeit von Hand aufgeklappt, Förderplan bleibt zu');
  await p.evaluate(() => { renderNow(); });
  ok(await p.evaluate(() => !!document.querySelector('#nach-body') && !document.querySelector('#fin-pie')), 'von Hand geklappt bleibt beim Neuzeichnen');
  await p.reload(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('#fin-pie') && !document.querySelector('#nach-body') && document.querySelectorAll('.fk.fp').length === 3), 'neu geöffnet: wieder je nach Phase (Förderplan offen, Nacharbeit zu)');
  r = await p.evaluate(() => { oeffnen('b-kueche'); return [!document.querySelector('#fin-pie'), !!document.querySelector('#foe-kurz'), !!document.querySelector('#nach-body')]; });
  ok(r.join() === 'true,true,true', 'Bedarf in der Nacharbeit: Förderplan eingeklappt, Nacharbeit offen: ' + r.join());
  await p.evaluate(() => oeffnen('b-mtw'));
  // Kreisdiagramm: beim Überfahren alle Beschriftungen (Name, Betrag, Anteil), ohne Überlappung
  const pl = () => p.evaluate(() => [...document.querySelectorAll('#fin-pie .pl')].map(g => getComputedStyle(g).opacity).join());
  r = await p.evaluate(() => [getComputedStyle(document.querySelector('#fin-pie .pl-n')).fill, getComputedStyle(document.querySelector('.d-head')).color]);
  ok(await pl() === '1,1,1,1' && r[0] === 'rgb(107, 107, 107)', 'Beschriftungen am Kreis immer sichtbar, in Grau: ' + r[0]);
  const pie = await (await p.$('#fin-pie svg')).boundingBox();
  await p.mouse.move(pie.x + pie.width / 2, pie.y + pie.height / 2); await p.waitForTimeout(250);
  r = await p.evaluate(() => { const G = [...document.querySelectorAll('#fin-pie .pl')], R = G.map(g => [...g.querySelectorAll('text')].map(t => t.getBoundingClientRect()).reduce((a, c) => ({ l: Math.min(a.l, c.left), r: Math.max(a.r, c.right), t: Math.min(a.t, c.top), b: Math.max(a.b, c.bottom) }), { l: 1e9, r: -1e9, t: 1e9, b: -1e9 }));
    const hit = R.some((a, i) => R.some((c, j) => i < j && a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b));
    return [G.map(g => [...g.querySelectorAll('text')].map(t => (t.querySelector('tspan') ? [...t.querySelectorAll('tspan')].map(x => x.textContent).join(' ') : t.textContent).replace(/\u00a0/g, ' ')).join(' ')).join(' | '), hit]; });
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
  r = await p.evaluate(() => { const st = document.createElement('style'); st.textContent = '.fk-fuss .ff-n { overflow: visible !important; }'; document.head.append(st);
    const f = cur().foerderer.find(x => x.id === 'f-mtw-bst'), alt = JSON.stringify(f);
    Object.assign(f, { name: 'CaritasStiftung für das Erzbistum Paderborn', kontakte: [{ n: 'Nadine Mersch, Geschäftsführung der Stiftung (Referat Fördermittel DiCV: Barbara Höltring, 05251 209-327)', rolle: '', mail: 'stiftung@caritas-paderborn.de', tel: '05251 209-227' }], warum: 'Zweck: Hilfe für Alte, Kranke und Pflegebedürftige sowie Weiterbildung und Qualifizierung Ehrenamtlicher. '.repeat(3) }); renderNow();
    const res = [...document.querySelectorAll('.fk.fp')].every(c => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll('.fk-top, .pc, .fk-st, .dots-box, .fk-fuss .fi, .ff-mehr')].every(e => e.getBoundingClientRect().right <= r.right + 1); });
    const k = [...document.querySelectorAll('.fk.fp')].map(c => c.getBoundingClientRect()), overlap = k.some((a, i) => k.some((c, j) => i < j && a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1));
    st.remove(); Object.assign(f, JSON.parse(alt)); renderNow(); return [res, overlap]; });
  ok(r.join() === 'true,false', 'Kacheln bleiben in ihrer Spalte und überlappen nicht, auch mit langer Kontaktzeile: ' + r.join());
  r = await p.evaluate(() => [getComputedStyle(document.querySelector('input.inline.sum')).fontSize, getComputedStyle(document.querySelector('.fp .pc .pe-pc .val')).maxHeight, getComputedStyle(document.querySelector('.fp .pc')).rowGap]);
  ok(r.join() === '34px,56.55px,14px', 'Summe oben größer; Pro und Contra mit drei Zeilen Vorschau und mehr Abstand: ' + r.join());
  ok(await p.evaluate(() => F_ST.map(x => x[0]).join()) === 'geplant,beantragt,zugesagt,abgelehnt', 'Stände der Förderer: geplant, beantragt, zugesagt, abgelehnt (ohne „in Vorbereitung“)');
  await p.click('button[data-act="info"][data-v="ordner"]');
  ok((await p.$eval('.info-pop', e => e.textContent)).includes('Adresszeile'), 'Hinweis zum Ordner hinter dem „i“');
  await p.mouse.click(5, 300);
  await p.click('button[data-act="det"][data-v="f-mtw-spk"]');
  ok(!!(await p.$('.foe-pop')) && !(await p.$('.foe-pop .k1.kartei, .foe-pop .det-k')) && !(await p.$('#foe-f-mtw-spk .foe-pop')), 'Kontakt als Fenster über der Seite, ohne eigenen Kasten „Aus der Förder-Kartei“ (Angaben stehen in den Feldern)');
  await p.click('.pop-back', { position: { x: 10, y: 10 } });
  ok(!(await p.$('.foe-pop')), 'Klick daneben schließt das Fenster');
  await p.click('button[data-act="det"][data-v="f-mtw-lot"]');
  // Kopf: Name, Summe, Wahrscheinlichkeit – kein Stand, kein „Antrag stellt“; rechts keine Überschrift „Bedingungen“, keine Eingabefelder, Werte eingerückt
  r = await p.evaluate(() => { const P = document.querySelector('.foe-pop'), lab = P.querySelector('.pA-bed .pe .lab').getBoundingClientRect(), val = P.querySelector('.pA-bed .pe .val .pv').getBoundingClientRect();
    return [P.querySelector('header .pe-amt').textContent.replace(/\u00a0/g, ' '), !!P.querySelector('header .dots-box'), !!P.querySelector('header .st-btn, header .seg'), [...P.querySelectorAll('.pop-body .sub')].map(e => e.textContent).join(','),
      P.querySelectorAll('.pop-body input, .pop-body textarea').length, P.querySelector('.pe[data-k="hoehe"] .val').textContent, Math.round(val.left - lab.left), P.querySelector('.pA-bed > .pe').dataset.k]; });
  ok(r.join('|') === '30.000 €|true|false|Kontakte,Quellen,Notizen i|0|bis 50 % der Kosten|12|fristInfo', 'Fenster: Kopf mit Summe und Wahrscheinlichkeit, rechts ohne Überschrift, keine Eingabefelder, Werte eingerückt: ' + r.join('|'));
  // Summe und Wahrscheinlichkeit im Kopf ändern
  await p.click('.foe-pop .pe-amt'); await p.keyboard.press('Control+A'); await p.keyboard.type('28000'); await p.keyboard.press('Enter');
  await p.click('.foe-pop header .dot:nth-child(4)');
  r = await p.evaluate(() => { const f = cur().foerderer.find(x => x.id === 'f-mtw-lot'); return [f.betrag, f.einsch, !!document.querySelector('.foe-pop')]; });
  ok(r.join() === '28000,uw,true', 'Summe und Wahrscheinlichkeit im Kopf geändert, Fenster bleibt offen: ' + r.join());
  // Kontakte: Stift → bearbeiten, + → weiterer (höchstens drei), ☆ → Hauptkontakt, Fertig entfernt leere
  ok(await p.$eval('.foe-pop .pA-box', e => e.querySelectorAll('.k1').length === 0 && !!e.querySelector('.kadd')), 'ohne Kontakte: „Kontakt eintragen“');
  await p.click('.foe-pop .k-pen');
  ok(await p.evaluate(() => document.querySelectorAll('.foe-pop .k-ed').length) === 0, 'Stift: Bearbeiten, noch keine Zeile');
  await p.click('.foe-pop .kadd');
  r = await p.evaluate(() => { const box = document.querySelector('.foe-pop .pA-box').getBoundingClientRect(), fe = document.querySelector('.foe-pop .pA-box .sub [data-act="k-fertig"]'), fr = fe && fe.getBoundingClientRect(), li = [...document.querySelectorAll('.foe-pop .k-ed input')], cs = getComputedStyle(li[0]);
    return [li.map(e => e.placeholder).join(','), cs.borderTopWidth + ' ' + cs.borderBottomWidth, li.every((e, i) => !i || e.getBoundingClientRect().top > li[i - 1].getBoundingClientRect().bottom - 1), !!fe && box.right - fr.right < 30 && fr.top - box.top < 40, !document.querySelector('.foe-pop .k-pen')]; });
  ok(r.join('|') === 'Vorname Nachname,Position,E-Mail-Adresse,Telefonnummer|0px 1px|true|true|true', 'Kontakt bearbeiten: Linien untereinander mit blassem Hinweis, „Fertig“ oben rechts statt Stift: ' + r.join('|'));
  await p.keyboard.type('Petra Lotto'); await p.fill('.foe-pop [data-p="kontakte.0.rolle"]', 'Förderreferentin'); await p.fill('.foe-pop [data-p="kontakte.0.mail"]', 'petra@lotterie.example');
  await p.click('.foe-pop .kadd'); await p.keyboard.type('Max Los'); await p.fill('.foe-pop [data-p="kontakte.1.tel"]', '0211 12345');
  await p.click('.foe-pop .kadd');
  r = await p.evaluate(() => [document.querySelectorAll('.foe-pop .k-ed').length, !!document.querySelector('.foe-pop .kadd')]);
  ok(r.join() === '3,false', 'höchstens drei Kontakte, dann kein „+“ mehr: ' + r.join());
  await p.click('.foe-pop [data-act="k-fertig"]');
  r = await p.evaluate(() => [cur().foerderer.find(x => x.id === 'f-mtw-lot').kontakte.map(kontaktText).join(' | '), [...document.querySelectorAll('.foe-pop .k1 .kn')].map(e => e.textContent).join(','),
    [...document.querySelectorAll('.foe-pop .k1 a.kb')].map(a => a.getAttribute('href')).join(), document.querySelector('#fuss-f-mtw-lot .ff-n').textContent + ' ' + [...document.querySelectorAll('#fuss-f-mtw-lot a.fi')].map(a => a.getAttribute('href')).join()]);
  ok(r[0] === 'Petra Lotto; Förderreferentin; petra@lotterie.example | Max Los; ; ; 0211 12345' && r[1] === 'Petra Lotto,Max Los' && r[2] === 'mailto:petra@lotterie.example,tel:021112345' && r[3] === 'Petra Lotto mailto:petra@lotterie.example',
    'Fertig: leerer dritter Kontakt entfernt, Kontakte mit Links und Knöpfen, Hauptkontakt in der Kachel: ' + r.join(' / '));
  await p.click('.foe-pop .k1 .star.off');
  ok(await p.evaluate(() => cur().foerderer.find(x => x.id === 'f-mtw-lot').kontakte[0].n) === 'Max Los', '☆ macht einen Kontakt zum Hauptkontakt (nach oben)');
  // Angabe anklicken → Feld; Enter übernimmt; Esc verwirft
  await p.click('.foe-pop .pe[data-k="weg"]');
  ok(await p.evaluate(() => document.activeElement.classList.contains('pe-in') && !!document.querySelector('.foe-pop')), 'Klick auf eine Angabe: Feld an derselben Stelle');
  await p.keyboard.press('Control+A'); await p.keyboard.type('E-Mail'); await p.keyboard.press('Enter');
  ok(await p.evaluate(() => cur().foerderer.find(f => f.id === 'f-mtw-lot').weg) === 'E-Mail', 'Antragsweg geändert');
  await p.click('.foe-pop .pe[data-k="hoehe"]'); await p.keyboard.type(' – XXX'); await p.keyboard.press('Escape');
  ok(await p.evaluate(() => cur().foerderer.find(f => f.id === 'f-mtw-lot').hoehe === 'bis 50 % der Kosten' && !!document.querySelector('.foe-pop')), 'Esc verwirft die Änderung, das Fenster bleibt offen');
  // Quellen bearbeiten: je Link eine Zeile, danach als Links untereinander
  await p.click('.foe-pop .pe[data-k="quellen"]');
  await p.fill('.foe-pop .pe-in', 'https://www.example.org/satzung ; https://www.example.org/richtlinie');
  await p.click('.foe-pop .pA-box .sub');
  r = await p.evaluate(() => [...document.querySelectorAll('.foe-pop .ql a')].map(a => a.getAttribute('href')).join());
  ok(r === 'https://www.example.org/satzung,https://www.example.org/richtlinie', 'Quellen bearbeitet: untereinander als anklickbare Links: ' + r);
  // so hoch wie nötig: wenig Inhalt → kleineres Fenster ohne Leerraum; viel Inhalt → höchstens so hoch, dass drei Kontakte passen, lange Texte scrollen im eigenen Bereich
  const maß = () => p.evaluate(() => { const P = document.querySelector('.foe-pop'), r = s => P.querySelector(s).getBoundingClientRect(), box = P.querySelector('.pA-box'), bed = P.querySelector('.pA-bed'), n = P.querySelector('.pA-n');
    return { h: Math.round(P.getBoundingClientRect().height), luecke: Math.round(r('.pop-body').bottom - Math.max(r('.pA-q').bottom, r('.pA-n').bottom)), boxScroll: box.scrollHeight > box.clientHeight + 1, bedScroll: bed.scrollHeight > bed.clientHeight + 1, nScroll: n.scrollHeight > n.clientHeight + 1, max: Math.min(780, innerHeight - 32) }; });
  const m0 = await maß();
  ok(m0.h < m0.max - 100 && m0.luecke <= 20, 'wenig Inhalt: Fenster kleiner, kein Leerraum unter Quellen und Notizen: ' + JSON.stringify(m0));
  await p.evaluate(() => { const f = cur().foerderer.find(x => x.id === 'f-mtw-lot'); f.kontakte.push({ n: 'Dritte Person', rolle: 'Vorstand', mail: 'd@x.example', tel: '0211 9' }); f.notiz = 'Sehr lange Notiz. '.repeat(500); f.fristInfo = 'Lange Frist. '.repeat(300); keep(renderNow); });
  const m1 = await maß();
  ok(m1.h <= m1.max + 1 && m1.h > m0.h && !m1.boxScroll && m1.bedScroll && m1.nScroll, 'viel Inhalt: höchstens die volle Größe, drei Kontakte ohne Scrollen, lange Texte scrollen in ihrem Bereich: ' + JSON.stringify(m1));
  await p.evaluate(() => { const f = cur().foerderer.find(x => x.id === 'f-mtw-lot'); f.notiz = ''; f.fristInfo = 'laufend, Bearbeitung etwa 3 Monate'; keep(renderNow); });
  r = await p.evaluate(() => quellenZeilen('https://a.de/x ; https://b.de https://c.de\nSatzung').join('|'));
  ok(r === 'https://a.de/x|https://b.de|https://c.de|Satzung', 'Quellen werden je Zeile getrennt: ' + r);
  // einfache Formatierung in den Texten: * Aufzählung, 1. Nummern, *fett*, _kursiv_, ~durchgestrichen~, Links; Dateinamen mit _ bleiben
  await p.evaluate(() => { const f = cur().foerderer.find(x => x.id === 'f-mtw-lot'); f.notiz = 'Vorab *wichtig* und _bald_, ~alt~ – Datei Leitfaden_2026_neu.pdf\n* eins\n* zwei https://x.example/a\n1. erst\n2. dann'; changed(); keep(renderNow); });
  r = await p.$eval('.foe-pop .pe[data-k="notiz"] .pv', e => [e.classList.contains('fmt'), e.querySelector('b').textContent, e.querySelector('i').textContent, e.querySelector('s').textContent, e.textContent.includes('Leitfaden_2026_neu.pdf'),
    [...e.querySelectorAll('ul li')].map(x => x.textContent).join('/'), [...e.querySelectorAll('ol li')].map(x => x.textContent).join('/'), e.querySelector('a').getAttribute('href')]);
  ok(r.join('|') === 'true|wichtig|bald|alt|true|eins/zwei x.example/a|erst/dann|https://x.example/a', 'Notizen formatiert: ' + r.join('|'));
  r = await p.evaluate(() => fmtText('5*3 und a_b_c, <b>nicht</b>'));
  ok(r === '5*3 und a_b_c, &lt;b&gt;nicht&lt;/b&gt;', 'Zeichen mitten im Wort bleiben, HTML wird nicht ausgeführt: ' + r);
  // Erklärung hinter dem „i“: liegt über dem Fenster, Esc schließt nur die Erklärung
  await p.click('.foe-pop .pA-n .sub .info');
  r = await p.evaluate(() => { const m = document.querySelector('.modal'), q = m && m.getBoundingClientRect(), top = m && document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
    return [m && m.querySelector('h2').textContent, !!(top && top.closest('.modal')), m && m.querySelectorAll('tbody tr').length]; });
  ok(r.join('|') === 'Texte formatieren|true|7', 'Erklärung zur Formatierung über dem Fenster: ' + r.join('|'));
  await p.keyboard.press('Escape');
  ok(await p.evaluate(() => !document.querySelector('.modal') && !!document.querySelector('.foe-pop')), 'Esc schließt die Erklärung, das Fenster bleibt');
  // kein waagrechter Scrollbalken in den Bereichen
  r = await p.evaluate(() => [...document.querySelectorAll('.pop-body > div')].map(d => { const cs = getComputedStyle(d); return cs.overflowX + ':' + (d.offsetHeight - d.clientHeight - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth)); }).join());
  ok(r === 'hidden:0,hidden:0,hidden:0,hidden:0', 'Bereiche im Fenster ohne waagrechten Scrollbalken: ' + r);
  // Rückgängig: versehentlich gelöschten Kontakt mit Strg+Z zurückholen
  await p.waitForTimeout(50);
  await p.click('.foe-pop .k-pen'); await p.click('.foe-pop .k-ed .x'); await p.click('.foe-pop .pA-box .sub [data-act="k-fertig"]');
  ok(await p.evaluate(() => cur().foerderer.find(x => x.id === 'f-mtw-lot').kontakte.map(c => c.n).join()) === 'Petra Lotto,Dritte Person', 'Kontakt gelöscht');
  await p.keyboard.press('Control+z');
  r = await p.evaluate(() => [cur().foerderer.find(x => x.id === 'f-mtw-lot').kontakte.map(c => c.n).join(), !!document.querySelector('.foe-pop')]);
  ok(r.join('|') === 'Max Los,Petra Lotto,Dritte Person|true', 'Strg+Z holt den Kontakt zurück, Fenster bleibt offen: ' + r.join('|'));
  await p.keyboard.press('Escape');
  // Kachel unten: Symbole mit Hinweis beim Überfahren
  await p.hover('#fuss-f-mtw-lot a.fi[href^="tel:"]');
  r = await p.evaluate(() => [[...document.querySelectorAll('#fuss-f-mtw-lot a.fi')].map(a => a.textContent + a.getAttribute('href')).join(), ($('.tip-pop') || {}).textContent]);
  ok(r.join('|') === '☎tel:021112345|0211 12345', 'Kachel: Symbol nur für vorhandene Angaben (Max Los hat nur Telefon), Nummer beim Überfahren: ' + r.join('|'));
  await p.mouse.move(5, 5);
  ok(!(await p.$('.tip-pop')), 'Hinweis verschwindet beim Verlassen');
  await p.evaluate(() => { cur().foerderer.find(x => x.id === 'f-mtw-lot').betrag = 30000; changed(); keep(renderNow); });
  // Betrag beim Tippen gleich mit Tausenderpunkt
  await p.click('#amt-f-mtw-lot', { clickCount: 3 }); await p.keyboard.type('45000');
  r = await p.evaluate(() => [document.querySelector('#amt-f-mtw-lot').value, cur().foerderer.find(f => f.id === 'f-mtw-lot').betrag]);
  ok(r.join() === '45.000,45000', 'Summe beim Tippen: 45000 → 45.000: ' + r.join());
  // Rückgängig in der Kopfzeile: Tippen im selben Feld ist ein Schritt; ein entfernter Förderer kommt zurück
  await p.click('.undo-btn');
  ok(await p.evaluate(() => cur().foerderer.find(f => f.id === 'f-mtw-lot').betrag) === 30000, 'Rückgängig nimmt das ganze Tippen in einem Schritt zurück');
  await p.click('.fp [data-act="rm-foe"][data-fid="f-mtw-lot"]'); await p.click('.modal footer button.primary');
  ok(await p.evaluate(() => !cur().foerderer.some(f => f.id === 'f-mtw-lot')), 'Förderer entfernt');
  await p.waitForTimeout(100); await p.click('.undo-btn');
  r = await p.evaluate(() => { const f = cur().foerderer.find(f => f.id === 'f-mtw-lot'); return [!!f && f.betrag, !!document.querySelector('#fuss-f-mtw-lot')]; });
  ok(r.join() === '30000,true', 'Rückgängig in der Kopfzeile holt den Förderer zurück: ' + r.join());
  await p.click('#amt-f-mtw-lot', { clickCount: 3 }); await p.keyboard.type('45000');
  // neuer Förderer: kein Auswahlpfeil des Browsers, eigene Vorschläge
  await p.click('.fk-grid .fk-neu'); await p.keyboard.type('Bürger');
  r = await p.evaluate(() => [document.activeElement.hasAttribute('list'), [...document.querySelectorAll('.le-sug .le-opt')].map(o => o.textContent).join()]);
  ok(r[0] === false && r[1].includes('Bürgerstiftung Musterstadt'), 'Namensfeld ohne Pfeil, Vorschläge beim Tippen: ' + r[1]);
  await p.click('.le-opt:text-is("Bürgerstiftung Musterstadt")');
  ok(await p.evaluate(() => cur().foerderer.at(-1).name === 'Bürgerstiftung Musterstadt'), 'Vorschlag übernommen');
  // Bedarf oben: links nur die Zuständigen (je Zeile zwei), rechts die Beschreibung – ohne Eingabefelder; Deadline und Stichworte im Kopf
  await p.evaluate(() => scrollTo(0, 0));
  r = await p.evaluate(() => { const E = document.querySelector('#sec-eck'), l = E.querySelector('.eck-l').getBoundingClientRect(), rr = E.querySelector('.eck-r').getBoundingClientRect(),
    be = E.querySelector('.pe[data-k="beschreibung"]').getBoundingClientRect(), k = [...E.querySelectorAll('.k1')].map(e => e.getBoundingClientRect());
    return [Math.abs(l.top - rr.top) <= 6, rr.left > l.right, Math.abs(rr.width - l.width) < 40, be.left >= rr.left - 8, E.querySelectorAll('input, textarea').length,
      [...E.querySelectorAll('.k1 .kn')].map(e => e.textContent).join(), k[0].top === k[1].top && k[1].left > k[0].right, [...E.querySelectorAll('.eck-l > *')].map(e => e.className || e.id).join(),
      document.querySelector('#d-meta').textContent, !!document.querySelector('.d-head #d-sw .sw-plus[data-tip="Stichworte oder Fördertöpfe"]')]; });
  ok(r.join('|') === 'true|true|true|true|0|Thomas Beispiel,Anna Muster|true|sub,zust-liste,fach-pers|Deadline: 30.06.2027|true', 'Bedarf oben: links die Zuständigen nebeneinander und darunter das Fachreferat, rechts die Beschreibung; im Kopf „Deadline: …“ und das + für Stichworte: ' + r.join('|'));
  ok(await p.evaluate(() => [...document.querySelectorAll('#zust-liste .k1')].every(k => getComputedStyle(k).backgroundColor === 'rgb(243, 243, 241)')), 'Zuständige dauerhaft grau hinterlegt');
  // Zuständige bearbeiten wie Kontakte: Linien, zwei je Zeile, auch mehr als drei, Fertig oben rechts
  await p.click('#sec-eck .k-pen');
  r = await p.evaluate(() => [document.querySelectorAll('#sec-eck .k-ed').length, [...document.querySelectorAll('#zust-liste > .k-ed:first-child input')].map(e => e.placeholder).join(','), !!document.querySelector('#sec-eck .sub [data-act="k-fertig"]')]);
  ok(r.join('|') === '2|Vorname Nachname,Position,E-Mail-Adresse,Telefonnummer,Handynummer|true', 'Stift: Zuständige als Linien mit Handy, „Fertig“ oben rechts: ' + r.join('|'));
  await p.fill('#sec-eck [data-p="zust.0.rolle"]', 'Ortsbeauftragter'); await p.fill('#sec-eck [data-p="zust.0.mail"]', 'thomas@malteser.example'); await p.fill('#sec-eck [data-p="zust.0.tel"]', '05251 123'); await p.fill('#sec-eck [data-p="zust.0.mobil"]', '0170 55');
  // „+ weitere Person“ öffnet die Suche in der Personenliste; „Neue Person eintragen …“ gibt eine leere Zeile
  const neuePerson = async () => { await p.click('#sec-eck .k-plus'); await p.waitForSelector('.modal .ps-such'); await p.click('.modal footer .ps-neu'); await p.waitForTimeout(150); };
  await p.click('#sec-eck .k-plus'); await p.waitForSelector('.modal .ps-such');
  ok(await p.$eval('.modal h2', e => e.textContent) === 'Person hinzufügen' && !!(await p.$('.modal footer .ps-neu')), 'das „+“ neben „Personenliste“ öffnet die Suche mit „Neue Person eintragen …“');
  await p.click('.modal footer .ps-neu'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const k = [...document.querySelectorAll('#sec-eck .k-ed')].map(e => e.getBoundingClientRect()); return [k.length, !!document.querySelector('#sec-eck .k-plus') && !document.querySelector('#sec-eck .kadd'), k[0].top === k[1].top, k[2].top > k[0].bottom && Math.abs(k[2].left - k[0].left) < 2]; });
  ok(r.join() === '3,true,true,true', 'dritte Person in der nächsten Zeile, weitere möglich: ' + r.join());
  await p.click('#sec-eck .sub [data-act="k-fertig"]');
  await p.waitForSelector('.modal'); ok((await p.$eval('.modal', e => e.textContent)).includes('Personenliste'), 'Fertig mit geänderten Angaben: Frage, ob sie dauerhaft in die Personenliste sollen');
  await p.click('.modal footer button:not(.primary)'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [cur().zust.map(kontaktText).join(' | '), [...document.querySelectorAll('#sec-eck .k1 a')].map(a => a.getAttribute('href') + '=' + a.dataset.tip).join(), document.querySelector('#sec-eck .k1 .star').textContent, document.querySelectorAll('#sec-eck .k1 .kl').length, document.querySelector('#sec-eck .k1 .kr').textContent]);
  ok(r.join(' / ') === 'Thomas Beispiel; Ortsbeauftragter; thomas@malteser.example; 05251 123 | Anna Muster / mailto:thomas@malteser.example=thomas@malteser.example,tel:05251123=05251 123,tel:017055=0170 55 / ★ / 0 / Ortsbeauftragter',
    'Fertig: leere Zeile entfernt; Name und Position, E-Mail und Telefon nur als Knöpfe: ' + r.join(' / '));
  await p.hover('#sec-eck .k1 .kb[href^="tel:"]');
  ok(await p.evaluate(() => ($('.tip-pop') || {}).textContent) === '05251 123', 'über dem Anruf-Knopf steht die Nummer');
  await p.mouse.move(5, 5);
  await p.click('#sec-eck .k1 .star.off');
  ok(await p.evaluate(() => cur().zust.map(z => z.n).join()) === 'Anna Muster,Thomas Beispiel', '☆ macht eine Person zur Ansprechperson (sie steht in der Liste)');
  await p.click('#sec-eck .k1 .star.off');
  // ein bekannter Name bringt in einem anderen Bedarf Position, E-Mail und Telefon mit
  await p.evaluate(() => { UI.id = 'b-aed'; renderNow(); });
  await p.click('#sec-eck .k-pen'); await neuePerson(); await p.keyboard.type('thomas b');
  const sug = await p.$$eval('.le-sug .le-opt', o => o.map(x => x.textContent).join());
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  r = await p.evaluate(() => [cur().zust.map(kontaktText).join(' | '), [...document.querySelectorAll('#sec-eck .k-ed')].at(-1).querySelector('.k-li-mail').value]);
  ok(sug === 'Thomas Beispiel' && r.join(' / ') === 'Klaus Exempel | Thomas Beispiel; Ortsbeauftragter; thomas@malteser.example; 05251 123 / thomas@malteser.example', 'Vorschlag beim Namen, Angaben aus dem anderen Bedarf ergänzt: ' + sug + ' / ' + r.join(' / '));
  await neuePerson();
  await p.evaluate(() => { UI.id = 'b-mtw'; renderNow(); });
  ok(await p.evaluate(() => D.bedarfe.find(x => x.id === 'b-aed').zust.length === 2 && !UI.zEdit), 'Seite verlassen: Bearbeiten endet, leere Zeile fällt weg');
  await p.waitForSelector('.modal'); ok((await p.$eval('.modal', e => e.textContent)).includes('Thomas Beispiel'), 'auch beim Verlassen der Seite: Frage nach der Personenliste');
  await p.click('.modal footer button:not(.primary)'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const x = { zust: [{ n: 'A', rolle: 'R', mail: '', tel: '' }, { n: 'B', rolle: '', mail: '', tel: '' }] }, t = L => L.map(z => z.n + (z.rolle ? ':' + z.rolle : '')).join(',');
    return [t(zustVorn(x, 'B')), t(zustVorn(x, 'C')), t(zustVorn({ zust: [{ n: 'A', rolle: '', mail: '', tel: '' }] }, 'Thomas Beispiel')), t(zustVorn(x, ''))].join(' / '); });
  ok(r === 'B,A:R / C,A:R,B / Thomas Beispiel:Ortsbeauftragter / B', 'Ansprechperson in der Liste ändern: vorhandene nach vorn, Angaben gehen nicht verloren, bekannte bringt ihre mit: ' + r);
  r = await p.evaluate(() => JSON.stringify(normalize({ bedarfe: [{ id: 'x', zust: ['Anna', ' ', { n: 'Bo', mail: 'b@x.de' }, {}] }] }).bedarfe[0].zust));
  ok(r === '[{"n":"Anna","rolle":"","mail":"","tel":"","mobil":""},{"n":"Bo","rolle":"","mail":"b@x.de","tel":"","mobil":""}]', 'bisherige Namen werden zu Zuständigen mit leeren Angaben: ' + r);
  // Deadline im Kopf: Klick öffnet den Kalender
  await p.click('#d-meta .d-dl');
  ok(!!(await p.$('.cal-pop .cal-d.on[data-v="2027-06-30"]')), 'Klick auf die Deadline im Kopf öffnet den Kalender beim Datum');
  await p.click('.cal-pop .cal-d[data-v="2027-06-15"]');
  r = await p.evaluate(() => [cur().deadline, document.querySelector('#d-meta').textContent]);
  ok(r.join() === '2027-06-15,Deadline: 15.06.2027', 'Deadline geändert: ' + r.join());
  // Stichworte über das + im Kopf: eintippen, Enter, das nächste; Vorschläge; × nimmt eines weg; die Liste filtert nach jedem
  await p.hover('#d-sw .sw-plus');
  ok(await p.evaluate(() => ($('.tip-pop') || {}).textContent) === 'Stichworte oder Fördertöpfe', 'beim Überfahren des + steht „Stichworte oder Fördertöpfe“');
  await p.click('#d-sw .sw-plus'); await p.keyboard.type('landes'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  await p.keyboard.type('Aktion Mensch'); await p.keyboard.press('Enter'); await p.keyboard.type('aktion mensch'); await p.keyboard.press('Enter');
  r = await p.evaluate(() => [cur().stichworte.join('|'), !!document.activeElement.closest('.sw-pop'), [...document.querySelectorAll('#d-sw .pchip')].map(e => e.firstChild.textContent).join('|')]);
  ok(r.join(' / ') === 'Landesprogramm Digitalisierung 2027|Aktion Mensch / true / Landesprogramm Digitalisierung 2027|Aktion Mensch', 'Stichworte: Vorschlag und eigenes per Enter, doppeltes nicht, das Feld bleibt für das nächste offen, Marken im Kopf: ' + r.join(' / '));
  await p.keyboard.type('Ohne Enter'); await p.mouse.click(5, 300); await p.waitForTimeout(80);
  ok(await p.evaluate(() => cur().stichworte.at(-1) === 'Ohne Enter' && !document.querySelector('.sw-pop')), 'Getipptes Stichwort ohne Enter geht beim Wegklicken nicht verloren');
  await p.evaluate(() => { cur().stichworte.pop(); changed(); renderNow(); });
  await p.click('#d-sw .pchip .x');
  r = await p.evaluate(() => { const alt = UI.fSw; UI.fSw = 'Aktion Mensch'; const n = filtered().some(x => x.id === 'b-mtw'); UI.fSw = alt; return [cur().stichworte.join('|'), n, JSON.stringify(normalize({ bedarfe: [{ id: 'x', stichwort: 'Alt' }] }).bedarfe[0].stichworte)]; });
  ok(r.join(' / ') === 'Aktion Mensch / true / ["Alt"]', '× entfernt ein Stichwort; Filter der Liste findet den Bedarf; bisheriges Stichwort wird übernommen: ' + r.join(' / '));
  // Beschreibung: irgendwo in die Fläche klicken; Aufzählung sofort, Umschalt+Enter = nächster Punkt, Enter = Zeile ohne Punkt
  const er = await p.$eval('#sec-eck .eck-r', e => { const q = e.getBoundingClientRect(); return [q.left + 30, q.bottom - 12]; });
  await p.mouse.click(er[0], er[1]);
  ok(await p.evaluate(() => document.activeElement.matches('#sec-eck .eck-r .pe-rich[contenteditable]')), 'Klick unten in die freie Fläche öffnet die Beschreibung zum Schreiben');
  await p.keyboard.press('Control+A'); await p.keyboard.type('Wir brauchen:'); await p.keyboard.press('Enter'); await p.keyboard.type('* Trage');
  const tv = () => p.evaluate(() => richText(document.activeElement));
  r = await p.evaluate(() => [richText(document.activeElement), [...document.activeElement.querySelectorAll('ul li')].map(x => x.textContent).join()]);
  ok(r.join('|') === 'Wir brauchen:\n• Trage|Trage', '„* “ wird beim Tippen sofort zum Punkt (als echte Aufzählung): ' + JSON.stringify(r));
  await p.keyboard.press('Shift+Enter'); await p.keyboard.type('Decke'); await p.keyboard.press('Shift+Enter'); await p.keyboard.press('Enter');
  await p.keyboard.type('1. erst'); await p.keyboard.press('Shift+Enter'); await p.keyboard.type('dann'); await p.keyboard.press('Enter'); await p.keyboard.type('- '); await p.keyboard.press('Backspace'); await p.keyboard.type('Ende');
  r = await tv();
  ok(r === 'Wir brauchen:\n• Trage\n• Decke\n1. erst\n2. dann\nEnde', 'Umschalt+Enter: nächster Punkt bzw. Nummer; Enter: Zeile ohne Punkt, auf leerem Punkt nimmt er ihn weg; Rücktaste ebenso: ' + JSON.stringify(r));
  // Wort markieren: darüber die Formatierungsleiste; die Formatierung ist sofort zu sehen (angefangene Wörter ganz), noch einmal nimmt sie weg; Strg+U unterstreicht
  await p.evaluate(() => { const t = document.activeElement.querySelector('li').firstChild, r = document.createRange(); r.setStart(t, 1); r.setEnd(t, 4); getSelection().removeAllRanges(); getSelection().addRange(r); });
  await p.waitForTimeout(60);
  r = await p.evaluate(() => { const bar = $('.fmt-bar'); if (!bar) return null; const q = bar.getBoundingClientRect(), c = getSelection().getRangeAt(0).getBoundingClientRect();
    return [[...bar.querySelectorAll('button')].map(x => x.getAttribute('aria-label').split(' ')[0]).join(','), q.bottom <= c.top + 1 && Math.abs(q.left + q.width / 2 - (c.left + c.width / 2)) < 120]; });
  ok(r && r.join('|') === 'Fett,Kursiv,Unterstrichen,Durchgestrichen,Aufzählung|true', 'Markierung: Leiste mit fett, kursiv, unterstrichen, durchgestrichen und Aufzählung direkt darüber: ' + JSON.stringify(r));
  await p.click('.fmt-bar button[data-z="*"]'); await p.waitForTimeout(30);
  const fett = await p.evaluate(() => [document.activeElement.querySelector('li').innerHTML, [...document.querySelectorAll('.fmt-bar button.on')].map(x => x.dataset.z).join('')].join('|'));
  await p.keyboard.press('Control+u'); r = await tv(); const unter = r.includes('• *+Trage+*');
  await p.click('.fmt-bar button[data-z="*"]'); r = await tv();
  ok(fett === '<b>Trage</b>|*•' && unter && r.includes('• +Trage+\n') && await p.evaluate(() => document.activeElement.matches('.pe-rich')),
    'fett sofort sichtbar (ganzes Wort, Knopf zeigt den Stand), Strg+U unterstrichen, noch einmal fett nimmt es weg; das Feld bleibt offen: ' + fett + ' / ' + JSON.stringify(r));
  await p.keyboard.press('Control+Enter');
  r = await p.$eval('#sec-eck .pe[data-k="beschreibung"] .pv', e => [e.classList.contains('fmt'), [...e.querySelectorAll('ul li')].map(x => x.innerHTML).join(), [...e.querySelectorAll('ol li')].map(x => x.textContent).join(), !document.querySelector('.fmt-bar')]);
  ok(r.join('|') === 'true|<u>Trage</u>,Decke|erst,dann|true', 'Beschreibung gespeichert und formatiert angezeigt, Leiste wieder weg: ' + r.join('|'));
  // Schreibfeld ↔ gespeicherter Text: nichts geht verloren; Formatierung mitten im Wort gilt fürs ganze Wort; Eingefügtes kommt als schlichter Text
  r = await p.evaluate(() => { const T = ['a *b* _c_ +d+ ~e~ f', 'Vorher\n• a\n• *b*\nDanach', '1. x\n2. y', 'a\n\nb', '*+x+* y', 'Link https://x.example/a_b_c ok'];
    const d = document.createElement('div'), rt = h => { d.innerHTML = h; return richText(d); };
    return [T.filter(t => rt(fmtText(t, true)) !== t).join(' ¦ '), rt('<div>Wort<b>xyz</b> und fü<b>r de</b>n</div><div><span style="font-weight: bold">x</span> y<br>z</div>')]; });
  ok(r.join(' / ') === ' / *Wortxyz* und *für den*\n*x* y\nz', 'Schreibfeld und gespeicherter Text passen zueinander: ' + r.join(' / '));
  await p.click('#sec-eck .pe[data-k="beschreibung"]');
  await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/html', '<b style="color:red">rot</b>'); dt.setData('text/plain', 'schlicht'); document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  r = await tv(); await p.keyboard.press('Escape');
  ok(r.endsWith('Endeschlicht') && !r.includes('rot'), 'Einfügen bringt nur Text mit, keine fremde Formatierung: ' + JSON.stringify(r.slice(-20)));
  // Pro und Contra: formatiert (drei Zeilen Vorschau), Klick öffnet das Schreibfeld
  await p.evaluate(() => document.querySelector('#foe-f-mtw-lot').scrollIntoView({ block: 'center' }));
  await p.click('#foe-f-mtw-lot .pc .pro .pe-pc');
  ok(await p.evaluate(() => document.activeElement.matches('#foe-f-mtw-lot .pc .pe-rich[contenteditable]')), 'Klick auf Pro öffnet das Schreibfeld in der Kachel');
  await p.keyboard.press('Control+A'); await p.keyboard.type('Starker Regionalbezug'); await p.keyboard.press('Enter'); await p.keyboard.type('* Fahrzeug sichtbar');
  await p.evaluate(() => { const t = document.activeElement.querySelector('div').firstChild, r = document.createRange(); r.setStart(t, 8); r.setEnd(t, 12); getSelection().removeAllRanges(); getSelection().addRange(r); });
  await p.keyboard.press('Control+b'); await p.keyboard.press('Control+Enter');
  r = await p.evaluate(() => [cur().foerderer.find(f => f.id === 'f-mtw-lot').warum, document.querySelector('#foe-f-mtw-lot .pc .pro .pv').innerHTML]);
  ok(r[0] === 'Starker *Regionalbezug*\n• Fahrzeug sichtbar' && r[1].includes('<b>Regionalbezug</b>') && r[1].includes('<li>Fahrzeug sichtbar</li>'), 'Pro mit Formatierung gespeichert und angezeigt: ' + JSON.stringify(r[0]));
  // Notizen zur Spendenübergabe: ebenfalls mit Formatierung
  await p.evaluate(() => { zuSet(cur(), 'nach', false); cur().nach.ueb.noetig = true; changed(); renderNow(); });
  await p.click('#sec-nach .pe[data-k="nach.ueb.info"]');
  await p.keyboard.press('Control+A'); await p.keyboard.type('Mit _Presse_'); await p.keyboard.press('Control+Enter');
  r = await p.evaluate(() => [cur().nach.ueb.info, document.querySelector('#sec-nach .pe[data-k="nach.ueb.info"] .pv').innerHTML]);
  ok(r.join('|') === 'Mit _Presse_|Mit <i>Presse</i>', 'Notizen zur Spendenübergabe mit Formatierung: ' + r.join('|'));
  // Kreisdiagramm: lange Namen in zwei Zeilen, nichts ragt über den Rand hinaus
  await p.evaluate(() => { cur().foerderer.find(f => f.id === 'f-mtw-lot').name = 'NRW-Stiftung Naturschutz, Heimat- und Kulturpflege Nordrhein-Westfalen'; changed(); renderNow(); });
  r = await p.evaluate(() => { const svg = document.querySelector('#fin-pie svg').getBoundingClientRect(), T = [...document.querySelectorAll('#fin-pie .pl-n')];
    const raus = T.filter(t => { const q = t.getBoundingClientRect(); return q.right > svg.right + 1 || q.left < svg.left - 1; }).length;
    const lang = T.find(t => t.textContent.startsWith('NRW')); return [raus, lang ? [...lang.querySelectorAll('tspan')].map(x => x.textContent).join(' / ') : '']; });
  ok(r[0] === 0 && /^NRW-Stiftung.* \/ .+…$/.test(r[1]), 'Kreisdiagramm: langer Name in zwei Zeilen, gekürzt, nichts ragt hinaus: ' + JSON.stringify(r));
  await p.evaluate(() => { cur().foerderer.find(f => f.id === 'f-mtw-lot').name = 'Beispiel-Soziallotterie'; changed(); renderNow(); });
  // Freigaben: „Fachreferat“ vor dem Namen; Fortschritt oben: erledigt dezent grün, der aktuelle Schritt nicht hinterlegt
  r = await p.evaluate(() => { const done = $('#d-steps li.done'), cur = $('#d-steps li.cur');
    return [$('#fr-fach .fr-fach .ci-n').textContent + ' ' + $('#fr-fach .fr-name').value, getComputedStyle(done).color, getComputedStyle(done.querySelector('.st-k')).backgroundColor, getComputedStyle(cur).backgroundColor]; });
  ok(r.join('|') === 'Fachreferat Notfallvorsorge|rgb(90, 154, 95)|rgba(0, 0, 0, 0)|rgba(0, 0, 0, 0)', 'Fachreferat davor; Fortschritt: erledigt dezent grün, Kreis nur umrandet, aktueller Schritt ohne Hinterlegung: ' + r.join('|'));
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
  // mit Animationen: Strg+Klick lässt den Bedarf von rechts hereingleiten, „‹ Alle Bedarfe“ wieder hinaus
  const m = await open(b, { file, fakefs: false, motion: true });
  await m.click('tr[data-id="b-mtw"] .l-name', { modifiers: ['Control'] });
  r = await m.evaluate(() => [document.documentElement.dataset.vt || '', !!document.startViewTransition]);
  await m.waitForFunction(() => !document.documentElement.dataset.vt, null, { timeout: 3000 }).catch(() => {});
  r.push(await m.evaluate(() => UI.view + ':' + (document.documentElement.dataset.vt || '-') + ':' + !!document.querySelector('main.bedarf')));
  await m.click('button[data-act="back"]'); r.push(await m.evaluate(() => document.documentElement.dataset.vt || '')); await m.waitForFunction(() => !document.documentElement.dataset.vt, null, { timeout: 3000 }).catch(() => {});
  r.push(await m.evaluate(() => UI.view + ':' + (document.documentElement.dataset.vt || '-')));
  ok(r.join('|') === 'vor|true|detail:-:true|zurueck|list:-', 'mit Animationen: Bedarf gleitet herein, zurück gleitet er hinaus, danach ist alles wieder normal: ' + r.join('|'));
  await finish(b, [p, q, m]);
})();
