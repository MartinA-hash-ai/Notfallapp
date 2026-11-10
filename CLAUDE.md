# Bedarfsliste (Malteser Diözese Paderborn) – Arbeitsregeln

Offline-Tool als **eine einzige HTML-Datei**. Projektordner: `bedarfsliste-app/`. Antworten an den Nutzer immer **auf Deutsch**, knapp, ohne Floskeln; bei Unklarheit nachfragen statt raten; Widerspruch ist erwünscht. Der Nutzer arbeitet per Spracheingabe (Tippfehler/abgebrochene Sätze möglich) und ist Fundraiser, kein Entwickler.

## Aufbau
- Quellen: `bedarfsliste-app/src/NN_*.js`, `style.css`, `changelog.json`, `demo.js`. Gebaut wird mit `python3 build.py` (im Ordner `bedarfsliste-app/`) → `Bedarfsliste.html`, `Bedarfsliste_Update.zip`, die Vorlagen-xlsx und `vorschau/Bedarfsliste_Vorschau.html` (gitignored).
- Tests: `bedarfsliste-app/tests/tXX.js` (Playwright), Aufruf `sh tests/run.sh t23 t06 …`, parallel mit `J=4`. Üblicher Satz vor jedem Commit: `J=4 sh tests/run.sh t23 t06 t03 t07 t20 t22 t08 t09 t11 t24 t25`.
- Bekannt rot, unabhängig von neuen Änderungen: **t01, t10, t12** – nicht „reparieren“, nur erwähnen.
- Fördererliste: `src/23_foerderer.js` (Modell, Liste, Seite, Excel), `src/25_fl_copilot.js` (Copilot-Vorlage, Auftrag, Einlesen mit Reitern), `src/26_fl_serie.js` (KI-Recherche für mehrere Förderer: Auswahl, ZIP, mehrere Dateien einlesen), `src/27_fl_auftrag.js` (Recherche-Auftrag Variante A klein / B groß, Ausfüllregeln nur hier), `src/24_zwecke.js`. Seitenleiste links (Verwendungszweck, Kontenliste, Gebietsnummern): `src/28_seitenleiste.js`, Kontenliste: `src/21_konten.js`. Einstellungen: `src/29_einstellungen.js`; Export (Auswahlmodus, PDF, Excel, Termine): `src/30_export.js`; E-Mail-Auswertung mit Cowork (Auftrag/Überblick im Ordner „Förderrecherche“, Vorschläge „Posteingang …“, Prüffenster): `src/31_posteingang.js`, Test `t24`.

## Pro Version (Reihenfolge)
1. Ändern → `python3 build.py` → Tests (siehe oben).
2. Eintrag **oben** in `src/changelog.json` (neue Version, z. B. 0.121.0; nach 0.99 kommt 0.100 – numerisch zählen) und ein Absatz „**Seit 0.xxx:** …“ **vor** dem vorigen in `README.md`.
3. Neu bauen, dann committen. Nur diese Pfade stagen: `src tests/*.js tools README.md build.py Bedarfsliste.html Bedarfsliste_Update.zip Foerderplan_Vorlage.xlsx UPL_Vorlage.xlsx Foerderer_Copilot_Vorlage.xlsx` (jeweils unter `bedarfsliste-app/`).
4. Push **nur** auf den Branch der Sitzung (bisher `claude/vibrant-goldberg-3cv36n`), kein PR ohne Aufforderung.
5. Vorschau als Artifact veröffentlichen (`bedarfsliste-app/vorschau/Bedarfsliste_Vorschau.html`, bestehende URL `https://claude.ai/artifact/QVFzanYvWFA6kPyK46Nnhx` mit `url` aktualisieren, Label „Version 0.xxx“).
6. Dem Nutzer `Bedarfsliste_Update.zip` (und Screenshots) schicken, kurze Zusammenfassung auf Deutsch.

## Datenschutz (wichtig)
- **Nie** echte Excel/PDF des Nutzers (Kartei, UPL, Personen, Kontakte, Kontenliste, Bank-/Stiftungsübersicht, Freistellungsbescheid, Fördererliste, ausgefüllte Copilot-Vorlagen) committen oder in Screenshots/Demodaten zeigen. Keine echten IBANs oder Personennamen in Code, Tests, Demo oder Repo. Screenshots nur mit Demodaten (`src/demo.js`).
- Heruntergeladene/hochgeladene Dateien in einem eigenen Ordner im Scratchpad ablegen; bei echten Daten nur Anzahlen berichten.
- Commit-Nachrichten und Artefakte enthalten keine Modell-IDs.

