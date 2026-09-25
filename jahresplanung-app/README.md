# Jahresplanung Außenkommunikation – App

Offline-App (eine einzige HTML-Datei) als Alternative zur Excel-Jahresplanung.
Die Datei enthält Programm **und** Daten; „Speichern“ schreibt sie zurück.

**Benutzen:** `Jahresplanung_Aussenkommunikation.html` in Microsoft Edge oder Google Chrome öffnen.
Es werden keine Daten ins Internet gesendet und nichts nachgeladen.

**Für den Mailing-Ordner:** `Jahresplanung_fuer_Mailing-Ordner.zip` in den (über OneDrive synchronisierten)
Mailing-Ordner entpacken:

- `Jahresplanung starten.cmd` – Doppelklick öffnet die App in einem eigenen Edge-Fenster (`msedge --app`)
- `Jahresplanung_Aussenkommunikation.html` – Programm und Daten
- `Jahresplanung – aktueller Stand.xlsx` – entsteht beim ersten Speichern: schreibgeschützte Ansicht
  (Übersicht, Kalender, Zeitleiste, Termine, Detailpläne, Urlaub) für alle, die nur in Teams hineinschauen

Speichern: Beim ersten Mal den Mailing-Ordner wählen (File System Access API, Zugriff wird im Browser
gemerkt). Danach speichert die App automatisch nach jeder Änderung Programmdatei und Excel-Ansicht und
prüft alle 15 Sekunden, ob jemand anderes gespeichert hat (neuer Stand wird geladen bzw. Konflikt angezeigt).
Direkt aus der Teams-/SharePoint-Weboberfläche läuft die App nicht (SharePoint führt HTML nicht aus).

## Entwicklung

- Quellcode: `src/*.js` (werden in Reihenfolge der Nummern zusammengefügt), `src/style.css`
- Startdaten: `src/initial_data.json`, erzeugt aus der Excel-Datei mit `python3 make_initial_data.py`
- Startknopf: `launcher/Jahresplanung starten.cmd` (nur ASCII, CRLF)
- Bauen: `python3 build.py` → `Jahresplanung_Aussenkommunikation.html` und `Jahresplanung_fuer_Mailing-Ordner.zip`

Achtung: Die gebaute Datei enthält die Startdaten. Eine Datei, in der schon gearbeitet wurde, nicht durch
einen neuen Build ersetzen – stattdessen die neue Version öffnen und über „⋯ → Andere Datei öffnen …“
die Daten aus der alten Datei übernehmen, dann speichern.
