/* ===================================================================== Ansicht: Detailpläne (Gantt, Termine ab PAL, Verknüpfungen Ende → Beginn) */

const STEP_TYPES = { gruppe: 'Abschnitt', aufgabe: 'Aufgabe', meilenstein: 'Meilenstein', ziel: 'Ziel' };
const PL_ROW = 32;
const DEF_DAYS = 7;                            // Standarddauer neuer bzw. noch nicht geplanter Schritte

/* ---------- Rechenhilfen am Datenobjekt */
// Schritte (ids) anteilig von [A, E] auf [A2, E2] bringen: Dauern und Abstände werden im gleichen Verhältnis kürzer bzw. länger.
// Schritte mit fester Dauer (⋯ → „Dauer festlegen“) behalten ihre Länge – in ihrer Zeit läuft die Uhr 1:1, der Rest wird gestreckt/gestaucht.
// Ganze Tage, Aufgaben mindestens 1 Tag. Liefert die geänderten Dauern; partial, wenn es nicht ganz passt.
function scaleRange(m, ids, A, E, A2, E2) {
  const pc = planCalc(m), pal = dn(m.pal), set = new Set(ids);
  const steps = m.plan.steps.filter(s => set.has(s.id) && s.typ !== 'gruppe' && !s.pal && pc.map.get(s.id) && pc.map.get(s.id).start != null && !pc.map.get(s.id).err);
  const r0 = id => pc.map.get(id);
  const U = [];                                    // Zeiten fester Schritte (zusammengefasst)
  steps.filter(s => s.fix && s.typ === 'aufgabe').map(s => [Math.max(A, r0(s.id).start), Math.min(E, r0(s.id).end)]).filter(([x, y]) => y > x)
    .sort((p, q) => p[0] - q[0]).forEach(([x, y]) => { const l = U[U.length - 1]; if (l && x <= l[1]) l[1] = Math.max(l[1], y); else U.push([x, y]); });
  const L = U.reduce((t, [x, y]) => t + y - x, 0), flex0 = (E - A) - L;
  const keepEnd = E2 === E;                        // welches Ende bleibt stehen (Start verschieben: das Ende; Stauchen: der Beginn)
  let f = flex0 > 0 ? ((E2 - A2) - L) / flex0 : 1, partial = flex0 <= 0 && (E2 - A2) !== (E - A);
  if (f < 0) { f = 0; partial = true; if (keepEnd) A2 = E2 - L; else E2 = A2 + L; }   // passt nicht: so weit wie möglich
  const M = t => {                                 // Datum im alten Bereich → Datum im neuen
    if (t <= A) return A2 + (t - A) * f;
    let pos = A, out = A2;
    for (const [x, y] of U) {
      if (t <= x) return out + (t - pos) * f;
      out += (x - pos) * f; pos = x;
      if (t <= y) return out + (t - pos);
      out += y - pos; pos = y;
    }
    return out + (t - pos) * f;
  };
  const tgt = new Map();
  for (const s of steps) {
    const r = r0(s.id);
    if (s.typ !== 'aufgabe') { const e = Math.round(M(r.end)); tgt.set(s.id, [e, e]); continue; }
    if (s.fix) { const a = Math.round(M(r.start)); tgt.set(s.id, [a, a + (r.end - r.start)]); continue; }
    let a = Math.round(M(r.start)), e = Math.round(M(r.end));
    if (r.end - r.start >= 1 && e - a < 1) { if (keepEnd) a = e - 1; else e = a + 1; partial = true; }   // mindestens 1 Tag
    tgt.set(s.id, [a, Math.max(a, e)]);
  }
  const endOf = id => tgt.has(id) ? tgt.get(id)[1] : (r0(id) || {}).end;
  const changed = [];
  for (const s of steps) {
    const [a, e] = tgt.get(s.id), r = r0(s.id), an = s.anker || {};
    if (s.typ === 'aufgabe' && !s.fix) { s.dauer = e - a; if (e - a !== r.end - r.start) changed.push([s.name, r.end - r.start, e - a]); }
    if (an.art === 'nach') { const ends = predsOf(s).map(endOf).filter(v => v != null); if (ends.length) an.offset = a - Math.max(...ends); }
    else if (an.art === 'pal' && pal != null) an.offset = e - pal;
    else if (an.art === 'fest') an.datum = ds(e);
  }
  return { changed, partial };
}
// Start eines Bereichs auf ein Datum legen: das Ende des Abschnitts bleibt, alle Schritte darin passen sich anteilig an
function adjustMark(m, which, target) {
  const pc = planCalc(m), ph = pc.ph[which], mark = ph && ph.mark, r = mark && pc.map.get(mark);
  if (!r || r.start == null || target == null) return null;
  if (r.start === target) return { changed: [] };
  if (ph.end <= ph.start) {                      // nur ein Zeitpunkt (z. B. ein Meilenstein): verschiebt sich selbst
    const s = m.plan.steps.find(q => q.id === mark); if (!s || s.pal) return null; setStepSpan(m, mark, target, target); return { changed: [] };
  }
  return scaleRange(m, ph.steps, ph.start, ph.end, target, ph.end);
}
// Start Selektion/Inhalt einer Maßnahme auf ein Datum legen (Zeitleiste, Kalender): ohne Plan über den Vorlauf,
// mit Detailplan über die Dauer der Schritte davor. Liefert die Meldung für den Hinweis.
function startMovable(x, t) { return !x.m.plan || !!(x.pc && x.pc.ph[t]); }
async function moveStartTo(id, t, n) {
  let res = null;
  const x = C.byId.get(id), label = startLabel(t);
  if (!x) return;
  // Detailplan: erst probeweise – reicht das Kürzen der Schritte nicht, nachfragen statt nur zu warnen
  if (x.m.plan) {
    const test = JSON.parse(JSON.stringify(x.m)), r0 = adjustMark(test, t, n);
    if (r0 && r0.partial) {
      const how = await startMoveAsk(x, t, n, planCalc(test).ph[t].start, r0.changed);
      if (!how) return;
      if (how === 'section') { const gid = curGroupOf(x.m.plan.steps, x.m.plan.steps.findIndex(q => q.id === x.pc.ph[t].mark)); if (gid) shiftGroup(id, gid, n - x.st[t]); return; }
    }
  }
  commit(d => {
    const m = findM(d, id); if (!m) return;
    const pal = dn(m.pal);
    if (m.plan) res = adjustMark(m, t, n);
    else if (pal != null) { m.vorlauf = Object.assign({}, m.vorlauf, { [t]: Math.max(0, pal - n) }); res = { changed: [] }; }
  });
  if (!res) return;
  derive();
  const now = C.byId.get(id), got = now ? now.st[t] : n;
  const det = res.changed.length ? ' – Detailplan: ' + changedText(res.changed) : '';
  toast(x.m.name + ': ' + label + ' → ' + fmtW(got) + det);
}
// Warum geht der Start nicht weiter? Die Schritte behalten ihr Ende und werden nur kürzer (mindestens 1 Tag).
function startMoveAsk(x, t, want, reach, changed) {
  const ph = x.pc.ph[t], ms = ph && x.m.plan.steps.find(q => q.id === ph.mark);
  const hang = !ms ? '' : '„' + ms.name + '“ ' + anchorText(x.m.plan, ms) + '.';
  const cut = (changed || []).length ? changedText(changed) : '';
  const why = hang + ' Beim Verschieben des Starts bleibt das Ende des Abschnitts, alle Schritte darin werden anteilig kürzer – feste Dauern bleiben, kürzer als 1 Tag geht nicht' + (cut ? ' (dafür: ' + cut + ')' : '') + '.';
  const gid = ms ? curGroupOf(x.m.plan.steps, x.m.plan.steps.indexOf(ms)) : null, g = gid && x.m.plan.steps.find(q => q.id === gid), dd = want - x.st[t];
  return modal(label2(t) + ' verschieben', h('div', { class: 'form' },
    h('p', null, 'Gewünscht: ', h('b', null, fmtW(want)), '. Durch Kürzen der Schritte geht es nur bis ', h('b', null, fmtW(reach)), '.'),
    h('p', { class: 'muted' }, why),
    g ? h('p', { class: 'muted' }, 'Alternative: den ganzen Abschnitt „' + g.name + '“ um ' + (dd > 0 ? '+' : '') + dd + ' Tage verschieben – alle Schritte darin behalten ihre Dauer.') : null),
    [['Abbrechen', null], ['Nur bis ' + fmtS(reach), 'partial'], g ? ['Ganzen Abschnitt verschieben', 'section', 'primary'] : false].filter(Boolean), { wide: true });
}
const label2 = t => startLabel(t);
// Start als Werktage vor dem PAL angeben: der späteste Arbeitstag, ab dem noch so viele Werktage bis zum PAL bleiben
function dateForWT(pal, w) { let n = pal, c = 0; while (c < w && pal - n < 3000) { n--; if (isWorkday(n)) c++; } return n; }
// Schritt auf neuen Beginn/Ende setzen (Verknüpfung bleibt, der Versatz wird angepasst)
// Woran hängt ein Schritt? (für Hinweise) – und welche Schritte hängen an ihm
function anchorText(p, s) {
  const a = s.anker || {}, ref = a.ref && p.steps.find(q => q.id === a.ref), off = +a.offset || 0;
  if (s.pal || a.art === 'pal') return 'hängt am PAL';
  if (a.art === 'nach') return 'beginnt nach ' + predsOf(s).map(id => p.steps.find(q => q.id === id)).filter(Boolean).map(q => '„' + q.name + '“').join(', ') + (off ? ' (' + (off > 0 ? off + ' Tage später' : -off + ' Tage überlappend') + ')' : '');
  if ((a.art === 'start' || a.art === 'ende') && ref) return 'hängt am ' + (a.art === 'start' ? 'Beginn' : 'Ende') + ' von „' + ref.name + '“';
  return a.art === 'fest' ? 'hat ein festes Datum' : 'hat kein festes Ende';
}
const dependents = (p, s) => p.steps.filter(q => predsOf(q).includes(s.id));      // Schritte, die nach s beginnen
function setStepSpan(m, sid, ns, ne) {
  const s = m.plan.steps.find(q => q.id === sid);
  if (!s || s.typ === 'gruppe') return;
  if (s.typ !== 'aufgabe') ns = ne;
  const r = planCalc(m).map.get(sid) || {};
  const a = s.anker || { art: 'offen' };
  const pal = dn(m.pal);
  if (a.art === 'fest') s.anker = { art: 'fest', datum: ds(ne) };
  else if (a.art === 'nach' && r.start != null) a.offset = (+a.offset || 0) + (ns - r.start);   // beginnt nach Vorgängern: Abstand ändert sich
  else if (r.end == null || a.art === 'offen') s.anker = pal != null ? { art: 'pal', offset: ne - pal } : { art: 'fest', datum: ds(ne) };
  else a.offset = (+a.offset || 0) + (ne - r.end);
  if (s.typ === 'aufgabe') s.dauer = Math.max(0, ne - ns);
}

