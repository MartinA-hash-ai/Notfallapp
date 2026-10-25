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
];
const fpHeadKey = t => norm(t).replace(/[^a-zäöüß0-9]/g, '');
// ausgeblendetes Blatt mit dem Stand beim Anlegen der Excel: beim Übernehmen („überschreiben“) gilt nur, was in der Excel geändert wurde
const FP_STAND = '_Stand';
const fpWerte = f => ({ art: f.art, weg: f.weg, kontakt: f.kontakte.map(kontaktText).join('\n'), mail: (f.kontakte[0] || {}).mail || '', tel: (f.kontakte[0] || {}).tel || '', web: f.web,
  frist: f.frist, fristInfo: f.fristInfo, betrag: f.betrag != null && f.betrag !== '' ? +f.betrag : null, hoehe: f.hoehe, eigenInfo: f.eigenInfo, warum: f.warum, knackpunkte: f.knackpunkte,
  einsch: f.einsch, quellen: f.quellen, notiz: f.notiz });

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
      + (gl ? 'Förderer mit Bezug zu ' + gl + ' und Umgebung zuerst, danach Erzbistum Paderborn und NRW, zuletzt bundesweit.' : 'Förderer mit Bezug zum Erzbistum Paderborn und zu NRW zuerst, danach bundesweit.'),
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

/* ---------- Vorlage schreiben (leer oder mit Bedarf und bisherigem Förderplan) */
function vorlageBlob(b) {
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
  block('Auftrag', rechAuftrag(b).map((t, i) => (i + 1) + '. ' + t));
  block('Umfang', [rechUmfang(b)]);
  block('Regeln', RECH_REGELN.map(t => '• ' + t));
  A.push([]);
  A.push([{ v: 'Spalte', st: head }, { v: 'Was gehört hinein', st: head }]);
  for (const c of FP_COLS) A.push([{ v: c.t, st: { b: true, border: 'thin', v: 'top' } }, { v: c.help + (c.items ? ' Auswahl: ' + c.items.join(' · ') : ''), st: { wrap: true, border: 'thin', v: 'top' } }]);
  // verbundene Zellen wachsen in Excel nicht mit: lange Absätze bekommen die Höhe für ihre Zeilenzahl (etwa 125 Zeichen je Zeile)
  const amerge = []; A.forEach((r, i) => { if (r.length !== 1) return; amerge.push('A' + (i + 1) + ':B' + (i + 1)); const n = String(r[0].v || '').length; if (n > 125 && ah[i] == null) ah[i] = Math.ceil(n / 125) * 15 + 4; });
  const anl = { name: 'Anleitung', cols: [30, 110], rows: A, merges: amerge, heights: ah, grid: false };
  const stand = { name: FP_STAND, hidden: true, cols: [30, 100], rows: (b ? b.foerderer.filter(f => f.name.trim()) : []).map(f => [kkeyFp(f.name), JSON.stringify(fpWerte(f)).slice(0, 32000)]) };
  const KL = karteiFuer(b);
  if (!KL.length) return xlsxBlob(stand.rows.length ? [plan, anl, stand] : [plan, anl]);
  const kh = ['Förderer', 'Bereich', 'Zuständig für', 'Antragsweg', 'Förderschwerpunkte', 'Website', 'Förderhistorie'], kc = { border: 'thin', v: 'top', wrap: true };
  const K = [[{ v: 'Förder-Kartei' + (rechGl(b) ? ': zuständig für ' + rechGl(b) + ' oder für alle' : ''), st: { b: true, sz: 15 } }],
    [{ v: 'Auszug aus der Förder-Kartei, ohne Kontaktdaten und Notizen. Diese Förderer zuerst prüfen; die Förderhistorie zeigt, was sie uns schon gegeben haben. Nur lesen, nichts ändern.', st: note }], [],
    kh.map(v => ({ v, st: head })),
    ...KL.map(k => [k.name, k.blatt, k.gl.join(', '), k.weg.join(', '), k.schwer, k.web, Object.entries(k.hist).sort((x, y) => y[0].localeCompare(x[0])).map(([y, v]) => y + ': ' + v).join('\n')]
      .map(v => ({ v: v || '', st: kc })))];
  const kart = { name: 'Förder-Kartei', cols: [32, 14, 22, 16, 36, 30, 44], rows: K, merges: ['A1:G1', 'A2:G2'], heights: { 0: 24, 1: 32, 3: 24 }, freeze: 'B5', grid: false };
  return xlsxBlob(stand.rows.length ? [plan, anl, kart, stand] : [plan, anl, kart]);
}
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

