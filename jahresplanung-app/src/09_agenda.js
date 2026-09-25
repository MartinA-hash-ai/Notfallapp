/* ===================================================================== Ansicht: Was steht an? */

function setStepDone(mid, sid, done) {
  commit(d => { const s = findM(d, mid).plan.steps.find(q => q.id === sid); s.fortschritt = done ? 100 : 0; }, done ? 'Als erledigt markiert' : 'Wieder offen');
}
function agendaSection() {
  const today = todayDn(), from = UI.agendaFrom != null ? UI.agendaFrom : today, to = from + UI.agendaWeeks * 7 - 1;
  const withSteps = UI.agendaSteps !== false, withVac = UI.agendaVac !== false;
  const items = [], running = [], overdue = [];
  for (const e of eventsIn(from, to)) items.push({ n: e.n, kind: 'ev', e });
  if (withSteps) for (const x of C.ms) {
    if (!x.pc || !visibleM(x)) continue;
    let grp = '';
    for (const s of x.m.plan.steps) {
      if (s.typ === 'gruppe') { grp = s.name; continue; }
      const r = x.pc.map.get(s.id);
      if (!r || r.start == null) continue;
      const done = (+s.fortschritt || 0) >= 100, it = { x, s, r, grp, done };
      if (s.typ === 'aufgabe') {
        if (r.start >= from && r.start <= to) items.push(Object.assign({ n: r.start, kind: 'start' }, it));
        if (r.end >= from && r.end <= to && r.end !== r.start) items.push(Object.assign({ n: r.end, kind: 'end' }, it));
        if (r.start < from && r.end > from && !done) running.push(it);
        if (r.end < today && !done) overdue.push(it);
      } else if (r.end >= from && r.end <= to) items.push(Object.assign({ n: r.end, kind: 'ms' }, it));
    }
  }
  if (withVac) {
    for (const v of C.vac) if (vacVisible(v) && v.bis >= from && v.von <= to) items.push({ n: Math.max(v.von, from), kind: 'vac', v, ongoing: v.von < from });
    for (let n = from; n <= to; n++) { const hn = holName(n); if (hn) items.push({ n, kind: 'hol', hn }); }
  }
  items.sort((a, b) => a.n - b.n || ['hol', 'vac', 'ev', 'ms', 'end', 'start'].indexOf(a.kind) - ['hol', 'vac', 'ev', 'ms', 'end', 'start'].indexOf(b.kind));

  const stepLine = it => h('span', { class: 'stxt' },
    h('span', { class: 'dot', style: { background: it.x.color } }), it.x.m.name, h('span', { class: 'muted' }, ' › ' + (it.grp ? it.grp + ' › ' : '')), h('b', null, it.s.name),
    it.s.wer ? h('span', { class: 'who', style: { background: pastel(personColor(it.s.wer)) } }, it.s.wer) : null);
  const doneBox = it => h('input', { type: 'checkbox', class: 'done', checked: it.done, tip: 'erledigt', 'aria-label': 'erledigt', onchange: e => setStepDone(it.x.id, it.s.id, e.target.checked) });
  const row = it => {
    const dcol = h('div', { class: 'ad' }, h('b', null, fmtWS(it.n)), h('span', { class: 'rel' + (it.n < today ? ' past' : it.n - today <= 7 ? ' soon' : '') }, relDays(it.n, today)));
    let what;
    if (it.kind === 'ev') {
      const w = dateWarn(it.n, it.e.x.m.verantwortlich).filter(t => it.e.t !== 'P' || !/Samstag|Urlaub/.test(t));
      what = h('div', { class: 'aw' }, chip(it.e), h('span', { class: 'stxt' }, h('b', null, it.e.x.m.name), ' – ' + TYPE_LABEL[it.e.t],
        it.e.t === 'P' && it.e.x.m.palStatus !== 'fest' ? h('span', { class: 'tag vorl' }, 'vorläufig') : null,
        it.e.x.m.verantwortlich ? h('span', { class: 'who', style: { background: pastel(personColor(it.e.x.m.verantwortlich)) } }, it.e.x.m.verantwortlich) : null,
        w.length ? h('span', { class: 'warn small' }, ' ⚠ ' + w.join(' · ')) : null));
    } else if (it.kind === 'vac') {
      const c = personColor(it.v.u.wer);
      what = h('div', { class: 'aw' }, h('span', { class: 'vtag', style: { background: pastel(c), borderColor: c } }, it.v.u.wer || '?'),
        h('span', { class: 'stxt' }, (it.ongoing ? 'im Urlaub bis ' : 'Urlaub ') + (it.ongoing ? fmtW(it.v.bis) : fmtS(it.v.von) + ' – ' + fmtW(it.v.bis)), h('span', { class: 'muted' }, ' · ' + workdays(it.v.von, it.v.bis) + ' Arbeitstage')));
    } else if (it.kind === 'hol') {
      what = h('div', { class: 'aw' }, h('span', { class: 'lg hol' }), h('span', { class: 'stxt muted' }, 'Feiertag: ' + it.hn));
    } else {
      const lab = it.kind === 'start' ? 'Beginn' : it.kind === 'end' ? 'Fällig' : it.s.typ === 'ziel' ? 'Ziel' : 'Meilenstein';
      what = h('div', { class: 'aw' + (it.done ? ' isdone' : '') }, it.kind === 'ms' ? h('span', { class: 'sdia inline', style: { background: it.s.typ === 'ziel' ? '#E30714' : it.x.color } }) : h('span', { class: 'kind ' + it.kind }, lab),
        stepLine(it), it.kind !== 'ms' ? doneBox(it) : null);
    }
    return h('div', { class: 'arow ' + it.kind }, dcol, what);
  };
  const list = h('div', { class: 'agenda' });
  if (overdue.length && from <= today) list.append(h('section', { class: 'aweek overdue' }, h('h3', null, 'Überfällig (' + overdue.length + ')'),
    overdue.map(it => h('div', { class: 'arow' }, h('div', { class: 'ad' }, h('b', null, 'bis ' + fmtWS(it.r.end)), h('span', { class: 'rel past' }, relDays(it.r.end, today))),
      h('div', { class: 'aw' }, h('span', { class: 'kind end' }, (+it.s.fortschritt || 0) + ' %'), stepLine(it), doneBox(it))))));
  if (running.length) list.append(h('section', { class: 'aweek' }, h('h3', null, 'Läuft gerade'),
    running.map(it => h('div', { class: 'arow' }, h('div', { class: 'ad' }, h('b', null, 'bis ' + fmtWS(it.r.end)), h('span', { class: 'rel' }, relDays(it.r.end, today))),
      h('div', { class: 'aw' }, h('span', { class: 'kind run' }, 'läuft'), stepLine(it), h('span', { class: 'muted small' }, ' seit ' + fmtS(it.r.start)), doneBox(it))))));
  let wk = null, sec = null;
  for (const it of items) {
    const mon = it.n - wd(it.n);
    if (mon !== wk) {
      wk = mon;
      sec = h('section', { class: 'aweek' }, h('h3', null, 'KW ' + isoWeek(mon) + '  ·  ' + fmtS(mon) + ' – ' + fmtD(mon + 6)));
      list.append(sec);
    }
    sec.append(row(it));
  }
  if (!items.length && !running.length) {
    const next = C.ms.filter(visibleM).flatMap(x => TYPES.filter(([t]) => UI.show[t]).map(([t, k]) => ({ n: x[k], t, x }))).filter(e => e.n != null && e.n > to).sort((a, b) => a.n - b.n)[0];
    list.append(h('div', { class: 'empty' }, 'In diesem Zeitraum steht nichts an.',
      next ? h('div', null, 'Nächster Termin: ', chip(next), ' ' + next.x.m.name + ' – ' + TYPE_LABEL[next.t] + ' am ' + fmtW(next.n) + ' (' + relDays(next.n, today) + ') ',
        h('button', { class: 'link', onclick: () => { UI.agendaFrom = next.n - wd(next.n); renderNow(); } }, 'dorthin springen')) : null));
  }
  const wBtn = n => h('button', { class: 'seg-btn' + (UI.agendaWeeks === n ? ' on' : ''), onclick: () => { UI.agendaWeeks = n; renderNow(); } }, n + ' Wo.');
  return {
    summary: fmtWS(from) + ' – ' + fmtWS(to),
    tools: [
      h('span', { class: 'segs' }, [1, 2, 4, 8, 12].map(wBtn)),
      h('label', { class: 'inl small' }, 'ab ', dateInput(ds(from), 'ag:from', v => { if (dn(v) != null) { UI.agendaFrom = dn(v); renderNow(); } })),
      UI.agendaFrom != null && UI.agendaFrom !== today ? h('button', { class: 'ghostbtn', onclick: () => { UI.agendaFrom = null; renderNow(); } }, 'Heute') : null,
      h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: withSteps, onchange: e => { UI.agendaSteps = e.target.checked; renderNow(); } }), 'Arbeitsschritte'),
      h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: withVac, onchange: e => { UI.agendaVac = e.target.checked; renderNow(); } }), 'Urlaub/Feiertage')],
    body: [list],
  };
}