/* ---------- Anlegen, Entfernen, Schritte */
// Vorlage „Bereiche“: je Bereich ein Abschnitt mit einem Arbeitsschritt, rückwärts verkettet bis zum PAL (Briefkasten-Termin als Ziel)
function phasePlan(pal, starts) {
  const list = PH().filter(p => starts[p.key] != null).sort((a, b) => starts[a.key] - starts[b.key]);
  const steps = [], tasks = [];
  list.forEach(p => { const g = { id: uid(), typ: 'gruppe', name: p.name, bereich: p.key }, t = { id: uid(), typ: 'aufgabe', name: p.name, dauer: DEF_DAYS, fortschritt: 0, wer: '', kommentar: '' }; steps.push(g, t); tasks.push([t, starts[p.key]]); });
  tasks.forEach(([t, a], i) => {
    const next = tasks[i + 1];
    const end = next ? next[1] : pal != null ? pal : a + DEF_DAYS;
    t.dauer = Math.max(0, end - a);
    t.anker = pal != null ? { art: 'pal', offset: end - pal } : { art: 'fest', datum: ds(end) };
  });
  const goal = { id: uid(), typ: 'ziel', name: 'Briefkasten-Termin', dauer: 0, fortschritt: 0, wer: '', kommentar: '', anker: pal != null ? { art: 'pal', offset: 0 } : { art: 'offen' } };
  if (!steps.length) steps.push({ id: uid(), typ: 'gruppe', name: 'Arbeitsschritte' });
  steps.push(goal);
  return { steps, marks: {} };
}
// Detailplan anlegen: PAL (Pflicht), Starts der Bereiche als Datum oder als Werktage bis zum PAL, dann Einfach / Komplex / Kopie
async function createPlan(id) {
  const x = C.byId.get(id); if (!x) return;
  const others = C.ms.filter(o => o.m.plan && o.id !== id);
  // src[k]: womit der Start angegeben wurde – 'date', 'wt' oder 'pre' (von der Maßnahme übernommen, wandert mit dem PAL mit)
  const f = { pal: dn(x.m.pal), st: {}, src: {}, off: {} };
  for (const p of PH()) if (x.st[p.key] != null && x.pal != null) { f.st[p.key] = x.st[p.key]; f.src[p.key] = 'pre'; f.off[p.key] = x.pal - x.st[p.key]; }
  const palIn = dateInputPlain(f.pal, 'np:pal', v => { f.pal = v; for (const p of PH()) sync(p.key); msg.textContent = ''; palIn.classList.remove('bad'); });
  const dIn = {}, wIn = {};
  const sync = k => {                                                // Datum ↔ Werktage abgleichen
    if (f.pal == null) return;
    if (f.src[k] === 'wt' && isNum(wIn[k].value)) { f.st[k] = dateForWT(f.pal, Math.round(+wIn[k].value)); dIn[k].value = ds(f.st[k]); }
    else if (f.src[k] === 'pre') { f.st[k] = f.pal - f.off[k]; dIn[k].value = ds(f.st[k]); wIn[k].value = workdaysBefore(f.st[k], f.pal); }
    else if (f.st[k] != null) wIn[k].value = workdaysBefore(f.st[k], f.pal);
  };
  for (const p of PH()) {
    dIn[p.key] = dateInputPlain(f.st[p.key], 'np:' + p.key, v => { f.st[p.key] = v; f.src[p.key] = v == null ? null : 'date'; if (v == null) wIn[p.key].value = ''; sync(p.key); });
    wIn[p.key] = h('input', { type: 'number', class: 'nospin', min: 0, max: 400, placeholder: '–', 'data-fk': 'np:' + p.key + ':wt', onwheel: wheelStep,
      oninput: e => { if (e.target.value === '') { f.src[p.key] = null; f.st[p.key] = null; dIn[p.key].value = ''; return; } f.src[p.key] = 'wt'; sync(p.key); } });
    sync(p.key);
  }
  const msg = h('div', { class: 'np-msg' });
  let close = null, showCopy = false;
  const copyBox = h('div', { class: 'np-copy' });
  const pick = (kind, src) => {
    if (f.pal == null) { msg.textContent = 'Bitte zuerst den PAL eintragen – er ist Pflicht.'; palIn.classList.add('bad'); palIn.focus(); return; }
    const late = PH().find(p => f.st[p.key] != null && f.st[p.key] > f.pal);
    if (late) { msg.textContent = startLabel(late.key) + ' liegt nach dem PAL – bitte prüfen.'; return; }
    close({ kind, src });
  };
  const drawCopy = () => setKids(copyBox, showCopy ? (others.length ? others.map(o => h('button', { class: 'np-src', onclick: () => pick('copy', o.id) },
    h('span', { class: 'dot', style: { background: o.color } }), o.m.name, h('span', { class: 'muted small' }, ' · PAL ' + (o.pal != null ? fmtD(o.pal) : '–') + ' · ' + o.m.plan.steps.filter(s => s.typ !== 'gruppe').length + ' Schritte')))
    : h('p', { class: 'muted small' }, 'Es gibt noch keinen anderen Detailplan.')) : null);
  const body = h('div', { class: 'form newplan' },
    h('div', { class: 'np-grid' },
      h('span', { class: 'np-lab' }, h('b', null, 'PAL'), ' ', demoChip('P', 'palred'), h('small', null, 'Pflicht')), palIn, h('span'), h('span'),
      h('span'), h('span', { class: 'muted small' }, 'Datum'), h('span'), h('span', { class: 'muted small' }, 'Werktage bis PAL'),
      PH().map(p => [h('span', { class: 'np-lab' }, startLabel(p.key), ' ', demoChip(p.key)), dIn[p.key], h('span', { class: 'muted small' }, 'oder'),
        h('span', { class: 'wtbox' }, wIn[p.key], h('span', { class: 'unit' }, 'WT'))])),
    h('p', { class: 'muted small' }, 'Leer gelassene Starts übernimmt die App aus der Vorlage. Die Arbeitsschritte werden rückwärts vom PAL aus geplant.'),
    msg,
    h('div', { class: 'np-choice' },
      h('button', { class: 'np-big tpl-simple', onclick: () => pick('bereiche') }, h('b', null, 'Einfach'), h('span', null, 'nur die Bereiche: ' + PH().map(p => p.name).join(', ') + ' – dann PAL')),
      h('button', { class: 'np-big tpl-complex', onclick: () => pick('mailing') }, h('b', null, 'Komplex'), h('span', null, 'Aufbau wie Sommer-/Weihnachtsmailing: alle Arbeitsschritte, ohne Personen'))),
    h('button', { class: 'np-copybtn tpl-copy', onclick: () => { showCopy = !showCopy; drawCopy(); } }, 'Kopie aus vorherigem Plan …'),
    copyBox);
  const res = await modal('Detailplan anlegen für „' + x.m.name + '“', body, [['Abbrechen', false]], { wide: true, expose: c => { close = c; } });
  if (!res || !res.kind) return;
  let info = [];
  commit(d => {
    const m = findM(d, id), pal = f.pal;
    const starts = Object.fromEntries(PH().map(p => [p.key, f.st[p.key]]).filter(([, v]) => v != null));
    let plan;
    if (res.kind === 'mailing') {
      plan = migratePlan(JSON.parse(JSON.stringify(MAILING_TEMPLATE)), PH().map(p => p.key));
      plan.steps.forEach(s => { s.wer = ''; });                                              // ohne Zugehörigkeiten
    } else if (res.kind === 'bereiche') plan = phasePlan(pal, Object.assign(Object.fromEntries(PH().filter(p => isNum(p.vorlauf)).map(p => [p.key, pal - p.vorlauf])), starts));
    else {
      const srcM = findM(d, res.src), sp = dn(srcM.pal);
      plan = JSON.parse(JSON.stringify(srcM.plan));
      if (sp != null) plan.steps.forEach(s => { if (s.anker && s.anker.art === 'fest' && dn(s.anker.datum) != null) s.anker.datum = ds(dn(s.anker.datum) + (pal - sp)); });   // feste Termine mitverschieben
    }
    plan.marks = plan.marks || {};
    plan.steps.forEach(s => { s.fortschritt = 0; });
    ensurePalStep(plan);                                   // Briefkasten-Termin (PAL) als feste Zeile
    m.plan = plan;
    m.pal = ds(pal);
    unlinkSections(m); forwardLinks(m);                     // Vorlage: Verknüpfungen vorwärts (Beginn nach Ende), alte über Abschnitte gelöst
    // vom PAL aus rückwärts anpassen (spätester Bereich zuerst), sonst verschiebt ein späterer Bereich die früheren wieder
    if (res.kind !== 'bereiche') for (const k of Object.keys(starts).sort((a, b) => starts[b] - starts[a])) {
      const r = adjustMark(m, k, starts[k]);
      if (r && r.changed.length) info = info.concat(r.changed);
    }
  }, 'Detailplan angelegt');
  if (info.length) toast('Angepasst: ' + info.map(([n, a, b]) => n + ' ' + a + ' → ' + b + ' Tage').join(', '));
  openPlan(id);
}
// Detailplan öffnen – liegt sein PAL in einem anderen Jahr, wechselt die App in dieses Jahr
function openPlan(id) {
  const x = C.byId.get(id);
  UI.view = 'plaene'; UI.planSel = id;
  if (x && x.pal != null) UI.year = ymd(x.pal)[0];
  renderNow();
}
// Datumsfeld für Dialoge: meldet die Tagesnummer (oder null) bei jeder gültigen Änderung
function dateInputPlain(n, fk, onValue) {
  return h('input', { type: 'date', value: n != null ? ds(n) : '', 'data-fk': fk, oninput: e => onValue(dn(e.target.value)) });
}
async function removePlan(id) {
  const x = C.byId.get(id);
  const keep = PH().filter(p => x.st[p.key] != null);
  if (!await confirmBox('Detailplan entfernen', `Den Detailplan von „${x.m.name}“ löschen? ` + (keep.length ? keep.map(p => startLabel(p.key) + ' (' + fmtS(x.st[p.key]) + ')').join(', ') + ' bleiben als Termine erhalten.' : ''), 'Entfernen')) return;
  commit(d => {
    const m = findM(d, id);
    if (x.pal != null) { m.vorlauf = {}; m.ende = {}; for (const p of keep) { m.vorlauf[p.key] = x.pal - x.st[p.key]; if (x.enx[p.key] != null) m.ende[p.key] = x.pal - x.enx[p.key]; } }
    m.plan = null;
  }, 'Detailplan entfernt');
}
function setStep(mid, sid, fn, msg) { commit(d => { const m = findM(d, mid), s = m && m.plan && m.plan.steps.find(q => q.id === sid); if (s) fn(s); }, msg); }
// Hinweis zu geänderten Dauern: wenige einzeln, viele zusammengefasst
const changedText = ch => !ch.length ? 'nichts geändert' : ch.length <= 3 ? ch.map(([nm, a, b]) => '„' + nm + '“ ' + a + ' → ' + b + ' Tage').join(', ') : ch.length + ' Schritte anteilig angepasst';
function setMarkDate(mid, which, v) {
  const n = dn(v); if (n == null) return;
  let res = null;
  commit(d => { res = adjustMark(findM(d, mid), which, n); });
  if (!res) toast('In diesem Plan gehört noch kein Abschnitt zum Bereich „' + phName(which) + '“ (Bereich am Abschnitt wählen).', 'warn');
  else if (res.changed.length || res.partial) toast('Angepasst: ' + changedText(res.changed) + (res.partial ? ' – weiter geht es nicht (Schritte mindestens 1 Tag, feste Dauern bleiben)' : ''), res.partial ? 'warn' : '');
}
function groupBlocks(steps) {                 // Abschnitt-Index → [von, bis) im Array
  const out = new Map();
  steps.forEach((s, i) => {
    if (s.typ !== 'gruppe') return;
    let j = i + 1; while (j < steps.length && steps[j].typ !== 'gruppe') j++;
    out.set(s.id, [i, j]);
  });
  return out;
}
// wer ist dem Abschnitt zugeordnet? (einheitlich / gemischt / niemand)
function groupPerson(p, gid) {
  if (!gid) return { wer: '', mixed: false };
  const bl = groupBlocks(p.steps).get(gid); if (!bl) return { wer: '', mixed: false };
  const names = [...new Set(p.steps.slice(bl[0] + 1, bl[1]).map(s => s.wer || ''))];
  if (names.length === 1) return { wer: names[0], mixed: false };
  return { wer: names.length ? '' : (p.steps[bl[0]].wer || ''), mixed: names.length > 1 };
}
function setGroupBereich(mid, gid, k) {
  commit(d => { const g = findM(d, mid).plan.steps.find(q => q.id === gid); if (g) { if (k) g.bereich = k; else delete g.bereich; } }, k ? 'Abschnitt → Bereich ' + phName(k) : 'Abschnitt ohne Bereich');
}
function setGroupPerson(mid, gid, wer) {
  let n = 0;
  commit(d => {
    const steps = findM(d, mid).plan.steps, bl = groupBlocks(steps).get(gid); if (!bl) return;
    steps[bl[0]].wer = wer;
    steps.slice(bl[0] + 1, bl[1]).forEach(s => { if ((s.wer || '') !== wer) n++; s.wer = wer; });
  }, null);
  if (n) toast(n + ' Schritt' + (n === 1 ? '' : 'e') + (wer ? ' → ' + wer : ': Zuordnung entfernt'));
}
async function groupPersonDialog(mid, gid) {
  const p = C.byId.get(mid).m.plan, g = p.steps.find(s => s.id === gid), cur = groupPerson(p, gid);
  let wer = cur.wer;
  const ok = await modal('Abschnitt „' + g.name + '“ zuordnen', h('div', { class: 'form' }, personList(),
    h('label', { class: 'frow' }, h('span', null, 'Person'), personInput({ value: wer, placeholder: cur.mixed ? 'gemischt' : 'Name', oninput: e => { wer = e.target.value.trim(); } })),
    h('p', { class: 'muted small' }, 'Alle Arbeitsschritte dieses Abschnitts bekommen diese Person. Leer lassen entfernt die Zuordnung.')),
    [['Abbrechen', false], ['Zuordnen', true, 'primary']]);
  if (ok) setGroupPerson(mid, gid, wer);
}
// Neue Aufgabe direkt als Zeile (ohne Fenster): am Ende des Abschnitts oder unter einem Schritt, eine Woche lang,
// endet mit dem letzten Schritt davor; Person des Abschnitts vorbelegt. Der Name ist markiert – einfach lostippen.
function addStep(mid, gid, afterId) {
  const x = C.byId.get(mid); if (!x || !x.m.plan) return;
  const p = x.m.plan, pc = x.pc, nid = uid(), bl = gid ? groupBlocks(p.steps).get(gid) : null, [gi, gj] = bl || [-1, p.steps.length];
  const ra = afterId ? pc.map.get(afterId) : null;
  const inGroup = p.steps.slice(gi + 1, gj).map(s => pc.map.get(s.id)).filter(r => r && r.end != null);
  const e0 = ra && ra.end != null ? ra.end : inGroup.length ? Math.max(...inGroup.map(r => r.end)) : (x.pal ?? todayDn());
  const wer = groupPerson(p, gid).wer || '';
  commit(d => {
    const m = findM(d, mid), steps = m.plan.steps, pal = dn(m.pal);
    let at = steps.length;
    const i = afterId ? steps.findIndex(q => q.id === afterId) : -1, b2 = gid ? groupBlocks(steps).get(gid) : null;
    if (i >= 0) at = i + 1; else if (b2) at = b2[1];
    steps.splice(at, 0, { id: nid, typ: 'aufgabe', name: 'Neue Aufgabe', wer, kommentar: '', dauer: DEF_DAYS, fortschritt: 0,
      anker: pal != null ? { art: 'pal', offset: e0 - pal } : { art: 'fest', datum: ds(e0) } });
  }, 'Aufgabe angelegt');
  if (gid) delete UI.planColl[mid + ':' + gid];
  UI.focusFk = 'st:' + nid + ':name'; UI.flash = 'step:' + nid; UI.freshStep = nid;
}
function addGroup(mid) {
  const nid = uid();
  commit(d => { findM(d, mid).plan.steps.push({ id: nid, typ: 'gruppe', name: 'Neuer Abschnitt' }); });
  UI.focusFk = 'st:' + nid + ':name';
}
function deleteStep(mid, sid) {
  const s0 = ((findM(D, mid) || {}).plan || { steps: [] }).steps.find(q => q.id === sid);
  if (s0 && s0.pal) { toast('Der Briefkasten-Termin (PAL) gehört immer zum Plan und lässt sich nicht löschen.', 'warn'); return; }
  let lostMark = [];
  commit(d => {
    const m = findM(d, mid), p = m.plan, pc = planCalc(m), del = p.steps.find(q => q.id === sid);
    if (!del) return;
    const da = del.anker || { art: 'offen' }, pal = dn(m.pal);
    p.steps = p.steps.filter(q => q.id !== sid);
    // wer nach dem gelöschten Schritt begann, beginnt jetzt nach dessen Vorgängern (sonst hängt er am PAL) – die Termine bleiben gleich
    p.steps.forEach(q => { if (predsOf(q).includes(sid)) setPreds(q, [...new Set(predsOf(q).filter(id => id !== sid).concat(predsOf(del)))], pc.map.get(q.id), pc.map, pal); });
    // (ältere Pläne) wer am gelöschten Schritt hing, hängt jetzt an dessen Bezugspunkt
    p.steps.forEach(q => {
      if (!q.anker || q.anker.ref !== sid) return;
      const r = pc.map.get(q.id) || {}, qo = +q.anker.offset || 0;
      const shift = qo + (q.anker.art === 'start' && del.typ === 'aufgabe' ? -(Math.round(+del.dauer || 0)) : 0);
      if (da.art === 'pal' || da.art === 'start' || da.art === 'ende') q.anker = { art: da.art, ref: da.ref, offset: (+da.offset || 0) + shift };
      else if (r.end != null) q.anker = pal != null ? { art: 'pal', offset: r.end - pal } : { art: 'fest', datum: ds(r.end) };
      else q.anker = { art: 'offen' };
      if (q.anker.art === 'pal') delete q.anker.ref;
    });
    for (const k of Object.keys(p.marks || {})) if (p.marks[k] === sid) delete p.marks[k];
    if (del.typ === 'gruppe' && del.bereich && !p.steps.some(q => q.typ === 'gruppe' && q.bereich === del.bereich)) lostMark.push(phName(del.bereich));
  }, 'Gelöscht');
  if (lostMark.length) toast('Der Bereich „' + lostMark.join(', ') + '“ hat jetzt keinen Abschnitt mehr – an einem anderen Abschnitt wählen.', 'warn');
}
function moveRows(mid, fromId, beforeId) {      // Schritt oder ganzen Abschnitt verschieben
  commit(d => {
    const steps = findM(d, mid).plan.steps, i = steps.findIndex(s => s.id === fromId);
    if (i < 0) return;
    let j = i + 1;
    if (steps[i].typ === 'gruppe') while (j < steps.length && steps[j].typ !== 'gruppe') j++;
    const block = steps.splice(i, j - i);
    let k = beforeId ? steps.findIndex(s => s.id === beforeId) : steps.length;
    if (k < 0) k = steps.length;
    if (block[0].typ === 'gruppe' && k < steps.length && steps[k].typ !== 'gruppe') {   // Abschnitt nie mitten in einen anderen legen
      while (k < steps.length && steps[k].typ !== 'gruppe') k++;
    }
    steps.splice(k, 0, ...block);
  });
}

