/* ===================================================================== Fördererliste: Excel-Vorlage und Auftrag für Copilot (ab 0.107)
   Im ⋯-Menü eines Förderers: „Vorlage für Copilot herunterladen“, „Auftrag für Copilot kopieren“ und „Ausgefüllte Vorlage einlesen …“.
   Die Vorlage beschreibt EINEN Förderer: Blatt „Steckbrief“ (Feld · Wert · Sicherheit · Quelle · Anmerkung), „Fristen“, „Fördertöpfe“, „Kontakte“, „Quellen“;
   dazu „Anleitung“ und „Auswahlwerte“. Beim Einlesen zeigt das Programm jede Angabe einzeln zum Ankreuzen: neue Angaben sind vorgewählt, Angaben, die
   einen vorhandenen Wert ersetzen würden, und „unsichere“ nicht. */
const FLC_DATEI = 'Foerderer_Copilot_Vorlage.xlsx';
const FLC_HAEUFIG = ['alle paar Jahre', 'jährlich', 'mehrmals jährlich'], FLC_AUFWAND = ['sehr aufwendig', 'mäßig', 'einfach'], FLC_DAUER = ['> 6 Monate', '2–6 Monate', '< 2 Monate'];
// Zeilen im Blatt „Steckbrief“: [Schlüssel, Feld, Erklärung, Auswahl]
const FLC_FELDER = [
  ['name', 'Name des Förderers (voller Name)', 'Offizieller Name, wie auf der Homepage oder in der Satzung.'],
  ['kurz', 'Kurzname (intern)', 'Nur wenn es eine gebräuchliche Abkürzung gibt, z. B. DSEE. Sonst leer.'],
  ['art', 'Art', 'Eine Art aus der Auswahlliste.', () => FL_ARTEN],
  ['frei', 'Förderzweck (Freitext)', 'Wofür fördert der Förderer? Kurze Stichworte, mit Komma getrennt (z. B. Ehrenamt, Jugend, Gesundheit).'],
  ['zw', 'Zwecke der Malteser (Auswahl, mehrere mit Komma)', 'Nur Zwecke aus der Liste im Blatt „Auswahlwerte“, die zum Förderzweck des Förderers passen (z. B. Gesundheit, Jugendhilfe). Kultur o. Ä. weglassen.'],
  ['gl', 'Fördergebiet (Gliederungen, Komma getrennt)', 'Gliederungen der Malteser aus „Auswahlwerte“, in deren Gebiet der Förderer fördert (z. B. Stadt Dortmund → Dortmund). Gilt es für das ganze Erzbistum, NRW oder bundesweit: alle'],
  ['von', 'Förderhöhe von (€)', 'Nur eine Zahl, ohne Einheit (z. B. 1000). Kleinster übliche Betrag; leer, wenn unbekannt.'],
  ['bis', 'Förderhöhe bis (€)', 'Nur eine Zahl, ohne Einheit (z. B. 10000). Höchster Betrag laut Richtlinie oder Förderhistorie; ist die Höhe fest, hier und bei „von“ denselben Betrag.'],
  ['quote', 'Förderquote', 'Freitext wie in der Richtlinie, z. B. bis 90 % der Kosten, Eigenanteil 10 %. Leer, wenn nicht genannt.'],
  ['fristen', 'Hinweis zu Fristen', 'Nur wenn es keine festen Termine gibt, z. B. laufend, Sitzung des Gremiums im März und September. Feste Termine gehören ins Blatt „Fristen“.'],
  ['web', 'Homepage', 'Link zur Seite des Förderers.'],
  ['richtlinien', 'Förderrichtlinien (Link)', 'Link zur Seite oder zum PDF mit Förderrichtlinien, Vergaberichtlinien oder Fördergrundsätzen.'],
  ['weg', 'Antragsweg', 'E-Mail oder Portal.', () => FL_WEGE],
  ['antrag', 'Antrag an (E-Mail-Adresse oder Link zum Portal)', 'Bei E-Mail: die Adresse für Anträge. Bei Portal: Link zum Antragsportal bzw. Antragsformular.'],
  ['anschrift', 'Anschrift', 'Straße, PLZ Ort.'],
  ['haeufig', 'Häufigkeit', 'Wie oft kann ein Antragsteller dort Geld bekommen? Nur ausfüllen, wenn aus den Richtlinien ableitbar; Begründung in „Anmerkung“.', () => FLC_HAEUFIG],
  ['aufwand', 'Aufwand', 'Aufwand des Antrags: einfach = E-Mail/kurzes Formular; mäßig = Formular mit Kosten- und Finanzierungsplan; sehr aufwendig = ausführlicher Antrag mit vielen Anlagen oder Verwendungsnachweis. Nur wenn ableitbar; Begründung in „Anmerkung“.', () => FLC_AUFWAND],
  ['dauer', 'Dauer bis zur Entscheidung', 'Nur wenn der Förderer eine Bearbeitungszeit nennt.', () => FLC_DAUER],
  ['gross', 'Großförderer (ja = über 10.000 € möglich)', 'ja nur, wenn laut Quelle Förderungen über 10.000 € möglich sind. Sonst leer.', () => ['ja', 'nein']],
  ['notiz', 'Notizen', 'Besonderheiten für die Antragstellung (z. B. Zugang, Ausschlüsse, was nicht gefördert wird). Kurz.'],
];
const FLC_SICHER = ['sicher', 'unsicher'];
const flcZweckeListe = () => MHD_ZWECKE.map(z => z.k);

