const { chromium } = require('./pw');
const T = require('./common');
const URL = T.URL;
const ok = (c, m) => console.log((c ? 'OK   ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE' });
  await ctx.addInitScript({ path: T.FAKEFS });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.dismiss());
  await p.goto(URL); await p.waitForTimeout(400);
  await p.evaluate(() => { try { localStorage.setItem('jp-savehint', '1'); } catch (e) {} });

  // ---------- Allgemein: Logo
  const logo = await p.evaluate(() => { const i = document.querySelector('.brand .logo'); if (!i) return null; const r = i.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), i.complete && i.naturalWidth > 0]; });
  ok(logo && logo[1] >= 30 && logo[1] <= 40 && logo[2], 'Logo oben links ' + JSON.stringify(logo));
  await p.screenshot({ path: 'r6_head.png', clip: { x: 0, y: 0, width: 1600, height: 70 } });

  // ---------- Jahresplanung: Tabelle
  const heads = await p.evaluate(() => [...document.querySelectorAll('.mtable thead th')].map(t => t.textContent.trim()));
  ok(heads.includes('Hauptverantwortlich') && !heads.some(t => /Vorlauf/.test(t)), 'Spalten: ' + heads.filter(Boolean).join(' | '));
  const chipHeads = await p.evaluate(() => [...document.querySelectorAll('.mtable thead th .chip')].map(c => c.textContent));
  ok(chipHeads.join('') === 'SIDP', 'S/I/D/P-Kästchen in Spaltenköpfen ' + chipHeads.join(''));
  // Spaltenbreite ziehen
  const rs = await p.evaluate(() => { const th = [...document.querySelectorAll('.mtable thead th')].find(t => t.textContent.trim() === 'Maßnahme'); const g = th.querySelector('.col-rs').getBoundingClientRect(); return [g.x + g.width / 2, g.y + g.height / 2, th.getBoundingClientRect().width]; });
  await p.mouse.move(rs[0], rs[1]); await p.mouse.down(); await p.mouse.move(rs[0] + 80, rs[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
  const w2 = await p.evaluate(() => [...document.querySelectorAll('.mtable thead th')].find(t => t.textContent.trim() === 'Maßnahme').getBoundingClientRect().width);
  ok(Math.abs(w2 - rs[2] - 80) < 4, 'Spaltenbreite ' + Math.round(rs[2]) + ' → ' + Math.round(w2));
  await p.evaluate(() => { UI.colW = {}; saveUI(); renderNow(); });
  // Startdatum ändern (ohne Plan)
  const noPlan = await p.evaluate(() => { const x = C.ms.find(x => !x.m.plan && x.pal != null); return x && [x.id, x.m.name, ds(x.s)]; });
  if (noPlan) {
    const inp = p.locator(`[data-fk="m:${noPlan[0]}:S"]`);
    if (await inp.count()) {
      await inp.fill('2027-01-04'); await inp.press('Enter'); await p.waitForTimeout(200);
      const s = await p.evaluate(id => ds(C.byId.get(id).s), noPlan[0]);
      ok(s === '2027-01-04', 'Start Selektion als Datum gesetzt ' + noPlan[2] + ' → ' + s);
      await p.evaluate(() => undo());
    } else ok(false, 'kein Datumsfeld m:<id>:s gefunden');
  }
  // Urlaub-Knopf toggelt
  const vp = await p.evaluate(() => { const b = document.querySelector('.sec[data-sec="kal"] .vacpill, .sec[data-sec="kal"] [data-pill="vac"]') || [...document.querySelectorAll('.sec[data-sec="kal"] button')].find(b => /Urlaub/.test(b.textContent)); if (!b) return null; const a = UI.showVac; b.click(); const c = UI.showVac; return [a, c]; });
  ok(vp && vp[0] !== vp[1], 'Urlaub-Knopf schaltet ' + JSON.stringify(vp));
  await p.evaluate(() => { UI.showVac = true; UI.hiddenP = new Set(); renderNow(); });
  // Hover-Linie
  const mid = await p.evaluate(() => C.ms.find(x => x.s != null && x.pal != null && ymd(x.s)[1] === ymd(x.pal)[1]) || C.ms.find(x => x.s != null && x.pal != null));
  await p.evaluate(() => { const x = C.ms.find(x => x.s != null && x.pal != null); highlight(x.id); });
  const spans = await p.evaluate(() => document.querySelectorAll('.day.span').length);
  ok(spans > 5, 'Verbindungslinie beim Überfahren: ' + spans + ' Tage markiert');
  await p.evaluate(() => { const d = document.querySelector('.day.span'); d.scrollIntoView({ block: 'center' }); });
  await p.screenshot({ path: 'r6_hoverline.png' });
  await p.evaluate(() => highlight(null));
  // Kalender-Tooltip
  await p.evaluate(() => document.querySelector('.cal .chip.P').scrollIntoView({ block: 'center' })); await p.waitForTimeout(250);   // Scroll-Ereignis abwarten (es schließt Tooltips)
  const tipTxt = await p.evaluate(() => { const r = document.querySelector('.cal .chip.P').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.mouse.move(tipTxt[0], tipTxt[1]); await p.waitForTimeout(500);
  const tip = await p.evaluate(() => { const t = document.querySelector('#tip'); return t && t.classList.contains('on') ? t.innerText : ''; });
  ok(tip && !/Vorlauf|Verantwortlich|Status/.test(tip), 'Kalender-Tooltip: ' + tip.replace(/\n/g, ' / '));
  await p.mouse.move(5, 500);

  // ---------- Zeitleiste
  await p.evaluate(() => { UI.view = 'jahr'; UI.secOpen.tl = true; renderNow(); document.querySelector('[data-sec="tl"]').scrollIntoView(); }); await p.waitForTimeout(200);
  ok(!(await p.evaluate(() => /Starts je Woche/.test(document.body.innerText))), '„Starts je Woche“ entfernt');
  const cur = await p.evaluate(() => getComputedStyle(document.querySelector('.tl-lab.clickable')).cursor);
  ok(cur === 'pointer', 'Zeiger über Maßnahmen-Namen: ' + cur);
  // Tagesmitte
  const cen = await p.evaluate(() => { const x = C.ms.find(x => x.pal != null && x.s != null); const hs = document.querySelector('.tl-row[data-m="' + x.id + '"] .handle.S, [data-m="' + x.id + '"] .handle'); const tl = UI._tl; if (!hs || !tl) return null; const rr = hs.getBoundingClientRect(), box = document.querySelector('.tl-track, .tl-row [class*=track]') ; return [rr.x + rr.width / 2, tl.pxd]; });
  ok(cen, 'Griffe vorhanden (Tagesmitte optisch prüfen) ' + JSON.stringify(cen));
  const px0 = await p.evaluate(() => UI._tl.pxd);
  const tlb = await p.evaluate(() => { const r = document.querySelector('.tl').getBoundingClientRect(); return [r.x + r.width * 0.6, r.y + 120]; });
  await p.mouse.move(tlb[0], tlb[1]);
  await p.mouse.wheel(0, -300); await p.waitForTimeout(250); await p.mouse.wheel(0, -300); await p.waitForTimeout(250);
  const px1 = await p.evaluate(() => UI._tl.pxd);
  ok(px1 > px0 * 1.2, 'Mausrad zoomt Zeitleiste ' + px0.toFixed(2) + ' → ' + px1.toFixed(2));
  await p.mouse.wheel(0, 600); await p.waitForTimeout(250);
  // Klick auf Namen
  await p.evaluate(() => { UI.tlPxd = 0; renderNow(); });
  const lab = await p.evaluate(() => { const l = [...document.querySelectorAll('.tl-lab.clickable')][1]; l.click(); return l.textContent.trim(); });
  await p.waitForTimeout(300);
  const vis = await p.evaluate(() => { const tl = document.querySelector('.tl'); const r = tl.getBoundingClientRect(); const id = [...document.querySelectorAll('.tl-lab.clickable')][1].closest('[data-m]')?.dataset.m; const x = C.byId.get(id); const a = Math.min(x.s ?? x.pal, x.i ?? x.pal), e = x.pal; const X = n => (n - UI._tl.x0) * UI._tl.pxd + UI._tl.label - tl.scrollLeft; return [UI._tl.pxd.toFixed(1), Math.round(X(a)), Math.round(X(e)), Math.round(tl.clientWidth)]; });
  ok(+vis[0] > px0 && vis[1] >= 0 && vis[2] <= vis[3], 'Klick auf „' + lab.slice(0, 30) + '“ zoomt auf Maßnahme ' + JSON.stringify(vis));
  await p.screenshot({ path: 'r6_zeit_zoom.png' });
  await p.evaluate(() => { UI.tlPxd = 0; renderNow(); });

  // ---------- Detailpläne
  await p.click('nav.tabs >> text=Detailpläne'); await p.waitForTimeout(250);
  await p.screenshot({ path: 'r6_plan.png', fullPage: false });
  const hdr = await p.evaluate(() => [...document.querySelectorAll('.pl-row.head > div')].map(d => d.textContent.trim()).filter(Boolean));
  ok(!hdr.some(t => /%|Versatz|endet|Bezug/.test(t)), 'Plan-Spalten: ' + hdr.join(' | '));
  ok(!(await p.evaluate(() => /Beginn von/.test(document.querySelector('.phead').innerText))), 'Kopf ohne „Beginn von“');
  // Personenfarben
  await p.evaluate(() => commit(d => { const m = d.massnahmen.find(q => q.id === UI.planSel); const t = m.plan.steps.filter(s => s.typ === 'aufgabe'); t[0].wer = 'Eva'; t[1].wer = 'Martin'; t[2].wer = 'Eva'; }));
  await p.waitForTimeout(150);
  await p.screenshot({ path: 'r6_plan_farben.png' });
  const cols = await p.evaluate(() => { const o = {}; const x = C.byId.get(UI.planSel); x.m.plan.steps.forEach(s => { if (s.typ === 'aufgabe') o[s.wer || '-'] = 1; }); return [Object.keys(o), [...new Set([...document.querySelectorAll('.g-bar')].map(b => b.style.borderColor))].length]; });
  ok(cols[1] >= Math.min(2, cols[0].length), 'Balkenfarben je Person: ' + cols[0].join(',') + ' → ' + cols[1] + ' Farben');
  await p.evaluate(() => undo()); await p.waitForTimeout(100);
  // Einklappen
  const nRows0 = await p.evaluate(() => document.querySelectorAll('.pl-table .pl-row[data-rid]').length);
  await p.click('.pl-row.grp .gtog >> nth=0'); await p.waitForTimeout(150);
  const nRows1 = await p.evaluate(() => document.querySelectorAll('.pl-table .pl-row[data-rid]').length);
  const gRows = await p.evaluate(() => [document.querySelectorAll('.pl-table > .pl-row:not(.head)').length - 1, document.querySelectorAll('.g-body > .g-row').length]);
  ok(nRows1 < nRows0 && gRows[0] === gRows[1], 'Abschnitt eingeklappt ' + nRows0 + ' → ' + nRows1 + ' Zeilen, Tabelle/Gantt ' + gRows.join('/'));
  await p.click('.pl-row.grp .gtog >> nth=0'); await p.waitForTimeout(150);
  // Zeilen ausgerichtet?
  const align = await p.evaluate(() => { const t = [...document.querySelectorAll('.pl-table > .pl-row:not(.head)')].slice(0, -1).map(r => Math.round(r.getBoundingClientRect().top)); const g = [...document.querySelectorAll('.g-body > .g-row')].map(r => Math.round(r.getBoundingClientRect().top)); return t.every((v, i) => Math.abs(v - g[i]) <= 1) && t.length === g.length; });
  ok(align, 'Tabelle und Gantt zeilengenau');
  // Ziehen zum Sortieren
  const ord0 = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.map(s => s.name));
  const grips = await p.evaluate(() => { const rows = [...document.querySelectorAll('.pl-table .pl-row[data-rid]:not(.grp)')]; const a = rows[0].querySelector('.rgrip').getBoundingClientRect(), c = rows[2].getBoundingClientRect(); return [a.x + a.width / 2, a.y + a.height / 2, c.y + c.height * 0.75, rows[0].dataset.rid]; });
  await p.mouse.move(grips[0], grips[1]); await p.mouse.down(); await p.mouse.move(grips[0], grips[2], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
  const ord1 = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.map(s => s.name));
  const i0 = ord0.indexOf(ord1.find((n, i) => n !== ord0[i]));
  ok(JSON.stringify(ord0) !== JSON.stringify(ord1), 'Zeile gezogen: „' + ord0[ord0.findIndex((n, i) => n !== ord1[i])] + '“ verschoben');
  await p.evaluate(() => undo()); await p.waitForTimeout(100);
  // Abschnitt als Block ziehen
  const g0 = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.filter(s => s.typ === 'gruppe').map(s => s.name));
  const gg = await p.evaluate(() => { const rows = [...document.querySelectorAll('.pl-table .pl-row.grp')]; const a = rows[0].querySelector('.rgrip').getBoundingClientRect(), c = rows[1].getBoundingClientRect(); return [a.x + a.width / 2, a.y + a.height / 2, c.y + c.height * 0.8]; });
  await p.evaluate(() => { const x = C.byId.get(UI.planSel); const g = x.m.plan.steps.filter(s => s.typ === 'gruppe')[1]; UI.planColl[x.id + ':' + g.id] = 1; renderNow(); });
  const gg2 = await p.evaluate(() => { const rows = [...document.querySelectorAll('.pl-table .pl-row.grp')]; const a = rows[0].querySelector('.rgrip').getBoundingClientRect(), c = rows[1].getBoundingClientRect(); return [a.x + a.width / 2, a.y + a.height / 2, c.y + c.height * 0.8]; });
  await p.mouse.move(gg2[0], gg2[1]); await p.mouse.down(); await p.mouse.move(gg2[0], gg2[2], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
  const g1 = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.filter(s => s.typ === 'gruppe').map(s => s.name));
  const blockOk = await p.evaluate(() => { const st = C.byId.get(UI.planSel).m.plan.steps; return st[0].typ === 'gruppe'; });
  ok(g1[0] === g0[1] && g1[1] === g0[0] && blockOk, 'Abschnitt als Block verschoben: ' + g0.slice(0, 2).join(',') + ' → ' + g1.slice(0, 2).join(','));
  await p.evaluate(() => { undo(); UI.planColl = {}; renderNow(); }); await p.waitForTimeout(100);
  // Balken verschieben
  const bar = await p.evaluate(() => { const x = C.byId.get(UI.planSel); const s = x.m.plan.steps.find(s => s.typ === 'aufgabe' && x.pc.map.get(s.id).start != null && (+s.dauer) >= 3 && !Object.values(x.pc.ph).some(q => q.mark === s.id)); const r = x.pc.map.get(s.id); const el = document.querySelector('.pl-row[data-rid="' + s.id + '"]'); const idx = [...document.querySelectorAll('.pl-table > .pl-row:not(.head)')].indexOf(el); const b = document.querySelectorAll('.g-body > .g-row')[idx].querySelector('.g-bar'); b.scrollIntoView({ block: 'center', inline: 'center' }); const bb = b.getBoundingClientRect(); return { id: s.id, name: s.name, start: r.start, end: r.end, dur: +s.dauer, x: bb.x, y: bb.y + bb.height / 2, w: bb.width, pxd: UI._pl.pxd }; });
  await p.mouse.move(bar.x + bar.w / 2, bar.y); await p.mouse.down(); await p.mouse.move(bar.x + bar.w / 2 + bar.pxd * 3 + 1, bar.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
  let r = await p.evaluate(id => { const x = C.byId.get(UI.planSel); const r = x.pc.map.get(id); return [r.start, r.end, +x.m.plan.steps.find(s => s.id === id).dauer]; }, bar.id);
  const mv = await p.evaluate(b => { const a = nextWorkday(b.start + 3); return [a, handover(addWT(a, b.dur), C.byId.get(UI.planSel).pal)]; }, bar);   // ab 0.13.7: Beginn auf dem Werktag, Dauer (WT) bleibt; ab 0.14 endet sie am Übergabetag
  ok(r[0] === mv[0] && r[1] === mv[1] && r[2] === bar.dur, '„' + bar.name + '“ um 3 Tage verschoben – Beginn auf dem nächsten Werktag, Dauer bleibt ' + r[2] + ' WT (' + (r[0] - bar.start) + '/' + (r[1] - bar.end) + ')');
  await p.evaluate(() => undo()); await p.waitForTimeout(100);
  // rechtes Ende ziehen
  const bar2 = await p.evaluate(id => { const x = C.byId.get(UI.planSel); const el = document.querySelector('.pl-row[data-rid="' + id + '"]'); const idx = [...document.querySelectorAll('.pl-table > .pl-row:not(.head)')].indexOf(el); const b = document.querySelectorAll('.g-body > .g-row')[idx].querySelector('.g-bar .gr').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, bar.id);
  await p.mouse.move(bar2[0], bar2[1]); await p.mouse.down(); await p.mouse.move(bar2[0] + bar.pxd * 2 + 1, bar2[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
  r = await p.evaluate(id => { const x = C.byId.get(UI.planSel); const r = x.pc.map.get(id); return [r.start, r.end]; }, bar.id);
  ok(r[0] === bar.start && r[1] - bar.end === 2, 'rechtes Ende +2 Tage (Start ' + (r[0] - bar.start) + ', Ende ' + (r[1] - bar.end) + ')');
  await p.evaluate(() => undo()); await p.waitForTimeout(100);
  // linkes Ende
  const bar3 = await p.evaluate(id => { const el = document.querySelector('.pl-row[data-rid="' + id + '"]'); const idx = [...document.querySelectorAll('.pl-table > .pl-row:not(.head)')].indexOf(el); const b = document.querySelectorAll('.g-body > .g-row')[idx].querySelector('.g-bar .gl').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, bar.id);
  await p.mouse.move(bar3[0], bar3[1]); await p.mouse.down(); await p.mouse.move(bar3[0] - bar.pxd * 2 - 1, bar3[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
  r = await p.evaluate(id => { const x = C.byId.get(UI.planSel); const r = x.pc.map.get(id); return [r.start, r.end]; }, bar.id);
  const lw = await p.evaluate(b => nextWorkday(b.start - 2), bar);
  ok(r[0] === lw && r[1] === bar.end, 'linkes Ende −2 Tage – Beginn auf dem Werktag (Start ' + (r[0] - bar.start) + ', Ende ' + (r[1] - bar.end) + ')');
  await p.evaluate(() => undo()); await p.waitForTimeout(100);
  // Mausrad + Zurücksetzen
  const pp0 = await p.evaluate(() => UI._pl.pxd);
  const gb = await p.evaluate(() => { const r = document.querySelector('.pl-gantt').getBoundingClientRect(); return [r.x + r.width / 2, r.y + 200]; });
  await p.mouse.move(gb[0], gb[1]); await p.mouse.wheel(0, -300); await p.waitForTimeout(250); await p.mouse.wheel(0, -300); await p.waitForTimeout(250);
  const pp1 = await p.evaluate(() => UI._pl.pxd);
  ok(pp1 > pp0 * 1.3, 'Mausrad zoomt Gantt ' + pp0.toFixed(2) + ' → ' + pp1.toFixed(2));
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(120); }
  const pp2 = await p.evaluate(() => [UI._pl.pxd, UI.planPxd, !!document.querySelector('.phead .segs')]);
  ok(Math.abs(pp2[0] - pp0) < 0.01 && pp2[1] === 0 && !pp2[2], 'Mausrad zurück zeigt wieder den ganzen Plan ' + pp2[0].toFixed(2) + ' (ohne −/+/Zurücksetzen)');
  // Tabelle einklappen
  const gw0 = await p.evaluate(() => document.querySelector('.pl-gantt').clientWidth);
  await p.click('.divbtn'); await p.waitForTimeout(200);
  const gw1 = await p.evaluate(() => [document.querySelector('.pl-gantt').clientWidth, document.querySelectorAll('.pl-row.head > div').length]);
  ok(gw1[0] > gw0 + 400, 'Gantt breiter durch Einklappen ' + gw0 + ' → ' + gw1[0] + ' (Spalten ' + gw1[1] + ')');
  await p.screenshot({ path: 'r6_plan_compact.png' });
  await p.click('.divbtn'); await p.waitForTimeout(150);
  // S/I-Datum im Kopf
  const si0 = await p.evaluate(() => { const x = C.byId.get(UI.planSel); return [x.s, x.i, x.pal]; });
  const sIn = p.locator('[data-fk="pl:S"]');
  await sIn.fill(await p.evaluate(n => ds(n - 5), si0[0])); await sIn.press('Enter'); await p.waitForTimeout(250);
  const si1 = await p.evaluate(() => { const x = C.byId.get(UI.planSel); return [x.s, x.i, x.pal]; });
  ok(si1[0] === si0[0] - 5 && si1[1] === si0[1] && si1[2] === si0[2], 'Start Selektion −5 Tage, Inhalt und PAL bleiben (' + (si1[0] - si0[0]) + '/' + (si1[1] - si0[1]) + ')');
  const iIn = p.locator('[data-fk="pl:I"]');
  await iIn.fill(await p.evaluate(n => ds(n + 3), si0[1])); await iIn.press('Enter'); await p.waitForTimeout(250);
  const si2 = await p.evaluate(() => { const x = C.byId.get(UI.planSel); return [x.s, x.i, x.pal]; });
  const iw = await p.evaluate(n => nextWorkday(n + 3), si0[1]);
  ok(si2[1] === iw && si2[0] === si1[0] && si2[2] === si0[2], 'Start Inhalt +3 Tage (auf den nächsten Werktag), Selektion und PAL bleiben (' + (si2[0] - si1[0]) + '/' + (si2[1] - si0[1]) + ')');
  await p.evaluate(() => { undo(); undo(); });
  // Neuer Arbeitsschritt
  const nStep0 = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.length);
  await p.click('.pl-table .addlink:has-text("+ Aufgabe") >> nth=0'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.querySelector('.modal') && /^st:.*:name$/.test(document.activeElement.dataset.fk || '') && document.activeElement.value === 'Neue Aufgabe'), '„+ Aufgabe“ legt ohne Fenster eine Zeile an, Name ist markiert');
  await p.screenshot({ path: 'r6_newstep.png' });
  await p.keyboard.type('Testschritt'); await p.keyboard.press('Tab'); await p.waitForTimeout(150);
  const nsid = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.find(s => s.name === 'Testschritt').id);
  await p.fill(`[data-fk="st:${nsid}:wer"]`, 'Eva'); await p.press(`[data-fk="st:${nsid}:wer"]`, 'Enter'); await p.waitForTimeout(150);
  await p.fill(`[data-fk="st:${nsid}:start"]`, '2027-05-03'); await p.press(`[data-fk="st:${nsid}:start"]`, 'Enter'); await p.waitForTimeout(150);
  await p.fill(`[data-fk="st:${nsid}:end"]`, '2027-05-07'); await p.press(`[data-fk="st:${nsid}:end"]`, 'Enter'); await p.waitForTimeout(200);
  const ns = await p.evaluate(() => { const x = C.byId.get(UI.planSel); const st = x.m.plan.steps; const i = st.findIndex(s => s.name === 'Testschritt'); const s = st[i]; const r = x.pc.map.get(s.id); let g = null; for (let j = i; j >= 0; j--) if (st[j].typ === 'gruppe') { g = st[j].name; break; } return [st.length, ds(r.start), ds(r.end), s.wer, g, st.filter(q => q.typ === 'gruppe')[0].name]; });
  ok(ns[0] === nStep0 + 1 && ns[1] === '2027-05-03' && ns[2] === '2027-05-07' && ns[3] === 'Eva' && ns[4] === ns[5], 'Neuer Arbeitsschritt ' + JSON.stringify(ns));
  // Datum in Tabelle ändern
  const sid = await p.evaluate(() => C.byId.get(UI.planSel).m.plan.steps.find(s => s.name === 'Testschritt').id);
  const endIn = p.locator(`[data-fk="st:${sid}:end"]`);
  await endIn.fill('2027-05-10'); await endIn.press('Enter'); await p.waitForTimeout(200);
  const ne = await p.evaluate(id => { const r = C.byId.get(UI.planSel).pc.map.get(id); return [ds(r.start), ds(r.end)]; }, sid);
  ok(ne[0] === '2027-05-03' && ne[1] === '2027-05-10', 'Ende in Tabelle geändert, Beginn bleibt ' + ne.join('–'));
  const stIn = p.locator(`[data-fk="st:${sid}:start"]`);
  await stIn.fill('2027-05-05'); await stIn.press('Enter'); await p.waitForTimeout(200);
  const ns2 = await p.evaluate(id => { const r = C.byId.get(UI.planSel).pc.map.get(id); return [ds(r.start), ds(r.end)]; }, sid);
  ok(ns2[0] === '2027-05-05' && ns2[1] === '2027-05-10', 'Beginn in Tabelle geändert, Ende bleibt ' + ns2.join('–'));
  await p.evaluate(() => { undo(); undo(); undo(); });
  // Neuer Detailplan mit S/I
  await p.evaluate(() => { const x = C.ms.find(x => !x.m.plan && x.pal != null); UI.newPlanFor = x.id; });
  const npId = await p.evaluate(() => UI.newPlanFor);
  await p.evaluate(id => { createPlan(id); }, npId); await p.waitForTimeout(150);
  await p.screenshot({ path: 'r6_newplan.png' });
  const pal = await p.evaluate(id => C.byId.get(id).m.pal, npId);
  const md = await p.$$('.modal input[type=date]');
  const tS = await p.evaluate(p => ds(dn(p) - 70), pal), tI = await p.evaluate(p => ds(dn(p) - 50), pal);
  await md[1].fill(tS); await md[2].fill(tI);
  await p.click('.modal .tpl-complex'); await p.waitForTimeout(250);
  const np = await p.evaluate(id => { const x = C.byId.get(id); return [!!x.m.plan, ds(x.s), ds(x.i), x.m.pal]; }, npId);
  ok(np[0] && np[1] === tS && np[2] === tI && np[3] === pal, 'Neuer Detailplan: S ' + np[1] + ' (soll ' + tS + '), I ' + np[2] + ' (soll ' + tI + ')');
  await p.screenshot({ path: 'r6_plan_new.png' });
  await p.evaluate(() => undo());

  // ---------- Urlaub
  await p.evaluate(() => openUrlaub()); await p.waitForTimeout(200);
  const nv0 = await p.evaluate(() => D.urlaube.length);
  await p.click('.addbtn:has-text("neuen Urlaub")'); await p.waitForTimeout(150);
  await p.selectOption('.vd-wer', 'Martin');
  await p.evaluate(() => { while (!document.querySelector('.vd-day[data-dn="' + mkdn(2027, 8, 2) + '"]')) document.querySelector('.vd-nav button:last-child').click(); });
  { const pos = n => p.evaluate(n => { const r = document.querySelector('.vd-day[data-dn="' + n + '"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, n);
    const a = await pos(await p.evaluate(() => mkdn(2027, 8, 2))), z = await pos(await p.evaluate(() => mkdn(2027, 8, 13)));
    await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(z[0], z[1], { steps: 5 }); await p.mouse.up(); }
  await p.waitForTimeout(100);
  await p.screenshot({ path: 'r6_urlaub_dialog.png' });
  const calc = await p.evaluate(() => document.querySelector('.modal .vd-sum').textContent);
  await p.click('.modal button:has-text("Speichern")'); await p.waitForTimeout(200);
  const nv = await p.evaluate(() => { const u = D.urlaube[D.urlaube.length - 1]; return [D.urlaube.length, u.wer, u.von, u.bis]; });
  ok(nv[0] === nv0 + 1 && nv[1] === 'Martin' && nv[2] === '2027-08-02' && nv[3] === '2027-08-13', 'Urlaub eingetragen ' + JSON.stringify(nv) + ' · ' + calc);
  await p.evaluate(() => undo());

  // ---------- PDF
  await p.click('nav.tabs >> text=Jahresplanung'); await p.waitForTimeout(150);
  await p.evaluate(() => { window.print = () => { window._printed = true; }; printPDF({ secs: { mass: true, kal: true, tl: true }, show: { S: true, I: true, P: true }, vac: true, ms: new Set(C.ms.map(x => x.id)) }); });
  await p.waitForTimeout(300);
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: 'jahr3.pdf', format: 'A4', landscape: true, printBackground: true, margin: { top: '9mm', bottom: '9mm', left: '9mm', right: '9mm' } });
  await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  console.log('ERR', errs.join(' | ') || 'keine'); await b.close();
})();
