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
async function peScan() {
  if (!rechOrdnerOk() || PE.busy) return;
  const d = await rechDir(); if (!d) return;
  const F = [], erl = new Set(peErledigt()); let letzte = '';
  try { for await (const [n, e] of d.entries()) { if (e.kind !== 'file' || !PE_RE.test(n)) continue; const f = await e.getFile(); const k = n + '@' + f.lastModified; if (n > letzte) letzte = n; if (!erl.has(k)) F.push({ n, k, f }); } } catch (e) { return; }
  PE.letzte = letzte;
  const L = []; for (const x of F.sort((a, c) => a.n.localeCompare(c.n))) L.push(...peLesen(await x.f.text(), x.n));
  const vorher = PE.L.length; PE.L = L; PE.dateien = F.map(x => x.k);
  if (PE.L.length !== vorher || (F.length && !L.length)) {
    if (F.length && !L.length) { D.settings.mailErledigt = peErledigt().concat(PE.dateien).slice(-120); PE.dateien = []; changed(); }   // „Keine Vorschläge“: gleich als gesehen merken
    safeRender();
  }
}

/* ---------- Was ein Vorschlag im Programm ändert: { b, f, txt, ok, schon, fn } */
function peWirkung(v) {
  const b = D.bedarfe.find(x => x.id === v.bedarf), f = b && b.foerderer.find(x => x.id === v.foerderer), d = peDatum(v.datum), betrag = peBetrag(v.betrag);
  const A = PE_ARTEN.find(a => a[0] === v.art), r = { b, f, art: A ? A[2] : v.art, txt: '', ok: false, schon: false, fn: null };
  const fn = (b && (b.titel || 'Bedarf')) || '', fName = f ? f.name.trim() : (v.foerderer || '');
  const stand = (neu, extra) => { r.ok = !!f; r.schon = !!f && f.status === neu && !extra; r.fn = () => { const alt = f.status; if (alt !== neu) { f.status = neu; effects(b, f, 'status', neu, alt); } if (extra) extra(); }; };
  switch (v.art) {
    case 'antrag': r.txt = fName + ': beantragt' + (d ? ' am ' + fmtDate(d) : '') + (v.wert ? ' · ' + v.wert : ''); stand('beantragt', () => { if (d) f.beantragtAm = d; const e = peDatum(v.wert); if (e) f.erwartet = e; }); r.schon = !!f && ['beantragt', 'zugesagt', 'abgelehnt'].includes(f.status); break;
    case 'zusage': r.txt = fName + ': zugesagt' + (betrag ? ', ' + eur(betrag) : '') + (d ? ' am ' + fmtDate(d) : ''); stand('zugesagt', () => { if (betrag) f.zugesagt = betrag; if (d) f.entscheidungAm = d; }); r.schon = !!f && f.status === 'zugesagt' && (!betrag || +f.zugesagt === betrag); break;
    case 'absage': r.txt = fName + ': abgelehnt' + (v.grund ? ' – ' + v.grund : ''); stand('abgelehnt', () => { if (v.grund) f.grund = v.grund; if (d) f.entscheidungAm = d; }); r.schon = !!f && f.status === 'abgelehnt'; break;
    case 'nachforderung': r.txt = fName + ': Nachforderung – ' + (v.wert || 'siehe E-Mail') + (d ? ' (bis ' + fmtDate(d) + ')' : ''); r.ok = !!f; r.fn = () => { f.notiz = (f.notiz ? f.notiz.trim() + '\n' : '') + '* Nachforderung ' + fmtDate(today()) + ': ' + (v.wert || 'siehe E-Mail') + (d ? ' – bis ' + fmtDate(d) : ''); if (d && f.status === 'beantragt') f.erwartet = d; }; break;
    case 'nachweis': r.txt = fName + ': Verwendungsnachweis bis ' + (d ? fmtDate(d) : '?'); r.ok = !!f && !!d; r.schon = !!f && f.vn.frist === d; r.fn = () => { f.vn.noetig = true; f.vn.frist = d; }; break;
    case 'uebergabe_foerderer': { const ja = /^j/i.test(v.wert || ''); r.txt = fName + (ja ? ' kommt zur Spendenübergabe' : ' kommt nicht zur Spendenübergabe') + (v.person ? ' (' + v.person + ')' : ''); r.ok = !!f;
      r.schon = !!f && ((b.nach.ueb.einl || {})[f.id] || {}).zu === (ja ? 'ja' : 'nein'); r.fn = () => { const E = b.nach.ueb.einl = Object.assign({}, b.nach.ueb.einl); E[f.id] = Object.assign({}, E[f.id], { zu: ja ? 'ja' : 'nein' }); if (ja && !b.nach.ueb.mit.includes(f.id)) b.nach.ueb.mit.push(f.id); }; break; }
    case 'kontakt': { const c = kontaktAusText(v.wert || v.person || ''); r.txt = fName + ': Ansprechperson ' + [c.n, c.rolle, c.mail, c.tel].filter(Boolean).join(', '); r.ok = !!f && !!c.n; r.schon = !!f && f.kontakte.some(x => kkey(x.n) === kkey(c.n)); r.fn = () => { if (f.kontakte.length < MAX_KONTAKTE) f.kontakte.push(c); else f.notiz = (f.notiz ? f.notiz.trim() + '\n' : '') + '* Kontakt: ' + kontaktText(c); }; break; }
    case 'freigabe': { const k = /verw/i.test(v.wert) ? 'verw' : /fach/i.test(v.wert) ? 'fach' : /ofk|orts/i.test(v.wert) ? 'ofk' : '', ja = !/nein|ab/i.test(v.ergebnis || ''), st = ja ? 'ok' : 'nein';
      r.txt = (k ? frName(frItems(b || blank()).find(i => i.k === k) || { label: k, k, item: {} }) : 'Freigabe') + ': ' + (k ? FR_DEF[k][st] : (ja ? 'zugestimmt' : 'abgelehnt')) + (d ? ' am ' + fmtDate(d) : '');
      r.ok = !!b && !!k; r.schon = !!b && !!k && b.freigabe[k].st === st; r.fn = () => { const it = b.freigabe[k], alt = it.st; it.st = st; effects(b, b, 'freigabe.' + k + '.st', st, alt); if (d) it.erledigt = d; }; break; }
    case 'unterlage': { const u = b && b.unterlagen.find(x => norm(x.name) === norm(v.wert) || norm(v.wert).includes(norm(x.name))); r.txt = 'Unterlage ' + (u ? u.name : v.wert || '?') + ': liegt vor'; r.ok = !!u; r.schon = !!u && u.st === 'da';
      r.fn = () => { u.st = 'da'; }; if (b && !u && v.wert) { r.ok = true; r.fn = () => { b.unterlagen.push(UL(v.wert, 'da')); }; r.txt = 'Unterlage „' + v.wert + '“ neu: liegt vor'; } break; }
    case 'uebergabe_termin': r.txt = 'am ' + (d ? fmtDate(d) : '?') + (v.uhrzeit ? ', ' + v.uhrzeit + ' Uhr' : '') + (v.ort ? ', ' + v.ort : ''); r.ok = !!b && !!d; r.schon = !!b && b.nach.ueb.termin === d && (!v.ort || b.nach.ueb.ort === v.ort);
      r.fn = () => { const u = b.nach.ueb; u.noetig = true; u.termin = d; if (v.uhrzeit) u.zeit = v.uhrzeit; if (v.ort) u.ort = v.ort; }; break;
    case 'presse': r.txt = [v.person, v.wert].filter(Boolean).join(' – '); r.ok = !!b; r.fn = () => { const u = b.nach.ueb; u.info = (u.info ? u.info.trim() + '\n' : '') + '* Presse: ' + [v.person, v.wert].filter(Boolean).join(' – ') + ' (E-Mail ' + (v.mail || '').split('|')[0].trim() + ')'; }; break;
    case 'geldeingang': r.txt = fName + ': Geld eingegangen' + (betrag ? ', ' + eur(betrag) : '') + (d ? ' am ' + fmtDate(d) : ''); r.ok = !!f && !!betrag; r.schon = !!f && +f.eingegangen === betrag;
      r.fn = () => { const alt = f.status; if (alt !== 'zugesagt') { f.status = 'zugesagt'; effects(b, f, 'status', 'zugesagt', alt); if (f.zugesagt == null) f.zugesagt = betrag; } f.eingegangen = betrag; f.eingangAm = d || today(); }; break;
    case 'pressemitteilung': r.txt = (d ? 'am ' + fmtDate(d) : ''); r.ok = !!b; r.schon = !!b && b.nach.pm.st === 'erledigt'; r.fn = () => { b.nach.pm.st = 'erledigt'; if (d) b.nach.pm.datum = d; }; break;
    case 'fl_frist': { const e = flAktiv() && flEintrag(v.fl); r.txt = (e ? e.name : v.fl || 'Förderer') + ': Frist ' + (d ? fmtDate(d) : '?'); r.ok = !!e && !!d; r.schon = !!e && e.fristenL.some(x => x.d === d); r.fn = () => { e.fristenL.push({ id: uid('fr'), d, topf: e.topfe.length ? e.topfe[0].name : '' }); }; r.fl = e; break; }
    case 'neuer_bedarf': r.txt = 'Neuer Bedarf: ' + (v.wert || '?'); r.ok = false; r.info = true; break;
    default: r.txt = v.art + ': ' + (v.wert || '');
  }
  return r;
}