/* ---------- Ansicht */
VIEW_FN.plaene = main => {
  if (!UI.planColl || typeof UI.planColl !== 'object') UI.planColl = {};
  const palIn = x => x.pal == null || ymd(x.pal)[0] === UI.year;          // nur Pläne, deren PAL im gewählten Jahr liegt
  const withPlan = C.ms.filter(x => x.m.plan && palIn(x));
  const cand = C.ms.filter(x => !x.m.plan && palIn(x));
  if (!UI.printing && !withPlan.some(x => x.id === UI.planSel)) UI.planSel = (withPlan[0] || {}).id || null;
  let newFor = cand[0] ? cand[0].id : null;
  const tabs = h('div', { class: 'ptabs' },
    withPlan.map(x => h('button', { class: 'ptab' + (x.id === UI.planSel ? ' on' : ''), style: { '--c': x.color }, onclick: () => { UI.planSel = x.id; renderNow(); } },
      h('span', { class: 'dot', style: { background: x.color } }), x.m.name, h('span', { class: 'muted' }, ' ' + (x.pal != null ? fmtS(x.pal) + ymd(x.pal)[0] : '')))),
    cand.length ? h('span', { class: 'pnew' }, h('select', { onchange: e => { newFor = e.target.value; } }, cand.map(x => h('option', { value: x.id }, x.m.name))),
      h('button', { class: 'primary', onclick: () => newFor && createPlan(newFor) }, '+ Detailplan anlegen')) : null);
  put(main, h('div', { class: 'view-head' }, h('h1', null, 'Detailpläne'),
    h('span', { class: 'info', tip: 'Jeder Schritt hängt am PAL oder beginnt nach anderen Schritten (auch aus anderen Abschnitten). Verknüpfen: Strg gedrückt halten und vom Ende eines Schritts auf den Beginn eines anderen ziehen – in der Tabelle oder im Gantt; Strg+Klick auf einen Punkt im Gantt oder ein farbiges Datum löst eine Verknüpfung (bei mehreren: Auswahl). Balken im Gantt ziehen verschiebt ihn, die Enden ziehen ändert die Dauer. Mausrad zoomt, gedrückte Maus auf freier Fläche verschiebt die Ansicht. Zeilen am ⋮⋮-Griff hoch/runter ziehen.' }, 'ⓘ')), tabs);
  const x = C.byId.get(UI.planSel);
  if (!x) { put(main, h('div', { class: 'empty' }, 'Noch kein Detailplan mit PAL in ' + UI.year + '. Oben eine Maßnahme wählen und „Detailplan anlegen“' + (C.ms.some(q => q.m.plan) ? ' – oder mit ‹ › oben das Jahr wechseln.' : '.'))); return; }
  const m = x.m, p = m.plan, pc = x.pc, today = todayDn(), compact = !!UI.planCompact;
  const persons = [...new Set(p.steps.filter(s => s.typ === 'aufgabe').map(s => s.wer || ''))];
  const barColor = w => w ? personColor(w) : '#9E9E9E';

  // ---- Zeitraum und Maßstab
  const ref = x.pal ?? today;                  // Tippfehler im Jahr (z. B. 20277) nicht mitzeichnen – dafür gibt es eine Warnung
  const dates = [...pc.map.values()].flatMap(r => [r.start, r.end]).filter(v => v != null && Math.abs(v - ref) <= FAR).concat(x.pal != null ? [x.pal] : []);
  const g0 = dates.length ? Math.min(...dates) - 4 : (x.pal ?? today) - 60, g1 = dates.length ? Math.max(...dates) + 6 : (x.pal ?? today) + 14;
  const a0 = g0 - wd(g0), a1 = g1 + (6 - wd(g1)), nd = a1 - a0 + 1;
  const tableW = compact ? 272 : 852;
  const fitP = Math.max(2, (innerWidth - tableW - 14 - 70) / nd);
  const pxd = UI.printing ? Math.max(2, (compact ? 1030 - 250 : 1030 - 600) / nd) : (UI.planPxd || fitP), W = nd * pxd, X = n => (n - a0) * pxd;   // Druck: Gantt füllt den Rest der A4-Breite

  // Kopf: oben Name und PAL, rechts die Legende; darunter die Starts der Bereiche (und künftige weitere Termine)
  put(main, h('div', { class: 'phead', style: { borderColor: x.color } },
    h('div', { class: 'ph-top' },
      h('h2', { style: { color: inkC(x.color) } }, m.name),
      h('label', { class: 'inl ph-pal' }, demoChip('P', 'palred'), 'PAL', dateInput(m.pal, 'pl:pal', v => setM(m.id, 'pal', v || null))),
      h('div', { class: 'plegend' }, persons.map(w => h('span', { class: 'pleg' }, h('span', { class: 'pbox', style: { background: midtone(barColor(w)), borderColor: barColor(w) } }), w || 'nicht zugeordnet')))),
    h('div', { class: 'ph-bot' },
      h('div', { class: 'pdates' },
        PH().map(ph => h('label', { class: 'inl', tip: pc.ph[ph.key] ? 'Datum eintragen – die Dauer des längsten Schritts davor passt sich an' : 'Noch kein Abschnitt mit Bereich „' + ph.name + '“ (Bereich am Abschnitt wählen)' },
          demoChip(ph.key), startLabel(ph.key), dateInput(x.st[ph.key] != null ? ds(x.st[ph.key]) : '', 'pl:' + ph.key, v => setMarkDate(m.id, ph.key, v), { disabled: !pc.ph[ph.key] })))),
      h('span', { class: 'tools' }, h('button', { class: 'ghostbtn danger', onclick: () => removePlan(m.id) }, 'Plan entfernen')))));

  // ---- Kopf und Hintergrund des Gantt
  const ghead = h('div', { class: 'g-head', style: { width: W + 'px' } });
  for (let n = a0; n <= a1;) { const [yy, mm] = ymd(n), e = Math.min(a1, mkdn(yy, mm, daysIn(yy, mm))); ghead.append(h('div', { class: 'gm', style: { left: X(n) + 'px', width: (e - n + 1) * pxd + 'px' } }, h('span', null, (e - n + 1) * pxd > 60 ? MON[mm - 1] + ' ' + yy : (e - n + 1) * pxd > 22 ? MONS[mm - 1] : ''))); n = e + 1; }
  for (let n = a0; n <= a1; n += 7) ghead.append(h('div', { class: 'gw', style: { left: X(n) + 'px', width: 7 * pxd + 'px' } }, pxd * 7 > 40 ? 'KW ' + isoWeek(n) : pxd * 7 > 16 ? isoWeek(n) : ''));
  if (pxd >= 14) for (let n = a0; n <= a1; n++) ghead.append(h('div', { class: 'gd' + (wd(n) >= 5 ? ' we' : ''), style: { left: X(n) + 'px', width: pxd + 'px' } }, ymd(n)[2]));

  // ---- Zeilen (Abschnitte einklappbar, „+ neuer Arbeitsschritt“ am Ende jedes Abschnitts)
  const blocks = groupBlocks(p.steps), rows = [];
  let curG = null;
  p.steps.forEach((s, idx) => {
    if (s.typ === 'gruppe') {
      if (curG) rows.push({ add: curG });
      curG = s.id;
      rows.push({ s, idx, group: true });
      return;
    }
    if (curG && UI.planColl[m.id + ':' + curG]) return;
    rows.push({ s, idx });
  });
  if (curG) rows.push({ add: curG }); else rows.push({ add: null });
  const gbg = h('div', { class: 'g-bg', style: { width: W + 'px' } });
  for (let n = a0; n <= a1; n++) {
    if (wd(n) >= 5) gbg.append(h('div', { class: 'we', style: { left: X(n) + 'px', width: pxd + 'px' } }));
    const hn = holName(n); if (hn) gbg.append(h('div', { class: 'hol', style: { left: X(n) + 'px', width: pxd + 'px' }, tip: 'Feiertag: ' + hn }));
  }
  if (today >= a0 && today <= a1) gbg.append(h('div', { class: 'today', style: { left: X(today) + pxd / 2 + 'px' }, tip: 'Heute' }));
  if (x.pal != null) gbg.append(h('div', { class: 'palline', style: { left: X(x.pal) + pxd / 2 + 'px' } }, h('span', null, 'PAL')));

  const over = palOverSteps(m, pc), late = new Set(over.map(o => o.id));   // Schritte eines Bereichs, die nach dem PAL enden
  const trows = [], grows = [];
  let grpName = '', grpEls = null;                // grpEls: Balken des aktuellen Abschnitts (ziehen am Abschnittsbalken verschiebt alle)
  for (const row of rows) {
    if (row.add !== undefined) {
      if (row.add && UI.planColl[m.id + ':' + row.add]) continue;
      trows.push(h('div', { class: 'pl-row addrow' + (compact ? ' compact' : '') }, h('div', { class: 'c-add' },
        h('button', { class: 'addlink', onclick: () => addStep(m.id, row.add) }, '+ Aufgabe'))));
      grows.push(h('div', { class: 'g-row addrow' }));
      continue;
    }
    const s = row.s, r = pc.map.get(s.id) || {}, fk = f => 'st:' + s.id + ':' + f;
    const grip = h('span', { class: 'rgrip', tip: 'ziehen zum Verschieben', 'aria-label': 'verschieben', onpointerdown: e => rowDrag(e, m.id, s.id) }, '⋮⋮');
    if (row.group) {
      grpName = s.name; grpEls = [];
      const coll = !!UI.planColl[m.id + ':' + s.id], [gi, gj] = blocks.get(s.id);
      const inner = p.steps.slice(gi + 1, gj), spans = inner.map(q => pc.map.get(q.id)).filter(q => q && q.start != null), gp = groupPerson(p, s.id);
      trows.push(h('div', { class: 'pl-row grp' + (compact ? ' compact' : ''), dataset: { rid: s.id, flash: 'step:' + s.id } },
        h('div', { class: 'c-grip' }, grip),
        h('div', { class: 'c-name gname' },
          h('button', { class: 'gtog', 'aria-expanded': String(!coll), tip: coll ? 'ausklappen' : 'einklappen', onclick: () => { coll ? delete UI.planColl[m.id + ':' + s.id] : UI.planColl[m.id + ':' + s.id] = 1; saveUI(); renderNow(); } }, coll ? '▸' : '▾'),
          h('input', { value: s.name, 'data-fk': fk('name'), onchange: e => setStep(m.id, s.id, st => { st.name = e.target.value; }) }),
          groupMark(s, pc, p),
          h('select', { class: 'gber' + (s.bereich ? ' on' : ''), 'data-fk': fk('ber'), tip: 'Bereich dieses Abschnitts – sein Beginn erscheint als Start im Kalender, in der Tabelle und in der Zeitleiste',
            onchange: e => setGroupBereich(m.id, s.id, e.target.value) }, h('option', { value: '' }, '– ohne Bereich'), PH().map(q => h('option', { value: q.key, selected: s.bereich === q.key }, q.name))),
          compact ? h('span', { class: 'gcount' }, inner.length) : null),
        compact ? null : [
          h('div', { class: 'c-wer', tip: 'Person für den ganzen Abschnitt – gilt für alle Schritte darin' },
            gp.wer ? h('span', { class: 'pbox', style: { background: midtone(barColor(gp.wer)), borderColor: barColor(gp.wer) } }) : null,
            personInput({ value: gp.wer, placeholder: gp.mixed ? 'gemischt' : '–', 'data-fk': fk('gwer'), onchange: e => setGroupPerson(m.id, s.id, e.target.value.trim()) })),
          h('div', { class: 'c-grest muted small' }, inner.length + (inner.length === 1 ? ' Schritt' : ' Schritte') + (spans.length ? ' · ' + fmtS(Math.min(...spans.map(q => q.start))) + ' – ' + fmtS(Math.max(...spans.map(q => q.end))) : ''))],
        h('div', { class: 'c-acts' }, menuButton('⋯', [['Neue Aufgabe', () => addStep(m.id, s.id)], ['Ganzen Abschnitt zuordnen …', () => groupPersonDialog(m.id, s.id)],
          spans.length ? ['Abschnitt verschieben …', () => shiftGroupDialog(m.id, s.id)] : false, ['Neuer Abschnitt', () => addGroup(m.id)], null,
          ['Abschnitt löschen (Schritte bleiben)', () => deleteStep(m.id, s.id)]], 'right'))));
      const g = h('div', { class: 'g-row grp' });
      if (spans.length) {
        const a = Math.min(...spans.map(q => q.start)), b = Math.max(...spans.map(q => q.end));
        const sum = h('div', { class: 'g-sum', style: { left: X(a) + pxd / 2 + 'px', width: Math.max(3, (b - a) * pxd) + 'px' }, tip: s.name + ': ' + fmtW(a) + ' – ' + fmtW(b) + ' · ziehen verschiebt den ganzen Abschnitt' });   // immer grau
        const gctx = { x, g: s, a, b, pxd, el: sum, els: grpEls };
        sum.addEventListener('pointerdown', e => groupDrag(e, gctx));
        g.append(sum);
      }
      grows.push(g);
      continue;
    }
    const away = s.wer && r.start != null ? C.vac.filter(v => v.u.wer === s.wer && v.von <= Math.max(r.end, r.start) && v.bis >= r.start) : [];
    const isTask = s.typ === 'aufgabe';
    // Beginn ändern: Ende bleibt (liegt der Beginn danach, wandert das Ende mit). Noch ohne Termin: eine Woche.
    // Frisch angelegte Aufgabe: das erste geänderte Datum verschiebt die ganze Woche, danach wie oben.
    const len = +s.dauer > 0 ? +s.dauer : DEF_DAYS, fresh = UI.freshStep === s.id;
    const startInp = isTask ? dateInput(r.start != null ? ds(r.start) : '', fk('start'), v => { const ns = dn(v); if (ns == null) return; UI.freshStep = null;
      commit(d => { const ne = !fresh && r.end != null && r.start != null && ns <= r.end ? r.end : ns + len; setStepSpan(findM(d, m.id), s.id, ns, ne); }); }) : null;
    const endInp = s.pal ? h('span', { class: 'paldate', tip: 'Fester Termin: das PAL der Maßnahme – ändern oben im Kopf oder in der Maßnahmen-Tabelle' }, x.pal != null ? fmtD(x.pal) : '–', h('span', { class: 'pallock', 'aria-label': 'fest' }), demoChip('P', 'palchip palred'))
      : dateInput(r.end != null ? ds(r.end) : '', fk('end'), v => { const ne = dn(v); if (ne == null) return; UI.freshStep = null;
      commit(d => { const ns = !isTask ? ne : !fresh && r.start != null && r.end != null && r.start <= ne ? r.start : ne - len; setStepSpan(findM(d, m.id), s.id, ns, ne); }); });
    // verknüpfte Daten: Kalendersymbol in der Farbe der Maßnahme (Beginn nach Vorgängern / nach dem Ende beginnen andere)
    if (startInp && predsOf(s).length) startInp.classList.add('lk');
    if (!s.pal && (dependents(p, s).length || (!isTask && predsOf(s).length))) endInp.classList.add('lk');
    const secK = curBereich(p.steps, row.idx);
    trows.push(h('div', { class: 'pl-row' + (away.length ? ' conflict' : '') + (s.pal ? ' palrow' : '') + (compact ? ' compact' : ''), dataset: { rid: s.id, flash: 'step:' + s.id } },
      h('div', { class: 'c-grip' }, grip),
      h('div', { class: 'c-name' }, h('input', { class: s.pal ? 'palname' : null, value: s.name, title: s.name, 'data-fk': fk('name'), onchange: e => setStep(m.id, s.id, st => { st.name = e.target.value; }) })),
      compact ? null : [
        h('div', { class: 'c-typ' }, s.pal ? h('span', { class: 'paltyp', tip: 'Ziel: der Briefkasten-Termin – hängt fest am PAL der Maßnahme' }, 'Ziel')
          : h('select', { 'data-fk': fk('typ'), onchange: e => setStep(m.id, s.id, st => { st.typ = e.target.value; }) }, ['aufgabe', 'meilenstein'].map(k => h('option', { value: k, selected: s.typ === k }, STEP_TYPES[k])))),
        h('div', { class: 'c-wer' }, h('span', { class: 'pbox', style: { background: s.wer ? midtone(barColor(s.wer)) : 'transparent', borderColor: s.wer ? barColor(s.wer) : 'transparent' } }),
          personInput({ value: s.wer || '', placeholder: '–', 'data-fk': fk('wer'), onchange: e => setStep(m.id, s.id, st => { st.wer = e.target.value.trim(); }) }),
          away.length ? h('span', { class: 'wi warn', tip: s.wer + ' hat Urlaub: ' + away.map(v => fmtS(v.von) + '–' + fmtS(v.bis)).join(', ') }, '⚠') : null),
        h('div', { class: 'c-kom' }, h('input', { value: s.kommentar || '', title: s.kommentar || '', placeholder: '–', 'data-fk': fk('kom'), onchange: e => setStep(m.id, s.id, st => { st.kommentar = e.target.value; }) })),
        h('div', { class: 'c-dur' + (s.fix ? ' fix' : '') }, isTask ? h('input', { type: 'number', min: 0, max: MAX_DAUER, value: s.dauer ?? 0, 'data-fk': fk('dur'), tip: 'Dauer in Tagen', onchange: e => { const v = Math.round(+e.target.value || 0); if (v > MAX_DAUER) toast('Höchstens ' + MAX_DAUER + ' Tage – auf ' + MAX_DAUER + ' gesetzt.', 'warn');
          const nv = clamp(v, 0, MAX_DAUER);                       // Beginn bleibt, das Ende wandert (und was danach beginnt)
          if (r.start != null && !r.err) commit(d => { setStepSpan(findM(d, m.id), s.id, r.start, r.start + nv); }); else setStep(m.id, s.id, st => { st.dauer = nv; }); } }) : null, isTask && s.fix ? h('span', { class: 'fixlock', tip: 'Feste Dauer – bleibt beim anteiligen Anpassen unverändert (⋯ → „Dauer freigeben“)', 'aria-label': 'feste Dauer' }) : null),
        h('div', { class: 'c-date' + (r.err ? ' err' : ''), tip: r.err || null }, r.err ? '⚠ ' + r.err : startInp),
        h('div', { class: 'c-date' }, r.err ? '' : endInp)],
      h('div', { class: 'c-acts' }, menuButton('⋯', [['Neue Aufgabe darunter', () => addStep(m.id, curGroupOf(p.steps, row.idx), s.id)],
        secK && !s.pal ? ['Als Beginn von „' + phName(secK) + '“ festlegen', () => commit(d => { const pl = findM(d, m.id).plan; pl.marks = Object.assign({}, pl.marks, { [secK]: s.id }); }, s.name + ' = ' + startLabel(secK))] : false,
        secK && p.marks && p.marks[secK] ? ['Beginn von „' + phName(secK) + '“ automatisch (frühester Schritt)', () => commit(d => { const pl = findM(d, m.id).plan; pl.marks = Object.assign({}, pl.marks); delete pl.marks[secK]; })] : false,
        isTask ? [s.fix ? 'Dauer freigeben (nicht mehr fest)' : 'Dauer festlegen (fix)', () => setStep(m.id, s.id, st => { if (st.fix) delete st.fix; else st.fix = true; }, s.fix ? '„' + s.name + '“: Dauer wieder frei' : '„' + s.name + '“: feste Dauer – bleibt beim anteiligen Anpassen')] : false,
        predsOf(s).length || dependents(p, s).length ? ['Verknüpfungen dieses Schritts lösen', () => unlinkSteps(m.id, predsOf(s).map(a => [a, s.id]).concat(dependents(p, s).map(q => [s.id, q.id])))] : false, null,
        s.pal ? false : ['Löschen', () => deleteStep(m.id, s.id)]], 'right'))));
    // Gantt-Zeile
    const g = h('div', { class: 'g-row' });
    if (s.wer) for (const v of C.vac.filter(v => v.u.wer === s.wer && v.bis >= a0 && v.von <= a1))
      g.append(h('div', { class: 'g-vac', style: { left: X(Math.max(v.von, a0)) + 'px', width: (Math.min(v.bis, a1) - Math.max(v.von, a0) + 1) * pxd + 'px' }, tip: s.wer + ': Urlaub ' + fmtS(v.von) + '–' + fmtS(v.bis) }));
    if (r.start != null) {
      const gname = grpName;
      const tip = () => h('div', null, h('b', null, s.name), gname ? h('span', { class: 'muted' }, ' (' + gname + ')') : null,
        h('div', null, isTask ? fmtW(r.start) + ' – ' + fmtW(r.end) + ' · ' + stepWT(r.start, r.end) + ' WT' : (s.pal ? 'PAL' : STEP_TYPES[s.typ]) + ': ' + fmtW(r.end)),
        s.wer ? h('div', null, 'Zugeordnet: ' + s.wer) : null, s.kommentar ? h('div', { class: 'muted' }, s.kommentar) : null,
        h('div', { class: 'muted' }, anchorText(p, s) + (dependents(p, s).length ? ' · danach beginnen: ' + dependents(p, s).map(q => '„' + q.name + '“').join(', ') : '')),
        away.length ? h('div', { class: 'warn' }, '⚠ ' + s.wer + ' hat in dieser Zeit Urlaub') : null);
      const ctx = { x, s, r, pxd, X };
      if (isTask) {
        const c = barColor(s.wer);
        const bar = h('div', { class: 'g-bar' + (away.length ? ' conflict' : '') + (late.has(s.id) ? ' late' : ''), dataset: { sid: s.id }, tip, style: { left: X(r.start) + pxd / 2 + 'px', width: Math.max(3, (r.end - r.start) * pxd) + 'px', background: midtone(c), borderColor: c } },
          (r.end - r.start) * pxd > 70 ? h('span', { class: 'lbl' }, s.name) : null,
          h('span', { class: 'grip gl', onpointerdown: e => barDrag(e, ctx, 'left') }), h('span', { class: 'grip gr', onpointerdown: e => barDrag(e, ctx, 'right') }));
        bar.addEventListener('pointerdown', e => { if (!e.target.classList.contains('grip')) barDrag(e, ctx, 'move'); });
        ctx.el = bar;
        g.append(bar); if (grpEls) grpEls.push(bar);
      } else {
        // Briefkasten-Termin: rotes P wie im Kalender – ziehen verschiebt das PAL und damit den ganzen Plan
        const dia = s.pal ? h('div', { class: 'g-pal', tip, onpointerdown: e => barDrag(e, ctx, 'move') }, sym('P'))
          : h('div', { class: 'g-dia' + (late.has(s.id) ? ' late' : ''), dataset: { sid: s.id }, tip, onpointerdown: e => barDrag(e, ctx, 'move') });
        dia.style.left = X(r.end) + pxd / 2 + 'px'; if (!s.pal) dia.style.background = x.color;
        ctx.el = dia;
        g.append(dia); if (grpEls && !s.pal) grpEls.push(dia);
      }
    }
    grows.push(g);
  }
  const thead = h('div', { class: 'pl-row head' + (compact ? ' compact' : '') }, h('div', { class: 'c-grip' }), h('div', { class: 'c-name' }, 'Arbeitsschritt'),
    compact ? null : [h('div', { class: 'c-typ' }, 'Typ'), h('div', { class: 'c-wer' }, 'Zugeordnet'), h('div', { class: 'c-kom' }, 'Kommentar'), h('div', { class: 'c-dur' }, 'Dauer'),
      h('div', { class: 'c-date' }, 'Beginn'), h('div', { class: 'c-date' }, 'Ende')], h('div', { class: 'c-acts' }));
  const gantt = h('div', { class: 'pl-gantt', 'data-keep-scroll': 'plg' }, h('div', { style: { width: W + 'px' } }, ghead, h('div', { class: 'g-body' }, gbg, grows)));
  gantt.addEventListener('pointerdown', e => jointDown(e, m.id), true);   // Strg auf einem Punkt: lösen/verknüpfen
  tlPan(gantt);
  planWheel(gantt, a0, fitP);
  UI._pl = { a0, pxd };
  const table = h('div', { class: 'pl-table' }, thead, trows,
    h('div', { class: 'pl-row addrow' + (compact ? ' compact' : '') }, h('div', { class: 'c-add' }, h('button', { class: 'addlink', onclick: () => addGroup(m.id) }, '+ Abschnitt'))));
  linkHandlers(table, m.id);
  put(main, palOverBanner(x, over), personList(), h('div', { class: 'pl-split' + (compact ? ' compact' : ''), style: { '--lkc': inkC(x.color) } },
    table,
    h('div', { class: 'pl-divider' }, h('button', { class: 'divbtn', tip: compact ? 'alle Spalten zeigen' : 'nur Arbeitsschritte zeigen – mehr Platz für das Gantt', 'aria-label': 'Tabelle ein-/ausklappen',
      onclick: () => { UI.planCompact = !compact; UI.planPxd = 0; saveUI(); renderNow(); } }, compact ? '›' : '‹')),
    gantt));
};
// Zeichen des Bereichs in der Abschnittszeile (nicht mehr am ersten Schritt); Hinweis: Start und womit er beginnt
function groupMark(g, pc, p) {
  const k = g.bereich; if (!k || !phase(k)) return null;
  const ph = pc.ph[k], first = ph && ph.mark ? p.steps.find(q => q.id === ph.mark) : null;
  const c = demoChip(k, 'mark');
  setTip(c, startLabel(k) + (ph && ph.start != null ? ': ' + fmtW(ph.start) : ' – noch ohne Termin') + (first ? ' · beginnt mit „' + first.name + '“' : ''));
  return c;
}
function curGroupOf(steps, idx) { for (let i = idx; i >= 0; i--) if (steps[i].typ === 'gruppe') return steps[i].id; return null; }
function curBereich(steps, idx) { for (let i = idx; i >= 0; i--) if (steps[i].typ === 'gruppe') return steps[i].bereich || null; return null; }
VIEW_FN['plaene:after'] = () => {
  drawLinks();
  if (UI.focusFk) { const e = $('[data-fk="' + CSS.escape(UI.focusFk) + '"]'); if (e) { e.focus(); e.select && e.select(); } UI.focusFk = null; }
  const g = $('.pl-gantt');
  if (g && UI._pl) {
    if (UI.planAnchor) { g.scrollLeft = Math.max(0, (UI.planAnchor.d - UI._pl.a0) * UI._pl.pxd - UI.planAnchor.off); UI.planAnchor = null; }
    if (UI.planScrollReset) { g.scrollLeft = 0; UI.planScrollReset = false; }
  }
};
let _planWheel = null;
function planWheel(box, a0, fit) {
  box.addEventListener('wheel', ev => {
    if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) || ev.shiftKey) return;
    ev.preventDefault();
    const r = box.getBoundingClientRect(), off = ev.clientX - r.left, cur = UI._pl ? UI._pl.pxd : fit;
    const base = _planWheel ? _planWheel.pxd : cur;
    if (!_planWheel) _planWheel = { d: a0 + (box.scrollLeft + off) / cur, off };
    _planWheel.pxd = clamp(base * (ev.deltaY < 0 ? 1.2 : 1 / 1.2), Math.min(fit, 2), 60);
    requestAnimationFrame(() => {
      if (!_planWheel) return;
      const w = _planWheel; _planWheel = null;
      UI.planPxd = w.pxd <= fit * 1.001 ? 0 : w.pxd; UI.planAnchor = { d: w.d, off: w.off };
      renderNow();
    });
  }, { passive: false });
}

