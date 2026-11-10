/* ===================================================================== E-Mail-Auswertung mit Copilot Cowork (ab 0.143)
   Cowork läuft werktags früh als geplante Aufgabe, liest die E-Mails (Posteingang und Gesendete) und schreibt Vorschläge in eine Datei
   „Posteingang JJJJ-MM-TT.txt“ im Ordner „Förderrecherche“. Das Programm legt dafür zwei Dateien in denselben Ordner und hält sie aktuell:
   „Auftrag E-Mail-Auswertung.txt“ (was gesucht wird – aus den Einstellungen) und „Überblick für Copilot.txt“ (Bedarfe und Förderer mit Kennungen).
   Die geplante Aufgabe in Cowork enthält nur einen Satz („Lies die Auftragsdatei und führe sie aus“) – sie muss nie geändert werden.
   Beim Öffnen meldet das Programm neue Vorschläge; übernommen wird erst nach Prüfung (Haken je Vorschlag, ↶ macht alles rückgängig). */
const PE_AUFTRAG = 'Auftrag E-Mail-Auswertung.txt', PE_UEB = 'Überblick für Copilot.txt', PE_DATEI = 'Posteingang.txt', PE_RE = /^Posteingang.*\.(txt|md)$/i;   // ab 0.147 eine feste Datei, in die Copilot je Lauf einen Abschnitt anhängt (ältere Einzeldateien werden weiter gelesen)
// ab 0.157: Copilot darf ohne Rückfrage nur NEUE Dateien in seinem Arbeitsordner anlegen (OneDrive „Dokumente/Cowork“) – je Lauf eine Datei
const PE_CW = 'Dokumente/Cowork', PE_CW_RE = /^Posteingang_LAUF.*\.(txt|md)$/i, PE_CW_NAME = 'Posteingang_LAUF_JJJJ-MM-TT_HH-MM.txt';
const PE_SATZ = 'Lies die Datei „' + PE_AUFTRAG + '“ im Ordner „' + RECH_DIR + '“ (neben der Bedarfsliste) und führe den Auftrag darin vollständig aus.';
// Ort des Ordners für Copilot: OneDrive/SharePoint-Pfad, wenn die Programmdatei dort liegt (ohne Benutzernamen)
const peOrt = () => { const P = rechOrdnerOk() ? rechPfad() : { od: '' }; return P.od ? '„' + P.od + '“ (OneDrive bzw. SharePoint)' : '„' + RECH_DIR + '“ neben der Bedarfsliste'; };
const peSatz = () => 'Lies die Datei „' + PE_AUFTRAG + '“ im Ordner ' + peOrt() + ' und führe den Auftrag darin vollständig aus. Ändere keine anderen Dateien.';
// einmalige Einweisung für Copilot Cowork: Hintergrund, Zugriff prüfen, Probelauf, dann die geplante Aufgabe anlegen
function peEinweisung() {
  const heute = today();
  return ['Ich möchte mit dir eine tägliche Aufgabe einrichten. Bitte lies alles, bevor du anfängst.', '',
    'HINTERGRUND',
    'Ich bin Fundraiser bei den Maltesern (Malteser Hilfsdienst e. V., Diözese Paderborn). Meine Bedarfe (z. B. ein Fahrzeug für eine Gliederung) und die Förderer dazu pflege ich im Programm „Bedarfsliste“ (eine HTML-Datei in OneDrive). Viele Neuigkeiten dazu kommen per E-Mail – von Förderern (Eingangsbestätigung, Zusage, Absage, Nachforderung …) und von Kolleginnen und Kollegen (Freigaben, Unterlagen, Termin der Spendenübergabe, Presse, Geldeingang).',
    'Deine Aufgabe: Werktags früh meine E-Mails auswerten und die Neuigkeiten als VORSCHLÄGE in eine Textdatei schreiben. Das Programm zeigt sie mir, ich entscheide. Du trägst nichts selbst ein, schreibst keine E-Mails und änderst keine anderen Dateien.', '',
    'WO ALLES LIEGT',
    'Ordner: ' + peOrt() + '. Dort pflegt das Programm zwei Dateien:',
    '- „' + PE_AUFTRAG + '“: die genaue Anleitung und das Format der Vorschläge.',
    '- „' + PE_UEB + '“: alle Bedarfe und Förderer mit Kennungen, damit du E-Mails eindeutig zuordnen kannst.',
    'Deine Ergebnisse legst du je Lauf als NEUE Datei in deinem Arbeitsordner ab (OneDrive „' + PE_CW + '“), Name ' + PE_CW_NAME + '. In den SharePoint-Ordner schreibst du nichts – das Programm holt die Dateien dort ab, wo du sie ablegst.', '',
    'BITTE JETZT EINMAL ZUM TESTEN',
    '1. Prüfe deinen Zugriff: mein Postfach (alle Ordner) lesen, im Ordner oben lesen und in „' + PE_CW + '“ eine neue Datei anlegen. Sag mir, was davon klappt und was nicht.',
    '2. Lies beide Dateien und fasse in höchstens fünf Sätzen zusammen, was du tun sollst.',
    '3. Mach einen Probelauf für die letzten 14 Tage genau nach der Anleitung und lege ihn als Datei in „' + PE_CW + '“ ab – ausnahmsweise mit „Probelauf“ hinter der Kopfzeile und im Dateinamen.',
    '4. Nenne mir danach: wie viele Vorschläge, welche E-Mails du bewusst übersprungen hast (und warum) und wo du bei der Zuordnung unsicher warst. Stell Rückfragen, wenn etwas unklar ist.', '',
    'DANACH (erst wenn ich den Probelauf bestätigt habe)',
    'Richte eine geplante Aufgabe ein: Montag bis Freitag, 6:00 Uhr deutscher Zeit (Europe/Berlin). Auftrag der Aufgabe, wörtlich:',
    peSatz(),
    'Nenne mir zur Kontrolle die eingestellte Uhrzeit und Zeitzone.'].join('\n');
}
const PE = { laeufe: [], L: [], dateien: [], letzte: '', aufStr: '', uebStr: '', busy: false };

// Gruppen und Arten: [Schlüssel, Gruppe, Bezeichnung für das Fenster, Erklärung für Cowork]
const PE_ARTEN = [
  ['antrag', 'A', 'Antrag gestellt oder eingegangen', 'Ein Antrag wurde an den Förderer geschickt (auch in „Gesendete Elemente“), der Förderer bestätigt den Eingang oder der Antrag ist ausgewählt und kommt vor ein Gremium. Datum = Tag des Antrags bzw. der Bestätigung; Antwort bis = Termin der Entscheidung (z. B. Gremiumssitzung), falls genannt.'],
  ['zusage', 'A', 'Zusage', 'Der Förderer bewilligt bzw. sagt zu. Betrag = zugesagte Summe in Euro (Zahl). Datum = Datum der Zusage.'],
  ['absage', 'A', 'Absage', 'Der Förderer lehnt ab. Grund = Begründung in wenigen Worten, falls genannt.'],
  ['nachforderung', 'A', 'Nachforderung / Rückfrage', 'Der Förderer fordert Unterlagen nach oder fragt nach. Wert = was gebraucht wird; Datum = bis wann, falls genannt.'],
  ['nachweis', 'A', 'Frist Verwendungsnachweis', 'Frist für den Verwendungsnachweis, die Endabrechnung oder den Sachbericht (meist im Bewilligungsschreiben). Datum = Frist.'],
  ['uebergabe_foerderer', 'A', 'Förderer kommt zur Spendenübergabe', 'Der Förderer sagt die Teilnahme an der Spendenübergabe zu oder ab. Wert = ja oder nein; Person = wer vom Förderer kommt (Vor- und Nachname); Förderername = Name des Förderers.'],
  ['kontakt', 'A', 'Neue Ansprechperson beim Förderer', 'Neue oder geänderte Ansprechperson beim Förderer (nur dienstliche Angaben). Wert = „Name; Position; E-Mail; Telefon“.'],
  ['freigabe', 'B', 'Freigabe (OFK, Fachreferat, Verwaltung)', 'Intern: Ortsführungskreis stimmt zu/lehnt ab, Fachreferat gibt frei/lehnt ab, Verwaltung budgetiert/lehnt ab. Wert = ofk, fach oder verw; Ergebnis = ok oder nein; Datum = Tag der Entscheidung.'],
  ['unterlage', 'B', 'Unterlage geliefert', 'Intern: Angebot, Kostenplan, Konzept, Projektsteckbrief, Bilder o. Ä. wurden geschickt (Anhang). Wert = Name der Unterlage wie im Überblick.'],
  ['uebergabe_erfolgt', 'B', 'Spendenübergabe hat stattgefunden', 'Die Spendenübergabe bzw. der Besuch des Förderers hat stattgefunden (z. B. „Danke für Ihr Kommen heute“). Datum = Tag der Übergabe; Ort, falls genannt; Förderername = wer gespendet hat; Person = wer vom Förderer vor Ort war (Name wie in der E-Mail, z. B. die angeschriebene Person).'],
  ['uebergabe_termin', 'B', 'Termin der Spendenübergabe', 'Termin der Spendenübergabe vereinbart. Datum, Uhrzeit (HH:MM), Ort.'],
  ['presse', 'B', 'Presse und Öffentlichkeit', 'Intern: jemand aus Presse und Öffentlichkeit kommt zur Spendenübergabe, schreibt die Pressemitteilung oder stimmt sie mit dem Förderer ab. Person = Vor- und Nachname der Person aus Presse und Öffentlichkeit (nicht der Empfänger der E-Mail); Wert = kurz, was sie übernimmt (z. B. „Pressemitteilung, Entwurf an Förderer zur Abstimmung“).'],
  ['geldeingang', 'B', 'Geldeingang', 'Das Geld ist eingegangen (z. B. Meldung der Buchhaltung). Betrag in Euro, Datum des Eingangs.'],
  ['neuer_bedarf', 'C', 'Neuer Bedarf angemeldet', 'Eine Gliederung meldet einen neuen Bedarf an, der im Überblick noch fehlt. Wert = Bedarf in einem Satz mit Gliederung und Summe (nur Hinweis, wird nicht automatisch angelegt).'],
  ['fl_frist', 'C', 'Neue Frist eines Förderers', 'Ein Förderer aus der Fördererliste nennt eine neue Antragsfrist (keine Werbe-Newsletter ohne Bezug). Fördererliste = Kennung F…; Datum = Frist.'],
  ['pressemitteilung', 'C', 'Pressemitteilung erschienen', 'Die Pressemitteilung zum Bedarf ist erschienen. Datum.']];
const PE_GRUPPEN = { A: 'Von Förderern (extern)', B: 'Von den Maltesern (intern)', C: 'Zusätzlich (mehr Hinweise, mehr Rauschen)' };
const peEinst = () => { const s = D.settings.mailAusw; return Object.assign({ A: true, B: true, C: false }, isObj(s) ? s : {}); };
const peArtenAn = () => { const S = peEinst(); return PE_ARTEN.filter(a => S[a[1]]); };

