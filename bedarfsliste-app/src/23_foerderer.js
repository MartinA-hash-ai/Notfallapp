/* ===================================================================== Fördererliste (Beta, ab 0.88)
   Die Förderer-Kartei lebt jetzt im Programm: Reiter „Fördererliste“ (eigene Seite) mit Suche und Filtern, je Förderer eine Seite zum Bearbeiten –
   Angaben, Ansprache je Gliederung (frei / über die Gliederung / nicht anschreiben), Kontakte mit Position und „anschreiben ja/nein“, Förderungen
   und Absagen. Gespeichert wird sie mit der Bedarfsliste (D.fl); nach jedem Speichern legt das Programm eine aktuelle „Fördererliste.xlsx“ in seinen
   Ordner – zum Nachschauen und als Sicherung. Einmal eingelesen wird die umgebaute Excel (Blätter Förderer, Ansprache, Kontakte, Förderungen).
   Verknüpfung mit den Bedarfen: Förderer im Bedarf tragen die ID ihres Eintrags (f.flId) – bei eindeutig gleichem Namen von selbst. Förderungen
   (bestätigter Geldeingang) und Absagen (mit Grund) werden nicht abgeschrieben, sondern immer aus den Bedarfen gelesen, auch aus archivierten.
   Ohne Eintrag zeigt die Förderer-Kachel nach dem Geldeingang einen roten Knopf „In Fördererliste übernehmen?“, neue Kontakte ebenso. */

const FL_DATEI = 'Fördererliste.xlsx';
const FL_ARTEN = ['Sparkasse', 'Volks- und Raiffeisenbank', 'Bank', 'Stiftung', 'Soziallotterie', 'Unternehmen', 'Kirche', 'Öffentlich', 'Stiftung / Sonstige'];
const FL_STATUS = ['aktiv', 'ruht', 'aufgelöst', 'fusioniert'], FL_WEGE = ['direkt', 'per Mail', 'Portal'], FL_ANSPRACHE = ['frei', 'über die Gliederung', 'nicht anschreiben'];
const flLeer = () => ({ id: '', name: '', art: '', status: 'aktiv', gl: [], weg: [], anschrift: '', web: '', schwer: '', hoehe: '', fristen: '', richtlinien: '', recherche: '', notiz: '', ansprache: [], kontakte: [], foerderungen: [] });
const flKontaktLeer = () => ({ id: uid('k'), n: '', pos: '', mail: '', tel: '', gl: [], anschreiben: '', notiz: '' });
const flFoerderungLeer = () => ({ id: uid('g'), jahr: '', datum: '', ergebnis: 'gefördert', betrag: null, zweck: '', gl: [], grund: '', quelle: '' });
const strL = v => (Array.isArray(v) ? v : String(v ?? '').split(/\s*,\s*/)).map(x => String(x ?? '').trim()).filter(Boolean);
const strV = v => String(v ?? '').trim();
function flNorm(x) {
  const o = isObj(x) ? x : {}, ids = new Set();
  const L = (Array.isArray(o.liste) ? o.liste : []).filter(isObj).map(e0 => {
    const e = Object.assign(flLeer(), e0);
    for (const k of ['id', 'name', 'art', 'anschrift', 'web', 'schwer', 'hoehe', 'fristen', 'richtlinien', 'notiz']) e[k] = strV(e[k]);
    e.status = FL_STATUS.includes(e.status) ? e.status : 'aktiv'; e.recherche = validIso(e.recherche) ? e.recherche : '';
    e.gl = strL(e.gl); e.weg = strL(e.weg).filter(w => FL_WEGE.includes(w));
    e.ansprache = (Array.isArray(e.ansprache) ? e.ansprache : []).filter(isObj).map(a => ({ gl: strV(a.gl), art: FL_ANSPRACHE.includes(a.art) ? a.art : 'frei', hinweis: strV(a.hinweis) }));
    e.kontakte = (Array.isArray(e.kontakte) ? e.kontakte : []).filter(isObj).map(k => Object.assign(flKontaktLeer(), k, { gl: strL(k.gl), anschreiben: ['ja', 'nein'].includes(k.anschreiben) ? k.anschreiben : '' }));
    e.foerderungen = (Array.isArray(e.foerderungen) ? e.foerderungen : []).filter(isObj).map(g => Object.assign(flFoerderungLeer(), g, { gl: strL(g.gl), betrag: zahlOderLeer(g.betrag), ergebnis: g.ergebnis === 'abgelehnt' ? 'abgelehnt' : 'gefördert' }));
    if (!e.id || ids.has(e.id)) e.id = ''; ids.add(e.id);
    return e;
  });
  for (const e of L) if (!e.id) { e.id = flNeueId(L); ids.add(e.id); }
  return { liste: L };
}
function flNeueId(L = D.fl.liste) { const n = Math.max(0, ...L.map(e => +(/^F(\d+)$/.exec(e.id) || [0, 0])[1])); return 'F' + String(n + 1).padStart(3, '0'); }
const flAktiv = () => !!(D && D.fl && D.fl.liste.length);
const flEintrag = id => (id && D.fl.liste.find(e => e.id === id)) || null;
const flVonName = name => { const k = kkey(name); if (!k) return null; const L = D.fl.liste.filter(e => kkey(e.name) === k); return L.length === 1 ? L[0] : null; };
// Förderer im Bedarf → Eintrag: ein eindeutig gleicher Name gilt vor der gespeicherten Verknüpfung (Förderer im Bedarf umbenannt);
// nach „nicht in die Liste“ bzw. „Verknüpfung lösen“ (flNein) nur die von Hand gesetzte
function flVon(f) {
  if (!flAktiv()) return null;
  if (f.flNein) return flEintrag(f.flId);
  return (f.name.trim() && flVonName(f.name)) || flEintrag(f.flId);
}
// Verknüpfungen festschreiben (beim Start, nach dem Einlesen, kurz nach Änderungen); verwaiste (Eintrag gelöscht) fallen weg
function flAlleVerknuepfen() {
  let n = 0; if (!flAktiv()) return 0;
  for (const b of D.bedarfe) for (const f of b.foerderer) { const e = flVon(f), id = e ? e.id : ''; if (f.flId !== id) { if (id) n++; f.flId = id; } }
  return n;
}

// ---------- Förderungen und Absagen: gespeicherte (alte Kartei, von Hand) und die aus den Bedarfen (immer frisch gelesen)
const flGl = b => b.gliederung ? [b.gliederung === DIO ? 'Diözese' : b.gliederung] : [];
function flHistorie(e) {
  const L = e.foerderungen.map(g => Object.assign({}, g, { quelle: g.quelle || 'von Hand', gespeichert: true }));
  for (const b of D.bedarfe) for (const f of b.foerderer) {
    if (f.flId !== e.id) continue;
    if (f.status === 'zugesagt' && f.eingegangen > 0) L.push({ id: 'b-' + f.id, jahr: (f.eingangAm || f.entscheidungAm || '').slice(0, 4), datum: f.eingangAm, ergebnis: 'gefördert', betrag: f.eingegangen, zweck: b.titel || '(ohne Namen)', gl: flGl(b), grund: '', quelle: 'Bedarfsliste', bedarfId: b.id, fid: f.id });
    else if (f.status === 'abgelehnt') L.push({ id: 'b-' + f.id, jahr: (f.entscheidungAm || f.beantragtAm || '').slice(0, 4), datum: f.entscheidungAm, ergebnis: 'abgelehnt', betrag: +f.betrag || null, zweck: b.titel || '(ohne Namen)', gl: flGl(b), grund: f.grund, quelle: 'Bedarfsliste', bedarfId: b.id, fid: f.id });
  }
  return L.sort((a, c) => String(c.datum || c.jahr || '').localeCompare(String(a.datum || a.jahr || '')));
}
// laufende Anträge (verknüpft, noch ohne Geldeingang bzw. Antwort)
const flLaufend = e => D.bedarfe.flatMap(b => b.foerderer.filter(f => f.flId === e.id && !(f.status === 'zugesagt' && f.eingegangen > 0) && f.status !== 'abgelehnt').map(f => ({ b, f })));
const flSumme = e => flHistorie(e).filter(x => x.ergebnis === 'gefördert').reduce((s, x) => s + (+x.betrag || 0), 0);

