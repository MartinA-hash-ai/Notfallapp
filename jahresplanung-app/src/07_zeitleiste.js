/* ===================================================================== Ansicht: Zeitleiste mit Ziehen */

const TL_LABEL = 290;
const tlOpen = new Set();
function dateWarn(n, resp) {
  const out = [], hn = holName(n);
  if (hn) out.push('Feiertag: ' + hn); else if (wd(n) >= 5) out.push(WDL[wd(n)]);
  const away = vacOn(n).filter(v => !resp || v.u.wer === resp);
  if (away.length) out.push('Urlaub: ' + [...new Set(away.map(v => v.u.wer || '?'))].join(', '));
  return out;
}
function tlRange(rows, y) {
  let x0 = mkdn(y, 1, 1);
  const x1 = mkdn(y, 12, 31);
  const mins = rows.flatMap(r => [r.s, r.i, r.pal]).filter(v => v != null && v < x0);
  if (mins.length) { const [yy, mm] = ymd(Math.min(...mins)); x0 = mkdn(yy, mm, 1); }
  return [x0, x1];
}
function timelineSection() {
  const y = UI.year, today = todayDn();
  const rows = C.ms.filter(x => visibleM(x) && inYear(x, y));
  const [x0, x1] = tlRange(rows, y), nd = x1 - x0 + 1;
  const label = UI.printing ? 215 : TL_LABEL;
  const avail = UI.printing ? 1040 - label : Math.max(500, innerWidth - label - 66);
  const pxd = UI.printing ? avail / nd : (UI.tlPxd || avail / nd);
  const W = Math.round(nd * pxd), X = n => (n - x0) * pxd;

  // ---- Kopf: Monate, Kalenderwochen, Tage
  const months = h('div', { class: 'tl-months' }), weeks = h('div', { class: 'tl-weeks' }), days = pxd >= 15 ? h('div', { class: 'tl-days' }) : null;
  for (let n = x0; n <= x1;) {
    const [yy, mm] = ymd(n), e = Math.min(x1, mkdn(yy, mm, daysIn(yy, mm)));
    const w = (e - n + 1) * pxd;
    months.append(h('div', { class: 'mz', dataset: { mz: n }, tip: 'Klicken: in ' + MON[mm - 1] + ' hineinzoomen', style: { left: X(n) + 'px', width: w + 'px' } }, h('span', null, w > MON[mm - 1].length * 7.5 + 46 ? MON[mm - 1] + (mm === 1 || n === x0 ? ' ' + yy : '') : w > MON[mm - 1].length * 7.5 + 8 ? MON[mm - 1] : w > 26 ? MONS[mm - 1] : '')));
    n = e + 1;
  }
  for (let n = x0 - wd(x0); n <= x1; n += 7) {
    const a = Math.max(n, x0);
    weeks.append(h('div', { style: { left: X(a) + 'px', width: (Math.min(n + 7, x1 + 1) - a) * pxd + 'px' } }, pxd * 7 >= 20 ? isoWeek(n) : ''));
  }
  if (days) for (let n = x0; n <= x1; n++) days.append(h('div', { class: wd(n) >= 5 ? 'we' : '', style: { left: X(n) + 'px', width: pxd + 'px' } }, ymd(n)[2]));

  // ---- Hintergrund: Wochenenden, Feiertage, Monatslinien, heute
  const bg = h('div', { class: 'tl-bg', style: { left: label + 'px', width: W + 'px' } });
  if (pxd >= 2.5) for (let n = x0; n <= x1; n++) if (wd(n) >= 5) bg.append(h('div', { class: 'we', style: { left: X(n) + 'px', width: pxd + 'px' } }));
  for (let n = x0; n <= x1; n++) {
    const hn = holName(n);
    if (hn) bg.append(h('div', { class: 'hol', style: { left: X(n) + 'px', width: Math.max(2, pxd) + 'px' }, tip: 'Feiertag: ' + hn + ' (' + fmtW(n) + ')' }));
    if (ymd(n)[2] === 1) bg.append(h('div', { class: 'mline', style: { left: X(n) + 'px' } }));
  }
  if (today >= x0 && today <= x1) bg.append(h('div', { class: 'today', style: { left: X(today) + pxd / 2 + 'px' }, tip: 'Heute, ' + fmtW(today) }));

  // ---- Zeilen der Maßnahmen
  const body = h('div', { class: 'tl-body' });
  const warnBy = new Map();
  C.warnings.forEach(w => { if (w.mid) warnBy.set(w.mid, (warnBy.get(w.mid) || []).concat(w)); });
  for (const x of rows) {
    const ws = (warnBy.get(x.id) || []).filter(w => w.lvl === 'warn');
    const open = x.pc && (UI.tlPlans || tlOpen.has(x.id));
    const lab = h('div', { class: 'tl-lab', dataset: { m: x.id }, onmouseenter: () => highlight(x.id), onmouseleave: () => highlight(null) },
      x.pc ? h('button', { class: 'tog', 'aria-label': 'Detailplan auf-/zuklappen', onclick: () => { tlOpen.has(x.id) ? tlOpen.delete(x.id) : tlOpen.add(x.id); renderNow(); } }, open ? '▾' : '▸') : h('span', { class: 'tog' }),
      h('span', { class: 'dot', style: { background: x.color } }),
      h('span', { class: 'nm', ondblclick: () => editMassnahme(x.id) }, x.m.name || '(ohne Namen)'),
      ws.length ? h('span', { class: 'wicon', tip: () => h('div', null, ws.map(w => h('div', null, '⚠ ' + w.text))) }, '⚠') : null,
      h('span', { class: 'pal' + (x.m.palStatus !== 'fest' ? ' vorl' : ''), tip: x.m.palStatus !== 'fest' ? 'PAL vorläufig' : 'PAL fest' }, x.pal != null ? fmtS(x.pal) : '–'));
    const track = h('div', { class: 'tl-track', style: { width: W + 'px' } });
    const els = {
      seg1: h('div', { class: 'seg s1', style: { background: pastel(x.color), borderColor: x.color } }),
      seg2: h('div', { class: 'seg s2', style: { background: midtone(x.color), borderColor: x.color } }),
      hS: h('div', { class: 'handle hs' + (x.pc ? ' locked' : ''), style: { background: x.color } }, h('i', null, 'S')),
      hI: h('div', { class: 'handle hi' + (x.pc ? ' locked' : ''), style: { background: x.color } }, h('i', null, 'I')),
      dia: h('div', { class: 'dia', style: { background: x.color } }),
    };
    const place = (s, i, p) => {
      const L = (n, e) => { e.style.left = X(n) + 'px'; };
      const seg = (e, a, b, on) => { e.style.display = on ? '' : 'none'; if (on) { e.style.left = X(a) + 'px'; e.style.width = Math.max(2, X(b) - X(a)) + 'px'; } };
      seg(els.seg1, s, i != null ? i : p, s != null && (i != null ? s < i : p != null));
      seg(els.seg2, i != null ? i : s, p != null ? p + 1 : i, i != null && p != null);
      els.hS.style.display = s != null ? '' : 'none'; if (s != null) L(s, els.hS);
      els.hI.style.display = i != null ? '' : 'none'; if (i != null) L(i, els.hI);
      els.dia.style.display = p != null ? '' : 'none'; if (p != null) els.dia.style.left = X(p) + pxd / 2 + 'px';
    };
    place(x.s, x.i, x.pal);
    const tipFn = () => chipTip({ x, t: 'P' });
    [els.seg1, els.seg2, els.dia].forEach(e => { setTip(e, tipFn); e.addEventListener('pointerdown', ev => tlDrag(ev, x, 'move', pxd, place)); e.addEventListener('dblclick', () => editMassnahme(x.id)); });
    setTip(els.hS, () => h('div', null, h('b', null, 'Start Selektion ' + fmtW(x.s)), h('div', { class: 'muted' }, x.pc ? 'ergibt sich aus dem Detailplan' : 'ziehen = Vorlauf Selektion ändern (' + x.vS + ' Tage)')));
    setTip(els.hI, () => h('div', null, h('b', null, 'Start inhaltliche Arbeit ' + fmtW(x.i)), h('div', { class: 'muted' }, x.pc ? 'ergibt sich aus dem Detailplan' : 'ziehen = Vorlauf Inhalt ändern (' + x.vI + ' Tage)')));
    els.hS.addEventListener('pointerdown', ev => tlDrag(ev, x, 'S', pxd, place));
    els.hI.addEventListener('pointerdown', ev => tlDrag(ev, x, 'I', pxd, place));
    track.append(els.seg1, els.seg2, els.hS, els.hI, els.dia);
    body.append(h('div', { class: 'tl-row', dataset: { m: x.id, flash: 'm:' + x.id } }, lab, track));
    if (open) for (const s of x.m.plan.steps) {
      const r = x.pc.map.get(s.id);
      if (s.typ === 'gruppe') { body.append(h('div', { class: 'tl-row sub grp' }, h('div', { class: 'tl-lab' }, h('span', { class: 'nm' }, s.name)), h('div', { class: 'tl-track', style: { width: W + 'px' } }))); continue; }
      const t = h('div', { class: 'tl-track', style: { width: W + 'px' } });
      if (r && r.start != null) {
        const tip = () => h('div', null, h('b', null, s.name), h('div', null, s.typ === 'aufgabe' ? fmtW(r.start) + ' – ' + fmtW(r.end) + ' (' + s.dauer + ' Tage)' : fmtW(r.end)), s.wer ? h('div', { class: 'muted' }, 'Zugeordnet: ' + s.wer) : null);
        if (s.typ === 'aufgabe') t.append(h('div', { class: 'sbar', tip, style: { left: X(r.start) + 'px', width: Math.max(2, X(r.end) - X(r.start)) + 'px', background: pastel(x.color), borderColor: x.color } },
          h('span', { style: { width: clamp(+s.fortschritt || 0, 0, 100) + '%', background: x.color } })));
        else t.append(h('div', { class: 'sdia' + (s.typ === 'ziel' ? ' ziel' : ''), tip, style: { left: X(r.end) + 'px', background: s.typ === 'ziel' ? '#E30714' : x.color } }));
      }
      body.append(h('div', { class: 'tl-row sub' }, h('div', { class: 'tl-lab' }, h('span', { class: 'nm' }, s.name), s.wer ? h('span', { class: 'who', style: { background: pastel(personColor(s.wer)) } }, s.wer) : null), t));
    }
  }
  if (!rows.length) body.append(h('div', { class: 'tl-empty' }, 'Keine (angezeigten) Maßnahmen in ' + y + '.'));

  // ---- Urlaube je Person
  const vacs = C.vac.filter(v => vacVisible(v) && v.bis >= x0 && v.von <= x1);
  const people = [...new Set(vacs.map(v => v.u.wer || '?'))].sort((a, b) => a.localeCompare(b, 'de'));
  if (people.length) {
    body.append(h('div', { class: 'tl-row sep' }, h('div', { class: 'tl-lab' }, h('b', null, 'Urlaub')), h('div', { class: 'tl-track', style: { width: W + 'px' } })));
    for (const p of people) {
      const t = h('div', { class: 'tl-track', style: { width: W + 'px' } });
      for (const v of vacs.filter(v => (v.u.wer || '?') === p)) {
        const a = Math.max(v.von, x0), b = Math.min(v.bis, x1), c = personColor(p);
        t.append(h('div', { class: 'vbar', style: { left: X(a) + 'px', width: Math.max(3, (b - a + 1) * pxd) + 'px', background: pastel(c), borderColor: c },
          tip: () => h('div', null, h('b', null, p + ': Urlaub'), h('div', null, fmtW(v.von) + ' – ' + fmtW(v.bis)), h('div', { class: 'muted' }, workdays(v.von, v.bis) + ' Arbeitstage' + (v.u.notiz ? ' · ' + v.u.notiz : ''))) }));
      }
      body.append(h('div', { class: 'tl-row vac' }, h('div', { class: 'tl-lab' }, h('span', { class: 'vdot', style: { background: personColor(p) } }), h('span', { class: 'nm' }, p)), t));
    }
    // Tage mit mehreren Abwesenden
    const t = h('div', { class: 'tl-track', style: { width: W + 'px' } });
    for (let n = x0; n <= x1; n++) {
      const aw = vacs.filter(v => v.von <= n && n <= v.bis);
      if (aw.length > 1) t.append(h('div', { class: 'overlap', style: { left: X(n) + 'px', width: Math.max(2, pxd) + 'px' }, tip: fmtW(n) + ': ' + aw.map(v => v.u.wer).join(', ') + ' gleichzeitig im Urlaub' }));
    }
    body.append(h('div', { class: 'tl-row vac' }, h('div', { class: 'tl-lab' }, h('span', { class: 'nm muted' }, 'mehrere gleichzeitig')), t));
  }

  // ---- Auslastung: Starts je Kalenderwoche
  const load = h('div', { class: 'tl-track', style: { width: W + 'px' } }), max = +D.settings.maxStarts || 2;
  for (let n = x0 - wd(x0); n <= x1; n += 7) {
    const list = C.ms.flatMap(x => [['S', x.s], ['I', x.i]].filter(([, v]) => v != null && v >= n && v < n + 7).map(([t]) => t + ' ' + x.m.name));
    if (!list.length) continue;
    const a = Math.max(n, x0);
    load.append(h('div', { class: 'load' + (list.length > max ? ' over' : ''), style: { left: X(a) + 'px', width: Math.max(3, 7 * pxd - 2) + 'px', height: Math.min(22, 5 + list.length * 5) + 'px' },
      tip: () => h('div', null, h('b', null, 'KW ' + isoWeek(n) + ': ' + list.length + ' Start' + (list.length > 1 ? 's' : '')), list.map(l => h('div', null, l)),
        list.length > max ? h('div', { class: 'warn' }, 'mehr als ' + max + ' Starts in einer Woche') : null) }, pxd * 7 >= 14 ? list.length : ''));
  }
  body.append(h('div', { class: 'tl-row load-row' }, h('div', { class: 'tl-lab' }, h('b', null, 'Starts je Woche'), h('span', { class: 'muted small' }, ' (S + I)')), load));

  const head = h('div', { class: 'tl-head' }, h('div', { class: 'tl-lab corner' }, 'Maßnahme', h('span', null, 'PAL')), h('div', { class: 'tl-track', style: { width: W + 'px' } }, months, weeks, days));
  const tl = h('div', { class: 'tl', 'data-keep-scroll': 'tl' }, h('div', { class: 'tl-inner', style: { width: label + W + 'px', '--lab': label + 'px' } }, head, h('div', { class: 'tl-bodywrap' }, bg, body)));
  const zoom = f => { const c = tlCenter(); UI.tlPxd = clamp((UI.tlPxd || pxd) * f, 1.5, 60); UI.tlFocusCenter = c; renderNow(); };
  tlPan(tl, n => {             // Klick auf einen Monat: hineinzoomen
    const [yy, mm] = ymd(n), dim = daysIn(yy, mm), vis = Math.max(300, (($('.tl') || {}).clientWidth || innerWidth - 70) - label);
    UI.tlPxd = clamp(vis / dim, 1.5, 60); UI.tlFocus = n; renderNow();
  });
  UI._tl = { x0, pxd, label };
  const zoomed = UI.tlPxd && UI.tlPxd * nd > avail + 10;
  return {
    tools: [
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: UI.tlPlans, onchange: e => { UI.tlPlans = e.target.checked; renderNow(); } }), 'Detailpläne'),
      h('span', { class: 'segs' },
        h('button', { class: 'seg-btn' + (!zoomed ? ' on' : ''), onclick: () => { UI.tlPxd = 0; renderNow(); } }, 'Jahr'),
        h('button', { class: 'seg-btn', 'aria-label': 'Verkleinern', tip: 'verkleinern', onclick: () => zoom(1 / 1.5) }, '−'),
        h('button', { class: 'seg-btn', 'aria-label': 'Vergrößern', tip: 'vergrößern', onclick: () => zoom(1.5) }, '+')),
      h('button', { class: 'ghostbtn', onclick: () => { if (!zoomed) { UI.tlPxd = clamp((avail / nd) * 4, 1.5, 60); UI.tlFocusCenter = today; renderNow(); } else scrollTlTo(today); } }, 'Heute')],
    body: [tl],
  };
}
function tlCenter() {
  const tl = $('.tl'); if (!tl || !UI._tl) return null;
  return UI._tl.x0 + (tl.scrollLeft + (tl.clientWidth - UI._tl.label) / 2) / UI._tl.pxd;
}
// Ziehen mit der Maus auf freier Fläche verschiebt die Ansicht; Klick auf einen Monat ruft onMonth auf
function tlPan(box, onMonth) {
  box.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    if (ev.target.closest('.seg,.handle,.dia,.sbar,.sdia,.vbar,.g-bar,.g-dia,button,input,select,a,.tl-lab')) return;
    const sx = ev.clientX, sl = box.scrollLeft, mz = ev.target.closest('[data-mz]');
    let moved = false;
    const move = e => {
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) < 4) return;
      if (!moved) { moved = true; box.classList.add('panning'); document.body.classList.add('dragging'); hideTip(); }
      e.preventDefault();
      box.scrollLeft = sl - dx;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      box.classList.remove('panning'); document.body.classList.remove('dragging');
      if (!moved && mz && onMonth) onMonth(+mz.dataset.mz);
    };
    ev.preventDefault();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