/* ---------- Dateien für Cowork */
function peAuftragText() {
  const A = peArtenAn();
  return ['AUFTRAG E-MAIL-AUSWERTUNG FÜR DIE BEDARFSLISTE (Malteser, Diözese Paderborn, Fundraising)',
    'Diese Datei schreibt das Programm „Bedarfsliste“ selbst. Bitte nicht ändern.', '',
    'ZIEL: Finde in meinen E-Mails neue Informationen zu den Bedarfen und Förderern aus der Datei „' + PE_UEB + '“ (gleicher Ordner) und lege sie als Vorschläge in einer neuen Datei in deinem Arbeitsordner ab (siehe ERGEBNIS). Das Programm zeigt mir die Vorschläge; ich entscheide. Du änderst sonst nichts.', '',
    'SO GEHST DU VOR',
    '1. Lies „' + PE_UEB + '“: alle Bedarfe mit Kennung [b-…], ihre Förderer [f-…], die Fördererliste [F…], Gliederungen und Ansprechpersonen.',
    '2. Zeitraum: alle E-Mails seit dem letzten Lauf. Letzter Lauf = die jüngste Zeile „##### LAUF …“ in „' + PE_DATEI + '“ (dieser Ordner) und in allen Dateien „Posteingang_LAUF_*.txt“ in deinem OneDrive-Ordner „' + PE_CW + '“ (auch Unterordner). Gibt es keinen, die Zeile „LETZTER LAUF“ oben im Überblick, sonst die letzten 3 Tage. Durchsuche ALLE Ordner des Postfachs, in denen E-Mails liegen können: „Posteingang“, „Gesendete Elemente“, alle Unterordner und selbst angelegten Ordner (auch solche, in die Regeln oder ich E-Mails verschieben, z. B. Projekt- oder Archiv-Ordner) sowie „Gelöschte Elemente“. Nicht: Entwürfe, Junk-E-Mail, Teams-Nachrichten. Jede E-Mail nur einmal auswerten.',
    '3. Berücksichtige E-Mails, die einen Förder-Vorgang der Malteser betreffen: zuerst solche zu Bedarfen und Förderern aus dem Überblick, aber AUCH solche, deren Förderer oder Bedarf dort (noch) fehlt – z. B. eine Stiftung meldet sich zu einem Antrag, der im Überblick nicht steht. Ignoriere Newsletter, Werbung, allgemeine Rundschreiben ohne bestimmtes Vorhaben, automatische Benachrichtigungen und Kalendereinladungen ohne Inhalt.',
    '3a. Erkennen, wer schreibt: Du darfst schließen aus Absendername, Domain der E-Mail-Adresse (z. B. @ikea-stiftung.de), Signatur bzw. Fußzeile, Betreff und dem Verlauf (Antwort auf eine E-Mail, die ich geschickt habe). Steht der Förderer im Überblick unter anderem Namen, ordne ihn dort zu. Lies auch Anhänge von Förderern (PDF, Word), wenn Betrag, Frist oder Entscheidung dort stehen.',
    '4. Suche nur nach diesen Arten (Art = Schlüssel vorn):', ...A.map(a => '   - ' + a[0] + ': ' + a[3]),
    '5. Ordne jeden Vorschlag zu: Bedarf = Kennung [b-…], Förderer = Kennung [f-…] (falls der Förderer beim Bedarf schon steht), Fördererliste = [F…] (nur bei fl_frist). Ist die Zuordnung nicht eindeutig: Kennung leer lassen und Sicherheit = unsicher.',
    '5a. Fehlt der Bedarf oder der Förderer im Überblick: Kennung leer lassen und stattdessen ausfüllen – Vorhaben = das Vorhaben in wenigen Worten (z. B. „Drohne für den Bevölkerungsschutz“), Gliederung = Ort bzw. Gliederung, Förderername = vollständiger Name des Förderers (z. B. „IKEA Stiftung“). Gibt es einen passenden Bedarf, aber der Bezug ist nicht belegt: Bedarf-Kennung trotzdem eintragen und Sicherheit = unsicher. Mehrere Bewilligungen in einer E-Mail: je Bewilligung ein eigener Vorschlag.',
    '5b. Geht es um einen Förderer, nenne ihn IMMER zusätzlich in „Förderername“ – so geschrieben wie im Überblick bzw. in der Fördererliste (z. B. „Sparkasse Paderborn-Detmold-Höxter“). Eine E-Mail kann mehrere Vorschläge ergeben (z. B. Übergabe hat stattgefunden UND Presse übernimmt die Pressemitteilung): dann je ein Vorschlag.',
    '6. Steht die Information schon so im Überblick (z. B. Stand schon „zugesagt“ mit diesem Betrag), keinen Vorschlag schreiben.',
    '7. Nichts erfinden, nichts schätzen. Zitat = höchstens ein Satz aus der E-Mail, der die Information belegt. Keine weiteren Inhalte der E-Mail übernehmen, keine Bank- oder Personaldaten.', '',
    'ERGEBNIS',
    'Lege je Lauf eine NEUE Textdatei in deinem Arbeitsordner an (OneDrive „' + PE_CW + '“). Name: ' + PE_CW_NAME + ' (deutsche Zeit, Europe/Berlin). Schreibe NICHT in den SharePoint-Ordner und ändere dort keine Datei – das Programm holt die Datei selbst ab.',
    'Die Datei beginnt mit diesen zwei Zeilen (immer, auch ohne Ergebnis) – die erste genau so, ohne Zusatz dahinter:', '##### LAUF JJJJ-MM-TT HH:MM #####', 'Lauf-Ergebnis: 3 Vorschläge   (oder: Keine Vorschläge / Kein Zugriff auf E-Mails)',
    'Darunter je Vorschlag ein Block in genau diesem Aufbau:', '',
    '=== VORSCHLAG ===', 'Art: zusage', 'Bedarf: b-…', 'Förderer: f-…', 'Fördererliste: ', 'Vorhaben: ', 'Gliederung: ', 'Förderername: ', 'Datum: TT.MM.JJJJ', 'Antwort bis: ', 'Betrag: 15000', 'Uhrzeit: ', 'Ort: ', 'Wert: ', 'Ergebnis: ', 'Grund: ', 'Person: ', 'Sicherheit: sicher',
    'Mail: TT.MM.JJJJ | Absender | Betreff', 'Zitat: „…“', '',
    'Felder, die nicht passen, bleiben leer. Sicherheit = sicher oder unsicher. Beträge als Zahl ohne Punkt und ohne €.',
    'Hast du nichts gefunden: die Datei trotzdem anlegen, mit „Lauf-Ergebnis: Keine Vorschläge“ – daran sehe ich, dass du gelaufen bist. Ohne Zugriff auf mein Postfach: „Lauf-Ergebnis: Kein Zugriff auf E-Mails“.',
    'Antworte im Chat nur mit einem Satz: wie viele Vorschläge du geschrieben hast.'].join('\r\n');
}
function peUeberblickText() {
  const fr = b => frItems(b).map(i => frName(i) + ': ' + (frText(i) || i.st)).join('; ');
  const ul = b => b.unterlagen.map(u => u.name + ': ' + ulText(u)).join('; ');
  const k = c => [c.n, c.rolle || c.pos, c.mail].filter(Boolean).join(', ');
  const ll = peLetzterLauf();
  const L = ['ÜBERBLICK DER BEDARFSLISTE – Stand ' + fmtDate(today()) + ' (schreibt das Programm, bitte nicht ändern)', 'LETZTER LAUF: ' + (ll.datum ? ll.datum + (ll.zeit ? ' ' + ll.zeit : '') : '–'), 'Kennungen in eckigen Klammern in den Vorschlägen angeben.', '', 'BEDARFE'];
  for (const b of D.bedarfe.filter(x => !x.archiv || x.foerderer.some(f => f.status === 'zugesagt' && f.vn.noetig && f.vn.st !== 'erledigt'))) {
    const u = b.nach.ueb;
    L.push('[' + b.id + '] ' + (b.titel || '(ohne Namen)') + ' – Gliederung ' + (b.gliederung || '?') + (b.summe ? ' – ' + eur(b.summe).replace(/ /g, ' ') : '') + ' – Stand: ' + phaseName(phase(b)) + (b.archiv ? ' (Archiv)' : ''),
      '  Zuständig: ' + (b.zust.filter(z => z.n.trim()).map(k).join(' | ') || '–'), '  Freigabe: ' + fr(b), '  Unterlagen: ' + ul(b));
    for (const f of b.foerderer.filter(x => x.name.trim())) L.push('  Förderer [' + f.id + '] ' + f.name.trim() + ' – ' + F_ST_L[f.status] + (foeAmt(f) ? ' ' + eur(foeAmt(f)).replace(/ /g, ' ') : '') + (f.eingegangen ? ', eingegangen' : '') + (f.kontakte.some(c => c.n) ? ' – Kontakt: ' + f.kontakte.filter(c => c.n).map(k).join(' | ') : ''));
    if (u.noetig) L.push('  Spendenübergabe: ' + (u.termin ? fmtDate(u.termin) + (u.zeit ? ' ' + u.zeit : '') + (u.ort ? ', ' + u.ort : '') : 'noch kein Termin') + (u.st === 'erledigt' ? ' (erledigt)' : ''));
    L.push('');
  }
  if (D.fl && D.fl.liste.length) { L.push('FÖRDERERLISTE'); for (const e of D.fl.liste) L.push('[' + e.id + '] ' + e.name + (e.kurz ? ' (' + e.kurz + ')' : '') + (e.kontakte.some(c => c.n) ? ' – Kontakt: ' + e.kontakte.filter(c => c.n).slice(0, 3).map(k).join(' | ') : '')); }
  return L.join('\r\n');
}
// beide Dateien schreiben, wenn sich etwas geändert hat (etwa jede Minute aus der Überwachung des Ordners)
async function peSchreiben(force) {
  if (!rechOrdnerOk() || PE.busy) return false;
  const a = peAuftragText(), u = peUeberblickText(); if (!force && a === PE.aufStr && u === PE.uebStr) return true;
  PE.busy = true;
  try { const d = await rechDir(true); if (!d) return false;
    try { await d.getFileHandle(PE_DATEI); } catch (e) { const fh = await d.getFileHandle(PE_DATEI, { create: true }), w = await fh.createWritable(); await w.write(new Blob(['\ufeffPOSTEINGANG – Vorschläge von Copilot aus den E-Mails. Copilot hängt je Lauf unten einen Abschnitt an; das Programm liest ihn. Bitte nichts löschen.\r\n'], { type: 'text/plain;charset=utf-8' })); await w.close(); }
    for (const [n, t] of [[PE_AUFTRAG, a], [PE_UEB, u]]) { const fh = await d.getFileHandle(n, { create: true }), w = await fh.createWritable(); await w.write(new Blob(['﻿' + t], { type: 'text/plain;charset=utf-8' })); await w.close(); }
    PE.aufStr = a; PE.uebStr = u; return true;
  } catch (e) { console.warn(e); return false; } finally { PE.busy = false; }
}

