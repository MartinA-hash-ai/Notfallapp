/* ===================================================================== E-Mail-Auswertung mit Copilot Cowork (ab 0.143)
   Cowork läuft werktags früh als geplante Aufgabe, liest die E-Mails (Posteingang und Gesendete) und schreibt Vorschläge in eine Datei
   „Posteingang JJJJ-MM-TT.txt“ im Ordner „Förderrecherche“. Das Programm legt dafür zwei Dateien in denselben Ordner und hält sie aktuell:
   „Auftrag E-Mail-Auswertung.txt“ (was gesucht wird – aus den Einstellungen) und „Überblick für Copilot.txt“ (Bedarfe und Förderer mit Kennungen).
   Die geplante Aufgabe in Cowork enthält nur einen Satz („Lies die Auftragsdatei und führe sie aus“) – sie muss nie geändert werden.
   Beim Öffnen meldet das Programm neue Vorschläge; übernommen wird erst nach Prüfung (Haken je Vorschlag, ↶ macht alles rückgängig). */
const PE_AUFTRAG = 'Auftrag E-Mail-Auswertung.txt', PE_UEB = 'Überblick für Copilot.txt', PE_RE = /^Posteingang.*\.(txt|md)$/i;
const PE_SATZ = 'Lies die Datei „' + PE_AUFTRAG + '“ im Ordner „' + RECH_DIR + '“ (neben der Bedarfsliste) und führe den Auftrag darin vollständig aus.';
const PE = { L: [], dateien: [], letzte: '', aufStr: '', uebStr: '', busy: false };

