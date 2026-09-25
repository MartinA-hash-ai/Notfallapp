/* ===================================================================== Ansicht: Jahreskalender */

function chipStyle(t, color) {
  return t === 'P' ? { background: color, color: onColor(color), borderColor: color } : { background: pastel(color), color: mix(color, 0, '#000000'), borderColor: mix(color, 0.35) };
}
function chip(e, opts = {}) {
  return h('span', { class: 'chip ' + e.t, dataset: { m: e.x.id }, style: chipStyle(e.t, e.x.color), tip: opts.noTip ? null : () => chipTip(e),
    onclick: opts.noClick ? null : ev => { ev.stopPropagation(); editMassnahme(e.x.id); },
    onmouseenter: opts.noHl ? null : () => highlight(e.x.id), onmouseleave: opts.noHl ? null : () => highlight(null) }, e.t);
}
function chipTip(e) {
  const x = e.x, m = x.m;
  const line = (t, n) => h('div', { class: 'tt-row' + (t === e.t ? ' cur' : '') }, h('span', { class: 'chip ' + t, style: chipStyle(t, x.color) }, t), ' ', TYPE_LABEL[t], h('b', null, ' ' + fmtW(n)));
  return h('div', null,
    h('div', { class: 'tt-title', style: { borderColor: x.color } }, m.name || '(ohne Namen)'),
    x.s != null ? line('S', x.s) : null, x.i != null ? line('I', x.i) : null, x.pal != null ? line('P', x.pal) : null,
    h('div', { class: 'tt-meta' }, [
      m.palStatus !== 'fest' ? 'PAL vorläufig' : 'PAL fest',
      m.verantwortlich ? 'Verantwortlich: ' + m.verantwortlich : null,
      m.plan ? 'mit Detailplan' : (x.vS != null ? 'Vorlauf ' + x.vS + ' / ' + (x.vI ?? '–') + ' Tage' : null),
      m.art ? 'Bitte: ' + m.art : null].filter(Boolean).join(' · ')),
    m.hinweis ? h('div', { class: 'tt-note' }, m.hinweis) : null,
    h('div', { class: 'tt-foot' }, 'Klicken zum Bearbeiten'));
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
function dayCell(n, evs, vacs, today) {
  const hn = holName(n), w = wd(n), away = vacs.filter(v => v.von <= n && n <= v.bis);
  const cls = 'day' + (w >= 5 ? ' we' : '') + (hn ? ' hol' : '') + (n === today ? ' today' : '') + (away.length ? ' away' : '');
  return h('div', { class: cls, tip: () => dayTip(n, evs, away, hn) },
    h('span', { class: 'dnum' }, ymd(n)[2]),
    evs.length ? h('div', { class: 'chips' }, evs.map(e => chip(e))) : null,
    away.length ? h('div', { class: 'vbars' + (away.length > 1 ? ' multi' : '') }, away.slice(0, 4).map(v => h('span', { style: { background: personColor(v.u.wer) } })),
      away.length > 1 ? h('b', { class: 'vcount' }, away.length) : null) : null);
}
function monthCard(y, mo, byDay, vacs, today) {
  const first = mkdn(y, mo, 1), last = first + daysIn(y, mo) - 1, start = first - wd(first);
  const g = h('div', { class: 'mgrid' }, h('div', { class: 'wh kw' }, 'KW'), WD.map((d, i) => h('div', { class: 'wh' + (i >= 5 ? ' we' : '') }, d)));
  for (let w = 0; w < 6; w++) {
    const ws = start + 7 * w;
    g.append(h('div', { class: 'kw' }, ws <= last ? isoWeek(ws) : ''));
    for (let d = 0; d < 7; d++) {
      const n = ws + d;
      g.append(n < first || n > last ? h('div', { class: 'day out' }) : dayCell(n, byDay.get(n) || [], vacs, today));
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
      list.append(h('div', { class: 'mline', dataset: { m: x.id }, onmouseenter: () => highlight(x.id), onmouseleave: () => highlight(null), onclick: () => editMassnahme(x.id), style: { color: mix(x.color, 0.1, '#000000') } },
        h('span', { class: 'key', style: { background: x.color } }), h('b', null, x.m.name + ': '), ev.map(e => e.t + ' ' + fmtS(e.n)).join(' · ')));
    const vm = vacs.filter(v => v.bis >= first && v.von <= last);
    if (vm.length) list.append(h('div', { class: 'mvac' }, 'Urlaub: ', vm.map(v => h('span', { class: 'vtag', style: { background: pastel(personColor(v.u.wer)), borderColor: personColor(v.u.wer) } },
      (v.u.wer || '?') + ' ' + fmtS(Math.max(v.von, first)) + (v.bis > v.von ? '–' + fmtS(Math.min(v.bis, last)) : '')))));
    card.append(list);
  }
  return card;
}
VIEW_FN.kalender = main => {
  const y = UI.year, today = todayDn();
  const ev = eventsIn(mkdn(y, 1, 1), mkdn(y, 12, 31));
  const byDay = new Map();
  ev.forEach(e => { if (!byDay.has(e.n)) byDay.set(e.n, []); byDay.get(e.n).push(e); });
  const vacs = C.vac.filter(vacVisible);
  put(main, 
    h('div', { class: 'view-head' },
      !UI.sidebar ? h('button', { class: 'side-open', onclick: () => { UI.sidebar = true; renderNow(); } }, '» Filter') : null,
      h('h1', null, 'Kalender ' + y),
      h('p', { class: 'muted' }, 'Maus über einen Tag oder eine Markierung zeigt, was dahintersteckt. Klick auf eine Markierung öffnet die Maßnahme.')),
    h('div', { class: 'cal' }, Array.from({ length: 12 }, (_, i) => monthCard(y, i + 1, byDay, vacs, today))));
};
