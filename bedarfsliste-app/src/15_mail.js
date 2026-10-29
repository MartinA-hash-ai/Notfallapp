/* ===================================================================== Rundmail, E-Mail-Vorlagen, Kalendereintrag und Fachreferat (ab 0.61)
   Rundmail: Knopf mit drei Umschlägen bei „Zuständig“, beim Fachreferat und bei der Spendenübergabe. Fragt, an wen und welche Art
   (Blanko oder eine Vorlage) und öffnet dann Outlook mit allen Empfängern. Die Vorlagen stehen in der Datei der Bedarfsliste
   (D.settings.vorlagen) und gelten für alle, die mit ihr arbeiten – bearbeiten über das Zahnrad → „E-Mail-Vorlagen …“. */

const ICON_RUND = '<svg viewBox="0 0 24 20" width="19" height="16" aria-hidden="true"><g stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">'
  + [[8, 1.5], [5, 5], [2, 8.5]].map(([x, y]) => `<rect x="${x}" y="${y}" width="14" height="9.5" rx="1.2" style="fill:var(--card)"/><path d="M${x + .4} ${y + .7}l6.6 4.9 6.6-4.9" fill="none"/>`).join('') + '</g></svg>';
const ICON_KAL = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.7" y="2.7" width="12.6" height="11.6" rx="1.5"/><path d="M1.7 6.3h12.6M5 1v3M11 1v3"/></g></svg>';
const rundKnopf = (art, t) => `<button class="k-pliste k-rund" data-act="rundmail" data-v="${art}" title="${esc(t)}" aria-label="${esc(t)}">${ICON_RUND}</button>`;

const VL_FUER = [['ueb', 'Spendenübergabe intern'], ['foe', 'Förderer einladen'], ['presse', 'Presse und Öffentlichkeit'], ['zust', 'Zuständige'], ['fach', 'Fachreferat'], ['alle', 'überall']];
// mitgelieferte Vorlagen je Bereich; gelöschte merkt sich D.settings.vorlagenWeg, damit sie nicht wiederkommen
const VL_STD = [
  { id: 'v-ueb', name: 'Absprache für Spendenübergabe', fuer: 'ueb', betreff: 'Spendenübergabe „{bedarf}“ – Absprache',
    text: 'Hallo zusammen,\n\nfür „{bedarf}“ ({gliederung}) planen wir die Spendenübergabe:\n\nWann: {wann}\nWo: {ort}\n\nGespendet haben:\n{spender}\n\nBitte gebt mir kurz Bescheid, wer von euch an der Übergabe teilnimmt.\n\nViele Grüße' },
  { id: 'v-ueb-einl', name: 'Einladung zur Spendenübergabe (intern)', fuer: 'ueb', betreff: 'Einladung: Spendenübergabe {ortkurz} – {bedarf}',
    text: 'Hallo zusammen,\n\nherzliche Einladung zur Spendenübergabe für „{bedarf}“:\n\nWann: {wann}\nWo: {ort}\n\nGespendet haben:\n{spender}\n\nVon den Förderern vor Ort:\n{vorort}\n\nPresse und Öffentlichkeit: {presse}\n\n{notizen}\n\nDen Kalendereintrag hänge ich an – einfach öffnen, dann steht der Termin im Kalender.\n\nViele Grüße' },
  { id: 'v-ueb-presse', name: 'Pressetermin zur Spendenübergabe', fuer: 'presse', betreff: 'Pressetermin: Spendenübergabe „{bedarf}“',
    text: 'Hallo zusammen,\n\nam {wann} findet in {ort} die Spendenübergabe für „{bedarf}“ ({gliederung}) statt.\n\nGespendet haben:\n{spender}\n\nKönnt ihr die Presse einladen bzw. Fotos und einen kurzen Bericht für unsere Kanäle übernehmen? Gebt mir bitte Bescheid, wer von euch dabei ist.\n\nViele Grüße' },
  { id: 'v-foe-einl', name: 'Einladung zur Spendenübergabe', fuer: 'foe', betreff: 'Einladung zur Spendenübergabe: „{bedarf}“',
    text: '{anrede}\n\nim Namen {malteser} danken wir Ihnen noch einmal herzlich für Ihre Unterstützung{ihre_foerderung}. Mit Ihrer Hilfe wird „{bedarf}“ möglich – darüber freuen wir uns sehr.\n\nGern möchten wir Sie zur offiziellen Spendenübergabe einladen:\n\nWann: {wann}\nWo: {ort}\n\nBei der Übergabe möchten wir auch einige Fotos machen. Bitte geben Sie uns kurz Bescheid, ob und mit wie vielen Personen Sie teilnehmen können.\n\nWir freuen uns auf Sie!\n\nMit freundlichen Grüßen' },
  { id: 'v-z-interview', name: 'Terminvereinbarung zum Interview', fuer: 'zust', betreff: 'Kurzes Gespräch zu „{bedarf}“',
    text: 'Hallo zusammen,\n\nfür die Förderanträge zu „{bedarf}“ möchte ich gern ein kurzes Gespräch (ca. 30 Minuten) mit euch führen: Wofür wird es gebraucht, wer profitiert davon, was ändert sich dadurch? Damit kann ich die Anträge gut begründen.\n\nWann passt es euch in den nächsten zwei Wochen? Gern auch per Teams.\n\nViele Grüße' },
  { id: 'v-z-unterlagen', name: 'Unterlagen anfragen', fuer: 'zust', betreff: 'Unterlagen für „{bedarf}“',
    text: 'Hallo zusammen,\n\nfür die Förderanträge zu „{bedarf}“ fehlen mir noch:\n{fehlt}\n\nKönnt ihr mir das in den nächsten zwei Wochen schicken oder in den Ordner legen?\n{link}\n\nViele Grüße' },
  { id: 'v-z-ueb-frage', name: 'Spendenübergabe: Wann passt es?', fuer: 'zust', betreff: 'Spendenübergabe „{bedarf}“ – Terminfrage',
    text: 'Hallo zusammen,\n\ndie Finanzierung für „{bedarf}“ steht – vielen Dank für eure Unterstützung! Gespendet haben:\n{spender}\n\nFür die Spendenübergabe mit den Förderern suchen wir einen Termin. Nennt mir bitte zwei, drei Termine, die euch passen, und einen geeigneten Ort (z. B. Wache oder Unterkunft).\n\nViele Grüße' },
  { id: 'v-z-ueb-einl', name: 'Einladung zur Spendenübergabe', fuer: 'zust', betreff: 'Einladung: Spendenübergabe „{bedarf}“',
    text: 'Hallo zusammen,\n\nherzliche Einladung zur Spendenübergabe für „{bedarf}“:\n\nWann: {wann}\nWo: {ort}\n\nMit dabei sind:\n{spender}\n\nSchön wäre es, wenn einige von euch in Dienstkleidung dabei sind – für die Fotos. Gebt mir bitte kurz Bescheid, wer kommt.\n\nViele Grüße' },
  { id: 'v-f-freigabe', name: 'Abfrage der Freigabe', fuer: 'fach', betreff: 'Bitte um Freigabe: „{bedarf}“ ({gliederung})',
    text: 'Hallo zusammen,\n\nfür „{bedarf}“ ({gliederung}, rund {summe}) bitten wir um die Freigabe durch das Fachreferat {fachreferat}.\n\nKurz zum Bedarf:\n{beschreibung}\n\nAnsprechperson vor Ort: {ansprechperson}\nUnterlagen: {link}\n\nGebt mir bitte bis Ende nächster Woche Rückmeldung, ob ihr den Bedarf befürwortet.\n\nViele Grüße' },
  { id: 'v-f-zusage', name: 'Info: Finanzierung steht', fuer: 'fach', betreff: 'Finanzierung steht: „{bedarf}“ ({gliederung})',
    text: 'Hallo zusammen,\n\nzur Info: Die Finanzierung für „{bedarf}“ ({gliederung}) steht. Gespendet haben:\n{spender}\n\nDie Spendenübergabe stimmen wir mit der Gliederung ab – wenn ihr dabei sein möchtet, gebt mir kurz Bescheid.\n\nViele Grüße' },
];
const VL_PLATZ = [['bedarf', 'Name des Bedarfs'], ['gliederung', 'Gliederung'], ['summe', 'Summe des Bedarfs'], ['wann', 'Termin der Spendenübergabe mit Uhrzeit'], ['ort', 'Ort der Spendenübergabe'],
  ['spender', 'Förderer mit Zusage und Betrag, je Zeile einer'], ['ansprechperson', 'Ansprechperson des Bedarfs'], ['fachreferat', 'Fachreferat'], ['link', 'Link zum Ordner'], ['beschreibung', 'Beschreibung des Bedarfs'], ['anrede', 'Förderer: einzeln „Guten Tag Name,“, gemeinsam „Sehr geehrte Damen und Herren,“'], ['malteser', '„der Malteser in Brakel“ bzw. „… in der Diözese Paderborn“'], ['ihre_foerderung', 'einzeln: „ in Höhe von 5.000 €“, gemeinsam leer'], ['foerderer', 'einzeln: Name des Förderers'], ['ortkurz', 'Gliederung bzw. Ort ohne Adresse (z. B. Paderborn)'], ['vorort', 'je Förderer, wer bei der Übergabe dabei ist'], ['presse', 'die angeklickte Person aus Presse und Öffentlichkeit'], ['notizen', 'Notizen zur Übergabe (mit Überschrift, sonst leer)'], ['fehlt', 'Unterlagen, die noch fehlen, je Zeile eine']];
