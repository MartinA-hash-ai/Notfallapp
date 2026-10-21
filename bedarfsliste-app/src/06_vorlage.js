/* ===================================================================== Förderplan-Excel: Vorlage für die Recherche (von Hand oder per KI) und Übernahme in den Förderplan
   Die Vorlage hat zwei Blätter: „Förderplan“ (oben der Bedarf, darunter je Förderer eine Zeile) und „Anleitung“ (was in jede Spalte gehört).
   Eingelesen wird die Zeile mit „Förderer“ in Spalte A als Kopfzeile; die Spalten werden über ihre Überschrift erkannt. */

const FP_SHEET = 'Förderplan', FP_HEAD_ROW = 10;
const FP_COLS = [
  { k: 'name', t: 'Förderer', w: 30, help: 'Name der Stiftung, Bank, Firma oder des Förderprogramms – genau so, wie er in der Förder-Kartei steht, falls er dort schon vorkommt.' },
  { k: 'art', t: 'Art', w: 18, items: ART, help: 'Aus der Auswahlliste.' },
  { k: 'weg', t: 'Antragsweg', w: 16, items: ['Portal', 'E-Mail', 'Brief', 'Persönlich', 'Telefon', 'Sonstiges'], help: 'Wie der Antrag gestellt wird – aus der Auswahlliste.' },
  { k: 'kontakt', t: 'Ansprechperson oder Portal', w: 26, help: 'Name und Funktion der zuständigen Person oder Name des Antragsportals.' },
  { k: 'mail', t: 'E-Mail', w: 28, help: 'E-Mail-Adresse der Ansprechperson oder der Förderstelle.' },
  { k: 'tel', t: 'Telefon', w: 18, help: 'Telefonnummer.' },
  { k: 'web', t: 'Website oder Portal-Link', w: 32, help: 'Link zur Förderseite oder zum Antragsportal.' },
  { k: 'frist', t: 'Antragsfrist', w: 14, date: true, help: 'Nächster Einsendeschluss als Datum (TT.MM.JJJJ). Laufende Antragstellung: leer lassen und unter „Weitere Fristen und Termine“ notieren.' },
  { k: 'fristInfo', t: 'Weitere Fristen und Termine', w: 30, wrap: true, help: 'Vergabesitzungen, Stichtage, Bearbeitungszeit, „laufend“ usw.' },
  { k: 'betrag', t: 'Erwartete Summe (€)', alias: ['Betrag beantragen (€)'], w: 15, num: true, help: 'Wie viel von diesem Förderer zu erwarten ist bzw. beantragt werden sollte – eine feste Summe, nur die Zahl in Euro.' },
  { k: 'hoehe', t: 'Übliche Fördersumme', w: 22, wrap: true, help: 'Typische oder maximale Förderhöhe laut Richtlinien oder Förderhistorie.' },
  { k: 'eigenInfo', t: 'Eigenanteil gefordert', w: 20, wrap: true, help: 'Ob und wie viel Eigenanteil verlangt wird.' },
  { k: 'warum', t: 'Warum passt das?', w: 48, wrap: true, help: 'Begründung: Satzungszweck, Förderschwerpunkt, Regionalbezug, frühere Förderungen.' },
  { k: 'knackpunkte', t: 'Knackpunkte', w: 48, wrap: true, help: 'Wo es haken kann und worauf der Antrag den Fokus legen sollte.' },
  { k: 'einsch', t: 'Einschätzung', w: 22, items: EINSCH.map(e => e[1]), help: 'Wie wahrscheinlich eine Förderung ist – nur: ' + EINSCH.map(e => e[1]).join(' · ') + '.' },
  { k: 'quellen', t: 'Quellen', w: 36, wrap: true, help: 'Links zu Satzung, Förderrichtlinien und weiteren Belegen.' },
  { k: 'notiz', t: 'Notizen', w: 30, wrap: true, help: 'Alles Weitere.' },
];
const fpHeadKey = t => norm(t).replace(/[^a-zäöüß0-9]/g, '');

