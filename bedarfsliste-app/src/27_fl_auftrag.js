/* ===================================================================== Recherche-Auftrag in zwei Varianten (ab 0.122)
   A = kleine, lokale Förderer (Bürgerstiftungen, kleine Familien- und Gemeindestiftungen, örtliche Stiftungen von Sparkassen und Volksbanken)
   B = große, überregionale Förderer (Soziallotterien, große Stiftungen, Landes- und Bundesprogramme)
   Vorschlag nach „Art“: Soziallotterie und Öffentlich → B, alles andere → A; im Fenster umstellbar (keine Speicherung am Förderer).
   Die AUSFÜLLREGELN stehen nur einmal hier; die Unterschiede (Zahl der Beispiele, Topf-Name, Topf-Notizen) sind Parameter.
   Gilt für „Mit Copilot ausfüllen“ (Förderer allgemein) und „KI-Recherche“ für mehrere Förderer; der Auftrag für einen einzelnen Fördertopf bleibt in 25_fl_copilot.js. */
const FLC_GROSS_ARTEN = ['Soziallotterie', 'Öffentlich'];
const flcVariante = e => e && FLC_GROSS_ARTEN.some(a => norm(a) === norm(e.art)) ? 'B' : 'A';
const FLC_VARIANTEN = { A: 'klein / lokal', B: 'groß / überregional' };

function flcAusfuellregeln(v) {
  const B = v === 'B';
  return [
    'AUSFÜLLREGELN',
    '1. Fülle die Dateien direkt aus (Python/openpyxl), nur die gelb hinterlegten Zellen: im „Steckbrief“ Wert, Sicherheit, Quelle, Anmerkung; in „Fristen“, „Fördertöpfe“, „Beispiele“, „Kontakte“, „Quellen“ die Zeilen unter der Überschrift. Keine Blätter, Spalten, Überschriften oder Formate ändern; „Anleitung“ und „Auswahlwerte“ bleiben unverändert. Prüfe nach dem Speichern, dass außerhalb der gelben Zellen nichts verändert ist.',
    '2. Nichts erfinden, nicht raten. Jede Angabe bekommt in „Quelle“ einen Link, den du tatsächlich geöffnet hast. Sicherheit „sicher“ = steht so in der Quelle; „unsicher“ = indirekt belegt, älter als zwei Jahre oder widersprüchlich.',
    '3. Formate: Auswahlfelder nur mit den Werten aus „Auswahlwerte“, genau so geschrieben. Beträge als reine Zahl (10000). Förderhöhe: „von“ nur bei einem genannten Mindestbetrag; gibt es nur einen Betrag (Höchstbetrag), steht er nur bei „bis“. Datum TT.MM.JJJJ; eine Frist ohne Jahr (31.03.) gilt jedes Jahr; einmalige Frist: „Jedes Jahr“ = nein; abgelaufene einmalige Fristen weglassen.',
    '4. Förderzweck: kurze Stichworte in eigenen Worten. „Zwecke der Malteser“: nur passende Zwecke aus der Liste. Fördergebiet: Gliederungen aus der Liste; ganzes Erzbistum, NRW oder bundesweit = „alle“; liegt das Gebiet in keiner Gliederung der Liste: leer lassen und in „Weitere Notizen“ vermerken. Passt der Förderer laut Satzung gar nicht zu den Maltesern: in „Weitere Notizen“.',
    '5. „Großförderer“ = ja nur, wenn laut Quelle über 10.000 € möglich sind. Feste Termine ins Blatt „Fristen“; sonst Hinweis (z. B. „laufend“) in „Hinweis zu Fristen“.',
    '6. Häufigkeit, Aufwand, Dauer nur, wenn aus der Richtlinie ableitbar; Begründung kurz in „Anmerkung“ (bei Fördertöpfen als Stichpunkt in deren „Weitere Notizen“).',
    '7. Kontakte: nur Personen oder Funktionen, deren Kontaktdaten der Förderer selbst veröffentlicht. Keine privaten Daten, nichts aus sozialen Netzwerken, keine erschlossenen E-Mail-Adressen. „Anschreiben“ bleibt leer.',
    '8. Notizen KURZ: Stichpunkte mit „- “, je höchstens ca. 10 Wörter, höchstens 4 je Feld. „Wie tickt …“: höchstens zwei kurze Sätze. „Argumente“ nach Gewicht, Fundstelle kurz in Klammern. Eigene Einschätzungen mit „Einschätzung:“ kennzeichnen. Keine Projektbeispiele, Zahlenreihen oder Statistik in den Notizen.',
    '9. Keine Wiederholungen: Jede Information steht genau einmal, im passendsten Feld. Was in einem eigenen Feld steht (Zweck, Gebiet, Höhe, Quote, Fristen, Antragsweg, Links, Anschrift, Häufigkeit, Aufwand, Dauer), nicht in den Notizen wiederholen; die Notizfelder wiederholen sich auch nicht gegenseitig' + (B ? '; Topf-Notizen wiederholen nichts aus dem Steckbrief' : '') + '. „Was wird gefördert?“ nennt nur, was über den Förderzweck hinausgeht, und zeigt die Förderlogik: welche Themen und Zielgruppen bevorzugt werden, welche Kostenarten oder Anschaffungen, was ausdrücklich erwünscht ist (z. B. Modellcharakter, Ehrenamt, Kofinanzierung). Selbstverständliches weglassen – z. B. „Projekte gemeinnütziger Vereine/Institutionen“ oder „nur gemeinnützige Träger“.',
    '10. Beispiele: bis zu ' + (B ? '8' : '4') + ' nachweislich geförderte Projekte, ' + (B ? 'bevorzugt Malteser-Projekte und ähnliche Träger' : 'bevorzugt ähnlich zu Malteser-Vorhaben') + '. Je Zeile Schlagwort (1–3 Wörter), ein Satz Beschreibung, Empfänger/Ort, Jahr, Betrag nur wenn genannt, ' + (B ? 'Name des Topfs, ' : '') + 'Quelle.',
    '11. Quellen: jede verwendete Seite (Link, was dort steht in einem Satz, Abrufdatum).',
  ].join('\n');
}

