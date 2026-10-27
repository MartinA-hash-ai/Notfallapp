/* ===================================================================== Personen: die Excel „Personen.xlsx“ im Ordner der Bedarfsliste (nur lesen)
   Darin stehen die Zuständigen der Bedarfe mit Position, Gliederung, E-Mail und Telefon – ausgefüllt von Copilot oder von Hand und mit
   jedem Bedarf erweitert. Gelesen werden alle Excel-Dateien, deren Name mit „Personen“ beginnt (auch Kopien wie „Personen (1).xlsx“);
   bei unterschiedlichen Angaben gilt die neueste Datei. Fehlende Angaben der Zuständigen werden daraus ergänzt – Eingetragenes bleibt. */

const PR = { list: [], byKey: new Map(), files: [], stamp: '', err: null, busy: false };
const PERS_DATEI = 'Personen.xlsx', PERS_RE = /^personen\b[^/\\]*\.xlsx$/i;
const PERS_COLS = [
  { k: 'n', t: 'Name', w: 26, re: /^((vor- und (zu|nach))?name|name, vorname|vollständiger name|ansprechperson|person)$/ },
  { k: 'rolle', t: 'Position', w: 32, re: /position|funktion|rolle|aufgabe/ },
  { k: 'gl', t: 'Gliederung / Dienststelle', w: 26, re: /gliederung|dienststelle|einheit/ },
  { k: 'fach', t: 'Fachreferat', w: 22, re: /^(fachreferat|fachbereich)/ },                 // z. B. „Soziales Ehrenamt“ – die Person erscheint dort beim Bedarf
  { k: 'mail', t: 'E-Mail', w: 32, re: /mail/ },
  { k: 'tel', t: 'Telefon', w: 20, re: /^(telefon|tel\b|festnetz)(?!.*(\b2\b|mobil|handy))/ },
  { k: 'mobil', t: 'Handy', w: 18, re: /handy|mobil|telefon 2|tel\.? 2|^2\.? ?tel|zweite tel/ },              // „2. Telefonnummer“: meist das Handy
  { k: 'quelle', t: 'Quelle', w: 40, re: /quelle/ },
  { k: 'stand', t: 'Stand', w: 12, re: /^stand|datum/ },
];
const person = name => PR.byKey.get(kkey(name)) || null;
// Personen eines Fachreferats: ausschlaggebend ist die Spalte „Fachreferat“ der Personenliste (mehrere durch Komma, Semikolon oder / getrennt)
const fachTeile = v => String(v || '').split(/\s*[,;/]\s*/).map(norm).filter(Boolean);
const fachPersonen = name => { const q = norm(name); return q ? PR.list.filter(p => fachTeile(p.fach).includes(q)) : []; };
const fachNamen = () => uniq([...FACH_LIST, ...PR.list.flatMap(p => String(p.fach || '').split(/\s*[,;/]\s*/).map(x => x.trim()))]);

