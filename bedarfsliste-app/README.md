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

**Förder-Kartei:** Erkannt wird je Blatt die Kopfzeile mit „Gliederung“. Seit 0.47 wird auch eine bis zur letzten Zeile
durchformatierte Excel ganz gelesen (leere Zeilen werden beim Entpacken übersprungen). Die Kartei bleibt die Quelle und wird
weiter in Excel gepflegt – keine Kopie. Steht ein Förderer in der Kartei, übernimmt die Liste beim Eintragen (und einmal für
vorhandene Förderer) Art, Website, Antragsweg, die Kontakte für die Gliederung des Bedarfs (eine Zeile ohne eigenen Kontakt erbt
den der Zeile darüber; „nicht direkt anschreiben“ nicht) und die Förderhistorie in die Notizen – nur in leere Felder, je Name einmal.
Einen eigenen Kasten „Aus der Förder-Kartei“ gibt es nicht mehr.
**Gemeinsame Kartei verknüpfen (seit 0.49):** Zahnrad → Förder-Kartei → „Datei verknüpfen …“ wählt die Excel dort, wo das Team sie pflegt
(z. B. im SharePoint-Ordner, über OneDrive auf dem PC). Die Liste liest dann immer diese Datei, etwa jede Minute bei Änderungen; eine Kopie im
Ordner der Liste ist nicht mehr nötig. Der Verweis liegt im Browser; nach einem Neustart fragt der Browser ggf. einmal nach – oben steht dann
„Förder-Kartei: Zugriff erlauben“. Läuft alles, steht oben kein Feld zur Kartei.

**Förderrecherche mit Copilot:** Das Copilot-Zeichen oben rechts auf der Seite eines Bedarfs öffnet die Aufgaben (ein eigener Knopf im Förderplan entfällt seit 0.45). Ablauf:
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
**Ordner des Bedarfs (nur SharePoint-Link, seit 0.45):** Das Feld „Pfad im Explorer“ ist entfallen. Den Ordner in SharePoint im Browser
öffnen und die Adresse aus der Adresszeile einfügen. Aus so einem Link (direkte Adresse oder `…/Forms/AllItems.aspx?id=…`, nicht Freigabelinks
`/:f:/s/…`) merkt sich die Liste in den Einstellungen, wo „Ortsgliederungen“ bzw. „1601_Diözese_Pojekte“ in SharePoint liegen, und baut
daraus die Links für Ordner, die Cowork (Pfad im OneDrive) oder Copilot finden – auch rückwirkend für Bedarfe, deren Ordner schon bekannt ist.
Für Cowork rechnet sie den Link in den Pfad im OneDrive zurück.
Seit 0.45.1 ist die Adresse fest eingetragen (`maltesercloud.sharepoint.com/sites/Fundraising-Team-DizesePaderborn/Freigegebene Dokumente/General`);
ein eingefügter Link einer anderen Ablage ersetzt sie. Freigabelinks (`/:f:/s/…`) öffnen den Ordner, verraten aber den Pfad nicht – Links mit `/:f:/r/` schon.

**Ansicht der Liste:** „Ausführlich“ zeigt alles (Förderer einzeln, Ansprechperson, Deadline); „Kompakt“ je Bedarf eine Zeile mit
Name, Summe, Ort und je Bereich nur dem Stand – grün durch, gelb in Bearbeitung, rot abgelehnt, leerer Kreis noch nichts, grau nicht nötig.
Fehlt die Freigabe noch, steht bei Finanzierung nur „Freigabe ausstehend“; Verwendungsnachweis und Spendenübergabe bleiben leer.
In der kompakten Ansicht führt „+ Bedarf“ durch Name, Summe und Ort; Umschalt+Enter legt gleich den nächsten an (in beiden Ansichten).
Ein Klick neben das Wort (oder auf Freigabe, Finanzierung …) klappt einen Bedarf ausführlich auf – er gleitet auf, die Spalten bleiben stehen,
die anderen Bedarfe werden blass. Noch ein Klick daneben öffnet ihn; ein Klick auf eine andere Zeile holt diese nach vorn,
Esc oder ein Klick außerhalb der Liste klappt zu. Strg+Klick geht weiterhin. Der Browser merkt sich die Wahl.

