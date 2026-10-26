/* ===================================================================== Copilot und Cowork: Knopf oben rechts auf der Seite eines Bedarfs.
   Die Liste ruft keine KI selbst auf (sie schickt nichts ins Internet). Sie legt eine Arbeits-Excel zum Bedarf in den Unterordner „Förderrecherche“
   neben der Bedarfsliste – dort kommt Cowork über OneDrive heran – und baut den Prompt für die gewählten Aufgaben (mehrere auf einmal).
   Das Ergebnis kommt in dieselbe Excel und wird mit Vorschau übernommen (importFoerderplan). Kontaktdaten der Zuständigen sucht Copilot,
   der das Intranet kennt, über die Personen-Excel (05_personen.js). Ist die Excel nach dem Auftrag geändert worden, zeigt der Knopf einen Punkt. */

const ICON_KI = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><defs><linearGradient id="ki-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b7de9"/><stop offset=".55" stop-color="#8a4fe0"/><stop offset="1" stop-color="#e0558f"/></linearGradient></defs>'
  + '<path fill="url(#ki-g)" d="M10 2.5l1.7 5a3 3 0 0 0 1.8 1.8l5 1.7-5 1.7a3 3 0 0 0-1.8 1.8l-1.7 5-1.7-5a3 3 0 0 0-1.8-1.8l-5-1.7 5-1.7a3 3 0 0 0 1.8-1.8z"/>'
  + '<path fill="url(#ki-g)" d="M18.6 14.6l.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8z"/></svg>';
const kiOrdner = b => !!(b.pfad.trim() || okLink(b.link));
const kiFoe = b => b.foerderer.filter(f => f.name.trim());
const kiNamen = L => L.map(f => f.name.trim()).join(', ');
// Aufgaben als Kacheln: wer – Cowork (Dateien, Recherche, Skills) oder Copilot (Intranet); ok – true oder warum es gerade nicht geht
const KI_KACHELN = [
  { k: 'beschr', t: 'Beschreibung', s: 'neu aus den Unterlagen', wer: 'copilot' },
  { k: 'suchen', t: 'Neue Förderer', s: 'passend zum Bedarf', wer: 'copilot' },
  { k: 'recherche', t: 'Förderrecherche', s: 'Essenz hier, Details als Datei', wer: 'cowork' },
  { k: 'ordner', t: 'Ordner finden', s: 'SharePoint-Ordner suchen', wer: 'copilot', ok: b => !okLink(b.link) || 'Link ist schon eingetragen' },
  { k: 'zust', t: 'Kontaktdaten', s: 'Zuständige aus dem Intranet', wer: 'copilot', ok: b => b.zust.some(z => z.n.trim()) || 'erst eine zuständige Person eintragen' },
];
const KI_NUR_COPILOT = ['zust', 'ordner'];                                         // kennt nur Copilot (Intranet, SharePoint)
const KI_SPAETER = ['Antrag / Anschreiben', 'Bitte um Freigabe', 'Nachfass-Mail', 'Dank', 'Pressemitteilung', 'Sachbericht'];
const kiOk = (b, a) => !a || !a.ok || a.ok(b) === true;
const kiSvg = d => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const KI_ICO = { beschr: kiSvg('M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 15.5h5M10 9h2'), suchen: kiSvg('M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20'),
  recherche: kiSvg('M4 20V10M10 20V4M16 20v-7M22 20H2'), zust: kiSvg('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'),
  ordner: kiSvg('M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z') };

/* ---------- Prompts. Bausteine, aus denen beide zusammengesetzt werden:
   Einleitung (wer, wozu) – der Bedarf – Unterlagen bzw. Dateien – Aufgaben (je Aufgabe Ziel, Vorgehen, Ergebnis) – Regeln – Prüfen bzw. Ausgabe.
   Cowork arbeitet in der Arbeits-Excel im OneDrive und legt je Förderer eine ausführliche Recherche als Word-Datei an;
   Copilot antwortet im Chat und gibt das Ergebnis als festen Textblock aus, den man in die Liste einfügt (kiTextLesen). */
const KI_EINLEITUNG = 'Ich bin Fundraiser beim Malteser Hilfsdienst e. V. in der Diözese Paderborn und will den Bedarf unten finanzieren. '
  + 'Ich brauche belastbare, schnell erfassbare Ergebnisse, die ich ohne Nacharbeit in meine Bedarfsliste übernehme. Erledige die Aufgaben der Reihe nach.';
const KI_BESCHR = 'Ziel: Wer sie liest, versteht das Projekt in einer Minute – sie ist Grundlage für alle Anträge. '
  + 'Ergebnis: höchstens 2 kurze Absätze (etwa 80 bis 160 Wörter), sachlich und ohne Werbesprache, die die Eckdaten des Projekts erkennbar machen, soweit sie in den Unterlagen stehen: '
  + 'was angeschafft oder umgesetzt wird (Gegenstand, Umfang, Modell); wer es nutzt und wem es hilft (Dienst, Zielgruppe, Zahl der Einsätze oder Menschen); wofür und mit welcher Wirkung; '
  + 'warum jetzt (Anlass, Zustand des Bisherigen); Anbieter und Datum des Angebots, Zeitplan. Was die Bedarfsliste ohnehin zeigt – Name, Gliederung, Summe, Deadline, Ansprechpersonen – '
  + 'nicht wiederholen, außer es trägt zur Aussage bei (z. B. wenn das Angebot von der Summe abweicht). Fehlt eine Eckdate, lass sie weg und nenne sie – nicht raten.';