const FLC_TEIL = {
  A: { budget: 'BUDGET je Förderer: höchstens 12 geöffnete Seiten oder Dokumente und höchstens 25 Tool-Aufrufe. Danach abschließen; was fehlt, bleibt leer.',
    vorgehen: [
      'VORGEHEN',
      '1. Lies das Blatt „Anleitung“ und die Spalte „Format / Erklärung“ im Blatt „Steckbrief“.',
      '2. Lies in dieser Reihenfolge: Satzung, Förderrichtlinie, Antragsformular, Kontakt/Impressum, den neuesten Jahres- oder Tätigkeitsbericht.',
      '3. Beispiele: Newsbereich, Sitemap und Berichte nicht komplett lesen, sondern nach Stichwörtern durchsuchen: Malteser, Sanitätsdienst, Rettung, Erste Hilfe, Feuerwehr, DRK, DLRG, Johanniter, Ehrenamt, Senioren, Hospiz, Demenz, Flüchtlinge. Erst wenn die eigene Seite nichts hergibt: Seite der Stadt bzw. Gemeinde oder Lokalpresse.',
      '4. Prüfe, wie aktuell die Homepage ist (letzte Meldung, Stand der Dokumente). Ist alles älter als zwei Jahre: in „Weitere Notizen“ vermerken, betroffene Angaben „unsicher“.',
      '5. Sind die Seiten des Förderers nicht erreichbar, brich ab und melde das, statt aus Suchergebnissen zu füllen.'],
    typisch: [
      'TYPISCH FÜR KLEINE FÖRDERER',
      '- Meist nur ein Programm: „Steckbrief“ voll ausfüllen, „Fördertöpfe“ bleibt leer. Ein eigener Topf nur, wenn ein Programm eigene Regeln und einen eigenen Antragsweg hat (z. B. ein Ehrenamtspreis). Stipendien oder Einzelfallhilfen für Privatpersonen sind kein Topf (höchstens eine Zeile in „Weitere Notizen“).',
      '- Die Förderhöhe steht selten in der Richtlinie: aus veröffentlichten Förderungen ableiten, „unsicher“, Anmerkung „aus Förderhistorie“.',
      '- Entscheidet ein Gremium in Sitzungen: den Rhythmus in „Hinweis zu Fristen“.',
      '- Typische Stolpersteine: Ortsbindung, Pflichtaufgaben der Kommune, konfessionelle oder überregionale Träger, ein Antrag pro Jahr.',
      '- Haben die Malteser vor Ort hier schon Geld bekommen oder wurden sie eingeladen: als erstes Argument und ins Blatt „Beispiele“.'],
    mehr: '',
    rueckgabe: 'was du nicht gefunden hast und wo du unsicher bist.' },
  B: { budget: 'BUDGET je Förderer: höchstens 40 geöffnete Seiten oder Dokumente und höchstens 80 Tool-Aufrufe. Danach abschließen; was fehlt, bleibt leer.',
    vorgehen: [
      'VORGEHEN',
      '1. Lies das Blatt „Anleitung“ und die Spalte „Format / Erklärung“ im Blatt „Steckbrief“.',
      '2. Erfasse zuerst die Programmübersicht des Förderers: alle Förderprogramme bzw. Förderangebote mit Link.',
      '3. Vorfilter: Recherchiere nur die Programme vertieft, für die die Malteser antragsberechtigt sind und die zu Malteser-Vorhaben passen (Ehrenamt, Sanitäts- und Rettungsdienst, Erste Hilfe, Katastrophenschutz, Besuchs- und Begleitdienste, Hospiz, Demenz, Senioren, Integration, Kinder und Jugend, Inklusion, Armut). Die übrigen Programme nennst du gesammelt in einem Stichpunkt in „Weitere Notizen“ im Steckbrief (Namen, kurzer Grund). Höchstens 12 Programme ins Blatt „Fördertöpfe“, nach Relevanz sortiert.',
      '4. Recherchiere jedes relevante Programm eigens auf seiner Programmseite und in seiner Richtlinie bzw. seinem Merkblatt und fülle ALLE Spalten der Topf-Zeile: Zweck, Gebiet, Höhe von/bis, Förderquote und Eigenanteil, Hinweis zu Fristen, Antragsweg, Antrag an (Portal-Link), Programmseite, Richtlinien-Link, Häufigkeit, Aufwand, Dauer, Großförderer und die Notizspalten. Lange PDFs nicht ganz lesen: Text extrahieren und gezielt die Abschnitte suchen (Antragsberechtigte, Förderhöhe, Eigenmittel, Laufzeit, nicht förderfähige Kosten, Antragsfrist, Verwendungsnachweis).',
      '5. Prüfe für den ganzen Förderer die Antragsberechtigung: Muss der Antrag über einen Spitzen- oder Dachverband laufen? Darf eine Untergliederung ohne eigene Rechtsform beantragen oder nur der Gesamtverband (Malteser Hilfsdienst e. V.)? Sind kirchliche Träger zugelassen? Gibt es Verbote der Doppelförderung? Ergebnis als Stolpersteine bzw. „Weitere Notizen“.',
      '6. Beispiele: Durchsuche die Projektdatenbank oder Förderlandkarte des Förderers gezielt nach „Malteser“ und nach Orten im Erzbistum Paderborn; bevorzugt Malteser-Projekte und ähnliche Träger. Presse nur, wenn die Datenbank nichts hergibt.',
      '7. Sind die Seiten des Förderers nicht erreichbar, brich ab und melde das, statt aus Suchergebnissen zu füllen.'],
    typisch: [
      'TYPISCH FÜR GROSSE FÖRDERER',
      '- Mehrere Programme: Im „Steckbrief“ steht nur Name, Kurzname, Art, Homepage, Anschrift, „Wie tickt der Förderer?“ und was wirklich für alle Programme gleich gilt (z. B. gemeinsames Antragsportal, allgemeine Antragsberechtigung). Alles Programmbezogene steht in der Topf-Zeile.',
      '- Fördergebiet meist „alle“; regional begrenzte Programme eigens prüfen.',
      '- Förderquote und Eigenanteil wörtlich wie in der Richtlinie (z. B. „bis 70 % der förderfähigen Kosten, Eigenanteil 30 %“).',
      '- Stichtage und Antragsfenster jeweils einzeln ins Blatt „Fristen“, mit Namen des Topfs.',
      '- Kontakte: Beratungsteam oder Hotline je Programm, wie veröffentlicht.'],
    mehr: ' Hat ein Förderer mehr als 4 relevante Programme, nimm je Programm einen eigenen Unterauftrag.',
    rueckgabe: 'was du nicht gefunden hast, wo du unsicher bist und welche Programme du per Vorfilter ausgeschlossen hast.' },
};

