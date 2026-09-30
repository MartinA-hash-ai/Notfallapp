const { chromium } = require('./pw');
const T = require('./common');
const fs = require('fs');
const HTML = T.HTML;
const ok = (c, m) => console.log((c ? 'OK   ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE', acceptDownloads: true });
  await ctx.addInitScript({ path: T.FAKEFS });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + HTML); await p.waitForTimeout(400);
  await p.evaluate(() => { try { localStorage.setItem('jp-savehint', '1'); } catch (e) {} });
  await p.mouse.move(5, 900);

  // ---------- Jahresplan
  const th = await p.evaluate(() => { const t = document.querySelector('.mtable th.h-status'); const cs = getComputedStyle(t); return [t.textContent.trim(), cs.borderTopLeftRadius, cs.paddingLeft]; });
  ok(th[0] === 'PAL-Status' && th[1] === '0px', 'Kopf „PAL-Status“ ohne runde Ecken ' + JSON.stringify(th));
  const al = await p.evaluate(() => getComputedStyle(document.querySelector('.mtable td.num input')).textAlign);
  ok(al === 'left' || al === 'start', 'Auflage linksbündig: ' + al);
  const ord = await p.evaluate(() => { const t = document.querySelector('.mtable th.h-ph_S .th2'); return [t.children[0].textContent, [...t.children[1].childNodes].map(n => n.nodeType === 3 ? 'T:' + n.textContent : n.className).join(' | ')]; });
  ok(ord[0] === 'Start der' && /^T:Selektion \| chip demo ph/.test(ord[1]), 'Kopf zweizeilig „' + ord[0] + '“ / ' + ord[1] + ' – Symbol rechts');
  const palBg = await p.evaluate(() => {
    const x = C.ms[0]; commit(d => { d.massnahmen.find(m => m.id === x.id).palStatus = 'fest'; }); renderNow();
    const td = document.querySelector('tr[data-m="' + x.id + '"] td.pal'), td2 = document.querySelector('tr[data-m="' + C.ms[1].id + '"] td.pal');
    const r = [getComputedStyle(td).backgroundColor, getComputedStyle(td.querySelector('input')).color, getComputedStyle(td2).backgroundColor, getComputedStyle(td2.querySelector('input')).color];
    undo(); return r;
  });
  ok(palBg[0] !== palBg[2] && palBg[1] !== palBg[3], 'PAL fest ohne Farbe, vorläufig farbig ' + JSON.stringify(palBg));
  const cb = await p.evaluate(() => { const c = document.querySelector('.mtable td.vis input'); const cs = getComputedStyle(c), a = getComputedStyle(c, '::after'); return [cs.appearance, cs.backgroundColor, cs.borderTopColor, a.borderLeftColor]; });
  ok(cb[0] === 'none', 'Häkchen hell: ' + JSON.stringify(cb));
  await p.screenshot({ path: 'r7_jahr.png', clip: { x: 0, y: 0, width: 1600, height: 420 } });

  // ---------- Warnungen: Vorziehen auch bei Feiertag, Detailplan und PAL
  const w1 = await p.evaluate(() => {
    const x = C.ms.find(x => !x.m.plan && x.pal != null);
    commit(d => { const m = d.massnahmen.find(q => q.id === x.id); m.vorlauf = Object.assign({}, m.vorlauf, { S: dn(m.pal) - mkdn(2027, 5, 6) }); }); derive();   // Christi Himmelfahrt
    const a = C.warnings.find(w => w.mid === x.id && /Feiertag/.test(w.text));
    const plan = C.warnings.find(w => /Sommermailing: Start Selektion/.test(w.text));
    return [a && a.fix && ds(a.fix.to), plan && plan.fix && ds(plan.fix.to), C.warnings.filter(w => w.fix).length];
  });
  ok(w1[0] === '2027-05-05' && w1[1] === '2027-04-02', 'Vorziehen bei Feiertag (' + w1[0] + ') und bei Detailplan (' + w1[1] + '), ' + w1[2] + ' Warnungen mit Knopf');
  const w2 = await p.evaluate(() => { const list = C.warnings.filter(w => w.fix && w.lvl === 'warn'); commit(d => { list.forEach(w => applyFix(d, w)); }); derive(); const left = C.warnings.filter(w => w.fix); const x = C.ms.find(x => x.m.name === 'Sommermailing'); return [left.length, left.map(w => w.text).join(' | '), ds(x.s), wd(x.s)]; });
  ok(w2[0] === 0 && w2[3] < 5, 'Alle vorgezogen: übrig ' + w2[0] + ' ' + w2[1] + ' · Sommermailing S jetzt ' + w2[2]);
  const w3 = await p.evaluate(() => { const x = C.ms.find(x => !x.m.plan && x.pal != null); commit(d => { d.massnahmen.find(q => q.id === x.id).pal = '2027-10-03'; }); derive(); const w = C.warnings.find(w => w.mid === x.id && /PAL/.test(w.text)); const r = [w && w.text, w && w.fix && ds(w.fix.to)]; undo(); return r; });
  ok(w3[1] === '2027-10-02', 'PAL am Feiertag → Samstag davor: ' + JSON.stringify(w3));
  await p.evaluate(() => { undo(); undo(); });

  // ---------- Zeitleiste
  await p.click('nav.tabs >> text=Zeitleiste'); await p.waitForTimeout(200);
  const pills = await p.evaluate(() => [document.querySelectorAll('.filterbar .tpill').length, document.querySelectorAll('.sec[data-sec="ag"] .sec-h .tpill').length]);
  ok(pills[0] === 0 && pills[1] === 4, 'S/I/D/P-Knöpfe bei „Was steht an?“ ' + JSON.stringify(pills));
  const op = await p.evaluate(() => { const x = C.ms[2]; highlight(x.id); const other = document.querySelector('.tl-row[data-m]:not(.hl-on) .tl-lab'); const r = [getComputedStyle(other).opacity, getComputedStyle(other.closest('.tl-row')).opacity, getComputedStyle(other.querySelector('.nm')).opacity, getComputedStyle(other).backgroundColor]; return r; });
  ok(op[0] === '1' && op[1] === '1' && +op[2] < 0.5, 'Hervorheben: Namensfeld bleibt deckend ' + JSON.stringify(op));
  await p.evaluate(() => { document.querySelector('.tl').scrollLeft = 300; }); await p.waitForTimeout(100);
  await p.screenshot({ path: 'r7_tl_hl.png', clip: { x: 0, y: 90, width: 1600, height: 460 } });
  await p.evaluate(() => highlight(null));
  const hs = await p.evaluate(() => { const x = C.ms.find(x => !x.pc && x.s != null); const e = document.querySelector('.tl-row[data-m="' + x.id + '"] .handle.h-S'); e.scrollIntoView({ block: 'center', inline: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, workdays(x.s, x.pal - 1)]; });
  await p.mouse.move(hs[0] - 20, hs[1]); await p.mouse.move(hs[0], hs[1], { steps: 3 }); await p.waitForTimeout(500);
  const tt = await p.evaluate(() => document.querySelector('#tip.on') ? document.querySelector('#tip').innerText : '');
  ok(tt.includes(hs[2] + ' Werktage vor PAL'), 'Tooltip S: ' + tt.replace(/\n/g, ' / '));
  await p.mouse.move(5, 900);
  await p.click('.filterbar .fbtn >> nth=0'); await p.waitForTimeout(100);
  await p.click('.menu.pop button:has-text("keine")'); await p.waitForTimeout(150);
  const pop1 = await p.evaluate(() => [!!document.querySelector('.menu.pop'), $$('.menu.pop input:checked').length, UI.hiddenM.size]);
  await p.click('.menu.pop button:has-text("alle")'); await p.waitForTimeout(150);
  const pop2 = await p.evaluate(() => [!!document.querySelector('.menu.pop'), $$('.menu.pop input:checked').length, UI.hiddenM.size]);
  await p.mouse.click(800, 900); await p.waitForTimeout(100);
  const pop3 = await p.evaluate(() => !!document.querySelector('.menu.pop'));
  ok(pop1[0] && pop1[1] === 0 && pop2[0] && pop2[1] > 0 && pop2[2] === 0 && !pop3, 'Maßnahmen-Auswahl bleibt offen bis Klick daneben ' + JSON.stringify([pop1, pop2, pop3]));

  // ---------- Detailpläne
  await p.click('nav.tabs >> text=Detailpläne'); await p.waitForTimeout(200);
  const gid = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.find(s => s.typ === 'gruppe').id);
  const gin = p.locator(`[data-fk="st:${gid}:gwer"]`);
  await gin.fill('Eva'); await gin.press('Enter'); await p.waitForTimeout(200);
  const gw = await p.evaluate(gid => { const st = C.byId.get(UI.planSel).m.plan.steps, i = st.findIndex(s => s.id === gid); const out = []; for (let j = i + 1; j < st.length && st[j].typ !== 'gruppe'; j++) out.push(st[j].wer); return out; }, gid);
  ok(gw.length && gw.every(w => w === 'Eva'), 'Abschnitt → Eva: ' + gw.join(','));
  await p.screenshot({ path: 'r7_plan_gruppe.png', clip: { x: 0, y: 0, width: 1600, height: 560 } });
  // Dialog: nur Beginn ändern → Ende eine Woche später
  await p.click('.pl-table .addbtn >> nth=0'); await p.waitForTimeout(150);
  const pre = await p.evaluate(() => [...document.querySelectorAll('.modal input[type=date]')].map(i => i.value).concat(document.querySelector('.modal input[list="dl-personen"]').value));
  const d = await p.$$('.modal input[type=date]');
  await d[0].fill('2027-05-10'); await d[0].dispatchEvent('input'); await p.waitForTimeout(50);
  const post = await p.evaluate(() => [...document.querySelectorAll('.modal input[type=date]')].map(i => i.value));
  await p.fill('.modal input[placeholder^="z. B."]', 'Wochenschritt');
  await p.click('.modal button:has-text("Anlegen")'); await p.waitForTimeout(200);
  const nsr = await p.evaluate(() => { const x = C.byId.get(UI.planSel), s = x.m.plan.steps.find(s => s.name === 'Wochenschritt'), r = x.pc.map.get(s.id); return [ds(r.start), ds(r.end), s.wer]; });
  ok(pre[1] && (Math.round((Date.parse(pre[1]) - Date.parse(pre[0])) / 864e5) === 7) && post[1] === '2027-05-17' && nsr[0] === '2027-05-10' && nsr[1] === '2027-05-17' && nsr[2] === 'Eva',
    'Neuer Schritt: Vorbelegung ' + pre.join('/') + ', Beginn geändert → ' + post.join('–') + ', angelegt ' + nsr.join(' '));
  // Schritt ohne Termin: nur Ende setzen → eine Woche
  const und = await p.evaluate(() => { const x = C.ms.find(x => x.m.plan && x.m.plan.steps.some(s => s.typ === 'aufgabe' && x.pc.map.get(s.id).start == null)); UI.planSel = x.id; renderNow(); return x.m.plan.steps.find(s => s.typ === 'aufgabe' && x.pc.map.get(s.id).start == null).id; });
  await p.waitForTimeout(150);
  const ue = p.locator(`[data-fk="st:${und}:end"]`);
  await ue.fill('2027-10-20'); await ue.press('Enter'); await p.waitForTimeout(200);
  const ur = await p.evaluate(id => { const r = C.byId.get(UI.planSel).pc.map.get(id); return [ds(r.start), ds(r.end)]; }, und);
  const udur = await p.evaluate(id => C.byId.get(UI.planSel).m.plan.steps.find(s => s.id === id).dauer, und);
  ok(ur[1] === '2027-10-20' && Math.round((Date.parse(ur[1]) - Date.parse(ur[0])) / 864e5) === (udur || 7), 'Schritt ohne Termin, nur Ende gesetzt: ' + ur.join('–') + ' (Dauer ' + udur + ')');
  // Vorlage „Bereiche“ mit S und I
  const lp = await p.evaluate(() => C.ms.find(x => !x.m.plan && x.pal != null).id);
  await p.evaluate(id => { createPlan(id); }, lp); await p.waitForTimeout(150);
  const md = await p.$$('.modal input[type=date]');
  const palv = await md[0].inputValue();
  const tS = await p.evaluate(v => ds(dn(v) - 60), palv), tI = await p.evaluate(v => ds(dn(v) - 40), palv);
  await md[1].fill(tS); await md[1].dispatchEvent('input'); await md[2].fill(tI); await md[2].dispatchEvent('input');
  await p.click('.modal .tpl-simple'); await p.waitForTimeout(250);
  const lpr = await p.evaluate(id => { const x = C.byId.get(id); return [ds(x.s), ds(x.i), x.m.plan.steps.length, x.m.plan.steps.map(s => s.name).join(',')]; }, lp);
  ok(lpr[0] === tS && lpr[1] === tI, 'Vorlage Bereiche übernimmt S/I: ' + JSON.stringify(lpr));
  await p.screenshot({ path: 'r7_plan_leer.png', clip: { x: 0, y: 0, width: 1600, height: 460 } });

  // ---------- Urlaub & Feiertage
  await p.click('nav.tabs >> text=Urlaub'); await p.waitForTimeout(200);
  ok(!(await p.evaluate(() => !!document.querySelector('.persons'))), 'Personen nicht mehr im Urlaubsbereich');
  const fr = await p.evaluate(() => { const n = [...holidaysNRW(2027)].find(([, t]) => t === 'Fronleichnam')[0]; return ds(n); });
  const nin = p.locator(`[data-fk="hol:${fr}:n"]`);
  await nin.fill('Fronleichnam (geändert)'); await nin.press('Tab'); await p.waitForTimeout(150);
  const din = p.locator(`[data-fk="hol:${fr}:d"]`);
  await din.fill('2027-05-28'); await din.press('Enter'); await p.waitForTimeout(150);
  const allh = await p.evaluate(() => ds([...holidaysNRW(2027)].find(([, t]) => t === 'Allerheiligen')[0]));
  await p.evaluate(a => { const td = document.querySelector(`[data-fk="hol:${a}:n"]`).closest('td'); td.previousElementSibling.previousElementSibling.querySelector('input[type=checkbox]').click(); }, allh); await p.waitForTimeout(150);
  const hr = await p.evaluate(([fr, a]) => [holName(dn(fr)), holName(mkdn(2027, 5, 28)), holName(dn(a)), JSON.stringify(D.feiertage)], [fr, allh]);
  ok(hr[0] == null && hr[1] === 'Fronleichnam (geändert)' && hr[2] == null, 'Feiertage bearbeitet: ' + JSON.stringify(hr));
  await p.screenshot({ path: 'r7_urlaub.png', fullPage: true });
  await p.evaluate(() => { undo(); undo(); undo(); });

  // ---------- Einstellungen
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.waitForTimeout(80);
  await p.click('.menu button:has-text("Einstellungen")'); await p.waitForTimeout(150);
  const st = await p.evaluate(() => document.querySelector('.modal').textContent);
  ok(!/Vorlauf|Max\. Starts/.test(st) && st.includes('Programmversion ' + T.VERSION) && /Datenstand Nr\./.test(st) && /Personen/.test(st), 'Einstellungen: ' + (st.match(/Programmversion[^·]*·[^D]*/) || [''])[0] + ' | ' + (st.match(/Datenstand[^W]*/) || [''])[0]);
  await p.click('.modal button:has-text("Was ist neu")'); await p.waitForTimeout(100);
  const cl = await p.evaluate(() => document.querySelectorAll('.changelog .cl-v').length);
  ok(cl === T.CHANGELOG_N, 'Änderungsliste mit ' + cl + ' Versionen');
  // Person umbenennen und anlegen
  const pin = p.locator('.modal .ptable input[aria-label="Name"]').nth(1);
  const oldName = await pin.inputValue();
  await pin.fill('Eva M.'); await pin.press('Tab'); await p.waitForTimeout(150);
  await p.fill('.modal input[placeholder="neue Person"]', 'Kati'); await p.click('.modal button:has-text("Person hinzufügen")'); await p.waitForTimeout(150);
  const pr = await p.evaluate(() => [D.personen.map(q => q.name).join(','), D.massnahmen.some(m => (m.plan?.steps || []).some(s => s.wer === 'Eva M.'))]);
  ok(pr[0].includes('Eva M.') && pr[0].includes('Kati') && pr[1], 'Personen: ' + oldName + ' → Eva M. (überall), neu: Kati · ' + pr[0]);
  await p.screenshot({ path: 'r7_settings.png' });
  // Darkmode
  await p.click('.modal .theme-pick label:has-text("Dunkel") input'); await p.waitForTimeout(150);
  const dm = await p.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('.modal')).backgroundColor]);
  ok(dm[0] === 'dark' && dm[1] !== 'rgb(247, 247, 245)', 'Darkmode aktiv ' + JSON.stringify(dm));
  await p.screenshot({ path: 'r7_dark_settings.png' });
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  for (const [tab, name] of [['Jahresplanung', 'jahr'], ['Zeitleiste', 'zeit'], ['Detailpläne', 'plan'], ['Urlaub', 'urlaub']]) {
    await p.click('nav.tabs >> text=' + tab); await p.waitForTimeout(200);
    await p.screenshot({ path: 'r7_dark_' + name + '.png' });
  }
  await p.click('nav.tabs >> text=Jahresplanung'); await p.waitForTimeout(150);
  await p.evaluate(() => { const s = document.querySelector('.sec[data-sec="kal"]'); document.querySelector('#main').scrollTop = s.offsetTop - 40; });
  await p.screenshot({ path: 'r7_dark_kal.png' });

  // ---------- PDF-Dialog (im Darkmode – PDF muss trotzdem hell sein)
  await p.click('nav.tabs >> text=Detailpläne'); await p.waitForTimeout(150);
  await p.keyboard.press('Control+p'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => /PDF exportieren/.test(document.querySelector('.modal h2').textContent)), 'Strg+P öffnet PDF-Dialog');
  await p.screenshot({ path: 'r7_pdf_dialog.png' });
  await p.click('.modal button:has-text("Wie aktuelle Ansicht")'); await p.waitForTimeout(100);
  const pv = await p.evaluate(() => [[...document.querySelectorAll('.modal .checks')[0].querySelectorAll('input')].map(i => i.checked ? 1 : 0).join(''), $$('.modal .mspick input:checked').length]);
  ok(pv[0] === '000010' && pv[1] === 1, 'Wie aktuelle Ansicht (Detailpläne): ' + JSON.stringify(pv));
  // alle Bereiche, alle Maßnahmen
  await p.evaluate(() => { $$('.modal .checks')[0].querySelectorAll('input').forEach(i => { if (!i.checked) i.click(); }); });
  await p.click('.modal .mspick button:has-text("alle")');
  await p.evaluate(() => { window.print = () => { window._printed = true; }; });
  await p.click('.modal button:has-text("PDF erstellen")'); await p.waitForTimeout(400);
  const pages = await p.evaluate(() => [$$('#printdoc .pd-page').length, window._printed, document.title]);
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: 'r7_export.pdf', preferCSSPageSize: true, printBackground: true });
  await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  ok(pages[0] === 8 && pages[1], 'PDF: ' + pages[0] + ' Bereiche/Seiten gebaut, Titel „' + pages[2] + '“');
  await p.evaluate(() => setTheme('light'));

  // ---------- Outlook-Export
  await p.click('header button:has-text("Export")'); await p.click('.menu button:has-text("Outlook")'); await p.waitForTimeout(150);
  await p.click('.modal button:has-text("nur Start Selektion")'); await p.waitForTimeout(100);
  const cnt = await p.evaluate(() => document.querySelector('.modal .calcline').textContent);
  await p.screenshot({ path: 'r7_ics_dialog.png' });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.modal button:has-text("Kalenderdatei erstellen")')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8');
  const ev = ics.split('BEGIN:VEVENT').length - 1, allDay = (ics.match(/DTSTART;VALUE=DATE:/g) || []).length, sum = [...ics.matchAll(/SUMMARY:(.*)/g)].map(m => m[1].split(' · ')[0]);
  ok(ev > 0 && ev === allDay && sum.every(s => s === 'Start Selektion'), 'ICS ' + dl.suggestedFilename() + ': ' + ev + ' Termine, ganztags ' + allDay + ', nur S: ' + [...new Set(sum)].join(',') + ' (' + cnt + ')');
  await p.click('header button:has-text("Export")'); await p.click('.menu button:has-text("Outlook")'); await p.waitForTimeout(150);
  await p.click('.modal button:has-text("alles aus den Maßnahmen")');
  await p.click('.modal label:has-text("je Maßnahme") input');
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('.modal button:has-text("Kalenderdatei erstellen")')]);
  const zb = fs.readFileSync(await dl2.path());
  const names = []; for (let i = 0; i < zb.length - 4; i++) if (zb.readUInt32LE(i) === 0x04034b50) { const nl = zb.readUInt16LE(i + 26); names.push(zb.slice(i + 30, i + 30 + nl).toString()); }
  ok(dl2.suggestedFilename().endsWith('.zip') && names.length >= 5, 'ZIP je Maßnahme: ' + names.length + ' Dateien, z. B. ' + names.slice(0, 2).join(', '));

  // ---------- Programm-Update ohne Datenverlust
  const orig = fs.readFileSync(HTML, 'utf8');
  await p.evaluate(t => { __fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'] = { data: new TextEncoder().encode(t), lm: 1000 }; }, orig);
  await p.evaluate(() => commit(d => { d.massnahmen[0].hinweis = 'MEINE DATEN'; }));
  await p.click('#savebox'); await p.waitForTimeout(200); await p.click('.modal footer button.primary'); await p.waitForTimeout(800);
  const newer = orig.replace('const APP_INFO = {"version": "' + T.VERSION + '"', 'const APP_INFO = {"version": "' + T.NEWER + '"').replace('Programm-Update einspielen', 'Programm-Update einspielen');
  fs.writeFileSync('update_test.html', newer.replace('<title>Jahresplanung Außenkommunikation</title>', '<title>Jahresplanung Außenkommunikation</title>'));
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Programm-Update")'); await p.waitForTimeout(100);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.modal footer button.primary')]);
  await fc.setFiles('update_test.html'); await p.waitForTimeout(300);
  const q = await p.evaluate(() => document.querySelector('.modal') ? document.querySelector('.modal').innerText.replace(/\n/g, ' / ') : '');
  const [bk] = await Promise.all([p.waitForEvent('download'), p.click('.modal footer button.primary')]);
  await p.waitForTimeout(600);
  const saved = await p.evaluate(() => new TextDecoder().decode(__fs.files['/Mailing/Jahresplanung_Aussenkommunikation.html'].data));
  ok(saved.includes('"version": "' + T.NEWER + '"') && saved.includes('MEINE DATEN'), 'Update: neue Version 0.5 mit eigenen Daten gespeichert, Sicherung ' + bk.suggestedFilename() + ' · Rückfrage: ' + q.slice(0, 120));

  console.log('ERR', errs.join(' | ') || 'keine'); await b.close();
})();
