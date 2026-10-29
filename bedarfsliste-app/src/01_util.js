'use strict';
/* ===================================================================== Hilfsfunktionen: Datum, Zahlen, Text, DOM, Dialoge */

const z2 = n => String(n).padStart(2, '0');
const isoDate = d => d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate());
const today = () => isoDate(new Date());
const validIso = s => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false; const d = new Date(s + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === s; };
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const fmtDate = s => validIso(s) ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : '';
const fmtStamp = iso => { if (!iso) return 'unbekannt'; const d = new Date(iso); return d.toLocaleDateString('de-DE') + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'; };
function rel(d) {
  const n = days(today(), d);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === -1) return 'seit gestern überfällig';
  if (n < 0) return 'seit ' + (-n) + ' Tagen überfällig';
  return n > 60 ? 'in ' + Math.round(n / 30.4) + ' Monaten' : 'in ' + n + ' Tagen';
}
// Platzhalter, wie Copilot sie gern einträgt, gelten als leer („nicht gefunden“, „k. A.“, „–“ …)
const LEER_RE = /^(nicht gefunden|nicht bekannt|nicht verfügbar|nicht ermittelbar|keine angabe|keine angaben|k\.?\s?a\.?|n\.?\s?a\.?|n\/a|unbekannt|tbd|\?+|[-–—]+)$/i;
const ohnePlatzhalter = s => { const t = String(s ?? '').trim(); return LEER_RE.test(t) ? '' : t; };
// Telefonnummer aus Excel: als Zahl gespeichert verliert sie die führende 0 (5251123456 → 05251123456)
const telText = v => { if (typeof v === 'number') { const s = String(Math.round(v)); return /^[1-9]\d{6,12}$/.test(s) ? '0' + s : s; } const t = ohnePlatzhalter(v); return /\d/.test(t) ? t : ''; };
const mailText = v => { const t = ohnePlatzhalter(v); return /@/.test(t) ? t : ''; };
// Datum aus Excel oder Text: Excel-Zahl, „TT.MM.JJJJ“, „TT.MM.JJ“ oder „JJJJ-MM-TT“ → „JJJJ-MM-TT“ (sonst '')
function anyDate(v) {
  if (typeof v === 'number') return v > 20000 && v < 80000 ? new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10) : '';
  const s = String(v ?? '').trim(); let q;
  if ((q = /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/.exec(s))) { const r = (q[3].length === 2 ? '20' + q[3] : q[3]) + '-' + z2(q[2]) + '-' + z2(q[1]); return validIso(r) ? r : ''; }
  if ((q = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) { const r = q[1] + '-' + z2(q[2]) + '-' + z2(q[3]); return validIso(r) ? r : ''; }
  return '';
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// einfache Formatierung wie in Chat-Programmen: Zeilen mit „* “ oder „- “ werden Aufzählungen, „1. “ eine Nummerierung;
// *fett*, _kursiv_, ~durchgestrichen~ (wie bei WhatsApp); Links werden anklickbar. Alles andere bleibt Text.
/* ---------- Texte mit einfacher Formatierung. Gespeichert wird schlichter Text mit Zeichen: *fett*, _kursiv_, +unterstrichen+, ~durchgestrichen~,
   „• “ bzw. „- “ oder „* “ am Zeilenanfang = Aufzählung, „1. “ = Nummerierung; Links werden anklickbar. Die Zeichen gelten nur am Wortrand –
   auch verschachtelt (*+so+*): davor/danach darf ein anderes Zeichen oder eine schon gesetzte Formatierung stehen. */
const fmtUm = (x, z, tag) => x.replace(new RegExp('(^|[\\s(„>*_~+])' + z + '(?=\\S)([^' + z + '\\n]*?\\S)' + z + '(?=$|[\\s.,;:!?)“<*_~+])', 'g'), '$1<' + tag + '>$2</' + tag + '>');
const fmtInl = x => fmtUm(fmtUm(fmtUm(fmtUm(x, '\\*', 'b'), '_', 'i'), '~', 's'), '\\+', 'u');
// Nummerierung nur, wenn sie bei 1 beginnt und lückenlos weiterzählt – „31. März: Antragsschluss“ oder „2. Halbjahr“ am Zeilenanfang
// bleiben Text (sonst würde daraus „1. März“); nach „1. “ ein Monatsname ist ein Datum, keine Nummer
const MONAT = /^(jan|feb|mär|maer|apr|mai|jun|jul|aug|sep|okt|nov|dez)/i;
// edit: für das Schreibfeld – je Zeile ein Block, Links als Text
function fmtText(t, edit) {
  const links = [];
  const s = esc(String(t || '')).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, u => { links.push(u); return '\u0001' + (links.length - 1) + '\u0001'; });
  const out = []; let liste = null, absatz = [];
  const zu = () => { if (absatz.length) { out.push(absatz.join(edit ? '' : '<br>')); absatz = []; } if (liste) { out.push(`<${liste.typ}>${liste.li.join('')}</${liste.typ}>`); liste = null; } };
  for (const z of s.split('\n')) {
    const m = z.match(/^\s*[*\-•]\s+(.*)$/);
    let n = !m && z.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (n && (MONAT.test(n[2]) || +n[1] !== (liste && liste.typ === 'ol' ? liste.n + 1 : 1))) n = null;
    const typ = m ? 'ul' : n ? 'ol' : null;
    if (typ) { if (absatz.length || (liste && liste.typ !== typ)) zu(); if (!liste) liste = { typ, li: [], n: 0 }; if (n) liste.n = +n[1]; liste.li.push(`<li>${fmtInl(m ? m[1] : n[2]) || (edit ? '<br>' : '')}</li>`); }
    else { if (liste) zu(); absatz.push(edit ? `<div>${fmtInl(z) || '<br>'}</div>` : fmtInl(z)); }
  }
  zu();
  return out.join('').replace(/\u0001(\d+)\u0001/g, (x, i) => edit ? links[i] : `<a href="${links[i]}" target="_blank" rel="noopener" data-act="link">${links[i].replace(/^https?:\/\/(www\.)?/, '')}</a>`);
}
// Schreibfeld zurück in Text mit Zeichen: je Zeile Abschnitte mit ihrer Formatierung; Formatierung, die mitten im Wort beginnt oder endet,
// gilt für das ganze Wort (sonst würden die Zeichen nicht wirken). Fett usw. kommt als <b>, <i>, <u>, <s>/<strike> oder als Stil.
const RICH_Z = { B: '*', STRONG: '*', I: '_', EM: '_', U: '+', INS: '+', S: '~', STRIKE: '~', DEL: '~' }, Z_ORD = '*_+~', WZ = /[\p{L}\p{N}]/u;
function richText(root) {
  const lines = [[]]; let neu = false;
  const zeile = () => { lines.push([]); neu = false; };
  const block = n => /^(DIV|P|LI|UL|OL|H[1-6]|BLOCKQUOTE)$/.test(n.nodeName);
  const geh = (n, f, pre) => {
    if (n.nodeType === 3) {
      if (!n.nodeValue) return; if (neu) zeile();
      n.nodeValue.replace(/\u00a0/g, ' ').split('\n').forEach((t, i) => { if (i) zeile(); if (t) lines[lines.length - 1].push({ t, f }); });
      return;
    }
    if (n.nodeType !== 1) return;
    if (n.nodeName === 'BR') { if (!(n.parentNode !== root && block(n.parentNode) && !n.nextSibling)) zeile(); return; }   // <br> am Ende eines Blocks hält ihn nur offen
    if (n.nodeName === 'UL' || n.nodeName === 'OL') { let k = 0; for (const c of n.childNodes) geh(c, f, c.nodeName === 'LI' ? (n.nodeName === 'OL' ? ++k + '. ' : '• ') : ''); neu = true; return; }
    if (block(n)) {
      if (neu || lines[lines.length - 1].length) zeile();
      if (pre) lines[lines.length - 1].push({ t: pre, f: '', pre: true });
      for (const c of n.childNodes) geh(c, f);
      neu = true; return;
    }
    let z = RICH_Z[n.nodeName] || ''; const st = n.style;
    if (st) { const td = st.textDecorationLine || st.textDecoration || ''; if (/^(bold|bolder|[6-9]00)$/.test(st.fontWeight)) z += '*'; if (st.fontStyle === 'italic') z += '_'; if (/underline/.test(td)) z += '+'; if (/line-through/.test(td)) z += '~'; }
    const f2 = [...new Set(f + z)].sort((a, b) => Z_ORD.indexOf(a) - Z_ORD.indexOf(b)).join('');
    for (const c of n.childNodes) geh(c, f2);
  };
  for (const c of root.childNodes) geh(c, '');
  const ser = runs => {
    let out = ''; const st = [];
    const schliessen = m => { const ws = /\s*$/.exec(out)[0]; out = out.slice(0, out.length - ws.length) + m + ws; };
    for (const r of runs) {
      let t = r.t;
      if (r.pre) { out += t; continue; }
      const k = st.findIndex(m => !r.f.includes(m));
      if (k >= 0) {
        if (WZ.test(out.slice(-1)) && WZ.test(t[0] || '')) { const w = /^[\p{L}\p{N}]+/u.exec(t)[0]; out += w; t = t.slice(w.length); }
        while (st.length > k) schliessen(st.pop());
      }
      if (!t.trim()) { out += t; continue; }
      const lead = /^\s*/.exec(t)[0]; out += lead; t = t.slice(lead.length);
      const auf = [...r.f].filter(m => !st.includes(m));
      if (auf.length) { const w = !lead && WZ.test(t[0]) ? (/[\p{L}\p{N}]+$/u.exec(out) || [''])[0] : ''; out = out.slice(0, out.length - w.length) + auf.join('') + w; st.push(...auf); }
      out += t;
    }
    while (st.length) schliessen(st.pop());
    return out;
  };
  return lines.map(ser).join('\n').replace(/\s+$/, '');
}
// Schreibfeld mit sichtbarer Formatierung: über einer Markierung eine Leiste (fett, kursiv, unterstrichen, durchgestrichen, Aufzählung),
// Strg+B, Strg+I, Strg+U; angefangene Wörter werden ganz formatiert. „* “ oder „- “ am Zeilenanfang wird sofort zum Punkt, „1. “ zur Nummer.
// In einer Aufzählung setzt Umschalt+Enter den nächsten Punkt, Enter geht in eine Zeile ohne Punkt (wie in Teams). Eingefügtes kommt als
// schlichter Text. Gibt eine Funktion zurück, die die Leiste schließt.
const FMT_KNOPF = [['*', '<b>B</b>', 'Fett (Strg+B)', 'bold'], ['_', '<i>I</i>', 'Kursiv (Strg+I)', 'italic'], ['+', '<u>U</u>', 'Unterstrichen (Strg+U)', 'underline'], ['~', '<s>S</s>', 'Durchgestrichen', 'strikeThrough'],
  ['•', '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="3" cy="4" r="1.3" fill="currentColor"/><circle cx="3" cy="8" r="1.3" fill="currentColor"/><circle cx="3" cy="12" r="1.3" fill="currentColor"/><path d="M6.5 4h7M6.5 8h7M6.5 12h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>', 'Aufzählung', 'insertUnorderedList']];
