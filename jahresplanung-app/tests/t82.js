// 0.53: Bereiche hinter dem P (z. B. „L – Laufzeit“ einer Veranstaltung): in den Einstellungen mit ↑/↓ über das PAL schieben; ihr Datum ist das Ende und liegt nach
// dem PAL (wird nicht mehr auf den PAL gekürzt); Tabelle rechts vom PAL (Datum, Werktage nach PAL, eingeklappt mit Häkchen); Zeitleiste vom PAL bis zum Ende; PDF ebenso
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1700 }); pages.push(p);
  await p.evaluate(() => { window.print = () => {};
    commit(d => { d.settings.bereiche.push({ key: 'L', name: 'Laufzeit', zeichen: 'L', stil: 'streifen', linie: 'streifen' });
      const t = JSON.parse(JSON.stringify(d.massnahmen[0])); d.massnahmen.push(Object.assign(t, { id: 'ev1', name: 'Sommerfest', pal: '2027-07-23', palStatus: 'fest', vorlauf: {}, ende: {}, plan: null })); });
    UI.year = 2027; renderNow(); });
  // ---- A: Einstellungen – L steht zuerst vor dem PAL, ↓ schiebt ihn dahinter
  await p.evaluate(() => openSettings('bereiche')); await p.waitForTimeout(200);
  const rows = () => p.evaluate(() => [...document.querySelectorAll('.btable tbody tr')].map(r => r.dataset.key + (r.classList.contains('nach') ? '>' : '')).join(','));
  ok(await rows() === 'S,I,D,L,P', 'A: neuer Bereich L steht vor dem PAL ' + await rows());
  await p.click('.btable tr[data-key="L"] button[aria-label="später"]'); await p.waitForTimeout(200);
  const a1 = await p.evaluate(() => [D.settings.bereiche.map(q => q.key + (q.nach ? '>' : '')).join(), evKeys().join(), startLabel('L'), document.querySelector('.btable tr[data-key="L"]').textContent.includes('nach dem PAL')]);
  ok(await rows() === 'S,I,D,P,L>' && a1[0] === 'S,I,D,L>' && a1[1] === 'S,I,D,P,L' && a1[2] === 'Ende Laufzeit' && a1[3], 'A: ↓ schiebt L hinter das PAL – „Ende Laufzeit“ ' + JSON.stringify(a1));
  await p.click('.btable tr[data-key="L"] button[aria-label="früher"]'); await p.waitForTimeout(200);
  ok(await rows() === 'S,I,D,L,P' && await p.evaluate(() => !phNach('L')), 'A: ↑ holt ihn wieder vor das PAL');
  await p.click('.btable tr[data-key="L"] button[aria-label="später"]'); await p.waitForTimeout(200);
  await p.click('.btable tr[data-key="D"] button[aria-label="später"]'); await p.waitForTimeout(200);
  ok(await rows() === 'S,I,P,D>,L>', 'A: auch D lässt sich dahinter schieben (Reihenfolge D, L) ' + await rows());
  await p.click('.btable tr[data-key="D"] button[aria-label="früher"]'); await p.waitForTimeout(200);
  ok(await rows() === 'S,I,D,P,L>', 'A: und zurück');
  ok(await p.evaluate(() => { const d = JSON.parse(JSON.stringify(D)); d.settings.bereiche = [{ key: 'L', name: 'L', nach: true }, { key: 'S', name: 'S' }]; return normalize(d).settings.bereiche.map(q => q.key + (q.nach ? '>' : '')).join(); }) === 'S,L>',
    'A: Einlesen behält „hinter dem PAL“ und sortiert die Bereiche davor nach vorn');
  // ---- B: Tabelle – L rechts vom PAL; Datum nach dem PAL bleibt stehen
  await p.evaluate(() => { closeSettings(); UI.view = 'jahr'; UI.secOpen.mass = true; UI.phMini = false; UI.startView = 'date'; renderNow(); }); await p.waitForTimeout(200);
  const b0 = await p.evaluate(() => [...document.querySelectorAll('.mtable thead tr:last-child th')].map(t => t.textContent.trim()).filter(Boolean).slice(4, 9).join('|'));
  ok(b0 === 'Start derProduktionD|PALP|EndeLaufzeitL|PAL-Status|Spendenbitte' || /PALP\|EndeLaufzeitL/.test(b0), 'A2: Spalte „Ende Laufzeit“ steht rechts vom PAL ' + b0);
  await p.fill('[data-fk="m:ev1:L"]', '2027-08-01'); await p.press('[data-fk="m:ev1:L"]', 'Enter'); await p.waitForTimeout(250);
  const b1 = await p.evaluate(() => { const x = C.byId.get('ev1'); return [D.massnahmen.find(m => m.id === 'ev1').vorlauf.L, ds(x.st.L), ds(x.sa.L), ds(x.en.L), C.warnings.filter(w => w.mid === 'ev1').map(w => w.text)]; });
  ok(b1[0] === -9 && b1[1] === '2027-08-01' && b1[2] === '2027-07-23' && b1[3] === '2027-08-01' && !b1[4].length, 'B: Ende 01.08. (Sonntag) nach dem PAL wird gespeichert (−9), läuft ab PAL, keine Warnung ' + JSON.stringify(b1));
  ok(await p.evaluate(() => !document.querySelector('tr[data-m="ev1"] td.ph.nach .wi')), 'B: kein Wochenend-Hinweis an der Laufzeit');
  await p.evaluate(() => { UI.startViewN = 'wt'; renderNow(); }); await p.waitForTimeout(150);   // 0.53.1: rechts eigene Einstellung
  ok(await p.evaluate(() => document.querySelector('[data-fk="m:ev1:L:wt"]').value === '5' && document.querySelector('tr[data-m="ev1"] td.ph.nach').textContent.includes('+')), 'B: Werktage-Ansicht „+5 WT“ (nach dem PAL)');
  await p.fill('[data-fk="m:ev1:L:wt"]', '10'); await p.press('[data-fk="m:ev1:L:wt"]', 'Tab'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => ds(C.byId.get('ev1').st.L)) === '2027-08-06', 'B: „+10 WT“ eingeben → 06.08.2027');
  await p.evaluate(() => { UI.phMiniN = true; renderNow(); }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.querySelector('tr[data-m="ev1"] td.ph.nach.mini .ph-ok') !== null), 'B: eingeklappt – Häkchen in der Spalte L');
  // ---- B2 (0.53.1): rechts eigene Ansicht – unabhängig von S, I, D
  await p.evaluate(() => { UI.phMini = false; UI.phMiniN = false; UI.startView = 'date'; UI.startViewN = 'date'; renderNow(); }); await p.waitForTimeout(150);
  await p.click('.mtable th.gr-ph.nach .ph-tog'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => UI.phMiniN === true && !UI.phMini && !!document.querySelector('tr[data-m="ev1"] td.ph.nach.mini') && !!document.querySelector('.mtable td.ph:not(.nach) input')), 'B2: rechts einklappen – links bleibt aufgeklappt');
  await p.click('.mtable th.gr-ph.nach .ph-tog'); await p.waitForTimeout(200);
  await p.click('.mtable th.gr-ph.nach .vswitch .vs-track'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => UI.startViewN === 'wt' && UI.startView === 'date' && !!document.querySelector('[data-fk="m:ev1:L:wt"]') && !document.querySelector('.mtable td.ph:not(.nach) input[type=number]') && UI_KEYS.includes('phMiniN') && UI_KEYS.includes('startViewN')),
    'B2: rechts auf Werktage – links bleibt Datum (beides gemerkt)');
  await p.click('.mtable th.gr-ph:not(.nach) .ph-tog'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => UI.phMini === true && !UI.phMiniN && !!document.querySelector('[data-fk="m:ev1:L:wt"]')), 'B2: links einklappen – rechts bleibt offen');
  await p.evaluate(() => { UI.phMini = false; UI.startViewN = 'date'; renderNow(); }); await p.waitForTimeout(150);
  // ---- C: Prüfungen – vor dem PAL ist hinter dem P falsch
  await p.evaluate(() => commit(d => { d.massnahmen.find(m => m.id === 'ev1').vorlauf.L = 3; })); await p.waitForTimeout(150);
  ok(await p.evaluate(() => C.warnings.some(w => w.mid === 'ev1' && /Ende Laufzeit .* liegt vor dem PAL/.test(w.text)) && checkData().some(t => /Ende Laufzeit liegt vor dem PAL/.test(t.text || t))), 'C: Ende vor dem PAL → Warnung und Hinweis in „Daten prüfen“');
  await p.evaluate(() => commit(d => { d.massnahmen.find(m => m.id === 'ev1').vorlauf.L = -9; })); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !checkData().some(t => /Laufzeit/.test(t.text || t))), 'C: Ende nach dem PAL – „Daten prüfen“ findet nichts');
  // ---- D: Zeitleiste – Balken vom PAL bis zum Ende, Griff am Ende
  await p.evaluate(() => { UI.secOpen.tl = true; renderNow(); }); await p.waitForTimeout(200);
  const d0 = await p.evaluate(() => { const r = document.querySelector('.tl-row[data-m="ev1"]'), seg = r.querySelector('.seg[data-k="L"]').getBoundingClientRect(), hd = r.querySelector('.handle.h-L').getBoundingClientRect(), dia = r.querySelector('.dia').getBoundingClientRect();
    return [Math.round(seg.left - (dia.left + dia.width / 2)), Math.round(hd.left + hd.width / 2 - seg.right)]; });
  ok(Math.abs(d0[0]) <= 3 && Math.abs(d0[1]) <= 3, 'D: Zeitleiste – Abschnitt L beginnt am PAL, Griff L am Ende ' + JSON.stringify(d0));
  // ---- E: PDF-Tabelle
  await p.evaluate(() => { UI.phMini = false; UI.secOpen = { mass: true, kal: false, tl: false, ag: false }; renderNow(); pdfQuick(); }); await p.waitForTimeout(300);
  const e0 = await p.evaluate(() => { const d = document.querySelector('#printdoc'), th = [...d.querySelectorAll('.pd-table thead th')].map(t => t.textContent.trim()), row = [...d.querySelectorAll('.pd-table tbody tr')].find(r => r.textContent.includes('Sommerfest'));
    const i = th.findIndex(t => /^Ende Laufzeit/.test(t)); d.remove(); document.body.classList.remove('printdoc-mode'); return [th[i - 1], i > 0 ? row.children[i].textContent : null]; });
  ok(/^PAL/.test(e0[0]) && e0[1] === 'So 01.08.2027+5 WT', 'E: PDF – „Ende Laufzeit“ rechts vom PAL, mit Datum und „+5 WT“ ' + JSON.stringify(e0));
  await finish(b, pages);
})();