const vorlagen = () => { const S = D.settings, eig = Array.isArray(S.vorlagen) ? S.vorlagen : [], weg = new Set(S.vorlagenWeg || []);
  return [...eig, ...VL_STD.filter(v => !weg.has(v.id) && !eig.some(e => e.id === v.id))]; };   // neue mitgelieferte kommen dazu
const WTAG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
function vlWerte(b) {
  const u = b.nach.ueb, Z = b.foerderer.filter(f => f.status === 'zugesagt' && f.name.trim()), mit = Z.filter(f => u.mit.includes(f.id));
  const wann = validIso(u.termin) ? WTAG[new Date(u.termin + 'T12:00').getDay()] + ', ' + fmtDate(u.termin) + (u.zeit ? ', ' + u.zeit + ' Uhr' : '') : 'noch offen';
  return { bedarf: b.titel || 'Bedarf', gliederung: b.gliederung === DIO ? 'Diözese' : b.gliederung || '', summe: b.summe ? eur(b.summe) : '', wann, ort: u.ort.trim() || 'noch offen',
    spender: (mit.length ? mit : Z).map(f => '- ' + f.name.trim() + (foeAmt(f) ? ': ' + eur(foeAmt(f)) : '')).join('\n') || '- (noch keine Zusage eingetragen)',
    ansprechperson: (b.zust[0] && b.zust[0].n) || '', fachreferat: b.freigabe.fach.name.trim(), link: okLink(b.link) ? b.link.trim() : '',
    beschreibung: String(b.beschreibung || '').replace(/\*\*|__|~~/g, '').replace(/^\s*[*•]\s+/gm, '- ').trim() || '(noch keine Beschreibung)',
    anrede: 'Sehr geehrte Damen und Herren,', ihre_foerderung: '', foerderer: '', malteser: !b.gliederung || b.gliederung === DIO ? 'der Malteser in der Diözese Paderborn' : 'der Malteser in ' + b.gliederung,
    fehlt: b.unterlagen.filter(u => u.st === 'fehlt' || u.st === 'arbeit').map(u => '- ' + u.name).join('\n') || '- (alles da)',
    ortkurz: ortKurz(b), vorort: dabeiListe(b).map(({ f, p }) => '- ' + f.name.trim() + ': ' + (p ? p.n : 'noch offen')).join('\n') || '- (noch niemand ausgewählt)',
    presse: presseGewaehlt(b).map(p => p.n).join(', ') || 'noch offen', notizen: u.info.trim() ? 'Notizen:\n' + u.info.trim() : '' };
}
// Ort für Titel und Kalender: die Gliederung (bei der Diözese der Ort aus der Adresse, sonst „Diözese“)
const ortKurz = b => b.gliederung && b.gliederung !== DIO ? b.gliederung : (b.nach.ueb.ort.match(/\b\d{5}\s+([^,]+)/) || [])[1] || 'Diözese';
// wer vom Förderer bei der Übergabe dabei ist: von Hand gewählt (nach.ueb.vorOrt), sonst der Hauptkontakt aus dem Förderer (meist aus der Förder-Kartei)
function vorOrt(b, f) {
  const V = b.nach.ueb.vorOrt || {};
  if (f.id in V) return V[f.id] && V[f.id].n ? V[f.id] : null;                       // null: bewusst niemand
  const c = f.kontakte.find(k => (k.n || '').trim()); return c ? { n: c.n.trim(), mail: (c.mail || '').trim() } : null;
}
// die Förderer der Übergabe: bei „Wer ist dabei?“ angehakt, sonst alle mit Zusage
const dabeiListe = b => { const Z = b.foerderer.filter(f => f.status === 'zugesagt' && f.name.trim()), M = b.foerderer.filter(f => b.nach.ueb.mit.includes(f.id) && f.name.trim());
  return (M.length ? M : Z).map(f => ({ f, p: vorOrt(b, f) })); };