function scrollTlTo(n) {
  const tl = $('.tl'); if (!tl || !UI._tl) return;
  tl.scrollLeft = Math.max(0, (n - UI._tl.x0) * UI._tl.pxd - tl.clientWidth / 2 + UI._tl.label);
}
function timelineAfter() {
  const tl = $('.tl'); if (!tl || !UI._tl) return;
  if (UI.flash && UI.flash.startsWith('n:')) { scrollTlTo(+UI.flash.slice(2)); UI.flash = null; }
  if (UI.tlFocus != null) { tl.scrollLeft = Math.max(0, (UI.tlFocus - UI._tl.x0) * UI._tl.pxd); UI.tlFocus = null; }
  if (UI.tlFocusCenter != null) { scrollTlTo(UI.tlFocusCenter); UI.tlFocusCenter = null; }
}
function tlDrag(ev, x, mode, pxd, place) {
  if (ev.button !== 0) return;
  if (x.pc && mode !== 'move') { toast('Bei Maßnahmen mit Detailplan ergeben sich Start Selektion und Start Inhalt aus den Arbeitsschritten (Reiter „Detailpläne“).', 'warn'); return; }
  if (mode === 'move' && x.pal == null) return;
  ev.preventDefault(); hideTip();
  const el = ev.currentTarget, x0 = ev.clientX;
  el.setPointerCapture(ev.pointerId);
  document.body.classList.add('dragging');
  const lab = h('div', { class: 'drag-lab' });
  document.body.append(lab);
  let dd = 0;
  const resp = (x.m.verantwortlich || '').trim();
  const move = e => {
    dd = Math.round((e.clientX - x0) / pxd);
    let s = x.s, i = x.i, p = x.pal, txt, n;
    if (mode === 'move') { s = s != null ? s + dd : s; i = i != null ? i + dd : i; p += dd; n = p; txt = 'PAL: ' + fmtW(p); }
    else if (mode === 'S') { s += dd; n = s; txt = 'Start Selektion: ' + fmtW(s) + ' · Vorlauf ' + (x.pal - s) + ' Tage'; }
    else { i += dd; n = i; txt = 'Start Inhalt: ' + fmtW(i) + ' · Vorlauf ' + (x.pal - i) + ' Tage'; }
    place(s, i, p);
    const w = mode === 'move' ? [p, s, i].flatMap((v, k) => v == null ? [] : dateWarn(v, resp).filter(t => k > 0 || !/Samstag|Urlaub/.test(t)).map(t => ['PAL', 'S', 'I'][k] + ': ' + t)) : dateWarn(n, resp);
    lab.replaceChildren(h('b', null, txt), dd ? h('span', { class: 'muted' }, ' (' + (dd > 0 ? '+' : '') + dd + ' Tage)') : null, w.length ? h('div', { class: 'warn' }, '⚠ ' + w.join(' · ')) : null);
    placeLab(lab, e.clientX, e.clientY);
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    document.body.classList.remove('dragging');
    lab.remove();
    if (!dd) return;
    commit(d => {
      const m = findM(d, x.id);
      if (mode === 'move') {
        m.pal = ds(dn(m.pal) + dd);
      } else if (mode === 'S') m.vorlaufS = Math.max(0, x.vS - dd);
      else m.vorlaufI = Math.max(0, x.vI - dd);
    }, mode === 'move' ? x.m.name + ': PAL → ' + fmtW(x.pal + dd) : x.m.name + ': Vorlauf geändert');
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up, { once: true });
  el.addEventListener('pointercancel', up, { once: true });
  move(ev);
}
