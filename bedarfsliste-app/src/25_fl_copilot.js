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
  ['gefoerdert', 'Was wird gefördert?', 'Konkret, was der Förderer fördert (Projekte, Anschaffungen, Zielgruppen) – kurze Stichpunkte, jeder in einer neuen Zeile mit „- “ am Anfang. Nur Belegtes.'],
  ['nicht', 'Was wird nicht gefördert?', 'Ausschlüsse laut Satzung oder Richtlinie (z. B. laufende Kosten, Personal, Rückwirkendes, bestimmte Zwecke) – Stichpunkte wie oben.'],
  ['tickt', 'Wie tickt der Förderer? (Zusammenfassung, 2–3 Sätze)', 'Worum geht es dem Förderer? Was ist ihm wichtig, welcher Ton, welche Haltung, wer entscheidet, wie fördert er (z. B. oft kleine Beträge an Vereine vor Ort)? Nur 2–3 Sätze, aus Satzung, Leitbild, Richtlinien und veröffentlichten Förderungen abgeleitet.'],
  ['zieht', 'Förderargumentation: Argumente, die ziehen', 'Welche Argumente überzeugen diesen Förderer für ein Vorhaben der Malteser? Nach Gewicht sortiert, je Stichpunkt kurz begründen und die Fundstelle nennen (z. B. „Satzungszweck: Förderung des Ehrenamts“).'],
  ['stolper', 'Förderargumentation: Stolpersteine', 'Wo kann ein Antrag scheitern oder auf Widerstand stoßen? (z. B. Ausschlüsse, kirchliche Träger, Eigenanteil, Fristen, Nachweispflichten, Gleichbehandlung mit anderen Trägern) – je Stichpunkt kurz begründen.'],
  ['notiz', 'Weitere Notizen', 'Sonstige Besonderheiten für die Antragstellung (z. B. Zugang, Ansprechweg, Sitzungsrhythmus). Kurz; leer, wenn es nichts gibt.'],
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
    '12. Notizen (diese Felder landen später in den Notizen des Förderers): „Was wird gefördert?“ und „Was wird nicht gefördert?“ als kurze Stichpunkte (jeder in einer neuen Zeile, mit „- “ am Anfang), nur Belegtes aus Satzung und Richtlinien. „Wie tickt der Förderer?“ in 2–3 Sätzen: Was ist ihm wichtig, welche Haltung, wie und wem fördert er typischerweise? „Förderargumentation“: Welche Argumente ziehen bei diesem Förderer für ein Vorhaben der Malteser (nach Gewicht sortiert, je Argument kurz begründen und die Fundstelle nennen, z. B. „Satzungszweck: Förderung des Ehrenamts“)? Wo sind Stolpersteine (Ausschlüsse, kirchliche Träger, Eigenanteil, Nachweispflichten, Gleichbehandlung)? Alles aus den Quellen abgeleitet, keine Vermutungen ohne Hinweis darauf – Eigenes kennzeichnest du mit „Einschätzung:“.',
    '13. Alle geöffneten Seiten trägst du zusätzlich im Blatt „Quellen“ ein (Link, was dort steht, Abrufdatum).',
    '',
    'Gib mir die ausgefüllte Datei als Excel-Datei zum Herunterladen zurück (gleicher Dateiname mit dem Zusatz „_ausgefüllt“). Schreibe darunter in höchstens fünf Sätzen, was du nicht gefunden hast und wo du unsicher bist. Wenn du keine Datei erzeugen kannst, gib den Inhalt jedes Blatts als Tabelle mit denselben Überschriften aus, damit ich ihn einfügen kann.',
  ].join('\n');
}

