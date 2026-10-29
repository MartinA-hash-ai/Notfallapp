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
  await p.evaluate(() => { zuSet(cur(), 'nach', false); renderNow(); document.querySelector('#sec-nach .mit').scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(600);   // vorher hinscrollen: Scrollen schließt Menüs
  // Wer ist dabei: Hauptkontakt vorgeschlagen, per Klick änderbar
  let r = await p.evaluate(() => [...document.querySelectorAll('#sec-nach .mit-z')].map(z => z.querySelector('label').textContent.trim().split(' ')[0] + ':' + z.querySelector('.vo-n').textContent).join(','));
  ok(r === 'Stiftung:Anna Albers,Bank:Bernd Bank', 'hinter dem Förderer die Person (Hauptkontakt): ' + r);
  await p.click('#sec-nach .mit-z:has-text("Stiftung A") .vo-n'); await menuKlick(p, 'Otto Ohm'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [JSON.stringify(cur().nach.ueb.vorOrt), cur().nach.ueb.mit.join() === cur().foerderer[0].id, document.querySelector('#sec-nach .mit-z .vo-n').textContent]);
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
  await p.click('.ue-acts button[data-v="ueb"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [...document.querySelectorAll('.modal .rm-p')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '+' : '-')).join(','));
  ok(r === 'Gerd Gast+,Anke Presse+,Rieke Presse-', 'intern: Zuständige und nur die angeklickte Presse: ' + r);
  await p.click('.modal .rm-k:has-text("Einladung zur Spendenübergabe (intern)")');
  ok(await p.evaluate(() => !!document.querySelector('.modal .rm-ics input:checked')), 'Kalendereintrag dazu: angehakt');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  r = await p.evaluate(() => { const u = new URL(MAILS.pop()); return [decodeURIComponent(u.pathname), u.searchParams.get('subject'), u.searchParams.get('body'), DL.length && DL[DL.length - 1][0]]; });
  ok(r[0] === 'gg@x.example;ap@x.example' && r[1] === 'Einladung: Spendenübergabe Brakel – Zelt' && r[2].includes('Von den Förderern vor Ort:\r\n- Stiftung A: Otto Ohm') && r[2].includes('Presse und Öffentlichkeit: Anke Presse')
    && r[2].includes('Notizen:\r\nFotos im Hof') && r[3] === 'Spendenübergabe Zelt.ics', 'interne Einladung ausgefüllt, .ics heruntergeladen: ' + r.slice(0, 2).join(' | ') + ' | ' + r[3]);
  // Förderer einladen: die Person vor Ort ist vorgewählt
  await p.click('.ue-acts button[data-v="foe"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [...document.querySelectorAll('.modal .rm-p')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '+' : '-')).join(','));
  ok(r === 'Anna Albers-,Otto Ohm+,Bernd Bank-', 'Förderer einladen: nur die Person vor Ort angehakt (Bank B nicht dabei): ' + r);
  await p.click('.modal header .x');
  // Andere Person (nicht unter den Kontakten), dann „Niemand“
  await p.click('#sec-nach .mit-z:has-text("Bank B") .vo-n'); await menuKlick(p, 'Andere Person'); await p.waitForTimeout(100);
  await p.keyboard.type('Clara Chef'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.querySelectorAll('#sec-nach .mit-z .vo-n')[1].textContent, vlWerte(cur()).vorort]);
  ok(r[0] === 'Clara Chef' && r[1] === '- Stiftung A: Otto Ohm\n- Bank B: Clara Chef', 'andere Person eingetragen, Bank B nun dabei: ' + r.join(' | '));
  await p.click('#sec-nach .mit-z:has-text("Bank B") .vo-n'); await menuKlick(p, 'Niemand'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.querySelectorAll('#sec-nach .mit-z .vo-n')[1].textContent) === 'Person wählen', '„Niemand“: wieder offen');
  await finish(b, [p]);
})();
