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
// Aufgaben: wer – Cowork (Dateien, Recherche, Skills) oder Copilot (Intranet); ok – true oder warum es gerade nicht geht
const KI_AUFG = [
  { k: 'zust', g: 'Bedarf', wer: 'copilot', t: 'Zuständige: Position, E-Mail, Telefon und Handy aus dem Intranet', ok: b => b.zust.some(z => z.n.trim()) || 'erst eine zuständige Person eintragen' },
  { k: 'beschr', g: 'Bedarf', wer: 'cowork', t: 'Beschreibung aus den Dateien im Ordner des Bedarfs neu vorschlagen', ok: b => kiOrdner(b) || 'erst den Ordner eintragen (rechts unter „Ordner“)' },
  { k: 'unterl', g: 'Bedarf', wer: 'cowork', t: 'Unterlagen-Check: was im Ordner liegt und was für Anträge noch fehlt', ok: b => kiOrdner(b) || 'erst den Ordner eintragen (rechts unter „Ordner“)' },
  { k: 'suchen', g: 'Förderer', wer: 'cowork', t: 'Neue Förderer suchen, die zum Bedarf passen (Förder-Kartei zuerst)' },
  { k: 'recherche', g: 'Förderer', wer: 'cowork', t: 'Förderrecherche je Förderer: Steckbrief, Pro und Contra, Einschätzung' },
  { k: 'antrag', g: 'Texte', wer: 'cowork', t: 'Antrag bzw. Anschreiben je Förderer', ok: b => kiFoe(b).some(f => f.status === 'geplant') || 'kein Förderer mit Stand „geplant“' },
  { k: 'freigabe', g: 'Texte', wer: 'cowork', t: 'Bitte um Freigabe (Ortsführungskreis, Fachreferat, Verwaltung)', ok: b => frItems(b).some(i => frNeeded(i) && i.st !== 'ok') || 'Freigabe ist vollständig' },
  { k: 'nachfass', g: 'Texte', wer: 'cowork', t: 'Nachfass-Mail an Förderer, bei denen der Antrag läuft', ok: b => kiFoe(b).some(f => f.status === 'beantragt') || 'kein Antrag offen' },
  { k: 'dank', g: 'Texte', wer: 'cowork', t: 'Dank an Förderer mit Zusage', ok: b => kiFoe(b).some(f => f.status === 'zugesagt') || 'noch keine Zusage' },
  { k: 'presse', g: 'Texte', wer: 'cowork', t: 'Pressemitteilung zur Spendenübergabe', ok: b => kiFoe(b).some(f => f.status === 'zugesagt') || 'noch keine Zusage' },
  { k: 'sachbericht', g: 'Texte', wer: 'cowork', t: 'Sachbericht für den Verwendungsnachweis', ok: b => kiFoe(b).some(f => f.status === 'zugesagt' && f.vn.noetig) || 'kein Verwendungsnachweis nötig' },
];
const KI_TEXTE = ['antrag', 'freigabe', 'nachfass', 'dank', 'presse', 'sachbericht'];
const kiOk = (b, a) => !a.ok || a.ok(b) === true;