// Gruppen und Arten: [Schlüssel, Gruppe, Bezeichnung für das Fenster, Erklärung für Cowork]
const PE_ARTEN = [
  ['antrag', 'A', 'Antrag gestellt oder eingegangen', 'Ein Antrag wurde an den Förderer geschickt (auch in „Gesendete Elemente“) oder der Förderer bestätigt den Eingang. Datum = Tag des Antrags bzw. der Bestätigung; „Antwort bis“, falls genannt.'],
  ['zusage', 'A', 'Zusage', 'Der Förderer bewilligt bzw. sagt zu. Betrag = zugesagte Summe in Euro (Zahl). Datum = Datum der Zusage.'],
  ['absage', 'A', 'Absage', 'Der Förderer lehnt ab. Grund = Begründung in wenigen Worten, falls genannt.'],
  ['nachforderung', 'A', 'Nachforderung / Rückfrage', 'Der Förderer fordert Unterlagen nach oder fragt nach. Wert = was gebraucht wird; Datum = bis wann, falls genannt.'],
  ['nachweis', 'A', 'Frist Verwendungsnachweis', 'Frist für den Verwendungsnachweis (meist im Bewilligungsschreiben). Datum = Frist.'],
  ['uebergabe_foerderer', 'A', 'Förderer kommt zur Spendenübergabe', 'Der Förderer sagt die Teilnahme an der Spendenübergabe zu oder ab. Wert = ja oder nein; Person = wer kommt.'],
  ['kontakt', 'A', 'Neue Ansprechperson beim Förderer', 'Neue oder geänderte Ansprechperson beim Förderer (nur dienstliche Angaben). Wert = „Name; Position; E-Mail; Telefon“.'],
  ['freigabe', 'B', 'Freigabe (OFK, Fachreferat, Verwaltung)', 'Intern: Ortsführungskreis stimmt zu/lehnt ab, Fachreferat gibt frei/lehnt ab, Verwaltung budgetiert/lehnt ab. Wert = ofk, fach oder verw; Ergebnis = ok oder nein; Datum = Tag der Entscheidung.'],
  ['unterlage', 'B', 'Unterlage geliefert', 'Intern: Angebot, Kostenplan, Konzept, Projektsteckbrief, Bilder o. Ä. wurden geschickt (Anhang). Wert = Name der Unterlage wie im Überblick.'],
  ['uebergabe_termin', 'B', 'Termin der Spendenübergabe', 'Termin der Spendenübergabe vereinbart. Datum, Uhrzeit (HH:MM), Ort.'],
  ['presse', 'B', 'Presse und Öffentlichkeit', 'Intern: Presse und Öffentlichkeit kommt zur Spendenübergabe oder nicht, oder übernimmt eine Pressemitteilung. Person = wer; Wert = kurz, was zugesagt ist.'],
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
    'ZIEL: Finde in meinen E-Mails neue Informationen zu den Bedarfen und Förderern aus der Datei „' + PE_UEB + '“ (gleicher Ordner) und schreibe sie als Vorschläge in eine neue Datei. Das Programm zeigt mir die Vorschläge; ich entscheide. Du änderst sonst nichts.', '',
    'SO GEHST DU VOR',
    '1. Lies „' + PE_UEB + '“: alle Bedarfe mit Kennung [b-…], ihre Förderer [f-…], die Fördererliste [F…], Gliederungen und Ansprechpersonen.',
    '2. Zeitraum: alle E-Mails seit der neuesten Datei „Posteingang …“ in diesem Ordner (nach Datum im Namen); gibt es keine, die letzten 3 Tage. Durchsuche „Posteingang“ und „Gesendete Elemente“, keine Teams-Nachrichten.',
    '3. Berücksichtige nur E-Mails, die sich eindeutig auf einen Bedarf oder Förderer aus dem Überblick beziehen (Name, Kurzname, Ansprechperson, Gliederung + Vorhaben). Ignoriere Newsletter, Werbung, automatische Benachrichtigungen und Kalendereinladungen ohne Inhalt.',
    '4. Suche nur nach diesen Arten (Art = Schlüssel vorn):', ...A.map(a => '   - ' + a[0] + ': ' + a[3]),
    '5. Ordne jeden Vorschlag zu: Bedarf = Kennung [b-…], Förderer = Kennung [f-…] (falls der Förderer beim Bedarf schon steht), Fördererliste = [F…] (nur bei fl_frist). Ist die Zuordnung nicht eindeutig: Kennung leer lassen und Sicherheit = unsicher.',
    '6. Steht die Information schon so im Überblick (z. B. Stand schon „zugesagt“ mit diesem Betrag), keinen Vorschlag schreiben.',
    '7. Nichts erfinden, nichts schätzen. Zitat = höchstens ein Satz aus der E-Mail, der die Information belegt. Keine weiteren Inhalte der E-Mail übernehmen, keine Bank- oder Personaldaten.', '',
    'ERGEBNIS',
    'Lege im selben Ordner eine neue Textdatei an: „Posteingang JJJJ-MM-TT.txt“ (heutiges Datum; gibt es sie schon, hänge „-2“ an). Inhalt genau in diesem Aufbau, je Vorschlag ein Block:', '',
    '=== VORSCHLAG ===', 'Art: zusage', 'Bedarf: b-…', 'Förderer: f-…', 'Fördererliste: ', 'Datum: TT.MM.JJJJ', 'Betrag: 15000', 'Uhrzeit: ', 'Ort: ', 'Wert: ', 'Ergebnis: ', 'Grund: ', 'Person: ', 'Sicherheit: sicher',
    'Mail: TT.MM.JJJJ | Absender | Betreff', 'Zitat: „…“', '',
    'Felder, die nicht passen, bleiben leer. Sicherheit = sicher oder unsicher. Beträge als Zahl ohne Punkt und ohne €.',
    'Hast du nichts gefunden: Datei trotzdem anlegen, mit der einzigen Zeile „Keine Vorschläge“. Hast du keinen Zugriff auf mein Postfach: Datei mit der Zeile „Kein Zugriff auf E-Mails“ anlegen.',
    'Antworte im Chat nur mit einem Satz: wie viele Vorschläge du geschrieben hast.'].join('\r\n');
}
function peUeberblickText() {
  const fr = b => frItems(b).map(i => frName(i) + ': ' + (frText(i) || i.st)).join('; ');
  const ul = b => b.unterlagen.map(u => u.name + ': ' + ulText(u)).join('; ');
  const k = c => [c.n, c.rolle || c.pos, c.mail].filter(Boolean).join(', ');
  const L = ['ÜBERBLICK DER BEDARFSLISTE – Stand ' + fmtDate(today()) + ' (schreibt das Programm, bitte nicht ändern)', 'Kennungen in eckigen Klammern in den Vorschlägen angeben.', '', 'BEDARFE'];
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
    for (const [n, t] of [[PE_AUFTRAG, a], [PE_UEB, u]]) { const fh = await d.getFileHandle(n, { create: true }), w = await fh.createWritable(); await w.write(new Blob(['﻿' + t], { type: 'text/plain;charset=utf-8' })); await w.close(); }
    PE.aufStr = a; PE.uebStr = u; return true;
  } catch (e) { console.warn(e); return false; } finally { PE.busy = false; }
}

