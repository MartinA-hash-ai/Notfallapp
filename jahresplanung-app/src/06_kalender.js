/* ===================================================================== Ansicht: Jahreskalender */

// Aussehen der Markierung je Einstellung: pastell (Standard für Bereiche), kräftig (Standard für PAL), gestreift, nur Rahmen
function chipStyle(t, color) {
  const dk = darkNow(), st = stilOf(t), bd = dk ? mix(color, 0.3, DARK_SURF) : mix(color, 0.35);
  if (st === 'kraeftig') return { background: color, color: onColor(color), borderColor: color };
  if (st === 'rahmen') return { background: 'var(--card)', color: inkC(color), borderColor: color, boxShadow: 'inset 0 0 0 0.5px ' + color };
  if (st === 'streifen') {
    const a = pastel(color), b = dk ? mix(color, 0.45, DARK_SURF) : mix(color, 0.55);
    return { background: 'repeating-linear-gradient(135deg, ' + a + ' 0 2px, ' + b + ' 2px 4px)', color: inkC(color), borderColor: bd };
  }
  return { background: pastel(color), color: inkC(color), borderColor: bd };
}
// Verbindungslinie im Kalender: vom ersten Termin an von hell nach kräftig – jedes Teilstück (Bereich) etwas kräftiger,
// das letzte bis zum PAL in voller Farbe. Liefert die Farben der linken und rechten Tageshälfte (Linie von Tagesmitte zu Tagesmitte).
// pts: [{ n, k }] nach Datum sortiert; das Teilstück ab pts[i] gehört zum Bereich pts[i].k – sein Aussehen kommt aus den Einstellungen („Linie“).
function lineHalves(n, pts, c) {
  const a = pts[0].n, b = pts[pts.length - 1].n, k = pts.length - 1;
  const col = t => { let i = 0; while (i < k - 1 && t >= pts[i + 1].n) i++; return lineBg(pts[i].k, c, k <= 1 ? 1 : (k - 1 - i) / (k - 1)); };
  return [n > a ? col(n - 0.25) : 'none', n < b ? col(n + 0.25) : 'none'];
}
const linePts = (x, keys) => keys.map(k => ({ n: evDate(x, k), k })).filter(p => p.n != null).sort((p, q) => p.n - q.n);
const isPinnedChip = e => UI.pin === e.x.id && UI.pinDay === e.n && UI.pinT === e.t && !UI.printing;
function chip(e, opts = {}) {
  return h('span', { class: 'chip ' + (e.t === 'P' ? '' : 'ph ') + e.t + (opts.cls ? ' ' + opts.cls : '') + (!opts.noClick && isPinnedChip(e) ? ' pinned' : ''), dataset: { m: e.x.id }, style: chipStyle(e.t, e.x.color), tip: opts.noTip ? null : () => chipTip(e),
    onpointerdown: opts.noClick ? null : ev => chipDrag(ev, e),
    onmouseenter: opts.noHl ? null : () => highlight(e.x.id), onmouseleave: opts.noHl ? null : () => highlight(null) }, sym(e.t));
}
function chipTip(e) {
  const x = e.x, m = x.m;
  const line = (t, n) => h('div', { class: 'tt-row' + (t === e.t ? ' cur' : '') }, h('span', { class: 'chip ' + (t === 'P' ? '' : 'ph ') + t, style: chipStyle(t, x.color) }, sym(t)), ' ', TYPE_LABEL[t], h('b', null, ' ' + fmtW(n)),
    t !== 'P' && x.pal != null ? h('span', { class: 'muted' }, ' · ' + workdaysBefore(n, x.pal) + ' WT vor PAL' + (x.enx[t] != null ? ' · bis ' + fmtWS(x.en[t]) : '')) : null);
  return h('div', null,
    h('div', { class: 'tt-title', style: { borderColor: x.color } }, m.name || '(ohne Namen)'),
    evKeys().map(t => evDate(x, t) != null ? line(t, evDate(x, t)) : null));
}
function vacTag(v) {
  const c = personColor(v.u.wer);
  return h('span', { class: 'vtag', style: { background: pastel(c), borderColor: c } }, v.u.wer || '?');
}
function dayTip(n, evs, away, hn) {
  return h('div', null,
    h('div', { class: 'tt-title plain' }, WDL[wd(n)] + ', ' + fmtD(n), h('span', { class: 'muted' }, ' · KW ' + isoWeek(n))),
    hn ? h('div', { class: 'tt-hol' }, 'Feiertag: ' + hn) : null,
    evs.map(e => h('div', { class: 'tt-row' }, chip(e, { noTip: true, noClick: true, noHl: true }), ' ', e.x.m.name, h('span', { class: 'muted' }, ' – ' + TYPE_LABEL[e.t]))),
    away.length ? h('div', { class: 'tt-vac' }, 'Urlaub: ', away.map(vacTag)) : null,
    (!evs.length && !away.length && !hn) ? h('div', { class: 'muted' }, 'keine Termine') : null);
}
// Verbund-Darstellung: je Maßnahme eine farbige Linie von der ersten bis zur letzten angezeigten Markierung, eigene Spur je Überlappung
function verbundLanes() {
  const out = [], ends = [];
  for (const x of C.ms.filter(visibleM)) {
    const pts = linePts(x, evKeys().filter(showType));
    if (pts.length < 2) continue;
    out.push({ x, a: pts[0].n, b: pts[pts.length - 1].n, pts });
  }
  out.sort((p, q) => p.a - q.a || q.b - p.b);
  for (const v of out) { let l = ends.findIndex(e => e < v.a); if (l < 0) { l = ends.length; ends.push(v.b); } else ends[l] = v.b; v.lane = l; }
  return out;
}
function dayCell(n, evs, vacs, today, vb) {
  const hn = holName(n), w = wd(n), away = vacs.filter(v => v.von <= n && n <= v.bis);
  const cls = 'day' + (w >= 5 ? ' we' : '') + (hn ? ' hol' : '') + (n === today ? ' today' : '') + (away.length ? ' away' : '');
  return h('div', { class: cls, dataset: { dn: n }, tip: () => dayTip(n, evs, away, hn) },
    h('span', { class: 'dnum' }, ymd(n)[2]),
    evs.length ? h('div', { class: 'chips' }, evs.map(e => chip(e))) : null,
    away.length ? h('div', { class: 'vbars' + (away.length > 1 ? ' multi' : '') }, away.slice(0, 4).map(v => h('span', { style: { background: personColor(v.u.wer) } })),
      away.length > 1 ? h('b', { class: 'vcount' }, away.length) : null) : null,
    vb ? vb.filter(v => v.a <= n && n <= v.b).map(v => { const [l, r] = lineHalves(n, v.pts, v.x.color);
      return h('span', { class: 'vbl' + (v.a === v.b ? ' one' : ''), dataset: { m: v.x.id }, style: { '--hcl': l, '--hcr': r, '--hc': v.x.color, '--ln': String(v.lane % 4) } }); }) : null,
    UI.pin && UI.pinDay === n && !UI.printing && !UI.monthLists && evs.some(isPinnedChip) ? pinEditBtn(UI.pin, 'chip-edit') : null);   // mit Terminliste steht „Bearbeiten“ dort
}
function monthCard(y, mo, byDay, vacs, today, vb) {
  const first = mkdn(y, mo, 1), last = first + daysIn(y, mo) - 1, start = first - wd(first);
  const g = h('div', { class: 'mgrid' }, h('div', { class: 'wh kw' }, 'KW'), WD.map((d, i) => h('div', { class: 'wh' + (i >= 5 ? ' we' : '') }, d)));
  for (let w = 0; w < 6; w++) {
    const ws = start + 7 * w;
    g.append(h('div', { class: 'kw' }, ws <= last ? isoWeek(ws) : ''));
    for (let d = 0; d < 7; d++) {
      const n = ws + d;
      g.append(n < first || n > last ? h('div', { class: 'day out' }) : dayCell(n, byDay.get(n) || [], vacs, today, vb));
    }
  }
  const card = h('section', { class: 'month' }, h('header', null, MON[mo - 1] + ' ' + y), g);
  if (UI.monthLists || UI.printing) {
    const list = h('div', { class: 'mlist' });
    const hols = [];
    for (let n = first; n <= last; n++) { const hn = holName(n); if (hn) hols.push(fmtS(n) + ' ' + hn); }
    if (hols.length) list.append(h('div', { class: 'mhol' }, hols.join(' · ')));
    const per = new Map();
    for (let n = first; n <= last; n++) for (const e of byDay.get(n) || []) { if (!per.has(e.x.id)) per.set(e.x.id, { x: e.x, ev: [] }); per.get(e.x.id).ev.push(e); }
    // je Maßnahme eine Zeile: links die Termine des Monats (S, I, D, P …), dann der Name; festgehalten: „Bearbeiten“ dahinter
    for (const { x, ev } of per.values()) {
      const pinned = UI.pin === x.id && !UI.printing;
      list.append(h('div', { class: 'mline' + (pinned ? ' pinned' : ''), dataset: { m: x.id },
        tip: pinned ? null : 'Klicken: Maßnahme hervorheben', onmouseenter: () => highlight(x.id), onmouseleave: () => highlight(null),
        onclick: e => { if (!e.target.closest('.mline-edit')) pinMassnahme(e.currentTarget, x.id, mo); }, style: { color: inkC(x.color) } },
        h('span', { class: 'lchips' }, ev.map(e => chip(e, { noClick: true, noHl: true, cls: 'lc' }))), h('b', null, x.m.name || '(ohne Namen)'),
        pinned ? pinEditBtn(x.id) : null));
    }
    const vm = vacs.filter(v => v.bis >= first && v.von <= last);
    if (vm.length) list.append(h('div', { class: 'mvac' }, 'Urlaub: ', vm.map(v => h('span', { class: 'vtag', style: { background: pastel(personColor(v.u.wer)), borderColor: personColor(v.u.wer) } },
      (v.u.wer || '?') + ' ' + fmtS(Math.max(v.von, first)) + (v.bis > v.von ? '–' + fmtS(Math.min(v.bis, last)) : '')))));
    card.append(list);
  }
  return card;
}
function calendarBody() {
  const y = UI.year, today = todayDn();
  const ev = eventsIn(mkdn(y, 1, 1), mkdn(y, 12, 31));
  const byDay = new Map();
  ev.forEach(e => { if (!byDay.has(e.n)) byDay.set(e.n, []); byDay.get(e.n).push(e); });
  const vacs = C.vac.filter(vacVisible), vb = UI.verbund ? verbundLanes() : null;
  return h('div', { class: 'cal' + (vb ? ' verbund' : '') }, Array.from({ length: 12 }, (_, i) => monthCard(y, i + 1, byDay, vacs, today, vb)));
}

