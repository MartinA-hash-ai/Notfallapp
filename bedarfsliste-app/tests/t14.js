// 0.61: Tastaturbefehle selbst belegen, Zurückstellen mit Begründung (kompakt nur der Grund, immer unten), Fachreferat (Stift als Auswahl mit Suche,
// Standard-Hauptansprechperson, einmalige Frage), Rundmail und Vorlagen, Kalendereintrag, Presse bei der Spendenübergabe, „Heute“, Stichwort-Filter
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
  await p.click('.fach-pen');
  r = await p.$$eval('.modal .ps-z', L => L.map(l => l.querySelector('.ps-n').textContent + (l.querySelector('input').checked ? '+' : '-')).join(','));
  ok(r === 'Nora Vogt · im Fachreferat+,Thorsten Heß · im Fachreferat+', 'Stift: Auswahl mit Haken statt Karten: ' + r);
  await p.click('.modal .ps-z:has-text("Thorsten") input');
  await p.fill('.modal .ps-such', 'brakel'); await p.click('.modal .ps-z:has-text("Gerd Gast") input');
  await p.click('.modal footer button.primary');
  r = await p.evaluate(() => [JSON.stringify(cur().freigabe.fach.aus), JSON.stringify(cur().freigabe.fach.dazu), [...document.querySelectorAll('#fach-pers .k1 .kn')].map(e => e.textContent).join(','), document.querySelector('.fach-plus').textContent]);
  ok(r.join('|') === '["thorsten heß"]|["gerd gast"]|Nora Vogt,Gerd Gast|(+1)', 'ausgeblendet und dazugenommen: ' + r.join('|'));
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
  r = await p.$$eval('.modal .rm-a', L => L.map(l => l.textContent.trim()).join(' / '));
  ok(r.startsWith('Blanko') && !r.includes('Absprache'), 'Art: Blanko (Vorlage für die Übergabe hier nicht): ' + r);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  r = await p.evaluate(() => decodeURIComponent(MAILS.pop() || ''));
  ok(r === 'mailto:s1@x.example;s2@x.example?subject=„Cäsar“ (Paderborn)'.replace('Cäsar', 'Anna'), 'Outlook mit beiden, Betreff mit Namen: ' + r);

  // 5. Spendenübergabe: Presse, Kalendereintrag, Vorlage
  await p.evaluate(() => { const x = cur(); x.foerderer.push(ff({ name: 'Stiftung A', status: 'zugesagt', betrag: 5000 }), ff({ name: 'Bank B', status: 'zugesagt', betrag: 1200, zugesagt: 1000 }));
    Object.assign(x.nach.ueb, { termin: '2026-11-13', zeit: '15:00', ort: 'Wache, Paderborn' }); changed(); zuSet(x, 'nach', false); renderNow(); });
  r = await p.evaluate(() => [...document.querySelectorAll('.ue-presse .fach-w')].map(e => e.querySelector('.kn').textContent + (e.classList.contains('on') ? '+' : '-')).join(','));
  ok(r === 'Olaf Öffentlich+,Petra Presse+', 'Presse und Öffentlichkeit bei der Übergabe, anfangs alle gewählt: ' + r);
  await p.click('.ue-presse .fach-w:has-text("Olaf")');
  ok(await p.evaluate(() => JSON.stringify(cur().nach.ueb.presseAus)) === '["olaf öffentlich"]', 'Klick wählt ab');
  await p.click('button[data-act="ics"]'); await p.waitForTimeout(150);
  r = await p.evaluate(() => DL.pop());
  ok(r && r[0] === 'Spendenübergabe Anna.ics' && r[1].includes('DTSTART:20261113T150000\r\nDTEND:20261113T160000') && r[1].includes('SUMMARY:Spendenübergabe: Anna') && r[1].includes('LOCATION:Wache\\, Paderborn')
    && r[1].includes('Stiftung A: 5.000'), 'Kalendereintrag (.ics) mit Termin, Ort und Spendern: ' + (r ? r[0] : '-'));
  await p.click('.ue-acts button[data-act="rundmail"]');
  r = await p.evaluate(() => [...document.querySelectorAll('.modal .rm-p')].map(l => l.textContent.trim() + (l.querySelector('input').checked ? '+' : '-')).join(','));
  ok(r === 'Gerd Gast+,Sara Sozial-,Tim Sozial-,Olaf Öffentlich-,Petra Presse+', 'Rundmail Übergabe: Zuständige und gewählte Presse angehakt: ' + r);
  await p.click('.modal .rm-a:has-text("Absprache für Spendenübergabe") input');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const u = new URL(MAILS.pop()); return [decodeURIComponent(u.pathname), u.searchParams.get('subject'), u.searchParams.get('body')]; });
  ok(r[0] === 'gg@x.example;pp@x.example' && r[1] === 'Spendenübergabe „Anna“ – Absprache' && r[2].includes('Wann: Freitag, 13.11.2026, 15:00 Uhr') && r[2].includes('Wo: Wache, Paderborn')
    && r[2].includes('- Stiftung A: 5.000 €') && r[2].includes('- Bank B: 1.000 €') && r[2].includes('wer von euch an der Übergabe teilnimmt'), 'Vorlage „Absprache für Spendenübergabe“ ausgefüllt: ' + r.join(' | ').replace(/\r?\n/g, '⏎'));
  // neue Vorlage aus der Rundmail heraus, dann steht sie zur Wahl
  await p.click('#sec-eck .eck-l > .sub .k-rund');
  await p.click('.modal footer button:text-is("Neue Vorlage …")');
  await p.fill('.modal .vl-name', 'Kurze Info'); await p.fill('.modal .vl-text', 'Hallo, kurz zu {bedarf}: {summe}');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [D.settings.vorlagen.map(v => v.name + ':' + v.fuer).join(','), [...document.querySelectorAll('.modal .rm-a')].map(l => l.querySelector('b').textContent).join(',')]);
  ok(r.join('|') === 'Absprache für Spendenübergabe:ueb,Kurze Info:zust|Blanko,Kurze Info', 'neue Vorlage gespeichert, Rundmail wieder offen mit ihr: ' + r.join('|'));
  await p.click('.modal header .x');

  // 6. Stichwort beim „+“: gleich alle vorhandenen
  await p.click('button.sw-plus');
  r = await p.evaluate(() => [...document.querySelectorAll('.le-sug .le-opt')].map(e => e.textContent).join(','));
  ok(r === 'Küche,MTW', 'Stichwort „+“: vor dem Tippen alle vorhandenen (ohne die schon gesetzten): ' + r);
  await p.click('.le-sug .le-opt:text-is("MTW")'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [cur().stichworte.join(','), !!document.querySelector('.sw-pop'), [...document.querySelectorAll('.le-sug .le-opt')].map(e => e.textContent).join(',')]);
  ok(r.join('|') === 'AED,MTW|true|Küche', 'Klick fügt hinzu, Liste bleibt für das nächste: ' + r.join('|'));
  await K.press('Escape'); await p.evaluate(() => { closeMenus(); zurueck(); });

  // 7. Stichwort-Filter: Klick nur dieses, weiterer Klick dazu, Strg+Klick alle außer
  await p.waitForTimeout(100);
  const sw = async (t, mod) => { if (!(await p.$('.swf-pop'))) await p.click('button[data-act="sw-filter"]'); await p.click(`.swf-pop .swf-z:text-is("${t}")`, mod ? { modifiers: ['Control'] } : {}); await p.waitForTimeout(50); };
  await sw('Küche');
  r = [await p.evaluate(() => UI.fSw.join()), await ids(), await p.$eval('button[data-act="sw-filter"]', e => e.textContent)];
  ok(r.join('|') === 'Küche|k2|Küche▾', 'Klick: nur dieses: ' + r.join('|'));
  await sw('MTW');
  r = [await p.evaluate(() => UI.fSw.join()), await ids()];
  ok(r.join('|') === 'Küche,MTW|k0,k1,k2', 'weiterer Klick: dazu: ' + r.join('|'));
  await sw('Alle'); await sw('Küche', true);
  r = [await p.evaluate(() => UI.fSw.join()), await ids(), await p.$eval('button[data-act="sw-filter"]', e => e.textContent)];
  ok(r.join('|') === 'AED,MTW|k0,k1|alle außer Küche▾', 'Strg+Klick: alle außer diesem: ' + r.join('|'));
  await p.click('button[data-act="clear"]');

  // 8. Heute
  await p.click('button[data-act="heute-wahl"]');
  await p.click('#list-body tr[data-id="k1"] .l-name'); await p.click('#list-body tr[data-id="k2"] .l-sum');
  r = await p.evaluate(() => [UI.view, [...UI.heuteWahl].join(), document.querySelector('.heute-hw').textContent, document.querySelectorAll('#list-body tr.heute-w').length]);
  ok(r.join('|') === 'list|k1,k2|Für heute anklicken · 2 gewählt|2', 'Auswählen: Klick markiert, öffnet nicht: ' + r.join('|'));
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

  await finish(b, [p]);
})();