/* ---------- Vorschläge lesen */
function peLesen(text, datei) {
  const L = [];
  for (const block of String(text || '').replace(/\r/g, '').split(/^\s*=+\s*VORSCHLAG\s*=+\s*$/im).slice(1)) {
    const o = { datei }; for (const z of block.split('\n')) { const m = z.match(/^\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß -]{0,30}?)\s*:\s*(.*)$/); if (m) o[norm(m[1]).replace(/[^a-zäöüß]/g, '')] = m[2].trim(); }
    o.art = norm(o.art || '').replace(/[^a-z_]/g, ''); if (!o.art) continue;
    for (const k of ['bedarf', 'forderer', 'förderer', 'fordererliste', 'fördererliste']) if (o[k]) o[k] = o[k].replace(/[[\]\s]/g, '');
    o.foerderer = o['förderer'] || o.forderer || ''; o.fl = o['fördererliste'] || o.fordererliste || ''; o.fname = o['förderername'] || o.forderername || ''; o.antwortbis = o.antwortbis || '';
    L.push(o);
  }
  return L;
}
const peDatum = t => { const m = String(t || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? m[3] + '-' + z2(m[2]) + '-' + z2(m[1]) : validIso(t) ? t : ''; };
const peBetrag = t => { const s = String(t || '').replace(/[^\d,.-]/g, ''); if (!s) return null; const v = +s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); return isFinite(v) && v > 0 ? v : null; };
const peErledigt = () => Array.isArray(D.settings.mailErledigt) ? D.settings.mailErledigt : [];
const peEnt = () => isObj(D.settings.mailEnt) ? D.settings.mailEnt : {};      // gemerkte Entscheidungen (später, Zuordnung) je Vorschlag
// je Vorschlag eine feste Kennung (Datei und Stand + Nummer); erledigt sind übernommene und verworfene Vorschläge sowie leere Dateien
async function peScan() {
  if (!rechOrdnerOk() || PE.busy) return;
  const d = await rechDir(); if (!d) return;
  const F = [], erl = new Set(peErledigt()); let letzte = '';
  try { for await (const [n, e] of d.entries()) { if (e.kind !== 'file' || !PE_RE.test(n)) continue; const f = await e.getFile(), k = n + '@' + f.lastModified; if (n > letzte) letzte = n; if (n.toLowerCase() === PE_DATEI.toLowerCase() || !erl.has(k)) F.push({ n, k, f }); } } catch (e) { return; }
  PE.letzte = letzte;
  const L = [], leer = [], laeufe = []; let fest = null;
  for (const x of F.sort((a, c) => a.n.localeCompare(c.n))) {
    const text = await x.f.text();
    if (x.n.toLowerCase() === PE_DATEI.toLowerCase()) { const v0 = laeufe.length; peLaeufeLesen(text, x.n, laeufe, L, erl); fest = new Set(laeufe.slice(v0).map(peLaufK)); continue; }   // feste Datei: Abschnitte „##### LAUF …“, Kennung je Lauf
    const V = peLesen(text, x.n), dm = x.n.match(/(\d{4}-\d{2}-\d{2})/); laeufe.push({ datum: dm ? dm[1] : '', zeit: '', erg: V.length ? V.length + ' Vorschläge' : (/kein zugriff/i.test(text) ? 'Kein Zugriff auf E-Mails' : 'Keine Vorschläge'), n: V.length, alt: true });
    if (!V.length) { leer.push(x.k); continue; } V.forEach((v, i) => { v.key = x.k + '#' + i; if (!erl.has(v.key)) L.push(v); });
  }
  // ab 0.157: je Lauf eine Datei aus dem Arbeitsordner von Copilot (OneDrive „Dokumente/Cowork“) – derselbe Lauf zählt nur einmal
  const CW = await peCoworkDateien(), neuFest = [];
  for (const x of CW) { let text = ''; try { text = await peTextLesen(x.f); } catch (e) { continue; }
    if (!/#{3,}\s*LAUF\s+\d{4}-\d{2}-\d{2}/.test(text)) continue;                  // noch nicht fertig übertragen: beim nächsten Mal wieder
    const vorher = laeufe.length; peLaeufeLesen(text, x.n, laeufe, L, erl);
    if (fest && laeufe.slice(vorher).some(l => !fest.has(peLaufK(l)))) { neuFest.push(text.replace(/^\ufeff/, '').replace(/\r/g, '').trim()); laeufe.slice(vorher).forEach(l => fest.add(peLaufK(l))); } }
  if (neuFest.length) peAnhaengen(neuFest);                                       // Verlauf bleibt an einem Ort: unverändert unten an „Posteingang.txt“
  const ges = new Set(), gesV = new Set();
  laeufe.splice(0, laeufe.length, ...laeufe.filter(l => { const k = peLaufK(l); if (ges.has(k)) return false; ges.add(k); return true; }));
  L.splice(0, L.length, ...L.filter(v => { if (gesV.has(v.key)) return false; gesV.add(v.key); return true; }));
  PE.laeufe = laeufe.filter(l => l.datum).sort((a, c) => (a.datum + a.zeit).localeCompare(c.datum + c.zeit));
  if (leer.length) { D.settings.mailErledigt = peErledigt().concat(leer).slice(-400); changed(); }   // „Keine Vorschläge“: gleich als gesehen merken
  PE.L = L; PE.dateien = F.filter(x => x.n.toLowerCase() !== PE_DATEI.toLowerCase()).map(x => x.k);
  const sig = L.map(v => v.key).join() + '|' + peLetzterLauf().datum + peLetzterLauf().zeit; if (sig !== PE.sig) { PE.sig = sig; safeRender(); }
}

// Abschnitte „##### LAUF JJJJ-MM-TT HH:MM #####“ einer Datei lesen (Posteingang.txt oder je Lauf eine Datei von Copilot); UTF-8 mit/ohne BOM, LF oder CRLF
function peLaeufeLesen(text, n, laeufe, L, erl) {
  for (const t of String(text).replace(/^\ufeff/, '').replace(/\r/g, '').split(/^(?=#{3,}\s*LAUF\b)/m)) {
    const m = t.match(/^#{3,}\s*LAUF\s+(\d{4}-\d{2}-\d{2})(?:[ T_]+(\d{1,2})[:\-.](\d{2}))?([^\n]*)/); if (!m) continue;
    const zeit = m[2] ? m[2] + ':' + m[3] : '', probe = /probe/i.test(m[4]);
    const erg = (t.match(/^\s*Lauf-Ergebnis\s*:\s*(.*)$/mi) || [])[1] || '', V = peLesen(t, n), lk = 'L' + m[1] + ' ' + zeit + (probe ? ' P' : '');
    laeufe.push({ datum: m[1], zeit, probe, erg: erg.trim() || (V.length ? V.length + ' Vorschläge' : 'Keine Vorschläge'), n: V.length });
    V.forEach((v, i) => { v.key = lk + '#' + i; if (!erl.has(v.key)) L.push(v); });
  }
}
const peLaufK = l => l.datum + ' ' + l.zeit + (l.probe ? ' P' : '');
async function peAnhaengen(T) {
  if (PE.anh) return; PE.anh = true;
  try { const d = await rechDir(); if (!d) return; const fh = await d.getFileHandle(PE_DATEI), alt = await (await fh.getFile()).text();
    const w = await fh.createWritable(); await w.write(new Blob([alt.replace(/\s+$/, '') + '\r\n\r\n' + T.join('\r\n\r\n').replace(/\r?\n/g, '\r\n') + '\r\n'], { type: 'text/plain;charset=utf-8' })); await w.close();
  } catch (e) { console.warn(e); } finally { PE.anh = false; }
}
// Text einer Datei: UTF-8 (mit/ohne BOM) oder UTF-16 (BOM FF FE / FE FF)
async function peTextLesen(f) {
  const u = new Uint8Array(await f.arrayBuffer());
  if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder('utf-16le').decode(u.subarray(2));
  if (u[0] === 0xfe && u[1] === 0xff) return new TextDecoder('utf-16be').decode(u.subarray(2));
  return new TextDecoder('utf-8').decode(u).replace(/^\ufeff/, '');
}
// Arbeitsordner von Copilot (über OneDrive auf dem PC): einmal verbinden, der Verweis liegt im Browser (IndexedDB)
const peCwKey = () => 'cowork:' + (localPath() || location.href);
async function peCoworkVerbinden() {
  let d; try { d = await window.showDirectoryPicker({ id: 'cowork', mode: 'read', startIn: 'documents' }); } catch (e) { return false; }
  await idbSet(peCwKey(), d); PE.cw = d; PE.cwZ = 'ok'; D.settings.coworkOrdner = d.name; changed(); await peScan(); renderNow(); return true;
}
async function peCoworkErlauben() {
  try { if (PE.cw && await PE.cw.requestPermission({ mode: 'read' }) === 'granted') { PE.cwZ = 'ok'; await peScan(); renderNow(); } } catch (e) { console.warn(e); }
}
async function peCoworkDateien() {
  if (!D.settings.coworkOrdner) { PE.cwZ = ''; return []; }
  if (PE.cw === undefined) PE.cw = await idbGet(peCwKey());
  if (!PE.cw) { PE.cwZ = 'fehlt'; return []; }
  let p = 'prompt'; try { p = await PE.cw.queryPermission({ mode: 'read' }); } catch (e) { /* */ }
  const z = p === 'granted' ? 'ok' : 'zugriff'; if (z !== PE.cwZ) { PE.cwZ = z; safeRender(); } if (z !== 'ok') return [];
  const R = [], erl = new Set(peErledigt());
  const lauf = async (dir, tiefe) => { try { for await (const [n, e] of dir.entries()) {
    if (e.kind === 'directory' && tiefe < 7) await lauf(e, tiefe + 1);                 // z. B. Cowork/Tasks/<Aufgabe>/output/
    else if (e.kind === 'file' && PE_CW_RE.test(n)) { const f = await e.getFile(); R.push({ n, f, k: 'cw:' + n + '@' + f.lastModified }); } } } catch (e) { console.warn(e); } };
  await lauf(PE.cw, 0); PE.cwInfo = { n: R.length, letzte: R.map(x => x.n).sort().pop() || '', am: new Date() }; return R.sort((a, c) => a.n.localeCompare(c.n));
}
// Hinweis oben: der Ordner ist verbunden, der Browser will die Freigabe neu (geht nur per Klick)
const peCwChip = () => PE.cwZ === 'zugriff' ? `<button class="pe-stat warn" data-act="pe-cw-erlauben" title="Der Browser fragt nach dem Neustart wieder nach – einmal klicken und „Zulassen“ (bei „Bei jedem Besuch zulassen“ entfällt das)">${PE_MAIL_SVG}<span>Copilot-Ergebnisse freigeben</span></button>`
  : PE.cwZ === 'fehlt' ? `<button class="pe-stat warn" data-act="einst" title="Der Cowork-Ordner ist in diesem Browser nicht verbunden – Einstellungen → E-Mail-Auswertung">${PE_MAIL_SVG}<span>Cowork-Ordner verbinden</span></button>` : '';

/* ---------- Was ein Vorschlag im Programm ändert: wo (Bereich, Förderer), bisher → neu, Ton der neuen Angabe, die Änderung selbst */
const PE_ST_TON = { zugesagt: 't-ok', beantragt: 't-run', abgelehnt: 't-err', geplant: 't-neu' };
function peWirkung(v, zu = {}) {
  const bid = zu.bedarf || v.bedarf; let b = D.bedarfe.find(x => x.id === bid);
  if (!b && bid === '__neu') b = peNeuerBedarf(v);                                // neuer Bedarf aus dem Vorhaben in der E-Mail – angelegt erst beim Übernehmen
  const fid = zu.foerderer || v.foerderer || (peIstNeu(b) ? '__neu' : '');
  let f = b && fid && fid !== '__neu' ? b.foerderer.find(x => x.id === fid) : null;
  if (b && !f && fid === '__neu' && v.fname) f = b.foerderer.find(x => norm(x.name) === norm(v.fname)) || null;   // derselbe neue Förderer aus einem anderen Vorschlag
  if (b && !f && v.fname && !/^fl:/.test(fid)) f = peFoerdererIn(b, v.fname);                       // Förderer schon beim Bedarf (Name, Kurzname, Eintrag der Fördererliste)
  const flE = /^fl:/.test(fid) && D.fl ? D.fl.liste.find(e => e.id === fid.slice(3)) : null;   // im Prüffenster gewählter Eintrag der Fördererliste
  if (flE) f = b && b.foerderer.find(x => x.flId === flE.id || kkey(x.name) === kkey(flE.name)) || null;
  const neuF = b && (fid === '__neu' || !!flE || (!fid && v.fname && peIstNeu(b))) && !f, fNeu = () => peFoerdererNeu(b, flE ? Object.assign({}, v, { fname: flE.name }) : v);
  const F = () => { peBedarfAnlegen(b); return f || (neuF ? (f = fNeu()) : null); };
  const d = peDatum(v.datum), betrag = peBetrag(v.betrag), A = PE_ARTEN.find(a => a[0] === v.art);
  const r = { b, f, art: A ? A[2] : v.art, bereich: 'Förderplan', vorher: '', nachher: '', ton: 't-neu', ok: false, schon: false, fn: null, brauchtF: false };
  const fs = x => x ? F_ST_L[x.status] + (foeAmt(x) ? ' · ' + eur(foeAmt(x)) : '') + (x.status === 'beantragt' && x.beantragtAm ? ' · seit ' + fmtDate(x.beantragtAm) : '') : (neuF ? 'neuer Förderer' : '–');
  const mitF = (neu, extra, nachher, ton) => { r.brauchtF = true; r.ok = !!(f || neuF); r.vorher = fs(f); r.nachher = nachher; r.ton = ton || PE_ST_TON[neu] || 't-neu';
    r.fn = () => { const x = F(); const alt = x.status; if (neu && alt !== neu) { x.status = neu; effects(b, x, 'status', neu, alt); } if (extra) extra(x); }; };
  switch (v.art) {
    case 'antrag': { const e = peDatum(v.antwortbis) || peDatum(v.wert); mitF('beantragt', x => { if (d) x.beantragtAm = d; if (e) x.erwartet = e; }, 'beantragt' + (d ? ' am ' + fmtDate(d) : '') + (e ? ' · Entscheidung bis ' + fmtDate(e) : '')); r.schon = !!f && (['zugesagt', 'abgelehnt'].includes(f.status) || (f.status === 'beantragt' && (!e || f.erwartet === e))); break; }
    case 'zusage': mitF('zugesagt', x => { if (betrag) x.zugesagt = betrag; if (d) x.entscheidungAm = d; }, 'zugesagt' + (betrag ? ' · ' + eur(betrag) : '') + (d ? ' · am ' + fmtDate(d) : '')); r.schon = !!f && f.status === 'zugesagt' && (!betrag || +foeAmt(f) === betrag); break;
    case 'absage': mitF('abgelehnt', x => { if (v.grund) x.grund = v.grund; if (d) x.entscheidungAm = d; }, 'abgelehnt' + (v.grund ? ' · Grund: ' + v.grund : '')); r.schon = !!f && f.status === 'abgelehnt'; break;
    case 'nachforderung': mitF('', x => { x.notiz = (x.notiz ? x.notiz.trim() + '\n' : '') + '* Nachforderung ' + fmtDate(today()) + ': ' + (v.wert || 'siehe E-Mail') + (d ? ' – bis ' + fmtDate(d) : ''); if (d && x.status === 'beantragt') x.erwartet = d; }, 'Nachforderung: ' + (v.wert || 'siehe E-Mail') + (d ? ' · bis ' + fmtDate(d) : ''), 't-neu'); r.vorher = 'Notizen: –'; break;
    case 'nachweis': mitF('', x => { x.vn.noetig = true; x.vn.frist = d; }, 'Verwendungsnachweis bis ' + (d ? fmtDate(d) : '?'), 't-neu'); r.vorher = f && f.vn.frist ? 'Verwendungsnachweis bis ' + fmtDate(f.vn.frist) : 'Verwendungsnachweis: keine Frist'; r.ok = r.ok && !!d; r.schon = !!f && f.vn.frist === d; break;
    case 'uebergabe_foerderer': { const ja = /^j/i.test(v.wert || ''), alt = f && ((b.nach.ueb.einl || {})[f.id] || {}).zu; r.bereich = 'Nacharbeit › Spendenübergabe';
      mitF('', x => { const E = b.nach.ueb.einl = Object.assign({}, b.nach.ueb.einl); E[x.id] = Object.assign({}, E[x.id], { zu: ja ? 'ja' : 'nein' }); if (ja && !b.nach.ueb.mit.includes(x.id)) b.nach.ueb.mit.push(x.id); if (ja && v.person) peVorOrt(b, x, v.person); }, (ja ? 'kommt' : 'kommt nicht') + (v.person ? ' · ' + v.person : ''), ja ? 't-ok' : 't-err');
      r.vorher = alt === 'ja' ? 'kommt' : alt === 'nein' ? 'kommt nicht' : 'Teilnahme offen'; r.schon = !!f && alt === (ja ? 'ja' : 'nein'); break; }
    case 'kontakt': { const c = kontaktAusText(v.wert || v.person || ''); r.bereich = 'Förderplan'; mitF('', x => { if (x.kontakte.length < MAX_KONTAKTE) x.kontakte.push(c); else x.notiz = (x.notiz ? x.notiz.trim() + '\n' : '') + '* Kontakt: ' + kontaktText(c); }, '+ ' + [c.n, c.rolle, c.mail, c.tel].filter(Boolean).join(' · '), 't-neu');
      r.vorher = f && f.kontakte.some(x => x.n) ? f.kontakte.filter(x => x.n).map(x => x.n).join(', ') : 'kein Kontakt'; r.ok = r.ok && !!c.n; r.schon = !!f && (f.kontakte.some(x => kGleich(x, c)) || (flAktiv() && flVon(f) && flVon(f).kontakte.some(x => kGleich(x, c)))); break; }
    case 'freigabe': { const k = /verw/i.test(v.wert) ? 'verw' : /fach/i.test(v.wert) ? 'fach' : /ofk|orts/i.test(v.wert) ? 'ofk' : '', ja = !/nein|ab/i.test(v.ergebnis || ''), st = ja ? 'ok' : 'nein', it = b && k ? frItems(b).find(i => i.k === k) : null;
      r.bereich = 'Freigabe'; r.vorher = it ? frName(it) + ': ' + (frText(it) || it.st) : '–'; r.nachher = (it ? frName(it) : 'Freigabe') + ': ' + (k ? FR_DEF[k][st] : ja ? 'zugestimmt' : 'abgelehnt') + (d ? ' am ' + fmtDate(d) : ''); r.ton = ja ? 't-ok' : 't-err';
      r.ok = !!b && !!k; r.schon = !!b && !!k && b.freigabe[k].st === st; r.fn = () => { const i2 = b.freigabe[k], alt = i2.st; i2.st = st; effects(b, b, 'freigabe.' + k + '.st', st, alt); if (d) i2.erledigt = d; }; break; }
    case 'unterlage': { const u = b && b.unterlagen.find(x => norm(x.name) === norm(v.wert) || norm(v.wert || '').includes(norm(x.name))); r.bereich = 'Unterlagen';
      r.vorher = u ? u.name + ': ' + ulText(u) : (v.wert || 'Unterlage') + ': noch nicht in der Liste'; r.nachher = (u ? u.name : v.wert || 'Unterlage') + ': ' + (u ? (ulOpts(u).find(o => o[0] === 'da') || [, 'liegt vor'])[1] : 'vorhanden'); r.ton = 't-ok';
      r.ok = !!b && !!(u || v.wert); r.schon = !!u && u.st === 'da'; r.fn = () => { if (u) u.st = 'da'; else b.unterlagen.push(UL(v.wert, 'da')); }; break; }
    case 'uebergabe_termin': { const u = b && b.nach.ueb; r.bereich = 'Nacharbeit › Spendenübergabe'; r.vorher = u && u.termin ? fmtDate(u.termin) + (u.zeit ? ' · ' + u.zeit + ' Uhr' : '') + (u.ort ? ' · ' + u.ort : '') : 'noch kein Termin';
      r.nachher = (d ? fmtDate(d) : '?') + (v.uhrzeit ? ' · ' + v.uhrzeit + ' Uhr' : '') + (v.ort ? ' · ' + v.ort : ''); r.ok = !!b && !!d; r.schon = !!u && u.termin === d && (!v.ort || u.ort === v.ort);
      r.fn = () => { const w = b.nach.ueb; w.noetig = true; w.termin = d; if (v.uhrzeit) w.zeit = v.uhrzeit; if (v.ort) w.ort = v.ort; if (w.st === 'offen') w.st = 'terminiert'; }; break; }
    case 'uebergabe_erfolgt': { const u = b && b.nach.ueb; r.bereich = 'Nacharbeit › Spendenübergabe';
      r.vorher = u ? (u.st === 'erledigt' ? 'erledigt' : u.termin ? 'terminiert · ' + fmtDate(u.termin) : 'offen') + (f && (u.vorOrt || {})[f.id] && u.vorOrt[f.id].n ? ' · vor Ort: ' + u.vorOrt[f.id].n : '') : '–';
      r.nachher = 'erledigt' + (d ? ' am ' + fmtDate(d) : '') + (v.ort ? ' · ' + v.ort : '') + (v.person ? ' · vor Ort: ' + v.person : '') + (v.fname ? ' (' + (f ? f.name.trim() : v.fname) + ')' : ''); r.ton = 't-ok';
      r.ok = !!b; r.schon = !!u && u.st === 'erledigt' && (!d || u.termin === d);
      r.fn = () => { const w = b.nach.ueb, x = f || (v.fname ? F() : null); w.noetig = true; if (d) w.termin = d; if (v.ort && !w.ort) w.ort = v.ort; w.st = 'erledigt';
        if (x) { const E = w.einl = Object.assign({}, w.einl); E[x.id] = Object.assign({}, E[x.id], { zu: 'ja' }); if (!w.mit.includes(x.id)) w.mit.push(x.id); if (v.person) peVorOrt(b, x, v.person); } }; break; }
    case 'presse': { const G = b ? grpZeig(b, 'presse').Z : [], pp = v.person ? G.find(p => kkey(p.n) === kkey(v.person) || norm(p.n).split(' ').pop() === norm(v.person).split(' ').pop()) : null, W = b ? (GRP.presse.obj(b).wahl || []) : [];
      r.bereich = 'Nacharbeit › Presse und Öffentlichkeit'; r.vorher = b ? 'dabei: ' + (presseGewaehlt(b).map(p => p.n).join(', ') || 'noch offen') : '–';
      r.nachher = (pp ? pp.n + ' ist dabei' : v.person ? v.person + ' (nicht in der Liste „Presse und Öffentlichkeit“)' : 'Presse') + (v.wert ? ' · ' + v.wert : ''); r.ton = pp ? 't-ok' : 't-neu'; r.ok = !!b;
      r.schon = !!pp && W.includes(kkey(pp.n)) && !v.wert;
      r.fn = () => { const P = GRP.presse.obj(b); if (pp) { P.wahl = uniq([...(P.wahl || []), kkey(pp.n)]); }
        if (v.wert || !pp) { const u = b.nach.ueb, z = '* Presse: ' + [pp ? pp.n : v.person, v.wert].filter(Boolean).join(' – '); if (!(u.info || '').includes(z)) u.info = (u.info ? u.info.trim() + '\n' : '') + z; } }; break; }
    case 'geldeingang': mitF('zugesagt', x => { if (x.zugesagt == null) x.zugesagt = betrag; x.eingegangen = betrag; x.eingangAm = d || today(); }, 'eingegangen' + (betrag ? ' · ' + eur(betrag) : '') + (d ? ' · am ' + fmtDate(d) : ''), 't-ok');
      r.ok = r.ok && !!betrag; r.schon = !!f && +f.eingegangen === betrag; break;
    case 'pressemitteilung': r.bereich = 'Nacharbeit'; r.vorher = b ? 'Pressemitteilung: ' + (b.nach.pm.st === 'erledigt' ? 'erschienen' : 'offen') : '–'; r.nachher = 'erschienen' + (d ? ' am ' + fmtDate(d) : ''); r.ton = 't-ok'; r.ok = !!b; r.schon = !!b && b.nach.pm.st === 'erledigt'; r.fn = () => { b.nach.pm.st = 'erledigt'; if (d) b.nach.pm.datum = d; }; break;
    case 'fl_frist': { const e = flAktiv() && flEintrag(v.fl); r.bereich = 'Fördererliste'; r.fl = e; r.vorher = e ? (e.fristenL.length ? e.fristenL.map(x => fristText(x.d)).join(', ') : 'keine Frist') : '–'; r.nachher = 'Frist ' + (d ? fmtDate(d) : '?'); r.ok = !!e && !!d; r.schon = !!e && e.fristenL.some(x => x.d === d);
      r.fn = () => { e.fristenL.push({ id: uid('fr'), d, topf: e.topfe.length ? e.topfe[0].name : '' }); }; break; }
    case 'neuer_bedarf': r.bereich = 'Neuer Bedarf'; r.nachher = v.wert || '?'; r.info = 'Neuer Bedarf – über den KI-Knopf „Bedarf aus Daten erstellen“ anlegen.'; break;
    default: r.nachher = v.wert || v.art;
  }
  if (peIstNeu(b) && r.fn) { const fn0 = r.fn; r.fn = () => { peBedarfAnlegen(b); fn0(); peMitFoerderer(b, v); }; r.ok = r.ok || !!r.fn; }
  return r;
}
// wer vom Förderer bei der Übergabe vor Ort ist: passender Kontakt (Name, sonst Nachname), sonst nur der Name
function peVorOrt(b, f, person) {
  const K = foeKontakte(b, f), nn = s => norm(String(s || '').replace(/^(herr|frau)\s+/i, '')).split(' ').pop();
  const c = K.find(k => kkey(k.n) === kkey(person)) || K.find(k => k.n && nn(k.n) === nn(person));
  const V = b.nach.ueb.vorOrt = Object.assign({}, b.nach.ueb.vorOrt); V[f.id] = c ? { n: c.n.trim(), mail: (c.mail || '').trim(), pos: (c.rolle || '').trim() } : { n: String(person).replace(/^(Herr|Frau)\s+/, '').trim(), mail: '', pos: '' };
}
// Förderer beim Bedarf zum Namen aus der E-Mail: gleicher Name, Kurzname oder derselbe Eintrag der Fördererliste
function peFoerdererIn(b, name) {
  const k = kkey(name), e = flAktiv() ? flVonName(name) : null;
  return b.foerderer.find(f => f.name.trim() && (kkey(f.name) === k || (e && (f.flId === e.id || kkey(f.name) === kkey(e.name) || (e.kurz && kkey(f.name) === kkey(e.kurz)))))) || null;
}
// neuer Förderer im Bedarf: Name wie in der Fördererliste (dann verknüpft), sonst aus der E-Mail; Stand passend zur Art
function peFoerdererNeu(b, v) {
  const e = flAktiv() && v.fname ? flVonName(v.fname) : null, st = /^(zusage|geldeingang|uebergabe_|nachweis)/.test(v.art) ? 'zugesagt' : v.art === 'absage' ? 'abgelehnt' : v.art === 'antrag' ? 'beantragt' : 'geplant';
  const n = ff({ name: e ? e.name : (v.fname || String(v.mail || '').split('|')[1] || 'Neuer Förderer').trim(), status: st, flId: e ? e.id : '' });
  b.foerderer.push(n); return n;
}
// neuer Bedarf aus dem Vorhaben einer E-Mail: vorläufig (je Vorhaben einer, auch für mehrere Vorschläge), erst beim Übernehmen in die Liste
const PE_NEU = {};
function peNeuerBedarf(v) {
  const k = norm((v.vorhaben || v.fname || 'neu') + '|' + (v.gliederung || '')); if (PE_NEU[k]) return PE_NEU[k];
  const gl = v.gliederung ? (GL_LIST.find(g => norm(v.gliederung).includes(norm(g))) || (istDio(v.gliederung) ? DIO : v.gliederung.trim())) : '';
  const b = Object.assign(blank(), { titel: (v.vorhaben || 'Neuer Bedarf' + (v.fname ? ' (' + v.fname + ')' : '')).trim(), gliederung: gl }); PE_NEU_B.add(b); return (PE_NEU[k] = b);
}
const PE_NEU_B = new WeakSet(), peIstNeu = b => !!b && PE_NEU_B.has(b) && !D.bedarfe.includes(b);
function peBedarfAnlegen(b) { if (peIstNeu(b)) D.bedarfe.push(b); }
// beim Übernehmen in einen neuen Bedarf: den genannten Förderer gleich mit anlegen (auch bei Übergabe, Presse …)
const peMitFoerderer = (b, v) => { if (b && v.fname && !peFoerdererIn(b, v.fname)) peFoerdererNeu(b, v); };
// Art des Vorschlags für die Darstellung: info (steht schon so drin / nur Hinweis), unassigned (Bedarf oder Förderer fehlt), sicher, unsicher
const peKind = (v, w) => w.info || (w.schon && w.ok) ? 'info' : !w.b && !w.fl ? 'unassigned' : !w.ok && w.brauchtF && !w.f ? 'unassigned' : norm(v.sicherheit) === 'unsicher' || !w.ok ? 'unsicher' : 'sicher';

// Suchfeld mit Liste (statt Auswahlliste): leer = alle Einträge zum Blättern; Wörter filtern Titel und Zusatz (Gliederung, Förderer); Enter wählt den ersten
function peSuchfeld(OPT, wert, waehle, o = {}) {
  const akt0 = OPT.find(x => x.v === wert), akt = akt0 && Object.assign({}, akt0, { t: o.anzeige || akt0.t });
  const inp = h('input', { type: 'text', class: 'pe2-sf-in' + (o.warn ? ' warn' : '') + (akt ? ' gesetzt' : ''), placeholder: o.ph || 'Suchen …', value: akt ? akt.t : '', 'aria-label': o.label || 'Bedarf suchen', autocomplete: 'off', spellcheck: 'false' });
  const liste = h('div', { class: 'pe2-sf-l', role: 'listbox', hidden: true }), wrap = h('div', { class: 'pe2-sf' }, h('div', { class: 'pe2-sf-z' }, inp, akt && o.notiz ? h('span', { class: 'pe2-sf-notiz', title: o.notizTitel || '' }, o.notiz) : null), liste);
  let L = [], i0 = 0;
  const zeig = () => { const q = norm(inp.value === (akt && akt.t) ? '' : inp.value).split(/\s+/).filter(Boolean);
    L = OPT.filter(x => x.neu || q.every(w => norm(x.t + ' ' + (x.s || '')).includes(w))); i0 = L.length > 1 && q.length ? 1 : 0;
    if (q.length && L.length === 1) i0 = 0;
    liste.replaceChildren(...L.map((x, i) => { const r = h('div', { class: 'pe2-sf-o' + (x.neu ? ' neu' : '') + (i === i0 ? ' an' : '') + (x.v === wert ? ' gew' : ''), role: 'option' }, h('b', null, x.t), x.s ? h('span', null, x.s) : null);
      r.addEventListener('mousedown', e => { e.preventDefault(); waehle(x.v); }); return r; }),
      ...(q.length && L.length <= 1 ? [h('div', { class: 'pe2-sf-leer' }, o.leer || 'Kein Bedarf gefunden – oben neu anlegen.')] : []));
    liste.hidden = false; };
  inp.addEventListener('focus', () => { inp.select(); zeig(); });
  inp.addEventListener('input', zeig);
  inp.addEventListener('blur', () => setTimeout(() => { liste.hidden = true; if (akt) inp.value = akt.t; }, 120));
  inp.addEventListener('keydown', e => { e.stopPropagation();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); i0 = Math.max(0, Math.min(L.length - 1, i0 + (e.key === 'ArrowDown' ? 1 : -1))); [...liste.querySelectorAll('.pe2-sf-o')].forEach((r, i) => { r.classList.toggle('an', i === i0); if (i === i0) r.scrollIntoView({ block: 'nearest' }); }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (L[i0]) waehle(L[i0].v); }
    else if (e.key === 'Escape') { e.preventDefault(); inp.blur(); } });
  return wrap;
}
/* ---------- Hinweis oben und Prüffenster (Entwurf „1c“: links die Vorschläge, rechts Belegstelle und „bisher → neu“) */
const PE_MAIL_SVG = '<svg width="15" height="12" viewBox="0 0 15 12" aria-hidden="true"><rect x="1" y="1" width="13" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 1.8l6 4.6 6-4.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const peLetzterLauf = () => (PE.laeufe || []).filter(l => !l.probe).slice(-1)[0] || (PE.laeufe || []).slice(-1)[0] || { datum: '', zeit: '' };
// Werktage seit dem letzten Lauf (Wochenende zählt nicht): ab 2 fehlt ein Lauf
function peWerktageSeit(iso) { if (!iso) return 99; let n = 0; const d = new Date(iso + 'T12:00'), h = new Date(today() + 'T12:00'); while (d < h) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n++; } return n; }
function peStatusChip() {
  const l = peLetzterLauf(); if (!l.datum) return '';
  const alt = peWerktageSeit(l.datum) >= 2, wann = l.datum === today() ? 'heute' + (l.zeit ? ' ' + l.zeit : '') : fmtDate(l.datum).slice(0, 6) + (l.zeit ? ' ' + l.zeit : ''), ohne = /kein zugriff/i.test(l.erg);
  return `<button class="pe-stat${alt || ohne ? ' warn' : ''}" data-act="pe-laeufe" title="${esc(alt ? 'Copilot hat seit dem ' + fmtDate(l.datum) + ' nicht mehr geprüft – geplante Aufgabe in Cowork kontrollieren' : 'Copilot hat die E-Mails geprüft: ' + l.erg)}">${PE_MAIL_SVG}<span>${alt ? 'zuletzt geprüft ' + wann : ohne ? 'kein Zugriff auf E-Mails' : 'geprüft ' + wann}</span>${alt || ohne ? '' : '<span class="pe-stat-ok">✓</span>'}</button>`;
}
function peLaeufePop(btn) {
  closeMenus();
  const L = (PE.laeufe || []).slice(-10).reverse();
  placePop(h('div', { class: 'menu pe-laeufe', role: 'dialog', 'aria-label': 'Läufe von Copilot' }, h('div', { class: 'menu-kopf' }, 'E-Mail-Auswertung – letzte Läufe'),
    ...(L.length ? L.map(l => h('div', { class: 'pe-lz' }, h('span', null, fmtDate(l.datum) + (l.zeit ? ' · ' + l.zeit : '') + (l.probe ? ' · Probelauf' : '')), h('span', { class: /kein zugriff/i.test(l.erg) ? 'warn' : '' }, l.erg))) : [h('div', { class: 'pe-lz muted' }, 'Noch kein Lauf.')]),
    h('div', { class: 'pe-lfuss muted small' }, peWerktageSeit(peLetzterLauf().datum) >= 2 ? 'Seit mehr als einem Werktag kein Lauf – bitte die geplante Aufgabe in Copilot Cowork prüfen.' : 'Copilot läuft werktags früh; neue Vorschläge erscheinen hier oben.')), btn, 'right');
}
const peChip = () => peCwChip() + peChipV();
function peChipV() {
  if (!PE.L.length) return peStatusChip();
  const E = peEnt(), W = PE.L.map(v => ({ v, w: peWirkung(v, E[v.key] || {}) })).filter(x => peKind(x.v, x.w) !== 'info');
  if (!W.length) return `<button class="pe-chip" data-act="pe-oeffnen">${PE_MAIL_SVG}<span>${PE.L.length} ${PE.L.length === 1 ? 'Hinweis' : 'Hinweise'} aus E-Mails</span></button>`;
  const spaeter = W.every(x => (E[x.v.key] || {}).d === 'later'), uns = W.filter(x => ['unsicher', 'unassigned'].includes(peKind(x.v, x.w))).length;
  return `<button class="pe-chip" data-act="pe-oeffnen" title="Copilot hat in deinen E-Mails neue Informationen gefunden – prüfen und übernehmen">${PE_MAIL_SVG}<span>${W.length} ${W.length === 1 ? 'Vorschlag' : 'Vorschläge'} ${spaeter ? 'für später' : 'aus E-Mails'}</span>${!spaeter && uns ? `<span class="pe-chip-sub">${uns} unsicher</span>` : ''}</button>`;
}
const PE_ICON = { sicher: '✓', unsicher: '!', unassigned: '?', info: '=' }, PE_DL = { accept: 'übernehmen', reject: 'verworfen', later: 'später' };
async function peDialog(wieder) {
  if (!PE.L.length) { toast('Keine neuen Vorschläge aus E-Mails.'); return; }
  const E0 = peEnt(), assign = {}, dec = {};
  PE.L.forEach(v => { const e = E0[v.key] || {}; if (e.bedarf || e.foerderer) assign[v.key] = { bedarf: e.bedarf || '', foerderer: e.foerderer || '' }; });
  if (wieder) Object.assign(dec, wieder);
  const W = () => PE.L.map(v => { const w0 = peWirkung(v, {}), k0 = peKind(v, w0), w = assign[v.key] ? peWirkung(v, assign[v.key]) : w0; return { v, w, k: k0 === 'unassigned' ? 'unassigned' : peKind(v, w) }; });
  const mailTeil = (v, i) => String(v.mail || '').split('|').map(s => s.trim())[i] || '';
  // Vorgang: derselbe Bedarf (auch ein neuer), dieselbe Fördererliste-Zeile oder – ohne Zuordnung – dasselbe Vorhaben bzw. derselbe Förderer
  const gKey = x => x.w.b ? 'b:' + (x.w.b.id || x.w.b.titel) : x.w.fl ? 'f:' + x.w.fl.id : 'u:' + norm(x.v.vorhaben || x.v.fname || mailTeil(x.v, 1) || x.v.key);
  const gTitel = x => x.w.b ? (peIstNeu(x.w.b) ? 'Neu: ' : '') + (x.w.b.titel || 'Bedarf') + (x.w.b.gliederung ? ' · ' + x.w.b.gliederung : '') : x.w.fl ? 'Fördererliste · ' + x.w.fl.name : 'Ohne Bedarf · ' + (x.v.vorhaben || x.v.fname || mailTeil(x.v, 1) || 'unbekannt');
  const gruppiert = L => { const G = new Map(); L.forEach(x => { const k = gKey(x); if (!G.has(k)) G.set(k, []); G.get(k).push(x); }); return [...G.values()].flat(); };
  let X = W(); const AKT = () => gruppiert(X.filter(x => x.k !== 'info')), INF = () => X.filter(x => x.k === 'info');
  AKT().forEach(x => { if (!(x.v.key in dec)) dec[x.v.key] = (E0[x.v.key] || {}).d || (x.k === 'sicher' ? 'accept' : null); });
  let sel = (AKT().find(x => !dec[x.v.key]) || AKT()[0] || X[0]).v.key, filter = 'alle', infoOpen = false, warnAssign = false;
  const ll = peLetzterLauf(), datum = ll.datum ? ['', ...ll.datum.split('-')] : (PE.letzte.match(/(\d{4})-(\d{2})-(\d{2})/) || []);
  const box = h('div', { class: 'pe2' }); let zu = () => {};
  const zahlen = () => { const c = { accept: 0, reject: 0, later: 0, open: 0 }; AKT().forEach(x => c[dec[x.v.key] || 'open']++); return c; };
  const sichtbar = () => filter === 'offen' ? AKT().filter(x => !dec[x.v.key] || x.v.key === sel) : AKT();
  const naechster = from => { const L = AKT(), i = L.findIndex(x => x.v.key === from), o = [...L.slice(i + 1), ...L.slice(0, i)]; return (o.find(x => !dec[x.v.key]) || L[Math.min(i + 1, L.length - 1)] || L[0]).v.key; };
  const entscheiden = (key, d) => { const x = X.find(y => y.v.key === key); if (!x || x.k === 'info') return;
    if (d === 'accept' && !x.w.ok) { warnAssign = true; zeig(); const s = box.querySelector('.pe2-zu .pe2-sf-in, .pe2-zu select'); if (s) s.focus(); return; }
    dec[key] = d; warnAssign = false; sel = naechster(key); zeig(); fokus(); };
  const fokus = () => { const r = box.querySelector('.pe2-row.sel'); if (r) { r.focus({ preventScroll: true }); r.scrollIntoView({ block: 'nearest' }); } };
  // Kreis = Entscheidung (wie überall: leer gestrichelt offen, ✓ übernehmen, ✕ verwerfen, Uhr später); Klick schaltet weiter
  const PE_KREIS = { open: ['', 'offen'], accept: ['✓', 'wird übernommen'], reject: ['✕', 'wird verworfen'], later: ['◷', 'später'] };
  const zeile = x => { const d = dec[x.v.key], st = x.k === 'info' ? 'info' : d || 'open';
    const hw = x.k === 'info' ? '' : !x.w.b && !x.w.fl ? 'ohne Bedarf' : x.w.brauchtF && !x.w.ok ? 'Förderer fehlt' : norm(x.v.sicherheit) === 'unsicher' ? 'unsicher' : '';
    const ic = h('span', { class: 'pe2-ic k-' + st, role: 'button', title: x.k === 'info' ? 'steht schon so drin' : PE_KREIS[st][1] + ' – klicken zum Wechseln', 'aria-label': x.k === 'info' ? 'steht schon so drin' : PE_KREIS[st][1] }, x.k === 'info' ? '=' : PE_KREIS[st][0]);
    if (x.k !== 'info') ic.addEventListener('click', e => { e.stopPropagation(); const folge = { open: 'accept', accept: 'reject', reject: 'later', later: 'open' }; let n = folge[st];
      if (n === 'accept' && !x.w.ok) n = 'reject'; if (n === 'open') delete dec[x.v.key]; else dec[x.v.key] = n; sel = x.v.key; warnAssign = false; zeig(); fokus(); });
    const r = h('div', { class: 'pe2-row' + (x.v.key === sel ? ' sel' : '') + (d === 'reject' ? ' rejected' : ''), role: 'option', tabindex: x.v.key === sel ? '0' : '-1', 'aria-selected': String(x.v.key === sel) },
      ic,
      h('div', { class: 'pe2-rm' }, h('div', { class: 'pe2-who' }, x.w.art), h('div', { class: 'pe2-what' }, (mailTeil(x.v, 1) || 'E-Mail') + (x.w.f ? ' · ' + x.w.f.name.trim() : x.v.fname ? ' · ' + x.v.fname : ''))),
      h('div', { class: 'pe2-meta' }, h('span', null, (mailTeil(x.v, 0) || '').slice(0, 6)), hw ? h('span', { class: 'pe2-hw' }, hw) : null));
    r.addEventListener('click', () => { sel = x.v.key; warnAssign = false; zeig(); fokus(); }); return r; };
  const detail = () => {
    const x = X.find(y => y.v.key === sel) || X[0], v = x.v, w = x.w, d = dec[v.key], a = assign[v.key] || {};
    const zit = String(v.zitat || '').replace(/^[„"…\s]+|[“"…\s]+$/g, '');
    const mail = h('div', { class: 'pe2-card' }, h('div', { class: 'pe2-mm' }, h('span', null, h('b', null, mailTeil(v, 1) || 'E-Mail'), mailTeil(v, 2) ? ' · „' + mailTeil(v, 2) + '“' : ''), h('span', null, mailTeil(v, 0))),
      zit ? h('div', { class: 'pe2-quote' }, h('span', { class: 'pe2-dim' }, '… '), h('mark', null, zit), h('span', { class: 'pe2-dim' }, ' …')) : h('div', { class: 'pe2-dim' }, 'Kein Belegsatz geliefert.'),
      h('span', { class: 'pe2-dim small' }, 'Belegstelle aus der E-Mail · ganze Mail in Outlook über Absender und Betreff finden'));
    const bisherNeu = h('div', { class: 'pe2-diff' }, x.k === 'unassigned' ? null : h('label', null, 'bisher', h('span', { class: 'pe2-val old' }, w.vorher || '–')), x.k === 'unassigned' ? null : h('span', { class: 'pe2-arrow' }, '→'),
      h('label', null, 'neu', h('span', { class: 'pe2-val new ' + w.ton }, w.nachher || '–')));
    let zuord = null;
    if (x.k === 'unassigned') {
      const neuT = v.vorhaben ? '＋ Neuer Bedarf: „' + v.vorhaben + '“' + (v.gliederung ? ' (' + v.gliederung + ')' : '') : '＋ Neuen Bedarf anlegen';
      const waehle = wert => { const gk0 = gKey(x);                                   // gilt auch für die anderen Vorschläge desselben Vorgangs, die noch nicht zugeordnet sind
        X.filter(y => y.k === 'unassigned' && (y.v.key === v.key || (gKey(y) === gk0 && (!(assign[y.v.key] || {}).bedarf || (assign[y.v.key] || {}).von === v.key)))).forEach(y => { assign[y.v.key] = Object.assign({}, assign[y.v.key], { bedarf: wert, von: y.v.key === v.key ? '' : v.key, foerderer: (assign[y.v.key] || {}).foerderer || (y.w.brauchtF ? '__neu' : '') }); });
        warnAssign = false; X = W(); zeig(); };
      const OPT = [{ v: '__neu', t: neuT, neu: true }, ...D.bedarfe.filter(b => !b.archiv).sort((p, q) => (p.titel || '').localeCompare(q.titel || '', 'de')).map(b => ({ v: b.id, t: b.titel || '(ohne Namen)', s: [b.gliederung, ...b.foerderer.map(f => f.name.trim()).filter(Boolean)].filter(Boolean).join(' · ') }))];
      const vonX = a.von && X.find(y => y.v.key === a.von), vonTitel = vonX ? 'übernommen aus der Mail von ' + (mailTeil(vonX.v, 1) || '–') + (mailTeil(vonX.v, 0) ? ' (' + mailTeil(vonX.v, 0) + ')' : '') : '', vonT = vonX ? '✓ aus erster Mail übernommen' : '';
      const sb = peSuchfeld(OPT, a.bedarf || (w.b && w.b.id) || '', waehle, { warn: warnAssign && !(a.bedarf || w.b), ph: 'Bedarf suchen – z. B. Name, Gliederung, Förderer …',
        anzeige: a.bedarf === '__neu' && w.b ? 'Neu: ' + w.b.titel + (w.b.gliederung ? ' (' + w.b.gliederung + ')' : '') : '', notiz: vonT || (a.bedarf === '__neu' ? 'wird beim Übernehmen angelegt' : ''), notizTitel: vonTitel });
      const bb = a.bedarf === '__neu' ? w.b : D.bedarfe.find(b => b.id === (a.bedarf || (w.b && w.b.id)));
      let sf = null;
      if (w.brauchtF && bb) {
        const fwert = w.f && bb.foerderer.includes(w.f) ? w.f.id : /^fl:/.test(a.foerderer || '') ? a.foerderer : '__neu', inB = new Set(bb.foerderer.map(f => f.flId).filter(Boolean));
        const FO = [{ v: '__neu', t: v.fname ? '＋ Neu: ' + v.fname : '＋ Neu anlegen aus dem Absender', neu: true },
          ...bb.foerderer.filter(f => f.name.trim()).map(f => ({ v: f.id, t: f.name.trim(), s: 'schon beim Bedarf · ' + (F_ST_L[f.status] || '') })),
          ...(flAktiv() ? D.fl.liste.filter(e => e.name && !inB.has(e.id) && !bb.foerderer.some(f => kkey(f.name) === kkey(e.name))).sort((p, q) => p.name.localeCompare(q.name, 'de')).map(e => ({ v: 'fl:' + e.id, t: e.name, s: 'aus der Fördererliste' + (e.kurz ? ' · ' + e.kurz : '') })) : [])];
        sf = peSuchfeld(FO, fwert, wert => { assign[v.key] = Object.assign({}, assign[v.key], { foerderer: wert, fWahl: true }); X = W(); zeig(); },
          { label: 'Förderer suchen', ph: 'Förderer suchen …', leer: 'Kein Förderer gefunden – oben neu anlegen.', anzeige: fwert === '__neu' && v.fname ? 'Neu: ' + v.fname : '',
            notiz: fwert !== '__neu' && !a.fWahl ? '✓ aus der Mail erkannt' : fwert === '__neu' ? 'wird beim Übernehmen angelegt' : '' });
      }
      zuord = h('div', { class: 'pe2-zu' }, h('label', null, 'bei Bedarf', sb), sf ? h('label', null, 'Förderer', sf) : null);
    }
    const status = x.k === 'info' ? null : d === 'accept' ? ['wird übernommen', 'ok'] : d === 'reject' ? ['wird verworfen', 'err'] : d === 'later' ? ['bleibt für später', 'muted'] : [x.k === 'unassigned' && !w.ok ? (warnAssign ? 'Erst einen Bedarf wählen' : 'Zuordnen oder ignorieren') : 'Bitte bewusst entscheiden', 'warn'];
    const knopf = (dd, cls, t, kbd) => { const bt = h('button', { type: 'button', class: 'pe2-act ' + cls, 'aria-pressed': String(d === dd) }, t, h('kbd', null, kbd)); bt.addEventListener('click', () => entscheiden(v.key, dd)); return bt; };
    const akt = x.k === 'info' ? h('div', { class: 'pe2-infonote' }, w.info || '= Steht schon so in der Bedarfsliste. Es wird nichts geändert.')
      : h('div', { class: 'pe2-actions', role: 'group', 'aria-label': 'Entscheidung' }, knopf('accept', 'a', '✓ Übernehmen', 'A'), knopf('reject', 'r', '✕ ' + (x.k === 'unassigned' ? 'Ignorieren' : 'Verwerfen'), 'X'), knopf('later', 'l', 'Später', 'S'), h('span', { class: 'pe2-status ' + status[1] }, status[0]));
    return [mail, h('div', { class: 'pe2-cap' }, 'Daraus wird in der Bedarfsliste'),
      h('div', { class: 'pe2-card pe2-change' }, x.k !== 'unassigned' && w.f ? h('span', { class: 'pe2-crumb' }, 'bei ', h('b', null, w.f.name.trim())) : null, h('div', { class: 'pe2-art' }, w.art, norm(v.sicherheit) === 'unsicher' && x.k !== 'info' ? h('span', { class: 'pe2-tag' }, '! unsicher') : null), bisherNeu, zuord, akt)];
  };
  const zeig = () => {
    const c = zahlen(), n = AKT().length, fertig = n - c.open;
    const segs = h('div', { class: 'pe2-segs' }, ...AKT().map(x => h('div', { class: 'pe2-seg ' + (dec[x.v.key] || '') + (!dec[x.v.key] && x.k !== 'sicher' ? ' unsure' : '') + (x.v.key === sel ? ' cur' : '') })));
    const pstate = c.open ? h('button', { type: 'button', class: 'pe2-open', onclick: () => { filter = 'offen'; sel = AKT().find(x => !dec[x.v.key]).v.key; zeig(); fokus(); } }, 'Noch ' + c.open + ' offen → zeigen') : n ? h('span', { class: 'pe2-done' }, '✓ Alles geprüft') : null;
    const fb = (k, t) => h('button', { type: 'button', 'aria-pressed': String(filter === k), onclick: () => { filter = k; zeig(); } }, t);
    const rows = h('div', { class: 'pe2-rows', role: 'listbox', 'aria-label': 'Vorschläge' }); let gk = null;
    for (const x of sichtbar()) { const k = gKey(x);
      if (k !== gk) { gk = k; const G = AKT().filter(y => gKey(y) === k), alleOk = G.every(y => y.w.ok), offen = G.filter(y => !dec[y.v.key]).length;
        const kopf = h('div', { class: 'pe2-gk' + (k.startsWith('u:') ? ' ohne' : '') }, h('span', { class: 'pe2-gt', title: gTitel(x) }, gTitel(x)), h('span', { class: 'pe2-gn' }, G.length + (G.length === 1 ? ' Änderung' : ' Änderungen') + (offen ? ' · ' + offen + ' offen' : '')),
          G.length > 1 && alleOk ? h('button', { type: 'button', class: 'pe2-galle', title: 'Alle Änderungen dieses Vorgangs übernehmen', onclick: () => { G.forEach(y => { dec[y.v.key] = 'accept'; }); sel = naechster(G[G.length - 1].v.key); zeig(); fokus(); } }, '✓ alle') : null);
        rows.append(kopf); }
      rows.append(zeile(x)); }
    const inf = INF().length ? [h('button', { type: 'button', class: 'pe2-infohead', 'aria-expanded': String(infoOpen), onclick: () => { infoOpen = !infoOpen; zeig(); } }, (infoOpen ? '▾ ' : '▸ ') + 'Steht schon so drin · ' + INF().length + ' ', h('span', null, 'nur Info')), ...(infoOpen ? INF().map(zeile) : [])] : [];
    const zus = [c.accept && c.accept + ' übernehmen', c.reject && c.reject + ' verworfen', c.later && c.later + ' später', c.open && c.open + ' offen'].filter(Boolean).join(' · ');
    const los = h('button', { type: 'button', class: 'primary pe2-los', disabled: !c.accept && !c.reject, onclick: () => zu('los') }, c.accept ? c.accept + ' übernehmen' : c.reject ? 'Verwerfen bestätigen' : '0 übernehmen');
    box.replaceChildren(
      h('div', { class: 'pe2-head' }, h('div', { class: 'pe2-title' }, h('h2', null, 'Vorschläge aus E-Mails'), h('small', null, datum.length ? 'Copilot hat am ' + datum[3] + '.' + datum[2] + '.' + datum[1] + (ll.zeit ? ' um ' + ll.zeit : '') + ' Posteingang und Gesendete gelesen' : 'Aus deinen E-Mails, gelesen von Copilot'), h('button', { type: 'button', class: 'x', 'aria-label': 'Schließen', onclick: () => zu('spaeter') }, '×')),
        n ? h('div', { class: 'pe2-progress' }, h('b', null, fertig + ' von ' + n + ' entschieden'), segs, pstate) : null),
      h('div', { class: 'pe2-body' },
        h('div', { class: 'pe2-left' }, h('div', { class: 'pe2-filter', role: 'group', 'aria-label': 'Filter' }, fb('alle', 'Alle ' + n), fb('offen', 'Braucht Entscheidung ' + c.open)), rows, h('div', { class: 'pe2-info' }, ...inf)),
        h('div', { class: 'pe2-right', 'aria-live': 'polite' }, ...detail())),
      h('div', { class: 'pe2-foot' }, h('div', { class: 'pe2-keys' }, h('span', null, h('kbd', null, '↑'), h('kbd', null, '↓'), ' wechseln'), h('span', null, h('kbd', null, 'A'), ' übernehmen'), h('span', null, h('kbd', null, 'X'), ' verwerfen'), h('span', null, h('kbd', null, 'S'), ' später'), h('span', null, h('kbd', null, 'Esc'), ' schließen')),
        h('span', { class: 'pe2-sp' }), h('span', { class: 'pe2-sum' }, zus), h('button', { type: 'button', class: 'link small', onclick: () => { AKT().forEach(x => { dec[x.v.key] = 'reject'; }); zeig(); } }, 'Alle verwerfen'),
        h('button', { type: 'button', onclick: () => zu('spaeter') }, 'Später weitermachen'), los));
  };
  const tasten = e => {
    if (!box.isConnected) return;
    if (/SELECT|INPUT|TEXTAREA/.test(e.target.tagName)) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.target.blur(); } return; }
    const L = sichtbar(), i = L.findIndex(x => x.v.key === sel), k = e.key.toLowerCase();
    if (k === 'arrowdown' || k === 'j') { e.preventDefault(); e.stopPropagation(); if (L[i + 1]) sel = L[i + 1].v.key; warnAssign = false; zeig(); fokus(); }
    else if (k === 'arrowup' || k === 'k') { e.preventDefault(); e.stopPropagation(); if (i > 0) sel = L[i - 1].v.key; warnAssign = false; zeig(); fokus(); }
    else if (k === 'a') { e.preventDefault(); e.stopPropagation(); entscheiden(sel, 'accept'); }
    else if (k === 'x' || k === 'delete') { e.preventDefault(); e.stopPropagation(); entscheiden(sel, 'reject'); }
    else if (k === 's') { e.preventDefault(); e.stopPropagation(); entscheiden(sel, 'later'); }
    else if (k === 'enter' && e.ctrlKey) { e.preventDefault(); e.stopPropagation(); if (zahlen().accept || zahlen().reject) zu('los'); }
  };
  document.addEventListener('keydown', tasten, true);
  zeig();
  const erg = await modal('Vorschläge aus E-Mails', box, [], { cls: 'pe2-modal', expose: c => { zu = c; setTimeout(fokus, 40); } });
  document.removeEventListener('keydown', tasten, true);
  // Entscheidungen und Zuordnungen merken (auch bei „Später weitermachen“ und ×)
  const merken = nurSpaeter => { const E = Object.assign({}, peEnt()); AKT().forEach(x => { const k = x.v.key, dd = dec[k]; E[k] = Object.assign({}, assign[k] || {}, { d: nurSpaeter ? dd || null : (dd === 'accept' || dd === 'reject' ? undefined : 'later') }); if (!nurSpaeter && (dd === 'accept' || dd === 'reject')) delete E[k]; }); D.settings.mailEnt = E; };
  if (erg !== 'los') { merken(true); changed(); safeRender(); const c = $('.pe-chip'); if (c) c.focus(); return; }
  const vorher = JSON.stringify(D), vorDec = Object.assign({}, dec), c = zahlen(); let n = 0;
  for (const x of AKT()) if (dec[x.v.key] === 'accept' && x.w.fn) { try { x.w.fn(); n++; } catch (e) { console.warn(e); } }
  const weg = AKT().filter(x => dec[x.v.key] === 'accept' || dec[x.v.key] === 'reject').map(x => x.v.key).concat(INF().map(x => x.v.key));
  merken(false); D.settings.mailErledigt = peErledigt().concat(weg).slice(-400);
  PE.L = PE.L.filter(v => !weg.includes(v.key));
  changed(); safeRender();
  if (!n) { toast(c.reject + (c.reject === 1 ? ' Vorschlag verworfen' : ' Vorschläge verworfen'), 'ok'); return; }
  peToast(n, c.reject, c.later + c.open, async () => { await undoGanz(vorher)(); await peScan(); PE.L = PE.L.length ? PE.L : []; peDialog(vorDec); });
}
// Meldung nach dem Übernehmen: dunkel, unten mittig, „↶ Rückgängig“ nimmt den ganzen Durchgang zurück und öffnet das Fenster wieder
function peToast(n, rej, spaet, undo) {
  const alt = $('.pe2-toast'); if (alt) alt.remove();
  const t = h('div', { class: 'pe2-toast', role: 'status' }, h('span', { class: 'pe2-tok' }, '✓'), h('span', null, h('b', null, n + (n === 1 ? ' Änderung eingetragen' : ' Änderungen eingetragen')), [rej && rej + ' verworfen', spaet && spaet + ' für später'].filter(Boolean).length ? h('small', null, ' ' + [rej && rej + ' verworfen', spaet && spaet + ' für später'].filter(Boolean).join(' · ')) : null),
    h('button', { type: 'button', class: 'pe2-undo', onclick: () => { t.remove(); undo(); } }, '↶ Rückgängig'), h('button', { type: 'button', class: 'pe2-tx', 'aria-label': 'Meldung schließen', onclick: () => t.remove() }, '×'));
  document.body.append(t); setTimeout(() => t.remove(), 10000);
}

