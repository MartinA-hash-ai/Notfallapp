/* ===================================================================== Förderplan-Excel: Vorlage für die Recherche (von Hand oder mit Copilot) und Übernahme in den Förderplan
   Die Vorlage hat bis zu drei Blätter: „Förderplan“ (oben der Bedarf mit Finanzierung, darunter je Förderer eine Zeile), „Anleitung“ (Auftrag, Umfang,
   Regeln, was in jede Spalte gehört) und „Förder-Kartei“ (Auszug ohne Kontaktdaten: wer für die Gliederung zuständig ist und was er schon gegeben hat).
   Eingelesen wird die Zeile mit „Förderer“ in Spalte A als Kopfzeile; die Spalten werden über ihre Überschrift erkannt. */

const FP_SHEET = 'Förderplan', FP_HEAD_ROW = 15;
const FP_COLS = [
  { k: 'name', t: 'Förderer', w: 30, help: 'Name der Stiftung, Bank, Firma oder des Förderprogramms – genau so, wie er in der Förder-Kartei steht, falls er dort schon vorkommt.' },
  { k: 'stand', t: 'Stand in der Bedarfsliste', w: 16, info: true, help: 'Nur zur Information: wie weit der Förderer schon ist. Wird nicht eingelesen. Bei neuen Förderern leer lassen.' },
  { k: 'art', t: 'Art', w: 18, items: ART, help: 'Aus der Auswahlliste.' },
  { k: 'weg', t: 'Antragsweg', w: 16, items: ['Portal', 'E-Mail', 'Brief', 'Persönlich', 'Telefon', 'Sonstiges'], help: 'Wie der Antrag gestellt wird – aus der Auswahlliste.' },
  { k: 'kontakt', t: 'Kontakte', alias: ['Ansprechperson oder Portal'], w: 36, wrap: true, help: 'Bis zu drei Ansprechpersonen, je Person eine Zeile in der Zelle: Name; Funktion; E-Mail; Telefon (Unbekanntes weglassen). Wichtigste Person zuerst. Bei Antrag nur über ein Portal: Name des Portals.' },
  { k: 'mail', t: 'E-Mail', w: 28, help: 'Allgemeine E-Mail-Adresse der Förderstelle (gilt für die erste Person, wenn sie keine eigene hat).' },
  { k: 'tel', t: 'Telefon', w: 18, help: 'Allgemeine Telefonnummer der Förderstelle (gilt für die erste Person, wenn sie keine eigene hat).' },
  { k: 'web', t: 'Website oder Portal-Link', w: 32, help: 'Link zur Förderseite oder zum Antragsportal.' },
  { k: 'frist', t: 'Antragsfrist', w: 14, date: true, help: 'Nächster Einsendeschluss als Datum (TT.MM.JJJJ). Laufende Antragstellung: leer lassen und unter „Weitere Fristen und Termine“ notieren.' },
  { k: 'fristInfo', t: 'Weitere Fristen und Termine', w: 30, wrap: true, help: 'Vergabesitzungen, Stichtage, Bearbeitungszeit, „laufend“ usw.' },
  { k: 'betrag', t: 'Erwartete Summe (€)', alias: ['Betrag beantragen (€)'], w: 15, num: true, help: 'Wie viel von diesem Förderer zu erwarten ist bzw. beantragt werden sollte – eine feste Summe, nur die Zahl in Euro.' },
  { k: 'hoehe', t: 'Übliche Fördersumme', w: 22, wrap: true, help: 'Typische oder maximale Förderhöhe laut Richtlinien oder Förderhistorie – kurz, z. B. „1.000–5.000 €, max. 10.000 €“ (höchstens etwa 80 Zeichen; Erläuterungen in „Notizen“).' },
  { k: 'eigenInfo', t: 'Eigenanteil gefordert', w: 20, wrap: true, help: 'Ob und wie viel Eigenanteil verlangt wird – kurz, z. B. „ja, mind. 20 %“ oder „nein“ (höchstens etwa 80 Zeichen; Erläuterungen in „Notizen“).' },
  { k: 'warum', t: 'Pro – warum passt das?', alias: ['Warum passt das?'], w: 48, wrap: true, help: 'Begründung: Satzungszweck, Förderschwerpunkt, Regionalbezug, frühere Förderungen.' },
  { k: 'knackpunkte', t: 'Contra – Knackpunkte', alias: ['Knackpunkte'], w: 48, wrap: true, help: 'Wo es haken kann und worauf der Antrag den Fokus legen sollte.' },
  { k: 'einsch', t: 'Einschätzung', w: 22, items: EINSCH.map(e => e[1]), help: 'Wie wahrscheinlich eine Förderung ist – nur: ' + EINSCH.map(e => e[1]).join(' · ') + '.' },
  { k: 'quellen', t: 'Quellen', w: 36, wrap: true, help: 'Links zu Satzung, Förderrichtlinien und weiteren Belegen – je Link eine eigene Zeile in der Zelle (Zeilenumbruch), nur die Adresse, keine Trennzeichen wie „;“.' },
  { k: 'notiz', t: 'Notizen', w: 30, wrap: true, help: 'Alles Weitere.' },
  { k: 'datei', t: 'Ausführliche Recherche (Datei)', w: 34, help: 'Name der Word-Datei mit der ausführlichen Förderrecherche zu diesem Förderer (im Ordner des Bedarfs), z. B. „Förderrecherche – Sparkasse Paderborn.docx“.' },
];
const fpHeadKey = t => norm(t).replace(/[^a-zäöüß0-9]/g, '');
// ausgeblendetes Blatt mit dem Stand beim Anlegen der Excel: beim Übernehmen („überschreiben“) gilt nur, was in der Excel geändert wurde
const FP_STAND = '_Stand';
const fpWerte = f => ({ art: f.art, weg: f.weg, kontakt: f.kontakte.map(kontaktText).join('\n'), mail: (f.kontakte[0] || {}).mail || '', tel: (f.kontakte[0] || {}).tel || '', web: f.web,
  frist: f.frist, fristInfo: f.fristInfo, betrag: f.betrag != null && f.betrag !== '' ? +f.betrag : null, hoehe: f.hoehe, eigenInfo: f.eigenInfo, warum: f.warum, knackpunkte: f.knackpunkte,
  einsch: f.einsch, quellen: f.quellen, notiz: f.notiz, datei: f.datei });