// Werktage eines Schritts (Beginn bis zum Tag vor dem Ende, wie der Balken im Gantt)
const stepWT = (a, b) => a != null && b != null && b > a ? workdays(a, b - 1) : 0;

/* ---------- Ganzen Abschnitt verschieben: alle Schritte darin wandern um dieselbe Zahl Tage mit */
function shiftGroup(mid, gid, dd) {
  if (!dd) return;
  commit(d => {
    const m = findM(d, mid); if (!m || !m.plan) return;
    const pc0 = planCalc(m), bl = groupBlocks(m.plan.steps).get(gid); if (!bl) return;
    const tg = m.plan.steps.slice(bl[0] + 1, bl[1]).filter(q => !q.pal).map(q => [q.id, pc0.map.get(q.id)]).filter(([, r]) => r && r.end != null)
      .map(([id, r]) => [id, (r.start ?? r.end) + dd, r.end + dd]);
    // mehrere Durchgänge: hängt ein Schritt an einem anderen im Abschnitt, wandert er beim ersten schon mit – danach wird nachkorrigiert
    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      for (const [id, ns, ne] of tg) { const r = planCalc(m).map.get(id); if (r && r.end !== ne) { setStepSpan(m, id, ns, ne); moved = true; } }
      if (!moved) break;
    }
  }, 'Abschnitt um ' + (dd > 0 ? '+' : '') + dd + ' Tage verschoben');
}
function groupDrag(ev, ctx) {
  if (ev.button !== 0) return;
  ev.preventDefault(); ev.stopPropagation(); hideTip();
  const { x, g, a, b, pxd, el, els } = ctx, sx = ev.clientX, l0 = parseFloat(el.style.left), items = (els || []).map(e => [e, parseFloat(e.style.left)]);
  document.body.classList.add('dragging');
  const lab = h('div', { class: 'drag-lab' }); document.body.append(lab);
  let dd = 0;
  const move = e => {
    dd = Math.round((e.clientX - sx) / pxd);
    el.style.left = (l0 + dd * pxd) + 'px'; items.forEach(([q, l]) => { q.style.left = (l + dd * pxd) + 'px'; });
    setKids(lab, h('b', null, 'Abschnitt „' + g.name + '“'), h('div', null, fmtW(a + dd) + ' – ' + fmtW(b + dd)), h('div', { class: 'muted' }, dd ? 'um ' + (dd > 0 ? '+' : '') + dd + ' Tage' : 'unverändert'));
    placeLab(lab, e.clientX, e.clientY);
  };
  const end = okay => {
    document.body.classList.remove('dragging'); lab.remove();
    if (!okay || !dd) { el.style.left = l0 + 'px'; items.forEach(([q, l]) => { q.style.left = l + 'px'; }); return; }
    shiftGroup(x.id, g.id, dd);
  };
  dragSession(ev, el, move, end);
  move(ev);
}
async function shiftGroupDialog(mid, gid) {
  const x = C.byId.get(mid); if (!x) return;
  const p = x.m.plan, bl = groupBlocks(p.steps).get(gid); if (!bl) return;
  const g = p.steps[bl[0]], spans = p.steps.slice(bl[0] + 1, bl[1]).map(q => x.pc.map.get(q.id)).filter(r => r && r.end != null);
  if (!spans.length) return;
  const a = Math.min(...spans.map(r => r.start ?? r.end));
  let nv = a;
  const inp = h('input', { type: 'date', value: ds(a), oninput: e => { const v = dn(e.target.value); if (v != null) nv = v; } });
  const ok = await modal('Abschnitt „' + g.name + '“ verschieben', h('div', { class: 'form' },
    h('label', { class: 'frow' }, h('span', null, 'Neuer Beginn'), inp),
    h('p', { class: 'muted small' }, 'Bisher ab ' + fmtW(a) + '. Alle ' + spans.length + ' Schritte des Abschnitts wandern um dieselbe Zahl Tage mit; Schritte, die daran hängen, ebenfalls.')),
    [['Abbrechen', false], ['Verschieben', true, 'primary']]);
  if (ok && nv !== a) shiftGroup(mid, gid, nv - a);
}

