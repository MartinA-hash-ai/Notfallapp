# Jahresplanung Außenkommunikation – App

Offline-App (eine einzige HTML-Datei) als Alternative zur Excel-Jahresplanung.
Die Datei enthält Programm **und** Daten; „Speichern“ schreibt sie zurück.

**Benutzen:** `Jahresplanung_Aussenkommunikation.html` in Microsoft Edge oder Google Chrome öffnen.
Es werden keine Daten ins Internet gesendet und nichts nachgeladen.

Ansichten: Kalender (mit Hover-Details), Zeitleiste (PAL/Vorläufe per Ziehen ändern), Maßnahmen-Tabelle,
„Was steht an?“, Detailpläne (Gantt mit Rückwärtsterminierung wie im Excel), Urlaub & Feiertage.
Exporte: Excel (.xlsx), Outlook (.ics), Drucken/PDF.

## Entwicklung

- Quellcode: `src/*.js` (werden in Reihenfolge der Nummern zusammengefügt), `src/style.css`
- Startdaten: `src/initial_data.json`, erzeugt aus der Excel-Datei mit `python3 make_initial_data.py`
- Bauen: `python3 build.py` → `Jahresplanung_Aussenkommunikation.html`

Achtung: Die gebaute Datei enthält die Startdaten. Eine Datei, in der schon gearbeitet wurde, nicht durch
einen neuen Build ersetzen – stattdessen die neue Version öffnen und über „⋯ → Andere Datei öffnen …“
die Daten aus der alten Datei übernehmen, dann speichern.
