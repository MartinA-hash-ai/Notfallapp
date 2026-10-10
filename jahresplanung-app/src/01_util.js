'use strict';
/* ===================================================================== Hilfsfunktionen: Datum, Farbe, DOM */

const DAY = 86400000;
const p2 = v => String(v).padStart(2, '0');
// Tagesnummer (Tage seit 1970, UTC); Jahre unter 100 nicht als 19xx deuten
const mkdn = (y, m, d) => { if (y >= 100) return Math.round(Date.UTC(y, m - 1, d) / DAY); const t = new Date(0); t.setUTCFullYear(y, m - 1, d); return Math.round(t.getTime() / DAY); };
// Datumstext 'JJJJ-MM-TT' → Tagesnummer; unmögliche oder unplausible Daten (z. B. 30.02., Jahr 0027 oder 20277) ergeben null
const DATE_YMIN = 1900, DATE_YMAX = 2200;
const dn = s => {
  if (!s) return null;
  const q = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T)/.exec(String(s).trim()); if (!q) return null;
  const y = +q[1], m = +q[2], d = +q[3];
  if (y < DATE_YMIN || y > DATE_YMAX || m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
  return mkdn(y, m, d);
};
const ymd = n => { const d = new Date(n * DAY); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
const ds = n => { const [y, m, d] = ymd(n); return y + '-' + p2(m) + '-' + p2(d); };
const todayDn = () => { const t = new Date(); return mkdn(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
const wd = n => (new Date(n * DAY).getUTCDay() + 6) % 7;                      // 0 = Montag … 6 = Sonntag
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const isNum = v => v !== null && v !== '' && v !== undefined && !isNaN(v);

function isoWeek(n) {
  const th = n - wd(n) + 3;
  const y = ymd(th)[0], j4 = mkdn(y, 1, 4);
  return 1 + Math.round((th - (j4 - wd(j4) + 3)) / 7);
}
const isoWeekYear = n => ymd(n - wd(n) + 3)[0];

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WDL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const fmtD = n => { if (n == null) return '–'; const [y, m, d] = ymd(n); return p2(d) + '.' + p2(m) + '.' + y; };
const fmtW = n => n == null ? '–' : WD[wd(n)] + ' ' + fmtD(n);
const fmtS = n => { if (n == null) return '–'; const [, m, d] = ymd(n); return p2(d) + '.' + p2(m) + '.'; };
const fmtWS = n => n == null ? '–' : WD[wd(n)] + ' ' + fmtS(n);
function relDays(n, base) {
  const d = n - base;
  if (d === 0) return 'heute';
  if (d === 1) return 'morgen';
  if (d === -1) return 'gestern';
  return d > 0 ? 'in ' + d + ' Tagen' : 'vor ' + (-d) + ' Tagen';
}

/* ---------- Feiertage NRW (Osterformel nach Gauß) */
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114;
  return mkdn(y, Math.floor(n / 31), (n % 31) + 1);
}
const _holCache = new Map();
function holidaysNRW(y) {
  if (_holCache.has(y)) return _holCache.get(y);
  const e = easter(y), m = new Map();
  [[mkdn(y, 1, 1), 'Neujahr'], [e - 2, 'Karfreitag'], [e + 1, 'Ostermontag'], [mkdn(y, 5, 1), 'Tag der Arbeit'],
   [e + 39, 'Christi Himmelfahrt'], [e + 50, 'Pfingstmontag'], [e + 60, 'Fronleichnam'], [mkdn(y, 10, 3), 'Tag der Deutschen Einheit'],
   [mkdn(y, 11, 1), 'Allerheiligen'], [mkdn(y, 12, 25), '1. Weihnachtsfeiertag'], [mkdn(y, 12, 26), '2. Weihnachtsfeiertag']]
    .forEach(([n, t]) => m.set(n, t));
  _holCache.set(y, m);
  return m;
}

/* ---------- Farben */
const hex2rgb = h => { h = String(h || '#888888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) || 0); };
const rgb2hex = r => '#' + r.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (h, t, w = '#ffffff') => { const a = hex2rgb(h), b = hex2rgb(w); return rgb2hex(a.map((v, i) => v + (b[i] - v) * t)); };
// Farbtöne der Maßnahmen; im dunklen Modus zur dunklen Fläche hin gemischt (Druck und Excel immer hell)
let DARK = false, LIGHT_ONLY = 0;
const darkNow = () => DARK && !LIGHT_ONLY && !(typeof UI !== 'undefined' && UI.printing);
const DARK_SURF = '#26282b';
const pastel = h => darkNow() ? mix(h, 0.66, DARK_SURF) : mix(h, 0.75);
const midtone = h => darkNow() ? mix(h, 0.4, DARK_SURF) : mix(h, 0.45);
const logoSrc = () => darkNow() ? LOGO_DARK : LOGO;                      // weißes Logo im dunklen Design
const inkC = h => darkNow() ? mix(h, 0.45, '#ffffff') : mix(h, 0.12, '#000000');   // Schrift in Maßnahmenfarbe
function lum(h) {
  const [r, g, b] = hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const onColor = h => lum(h) > 0.42 ? '#1a1a1a' : '#ffffff';

const PALETTE = [['Blau', '#1F77B4'], ['Orange', '#E6550D'], ['Grün', '#2CA02C'], ['Magenta', '#C2185B'], ['Türkis', '#0097A7'],
  ['Rot', '#C62828'], ['Dunkelblau', '#283593'], ['Oliv', '#7C8B1F'], ['Violett', '#7B3FA0'], ['Braun', '#8D5B3A'], ['Gold', '#B8860B']];
const PERSON_COLORS = ['#E0A100', '#5E81AC', '#B55D9C', '#3E9E8F', '#D0643C', '#6D8B2F', '#6D5BD0', '#C44E6B', '#2F7F9E', '#9C7A3C'];

/* ---------- DOM */
const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'readOnly', 'indeterminate', 'min', 'max', 'step', 'type']);
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (tag === 'input' && props && props.type === 'date') props = guardDate(props);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') { if (typeof v === 'string') e.setAttribute('style', v); else for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) e.style.setProperty(sk, sv); else e.style[sk] = sv; } }
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k === 'tip') setTip(e, v);
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
const put = (parent, ...kids) => { parent.append(...kids.flat(Infinity).filter(k => k != null && k !== false)); return parent; };
const setKids = (parent, ...kids) => { parent.replaceChildren(); return put(parent, ...kids); };   // ersetzt Inhalt, ignoriert null/Listen sauber
/* ---------- Datumsfelder: nur vollständige und plausible Daten übernehmen (Planungsjahr ± 5 Jahre, höchstens 2000–2099) */
const DATE_SPAN = 5;
function dateBounds(v) {
  const y0 = (typeof UI !== 'undefined' && UI.year) || new Date().getFullYear(), yv = parseInt(v, 10);
  const lo = Math.max(2000, Math.min(y0, yv >= 2000 && yv <= 2099 ? yv : y0) - DATE_SPAN);
  const hi = Math.min(2099, Math.max(y0, yv >= 2000 && yv <= 2099 ? yv : y0) + DATE_SPAN);
  return [lo, hi];
}
function dateProblem(el) {                    // null = in Ordnung; sonst der Grund
  if (el.validity && el.validity.badInput) return 'Dieses Datum gibt es nicht (z. B. 31.06. – der Juni hat 30 Tage) oder es ist unvollständig';
  const v = el.value; if (!v) return null;
  const y = parseInt(v, 10), lo = parseInt(el.min, 10) || 2000, hi = parseInt(el.max, 10) || 2099;
  if (dn(v) == null || y < lo || y > hi) return 'Das Jahr ' + y + ' liegt außerhalb von ' + lo + '–' + hi;
  return null;
}
function guardDate(props) {
  const [lo, hi] = dateBounds(props.value);
  const p = Object.assign({ min: lo + '-01-01', max: hi + '-12-31', 'data-last-ok': props.value || '' }, props);
  for (const k of ['oninput', 'onchange']) if (typeof p[k] === 'function') {
    const f = p[k];
    p[k] = e => { if (dateProblem(e.target)) return; e.target.dataset.lastOk = e.target.value; f(e); };
  }
  const fo = p.onfocus;
  p.onfocus = e => { if (!dateProblem(e.target)) e.target.dataset.lastOk = e.target.value; if (fo) fo(e); };
  if (!p.onblur) p.onblur = e => {             // unvollständig verlassen: letzten gültigen Wert zurückholen
    const pr = dateProblem(e.target);
    if (pr) { e.target.value = e.target.dataset.lastOk || ''; toast(pr + ' – nicht übernommen.', 'warn'); }
  };
  return p;
}
function dateInput(value, fk, onCommit, extra = {}) {
  let start = value || '';
  const mark = el => el.classList.toggle('noval', !el.value);   // leeres Feld: in Tabellen ein hellgrauer Strich statt „tt.mm.jjjj“
  const done = e => {
    const el = e.target, pr = dateProblem(el);
    if (pr) { if (e.type === 'blur') { el.value = start; mark(el); toast(pr + ' – nicht übernommen.', 'warn'); } return; }
    mark(el);
    const v = el.value; if (v !== start) { start = v; onCommit(v); }
  };
  return h('input', Object.assign({ type: 'date', value: value || '', 'data-fk': fk, class: value ? null : 'noval',
    onfocus: e => { start = e.target.value; e.target.classList.remove('noval'); },
    onmousedown: e => {                        // leeres Feld (Strich): Klick öffnet das volle Feld, Klick aufs Kalendersymbol die Datumsauswahl
      const el = e.target; if (!el.classList.contains('noval')) return;
      const onIcon = e.clientX > el.getBoundingClientRect().right - 20;
      el.classList.remove('noval');
      if (onIcon) { e.preventDefault(); el.focus(); try { el.showPicker(); } catch (x) { /* ältere Browser: Feld ist offen */ } }
    },
    oninput: e => mark(e.target),
    onchange: e => { if (document.activeElement !== e.target) done(e); },
    onblur: done,
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); } }, extra));
}
// Werktage-Felder ohne Pfeile: eintippen oder – solange das Feld angeklickt ist – mit dem Mausrad hoch/runter.
// Ohne Fokus scrollt das Mausrad die Seite wie gewohnt. Übernommen wird kurz nach dem letzten Dreh.
function wheelStep(e) {
  const inp = e.currentTarget;
  if (document.activeElement !== inp) return;
  e.preventDefault();
  const lo = inp.min !== '' ? +inp.min : -Infinity, hi = inp.max !== '' ? +inp.max : Infinity;
  const v = clamp((isNum(inp.value) ? Math.round(+inp.value) : 0) + (e.deltaY < 0 ? 1 : -1), lo, hi);
  if (String(v) === inp.value) return;
  inp.value = v;
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  clearTimeout(inp._wheelT); inp._wheelT = setTimeout(() => inp.dispatchEvent(new Event('change', { bubbles: true })), 450);
}
// Zahlen deutsch eingeben: „1.500“ = 1500, „1.234,50“ = 1234,5, „1234,5“ = 1234,5; ein Punkt mit 1–2 Nachkommastellen gilt als Dezimalpunkt.
// Ergebnis: Zahl, '' (leer) oder null (keine Zahl)
function deNum(t) {
  let s = String(t ?? '').replace(/\s|€|EUR/gi, '');
  if (!s) return '';
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return /^\d+(\.\d+)?$/.test(s) ? +s : null;
}
const fmtNum = (v, dec) => v == null || v === '' || !isNum(v) ? '' : (+v).toLocaleString('de-DE', { minimumFractionDigits: dec && !Number.isInteger(+v) ? dec : 0, maximumFractionDigits: dec });
// Textfeld für Zahlen (Auflage, Kosten …): zeigt „1.500“ bzw. „1.234,50“, übernimmt beim Verlassen; Unlesbares wird nicht übernommen
function numField(value, dec, onCommit, props = {}) {
  return h('input', Object.assign({ type: 'text', inputmode: dec ? 'decimal' : 'numeric', class: 'numf', value: fmtNum(value, dec), placeholder: '–',
    onfocus: e => { e.target.dataset.prev = e.target.value; },
    onchange: e => {
      const v = deNum(e.target.value);
      if (v === null) { toast('„' + e.target.value + '“ ist keine Zahl – nicht übernommen (z. B. 1500 oder 1.234,50).', 'warn'); e.target.value = e.target.dataset.prev || fmtNum(value, dec); return; }
      const n = v === '' ? null : dec ? Math.round(v * 10 ** dec) / 10 ** dec : Math.round(v);
      e.target.value = fmtNum(n, dec);                              // gleich einheitlich anzeigen („1234,5“ → „1.234,50“)
      onCommit(n);
    } }, props));
}
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Ziehen mit der Maus: Loslassen übernimmt; Rechtsklick, Esc, Fensterwechsel oder verlorene Maus brechen ab */
let DRAG = null;                               // laufendes Ziehen (Tastenkürzel ruhen solange)
function dragSession(ev, el, onMove, onEnd) {
  const pid = ev.pointerId;
  if (el) try { el.setPointerCapture(pid); } catch (x) { /* ohne Einfangen weiter */ }
  let over = false;
  const on = (t, n, f, o) => t.addEventListener(n, f, o), off = (t, n, f, o) => t.removeEventListener(n, f, o);
  const fin = (okay, e) => {
    if (over) return; over = true; if (DRAG === sess) DRAG = null;
    off(window, 'pointermove', mv, true); off(window, 'pointerup', up, true); off(window, 'pointercancel', cancel, true);
    off(window, 'keydown', key, true); off(window, 'contextmenu', ctx, true); off(window, 'blur', cancel); off(document, 'visibilitychange', cancel);
    if (el) { off(el, 'lostpointercapture', cancel); try { if (el.hasPointerCapture(pid)) el.releasePointerCapture(pid); } catch (x) { /* */ } }
    onEnd(okay, e);
  };
  const mv = e => { if (e.pointerId !== pid) return; if (e.buttons === 0) fin(false, e); else onMove(e); };
  const up = e => { if (e.pointerId === pid) fin(e.button === 0 || e.button === -1, e); };
  const cancel = e => fin(false, e);
  const ctx = e => { e.preventDefault(); fin(false, e); };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fin(false, e); } else if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.stopPropagation(); } };
  on(window, 'pointermove', mv, true); on(window, 'pointerup', up, true); on(window, 'pointercancel', cancel, true);
  on(window, 'keydown', key, true); on(window, 'contextmenu', ctx, true); on(window, 'blur', cancel); on(document, 'visibilitychange', cancel);
  if (el) on(el, 'lostpointercapture', cancel);
  const sess = { cancel: () => fin(false, null) };
  if (DRAG) DRAG.cancel();
  DRAG = sess;
  return sess;
}

