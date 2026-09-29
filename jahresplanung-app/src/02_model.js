/* ===================================================================== Datenmodell, Berechnungen, Warnungen, Rückgängig */

const DATA_VERSION = 1;
let D = null;                    // alle gespeicherten Daten (landen beim Speichern in der Datei)
let SAVED_JSON = '';             // Stand der Datei (zum Erkennen ungespeicherter Änderungen)
const UNDO = [], REDO = [];

// Ansichtseinstellungen je Person/Browser (werden nicht in die Datei geschrieben)
const UI = {
  view: 'jahr', year: null, secOpen: {}, show: { S: true, I: true, P: true }, hiddenM: new Set(), hiddenP: new Set(),
  showVac: true, monthLists: true, tlPxd: 0, tlPlans: false, agendaWeeks: 4, agendaFrom: null, planSel: null,
  planPxd: 0, planColl: {}, theme: 'light', warnOpen: false, allYears: false, sidebar: true, userName: '',
};
const UI_KEYS = ['colW', 'planCompact', 'autoSave', 'view', 'show', 'showVac', 'monthLists', 'tlPlans', 'agendaWeeks', 'planPxd', 'userName', 'secOpen', 'planColl', 'theme', 'pdfOpts', 'icsOpts', 'splash', 'verbund', 'copiesSeen'];
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

