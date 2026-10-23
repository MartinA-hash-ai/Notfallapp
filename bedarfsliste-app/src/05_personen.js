/* ===================================================================== Personen: die Excel „Personen.xlsx“ im Ordner der Bedarfsliste (nur lesen)
   Darin stehen die Zuständigen der Bedarfe mit Position, Gliederung, E-Mail und Telefon – ausgefüllt von Copilot oder von Hand und mit
   jedem Bedarf erweitert. Gelesen werden alle Excel-Dateien, deren Name mit „Personen“ beginnt (auch Kopien wie „Personen (1).xlsx“);
   bei unterschiedlichen Angaben gilt die neueste Datei. Fehlende Angaben der Zuständigen werden daraus ergänzt – Eingetragenes bleibt. */

const PR = { list: [], byKey: new Map(), files: [], stamp: '', err: null, busy: false };
const PERS_DATEI = 'Personen.xlsx', PERS_RE = /^personen\b[^/\\]*\.xlsx$/i;
const PERS_COLS = [
  { k: 'n', t: 'Name', w: 26, re: /^(vor- und zu)?name$/ },
  { k: 'rolle', t: 'Position', w: 32, re: /position|funktion|rolle|aufgabe/ },
  { k: 'gl', t: 'Gliederung / Dienststelle', w: 26, re: /gliederung|dienststelle|einheit/ },
  { k: 'mail', t: 'E-Mail', w: 32, re: /mail/ },
  { k: 'tel', t: 'Telefon', w: 20, re: /^(telefon|tel\b|festnetz)(?!.*(\b2\b|mobil|handy))/ },
  { k: 'mobil', t: 'Handy', w: 18, re: /handy|mobil|telefon 2|tel\.? 2/ },
  { k: 'quelle', t: 'Quelle', w: 40, re: /quelle/ },
  { k: 'stand', t: 'Stand', w: 12, re: /^stand|datum/ },
];
const person = name => PR.byKey.get(kkey(name)) || null;

