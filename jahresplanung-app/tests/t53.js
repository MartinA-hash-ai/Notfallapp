// 0.14: Einstellungen als eigene Seite (Rubriken links, Urlaub & Feiertage darin), Vorlagen für Detailpläne
// (Blanko, eigene Vorlagen anlegen/bearbeiten/kopieren/löschen, „Als Vorlage speichern“, Plan aus Vorlage)
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1700 }); pages.push(p);
  await p.evaluate(() => { UI.year = 2027; UI.view = 'plaene'; renderNow(); }); await p.waitForTimeout(200);

  // ---- A: ⋯ → Einstellungen öffnet die Seite mit Rubriken
  await p.click('header .actions .menu-btn:has-text("⋯")'); await p.click('.menu button:has-text("Einstellungen")'); await p.waitForTimeout(250);
  const a0 = await p.evaluate(() => [UI.view, !document.querySelector('.modal'), [...document.querySelectorAll('.sett-tab')].map(t => t.textContent).join(' | '), document.querySelector('#main h1').textContent]);
  ok(a0[0] === 'einstellungen' && a0[1] && a0[2] === 'Allgemein | Bereiche & Personen | Urlaub & Feiertage | Vorlagen für Detailpläne | Version' && a0[3] === 'Einstellungen', 'A: Einstellungen als Seite – ' + a0[2]);
  await p.click('.sett-tab[data-tab="urlaub"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !!document.querySelector('.sett-body .umatrix') && !!document.querySelector('.sett-body .hcard .fer-add') && !document.querySelector('.sett-body .backbtn')), 'A: „Urlaub & Feiertage“ steht in den Einstellungen (Übersicht, Feiertage, Ferienzeiten)');
  await p.click('.view-head .backbtn'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => UI.view === 'plaene'), 'A: „← zurück“ führt zur vorherigen Ansicht');

  // ---- B: Vorlage „Mailing (komplex)“ ist da (beim ersten Laden aus der eingebauten Vorlage), ändert sich beim erneuten Laden nicht
  const b0 = await p.evaluate(() => { const v = D.vorlagen; const n2 = normalize(JSON.parse(JSON.stringify(D))).vorlagen;
    const old = JSON.parse(document.getElementById('jp-data').textContent), noTpl = normalize(Object.assign(JSON.parse(JSON.stringify(old)), { vorlagen: [] })).vorlagen;
    return [v.map(q => q.id + ':' + q.name).join(), v[0].plan.wt, v[0].plan.steps.some(s => s.pal), v[0].plan.steps.every(s => !s.wer), JSON.stringify(n2) === JSON.stringify(v), noTpl.length, 'vorlagen' in old]; });
  ok(b0[0] === 'tpl-mailing:Mailing (komplex)' && b0[1] && b0[2] && b0[3] && b0[4], 'B: Vorlage „Mailing (komplex)“ – Werktage, mit PAL-Zeile, ohne Personen, stabil beim Laden');
  ok(b0[5] === 0 && !b0[6], 'B: alle Vorlagen gelöscht bleibt leer (die eingebaute kommt nur bei Daten ohne Vorlagen)');

  // ---- C: neue Vorlage anlegen und bearbeiten (z. B. Presse ohne Selektion)
  await p.evaluate(() => openSettings('vorlagen')); await p.waitForTimeout(200);
  const c0 = await p.evaluate(() => [...document.querySelectorAll('.tpltable tr')].map(r => r.querySelector('.tpl-n input').value + ' – ' + r.children[1].textContent).join(' / '));
  ok(/^Mailing \(komplex\) – 30 Schritte in 6 Abschnitten: Selektion, Inhalt/.test(c0), 'C: Liste – ' + c0);
  await p.click('.tpl-new'); await p.waitForTimeout(250);
  const tid = await p.evaluate(() => UI.tplSel);
  const c1 = await p.evaluate(() => [document.activeElement && document.activeElement.classList.contains('tpl-name'), document.querySelector('.phead .tpl-name').value, /Beispiel-PAL/.test(document.querySelector('.phead').textContent), !document.querySelector('.phead button.danger'),
    [...document.querySelectorAll('.pl-row.grp .gname input')].map(i => i.value).join(','), document.querySelectorAll('.pl-row.palrow').length]);
  ok(c1[0] && c1[1] === 'Neue Vorlage' && c1[2] && c1[3] && c1[4] === 'Arbeitsschritte' && c1[5] === 1, 'C: „+ Neue Vorlage“ öffnet den Editor: Name markiert, Beispiel-PAL, ein Abschnitt, PAL-Zeile');
  await p.fill('.phead .tpl-name', 'Presse & ÖA'); await p.press('.phead .tpl-name', 'Enter'); await p.waitForTimeout(150);
  await p.evaluate(id => { const g = D.vorlagen.find(v => v.id === id).plan.steps.find(s => s.typ === 'gruppe').id;
    commit(d => { findM(d, id).plan.steps.find(s => s.id === g).name = 'Pressemitteilung'; }); addStep(id, g); addStep(id, g); addGroup(id); }, tid); await p.waitForTimeout(200);
  const c2 = await p.evaluate(id => { const v = D.vorlagen.find(q => q.id === id), x = C.byId.get(id); return [v.name, v.plan.steps.map(s => s.typ === 'gruppe' ? '#' + s.name : s.name).join(','), x.tpl, C.ms.some(q => q.id === id), document.querySelectorAll('.pl-gantt .g-bar').length]; }, tid);
  ok(c2[0] === 'Presse & ÖA' && /^#Pressemitteilung,Neue Aufgabe,Neue Aufgabe,Briefkasten-Termin,#Neuer Abschnitt$/.test(c2[1]) && c2[2] && !c2[3] && c2[4] >= 2, 'C: Vorlage bearbeitet wie ein Detailplan (' + c2[1] + ') – nicht in Jahresplanung/Listen');
  // verknüpfen und verschieben geht auch in der Vorlage
  await p.evaluate(id => { const st = D.vorlagen.find(v => v.id === id).plan.steps.filter(s => s.typ === 'aufgabe'); linkSteps(id, st[0].id, st[1].id); }, tid); await p.waitForTimeout(250);
  const c3 = await p.evaluate(id => { const x = C.byId.get(id), st = x.m.plan.steps.filter(s => s.typ === 'aufgabe'); return [x.pc.map.get(st[1].id).start === x.pc.map.get(st[0].id).end, document.querySelectorAll('.pl-gantt svg.g-links .lnk').length]; }, tid);
  ok(c3[0] && c3[1] === 1, 'C: Verknüpfung in der Vorlage – dasselbe Datum, Gelenk im Gantt ' + JSON.stringify(c3));
  await p.click('.tpl-back'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => [...document.querySelectorAll('.tpltable .tpl-n input')].map(i => i.value).join(',')) === 'Mailing (komplex),Presse & ÖA', 'C: „← alle Vorlagen“ – beide in der Liste');

  // ---- D: Plan anlegen: Blanko, eigene Vorlage
  await p.evaluate(() => { UI.view = 'plaene'; renderNow(); }); await p.waitForTimeout(150);
  const [m1, m2] = await p.evaluate(() => { const c = C.ms.filter(x => !x.m.plan && x.pal != null && ymd(x.pal)[0] === 2027); return [c[0].id, c[1].id]; });
  await p.evaluate(id => { createPlan(id); }, m1); await p.waitForTimeout(200);
  const d0 = await p.evaluate(() => [...document.querySelectorAll('.modal .np-big b')].map(e => e.textContent).join(' | '));
  ok(d0 === 'Blanko | Einfach | Mailing (komplex) | Presse & ÖA', 'D: Auswahl beim Anlegen – ' + d0);
  await p.click('.modal .tpl-blank'); await p.waitForTimeout(250);
  const d1 = await p.evaluate(id => C.byId.get(id).m.plan.steps.map(s => s.typ === 'gruppe' ? '#' + s.name : s.name + (s.pal ? '(PAL)' : '')).join(','), m1);
  ok(d1 === '#Arbeitsschritte,Briefkasten-Termin(PAL)', 'D: Blanko – nur ein leerer Abschnitt und der PAL (' + d1 + ')');
  await p.evaluate(id => { createPlan(id); }, m2); await p.waitForTimeout(200);
  await p.click('.modal .tpl-own:has-text("Presse & ÖA")'); await p.waitForTimeout(250);
  const d2 = await p.evaluate(([id, tid]) => { const x = C.byId.get(id), st = x.m.plan.steps, v = D.vorlagen.find(q => q.id === tid), a = st.filter(s => s.typ === 'aufgabe');
    return [st.map(s => s.typ === 'gruppe' ? '#' + s.name : s.name).join(','), x.pc.map.get(st.find(s => s.pal).id).end === x.pal, x.pc.map.get(a[1].id).start === x.pc.map.get(a[0].id).end,
      v.plan.steps.length, x.pal - x.pc.map.get(a[0].id).end === dn(v.pal) - planCalc(v).map.get(v.plan.steps.filter(s => s.typ === 'aufgabe')[0].id).end]; }, [m2, tid]);
  ok(d2[0] === '#Pressemitteilung,Neue Aufgabe,Neue Aufgabe,Briefkasten-Termin,#Neuer Abschnitt' && d2[1] && d2[2] && d2[4], 'D: Plan aus eigener Vorlage – gleicher Aufbau, Termine vom echten PAL aus, Verknüpfung bleibt');
  // die Vorlage bleibt unverändert, wenn man den Plan ändert
  await p.evaluate(id => { const s = C.byId.get(id).m.plan.steps.find(q => q.typ === 'aufgabe'); commit(d => { findM(d, id).plan.steps.find(q => q.id === s.id).name = 'PM schreiben'; }); }, m2);
  ok(await p.evaluate(tid => !D.vorlagen.find(v => v.id === tid).plan.steps.some(s => s.name === 'PM schreiben'), tid), 'D: Plan ändern ändert die Vorlage nicht');

  // ---- E: „Als Vorlage speichern …“ aus einem Detailplan
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  await p.evaluate(id => { UI.planSel = id; renderNow(); }, sm); await p.waitForTimeout(200);
  await p.click('.phead .tpl-save'); await p.waitForTimeout(150);
  await p.fill('.modal .tpl-nm', 'Sommer-Ablauf'); await p.click('.modal footer button.primary'); await p.waitForTimeout(200);
  const e0 = await p.evaluate(() => { const v = D.vorlagen.find(q => q.name === 'Sommer-Ablauf'), m = C.ms.find(x => x.m.name === 'Sommermailing').m;
    return v && [v.plan.steps.length === m.plan.steps.length, v.pal === m.pal, v.plan.steps.every(s => !s.fortschritt), v.plan.steps.some(s => s.wer)]; });
  ok(e0 && e0[0] && e0[1] && e0[2] && e0[3], 'E: „Als Vorlage speichern“ – alle Schritte mit Personen, Fortschritt zurückgesetzt');

  // ---- F: Vorlage kopieren, löschen (Strg+Z), Personen umbenennen gilt auch in Vorlagen
  await p.evaluate(() => openSettings('vorlagen')); await p.waitForTimeout(200);
  await p.click('.tpltable tr[data-tpl="' + tid + '"] .tpl-dup'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => D.vorlagen.some(v => v.name === 'Presse & ÖA (Kopie)')), 'F: Vorlage kopiert');
  const cid = await p.evaluate(() => D.vorlagen.find(v => v.name === 'Presse & ÖA (Kopie)').id);
  await p.click('.tpltable tr[data-tpl="' + cid + '"] .tpl-del'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => /Bestehende Detailpläne bleiben unverändert/.test(document.querySelector('.modal').textContent)), 'F: Rückfrage beim Löschen');
  await p.click('.modal footer button.primary'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !D.vorlagen.some(v => v.name === 'Presse & ÖA (Kopie)') && D.vorlagen.length === 3), 'F: gelöscht');
  const who = await p.evaluate(() => D.vorlagen.find(q => q.name === 'Sommer-Ablauf').plan.steps.find(s => s.wer).wer);
  await p.evaluate(w => { renamePersonTo(w, w + ' Neu'); }, who); await p.waitForTimeout(100);
  ok(await p.evaluate(w => D.vorlagen.find(q => q.name === 'Sommer-Ablauf').plan.steps.some(s => s.wer === w + ' Neu') && personUsed(w + ' Neu'), who), 'F: Person umbenennen gilt auch in Vorlagen');

  // ---- G: Zusammenführen und Änderungsprotokoll kennen Vorlagen
  const g0 = await p.evaluate(() => { const base = JSON.parse(JSON.stringify(D)), mine = JSON.parse(JSON.stringify(D)), theirs = JSON.parse(JSON.stringify(D));
    mine.vorlagen.find(v => v.name === 'Presse & ÖA').name = 'Presse'; theirs.vorlagen.push(Object.assign(JSON.parse(JSON.stringify(theirs.vorlagen[0])), { id: 'tx', name: 'Spendenaufruf' }));
    const r = merge3(base, mine, theirs); return [r.conflicts.length, r.data.vorlagen.map(v => v.name).join(','), describeChanges(base, mine).join(' | ')]; });
  ok(g0[0] === 0 && /Presse,Sommer-Ablauf,Spendenaufruf|Presse/.test(g0[1]) && g0[1].includes('Spendenaufruf') && /Vorlage „Presse“/.test(g0[2]), 'G: Zusammenführen (' + g0[1] + ') · Protokoll: ' + g0[2]);
  // Seite mit gespeicherter alter Ansicht „urlaub“ öffnet die Einstellungen
  await p.evaluate(() => { UI.view = 'urlaub'; saveUI(); }); await p.reload(); await p.waitForTimeout(600);
  ok(await p.evaluate(() => UI.view === 'einstellungen' && UI.settTab === 'urlaub' && !!document.querySelector('.sett-body .umatrix')), 'G: gespeicherte Ansicht „Urlaub“ aus älteren Versionen öffnet Einstellungen → Urlaub & Feiertage');
  await finish(b, pages);
})();
