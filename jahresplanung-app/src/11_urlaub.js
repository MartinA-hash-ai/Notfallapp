/* ===================================================================== Ansicht: Urlaub & Feiertage */

function addVac() {
  const nid = uid(), t = todayDn();
  commit(d => d.urlaube.push({ id: nid, wer: UI.userName || (d.personen[0] || {}).name || '', von: ds(Math.max(t, mkdn(UI.year, 1, 1))), bis: ds(Math.max(t, mkdn(UI.year, 1, 1)) + 4), notiz: '' }), 'Urlaub angelegt');
  UI.focusFk = 'u:' + nid + ':wer';
}
function setVac(id, fn) { commit(d => { const u = d.urlaube.find(q => q.id === id); if (u) fn(u); }); }
async function renamePerson(p) {
  let nv = p.name;
  const ok = await modal('Person umbenennen', h('div', { class: 'form' }, h('label', { class: 'frow' }, h('span', null, 'Name'), h('input', { value: p.name, oninput: e => { nv = e.target.value.trim(); } })),
    h('p', { class: 'muted small' }, 'Der Name wird auch bei Urlauben, Verantwortlichen und Arbeitsschritten geändert.')), [['Abbrechen', false], ['Umbenennen', true, 'primary']]);
  if (!ok || !nv || nv === p.name) return;
  const old = p.name;
  commit(d => {
    const q = d.personen.find(z => z.name === old); if (q) q.name = nv;
    d.urlaube.forEach(u => { if (u.wer === old) u.wer = nv; });
    d.massnahmen.forEach(m => { if (m.verantwortlich === old) m.verantwortlich = nv; (m.plan?.steps || []).forEach(s => { if (s.wer === old) s.wer = nv; }); });
  }, 'Umbenannt');
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
      h('td', null, h('span', { class: 'vdot', style: { background: personColor(v.wer) } }), h('input', { value: v.wer || '', list: 'dl-personen', 'data-fk': fk('wer'), placeholder: 'Name', onchange: e => setVac(v.id, u => { u.wer = e.target.value.trim(); }) })),
      h('td', null, dateInput(v.von, fk('von'), val => setVac(v.id, u => { u.von = val; if (!u.bis || dn(u.bis) < dn(u.von)) u.bis = u.von; }))),
      h('td', null, dateInput(v.bis, fk('bis'), val => setVac(v.id, u => { u.bis = val; }), { class: bad ? 'bad' : '' })),
      h('td', { class: 'num' }, fv != null && fb >= fv ? workdays(fv, fb) : '–'),
      h('td', null, h('input', { value: v.notiz || '', placeholder: '–', 'data-fk': fk('notiz'), onchange: e => setVac(v.id, u => { u.notiz = e.target.value; }) })),
      h('td', { class: 'small' }, overl.length ? h('span', { class: 'warn', tip: overl.map(o => (o.u.wer || '?') + ' ' + fmtS(o.von) + '–' + fmtS(o.bis)).join('\n') }, 'gleichzeitig: ' + [...new Set(overl.map(o => o.u.wer || '?'))].join(', ')) : null),
      h('td', { class: 'acts' }, h('button', { class: 'icon', 'aria-label': 'Urlaub löschen', tip: 'löschen', onclick: () => commit(d => { d.urlaube = d.urlaube.filter(q => q.id !== v.id); }, 'Urlaub gelöscht') }, '✕'))));
  }

  // ---- Personen
  const plist = h('div', { class: 'persons' }, D.personen.map(p => h('div', { class: 'person' },
    h('input', { type: 'color', value: p.farbe, tip: 'Farbe', 'aria-label': 'Farbe von ' + p.name, onchange: e => commit(d => { d.personen.find(q => q.name === p.name).farbe = e.target.value; }) }),
    h('button', { class: 'link', tip: 'umbenennen', onclick: () => renamePerson(p) }, p.name),
    !personUsed(p.name) ? h('button', { class: 'icon small', 'aria-label': 'entfernen', tip: 'entfernen', onclick: () => commit(d => { d.personen = d.personen.filter(q => q.name !== p.name); }) }, '✕') : null)),
    h('button', { onclick: async () => {
      let nv = '';
      const ok = await modal('Person hinzufügen', h('label', { class: 'frow' }, h('span', null, 'Name'), h('input', { oninput: e => { nv = e.target.value.trim(); } })), [['Abbrechen', false], ['Hinzufügen', true, 'primary']]);
      if (ok && nv) commit(d => { if (!d.personen.some(q => q.name === nv)) { const used = new Set(d.personen.map(q => q.farbe)); d.personen.push({ name: nv, farbe: PERSON_COLORS.find(c => !used.has(c)) || '#888888' }); } });
    } }, '+ Person'));

  // ---- Feiertage und eigene freie Tage
  const hol = [...holidaysNRW(y)].sort((p, q) => p[0] - q[0]);
  const sonder = D.sondertage.slice().sort((p, q) => (dn(p.datum) ?? 0) - (dn(q.datum) ?? 0));
  put(main, 
    h('div', { class: 'view-head' }, h('h1', null, 'Urlaub & Feiertage ' + y),
      h('div', { class: 'tools' }, h('button', { class: 'primary', onclick: addVac }, '+ Urlaub'))),
    personList(),
    h('section', { class: 'card' }, h('h2', null, 'Übersicht ' + y), h('p', { class: 'muted small' }, 'Jede Zeile eine Person. Oben „Abwesend gesamt“: gelb = 1, orange = 2, rot = 3 und mehr Personen gleichzeitig. Maus darüber zeigt die Namen.'),
      h('div', { class: 'um-wrap', 'data-keep-scroll': 'um' }, matrix)),
    h('div', { class: 'cols2' },
      h('section', { class: 'card' }, h('h2', null, 'Urlaube / Abwesenheiten'),
        h('table', { class: 'grid utable' }, h('thead', null, h('tr', null, ['Wer', 'Von', 'Bis', 'Arbeitstage', 'Notiz', '', ''].map(t => h('th', null, t)))), list),
        !D.urlaube.length ? h('p', { class: 'muted' }, 'Noch keine Urlaube eingetragen. ', h('button', { class: 'link', onclick: addVac }, 'Urlaub eintragen')) : null,
        h('h3', null, 'Personen'), h('p', { class: 'muted small' }, 'Farbe anklicken zum Ändern. Neue Namen bei Urlauben oder Arbeitsschritten werden automatisch ergänzt.'), plist),
      h('section', { class: 'card' }, h('h2', null, 'Feiertage NRW ' + y),
        h('table', { class: 'grid htable' }, h('tbody', null, hol.map(([n, t]) => h('tr', null, h('td', null, fmtW(n)), h('td', null, t))))),
        h('h3', null, 'Eigene freie Tage'), h('p', { class: 'muted small' }, 'z. B. Brückentage oder Betriebsausflug – zählen wie Feiertage (keine Arbeitstage, Warnung bei Terminen).'),
        h('table', { class: 'grid htable' }, h('tbody', null, sonder.map(s => h('tr', null,
          h('td', null, dateInput(s.datum, 'st:' + s.id + ':datum', v => commit(d => { d.sondertage.find(q => q.id === s.id).datum = v; }))),
          h('td', null, h('input', { value: s.name || '', placeholder: 'Bezeichnung', onchange: e => commit(d => { d.sondertage.find(q => q.id === s.id).name = e.target.value; }) })),
          h('td', { class: 'acts' }, h('button', { class: 'icon', 'aria-label': 'löschen', onclick: () => commit(d => { d.sondertage = d.sondertage.filter(q => q.id !== s.id); }) }, '✕')))))),
        h('button', { onclick: () => commit(d => d.sondertage.push({ id: uid(), datum: ds(mkdn(y, 1, 2)), name: 'Brückentag' })) }, '+ freier Tag'))));
};
VIEW_FN['urlaub:after'] = VIEW_FN['plaene:after'];