// je Blatt die Kopfzeile mit „Name“ und „E-Mail“, „Telefon“ oder „Handy“; „Vorname“ und „Nachname“ in zwei Spalten gehen auch
function parsePersonen(book) {
  const out = [];
  for (const sh of book.sheets) {
    const rows = sh.rows, hi = rows.slice(0, 15).findIndex(r => r.some(v => /name/.test(norm(v))) && r.some(v => /mail|telefon|handy|mobil/.test(norm(v))));
    if (hi < 0) continue;
    const head = rows[hi].map(v => norm(v)), ci = {};
    for (const c of PERS_COLS) { const i = head.findIndex((t, j) => t && c.re.test(t) && !Object.values(ci).includes(j)); if (i >= 0) ci[c.k] = i; }
    const vi = head.indexOf('vorname'), ni = head.indexOf('nachname');
    for (const r of rows.slice(hi + 1)) {
      const p = Object.fromEntries(PERS_COLS.map(c => [c.k, ci[c.k] != null ? cellStr(r[ci[c.k]]) : '']));
      if (!p.n && vi >= 0 && ni >= 0) p.n = (cellStr(r[vi]) + ' ' + cellStr(r[ni])).trim();
      if (p.n) out.push(p);
    }
  }
  return out;
}
function personenSetzen(L) {
  const m = new Map();
  for (const p of L) { const k = kkey(p.n), a = m.get(k) || {}; for (const [x, v] of Object.entries(p)) if (v) a[x] = v; m.set(k, a); }
  PR.byKey = m; PR.list = [...m.values()].sort((a, b) => a.n.localeCompare(b.n, 'de'));
}
async function personenScan(force) {
  if (DEMO || PR.busy || ST.conn !== 'ok' || !ST.htmlDir) return false;
  PR.busy = true;
  try {
    const fs = [];
    for await (const [n, e] of ST.htmlDir.entries()) if (e.kind === 'file' && PERS_RE.test(n) && !n.startsWith('~$')) fs.push(await e.getFile());
    fs.sort((a, b) => a.lastModified - b.lastModified);                  // die neueste zuletzt: ihre Angaben gelten
    const stamp = fs.map(f => f.name + '@' + f.lastModified).join('|');
    if (!force && stamp === PR.stamp && !PR.err) return false;
    const L = []; let err = null;
    for (const f of fs) { try { L.push(...parsePersonen(await xlsxBook(await f.arrayBuffer(), { max: 4e6 }))); } catch (e) { console.warn(e); err = '„' + f.name + '“ gerade nicht lesbar'; } }
    personenSetzen(L); PR.files = fs; PR.stamp = stamp; PR.err = err;
    const n = personenErgaenzen();
    if (n) toast('Aus der Personen-Excel ergänzt: Angaben bei ' + n + ' Zuständigen.', 'ok');
    safeRender();
    return true;
  } catch (e) { console.warn(e); PR.err = (e && e.message) || String(e); return false; } finally { PR.busy = false; }
}
// leere Position, E-Mail und Telefon der Zuständigen aus der Personen-Excel füllen (in allen Bedarfen); Anzahl der ergänzten Personen
function personenErgaenzen() {
  let n = 0;
  for (const b of D.bedarfe) for (const z of b.zust) {
    const p = person(z.n); if (!p) continue;
    let neu = false;
    for (const k of ZUST_F) if (!(z[k] || '').trim() && p[k]) { z[k] = p[k]; neu = true; }
    if (neu) n++;
  }
  if (n) changed();
  return n;
}
// eine Excel von Copilot, die nicht als „Personen.xlsx“ im Ordner liegt: als Kopie in den Ordner legen (dann gilt sie auch künftig) und einlesen
async function personenDatei(file) {
  if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return 0; }
  let L = [];
  try { L = parsePersonen(await xlsxBook(await file.arrayBuffer(), { max: 4e6 })); } catch (e) { console.warn(e); }
  if (!L.length) { modal('Keine Personen gefunden', h('p', null, 'In „' + file.name + '“ steht keine Tabelle mit den Spalten „Name“ und „E-Mail“ oder „Telefon“.')); return 0; }
  if (rechOrdnerOk()) {
    const name = PERS_RE.test(file.name) && !PR.files.some(f => f.name === file.name) ? file.name : 'Personen (Copilot ' + today() + ').xlsx';
    try { const fh = await ST.htmlDir.getFileHandle(name, { create: true }), w = await fh.createWritable(); await w.write(file); await w.close(); await personenScan(true); toast('„' + name + '“ im Ordner abgelegt und eingelesen – ' + L.length + ' Personen.', 'ok'); return L.length; }
    catch (e) { console.warn(e); }
  }
  personenSetzen([...PR.list, ...L]);                                     // ohne Ordner: nur für diese Sitzung
  const n = personenErgaenzen(); safeRender();
  toast(L.length + ' Personen eingelesen' + (n ? ', Angaben bei ' + n + ' Zuständigen ergänzt' : '') + '.', 'ok');
  return L.length;
}

/* ---------- Excel anlegen: alle Personen, die die Liste schon kennt, mit Anleitung */
const PERS_ANL = ['Personen für die Bedarfsliste',
  'Hier stehen die Zuständigen der Bedarfe (Fundraising, Malteser Hilfsdienst e. V., Diözese Paderborn) mit ihren dienstlichen Kontaktdaten. Die Bedarfsliste liest diese Datei und ergänzt damit fehlende Angaben bei den Zuständigen. Ausgefüllt von Copilot oder von Hand; die Datei wächst mit jedem Bedarf.',
  'Regeln: Je Person genau eine Zeile im Blatt „Personen“. Spaltenüberschriften und Blattnamen nicht ändern. Vorhandene Zeilen nicht löschen und Angaben nicht überschreiben – nur leere Zellen ergänzen und neue Personen unten anfügen. Nur dienstliche Angaben, die tatsächlich gefunden wurden; sonst leer lassen.',
  'Name: Vor- und Nachname. Position: Funktion bei den Maltesern (z. B. Ortsbeauftragter, Referent Fundraising). Gliederung / Dienststelle: z. B. Paderborn oder Diözesangeschäftsstelle. E-Mail, Telefon und Handy: dienstlich, Nummern als Text mit Vorwahl (z. B. 05251 1234-56). Quelle: woher die Angabe stammt (z. B. Outlook-Adressbuch oder Link). Stand: Datum der Angabe.'];
