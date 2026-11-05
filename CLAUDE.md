# Bedarfsliste (Malteser Diözese Paderborn) – Arbeitsregeln

Offline-Tool als **eine einzige HTML-Datei**. Projektordner: `bedarfsliste-app/`. Antworten an den Nutzer immer **auf Deutsch**, knapp, ohne Floskeln; bei Unklarheit nachfragen statt raten; Widerspruch ist erwünscht. Der Nutzer arbeitet per Spracheingabe (Tippfehler/abgebrochene Sätze möglich) und ist Fundraiser, kein Entwickler.

## Aufbau
- Quellen: `bedarfsliste-app/src/NN_*.js`, `style.css`, `changelog.json`, `demo.js`. Gebaut wird mit `python3 build.py` (im Ordner `bedarfsliste-app/`) → `Bedarfsliste.html`, `Bedarfsliste_Update.zip`, die Vorlagen-xlsx und `vorschau/Bedarfsliste_Vorschau.html` (gitignored).
- Tests: `bedarfsliste-app/tests/tXX.js` (Playwright), Aufruf `sh tests/run.sh t23 t06 …`, parallel mit `J=4`. Üblicher Satz vor jedem Commit: `J=4 sh tests/run.sh t23 t06 t03 t07 t20 t22 t08 t09 t11`.
- Bekannt rot, unabhängig von neuen Änderungen: **t01, t10, t12** – nicht „reparieren“, nur erwähnen.
- Fördererliste: `src/23_foerderer.js` (Modell, Liste, Seite, Excel), `src/25_fl_copilot.js` (Copilot-Vorlage, Auftrag, Einlesen mit Reitern), `src/26_fl_serie.js` (KI-Recherche für mehrere Förderer: Auswahl, ZIP, mehrere Dateien einlesen), `src/27_fl_auftrag.js` (Recherche-Auftrag Variante A klein / B groß, Ausfüllregeln nur hier), `src/24_zwecke.js`. Seitenleiste links (Verwendungszweck, Kontenliste, Gebietsnummern): `src/28_seitenleiste.js`, Kontenliste: `src/21_konten.js`.

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
