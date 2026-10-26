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
  { k: 'beschr', t: 'Beschreibung', s: 'neu aus den Dateien im Ordner', wer: 'cowork', ok: b => kiOrdner(b) || 'erst rechts unter „Ordner“ den Pfad eintragen' },
  { k: 'suchen', t: 'Neue Förderer', s: 'passend zum Bedarf suchen', wer: 'cowork' },
  { k: 'recherche', t: 'Förderrecherche', s: 'Steckbrief, Pro und Contra', wer: 'cowork' },
  { k: 'zust', t: 'Kontaktdaten', s: 'Zuständige aus dem Intranet', wer: 'copilot', ok: b => b.zust.some(z => z.n.trim()) || 'erst eine zuständige Person eintragen' },
];
const KI_SPAETER = ['Antrag / Anschreiben', 'Bitte um Freigabe', 'Nachfass-Mail', 'Dank', 'Pressemitteilung', 'Sachbericht'];
const kiOk = (b, a) => !a || !a.ok || a.ok(b) === true;
const kiSvg = d => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const KI_ICO = { beschr: kiSvg('M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 15.5h5M10 9h2'), suchen: kiSvg('M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20'),
  recherche: kiSvg('M4 20V10M10 20V4M16 20v-7M22 20H2'), zust: kiSvg('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0') };

/* ---------- Auftrag: dieselben Sätze stehen im Prompt und im Blatt „Anleitung“ der Excel.
   Aufbau je Aufgabe: Ziel – Vorgehen – Ergebnis (wohin, in welcher Form); dazu ein Beispiel für „gut“ und „zu allgemein“, damit die Punkte konkret werden */
// A: { auf: Set der Aufgaben, foe: Förderer für die Recherche, neuDazu: auch die neu gefundenen recherchieren }
function kiAufgaben(b, A) {
  const T = A.auf, L = [], foe = A.foe, neu = T.has('suchen') && A.neuDazu;
  if (T.has('beschr')) L.push('Projektbeschreibung. Ziel: Wer sie liest, versteht das Projekt in einer Minute – sie ist Grundlage für alle Anträge. '
    + 'Vorgehen: Lies alle Dateien im Ordner des Bedarfs (vor allem Angebot, Kostenplan, Konzept, Projektsteckbrief, Mails); die bisherige Beschreibung ist nur ein Anhaltspunkt. '
    + 'Ergebnis: 2 bis 3 kurze Absätze (etwa 120 bis 220 Wörter), sachlich und ohne Werbesprache, die diese Eckdaten erkennbar machen, soweit sie in den Dateien stehen: '
    + 'was angeschafft oder umgesetzt wird (Gegenstand, Umfang, Modell); wer es nutzt und wem es hilft (Gliederung, Dienst, Zielgruppe, Zahl der Einsätze oder Menschen); wofür und mit welcher Wirkung; '
    + 'warum jetzt (Anlass, Zustand des Bisherigen); Kosten laut Angebot (Summe, Anbieter, Datum des Angebots) und Zeitplan. Fehlt eine Eckdate, lass sie weg und nenne sie im Chat – nicht raten. '
    + 'Trag den Text im Blatt „Beschreibung“ bei „Vorschlag“ ein (Absätze durch eine Leerzeile trennen), bei „Grundlage“ die Namen der Dateien, die du gelesen hast.');
  const R = rechAuftrag(b).slice(0, -1);                                          // ohne „nur leere Zellen ergänzen“ – das regelt die Förderrecherche
  if (T.has('suchen')) L.push('Neue Förderer. Ziel: realistische Kandidaten für den noch offenen Betrag. '
    + 'Vorgehen: ' + R.join(' ') + ' Förderer, die im Blatt „Förderplan“ schon stehen, nicht doppelt anlegen. Umfang: ' + rechUmfang(b) + ' '
    + 'Ergebnis: je neuem Förderer eine neue Zeile im Blatt „Förderplan“ mit mindestens Förderer, Art, Website, Erwartete Summe, Pro, Einschätzung und Quellen.');
  if (T.has('recherche') && (foe.length || neu)) L.push('Förderrecherche je Förderer – für ' + [foe.length ? kiNamen(foe) : '', neu ? 'alle neu gefundenen Förderer' : ''].filter(Boolean).join(' sowie ') + '. '
    + 'Ziel: Je Förderer will ich auf einen Blick sehen, ob sich ein Antrag lohnt und womit ich überzeuge. '
    + 'Vorgehen: Nutze deinen Skill zur Förderlogik-Analyse (heißt etwa „foerderlogik-analyse“). Prüf auf den eigenen Seiten des Förderers Satzungszweck, Förderrichtlinien, Antragsweg und Fristen; '
    + 'prüf die Förderhistorie (' + (karteiFuer(b).length ? 'Blatt „Förder-Kartei“, ' : '') + 'Jahres- und Förderberichte); gleich alles mit diesem Bedarf ab: Zweck, Region, Förderhöhe im Verhältnis zum offenen Betrag, Eigenanteil, Zeitplan. '
    + 'Ergebnis in der Zeile des Förderers im Blatt „Förderplan“: „Pro – warum passt das?“ mit 3 bis 5 Punkten, die konkret auf diesen Bedarf zielen '
    + '(gut: „- Satzung fördert ausdrücklich Katastrophenschutz in der Region – das Fahrzeug dient genau dem“; zu allgemein: „- fördert soziale Zwecke“); '
    + '„Contra – Knackpunkte“ mit 2 bis 4 Hürden, je mit dem Hinweis, wie der Antrag ihnen begegnet (z. B. „- max. 5.000 € je Antrag – Teilbetrag beantragen“); '
    + 'dazu Kontakte, Antragsweg, Antragsfrist (nächster Termin als Datum), Weitere Fristen und Termine (als Punkte), Übliche Fördersumme, Eigenanteil gefordert, Erwartete Summe (realistisch), '
    + 'Einschätzung, Website und Quellen; die Begründung der Einschätzung in einem Satz unter „Notizen“. '
    + 'Vorhandene Angaben darfst du verbessern; bei Förderern mit Stand „zugesagt“ oder „abgelehnt“ nur leere Zellen ergänzen.');
  return L.map((t, i) => (i + 1) + '. ' + t);
}
const KI_REGELN = ['Nichts erfinden. Was du nicht belegen kannst, bleibt leer; Unsicheres kennzeichnen (z. B. „laut Website 2025, nicht bestätigt“).',
  'Als Quellen nur Links, die du tatsächlich geöffnet hast. Kannst du nicht im Web suchen oder eine Datei nicht öffnen, sag es mir, statt weiterzumachen.',
  'Kurz und schnell erfassbar: in Pro, Contra, Fristen und Notizen je Punkt eine eigene Zeile mit „- “ am Anfang, höchstens ein Satz.',
  'Blattnamen, Spaltenüberschriften und die Angaben oben (Bedarf, Kennung) nicht ändern; Datum als TT.MM.JJJJ, Beträge nur als Zahl in Euro.'];