/* ---------- Balken ziehen: verschieben oder Dauer ändern */
function barDrag(ev, ctx, mode) {
  if (ev.button !== 0) return;
  if ((ev.ctrlKey || ev.metaKey) && !ctx.s.pal) {                     // Strg: verknüpfen statt verschieben (linke/rechte Hälfte = Beginn/Ende)
    const b = ctx.el.getBoundingClientRect();
    return linkDrag(ev, ctx.x.id, ctx.s.id, ctx.s.typ !== 'aufgabe' ? 'both' : mode === 'left' ? 'start' : mode === 'right' ? 'end' : ev.clientX < b.left + b.width / 2 ? 'start' : 'end');
  }
  ev.preventDefault(); ev.stopPropagation(); hideTip();
  const { x, s, r, pxd, X, el } = ctx, sx = ev.clientX;
  document.body.classList.add('dragging');
  const lab = h('div', { class: 'drag-lab' }); document.body.append(lab);
  let ns = r.start, ne = r.end, moved = false;
  const isTask = s.typ === 'aufgabe';
  // PAL ziehen: alle Balken wandern schon beim Ziehen mit
  const along = s.pal ? $$('.g-bar, .g-dia, .g-sum, .palline', el.closest('.pl-gantt')) : [];
  const slide = n => along.forEach(q => { q.style.translate = n ? n * pxd + 'px 0' : ''; });
  const move = e => {
    const dd = Math.round((e.clientX - sx) / pxd);
    if (dd) moved = true;
    if (mode === 'move') { ns = r.start + dd; ne = r.end + dd; }
    else if (mode === 'left') { ns = Math.min(r.start + dd, r.end); ne = r.end; }
    else { ns = r.start; ne = Math.max(r.end + dd, r.start); }
    if (isTask) { el.style.left = X(ns) + pxd / 2 + 'px'; el.style.width = Math.max(3, (ne - ns) * pxd) + 'px'; }
    else el.style.left = X(ne) + pxd / 2 + 'px';
    slide(ne - r.end);
    const w = s.wer ? C.vac.filter(v => v.u.wer === s.wer && v.von <= ne && v.bis >= ns).map(v => s.wer + ' Urlaub ' + fmtS(v.von) + '–' + fmtS(v.bis)) : [];
    setKids(lab, h('b', null, s.name), h('div', null, isTask ? fmtW(ns) + ' – ' + fmtW(ne) + ' · ' + stepWT(ns, ne) + ' WT' : (s.pal ? 'PAL: ' : '') + fmtW(ne)), s.pal ? h('div', { class: 'muted' }, ne !== r.end ? 'um ' + (ne > r.end ? '+' : '') + (ne - r.end) + ' Tage – alle Schritte wandern mit' : 'alle Schritte wandern mit') : null, w.length ? h('div', { class: 'warn' }, '⚠ ' + w.join(' · ')) : null);
    placeLab(lab, e.clientX, e.clientY);
  };
  const end = okay => {
    document.body.classList.remove('dragging'); lab.remove(); slide(0);
    if (!okay) {                                  // abgebrochen: Balken zurück
      if (isTask) { el.style.left = X(r.start) + pxd / 2 + 'px'; el.style.width = Math.max(3, (r.end - r.start) * pxd) + 'px'; } else el.style.left = X(r.end) + pxd / 2 + 'px';
      return;
    }
    if (!moved || (ns === r.start && ne === r.end)) return;
    if (s.pal) { commit(d => { const m = findM(d, x.id); if (m) shiftPal(m, ne - r.end); }, 'PAL: ' + fmtW(ne) + ' (ganzer Plan mitverschoben)'); return; }   // Briefkasten-Termin ziehen = PAL und ganzen Plan verschieben
    commit(d => { const m = findM(d, x.id); if (m && m.plan) setStepSpan(m, s.id, ns, ne); }, s.name + ': ' + (isTask ? fmtS(ns) + '–' + fmtS(ne) : fmtS(ne)));
  };
  dragSession(ev, el, move, end);
  move(ev);
}