/* ---------- Hinweis oben und Prüffenster */
const peZahl = () => PE.L.length;
const peChip = () => peZahl() ? `<button class="pe-chip" data-act="pe-oeffnen" title="Copilot hat in deinen E-Mails neue Informationen gefunden – prüfen und übernehmen">✉ ${peZahl()} ${peZahl() === 1 ? 'Vorschlag' : 'Vorschläge'} aus E-Mails</button>` : '';
async function peDialog() {
  if (!PE.L.length) { toast('Keine neuen Vorschläge aus E-Mails.'); return; }
  const W = PE.L.map(v => Object.assign({ v }, peWirkung(v))), an = W.map(w => w.ok && !w.schon && norm(w.v.sicherheit) !== 'unsicher');
  const gruppe = new Map(); W.forEach((w, i) => { const k = w.b ? w.b.id : w.fl ? 'fl' : '?'; if (!gruppe.has(k)) gruppe.set(k, []); gruppe.get(k).push(i); });
  const zeile = i => { const w = W[i], c = h('input', { type: 'checkbox', checked: an[i], disabled: !w.ok || w.schon, onchange: e => { an[i] = e.target.checked; zahl(); } });
    return h('label', { class: 'pe-z' + (!w.ok || w.schon ? ' aus' : '') }, c, h('div', { class: 'pe-zt' },
      h('div', null, h('b', null, w.art), ' ', h('span', null, w.txt), w.schon ? h('span', { class: 'pe-tag' }, 'steht schon so drin') : !w.ok && !w.info ? h('span', { class: 'pe-tag warn' }, 'nicht zuzuordnen') : norm(w.v.sicherheit) === 'unsicher' ? h('span', { class: 'pe-tag' }, 'unsicher') : null),
      w.v.zitat ? h('div', { class: 'pe-zi' }, w.v.zitat) : null, w.v.mail ? h('div', { class: 'pe-mail muted small' }, '✉ ' + w.v.mail) : null)); };
  const titel = k => k === '?' ? 'Nicht zugeordnet' : k === 'fl' ? 'Fördererliste' : (D.bedarfe.find(b => b.id === k) || {}).titel || 'Bedarf';
  const los = h('span', null, 'Übernehmen'), zahl = () => { const n = an.filter(Boolean).length; los.textContent = n ? n + ' übernehmen' : 'Übernehmen'; };
  const body = h('div', { class: 'pe-box' }, ...[...gruppe.entries()].map(([k, I]) => h('section', { class: 'pe-g' }, h('h3', null, titel(k)), ...I.map(zeile))),
    h('p', { class: 'muted small' }, 'Vorschläge aus ' + PE.dateien.length + (PE.dateien.length === 1 ? ' Datei' : ' Dateien') + ' von Copilot im Ordner „' + RECH_DIR + '“. Nach „Übernehmen“ oder „Verwerfen“ werden sie nicht mehr angezeigt; ↶ macht die Übernahme rückgängig.'));
  zahl();
  const k = await modal('Vorschläge aus E-Mails', body, [['Verwerfen', 'weg', 'link'], ['Später', false], [los, true, 'primary']], { wide: true, cls: 'pe-modal' });
  if (k !== true && k !== 'weg') return;
  const vorher = JSON.stringify(D); let n = 0;
  if (k === true) W.forEach((w, i) => { if (an[i] && w.fn) { try { w.fn(); n++; } catch (e) { console.warn(e); } } });
  D.settings.mailErledigt = peErledigt().concat(PE.dateien).slice(-120); PE.L = []; PE.dateien = [];
  changed(); safeRender();
  toast(k === true ? n + (n === 1 ? ' Änderung' : ' Änderungen') + ' aus E-Mails übernommen' : 'Vorschläge verworfen', 'ok', undoGanz(vorher));
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