// je Blatt die Kopfzeile mit „Name“ und „E-Mail“, „Telefon“ oder „Handy“. Namen auch als „Vorname“ + „Name“/„Nachname“ in zwei Spalten
// oder als „Mustermann, Max“. Platzhalter („nicht gefunden“, „k. A.“) gelten als leer, E-Mail braucht ein @, Telefon Ziffern (führende 0 bleibt)
function parsePersonen(book) {
  const out = [];
  for (const sh of book.sheets) {
    if (sh.hidden) continue;
    const rows = sh.rows, hi = rows.slice(0, 15).findIndex(r => r.some(v => /name|person/.test(norm(v))) && r.some(v => /mail|telefon|handy|mobil/.test(norm(v))));
    if (hi < 0) continue;
    const head = rows[hi].map(v => norm(v)), ci = {}, vi = head.indexOf('vorname');
    for (const c of PERS_COLS) { const i = head.findIndex((t, j) => t && j !== vi && c.re.test(t) && !Object.values(ci).includes(j)); if (i >= 0) ci[c.k] = i; }
    const ni = head.findIndex(t => /^(nachname|zuname|familienname)$/.test(t)), nach = ni >= 0 ? ni : vi >= 0 ? ci.n : -1, umgedreht = head[ci.n] === 'name, vorname';
    for (const r of rows.slice(hi + 1)) {
      const p = Object.fromEntries(PERS_COLS.map(c => [c.k, ci[c.k] == null ? '' : c.k === 'mail' ? mailText(r[ci[c.k]]) : c.k === 'tel' || c.k === 'mobil' ? telText(r[ci[c.k]]) : ohnePlatzhalter(cellStr(r[ci[c.k]]))]));
      if (vi >= 0 && nach != null && nach >= 0) p.n = (ohnePlatzhalter(cellStr(r[vi])) + ' ' + ohnePlatzhalter(cellStr(r[nach]))).trim();
      const q = /^([^,]+),\s*([^,]+)$/.exec(p.n); if (q && (umgedreht || /^[^\s]+$/.test(q[1].trim()))) p.n = q[2].trim() + ' ' + q[1].trim();   // „Mustermann, Max“
      if (istEintrag(p.n)) out.push(p);
    }
  }
  return out;
}
function personenSetzen(L) {
  const m = new Map();
  for (const p of L) { const k = kkey(p.n), a = m.get(k) || {}; for (const [x, v] of Object.entries(p)) if (v) a[x] = v; m.set(k, a); }
  PR.byKey = m; PR.list = [...m.values()].sort((a, b) => a.n.localeCompare(b.n, 'de'));
}
async function personenScan(force) {
  if (DEMO || PR.busy || ST.conn !== 'ok' || !ST.htmlDir) return false;
  PR.busy = true;
  try {
    const fs = [];
    for await (const [n, e] of ST.htmlDir.entries()) if (e.kind === 'file' && PERS_RE.test(n) && !n.startsWith('~$')) fs.push(await e.getFile());
    fs.sort((a, b) => a.lastModified - b.lastModified);                  // die neueste zuletzt: ihre Angaben gelten
    if (!fs.length) setTimeout(personenFrage, 0);                          // noch keine Kontakte-Excel: einmal fragen
    const stamp = fs.map(f => f.name + '@' + f.lastModified).join('|');
    if (!force && stamp === PR.stamp && !PR.err) return false;
    const L = []; let err = null;
    for (const f of fs) {
      try { const P = parsePersonen(await xlsxBook(await f.arrayBuffer(), { max: 4e6 })); if (!P.length) err = 'in „' + f.name + '“ keine Spalten „Name“ und „E-Mail“, „Telefon“ oder „Handy“ erkannt'; L.push(...P); }
      catch (e) { console.warn(e); err = '„' + f.name + '“ gerade nicht lesbar'; }
    }
    personenSetzen(L); PR.files = fs; PR.stamp = stamp; PR.err = err;
    const n = personenErgaenzen();
    if (n) toast('Aus der Personen-Excel ergänzt: Angaben bei ' + n + ' Zuständigen.', 'ok');
    safeRender();
    return true;
  } catch (e) { console.warn(e); PR.err = (e && e.message) || String(e); return false; } finally { PR.busy = false; }
}
// leere Position, E-Mail und Telefon der Zuständigen aus der Personen-Excel füllen (in allen Bedarfen); Anzahl der ergänzten Personen.
// Je Person nur einmal je Fassung der Excel (z.pxl): was du danach in der Liste löschst, bleibt gelöscht – erst eine geänderte Excel füllt wieder auf
function personenErgaenzen() {
  let n = 0, mark = false;
  for (const b of D.bedarfe) for (const z of b.zust) {
    const p = person(z.n); if (!p || z.pxl === PR.stamp) continue;
    let neu = false;
    for (const k of ZUST_F) if (!(z[k] || '').trim() && p[k]) { z[k] = p[k]; neu = true; }
    z.pxl = PR.stamp; mark = true;
    if (neu) n++;
  }
  if (mark) changed();
  return n;
}
// eine Kontakte-Excel (z. B. aus Copilot) einlesen: die Personen kommen in „Personen.xlsx“ – die Datei selbst wird nicht in den Ordner kopiert
async function personenDatei(file) {
  if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return 0; }
  let L = [];
  try { L = parsePersonen(await xlsxBook(await file.arrayBuffer(), { max: 4e6 })); } catch (e) { console.warn(e); }
  if (!L.length) { modal('Keine Personen gefunden', h('p', null, 'In „' + file.name + '“ steht keine Tabelle mit den Spalten „Name“ und „E-Mail“ oder „Telefon“.')); return 0; }
  if (rechOrdnerOk()) {                                                    // in „Personen.xlsx“ übernehmen – keine Kopie der Datei, es bleibt bei einer
    personenSetzen([...PR.list, ...L]);                                      // die eingelesenen Angaben zuletzt: sie gelten
    if (await personenSchreiben()) { await personenScan(true); toast(L.length + ' Personen aus „' + file.name + '“ in „' + PERS_DATEI + '“ übernommen.', 'ok'); return L.length; }
  }
  personenSetzen([...PR.list, ...L]); PR.stamp = (PR.stamp || '') + '|' + file.name + '@' + file.lastModified;   // ohne Ordner: nur für diese Sitzung
  const n = personenErgaenzen(); safeRender();
  toast(L.length + ' Personen eingelesen' + (n ? ', Angaben bei ' + n + ' Zuständigen ergänzt' : '') + '.', 'ok');
  return L.length;
}