function emptyData() {
  return { version: DATA_VERSION, meta: { savedAt: null, savedBy: '' }, settings: { year: new Date().getFullYear() + 1, maxStarts: 2, vorlaufS: 76, vorlaufI: 58 },
    personen: [], massnahmen: [], urlaube: [], sondertage: [] };
}
// Daten aus Datei, Import oder Entwurf in eine sichere Form bringen: kaputte Einträge weglassen, Texte als Text
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const str = v => typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
const dateStr = v => typeof v === 'string' && v ? v : null;
function normalize(d) {
  const e = emptyData();
  d = Object.assign(e, isObj(d) ? d : {});
  d.meta = Object.assign({ savedAt: null, savedBy: '' }, isObj(d.meta) ? d.meta : {});
  d.settings = Object.assign(emptyData().settings, isObj(d.settings) ? d.settings : {});
  ['personen', 'massnahmen', 'urlaube', 'sondertage'].forEach(k => { d[k] = Array.isArray(d[k]) ? d[k].filter(isObj) : []; });
  if (!isObj(d.feiertage)) d.feiertage = {};
  d.personen = d.personen.filter(p => str(p.name).trim());
  d.personen.forEach(p => { p.name = str(p.name).trim(); if (typeof p.farbe !== 'string') p.farbe = '#888888'; });
  const ids = new Set(), freshId = v => { let id = str(v); if (!id || ids.has(id)) id = uid(); ids.add(id); return id; };
  d.massnahmen.forEach(m => {
    m.id = freshId(m.id); m.name = str(m.name); m.farbe = typeof m.farbe === 'string' && m.farbe ? m.farbe : '#7F7F7F';
    m.verantwortlich = str(m.verantwortlich); m.hinweis = str(m.hinweis); m.pal = dateStr(m.pal);
    if (!('palStatus' in m)) m.palStatus = 'vorläufig';
    if (m.plan != null && !isObj(m.plan)) m.plan = null;
    if (m.plan) {
      m.plan.steps = Array.isArray(m.plan.steps) ? m.plan.steps.filter(isObj) : [];
      const sids = new Set();
      m.plan.steps.forEach(s => {
        s.id = str(s.id) && !sids.has(str(s.id)) ? str(s.id) : uid(); sids.add(s.id);
        s.name = str(s.name); s.wer = str(s.wer); s.kommentar = str(s.kommentar);
        if (!['gruppe', 'aufgabe', 'meilenstein', 'ziel'].includes(s.typ)) s.typ = 'aufgabe';
        if (!isObj(s.anker)) s.anker = { art: 'offen' };
      });
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
  const g = id => (id && res.get(id)) ? res.get(id).start : null;
  return { map: res, s: g(m.plan && m.plan.markS), i: g(m.plan && m.plan.markI) };
}

/* ---------- Alles Abgeleitete für eine Darstellung */
let C = null;
function derive() {
  _holYear = new Map();
  const ms = D.massnahmen.map(m => {
    const pal = dn(m.pal);
    let s = null, i = null, pc = null;
    if (m.plan) { pc = planCalc(m); s = pc.s; i = pc.i; }
    else if (pal != null) {
      if (isNum(m.vorlaufS)) s = pal - Math.round(+m.vorlaufS);
      if (isNum(m.vorlaufI)) i = pal - Math.round(+m.vorlaufI);
    }
    return { m, id: m.id, pal, s, i, pc, color: m.farbe || '#7F7F7F', vS: pal != null && s != null ? pal - s : null, vI: pal != null && i != null ? pal - i : null };
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
const TYPES = [['S', 's', 'Start Selektion'], ['I', 'i', 'Start inhaltliche Arbeit'], ['P', 'pal', 'PAL']];
const TYPE_LABEL = { S: 'Start Selektion', I: 'Start inhaltliche Arbeit', P: 'PAL (Briefkasten)' };

// Termine (S/I/P) eines Zeitraums, gefiltert nach Anzeige
function eventsIn(a, b, all = false) {
  const out = [];
  for (const x of C.ms) {
    if (!all && !visibleM(x)) continue;
    for (const [t, k] of TYPES) {
      if (!all && !UI.show[t]) continue;
      const n = x[k];
      if (n != null && n >= a && n <= b) out.push({ n, t, x });
    }
  }
  return out.sort((p, q) => p.n - q.n || 'SIP'.indexOf(p.t) - 'SIP'.indexOf(q.t));
}
const inYear = (x, y) => [x.s, x.i, x.pal].some(n => n != null && ymd(n)[0] === y);

/* ---------- Warnungen */
function computeWarnings() {
  const W = [], y = UI.year, today = todayDn();
  const relevant = C.ms.filter(x => inYear(x, y) || x.pal == null);
  for (const x of relevant) {
    const nm = x.m.name || '(ohne Namen)';
    if (x.pal == null) { W.push(x.m.pal ? { lvl: 'warn', mid: x.id, text: `${nm}: PAL „${x.m.pal}“ ist kein gültiges Datum – bitte prüfen` } : { lvl: 'info', mid: x.id, text: nm + ': kein PAL eingetragen' }); continue; }
    const chk = (n, lab, isPal) => {
      if (n == null) return;
      const w = wd(n), hn = holName(n);
      const t = isPal ? 'P' : lab === 'Start Selektion' ? 'S' : 'I';
      const planLocked = !isPal && x.m.plan && (t === 'S' ? !x.m.plan.markS : !x.m.plan.markI);
      const fix = planLocked ? null : { t, to: isPal ? prevPalDay(n) : prevWorkday(n) };
      if (hn) W.push({ lvl: 'warn', mid: x.id, n, fix, text: `${nm}: ${lab} fällt auf den Feiertag „${hn}“ (${fmtW(n)})` });
      else if ((!isPal && w >= 5) || (isPal && w === 6)) W.push({ lvl: 'warn', mid: x.id, n, fix, text: `${nm}: ${lab} fällt auf einen ${WDL[w]} (${fmtD(n)})` });
      const resp = (x.m.verantwortlich || '').trim();
      const away = vacOn(n).filter(v => !resp || v.u.wer === resp);
      if (away.length && !isPal) W.push({ lvl: resp ? 'warn' : 'info', mid: x.id, n,
        text: `${nm}: ${lab} am ${fmtW(n)} – im Urlaub: ${[...new Set(away.map(v => v.u.wer || '?'))].join(', ')}` });
    };
    chk(x.s, 'Start Selektion'); chk(x.i, 'Start inhaltliche Arbeit'); chk(x.pal, 'PAL', true);
    for (const [n, lab] of [[x.s, 'Start Selektion'], [x.i, 'Start inhaltliche Arbeit']]) {
      if (n == null) continue;
      if (n > x.pal) W.push({ lvl: 'warn', mid: x.id, n, text: `${nm}: ${lab} (${fmtD(n)}) liegt nach dem PAL (${fmtD(x.pal)}) – Datum prüfen` });
      else if (x.pal - n > FAR) W.push({ lvl: 'warn', mid: x.id, n, text: `${nm}: ${lab} (${fmtD(n)}) liegt mehr als drei Jahre vor dem PAL – Datum prüfen` });
    }
    if (x.s != null && x.i != null && x.s > x.i) W.push({ lvl: 'info', mid: x.id, text: `${nm}: Start inhaltliche Arbeit liegt vor Start Selektion` });
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
function changed() { saveDraft(); scheduleAutosave(); requestRender(); }
const isDirty = () => JSON.stringify(D) !== SAVED_JSON;
const findM = (d, id) => d.massnahmen.find(m => m.id === id);