function personenBlob() {
  const head = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, zelle = { border: 'thin', v: 'top', wrap: true };
  const bek = new Map(PR.list.map(p => [kkey(p.n), Object.assign({}, p)]));
  for (const b of D.bedarfe) for (const z of b.zust) {
    if (!z.n.trim()) continue;
    const k = kkey(z.n), a = bek.get(k) || { n: z.n.trim() };
    for (const x of ZUST_F) if (!a[x] && (z[x] || '').trim()) a[x] = z[x].trim();
    if (!a.gl && b.gliederung) a.gl = b.gliederung === DIO ? 'Diözese' : b.gliederung;
    bek.set(k, a);
  }
  const rows = [PERS_COLS.map(c => ({ v: c.t, st: head })), ...[...bek.values()].sort((a, b) => a.n.localeCompare(b.n, 'de')).map(p => PERS_COLS.map(c => ({ v: p[c.k] || '', st: zelle })))];
  for (let i = 0; i < 40; i++) rows.push(PERS_COLS.map(() => ({ v: '', st: zelle })));
  const anl = { name: 'Anleitung', cols: [120], rows: PERS_ANL.map((t, i) => [{ v: t, st: i ? { wrap: true, v: 'top' } : { b: true, sz: 15 } }]), heights: { 0: 24, 1: 34, 2: 48, 3: 48 }, grid: false };
  return xlsxBlob([{ name: 'Personen', cols: PERS_COLS.map(c => c.w), rows, heights: { 0: 22 }, freeze: 'B2', grid: false }, anl]);
}

