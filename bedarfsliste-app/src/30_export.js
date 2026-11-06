/* ===================================================================== Exportieren (ab 0.139)
   Knopf „Exportieren“ oben rechts neben ↶. Ein Fenster mit drei Fragen: Was (Bedarfe / Förderer), Welche (alle angezeigten, ausgewählte, nur dieser),
   Wie: PDF (kompakt, ausführlich oder Detail – über das Druckfenster „Als PDF speichern“), Excel, Termine für Outlook (.ics mit Erinnerung).
   Die Spalten der Übersichten sind wählbar; die Wahl merkt sich der Browser (bl-export). */
const EX_KEY = 'bl-export';
const ICON_EXP = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 12.5V3M6.3 6.6L10 2.9l3.7 3.7M4 10.5v5.2c0 .7.6 1.3 1.3 1.3h9.4c.7 0 1.3-.6 1.3-1.3v-5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const exLaden = () => { try { return JSON.parse(localStorage.getItem(EX_KEY) || '{}') || {}; } catch (e) { return {}; } };
const exMerken = o => { try { localStorage.setItem(EX_KEY, JSON.stringify(o)); } catch (e) { /* ohne Speicher */ } };
const exE = s => esc(String(s ?? '')).replace(/\n/g, '<br>');
const exPlain = t => String(t || '').replace(/^\s*(?:[•*-]|\d+\.)\s+/gm, '').replace(/(^|[\s(„>])[*_~+](?=\S)/g, '$1').replace(/(\S)[*_~+](?=$|[\s.,;:!?)“<])/g, '$1').trim();
const exFmt = t => t ? fmtText(t) : '';
const exEinsch = v => (EINSCH.find(e => e[0] === v) || [, ''])[1];

/* ---------- Ablauf (ab 0.140): „Exportieren“ in einer Liste startet den Auswahlmodus – die Liste wird gestrichelt eingerahmt, alles andere abgedunkelt.
   Alles ist ausgewählt; Klick in eine Zeile wählt den Bedarf bzw. Förderer ab oder wieder an, Klick auf eine Spaltenüberschrift die ganze Spalte.
   „Weiter →“ fragt: PDF (die Tabelle so, wie sie zu sehen ist, A4 quer), Excel (dieselben Zeilen und Spalten als Text) oder Termine (Outlook).
   Auf der Seite eines Bedarfs oder Förderers gibt es keine Auswahl: gleich das Fenster, PDF ist die Detailansicht. */
