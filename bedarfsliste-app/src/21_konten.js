/* ===================================================================== Kontenliste der Gliederungen (ab 0.79, als Fenster ab 0.81)
   Knopf „Kontenliste“ oben neben „Bedarfe“ und „Archiv“ öffnet ein Fenster wie die Excel: je Gliederung eine Zeile, Spalten für das
   Spendenkonto (Pax-Bank, hervorgehoben), die Sparkasse und die Volksbank; oben die Suche, im Spaltenkopf die BIC (sind es in einer Spalte
   verschiedene Banken, steht die BIC beim Konto). Beim Überfahren erscheint neben der IBAN das Kopierzeichen. Die Daten kommen aus der Excel
   „Kontenliste der Gliederungen“ und stehen danach in der Bedarfsliste (D.settings.konten) – nicht im Programm. BIC und Bankname ergeben
   sich aus der IBAN (Bankleitzahl; Tabelle der Bundesbank, BIC_DE). */
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
  D.settings.konten = { stand: new Date().toISOString(), datei: f.name, liste: R.L }; changed();
  toast('Kontenliste übernommen: ' + R.L.length + ' Gliederungen', 'ok');
  return true;
}


const kontenDaten = () => { if (DEMO && !D.settings.konten && typeof demoKonten === 'function') D.settings.konten = demoKonten(); return D.settings.konten; };
const K_SPALTEN = [['Pax-Bank', 'Spendenkonto', 'Pax-Bank'], ['Sparkasse', 'Sparkasse', ''], ['Volksbank', 'Volksbank', '']];   // [Art aus der Excel, Überschrift, Zusatz]
const ICON_KOPIE = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.8A1.3 1.3 0 0 0 9.2 2.5H3.8a1.3 1.3 0 0 0-1.3 1.3v5.4a1.3 1.3 0 0 0 1.3 1.3h1.7"/></g></svg>';
const ICON_HAKEN = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// BIC im Spaltenkopf, wenn alle Konten der Spalte bei derselben Bank liegen (Pax-Bank); sonst steht sie beim Konto
function kSpalteBic(L, art) {
  const B = new Map(); for (const x of L) for (const k of x.konten) if (k.art === art) { const bk = ibanBank(k.iban); if (bk) B.set(bk[0], (B.get(bk[0]) || 0) + 1); }
  const s = [...B].sort((a, c) => c[1] - a[1]), n = s.reduce((a, x) => a + x[1], 0);
  return s.length && s[0][1] / n >= .8 ? s[0][0] : '';                // fast alle gleich: diese oben, Ausreißer beim Konto
}
function kZelle(x, art, kopfBic, haupt) {
  const k = x.konten.find(y => y.art === art); if (!k) return `<td class="k-z${haupt ? ' k-haupt' : ''}"><span class="k-leer">–</span></td>`;
  const bk = ibanBank(k.iban), ok = ibanOk(k.iban), roh = ibanRein(k.iban);
  return `<td class="k-z${haupt ? ' k-haupt' : ''}"><div class="k-iban-z"><span class="k-iban${ok ? '' : ' falsch'}"${ok ? '' : ' title="Die Prüfziffer dieser IBAN stimmt nicht – bitte in der Excel prüfen"'}>${esc(ibanSchoen(roh))}</span>`
    + `<button type="button" class="k-kopie" data-v="${esc(roh)}" title="IBAN kopieren" aria-label="IBAN von ${esc(x.gl)} (${esc(art)}) kopieren">${ICON_KOPIE}</button></div>`
    + (bk && bk[0] !== kopfBic ? `<div class="k-bic-z"><span>${esc(bk[1])}</span> · <span class="k-bic-w">BIC ${esc(bk[0])}</span><button type="button" class="k-kopie" data-v="${esc(bk[0])}" title="BIC kopieren" aria-label="BIC kopieren">${ICON_KOPIE}</button></div>` : '') + '</td>';
}
function kTabelle(K, q) {
  const L = K.liste.filter(x => !q || norm(x.gl).includes(q)), bic = K_SPALTEN.map(([art]) => kSpalteBic(K.liste, art));
  const kopf = K_SPALTEN.map(([art, t, z], i) => `<th class="${i ? '' : 'k-haupt'}"><span class="k-th">${t}${z ? ` <span class="k-th-z">${z}</span>` : ''}</span>`
    + (bic[i] ? `<span class="k-th-bic">BIC ${bic[i]}<button type="button" class="k-kopie" data-v="${bic[i]}" title="BIC kopieren" aria-label="BIC kopieren">${ICON_KOPIE}</button></span>` : '<span class="k-th-bic">BIC je Bank, beim Konto</span>') + '</th>').join('');
  const rows = L.map(x => `<tr><th scope="row" class="k-gl">${esc(x.gl)}</th>${K_SPALTEN.map(([art], i) => kZelle(x, art, bic[i], !i)).join('')}</tr>`).join('');
  return `<table class="k-tab"><thead><tr><th class="k-gl">Gliederung</th>${kopf}</tr></thead><tbody>${rows || `<tr><td colspan="${K_SPALTEN.length + 1}" class="muted k-nix">Keine Gliederung passt zu „${esc(q)}“.</td></tr>`}</tbody></table>`;
}
async function kopiereZeichen(btn) {
  let ok = true; try { await navigator.clipboard.writeText(btn.dataset.v); } catch (e) { ok = false; }
  if (!ok) { toast('Kopieren ging nicht – bitte markieren und mit Strg+C kopieren.', 'warn'); return; }
  btn.innerHTML = ICON_HAKEN; btn.classList.add('ok'); btn.title = 'kopiert';
  setTimeout(() => { btn.innerHTML = ICON_KOPIE; btn.classList.remove('ok'); btn.title = /^[A-Z]{2}\d/.test(btn.dataset.v) ? 'IBAN kopieren' : 'BIC kopieren'; }, 1400);
}
// Fenster: Suche, Tabelle, unten Stand und „Excel einlesen …“; Esc oder × schließt
async function kontenDialog() {
  closeMenus();
  const K = kontenDaten();
  if (!K || !K.liste.length) {
    if (await confirmBox('Kontenliste', 'Noch keine Kontenliste hinterlegt. Die Excel „Kontenliste der Gliederungen“ einlesen? Danach stehen hier je Gliederung die Konten mit IBAN und BIC.', 'Excel einlesen …') && await kontenEinlesen()) kontenDialog();
    return;
  }
  const such = h('input', { type: 'search', class: 'k-such', placeholder: 'Gliederung suchen, z. B. Brakel …', 'aria-label': 'Gliederung suchen' });
  const wrap = h('div', { class: 'k-wrap', html: kTabelle(K, '') });
  const zahl = h('span', { class: 'muted small' });
  const zeig = () => { const q = norm(such.value); wrap.innerHTML = kTabelle(K, q); const n = K.liste.filter(x => !q || norm(x.gl).includes(q)).length; zahl.textContent = n + ' von ' + K.liste.length + ' Gliederungen'; };
  such.addEventListener('input', zeig);
  wrap.addEventListener('click', e => { const k = e.target.closest('.k-kopie'); if (k) kopiereZeichen(k); });
  let zu = null; zeig();
  const ein = h('button', { type: 'button', class: 'link small', onclick: async () => { zu && zu(null); if (await kontenEinlesen()) kontenDialog(); } }, 'Excel einlesen …');
  const fuss = h('div', { class: 'k-fuss muted small' }, zahl, h('span', {}, ' · Stand ' + fmtStamp(K.stand) + (K.datei ? ' aus „' + K.datei + '“' : '') + ' · '), ein);
  await modal('Kontenliste der Gliederungen', h('div', { class: 'k-box' }, h('div', { class: 'k-kopf' }, such, fuss), wrap), [], { wide: true, cls: 'k-modal', expose: c => { zu = c; setTimeout(() => such.focus(), 40); } });
}
