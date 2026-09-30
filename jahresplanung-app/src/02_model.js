/* ===================================================================== Datenmodell, Berechnungen, Warnungen, Rückgängig */

const DATA_VERSION = 2;                 // 2: Bereiche (Selektion, Inhalt, Produktion …) statt fester Starts S/I
let D = null;                    // alle gespeicherten Daten (landen beim Speichern in der Datei)
let SAVED_JSON = '';             // Stand der Datei (zum Erkennen ungespeicherter Änderungen)
const UNDO = [], REDO = [];
const LOG_MAX = 400;                     // so viele Einträge behält das Änderungsprotokoll
let LAST_EDIT = null;                    // Zeitpunkt der letzten eigenen Änderung (für die Anwesenheitsanzeige)

// Ansichtseinstellungen je Person/Browser (werden nicht in die Datei geschrieben)
const UI = {
  view: 'jahr', year: null, secOpen: {}, show: { S: true, I: true, P: true }, hiddenM: new Set(), hiddenP: new Set(),
  showVac: true, monthLists: true, tlPxd: 0, tlPlans: false, agendaWeeks: 4, agendaFrom: null, planSel: null,
  planPxd: 0, planColl: {}, theme: 'light', warnOpen: false, allYears: false, sidebar: true, userName: '',
};
const UI_KEYS = ['colW', 'planCompact', 'autoSave', 'view', 'show', 'showVac', 'monthLists', 'tlPlans', 'agendaWeeks', 'planPxd', 'userName', 'secOpen', 'planColl', 'theme', 'pdfOpts', 'icsOpts', 'splash', 'verbund', 'copiesSeen', 'checkSeen', 'startView'];
function loadUI() {
  try {
    const s = JSON.parse(localStorage.getItem('jp-ui') || '{}');
    UI_KEYS.forEach(k => { if (k in s) UI[k] = s[k]; });
    if (s.hiddenM) UI.hiddenM = new Set(s.hiddenM);
    if (s.hiddenP) UI.hiddenP = new Set(s.hiddenP);
  } catch (e) { /* ohne Speicher weiter */ }
}
function saveUI() {
  try {
    const s = {}; UI_KEYS.forEach(k => { s[k] = UI[k]; });
    s.hiddenM = [...UI.hiddenM]; s.hiddenP = [...UI.hiddenP];
    localStorage.setItem('jp-ui', JSON.stringify(s));
  } catch (e) { /* egal */ }
}

/* ---------- Bereiche einer Maßnahme (Phasen bis zum PAL): eine Liste für alle, Reihenfolge = zeitliche Abfolge.
   Jeder Bereich hat einen Buchstaben (P ist für das PAL reserviert) und einen Start – ohne eigenes Ende läuft er bis zum nächsten Start bzw. bis zum PAL. */
