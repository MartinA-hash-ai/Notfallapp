/* ===================================================================== Ansicht: Urlaub & Feiertage */

async function addVac() {
  const f = { wer: UI.userName || '', von: '', bis: '', notiz: '' };
  const info = h('div', { class: 'calcline' });
  const upd = () => {
    const a = dn(f.von), b = dn(f.bis) ?? a;
    info.textContent = a == null ? '' : b < a ? '„Bis“ liegt vor „Von“.' : workdays(a, b) + ' Arbeitstage (ohne Wochenenden und Feiertage)';
  };
  const row = (label, inp) => h('label', { class: 'frow' }, h('span', null, label), inp);
  const bis = h('input', { type: 'date', oninput: e => { f.bis = e.target.value; upd(); } });
  const ok = await modal('Neuen Urlaub eintragen', h('div', { class: 'form' }, personList(),
    row('Person', personInput({ value: f.wer, placeholder: 'Name', oninput: e => { f.wer = e.target.value.trim(); } })),
    row('Von', h('input', { type: 'date', oninput: e => { f.von = e.target.value; if (!f.bis || dn(f.bis) < dn(f.von)) { f.bis = f.von; bis.value = f.von; } upd(); } })),
    row('Bis', bis),
    row('Notiz', h('input', { placeholder: 'optional, z. B. Fortbildung', oninput: e => { f.notiz = e.target.value; } })), info),
    [['Abbrechen', false], ['Eintragen', true, 'primary']]);
  if (!ok) return;
  let a = dn(f.von), b = dn(f.bis) ?? a;
  if (a == null) { toast('Kein Datum eingetragen – nichts gespeichert.', 'warn'); return; }
  if (b < a) [a, b] = [b, a];
  if (!f.wer) toast('Ohne Person eingetragen – bitte in der Liste ergänzen.', 'warn');
  commit(d => d.urlaube.push({ id: uid(), wer: f.wer, von: ds(a), bis: ds(b), notiz: f.notiz.trim() }), 'Urlaub eingetragen: ' + (f.wer || '?') + ' ' + fmtS(a) + '–' + fmtS(b));
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
      t.append(h('div', { class: 'um-bar', style: { left: X(s) + 'px', width: Math.max(3, (e - s + 1) * pxd) + 'px', background: c },
        tip: () => h('div', null, h('b', null, p), h('div', null, fmtW(v.von) + ' – ' + fmtW(v.bis)), h('div', { class: 'muted' }, workdays(v.von, v.bis) + ' Arbeitstage' + (v.u.notiz ? ' · ' + v.u.notiz : ''))) }));
    }
    const days = vacs.filter(v => (v.u.wer || '?') === p).reduce((s, v) => s + workdays(Math.max(v.von, a), Math.min(v.bis, b)), 0);
    return h('div', { class: 'um-row' }, h('div', { class: 'um-lab' }, h('span', { class: 'vdot', style: { background: personColor(p) } }), p, h('span', { class: 'muted small' }, days ? ' ' + days + ' AT' : '')), t);
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
      h('div', { class: 'tools' }, h('button', { class: 'primary', onclick: addVac }, '+ Urlaub'))),
    personList(),
    h('section', { class: 'card' }, h('h2', null, 'Übersicht ' + y), h('p', { class: 'muted small' }, 'Jede Zeile eine Person. Oben „Abwesend gesamt“: gelb = 1, orange = 2, rot = 3 und mehr Personen gleichzeitig. Maus darüber zeigt die Namen.'),
      h('div', { class: 'um-wrap', 'data-keep-scroll': 'um' }, matrix)),
    h('div', { class: 'cols2 ucols' },
      h('section', { class: 'card' }, h('h2', null, 'Urlaube / Abwesenheiten'),
        h('table', { class: 'grid utable' }, h('thead', null, h('tr', null, ['Wer', 'Von', 'Bis', 'Arbeitstage', 'Notiz', '', ''].map(t => h('th', null, t)))), list),
        !D.urlaube.length ? h('p', { class: 'muted' }, 'Noch keine Urlaube eingetragen.') : null,
        h('div', { class: 'addline' }, h('button', { class: 'addbtn', onclick: addVac }, '+ neuen Urlaub eintragen')),
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