/* ---------- Auftrag an die Recherche: dieselben Sätze stehen im Blatt „Anleitung“ und im Prompt für Copilot */
const rechGl = b => b && b.gliederung && !istDio(b.gliederung) ? b.gliederung : '';
const rechOffen = b => { if (!b) return 0; const F = finState(b); return Math.max(0, (ct(F.S) - ct(F.eig) - ct(F.zu)) / 100); };
// Kartei-Auszug: zuständig für die Gliederung (oder für alle), die eigene Gliederung zuerst; ohne Gliederung die ganze Kartei
function karteiFuer(b) {
  if (!b || typeof KR === 'undefined') return [];
  const gl = rechGl(b), reg = k => gl && k.gl.includes(gl) ? 1 : 0;
  return KR.list.filter(k => !gl || !k.gl.length || k.gl.some(g => /^alle$/i.test(g)) || k.gl.includes(gl))
    .sort((a, c) => reg(c) - reg(a) || a.name.localeCompare(c.name, 'de'));
}
function rechAuftrag(b) {
  const gl = rechGl(b);
  return [
    'Finde Förderer, die zu diesem Bedarf passen: Stiftungen, Sparkassen und Volksbanken, Unternehmen, Soziallotterien sowie öffentliche und kirchliche Förderprogramme. '
      + (gl ? 'Förderer mit Bezug zu ' + gl + ' und Umgebung zuerst, danach im ganzen Gebiet des Erzbistums Paderborn (z. B. Dortmund, Hagen, Siegen, Höxter) und in NRW, zuletzt bundesweit.'
        : 'Förderer mit Bezug zum ganzen Gebiet des Erzbistums Paderborn (z. B. Paderborn, Dortmund, Hagen, Siegen, Höxter) und zu NRW zuerst, danach bundesweit.'),
    'Recherchiere im Web und prüfe jeden Förderer auf seinen eigenen Seiten: Satzungszweck, Förderrichtlinien, Antragsfristen, übliche Förderhöhe, geforderter Eigenanteil und Antragsweg. '
      + 'Trage als Quellen nur Links ein, die du dabei tatsächlich geöffnet hast. Wenn du nicht im Web suchen kannst, brich ab und sag es mir.',
    karteiFuer(b).length ? 'Das Blatt „Förder-Kartei“ enthält Förderer, mit denen wir schon arbeiten, mit ihrer Förderhistorie. Prüfe sie zuerst – sie sind meist die besten Kandidaten.' : '',
    'Förderer, die im Blatt „Förderplan“ schon stehen, nicht doppelt anlegen. Steht dort „zugesagt“ oder „abgelehnt“, die Zeile nicht ändern; sonst nur leere Zellen ergänzen.',
  ].filter(Boolean);
}
// Zahl der Förderer nach offenem Betrag: für kleine Bedarfe reichen wenige Anträge
function rechAnzahl(b) {
  const o = rechOffen(b) || (b ? +b.summe || 0 : 0);
  return !o ? '5 bis 8' : o <= 2000 ? '3 bis 5' : o <= 20000 ? '5 bis 8' : '8 bis 12';
}
// keine Zielsumme vorgeben – sonst rechnet Copilot die Beträge hoch, bis sie passen
const rechUmfang = b => rechAnzahl(b) + ' Förderer, sortiert nach Erfolgsaussicht. Die erwartete Summe je Förderer realistisch aus Förderhistorie, Richtlinien oder üblicher Förderhöhe ableiten; '
  + 'geht das nicht, die Zelle leer lassen. Nicht auf eine Gesamtsumme hinrechnen. Lieber weniger Förderer mit Beleg als viele unsichere.';
const RECH_REGELN = ['Je Förderer genau eine Zeile im Blatt „Förderplan“, ab der Zeile unter den Überschriften.', 'Spaltenüberschriften, Blattnamen und die Angaben oben (Bedarf, Kennung) nicht ändern.',
  'Datum immer als TT.MM.JJJJ, Beträge nur als Zahl in Euro (ohne Text).', 'Art, Antragsweg und Einschätzung aus der Auswahlliste der Zelle wählen.',
  'Kontakte: bis zu drei Personen, je Person eine Zeile in der Zelle „Name; Funktion; E-Mail; Telefon“.',
  'Kurze Felder kurz halten: „Übliche Fördersumme“ und „Eigenanteil gefordert“ höchstens etwa 80 Zeichen – Erläuterungen gehören in „Notizen“.',
  'Quellen: je Link eine eigene Zeile in der Zelle, nur die Adresse.',
  'Unsicheres als solches kennzeichnen (z. B. „laut Website 2025, nicht bestätigt“). Nichts erfinden: lieber eine Zelle leer lassen.'];

/* ---------- Vorlage schreiben (leer oder mit Bedarf und bisherigem Förderplan)
   ka: Auftrag aus dem Copilot-Knopf (11_copilot.js) – auf: gewählte Aufgaben, zeilen: Auftrag für das Blatt „Anleitung“, blaetter: weitere Blätter
   (z. B. „Beschreibung“, „Unterlagen“); ohne A wie bisher die reine Förderrecherche */