const KI_PRUEFEN = ['Jede Angabe stammt aus einer Datei oder Seite, die du geöffnet hast; jede Förderer-Zeile hat mindestens eine Quelle.',
  'Pro und Contra sind konkret auf diesen Bedarf bezogen, nicht allgemein; keine Platzhalter wie „k. A.“ oder „n/a“.',
  'Beträge sind Zahlen, Daten TT.MM.JJJJ, Blattnamen und Überschriften unverändert.'];
function kiPrompt(b, A, wo) {
  const F = finState(b), gl = rechGl(b), name = vorlageName(b), P = rechOrdnerOk() ? rechPfad() : { lokal: '', od: '' }, cw = wo === 'cowork', T = A.auf, L = [];
  const pfad = b.pfad.trim() ? unquote(b.pfad).trim() : '', link = okLink(b.link) ? b.link.trim() : '', foeAuf = T.has('suchen') || T.has('recherche');
  L.push('Ich bin Fundraiser beim Malteser Hilfsdienst e. V. in der Diözese Paderborn und will den Bedarf unten finanzieren. '
    + 'Ich brauche belastbare, schnell erfassbare Ergebnisse, die ich ohne Nacharbeit in meine Bedarfsliste übernehme. Erledige die Aufgaben der Reihe nach.', '');
  L.push('## Der Bedarf', 'Bedarf: ' + (b.titel || '(ohne Namen)'), 'Gliederung: ' + (gl || 'Diözese Paderborn (ohne Gliederung)'));
  if (F.S) L.push('Summe: ' + eur(F.S) + (F.eig ? ' · Eigenmittel ' + eur(F.eig) : '') + (F.zu ? ' · schon zugesagt ' + eur(F.zu) : '') + ' · noch offen ' + eur(rechOffen(b)));
  if (b.deadline) L.push('Deadline: ' + fmtDate(b.deadline));
  if (b.stichworte.length) L.push('Stichworte oder Fördertöpfe: ' + b.stichworte.join(', '));
  if (b.beschreibung.trim()) L.push('Beschreibung (bisher): ' + b.beschreibung.trim().replace(/\s*\n+\s*/g, ' '));
  if (foeAuf && kiFoe(b).length) L.push('Schon im Förderplan: ' + kiFoe(b).map(f => f.name.trim() + ' (' + F_ST_L[f.status] + ')').join(', '));
  L.push('', '## Dateien');
  L.push('- Arbeitsdatei: ' + (cw ? '„' + name + '“ ' + (P.od ? 'in meinem OneDrive unter „' + P.od + '“' : 'im Unterordner „' + RECH_DIR + '“ neben der Bedarfsliste in meinem OneDrive') + (P.lokal ? ' (auf dem PC: ' + P.lokal + ')' : '')
    + '. Bearbeite sie dort und speichere sie am Ende unter demselben Namen am selben Ort.' : 'die angehängte Excel „' + name + '“. Gib sie mir am Ende als Excel-Datei mit genau diesem Aufbau zurück.')
    + ' Alle Ergebnisse gehören in diese Datei; was in welches Blatt gehört, steht im Blatt „Anleitung“.');
  if (T.has('beschr')) L.push('- Ordner des Bedarfs (Angebot, Konzept, Fotos …): ' + ((cw ? pfad || link : link || pfad) || '(noch nicht eingetragen)') + ' – dort nur lesen: nichts löschen, verschieben oder überschreiben.'
    + (cw && !pfad && link ? ' Kannst du diesen Link nicht öffnen, sag es mir; dann nenne ich dir den Pfad.' : '') + (!cw && !link ? ' Den Ordner kannst du nicht öffnen; ich hänge dir die wichtigsten Dateien an.' : ''));
  L.push('', '## Aufgaben', ...kiAufgaben(b, A), '', '## Regeln', ...KI_REGELN.map(t => '- ' + t), '', '## Vor dem Speichern prüfen', ...KI_PRUEFEN.map(t => '- ' + t), '');
  L.push('## Zum Schluss im Chat', 'Je Aufgabe zwei, drei Sätze: was du gefunden hast und was offen blieb' + (T.has('beschr') ? ' (bei der Beschreibung: welche Eckdaten fehlen)' : '') + '.'
    + (foeAuf ? ' Danach die drei aussichtsreichsten Förderer mit je einem Satz Begründung und welcher Teil der offenen Summe realistisch erscheint.' : ''));
  return L.join('\n');
}
// Arbeits-Excel: Förderplan (immer), dazu „Beschreibung“, wenn gewählt
const kiVA = (b, A) => ({ auf: A.auf, zeilen: kiAufgaben(b, A), blaetter: A.auf.has('beschr') ? [blattBeschreibung(b)] : [] });
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

