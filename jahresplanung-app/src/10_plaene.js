/* ===================================================================== Ansicht: Detailpläne (Gantt, Rückwärtsterminierung ab PAL) */

const STEP_TYPES = { gruppe: 'Abschnitt', aufgabe: 'Aufgabe', meilenstein: 'Meilenstein', ziel: 'Ziel' };
const PL_ROW = 32;

async function createPlan(id) {
  const x = C.byId.get(id); if (!x) return;
  const others = C.ms.filter(o => o.m.plan && o.id !== id);
  let src = 'mailing';
  const ok = await modal('Detailplan anlegen für „' + x.m.name + '“', h('div', { class: 'form' },
    h('p', null, 'Die Arbeitsschritte werden rückwärts vom PAL aus terminiert. Start Selektion und Start inhaltliche Arbeit der Maßnahme ergeben sich dann aus dem Plan.'),
    h('label', { class: 'check' }, h('input', { type: 'radio', name: 'src', checked: true, onchange: () => { src = 'mailing'; } }), 'Vorlage Mailing (Schritte wie Sommer-/Weihnachtsmailing)'),
    others.map(o => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'src', onchange: () => { src = o.id; } }), 'Kopie des Plans von „' + o.m.name + '“')),
    h('label', { class: 'check' }, h('input', { type: 'radio', name: 'src', onchange: () => { src = 'leer'; } }), 'Leerer Plan')),
    [['Abbrechen', false], ['Anlegen', true, 'primary']]);
  if (!ok) return;
  commit(d => {
    const m = findM(d, id);
    let plan;
    if (src === 'mailing') plan = JSON.parse(JSON.stringify(MAILING_TEMPLATE));
    else if (src === 'leer') plan = { steps: [{ id: 'g1', typ: 'gruppe', name: 'Arbeitsschritte' }, { id: uid(), typ: 'ziel', name: 'Briefkasten-Termin', dauer: 0, fortschritt: 0, wer: '', kommentar: '', anker: { art: 'pal', offset: 0 } }], markS: null, markI: null };
    else plan = JSON.parse(JSON.stringify(findM(d, src).plan));
    plan.steps.forEach(s => { s.fortschritt = 0; });
    m.plan = plan;
  }, 'Detailplan angelegt');
  UI.view = 'plaene'; UI.planSel = id; renderNow();
}
async function removePlan(id) {
  const x = C.byId.get(id);
  if (!await confirmBox('Detailplan entfernen', `Den Detailplan von „${x.m.name}“ löschen? Die aktuellen Vorläufe (${x.vS ?? '–'} / ${x.vI ?? '–'} Tage) bleiben als feste Werte erhalten.`, 'Entfernen')) return;
  commit(d => { const m = findM(d, id); m.vorlaufS = x.vS; m.vorlaufI = x.vI; m.plan = null; }, 'Detailplan entfernt');
}
function setStep(mid, sid, fn, msg) { commit(d => { const s = findM(d, mid).plan.steps.find(q => q.id === sid); if (s) fn(s); }, msg); }
function moveStep(mid, sid, dir) {
  commit(d => { const st = findM(d, mid).plan.steps, i = st.findIndex(q => q.id === sid), j = i + dir; if (j < 0 || j >= st.length) return; [st[i], st[j]] = [st[j], st[i]]; });
}
function addStep(mid, afterId, typ = 'aufgabe') {
  const nid = uid();
  commit(d => {
    const p = findM(d, mid).plan, i = afterId ? p.steps.findIndex(q => q.id === afterId) : p.steps.length - 1;
    const s = typ === 'gruppe' ? { id: nid, typ, name: 'Neuer Abschnitt' } : { id: nid, typ, name: 'Neuer Schritt', wer: '', kommentar: '', dauer: 5, fortschritt: 0, anker: { art: 'pal', offset: 0 } };
    p.steps.splice(i + 1, 0, s);
  });
  UI.focusFk = 'st:' + nid + ':name';
}
function deleteStep(mid, sid) {
  let n = 0;
  commit(d => {
    const p = findM(d, mid).plan;
    p.steps = p.steps.filter(q => q.id !== sid);
    p.steps.forEach(q => { if (q.anker && q.anker.ref === sid) { q.anker = { art: 'offen' }; n++; } });
    if (p.markS === sid) p.markS = null;
    if (p.markI === sid) p.markI = null;
  }, 'Schritt gelöscht');
  if (n) toast(n + ' Schritt(e) hingen an diesem Schritt und sind jetzt „offen“.', 'warn');
}

