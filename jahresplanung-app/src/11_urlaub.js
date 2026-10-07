/* ===================================================================== Ansicht: Urlaub & Feiertage */

// Urlaub / Abwesenheit eintragen und bearbeiten: das ganze Jahr auf einen Blick. Gespeicherte Tage der gewählten Person erscheinen markiert
// und lassen sich wie neue an- und abwählen. Jede Markierung behält die Person und Art, die beim Markieren eingestellt war.
// „Speichern“ schreibt für jede geänderte Person die Einträge neu (je zusammenhängendem Zeitraum gleicher Art einer); Notizen bleiben erhalten.
// Mit { ferien: true } derselbe Kalender für Ferienzeiten: ohne Person, Art „Ferien“ – Ferien sind keine freien Tage, nur zur Info.
async function addVac(opt) {
  const fer = !!(opt && opt.ferien), src = () => fer ? D.ferien : D.urlaube, kindOf = u => fer ? 'ferien' : u.art === 'abwesenheit' ? 'abwesenheit' : 'urlaub';
  const names = fer ? [''] : D.personen.map(p => p.name).filter(Boolean);
  const t0 = todayDn();
  const st = { wer: fer ? '' : names.includes(UI.userName) ? UI.userName : names[0] || '', art: fer ? 'ferien' : 'urlaub', notiz: '', year: UI.year };
  // bisher gespeichert: Person → (Tag → Art); bearbeitet: picks (Kopie)
  const orig = new Map(), picks = new Map(), used = new Set();
  for (const u of src()) {
    const a = dn(u.von), b = dn(u.bis) ?? a; if (a == null || b < a || b - a > 400) continue;
    const w = fer ? '' : u.wer;
    used.add(u.id); if (!orig.has(w)) orig.set(w, new Map());
    for (let n = a; n <= b; n++) orig.get(w).set(n, kindOf(u));
  }
  for (const [w, mp] of orig) picks.set(w, new Map(mp));
  let drag = null, saveBtn = null;
  const mine = () => { if (!picks.has(st.wer)) picks.set(st.wer, new Map()); return picks.get(st.wer); };
  const rangesOf = (mp, keys) => { const out = []; for (const n of (keys || [...mp.keys()]).sort((p, q) => p - q)) { const l = out[out.length - 1], art = mp.get(n); if (l && n === l[1] + 1 && l[2] === art) l[1] = n; else out.push([n, n, art]); } return out; };
  const diff = w => { const o = orig.get(w) || new Map(), m = picks.get(w) || new Map();
    return { add: [...m.keys()].filter(n => o.get(n) !== m.get(n)), del: [...o.keys()].filter(n => !m.has(n)) }; };
  const cal = h('div', { class: 'vd-months' }), sum = h('div', { class: 'vd-sum' }), body = h('div', { class: 'vdlg' });
  const fmtR = ([a, b]) => a === b ? fmtS(a) : fmtS(a) + '–' + fmtS(b), artName = a => a === 'ferien' ? 'Ferien' : a === 'abwesenheit' ? 'Abwesenheit' : 'Urlaub';
  const paint = () => {                            // gewählte Person vorne (markiert, abgewählte gespeicherte Tage gestrichelt), andere blass im Hintergrund
    const mp = mine(), om = orig.get(st.wer) || new Map(), pv = drag ? new Set(drag.range) : null, c = fer ? FER_COLOR : personColor(st.wer);
    cal.style.setProperty('--vc', c); cal.style.setProperty('--vc2', mix(c, 0.55));
    const oth = new Map(), put2 = (n, o) => { if (!oth.has(n)) oth.set(n, []); oth.get(n).push(o); };
    for (const [wer, mp2] of picks) if (wer !== st.wer) { const o2 = orig.get(wer) || new Map(); for (const [n, art] of mp2) put2(n, { wer: wer || '?', art: artName(art) + (o2.get(n) === art ? '' : ', noch nicht gespeichert') }); }
    for (const el of $$('.vd-day[data-dn]', cal)) {
      const n = +el.dataset.dn, os = oth.get(n) || [];
      let art = mp.get(n);
      if (pv && pv.has(n)) art = drag.mode === 'add' ? st.art : undefined;
      el.classList.toggle('sel', !!art); el.classList.toggle('abw', art === 'abwesenheit'); el.classList.toggle('rm', !art && om.has(n));
      setKids(el.querySelector('.vd-oth'), os.slice(0, 3).map(o => h('span', { style: { background: personColor(o.wer) } })));
      el.title = [art ? artName(art) + (om.get(n) === art ? ' (gespeichert – Klick nimmt den Tag heraus)' : ' (neu markiert)') : om.has(n) ? artName(om.get(n)) + ' – wird beim Speichern entfernt' : holName(n) || '',
        os.length ? 'Außerdem: ' + os.map(o => o.wer + ' (' + o.art + ')').join(', ') : '', !fer && ferOn(n) ? ferLabel(ferOn(n)) : ''].filter(Boolean).join('\n');
    }
    const lines = [];
    for (const w of new Set([...picks.keys(), ...orig.keys()])) {
      const d = diff(w); if (!d.add.length && !d.del.length) continue;
      const mp2 = picks.get(w) || new Map(), add = rangesOf(mp2, d.add), del = rangesOf(orig.get(w), d.del);
      const at = rg => fer ? rg.reduce((t, [a, b]) => t + b - a + 1, 0) + ' Tage' : rg.reduce((t, [a, b]) => t + workdays(a, b), 0) + ' AT';
      lines.push(h('div', { class: 'vd-line' }, h('span', { class: 'vdot', style: { background: fer ? FER_COLOR : personColor(w) } }), h('b', null, fer ? 'Ferien' : w || '?'),
        add.length ? [' neu: ', ['urlaub', 'abwesenheit', 'ferien'].map(k => { const r = add.filter(x => x[2] === k); return r.length ? h('span', null, (fer ? '' : artName(k) + ' ') + r.map(fmtR).join(', ') + ' (' + at(r) + ') ') : null; })] : null,
        del.length ? h('span', { class: 'vd-del' }, ' entfernt: ' + del.map(fmtR).join(', ') + ' (' + at(del) + ')') : null));
    }
    setKids(sum, !fer && !st.wer ? h('span', { class: 'warn' }, 'Bitte zuerst eine Person wählen.') : lines.length ? [h('div', { class: 'muted small' }, 'Änderungen:'), lines] : null);
    if (saveBtn) saveBtn.disabled = !lines.length;
  };
  const month = (yy, mo) => {
    const first = mkdn(yy, mo, 1), last = first + daysIn(yy, mo) - 1, g = h('div', { class: 'vd-grid' }, WD.map((d, i) => h('div', { class: 'vd-wh' + (i >= 5 ? ' we' : '') }, d)));
    for (let i = 0; i < wd(first); i++) g.append(h('div', { class: 'vd-day out' }));
    for (let n = first; n <= last; n++) g.append(h('div', { class: 'vd-day' + (wd(n) >= 5 ? ' we' : '') + (holName(n) ? ' hol' : '') + (!fer && ferOn(n) ? ' fer' : '') + (n === t0 ? ' today' : ''), dataset: { dn: n } }, h('span', null, ymd(n)[2]), h('span', { class: 'vd-oth' })));
    return h('div', { class: 'vd-month' }, h('div', { class: 'vd-mh' }, MON[mo - 1]), g);
  };
  const yLab = h('b', { class: 'vd-year' });
  const drawCal = () => { yLab.textContent = st.year; setKids(cal, Array.from({ length: 12 }, (_, i) => month(st.year, i + 1))); paint(); };
  // Klicken / Ziehen: beginnt man auf einem markierten Tag, werden die Tage herausgenommen – sonst mit der eingestellten Art markiert
  const dayAt = e => { const el = document.elementFromPoint(e.clientX, e.clientY); const c = el && el.closest && el.closest('.vd-day[data-dn]'); return c ? +c.dataset.dn : null; };
  cal.addEventListener('pointerdown', e => {
    const n = dayAt(e); if (n == null || e.button !== 0 || (!fer && !st.wer)) return;
    e.preventDefault(); try { cal.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    drag = { a: n, mode: mine().has(n) ? 'del' : 'add', range: [n] }; paint();   // markiert (gespeichert oder neu) → herausnehmen, sonst markieren
  });
  cal.addEventListener('pointermove', e => { if (!drag) return; const n = dayAt(e); if (n == null) return;
    const lo = Math.min(drag.a, n), hi = Math.max(drag.a, n); drag.range = []; for (let k = lo; k <= hi; k++) drag.range.push(k); paint(); });
  cal.addEventListener('pointerup', () => { if (!drag) return; const mp = mine(); drag.range.forEach(n => drag.mode === 'add' ? mp.set(n, st.art) : mp.delete(n)); drag = null; paint(); });
  cal.addEventListener('pointercancel', () => { drag = null; paint(); });
  const seg = (k, label) => h('button', { class: 'seg-btn' + (st.art === k ? ' on' : ''), dataset: { art: k }, onclick: () => { st.art = k; $$('.vd-art .seg-btn', body).forEach(b => b.classList.toggle('on', b.dataset.art === k)); paint(); } }, label);
  setKids(body,
    h('div', { class: 'vd-top' },
      fer ? null : h('label', { class: 'vd-f' }, h('span', null, 'Person'), names.length ? h('select', { class: 'vd-wer', onchange: e => { st.wer = e.target.value; paint(); } }, names.map(n => h('option', { value: n, selected: n === st.wer }, n)))
        : h('span', { class: 'warn' }, 'Noch keine Personen – unter ⋯ → Einstellungen anlegen.')),
      h('div', { class: 'vd-f' }, h('span', null, 'Art'), h('span', { class: 'segs vd-art' }, fer ? seg('ferien', 'Ferientage') : [seg('urlaub', 'Urlaub'), seg('abwesenheit', 'Abwesenheit')])),
      h('label', { class: 'vd-f grow' }, h('span', null, 'Notiz'), h('input', { class: 'vd-notiz', placeholder: fer ? 'optional, z. B. Sommerferien – für neue Einträge' : 'optional, z. B. Fortbildung – für neue Einträge', oninput: e => { st.notiz = e.target.value; } })),
      h('div', { class: 'vd-f vd-yr' }, h('span', null, 'Jahr'), h('span', { class: 'vd-ynav' },
        h('button', { class: 'icon', 'aria-label': 'Vorjahr', tip: 'Vorjahr', onclick: () => { st.year--; drawCal(); } }, '‹'), yLab,
        h('button', { class: 'icon', 'aria-label': 'Folgejahr', tip: 'Folgejahr', onclick: () => { st.year++; drawCal(); } }, '›')))),
    cal, sum);
  drawCal();
  const pr = modal(fer ? 'Ferienzeiten eintragen' : 'Urlaub / Abwesenheit eintragen', body, [['Abbrechen', false], ['Speichern', true, 'primary']], { wide: true, cls: 'vacdlg' + (fer ? ' ferdlg' : '') });
  saveBtn = $('.modal.vacdlg footer button.primary'); paint();
  if (!await pr) return;
  const changed = [...new Set([...picks.keys(), ...orig.keys()])].filter(w => { const d = diff(w); return d.add.length || d.del.length; });
  if (!changed.length) return;
  const stat = changed.map(w => { const d = diff(w); return (fer ? '' : w + ' ') + '(' + [d.add.length ? '+' + d.add.length : '', d.del.length ? '−' + d.del.length : ''].filter(Boolean).join(' / ') + ' Tage)'; });
  if (fer) {
    commit(d => {
      const old = d.ferien.filter(u => used.has(u.id));
      d.ferien = d.ferien.filter(u => !used.has(u.id));
      for (const [a, b] of rangesOf(picks.get('') || new Map())) {
        const same = old.find(u => dn(u.von) === a && (dn(u.bis) ?? dn(u.von)) === b), ov = old.filter(u => dn(u.von) <= b && (dn(u.bis) ?? dn(u.von)) >= a && u.notiz)[0];
        d.ferien.push({ id: same ? same.id : uid(), von: ds(a), bis: ds(b), notiz: same ? same.notiz || '' : ov ? ov.notiz : st.notiz.trim() });
      }
    }, 'Ferienzeiten gespeichert ' + stat.join(''));
    return;
  }
  commit(d => {
    for (const w of changed) {
      const old = d.urlaube.filter(u => u.wer === w && used.has(u.id));
      d.urlaube = d.urlaube.filter(u => !(u.wer === w && used.has(u.id)));
      for (const [a, b, art] of rangesOf(picks.get(w) || new Map())) {
        const same = old.find(u => dn(u.von) === a && (dn(u.bis) ?? dn(u.von)) === b && (u.art === 'abwesenheit' ? 'abwesenheit' : 'urlaub') === art);
        const ov = old.filter(u => (u.art === 'abwesenheit' ? 'abwesenheit' : 'urlaub') === art && dn(u.von) <= b && (dn(u.bis) ?? dn(u.von)) >= a && u.notiz)[0];
        d.urlaube.push(Object.assign({ id: same ? same.id : uid(), wer: w, von: ds(a), bis: ds(b), notiz: same ? same.notiz || '' : ov ? ov.notiz : st.notiz.trim() }, art === 'abwesenheit' ? { art } : {}));
      }
    }
  }, 'Urlaube gespeichert: ' + stat.join(', '));
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
    (d.vorlagen || []).forEach(v => (v.plan?.steps || []).forEach(s => { if (s.wer === old) s.wer = nv; }));
  }, old + ' → ' + nv + ' (überall umbenannt)');
  return true;
}
function personUsed(n) {
  return D.urlaube.some(u => u.wer === n) || D.massnahmen.some(m => m.verantwortlich === n || (m.plan?.steps || []).some(s => s.wer === n)) || (D.vorlagen || []).some(v => (v.plan?.steps || []).some(s => s.wer === n));
}

