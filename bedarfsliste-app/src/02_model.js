/* ===================================================================== Daten: Bedarfe, Freigabe, Förderplan, Stand und Fristen */

let D = null;                  // alle Daten (wird mit der Programmdatei gespeichert)
let SAVED_JSON = '';           // Stand der Datei (zum Erkennen ungespeicherter Änderungen)
const DIO = 'Diözese';         // Bedarf ohne Gliederung: Ortsführungskreis entfällt
const isDirty = () => !!D && JSON.stringify(D) !== SAVED_JSON;

const GL_LIST = ['Altenbeken', 'Arnsberg-Meschede', 'Bad Laasphe', 'Balve', 'Borchen', 'Brakel', 'Büren', 'Dortmund', 'Geseke', 'Gütersloh', 'Hagen', 'Herne',
  'Herzebrock-Clarholz', 'Höxter', 'Hövelhof', 'Iserlohn-Menden', 'Lage', 'Lennestadt', 'Lippstadt', 'Netphen', 'Olpe', 'Olsberg', 'Paderborn',
  'Rheda-Wiedenbrück', 'Rietberg', 'Siegen', 'Steinheim', 'Warstein', 'Werl-Soest'];
const FACH_LIST = ['Notfallvorsorge', 'Soziales Ehrenamt'];
const PRIO = [['hoch', 'hoch'], ['mittel', 'mittel'], ['niedrig', 'niedrig']];
const PRIO_ORD = { hoch: 0, mittel: 1, niedrig: 2 };

function emptyData() { return { meta: { savedAt: null, rev: 0 }, settings: { kartei: '' }, bedarfe: [] }; }
function blank() {
  return {
    id: uid('b'), titel: '', gliederung: '', zust: [], prio: 'mittel', beschreibung: '', summe: null, summeArt: 'Schätzung', deadline: '', stichwort: '', link: '', pfad: '',
    freigabe: {
      ofk: { st: 'offen', angefragt: '', erledigt: '', notiz: '' }, angebot: { st: 'offen', angefragt: '', erledigt: '', notiz: '' },
      fach: { name: '', st: 'offen', angefragt: '', erledigt: '', notiz: '' }, verw: { st: 'offen', angefragt: '', erledigt: '', notiz: '' }, trotzdem: false,
    },
    unterlagen: [UL('Konzept', 'fehlt', true), UL('Projektsteckbrief', 'fehlt', true)],
    foerderer: [], eigenanteil: null,
    nach: { ueb: { noetig: true, st: 'offen', termin: '', ort: '', mit: [] }, pm: { noetig: true, st: 'offen', datum: '' } },
    manuell: '', archiv: false, angelegt: today(),
  };
}
function UL(name, st, fest) { return { id: uid('u'), name, st: st || 'fehlt', fest: !!fest }; }
// Förderer im Förderplan; die Felder ab „art“ kommen meist aus der Recherche (Förderplan-Excel)
function ff(o) {
  return Object.assign({
    id: uid('f'), name: '', durch: 'ich', betrag: null, zugesagt: null, eingegangen: null, eingangAm: '', status: 'geplant', beantragtAm: '', entscheidungAm: '',
    frist: '', erwartet: '', warum: '', knackpunkte: '', einsch: '',
    art: '', weg: '', kontakt: '', mail: '', tel: '', web: '', fristInfo: '', hoehe: '', eigenInfo: '', quellen: '', notiz: '',
    sb: { noetig: false, frist: '', erledigt: false }, vn: { noetig: false, frist: '', erledigt: false },
  }, o);
}
// Daten aus der Datei auf den aktuellen Aufbau bringen (fehlende Felder ergänzen, Unbrauchbares verwerfen)
function normalize(d) {
  const o = merge(emptyData(), isObj(d) ? d : {});
  if (!isObj(o.meta)) o.meta = emptyData().meta;
  if (!isObj(o.settings)) o.settings = emptyData().settings;
  o.bedarfe = (Array.isArray(o.bedarfe) ? o.bedarfe : []).filter(isObj).map(b => {
    const n = merge(blank(), b);
    n.zust = Array.isArray(b.zust) ? b.zust.filter(x => typeof x === 'string' && x.trim()) : [];
    n.unterlagen = (Array.isArray(b.unterlagen) ? b.unterlagen : blank().unterlagen).filter(isObj).map(u => Object.assign(UL('', 'fehlt'), u));
    n.foerderer = (Array.isArray(b.foerderer) ? b.foerderer : []).filter(isObj).map(f => merge(ff({}), f));
    if (!Array.isArray(n.nach.ueb.mit)) n.nach.ueb.mit = [];
    if (!(n.prio in PRIO_ORD)) n.prio = 'mittel';
    for (const k of ['titel', 'gliederung', 'beschreibung', 'stichwort', 'link', 'pfad']) if (typeof n[k] !== 'string') n[k] = n[k] == null ? '' : String(n[k]);
    return n;
  });
  return o;
}