// Presse und Öffentlichkeit: angeklickt = dabei (nach.ueb.presse.wahl); niemand angeklickt = noch offen
const presseGewaehlt = b => { const W = GRP.presse.obj(b).wahl || []; return grpZeig(b, 'presse').Z.filter(p => W.includes(kkey(p.n))); };
const vlFuellen = (t, W) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => W[k] != null ? W[k] : m).replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n');   // leere Platzhalter: keine Lücken

/* ---------- Presse und Öffentlichkeit: Personen mit diesem Fachreferat in der Personenliste; bei der Spendenübergabe anklickbar, anfangs alle gewählt */
const PRESSE_RE = /presse|öffentlichkeit|oeffentlichkeit|kommunikation/;
const pressePersonen = () => PR.list.filter(p => PRESSE_RE.test(norm(p.fach)));
// bei der Spendenübergabe: Karten mit E-Mail und Telefon, „+“ nimmt weitere dazu (z. B. jemanden vor Ort), der Stift ändert direkt, dazu die Rundmail
function presseBlock(b) {
  const ed = UI.pEdit === b.id, f = GRP.presse.obj(b), { Z, weg } = grpZeig(b, 'presse');
  const inhalt = ed ? personen(f.pers, { edit: true, p: 'nach.ueb.presse.pers', a: 'data-grp="presse"', mobil: true, max: 30, wer: 'Person', neu: [], ohnePlus: true })
    : Z.length ? personen(Z, { kompakt: true, mobil: true, lesen: true, wahl: { an: new Set(f.wahl || []), act: 'presse-wahl', t: ['Ist dabei – klicken: nicht mehr', 'Klicken: ist bei der Übergabe dabei (für Rundmail und Kalender)'] } }) : '<p class="muted small fach-hw">Niemand eingetragen – über „+“ aus der Personenliste dazunehmen (Spalte „Fachreferat“: Presse und Öffentlichkeit) oder jemanden vor Ort eintragen.</p>';
  const knopf = ed ? '<button class="k-fertig" data-act="k-fertig" data-grp="presse">Fertig</button>'
    : (Z.some(p => p.mail) || b.zust.some(z => (z.mail || '').trim()) ? rundKnopf('ueb', 'Rundmail intern: an Presse und Öffentlichkeit und die Zuständigen – Einladung, Absprache, Pressetermin') : '')
    + `<button class="k-pliste k-plus" data-act="k-neu" data-grp="presse" title="Person hinzufügen – aus der Personenliste oder neu eintragen (z. B. jemand vor Ort)" aria-label="Person zu Presse und Öffentlichkeit hinzufügen">+</button>`
    + `<button class="k-pen fach-pen" data-act="k-edit" data-grp="presse" title="Personen und Kontaktdaten bearbeiten" aria-label="Presse und Öffentlichkeit bearbeiten">${ICON_PEN}</button>`;
  return `<div class="sub fach-kopf presse-kopf">Presse und Öffentlichkeit${weg && !ed ? `<span class="fach-plus" title="${weg} ausgeblendet – über „+“ wieder dazunehmen">(+${weg})</span>` : ''}${knopf}</div><div class="fach-liste presse-liste${ed ? ' fach-ed' : ''}">${inhalt}</div>`;
}

/* ---------- Kalendereintrag für Outlook (.ics): Doppelklick auf die Datei trägt den Termin ein (1 Stunde; ohne Uhrzeit ganztägig) */
const icsText = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFalten = z => { const out = []; let s = z; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); };
const icsZeit = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
function icsBlob(b) {
  const u = b.nach.ueb, W = vlWerte(b), tag = u.termin.replace(/-/g, ''), m = /^(\d{1,2}):(\d{2})/.exec(u.zeit || '');
  const st = m ? new Date(u.termin + 'T' + m[1].padStart(2, '0') + ':' + m[2] + ':00') : null, jetzt = new Date();
  const ende = st ? new Date(st.getTime() + 36e5) : null, morgen = new Date(u.termin + 'T12:00'); morgen.setDate(morgen.getDate() + 1);
  // Beschreibung: Bedarf, Förderer mit Summe und wer von ihnen vor Ort ist, Presse und Öffentlichkeit, Notizen
  const Z = b.foerderer.filter(f => f.status === 'zugesagt' && f.name.trim()), dabei = new Map(dabeiListe(b).map(x => [x.f.id, x.p]));
  const beschr = ['Bedarf: ' + W.bedarf + (b.summe ? ' (' + eur(b.summe) + ')' : '') + (W.gliederung ? ' – ' + W.gliederung : ''), '',
    'Förderer:', ...(Z.length ? Z.map(f => '- ' + f.name.trim() + (foeAmt(f) ? ': ' + eur(foeAmt(f)) : '') + (dabei.has(f.id) ? ' – vor Ort: ' + (dabei.get(f.id) ? dabei.get(f.id).n : 'noch offen') : '')) : ['- (noch keine Zusage)']),
    '', 'Presse und Öffentlichkeit: ' + W.presse, W.ansprechperson ? 'Ansprechperson der Gliederung: ' + W.ansprechperson : '', u.info.trim() ? '\nNotizen:\n' + u.info.trim() : ''].filter(x => x !== null).join('\n').replace(/\u00a0/g, ' ');
  const K = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Malteser Dioezese Paderborn//Bedarfsliste//DE', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    'UID:' + b.id + '-uebergabe@bedarfsliste', 'DTSTAMP:' + jetzt.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
    st ? 'DTSTART:' + icsZeit(st) : 'DTSTART;VALUE=DATE:' + tag, st ? 'DTEND:' + icsZeit(ende) : 'DTEND;VALUE=DATE:' + icsZeit(morgen).slice(0, 8),
    'SUMMARY:' + icsText('Spendenübergabe ' + W.ortkurz + ' – ' + W.bedarf), u.ort.trim() ? 'LOCATION:' + icsText(u.ort.trim()) : null, 'DESCRIPTION:' + icsText(beschr),
    'CATEGORIES:' + icsText('Außentermin'), 'TRANSP:OPAQUE', 'X-MICROSOFT-CDO-BUSYSTATUS:OOF', 'X-MICROSOFT-CDO-INTENDEDSTATUS:OOF',   // Outlook: Kategorie „Außentermin“, „Abwesend“
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Spendenübergabe', 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  return new Blob([K.filter(Boolean).map(icsFalten).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
}
function icsLaden(b) {
  if (!validIso(b.nach.ueb.termin)) { toast('Erst den Termin der Spendenübergabe eintragen.', 'warn'); return; }
  download('Spendenübergabe ' + dateiName(b.titel || 'Bedarf') + '.ics', icsBlob(b));
  if (!DEMO) toast('Kalendereintrag heruntergeladen – Datei öffnen, dann trägt Outlook den Termin ein.', 'ok');
}
const dateiName = s => String(s).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