**Priorität:** der Stern ganz vorn in der Liste (und auf der Seite des Bedarfs) – Klick: Prio an (gelb) oder aus. Stern im Spaltenkopf: 1. Klick – Bedarfe mit Prio nach oben (Rand golden), 2. Klick – nur noch Bedarfe mit Prio (ausgefüllt), 3. Klick – wieder normal.

**Hinweise (Fristen und Infos):** oben in der Kopfzeile, gebündelt statt in der Liste – ein Dreieck, gestaffelt: rot „jetzt fällig“
(heute oder überfällig), gelb „bald fällig“ (in den nächsten 14 Tagen), grau „Infos“ (Zusage ohne Betrag, Förderer laut Kartei nicht für die
Gliederung, Antrag läuft ohne vollständige Freigabe); es steht nur die dringendste Stufe da, die anderen beim Überfahren. Klick zeigt die Liste (Antragsfristen, erwartete Antworten,
Deadlines, Verwendungsnachweise – diese auch im Archiv –, Spendenübergaben, Infos). Ein Eintrag springt zu der Stelle, die ihn auslöst, und
lässt sie kurz rot aufleuchten (mit roter Kontur): in der Liste in der Zeile des Bedarfs (kompakt: aufgeklappt), sonst auf der Seite des Bedarfs.

**Finanzierung steht**, wenn Zusagen und Eigenmittel die Summe decken – mit mindestens einer Zusage (nur Eigenmittel gelten nicht als
finanziert: Ziel sind Förderer). Ohne Summe gilt nichts als fertig, der Stand zeigt „Summe fehlt“. Eine Zusage ohne Betrag wird gemeldet.
Ins Archiv geht ein Bedarf mit offenen Antworten, Geldeingängen, Nachweisen oder Übergabe erst nach Rückfrage. Das Angebot kennt auch
„nicht nötig“ (z. B. bei Personal- oder Projektkosten). Als Diözese gilt jede Gliederung, die mit „Diözese“ beginnt.

**Sortieren:** Klick auf einen Spaltenkopf nimmt die Spalte als nächste Stufe dazu (bis zu drei; noch ein Klick: andere Richtung,
dritter Klick: heraus). Nach Priorität sortiert der Stern im Spaltenkopf.

**Bedarf öffnen:** Strg halten und mit der Maus über einen Bedarf – rechts zeigt ein Streifen mit Griff an, dass sich hier etwas öffnen lässt.
Klick auf den Griff, Strg+Klick oder ein Klick neben ein Wort (kompakt: zweimal): der Bedarf gleitet von rechts herein, die Leiste oben gleitet mit. Esc oder „‹ Alle Bedarfe“: zurück an dieselbe Stelle der Liste.
Solange die Freigabe fehlt, sind Finanzierung, Nachweis und Übergabe in der Liste grau.

**In der Liste bearbeiten (Normalzustand):** Name, Summe, Ort, Ansprechperson, Deadline oder Beträge anklicken
und ändern – anklickbar ist genau das Wort; **ein Klick daneben öffnet den Bedarf** (kompakt: klappt ihn erst auf). „+ Bedarf“ legt oben eine neue Zeile an und führt mit Enter oder Tab durch
Name → Summe → Ort → Ansprechperson → Deadline (Shift+Tab zurück; Tab geht auch in vorhandenen Zeilen). Die Reihenfolge
bleibt beim Arbeiten stehen und wird beim Zurückkommen in die Liste neu sortiert. Die Punktlinie zur Frist des
Verwendungsnachweises zeigt die Zeit ab heute (grün, unter einem Monat gelb, unter einer Woche rot).
Im Kreisdiagramm auf der Seite eines Bedarfs schaltet ein Klick auf das Stück eines Förderers seinen Stand weiter. Freigaben, Angebot, Förderer und Verwendungsnachweis drehen per Klick einen Stand weiter; das + unten links im
Finanzierungsplan fügt einen Förderer hinzu (Enter: zum Betrag, Shift+Enter: speichern und nächster Förderer), der Stift am Ende des Förderernamens benennt ihn um; der Kalender beim
Verwendungsnachweis setzt die Frist; der Kreis mit Stift bei der Spendenübergabe öffnet Ort, Datum, Uhrzeit und Notizen.