function anchorSelect(x, s) {
  const a = s.anker || { art: 'offen' }, cur = a.art === 'start' || a.art === 'ende' ? a.art + ':' + a.ref : a.art;
  const others = [];
  let grp = '';
  for (const o of x.m.plan.steps) { if (o.typ === 'gruppe') { grp = o.name; continue; } if (o.id !== s.id) others.push([o, grp]); }
  const opt = (v, t) => h('option', { value: v, selected: v === cur }, t);
  return h('select', { class: 'anchor', 'data-fk': 'st:' + s.id + ':anker', onchange: e => {
    const v = e.target.value, [art, ref] = v.split(':');
    setStep(x.id, s.id, st => { st.anker = { art, offset: art === 'pal' || art === 'start' || art === 'ende' ? (+(st.anker || {}).offset || 0) : 0 }; if (ref) st.anker.ref = ref; if (art === 'fest') st.anker.datum = ds((x.pc.map.get(s.id) || {}).end ?? x.pal ?? todayDn()); });
  } },
  opt('pal', 'PAL (Briefkasten)'),
  h('optgroup', { label: 'Beginn von …' }, others.map(([o, g]) => opt('start:' + o.id, o.name + (g ? ' (' + g + ')' : '')))),
  h('optgroup', { label: 'Ende von …' }, others.map(([o, g]) => opt('ende:' + o.id, o.name + (g ? ' (' + g + ')' : '')))),
  opt('fest', 'festes Datum'), opt('offen', 'offen (ohne Datum)'));
}

