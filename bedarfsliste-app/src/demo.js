/* ===================================================================== Nur für die Vorschau: erfundene Beispieldaten (nicht in der Programmdatei) */

const DEMO_KARTEI = [
  { name: 'Sparkasse Musterstadt', blatt: 'Banken', gl: ['Paderborn', 'Büren', 'Brakel'], weg: ['direkt'],
    kontakte: [{ n: 'Erika Beispiel (FL)', m: 'erika.beispiel@sparkasse-musterstadt.example', t: '05251 000-100' }, { n: 'Hans Exempel (V)', m: 'hans.exempel@sparkasse-musterstadt.example', t: '', nicht: true }],
    hist: { 2025: '1.000 € Folierung', 2024: '500 € Blaulichtanlage' } },
  { name: 'Volksbank Beispielland eG', blatt: 'Banken', gl: ['Lippstadt', 'Hagen'], weg: ['direkt'],
    kontakte: [{ n: 'Jonas Muster (MBL)', m: 'jonas.muster@vb-beispielland.example', t: '02941 000-200' }], hist: { 2025: '500 € Übungspuppen und AED' } },
  { name: 'Bürgerstiftung Musterstadt', blatt: 'Stiftungen', gl: ['Paderborn'], weg: ['per Mail'], schwer: 'Bürgerschaftliches Engagement, Bevölkerungsschutz, Jugend', web: 'https://www.buergerstiftung-musterstadt.example',
    kontakte: [{ n: 'Petra Exempel', m: 'info@buergerstiftung-musterstadt.example', t: '05251 000-300' }], hist: { 2024: '2.400 € Helme' } },
  { name: 'Musterstiftung Ehrenamt NRW', blatt: 'Stiftungen', gl: ['alle'], weg: ['Portal'], web: 'https://foerderportal.musterstiftung.example', notiz: 'Zugang: Martin',
    schwer: 'Ehrenamtsförderung, Qualifizierung', hist: { 2026: '1.500 € Klausur' } },
  { name: 'Beispiel-Soziallotterie', blatt: 'Stiftungen', gl: ['alle'], weg: ['Portal'], web: 'https://antrag.beispiel-lotterie.example',
    schwer: 'Inklusion, Fahrzeuge für soziale Dienste', hist: { 2025: '14.412 € Wärmebus' } },
];