/* ---------- Markierung im Kalender ziehen: P verschiebt das ganze Projekt, S/I nur dieses Datum */
function chipDrag(ev, e) {
  if (ev.button !== 0) return;
  ev.stopPropagation();
  const x = e.x, t = e.t, el = ev.currentTarget, sx = ev.clientX, sy = ev.clientY;
  const locked = t !== 'P' && !startMovable(x, t);
  let moved = false, dd = 0, ghost = null, lab = null, marks = [];
  const resp = (x.m.verantwortlich || '').trim();
  const clearMarks = () => { marks.forEach(c => { c.classList.remove('drop'); c.style.removeProperty('--dc'); c.removeAttribute('data-drop'); }); marks = []; };
  const mark = (n, k) => {
    if (n == null) return;
    const c = $('.day[data-dn="' + n + '"]');
    if (!c) return;
    c.classList.add('drop'); c.style.setProperty('--dc', x.color); c.dataset.drop = k;
    marks.push(c);
  };
  const move = m => {
    if (!moved) {
      if (Math.hypot(m.clientX - sx, m.clientY - sy) < 5) return;
      if (locked) { toast('Im Detailplan von „' + x.m.name + '“ gehört noch kein Abschnitt zum Bereich „' + phName(t) + '“.', 'warn'); sess.cancel(); return; }
      moved = true; hideTip(); document.body.classList.add('dragging');
      el.classList.add('dragsrc');
      ghost = h('span', { class: 'chip ghost ' + t, style: chipStyle(t, x.color) }, sym(t));
      lab = h('div', { class: 'drag-lab' });
      document.body.append(ghost, lab);
    }
    ghost.style.left = (m.clientX - 8) + 'px'; ghost.style.top = (m.clientY - 8) + 'px';
    const under = document.elementFromPoint(m.clientX, m.clientY);
    const cell = under && under.closest('.day[data-dn]');
    if (cell) dd = +cell.dataset.dn - e.n;
    const st = Object.assign({}, x.st);
    let p = x.pal, txt, w;
    if (t === 'P') {
      p += dd; for (const k of Object.keys(st)) st[k] += dd;
      txt = 'PAL ' + fmtW(p) + PH().filter(q => st[q.key] != null).map(q => ' · ' + sym(q.key) + ' ' + fmtWS(st[q.key])).join('');
      w = [['PAL', p], ...PH().filter(q => st[q.key] != null).map(q => [q.key, st[q.key]])].flatMap(([k, v]) => dateWarn(v, resp).filter(q => k !== 'PAL' || !/Samstag|Urlaub/.test(q)).map(q => k + ': ' + q));
    } else {
      st[t] += dd;
      txt = TYPE_LABEL[t] + ' ' + fmtW(st[t]) + ' · ' + workdaysBefore(st[t], p) + ' Werktage vor PAL';
      w = dateWarn(st[t], resp);
    }
    clearMarks();
    if (t === 'P') { mark(p, 'P'); for (const k of Object.keys(st)) mark(st[k], k); } else mark(st[t], t);
    setKids(lab, h('b', null, txt), dd ? h('span', { class: 'muted' }, ' (' + (dd > 0 ? '+' : '') + dd + ' Tage)') : null, w.length ? h('div', { class: 'warn' }, '⚠ ' + w.join(' · ')) : null);
    placeLab(lab, m.clientX, m.clientY);
  };
  const end = okay => {                        // Loslassen übernimmt; Abbruch (Rechtsklick, Esc, Fensterwechsel) lässt alles, wie es war
    document.body.classList.remove('dragging');
    el.classList.remove('dragsrc');
    clearMarks();
    if (ghost) ghost.remove();
    if (lab) lab.remove();
    if (!okay) return;
    if (!moved) { pinChip(el, x.id, e.n, t); return; }
    if (!dd) return;
    if (t === 'P') commit(d => { const m = findM(d, x.id); if (m && dn(m.pal) != null) m.pal = ds(dn(m.pal) + dd); }, x.m.name + ': PAL → ' + fmtW(x.pal + dd) + ' (alle Bereiche mitverschoben)');
    else moveStartTo(x.id, t, x.st[t] + dd);
  };
  const sess = dragSession(ev, el, move, end);
}