const EXM = { an: false, was: 'b', aus: new Set(), spAus: new Set() };   // aus: abgewählte Zeilen (data-id), spAus: abgewählte Spalten (Nummer im Raster)
const exZiel = () => $('.list-card');
async function exportDialog() {
  closeMenus();
  if (!D) return;
  if (UI.view === 'detail' || UI.view === 'fdetail') {                          // Seite eines Bedarfs oder Förderers: gleich fragen, wie
    const x = UI.view === 'detail' ? cur() : flCur(); if (!x) return;
    return exFormat(UI.view === 'detail' ? 'b' : 'f', [x], null);
  }
  if (UI.view !== 'list' && UI.view !== 'flist') return;
  if (EXM.an) return exModus(false);
  exModus(true);
}
// Raster der Tabelle: zu jeder Zelle die Spalten, die sie überdeckt (colspan und rowspan berücksichtigt)
function exRaster(tab) {
  const R = [], belegt = [];
  [...tab.rows].forEach((tr, y) => { let x = 0; belegt[y] = belegt[y] || [];
    for (const c of tr.cells) { while (belegt[y][x]) x++; const cs = c.colSpan || 1, rs = c.rowSpan || 1;
      for (let dy = 0; dy < rs; dy++) { belegt[y + dy] = belegt[y + dy] || []; for (let dx = 0; dx < cs; dx++) belegt[y + dy][x + dx] = true; }
      R.push({ c, tr, von: x, bis: x + cs - 1, kopf: !!tr.closest('thead') }); x += cs; } });
  return R;
}
const exZeilenId = tr => tr && tr.dataset && tr.dataset.id;
function exMarkieren() {
  const tab = exZiel() && exZiel().querySelector('table'); if (!tab) return;
  const R = exRaster(tab), sp = EXM.spAus;
  for (const z of R) { const ganz = [...Array(z.bis - z.von + 1).keys()].every(i => sp.has(z.von + i)); z.c.classList.toggle('ex-sp-aus', ganz); }
  tab.querySelectorAll('tbody tr').forEach(tr => tr.classList.toggle('ex-z-aus', !!exZeilenId(tr) && EXM.aus.has(exZeilenId(tr))));
  const ids = uniq([...tab.querySelectorAll('tbody tr')].map(exZeilenId).filter(Boolean)), nz = ids.filter(i => !EXM.aus.has(i)).length;
  const kopf = R.filter(z => z.kopf), nsp = uniq(kopf.flatMap(z => [...Array(z.bis - z.von + 1).keys()].map(i => z.von + i))).filter(i => !sp.has(i)).length;
  const t = $('.ex-leiste .ex-lz'); if (t) t.textContent = nz + (nz === 1 ? ' Zeile' : ' Zeilen') + ' · ' + nsp + (nsp === 1 ? ' Spalte' : ' Spalten') + ' ausgewählt';
  const w = $('.ex-leiste .ex-weiter'); if (w) w.disabled = !nz || !nsp;
}
function exModus(an) {
  const ziel = exZiel();
  if (!an) { EXM.an = false; document.documentElement.classList.remove('ex-modus'); if (ziel) ziel.classList.remove('ex-ziel'); $$('.ex-z-aus, .ex-sp-aus').forEach(x => x.classList.remove('ex-z-aus', 'ex-sp-aus')); const l = $('.ex-leiste'); if (l) l.remove(); return; }
  if (!ziel || !ziel.querySelector('tbody tr[data-id]')) { toast('In der Liste steht nichts zum Exportieren.', 'warn'); return; }
  Object.assign(EXM, { an: true, was: UI.view === 'flist' ? 'f' : 'b', aus: new Set(), spAus: new Set() });
  document.documentElement.classList.add('ex-modus'); ziel.classList.add('ex-ziel');
  const leiste = h('div', { class: 'ex-leiste', role: 'toolbar', 'aria-label': 'Auswahl für den Export' },
    h('span', { class: 'ex-lt' }, ICON_EXP_TXT(), 'Exportieren'), h('span', { class: 'ex-lz' }), h('span', { class: 'ex-lh muted small' }, 'Zeile oder Spaltenkopf anklicken: ab- bzw. anwählen'),
    h('button', { type: 'button', class: 'link small', onclick: () => { EXM.aus.clear(); EXM.spAus.clear(); exMarkieren(); } }, 'Alle'),
    h('button', { type: 'button', class: 'link small', onclick: () => { const tab = exZiel().querySelector('table'); tab.querySelectorAll('tbody tr').forEach(tr => { if (exZeilenId(tr)) EXM.aus.add(exZeilenId(tr)); }); exMarkieren(); } }, 'Keine'),
    h('button', { type: 'button', onclick: () => exModus(false) }, 'Abbrechen'),
    h('button', { type: 'button', class: 'primary ex-weiter', onclick: exWeiter }, 'Weiter →'));
  document.body.append(leiste); exMarkieren();
}
const ICON_EXP_TXT = () => h('span', { class: 'ex-li', html: ICON_EXP });
// Klicks im Auswahlmodus: in der Liste an- und abwählen, alles andere (außer der Leiste) ruht
window.addEventListener('click', ev => {
  if (!EXM.an) return;
  const t = ev.target; if (t.closest('.ex-leiste, .modal, .backdrop, .toast')) return;
  ev.preventDefault(); ev.stopPropagation();
  const ziel = exZiel(); if (!ziel || !ziel.contains(t)) return;
  const th = t.closest('thead th, thead td');
  if (th) { const z = exRaster(ziel.querySelector('table')).find(x => x.c === th); if (!z) return; const S = [...Array(z.bis - z.von + 1).keys()].map(i => z.von + i), alle = S.every(i => EXM.spAus.has(i)); S.forEach(i => alle ? EXM.spAus.delete(i) : EXM.spAus.add(i)); exMarkieren(); return; }
  const tr = t.closest('tbody tr'), id = exZeilenId(tr); if (!id) return;
  EXM.aus.has(id) ? EXM.aus.delete(id) : EXM.aus.add(id); exMarkieren();
}, true);
['mousedown', 'mouseup', 'dblclick', 'pointerdown', 'pointerup'].forEach(n => window.addEventListener(n, ev => { if (EXM.an && !ev.target.closest('.ex-leiste, .modal, .backdrop')) { if (n === 'mousedown' || n === 'dblclick') ev.preventDefault(); ev.stopPropagation(); } }, true));
window.addEventListener('keydown', ev => { if (!EXM.an || $('.modal')) return; if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); exModus(false); } else if (!ev.target.closest('.ex-leiste')) { ev.stopPropagation(); } }, true);
// die Liste wird neu gezeichnet (z. B. Speichern im Hintergrund): Rahmen und Markierungen wieder setzen
const exNachRender = () => { if (!EXM.an) return; const z = exZiel(); if (!z || !(UI.view === 'list' || UI.view === 'flist')) return exModus(false); z.classList.add('ex-ziel'); exMarkieren(); };