/* ---------- Vorschläge lesen */
function peLesen(text, datei) {
  const L = [];
  for (const block of String(text || '').replace(/\r/g, '').split(/^\s*=+\s*VORSCHLAG\s*=+\s*$/im).slice(1)) {
    const o = { datei }; for (const z of block.split('\n')) { const m = z.match(/^\s*([A-Za-zÄÖÜäöüß-]+)\s*:\s*(.*)$/); if (m) o[norm(m[1]).replace(/[^a-zäöüß]/g, '')] = m[2].trim(); }
    o.art = norm(o.art || '').replace(/[^a-z_]/g, ''); if (!o.art) continue;
    for (const k of ['bedarf', 'forderer', 'förderer', 'fordererliste', 'fördererliste']) if (o[k]) o[k] = o[k].replace(/[[\]\s]/g, '');
    o.foerderer = o['förderer'] || o.forderer || ''; o.fl = o['fördererliste'] || o.fordererliste || '';
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
  try { for await (const [n, e] of d.entries()) { if (e.kind !== 'file' || !PE_RE.test(n)) continue; const f = await e.getFile(), k = n + '@' + f.lastModified; if (n > letzte) letzte = n; if (!erl.has(k)) F.push({ n, k, f }); } } catch (e) { return; }
  PE.letzte = letzte;
  const L = [], leer = [];
  for (const x of F.sort((a, c) => a.n.localeCompare(c.n))) { const V = peLesen(await x.f.text(), x.n); if (!V.length) { leer.push(x.k); continue; } V.forEach((v, i) => { v.key = x.k + '#' + i; if (!erl.has(v.key)) L.push(v); }); }
  if (leer.length) { D.settings.mailErledigt = peErledigt().concat(leer).slice(-400); changed(); }   // „Keine Vorschläge“: gleich als gesehen merken
  const alt = PE.L.map(v => v.key).join(), neu = L.map(v => v.key).join(); PE.L = L; PE.dateien = F.map(x => x.k);
  if (alt !== neu) safeRender();
}

/* ---------- Was ein Vorschlag im Programm ändert: wo (Bereich, Förderer), bisher → neu, Ton der neuen Angabe, die Änderung selbst */
const PE_ST_TON = { zugesagt: 't-ok', beantragt: 't-run', abgelehnt: 't-err', geplant: 't-neu' };
function peWirkung(v, zu = {}) {
  const bid = zu.bedarf || v.bedarf, b = D.bedarfe.find(x => x.id === bid), fid = zu.foerderer || v.foerderer;
  let f = b && fid && fid !== '__neu' ? b.foerderer.find(x => x.id === fid) : null;
  const neuF = b && fid === '__neu', fNeu = () => { const n = ff({ name: (String(v.mail || '').split('|')[1] || 'Neuer Förderer').trim() }); b.foerderer.push(n); return n; };
  const F = () => f || (neuF ? (f = fNeu()) : null);
  const d = peDatum(v.datum), betrag = peBetrag(v.betrag), A = PE_ARTEN.find(a => a[0] === v.art);
  const r = { b, f, art: A ? A[2] : v.art, bereich: 'Förderplan', vorher: '', nachher: '', ton: 't-neu', ok: false, schon: false, fn: null, brauchtF: false };
  const fs = x => x ? F_ST_L[x.status] + (foeAmt(x) ? ' · ' + eur(foeAmt(x)) : '') + (x.status === 'beantragt' && x.beantragtAm ? ' · seit ' + fmtDate(x.beantragtAm) : '') : (neuF ? 'neuer Förderer' : '–');
  const mitF = (neu, extra, nachher, ton) => { r.brauchtF = true; r.ok = !!(f || neuF); r.vorher = fs(f); r.nachher = nachher; r.ton = ton || PE_ST_TON[neu] || 't-neu';
    r.fn = () => { const x = F(); const alt = x.status; if (neu && alt !== neu) { x.status = neu; effects(b, x, 'status', neu, alt); } if (extra) extra(x); }; };
  switch (v.art) {
    case 'antrag': mitF('beantragt', x => { if (d) x.beantragtAm = d; const e = peDatum(v.wert); if (e) x.erwartet = e; }, 'beantragt' + (d ? ' am ' + fmtDate(d) : '')); r.schon = !!f && ['beantragt', 'zugesagt', 'abgelehnt'].includes(f.status); break;
    case 'zusage': mitF('zugesagt', x => { if (betrag) x.zugesagt = betrag; if (d) x.entscheidungAm = d; }, 'zugesagt' + (betrag ? ' · ' + eur(betrag) : '') + (d ? ' · am ' + fmtDate(d) : '')); r.schon = !!f && f.status === 'zugesagt' && (!betrag || +foeAmt(f) === betrag); break;
    case 'absage': mitF('abgelehnt', x => { if (v.grund) x.grund = v.grund; if (d) x.entscheidungAm = d; }, 'abgelehnt' + (v.grund ? ' · Grund: ' + v.grund : '')); r.schon = !!f && f.status === 'abgelehnt'; break;
    case 'nachforderung': mitF('', x => { x.notiz = (x.notiz ? x.notiz.trim() + '\n' : '') + '* Nachforderung ' + fmtDate(today()) + ': ' + (v.wert || 'siehe E-Mail') + (d ? ' – bis ' + fmtDate(d) : ''); if (d && x.status === 'beantragt') x.erwartet = d; }, 'Nachforderung: ' + (v.wert || 'siehe E-Mail') + (d ? ' · bis ' + fmtDate(d) : ''), 't-neu'); r.vorher = 'Notizen: –'; break;
    case 'nachweis': mitF('', x => { x.vn.noetig = true; x.vn.frist = d; }, 'Verwendungsnachweis bis ' + (d ? fmtDate(d) : '?'), 't-neu'); r.vorher = f && f.vn.frist ? 'Verwendungsnachweis bis ' + fmtDate(f.vn.frist) : 'Verwendungsnachweis: keine Frist'; r.ok = r.ok && !!d; r.schon = !!f && f.vn.frist === d; break;
    case 'uebergabe_foerderer': { const ja = /^j/i.test(v.wert || ''), alt = f && ((b.nach.ueb.einl || {})[f.id] || {}).zu; r.bereich = 'Nacharbeit › Spendenübergabe';
      mitF('', x => { const E = b.nach.ueb.einl = Object.assign({}, b.nach.ueb.einl); E[x.id] = Object.assign({}, E[x.id], { zu: ja ? 'ja' : 'nein' }); if (ja && !b.nach.ueb.mit.includes(x.id)) b.nach.ueb.mit.push(x.id); }, (ja ? 'kommt' : 'kommt nicht') + (v.person ? ' · ' + v.person : ''), ja ? 't-ok' : 't-err');
      r.vorher = alt === 'ja' ? 'kommt' : alt === 'nein' ? 'kommt nicht' : 'Teilnahme offen'; r.schon = !!f && alt === (ja ? 'ja' : 'nein'); break; }
    case 'kontakt': { const c = kontaktAusText(v.wert || v.person || ''); r.bereich = 'Förderplan'; mitF('', x => { if (x.kontakte.length < MAX_KONTAKTE) x.kontakte.push(c); else x.notiz = (x.notiz ? x.notiz.trim() + '\n' : '') + '* Kontakt: ' + kontaktText(c); }, '+ ' + [c.n, c.rolle, c.mail, c.tel].filter(Boolean).join(' · '), 't-neu');
      r.vorher = f && f.kontakte.some(x => x.n) ? f.kontakte.filter(x => x.n).map(x => x.n).join(', ') : 'kein Kontakt'; r.ok = r.ok && !!c.n; r.schon = !!f && f.kontakte.some(x => kkey(x.n) === kkey(c.n)); break; }
    case 'freigabe': { const k = /verw/i.test(v.wert) ? 'verw' : /fach/i.test(v.wert) ? 'fach' : /ofk|orts/i.test(v.wert) ? 'ofk' : '', ja = !/nein|ab/i.test(v.ergebnis || ''), st = ja ? 'ok' : 'nein', it = b && k ? frItems(b).find(i => i.k === k) : null;
      r.bereich = 'Freigabe'; r.vorher = it ? frName(it) + ': ' + (frText(it) || it.st) : '–'; r.nachher = (it ? frName(it) : 'Freigabe') + ': ' + (k ? FR_DEF[k][st] : ja ? 'zugestimmt' : 'abgelehnt') + (d ? ' am ' + fmtDate(d) : ''); r.ton = ja ? 't-ok' : 't-err';
      r.ok = !!b && !!k; r.schon = !!b && !!k && b.freigabe[k].st === st; r.fn = () => { const i2 = b.freigabe[k], alt = i2.st; i2.st = st; effects(b, b, 'freigabe.' + k + '.st', st, alt); if (d) i2.erledigt = d; }; break; }
    case 'unterlage': { const u = b && b.unterlagen.find(x => norm(x.name) === norm(v.wert) || norm(v.wert || '').includes(norm(x.name))); r.bereich = 'Unterlagen';
      r.vorher = u ? u.name + ': ' + ulText(u) : (v.wert || 'Unterlage') + ': noch nicht in der Liste'; r.nachher = (u ? u.name : v.wert || 'Unterlage') + ': ' + (u ? (ulOpts(u).find(o => o[0] === 'da') || [, 'liegt vor'])[1] : 'vorhanden'); r.ton = 't-ok';
      r.ok = !!b && !!(u || v.wert); r.schon = !!u && u.st === 'da'; r.fn = () => { if (u) u.st = 'da'; else b.unterlagen.push(UL(v.wert, 'da')); }; break; }
    case 'uebergabe_termin': { const u = b && b.nach.ueb; r.bereich = 'Nacharbeit › Spendenübergabe'; r.vorher = u && u.termin ? fmtDate(u.termin) + (u.zeit ? ' · ' + u.zeit + ' Uhr' : '') + (u.ort ? ' · ' + u.ort : '') : 'noch kein Termin';
      r.nachher = (d ? fmtDate(d) : '?') + (v.uhrzeit ? ' · ' + v.uhrzeit + ' Uhr' : '') + (v.ort ? ' · ' + v.ort : ''); r.ok = !!b && !!d; r.schon = !!u && u.termin === d && (!v.ort || u.ort === v.ort);
      r.fn = () => { const w = b.nach.ueb; w.noetig = true; w.termin = d; if (v.uhrzeit) w.zeit = v.uhrzeit; if (v.ort) w.ort = v.ort; }; break; }
    case 'presse': r.bereich = 'Nacharbeit › Spendenübergabe'; r.vorher = 'Presse: offen'; r.nachher = [v.person, v.wert].filter(Boolean).join(' · '); r.ok = !!b;
      r.fn = () => { const u = b.nach.ueb; u.info = (u.info ? u.info.trim() + '\n' : '') + '* Presse: ' + [v.person, v.wert].filter(Boolean).join(' – '); }; break;
    case 'geldeingang': mitF('zugesagt', x => { if (x.zugesagt == null) x.zugesagt = betrag; x.eingegangen = betrag; x.eingangAm = d || today(); }, 'eingegangen' + (betrag ? ' · ' + eur(betrag) : '') + (d ? ' · am ' + fmtDate(d) : ''), 't-ok');
      r.ok = r.ok && !!betrag; r.schon = !!f && +f.eingegangen === betrag; break;
    case 'pressemitteilung': r.bereich = 'Nacharbeit'; r.vorher = b ? 'Pressemitteilung: ' + (b.nach.pm.st === 'erledigt' ? 'erschienen' : 'offen') : '–'; r.nachher = 'erschienen' + (d ? ' am ' + fmtDate(d) : ''); r.ton = 't-ok'; r.ok = !!b; r.schon = !!b && b.nach.pm.st === 'erledigt'; r.fn = () => { b.nach.pm.st = 'erledigt'; if (d) b.nach.pm.datum = d; }; break;
    case 'fl_frist': { const e = flAktiv() && flEintrag(v.fl); r.bereich = 'Fördererliste'; r.fl = e; r.vorher = e ? (e.fristenL.length ? e.fristenL.map(x => fristText(x.d)).join(', ') : 'keine Frist') : '–'; r.nachher = 'Frist ' + (d ? fmtDate(d) : '?'); r.ok = !!e && !!d; r.schon = !!e && e.fristenL.some(x => x.d === d);
      r.fn = () => { e.fristenL.push({ id: uid('fr'), d, topf: e.topfe.length ? e.topfe[0].name : '' }); }; break; }
    case 'neuer_bedarf': r.bereich = 'Neuer Bedarf'; r.nachher = v.wert || '?'; r.info = 'Neuer Bedarf – über den KI-Knopf „Bedarf aus Daten erstellen“ anlegen.'; break;
    default: r.nachher = v.wert || v.art;
  }
  return r;
}
// Art des Vorschlags für die Darstellung: info (steht schon so drin / nur Hinweis), unassigned (Bedarf oder Förderer fehlt), sicher, unsicher
const peKind = (v, w) => w.info || (w.schon && w.ok) ? 'info' : !w.b && !w.fl ? 'unassigned' : !w.ok && w.brauchtF && !w.f ? 'unassigned' : norm(v.sicherheit) === 'unsicher' || !w.ok ? 'unsicher' : 'sicher';

/* ---------- Hinweis oben und Prüffenster (Entwurf „1c“: links die Vorschläge, rechts Belegstelle und „bisher → neu“) */
const PE_MAIL_SVG = '<svg width="15" height="12" viewBox="0 0 15 12" aria-hidden="true"><rect x="1" y="1" width="13" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 1.8l6 4.6 6-4.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
function peChip() {
  if (!PE.L.length) return '';
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
  const W = () => PE.L.map(v => { const w = peWirkung(v, assign[v.key] || {}); return { v, w, k: peKind(v, w) }; });
  let X = W(); const AKT = () => X.filter(x => x.k !== 'info'), INF = () => X.filter(x => x.k === 'info');
  AKT().forEach(x => { if (!(x.v.key in dec)) dec[x.v.key] = (E0[x.v.key] || {}).d || (x.k === 'sicher' ? 'accept' : null); });
  let sel = (AKT().find(x => !dec[x.v.key]) || AKT()[0] || X[0]).v.key, filter = 'alle', infoOpen = false, warnAssign = false;
  const datum = (PE.letzte.match(/(\d{4})-(\d{2})-(\d{2})/) || []);
  const box = h('div', { class: 'pe2' }); let zu = () => {};
  const zahlen = () => { const c = { accept: 0, reject: 0, later: 0, open: 0 }; AKT().forEach(x => c[dec[x.v.key] || 'open']++); return c; };
  const sichtbar = () => filter === 'offen' ? AKT().filter(x => !dec[x.v.key] || x.v.key === sel) : AKT();
  const naechster = from => { const L = AKT(), i = L.findIndex(x => x.v.key === from), o = [...L.slice(i + 1), ...L.slice(0, i)]; return (o.find(x => !dec[x.v.key]) || L[Math.min(i + 1, L.length - 1)] || L[0]).v.key; };
  const entscheiden = (key, d) => { const x = X.find(y => y.v.key === key); if (!x || x.k === 'info') return;
    if (d === 'accept' && (x.k === 'unassigned' || !x.w.ok)) { warnAssign = true; zeig(); const s = box.querySelector('.pe2-zu select'); if (s) s.focus(); return; }
    dec[key] = d; warnAssign = false; sel = naechster(key); zeig(); fokus(); };
  const fokus = () => { const r = box.querySelector('.pe2-row.sel'); if (r) { r.focus({ preventScroll: true }); r.scrollIntoView({ block: 'nearest' }); } };
  const mailTeil = (v, i) => String(v.mail || '').split('|').map(s => s.trim())[i] || '';
  const zeile = x => { const d = dec[x.v.key], gl = x.w.b ? (x.w.b.gliederung || '') : x.w.fl ? 'Fördererliste' : 'ohne Bedarf';
    const r = h('div', { class: 'pe2-row' + (x.v.key === sel ? ' sel' : '') + (d === 'reject' ? ' rejected' : ''), role: 'option', tabindex: x.v.key === sel ? '0' : '-1', 'aria-selected': String(x.v.key === sel) },
      h('span', { class: 'pe2-ic ' + x.k, 'aria-label': x.k === 'unassigned' ? 'nicht zuzuordnen' : x.k }, PE_ICON[x.k]),
      h('div', { class: 'pe2-rm' }, h('div', { class: 'pe2-who' }, mailTeil(x.v, 1) || x.w.art), h('div', { class: 'pe2-what' }, x.w.art + ' · ' + gl)),
      h('div', { class: 'pe2-meta' }, h('span', null, (mailTeil(x.v, 0) || '').slice(0, 6)), x.k === 'info' ? null : h('span', { class: 'pe2-dec ' + (d || 'open') }, d ? PE_DL[d] : 'offen')));
    r.addEventListener('click', () => { sel = x.v.key; warnAssign = false; zeig(); fokus(); }); return r; };
  const detail = () => {
    const x = X.find(y => y.v.key === sel) || X[0], v = x.v, w = x.w, d = dec[v.key], a = assign[v.key] || {};
    const pfad = w.b ? [h('b', null, w.b.titel || 'Bedarf'), ' (' + (w.b.gliederung || '–') + ') › ' + w.bereich.replace(/ › /g, ' › ') + (w.f ? ' › ' + w.f.name.trim() : w.brauchtF && a.foerderer === '__neu' ? ' › neuer Förderer' : '')] : w.fl ? [h('b', null, 'Fördererliste'), ' › ' + (w.fl.name || '')] : [h('b', null, 'Kein passender Bedarf gefunden')];
    const zit = String(v.zitat || '').replace(/^[„"…\s]+|[“"…\s]+$/g, '');
    const mail = h('div', { class: 'pe2-card' }, h('div', { class: 'pe2-mm' }, h('span', null, h('b', null, mailTeil(v, 1) || 'E-Mail'), mailTeil(v, 2) ? ' · „' + mailTeil(v, 2) + '“' : ''), h('span', null, mailTeil(v, 0))),
      zit ? h('div', { class: 'pe2-quote' }, h('span', { class: 'pe2-dim' }, '… '), h('mark', null, zit), h('span', { class: 'pe2-dim' }, ' …')) : h('div', { class: 'pe2-dim' }, 'Kein Belegsatz geliefert.'),
      h('span', { class: 'pe2-dim small' }, 'Belegstelle aus der E-Mail · ganze Mail in Outlook über Absender und Betreff finden'));
    const bisherNeu = h('div', { class: 'pe2-diff' }, x.k === 'unassigned' ? null : h('label', null, 'bisher', h('span', { class: 'pe2-val old' }, w.vorher || '–')), x.k === 'unassigned' ? null : h('span', { class: 'pe2-arrow' }, '→'),
      h('label', null, 'neu', h('span', { class: 'pe2-val new ' + w.ton }, w.nachher || '–')));
    let zuord = null;
    if (x.k === 'unassigned') {
      const sb = h('select', { class: warnAssign && !(a.bedarf || w.b) ? 'warn' : '', 'aria-label': 'bei Bedarf' }, h('option', { value: '' }, 'Bedarf wählen …'), ...D.bedarfe.filter(b => !b.archiv).map(b => h('option', { value: b.id, selected: (a.bedarf || (w.b && w.b.id)) === b.id }, (b.titel || '(ohne Namen)') + (b.gliederung ? ' · ' + b.gliederung : ''))));
      sb.addEventListener('change', () => { assign[v.key] = Object.assign({}, assign[v.key], { bedarf: sb.value, foerderer: (assign[v.key] || {}).foerderer || (w.brauchtF ? '__neu' : '') }); warnAssign = false; X = W(); zeig(); });
      const bb = D.bedarfe.find(b => b.id === (a.bedarf || (w.b && w.b.id)));
      const sf = w.brauchtF ? h('select', { 'aria-label': 'Förderer', disabled: !bb }, h('option', { value: '__neu' }, 'Neu anlegen aus Absender'), ...(bb ? bb.foerderer.filter(f => f.name.trim()).map(f => h('option', { value: f.id, selected: a.foerderer === f.id }, f.name.trim())) : [])) : null;
      if (sf) sf.addEventListener('change', () => { assign[v.key] = Object.assign({}, assign[v.key], { foerderer: sf.value }); X = W(); zeig(); });
      zuord = h('div', { class: 'pe2-zu' }, h('label', null, 'bei Bedarf', sb), sf ? h('label', null, 'Förderer', sf) : null);
    }
    const status = x.k === 'info' ? null : d === 'accept' ? ['wird übernommen', 'ok'] : d === 'reject' ? ['wird verworfen', 'err'] : d === 'later' ? ['bleibt für später', 'muted'] : [x.k === 'unassigned' ? (warnAssign ? 'Erst einen Bedarf wählen' : 'Zuordnen oder ignorieren') : 'Bitte bewusst entscheiden', 'warn'];
    const knopf = (dd, cls, t, kbd) => { const bt = h('button', { type: 'button', class: 'pe2-act ' + cls, 'aria-pressed': String(d === dd) }, t, h('kbd', null, kbd)); bt.addEventListener('click', () => entscheiden(v.key, dd)); return bt; };
    const akt = x.k === 'info' ? h('div', { class: 'pe2-infonote' }, w.info || '= Steht schon so in der Bedarfsliste. Es wird nichts geändert.')
      : h('div', { class: 'pe2-actions', role: 'group', 'aria-label': 'Entscheidung' }, knopf('accept', 'a', '✓ Übernehmen', 'A'), knopf('reject', 'r', '✕ ' + (x.k === 'unassigned' ? 'Ignorieren' : 'Verwerfen'), 'X'), knopf('later', 'l', 'Später', 'S'), h('span', { class: 'pe2-status ' + status[1] }, status[0]));
    return [mail, h('div', { class: 'pe2-cap' }, 'Daraus wird in der Bedarfsliste'),
      h('div', { class: 'pe2-card pe2-change' }, h('span', { class: 'pe2-crumb' }, ...pfad), h('div', { class: 'pe2-art' }, w.art, norm(v.sicherheit) === 'unsicher' && x.k !== 'info' ? h('span', { class: 'pe2-tag' }, '! unsicher') : null), bisherNeu, zuord, akt)];
  };
  const zeig = () => {
    const c = zahlen(), n = AKT().length, fertig = n - c.open;
    const segs = h('div', { class: 'pe2-segs' }, ...AKT().map(x => h('div', { class: 'pe2-seg ' + (dec[x.v.key] || '') + (!dec[x.v.key] && x.k !== 'sicher' ? ' unsure' : '') + (x.v.key === sel ? ' cur' : '') })));
    const pstate = c.open ? h('button', { type: 'button', class: 'pe2-open', onclick: () => { filter = 'offen'; sel = AKT().find(x => !dec[x.v.key]).v.key; zeig(); fokus(); } }, 'Noch ' + c.open + ' offen → zeigen') : n ? h('span', { class: 'pe2-done' }, '✓ Alles geprüft') : null;
    const fb = (k, t) => h('button', { type: 'button', 'aria-pressed': String(filter === k), onclick: () => { filter = k; zeig(); } }, t);
    const rows = h('div', { class: 'pe2-rows', role: 'listbox', 'aria-label': 'Vorschläge' }, ...sichtbar().map(zeile));
    const inf = INF().length ? [h('button', { type: 'button', class: 'pe2-infohead', 'aria-expanded': String(infoOpen), onclick: () => { infoOpen = !infoOpen; zeig(); } }, (infoOpen ? '▾ ' : '▸ ') + 'Steht schon so drin · ' + INF().length + ' ', h('span', null, 'nur Info')), ...(infoOpen ? INF().map(zeile) : [])] : [];
    const zus = [c.accept && c.accept + ' übernehmen', c.reject && c.reject + ' verworfen', c.later && c.later + ' später', c.open && c.open + ' offen'].filter(Boolean).join(' · ');
    const los = h('button', { type: 'button', class: 'primary pe2-los', disabled: !c.accept && !c.reject, onclick: () => zu('los') }, c.accept ? c.accept + ' übernehmen' : c.reject ? 'Verwerfen bestätigen' : '0 übernehmen');
    box.replaceChildren(
      h('div', { class: 'pe2-head' }, h('div', { class: 'pe2-title' }, h('h2', null, 'Vorschläge aus E-Mails'), h('small', null, datum.length ? 'Copilot hat am ' + datum[3] + '.' + datum[2] + '.' + datum[1] + ' Posteingang und Gesendete gelesen' : 'Aus deinen E-Mails, gelesen von Copilot'), h('button', { type: 'button', class: 'x', 'aria-label': 'Schließen', onclick: () => zu('spaeter') }, '×')),
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
async function peEinstDialog() {
  const S = peEinst();
  const gr = g => h('section', { class: 'pe-eg' }, h('label', { class: 'pe-eh' }, h('input', { type: 'checkbox', checked: S[g], onchange: e => { S[g] = e.target.checked; } }), h('b', null, PE_GRUPPEN[g])),
    h('ul', { class: 'pe-el' }, ...PE_ARTEN.filter(a => a[1] === g).map(a => h('li', null, a[2]))));
  const kop = h('button', { type: 'button', onclick: () => flcTextKopieren(PE_SATZ, 'Satz kopiert – in Cowork als geplante Aufgabe einfügen') }, 'Satz kopieren');
  const stand = h('p', { class: 'muted small' }, PE.letzte ? 'Letzte Datei von Copilot: „' + PE.letzte + '“.' : rechOrdnerOk() ? 'Noch keine Datei „Posteingang …“ von Copilot im Ordner.' : 'Ordner nicht verbunden – die Dateien für Copilot werden geschrieben, sobald die Bedarfsliste mit ihrem Ordner verbunden ist.');
  const body = h('div', { class: 'pe-einst' },
    h('p', null, 'Copilot Cowork liest werktags früh deine E-Mails (Posteingang und Gesendete) und schlägt vor, was sich geändert hat. Übernommen wird erst, wenn du es bestätigst.'),
    h('h3', null, 'Wonach gesucht wird'), gr('A'), gr('B'), gr('C'),
    h('h3', null, 'Einmal in Cowork einrichten'),
    h('ol', { class: 'pe-schritte' },
      h('li', null, 'Copilot Cowork öffnen → „Automatisierungen“ bzw. „Geplante Aufgabe“ neu anlegen.'),
      h('li', null, 'Wiederholung: Montag bis Freitag, früh morgens (z. B. 6:00 Uhr – achte darauf, ob Cowork die Zeit in UTC erwartet: dann im Winter 5:00, im Sommer 4:00).'),
      h('li', null, 'Als Auftrag nur diesen Satz einfügen: ', h('q', null, PE_SATZ), ' ', kop),
      h('li', null, 'Fertig. Ändert sich hier etwas, schreibt das Programm die Auftragsdatei neu – die Aufgabe in Cowork bleibt, wie sie ist.')),
    stand);
  const ok = await modal('E-Mail-Auswertung', body, [['Abbrechen', false], ['Speichern', true, 'primary']], { wide: true, cls: 'pe-einst-modal' });
  if (!ok) return;
  D.settings.mailAusw = { A: !!S.A, B: !!S.B, C: !!S.C }; changed();
  if (await peSchreiben(true)) toast('Gespeichert – Auftragsdatei für Copilot aktualisiert.', 'ok'); else toast('Gespeichert. Die Auftragsdatei wird geschrieben, sobald der Ordner verbunden ist.', 'ok');
}
