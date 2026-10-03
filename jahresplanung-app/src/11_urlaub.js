/* ===================================================================== Ansicht: Urlaub & Feiertage */

// Urlaub / Abwesenheit eintragen: das ganze Jahr auf einen Blick. Person (aus den Einstellungen) und Art wählen, Tage anklicken oder mit
// gedrückter Maus Zeiträume ziehen. Jede Markierung behält die Person und Art, die beim Markieren eingestellt war – man kann also nacheinander
// Urlaub und Abwesenheiten für mehrere Personen markieren. „Speichern“ legt je zusammenhängendem Zeitraum (gleiche Person, gleiche Art) einen Eintrag an.
async function addVac() {
  const names = D.personen.map(p => p.name).filter(Boolean);
  const t0 = todayDn();
  const st = { wer: names.includes(UI.userName) ? UI.userName : names[0] || '', art: 'urlaub', notiz: '', year: UI.year, picks: new Map() };   // picks: Person → (Tag → Art)
  let drag = null, saveBtn = null;
  const mine = () => { if (!st.picks.has(st.wer)) st.picks.set(st.wer, new Map()); return st.picks.get(st.wer); };
  const busyDays = () => { const out = new Map(); for (const v of C.vac) if (v.u.wer === st.wer) for (let n = v.von; n <= v.bis; n++) out.set(n, vacKind(v.u)); return out; };
  const rangesOf = mp => { const out = []; for (const n of [...mp.keys()].sort((p, q) => p - q)) { const l = out[out.length - 1], art = mp.get(n); if (l && n === l[1] + 1 && l[2] === art) l[1] = n; else out.push([n, n, art]); } return out; };
  const cal = h('div', { class: 'vd-months' }), sum = h('div', { class: 'vd-sum' }), body = h('div', { class: 'vdlg' });
  const fmtR = ([a, b]) => a === b ? fmtS(a) : fmtS(a) + '–' + fmtS(b);
  const paint = () => {                            // Markierungen der gewählten Person (mit Vorschau beim Ziehen), Zusammenfassung aller Personen
    const busy = busyDays(), mp = mine(), pv = drag ? new Set(drag.range) : null, c = personColor(st.wer);
    cal.style.setProperty('--vc', c); cal.style.setProperty('--vc2', mix(c, 0.55));
    for (const el of $$('.vd-day[data-dn]', cal)) {
      const n = +el.dataset.dn;
      let art = mp.get(n);
      if (pv && pv.has(n)) art = drag.mode === 'add' ? st.art : undefined;
      el.classList.toggle('sel', !!art); el.classList.toggle('abw', art === 'abwesenheit'); el.classList.toggle('busy', busy.has(n));
      el.title = busy.has(n) ? st.wer + ': ' + busy.get(n) + ' schon eingetragen' : art ? (art === 'abwesenheit' ? 'Abwesenheit' : 'Urlaub') + ' (markiert)' : holName(n) || '';
    }
    const lines = [];
    for (const [wer, mp2] of st.picks) {
      if (!mp2.size) continue;
      const rg = rangesOf(mp2);
      for (const art of ['urlaub', 'abwesenheit']) {
        const r = rg.filter(x => x[2] === art); if (!r.length) continue;
        const at = r.reduce((t, [a, b]) => t + workdays(a, b), 0);
        lines.push(h('div', { class: 'vd-line' }, h('span', { class: 'vdot', style: { background: personColor(wer) } }), h('b', null, wer + ' · ' + (art === 'abwesenheit' ? 'Abwesenheit' : 'Urlaub')),
          ' ' + r.length + (r.length === 1 ? ' Zeitraum' : ' Zeiträume') + ' · ' + at + (at === 1 ? ' Arbeitstag' : ' Arbeitstage') + ' ', h('span', { class: 'muted' }, r.map(fmtR).join(', '))));
      }
    }
    setKids(sum, !st.wer ? h('span', { class: 'warn' }, 'Bitte zuerst eine Person wählen.') : lines.length ? lines
      : h('span', { class: 'muted' }, 'Tage anklicken oder mit gedrückter Maus über mehrere Tage ziehen. Person oder Art wechseln geht jederzeit – bisher Markiertes bleibt so, wie es markiert wurde.'));
    if (saveBtn) saveBtn.disabled = !lines.length;
  };
  const month = (yy, mo) => {
    const first = mkdn(yy, mo, 1), last = first + daysIn(yy, mo) - 1, g = h('div', { class: 'vd-grid' }, WD.map((d, i) => h('div', { class: 'vd-wh' + (i >= 5 ? ' we' : '') }, d)));
    for (let i = 0; i < wd(first); i++) g.append(h('div', { class: 'vd-day out' }));
    for (let n = first; n <= last; n++) g.append(h('div', { class: 'vd-day' + (wd(n) >= 5 ? ' we' : '') + (holName(n) ? ' hol' : '') + (n === t0 ? ' today' : ''), dataset: { dn: n } }, ymd(n)[2]));
    return h('div', { class: 'vd-month' }, h('div', { class: 'vd-mh' }, MON[mo - 1]), g);
  };
  const yLab = h('b', { class: 'vd-year' });
  const drawCal = () => { yLab.textContent = st.year; setKids(cal, Array.from({ length: 12 }, (_, i) => month(st.year, i + 1))); paint(); };
  // Klicken / Ziehen: beginnt man auf einem Tag, der schon so markiert ist (gleiche Art), wird abgewählt – sonst mit der eingestellten Art markiert
  const dayAt = e => { const el = document.elementFromPoint(e.clientX, e.clientY); const c = el && el.closest && el.closest('.vd-day[data-dn]'); return c ? +c.dataset.dn : null; };
  cal.addEventListener('pointerdown', e => {
    const n = dayAt(e); if (n == null || e.button !== 0 || !st.wer) return;
    const busy = busyDays(); if (busy.has(n)) return;
    e.preventDefault(); try { cal.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    drag = { a: n, mode: mine().get(n) === st.art ? 'del' : 'add', range: [n], busy }; paint();
  });
  cal.addEventListener('pointermove', e => { if (!drag) return; const n = dayAt(e); if (n == null) return;
    const lo = Math.min(drag.a, n), hi = Math.max(drag.a, n); drag.range = []; for (let k = lo; k <= hi; k++) if (!drag.busy.has(k)) drag.range.push(k); paint(); });
  cal.addEventListener('pointerup', () => { if (!drag) return; const mp = mine(); drag.range.forEach(n => drag.mode === 'add' ? mp.set(n, st.art) : mp.delete(n)); drag = null; paint(); });
  cal.addEventListener('pointercancel', () => { drag = null; paint(); });
  const seg = (k, label) => h('button', { class: 'seg-btn' + (st.art === k ? ' on' : ''), dataset: { art: k }, onclick: () => { st.art = k; $$('.vd-art .seg-btn', body).forEach(b => b.classList.toggle('on', b.dataset.art === k)); paint(); } }, label);
  setKids(body,
    h('div', { class: 'vd-top' },
      h('label', { class: 'vd-f' }, h('span', null, 'Person'), names.length ? h('select', { class: 'vd-wer', onchange: e => { st.wer = e.target.value; paint(); } }, names.map(n => h('option', { value: n, selected: n === st.wer }, n)))
        : h('span', { class: 'warn' }, 'Noch keine Personen – unter ⋯ → Einstellungen anlegen.')),
      h('div', { class: 'vd-f' }, h('span', null, 'Art'), h('span', { class: 'segs vd-art' }, seg('urlaub', 'Urlaub'), seg('abwesenheit', 'Abwesenheit'))),
      h('label', { class: 'vd-f grow' }, h('span', null, 'Notiz'), h('input', { class: 'vd-notiz', placeholder: 'optional, z. B. Fortbildung – gilt für alle Einträge', oninput: e => { st.notiz = e.target.value; } })),
      h('div', { class: 'vd-f vd-yr' }, h('span', null, 'Jahr'), h('span', { class: 'vd-ynav' },
        h('button', { class: 'icon', 'aria-label': 'Vorjahr', tip: 'Vorjahr', onclick: () => { st.year--; drawCal(); } }, '‹'), yLab,
        h('button', { class: 'icon', 'aria-label': 'Folgejahr', tip: 'Folgejahr', onclick: () => { st.year++; drawCal(); } }, '›')))),
    h('div', { class: 'muted small vd-hint' }, 'Wochenenden und Feiertage sind grau, schon eingetragene Tage der gewählten Person gestreift und gesperrt.'),
    cal, sum);
  drawCal();
  const pr = modal('Urlaub / Abwesenheit eintragen', body, [['Abbrechen', false], ['Speichern', true, 'primary']], { wide: true, cls: 'vacdlg' });
  saveBtn = $('.modal.vacdlg footer button.primary'); paint();
  if (!await pr) return;
  const add = [];
  for (const [wer, mp] of st.picks) for (const [a, b, art] of rangesOf(mp)) add.push(Object.assign({ id: uid(), wer, von: ds(a), bis: ds(b), notiz: st.notiz.trim() }, art === 'abwesenheit' ? { art } : {}));
  if (!add.length) return;
  const who = [...new Set(add.map(u => u.wer))];
  commit(d => { d.urlaube.push(...add); }, add.length + (add.length === 1 ? ' Eintrag' : ' Einträge') + ' gespeichert: ' + who.join(', '));
}
function setVac(id, fn) { commit(d => { const u = d.urlaube.find(q => q.id === id); if (u) fn(u); }); }
function renamePersonTo(old, nv) {
  nv = (nv || '').trim();
  if (!nv || nv === old) return false;
  if (D.personen.some(q => q.name === nv)) { toast('„' + nv + '“ gibt es schon.', 'warn'); return false; }
  commit(d => {
    const q = d.personen.find(z => z.name === old); if (q) q.name = nv;
    d.urlaube.forEach(u => { if (u.wer === old) u.wer = nv; });
    d.massnahmen.forEach(m => { if (m.verantwortlich === old) m.verantwortlich = nv; (m.plan?.steps || []).forEach(s => { if (s.wer === old) s.wer = nv; }); });
  }, old + ' → ' + nv + ' (überall umbenannt)');
  return true;
}
function personUsed(n) {
  return D.urlaube.some(u => u.wer === n) || D.massnahmen.some(m => m.verantwortlich === n || (m.plan?.steps || []).some(s => s.wer === n));
}

VIEW_FN.urlaub = main => {
  const y = UI.year, a = mkdn(y, 1, 1), b = mkdn(y, 12, 31), nd = b - a + 1;
  const vacs = C.vac.filter(v => v.bis >= a && v.von <= b);
  const people = [...new Set([...D.personen.map(p => p.name), ...vacs.map(v => v.u.wer || '?')])];

  // ---- Übersicht: Personen × Tage
  const avail = Math.max(600, innerWidth - 150 - 80), pxd = UI.printing ? 900 / nd : avail / nd, X = n => (n - a) * pxd, W = nd * pxd;
  const mh = h('div', { class: 'um-head', style: { width: W + 'px' } });
  for (let mo = 1; mo <= 12; mo++) { const f = mkdn(y, mo, 1); mh.append(h('div', { style: { left: X(f) + 'px', width: daysIn(y, mo) * pxd + 'px' } }, pxd * 30 > 60 ? MON[mo - 1] : MONS[mo - 1])); }
  const bgl = () => {
    const bg = h('div', { class: 'um-bg' });
    for (let n = a; n <= b; n++) {
      if (wd(n) >= 5) bg.append(h('div', { class: 'we', style: { left: X(n) + 'px', width: pxd + 'px' } }));
      if (holName(n)) bg.append(h('div', { class: 'hol', style: { left: X(n) + 'px', width: Math.max(1.5, pxd) + 'px' } }));
      if (ymd(n)[2] === 1) bg.append(h('div', { class: 'ml', style: { left: X(n) + 'px' } }));
    }
    return bg;
  };
  const rows = people.map(p => {
    const t = h('div', { class: 'um-track', style: { width: W + 'px' } }, bgl());
    for (const v of vacs.filter(v => (v.u.wer || '?') === p)) {
      const s = Math.max(v.von, a), e = Math.min(v.bis, b), c = personColor(p);
      t.append(h('div', { class: 'um-bar', style: { left: X(s) + 'px', width: Math.max(3, (e - s + 1) * pxd) + 'px', background: vacFill(c, v.u) },
        tip: () => h('div', null, h('b', null, p + ' · ' + vacKind(v.u)), h('div', null, fmtW(v.von) + ' – ' + fmtW(v.bis)), h('div', { class: 'muted' }, workdays(v.von, v.bis) + ' Arbeitstage' + (v.u.notiz ? ' · ' + v.u.notiz : ''))) }));
    }
    const at = (abw) => vacs.filter(v => (v.u.wer || '?') === p && isAbw(v.u) === abw).reduce((s, v) => s + workdays(Math.max(v.von, a), Math.min(v.bis, b)), 0);
    const days = at(false), abs = at(true);
    return h('div', { class: 'um-row' }, h('div', { class: 'um-lab', tip: days + ' Arbeitstage Urlaub' + (abs ? ', ' + abs + ' Arbeitstage abwesend' : '') }, h('span', { class: 'vdot', style: { background: personColor(p) } }), p,
      h('span', { class: 'muted small' }, (days ? ' ' + days + ' AT' : '') + (abs ? ' + ' + abs + ' abw.' : ''))), t);
  });
  const cnt = h('div', { class: 'um-track count', style: { width: W + 'px' } }, bgl());
  for (let n = a; n <= b; n++) {
    const aw = vacs.filter(v => v.von <= n && n <= v.bis);
    if (!aw.length) continue;
    cnt.append(h('div', { class: 'um-c c' + Math.min(3, aw.length), style: { left: X(n) + 'px', width: Math.max(1.5, pxd) + 'px' },
      tip: () => h('div', null, h('b', null, fmtW(n)), h('div', null, aw.length + ' abwesend: '), aw.map(vacTag)) }));
  }
  const matrix = h('div', { class: 'umatrix' },
    h('div', { class: 'um-row head' }, h('div', { class: 'um-lab' }), mh),
    h('div', { class: 'um-row' }, h('div', { class: 'um-lab' }, h('b', null, 'Abwesend gesamt')), cnt), rows);

  // ---- Urlaubsliste
  const list = h('tbody');
  for (const v of D.urlaube.slice().sort((p, q) => (dn(p.von) ?? 0) - (dn(q.von) ?? 0))) {
    const fv = dn(v.von), fb = dn(v.bis) ?? fv, fk = f => 'u:' + v.id + ':' + f, bad = fv != null && fb != null && fb < fv;
    const overl = fv != null && fb >= fv ? C.vac.filter(o => o.u.id !== v.id && o.von <= fb && o.bis >= fv) : [];
    list.append(h('tr', { class: (fv != null && ymd(fv)[0] !== y && ymd(fb)[0] !== y) ? 'other' : '' },
      h('td', null, h('span', { class: 'vdot', style: { background: personColor(v.wer) } }), personInput({ value: v.wer || '', 'data-fk': fk('wer'), placeholder: 'Name', onchange: e => setVac(v.id, u => { u.wer = e.target.value.trim(); }) })),
      h('td', null, h('select', { class: 'uart', 'data-fk': fk('art'), onchange: e => setVac(v.id, u => { if (e.target.value === 'abwesenheit') u.art = 'abwesenheit'; else delete u.art; }) },
        h('option', { value: 'urlaub', selected: !isAbw(v) }, 'Urlaub'), h('option', { value: 'abwesenheit', selected: isAbw(v) }, 'Abwesenheit'))),
      h('td', null, dateInput(v.von, fk('von'), val => setVac(v.id, u => { u.von = val; if (!u.bis || dn(u.bis) < dn(u.von)) u.bis = u.von; }))),
      h('td', null, dateInput(v.bis, fk('bis'), val => setVac(v.id, u => { u.bis = val; }), { class: bad ? 'bad' : '' })),
      h('td', { class: 'num' }, fv != null && fb >= fv ? workdays(fv, fb) : '–'),
      h('td', null, h('input', { value: v.notiz || '', placeholder: '–', 'data-fk': fk('notiz'), onchange: e => setVac(v.id, u => { u.notiz = e.target.value; }) })),
      h('td', { class: 'small' }, overl.length ? h('span', { class: 'warn', tip: overl.map(o => (o.u.wer || '?') + ' ' + fmtS(o.von) + '–' + fmtS(o.bis)).join('\n') }, 'gleichzeitig: ' + [...new Set(overl.map(o => o.u.wer || '?'))].join(', ')) : null),
      h('td', { class: 'acts' }, h('button', { class: 'icon', 'aria-label': 'Urlaub löschen', tip: 'löschen', onclick: () => commit(d => { d.urlaube = d.urlaube.filter(q => q.id !== v.id); }, 'Urlaub gelöscht – Strg+Z holt ihn zurück') }, '✕'))));
  }

  // ---- Feiertage (bearbeitbar) und eigene freie Tage
  const ov = D.feiertage || {};
  const hol = [...holidaysNRW(y)].sort((p, q) => p[0] - q[0]);
  const setHol = (orig, fn) => commit(d => { const k = ds(orig), o = Object.assign({}, d.feiertage[k]); fn(o); Object.keys(o).forEach(q => { if (o[q] == null || o[q] === '' || o[q] === false) delete o[q]; });
    if (Object.keys(o).length) d.feiertage[k] = o; else delete d.feiertage[k]; });
  // zweispaltig: erst links von oben nach unten, dann rechts weiter
  const holCells = ([n, t]) => {
    const o = ov[ds(n)] || {}, at = dn(o.datum) ?? n, changed = !!(o.name || o.datum || o.off), off = o.off ? ' off' : '';
    return [
      h('td', { class: 'hchk' + off }, h('input', { type: 'checkbox', checked: !o.off, tip: o.off ? 'gilt nicht – anklicken zum Aktivieren' : 'gilt als Feiertag', 'aria-label': 'gilt',
        onchange: e => setHol(n, q => { q.off = !e.target.checked; }) })),
      h('td', { class: 'hdate' + off }, dateInput(ds(at), 'hol:' + ds(n) + ':d', v => setHol(n, q => { q.datum = v && dn(v) !== n ? v : null; }))),
      h('td', { class: 'hname' + off }, h('input', { value: o.name || t, title: o.name || t, 'data-fk': 'hol:' + ds(n) + ':n', onchange: e => setHol(n, q => { const v = e.target.value.trim(); q.name = v && v !== t ? v : null; }) })),
      h('td', { class: 'acts hend' }, changed ? h('button', { class: 'icon', tip: 'zurücksetzen auf „' + t + ', ' + fmtD(n) + '“', 'aria-label': 'zurücksetzen', onclick: () => setHol(n, q => { q.name = q.datum = null; q.off = false; }) }, '↺') : null)];
  };
  const half = Math.ceil(hol.length / 2);
  const holRows = Array.from({ length: half }, (_, r) => h('tr', null, holCells(hol[r]), hol[r + half] ? holCells(hol[r + half]) : h('td', { colspan: 4 })));
  const sonder = D.sondertage.slice().sort((p, q) => (dn(p.datum) ?? 0) - (dn(q.datum) ?? 0));
  put(main,
    h('div', { class: 'view-head' }, h('h1', null, 'Urlaub & Feiertage ' + y),
      h('div', { class: 'tools' }, h('button', { class: 'primary', onclick: addVac }, '+ Urlaub / Abwesenheit'))),
    personList(),
    h('section', { class: 'card' }, h('h2', null, 'Übersicht ' + y), h('p', { class: 'muted small' }, 'Jede Zeile eine Person. Oben „Abwesend gesamt“: gelb = 1, orange = 2, rot = 3 und mehr Personen gleichzeitig. Maus darüber zeigt die Namen.'),
      h('div', { class: 'um-wrap', 'data-keep-scroll': 'um' }, matrix)),
    h('div', { class: 'cols2 ucols' },
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Urlaube / Abwesenheiten'), h('button', { class: 'addbtn vac-add', onclick: addVac }, '+ neuen Urlaub eintragen')),
        h('table', { class: 'grid utable' }, h('thead', null, h('tr', null, ['Wer', 'Art', 'Von', 'Bis', 'Arbeitstage', 'Notiz', '', ''].map(t => h('th', null, t)))), list),
        !D.urlaube.length ? h('p', { class: 'muted' }, 'Noch keine Urlaube eingetragen.') : null,
        h('p', { class: 'muted small screen-only' }, 'Personen und ihre Farben verwaltest du unter ⋯ → Einstellungen.')),
      h('section', { class: 'card hcard' }, h('h2', null, 'Feiertage NRW ' + y),
        h('table', { class: 'grid htable hol2' }, h('thead', null, h('tr', null, ['', 'Datum', 'Feiertag', '', '', 'Datum', 'Feiertag', ''].map((t, i) => h('th', { class: i === 3 ? 'hend' : '' }, t)))), h('tbody', null, holRows)),
        h('h3', { class: sonder.length ? '' : 'screen-only', tip: 'z. B. Brückentage oder Betriebsausflug – zählen wie Feiertage' }, 'Eigene freie Tage'),
        h('table', { class: 'grid htable' }, h('tbody', null, sonder.map(s => h('tr', null,
          h('td', null, dateInput(s.datum, 'st:' + s.id + ':datum', v => commit(d => { d.sondertage.find(q => q.id === s.id).datum = v; }))),
          h('td', null, h('input', { value: s.name || '', placeholder: 'Bezeichnung', onchange: e => commit(d => { d.sondertage.find(q => q.id === s.id).name = e.target.value; }) })),
          h('td', { class: 'acts' }, h('button', { class: 'icon', 'aria-label': 'löschen', onclick: () => commit(d => { d.sondertage = d.sondertage.filter(q => q.id !== s.id); }, 'Freier Tag gelöscht – Strg+Z holt ihn zurück') }, '✕')))))),
        h('div', { class: 'addline' }, h('button', { class: 'addbtn', onclick: () => commit(d => d.sondertage.push({ id: uid(), datum: ds(mkdn(y, 1, 2)), name: 'Brückentag' })) }, '+ freier Tag')))));
};
VIEW_FN['urlaub:after'] = VIEW_FN['plaene:after'];