/* ---------- Rundmail: Empfänger nach Gruppen (angehakt je nach Knopf), Art: Blanko oder Vorlage → Outlook */
function rundGruppen(b) {
  const G = [['zust', 'Zuständig', b.zust.filter(z => z.n.trim() || z.mail.trim())], ['fach', 'Fachreferat' + (b.freigabe.fach.name.trim() ? ' ' + b.freigabe.fach.name.trim() : ''), fachZeig(b).Z],
    ['presse', 'Presse und Öffentlichkeit', grpZeig(b, 'presse').Z]];
  return G.filter(g => g[2].length);
}
// Förderer zur Spendenübergabe: die Kontakte der zugesagten Förderer (bei „Wer ist dabei?“ angehakt: nur diese vorgewählt)
// vorgewählt ist je Förderer die Person, die bei „Wer ist dabei?“ steht (auch wenn sie nicht unter den Kontakten ist)
function foeGruppen(b) {
  const Z = b.foerderer.filter(f => f.status === 'zugesagt' && f.name.trim()), mit = b.nach.ueb.mit;
  return Z.map(f => { const v = vorOrt(b, f), L = f.kontakte.filter(c => (c.n || '').trim() || (c.mail || '').trim()).map(c => Object.assign({}, c, { n: c.n.trim() || c.mail.trim(), f }));
    if (v && !L.some(c => kkey(c.n) === kkey(v.n))) L.unshift(Object.assign(leerK(), { n: v.n, mail: v.mail || '', f }));
    L.forEach(c => { c.vor = v ? kkey(c.n) === kkey(v.n) : true; });
    return ['f-' + f.id, f.name.trim(), L, !mit.length || mit.includes(f.id)]; });
}
// je Empfänger die Platzhalter: einzeln persönlich angesprochen, gemeinsam (BCC) ohne Namen
const foeWerte = (W, p) => p ? Object.assign({}, W, { anrede: p.n && !/@/.test(p.n) ? 'Guten Tag ' + p.n + ',' : W.anrede, foerderer: p.f.name.trim(), ihre_foerderung: foeAmt(p.f) ? ' in Höhe von ' + eur(foeAmt(p.f)).replace(/ /g, ' ') : '' }) : W;
const mailUrl = (an, bcc, betreff, text) => 'mailto:' + (bcc ? '?bcc=' : '') + an.map(encodeURIComponent).join(';').replace(/%40/g, '@') + (bcc ? '&' : '?') + 'subject=' + encodeURIComponent(betreff)
  + (text != null ? '&body=' + encodeURIComponent(text.replace(/\r?\n/g, '\r\n')) : '');
