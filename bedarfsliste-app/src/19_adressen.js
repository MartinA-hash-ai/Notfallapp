/* ===================================================================== Adressen als Excel und Route zur Spendenübergabe (ab 0.68)
   Excel „Adressen.xlsx“: je Gliederung, Dienststelle und die Diözesangeschäftsstelle (DGS) eine Zeile mit Straße, PLZ und Ort – ausfüllen und
   wieder einlesen (Zahnrad → „Adressen der Gliederungen …“). Gespeichert in der Bedarfsliste (D.settings.adressen: Name → „Straße, PLZ Ort“; die DGS unter „Diözese“).
   Route: Link zu Google Maps (Start: DGS oder die eigene Adresse, die nur in diesem Browser liegt) – Google zeigt Strecke und Fahrzeit.
   Eine Karte in der Liste selbst bräuchte einen Google-Schlüssel mit Abrechnung und würde Daten ohne Klick ins Internet schicken – deshalb nur der Link. */

const ADR_DATEI = 'Adressen.xlsx', ADR_BLATT = 'Adressen', ADR_ARTEN = ['DGS', 'Gliederung', 'Dienststelle'];
const ADR_SP = ['Art', 'Name', 'Straße und Hausnummer', 'PLZ', 'Ort'];
const adrTeile = a => { const m = String(a || '').match(/^(.*?),\s*(\d{4,5})\s+(.+)$/); return m ? [m[1].trim(), m[2], m[3].trim()] : [String(a || '').trim(), '', '']; };
function adressenBlob() {
  const head = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, z = { border: 'thin', v: 'top' };
  const A = D.settings.adressen || {}, zeile = (art, name) => { const t = adrTeile(A[name === 'Diözesangeschäftsstelle Paderborn' ? DIO : name]);
    return [art, name, ...t].map((v, i) => ({ v, st: z, t: i === 3 ? 'txt' : undefined })); };
  const dienst = Object.keys(A).filter(k => k !== DIO && !GL_LIST.includes(k)).sort((a, c) => a.localeCompare(c, 'de'));
  const rows = [ADR_SP.map(v => ({ v, st: head })), zeile('DGS', 'Diözesangeschäftsstelle Paderborn'), ...GL_LIST.map(g => zeile('Gliederung', g)), ...dienst.map(d => zeile('Dienststelle', d))];
  for (let i = 0; i < 30; i++) rows.push(ADR_SP.map((c, j) => ({ v: j === 0 ? 'Dienststelle' : '', st: z, t: j === 3 ? 'txt' : undefined })));
  const n = rows.length, anl = [[{ v: 'Adressen für die Bedarfsliste', st: { b: true, sz: 15 } }],
    [{ v: 'Je Gliederung, Dienststelle und für die Diözesangeschäftsstelle eine Zeile: Straße mit Hausnummer, PLZ und Ort in die eigenen Spalten. Leere Zeilen werden übergangen. '
      + 'Weitere Dienststellen unten in die freien Zeilen (Art „Dienststelle“, Name so, wie er in der Liste heißen soll). Spaltenüberschriften nicht ändern. '
      + 'Danach in der Bedarfsliste: Zahnrad → „Adressen der Gliederungen …“ → „Excel einlesen …“.', st: { wrap: true, v: 'top' } }]];
  return xlsxBlob([{ name: ADR_BLATT, cols: [16, 40, 36, 9, 24], rows, heights: { 0: 24 }, freeze: 'C2', lists: [{ ref: 'A2:A' + n, items: ADR_ARTEN }], filter: 'A1:E' + n },
    { name: 'Anleitung', cols: [110], rows: anl, heights: { 1: 64 }, grid: false }]);
}
// ausgefüllte Excel lesen → { Name: Adresse }; Name der DGS → „Diözese“, Gliederungen in ihrer Schreibweise der Liste
function adressenLesen(book) {
  const sh = book.sheets.find(s => s.rows.slice(0, 3).some(r => r.some(v => /^stra(ß|ss)e/.test(norm(v))))); if (!sh) return null;
  const hi = sh.rows.findIndex(r => r.some(v => /^stra(ß|ss)e/.test(norm(v)))), head = sh.rows[hi].map(norm);
  const ci = k => head.findIndex(t => k.test(t)), cA = ci(/^art$/), cN = ci(/^name/), cS = ci(/^stra(ß|ss)e/), cP = ci(/^plz/), cO = ci(/^ort/);
  const R = {};
  for (const r of sh.rows.slice(hi + 1)) {
    const v = i => i >= 0 ? cellStr(r[i]).trim() : '', name = v(cN), str = v(cS), plz = v(cP).replace(/\.0$/, ''), ort = v(cO);
    if (!name || !(str || ort)) continue;
    const dgs = /^dgs$/i.test(v(cA)) || /diözesangeschäftsstelle|dioezesangeschaeftsstelle|^dgs\b/i.test(name);
    const key = dgs ? DIO : GL_LIST.find(g => norm(g) === norm(name)) || name;
    R[key] = [str, [plz.padStart(plz && plz.length === 4 ? 5 : 0, '0'), ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }
  return R;
}
async function adressenEinlesen() {
  if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
  const f = await pickFile('.xlsx'); if (!f) return;
  let R = null; try { R = adressenLesen(await xlsxBook(await f.arrayBuffer())); } catch (e) { console.warn(e); }
  if (!R) { modal('Keine Adressen gefunden', h('p', null, 'In „' + f.name + '“ steht kein Blatt mit den Spalten „Name“, „Straße und Hausnummer“, „PLZ“ und „Ort“.')); return; }
  const alt = D.settings.adressen || {}, neu = Object.keys(R).filter(k => !alt[k]), geaendert = Object.keys(R).filter(k => alt[k] && alt[k] !== R[k]);
  if (!neu.length && !geaendert.length) { toast('Alle Adressen aus „' + f.name + '“ sind schon so hinterlegt.', 'ok'); return; }
  if (!await confirmBox('Adressen übernehmen?', neu.length + ' neue und ' + geaendert.length + ' geänderte Adressen aus „' + f.name + '“ übernehmen? Adressen, die in der Excel fehlen, bleiben wie sie sind.', 'Übernehmen')) return;
  D.settings.adressen = Object.assign({}, alt, R); changed(); keep(renderNow); toast((neu.length + geaendert.length) + ' Adressen übernommen', 'ok');
}

/* ---------- Route zur Spendenübergabe: Google Maps im Browser, Start an der DGS oder zu Hause */
const HEIM_KEY = 'bl-start-heim';
const heimAdresse = () => { try { return localStorage.getItem(HEIM_KEY) || ''; } catch (e) { return ''; } };
const heimSetzen = v => { try { if (v) localStorage.setItem(HEIM_KEY, v); else localStorage.removeItem(HEIM_KEY); } catch (e) { /* nur diese Sitzung */ } };
const routeUrl = (von, nach) => 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(von) + '&destination=' + encodeURIComponent(nach) + '&travelmode=driving';
async function routeOeffnen(b, ab) {
  const ziel = b.nach.ueb.ort.trim(); if (!ziel) { toast('Erst den Ort der Spendenübergabe eintragen.', 'warn'); return; }
  let von = ab === 'dgs' ? glAdresse(DIO) : heimAdresse();
  if (!von && ab === 'dgs') { toast('Erst die Adresse der Diözesangeschäftsstelle hinterlegen.', 'warn'); adressenDialog(DIO); return; }
  if (!von) { const t = await textFrage('Startadresse zu Hause', 'Deine Adresse – bleibt nur in diesem Browser, nicht in der Bedarfsliste', '', 'Straße Nr, PLZ Ort', 'Route zeigen'); if (!t || !t.trim()) return; von = t.trim(); heimSetzen(von); }
  window.open(routeUrl(von, ziel + (b.gliederung && b.gliederung !== DIO && !norm(ziel).includes(norm(b.gliederung)) ? ', ' + b.gliederung : '')), '_blank', 'noopener');
}
const routeKnoepfe = b => b.nach.ueb.ort.trim() ? `<div class="ue-route"><button type="button" class="link small" data-act="route" data-v="dgs" title="${esc(glAdresse(DIO) ? 'ab ' + glAdresse(DIO) : 'Adresse der DGS noch nicht hinterlegt')} – Google Maps">Route ab DGS</button><button type="button" class="link small" data-act="route" data-v="heim" title="${esc(heimAdresse() ? 'ab ' + heimAdresse() : 'fragt einmal nach deiner Adresse (nur dieser Browser)')} – Google Maps">Route ab zu Hause</button></div>` : '';
