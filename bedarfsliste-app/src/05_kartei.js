/* ===================================================================== Förder-Kartei: die Excel „Banken- und Stiftungsübersicht“ aus dem Ordner (nur lesen)
   Die Kartei wird weiter in Excel gepflegt. Die Liste liest sie beim Öffnen, beim Zurückkehren ins Fenster und etwa jede Minute neu ein,
   sobald sich die Datei geändert hat. Erkannt wird je Blatt die Kopfzeile mit „Gliederung“; die Namensspalte ist die Spalte links davon
   mit den meisten verschiedenen Einträgen. Verbundene Zellen (eine Bank für mehrere Gliederungen) gelten für alle ihre Zeilen. */

const KR = { list: [], byKey: new Map(), name: '', stamp: null, at: null, err: null, cut: false, busy: false, cands: [] };
const KARTEI_RE = /(bank|banken|stiftung|kartei|f(ö|oe)rderer)/i;
// Schlüssel für Namen: „e.V.“ = „e. V.“, Striche und Leerzeichen um sie gleich, weiche Trennzeichen und Anführungszeichen weg, Titel (Dr., Prof.) weg
const kkey = s => norm(String(s ?? '').normalize('NFC').replace(/\u00ad/g, '').replace(/[‐‑‒–—]/g, '-'))
  .replace(/[„“"'’‚‘]/g, '').replace(/\b(dr|prof)\.\s*/g, '').replace(/\be\.\s*v\.?(?=\s|$)/g, 'ev').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
// Summen-, Hinweis- und Standzeilen unter einer Tabelle sind keine Einträge
const KEINE_ZEILE = /^(summe|zwischensumme|gesamt|gesamtsumme|insgesamt|total|hinweis|hinweise|anmerkung|anmerkungen|stand\b|quelle|quellen|fazit|ergebnis|legende)\b/i;
const istEintrag = name => !!name && name.length <= 150 && !KEINE_ZEILE.test(name);
const kartei = name => KR.byKey.get(kkey(name)) || null;
const truthy = v => v === true || v === 1 || /^(x|ja|wahr|true|1|✓)$/i.test(String(v ?? '').trim());
const cellStr = v => v === true ? 'ja' : v === false ? '' : String(v ?? '').trim();

function karteiSet(list) {
  KR.list = list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  KR.byKey = new Map(list.map(k => [kkey(k.name), k]));
}
async function karteiScan(force) {
  if (DEMO || KR.busy || ST.conn !== 'ok' || !ST.htmlDir) return;
  KR.busy = true;
  try {
    const cands = [];
    for await (const [n, e] of ST.htmlDir.entries()) if (e.kind === 'file' && /\.xlsx$/i.test(n) && !/^~\$/.test(n)) cands.push([n, e]);
    KR.cands = cands.map(c => c[0]).sort((a, b) => a.localeCompare(b, 'de'));
    const want = D.settings.kartei;
    // Konfliktkopien von OneDrive („…-LAPTOP.xlsx“, „… (1).xlsx“) nicht dem Original vorziehen
    const stem = n => n.replace(/\.xlsx$/i, ''), kopie = n => cands.some(([m]) => m !== n && (stem(n).startsWith(stem(m) + '-') || stem(n).startsWith(stem(m) + ' (')));
    let hit = want ? cands.find(([n]) => n === want) : cands.filter(([n]) => KARTEI_RE.test(n) && !/vorlage|f(ö|oe)rderplan|recherche/i.test(n)).sort(([a], [c]) => kopie(a) - kopie(c))[0];
    if (!hit) {
      const err = want ? '„' + want + '“ liegt nicht mehr im Ordner' : null;
      if (KR.list.length || KR.err !== err) { karteiSet([]); KR.name = ''; KR.stamp = null; KR.err = err; safeRender(); }
      return;
    }
    const f = await hit[1].getFile();
    if (!force && KR.name === hit[0] && KR.stamp === f.lastModified && !KR.err) return;
    const book = await xlsxBook(await f.arrayBuffer(), { max: 4e6 });
    const L = parseKartei(book);
    karteiSet(L);
    KR.name = hit[0]; KR.stamp = f.lastModified; KR.at = new Date(); KR.cut = book.sheets.some(s => s.cut);
    KR.err = L.length ? null : 'in „' + hit[0] + '“ keine Tabelle mit einer Spalte „Gliederung“ gefunden';   // statt still 0 Förderer
    safeRender();
  } catch (e) {
    console.warn(e);
    const msg = e && e.name === 'NotReadableError' ? 'gerade nicht lesbar (in Excel geöffnet oder wird synchronisiert?) – neuer Versuch in einer Minute' : (e && e.message) || String(e);
    if (KR.err !== msg) { KR.err = msg; safeRender(); }
  } finally { KR.busy = false; }
}
function parseKartei(book) {
  const out = new Map();
  for (const sh of book.sheets) {
    if (sh.hidden) continue;                                                       // ausgeblendete Blätter (z. B. ein altes Archiv) nicht mitlesen
    const istGl = v => /^gliederung/.test(norm(v));                                // auch „Gliederungen“, „Gliederung(en)“
    const rows = sh.rows, hi = rows.findIndex(r => r.some(istGl));
    if (hi < 0) continue;
    const head = rows[hi].map(norm), gi = head.findIndex(istGl);
    let ni = -1, best = 0;
    for (let c = 0; c < gi; c++) {
      const s = new Set(); for (let r = hi + 1; r < rows.length; r++) { const v = rows[r][c]; if (typeof v === 'string' && v.trim()) s.add(v.trim()); }
      if (s.size > best) { best = s.size; ni = c; }
    }
    if (ni < 0) continue;
    // Spalten rechts von „Gliederung“ zuordnen; „Mail“/„Telefon“ gehören zum Kontakt links davon
    const col = { years: [] }, kontakte = []; let curK = null;
    const above = c => { for (let r = hi - 1; r >= 0; r--) for (let k = c; k >= 0; k--) { const v = String(rows[r][k] ?? ''); if (/anschreiben/i.test(v)) return v; } return ''; };
    head.forEach((t, c) => {
      if (c <= gi) return;
      if (/^(kontakt|ansprech)/.test(t)) { curK = { n: c, hint: above(c) }; kontakte.push(curK); }
      else if (/^(e-?)?mail$/.test(t)) { if (curK) { if (curK.m == null) curK.m = c; } else if (col.perMail == null) col.perMail = c; }
      else if (/^tel/.test(t)) { if (curK && curK.t == null) curK.t = c; }
      else if (t === 'direkt') col.direkt = c;
      else if (t === 'portal') col.portal = c;
      else if (/notiz/.test(t)) col.notiz = c;
      else if (/schwerpunkt|zweck/.test(t)) col.schwer = c;
      else if (/homepage|website|internet/.test(t)) col.web = c;
      else if (/^(19|20)\d\d$/.test(t)) col.years.push([t, c]);
    });
    let cur = null;
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r], name = ohnePlatzhalter(cellStr(row[ni])), gl = ohnePlatzhalter(cellStr(row[gi]));
      if (name && !istEintrag(name)) { cur = null; continue; }                    // Summen-, Hinweis- oder Standzeile
      if (name) {
        const k = kkey(name);
        cur = out.get(k) || { name, blatt: sh.name, gl: [], kontakte: [], hist: {}, weg: [], notiz: '', schwer: '', web: '' };
        out.set(k, cur);
      } else if (!gl) continue;                   // Leerzeile
      if (!cur) continue;
      if (gl && !cur.gl.includes(gl)) cur.gl.push(gl);
      if (col.direkt != null && truthy(row[col.direkt]) && !cur.weg.includes('direkt')) cur.weg.push('direkt');
      if (col.perMail != null && truthy(row[col.perMail]) && !cur.weg.includes('per Mail')) cur.weg.push('per Mail');
      if (col.portal != null && truthy(row[col.portal]) && !cur.weg.includes('Portal')) cur.weg.push('Portal');
      for (const [f, c] of [['notiz', col.notiz], ['schwer', col.schwer]]) if (c != null && !cur[f]) cur[f] = ohnePlatzhalter(cellStr(row[c]));
      if (col.web != null && !cur.web) cur.web = ohnePlatzhalter(zelleMitLink(sh, r, col.web));
      for (const kc of kontakte) {
        const n = ohnePlatzhalter(cellStr(row[kc.n])); if (!n) continue;
        if (cur.kontakte.some(x => x.n === n)) continue;
        cur.kontakte.push({ n, m: kc.m != null ? mailText(row[kc.m]) : '', t: kc.t != null ? telText(row[kc.t]) : '', nicht: /nicht/i.test(kc.hint) });
      }
      for (const [y, c] of col.years) {
        const v = cellStr(row[c]); if (!v) continue;
        if (!cur.hist[y]) cur.hist[y] = v; else if (!cur.hist[y].includes(v)) cur.hist[y] += '\n' + v;
      }
    }
  }
  return [...out.values()];
}
async function karteiChoose() {
  if (ST.conn !== 'ok') { if (!await connectFolder()) return; }
  await karteiScan(true);
  const cands = KR.cands;
  let pick = D.settings.kartei || KR.name || '';
  const body = h('div', { class: 'help' },
    h('p', null, 'Welche Excel im Ordner ist deine Förder-Kartei? Die Liste liest sie nur – gepflegt wird weiter in Excel.'),
    cands.length ? h('div', { class: 'radios' }, ...cands.map(n => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'kartei', value: n, checked: n === pick, onchange: () => { pick = n; } }), n)))
      : h('p', { class: 'muted' }, 'Im Ordner liegt noch keine Excel-Datei. Lege die Kartei in den Ordner der Bedarfsliste und öffne dieses Fenster erneut.'),
    h('label', { class: 'check' }, h('input', { type: 'radio', name: 'kartei', value: '', checked: !D.settings.kartei, onchange: () => { pick = ''; } }), 'automatisch erkennen (Dateiname mit „Bank“, „Stiftung“ oder „Kartei“)'));
  const ok = await modal('Förder-Kartei wählen', body, [['Abbrechen', false], ['Übernehmen', true, 'primary']]);
  if (!ok) return;
  if (pick === '' && !D.settings.kartei) { await karteiScan(true); renderNow(); return; }
  D.settings.kartei = pick; changed(); KR.stamp = null; await karteiScan(true); renderNow();
}