// ---------- Vorlage
function flcVorlageBlob(e) {
  e = e || null;
  const kopf = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, z = { border: 'thin', v: 'top', wrap: true }, leer = { border: 'thin', v: 'top', wrap: true, fill: '#FFFBE6' }, grau = { border: 'thin', v: 'top', wrap: true, color: '#6B6B6B' };
  const wert0 = { name: e && e.name, kurz: e && e.kurz, art: e && e.art, web: e && e.web };
  const bl = (name, cols, kopfZ, n, extra = {}) => ({ name, cols, freeze: 'A2', heights: { 0: 30 }, rows: [kopfZ.map(v => ({ v, st: kopf })), ...Array.from({ length: n }, () => cols.map(() => ({ v: '', st: leer })))], ...extra });
  const L = (sp, n, items) => ({ ref: `${sp}2:${sp}${n + 1}`, items });
  const steck = { name: 'Steckbrief', cols: [44, 44, 62, 14, 40, 40], freeze: 'A2', heights: { 0: 30 },
    rows: [['Feld', 'Wert', 'Format / Erklärung', 'Sicherheit', 'Quelle (Link)', 'Anmerkung'].map(v => ({ v, st: kopf })),
      ...FLC_FELDER.map(([k, f, erkl]) => [{ v: f, st: { border: 'thin', v: 'top', wrap: true, b: true } }, { v: wert0[k] || '', st: leer }, { v: erkl, st: grau }, { v: '', st: leer }, { v: '', st: leer }, { v: '', st: leer }])],
    lists: [...FLC_FELDER.map(([k, , , li], i) => li ? { ref: `B${i + 2}:B${i + 2}`, items: li() } : null).filter(Boolean), L('D', FLC_FELDER.length, FLC_SICHER)] };
  const fristen = bl('Fristen', [18, 14, 34, 14, 40], ['Frist (TT.MM.JJJJ)', 'Jedes Jahr (ja/nein)', 'Fördertopf (leer = allgemein)', 'Sicherheit', 'Quelle (Link)'], 25,
    { lists: [L('B', 25, ['ja', 'nein']), L('D', 25, FLC_SICHER)] });
  const toepfe = bl('Fördertöpfe', [30, 18, 34, 28, 14, 14, 28, 14, 40], ['Fördertopf (voller Name)', 'Kurzname', 'Förderzweck', 'Fördergebiet (Gliederungen)', 'Förderhöhe von (€)', 'Förderhöhe bis (€)', 'Förderquote', 'Sicherheit', 'Quelle (Link)'], 12,
    { lists: [L('H', 12, FLC_SICHER)] });
  const kontakte = bl('Kontakte', [28, 28, 32, 22, 26, 16, 14, 40], ['Name', 'Position', 'E-Mail', 'Telefon', 'Gliederungen (leer = alle)', 'Anschreiben (leer lassen)', 'Sicherheit', 'Quelle (Link)'], 15,
    { lists: [L('G', 15, FLC_SICHER)] });
  const quellen = bl('Quellen', [60, 60, 16], ['Link (wirklich geöffnet)', 'Was dort steht', 'Abgerufen am (TT.MM.JJJJ)'], 25);
  const spalten = [['Art', FL_ARTEN], ['Antragsweg', FL_WEGE], ['Häufigkeit', FLC_HAEUFIG], ['Aufwand', FLC_AUFWAND], ['Dauer', FLC_DAUER], ['Zwecke der Malteser', flcZweckeListe()], ['Gliederungen der Malteser', GL_LIST]];
  const auswahl = { name: 'Auswahlwerte', cols: spalten.map(() => 32), freeze: 'A2', heights: { 0: 30 },
    rows: [spalten.map(([t]) => ({ v: t, st: kopf })), ...Array.from({ length: Math.max(...spalten.map(s => s[1].length)) }, (_, i) => spalten.map(([, li]) => ({ v: li[i] || '', st: z })))] };
  const text = [
    ['Förderer-Vorlage für Copilot', { b: true, sz: 15 }],
    ['Diese Datei beschreibt einen Förderer der Malteser (Diözese Paderborn). Sie wird recherchiert und ausgefüllt und danach in die Bedarfsliste eingelesen (Fördererliste → Seite des Förderers → ⋯ → „Ausgefüllte Vorlage einlesen …“).'],
    [''],
    ['Regeln für das Ausfüllen', { b: true }],
    ['1. Nur die gelb hinterlegten Zellen ausfüllen: im Blatt „Steckbrief“ die Spalten „Wert“, „Sicherheit“, „Quelle“ und „Anmerkung“, in „Fristen“, „Fördertöpfe“, „Kontakte“ und „Quellen“ die Zeilen darunter. Keine Blätter, Spalten oder Überschriften ändern, umbenennen, löschen oder hinzufügen. „Anleitung“ und „Auswahlwerte“ nicht ändern.'],
    ['2. Nichts raten und nichts erfinden: Was nicht belegt ist, bleibt leer. Jede ausgefüllte Angabe bekommt in „Quelle“ einen Link, den Sie wirklich geöffnet haben (bevorzugt Seiten des Förderers: Satzung, Förderrichtlinien, Antragsformular, Jahresbericht).'],
    ['3. Spalte „Sicherheit“: „sicher“ = steht so in der Quelle; „unsicher“ = nur indirekt belegt, älter als zwei Jahre oder widersprüchlich. Unsichere Angaben übernimmt das Programm nicht automatisch.'],
    ['4. Auswahlfelder nur mit den vorgegebenen Werten füllen (Blatt „Auswahlwerte“). Zahlen ohne Einheit und ohne Tausenderpunkt (z. B. 10000). Datum als TT.MM.JJJJ; eine Frist ohne Jahr (z. B. 31.03.) gilt jedes Jahr.'],
    ['5. Kontakte: nur Personen oder Funktionen, deren Kontaktdaten der Förderer selbst öffentlich nennt (Impressum, Seite „Ansprechpartner“). Keine privaten Daten, nichts aus sozialen Netzwerken. „Anschreiben“ leer lassen – das entscheiden wir.'],
    ['6. Hat der Förderer mehrere Förderprogramme (Fördertöpfe), jedes in einer Zeile im Blatt „Fördertöpfe“ mit eigenem Zweck, Gebiet, Höhe und Quote; Fristen eines Programms im Blatt „Fristen“ mit demselben Namen in „Fördertopf“.'],
    ['7. Zu jeder Einschätzung (Häufigkeit, Aufwand, Dauer) kurz in „Anmerkung“ begründen – oder leer lassen.'],
    [''],
    ['Stand: ' + (typeof today === 'function' ? fmtDate(today()) : '')],
  ];
  const anl = { name: 'Anleitung', cols: [130], grid: false, rows: text.map(([t, st]) => [{ v: t, st: Object.assign({ wrap: true, v: 'top' }, st || {}) }]) };
  return xlsxBlob([anl, steck, fristen, toepfe, kontakte, quellen, auswahl]);
}