/* ---------- Zeilen ziehen: Reihenfolge ändern */
function rowDrag(ev, mid, sid) {
  if (ev.button !== 0) return;
  ev.preventDefault(); hideTip();
  const table = ev.currentTarget.closest('.pl-table'), src = ev.currentTarget.closest('.pl-row');
  document.body.classList.add('dragging');
  src.classList.add('dragrow');
  let target = null, after = false;
  const clear = () => $$('.pl-row.drop-before, .pl-row.drop-after', table).forEach(r => r.classList.remove('drop-before', 'drop-after'));
  const move = e => {
    clear();
    const rows = $$('.pl-row[data-rid]', table);
    let best = null;
    for (const r of rows) { const b = r.getBoundingClientRect(); if (e.clientY >= b.top && e.clientY < b.bottom) { best = r; after = e.clientY > b.top + b.height / 2; break; } }
    if (!best && rows.length) { const last = rows[rows.length - 1]; if (e.clientY >= last.getBoundingClientRect().bottom) { best = last; after = true; } }
    target = best;
    if (best && best !== src) best.classList.add(after ? 'drop-after' : 'drop-before');
  };
  const end = okay => {
    document.body.classList.remove('dragging'); src.classList.remove('dragrow'); clear();
    if (!okay || !target || target === src) return;
    const m0 = findM(D, mid); if (!m0 || !m0.plan) return;
    const steps = m0.plan.steps, ti = steps.findIndex(s => s.id === target.dataset.rid);
    if (ti < 0) return;
    let beforeId;
    if (!after) beforeId = target.dataset.rid;
    else {
      let j = ti + 1;
      const tgt = steps[ti];
      if (tgt.typ === 'gruppe' && UI.planColl[mid + ':' + tgt.id]) while (j < steps.length && steps[j].typ !== 'gruppe') j++;
      beforeId = j < steps.length ? steps[j].id : null;
    }
    if (beforeId === sid) return;
    moveRows(mid, sid, beforeId);
  };
  dragSession(ev, ev.currentTarget, move, end);
}

/* ---------- Verknüpfungen Ende → Beginn: anzeigen, mit Strg anlegen, lösen
   Ein Schritt kann nach beliebig vielen Vorgängern beginnen (spätestes Ende zählt), ein Ende beliebig viele Nachfolger haben.
   Auch über Abschnitte hinweg (ab 0.10.2), ohne Kreis, nicht am Briefkasten-Termin. */