/* ---------- Excel anlegen: alle Personen, die die Liste schon kennt, mit Anleitung */
const PERS_ANL = ['Personen für die Bedarfsliste',
  'Hier stehen die Zuständigen der Bedarfe (Fundraising, Malteser Hilfsdienst e. V., Diözese Paderborn) mit ihren dienstlichen Kontaktdaten. Die Bedarfsliste liest diese Datei und ergänzt damit fehlende Angaben bei den Zuständigen. Ausgefüllt von Copilot oder von Hand; die Datei wächst mit jedem Bedarf.',
  'Regeln: Je Person genau eine Zeile im Blatt „Personen“. Spaltenüberschriften und Blattnamen nicht ändern. Vorhandene Zeilen nicht löschen und Angaben nicht überschreiben – nur leere Zellen ergänzen und neue Personen unten anfügen. Nur dienstliche Angaben, die tatsächlich gefunden wurden; sonst leer lassen.',
  'Name: Vor- und Nachname. Position: Funktion bei den Maltesern (z. B. Ortsbeauftragter, Referent Fundraising). Gliederung / Dienststelle: z. B. Paderborn oder Diözesangeschäftsstelle. E-Mail, Telefon und Handy: dienstlich, Nummern als Text mit Vorwahl (z. B. 05251 1234-56). Quelle: woher die Angabe stammt (z. B. Outlook-Adressbuch oder Link). Stand: Datum der Angabe.'];
// alle bekannten Personen: aus den Personen-Excel-Dateien und den Zuständigen aller Bedarfe (Angaben aus der Excel haben Vorrang, Leeres wird ergänzt)
function personenAlle() {
  const bek = new Map(PR.list.map(p => [kkey(p.n), Object.assign({}, p)]));
  for (const b of D.bedarfe) for (const z of b.zust) {
    if (!z.n.trim()) continue;
    const k = kkey(z.n), a = bek.get(k) || { n: z.n.trim() };
    for (const x of ZUST_F) if (!a[x] && (z[x] || '').trim()) a[x] = z[x].trim();
    if (!a.gl && b.gliederung) a.gl = istDio(b.gliederung) ? 'Diözese' : b.gliederung;
    bek.set(k, a);
  }
  return bek;
}
function personenBlob(bek = personenAlle()) {
  const head = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, zelle = { border: 'thin', v: 'top', wrap: true };
  const tx = c => c.k === 'tel' || c.k === 'mobil' ? 'txt' : undefined;          // Telefon als Text: Excel behält die führende 0
  const rows = [PERS_COLS.map(c => ({ v: c.t, st: head })), ...[...bek.values()].sort((a, b) => a.n.localeCompare(b.n, 'de')).map(p => PERS_COLS.map(c => ({ v: p[c.k] || '', st: zelle, t: tx(c) })))];
  for (let i = 0; i < 40; i++) rows.push(PERS_COLS.map(c => ({ v: '', st: zelle, t: tx(c) })));
  const anl = { name: 'Anleitung', cols: [120], rows: PERS_ANL.map((t, i) => [{ v: t, st: i ? { wrap: true, v: 'top' } : { b: true, sz: 15 } }]), heights: { 0: 24, 1: 34, 2: 48, 3: 48 }, grid: false };
  return xlsxBlob([{ name: 'Personen', cols: PERS_COLS.map(c => c.w), rows, heights: { 0: 22 }, freeze: 'B2', grid: false }, anl]);
}

