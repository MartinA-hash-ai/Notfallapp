// 0.61: Tastaturbefehle selbst belegen, Zurückstellen mit Begründung (kompakt nur der Grund, immer unten), Fachreferat (Stift als Auswahl mit Suche,
// Standard-Hauptansprechperson, einmalige Frage), Rundmail und Vorlagen, Kalendereintrag, Presse bei der Spendenübergabe, „Heute“, Stichwort-Filter
// 0.63: Fachreferat mit „+“ (Suche) und Stift (direkt bearbeiten), Papierkorb im Stichwort-Fenster, „+ Bedarf“ auf der Seite, Bedarfe zusammenführen
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch();
  const p = await open(b, { fakefs: false });
  const K = p.keyboard;
  await p.evaluate(() => {
    D = normalize({ bedarfe: ['Anna', 'Berta', 'Cäsar', 'Dora'].map((t, i) => Object.assign(blank(), { id: 'k' + i, titel: t, summe: 100 * (i + 1), gliederung: 'Paderborn',
      prio: i === 3 ? 'hoch' : 'mittel', stichworte: [['AED'], ['MTW', 'AED'], ['Küche'], []][i] })) });
    personenSetzen([
      { n: 'Thorsten Heß', rolle: 'Referent', fach: 'Notfallvorsorge', mail: 'th@x.example' }, { n: 'Nora Vogt', rolle: 'Sachbearbeitung', fach: 'Notfallvorsorge', mail: 'nv@x.example' },
      { n: 'Sara Sozial', fach: 'Soziales Ehrenamt', mail: 's1@x.example' }, { n: 'Tim Sozial', fach: 'Soziales Ehrenamt', mail: 's2@x.example' },
      { n: 'Petra Presse', rolle: 'Referentin', fach: 'Presse und Öffentlichkeit', mail: 'pp@x.example' }, { n: 'Olaf Öffentlich', fach: 'Presse- und Öffentlichkeitsarbeit', mail: 'oo@x.example' },
      { n: 'Gerd Gast', rolle: 'Kreisbeauftragter', gl: 'Brakel', mail: 'gg@x.example' }]);
    SAVED_JSON = JSON.stringify(D); undoReset(); UI.ansicht = 'voll'; UI.sort = [{ k: 'titel', d: 'auf' }]; UI.prioKopf = 0; ORDER.ids = null; renderNow(); document.activeElement.blur();
    window.MAILS = []; const c = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (/^mailto:/.test(this.href)) MAILS.push(this.href); else c.call(this); };
    window.DL = []; download = (n, blob) => blob.text().then(t => DL.push([n, t]));
  });
  const ids = () => p.evaluate(() => [...document.querySelectorAll('#list-body tr[data-id]')].map(t => t.dataset.id).join(','));

  // 1. Tastaturbefehle: J statt ↓ (zusätzlich), Strg+K für die Suche – im Fenster belegt
  let r = await p.evaluate(() => [tasteText(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true })), tasteText(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true })), tasteText(new KeyboardEvent('keydown', { key: ' ' })), tasteText(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }))]);
  ok(r.join('|') === 'Strg+F|Umschalt+Enter|Leertaste|', 'Tastendruck als Text: ' + r.join('|'));
  await p.click('button[data-act="menu"]'); await p.click('#mmenu button[data-act="tasten"]');
  r = await p.$$eval('.modal table.tasten tr:not(.kz-g)', L => L.length);
  ok(r === 15, 'Fenster „Tastaturbefehle“: 15 Funktionen mit je zwei Feldern: ' + r);
  const zeile = t => `.modal table.tasten tr:has(td:text-is("${t}"))`;
  await p.click(zeile('nächster Bedarf (kompakt mit aufgeklapptem: gleich aufklappen)') + ' td:nth-child(3) .ta-k');
  await K.press('j');
  await p.click(zeile('in die Suche springen') + ' td:nth-child(2) .ta-k');
  await K.press('Control+k');
  r = await p.evaluate(() => [...document.querySelectorAll('.modal table.tasten tr.doppelt')].length);
  await p.click(zeile('vorheriger Bedarf') + ' td:nth-child(3) .ta-k'); await K.press('j');
  const rot = await p.evaluate(() => [...document.querySelectorAll('.modal table.tasten tr.doppelt')].length);
  ok(r === 0 && rot === 2, 'doppelt belegt (J zweimal in der Liste): beide Zeilen rot: ' + r + '/' + rot);
  await p.click(zeile('vorheriger Bedarf') + ' td:nth-child(3) button.x');
  await p.click('.modal footer button.primary');
  r = await p.evaluate(() => JSON.parse(localStorage.getItem('bl-tasten')));
  ok(JSON.stringify(r) === '{"l-runter":["ArrowDown","J"],"l-suche":["Strg+K",""]}', 'gespeichert (nur Abweichungen): ' + JSON.stringify(r));
  await p.focus('#list-body tr[data-id="k0"]'); await K.press('j'); await K.press('ArrowDown');
  r = await p.evaluate(() => document.activeElement.dataset.id);
  ok(r === 'k2', 'J und ↓ gehen beide weiter: ' + r);
  await K.press('Control+k');
  ok(await p.evaluate(() => document.activeElement.id === 'q'), 'Strg+K springt in die Suche');
  await K.press('Escape'); await p.evaluate(() => document.activeElement.blur());
  await p.click('.list-head .kz-info');
  r = await p.$eval('.modal', e => [e.textContent.includes('↓ / J'), e.textContent.includes('Strg+K'), [...e.querySelectorAll('tr.kz-g')].map(x => x.textContent).join('/')]);
  ok(r[0] && r[1] && r[2] === 'In der Liste/Auf der Seite eines Bedarfs/In Feldern/Überall', 'Übersicht zeigt die eigenen Tasten: ' + r.join('|'));
  await p.click('.modal footer button.primary');

  // 2. Zurückstellen mit Begründung
  await p.click('#list-body tr[data-id="k3"] .l-name', { position: { x: 200, y: 8 } }); await p.waitForTimeout(150);
  await p.click('button[data-act="more"]'); await p.click('#mmenu button[data-v="zurückgestellt"]'); await p.waitForTimeout(150);
  r = await p.$eval('.modal', e => [e.querySelector('h2').textContent, e.querySelector('.tf-l').textContent, document.activeElement.tagName]);
  ok(r.join('|') === 'Bedarf zurückstellen|Zurückgestellt, weil …|TEXTAREA', 'Zurückstellen fragt nach dem Grund: ' + r.join('|'));
  await K.type('Budget 2027 abwarten'); await K.press('Enter');
  r = await p.evaluate(() => [cur().manuell, cur().grundM, document.querySelector('.pause-grund').textContent]);
  ok(r.join('|') === 'zurückgestellt|Budget 2027 abwarten|weil: Budget 2027 abwarten', 'gespeichert, auf der Seite unter dem Stand: ' + r.join('|'));
  await p.click('.pause-grund'); await p.fill('.modal textarea', 'Budget 2028'); await p.click('.modal footer button.primary');
  ok(await p.evaluate(() => cur().grundM === 'Budget 2028'), 'Klick auf den Grund ändert ihn');
  await p.evaluate(() => { zurueck(); UI.ansicht = 'kompakt'; renderNow(); });
  r = await p.evaluate(() => { const t = document.querySelector('#list-body tr[data-id="k3"]'); return [t.querySelector('td.k-pause').textContent, t.querySelector('td.k-pause').colSpan, !t.querySelector('.pause-t'), getComputedStyle(t).opacity]; });
  ok(r.join('|') === 'Zurückgestellt, weil: Budget 2028|4|true|0.4', 'kompakt: ab der Freigabe nur „Zurückgestellt, weil: …“, blasser: ' + r.join('|'));
  ok(await ids() === 'k0,k1,k2,k3', 'zurückgestellt (mit Prio) steht ganz unten: ' + await ids());
  await p.evaluate(() => { D.bedarfe.find(x => x.id === 'k1').manuell = 'zurückgestellt'; changed(); renderNow(); });
  ok(await ids() === 'k0,k2,k3,k1', 'unter den zurückgestellten: die mit Prio zuerst: ' + await ids());
  await p.evaluate(() => { D.bedarfe.find(x => x.id === 'k1').manuell = ''; UI.ansicht = 'voll'; changed(); renderNow(); });

  // 3. Fachreferat
  await p.evaluate(() => { const x = D.bedarfe.find(y => y.id === 'k0'); x.freigabe.fach.name = 'Notfallvorsorge'; x.zust.push(Object.assign(leerZ(), { n: 'Gerd Gast', mail: 'gg@x.example' })); changed(); oeffnen('k0'); });
  await p.waitForTimeout(150);
  r = await p.evaluate(() => { const f = document.querySelector('#fach-pers'); return [f.textContent.includes('Anklicken, wer'), [...f.querySelectorAll('.k1 .kn')].map(e => e.textContent).join(','), f.querySelector('.star:not(.off)') && f.querySelector('.star:not(.off)').closest('.k1').querySelector('.kn').textContent, !f.querySelector('.fach-frage'), !!f.querySelector('.k-rund'), !!document.querySelector('#sec-eck .eck-l > .sub .k-rund')]; });
  ok(r.join('|') === 'false|Thorsten Heß,Nora Vogt|Thorsten Heß|true|true|true', 'Notfallvorsorge: Thorsten Heß von selbst Hauptansprechperson (vorn, Stern), keine Frage, kein Hinweissatz, Rundmail-Knöpfe: ' + r.join('|'));
  await p.click('#fach-pers .k1:has(.kn:text-is("Nora Vogt")) .star');
  r = await p.evaluate(() => [cur().freigabe.fach.stern, document.querySelector('#fach-pers .k1 .kn').textContent]);
  ok(r.join('|') === 'nora vogt|Nora Vogt', 'beim Bedarf jemand anderes per Stern: ' + r.join('|'));
  await p.click('#fach-pers [data-act="k-neu"]');
  r = await p.$$eval('.modal .ps-z', L => L.map(l => l.querySelector('.ps-n').textContent + (l.querySelector('input').checked ? '+' : '-')).join(','));
  ok(r === 'Nora Vogt · Notfallvorsorge+,Thorsten Heß · Notfallvorsorge+', '„+“ beim Fachreferat: Suche, nur Namen, dahinter das Fachreferat: ' + r);
  ok(await p.evaluate(() => !document.querySelector('.modal .ps-i, .modal .ps-k') && !document.querySelector('.modal').textContent.includes('Haken:')), 'ohne Position, Kontaktdaten und Hinweis oben rechts');
  await p.click('.modal .ps-z:has-text("Thorsten") input');
  await p.fill('.modal .ps-such', 'brakel'); await p.click('.modal .ps-z:has-text("Gerd Gast") input');
  await p.click('.modal footer button.primary');
  r = await p.evaluate(() => [JSON.stringify(cur().freigabe.fach.aus), cur().freigabe.fach.pers.map(c => c.n).join(','), [...document.querySelectorAll('#fach-pers .k1 .kn')].map(e => e.textContent).join(','), document.querySelector('.fach-plus').textContent]);
  ok(r.join('|') === '["thorsten heß"]|Nora Vogt,Gerd Gast|Nora Vogt,Gerd Gast|(+1)', 'ausgeblendet und dazugenommen: ' + r.join('|'));
  // Stift: direkt bearbeiten wie bei „Zuständig“; „Fertig“ fragt nach der Personenliste
  await p.click('#fach-pers .fach-pen');
  r = await p.evaluate(() => [document.querySelectorAll('#fach-pers .k-ed').length, document.querySelector('#fach-pers .k-ed input').dataset.p, !!document.querySelector('#fach-pers [data-act="k-fertig"]')]);
  ok(r.join('|') === '2|freigabe.fach.pers.0.n|true', 'Stift: Zeilen zum Bearbeiten, „Fertig“: ' + r.join('|'));
  await p.fill('#fach-pers .k-ed:nth-child(1) .k-li-mail', 'nora.neu@x.example');
  await p.click('#fach-pers .k-ed:nth-child(2) [data-act="k-weg"]');
  await p.click('#fach-pers [data-act="k-fertig"]'); await p.waitForTimeout(200);
  r = await p.evaluate(() => [cur().freigabe.fach.pers.map(c => c.n + ':' + c.mail).join(','), document.querySelector('.modal h2').textContent, document.querySelector('.modal .pb-f').textContent]);
  ok(r.join('|') === 'Nora Vogt:nora.neu@x.example|In die Personenliste übernehmen?|E-Mailnv@x.examplenora.neu@x.example', 'geändert und entfernt, Rückfrage zur Personenliste: ' + r.join('|'));
  await p.click('.modal footer button:text-is("Nur für diesen Bedarf")');
  r = await p.evaluate(() => [...document.querySelectorAll('#fach-pers .k1')].map(e => e.querySelector('.kn').textContent).join(','));
  ok(r === 'Nora Vogt', 'danach nur noch Nora Vogt: ' + r);
  await p.evaluate(() => { const f = cur().freigabe.fach; f.pers.push(fachKopie(person('Gerd Gast'))); changed(); renderNow(); });
  await p.evaluate(() => { cur().freigabe.fach.name = 'Soziales Ehrenamt'; cur().freigabe.fach.stern = ''; changed(); renderNow(); });
  r = await p.evaluate(() => { const q = document.querySelector('.fach-frage'); return q ? [...q.querySelectorAll('button')].map(x => x.textContent).join(',') : '-'; });
  ok(r === 'Sara Sozial,Tim Sozial,niemand', 'anderes Fachreferat ohne Hauptansprechperson: einmalige Frage: ' + r);
  await p.click('.fach-frage button:text-is("Tim Sozial")');
  r = await p.evaluate(() => [JSON.stringify(D.settings.fachHaupt), !document.querySelector('.fach-frage'), document.querySelector('#fach-pers .k1 .kn').textContent]);
  ok(r.join('|') === '{"soziales ehrenamt":"tim sozial"}|true|Tim Sozial', 'Antwort gilt fürs Fachreferat, Frage weg: ' + r.join('|'));
  r = await p.evaluate(() => { const x = D.bedarfe.find(y => y.id === 'k1'); x.freigabe.fach.name = 'Soziales Ehrenamt'; return fachBlock(x).includes('fach-frage'); });
  ok(!r, 'bei einem anderen Bedarf mit demselben Fachreferat: keine Frage mehr');

  // 4. Rundmail
  await p.click('#fach-pers .k-rund');
  r = await p.evaluate(() => [...document.querySelectorAll('.modal .rm-g')].map(g => g.querySelector('.rm-gt').textContent + ':' + [...g.querySelectorAll('.rm-p')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '+' : '-')).join(',')).join(' / '));
  ok(r === 'Zuständig:Gerd Gast- / Fachreferat Soziales Ehrenamt:Sara Sozial+,Tim Sozial+ / Presse und Öffentlichkeit:Olaf Öffentlich-,Petra Presse-', 'Rundmail Fachreferat: dessen Personen angehakt: ' + r);
  r = await p.$$eval('.modal .rm-k', L => L.map(l => (l.querySelector('b') || l).textContent.trim() + (l.classList.contains('on') ? '*' : '')).join(' / '));
  ok(r === 'Blanko* / Abfrage der Freigabe / Info: Finanzierung steht / +Neue Vorlage', 'Kacheln fürs Fachreferat: Blanko gewählt, die Vorlagen dafür, „+ Neue Vorlage“: ' + r);
  r = await p.evaluate(() => [...document.querySelectorAll('.modal .rm-kacheln')].map(k => getComputedStyle(k).gridTemplateColumns.split(' ').length).join() + '|' + getComputedStyle(document.querySelector('.modal .rm-g')).backgroundColor);
  ok(r.startsWith('2|') && !r.endsWith('rgba(0, 0, 0, 0)'), 'zwei Kacheln je Reihe, Empfänger im grauen Kasten: ' + r);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  r = await p.evaluate(() => decodeURIComponent(MAILS.pop() || ''));
  ok(r === 'mailto:s1@x.example;s2@x.example?subject=„Cäsar“ (Paderborn)'.replace('Cäsar', 'Anna'), 'Outlook mit beiden, Betreff mit Namen: ' + r);

  // 5. Spendenübergabe: Presse, Kalendereintrag, Vorlage
  await p.evaluate(() => { const x = cur(); x.foerderer.push(ff({ name: 'Stiftung A', status: 'zugesagt', betrag: 5000 }), ff({ name: 'Bank B', status: 'zugesagt', betrag: 1200, zugesagt: 1000 }));
    x.foerderer[x.foerderer.length - 2].kontakte = [Object.assign(leerK(), { n: 'Anna Albers', mail: 'aa@stiftung.example' })]; x.foerderer[x.foerderer.length - 1].kontakte = [Object.assign(leerK(), { n: 'Bernd Bank', mail: 'bb@bank.example' })];
    Object.assign(x.nach.ueb, { termin: '2026-11-13', zeit: '15:00', ort: 'Wache, Paderborn' }); changed(); zuSet(x, 'nach', false); renderNow(); });
  // 0.67: Presse als Karten mit E-Mail und Telefon, „+“ wählt aus bzw. trägt neu ein, Stift ändert; Pressemitteilung und Hinweistext entfallen
  r = await p.evaluate(() => [[...document.querySelectorAll('#presse-pers .k1 .kn')].map(e => e.textContent).join(','), document.querySelector('#presse-pers').textContent.includes('pp@x.example'), !!document.querySelector('#presse-pers .k-rund'),
    !document.querySelector('[data-p="nach.pm.noetig"]') && !document.querySelector('#sec-nach .sec-head p')]);
  ok(r.join('|') === 'Olaf Öffentlich,Petra Presse|true|true|true', 'Presse und Öffentlichkeit als Karten mit E-Mail, Rundmail-Knopf; keine Pressemitteilung, kein Hinweistext: ' + r.join('|'));
  await p.click('#presse-pers [data-act="k-neu"]'); await p.click('.modal .ps-z:has-text("Olaf") input'); await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [JSON.stringify(cur().nach.ueb.presse.aus), [...document.querySelectorAll('#presse-pers .k1 .kn')].map(e => e.textContent).join(',')]);
  ok(r.join('|') === '["olaf öffentlich"]|Petra Presse', '„+“: abgewählt und ausgeblendet: ' + r.join('|'));
  await p.click('#presse-pers [data-act="k-neu"]'); await p.click('.modal footer button:text-is("Neue Person eintragen …")'); await p.waitForTimeout(100);
  await p.fill('#presse-pers .k-ed:last-child .k-li-n', 'Vera Vorort'); await p.fill('#presse-pers .k-ed:last-child .k-li-mail', 'vv@x.example');
  await p.click('#presse-pers [data-act="k-fertig"]'); await p.waitForSelector('.modal h2:text-is("In die Personenliste übernehmen?")');
  await p.click('.modal footer button:text-is("Nur für diesen Bedarf")');
  r = await p.evaluate(() => [...document.querySelectorAll('#presse-pers .k1 .kn')].map(e => e.textContent).join(','));
  ok(r === 'Petra Presse,Vera Vorort', 'jemand vor Ort neu eingetragen: ' + r);
  await p.click('button[data-act="ics"]'); await p.waitForTimeout(150);
  r = await p.evaluate(() => DL.pop());
  ok(r && r[0] === 'Spendenübergabe Anna.ics' && r[1].includes('DTSTART:20261113T150000\r\nDTEND:20261113T160000') && r[1].includes('SUMMARY:Spendenübergabe: Anna') && r[1].includes('LOCATION:Wache\\, Paderborn')
    && r[1].includes('Stiftung A: 5.000'), 'Kalendereintrag (.ics) mit Termin, Ort und Spendern: ' + (r ? r[0] : '-'));
  await p.click('.ue-acts button[data-act="rundmail"][data-v="ueb"]');
  r = await p.evaluate(() => [...document.querySelectorAll('.modal .rm-p')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '+' : '-')).join(','));
  ok(r === 'Gerd Gast+,Sara Sozial-,Tim Sozial-,Petra Presse+,Vera Vorort+', 'Rundmail intern: Zuständige und Presse angehakt: ' + r);
  await p.click('.modal .rm-k:has-text("Absprache für Spendenübergabe")');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const u = new URL(MAILS.pop()); return [decodeURIComponent(u.pathname), u.searchParams.get('subject'), u.searchParams.get('body')]; });
  ok(r[0] === 'gg@x.example;pp@x.example;vv@x.example' && r[1] === 'Spendenübergabe „Anna“ – Absprache' && r[2].includes('Wann: Freitag, 13.11.2026, 15:00 Uhr') && r[2].includes('Wo: Wache, Paderborn')
    && r[2].includes('- Stiftung A: 5.000 €') && r[2].includes('- Bank B: 1.000 €') && r[2].includes('wer von euch an der Übergabe teilnimmt'), 'Vorlage „Absprache für Spendenübergabe“ ausgefüllt: ' + r.join(' | ').replace(/\r?\n/g, '⏎'));
  // Förderer einladen: gemeinsam in BCC ohne persönliche Anrede, oder einzeln mit Namen und Betrag
  await p.click('.ue-acts button[data-v="foe"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, document.querySelector('.modal .rm-k.on b').textContent, document.querySelector('.modal .rm-modus .on').textContent,
    [...document.querySelectorAll('.modal .rm-g')].map(g => g.querySelector('.rm-gt').textContent + ':' + [...g.querySelectorAll('.rm-p')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '+' : '-')).join(',')).join(' / ')]);
  ok(r.join('|') === 'Förderer zur Spendenübergabe einladen|Einladung zur Spendenübergabe|Gemeinsam (BCC)|Stiftung A:Anna Albers+ / Bank B:Bernd Bank+', 'Förderer einladen: Einladung vorgewählt, gemeinsam per BCC, Kontakte der Förderer: ' + r.join('|'));
  await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const u = MAILS.pop(), q = new URLSearchParams(u.split('?')[1]); return [u.split('?')[0], q.get('bcc'), q.get('body').split('\r\n')[0], q.get('body').includes('im Namen der Malteser in Paderborn'), q.get('body').includes('Höhe')]; });
  ok(r.join('|') === 'mailto:|aa@stiftung.example;bb@bank.example|Sehr geehrte Damen und Herren,|true|false', 'gemeinsam: alle in BCC, ohne Namen und Betrag: ' + r.join('|'));
  await p.click('.ue-acts button[data-v="foe"]'); await p.waitForTimeout(100);
  await p.click('.modal .rm-modus button:text-is("Einzeln, persönlich")'); await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, document.querySelectorAll('.modal .rm-ez').length]);
  ok(r.join('|') === 'Einzeln schreiben|2', 'einzeln: je Kontakt ein Knopf: ' + r.join('|'));
  await p.click('.modal .rm-ez:has-text("Anna Albers") button'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const u = MAILS.pop(), q = new URLSearchParams(u.split('?')[1]); return [decodeURIComponent(u.split('?')[0]), q.get('body').split('\r\n')[0], q.get('body').includes('Unterstützung in Höhe von 5.000 €')]; });
  ok(r.join('|') === 'mailto:aa@stiftung.example|Guten Tag Anna Albers,|true', 'einzeln: persönliche Anrede und Betrag: ' + r.join('|'));
  await p.click('.modal footer button.primary');
  // Ort der Übergabe: Adresse der Gliederung wird vorgeschlagen, nicht eingetragen
  await p.evaluate(() => { cur().nach.ueb.ort = ''; changed(); renderNow(); });
  await p.click('#sec-nach [data-act="adressen"]'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.querySelector('.modal h2').textContent, document.activeElement.dataset.gl]);
  ok(r.join('|') === 'Adressen der Gliederungen|Paderborn', 'ohne Adresse: Link „hinterlegen“ öffnet die Liste bei Paderborn: ' + r.join('|'));
  await p.keyboard.type('Malteser Hilfsdienst, Kilianstraße 26, 33098 Paderborn'); await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [cur().nach.ueb.ort, document.querySelector('#sec-nach .ort-vor').textContent]);
  ok(r.join('|') === '|Vorschlag: Malteser Hilfsdienst, Kilianstraße 26, 33098 Paderborn', 'Vorschlag unter dem Ort, Feld bleibt leer: ' + r.join('|'));
  await p.click('#sec-nach .ort-vor'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => cur().nach.ueb.ort === 'Malteser Hilfsdienst, Kilianstraße 26, 33098 Paderborn' && !document.querySelector('#sec-nach .ort-vor')), 'Klick übernimmt den Vorschlag');
  // neue Vorlage aus der Rundmail heraus, dann steht sie zur Wahl
  await p.click('#sec-eck .eck-l > .sub .k-rund');
  await p.click('.modal .rm-k.rm-neu');
  await p.fill('.modal .vl-name', 'Kurze Info'); await p.fill('.modal .vl-text', 'Hallo, kurz zu {bedarf}: {summe}');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [D.settings.vorlagen.filter(v => v.fuer === 'zust').map(v => v.name).join(','), [...document.querySelectorAll('.modal .rm-k')].map(l => (l.querySelector('b') || l).textContent + (l.classList.contains('on') ? '*' : '')).join(',')]);
  ok(r.join('|') === 'Terminvereinbarung zum Interview,Unterlagen anfragen,Spendenübergabe: Wann passt es?,Einladung zur Spendenübergabe,Kurze Info|Blanko,Terminvereinbarung zum Interview,Unterlagen anfragen,Spendenübergabe: Wann passt es?,Einladung zur Spendenübergabe,Kurze Info*,+Neue Vorlage',
    'neue Vorlage gespeichert, Rundmail wieder offen mit ihr (gewählt): ' + r.join('|'));
  await p.dblclick('.modal .rm-k:has-text("Unterlagen anfragen")'); await p.waitForTimeout(100);
  r = await p.evaluate(() => new URL(MAILS.pop()).searchParams.get('body'));
  ok(r.includes('fehlen mir noch:\r\n- Angebot\r\n- Interview'), 'Doppelklick auf die Kachel öffnet gleich die E-Mail, fehlende Unterlagen eingesetzt: ' + r.slice(0, 120).replace(/\r?\n/g, '⏎'));
  // gelöschte mitgelieferte Vorlage kommt nicht wieder
  await p.evaluate(() => { vorlagenDialog({ id: 'v-f-zusage' }); }); await p.waitForTimeout(100);
  await p.click('.modal button:text-is("Löschen")'); await p.click('.modal footer button.primary');
  r = await p.evaluate(() => [JSON.stringify(D.settings.vorlagenWeg), vorlagen().some(v => v.id === 'v-f-zusage')]);
  ok(r.join('|') === '["v-f-zusage"]|false', 'gelöschte mitgelieferte Vorlage bleibt weg: ' + r.join('|'));
  await p.click('#sec-eck .eck-l > .sub .k-rund');
  await p.click('.modal header .x');

  // 6. Stichwort beim „+“: gleich alle vorhandenen
  await p.click('button.sw-plus');
  r = await p.evaluate(() => [[...document.querySelectorAll('.sw-pop .sw-opt')].map(e => e.textContent).join(','), document.querySelectorAll('.le-sug').length]);
  ok(r.join('|') === 'Küche,MTW|0', 'Stichwort „+“: vor dem Tippen alle vorhandenen im selben Fenster (kein zweites): ' + r.join('|'));
  await p.click('.sw-pop .sw-opt:text-is("MTW")'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [cur().stichworte.join(','), !!document.querySelector('.sw-pop'), [...document.querySelectorAll('.sw-pop .sw-opt')].map(e => e.textContent).join(',')]);
  ok(r.join('|') === 'AED,MTW|true|Küche', 'Klick fügt hinzu, Liste bleibt für das nächste: ' + r.join('|'));
  await K.press('Escape'); await p.evaluate(() => { closeMenus(); zurueck(); });

  // 7. Stichwort-Filter: Kästchen anklicken – Haken, noch einmal – weg; Papierkorb löscht
  await p.waitForTimeout(100);
  const sw = async t => { if (!(await p.$('.swf-pop'))) await p.click('button[data-act="sw-filter"]'); await p.click(`.swf-pop .swf-z:text-is("${t}")`); await p.waitForTimeout(50); };
  await sw('Küche');
  r = [await p.evaluate(() => UI.fSw.join()), await ids(), await p.$eval('button[data-act="sw-filter"]', e => e.textContent)];
  ok(r.join('|') === 'Küche|k2|Küche▾', 'Klick: Haken: ' + r.join('|'));
  ok(await p.evaluate(() => !document.querySelector('.swf-hw') && !document.querySelector('.list-head [data-act="clear"]') && !!document.querySelector('.swf-pop .swf-kopf .swf-weg svg') && !document.querySelector('.swf-weg').disabled), 'Papierkorb im Stichwort-Fenster, kein „Filter löschen“ mehr');
  await sw('MTW');
  r = [await p.evaluate(() => UI.fSw.join()), await ids()];
  ok(r.join('|') === 'Küche,MTW|k0,k1,k2', 'weiterer Klick: dazu: ' + r.join('|'));
  await sw('Küche');
  r = [await p.evaluate(() => UI.fSw.join()), await ids(), await p.$eval('button[data-act="sw-filter"]', e => e.textContent)];
  ok(r.join('|') === 'MTW|k0,k1|MTW▾', 'noch einmal: Haken weg: ' + r.join('|'));
  // Prio-Sortierung und Stichwort-Filter überstehen das Neuladen
  await p.click('button[data-act="prio-kopf"]'); await p.waitForTimeout(50);
  await Promise.all([p.waitForNavigation(), p.evaluate(() => { window.__blReload = true; saveUI(); location.reload(); })]); await p.waitForSelector('.list-head [data-act="sw-filter"]'); await p.waitForTimeout(300);
  r = await p.evaluate(() => [UI.prioKopf, UI.fSw.join(), document.querySelector('button[data-act="sw-filter"]').textContent]);
  ok(r.join('|') === '1|MTW|MTW▾', 'nach dem Neuladen: Prio oben und Stichwort-Filter bleiben: ' + r.join('|'));
  await p.evaluate(() => {
    D = normalize({ bedarfe: ['Anna', 'Berta', 'Cäsar', 'Dora'].map((t, i) => Object.assign(blank(), { id: 'k' + i, titel: t, summe: 100 * (i + 1), gliederung: 'Paderborn', stichworte: [['AED'], ['MTW', 'AED'], ['Küche'], []][i] })) });
    SAVED_JSON = JSON.stringify(D); undoReset(); UI.prioKopf = 0; UI.view = 'list'; ORDER.ids = null; renderNow(); });
  // In die Personenliste übernehmen: Art fett, alt durchgestrichen, neu daneben, ohne „geändert“
  await p.evaluate(() => { personenSetzen([{ n: 'Gerd Gast', mail: 'gg@x.example', tel: '05251 1' }]); personenBestaetigen([{ n: 'Gerd Gast', mail: 'gerd@x.example', tel: '05251 1', rolle: 'Leitung' }], ''); });
  await p.waitForTimeout(100);
  r = await p.evaluate(() => { const f = document.querySelector('.modal .pb-f'); return [!!document.querySelector('.modal .imp-pill'), [...f.children].map(e => e.tagName + ':' + e.textContent).join(' / '), f.querySelector('s').textContent]; });
  ok(r.join('|') === 'false|B:Position / SPAN:Leitung / B:E-Mail / SPAN:gg@x.examplegerd@x.example|gg@x.example', 'Personenliste-Rückfrage: Art fett, alt durchgestrichen, neu daneben: ' + r.join('|'));
  await p.click('.modal footer button:text-is("Nur für diesen Bedarf")');
  await p.evaluate(() => { Object.assign(UI, { q: '', fSw: [], prioKopf: 0 }); ORDER.ids = null; renderNow(); });

  // 8. Heute
  await p.click('button[data-act="heute-wahl"]');
  await p.click('#list-body tr[data-id="k1"] .l-name'); await p.click('#list-body tr[data-id="k2"] .l-sum');
  r = await p.evaluate(() => [UI.view, [...UI.heuteWahl].join(), document.querySelector('.heute-hw').textContent, document.querySelectorAll('#list-body tr.heute-w').length]);
  ok(r.join('|') === 'list|k1,k2|Für heute anklicken|2', 'Auswählen: Klick markiert, öffnet nicht (ohne Zahl): ' + r.join('|'));
  ok(await p.evaluate(() => !document.querySelector('[data-act="heute-abbr"]') && getComputedStyle(document.querySelector('#list-body tr.heute-w td')).backgroundColor === 'rgb(253, 236, 234)'), 'kein „Abbrechen“, gewählte Zeilen rot hinterlegt');
  await p.click('button[data-act="heute-leer"]');
  ok(await p.evaluate(() => UI.heuteWahl.size === 0 && !document.querySelector('#list-body tr.heute-w')), 'Pfeil zurück: alle Haken weg');
  await p.click('#list-body tr[data-id="k1"] .l-name'); await p.click('#list-body tr[data-id="k2"] .l-sum');
  await p.click('button[data-act="heute-fertig"]');
  r = [await ids(), await p.$eval('.heute-seg', e => e.textContent), await p.evaluate(() => JSON.parse(localStorage.getItem('bl-heute')).ids.join())];
  ok(r.join('|') === 'k1,k2|Heute (2)Alle|k1,k2', 'danach nur die gewählten, gemerkt: ' + r.join('|'));
  await p.click('.heute-seg button[data-act="heute-alle"]');
  r = [await ids(), await p.evaluate(() => [...document.querySelectorAll('#list-body tr.heute-m')].map(t => t.dataset.id).join())];
  ok(r.join('|') === 'k0,k1,k2,k3|k1,k2', '„Alle“: ganze Liste, die von heute markiert: ' + r.join('|'));
  await p.click('.heute-seg button[data-act="heute-an"]');
  await p.evaluate(() => neuerBedarf()); await p.keyboard.type('Neu'); await p.keyboard.press('Enter'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [HEUTE.ids.length, document.querySelectorAll('#list-body tr[data-id]').length]);
  ok(r.join() === '3,3', 'neuer Bedarf, während „Heute“ an ist, gehört dazu: ' + r.join());
  r = await p.evaluate(() => { HEUTE.datum = '2020-01-01'; ORDER.ids = null; renderNow(); return [document.querySelectorAll('#list-body tr[data-id]').length, !!document.querySelector('.heute-btn')]; });
  ok(r.join() === '5,true', 'am nächsten Tag: wieder alle, Knopf „Heute“: ' + r.join());

  // 9. Papierkorb im Stichwort-Fenster löscht die Auswahl
  await p.evaluate(() => { UI.fSw = ['AED']; ORDER.ids = null; renderNow(); });
  await p.click('button[data-act="sw-filter"]'); await p.click('.swf-pop .swf-weg'); await p.waitForTimeout(50);
  r = await p.evaluate(() => [UI.fSw.length, document.querySelector('button[data-act="sw-filter"]').textContent, document.querySelector('.swf-weg').disabled]);
  ok(r.join('|') === '0|Stichwort: alle▾|true', 'Papierkorb: Stichwort-Auswahl weg: ' + r.join('|'));
  await p.evaluate(() => closeMenus());

  // 10. „+ Bedarf“ auf der Seite eines Bedarfs: gleich eine leere Seite; unberührt verschwindet sie wieder
  await p.evaluate(() => oeffnen(D.bedarfe.find(x => x.titel === 'Anna').id)); await p.waitForTimeout(150);
  const vor = await p.evaluate(() => D.bedarfe.length);
  await p.click('button[data-act="new"]'); await p.waitForTimeout(200);
  r = await p.evaluate(() => [UI.view, cur().titel === '' , document.activeElement.id, D.bedarfe.length]);
  ok(r.join('|') === 'detail|true|f-titel|' + (vor + 1), '„+ Bedarf“ auf der Seite: neue leere Seite, Schreibmarke im Namen: ' + r.join('|'));
  await p.evaluate(() => { document.activeElement.blur(); zurueck(); }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => D.bedarfe.length) === vor, 'unberührt verlassen: die leere Seite ist wieder weg');
  await p.evaluate(() => oeffnen(D.bedarfe[0].id)); await p.click('button[data-act="new"]'); await p.waitForTimeout(200);
  await p.keyboard.type('Ganz neu'); await p.keyboard.press('Enter'); await p.evaluate(() => zurueck()); await p.waitForTimeout(150);
  ok(await p.evaluate(() => D.bedarfe.some(x => x.titel === 'Ganz neu')), 'mit Namen bleibt er');

  // 11. Bedarfe zusammenführen
  await p.evaluate(() => {
    personenSetzen([{ n: 'Thorsten Heß', fach: 'Notfallvorsorge', mail: 'th@x.example' }, { n: 'Sara Sozial', fach: 'Soziales Ehrenamt', mail: 's1@x.example' }]);
    const fr = (o, f, v) => ({ ofk: { st: o }, fach: { st: f }, verw: { st: v } });
    const B = (id, titel, summe, gl, fach, st, x) => Object.assign(blank(), { id, titel, summe, gliederung: gl, freigabe: Object.assign(blank().freigabe, { ofk: Object.assign(blank().freigabe.ofk, { st: st[0] }), fach: Object.assign(blank().freigabe.fach, { name: fach, st: st[1] }), verw: Object.assign(blank().freigabe.verw, { st: st[2] }) }) }, x);
    D = normalize({ bedarfe: [
      B('pA', 'Zelt', 1000, 'Brakel', 'Notfallvorsorge', ['ok', 'ok', 'ok'], { zust: [Object.assign(leerZ(), { n: 'Anna A' })], stichworte: ['KatS'], deadline: '2027-05-01', beschreibung: 'Text A', foerderer: [ff({ name: 'Stiftung X', status: 'zugesagt', betrag: 500 })], link: 'https://x.example/a' }),
      B('pB', 'Pavillon', 2000, 'Höxter', 'Soziales Ehrenamt', ['angefragt', 'ok', 'ok'], { zust: [Object.assign(leerZ(), { n: 'Anna A', mail: 'anna@x.example' }), Object.assign(leerZ(), { n: 'Bert B' })], stichworte: ['katS', 'UPL 2027'], deadline: '2027-03-01', beschreibung: 'Text B',
        foerderer: [ff({ name: 'Stiftung X', status: 'geplant', betrag: 800 }), ff({ name: 'Bank Y', status: 'abgelehnt', betrag: 300 })] }),
      B('pC', 'Tisch', 500, 'Brakel', 'Notfallvorsorge', ['ok', 'angefragt', 'ok'], {}), B('pD', 'Anderes', 100, 'Paderborn', '', ['offen', 'offen', 'offen'], {})] });
    SAVED_JSON = JSON.stringify(D); undoReset(); UI.view = 'list'; UI.tab = 'aktiv'; UI.ansicht = 'voll'; UI.sort = [{ k: 'titel', d: 'auf' }]; ORDER.ids = null; renderNow();
  });
  await p.click('button[data-act="paket-wahl"]');
  for (const id of ['pA', 'pB', 'pC']) await p.click(`#list-body tr[data-id="${id}"] .l-sum`);
  r = await p.evaluate(() => [UI.view, [...UI.paketWahl].join(), document.querySelector('[data-act="paket-los"]').textContent, document.querySelectorAll('#list-body tr.heute-w').length]);
  ok(r.join('|') === 'list|pA,pB,pC|3 zusammenführen …|3', 'Zusammenführen: Bedarfe anklicken: ' + r.join('|'));
  await p.click('[data-act="paket-los"]'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [[...document.querySelectorAll('.modal .pk-orte label')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '+' : '-')).join(','),
    [...document.querySelectorAll('.modal .pk-foe label')].map(l => l.querySelector('b').textContent + (l.querySelector('input').checked ? '+' : '-')).join(',')]);
  ok(r.join('|') === 'Höxter+,Brakel-|Stiftung X-,Bank Y-,Stiftung X+', 'fragt Ort (größte Summe vorgewählt) und Förderer (doppelte und abgelehnte nicht angehakt): ' + r.join('|'));
  await p.fill('.modal .pk-name', 'Paket KatS'); await p.click('.modal .pk-orte label:has-text("Brakel") input'); await p.click('.modal footer button.primary'); await p.waitForTimeout(250);
  r = await p.evaluate(() => { const n = cur(), F = n.freigabe;
    return [UI.view, n.titel, n.gliederung, n.summe, n.zust.map(z => z.n + (z.mail ? ':' + z.mail : '')).join(','), n.stichworte.join(','), n.deadline, F.ofk.st + '/' + F.fach.st + '/' + F.verw.st, F.fach.name,
      fachZeig(n).Z.map(x => x.n).join(','), n.foerderer.map(f => f.name + ':' + f.status).join(','), n.link, n.prio]; });
  ok(r.join('|') === 'detail|Paket KatS|Brakel|3500|Anna A:anna@x.example,Bert B|katS,UPL 2027|2027-03-01|angefragt/angefragt/ok|Soziales Ehrenamt|Sara Sozial,Thorsten Heß|Stiftung X:zugesagt||mittel',
    'neuer Bedarf: Name, Ort, Summe, Zuständige je einmal, Stichworte, früheste Deadline, Freigaben am wenigsten weit, Fachreferat mit der größten Summe (die anderen dabei), Förderer, kein Link: ' + r.join('|'));
  r = await p.evaluate(() => cur().beschreibung);
  ok(r === ['* Pavillon, 2.000\u00a0€ (Höxter)', '* Tisch, 500\u00a0€ (Brakel)', '* Zelt, 1.000\u00a0€ (Brakel)', '', '*Pavillon, 2.000\u00a0€ (Höxter)*', 'Text B', '---------------', '*Tisch, 500\u00a0€ (Brakel)*', '(ohne Beschreibung)', '---------------', '*Zelt, 1.000\u00a0€ (Brakel)*', 'Text A'].join('\n'),
    'Beschreibung: oben die Aufzählung, darunter je Bedarf Name, Summe, Text und Linie: ' + JSON.stringify(r));
  r = await p.evaluate(() => ['pA', 'pB', 'pC', 'pD'].map(id => { const x = D.bedarfe.find(y => y.id === id); return x.manuell + (x.grundM ? ':' + x.grundM : ''); }).join(' / '));
  ok(r === 'zurückgestellt:wurde in Bedarf „Paket KatS“ zusammengeführt / zurückgestellt:wurde in Bedarf „Paket KatS“ zusammengeführt / zurückgestellt:wurde in Bedarf „Paket KatS“ zusammengeführt / ', 'die alten zurückgestellt mit Begründung, die übrigen nicht: ' + r);

  await finish(b, [p]);
})();
