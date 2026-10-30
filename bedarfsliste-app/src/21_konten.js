/* ===================================================================== Kontenliste der Gliederungen (ab 0.79)
   Reiter „Kontenliste“ neben „Bedarfe“ und „Archiv“: je Gliederung ihre Konten (Pax-Bank, BKC, Sparkasse, Volksbank) mit IBAN und BIC,
   oben die Suche nach Gliederung bzw. Ort. Die Daten kommen aus der Excel „Kontenliste der Gliederungen“ (ein Blatt mit „Gliederung / Standort“
   und je Bank einer Spalte „…-Konto“) und stehen danach in der Bedarfsliste (D.settings.konten) – nicht im Programm.
   Die BIC und der Name der Bank ergeben sich aus der IBAN (Bankleitzahl; Tabelle der Bundesbank, BIC_DE). Klick auf IBAN oder BIC kopiert sie. */
const KONTO_ART = { pax: 'Pax-Bank', bkc: 'BKC', spk: 'Sparkasse', voba: 'Volksbank' };
const kontoArt = t => { const s = String(t || '').replace(/[-\s]*(konto|iban)$/i, '').trim(); return KONTO_ART[norm(s)] || s; };
const ibanRein = v => String(v ?? '').replace(/\s+/g, '').toUpperCase();
const ibanSchoen = v => ibanRein(v).replace(/(.{4})/g, '$1 ').trim();
const ibanRest = s => { let m = 0; for (const ch of s.replace(/[A-Z]/g, c => c.charCodeAt(0) - 55)) m = (m * 10 + +ch) % 97; return m; };
const ibanOk = v => { const s = ibanRein(v); return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s) && (!s.startsWith('DE') || s.length === 22) && ibanRest(s.slice(4) + s.slice(0, 4)) === 1; };
const ibanBank = v => { const s = ibanRein(v); return s.startsWith('DE') && BIC_DE[s.slice(4, 12)] || null; };   // [BIC, Name der Bank]
const ibanBauen = (blz, kto) => { const b = blz + String(kto).padStart(10, '0'); return 'DE' + String(98 - ibanRest(b + 'DE00')).padStart(2, '0') + b; };   // für Beispieldaten

// Excel lesen: das Blatt mit den meisten Konten (eine „Kontensuche“ mit Formeln wiederholt nur einen Teil) → { L: [{ gl, konten: [{ art, iban }] }], n, blatt }
function kontenLesen(book) {
  let best = null;
  for (const sh of book.sheets) {
    const istKopf = r => r.some(v => /gliederung|standort/.test(norm(cellStr(v)))) && r.some(v => /konto|iban/.test(norm(cellStr(v))));
    const hi = sh.rows.findIndex(istKopf); if (hi < 0) continue;
    const head = sh.rows[hi].map(v => cellStr(v).trim()), cG = head.findIndex(t => /gliederung|standort/i.test(t));
    const cK = head.map((t, i) => i !== cG && /konto|iban/i.test(t) ? i : -1).filter(i => i >= 0);
    const L = [];
    for (const r of sh.rows.slice(hi + 1)) {
      const roh = cellStr(r[cG]).trim(); if (!roh || istKopf(r)) continue;
      const gl = GL_LIST.find(g => norm(g) === norm(roh)) || roh;
      const konten = cK.map(i => ({ art: kontoArt(head[i]), iban: ibanRein(cellStr(r[i])) })).filter(k => k.iban && /^[A-Z]{2}\d/.test(k.iban));
      if (!L.some(x => x.gl === gl)) L.push({ gl, konten });
    }
    const n = L.reduce((a, x) => a + x.konten.length, 0);
    if (n && (!best || n > best.n)) best = { L, n, blatt: sh.name };
  }
  return best;
}
async function kontenEinlesen() {
  if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
  const f = await pickFile('.xlsx,.xlsm'); if (!f) return;
  let R = null; try { R = kontenLesen(await xlsxBook(await f.arrayBuffer())); } catch (e) { console.warn(e); }
  if (!R) { modal('Keine Kontenliste gefunden', h('p', {}, 'In „' + f.name + '“ steht kein Blatt mit einer Spalte „Gliederung“ und Spalten für die Konten (z. B. „PAX-Konto“, „SPK-Konto“).')); return; }
  const falsch = R.L.flatMap(x => x.konten.filter(k => !ibanOk(k.iban)).map(k => x.gl + ' (' + k.art + ')')), alt = D.settings.konten;
  const text = R.L.length + ' Gliederungen mit ' + R.n + ' Konten aus „' + f.name + '“ (Blatt „' + R.blatt + '“)'
    + (alt ? ' – ersetzt die bisherige Kontenliste vom ' + fmtStamp(alt.stand) : '') + '.'
    + (falsch.length ? ' Achtung, bei diesen stimmt die Prüfziffer der IBAN nicht: ' + falsch.join(', ') + '.' : '');
  if (!await confirmBox('Kontenliste übernehmen?', text, 'Übernehmen')) return;
  D.settings.konten = { stand: new Date().toISOString(), datei: f.name, liste: R.L }; changed(); keep(renderNow);
  toast('Kontenliste übernommen: ' + R.L.length + ' Gliederungen', 'ok');
}