const DEF_BEREICHE = [{ key: 'S', name: 'Selektion', vorlauf: 76 }, { key: 'I', name: 'Inhalt', vorlauf: 58 }, { key: 'D', name: 'Produktion', vorlauf: 21 }];
const PH = () => (D && D.settings && Array.isArray(D.settings.bereiche)) ? D.settings.bereiche : DEF_BEREICHE;
const phase = k => PH().find(p => p.key === k);
const phName = k => k === 'P' ? 'PAL' : (phase(k) || { name: k }).name;
const startLabel = k => k === 'P' ? 'PAL' : 'Start ' + phName(k);
const evKeys = () => [...PH().map(p => p.key), 'P'];                 // alle Terminarten in zeitlicher Reihenfolge
const evDate = (x, t) => t === 'P' ? x.pal : (x.st[t] ?? null);
const PHASE_KEY_RE = /^[A-OQ-Z]$/;                                  // interner Schlüssel: ein Großbuchstabe, nicht P
// Markierungen: angezeigtes Zeichen und Aussehen je Bereich und für das PAL (Einstellungen). Intern bleiben die Schlüssel gleich.
const STILE = { pastell: 'Pastell', kraeftig: 'Kräftig', streifen: 'Gestreift', rahmen: 'Nur Rahmen' };
const DEF_PAL = { zeichen: 'P', stil: 'kraeftig' };
const SYM_RE = /^[A-Z0-9ÄÖÜ]$/;
const palMark = () => (D && D.settings && isObj(D.settings.pal)) ? D.settings.pal : DEF_PAL;
const sym = k => k === 'P' ? palMark().zeichen || 'P' : ((phase(k) || {}).zeichen || k);
const stilOf = k => k === 'P' ? palMark().stil || 'kraeftig' : ((phase(k) || {}).stil || 'pastell');
// Linie je Bereich (Kalender-Verbindungslinie, Zeitleiste, Detailplan-Gantt): „abgestuft“ = wie bisher, von hell nach kräftig
const LINIEN = Object.assign({ auto: 'Abgestuft (Standard)' }, STILE);
const lineOf = k => k === 'P' ? 'auto' : ((phase(k) || {}).linie || 'auto');
// Hintergrund einer Linie/eines Balkens als Bild (für background) – f: Abstufung bei „abgestuft“ (1 = hellste, 0 = volle Farbe)
function lineBg(k, c, f = 0) {
  const st = lineOf(k), dk = darkNow(), solid = v => 'linear-gradient(' + v + ', ' + v + ')';
  if (st === 'kraeftig') return solid(c);
  if (st === 'pastell') return solid(pastel(c));
  if (st === 'streifen') return 'repeating-linear-gradient(135deg, ' + c + ' 0 2px, ' + pastel(c) + ' 2px 4px)';
  if (st === 'rahmen') return 'linear-gradient(' + c + ' 0 1px, transparent 1px calc(100% - 1px), ' + c + ' calc(100% - 1px))';
  return solid(f <= 0 ? c : dk ? mix(c, 0.5 * f, DARK_SURF) : mix(c, 0.62 * f));
}
const demoChip = (k, cls) => h('span', { class: 'chip demo ' + (k === 'P' ? 'P' : 'ph') + ' st-' + stilOf(k) + (cls ? ' ' + cls : '') }, sym(k));
function emptyData() {
  return { version: DATA_VERSION, meta: { savedAt: null, savedBy: '' }, settings: { year: new Date().getFullYear() + 1, bereiche: JSON.parse(JSON.stringify(DEF_BEREICHE)) },
    personen: [], massnahmen: [], urlaube: [], sondertage: [], log: [] };
}
// Detailplan aus Version ≤ 0.7 (markierte Schritte S/I) auf Abschnitte mit Bereich umstellen; „Mailing“ wird in Inhalt und Produktion geteilt
// Der Briefkasten-Termin (PAL) steht immer in einem eigenen Abschnitt – dort, wo er bisher im Plan stand (meist nach der Produktion).
// Er hängt fest am PAL (Ziel, Abstand 0) und lässt sich nicht löschen. Feste Kennungen, damit gleichzeitiges Umstellen nicht kollidiert.
const isPalStep = s => !!s && s.typ !== 'gruppe' && s.pal === true;
function ensurePalGroup(plan) {
  const st = plan.steps;
  let pi = st.findIndex(isPalStep);
  if (pi < 0) pi = st.findIndex(s => s.typ === 'ziel' && isObj(s.anker) && s.anker.art === 'pal' && !(+s.anker.offset));
  if (pi < 0) { st.push({ id: 'pal-' + (st.length ? st[0].id : 'x'), typ: 'ziel', name: 'Briefkasten-Termin', dauer: 0, fortschritt: 0, wer: '', kommentar: '', anker: { art: 'pal', offset: 0 } }); pi = st.length - 1; }
  const ps = st[pi];
  Object.assign(ps, { typ: 'ziel', pal: true, anker: { art: 'pal', offset: 0 } }); delete ps.bereich;
  st.forEach((q, i) => { if (i !== pi && q.typ !== 'gruppe') delete q.pal; });
  const groups = st.map((q, i) => [q, i]).filter(([q]) => q.typ === 'gruppe' && q.pal);
  groups.slice(1).forEach(([q]) => { delete q.pal; });
  let gi = groups.length ? groups[0][1] : -1;
  if (gi >= 0 && pi === gi + 1) return plan;
  st.splice(pi, 1);
  if (gi >= 0) { gi = st.findIndex(q => q.typ === 'gruppe' && q.pal); st.splice(gi + 1, 0, ps); return plan; }
  let j = pi; while (j < st.length && st[j].typ !== 'gruppe') j++;             // Ende des Abschnitts, in dem er stand
  st.splice(j, 0, { id: 'g-pal-' + ps.id, typ: 'gruppe', name: 'Briefkasten-Termin (PAL)', pal: true, wer: '', kommentar: '', anker: { art: 'offen' } }, ps);   // vollständig, damit erneutes Prüfen nichts ändert
  return plan;
}
function migratePlan(plan, keys) {
  if (!plan || (plan.markS === undefined && plan.markI === undefined)) return plan;
  const steps = plan.steps, idx = id => steps.findIndex(s => s.id === id);
  const groupOf = i => { for (let j = i; j >= 0; j--) if (steps[j].typ === 'gruppe') return j; return -1; };
  const marks = [['S', plan.markS], ['I', plan.markI]].filter(([k, id]) => keys.includes(k) && id && idx(id) >= 0).sort((a, b) => idx(a[1]) - idx(b[1]));
  const names = { S: 'Selektion', I: 'Inhalt', D: 'Produktion' };
  plan.marks = {};
  for (const [k, id] of marks) {
    let i = idx(id), g = groupOf(i);
    if (g < 0 || steps[g].bereich) { steps.splice(i, 0, { id: 'g-' + k + '-' + id, typ: 'gruppe', name: names[k] || k }); g = i; }
    steps[g].bereich = k;
    if (k === 'I' && /^mailing$/i.test(steps[g].name)) steps[g].name = 'Inhalt';
    plan.marks[k] = id;
  }
  const gi = steps.findIndex(s => s.typ === 'gruppe' && s.bereich === 'I');
  if (gi >= 0 && keys.includes('D') && !steps.some(s => s.bereich === 'D')) {
    let j = gi + 1;
    while (j < steps.length && steps[j].typ !== 'gruppe' && !/übergabe an (den )?lettershop/i.test(steps[j].name)) j++;
    if (j < steps.length && steps[j].typ !== 'gruppe') { plan.marks.D = steps[j].id; steps.splice(j, 0, { id: 'g-D-' + steps[j].id, typ: 'gruppe', name: 'Produktion', bereich: 'D' }); }   // Produktion beginnt mit der Übergabe an den Lettershop
  }
  delete plan.markS; delete plan.markI;
  return plan;
}
function normBereiche(list, st) {
  const seen = new Set(), out = [];
  if (!Array.isArray(list)) list = DEF_BEREICHE.map(p => Object.assign({}, p, { vorlauf: p.key === 'S' && isNum(st.vorlaufS) ? +st.vorlaufS : p.key === 'I' && isNum(st.vorlaufI) ? +st.vorlaufI : p.vorlauf }));
  for (const p of list) {
    if (!isObj(p)) continue;
    const key = str(p.key).trim().toUpperCase();
    if (!PHASE_KEY_RE.test(key) || seen.has(key)) continue;
    seen.add(key); out.push({ key, name: str(p.name).trim() || key, vorlauf: isNum(p.vorlauf) ? Math.round(+p.vorlauf) : null, zeichen: str(p.zeichen).trim().toUpperCase(), stil: STILE[p.stil] ? p.stil : 'pastell', linie: LINIEN[p.linie] ? p.linie : 'auto' });
  }
  return out;
}
// Zeichen eindeutig halten (PAL zuerst): ungültig oder doppelt → eigener Schlüssel, sonst der nächste freie Buchstabe
function normMarks(st) {
  const pal = isObj(st.pal) ? st.pal : {};
  st.pal = { zeichen: SYM_RE.test(str(pal.zeichen).toUpperCase()) ? str(pal.zeichen).toUpperCase() : 'P', stil: STILE[pal.stil] ? pal.stil : 'kraeftig' };
  const used = new Set([st.pal.zeichen]);
  for (const b of st.bereiche) {
    let z = b.zeichen;
    if (!SYM_RE.test(z) || used.has(z)) z = !used.has(b.key) ? b.key : [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find(c => !used.has(c)) || b.key;
    b.zeichen = z; used.add(z);
  }
}
// Daten aus Datei, Import oder Entwurf in eine sichere Form bringen: kaputte Einträge weglassen, Texte als Text
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const str = v => typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
const dateStr = v => typeof v === 'string' && v ? v : null;
function normalize(d) {
  const e = emptyData();
  d = Object.assign(e, isObj(d) ? d : {});
  d.meta = Object.assign({ savedAt: null, savedBy: '' }, isObj(d.meta) ? d.meta : {});
  d.settings = Object.assign({ year: new Date().getFullYear() + 1 }, isObj(d.settings) ? d.settings : {});
  d.settings.bereiche = normBereiche(d.settings.bereiche, d.settings);
  normMarks(d.settings);
  delete d.settings.vorlaufS; delete d.settings.vorlaufI;
  const keys = d.settings.bereiche.map(p => p.key);
  d.log = Array.isArray(d.log) ? d.log.filter(isObj).slice(-LOG_MAX) : [];
  ['personen', 'massnahmen', 'urlaube', 'sondertage'].forEach(k => { d[k] = Array.isArray(d[k]) ? d[k].filter(isObj) : []; });
  if (!isObj(d.feiertage)) d.feiertage = {};
  d.personen = d.personen.filter(p => str(p.name).trim());
  d.personen.forEach(p => { p.name = str(p.name).trim(); if (typeof p.farbe !== 'string') p.farbe = '#888888'; });
  const ids = new Set(), freshId = v => { let id = str(v); if (!id || ids.has(id)) id = uid(); ids.add(id); return id; };
  d.massnahmen.forEach(m => {
    m.id = freshId(m.id); m.name = str(m.name); m.farbe = typeof m.farbe === 'string' && m.farbe ? m.farbe : '#7F7F7F';
    m.verantwortlich = str(m.verantwortlich); m.hinweis = str(m.hinweis); m.pal = dateStr(m.pal);
    if (!('palStatus' in m)) m.palStatus = 'vorläufig';
    // Starts (und optionale Enden) der Bereiche: Kalendertage vor dem PAL
    m.vorlauf = isObj(m.vorlauf) ? m.vorlauf : {};
    if (isNum(m.vorlaufS) && !isNum(m.vorlauf.S)) m.vorlauf.S = +m.vorlaufS;
    if (isNum(m.vorlaufI) && !isNum(m.vorlauf.I)) m.vorlauf.I = +m.vorlaufI;
    delete m.vorlaufS; delete m.vorlaufI;
    m.ende = isObj(m.ende) ? m.ende : {};
    for (const o of [m.vorlauf, m.ende]) for (const k of Object.keys(o)) if (!isNum(o[k])) delete o[k]; else o[k] = Math.round(+o[k]);
    if (m.plan != null && !isObj(m.plan)) m.plan = null;
    if (m.plan) {
      m.plan.steps = Array.isArray(m.plan.steps) ? m.plan.steps.filter(isObj) : [];
      migratePlan(m.plan, keys);                                    // vor der Prüfung der Schritte, damit neue Abschnitte vollständig sind
      const sids = new Set();
      m.plan.steps.forEach(s => {
        s.id = str(s.id) && !sids.has(str(s.id)) ? str(s.id) : uid(); sids.add(s.id);
        s.name = str(s.name); s.wer = str(s.wer); s.kommentar = str(s.kommentar);
        if (!['gruppe', 'aufgabe', 'meilenstein', 'ziel'].includes(s.typ)) s.typ = 'aufgabe';
        if (!isObj(s.anker)) s.anker = { art: 'offen' };
        if (s.typ === 'gruppe') { if (s.bereich && !keys.includes(s.bereich)) delete s.bereich; } else delete s.bereich;
      });
      ensurePalGroup(m.plan);
      m.plan.marks = isObj(m.plan.marks) ? m.plan.marks : {};
      for (const k of Object.keys(m.plan.marks)) if (!keys.includes(k) || !m.plan.steps.some(q => q.id === m.plan.marks[k])) delete m.plan.marks[k];
    }
  });
  d.urlaube.forEach(u => { u.id = freshId(u.id); u.wer = str(u.wer); u.von = dateStr(u.von); u.bis = dateStr(u.bis); });
  d.sondertage.forEach(s => { s.id = freshId(s.id); s.name = str(s.name); s.datum = dateStr(s.datum); });
  d.version = DATA_VERSION;
  return d;
}

/* ---------- Feiertage (NRW, bearbeitbar) inkl. eigener freier Tage */
// D.feiertage: { 'JJJJ-MM-TT' (gesetzliches Datum): { name?, datum?, off? } }
let _holYear = new Map();
function holidays(y) {
  if (_holYear.has(y)) return _holYear.get(y);
  const out = new Map(), ov = (D && D.feiertage) || {};
  for (const [n, t] of holidaysNRW(y)) {
    const o = ov[ds(n)] || {};
    if (o.off) continue;
    out.set(dn(o.datum) ?? n, o.name || t);
  }
  _holYear.set(y, out);
  return out;
}
function holName(n) {
  const y = ymd(n)[0];
  const f = holidays(y).get(n);
  if (f) return f;
  const s = D.sondertage.find(x => dn(x.datum) === n);
  return s ? (s.name || 'freier Tag') : null;
}
const isWorkday = n => wd(n) < 5 && !holName(n);
function prevWorkday(n) { let k = n; while (!isWorkday(k) && n - k < 60) k--; return k; }
// PAL darf auf einen Samstag fallen, aber nicht auf Sonntag oder Feiertag
function prevPalDay(n) { let k = n; while ((wd(k) === 6 || holName(k)) && n - k < 60) k--; return k; }
// Werktage (Mo–Fr ohne Feiertage) von n bis zum Tag vor dem PAL
const workdaysBefore = (n, pal) => n == null || pal == null ? null : n < pal ? workdays(n, pal - 1) : -workdays(pal, n - 1);
function workdays(a, b) { let c = 0; for (let n = a; n <= b; n++) if (isWorkday(n)) c++; return c; }

/* ---------- Personen */
function personColor(name) {
  const p = D.personen.find(x => x.name === name);
  if (p) return p.farbe;
  let hsh = 0; for (const ch of String(name)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSON_COLORS[hsh % PERSON_COLORS.length];
}
function ensurePersons(d) {
  const names = new Set();
  d.urlaube.forEach(u => names.add(str(u.wer).trim()));
  d.massnahmen.forEach(m => { names.add(str(m.verantwortlich).trim()); (m.plan?.steps || []).forEach(s => names.add(str(s.wer).trim())); });
  for (const n of names) if (n && !d.personen.some(p => p.name === n)) {
    const used = new Set(d.personen.map(p => p.farbe));
    d.personen.push({ name: n, farbe: PERSON_COLORS.find(c => !used.has(c)) || PERSON_COLORS[d.personen.length % PERSON_COLORS.length] });
  }
}

/* ---------- Detailplan: Rückwärtsterminierung wie im Excel-Gantt */
const MAX_DAUER = 730;                        // längste Dauer eines Arbeitsschritts in Tagen
const FAR = 1100;                             // Termine mehr als ~3 Jahre vom PAL entfernt: Tippfehler vermuten
function planCalc(m) {
  const pal = dn(m.pal), steps = m.plan ? m.plan.steps : [];
  const byId = new Map(steps.map(s => [s.id, s]));
  const res = new Map(), busy = new Set();
  function calc(s) {
    if (res.has(s.id)) return res.get(s.id);
    if (busy.has(s.id)) return { start: null, end: null, err: 'Zirkelbezug' };
    busy.add(s.id);
    let e = null, err = null;
    const a = s.anker || { art: 'offen' }, off = +a.offset || 0;
    if (s.typ !== 'gruppe') {
      if (a.art === 'pal') e = pal != null ? pal + off : null;
      else if (a.art === 'fest') { e = dn(a.datum); if (e == null && a.datum) err = 'ungültiges Datum „' + a.datum + '“'; }
      else if (a.art === 'start' || a.art === 'ende') {
        const r = byId.get(a.ref);
        if (!r) err = 'Bezug fehlt';
        else { const rc = calc(r); if (rc.err) err = rc.err; const b = a.art === 'start' ? rc.start : rc.end; e = b != null ? b + off : null; }
      }
    }
    const dur = s.typ === 'aufgabe' ? clamp(Math.round(+s.dauer || 0), 0, MAX_DAUER) : 0;
    const out = { start: e != null ? e - dur : null, end: e, err };
    busy.delete(s.id);
    res.set(s.id, out);
    return out;
  }
  steps.forEach(calc);
  // Bereiche: Abschnitte mit Buchstaben; Start = festgelegter Beginn-Schritt oder frühester Schritt, Ende = spätester Schritt
  const ph = {};
  let cur = null;
  for (const s of steps) {
    if (s.typ === 'gruppe') { cur = s.bereich || null; continue; }
    if (!cur) continue;
    const r = res.get(s.id); if (!r || r.start == null) continue;
    const o = ph[cur] || (ph[cur] = { start: r.start, end: r.end, mark: s.id, steps: [] });
    o.steps.push(s.id);
    if (r.start < o.start) { o.start = r.start; o.mark = s.id; }
    if (r.end > o.end) o.end = r.end;
  }
  const marks = (m.plan && m.plan.marks) || {};
  for (const k of Object.keys(ph)) { const mk = marks[k]; if (mk && ph[k].steps.includes(mk)) { ph[k].mark = mk; ph[k].start = res.get(mk).start; } }
  return { map: res, ph };
}

/* ---------- Alles Abgeleitete für eine Darstellung */
let C = null;
// Ende je Bereich: eigenes Ende, sonst der nächste spätere Start, sonst das PAL
function phaseEnds(st, enx, pal) {
  const en = {}, all = Object.values(st);
  for (const k of Object.keys(st)) {
    if (enx[k] != null) { en[k] = enx[k]; continue; }
    const nx = all.filter(v => v > st[k]);
    en[k] = nx.length ? Math.min(...nx) : pal != null ? Math.max(pal, st[k]) : st[k];
  }
  return en;
}
function derive() {
  _holYear = new Map();
  const keys = PH().map(p => p.key);
  const ms = D.massnahmen.map(m => {
    const pal = dn(m.pal), st = {}, enx = {};
    let pc = null;
    if (m.plan) { pc = planCalc(m); for (const k of keys) if (pc.ph[k]) { st[k] = pc.ph[k].start; enx[k] = pc.ph[k].end; } }
    else if (pal != null) for (const k of keys) {
      const v = m.vorlauf && m.vorlauf[k], e = m.ende && m.ende[k];
      if (isNum(v)) { st[k] = pal - v; if (isNum(e)) enx[k] = Math.max(st[k], pal - e); }
    }
    return { m, id: m.id, pal, st, en: phaseEnds(st, enx, pal), enx, pc, color: m.farbe || '#7F7F7F', s: st.S ?? null, i: st.I ?? null };
  });
  ms.sort((a, b) => (a.pal ?? 1e9) - (b.pal ?? 1e9) || a.m.name.localeCompare(b.m.name, 'de'));
  const byId = new Map(ms.map(x => [x.id, x]));
  const vac = D.urlaube.map(u => ({ u, von: dn(u.von), bis: dn(u.bis) || dn(u.von) })).filter(v => v.von != null && v.bis >= v.von)
    .map(v => v.bis - v.von > 400 ? Object.assign(v, { bis: v.von + 400, tooLong: true }) : v);   // Tippfehler im Jahr bremst sonst alle Ansichten
  C = { ms, byId, vac };
  C.warnings = computeWarnings();
  return C;
}
const vacOn = n => C.vac.filter(v => v.von <= n && n <= v.bis);
const visibleM = x => !UI.hiddenM.has(x.id);
// Häkchen „anzeigen“: sind alle angehakt, bleibt nach dem Klick nur diese Maßnahme angehakt; sind alle aus, wird nur diese angehakt;
// sonst wird sie umgeschaltet. Strg+Klick schaltet immer nur diese eine um.
// Wird so die letzte abgewählt, sind wieder alle angehakt. Ist im Kalender gerade eine Maßnahme angeklickt (nur diese ausgewählt),
// gilt diese Auswahl als Ausgangspunkt.
function toggleVisible(id, list, ev) {
  const plain = !(ev && (ev.ctrlKey || ev.metaKey));
  if (UI.pin && list.some(x => x.id === UI.pin)) { const p = UI.pin; list.forEach(x => { if (x.id === p) UI.hiddenM.delete(x.id); else UI.hiddenM.add(x.id); }); unpin(); }
  if (plain && list.length > 1 && list.every(visibleM)) list.forEach(x => { if (x.id === id) UI.hiddenM.delete(x.id); else UI.hiddenM.add(x.id); });
  else if (UI.hiddenM.has(id)) UI.hiddenM.delete(id); else UI.hiddenM.add(id);
  if (!list.some(visibleM)) list.forEach(x => UI.hiddenM.delete(x.id));
}
// Auswahl, wie sie die Häkchen der Maßnahmen-Tabelle zeigen: im Kalender angeklickt = vorübergehend nur diese
const selM = x => UI.pin && UI.view === 'jahr' && C.byId && C.byId.has(UI.pin) ? x.id === UI.pin : visibleM(x);
const TYPE_LABEL = new Proxy({}, { get: (o, t) => t === 'P' ? 'PAL (Briefkasten)' : typeof t === 'string' ? startLabel(t) : undefined });
const showType = t => !UI.show || UI.show[t] !== false;             // neue Bereiche sind automatisch sichtbar

// Termine (S/I/P) eines Zeitraums, gefiltert nach Anzeige
function eventsIn(a, b, all = false) {
  const out = [];
  for (const x of C.ms) {
    if (!all && !visibleM(x)) continue;
    for (const t of evKeys()) {
      if (!all && !showType(t)) continue;
      const n = evDate(x, t);
      if (n != null && n >= a && n <= b) out.push({ n, t, x });
    }
  }
  const ord = evKeys();
  return out.sort((p, q) => p.n - q.n || ord.indexOf(p.t) - ord.indexOf(q.t));
}
const inYear = (x, y) => [...Object.values(x.st), x.pal].some(n => n != null && ymd(n)[0] === y);
// Arbeitsschritte eines Bereichs im Detailplan, deren zugeordnete Person in dieser Zeit Urlaub hat
function phaseVacations(x, k) {
  const ph = x.pc && x.pc.ph[k]; if (!ph) return [];
  const out = [];
  for (const sid of ph.steps) {
    const s = x.m.plan.steps.find(q => q.id === sid), r = x.pc.map.get(sid);
    if (!s || !s.wer || !r || r.start == null) continue;
    for (const v of C.vac) if (v.u.wer === s.wer && v.von <= Math.max(r.end, r.start) && v.bis >= r.start) out.push({ s, v });
  }
  return out;
}

/* ---------- Warnungen */
function computeWarnings() {
  const W = [], y = UI.year, today = todayDn();
  const relevant = C.ms.filter(x => inYear(x, y) || x.pal == null);
  for (const x of relevant) {
    const nm = x.m.name || '(ohne Namen)';
    if (x.pal == null) { W.push(x.m.pal ? { lvl: 'warn', mid: x.id, text: `${nm}: PAL „${x.m.pal}“ ist kein gültiges Datum – bitte prüfen` } : { lvl: 'info', mid: x.id, text: nm + ': kein PAL eingetragen' }); continue; }
    const chk = (n, lab, t) => {
      if (n == null) return;
      const w = wd(n), hn = holName(n), isPal = t === 'P';
      const planLocked = !isPal && x.m.plan && !(x.pc && x.pc.ph[t]);
      const fix = planLocked ? null : { t, to: isPal ? prevPalDay(n) : prevWorkday(n) };
      if (hn) W.push({ lvl: 'warn', mid: x.id, n, fix, text: `${nm}: ${lab} fällt auf den Feiertag „${hn}“ (${fmtW(n)})` });
      else if ((!isPal && w >= 5) || (isPal && w === 6)) W.push({ lvl: 'warn', mid: x.id, n, fix, text: `${nm}: ${lab} fällt auf einen ${WDL[w]} (${fmtD(n)})` });
      const resp = (x.m.verantwortlich || '').trim();
      const away = vacOn(n).filter(v => !resp || v.u.wer === resp);
      if (away.length && !isPal) W.push({ lvl: resp ? 'warn' : 'info', mid: x.id, n,
        text: `${nm}: ${lab} am ${fmtW(n)} – im Urlaub: ${[...new Set(away.map(v => v.u.wer || '?'))].join(', ')}` });
    };
    for (const p of PH()) chk(x.st[p.key], startLabel(p.key), p.key);
    chk(x.pal, 'PAL', 'P');
    for (const p of PH()) {
      const n = x.st[p.key], lab = startLabel(p.key);
      if (n == null) continue;
      if (n > x.pal) W.push({ lvl: 'warn', mid: x.id, n, text: `${nm}: ${lab} (${fmtD(n)}) liegt nach dem PAL (${fmtD(x.pal)}) – Datum prüfen` });
      else if (x.pal - n > FAR) W.push({ lvl: 'warn', mid: x.id, n, text: `${nm}: ${lab} (${fmtD(n)}) liegt mehr als drei Jahre vor dem PAL – Datum prüfen` });
    }
    const def = PH().filter(p => x.st[p.key] != null);
    for (let j = 1; j < def.length; j++) if (x.st[def[j].key] < x.st[def[j - 1].key])
      W.push({ lvl: 'info', mid: x.id, text: `${nm}: ${startLabel(def[j].key)} liegt vor ${startLabel(def[j - 1].key)}` });
    if (x.pc) for (const s of x.m.plan.steps) {
      const r = x.pc.map.get(s.id);
      if (!r) continue;
      if (r.err) W.push({ lvl: 'warn', mid: x.id, step: s.id, text: `${nm} › ${s.name}: ${r.err}` + (/^ungültig/.test(r.err) ? ' – Datum prüfen' : ' in der Verknüpfung') });
      if (r.start == null || s.typ === 'gruppe') continue;
      if (Math.abs(r.start - x.pal) > FAR || Math.abs(r.end - x.pal) > FAR)
        W.push({ lvl: 'warn', mid: x.id, step: s.id, n: r.end, text: `${nm} › ${s.name}: Termin ${fmtD(r.start)} – ${fmtD(r.end)} liegt mehr als drei Jahre vom PAL entfernt – Datum prüfen` });
      if (s.wer) {
        const away = C.vac.filter(v => v.u.wer === s.wer && v.von <= r.end && v.bis >= r.start);
        if (away.length) W.push({ lvl: 'warn', mid: x.id, step: s.id, n: r.start,
          text: `${nm} › ${s.name}: ${s.wer} hat Urlaub (${away.map(v => fmtS(v.von) + '–' + fmtS(v.bis)).join(', ')})` });
      }
      if (r.end < today && (+s.fortschritt || 0) < 100 && s.typ === 'aufgabe')
        W.push({ lvl: 'warn', mid: x.id, step: s.id, n: r.end, text: `${nm} › ${s.name}: überfällig seit ${fmtD(r.end)} (${+s.fortschritt || 0} % erledigt)` });
    }
  }
  for (const u of D.urlaube) if ((u.von && dn(u.von) == null) || (u.bis && dn(u.bis) == null))
    W.push({ lvl: 'warn', text: `Urlaub ${u.wer || '?'}: „${u.von || ''}“ – „${u.bis || ''}“ ist kein gültiges Datum – bitte prüfen` });
  for (const v of C.vac) if (v.tooLong && (ymd(v.von)[0] === y || ymd(v.bis)[0] === y))
    W.push({ lvl: 'warn', n: v.von, text: `Urlaub ${v.u.wer || '?'} ab ${fmtD(v.von)} endet erst am ${fmtD(dn(v.u.bis))} – Datum prüfen` });
  return W;
}

/* ---------- Änderungen, Rückgängig */
function commit(fn, msg) {
  const before = JSON.stringify(D);
  try { fn(D); ensurePersons(D); }
  catch (e) {                                 // Fehler mitten in der Änderung: alles zurück, nichts halb geändert speichern
    console.error(e); D = JSON.parse(before); derive(); requestRender();
    toast('Die Änderung ließ sich nicht ausführen – es wurde nichts verändert. (' + ((e && e.message) || e) + ')', 'err');
    return false;
  }
  const after = JSON.stringify(D);
  if (before === after) return false;
  UNDO.push(before); if (UNDO.length > 100) UNDO.shift();
  REDO.length = 0;
  changed();
  if (msg) toast(msg);
  return true;
}
function undo() {
  if (!UNDO.length) { toast('Nichts rückgängig zu machen'); return; }
  REDO.push(JSON.stringify(D)); D = JSON.parse(UNDO.pop()); changed(); toast('Rückgängig gemacht');
}
function redo() {
  if (!REDO.length) return;
  UNDO.push(JSON.stringify(D)); D = JSON.parse(REDO.pop()); changed(); toast('Wiederhergestellt');
}
function changed() { LAST_EDIT = new Date().toISOString(); saveDraft(); scheduleAutosave(); requestRender(); }
const isDirty = () => JSON.stringify(D) !== SAVED_JSON;
const findM = (d, id) => d.massnahmen.find(m => m.id === id);