function vorlageBlob(b, ka) {
  const W = FP_COLS.length, last = colName(W - 1), head = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' };
  const lab = { b: true, color: '#404040' }, note = { i: true, sz: 9, color: '#6B6B6B' }, val = { border: 'thin', fill: '#FAFAF8', v: 'top', wrap: true };
  const rows = [], heights = { 0: 24, [FP_HEAD_ROW - 1]: 32 }, merges = ['A1:' + last + '1', 'A2:' + last + '2'];
  rows[0] = [{ v: 'Förderplan' + (b && b.titel ? ': ' + b.titel : ''), st: { b: true, sz: 15 } }];
  rows[1] = [{ v: 'Je möglichem Förderer eine Zeile ausfüllen. Spaltenüberschriften und Blattnamen nicht ändern. Auftrag, Umfang und was in jede Spalte gehört, stehen im Blatt „Anleitung“. Danach in der Bedarfsliste „Excel übernehmen“ wählen.', st: note }];
  const F = b ? finState(b) : null, num = v => v ? { v, t: 'n' } : '';
  const info = [['Bedarf', b ? b.titel : ''], ['Gliederung', b ? (istDio(b.gliederung) ? 'Diözese (ohne Gliederung)' : b.gliederung) : ''], ['Summe (€)', num(F && F.S)],
    ['Eigenmittel (€)', num(F && F.eig)], ['Schon zugesagt (€)', num(F && F.zu)], ['Noch offen (€)', num(rechOffen(b))],
    ['Deadline', b && b.deadline ? { v: b.deadline, t: 'd' } : ''], ['Stichworte oder Fördertöpfe', b ? b.stichworte.join(', ') : ''], ['Beschreibung', b ? b.beschreibung : ''], ['Kennung', b ? b.id : '']];
  info.forEach(([k, v], i) => {
    const r = 3 + i;
    rows[r] = [{ v: k, st: lab }, typeof v === 'object' && v ? Object.assign(v, { st: val }) : { v, st: k === 'Kennung' ? { sz: 8, color: '#9A9A9A' } : val }];
    if (k === 'Beschreibung') { merges.push('B' + (r + 1) + ':' + colName(Math.min(W - 1, 8)) + (r + 1)); heights[r] = 60; }
    else if (k !== 'Kennung') merges.push('B' + (r + 1) + ':D' + (r + 1));
  });
  rows[FP_HEAD_ROW - 1] = FP_COLS.map(c => ({ v: c.t, st: head }));
  const cell = (c, v) => ({ v: v ?? '', t: c.date ? 'd' : c.num ? 'n' : c.k === 'tel' ? 'txt' : undefined, st: { border: 'thin', v: 'top', wrap: !!c.wrap } });
  (b ? b.foerderer.filter(f => f.name.trim()) : []).forEach((f, i) => {
    rows[FP_HEAD_ROW + i] = FP_COLS.map(c => {
      let v = f[c.k];
      if (c.k === 'einsch') v = (EINSCH.find(e => e[0] === v) || [])[1] || '';
      if (c.k === 'betrag') v = f.betrag != null && f.betrag !== '' ? +f.betrag : '';
      if (c.k === 'stand') v = F_ST_L[f.status] + (f.status === 'zugesagt' && f.eingegangen > 0 ? ', eingegangen' : '');
      if (c.k === 'kontakt') v = f.kontakte.map(kontaktText).join('\n');
      if (c.k === 'mail' || c.k === 'tel') v = (f.kontakte[0] || {})[c.k] || '';
      return cell(c, v);
    });
  });
  const n0 = FP_HEAD_ROW + 1, n1 = FP_HEAD_ROW + 300;
  for (let r = rows.length; r < FP_HEAD_ROW + 25; r++) rows[r] = FP_COLS.map(c => cell(c, ''));
  const lists = FP_COLS.map((c, i) => c.items ? { ref: colName(i) + n0 + ':' + colName(i) + n1, items: c.items } : null).filter(Boolean);
  const plan = { name: FP_SHEET, cols: FP_COLS.map(c => c.w), rows: Array.from(rows, r => r || []), merges, heights, freeze: 'B' + (FP_HEAD_ROW + 1), lists, grid: false };

  const A = [], ah = {};
  A.push([{ v: 'Anleitung zur Förderrecherche', st: { b: true, sz: 15 } }]); ah[0] = 24;
  const para = t => A.push([{ v: t, st: { wrap: true, v: 'top' } }]);
  para('Diese Datei ist die Vorlage für den Förderplan eines Bedarfs aus der Bedarfsliste (Fundraising, Malteser Hilfsdienst e. V., Diözese Paderborn). Sie wird von Hand oder von Copilot ausgefüllt und danach in der Bedarfsliste über „Excel übernehmen“ eingelesen. Der Bedarf mit Summe und noch offenem Betrag steht oben im Blatt „Förderplan“.');
  const block = (t, L) => { A.push([]); A.push([{ v: t, st: { b: true, sz: 12 } }]); for (const x of L) A.push([{ v: x, st: { wrap: true, v: 'top' } }]); };
  block('Auftrag', ka ? ka.zeilen : rechAuftrag(b).map((t, i) => (i + 1) + '. ' + t));
  if (!ka || ka.auf.has('suchen')) block('Umfang', [rechUmfang(b)]);
  block('Regeln', RECH_REGELN.map(t => '• ' + t));
  A.push([]);
  A.push([{ v: 'Spalte', st: head }, { v: 'Was gehört hinein', st: head }]);
  for (const c of FP_COLS) A.push([{ v: c.t, st: { b: true, border: 'thin', v: 'top' } }, { v: c.help + (c.items ? ' Auswahl: ' + c.items.join(' · ') : ''), st: { wrap: true, border: 'thin', v: 'top' } }]);
  // verbundene Zellen wachsen in Excel nicht mit: lange Absätze bekommen die Höhe für ihre Zeilenzahl (etwa 125 Zeichen je Zeile)
  const amerge = []; A.forEach((r, i) => { if (r.length !== 1) return; amerge.push('A' + (i + 1) + ':B' + (i + 1)); const n = String(r[0].v || '').length; if (n > 125 && ah[i] == null) ah[i] = Math.ceil(n / 125) * 15 + 4; });
  const anl = { name: 'Anleitung', cols: [30, 110], rows: A, merges: amerge, heights: ah, grid: false };
  const stand = { name: FP_STAND, hidden: true, cols: [30, 100], rows: (b ? b.foerderer.filter(f => f.name.trim()) : []).map(f => [kkeyFp(f.name), JSON.stringify(fpWerte(f)).slice(0, 32000)]) };
  if (ka) stand.rows.unshift([STAND_AUFTRAG, JSON.stringify({ auf: [...ka.auf] })]);                 // welche Aufgaben gestellt waren (für die Übernahme)
  const extra = ka && ka.blaetter || [], KL = !ka || ka.auf.has('suchen') || ka.auf.has('recherche') ? karteiFuer(b) : [];
  if (!KL.length) return xlsxBlob([plan, ...extra, anl, ...(stand.rows.length ? [stand] : [])]);
  const kh = ['Förderer', 'Bereich', 'Zuständig für', 'Antragsweg', 'Förderschwerpunkte', 'Website', 'Förderhistorie'], kc = { border: 'thin', v: 'top', wrap: true };
  const K = [[{ v: 'Förder-Kartei' + (rechGl(b) ? ': zuständig für ' + rechGl(b) + ' oder für alle' : ''), st: { b: true, sz: 15 } }],
    [{ v: 'Auszug aus der Förder-Kartei, ohne Kontaktdaten und Notizen. Diese Förderer zuerst prüfen; die Förderhistorie zeigt, was sie uns schon gegeben haben. Nur lesen, nichts ändern.', st: note }], [],
    kh.map(v => ({ v, st: head })),
    ...KL.map(k => [k.name, k.blatt, k.gl.join(', '), k.weg.join(', '), k.schwer, k.web, Object.entries(k.hist).sort((x, y) => y[0].localeCompare(x[0])).map(([y, v]) => y + ': ' + v).join('\n')]
      .map(v => ({ v: v || '', st: kc })))];
  const kart = { name: 'Förder-Kartei', cols: [32, 14, 22, 16, 36, 30, 44], rows: K, merges: ['A1:G1', 'A2:G2'], heights: { 0: 24, 1: 32, 3: 24 }, freeze: 'B5', grid: false };
  return xlsxBlob([plan, ...extra, anl, kart, ...(stand.rows.length ? [stand] : [])]);
}
const STAND_AUFTRAG = '_auftrag';
const kkeyFp = n => typeof kkey === 'function' ? kkey(n) : norm(n);             // (in tools/vorlage.js ohne Kartei)
// Dateiname ohne Umlaute und Sonderzeichen (manche Browser verwerfen sonst den Namen beim Herunterladen)
const asciiName = t => String(t).replace(/[äÄöÖüÜß]/g, c => ({ ä: 'ae', Ä: 'Ae', ö: 'oe', Ö: 'Oe', ü: 'ue', Ü: 'Ue', ß: 'ss' }[c])).normalize('NFD').replace(/[^\w.\- ]+/g, ' ').trim().replace(/\s+/g, '_');
// gekürzt auf n Zeichen an Wortgrenzen, ohne Füllwörter am Ende („…_fuer_den“)
const KURZ_STOP = /^(fuer|fuers|den|der|die|das|des|dem|und|mit|im|in|am|an|zum|zur|von|vom|ein|eine|einen|einer|eines)$/i;
const kurzName = (t, n) => {
  const w = asciiName(t).split('_').reduce((a, x) => !a.length ? [x.slice(0, n)] : (a.join('_') + '_' + x).length <= n ? [...a, x] : a, []);
  while (w.length > 1 && KURZ_STOP.test(w[w.length - 1])) w.pop();
  return w.join('_');
};
// Dateiname mit Gliederung und Kürzel der Kennung: gleiche Titel in verschiedenen Gliederungen bekommen verschiedene Dateien,
// und über das Kürzel findet die Liste die Datei auch nach einer Umbenennung wieder
const rechKurz = b => String(b.id).replace(/[^a-z0-9]/gi, '').slice(-4).toLowerCase();
const vorlageName = b => b && b.titel ? 'Foerderrecherche_' + kurzName(b.titel, 40) + (b.gliederung ? '_' + kurzName(b.gliederung, 20) : '') + '_' + rechKurz(b) + '.xlsx' : 'Foerderplan_Vorlage.xlsx';
function vorlageDownload(b) { download(vorlageName(b), vorlageBlob(b)); }

/* ---------- Arbeits-Excel für Copilot und Cowork im Unterordner „Förderrecherche“ (dort kommt Cowork über OneDrive heran); Auftrag und
   Prompt baut der Copilot-Knopf (11_copilot.js), die ausgefüllte Excel wird von dort wieder übernommen. Ohne verbundenen Ordner: herunterladen und hochladen. */
