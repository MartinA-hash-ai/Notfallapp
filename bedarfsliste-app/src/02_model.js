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
const ART = ['Stiftung', 'Sparkasse', 'Volksbank / Bank', 'Unternehmen', 'Soziallotterie', 'Öffentliche Förderung', 'Kirchliche Stelle', 'Sonstiges'];
// Einschätzung in fünf Stufen; Ton = Farbe im Auswahlfeld (alte Werte bis 0.1: gut → wahrscheinlich, schwierig → unwahrscheinlich)
const EINSCH = [['sw', 'sehr wahrscheinlich', 't-e5'], ['w', 'wahrscheinlich', 't-e4'], ['u', 'unsicher', 't-e3'], ['uw', 'unwahrscheinlich', 't-e2'], ['suw', 'sehr unwahrscheinlich', 't-e1']];
const EINSCH_ALT = { gut: 'w', unsicher: 'u', schwierig: 'uw' };
// Verwendungsnachweis (Sach- und Finanzbericht in einem Abwasch)
const VN_ST = [['offen', 'steht aus'], ['arbeit', 'in Arbeit', 't-warn'], ['erledigt', 'erledigt', 't-ok']];
const FEST_UL = ['Konzept', 'Projektsteckbrief', 'Angebot'];

function emptyData() { return { meta: { savedAt: null, rev: 0 }, settings: { kartei: '' }, bedarfe: [] }; }
function blank() {
  return {
    id: uid('b'), titel: '', gliederung: '', zust: [], prio: 'mittel', beschreibung: '', summe: null, summeArt: 'Schätzung', deadline: '', stichwort: '', link: '', pfad: '',
    freigabe: {
      ofk: { st: 'offen', angefragt: '', erledigt: '', notiz: '' },
      fach: { name: '', st: 'offen', angefragt: '', erledigt: '', notiz: '' }, verw: { st: 'offen', angefragt: '', erledigt: '', notiz: '' },
    },
    unterlagen: FEST_UL.map(n => UL(n, 'fehlt', true)),
    foerderer: [], eigenanteil: null,
    nach: { ueb: { noetig: true, st: 'offen', termin: '', zeit: '', ort: '', mit: [], info: '' }, pm: { noetig: true, st: 'offen', datum: '' } },
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
    vn: { noetig: false, frist: '', st: 'offen' },
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
    n.unterlagen = (Array.isArray(b.unterlagen) ? b.unterlagen : []).filter(isObj).map(u => Object.assign(UL('', 'fehlt'), u));
    // ab 0.2 ist das Angebot eine Unterlage (vorher Teil der Freigabe); die drei festen Unterlagen gibt es immer
    const alt = isObj(b.freigabe) && isObj(b.freigabe.angebot) ? b.freigabe.angebot.st : null;
    FEST_UL.forEach((name, i) => {
      if (n.unterlagen.some(u => u.fest && u.name === name)) return;
      n.unterlagen.splice(Math.min(i, n.unterlagen.length), 0, UL(name, name === 'Angebot' && alt ? ({ ok: 'da', angefragt: 'arbeit' })[alt] || 'fehlt' : 'fehlt', true));
    });
    delete n.freigabe.angebot; delete n.freigabe.trotzdem;
    n.foerderer = (Array.isArray(b.foerderer) ? b.foerderer : []).filter(isObj).map(f0 => {
      const f = merge(ff({}), f0), v = f.vn, v0 = isObj(f0.vn) ? f0.vn : {}, sb = isObj(f0.sb) ? f0.sb : null;
      // ab 0.6 hat der Verwendungsnachweis drei Stände, und der Sachbericht gehört zu ihm (ein Abwasch)
      if (!VN_ST.some(o => o[0] === v0.st)) v.st = v0.erledigt === true ? 'erledigt' : 'offen';
      if (sb && sb.noetig) {
        if (!v.noetig) Object.assign(v, { noetig: true, frist: sb.frist || v.frist, st: sb.erledigt ? 'erledigt' : 'offen' });
        else {
          if (sb.frist && (!v.frist || sb.frist < v.frist)) v.frist = sb.frist;
          if ((v.st === 'erledigt') !== !!sb.erledigt) v.st = 'arbeit';
        }
      }
      delete f.sb; delete v.erledigt;
      return f;
    });
    n.foerderer.forEach(f => { if (f.einsch in EINSCH_ALT) f.einsch = EINSCH_ALT[f.einsch]; if (!EINSCH.some(e => e[0] === f.einsch)) f.einsch = ''; });
    if (!Array.isArray(n.nach.ueb.mit)) n.nach.ueb.mit = [];
    for (const k of ['info', 'zeit', 'ort', 'termin']) if (typeof n.nach.ueb[k] !== 'string') n.nach.ueb[k] = '';
    if (!(n.prio in PRIO_ORD)) n.prio = 'mittel';
    for (const k of ['titel', 'gliederung', 'beschreibung', 'stichwort', 'link', 'pfad']) if (typeof n[k] !== 'string') n[k] = n[k] == null ? '' : String(n[k]);
    return n;
  });
  return o;
}