## Eigenheiten
- UI-Texte sind deutsch; Fördertöpfe: Förderer und Topf sind „Träger“ derselben Felder (`FL_TF`); mit Töpfen zeigt die Seite nur die Töpfe.
- Excel-Kopie und Copilot-Vorlage müssen zusammenpassen (`FLC_TSP`, Blätter Fördertöpfe/Beispiele); bei Änderungen an Spalten beides und die Tests (`t23`) anpassen.

## Übergabe (Stand 0.126, 11.11.2026)
**Ziel:** Offline-HTML-Tool „Bedarfsliste“ für das Fundraising der Malteser Diözese Paderborn: Bedarfe, Fördererliste mit KI-Recherche, Kontenliste, Gebietsnummern.

**Fertig (bis 0.126):**
- Fördererliste: Förderer mit Fördertöpfen (hohe Zeile, Kurzform, verschiebbare Trennlinie, „▾ Töpfe einklappen“ für alle), Tasten wie Bedarfsliste, Beispiele-Kasten, Fördersumme im Netz aus Höchstbetrag der Förderhöhe.
- KI-Recherche: Knopf → kleines Fenster (Auswahl + Ablagefeld), Vorlagen als ZIP, gemeinsamer Auftrag Variante A „klein / lokal“ (Budget 12 Seiten/25 Tool-Aufrufe, 4 Beispiele) bzw. B „groß / überregional“ (40/80, Vorfilter, 8 Beispiele); Vorschlag nach „Art“ (Soziallotterie, Öffentlich → B).
- Übernehmen-Fenster: „Welche Angaben sollen übernommen werden?“, Kennzeichen neu/ersetzt/ergänzt/unsicher belegt, links Förderer-Liste mit Kreisen (grün/gelb/leer).
- Seitenleiste links: Verwendungszweck (99 Kostenstellen in 16 Bereichen, im Code), Kontenliste, Gebietsnummern (45 Nummern aus PDF, im Code).
- Kontenliste: zentriert, BIC/Bank beim Darüberfahren, kopierbar, feste Zeilenhöhe.
- Reiter: Bedarfe, Fördererliste, Archiv (rechts, grau).

**Entscheidungen:**
- Ein recherchierter Einzelbetrag = „bis …“ (`flcHoehe`).
- Förderer-Angaben bei neuen Töpfen: jeder Topf erbt Fehlendes, Notizen/Beispiele werden angehängt.
- Gemischte Auswahl klein/groß: nur Hinweis, keine getrennten Aufträge.
- Variante A/B wird nicht am Förderer gespeichert.

**Verworfen:**
- Spalten „Anmerkung“/„Zwecke der Malteser“ im Blatt „Fördertöpfe“ – Nutzen zu klein.
- Status-Feld im ⋯-Menü – entfernt auf Wunsch.

**Offen, nach Priorität:**
2. Offene Frage: Feld „Größe“ (klein/groß) am Förderer anlegen?
3. Offene Frage: Gliederungsfilter bei Gebieten ohne Gliederung (z. B. Bielefeld) – Freitext nur anzeigen oder filterbar?
4. Import prüfen: Beträge mit Cent (3155.88), Telefonnummern-Schreibweisen.
5. Offene Frage: im Screenshot war die Ansprechperson-Zelle eingekreist – Bedeutung unklar.
6. t14 einmal kurz flaky (Prio nach Neuladen) – beobachten.

**Dateien/Links:** Vorschau https://claude.ai/artifact/QVFzanYvWFA6kPyK46Nnhx · Branch `claude/vibrant-goldberg-3cv36n` · Repo `martina-hash-ai/notfallapp`.

**Arbeitsweise:** Deutsch, knapp, keine Floskeln; Widerspruch erwünscht; Unsicherheit offen sagen; bei Unklarheit fragen. Nutzer diktiert (Tippfehler möglich), ist Fundraiser, kein Entwickler. Pro Version: kurze Zusammenfassung, ZIP + Screenshots (Demodaten) schicken.
