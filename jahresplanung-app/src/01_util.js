'use strict';
/* ===================================================================== Hilfsfunktionen: Datum, Farbe, DOM */

const DAY = 86400000;
const p2 = v => String(v).padStart(2, '0');
const mkdn = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY);          // Tagesnummer (Tage seit 1970, UTC)
const dn = s => { if (!s) return null; const [y, m, d] = String(s).split('-').map(Number); return (y && m && d) ? mkdn(y, m, d) : null; };
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
const pastel = h => mix(h, 0.75);
const midtone = h => mix(h, 0.45);
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
function dateInput(value, fk, onCommit, extra = {}) {
  let start = value || '';
  const done = e => { const v = e.target.value; if (v !== start) { start = v; onCommit(v); } };
  return h('input', Object.assign({ type: 'date', value: value || '', 'data-fk': fk,
    onfocus: e => { start = e.target.value; },
    onchange: e => { if (document.activeElement !== e.target) done(e); },
    onblur: done,
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); } }, extra));
}
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Tooltip (ein gemeinsames Element, Inhalt wird beim Überfahren erzeugt) */
const TIPS = new WeakMap();
function setTip(el, fnOrText) { TIPS.set(el, fnOrText); }
let tipEl = null, tipFor = null;
function initTips() {
  tipEl = h('div', { id: 'tip', role: 'tooltip' });
  document.body.append(tipEl);
  document.addEventListener('mouseover', ev => {
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
  document.addEventListener('mousemove', ev => { if (tipFor) placeTip(ev); });
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
function modal(title, body, buttons, opts = {}) {
  return new Promise(resolve => {
    const close = v => { back.remove(); document.removeEventListener('keydown', key); resolve(v); };
    const key = e => { if (e.key === 'Escape') close(null); };
    const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' },
      h('header', null, h('h2', null, title), h('button', { class: 'icon', 'aria-label': 'Schließen', onclick: () => close(null) }, '✕')),
      h('div', { class: 'modal-body' }, body),
      h('footer', null, (buttons || [['OK', true, 'primary']]).map(([label, val, cls]) => h('button', { class: cls || '', onclick: () => close(typeof val === 'function' ? val() : val) }, label))));
    const back = h('div', { class: 'backdrop', onmousedown: e => { if (e.target === back) close(null); } }, box);
    document.body.append(back);
    document.addEventListener('keydown', key);
    const f = box.querySelector('input,select,textarea,footer button.primary');
    if (f) setTimeout(() => f.focus(), 30);
  });
}
const confirmBox = (title, text, yes = 'Ja', no = 'Abbrechen') =>
  modal(title, h('p', null, text), [[no, false], [yes, true, 'primary']]).then(v => v === true);

function download(filename, blob) {
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