/* ---------- Freigabe: Ortsführungskreis und Angebot immer, Fachreferat und Verwaltung ab 1.000 € */
const FR_DEF = {
  ofk: { label: 'Ortsführungskreis', short: 'OFK', ok: 'zugestimmt', nein: 'abgelehnt', offen: 'offen' },
  angebot: { label: 'Angebot', short: 'Angebot', ok: 'liegt vor', nein: null, offen: 'fehlt' },
  fach: { label: 'Fachreferat', short: 'Fachreferat', ok: 'freigegeben', nein: 'abgelehnt', offen: 'offen' },
  verw: { label: 'Verwaltung (Budgetierung)', short: 'Verwaltung', ok: 'budgetiert', nein: 'nicht budgetiert', offen: 'offen' },
};
const ab1000 = b => (+b.summe || 0) >= 1000;
function frItems(b) {
  const f = b.freigabe;
  return ['ofk', 'angebot', 'fach', 'verw'].map(k => {
    let na = null;
    if (k === 'ofk' && b.gliederung === DIO) na = 'entfällt, Bedarf der Diözese';
    if ((k === 'fach' || k === 'verw') && !ab1000(b) && !f.trotzdem) na = 'nicht nötig, unter 1.000 €';
    return Object.assign({ k, st: f[k].st, na, item: f[k] }, FR_DEF[k]);
  });
}
const frText = i => i.na ? i.na.split(',')[0] : i.st === 'angefragt' ? 'angefragt' : i[i.st];
const frName = i => i.k === 'fach' && i.item.name ? 'Fachreferat ' + i.item.name : i.k === 'verw' ? 'Verwaltung' : i.label;
const UL_ST = { fehlt: 'fehlt', arbeit: 'in Arbeit', da: 'vorhanden' };

/* ---------- Finanzierung */
function fin(b) {
  let ge = 0, be = 0, zu = 0, ein = 0;
  for (const f of b.foerderer) {
    const v = +f.betrag || 0;
    if (f.status === 'geplant' || f.status === 'vorb') ge += v;
    else if (f.status === 'beantragt') be += v;
    else if (f.status === 'zugesagt') { zu += f.zugesagt != null ? +f.zugesagt : v; ein += +f.eingegangen || 0; }
  }
  const eig = +b.eigenanteil || 0, S = +b.summe || 0;
  return { geplant: ge, beantragt: be, zugesagt: zu, eingegangen: ein, eig, S, gedeckt: zu + eig, mitBe: zu + eig + be, mitGe: zu + eig + be + ge };
}
function finText(b) {
  const F = fin(b);
  if (!F.S) return 'Summe fehlt';
  const gap = F.S - F.gedeckt;
  return gap > 0 ? `${Math.round(F.gedeckt / F.S * 100)} % gedeckt · Lücke ${eur(gap)}` : gap < 0 ? `überdeckt um ${eur(-gap)}` : 'voll gedeckt';
}