const RECH_DIR = 'Förderrecherche';
const rechOrdnerOk = () => !DEMO && FSA && ST.conn === 'ok' && !!ST.htmlDir;
async function rechDir(create) { if (!rechOrdnerOk()) return null; try { return await ST.htmlDir.getDirectoryHandle(RECH_DIR, { create: !!create }); } catch (e) { return null; } }
// die neueste Excel im Ordner mit dem Kürzel im Namen, deren Kennung zum Bedarf passt (auch Kopien wie „… (1).xlsx“)
async function rechFile(b) {
  const d = await rechDir(); if (!d) return null;
  const k = '_' + rechKurz(b), L = [];
  try { for await (const [n, e] of d.entries()) if (e.kind === 'file' && /\.xlsx$/i.test(n) && !n.startsWith('~$') && n.toLowerCase().includes(k)) L.push(await e.getFile()); } catch (e) { return null; }
  L.sort((x, y) => y.lastModified - x.lastModified);
  for (const f of L) { try { const g = await readFoerderplan(await f.arrayBuffer()); if (g && (!g.kennung || g.kennung === b.id)) return f; } catch (e) { /* nächste Datei */ } }
  return null;
}
async function rechWrite(b, ka) {
  const d = await rechDir(true); if (!d) return false;
  try { const fh = await d.getFileHandle(vorlageName(b), { create: true }), w = await fh.createWritable(); await w.write(vorlageBlob(b, ka)); await w.close(); return true; }
  catch (e) { console.warn(e); return false; }
}
// Pfad zum Unterordner, wie ihn der Explorer zeigt (nur wenn die Liste als Datei geöffnet ist), und der Teil hinter „OneDrive …\“ für den Prompt
function rechPfad() {
  const p = localPath(); if (!p) return { lokal: '', od: '' };
  const dir = p.replace(/[\\/][^\\/]*$/, '') + '\\' + RECH_DIR, m = dir.match(/\\OneDrive[^\\]*\\(.+)$/i);
  return { lokal: dir, od: m ? m[1].replace(/\\/g, '/') : '' };
}
const lmText = f => new Date(f.lastModified).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
/* ---------- Förderplan aus einer Excel lesen: jedes sichtbare Blatt außer „Anleitung“ und „Förder-Kartei“ mit einer Kopfzeile, in der eine Spalte
   „Förderer…“ heißt (an beliebiger Stelle, auch „Förderer (Name)“) und weitere Spalten der Vorlage stehen. Schreibt Copilot in ein neues Blatt,
   kommen dessen Förderer dazu. Summen-, Hinweis- und Standzeilen sowie Platzhalter („nicht gefunden“) werden übergangen. */