/* ---------- Vorlage schreiben (leer oder mit Bedarf und bisherigem Förderplan) */
function vorlageBlob(b) {
  const W = FP_COLS.length, last = colName(W - 1), head = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' };
  const lab = { b: true, color: '#404040' }, note = { i: true, sz: 9, color: '#6B6B6B' }, val = { border: 'thin', fill: '#FAFAF8', v: 'top', wrap: true };
  const rows = [], heights = { 0: 24, [FP_HEAD_ROW - 1]: 32 }, merges = ['A1:' + last + '1', 'A2:' + last + '2'];
  rows[0] = [{ v: 'Förderplan' + (b && b.titel ? ': ' + b.titel : ''), st: { b: true, sz: 15 } }];
  rows[1] = [{ v: 'Je möglichem Förderer eine Zeile ausfüllen. Spaltenüberschriften und Blattnamen nicht ändern. Was in jede Spalte gehört, steht im Blatt „Anleitung“. Danach in der Bedarfsliste „Aus Excel übernehmen“ wählen.', st: note }];
  const info = [['Bedarf', b ? b.titel : ''], ['Gliederung', b ? (b.gliederung === DIO ? 'Diözese (ohne Gliederung)' : b.gliederung) : ''], ['Summe (€)', b && b.summe ? +b.summe : ''],
    ['Deadline', b && b.deadline ? { v: b.deadline, t: 'd' } : ''], ['Beschreibung', b ? b.beschreibung : ''], ['Kennung', b ? b.id : '']];
  info.forEach(([k, v], i) => {
    const r = 3 + i;
    rows[r] = [{ v: k, st: lab }, typeof v === 'object' && v ? Object.assign(v, { st: val }) : { v, st: k === 'Kennung' ? { sz: 8, color: '#9A9A9A' } : val }];
    if (k === 'Beschreibung') { merges.push('B' + (r + 1) + ':' + colName(Math.min(W - 1, 8)) + (r + 1)); heights[r] = 60; }
    else if (k !== 'Kennung') merges.push('B' + (r + 1) + ':D' + (r + 1));
  });
  rows[FP_HEAD_ROW - 1] = FP_COLS.map(c => ({ v: c.t, st: head }));
  const cell = (c, v) => ({ v: v ?? '', t: c.date ? 'd' : c.num ? 'n' : undefined, st: { border: 'thin', v: 'top', wrap: !!c.wrap } });
  (b ? b.foerderer.filter(f => f.name.trim()) : []).forEach((f, i) => {
    rows[FP_HEAD_ROW + i] = FP_COLS.map(c => {
      let v = f[c.k];
      if (c.k === 'einsch') v = (EINSCH.find(e => e[0] === v) || [])[1] || '';
      if (c.k === 'betrag') v = f.betrag != null && f.betrag !== '' ? +f.betrag : '';
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
  para('Diese Datei ist die Vorlage für den Förderplan eines Bedarfs aus der Bedarfsliste (Fundraising, Malteser Hilfsdienst e. V., Diözese Paderborn). Sie wird von Hand oder von einer KI ausgefüllt und danach in der Bedarfsliste über „Aus Excel übernehmen“ eingelesen.');
  para('Auftrag: Finde Förderer, die zum Bedarf oben im Blatt „Förderplan“ passen – Stiftungen, Sparkassen und Volksbanken, Unternehmen, Soziallotterien, öffentliche und kirchliche Förderprogramme. Förderer mit Bezug zur Region der Gliederung zuerst. Prüfe Satzungszweck, Förderrichtlinien, Fristen und Förderhöhe auf den Seiten der Förderer und nenne die Quellen.');
  A.push([]);
  A.push([{ v: 'Regeln', st: { b: true, sz: 12 } }]);
  for (const t of ['Je Förderer genau eine Zeile im Blatt „Förderplan“, ab der Zeile unter den Überschriften.', 'Spaltenüberschriften, Blattnamen und die Angaben oben (Bedarf, Kennung) nicht ändern.',
    'Schon eingetragene Förderer ergänzen, nicht löschen oder doppelt anlegen.', 'Datum immer als TT.MM.JJJJ, Beträge nur als Zahl in Euro (ohne Text).',
    'Art, Antragsweg und Einschätzung aus der Auswahlliste der Zelle wählen.', 'Unsicheres als solches kennzeichnen (z. B. „laut Website 2025, nicht bestätigt“). Nichts erfinden: lieber eine Zelle leer lassen.'])
    A.push([{ v: '• ' + t, st: { wrap: true, v: 'top' } }]);
  A.push([]);
  A.push([{ v: 'Spalte', st: head }, { v: 'Was gehört hinein', st: head }]);
  for (const c of FP_COLS) A.push([{ v: c.t, st: { b: true, border: 'thin', v: 'top' } }, { v: c.help + (c.items ? ' Auswahl: ' + c.items.join(' · ') : ''), st: { wrap: true, border: 'thin', v: 'top' } }]);
  const amerge = []; A.forEach((r, i) => { if (r.length === 1) amerge.push('A' + (i + 1) + ':B' + (i + 1)); });
  [1, 2].forEach(i => { ah[i] = 48; });
  const anl = { name: 'Anleitung', cols: [30, 110], rows: A, merges: amerge, heights: ah, grid: false };
  return xlsxBlob([plan, anl]);
}
// Dateiname ohne Umlaute und Sonderzeichen (manche Browser verwerfen sonst den Namen beim Herunterladen)
const asciiName = t => String(t).replace(/[äÄöÖüÜß]/g, c => ({ ä: 'ae', Ä: 'Ae', ö: 'oe', Ö: 'Oe', ü: 'ue', Ü: 'Ue', ß: 'ss' }[c])).normalize('NFD').replace(/[^\w.\- ]+/g, ' ').trim().replace(/\s+/g, '_');
const vorlageName = b => 'Foerderplan_' + (b && b.titel ? asciiName(b.titel).slice(0, 50) : 'Vorlage') + '.xlsx';
function vorlageDownload(b) { download(vorlageName(b), vorlageBlob(b)); }

/* ---------- Förderplan aus einer Excel lesen */
async function readFoerderplan(buf) {
  const book = await xlsxBook(buf);
  for (const sh of [...book.sheets].sort((a, c) => (c.name === FP_SHEET) - (a.name === FP_SHEET))) {
    const hi = sh.rows.findIndex(r => fpHeadKey(r[0]) === 'förderer');
    if (hi < 0) continue;
    const map = {};
    const heads = c => [c.t, ...(c.alias || [])].map(fpHeadKey);
    sh.rows[hi].forEach((t, i) => { const k = fpHeadKey(t); const c = FP_COLS.find(c => heads(c).includes(k)) || FP_COLS.find(c => k && heads(c).some(x => k.startsWith(x.slice(0, 8)))); if (c && map[c.k] == null) map[c.k] = i; });
    const kenn = sh.rows.find(r => norm(r[0]) === 'kennung');
    const items = [];
    for (const r of sh.rows.slice(hi + 1)) {
      const name = cellStr(r[map.name]); if (!name) continue;
      const it = { name };
      for (const c of FP_COLS) {
        if (c.k === 'name' || map[c.k] == null) continue;
        const v = r[map[c.k]];
        if (c.date) it[c.k] = anyDate(v);
        else if (c.num) { const n = deNum(v); it[c.k] = typeof n === 'number' ? n : null; }
        else if (c.k === 'einsch') it[c.k] = einschKey(v);
        else it[c.k] = cellStr(v);
      }
      items.push(it);
    }
    return { items, kennung: kenn ? cellStr(kenn[1]) : '', sheet: sh.name };
  }
  return null;
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
// Felder eines Förderers aus der Recherche übernehmen: 'fill' = nur leere Felder füllen, 'all' = überschreiben
function applyResearch(f, it, mode) {
  for (const c of FP_COLS) {
    if (c.k === 'name') continue;
    const v = it[c.k]; if (v == null || v === '') continue;
    const empty = f[c.k] == null || f[c.k] === '';
    if (mode === 'all' || empty) f[c.k] = v;
  }
}
async function importFoerderplan(b, file) {
  file = file || await pickFile('.xlsx'); if (!file) return;
  let got = null;
  try { got = await readFoerderplan(await file.arrayBuffer()); } catch (e) { console.warn(e); }
  if (!got) { modal('Kein Förderplan gefunden', h('p', null, 'In „' + file.name + '“ steht keine Tabelle mit der Überschrift „Förderer“ in Spalte A. Bitte die Förderplan-Vorlage der Bedarfsliste verwenden.')); return; }
  if (!got.items.length) { modal('Keine Förderer', h('p', null, 'In „' + file.name + '“ ist noch kein Förderer eingetragen.')); return; }
  const other = got.kennung && got.kennung !== b.id ? D.bedarfe.find(x => x.id === got.kennung) : null;
  const byName = n => b.foerderer.find(f => kkey(f.name) === kkey(n));
  const sel = got.items.map(() => true);
  let mode = 'fill';
  const tbl = h('table', { class: 'imp' },
    h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Förderer'), h('th', { class: 'num' }, 'Summe'), h('th', null, 'Antragsfrist'), h('th', null, 'Einschätzung'), h('th', null, ''))),
    h('tbody', null, got.items.map((it, i) => h('tr', null,
      h('td', null, h('input', { type: 'checkbox', checked: true, 'aria-label': it.name + ' übernehmen', onchange: e => { sel[i] = e.target.checked; } })),
      h('td', null, h('b', null, it.name), kartei(it.name) ? h('span', { class: 'badge k' }, 'in der Kartei') : null),
      h('td', { class: 'num' }, it.betrag ? eur(it.betrag) : '–'),
      h('td', null, fmtDate(it.frist) || '–'),
      h('td', null, (EINSCH.find(e => e[0] === it.einsch) || [, '–'])[1]),
      h('td', { class: 'muted small' }, byName(it.name) ? 'schon im Förderplan' : 'neu')))));
  const dup = got.items.some(it => byName(it.name));
  const body = h('div', { class: 'help' },
    other ? h('p', { class: 'hint-warn' }, 'Achtung: Diese Excel wurde für den Bedarf „' + (other.titel || 'ohne Namen') + '“ erstellt.') : null,
    h('p', null, got.items.length + (got.items.length === 1 ? ' Förderer' : ' Förderer') + ' in „' + file.name + '“. Neue Förderer kommen mit dem Stand „geplant“ in den Förderplan.'),
    h('div', { class: 'tablewrap' }, tbl),
    dup ? h('div', { class: 'radios' }, h('p', { class: 'small' }, h('b', null, 'Förderer, die schon im Förderplan stehen:')),
      ...[['fill', 'nur leere Felder ergänzen'], ['all', 'Angaben aus der Excel übernehmen (überschreibt)'], ['skip', 'nicht anfassen']].map(([v, l]) =>
        h('label', { class: 'check' }, h('input', { type: 'radio', name: 'impmode', value: v, checked: v === mode, onchange: () => { mode = v; } }), l))) : null);
  if (!await modal('Ausgefüllte Förderplan-Excel übernehmen', body, [['Abbrechen', false], ['Übernehmen', true, 'primary']], { wide: true })) return;
  const before = JSON.stringify(D);
  let neu = 0, erg = 0;
  got.items.forEach((it, i) => {
    if (!sel[i]) return;
    const f = byName(it.name);
    if (f) { if (mode !== 'skip') { applyResearch(f, it, mode); erg++; } }
    else { const n = ff({ name: it.name }); applyResearch(n, it, 'all'); b.foerderer.push(n); neu++; }
  });
  if (!neu && !erg) return;
  changed(); keep(renderNow);
  toast([neu ? neu + ' Förderer übernommen' : '', erg ? erg + ' ergänzt' : ''].filter(Boolean).join(', '), 'ok', () => { D = normalize(JSON.parse(before)); changed(); keep(renderNow); });
}