const KI_ESSENZ = '„Pro“ und „Contra“ nur als Essenz: je höchstens 3 Punkte, je höchstens 12 Wörter, konkret auf diesen Bedarf '
  + '(gut: „- Satzung fördert Katastrophenschutz in der Region“; zu allgemein: „- fördert soziale Zwecke“). Bei Contra kurz dazu, wie der Antrag der Hürde begegnet '
  + '(z. B. „- max. 5.000 € je Antrag – Teilbetrag beantragen“). Stehen schon Pro und Contra da: prüfen, Zutreffendes behalten, Falsches streichen, auf die Essenz kürzen.';
const KI_KURZ = 'Übliche Fördersumme, Eigenanteil und weitere Fristen je höchstens eine kurze Zeile.';
// wo die Bedarfsordner in der Regel liegen – für die Suche, wenn noch kein Ordner eingetragen ist
// Ortsgliederungen\<Gliederung>\<Bedarf>; Projekte der Diözese in „1601_Diözese_Pojekte“ – dort auch suchen, wenn bei den Ortsgliederungen nichts passt
const kiAblageHinweis = (b, sp) => { const gl = rechGl(b), dio = sp ? 'General › 1601_Diözese_Pojekte' : '„' + KI_ABLAGE_DIO + '“';
  return 'Die Bedarfsordner liegen in der Regel ' + (sp ? 'in der SharePoint-Bibliothek „Fundraising-Team - Diözese Paderborn“ unter General › Ortsgliederungen › <Gliederung> › <Bedarf> (z. B. Ortsgliederungen › Büren › RE - Küche)'
    : 'in meinem OneDrive unter „' + KI_ABLAGE + '\\<Gliederung>\\<Bedarf>“ (z. B. „…\\Ortsgliederungen\\Büren\\RE - Küche“)') + '; Projekte der Diözese unter ' + dio + '. '
    + (gl ? 'Schau zuerst im Ordner der Gliederung „' + gl + '“ nach; findest du dort nichts, such unter ' + dio + '.' : 'Dieser Bedarf gehört zur Diözese: schau zuerst unter ' + dio + ' nach, dann bei den Ortsgliederungen.'); };
const kiUnterordner = b => kurzName(b.titel || 'Bedarf', 40) + '_' + rechKurz(b);
const kiRecherchiertWen = (A, neu) => [A.foe.length ? kiNamen(A.foe) : '', neu ? 'alle neu gefundenen Förderer' : ''].filter(Boolean).join(' sowie ');
function kiBedarfZeilen(b, T) {
  const F = finState(b), gl = rechGl(b), L = ['## Der Bedarf', 'Bedarf: ' + (b.titel || '(ohne Namen)'), 'Gliederung: ' + (gl || 'Diözese Paderborn (ohne Gliederung)')];
  if (F.S) L.push('Summe: ' + eur(F.S) + (F.eig ? ' · Eigenmittel ' + eur(F.eig) : '') + (F.zu ? ' · schon zugesagt ' + eur(F.zu) : '') + ' · noch offen ' + eur(rechOffen(b)));
  if (b.deadline) L.push('Deadline: ' + fmtDate(b.deadline));
  if (b.stichworte.length) L.push('Stichworte oder Fördertöpfe: ' + b.stichworte.join(', '));
  if (b.beschreibung.trim()) L.push('Beschreibung (bisher): ' + b.beschreibung.trim().replace(/\s*\n+\s*/g, ' '));
  if ((T.has('suchen') || T.has('recherche')) && kiFoe(b).length) L.push('Schon im Förderplan: ' + kiFoe(b).map(f => f.name.trim() + ' (' + F_ST_L[f.status] + ')').join(', '));
  return L;
}