// ---------- als „Kartei“ für das übrige Programm (Vorschläge beim Anlegen, Kontakte, Hinweis „laut Kartei für …“)
function flZuKartei() {
  if (!flAktiv()) return;
  karteiSet(D.fl.liste.filter(e => e.name.trim()).map(e => ({
    name: e.name, flId: e.id, blatt: /stift/i.test(e.art) ? 'Stiftungen' : 'Banken', gl: e.gl.slice(), weg: e.weg.slice(), notiz: e.notiz, schwer: e.schwer, web: e.web,
    kontakte: e.kontakte.filter(k => k.n.trim()).sort((a, c) => (c.anschreiben === 'ja') - (a.anschreiben === 'ja')).map(k => ({ n: k.n, pos: k.pos, m: k.mail, t: k.tel, nicht: k.anschreiben === 'nein', gl: k.gl.slice() })),
    hist: flHistorie(e).filter(x => x.ergebnis === 'gefördert').reduce((h, x) => { const y = x.jahr || '–', t = [x.betrag ? eur(x.betrag) : '', x.zweck].filter(Boolean).join(' '); h[y] = h[y] ? h[y] + '\n' + t : t; return h; }, {}) })));
  Object.assign(KR, { name: 'Fördererliste', err: null, zugriff: false, at: new Date() });
}
// Ansprache je Gliederung: läuft sie über die Gliederung oder soll der Förderer gar nicht angeschrieben werden?
function flAnsprache(b, f) {
  if (!flAktiv() || !b.gliederung) return null;
  const e = flEintrag(f.flId) || (f.name.trim() && flVonName(f.name)); if (!e) return null;
  const a = e.ansprache.find(x => norm(x.gl) === norm(b.gliederung));
  return a && a.art !== 'frei' ? a : null;
}

// beim Start: verknüpfen und als Kartei bereitstellen (die Vorschau bekommt erfundene Förderer)
function flStart() {
  if (DEMO && !flAktiv() && typeof demoFoerderer === 'function') D.fl = flNorm({ liste: demoFoerderer() });
  if (flAktiv()) { flAlleVerknuepfen(); flZuKartei(); }
}
// nach Änderungen (kurz verzögert): eindeutige Namen verknüpfen, Kartei nachführen
let FL_T = null;
const flSig = () => D.bedarfe.map(b => b.foerderer.map(f => f.flId).join()).join('|');
function flPruefen() {
  if (!flAktiv()) return; clearTimeout(FL_T);
  FL_T = setTimeout(() => { const vor = flSig(); flAlleVerknuepfen(); flZuKartei(); if (flSig() !== vor && UI.view === 'detail') safeRender(); }, 400);   // Förderer umbenannt: Zeile „Fördererliste: …“ nachziehen
}