**Bedarfsseite:** Unter dem Namen die Deadline (Klick: Kalender), daneben die Stichworte mit kleinem grauem + zum Hinzufügen. Ganz rechts „⋯“:
zurückstellen, verwerfen, archivieren, löschen. Alle Daten (Freigabe angefragt, Spendenübergabe, Nachweisfrist, Pressemitteilung) mit dem eigenen
Kalender, die Uhrzeit mit den Rädern – tippen geht auch. Oben links die Zuständigen, je Zeile zwei (Stift: Name, Position, E-Mail, Telefon; E-Mail und Telefon sonst nur
beim Überfahren der Knöpfe; dazu ein Handy; ★ = Ansprechperson in der Liste; ein bekannter Name bringt seine Angaben mit), darunter Deadline und
Stichworte (eintippen, Enter, das nächste), rechts die Beschreibung – anklicken und ändern, bei der Beschreibung irgendwo in die Fläche.

**Copilot-Auftrag (Zeichen oben rechts neben „⋯“):** fünf Kacheln, auch mehrere auf einmal – Beschreibung (neu aus den Unterlagen, höchstens zwei
Absätze mit den Eckdaten, ohne Wiederholung dessen, was die Liste ohnehin zeigt), Neue Förderer, Förderrecherche (darunter die Förderer zum Anklicken,
auch „die neu gefundenen“), Ordner finden (SharePoint-Ordner des Bedarfs, wird als Link eingetragen) und Kontaktdaten der Zuständigen. Wer es macht, schlägt die Liste vor: **Copilot** (kostet nichts) für Beschreibung, neue Förderer und Kontaktdaten – er antwortet im Chat
und gibt am Ende einen Textblock in festem Aufbau aus, der hier eingefügt und mit Vorschau übernommen wird; **Cowork** (kostet Credits), sobald eine
Förderrecherche dabei ist – es arbeitet in der Arbeits-Excel im Unterordner „Förderrecherche“, nutzt den Skill zur Förderlogik-Analyse und legt je
Förderer eine ausführliche Recherche als Word-Datei „Förderrecherche – <Förderer>.docx“ in den Ordner des Bedarfs (ohne eingetragenen Pfad:
in einen Unterordner je Bedarf unter „Förderrecherche“); in der Liste stehen nur die Essenz
(Pro und Contra je höchstens drei kurze Punkte) und der Dateiname (Fenster „Weitere Infos“). Wählst du Cowork, kommt alles Angehakte in einen Prompt – auch Ordner (Cowork sucht im OneDrive und trägt den Pfad ein) und Kontaktdaten
(aus Personen-Excel, Dateien im Ordner und malteser.de; das interne Adressbuch kennt nur Copilot). Cowork schreibt in die Arbeits-Excel, nicht in die
Bedarfsliste: F5 übernimmt nichts – sobald die Liste neue Ergebnisse in der Arbeits-Excel erkennt (beim Zurückwechseln ins Fenster bzw. regelmäßig im Hintergrund), erscheint ein Fenster „Neues Ergebnis von Cowork“ mit „Ansehen und übernehmen“ oder „Später“. Bei „Später“ bleiben ein Hinweis oben im Bedarf und der rote Punkt am Zeichen stehen. Die Bedarfsordner liegen in der Regel unter „OneDrive - MalteserCloud\Fundraising-Team - Diözese Paderborn - General\
Ortsgliederungen\<Gliederung>\<Bedarf>“, Projekte der Diözese unter „…\1601_Diözese_Pojekte“ – beide Prompts nennen das; ist kein Pfad eingetragen, sucht Cowork den Ordner dort und trägt ihn zur Übernahme ein. Umschalten geht.
Enthält die Excel neue Ergebnisse, meldet die Liste das mit einem Fenster; danach bleiben Hinweis und roter Punkt bis zur Übernahme. Texte (Antrag, Dank …) folgen in einem späteren Update.