// Cowork: Aufgaben – dieselben Sätze stehen im Blatt „Anleitung“ der Excel. A: { auf, foe, neuDazu }
function kiAufgaben(b, A) {
  // ohne eigenen Ordner des Bedarfs: ein Unterordner je Bedarf neben der Arbeitsdatei („Förderrecherche\<Bedarf>“)
  const T = A.auf, L = [], neu = T.has('suchen') && A.neuDazu, wohin = b.pfad.trim() ? 'im Ordner des Bedarfs'
    : 'im Ordner des Bedarfs, wenn du ihn gefunden hast – sonst im Unterordner „' + kiUnterordner(b) + '“ neben der Arbeitsdatei (leg ihn an, falls es ihn nicht gibt)';
  if (T.has('beschr')) L.push('Projektbeschreibung. ' + KI_BESCHR + ' Vorgehen: Lies alle Dateien im Ordner des Bedarfs (vor allem Angebot, Kostenplan, Konzept, Projektsteckbrief, Mails); '
    + 'die bisherige Beschreibung ist nur ein Anhaltspunkt. Trag den Text im Blatt „Beschreibung“ bei „Vorschlag“ ein (Absätze durch eine Leerzeile trennen), bei „Grundlage“ die gelesenen Dateien.');
  const R = rechAuftrag(b).slice(0, -1);                                          // ohne „nur leere Zellen ergänzen“ – das regelt die Förderrecherche
  if (T.has('suchen')) L.push('Neue Förderer. Ziel: realistische Kandidaten für den noch offenen Betrag. Vorgehen: ' + R.join(' ')
    + ' Förderer, die im Blatt „Förderplan“ schon stehen, nicht doppelt anlegen. Umfang: ' + rechUmfang(b)
    + ' Ergebnis: je neuem Förderer eine neue Zeile im Blatt „Förderplan“ mit mindestens Förderer, Art, Website, Erwartete Summe, Pro, Einschätzung und Quellen.');
  if (T.has('recherche') && (A.foe.length || neu)) L.push('Förderrecherche je Förderer – für ' + kiRecherchiertWen(A, neu) + '. '
    + 'Ziel: In der Liste steht je Förderer nur die Essenz für den schnellen Überblick; alles Ausführliche steht in einer eigenen Datei. '
    + 'Vorgehen: Nutze deinen Skill zur Förderlogik-Analyse (heißt etwa „foerderlogik-analyse“). Prüf auf den eigenen Seiten des Förderers Satzungszweck, Förderrichtlinien, Antragsweg und Fristen; '
    + 'prüf die Förderhistorie (' + (karteiFuer(b).length ? 'Blatt „Förder-Kartei“, ' : '') + 'Jahres- und Förderberichte); gleich alles mit diesem Bedarf ab: Zweck, Region, Förderhöhe im Verhältnis zum offenen Betrag, Eigenanteil, Zeitplan. '
    + 'Ergebnis 1 – ausführlich: je Förderer eine Word-Datei „Förderrecherche – <Förderer>.docx“ ' + wohin + ' mit Förderlogik und Satzungszweck (mit Zitat und Link), Richtlinien und Antragsweg, '
    + 'Förderhistorie, Argumentationslinie für genau diesen Bedarf, Kontakten, Fristen, offenen Fragen und Quellen. '
    + 'Ergebnis 2 – Essenz in der Zeile des Förderers im Blatt „Förderplan“: ' + KI_ESSENZ + ' Dazu Kontakte, Antragsweg, Antragsfrist (nächster Termin als Datum), Weitere Fristen und Termine, '
    + 'Übliche Fördersumme, Eigenanteil gefordert, Erwartete Summe (realistisch), Einschätzung, Website, Quellen und in „Ausführliche Recherche (Datei)“ den Dateinamen. ' + KI_KURZ
    + ' Bei Förderern mit Stand „zugesagt“ oder „abgelehnt“ nur leere Zellen ergänzen.');
  return L.map((t, i) => (i + 1) + '. ' + t);
}
const KI_REGELN = ['Nichts erfinden. Was du nicht belegen kannst, bleibt leer; Unsicheres kennzeichnen (z. B. „laut Website 2025, nicht bestätigt“).',
  'Als Quellen nur Links, die du tatsächlich geöffnet hast. Kannst du nicht im Web suchen oder eine Datei nicht öffnen, sag es mir, statt weiterzumachen.',
  'Kurz und schnell erfassbar: in Pro, Contra und Fristen je Punkt eine eigene Zeile mit „- “ am Anfang.',
  'Blattnamen, Spaltenüberschriften und die Angaben oben (Bedarf, Kennung) nicht ändern; Datum als TT.MM.JJJJ, Beträge nur als Zahl in Euro.'];
const KI_PRUEFEN = ['Jede Angabe stammt aus einer Datei oder Seite, die du geöffnet hast; jede Förderer-Zeile hat mindestens eine Quelle.',
  'Pro und Contra: je höchstens 3 kurze Punkte, konkret auf diesen Bedarf; keine Platzhalter wie „k. A.“ oder „n/a“.',
  'Je recherchiertem Förderer liegt die Word-Datei im Ordner und ihr Name steht in der Excel.', 'Beträge sind Zahlen, Daten TT.MM.JJJJ, Blattnamen und Überschriften unverändert.'];
function kiPrompt(b, A) {
  const name = vorlageName(b), P = rechOrdnerOk() ? rechPfad() : { lokal: '', od: '' }, T = A.auf, L = [KI_EINLEITUNG, ''];
  const pfad = b.pfad.trim() ? unquote(b.pfad).trim() : '', link = okLink(b.link) ? b.link.trim() : '', foeAuf = T.has('suchen') || T.has('recherche');
  L.push(...kiBedarfZeilen(b, T), '', '## Dateien');
  L.push('- Arbeitsdatei: „' + name + '“ ' + (P.od ? 'in meinem OneDrive unter „' + P.od + '“' : 'im Unterordner „' + RECH_DIR + '“ neben der Bedarfsliste in meinem OneDrive') + (P.lokal ? ' (auf dem PC: ' + P.lokal + ')' : '')
    + '. Bearbeite sie dort und speichere sie am Ende unter demselben Namen am selben Ort. Alle Ergebnisse gehören in diese Datei; was in welches Blatt gehört, steht im Blatt „Anleitung“.');
  if (T.has('beschr') || T.has('recherche')) L.push('- Ordner des Bedarfs (Angebot, Konzept, Fotos …): ' + (pfad
      ? pfad + ' – vorhandene Dateien nur lesen: nichts löschen, verschieben oder überschreiben' + (T.has('recherche') ? '; die neuen Recherche-Dateien legst du hier ab.' : '.')
      : 'noch nicht eingetragen' + (link ? ' (Link: ' + link + ')' : '') + '. ' + kiAblageHinweis(b, false)
        + ' Findest du ihn, trag den Pfad im Blatt „Beschreibung“ bei „Ordner“ ein und arbeite mit ihm; vorhandene Dateien dort nur lesen. Findest du ihn nicht, sag es mir – nicht raten.'));
  L.push('', '## Aufgaben', ...kiAufgaben(b, A), '', '## Regeln', ...KI_REGELN.map(t => '- ' + t), '', '## Vor dem Speichern prüfen', ...KI_PRUEFEN.filter(t => T.has('recherche') || !/Word-Datei/.test(t)).map(t => '- ' + t), '');
  L.push('## Zum Schluss im Chat', 'Je Aufgabe zwei, drei Sätze: was du gefunden hast und was offen blieb' + (T.has('beschr') ? ' (bei der Beschreibung: welche Eckdaten fehlen)' : '') + '.'
    + (foeAuf ? ' Danach die drei aussichtsreichsten Förderer mit je einem Satz Begründung und welcher Teil der offenen Summe realistisch erscheint.' : ''));
  return L.join('\n');
}