/* ---------- Auftrag: dieselben Sätze stehen im Prompt und im Blatt „Anleitung“ der Excel */
// A: { auf: Set der Aufgaben, foe: Förderer für die Recherche }
function kiAufgaben(b, A) {
  const T = A.auf, L = [], foe = A.foe, neuDazu = T.has('suchen') ? (foe.length ? ' sowie die neu gefundenen' : 'die neu gefundenen Förderer') : '';
  if (T.has('beschr')) L.push('Beschreibung: Lies die Dateien im Ordner des Bedarfs (vor allem Angebot, Konzept, Projektsteckbrief) und schlag eine neue Beschreibung vor – 3 bis 5 kurze Sätze: was angeschafft oder umgesetzt wird, wofür und für wen, warum jetzt und was es laut Angebot kostet. Sachlich, ohne Werbesprache. Trag sie im Blatt „Beschreibung“ bei „Vorschlag“ ein, bei „Grundlage“ die Dateien, die du gelesen hast.');
  if (T.has('unterl')) L.push('Unterlagen-Check: Prüfe, welche Unterlagen im Ordner des Bedarfs liegen (Angebot, Kostenplan, Konzept, Fotos, Unterstützerschreiben …) und was für Anträge typischerweise noch fehlt. Trag im Blatt „Unterlagen“ je Unterlage eine Zeile ein: „Im Ordner?“ ja oder nein, den Dateinamen und, wenn nötig, einen kurzen Hinweis (z. B. „Angebot älter als sechs Monate“).');
  if (T.has('suchen')) L.push('Neue Förderer: ' + rechAuftrag(b).slice(0, 3).join(' ') + ' Umfang: ' + rechUmfang(b) + ' Je neuem Förderer eine neue Zeile im Blatt „Förderplan“.');
  if (T.has('recherche') && (foe.length || neuDazu)) L.push('Förderrecherche je Förderer – für ' + (foe.length ? kiNamen(foe) : '') + neuDazu + ': Nutze deinen Skill zur Förderlogik-Analyse (heißt etwa „foerderlogik-analyse“): '
    + 'Satzung, Förderrichtlinien und Förderhistorie prüfen und daraus die Argumentation für genau diesen Bedarf ableiten. Trag die Ergebnisse in die Zeile des Förderers im Blatt „Förderplan“ ein: '
    + '„Pro – warum passt das?“ und „Contra – Knackpunkte“ mit je 3 bis 5 Punkten, dazu Kontakte, Antragsweg, Antragsfrist, weitere Fristen und Termine, übliche Fördersumme, geforderter Eigenanteil, Einschätzung, Website und Quellen. '
    + 'Vorhandene Angaben darfst du verbessern; bei Förderern mit Stand „zugesagt“ oder „abgelehnt“ nur leere Zellen ergänzen.');
  const tx = [];
  const geplant = kiFoe(b).filter(f => f.status === 'geplant'), beantragt = kiFoe(b).filter(f => f.status === 'beantragt'), zu = kiFoe(b).filter(f => f.status === 'zugesagt');
  if (T.has('antrag')) tx.push('Antrag bzw. Anschreiben an ' + kiNamen(geplant) + ' – nach der Förderlogik des jeweiligen Förderers (Pro und Contra im Blatt „Förderplan“), mit Summe und Verwendungszweck');
  if (T.has('freigabe')) tx.push('kurze Mail mit der Bitte um Freigabe an: ' + frItems(b).filter(i => frNeeded(i) && i.st !== 'ok').map(frName).join(', ') + ' – Bedarf, Summe, warum er wichtig ist, bis wann die Freigabe gebraucht wird');
  if (T.has('nachfass')) tx.push('freundliche Nachfass-Mail an ' + beantragt.map(f => f.name.trim() + (f.beantragtAm ? ' (beantragt am ' + fmtDate(f.beantragtAm) + ')' : '')).join(', '));
  if (T.has('dank')) tx.push('Dankschreiben an ' + kiNamen(zu));
  if (T.has('presse')) { const u = b.nach.ueb; tx.push('Pressemitteilung zur Spendenübergabe' + (u.termin ? ' am ' + fmtDate(u.termin) + (u.zeit ? ', ' + u.zeit + ' Uhr' : '') : '') + (u.ort ? ' in ' + u.ort : '') + ' – mit Dank an ' + kiNamen(zu) + '; fehlende Angaben als [Platzhalter]'); }
  if (T.has('sachbericht')) tx.push('Sachbericht für den Verwendungsnachweis an ' + kiNamen(zu.filter(f => f.vn.noetig)) + ' – aus den Unterlagen im Ordner; was fehlt (Zahlen, Fotos, Datum), als [Platzhalter] kennzeichnen');
  if (tx.length) L.push('Entwürfe: Nutze deinen Skill für Fundraising-Texte (heißt etwa „malteser-fundraising-texte“) und schreib ' + (tx.length === 1 ? 'diesen Text als Word-Datei' : 'diese Texte, je Text eine Word-Datei') + ' „Entwurf – <Art> – <Empfänger>.docx“: '
    + tx.map((t, i) => '(' + String.fromCharCode(97 + i) + ') ' + t).join('; ') + '.');
  return L.map((t, i) => (i + 1) + '. ' + t);
}
const KI_REGELN = ['Kurz und schnell erfassbar: in Pro, Contra, Fristen und Notizen je Punkt eine eigene Zeile mit „- “ am Anfang, höchstens ein kurzer Satz.',
  'Nichts erfinden: was du nicht findest, bleibt leer; Unsicheres kennzeichnen (z. B. „laut Website 2025, nicht bestätigt“).',
  'Als Quellen nur Links, die du tatsächlich geöffnet hast. Wenn du nicht im Web suchen kannst, sag es mir, statt zu raten.',
  'Blattnamen, Spaltenüberschriften und die Angaben oben (Bedarf, Kennung) nicht ändern. Datum als TT.MM.JJJJ, Beträge nur als Zahl in Euro.'];