function richEdit(ed) {
  const sel = () => getSelection();
  const cmd = c => document.execCommand(c, false, null);
  const wortGanz = () => {                          // Markierung auf ganze Wörter erweitern – mitten im Wort wirken die Zeichen nicht
    const s = sel(); if (!s.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0);
    if (r.startContainer.nodeType === 3) { const t = r.startContainer.nodeValue; let o = r.startOffset; while (o > 0 && WZ.test(t[o - 1]) && WZ.test(t[o] || '')) o--; r.setStart(r.startContainer, o); }
    if (r.endContainer.nodeType === 3) { const t = r.endContainer.nodeValue; let o = r.endOffset; while (o < t.length && WZ.test(t[o]) && WZ.test(t[o - 1] || '')) o++; r.setEnd(r.endContainer, o); }
    s.removeAllRanges(); s.addRange(r);
  };
  const anwenden = k => { if (k[3] !== 'insertUnorderedList') wortGanz(); cmd(k[3]); };
  // Zeilenanfang: im Block um die Schreibmarke alles seit dem letzten Zeilenumbruch oder der letzten Liste
  const blockVon = node => { let n = node.nodeType === 1 ? node : node.parentNode; while (n && n !== ed && !/^(DIV|P|LI)$/.test(n.nodeName)) n = n.parentNode; return n || ed; };
  const zeilenAnfang = node => {
    const blk = blockVon(node); if (node === blk) return [blk, 0];
    let n = node; while (n && n.parentNode !== blk) n = n.parentNode; if (!n) return [blk, 0];
    let p = n.previousSibling; while (p && !(p.nodeName === 'BR' || /^(DIV|P|UL|OL)$/.test(p.nodeName))) { n = p; p = p.previousSibling; }
    return [blk, [...blk.childNodes].indexOf(n)];
  };
  const liVon = node => { const e = node && (node.nodeType === 1 ? node : node.parentNode); const li = e && e.closest('li'); return li && ed.contains(li) ? li : null; };
  // ein Punkt verlässt die Liste: sein Inhalt wird eine Zeile ohne Punkt direkt hinter der Liste (die Liste teilt sich, wenn weitere Punkte folgen)
  const ausListe = li => {
    const ul = li.parentNode, rest = [...ul.children].slice([...ul.children].indexOf(li) + 1), d = document.createElement('div');
    if (li.textContent.replace(/\u00a0/g, '').trim()) d.append(...li.childNodes); else d.append(document.createElement('br'));
    ul.after(d);
    if (rest.length) { const u2 = document.createElement(ul.nodeName); u2.append(...rest); d.after(u2); }
    li.remove(); if (!ul.children.length) ul.remove();
    const r = document.createRange(); r.setStart(d, 0); r.collapse(true); sel().removeAllRanges(); sel().addRange(r);
  };
  const amAnfang = li => { const s = sel(); if (!s.isCollapsed) return false; const r = document.createRange(); r.setStart(li, 0); r.setEnd(s.focusNode, s.focusOffset); return !r.toString().replace(/\u00a0/g, ''); };
  ed.addEventListener('input', e => {
    if (e.inputType !== 'insertText' || e.data !== ' ') return;
    const s = sel(); if (!s.rangeCount || !s.isCollapsed) return;
    if (liVon(s.focusNode)) return;
    const a = zeilenAnfang(s.focusNode);
    const r = document.createRange(); r.setStart(a[0], a[1]); r.setEnd(s.focusNode, s.focusOffset);
    const m = /^([*\-•]|1[.)]) $/.exec(r.toString().replace(/\u00a0/g, ' ')); if (!m) return;          // „1. “ beginnt eine Nummerierung, „31. “ nicht
    s.removeAllRanges(); s.addRange(r); cmd('delete');
    cmd(/\d/.test(m[1]) ? 'insertOrderedList' : 'insertUnorderedList');
  });
  ed.addEventListener('keydown', e => {
    const z = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && { b: 0, i: 1, u: 2 }[e.key.toLowerCase()];
    if (z != null && z !== false) { e.preventDefault(); anwenden(FMT_KNOPF[z]); zeig(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const li = liVon(sel().focusNode); if (!li) return;
    if (e.key === 'Backspace' && amAnfang(li)) { e.preventDefault(); ausListe(li); return; }   // Rücktaste direkt hinter dem Punkt: Punkt weg
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!li.textContent.replace(/\u00a0/g, '').trim()) { ausListe(li); return; }              // leerer Punkt: Aufzählung endet
    cmd('insertParagraph');                                                                    // nächster Punkt …
    if (!e.shiftKey) { const n = liVon(sel().focusNode); if (n) ausListe(n); }                 // … mit Enter eine Zeile ohne Punkt
  });
  ed.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
  let bar = null;
  const weg = () => { if (bar) bar.remove(); bar = null; };
  const zeig = () => {
    const s = sel();
    if (!s.rangeCount || s.isCollapsed || !ed.contains(s.anchorNode) || document.activeElement !== ed) { weg(); return; }
    if (!bar) {
      bar = h('div', { class: 'fmt-bar', role: 'toolbar', 'aria-label': 'Text formatieren' }, FMT_KNOPF.map((k, i) => h('button', { type: 'button', title: k[2], 'aria-label': k[2], html: k[1], 'data-z': k[0], 'data-i': i })));
      bar.addEventListener('mousedown', e => { e.preventDefault(); const k = e.target.closest('button'); if (k) { anwenden(FMT_KNOPF[+k.dataset.i]); setTimeout(zeig, 0); } });
      document.body.append(bar);
    }
    for (const k of bar.children) k.classList.toggle('on', document.queryCommandState(FMT_KNOPF[+k.dataset.i][3]));
    const r = s.getRangeAt(0).getBoundingClientRect();
    bar.style.left = Math.max(8, Math.min(r.left + r.width / 2 - bar.offsetWidth / 2, innerWidth - bar.offsetWidth - 8)) + 'px';
    bar.style.top = (r.top - bar.offsetHeight - 6 < 4 ? r.bottom + 6 : r.top - bar.offsetHeight - 6) + 'px';
  };
  document.addEventListener('selectionchange', zeig);
  ed.addEventListener('blur', weg);
  return () => { weg(); document.removeEventListener('selectionchange', zeig); };
}
// Quellen: je Link eine Zeile (auch wenn sie mit „;“ oder Leerzeichen hintereinander stehen)
const quellenZeilen = t => String(t || '').replace(/\s*;\s*/g, '\n').replace(/(https?:\/\/\S+)\s+(?=https?:\/\/)/g, '$1\n').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const unquote = s => String(s).replace(/^\s*"|"\s*$/g, '');
// Euro: ganze Beträge ohne, alles andere mit Cent (1.500,40 €) – vorher wurde auf ganze Euro gerundet und eine Lücke von 0,40 € hieß „0 €“
const eur = n => { const x = Math.round((+n || 0) * 100) / 100; return x.toLocaleString('de-DE', Number.isInteger(x) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0€'; };
const fmtNum = n => (n == null || n === '' || isNaN(n)) ? '' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: 2 });
// Zahlen deutsch eingeben: „1.500“ = 1500, „1.234,50“ = 1234,5; Ergebnis: Zahl, '' (leer) oder null (keine Zahl)
// Zahl schon beim Tippen gliedern (15000 → 15.000); der Cursor bleibt hinter derselben Ziffer
function liveNum(el) {
  let v = el.value; const pos = el.selectionStart ?? v.length, vor = v.slice(0, pos).replace(/[^\d,]/g, '').length;
  if (/[^\d.,\s€]/.test(v)) return;                                            // Buchstaben: so lassen, beim Verlassen gibt es den Hinweis
  const t = v.replace(/[\s€]/g, '');
  if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(t)) v = t.replace(/,/g, '').replace('.', ',');             // englisch eingefügt: 1,500.00 → 1500,00
  else if (/^\d+(\.\d{3})*\.\d{0,2}$/.test(t) && !/^\d{1,3}(\.\d{3})+$/.test(t)) return;       // Punkt mit 0–2 Ziffern dahinter: vielleicht Dezimalpunkt (1500.00) – so lassen, beim Verlassen entscheidet deNum
  const [ganz, ...rest] = v.replace(/[^\d,]/g, '').split(',');
  const out = ganz.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (rest.length ? ',' + rest.join('').slice(0, 2) : '');
  if (out === v) return;
  el.value = out;
  let n = 0, i = 0;
  while (i < out.length && n < vor) { if (/[\d,]/.test(out[i])) n++; i++; }
  try { el.setSelectionRange(i, i); } catch (e) { /* */ }
}
function deNum(t) {
  if (typeof t === 'number') return t;
  let s = String(t ?? '').replace(/\s|€|euro?/gi, '');
  if (!s) return '';
  if (s.includes(',') && s.includes('.') && s.lastIndexOf('.') > s.lastIndexOf(',')) s = s.replace(/,/g, '');      // englisch: 1,234.50
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');                                                  // englisch ohne Cent: 15,000
  else if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');                                            // deutsch: 1.234,50
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');                                              // deutsch ohne Cent: 1.500
  else if (/^\d+(\.\d{3})*\.\d{1,2}$/.test(s)) { const i = s.lastIndexOf('.'); s = s.slice(0, i).replace(/\./g, '') + s.slice(i); }   // Dezimalpunkt: 1500.00, 1.500.50
  return /^\d+(\.\d+)?$/.test(s) ? +s : null;
}
const uniq = a => [...new Set(a.filter(Boolean))];
const short = n => { n = String(n || '').trim() || '(ohne Namen)'; return n.length > 26 ? n.slice(0, 24) + '…' : n; };
const norm = v => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const uid = p => (p || 'x') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
function merge(a, b) { for (const k in b) a[k] = isObj(b[k]) && isObj(a[k]) ? merge(a[k], b[k]) : b[k]; return a; }
function getPath(o, p) { return p.split('.').reduce((x, k) => x == null ? x : x[k], o); }
function setPath(o, p, v) { const ks = p.split('.'); let x = o; for (let i = 0; i < ks.length - 1; i++) x = x[ks[i]]; x[ks[ks.length - 1]] = v; }

