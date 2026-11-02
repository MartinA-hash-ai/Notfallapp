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
const FL_STATUS = ['aktiv', 'ruht', 'aufgelöst', 'fusioniert'], FL_WEGE = ['E-Mail', 'Portal'], FL_ANSPRACHE = ['hinweis', 'nicht anschreiben'];
// Antragsweg (ab 0.95 nur „E-Mail“ oder „Portal“): „per Mail“/„per E-Mail“ wird zu „E-Mail“, ab 0.99 auch „direkt“ aus der alten Kartei
const flWegNorm = w => /mail/i.test(w) || /^direkt$/i.test(strV(w)) ? 'E-Mail' : /portal/i.test(w) ? 'Portal' : '';
// Text mit Formatierungszeichen (*fett* …) für schlichte Stellen (Übersicht): Zeichen weg, Zeilen mit „ · “
const flPlain = t => String(t || '').replace(/^\s*(?:[•*-]|\d+\.)\s+/gm, '').replace(/(^|[\s(„>])[*_~+](?=\S)/g, '$1').replace(/(\S)[*_~+](?=$|[\s.,;:!?)“<])/g, '$1').replace(/\s*\n+\s*/g, ' · ').trim();
// Fristen (ab 0.95): „31.03.“ = jedes Jahr, „31.03.2027“ = einmalig
const FRIST_RE = /(?<![\d.])(\d{1,2})\.(\d{1,2})\.(?:(\d{4}|\d{2})(?!\d))?/g;
function fristParse(t) {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.?\s*(\d{4}|\d{2})?\s*$/.exec(t || ''); if (!m) return '';
  const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : '', md = z2(m[2]) + '-' + z2(m[1]);
  return y ? (validIso(y + '-' + md) ? y + '-' + md : '') : validIso('2024-' + md) ? md : '';
}
const fristText = d => d.length === 5 ? d.slice(3) + '.' + d.slice(0, 2) + '.' : fmtDate(d);
// aus einem alten Fristen-Text: die Termine als Liste; bleibt außer Terminen nichts übrig, wird der Text leer
function fristenAusText(t) {
  const L = []; let m; FRIST_RE.lastIndex = 0;
  while ((m = FRIST_RE.exec(t || ''))) { const d = fristParse(m[0]); if (d && !L.some(x => x.d === d)) L.push({ id: uid('fr'), d, topf: '' }); }
  const rest = String(t || '').replace(FRIST_RE, '').replace(/\b(und|sowie|bzw|oder|jeweils|bis|zum|am|je)\b/gi, '').replace(/[\s,.;:–\-\/()*_]+/g, '');
  return { L, text: rest ? strV(t) : '' };
}
const flLeer = () => ({ id: '', name: '', art: '', status: 'aktiv', gl: [], weg: [], anschrift: '', web: '', schwer: '', hoehe: '', fristen: '', quote: '', kurz: '', gross: false, hoeheVon: null, hoeheBis: null, topfe: [], topfMig: false, richtlinien: '', recherche: '', notiz: '', bew: { chance: 0, dauer: 0, summe: 0 }, antrag: '', fristenL: [], ansprache: [], kontakte: [], foerderungen: [] });
// Einschätzung (ab 0.89, Häufigkeit und Aufwand ab 0.96): je drei Stufen, 1 = ungünstig … 3 = günstig (im Netz außen = besser; bei Dauer und Aufwand heißt außen
// „geht schnell“ bzw. „einfach“); 0 = nicht von Hand gesetzt. Reihenfolge = im Uhrzeigersinn ab oben: Geld (Summe, Häufigkeit) rechts, Mühe (Aufwand, Dauer) links
const FL_BEW = [
  { k: 'chance', t: 'Erfolgschance', kurz: 'Chance', st: ['gering', 'mittel', 'hoch'], bed: ['gering', 'mittel', 'hoch'] },
  { k: 'summe', t: 'Fördersumme', kurz: 'Summe', st: ['gering', 'mittel', 'hoch'], bed: ['bis 1.000 €', '1.000–3.000 €', '> 3.000 €'] },   // Grenzen nach der Fördermittel-Statistik 2026 (Stufen etwa gleich groß)
  { k: 'haeufig', t: 'Häufigkeit', kurz: 'Häufigkeit', st: ['alle paar Jahre', 'jährlich', 'mehrmals jährlich'], bed: ['alle paar Jahre', 'jährlich', 'mehrmals jährlich'] },
  { k: 'aufwand', t: 'Aufwand', kurz: 'Aufwand', st: ['sehr aufwendig', 'mäßig', 'einfach'], bed: ['sehr aufwendig', 'mäßig', 'einfach'] },
  { k: 'dauer', t: 'Dauer', kurz: 'Dauer', st: ['lange', 'mittel', 'schnell'], bed: ['> 6 Monate', '2–6 Monate', '< 2 Monate'] },
];
const FL_BEW_XL = ['Erfolgschance', 'Dauer', 'Fördersumme', 'Häufigkeit', 'Aufwand'].map(t => FL_BEW.find(x => x.t === t));   // Spalten in der Excel-Kopie (die ersten drei wie bisher)
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
// Felder, die Förderer und Fördertopf gemeinsam haben (beim Förderer ohne Töpfe gelten sie für ihn selbst, sonst je Topf)
const FL_TF = ['schwer', 'gl', 'hoehe', 'hoeheVon', 'hoeheBis', 'quote', 'fristen', 'web', 'richtlinien', 'weg', 'antrag', 'anschrift', 'recherche', 'bew', 'gross', 'notiz'];
const flBewNull = () => Object.fromEntries(FL_BEW.map(x => [x.k, 0]));
const flTopfLeer = (name = '') => ({ id: uid('t'), name, kurz: '', schwer: '', gl: [], hoehe: '', hoeheVon: null, hoeheBis: null, quote: '', fristen: '', web: '', richtlinien: '', weg: [], antrag: '', anschrift: '', recherche: '', bew: flBewNull(), gross: false, notiz: '' });
function flTraegerNorm(o) {
  for (const k of ['schwer', 'hoehe', 'quote', 'fristen', 'web', 'richtlinien', 'antrag', 'anschrift', 'notiz']) o[k] = strV(o[k]);
  o.gross = o.gross === true; o.hoeheVon = zahlOderLeer(o.hoeheVon); o.hoeheBis = zahlOderLeer(o.hoeheBis); if (o.hoeheVon != null || o.hoeheBis != null) o.hoehe = '';   // Förderhöhe: Zahlen von … bis; ein älterer Freitext bleibt, bis man neu einträgt
  o.recherche = validIso(o.recherche) ? o.recherche : ''; o.gl = strL(o.gl); o.weg = uniq(strL(o.weg).map(flWegNorm));
  const bw = isObj(o.bew) ? o.bew : {}; o.bew = Object.fromEntries(FL_BEW.map(x => [x.k, [1, 2, 3].includes(+bw[x.k]) ? +bw[x.k] : 0]));
}
// Fördertopf übernimmt vom Förderer, was ihm noch fehlt (Kopie); Einschätzung nur, wenn noch nichts gesetzt ist
function flTopfErbt(t, e) {
  for (const k of FL_TF) {
    if (k === 'bew') { if (!FL_BEW.some(x => t.bew[x.k])) t.bew = Object.assign({}, e.bew); }
    else if (k === 'gross') t.gross = t.gross || e.gross;
    else if (k === 'hoehe') { if (!t.hoehe && t.hoeheVon == null && t.hoeheBis == null) Object.assign(t, { hoehe: e.hoehe, hoeheVon: e.hoeheVon, hoeheBis: e.hoeheBis }); }
    else if (k === 'hoeheVon' || k === 'hoeheBis') continue;
    else if (Array.isArray(e[k])) { if (!t[k].length) t[k] = e[k].slice(); }
    else if (!t[k]) t[k] = e[k];
  }
}
function flNorm(x) {
  const o = isObj(x) ? x : {}, ids = new Set();
  const L = (Array.isArray(o.liste) ? o.liste : []).filter(isObj).map(e0 => {
    const e = Object.assign(flLeer(), e0);
    for (const k of ['id', 'name', 'kurz', 'art']) e[k] = strV(e[k]);
    e.status = FL_STATUS.includes(e.status) ? e.status : 'aktiv';
    const fm = e0.fristenL;                                                      // bis 0.94: Fristen nur als Text
    flTraegerNorm(e);
    if (Array.isArray(fm)) e.fristenL = fm.filter(isObj).map(f => ({ id: f.id || uid('fr'), d: /^\d{2}-\d{2}$/.test(f.d) || validIso(f.d) ? f.d : fristParse(f.d), topf: strV(f.topf) })).filter(f => f.d);
    else { const x = fristenAusText(e.fristen); e.fristenL = x.L; e.fristen = x.text; }
    // Fördertöpfe (ab 0.111) haben Steckbrief, Einschätzung, Links und Notizen für sich; bei älteren Ständen bekommt jeder Topf, was ihm fehlt, aus den Angaben des Förderers
    e.topfe = (Array.isArray(e0.topfe) ? e0.topfe : []).filter(isObj).map(t => { const o = Object.assign(flTopfLeer(), t, { id: strV(t.id) || uid('t') }); o.name = strV(o.name); o.kurz = strV(o.kurz); flTraegerNorm(o); return o; });
    if (e.topfe.length && !e0.topfMig) { e.topfe.forEach(t => flTopfErbt(t, e)); const erster = e.topfe[0].name; e.fristenL.forEach(f => { if (!f.topf) f.topf = erster; }); }
    e.topfMig = e.topfe.length > 0;
    // Hinweise (ab 0.94): gelb „hinweis“ oder rot „nicht anschreiben“; bis 0.93 hieß gelb „über die Gliederung“ (wird zur Überschrift), „frei“ ohne Text entfällt
    e.ansprache = (Array.isArray(e.ansprache) ? e.ansprache : []).filter(isObj).map(a => { const art0 = strV(a.art), nein = art0 === 'nicht anschreiben';
      return { gl: strV(a.gl), art: nein ? 'nicht anschreiben' : 'hinweis', kopf: strV(a.kopf), titel: strV(a.titel) || (art0 === 'über die Gliederung' ? 'Über die Gliederung' : nein ? 'Nicht anschreiben' : ''), hinweis: strV(a.hinweis) }; })
      .filter(a => a.art === 'nicht anschreiben' || a.kopf || a.titel || a.hinweis);
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
const flVonName = name => { const k = kkey(name); if (!k) return null; const L = D.fl.liste.filter(e => kkey(e.name) === k || (e.kurz && kkey(e.kurz) === k)); return L.length === 1 ? L[0] : null; };
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

// Kontakte eines Förderers im Bedarf (ab 0.93): läuft der Bedarf und ist der Förderer verknüpft, gelten die Kontakte der Fördererliste für die
// Gliederung des Bedarfs (★ zuerst, ohne „nicht anschreiben“) – ein neuer Filialleiter wirkt so sofort in allen laufenden Bedarfen. Dazu kommen die,
// die nur im Bedarf stehen (roter Knopf zum Übernehmen). Archivierte Bedarfe behalten den Stand von damals
const flLive = (b, f) => (!!b && !b.archiv && flAktiv() && flEintrag(f.flId)) || null;
function foeKontakte(b, f) {
  const e = flLive(b, f); if (!e) return f.kontakte;
  const gl = b.gliederung && b.gliederung !== DIO ? norm(b.gliederung) : '';
  const passt = k => !gl || !k.gl.length || k.gl.some(g => /^alle$/i.test(g) || norm(g) === gl);
  const L = e.kontakte.filter(k => k.n.trim() && k.anschreiben !== 'nein' && passt(k)).sort((a, c) => (c.anschreiben === 'ja') - (a.anschreiben === 'ja'))
    .map(k => Object.assign(leerK(), { n: k.n.trim(), rolle: k.pos, mail: k.mail, tel: k.tel }));
  return [...L, ...f.kontakte.filter(c => (c.n || '').trim() && !e.kontakte.some(k => kkey(k.n) === kkey(c.n)))];
}
// Kontakt in der Fördererliste umbenannt oder gelöscht: die Kopien in laufenden Bedarfen mitziehen (sonst tauchten sie dort als „neu“ wieder auf)
function flKopienAnpassen(e, alt, neu) {
  if (!kkey(alt)) return;
  for (const b of D.bedarfe) if (!b.archiv) for (const f of b.foerderer) if (f.flId === e.id) {
    if (neu == null) f.kontakte = f.kontakte.filter(c => kkey(c.n) !== kkey(alt)); else f.kontakte.forEach(c => { if (kkey(c.n) === kkey(alt)) c.n = neu; });
  }
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
  karteiSet(D.fl.liste.filter(e => e.name.trim()).map(e0 => { const e = flEff(e0); return {
    name: e.name, kurz: e.kurz, flId: e.id, blatt: /stift/i.test(e.art) ? 'Stiftungen' : 'Banken', gl: e.gl.slice(), weg: e.weg.slice(), notiz: e.notiz, schwer: e.schwer, web: e.web,
    kontakte: e.kontakte.filter(k => k.n.trim()).sort((a, c) => (c.anschreiben === 'ja') - (a.anschreiben === 'ja')).map(k => ({ n: k.n, pos: k.pos, m: k.mail, t: k.tel, nicht: k.anschreiben === 'nein', gl: k.gl.slice() })),
    hist: flHistorie(e).filter(x => x.ergebnis === 'gefördert').reduce((h, x) => { const y = x.jahr || '–', t = [x.betrag ? eur(x.betrag) : '', x.zweck].filter(Boolean).join(' '); h[y] = h[y] ? h[y] + '\n' + t : t; return h; }, {}) }; }));
  Object.assign(KR, { name: 'Fördererliste', err: null, zugriff: false, at: new Date() });
}
// Hinweis der Fördererliste für die Gliederung eines Bedarfs (gelb oder „nicht anschreiben“) – erscheint am Förderer im Bedarf und oben bei den Infos
function flAnsprache(b, f) {
  if (!flAktiv() || !b.gliederung) return null;
  const e = flEintrag(f.flId) || (f.name.trim() && flVonName(f.name)); if (!e) return null;
  const L = e.ansprache.filter(x => norm(x.gl) === norm(b.gliederung));
  return L.find(x => x.art === 'nicht anschreiben') || L[0] || null;
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

// weitere Angaben je Fördertopf im Blatt „Fördertöpfe“ (ab 0.111): [Spalte, Feld]; Einschätzung und Großförderer folgen
const FLT_X = [['Homepage / Portal', 'web'], ['Förderrichtlinien (Link)', 'richtlinien'], ['Antragsweg', 'weg'], ['Antrag an (E-Mail oder Portal-Link)', 'antrag'], ['Anschrift', 'anschrift'], ['Recherche-Stand', 'recherche'], ['Hinweis zu Fristen', 'fristen'], ['Notizen', 'notiz'], ['Großförderer', 'gross'],
  ['Erfolgschance', 'bew.chance'], ['Dauer', 'bew.dauer'], ['Fördersumme', 'bew.summe'], ['Häufigkeit', 'bew.haeufig'], ['Aufwand', 'bew.aufwand']];
// ---------- Excel: einlesen (umgebaute Kartei oder eigene Kopie) und schreiben
const FL_SP = {
  'Förderer': ['ID', 'Name', 'Art', 'Status', 'Gliederungen', 'Antragsweg', 'Anschrift', 'Homepage / Portal', 'Förderschwerpunkte', 'Förderhöhe', 'Fristen', 'Förderrichtlinien (Link)', 'Recherche-Stand', 'Notizen', ...FL_BEW_XL.map(x => x.t), 'Antrag an (E-Mail oder Portal-Link)', 'Förderquote', 'Kurzname', 'Großförderer', 'Förderhöhe von (€)', 'Förderhöhe bis (€)'],
  'Ansprache': ['Förderer-ID', 'Förderer', 'Gliederung', 'Ansprache', 'Hinweis', 'Überschrift', 'Kopfzeile'],
  'Kontakte': ['Förderer-ID', 'Förderer', 'Name', 'Position', 'E-Mail', 'Telefon', 'Gliederungen', 'Anschreiben', 'Notiz'],
  'Förderungen': ['Förderer-ID', 'Förderer', 'Jahr', 'Datum', 'Ergebnis', 'Betrag (€)', 'Zweck / Bedarf', 'Gliederungen', 'Grund der Absage', 'Quelle', 'Bedarf-ID'],
  'Fristen': ['Förderer-ID', 'Förderer', 'Frist', 'jedes Jahr', 'Fördertopf'],
  'Fördertöpfe': ['Förderer-ID', 'Förderer', 'Fördertopf', 'Kurzname', 'Förderzweck', 'Fördergebiet', 'Förderhöhe', 'Förderquote', 'Förderhöhe von (€)', 'Förderhöhe bis (€)', ...FLT_X.map(x => x[0])],
};
// Stufe aus einer Excel-Zelle: von der höchsten Stufe an suchen („mehrmals jährlich“ enthält „jährlich“); „einmal im Jahr“ aus 0.96 gilt weiter
const flStufe = (x, v) => { const t = norm(v).replace('im jahr', 'jährlich'); if (!t) return 0; for (let i = x.st.length - 1; i >= 0; i--) if (t.includes(norm(x.st[i]))) return i + 1; return 0; };
const xlDatum = v => typeof v === 'number' && v > 20000 && v < 80000 ? isoDate(new Date(Math.round((v - 25569) * 864e5) + 12 * 36e5)) : anyDate(strV(v)) || '';
function flLesen(book) {
  const blatt = n => book.sheets.find(s => norm(s.name) === norm(n));
  const tab = n => { const s = blatt(n); if (!s || !s.rows.length) return []; const kopf = s.rows[0].map(v => norm(cellStr(v)));
    return s.rows.slice(1).filter(r => r && r.some(v => strV(v))).map(r => Object.fromEntries(kopf.map((k, i) => [k, r[i]]))); };
  const F = tab('Förderer'); if (!F.length || !('id' in F[0]) || !('name' in F[0])) return null;
  const L = F.filter(r => strV(r.name)).map(r => Object.assign(flLeer(), { id: strV(r.id), name: strV(r.name), art: strV(r.art), status: strV(r.status) || 'aktiv', gl: strL(r.gliederungen), weg: strL(r.antragsweg),
    anschrift: strV(r.anschrift), web: strV(r['homepage / portal']), schwer: strV(r['förderschwerpunkte']), hoehe: strV(r['förderhöhe']), fristen: strV(r.fristen), richtlinien: strV(r['förderrichtlinien (link)']), recherche: xlDatum(r['recherche-stand']), notiz: strV(r.notizen),
    bew: Object.fromEntries(FL_BEW.map(x => [x.k, flStufe(x, r[norm(x.t)])])), antrag: strV(r['antrag an (e-mail oder portal-link)']), quote: strV(r['förderquote']), kurz: strV(r.kurzname), gross: norm(r['großförderer']) === 'ja', hoeheVon: zahlOderLeer(r['förderhöhe von (€)']), hoeheBis: zahlOderLeer(r['förderhöhe bis (€)']) }));
  const zu = r => L.find(e => e.id === strV(r['förderer-id'])) || L.find(e => kkey(e.name) === kkey(r['förderer']));
  for (const r of tab('Ansprache')) { const e = zu(r); if (e && strV(r.gliederung)) e.ansprache.push({ gl: strV(r.gliederung), art: strV(r.ansprache), titel: strV(r['überschrift']), kopf: strV(r.kopfzeile), hinweis: strV(r.hinweis) }); }
  for (const r of tab('Kontakte')) { const e = zu(r); if (e && (strV(r.name) || strV(r['e-mail']) || strV(r.telefon))) e.kontakte.push(Object.assign(flKontaktLeer(), { n: strV(r.name), pos: strV(r.position), mail: mailRein(r['e-mail']), tel: cellStr(r.telefon), gl: strL(r.gliederungen), anschreiben: norm(r.anschreiben), notiz: strV(r.notiz) })); }
  for (const r of tab('Förderungen')) {
    const e = zu(r); if (!e || /^bedarfsliste$/i.test(strV(r.quelle))) continue;                     // die aus den Bedarfen liest das Programm selbst
    e.foerderungen.push(Object.assign(flFoerderungLeer(), { jahr: strV(r.jahr).replace(/\.0$/, ''), datum: xlDatum(r.datum), ergebnis: norm(r.ergebnis) === 'abgelehnt' ? 'abgelehnt' : 'gefördert', betrag: zahlOderLeer(r['betrag (€)']), zweck: strV(r['zweck / bedarf']), gl: strL(r.gliederungen), grund: strV(r['grund der absage']), quelle: strV(r.quelle) }));
  }
  for (const r of tab('Fördertöpfe')) { const e = zu(r); if (e && strV(r['fördertopf'])) { const t = Object.assign(flTopfLeer(strV(r['fördertopf'])), { kurz: strV(r.kurzname), schwer: strV(r['förderzweck']), gl: strL(r['fördergebiet']), hoehe: strV(r['förderhöhe']), quote: strV(r['förderquote']), hoeheVon: zahlOderLeer(r['förderhöhe von (€)']), hoeheBis: zahlOderLeer(r['förderhöhe bis (€)']),
      web: strV(r['homepage / portal']), richtlinien: strV(r['förderrichtlinien (link)']), weg: strL(r.antragsweg), antrag: strV(r['antrag an (e-mail oder portal-link)']), anschrift: strV(r.anschrift), recherche: xlDatum(r['recherche-stand']), fristen: strV(r['hinweis zu fristen']), notiz: strV(r.notizen), gross: norm(r['großförderer']) === 'ja' });
    FL_BEW.forEach(x => { t.bew[x.k] = flStufe(x, r[norm(x.t)]); }); e.topfe.push(t); } }
  if (blatt('Fristen')) for (const r of tab('Fristen')) { const e = zu(r), d = typeof r.frist === 'number' ? xlDatum(r.frist) : fristParse(cellStr(r.frist));
    if (e && d) (e.fristenL = e.fristenL || []).push({ d: norm(r['jedes jahr']) !== 'nein' && d.length > 5 ? d.slice(5) : d, topf: strV(r['fördertopf']) }); }   // jedes Jahr: nur Tag und Monat
  else L.forEach(e => { delete e.fristenL; });                                          // ältere Excel: Termine aus dem Fristen-Text
  const tf = blatt('Fördertöpfe'); if (tf && (tf.rows[0] || []).some(c => norm(cellStr(c)) === 'notizen')) L.forEach(e => { e.topfMig = true; });   // Blatt ab 0.111: die Töpfe haben ihre Angaben schon, nichts mehr vom Förderer erben
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
    'Förderer': L.map(e => [e.id, e.name, e.art, e.status, j(e.gl), j(e.weg), e.anschrift, e.web, e.schwer, flHoeheKlar(e), e.fristen, e.richtlinien, e.recherche, e.notiz, ...FL_BEW_XL.map(x => e.bew[x.k] ? x.st[e.bew[x.k] - 1] : ''), e.antrag, e.quote, e.kurz, e.gross ? 'ja' : '', e.hoeheVon ?? '', e.hoeheBis ?? '']),
    'Ansprache': L.flatMap(e => e.ansprache.map(a => [e.id, e.name, a.gl, a.art, a.hinweis, a.titel, a.kopf])),
    'Kontakte': L.flatMap(e => e.kontakte.map(k => [e.id, e.name, k.n, k.pos, k.mail, k.tel, j(k.gl), k.anschreiben, k.notiz])),
    'Fristen': L.flatMap(e => e.fristenL.map(f => [e.id, e.name, fristText(f.d), f.d.length === 5 ? 'ja' : 'nein', f.topf])),
    'Fördertöpfe': L.flatMap(e => e.topfe.map(t => [e.id, e.name, t.name, t.kurz, t.schwer, j(t.gl), flHoeheKlar(t), t.quote, t.hoeheVon ?? '', t.hoeheBis ?? '', t.web, t.richtlinien, j(t.weg), t.antrag, t.anschrift, t.recherche, t.fristen, t.notiz, t.gross ? 'ja' : '',
      ...['chance', 'dauer', 'summe', 'haeufig', 'aufwand'].map(k => { const x = FL_BEW.find(y => y.k === k); return t.bew[k] ? x.st[t.bew[k] - 1] : ''; })])),
    'Förderungen': L.flatMap(e => flHistorie(e).map(x => [e.id, e.name, +x.jahr || x.jahr || '', x.datum || '', x.ergebnis, x.betrag, x.zweck, j(x.gl || []), x.grund || '', x.quelle, x.bedarfId || ''])),
  };
}
function flBlob(Z = flExportZeilen()) {
  const kopf = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, z = { border: 'thin', v: 'top', wrap: true };
  const breiten = { 'Förderer': [7, 34, 18, 11, 26, 16, 30, 34, 34, 16, 18, 26, 13, 40, 14, 11, 13, 17, 15, 34, 26, 14, 14, 14, 14], 'Ansprache': [11, 30, 22, 18, 60, 30, 24], 'Kontakte': [11, 30, 26, 24, 34, 18, 24, 12, 30], 'Förderungen': [11, 30, 7, 11, 11, 11, 40, 24, 30, 16, 12], 'Fristen': [11, 30, 12, 11, 30], 'Fördertöpfe': [11, 30, 30, 18, 34, 26, 22, 26, 14, 14, 30, 30, 12, 30, 30, 13, 26, 40, 12, 14, 11, 13, 17, 15] };
  const datum = { 'Förderer': [12], 'Förderungen': [3], 'Fördertöpfe': [15] }, txt = { 'Kontakte': [5] }, listen = { 'Förderer': [[2, FL_ARTEN], [3, FL_STATUS], ...FL_BEW_XL.map((x, i) => [14 + i, x.st])], 'Ansprache': [[3, FL_ANSPRACHE]], 'Kontakte': [[7, ['ja', 'nein']]], 'Förderungen': [[4, ['gefördert', 'abgelehnt']]], 'Fristen': [[3, ['ja', 'nein']]] };
  const sheets = Object.keys(FL_SP).map(name => {
    const R = Z[name], n = R.length + 1, last = colName(FL_SP[name].length - 1);
    return { name, cols: breiten[name], freeze: 'C2', filter: 'A1:' + last + n, heights: { 0: 30 },
      rows: [FL_SP[name].map(v => ({ v, st: kopf })), ...R.map(r => r.map((v, i) => ({ v: v == null ? '' : v, st: z, t: (datum[name] || []).includes(i) && validIso(v) ? 'd' : (txt[name] || []).includes(i) ? 'txt' : undefined })))],
      lists: (listen[name] || []).map(([i, items]) => ({ ref: colName(i) + '2:' + colName(i) + (n + 200), items })) };
  });
  sheets.push({ name: 'Anleitung', cols: [120], grid: false, rows: [[{ v: 'Fördererliste der Bedarfsliste', st: { b: true, sz: 15 } }], [],
    ...['Diese Datei schreibt die Bedarfsliste nach jedem Speichern neu – gepflegt wird die Fördererliste im Programm (Reiter „Fördererliste“). Änderungen hier gehen beim nächsten Speichern verloren.',
      'Blatt „Förderer“: je Förderer eine Zeile; die ID (F001 …) verbindet die Blätter. „Ansprache“: je Förderer und Gliederung frei / über die Gliederung / nicht anschreiben.',
      'Erfolgschance, Dauer, Fördersumme, Häufigkeit, Aufwand: von Hand eingeschätzt (Auswahl in der Zelle); leer = das Programm schätzt aus den Förderungen und Absagen, soweit möglich (den Aufwand nicht).',
      'Blatt „Ansprache“: Hinweise je Förderer – „hinweis“ (gelb) oder „nicht anschreiben“ (rot), mit Kopfzeile, Überschrift und Text; Gliederung leer = gilt für alle.',
      'Blatt „Fristen“: je Frist eine Zeile – „31.03.“ mit „jedes Jahr: ja“ gilt jährlich, „31.03.2027“ einmalig; dazu optional der Fördertopf. „Fristen“ bei den Förderern ist nur noch ein Hinweis (z. B. laufend).',
      'Blatt „Fördertöpfe“: je Fördertopf (z. B. ein Programm der Aktion Mensch) eine Zeile mit allem, was für ihn gilt: Zweck, Gebiet, Förderhöhe, Quote, Homepage, Antragsweg, Einschätzung, Großförderer und Notizen (hat ein Förderer Fördertöpfe, stehen Steckbrief, Einschätzung und Notizen dort, nicht mehr beim Förderer); der Name verbindet ihn mit den Fristen. „Kurzname“ bei den Förderern: so heißt der Förderer intern (z. B. DSEE) – in den Bedarfen gelten Kurzname und voller Name.',
      '„Großförderer“: ja = in der Fördererliste mit kleiner Krone (> 10.000 € möglich); im Programm über die Krone neben „> 3.000 €“ im Netz.',
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
  if (B.length) { const m = mitte(B); R.summe = { v: m > 3000 ? 3 : m > 1000 ? 2 : 1, grund: 'üblich rund ' + eur(Math.round(m)) + ' (' + B.length + (B.length === 1 ? ' Förderung)' : ' Förderungen)') }; }
  const T = D.bedarfe.flatMap(b => b.foerderer.filter(f => f.flId === e.id && (f.status === 'zugesagt' || f.status === 'abgelehnt') && validIso(f.beantragtAm) && validIso(f.entscheidungAm))
    .map(f => (Date.parse(f.entscheidungAm) - Date.parse(f.beantragtAm)) / 864e5)).filter(d => d >= 0);
  if (T.length) { const d = mitte(T); R.dauer = { v: d < 61 ? 3 : d <= 183 ? 2 : 1, grund: 'Antwort nach ' + dauerText(d) + ' (' + T.length + (T.length === 1 ? ' Antrag)' : ' Anträge)') }; }
  // Häufigkeit aus den Jahren der Förderungen: mehrere in einem Jahr, in aufeinanderfolgenden Jahren oder nur mit Abstand (eine allein sagt nichts)
  const J = G.map(x => +String(x.datum || x.jahr || '').slice(0, 4)).filter(j => j > 1990), Y = uniq(J).sort((a, c) => a - c);
  const mehr = Y.find(y => J.filter(j => j === y).length > 1), folge = Y.find((y, i) => i && y - Y[i - 1] === 1);
  if (mehr) R.haeufig = { v: 3, grund: J.filter(j => j === mehr).length + ' Förderungen in ' + mehr };
  else if (folge) R.haeufig = { v: 2, grund: 'gefördert ' + (folge - 1) + ' und ' + folge };
  else if (Y.length > 1) R.haeufig = { v: 1, grund: 'gefördert ' + Y.join(', ') };
  return R;
}
// aktueller Fördertopf der Seite (ohne Töpfe: null); Träger = der Topf, sonst der Förderer selbst
const flTopfWahl = e => e.topfe.length ? (e.topfe.find(t => t.id === UI.flTopf) || e.topfe[0]) : null;
const flTraeger = e => flTopfWahl(e) || e;
// aus den Daten geschätzt: Förderungen und Absagen gehören zum Förderer, nicht zu einem Topf – mit mehreren Töpfen deshalb keine Schätzung je Topf
// Fördersumme zusätzlich aus der Förderhöhe im Steckbrief des Trägers (Förderer oder Topf), wenn die Förderungen nichts hergeben; bei „von … bis“ zählt die Mitte
function flBewHoehe(o) {
  const v = o.hoeheVon, b = o.hoeheBis; if (v == null && b == null) return null;
  const m = ((v == null ? b : v) + (b == null ? v : b)) / 2;
  return { v: m > 3000 ? 3 : m > 1000 ? 2 : 1, grund: 'Förderhöhe ' + flHoeheKlar(o) };
}
const flAutoFuer = (e, t) => { const A = t && e.topfe.length > 1 ? {} : flBewAuto(e); if (A.summe) return A; const H = flBewHoehe(t || e); return H ? Object.assign({}, A, { summe: H }) : A; };
function flBew(e, t) {
  const A = flAutoFuer(e, t), bw = (t || e).bew;
  return Object.fromEntries(FL_BEW.map(x => [x.k, bw[x.k] ? { v: bw[x.k], hand: true, grund: 'von Hand eingeschätzt' } : A[x.k] ? Object.assign({ hand: false }, A[x.k]) : { v: 0, hand: false, grund: '' }]));
}
// Übersicht und Suche: mit mehreren Töpfen je Achse der beste Wert
function flBewFuer(e, t) {
  if (t || !e.topfe.length) return flBew(e, t);
  const L = e.topfe.map(x => flBew(e, x));
  return Object.fromEntries(FL_BEW.map(x => [x.k, L.reduce((b, B) => B[x.k].v > b.v ? B[x.k] : b, { v: 0, hand: false, grund: '' })]));
}
// Angaben des Förderers für Liste, Suche und Kartei: ohne Töpfe er selbst, sonst zusammengefasst aus seinen Fördertöpfen
function flEff(e, T0) {
  if (!e.topfe.length) return e;
  const T = T0 && T0.length ? T0 : e.topfe, erst = k => (T.find(t => strV(t[k])) || {})[k] || '';
  return Object.assign({}, e, { gl: T.some(t => t.gl.some(g => /^alle$/i.test(g))) ? ['alle'] : uniq(T.flatMap(t => t.gl)), schwer: uniq(T.flatMap(t => flKomma(t.schwer).split(', ').filter(Boolean))).join(', '),
    weg: (T.find(t => t.weg.length) || { weg: [] }).weg, web: erst('web'), antrag: erst('antrag'), gross: T.some(t => t.gross), quote: erst('quote'), fristen: T.map(t => strV(t.fristen)).filter(Boolean).join('; '), notiz: T.map(t => strV(t.notiz)).filter(Boolean).join('\n\n') });
}
const flBewText = (B, x) => x.t + ': ' + (B[x.k].v ? x.st[B[x.k].v - 1] + (B[x.k].hand ? '' : ' (geschätzt: ' + B[x.k].grund + ')') : 'noch nicht eingeschätzt');
// Netz mit fünf Achsen (Fünfeck): oben Erfolgschance, im Uhrzeigersinn Fördersumme, Häufigkeit, Aufwand, Dauer; je weiter außen, desto günstiger.
// Groß (Seite eines Förderers): die Ecken lassen sich ziehen (auch mit den Pfeiltasten), unter jeder Achse steht, was der Wert bedeutet;
// ganz zur Mitte gezogen oder doppelt geklickt: wieder aus den Daten geschätzt
const FN_KLEIN = { W: 50, H: 44, R: 21, cx: 25, cy: 23, y0: 0 }, FN_GROSS = { W: 380, H: 262, R: 82, cx: 190, cy: 140, y0: 0 };
const FN_WI = Object.fromEntries(FL_BEW.map((x, i) => [x.k, -90 + i * 360 / FL_BEW.length]));
const fnPt = (G, k, r) => { const a = FN_WI[k] * Math.PI / 180; return [G.cx + r * Math.cos(a), G.cy + r * Math.sin(a)]; };
const fnP = (G, k, r) => fnPt(G, k, r).map(n => n.toFixed(1)).join(',');
const fnPoly = (G, V) => FL_BEW.map(x => fnP(G, x.k, G.R * (V[x.k] || 0) / 3)).join(' ');
const fnGriffR = (G, v) => v ? G.R * v / 3 : G.R * .14;
const fnWert = (x, b, such) => b.v ? x.bed[b.v - 1] : such ? 'egal' : 'noch offen';
// Beschriftung neben der Ecke: oben darüber, sonst seitlich nach außen (obere Ecken auf Höhe der Ecke, untere darunter); Name, darunter Bedeutung (+14) und „geschätzt“ (+27)
const fnText = (G, k, gross) => { const [px, py] = fnPt(G, k, G.R), a = FN_WI[k] * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  if (Math.abs(c) < .01) return { x: px, y: py - (gross ? 44 : 5), a: 'middle' };
  return { x: px + (c > 0 ? 1 : -1) * (gross ? (s > 0 ? 6 : 12) : (s > 0 ? 2 : 4)), y: py + (gross ? (s > 0 ? 20 : -6) : (s > 0 ? 10 : 3)), a: c > 0 ? 'start' : 'end' }; };
function flNetz(e, gross, o = {}) {
  const bt = o.t || e, B = gross && !o.such ? flBew(e, o.t) : flBewFuer(e, o.t), G = gross ? FN_GROSS : FN_KLEIN, V = Object.fromEntries(FL_BEW.map(x => [x.k, B[x.k].v]));
  const gitter = [1, 2, 3].map(i => `<polygon class="fn-g" points="${FL_BEW.map(x => fnP(G, x.k, G.R * i / 3)).join(' ')}"/>`).join('')
    + FL_BEW.map(x => { const [px, py] = fnPt(G, x.k, G.R); return `<line class="fn-g" x1="${G.cx}" y1="${G.cy}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}"/>`; }).join('');
  const hat = FL_BEW.some(x => B[x.k].v), nurGeschaetzt = FL_BEW.every(x => !B[x.k].v || !B[x.k].hand);
  const flaeche = `<polygon class="fn-w${nurGeschaetzt ? ' geschaetzt' : ''}${hat ? '' : ' leer'}" points="${fnPoly(G, V)}"/>`;
  if (!gross) {                                                                  // Liste: nur das Netz; beim Überfahren der Zeile wird es größer und die Beschriftung erscheint (CSS)
    const punkte = FL_BEW.filter(x => B[x.k].v).map(x => { const [px, py] = fnPt(G, x.k, G.R * B[x.k].v / 3); return `<circle class="fn-p${B[x.k].hand ? '' : ' auto'}" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2"/>`; }).join('');
    const lab = x => { const L = fnText(G, x.k, false); return `<text class="fn-l${B[x.k].v ? '' : ' leer'}" x="${L.x.toFixed(1)}" y="${L.y.toFixed(1)}" text-anchor="${L.a}">${x.kurz}</text>`; };
    return `<span class="fl-netz"><svg viewBox="0 0 ${G.W} ${G.H}" width="${G.W}" height="${G.H}" role="img" aria-label="${esc(FL_BEW.map(x => flBewText(B, x)).join(', '))}"><rect class="fn-bg" x="-38" y="-15" width="126" height="72" rx="8"/><circle class="fn-treff" cx="${G.cx}" cy="${G.cy}" r="${G.R + 3}"/>${gitter}${flaeche}${punkte}${FL_BEW.map(lab).join('')}</svg></span>`;
  }
  const A = flAutoFuer(e, o.t);
  const griff = x => { const b = B[x.k], [px, py] = fnPt(G, x.k, fnGriffR(G, b.v));
    return `<g class="fn-griff ${b.hand ? 'hand' : b.v ? 'auto' : 'offen'}" data-k="${x.k}" transform="translate(${px.toFixed(1)} ${py.toFixed(1)})" tabindex="0" role="slider" aria-label="${x.t}" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${b.hand ? b.v : 0}" aria-valuetext="${esc(fnWert(x, b, o.such))}">`
      + `<title>${esc(x.t + ': ' + fnWert(x, b, o.such) + (b.hand ? ' – von Hand' : b.v ? ' – geschätzt: ' + b.grund : '') + '. Ziehen zum Einschätzen, Doppelklick: wieder aus den Daten')}</title><circle class="fn-hit" r="15"/><circle class="fn-h" r="5.5"/></g>`; };
  // Beschriftung: Name, darunter die Bedeutung der Stufe und ggf. „geschätzt“
  const texte = x => { const b = B[x.k], L = fnText(G, x.k, true), X = L.x.toFixed(1), at = `x="${X}" text-anchor="${L.a}"`;
    return `<text class="fn-l" ${at} y="${L.y.toFixed(1)}">${x.t}</text>`
      + `<text class="fn-v${b.hand ? '' : b.v ? ' geschaetzt' : ' leer'}" data-k="${x.k}" ${at} y="${(L.y + 14).toFixed(1)}"><title>${esc(b.v && !b.hand ? 'geschätzt: ' + b.grund : '')}</title>${esc(fnWert(x, b, o.such))}</text>`
      + `<text class="fn-s" data-k="${x.k}" ${at} y="${(L.y + 27).toFixed(1)}">${b.v && !b.hand ? 'geschätzt' : ''}</text>`
      + (x.k === 'summe' && !o.such && (b.v === 3 || bt.gross) ? `<g class="fn-krone${bt.gross ? ' an' : ''}" data-act="fl-krone" data-tip="> 10.000 € möglich" role="button" tabindex="0" aria-pressed="${!!bt.gross}" aria-label="Großförderer: > 10.000 € möglich" transform="translate(${(L.x + (b.v === 3 ? 62 : 6)).toFixed(1)} ${(L.y + 2).toFixed(1)})"><rect x="-4" y="-3" width="24" height="20" fill="transparent"/><g transform="scale(.9)">${ICON_KRONE.replace(/^<svg[^>]*>/, '').replace('</svg>', '')}</g></g>` : ''); };
  return `<span class="fl-netz gross zieh${o.such ? ' such' : ''}"><svg viewBox="0 ${G.y0} ${G.W} ${G.H}" width="100%" role="group" aria-label="${o.such ? 'Mindestwerte für die Suche' : 'Einschätzung'}"${o.such ? ' data-such="1"' : ''}
    data-hand="${esc(JSON.stringify(bt.bew))}" data-auto="${esc(JSON.stringify(Object.fromEntries(FL_BEW.map(x => [x.k, A[x.k] ? A[x.k].v : 0]))))}">${gitter}${flaeche}${FL_BEW.map(texte).join('')}${FL_BEW.map(griff).join('')}</svg></span>`;
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
  const t = svg.querySelector(`.fn-v[data-k="${k}"]`); t.textContent = fnWert(x, b, !!svg.dataset.such); t.setAttribute('class', 'fn-v' + (b.hand ? '' : b.v ? ' geschaetzt' : ' leer'));
  svg.querySelector(`.fn-s[data-k="${k}"]`).textContent = b.v && !b.hand ? 'geschätzt' : '';
}
// Suche nach Einschätzung (ab 0.100): ein Netz mit Mindestwerten – gezeigt werden Förderer mit diesem Wert oder einem besseren (weiter außen); 0 = egal
const flQNull = () => Object.fromEntries(FL_BEW.map(x => [x.k, 0]));
const flQEintrag = () => ({ id: '#such', foerderungen: [], topfe: [], bew: Object.assign(flQNull(), UI.flBewQ) });
const flQAktiv = () => FL_BEW.some(x => (UI.flBewQ || {})[x.k] > 0);
function flListeNeu() { swap('fl-body', flZeilen(), true); const c = $('#fl-count'); if (c) c.textContent = flGefiltert().length + ' von ' + D.fl.liste.length + ' Förderern'; const n = $('#fl-such-n'); if (n) n.textContent = flGefiltert().length + ' Treffer'; const l = $('.fl-lupe'); if (l) l.classList.toggle('an', flQAktiv()); }
function fnSuchSetzen(k, v) {
  if ((UI.flBewQ[k] || 0) === v) return; UI.flBewQ[k] = v;
  const n = $('.fl-such .fl-netz'); if (n) n.outerHTML = flNetz(flQEintrag(), true, { such: true });
  flListeNeu(); const g = $(`.fl-such .fn-griff[data-k="${k}"]`); if (g) g.focus({ preventScroll: true });
}
function fnSetzen(k, v, such) { if (such) return fnSuchSetzen(k, v); const e = flCur(), W = e && flTraeger(e); if (!W || !(k in W.bew) || W.bew[k] === v) return; W.bew[k] = v; changed(); keep(renderNow); const g = $(`.fl-netz.zieh .fn-griff[data-k="${k}"]`); if (g) g.focus({ preventScroll: true }); }
document.addEventListener('pointerdown', ev => {
  const g = ev.target.closest && ev.target.closest('.fl-netz.zieh .fn-griff'); if (!g || ev.button !== 0) return;
  ev.preventDefault(); g.focus({ preventScroll: true }); g.setPointerCapture(ev.pointerId);
  FN_ZIEH = { g, k: g.dataset.k, svg: g.ownerSVGElement, v: null }; g.classList.add('aktiv'); FN_ZIEH.svg.parentNode.classList.add('zieht');
});
document.addEventListener('pointermove', ev => { if (!FN_ZIEH) return; const v = fnStufe(FN_ZIEH.svg, FN_ZIEH.k, ev); if (v !== FN_ZIEH.v) { FN_ZIEH.v = v; fnZeigen(FN_ZIEH.svg, FN_ZIEH.k, v); } });
const fnLos = () => { if (!FN_ZIEH) return; const z = FN_ZIEH; FN_ZIEH = null; z.g.classList.remove('aktiv'); z.svg.parentNode.classList.remove('zieht'); if (z.v != null) fnSetzen(z.k, z.v, !!z.svg.dataset.such); };
document.addEventListener('pointerup', fnLos); document.addEventListener('pointercancel', fnLos);
document.addEventListener('dblclick', ev => { const g = ev.target.closest && ev.target.closest('.fl-netz.zieh .fn-griff'); if (g) fnSetzen(g.dataset.k, 0, !!g.closest('.fl-such')); });
document.addEventListener('keydown', ev => {
  const g = ev.target.closest && ev.target.closest('.fl-netz.zieh .fn-griff'); if (!g) return;
  const such = !!g.closest('.fl-such'), e = such ? flQEintrag() : flCur(), k = g.dataset.k; if (!e) return;
  const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[ev.key];
  if (d) { ev.preventDefault(); ev.stopPropagation(); fnSetzen(k, Math.max(0, Math.min(3, (such ? e.bew[k] || 0 : flBew(e, flTopfWahl(e))[k].v) + d)), such); }   // vom angezeigten Wert aus, auch wenn er geschätzt ist
  else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); fnSetzen(k, 0, such); }
}, true);
// Fristen dieses Jahres aus dem Text („31.03. und 30.09.“, „bis 15.10.2026“): Tage ohne Jahr gelten jedes Jahr
function flFristenJahr(t, jahr = +today().slice(0, 4)) {
  const L = [], re = /(?<![\d.])(\d{1,2})\.(\d{1,2})\.(?:(\d{4}|\d{2})(?!\d))?/g; let m;
  while ((m = re.exec(t || ''))) { const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(jahr), iso = y + '-' + z2(m[2]) + '-' + z2(m[1]); if (validIso(iso) && +y === jahr && !L.includes(iso)) L.push(iso); }
  return L.sort();
}
function flFristenDaten(e, jahr = +today().slice(0, 4)) {
  return e.fristenL.map((f, i) => ({ i, topf: f.topf, einmalig: f.d.length > 5, iso: f.d.length === 5 ? jahr + '-' + f.d : f.d }))
    .filter(x => validIso(x.iso) && (!x.einmalig || +x.iso.slice(0, 4) >= jahr)).sort((a, c) => a.iso.localeCompare(c.iso));
}
const fristStand = (x, L, heute = today()) => { const t = Math.round((Date.parse(x.iso) - Date.parse(heute)) / 864e5), n = L.find(y => y.topf === x.topf && y.iso >= heute);
  return { t, st: x.iso < heute ? 'vorbei' : n === x ? (t <= 21 ? 'bald' : 'naechste') : 'spaeter' }; };
// Hinweis zu Fristen: nach jedem „;“ eine neue Zeile
const flSemikolon = t => String(t || '').replace(/;[ \t]*/g, ';\n');
function flFristenHtml(e) {
  const L = flFristenDaten(e).map(x => x.iso), heute = today();
  if (!L.length) return e.fristen ? `<span class="fl-ft" title="${esc(flKomma(e.fristen))}">${esc(flSemikolon(flPlain(e.fristen)))}</span>` : '<span class="muted">–</span>';
  const n = L.find(d => d >= heute);
  return `<span class="fl-fds" title="${esc(flPlain(e.fristen))}">` + L.map(d => { const t = Math.round((Date.parse(d) - Date.parse(heute)) / 864e5);
    return `<span class="fl-fd${d < heute ? ' vorbei' : ''}${d === n ? ' naechste' : ''}${d === n && t <= 21 ? ' bald' : ''}" title="${d < heute ? 'vorbei' : t === 0 ? 'heute' : 'in ' + t + (t === 1 ? ' Tag' : ' Tagen')}">${fmtDate(d).slice(0, 6)}</span>`; }).join('') + '</span>';
}

// ---------- Seite „Fördererliste“: weißer Kasten wie die Bedarfsliste. Einstieg ist meist eine Gliederung, die nach Fördermöglichkeiten fragt:
// Filter oder Suche nach der Gliederung (zählt auch Förderer für „alle“), je Förderer Gebiet, Zweck, Fristen dieses Jahres, Einschätzung, Ansprechperson
const flDaten = () => D.fl;
const flInGl = (e, g) => e.gl.some(x => norm(x) === g || /^alle$/i.test(x));
// Treffer der Übersicht: je Förderer die Töpfe, die zu Suche, Gliederung und Mindestwerten passen (ohne Töpfe: null)
function flTreffer() {
  const q = norm(UI.flq), gl = norm(UI.flGl || ''), L = flDaten().liste;
  const glBekannt = new Set([...L.flatMap(e => flEff(e).gl), ...D.bedarfe.map(b => b.gliederung)].map(norm).filter(g => g && g !== 'alle'));
  const Q = UI.flBewQ || {}, ks = FL_BEW.filter(x => Q[x.k] > 0);                // Suche nach Einschätzung: mindestens diese Stufe (gezeigter Wert, auch geschätzt)
  const glTeil = q.length >= 3 && [...glBekannt].some(g => g.includes(q));       // Teil eines Gliederungsnamens: Förderer dieser Gliederung und „alle Gliederungen“ – einheitlich, ob ausgeschrieben oder nicht
  const alle = x => /^alle$/i.test(x);
  const glOk = c => !gl || c.gl.some(x => norm(x) === gl || alle(x));
  const netOk = (e, c) => !ks.length || (B => ks.every(x => B[x.k].v >= Q[x.k]))(c === e ? flBewFuer(e) : flBew(e, c));
  const qTraeger = c => !q || (glTeil && c.gl.some(x => norm(x).includes(q) || alle(x))) || (glBekannt.has(q) && c.gl.some(x => norm(x) === q || alle(x)))
    || [c.name || '', c.kurz || '', c.notiz, c.schwer, c.quote, ...c.gl].some(t => norm(t).includes(q));
  const qFoerderer = e => !q || [e.name, e.kurz, e.art, ...e.kontakte.map(k => k.n + ' ' + k.pos)].some(t => norm(t).includes(q));
  const R = [];
  for (const e of L) {
    if (!e.topfe.length) { if (glOk(e) && netOk(e, e) && (qFoerderer(e) || qTraeger(e))) R.push({ e, T: null }); continue; }
    const T = e.topfe.filter(t => glOk(t) && netOk(e, t) && (qFoerderer(e) || qTraeger(t)));
    if (T.length) R.push({ e, T });
  }
  return R.sort((a, c) => a.e.name.localeCompare(c.e.name, 'de'));
}
const flGefiltert = () => flTreffer().map(x => x.e);
const ICON_JA = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_NEIN = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
// Ansprechperson für die Übersicht: wer angeschrieben werden darf (für die gewählte Gliederung), sonst wer nicht ausgeschlossen ist
function flKontaktHaupt(e) {
  const gl = norm(UI.flGl || ''), passt = k => !gl || !k.gl.length || k.gl.some(g => norm(g) === gl || /^alle$/i.test(g));
  return e.kontakte.filter(k => k.n.trim() && k.anschreiben !== 'nein' && passt(k)).sort((a, c) => (c.anschreiben === 'ja') - (a.anschreiben === 'ja'))[0] || null;
}
const flKontaktKnoepfe = k => { const tel = telNr(k.tel); return (tel ? `<a class="fl-fi" href="tel:${tel}" data-act="link" data-tip="${esc(k.tel)}" aria-label="Anrufen: ${esc(k.tel)}">☎</a>` : '')
  + (k.mail ? `<a class="fl-fi" href="mailto:${esc(k.mail)}" data-act="link" data-tip="${esc(k.mail)}" aria-label="E-Mail an ${esc(k.mail)}">✉</a>` : ''); };
const flKomma = t => String(t || '').split(/\n+/).map(x => flPlain(x)).filter(Boolean).join(', ');
const flGebiet = e => e.gl.map(g => /^alle$/i.test(g) ? 'alle Gliederungen' : UI.flGl && norm(g) === norm(UI.flGl) ? `<b>${esc(g)}</b>` : esc(g)).join(', ');
function flZeilen() {
  const R = flTreffer();
  if (!R.length) return `<tr><td colspan="7"><div class="empty">${flDaten().liste.length ? 'Kein Förderer passt zur Suche.' : 'Noch keine Fördererliste – „Excel ▾ → Excel einlesen …“ übernimmt die umgebaute Fördererliste.'}</div></td></tr>`;
  const krone = g => g ? `<span class="fl-krone-l" data-tip="> 10.000 € möglich">${ICON_KRONE}</span>` : '';
  const gebiet = e => e.gl.length ? `<div class="fl-clamp" data-tip="${esc(e.gl.map(g => /^alle$/i.test(g) ? 'alle Gliederungen' : g).join(', '))}">${flGebiet(e)}</div>` : '<span class="muted">–</span>';
  const zweck = e => e.schwer ? `<div class="fl-clamp" data-tip="${esc(flKomma(e.schwer))}">${esc(flKomma(e.schwer))}</div>` : '<span class="muted">–</span>';
  return R.flatMap(({ e: e0, T }) => {
    const gruppe = e0.topfe.length >= 2, zu = gruppe && !!UI.flZu[e0.id], e = flEff(e0, gruppe ? T : null), ansp = e.ansprache.filter(a => !UI.flGl || !a.gl || norm(a.gl) === norm(UI.flGl));
    const lauf = flLaufend(e).filter(x => !x.b.archiv && !x.b.manuell), bea = lauf.filter(x => x.f.status === 'beantragt'), k = flKontaktHaupt(e), ruht = e0.status !== 'aktiv' ? ' fl-ruht' : '';
    const laufZ = bea.length ? 'Antrag läuft: ' + bea.map(x => short(x.b.titel)).join(', ') : lauf.length ? 'eingeplant: ' + lauf.map(x => short(x.b.titel)).join(', ') : '';
    const hinweis = ansp.length ? `<div class="fl-ansp" title="${esc(ansp.map(a => (a.gl || 'alle') + ': ' + (a.titel || 'Hinweis') + (a.hinweis ? ' – ' + flPlain(a.hinweis) : '')).join('\n'))}">${ICON_TRI}<span>${UI.flGl ? esc(ansp[0].titel || 'Hinweis') : esc(ansp.map(a => a.gl || 'alle').join(', ')) + ': ' + esc(ansp[0].titel || 'Hinweis')}</span></div>` : '';
    const kontakt = (rs) => `<td class="fl-k${rs ? ' fl-rs' : ''}"${rs ? ` rowspan="${rs}" data-act="fl-oeffnen" data-id="${e0.id}"` : ''}>${k ? `<div class="fl-kp"><div><span class="fl-kn">${esc(k.n)}</span>${k.pos ? `<div class="muted small">${esc(k.pos)}</div>` : ''}</div><span class="fl-fis">${flKontaktKnoepfe(k)}</span></div>` : '<span class="muted">–</span>'}</td>`;
    const status = e0.status !== 'aktiv' ? `<div class="muted small">${esc(e0.status)}</div>` : '', lz = laufZ ? `<div class="fl-lz small${bea.length ? ' an' : ''}">${esc(laufZ)}</div>` : '';
    if (!gruppe) return [`<tr data-act="fl-oeffnen" data-id="${e0.id}" tabindex="0" class="${ruht.trim()}">
      <td class="fl-n" colspan="2"><b class="fl-nm">${krone(e.gross)}${esc(e.name || '(ohne Namen)')}</b>${e.kurz ? ` <span class="fl-kurz">(${esc(e.kurz)})</span>` : ''}${hinweis}${status}${lz}</td>
      <td class="fl-g">${gebiet(e)}</td><td class="fl-z">${zweck(e)}</td><td class="fl-tf">${flFristenHtml(e)}</td><td class="fl-te">${flNetz(e0)}</td>${kontakt(0)}</tr>`];
    // mehrere Fördertöpfe: eine hohe Zeile – links der Förderer (Kurzform), rechts daneben die Töpfe untereinander, je Topf eine eigene Zeile
    const kurzname = e0.kurz || e0.name || '(ohne Namen)', tip = e0.kurz && e0.name ? ` data-tip="${esc(e0.name)}"` : '';
    const schalter = `<button class="fl-tg" data-act="fl-zu" data-id="${e0.id}" aria-expanded="${!zu}" title="Fördertöpfe ${zu ? 'zeigen' : 'einklappen'}">${zu ? '▸' : '▾'} ${T.length}${T.length < e0.topfe.length ? ' von ' + e0.topfe.length : ''} Fördertöpfe</button>`;
    const links = rs => `<td class="fl-n${rs ? ' fl-rs' : ''}"${rs ? ` rowspan="${rs}"` : ''} data-act="fl-oeffnen" data-id="${e0.id}"${tip}><b class="fl-nm">${krone(e.gross)}${esc(kurzname)}</b>${hinweis}${status}${lz}${schalter}</td>`;
    if (zu) return [`<tr data-act="fl-oeffnen" data-id="${e0.id}" tabindex="0" class="fl-kopf-tr${ruht}">${links(0)}<td class="fl-tn muted"><div class="fl-clamp">${esc(T.map(t => t.name || '(ohne Namen)').join(', '))}</div></td>
      <td class="fl-g">${gebiet(e)}</td><td class="fl-z">${zweck(e)}</td><td class="fl-tf">${flFristenHtml(e)}</td><td class="fl-te"></td>${kontakt(0)}</tr>`];
    return T.map((t, n) => {
      const et = Object.assign({}, e0, { fristenL: e0.fristenL.filter(f => f.topf === t.name || (!f.topf && t === e0.topfe[0])), fristen: t.fristen });
      return `<tr class="fl-tr-t${n === T.length - 1 ? ' fl-tr-letzte' : ''}${ruht}" data-act="fl-oeffnen" data-id="${e0.id}" data-topf="${t.id}" tabindex="0">${n ? '' : links(T.length)}
      <td class="fl-tn"><b class="fl-nm">${krone(t.gross)}${esc(t.name || '(ohne Namen)')}</b>${t.kurz ? ` <span class="fl-kurz">(${esc(t.kurz)})</span>` : ''}</td>
      <td class="fl-g">${gebiet(t)}</td><td class="fl-z">${zweck(t)}</td><td class="fl-tf">${flFristenHtml(et)}</td><td class="fl-te">${flNetz(e0, false, { t })}</td>${n ? '' : kontakt(T.length)}</tr>`; });
  }).join('');
}
function flBar() {
  const D0 = flDaten(), n = flGefiltert().length, GL = uniq(D0.liste.flatMap(e => flEff(e).gl)).filter(g => !/^alle$/i.test(g)).sort((a, c) => a.localeCompare(c, 'de'));
  return `<div class="subbar list-head fl-head">
      <span class="muted" id="fl-count">${n} von ${D0.liste.length} Förderern</span>
      <div class="tools">
        <select data-ui="flGl" class="fl-glw${UI.flGl ? ' an' : ''}" aria-label="Nach Gliederung filtern"><option value="">Gliederung: alle</option>${GL.map(x => `<option${x === UI.flGl ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <input type="search" id="flq" data-ui="flq" value="${esc(UI.flq || '')}" placeholder="Suchen: Name, Gliederung, Zweck …" aria-label="Förderer suchen (Strg+F)">
        <button data-act="fl-excel-menu" aria-haspopup="menu" title="Excel: herunterladen oder einlesen">Excel ▾</button>
      </div>
    </div>`;
}
const ICON_LUPE = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><circle cx="6.8" cy="6.8" r="4.3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 10l4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
function flSuchPanel() {
  return `<div class="fl-such" role="dialog" aria-label="Nach Einschätzung suchen">${flNetz(flQEintrag(), true, { such: true })}
    <div class="fl-such-f"><span id="fl-such-n">${flGefiltert().length} Treffer</span><button class="fl-such-r" data-act="fl-such-reset" data-tip="Zurücksetzen" aria-label="Zurücksetzen">↶</button></div></div>`;
}
function flListView() {
  return `<main class="fl-main"><section class="card list-card"><div class="tablewrap"><table class="list fl-tab"><colgroup><col style="width:12%"><col style="width:14%"><col style="width:13%"><col style="width:18%"><col style="width:16%"><col style="width:10%"><col style="width:17%"></colgroup><thead><tr><th colspan="2">Förderer</th><th>Fördergebiet</th><th>Förderzweck</th><th>Fristen ${today().slice(0, 4)}</th>
    <th class="fl-te">Einschätzung<button class="fl-lupe${flQAktiv() ? ' an' : ''}" data-act="fl-such" aria-expanded="${!!UI.flSuch}" aria-label="Nach Einschätzung suchen" data-tip="Nach Einschätzung suchen">${ICON_LUPE}</button>${UI.flSuch ? flSuchPanel() : ''}</th><th>Ansprechperson</th></tr></thead><tbody id="fl-body">${flZeilen()}</tbody></table></div></section></main>`;
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
// Förderhöhe: „von … € bis … €“ (nur Zahlen); nur ein Wert = fester Betrag, nur „bis“ = „bis … €“; ein älterer Freitext bleibt stehen, bis man neu einträgt
const flHoeheKlar = o => { const v = o.hoeheVon, b = o.hoeheBis;
  if (v == null && b == null) return flPlain(o.hoehe || '');
  const f = x => fmtNum(x) + ' €';
  return v == null ? 'bis ' + f(b) : b == null || v === b ? f(v) : 'von ' + f(v) + ' bis ' + f(b); };
const flHoeheZahlen = t => (String(t || '').match(/\d{1,3}(?:\.\d{3})+|\d+/g) || []).map(x => +x.replace(/\./g, '')).filter(x => x > 0);
function flHoeheEdit(el) {
  if (el.querySelector('.fl-hoehe-in')) return; const e = flCur(); if (!e) return;
  const pf = el.dataset.pf || '', o = pf ? getPath(e, pf.slice(0, -1)) : e; if (!o) return;
  let v0 = o.hoeheVon, b0 = o.hoeheBis;
  if (v0 == null && b0 == null && o.hoehe) { const Z = flHoeheZahlen(o.hoehe); if (Z.length >= 2) { v0 = Math.min(...Z); b0 = Math.max(...Z); } else if (Z.length === 1) { if (/\bbis\b|max/i.test(o.hoehe)) b0 = Z[0]; else v0 = Z[0]; } }
  const feld = (w, lab) => h('input', { type: 'text', inputmode: 'numeric', class: 'fl-hoehe-f', value: w == null ? '' : String(w), 'aria-label': lab, autocomplete: 'off', oninput: ev => { const a = ev.target; const n = a.value.replace(/\D/g, ''); if (n !== a.value) a.value = n; } });
  const von = feld(v0, 'Förderhöhe von (€)'), bis = feld(b0, 'Förderhöhe bis (€)'); let fertig = false;
  const wrap = h('div', { class: 'fl-hoehe-in' }, 'von ', von, ' € bis ', bis, ' €');
  const num = a => a.value ? +a.value : null;
  const ok = () => { if (fertig) return; fertig = true; let a = num(von), b = num(bis); if (a != null && b == null) b = a; if (a != null && b != null && a > b) [a, b] = [b, a];
    o.hoeheVon = a; o.hoeheBis = b; o.hoehe = ''; changed(); keep(renderNow); };
  wrap.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); ok(); } else if (ev.key === 'Escape') { ev.preventDefault(); fertig = true; keep(renderNow); } });
  wrap.addEventListener('focusout', () => setTimeout(() => { if (!fertig && !wrap.contains(document.activeElement)) ok(); }, 0));
  const val = el.querySelector('.val'); val.classList.remove('leer'); val.replaceChildren(wrap); el.classList.add('edit'); von.focus();
}
const flHoeheFeld = (o, pf) => { const t = flHoeheKlar(o);
  return `<div class="pe fl-fett fl-hoehe" data-act="fl-hoehe" data-pf="${pf}" tabindex="0" title="Klicken zum Bearbeiten"><div class="val${t ? '' : ' leer'}">${t ? esc(t) : 'Förderhöhe eintragen …'}</div>${ICON_PEN}</div>`; };
// Förderzweck: Freitext (zuerst) und Vorauswahl der Zwecke der Malteser (danach, mit Komma getrennt); Klick öffnet das Auswahlfeld
const flZweckFeld = (o, pf, ph) => `<div class="pe fl-zweck" data-act="fl-zweck" data-pf="${pf}" tabindex="0" title="Klicken zum Bearbeiten"><div class="val${o.schwer ? '' : ' leer'}">${o.schwer ? `<span class="pv fmt">${fmtText(o.schwer)}</span>` : esc(ph)}</div>${ICON_PEN}</div>`;
let ZW_POP = null;
function flZweckMenue(el) {
  const e = flCur(); if (!e || ZW_POP) return; const pf = el.dataset.pf || '', o = pf ? getPath(e, pf.slice(0, -1)) : e; if (!o) return;
  const lab = MHD_ZWECKE.map(z => z.k), istLab = t => lab.some(l => norm(l) === norm(t)), toks = String(o.schwer || '').split(',').map(t => t.trim()).filter(Boolean);
  const sel0 = new Set(toks.filter(istLab).map(norm)), frei = h('textarea', { rows: 2, class: 'fl-zweck-frei', placeholder: 'Freitext …', 'aria-label': 'Förderzweck als Freitext' });
  frei.value = toks.filter(t => !istLab(t)).join(', ');
  const cbs = MHD_ZWECKE.map(z => { const cb = h('input', { type: 'checkbox', checked: sel0.has(norm(z.k)) }); return { z, cb, el: h('label', { class: 'check fl-zweck-o' }, cb, ' ' + z.k) }; });
  const pop = h('div', { class: 'menu fl-zweck-pop', role: 'dialog', 'aria-label': 'Förderzweck' }, frei, h('div', { class: 'fl-zweck-l' }, ...cbs.map(c => c.el)));
  let fertig = false;
  const ok = () => { if (fertig) return; fertig = true; document.removeEventListener('mousedown', aussen, true); pop.remove(); ZW_POP = null;
    o.schwer = [frei.value.trim(), ...cbs.filter(c => c.cb.checked).map(c => c.z.k)].filter(Boolean).join(', '); changed(); keep(renderNow); };
  const aussen = ev => { if (!pop.contains(ev.target) && !el.contains(ev.target)) ok(); };
  frei.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ok(); } else if (ev.key === 'Escape') { fertig = true; document.removeEventListener('mousedown', aussen, true); pop.remove(); ZW_POP = null; } });
  ZW_POP = pop; document.body.append(pop); const r = el.getBoundingClientRect();
  Object.assign(pop.style, { left: Math.max(8, Math.min(r.left, innerWidth - 330)) + 'px', top: (r.bottom + 4) + 'px' });
  setTimeout(() => document.addEventListener('mousedown', aussen, true), 0); frei.focus();
}
// Links: ohne „https://“ angezeigt, beim Eintragen wird es wieder ergänzt
const flUrlAnz = v => String(v || '').replace(/^https?:\/\//i, '');
const flUrlVoll = v => { v = strV(v); return v && !/^[a-z][a-z0-9+.-]*:/i.test(v) && !/\s/.test(v) && !v.includes('@') ? 'https://' + v : v; };
const ICON_OEFFNEN = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10M9 2h5v5M14 2L7.5 8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_KRONE = '<svg viewBox="0 0 16 14" width="15" height="13" aria-hidden="true"><path d="M1.2 11.6L.9 3.6l3.7 3.4L8 1.6 11.4 7l3.7-3.4-.3 8z" fill="currentColor"/><rect x="1.2" y="11.9" width="13.6" height="1.5" rx=".6" fill="currentColor"/></svg>';
const flIn = (p, v, o = {}) => `<input type="text" class="fl-in${o.cls ? ' ' + o.cls : ''}" data-fl="${p}"${o.typ ? ` data-typ="${o.typ}"` : ''}${o.sug ? ` data-sug="${o.sug}" autocomplete="off"` : ''} value="${esc(v ?? '')}" placeholder="${esc(o.ph || '')}" aria-label="${esc(o.aria || o.ph || p)}"${o.title ? ` title="${esc(o.title)}"` : ''}>`;
const flTa = (p, v, o = {}) => `<textarea class="fl-in${o.cls ? ' ' + o.cls : ''}" rows="${o.rows || 2}" data-fl="${p}" placeholder="${esc(o.ph || '')}" aria-label="${esc(o.aria || o.ph || p)}">${esc(v || '')}</textarea>`;
const flSel = (p, v, L, o = {}) => `<select class="fl-in${o.cls ? ' ' + o.cls : ''}" data-fl="${p}" aria-label="${esc(o.aria || p)}">${(o.leer != null ? [['', o.leer]] : []).concat(L.map(x => Array.isArray(x) ? x : [x, x])).map(([x, l]) => `<option value="${esc(x)}"${x === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const FL_ANSP = { hinweis: { l: 'Hinweis (gelb)', sym: '!', cls: 'gl' }, 'nicht anschreiben': { l: 'Nicht anschreiben (rot)', sym: '✕', cls: 'nein' } };
const FL_QUELLE = q => q === 'Bedarfsliste' ? 'aus dem Bedarf' : /kartei/i.test(q) ? 'alte Kartei' : q === 'von Hand' || !q ? 'von Hand' : q;
// Gliederung, auf die sich die Seite bezieht: Filter der Übersicht oder eine Suche nach dem Namen einer Gliederung
function flKontextGl() {
  if (UI.flGl) return UI.flGl;
  const q = norm(UI.flq); if (!q) return '';
  return [...D.fl.liste.flatMap(e => flEff(e).gl), ...D.bedarfe.map(b => b.gliederung)].find(g => g && !/^alle$/i.test(g) && g !== DIO && norm(g) === q) || '';
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
// Kontakte bearbeiten: Ausgangsstand merken (für den Abgleich mit derselben Person bei anderen Förderern)
let FL_K0 = null;
function flKEditStart() { const e = flCur(); UI.flKEdit = true; FL_K0 = e ? JSON.parse(JSON.stringify(e.kontakte)) : null; }
// andere Förderer, bei denen dieselbe Person (gleicher Name) steht
const flAuchBei = (e, k) => kkey(k.n) ? D.fl.liste.filter(x => x !== e && x.kontakte.some(o => kkey(o.n) === kkey(k.n))) : [];
// Kontakte fertig bearbeitet (Fertig, anderer Förderer, zurück zur Liste): ganz leere fallen weg. Bei „Fertig“: hat sich E-Mail oder Telefon
// einer Person geändert, die auch bei anderen Förderern steht (z. B. Sparkasse und ihre Stiftung), einmal fragen, ob es dort mitgeändert wird
async function flKontakteFertig(fragen) {
  const e = flCur(), K0 = FL_K0 || []; UI.flKEdit = false; FL_K0 = null; if (!e) return;
  const L = e.kontakte.filter(k => [k.n, k.pos, k.mail, k.tel, k.notiz].some(x => strV(x)));
  if (L.length !== e.kontakte.length) { e.kontakte = L; changed(); }
  if (!fragen) return;
  const geaendert = e.kontakte.filter(k => { const v = K0.find(o => o.id === k.id); return !v || strV(v.mail) !== strV(k.mail) || strV(v.tel) !== strV(k.tel); });
  const D2 = geaendert.flatMap(k => D.fl.liste.filter(x => x !== e).flatMap(x => x.kontakte.filter(o => kkey(o.n) === kkey(k.n) && (strV(o.mail) !== strV(k.mail) || strV(o.tel) !== strV(k.tel))).map(o => ({ k, x, o }))));
  if (!D2.length) return;
  const ok = await confirmBox('Auch bei anderen Förderern ändern?', D2.map(d => '„' + d.k.n + '“ steht auch bei „' + (d.x.name || 'Förderer') + '“ – dort mit anderer E-Mail oder Telefonnummer.').join(' ') + ' E-Mail und Telefon von hier dort übernehmen? (Position und Anschreiben bleiben je Förderer, wie sie sind.)', 'Übernehmen', 'So lassen');
  if (!ok) return;
  for (const d of D2) Object.assign(d.o, { mail: d.k.mail, tel: d.k.tel });
  flZuKartei(); changed(); toast('Bei ' + uniq(D2.map(d => d.x.name)).join(', ') + ' mitgeändert', 'ok');
}
// anschreiben: ★ Priorität (wie die Prio bei den Bedarfen), ☆ offen (z. B. in CC), ✕ nein (rot) – ein Klick auf das Zeichen schaltet weiter
// anschreiben: Sprechblase mit goldenem Stern (Priorität), Sprechblase (offen), durchgestrichene Sprechblase (nicht anschreiben)
const SB = '<path d="M3 3h12a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 15 13H8.5L5 16.2V13H3a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 3 3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>';
const svgSb = x => `<svg viewBox="0 0 18 18" width="19" height="19" aria-hidden="true">${SB}${x}</svg>`;
const FL_AN_IC = [['ja', svgSb('<path d="M9 4.6l1.1 2.3 2.5.3-1.8 1.7.5 2.5L9 10.2l-2.3 1.2.5-2.5L5.4 7.2l2.5-.3z" fill="#d29a17"/>'), 'Priorität – wird zuerst angeschrieben'],
  ['', svgSb(''), 'Offen – nicht festgelegt, z. B. in CC'], ['nein', svgSb('<path d="M2 16.5L16.5 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'), 'Nicht anschreiben']];
const ICON_PUNKTE = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="12.5" cy="8" r="1.5" fill="currentColor"/></svg>';
// ★ Priorität (anschreiben), ☆ ohne Festlegung (z. B. in CC) – ein Klick schaltet um; „nicht anschreiben“ (im Bearbeiten): Karte blass, ✉ durchgestrichen
const FL_KS = { ja: ['ja', '★', 'Priorität – anschreiben (Klick: keine Priorität)'], '': ['leer', '☆', 'Klick: Priorität – anschreiben'] };
function flDetailView() {
  const e = flCur(); if (!e) return '<main class="fl-main"><div class="empty">Diesen Förderer gibt es nicht mehr.</div></main>';
  // Fördertöpfe (ab 0.111): Steckbrief, Einschätzung, Links und Notizen gelten je Topf; ohne Töpfe für den Förderer selbst (W = der Träger dieser Angaben, pf = Pfad im Eintrag)
  const TP = e.topfe, tp = flTopfWahl(e), W = tp || e, pf = tp ? `topfe.${TP.indexOf(tp)}.` : '';
  const H = flHistorie(e), K = flKennzahl(H), jahr0 = +today().slice(0, 4), heute = today(), ctx = flKontextGl();
  const kz = K.n ? `${K.n} ${K.n === 1 ? 'Förderung' : 'Förderungen'} seit ${K.seit}` : `keine Förderung seit ${K.seit}`;
  const rech = !W.recherche ? '' : flRechercheAlt(W) ? `<span class="fl-pill warn">Recherche veraltet · ${fmtDate(W.recherche)}</span>` : `<span class="fl-rech">recherchiert ${fmtDate(W.recherche)}</span>`;
  // Kopf: links Name, darunter Art und Recherche; die bisher geförderte Summe rechts bündig mit der linken Spalte (grau)
  const kopf = `<div class="fl-kopf"><div class="fl-kopf-in">
      <div class="fl-kopf-l"><div class="fl-kopf-z">${flIn('name', e.name, { ph: 'Name des Förderers', aria: 'Name des Förderers', cls: 'fl-name' })}<button class="fl-punkte" data-act="fl-menue" aria-haspopup="menu" title="Art, Status, Förderer löschen" aria-label="Weitere Aktionen">${ICON_PUNKTE}</button></div>
        <div class="fl-kopf-u"><span class="fl-kopf-art">${e.kurz ? `<b class="fl-kurz-k">${esc(e.kurz)}</b> · ` : ''}${flSel('art', e.art, uniq([...FL_ARTEN, e.art]).filter(Boolean), { leer: 'Art wählen', aria: 'Art', cls: 'fl-art-sel' })}</span>${e.status !== 'aktiv' ? `<span class="fl-pill">${esc(e.status)}</span>` : ''}${rech}</div></div>
      <div class="fl-kz"><div class="fl-kz-b">${fmtNum(K.sum) || '0'}<span> €</span></div><div class="fl-kz-t">${kz}${K.a ? ` · ${K.a} ${K.a === 1 ? 'Absage' : 'Absagen'}` : ''}</div></div>
    </div></div>`;

  // Ansprechpersonen wie „Zuständig“ beim Bedarf: graue Karten nebeneinander, ✉ und ☎ zeigen beim Überfahren Adresse bzw. Nummer;
  // vorn das Zeichen fürs Anschreiben. Stift: alle bearbeiten (wie dort), „+“: neuer Kontakt
  const rang = k => k.anschreiben === 'ja' ? 0 : k.anschreiben === 'nein' ? 2 : 1;
  const KL = e.kontakte.map((k, i) => ({ k, i })).sort((a, c) => rang(a.k) - rang(c.k) || a.i - c.i);   // alle Personen des Förderers, ★ zuerst – nicht nach Gliederung
  const knopf = (href, sym, t, tip) => `<a class="kb" href="${esc(href)}" data-act="link" data-tip="${esc(tip)}" aria-label="${t}: ${esc(tip)}">${sym}</a>`;
  const karte = ({ k, i }) => { const nein = k.anschreiben === 'nein', s = FL_KS[nein ? '' : k.anschreiben || ''], tel = telNr(k.tel);
    return `<div class="k1 fl-k1 an-${nein ? 'nein' : s[0]}"${nein ? ' data-tip="nicht anschreiben"' : ''}>${nein ? '' : `<button class="star fl-st ${s[0]}" data-act="fl-k-an" data-i="${i}" title="${s[2]}" aria-label="${s[2]}">${s[1]}</button>`}`
      + `<div class="acts">${k.mail ? (nein ? `<span class="kb kb-aus" data-tip="${esc('nicht anschreiben – ' + k.mail)}" aria-label="${esc('nicht anschreiben: ' + k.mail)}">✉</span>` : knopf('mailto:' + k.mail, '✉', 'E-Mail schreiben', k.mail)) : ''}${tel ? knopf('tel:' + tel, '☎', 'Anrufen', k.tel) : ''}</div>`
      + `<div class="kn">${esc(k.n || '(ohne Namen)')}</div>`
      + (k.pos ? `<div class="kr">${k.pos.split(/\s*;\s*/).filter(Boolean).map(esc).join('<br>')}</div>` : '')
      + (k.gl.length ? `<div class="kr fl-kfuer">für ${esc(k.gl.join(', '))}</div>` : '') + (k.notiz ? `<div class="kr fl-knotiz">${esc(k.notiz)}</div>` : '') + '</div>'; };
  const linie = (i, p, ph, typ) => { const k = e.kontakte[i];
    return `<input type="text" class="k-li k-li-${p}" data-fl="kontakte.${i}.${p}"${typ ? ` data-typ="${typ}"` : ''} value="${esc(p === 'gl' ? k.gl.join(', ') : k[p] || '')}" placeholder="${ph}" aria-label="${ph}" autocomplete="off">`; };
  const auch = k => { const A = flAuchBei(e, k); return A.length ? `<div class="fl-auch">steht auch bei ${A.map(x => esc(x.name || 'Förderer')).join(', ')} – E-Mail und Telefon gleichen sich bei „Fertig“ auf Wunsch an</div>` : ''; };
  const bearb = ({ k, i }) => `<div class="k-ed">${linie(i, 'n', 'Vorname Nachname')}${auch(k)}${linie(i, 'pos', 'Position')}${linie(i, 'mail', 'E-Mail-Adresse')}${linie(i, 'tel', 'Telefonnummer')}${linie(i, 'gl', 'für Gliederungen (leer: alle)', 'liste')}${linie(i, 'notiz', 'Notiz')}
      <div class="fl-an-z"><span>anschreiben:</span><div class="fl-ani" role="group" aria-label="Anschreiben">${FL_AN_IC.map(([v, ic, tip]) => `<button class="fl-ab fl-ab-${v || 'offen'}${(k.anschreiben || '') === v ? ' on' : ''}" data-act="fl-k-an-setzen" data-i="${i}" data-v="${v}" data-tip="${tip}" aria-label="${tip}" aria-pressed="${(k.anschreiben || '') === v}">${ic}</button>`).join('')}</div></div>
      <button class="x" data-act="fl-k-weg" data-i="${i}" title="Kontakt entfernen" aria-label="Kontakt entfernen">×</button></div>`;
  const personen = `<div class="fl-personen"><div class="sub fl-k-sub">Ansprechpersonen<button class="k-pliste k-plus" data-act="fl-k-neu" title="Kontakt hinzufügen" aria-label="Kontakt hinzufügen">+</button>${UI.flKEdit
      ? '<button class="k-fertig" data-act="fl-k-fertig">Fertig</button>' : `<button class="k-pen" data-act="fl-k-edit" title="Kontakte bearbeiten" aria-label="Kontakte bearbeiten">${ICON_PEN}</button>`}</div>
      ${UI.flKEdit ? `<div class="fl-ked">${KL.map(bearb).join('')}</div>`
        : `<div class="fl-kliste">${KL.map(karte).join('') || '<p class="muted small z-leer">Noch niemand eingetragen – über „+“ hinzufügen.</p>'}</div>`}</div>`;

  // Steckbrief: alle Angaben immer da (leer zum Ausfüllen); freie Texte formatierbar wie beim Bedarf
  const txt = (k, ph, aria, o = {}) => pe(e, k, '', 'area', Object.assign({ fmt: true, ph, aria, flpe: true }, o));
  // Antragsweg: per E-Mail oder Portal, direkt daneben die Adresse bzw. der Link (eine Angabe „Antrag an“)
  const wv = FL_WEGE.find(w => W.weg.includes(w)) || '', an0 = strV(W.antrag);
  const zielKnopf = wv === 'Portal' && /^https?:\/\//i.test(an0) ? `<a class="fl-oeffnen fl-ico" href="${esc(an0)}" target="_blank" rel="noopener" data-act="link" title="Link öffnen" aria-label="Link öffnen">${ICON_OEFFNEN}</a>`
    : wv === 'E-Mail' && /@/.test(an0) ? `<a class="fl-oeffnen fl-ico" href="mailto:${esc(mailRein(an0))}" data-act="link" title="E-Mail schreiben: ${esc(mailRein(an0))}" aria-label="E-Mail schreiben">✉</a>` : '';
  const weg = `<div class="fl-weg-z"><select class="fl-in fl-weg-sel" data-sel="fl-antrag" aria-label="Antragsweg"><option value=""${wv ? '' : ' selected'}>–</option>${FL_WEGE.map(w => `<option${w === wv ? ' selected' : ''}>${w}</option>`).join('')}</select>
      ${wv ? flIn(pf + 'antrag', wv === 'Portal' ? flUrlAnz(W.antrag) : W.antrag, { ph: wv === 'Portal' ? 'Link zum Portal …' : 'E-Mail-Adresse für Anträge …', aria: wv === 'Portal' ? 'Link zum Portal' : 'E-Mail-Adresse für Anträge', cls: 'fl-url fl-antrag', title: W.antrag }) : ''}</div>
      ${wv === 'Portal' && !an0 && /^https?:\/\//i.test(W.web) ? '<button class="fl-ab-alle" data-act="fl-antrag-web">Link der Homepage übernehmen</button>' : ''}`;
  // Fristen dieses Jahres je Fördertopf als Knöpfe (vorbei durchgestrichen, nächste fett, bald orange); Klick ändert, „+ Frist“ fügt hinzu; darunter ein Hinweis-Text
  const FD = flFristenDaten(e), toepfe = uniq(FD.filter(x => !tp || x.topf === tp.name || (!x.topf && tp === TP[0])).map(x => x.topf || ' ')).sort((a, b) => (b === ' ') - (a === ' '));   // ohne Fördertopf zuerst
  const pill = x => { const { t, st } = fristStand(x, FD, heute);
    return `<button class="fl-fd ${st}" data-act="fl-frist" data-i="${x.i}" title="${esc((x.einmalig ? 'einmalig' : 'jedes Jahr') + (x.topf ? ' · ' + x.topf : '') + ' · ' + (st === 'vorbei' ? 'vorbei' : t === 0 ? 'heute' : 'in ' + t + (t === 1 ? ' Tag' : ' Tagen')) + ' – Klick: ändern')}">${x.einmalig ? fmtDate(x.iso) : fmtDate(x.iso).slice(0, 6)}</button>`; };
  const fBtn = `<button class="fl-frist-neu" data-act="fl-frist-neu"${tp ? ` data-topf="${esc(tp.name)}"` : ''}>+ Frist</button>`;
  const fGrp = (t, plus) => `<div class="fl-frg">${t.trim() && !tp ? `<span class="fl-topf" title="${esc(t)}">${esc((TP.find(x => x.name === t) || {}).kurz || t)}</span>` : ''}<span class="fl-fds">${FD.filter(x => tp ? (x.topf === tp.name || (!x.topf && tp === TP[0])) : (x.topf || ' ') === t).map(pill).join('')}${plus}</span></div>`;
  const fristen = (toepfe.length ? toepfe.map((t, n) => fGrp(t, n === toepfe.length - 1 ? fBtn : '')).join('') : `<div class="fl-frg"><span class="fl-fds">${fBtn}</span></div>`)
    + txt(pf + 'fristen', 'Hinweis zu Fristen, z. B. laufend …', 'Hinweis zu Fristen', { cls: 'fl-ft-text klein', pre: flSemikolon });
  const link = (k, lab, titel) => `<section class="fl-blk"><div class="fl-blk-k"><h3>${titel}</h3>${/^https?:\/\//i.test(W[k]) ? `<a class="fl-oeffnen fl-ico" href="${esc(W[k])}" target="_blank" rel="noopener" data-act="link" title="Link öffnen" aria-label="Link öffnen">${ICON_OEFFNEN}</a>` : ''}</div>${flIn(pf + k, flUrlAnz(W[k]), { ph: 'Link eintragen …', aria: lab, cls: 'fl-url', title: W[k] })}</section>`;
  const chips = `<div class="fl-topfw" role="group" aria-label="Fördertopf">${TP.map(t => `<button class="fl-tpb${tp && tp.id === t.id ? ' on' : ''}" data-act="fl-topf" data-id="${t.id}" aria-pressed="${!!tp && tp.id === t.id}" title="${esc(t.name || 'Fördertopf ohne Namen')}">${esc(t.kurz || t.name || '(ohne Namen)')}</button>`).join('')}<button class="fl-tpb neu" data-act="fl-topf-neu" title="Fördertopf anlegen, z. B. ein einzelnes Programm der Aktion Mensch">+ Fördertopf</button></div>`;
  const steck = `<div class="fl-steck"><div class="fl-steck-k">${TP.length ? '' : '<h3>Steckbrief</h3>'}${chips}</div><div class="fl-sg">
      ${tp ? `<span class="fl-sl">Name</span><div class="fl-sv fl-tpn">${flIn(pf + 'name', tp.name, { ph: 'Name des Fördertopfs', aria: 'Name des Fördertopfs', cls: 'fl-fett' })}<button class="fl-muell" data-act="fl-topf-weg" title="Fördertopf mit Steckbrief, Einschätzung und Notizen entfernen" aria-label="Fördertopf entfernen">${ICON_TRASH}</button></div>
      <span class="fl-sl fl-eng">Kurzname</span><div class="fl-sv fl-eng">${flIn(pf + 'kurz', tp.kurz, { ph: 'z. B. DSEE-Ehrenamt (optional)', aria: 'Kurzname des Fördertopfs', title: 'Steht auf dem Knopf oben; der volle Name erscheint beim Überfahren' })}</div>` : ''}
      <span class="fl-sl">Zweck</span><div class="fl-sv">${flZweckFeld(W, pf, 'Förderzweck eintragen …')}</div>
      <span class="fl-sl">Gebiet</span><div class="fl-sv">${flIn(pf + 'gl', W.gl.join(', '), { typ: 'liste', sug: 'gl', ph: 'Gliederungen eintragen … oder „alle“', aria: 'Fördergebiet', cls: 'fl-feld' })}</div>
      <span class="fl-sl">Förderhöhe</span><div class="fl-sv">${flHoeheFeld(W, pf)}</div>
      <span class="fl-sl">Quote</span><div class="fl-sv">${txt(pf + 'quote', 'z. B. bis 90 % der Kosten …', 'Förderquote')}</div>
      <span class="fl-sl">Fristen ${jahr0}</span><div class="fl-sv fl-fr">${fristen}</div></div></div>`;

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
    return `<div class="fl-gk"><b>${esc(y === '–' ? 'ohne Jahr' : y)}</b><span>Förderungen ${G.length}${a ? ' · ' + a + (a === 1 ? ' Absage' : ' Absagen') : ''}</span><span class="fl-gk-sum">${eur(G.reduce((s, x) => s + (+x.betrag || 0), 0))}</span></div><div class="fl-gl">${L.map(eintrag).join('')}</div>`; };
  const altL = alt.filter(y => y !== '–').map(Number);
  const foerd = `<div class="fl-foerd"><div class="fl-h-z"><h3>Förderungen und Absagen</h3><button class="link fl-plus-t" data-act="fl-g-neu">+ Förderung von Hand</button></div>
      <div class="fl-gr">${Lauf.length ? `<div class="fl-gk offen"><b>Offen</b><span>nicht doppelt anfragen</span></div><div class="fl-gl">${Lauf.map(offen).join('')}</div>` : ''}
        ${neu.map(gruppe).join('')}${UI.flAlt ? alt.map(gruppe).join('') : ''}</div>
      ${!H.length && !Lauf.length ? '<p class="fl-leer">Noch keine Förderung und keine Absage.</p>' : ''}
      ${alt.length ? `<button class="fl-fuss" data-act="fl-alt">${UI.flAlt ? 'Ältere Einträge ausblenden ▾' : `Ältere Einträge (${H.filter(x => alt.includes(x.jahr || '–')).length}${altL.length ? ', ' + Math.min(...altL) + (altL.length > 1 ? '–' + Math.max(...altL) : '') : ''}) anzeigen ▸`}</button>` : ''}</div>`;
  const notizen = `<div class="fl-notizen"><h3>Notizen</h3>${txt(pf + 'notiz', 'Notizen eintragen … z. B. Zugang zum Portal, Absprachen, Besonderheiten', 'Notizen', { cls: 'fl-notiz-pe' })}</div>`;

  // Weitere Angaben (zugeklappt): Art, Status, Anschrift, Recherche, Quelle
  // rechte Spalte als Infomappe: höchstens ein Hinweis (gelb, oder rot: nicht anschreiben) – sonst oben rechts „+ Hinweis“; Einschätzung, Antragsweg,
  // Förderrichtlinien, Anschrift
  const hBox = ({ a, i }) => { const S = FL_ANSP[a.art];
    return `<div class="fl-ak-box ${S.cls}">
      <div class="fl-ab-1">${flIn(`ansprache.${i}.kopf`, a.kopf, { ph: a.gl ? 'Ansprache · ' + a.gl : 'Hinweis', aria: 'Kopfzeile', cls: 'fl-ab-k' })}<button class="fl-x fl-ab-x" data-act="fl-a-weg" data-i="${i}" title="Hinweis entfernen" aria-label="Hinweis entfernen">×</button></div>
      <div class="fl-ab-2"><button class="fl-ab-kr" data-act="fl-ansp-menu" data-i="${i}" aria-haspopup="menu" title="Gelb (Hinweis) oder rot (nicht anschreiben)" aria-label="Farbe des Hinweises ändern">${S.sym}</button>${flTa(`ansprache.${i}.titel`, a.titel, { rows: 1, ph: 'Überschrift eintragen …', aria: 'Überschrift', cls: 'fl-ab-t' })}</div>
      ${a.hinweis ? pe(e, `ansprache.${i}.hinweis`, '', 'area', { fmt: true, flpe: true, ph: 'Text eintragen …', aria: 'Text des Hinweises', cls: 'fl-ab-h' }) : ''}</div>`; };
  const HL = e.ansprache.map((a, i) => ({ a, i }));
  const haupt = (ctx && HL.find(x => norm(x.a.gl) === norm(ctx))) || HL.find(x => !x.a.gl) || (!ctx && HL[0]) || null, sonst = HL.filter(x => x !== haupt);
  const hinweise = (haupt ? hBox(haupt) : '') + (sonst.length ? `<button class="fl-ab-alle" data-act="fl-alle-gl" aria-expanded="${!!UI.flAlleGl}">${UI.flAlleGl ? '▾' : '▸'} ${sonst.length} ${sonst.length === 1 ? 'Hinweis' : 'Hinweise'} für andere Gliederungen</button>${UI.flAlleGl ? sonst.map(hBox).join('') : ''}` : '');
  const seite = `<div class="fl-rechts">${haupt ? '' : '<div class="fl-hz"><button class="fl-hinweis-neu" data-act="fl-ansp-neu" title="Gelben Hinweis anlegen, z. B. „Erst mit der Gliederung sprechen“">+ Hinweis</button></div>'}<aside class="card fl-seite">
      <section class="fl-blk">${flNetz(e, true, { t: tp })}</section>
      <section class="fl-blk"><div class="fl-blk-k"><h3>Antragsweg</h3>${zielKnopf}</div>${weg}</section>
      ${link('richtlinien', 'Förderrichtlinien', 'Förderrichtlinien')}
      ${link('web', 'Homepage', 'Homepage')}
      <section class="fl-blk"><h3>Anschrift</h3>${flTa(pf + 'anschrift', W.anschrift, { rows: 1, ph: 'Straße, PLZ Ort eintragen …', aria: 'Anschrift', cls: 'fl-anschrift' })}</section>
      <section class="fl-blk"><h3>Recherchestand</h3>${pe(e, pf + 'recherche', '', 'date', { flpe: true, ph: 'Datum eintragen …', aria: 'Recherchestand' })}</section></aside></div>`;

  // der Hinweis steht im Kopf, rechts neben dem Namen – der Kasten mit dem Netz bleibt auf Höhe des linken Kastens
  return `<main class="fl-main fl-detail">${hinweise ? kopf.slice(0, -6) + `<div class="fl-hinw">${hinweise}</div></div>` : kopf}
    <div class="fl-raster">
      <div class="fl-links">
        <section class="card fl-ps">${personen}${steck}</section>
        <section class="card fl-fn">${foerd}${notizen}</section>
      </div>
      ${seite}
    </div>
  </main>`;
}
// Hinweis im Kopf: gleicher Abstand nach oben (zum Seitenkopf) und nach unten (zu den weißen Kästen), ohne dass sich etwas verschiebt
function flHinweisMitte() {
  const hw = $('.fl-kopf > .fl-hinw'), k = $('.fl-kopf'), m = $('main.fl-detail'); if (!hw || !k || !m) return;
  hw.style.bottom = '0px'; if (getComputedStyle(hw).position !== 'absolute') { hw.style.bottom = ''; return; }
  const cs = getComputedStyle(m), gap = parseFloat(cs.rowGap) || 18, platz = parseFloat(cs.paddingTop) + k.offsetHeight + gap, g = Math.max(0, (platz - hw.offsetHeight) / 2);
  hw.style.bottom = (g - gap) + 'px';
}
document.addEventListener('input', ev => { if (ev.target.closest && ev.target.closest('.fl-hinw')) flHinweisMitte(); });
// kleine Menüs: „⋯“ (Kurzname, Status, löschen) und Ansprache für die Gliederung
function flMenue(btn) {
  closeMenus(); const e = flCur(); if (!e) return;
  placePop(h('div', { class: 'menu fl-menue', role: 'menu', html: `<label class="fl-mz"><span>Kurzname</span>${flIn('kurz', e.kurz, { ph: 'z. B. DSEE', aria: 'Kurzname', title: 'So nennt ihr den Förderer intern; in den Bedarfen gelten Kurzname und voller Name' })}</label>
    <label class="fl-mz"><span>Status</span>${flSel('status', e.status, FL_STATUS, { aria: 'Status' })}</label><hr><div class="fl-mg">Mit Copilot ausfüllen</div><button role="menuitem" data-act="fl-copilot-dialog">Recherche vorbereiten …</button><button role="menuitem" data-act="fl-copilot-lesen">Ausgefüllte Vorlage einlesen …</button><hr><button role="menuitem" class="fl-rot-t" data-act="fl-weg">Förderer löschen …</button>` }), btn, 'right');
}
// Frist anlegen oder ändern: Datum im Kalender wählen; „jedes Jahr“ (Standard) merkt nur Tag und Monat, sonst gilt sie einmalig; Fördertopf frei (Vorschläge: die schon benutzten)
function flFristMenue(btn, i, topf = '') {
  closeMenus(); const e = flCur(); if (!e) return; const x = i != null ? e.fristenL[i] : null, jetzt = today().slice(0, 4);
  const d = h('input', { type: 'date', value: x ? (x.d.length === 5 ? jetzt + '-' + x.d : x.d) : '', 'aria-label': 'Frist' });
  const jj = h('input', { type: 'checkbox', checked: x ? x.d.length === 5 : true, 'aria-label': 'jedes Jahr' });
  const T = uniq([...e.fristenL.map(f => f.topf), ...e.topfe.map(t => t.name)]).filter(Boolean), dl = h('datalist', { id: 'fl-toepfe' }, ...T.map(t => h('option', { value: t })));
  const t = h('input', { type: 'text', value: x ? x.topf : topf, placeholder: 'Fördertopf (optional)', list: 'fl-toepfe', 'aria-label': 'Fördertopf' });
  const ok = () => { const v = d.value; if (!validIso(v)) { toast('Bitte ein Datum im Kalender wählen.', 'warn'); d.focus(); return; }
    const dd = jj.checked ? v.slice(5) : v;
    if (x) Object.assign(x, { d: dd, topf: strV(t.value) }); else e.fristenL.push({ id: uid('fr'), d: dd, topf: strV(t.value) });
    closeMenus(); changed(); keep(renderNow); };
  [d, t].forEach(el => el.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); ok(); } }));
  const m = h('div', { class: 'menu fl-frist-pop', role: 'dialog', 'aria-label': x ? 'Frist ändern' : 'Frist hinzufügen' },
    h('label', { class: 'tf-l' }, 'Frist'), d, h('label', { class: 'check fl-jj' }, jj, ' jedes Jahr wiederholen'),
    h('label', { class: 'tf-l' }, 'Fördertopf'), t, dl,
    h('div', { class: 'fl-fp-k' }, x ? h('button', { class: 'link small fl-rot-t', onclick: () => { e.fristenL.splice(i, 1); closeMenus(); changed(); keep(renderNow); } }, 'Entfernen') : h('span'),
      h('button', { class: 'primary', onclick: ok }, x ? 'Übernehmen' : 'Hinzufügen')));
  placePop(m, btn); d.focus();
}
// Fördertopf anlegen: Name eintragen (Vorschläge: Töpfe, die schon bei den Fristen vorkommen)
// Fördertopf anlegen: der erste übernimmt die bisherigen Angaben des Förderers (Steckbrief, Einschätzung, Links, Notizen) und dessen Fristen; weitere beginnen leer
function flTopfAnlegen(e, name) { const t = flTopfEinfuegen(e, flTopfLeer(name)); UI.flTopf = t.id; return t; }
async function flTopfEntfernen(e) {
  const t = flTopfWahl(e); if (!t) return;
  if (!await confirmBox('Fördertopf entfernen?', '„' + (t.name || 'Fördertopf') + '“ mit Steckbrief, Einschätzung, Links und Notizen entfernen? Mit ↶ (Strg+Z) lässt es sich zurückholen.', 'Entfernen')) return;
  const i = e.topfe.indexOf(t); e.topfe.splice(i, 1);
  if (e.topfe.length) e.fristenL = e.fristenL.filter(f => f.topf !== t.name); else { e.fristenL.forEach(f => { if (f.topf === t.name) f.topf = ''; }); e.topfMig = false; }   // letzter Topf: seine Fristen gehen an den Förderer zurück
  UI.flTopf = ''; changed(); keep(renderNow); toast('Fördertopf entfernt (Rückgängig: ↶).', 'ok');
}
function flTopfMenue(btn) {
  closeMenus(); const e = flCur(); if (!e) return;
  const T = uniq(e.fristenL.map(f => f.topf)).filter(t => t && !e.topfe.some(x => norm(x.name) === norm(t))), dl = h('datalist', { id: 'fl-toepfe2' }, ...T.map(t => h('option', { value: t })));
  const n = h('input', { type: 'text', placeholder: 'z. B. Programm Jugend', list: 'fl-toepfe2', 'aria-label': 'Name des Fördertopfs' });
  const ok = () => { const v = strV(n.value); if (!v) { n.focus(); return; } if (e.topfe.some(x => norm(x.name) === norm(v))) { toast('Diesen Fördertopf gibt es schon.', 'warn'); return; }
    flTopfAnlegen(e, v); closeMenus(); changed(); keep(renderNow); };
  n.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); ok(); } });
  placePop(h('div', { class: 'menu fl-frist-pop', role: 'dialog', 'aria-label': 'Fördertopf hinzufügen' }, h('label', { class: 'tf-l' }, 'Name des Fördertopfs'), n, dl,
    h('div', { class: 'fl-fp-k' }, h('span'), h('button', { class: 'primary', onclick: ok }, 'Hinzufügen'))), btn); n.focus();
}
function flAnspracheMenue(btn) {
  closeMenus(); const e = flCur(), x = e && e.ansprache[+btn.dataset.i]; if (!x) return;
  placePop(h('div', { class: 'menu', role: 'menu' }, ...FL_ANSPRACHE.map(a => h('button', { role: 'menuitem', class: 'fl-am ' + FL_ANSP[a].cls + (x.art === a ? ' on' : ''), onclick: () => { closeMenus(); x.art = a; changed(); keep(renderNow); } }, FL_ANSP[a].sym + '  ' + FL_ANSP[a].l))), btn);
}
function flSetzen(el) {
  const e = flCur(); if (!e) return false;
  let v = el.value; const t = el.dataset.typ;
  const tf = /^topfe\.(\d+)\./.exec(el.dataset.fl), Wt = tf ? e.topfe[+tf[1]] : e, fk = el.dataset.fl.replace(/^topfe\.\d+\./, '');          // Träger (Topf oder Förderer) und Feld
  if (['web', 'richtlinien'].includes(fk) || (fk === 'antrag' && Wt && !Wt.weg.includes('E-Mail'))) v = flUrlVoll(v);
  if (t === 'liste') v = strL(v);
  else if (t === 'zahl') v = zahlOderLeer(v);
  else if (t === 'jahrdatum') {                                                   // Förderung von Hand: „2024“ oder „12.04.2024“
    const basis = el.dataset.fl.replace(/\.datum$/, ''), g = getPath(e, basis), w = strV(v), d = anyDate(w);
    if (/^\d{4}$/.test(w)) Object.assign(g, { jahr: w, datum: '' }); else if (d) Object.assign(g, { jahr: d.slice(0, 4), datum: d }); else if (!w) g.datum = ''; else { toast('„' + w + '“ ist weder Datum noch Jahr (z. B. 12.04.2024 oder 2024).', 'warn'); return false; }
    changed(); return true;
  }
  else if (t === 'datum') { const d = anyDate(v); if (strV(v) && !d) { toast('„' + v + '“ ist kein Datum (z. B. 05.12.2026).', 'warn'); return false; } v = d || ''; }
  const kn = /^kontakte\.\d+\.n$/.test(el.dataset.fl) && getPath(e, el.dataset.fl), tn = /^topfe\.\d+\.name$/.test(el.dataset.fl) && getPath(e, el.dataset.fl);
  setPath(e, el.dataset.fl, v); if (kn) flKopienAnpassen(e, kn, v);
  UNDO.tipp = 'fl|' + e.id + '|' + el.dataset.fl;                                    // Tippen im selben Feld = ein Rückgängig-Schritt
  if (tn) e.fristenL.forEach(f => { if (f.topf === tn) f.topf = strV(v); });                // Fördertopf umbenannt: seine Fristen gehen mit
  changed(); return true;
}
document.addEventListener('input', ev => {
  const el = ev.target; if (UI.view !== 'fdetail' || !el.dataset || !el.dataset.fl || el.tagName === 'SELECT' || ['datum', 'zahl', 'jahrdatum'].includes(el.dataset.typ)) return;
  flSetzen(el);
  if (el.dataset.fl === 'name') { const s = $('.fl-sub-n'); if (s) s.textContent = el.value || '(ohne Namen)'; }
});
document.addEventListener('change', ev => {
  const el = ev.target; if (!el.dataset) return;
  if (UI.view !== 'fdetail') return;
  if (el.dataset.sel === 'fl-antrag') { const e = flCur(); if (e) { flTraeger(e).weg = el.value ? [el.value] : []; changed(); keep(renderNow); } return; }
  if (!el.dataset.fl) return;
  if (flSetzen(el) && (el.tagName === 'SELECT' || el.dataset.typ || ['web', 'richtlinien', 'antrag', 'kurz'].includes(el.dataset.fl) || /^topfe\.\d+\.(name|kurz)$/.test(el.dataset.fl))) keep(renderNow);   // Auswahl, Datum, Betrag, Links („Öffnen“): Darstellung nachziehen
});
// Fördergebiet: beim Tippen die bekannten Gliederungen vorschlagen (nach dem letzten Komma); Enter übernimmt den obersten Eintrag, ein Klick daneben auch
const flGebieteBekannt = () => uniq(['alle', ...GL_LIST, ...D.fl.liste.flatMap(e => flEff(e).gl), ...D.bedarfe.map(b => b.gliederung)].map(strV).filter(Boolean));
let GSUG = null;
const gSugZu = () => { if (GSUG) GSUG.box.remove(); GSUG = null; };
function gToken(inp) { const v = inp.value, i = v.lastIndexOf(','); return { vor: v.slice(0, i + 1) + (i >= 0 ? ' ' : ''), tok: v.slice(i + 1).trim() }; }
function gTreffer(inp) { const q = norm(gToken(inp).tok); if (!q) return []; const schon = new Set(strL(inp.value).map(norm));
  return flGebieteBekannt().filter(g => norm(g).includes(q) && !schon.has(norm(g))).sort((a, c) => (norm(c).startsWith(q) - norm(a).startsWith(q)) || a.localeCompare(c, 'de')).slice(0, 8); }