function secMap(p) { const out = new Map(); let g = ''; for (const s of p.steps) { if (s.typ === 'gruppe') g = s.id; else out.set(s.id, g); } return out; }
function isAncestor(p, anc, id) {                // beginnt „id“ (über Ecken) nach „anc“?
  const byId = new Map(p.steps.map(s => [s.id, s])), seen = new Set(), st = [id];
  while (st.length) { const q = st.pop(); if (q === anc) return true; if (seen.has(q)) continue; seen.add(q); predsOf(byId.get(q)).forEach(r => st.push(r)); }
  return false;
}
function canLink(p, a, b) {                       // darf „b“ nach dem Ende von „a“ beginnen?
  const A = p.steps.find(s => s.id === a), B = p.steps.find(s => s.id === b);
  return !!A && !!B && a !== b && A.typ !== 'gruppe' && B.typ !== 'gruppe' && !A.pal && !B.pal && !predsOf(B).includes(a) && !isAncestor(p, b, a);
}
const stepName = (p, id) => '„' + ((p.steps.find(s => s.id === id) || {}).name || '?') + '“';
function linkSteps(mid, a, b) {
  const p = C.byId.get(mid).m.plan;
  commit(d => { const q = findM(d, mid).plan.steps.find(s => s.id === b); if (!q) return;
    q.anker = { art: 'nach', refs: predsOf(q).concat(a), offset: q.anker && q.anker.art === 'nach' ? +q.anker.offset || 0 : 0 }; },   // neu verknüpft: beginnt direkt am Ende
    stepName(p, b) + ' beginnt nach ' + stepName(p, a));
}
function unlinkSteps(mid, pairs) {                // [[Vorgänger, Nachfolger], …] – Termine bleiben
  const p = C.byId.get(mid).m.plan;
  commit(d => { const m = findM(d, mid), map = planCalc(m).map, pal = dn(m.pal);
    for (const [a, b] of pairs) { const q = m.plan.steps.find(s => s.id === b); if (q && predsOf(q).includes(a)) setPreds(q, predsOf(q).filter(id => id !== a), map.get(b), map, pal); } },
    (pairs.length > 1 ? pairs.length + ' Verknüpfungen gelöst' : 'Verknüpfung ' + stepName(p, pairs[0][0]) + ' → ' + stepName(p, pairs[0][1]) + ' gelöst') + ' – Strg+Z macht es rückgängig');
}
// Datumsfeld eines Schritts: Beginn (Aufgabe) bzw. das eine Datum (Meilenstein)
function dateField(p, id, as) { const s = p.steps.find(q => q.id === id); return s ? $('.pl-table [data-fk="' + CSS.escape('st:' + id + ':' + (as === 'start' && s.typ === 'aufgabe' ? 'start' : 'end')) + '"]') : null; }
const fieldOf = el => { const m = /^st:(.+):(start|end)$/.exec((el && el.dataset && el.dataset.fk) || ''); return m ? { sid: m[1], f: m[2] } : null; };
const roleOf = (s, f) => s.typ !== 'aufgabe' ? 'both' : f;
// Paare, an denen ein Datum beteiligt ist
function linkPairs(p, s, role) {
  return (role !== 'start' ? dependents(p, s).map(q => [s.id, q.id]) : []).concat(role !== 'end' ? predsOf(s).map(a => [a, s.id]) : []);
}
function linkHandlers(table, mid) {
  const P = () => C.byId.get(mid).m.plan;
  const pick = e => { const i = e.target.closest && e.target.closest('input[type=date]'); const f = fieldOf(i); return f ? Object.assign(f, { el: i }) : null; };
  table.addEventListener('pointerdown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return;
    const f = pick(e); if (!f) return;
    const s = P().steps.find(q => q.id === f.sid); if (!s || s.pal) return;
    linkDrag(e, mid, f.sid, roleOf(s, f.f));
  }, true);
  for (const t of ['mousedown', 'click']) table.addEventListener(t, e => { if ((e.ctrlKey || e.metaKey) && pick(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
  table.addEventListener('mouseover', e => { if (document.body.classList.contains('linking')) return; const f = pick(e); if (f && f.el.classList.contains('lk')) linkHl(mid, f.sid, f.f); });
  table.addEventListener('mouseout', e => { const f = pick(e); if (f && f.el.classList.contains('lk') && !(e.relatedTarget && f.el.contains(e.relatedTarget))) linkHl(mid, null); });
}
// Hinzeigen auf ein verknüpftes Datum: die Partner bleiben farbig, alle anderen Kalendersymbole werden hellgrau, im Gantt das Gelenk in Farbe
function linkHl(mid, sid, f) {
  const split = $('.pl-split'); if (!split) return;
  split.classList.remove('lkhl'); $$('.lkon, .lkkeep', split).forEach(e => e.classList.remove('lkon', 'lkkeep')); $$('.g-links .lnk.on', split).forEach(e => e.classList.remove('on'));
  if (!sid) return;
  const p = C.byId.get(mid).m.plan, s = p.steps.find(q => q.id === sid); if (!s) return;
  const pairs = linkPairs(p, s, roleOf(s, f)); if (!pairs.length) return;
  split.classList.add('lkhl');
  for (const [a, b] of pairs) {
    [dateField(p, a, 'end'), dateField(p, b, 'start')].forEach(e => e && e.classList.add('lkon'));
    $$('.g-body [data-sid="' + CSS.escape(a) + '"], .g-body [data-sid="' + CSS.escape(b) + '"]', split).forEach(e => e.classList.add('lkkeep'));
    $$('.g-links .lnk', split).filter(e => e.dataset.a === a && e.dataset.b === b).forEach(e => e.classList.add('on'));
  }
}
// Gelenke im Gantt: Punkt am Ende des Vorgängers und am Beginn des Nachfolgers, feine gepunktete Verbindung
let LINK_PTS = null;                              // Punkte der Gelenke im Gantt (relativ zum Gantt-Inhalt)
function drawLinks() {
  const body = $('.pl-gantt .g-body'), x = C.byId.get(UI.planSel);
  LINK_PTS = null;
  if (!body || UI.printing || !x || !x.m.plan) return;
  $$('svg.g-links', body).forEach(e => e.remove());
  const bb = body.getBoundingClientRect(), pt = new Map();
  for (const e of $$('[data-sid]', body)) {
    const r = e.getBoundingClientRect(), bar = e.classList.contains('g-bar'), y = (r.top + r.bottom) / 2 - bb.top, c = (r.left + r.right) / 2 - bb.left;
    pt.set(e.dataset.sid, { bar, s: bar ? r.left - bb.left : c, e: bar ? r.right - bb.left : c, y });
  }
  let out = '';
  LINK_PTS = { body, list: [] };
  for (const q of x.m.plan.steps) for (const a of predsOf(q)) {
    const A = pt.get(a), B = pt.get(q.id); if (!A || !B) continue;
    LINK_PTS.list.push({ a, b: q.id, pa: { x: A.e, y: A.y }, pb: { x: B.s, y: B.y } });
    out += '<g class="lnk" data-a="' + escAttr(a) + '" data-b="' + escAttr(q.id) + '"><path d="M' + A.e + ' ' + A.y + ' L' + B.s + ' ' + B.y + '"/>' +
      (A.bar ? '<circle cx="' + A.e + '" cy="' + A.y + '" r="3"/>' : '') + (B.bar ? '<circle cx="' + B.s + '" cy="' + B.y + '" r="3"/>' : '') + '</g>';
  }
  if (!out) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'g-links'); svg.setAttribute('width', body.scrollWidth); svg.setAttribute('height', body.scrollHeight);
  svg.innerHTML = out; body.append(svg);
}
const escAttr = v => String(v).replace(/[&"<>]/g, c => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[c]);
// Strg + Ziehen: vom Ende eines Schritts auf den Beginn eines anderen (oder umgekehrt). Nur passende Ziele bleiben sichtbar.
function linkDrag(ev, mid, sid, role) {
  if (ev.button !== 0) return;
  ev.preventDefault(); ev.stopPropagation(); hideTip(); closeMenu();
  const x = C.byId.get(mid), p = x.m.plan, split = $('.pl-split'), body = $('.pl-gantt .g-body');
  if (!split) return;
  const gpt = (id, as) => { const e = body && body.querySelector('[data-sid="' + CSS.escape(id) + '"]'); if (!e) return null; const r = e.getBoundingClientRect(), bar = e.classList.contains('g-bar'); return { x: !bar ? (r.left + r.right) / 2 : as === 'start' ? r.left : r.right, y: (r.top + r.bottom) / 2 }; };
  const T = [];
  for (const q of p.steps) {
    if (q.typ === 'gruppe' || q.pal || q.id === sid) continue;
    if (role !== 'start' && canLink(p, sid, q.id)) T.push({ id: q.id, as: 'start', pair: [sid, q.id] });
    if (role !== 'end' && canLink(p, q.id, sid)) T.push({ id: q.id, as: 'end', pair: [q.id, sid] });
  }
  T.forEach(t => { t.el = dateField(p, t.id, t.as); t.pt = gpt(t.id, t.as); if (t.el) t.el.classList.add('lktarget'); const g = body && body.querySelector('[data-sid="' + CSS.escape(t.id) + '"]'); if (g) g.classList.add('lktarget'); });
  const src = dateField(p, sid, role === 'start' ? 'start' : 'end'), sp = gpt(sid, role === 'start' ? 'start' : 'end');
  if (src) src.classList.add('lksrc');
  const g0 = body && body.querySelector('[data-sid="' + CSS.escape(sid) + '"]'); if (g0) g0.classList.add('lksrc');
  split.classList.add('lkmode'); document.body.classList.add('linking');
  const ns = 'http://www.w3.org/2000/svg', ov = document.createElementNS(ns, 'svg');
  ov.setAttribute('class', 'lk-overlay'); ov.style.setProperty('--lkc', inkC(x.color));
  ov.innerHTML = T.filter(t => t.pt).map((t, i) => '<circle class="ring" data-i="' + T.indexOf(t) + '" cx="' + t.pt.x + '" cy="' + t.pt.y + '" r="6"/>').join('') + '<path class="band" d=""/>';
  document.body.append(ov);
  const band = ov.querySelector('.band'), lab = h('div', { class: 'drag-lab' }); document.body.append(lab);
  const from = () => { if (sp && Math.hypot(sp.x - ev.clientX, sp.y - ev.clientY) < 40) return sp; if (src) { const r = src.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } return { x: ev.clientX, y: ev.clientY }; };
  const p0 = from();
  let hot = null, moved = false;
  const pickT = e => {
    let best = null;
    for (const t of T) {
      if (t.el) { const r = t.el.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return t; }
      if (t.pt) { const dd = Math.hypot(t.pt.x - e.clientX, t.pt.y - e.clientY); if (dd < 16 && (!best || dd < best.d)) best = { t, d: dd }; }
    }
    return best && best.t;
  };
  const preview = t => { const sim = JSON.parse(JSON.stringify(x.m)), q = sim.plan.steps.find(s => s.id === t.pair[1]); q.anker = { art: 'nach', refs: predsOf(q).concat(t.pair[0]), offset: q.anker && q.anker.art === 'nach' ? +q.anker.offset || 0 : 0 }; const r = planCalc(sim).map.get(t.pair[1]); return r && r.start != null ? fmtW(r.start) : null; };
  const move = e => {
    if (Math.hypot(e.clientX - ev.clientX, e.clientY - ev.clientY) > 4) moved = true;
    hot = moved ? pickT(e) : null;
    T.forEach((t, i) => { if (t.el) t.el.classList.toggle('lkhot', t === hot); const c = ov.querySelector('.ring[data-i="' + i + '"]'); if (c) c.classList.toggle('hot', t === hot); });
    const to = hot ? (hot.el && !(hot.pt && Math.hypot(hot.pt.x - e.clientX, hot.pt.y - e.clientY) < 16) ? (() => { const r = hot.el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })() : hot.pt) : { x: e.clientX, y: e.clientY };
    band.setAttribute('d', moved ? 'M' + p0.x + ' ' + p0.y + ' L' + to.x + ' ' + to.y : '');
    if (!moved) { lab.style.display = 'none'; return; }
    lab.style.display = '';
    if (hot) { const when = preview(hot); setKids(lab, h('b', null, 'Verknüpfen'), h('div', null, 'Ende ' + stepName(p, hot.pair[0]) + ' → Beginn ' + stepName(p, hot.pair[1])), when ? h('div', { class: 'muted' }, stepName(p, hot.pair[1]) + ' beginnt dann am ' + when) : null); }
    else setKids(lab, h('b', null, T.length ? (role === 'start' ? 'Auf ein markiertes Ende ziehen' : role === 'end' ? 'Auf einen markierten Beginn ziehen' : 'Auf einen markierten Beginn oder ein Ende ziehen') : 'Nichts zum Verknüpfen'),
      h('div', { class: 'muted' }, T.length ? 'auch in anderen Abschnitten – nur kein Kreis' : 'Hier gibt es nichts, womit sich verknüpfen ließe.'));
    placeLab(lab, e.clientX, e.clientY);
  };
  const end = okay => {
    ov.remove(); lab.remove(); split.classList.remove('lkmode'); document.body.classList.remove('linking');
    $$('.lktarget, .lkhot, .lksrc').forEach(e => e.classList.remove('lktarget', 'lkhot', 'lksrc'));
    if (!okay) return;
    if (hot) { linkSteps(mid, hot.pair[0], hot.pair[1]); return; }
    if (!moved) { const at = ev.target && ev.target.closest && ev.target.closest('.pl-gantt') ? { x: ev.clientX, y: ev.clientY } : src || g0; setTimeout(() => linkMenu(mid, sid, role, at), 0); }   // Strg+Klick: lösen
  };
  dragSession(ev, null, move, end);
  move(ev);
}
// Strg+Klick auf ein verknüpftes Datum oder einen Punkt im Gantt: eine Verknüpfung → gleich lösen, mehrere → Auswahl an der Stelle
function linkMenu(mid, sid, role, at) {
  const p = C.byId.get(mid).m.plan, s = p.steps.find(q => q.id === sid); if (!s) return;
  const pairs = linkPairs(p, s, role);
  if (!pairs.length) { toast(role === 'start' ? 'Mit Strg vom Ende eines anderen Schritts hierher ziehen, um zu verknüpfen.' : 'Mit Strg von hier auf den Beginn eines anderen Schritts ziehen, um zu verknüpfen.'); return; }
  pairMenu(mid, pairs, at);
}
function pairMenu(mid, pairs, at) {
  const p = C.byId.get(mid).m.plan;
  closeMenu();
  if (pairs.length === 1) { unlinkSteps(mid, pairs); return; }
  const items = pairs.map(pr => [stepName(p, pr[0]) + ' → ' + stepName(p, pr[1]) + ' lösen', () => unlinkSteps(mid, [pr])]);
  items.push(null, ['Alle ' + pairs.length + ' lösen', () => unlinkSteps(mid, pairs)]);
  const mn = h('div', { class: 'menu', role: 'menu' }, h('div', { class: 'menu-head' }, 'Welche Verknüpfung lösen?'), items.map(it => it ? h('button', { role: 'menuitem', onclick: () => { closeMenu(); it[1](); } }, it[0]) : h('hr')));
  document.body.append(mn);
  placeMenu(mn, at && at.getBoundingClientRect ? at.getBoundingClientRect() : at ? { left: at.x, right: at.x, top: at.y, bottom: at.y } : document.body.getBoundingClientRect(), 'left');
  _openMenu = { m: mn, btn: null, at: performance.now() };
}
// Strg im Gantt auf einem Punkt (Gelenk): Klick löst, Ziehen verknüpft von dort aus neu
function jointDown(ev, mid) {
  if (!(ev.ctrlKey || ev.metaKey) || ev.button !== 0 || !LINK_PTS) return;
  const bb = LINK_PTS.body.getBoundingClientRect(), x = ev.clientX - bb.left, y = ev.clientY - bb.top;
  let best = null;
  for (const l of LINK_PTS.list) for (const [k, pt] of [['a', l.pa], ['b', l.pb]]) {
    const d = Math.hypot(pt.x - x, pt.y - y); if (d <= 7 && (!best || d < best.d)) best = { d, key: k === 'a' ? l.a + ':end' : l.b + ':start', sid: k === 'a' ? l.a : l.b, f: k === 'a' ? 'end' : 'start' };
  }
  if (!best) return;                                  // kein Punkt getroffen: normaler Balken (Strg+Ziehen verknüpft)
  ev.preventDefault(); ev.stopPropagation(); hideTip();
  const pairs = LINK_PTS.list.filter(l => l.a + ':end' === best.key || l.b + ':start' === best.key).map(l => [l.a, l.b]);
  const p = C.byId.get(mid).m.plan, s = p.steps.find(q => q.id === best.sid);
  let moved = false;
  dragSession(ev, null, e => { if (!moved && Math.hypot(e.clientX - ev.clientX, e.clientY - ev.clientY) > 4) { moved = true; linkDrag(ev, mid, best.sid, roleOf(s, best.f)); } },
    okay => { if (okay && !moved) setTimeout(() => pairMenu(mid, pairs, { x: ev.clientX, y: ev.clientY }), 0); });
}

/* ---------- Schritte eines Bereichs, die nach dem PAL enden: Warnung und „Alles vor den PAL rücken“
   Der PAL bleibt, die Dauern bleiben; die Kette davor (ihre ersten Schritte) rückt so weit nach vorn, dass alles wieder spätestens am PAL endet. */
function palOverSteps(m, pc) {
  const pal = dn(m.pal), out = []; if (pal == null || !m.plan) return out;
  let ber = null;
  for (const s of m.plan.steps) {
    if (s.typ === 'gruppe') { ber = s.bereich || null; continue; }
    if (!ber || s.pal) continue;
    const r = pc.map.get(s.id); if (r && !r.err && r.end != null && r.end > pal) out.push({ id: s.id, name: s.name, end: r.end, over: r.end - pal, ber });
  }
  return out;
}
function palOverBanner(x, over) {
  if (!over.length) return null;
  const sig = x.id + ':' + over.map(o => o.id + '@' + o.end).join(',');
  if (UI.palOverSeen === sig) return null;
  const worst = over.reduce((a, b) => b.over > a.over ? b : a);
  return h('div', { class: 'banner warn plwarn' },
    h('span', null, over.length === 1 ? '„' + worst.name + '“ endet ' + worst.over + (worst.over === 1 ? ' Tag' : ' Tage') + ' nach dem PAL.'
      : over.length + ' Schritte enden nach dem PAL – am weitesten „' + worst.name + '“ (' + worst.over + (worst.over === 1 ? ' Tag' : ' Tage') + ').'),
    h('button', { class: 'primary', tip: 'Der PAL bleibt, die Dauern bleiben – die Schritte davor rücken so weit nach vorn, dass alles spätestens am PAL endet.', onclick: () => pullBeforePal(x.id) }, 'Alles vor den PAL rücken'),
    h('button', { tip: 'Der Beginn des Bereichs und der PAL bleiben – alle Schritte dazwischen werden anteilig kürzer (feste Dauern bleiben).', onclick: () => squeezeToPal(x.id) }, 'Auf den PAL stauchen'),
    h('button', { onclick: () => { UI.palOverSeen = sig; renderNow(); } }, 'Ausblenden'));
}
function pullBeforePal(mid) {
  let left = 0, moved = 0;
  commit(d => {
    const m = findM(d, mid), pal = dn(m.pal); if (pal == null || !m.plan) return;
    const byId = new Map(m.plan.steps.map(s => [s.id, s]));
    const roots = id => { const out = new Set(), seen = new Set(), st = [id]; while (st.length) { const q = st.pop(); if (seen.has(q)) continue; seen.add(q); const ps = predsOf(byId.get(q)).filter(r => byId.has(r)); if (ps.length) ps.forEach(r => st.push(r)); else out.add(q); } return [...out]; };
    for (let pass = 0; pass < 40; pass++) {
      const over = palOverSteps(m, planCalc(m)); if (!over.length) break;
      const worst = over.reduce((a, b) => b.over > a.over ? b : a), dd = worst.over;
      let any = false;
      for (const rid of roots(worst.id)) {
        const s = byId.get(rid), a = s.anker || {}; if (s.pal) continue;
        if (a.art === 'pal') { a.offset = (+a.offset || 0) - dd; any = true; }
        else if (a.art === 'fest' && dn(a.datum) != null) { a.datum = ds(dn(a.datum) - dd); any = true; }
      }
      if (!any) break;
      moved++;
    }
    left = palOverSteps(m, planCalc(m)).length;
  }, 'Vor den PAL gerückt – der PAL bleibt');
  if (left) toast(left === 1 ? 'Ein Schritt liegt weiter nach dem PAL – er hängt an keinem verschiebbaren Bezug.' : left + ' Schritte liegen weiter nach dem PAL – sie hängen an keinem verschiebbaren Bezug.', 'warn');
}

// Strg gedrückt: die Punkte im Gantt treten hervor – sie lassen sich dann anklicken (lösen) oder ziehen (verknüpfen)
document.addEventListener('keydown', e => { if (e.key === 'Control' || e.key === 'Meta') document.body.classList.add('ctrlheld'); });
document.addEventListener('keyup', e => { if (e.key === 'Control' || e.key === 'Meta') document.body.classList.remove('ctrlheld'); });
window.addEventListener('blur', () => document.body.classList.remove('ctrlheld'));

// Auf den PAL stauchen: Beginn des Bereichs und PAL bleiben, die Schritte dazwischen werden anteilig kürzer (feste Dauern bleiben)
function squeezeToPal(mid) {
  let left = 0, part = false, ch = [];
  commit(d => {
    const m = findM(d, mid), pal = dn(m.pal); if (pal == null || !m.plan) return;
    for (const k of [...new Set(palOverSteps(m, planCalc(m)).map(o => o.ber))]) {
      const ph = planCalc(m).ph[k]; if (!ph || ph.end <= pal || ph.start >= pal) continue;
      const res = scaleRange(m, ph.steps, ph.start, ph.end, ph.start, pal); ch = ch.concat(res.changed); part = part || res.partial;
    }
    left = palOverSteps(m, planCalc(m)).length;
  }, 'Auf den PAL gestaucht – Beginn und PAL bleiben');
  if (left || part) toast(left ? (left === 1 ? 'Ein Schritt' : left + ' Schritte') + ' liegen weiter nach dem PAL – feste Dauern oder Mindestdauer 1 Tag lassen nicht mehr zu.' : 'Gestaucht: ' + changedText(ch), left ? 'warn' : '');
}