const kontenDaten = () => { if (DEMO && !D.settings.konten && typeof demoKonten === 'function') D.settings.konten = demoKonten(); return D.settings.konten; };
const kontenTreffer = (x, q) => !q || norm(x.gl).includes(q) || x.konten.some(k => norm(k.art).includes(q) || (ibanBank(k.iban) || ['', ''])[1].toLowerCase().includes(q));
function kontenBar() {
  const K = kontenDaten(), n = K ? K.liste.filter(x => kontenTreffer(x, norm(UI.kq))).length : 0;
  return `<div class="subbar list-head konten-head">
      <span class="muted" id="konten-count">${K ? n + ' von ' + K.liste.length + ' Gliederungen' : ''}</span>
      <div class="tools">${K ? `<span class="muted small">Stand ${esc(fmtStamp(K.stand))}${K.datei ? ' · ' + esc(K.datei) : ''}</span>` : ''}
        <button data-act="konten-ein" title="Excel „Kontenliste der Gliederungen“ einlesen – ersetzt die bisherige Liste">Excel einlesen …</button>
        <input type="search" id="kq" data-ui="kq" value="${esc(UI.kq || '')}" placeholder="Gliederung oder Ort …" aria-label="Gliederung oder Ort suchen (Strg+F)"></div>
    </div>`;
}
function kontenKarten() {
  const K = kontenDaten(), q = norm(UI.kq), L = K.liste.filter(x => kontenTreffer(x, q));
  if (!L.length) return '<p class="empty">Keine Gliederung passt zur Suche.</p>';
  return L.map(x => `<section class="card k-gl"><h3 class="k-gl-n">${esc(x.gl)}</h3>${x.konten.length ? `<div class="k-konten">${x.konten.map(k => {
    const bk = ibanBank(k.iban), ok = ibanOk(k.iban);
    return `<div class="k-konto"><div class="k-art">${esc(k.art)}${bk ? `<span class="muted small k-bank">${esc(bk[1])}</span>` : ''}</div>
      <button type="button" class="k-iban${ok ? '' : ' falsch'}" data-act="konto-kopie" data-v="${esc(ibanRein(k.iban))}" title="${ok ? 'Klicken: IBAN kopieren' : 'Die Prüfziffer dieser IBAN stimmt nicht – bitte in der Excel prüfen'}">${esc(ibanSchoen(k.iban))}</button>
      ${bk ? `<button type="button" class="k-bic" data-act="konto-kopie" data-v="${esc(bk[0])}" title="Klicken: BIC kopieren">${esc(bk[0])}</button>` : '<span class="k-bic muted small" title="Bank nicht in der Bankleitzahlen-Tabelle">BIC unbekannt</span>'}</div>`; }).join('')}</div>`
    : '<p class="muted small">Kein Konto eingetragen.</p>'}</section>`).join('');
}
function kontenView() {
  const K = kontenDaten();
  if (!K || !K.liste.length) return `<main class="konten"><section class="card k-leer"><h2>Kontenliste</h2><p>Noch keine Kontenliste hinterlegt. Die Excel „Kontenliste der Gliederungen“ einlesen – danach stehen hier je Gliederung die Konten mit IBAN und BIC.</p><button class="primary" data-act="konten-ein">Excel einlesen …</button></section></main>`;
  return `<main class="konten"><div class="k-grid" id="k-body">${kontenKarten()}</div></main>`;
}
async function kontoKopieren(v) {
  try { await navigator.clipboard.writeText(v); toast(v + ' kopiert', 'ok'); } catch (e) { toast('Kopieren ging nicht – bitte markieren und mit Strg+C kopieren.', 'warn'); }
}
// Strg+F in der Kontenliste: in die Suche; Enter darin: nichts weiter (die Liste filtert beim Tippen)
document.addEventListener('keydown', e => {
  if (UI.view !== 'konten' || e.defaultPrevented || $('.modal')) return;
  if (taste(e, 'l-suche')) { const q = $('#kq'); if (q && document.activeElement !== q) { e.preventDefault(); q.focus(); q.select(); } }
});