/* ---------- Freigabe: Ortsführungskreis immer, Fachreferat und Verwaltung ab 1.000 € (darunter nur, wenn angefragt); dazu muss das Angebot vorliegen */
const FR_DEF = {
  ofk: { label: 'Ortsführungskreis', short: 'OFK', ok: 'zugestimmt', nein: 'abgelehnt', offen: 'noch nicht angefragt' },
  fach: { label: 'Fachreferat', short: 'Fachreferat', ok: 'freigegeben', nein: 'abgelehnt', offen: 'noch nicht angefragt' },
  verw: { label: 'Verwaltung (Budgetierung)', short: 'Verwaltung', ok: 'budgetiert', nein: 'nicht budgetiert', offen: 'noch nicht angefragt' },
};
const ab1000 = b => (+b.summe || 0) >= 1000;
function frItems(b) {
  const f = b.freigabe;
  return ['ofk', 'fach', 'verw'].map(k => Object.assign({ k, st: f[k].st, item: f[k],
    na: k === 'ofk' && b.gliederung === DIO ? 'entfällt, Bedarf der Diözese' : null, opt: (k === 'fach' || k === 'verw') && !ab1000(b) }, FR_DEF[k]));
}
const frNeeded = i => !i.na && !(i.opt && i.st === 'offen');
const frText = i => i.na ? i.na.split(',')[0] : i.opt && i.st === 'offen' ? 'unter 1.000 € nicht nötig' : i.st === 'angefragt' ? 'angefragt' : i[i.st];
const frName = i => i.k === 'fach' && i.item.name ? 'Fachreferat ' + i.item.name : i.k === 'verw' ? 'Verwaltung' : i.label;
const angebotUL = b => b.unterlagen.find(u => u.fest && u.name === 'Angebot');
// was in der Freigabe noch fehlt (Namen), und was abgelehnt wurde
function frOffen(b) {
  const open = frItems(b).filter(i => frNeeded(i) && i.st !== 'ok'), ang = angebotUL(b);
  return { names: [...open.map(frName), ...(!ang || ang.st !== 'da' ? ['Angebot'] : [])], rej: open.filter(i => i.st === 'nein') };
}
const ulOpts = u => u.fest && u.name === 'Angebot' ? [['fehlt', 'fehlt'], ['arbeit', 'angefragt', 't-warn'], ['da', 'liegt vor', 't-ok']] : [['fehlt', 'fehlt'], ['arbeit', 'in Arbeit', 't-warn'], ['da', 'vorhanden', 't-ok']];
const ulText = u => (ulOpts(u).find(o => o[0] === u.st) || [, u.st])[1];

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
// Finanzierung steht, wenn Zusagen und Eigenmittel den Bedarf decken und kein Antrag mehr läuft; nie angegangene Förderer zählen dann nicht mehr.
// d: was noch fehlt (> 0) oder zu viel ist (< 0) – solange die Finanzierung nicht steht, zählen auch geplante und beantragte Förderer mit
function finState(b) {
  const S = +b.summe || 0, eig = +b.eigenanteil || 0, fs = b.foerderer.filter(f => f.name.trim() || f.betrag);
  const sum = L => L.reduce((a, f) => a + foeAmt(f), 0);
  const zu = sum(fs.filter(f => f.status === 'zugesagt')), plan = sum(fs.filter(f => f.status !== 'abgelehnt'));
  const done = (S ? zu + eig >= S : zu > 0) && !fs.some(f => f.status === 'beantragt');
  return { S, eig, fs, zu, done, d: S ? S - (done ? zu : plan) - eig : 0 };
}
// Wer deckt was: zugesagt (eingegangen zuerst), Eigenmittel, beantragt, geplant – in dieser Reihenfolge im Balken; abgelehnte fehlen
const KIND_L = { in: 'eingegangen', zu: 'zugesagt', eig: 'Eigenmittel', be: 'beantragt', ge: 'geplant' };
const foeAmt = f => f.status === 'zugesagt' ? (f.zugesagt != null ? +f.zugesagt : +f.betrag || 0) : +f.betrag || 0;
function finSegs(b) {
  const ord = { in: 0, zu: 1, eig: 2, be: 3, ge: 4 };
  const segs = b.foerderer.filter(f => f.status !== 'abgelehnt' && foeAmt(f) > 0).map(f => ({ id: f.id, v: foeAmt(f), name: f.name.trim() || '(ohne Namen)',
    k: f.status === 'zugesagt' ? (f.eingegangen > 0 ? 'in' : 'zu') : f.status === 'beantragt' ? 'be' : 'ge' }));
  if (+b.eigenanteil > 0) segs.push({ id: null, v: +b.eigenanteil, k: 'eig', name: 'Eigenmittel' });
  return segs.sort((x, y) => ord[x.k] - ord[y.k]);
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
    if (f.vn.noetig && f.vn.st !== 'erledigt') L.push('Verwendungsnachweis ' + short(f.name));
  }
  if (b.nach.ueb.noetig && b.nach.ueb.st !== 'erledigt' && b.foerderer.some(f => f.status === 'zugesagt')) L.push('Spendenübergabe');
  if (b.nach.pm.noetig && b.nach.pm.st !== 'veroeff') L.push('Pressemitteilung');
  return L;
}
// step: 0 Freigabe · 1 Förderung · 2 Nacharbeit · 3 Abgeschlossen · -1 zurückgestellt/verworfen; bad: braucht Aufmerksamkeit
function phase(b) {
  const warn = [];
  if (b.manuell) return { k: 'pause', step: -1, t: b.manuell === 'verworfen' ? 'Verworfen' : 'Zurückgestellt', sub: '', bad: false, warn };
  const fo = frOffen(b);
  const fs = b.foerderer.filter(f => f.name.trim() || f.betrag);
  const laufend = fs.filter(f => f.status === 'beantragt' || f.status === 'zugesagt');
  if (fo.names.length && laufend.length) warn.push((laufend.some(f => f.durch === 'gl') ? 'Gliederung hat schon beantragt' : 'Antrag läuft schon') + ', Freigabe ist aber nicht vollständig');
  if (!b.summe) warn.push('Summe fehlt');
  if (fo.rej.length) return { k: 'stop', step: 0, t: 'Freigabe abgelehnt', sub: fo.rej.map(frName).join(', '), bad: true, warn };
  if (fo.names.length) return { k: 'frei', step: 0, t: 'Es fehlt', sub: fo.names.join(', '), bad: false, warn };
  if (!fs.length) return { k: 'plan', step: 1, t: 'Förderplan aufstellen', sub: 'noch kein Förderer eingetragen', bad: false, warn };
  const vor = fs.filter(f => f.status === 'geplant' || f.status === 'vorb'), wart = fs.filter(f => f.status === 'beantragt');
  const FS = finState(b), zu = fs.filter(f => f.status === 'zugesagt');
  if (!FS.done) {
    if (vor.length) return { k: 'antrag', step: 1, t: 'Anträge stellen', sub: names(vor) + (wart.length ? ' · wartet auf ' + names(wart) : ''), bad: false, warn };
    if (wart.length) return { k: 'warten', step: 1, t: 'Warten auf Antwort', sub: names(wart), bad: false, warn };
    return { k: 'luecke', step: 1, t: 'Finanzierungslücke', sub: (FS.S ? eur(FS.S - FS.zu - FS.eig) + ' offen' : 'keine Zusage') + ', weiteren Förderer suchen', bad: true, warn };
  }
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
    if (f.status === 'zugesagt' && f.vn.noetig && f.vn.st !== 'erledigt' && f.vn.frist) L.push({ d: f.vn.frist, t: 'Verwendungsnachweis ' + short(f.name) });
  }
  const u = b.nach.ueb;
  if (u.noetig && u.st !== 'erledigt' && u.termin) L.push({ d: u.termin, t: 'Spendenübergabe' });
  return L.filter(x => validIso(x.d)).sort((x, y) => x.d.localeCompare(y.d));
}
const nextFrist = b => (b.archiv || b.manuell) ? null : (fristen(b)[0] || null);
const urg = d => { const n = days(today(), d); return n < 0 ? 'u-over' : n <= 14 ? 'u-soon' : ''; };