function gSugZeigen(inp) {
  gSugZu(); const items = gTreffer(inp); if (!items.length) return;
  const box = h('div', { class: 'le-sug', role: 'listbox' }, items.map((v, i) => h('div', { class: 'le-opt' + (i === 0 ? ' on' : ''), role: 'option', 'data-i': i }, v)));
  box.addEventListener('mousedown', ev => { ev.preventDefault(); const x = ev.target.closest('.le-opt'); if (x) gUebernehmen(inp, items[+x.dataset.i]); });
  document.body.append(box); const r = inp.getBoundingClientRect(); Object.assign(box.style, { left: r.left + 'px', top: (r.bottom + 3) + 'px', minWidth: Math.max(r.width, 160) + 'px' });
  GSUG = { inp, items, box, hi: 0 };
}
function gUebernehmen(inp, v) { inp.value = gToken(inp).vor + v; gSugZu(); flSetzen(inp); }
document.addEventListener('input', ev => { const el = ev.target; if (el.dataset && el.dataset.sug === 'gl') gSugZeigen(el); });
document.addEventListener('keydown', ev => {
  if (!GSUG || ev.target !== GSUG.inp) return;
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); GSUG.hi = (GSUG.hi + (ev.key === 'ArrowDown' ? 1 : -1) + GSUG.items.length) % GSUG.items.length; [...GSUG.box.children].forEach((c, i) => c.classList.toggle('on', i === GSUG.hi)); }
  else if (ev.key === 'Enter') { ev.preventDefault(); ev.stopImmediatePropagation(); gUebernehmen(GSUG.inp, GSUG.items[GSUG.hi]); }
  else if (ev.key === 'Escape') { ev.stopImmediatePropagation(); gSugZu(); }
}, true);
document.addEventListener('change', ev => { const el = ev.target; if (!el.dataset || el.dataset.sug !== 'gl') return;      // Klick daneben: der oberste Vorschlag gilt (vor dem Speichern)
  const t = gTreffer(el); gSugZu(); if (t.length) el.value = gToken(el).vor + t[0]; }, true);