// Copilot: alles im Chat, das Ergebnis am Ende als Textblock in festem Aufbau (zum Einfügen in die Liste). zust: Kontaktdaten der Zuständigen dazu
function kiPromptCopilot(b, A, X) {
  X = X === true ? { zust: true } : X || {};
  const zust = !!X.zust;
  const T = A.auf, L = [KI_EINLEITUNG, ''], neu = T.has('suchen') && A.neuDazu, gl = rechGl(b) || 'Diözese Paderborn';
  const pfad = b.pfad.trim() ? unquote(b.pfad).trim() : '', link = okLink(b.link) ? b.link.trim() : '', KL = karteiFuer(b).slice(0, 30), A1 = [];
  L.push(...(T.size ? kiBedarfZeilen(b, T) : kiBedarfZeilen(b, T).slice(0, 3)));          // nur Kontaktdaten: Name und Gliederung genügen
  if (T.has('beschr')) L.push('', '## Unterlagen', 'Die Dateien zum Bedarf (Angebot, Kostenplan, Konzept, Projektsteckbrief …) liegen '
    + (link ? 'hier: ' + link : X.ordner ? 'in dem Ordner, den du in der ersten Aufgabe findest' : pfad ? 'in diesem Ordner: ' + pfad : 'bei mir')
    + '. Kannst du sie nicht öffnen, sag es mir – dann füge ich sie dir mit „/“ ein.');
  if (X.ordner) A1.push('Ordner finden. Such in SharePoint und OneDrive den Ordner, in dem die Unterlagen zu diesem Bedarf liegen (Angebot, Konzept, Fotos …) – '
    + 'über den Namen des Bedarfs, die Gliederung und Stichworte wie „Angebot“. ' + kiAblageHinweis(b, true) + ' Gib den Link zum Ordner an; bei mehreren Treffern den passendsten, die anderen nennst du im Text. Nichts raten.');
  if (T.has('beschr')) A1.push('Beschreibung. ' + KI_BESCHR + ' Die bisherige Beschreibung ist nur ein Anhaltspunkt.');
  if (T.has('suchen')) A1.push('Neue Förderer. Ziel: realistische Kandidaten für den noch offenen Betrag. ' + rechAuftrag(b)[0] + ' ' + rechAuftrag(b)[1]
    + (KL.length ? ' Prüf zuerst diese Förderer aus unserer Förder-Kartei, die für die Region zuständig sind: ' + KL.map(k => k.name).join(', ') + '.' : '')
    + ' Förderer, die schon im Förderplan stehen, nicht noch einmal nennen. Umfang: ' + rechUmfang(b));
  if (T.has('recherche') && (A.foe.length || neu)) A1.push('Kurzrecherche je Förderer – für ' + kiRecherchiertWen(A, neu) + '. Prüf auf den eigenen Seiten des Förderers Satzungszweck, '
    + 'Förderrichtlinien, Antragsweg und Fristen und gleich sie mit diesem Bedarf ab (Zweck, Region, Förderhöhe, Eigenanteil). ' + KI_ESSENZ + ' ' + KI_KURZ);
  if (zust) { const P = personenGesucht(b); if (P.length) A1.push('Kontaktdaten. Such im Adressbuch und Organigramm (Outlook, Teams) und im Intranet die dienstlichen Angaben (Position, E-Mail, Telefon, Handy) dieser Personen vom Malteser Hilfsdienst e. V. (' + gl + '): '
    + P.map(z => z.n.trim()).join(', ') + '. Nur eintragen, was du wirklich findest.'); }
  const chat = t => t.replace('Trage als Quellen nur Links ein', 'Nenne als Quellen nur Links').replace('die Zelle leer lassen', 'die Summe weglassen');   // Copilot hat keine Excel
  L.push('', '## Aufgaben', ...A1.map((t, i) => (i + 1) + '. ' + chat(t)), '', '## Regeln', '- ' + KI_REGELN[0], '- ' + KI_REGELN[1], '- Je Punkt eine eigene Zeile mit „- “ am Anfang.', '');
  const B = ['```text'];
  if (T.has('beschr')) B.push('#BESCHREIBUNG', '(der Text)');
  if (T.has('suchen') || T.has('recherche')) B.push('#FÖRDERER', 'Name: …', 'Art: ' + ART.join(' | '), 'Website: …', 'Summe: (erwartete Summe als Zahl in Euro)', 'Antragsfrist: TT.MM.JJJJ', 'Antragsweg: …',
    'Übliche Fördersumme: …', 'Eigenanteil: …', 'Pro:', '- …', 'Contra:', '- …', 'Einschätzung: ' + EINSCH.map(e => e[1]).join(' | '), 'Quellen:', '- https://…', '(Leerzeile, dann der nächste Förderer, wieder mit „Name:“)');
  if (X.ordner) B.splice(1, 0, '#ORDNER', 'Link: https://…');
  if (zust) B.push('#KONTAKTE', 'Name: …', 'Position: …', 'E-Mail: …', 'Telefon: …', 'Handy: …');
  B.push('```');
  L.push('## Ausgabe', 'Schreib zuerst kurz, was du gefunden hast und was offen blieb. Gib danach das Ergebnis in genau einem Codeblock aus, genau in diesem Aufbau – '
    + 'ich übernehme ihn automatisch, deshalb keine Tabellen und keine anderen Überschriften. Was du nicht weißt: Zeile weglassen.', ...B);
  return L.join('\n');
}
// Antwort von Copilot lesen: der Textblock mit #BESCHREIBUNG, #FÖRDERER und #KONTAKTE (auch mit „##“, Fettschrift oder ohne Codeblock)
const KI_FELD = { link: 'link', name: 'name', art: 'art', website: 'web', web: 'web', summe: 'betrag', 'erwartete summe': 'betrag', betrag: 'betrag', antragsfrist: 'frist', frist: 'frist', antragsweg: 'weg',
  'weitere fristen': 'fristInfo', fristen: 'fristInfo', 'übliche fördersumme': 'hoehe', fördersumme: 'hoehe', eigenanteil: 'eigenInfo', pro: 'warum', contra: 'knackpunkte',
  einschätzung: 'einsch', quellen: 'quellen', quelle: 'quellen', notizen: 'notiz', notiz: 'notiz', kontakt: 'kontakt', kontakte: 'kontakt',
  position: 'rolle', funktion: 'rolle', 'e-mail': 'mail', email: 'mail', mail: 'mail', telefon: 'tel', handy: 'mobil', mobil: 'mobil' };
