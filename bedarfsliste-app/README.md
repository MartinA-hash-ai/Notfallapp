# Bedarfsliste – Fundraising Diözese Paderborn

Offline-App (eine einzige HTML-Datei) für den strategischen Überblick über die Bedarfe der Diözese:
Freigabe, Unterlagen, Förderplan und Nacharbeit. Die Antragsarbeit selbst bleibt im Explorer, kleine
Aufgaben bleiben in Teams. Die Datei enthält Programm **und** Daten; sie speichert sich selbst.

## Benutzen

1. `Bedarfsliste.html` in den OneDrive-Ordner legen, in dem auch die Förder-Kartei liegt
   (`Banken- und Stiftungsübersicht.xlsx`), und mit **Microsoft Edge oder Google Chrome** öffnen.
2. Einmal „Ordner wählen …“ und „Bearbeiten zulassen“ – danach speichert die Liste automatisch nach jeder
   Änderung und liest die Förder-Kartei ein (nur lesen; gepflegt wird sie weiter in Excel).
3. Bei späteren Starts fragt der Browser beim ersten Klick kurz, ob die Liste den Ordner wieder bearbeiten darf.

Es werden keine Daten ins Internet gesendet und nichts nachgeladen.

**Förder-Kartei:** Erkannt wird je Blatt die Kopfzeile mit „Gliederung“. Ist die Excel bis zur letzten Zeile
durchformatiert, liest die Liste nur den vorderen Teil – die leeren Zeilen unter der Tabelle in Excel löschen.

**Förderrecherche mit Copilot:** Auf der Seite eines Bedarfs öffnet „Recherche mit Copilot“ oben rechts im Förderplan drei Schritte:
1. Excel zu diesem Bedarf anlegen – mit verbundenem Ordner im Unterordner `Förderrecherche`, sonst als Download.
   Name: `Foerderrecherche_<Titel>_<Gliederung>_<Kürzel>.xlsx`; über das Kürzel der Kennung findet die Liste die Datei
   auch nach einer Umbenennung und nimmt die neueste passende (auch Kopien wie „… (1).xlsx“).
   Blätter: „Förderplan“ (Bedarf mit Summe, Eigenmitteln, Zusagen und offenem Betrag, darunter die Förderer mit Stand),
   „Anleitung“ (Auftrag, Umfang, Regeln, jede Spalte) und „Förder-Kartei“ (Zuständige für die Gliederung mit Historie,
   ohne Kontaktdaten und Notizen).
2. Prompt kopieren (vorher anpassbar), in Copilot Cowork einfügen und die Excel anhängen. Der Prompt verlangt Websuche
   (sonst Abbruch), nur tatsächlich geöffnete Links als Quellen, realistische Summen je Förderer ohne Zielsumme und
   einen nach offenem Betrag gestaffelten Umfang (bis 2.000 €: 3–5, bis 20.000 €: 5–8, darüber 8–12 Förderer).
3. Ausgefüllte Excel übernehmen: die Liste zeigt die Vorschläge mit Summe, Frist, Einschätzung, Begründung und „ohne Quelle“-Hinweis;
   du wählst aus. Neue Förderer kommen als „geplant“ dazu, vorhandene werden ergänzt. Steht in der Excel noch nichts Neues,
   sagt die Liste das (Copilot nicht fertig, OneDrive noch nicht synchronisiert, Ergebnis als eigene Datei) und bietet
   „Andere Datei wählen …“. Eine Excel lässt sich auch auf die Seite ziehen; das Upload-Symbol öffnet die Dateiauswahl.

**Geplant – Hinweise aus dem Postfach (Copilot Cowork, morgens):** Cowork liest Posteingang und Gesendete Elemente und legt
je Lauf eine neue Excel in einen Eingangsordner; die Liste zeigt die Hinweise beim Öffnen zum Übernehmen oder Verwerfen.
Festgelegte Regeln: (1) Doppeltes erkennt die Liste selbst – stimmt der Vorschlag schon mit den Daten überein, erscheint er nicht.
(2) Die Kennung eines Hinweises bildet die Liste aus Absender, Datum (vereinheitlicht) und Betreff, nicht Copilot; übernommene
und verworfene Hinweise merkt sie sich. (3) Hinweise, die einen Stand zurücksetzen würden (z. B. „beantragt“, obwohl schon
„zugesagt“), werden unterdrückt. (4) Nichts wird ohne Klick übernommen.
Explorer-Pfad aus einem SharePoint-Link umrechnen geht nur bei direkten Adressen (`…/sites/…/Shared Documents/…`) mit
einmaliger Zuordnung, nicht bei Freigabelinks – zurückgestellt.

**Ordner-Pfad:** Im Explorer den Ordner markieren, Strg+Umschalt+C („Als Pfad kopieren“) und ins Feld einfügen –
die Anführungszeichen entfernt die Liste.

**In der Liste bearbeiten:** Strg gedrückt halten, dann Name, Summe, Ort, Ansprechperson, Deadline oder Beträge anklicken
und ändern; Freigaben, Angebot, Förderer und Verwendungsnachweis drehen per Klick einen Stand weiter; das + unten links im
Finanzierungsplan fügt einen Förderer hinzu (Enter: zum Betrag, Shift+Enter: speichern und nächster Förderer), der Stift am Ende des Förderernamens benennt ihn um; der Kalender beim
Verwendungsnachweis setzt die Frist; der Kreis mit Stift bei der Spendenübergabe öffnet Ort, Datum, Uhrzeit und Notizen.

**Spaltenbreiten:** in der Liste am rechten Rand eines Spaltenkopfs ziehen (wie in Excel); der Browser merkt sie sich,
Doppelklick auf einen Rand oder „Spaltenbreiten zurücksetzen“ im Zahnrad stellt sie zurück.

**Darstellung:** hell (voreingestellt), dunkel oder wie Windows – über das Zahnrad oben rechts.
`Foerderplan_Vorlage.xlsx` ist dieselbe Vorlage ohne Bedarf.

**Programm-Update:** Eine Datei, in der schon gearbeitet wurde, nie durch eine neue `Bedarfsliste.html` ersetzen.
Stattdessen `Bedarfsliste_Update.zip` in den Ordner legen (die Liste meldet es von selbst) oder
„⋯ → Programm-Update einspielen …“ – getauscht wird nur das Programm, die Daten bleiben.

## Entwicklung

- Quellcode: `src/*.js` (in Reihenfolge der Nummern zusammengefügt), `src/style.css`; Beispieldaten nur für die Vorschau: `src/demo.js`
- Bauen: `python3 build.py` → `Bedarfsliste.html`, `Bedarfsliste_Update.zip`, `Foerderplan_Vorlage.xlsx` (braucht Node), `vorschau/` (Vorschau mit Beispieldaten, nicht im Repo)
- Tests: `sh tests/run.sh` (alle) oder `sh tests/run.sh t03` (einer) – Playwright/Chromium gegen die gebaute Datei, mit nachgebautem Ordnerzugriff.
  Vor jeder Auslieferung: bauen, alle Tests grün. Neue Version: oben in `src/changelog.json` eintragen.
- Speichern, Ordnerzugriff und Excel-Lesen/-Schreiben stammen aus der Jahresplanung Außenkommunikation (vereinfacht für eine Person).