async function readFoerderplan(buf) {
  const book = await xlsxBook(buf), heads = c => [c.t, ...(c.alias || [])].map(fpHeadKey);
  const spalte = t => { const k = fpHeadKey(t); if (!k) return null; if (k.startsWith('förderer')) return FP_COLS[0]; return FP_COLS.find(c => heads(c).includes(k)) || FP_COLS.find(c => c.k !== 'name' && heads(c).some(x => k.startsWith(x.slice(0, 8)))) || null; };
  const stand = new Map(), sst = book.sheets.find(s => s.name === FP_STAND);
  if (sst) for (const r of sst.rows) { try { if (r[0]) stand.set(String(r[0]), JSON.parse(String(r[1]))); } catch (e) { /* Zeile unbrauchbar */ } }
  const auftrag = (stand.get(STAND_AUFTRAG) || {}).auf || []; stand.delete(STAND_AUFTRAG);
  const blaetter = book.sheets.filter(s => !s.hidden && s.name !== FP_STAND && !/^(anleitung|förder-?kartei|beschreibung|unterlagen|kontakte)$/i.test(s.name.trim())).sort((a, c) => (c.name === FP_SHEET) - (a.name === FP_SHEET));
  let kennung = '', sheet = '', gefunden = false;
  const items = [], byKey = new Map();
  for (const sh of blaetter) {
    if (!kennung) { const kz = sh.rows.find(r => norm(r[0]) === 'kennung'); if (kz) kennung = cellStr(kz[1]); }
    let hi = -1, map = null;
    for (let r = 0; r < Math.min(sh.rows.length, 60) && hi < 0; r++) {
      const m = {}; (sh.rows[r] || []).forEach((t, i) => { const c = spalte(t); if (c && m[c.k] == null) m[c.k] = i; });
      if (m.name != null && Object.keys(m).length >= 3) { hi = r; map = m; }
    }
    if (hi < 0) continue;
    if (!gefunden) sheet = sh.name;
    gefunden = true;
    for (let ri = hi + 1; ri < sh.rows.length; ri++) {
      const r = sh.rows[ri], name = ohnePlatzhalter(cellStr(r[map.name]));
      if (!istEintrag(name) || fpHeadKey(name).startsWith('förderer')) continue;
      const it = { name };
      for (const c of FP_COLS) {
        if (c.k === 'name' || map[c.k] == null) continue;
        const v = r[map[c.k]];
        if (c.date) it[c.k] = anyDate(book.date1904 && typeof v === 'number' ? v + 1462 : v);
        else if (c.num) { const n = deNum(v); it[c.k] = typeof n === 'number' ? n : null; }
        else if (c.k === 'einsch') it[c.k] = einschKey(v);
        else if (c.k === 'mail') it[c.k] = mailText(v);
        else if (c.k === 'tel') it[c.k] = telText(v);
        else if (c.k === 'web' || c.k === 'quellen') it[c.k] = ohnePlatzhalter(zelleMitLink(sh, ri, map[c.k]));
        else it[c.k] = ohnePlatzhalter(cellStr(v));
      }
      const k = kkey(name), da = byKey.get(k);
      if (da) { for (const [x, v] of Object.entries(it)) if ((da[x] == null || da[x] === '') && v != null && v !== '') da[x] = v; }   // doppelt (z. B. in zwei Blättern): ergänzen
      else { byKey.set(k, it); items.push(it); }
    }
  }
  return gefunden ? { items, kennung, sheet, stand, auftrag } : null;
}
// Einschätzung aus freiem Text (auch ältere Wörter wie „eher nicht“ oder „klappt“)
function einschKey(v) {
  const s = norm(v);
  if (!s) return '';
  if (/sehr\s*unwahrscheinlich|unmöglich|keine chance|sehr gering|sehr schlecht/.test(s)) return 'suw';
  if (/unwahrscheinlich|eher nicht|schwierig|schlecht|gering|niedrig/.test(s)) return 'uw';
  if (/unsicher|mittel|vielleicht|offen|möglich/.test(s)) return 'u';
  if (/sehr\s*wahrscheinlich|sehr gut|sehr hoch/.test(s)) return 'sw';
  if (/wahrscheinlich|klappt|gut|hoch/.test(s)) return 'w';
  return '';
}
// Felder eines Förderers aus der Recherche übernehmen: 'fill' = nur leere Felder füllen, 'all' = überschreiben – aber nur, was in der Excel
// gegenüber ihrem Stand beim Anlegen (alt) geändert wurde; was du seitdem in der Liste geändert hast, bleibt. Ohne diesen Stand: alles überschreiben
function applyResearch(f, it, mode, alt) {
  const geaendert = k => !alt || norm(String(it[k] ?? '')) !== norm(String(alt[k] ?? ''));
  for (const c of FP_COLS) {
    if (c.k === 'name' || c.info || c.k === 'kontakt' || c.k === 'mail' || c.k === 'tel') continue;
    let v = it[c.k]; if (v == null || v === '') continue;
    if (c.k === 'quellen') v = quellenZeilen(v).join('\n');
    const empty = f[c.k] == null || f[c.k] === '';
    if (empty || (mode === 'all' && geaendert(c.k))) f[c.k] = v;
  }
  // Kontakte: Zeilen „Name; Funktion; E-Mail; Telefon“; allgemeine E-Mail und Telefon gelten für die erste Person
  const k = kontakteAusText(it.kontakt);
  if (it.mail || it.tel) { if (!k.length) k.push(leerK()); k[0].mail = k[0].mail || it.mail || ''; k[0].tel = k[0].tel || it.tel || ''; }
  if (k.length && (!f.kontakte.length || (mode === 'all' && ['kontakt', 'mail', 'tel'].some(geaendert)))) f.kontakte = k;
}
// Ergebnis einer Arbeits-Excel übernehmen: Förderer (neu oder ergänzt), dazu – wenn Copilot oder Cowork sie gefüllt hat – eine neue
// Beschreibung (bisher und Vorschlag nebeneinander) und Unterlagen aus dem Ordner. Alles mit Vorschau zum Abwählen, ein Schritt zum Rückgängigmachen
async function importFoerderplan(b, file) {
  file = file || await pickFile('.xlsx'); if (!file) return;
  let got = null, ki = { beschr: '', grundlage: '', ul: [] };
  try { const buf = await file.arrayBuffer(); got = await readFoerderplan(buf); ki = readKiBlaetter(await xlsxBook(buf)); } catch (e) { console.warn(e); }
  return zeigeErgebnis(b, { got, ki, name: file.name, file, pers: ki.pers && ki.pers.length ? ki.pers : undefined });
}
// Vorschau und Übernahme – aus einer Excel (Cowork, Recherche-Vorlage) oder aus der eingefügten Antwort von Copilot (pers: Kontaktdaten der Zuständigen)
async function zeigeErgebnis(b, { got, ki, name, file, pers, link }) {
  if (got) for (const it of got.items) for (const k of ['warum', 'knackpunkte', 'fristInfo', 'hoehe', 'eigenInfo', 'notiz']) if (typeof it[k] === 'string') it[k] = kiMd(it[k]);   // **fett** → *fett*
  if (ki && ki.beschr) ki.beschr = kiMd(ki.beschr);
  const pfadNeu = ki && ki.pfad && !kiOrdnerPfad(b) ? kiPfadVoll(ki.pfad) : '';                  // von Cowork (oder Copilot) gefundener Ordner des Bedarfs
  if (link && okLink(link)) spLernen(link);                                                       // ein echter SharePoint-Link verrät die Adresse von „General“
  const linkVon = link && okLink(link) ? link.trim() : pfadNeu && !okLink(b.link) ? spLink(pfadNeu) : '';
  const linkNeu = linkVon && linkVon !== (b.link || '').trim() ? linkVon : ''; let linkOk = !!linkNeu, pfadOk = !!pfadNeu;
  const P = (pers || []).map(p => { const z = b.zust.find(x => x.n.trim() && kkey(x.n) === kkey(p.n)); return { p, z, neu: z ? ZUST_F.filter(k => !(z[k] || '').trim() && (p[k] || '').trim()) : [] }; });
  const persNeu = P.filter(x => x.neu.length);
  const beschrNeu = ki.beschr && norm(ki.beschr) !== norm(b.beschreibung) ? ki.beschr : '', ulVor = ulVorschlaege(b, ki.ul), extra = !!(beschrNeu || ulVor.length || persNeu.length || linkNeu || pfadNeu);
  if (!got && !extra) { modal('Kein Förderplan gefunden', h('p', null, 'In „' + name + '“ steht keine Tabelle mit einer Spalte „Förderer“ und weiteren Spalten der Vorlage (z. B. „Antragsfrist“, „Erwartete Summe“). Bitte die Förderplan-Vorlage der Bedarfsliste verwenden.')); return; }
  const items = got ? got.items : [], byName = n => b.foerderer.find(f => kkey(f.name) === kkey(n));
  const zeigFoe = items.length > 0 && (!extra || items.some(it => !byName(it.name) || fpGeaendert(it, got.stand.get(kkey(it.name)))));
  if (!zeigFoe && !extra) { modal(pers ? 'Nichts Neues' : 'Keine Förderer', h('p', null, pers ? 'In ' + name + ' steht nichts, was noch nicht in der Liste ist.' : 'In „' + name + '“ ist noch kein Förderer eingetragen.')); return; }
  const other = got && got.kennung && got.kennung !== b.id ? D.bedarfe.find(x => x.id === got.kennung) : null;
  const sel = items.map(() => true);
  let mode = got && got.auftrag.includes('recherche') ? 'all' : 'fill', beschrOk = !!beschrNeu;   // Förderrecherche bestellt: Geändertes übernehmen
  const kurz = t => t.length > 150 ? t.slice(0, 147).replace(/\s+\S*$/, '') + ' …' : t;
  const sumEl = h('p', { class: 'imp-sum' }), offen = rechOffen(b);
  const upd = () => {
    const neu = items.filter((it, i) => sel[i] && !byName(it.name)), v = neu.reduce((s, it) => s + (+it.betrag || 0), 0);
    sumEl.replaceChildren('Neu ausgewählt: ', h('b', null, neu.length + ' Förderer'), v ? ', erwartet zusammen ' : '', v ? h('b', null, eur(v)) : '', offen ? ' – noch offen sind ' + eur(offen) + '.' : '.');
  };
  const teile = [];
  if (other) teile.push(h('p', { class: 'hint-warn' }, 'Achtung: Diese Excel wurde für einen anderen Bedarf erstellt: „' + (other.titel || 'ohne Namen') + '“' + (other.gliederung ? ' (' + other.gliederung + ')' : '') + '.'));
  // Beschreibung: der neue Text steht da, „bisher zeigen“ klappt den alten dazu auf
  if (beschrNeu) { const alt = h('div', { class: 'imp-alt fmt', hidden: true, html: '<div class="imp-lab">bisher</div>' + (fmtText(b.beschreibung) || '<span class="muted">leer</span>') });
    teile.push(h('section', { class: 'imp-box' }, h('div', { class: 'imp-kopf' }, h('input', { type: 'checkbox', checked: true, 'aria-label': 'Neue Beschreibung übernehmen', onchange: e => { beschrOk = e.target.checked; } }),
      h('b', null, 'Neue Beschreibung'), h('button', { type: 'button', class: 'link small', onclick: e => { alt.hidden = !alt.hidden; e.target.textContent = alt.hidden ? 'bisher zeigen' : 'bisher ausblenden'; } }, 'bisher zeigen')),
      h('div', { class: 'imp-neu fmt', html: fmtText(beschrNeu) }), alt, ki.grundlage ? h('div', { class: 'imp-grund muted small' }, 'Grundlage: ' + ki.grundlage) : null)); }
  // Ordner: als SharePoint-Link, sobald die Liste die Adresse kennt – sonst nur der Ordner, der Link kommt nach (spNachziehen)
  const ordnerText = x => { const r = spRel(x) || spRelLink(x); return r ? r.join(' › ') : ''; };
  if (linkNeu || pfadNeu) teile.unshift(h('section', { class: 'imp-box' }, h('div', { class: 'imp-kopf' }, h('input', { type: 'checkbox', checked: true, 'aria-label': 'Ordner übernehmen', onchange: e => { linkOk = pfadOk = e.target.checked; } }),
    h('b', null, 'Ordner des Bedarfs'), linkNeu ? h('a', { href: linkNeu, target: '_blank', rel: 'noopener', class: 'small' }, 'in SharePoint öffnen ↗') : null),
    h('div', { class: 'imp-neu small' }, ordnerText(linkNeu || pfadNeu) || linkNeu || pfadNeu, b.link ? h('div', { class: 'muted' }, 'bisher: ' + b.link) : null,
      linkNeu ? null : h('div', { class: 'muted' }, 'Den SharePoint-Link trägt die Liste nach, sobald bei einem Bedarf einmal ein SharePoint-Link aus der Adresszeile des Browsers eingefügt ist.'))));
  const persAn = persNeu.map(() => true), FL = { rolle: 'Position', mail: 'E-Mail', tel: 'Telefon', mobil: 'Handy' }; let persDauer = true;
  if (persNeu.length) teile.push(h('section', { class: 'imp-box' }, h('div', { class: 'imp-kopf' }, h('b', null, 'Kontaktdaten der Zuständigen')),
    persNeu.map((x, i) => h('label', { class: 'imp-f' }, h('input', { type: 'checkbox', checked: true, onchange: e => { persAn[i] = e.target.checked; } }), h('span', { class: 'imp-n' }, x.z.n),
      h('span', { class: 'imp-pill' }, x.neu.map(k => FL[k]).join(', ') + ' ergänzt'))),
    h('label', { class: 'check small pers-dauer' }, h('input', { type: 'checkbox', checked: true, onchange: e => { persDauer = e.target.checked; } }), 'auch dauerhaft in die Personenliste übernehmen (dann auch bei anderen Bedarfen)')));
  if (ulVor.length) teile.push(h('section', { class: 'imp-teil' }, h('h3', null, 'Unterlagen'),
    h('div', { class: 'imp-ul' }, ulVor.map(v => v.apply ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true, onchange: e => { v.an = e.target.checked; } }), h('span', null, v.t, v.info ? h('span', { class: 'muted small' }, ' – ' + v.info) : null))
      : h('div', { class: 'imp-nur' }, h('span', null, v.t), v.info ? h('span', { class: 'muted small' }, ' – ' + v.info) : null)))));
  // aus einem Copilot-Auftrag: knapp – nur neue und geänderte Förderer, je eine Zeile mit „neu“ bzw. was ergänzt wurde, und dem Betrag
  const kompakt = !!(got && got.auftrag.length);
  if (zeigFoe && kompakt) {
    const L = items.map((it, i) => [it, i, byName(it.name)]).filter(([it, , f]) => !f || fpGeaendert(it, got.stand.get(kkey(it.name))));
    items.forEach((it, i) => { if (!L.some(x => x[1] === i)) sel[i] = false; });
    const nNeu = L.filter(x => !x[2]).length, nErg = L.length - nNeu;
    teile.push(h('section', { class: 'imp-box' }, h('div', { class: 'imp-kopf' }, h('b', null, 'Förderer'), h('span', { class: 'muted small' }, [nNeu ? nNeu + ' neu' : '', nErg ? nErg + ' ergänzt' : ''].filter(Boolean).join(' · '))),
      L.map(([it, i, f]) => { const was = f ? fpFelder(it, got.stand.get(kkey(it.name))) : '';
        return h('label', { class: 'imp-f' }, h('input', { type: 'checkbox', checked: true, onchange: e => { sel[i] = e.target.checked; } }), h('span', { class: 'imp-n' }, it.name),
          h('span', { class: 'imp-pill' + (f ? '' : ' neu'), title: f ? 'im Förderplan: ' + F_ST_L[f.status] : '' }, f ? (was ? was + ' ergänzt' : 'ergänzt') : 'neu'), h('span', { class: 'imp-s' }, it.betrag ? eur(it.betrag) : '–')); })));
  } else if (zeigFoe) {
    const tbl = h('table', { class: 'imp' },
      h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Förderer'), h('th', { class: 'num' }, 'Summe'), h('th', null, 'Antragsfrist'), h('th', null, 'Einschätzung'), h('th', null, ''))),
      h('tbody', null, items.map((it, i) => { const f = byName(it.name); return h('tr', null,
        h('td', null, h('input', { type: 'checkbox', checked: true, 'aria-label': it.name + ' übernehmen', onchange: e => { sel[i] = e.target.checked; upd(); } })),
        h('td', null, h('b', null, it.name), kartei(it.name) ? h('span', { class: 'badge k' }, 'in der Kartei') : null,
          it.warum || (!f && !it.quellen) ? h('div', { class: 'imp-why' }, kurz(it.warum || ''), f || it.quellen ? null : h('span', { class: 'imp-nq' }, 'ohne Quelle')) : null),
        h('td', { class: 'num' }, it.betrag ? eur(it.betrag) : '–'),
        h('td', null, fmtDate(it.frist) || '–'),
        h('td', null, (EINSCH.find(e => e[0] === it.einsch) || [, '–'])[1]),
        h('td', { class: 'muted small nowrap' }, f ? 'im Plan: ' + F_ST_L[f.status] : 'neu')); })));
    upd();
    const dup = items.some(it => byName(it.name));
    teile.push(h('section', { class: extra ? 'imp-teil' : '' }, extra ? h('h3', null, 'Förderer') : null,
      h('p', null, items.length + ' Förderer in „' + name + '“. Neue Förderer kommen mit dem Stand „geplant“ in den Förderplan.'),
      h('div', { class: 'tablewrap' }, tbl), sumEl,
      dup ? h('div', { class: 'radios' }, h('p', { class: 'small' }, h('b', null, 'Förderer, die schon im Förderplan stehen:')),
        ...[['fill', 'nur leere Felder ergänzen'], ['all', 'in der Excel Geändertes übernehmen (überschreibt – zugesagte und abgelehnte Förderer bleiben, wie sie sind)'], ['skip', 'nicht anfassen']].map(([v, l]) =>
          h('label', { class: 'check' }, h('input', { type: 'radio', name: 'impmode', value: v, checked: v === mode, onchange: () => { mode = v; } }), l))) : null));
  }
  if (!await modal(extra || kompakt ? 'Ergebnis übernehmen' : 'Vorschläge aus der Recherche', h('div', { class: 'help' }, teile), [['Abbrechen', false], ['Übernehmen', true, 'primary']], { wide: true })) return;
  const before = JSON.stringify(D), was = [];
  if (linkNeu && linkOk) { b.link = linkNeu; was.push('Ordner'); }
  if (pfadNeu && pfadOk) { b.pfad = pfadNeu; if (!was.includes('Ordner')) was.push('Ordner'); }
  if (D.settings.sp) spNachziehen();
  if (beschrNeu && beschrOk) { b.beschreibung = beschrNeu; was.push('Beschreibung'); }
  const nu = ulVor.filter(v => v.apply && v.an); nu.forEach(v => v.apply()); if (nu.length) was.push(nu.length + (nu.length === 1 ? ' Unterlage' : ' Unterlagen'));
  const np = persNeu.filter((x, i) => persAn[i]); np.forEach(x => x.neu.forEach(k => { x.z[k] = x.p[k]; })); if (np.length) was.push('Kontaktdaten bei ' + np.length + (np.length === 1 ? ' Person' : ' Personen'));
  if (np.length && persDauer) setTimeout(() => personenUebernehmen(personenAbweichung(np.map(x => x.z), b.gliederung)), 0);   // beim Einpflegen bestätigt
  let neu = 0, erg = 0;
  if (zeigFoe) items.forEach((it, i) => {
    if (!sel[i]) return;
    const f = byName(it.name);
    if (f) { if (mode !== 'skip') { applyResearch(f, it, mode === 'all' && ['zugesagt', 'abgelehnt'].includes(f.status) ? 'fill' : mode, got.stand.get(kkey(f.name))); erg++; } }
    else { const n = ff({ name: it.name }); applyResearch(n, it, 'all'); b.foerderer.push(n); neu++; }
  });
  if (neu) was.push(neu + ' Förderer übernommen'); if (erg) was.push(erg + ' ergänzt');
  if (file && typeof kiGesehen === 'function') kiGesehen(b, file);
  if (!was.length) return;
  changed(); keep(renderNow);
  toast(was.join(', '), 'ok', undoGanz(before));
}
// was Copilot an einem Förderer geändert hat, kurz benannt (für die Übernahme)
const FP_KURZ = { warum: 'Pro', knackpunkte: 'Contra', kontakt: 'Kontakte', web: 'Website', weg: 'Antragsweg', frist: 'Antragsfrist', fristInfo: 'Fristen', hoehe: 'Fördersumme',
  eigenInfo: 'Eigenanteil', einsch: 'Einschätzung', quellen: 'Quellen', betrag: 'Summe', art: 'Art', notiz: 'Notizen', mail: 'E-Mail', tel: 'Telefon', datei: 'Recherche-Datei' };