// ---------- Auftrag für Copilot
function flcPrompt(e) {
  const n = e && e.name ? '„' + e.name + '“' : 'den Förderer, der im Blatt „Steckbrief“ bei „Name des Förderers“ steht';
  return [
    'Du bist Rechercheassistent im Fundraising der Malteser (Malteser Hilfsdienst e. V., Diözese Paderborn). Im Anhang liegt die Excel-Datei „' + FLC_DATEI + '“. Recherchiere im Web den Förderer ' + n + (e && e.web ? ' (Homepage: ' + e.web + ')' : '') + ' und fülle die Datei aus. Ich lese sie danach in unser Programm ein.',
    '',
    'So gehst du vor:',
    '1. Lies zuerst das Blatt „Anleitung“ und die Spalte „Format / Erklärung“ im Blatt „Steckbrief“ – dort steht, was in jede Zelle gehört.',
    '2. Recherchiere vor allem auf den eigenen Seiten des Förderers: Satzung, Förderrichtlinien oder Vergaberichtlinien, Antragsformular, Jahresbericht, Seite „Ansprechpartner“ oder Impressum. Prüfe außerdem, ob es mehrere Förderprogramme (Fördertöpfe) gibt.',
    '3. Fülle nur die gelb hinterlegten Zellen: im Blatt „Steckbrief“ die Spalten Wert, Sicherheit, Quelle und Anmerkung; in „Fristen“, „Fördertöpfe“, „Kontakte“ und „Quellen“ die Zeilen darunter. Ändere keine Überschriften, Blattnamen oder Spalten, füge nichts hinzu und lösche nichts. „Anleitung“ und „Auswahlwerte“ bleiben unverändert.',
    '4. Erfinde nichts und rate nicht. Was du nicht belegen kannst, bleibt leer. Trage bei jeder ausgefüllten Angabe in „Quelle“ den Link ein, den du tatsächlich geöffnet hast – keine Links aus dem Gedächtnis. Setze „Sicherheit“ auf „sicher“, wenn die Angabe so in der Quelle steht, sonst auf „unsicher“ (indirekt belegt, älter als zwei Jahre oder widersprüchlich).',
    '5. Formate: Auswahlfelder nur mit den Werten aus dem Blatt „Auswahlwerte“ (genau so geschrieben). Beträge als reine Zahl ohne Einheit und ohne Tausenderpunkt (10000). Datum als TT.MM.JJJJ; eine Frist ohne Jahr (31.03.) gilt jedes Jahr, bei einmaligen Fristen „Jedes Jahr“ = nein.',
    '6. Förderzweck: kurze Stichworte in eigenen Worten. Bei „Zwecke der Malteser“ nur die Zwecke aus der Liste wählen, die zum Förderzweck des Förderers passen; Zwecke ohne Bezug zu den Maltesern (z. B. Kultur, Sport, Tierschutz) lässt du weg. Passt der Förderer nach seiner Satzung gar nicht zu den Maltesern, schreib das in „Notizen“.',
    '7. Fördergebiet: Nenne die Gliederungen aus „Auswahlwerte“, in deren Gebiet der Förderer fördert (z. B. Stadt Dortmund → Dortmund). Gilt es für das ganze Erzbistum Paderborn, NRW oder bundesweit, schreib „alle“.',
    '8. Förderhöhe: nur Beträge, die in einer Quelle stehen (Richtlinie oder veröffentlichte Förderungen). Förderquote und Eigenanteil als Freitext wie in der Richtlinie. „Großförderer“ = ja nur, wenn laut Quelle Förderungen über 10.000 € möglich sind.',
    '9. Fristen: jeden festen Antragstermin einzeln ins Blatt „Fristen“ (bei Fördertöpfen mit dem Namen des Topfs). Gibt es keine festen Termine, schreib den Hinweis (z. B. „laufend“) in „Hinweis zu Fristen“ im Blatt „Steckbrief“.',
    '10. Kontakte: nur Personen oder Funktionen, deren Kontaktdaten der Förderer selbst öffentlich nennt. Keine privaten Daten, nichts aus sozialen Netzwerken, keine Vermutungen zu E-Mail-Adressen. Die Spalte „Anschreiben“ bleibt leer.',
    '11. Häufigkeit, Aufwand und Dauer nur ausfüllen, wenn du es aus den Richtlinien ableiten kannst, und in „Anmerkung“ kurz begründen.',
    '12. Alle geöffneten Seiten trägst du zusätzlich im Blatt „Quellen“ ein (Link, was dort steht, Abrufdatum).',
    '',
    'Gib mir die ausgefüllte Datei als Excel-Datei zum Herunterladen zurück (gleicher Dateiname mit dem Zusatz „_ausgefüllt“). Schreibe darunter in höchstens fünf Sätzen, was du nicht gefunden hast und wo du unsicher bist. Wenn du keine Datei erzeugen kannst, gib den Inhalt jedes Blatts als Tabelle mit denselben Überschriften aus, damit ich ihn einfügen kann.',
  ].join('\n');
}