VIEW_FN.plaene = main => {
  const withPlan = C.ms.filter(x => x.m.plan);
  const cand = C.ms.filter(x => !x.m.plan && (x.pal == null || inYear(x, UI.year)));
  if (!withPlan.some(x => x.id === UI.planSel)) UI.planSel = (withPlan.find(x => inYear(x, UI.year)) || withPlan[0] || {}).id || null;
  let newFor = cand[0] ? cand[0].id : null;
  const tabs = h('div', { class: 'ptabs' },
    withPlan.map(x => h('button', { class: 'ptab' + (x.id === UI.planSel ? ' on' : ''), style: { '--c': x.color }, onclick: () => { UI.planSel = x.id; renderNow(); } },
      h('span', { class: 'dot', style: { background: x.color } }), x.m.name, h('span', { class: 'muted' }, ' ' + (x.pal != null ? fmtS(x.pal) + ymd(x.pal)[0] : '')))),
    cand.length ? h('span', { class: 'pnew' }, h('select', { onchange: e => { newFor = e.target.value; } }, cand.map(x => h('option', { value: x.id }, x.m.name))),
      h('button', { onclick: () => newFor && createPlan(newFor) }, '+ Detailplan anlegen')) : null);
  put(main, h('div', { class: 'view-head' }, h('h1', null, 'Detailpläne'),
    h('p', { class: 'muted' }, 'Wie das Gantt im Excel: Jeder Schritt endet an einem Bezugspunkt (PAL, Beginn oder Ende eines anderen Schritts) und beginnt „Dauer“ Kalendertage davor.')), tabs);
  const x = C.byId.get(UI.planSel);
  if (!x) { put(main, h('div', { class: 'empty' }, 'Noch kein Detailplan vorhanden. Oben eine Maßnahme wählen und „Detailplan anlegen“.')); return; }
  const m = x.m, p = m.plan, pc = x.pc, today = todayDn();
  const stepOpts = sel => p.steps.filter(s => s.typ !== 'gruppe').map(s => h('option', { value: s.id, selected: sel === s.id }, s.name));
  put(main, h('div', { class: 'phead', style: { borderColor: x.color } },
    h('div', { class: 'pt' }, h('h2', { style: { color: mix(x.color, 0.1, '#000000') } }, m.name),
      h('label', { class: 'inl' }, 'PAL ', dateInput(m.pal, 'pl:pal', v => setM(m.id, 'pal', v || null)), h('span', { class: 'wdn' }, x.pal != null ? WDL[wd(x.pal)] : ''))),
    h('div', { class: 'pmarks' },
      h('label', null, h('span', { class: 'chip S', style: chipStyle('S', x.color) }, 'S'), ' Start Selektion = Beginn von ',
        h('select', { onchange: e => commit(d => { findM(d, m.id).plan.markS = e.target.value || null; }) }, h('option', { value: '' }, '–'), stepOpts(p.markS)),
        h('b', null, ' ' + fmtW(x.s)), h('span', { class: 'muted' }, x.vS != null ? ' (Vorlauf ' + x.vS + ' Tage)' : '')),
      h('label', null, h('span', { class: 'chip I', style: chipStyle('I', x.color) }, 'I'), ' Start inhaltliche Arbeit = Beginn von ',
        h('select', { onchange: e => commit(d => { findM(d, m.id).plan.markI = e.target.value || null; }) }, h('option', { value: '' }, '–'), stepOpts(p.markI)),
        h('b', null, ' ' + fmtW(x.i)), h('span', { class: 'muted' }, x.vI != null ? ' (Vorlauf ' + x.vI + ' Tage)' : ''))),
    h('div', { class: 'tools' },
      h('button', { onclick: () => addStep(m.id, null) }, '+ Schritt'), h('button', { onclick: () => addStep(m.id, null, 'gruppe') }, '+ Abschnitt'),
      h('button', { class: 'icon', 'aria-label': 'Gantt verkleinern', onclick: () => { UI.planPxd = clamp((UI.planPxd || fitP) / 1.4, 2, 40); renderNow(); } }, '−'),
      h('button', { class: 'icon', 'aria-label': 'Gantt vergrößern', onclick: () => { UI.planPxd = clamp((UI.planPxd || fitP) * 1.4, 2, 40); renderNow(); } }, '+'),
      UI.planPxd ? h('button', { onclick: () => { UI.planPxd = 0; renderNow(); } }, 'Einpassen') : null,
      h('button', { class: 'danger', onclick: () => removePlan(m.id) }, 'Plan entfernen'))));

  // ---- Zeitraum des Gantt
  const dates = [...pc.map.values()].flatMap(r => [r.start, r.end]).filter(v => v != null).concat(x.pal != null ? [x.pal] : []);
  const g0 = dates.length ? Math.min(...dates) - 4 : (x.pal ?? today) - 60, g1 = dates.length ? Math.max(...dates) + 6 : (x.pal ?? today) + 14;
  const a0 = g0 - wd(g0), a1 = g1 + (6 - wd(g1)), fitP = Math.max(3, (innerWidth - 1030 - 70) / (a1 - a0 + 1)), pxd = UI.printing ? Math.max(3, 620 / (a1 - a0 + 1)) : (UI.planPxd || fitP), W = (a1 - a0 + 1) * pxd, X = n => (n - a0) * pxd;
  const ghead = h('div', { class: 'g-head', style: { width: W + 'px' } });
  for (let n = a0; n <= a1;) { const [yy, mm] = ymd(n), e = Math.min(a1, mkdn(yy, mm, daysIn(yy, mm))); ghead.append(h('div', { class: 'gm', style: { left: X(n) + 'px', width: (e - n + 1) * pxd + 'px' } }, (e - n + 1) * pxd > 60 ? MON[mm - 1] + ' ' + yy : MONS[mm - 1])); n = e + 1; }
  for (let n = a0; n <= a1; n += 7) ghead.append(h('div', { class: 'gw', style: { left: X(n) + 'px', width: 7 * pxd + 'px' } }, pxd * 7 > 40 ? 'KW ' + isoWeek(n) : pxd * 7 > 16 ? isoWeek(n) : ''));
  if (pxd >= 14) for (let n = a0; n <= a1; n++) ghead.append(h('div', { class: 'gd' + (wd(n) >= 5 ? ' we' : ''), style: { left: X(n) + 'px', width: pxd + 'px' } }, ymd(n)[2]));
  const gbg = h('div', { class: 'g-bg', style: { width: W + 'px', height: p.steps.length * PL_ROW + 'px' } });
  for (let n = a0; n <= a1; n++) {
    if (wd(n) >= 5) gbg.append(h('div', { class: 'we', style: { left: X(n) + 'px', width: pxd + 'px' } }));
    const hn = holName(n); if (hn) gbg.append(h('div', { class: 'hol', style: { left: X(n) + 'px', width: pxd + 'px' }, tip: 'Feiertag: ' + hn }));
  }
  if (today >= a0 && today <= a1) gbg.append(h('div', { class: 'today', style: { left: X(today) + pxd / 2 + 'px' }, tip: 'Heute' }));
  if (x.pal != null) gbg.append(h('div', { class: 'palline', style: { left: X(x.pal) + pxd / 2 + 'px' } }, h('span', null, 'PAL')));

  const trows = [], grows = [];
  let grp = '';
  p.steps.forEach((s, idx) => {
    const r = pc.map.get(s.id) || {}, fk = f => 'st:' + s.id + ':' + f, isG = s.typ === 'gruppe';
    if (isG) grp = s.name;
    const away = !isG && s.wer && r.start != null ? C.vac.filter(v => v.u.wer === s.wer && v.von <= Math.max(r.end, r.start) && v.bis >= r.start) : [];
    const acts = menuButton('⋯', [['Schritt darunter einfügen', () => addStep(m.id, s.id)], ['Abschnitt darunter einfügen', () => addStep(m.id, s.id, 'gruppe')],
      ['Nach oben', () => moveStep(m.id, s.id, -1)], ['Nach unten', () => moveStep(m.id, s.id, 1)], null, ['Löschen', () => deleteStep(m.id, s.id)]], 'right');
    const a = s.anker || { art: 'offen' };
    trows.push(h('div', { class: 'pl-row' + (isG ? ' grp' : '') + (away.length ? ' conflict' : ''), dataset: { flash: 'step:' + s.id } },
      h('div', { class: 'c-move' }, h('button', { class: 'mini', disabled: idx === 0, 'aria-label': 'nach oben', onclick: () => moveStep(m.id, s.id, -1) }, '▲'), h('button', { class: 'mini', disabled: idx === p.steps.length - 1, 'aria-label': 'nach unten', onclick: () => moveStep(m.id, s.id, 1) }, '▼')),
      h('div', { class: 'c-name' }, h('input', { value: s.name, 'data-fk': fk('name'), onchange: e => setStep(m.id, s.id, st => { st.name = e.target.value; }) })),
      isG ? h('div', { class: 'c-rest muted' }, 'Abschnitt') : [
        h('div', { class: 'c-typ' }, h('select', { 'data-fk': fk('typ'), onchange: e => setStep(m.id, s.id, st => { st.typ = e.target.value; }) }, Object.entries(STEP_TYPES).filter(([k]) => k !== 'gruppe').map(([k, t]) => h('option', { value: k, selected: s.typ === k }, t)))),
        h('div', { class: 'c-wer' }, h('input', { value: s.wer || '', list: 'dl-personen', placeholder: '–', 'data-fk': fk('wer'), onchange: e => setStep(m.id, s.id, st => { st.wer = e.target.value.trim(); }) }),
          away.length ? h('span', { class: 'wi warn', tip: s.wer + ' hat Urlaub: ' + away.map(v => fmtS(v.von) + '–' + fmtS(v.bis)).join(', ') }, '⚠') : null),
        h('div', { class: 'c-kom' }, h('input', { value: s.kommentar || '', placeholder: '–', 'data-fk': fk('kom'), onchange: e => setStep(m.id, s.id, st => { st.kommentar = e.target.value; }) })),
        h('div', { class: 'c-dur' }, s.typ === 'aufgabe' ? h('input', { type: 'number', min: 0, value: s.dauer ?? 0, 'data-fk': fk('dur'), onchange: e => setStep(m.id, s.id, st => { st.dauer = Math.max(0, Math.round(+e.target.value || 0)); }) }) : null),
        h('div', { class: 'c-anchor' }, anchorSelect(x, s),
          a.art === 'fest' ? dateInput(a.datum, fk('datum'), v => setStep(m.id, s.id, st => { st.anker.datum = v; })) :
          (a.art === 'pal' || a.art === 'start' || a.art === 'ende') ? h('input', { type: 'number', class: 'off', value: a.offset || 0, tip: 'Tage Versatz (+ später, − früher)', 'data-fk': fk('off'),
            onchange: e => setStep(m.id, s.id, st => { st.anker.offset = Math.round(+e.target.value || 0); }) }) : null),
        h('div', { class: 'c-date' + (r.err ? ' err' : ''), tip: r.err || null }, r.err ? '⚠ ' + r.err : s.typ === 'aufgabe' ? fmtWS(r.start) : ''),
        h('div', { class: 'c-date' }, r.err ? '' : fmtWS(r.end)),
        h('div', { class: 'c-pct' }, s.typ === 'aufgabe' ? h('input', { type: 'number', min: 0, max: 100, step: 10, value: +s.fortschritt || 0, 'data-fk': fk('pct'),
          onchange: e => setStep(m.id, s.id, st => { st.fortschritt = clamp(Math.round(+e.target.value || 0), 0, 100); }) }) : null)],
      h('div', { class: 'c-acts' }, acts)));
    // Gantt-Zeile
    const g = h('div', { class: 'g-row' + (isG ? ' grp' : '') });
    if (!isG && s.wer) for (const v of C.vac.filter(v => v.u.wer === s.wer && v.bis >= a0 && v.von <= a1))
      g.append(h('div', { class: 'g-vac', style: { left: X(Math.max(v.von, a0)) + 'px', width: (Math.min(v.bis, a1) - Math.max(v.von, a0) + 1) * pxd + 'px' }, tip: s.wer + ': Urlaub ' + fmtS(v.von) + '–' + fmtS(v.bis) }));
    if (!isG && r.start != null) {
      const tip = () => h('div', null, h('b', null, s.name), grp ? h('span', { class: 'muted' }, ' (' + grp + ')') : null,
        h('div', null, s.typ === 'aufgabe' ? fmtW(r.start) + ' – ' + fmtW(r.end) + ' · ' + s.dauer + ' Tage' : STEP_TYPES[s.typ] + ': ' + fmtW(r.end)),
        s.wer ? h('div', null, 'Zugeordnet: ' + s.wer) : null, s.kommentar ? h('div', { class: 'muted' }, s.kommentar) : null,
        away.length ? h('div', { class: 'warn' }, '⚠ ' + s.wer + ' hat in dieser Zeit Urlaub') : null,
        s.typ === 'aufgabe' ? h('div', { class: 'tt-foot' }, 'Linke Kante ziehen = Dauer ändern') : null);
      if (s.typ === 'aufgabe') {
        const bar = h('div', { class: 'g-bar' + (away.length ? ' conflict' : ''), tip, style: { left: X(r.start) + 'px', width: Math.max(3, (r.end - r.start) * pxd) + 'px', background: pastel(x.color), borderColor: x.color } },
          h('span', { class: 'prog', style: { width: clamp(+s.fortschritt || 0, 0, 100) + '%', background: midtone(x.color) } }),
          (r.end - r.start) * pxd > 70 ? h('span', { class: 'lbl' }, s.name) : null);
        const grip = h('span', { class: 'grip', 'aria-label': 'Dauer ändern' });
        grip.addEventListener('pointerdown', ev => durDrag(ev, x, s, r, pxd, bar, X));
        bar.append(grip);
        g.append(bar);
      } else g.append(h('div', { class: 'g-dia' + (s.typ === 'ziel' ? ' ziel' : ''), tip, style: { left: X(r.end) + pxd / 2 + 'px', background: s.typ === 'ziel' ? '#E30714' : x.color } }));
    }
    grows.push(g);
  });
  const thead = h('div', { class: 'pl-row head' }, h('div', { class: 'c-move' }), h('div', { class: 'c-name' }, 'Arbeitsschritt'), h('div', { class: 'c-typ' }, 'Typ'), h('div', { class: 'c-wer' }, 'Zugeordnet'),
    h('div', { class: 'c-kom' }, 'Kommentar'), h('div', { class: 'c-dur' }, 'Dauer'), h('div', { class: 'c-anchor' }, 'endet am … (± Tage)'), h('div', { class: 'c-date' }, 'Start'), h('div', { class: 'c-date' }, 'Ende'),
    h('div', { class: 'c-pct' }, '%'), h('div', { class: 'c-acts' }));
  put(main, personList(), h('div', { class: 'pl-split' },
    h('div', { class: 'pl-table' }, thead, trows),
    (() => { const g = h('div', { class: 'pl-gantt', 'data-keep-scroll': 'plg' }, h('div', { style: { width: W + 'px' } }, ghead, h('div', { class: 'g-body' }, gbg, grows))); tlPan(g); return g; })()));
};
VIEW_FN['plaene:after'] = () => {
  if (UI.focusFk) { const e = $('[data-fk="' + CSS.escape(UI.focusFk) + '"]'); if (e) { e.focus(); e.select && e.select(); } UI.focusFk = null; }
};
function durDrag(ev, x, s, r, pxd, bar, X) {
  if (ev.button !== 0) return;
  ev.preventDefault(); ev.stopPropagation(); hideTip();
  const el = ev.currentTarget, sx = ev.clientX;
  el.setPointerCapture(ev.pointerId);
  document.body.classList.add('dragging');
  const lab = h('div', { class: 'drag-lab' }); document.body.append(lab);
  let dur = +s.dauer || 0;
  const move = e => {
    const dd = Math.round((e.clientX - sx) / pxd);
    dur = Math.max(0, (+s.dauer || 0) - dd);
    const st = r.end - dur;
    bar.style.left = X(st) + 'px'; bar.style.width = Math.max(3, dur * pxd) + 'px';
    const w = dateWarn(st, s.wer);
    lab.replaceChildren(h('b', null, s.name + ': ' + dur + ' Tage'), h('div', null, 'Beginn ' + fmtW(st)), w.length ? h('div', { class: 'warn' }, '⚠ ' + w.join(' · ')) : null);
    placeLab(lab, e.clientX, e.clientY);
  };
  const up = () => {
    el.removeEventListener('pointermove', move); document.body.classList.remove('dragging'); lab.remove();
    if (dur !== (+s.dauer || 0)) setStep(x.id, s.id, st => { st.dauer = dur; }, s.name + ': Dauer ' + dur + ' Tage');
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up, { once: true });
  el.addEventListener('pointercancel', up, { once: true });
  move(ev);
}