// ---------- Einlesen
const flcSchluessel = [['name', /^name des f/], ['kurz', /^kurzname/], ['art', /^art$/], ['frei', /^f(ö|oe)rderzweck/], ['zw', /^zwecke der malteser/], ['gl', /^f(ö|oe)rdergebiet/], ['von', /^f(ö|oe)rderh(ö|oe)he von/], ['bis', /^f(ö|oe)rderh(ö|oe)he bis/],
  ['quote', /^f(ö|oe)rderquote/], ['fristen', /^hinweis zu fristen/], ['web', /^homepage/], ['richtlinien', /^f(ö|oe)rderrichtlinien/], ['weg', /^antragsweg/], ['antrag', /^antrag an/], ['anschrift', /^anschrift/],
  ['haeufig', /^h(ä|ae)ufigkeit/], ['aufwand', /^aufwand/], ['dauer', /^dauer/], ['gross', /^gro(ß|ss)f(ö|oe)rderer/], ['gefoerdert', /^was wird gef(ö|oe)rdert/], ['nicht', /^was wird nicht/], ['tickt', /^wie tickt/], ['zieht', /^f(ö|oe)rderargumentation: argumente/], ['stolper', /^f(ö|oe)rderargumentation: stolper/], ['notiz', /^weitere notizen|^notizen/]];
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
// Angaben als Liste von Änderungen: { bereich, titel, alt, neu, fn(wert), edit: '' | 'text' | 'rich' | 'sel', opts, unsicher, quelle, notiz, an }
// „edit“: der neue Wert lässt sich im Fenster ändern, fn bekommt dann den (geänderten) Wert
function flcAenderungen(e, R) {
  const L = [], F = R.F, w = k => (F[k] ? F[k].text : '');
  const add = (k, bereich, titel, alt, neu, fn, o = {}) => { if (!strV(neu) || strV(alt) === strV(neu)) return; const f = F[k] || {};
    L.push({ bereich, titel, alt: strV(alt), neu: strV(neu), fn, edit: o.edit || '', opts: o.opts || null, unsicher: !!(f.unsicher || o.unsicher), quelle: f.quelle || o.quelle || '', notiz: f.notiz || '', an: !strV(alt) && !(f.unsicher || o.unsicher) }); };
  const S = 'Steckbrief', T = { edit: 'text' };
  add('name', S, 'Name', e.name, w('name'), v => { e.name = v; }, T);
  add('kurz', S, 'Kurzname', e.kurz, w('kurz'), v => { e.kurz = v; }, T);
  const art = FL_ARTEN.find(a => norm(a) === norm(w('art'))); add('art', S, 'Art', e.art, art || '', v => { e.art = v; }, { edit: 'sel', opts: FL_ARTEN });
  const zw = flcZweckeListe().filter(k => strL(w('zw')).some(t => norm(t) === norm(k))), zNeu = [w('frei'), ...zw].filter(Boolean).join(', ');
  add('frei', S, 'Förderzweck', e.schwer, zNeu, v => { e.schwer = v; }, { edit: 'text', unsicher: !!(F.zw && F.zw.unsicher), quelle: (F.zw || {}).quelle });
  add('gl', S, 'Fördergebiet', e.gl.join(', '), strL(w('gl')).join(', '), v => { e.gl = strL(v); }, T);
  const von = zahlOderLeer(F.von && F.von.wert), bis = zahlOderLeer(F.bis && F.bis.wert);
  if (von != null || bis != null) { const t = flHoeheKlar({ hoeheVon: von, hoeheBis: bis == null ? von : bis, hoehe: '' }); add('von', S, 'Förderhöhe', flHoeheKlar(e), t, () => { Object.assign(e, { hoeheVon: von == null ? bis : von, hoeheBis: bis == null ? von : bis, hoehe: '' }); }, { unsicher: !!(F.bis && F.bis.unsicher), quelle: (F.bis || {}).quelle }); }
  add('quote', S, 'Förderquote', e.quote, w('quote'), v => { e.quote = v; }, T);
  add('fristen', S, 'Hinweis zu Fristen', e.fristen, w('fristen'), v => { e.fristen = v; }, T);
  add('web', S, 'Homepage', e.web, flUrlVoll(w('web')), v => { e.web = flUrlVoll(v); }, T);
  add('richtlinien', S, 'Förderrichtlinien', e.richtlinien, flUrlVoll(w('richtlinien')), v => { e.richtlinien = flUrlVoll(v); }, T);
  const weg = flWegNorm(w('weg')); if (weg) add('weg', S, 'Antragsweg', e.weg.join(', '), weg, v => { e.weg = [v]; }, { edit: 'sel', opts: FL_WEGE });
  const an = weg === 'Portal' ? flUrlVoll(w('antrag')) : mailRein(w('antrag')); add('antrag', S, weg === 'Portal' ? 'Antrag an (Link)' : 'Antrag an (E-Mail)', e.antrag, an, v => { e.antrag = weg === 'Portal' ? flUrlVoll(v) : mailRein(v); }, T);
  add('anschrift', S, 'Anschrift', e.anschrift, w('anschrift'), v => { e.anschrift = v; }, T);
  for (const [k, titel, x] of [['haeufig', 'Häufigkeit', FL_BEW[2]], ['aufwand', 'Aufwand', FL_BEW[3]], ['dauer', 'Dauer', FL_BEW[4]]]) { const v = flcStufe(x, w(k)); if (v) add(k, 'Einschätzung', titel, e.bew[x.k] ? x.bed[e.bew[x.k] - 1] : '', x.bed[v - 1], t => { const i = x.bed.indexOf(t); if (i >= 0) e.bew[x.k] = i + 1; }, { edit: 'sel', opts: x.bed }); }
  if (norm(w('gross')) === 'ja' && !e.gross) add('gross', 'Einschätzung', 'Großförderer', '', '> 10.000 € möglich', () => { e.gross = true; });
  // Notizen: gefördert / nicht gefördert / so tickt der Förderer / Argumente / Stolpersteine / Weiteres – als ein Block mit fetten Zwischenüberschriften, an die vorhandenen Notizen angehängt
  const abschnitte = [['gefoerdert', 'Gefördert'], ['nicht', 'Nicht gefördert'], ['tickt', 'So tickt der Förderer'], ['zieht', 'Argumente, die ziehen'], ['stolper', 'Stolpersteine'], ['notiz', 'Weiteres']].filter(([k]) => w(k));
  if (abschnitte.length) { const nt = abschnitte.map(([k, t]) => '*' + t + ':*\n' + w(k).replace(/\r/g, '')).join('\n\n'), u = abschnitte.some(([k]) => F[k].unsicher), q = (abschnitte.map(([k]) => F[k].quelle).find(Boolean)) || '';
    if (!(e.notiz || '').includes(w(abschnitte[0][0]))) L.push({ bereich: 'Notizen', titel: 'An die Notizen anhängen', alt: e.notiz ? '(Notizen vorhanden)' : '', neu: nt, fn: v => { e.notiz = [e.notiz, v].filter(Boolean).join('\n\n'); }, edit: 'rich', unsicher: u, quelle: q, notiz: '', an: !e.notiz && !u }); }
  for (const f of R.fristen) { if (!f.d) { L.push({ bereich: 'Fristen', titel: 'Frist', alt: '', neu: '„' + f.roh + '“ ist kein Datum – wird nicht übernommen', fn: null, unsicher: true, quelle: f.quelle, an: false }); continue; }
    if (e.fristenL.some(x => x.d === f.d && x.topf === f.topf)) continue;
    L.push({ bereich: 'Fristen', titel: 'Frist' + (f.topf ? ' · ' + f.topf : ''), alt: '', neu: fristText(f.d) + (f.d.length === 5 ? ' (jedes Jahr)' : ' (einmalig)'), fn: () => { e.fristenL.push({ id: uid('fr'), d: f.d, topf: f.topf }); }, unsicher: f.unsicher, quelle: f.quelle, an: !f.unsicher }); }
  for (const t of R.topfe) { if (!t.name) continue; const x = e.topfe.find(y => norm(y.name) === norm(t.name)), B = 'Fördertöpfe';
    if (!x) L.push({ bereich: B, titel: 'Fördertopf', alt: '', neu: [t.name, t.kurz && '(' + t.kurz + ')', t.schwer, flHoeheKlar({ hoeheVon: t.von, hoeheBis: t.bis == null ? t.von : t.bis, hoehe: '' }), t.quote].filter(Boolean).join(' · '),
      fn: () => { e.topfe.push({ id: uid('t'), name: t.name, kurz: t.kurz, schwer: t.schwer, gl: t.gl, hoehe: '', hoeheVon: t.von == null ? t.bis : t.von, hoeheBis: t.bis == null ? t.von : t.bis, quote: t.quote }); }, unsicher: t.unsicher, quelle: t.quelle, an: !t.unsicher });
    else if ((!x.schwer && t.schwer) || (!x.gl.length && t.gl.length) || (!x.quote && t.quote) || (x.hoeheVon == null && x.hoeheBis == null && (t.von != null || t.bis != null)))
      L.push({ bereich: B, titel: 'Fördertopf ergänzen · ' + t.name, alt: '', neu: [!x.schwer && t.schwer, !x.gl.length && t.gl.join(', '), !x.quote && t.quote].filter(Boolean).join(' · '),
        fn: () => { if (!x.schwer) x.schwer = t.schwer; if (!x.gl.length) x.gl = t.gl; if (!x.quote) x.quote = t.quote; if (x.hoeheVon == null && x.hoeheBis == null && (t.von != null || t.bis != null)) Object.assign(x, { hoeheVon: t.von == null ? t.bis : t.von, hoeheBis: t.bis == null ? t.von : t.bis, hoehe: '' }); }, unsicher: t.unsicher, quelle: t.quelle, an: !t.unsicher }); }
  for (const k of R.kontakte) { if (!k.n) continue; const x = e.kontakte.find(y => kkey(y.n) === kkey(k.n));
    if (!x) L.push({ bereich: 'Kontakte', titel: 'Kontakt', alt: '', neu: [k.n, k.pos, k.mail, k.tel].filter(Boolean).join(' · '), fn: () => { e.kontakte.push(Object.assign(flKontaktLeer(), { n: k.n, pos: k.pos, mail: k.mail, tel: k.tel, gl: k.gl })); }, unsicher: k.unsicher, quelle: k.quelle, an: !k.unsicher });
    else if ((!x.pos && k.pos) || (!x.mail && k.mail) || (!x.tel && k.tel))
      L.push({ bereich: 'Kontakte', titel: 'Kontakt ergänzen · ' + k.n, alt: '', neu: [!x.pos && k.pos, !x.mail && k.mail, !x.tel && k.tel].filter(Boolean).join(' · '), fn: () => { if (!x.pos) x.pos = k.pos; if (!x.mail) x.mail = k.mail; if (!x.tel) x.tel = k.tel; }, unsicher: k.unsicher, quelle: k.quelle, an: !k.unsicher }); }
  const qs = R.quellen.filter(q => q.url);
  if (qs.length) { const t = 'Quellen der Recherche (' + fmtDate(today()) + '):\n' + qs.map(q => '- ' + q.url + (q.was ? ' – ' + q.was : '')).join('\n');
    L.push({ bereich: 'Notizen', titel: 'Quellen anhängen', alt: '', neu: t, fn: v => { e.notiz = [e.notiz, v].filter(Boolean).join('\n\n'); }, edit: 'rich', unsicher: false, quelle: '', an: false }); }
  L.push({ bereich: 'Sonstiges', titel: 'Recherchestand', alt: e.recherche ? fmtDate(e.recherche) : '', neu: fmtDate(today()), fn: () => { e.recherche = today(); }, unsicher: false, quelle: '', an: true });
  return L;
}
const FLC_BEREICHE = ['Steckbrief', 'Einschätzung', 'Notizen', 'Fristen', 'Fördertöpfe', 'Kontakte', 'Sonstiges'];
async function flcEinlesen() {
  if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
  const e = flCur(); if (!e) return;
  const f = await pickFile('.xlsx'); if (!f) return;
  let R = null; try { R = flcLesen(await xlsxBook(await f.arrayBuffer())); } catch (x) { console.warn(x); }
  if (!R) { modal('Keine Copilot-Vorlage erkannt', h('p', {}, 'In „' + f.name + '“ fehlt das Blatt „Steckbrief“ mit den Feldern der Vorlage. Bitte die Vorlage über ⋯ → „Vorlage für Copilot herunterladen“ holen und von Copilot ausfüllen lassen.')); return; }
  const L = flcAenderungen(e, R), cbs = L.map(x => h('input', { type: 'checkbox', class: 'flc-c', checked: x.an, disabled: !x.fn, 'aria-label': x.titel + ' übernehmen' }));
  const zaehl = h('span', { class: 'flc-zaehl' }), zeigen = () => { zaehl.textContent = cbs.filter(c => c.checked).length + ' von ' + L.filter(x => x.fn).length + ' ausgewählt'; };
  cbs.forEach(c => c.addEventListener('change', zeigen));
  const alle = (f2) => () => { L.forEach((x, i) => { if (x.fn) cbs[i].checked = f2(x); }); zeigen(); };
  const bar = h('div', { class: 'flc-bar' }, h('div', { class: 'flc-bt' }, h('b', {}, '„' + f.name + '“'), ' für ', h('b', {}, e.name || 'diesen Förderer')),
    h('div', { class: 'flc-bw' }, zaehl, h('button', { class: 'link small', onclick: alle(() => true) }, 'Alle'), h('button', { class: 'link small', onclick: alle(() => false) }, 'Keine'), h('button', { class: 'link small', onclick: alle(x => x.an) }, 'Vorauswahl')),
    h('p', { class: 'muted small flc-hint' }, 'Vorgewählt sind neue, sichere Angaben. Angaben, die etwas Vorhandenes ersetzen würden, und unsichere sind nicht angekreuzt – bitte einzeln prüfen. Texte lassen sich per Klick ändern.'));
  const anzeige = x => x.edit === 'rich' ? fmtText(x.neu) : esc(x.neu).replace(/\n/g, '<br>');
  const wert = x => {
    if (x.edit === 'sel') { const sel = h('select', { class: 'flc-sel', 'aria-label': x.titel }, ...x.opts.map(o => h('option', { selected: o === x.neu }, o))); sel.addEventListener('change', () => { x.neu = sel.value; }); return sel; }
    const box = h('div', { class: 'flc-w' + (x.edit ? ' edit' : '') + (x.edit === 'rich' ? ' fmt' : ''), html: anzeige(x) });
    if (!x.edit) return box;
    box.tabIndex = 0; box.title = 'Klicken zum Ändern'; box.setAttribute('role', 'button');
    const oeffnen = () => {
      if (box.querySelector('textarea')) return;
      const ta = h('textarea', { class: 'flc-ed', rows: 1, 'aria-label': x.titel + ' ändern' }); ta.value = x.neu; box.replaceChildren(ta); box.classList.add('offen'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      let fertig = false;
      const zu = ok => { if (fertig) return; fertig = true; const v = ta.value.trim(); if (ok && v) x.neu = v; box.classList.remove('offen'); box.innerHTML = anzeige(x); };
      ta.addEventListener('blur', () => zu(true));
      ta.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Escape') zu(false); else if (ev.key === 'Enter' && (x.edit === 'text' || ev.ctrlKey)) { ev.preventDefault(); zu(true); } });
    };
    box.addEventListener('click', ev => { if (!ev.target.closest('a')) oeffnen(); });
    box.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); oeffnen(); } });
    return box;
  };
  const zeile = (x, i) => h('div', { class: 'flc-r' + (x.unsicher ? ' unsicher' : '') + (x.fn ? '' : ' aus') },
    h('label', { class: 'flc-cb' }, cbs[i]),
    h('div', { class: 'flc-k' }, h('b', {}, x.titel), x.unsicher ? h('span', { class: 'fl-pill warn' }, 'unsicher') : null, x.alt ? h('span', { class: 'flc-alt', title: 'bisher: ' + x.alt }, 'bisher: ' + x.alt) : null),
    h('div', { class: 'flc-v' }, wert(x), (x.quelle || x.notiz) ? h('div', { class: 'flc-m' }, x.quelle ? h('a', { href: /^https?:\/\//i.test(x.quelle) ? x.quelle : null, target: '_blank', rel: 'noopener', 'data-act': 'link', title: x.quelle }, 'Quelle: ' + kurzUrl(x.quelle)) : null, x.notiz ? h('span', {}, x.notiz) : null) : null));
  const teile = FLC_BEREICHE.map(b => ({ b, L: L.map((x, i) => [x, i]).filter(([x]) => x.bereich === b) })).filter(t => t.L.length);
  const body = h('div', { class: 'flc' }, bar, ...teile.flatMap(t => [h('div', { class: 'flc-bereich' }, t.b), ...t.L.map(([x, i]) => zeile(x, i))]));
  zeigen();
  const ok = await modal('Angaben aus Copilot übernehmen?', body, [['Abbrechen', false], ['Ausgewählte übernehmen', true, 'primary']], { wide: true, cls: 'flc-modal' });
  if (!ok) return;
  let n = 0; L.forEach((x, i) => { if (cbs[i].checked && x.fn) { x.fn(x.neu); n++; } });
  if (n) { e.fristenL.sort((a, c) => a.d.localeCompare(c.d)); flZuKartei(); changed(); keep(renderNow); }
  toast(n ? n + (n === 1 ? ' Angabe' : ' Angaben') + ' übernommen – mit ↶ (Strg+Z) wieder rückgängig zu machen' : 'Nichts übernommen', n ? 'ok' : undefined);
}
function flcPromptKopieren(e) {
  const t = flcPrompt(e), fail = () => { modal('Auftrag für Copilot', h('textarea', { class: 'rech-prompt', rows: 14, spellcheck: false, value: t, readonly: true })); };
  try { navigator.clipboard.writeText(t).then(() => toast('Auftrag kopiert – in Copilot einfügen und die Vorlage anhängen', 'ok'), fail); } catch (x) { fail(); }
}