const mailOeffnen = url => { if (url.length > 1900) toast('Sehr lange E-Mail – falls Outlook sie abschneidet, die Vorlage kürzen.', 'warn'); const a = h('a', { href: url }); document.body.append(a); a.click(); a.remove(); };
async function rundmail(b, art, wahl = '', modus0) {
  closeMenus();
  const foe = art === 'foe', G = foe ? foeGruppen(b) : rundGruppen(b);
  const vor = { zust: ['zust'], fach: ['fach'], ueb: ['zust', 'presse'], presse: ['presse'] }[art] || ['zust'];
  const an = new Set();
  const pw = new Set((GRP.presse.obj(b).wahl || []));                          // Presse: angeklickte vorwählen (niemand angeklickt: alle)
  G.forEach(([g, , L, ja]) => L.forEach(p => { if (p.mail && (foe ? ja && p.vor : vor.includes(g) && (g !== 'presse' || !pw.size || pw.has(kkey(p.n))))) an.add(g + '|' + kkey(p.n)); }));
  const V = vorlagen().filter(v => v.fuer === art || v.fuer === 'alle' || (art === 'ueb' && v.fuer === 'presse')), W = vlWerte(b);   // intern: auch die Vorlagen für die Presse
  if (wahl === undefined || (wahl && !V.some(v => v.id === wahl))) wahl = '';
  if (foe && wahl === '' && !modus0) wahl = (V.find(v => v.fuer === 'foe') || { id: '' }).id;   // Förderer: gleich die Einladung vorgewählt
  let zu = null, modus = modus0 || (an.size > 1 ? 'bcc' : 'einzeln');
  const zahl = h('span');
  const empf = () => G.flatMap(([g, , L]) => L.filter(p => p.mail && an.has(g + '|' + kkey(p.n))));
  const zaehl = () => { const M = new Set(empf().map(p => p.mail.trim().toLowerCase())); zahl.textContent = foe && modus === 'einzeln' ? 'Einzeln schreiben' + (M.size ? ' (' + M.size + ') …' : ' …') : M.size ? 'E-Mail an ' + M.size + (foe ? ' (BCC)' : '') + ' öffnen' : 'E-Mail öffnen'; };
  // je Vorlage eine Kachel (zwei je Reihe): Klick wählt, Doppelklick öffnet gleich die E-Mail, Stift bearbeitet die Vorlage
  const kacheln = h('div', { class: 'rm-kacheln' });
  const zeigK = () => kacheln.replaceChildren(...[['', 'Blanko', 'nur Empfänger und Betreff']].concat(V.map(v => [v.id, v.name, vlFuellen(v.betreff, W)])).map(([id, t, x]) =>
    h('div', { class: 'rm-k' + (id === wahl ? ' on' : ''), role: 'radio', tabindex: 0, 'aria-checked': String(id === wahl), title: id ? 'Doppelklick: gleich die E-Mail öffnen' : '',
      onclick: () => { wahl = id; zeigK(); }, ondblclick: () => { wahl = id; zu && zu(true); }, onkeydown: e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); wahl = id; zeigK(); } } },
      h('b', null, t), h('span', { class: 'rm-ks' }, x),
      id ? h('button', { type: 'button', class: 'rm-pen', title: 'Vorlage bearbeiten', 'aria-label': 'Vorlage bearbeiten', html: ICON_PEN, onclick: e => { e.stopPropagation(); zu && zu({ edit: id }); } }) : null))
    .concat(h('button', { type: 'button', class: 'rm-k rm-neu', onclick: () => zu && zu('neu') }, h('span', { class: 'rm-plus', 'aria-hidden': 'true' }, '+'), 'Neue Vorlage')));
  const emp = h('div', { class: 'rm-emp' }, G.map(([g, t, L]) => h('div', { class: 'rm-g' }, h('div', { class: 'rm-gt' }, t),
    L.length ? L.map(p => { const k = g + '|' + kkey(p.n);
      return h('label', { class: 'check rm-p' + (p.mail ? '' : ' ohne'), title: p.mail || 'keine E-Mail-Adresse eingetragen' }, h('input', { type: 'checkbox', checked: an.has(k), disabled: !p.mail,
        onchange: e => { if (e.target.checked) an.add(k); else an.delete(k); zaehl(); } }), ' ' + (p.n || p.mail), h('span', { class: 'muted small' }, p.mail ? '' : ' · ohne E-Mail')); })
      : h('span', { class: 'muted small' }, 'Kein Kontakt eingetragen – beim Förderer unter „Kontakte“ ergänzen.'))));
  const modusSeg = foe ? h('div', { class: 'seg small rm-modus', role: 'group', 'aria-label': 'Wie verschicken?' }, [['bcc', 'Gemeinsam (BCC)', 'eine E-Mail, alle Förderer in BCC, ohne persönliche Anrede'], ['einzeln', 'Einzeln, persönlich', 'je Kontakt eine eigene E-Mail mit Namen und Betrag']].map(([v, l, t]) =>
    h('button', { type: 'button', class: v === modus ? 'on' : '', title: t, onclick: e => { modus = v; [...e.target.parentNode.children].forEach(x => x.classList.toggle('on', x === e.target)); zaehl(); } }, l))) : null;
  zeigK(); zaehl();
  const leer = foe ? 'Noch keine zugesagten Förderer.' : 'Noch niemand mit E-Mail-Adresse – erst Personen eintragen.';
  // intern zur Übergabe: die Kalenderdatei gleich mit herunterladen (eine E-Mail aus dem Browser kann keinen Anhang mitbringen)
  const mitIcs = art === 'ueb' && validIso(b.nach.ueb.termin) ? h('input', { type: 'checkbox', checked: true }) : null;
  const v = await modal(foe ? 'Förderer zur Spendenübergabe einladen' : 'Rundmail', h('div', { class: 'help rm' }, h('h4', null, 'Worum geht es?'), kacheln,
    h('h4', null, 'An'), modusSeg, G.length ? emp : h('p', { class: 'muted' }, leer),
    mitIcs ? h('label', { class: 'check rm-ics' }, mitIcs, ' Kalendereintrag (.ics) dazu herunterladen – in Outlook an die E-Mail anhängen') : null),
    [['Abbrechen', false], [zahl, true, 'primary']], { wide: true, expose: c => { zu = c; } });
  if (v === 'neu') { if (await vorlagenDialog({ neu: art })) rundmail(b, art, (vorlagen().filter(x => x.fuer === art).pop() || {}).id, modus); return; }
  if (v && v.edit) { await vorlagenDialog({ id: v.edit }); rundmail(b, art, v.edit, modus); return; }
  if (!v) return;
  const P = empf(), M = uniq(P.map(p => p.mail.trim()));
  if (!M.length) { toast('Niemand mit E-Mail-Adresse angehakt.', 'warn'); return; }
  const vl = V.find(x => x.id === wahl);
  const betreff = Wx => vl ? vlFuellen(vl.betreff, Wx) : (art === 'ueb' || foe ? 'Spendenübergabe ' : '') + '„' + Wx.bedarf + '“' + (Wx.gliederung ? ' (' + Wx.gliederung + ')' : '');
  if (foe && modus === 'einzeln') { einzelnSchreiben(P, p => { einlVermerken(b, [p.f]); return mailUrl([p.mail.trim()], false, betreff(foeWerte(W, p)), vl ? vlFuellen(vl.text, foeWerte(W, p)) : null); }); return; }
  if (foe) einlVermerken(b, P.map(p => p.f));                                      // „Eingeladen“ beim Förderer abhaken (heute)
  // Outlook trennt Empfänger mit „;“ (andere Programme mit „,“ – Outlook ist hier der Standard); Förderer gemeinsam: alle in BCC
  if (mitIcs && mitIcs.checked) { download('Spendenübergabe ' + dateiName(b.titel || 'Bedarf') + '.ics', icsBlob(b)); if (!DEMO) toast('Kalendereintrag liegt in „Downloads“ – in Outlook an die E-Mail anhängen.', 'ok'); }
  mailOeffnen(mailUrl(M, foe, betreff(W), vl ? vlFuellen(vl.text, W) : null));
}
function einlVermerken(b, F) {
  const E = b.nach.ueb.einl = Object.assign({}, b.nach.ueb.einl); let neu = false;
  for (const f of uniq(F)) if (!(E[f.id] && E[f.id].am)) { E[f.id] = Object.assign({}, E[f.id], { am: today() }); neu = true; }
  if (neu) { changed(); if (cur() === b && $('#nach-body')) swap('nach-body', nachBody(b), true); }
}
// einzeln, persönlich: je Kontakt ein Knopf – Outlook öffnet je Klick eine E-Mail (mehrere auf einmal blockiert der Browser)
function einzelnSchreiben(P, url) {
  const L = h('div', { class: 'rm-einzeln' }, P.map(p => { const k = h('button', { type: 'button', class: 'primary small', onclick: () => { mailOeffnen(url(p)); k.textContent = '✓ geöffnet'; k.className = 'small'; } }, 'E-Mail öffnen');
    return h('div', { class: 'rm-ez' }, h('span', null, h('b', null, p.n), h('span', { class: 'muted small' }, ' · ' + p.f.name.trim() + ' · ' + p.mail)), k); }));
  modal('Einzeln schreiben', h('div', { class: 'help' }, h('p', { class: 'muted small' }, 'Je Kontakt eine E-Mail mit persönlicher Anrede und dem Betrag der Förderung. Nacheinander öffnen und in Outlook absenden.'), L), [['Fertig', true, 'primary']], { wide: true });
}

/* ---------- Adresse der Gliederung als Vorschlag für den Ort der Spendenübergabe (nicht vorausgefüllt: ein Klick übernimmt).
   Gespeichert in der Bedarfsliste (D.settings.adressen), einmal je Gliederung – Zahnrad → „Adressen der Gliederungen …“ oder gleich bei der Übergabe */