// ---------- Excel: einlesen (umgebaute Kartei oder eigene Kopie) und schreiben
const FL_SP = {
  'Förderer': ['ID', 'Name', 'Art', 'Status', 'Gliederungen', 'Antragsweg', 'Anschrift', 'Homepage / Portal', 'Förderschwerpunkte', 'Förderhöhe', 'Fristen', 'Förderrichtlinien (Link)', 'Recherche-Stand', 'Notizen'],
  'Ansprache': ['Förderer-ID', 'Förderer', 'Gliederung', 'Ansprache', 'Hinweis'],
  'Kontakte': ['Förderer-ID', 'Förderer', 'Name', 'Position', 'E-Mail', 'Telefon', 'Gliederungen', 'Anschreiben', 'Notiz'],
  'Förderungen': ['Förderer-ID', 'Förderer', 'Jahr', 'Datum', 'Ergebnis', 'Betrag (€)', 'Zweck / Bedarf', 'Gliederungen', 'Grund der Absage', 'Quelle', 'Bedarf-ID'],
};
const xlDatum = v => typeof v === 'number' && v > 20000 && v < 80000 ? isoDate(new Date(Math.round((v - 25569) * 864e5) + 12 * 36e5)) : anyDate(strV(v)) || '';
function flLesen(book) {
  const blatt = n => book.sheets.find(s => norm(s.name) === norm(n));
  const tab = n => { const s = blatt(n); if (!s || !s.rows.length) return []; const kopf = s.rows[0].map(v => norm(cellStr(v)));
    return s.rows.slice(1).filter(r => r && r.some(v => strV(v))).map(r => Object.fromEntries(kopf.map((k, i) => [k, r[i]]))); };
  const F = tab('Förderer'); if (!F.length || !('id' in F[0]) || !('name' in F[0])) return null;
  const L = F.filter(r => strV(r.name)).map(r => Object.assign(flLeer(), { id: strV(r.id), name: strV(r.name), art: strV(r.art), status: strV(r.status) || 'aktiv', gl: strL(r.gliederungen), weg: strL(r.antragsweg),
    anschrift: strV(r.anschrift), web: strV(r['homepage / portal']), schwer: strV(r['förderschwerpunkte']), hoehe: strV(r['förderhöhe']), fristen: strV(r.fristen), richtlinien: strV(r['förderrichtlinien (link)']), recherche: xlDatum(r['recherche-stand']), notiz: strV(r.notizen) }));
  const zu = r => L.find(e => e.id === strV(r['förderer-id'])) || L.find(e => kkey(e.name) === kkey(r['förderer']));
  for (const r of tab('Ansprache')) { const e = zu(r); if (e && strV(r.gliederung)) e.ansprache.push({ gl: strV(r.gliederung), art: strV(r.ansprache), hinweis: strV(r.hinweis) }); }
  for (const r of tab('Kontakte')) { const e = zu(r); if (e && (strV(r.name) || strV(r['e-mail']) || strV(r.telefon))) e.kontakte.push(Object.assign(flKontaktLeer(), { n: strV(r.name), pos: strV(r.position), mail: strV(r['e-mail']), tel: cellStr(r.telefon), gl: strL(r.gliederungen), anschreiben: norm(r.anschreiben), notiz: strV(r.notiz) })); }
  for (const r of tab('Förderungen')) {
    const e = zu(r); if (!e || /^bedarfsliste$/i.test(strV(r.quelle))) continue;                     // die aus den Bedarfen liest das Programm selbst
    e.foerderungen.push(Object.assign(flFoerderungLeer(), { jahr: strV(r.jahr).replace(/\.0$/, ''), datum: xlDatum(r.datum), ergebnis: norm(r.ergebnis) === 'abgelehnt' ? 'abgelehnt' : 'gefördert', betrag: zahlOderLeer(r['betrag (€)']), zweck: strV(r['zweck / bedarf']), gl: strL(r.gliederungen), grund: strV(r['grund der absage']), quelle: strV(r.quelle) }));
  }
  return flNorm({ liste: L });
}
async function flEinlesen() {
  if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
  const f = await pickFile('.xlsx'); if (!f) return;
  let R = null; try { R = flLesen(await xlsxBook(await f.arrayBuffer())); } catch (e) { console.warn(e); }
  if (!R || !R.liste.length) { modal('Keine Fördererliste gefunden', h('p', {}, 'In „' + f.name + '“ steht kein Blatt „Förderer“ mit den Spalten „ID“ und „Name“. Eingelesen wird die umgebaute Fördererliste (Blätter Förderer, Ansprache, Kontakte, Förderungen).')); return; }
  const n = k => R.liste.reduce((s, e) => s + e[k].length, 0);
  const z = (k, eins, viele) => n(k) + (n(k) === 1 ? eins : viele);
  if (!await confirmBox('Fördererliste übernehmen?', R.liste.length + ' Förderer mit ' + z('kontakte', ' Kontakt', ' Kontakten') + ' und ' + z('foerderungen', ' Förderung', ' Förderungen') + ' aus „' + f.name + '“'
    + (flAktiv() ? ' – ersetzt die bisherige Fördererliste (' + D.fl.liste.length + ' Förderer). Förderungen aus den Bedarfen bleiben verknüpft, solange die IDs gleich sind.' : '.'), 'Übernehmen')) return;
  D.fl = R; const v = flAlleVerknuepfen(); flZuKartei(); changed(); keep(renderNow);
  toast('Fördererliste übernommen: ' + R.liste.length + ' Förderer' + (v ? ', ' + v + ' Förderer in Bedarfen verknüpft' : ''), 'ok');
}
function flExportZeilen() {
  const L = D.fl.liste, j = v => v.join(', ');
  return {
    'Förderer': L.map(e => [e.id, e.name, e.art, e.status, j(e.gl), j(e.weg), e.anschrift, e.web, e.schwer, e.hoehe, e.fristen, e.richtlinien, e.recherche, e.notiz]),
    'Ansprache': L.flatMap(e => e.ansprache.map(a => [e.id, e.name, a.gl, a.art, a.hinweis])),
    'Kontakte': L.flatMap(e => e.kontakte.map(k => [e.id, e.name, k.n, k.pos, k.mail, k.tel, j(k.gl), k.anschreiben, k.notiz])),
    'Förderungen': L.flatMap(e => flHistorie(e).map(x => [e.id, e.name, +x.jahr || x.jahr || '', x.datum || '', x.ergebnis, x.betrag, x.zweck, j(x.gl || []), x.grund || '', x.quelle, x.bedarfId || ''])),
  };
}
function flBlob(Z = flExportZeilen()) {
  const kopf = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, z = { border: 'thin', v: 'top', wrap: true };
  const breiten = { 'Förderer': [7, 34, 18, 11, 26, 16, 30, 34, 34, 16, 18, 26, 13, 40], 'Ansprache': [11, 30, 22, 22, 60], 'Kontakte': [11, 30, 26, 24, 34, 18, 24, 12, 30], 'Förderungen': [11, 30, 7, 11, 11, 11, 40, 24, 30, 16, 12] };
  const datum = { 'Förderer': [12], 'Förderungen': [3] }, txt = { 'Kontakte': [5] }, listen = { 'Förderer': [[2, FL_ARTEN], [3, FL_STATUS]], 'Ansprache': [[3, FL_ANSPRACHE]], 'Kontakte': [[7, ['ja', 'nein']]], 'Förderungen': [[4, ['gefördert', 'abgelehnt']]] };
  const sheets = Object.keys(FL_SP).map(name => {
    const R = Z[name], n = R.length + 1, last = colName(FL_SP[name].length - 1);
    return { name, cols: breiten[name], freeze: 'C2', filter: 'A1:' + last + n, heights: { 0: 30 },
      rows: [FL_SP[name].map(v => ({ v, st: kopf })), ...R.map(r => r.map((v, i) => ({ v: v == null ? '' : v, st: z, t: (datum[name] || []).includes(i) && validIso(v) ? 'd' : (txt[name] || []).includes(i) ? 'txt' : undefined })))],
      lists: (listen[name] || []).map(([i, items]) => ({ ref: colName(i) + '2:' + colName(i) + (n + 200), items })) };
  });
  sheets.push({ name: 'Anleitung', cols: [120], grid: false, rows: [[{ v: 'Fördererliste der Bedarfsliste', st: { b: true, sz: 15 } }], [],
    ...['Diese Datei schreibt die Bedarfsliste nach jedem Speichern neu – gepflegt wird die Fördererliste im Programm (Reiter „Fördererliste“). Änderungen hier gehen beim nächsten Speichern verloren.',
      'Blatt „Förderer“: je Förderer eine Zeile; die ID (F001 …) verbindet die Blätter. „Ansprache“: je Förderer und Gliederung frei / über die Gliederung / nicht anschreiben.',
      'Blatt „Kontakte“: je Person eine Zeile mit Position; „Anschreiben“: ja, nein oder leer (nicht festgelegt).',
      'Blatt „Förderungen“: Förderungen und Absagen. Quelle „Bedarfsliste“ = aus einem Bedarf (Bedarf-ID), sonst aus der alten Kartei oder von Hand.',
      'Zurückholen: im Programm Reiter „Fördererliste“ → „Excel einlesen …“ (ersetzt die Liste im Programm).'].map(t => [{ v: t, st: { wrap: true } }])] });
  return xlsxBlob(sheets);
}
// Kopie in den Ordner: nach dem Speichern, nur wenn sich etwas geändert hat; ist die Datei in Excel offen, beim nächsten Speichern
const FL_XL = { json: null, t: null, fehler: false };
function flExcelBald() { if (DEMO || !flAktiv() || ST.conn !== 'ok' || !ST.htmlDir) return; clearTimeout(FL_XL.t); FL_XL.t = setTimeout(flExcelSchreiben, 1500); }
async function flExcelSchreiben() {
  const Z = flExportZeilen(), j = JSON.stringify(Z); if (j === FL_XL.json) return;
  try { const fh = await ST.htmlDir.getFileHandle(FL_DATEI, { create: true }), w = await fh.createWritable(); await w.write(flBlob(Z)); await w.close(); FL_XL.json = j; FL_XL.fehler = false; }
  catch (e) { console.warn(e); if (!FL_XL.fehler) toast('„' + FL_DATEI + '“ ließ sich gerade nicht schreiben (in Excel geöffnet?) – neuer Versuch beim nächsten Speichern.', 'warn'); FL_XL.fehler = true; }
}

