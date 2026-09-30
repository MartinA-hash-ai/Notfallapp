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
  const mins = rows.flatMap(r => [...Object.values(r.st), r.pal]).filter(v => v != null && v < x0 && v >= x0 - 400);
  if (mins.length) { const [yy, mm] = ymd(Math.min(...mins)); x0 = mkdn(yy, mm, 1); }
  return [x0, x1];
}
// opts (für das PDF): only = nur diese Maßnahmen, rangeRows = Zeitraum aus diesen Maßnahmen, noVac = ohne Urlaubszeilen
function timelineSection(opts = {}) {
  const y = UI.year, today = todayDn();
  const all = C.ms.filter(x => visibleM(x) && inYear(x, y)), rows = opts.only ? all.filter(x => opts.only.has(x.id)) : all;
  const [x0, x1] = tlRange(opts.rangeRows || rows, y), nd = x1 - x0 + 1;
  const label = UI.printing ? 255 : TL_LABEL;
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
    const lab = h('div', { class: 'tl-lab clickable', dataset: { m: x.id }, tip: 'Klicken: auf diese Maßnahme zoomen', onmouseenter: () => highlight(x.id), onmouseleave: () => highlight(null),
      onclick: e => { if (!e.target.closest('button')) tlZoomTo(x); } },
      x.pc ? h('button', { class: 'tog', 'aria-label': 'Detailplan auf-/zuklappen', onclick: () => { tlOpen.has(x.id) ? tlOpen.delete(x.id) : tlOpen.add(x.id); renderNow(); } }, open ? '▾' : '▸') : h('span', { class: 'tog' }),
      h('span', { class: 'dot', style: { background: x.color } }),
      h('span', { class: 'nm' }, x.m.name || '(ohne Namen)'),
      ws.length ? h('span', { class: 'wicon', tip: () => h('div', null, ws.map(w => h('div', null, '⚠ ' + w.text))) }, '⚠') : null,
      h('span', { class: 'pal' + (x.m.palStatus !== 'fest' ? ' vorl' : ''), tip: x.m.palStatus !== 'fest' ? 'PAL vorläufig' : 'PAL fest' }, x.pal != null ? fmtS(x.pal) : '–'));
    const track = h('div', { class: 'tl-track', style: { width: W + 'px' } });
    // je Bereich ein Balken (hell → kräftiger), Griffe mit Buchstaben am Start; überlappen Bereiche, liegen sie in eigenen Spuren
    const phs = PH().filter(p => x.st[p.key] != null);
    const tone = f => darkNow() ? mix(x.color, 0.66 - 0.26 * f, DARK_SURF) : mix(x.color, 0.75 - 0.30 * f);
    const segs = {}, hands = {}, dia = h('div', { class: 'dia', style: { background: x.color } });
    phs.forEach((p, j) => {
      segs[p.key] = h('div', { class: 'seg', dataset: { k: p.key }, style: { background: tone(phs.length > 1 ? j / (phs.length - 1) : 0), borderColor: x.color } });
      hands[p.key] = h('div', { class: 'handle h-' + p.key + (startMovable(x, p.key) ? '' : ' locked'), style: { background: x.color } }, h('i', null, sym(p.key)));
    });
    const place = (st, en, pal) => {
      const Cx = n => X(clamp(n, x0 - 2, x1 + 2)) + pxd / 2;   // alles auf die Tagesmitte; weit Entferntes an den Rand
      const ks = phs.map(p => p.key).filter(k => st[k] != null);
      const over = ks.some((a, i) => ks.some((b, j) => i < j && st[a] < en[b] && st[b] < en[a]));
      const order = ks.slice().sort((a, b) => st[a] - st[b]);
      ks.forEach((k, j) => {
        const e = segs[k], a = st[k], b = en[k] != null ? en[k] : a, oi = order.indexOf(k);
        e.style.display = b > a ? '' : 'none';
        e.style.left = Cx(a) + 'px'; e.style.width = Math.max(2, Cx(b) - Cx(a)) + 'px';
        e.style.setProperty('--ln', over ? j : 0); e.style.setProperty('--lns', over ? ks.length : 1);
        e.classList.toggle('first', !over && oi === 0); e.classList.toggle('last', !over && oi === order.length - 1); e.classList.toggle('lane', over);
        hands[k].style.display = ''; hands[k].style.left = Cx(a) + 'px';
      });
      dia.style.display = pal != null ? '' : 'none'; if (pal != null) dia.style.left = X(pal) + pxd / 2 + 'px';
    };
    place(x.st, x.en, x.pal);
    const tipFn = () => chipTip({ x, t: 'P' });
    [...Object.values(segs), dia].forEach(e => { setTip(e, tipFn); e.addEventListener('pointerdown', ev => tlDrag(ev, x, 'move', pxd, place)); e.addEventListener('dblclick', () => editMassnahme(x.id)); });
    for (const p of phs) {
      setTip(hands[p.key], () => h('div', null, h('b', null, startLabel(p.key) + ' ' + fmtW(x.st[p.key])), h('div', { class: 'muted' }, (x.pal != null ? workdaysBefore(x.st[p.key], x.pal) + ' Werktage vor PAL · ' : '') +
        (x.enx[p.key] != null ? 'bis ' + fmtWS(x.en[p.key]) + ' · ' : '') + (x.pc ? 'ziehen = verschieben, der Detailplan passt sich an' : 'ziehen = verschieben'))));
      hands[p.key].addEventListener('pointerdown', ev => tlDrag(ev, x, p.key, pxd, place));
    }
    track.append(...Object.values(segs), ...Object.values(hands), dia);
    body.append(h('div', { class: 'tl-row', dataset: { m: x.id, flash: 'm:' + x.id } }, lab, track));
    if (open) for (const s of x.m.plan.steps) {
      const r = x.pc.map.get(s.id);
      if (s.typ === 'gruppe') { body.append(h('div', { class: 'tl-row sub grp' }, h('div', { class: 'tl-lab' }, h('span', { class: 'nm' }, s.name)), h('div', { class: 'tl-track', style: { width: W + 'px' } }))); continue; }
      const t = h('div', { class: 'tl-track', style: { width: W + 'px' } });
      if (r && r.start != null) {
        const tip = () => h('div', null, h('b', null, s.name), h('div', null, s.typ === 'aufgabe' ? fmtW(r.start) + ' – ' + fmtW(r.end) + ' (' + s.dauer + ' Tage)' : fmtW(r.end)), s.wer ? h('div', { class: 'muted' }, 'Zugeordnet: ' + s.wer) : null);
        const ra = clamp(r.start, x0 - 2, x1 + 2), rb = clamp(r.end, x0 - 2, x1 + 2);
        if (s.typ === 'aufgabe') t.append(h('div', { class: 'sbar', tip, style: { left: X(ra) + 'px', width: Math.max(2, X(rb) - X(ra)) + 'px', background: pastel(x.color), borderColor: x.color } },
          h('span', { style: { width: clamp(+s.fortschritt || 0, 0, 100) + '%', background: x.color } })));
        else t.append(h('div', { class: 'sdia' + (s.typ === 'ziel' ? ' ziel' : ''), tip, style: { left: X(rb) + 'px', background: s.typ === 'ziel' ? '#E30714' : x.color } }));
      }
      body.append(h('div', { class: 'tl-row sub' }, h('div', { class: 'tl-lab' }, h('span', { class: 'nm' }, s.name), s.wer ? h('span', { class: 'who', style: { background: pastel(personColor(s.wer)) } }, s.wer) : null), t));
    }
  }
  if (!rows.length) body.append(h('div', { class: 'tl-empty' }, 'Keine (angezeigten) Maßnahmen in ' + y + '.'));

  // ---- Urlaube je Person
  const vacs = C.vac.filter(v => vacVisible(v) && v.bis >= x0 && v.von <= x1);
  const people = [...new Set(vacs.map(v => v.u.wer || '?'))].sort((a, b) => a.localeCompare(b, 'de'));
  if (people.length && !opts.noVac) {
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

  const head = h('div', { class: 'tl-head' }, h('div', { class: 'tl-lab corner' }, 'Maßnahme', h('span', null, 'PAL')), h('div', { class: 'tl-track', style: { width: W + 'px' } }, months, weeks, days));
  const tl = h('div', { class: 'tl', 'data-keep-scroll': 'tl' }, h('div', { class: 'tl-inner', style: { width: label + W + 'px', '--lab': label + 'px' } }, head, h('div', { class: 'tl-bodywrap' }, bg, body)));
  const zoom = f => { const c = tlCenter(); UI.tlPxd = clamp((UI.tlPxd || pxd) * f, 1.5, 60); UI.tlFocusCenter = c; renderNow(); };
  tlPan(tl, n => {             // Klick auf einen Monat: hineinzoomen
    const [yy, mm] = ymd(n), dim = daysIn(yy, mm), vis = Math.max(300, (($('.tl') || {}).clientWidth || innerWidth - 70) - label);
    UI.tlPxd = clamp(vis / dim, 1.5, 60); UI.tlFocus = n; renderNow();
  });
  tlWheel(tl, x0, nd, avail, label);
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
function tlZoomTo(x) {
  const pts = [...Object.values(x.st), x.pal].filter(v => v != null);
  if (!pts.length) return;
  const a = Math.min(...pts), b = Math.max(...pts), tl = $('.tl');
  const vis = Math.max(300, ((tl && tl.clientWidth) || innerWidth - 70) - (UI._tl ? UI._tl.label : TL_LABEL));
  const span = b - a + 1, pad = Math.max(2, Math.round(span * 0.06));
  UI.tlPxd = clamp(vis / (span + 2 * pad), 1.5, 60); UI.tlFocus = a - pad;
  renderNow();
}
// Mausrad über der Zeitleiste: hinein-/herauszoomen (der Tag unter der Maus bleibt stehen)
let _wheelPending = null;
function tlWheel(box, x0, nd, avail, label) {
  box.addEventListener('wheel', ev => {
    if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) || ev.shiftKey) return;           // seitlich scrollen wie gewohnt
    const r = box.getBoundingClientRect(), off = ev.clientX - r.left - label;
    if (off < 0) return;                                                             // über den Namen: normal scrollen
    ev.preventDefault();
    const cur = UI._tl ? UI._tl.pxd : avail / nd, fit = avail / nd;
    const base = _wheelPending ? _wheelPending.pxd : cur;
    let np = clamp(base * (ev.deltaY < 0 ? 1.2 : 1 / 1.2), fit, 60);
    if (!_wheelPending) _wheelPending = { d: x0 + (box.scrollLeft + off) / cur, off };
    _wheelPending.pxd = np;
    requestAnimationFrame(() => {
      if (!_wheelPending) return;
      const w = _wheelPending; _wheelPending = null;
      UI.tlPxd = w.pxd <= fit * 1.001 ? 0 : w.pxd; UI.tlAnchor = { d: w.d, off: w.off };
      renderNow();
    });
  }, { passive: false });
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
    ev.preventDefault();
    dragSession(ev, null, move, okay => {
      box.classList.remove('panning'); document.body.classList.remove('dragging');
      if (okay && !moved && mz && onMonth) onMonth(+mz.dataset.mz);
    });
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
  if (UI.tlAnchor) { tl.scrollLeft = Math.max(0, (UI.tlAnchor.d - UI._tl.x0) * UI._tl.pxd - UI.tlAnchor.off); UI.tlAnchor = null; }
}
function tlDrag(ev, x, mode, pxd, place) {
  if (ev.button !== 0) return;
  if (mode !== 'move' && !startMovable(x, mode)) { toast('Im Detailplan von „' + x.m.name + '“ gehört noch kein Abschnitt zum Bereich „' + phName(mode) + '“.', 'warn'); return; }
  if (mode === 'move' && x.pal == null) return;
  ev.preventDefault(); hideTip();
  const el = ev.currentTarget, x0 = ev.clientX;
  document.body.classList.add('dragging');
  const lab = h('div', { class: 'drag-lab' });
  document.body.append(lab);
  let dd = 0;
  const resp = (x.m.verantwortlich || '').trim();
  const move = e => {
    dd = Math.round((e.clientX - x0) / pxd);
    const st = Object.assign({}, x.st), enx = Object.assign({}, x.enx);
    let p = x.pal, txt, n;
    if (mode === 'move') { for (const k of Object.keys(st)) st[k] += dd; for (const k of Object.keys(enx)) enx[k] += dd; p += dd; n = p; txt = 'PAL: ' + fmtW(p); }
    else { st[mode] += dd; n = st[mode]; txt = startLabel(mode) + ': ' + fmtW(n) + ' · ' + workdaysBefore(n, x.pal) + ' Werktage vor PAL'; }
    place(st, phaseEnds(st, enx, p), p);
    const w = mode === 'move' ? [['PAL', p], ...PH().filter(q => st[q.key] != null).map(q => [q.key, st[q.key]])].flatMap(([k, v]) => dateWarn(v, resp).filter(t => k !== 'PAL' || !/Samstag|Urlaub/.test(t)).map(t => k + ': ' + t)) : dateWarn(n, resp);
    setKids(lab, h('b', null, txt), dd ? h('span', { class: 'muted' }, ' (' + (dd > 0 ? '+' : '') + dd + ' Tage)') : null, w.length ? h('div', { class: 'warn' }, '⚠ ' + w.join(' · ')) : null);
    placeLab(lab, e.clientX, e.clientY);
  };
  const end = okay => {
    document.body.classList.remove('dragging');
    lab.remove();
    if (!okay) { place(x.st, x.en, x.pal); return; }        // abgebrochen: Balken zurück an den alten Platz
    if (!dd) return;
    if (mode === 'move') commit(d => { const m = findM(d, x.id); if (m && dn(m.pal) != null) m.pal = ds(dn(m.pal) + dd); }, x.m.name + ': PAL → ' + fmtW(x.pal + dd));
    else moveStartTo(x.id, mode, x.st[mode] + dd);
  };
  dragSession(ev, el, move, end);
  move(ev);
}
