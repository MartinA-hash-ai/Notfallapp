// 0.69: „Wer ist dabei?“ mit Person je Förderer, Presse anklicken, Kalendereintrag (Titel, Kategorie, Abwesend, Beschreibung), interne Einladung mit .ics
const { chromium, ok, open, finish } = require('./lib');
// Menüpunkt mit der Maus anklicken (Position aus dem Fenster; das Menü steht fest)
const menuKlick = async (p, t) => { const r = await p.evaluate(t => { const x = [...document.querySelectorAll('.vo-pop button')].find(e => e.textContent.trim().startsWith(t)); if (!x) return null; const q = x.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, t);
  if (r) await p.mouse.click(r[0], r[1]); else console.log('kein Menüpunkt', t); await p.waitForTimeout(100); };
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  await p.evaluate(() => {
    personenSetzen([{ n: 'Anke Presse', fach: 'Presse und Öffentlichkeit', mail: 'ap@x.example' }, { n: 'Rieke Presse', fach: 'Presse und Öffentlichkeit', mail: 'rp@x.example' }]);
    const x = Object.assign(blank(), { id: 'x', titel: 'Zelt', summe: 5000, gliederung: 'Brakel', zust: [Object.assign(leerZ(), { n: 'Gerd Gast', mail: 'gg@x.example' })] });
    x.foerderer.push(ff({ name: 'Stiftung A', status: 'zugesagt', betrag: 3000, kontakte: [Object.assign(leerK(), { n: 'Anna Albers', rolle: 'Vorstand', mail: 'aa@x.example' }), Object.assign(leerK(), { n: 'Otto Ohm', mail: 'oo@x.example' })] }),
      ff({ name: 'Bank B', status: 'zugesagt', betrag: 2000, kontakte: [Object.assign(leerK(), { n: 'Bernd Bank', mail: 'bb@x.example' })] }));
    Object.assign(x.nach.ueb, { termin: '2026-11-13', zeit: '15:00', ort: 'Am Markt 1, 33034 Brakel', info: 'Fotos im Hof' });
    D = normalize({ bedarfe: [x] }); SAVED_JSON = JSON.stringify(D); undoReset(); oeffnen('x');
    window.MAILS = []; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (/^mailto:/.test(this.href)) MAILS.push(this.href); else c.call(this); };
    window.DL = []; download = (n, blob) => blob.text().then(t => DL.push([n, t]));
  });
  await p.waitForTimeout(200);
  await p.evaluate(() => { zuSet(cur(), 'nach', false); renderNow(); document.querySelector('#sec-nach .ue-tab').scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(600);   // vorher hinscrollen: Scrollen schließt Menüs
  // Wer ist dabei: Hauptkontakt vorgeschlagen, per Klick änderbar
  let r = await p.evaluate(() => [...document.querySelectorAll('#sec-nach .ue-tab tbody tr')].map(z => z.querySelector('b').textContent.split(' ')[0] + ':' + z.querySelector('.vo-n').textContent).join(','));
  ok(r === 'Stiftung:Anna Albers,Bank:Bernd Bank', 'hinter dem Förderer die Person (Hauptkontakt): ' + r);
  await p.click('#sec-nach .ue-tab tr:has-text("Stiftung A") .vo-n'); await menuKlick(p, 'Otto Ohm'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [JSON.stringify(cur().nach.ueb.vorOrt), cur().nach.ueb.mit.join() === cur().foerderer[0].id, document.querySelector('#sec-nach .ue-tab tbody .vo-n').textContent]);
  ok(r.join('|') === '{"' + await p.evaluate(() => cur().foerderer[0].id) + '":{"n":"Otto Ohm","mail":"oo@x.example"}}|true|Otto Ohm', 'andere Person gewählt, Förderer gleich als dabei angehakt: ' + r.join('|'));
  // Presse: Route-Text weg, Kontaktdaten nur als Symbole; anklicken = dabei, die andere blass
  r = await p.evaluate(() => [!document.querySelector('.ue-route').textContent.includes('Google Maps'), document.querySelector('#presse-pers').textContent.includes('ap@x.example'), !!document.querySelector('#presse-pers a[href="mailto:ap@x.example"]')]);
  ok(r.join('|') === 'true|false|true', 'ohne „Route in Google Maps:“, Presse ohne ausgeschriebene Kontaktdaten: ' + r.join('|'));
  await p.click('#presse-pers .k1:has-text("Anke Presse")'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [...document.querySelectorAll('#presse-pers .k1')].map(k => k.querySelector('.kn').textContent + ':' + (k.classList.contains('on') ? 'an' : k.classList.contains('dezent') ? 'blass' : '-')).join(','));
  ok(r === 'Anke Presse:an,Rieke Presse:blass', 'Anke angeklickt, Rieke blass: ' + r);
  // Kalender: Titel mit Ort, Kategorie, Abwesend, Beschreibung mit Förderern, Person vor Ort, Presse, Notizen
  await p.click('button[data-act="ics"]'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const t = DL.pop()[1].replace(/\r\n /g, ''); return t; });
  const desc = (r.match(/DESCRIPTION:(.*)/) || [])[1] || '';
  ok(r.includes('SUMMARY:Spendenübergabe Brakel – Zelt') && r.includes('LOCATION:Am Markt 1\\, 33034 Brakel') && r.includes('CATEGORIES:Außentermin') && r.includes('X-MICROSOFT-CDO-BUSYSTATUS:OOF')
    && desc.includes('Stiftung A: 3.000 € – vor Ort: Otto Ohm') && desc.includes('Bank B: 2.000 €') && !desc.includes('Bank B: 2.000 € – vor Ort') && desc.includes('Presse und Öffentlichkeit: Anke Presse') && desc.includes('Notizen:\\nFotos im Hof'),
    'Kalendereintrag: Titel „Spendenübergabe Ort – Bedarf“, Außentermin, abwesend, alles in der Beschreibung: ' + desc.slice(0, 260));
  // Rundmail intern: Einladung (intern) mit Platzhaltern, Presse nur die angeklickte, .ics wird mit heruntergeladen
  await p.click('#presse-pers .k-rund'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [...document.querySelectorAll('.modal .rm-p')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '+' : '-')).join(','));
  ok(r === 'Gerd Gast+,Anke Presse+,Rieke Presse-', 'intern: Zuständige und nur die angeklickte Presse: ' + r);
  await p.click('.modal .rm-k:has-text("Einladung zur Spendenübergabe (intern)")');
  ok(await p.evaluate(() => !!document.querySelector('.modal .rm-ics input:checked')), 'Kalendereintrag dazu: angehakt');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const u = new URL(MAILS.pop()); return [decodeURIComponent(u.pathname), u.searchParams.get('subject'), u.searchParams.get('body'), DL.length && DL[DL.length - 1][0]]; });
  ok(r[0] === 'gg@x.example;ap@x.example' && r[1] === 'Einladung: Spendenübergabe Brakel – Zelt' && r[2].includes('Von den Förderern vor Ort:\r\n- Stiftung A: Otto Ohm') && r[2].includes('Presse und Öffentlichkeit: Anke Presse')
    && r[2].includes('Notizen:\r\nFotos im Hof') && r[3] === 'Spendenübergabe Zelt.ics', 'interne Einladung ausgefüllt, .ics heruntergeladen: ' + r.slice(0, 2).join(' | ') + ' | ' + r[3]);
  // Förderer einladen: die Person vor Ort ist vorgewählt
  await p.click('.ue-foe-h .k-rund'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [...document.querySelectorAll('.modal .rm-p')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '+' : '-')).join(','));
  ok(r === 'Anna Albers-,Otto Ohm+,Bernd Bank-', 'Förderer einladen: nur die Person vor Ort angehakt (Bank B nicht dabei): ' + r);
  await p.click('.modal header .x');
  // Andere Person (nicht unter den Kontakten), dann „Niemand“
  await p.click('#sec-nach .ue-tab tr:has-text("Bank B") .vo-n'); await menuKlick(p, 'Andere Person'); await p.waitForTimeout(100);
  await p.keyboard.type('Clara Chef'); await p.keyboard.press('Enter'); await p.keyboard.type('cc@x.example'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.querySelectorAll('#sec-nach .ue-tab tbody .vo-n')[1].textContent, vlWerte(cur()).vorort]);
  ok(r[0] === 'Clara Chef' && r[1] === '- Stiftung A: Otto Ohm\n- Bank B: Clara Chef', 'andere Person eingetragen, Bank B nun dabei: ' + r.join(' | '));
  await p.click('#sec-nach .ue-tab tr:has-text("Bank B") .vo-n'); await menuKlick(p, 'Niemand'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.querySelectorAll('#sec-nach .ue-tab tbody .vo-n')[1].textContent) === 'Person wählen', '„Niemand“: wieder offen');
  await p.click('#sec-nach .ue-tab tr:has-text("Bank B") input[data-act="mit"]'); await p.waitForTimeout(100);
  // 0.70: Tabelle der Förderer – nur zugesagte, ohne „zugesagt“, nicht angehakte blass; Eingeladen und Zusage per Klick; „Andere Person“ wird Kontakt
  r = await p.evaluate(() => [[...document.querySelectorAll('#sec-nach .ue-tab thead th')].map(t => t.textContent).join(','), [...document.querySelectorAll('#sec-nach .ue-tab tbody tr')].map(t => t.className).join(','),
    !document.querySelector('#sec-nach .ue-tab').textContent.includes('zugesagt'), cur().foerderer[1].kontakte.map(k => k.n + ':' + k.mail).join(',')]);
  ok(r.join('|') === 'Dabei,Förderer,Vor Ort,Eingeladen,Zusage|on,aus|true|Bernd Bank:bb@x.example,Clara Chef:cc@x.example', 'Tabelle, Bank B (nicht dabei) blass, „Andere Person“ mit E-Mail als Kontakt: ' + r.join('|'));
  await p.click('#sec-nach .ue-tab tr:has-text("Stiftung A") [data-act="einl-raus"]'); await p.waitForTimeout(80);
  await p.click('#sec-nach .ue-tab tr:has-text("Stiftung A") [data-act="einl-zu"]'); await p.waitForTimeout(80);
  r = await p.evaluate(() => [JSON.stringify(cur().nach.ueb.einl[cur().foerderer[0].id]), document.querySelector('#sec-nach .ue-tab tr [data-act="einl-zu"]').textContent]);
  ok(r[0] === JSON.stringify({ am: await p.evaluate(() => today()), zu: 'ja' }) && r[1] === '✓ kommt', 'Eingeladen (heute) und Zusage „kommt“: ' + r.join('|'));
  await p.click('#sec-nach .ue-tab tr:has-text("Stiftung A") [data-act="einl-raus"]'); await p.waitForTimeout(80);
  await p.click('.ue-foe-h .k-rund'); await p.waitForTimeout(100); await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  await p.click('.modal .rm-ez button'); await p.waitForTimeout(100); await p.click('.modal footer button.primary'); await p.waitForTimeout(100);   // nur eine Person: einzeln
  ok(await p.evaluate(() => cur().nach.ueb.einl[cur().foerderer[0].id].am === today()), '„Förderer einladen“ vermerkt die Einladung von selbst');
  // Verwendungsnachweis: Überschrift, „Nachweis bis“, nur zwei Stände, × = nicht nötig
  r = await p.evaluate(() => { const c = document.querySelector('#sec-nach .grid.two > div:last-child'); return [c.querySelector('h3').textContent, c.querySelector('.vn-b .na-title').textContent, c.querySelector('.vn-z label').textContent.trim(), [...c.querySelector('.vn-b .seg').children].map(x => x.textContent).join(',')]; });
  ok(r.join('|') === 'Verwendungsnachweis|Stiftung A|Nachweis bis|steht aus,erledigt', 'Verwendungsnachweis je Förderer mit zwei Ständen: ' + r.join('|'));
  await p.click('#nl-' + await p.evaluate(() => cur().foerderer[0].id) + ' .ue-x'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => !cur().foerderer[0].vn.noetig && document.querySelector('#nl-' + cur().foerderer[0].id).textContent.includes('kein Verwendungsnachweis nötig') && !!document.querySelector('#nl-' + cur().foerderer[0].id + '.vn-1 .ue-x svg')), '× beim Förderer: einzeilig „kein Verwendungsnachweis nötig“ mit Pfeil zurück');
  // Spendenübergabe löschen (mit Rückfrage) und wieder anlegen; in der Liste „keine Übergabe“
  r = await p.evaluate(() => { const h3 = document.querySelector('#sec-nach .grid.two > div h3'); return [h3.firstChild.textContent, [...h3.querySelectorAll('.ue-h-r > *')].map(x => x.className.split(' ')[0] + (x.dataset.act ? ':' + x.dataset.act : '')).join(','), !document.querySelector('[data-p="nach.ueb.noetig"]'), !document.querySelector('.ue-acts'), document.querySelector('.ue-zeit').textContent.includes('Uhr')]; });
  ok(r.join('|') === 'Spendenübergabe|ue-x:ics,seg,ue-x:ueb-weg|true|true|true', 'Kopf: „Spendenübergabe“, rechts Export, Stand, ×; keine Knopfleiste mehr; „Uhr“ hinter der Uhrzeit: ' + r.join('|'));
  await p.click('#sec-nach .ue-h [data-act="ueb-weg"]'); await p.waitForSelector('.modal h2:text-is("Spendenübergabe löschen?")'); await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [cur().nach.ueb.noetig, !!document.querySelector('#sec-nach .ue-plus'), !document.querySelector('#sec-nach .ue-tab'), kUebergabe(cur()).replace(/<[^>]+>/g, '')]);
  ok(r.join('|') === 'false|true|true|keine Übergabe', 'gelöscht: nur noch „+“, in der Liste „keine Übergabe“: ' + r.join('|'));
  r = await p.evaluate(() => { const h = document.querySelector('#sec-nach .ue-h'), pl = h.querySelector('.ue-plus').getBoundingClientRect(), t = document.createRange(); t.selectNodeContents(h.firstChild); return [pl.left - t.getBoundingClientRect().right < 20, !document.querySelector('#sec-nach .ue-weg'), !document.querySelector('#sec-nach').textContent.includes('keine Spendenübergabe')]; });
  ok(r.join('|') === 'true|true|true', '0.72: „+“ direkt hinter „Spendenübergabe“, kein Satz darunter: ' + r.join('|'));
  await p.click('#sec-nach .ue-plus'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => cur().nach.ueb.noetig && cur().nach.ueb.ort === 'Am Markt 1, 33034 Brakel' && !!document.querySelector('#sec-nach .ue-tab')), '„+“ legt sie wieder an, Angaben sind noch da');
  r = await p.evaluate(() => [...document.querySelectorAll('#sec-nach .ue-teil')].map(x => (x.querySelector('.ue-teil-h, .presse-kopf').firstChild.textContent || '').trim()).join(','));
  ok(r === 'Termin und Ort,Presse und Öffentlichkeit,Förderer bei der Übergabe', '0.72: drei Kästen: ' + r);

  // 0.71: erledigt einzeilig mit Pfeil zurück; „ohne E-Mail“ (rot) fragt nach; Kalender bei „Eingeladen“; Spalten wackeln nicht
  const fB = await p.evaluate(() => cur().foerderer[1].id);
  await p.click(`#nl-${fB} [data-p="vn.st"][data-v="erledigt"]`); await p.waitForTimeout(100);
  r = await p.evaluate(id => { const e = document.querySelector('#nl-' + id); return [e.classList.contains('vn-1'), e.textContent.replace(/\s+/g, ' ').trim(), !!e.querySelector('[data-act="vn-st"] svg')]; }, fB);
  ok(await p.evaluate(id => { const e = document.querySelector('#nl-' + id), n = document.querySelector('.vn-nn'); return getComputedStyle(e).backgroundColor === getComputedStyle(document.documentElement).getPropertyValue('--okbg').trim().replace(/^#(..)(..)(..)$/, (m, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`) && (!n || +getComputedStyle(n).opacity < .7); }, fB), '0.72: erledigt mit grünem Hintergrund, nicht nötig blass');
  ok(r.join('|') === 'true|Bank B✓ erledigt|true', 'erledigt: eine Zeile mit grünem Haken und Pfeil zurück: ' + r.join('|'));
  await p.click(`#nl-${fB} [data-act="vn-st"]`); await p.waitForTimeout(100);
  ok(await p.evaluate(id => cur().foerderer[1].vn.st === 'offen' && !!document.querySelector('#nl-' + id + ' .vn-z'), fB), 'Pfeil zurück: wieder „steht aus“');
  await p.evaluate(() => { const f = cur().foerderer[0]; cur().nach.ueb.vorOrt = { [f.id]: { n: 'Peter Beispiel', mail: '' } }; changed(); renderNow(); document.querySelector('#sec-nach .ue-tab').scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(300);
  r = await p.evaluate(() => { const o = document.querySelector('#sec-nach .vo-ohne'); return [o.textContent, getComputedStyle(o).color === getComputedStyle(document.documentElement).getPropertyValue('--red').trim().replace(/^#(..)(..)(..)$/, (m, a, b2, c) => 'rgb(' + [a, b2, c].map(x => parseInt(x, 16)).join(', ') + ')')]; });
  ok(r.join('|') === 'ohne E-Mail|true', '„ohne E-Mail“ in Rot: ' + r.join('|'));
  await p.click('#sec-nach .vo-ohne'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, document.querySelector('.modal input[aria-label="Name"]').value, document.activeElement.getAttribute('aria-label')]);
  ok(r.join('|') === 'Wer ist dabei?|Peter Beispiel|E-Mail', 'Klick fragt nach, Name schon drin, Schreibmarke in der E-Mail: ' + r.join('|'));
  await p.keyboard.type('pb@x.example'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => vorOrt(cur(), cur().foerderer[0]).mail === 'pb@x.example' && !document.querySelector('#sec-nach .vo-ohne')), 'E-Mail nachgetragen');
  const breite = () => p.evaluate(() => [...document.querySelectorAll('#sec-nach .ue-tab thead th')].map(t => Math.round(t.getBoundingClientRect().width)).join(','));
  const w0 = await breite();
  for (let i = 0; i < 3; i++) { await p.click('#sec-nach .ue-tab tbody tr:first-child [data-act="einl-zu"]'); await p.waitForTimeout(80); }
  await p.click('#sec-nach .ue-tab tbody tr:first-child [data-act="einl-raus"]'); await p.waitForTimeout(80);
  ok(await breite() === w0, 'Spaltenbreiten bleiben gleich beim Umschalten: ' + w0);
  if (!(await p.$('#sec-nach .ue-tab tbody tr:first-child .ue-cal'))) { await p.click('#sec-nach .ue-tab tbody tr:first-child [data-act="einl-raus"]'); await p.waitForTimeout(80); }
  ok(await breite() === w0, 'auch mit Datum und Kalender gleich breit');
  r = await p.evaluate(() => !!document.querySelector('#sec-nach .ue-tab tbody tr:first-child .ue-cal'));
  if (r) { await p.click('#sec-nach .ue-tab tbody tr:first-child .ue-cal'); await p.waitForTimeout(150); }
  ok(r && await p.evaluate(() => !!document.querySelector('.cal-pop')), 'Kalender neben dem Datum der Einladung öffnet die Datumswahl');

  await finish(b, [p]);
})();
