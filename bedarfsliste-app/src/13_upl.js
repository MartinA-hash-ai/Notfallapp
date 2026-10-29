/* ===================================================================== Unternehmensplanung (UPL): Investitionsabfrage aus Excel als Bedarfe übernehmen
   Je Zeile mit OG-Nr., OG-Name und Investition ein Bedarf: Name (Anfang der Beschreibung), Ort, Summe (Gesamtkosten), Beschreibung (dahinter
   „ ---- “ und die Kommentierung des Fundraisings), Prio (Stern bei „hoch“), Stichwort „UPL <Jahr>“. Freigaben nur, wenn erteilt:
   Referat „genehmigt“ → Fachreferat freigegeben, Finanzausschuss/GF „genehmigt“ → Verwaltung budgetiert. Andere Kommentare werden nicht übernommen.
   Ein zweites Einlesen legt nichts doppelt an (Kennung b.upl) – es trägt nur neu erteilte Freigaben und fehlende Summen nach. */

// Kopfzeile mit „OG-Name“ und „Gesamtkosten“; die Gruppen stehen in der Zeile darüber (verbundene Zellen tragen ihren Wert überall)
function uplSpalten(rows) {
  const hi = rows.slice(0, 20).findIndex(r => r.some(v => /^og-?name/.test(norm(v))) && r.some(v => /gesamtkosten/.test(norm(v))));
  if (hi < 0) return null;
  const head = rows[hi].map(norm), grp = (rows[hi - 1] || []).map(norm), C = { hi };
  const such = (fn) => head.findIndex((t, c) => fn(t, grp[c] || ''));
  C.nr = such(t => /^og-?nr/.test(t)); C.og = such(t => /^og-?name/.test(t)); C.prio = such(t => /^priorit/.test(t));
  C.text = such(t => /^investition/.test(t) || /beschreibung/.test(t)); C.summe = such(t => /gesamtkosten/.test(t)); C.dienst = such(t => t === 'dienst');
  C.fr = such((t, g) => /fundraising/.test(g) && /kommentier/.test(t));
  C.refBew = such((t, g) => /referat/.test(g) && /bewertung/.test(t)); C.refBeg = such((t, g) => /referat/.test(g) && /begr(ü|ue)ndung/.test(t));
  C.gfBew = such((t, g) => /(\bgf\b|gesch(ä|ae)ftsf|finanzausschuss)/.test(g) && /bewertung/.test(t)); C.gfBeg = such((t, g) => /(\bgf\b|gesch(ä|ae)ftsf|finanzausschuss)/.test(g) && /begr(ü|ue)ndung/.test(t));
  return C.og >= 0 && C.text >= 0 ? C : null;
}
// Name des Bedarfs: der Anfang der Beschreibung bis zum ersten Satzzeichen, höchstens etwa 60 Zeichen (an einer Wortgrenze); „Investition: …“ ohne das Etikett
function uplTitel(t) {
  let s = String(t).trim().split(/\n/)[0].replace(/\s+/g, ' ').trim().replace(/^(investition|anschaffung|beschaffung|bedarf|gegenstand|projekt)\s*:\s*/i, '').split(/[:.;(\n]| - | – /)[0].trim();
  if (s.length > 60) { s = s.slice(0, 60); s = s.slice(0, s.lastIndexOf(' ') > 30 ? s.lastIndexOf(' ') : 60).trim() + ' …'; }
  return s.replace(/[„“"]/g, '') || 'Investition';
}
const uplOrt = og => { const s = String(og).trim(); if (/^(dgs|di(ö|oe)zes)/i.test(s)) return DIO; return GL_LIST.find(g => norm(g) === norm(s)) || s; };
const uplGenehmigt = v => /^(genehmigt|freigegeben|ja|budgetiert|zugestimmt)\b/i.test(String(v || '').trim());

function uplLesen(book, jahr) {
  const out = [];
  for (const sh of book.sheets) {
    if (sh.hidden) continue;
    const rows = sh.rows, C = uplSpalten(rows); if (!C) continue;
    const zelle = (r, c) => c >= 0 ? cellStr(r[c]) : '';
    for (const r of rows.slice(C.hi + 1)) {
      const og = r[C.og], text = zelle(r, C.text);
      if (typeof og !== 'string' || !og.trim() || !text || (C.nr >= 0 && !/^\d{4,}$/.test(String(r[C.nr]).trim()))) continue;   // Legende, Summen, Leerzeilen
      const fr = zelle(r, C.fr), sum = typeof r[C.summe] === 'number' && r[C.summe] > 0 ? r[C.summe] : deNum(zelle(r, C.summe));
      out.push({ key: String(r[C.nr] ?? '') + '|' + kkey(text).slice(0, 80), titel: uplTitel(text), ort: uplOrt(og), summe: typeof sum === 'number' && sum > 0 ? sum : null,
        beschreibung: text.trim() + (fr ? ' ---- ' + fr.trim() : ''), hoch: /^hoch$/i.test(zelle(r, C.prio).replace(/["„“]/g, '').trim()), dienst: zelle(r, C.dienst),
        fach: uplGenehmigt(zelle(r, C.refBew)) ? zelle(r, C.refBeg) || 'genehmigt' : null, verw: uplGenehmigt(zelle(r, C.gfBew)) ? zelle(r, C.gfBeg) || 'genehmigt' : null, jahr });
    }
  }
  return out;
}
// eine Zeile in einen Bedarf übertragen (neu) bzw. Neues nachtragen (vorhanden); true, wenn sich etwas geändert hat
function uplAnwenden(b, z, neu) {
  let n = false;
  const frei = (k, notiz) => { const f = b.freigabe[k]; if (notiz && f.st !== 'ok') { f.st = 'ok'; f.erledigt = f.erledigt || today(); f.notiz = f.notiz || 'laut UPL: ' + notiz; n = true; } };
  if (neu) Object.assign(b, { titel: z.titel, gliederung: z.ort, summe: z.summe, beschreibung: z.beschreibung, prio: z.hoch ? 'hoch' : 'mittel', upl: z.key,
    stichworte: z.jahr ? ['UPL ' + z.jahr] : [], deadline: z.deadline || '' });
  if (neu) { b.freigabe.ofk.st = 'ok'; b.freigabe.ofk.erledigt = today(); b.freigabe.ofk.notiz = 'laut UPL (Investitionsabfrage)'; }   // in der UPL: der Ortsführungskreis hat zugestimmt
  if (neu && z.spenden > 0) b.foerderer.push(ff({ name: 'Bisherige Spenden (laut UPL)', status: 'zugesagt', betrag: z.spenden, zugesagt: z.spenden, eingegangen: z.spenden }));
  else if (b.summe == null && z.summe) { b.summe = z.summe; n = true; }
  if (z.dienst && !b.freigabe.fach.name) { b.freigabe.fach.name = z.dienst; n = true; }   // Fachreferat des Bedarfs – darüber kommen seine Ansprechpersonen (Personenliste)
  frei('fach', z.fach); frei('verw', z.verw);
  return neu || n;
}
/* ---------- UPL-Vorlage für Copilot oder Cowork: eine KI überträgt die UPL der Malteser in diese Tabelle – mit festen Regeln, damit nichts unklar bleibt.
   Die ausgefüllte Vorlage wird wie die UPL selbst eingelesen (Zahnrad → „UPL einlesen …“); die Kennung ist dieselbe wie beim direkten Einlesen. */
const UPL_V = [
  { k: 'kennung', t: 'OG-Nr.', w: 10, help: 'OG-Nr. aus der UPL (Spalte „OG-Nr.“), unverändert.' },
  { k: 'ueber', t: 'Übernehmen', w: 12, items: ['ja', 'nein'], help: '„nein“ nur, wenn die Gesamtkosten 0 sind oder der Bedarf laut UPL schon erledigt ist (z. B. „bereits erled.“); sonst „ja“.' },
  { k: 'titel', t: 'Bedarf (Kurzname)', w: 34, help: 'Prägnanter Name, höchstens 50 Zeichen, ohne Ort: der Gegenstand, z. B. „AED mit Patches“, „Carport für Altkleider und Fahrzeuge“, „Klimagerät für den ELW“. Kein Satz („Es soll …“), kein „Investition:“.' },
  { k: 'ort', t: 'Gliederung', w: 18, help: 'Aus „OG-Name“. „DGS“ (Diözesangeschäftsstelle) = „Diözese“. Sonst den Namen genau wie im Blatt „Gliederungen“, wenn er dort steht; andere Einrichtungen (z. B. „MBZ Westfalen“, „Hospiz Dortmund“) wie in der UPL.' },
  { k: 'summe', t: 'Summe (€)', w: 12, help: 'Aus „Gesamtkosten“, nur die Zahl. Leer, wenn dort nichts oder 0 steht.' },
  { k: 'prio', t: 'Priorität', w: 10, items: ['hoch', 'mittel', 'gering'], help: 'Aus „Priorität“ (ohne Anführungszeichen, klein geschrieben). Steht nichts da: „mittel“.' },
  { k: 'deadline', t: 'Deadline', w: 12, help: 'Aus „geplanter Zeitpunkt der Anschaffung“ als Datum TT.MM.JJJJ – immer das Ende des Zeitraums: „3. Quartal 2027“ = 30.09.2027, „Oktober 2027“ = 31.10.2027, „Start April 2027“ = 30.04.2027, „1. bis 2. Quartal“ = 30.06. des Geschäftsjahrs. Ohne Jahr: das Geschäftsjahr. Unbestimmt („so schnell wie möglich“, „im Laufe des Jahres“): leer.' },
  { k: 'text', t: 'Beschreibung', w: 60, help: 'Der Text aus „Investition mit Beschreibung und Begründung“ – vollständig und unverändert (auch Anmerkungen wie „Anmerkung NF: …“).' },
  { k: 'fr', t: 'Einschätzung Fundraising', w: 40, help: 'Der Text aus „Fundraising › Kommentierung“, unverändert. Leer, wenn dort nichts steht.' },
  { k: 'dienst', t: 'Fachreferat', alt: ['Dienst'], w: 16, help: 'Das Fachreferat, zu dem der Bedarf gehört (in der UPL in der Spalte „Dienst“), z. B. Notfallvorsorge oder Soziales Ehrenamt – genau so geschrieben wie in der Personenliste in der Spalte „Fachreferat“; darüber ordnet die Bedarfsliste die Ansprechpersonen des Fachreferats zu. Steht in der UPL nur ein Kürzel (z. B. KATS, SAND) und ist das Fachreferat nicht eindeutig: Kürzel übernehmen und in „Hinweis“ vermerken.' },
  { k: 'fach', t: 'Fachreferat freigegeben', w: 12, items: ['ja', 'nein', 'offen'], help: 'Aus „Kommentierung Referat › Bewertung“: „genehmigt“ = ja, „abgelehnt“ = nein, alles andere (auch „optional“ oder leer) = offen.' },
  { k: 'fachBeg', t: 'Begründung Fachreferat', w: 34, help: 'Nur bei „ja“: der Text aus „Kommentierung Referat › Begründung“, unverändert. Sonst leer.' },
  { k: 'verw', t: 'Verwaltung budgetiert', w: 12, items: ['ja', 'nein', 'offen'], help: 'Aus „Kommentierung aus der Beratung des Finanzausschuss und der GF › Bewertung“: „genehmigt“ = ja, „abgelehnt“ = nein, sonst offen.' },
  { k: 'verwBeg', t: 'Begründung Verwaltung', w: 34, help: 'Nur bei „ja“: der Text aus „… Finanzausschuss und der GF › Begründung“, unverändert. Sonst leer.' },
  { k: 'spenden', t: 'Bisherige Spenden (€)', w: 12, help: 'Aus „bisherige Spendeneingänge“, nur die Zahl; steht der Betrag nur im Beschreibungstext (z. B. „bisher eingegangene Spenden 2250,00 Euro“), ihn von dort nehmen. Sonst leer.' },
  { k: 'zeile', t: 'UPL-Zeile', w: 9, help: 'Zeilennummer in der UPL – zur Kontrolle.' },
  { k: 'hinweis', t: 'Hinweis', w: 34, help: 'Nur, wenn etwas unklar war (z. B. Ort nicht eindeutig, Zeitpunkt nicht umrechenbar, Summe widersprüchlich): kurz, was. Sonst leer.' },
];
const UPL_V_BLATT = 'UPL-Import';
const UPL_PROMPT = 'Übertrage die angehängte Unternehmensplanung (UPL, Investitionsabfrage) der Malteser in die ebenfalls angehängte Excel „UPL_Vorlage.xlsx“. '
  + 'Halte dich genau an das Blatt „Anleitung“: je Investition eine Zeile im Blatt „' + UPL_V_BLATT + '“, alle Zeilen der UPL mit OG-Nr. und Beschreibung, keine Legende und keine Summenzeilen. '
  + 'Texte (Beschreibung, Einschätzung Fundraising, Begründungen) unverändert kopieren, nichts erfinden oder zusammenfassen – nur der Kurzname und die Deadline werden von dir gebildet. '
  + 'Trag oben im Blatt „Anleitung“ das Geschäftsjahr ein. Was unklar ist, gehört in die Spalte „Hinweis“. Blattnamen und Spaltenüberschriften nicht ändern. '
  + 'Gib die ausgefüllte Datei als Excel zurück (bei Cowork: unter demselben Namen speichern) und nenne am Ende kurz die Zeilen mit Hinweis.';
function uplVorlageBlob() {
  const head = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, zelle = { border: 'thin', v: 'top', wrap: true };
  const rows = [UPL_V.map(c => ({ v: c.t, st: head }))];
  for (let i = 0; i < 300; i++) rows.push(UPL_V.map(c => ({ v: '', st: zelle, t: c.k === 'kennung' || c.k === 'deadline' ? 'txt' : undefined })));
  const lists = UPL_V.map((c, i) => c.items && { ref: colName(i) + '2:' + colName(i) + '301', items: c.items }).filter(Boolean);
  const S = { b: true, sz: 15 }, L = { b: true }, T = { wrap: true, v: 'top' };
  const anl = [[{ v: 'UPL in die Bedarfsliste übertragen', st: S }, ''], [{ v: 'Geschäftsjahr', st: L }, { v: '', st: { border: 'thin', fill: '#FFF4CC' } }], [],
    [{ v: 'Auftrag', st: L }, { v: UPL_PROMPT, st: T }], [],
    [{ v: 'Grundregeln', st: L }, { v: 'Je Investition der UPL genau eine Zeile im Blatt „' + UPL_V_BLATT + '“. Zeilen ohne OG-Nr. oder ohne Beschreibung (Legende, Summen, Leerzeilen) weglassen. Texte unverändert kopieren; nichts erfinden, nichts zusammenfassen, nichts weglassen. Was nicht eindeutig ist: Spalte „Hinweis“. Blattnamen und Überschriften nicht ändern. Beträge nur als Zahl, Daten als TT.MM.JJJJ.', st: T }], [],
    [{ v: 'Spalte', st: head }, { v: 'Was hineingehört', st: head }], ...UPL_V.map(c => [{ v: c.t, st: L }, { v: c.help + (c.items ? ' Auswahl: ' + c.items.join(', ') + '.' : ''), st: T }])];
  return xlsxBlob([{ name: UPL_V_BLATT, cols: UPL_V.map(c => c.w), rows, heights: { 0: 32 }, freeze: 'C2', lists, filter: 'A1:' + colName(UPL_V.length - 1) + '301' },
    { name: 'Anleitung', cols: [26, 110], rows: anl, grid: false },
    { name: 'Gliederungen', cols: [30], rows: [[{ v: 'Gliederung', st: head }], ['Diözese'], ...GL_LIST.map(g => [g])] }]);
}
// ausgefüllte Vorlage lesen (Blatt mit „Bedarf (Kurzname)“ und „Beschreibung“); jahr: aus dem Blatt „Anleitung“, sonst aus dem Dateinamen
function uplVorlageLesen(book, jahr0) {
  const sh = book.sheets.find(s => s.rows.slice(0, 3).some(r => r.some(v => /^bedarf \(kurzname\)/.test(norm(v))))); if (!sh) return null;
  const anl = book.sheets.find(s => /^anleitung/i.test(s.name)), gj = anl && (anl.rows.find(r => /^gesch(ä|ae)ftsjahr/.test(norm(r[0]))) || [])[1];
  const jahr = (String(gj || '').match(/20\d\d/) || [jahr0 || ''])[0];
  const hi = sh.rows.findIndex(r => r.some(v => /^bedarf \(kurzname\)/.test(norm(v)))), head = sh.rows[hi].map(norm), ci = {};
  for (const c of UPL_V) ci[c.k] = [c.t, ...(c.alt || [])].map(t => head.indexOf(norm(t))).find(i => i >= 0) ?? -1;   // „Dienst“: frühere Vorlagen
  const v = (r, k) => ci[k] >= 0 ? cellStr(r[ci[k]]) : '', zahl = (r, k) => { const x = ci[k] >= 0 ? r[ci[k]] : ''; const n = typeof x === 'number' ? x : deNum(cellStr(x)); return typeof n === 'number' && n > 0 ? n : null; };
  const ja = (r, k) => /^ja\b/i.test(v(r, k));
  return sh.rows.slice(hi + 1).filter(r => v(r, 'text')).map(r => {
    const text = v(r, 'text'), fr = v(r, 'fr');
    return { key: v(r, 'kennung') + '|' + kkey(text).slice(0, 80), titel: (v(r, 'titel') || uplTitel(text)).slice(0, 80), ort: uplOrt(v(r, 'ort') || ''), summe: zahl(r, 'summe'),
      beschreibung: text + (fr ? ' ---- ' + fr : ''), hoch: /^hoch$/i.test(v(r, 'prio')), dienst: v(r, 'dienst'), deadline: anyDate(r[ci.deadline]) || '', spenden: zahl(r, 'spenden') || 0,
      fach: ja(r, 'fach') ? v(r, 'fachBeg') || 'freigegeben' : null, verw: ja(r, 'verw') ? v(r, 'verwBeg') || 'budgetiert' : null, jahr, aus: !/^nein\b/i.test(v(r, 'ueber')), hinweis: v(r, 'hinweis') };
  });
}
async function uplImport(file) {
  if (!file) return;
  let L = [];
  let jahr = (String(file.name).match(/20\d\d/) || [''])[0];
  let vorlage = false;
  try { const bk = await xlsxBook(await file.arrayBuffer(), { max: 8e6 }), V = uplVorlageLesen(bk, jahr); vorlage = !!V; L = V || uplLesen(bk, jahr); } catch (e) { console.warn(e); }
  if (vorlage && L[0] && L[0].jahr) jahr = L[0].jahr;
  if (!L.length) { modal('Keine Investitionen gefunden', h('p', null, 'In „' + file.name + '“ steht keine Tabelle mit den Spalten „OG-Name“, „Investition mit Beschreibung“ und „Gesamtkosten“.')); return; }
  const da = new Map(D.bedarfe.filter(b => b.upl).map(b => [b.upl, b])), an = L.map(z => !da.has(z.key) && z.aus !== false);
  const frT = z => [z.fach && 'Fachreferat', z.verw && 'Verwaltung'].filter(Boolean).join(', ');
  const zeilen = L.map((z, i) => h('tr', { class: da.has(z.key) ? 'muted' : '' },
    h('td', null, da.has(z.key) ? '' : h('input', { type: 'checkbox', checked: an[i], 'aria-label': 'übernehmen', onchange: e => { an[i] = e.target.checked; } })),
    h('td', null, z.hoch ? '★ ' : '', h('b', null, z.titel), da.has(z.key) ? h('span', { class: 'small' }, ' – schon in der Liste') : null,
      z.aus === false && !da.has(z.key) ? h('span', { class: 'small' }, ' – laut Vorlage nicht übernehmen') : null, z.hinweis ? h('div', { class: 'small hint-warn' }, '⚠ ' + z.hinweis) : null),
    h('td', null, z.ort === DIO ? 'Diözese' : z.ort), h('td', { class: 'num' }, z.summe ? eur(z.summe) : '–'), h('td', { class: 'small' }, frT(z) || '–')));
  const schon = L.filter(z => da.has(z.key)).length;
  const body = h('div', { class: 'help' },
    h('p', null, h('b', null, L.length + ' Investitionen'), ' in „' + file.name + '“' + (schon ? ', davon ' + schon + ' schon in der Liste (dort werden nur neu erteilte Freigaben und fehlende Summen nachgetragen)' : '') + '.'),
    h('p', { class: 'muted small' }, (vorlage ? 'Aus der ausgefüllten UPL-Vorlage. ' : '') + 'Übernommen werden Name' + (vorlage ? '' : ' (Anfang der Beschreibung – gern kürzen)') + ', Ort, Summe, Beschreibung mit „ ---- “ und der Kommentierung des Fundraisings, Stern bei Priorität „hoch“' + (vorlage ? ', Deadline, bisherige Spenden als zugesagte Spende im Förderplan' : '')
      + (jahr ? ' und das Stichwort „UPL ' + jahr + '“' : '') + '. Freigaben nur, wenn erteilt: Referat „genehmigt“ = Fachreferat freigegeben, Finanzausschuss/GF „genehmigt“ = Verwaltung budgetiert.'),
    h('div', { class: 'upl-tab' }, h('table', { class: 'imp-tab' }, h('thead', null, h('tr', null, h('th'), h('th', null, 'Bedarf'), h('th', null, 'Ort'), h('th', { class: 'num' }, 'Summe'), h('th', null, 'Freigaben'))), h('tbody', null, zeilen))));
  if (!await modal('UPL einlesen', body, [['Abbrechen', false], ['Übernehmen', true, 'primary']], { wide: true })) return;
  const before = JSON.stringify(D); let neu = 0, nach = 0;
  L.forEach((z, i) => {
    const alt = da.get(z.key);
    if (alt) { if (uplAnwenden(alt, z, false)) nach++; return; }
    if (!an[i]) return;
    const b = blank(); uplAnwenden(b, z, true); D.bedarfe.push(b); da.set(z.key, b); neu++;
  });
  if (!neu && !nach) { toast('Nichts Neues in der UPL.'); return; }
  changed(); ORDER.ids = null; Object.assign(UI, { view: 'list', tab: 'aktiv', q: '', fSw: jahr && neu ? ['UPL ' + jahr] : UI.fSw }); renderNow();
  toast([neu && neu + ' Bedarfe aus der UPL angelegt', nach && nach + ' vorhandene ergänzt'].filter(Boolean).join(', ') + '.', 'ok', undoGanz(before));
}