**UPL einlesen (seit 0.50):** Zahnrad → „UPL einlesen (Investitionsabfrage) …“. Erkannt wird die Kopfzeile mit „OG-Name“ und „Gesamtkosten“,
die Gruppen („Fundraising“, „Kommentierung Referat“, „… Finanzausschuss und der GF“) in der Zeile darüber. Je Investition ein Bedarf: Name aus dem
Anfang der Beschreibung (ohne „Investition:“, gern kürzen), Ort (DGS = Diözese), Summe aus „Gesamtkosten“, Beschreibung mit „ ---- “ und der
Kommentierung des Fundraisings, Stern bei Priorität „hoch“, Stichwort „UPL <Jahr aus dem Dateinamen>“. Freigaben nur, wenn erteilt: Referat
„genehmigt“ → Fachreferat freigegeben (Name = Dienst, Begründung als Notiz), Finanzausschuss/GF „genehmigt“ → Verwaltung budgetiert. Kommentare
von Verwaltung und Referat sonst nicht. Vorschau mit Auswahl; ein zweites Einlesen legt nichts doppelt an und trägt nur neu erteilte Freigaben
und fehlende Summen nach. Legende und Summenzeilen werden übergangen.

**Seit 0.52:** Das Angebot ist eine Unterlage und zählt nicht mehr zur Freigabe (in der Liste steht es abgesetzt unter der Freigabe, auf der
Seite des Bedarfs bei den Unterlagen). Beim Einlesen der UPL gilt der Ortsführungskreis als zugestimmt. Unter „Zuständig“ steht das Fachreferat
des Bedarfs (Name aus der Freigabe) mit allen Personen der Personenliste, die dazugehören (Spalte „Fachreferat“ – oder der Name steht in Position
bzw. Dienststelle). Der Knopf „Personenliste“ bei „Zuständig“ öffnet die Liste zum Bearbeiten (hinzufügen, ändern, entfernen); gespeichert wird in
`Personen.xlsx`, die dafür die Spalte „Fachreferat“ hat. Beim Bearbeiten der Zuständigen steht jede Person in einem eigenen Kasten.

**Seit 0.59:** Personen-Karten bei „Zuständig“ und „Fachreferat“: „;“ in der Position beginnt eine neue Zeile; die Symbole schweben rechts oben,
die Position steht darunter über die ganze Breite. „+ weitere Person“ ist flacher und nur so breit wie nötig, weniger Abstand zur Trennlinie.

**Seit 0.58:** „+ weitere Person“ bei „Zuständig“ ist dezenter (deutlicher beim Überfahren) und öffnet die Personensuche (schmaleres Fenster);
wer nicht in der Liste steht, über „Neue Person eintragen …“. Der eigene Knopf „Suchen“ entfällt. Beim Fachreferat steht „(+3)“ hinter dem Namen,
wenn Personen ausgeblendet sind; ein Stern markiert die Hauptansprechperson im Fachreferat (steht vorn, `freigabe.fach.stern`). Mehr Abstand
zwischen den Symbolen und der Position darunter.

**Seit 0.57:** Beim Fachreferat steht dauerhaft ein Stift (wie bei „Zuständig“) statt „auswählen“ beim Überfahren. In der Personensuche setzt der
Stern rechts die Ansprechperson (sie rückt nach vorn); ohne Stern bleibt die bisherige Ansprechperson.