// Auswahl als Tabelle: Kopie der Liste ohne abgewählte Zeilen und Spalten, ohne Knöpfe und Bedienelemente
function exAuswahlTabelle() {
  const tab = exZiel().querySelector('table'), R = exRaster(tab), sp = EXM.spAus;
  const kopie = tab.cloneNode(true), RK = exRaster(kopie);
  RK.forEach((z, i) => { const n = [...Array(z.bis - z.von + 1).keys()].filter(k => !sp.has(z.von + k)).length; if (!n) z.c.remove(); else if (n < (z.bis - z.von + 1)) z.c.colSpan = n; });
  kopie.querySelectorAll('tbody tr').forEach(tr => { if (exZeilenId(tr) && EXM.aus.has(exZeilenId(tr))) tr.remove(); else if (!exZeilenId(tr) && !tr.closest('thead')) tr.remove(); });
  kopie.querySelectorAll('colgroup').forEach(x => x.remove());
  kopie.removeAttribute('style'); kopie.querySelectorAll('[style*="width"]').forEach(x => x.style.width = '');
  kopie.querySelectorAll('.fl-split, .fl-lupe, .fl-such, .fl-tg, .k-pen, .ex-z-aus, .peek, input, textarea, .fl-fis, .le-pen, .le-cal, .le-plus, .le-ue, .zu-det, tfoot').forEach(x => x.remove());
  kopie.querySelectorAll('.ex-sp-aus').forEach(x => x.classList.remove('ex-sp-aus'));
  kopie.querySelectorAll('[data-act]').forEach(x => x.removeAttribute('data-act'));
  kopie.querySelectorAll('[tabindex]').forEach(x => x.removeAttribute('tabindex'));
  kopie.classList.add('ex-kopie');
  const ids = uniq([...tab.querySelectorAll('tbody tr')].map(exZeilenId).filter(id => id && !EXM.aus.has(id)));
  return { kopie, ids, R };
}
async function exWeiter() {
  const was = EXM.was, A = exAuswahlTabelle();
  const L = A.ids.map(id => was === 'f' ? flEintrag(id) : D.bedarfe.find(b => b.id === id)).filter(Boolean);
  exFormat(was, L, A.kopie);
}
// Fenster „Wie exportieren?“: PDF, Excel oder Termine; bei Terminen die Arten und die Erinnerung
async function exFormat(was, L, kopie) {
  const M = exLaden(), S = { format: M.format || 'pdf', arten: new Set(M.arten || ['frist', 'erwartet', 'vn', 'ueb', 'deadline', 'flfrist']), vorher: M.vorher || '1w' };
  const box = h('div', { class: 'ex' }); let zu = () => {};
  const wer = was === 'f' ? (L.length === 1 ? '„' + (L[0].name || 'Förderer') + '“' : L.length + ' Förderer') : (L.length === 1 ? '„' + (L[0].titel || 'Bedarf') + '“' : L.length + ' Bedarfe');
  const karte = (k, t, s) => h('button', { type: 'button', class: 'ex-k3' + (S.format === k ? ' on' : ''), 'aria-pressed': String(S.format === k), onclick: () => { S.format = k; zeig(); } }, h('b', null, t), h('span', null, s));
  const zeig = () => {
    const T = [h('p', { class: 'ex-wer' }, wer + (kopie ? ' · so, wie ausgewählt' : ' · Detailansicht')),
      h('div', { class: 'ex-3' }, karte('pdf', 'PDF', kopie ? 'Die Tabelle wie angezeigt, A4 quer – über das Druckfenster („Als PDF speichern“)' : 'Detailansicht auf A4 – über das Druckfenster („Als PDF speichern“)'),
        karte('xlsx', 'Excel', kopie ? 'Dieselben Zeilen und Spalten als Excel-Tabelle' : was === 'f' ? 'Alle Angaben des Förderers' : 'Bedarf und Förderplan'),
        karte('ics', 'Termine', 'Fristen für Outlook, mit Erinnerung'))];
    if (S.format === 'ics') {
      const A = was === 'f' ? [['flfrist', 'Fristen der Fördererliste']] : [['frist', 'Antragsfristen'], ['erwartet', 'erwartete Antworten'], ['vn', 'Verwendungsnachweise'], ['ueb', 'Spendenübergaben'], ['deadline', 'Deadline des Bedarfs']];
      T.push(h('div', { class: 'ex-r ex-r-sp' }, h('span', { class: 'ex-l' }, 'Termine'), h('div', { class: 'ex-sp' }, ...A.map(([k, t]) => { const c = h('input', { type: 'checkbox', checked: S.arten.has(k), onchange: () => { c.checked ? S.arten.add(k) : S.arten.delete(k); knopf(); } }); return h('label', { class: 'ex-spz' }, c, t); }))));
      T.push(h('div', { class: 'ex-r' }, h('span', { class: 'ex-l' }, 'Erinnerung'), h('select', { class: 'ex-vorher', onchange: e => { S.vorher = e.target.value; } }, ...EX_VORHER.map(([k, t]) => h('option', { value: k, selected: k === S.vorher }, t)))));
      T.push(h('p', { class: 'muted small ex-h' }, 'Alle künftigen Termine der Auswahl in einer Datei, ganztägig und als „frei“ eingetragen; die Spendenübergabe mit Uhrzeit. Doppelklick auf die Datei übernimmt sie in Outlook.'));
    }
    T.push(h('div', { class: 'ex-fuss' }, h('button', { type: 'button', class: 'primary ex-los', onclick: () => zu('los') }, 'Exportieren')));
    box.replaceChildren(...T); knopf();
  };
  const knopf = () => { const b = box.querySelector('.ex-los'); if (b) b.disabled = S.format === 'ics' && !S.arten.size; };
  zeig();
  const k = await modal('Wie exportieren?', box, [], { cls: 'ex-modal', expose: c => { zu = c; } });
  if (k !== 'los') return;
  exMerken({ format: S.format, arten: [...S.arten], vorher: S.vorher });
  if (kopie) exModus(false);
  if (S.format === 'pdf') { if (kopie) exDruckSeite((was === 'f' ? 'Fördererliste' : UI.tab === 'archiv' ? 'Archiv' : 'Bedarfe'), L.length + (was === 'f' ? ' Förderer' : L.length === 1 ? ' Bedarf' : ' Bedarfe'), kopie.outerHTML, true); else exDrucken(was, L, 'detail'); }
  else if (S.format === 'xlsx') { if (kopie) download((was === 'f' ? 'Fördererliste ' : 'Bedarfe ') + today() + '.xlsx', exTabelleXlsx(kopie, was === 'f' ? 'Fördererliste' : 'Bedarfe')); else if (was === 'f') download('Förderer ' + dateiName(L[0].name || '') + '.xlsx', flBlob(flExportZeilen(L))); else download('Bedarf ' + dateiName(L[0].titel || '') + '.xlsx', exBedarfeXlsx(L)); }
  else exIcs(was, L, S.arten, S.vorher);
}
// Excel aus der ausgewählten Tabelle: je sichtbare Zelle ihr Text (Zeilenumbrüche bleiben)
function exTabelleXlsx(kopie, name) {
  const kopf = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, z = { border: 'thin', v: 'top', wrap: true };
  const d = h('div', { class: 'ex-mess' }, kopie.cloneNode(true)); document.body.append(d);
  const R = exRaster(d.querySelector('table')), n = Math.max(0, ...R.map(x => x.bis)) + 1, zeilen = new Map();
  const text = c => (c.innerText || c.textContent || '').replace(/ /g, ' ').split(/\n+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  for (const x of R) { if (!zeilen.has(x.tr)) zeilen.set(x.tr, { kopf: x.kopf, r: Array(n).fill('') }); const zr = zeilen.get(x.tr).r; zr[x.von] = (zr[x.von] ? zr[x.von] + '\n' : '') + text(x.c); }
  d.remove();
  const rows = [...zeilen.values()].map(x => x.r.map(v => ({ v, st: x.kopf ? kopf : z })));
  return xlsxBlob([{ name, cols: Array(n).fill(24), rows, heights: { 0: 26 }, freeze: 'A2', filter: 'A1:' + colName(n - 1) + rows.length }]);
}
// Druckbereich: Kopfzeile mit Titel und Stand, darunter der Inhalt; quer (Liste) oder hoch (Detail). Breite Tabellen werden auf die Seitenbreite verkleinert
function exDruckSeite(titel, zahl, inhalt, quer) {
  const kopf = `<div class="ex-pk"><div><b>${esc(titel)}</b><span>Malteser · Diözese Paderborn · Fundraising</span></div><span>Stand ${fmtDate(today())} · ${esc(zahl)}</span></div>`;
  let d = document.getElementById('ex-druck'); if (d) d.remove();
  d = h('div', { id: 'ex-druck', class: quer ? 'quer' : 'hoch', html: quer ? kopf + inhalt : inhalt }); document.body.append(d);
  if (quer) { d.classList.add('ex-mess-an'); const t = d.querySelector('table'); if (t) { const w = t.scrollWidth, max = 1040; if (w > max) d.style.zoom = String(Math.max(.45, max / w)); } d.classList.remove('ex-mess-an'); }
  const alt = document.title; document.title = dateiName(titel + ' ' + today());
  const pg = h('style', { id: 'ex-page' }, '@page { size: A4 ' + (quer ? 'landscape' : 'portrait') + '; margin: 12mm; }'); document.head.append(pg);
  document.documentElement.classList.add('ex-drucken');
  const weg = () => { document.documentElement.classList.remove('ex-drucken'); document.title = alt; d.remove(); pg.remove(); removeEventListener('afterprint', weg); };
  addEventListener('afterprint', weg);
  setTimeout(() => { try { window.print(); } catch (e) { weg(); } }, 60);
}
function exDrucken(was, L, umfang) {
  const titel = (was === 'f' ? 'Fördererliste' : 'Bedarfe') + ' – Detail';
  const kopf = `<div class="ex-pk"><div><b>${esc(titel)}</b><span>Malteser · Diözese Paderborn · Fundraising</span></div><span>Stand ${fmtDate(today())}</span></div>`;
  exDruckSeite(titel, '', L.map((x, i) => `<section class="ex-seite${i ? ' neu' : ''}">${kopf}${was === 'f' ? exFDetail(x) : exBDetail(x)}</section>`).join(''), false);
}
const exZeile = (t, v) => v ? `<tr><th>${esc(t)}</th><td>${v}</td></tr>` : '';
function exBDetail(b) {
  const p = phase(b), F = finState(b), L = b.foerderer.filter(f => f.name.trim() || f.betrag), u = b.nach.ueb;
  const zust = b.zust.filter(z => z.n.trim()).map(z => `<div>${esc(z.n)}${[z.rolle, z.mail, z.tel || z.mobil].filter(Boolean).length ? ' <span class="ex-k">· ' + esc([z.rolle, z.mail, z.tel || z.mobil].filter(Boolean).join(' · ')) + '</span>' : ''}</div>`).join('');
  const fr = frItems(b).map(i => `<div>${esc(frName(i))}: ${esc(frText(i) || i.st)}</div>`).join('');
  const ul = b.unterlagen.map(x => `<div>${esc(x.name)}: ${esc(ulText(x))}</div>`).join('');
  const plan = L.length ? `<table class="ex-plan"><thead><tr><th>Förderer</th><th>Stand</th><th>Betrag</th><th>Fristen</th><th>Einschätzung</th></tr></thead><tbody>${L.map(f => `<tr><td><b>${esc(f.name.trim() || '(ohne Namen)')}</b>${f.warum ? '<div class="ex-k">+ ' + esc(exPlain(f.warum)) + '</div>' : ''}${f.knackpunkte ? '<div class="ex-k">– ' + esc(exPlain(f.knackpunkte)) + '</div>' : ''}</td><td>${F_ST_L[f.status]}${f.status === 'zugesagt' && f.eingegangen > 0 ? '<div class="ex-k">eingegangen ' + eur(f.eingegangen) + '</div>' : ''}</td><td>${foeAmt(f) ? eur(foeAmt(f)) : '–'}</td><td>${[f.frist && 'Antrag bis ' + fmtDate(f.frist), f.erwartet && 'Antwort ' + fmtDate(f.erwartet), f.status === 'zugesagt' && f.vn.noetig && f.vn.frist && 'Nachweis bis ' + fmtDate(f.vn.frist)].filter(Boolean).join('<br>') || '–'}</td><td>${esc(exEinsch(f.einsch)) || '–'}</td></tr>`).join('')}</tbody></table>` : '<p class="ex-k">Noch kein Förderer eingetragen.</p>';
  return `<h1>${esc(b.titel || '(ohne Namen)')}</h1>
    <table class="ex-steck">${exZeile('Gliederung', esc(b.gliederung))}${exZeile('Summe', b.summe ? eur(b.summe) + (b.summeArt ? ' <span class="ex-k">(' + esc(b.summeArt) + ')</span>' : '') : '')}${exZeile('Priorität', esc(b.prio))}${exZeile('Deadline', b.deadline ? fmtDate(b.deadline) : '')}
      ${exZeile('Stand', esc(phaseName(p)) + (p.sub || p.t ? ' <span class="ex-k">· ' + esc(p.t + (p.sub ? ': ' + p.sub : '')) + '</span>' : ''))}${exZeile('Stichworte', esc(b.stichworte.join(', ')))}${exZeile('Zuständig', zust)}</table>
    ${b.beschreibung ? '<h2>Beschreibung</h2><div class="ex-txt">' + exFmt(b.beschreibung) + '</div>' : ''}
    <h2>Freigabe und Unterlagen</h2><div class="ex-zwei"><div>${fr}</div><div>${ul}</div></div>
    <h2>Förderplan</h2>${plan}
    <p class="ex-sum">${F.S ? 'Summe ' + eur(F.S) + ' · zugesagt ' + eur(F.zu) + (F.eig ? ' · Eigenmittel ' + eur(F.eig) : '') + (F.d > 0 ? ' · offen ' + eur(F.d) : '') : ''}</p>
    ${u.noetig && (u.termin || u.ort) ? '<h2>Spendenübergabe</h2><p>' + [u.termin && fmtDate(u.termin) + (u.zeit ? ', ' + esc(u.zeit) + ' Uhr' : ''), esc(u.ort)].filter(Boolean).join(' · ') + '</p>' : ''}`;
}
function exFDetail(e) {
  const H = flHistorie(e), K = flKennzahl(H), T = e.topfe.length ? e.topfe : [e];
  const steck = W => `<table class="ex-steck">${exZeile('Förderzweck', exFmt(W.schwer))}${exZeile('Fördergebiet', esc(W.gl.map(g => /^alle$/i.test(g) ? 'alle Gliederungen' : g).join(', ')))}${exZeile('Förderhöhe', esc(flHoeheKlar(W)) + (flGrossT(W) ? ' <span class="ex-k">· über 10.000 € möglich</span>' : ''))}${exZeile('Förderquote', esc(W.quote))}
    ${exZeile('Fristen', esc(flFristenDaten(Object.assign({}, e, { fristenL: e.fristenL.filter(f => W === e || f.topf === W.name || (!f.topf && W === e.topfe[0])) })).map(x => fmtDate(x.iso).slice(0, 6)).join(', ')) + (W.fristen ? ' <span class="ex-k">' + esc(flPlain(W.fristen)) + '</span>' : ''))}
    ${exZeile('Antragsweg', esc(W.weg.join(', ')))}${exZeile('Antrag an', esc(W.antrag))}${exZeile('Homepage', esc(W.web))}${exZeile('Richtlinien', esc(W.richtlinien))}${exZeile('Anschrift', esc(W.anschrift))}
    ${exZeile('Einschätzung', esc(FL_BEW.map(x => { const B = flBew(e, W === e ? null : W)[x.k]; return B.v ? x.t + ': ' + x.st[B.v - 1] : ''; }).filter(Boolean).join(' · ')))}${exZeile('Recherche', W.recherche ? fmtDate(W.recherche) : '')}</table>
    ${W.notiz ? '<div class="ex-txt">' + exFmt(W.notiz) + '</div>' : ''}${(W.beispiele || []).length ? '<p class="ex-k"><b>Beispiele:</b> ' + esc(W.beispiele.map(x => x.titel).filter(Boolean).join(' · ')) + '</p>' : ''}`;
  const kont = e.kontakte.filter(k => k.n.trim()).map(k => `<div>${k.anschreiben === 'ja' ? '★ ' : ''}${esc(k.n)}${[k.pos, k.mail, k.tel, k.gl.length ? 'für ' + k.gl.join(', ') : ''].filter(Boolean).length ? ' <span class="ex-k">· ' + esc([k.pos, k.mail, k.tel, k.gl.length ? 'für ' + k.gl.join(', ') : ''].filter(Boolean).join(' · ')) + '</span>' : ''}${k.anschreiben === 'nein' ? ' <span class="ex-k">· nicht anschreiben</span>' : ''}</div>`).join('');
  const ansp = e.ansprache.map(a => `<div><b>${esc(a.gl || 'alle')}:</b> ${esc(a.titel || (a.art === 'nicht anschreiben' ? 'Nicht anschreiben' : 'Hinweis'))}${a.hinweis ? ' – ' + esc(flPlain(a.hinweis)) : ''}</div>`).join('');
  const hist = H.length ? `<table class="ex-plan"><thead><tr><th>Jahr</th><th>Ergebnis</th><th>Betrag</th><th>Zweck</th><th>Gliederung</th></tr></thead><tbody>${H.slice(0, 25).map(x => `<tr><td>${esc(x.jahr)}</td><td>${esc(x.ergebnis)}${x.grund ? '<div class="ex-k">' + esc(x.grund) + '</div>' : ''}</td><td>${x.betrag ? eur(x.betrag) : '–'}</td><td>${esc(x.zweck)}</td><td>${esc((x.gl || []).join(', '))}</td></tr>`).join('')}</tbody></table>` : '';
  return `<h1>${esc(e.name || '(ohne Namen)')}${e.kurz ? ' <span class="ex-k">(' + esc(e.kurz) + ')</span>' : ''}</h1>
    <p class="ex-k">${esc([e.art, e.status !== 'aktiv' ? e.status : '', K.n ? K.n + ' Förderungen seit ' + K.seit + ', zusammen ' + eur(K.sum) : 'keine Förderung seit ' + K.seit].filter(Boolean).join(' · '))}</p>
    ${ansp ? '<h2>Hinweise zur Ansprache</h2>' + ansp : ''}${kont ? '<h2>Ansprechpersonen</h2>' + kont : ''}
    ${e.topfe.length ? T.map(t => '<h2>Fördertopf: ' + esc(t.name || '(ohne Namen)') + '</h2>' + steck(t)).join('') : '<h2>Steckbrief</h2>' + steck(e)}
    ${hist ? '<h2>Förderungen und Absagen</h2>' + hist : ''}`;
}

/* ---------- Excel der Bedarfe */
function exBedarfeXlsx(L) {
  const kopf = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, z = { border: 'thin', v: 'top', wrap: true };
  const K = ['Bedarf', 'Gliederung', 'Summe (€)', 'Priorität', 'Stand', 'Was fehlt', 'Deadline', 'Nächste Frist', 'Frist für', 'zugesagt (€)', 'offen (€)', 'Freigabe', 'Ansprechperson', 'E-Mail', 'Stichworte', 'Archiv'];
  const R = L.map(b => { const p = phase(b), F = finState(b), x = nextFrist(b), o = frOffen(b), z0 = b.zust.find(q => q.n.trim()) || {};
    return [b.titel, b.gliederung, b.summe ?? '', b.prio, phaseName(p), p.t + (p.sub ? ': ' + p.sub : ''), b.deadline ? fmtDate(b.deadline) : '', x ? fmtDate(x.d) : '', x ? x.t : '', F.zu || '', F.d > 0 ? F.d : '', o.names.length ? 'es fehlt: ' + o.names.join(', ') : 'vollständig', z0.n || '', z0.mail || '', b.stichworte.join(', '), b.archiv ? 'ja' : '']; });
  const KF = ['Bedarf', 'Gliederung', 'Förderer', 'Stand', 'Betrag (€)', 'eingegangen (€)', 'Antragsfrist', 'beantragt am', 'Antwort erwartet', 'Nachweis bis', 'Einschätzung', 'Argumente', 'Knackpunkte'];
  const RF = L.flatMap(b => b.foerderer.filter(f => f.name.trim() || f.betrag).map(f => [b.titel, b.gliederung, f.name, F_ST_L[f.status], foeAmt(f) || '', f.eingegangen ?? '', f.frist ? fmtDate(f.frist) : '', f.beantragtAm ? fmtDate(f.beantragtAm) : '', f.erwartet ? fmtDate(f.erwartet) : '', f.vn.noetig && f.vn.frist ? fmtDate(f.vn.frist) : '', exEinsch(f.einsch), exPlain(f.warum), exPlain(f.knackpunkte)]));
  const blatt = (name, K, R, w) => ({ name, cols: w, rows: [K.map(v => ({ v, st: kopf })), ...R.map(r => r.map(v => ({ v, st: z })))], heights: { 0: 30 }, freeze: 'B2', filter: 'A1:' + colName(K.length - 1) + (R.length + 1) });
  return xlsxBlob([blatt('Bedarfe', K, R, [40, 16, 11, 9, 18, 40, 11, 12, 30, 12, 11, 30, 22, 28, 24, 7]), blatt('Förderplan', KF, RF, [36, 16, 30, 11, 11, 12, 11, 11, 12, 11, 18, 40, 40])]);
}

/* ---------- Termine für Outlook: eine .ics mit allen künftigen Terminen der Auswahl, ganztägig, mit Erinnerung */
const EX_VORHER = [['0', 'keine Erinnerung'], ['tag', 'am Tag selbst (8 Uhr)'], ['1t', '1 Tag vorher'], ['3t', '3 Tage vorher'], ['1w', '1 Woche vorher'], ['2w', '2 Wochen vorher'], ['4w', '4 Wochen vorher']];
const EX_TRIGGER_ZEIT = { tag: '-PT1H', '1t': '-P1D', '3t': '-P3D', '1w': '-P7D', '2w': '-P14D', '4w': '-P28D' };   // Termin mit Uhrzeit (Spendenübergabe)
const EX_TRIGGER = { tag: 'PT8H', '1t': '-PT16H', '3t': '-P2DT16H', '1w': '-P6DT16H', '2w': '-P13DT16H', '4w': '-P27DT16H' };   // ganztägig: ab Mitternacht – Erinnerung jeweils um 8 Uhr
function exTermine(was, L, arten) {
  const heute = today(), T = [];
  if (was === 'f') {
    if (!arten.has('flfrist')) return T;
    const y = +heute.slice(0, 4);
    for (const e of L) { const s = new Set(); for (const j of [y, y + 1]) for (const x of flFristDatenSicher(e, j)) { const k = x.iso + '|' + (x.topf || ''); if (x.iso < heute || s.has(k)) continue; s.add(k);
      T.push({ d: x.iso, uid: e.id + '-' + x.iso + '-' + norm(x.topf || '').replace(/\W+/g, ''), t: 'Frist ' + (e.kurz || e.name) + (x.topf && e.topfe.length > 1 ? ' – ' + x.topf : ''), beschr: [e.name, x.topf ? 'Fördertopf: ' + x.topf : '', e.web ? 'Homepage: ' + e.web : '', 'aus der Fördererliste (Bedarfsliste)'].filter(Boolean).join('\n') }); } }
    return T.sort((a, c) => a.d.localeCompare(c.d));
  }
  for (const b of L) {
    const alle = fristen(b);
    const dl = arten.has('deadline') && b.deadline && !alle.some(x => x.z === 'deadline') ? [{ d: b.deadline, t: 'Deadline des Bedarfs', z: 'deadline' }] : [];
    for (const x of alle.concat(dl)) {
      if (!arten.has(x.z) || x.d < heute) continue;
      T.push({ d: x.d, uid: b.id + '-' + x.z + '-' + (x.fid || '0'), t: x.t + ' – ' + (b.titel || 'Bedarf') + (b.gliederung ? ' (' + b.gliederung + ')' : ''), beschr: [(b.titel || 'Bedarf') + (b.summe ? ' – ' + eur(b.summe) : ''), b.gliederung ? 'Gliederung: ' + b.gliederung : '', 'aus der Bedarfsliste'].filter(Boolean).join('\n').replace(/ /g, ' '),
        zeit: x.z === 'ueb' ? b.nach.ueb.zeit : '', ort: x.z === 'ueb' ? b.nach.ueb.ort : '' });
    }
  }
  return T.sort((a, c) => a.d.localeCompare(c.d));
}
const flFristDatenSicher = (e, j) => { try { return flFristenDaten(e, j); } catch (x) { return []; } };
function exIcs(was, L, arten, vorher) {
  const T = exTermine(was, L, arten);
  if (!T.length) { toast('In der Auswahl gibt es keine künftigen Termine dieser Art.', 'warn'); return; }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', tr = EX_TRIGGER[vorher];
  const K = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Malteser Dioezese Paderborn//Bedarfsliste//DE', 'METHOD:PUBLISH'];
  for (const x of T) {
    const m = /^(\d{1,2}):(\d{2})/.exec(x.zeit || ''), st = m ? new Date(x.d + 'T' + m[1].padStart(2, '0') + ':' + m[2] + ':00') : null, morgen = new Date(x.d + 'T12:00'); morgen.setDate(morgen.getDate() + 1);
    K.push('BEGIN:VEVENT', 'UID:' + x.uid + '@bedarfsliste', 'DTSTAMP:' + stamp,
      st ? 'DTSTART:' + icsZeit(st) : 'DTSTART;VALUE=DATE:' + x.d.replace(/-/g, ''), st ? 'DTEND:' + icsZeit(new Date(st.getTime() + 36e5)) : 'DTEND;VALUE=DATE:' + icsZeit(morgen).slice(0, 8),
      'SUMMARY:' + icsText(x.t), x.ort ? 'LOCATION:' + icsText(x.ort) : null, 'DESCRIPTION:' + icsText(x.beschr), 'TRANSP:TRANSPARENT', 'X-MICROSOFT-CDO-BUSYSTATUS:FREE');
    if (tr) K.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(x.t), 'TRIGGER:' + (st ? EX_TRIGGER_ZEIT[vorher] : tr), 'END:VALARM');
    K.push('END:VEVENT');
  }
  K.push('END:VCALENDAR');
  download((was === 'f' ? 'Fristen Fördererliste ' : 'Termine Bedarfe ') + today() + '.ics', new Blob([K.filter(Boolean).map(icsFalten).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }));
  if (!DEMO) toast(T.length + (T.length === 1 ? ' Termin' : ' Termine') + ' heruntergeladen – Datei öffnen, dann übernimmt Outlook sie.', 'ok');
}