/* ---------- DOM */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'type']);
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (PROPS.has(k)) e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return e;
}

/* ---------- Meldungen und Dialoge */
// kind: '' | 'ok' | 'warn' | 'err'; undo: Funktion für „Rückgängig“
function toast(text, kind = '', undo = null) {
  const box = $('#toasts'); if (!box) return;
  const t = h('div', { class: 'toast ' + kind, role: 'status' }, h('span', null, text),
    undo ? h('button', { class: 'link', onclick: () => { t.remove(); undo(); } }, 'Rückgängig') : null);
  while (box.children.length >= 3) box.firstChild.remove();
  box.append(t);
  const ms = undo ? 8000 : 3800;
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}
function modal(title, body, buttons, opts = {}) {
  return new Promise(resolve => {
    const opened = Date.now();
    const close = v => { back.remove(); document.removeEventListener('keydown', key); resolve(v); };
    const key = e => { if (e.key === 'Escape') close(null); };
    const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', null, h('h2', null, title), h('button', { class: 'x', 'aria-label': 'Schließen', onclick: () => close(null) }, '×')),
      h('div', { class: 'modal-body' }, body),
      h('footer', null, (buttons || [['OK', true, 'primary']]).filter(Boolean).map(([label, val, cls]) =>
        h('button', { class: cls || '', onclick: () => close(typeof val === 'function' ? val() : val) }, label))));
    const back = h('div', { class: 'backdrop', onmousedown: e => { if (e.target === back && Date.now() - opened > 400) close(null); } }, box);
    if (opts.expose) opts.expose(close);
    document.body.append(back);
    document.addEventListener('keydown', key);
    const f = box.querySelector('footer button.primary') || box.querySelector('input,select,textarea');
    if (f) setTimeout(() => f.focus(), 30);
  });
}
// eine Frage mit Textfeld: Enter übernimmt (Umschalt+Enter: neue Zeile), Esc bricht ab → Text oder null
function textFrage(title, label, wert = '', ph = '', ja = 'Übernehmen') {
  const ta = h('textarea', { rows: 3, class: 'tf-feld', placeholder: ph, 'aria-label': label });
  ta.value = wert;
  let zu = null;
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); zu && zu(ta.value); } });
  const p = modal(title, h('div', { class: 'tf' }, h('label', { class: 'tf-l' }, label), ta), [['Abbrechen', null], [ja, () => ta.value, 'primary']], { expose: c => { zu = c; } });
  setTimeout(() => { ta.focus(); ta.select(); }, 80);
  return p;
}
const confirmBox = (title, text, yes = 'Ja', no = 'Abbrechen') => modal(title, h('p', null, text), [[no, false], [yes, true, 'primary']]).then(v => v === true);
function download(filename, blob) {
  if (DEMO) { toast('In der Vorschau lassen sich keine Dateien herunterladen. In der Programmdatei geht das.', 'warn'); return; }
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function pickFile(accept) {
  return new Promise(resolve => {
    const inp = h('input', { type: 'file', accept, style: 'display:none' });
    inp.addEventListener('change', () => { const f = inp.files[0]; inp.remove(); resolve(f || null); });
    document.body.append(inp); inp.click();
  });
}
