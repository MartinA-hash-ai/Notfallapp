// 0.9.1 „Bearbeiten“ im Kalender → Detailplan (bzw. Anlegen), Start verschieben mit Rückfrage statt Warnung
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const clickChip = async (id, t) => { const c = await p.evaluate(([id, t]) => { const e = document.querySelector('.cal .chip.' + t + '[data-m="' + id + '"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, [id, t]);
    await p.mouse.click(c[0], c[1]); await p.waitForTimeout(200); };

  // ---- A: Maßnahme mit Detailplan → Bearbeiten öffnet den Detailplan
  const sm = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  await clickChip(sm, 'P');
  await p.click(`.mline[data-m="${sm}"] .mline-edit >> nth=0`); await p.waitForTimeout(250);
  const a = await p.evaluate(() => [UI.view, C.byId.get(UI.planSel).m.name, !!document.querySelector('.modal'), !!document.querySelector('.phead')]);
  ok(a[0] === 'plaene' && a[1] === 'Sommermailing' && !a[2] && a[3], 'A: „Bearbeiten“ bei Sommermailing öffnet dessen Detailplan (kein Fenster)');

  // ---- B: ohne Detailplan → Fenster zum Anlegen
  await p.evaluate(() => { UI.view = 'jahr'; renderNow(); }); await p.waitForTimeout(200);
  const pu = await p.evaluate(() => C.ms.find(x => x.m.name === 'Projekt-Update 1').id);
  await clickChip(pu, 'S');
  await p.click(`.mline[data-m="${pu}"] .mline-edit >> nth=0`); await p.waitForTimeout(250);
  const bb = await p.evaluate(() => [document.querySelector('.modal h2').textContent, !!document.querySelector('.modal .tpl-simple'), !!document.querySelector('.modal .tpl-complex')]);
  ok(/Detailplan anlegen/.test(bb[0]) && bb[1] && bb[2], 'B: ohne Detailplan – „' + bb[0] + '“ mit Einfach/Komplex');
  await p.click('.modal .tpl-simple'); await p.waitForTimeout(250);                  // einfacher Plan: S → I → D, jeder Schritt endet am Start des nächsten

  // ---- C: Start Inhalt hinter den Start Produktion ziehen → Rückfrage
  await p.evaluate(() => { UI.view = 'jahr'; renderNow(); }); await p.waitForTimeout(150);
  const st = () => p.evaluate(id => { const x = C.byId.get(id); return { S: x.st.S, I: x.st.I, D: x.st.D, P: x.pal }; }, pu);
  const s0 = await st(), target = s0.P - 1;                    // so spät geht es durch Kürzen nicht
  await p.evaluate(([id, n]) => { moveStartTo(id, 'I', n); }, [pu, target]); await p.waitForTimeout(200);
  const q = await p.evaluate(() => { const m = document.querySelector('.modal'); return m ? [m.querySelector('h2').textContent, m.innerText, [...m.querySelectorAll('footer button')].map(b => b.textContent)] : null; });
  ok(q && /Start Inhalt verschieben/.test(q[0]) && /hängt/.test(q[1]) && q[2].join('|').includes('Ganzen Abschnitt verschieben'), 'C: Rückfrage „' + (q && q[0]) + '“ mit Begründung und Wahl: ' + (q && q[2].join(' | ')));
  await p.click('.modal footer button:has-text("Nur bis")'); await p.waitForTimeout(250);
  const s1 = await st();
  ok(s1.I > s0.I && s1.I < target, 'C: „Nur bis …“ – Start Inhalt so weit wie möglich (' + (s1.I - s0.I) + ' Tage später)');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  await p.evaluate(([id, n]) => { moveStartTo(id, 'I', n); }, [pu, target]); await p.waitForTimeout(200);
  await p.click('.modal footer button:has-text("Ganzen Abschnitt verschieben")'); await p.waitForTimeout(250);
  const s2 = await st();
  ok(s2.I === target && s2.P === s0.P, 'C: „Ganzen Abschnitt verschieben“ – Start Inhalt genau auf dem Wunschtag, PAL bleibt');
  await p.evaluate(() => undo()); await p.waitForTimeout(150);
  await p.evaluate(([id, n]) => { moveStartTo(id, 'I', n); }, [pu, target]); await p.waitForTimeout(200);
  await p.click('.modal footer button:has-text("Abbrechen")'); await p.waitForTimeout(200);
  ok(JSON.stringify(await st()) === JSON.stringify(s0), 'C: Abbrechen ändert nichts');
  // innerhalb der Möglichkeiten: ohne Rückfrage
  await p.evaluate(([id, n]) => { moveStartTo(id, 'I', n); }, [pu, s0.I + 2]); await p.waitForTimeout(200);
  ok(!(await p.$('.modal')) && (await st()).I === s0.I + 2, 'C: Verschieben im möglichen Rahmen geht ohne Rückfrage');
  await finish(b, pages);
})();