/* ---------- Einstellungen: was gesucht wird, Einrichtung in Cowork */
const peCwInfoText = () => !D.settings.coworkOrdner ? '' : PE.cwZ === 'zugriff' ? 'Der Browser braucht die Freigabe – oben auf „Copilot-Ergebnisse freigeben“ klicken.' : PE.cwZ === 'fehlt' ? 'In diesem Browser nicht verbunden – bitte neu verbinden.'
  : !PE.cwInfo ? '' : PE.cwInfo.n ? 'Gefunden: ' + PE.cwInfo.n + (PE.cwInfo.n === 1 ? ' Lauf-Datei' : ' Lauf-Dateien') + ', zuletzt „' + PE.cwInfo.letzte + '“.' : 'Noch keine Datei „Posteingang_LAUF_…“ im Ordner (auch nicht in Unterordnern) – kommt sie nach dem Lauf von Copilot nicht an, ist sie nicht in deinem OneDrive gelandet.';
// „Jetzt abholen“ (ab 0.159): sagt immer, was passiert ist – Freigabe gleich hier (der Klick erlaubt die Rückfrage des Browsers), sonst Fundstand und Ordnerinhalt
async function peAbholen(el) {
  el.textContent = 'Suche im Cowork-Ordner …'; el.classList.remove('warn');
  const sag = (t, w) => { el.textContent = t; el.classList.toggle('warn', !!w); };
  try {
    if (PE.cw === undefined) PE.cw = await idbGet(peCwKey());
    if (!PE.cw) return sag('Der Cowork-Ordner ist in diesem Browser nicht verbunden – oben „Anderen Ordner wählen …“ und „Dokumente › Cowork“ auswählen.', true);
    let p = 'prompt'; try { p = await PE.cw.queryPermission({ mode: 'read' }); } catch (e) { /* */ }
    if (p !== 'granted') { try { p = await PE.cw.requestPermission({ mode: 'read' }); } catch (e) { /* */ } }
    if (p !== 'granted') return sag('Der Browser hat den Zugriff auf „' + PE.cw.name + '“ nicht erlaubt. Bitte noch einmal klicken und „Zulassen“ wählen.', true);
    PE.cwZ = 'ok';
    for (let i = 0; PE.busy && i < 25; i++) await new Promise(r => setTimeout(r, 200));
    const vorher = PE.L.length;
    if (rechOrdnerOk()) await peScan(); else await peCoworkDateien();
    const I = PE.cwInfo || { n: 0, letzte: '' };
    if (!I.n) { const T = []; try { for await (const [n, e] of PE.cw.entries()) T.push(e.kind === 'directory' ? n + '/' : n); } catch (e) { /* */ }
      return sag('Keine Datei „Posteingang_LAUF_…“ gefunden – auch nicht in Unterordnern. Im verbundenen Ordner „' + PE.cw.name + '“ liegt: ' + (T.length ? T.sort().slice(0, 12).join(', ') + (T.length > 12 ? ' …' : '') : 'nichts') + '. Ist das der richtige Ordner?', true); }
    sag('Gefunden: ' + I.n + (I.n === 1 ? ' Lauf-Datei' : ' Lauf-Dateien') + ', zuletzt „' + I.letzte + '“. ' + (!rechOrdnerOk() ? 'Übernehmen geht erst, wenn die Bedarfsliste mit ihrem Ordner verbunden ist.' : PE.L.length ? PE.L.length + (PE.L.length === 1 ? ' Vorschlag' : ' Vorschläge') + ' oben zum Prüfen' + (PE.L.length > vorher ? ' (neu dazu: ' + (PE.L.length - vorher) + ')' : '') + '.' : 'Keine offenen Vorschläge (schon übernommen oder ohne Ergebnis).'), !rechOrdnerOk());
    renderNow();
  } catch (e) { console.warn(e); sag('Fehler beim Lesen: ' + (e && e.message || e), true); }
}
async function peEinstDialog() {
  if (D.settings.coworkOrdner) await peScan().catch(() => {});
  const cwI = h('p', { class: 'muted small pe-cw-info' }, peCwInfoText());
  const S = peEinst(), cwT = h('span', { class: 'muted small' }, D.settings.coworkOrdner ? (PE.cwZ === 'ok' ? 'Verbunden: „' : 'Verbunden (Freigabe nötig): „') + D.settings.coworkOrdner + '“' : 'Noch nicht verbunden');
  const gr = g => h('section', { class: 'pe-eg' }, h('label', { class: 'pe-eh' }, h('input', { type: 'checkbox', checked: S[g], onchange: e => { S[g] = e.target.checked; } }), h('b', null, PE_GRUPPEN[g])),
    h('ul', { class: 'pe-el' }, ...PE_ARTEN.filter(a => a[1] === g).map(a => h('li', null, a[2]))));
  const kop = h('button', { type: 'button', onclick: () => flcTextKopieren(peSatz(), 'Satz kopiert – in Cowork als geplante Aufgabe einfügen') }, 'Satz kopieren');
  const einw = h('button', { type: 'button', class: 'primary', onclick: () => flcTextKopieren(peEinweisung(), 'Einweisung kopiert – in Copilot Cowork einfügen') }, 'Einweisung kopieren');
  const stand = h('p', { class: 'muted small' }, peLetzterLauf().datum ? 'Letzter Lauf von Copilot: ' + fmtDate(peLetzterLauf().datum) + (peLetzterLauf().zeit ? ' um ' + peLetzterLauf().zeit : '') + ' – ' + peLetzterLauf().erg + '.' : PE.letzte ? 'Letzte Datei von Copilot: „' + PE.letzte + '“.' : rechOrdnerOk() ? 'Noch keine Datei „Posteingang …“ von Copilot im Ordner.' : 'Ordner nicht verbunden – die Dateien für Copilot werden geschrieben, sobald die Bedarfsliste mit ihrem Ordner verbunden ist.');
  const body = h('div', { class: 'pe-einst' },
    h('p', null, 'Copilot Cowork liest werktags früh deine E-Mails (alle Ordner) und schlägt vor, was sich geändert hat. Übernommen wird erst, wenn du es bestätigst.'),
    h('h3', null, 'Wo Copilot seine Ergebnisse ablegt'),
    h('p', null, 'Copilot darf ohne Rückfrage nur neue Dateien in seinem Arbeitsordner anlegen: OneDrive „' + PE_CW + '“. Verbinde diesen Ordner einmal (im Explorer meist unter „OneDrive – Malteser › Dokumente › Cowork“) – das Programm holt die Ergebnisse dort ab und hängt sie an „' + PE_DATEI + '“ an.'),
    h('div', { class: 'pe-cw' }, h('button', { type: 'button', onclick: async () => { if (await peCoworkVerbinden()) cwT.textContent = 'Verbunden: „' + D.settings.coworkOrdner + '“'; } }, D.settings.coworkOrdner ? 'Anderen Ordner wählen …' : 'Cowork-Ordner verbinden …'),
      cwT, h('button', { type: 'button', class: 'link small', onclick: () => peAbholen(cwI) }, 'Jetzt abholen')),
    cwI,
    h('h3', null, 'Wonach gesucht wird'), gr('A'), gr('B'), gr('C'),
    h('h3', null, 'Einmal in Cowork einrichten'),
    h('ol', { class: 'pe-schritte' },
      h('li', null, 'Bedarfsliste einmal mit ihrem Ordner geöffnet haben – dann liegen Auftrag und Überblick im Ordner „' + RECH_DIR + '“.'),
      h('li', null, 'In Copilot Cowork einen neuen Chat öffnen und die Einweisung einfügen: ', einw, h('div', { class: 'muted small' }, 'Sie erklärt Copilot, worum es geht, lässt den Zugriff prüfen und einen Probelauf über die letzten 7 Tage machen („Posteingang …-test.txt“ – erscheint hier als Vorschläge). Passt das Ergebnis, legt Copilot die geplante Aufgabe selbst an.')),
      h('li', null, 'Lieber von Hand anlegen? „Automatisierungen“ bzw. „Geplante Aufgabe“: Montag bis Freitag, früh morgens (z. B. 6:00 Uhr – erwartet Cowork die Zeit in UTC, im Winter 5:00, im Sommer 4:00). Als Auftrag nur diesen Satz: ', h('q', null, peSatz()), ' ', kop),
      h('li', null, 'Fertig. Ändert sich hier etwas, schreibt das Programm die Auftragsdatei neu – die Aufgabe in Cowork bleibt, wie sie ist.')),
    stand);
  const ok = await modal('E-Mail-Auswertung', body, [['Abbrechen', false], ['Speichern', true, 'primary']], { wide: true, cls: 'pe-einst-modal' });
  if (!ok) return;
  D.settings.mailAusw = { A: !!S.A, B: !!S.B, C: !!S.C }; changed();
  if (await peSchreiben(true)) toast('Gespeichert – Auftragsdatei für Copilot aktualisiert.', 'ok'); else toast('Gespeichert. Die Auftragsdatei wird geschrieben, sobald der Ordner verbunden ist.', 'ok');
}