function kiTextLesen(t) {
  const r = { beschr: '', items: [], pers: [], link: '' }, bl = []; let sek = '', cur = null, feld = '';
  for (const z0 of String(t || '').replace(/\r/g, '').split('\n')) {
    const z = z0.replace(/\*\*/g, '');
    if (/^\s*```/.test(z)) continue;
    const hd = z.match(/^\s*#+\s*(beschreibung|förderer|foerderer|kontakte|kontaktdaten|ordner)\b/i);
    if (hd) { sek = /^b/i.test(hd[1]) ? 'b' : /^k/i.test(hd[1]) ? 'k' : /^o/i.test(hd[1]) ? 'o' : 'f'; cur = null; feld = ''; continue; }
    if (sek === 'o') { const u = z.match(/https?:\/\/\S+/); if (u && !r.link) r.link = u[0].replace(/[).,;]+$/, ''); continue; }
    if (sek === 'b') { bl.push(z0.trimEnd()); continue; }
    if (!sek) continue;
    const m = z.match(/^\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\- ]{1,24}):\s*(.*)$/), key = m && KI_FELD[norm(m[1])];
    if (key === 'name') { cur = { name: m[2].trim() }; (sek === 'k' ? r.pers : r.items).push(cur); feld = ''; continue; }
    if (key && cur) { feld = key; if (m[2].trim()) cur[key] = m[2].trim(); continue; }
    if (cur && feld && z.trim() && !/^\s*\(.*\)\s*$/.test(z)) cur[feld] = (cur[feld] ? cur[feld] + '\n' : '') + z.trim();
  }
  r.beschr = bl.join('\n').replace(/^\s*\(der Text\)\s*$/m, '').trim();
  r.items = r.items.filter(it => istEintrag(it.name) && it.name !== '…').map(it => Object.assign(it, {
    betrag: it.betrag != null ? (typeof deNum(it.betrag) === 'number' ? deNum(it.betrag) : null) : null, frist: it.frist ? anyDate(it.frist) || '' : '',
    einsch: einschKey(it.einsch), art: ART.find(a => norm(a) === norm(it.art || '')) || '', quellen: quellenZeilen((it.quellen || '').replace(/^\s*-\s*/gm, '')).join('\n') }));
  r.pers = r.pers.filter(p => p.name && p.name !== '…').map(p => ({ n: p.name, rolle: p.rolle || '', mail: mailText(p.mail || ''), tel: telText(p.tel || ''), mobil: telText(p.mobil || '') }));
  return r;
}
// Arbeits-Excel für Cowork: Förderplan (immer), dazu „Beschreibung“, wenn gewählt
const kiVA = (b, A) => ({ auf: A.auf, zeilen: kiAufgaben(b, A), blaetter: A.auf.has('beschr') || !b.pfad.trim() ? [blattBeschreibung(b)] : [] });   // ohne Pfad: Blatt auch für den gefundenen Ordner
const kiExcel = (b, A) => vorlageBlob(b, kiVA(b, A));

/* ---------- Merkzettel je Bedarf (nur dieser Browser): wann der Auftrag angelegt und welcher Stand der Excel zuletzt angesehen wurde */
const KI_KEY = 'bl-ki', KI_NEU = {};
const kiMerk = () => { try { return JSON.parse(localStorage.getItem(KI_KEY) || '{}') || {}; } catch (e) { return {}; } };
const kiMerkSet = (id, o) => { try { const M = kiMerk(); M[id] = Object.assign(M[id] || {}, o); localStorage.setItem(KI_KEY, JSON.stringify(M)); } catch (e) { /* nur in diesem Browser */ } };
function kiGesehen(b, file) { if (file && file.lastModified) kiMerkSet(b.id, { gesehen: file.lastModified }); if (KI_NEU[b.id]) { KI_NEU[b.id] = false; kiKnopf(); } }
const kiKnopf = () => { const b = cur(), x = $('.ki-btn'); if (b && x) { x.classList.toggle('neu', !!KI_NEU[b.id]); x.title = KI_NEU[b.id] ? 'Ergebnis von Copilot oder Cowork liegt vor – ansehen' : 'Mit Copilot oder Cowork weiterarbeiten'; } };
// liegt zum offenen Bedarf eine Excel, die nach dem Auftrag geändert und noch nicht angesehen wurde? (etwa jede Minute und beim Öffnen)
async function kiCheck() {
  const b = UI.view === 'detail' && cur(); if (!b || !rechOrdnerOk()) return;
  const m = kiMerk()[b.id]; if (!m || !m.at) return;
  const f = await rechFile(b), neu = !!(f && f.lastModified > m.at + 2000 && f.lastModified !== m.gesehen);
  if (KI_NEU[b.id] !== neu) { KI_NEU[b.id] = neu; kiKnopf(); }
}
// enthält die Excel etwas zum Übernehmen? (neue oder geänderte Förderer, Vorschlag für die Beschreibung, geprüfte Unterlagen)
async function kiInhalt(b, f) {
  try {
    const buf = await f.arrayBuffer(), g = await readFoerderplan(buf), k = readKiBlaetter(await xlsxBook(buf));
    return !!((k.beschr && norm(k.beschr) !== norm(b.beschreibung)) || k.ul.length || (g && g.items.some(it => { const x = b.foerderer.find(y => kkey(y.name) === kkey(it.name)); return !x || fpGeaendert(it, g.stand.get(kkey(it.name))); })));
  } catch (e) { return false; }
}

/* ---------- Dialog: Aufgaben wählen (mehrere), Excel anlegen und Prompt kopieren, Ergebnis übernehmen */

/* ---------- Dialog „Copilot-Auftrag“: vier Kacheln (mehrere wählbar), bei der Förderrecherche darunter die Förderer zum Anklicken.
   Wer es macht, schlägt die Liste vor: Copilot (kostet nichts) für Beschreibung, neue Förderer und Kontaktdaten; Cowork, sobald eine Förderrecherche
   dabei ist (Skill, ausführliche Datei je Förderer). Umschalten geht. Copilot antwortet im Chat – den Textblock am Ende hier einfügen;
   Cowork schreibt in die Arbeits-Excel – „Ergebnis übernehmen“. Kontaktdaten laufen immer über Copilot. Texte (Antrag, Dank …) folgen später. */
async function kiDialog(b, vorwahl) {
  let close = null, datei = await rechFile(b), wo = 'copilot', woHand = false, promptAuf = false, fertig = false, neuDazu = true, antwort = '', kopiert = true;
  const ordner = rechOrdnerOk();
  const sel = new Set((vorwahl || []).filter(k => kiOk(b, KI_KACHELN.find(a => a.k === k))));
  const foeSel = new Set(kiFoe(b).filter(f => f.status === 'geplant' || f.status === 'beantragt').map(f => f.id));
  const A = () => ({ auf: new Set([...sel].filter(k => !KI_NUR_COPILOT.includes(k))), foe: kiFoe(b).filter(f => foeSel.has(f.id)), neuDazu });
  const root = h('div', { class: 'ki' }), closeKi = () => { if (close) close(null); };
  const setzeInhalt = (...L) => root.replaceChildren(...L.filter(Boolean));          // leere Teile (null) nicht als Text
  const btn = (t, cls, fn, x) => h('button', Object.assign({ type: 'button', class: cls || '', onclick: fn }, x || {}), t);
  const kopiere = text => new Promise(res => { try { navigator.clipboard.writeText(text).then(() => res(true), () => res(false)); } catch (e) { res(false); } });
  // was in welchen Prompt gehört: Cowork bekommt Beschreibung, neue Förderer und Recherche; Copilot alles, was nicht zu Cowork geht, und die Kontaktdaten
  const plan = () => { const a = A(), cw = wo === 'cowork' && kiAufgaben(b, a).length > 0, X = { zust: sel.has('zust'), ordner: sel.has('ordner') };
    const co = cw ? X.zust || X.ordner : kiPromptCopilot(b, a, X).includes('## Aufgaben\n1.');
    return { a, cw, co, pCw: cw ? kiPrompt(b, a) : '', pCo: co ? kiPromptCopilot(b, cw ? { auf: new Set(), foe: [], neuDazu: false } : a, X) : '' }; };

  async function los() {
    const P = plan();
    if (P.cw) {
      if (ordner) {
        if (datei && await kiInhalt(b, datei) && !await confirmBox('Neuen Auftrag anlegen?', 'In „' + datei.name + '“ stehen Ergebnisse, die noch nicht übernommen sind. Sie werden ersetzt.', 'Ersetzen')) return;
        if (!await rechWrite(b, kiVA(b, P.a))) { toast('Die Excel konnte nicht im Ordner abgelegt werden. Sie wird stattdessen heruntergeladen.', 'warn'); download(vorlageName(b), kiExcel(b, P.a)); }
        datei = await rechFile(b);
      } else if (!DEMO) download(vorlageName(b), kiExcel(b, P.a));
      kiMerkSet(b.id, { at: datei ? datei.lastModified : Date.now(), gesehen: datei ? datei.lastModified : 0 }); KI_NEU[b.id] = false; kiKnopf();
    }
    kopiert = await kopiere(P.cw ? P.pCw : P.pCo);
    fertig = true; zeichne();
    if (!kopiert) { const ta = root.querySelector('.ki-prompt textarea'); if (ta) { ta.focus(); ta.select(); } }      // Zwischenablage gesperrt: Prompt markiert zeigen
  }
  const ergebnis = async () => {
    if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
    const f = ordner ? await rechFile(b) : null;
    closeKi();
    if (f && !await kiInhalt(b, f)) {
      const v = await modal('Noch kein Ergebnis', h('div', { class: 'help' },
        h('p', null, 'In „' + f.name + '“ (zuletzt geändert am ' + lmText(f) + ' Uhr) steht noch nichts Neues: keine neuen oder geänderten Förderer, keine neue Beschreibung.'),
        h('p', null, 'Mögliche Gründe: Cowork ist noch nicht fertig; OneDrive hat die geänderte Datei noch nicht auf diesen PC geholt (kurz warten); oder das Ergebnis wurde als eigene Datei gespeichert – dann diese auswählen.')),
        [['Schließen', null], ['Trotzdem ansehen', 'show'], ['Andere Datei wählen …', 'pick', 'primary']]);
      if (v === 'pick') { importFoerderplan(b); return; }
      if (v !== 'show') return;
    }
    importFoerderplan(b, f || undefined);
  };
  // Antwort von Copilot einfügen und übernehmen
  const einfuegen = () => {
    const r = kiTextLesen(antwort);
    if (!r.beschr && !r.items.length && !r.pers.length && !r.link) { toast('Kein Ergebnisblock gefunden – in Copilot beim Textblock am Ende auf „Kopieren“ klicken und hier einfügen.', 'warn'); return; }
    closeKi();
    zeigeErgebnis(b, { got: { items: r.items, stand: new Map(), auftrag: [A().auf.has('recherche') ? 'recherche' : 'copilot'], kennung: '' }, ki: { beschr: r.beschr, grundlage: '', ul: [] }, pers: r.pers, link: r.link, name: 'der Antwort von Copilot' });
  };
  const antwortFeld = () => h('div', { class: 'ki-antwort' }, h('b', null, 'Antwort von Copilot'),
    h('div', { class: 'muted small' }, 'Am Ende seiner Antwort steht ein Textblock – dort auf „Kopieren“ klicken und hier einfügen.'),
    h('textarea', { rows: 5, placeholder: '#BESCHREIBUNG …', 'aria-label': 'Antwort von Copilot', value: antwort, oninput: e => { antwort = e.target.value; } }),
    h('div', { class: 'ki-fuss-r' }, btn('Übernehmen …', 'primary', einfuegen)));

  function zeichne() {
    if (!woHand) wo = sel.has('recherche') ? 'cowork' : 'copilot';
    const P = plan(), a = P.a;
    if (fertig) {
      setzeInhalt(
        kopiert ? h('div', { class: 'ki-ok' }, h('b', null, '✓ Prompt kopiert'), P.cw ? ' – in Cowork einfügen.' : ' – in Copilot einfügen.')
          : h('div', { class: 'ki-prompt' }, h('div', { class: 'small' }, h('b', null, 'Prompt markiert'), ' – mit Strg+C kopieren und in ' + (P.cw ? 'Cowork' : 'Copilot') + ' einfügen.'),
            h('textarea', { class: 'rech-prompt', rows: 8, spellcheck: false, 'aria-label': 'Prompt', value: P.cw ? P.pCw : P.pCo })),
        P.cw ? h('div', { class: 'ki-datei muted small' }, ordner ? 'Excel: ' + RECH_DIR + ' › ' + vorlageName(b) : DEMO ? 'In der Vorschau wird keine Excel angelegt.' : 'Die Excel liegt in „Downloads“ – für Cowork in den OneDrive legen.') : null,
        P.cw && P.co ? h('div', { class: 'ki-zweit' }, h('span', null, (sel.has('ordner') && sel.has('zust') ? 'Ordner und Kontaktdaten laufen' : sel.has('ordner') ? 'Der Ordner läuft' : 'Kontaktdaten laufen') + ' über Copilot:'),
          btn('Zweiten Prompt kopieren', '', async () => { if (await kopiere(P.pCo)) toast('Prompt kopiert – in Copilot einfügen', 'ok'); else { promptAuf = true; fertig = false; zeichne(); } })) : null,
        P.co ? antwortFeld() : null,
        h('div', { class: 'ki-fuss' }, btn('‹ Zurück zur Auswahl', 'link small', () => { fertig = false; kopiert = true; zeichne(); }), h('span', { class: 'ki-sp' }),
          P.cw ? btn(ordner ? 'Ergebnis von Cowork übernehmen' : 'Ergebnis-Excel wählen …', 'ki-erg' + (P.co ? '' : ' primary'), ergebnis) : null));
      return;
    }
    const kachel = x => {
      const ok = x.ok ? x.ok(b) : true, aus = ok !== true, on = sel.has(x.k) && !aus;
      const sub = aus ? ok : x.k === 'recherche' && on ? a.foe.length + ' Förderer' + (sel.has('suchen') && neuDazu ? ' + neu gefundene' : '') + ' ausgewählt' : x.s;
      return h('button', { type: 'button', class: 'ki-k' + (on ? ' on' : '') + (aus ? ' aus' : ''), disabled: aus, 'aria-pressed': String(on), 'data-k': x.k, onclick: () => { on ? sel.delete(x.k) : sel.add(x.k); zeichne(); } },
        h('span', { class: 'ki-k-top' }, h('span', { class: 'ki-ico', html: KI_ICO[x.k] }), h('b', null, x.t)), h('small', null, sub));
    };
    const chip = (t, s, on, fn, cls) => h('button', { type: 'button', class: 'ki-chip' + (on ? ' on' : '') + (cls ? ' ' + cls : ''), 'aria-pressed': String(on), onclick: fn }, on ? '✓ ' : '', t, s ? h('small', null, s) : null);
    const L = kiFoe(b);
    const foePanel = sel.has('recherche') ? h('div', { class: 'ki-foe' },
      h('div', { class: 'ki-foe-h' }, h('b', null, 'Welche Förderer recherchieren?'), L.length > 1 ? h('span', { class: 'ki-foe-alle' },
        btn('alle', 'link small', () => { L.forEach(f => foeSel.add(f.id)); zeichne(); }), ' · ', btn('keine', 'link small', () => { foeSel.clear(); zeichne(); })) : null),
      h('div', { class: 'ki-chips' }, ...L.map(f => chip(f.name.trim(), F_ST_L[f.status], foeSel.has(f.id), () => { foeSel.has(f.id) ? foeSel.delete(f.id) : foeSel.add(f.id); zeichne(); })),
        chip('die neu gefundenen', sel.has('suchen') ? 'aus „Neue Förderer“' : 'sucht auch neue', sel.has('suchen') && neuDazu,
          () => { if (!sel.has('suchen')) { sel.add('suchen'); neuDazu = true; } else neuDazu = !neuDazu; zeichne(); }, 'neu'))) : null;
    const seg = h('div', { class: 'seg small ki-wo', role: 'group', 'aria-label': 'Wer macht es?' }, [['copilot', 'Copilot'], ['cowork', 'Cowork']].map(([v, l]) =>
      btn(l, v === wo ? 'on' : '', () => { wo = v; woHand = true; zeichne(); }, { title: v === 'cowork' ? 'Cowork: arbeitet direkt in der Excel im OneDrive, nutzt deine Skills und legt je Förderer eine ausführliche Recherche als Datei an – kostet Credits'
        : 'Copilot: antwortet im Chat, den Textblock am Ende hier einfügen – kostet nichts' })));
    const empf = sel.size ? h('span', { class: 'muted small' }, wo === (sel.has('recherche') ? 'cowork' : 'copilot') ? 'empfohlen' : '') : null;
    const ta = (v, lab) => h('div', { class: 'ki-prompt' }, lab ? h('div', { class: 'muted small' }, lab) : null, h('textarea', { class: 'rech-prompt', rows: 10, spellcheck: false, 'aria-label': lab || 'Prompt', value: v }));
    const prompts = promptAuf ? [P.cw ? ta(P.pCw, P.co ? 'Für Cowork:' : '') : null, P.co ? ta(P.pCo, P.cw ? 'Für Copilot:' : '') : null] : [];
    setzeInhalt(
      h('div', { class: 'ki-kacheln' }, KI_KACHELN.map(kachel)), foePanel,
      h('div', { class: 'ki-spaeter', 'aria-disabled': 'true' }, h('span', { class: 'ki-sp-lab' }, 'Späteres Update'), h('ul', null, KI_SPAETER.map(t => h('li', null, t)))),
      ...prompts,
      h('div', { class: 'ki-fuss' }, sel.size ? seg : null, empf, P.cw || P.co ? btn(promptAuf ? 'Prompt ausblenden' : 'Prompt ansehen', 'link small', () => { promptAuf = !promptAuf; zeichne(); }) : null, h('span', { class: 'ki-sp' }),
        ordner && datei ? btn('Ergebnis von Cowork', 'ki-erg' + (KI_NEU[b.id] ? ' primary' : ''), ergebnis, { title: 'Ergebnis aus der Arbeits-Excel übernehmen' }) : null,
        btn('Auftrag kopieren', 'ki-los' + (KI_NEU[b.id] && ordner && datei ? '' : ' primary'), los, { disabled: !(P.cw || P.co), title: P.cw ? 'Legt die Excel an und kopiert den Prompt für Cowork' : 'Kopiert den Prompt für Copilot' })));
  }
  zeichne();
  await modal('Copilot-Auftrag', root, [], { wide: true, expose: c => { close = c; } });
  kiCheck();
}