/* ---------- Personenliste dauerhaft ändern – nur mit Bestätigung: beim „Fertig“ der Zuständigen, beim Eintragen einer Ansprechperson in der Liste
   und beim Einpflegen einer Recherche. Ohne Bestätigung bleiben die Angaben nur beim Bedarf. */
const PERS_FL = { rolle: 'Position', mail: 'E-Mail', tel: 'Telefon', mobil: 'Handy', gl: 'Gliederung' };
// was an diesen Personen neu ist gegenüber der Personenliste: [{ c, neu, felder: [[k, alt, neu]] }]
function personenAbweichung(L, gl) {
  const R = [];
  for (const c of L) {
    if (!c || !(c.n || '').trim()) continue;
    const p = person(c.n), x = Object.assign({}, c, !p && gl ? { gl: istDio(gl) ? 'Diözese' : gl } : {});
    const felder = Object.keys(PERS_FL).filter(k => (x[k] || '').trim() && (x[k] || '').trim() !== ((p && p[k]) || '').trim()).map(k => [k, (p && p[k]) || '', x[k].trim()]);
    if (!p || felder.length) R.push({ c: x, neu: !p, felder });
  }
  return R;
}
// in die Personenliste übernehmen (Personen.xlsx); A aus personenAbweichung
async function personenUebernehmen(A) {
  if (!A.length) return false;
  personenSetzen([...PR.list, ...A.map(a => Object.assign({ n: a.c.n.trim() }, Object.fromEntries(a.felder.map(([k, , v]) => [k, v]))))]);   // die neuen Angaben zuletzt: sie gelten
  if (DEMO || !rechOrdnerOk()) { toast('Personenliste geändert – nur für diese Sitzung (ohne verbundenen Ordner wird keine Datei geschrieben).', 'warn'); safeRender(); return true; }
  if (await personenSchreiben()) { await personenScan(true); toast('In die Personenliste übernommen: ' + A.map(a => a.c.n.trim()).join(', '), 'ok'); }
  else toast('„' + PERS_DATEI + '“ konnte nicht geschrieben werden – ist sie gerade in Excel geöffnet?', 'warn');
  safeRender(); return true;
}
// erst fragen, wenn nichts mehr offen ist (Feld in der Liste, Kalender, Fenster) – sonst platzt die Frage mitten in die Eingabe eines neuen Bedarfs
function wennFrei(fn, bis = Date.now() + 120000) {
  if ($('.le-edit, .le-new, .cal-pop, .zeit-pop, .modal, .le-sug')) { if (Date.now() < bis) setTimeout(() => wennFrei(fn, bis), 300); return; }
  fn();
}
// fragen, ob neue Personen bzw. geänderte Angaben dauerhaft in die Personenliste sollen
async function personenBestaetigen(L, gl) {
  const A = personenAbweichung(L, gl); if (!A.length || $('.modal')) return;
  const an = A.map(() => true);
  const body = h('div', { class: 'help' }, h('p', null, 'Diese Angaben stehen noch nicht so in der Personenliste. Sollen sie dauerhaft übernommen werden? Dann schlägt die Liste sie auch bei anderen Bedarfen vor.'),
    ...A.map((a, i) => h('label', { class: 'imp-f pers-best' }, h('input', { type: 'checkbox', checked: true, onchange: e => { an[i] = e.target.checked; } }), h('span', { class: 'imp-n' }, a.c.n.trim()),
      h('span', { class: 'imp-pill' }, a.neu ? 'neu' + (a.felder.length ? ': ' + a.felder.map(f => PERS_FL[f[0]]).join(', ') : '') : 'geändert'),
      a.neu ? null : h('span', { class: 'small muted' }, a.felder.map(([k, alt, neu]) => PERS_FL[k] + ': ' + (alt ? alt + ' → ' : '') + neu).join(' · ')))));
  if (await modal('In die Personenliste übernehmen?', body, [['Nur für diesen Bedarf', false], ['Dauerhaft übernehmen', true, 'primary']])) await personenUebernehmen(A.filter((a, i) => an[i]));
}
// „Personen.xlsx“ schreiben: die Personenliste (PR) – Zuständige aus den Bedarfen nur, wenn sie bestätigt wurden
async function personenSchreiben() {
  if (PR.busy) return false;
  PR.busy = true;
  try { const fh = await ST.htmlDir.getFileHandle(PERS_DATEI, { create: true }), w = await fh.createWritable(); await w.write(personenBlob(new Map(PR.list.map(p => [kkey(p.n), p])))); await w.close(); return true; }
  catch (e) { console.warn(e); return false; }                             // z. B. in Excel geöffnet – beim nächsten Mal wieder
  finally { PR.busy = false; }
}
// einmal fragen, ob eine vorhandene Kontakte-Excel eingelesen werden soll (danach über das Zahnrad)
function personenFrage() {
  if (DEMO || $('.modal')) return;
  try { if (localStorage.getItem('bl-pers-frage')) return; localStorage.setItem('bl-pers-frage', '1'); } catch (e) { return; }
  modal('Kontakte-Excel einlesen?', h('div', null,
    h('p', null, 'Die Liste kann Kontakte der Malteser (Name, Position, E-Mail, Telefon, Handy) aus einer Excel übernehmen – etwa einer Kontaktliste aus Copilot. Beim Eintippen eines Namens schlägt sie die Person dann mit allen Angaben vor.'),
    h('p', { class: 'muted small' }, 'Die Datei bleibt auf deinem Rechner bzw. im OneDrive neben der Bedarfsliste. Neue oder geänderte Kontakte aus den Bedarfen kommen nach einer Rückfrage in „' + PERS_DATEI + '“. Später: Zahnrad → „Kontakte-Excel einlesen …“.')),
    [['Später', false], ['Excel auswählen …', true, 'primary']]).then(async ja => { if (ja) { const f = await pickFile('.xlsx'); if (f) personenDatei(f); } });
}