// embed: als Rubrik der Einstellungen (ohne eigene Kopfzeile mit „← zurück“)
VIEW_FN.urlaub = (main, embed) => {
  const y = UI.year, a = mkdn(y, 1, 1), b = mkdn(y, 12, 31), nd = b - a + 1;
  const vacs = C.vac.filter(v => v.bis >= a && v.von <= b), fers = C.fer.filter(f => f.bis >= a && f.von <= b);
  const people = [...new Set([...D.personen.map(p => p.name), ...vacs.map(v => v.u.wer || '?')])];

  // ---- Übersicht: Personen × Tage
  const avail = Math.max(600, innerWidth - 150 - 80), pxd = UI.printing ? 900 / nd : avail / nd, X = n => (n - a) * pxd, W = nd * pxd;
  const mh = h('div', { class: 'um-head', style: { width: W + 'px' } });
  for (let mo = 1; mo <= 12; mo++) { const f = mkdn(y, mo, 1); mh.append(h('div', { style: { left: X(f) + 'px', width: daysIn(y, mo) * pxd + 'px' } }, pxd * 30 > 60 ? MON[mo - 1] : MONS[mo - 1])); }
  const bgl = () => {
    const bg = h('div', { class: 'um-bg' });
    for (const f of fers) { const s0 = Math.max(f.von, a), e0 = Math.min(f.bis, b); bg.append(h('div', { class: 'fer', style: { left: X(s0) + 'px', width: (e0 - s0 + 1) * pxd + 'px' } })); }
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
  const ferRow = fers.length ? h('div', { class: 'um-row ferrow' }, h('div', { class: 'um-lab' }, h('span', { class: 'vdot', style: { background: FER_COLOR } }), 'Ferien'),
    h('div', { class: 'um-track', style: { width: W + 'px' } }, bgl(), fers.map(f => { const s0 = Math.max(f.von, a), e0 = Math.min(f.bis, b);
      return h('div', { class: 'um-bar fer', style: { left: X(s0) + 'px', width: Math.max(3, (e0 - s0 + 1) * pxd) + 'px' }, tip: () => h('div', null, h('b', null, 'Ferien' + (f.u.notiz ? ' · ' + f.u.notiz : '')), h('div', null, fmtW(f.von) + ' – ' + fmtW(f.bis))) }, pxd * (e0 - s0 + 1) > 70 && f.u.notiz ? f.u.notiz : ''); }))) : null;
  const matrix = h('div', { class: 'umatrix' },
    h('div', { class: 'um-row head' }, h('div', { class: 'um-lab' }), mh),
    h('div', { class: 'um-row' }, h('div', { class: 'um-lab' }, h('b', null, 'Abwesend gesamt')), cnt), ferRow, rows);

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
  const ferL = D.ferien.filter(u => { const v = dn(u.von), w = dn(u.bis) ?? v; return v == null || (v <= b && w >= a); }).sort((p, q) => (dn(p.von) ?? 0) - (dn(q.von) ?? 0));
  const setFer = (id, fn) => commit(d => { const u = d.ferien.find(q => q.id === id); if (u) fn(u); });
  put(main,
    h('div', { class: 'view-head' + (embed ? ' sett-head' : '') }, embed ? null : h('button', { class: 'ghostbtn backbtn screen-only', onclick: closeUrlaub, tip: 'zurück zur vorherigen Ansicht' }, '← zurück'),
      h(embed ? 'h2' : 'h1', null, 'Urlaub & Feiertage ' + y),
      h('div', { class: 'tools' }, h('button', { class: 'primary', onclick: addVac }, '+ Urlaub / Abwesenheit'))),
    personList(),
    h('section', { class: 'card' }, h('h2', null, 'Übersicht ' + y), h('p', { class: 'muted small' }, 'Jede Zeile eine Person. Oben „Abwesend gesamt“: gelb = 1, orange = 2, rot = 3 und mehr Personen gleichzeitig. Maus darüber zeigt die Namen.'),
      h('div', { class: 'um-wrap', 'data-keep-scroll': 'um' }, matrix)),
    h('div', { class: 'cols2 ucols' },
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Urlaube / Abwesenheiten'), h('button', { class: 'addbtn vac-add', onclick: addVac }, '+ neuen Urlaub eintragen')),
        h('table', { class: 'grid utable' }, h('thead', null, h('tr', null, ['Wer', 'Art', 'Von', 'Bis', 'Arbeitstage', 'Notiz', '', ''].map(t => h('th', null, t)))), list),
        !D.urlaube.length ? h('p', { class: 'muted' }, 'Noch keine Urlaube eingetragen.') : null,
        h('p', { class: 'muted small screen-only' }, 'Personen und ihre Farben verwaltest du in den Einstellungen unter „Bereiche & Personen“.')),
      h('section', { class: 'card hcard' }, h('h2', null, 'Feiertage NRW ' + y),
        h('table', { class: 'grid htable hol2' }, h('thead', null, h('tr', null, ['', 'Datum', 'Feiertag', '', '', 'Datum', 'Feiertag', ''].map((t, i) => h('th', { class: i === 3 ? 'hend' : '' }, t)))), h('tbody', null, holRows)),
        h('h3', { class: sonder.length ? '' : 'screen-only', tip: 'z. B. Brückentage oder Betriebsausflug – zählen wie Feiertage' }, 'Eigene freie Tage'),
        h('table', { class: 'grid htable' }, h('tbody', null, sonder.map(s => h('tr', null,
          h('td', null, dateInput(s.datum, 'st:' + s.id + ':datum', v => commit(d => { d.sondertage.find(q => q.id === s.id).datum = v; }))),
          h('td', null, h('input', { value: s.name || '', placeholder: 'Bezeichnung', onchange: e => commit(d => { d.sondertage.find(q => q.id === s.id).name = e.target.value; }) })),
          h('td', { class: 'acts' }, h('button', { class: 'icon', 'aria-label': 'löschen', onclick: () => commit(d => { d.sondertage = d.sondertage.filter(q => q.id !== s.id); }, 'Freier Tag gelöscht – Strg+Z holt ihn zurück') }, '✕')))))),
        h('div', { class: 'addline' }, h('button', { class: 'addbtn', onclick: () => commit(d => d.sondertage.push({ id: uid(), datum: ds(mkdn(y, 1, 2)), name: 'Brückentag' })) }, '+ freier Tag')),
        h('h3', { class: ferL.length ? '' : 'screen-only', tip: 'z. B. Schulferien – nur zur Orientierung, keine freien Tage' }, 'Ferienzeiten'),
        ferL.length ? h('table', { class: 'grid htable fertable' }, h('tbody', null, ferL.map(u => { const fk = f => 'fer:' + u.id + ':' + f, bad = dn(u.bis) != null && dn(u.bis) < dn(u.von);
          return h('tr', null,
            h('td', { class: 'fdot' }, h('span', { class: 'vdot', style: { background: FER_COLOR } })),
            h('td', null, dateInput(u.von, fk('von'), v => setFer(u.id, q => { q.von = v; if (!q.bis || dn(q.bis) < dn(q.von)) q.bis = q.von; }))),
            h('td', null, dateInput(u.bis, fk('bis'), v => setFer(u.id, q => { q.bis = v; }), { class: bad ? 'bad' : '' })),
            h('td', null, h('input', { value: u.notiz || '', placeholder: 'z. B. Sommerferien', 'data-fk': fk('notiz'), onchange: e => setFer(u.id, q => { q.notiz = e.target.value; }) })),
            h('td', { class: 'acts' }, h('button', { class: 'icon', 'aria-label': 'Ferien löschen', tip: 'löschen', onclick: () => commit(d => { d.ferien = d.ferien.filter(q => q.id !== u.id); }, 'Ferienzeit gelöscht – Strg+Z holt sie zurück') }, '✕'))); }))) : null,
        h('div', { class: 'addline' }, h('button', { class: 'addbtn fer-add', onclick: () => addVac({ ferien: true }) }, '+ Ferienzeiten eintragen')))));
};
VIEW_FN['urlaub:after'] = VIEW_FN['plaene:after'];