/* ---------- Förderrecherche mit Copilot: Excel in den Unterordner „Förderrecherche“ legen (dort kommt Copilot Cowork über OneDrive heran),
   Auftrag als Prompt zum Kopieren, ausgefüllte Excel von dort wieder übernehmen. Ohne verbundenen Ordner: herunterladen und hochladen. */
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
// enthält die Excel Förderer, die noch nicht im Förderplan stehen?
async function rechNeu(b, f) {
  try { const g = await readFoerderplan(await f.arrayBuffer()); return !!g && g.items.some(it => !b.foerderer.some(x => kkey(x.name) === kkey(it.name))); } catch (e) { return false; }
}
async function rechWrite(b) {
  const d = await rechDir(true); if (!d) return false;
  try { const fh = await d.getFileHandle(vorlageName(b), { create: true }), w = await fh.createWritable(); await w.write(vorlageBlob(b)); await w.close(); return true; }
  catch (e) { console.warn(e); return false; }
}
// Pfad zum Unterordner, wie ihn der Explorer zeigt (nur wenn die Liste als Datei geöffnet ist), und der Teil hinter „OneDrive …\“ für den Prompt
function rechPfad() {
  const p = localPath(); if (!p) return { lokal: '', od: '' };
  const dir = p.replace(/[\\/][^\\/]*$/, '') + '\\' + RECH_DIR, m = dir.match(/\\OneDrive[^\\]*\\(.+)$/i);
  return { lokal: dir, od: m ? m[1].replace(/\\/g, '/') : '' };
}
function rechPrompt(b) {
  const F = finState(b), o = rechOffen(b), gl = rechGl(b), name = vorlageName(b), P = rechPfad(), L = [];
  L.push('Du unterstützt mich im Fundraising des Malteser Hilfsdienst e. V. in der Diözese Paderborn bei einer Förderrecherche.', '');
  L.push('Bedarf: ' + (b.titel || '(ohne Namen)'), 'Gliederung: ' + (gl || 'Diözese Paderborn (ohne Gliederung)'));
  if (F.S) L.push('Summe: ' + eur(F.S) + (F.eig ? ' · Eigenmittel ' + eur(F.eig) : '') + (F.zu ? ' · schon zugesagt ' + eur(F.zu) : '') + ' · noch offen ' + eur(o));
  if (b.deadline) L.push('Deadline: ' + fmtDate(b.deadline));
  if (b.stichworte.length) L.push('Stichworte oder Fördertöpfe: ' + b.stichworte.join(', '));
  if (b.beschreibung.trim()) L.push('Beschreibung: ' + b.beschreibung.trim().replace(/\s*\n+\s*/g, ' '));
  L.push('', 'Datei: die angehängte Excel „' + name + '“' + (rechOrdnerOk() && P.od ? ' (liegt in OneDrive unter „' + P.od + '“)' : '')
    + '. Oben im Blatt „Förderplan“ stehen der Bedarf und die Finanzierung, darunter die Förderer, die schon im Plan sind.', '');
  L.push('Auftrag:', ...rechAuftrag(b).map((t, i) => (i + 1) + '. ' + t), '');
  L.push('Umfang: ' + rechUmfang(b), '');
  L.push('Format: Trage die Ergebnisse in das Blatt „Förderplan“ dieser Datei ein, je Förderer eine Zeile. Was in jede Spalte gehört, steht im Blatt „Anleitung“. '
    + RECH_REGELN.slice(1).join(' ') + ' Speichere die Datei unter demselben Namen am selben Ort. Falls du sie nicht direkt bearbeiten kannst, gib mir eine Excel-Datei mit genau diesem Aufbau zurück.', '');
  L.push('Zum Schluss im Chat: die drei aussichtsreichsten Förderer mit je einem Satz Begründung, welcher Teil der offenen Summe realistisch erscheint und was du nicht klären konntest.');
  return L.join('\n');
}
const lmText = f => new Date(f.lastModified).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
async function rechDialog(b) {
  let close = null, datei = await rechFile(b);
  const ordner = rechOrdnerOk(), P = rechPfad();
  const st = h('div', { class: 'rech-st muted small' }), btn1 = h('button', { onclick: () => schritt1() }), btn2 = h('button', { onclick: () => kopieren() }, 'Prompt kopieren');
  const zeig = () => {
    st.replaceChildren(ordner ? (datei ? '„' + datei.name + '“ liegt im Ordner, zuletzt geändert am ' + lmText(datei) + ' Uhr' : 'Wird als „' + vorlageName(b) + '“ im Unterordner „' + RECH_DIR + '“ neben der Bedarfsliste abgelegt.')
      : 'Die Datei landet in „Downloads“. Für Copilot Cowork in den OneDrive legen und dann anhängen.',
      ordner && P.lokal ? h('div', { class: 'rech-pfad', title: 'Pfad zum Ordner – zum Kopieren markieren' }, P.lokal) : null);
    btn1.textContent = ordner ? (datei ? 'Neu anlegen' : 'Excel anlegen') : 'Excel herunterladen';
    btn1.className = datei ? '' : 'primary'; btn2.className = datei ? 'primary' : '';
  };
  async function schritt1() {
    if (!ordner) { vorlageDownload(b); return; }
    if (datei && !await confirmBox('Excel neu anlegen?', 'Die vorhandene „' + datei.name + '“ wird ersetzt – auch Einträge von Copilot, die noch nicht übernommen sind.', 'Ersetzen')) return;
    if (!await rechWrite(b)) { toast('Die Excel konnte nicht im Ordner abgelegt werden. Sie wird stattdessen heruntergeladen.', 'warn'); vorlageDownload(b); return; }
    datei = await rechFile(b); zeig(); toast('Excel für die Recherche angelegt', 'ok');
  }
  const ta = h('textarea', { class: 'rech-prompt', rows: 12, spellcheck: false, 'aria-label': 'Auftrag für Copilot' });
  ta.value = rechPrompt(b);
  const kopieren = () => {
    const fail = () => { ta.focus(); ta.select(); toast('Text markiert – jetzt mit Strg+C kopieren'); };
    try { navigator.clipboard.writeText(ta.value).then(() => toast('Auftrag kopiert – in Copilot einfügen', 'ok'), fail); } catch (e) { fail(); }
  };
  const schritt3 = async () => {
    if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
    const f = ordner ? await rechFile(b) : null;
    if (close) close(null);
    // Excel noch ohne neue Förderer: nicht stumm die leere Vorlage zeigen, sondern sagen, woran es liegen kann
    if (f && !await rechNeu(b, f)) {
      const v = await modal('Noch keine neuen Förderer', h('div', { class: 'help' },
        h('p', null, 'In „' + f.name + '“ (zuletzt geändert am ' + lmText(f) + ' Uhr) steht noch kein Förderer, der nicht schon im Förderplan ist.'),
        h('p', null, 'Mögliche Gründe: Copilot ist noch nicht fertig; OneDrive hat die geänderte Datei noch nicht auf diesen PC geholt (kurz warten); oder Copilot hat das Ergebnis als eigene Datei gespeichert – dann diese auswählen.')),
        [['Schließen', null], ['Trotzdem ansehen', 'show'], ['Andere Datei wählen …', 'pick', 'primary']]);
      if (v === 'pick') { importFoerderplan(b); return; }
      if (v !== 'show') return;
    }
    importFoerderplan(b, f || undefined);
  };
  zeig();
  const body = h('div', { class: 'help rech' },
    h('p', null, 'Copilot sucht passende Förderer und trägt sie in eine Excel zu diesem Bedarf ein. Danach zeigt dir die Liste, was sie übernehmen würde – du wählst aus.'),
    h('ol', { class: 'rech-steps' },
      h('li', null, h('div', { class: 'rech-row' }, h('b', null, 'Excel für diesen Bedarf'), btn1), st),
      h('li', null, h('div', { class: 'rech-row' }, h('b', null, 'Auftrag an Copilot'), btn2),
        h('div', { class: 'muted small' }, 'In Copilot Cowork einfügen und die Excel als Datei anhängen. Der Text lässt sich hier vorher anpassen, etwa beim Umfang.'), ta,
        h('div', { class: 'muted small rech-hinweis' }, 'Mit dem Prompt und der Excel gehen Bedarf, Beschreibung und Finanzierung an Copilot; aus der Kartei nur Name, Zuständigkeit, Schwerpunkte und Förderhistorie – keine Kontaktdaten und Notizen.')),
      h('li', null, h('div', { class: 'rech-row' }, h('b', null, 'Ergebnis übernehmen'), h('button', { onclick: schritt3 }, ordner ? 'Excel übernehmen' : 'Excel auswählen …')),
        h('div', { class: 'muted small' }, 'Wenn Copilot fertig ist. Du siehst zuerst die Vorschläge mit Summen und wählst aus. Eine Excel lässt sich auch einfach auf die Seite ziehen.'))));
  await modal('Förderrecherche mit Copilot', body, [['Schließen', null]], { wide: true, expose: c => { close = c; } });
}