/* ---------- Personenliste bearbeiten (Knopf „Personenliste“ bei „Zuständig“): Personen der Gliederungen und Fachreferate mit Kontaktdaten.
   Gespeichert wird in „Personen.xlsx“; daraus kommen die Vorschläge beim Tippen und die Personen beim Fachreferat. */
async function personenListeDialog() {
  const F = [['n', 'Name', 'Vorname Nachname'], ['rolle', 'Position', 'z. B. Dienstleitung, Geschäftsführung, Beauftragte'], ['gl', 'Gliederung', 'z. B. Paderborn, Diözese'], ['fach', 'Fachreferat', 'z. B. Soziales Ehrenamt'],
    ['mail', 'E-Mail', 'name@malteser.org'], ['tel', 'Telefon', '05251 …'], ['mobil', 'Handy', '0171 …']];
  const L = PR.list.map(p => Object.assign({}, p)), weg = new Set();
  let q = '';
  const liste = h('div', { class: 'pl-liste' }), zahl = h('span', { class: 'muted small' });
  const zeile = p => h('div', { class: 'pl-z' + (weg.has(p) ? ' weg' : '') }, ...F.map(([k, t, ph]) => h('label', { class: 'pl-f pl-' + k }, h('span', null, t),
      h('input', { type: k === 'mail' ? 'email' : k === 'tel' || k === 'mobil' ? 'tel' : 'text', value: p[k] || '', placeholder: ph, list: k === 'gl' ? 'pl-gl' : k === 'fach' ? 'pl-fach' : null, oninput: e => { p[k] = e.target.value; } }))),
    h('button', { type: 'button', class: 'x', title: weg.has(p) ? 'doch behalten' : 'aus der Liste entfernen', 'aria-label': 'Person entfernen', onclick: () => { weg.has(p) ? weg.delete(p) : weg.add(p); zeig(); } }, weg.has(p) ? '↺' : '×'));
  const passt = p => !q || norm(F.map(([k]) => p[k] || '').join(' ')).includes(q);
  const zeig = () => { const S = L.filter(passt); liste.replaceChildren(...S.map(zeile)); zahl.textContent = L.length + ' Personen' + (q ? ', ' + S.length + ' gefunden' : ''); };
  const neu = () => { const p = { n: '', rolle: '', gl: '', fach: '', mail: '', tel: '', mobil: '' }; L.unshift(p); q = ''; such.value = ''; zeig(); const i = liste.querySelector('input'); if (i) i.focus(); };
  const such = h('input', { type: 'search', class: 'pl-such', placeholder: 'Suchen (Name, Gliederung, Fachreferat …)', oninput: e => { q = norm(e.target.value); zeig(); } });
  zeig();
  const body = h('div', { class: 'help pl' },
    h('div', { class: 'row pl-kopf' }, h('button', { type: 'button', class: 'primary', onclick: neu }, '+ Person hinzufügen'), such, zahl),
    liste, h('datalist', { id: 'pl-gl' }, [DIO, ...GL_LIST].map(g => h('option', { value: g }))), h('datalist', { id: 'pl-fach' }, uniq([...FACH_LIST, ...PR.list.map(p => p.fach).filter(Boolean)]).map(g => h('option', { value: g }))),
    h('p', { class: 'muted small' }, 'Gespeichert in „' + PERS_DATEI + '“ neben der Bedarfsliste. Beim Tippen eines Namens schlägt die Liste diese Personen vor; wer bei „Fachreferat“ eingetragen ist, erscheint beim Bedarf unter „Fachreferat“. '
      + 'Entfernte Personen kommen wieder, solange sie noch in einer anderen „Personen …“-Datei im Ordner oder als Zuständige bei einem Bedarf stehen.'));
  if (!await modal('Personenliste', body, [['Abbrechen', false], ['Speichern', true, 'primary']], { wide: true })) return;
  const R = L.filter(p => !weg.has(p) && p.n.trim()).map(p => Object.assign(p, { n: p.n.trim(), mail: mailText(p.mail || ''), tel: telText(p.tel || ''), mobil: telText(p.mobil || '') }));
  personenSetzen(R);
  if (DEMO || !rechOrdnerOk()) { safeRender(); toast('Personenliste geändert – nur für diese Sitzung (ohne verbundenen Ordner wird keine Datei geschrieben).', 'warn'); return; }
  if (await personenSchreiben()) { await personenScan(true); toast('Personenliste gespeichert (' + R.length + ' Personen).', 'ok'); }
  else toast('„' + PERS_DATEI + '“ konnte nicht geschrieben werden – ist sie gerade in Excel geöffnet?', 'warn');
  safeRender();
}