**Seit 0.56:** Bei „Zuständig“ sucht der Knopf „Suchen“ in der Personenliste (Name, Position, Gliederung, Fachreferat, E-Mail, Telefon; jedes
Wort muss vorkommen, z. B. „Brakel“); angehakte Personen kommen mit ihren Angaben als Zuständige dazu. Beim Fachreferat stehen zunächst alle
Personen; beim Überfahren der Überschrift erscheint „auswählen“ bzw. „ändern“ – wer angeklickt ist, wird bei diesem Bedarf angezeigt, die
übrigen sind ausgeblendet (gespeichert in `freigabe.fach.wahl`; niemand gewählt = alle). Linie vor „Fachreferat“ mit Abstand.

**Seit 0.55:** Welche Personen zu einem Fachreferat gehören, entscheidet allein die Spalte „Fachreferat“ der Personenliste (mehrere durch Komma
getrennt möglich). In der UPL-Vorlage heißt die Spalte „Dienst“ jetzt „Fachreferat“ (ältere Vorlagen mit „Dienst“ werden weiter gelesen); beim
Einlesen wird das Fachreferat beim Bedarf eingetragen – unter „Zuständig“ erscheinen dann dessen Ansprechpersonen. Mehr Abstand und eine feine
Linie zwischen den Zuständigen und „Fachreferat“.

**Seit 0.54:** Förderer stehen überall (Förderplan, Kacheln, Liste, Übernahme-Vorschau) in dieser Reihenfolge: zugesagt, dann nach Einschätzung
von „sehr wahrscheinlich“ bis „sehr unwahrscheinlich“ (ohne Einschätzung wie „unsicher“), abgelehnt ganz unten. Das Angebot steht nicht mehr in
der Liste; auf der Seite des Bedarfs ist es die erste Unterlage, danach die neue feste Unterlage „Interview“ (offen / vereinbart / geführt), dann
Konzept und Projektsteckbrief. „+ weitere Person“ bei den Zuständigen ist ein gestrichelter Kasten im Raster (bei ungerader Zahl daneben, sonst
in der nächsten Zeile). Das Zahnrad-Menü ist gegliedert: Darstellung, Programm-Update (fett), Excel einlesen, Vorlagen, Datensicherung und
„Über die Bedarfsliste und Tastaturbefehle“; „Texte formatieren“ (steht als „i“ an den Feldern) und „Förderer-Übersicht aktualisieren“
(läuft von selbst) sind entfallen.

**Personenliste nur mit Bestätigung (seit 0.53):** Die Liste schreibt nicht mehr von selbst in `Personen.xlsx`. Neue oder geänderte Zuständige
kommen nur nach einer Rückfrage hinein: beim „Fertig“ unter „Zuständig“ (auch beim Verlassen der Seite während des Bearbeitens), beim Eintragen
einer neuen Ansprechperson in der Liste (die Frage kommt erst, wenn die Eingabe fertig ist) und beim Einpflegen einer Recherche („auch dauerhaft
in die Personenliste übernehmen“, angehakt). Die Frage zeigt je Person, was neu ist oder was sich ändert (alt → neu); „Nur für diesen Bedarf“
lässt die Personenliste unverändert.

**UPL-Vorlage für Copilot/Cowork (seit 0.51):** `UPL_Vorlage.xlsx` (auch Zahnrad → „UPL-Vorlage für Copilot/Cowork (Excel)“) hat das Blatt
„UPL-Import“ (OG-Nr., Übernehmen, Bedarf (Kurzname), Gliederung, Summe, Priorität, Deadline, Beschreibung, Einschätzung Fundraising, Dienst,
Fachreferat freigegeben + Begründung, Verwaltung budgetiert + Begründung, bisherige Spenden, UPL-Zeile, Hinweis), die „Anleitung“ mit Auftrag
(Prompt), Geschäftsjahr und einer Regel je Spalte, und „Gliederungen“ mit den Namen der Liste. Die KI überträgt die UPL nach diesen Regeln;
die ausgefüllte Vorlage wird wie die UPL eingelesen. Zusätzlich: Deadline (Ende des genannten Zeitraums), bisherige Spenden als zugesagte und
eingegangene Spende im Förderplan, „Übernehmen: nein“ ist in der Vorschau abgewählt, Hinweise stehen dort mit ⚠. Die Kennung ist dieselbe wie
beim direkten Einlesen – beide Wege mischen sich ohne Doppelte.