function kiPrompt(b, A, wo) {
  const F = finState(b), gl = rechGl(b), name = vorlageName(b), P = rechOrdnerOk() ? rechPfad() : { lokal: '', od: '' }, cw = wo === 'cowork', T = A.auf, L = [];
  const texte = KI_TEXTE.some(k => T.has(k)), ordner = T.has('beschr') || T.has('unterl') || texte;
  const pfad = b.pfad.trim() ? unquote(b.pfad).trim() : '', link = okLink(b.link) ? b.link.trim() : '';
  L.push('Du unterstützt mich im Fundraising des Malteser Hilfsdienst e. V. in der Diözese Paderborn. Erledige für diesen Bedarf die Aufgaben unten der Reihe nach.', '');
  L.push('Bedarf: ' + (b.titel || '(ohne Namen)'), 'Gliederung: ' + (gl || 'Diözese Paderborn (ohne Gliederung)'));
  if (F.S) L.push('Summe: ' + eur(F.S) + (F.eig ? ' · Eigenmittel ' + eur(F.eig) : '') + (F.zu ? ' · schon zugesagt ' + eur(F.zu) : '') + ' · noch offen ' + eur(rechOffen(b)));
  if (b.deadline) L.push('Deadline: ' + fmtDate(b.deadline));
  if (b.stichworte.length) L.push('Stichworte oder Fördertöpfe: ' + b.stichworte.join(', '));
  if (b.beschreibung.trim()) L.push('Beschreibung (bisher): ' + b.beschreibung.trim().replace(/\s*\n+\s*/g, ' '));
  L.push('', 'Dateien:');
  L.push('- Arbeitsdatei: ' + (cw ? '„' + name + '“ ' + (P.od ? 'in deinem OneDrive unter „' + P.od + '“' : 'im Unterordner „' + RECH_DIR + '“ neben der Bedarfsliste in meinem OneDrive') + (P.lokal ? ' (auf dem PC: ' + P.lokal + ')' : '')
    + '. Bearbeite sie dort und speichere sie am Ende unter demselben Namen am selben Ort.' : 'die angehängte Excel „' + name + '“. Gib sie mir am Ende als Excel-Datei mit genau diesem Aufbau zurück.')
    + ' Alle Ergebnisse gehören in diese Datei; was in welches Blatt gehört, steht im Blatt „Anleitung“, oben im Blatt „Förderplan“ stehen Bedarf und Finanzierung.');
  if (ordner) {
    const wo2 = cw ? pfad || link : link || pfad;
    L.push('- Ordner des Bedarfs (Angebot, Konzept, Fotos …): ' + (wo2 || '(noch nicht eingetragen)') + ' – dort nur lesen: nichts löschen, verschieben oder überschreiben.'
      + (cw && !pfad && link ? ' Falls du diesen Link nicht öffnen kannst, sag es mir; dann nenne ich dir den Pfad.' : '') + (!cw && !link ? ' Den Ordner kannst du nicht öffnen; ich hänge dir die wichtigsten Dateien an.' : ''));
    if (texte) L.push('- Entwürfe: ' + (cw ? 'als Word-Dateien in ' + (pfad ? 'den Ordner des Bedarfs' : 'denselben Ordner wie die Arbeitsdatei') : 'gib mir jeden Entwurf als Word-Datei') + '.');
  }
  L.push('', 'Aufgaben:', ...kiAufgaben(b, A), '', 'Regeln:', ...KI_REGELN.map(t => '- ' + t), '');
  L.push('Zum Schluss im Chat: je Aufgabe zwei, drei Sätze – was du gefunden hast, was offen blieb' + (texte ? ' und welche Entwürfe du angelegt hast' : '') + '.');
  return L.join('\n');
}
// Arbeits-Excel: Förderplan (immer), dazu „Beschreibung“ und „Unterlagen“, wenn gewählt
const kiVA = (b, A) => ({ auf: A.auf, zeilen: kiAufgaben(b, A), blaetter: [A.auf.has('beschr') ? blattBeschreibung(b) : null, A.auf.has('unterl') ? blattUnterlagen(b) : null].filter(Boolean) });
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
async function kiDialog(b, vorwahl) {
  let close = null, datei = await rechFile(b), wo = 'cowork';
  const ordner = rechOrdnerOk(), P = rechPfad();
  const sel = new Set((vorwahl || []).filter(k => kiOk(b, KI_AUFG.find(a => a.k === k))));
  const foeSel = new Set(kiFoe(b).filter(f => f.status === 'geplant' || f.status === 'beantragt').map(f => f.id));
  const A = () => ({ auf: new Set([...sel].filter(k => k !== 'zust')), foe: kiFoe(b).filter(f => foeSel.has(f.id)) });
  const kopiere = (ta, wem) => { const fail = () => { ta.focus(); ta.select(); toast('Text markiert – jetzt mit Strg+C kopieren'); };
    try { navigator.clipboard.writeText(ta.value).then(() => toast('Prompt kopiert – in ' + wem + ' einfügen', 'ok'), fail); } catch (e) { fail(); } };

  // 1. Aufgaben
  const foeBox = h('div', { class: 'ki-foe' }, kiFoe(b).length ? kiFoe(b).map(f => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: foeSel.has(f.id), onchange: e => { e.target.checked ? foeSel.add(f.id) : foeSel.delete(f.id); neu(); } }), h('span', null, f.name.trim(), h('span', { class: 'muted small' }, ' · ' + F_ST_L[f.status]))))
    : h('span', { class: 'muted small' }, 'Noch keine Förderer im Plan – zusammen mit „Neue Förderer suchen“ wählen.'));
  const zeile = a => {
    const ok = a.ok ? a.ok(b) : true, aus = ok !== true;
    const r = h('label', { class: 'ki-auf' + (aus ? ' aus' : ''), 'data-k': a.k },
      h('input', { type: 'checkbox', checked: sel.has(a.k), disabled: aus, onchange: e => { e.target.checked ? sel.add(a.k) : sel.delete(a.k); neu(); } }),
      h('span', { class: 'ki-t' }, a.t, aus ? h('span', { class: 'ki-grund' }, ok) : null), h('span', { class: 'ki-wer ' + a.wer }, a.wer === 'copilot' ? 'Copilot' : 'Cowork'));
    return a.k === 'recherche' ? [r, foeBox] : r;
  };
  const gruppen = ['Bedarf', 'Förderer', 'Texte'].map(g => h('div', { class: 'ki-gr' }, h('div', { class: 'ki-gh' }, g === 'Texte' ? 'Texte (Entwürfe als Word-Datei)' : g), KI_AUFG.filter(a => a.g === g).map(zeile)));

  // 2a. Auftrag für Cowork (oder Copilot): Excel anlegen, Prompt
  const st = h('div', { class: 'rech-st muted small' }), ta = h('textarea', { class: 'rech-prompt', rows: 12, spellcheck: false, 'aria-label': 'Prompt für Cowork' });
  const los = h('button', { class: 'primary', onclick: () => anlegen() });
  const woSeg = h('div', { class: 'seg small ki-wo', role: 'group', 'aria-label': 'Prompt für' }, [['cowork', 'für Cowork'], ['copilot', 'für Copilot']].map(([v, l]) =>
    h('button', { type: 'button', 'data-v': v, class: v === wo ? 'on' : '', onclick: () => { wo = v; woSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === v)); neu(); } }, l)));
  const zeigSt = () => st.replaceChildren(ordner ? (datei ? '„' + datei.name + '“ liegt im Ordner, zuletzt geändert am ' + lmText(datei) + ' Uhr – „Excel anlegen“ ersetzt sie.' : 'Die Excel wird als „' + vorlageName(b) + '“ im Unterordner „' + RECH_DIR + '“ neben der Bedarfsliste abgelegt.')
    : DEMO ? 'In der Vorschau wird keine Excel angelegt – der Prompt lässt sich trotzdem ansehen.' : 'Die Excel landet in „Downloads“. Für Cowork in den OneDrive legen.', ...(ordner && P.lokal ? [h('div', { class: 'rech-pfad', title: 'Pfad zum Ordner – zum Kopieren markieren' }, P.lokal)] : []));
  async function anlegen() {
    const a = A(); if (!a.auf.size) return;
    if (ordner) {
      if (datei && await kiInhalt(b, datei) && !await confirmBox('Excel neu anlegen?', 'In „' + datei.name + '“ stehen Ergebnisse, die noch nicht übernommen sind. Sie werden ersetzt.', 'Ersetzen')) return;
      if (!await rechWrite(b, kiVA(b, a))) { toast('Die Excel konnte nicht im Ordner abgelegt werden. Sie wird stattdessen heruntergeladen.', 'warn'); download(vorlageName(b), kiExcel(b, a)); }
      datei = await rechFile(b);
    } else if (!DEMO) download(vorlageName(b), kiExcel(b, a));
    kiMerkSet(b.id, { at: datei ? datei.lastModified : Date.now(), gesehen: datei ? datei.lastModified : 0 }); KI_NEU[b.id] = false; kiKnopf();
    zeigSt(); kopiere(ta, wo === 'cowork' ? 'Cowork' : 'Copilot');
  }
  const coBlock = h('li', null, h('div', { class: 'rech-row' }, h('b', null, 'Auftrag'), woSeg, los), st,
    h('div', { class: 'muted small ki-wo-t' }), ta,
    h('div', { class: 'muted small rech-hinweis' }, 'Mit Prompt und Excel gehen Bedarf, Beschreibung, Finanzierung und Förderplan an Copilot bzw. Cowork; aus der Kartei nur Name, Zuständigkeit, Schwerpunkte und Förderhistorie – keine Kontaktdaten und Notizen.'));

  // 2b. Zuständige über Copilot und die Personen-Excel
  const tp = h('textarea', { class: 'rech-prompt kurz', rows: 7, spellcheck: false, 'aria-label': 'Prompt für Copilot' });
  const persBlock = h('li', null, h('div', { class: 'rech-row' }, h('b', null, 'Zuständige über Copilot'), h('span', { class: 'rech-btns' },
      h('button', { onclick: () => { closeKi(); personenDialog(b); } }, 'Personen-Excel …'), h('button', { class: 'primary', onclick: () => kopiere(tp, 'Copilot') }, 'Prompt kopieren'))),
    h('div', { class: 'muted small' }, 'Copilot kennt euer Intranet, Cowork nicht. In Copilot einfügen und die Personen-Excel anhängen („Personen-Excel …“ legt sie an, falls es sie noch nicht gibt). Was Copilot einträgt, ergänzt die Liste von selbst.'), tp);

  // 3. Ergebnis übernehmen
  const ergSt = h('div', { class: 'muted small' });
  const ergebnis = async () => {
    if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
    const f = ordner ? await rechFile(b) : null;
    closeKi();
    if (f && !await kiInhalt(b, f)) {
      const v = await modal('Noch kein Ergebnis', h('div', { class: 'help' },
        h('p', null, 'In „' + f.name + '“ (zuletzt geändert am ' + lmText(f) + ' Uhr) steht noch nichts Neues: keine neuen oder geänderten Förderer, keine neue Beschreibung, keine geprüften Unterlagen.'),
        h('p', null, 'Mögliche Gründe: Cowork bzw. Copilot ist noch nicht fertig; OneDrive hat die geänderte Datei noch nicht auf diesen PC geholt (kurz warten); oder das Ergebnis wurde als eigene Datei gespeichert – dann diese auswählen.')),
        [['Schließen', null], ['Trotzdem ansehen', 'show'], ['Andere Datei wählen …', 'pick', 'primary']]);
      if (v === 'pick') { importFoerderplan(b); return; }
      if (v !== 'show') return;
    }
    importFoerderplan(b, f || undefined);
  };
  const ergBlock = h('li', { class: KI_NEU[b.id] ? 'ki-da' : '' }, h('div', { class: 'rech-row' }, h('b', null, 'Ergebnis übernehmen'), h('button', { class: 'ki-erg' + (KI_NEU[b.id] ? ' primary' : ''), onclick: ergebnis }, ordner ? 'Ergebnis ansehen' : 'Excel auswählen …')),
    ergSt, h('div', { class: 'muted small' }, 'Wenn Cowork bzw. Copilot fertig ist. Du siehst zuerst die Vorschläge – Beschreibung bisher und neu nebeneinander, Unterlagen, Förderer – und wählst aus. Entwürfe liegen als Word-Dateien im Ordner. Ist die Excel geändert, zeigt das Copilot-Zeichen oben einen Punkt.'));

  const leer = h('p', { class: 'muted ki-leer' }, 'Oben eine oder mehrere Aufgaben anhaken.');
  function neu() {
    foeBox.hidden = !sel.has('recherche');
    const a = A(), cw = a.auf.size > 0;
    coBlock.hidden = !cw; persBlock.hidden = !sel.has('zust'); leer.hidden = cw || sel.has('zust');
    los.textContent = ordner ? 'Excel anlegen und Prompt kopieren' : DEMO ? 'Prompt kopieren' : 'Excel herunterladen und Prompt kopieren';
    coBlock.querySelector('.ki-wo-t').textContent = wo === 'cowork' ? 'Cowork arbeitet direkt in der Excel im OneDrive und liest den Ordner des Bedarfs (Pfad im Explorer, rechts unter „Ordner“). Für mehrere Aufgaben auf einmal das Richtige.'
      : 'Copilot bekommt die Excel als Anhang und gibt sie ausgefüllt zurück; den Ordner des Bedarfs liest er über den SharePoint-Link. Für kleinere Aufträge.';
    if (cw) ta.value = kiPrompt(b, a, wo);
    if (sel.has('zust')) tp.value = personenPrompt(b);
    const m = kiMerk()[b.id];
    ergSt.textContent = datei && m && m.at ? (datei.lastModified > m.at + 2000 ? 'Die Excel wurde nach dem Auftrag geändert (' + lmText(datei) + ' Uhr).' : 'Seit dem Auftrag (' + lmText({ lastModified: m.at }) + ' Uhr) noch nicht geändert.') : '';
  }
  const body = h('div', { class: 'help rech ki' },
    h('p', null, 'Hak an, was erledigt werden soll – auch mehreres auf einmal. Die Liste legt dafür eine Excel zum Bedarf an und baut den Prompt; das Ergebnis übernimmst du danach mit Vorschau.'),
    h('div', { class: 'ki-auswahl' }, gruppen), leer,
    h('ol', { class: 'rech-steps' }, coBlock, persBlock, ergBlock));
  zeigSt(); neu();
  const closeKi = () => { if (close) close(null); };
  await modal('Mit Copilot und Cowork weiterarbeiten', body, [['Schließen', null]], { wide: true, expose: c => { close = c; } });
  kiCheck();
}