// ---------- Seite „Fördererliste“: Tabelle mit Suche und Filtern
const flDaten = () => D.fl;
function flGefiltert() {
  const q = norm(UI.flq), art = UI.flArt || '', gl = UI.flGl || '';
  return flDaten().liste.filter(e => (!art || e.art === art) && (!gl || e.gl.some(g => norm(g) === norm(gl) || /^alle$/i.test(g)))
    && (!q || [e.name, e.art, e.notiz, e.schwer, ...e.gl, ...e.kontakte.map(k => k.n + ' ' + k.pos)].some(t => norm(t).includes(q))))
    .sort((a, c) => a.name.localeCompare(c.name, 'de'));
}
const ICON_JA = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_NEIN = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const flAnschr = k => k.anschreiben === 'ja' ? `<span class="fl-ja" title="darf angeschrieben werden">${ICON_JA}</span>` : k.anschreiben === 'nein' ? `<span class="fl-nein" title="nicht anschreiben">${ICON_NEIN}</span>` : '<span class="fl-off"></span>';
function flZeilen() {
  const L = flGefiltert();
  if (!L.length) return `<tr><td colspan="6"><div class="empty">${flDaten().liste.length ? 'Kein Förderer passt zur Suche.' : 'Noch keine Fördererliste – „Excel einlesen …“ übernimmt die umgebaute Fördererliste.'}</div></td></tr>`;
  return L.map(e => {
    const H = flHistorie(e), G = H.filter(x => x.ergebnis === 'gefördert'), sum = G.reduce((s, x) => s + (+x.betrag || 0), 0), letzt = G[0], ab = H.filter(x => x.ergebnis === 'abgelehnt').length;
    const K = e.kontakte.filter(k => k.n.trim()), Kz = K.slice().sort((a, c) => (c.anschreiben === 'ja') - (a.anschreiben === 'ja')).slice(0, 2);
    const ansp = e.ansprache.filter(a => a.art !== 'frei');
    return `<tr data-act="fl-oeffnen" data-id="${e.id}" tabindex="0" class="${e.status !== 'aktiv' ? 'fl-ruht' : ''}">
      <td class="fl-n"><b>${esc(e.name || '(ohne Namen)')}</b><div class="muted small">${esc(e.art || 'Art fehlt')}${e.status !== 'aktiv' ? ' · ' + esc(e.status) : ''}</div></td>
      <td class="fl-g">${esc(e.gl.join(', ')) || '<span class="muted">–</span>'}${ansp.length ? `<div class="fl-ansp" title="${esc(ansp.map(a => a.gl + ': ' + a.art + (a.hinweis ? ' – ' + a.hinweis : '')).join('\n'))}">${ICON_TRI}<span>${ansp.map(a => esc(a.gl)).join(', ')}: ${esc(ansp[0].art)}</span></div>` : ''}</td>
      <td class="fl-w">${esc(e.weg.join(', ')) || '<span class="muted">–</span>'}</td>
      <td class="fl-k">${Kz.map(k => `<div class="fl-kz">${flAnschr(k)}<span>${esc(k.n)}${k.pos ? `<span class="muted"> · ${esc(k.pos)}</span>` : ''}</span></div>`).join('')}${K.length > 2 ? `<div class="muted small">+ ${K.length - 2} weitere</div>` : ''}${K.length ? '' : '<span class="muted">–</span>'}</td>
      <td class="fl-s num">${G.length ? `<b>${eur(sum)}</b><div class="muted small">${G.length}× gefördert${letzt && letzt.jahr ? ', zuletzt ' + esc(letzt.jahr) : ''}</div>` : '<span class="muted">–</span>'}${ab ? `<div class="small fl-ab">${ab}× abgelehnt</div>` : ''}</td>
      <td class="fl-r">${e.recherche ? fmtDate(e.recherche) : '<span class="muted">–</span>'}</td></tr>`;
  }).join('');
}
function flBar() {
  const D0 = flDaten(), n = flGefiltert().length, GL = uniq(D0.liste.flatMap(e => e.gl)).filter(g => !/^alle$/i.test(g)).sort((a, c) => a.localeCompare(c, 'de'));
  const opt = (L, v, leer) => `<option value="">${leer}</option>` + L.map(x => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
  return `<div class="subbar list-head fl-head">
      <span class="muted" id="fl-count">${n} von ${D0.liste.length} Förderern</span>
      <div class="heute"><button class="heute-btn" data-act="fl-neu-leer" title="Förderer von Hand anlegen">+ Förderer</button></div>
      <div class="tools">
        <select data-ui="flArt" aria-label="Nach Art filtern">${opt(uniq([...FL_ARTEN, ...D0.liste.map(e => e.art)]).filter(a => D0.liste.some(e => e.art === a)), UI.flArt, 'Art: alle')}</select>
        <select data-ui="flGl" aria-label="Nach Gliederung filtern">${opt(GL, UI.flGl, 'Gliederung: alle')}</select>
        <input type="search" id="flq" data-ui="flq" value="${esc(UI.flq || '')}" placeholder="Suchen …" aria-label="Förderer suchen (Strg+F)">
        <button data-act="fl-excel-menu" aria-haspopup="menu" title="Excel: herunterladen oder einlesen">Excel ▾</button>
      </div>
    </div>`;
}
function flListView() {
  return `<main class="fl-main"><div class="tablewrap"><table class="list fl-tab"><thead><tr><th>Förderer</th><th>Gliederungen</th><th>Antragsweg</th><th>Ansprechpersonen</th><th class="num">Förderungen</th><th>Recherche</th></tr></thead><tbody id="fl-body">${flZeilen()}</tbody></table></div></main>`;
}
function flExcelMenu(btn) {
  closeMenus();
  const m = h('div', { class: 'menu', role: 'menu' },
    h('button', { role: 'menuitem', onclick: () => { closeMenus(); download(FL_DATEI, flBlob()); } }, 'Fördererliste als Excel herunterladen'),
    DEMO ? null : h('button', { role: 'menuitem', onclick: () => { closeMenus(); flEinlesen(); } }, 'Excel einlesen … (ersetzt die Liste)'),
    !DEMO && ST.conn === 'ok' ? h('div', { class: 'muted small fl-menu-hw' }, 'Eine aktuelle Kopie „' + FL_DATEI + '“ legt das Programm nach jedem Speichern in seinen Ordner.') : null);
  placePop(m, btn, 'right');
}

// ---------- Seite eines Förderers: alles bearbeitbar (data-fl = Pfad im Eintrag)
const flCur = () => flEintrag(UI.flId);
const flIn = (p, v, o = {}) => `<input type="text" class="fl-in${o.cls ? ' ' + o.cls : ''}" data-fl="${p}"${o.typ ? ` data-typ="${o.typ}"` : ''} value="${esc(v ?? '')}" placeholder="${esc(o.ph || '')}" aria-label="${esc(o.aria || o.ph || p)}">`;
const flTa = (p, v, o = {}) => `<textarea class="fl-in" rows="${o.rows || 2}" data-fl="${p}" placeholder="${esc(o.ph || '')}" aria-label="${esc(o.aria || o.ph || p)}">${esc(v || '')}</textarea>`;
const flSel = (p, v, L, o = {}) => `<select class="fl-in${o.cls ? ' ' + o.cls : ''}" data-fl="${p}" aria-label="${esc(o.aria || p)}">${(o.leer != null ? [['', o.leer]] : []).concat(L.map(x => Array.isArray(x) ? x : [x, x])).map(([x, l]) => `<option value="${esc(x)}"${x === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const flFeld = (lab, inner, cls = '') => `<div class="fl-f ${cls}"><span class="fl-l">${lab}</span>${inner}</div>`;
function flDetailBar() {
  const e = flCur();
  return `<div class="subbar"><button class="back" data-act="fl-zurueck">‹ Fördererliste</button><span class="fl-sub-n">${esc(e ? e.name || '(ohne Namen)' : '')}</span></div>`;
}
function flDetailView() {
  const e = flCur(); if (!e) return '<main class="fl-main"><div class="empty">Diesen Förderer gibt es nicht mehr.</div></main>';
  const H = flHistorie(e), G = H.filter(x => x.ergebnis === 'gefördert'), sum = G.reduce((s, x) => s + (+x.betrag || 0), 0), Lauf = flLaufend(e);
  const web = /^https?:\/\//i.test(e.web) ? `<a class="fl-ext" href="${esc(e.web)}" target="_blank" rel="noopener" title="Öffnen">↗</a>` : '';
  const kontakt = (k, i) => `<tr><td>${flIn(`kontakte.${i}.n`, k.n, { ph: 'Name', aria: 'Name' })}</td><td>${flIn(`kontakte.${i}.pos`, k.pos, { ph: 'Position', aria: 'Position' })}</td>
      <td>${flIn(`kontakte.${i}.mail`, k.mail, { ph: 'E-Mail', aria: 'E-Mail' })}</td><td>${flIn(`kontakte.${i}.tel`, k.tel, { ph: 'Telefon', aria: 'Telefon' })}</td>
      <td>${flIn(`kontakte.${i}.gl`, k.gl.join(', '), { typ: 'liste', ph: 'Gliederungen', aria: 'Gliederungen' })}</td>
      <td>${flSel(`kontakte.${i}.anschreiben`, k.anschreiben, [['ja', 'ja'], ['nein', 'nein']], { leer: '–', aria: 'Anschreiben', cls: 'fl-as fl-as-' + (k.anschreiben || 'leer') })}</td>
      <td>${flIn(`kontakte.${i}.notiz`, k.notiz, { ph: 'Notiz', aria: 'Notiz' })}</td><td><button class="fl-x" data-act="fl-k-weg" data-i="${i}" title="Kontakt entfernen" aria-label="Kontakt entfernen">×</button></td></tr>`;
  const ansprache = (a, i) => `<div class="fl-a">${flIn(`ansprache.${i}.gl`, a.gl, { ph: 'Gliederung', aria: 'Gliederung' })}${flSel(`ansprache.${i}.art`, a.art, FL_ANSPRACHE, { aria: 'Ansprache' })}${flTa(`ansprache.${i}.hinweis`, a.hinweis, { rows: 1, ph: 'Hinweis, z. B. fragt selbst an', aria: 'Hinweis' })}<button class="fl-x" data-act="fl-a-weg" data-i="${i}" title="Entfernen" aria-label="Entfernen">×</button></div>`;
  const zeile = x => {
    if (!x.gespeichert) return `<tr class="fl-aus-bedarf"><td>${esc(x.jahr || '–')}</td><td>${x.datum ? fmtDate(x.datum) : ''}</td><td><span class="fl-erg ${x.ergebnis === 'abgelehnt' ? 'ab' : 'ok'}">${x.ergebnis}</span></td><td class="num">${x.betrag ? eur(x.betrag) : ''}</td>
      <td><button class="link fl-bed" data-act="open" data-id="${x.bedarfId}" title="Bedarf öffnen">${esc(x.zweck)}</button></td><td>${esc((x.gl || []).join(', '))}</td><td>${x.ergebnis === 'abgelehnt' ? (x.grund ? esc(x.grund) : '<span class="muted">Grund fehlt</span>') : ''}</td><td class="muted small fl-q">Bedarf</td><td></td></tr>`;
    const i = e.foerderungen.findIndex(g => g.id === x.id);
    return `<tr><td>${flIn(`foerderungen.${i}.jahr`, x.jahr, { ph: 'Jahr', aria: 'Jahr', cls: 'fl-jahr' })}</td><td>${flIn(`foerderungen.${i}.datum`, x.datum ? fmtDate(x.datum) : '', { typ: 'datum', ph: 'Datum', aria: 'Datum', cls: 'fl-dat' })}</td>
      <td>${flSel(`foerderungen.${i}.ergebnis`, x.ergebnis, ['gefördert', 'abgelehnt'], { aria: 'Ergebnis' })}</td><td>${flIn(`foerderungen.${i}.betrag`, x.betrag == null ? '' : fmtNum(x.betrag), { typ: 'zahl', ph: '€', aria: 'Betrag', cls: 'num' })}</td>
      <td>${flIn(`foerderungen.${i}.zweck`, x.zweck, { ph: 'wofür', aria: 'Zweck' })}</td><td>${flIn(`foerderungen.${i}.gl`, (x.gl || []).join(', '), { typ: 'liste', ph: 'Gliederung', aria: 'Gliederung' })}</td>
      <td>${flIn(`foerderungen.${i}.grund`, x.grund, { ph: x.ergebnis === 'abgelehnt' ? 'Grund der Absage' : '', aria: 'Grund der Absage' })}</td><td class="muted small fl-q">${esc(x.quelle)}</td><td><button class="fl-x" data-act="fl-g-weg" data-i="${i}" title="Eintrag entfernen" aria-label="Eintrag entfernen">×</button></td></tr>`;
  };
  return `<main class="fl-main fl-detail">
    <section class="card fl-kopf">
      ${flIn('name', e.name, { ph: 'Name des Förderers', aria: 'Name des Förderers', cls: 'fl-name' })}
      <div class="fl-kopf-r">${flSel('art', e.art, uniq([...FL_ARTEN, e.art]), { leer: 'Art wählen', aria: 'Art' })}${flSel('status', e.status, FL_STATUS, { aria: 'Status' })}
        <button class="fl-x fl-weg" data-act="fl-weg" title="Förderer aus der Liste löschen" aria-label="Förderer löschen">${ICON_TRASH}</button></div>
    </section>
    <div class="grid two fl-grid">
      <section class="card"><h3>Angaben</h3>
        ${flFeld('Gliederungen', flIn('gl', e.gl.join(', '), { typ: 'liste', ph: 'z. B. Paderborn, Büren – oder „alle“', aria: 'Gliederungen' }))}
        ${flFeld('Antragsweg', `<div class="fl-wege">${FL_WEGE.map(w => `<label class="check"><input type="checkbox" data-fl-weg="${w}"${e.weg.includes(w) ? ' checked' : ''}> ${w}</label>`).join('')}</div>`)}
        ${flFeld('Homepage / Portal', `<div class="fl-row">${flIn('web', e.web, { ph: 'https://…', aria: 'Homepage' })}${web}</div>`)}
        ${flFeld('Anschrift', flTa('anschrift', e.anschrift, { rows: 1, ph: 'Straße, PLZ Ort', aria: 'Anschrift' }))}
        ${flFeld('Förderschwerpunkte', flTa('schwer', e.schwer, { rows: 1, ph: 'z. B. Bevölkerungsschutz, Jugend', aria: 'Förderschwerpunkte' }))}
        <div class="fl-drei">${flFeld('Förderhöhe', flIn('hoehe', e.hoehe, { ph: 'z. B. bis 5.000 €', aria: 'Förderhöhe' }))}${flFeld('Fristen', flIn('fristen', e.fristen, { ph: 'z. B. 31.03. und 30.09.', aria: 'Fristen' }))}${flFeld('Recherche-Stand', flIn('recherche', e.recherche ? fmtDate(e.recherche) : '', { typ: 'datum', ph: 'tt.mm.jjjj', aria: 'Recherche-Stand' }))}</div>
        ${flFeld('Förderrichtlinien (Link)', flIn('richtlinien', e.richtlinien, { ph: 'https://…', aria: 'Förderrichtlinien' }))}
        ${flFeld('Notizen', flTa('notiz', e.notiz, { rows: 1, ph: 'z. B. Zugang zum Portal, Besonderheiten', aria: 'Notizen' }))}
      </section>
      <section class="card"><h3>Ansprache je Gliederung <span class="info-t muted">– wer schreibt an?</span></h3>
        <div class="fl-al">${e.ansprache.map(ansprache).join('') || '<p class="muted small">Überall frei – nichts vermerkt.</p>'}</div>
        <button class="link small" data-act="fl-a-neu">+ Vermerk für eine Gliederung</button>
        <h3 class="fl-h2">Laufend</h3>
        ${Lauf.length ? Lauf.map(({ b, f }) => `<div class="fl-lauf"><button class="link" data-act="open" data-id="${b.id}">${esc(b.titel || '(ohne Namen)')}</button><span class="muted small"> · ${esc(F_ST_L[f.status])}${foeAmt(f) ? ' · ' + eur(foeAmt(f)) : ''}${b.archiv ? ' · im Archiv' : ''}</span></div>`).join('') : '<p class="muted small">Kein laufender Antrag.</p>'}
      </section>
    </div>
    <section class="card"><h3>Kontakte</h3>
      <div class="fl-scroll"><table class="fl-kt"><thead><tr><th>Name</th><th>Position</th><th>E-Mail</th><th>Telefon</th><th>Gliederungen</th><th>Anschreiben</th><th>Notiz</th><th></th></tr></thead>
        <tbody>${e.kontakte.map(kontakt).join('') || '<tr><td colspan="8" class="muted small">Noch kein Kontakt.</td></tr>'}</tbody></table></div>
      <button class="link small" data-act="fl-k-neu">+ Kontakt</button>
    </section>
    <section class="card"><h3>Förderungen und Absagen <span class="muted fl-sum">${G.length ? G.length + '× gefördert, zusammen ' + eur(sum) : ''}</span></h3>
      <div class="fl-scroll"><table class="fl-gt"><thead><tr><th>Jahr</th><th>Datum</th><th>Ergebnis</th><th class="num">Betrag</th><th>Zweck / Bedarf</th><th>Gliederung</th><th>Grund der Absage</th><th>Quelle</th><th></th></tr></thead>
        <tbody>${H.map(zeile).join('') || '<tr><td colspan="9" class="muted small">Noch keine Förderung.</td></tr>'}</tbody></table></div>
      <button class="link small" data-act="fl-g-neu">+ Förderung von Hand</button>
      <p class="muted small fl-hw">Förderungen mit bestätigtem Geldeingang und Absagen aus den Bedarfen stehen hier von selbst – Klick auf den Bedarf öffnet ihn.</p>
    </section>
  </main>`;
}
function flSetzen(el) {
  const e = flCur(); if (!e) return false;
  let v = el.value; const t = el.dataset.typ;
  if (t === 'liste') v = strL(v);
  else if (t === 'zahl') v = zahlOderLeer(v);
  else if (t === 'datum') { const d = anyDate(v); if (strV(v) && !d) { toast('„' + v + '“ ist kein Datum (z. B. 05.12.2026).', 'warn'); return false; } v = d || ''; }
  setPath(e, el.dataset.fl, v); changed(); return true;
}
document.addEventListener('input', ev => {
  const el = ev.target; if (UI.view !== 'fdetail' || !el.dataset || !el.dataset.fl || el.tagName === 'SELECT' || el.dataset.typ === 'datum' || el.dataset.typ === 'zahl') return;
  flSetzen(el);
  if (el.dataset.fl === 'name') { const s = $('.fl-sub-n'); if (s) s.textContent = el.value || '(ohne Namen)'; }
});
document.addEventListener('change', ev => {
  const el = ev.target; if (!el.dataset) return;
  if (UI.view !== 'fdetail') return;
  if (el.dataset.flWeg) { const e = flCur(); if (!e) return; e.weg = FL_WEGE.filter(w => w === el.dataset.flWeg ? el.checked : e.weg.includes(w)); changed(); return; }
  if (!el.dataset.fl) return;
  if (flSetzen(el) && (el.tagName === 'SELECT' || el.dataset.typ)) keep(renderNow);   // Auswahl, Datum, Betrag: Darstellung nachziehen
});
document.addEventListener('input', ev => {
  const el = ev.target; if (!el.dataset || el.dataset.ui !== 'flq') return;
  UI.flq = el.value; swap('fl-body', flZeilen(), true); const c = $('#fl-count'); if (c) c.textContent = flGefiltert().length + ' von ' + D.fl.liste.length + ' Förderern';
});
document.addEventListener('keydown', ev => {
  if (UI.view !== 'flist' || ev.defaultPrevented || $('.modal')) return;
  if (ev.key === 'Enter' && document.activeElement && document.activeElement.id === 'flq') { const r = $('#fl-body tr[data-id]'); if (r) { ev.preventDefault(); r.focus(); } return; }
  if (taste(ev, 'l-suche')) { const q = $('#flq'); if (q && document.activeElement !== q) { ev.preventDefault(); q.focus(); q.select(); } return; }
  const tr = document.activeElement && document.activeElement.closest && document.activeElement.closest('#fl-body tr[data-id]');
  if (tr && ev.key === 'Enter') { ev.preventDefault(); flOeffnen(tr.dataset.id); return; }
  // ↓ aus der Suche in die erste Zeile, ↑/↓ von Zeile zu Zeile
  const el = document.activeElement;
  if (ev.key === 'ArrowDown' && el && el.id === 'flq') { const r = $('#fl-body tr[data-id]'); if (r) { ev.preventDefault(); r.focus(); } return; }
  if (tr && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) { const n = ev.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling; ev.preventDefault(); if (n) n.focus(); else if (ev.key === 'ArrowUp') { const q = $('#flq'); if (q) q.focus(); } }
});
// Seite eines Förderers: Esc (nicht in einem Feld) zurück zur Liste; Enter in einem Feld übernimmt
document.addEventListener('keydown', ev => {
  if (UI.view !== 'fdetail' || ev.defaultPrevented) return;
  const el = document.activeElement, imFeld = el && el.closest && el.closest('input, textarea, select');
  if (ev.key === 'Enter' && imFeld && el.tagName === 'INPUT' && el.classList.contains('fl-in')) { ev.preventDefault(); el.blur(); return; }
  if (!taste(ev, 'd-zurueck') || imFeld || $('.menu, .modal, .cal-pop')) return;
  ev.preventDefault(); flZurueck();
}, true);
// Seitenwechsel
function flListe() { closeMenus(); UI.view = 'flist'; flDaten(); renderNow(); scrollTo(0, 0); }
function flOeffnen(id) { if (!flEintrag(id)) return; closeMenus(); const von = UI.view; UI.flId = id; UI.view = 'fdetail'; uebergang(von === 'flist' ? 'vor' : 'zurueck', () => { renderNow(); scrollTo(0, 0); }); }
function flZurueck() { closeMenus(); const id = UI.flId; UI.view = 'flist'; uebergang('zurueck', () => { renderNow(); const r = $(`#fl-body tr[data-id="${CSS.escape(id || '')}"]`); if (r) { r.scrollIntoView({ block: 'center' }); r.focus({ preventScroll: true }); } }); }

// ---------- im Bedarf: Verknüpfung, roter Knopf „In Fördererliste übernehmen?“, neue Kontakte, Grund einer Absage
const flNeueKontakte = (f, e) => f.kontakte.filter(c => (c.n || '').trim() && !e.kontakte.some(k => kkey(k.n) === kkey(c.n)) && !(f.flAus || []).includes(kkey(c.n)));
const flOffen = f => flAktiv() && f.status === 'zugesagt' && f.eingegangen > 0 && !f.flId && !f.flNein;
function flZeile(b, f) {
  if (!flAktiv() || !f.name.trim()) return '';
  const e = flVon(f), a = `data-fid="${f.id}"`;
  if (e) {
    const neu = flNeueKontakte(f, e);
    return `<div class="fl-zeile"><span class="muted small">Fördererliste:</span> <button class="link small" data-act="fl-oeffnen" data-id="${e.id}" title="Eintrag in der Fördererliste öffnen">${esc(e.name)}</button>`
      + `<button class="fl-mini" data-act="fl-loesen" ${a} title="Verknüpfung lösen (gehört nicht zu diesem Eintrag)" aria-label="Verknüpfung lösen">×</button>`
      + (neu.length ? `<button class="fl-rot" data-act="fl-kontakte" ${a}>${neu.length === 1 ? 'Neuer Kontakt' : neu.length + ' neue Kontakte'} – übernehmen?</button>` : '') + '</div>';
  }
  if (flOffen(f)) return `<div class="fl-zeile"><button class="fl-rot" data-act="fl-neu" ${a} title="Geld ist eingegangen – Förderer in die Fördererliste aufnehmen oder einem Eintrag zuordnen">In Fördererliste übernehmen?</button></div>`;
  return `<div class="fl-zeile"><button class="link small muted fl-verkn" data-act="fl-neu" ${a}>mit Fördererliste verknüpfen …</button></div>`;
}
// eingeklappter Förderplan (Finanzierung steht): der rote Knopf je Förderer im Kopf, damit er nicht übersehen wird
const flKopfKnoepfe = b => flAktiv() ? b.foerderer.filter(flOffen).map(f => `<button class="fl-rot" data-act="fl-neu" data-fid="${f.id}" title="Geld ist eingegangen – Förderer in die Fördererliste aufnehmen oder einem Eintrag zuordnen">${esc(short(f.name))} – in Fördererliste übernehmen?</button>`).join('') : '';
const flKurz = (t, n) => t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
// Grund einer Absage: an der Stelle, wo sonst „Geldeingang bestätigen“ steht
function grundBlock(f) {
  const a = `data-fid="${f.id}"`;
  return f.grund.trim() ? `<span class="fl-grund" title="${esc(f.grund)}"><span class="muted">Grund:</span> ${esc(flKurz(f.grund.replace(/\s*\n+\s*/g, ' '), 60))}<button class="pen" data-act="fl-grund" ${a} title="Grund ändern" aria-label="Grund der Absage ändern">${ICON_PEN}</button></span>`
    : `<button class="link geld-link fl-grund-link" data-act="fl-grund" ${a}>→ Grund der Absage eintragen</button>`;
}
async function flGrundFragen(f) {
  const t = await textFrage('Warum abgelehnt?', 'Grund der Absage von „' + (f.name || 'Förderer') + '“ – hilft bei späteren Recherchen', f.grund, 'z. B. fördert keine Fahrzeuge, Budget für dieses Jahr ausgeschöpft', 'Speichern');
  if (t == null) return; f.grund = t.trim(); changed(); keep(renderNow);
}
// Maske: neu anlegen oder einem Eintrag zuordnen; Kontakte zum Anhaken; „Nicht in die Liste“ fragt nicht mehr
const flArtRaten = (f, name) => /stiftung/i.test(name) ? 'Stiftung' : /sparkasse/i.test(name) ? 'Sparkasse' : /volksbank|raiffeisen|\beg\b/i.test(name) ? 'Volks- und Raiffeisenbank' : /bank/i.test(name) ? 'Bank' : /lotterie|aktion mensch/i.test(name) ? 'Soziallotterie' : /stift/i.test(f.art || '') ? 'Stiftung' : '';
// ähnliche Einträge: gemeinsame ganze Wörter im Namen (ohne allgemeine wie „Stiftung“, „Sparkasse“, „eG“), die meisten zuerst
const FL_ALLG = /^(stiftung|sparkasse|volksbank|raiffeisenbank|bank|eg|ev|e\.v|gmbh|ggmbh|ag|der|die|das|und|für|von|stadt|kreis|gemeinnützige)$/;
const flWorte = t => kkey(t).split(/[\s,.\-–/()]+/).filter(w => w.length > 2 && !FL_ALLG.test(w));
function flAehnlich(name) {
  const W = new Set(flWorte(name)); if (!W.size) return [];
  return D.fl.liste.map(e => ({ e, n: flWorte(e.name).filter(w => W.has(w)).length })).filter(x => x.n).sort((a, c) => c.n - a.n).map(x => x.e).slice(0, 6);
}
function flKontaktWahl(L, alleAn) {
  return L.map(c => { const cb = h('input', { type: 'checkbox', checked: alleAn }), as = h('select', { 'aria-label': 'Anschreiben' }, h('option', { value: '' }, 'anschreiben: offen'), h('option', { value: 'ja' }, 'anschreiben: ja'), h('option', { value: 'nein' }, 'anschreiben: nein'));
    return { c, cb, as, el: h('div', { class: 'fl-kw' }, h('label', { class: 'check' }, cb, ' ', h('b', {}, c.n), h('span', { class: 'muted small' }, [c.rolle, c.mail, c.tel].filter(Boolean).map(x => ' · ' + x).join(''))), as) }; });
}
const flKontaktAus = (x, gl) => Object.assign(flKontaktLeer(), { n: x.c.n.trim(), pos: (x.c.rolle || '').trim(), mail: (x.c.mail || '').trim(), tel: (x.c.tel || '').trim(), gl: gl ? [gl] : [], anschreiben: x.as.value });
async function flUebernehmen(b, f) {
  const aehnlich = flAehnlich(f.name), gl = b.gliederung && b.gliederung !== DIO ? b.gliederung : '';
  let modus = 'neu';
  const name = h('input', { type: 'text', value: f.name.trim(), 'aria-label': 'Name' }), art = h('select', { 'aria-label': 'Art' }, h('option', { value: '' }, 'Art wählen'), ...FL_ARTEN.map(a => h('option', { selected: a === flArtRaten(f, f.name) }, a)));
  const glIn = h('input', { type: 'text', value: gl, placeholder: 'Gliederungen, mit Komma', 'aria-label': 'Gliederungen' });
  const wahl = h('select', { 'aria-label': 'Vorhandener Förderer' }, ...(aehnlich.length ? aehnlich : []).map(e => h('option', { value: e.id }, e.name)), aehnlich.length ? h('option', { disabled: true }, '──────────') : null,
    ...D.fl.liste.filter(e => !aehnlich.includes(e)).slice().sort((a, c) => a.name.localeCompare(c.name, 'de')).map(e => h('option', { value: e.id }, e.name)));
  const K = flKontaktWahl(f.kontakte.filter(c => (c.n || '').trim()), true);
  const neuBox = h('div', { class: 'fl-m-neu' }, h('label', { class: 'tf-l' }, 'Name'), name, h('div', { class: 'fl-m-zwei' }, h('div', {}, h('label', { class: 'tf-l' }, 'Art'), art), h('div', {}, h('label', { class: 'tf-l' }, 'Gliederungen'), glIn)));
  const altBox = h('div', { class: 'fl-m-alt', hidden: true }, h('label', { class: 'tf-l' }, 'Zu diesem Eintrag gehört der Förderer'), wahl);
  const r = (v, t, an) => h('label', { class: 'check fl-m-r' }, h('input', { type: 'radio', name: 'fl-m', checked: an, onchange: () => { modus = v; neuBox.hidden = v !== 'neu'; altBox.hidden = v !== 'alt'; } }), ' ' + t);
  if (aehnlich.length) { modus = 'alt'; neuBox.hidden = true; altBox.hidden = false; }
  const ok = await modal('In die Fördererliste übernehmen', h('div', { class: 'tf fl-maske' },
    h('p', { class: 'muted small' }, '„' + f.name.trim() + '“ hat für „' + (b.titel || 'Bedarf') + '“ ' + eur(f.eingegangen || foeAmt(f)) + ' gegeben. Die Förderung erscheint danach von selbst in der Fördererliste.'),
    h('div', { class: 'fl-m-rs' }, r('neu', 'neu anlegen', !aehnlich.length), r('alt', 'gehört zu einem vorhandenen Eintrag' + (aehnlich.length ? ' (ähnlicher Name gefunden)' : ''), !!aehnlich.length)), neuBox, altBox,
    K.length ? h('div', { class: 'fl-m-k' }, h('label', { class: 'tf-l' }, 'Kontakte übernehmen'), ...K.map(x => x.el)) : null),
    [['Nicht in die Liste', 'nein'], ['Abbrechen', null], ['Übernehmen', 'ja', 'primary']], { wide: true });
  if (ok === 'nein') { f.flNein = true; changed(); keep(renderNow); toast('„' + f.name.trim() + '“ kommt nicht in die Fördererliste.', 'ok'); return; }
  if (ok !== 'ja') return;
  let e;
  if (modus === 'alt') e = flEintrag(wahl.value);
  else { if (!name.value.trim()) { toast('Bitte einen Namen eintragen.', 'warn'); return; } e = Object.assign(flLeer(), { id: flNeueId(), name: name.value.trim(), art: art.value, gl: strL(glIn.value), web: (f.web || '').trim(), weg: FL_WEGE.filter(w => norm(f.weg || '').includes(norm(w).replace('per ', ''))) }); D.fl.liste.push(e); }
  if (!e) return;
  for (const x of K) if (x.cb.checked && !e.kontakte.some(k => kkey(k.n) === kkey(x.c.n))) e.kontakte.push(flKontaktAus(x, gl));
  f.flId = e.id; f.flAus = uniq([...(f.flAus || []), ...K.filter(x => !x.cb.checked).map(x => kkey(x.c.n))]);
  flZuKartei(); changed(); keep(renderNow); toast('„' + e.name + '“ steht in der Fördererliste', 'ok');
}
async function flKontakteUebernehmen(b, f) {
  const e = flEintrag(f.flId); if (!e) return;
  const K = flKontaktWahl(flNeueKontakte(f, e), true), gl = b.gliederung && b.gliederung !== DIO ? b.gliederung : '';
  const ok = await modal('Kontakte in die Fördererliste übernehmen?', h('div', { class: 'tf fl-maske' }, h('p', { class: 'muted small' }, 'Bei „' + f.name.trim() + '“ stehen im Bedarf Kontakte, die in der Fördererliste („' + e.name + '“) noch fehlen.'), ...K.map(x => x.el)),
    [['Nicht übernehmen', 'nein'], ['Abbrechen', null], ['Übernehmen', 'ja', 'primary']], { wide: true });
  if (!ok) return;
  for (const x of K) { if (ok === 'ja' && x.cb.checked) e.kontakte.push(flKontaktAus(x, gl)); else f.flAus = uniq([...(f.flAus || []), kkey(x.c.n)]); }
  flZuKartei(); changed(); keep(renderNow);
}
// Archivieren: Geldeingänge, die noch nicht in der Fördererliste sind? → true: weiter archivieren
async function flArchivPruefen(b) {
  const L = flAktiv() ? b.foerderer.filter(flOffen) : []; if (!L.length) return true;
  const w = await modal('Noch nicht in der Fördererliste', h('p', {}, (L.length === 1 ? 'Von „' + L[0].name.trim() + '“ ist Geld eingegangen, der Förderer steht aber noch nicht' : 'Von ' + L.map(f => '„' + f.name.trim() + '“').join(', ') + ' ist Geld eingegangen, sie stehen aber noch nicht') + ' in der Fördererliste. Jetzt übernehmen?'),
    [['Abbrechen', null], ['Ohne übernehmen archivieren', 'weiter'], ['Übernehmen …', 'jetzt', 'primary']]);
  if (w === 'weiter') return true;
  if (w !== 'jetzt') return false;
  for (const f of L) await flUebernehmen(b, f);
  return true;
}

// ---------- Klicks (aus act(), 09_main.js): true = erledigt
async function flAct(k, a) {
  const b = cur(), e = flCur(), f = b && a.dataset.fid ? b.foerderer.find(x => x.id === a.dataset.fid) : null;
  const neu = () => { changed(); keep(renderNow); };
  switch (k) {
    case 'flist': flListe(); return true;
    case 'fl-oeffnen': flOeffnen(a.dataset.id); return true;
    case 'fl-zurueck': flZurueck(); return true;
    case 'fl-excel-menu': if ($('.menu')) closeMenus(); else flExcelMenu(a); return true;
    case 'fl-neu-leer': { const x = Object.assign(flLeer(), { id: flNeueId() }); D.fl.liste.push(x); changed(); flOeffnen(x.id); setTimeout(() => { const n = $('.fl-name'); if (n) n.focus(); }, 60); return true; }
    case 'fl-weg': {
      if (!e || !await confirmBox('Förderer löschen?', '„' + (e.name || 'Förderer') + '“ wird mit Kontakten und Förderungen aus der Fördererliste gelöscht. In den Bedarfen bleibt er stehen, nur ohne Verknüpfung.', 'Löschen')) return true;
      D.fl.liste = D.fl.liste.filter(x => x !== e); for (const y of D.bedarfe) for (const g of y.foerderer) if (g.flId === e.id) g.flId = '';
      flZuKartei(); changed(); UI.view = 'flist'; renderNow(); return true;
    }
    case 'fl-k-neu': if (e) { e.kontakte.push(flKontaktLeer()); neu(); const L = $$('.fl-kt tbody tr'); const i = L[L.length - 1] && L[L.length - 1].querySelector('input'); if (i) i.focus(); } return true;
    case 'fl-k-weg': if (e) { e.kontakte.splice(+a.dataset.i, 1); neu(); } return true;
    case 'fl-a-neu': if (e) { e.ansprache.push({ gl: '', art: 'über die Gliederung', hinweis: '' }); neu(); const L = $$('.fl-a input'); if (L.length) L[L.length - 3].focus(); } return true;
    case 'fl-a-weg': if (e) { e.ansprache.splice(+a.dataset.i, 1); neu(); } return true;
    case 'fl-g-neu': if (e) { e.foerderungen.push(Object.assign(flFoerderungLeer(), { jahr: today().slice(0, 4), quelle: 'von Hand' })); neu(); } return true;
    case 'fl-g-weg': if (e) { e.foerderungen.splice(+a.dataset.i, 1); neu(); } return true;
    case 'fl-neu': if (b && f) await flUebernehmen(b, f); return true;
    case 'fl-kontakte': if (b && f) await flKontakteUebernehmen(b, f); return true;
    case 'fl-grund': if (f) await flGrundFragen(f); return true;
    case 'fl-loesen': if (f) { f.flId = ''; f.flNein = true; changed(); keep(renderNow); toast('Verknüpfung gelöst – über „mit Fördererliste verknüpfen …“ neu zuordnen.', 'ok'); } return true;
  }
  return false;
}
