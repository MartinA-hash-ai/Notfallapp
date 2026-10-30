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
const K_SPALTEN = [['Pax-Bank', 'Spendenkonto'], ['Sparkasse', 'Sparkasse'], ['Volksbank', 'Volksbank']];   // [Art aus der Excel, Überschrift]
const ICON_KOPIE = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.8A1.3 1.3 0 0 0 9.2 2.5H3.8a1.3 1.3 0 0 0-1.3 1.3v5.4a1.3 1.3 0 0 0 1.3 1.3h1.7"/></g></svg>';
const ICON_HAKEN = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// Bank einer Spalte: liegen (fast) alle sichtbaren Konten bei derselben Bank, stehen BIC und Name im Spaltenkopf – nach einer Suche meist so;
// sonst stehen sie unter der IBAN (nur bei den Konten, die von der Bank im Kopf abweichen)
function kSpalteBank(L, art) {
  const B = new Map(); for (const x of L) for (const k of x.konten) if (k.art === art) { const bk = ibanBank(k.iban); if (bk) { const y = B.get(bk[0]) || { bk, n: 0 }; y.n++; B.set(bk[0], y); } }
  const s = [...B.values()].sort((a, c) => c.n - a.n), n = s.reduce((a, x) => a + x.n, 0);
  return s.length && s[0].n / n >= .8 ? s[0].bk : null;
}
const kKopierbar = (v, cls, titel, inhalt) => `<button type="button" class="k-c ${cls}" data-v="${esc(v)}" title="${titel}">${inhalt}<span class="k-ic">${ICON_KOPIE}</span></button>`;
function kZelle(x, art, kopf, haupt, bearb) {
  const k = x.konten.find(y => y.art === art), td = `<td class="k-z${haupt ? ' k-haupt' : ''}">`;
  if (bearb) return td + `<input type="text" class="k-in" data-gl="${esc(x.gl)}" data-art="${esc(art)}" value="${esc(k ? ibanSchoen(k.iban) : '')}" placeholder="IBAN" aria-label="IBAN ${esc(x.gl)} ${esc(art)}" spellcheck="false"></td>`;
  if (!k) return td + '<span class="k-leer">–</span></td>';
  const bk = ibanBank(k.iban), ok = ibanOk(k.iban), roh = ibanRein(k.iban);
  return td + kKopierbar(roh, 'k-iban' + (ok ? '' : ' falsch'), ok ? 'Klicken: IBAN kopieren' : 'Die Prüfziffer dieser IBAN stimmt nicht – bitte prüfen', esc(ibanSchoen(roh)))
    + (bk && (!kopf || bk[0] !== kopf[0]) ? kKopierbar(bk[0], 'k-bic', 'Klicken: BIC kopieren', 'BIC ' + esc(bk[0])) + `<span class="k-bank">${esc(bk[1])}</span>` : '')
    + (!bk ? '<span class="k-bank">BIC unbekannt</span>' : '') + '</td>';
}
function kTabelle(K, q, bearb) {
  const L = K.liste.filter(x => !q || norm(x.gl).includes(q)), kopfBank = K_SPALTEN.map(([art]) => kSpalteBank(L, art));
  const kopf = K_SPALTEN.map(([art, t], i) => `<th class="${i ? '' : 'k-haupt'}"><span class="k-th">${t}</span>`
    + (kopfBank[i] && !bearb ? kKopierbar(kopfBank[i][0], 'k-bic k-th-bic', 'Klicken: BIC kopieren', 'BIC ' + kopfBank[i][0]) + `<span class="k-bank">${esc(kopfBank[i][1])}</span>` : '') + '</th>').join('');
  const zeile = x => `<tr>${bearb ? `<td class="k-gl"><div class="k-gl-z"><input type="text" class="k-in k-gl-in" data-gl="${esc(x.gl)}" value="${esc(x.gl)}" aria-label="Name der Gliederung"><button type="button" class="k-weg" data-gl="${esc(x.gl)}" title="Gliederung aus der Kontenliste entfernen" aria-label="Gliederung entfernen">×</button></div></td>` : `<th scope="row" class="k-gl">${esc(x.gl)}</th>`}${K_SPALTEN.map(([art], i) => kZelle(x, art, kopfBank[i], !i, bearb)).join('')}</tr>`;
  return `<table class="k-tab${bearb ? ' k-bearb' : ''}"><thead><tr><th class="k-gl">Gliederung</th>${kopf}</tr></thead><tbody>${L.map(zeile).join('') || `<tr><td colspan="${K_SPALTEN.length + 1}" class="muted k-nix">Keine Gliederung passt zu „${esc(q)}“.</td></tr>`}`
    + (bearb ? `<tr><td colspan="${K_SPALTEN.length + 1}"><button type="button" class="link small k-neu">+ Gliederung</button></td></tr>` : '') + '</tbody></table>';
}
async function kopiereZeichen(btn) {
  let ok = true; try { await navigator.clipboard.writeText(btn.dataset.v); } catch (e) { ok = false; }
  if (!ok) { toast('Kopieren ging nicht – bitte markieren und mit Strg+C kopieren.', 'warn'); return; }
  const ic = btn.querySelector('.k-ic'); btn.classList.add('ok'); if (ic) ic.innerHTML = ICON_HAKEN;
  setTimeout(() => { btn.classList.remove('ok'); if (ic) ic.innerHTML = ICON_KOPIE; }, 1400);
}
// Bearbeiten (Stift oben rechts): IBAN und Name der Gliederung ändern, Gliederungen dazu oder weg; die BIC ergibt sich aus der IBAN
function kontoSetzen(K, gl, art, wert) {
  const x = K.liste.find(y => y.gl === gl); if (!x) return;
  const iban = ibanRein(wert); x.konten = x.konten.filter(k => k.art !== art);
  if (iban) { x.konten.push({ art, iban }); x.konten.sort((a, c) => K_SPALTEN.findIndex(s => s[0] === a.art) - K_SPALTEN.findIndex(s => s[0] === c.art)); if (!ibanOk(iban)) toast('Die Prüfziffer dieser IBAN stimmt nicht – bitte prüfen.', 'warn'); }
  changed();
}
// Fenster: oben Suche, Stift (Bearbeiten) und ×; Esc schließt. Ohne Stift kopiert ein Klick auf IBAN oder BIC
async function kontenDialog() {
  closeMenus();
  const K = kontenDaten();
  if (!K || !K.liste.length) {
    if (DEMO) { toast('In der Vorschau gibt es keine Kontenliste.', 'warn'); return; }
    if (await confirmBox('Kontenliste', 'Noch keine Kontenliste hinterlegt. Die Excel „Kontenliste der Gliederungen“ einlesen? (Später geht das über das Zahnrad → „Kontenliste einlesen …“.)', 'Excel einlesen …') && await kontenEinlesen()) kontenDialog();
    return;
  }
  let bearb = false;
  const such = h('input', { type: 'search', class: 'k-such', placeholder: 'Gliederung suchen, z. B. Brakel …', 'aria-label': 'Gliederung suchen' });
  const wrap = h('div', { class: 'k-wrap' });
  const zeig = () => { wrap.innerHTML = kTabelle(K, norm(such.value), bearb); };
  const stift = h('button', { type: 'button', class: 'k-stift', title: 'Kontenliste bearbeiten', 'aria-label': 'Kontenliste bearbeiten', 'aria-pressed': 'false', html: ICON_PEN, onclick: () => {
    bearb = !bearb; stift.classList.toggle('on', bearb); stift.setAttribute('aria-pressed', String(bearb)); stift.title = bearb ? 'Bearbeiten beenden' : 'Kontenliste bearbeiten'; zeig(); } });
  such.addEventListener('input', zeig);
  wrap.addEventListener('click', e => {
    const c = e.target.closest('.k-c'); if (c && !bearb) { kopiereZeichen(c); return; }
    const w = e.target.closest('.k-weg'); if (w) { K.liste = K.liste.filter(x => x.gl !== w.dataset.gl); changed(); zeig(); return; }
    if (e.target.closest('.k-neu')) { let n = 'Neue Gliederung', i = 2; while (K.liste.some(x => x.gl === n)) n = 'Neue Gliederung ' + i++; K.liste.push({ gl: n, konten: [] }); changed(); such.value = ''; zeig();
      const f = wrap.querySelector(`.k-gl-in[data-gl="${CSS.escape(n)}"]`); if (f) { f.focus(); f.select(); } }
  });
  wrap.addEventListener('change', e => {
    const f = e.target; if (!f.classList.contains('k-in')) return;
    if (f.classList.contains('k-gl-in')) { const x = K.liste.find(y => y.gl === f.dataset.gl), v = f.value.trim(); if (x && v && !K.liste.some(y => y !== x && y.gl === v)) { x.gl = v; changed(); } zeig(); return; }
    kontoSetzen(K, f.dataset.gl, f.dataset.art, f.value); f.value = ibanSchoen(f.value);
  });
  zeig();
  await modal('Kontenliste der Gliederungen', h('div', { class: 'k-box' }, h('div', { class: 'k-kopf' }, such), wrap), [], { wide: true, cls: 'k-modal', kopf: stift, expose: () => setTimeout(() => such.focus(), 40) });
}
