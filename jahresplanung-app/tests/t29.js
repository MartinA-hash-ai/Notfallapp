// 0.8.3 Linie je Bereich einstellbar (abgestuft wie bisher, pastell, kräftig, gestreift, nur Rahmen): Kalender, Zeitleiste, Detailplan-Gantt
const { chromium, ok, open, finish } = require('./lib');
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b); pages.push(p);
  const id = await p.evaluate(() => C.ms.find(x => x.m.name === 'Sommermailing').id);
  // Tag mitten im Teilstück eines Bereichs: Farbe der Verbindungslinie beim Überfahren
  const calLine = k => p.evaluate(([id, k]) => {
    const x = C.byId.get(id); highlight(id);
    const n = x.st[k] + 1, c = document.querySelector('.day.span[data-dn="' + n + '"]');
    return c ? [c.style.getPropertyValue('--hcl'), c.style.getPropertyValue('--hcr'), getComputedStyle(c, '::before').backgroundImage] : null;
  }, [id, k]);

  // ---- A: Voreinstellung wie bisher (abgestuft)
  const a = await p.evaluate(id => { const x = C.byId.get(id); return [lineOf('S'), lineOf('I'), lineOf('D'), lineBg('S', x.color, 1), lineBg('D', x.color, 0)]; }, id);
  const s0 = await calLine('S'), d0 = await calLine('D');
  ok(a.slice(0, 3).join() === 'auto,auto,auto' && s0 && s0[1] === a[3] && d0[1] === a[4], 'A: Voreinstellung „abgestuft“ – Selektion hell, Produktion kräftig wie bisher');
  await p.evaluate(() => highlight(null));

  // ---- B: in den Einstellungen umstellen
  await p.evaluate(() => { openSettings('bereiche'); }); await p.waitForTimeout(250);
  const opts = await p.evaluate(() => [...document.querySelectorAll('.sett-body .btable tr[data-key="S"] .lcol option')].map(o => o.textContent).join(' | '));
  ok(opts === 'Abgestuft (Standard) | Pastell | Kräftig | Gestreift | Nur Rahmen', 'B: Auswahl Linie: ' + opts);
  ok(await p.evaluate(() => /keine Linie/.test(document.querySelector('.sett-body .btable tr[data-key="P"]').textContent)), 'B: PAL ist ein Punkt – ohne Linien-Auswahl');
  await p.selectOption('.sett-body .btable tr[data-key="S"] .lcol select', 'kraeftig');
  await p.selectOption('.sett-body .btable tr[data-key="I"] .lcol select', 'streifen');
  await p.selectOption('.sett-body .btable tr[data-key="D"] .lcol select', 'rahmen');
  await p.waitForTimeout(150);
  const pv = await p.evaluate(() => ['S', 'I', 'D'].map(k => document.querySelector('.sett-body .btable tr[data-key="' + k + '"] .lprev .lp').className).join(' '));
  ok(pv === 'lp ln-kraeftig lp ln-streifen lp ln-rahmen', 'B: Vorschau der Linien aktualisiert (' + pv + ')');
  await p.click('.view-head .backbtn'); await p.waitForTimeout(200);

  // ---- C: Kalender – Verbindungslinie und Verbund-Linien
  const col = await p.evaluate(id => { const x = C.byId.get(id); return [x.color, lineBg('S', x.color), pastel(x.color)]; }, id);
  const s1 = await calLine('S'), i1 = await calLine('I'), d1 = await calLine('D');
  ok(s1[1] === col[1] && /repeating-linear-gradient/.test(i1[1]) && /transparent 1px/.test(d1[1]) && /gradient/.test(s1[2]), 'C: Kalender – Selektion kräftig, Inhalt gestreift, Produktion nur Rahmen');
  await p.evaluate(() => { highlight(null); UI.verbund = true; renderNow(); });
  const vb = await p.evaluate(id => { const x = C.byId.get(id), l = document.querySelector('.day[data-dn="' + (x.st.I + 1) + '"] .vbl[data-m="' + id + '"]'); return l ? l.style.getPropertyValue('--hcr') : null; }, id);
  ok(/repeating-linear-gradient/.test(vb || ''), 'C: Verbund-Darstellung übernimmt die Linie (Inhalt gestreift)');
  await p.evaluate(() => { UI.verbund = false; renderNow(); });

  // ---- D: Zeitleiste – Balken je Bereich
  await p.evaluate(() => { UI.view = 'jahr'; UI.secOpen.tl = true; renderNow(); }); await p.waitForTimeout(200);
  const tl = await p.evaluate(id => { const r = document.querySelector('.tl-row[data-m="' + id + '"]'), g = k => r.querySelector('.seg[data-k="' + k + '"]');
    return [getComputedStyle(g('S')).backgroundImage, getComputedStyle(g('I')).backgroundImage, g('D').classList.contains('outline'), getComputedStyle(g('D')).backgroundColor, getComputedStyle(g('D')).borderTopColor]; }, id);
  const rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')';
  ok(tl[0].includes(rgb(col[0])) && /repeating-linear-gradient/.test(tl[1]) && tl[2] && tl[3] === 'rgb(255, 255, 255)' && tl[4] === rgb(col[0]), 'D: Zeitleiste – S kräftig, I gestreift, D nur Rahmen');

  // ---- E: Detailplan – Abschnittsbalken bleiben einheitlich grau (0.8.4), auch mit eigener Linie oder neuem Bereich
  await p.evaluate(() => { commit(d => { d.settings.bereiche.push({ key: 'X', name: 'X-Test', vorlauf: null, zeichen: 'X', stil: 'pastell', linie: 'kraeftig' }); }); });
  await p.evaluate(id => { UI.view = 'plaene'; UI.planSel = id; renderNow(); addGroup(id); }, id); await p.waitForTimeout(200);
  const gid = await p.evaluate(id => { const st = C.byId.get(id).m.plan.steps; return st[st.length - 1].id; }, id);
  await p.selectOption(`[data-fk="st:${gid}:ber"]`, 'X'); await p.waitForTimeout(150);
  await p.evaluate(([id, gid]) => { addStep(id, gid); }, [id, gid]); await p.waitForTimeout(200);
  const gs = await p.evaluate(() => [...document.querySelectorAll('.g-body > .g-row.grp .g-sum')].map(e => [e.className, e.style.background, getComputedStyle(e).backgroundColor]));
  ok(gs.length >= 4 && gs.every(g => g[0] === 'g-sum' && !g[1] && g[2] === gs[0][2]), 'E: alle ' + gs.length + ' Abschnittsbalken gleich grau (' + gs[0][2] + '), auch der neue Abschnitt „X-Test“');
  // Zeichen des Bereichs steht in der Abschnittszeile, nicht mehr am ersten Schritt
  const mk = await p.evaluate(gid => [[...document.querySelectorAll('.pl-row.grp')].map(r => (r.querySelector('.gname .chip.mark') || {}).textContent || '-').join(''),
    document.querySelectorAll('.pl-row:not(.grp) .chip.mark').length, [...document.querySelector('[data-fk="st:' + gid + ':ber"]').options].map(o => o.textContent).join('|')], gid);
  ok(mk[0].startsWith('SID') && mk[0].endsWith('X') && mk[1] === 0 && mk[2] === '– ohne Bereich|Selektion|Inhalt|Produktion|X-Test', 'E: Zeichen in den Abschnittszeilen (' + mk[0] + '), keines mehr an den Schritten; Auswahl nur mit Namen');
  const gp = await p.evaluate(() => [...document.querySelectorAll('.pl-row.grp .gber')].map(s => parseFloat(getComputedStyle(s).paddingRight)));
  ok(gp.length && gp.every(v => v >= 14), 'E: Bereichsauswahl am Abschnitt lässt rechts Platz für den Pfeil (Text läuft nicht darunter)');
  const al = await p.evaluate(() => { const a = getComputedStyle(document.querySelector('.pl-table .addlink')), n = getComputedStyle(document.querySelector('.pl-row:not(.grp):not(.head) .c-name input')); return [a.color, n.color]; });
  const sum = c => (c.match(/\d+/g) || []).slice(0, 3).reduce((q, v) => q + +v, 0);
  ok(sum(al[0]) >= 600, 'E: „+ Aufgabe“ / „+ Abschnitt“ ganz hellgrau (' + al[0] + ')');

  // ---- F: gespeichert und robust
  const nz = await p.evaluate(() => { const d = normalize(JSON.parse(JSON.stringify(D))); const bad = normalize({ settings: { bereiche: [{ key: 'S', name: 'S', linie: 'quatsch' }] } });
    return [d.settings.bereiche.map(b => b.linie).join(), bad.settings.bereiche[0].linie]; });
  ok(nz[0] === 'kraeftig,streifen,rahmen,kraeftig' && nz[1] === 'auto', 'F: Linien bleiben beim Speichern/Laden erhalten, Unbekanntes → abgestuft');
  const xl = await p.evaluate(async () => new TextDecoder().decode(await viewWorkbook({ year: 2027 }).arrayBuffer()));
  ok(xl.length > 1000, 'F: Excel-Ansicht wird weiter erzeugt');
  await finish(b, pages);
})();