document.addEventListener('focusout', ev => { if (ev.target.dataset && ev.target.dataset.sug === 'gl') gSugZu(); });
document.addEventListener('mousedown', ev => {                                    // Klick außerhalb des Suchfelds (Einschätzung) schließt es
  if (!UI.flSuch || (ev.target.closest && ev.target.closest('.fl-such, .fl-lupe'))) return;
  UI.flSuch = false; const f = $('.fl-such'); if (f) f.remove(); const l = $('.fl-lupe'); if (l) l.setAttribute('aria-expanded', 'false');
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
  if (tr && ev.key === 'Enter') { ev.preventDefault(); flOeffnen(tr.dataset.id, tr.dataset.topf); return; }
  // ↓ aus der Suche in die erste Zeile, ↑/↓ von Zeile zu Zeile
  const el = document.activeElement;
  if (ev.key === 'ArrowDown' && el && el.id === 'flq') { const r = $('#fl-body tr[data-id]'); if (r) { ev.preventDefault(); r.focus(); } return; }
  if (tr && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) { const n = ev.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling; ev.preventDefault(); if (n) n.focus(); else if (ev.key === 'ArrowUp') { const q = $('#flq'); if (q) q.focus(); } }
});
// Seite eines Förderers: Esc (nicht in einem Feld) zurück zur Liste; Enter in einem Feld übernimmt
document.addEventListener('keydown', ev => {
  if (UI.view !== 'fdetail' || ev.defaultPrevented) return;
  const el = document.activeElement, imFeld = el && el.closest && el.closest('input, textarea, select, [contenteditable]');
  if (ev.key === 'Enter' && !ev.shiftKey && imFeld && el.classList.contains('fl-in') && (el.tagName === 'INPUT' || el.classList.contains('fl-ab-t'))) { ev.preventDefault(); el.blur(); return; }   // Überschrift eines Hinweises: wächst mit, Enter übernimmt
  if (!taste(ev, 'd-zurueck') || imFeld || $('.menu, .modal, .cal-pop, .fmt-bar, .pe-in')) return;
  ev.preventDefault(); flZurueck();
}, true);
// Seitenwechsel
function flListe() { closeMenus(); UI.view = 'flist'; flDaten(); renderNow(); scrollTo(0, 0); }
function flOeffnen(id, topfId) { if (!flEintrag(id)) return; closeMenus(); const von = UI.view; if (UI.flId !== id) { flKontakteFertig(); Object.assign(UI, { flAlt: false, flTopf: '' }); } UI.flId = id; if (topfId) UI.flTopf = topfId; UI.view = 'fdetail'; uebergang(von === 'flist' ? 'vor' : 'zurueck', () => { renderNow(); scrollTo(0, 0); }); }
// eine neue, unberührte Seite („+ Förderer“ und nichts eingetragen) verschwindet beim Verlassen wieder
function flLeerEntfernen(id) {
  const e = flEintrag(id); if (!e || e.name.trim() || e.kurz || e.web || e.schwer || e.hoehe || e.hoeheVon != null || e.hoeheBis != null || e.quote || e.notiz || e.anschrift || e.kontakte.length || e.foerderungen.length || e.fristenL.length || e.topfe.length || e.ansprache.length) return;
  if (D.bedarfe.some(b => b.foerderer.some(f => f.flId === id))) return; D.fl.liste = D.fl.liste.filter(x => x !== e); changed();
}
function flZurueck() { closeMenus(); flKontakteFertig(); const id = UI.flId; flLeerEntfernen(id); UI.view = 'flist'; uebergang('zurueck', () => { renderNow(); const r = $(`#fl-body tr[data-id="${CSS.escape(id || '')}"]`); if (r) { r.scrollIntoView({ block: 'center' }); r.focus({ preventScroll: true }); } }); }

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
    case 'fl-oeffnen': flOeffnen(a.dataset.id, a.dataset.topf); return true;
    case 'fl-zu': UI.flZu[a.dataset.id] = !UI.flZu[a.dataset.id]; flListeNeu(); return true;
    case 'fl-zurueck': flZurueck(); return true;
    case 'fl-excel-menu': if ($('.menu')) closeMenus(); else flExcelMenu(a); return true;
    case 'fl-neu-leer': { const x = Object.assign(flLeer(), { id: flNeueId() }); D.fl.liste.push(x); changed(); flOeffnen(x.id); setTimeout(() => { const n = $('.fl-name'); if (n) n.focus(); }, 60); return true; }
    case 'fl-weg': {
      if (!e || !await confirmBox('Förderer löschen?', '„' + (e.name || 'Förderer') + '“ wird mit Kontakten und Förderungen aus der Fördererliste gelöscht. In den Bedarfen bleibt er stehen, nur ohne Verknüpfung.', 'Löschen')) return true;
      D.fl.liste = D.fl.liste.filter(x => x !== e); for (const y of D.bedarfe) for (const g of y.foerderer) if (g.flId === e.id) g.flId = '';
      flZuKartei(); changed(); UI.view = 'flist'; renderNow(); return true;
    }
    case 'fl-k-neu': if (e) { if (!UI.flKEdit) flKEditStart(); e.kontakte.push(flKontaktLeer()); neu(); const L = $$('.fl-ked .k-li-n'); if (L.length) L[L.length - 1].focus(); } return true;
    case 'fl-menue': if ($('.fl-menue')) closeMenus(); else flMenue(a); return true;
    case 'fl-pe': popEdit(a); return true;                                        // formatierbarer Text wie auf der Seite eines Bedarfs
    case 'fl-k-edit': flKEditStart(); keep(renderNow); return true;
    case 'fl-k-fertig': await flKontakteFertig(true); keep(renderNow); return true;
    case 'fl-k-an-setzen': { const x = e && e.kontakte[+a.dataset.i]; if (x) { x.anschreiben = a.dataset.v; neu(); } return true; }
    case 'fl-ansp-menu': if ($('.menu')) closeMenus(); else flAnspracheMenue(a); return true;
    case 'fl-ansp-neu': if (e) { e.ansprache.push({ gl: flKontextGl(), art: 'hinweis', kopf: '', titel: '', hinweis: '' }); neu(); const t = $(`[data-fl="ansprache.${e.ansprache.length - 1}.titel"]`); if (t) t.focus(); } return true;   // gefiltert: gleich für diese Gliederung
    case 'fl-antrag-web': if (e) { const W = flTraeger(e); W.antrag = W.web; neu(); } return true;
    case 'fl-alle-gl': UI.flAlleGl = !UI.flAlleGl; keep(renderNow); return true;
    case 'fl-alt': UI.flAlt = !UI.flAlt; keep(renderNow); return true;
    case 'fl-g-erg': { const g = e && e.foerderungen[+a.dataset.i]; if (g) { g.ergebnis = g.ergebnis === 'abgelehnt' ? 'gefördert' : 'abgelehnt'; neu(); } return true; }
    case 'fl-k-an': { const x = e && e.kontakte[+a.dataset.i]; if (x) { x.anschreiben = x.anschreiben === 'ja' ? '' : 'ja'; neu(); } return true; }   // ★ an/aus; „nicht anschreiben“ im Bearbeiten
    case 'fl-frist': case 'fl-frist-neu': if (e) flFristMenue(a, k === 'fl-frist' ? +a.dataset.i : null, a.dataset.topf || ''); return true;
    case 'fl-hoehe': flHoeheEdit(a); return true;
    case 'fl-zweck': flZweckMenue(a); return true;
    case 'fl-copilot-dialog': closeMenus(); if (e) flcDialog(e); return true;
    case 'fl-copilot-lesen': closeMenus(); flcEinlesen(); return true;
    case 'fl-krone': if (e) { const W = flTraeger(e); W.gross = !W.gross; neu(); } return true;
    case 'fl-such': UI.flSuch = !UI.flSuch; keep(renderNow); return true;
    case 'fl-such-reset': UI.flBewQ = flQNull(); keep(renderNow); return true;
    case 'fl-topf': UI.flTopf = a.dataset.id || ''; keep(renderNow); return true;
    case 'fl-topf-neu': if (e) flTopfMenue(a); return true;
    case 'fl-topf-weg': if (e) await flTopfEntfernen(e); return true;
    case 'fl-k-weg': if (e) { const [k] = e.kontakte.splice(+a.dataset.i, 1); if (k) flKopienAnpassen(e, k.n, null); neu(); } return true;
    case 'fl-a-neu': if (e) { e.ansprache.push({ gl: '', art: 'hinweis', kopf: '', titel: '', hinweis: '' }); neu(); const L = $$('.fl-a input'); if (L.length) L[L.length - 1].focus(); } return true;
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