/* ---------- Kontaktdaten mit Copilot: Excel, kurzer Auftrag, Ergebnis übernehmen */
// gesucht werden die Zuständigen dieses Bedarfs, bei denen etwas fehlt (sonst alle)
const personenGesucht = b => { const L = b.zust.filter(z => z.n.trim()), f = L.filter(z => !z.rolle.trim() || !z.mail.trim() || !z.tel.trim()); return f.length ? f : L; };
function personenPrompt(b) {
  const gl = rechGl(b) || 'Diözese Paderborn';
  return ['Suche die dienstlichen Kontaktdaten (Position, E-Mail, Telefon, Handy) dieser Personen vom Malteser Hilfsdienst e. V. (Diözese Paderborn) und trage sie in die angehängte Excel „' + PERS_DATEI + '“ ein (Blatt „Personen“):',
    ...personenGesucht(b).map(z => '- ' + z.n.trim() + ' (' + gl + ')'), '',
    'Suche zuerst in unserem Adressbuch und Organigramm (Outlook, Teams), dann auf malteser.de und den Seiten der Gliederung.',
    'Regeln: je Person eine Zeile; steht sie schon drin, nur leere Zellen ergänzen; nichts löschen oder überschreiben; nur eintragen, was du wirklich gefunden hast, sonst leer lassen; Telefon als Text mit Vorwahl; in „Quelle“ angeben, woher die Angabe stammt; Spaltenüberschriften nicht ändern.',
    'Speichere die Datei unter demselben Namen am selben Ort. Falls das nicht geht, gib sie mir als Excel-Datei mit genau diesem Aufbau zurück. Abweichungen zu vorhandenen Angaben nenne kurz im Chat.'].join('\n');
}
async function personenDialog(b) {
  const ordner = rechOrdnerOk();
  if (ordner) await personenScan(true);
  const st = h('div', { class: 'rech-st muted small' }), btn1 = h('button', { onclick: () => schritt1() }), erg = h('div', { class: 'rech-st small' });
  const datei = () => PR.files.find(f => f.name.toLowerCase() === PERS_DATEI.toLowerCase()) || PR.files[PR.files.length - 1] || null;
  const zeig = () => {
    const f = ordner ? datei() : null;
    st.replaceChildren(!ordner ? (DEMO ? 'In der Vorschau lässt sich keine Excel anlegen – in der Programmdatei liegt sie im Ordner der Bedarfsliste.' : 'Die Excel landet in „Downloads“. In den Ordner der Bedarfsliste legen, damit die Liste sie liest.')
      : f ? '„' + f.name + '“ liegt im Ordner der Bedarfsliste: ' + PR.list.length + ' Personen, zuletzt geändert am ' + lmText(f) + ' Uhr.' + (PR.files.length > 1 ? ' Dazu ' + (PR.files.length - 1) + ' weitere Fassung(en) – die neueste gilt.' : '')
      : 'Noch keine Personen-Excel. Sie wird als „' + PERS_DATEI + '“ neben der Bedarfsliste angelegt – mit allen Personen, die die Liste schon kennt.');
    btn1.textContent = ordner ? (f ? 'Liegt im Ordner' : 'Excel anlegen') : 'Excel herunterladen'; btn1.disabled = !!f; btn1.className = f ? '' : 'primary';
  };
  async function schritt1() {
    if (!ordner) { download(PERS_DATEI, personenBlob()); return; }
    try { const fh = await ST.htmlDir.getFileHandle(PERS_DATEI, { create: true }), w = await fh.createWritable(); await w.write(personenBlob()); await w.close(); }
    catch (e) { console.warn(e); toast('Die Excel konnte nicht im Ordner abgelegt werden. Sie wird stattdessen heruntergeladen.', 'warn'); download(PERS_DATEI, personenBlob()); return; }
    await personenScan(true); zeig(); toast('„' + PERS_DATEI + '“ angelegt', 'ok');
  }
  const ta = h('textarea', { class: 'rech-prompt kurz', rows: 8, spellcheck: false, 'aria-label': 'Auftrag für Copilot' });
  ta.value = personenPrompt(b);
  const kopieren = () => {
    const fail = () => { ta.focus(); ta.select(); toast('Text markiert – jetzt mit Strg+C kopieren'); };
    try { navigator.clipboard.writeText(ta.value).then(() => toast('Auftrag kopiert – in Copilot einfügen', 'ok'), fail); } catch (e) { fail(); }
  };
  // Ergebnis: was bei den Zuständigen dieses Bedarfs ergänzt wurde und wer noch nicht in der Excel steht
  const bericht = vorher => {
    const L = b.zust.filter(z => z.n.trim()), nicht = L.filter(z => !person(z.n)), neu = L.map((z, i) => [z, ZUST_F.filter(k => !(vorher[i][k] || '').trim() && (z[k] || '').trim())]).filter(x => x[1].length);
    const lab = { rolle: 'Position', mail: 'E-Mail', tel: 'Telefon', mobil: 'Handy' };
    erg.replaceChildren(
      neu.length ? h('div', null, 'Ergänzt: ' + neu.map(([z, k]) => z.n + ' (' + k.map(x => lab[x]).join(', ') + ')').join(' · ')) : h('div', null, 'Bei diesem Bedarf wurde nichts ergänzt.'),
      nicht.length ? h('div', { class: 'warn-t' }, 'Noch nicht in der Excel: ' + nicht.map(z => z.n).join(', ') + '. Copilot noch nicht fertig, OneDrive noch nicht synchronisiert – oder das Ergebnis liegt als eigene Datei vor: dann „Andere Datei wählen …“.') : null);
    safeRender();
  };
  const schritt3 = async () => {
    if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
    const vorher = b.zust.filter(z => z.n.trim()).map(z => Object.assign({}, z));
    if (ordner) { await personenScan(true); zeig(); } else { const f = await pickFile('.xlsx'); if (!f || !await personenDatei(f)) return; }
    bericht(vorher);
  };
  const andere = async () => {
    const vorher = b.zust.filter(z => z.n.trim()).map(z => Object.assign({}, z)), f = await pickFile('.xlsx');
    if (f && await personenDatei(f)) { zeig(); bericht(vorher); }
  };
  zeig();
  const body = h('div', { class: 'help rech' },
    h('p', null, 'Copilot sucht die Kontaktdaten der Zuständigen und trägt sie in eine Excel ein, die mit jedem Bedarf wächst. Die Liste liest sie und ergänzt fehlende Position, E-Mail und Telefon – Eingetragenes bleibt.'),
    h('ol', { class: 'rech-steps' },
      h('li', null, h('div', { class: 'rech-row' }, h('b', null, 'Personen-Excel'), btn1), st),
      h('li', null, h('div', { class: 'rech-row' }, h('b', null, 'Auftrag an Copilot'), h('button', { class: 'primary', onclick: kopieren }, 'Prompt kopieren')),
        h('div', { class: 'muted small' }, 'In Copilot einfügen und die Personen-Excel als Datei anhängen.'), ta),
      h('li', null, h('div', { class: 'rech-row' }, h('b', null, 'Ergebnis übernehmen'), h('span', { class: 'rech-btns' }, ordner ? h('button', { onclick: andere }, 'Andere Datei wählen …') : null, h('button', { onclick: schritt3 }, ordner ? 'Excel einlesen' : 'Excel auswählen …'))),
        h('div', { class: 'muted small' }, 'Wenn Copilot fertig ist. Die Liste liest die Excel auch von selbst, etwa jede Minute.'), erg)));
  await modal('Kontaktdaten mit Copilot', body, [['Schließen', null]], { wide: true, expose: () => setTimeout(() => { ta.setSelectionRange(0, 0); ta.scrollTop = 0; }, 60) });
}