function fpFelder(it, alt) {
  const L = FP_COLS.filter(c => !c.info && c.k !== 'name' && it[c.k] != null && it[c.k] !== '' && (!alt || norm(String(it[c.k])) !== norm(String(alt[c.k] ?? '')))).map(c => FP_KURZ[c.k] || c.t);
  return L.length > 3 ? L.slice(0, 3).join(', ') + ' …' : L.join(', ');
}
// hat Copilot an einem Förderer, der schon im Plan stand, etwas geändert? (alt: Stand beim Anlegen der Excel; ohne ihn: ja)
const fpGeaendert = (it, alt) => !alt || FP_COLS.some(c => !c.info && c.k !== 'name' && it[c.k] != null && it[c.k] !== '' && norm(String(it[c.k])) !== norm(String(alt[c.k] ?? '')));

/* ---------- Zusatzblätter für Copilot und Cowork: „Beschreibung“ (Vorschlag für eine neue Beschreibung) und „Unterlagen“ (was im Ordner liegt) */
const KI_ST = { head: { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, lab: { b: true, color: '#404040', v: 'top' },
  note: { i: true, sz: 9, color: '#6B6B6B', wrap: true }, val: { border: 'thin', fill: '#FAFAF8', v: 'top', wrap: true }, zelle: { border: 'thin', v: 'top', wrap: true } };
// Ablage der Bedarfsordner im OneDrive: in der Regel …\Ortsgliederungen\<Gliederung>\<Bedarf>, z. B. …\Ortsgliederungen\Büren\RE - Küche
const KI_ABLAGE = 'OneDrive - MalteserCloud\\Fundraising-Team - Diözese Paderborn - General\\Ortsgliederungen';
const KI_ABLAGE_DIO = 'OneDrive - MalteserCloud\\Fundraising-Team - Diözese Paderborn - General\\1601_Diözese_Pojekte';   // Projekte der Diözese (Name so im OneDrive)
function blattBeschreibung(b) {
  const S = KI_ST;
  return { name: 'Beschreibung', cols: [16, 110], grid: false, merges: ['A1:B1', 'A2:B2'], heights: { 0: 24, 1: 30, 3: 90, 4: 120, 5: 40 }, rows: [
    [{ v: 'Beschreibung des Bedarfs', st: { b: true, sz: 15 } }],
    [{ v: 'Bei „Vorschlag“ die neue Beschreibung eintragen (höchstens zwei kurze Absätze), bei „Grundlage“ die Dateien, die dafür gelesen wurden, bei „Ordner“ den Pfad zum Ordner des Bedarfs, wenn er gefunden wurde. „Bisher“ nicht ändern. Danach in der Bedarfsliste „Ergebnis übernehmen“ – dort steht beides nebeneinander.', st: S.note }],
    [], [{ v: 'Bisher', st: S.lab }, { v: b.beschreibung || '', st: S.val }], [{ v: 'Vorschlag', st: S.lab }, { v: '', st: S.val }], [{ v: 'Grundlage', st: S.lab }, { v: '', st: S.val }],
    [{ v: 'Ordner', st: S.lab }, { v: kiOrdnerPfad(b), st: S.val }], [], [{ v: 'Kennung', st: { sz: 8, color: '#9A9A9A' } }, { v: b.id, st: { sz: 8, color: '#9A9A9A' } }]] };
}
function blattKontakte(b) {
  const S = KI_ST, rows = [[{ v: 'Kontaktdaten der Zuständigen', st: { b: true, sz: 15 } }],
    [{ v: 'Je Person eine Zeile: dienstliche Position, E-Mail, Telefon, Handy – nur, was gefunden wurde; in „Quelle“ woher. Namen nicht ändern.', st: S.note }], [],
    ['Name', 'Position', 'E-Mail', 'Telefon', 'Handy', 'Quelle'].map(v => ({ v, st: S.head }))];
  for (const z of personenGesucht(b)) rows.push([z.n.trim(), z.rolle, z.mail, z.tel, z.mobil || '', ''].map((v, i) => ({ v: v || '', st: S.zelle, t: i === 3 || i === 4 ? 'txt' : undefined })));
  return { name: 'Kontakte', cols: [26, 26, 32, 18, 18, 30], rows, merges: ['A1:F1', 'A2:F2'], heights: { 0: 24, 1: 30 }, grid: false };
}
function blattUnterlagen(b) {
  const S = KI_ST, L = b.unterlagen.map(u => u.name).filter(Boolean), rows = [
    [{ v: 'Unterlagen im Ordner des Bedarfs', st: { b: true, sz: 15 } }],
    [{ v: 'Je Unterlage eine Zeile: liegt sie im Ordner (ja oder nein), welche Datei, und ein kurzer Hinweis (z. B. „Angebot älter als sechs Monate“). Unterlagen, die für Anträge typischerweise noch fehlen, unten ergänzen.', st: S.note }], [],
    ['Unterlage', 'Im Ordner?', 'Datei', 'Hinweis'].map(v => ({ v, st: S.head }))];
  for (const n of L) rows.push([{ v: n, st: S.zelle }, { v: '', st: S.zelle }, { v: '', st: S.zelle }, { v: '', st: S.zelle }]);
  for (let i = 0; i < 12; i++) rows.push([0, 1, 2, 3].map(() => ({ v: '', st: S.zelle })));
  return { name: 'Unterlagen', cols: [30, 12, 40, 50], rows, merges: ['A1:D1', 'A2:D2'], heights: { 0: 24, 1: 30 }, freeze: 'A5', grid: false, lists: [{ ref: 'B5:B80', items: ['ja', 'nein'] }] };
}
/* ---------- SharePoint-Link zum Ordner eines Bedarfs. Die Ordner liegen unter „General“ in „Ortsgliederungen“ oder „1601_Diözese_Pojekte“ –
   im OneDrive genauso wie in SharePoint. Die Adresse von „General“ lernt die Liste aus einem SharePoint-Link, der bei einem Bedarf eingefügt wird
   (Adresszeile im Browser), und speichert sie in den Einstellungen; daraus baut sie den Link für jeden Ordner, den Cowork oder Copilot findet. */
const SP_WURZEL = ['Ortsgliederungen', '1601_Diözese_Pojekte'];
// Standard: „General“ im Team „Fundraising-Team - Diözese Paderborn“ (aus einem Link zu Ortsgliederungen › Büren › RE - Küche)
const SP_STANDARD = { origin: 'https://maltesercloud.sharepoint.com', lib: '/sites/Fundraising-Team-DizesePaderborn/Freigegebene%20Dokumente', pfad: '/sites/Fundraising-Team-DizesePaderborn/Freigegebene Dokumente/General' };
const spBasis = () => (typeof D !== 'undefined' && D && D.settings && D.settings.sp) || SP_STANDARD;
const spWurzelAb = seg => seg.findIndex(x => SP_WURZEL.some(w => norm(w) === norm(x)));
// Link zerlegen: Adresse, Bibliothek (bei „…/Forms/AllItems.aspx?id=…“) und Pfad des Ordners auf dem Server (lesbar); Freigabe-Links („/:f:/s/…“) sagen nichts über den Ordner
function spTeile(url) {
  let u; try { u = new URL(String(url || '').trim()); } catch (e) { return null; }
  if (!/\.sharepoint\.com$/i.test(u.hostname)) return null;
  const id = u.searchParams.get('id') || u.searchParams.get('RootFolder'), f = u.pathname.match(/^(.*?)\/Forms\/[^/]+\.aspx$/i);
  if (id) return { origin: u.origin, lib: f ? f[1] : '', pfad: id.replace(/\/$/, '') };
  let p = u.pathname; const r = p.match(/^\/:[a-z]:\/r(\/.*)$/i); if (r) p = r[1]; else if (/^\/:[a-z]:\//i.test(p)) return null;
  try { p = decodeURIComponent(p); } catch (e) { return null; }
  return { origin: u.origin, lib: '', pfad: p.replace(/\/$/, '') };
}
// aus einem Link die Adresse von „General“ lernen – true, wenn sie neu ist
function spLernen(url) {
  const t = spTeile(url); if (!t) return false;
  const seg = t.pfad.split('/'), i = spWurzelAb(seg); if (i < 1) return false;
  // Bibliothek: aus „…/Forms/AllItems.aspx“, sonst /sites/<Website>/<Bibliothek> – die Links baut die Liste immer in der Form „AllItems.aspx?id=…“
  const lib = t.lib || (/^(sites|teams)$/i.test(seg[1] || '') && i > 3 ? seg.slice(0, 4).map(encodeURIComponent).join('/') : '');
  const basis = { origin: t.origin, lib, pfad: seg.slice(0, i).join('/') };
  if (JSON.stringify(spBasis()) === JSON.stringify(basis)) return false;
  D.settings.sp = basis; return true;
}
// Ordner ab „Ortsgliederungen“ bzw. „1601_Diözese_Pojekte“ – aus einem Pfad (Explorer, OneDrive, relativ) oder einem SharePoint-Link
const spRel = p => { const seg = unquote(String(p || '')).split(/[\\/]+/).filter(Boolean), i = spWurzelAb(seg); return i < 0 ? null : seg.slice(i); };
const spRelLink = url => { const t = spTeile(url); return t ? spRel(t.pfad) : null; };
function spLink(p, s = spBasis()) {
  const rel = spRel(p); if (!s || !rel) return '';
  const voll = s.pfad + '/' + rel.join('/');
  return s.lib ? s.origin + s.lib + '/Forms/AllItems.aspx?id=' + encodeURIComponent(voll) : s.origin + voll.split('/').map(encodeURIComponent).join('/');
}
// Ordner des Bedarfs im OneDrive (für Cowork): gefundener Pfad oder aus dem SharePoint-Link zurückgerechnet
function kiOrdnerPfad(b) {
  if ((b.pfad || '').trim()) return unquote(b.pfad).trim();
  const rel = okLink(b.link) && spRelLink(b.link);
  return rel ? kiPfadVoll(KI_ABLAGE.replace(/\\Ortsgliederungen$/, '') + '\\' + rel.join('\\')) : '';
}
// Bedarfe mit bekanntem Ordner, aber ohne Link: Link nachtragen (nachdem die Adresse gelernt ist)
function spNachziehen() { let n = 0; for (const b of D.bedarfe) if (!okLink(b.link) && (b.pfad || '').trim()) { const l = spLink(b.pfad); if (l) { b.link = l; n++; } } return n; }
// „OneDrive - MalteserCloud\…“ (so schreibt es Cowork) zum vollen Pfad ergänzen – mit dem Anfang des Pfads, unter dem die Bedarfsliste liegt (C:\Users\…\)
function kiPfadVoll(p) {
  if (!p || /^[a-z]:\\|^\\\\/i.test(p)) return p;
  const L = typeof localPath === 'function' ? localPath() : null, m = L && L.match(/^(.*?\\)(OneDrive - [^\\]+)\\/i), q = p.match(/^(OneDrive - [^\\]+)\\/i);
  return m && q && m[2].toLowerCase() === q[1].toLowerCase() ? m[1] + p : p;
}
function readKiBlaetter(book) {
  const r = { beschr: '', grundlage: '', pfad: '', ul: [], pers: [] }, blatt = re => book.sheets.find(s => !s.hidden && re.test(s.name.trim()));
  const sb = blatt(/^beschreibung/i);
  if (sb) for (const x of sb.rows) { const k = norm(x[0]); if (k.startsWith('vorschlag')) r.beschr = ohnePlatzhalter(cellStr(x[1])); else if (k.startsWith('grundlage')) r.grundlage = ohnePlatzhalter(cellStr(x[1])); else if (k === 'ordner') r.pfad = unquote(ohnePlatzhalter(cellStr(x[1]))).trim(); }
  const sk = blatt(/^kontakte/i), kh = sk ? sk.rows.findIndex(x => norm(x[0]) === 'name') : -1;          // Kontaktdaten der Zuständigen (Cowork)
  if (kh >= 0) for (const x of sk.rows.slice(kh + 1)) { const n = ohnePlatzhalter(cellStr(x[0])); if (!n) continue;
    r.pers.push({ n, rolle: ohnePlatzhalter(cellStr(x[1])), mail: mailText(x[2]), tel: telText(x[3]), mobil: telText(x[4]) }); }
  const su = blatt(/^unterlagen/i), hi = su ? su.rows.findIndex(x => norm(x[0]) === 'unterlage' && /^im ordner/.test(norm(x[1]))) : -1;   // Kopfzeile, nicht die Überschrift darüber
  if (hi >= 0) for (const x of su.rows.slice(hi + 1)) {
    const n = ohnePlatzhalter(cellStr(x[0])), da = norm(x[1]); if (!istEintrag(n) || !da) continue;     // ohne „Im Ordner?“: nicht geprüft
    r.ul.push({ n, da: /^(ja|x|✓|vorhanden|liegt)/.test(da), datei: ohnePlatzhalter(cellStr(x[2])), hinweis: ohnePlatzhalter(cellStr(x[3])) });
  }
  return r;
}
// Vorschläge zu den Unterlagen: im Ordner gefunden → „vorhanden“; neue Unterlage → eintragen (vorhanden oder fehlt); nicht gefunden → nur ein Hinweis
function ulVorschlaege(b, L) {
  const V = [];
  for (const x of L) {
    const u = b.unterlagen.find(y => norm(y.name) === norm(x.n)), info = [x.datei, x.hinweis].filter(Boolean).join(' · ');
    if (u && x.da && u.st !== 'da') V.push({ t: u.name + ': liegt im Ordner – auf „vorhanden“ setzen', info, an: true, apply: () => { u.st = 'da'; } });
    else if (u && !x.da) V.push({ t: u.name + ': im Ordner nicht gefunden', info: x.hinweis });
    else if (u && x.hinweis) V.push({ t: u.name + ': liegt im Ordner', info: x.hinweis });
    else if (!u) V.push({ t: x.n + (x.da ? ': liegt im Ordner – als vorhanden eintragen' : ': fehlt – als fehlend eintragen'), info, an: true, apply: () => { b.unterlagen.push(UL(x.n, x.da ? 'da' : 'fehlt')); } });
  }
  return V;
}