/* ---------- Personen suchen (Knopf „Suchen“ bei „Zuständig“): in Name, Position, Gliederung, Fachreferat, E-Mail und Telefon –
   jedes eingegebene Wort muss vorkommen (z. B. „Brakel“ zeigt alle aus Brakel). Ausgewählte kommen als Zuständige mit ihren Angaben dazu. */
async function personenSuche(b) {
  const da = new Set(b.zust.map(z => kkey(z.n))), wahl = new Set();
  const liste = h('div', { class: 'ps-liste' }), zahl = h('span', { class: 'muted small' });
  const text = p => norm([p.n, p.rolle, p.gl, p.fach, p.mail, p.tel, p.mobil].filter(Boolean).join(' '));
  let q = [];
  const zeig = () => {
    const S = PR.list.filter(p => q.every(w => text(p).includes(w))).slice(0, 60);
    liste.replaceChildren(...(S.length ? S.map(p => { const k = kkey(p.n), schon = da.has(k);
      return h('label', { class: 'ps-z' + (schon ? ' schon' : '') }, h('input', { type: 'checkbox', checked: schon || wahl.has(k), disabled: schon, onchange: e => { e.target.checked ? wahl.add(k) : wahl.delete(k); los.textContent = wahl.size ? wahl.size + ' übernehmen' : 'Übernehmen'; } }),
        h('span', { class: 'ps-n' }, p.n, schon ? h('span', { class: 'muted small' }, ' · schon zuständig') : null),
        h('span', { class: 'ps-i small muted' }, [p.rolle, p.gl, p.fach && 'Fachreferat ' + p.fach].filter(Boolean).join(' · ')),
        h('span', { class: 'ps-k small muted' }, [p.mail, p.tel || p.mobil].filter(Boolean).join(' · '))); })
      : [h('p', { class: 'muted small' }, PR.list.length ? 'Niemand gefunden.' : 'Die Personenliste ist noch leer – über „Personenliste“ oder Zahnrad → „Kontakte für die Personenliste …“ füllen.')]));
    zahl.textContent = q.length ? S.length + (S.length === 60 ? '+' : '') + ' gefunden' : PR.list.length + ' Personen';
  };
  const such = h('input', { type: 'search', class: 'ps-such', placeholder: 'Name, Position, Gliederung, Fachreferat, E-Mail …', oninput: e => { q = norm(e.target.value).split(/\s+/).filter(Boolean); zeig(); } });
  const los = h('span', null, 'Übernehmen');
  zeig();
  const ok = await modal('Personen suchen', h('div', { class: 'help ps' }, h('div', { class: 'row ps-kopf' }, such, zahl), liste),
    [['Abbrechen', false], [los, true, 'primary']], { wide: true, expose: () => setTimeout(() => such.focus(), 80) });   // nach dem Fokus auf „Übernehmen“
  if (!ok || !wahl.size) return;
  for (const p of PR.list) if (wahl.has(kkey(p.n)) && !da.has(kkey(p.n)) && b.zust.length < MAX_ZUST) b.zust.push(Object.assign(leerZ(), { n: p.n, rolle: p.rolle || '', mail: p.mail || '', tel: p.tel || '', mobil: p.mobil || '' }));
  changed(); keep(renderNow); toast(wahl.size === 1 ? 'Als zuständig übernommen.' : wahl.size + ' Personen als zuständig übernommen.', 'ok');
}