**Förderer-Übersicht (seit 0.48):** Die Liste schreibt `Förderer-Übersicht.xlsx` neben sich selbst und hält sie etwa jede Minute aktuell
(nur bei Änderungen; Zahnrad → „Förderer-Übersicht (Excel) jetzt aktualisieren“). Blatt „Förderer“: je Förderer Art, Website, Antragsweg,
Kontakt, Anfragen, Zusagen, Ablehnungen, Summe der Zusagen, letzte Anfrage, Bedarfe. Blatt „Anfragen“: je Förderer und Bedarf eine Zeile mit
Gliederung, Stichworten, Jahr, Stand, Betrag, Grund der Ablehnung, Pro/Contra, Einschätzung, Recherche-Datei, archiviert – mit Filtern.
Quelle sind alle Bedarfe einschließlich Archiv; gelöschte fehlen, abgeschlossene daher archivieren. Änderungen in der Datei werden überschrieben.
Bei abgelehnten Förderern gibt es das Feld „Grund der Ablehnung“. Die Prompts (Neue Förderer, Förderrecherche) nennen die Erfahrungen bei
ähnlichen Bedarfen (gleiches Stichwort oder gleiches Wort im Namen, ohne Ortsnamen), Cowork zusätzlich die Datei.

**Kontakte-Excel (seit 0.46):** Beim ersten Start ohne Personen-Datei fragt die Liste einmal nach einer Kontakte-Excel (sonst Zahnrad →
„Kontakte-Excel einlesen …“). Seit 0.49 kommen die Personen direkt in `Personen.xlsx` – die eingelesene Datei wird nicht mehr kopiert (ältere
„Personen (Import …)“- oder „Personen (Copilot …)“-Dateien können gelöscht werden, wenn `Personen.xlsx` danach geschrieben wurde); erkannt werden
u. a. „Vorname“ + „Zuname“/„Nachname“, „Aufgabe/Referat“, „Telefonnummer“, „2. Telefonnummer“ (als Handy) und „E-Mail“, auf allen Blättern.
Neue Zuständige und neue Angaben aus den Bedarfen schreibt die Liste etwa jede Minute in `Personen.xlsx` (legt sie an, liest sie vorher neu,
löscht und überschreibt nichts; ist sie gerade in Excel geöffnet, beim nächsten Mal). Eigene Pflege daher besser in einer anderen
„Personen …“-Datei – `Personen.xlsx` schreibt die Liste neu.

**Personen-Excel (Kontaktdaten der Zuständigen):** Der Knopf „Kontaktdaten mit Copilot“ bei „Zuständig“ ist seit 0.45 entfallen (Kontaktdaten
sucht die Aufgabe „Kontaktdaten“ im Copilot-Fenster); die Liste liest `Personen.xlsx` weiter. Der frühere Dialog legte `Personen.xlsx` neben der
Bedarfsliste an (Blatt „Personen“: Name, Position, Gliederung / Dienststelle, E-Mail, Telefon, Handy, Quelle, Stand – mit allen Personen, die die
Liste kennt) und gibt einen kurzen Auftrag für Copilot. Copilot ergänzt die Datei, sie wächst mit jedem Bedarf; von Hand erweitern geht
genauso. Die Liste liest alle Dateien, deren Name mit „Personen“ beginnt (bei Abweichungen gilt die neueste), beim Start und etwa jede Minute,
und ergänzt fehlende Angaben der Zuständigen in allen Bedarfen – Eingetragenes bleibt. Eine Personen-Excel lässt sich auch auf die Seite ziehen.
Förderplan und Nacharbeit klappen über den Pfeil vor der Überschrift ein. Beim Öffnen je nach Phase: läuft die Förderung noch, ist der
Förderplan offen und die Nacharbeit zu; ab der Nacharbeit umgekehrt. Wechselt die Phase auf der Seite, klappt der Bereich der neuen Phase auf.
Das Angebot steht bei den Freigaben (es ist Voraussetzung dafür), gespeichert bleibt es als feste Unterlage.