const glAdresse = gl => (((D.settings.adressen || {})[gl]) || '').trim();
const glName = gl => gl === DIO ? 'Diözese' : gl;
function ortVorschlag(b) {
  const gl = b.gliederung.trim(), u = b.nach.ueb, a = gl ? glAdresse(gl) : '';
  if (!gl) return '';
  if (!u.ort.trim()) return a ? `<button type="button" class="ort-vor" data-act="ort-vorschlag" title="Klicken: als Ort übernehmen">Vorschlag: <b>${esc(a)}</b></button>`
    : `<button type="button" class="link small ort-vor0" data-act="adressen">Adresse ${gl === DIO ? 'der Diözese' : 'der Ortsgliederung ' + esc(gl)} hinterlegen – dann wird sie hier vorgeschlagen …</button>`;
  if (!a) return `<button type="button" class="link small ort-vor0" data-act="ort-merken">Als Adresse ${gl === DIO ? 'der Diözese' : 'von ' + esc(gl)} merken</button>`;
  return '';
}
function adresseMerken(gl, a) { if (!gl || !a.trim()) return; D.settings.adressen = Object.assign({}, D.settings.adressen, { [gl]: a.trim() }); changed(); toast('Adresse ' + (gl === DIO ? 'der Diözese' : 'von ' + gl) + ' gemerkt – wird künftig vorgeschlagen.', 'ok'); }
async function adressenDialog(fokus) {
  closeMenus();
  const N = uniq([DIO, ...GL_LIST, ...D.bedarfe.map(b => b.gliederung.trim()).filter(Boolean), ...Object.keys(D.settings.adressen || {})]), W = Object.assign({}, D.settings.adressen);   // auch Dienststellen aus der Excel
  const rows = N.map(gl => { const inp = h('input', { type: 'text', class: 'ad-in', value: W[gl] || '', placeholder: 'z. B. Malteser Hilfsdienst e. V., Musterstraße 1, 33098 Paderborn', 'aria-label': 'Adresse ' + glName(gl), 'data-gl': gl, oninput: e => { W[gl] = e.target.value; } });
    return h('tr', null, h('td', null, gl === DIO ? 'Diözesangeschäftsstelle' : gl), h('td', null, inp)); });
  let zu = null;
  const heim = h('input', { type: 'text', class: 'ad-in', value: heimAdresse(), placeholder: 'Straße Nr, PLZ Ort', 'aria-label': 'Meine Startadresse zu Hause' });
  const ok = await modal('Adressen der Gliederungen', h('div', { class: 'help' },
    h('p', { class: 'muted small' }, 'Für den Ort der Spendenübergabe: die Adresse der Gliederung wird vorgeschlagen, aber nicht von selbst eingetragen. Gilt für alle, die mit dieser Bedarfsliste arbeiten.'),
    h('div', { class: 'row ad-excel' }, h('button', { type: 'button', onclick: () => download(ADR_DATEI, adressenBlob()) }, 'Als Excel herunterladen'),
      h('button', { type: 'button', onclick: () => { if (zu) zu(false); adressenEinlesen(); } }, 'Excel einlesen …'), h('span', { class: 'muted small' }, 'zum Ausfüllen aller Adressen auf einmal')),
    h('div', { class: 'ad-wrap' }, h('table', { class: 'fh-tab ad-tab' }, rows)),
    h('label', { class: 'ad-heim' }, h('span', { class: 'lab' }, 'Meine Startadresse für die Route (zu Hause) – nur in diesem Browser'), heim)), [['Abbrechen', false], ['Speichern', true, 'primary']],
    { wide: true, expose: c => { zu = c; setTimeout(() => { const i = fokus && $$('.ad-in').find(x => x.dataset.gl === fokus); if (i) { i.scrollIntoView({ block: 'center' }); i.focus(); } }, 80); } });
  if (!ok) return;
  heimSetzen(heim.value.trim());
  D.settings.adressen = Object.fromEntries(Object.entries(W).map(([k, v]) => [k, String(v || '').trim()]).filter(([, v]) => v)); changed(); keep(renderNow); toast('Adressen gespeichert', 'ok');
}

/* ---------- Vorlagen bearbeiten (Zahnrad → „E-Mail-Vorlagen …“): Name, wofür, Betreff, Text mit Platzhaltern in {geschweiften Klammern} */
async function vorlagenDialog(o = {}) {
  closeMenus();
  const L = JSON.parse(JSON.stringify(vorlagen()));
  let i = 0;
  if (o.id) i = Math.max(0, L.findIndex(v => v.id === o.id));
  if (o.neu) { L.push({ id: uid('v'), name: 'Neue Vorlage', fuer: o.neu, betreff: '„{bedarf}“', text: 'Hallo zusammen,\n\n\n\nViele Grüße' }); i = L.length - 1; }
  const sel = h('select', { class: 'vl-sel', 'aria-label': 'Vorlage', onchange: e => { i = +e.target.value; zeig(); } });
  const name = h('input', { type: 'text', class: 'vl-name', 'aria-label': 'Name der Vorlage', oninput: e => { L[i].name = e.target.value; liste(); } });
  const fuer = h('select', { 'aria-label': 'Wofür', onchange: e => { L[i].fuer = e.target.value; } }, VL_FUER.map(([v, t]) => h('option', { value: v }, t)));
  const betreff = h('input', { type: 'text', class: 'vl-betreff', 'aria-label': 'Betreff', oninput: e => { L[i].betreff = e.target.value; } });
  const text = h('textarea', { rows: 12, class: 'vl-text', 'aria-label': 'Text', oninput: e => { L[i].text = e.target.value; } });
  let zuletzt = text;
  [betreff, text].forEach(el => el.addEventListener('focus', () => { zuletzt = el; }));
  const platz = h('div', { class: 'vl-platz' }, VL_PLATZ.map(([k, t]) => h('button', { type: 'button', class: 'mini-btn', title: t, onmousedown: e => e.preventDefault(),
    onclick: () => { const el = zuletzt, s = el.selectionStart ?? el.value.length, en = el.selectionEnd ?? s; el.value = el.value.slice(0, s) + '{' + k + '}' + el.value.slice(en); el.selectionStart = el.selectionEnd = s + k.length + 2; el.dispatchEvent(new Event('input')); el.focus(); } }, '{' + k + '}')));
  const leer = h('p', { class: 'muted' }, 'Keine Vorlagen – über „Neue Vorlage“ eine anlegen.'), feld = h('div', { class: 'vl-feld' },
    h('label', null, h('span', { class: 'lab' }, 'Name'), name), h('label', null, h('span', { class: 'lab' }, 'Für'), fuer),
    h('label', { class: 'vl-w' }, h('span', { class: 'lab' }, 'Betreff'), betreff), h('label', { class: 'vl-w' }, h('span', { class: 'lab' }, 'Text'), text),
    h('div', { class: 'vl-w' }, h('span', { class: 'lab' }, 'Platzhalter – anklicken fügt ihn an der Schreibmarke ein'), platz));
  const liste = () => sel.replaceChildren(...L.map((v, j) => h('option', { value: j, selected: j === i }, (v.name || '(ohne Namen)') + ' – ' + (VL_FUER.find(x => x[0] === v.fuer) || VL_FUER[3])[1])));
  const zeig = () => { liste(); leer.hidden = !!L.length; feld.hidden = !L.length; sel.hidden = !L.length; if (!L.length) return;
    const v = L[i]; name.value = v.name; fuer.value = v.fuer; betreff.value = v.betreff; text.value = v.text; };
  const kopf = h('div', { class: 'row vl-kopf' }, sel,
    h('button', { type: 'button', onclick: () => { L.push({ id: uid('v'), name: 'Neue Vorlage', fuer: 'alle', betreff: '„{bedarf}“', text: '' }); i = L.length - 1; zeig(); name.focus(); name.select(); } }, 'Neue Vorlage'),
    h('button', { type: 'button', class: 'link', onclick: () => { if (!L.length) return; L.splice(i, 1); i = Math.max(0, i - 1); zeig(); } }, 'Löschen'),
    h('button', { type: 'button', class: 'link small', title: 'Die mitgelieferte Vorlage „Absprache für Spendenübergabe“ wieder dazunehmen', onclick: () => { for (const s of VL_STD) if (!L.some(v => v.id === s.id)) L.push(Object.assign({}, s)); zeig(); } }, 'Mitgelieferte wieder dazu'));
  zeig();
  const ok = await modal('E-Mail-Vorlagen', h('div', { class: 'help vl' }, h('p', { class: 'muted small' }, 'Für die Rundmail (Knopf mit drei Umschlägen). Gespeichert in der Bedarfsliste – gilt für alle, die mit ihr arbeiten.'), kopf, leer, feld),
    [['Abbrechen', false], ['Speichern', true, 'primary']], { wide: true });
  if (!ok) return false;
  D.settings.vorlagen = L.map(v => Object.assign(v, { name: v.name.trim() || 'Vorlage' })); D.settings.vorlagenWeg = VL_STD.map(v => v.id).filter(id => !L.some(v => v.id === id)); changed(); toast('Vorlagen gespeichert', 'ok');
  return true;
}

