/* ===================================================================== Ansicht: Jahreskalender */

function chipStyle(t, color) {
  return t === 'P' ? { background: color, color: onColor(color), borderColor: color } : { background: pastel(color), color: inkC(color), borderColor: darkNow() ? mix(color, 0.3, DARK_SURF) : mix(color, 0.35) };
}
function chip(e, opts = {}) {
  return h('span', { class: 'chip ' + e.t, dataset: { m: e.x.id }, style: chipStyle(e.t, e.x.color), tip: opts.noTip ? null : () => chipTip(e),
    onpointerdown: opts.noClick ? null : ev => chipDrag(ev, e),
    onmouseenter: opts.noHl ? null : () => highlight(e.x.id), onmouseleave: opts.noHl ? null : () => highlight(null) }, e.t);
}
function chipTip(e) {
  const x = e.x, m = x.m;
  const line = (t, n) => h('div', { class: 'tt-row' + (t === e.t ? ' cur' : '') }, h('span', { class: 'chip ' + t, style: chipStyle(t, x.color) }, t), ' ', TYPE_LABEL[t], h('b', null, ' ' + fmtW(n)));
  return h('div', null,
    h('div', { class: 'tt-title', style: { borderColor: x.color } }, m.name || '(ohne Namen)'),
    x.s != null ? line('S', x.s) : null, x.i != null ? line('I', x.i) : null, x.pal != null ? line('P', x.pal) : null,
  );
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
    const pts = TYPES.filter(([t]) => UI.show[t]).map(([, k]) => x[k]).filter(v => v != null);
    if (pts.length < 2) continue;
    out.push({ x, a: Math.min(...pts), b: Math.max(...pts) });
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
    vb ? vb.filter(v => v.a <= n && n <= v.b).map(v => h('span', { class: 'vbl' + (n === v.a ? ' vs' : '') + (n === v.b ? ' ve' : ''), dataset: { m: v.x.id },
      style: { '--hc': v.x.color, '--ln': String(v.lane % 4) } })) : null);
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
    for (const { x, ev } of per.values())
      list.append(h('div', { class: 'mline' + (UI.pin === x.id && UI.pinMonth === mo && !UI.printing ? ' pinned' : ''), dataset: { m: x.id },
        tip: UI.pin === x.id ? null : 'Klicken: Maßnahme hervorheben', onmouseenter: () => highlight(x.id), onmouseleave: () => highlight(null),
        onclick: e => { if (!e.target.closest('.mline-edit')) pinMassnahme(e.currentTarget, x.id, mo); }, style: { color: inkC(x.color) } },
        h('span', { class: 'key', style: { background: x.color } }), h('b', null, x.m.name + ': '), ev.map(e => e.t + ' ' + fmtS(e.n)).join(' · '),
        UI.pin === x.id && UI.pinMonth === mo && !UI.printing ? pinEditBtn(x.id) : null));
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
  el.setPointerCapture(ev.pointerId);
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
      if (locked) { toast('Im Detailplan von „' + x.m.name + '“ ist kein Schritt als ' + TYPE_LABEL[t] + ' markiert (⋯-Menü am Schritt).', 'warn'); stop(); return; }
      moved = true; hideTip(); document.body.classList.add('dragging');
      el.classList.add('dragsrc');
      ghost = h('span', { class: 'chip ghost ' + t, style: chipStyle(t, x.color) }, t);
      lab = h('div', { class: 'drag-lab' });
      document.body.append(ghost, lab);
    }
    ghost.style.left = (m.clientX - 8) + 'px'; ghost.style.top = (m.clientY - 8) + 'px';
    const under = document.elementFromPoint(m.clientX, m.clientY);
    const cell = under && under.closest('.day[data-dn]');
    if (cell) dd = +cell.dataset.dn - e.n;
    let s = x.s, i = x.i, p = x.pal, txt, w;
    if (t === 'P') {
      p += dd; if (s != null) s += dd; if (i != null) i += dd;
      txt = 'PAL ' + fmtW(p) + (s != null ? ' · S ' + fmtWS(s) : '') + (i != null ? ' · I ' + fmtWS(i) : '');
      w = [p, s, i].flatMap((v, k) => v == null ? [] : dateWarn(v, resp).filter(q => k > 0 || !/Samstag|Urlaub/.test(q)).map(q => ['PAL', 'S', 'I'][k] + ': ' + q));
    } else {
      const n = (t === 'S' ? s : i) + dd;
      txt = TYPE_LABEL[t] + ' ' + fmtW(n) + ' · ' + workdaysBefore(n, p) + ' Werktage vor PAL';
      w = dateWarn(n, resp);
      if (t === 'S') s = n; else i = n;
    }
    clearMarks();
    if (t === 'P') { mark(p, 'P'); mark(s, 'S'); mark(i, 'I'); } else mark(t === 'S' ? s : i, t);
    setKids(lab, h('b', null, txt), dd ? h('span', { class: 'muted' }, ' (' + (dd > 0 ? '+' : '') + dd + ' Tage)') : null, w.length ? h('div', { class: 'warn' }, '⚠ ' + w.join(' · ')) : null);
    placeLab(lab, m.clientX, m.clientY);
  };
  const stop = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', stop);
    document.body.classList.remove('dragging');
    el.classList.remove('dragsrc');
    clearMarks();
    if (ghost) ghost.remove();
    if (lab) lab.remove();
  };
  const up = () => {
    const wasMoved = moved;
    stop();
    if (!wasMoved) { editMassnahme(x.id); return; }
    if (!dd) return;
    if (t === 'P') commit(d => { findM(d, x.id).pal = ds(x.pal + dd); }, x.m.name + ': PAL → ' + fmtW(x.pal + dd) + ' (S und I mitverschoben)');
    else moveStartTo(x.id, t, (t === 'S' ? x.s : x.i) + dd);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', stop);
}