**Förderer-Fenster:** „Weitere Infos →“ unten rechts in der Kachel öffnet es. Angaben anklicken und ändern; Kontakte über den Stift
(höchstens drei, ★ = Hauptkontakt, der unten in der Kachel steht). Notizen, Fristen, Fördersumme und Eigenanteil lassen sich
einfach formatieren (ebenso die Beschreibung eines Bedarfs): `* ` oder `- ` am Zeilenanfang wird beim Tippen sofort zum Punkt •
(Umschalt+Enter: nächster Punkt, Enter: Zeile ohne Punkt), `1. ` = Nummerierung (beginnt bei 1 und zählt lückenlos – „31. März“ am Zeilenanfang bleibt Text), `*fett*`, `_kursiv_`, `+unterstrichen+`, `~durchgestrichen~`.
Einfacher: Wort markieren – darüber erscheinen Knöpfe dafür (auch Strg+B, Strg+I, Strg+U). Beim Schreiben ist die Formatierung
sofort zu sehen; gespeichert wird der Text mit den Zeichen.

**Tastatur:** In der Liste ↑/↓ (Pos1/Ende) von Bedarf zu Bedarf – kompakt mit aufgeklapptem Bedarf klappen ↑/↓ gleich den nächsten auf;
Enter klappt auf (kompakt) bzw. öffnet, → öffnet, E ändert den Namen (F2 auch, außer in Vivaldi – dort öffnet F2 die Schnellbefehle), Leertaste schaltet
den Prio-Stern, Strg+F springt in die Suche (noch einmal: Suche des Browsers), Esc klappt zu. Auf der Seite eines Bedarfs öffnen ↓/↑ den nächsten
bzw. vorigen Bedarf der Liste, ← oder Esc führen zurück. In Feldern: Enter/Tab übernehmen, Esc verwirft. Im Kalender: Pfeiltasten wählen den Tag,
Bild auf/ab den Monat. Alle Tastaturbefehle: das „i“ oben rechts in der Liste oder Zahnrad → „Tastaturbefehle …“.

**Rückgängig:** „↶ Rückgängig“ in der Kopfzeile oder Strg+Z (nicht in einem Eingabefeld – dort gilt das Rückgängig des Browsers).
„Rückgängig“ im Hinweis nach Archivieren, Löschen oder Förderer-Entfernen nimmt nur diese eine Aktion zurück.

**Schutz vor Datenverlust:** Was während des Speicherns getippt wird, gilt erst als gespeichert, wenn es wirklich in der Datei steht.
Liegt im Ordner plötzlich ein leerer, älterer oder undatierter Stand (z. B. überkopiert oder von OneDrive wiederhergestellt), fragt die Liste,
statt ihn still zu übernehmen. Bei zwei Ständen wird der nicht gewählte als Sicherung heruntergeladen. Ungespeicherte Änderungen aus einer
früheren Sitzung bleiben angeboten, bis „Wiederherstellen“ oder „Verwerfen“ gewählt ist. Ist dieselbe Datei in einem zweiten Tab offen, warnt die Liste.
Bis zu 50 Schritte; Tippen im selben Feld ist ein Schritt. Nach dem Neuladen der Datei von außen beginnt die Liste von vorn.

**Spaltenbreiten:** in der Liste am rechten Rand eines Spaltenkopfs ziehen (wie in Excel) – ausführlich und kompakt getrennt, mit Mindestbreiten
(kompakt: Freigabe, Finanzierung, Nachweis und Übergabe brauchen Platz zum Aufklappen); der Browser merkt sie sich,
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