/* ---------- Förderplan aus einer Excel lesen: jedes sichtbare Blatt außer „Anleitung“ und „Förder-Kartei“ mit einer Kopfzeile, in der eine Spalte
   „Förderer…“ heißt (an beliebiger Stelle, auch „Förderer (Name)“) und weitere Spalten der Vorlage stehen. Schreibt Copilot in ein neues Blatt,
   kommen dessen Förderer dazu. Summen-, Hinweis- und Standzeilen sowie Platzhalter („nicht gefunden“) werden übergangen. */
async function readFoerderplan(buf) {
  const book = await xlsxBook(buf), heads = c => [c.t, ...(c.alias || [])].map(fpHeadKey);
  const spalte = t => { const k = fpHeadKey(t); if (!k) return null; if (k.startsWith('förderer')) return FP_COLS[0]; return FP_COLS.find(c => heads(c).includes(k)) || FP_COLS.find(c => c.k !== 'name' && heads(c).some(x => k.startsWith(x.slice(0, 8)))) || null; };
  const stand = new Map(), sst = book.sheets.find(s => s.name === FP_STAND);
  if (sst) for (const r of sst.rows) { try { if (r[0]) stand.set(String(r[0]), JSON.parse(String(r[1]))); } catch (e) { /* Zeile unbrauchbar */ } }
  const blaetter = book.sheets.filter(s => !s.hidden && s.name !== FP_STAND && !/^(anleitung|förder-?kartei)$/i.test(s.name.trim())).sort((a, c) => (c.name === FP_SHEET) - (a.name === FP_SHEET));
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
  return gefunden ? { items, kennung, sheet, stand } : null;
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
async function importFoerderplan(b, file) {
  file = file || await pickFile('.xlsx'); if (!file) return;
  let got = null;
  try { got = await readFoerderplan(await file.arrayBuffer()); } catch (e) { console.warn(e); }
  if (!got) { modal('Kein Förderplan gefunden', h('p', null, 'In „' + file.name + '“ steht keine Tabelle mit einer Spalte „Förderer“ und weiteren Spalten der Vorlage (z. B. „Antragsfrist“, „Erwartete Summe“). Bitte die Förderplan-Vorlage der Bedarfsliste verwenden.')); return; }
  if (!got.items.length) { modal('Keine Förderer', h('p', null, 'In „' + file.name + '“ ist noch kein Förderer eingetragen.')); return; }
  const other = got.kennung && got.kennung !== b.id ? D.bedarfe.find(x => x.id === got.kennung) : null;
  const byName = n => b.foerderer.find(f => kkey(f.name) === kkey(n));
  const sel = got.items.map(() => true);
  let mode = 'fill';
  const kurz = t => t.length > 150 ? t.slice(0, 147).replace(/\s+\S*$/, '') + ' …' : t;
  const sumEl = h('p', { class: 'imp-sum' }), offen = rechOffen(b);
  const upd = () => {
    const neu = got.items.filter((it, i) => sel[i] && !byName(it.name)), v = neu.reduce((s, it) => s + (+it.betrag || 0), 0);
    sumEl.replaceChildren('Neu ausgewählt: ', h('b', null, neu.length + ' Förderer'), v ? ', erwartet zusammen ' : '', v ? h('b', null, eur(v)) : '', offen ? ' – noch offen sind ' + eur(offen) + '.' : '.');
  };
  const tbl = h('table', { class: 'imp' },
    h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Förderer'), h('th', { class: 'num' }, 'Summe'), h('th', null, 'Antragsfrist'), h('th', null, 'Einschätzung'), h('th', null, ''))),
    h('tbody', null, got.items.map((it, i) => { const f = byName(it.name); return h('tr', null,
      h('td', null, h('input', { type: 'checkbox', checked: true, 'aria-label': it.name + ' übernehmen', onchange: e => { sel[i] = e.target.checked; upd(); } })),
      h('td', null, h('b', null, it.name), kartei(it.name) ? h('span', { class: 'badge k' }, 'in der Kartei') : null,
        it.warum || (!f && !it.quellen) ? h('div', { class: 'imp-why' }, kurz(it.warum || ''), f || it.quellen ? null : h('span', { class: 'imp-nq' }, 'ohne Quelle')) : null),
      h('td', { class: 'num' }, it.betrag ? eur(it.betrag) : '–'),
      h('td', null, fmtDate(it.frist) || '–'),
      h('td', null, (EINSCH.find(e => e[0] === it.einsch) || [, '–'])[1]),
      h('td', { class: 'muted small nowrap' }, f ? 'im Plan: ' + F_ST_L[f.status] : 'neu')); })));
  upd();
  const dup = got.items.some(it => byName(it.name));
  const body = h('div', { class: 'help' },
    other ? h('p', { class: 'hint-warn' }, 'Achtung: Diese Excel wurde für einen anderen Bedarf erstellt: „' + (other.titel || 'ohne Namen') + '“' + (other.gliederung ? ' (' + other.gliederung + ')' : '') + '.') : null,
    h('p', null, got.items.length + (got.items.length === 1 ? ' Förderer' : ' Förderer') + ' in „' + file.name + '“. Neue Förderer kommen mit dem Stand „geplant“ in den Förderplan.'),
    h('div', { class: 'tablewrap' }, tbl), sumEl,
    dup ? h('div', { class: 'radios' }, h('p', { class: 'small' }, h('b', null, 'Förderer, die schon im Förderplan stehen:')),
      ...[['fill', 'nur leere Felder ergänzen'], ['all', 'in der Excel Geändertes übernehmen (überschreibt – zugesagte und abgelehnte Förderer bleiben, wie sie sind)'], ['skip', 'nicht anfassen']].map(([v, l]) =>
        h('label', { class: 'check' }, h('input', { type: 'radio', name: 'impmode', value: v, checked: v === mode, onchange: () => { mode = v; } }), l))) : null);
  if (!await modal('Vorschläge aus der Recherche', body, [['Abbrechen', false], ['Übernehmen', true, 'primary']], { wide: true })) return;
  const before = JSON.stringify(D);
  let neu = 0, erg = 0;
  got.items.forEach((it, i) => {
    if (!sel[i]) return;
    const f = byName(it.name);
    if (f) { if (mode !== 'skip') { applyResearch(f, it, mode === 'all' && ['zugesagt', 'abgelehnt'].includes(f.status) ? 'fill' : mode, got.stand.get(kkey(f.name))); erg++; } }
    else { const n = ff({ name: it.name }); applyResearch(n, it, 'all'); b.foerderer.push(n); neu++; }
  });
  if (!neu && !erg) return;
  changed(); keep(renderNow);
  toast([neu ? neu + ' Förderer übernommen' : '', erg ? erg + ' ergänzt' : ''].filter(Boolean).join(', '), 'ok', undoGanz(before));
}