function demoBedarfe() {
  const B = o => merge(blank(), o);
  return [
    B({ id: 'b-mtw', titel: 'Mannschaftstransportwagen (MTW) für den Sanitätsdienst', gliederung: 'Paderborn', zust: ['Thomas Beispiel', 'Anna Muster'], prio: 'hoch', summe: 68000, summeArt: 'Angebot', deadline: '2027-06-30',
      beschreibung: 'Ersatz für den 18 Jahre alten MTW. Das Fahrzeug bringt Helferinnen und Helfer zu Sanitätsdiensten und zu Einsätzen im Katastrophenschutz.\n\nLaut UPL Ersatzbeschaffung 2027, Fahrzeug ist bereits zweimal ausgefallen.',
      link: 'https://fundraising.sharepoint.example/Bedarfe/2027-MTW-Paderborn', pfad: 'C:\\Users\\Beispiel\\OneDrive - Malteser\\Fundraising\\Bedarfe\\2027 MTW Paderborn',
      freigabe: { ofk: { st: 'ok', angefragt: '2026-08-03', erledigt: '2026-08-12' }, angebot: { st: 'ok', erledigt: '2026-08-20', notiz: 'Autohaus, gültig bis 31.12.2026' },
        fach: { name: 'Notfallvorsorge', st: 'ok', angefragt: '2026-08-14', erledigt: '2026-08-28' }, verw: { st: 'ok', angefragt: '2026-08-14', erledigt: '2026-09-04' } },
      unterlagen: [UL('Konzept', 'da', true), UL('Projektsteckbrief', 'da', true), UL('Bilder', 'da'), UL('Kostenplan', 'arbeit')],
      foerderer: [
        ff({ id: 'f-mtw-spk', name: 'Sparkasse Musterstadt', art: 'Sparkasse', betrag: 10000, status: 'zugesagt', zugesagt: 10000, eingegangen: 10000, eingangAm: '2026-10-02', beantragtAm: '2026-08-25', entscheidungAm: '2026-09-18', einsch: 'sw',
          warum: 'Starker Regionalbezug Paderborn. Das Fahrzeug ist bei Großveranstaltungen zu sehen, ein Förderhinweis auf dem Fahrzeug ist möglich.', knackpunkte: 'Höchstens 10.000 € je Vorhaben.',
          vn: { noetig: true, frist: '2027-09-30', st: 'offen' } }),
        ff({ id: 'f-mtw-bst', name: 'Bürgerstiftung Musterstadt', art: 'Stiftung', betrag: 15000, status: 'beantragt', beantragtAm: '2026-09-15', erwartet: '2026-11-30', einsch: 'u',
          warum: 'Satzungszweck Bevölkerungsschutz und bürgerschaftliches Engagement.', knackpunkte: 'Fördert ungern ganze Fahrzeuge. Im Antrag die Ausstattung (Sanitätsmaterial, Funk) in den Vordergrund stellen.' }),
        ff({ id: 'f-mtw-lot', name: 'Beispiel-Soziallotterie', betrag: 30000, status: 'geplant', frist: '2027-01-15', einsch: 'w', art: 'Soziallotterie', weg: 'Portal', web: 'https://antrag.beispiel-lotterie.example',
          fristInfo: 'laufend, Bearbeitung etwa 3 Monate', hoehe: 'bis 50 % der Kosten', eigenInfo: 'mindestens 10 %',
          warum: 'Förderschwerpunkt Fahrzeuge für soziale Dienste. Der MTW fährt zusätzlich im Fahrdienst für Menschen mit Behinderung.', knackpunkte: 'Die Nutzung im Fahrdienst muss im Konzept deutlich werden.' }),
      ],
      eigenanteil: 13000,
      nach: { ueb: { noetig: true, st: 'offen', ort: 'Wache Paderborn', mit: ['f-mtw-spk'] }, pm: { noetig: true, st: 'offen' } } }),

    B({ id: 'b-aed', titel: 'Defibrillatoren (AED) für den Sanitätsdienst', gliederung: 'Lippstadt', zust: ['Klaus Exempel'], prio: 'hoch', summe: 4800, summeArt: 'Angebot', deadline: '2027-03-31',
      beschreibung: 'Zwei AED für die Sanitätsdienste bei Schützen- und Stadtfesten. Bisher wird ein Gerät geliehen.',
      freigabe: { ofk: { st: 'ok', angefragt: '2026-09-02', erledigt: '2026-09-10' }, angebot: { st: 'ok', erledigt: '2026-09-12' },
        fach: { name: 'Notfallvorsorge', st: 'angefragt', angefragt: '2026-10-01' }, verw: { st: 'offen' } },
      unterlagen: [UL('Konzept', 'arbeit', true), UL('Projektsteckbrief', 'da', true)],
      foerderer: [ff({ name: 'Volksbank Beispielland eG', art: 'Volksbank / Bank', betrag: 2400, status: 'geplant', frist: '2027-01-31', einsch: 'w', warum: 'Hat 2025 schon Übungspuppen und einen AED gefördert.' })] }),

    B({ id: 'b-dig-bue', titel: 'Laptop und Beamer für den Ausbildungsraum', gliederung: 'Büren', stichwort: 'Landesprogramm Digitalisierung 2027', zust: ['Maria Beispiel'], prio: 'mittel', summe: 1000, deadline: '2026-12-31',
      beschreibung: 'Für Erste-Hilfe-Kurse und die Helferausbildung. Der alte Beamer ist ausgefallen.',
      freigabe: { ofk: { st: 'ok', angefragt: '2026-10-08', erledigt: '2026-10-12' }, angebot: { st: 'angefragt', angefragt: '2026-10-13' },
        fach: { name: 'Ausbildung', st: 'angefragt', angefragt: '2026-10-13' }, verw: { st: 'offen' } },
      unterlagen: [UL('Konzept', 'fehlt', true), UL('Projektsteckbrief', 'arbeit', true)],
      foerderer: [ff({ name: 'Landesprogramm Digitalisierung (Beispiel)', kontakt: 'Förderportal des Landes', art: 'Öffentliche Förderung', weg: 'Portal', betrag: 1000, status: 'geplant', frist: '2026-10-30', einsch: 'sw',
        warum: 'Das Programm fördert Hardware für Ehrenamt und Ausbildung, pauschal 1.000 € je Standort.' })] }),

    B({ id: 'b-dig-bra', titel: 'Tablets für die Einsatzdokumentation', gliederung: 'Brakel', stichwort: 'Landesprogramm Digitalisierung 2027', zust: ['Stefan Muster'], prio: 'niedrig', summe: 800, summeArt: 'Angebot', deadline: '2026-12-31',
      beschreibung: 'Zwei Tablets, damit Einsätze im Sanitätsdienst direkt vor Ort dokumentiert werden.',
      freigabe: { ofk: { st: 'ok', angefragt: '2026-09-20', erledigt: '2026-09-24' }, angebot: { st: 'ok', erledigt: '2026-09-25' } },
      unterlagen: [UL('Konzept', 'fehlt', true), UL('Projektsteckbrief', 'da', true)],
      foerderer: [ff({ name: 'Landesprogramm Digitalisierung (Beispiel)', art: 'Öffentliche Förderung', kontakt: 'Förderportal des Landes', betrag: 800, status: 'beantragt', beantragtAm: '2026-10-09', erwartet: '2026-12-15', einsch: 'sw',
        warum: 'Passt genau in das Programm.' })] }),

    B({ id: 'b-waerme', titel: 'Wärmebus Hagen: Betriebskosten Winter 2026/27', gliederung: 'Hagen', zust: ['Anna Muster', 'Peter Beispiel'], prio: 'mittel', summe: 14000, deadline: '2026-11-01',
      beschreibung: 'Kraftstoff, Verpflegung und Schlafsäcke für die Wintersaison. Der Bus fährt von November bis März dreimal pro Woche.',
      freigabe: { ofk: { st: 'ok', erledigt: '2026-05-20' }, angebot: { st: 'ok', erledigt: '2026-05-22' }, fach: { name: 'Soziales Ehrenamt', st: 'ok', erledigt: '2026-05-28' }, verw: { st: 'ok', erledigt: '2026-06-02' } },
      unterlagen: [UL('Konzept', 'da', true), UL('Projektsteckbrief', 'da', true), UL('Bilder', 'da'), UL('Presseartikel', 'da')],
      foerderer: [ff({ id: 'f-wb-lot', name: 'Beispiel-Soziallotterie', art: 'Soziallotterie', betrag: 12000, status: 'zugesagt', zugesagt: 12000, eingegangen: 12000, eingangAm: '2026-09-20', beantragtAm: '2026-06-10', entscheidungAm: '2026-08-29', einsch: 'w',
        warum: 'Hat den Wärmebus schon 2025 gefördert.', vn: { noetig: true, frist: '2027-04-30', st: 'arbeit' } }),
        ff({ name: 'Volksbank Beispielland eG', art: 'Volksbank / Bank', betrag: 2000, status: 'abgelehnt', beantragtAm: '2026-06-10', entscheidungAm: '2026-07-15', grund: 'Budget für 2026 schon vergeben – ab Januar wieder anfragen.' }),
        ff({ name: 'Stadtwerke Hagen (Beispiel)', art: 'Unternehmen', betrag: 1500, status: 'geplant', warum: 'Reserve, falls die Lotterie weniger gibt – nicht mehr nötig.' })],
      eigenanteil: 2000,
      nach: { ueb: { noetig: true, st: 'erledigt', termin: '2026-10-05', ort: 'Hauptbahnhof Hagen', mit: ['f-wb-lot'] }, pm: { noetig: true, st: 'veroeff', datum: '2026-10-06' } } }),

    B({ id: 'b-kueche', titel: 'Küche für den Gruppenraum der Malteser Jugend', gliederung: 'Warburg', zust: ['Julia Exempel'], prio: 'mittel', summe: 9500, summeArt: 'Angebot',
      beschreibung: 'Einbauküche für den Gruppenraum, damit die Jugendgruppe gemeinsam kochen kann.',
      freigabe: { ofk: { st: 'ok', erledigt: '2026-04-14' }, fach: { name: 'Jugend', st: 'ok', erledigt: '2026-04-28' }, verw: { st: 'ok', erledigt: '2026-05-04' } },
      unterlagen: [UL('Konzept', 'da', true), UL('Projektsteckbrief', 'da', true), UL('Angebot', 'da', true)],
      foerderer: [
        ff({ name: 'Bürgerstiftung Musterstadt', art: 'Stiftung', betrag: 5000, status: 'zugesagt', zugesagt: 5000, eingegangen: 5000, eingangAm: '2026-08-20', beantragtAm: '2026-05-20', entscheidungAm: '2026-07-02', einsch: 'sw',
          vn: { noetig: true, frist: '2027-03-31', st: 'erledigt' } }),
        ff({ name: 'Sparkasse Musterstadt', art: 'Sparkasse', betrag: 3000, status: 'zugesagt', zugesagt: 3000, eingegangen: 3000, eingangAm: '2026-08-28', beantragtAm: '2026-05-20', entscheidungAm: '2026-07-10', einsch: 'sw',
          vn: { noetig: false } }),
      ],
      eigenanteil: 2000,
      nach: { ueb: { noetig: true, st: 'offen', info: 'Küche wird erst Ende November eingebaut – Übergabe danach, damit es Fotos von der fertigen Küche gibt.' }, pm: { noetig: true, st: 'offen' } } }),

    B({ id: 'b-klausur', titel: 'Klausurtagung der Ehrenamtskoordination 2027', gliederung: DIO, zust: ['Julia Exempel'], prio: 'niedrig', summe: 2500, summeArt: 'Angebot', deadline: '2027-02-28',
      beschreibung: 'Zwei Tage für die Ehrenamtskoordination aller Gliederungen, mit Tagungshaus und Referentin.',
      freigabe: { angebot: { st: 'ok', erledigt: '2026-08-01' }, fach: { name: 'Soziales Ehrenamt', st: 'ok', erledigt: '2026-08-05' }, verw: { st: 'ok', erledigt: '2026-08-12' } },
      unterlagen: [UL('Konzept', 'da', true), UL('Projektsteckbrief', 'arbeit', true)],
      foerderer: [ff({ name: 'Musterstiftung Ehrenamt NRW', art: 'Stiftung', betrag: 2000, status: 'abgelehnt', beantragtAm: '2026-09-01', entscheidungAm: '2026-10-14', einsch: 'uw',
        warum: 'Hat 2026 schon eine Klausur gefördert.', knackpunkte: 'Absage: fördert 2027 nur Vorhaben mit neuen Ehrenamtlichen. Nächster Versuch mit Fokus auf die Einarbeitung neuer Koordinatorinnen.' })],
      eigenanteil: 500, nach: { ueb: { noetig: false }, pm: { noetig: false } } }),

    B({ id: 'b-rucksack', titel: 'Sanitätsrucksäcke für die Helfergruppe', gliederung: 'Iserlohn-Menden', zust: ['Peter Beispiel'], prio: 'mittel', summe: 3200, summeArt: 'Angebot', deadline: '2027-04-30',
      beschreibung: 'Sechs Rucksäcke nach aktueller Bestückungsliste. Die alten sind über zehn Jahre alt.',
      freigabe: { ofk: { st: 'ok', erledigt: '2026-09-15' }, angebot: { st: 'ok', erledigt: '2026-09-18' }, fach: { name: 'Notfallvorsorge' }, verw: { st: 'nein', angefragt: '2026-10-01', erledigt: '2026-10-08', notiz: 'Nicht budgetiert – erst 2028 möglich.' } },
      unterlagen: [UL('Konzept', 'fehlt', true), UL('Projektsteckbrief', 'fehlt', true)],
      foerderer: [ff({ name: 'Volksbank Beispielland eG', art: 'Volksbank / Bank', durch: 'gl', betrag: 3200, status: 'beantragt', beantragtAm: '2026-10-05', erwartet: '2026-10-15', einsch: 'suw',
        warum: 'Von der Gliederung selbst beantragt, ohne Absprache.', knackpunkte: 'Der AED-Bedarf aus Lippstadt soll an dieselbe Bank gehen.' })] }),

    B({ id: 'b-pav', titel: 'Pavillons für Sanitätsdienste', gliederung: 'Geseke', zust: ['Klaus Exempel'], summe: 2000, summeArt: 'Angebot', deadline: '2026-05-01', archiv: true,
      beschreibung: 'Zwei Faltpavillons als Unfallhilfsstelle bei Veranstaltungen.',
      freigabe: { ofk: { st: 'ok', erledigt: '2026-01-20' }, angebot: { st: 'ok', erledigt: '2026-01-22' }, fach: { name: 'Notfallvorsorge', st: 'ok', erledigt: '2026-02-02' }, verw: { st: 'ok', erledigt: '2026-02-05' } },
      unterlagen: [UL('Konzept', 'da', true), UL('Projektsteckbrief', 'da', true)],
      foerderer: [ff({ id: 'f-pav-spk', name: 'Sparkasse Musterstadt', art: 'Sparkasse', betrag: 2000, status: 'zugesagt', zugesagt: 2000, eingegangen: 2000, eingangAm: '2026-04-12', beantragtAm: '2026-02-10', entscheidungAm: '2026-03-20', einsch: 'sw',
        vn: { noetig: true, frist: '2026-09-30', st: 'erledigt' } })],
      nach: { ueb: { noetig: true, st: 'erledigt', termin: '2026-05-09', ort: 'Schützenfest Geseke', mit: ['f-pav-spk'] }, pm: { noetig: true, st: 'veroeff', datum: '2026-05-11' } } }),
  ];
}
// Fördererliste in der Vorschau (ab 0.88): erfundene Förderer, Kontakte und Förderungen. Die Beispiel-Soziallotterie fehlt mit Absicht –
// ihr Geld für den Wärmebus ist eingegangen, auf seiner Seite steht daher „In Fördererliste übernehmen?“
function demoFoerderer() {
  const K = (n, pos, mail, tel, gl, anschreiben, notiz) => ({ n, pos, mail, tel, gl, anschreiben, notiz: notiz || '' });
  const G = (jahr, betrag, zweck, gl, ergebnis, grund) => ({ jahr, betrag, zweck, gl, ergebnis: ergebnis || 'gefördert', grund: grund || '', quelle: 'Kartei' });
  return [
    { id: 'F001', name: 'Sparkasse Musterstadt', art: 'Sparkasse', gl: ['Paderborn', 'Büren', 'Brakel', 'Geseke'], weg: ['direkt'], anschrift: 'Marktplatz 1, 33098 Musterstadt',
      web: 'https://www.sparkasse-musterstadt.example', schwer: 'Bevölkerungsschutz, Ehrenamt, Jugend', hoehe: 'meist bis 10.000 €', fristen: 'laufend; Sitzung des Stiftungsrats im März und September', recherche: '2026-03-12', bew: { chance: 3 },
      notiz: 'Förderhinweis auf Fahrzeugen gern gesehen.',
      ansprache: [{ gl: 'Geseke', art: 'über die Gliederung', hinweis: 'Die Gliederung Geseke fragt selbst an – nur abstimmen.' }],
      kontakte: [K('Erika Beispiel', 'Filialleitung', 'erika.beispiel@sparkasse-musterstadt.example', '05251 000-100', ['Paderborn', 'Büren'], 'ja'),
        K('Hans Exempel', 'Vorstandsvorsitz', 'hans.exempel@sparkasse-musterstadt.example', '', [], 'nein', 'Nur über Frau Beispiel'),
        K('Lena Muster', 'Marktbereichsleitung', 'lena.muster@sparkasse-musterstadt.example', '05272 000-110', ['Brakel'], '')],
      foerderungen: [G('2025', 1000, 'Folierung Krankentransportwagen', ['Paderborn']), G('2024', 500, 'Blaulichtanlage', ['Büren'])] },
    { id: 'F002', name: 'Volksbank Beispielland eG', art: 'Volks- und Raiffeisenbank', gl: ['Lippstadt', 'Hagen'], weg: ['direkt'], anschrift: 'Bahnhofstraße 5, 59555 Beispielstadt',
      schwer: 'Gesundheit, Ehrenamt', hoehe: 'bis 2.500 €', fristen: 'Anträge bis 31.01. für das laufende Jahr', recherche: '2025-11-03', bew: { chance: 2, dauer: 2 },
      ansprache: [{ gl: 'Lippstadt', art: 'über die Gliederung', hinweis: 'Ortsbeauftragter kennt den Vorstand – Anfrage läuft über ihn.' }],
      kontakte: [K('Jonas Muster', 'Marktbereichsleitung', 'jonas.muster@vb-beispielland.example', '02941 000-200', ['Lippstadt'], 'ja')],
      foerderungen: [G('2025', 500, 'Übungspuppen und AED', ['Lippstadt'])] },
    { id: 'F003', name: 'Bürgerstiftung Musterstadt', art: 'Stiftung', gl: ['Paderborn'], weg: ['per Mail'], web: 'https://www.buergerstiftung-musterstadt.example',
      schwer: 'Bürgerschaftliches Engagement, Bevölkerungsschutz, Jugend', hoehe: '1.000 bis 15.000 €', fristen: '31.03., 30.09. und 15.12.', bew: { chance: 2, dauer: 1 }, richtlinien: 'https://www.buergerstiftung-musterstadt.example/foerderung', recherche: '2026-02-20',
      kontakte: [K('Petra Exempel', 'Geschäftsführung', 'info@buergerstiftung-musterstadt.example', '05251 000-300', ['Paderborn'], 'ja')],
      foerderungen: [G('2024', 2400, 'Helme für die Helfergruppe', ['Paderborn'])] },
    { id: 'F004', name: 'Musterstiftung Ehrenamt NRW', art: 'Stiftung', gl: ['alle'], weg: ['Portal'], web: 'https://foerderportal.musterstiftung.example', notiz: 'Zugang zum Portal: Fundraising',
      schwer: 'Ehrenamtsförderung, Qualifizierung', hoehe: 'bis 3.000 €', fristen: 'laufend', recherche: '2026-01-15', bew: { chance: 3, dauer: 3 },
      foerderungen: [G('2026', 1500, 'Klausurtagung der Gruppenleitungen', ['Diözese'])] },
    { id: 'F005', name: 'Stiftung Beispielhafte Hilfe', art: 'Stiftung', gl: ['Hagen', 'Iserlohn-Menden'], weg: ['per Mail'], schwer: 'Soziale Dienste, Wohnungslosenhilfe', hoehe: 'bis 5.000 €', fristen: '15.10. und 30.11.', bew: { chance: 1, dauer: 2, summe: 1 },
      kontakte: [K('Dr. Max Exempel', 'Vorstand', 'm.exempel@beispielhafte-hilfe.example', '', ['Hagen'], '')],
      foerderungen: [G('2023', null, 'Wärmebus Hagen', ['Hagen'], 'abgelehnt', 'Fördert keine laufenden Betriebskosten.')] },
  ];
}
// Kontenliste in der Vorschau: erfundene Konten (gültige Prüfziffern, ausgedachte Kontonummern) für einige Gliederungen
function demoKonten() {
  const k = (art, blz, kto) => ({ art, iban: ibanBauen(blz, kto) });
  const L = ['Altenbeken', 'Brakel', 'Büren', 'Dortmund', 'Geseke', 'Gütersloh', 'Hagen', 'Paderborn'].map((gl, i) => ({ gl, konten: [k('Pax-Bank', '37060120', 4711000 + i), k('BKC', '37060193', 8150000 + i)]
    .concat(i % 3 === 0 ? [k('Sparkasse', '47650130', 1234500 + i)] : i % 3 === 1 ? [k('Volksbank', '47260121', 7654300 + i)] : []) }));
  return { stand: '2026-10-01T09:00:00.000Z', datei: 'Kontenliste_Beispiel.xlsx', liste: L };
}
