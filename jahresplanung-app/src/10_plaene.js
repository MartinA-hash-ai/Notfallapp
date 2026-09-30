/* ===================================================================== Ansicht: Detailpläne (Gantt, Rückwärtsterminierung ab PAL) */

const STEP_TYPES = { gruppe: 'Abschnitt', aufgabe: 'Aufgabe', meilenstein: 'Meilenstein', ziel: 'Ziel' };
const PL_ROW = 32;
const DEF_DAYS = 7;                            // Standarddauer neuer bzw. noch nicht geplanter Schritte

/* ---------- Rechenhilfen am Datenobjekt */
// Schritte, deren Dauer den Beginn des markierten Schritts bestimmt (entlang der Verknüpfungen bis zum PAL)
function influencingChain(p, markId) {
  const byId = new Map(p.steps.map(s => [s.id, s])), out = [], seen = new Set();
  let cur = byId.get(markId);
  if (!cur) return out;
  if (cur.typ === 'aufgabe') out.push(cur);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    const a = cur.anker || {};
    if (a.art !== 'start' && a.art !== 'ende') break;
    const ref = byId.get(a.ref);
    if (!ref) break;
    if (a.art === 'start' && ref.typ === 'aufgabe') out.push(ref);
    cur = ref;
  }
  return out;
}
// Start eines Bereichs auf ein Datum legen: die Dauer des längsten Schritts davor (bis zum PAL) passt sich an,
// Schritte, von denen die Starts der anderen Bereiche abhängen, bleiben möglichst unberührt
function adjustMark(m, which, target) {
  const p = m.plan, pc = planCalc(m), ph = pc.ph[which], mark = ph && ph.mark;
  const r = mark && pc.map.get(mark);
  if (!r || r.start == null || target == null) return null;
  let delta = r.start - target;
  if (!delta) return { changed: [] };
  const theirs = new Set(Object.keys(pc.ph).filter(k => k !== which).flatMap(k => influencingChain(p, pc.ph[k].mark).map(s => s.id)));
  const mine = influencingChain(p, mark);
  let pool = mine.filter(s => !theirs.has(s.id));
  if (!pool.length) pool = mine;
  if (!pool.length) return null;
  pool = pool.slice().sort((a, b) => (+b.dauer || 0) - (+a.dauer || 0));
  const changed = [];
  if (delta > 0) { changed.push([pool[0].name, +pool[0].dauer || 0, (+pool[0].dauer || 0) + delta]); pool[0].dauer = (+pool[0].dauer || 0) + delta; }
  else {
    let rest = -delta;
    for (const s of pool) {
      const take = Math.min(Math.max(0, (+s.dauer || 0) - 1), rest);
      if (!take) continue;
      changed.push([s.name, +s.dauer, +s.dauer - take]); s.dauer = +s.dauer - take; rest -= take;
      if (!rest) break;
    }
    if (rest) return { changed, partial: true };
  }
  return { changed };
}
// Start Selektion/Inhalt einer Maßnahme auf ein Datum legen (Zeitleiste, Kalender): ohne Plan über den Vorlauf,
// mit Detailplan über die Dauer der Schritte davor. Liefert die Meldung für den Hinweis.
function startMovable(x, t) { return !x.m.plan || !!(x.pc && x.pc.ph[t]); }
function moveStartTo(id, t, n) {
  let res = null;
  const x = C.byId.get(id), label = startLabel(t);
  commit(d => {
    const m = findM(d, id); if (!m) return;
    const pal = dn(m.pal);
    if (m.plan) res = adjustMark(m, t, n);
    else if (pal != null) { m.vorlauf = Object.assign({}, m.vorlauf, { [t]: Math.max(0, pal - n) }); res = { changed: [] }; }
  });
  if (!res) return;
  derive();
  const now = C.byId.get(id), got = now ? now.st[t] : n;
  const det = res.changed.length ? ' – Detailplan: ' + res.changed.map(([nm, a, b]) => '„' + nm + '“ ' + a + ' → ' + b + ' Tage').join(', ') : '';
  toast(x.m.name + ': ' + label + ' → ' + fmtW(got) + det + (got !== n ? ' (gewünscht war ' + fmtWS(n) + ' – weiter geht es nicht)' : ''), got !== n ? 'warn' : '');
}
// Start als Werktage vor dem PAL angeben: der späteste Arbeitstag, ab dem noch so viele Werktage bis zum PAL bleiben
function dateForWT(pal, w) { let n = pal, c = 0; while (c < w && pal - n < 3000) { n--; if (isWorkday(n)) c++; } return n; }
// Schritt auf neuen Beginn/Ende setzen (Verknüpfung bleibt, der Versatz wird angepasst)
function setStepSpan(m, sid, ns, ne) {
  const s = m.plan.steps.find(q => q.id === sid);
  if (!s || s.typ === 'gruppe') return;
  if (s.typ !== 'aufgabe') ns = ne;
  const r = planCalc(m).map.get(sid) || {};
  const a = s.anker || { art: 'offen' };
  const pal = dn(m.pal);
  if (a.art === 'fest') s.anker = { art: 'fest', datum: ds(ne) };
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
    t.anker = next ? { art: 'start', ref: next[0].id, offset: 0 } : pal != null ? { art: 'pal', offset: 0 } : { art: 'fest', datum: ds(end) };
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
      h('span', { class: 'np-lab' }, h('b', null, 'PAL'), ' ', demoChip('P'), h('small', null, 'Pflicht')), palIn, h('span'), h('span'),
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
    m.plan = plan;
    m.pal = ds(pal);
    // vom PAL aus rückwärts anpassen (spätester Bereich zuerst), sonst verschiebt ein späterer Bereich die früheren wieder
    if (res.kind !== 'bereiche') for (const k of Object.keys(starts).sort((a, b) => starts[b] - starts[a])) {
      const r = adjustMark(m, k, starts[k]);
      if (r && r.changed.length) info = info.concat(r.changed);
    }
  }, 'Detailplan angelegt');
  if (info.length) toast('Angepasst: ' + info.map(([n, a, b]) => n + ' ' + a + ' → ' + b + ' Tage').join(', '));
  UI.view = 'plaene'; UI.planSel = id; renderNow();
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
function setMarkDate(mid, which, v) {
  const n = dn(v); if (n == null) return;
  let res = null;
  commit(d => { res = adjustMark(findM(d, mid), which, n); });
  if (!res) toast('In diesem Plan gehört noch kein Abschnitt zum Bereich „' + phName(which) + '“ (Bereich am Abschnitt wählen).', 'warn');
  else if (res.changed.length) toast('Angepasst: ' + res.changed.map(([nm, a, b]) => nm + ' ' + a + ' → ' + b + ' Tage').join(', ') + (res.partial ? ' – kürzer geht nicht' : ''), res.partial ? 'warn' : '');
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
    h('label', { class: 'frow' }, h('span', null, 'Person'), h('input', { list: 'dl-personen', value: wer, placeholder: cur.mixed ? 'gemischt' : 'Name', oninput: e => { wer = e.target.value.trim(); } })),
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
  let lostMark = [];
  commit(d => {
    const m = findM(d, mid), p = m.plan, pc = planCalc(m), del = p.steps.find(q => q.id === sid);
    if (!del) return;
    const da = del.anker || { art: 'offen' }, pal = dn(m.pal);
    p.steps = p.steps.filter(q => q.id !== sid);
    // wer am gelöschten Schritt hing, hängt jetzt an dessen Bezugspunkt – die Termine bleiben gleich
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
    h('span', { class: 'info', tip: 'Jeder Schritt hängt an einem Bezugspunkt (PAL oder einem anderen Schritt). Balken im Gantt ziehen verschiebt ihn, die Enden ziehen ändert die Dauer. Mausrad zoomt, gedrückte Maus auf freier Fläche verschiebt die Ansicht. Zeilen am ⋮⋮-Griff hoch/runter ziehen.' }, 'ⓘ')), tabs);
  const x = C.byId.get(UI.planSel);
  if (!x) { put(main, h('div', { class: 'empty' }, 'Noch kein Detailplan vorhanden. Oben eine Maßnahme wählen und „Detailplan anlegen“.')); return; }
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
  const pxd = UI.printing ? Math.max(2, (compact ? 1030 - 250 : 620) / nd) : (UI.planPxd || fitP), W = nd * pxd, X = n => (n - a0) * pxd;

  // Kopf: oben Name und PAL, rechts die Legende; darunter die Starts der Bereiche (und künftige weitere Termine)
  put(main, h('div', { class: 'phead', style: { borderColor: x.color } },
    h('div', { class: 'ph-top' },
      h('h2', { style: { color: inkC(x.color) } }, m.name),
      h('label', { class: 'inl ph-pal' }, demoChip('P'), 'PAL', dateInput(m.pal, 'pl:pal', v => setM(m.id, 'pal', v || null))),
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

  const trows = [], grows = [];
  let grpName = '';
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
      grpName = s.name;
      const coll = !!UI.planColl[m.id + ':' + s.id], [gi, gj] = blocks.get(s.id);
      const inner = p.steps.slice(gi + 1, gj), spans = inner.map(q => pc.map.get(q.id)).filter(q => q && q.start != null), gp = groupPerson(p, s.id);
      trows.push(h('div', { class: 'pl-row grp' + (compact ? ' compact' : ''), dataset: { rid: s.id, flash: 'step:' + s.id } },
        h('div', { class: 'c-grip' }, grip),
        h('div', { class: 'c-name gname' },
          h('button', { class: 'gtog', 'aria-expanded': String(!coll), tip: coll ? 'ausklappen' : 'einklappen', onclick: () => { coll ? delete UI.planColl[m.id + ':' + s.id] : UI.planColl[m.id + ':' + s.id] = 1; saveUI(); renderNow(); } }, coll ? '▸' : '▾'),
          h('input', { value: s.name, 'data-fk': fk('name'), onchange: e => setStep(m.id, s.id, st => { st.name = e.target.value; }) }),
          h('select', { class: 'gber' + (s.bereich ? ' on' : ''), 'data-fk': fk('ber'), tip: 'Bereich dieses Abschnitts – sein Beginn erscheint als Start im Kalender, in der Tabelle und in der Zeitleiste',
            onchange: e => setGroupBereich(m.id, s.id, e.target.value) }, h('option', { value: '' }, '– ohne Bereich'), PH().map(q => h('option', { value: q.key, selected: s.bereich === q.key }, sym(q.key) + ' ' + q.name))),
          compact ? h('span', { class: 'gcount' }, inner.length) : null),
        compact ? null : [
          h('div', { class: 'c-wer', tip: 'Person für den ganzen Abschnitt – gilt für alle Schritte darin' },
            gp.wer ? h('span', { class: 'pbox', style: { background: midtone(barColor(gp.wer)), borderColor: barColor(gp.wer) } }) : null,
            h('input', { value: gp.wer, list: 'dl-personen', placeholder: gp.mixed ? 'gemischt' : '–', 'data-fk': fk('gwer'), onchange: e => setGroupPerson(m.id, s.id, e.target.value.trim()) })),
          h('div', { class: 'c-grest muted small' }, inner.length + (inner.length === 1 ? ' Schritt' : ' Schritte') + (spans.length ? ' · ' + fmtS(Math.min(...spans.map(q => q.start))) + ' – ' + fmtS(Math.max(...spans.map(q => q.end))) : ''))],
        h('div', { class: 'c-acts' }, menuButton('⋯', [['Neue Aufgabe', () => addStep(m.id, s.id)], ['Ganzen Abschnitt zuordnen …', () => groupPersonDialog(m.id, s.id)], ['Neuer Abschnitt', () => addGroup(m.id)], null,
          ['Abschnitt löschen (Schritte bleiben)', () => deleteStep(m.id, s.id)]], 'right'))));
      const g = h('div', { class: 'g-row grp' });
      if (spans.length) {
        const a = Math.min(...spans.map(q => q.start)), b = Math.max(...spans.map(q => q.end));
        g.append(h('div', { class: 'g-sum', style: { left: X(a) + 'px', width: Math.max(3, (b - a) * pxd) + 'px' }, tip: s.name + ': ' + fmtW(a) + ' – ' + fmtW(b) }));
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
    const endInp = dateInput(r.end != null ? ds(r.end) : '', fk('end'), v => { const ne = dn(v); if (ne == null) return; UI.freshStep = null;
      commit(d => { const ns = !isTask ? ne : !fresh && r.start != null && r.end != null && r.start <= ne ? r.start : ne - len; setStepSpan(findM(d, m.id), s.id, ns, ne); }); });
    const markK = Object.keys(pc.ph).find(k => pc.ph[k].mark === s.id), secK = curBereich(p.steps, row.idx);
    const markTag = markK ? demoChip(markK, 'mark') : null;
    if (markTag) setTip(markTag, startLabel(markK) + ' (Beginn des Bereichs)');
    trows.push(h('div', { class: 'pl-row' + (away.length ? ' conflict' : '') + (compact ? ' compact' : ''), dataset: { rid: s.id, flash: 'step:' + s.id } },
      h('div', { class: 'c-grip' }, grip),
      h('div', { class: 'c-name' }, h('input', { value: s.name, title: s.name, 'data-fk': fk('name'), onchange: e => setStep(m.id, s.id, st => { st.name = e.target.value; }) }), markTag),
      compact ? null : [
        h('div', { class: 'c-typ' }, h('select', { 'data-fk': fk('typ'), onchange: e => setStep(m.id, s.id, st => { st.typ = e.target.value; }) }, ['aufgabe', 'meilenstein', 'ziel'].map(k => h('option', { value: k, selected: s.typ === k }, STEP_TYPES[k])))),
        h('div', { class: 'c-wer' }, h('span', { class: 'pbox', style: { background: s.wer ? midtone(barColor(s.wer)) : 'transparent', borderColor: s.wer ? barColor(s.wer) : 'transparent' } }),
          h('input', { value: s.wer || '', list: 'dl-personen', placeholder: '–', 'data-fk': fk('wer'), onchange: e => setStep(m.id, s.id, st => { st.wer = e.target.value.trim(); }) }),
          away.length ? h('span', { class: 'wi warn', tip: s.wer + ' hat Urlaub: ' + away.map(v => fmtS(v.von) + '–' + fmtS(v.bis)).join(', ') }, '⚠') : null),
        h('div', { class: 'c-kom' }, h('input', { value: s.kommentar || '', title: s.kommentar || '', placeholder: '–', 'data-fk': fk('kom'), onchange: e => setStep(m.id, s.id, st => { st.kommentar = e.target.value; }) })),
        h('div', { class: 'c-dur' }, isTask ? h('input', { type: 'number', min: 0, max: MAX_DAUER, value: s.dauer ?? 0, 'data-fk': fk('dur'), tip: 'Dauer in Tagen', onchange: e => { const v = Math.round(+e.target.value || 0); if (v > MAX_DAUER) toast('Höchstens ' + MAX_DAUER + ' Tage – auf ' + MAX_DAUER + ' gesetzt.', 'warn'); setStep(m.id, s.id, st => { st.dauer = clamp(v, 0, MAX_DAUER); }); } }) : null),
        h('div', { class: 'c-date' + (r.err ? ' err' : ''), tip: r.err || null }, r.err ? '⚠ ' + r.err : startInp),
        h('div', { class: 'c-date' }, r.err ? '' : endInp)],
      h('div', { class: 'c-acts' }, menuButton('⋯', [['Neue Aufgabe darunter', () => addStep(m.id, curGroupOf(p.steps, row.idx), s.id)],
        secK ? ['Als Beginn von „' + phName(secK) + '“ festlegen', () => commit(d => { const pl = findM(d, m.id).plan; pl.marks = Object.assign({}, pl.marks, { [secK]: s.id }); }, s.name + ' = ' + startLabel(secK))] : false,
        secK && p.marks && p.marks[secK] ? ['Beginn von „' + phName(secK) + '“ automatisch (frühester Schritt)', () => commit(d => { const pl = findM(d, m.id).plan; pl.marks = Object.assign({}, pl.marks); delete pl.marks[secK]; })] : false, null,
        ['Löschen', () => deleteStep(m.id, s.id)]], 'right'))));
    // Gantt-Zeile
    const g = h('div', { class: 'g-row' });
    if (s.wer) for (const v of C.vac.filter(v => v.u.wer === s.wer && v.bis >= a0 && v.von <= a1))
      g.append(h('div', { class: 'g-vac', style: { left: X(Math.max(v.von, a0)) + 'px', width: (Math.min(v.bis, a1) - Math.max(v.von, a0) + 1) * pxd + 'px' }, tip: s.wer + ': Urlaub ' + fmtS(v.von) + '–' + fmtS(v.bis) }));
    if (r.start != null) {
      const gname = grpName;
      const tip = () => h('div', null, h('b', null, s.name), gname ? h('span', { class: 'muted' }, ' (' + gname + ')') : null,
        h('div', null, isTask ? fmtW(r.start) + ' – ' + fmtW(r.end) + ' · ' + s.dauer + ' Tage' : STEP_TYPES[s.typ] + ': ' + fmtW(r.end)),
        s.wer ? h('div', null, 'Zugeordnet: ' + s.wer) : null, s.kommentar ? h('div', { class: 'muted' }, s.kommentar) : null,
        away.length ? h('div', { class: 'warn' }, '⚠ ' + s.wer + ' hat in dieser Zeit Urlaub') : null,
        h('div', { class: 'tt-foot' }, isTask ? 'Ziehen = verschieben · Enden ziehen = Dauer ändern' : 'Ziehen = verschieben'));
      const ctx = { x, s, r, pxd, X };
      if (isTask) {
        const c = barColor(s.wer);
        const bar = h('div', { class: 'g-bar' + (away.length ? ' conflict' : ''), tip, style: { left: X(r.start) + 'px', width: Math.max(3, (r.end - r.start) * pxd) + 'px', background: midtone(c), borderColor: c } },
          (r.end - r.start) * pxd > 70 ? h('span', { class: 'lbl' }, s.name) : null,
          h('span', { class: 'grip gl', onpointerdown: e => barDrag(e, ctx, 'left') }), h('span', { class: 'grip gr', onpointerdown: e => barDrag(e, ctx, 'right') }));
        bar.addEventListener('pointerdown', e => { if (!e.target.classList.contains('grip')) barDrag(e, ctx, 'move'); });
        ctx.el = bar;
        g.append(bar);
      } else {
        const dia = h('div', { class: 'g-dia' + (s.typ === 'ziel' ? ' ziel' : ''), tip, style: { left: X(r.end) + pxd / 2 + 'px', background: s.typ === 'ziel' ? '#E30714' : x.color }, onpointerdown: e => barDrag(e, ctx, 'move') });
        ctx.el = dia;
        g.append(dia);
      }
    }
    grows.push(g);
  }
  const thead = h('div', { class: 'pl-row head' + (compact ? ' compact' : '') }, h('div', { class: 'c-grip' }), h('div', { class: 'c-name' }, 'Arbeitsschritt'),
    compact ? null : [h('div', { class: 'c-typ' }, 'Typ'), h('div', { class: 'c-wer' }, 'Zugeordnet'), h('div', { class: 'c-kom' }, 'Kommentar'), h('div', { class: 'c-dur' }, 'Dauer'),
      h('div', { class: 'c-date' }, 'Beginn'), h('div', { class: 'c-date' }, 'Ende')], h('div', { class: 'c-acts' }));
  const gantt = h('div', { class: 'pl-gantt', 'data-keep-scroll': 'plg' }, h('div', { style: { width: W + 'px' } }, ghead, h('div', { class: 'g-body' }, gbg, grows)));
  tlPan(gantt);
  planWheel(gantt, a0, fitP);
  UI._pl = { a0, pxd };
  put(main, personList(), h('div', { class: 'pl-split' + (compact ? ' compact' : '') },
    h('div', { class: 'pl-table' }, thead, trows,
      h('div', { class: 'pl-row addrow' + (compact ? ' compact' : '') }, h('div', { class: 'c-add' }, h('button', { class: 'addlink', onclick: () => addGroup(m.id) }, '+ Abschnitt')))),
    h('div', { class: 'pl-divider' }, h('button', { class: 'divbtn', tip: compact ? 'alle Spalten zeigen' : 'nur Arbeitsschritte zeigen – mehr Platz für das Gantt', 'aria-label': 'Tabelle ein-/ausklappen',
      onclick: () => { UI.planCompact = !compact; UI.planPxd = 0; saveUI(); renderNow(); } }, compact ? '›' : '‹')),
    gantt));
};
function curGroupOf(steps, idx) { for (let i = idx; i >= 0; i--) if (steps[i].typ === 'gruppe') return steps[i].id; return null; }
function curBereich(steps, idx) { for (let i = idx; i >= 0; i--) if (steps[i].typ === 'gruppe') return steps[i].bereich || null; return null; }
VIEW_FN['plaene:after'] = () => {
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

/* ---------- Balken ziehen: verschieben oder Dauer ändern */
function barDrag(ev, ctx, mode) {
  if (ev.button !== 0) return;
  ev.preventDefault(); ev.stopPropagation(); hideTip();
  const { x, s, r, pxd, X, el } = ctx, sx = ev.clientX;
  document.body.classList.add('dragging');
  const lab = h('div', { class: 'drag-lab' }); document.body.append(lab);
  let ns = r.start, ne = r.end, moved = false;
  const isTask = s.typ === 'aufgabe';
  const move = e => {
    const dd = Math.round((e.clientX - sx) / pxd);
    if (dd) moved = true;
    if (mode === 'move') { ns = r.start + dd; ne = r.end + dd; }
    else if (mode === 'left') { ns = Math.min(r.start + dd, r.end); ne = r.end; }
    else { ns = r.start; ne = Math.max(r.end + dd, r.start); }
    if (isTask) { el.style.left = X(ns) + 'px'; el.style.width = Math.max(3, (ne - ns) * pxd) + 'px'; }
    else el.style.left = X(ne) + pxd / 2 + 'px';
    const w = s.wer ? C.vac.filter(v => v.u.wer === s.wer && v.von <= ne && v.bis >= ns).map(v => s.wer + ' Urlaub ' + fmtS(v.von) + '–' + fmtS(v.bis)) : [];
    setKids(lab, h('b', null, s.name), h('div', null, isTask ? fmtW(ns) + ' – ' + fmtW(ne) + ' (' + (ne - ns) + ' Tage)' : fmtW(ne)), w.length ? h('div', { class: 'warn' }, '⚠ ' + w.join(' · ')) : null);
    placeLab(lab, e.clientX, e.clientY);
  };
  const end = okay => {
    document.body.classList.remove('dragging'); lab.remove();
    if (!okay) {                                  // abgebrochen: Balken zurück
      if (isTask) { el.style.left = X(r.start) + 'px'; el.style.width = Math.max(3, (r.end - r.start) * pxd) + 'px'; } else el.style.left = X(r.end) + pxd / 2 + 'px';
      return;
    }
    if (!moved || (ns === r.start && ne === r.end)) return;
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
