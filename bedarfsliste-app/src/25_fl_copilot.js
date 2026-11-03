/* ===================================================================== Fördererliste: Excel-Vorlage und Auftrag für Copilot (ab 0.107, je Fördertopf ab 0.111, Töpfe mit allen Angaben ab 0.113)
   Im ⋯-Menü eines Förderers: „Mit Copilot ausfüllen …“ – ein Fenster mit Vorlage herunterladen, Auftrag kopieren (für den Förderer als Ganzes, einen vorhandenen oder einen neuen
   Fördertopf) und Ablagefeld für die ausgefüllte Excel (das Einlesen fragt, in welchen Topf).
   Die Vorlage beschreibt EINEN Förderer oder EINEN Fördertopf: Blatt „Steckbrief“ (Feld · Wert · Sicherheit · Quelle · Anmerkung), „Fristen“, „Fördertöpfe“, „Kontakte“, „Quellen“;
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
  ['von', 'Förderhöhe von (€)', 'Nur eine Zahl, ohne Einheit (z. B. 1000). Nur, wenn ein Mindestbetrag genannt ist; sonst leer.'],
  ['bis', 'Förderhöhe bis (€)', 'Nur eine Zahl, ohne Einheit (z. B. 10000). Höchster Betrag laut Richtlinie oder Förderhistorie. Gibt es nur einen Betrag, steht er nur hier (nicht zusätzlich bei „von“).'],
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
// Blatt „Fördertöpfe“ (nur Förderer-Vorlage): eine Zeile je Fördertopf mit ALLEN Angaben des Topfs (Spalte 0–8 wie bisher, danach die weiteren)
const FLC_TSP = [['Fördertopf (voller Name)', 30], ['Kurzname', 18], ['Förderzweck', 34], ['Fördergebiet (Gliederungen)', 28], ['Förderhöhe von (€)', 14], ['Förderhöhe bis (€)', 14], ['Förderquote', 28], ['Sicherheit', 14], ['Quelle (Link)', 40],
  ['Programmseite (Link)', 34], ['Förderrichtlinien (Link)', 34], ['Hinweis zu Fristen', 30], ['Antragsweg', 16], ['Antrag an (E-Mail oder Link)', 30], ['Häufigkeit', 18], ['Aufwand', 16], ['Dauer bis zur Entscheidung', 18], ['Großförderer (ja/nein)', 14],
  ['Was wird gefördert?', 44], ['Was wird nicht gefördert?', 44], ['Wie tickt das Programm? (2–3 Sätze)', 44], ['Förderargumentation: Argumente, die ziehen', 44], ['Förderargumentation: Stolpersteine', 44], ['Weitere Notizen', 40]];
const FLC_ABSCHNITTE = [['gefoerdert', 'Gefördert'], ['nicht', 'Nicht gefördert'], ['tickt', 'So tickt der Förderer'], ['zieht', 'Argumente, die ziehen'], ['stolper', 'Stolpersteine'], ['notiz', 'Weiteres']];
const flcNotizText = get => FLC_ABSCHNITTE.filter(([k]) => get(k)).map(([k, t]) => '*' + t + ':*\n' + get(k).replace(/\r/g, '')).join('\n\n');
const flcZweckeListe = () => MHD_ZWECKE.map(z => z.k);

// ---------- Vorlage
// z = { modus: 'foerderer' | 'topf', topf: vorhandener Fördertopf | null, name: Name des Topfs } – ohne z: Förderer als Ganzes
function flcVorlageBlob(e, z) {
  e = e || null; z = z || { modus: 'foerderer', topf: null, name: '' };
  const topf = z.modus === 'topf', FELDER = FLC_FELDER.filter(f => !(topf && f[0] === 'art')).map(f => f[0] === 'name' ? [f[0], topf ? 'Name des Fördertopfs (voller Name)' : f[1], topf ? 'Offizieller Name des Förderprogramms (Fördertopfs), wie auf der Homepage des Förderers.' : f[2]] : f);
  const kopf = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, zl = { border: 'thin', v: 'top', wrap: true }, leer = { border: 'thin', v: 'top', wrap: true, fill: '#FFFBE6' }, grau = { border: 'thin', v: 'top', wrap: true, color: '#6B6B6B' };
  const wert0 = topf ? { name: z.name, kurz: z.topf && z.topf.kurz } : { name: e && e.name, kurz: e && e.kurz, art: e && e.art, web: e && e.web };
  const bl = (name, cols, kopfZ, n, extra = {}) => ({ name, cols, freeze: 'A2', heights: { 0: 30 }, rows: [kopfZ.map(v => ({ v, st: kopf })), ...Array.from({ length: n }, () => cols.map(() => ({ v: '', st: leer })))], ...extra });
  const L = (sp, n, items) => ({ ref: `${sp}2:${sp}${n + 1}`, items });
  const steck = { name: 'Steckbrief', cols: [44, 44, 62, 14, 40, 40], freeze: 'A2', heights: { 0: 30 },
    rows: [['Feld', 'Wert', 'Format / Erklärung', 'Sicherheit', 'Quelle (Link)', 'Anmerkung'].map(v => ({ v, st: kopf })),
      ...FELDER.map(([k, f, erkl]) => [{ v: f, st: { border: 'thin', v: 'top', wrap: true, b: true } }, { v: wert0[k] || '', st: leer }, { v: erkl, st: grau }, { v: '', st: leer }, { v: '', st: leer }, { v: '', st: leer }])],
    lists: [...FELDER.map(([k, , , li], i) => li ? { ref: `B${i + 2}:B${i + 2}`, items: li() } : null).filter(Boolean), L('D', FELDER.length, FLC_SICHER)] };
  const fristen = topf ? bl('Fristen', [18, 14, 14, 40], ['Frist (TT.MM.JJJJ)', 'Jedes Jahr (ja/nein)', 'Sicherheit', 'Quelle (Link)'], 25, { lists: [L('B', 25, ['ja', 'nein']), L('C', 25, FLC_SICHER)] })
    : bl('Fristen', [18, 14, 34, 14, 40], ['Frist (TT.MM.JJJJ)', 'Jedes Jahr (ja/nein)', 'Fördertopf (leer = allgemein)', 'Sicherheit', 'Quelle (Link)'], 25, { lists: [L('B', 25, ['ja', 'nein']), L('D', 25, FLC_SICHER)] });
  const toepfe = bl('Fördertöpfe', FLC_TSP.map(c => c[1]), FLC_TSP.map(c => c[0]), 12,
    { heights: { 0: 44 }, lists: [L('H', 12, FLC_SICHER), L('M', 12, FL_WEGE), L('O', 12, FLC_HAEUFIG), L('P', 12, FLC_AUFWAND), L('Q', 12, FLC_DAUER), L('R', 12, ['ja', 'nein'])] });
  const beispiele = topf ? bl('Beispiele', [24, 60, 30, 10, 14, 14, 40], ['Schlagwort (1–3 Wörter)', 'Beschreibung (ein Satz)', 'Empfänger / Ort', 'Jahr', 'Betrag (€)', 'Sicherheit', 'Quelle (Link)'], 10, { lists: [L('F', 10, FLC_SICHER)] })
    : bl('Beispiele', [30, 24, 60, 30, 10, 14, 14, 40], ['Fördertopf (leer = Förderer allgemein)', 'Schlagwort (1–3 Wörter)', 'Beschreibung (ein Satz)', 'Empfänger / Ort', 'Jahr', 'Betrag (€)', 'Sicherheit', 'Quelle (Link)'], 10, { lists: [L('G', 10, FLC_SICHER)] });
  const kontakte = bl('Kontakte', [28, 28, 32, 22, 26, 16, 14, 40], ['Name', 'Position', 'E-Mail', 'Telefon', 'Gliederungen (leer = alle)', 'Anschreiben (leer lassen)', 'Sicherheit', 'Quelle (Link)'], 15,
    { lists: [L('G', 15, FLC_SICHER)] });
  const quellen = bl('Quellen', [60, 60, 16], ['Link (wirklich geöffnet)', 'Was dort steht', 'Abgerufen am (TT.MM.JJJJ)'], 25);
  const spalten = [...(topf ? [] : [['Art', FL_ARTEN]]), ['Antragsweg', FL_WEGE], ['Häufigkeit', FLC_HAEUFIG], ['Aufwand', FLC_AUFWAND], ['Dauer', FLC_DAUER], ['Zwecke der Malteser', flcZweckeListe()], ['Gliederungen der Malteser', GL_LIST]];
  const auswahl = { name: 'Auswahlwerte', cols: spalten.map(() => 32), freeze: 'A2', heights: { 0: 30 },
    rows: [spalten.map(([t]) => ({ v: t, st: kopf })), ...Array.from({ length: Math.max(...spalten.map(s => s[1].length)) }, (_, i) => spalten.map(([, li]) => ({ v: li[i] || '', st: zl })))] };
  const wer = topf ? 'einen Fördertopf (ein Förderprogramm)' + (e && e.name ? ' des Förderers „' + e.name + '“' : '') : 'einen Förderer';
  const text = [
    [topf ? 'Fördertopf-Vorlage für Copilot' : 'Förderer-Vorlage für Copilot', { b: true, sz: 15 }],
    ['Diese Datei beschreibt ' + wer + ' der Malteser (Diözese Paderborn). Sie wird recherchiert und ausgefüllt und danach in die Bedarfsliste eingelesen (Fördererliste → Seite des Förderers → ⋯ → „Mit Copilot ausfüllen …“).'],
    [''],
    ['Regeln für das Ausfüllen', { b: true }],
    ['1. Nur die gelb hinterlegten Zellen ausfüllen: im Blatt „Steckbrief“ die Spalten „Wert“, „Sicherheit“, „Quelle“ und „Anmerkung“, in ' + (topf ? '„Fristen“, „Beispiele“, „Kontakte“ und „Quellen“' : '„Fristen“, „Fördertöpfe“, „Beispiele“, „Kontakte“ und „Quellen“') + ' die Zeilen darunter. Keine Blätter, Spalten oder Überschriften ändern, umbenennen, löschen oder hinzufügen. „Anleitung“ und „Auswahlwerte“ nicht ändern.'],
    ['2. Nichts raten und nichts erfinden: Was nicht belegt ist, bleibt leer. Jede ausgefüllte Angabe bekommt in „Quelle“ einen Link, den Sie wirklich geöffnet haben (bevorzugt Seiten des Förderers: Satzung, Förderrichtlinien, Antragsformular, Jahresbericht).'],
    ['3. Spalte „Sicherheit“: „sicher“ = steht so in der Quelle; „unsicher“ = nur indirekt belegt, älter als zwei Jahre oder widersprüchlich. Unsichere Angaben übernimmt das Programm nicht automatisch.'],
    ['4. Auswahlfelder nur mit den vorgegebenen Werten füllen (Blatt „Auswahlwerte“). Zahlen ohne Einheit und ohne Tausenderpunkt (z. B. 10000). Datum als TT.MM.JJJJ; eine Frist ohne Jahr (z. B. 31.03.) gilt jedes Jahr.'],
    ['5. Kontakte: nur Personen oder Funktionen, deren Kontaktdaten der Förderer selbst öffentlich nennt (Impressum, Seite „Ansprechpartner“). Keine privaten Daten, nichts aus sozialen Netzwerken. „Anschreiben“ leer lassen – das entscheiden wir.'],
    [topf ? '6. Alle Angaben im Blatt „Steckbrief“ beziehen sich nur auf diesen einen Fördertopf, nicht auf den Förderer insgesamt; auch Notizen und Förderargumentation. Fristen im Blatt „Fristen“ sind die Fristen dieses Topfs.'
      : '6. Hat der Förderer mehrere Förderprogramme (Fördertöpfe), steht jedes in einer eigenen Zeile im Blatt „Fördertöpfe“ – mit ALLEN Spalten ausgefüllt, soweit belegbar. Ein Fördertopf, der nur mit Namen eingetragen ist, ist unbrauchbar. Im Blatt „Steckbrief“ steht dann nur, was für den ganzen Förderer gilt (Name, Art, Homepage, Anschrift, allgemeine Haltung); alles Programmbezogene steht in der Zeile des Programms. Fristen und Beispiele eines Programms mit seinem Namen in „Fördertopf“.'],
    ['7. Zu jeder Einschätzung (Häufigkeit, Aufwand, Dauer) kurz in „Anmerkung“ begründen – oder leer lassen.'],
    ['8. Keine Wiederholungen: Jede Information steht genau einmal, im passendsten Feld. Was schon in einem eigenen Feld steht (z. B. Förderzweck, Gebiet, Höhe, Fristen, Antragsweg), nicht noch einmal in den Notiz-Feldern aufnehmen – auch nicht umformuliert.'],
    ['9. Notizen knapp: nur kurze Stichpunkte (je höchstens etwa 10 Wörter, höchstens 4 je Feld); „Wie tickt …“ in höchstens zwei kurzen Sätzen. Beispiele geförderter Projekte nicht in die Notizen, sondern ins Blatt „Beispiele“ (Schlagwort aus 1–3 Wörtern, ein Satz Beschreibung).'],
    [''],
    ['Stand: ' + (typeof today === 'function' ? fmtDate(today()) : '')],
    ...(e && e.id ? [['Förderer-ID: ' + e.id + ' (nicht ändern – damit ordnet die Bedarfsliste die Datei zu)', { color: '#6B6B6B' }]] : []),
  ];
  const anl = { name: 'Anleitung', cols: [130], grid: false, rows: text.map(([t, st]) => [{ v: t, st: Object.assign({ wrap: true, v: 'top' }, st || {}) }]) };
  if (!topf && e && e.topfe && e.topfe.length) e.topfe.slice(0, 12).forEach((t, i) => { toepfe.rows[i + 1][0] = { v: t.name, st: leer }; toepfe.rows[i + 1][1] = { v: t.kurz || '', st: leer }; });   // vorhandene Töpfe vorbelegen
  return xlsxBlob([anl, steck, fristen, ...(topf ? [] : [toepfe]), beispiele, kontakte, quellen, auswahl]);
}

// ---------- Auftrag für Copilot
function flcPrompt(e, z) {
  z = z || { modus: 'foerderer', topf: null, name: '' };
  if (z.modus !== 'topf') return flcAuftrag([e || {}], z.variante || flcVariante(e), () => FLC_DATEI);   // Förderer allgemein: Variante A/B (27_fl_auftrag.js)
  const topf = z.modus === 'topf', fn = e && e.name ? '„' + e.name + '“' : '[NAME DES FÖRDERERS]';
  const ziel = topf ? 'den Fördertopf (das Förderprogramm) ' + (z.name ? '„' + z.name + '“' : '[NAME DES FÖRDERTOPFS]') + ' des Förderers ' + fn : 'den Förderer ' + fn;
  const L = [
    'Du bist Rechercheassistent im Fundraising der Malteser (Malteser Hilfsdienst e. V., Diözese Paderborn). Im Anhang liegt die Excel-Datei „' + FLC_DATEI + '“. Recherchiere im Web ' + ziel + (e && e.web && !topf ? ' (Homepage: ' + e.web + ')' : '') + ' und fülle die Datei aus. Ich lese sie danach in unser Programm ein.',
    ...(topf ? ['Wichtig: Die Datei gilt nur für diesen einen Fördertopf. Alle Angaben im Blatt „Steckbrief“ – auch Zweck, Gebiet, Förderhöhe, Quote, Fristen, Antragsweg, Links, Einschätzung und Notizen – beziehen sich ausschließlich auf dieses Programm, nicht auf den Förderer insgesamt. Andere Programme des Förderers ignorierst du.'] : []),
    '',
    'So gehst du vor:',
    '1. Lies zuerst das Blatt „Anleitung“ und die Spalte „Format / Erklärung“ im Blatt „Steckbrief“ – dort steht, was in jede Zelle gehört.',
    topf ? '2. Recherchiere vor allem auf den eigenen Seiten des Förderers zu diesem Programm: Förderrichtlinie oder Programmbeschreibung, Antragsformular oder Antragsportal, Ausschreibung und Fristen, Jahresbericht, Seite „Ansprechpartner“ oder Impressum.'
      : '2. Recherchiere vor allem auf den eigenen Seiten des Förderers: Satzung, Förderrichtlinien oder Vergaberichtlinien, Antragsformular, Jahresbericht, Seite „Ansprechpartner“ oder Impressum. Prüfe ZUERST, ob es mehrere Förderprogramme (Fördertöpfe) gibt, und richte dich danach:\n   a) Kein oder nur ein Programm: Fülle das Blatt „Steckbrief“ vollständig aus; das Blatt „Fördertöpfe“ bleibt leer.\n   b) Mehrere Programme: Recherchiere JEDES Programm eigens auf seiner Programmseite bzw. in seiner Richtlinie und trage es in einer eigenen Zeile im Blatt „Fördertöpfe“ mit allen Spalten ein (Zweck, Gebiet, Höhe, Quote, Hinweis zu Fristen, Antragsweg, Links, Häufigkeit, Aufwand, Dauer, Großförderer und die Notiz-Spalten). Ein Programm nur mit Namen ist unbrauchbar – zu jedem Programm brauche ich dieselbe Tiefe. Im Blatt „Steckbrief“ trägst du dann NUR ein, was für den ganzen Förderer gilt: Name, Kurzname, Art, Homepage, Anschrift und – falls es übergreifend gilt – „Wie tickt der Förderer?“. Alles, was zu einem Programm gehört (Zweck, Gebiet, Höhe, Quote, Fristen, Antragsweg, Einschätzung, gefördert / nicht gefördert, Argumente, Stolpersteine, Beispiele), steht in der Zeile bzw. mit dem Namen dieses Programms – nicht im Steckbrief.',
    '3. Fülle nur die gelb hinterlegten Zellen: im Blatt „Steckbrief“ die Spalten Wert, Sicherheit, Quelle und Anmerkung; in ' + (topf ? '„Fristen“, „Beispiele“, „Kontakte“ und „Quellen“' : '„Fristen“, „Fördertöpfe“, „Beispiele“, „Kontakte“ und „Quellen“') + ' die Zeilen darunter. Ändere keine Überschriften, Blattnamen oder Spalten, füge nichts hinzu und lösche nichts. „Anleitung“ und „Auswahlwerte“ bleiben unverändert.',
    '4. Erfinde nichts und rate nicht. Was du nicht belegen kannst, bleibt leer. Trage bei jeder ausgefüllten Angabe in „Quelle“ den Link ein, den du tatsächlich geöffnet hast – keine Links aus dem Gedächtnis. Setze „Sicherheit“ auf „sicher“, wenn die Angabe so in der Quelle steht, sonst auf „unsicher“ (indirekt belegt, älter als zwei Jahre oder widersprüchlich).',
    '5. Formate: Auswahlfelder nur mit den Werten aus dem Blatt „Auswahlwerte“ (genau so geschrieben). Beträge als reine Zahl ohne Einheit und ohne Tausenderpunkt (10000). Datum als TT.MM.JJJJ; eine Frist ohne Jahr (31.03.) gilt jedes Jahr, bei einmaligen Fristen „Jedes Jahr“ = nein.',
    '6. Förderzweck: kurze Stichworte in eigenen Worten. Bei „Zwecke der Malteser“ nur die Zwecke aus der Liste wählen, die zum Förderzweck passen; Zwecke ohne Bezug zu den Maltesern (z. B. Kultur, Sport, Tierschutz) lässt du weg. Passt ' + (topf ? 'das Programm' : 'der Förderer') + ' nach seiner Satzung bzw. Richtlinie gar nicht zu den Maltesern, schreib das in „Weitere Notizen“.',
    '7. Fördergebiet: Nenne die Gliederungen aus „Auswahlwerte“, in deren Gebiet ' + (topf ? 'das Programm' : 'der Förderer') + ' fördert (z. B. Stadt Dortmund → Dortmund). Gilt es für das ganze Erzbistum Paderborn, NRW oder bundesweit, schreib „alle“.',
    '8. Förderhöhe: nur Beträge, die in einer Quelle stehen (Richtlinie oder veröffentlichte Förderungen). Förderquote und Eigenanteil als Freitext wie in der Richtlinie. „Großförderer“ = ja nur, wenn laut Quelle Förderungen über 10.000 € möglich sind.',
    '9. Fristen: jeden festen Antragstermin einzeln ins Blatt „Fristen“' + (topf ? ' (alle gehören zu diesem Fördertopf)' : ' (bei Fördertöpfen mit dem Namen des Topfs)') + '. Gibt es keine festen Termine, schreib den Hinweis (z. B. „laufend“) in „Hinweis zu Fristen“ im Blatt „Steckbrief“.',
    '10. Kontakte: nur Personen oder Funktionen, deren Kontaktdaten der Förderer selbst öffentlich nennt. Keine privaten Daten, nichts aus sozialen Netzwerken, keine Vermutungen zu E-Mail-Adressen. Die Spalte „Anschreiben“ bleibt leer.',
    '11. Häufigkeit, Aufwand und Dauer nur ausfüllen, wenn du es aus den Richtlinien ableiten kannst, und in „Anmerkung“ kurz begründen.',
    '12. Notizen (diese Felder landen später in den Notizen ' + (topf ? 'dieses Fördertopfs' : 'des Förderers bzw. des jeweiligen Fördertopfs') + '): KURZ UND KNAPP. Nur Stichpunkte, jeder in einer neuen Zeile mit „- “ am Anfang, je Stichpunkt höchstens etwa 10 Wörter, höchstens 4 Stichpunkte je Feld – lieber das Wichtigste als alles. „Was wird gefördert?“ und „Was wird nicht gefördert?“: nur Belegtes aus Satzung und Richtlinien. „Wie tickt …“: höchstens zwei kurze Sätze (was ist ' + (topf ? 'dem Programm' : 'dem Förderer') + ' wichtig, wen fördert ' + (topf ? 'es' : 'er') + ' typischerweise). „Argumente, die ziehen“: nach Gewicht sortiert, Fundstelle ganz kurz in Klammern (z. B. „(Satzung)“). „Stolpersteine“: Ausschlüsse, Eigenanteil, Nachweispflichten u. Ä. Eigene Einschätzungen kennzeichnest du mit „Einschätzung:“. Keine Projektbeispiele, keine Zahlenreihen und keine Statistik in den Notizen.',
    '13. Beispiele: Trage im Blatt „Beispiele“ bis zu 8 Projekte ein, die ' + (topf ? 'das Programm' : 'der Förderer') + ' nachweislich gefördert hat – bevorzugt solche, die einem Vorhaben der Malteser ähneln (Hilfsorganisationen, Ehrenamt, Sanitäts- und Rettungsdienst, Soziales, Hospiz). Je Zeile: Schlagwort aus 1–3 Wörtern (z. B. „Erste-Hilfe-Kurse“), Beschreibung in einem Satz (was wurde gefördert), Empfänger / Ort, Jahr, Betrag (nur wenn genannt)' + (topf ? '' : ', bei mehreren Programmen der Name des Programms in „Fördertopf“') + ' und die Quelle.',
    '14. Alle geöffneten Seiten trägst du zusätzlich im Blatt „Quellen“ ein (Link, was dort steht, Abrufdatum).',
    '15. Keine Wiederholungen: Jede Information steht genau einmal, im passendsten Feld. Was schon in einem eigenen Feld steht (Förderzweck, Gebiet, Förderhöhe, Quote, Fristen, Antragsweg, Links, Anschrift, Häufigkeit, Aufwand, Dauer), wiederholst du NICHT in den Notiz-Feldern („Was wird gefördert?“, „Wie tickt …“, Argumente, Stolpersteine, Weitere Notizen) – auch nicht umformuliert. „Was wird gefördert?“ nennt nur, was über die Stichworte im Förderzweck hinausgeht (Anschaffungen, Kostenarten, Zielgruppen); konkrete geförderte Projekte stehen nur im Blatt „Beispiele“. Auch die Notiz-Felder wiederholen sich nicht gegenseitig: ein Punkt steht entweder bei „Argumente“ oder bei „Stolpersteine“ oder in „Weitere Notizen“.',
    ...(topf ? [] : ['16. Fördertöpfe: Was für alle Programme gleich gilt (z. B. Anschrift, Antragsweg, allgemeine Haltung des Förderers), steht einmal im Blatt „Steckbrief“ – unser Programm übernimmt es beim Einlesen in jeden Topf, der dazu nichts Eigenes hat. In den Zeilen der Fördertöpfe steht, was für das jeweilige Programm gilt (Zweck, Gebiet, Höhe, Fristen usw. immer). Die Notiz-Spalten eines Topfs wiederholen nichts, was schon im Steckbrief oder in einer anderen Spalte steht.']),
    '',
    'Gib mir die ausgefüllte Datei als Excel-Datei zum Herunterladen zurück (gleicher Dateiname mit dem Zusatz „_ausgefüllt“). Schreibe darunter in höchstens fünf Sätzen, was du nicht gefunden hast und wo du unsicher bist. Wenn du keine Datei erzeugen kannst, gib den Inhalt jedes Blatts als Tabelle mit denselben Überschriften aus, damit ich ihn einfügen kann.',
  ];
  return L.join('\n');
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
  const F = {}; let n = 0, modus = 'foerderer';
  for (const r of st.rows.slice(1)) { const lab = norm(cellStr(r[0])), k = (flcSchluessel.find(([, re]) => re.test(lab)) || [])[0]; if (!k) continue; n++;
    if (/^name des f(ö|oe)rdertopf/.test(lab)) modus = 'topf';
    F[k] = { wert: r[1], text: cellStr(r[1]), unsicher: norm(r[3]) === 'unsicher', quelle: cellStr(r[4]), notiz: cellStr(r[5]) }; }
  if (!n) return null;
  const tab = (name, k0) => { const s = blatt(name); return s ? s.rows.slice(1).filter(r => r && cellStr(r[k0 || 0])) : []; };
  const fs = blatt('Fristen'), mitTopf = !!fs && /^f(ö|oe)rdertopf/.test(norm(cellStr((fs.rows[0] || [])[2]))), sx = mitTopf ? 3 : 2;       // im Fördertopf-Blatt fehlt die Spalte „Fördertopf“
  const anl = blatt('Anleitung'), fid = anl ? ((anl.rows.map(r => cellStr((r || [])[0])).join('\n').match(/F(ö|oe)rderer-ID:\s*(F\d+)/) || [])[2] || '') : '';
  return { modus, F, fid,
    fristen: tab('Fristen').map(r => ({ d: flcFristDatum(r[0], norm(r[1])), topf: mitTopf ? strV(r[2]) : '', unsicher: norm(r[sx]) === 'unsicher', quelle: cellStr(r[sx + 1]), roh: cellStr(r[0]) })),
    topfe: tab('Fördertöpfe').map(r => ({ name: strV(r[0]), kurz: strV(r[1]), schwer: strV(r[2]), gl: strL(r[3]), von: zahlOderLeer(r[4]), bis: zahlOderLeer(r[5]), quote: strV(r[6]), unsicher: norm(r[7]) === 'unsicher', quelle: cellStr(r[8]),
      web: strV(r[9]), richtlinien: strV(r[10]), fristen: strV(r[11]), weg: strV(r[12]), antrag: strV(r[13]), haeufig: strV(r[14]), aufwand: strV(r[15]), dauer: strV(r[16]), gross: strV(r[17]),
      gefoerdert: strV(r[18]), nicht: strV(r[19]), tickt: strV(r[20]), zieht: strV(r[21]), stolper: strV(r[22]), notiz: strV(r[23]) })),
    kontakte: tab('Kontakte').map(r => ({ n: strV(r[0]), pos: strV(r[1]), mail: mailRein(r[2]), tel: cellStr(r[3]), gl: strL(r[4]), unsicher: norm(r[6]) === 'unsicher', quelle: cellStr(r[7]) })),
    quellen: tab('Quellen').map(r => ({ url: cellStr(r[0]), was: cellStr(r[1]), am: cellStr(r[2]) })),
    beispiele: (() => { const s = blatt('Beispiele'); if (!s) return []; const mt = /^f(ö|oe)rdertopf/.test(norm(cellStr((s.rows[0] || [])[0]))), o = mt ? 1 : 0;   // in der Fördertopf-Vorlage ohne Spalte „Fördertopf“
      return s.rows.slice(1).filter(r => r && (cellStr(r[o]) || cellStr(r[o + 1]))).map(r => ({ topf: mt ? strV(r[0]) : '', titel: strV(r[o]), text: strV(r[o + 1]), ort: strV(r[o + 2]), jahr: cellStr(r[o + 3]), betrag: zahlOderLeer(r[o + 4]), unsicher: norm(r[o + 5]) === 'unsicher', quelle: cellStr(r[o + 6]) })); })() };
}
// Förderhöhe aus der Recherche: ein einzelner Betrag oder zweimal derselbe gilt als Obergrenze („bis …“), „von“ nur bei einer echten Spanne
const flcHoehe = (von, bis) => { const hi = bis != null ? bis : von, lo = von != null && bis != null && von < bis ? von : null; return { hoeheVon: lo, hoeheBis: hi }; };
// Angaben der Fördertopf-Zeile t, die dem Fördertopf x noch fehlen (vorhandene Angaben bleiben):
// [{ lab, key (Feld des Topfs), bereich, neu (Text), fn(wert), edit, opts }]
function flcTopfFelder(x, t) {
  const D = [], S = 'Steckbrief', E = 'Einschätzung', T = 'text';
  const f = (lab, key, bereich, wenn, text, fn, edit, opts) => { if (wenn) D.push({ lab, key, bereich, neu: strV(text), fn, edit: edit || '', opts: opts || null }); };
  f('Kurzname', 'kurz', S, t.kurz && !x.kurz, t.kurz, v => { x.kurz = v; }, T);
  f('Förderzweck', 'schwer', S, t.schwer && !x.schwer, t.schwer, v => { x.schwer = v; }, T);
  f('Fördergebiet', 'gl', S, t.gl.length && !x.gl.length, t.gl.join(', '), v => { x.gl = strL(v); }, T);
  const H = flcHoehe(t.von, t.bis);
  f('Förderhöhe', 'hoehe', S, (t.von != null || t.bis != null) && x.hoeheVon == null && x.hoeheBis == null && !x.hoehe, flHoeheKlar(Object.assign({ hoehe: '' }, H)),
    () => { Object.assign(x, H, { hoehe: '' }); x.bew.summe = 0; });
  f('Förderquote', 'quote', S, t.quote && !x.quote, t.quote, v => { x.quote = v; }, T);
  f('Hinweis zu Fristen', 'fristen', S, t.fristen && !x.fristen, t.fristen, v => { x.fristen = v; }, T);
  const weg = flWegNorm(t.weg), an = weg === 'Portal' ? flUrlVoll(t.antrag) : mailRein(t.antrag);
  f('Antragsweg', 'weg', S, weg && !x.weg.length, weg, v => { x.weg = [v]; }, 'sel', FL_WEGE);
  f(weg === 'Portal' ? 'Antrag an (Link)' : 'Antrag an (E-Mail)', 'antrag', S, an && !x.antrag, an, v => { x.antrag = weg === 'Portal' ? flUrlVoll(v) : mailRein(v); }, T);
  f('Programmseite', 'web', S, t.web && !x.web, flUrlVoll(t.web), v => { x.web = flUrlVoll(v); }, T);
  f('Förderrichtlinien', 'richtlinien', S, t.richtlinien && !x.richtlinien, flUrlVoll(t.richtlinien), v => { x.richtlinien = flUrlVoll(v); }, T);
  for (const [k, titel, b] of [['haeufig', 'Häufigkeit', FL_BEW[2]], ['aufwand', 'Aufwand', FL_BEW[3]], ['dauer', 'Dauer', FL_BEW[4]]]) { const v = flcStufe(b, t[k]); f(titel, 'bew.' + b.k, E, v && !x.bew[b.k], v ? b.bed[v - 1] : '', tt => { const i = b.bed.indexOf(tt); if (i >= 0) x.bew[b.k] = i + 1; }, 'sel', b.bed); }
  f('Großförderer', 'gross', E, norm(t.gross) === 'ja' && !x.gross, '> 10.000 € möglich', () => { x.gross = true; });
  const nt = flcNotizText(k => t[k]); f('Notizen', 'notiz', 'Notizen', nt && !x.notiz, nt, v => { x.notiz = v; }, 'rich');
  return D;
}
// Angaben als Liste von Änderungen für den Träger h (ein Fördertopf oder der Förderer selbst):
// { bereich, titel, alt, neu, fn(wert), edit: '' | 'text' | 'rich' | 'sel', opts, unsicher, quelle, notiz, an }; „edit“: der neue Wert lässt sich im Fenster ändern
function flcAenderungen(e, R, h) {
  const L = [], F = R.F, w = k => (F[k] ? F[k].text : ''), istTopf = h !== e, tModus = R.modus === 'topf';
  const erbenAlle = h === e && !e.topfe.length, key = n => 't:' + norm(n), hKey = istTopf ? key(h.name) : '';
  const bekannt = new Set([...R.topfe.filter(t => t.name).map(t => key(t.name)), ...e.topfe.map(t => key(t.name)), ...(istTopf ? [hKey] : [])]);
  const ERBT = { frei: 'schwer', gl: 'gl', von: 'hoehe', quote: 'quote', fristen: 'fristen', web: 'web', richtlinien: 'richtlinien', weg: 'weg', antrag: 'antrag', anschrift: 'anschrift', haeufig: 'bew.haeufig', aufwand: 'bew.aufwand', dauer: 'bew.dauer', gross: 'gross' };   // Feld, das ein neuer Fördertopf davon erben kann
  const add = (k, bereich, titel, alt, neu, fn, o = {}) => { if (!strV(neu) || strV(alt) === strV(neu)) return; const f = F[k] || {};
    L.push({ bereich, titel, alt: strV(alt), neu: strV(neu), fn, edit: o.edit || '', opts: o.opts || null, unsicher: !!(f.unsicher || o.unsicher), quelle: f.quelle || o.quelle || '', notiz: f.notiz || '', an: !strV(alt) && !(f.unsicher || o.unsicher), erbt: ERBT[k] || '' }); };
  const S = 'Steckbrief', T = { edit: 'text' }, bez = istTopf ? 'Fördertopf' : 'Förderer';
  if (tModus && istTopf) { add('name', S, 'Name des Fördertopfs', h.name, w('name'), v => { h.name = v; }, T); add('kurz', S, 'Kurzname des Fördertopfs', h.kurz, w('kurz'), v => { h.kurz = v; }, T); }
  else if (!tModus) { add('name', S, 'Name des Förderers', e.name, w('name'), v => { e.name = v; }, T); add('kurz', S, 'Kurzname', e.kurz, w('kurz'), v => { e.kurz = v; }, T); }
  const art = FL_ARTEN.find(a => norm(a) === norm(w('art'))); add('art', S, 'Art (des Förderers)', e.art, art || '', v => { e.art = v; }, { edit: 'sel', opts: FL_ARTEN });
  const zw = flcZweckeListe().filter(k => strL(w('zw')).some(t => norm(t) === norm(k))), zNeu = [w('frei'), ...zw].filter(Boolean).join(', ');
  add('frei', S, 'Förderzweck', h.schwer, zNeu, v => { h.schwer = v; }, { edit: 'text', unsicher: !!(F.zw && F.zw.unsicher), quelle: (F.zw || {}).quelle });
  add('gl', S, 'Fördergebiet', h.gl.join(', '), strL(w('gl')).join(', '), v => { h.gl = strL(v); }, T);
  const von = zahlOderLeer(F.von && F.von.wert), bis = zahlOderLeer(F.bis && F.bis.wert);
  if (von != null || bis != null) { const H = flcHoehe(von, bis), t = flHoeheKlar(Object.assign({ hoehe: '' }, H)); add('von', S, 'Förderhöhe', flHoeheKlar(h), t, () => { Object.assign(h, H, { hoehe: '' }); h.bew.summe = 0; }, { unsicher: !!(F.bis && F.bis.unsicher), quelle: (F.bis || {}).quelle }); }
  add('quote', S, 'Förderquote', h.quote, w('quote'), v => { h.quote = v; }, T);
  add('fristen', S, 'Hinweis zu Fristen', h.fristen, w('fristen'), v => { h.fristen = v; }, T);
  add('web', S, 'Homepage', h.web, flUrlVoll(w('web')), v => { h.web = flUrlVoll(v); }, T);
  add('richtlinien', S, 'Förderrichtlinien', h.richtlinien, flUrlVoll(w('richtlinien')), v => { h.richtlinien = flUrlVoll(v); }, T);
  const weg = flWegNorm(w('weg')); if (weg) add('weg', S, 'Antragsweg', h.weg.join(', '), weg, v => { h.weg = [v]; }, { edit: 'sel', opts: FL_WEGE });
  const an = weg === 'Portal' ? flUrlVoll(w('antrag')) : mailRein(w('antrag')); add('antrag', S, weg === 'Portal' ? 'Antrag an (Link)' : 'Antrag an (E-Mail)', h.antrag, an, v => { h.antrag = weg === 'Portal' ? flUrlVoll(v) : mailRein(v); }, T);
  add('anschrift', S, 'Anschrift', h.anschrift, w('anschrift'), v => { h.anschrift = v; }, T);
  for (const [k, titel, x] of [['haeufig', 'Häufigkeit', FL_BEW[2]], ['aufwand', 'Aufwand', FL_BEW[3]], ['dauer', 'Dauer', FL_BEW[4]]]) { const v = flcStufe(x, w(k)); if (v) add(k, 'Einschätzung', titel, h.bew[x.k] ? x.bed[h.bew[x.k] - 1] : '', x.bed[v - 1], t => { const i = x.bed.indexOf(t); if (i >= 0) h.bew[x.k] = i + 1; }, { edit: 'sel', opts: x.bed }); }
  if (norm(w('gross')) === 'ja' && !h.gross) add('gross', 'Einschätzung', 'Großförderer', '', '> 10.000 € möglich', () => { h.gross = true; });
  // Notizen: gefördert / nicht gefördert / so tickt der Förderer / Argumente / Stolpersteine / Weiteres – als ein Block mit fetten Zwischenüberschriften, an die vorhandenen Notizen angehängt
  const abschnitte = FLC_ABSCHNITTE.filter(([k]) => w(k));
  if (abschnitte.length) { const nt = flcNotizText(w), u = abschnitte.some(([k]) => F[k].unsicher), q = (abschnitte.map(([k]) => F[k].quelle).find(Boolean)) || '';
    if (!(h.notiz || '').includes(w(abschnitte[0][0]))) L.push({ bereich: 'Notizen', titel: 'An die Notizen anhängen', alt: h.notiz ? '(Notizen vorhanden)' : '', neu: nt, fn: v => { h.notiz = [h.notiz, v].filter(Boolean).join('\n\n'); }, edit: 'rich', unsicher: u, quelle: q, notiz: '', an: !h.notiz && !u, erbt: 'notiz' }); }
  const tname = istTopf ? h.name : null;
  for (const f of R.fristen) { if (!f.d) { L.push({ bereich: 'Fristen', titel: 'Frist', alt: '', neu: '„' + f.roh + '“ ist kein Datum – wird nicht übernommen', fn: null, unsicher: true, quelle: f.quelle, an: false }); continue; }
    const tp = tname != null ? tname : f.topf;
    if (e.fristenL.some(x => x.d === f.d && x.topf === tp)) continue;
    L.push({ bereich: 'Fristen', titel: 'Frist' + (tp ? ' · ' + tp : ''), alt: '', neu: fristText(f.d) + (f.d.length === 5 ? ' (jedes Jahr)' : ' (einmalig)'), fn: () => { e.fristenL.push({ id: uid('fr'), d: f.d, topf: tp }); }, unsicher: f.unsicher, quelle: f.quelle, an: !f.unsicher, tab: tp && bekannt.has(key(tp)) ? key(tp) : '' }); }
  // Fördertöpfe aus dem Blatt „Fördertöpfe“: je Topf ein eigener Reiter. Neue Töpfe werden angelegt (erst ganz zuletzt) und bekommen die Angaben ihrer Zeile, vorhandene werden nur in leeren Feldern ergänzt.
  // Wurde der Förderer als Ganzes recherchiert (noch keine Töpfe), erbt JEDER neue Topf, was ihm in seiner Zeile fehlt, aus den Angaben des Förderers – nicht nur der erste.
  const NEU = {};                                                                  // neue Töpfe dieses Einlesens: Reiter → { m: Topf, kopf: „Fördertopf anlegen“ }
  for (const t of R.topfe) { if (!t.name || (istTopf && norm(t.name) === norm(h.name))) continue; const x = e.topfe.find(y => norm(y.name) === norm(t.name)), tk = key(t.name);
    if (!x) { const m = flTopfLeer(t.name), D = flcTopfFelder(m, t), nurName = !D.length && !R.beispiele.some(b => norm(b.topf) === norm(t.name));
      const kopf = { bereich: 'Fördertopf', titel: 'Fördertopf anlegen', alt: '', neu: t.name + (t.kurz ? ' (' + t.kurz + ')' : ''), tab: tk, anlegen: true, spaet: true, unsicher: t.unsicher, quelle: t.quelle,
        fn: () => { if (!nurName) m.recherche = today(); if (erbenAlle) flcErbeAlles(m, e); flTopfEinfuegen(e, m); },
        notiz: nurName ? 'Zu diesem Fördertopf hat Copilot nur den Namen geliefert – besser einzeln recherchieren lassen (⋯ → „Mit Copilot ausfüllen …“ → Fördertopf).' : '', an: !t.unsicher && !nurName };
      NEU[tk] = { m, kopf }; L.push(kopf); D.forEach(d => L.push({ bereich: d.bereich, titel: d.lab, alt: '', neu: d.neu, fn: d.fn, edit: d.edit, opts: d.opts, key: d.key, tab: tk, topfNeu: kopf, unsicher: t.unsicher, quelle: t.quelle, notiz: '', an: !t.unsicher })); }
    else flcTopfFelder(x, t).forEach(d => L.push({ bereich: d.bereich, titel: d.lab, alt: '', neu: d.neu, fn: d.fn, edit: d.edit, opts: d.opts, key: d.key, tab: tk, unsicher: t.unsicher, quelle: t.quelle, notiz: '', an: !t.unsicher })); }
  // Beispiele geförderter Projekte: zum Topf mit dem Namen in „Fördertopf“, sonst zum Ziel des Einlesens
  for (const b of R.beispiele) { const tp = tname != null ? tname : b.topf, tk = tp && bekannt.has(key(tp)) ? key(tp) : '', neu = NEU[tk];
    const ziel = neu ? neu.m : tk ? (e.topfe.find(y => key(y.name) === tk) || h) : h;
    if (ziel.beispiele.some(y => norm(y.titel) === norm(b.titel) && norm(y.text) === norm(b.text))) continue;
    const meta = [b.ort, b.jahr, b.betrag != null ? eur(b.betrag) : ''].filter(Boolean).join(' · ');
    L.push({ bereich: 'Beispiele', titel: b.titel || 'Beispiel', alt: '', neu: (b.text || '') + (meta ? '\n' + meta : ''), fn: () => { ziel.beispiele.push(flBeispielNorm(b)); }, tab: tk || (tname != null ? hKey : ''), topfNeu: neu ? neu.kopf : undefined,
      unsicher: b.unsicher, quelle: b.quelle, notiz: '', an: !b.unsicher, erbt: !tk && !istTopf ? 'beispiele' : '' }); }
  for (const k of R.kontakte) { if (!k.n) continue; const x = e.kontakte.find(y => kkey(y.n) === kkey(k.n));
    if (!x) L.push({ bereich: 'Kontakte', titel: 'Kontakt (des Förderers)', alt: '', neu: [k.n, k.pos, k.mail, k.tel].filter(Boolean).join(' · '), fn: () => { e.kontakte.push(Object.assign(flKontaktLeer(), { n: k.n, pos: k.pos, mail: k.mail, tel: k.tel, gl: k.gl })); }, unsicher: k.unsicher, quelle: k.quelle, an: !k.unsicher });
    else if ((!x.pos && k.pos) || (!x.mail && k.mail) || (!x.tel && k.tel))
      L.push({ bereich: 'Kontakte', titel: 'Kontakt ergänzen · ' + k.n, alt: '', neu: [!x.pos && k.pos, !x.mail && k.mail, !x.tel && k.tel].filter(Boolean).join(' · '), fn: () => { if (!x.pos) x.pos = k.pos; if (!x.mail) x.mail = k.mail; if (!x.tel) x.tel = k.tel; }, unsicher: k.unsicher, quelle: k.quelle, an: !k.unsicher }); }
  const qs = R.quellen.filter(q => q.url);
  if (qs.length) { const t = 'Quellen der Recherche (' + fmtDate(today()) + '):\n' + qs.map(q => '- ' + q.url + (q.was ? ' – ' + q.was : '')).join('\n');
    L.push({ bereich: 'Notizen', titel: 'Quellen anhängen', alt: '', neu: t, fn: v => { h.notiz = [h.notiz, v].filter(Boolean).join('\n\n'); }, edit: 'rich', unsicher: false, quelle: '', an: false }); }
  L.push({ bereich: 'Sonstiges', titel: 'Recherchestand (' + bez + ')', alt: h.recherche ? fmtDate(h.recherche) : '', neu: fmtDate(today()), fn: () => { h.recherche = today(); }, unsicher: false, quelle: '', an: true });
  // Reiter: Angaben zum Förderer (Name, Kontakte, Steckbrief des Förderers) oder zu einem Fördertopf; Namen der Töpfe für die Beschriftung
  const TN = {}; [...R.topfe, ...e.topfe, ...(istTopf ? [h] : [])].forEach(t => { if (t.name) TN[key(t.name)] = t.name; });
  L.forEach(x => { if (x.tab === undefined) x.tab = x.bereich === 'Kontakte' ? '' : hKey; });
  L.erbenAlle = erbenAlle; L.tabNamen = TN; L.hKey = hKey;
  L.tabReihe = [hKey, ...R.topfe.map(t => key(t.name)), ...e.topfe.map(t => key(t.name))].filter((k, i, A) => k && A.indexOf(k) === i && L.some(x => x.tab === k));      // Reiter in der Reihenfolge der Vorlage
  return L;
}
const FLC_BEREICHE = ['Fördertopf', 'Steckbrief', 'Einschätzung', 'Notizen', 'Beispiele', 'Fristen', 'Kontakte', 'Sonstiges'];
// Förderer als Ganzes recherchiert, dabei Fördertöpfe angelegt: Was beim Förderer steht, wäre danach nicht mehr zu sehen (die Seite zeigt die Töpfe).
// Deshalb bekommt jeder neue Topf: leere Felder vom Förderer, fehlende Achsen der Einschätzung, die Notizen des Förderers (angehängt) und seine Beispiele
function flcErbeAlles(m, e) {
  const notiz0 = m.notiz, bsp0 = m.beispiele.slice();
  flTopfErbt(m, e);
  FL_BEW.forEach(x => { if (!m.bew[x.k] && e.bew[x.k]) m.bew[x.k] = e.bew[x.k]; });
  if (notiz0 && e.notiz && !notiz0.includes(e.notiz)) m.notiz = notiz0 + '\n\n*Zum Förderer allgemein:*\n' + e.notiz;
  if (bsp0.length && e.beispiele.length) m.beispiele = bsp0.concat(e.beispiele.filter(b => !bsp0.some(x => norm(x.titel) === norm(b.titel))).map(b => Object.assign({}, b, { id: uid('b') })));
}
// Fördertopf einfügen: der erste übernimmt vorher die Angaben des Förderers
function flTopfEinfuegen(e, t) {
  if (!e.topfe.length) { flTopfErbt(t, e); e.fristenL.forEach(f => { if (!f.topf) f.topf = t.name; }); }
  e.topfe.push(t); e.topfMig = true; return t;
}
// Ergebnis: 'ok' (übernommen), 'skip' (übersprungen / abgebrochen), 'stop' (bei mehreren Dateien: ganz aufhören)
async function flcEinlesen(datei, e0, info) {          // e0: Förderer (sonst der geöffnete); info: { liste: [{ name, st: 'ok'|'skip'|'jetzt'|'wartet' }] } beim Einlesen mehrerer Dateien
  if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return 'skip'; }
  const e = e0 || flCur(); if (!e) return 'skip';
  const f = datei || await pickFile('.xlsx'); if (!f) return 'skip';
  let R = null; try { R = flcLesen(await xlsxBook(await f.arrayBuffer())); } catch (x) { console.warn(x); }
  if (!R) { modal('Keine Copilot-Vorlage erkannt', h('p', {}, 'In „' + f.name + '“ fehlt das Blatt „Steckbrief“ mit den Feldern der Vorlage. Bitte die Vorlage über ⋯ → „Mit Copilot ausfüllen …“ holen und von Copilot ausfüllen lassen.')); return 'skip'; }
  // Ziel: der Förderer selbst (nur ohne Fördertöpfe, Vorlage „Förderer“) oder ein vorhandener bzw. neuer Fördertopf
  const dName = strV(R.F.name && R.F.name.text), mitTopf = e.topfe.length > 0 || R.modus === 'topf';
  const optionen = [...(e.topfe.length ? [] : R.modus === 'topf' ? [] : [{ k: 'e', l: 'Förderer als Ganzes (ohne Fördertopf)' }]), ...e.topfe.map(t => ({ k: 't:' + t.id, l: t.name || '(ohne Namen)', t })), ...(mitTopf ? [{ k: 'neu', l: 'Neuer Fördertopf' + (R.modus === 'topf' && dName ? ' „' + dName + '“' : '') }] : [])];
  const passend = R.modus === 'topf' && dName ? e.topfe.find(t => norm(t.name) === norm(dName)) : null;
  let wahl = (passend ? 't:' + passend.id : R.modus === 'topf' ? 'neu' : !mitTopf ? 'e' : (flTopfWahl(e) ? 't:' + flTopfWahl(e).id : 'neu'));
  if (!optionen.some(o => o.k === wahl)) wahl = optionen[0].k;
  const neuName = h('input', { type: 'text', class: 'flc-neuname', value: R.modus === 'topf' ? dName : '', placeholder: 'Name des neuen Fördertopfs', 'aria-label': 'Name des neuen Fördertopfs' });
  let tr = null, L = [], cbs = [];
  const traeger = () => { if (wahl === 'e') return e; if (wahl === 'neu') { if (!tr || !tr._neu) { tr = flTopfLeer(strV(neuName.value) || dName || 'Neuer Fördertopf'); tr._neu = true; if (!e.topfe.length) flTopfErbt(tr, e); } tr.name = strV(neuName.value) || dName || 'Neuer Fördertopf'; return tr; } return e.topfe.find(t => 't:' + t.id === wahl) || e; };
  const zaehl = h('span', { class: 'flc-zaehl' }); let rows = [], aktiv = '';                // aktiv: Reiter – '' = Förderer, sonst der Fördertopf
  const mitTabs = R.topfe.some(t => t.name);                                       // Förderer-Vorlage mit Fördertöpfen: Angaben je Förderer/Topf in Reitern
  const tabsListe = () => [...(L.some(x => x.tab === '') ? [''] : []), ...L.tabReihe], tabsAn = () => mitTabs && tabsListe().length > 1;
  const gilt = i => cbs[i].checked && !(L[i].topfNeu && !cbs[L.indexOf(L[i].topfNeu)].checked);   // Angaben eines Topfs zählen nur, wenn „Fördertopf anlegen“ angehakt ist
  const tabBar = h('div', { class: 'flc-tabs', role: 'tablist', 'aria-label': 'Angaben je Förderer und Fördertopf' });
  const zeigen = () => {
    L.forEach((x, i) => { if (x.topfNeu) { const an = cbs[L.indexOf(x.topfNeu)].checked; cbs[i].disabled = !an; rows[i].classList.toggle('aus', !an); } });
    zaehl.textContent = L.filter((x, i) => x.fn && gilt(i)).length + ' von ' + L.filter(x => x.fn).length + ' ausgewählt';
    tabBar.querySelectorAll('.flc-tab').forEach(b => { const ids = L.map((x, i) => i).filter(i => L[i].tab === b.dataset.k && L[i].fn); b.querySelector('small').textContent = ids.filter(gilt).length + '/' + ids.length; });
  };
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
  const art = x => !x.fn ? '' : /anhängen/.test(x.titel) ? 'ergänzt' : x.alt && !/^\(/.test(x.alt) ? 'ersetzt' : 'neu';
  const ART_TIP = { neu: 'Feld ist bisher leer – wird neu eingetragen', ersetzt: 'ersetzt den bisherigen Wert (darunter durchgestrichen)', ergänzt: 'wird an die vorhandenen Notizen angehängt' };
  const zeile = (x, i) => h('div', { class: 'flc-r' + (x.unsicher ? ' unsicher' : '') + (x.fn ? '' : ' aus') },
    h('label', { class: 'flc-cb' }, cbs[i]),
    h('div', { class: 'flc-k' }, h('b', {}, x.titel), h('span', { class: 'flc-tags' }, art(x) ? h('span', { class: 'flc-tag ' + art(x), title: ART_TIP[art(x)] }, art(x)) : null,
      x.unsicher ? h('span', { class: 'flc-tag unsicher', title: FLC_UNSICHER_TIP }, 'unsicher belegt') : null),
      x.alt && art(x) === 'ersetzt' ? h('span', { class: 'flc-alt', title: 'bisher: ' + x.alt }, h('s', {}, x.alt)) : null),
    h('div', { class: 'flc-v' }, wert(x), (x.quelle || x.notiz) ? h('div', { class: 'flc-m' }, x.quelle ? h('a', { href: /^https?:\/\//i.test(x.quelle) ? x.quelle : null, target: '_blank', rel: 'noopener', 'data-act': 'link', title: x.quelle }, 'Quelle: ' + kurzUrl(x.quelle)) : null, x.notiz ? h('span', {}, x.notiz) : null) : null));
  const liste = h('div', { class: 'flc-liste' });
  const tabKopf = () => { if (!tabsAn()) return null; const anl = L.some(x => x.anlegen && x.tab === aktiv), n = L.tabNamen[aktiv] || '';
    return h('p', { class: 'muted small flc-tabinfo' }, !aktiv ? 'Angaben zum Förderer.' + (L.erbenAlle ? ' Jeder neue Fördertopf übernimmt daraus, was ihm in seiner eigenen Zeile fehlt (im Reiter des Topfs unter „Vom Förderer übernommen“ zu sehen).' : '')
      : anl ? 'Neuer Fördertopf „' + n + '“: Diese Angaben gelten nur für ihn.' : aktiv === L.hKey ? 'Ziel des Einlesens: Fördertopf „' + n + '“.' : 'Vorhandener Fördertopf „' + n + '“: Es werden nur leere Felder ergänzt.'); };
  const erbeZeilen = () => {                                                       // was ein neuer Topf zusätzlich vom Förderer übernimmt (nur Ansicht)
    if (!tabsAn() || !aktiv || !L.erbenAlle) return []; const ki = L.findIndex(x => x.anlegen && x.tab === aktiv); if (ki < 0 || !gilt(ki)) return [];
    const eigen = new Set(L.filter(x => x.tab === aktiv && x.key).map(x => x.key)), G = L.filter((x, i) => x.erbt && x.tab === '' && x.fn && gilt(i) && (!eigen.has(x.erbt) || x.erbt === 'notiz' || x.erbt === 'beispiele')); if (!G.length) return [];
    return [h('div', { class: 'flc-bereich' }, 'Vom Förderer übernommen'), ...G.map(x => h('div', { class: 'flc-r erbe' }, h('div', { class: 'flc-cb' }), h('div', { class: 'flc-k' }, h('b', {}, x.titel), h('span', { class: 'fl-pill' }, 'Förderer')), h('div', { class: 'flc-v' }, h('div', { class: 'flc-w' + (x.edit === 'rich' ? ' fmt' : ''), html: anzeige(x) }))))]; };
  const zeichne = () => {
    const an = tabsAn(); tabBar.hidden = !an; if (!tabsListe().includes(aktiv)) aktiv = tabsListe()[0] || '';
    tabBar.replaceChildren(...(an ? tabsListe().map(k => { const b = h('button', { type: 'button', role: 'tab', class: 'flc-tab' + (k === aktiv ? ' on' : ''), 'aria-selected': String(k === aktiv), onclick: () => { aktiv = k; zeichne(); } }, k ? L.tabNamen[k] : 'Förderer', L.some(x => x.anlegen && x.tab === k) ? h('i', { class: 'flc-neu' }, 'neu') : null, h('small', {}));
      b.dataset.k = k; return b; }) : []));
    const sicht = L.map((x, i) => i).filter(i => !an || L[i].tab === aktiv), teile = FLC_BEREICHE.map(b => ({ b, L: sicht.filter(i => L[i].bereich === b) })).filter(t => t.L.length);
    liste.replaceChildren(...[tabKopf(), ...teile.flatMap(t => [h('div', { class: 'flc-bereich' }, t.b), ...t.L.map(i => rows[i])]), ...erbeZeilen()].filter(Boolean)); zeigen();
  };
  const baue = () => {                                                           // Angaben für das gewählte Ziel neu aufstellen
    L = flcAenderungen(e, R, traeger()); cbs = L.map(x => h('input', { type: 'checkbox', class: 'flc-c', checked: x.an, disabled: !x.fn, 'aria-label': x.titel + ' übernehmen' }));
    rows = L.map((x, i) => zeile(x, i)); cbs.forEach((c, i) => c.addEventListener('change', () => { if (L[i].anlegen && tabsAn()) { zeichne(); c.focus(); } else zeigen(); }));
    zeichne();
  };
  const alle = f2 => () => { L.forEach((x, i) => { if (x.fn && (!tabsAn() || x.tab === aktiv)) cbs[i].checked = f2(x); }); if (tabsAn()) zeichne(); else zeigen(); };
  const ziel = h('div', { class: 'flc-ziel' }, h('b', {}, 'Einlesen in:'), ...optionen.map(o => h('label', { class: 'flc-zo' }, h('input', { type: 'radio', name: 'flc-ziel', checked: o.k === wahl, onchange: () => { wahl = o.k; neuName.hidden = wahl !== 'neu'; baue(); } }), ' ' + o.l)), neuName);
  neuName.hidden = wahl !== 'neu'; neuName.addEventListener('input', () => { if (wahl === 'neu') { traeger(); const t = liste.querySelector('.flc-r b'); } });
  neuName.addEventListener('change', () => { if (wahl === 'neu') baue(); });
  const legende = h('div', { class: 'flc-leg' }, ...['neu', 'ersetzt', 'ergänzt'].map(k => h('span', { class: 'flc-tag ' + k, title: ART_TIP[k] }, k)), h('span', { class: 'flc-tag unsicher', title: FLC_UNSICHER_TIP }, 'unsicher belegt'),
    h('span', { class: 'flc-leg-r' }, h('button', { class: 'link small', onclick: alle(() => true) }, 'alle'), h('button', { class: 'link small', onclick: alle(() => false) }, 'keine'), h('button', { class: 'link small', onclick: alle(x => x.an), title: 'neue, sicher belegte Angaben' }, 'Vorschlag')));
  const bar = h('div', { class: 'flc-bar' },
    ...(optionen.length > 1 || wahl === 'neu' ? [ziel] : []), legende,
    tabBar);
  baue();
  // mehrere Dateien: links die Förderer der Recherche, abgearbeitet von oben nach unten
  // Kreise wie bei den Freigaben eines Bedarfs: grün ✓ = übernommen, gelb … = gerade dran, leer = folgt, grau – = übersprungen
  const ST = { ok: ['ok', 'übernommen'], skip: ['na', 'übersprungen'], jetzt: ['run', 'wird gerade bearbeitet'], wartet: ['off', 'folgt'] };
  const seite = info && info.liste ? h('aside', { class: 'flc-seite', 'aria-label': 'Förderer dieser Recherche' }, h('div', { class: 'flc-seite-t' }, 'Recherche'),
    ...info.liste.map(x => h('div', { class: 'flc-sf ' + x.st, title: ST[x.st][1] }, h('span', { class: 'circ c-' + ST[x.st][0], 'aria-hidden': 'true', html: CIRC_SYM[ST[x.st][0]] || '' }), h('span', { class: 'flc-sf-n' }, x.name)))) : null;
  const body = seite ? h('div', { class: 'flc-mit-seite' }, seite, h('div', { class: 'flc' }, bar, liste)) : h('div', { class: 'flc' }, bar, liste);
  const knoepfe = info ? [['Recherche beenden', 'stop'], ['Überspringen', 'skip'], ['Übernehmen', true, 'primary']] : [['Abbrechen', false], ['Übernehmen', true, 'primary']];
  const kopfName = info ? null : h('span', { class: 'flc-kopf-n' }, e.kurz || e.name);
  const ok = await modal('Welche Angaben sollen übernommen werden?', body, knoepfe, { wide: true, cls: 'flc-modal' + (seite ? ' mit-seite' : ''), kopf: kopfName });
  if (ok !== true) return info && (ok === 'stop' || ok == null) ? 'stop' : 'skip';
  let n = 0; const t = traeger(); if (t._neu) { delete t._neu; flTopfEinfuegen(e, t); UI.flTopf = t.id; }
  const ids = L.map((x, i) => i).filter(i => L[i].fn && gilt(i));
  [...ids.filter(i => !L[i].spaet), ...ids.filter(i => L[i].spaet)].forEach(i => { L[i].fn(L[i].neu); n++; });          // „Fördertopf anlegen“ zuletzt: der Topf erbt dann, was ihm fehlt
  if (t !== e) UI.flTopf = t.id;
  if (n || t !== e) { e.fristenL.sort((a, c) => a.d.localeCompare(c.d)); flZuKartei(); changed(); keep(renderNow); }
  if (!info) toast(n ? n + (n === 1 ? ' Angabe' : ' Angaben') + ' übernommen – mit ↶ (Strg+Z) wieder rückgängig zu machen' : 'Nichts übernommen', n ? 'ok' : undefined);
  return 'ok';
}
const FLC_UNSICHER_TIP = 'Unsicher belegt: Die Quelle sagt es nicht direkt, ist älter als zwei Jahre oder widerspricht sich – bitte über „Quelle“ prüfen. Deshalb nicht vorgewählt.';

// ---------- „Mit Copilot ausfüllen“: Ziel wählen, dann Vorlage herunterladen und Auftrag kopieren
function flcDialog(e) {
  const T = e.topfe, cur = flTopfWahl(e), ohne = !T.length; let art = ohne ? 'e' : 't', tw = cur ? cur.id : T.length ? T[0].id : 'neu';       // art: Förderer allgemein | bestimmter Fördertopf; tw: Id des Topfs oder „neu“
  const neuName = h('input', { type: 'text', class: 'flc-neuname', placeholder: 'Name des neuen Fördertopfs', 'aria-label': 'Name des neuen Fördertopfs' });
  const sel = h('select', { class: 'flc-sel', 'aria-label': 'Fördertopf' }, ...T.map(t => h('option', { value: t.id, selected: t.id === tw }, (t.name || '(ohne Namen)') + (t.recherche ? '' : ' – noch nicht recherchiert'))), h('option', { value: 'neu', selected: tw === 'neu' }, 'Neuer Fördertopf …'));
  let variante = flcVariante(e);
  const varWahl = flcVarianteWahl(variante, k => { variante = k; });
  const z = () => { if (art === 'e') return { modus: 'foerderer', topf: null, name: '', variante }; if (tw === 'neu') return { modus: 'topf', topf: null, name: strV(neuName.value) }; const t = T.find(x => x.id === tw); return { modus: 'topf', topf: t, name: t ? t.name : '' }; };
  const braucht = () => { if (art === 't' && tw === 'neu' && !strV(neuName.value)) { toast('Bitte den Namen des neuen Fördertopfs eintragen.', 'warn'); neuName.focus(); return true; } return false; };
  // Feld zum Hineinziehen (oder Auswählen) der ausgefüllten Excel – öffnet gleich das Einlesen
  let zu = null; const nimm = f => { if (!f) return; if (!/\.xlsx$/i.test(f.name)) { toast('Bitte die ausgefüllte Excel-Datei (.xlsx) nehmen.', 'warn'); return; } if (zu) zu(true); flcEinlesen(f); };
  const ablage = h('div', { class: 'flc-drop', role: 'button', tabindex: '0', 'aria-label': 'Ausgefüllte Excel einlesen' },
    h('b', {}, '3 · Ausgefüllte Excel hier hineinziehen'), h('span', { class: 'muted small' }, 'oder klicken, um sie auszuwählen'));
  const waehle = async () => nimm(await pickFile('.xlsx'));
  ablage.addEventListener('click', waehle);
  ablage.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); waehle(); } });
  ablage.addEventListener('dragover', ev => { ev.preventDefault(); ev.stopPropagation(); ablage.classList.add('ueber'); });
  ablage.addEventListener('dragleave', () => ablage.classList.remove('ueber'));
  ablage.addEventListener('drop', ev => { ev.preventDefault(); ev.stopPropagation(); ablage.classList.remove('ueber'); nimm([...((ev.dataTransfer && ev.dataTransfer.files) || [])][0]); });
  const knoepfe = h('div', { class: 'flc-knoepfe' },
    h('button', { class: 'primary', onclick: () => { if (braucht()) return; download(FLC_DATEI, flcVorlageBlob(e, z())); } }, '1 · Vorlage herunterladen'),
    h('button', { class: 'primary', onclick: () => { if (braucht()) return; flcPromptKopieren(e, z()); } }, '2 · Auftrag kopieren'));
  const rE = h('input', { type: 'radio', name: 'flc-d', value: 'e', checked: art === 'e', disabled: !ohne, onchange: () => { art = 'e'; zeig(); } });
  const rT = h('input', { type: 'radio', name: 'flc-d', value: 't', checked: art === 't', onchange: () => { art = 't'; zeig(); } });
  const hinwE = h('p', { class: 'muted small flc-sub' }), hinwT = h('p', { class: 'muted small flc-sub' }), unter = h('div', { class: 'flc-sub flc-unter' }, sel, neuName);
  const zeig = () => {
    tw = sel.value; neuName.hidden = tw !== 'neu'; unter.hidden = art !== 't';
    hinwE.textContent = ohne ? 'Überblick über den Förderer: Steckbrief, Kontakte und alle seine Fördertöpfe. Findet Copilot mehrere Töpfe, recherchiert er jeden vollständig mit (Zweck, Gebiet, Höhe, Quote, Antragsweg, Einschätzung, Notizen) – kein Topf bleibt nur mit Namen.' : 'Nicht mehr möglich, weil dieser Förderer schon Fördertöpfe hat: jeder Topf hat seinen eigenen Steckbrief. Bitte einen Fördertopf wählen.';
    hinwT.textContent = art === 't' ? 'Auftrag und Vorlage gelten nur für diesen einen Fördertopf (eigener Steckbrief, eigene Einschätzung, eigene Notizen). Andere Programme des Förderers werden ignoriert.' : '';
    hinwT.hidden = art !== 't';
  };
  sel.addEventListener('change', () => { zeig(); if (tw === 'neu') neuName.focus(); });
  zeig();
  const body = h('div', { class: 'flc-dlg' },
    h('label', { class: 'flc-zo' + (ohne ? '' : ' aus') }, rE, h('b', {}, ' Förderer allgemein')), hinwE, ohne ? h('div', { class: 'flc-sub' }, varWahl) : null,
    h('label', { class: 'flc-zo' }, rT, h('b', {}, ' Ein bestimmter Fördertopf')), unter, hinwT,
    knoepfe, ablage);
  modal('Mit Copilot ausfüllen', body, [['Fertig', true, 'primary']], { expose: c => { zu = c; } });
}
function flcPromptKopieren(e, z) {
  const t = flcPrompt(e, z), fail = () => { modal('Auftrag für Copilot', h('textarea', { class: 'rech-prompt', rows: 14, spellcheck: false, value: t, readonly: true })); };
  try { navigator.clipboard.writeText(t).then(() => toast('Auftrag kopiert – in Copilot einfügen und die Vorlage anhängen', 'ok'), fail); } catch (x) { fail(); }
}
