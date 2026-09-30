// 0.8 Bereiche: Umstellung alter Daten, Produktion D, Werktage-Ansicht, Urlaubshinweis je Bereich, Terminliste, Einstellungen, Vorlage
const { chromium, T, ORIG, ok, open, finish, fs } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);

  // ---- A: alte Daten (0.7) werden umgestellt, S und I bleiben datumsgleich
  const r = await p.evaluate(() => {
    const sm = C.ms.find(x => x.m.name === 'Sommermailing'), pu = C.ms.find(x => x.m.name === 'Projekt-Update 1');
    const g = sm.m.plan.steps.filter(s => s.typ === 'gruppe').map(s => s.name + (s.bereich ? ':' + s.bereich : ''));
    return [fmtS(sm.st.S), fmtS(sm.st.I), sm.st.D != null, g.slice(0, 3).join(','), fmtS(pu.st.S), fmtS(pu.st.I), JSON.stringify(pu.m.vorlauf), 'vorlaufS' in pu.m, PH().map(q => q.key).join('')];
  });
  ok(r[0] === '04.04.' && r[1] === '22.04.' && r[4] === '06.02.' && r[5] === '24.02.', 'A: S/I nach der Umstellung unverändert (Sommermailing ' + r[0] + '/' + r[1] + ', Projekt-Update 1 ' + r[4] + '/' + r[5] + ')');
  ok(r[2] && r[3] === 'Selektion:S,Inhalt:I,Produktion:D' && !r[7] && r[8] === 'SID', 'A: Abschnitte ' + r[3] + ', Bereiche ' + r[8] + ', Vorlauf ' + r[6]);

  // ---- B: Produktion D bei einer Maßnahme ohne Plan eintragen → Kalender, Zeitleiste, Tabelle
  const id = await p.evaluate(() => C.ms.find(x => x.m.name === 'Projekt-Update 1').id);
  await p.evaluate(id => { moveStartTo(id, 'D', dn('2027-04-01')); }, id); await p.waitForTimeout(150);
  const r2 = await p.evaluate(id => { const x = C.byId.get(id); return [fmtS(x.st.D), fmtS(x.en.I), !!document.querySelector('.cal .chip.D[data-m="' + id + '"]')]; }, id);
  ok(r2[0] === '01.04.' && r2[1] === '01.04.' && r2[2], 'B: Start Produktion 01.04. – Inhalt endet dort, D im Kalender');

  // ---- C: Werktage-Ansicht in der Tabelle
  await p.click('.sec[data-sec="mass"] .vswitch .vs-track'); await p.waitForTimeout(150);
  const wt = await p.evaluate(id => { const x = C.byId.get(id), i = document.querySelector('[data-fk="m:' + id + ':S:wt"]'); return [i && +i.value, workdaysBefore(x.st.S, x.pal), document.querySelector('tr[data-m="' + id + '"] td.pal input[type=date]') ? 1 : 0]; }, id);
  ok(wt[0] === wt[1] && wt[2] === 1, 'C: Start Selektion als ' + wt[0] + ' Werktage bis PAL, PAL bleibt Datum');
  const inp = p.locator(`[data-fk="m:${id}:S:wt"]`);
  await inp.fill('40'); await inp.press('Enter'); await p.waitForTimeout(200);
  const w40 = await p.evaluate(id => { const x = C.byId.get(id); return [workdaysBefore(x.st.S, x.pal), isWorkday(x.st.S)]; }, id);
  ok(w40[0] === 40 && w40[1], 'C: 40 Werktage eingetippt → Start liegt auf einem Arbeitstag mit genau 40 Werktagen bis PAL');
  await p.click('.sec[data-sec="mass"] .vswitch .vs-lab:has-text("Datum")'); await p.waitForTimeout(150);
  ok(await p.evaluate(id => !!document.querySelector('[data-fk="m:' + id + ':S"][type=date]'), id), 'C: Umschalter „Datum“ zeigt wieder Datumsfelder');

  // ---- D: Urlaubshinweis, wenn jemand aus einem Bereich des Detailplans Urlaub hat
  const vr = await p.evaluate(() => {
    const x = C.ms.find(q => q.m.name === 'Sommermailing'), sid = x.pc.ph.I.steps.find(s => x.m.plan.steps.find(q => q.id === s).typ === 'aufgabe'), r = x.pc.map.get(sid);
    commit(d => { const m = findM(d, x.id); m.plan.steps.find(q => q.id === sid).wer = 'Eva'; d.urlaube.push({ id: 'u1', wer: 'Eva', von: ds(r.start), bis: ds(r.start + 2) }); });
    renderNow();
    const td = document.querySelector('tr[data-m="' + x.id + '"] td.h-ph_I, tr[data-m="' + x.id + '"] td:nth-child(7)');
    const icon = [...document.querySelectorAll('tr[data-m="' + x.id + '"] .wi.vac')].length;
    return [icon, phaseVacations(C.byId.get(x.id), 'I').length];
  });
  ok(vr[0] >= 1 && vr[1] >= 1, 'D: 🏖-Hinweis in der Spalte Inhalt, weil Eva dort eingetragen ist und Urlaub hat');

  // ---- E: Terminliste: Symbole links, kein Datum hinter dem Namen, „Bearbeiten“ hinter allen Zeilen der festgehaltenen Maßnahme
  const tl = await p.evaluate(id => { const l = document.querySelector('.mline[data-m="' + id + '"]'); return [l.querySelectorAll('.lchips .chip').length, /\d\d\.\d\d\./.test(l.textContent), l.textContent]; }, id);
  ok(tl[0] >= 1 && !tl[1], 'E: Terminzeile „' + tl[2] + '“ mit Symbolen links, ohne Datum');
  const ch = await p.evaluate(id => { const c = document.querySelector('.cal .chip.S[data-m="' + id + '"]'); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, id);
  await p.mouse.click(ch[0], ch[1]); await p.waitForTimeout(150);
  const pin = await p.evaluate(id => [document.querySelectorAll('.mline[data-m="' + id + '"] .mline-edit').length, document.querySelectorAll('.mline[data-m="' + id + '"]').length, document.querySelectorAll('.chip-edit').length], id);
  ok(pin[0] === pin[1] && pin[0] >= 1 && pin[2] === 0, 'E: Klick auf S → „Bearbeiten“ hinter allen ' + pin[1] + ' Zeilen der Maßnahme, nicht unter der Markierung');
  await p.keyboard.press('Escape');

  // ---- F: Einstellungen – neuen Bereich V anlegen, er erscheint überall; entfernen räumt auf
  await p.evaluate(() => { settingsDialog(); }); await p.waitForTimeout(200);
  await p.fill('.modal input[placeholder="Buchstabe"]', 'v'); await p.fill('.modal input[placeholder^="Name"]', 'Versand');
  await p.click('.modal button:has-text("+ Bereich hinzufügen")'); await p.waitForTimeout(150);
  await p.click('.modal footer button:has-text("Schließen")'); await p.waitForTimeout(150);
  const f1 = await p.evaluate(() => [PH().map(q => q.key).join(''), !!document.querySelector('.mtable th.h-ph_V'), [...document.querySelectorAll('.sec[data-sec="kal"] .tpill')].map(b => b.textContent).join(',')]);
  ok(f1[0] === 'SIDV' && f1[1] && /Versand/.test(f1[2]), 'F: Bereich V Versand angelegt – Spalte und Kalender-Knopf da (' + f1[2] + ')');
  await p.evaluate(() => { settingsDialog(); }); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.modal .btable tr[data-key="V"] button[aria-label="entfernen"]').click()); await p.waitForTimeout(150);
  await p.click('.modal:has-text("Bereich entfernen") footer button.primary'); await p.waitForTimeout(150);
  await p.click('.modal footer button:has-text("Schließen")'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => PH().map(q => q.key).join('')) === 'SID', 'F: Bereich wieder entfernt');

  // ---- G: Detailplan-Vorlage „Bereiche“ und Bereich am Abschnitt ändern
  const lp = await p.evaluate(() => C.ms.find(x => !x.m.plan && x.pal != null && x.m.name !== 'Projekt-Update 1').id);
  await p.evaluate(id => { createPlan(id); }, lp); await p.waitForTimeout(150);
  await p.click('.modal .tpl-simple'); await p.waitForTimeout(250);
  const g = await p.evaluate(id => { const x = C.byId.get(id); return [x.m.plan.steps.filter(s => s.typ === 'gruppe').map(s => s.bereich).join(''), ['S', 'I', 'D'].every(k => x.st[k] != null), x.m.plan.steps.some(s => s.typ === 'ziel')]; }, lp);
  ok(g[0] === 'SID' && g[1] && g[2], 'G: Vorlage Bereiche: Abschnitte ' + g[0] + ' mit Starts, Briefkasten-Termin als Ziel');
  const gid = await p.evaluate(id => C.byId.get(id).m.plan.steps.find(s => s.bereich === 'D').id, lp);
  await p.selectOption(`[data-fk="st:${gid}:ber"]`, ''); await p.waitForTimeout(150);
  ok(await p.evaluate(id => C.byId.get(id).st.D == null, lp), 'G: Abschnitt ohne Bereich → kein Start Produktion mehr');

  // ---- H: ICS-Export mit Produktion
  await p.evaluate(() => { UI.view = 'jahr'; renderNow(); });
  const ics = await p.evaluate(() => icsItems({ kinds: { D: true }, ms: new Set(C.ms.map(x => x.id)), from: mkdn(2027, 1, 1), to: mkdn(2027, 12, 31), person: '' }).map(e => e.summary));
  ok(ics.length >= 2 && ics.every(s => /^Start Produktion · /.test(s)), 'H: Outlook-Export „Start Produktion“: ' + ics.length + ' Termine');
  await finish(b, pages);
})();