/* ---------- Fachreferat beim Bedarf: alle Personen mit diesem Fachreferat, ohne die ausgeblendeten (fach.aus), dazu weitere aus der Personenliste (fach.dazu).
   Hauptansprechperson: je Bedarf (fach.stern), sonst die des Fachreferats (D.settings.fachHaupt, einmal gefragt) */
const FACH_HAUPT_STD = { notfallvorsorge: 'Thorsten Heß' };          // vom Fundraising genannt – gilt, bis jemand anderes gewählt ist
// fach.pers: Personen, die beim Bedarf feststehen (mit ihren Angaben – über den Stift änderbar); dazu kommen die übrigen des Fachreferats aus der
// Personenliste, außer den ausgeblendeten (fach.aus). Fehlende Angaben ergänzt die Personenliste.
const fachKopie = p => Object.assign(leerZ(), { n: p.n || '', rolle: p.rolle || '', mail: p.mail || '', tel: p.tel || '', mobil: p.mobil || '' });
// Personengruppen beim Bedarf mit derselben Technik (ab 0.67): Fachreferat (aus der Spalte „Fachreferat“) und Presse und Öffentlichkeit bei der Spendenübergabe.
// obj: wo pers/aus/fuer stehen · L: die Personen der Gruppe aus der Personenliste · ui: Bearbeiten-Merker · neu: was Neue in der Personenliste bekommen
const GRP = {
  fach: { obj: b => b.freigabe.fach, name: b => b.freigabe.fach.name.trim(), L: b => fachPersonen(b.freigabe.fach.name.trim()), ui: 'fEdit', box: '#fach-pers', p: 'freigabe.fach.pers',
    titel: b => 'Fachreferat ' + b.freigabe.fach.name.trim(), zeigen: b => swap('fach-pers', fachBlock(b), true), neu: name => ({ fach: name }) },
  presse: { obj: b => { const u = b.nach.ueb; if (!isObj(u.presse)) u.presse = { pers: [], aus: [], fuer: '' }; return u.presse; }, name: () => 'Presse und Öffentlichkeit', L: () => pressePersonen(),
    ui: 'pEdit', box: '#presse-pers', p: 'nach.ueb.presse.pers', titel: () => 'Presse und Öffentlichkeit', zeigen: b => swap('presse-pers', presseBlock(b), true), neu: () => ({}) },   // Neue (z. B. jemand vor Ort) ohne Fachreferat
};
// pers: Personen, die beim Bedarf feststehen (mit ihren Angaben – über den Stift änderbar); dazu kommen die übrigen der Gruppe aus der Personenliste,
// außer den ausgeblendeten (aus). Fehlende Angaben ergänzt die Personenliste.
function grpZeig(b, g) {
  const G = GRP[g], f = G.obj(b), name = G.name(b), L = G.L(b);
  if (g === 'fach') {
    if (f.fuer && f.fuer !== norm(name)) { f.aus = []; f.pers = []; f.dazu = []; f.fuer = ''; }   // anderes Fachreferat eingetragen: die Auswahl galt dem alten
    if (Array.isArray(f.wahl) && f.wahl.length && L.length) { f.aus = L.map(p => kkey(p.n)).filter(k => !f.wahl.includes(k)); }   // Auswahl bis 0.60 → ausgeblendete
    delete f.wahl;
    if (Array.isArray(f.dazu) && f.dazu.length) { f.pers = [...(f.pers || []), ...f.dazu.map(k => PR.list.find(p => kkey(p.n) === k)).filter(Boolean).map(fachKopie)]; f.dazu = []; }   // 0.61 → 0.62
  }
  const aus = new Set(f.aus || []), P = (f.pers || []).filter(c => !kontaktLeer(c)), pk = new Map(P.map(c => [kkey(c.n), c]));
  const voll = c => { const p = person(c.n); return p ? Object.assign({}, c, ...['rolle', 'mail', 'tel', 'mobil'].map(k => (c[k] || '').trim() ? {} : { [k]: p[k] || '' })) : c; };
  const Z = [...L.filter(p => !aus.has(kkey(p.n))).map(p => pk.has(kkey(p.n)) ? voll(pk.get(kkey(p.n))) : p), ...P.filter(c => !L.some(p => kkey(p.n) === kkey(c.n))).map(voll)];
  return { name, L, Z, weg: L.filter(p => aus.has(kkey(p.n)) && !pk.has(kkey(p.n))).length };
}
// alle, die gerade in der Gruppe stehen, als feste Personen übernehmen (vor dem Bearbeiten und nach der Auswahl)
function grpFest(b, g, Z) {
  const f = GRP[g].obj(b), { name, L } = grpZeig(b, g);
  f.pers = Z.map(fachKopie); f.aus = L.map(p => kkey(p.n)).filter(k => !f.pers.some(c => kkey(c.n) === k)); f.fuer = norm(name);
}
const GSNAP = {};
// Stift: die Personen direkt bearbeiten (wie bei „Zuständig“); „Fertig“ fragt, ob Neues in die Personenliste soll
function grpBearbeiten(b, g, neu) {
  const G = GRP[g];
  if (UI[G.ui] !== b.id) { grpFest(b, g, grpZeig(b, g).Z); GSNAP[g] = JSON.stringify(G.obj(b).pers); }
  if (neu) G.obj(b).pers.push(leerZ());
  changed(); UI[G.ui] = b.id; keep(renderNow);
  const E = $$(G.box + ' .k-ed'), e = neu ? E[E.length - 1] : E[0], inp = e && e.querySelector('input'); if (inp) inp.focus();
}
function grpFertig(b, g) {
  const G = GRP[g], f = G.obj(b), name = G.name(b), L = G.L(b);
  f.pers = (f.pers || []).filter(c => !kontaktLeer(c)); f.aus = L.map(p => kkey(p.n)).filter(k => !f.pers.some(c => kkey(c.n) === k)); f.fuer = norm(name);
  const vor = JSON.parse(GSNAP[g] || '[]').map(c => JSON.stringify(c)); GSNAP[g] = '[]';
  const N = f.pers.filter(c => !vor.includes(JSON.stringify(c))).map(c => person(c.n) ? c : Object.assign({}, c, G.neu(name)));   // Neue im Fachreferat bekommen es eingetragen
  if (N.length) setTimeout(() => wennFrei(() => personenBestaetigen(N, g === 'presse' ? b.gliederung : '')), 0);
}
// „+“: wer in der Gruppe steht – Haken an/aus, über die Suche weitere aus der Personenliste dazu, oder jemanden neu eintragen
async function grpDialog(b, g) {
  const G = GRP[g], { name, L, Z } = grpZeig(b, g), imF = new Set(L.map(p => kkey(p.n))), an = new Set(Z.map(p => kkey(p.n)));
  const liste = h('div', { class: 'ps-liste fd-liste' });
  const text = p => norm([p.n, p.rolle, p.gl, p.fach, p.mail].filter(Boolean).join(' '));
  let q = [];
  const zeig = () => {
    const S = q.length ? PR.list.filter(p => q.every(w => text(p).includes(w))).slice(0, 60) : [...L, ...Z.filter(p => !imF.has(kkey(p.n)))];   // Z: auch von Hand Eingetragene
    liste.replaceChildren(...(S.length ? S.map(p => { const k = kkey(p.n), wo = imF.has(k) ? (g === 'fach' ? name : p.fach || name) : p.fach || p.gl || '';
      return h('label', { class: 'ps-z' }, h('input', { type: 'checkbox', checked: an.has(k), onchange: e => { if (e.target.checked) an.add(k); else an.delete(k); } }),
        h('span', { class: 'ps-n' }, p.n, wo ? h('span', { class: 'muted small' }, ' · ' + wo) : null)); })   // nur der Name, dahinter Fachreferat bzw. Gliederung
      : [h('p', { class: 'muted small' }, q.length ? 'Niemand gefunden.' : 'Noch niemand – oben suchen und dazunehmen oder unten neu eintragen.')]));
  };
  const such = h('input', { type: 'search', class: 'ps-such', placeholder: 'Weitere Person suchen: Name, Position, Gliederung …', oninput: e => { q = norm(e.target.value).split(/\s+/).filter(Boolean); zeig(); } });
  zeig();
  const ok = await modal(G.titel(b), h('div', { class: 'help ps' }, h('div', { class: 'row ps-kopf' }, such), liste),
    [['Neue Person eintragen …', 'neu', 'link ps-neu'], ['Abbrechen', false], ['Übernehmen', true, 'primary']], { expose: () => setTimeout(() => such.focus(), 80) });
  if (ok === 'neu') { grpBearbeiten(b, g, true); return; }                  // nicht in der Personenliste: von Hand eintragen
  if (!ok) return;
  const nach = [...Z.filter(p => an.has(kkey(p.n))), ...PR.list.filter(p => an.has(kkey(p.n)) && !Z.some(z => kkey(z.n) === kkey(p.n)))];
  grpFest(b, g, nach); changed(); G.zeigen(b);
}
const fachZeig = b => grpZeig(b, 'fach'), fachFest = (b, Z) => grpFest(b, 'fach', Z);
// Schlüssel der Standard-Hauptansprechperson; '' = bewusst niemand; undefined = noch nicht gefragt (oder nicht mehr im Fachreferat)
function fachHauptStd(name, L) {
  const k = norm(name), S = D.settings.fachHaupt || {};
  let v = S[k];
  if (v === undefined && FACH_HAUPT_STD[k]) v = kkey(FACH_HAUPT_STD[k]);
  if (v === undefined) return undefined;
  return v && !L.some(p => kkey(p.n) === v) ? (S[k] === undefined ? undefined : '') : v;
}
const fachHauptSetzen = (name, k) => { D.settings.fachHaupt = Object.assign({}, D.settings.fachHaupt, { [norm(name)]: k }); changed(); };
// Zahnrad → „Hauptansprechpersonen der Fachreferate …“: je Fachreferat die Standard-Hauptansprechperson
async function fachHauptDialog() {
  closeMenus();
  const N = uniq(fachNamen().map(n => n.trim()).filter(n => fachPersonen(n).length)).sort((a, c) => a.localeCompare(c, 'de'));
  const W = {};
  const rows = N.map(n => { const L = fachPersonen(n), v = fachHauptStd(n, L);
    const s = h('select', { onchange: e => { W[norm(n)] = e.target.value; } }, h('option', { value: '' }, '– niemand –'), L.map(p => h('option', { value: kkey(p.n), selected: kkey(p.n) === v }, p.n)));
    return h('tr', null, h('td', null, n), h('td', null, s)); });
  const ok = await modal('Hauptansprechpersonen der Fachreferate', h('div', { class: 'help' },
    h('p', { class: 'muted small' }, 'Steht beim Bedarf mit Stern vorn und gilt für alle Bedarfe mit diesem Fachreferat. Beim einzelnen Bedarf lässt sich über den Stern jede andere wählen.'),
    N.length ? h('table', { class: 'fh-tab' }, rows) : h('p', { class: 'muted' }, 'Noch keine Fachreferate in der Personenliste (Spalte „Fachreferat“).')),
    [['Abbrechen', false], ['Speichern', true, 'primary']]);
  if (!ok || !Object.keys(W).length) return;
  D.settings.fachHaupt = Object.assign({}, D.settings.fachHaupt, W); changed(); keep(renderNow); toast('Hauptansprechpersonen gespeichert', 'ok');
}