/* ---------- Kontaktdaten mit Copilot: Excel, kurzer Auftrag, Ergebnis übernehmen */
// gesucht werden die Zuständigen dieses Bedarfs, bei denen etwas fehlt (sonst alle)
const personenGesucht = b => { const L = b.zust.filter(z => z.n.trim()), f = L.filter(z => !z.rolle.trim() || !z.mail.trim() || !z.tel.trim()); return f.length ? f : L; };
function personenPrompt(b) {
  const gl = rechGl(b) || 'Diözese Paderborn';
  return ['Suche die dienstlichen Kontaktdaten (Position, E-Mail, Telefon, Handy) dieser Personen vom Malteser Hilfsdienst e. V. (Diözese Paderborn) und trage sie in die angehängte Excel „' + PERS_DATEI + '“ ein (Blatt „Personen“):',
    ...personenGesucht(b).map(z => '- ' + z.n.trim() + ' (' + gl + ')'), '',
    'Suche zuerst in unserem Adressbuch und Organigramm (Outlook, Teams), dann auf malteser.de und den Seiten der Gliederung.',
    'Regeln: je Person eine Zeile; steht sie schon drin, nur leere Zellen ergänzen; nichts löschen oder überschreiben; nur eintragen, was du wirklich gefunden hast, sonst leer lassen; Telefon als Text mit Vorwahl; in „Quelle“ angeben, woher die Angabe stammt; Spaltenüberschriften nicht ändern.',
    'Speichere die Datei unter demselben Namen am selben Ort. Falls das nicht geht, gib sie mir als Excel-Datei mit genau diesem Aufbau zurück. Abweichungen zu vorhandenen Angaben nenne kurz im Chat.'].join('\n');
}
async function personenDialog(b) {
  const ordner = rechOrdnerOk();
  if (ordner) await personenScan(true);
  const st = h('div', { class: 'rech-st muted small' }), btn1 = h('button', { onclick: () => schritt1() }), erg = h('div', { class: 'rech-st small' });
  const datei = () => PR.files.find(f => f.name.toLowerCase() === PERS_DATEI.toLowerCase()) || PR.files[PR.files.length - 1] || null;
  const zeig = () => {
    const f = ordner ? datei() : null;
    st.replaceChildren(!ordner ? (DEMO ? 'In der Vorschau lässt sich keine Excel anlegen – in der Programmdatei liegt sie im Ordner der Bedarfsliste.' : 'Die Excel landet in „Downloads“. In den Ordner der Bedarfsliste legen, damit die Liste sie liest.')
      : f ? '„' + f.name + '“ liegt im Ordner der Bedarfsliste: ' + PR.list.length + ' Personen, zuletzt geändert am ' + lmText(f) + ' Uhr.' + (PR.files.length > 1 ? ' Dazu ' + (PR.files.length - 1) + ' weitere Fassung(en) – die neueste gilt.' : '')
      : 'Noch keine Personen-Excel. Sie wird als „' + PERS_DATEI + '“ neben der Bedarfsliste angelegt – mit allen Personen, die die Liste schon kennt.');
    btn1.textContent = ordner ? (f ? 'Liegt im Ordner' : 'Excel anlegen') : 'Excel herunterladen'; btn1.disabled = !!f; btn1.className = f ? '' : 'primary';
  };
  async function schritt1() {
    if (!ordner) { download(PERS_DATEI, personenBlob()); return; }
    try { const fh = await ST.htmlDir.getFileHandle(PERS_DATEI, { create: true }), w = await fh.createWritable(); await w.write(personenBlob()); await w.close(); }
    catch (e) { console.warn(e); toast('Die Excel konnte nicht im Ordner abgelegt werden. Sie wird stattdessen heruntergeladen.', 'warn'); download(PERS_DATEI, personenBlob()); return; }
    await personenScan(true); zeig(); toast('„' + PERS_DATEI + '“ angelegt', 'ok');
  }
  const ta = h('textarea', { class: 'rech-prompt kurz', rows: 8, spellcheck: false, 'aria-label': 'Auftrag für Copilot' });
  ta.value = personenPrompt(b);
  const kopieren = () => {
    const fail = () => { ta.focus(); ta.select(); toast('Text markiert – jetzt mit Strg+C kopieren'); };
    try { navigator.clipboard.writeText(ta.value).then(() => toast('Auftrag kopiert – in Copilot einfügen', 'ok'), fail); } catch (e) { fail(); }
  };
  // Ergebnis: was bei den Zuständigen dieses Bedarfs ergänzt wurde und wer noch nicht in der Excel steht
  const bericht = vorher => {
    const L = b.zust.filter(z => z.n.trim()), nicht = L.filter(z => !person(z.n)), neu = L.map((z, i) => [z, ZUST_F.filter(k => !(vorher[i][k] || '').trim() && (z[k] || '').trim())]).filter(x => x[1].length);
    const lab = { rolle: 'Position', mail: 'E-Mail', tel: 'Telefon', mobil: 'Handy' };
    erg.replaceChildren(
      neu.length ? h('div', null, 'Ergänzt: ' + neu.map(([z, k]) => z.n + ' (' + k.map(x => lab[x]).join(', ') + ')').join(' · ')) : h('div', null, 'Bei diesem Bedarf wurde nichts ergänzt.'),
      nicht.length ? h('div', { class: 'warn-t' }, 'Noch nicht in der Excel: ' + nicht.map(z => z.n).join(', ') + '. Copilot noch nicht fertig, OneDrive noch nicht synchronisiert – oder das Ergebnis liegt als eigene Datei vor: dann „Andere Datei wählen …“.') : null);
    safeRender();
  };
  const schritt3 = async () => {
    if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
    const vorher = b.zust.filter(z => z.n.trim()).map(z => Object.assign({}, z));
    if (ordner) { await personenScan(true); zeig(); } else { const f = await pickFile('.xlsx'); if (!f || !await personenDatei(f)) return; }
    bericht(vorher);
  };
  const andere = async () => {
    const vorher = b.zust.filter(z => z.n.trim()).map(z => Object.assign({}, z)), f = await pickFile('.xlsx');
    if (f && await personenDatei(f)) { zeig(); bericht(vorher); }
  };
  zeig();
  const body = h('div', { class: 'help rech' },
    h('p', null, 'Copilot sucht die Kontaktdaten der Zuständigen und trägt sie in eine Excel ein, die mit jedem Bedarf wächst. Die Liste liest sie und ergänzt fehlende Position, E-Mail und Telefon – Eingetragenes bleibt.'),
    h('ol', { class: 'rech-steps' },
      h('li', null, h('div', { class: 'rech-row' }, h('b', null, 'Personen-Excel'), btn1), st),
      h('li', null, h('div', { class: 'rech-row' }, h('b', null, 'Auftrag an Copilot'), h('button', { class: 'primary', onclick: kopieren }, 'Prompt kopieren')),
        h('div', { class: 'muted small' }, 'In Copilot einfügen und die Personen-Excel als Datei anhängen.'), ta),
      h('li', null, h('div', { class: 'rech-row' }, h('b', null, 'Ergebnis übernehmen'), h('span', { class: 'rech-btns' }, ordner ? h('button', { onclick: andere }, 'Andere Datei wählen …') : null, h('button', { onclick: schritt3 }, ordner ? 'Excel einlesen' : 'Excel auswählen …'))),
        h('div', { class: 'muted small' }, 'Wenn Copilot fertig ist. Die Liste liest die Excel auch von selbst, etwa jede Minute.'), erg)));
  await modal('Kontaktdaten mit Copilot', body, [['Schließen', null]], { wide: true, expose: () => setTimeout(() => { ta.setSelectionRange(0, 0); ta.scrollTop = 0; }, 60) });
}
