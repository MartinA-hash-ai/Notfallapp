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
// Aufzählung sofort beim Tippen (in den Textfeldern mit Formatierung): „* “ oder „- “ am Zeilenanfang wird zu „• “; Enter setzt den
// nächsten Punkt (bzw. die nächste Nummer nach „1. “), Enter auf einem leeren Punkt beendet die Aufzählung, Rücktaste direkt hinter
// dem Punkt nimmt ihn weg. Umschalt+Enter: neue Zeile ohne Punkt. Über den Browser eingefügt, damit Strg+Z im Feld weiter geht.
function listAuto(ta) {
  const zeile = () => { const v = ta.value, p = ta.selectionStart, a = v.lastIndexOf('\n', p - 1) + 1, e = v.indexOf('\n', p); return { v, p, a, t: v.slice(a, p), rest: v.slice(p, e < 0 ? v.length : e) }; };
  const setze = (von, bis, t) => { ta.setSelectionRange(von, bis); if (!document.execCommand(t ? 'insertText' : 'delete', false, t)) ta.setRangeText(t, von, bis, 'end'); };
  ta.addEventListener('input', e => {
    if (e.inputType !== 'insertText' || e.data !== ' ') return;
    const z = zeile(); if (/^[*-] $/.test(z.t)) setze(z.a, z.p, '• ');
  });
  ta.addEventListener('keydown', e => {
    if (ta.selectionStart !== ta.selectionEnd || e.ctrlKey || e.altKey || e.metaKey) return;
    const z = zeile(), m = /^(• |(\d+)\. )/.exec(z.t);
    if (e.key === 'Enter' && !e.shiftKey && m) {
      e.preventDefault();
      if (z.t === m[0] && !z.rest.trim()) setze(z.a, z.p, '');                                  // leerer Punkt: Aufzählung endet
      else setze(z.p, z.p, '\n' + (m[2] ? +m[2] + 1 + '. ' : '• '));
    } else if (e.key === 'Backspace' && z.t === '• ') { e.preventDefault(); setze(z.a, z.p, ''); }
  });
}
function fmtText(t) {
  const links = [];
  const s = esc(String(t || '')).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, u => { links.push(u); return '\u0001' + (links.length - 1) + '\u0001'; });
  const um = (x, z, tag) => x.replace(new RegExp('(^|[\\s(„])' + z + '(?=\\S)([^' + z + '\\n]*?\\S)' + z + '(?=$|[\\s.,;:!?)“])', 'g'), '$1<' + tag + '>$2</' + tag + '>');
  const inl = x => um(um(um(x, '\\*', 'b'), '_', 'i'), '~', 's');
  const out = []; let liste = null, absatz = [];
  const zu = () => { if (absatz.length) { out.push(absatz.join('<br>')); absatz = []; } if (liste) { out.push(`<${liste.typ}>${liste.li.join('')}</${liste.typ}>`); liste = null; } };
  for (const z of s.split('\n')) {
    const m = z.match(/^\s*[*\-•]\s+(.*)$/), n = !m && z.match(/^\s*\d+[.)]\s+(.*)$/), typ = m ? 'ul' : n ? 'ol' : null;
    if (typ) { if (absatz.length || (liste && liste.typ !== typ)) zu(); if (!liste) liste = { typ, li: [] }; liste.li.push(`<li>${inl((m || n)[1])}</li>`); }
    else { if (liste) zu(); absatz.push(inl(z)); }
  }
  zu();
  return out.join('').replace(/\u0001(\d+)\u0001/g, (x, i) => `<a href="${links[i]}" target="_blank" rel="noopener" data-act="link">${links[i].replace(/^https?:\/\/(www\.)?/, '')}</a>`);
}
// Quellen: je Link eine Zeile (auch wenn sie mit „;“ oder Leerzeichen hintereinander stehen)
const quellenZeilen = t => String(t || '').replace(/\s*;\s*/g, '\n').replace(/(https?:\/\/\S+)\s+(?=https?:\/\/)/g, '$1\n').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const unquote = s => String(s).replace(/^\s*"|"\s*$/g, '');
const eur = n => Math.round(n || 0).toLocaleString('de-DE') + ' €';
const fmtNum = n => (n == null || n === '' || isNaN(n)) ? '' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: 2 });
// Zahlen deutsch eingeben: „1.500“ = 1500, „1.234,50“ = 1234,5; Ergebnis: Zahl, '' (leer) oder null (keine Zahl)
// Zahl schon beim Tippen gliedern (15000 → 15.000); der Cursor bleibt hinter derselben Ziffer
function liveNum(el) {
  const v = el.value, pos = el.selectionStart ?? v.length, vor = v.slice(0, pos).replace(/[^\d,]/g, '').length;
  if (/[^\d.,\s€]/.test(v)) return;                                            // Buchstaben: so lassen, beim Verlassen gibt es den Hinweis
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
  let s = String(t ?? '').replace(/\s|€|EUR/gi, '');
  if (!s) return '';
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
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