/* ---------- Dialog „Copilot-Auftrag“: vier Kacheln (mehrere wählbar), bei der Förderrecherche darunter die Förderer zum Anklicken;
   unten Cowork oder Copilot, „Prompt ansehen“ und „Auftrag kopieren“ (legt die Excel an und kopiert den Prompt). Danach: einfügen, Ergebnis übernehmen.
   Die Texte (Antrag, Dank …) stehen grau als späteres Update da. */
async function kiDialog(b, vorwahl) {
  let close = null, datei = await rechFile(b), wo = 'cowork', promptAuf = false, fertig = false, neuDazu = true;
  const ordner = rechOrdnerOk();
  const sel = new Set((vorwahl || []).filter(k => kiOk(b, KI_KACHELN.find(a => a.k === k))));
  const foeSel = new Set(kiFoe(b).filter(f => f.status === 'geplant' || f.status === 'beantragt').map(f => f.id));
  const A = () => ({ auf: new Set([...sel].filter(k => k !== 'zust')), foe: kiFoe(b).filter(f => foeSel.has(f.id)), neuDazu });
  const root = h('div', { class: 'ki' }), closeKi = () => { if (close) close(null); };
  const btn = (t, cls, fn, x) => h('button', Object.assign({ type: 'button', class: cls || '', onclick: fn }, x || {}), t);
  const kopiere = text => new Promise(res => { try { navigator.clipboard.writeText(text).then(() => res(true), () => res(false)); } catch (e) { res(false); } });
  const wem = () => wo === 'cowork' ? 'Cowork' : 'Copilot';

  async function los() {
    const a = A(), cw = kiAufgaben(b, a).length > 0;
    if (cw) {
      if (ordner) {
        if (datei && await kiInhalt(b, datei) && !await confirmBox('Neuen Auftrag anlegen?', 'In „' + datei.name + '“ stehen Ergebnisse, die noch nicht übernommen sind. Sie werden ersetzt.', 'Ersetzen')) return;
        if (!await rechWrite(b, kiVA(b, a))) { toast('Die Excel konnte nicht im Ordner abgelegt werden. Sie wird stattdessen heruntergeladen.', 'warn'); download(vorlageName(b), kiExcel(b, a)); }
        datei = await rechFile(b);
      } else if (!DEMO) download(vorlageName(b), kiExcel(b, a));
      kiMerkSet(b.id, { at: datei ? datei.lastModified : Date.now(), gesehen: datei ? datei.lastModified : 0 }); KI_NEU[b.id] = false; kiKnopf();
    }
    if (!await kopiere(cw ? kiPrompt(b, a, wo) : personenPrompt(b))) {           // Zwischenablage gesperrt: Prompt zeigen und markieren
      promptAuf = true; zeichne(); const ta = root.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); }
      toast('Prompt markiert – jetzt mit Strg+C kopieren'); return;
    }
    fertig = true; zeichne();
  }
  const ergebnis = async () => {
    if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
    const f = ordner ? await rechFile(b) : null;
    closeKi();
    if (f && !await kiInhalt(b, f)) {
      const v = await modal('Noch kein Ergebnis', h('div', { class: 'help' },
        h('p', null, 'In „' + f.name + '“ (zuletzt geändert am ' + lmText(f) + ' Uhr) steht noch nichts Neues: keine neuen oder geänderten Förderer, keine neue Beschreibung.'),
        h('p', null, 'Mögliche Gründe: Cowork bzw. Copilot ist noch nicht fertig; OneDrive hat die geänderte Datei noch nicht auf diesen PC geholt (kurz warten); oder das Ergebnis wurde als eigene Datei gespeichert – dann diese auswählen.')),
        [['Schließen', null], ['Trotzdem ansehen', 'show'], ['Andere Datei wählen …', 'pick', 'primary']]);
      if (v === 'pick') { importFoerderplan(b); return; }
      if (v !== 'show') return;
    }
    importFoerderplan(b, f || undefined);
  };
  const persExcel = () => btn('Personen-Excel …', 'link small', () => { closeKi(); personenDialog(b); }, { title: 'Personen-Excel anlegen oder einlesen' });

  function zeichne() {
    const a = A(), zeilen = kiAufgaben(b, a), cw = zeilen.length > 0, zust = sel.has('zust');
    if (fertig) {
      root.replaceChildren(
        h('div', { class: 'ki-ok' }, h('b', null, '✓ Prompt kopiert'), cw ? ' – in ' + wem() + ' einfügen' + (wo === 'copilot' ? ' und die Excel anhängen.' : '.') : ' – in Copilot einfügen und die Personen-Excel anhängen.'),
        cw ? h('div', { class: 'ki-datei muted small' }, ordner ? 'Excel: ' + RECH_DIR + ' › ' + vorlageName(b) : DEMO ? 'In der Vorschau wird keine Excel angelegt.' : 'Die Excel liegt in „Downloads“ – für Cowork in den OneDrive legen.') : null,
        cw && zust ? h('div', { class: 'ki-zweit' }, h('span', null, 'Kontaktdaten laufen über Copilot:'),
          btn('Zweiten Prompt kopieren', '', async () => { if (await kopiere(personenPrompt(b))) toast('Prompt kopiert – in Copilot einfügen', 'ok'); else { promptAuf = true; fertig = false; zeichne(); } }), persExcel()) : null,
        !cw ? h('div', { class: 'ki-zweit' }, persExcel()) : null,
        h('div', { class: 'ki-fuss' }, btn('‹ Zurück zur Auswahl', 'link small', () => { fertig = false; zeichne(); }), h('span', { class: 'ki-sp' }),
          cw ? btn(ordner ? 'Ergebnis übernehmen' : 'Ergebnis-Excel wählen …', 'primary ki-erg', ergebnis) : null));
      return;
    }
    const kachel = x => {
      const ok = x.ok ? x.ok(b) : true, aus = ok !== true, on = sel.has(x.k) && !aus;
      const sub = aus ? ok : x.k === 'recherche' && on ? a.foe.length + ' Förderer' + (sel.has('suchen') && neuDazu ? ' + neu gefundene' : '') + ' ausgewählt' : x.s;
      return h('button', { type: 'button', class: 'ki-k' + (on ? ' on' : '') + (aus ? ' aus' : ''), disabled: aus, 'aria-pressed': String(on), 'data-k': x.k, onclick: () => { on ? sel.delete(x.k) : sel.add(x.k); zeichne(); } },
        h('span', { class: 'ki-k-top' }, h('span', { class: 'ki-ico', html: KI_ICO[x.k] }), h('b', null, x.t), h('span', { class: 'ki-wer ' + x.wer }, x.wer === 'copilot' ? 'Copilot' : 'Cowork')),
        h('small', null, sub));
    };
    const chip = (t, s, on, fn, cls) => h('button', { type: 'button', class: 'ki-chip' + (on ? ' on' : '') + (cls ? ' ' + cls : ''), 'aria-pressed': String(on), onclick: fn }, on ? '✓ ' : '', t, s ? h('small', null, s) : null);
    const L = kiFoe(b);
    const foePanel = sel.has('recherche') ? h('div', { class: 'ki-foe' },
      h('div', { class: 'ki-foe-h' }, h('b', null, 'Welche Förderer recherchieren?'), L.length > 1 ? h('span', { class: 'ki-foe-alle' },
        btn('alle', 'link small', () => { L.forEach(f => foeSel.add(f.id)); zeichne(); }), ' · ', btn('keine', 'link small', () => { foeSel.clear(); zeichne(); })) : null),
      h('div', { class: 'ki-chips' }, ...L.map(f => chip(f.name.trim(), F_ST_L[f.status], foeSel.has(f.id), () => { foeSel.has(f.id) ? foeSel.delete(f.id) : foeSel.add(f.id); zeichne(); })),
        chip('die neu gefundenen', sel.has('suchen') ? 'aus „Neue Förderer“' : 'sucht auch neue', sel.has('suchen') && neuDazu,
          () => { if (!sel.has('suchen')) { sel.add('suchen'); neuDazu = true; } else neuDazu = !neuDazu; zeichne(); }, 'neu'))) : null;
    const seg = h('div', { class: 'seg small', role: 'group', 'aria-label': 'Prompt für' }, [['cowork', 'Cowork'], ['copilot', 'Copilot']].map(([v, l]) =>
      btn(l, v === wo ? 'on' : '', () => { wo = v; zeichne(); }, { title: v === 'cowork' ? 'Cowork arbeitet direkt in der Excel im OneDrive und liest den Ordner – für mehrere Aufgaben' : 'Copilot bekommt die Excel als Anhang und gibt sie ausgefüllt zurück – für kleinere Aufträge' })));
    const ta = (v, lab) => h('div', { class: 'ki-prompt' }, lab ? h('div', { class: 'muted small' }, lab) : null, h('textarea', { class: 'rech-prompt', rows: 10, spellcheck: false, 'aria-label': lab || 'Prompt', value: v }));
    const prompts = promptAuf && (cw || zust) ? [cw ? ta(kiPrompt(b, a, wo), zust ? 'Für ' + wem() + ':' : '') : null, zust ? ta(personenPrompt(b), 'Für Copilot (Kontaktdaten, Personen-Excel anhängen):') : null] : [];
    root.replaceChildren(
      h('div', { class: 'ki-kacheln' }, KI_KACHELN.map(kachel)), foePanel,
      h('div', { class: 'ki-spaeter', 'aria-disabled': 'true' }, h('span', { class: 'ki-sp-lab' }, 'Späteres Update'), h('ul', null, KI_SPAETER.map(t => h('li', null, t)))),
      ...prompts,
      h('div', { class: 'ki-fuss' }, cw ? seg : null, cw || zust ? btn(promptAuf ? 'Prompt ausblenden' : 'Prompt ansehen', 'link small', () => { promptAuf = !promptAuf; zeichne(); }) : null, h('span', { class: 'ki-sp' }),
        ordner && datei ? btn('Ergebnis übernehmen', 'ki-erg' + (KI_NEU[b.id] ? ' primary' : ''), ergebnis) : null,
        btn('Auftrag kopieren', 'ki-los' + (KI_NEU[b.id] && ordner && datei ? '' : ' primary'), los, { disabled: !(cw || zust), title: cw ? 'Legt die Excel an und kopiert den Prompt' : 'Kopiert den Prompt' })));
  }
  zeichne();
  await modal('Copilot-Auftrag', root, [], { wide: true, expose: c => { close = c; } });
  kiCheck();
}