/* ---------- Phase und Stand: ergeben sich aus den Häkchen, nichts davon wird von Hand gepflegt */
const PHASES = [
  { k: 'frei', t: 'Freigabe' }, { k: 'foer', t: 'Förderung' }, { k: 'nach', t: 'Nacharbeit' }, { k: 'fertig', t: 'Abgeschlossen' },
];
const names = l => l.map(f => short(f.name)).join(', ');
function nachOffen(b) {
  const L = [];
  for (const f of b.foerderer) if (f.status === 'zugesagt') {
    const x = [];
    if (f.sb.noetig && !f.sb.erledigt) x.push('Sachbericht');
    if (f.vn.noetig && !f.vn.erledigt) x.push('Verwendungsnachweis');
    if (x.length) L.push(x.join(' und ') + ' ' + short(f.name));
  }
  if (b.nach.ueb.noetig && b.nach.ueb.st !== 'erledigt') L.push('Spendenübergabe');
  if (b.nach.pm.noetig && b.nach.pm.st !== 'veroeff') L.push('Pressemitteilung');
  return L;
}
// step: 0 Freigabe · 1 Förderung · 2 Nacharbeit · 3 Abgeschlossen · -1 zurückgestellt/verworfen; bad: braucht Aufmerksamkeit
function phase(b) {
  const warn = [];
  if (b.manuell) return { k: 'pause', step: -1, t: b.manuell === 'verworfen' ? 'Verworfen' : 'Zurückgestellt', sub: '', bad: false, warn };
  const open = frItems(b).filter(i => !i.na && i.st !== 'ok'), rej = open.filter(i => i.st === 'nein');
  const fs = b.foerderer.filter(f => f.name.trim() || f.betrag);
  const laufend = fs.filter(f => f.status === 'beantragt' || f.status === 'zugesagt');
  if (open.length && laufend.length) warn.push((laufend.some(f => f.durch === 'gl') ? 'Gliederung hat schon beantragt' : 'Antrag läuft schon') + ', Freigabe ist aber nicht vollständig');
  if (!b.summe) warn.push('Summe fehlt');
  if (rej.length) return { k: 'stop', step: 0, t: 'Freigabe abgelehnt', sub: rej.map(frName).join(', '), bad: true, warn };
  if (open.length) return { k: 'frei', step: 0, t: 'Es fehlt', sub: open.map(frName).join(', '), bad: false, warn };
  if (!fs.length) return { k: 'plan', step: 1, t: 'Förderplan aufstellen', sub: 'noch kein Förderer eingetragen', bad: false, warn };
  const vor = fs.filter(f => f.status === 'geplant' || f.status === 'vorb'), wart = fs.filter(f => f.status === 'beantragt');
  if (vor.length) return { k: 'antrag', step: 1, t: 'Anträge stellen', sub: names(vor) + (wart.length ? ' · wartet auf ' + names(wart) : ''), bad: false, warn };
  if (wart.length) return { k: 'warten', step: 1, t: 'Warten auf Antwort', sub: names(wart), bad: false, warn };
  const F = fin(b), zu = fs.filter(f => f.status === 'zugesagt');
  if (!zu.length || (F.S && F.gedeckt < F.S)) return { k: 'luecke', step: 1, t: 'Finanzierungslücke', sub: (F.S ? eur(F.S - F.gedeckt) + ' offen' : 'keine Zusage') + ', weiteren Förderer suchen', bad: true, warn };
  const geld = zu.filter(f => !(f.eingegangen > 0));
  if (geld.length) return { k: 'geld', step: 1, t: 'Geldeingang offen', sub: names(geld), bad: false, warn };
  const na = nachOffen(b);
  if (na.length) return { k: 'nach', step: 2, t: 'Es fehlt', sub: na.join(', '), bad: false, warn };
  return { k: 'fertig', step: 3, t: 'Alles erledigt', sub: b.archiv ? '' : 'kann ins Archiv', bad: false, warn };
}
const phaseName = p => p.step < 0 ? p.t : PHASES[p.step].t;
const PH_CLS = ['ph-frei', 'ph-foer', 'ph-nach', 'ph-fertig'];
const phCls = p => p.step < 0 ? 'ph-pause' : PH_CLS[p.step];

/* ---------- Fristen: was steht als Nächstes an? */
function fristen(b) {
  const p = phase(b), L = [];
  if ((p.step === 0 || p.step === 1) && b.deadline) L.push({ d: b.deadline, t: 'Deadline des Bedarfs' });
  for (const f of b.foerderer) {
    if ((f.status === 'geplant' || f.status === 'vorb') && f.frist) L.push({ d: f.frist, t: 'Antragsfrist ' + short(f.name) });
    if (f.status === 'beantragt' && f.erwartet) L.push({ d: f.erwartet, t: 'Antwort ' + short(f.name) });
    if (f.status === 'zugesagt') for (const [k, l] of [['sb', 'Sachbericht'], ['vn', 'Verwendungsnachweis']]) if (f[k].noetig && !f[k].erledigt && f[k].frist) L.push({ d: f[k].frist, t: l + ' ' + short(f.name) });
  }
  const u = b.nach.ueb;
  if (u.noetig && u.st !== 'erledigt' && u.termin) L.push({ d: u.termin, t: 'Spendenübergabe' });
  return L.filter(x => validIso(x.d)).sort((x, y) => x.d.localeCompare(y.d));
}
const nextFrist = b => (b.archiv || b.manuell) ? null : (fristen(b)[0] || null);
const urg = d => { const n = days(today(), d); return n < 0 ? 'u-over' : n <= 14 ? 'u-soon' : ''; };