/* ---------- Tooltip (ein gemeinsames Element, Inhalt wird beim Überfahren erzeugt) */
const TIPS = new WeakMap();
function setTip(el, fnOrText) { TIPS.set(el, fnOrText); }
let tipEl = null, tipFor = null;
function initTips() {
  tipEl = h('div', { id: 'tip', role: 'tooltip' });
  document.body.append(tipEl);
  document.addEventListener('mouseover', ev => {
    if (document.body.classList.contains('dragging') || document.body.classList.contains('linking')) { hideTip(); return; }   // beim Ziehen nur das Ziehfenster, kein zweites
    let t = ev.target;
    while (t && t !== document.body && !TIPS.has(t)) t = t.parentElement;
    if (!t || !TIPS.has(t) || t === document.body) { hideTip(); return; }
    if (t === tipFor) return;
    tipFor = t;
    const c = TIPS.get(t);
    tipEl.replaceChildren(typeof c === 'function' ? c() : h('div', null, c));
    tipEl.classList.add('on');
    placeTip(ev);
  });
  document.addEventListener('mousemove', ev => { if (tipFor) { if (document.body.classList.contains('dragging') || document.body.classList.contains('linking')) hideTip(); else placeTip(ev); } });
  document.addEventListener('scroll', hideTip, true);
  document.addEventListener('mousedown', hideTip, true);
}
function placeTip(ev) {
  const r = tipEl.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  let x = ev.clientX + 14, y = ev.clientY + 16;
  if (x + r.width > W - 8) x = ev.clientX - r.width - 14;
  if (y + r.height > H - 8) y = ev.clientY - r.height - 12;
  tipEl.style.left = Math.max(8, x) + 'px';
  tipEl.style.top = Math.max(8, y) + 'px';
}
function placeLab(lab, x, y) {
  const r = lab.getBoundingClientRect();
  lab.style.left = (x + 16 + r.width > innerWidth - 8 ? Math.max(8, x - r.width - 16) : x + 16) + 'px';
  lab.style.top = Math.max(8, y - r.height - 14) + 'px';
}
function hideTip() { tipFor = null; if (tipEl) tipEl.classList.remove('on'); }