// ---------- Einlesen
const flcSchluessel = [['name', /^name des f/], ['kurz', /^kurzname/], ['art', /^art$/], ['frei', /^f(ö|oe)rderzweck/], ['zw', /^zwecke der malteser/], ['gl', /^f(ö|oe)rdergebiet/], ['von', /^f(ö|oe)rderh(ö|oe)he von/], ['bis', /^f(ö|oe)rderh(ö|oe)he bis/],
  ['quote', /^f(ö|oe)rderquote/], ['fristen', /^hinweis zu fristen/], ['web', /^homepage/], ['richtlinien', /^f(ö|oe)rderrichtlinien/], ['weg', /^antragsweg/], ['antrag', /^antrag an/], ['anschrift', /^anschrift/],
  ['haeufig', /^h(ä|ae)ufigkeit/], ['aufwand', /^aufwand/], ['dauer', /^dauer/], ['gross', /^gro(ß|ss)f(ö|oe)rderer/], ['notiz', /^notizen/]];
const flcStufe = (x, v) => { const n = norm(v); if (!n) return 0; for (let i = 2; i >= 0; i--) if (n === norm(x.bed[i]) || n === norm(x.st[i])) return i + 1; return flStufe(x, v); };
function flcFristDatum(v, jedesJahr) {                                          // Zahl (Excel-Datum) oder Text; „31.03.“ ohne Jahr = jedes Jahr
  const d0 = typeof v === 'number' ? xlDatum(v) : fristParse(cellStr(v)); if (!d0) return '';
  if (d0.length === 5) return jedesJahr === 'nein' ? (d0 >= today().slice(5) ? today().slice(0, 4) : String(+today().slice(0, 4) + 1)) + '-' + d0 : d0;
  return jedesJahr === 'nein' ? d0 : d0.slice(5);
}
function flcLesen(book) {
  const blatt = n => book.sheets.find(s => norm(s.name) === norm(n));
  const st = blatt('Steckbrief'); if (!st) return null;
  const F = {}; let n = 0;
  for (const r of st.rows.slice(1)) { const lab = norm(cellStr(r[0])), k = (flcSchluessel.find(([, re]) => re.test(lab)) || [])[0]; if (!k) continue; n++;
    F[k] = { wert: r[1], text: cellStr(r[1]), unsicher: norm(r[3]) === 'unsicher', quelle: cellStr(r[4]), notiz: cellStr(r[5]) }; }
  if (!n) return null;
  const tab = (name, k0) => { const s = blatt(name); return s ? s.rows.slice(1).filter(r => r && cellStr(r[k0 || 0])) : []; };
  return { F,
    fristen: tab('Fristen').map(r => ({ d: flcFristDatum(r[0], norm(r[1])), topf: strV(r[2]), unsicher: norm(r[3]) === 'unsicher', quelle: cellStr(r[4]), roh: cellStr(r[0]) })),
    topfe: tab('Fördertöpfe').map(r => ({ name: strV(r[0]), kurz: strV(r[1]), schwer: strV(r[2]), gl: strL(r[3]), von: zahlOderLeer(r[4]), bis: zahlOderLeer(r[5]), quote: strV(r[6]), unsicher: norm(r[7]) === 'unsicher', quelle: cellStr(r[8]) })),
    kontakte: tab('Kontakte').map(r => ({ n: strV(r[0]), pos: strV(r[1]), mail: mailRein(r[2]), tel: cellStr(r[3]), gl: strL(r[4]), unsicher: norm(r[6]) === 'unsicher', quelle: cellStr(r[7]) })),
    quellen: tab('Quellen').map(r => ({ url: cellStr(r[0]), was: cellStr(r[1]), am: cellStr(r[2]) })) };
}
// Angaben als Liste von Änderungen: { titel, alt, neu, fn, unsicher, quelle, notiz, an }
function flcAenderungen(e, R) {
  const L = [], F = R.F, w = k => (F[k] ? F[k].text : '');
  const add = (k, titel, alt, neu, fn, o = {}) => { if (!strV(neu) || strV(alt) === strV(neu)) return; const f = F[k] || {};
    L.push({ titel, alt: strV(alt), neu: strV(neu), fn, unsicher: !!(f.unsicher || o.unsicher), quelle: f.quelle || o.quelle || '', notiz: f.notiz || '', an: !strV(alt) && !(f.unsicher || o.unsicher) }); };
  add('name', 'Name', e.name, w('name'), () => { e.name = w('name'); });
  add('kurz', 'Kurzname', e.kurz, w('kurz'), () => { e.kurz = w('kurz'); });
  const art = FL_ARTEN.find(a => norm(a) === norm(w('art'))); add('art', 'Art', e.art, art || '', () => { e.art = art; });
  const zw = flcZweckeListe().filter(k => strL(w('zw')).some(t => norm(t) === norm(k))), zNeu = [w('frei'), ...zw].filter(Boolean).join(', ');
  add('frei', 'Förderzweck', e.schwer, zNeu, () => { e.schwer = zNeu; }, { unsicher: !!(F.zw && F.zw.unsicher), quelle: (F.zw || {}).quelle });
  add('gl', 'Fördergebiet', e.gl.join(', '), strL(w('gl')).join(', '), () => { e.gl = strL(w('gl')); });
  const von = zahlOderLeer(F.von && F.von.wert), bis = zahlOderLeer(F.bis && F.bis.wert);
  if (von != null || bis != null) { const t = flHoeheKlar({ hoeheVon: von, hoeheBis: bis == null ? von : bis, hoehe: '' }); add('von', 'Förderhöhe', flHoeheKlar(e), t, () => { Object.assign(e, { hoeheVon: von == null ? bis : von, hoeheBis: bis == null ? von : bis, hoehe: '' }); }, { unsicher: !!(F.bis && F.bis.unsicher), quelle: (F.bis || {}).quelle }); }
  add('quote', 'Förderquote', e.quote, w('quote'), () => { e.quote = w('quote'); });
  add('fristen', 'Hinweis zu Fristen', e.fristen, w('fristen'), () => { e.fristen = w('fristen'); });
  add('web', 'Homepage', e.web, flUrlVoll(w('web')), () => { e.web = flUrlVoll(w('web')); });
  add('richtlinien', 'Förderrichtlinien', e.richtlinien, flUrlVoll(w('richtlinien')), () => { e.richtlinien = flUrlVoll(w('richtlinien')); });
  const weg = flWegNorm(w('weg')); if (weg) add('weg', 'Antragsweg', e.weg.join(', '), weg, () => { e.weg = [weg]; });
  const an = weg === 'Portal' ? flUrlVoll(w('antrag')) : mailRein(w('antrag')); add('antrag', 'Antrag an', e.antrag, an, () => { e.antrag = an; });
  add('anschrift', 'Anschrift', e.anschrift, w('anschrift'), () => { e.anschrift = w('anschrift'); });
  for (const [k, titel, x] of [['haeufig', 'Häufigkeit', FL_BEW[2]], ['aufwand', 'Aufwand', FL_BEW[3]], ['dauer', 'Dauer', FL_BEW[4]]]) { const v = flcStufe(x, w(k)); if (v) add(k, titel, e.bew[x.k] ? x.bed[e.bew[x.k] - 1] : '', x.bed[v - 1], () => { e.bew[x.k] = v; }); }
  if (norm(w('gross')) === 'ja' && !e.gross) add('gross', 'Großförderer (> 10.000 € möglich)', '', 'ja', () => { e.gross = true; });
  if (w('notiz')) add('notiz', 'Notizen (wird angehängt)', e.notiz ? '(bisher vorhanden)' : '', w('notiz'), () => { e.notiz = [e.notiz, w('notiz')].filter(Boolean).join('\n'); }, {});
  for (const f of R.fristen) { if (!f.d) { L.push({ titel: 'Frist', alt: '', neu: '„' + f.roh + '“ ist kein Datum – wird nicht übernommen', fn: null, unsicher: true, quelle: f.quelle, an: false }); continue; }
    if (e.fristenL.some(x => x.d === f.d && x.topf === f.topf)) continue;
    L.push({ titel: 'Frist' + (f.topf ? ' · ' + f.topf : ''), alt: '', neu: fristText(f.d) + (f.d.length === 5 ? ' (jedes Jahr)' : ' (einmalig)'), fn: () => { e.fristenL.push({ id: uid('fr'), d: f.d, topf: f.topf }); }, unsicher: f.unsicher, quelle: f.quelle, an: !f.unsicher }); }
  for (const t of R.topfe) { if (!t.name) continue; const x = e.topfe.find(y => norm(y.name) === norm(t.name));
    if (!x) L.push({ titel: 'Fördertopf', alt: '', neu: [t.name, t.kurz && '(' + t.kurz + ')', t.schwer, flHoeheKlar({ hoeheVon: t.von, hoeheBis: t.bis == null ? t.von : t.bis, hoehe: '' }), t.quote].filter(Boolean).join(' · '),
      fn: () => { e.topfe.push({ id: uid('t'), name: t.name, kurz: t.kurz, schwer: t.schwer, gl: t.gl, hoehe: '', hoeheVon: t.von == null ? t.bis : t.von, hoeheBis: t.bis == null ? t.von : t.bis, quote: t.quote }); }, unsicher: t.unsicher, quelle: t.quelle, an: !t.unsicher });
    else if ((!x.schwer && t.schwer) || (!x.gl.length && t.gl.length) || (!x.quote && t.quote) || (x.hoeheVon == null && x.hoeheBis == null && (t.von != null || t.bis != null)))
      L.push({ titel: 'Fördertopf ergänzen · ' + t.name, alt: '', neu: 'leere Felder füllen: ' + [!x.schwer && t.schwer, !x.gl.length && t.gl.join(', '), !x.quote && t.quote].filter(Boolean).join(' · '),
        fn: () => { if (!x.schwer) x.schwer = t.schwer; if (!x.gl.length) x.gl = t.gl; if (!x.quote) x.quote = t.quote; if (x.hoeheVon == null && x.hoeheBis == null && (t.von != null || t.bis != null)) Object.assign(x, { hoeheVon: t.von == null ? t.bis : t.von, hoeheBis: t.bis == null ? t.von : t.bis, hoehe: '' }); }, unsicher: t.unsicher, quelle: t.quelle, an: !t.unsicher }); }
  for (const k of R.kontakte) { if (!k.n) continue; const x = e.kontakte.find(y => kkey(y.n) === kkey(k.n));
    if (!x) L.push({ titel: 'Kontakt', alt: '', neu: [k.n, k.pos, k.mail, k.tel].filter(Boolean).join(' · '), fn: () => { e.kontakte.push(Object.assign(flKontaktLeer(), { n: k.n, pos: k.pos, mail: k.mail, tel: k.tel, gl: k.gl })); }, unsicher: k.unsicher, quelle: k.quelle, an: !k.unsicher });
    else if ((!x.pos && k.pos) || (!x.mail && k.mail) || (!x.tel && k.tel))
      L.push({ titel: 'Kontakt ergänzen · ' + k.n, alt: '', neu: [!x.pos && k.pos, !x.mail && k.mail, !x.tel && k.tel].filter(Boolean).join(' · '), fn: () => { if (!x.pos) x.pos = k.pos; if (!x.mail) x.mail = k.mail; if (!x.tel) x.tel = k.tel; }, unsicher: k.unsicher, quelle: k.quelle, an: !k.unsicher }); }
  const qs = R.quellen.filter(q => q.url);
  if (qs.length) { const t = 'Quellen der Recherche (' + fmtDate(today()) + '):\n' + qs.map(q => '- ' + q.url + (q.was ? ' – ' + q.was : '')).join('\n');
    L.push({ titel: 'Quellen in die Notizen', alt: '', neu: qs.length + (qs.length === 1 ? ' Link' : ' Links'), fn: () => { e.notiz = [e.notiz, t].filter(Boolean).join('\n\n'); }, unsicher: false, quelle: '', an: false }); }
  L.push({ titel: 'Recherchestand', alt: e.recherche ? fmtDate(e.recherche) : '', neu: fmtDate(today()), fn: () => { e.recherche = today(); }, unsicher: false, quelle: '', an: true });
  return L;
}
async function flcEinlesen() {
  if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
  const e = flCur(); if (!e) return;
  const f = await pickFile('.xlsx'); if (!f) return;
  let R = null; try { R = flcLesen(await xlsxBook(await f.arrayBuffer())); } catch (x) { console.warn(x); }
  if (!R) { modal('Keine Copilot-Vorlage erkannt', h('p', {}, 'In „' + f.name + '“ fehlt das Blatt „Steckbrief“ mit den Feldern der Vorlage. Bitte die Vorlage über ⋯ → „Vorlage für Copilot herunterladen“ holen und von Copilot ausfüllen lassen.')); return; }
  const L = flcAenderungen(e, R), cbs = L.map(x => h('input', { type: 'checkbox', checked: x.an, disabled: !x.fn, 'aria-label': x.titel }));
  const zeile = (x, i) => h('label', { class: 'check flc-z' + (x.unsicher ? ' unsicher' : '') }, cbs[i],
    h('span', { class: 'flc-t' }, h('b', {}, x.titel), x.alt ? h('span', { class: 'muted' }, ' · bisher: ' + x.alt) : null, x.unsicher ? h('span', { class: 'fl-pill warn' }, 'unsicher') : null),
    h('span', { class: 'flc-n' }, x.neu), x.quelle ? h('span', { class: 'muted small flc-q' }, 'Quelle: ' + x.quelle) : null, x.notiz ? h('span', { class: 'muted small flc-q' }, x.notiz) : null);
  const n0 = L.filter(x => x.an).length;
  const body = h('div', { class: 'flc' }, h('p', { class: 'muted small' }, 'Aus „' + f.name + '“ für „' + (e.name || 'diesen Förderer') + '“. Vorgewählt sind neue, sichere Angaben (' + n0 + '). Angaben, die etwas Vorhandenes ersetzen würden, und unsichere sind nicht angekreuzt – bitte einzeln prüfen.'),
    h('div', { class: 'flc-l' }, ...L.map(zeile)));
  const ok = await modal('Angaben aus Copilot übernehmen?', body, [['Abbrechen', false], ['Ausgewählte übernehmen', true, 'primary']], { wide: true });
  if (!ok) return;
  let n = 0; L.forEach((x, i) => { if (cbs[i].checked && x.fn) { x.fn(); n++; } });
  if (n) { e.fristenL.sort((a, c) => a.d.localeCompare(c.d)); flZuKartei(); changed(); keep(renderNow); }
  toast(n ? n + (n === 1 ? ' Angabe' : ' Angaben') + ' übernommen' : 'Nichts übernommen', n ? 'ok' : undefined);
}
function flcPromptKopieren(e) {
  const t = flcPrompt(e), fail = () => { modal('Auftrag für Copilot', h('textarea', { class: 'rech-prompt', rows: 14, spellcheck: false, value: t, readonly: true })); };
  try { navigator.clipboard.writeText(t).then(() => toast('Auftrag kopiert – in Copilot einfügen und die Vorlage anhängen', 'ok'), fail); } catch (x) { fail(); }
}