// L: Förderer; v: 'A' | 'B'; datei: e → Dateiname der Vorlage
function flcAuftrag(L, v, datei) {
  const T = FLC_TEIL[v === 'B' ? 'B' : 'A'];
  return [
    'Du bist Rechercheassistent im Fundraising der Malteser (Malteser Hilfsdienst e. V., Diözese Paderborn). Im Anhang liegen Excel-Dateien – je Förderer eine (Dateiname und Blatt „Anleitung“ nennen die Förderer-ID). Recherchiere jeden der folgenden Förderer im Web und fülle seine Datei aus. Ich lese die Dateien danach in unser Programm ein.',
    '',
    ...L.map((e, i) => (i + 1) + '. ' + (e.name || '[Name]') + (e.web ? ' – Homepage: ' + e.web : '') + ' – Datei: ' + datei(e)
      + (e.topfe && e.topfe.length ? ' – hat bei uns schon die Fördertöpfe ' + e.topfe.map(t => '„' + t.name + '“').join(', ') + ' (im Blatt „Fördertöpfe“ eingetragen; diese Zeilen mit genau diesen Namen ausfüllen)' : '')),
    '',
    'Mehrere Förderer: Jeder bekommt nur seine eigene Datei, nichts vermischen. Arbeite die Förderer einzeln ab, wenn möglich parallel (ein Unterauftrag je Förderer), alle gleich gründlich.' + T.mehr,
    '',
    T.budget,
    '',
    T.vorgehen.join('\n'),
    '',
    T.typisch.join('\n'),
    '',
    flcAusfuellregeln(v),
    '',
    'RÜCKGABE',
    'Alle ausgefüllten Dateien mit demselben Namen und dem Zusatz „_ausgefuellt“, zusammen als ZIP. Darunter je Förderer höchstens drei Sätze: ' + T.rueckgabe,
  ].join('\n');
}
// Auswahl im Fenster: zwei Knöpfe „klein / lokal“ und „groß / überregional“
function flcVarianteWahl(v0, onwahl) {
  let v = v0; const box = h('div', { class: 'flc-var', role: 'radiogroup', 'aria-label': 'Recherche-Umfang' }, h('span', { class: 'flc-var-l' }, 'Umfang:'));
  const kn = ['A', 'B'].map(k => { const b = h('button', { type: 'button', class: 'flc-var-k' + (k === v ? ' on' : ''), role: 'radio', 'aria-checked': String(k === v), title: k === 'A' ? 'Bürgerstiftungen, kleine Stiftungen, örtliche Stiftungen von Sparkassen und Volksbanken – Budget 12 Seiten, 4 Beispiele' : 'Soziallotterien, große Stiftungen, Landes- und Bundesprogramme – Budget 40 Seiten, Programme mit Vorfilter, 8 Beispiele' }, FLC_VARIANTEN[k]);
    b.addEventListener('click', () => { v = k; kn.forEach((x, i) => { const an = ['A', 'B'][i] === k; x.classList.toggle('on', an); x.setAttribute('aria-checked', String(an)); }); onwahl(k); }); return b; });
  box.append(...kn); return box;
}
