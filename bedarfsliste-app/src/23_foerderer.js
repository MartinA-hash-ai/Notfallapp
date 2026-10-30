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
const FL_STATUS = ['aktiv', 'ruht', 'aufgelöst', 'fusioniert'], FL_WEGE = ['per E-Mail', 'Portal'], FL_ANSPRACHE = ['frei', 'über die Gliederung', 'nicht anschreiben'];
// Antragsweg (ab 0.92 nur „per E-Mail“ oder „Portal“): „per Mail“ wird zu „per E-Mail“; „direkt“ aus der alten Kartei bleibt stehen, bis man wählt
const flWegNorm = w => /mail/i.test(w) ? 'per E-Mail' : /portal/i.test(w) ? 'Portal' : /^direkt$/i.test(strV(w)) ? 'direkt' : '';
// Text mit Formatierungszeichen (*fett* …) für schlichte Stellen (Übersicht): Zeichen weg, Zeilen mit „ · “
const flPlain = t => String(t || '').replace(/^\s*(?:[•*-]|\d+\.)\s+/gm, '').replace(/(^|[\s(„>])[*_~+](?=\S)/g, '$1').replace(/(\S)[*_~+](?=$|[\s.,;:!?)“<])/g, '$1').replace(/\s*\n+\s*/g, ' · ').trim();
const flLeer = () => ({ id: '', name: '', art: '', status: 'aktiv', gl: [], weg: [], anschrift: '', web: '', schwer: '', hoehe: '', fristen: '', richtlinien: '', recherche: '', notiz: '', bew: { chance: 0, dauer: 0, summe: 0 }, ansprache: [], kontakte: [], foerderungen: [] });
// Einschätzung (ab 0.89): je drei Stufen, 1 = ungünstig … 3 = günstig (im Netz außen = besser; bei der Dauer heißt außen „geht schnell“); 0 = nicht von Hand gesetzt
const FL_BEW = [
  { k: 'chance', t: 'Erfolgschance', kurz: 'Chance', st: ['gering', 'mittel', 'hoch'], bed: ['gering (bis 50 %)', 'mittel (50 bis 75 %)', 'sehr gut (über 75 %)'] },
  { k: 'dauer', t: 'Dauer', kurz: 'Dauer', st: ['lange', 'mittel', 'schnell'], bed: ['über 6 Monate', '1–6 Monate', 'unter 1 Monat'] },
  { k: 'summe', t: 'Fördersumme', kurz: 'Summe', st: ['gering', 'mittel', 'hoch'], bed: ['unter 5.000 €', '5.000–10.000 €', 'über 10.000 €'] },
];
const flKontaktLeer = () => ({ id: uid('k'), n: '', pos: '', mail: '', tel: '', gl: [], anschreiben: '', notiz: '' });
const flFoerderungLeer = () => ({ id: uid('g'), jahr: '', datum: '', ergebnis: 'gefördert', betrag: null, zweck: '', gl: [], grund: '', quelle: '' });
const strL = v => (Array.isArray(v) ? v : String(v ?? '').split(/\s*,\s*/)).map(x => String(x ?? '').trim()).filter(Boolean);
const strV = v => String(v ?? '').trim();
// E-Mail aus Excel-Links: „mailto:“, codiert („Name%20%3cadresse%3e“) oder „Name <adresse>“ → nur die Adresse
function mailRein(v) {
  let t = strV(v); if (!t) return '';
  if (/%[0-9a-f]{2}/i.test(t)) try { t = decodeURIComponent(t); } catch (e) { /* bleibt, wie es ist */ }
  t = t.replace(/^mailto:/i, '').split('?')[0];
  const m = t.match(/[^\s<>"'(),;:]+@[^\s<>"'(),;:]+\.[a-z]{2,}/i);
  return m ? m[0] : t.trim();
}
function flNorm(x) {
  const o = isObj(x) ? x : {}, ids = new Set();
  const L = (Array.isArray(o.liste) ? o.liste : []).filter(isObj).map(e0 => {
    const e = Object.assign(flLeer(), e0);
    for (const k of ['id', 'name', 'art', 'anschrift', 'web', 'schwer', 'hoehe', 'fristen', 'richtlinien', 'notiz']) e[k] = strV(e[k]);
    e.status = FL_STATUS.includes(e.status) ? e.status : 'aktiv'; e.recherche = validIso(e.recherche) ? e.recherche : '';
    e.gl = strL(e.gl); e.weg = uniq(strL(e.weg).map(flWegNorm));
    const bw = isObj(e.bew) ? e.bew : {}; e.bew = Object.fromEntries(FL_BEW.map(x => [x.k, [1, 2, 3].includes(+bw[x.k]) ? +bw[x.k] : 0]));
    e.ansprache = (Array.isArray(e.ansprache) ? e.ansprache : []).filter(isObj).map(a => ({ gl: strV(a.gl), art: FL_ANSPRACHE.includes(a.art) ? a.art : 'frei', hinweis: strV(a.hinweis) }));
    e.kontakte = (Array.isArray(e.kontakte) ? e.kontakte : []).filter(isObj).map(k => Object.assign(flKontaktLeer(), k, { mail: mailRein(k.mail), gl: strL(k.gl), anschreiben: ['ja', 'nein'].includes(k.anschreiben) ? k.anschreiben : '' }));
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
  'Förderer': ['ID', 'Name', 'Art', 'Status', 'Gliederungen', 'Antragsweg', 'Anschrift', 'Homepage / Portal', 'Förderschwerpunkte', 'Förderhöhe', 'Fristen', 'Förderrichtlinien (Link)', 'Recherche-Stand', 'Notizen', 'Erfolgschance', 'Dauer', 'Fördersumme'],
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
    anschrift: strV(r.anschrift), web: strV(r['homepage / portal']), schwer: strV(r['förderschwerpunkte']), hoehe: strV(r['förderhöhe']), fristen: strV(r.fristen), richtlinien: strV(r['förderrichtlinien (link)']), recherche: xlDatum(r['recherche-stand']), notiz: strV(r.notizen),
    bew: Object.fromEntries(FL_BEW.map(x => [x.k, x.st.findIndex(t => norm(r[norm(x.t)]).includes(t)) + 1])) }));
  const zu = r => L.find(e => e.id === strV(r['förderer-id'])) || L.find(e => kkey(e.name) === kkey(r['förderer']));
  for (const r of tab('Ansprache')) { const e = zu(r); if (e && strV(r.gliederung)) e.ansprache.push({ gl: strV(r.gliederung), art: strV(r.ansprache), hinweis: strV(r.hinweis) }); }
  for (const r of tab('Kontakte')) { const e = zu(r); if (e && (strV(r.name) || strV(r['e-mail']) || strV(r.telefon))) e.kontakte.push(Object.assign(flKontaktLeer(), { n: strV(r.name), pos: strV(r.position), mail: mailRein(r['e-mail']), tel: cellStr(r.telefon), gl: strL(r.gliederungen), anschreiben: norm(r.anschreiben), notiz: strV(r.notiz) })); }
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
    'Förderer': L.map(e => [e.id, e.name, e.art, e.status, j(e.gl), j(e.weg), e.anschrift, e.web, e.schwer, e.hoehe, e.fristen, e.richtlinien, e.recherche, e.notiz, ...FL_BEW.map(x => e.bew[x.k] ? x.st[e.bew[x.k] - 1] : '')]),
    'Ansprache': L.flatMap(e => e.ansprache.map(a => [e.id, e.name, a.gl, a.art, a.hinweis])),
    'Kontakte': L.flatMap(e => e.kontakte.map(k => [e.id, e.name, k.n, k.pos, k.mail, k.tel, j(k.gl), k.anschreiben, k.notiz])),
    'Förderungen': L.flatMap(e => flHistorie(e).map(x => [e.id, e.name, +x.jahr || x.jahr || '', x.datum || '', x.ergebnis, x.betrag, x.zweck, j(x.gl || []), x.grund || '', x.quelle, x.bedarfId || ''])),
  };
}
function flBlob(Z = flExportZeilen()) {
  const kopf = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, z = { border: 'thin', v: 'top', wrap: true };
  const breiten = { 'Förderer': [7, 34, 18, 11, 26, 16, 30, 34, 34, 16, 18, 26, 13, 40, 14, 11, 13], 'Ansprache': [11, 30, 22, 22, 60], 'Kontakte': [11, 30, 26, 24, 34, 18, 24, 12, 30], 'Förderungen': [11, 30, 7, 11, 11, 11, 40, 24, 30, 16, 12] };
  const datum = { 'Förderer': [12], 'Förderungen': [3] }, txt = { 'Kontakte': [5] }, listen = { 'Förderer': [[2, FL_ARTEN], [3, FL_STATUS], ...FL_BEW.map((x, i) => [14 + i, x.st])], 'Ansprache': [[3, FL_ANSPRACHE]], 'Kontakte': [[7, ['ja', 'nein']]], 'Förderungen': [[4, ['gefördert', 'abgelehnt']]] };
  const sheets = Object.keys(FL_SP).map(name => {
    const R = Z[name], n = R.length + 1, last = colName(FL_SP[name].length - 1);
    return { name, cols: breiten[name], freeze: 'C2', filter: 'A1:' + last + n, heights: { 0: 30 },
      rows: [FL_SP[name].map(v => ({ v, st: kopf })), ...R.map(r => r.map((v, i) => ({ v: v == null ? '' : v, st: z, t: (datum[name] || []).includes(i) && validIso(v) ? 'd' : (txt[name] || []).includes(i) ? 'txt' : undefined })))],
      lists: (listen[name] || []).map(([i, items]) => ({ ref: colName(i) + '2:' + colName(i) + (n + 200), items })) };
  });
  sheets.push({ name: 'Anleitung', cols: [120], grid: false, rows: [[{ v: 'Fördererliste der Bedarfsliste', st: { b: true, sz: 15 } }], [],
    ...['Diese Datei schreibt die Bedarfsliste nach jedem Speichern neu – gepflegt wird die Fördererliste im Programm (Reiter „Fördererliste“). Änderungen hier gehen beim nächsten Speichern verloren.',
      'Blatt „Förderer“: je Förderer eine Zeile; die ID (F001 …) verbindet die Blätter. „Ansprache“: je Förderer und Gliederung frei / über die Gliederung / nicht anschreiben.',
      'Erfolgschance, Dauer, Fördersumme: von Hand eingeschätzt (gering/mittel/hoch, bei der Dauer lange/mittel/schnell); leer = das Programm schätzt aus den Förderungen und Absagen.',
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

// ---------- Einschätzung: von Hand gesetzt oder aus den Daten geschätzt – Erfolgschance aus Förderungen und Absagen (ab drei Entscheidungen),
// Fördersumme aus den üblichen Beträgen, Dauer aus Antrag und Antwort in den Bedarfen
const mitte = L => { const s = L.slice().sort((a, c) => a - c), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const dauerText = d => d < 1.5 ? 'einem Tag' : d < 14 ? Math.round(d) + ' Tagen' : d < 61 ? Math.round(d / 7) + ' Wochen' : Math.round(d / 30.4) + ' Monaten';
function flBewAuto(e) {
  const H = flHistorie(e), G = H.filter(x => x.ergebnis === 'gefördert'), n = H.length, R = {};
  if (n >= 3) { const p = G.length / n; R.chance = { v: p > .75 ? 3 : p > .5 ? 2 : 1, grund: G.length + ' von ' + n + ' Anträgen bewilligt' }; }
  const B = G.map(x => +x.betrag).filter(x => x > 0);
  if (B.length) { const m = mitte(B); R.summe = { v: m >= 10000 ? 3 : m >= 5000 ? 2 : 1, grund: 'üblich rund ' + eur(Math.round(m)) + ' (' + B.length + (B.length === 1 ? ' Förderung)' : ' Förderungen)') }; }
  const T = D.bedarfe.flatMap(b => b.foerderer.filter(f => f.flId === e.id && (f.status === 'zugesagt' || f.status === 'abgelehnt') && validIso(f.beantragtAm) && validIso(f.entscheidungAm))
    .map(f => (Date.parse(f.entscheidungAm) - Date.parse(f.beantragtAm)) / 864e5)).filter(d => d >= 0);
  if (T.length) { const d = mitte(T); R.dauer = { v: d < 30 ? 3 : d < 183 ? 2 : 1, grund: 'Antwort nach ' + dauerText(d) + ' (' + T.length + (T.length === 1 ? ' Antrag)' : ' Anträge)') }; }
  return R;
}
function flBew(e) {
  const A = flBewAuto(e);
  return Object.fromEntries(FL_BEW.map(x => [x.k, e.bew[x.k] ? { v: e.bew[x.k], hand: true, grund: 'von Hand eingeschätzt' } : A[x.k] ? Object.assign({ hand: false }, A[x.k]) : { v: 0, hand: false, grund: '' }]));
}
const flBewText = (B, x) => x.t + ': ' + (B[x.k].v ? x.st[B[x.k].v - 1] + (B[x.k].hand ? '' : ' (geschätzt: ' + B[x.k].grund + ')') : 'noch nicht eingeschätzt');
// Netz mit drei Achsen: oben Erfolgschance, rechts unten Fördersumme, links unten Dauer; je weiter außen, desto günstiger.
// Groß (Seite eines Förderers): die Ecken lassen sich ziehen (auch mit den Pfeiltasten), unter jeder Achse steht, was der Wert bedeutet;
// ganz zur Mitte gezogen oder doppelt geklickt: wieder aus den Daten geschätzt
const FN_KLEIN = { W: 118, H: 76, R: 28, cx: 59, cy: 40, y0: 0 }, FN_GROSS = { W: 300, H: 228, R: 78, cx: 150, cy: 118, y0: -16 };
const FN_WI = { chance: -90, summe: 30, dauer: 150 };
const fnPt = (G, k, r) => { const a = FN_WI[k] * Math.PI / 180; return [G.cx + r * Math.cos(a), G.cy + r * Math.sin(a)]; };
const fnP = (G, k, r) => fnPt(G, k, r).map(n => n.toFixed(1)).join(',');
const fnPoly = (G, V) => FL_BEW.map(x => fnP(G, x.k, G.R * (V[x.k] || 0) / 3)).join(' ');
const fnGriffR = (G, v) => v ? G.R * v / 3 : G.R * .14;
const fnWert = (x, b) => b.v ? x.bed[b.v - 1] : 'noch offen';
const FN_TEXT = { chance: { x: 150, y: -2 }, dauer: { x: 82, y: 180 }, summe: { x: 218, y: 180 } };   // Name, darunter Bedeutung (+14) und „geschätzt“ (+27)
function flNetz(e, gross) {
  const B = flBew(e), G = gross ? FN_GROSS : FN_KLEIN, V = Object.fromEntries(FL_BEW.map(x => [x.k, B[x.k].v]));
  const gitter = [1, 2, 3].map(i => `<polygon class="fn-g" points="${FL_BEW.map(x => fnP(G, x.k, G.R * i / 3)).join(' ')}"/>`).join('')
    + FL_BEW.map(x => { const [px, py] = fnPt(G, x.k, G.R); return `<line class="fn-g" x1="${G.cx}" y1="${G.cy}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}"/>`; }).join('');
  const hat = FL_BEW.some(x => B[x.k].v), nurGeschaetzt = FL_BEW.every(x => !B[x.k].v || !B[x.k].hand);
  const flaeche = `<polygon class="fn-w${nurGeschaetzt ? ' geschaetzt' : ''}${hat ? '' : ' leer'}" points="${fnPoly(G, V)}"/>`;
  if (!gross) {
    const punkte = FL_BEW.filter(x => B[x.k].v).map(x => { const [px, py] = fnPt(G, x.k, G.R * B[x.k].v / 3); return `<circle class="fn-p${B[x.k].hand ? '' : ' auto'}" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.3"/>`; }).join('');
    const lab = x => { const [px, py] = fnPt(G, x.k, G.R); return `<text class="fn-l${B[x.k].v ? '' : ' leer'}" x="${px.toFixed(1)}" y="${(py + (x.k === 'chance' ? -5 : 11)).toFixed(1)}" text-anchor="middle">${x.kurz}</text>`; };
    return `<span class="fl-netz" data-tip="${esc(FL_BEW.map(x => flBewText(B, x)).join(' · '))}"><svg viewBox="0 0 ${G.W} ${G.H}" width="${G.W}" height="${G.H}" role="img" aria-label="${esc(FL_BEW.map(x => flBewText(B, x)).join(', '))}">${gitter}${flaeche}${punkte}${FL_BEW.map(lab).join('')}</svg></span>`;
  }
  const A = flBewAuto(e);
  const griff = x => { const b = B[x.k], [px, py] = fnPt(G, x.k, fnGriffR(G, b.v));
    return `<g class="fn-griff ${b.hand ? 'hand' : b.v ? 'auto' : 'offen'}" data-k="${x.k}" transform="translate(${px.toFixed(1)} ${py.toFixed(1)})" tabindex="0" role="slider" aria-label="${x.t}" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${b.hand ? b.v : 0}" aria-valuetext="${esc(fnWert(x, b))}">`
      + `<title>${esc(x.t + ': ' + fnWert(x, b) + (b.hand ? ' – von Hand' : b.v ? ' – geschätzt: ' + b.grund : '') + '. Ziehen zum Einschätzen, Doppelklick: wieder aus den Daten')}</title><circle class="fn-hit" r="15"/><circle class="fn-h" r="5.5"/></g>`; };
  // Beschriftung: Name, darunter die Bedeutung der Stufe und ggf. „geschätzt“
  const texte = x => { const b = B[x.k], L = FN_TEXT[x.k];
    return `<text class="fn-l" x="${L.x}" y="${L.y}" text-anchor="middle">${x.t}</text>`
      + `<text class="fn-v${b.hand ? '' : b.v ? ' geschaetzt' : ' leer'}" data-k="${x.k}" x="${L.x}" y="${L.y + 14}" text-anchor="middle"><title>${esc(b.v && !b.hand ? 'geschätzt: ' + b.grund : '')}</title>${esc(fnWert(x, b))}</text>`
      + `<text class="fn-s" data-k="${x.k}" x="${L.x}" y="${L.y + 27}" text-anchor="middle">${b.v && !b.hand ? 'geschätzt' : ''}</text>`; };
  return `<span class="fl-netz gross zieh"><svg viewBox="0 ${G.y0} ${G.W} ${G.H}" width="100%" role="group" aria-label="Einschätzung"
    data-hand="${esc(JSON.stringify(e.bew))}" data-auto="${esc(JSON.stringify(Object.fromEntries(FL_BEW.map(x => [x.k, A[x.k] ? A[x.k].v : 0]))))}">${gitter}${flaeche}${FL_BEW.map(texte).join('')}${FL_BEW.map(griff).join('')}</svg></span>`;
}
// Ziehen: Stufe aus der Lage des Zeigers entlang der Achse (nahe der Mitte: 0 = wieder aus den Daten); beim Loslassen übernehmen
let FN_ZIEH = null;
function fnStufe(svg, k, ev) {
  const G = FN_GROSS, p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svg.getScreenCTM().inverse()), a = FN_WI[k] * Math.PI / 180;
  const r = (p.x - G.cx) * Math.cos(a) + (p.y - G.cy) * Math.sin(a);
  return r < G.R / 6 ? 0 : Math.max(1, Math.min(3, Math.round(r / (G.R / 3))));
}
function fnZeigen(svg, k, v) {                                                  // Vorschau während des Ziehens, ohne neu zu zeichnen
  const G = FN_GROSS, hand = JSON.parse(svg.dataset.hand), auto = JSON.parse(svg.dataset.auto), x = FL_BEW.find(y => y.k === k);
  hand[k] = v; const V = Object.fromEntries(FL_BEW.map(y => [y.k, hand[y.k] || auto[y.k] || 0])), b = { v: V[k], hand: !!v };
  svg.querySelector('.fn-w').setAttribute('points', fnPoly(G, V));
  const [px, py] = fnPt(G, k, fnGriffR(G, V[k])), g = svg.querySelector(`.fn-griff[data-k="${k}"]`); g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
  g.classList.toggle('hand', !!v); g.classList.toggle('auto', !v && !!V[k]); g.classList.toggle('offen', !V[k]);
  const t = svg.querySelector(`.fn-v[data-k="${k}"]`); t.textContent = fnWert(x, b); t.setAttribute('class', 'fn-v' + (b.hand ? '' : b.v ? ' geschaetzt' : ' leer'));
  svg.querySelector(`.fn-s[data-k="${k}"]`).textContent = b.v && !b.hand ? 'geschätzt' : '';
}
function fnSetzen(k, v) { const e = flCur(); if (!e || !(k in e.bew) || e.bew[k] === v) return; e.bew[k] = v; changed(); keep(renderNow); const g = $(`.fl-netz.zieh .fn-griff[data-k="${k}"]`); if (g) g.focus({ preventScroll: true }); }
document.addEventListener('pointerdown', ev => {
  const g = ev.target.closest && ev.target.closest('.fl-netz.zieh .fn-griff'); if (!g || ev.button !== 0) return;
  ev.preventDefault(); g.focus({ preventScroll: true }); g.setPointerCapture(ev.pointerId);
  FN_ZIEH = { g, k: g.dataset.k, svg: g.ownerSVGElement, v: null }; g.classList.add('aktiv'); FN_ZIEH.svg.parentNode.classList.add('zieht');
});
document.addEventListener('pointermove', ev => { if (!FN_ZIEH) return; const v = fnStufe(FN_ZIEH.svg, FN_ZIEH.k, ev); if (v !== FN_ZIEH.v) { FN_ZIEH.v = v; fnZeigen(FN_ZIEH.svg, FN_ZIEH.k, v); } });
const fnLos = () => { if (!FN_ZIEH) return; const z = FN_ZIEH; FN_ZIEH = null; z.g.classList.remove('aktiv'); z.svg.parentNode.classList.remove('zieht'); if (z.v != null) fnSetzen(z.k, z.v); };
document.addEventListener('pointerup', fnLos); document.addEventListener('pointercancel', fnLos);
document.addEventListener('dblclick', ev => { const g = ev.target.closest && ev.target.closest('.fl-netz.zieh .fn-griff'); if (g) fnSetzen(g.dataset.k, 0); });
document.addEventListener('keydown', ev => {
  const g = ev.target.closest && ev.target.closest('.fl-netz.zieh .fn-griff'); if (!g) return;
  const e = flCur(), k = g.dataset.k; if (!e) return;
  const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[ev.key];
  if (d) { ev.preventDefault(); ev.stopPropagation(); fnSetzen(k, Math.max(0, Math.min(3, (e.bew[k] || (flBewAuto(e)[k] || {}).v || 0) + d))); }   // vom angezeigten Wert aus, auch wenn er geschätzt ist
  else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); fnSetzen(k, 0); }
}, true);
// Fristen dieses Jahres aus dem Text („31.03. und 30.09.“, „bis 15.10.2026“): Tage ohne Jahr gelten jedes Jahr
function flFristenJahr(t, jahr = +today().slice(0, 4)) {
  const L = [], re = /(?<![\d.])(\d{1,2})\.(\d{1,2})\.(?:(\d{4}|\d{2})(?!\d))?/g; let m;
  while ((m = re.exec(t || ''))) { const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(jahr), iso = y + '-' + z2(m[2]) + '-' + z2(m[1]); if (validIso(iso) && +y === jahr && !L.includes(iso)) L.push(iso); }
  return L.sort();
}
function flFristenHtml(e) {
  const L = flFristenJahr(e.fristen), heute = today();
  if (!L.length) return e.fristen ? `<span class="fl-ft" title="${esc(flPlain(e.fristen))}">${esc(flKurz(flPlain(e.fristen), 46))}</span>` : '<span class="muted">–</span>';
  const n = L.find(d => d >= heute);
  return `<span class="fl-fds" title="${esc(flPlain(e.fristen))}">` + L.map(d => { const t = Math.round((Date.parse(d) - Date.parse(heute)) / 864e5);
    return `<span class="fl-fd${d < heute ? ' vorbei' : ''}${d === n ? ' naechste' : ''}${d === n && t <= 21 ? ' bald' : ''}" title="${d < heute ? 'vorbei' : t === 0 ? 'heute' : 'in ' + t + (t === 1 ? ' Tag' : ' Tagen')}">${fmtDate(d).slice(0, 6)}</span>`; }).join('') + '</span>';
}

// ---------- Seite „Fördererliste“: weißer Kasten wie die Bedarfsliste. Einstieg ist meist eine Gliederung, die nach Fördermöglichkeiten fragt:
// Filter oder Suche nach der Gliederung (zählt auch Förderer für „alle“), je Förderer Gebiet, Zweck, Fristen dieses Jahres, Einschätzung, Ansprechperson
const flDaten = () => D.fl;
const flInGl = (e, g) => e.gl.some(x => norm(x) === g || /^alle$/i.test(x));
function flGefiltert() {
  const q = norm(UI.flq), gl = norm(UI.flGl || ''), L = flDaten().liste;
  const glBekannt = new Set([...L.flatMap(e => e.gl), ...D.bedarfe.map(b => b.gliederung)].map(norm).filter(g => g && g !== 'alle'));
  return L.filter(e => (!gl || flInGl(e, gl)) && (!q || (glBekannt.has(q) && flInGl(e, q))
    || [e.name, e.art, e.notiz, e.schwer, ...e.gl, ...e.kontakte.map(k => k.n + ' ' + k.pos)].some(t => norm(t).includes(q))))
    .sort((a, c) => a.name.localeCompare(c.name, 'de'));
}
const ICON_JA = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_NEIN = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
// Ansprechperson für die Übersicht: wer angeschrieben werden darf (für die gewählte Gliederung), sonst wer nicht ausgeschlossen ist
function flKontaktHaupt(e) {
  const gl = norm(UI.flGl || ''), passt = k => !gl || !k.gl.length || k.gl.some(g => norm(g) === gl || /^alle$/i.test(g));
  return e.kontakte.filter(k => k.n.trim() && k.anschreiben !== 'nein' && passt(k)).sort((a, c) => (c.anschreiben === 'ja') - (a.anschreiben === 'ja'))[0] || null;
}
const flKontaktKnoepfe = k => { const tel = telNr(k.tel); return (tel ? `<a class="fl-fi" href="tel:${tel}" data-act="link" data-tip="${esc(k.tel)}" aria-label="Anrufen: ${esc(k.tel)}">☎</a>` : '')
  + (k.mail ? `<a class="fl-fi" href="mailto:${esc(k.mail)}" data-act="link" data-tip="${esc(k.mail)}" aria-label="E-Mail an ${esc(k.mail)}">✉</a>` : ''); };
const flGebiet = e => e.gl.map(g => /^alle$/i.test(g) ? 'alle Gliederungen' : UI.flGl && norm(g) === norm(UI.flGl) ? `<b>${esc(g)}</b>` : esc(g)).join(', ');
function flZeilen() {
  const L = flGefiltert();
  if (!L.length) return `<tr><td colspan="6"><div class="empty">${flDaten().liste.length ? 'Kein Förderer passt zur Suche.' : 'Noch keine Fördererliste – „Excel ▾ → Excel einlesen …“ übernimmt die umgebaute Fördererliste.'}</div></td></tr>`;
  return L.map(e => {
    const ansp = e.ansprache.filter(a => a.art !== 'frei' && (!UI.flGl || norm(a.gl) === norm(UI.flGl)));
    const lauf = flLaufend(e).filter(x => !x.b.archiv && !x.b.manuell), bea = lauf.filter(x => x.f.status === 'beantragt'), k = flKontaktHaupt(e);
    const laufZ = bea.length ? 'Antrag läuft: ' + bea.map(x => short(x.b.titel)).join(', ') : lauf.length ? 'eingeplant: ' + lauf.map(x => short(x.b.titel)).join(', ') : '';
    return `<tr data-act="fl-oeffnen" data-id="${e.id}" tabindex="0" class="${e.status !== 'aktiv' ? 'fl-ruht' : ''}">
      <td class="fl-n"><b>${esc(e.name || '(ohne Namen)')}</b>${e.status !== 'aktiv' ? `<div class="muted small">${esc(e.status)}</div>` : ''}${laufZ ? `<div class="fl-lz small${bea.length ? ' an' : ''}">${esc(laufZ)}</div>` : ''}</td>
      <td class="fl-g">${flGebiet(e) || '<span class="muted">–</span>'}${ansp.length ? `<div class="fl-ansp" title="${esc(ansp.map(a => a.gl + ': ' + a.art + (a.hinweis ? ' – ' + a.hinweis : '')).join('\n'))}">${ICON_TRI}<span>${UI.flGl ? esc(ansp[0].art) : ansp.map(a => esc(a.gl)).join(', ') + ': ' + esc(ansp[0].art)}</span></div>` : ''}</td>
      <td class="fl-z">${e.schwer ? `<div class="fl-clamp" title="${esc(flPlain(e.schwer))}">${esc(flPlain(e.schwer))}</div>` : '<span class="muted">–</span>'}</td>
      <td class="fl-tf">${flFristenHtml(e)}</td>
      <td class="fl-te">${flNetz(e)}</td>
      <td class="fl-k">${k ? `<div class="fl-kp"><div><span class="fl-kn">${esc(k.n)}</span>${k.pos ? `<div class="muted small">${esc(k.pos)}</div>` : ''}</div><span class="fl-fis">${flKontaktKnoepfe(k)}</span></div>` : '<span class="muted">–</span>'}</td></tr>`;
  }).join('');
}
function flBar() {
  const D0 = flDaten(), n = flGefiltert().length, GL = uniq(D0.liste.flatMap(e => e.gl)).filter(g => !/^alle$/i.test(g)).sort((a, c) => a.localeCompare(c, 'de'));
  return `<div class="subbar list-head fl-head">
      <span class="muted" id="fl-count">${n} von ${D0.liste.length} Förderern</span>
      <div class="heute"><button class="heute-btn" data-act="fl-neu-leer" title="Förderer von Hand anlegen">+ Förderer</button></div>
      <div class="tools">
        <select data-ui="flGl" class="fl-glw${UI.flGl ? ' an' : ''}" aria-label="Nach Gliederung filtern"><option value="">Gliederung: alle</option>${GL.map(x => `<option${x === UI.flGl ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <input type="search" id="flq" data-ui="flq" value="${esc(UI.flq || '')}" placeholder="Suchen: Name, Gliederung, Zweck …" aria-label="Förderer suchen (Strg+F)">
        <button data-act="fl-excel-menu" aria-haspopup="menu" title="Excel: herunterladen oder einlesen">Excel ▾</button>
      </div>
    </div>`;
}
function flListView() {
  return `<main class="fl-main"><section class="card list-card"><div class="tablewrap"><table class="list fl-tab"><thead><tr><th>Förderer</th><th>Fördergebiet</th><th>Förderzweck</th><th>Fristen ${today().slice(0, 4)}</th>
    <th class="fl-te" title="Erfolgschance, Dauer, Fördersumme – je weiter außen, desto günstiger">Einschätzung</th><th>Ansprechperson</th></tr></thead><tbody id="fl-body">${flZeilen()}</tbody></table></div></section></main>`;
}
function flExcelMenu(btn) {
  closeMenus();
  const m = h('div', { class: 'menu', role: 'menu' },
    h('button', { role: 'menuitem', onclick: () => { closeMenus(); download(FL_DATEI, flBlob()); } }, 'Fördererliste als Excel herunterladen'),
    DEMO ? null : h('button', { role: 'menuitem', onclick: () => { closeMenus(); flEinlesen(); } }, 'Excel einlesen … (ersetzt die Liste)'),
    !DEMO && ST.conn === 'ok' ? h('div', { class: 'muted small fl-menu-hw' }, 'Eine aktuelle Kopie „' + FL_DATEI + '“ legt das Programm nach jedem Speichern in seinen Ordner.') : null);
  placePop(m, btn, 'right');
}

// ---------- Seite eines Förderers (ab 0.91, Entwurf „1a“ aus Claude Design): Kopf mit Name und Kennzahl direkt auf dem grauen Grund; links
// Ansprechpersonen und Steckbrief, Förderungen und Absagen (offen, nach Jahren), Notizen, „Weitere Angaben“ (zugeklappt); rechts Ansprache für die
// Gliederung aus dem Filter, Einschätzung, Fristen dieses Jahres, Links. Alles bleibt direkt bearbeitbar (data-fl = Pfad im Eintrag);
// leere Angaben sind ausgeblendet, „+ Angabe“ bietet sie an
const flCur = () => flEintrag(UI.flId);
const flIn = (p, v, o = {}) => `<input type="text" class="fl-in${o.cls ? ' ' + o.cls : ''}" data-fl="${p}"${o.typ ? ` data-typ="${o.typ}"` : ''} value="${esc(v ?? '')}" placeholder="${esc(o.ph || '')}" aria-label="${esc(o.aria || o.ph || p)}"${o.title ? ` title="${esc(o.title)}"` : ''}>`;
const flTa = (p, v, o = {}) => `<textarea class="fl-in${o.cls ? ' ' + o.cls : ''}" rows="${o.rows || 2}" data-fl="${p}" placeholder="${esc(o.ph || '')}" aria-label="${esc(o.aria || o.ph || p)}">${esc(v || '')}</textarea>`;
const flSel = (p, v, L, o = {}) => `<select class="fl-in${o.cls ? ' ' + o.cls : ''}" data-fl="${p}" aria-label="${esc(o.aria || p)}">${(o.leer != null ? [['', o.leer]] : []).concat(L.map(x => Array.isArray(x) ? x : [x, x])).map(([x, l]) => `<option value="${esc(x)}"${x === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const FL_AN = { ja: ['ja', '✓ anschreiben', 'darf angeschrieben werden – Klick: nicht anschreiben'], nein: ['nein', '✕ nicht anschreiben', 'nicht anschreiben – Klick: nicht festgelegt'], '': ['leer', 'anschreiben offen', 'nicht festgelegt – Klick: darf angeschrieben werden'] };
const FL_ANSP = { frei: { l: 'Frei anschreiben', sym: '✓', cls: 'frei' }, 'über die Gliederung': { l: 'Über die Gliederung', sym: '!', cls: 'gl' }, 'nicht anschreiben': { l: 'Nicht anschreiben', sym: '✕', cls: 'nein' } };
const FL_QUELLE = q => q === 'Bedarfsliste' ? 'aus dem Bedarf' : /kartei/i.test(q) ? 'alte Kartei' : q === 'von Hand' || !q ? 'von Hand' : q;
// Gliederung, auf die sich die Seite bezieht: Filter der Übersicht oder eine Suche nach dem Namen einer Gliederung
function flKontextGl() {
  if (UI.flGl) return UI.flGl;
  const q = norm(UI.flq); if (!q) return '';
  return [...D.fl.liste.flatMap(e => e.gl), ...D.bedarfe.map(b => b.gliederung)].find(g => g && !/^alle$/i.test(g) && g !== DIO && norm(g) === q) || '';
}
// Kennzahl im Kopf: bestätigte Förderungen ab dem vorletzten Jahr, dazu die Absagen
function flKennzahl(H) {
  const ab = +today().slice(0, 4) - 2, L = H.filter(x => +x.jahr >= ab), G = L.filter(x => x.ergebnis === 'gefördert'), a = L.length - G.length;
  return { sum: G.reduce((s, x) => s + (+x.betrag || 0), 0), n: G.length, a, seit: G.length ? Math.min(...G.map(x => +x.jahr)) : ab };
}
const flRechercheAlt = e => !!e.recherche && (Date.parse(today()) - Date.parse(e.recherche)) / 864e5 > 365;
function flDetailBar() {
  const g = flKontextGl();
  return `<div class="subbar"><button class="back" data-act="fl-zurueck">‹ Fördererliste</button>${g ? `<span class="fl-sub-gl">gefiltert nach Gliederung <b>${esc(g)}</b></span>` : ''}</div>`;
}
// Kontakte fertig bearbeitet (Fertig, anderer Förderer, zurück zur Liste): ganz leere fallen weg
function flKontakteFertig() {
  const e = flCur(); UI.flKEdit = false; if (!e) return;
  const L = e.kontakte.filter(k => [k.n, k.pos, k.mail, k.tel, k.notiz].some(x => strV(x)));
  if (L.length !== e.kontakte.length) { e.kontakte = L; changed(); }
}
// anschreiben: ✓ ja (grün), ohne Angabe (z. B. in CC), ✕ nein (rot) – ein Klick auf das Zeichen schaltet weiter
const FL_KS = { ja: ['ja', '✓', 'darf angeschrieben werden – Klick: nicht anschreiben'], '': ['leer', '○', 'anschreiben offen, z. B. in CC – Klick: darf angeschrieben werden'], nein: ['nein', '✕', 'nicht anschreiben – Klick: offen'] };
function flDetailView() {
  const e = flCur(); if (!e) return '<main class="fl-main"><div class="empty">Diesen Förderer gibt es nicht mehr.</div></main>';
  const H = flHistorie(e), K = flKennzahl(H), jahr0 = +today().slice(0, 4), heute = today(), ctx = flKontextGl();
  const kz = K.n ? `${K.n} ${K.n === 1 ? 'Förderung' : 'Förderungen'} seit ${K.seit}` : `keine Förderung seit ${K.seit}`;
  const rech = !e.recherche ? '' : flRechercheAlt(e) ? `<span class="fl-pill warn">Recherche veraltet · ${fmtDate(e.recherche)}</span>` : `<span class="fl-rech">recherchiert ${fmtDate(e.recherche)}</span>`;
  // Kopf wie beim Bedarf: links Name, darunter Art und Recherche; die Kennzahl rechts über der rechten Spalte, bündig mit ihr
  const kopf = `<div class="fl-kopf">
      <div class="fl-kopf-l"><div class="fl-kopf-z">${flIn('name', e.name, { ph: 'Name des Förderers', aria: 'Name des Förderers', cls: 'fl-name' })}<button class="fl-punkte" data-act="fl-menue" aria-haspopup="menu" title="Art, Status, Förderer löschen" aria-label="Weitere Aktionen">⋯</button></div>
        <div class="fl-kopf-u">${e.art ? `<span>${esc(e.art)}</span>` : ''}${e.status !== 'aktiv' ? `<span class="fl-pill">${esc(e.status)}</span>` : ''}${rech}</div></div>
      <div class="fl-kz"><div class="fl-kz-b">${fmtNum(K.sum) || '0'}<span> €</span></div><div class="fl-kz-t">${kz}${K.a ? ` · ${K.a} ${K.a === 1 ? 'Absage' : 'Absagen'}` : ''}</div></div>
    </div>`;

  // Ansprechpersonen wie „Zuständig“ beim Bedarf: graue Karten nebeneinander, ✉ und ☎ zeigen beim Überfahren Adresse bzw. Nummer;
  // vorn das Zeichen fürs Anschreiben. Stift: alle bearbeiten (wie dort), „+“: neuer Kontakt
  const rang = k => k.anschreiben === 'ja' ? 0 : k.anschreiben === 'nein' ? 2 : 1;
  const KL = e.kontakte.map((k, i) => ({ k, i })).sort((a, c) => rang(a.k) - rang(c.k) || a.i - c.i);
  const knopf = (href, sym, t, tip) => `<a class="kb" href="${esc(href)}" data-act="link" data-tip="${esc(tip)}" aria-label="${t}: ${esc(tip)}">${sym}</a>`;
  const karte = ({ k, i }) => { const s = FL_KS[k.anschreiben || ''], tel = telNr(k.tel);
    return `<div class="k1 fl-k1 an-${s[0]}"><button class="star fl-st ${s[0]}" data-act="fl-k-an" data-i="${i}" title="${s[2]}" aria-label="${s[2]}">${s[1]}</button>`
      + `<div class="acts">${k.mail ? knopf('mailto:' + k.mail, '✉', 'E-Mail schreiben', k.mail) : ''}${tel ? knopf('tel:' + tel, '☎', 'Anrufen', k.tel) : ''}</div>`
      + `<div class="kn">${esc(k.n || '(ohne Namen)')}</div>`
      + (k.pos ? `<div class="kr">${k.pos.split(/\s*;\s*/).filter(Boolean).map(esc).join('<br>')}</div>` : '')
      + (k.gl.length ? `<div class="kr fl-kfuer">für ${esc(k.gl.join(', '))}</div>` : '') + (k.notiz ? `<div class="kr fl-knotiz">${esc(k.notiz)}</div>` : '') + '</div>'; };
  const linie = (i, p, ph, typ) => { const k = e.kontakte[i];
    return `<input type="text" class="k-li k-li-${p}" data-fl="kontakte.${i}.${p}"${typ ? ` data-typ="${typ}"` : ''} value="${esc(p === 'gl' ? k.gl.join(', ') : k[p] || '')}" placeholder="${ph}" aria-label="${ph}" autocomplete="off">`; };
  const bearb = ({ k, i }) => `<div class="k-ed">${linie(i, 'n', 'Vorname Nachname')}${linie(i, 'pos', 'Position')}${linie(i, 'mail', 'E-Mail-Adresse')}${linie(i, 'tel', 'Telefonnummer')}${linie(i, 'gl', 'für Gliederungen (leer: alle)', 'liste')}${linie(i, 'notiz', 'Notiz')}
      <div class="fl-an-z"><span>anschreiben</span><div class="fl-seg fl-an-seg" role="group" aria-label="Anschreiben">${[['ja', '✓ ja', 'darf angeschrieben werden'], ['', 'offen', 'nicht festgelegt, z. B. in CC'], ['nein', '✕ nein', 'nicht anschreiben']].map(([v, t, tip]) => `<button class="${(k.anschreiben || '') === v ? 'on' : ''}" data-act="fl-k-an-setzen" data-i="${i}" data-v="${v}" title="${tip}" aria-pressed="${(k.anschreiben || '') === v}">${t}</button>`).join('')}</div></div>
      <button class="x" data-act="fl-k-weg" data-i="${i}" title="Kontakt entfernen" aria-label="Kontakt entfernen">×</button></div>`;
  const personen = `<div class="fl-personen"><div class="sub fl-k-sub">Ansprechpersonen<button class="k-pliste k-plus" data-act="fl-k-neu" title="Kontakt hinzufügen" aria-label="Kontakt hinzufügen">+</button>${UI.flKEdit
      ? '<button class="k-fertig" data-act="fl-k-fertig">Fertig</button>' : `<button class="k-pen" data-act="fl-k-edit" title="Kontakte bearbeiten" aria-label="Kontakte bearbeiten">${ICON_PEN}</button>`}</div>
      ${UI.flKEdit ? `<div class="fl-ked">${KL.map(bearb).join('')}</div>`
        : `<div class="fl-kliste">${KL.map(karte).join('') || '<p class="muted small z-leer">Noch niemand eingetragen – über „+“ hinzufügen.</p>'}</div>${KL.length ? '<p class="fl-legende"><b class="ja">✓</b> anschreiben · <b class="leer">○</b> offen, z. B. in CC · <b class="nein">✕</b> nicht anschreiben</p>' : ''}`}</div>`;

  // Steckbrief: alle Angaben immer da (leer zum Ausfüllen); freie Texte formatierbar wie beim Bedarf
  const txt = (k, ph, aria, o = {}) => pe(e, k, '', 'area', Object.assign({ fmt: true, ph, aria, flpe: true }, o));
  const altWeg = e.weg.includes('direkt') && !e.weg.some(w => FL_WEGE.includes(w)) ? '<span class="fl-alt-weg">bisher: direkt</span>' : '';
  const weg = `<div class="fl-seg" role="group" aria-label="Antragsweg">${FL_WEGE.map(w => `<button class="${e.weg.includes(w) ? 'on' : ''}" data-act="fl-antrag" data-v="${w}" aria-pressed="${e.weg.includes(w)}">${w}</button>`).join('')}</div>${altWeg}`;
  const steck = `<div class="fl-steck"><h3>Steckbrief</h3><div class="fl-sg">
      <span class="fl-sl">Förderzweck</span><div class="fl-sv">${txt('schwer', 'Förderzweck eintragen …', 'Förderzweck')}</div>
      <span class="fl-sl">Fördergebiet</span><div class="fl-sv">${flIn('gl', e.gl.join(', '), { typ: 'liste', ph: 'Gliederungen eintragen … oder „alle“', aria: 'Fördergebiet', cls: 'fl-feld' })}</div>
      <span class="fl-sl">Förderhöhe</span><div class="fl-sv">${txt('hoehe', 'Förderhöhe eintragen …', 'Förderhöhe', { cls: 'fl-fett' })}</div>
      <span class="fl-sl">Antragsweg</span><div class="fl-sv fl-weg-z">${weg}</div>
      <span class="fl-sl">Fristen</span><div class="fl-sv">${txt('fristen', 'Fristen eintragen … z. B. 31.03. und 30.09.', 'Fristen')}</div></div></div>`;

  // Förderungen und Absagen (links, schmaler) und daneben die Notizen – in einer Karte
  const Lauf = flLaufend(e).filter(x => !x.b.archiv && !x.b.manuell);
  const offen = ({ b, f }) => { const st = f.status === 'beantragt' ? ['beantragt', 'warn', f.beantragtAm ? 'seit ' + fmtDate(f.beantragtAm) : ''] : f.status === 'zugesagt' ? ['zugesagt', 'ok', 'Geld noch nicht da'] : ['eingeplant', '', f.frist ? 'für Frist ' + fmtDate(f.frist).slice(0, 6) : ''];
    return `<div class="fl-ge"><span class="fl-kr offen" aria-hidden="true">…</span><div class="fl-ge-t"><button class="link fl-bed" data-act="open" data-id="${b.id}" title="Bedarf öffnen">${esc(b.titel || '(ohne Namen)')}</button><span class="fl-meta">${[b.gliederung === DIO ? 'Diözese' : b.gliederung, st[2]].filter(Boolean).map(esc).join(' · ')}</span></div>
      <span class="fl-pill ${st[1]}">${st[0]}</span><span class="fl-btr mut">${foeAmt(f) ? eur(foeAmt(f)) : ''}</span></div>`; };
  const eintrag = x => {
    const ab = x.ergebnis === 'abgelehnt';
    if (!x.gespeichert) return `<div class="fl-ge"><span class="fl-kr ${ab ? 'ab' : 'ok'}" aria-label="${ab ? 'abgelehnt' : 'gefördert'}">${ab ? '✕' : '✓'}</span>
      <div class="fl-ge-t"><button class="link fl-bed" data-act="open" data-id="${x.bedarfId}" title="Bedarf öffnen">${esc(x.zweck)}</button>
        <div class="fl-meta">${[(x.gl || []).join(', '), x.datum ? fmtDate(x.datum) : '', 'aus dem Bedarf'].filter(Boolean).map(esc).join(' · ')}</div>
        ${ab ? `<div class="fl-absage">${x.grund ? 'Abgelehnt: ' + esc(x.grund) : 'Abgelehnt – Grund fehlt'}</div>` : ''}</div>
      <span class="fl-btr${ab ? ' ab' : ''}">${x.betrag ? eur(x.betrag) : ''}</span><span></span></div>`;
    const i = e.foerderungen.findIndex(g => g.id === x.id);
    return `<div class="fl-ge"><button class="fl-kr ${ab ? 'ab' : 'ok'}" data-act="fl-g-erg" data-i="${i}" title="${ab ? 'abgelehnt – Klick: gefördert' : 'gefördert – Klick: abgelehnt'}">${ab ? '✕' : '✓'}</button>
      <div class="fl-ge-t">${flIn(`foerderungen.${i}.zweck`, x.zweck, { ph: 'wofür?', aria: 'Zweck', cls: 'fl-ge-z' })}
        <div class="fl-meta">${flIn(`foerderungen.${i}.gl`, (x.gl || []).join(', '), { typ: 'liste', ph: 'Gliederung', aria: 'Gliederung', cls: 'fl-auto' })} · ${flIn(`foerderungen.${i}.datum`, x.datum ? fmtDate(x.datum) : x.jahr, { typ: 'jahrdatum', ph: 'Datum oder Jahr', aria: 'Datum oder Jahr', cls: 'fl-auto' })} · ${esc(FL_QUELLE(x.quelle))}</div>
        ${ab ? `<div class="fl-absage">Abgelehnt: ${flIn(`foerderungen.${i}.grund`, x.grund, { ph: 'Grund eintragen', aria: 'Grund der Absage', cls: 'fl-auto' })}</div>` : ''}</div>
      <span class="fl-btr${ab ? ' ab' : ''}">${flIn(`foerderungen.${i}.betrag`, x.betrag == null ? '' : fmtNum(x.betrag) + ' €', { typ: 'zahl', ph: 'Betrag', aria: 'Betrag', cls: 'fl-auto num' })}</span>
      <button class="fl-x" data-act="fl-g-weg" data-i="${i}" title="Eintrag entfernen" aria-label="Eintrag entfernen">×</button></div>`;
  };
  const jahre = uniq(H.map(x => x.jahr || '–')), neu = jahre.filter(y => +y >= jahr0 - 2), alt = jahre.filter(y => !neu.includes(y));
  const gruppe = y => { const L = H.filter(x => (x.jahr || '–') === y), G = L.filter(x => x.ergebnis === 'gefördert'), a = L.length - G.length;
    return `<div class="fl-gk"><b>${esc(y === '–' ? 'ohne Jahr' : y)}</b><span>${eur(G.reduce((s, x) => s + (+x.betrag || 0), 0))} · ${G.length} gefördert${a ? ', ' + a + (a === 1 ? ' Absage' : ' Absagen') : ''}</span></div><div class="fl-gl">${L.map(eintrag).join('')}</div>`; };
  const altL = alt.filter(y => y !== '–').map(Number);
  const foerd = `<div class="fl-foerd"><div class="fl-h-z"><h3>Förderungen und Absagen</h3><span class="fl-sub">${K.n ? 'seit ' + K.seit + ' · ' + eur(K.sum) + ' gefördert' : ''}</span><button class="link fl-plus-t" data-act="fl-g-neu">+ Förderung von Hand</button></div>
      <div class="fl-gr">${Lauf.length ? `<div class="fl-gk offen"><b>Offen</b><span>nicht doppelt anfragen</span></div><div class="fl-gl">${Lauf.map(offen).join('')}</div>` : ''}
        ${neu.map(gruppe).join('')}${UI.flAlt ? alt.map(gruppe).join('') : ''}</div>
      ${!H.length && !Lauf.length ? '<p class="fl-leer">Noch keine Förderung und keine Absage.</p>' : ''}
      ${alt.length ? `<button class="fl-fuss" data-act="fl-alt">${UI.flAlt ? 'Ältere Einträge ausblenden ▾' : `Ältere Einträge (${H.filter(x => alt.includes(x.jahr || '–')).length}${altL.length ? ', ' + Math.min(...altL) + (altL.length > 1 ? '–' + Math.max(...altL) : '') : ''}) anzeigen ▸`}</button>` : ''}</div>`;
  const notizen = `<div class="fl-notizen"><h3>Notizen</h3>${txt('notiz', 'Notizen eintragen … z. B. Zugang zum Portal, Absprachen, Besonderheiten', 'Notizen', { cls: 'fl-notiz-pe' })}</div>`;

  // Weitere Angaben (zugeklappt): Art, Status, Anschrift, Recherche, Quelle
  const quellen = ['Bedarfsliste', 'Kartei', 'von Hand'].map(q => [q === 'Bedarfsliste' ? 'aus Bedarfen' : FL_QUELLE(q), H.filter(x => FL_QUELLE(x.quelle) === FL_QUELLE(q)).length]);
  const mehr = `<section class="card fl-mehr"><button class="fl-mehr-k" data-act="fl-mehr" aria-expanded="${!!UI.flMehr}"><span class="fl-chev">${UI.flMehr ? '▾' : '▸'}</span><b>Weitere Angaben</b><span class="fl-sub">Art, Status, Anschrift, Recherche, Quelle</span></button>
      ${UI.flMehr ? `<div class="fl-mehr-i"><div class="fl-dl">
          <span>Art</span><div>${flSel('art', e.art, uniq([...FL_ARTEN, e.art]), { leer: 'Art wählen', aria: 'Art' })}</div>
          <span>Status</span><div>${flSel('status', e.status, FL_STATUS, { aria: 'Status' })}</div>
          <span>Anschrift</span><div>${flTa('anschrift', e.anschrift, { rows: 1, ph: 'Straße, PLZ Ort', aria: 'Anschrift' })}</div>
          <span>Recherche-Stand</span><div>${flIn('recherche', e.recherche ? fmtDate(e.recherche) : '', { typ: 'datum', ph: 'tt.mm.jjjj', aria: 'Recherche-Stand' })}</div>
          <span>Quelle</span><div class="fl-q">${quellen.map(([t, n]) => `${t} (${n})`).join(', ')}</div></div></div>` : ''}</section>`;

  // rechte Spalte: Ansprache für die Gliederung (Stoppschild), Einschätzung, Fristen, Links
  const ai = ctx ? e.ansprache.findIndex(a => norm(a.gl) === norm(ctx)) : -1, an = ai >= 0 ? e.ansprache[ai] : null, S = FL_ANSP[an ? an.art : 'frei'];
  const vermerk = (a, i) => `<div class="fl-a">${flIn(`ansprache.${i}.gl`, a.gl, { ph: 'Gliederung', aria: 'Gliederung', cls: 'fl-a-gl' })}${flSel(`ansprache.${i}.art`, a.art, FL_ANSPRACHE, { aria: 'Ansprache', cls: 'fl-a-art ' + FL_ANSP[a.art].cls })}<button class="fl-x" data-act="fl-a-weg" data-i="${i}" title="Vermerk entfernen" aria-label="Vermerk entfernen">×</button>${flTa(`ansprache.${i}.hinweis`, a.hinweis, { rows: 1, ph: 'Hinweis', aria: 'Hinweis', cls: 'fl-a-h' })}</div>`;
  const liste = `<div class="fl-al">${e.ansprache.map(vermerk).join('')}<div class="fl-a-rest"><span>${e.ansprache.length ? 'alle übrigen' : 'alle Gliederungen'}</span><b>Frei anschreiben</b></div><button class="fl-angabe" data-act="fl-a-neu">+ Vermerk für eine Gliederung</button></div>`;
  const nV = e.ansprache.length;
  const ansprache = ctx ? `<div class="fl-ak-box ${S.cls}">
      <div class="fl-ab-1">Ansprache · ${esc(ctx)}</div>
      <button class="fl-ab-2" data-act="fl-ansp-menu" aria-haspopup="menu" title="Ansprache für ${esc(ctx)} ändern"><span class="fl-ab-kr" aria-hidden="true">${S.sym}</span><span>${S.l}</span><span class="fl-ab-pf" aria-hidden="true">▾</span></button>
      ${an ? flTa(`ansprache.${ai}.hinweis`, an.hinweis, { rows: 1, ph: 'Hinweis, z. B. die Gliederung fragt selbst an', aria: 'Hinweis', cls: 'fl-ab-h' }) : `<p class="fl-ab-h">Kein Vermerk für ${esc(ctx)} – die Ansprechperson direkt anschreiben.</p>`}
      <button class="fl-ab-alle" data-act="fl-alle-gl" aria-expanded="${!!UI.flAlleGl}">${UI.flAlleGl ? '▾' : '▸'} Alle Gliederungen (${nV} ${nV === 1 ? 'Vermerk' : 'Vermerke'})</button>
      ${UI.flAlleGl ? liste : ''}</div>`
    : `<div class="fl-ak-box neutral"><div class="fl-ab-1">Ansprache je Gliederung</div>${liste}</div>`;
  const FJ = flFristenJahr(e.fristen), naechste = FJ.find(d => d >= heute);
  const frist = d => { const t = Math.round((Date.parse(d) - Date.parse(heute)) / 864e5), st = d < heute ? 'vorbei' : d === naechste ? (t <= 21 ? 'bald' : 'naechste') : 'spaeter';
    return `<div class="fl-fz ${st}"><span class="fl-kr ${st}" aria-hidden="true">${st === 'vorbei' ? '✓' : st === 'bald' ? '!' : ''}</span><span class="fl-fz-d">${fmtDate(d).slice(0, 6)}</span><span class="fl-fz-n">${st === 'vorbei' ? 'vorbei' : st === 'spaeter' ? '' : t === 0 ? 'heute' : 'in ' + t + (t === 1 ? ' Tag' : ' Tagen')}</span></div>`; };
  const fristen = FJ.length ? `<div class="fl-fl">${FJ.map(frist).join('')}</div>` : e.fristen ? `<div class="fl-ft2">${fmtText(e.fristen)}</div>` : '<p class="fl-leer">Keine Fristen eingetragen – im Steckbrief ergänzen.</p>';
  const link = (k, lab) => `<div class="fl-lk"><div class="fl-lk-t"><span class="fl-sl">${lab}</span>${flIn(k, e[k], { ph: 'https://… eintragen', aria: lab, cls: 'fl-url', title: e[k] })}</div>${/^https?:\/\//i.test(e[k]) ? `<a class="fl-oeffnen" href="${esc(e[k])}" target="_blank" rel="noopener" data-act="link">Öffnen ↗</a>` : ''}</div>`;
  const seite = `<aside class="card fl-seite">${ansprache}
      <section class="fl-blk"><div class="fl-h-z"><h3>Einschätzung</h3><span class="fl-sub2">außen = günstiger</span></div>${flNetz(e, true)}</section>
      <section class="fl-blk"><h3>Fristen ${jahr0}</h3>${fristen}</section>
      <section class="fl-blk"><h3>Links</h3>${link('web', 'Homepage / Portal')}${link('richtlinien', 'Förderrichtlinien')}</section></aside>`;

  return `<main class="fl-main fl-detail">${kopf}
    <div class="fl-raster">
      <div class="fl-links">
        <section class="card fl-ps">${personen}${steck}</section>
        <section class="card fl-fn">${foerd}${notizen}</section>
        ${mehr}
      </div>
      ${seite}
    </div>
  </main>`;
}
// kleine Menüs: „⋯“ (Art, Status, löschen) und Ansprache für die Gliederung
function flMenue(btn) {
  closeMenus(); const e = flCur(); if (!e) return;
  placePop(h('div', { class: 'menu fl-menue', role: 'menu', html: `<label class="fl-mz"><span>Art</span>${flSel('art', e.art, uniq([...FL_ARTEN, e.art]), { leer: 'Art wählen', aria: 'Art' })}</label>
    <label class="fl-mz"><span>Status</span>${flSel('status', e.status, FL_STATUS, { aria: 'Status' })}</label><hr><button role="menuitem" class="fl-rot-t" data-act="fl-weg">Förderer löschen …</button>` }), btn, 'right');
}
function flAnspracheMenue(btn) {
  closeMenus(); const e = flCur(), ctx = flKontextGl(); if (!e || !ctx) return;
  const setzen = art => { closeMenus(); const i = e.ansprache.findIndex(a => norm(a.gl) === norm(ctx));
    if (art === 'frei') { if (i >= 0) e.ansprache.splice(i, 1); } else if (i >= 0) e.ansprache[i].art = art; else e.ansprache.push({ gl: ctx, art, hinweis: '' });
    changed(); keep(renderNow); };
  placePop(h('div', { class: 'menu', role: 'menu' }, ...FL_ANSPRACHE.map(a => h('button', { role: 'menuitem', class: 'fl-am ' + FL_ANSP[a].cls, onclick: () => setzen(a) }, FL_ANSP[a].sym + '  ' + FL_ANSP[a].l))), btn);
}
function flSetzen(el) {
  const e = flCur(); if (!e) return false;
  let v = el.value; const t = el.dataset.typ;
  if (t === 'liste') v = strL(v);
  else if (t === 'zahl') v = zahlOderLeer(v);
  else if (t === 'jahrdatum') {                                                   // Förderung von Hand: „2024“ oder „12.04.2024“
    const basis = el.dataset.fl.replace(/\.datum$/, ''), g = getPath(e, basis), w = strV(v), d = anyDate(w);
    if (/^\d{4}$/.test(w)) Object.assign(g, { jahr: w, datum: '' }); else if (d) Object.assign(g, { jahr: d.slice(0, 4), datum: d }); else if (!w) g.datum = ''; else { toast('„' + w + '“ ist weder Datum noch Jahr (z. B. 12.04.2024 oder 2024).', 'warn'); return false; }
    changed(); return true;
  }
  else if (t === 'datum') { const d = anyDate(v); if (strV(v) && !d) { toast('„' + v + '“ ist kein Datum (z. B. 05.12.2026).', 'warn'); return false; } v = d || ''; }
  setPath(e, el.dataset.fl, v); changed(); return true;
}
document.addEventListener('input', ev => {
  const el = ev.target; if (UI.view !== 'fdetail' || !el.dataset || !el.dataset.fl || el.tagName === 'SELECT' || ['datum', 'zahl', 'jahrdatum'].includes(el.dataset.typ)) return;
  flSetzen(el);
  if (el.dataset.fl === 'name') { const s = $('.fl-sub-n'); if (s) s.textContent = el.value || '(ohne Namen)'; }
});
document.addEventListener('change', ev => {
  const el = ev.target; if (!el.dataset) return;
  if (UI.view !== 'fdetail') return;
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
  const el = document.activeElement, imFeld = el && el.closest && el.closest('input, textarea, select, [contenteditable]');
  if (ev.key === 'Enter' && imFeld && el.tagName === 'INPUT' && el.classList.contains('fl-in')) { ev.preventDefault(); el.blur(); return; }
  if (!taste(ev, 'd-zurueck') || imFeld || $('.menu, .modal, .cal-pop, .fmt-bar, .pe-in')) return;
  ev.preventDefault(); flZurueck();
}, true);
// Seitenwechsel
function flListe() { closeMenus(); UI.view = 'flist'; flDaten(); renderNow(); scrollTo(0, 0); }
function flOeffnen(id) { if (!flEintrag(id)) return; closeMenus(); const von = UI.view; if (UI.flId !== id) { flKontakteFertig(); Object.assign(UI, { flAlt: false }); } UI.flId = id; UI.view = 'fdetail'; uebergang(von === 'flist' ? 'vor' : 'zurueck', () => { renderNow(); scrollTo(0, 0); }); }
function flZurueck() { closeMenus(); flKontakteFertig(); const id = UI.flId; UI.view = 'flist'; uebergang('zurueck', () => { renderNow(); const r = $(`#fl-body tr[data-id="${CSS.escape(id || '')}"]`); if (r) { r.scrollIntoView({ block: 'center' }); r.focus({ preventScroll: true }); } }); }

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
  else { if (!name.value.trim()) { toast('Bitte einen Namen eintragen.', 'warn'); return; } e = Object.assign(flLeer(), { id: flNeueId(), name: name.value.trim(), art: art.value, gl: strL(glIn.value), web: (f.web || '').trim(), weg: uniq(String(f.weg || '').split(/\s*(?:,|\boder\b|\/)\s*/).map(flWegNorm).filter(w => FL_WEGE.includes(w))) }); D.fl.liste.push(e); }
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
    case 'fl-k-neu': if (e) { e.kontakte.push(flKontaktLeer()); UI.flKEdit = true; neu(); const L = $$('.fl-ked .k-li-n'); if (L.length) L[L.length - 1].focus(); } return true;
    case 'fl-menue': if ($('.fl-menue')) closeMenus(); else flMenue(a); return true;
    case 'fl-pe': popEdit(a); return true;                                        // formatierbarer Text wie auf der Seite eines Bedarfs
    case 'fl-k-edit': UI.flKEdit = true; keep(renderNow); return true;
    case 'fl-k-fertig': flKontakteFertig(); keep(renderNow); return true;
    case 'fl-k-an-setzen': { const x = e && e.kontakte[+a.dataset.i]; if (x) { x.anschreiben = a.dataset.v; neu(); } return true; }
    case 'fl-ansp-menu': if ($('.menu')) closeMenus(); else flAnspracheMenue(a); return true;
    case 'fl-alle-gl': UI.flAlleGl = !UI.flAlleGl; keep(renderNow); return true;
    case 'fl-mehr': UI.flMehr = !UI.flMehr; keep(renderNow); if (UI.flMehr) { const m = $('.fl-mehr'); if (m) m.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } return true;
    case 'fl-alt': UI.flAlt = !UI.flAlt; keep(renderNow); return true;
    case 'fl-g-erg': { const g = e && e.foerderungen[+a.dataset.i]; if (g) { g.ergebnis = g.ergebnis === 'abgelehnt' ? 'gefördert' : 'abgelehnt'; neu(); } return true; }
    case 'fl-k-an': { const x = e && e.kontakte[+a.dataset.i]; if (x) { x.anschreiben = ({ '': 'ja', ja: 'nein', nein: '' })[x.anschreiben || '']; neu(); } return true; }
    case 'fl-antrag': if (e) { const v = a.dataset.v; e.weg = e.weg.length === 1 && e.weg[0] === v ? [] : [v]; neu(); } return true;   // Schalter: ein Weg; Klick auf den gewählten nimmt ihn heraus
    case 'fl-k-weg': if (e) { e.kontakte.splice(+a.dataset.i, 1); neu(); } return true;
    case 'fl-a-neu': if (e) { e.ansprache.push({ gl: '', art: 'über die Gliederung', hinweis: '' }); UI.flAlleGl = true; neu(); const L = $$('.fl-a input'); if (L.length) L[L.length - 1].focus(); } return true;
    case 'fl-a-weg': if (e) { e.ansprache.splice(+a.dataset.i, 1); neu(); } return true;
    case 'fl-g-neu': if (e) { const g = Object.assign(flFoerderungLeer(), { jahr: today().slice(0, 4), quelle: 'von Hand' }); e.foerderungen.push(g); neu();
      const z = $(`.fl-foerd [data-fl="foerderungen.${e.foerderungen.length - 1}.zweck"]`); if (z) z.focus(); } return true;
    case 'fl-g-weg': if (e) { e.foerderungen.splice(+a.dataset.i, 1); neu(); } return true;
    case 'fl-neu': if (b && f) await flUebernehmen(b, f); return true;
    case 'fl-kontakte': if (b && f) await flKontakteUebernehmen(b, f); return true;
    case 'fl-grund': if (f) await flGrundFragen(f); return true;
    case 'fl-loesen': if (f) { f.flId = ''; f.flNein = true; changed(); keep(renderNow); toast('Verknüpfung gelöst – über „mit Fördererliste verknüpfen …“ neu zuordnen.', 'ok'); } return true;
  }
  return false;
}