/* ---------- Meldungen und Dialoge */
function toast(text, kind = '') {
  const t = h('div', { class: 'toast ' + kind }, text), box = $('#toasts');
  while (box.children.length >= 3) box.firstChild.remove();
  box.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}
// Doppelklick auf Knöpfe: der zweite Klick zählt nicht (sonst: zwei Einträge gelöscht/angelegt, Fenster auf und gleich wieder zu).
// Ausnahmen: Knöpfe, die man bewusst schnell hintereinander drückt (Zoom, Jahr, Rückgängig …)
document.addEventListener('click', e => {
  if (e.detail < 2) return;
  const b = e.target.closest && e.target.closest('button, .mline-edit, [role=menuitem]');
  if (!b || b.closest('.seg-btn, .year, [data-repeat], .segs')) return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
function modal(title, body, buttons, opts = {}) {
  return new Promise(resolve => {
    const opened = Date.now();
    const close = v => { back.remove(); document.removeEventListener('keydown', key); resolve(v); };
    const key = e => { if (e.key === 'Escape') close(null); };
    const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : '') + (opts.cls ? ' ' + opts.cls : ''), role: 'dialog', 'aria-modal': 'true' },
      h('header', null, h('h2', null, title), h('button', { class: 'icon', 'aria-label': 'Schließen', onclick: () => close(null) }, '✕')),
      h('div', { class: 'modal-body' }, body),
      h('footer', null, (buttons || [['OK', true, 'primary']]).filter(Boolean).map(([label, val, cls]) => h('button', { class: cls || '', onclick: () => close(typeof val === 'function' ? val() : val) }, label))));
    const back = h('div', { class: 'backdrop', onmousedown: e => { if (e.target === back && e.detail < 2 && Date.now() - opened > 400) close(null); } }, box);
    if (opts.expose) opts.expose(close);                 // Knöpfe im Inhalt können das Fenster mit einem Ergebnis schließen
    document.body.append(back);
    document.addEventListener('keydown', key);
    const f = box.querySelector('input,select,textarea,footer button.primary');
    if (f) setTimeout(() => f.focus(), 30);
  });
}
const confirmBox = (title, text, yes = 'Ja', no = 'Abbrechen') =>
  modal(title, h('p', null, text), [[no, false], [yes, true, 'primary']]).then(v => v === true);

// Menü/Popover neben dem Auslöser platzieren – passt es unten nicht hin, öffnet es nach oben; nie außerhalb des Fensters
function placeMenu(m, r, align) {
  m.style.maxHeight = ''; m.style.overflow = '';
  const mr = m.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  let top = r.bottom + 4;
  if (top + mr.height > H - 8) { const up = r.top - mr.height - 4; top = up >= 8 ? up : Math.max(8, H - 8 - mr.height); }
  if (mr.height > H - 16) { top = 8; m.style.maxHeight = (H - 16) + 'px'; m.style.overflow = 'auto'; }
  m.style.top = top + 'px';
  if (align === 'right') { m.style.left = ''; m.style.right = Math.max(8, W - r.right) + 'px'; }
  else { m.style.right = ''; m.style.left = clamp(r.left, 8, Math.max(8, W - mr.width - 8)) + 'px'; }
}
function download(filename, blob) {
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
