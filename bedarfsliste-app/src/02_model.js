/* ===================================================================== Daten: Bedarfe, Freigabe, Förderplan, Stand und Fristen */

let D = null;                  // alle Daten (wird mit der Programmdatei gespeichert)
let SAVED_JSON = '';           // Stand der Datei (zum Erkennen ungespeicherter Änderungen)
const DIO = 'Diözese';         // Bedarf ohne Gliederung: Ortsführungskreis entfällt
const istDio = g => /^diözese(\s|$)/i.test(String(g || '').trim());   // auch „Diözese Paderborn“ oder mit Leerzeichen dahinter
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
const VN_ST = [['offen', 'steht aus'], ['erledigt', 'erledigt', 't-ok']];   // ab 0.70 ohne „in Arbeit“
const FEST_UL = ['Angebot', 'Interview', 'Konzept', 'Projektsteckbrief'];        // feste Unterlagen in dieser Reihenfolge (Interview: Gespräch mit den Leuten vor Ort, ab 0.54)

function emptyData() { return { meta: { savedAt: null, rev: 0 }, settings: { kartei: '' }, bedarfe: [] }; }
function blank() {
  return {
    id: uid('b'), titel: '', gliederung: '', zust: [], prio: 'mittel', beschreibung: '', summe: null, summeArt: 'Schätzung', deadline: '', stichworte: [], link: '', pfad: '',
    freigabe: {
      ofk: { st: 'offen', angefragt: '', erledigt: '', notiz: '' },
      fach: { name: '', st: 'offen', angefragt: '', erledigt: '', notiz: '', stern: '', aus: [], pers: [] },   // pers: Personen beim Bedarf, aus: ausgeblendete (ab 0.62)
      verw: { st: 'offen', angefragt: '', erledigt: '', notiz: '' },
    },
    unterlagen: FEST_UL.map(n => UL(n, 'fehlt', true)),
    foerderer: [], eigenanteil: null,
    nach: { ueb: { noetig: true, st: 'offen', termin: '', zeit: '', ort: '', mit: [], info: '', vorOrt: {}, einl: {}, presse: { pers: [], aus: [], fuer: '', wahl: [] } }, pm: { noetig: true, st: 'offen', datum: '' } },
    manuell: '', grundM: '', archiv: false, fertigGefragt: false, autoArchiv: '',   // ab 0.78: nach getaner Nacharbeit einmal gefragt; autoArchiv: an diesem Tag von selbst ins Archiv
    angelegt: today(),         // grundM: warum zurückgestellt bzw. verworfen (ab 0.61)
  };
}
function UL(name, st, fest) { return { id: uid('u'), name, st: st || 'fehlt', fest: !!fest }; }
// Förderer im Förderplan; die Felder ab „art“ kommen meist aus der Recherche (Förderplan-Excel)
function ff(o) {
  return Object.assign({
    id: uid('f'), name: '', durch: 'ich', betrag: null, zugesagt: null, eingegangen: null, eingangAm: '', status: 'geplant', beantragtAm: '', entscheidungAm: '',
    frist: '', erwartet: '', warum: '', knackpunkte: '', einsch: '',
    art: '', weg: '', kontakte: [], web: '', fristInfo: '', hoehe: '', eigenInfo: '', quellen: '', notiz: '', datei: '', grund: '',   // grund: warum abgelehnt (für spätere Recherchen)   // datei: ausführliche Recherche (Word im Ordner des Bedarfs); kontakte: bis zu drei, der erste ist der Hauptkontakt
    vn: { noetig: true, frist: '', st: 'offen' },                      // ab 0.17: Verwendungsnachweis standardmäßig nötig
    flId: '', flNein: false, flAus: [],                                // ab 0.88: Eintrag in der Fördererliste; „nicht in die Liste“; Kontakte, die nicht hinein sollen
  }, o);
}
// Kontakte eines Förderers: { n: Name, rolle: Funktion, mail, tel }; als Text „Name; Funktion; E-Mail; Telefon“ (Teile werden an ihrer Art erkannt)
const MAX_KONTAKTE = 3, MAX_ZUST = 12;
const leerK = () => ({ n: '', rolle: '', mail: '', tel: '' });
const leerZ = () => Object.assign(leerK(), { mobil: '' });                       // Zuständige haben dazu ein Handy
function kontaktAusText(t) {
  const k = leerK(), teile = String(t || '').split(/\s*;\s*/).map(x => x.trim()).filter(Boolean), rest = [];
  for (const x of teile) { if (!k.mail && /^\S+@\S+\.\S+$/.test(x)) k.mail = x; else if (!k.tel && /^[+\d][\d\s\/().-]{4,}$/.test(x)) k.tel = x; else rest.push(x); }
  const m = teile.length === 1 && rest.length === 1 && rest[0].match(/^([^,(]{2,40}),\s*(.+)$/);       // „Name, Funktion …“ in einem Stück
  if (m) Object.assign(k, { n: m[1].trim(), rolle: m[2].trim() }); else Object.assign(k, { n: rest[0] || '', rolle: rest.slice(1).join('; ') });
  return k;
}
const kontakteAusText = t => String(t || '').split(/\r?\n/).map(kontaktAusText).filter(k => k.n || k.rolle || k.mail || k.tel).slice(0, MAX_KONTAKTE);
const kontaktText = k => [k.n, k.rolle, k.mail, k.tel].join('; ').replace(/(;\s*)+$/, '');
const kontaktLeer = k => !(k.n.trim() || k.rolle.trim() || k.mail.trim() || k.tel.trim() || (k.mobil || '').trim());
const ZUST_F = ['rolle', 'mail', 'tel', 'mobil'];                                // Angaben einer zuständigen Person außer dem Namen
// Zuständige: ein bekannter Name bringt Position, E-Mail und Telefon mit – aus der Personen-Excel, sonst aus einem anderen Bedarf (die vollständigste Angabe)
function zustVorbild(name, ohne) {
  const q = norm(name), voll = z => !!z.rolle + !!z.mail + !!z.tel + !!z.mobil; let best = null;
  if (q) for (const x of D.bedarfe) for (const z of x.zust) if (z !== ohne && norm(z.n) === q && voll(z) && (!best || voll(z) >= voll(best))) best = z;
  const p = typeof person === 'function' ? person(name) : null;
  return p ? Object.fromEntries([['n', p.n], ...ZUST_F.map(k => [k, p[k] || (best && best[k]) || ''])]) : best;
}
// Ansprechperson in der Liste ändern: sie wird die erste Zuständige. Hat die bisherige erste schon Angaben, bleibt sie dahinter stehen.
function zustVorn(b, v) {
  const L = b.zust.slice(), i = L.findIndex(z => norm(z.n) === norm(v));
  if (!v) return L.slice(1);
  if (i >= 0) return [L[i], ...L.filter((z, j) => j !== i)];
  const v0 = zustVorbild(v), neu = Object.assign(leerZ(), v0 && Object.fromEntries(ZUST_F.map(k => [k, v0[k] || ''])), { n: v });
  return L[0] && ZUST_F.some(k => L[0][k]) ? [neu, ...L] : [neu, ...L.slice(1)];
}
// wie merge, aber ein Wert vom falschen Typ (null oder Text statt eines Objekts, Text statt einer Liste) ersetzt die Vorgabe nicht –
// sonst bräche das Programm beim Start mit leerer Seite ab
function mergeSicher(a, b) {
  for (const k in b) {
    const x = a[k], y = b[k];
    if (isObj(x)) { if (isObj(y)) mergeSicher(x, y); }
    else if (Array.isArray(x)) { if (Array.isArray(y)) a[k] = y; }
    else a[k] = y;
  }
  return a;
}
const zahlOderLeer = v => { if (v == null || v === '') return null; const x = typeof v === 'number' ? v : deNum(v); return typeof x === 'number' && isFinite(x) ? x : null; };
const gueltigeId = (v, p) => /^[\w.-]{1,80}$/.test(String(v ?? '')) ? String(v) : uid(p);
const FOE_STAENDE = ['geplant', 'beantragt', 'zugesagt', 'abgelehnt'], FR_STAENDE = ['offen', 'angefragt', 'ok', 'nein'], UL_STAENDE = ['fehlt', 'arbeit', 'da', 'nn'];
// Daten aus der Datei auf den aktuellen Aufbau bringen (fehlende Felder ergänzen, Unbrauchbares verwerfen)
function normalize(d) {
  const o = mergeSicher(emptyData(), isObj(d) ? d : {});
  if (!isObj(o.meta)) o.meta = emptyData().meta;
  if (!isObj(o.settings)) o.settings = emptyData().settings;
  // ab 0.17 ist der Verwendungsnachweis standardmäßig nötig: in schon gespeicherten Daten einmalig auch dort, wo er unberührt auf „nicht nötig“ stand
  const vnMig = isObj(d) && isObj(d.meta) && !d.meta.vnStd && !!(d.meta.savedAt || d.meta.rev);
  o.meta.vnStd = 1;
  o.bedarfe = (Array.isArray(o.bedarfe) ? o.bedarfe : []).filter(isObj).map(b => {
    const n = mergeSicher(blank(), b);
    if (typeof b.fertigGefragt !== 'boolean') n.fertigGefragt = null;                // ältere Daten: schon erledigte Bedarfe nicht nachträglich fragen (unten)
    n.id = gueltigeId(n.id, 'b'); n.summe = zahlOderLeer(n.summe); n.eigenanteil = zahlOderLeer(n.eigenanteil);
    for (const k of ['ofk', 'fach', 'verw']) if (!FR_STAENDE.includes(n.freigabe[k].st)) n.freigabe[k].st = 'offen';
    // ab 0.25 mehrere Stichworte (Fördertöpfe) je Bedarf – bisher eines
    n.stichworte = uniq([...(Array.isArray(b.stichworte) ? b.stichworte : []), ...(typeof b.stichwort === 'string' ? [b.stichwort] : [])].map(s => String(s ?? '').trim()).filter(Boolean));
    delete n.stichwort;
    // ab 0.24 sind die Zuständigen Kontakte wie bei den Förderern (Name, Position, E-Mail, Telefon) – bisher nur Namen
    n.zust = (Array.isArray(b.zust) ? b.zust : []).map(z => typeof z === 'string' ? Object.assign(leerZ(), { n: z.trim() })
      : isObj(z) ? Object.assign({ n: String(z.n ?? ''), rolle: String(z.rolle ?? ''), mail: String(z.mail ?? ''), tel: String(z.tel ?? ''), mobil: String(z.mobil ?? '') }, z.pxl ? { pxl: String(z.pxl) } : {}) : null).filter(z => z && !kontaktLeer(z));   // pxl: zuletzt aus dieser Fassung der Personen-Excel ergänzt
    n.unterlagen = (Array.isArray(b.unterlagen) ? b.unterlagen : []).filter(isObj).map(u => Object.assign(UL('', 'fehlt'), u))
      .map(u => Object.assign(u, { id: gueltigeId(u.id, 'u'), name: String(u.name ?? ''), st: UL_STAENDE.includes(u.st) && (u.st !== 'nn' || (u.fest && u.name === 'Angebot')) ? u.st : 'fehlt' }));
    // ab 0.2 ist das Angebot eine Unterlage (vorher Teil der Freigabe); die drei festen Unterlagen gibt es immer
    const alt = isObj(b.freigabe) && isObj(b.freigabe.angebot) ? b.freigabe.angebot.st : null;
    FEST_UL.forEach((name, i) => {
      if (n.unterlagen.some(u => u.fest && u.name === name)) return;
      n.unterlagen.splice(Math.min(i, n.unterlagen.length), 0, UL(name, name === 'Angebot' && alt ? ({ ok: 'da', angefragt: 'arbeit' })[alt] || 'fehlt' : 'fehlt', true));
    });
    // feste Unterlagen vorn in der Reihenfolge von FEST_UL (Angebot zuerst), danach die eigenen
    n.unterlagen = [...FEST_UL.map(name => n.unterlagen.find(u => u.fest && u.name === name)), ...n.unterlagen.filter(u => !(u.fest && FEST_UL.includes(u.name)))];
    delete n.freigabe.angebot; delete n.freigabe.trotzdem;
    n.foerderer = (Array.isArray(b.foerderer) ? b.foerderer : []).filter(isObj).map(f0 => {
      const f = mergeSicher(ff({}), f0), v = f.vn, v0 = isObj(f0.vn) ? f0.vn : {}, sb = isObj(f0.sb) ? f0.sb : null;
      // ab 0.6 hat der Verwendungsnachweis drei Stände, und der Sachbericht gehört zu ihm (ein Abwasch)
      if (!VN_ST.some(o => o[0] === v0.st)) v.st = v0.erledigt === true ? 'erledigt' : 'offen';   // auch „in Arbeit“ (bis 0.69) → steht aus
      if (sb && sb.noetig) {
        if (!v.noetig) Object.assign(v, { noetig: true, frist: sb.frist || v.frist, st: sb.erledigt ? 'erledigt' : 'offen' });
        else {
          if (sb.frist && (!v.frist || sb.frist < v.frist)) v.frist = sb.frist;
          if ((v.st === 'erledigt') !== !!sb.erledigt) v.st = 'offen';
        }
      }
      delete f.sb; delete v.erledigt;
      if (vnMig && !b.archiv && v.noetig === false && !v.frist && v.st === 'offen') v.noetig = true;
      if (f.status === 'vorb') f.status = 'geplant';                 // „in Vorbereitung“ gibt es ab 0.17 nicht mehr
      if (!FOE_STAENDE.includes(f.status)) f.status = 'geplant';
      f.id = gueltigeId(f.id, 'f'); f.name = String(f.name ?? ''); f.flId = typeof f.flId === 'string' ? f.flId : ''; f.flNein = f.flNein === true; f.flAus = Array.isArray(f.flAus) ? f.flAus.filter(x => typeof x === 'string') : []; for (const k of ['betrag', 'zugesagt', 'eingegangen']) f[k] = zahlOderLeer(f[k]);
      // bis 0.20 ein Kontakt in drei Feldern (Ansprechperson, E-Mail, Telefon) – daraus wird der erste Kontakt
      if (!Array.isArray(f0.kontakte)) {
        const k = kontakteAusText(f0.kontakt);
        if (!k.length && (f0.mail || f0.tel)) k.push(leerK());
        if (k.length) { k[0].mail = k[0].mail || String(f0.mail || ''); k[0].tel = k[0].tel || String(f0.tel || ''); }
        f.kontakte = k;
      }
      f.kontakte = (Array.isArray(f.kontakte) ? f.kontakte : []).filter(isObj).map(k => ({ n: String(k.n ?? ''), rolle: String(k.rolle ?? ''), mail: String(k.mail ?? ''), tel: String(k.tel ?? '') })).slice(0, MAX_KONTAKTE);
      delete f.kontakt; delete f.mail; delete f.tel;
      return f;
    });
    n.foerderer.forEach(f => { if (f.einsch in EINSCH_ALT) f.einsch = EINSCH_ALT[f.einsch]; if (!EINSCH.some(e => e[0] === f.einsch)) f.einsch = ''; });
    if (!Array.isArray(n.nach.ueb.mit)) n.nach.ueb.mit = [];
    for (const k of ['info', 'zeit', 'ort', 'termin']) if (typeof n.nach.ueb[k] !== 'string') n.nach.ueb[k] = '';
    if (!/^\d{1,2}:\d{2}$/.test(n.nach.ueb.zeit)) n.nach.ueb.zeit = '';                    // Uhrzeit nur als HH:MM
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.nach.ueb.termin)) n.nach.ueb.termin = '';
    if (!(n.prio in PRIO_ORD) || n.prio === 'niedrig') n.prio = 'mittel';         // ab 0.36 nur noch Prio (Stern) oder keine
    for (const k of ['titel', 'gliederung', 'beschreibung', 'link', 'pfad']) if (typeof n[k] !== 'string') n[k] = n[k] == null ? '' : String(n[k]);
    n.pfad = unquote(n.pfad);
    if (!/^https?:\/\//i.test(n.link.trim()) && n.pfad.trim()) n.link = spLink(n.pfad, (isObj(o.settings) && o.settings.sp) || SP_STANDARD);   // Ordner bekannt: SharePoint-Link dazu
    return n;
  });
  o.fl = flNorm(o.fl);                                                   // Fördererliste (ab 0.88)
  o.bedarfe.forEach(n => { if (n.fertigGefragt === null) n.fertigGefragt = !n.archiv && phase(n).step === 3; if (typeof n.autoArchiv !== 'string' || !validIso(n.autoArchiv)) n.autoArchiv = ''; });
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
    na: k === 'ofk' && istDio(b.gliederung) ? 'entfällt, Bedarf der Diözese' : null, opt: (k === 'fach' || k === 'verw') && !ab1000(b) }, FR_DEF[k]));
}
const frNeeded = i => !i.na && !(i.opt && i.st === 'offen');
const frText = i => i.na ? i.na.split(',')[0] : i.opt && i.st === 'offen' ? 'unter 1.000 € nicht nötig' : i.st === 'angefragt' ? 'angefragt' : i[i.st];
const frName = i => i.k === 'fach' && i.item.name ? 'Fachreferat ' + i.item.name : i.k === 'verw' ? 'Verwaltung' : i.label;
const angebotUL = b => b.unterlagen.find(u => u.fest && u.name === 'Angebot');
// was in der Freigabe noch fehlt (Namen), und was abgelehnt wurde
function frOffen(b) {
  const open = frItems(b).filter(i => frNeeded(i) && i.st !== 'ok');                // das Angebot ist seit 0.52 eine Unterlage, kein Teil der Freigabe
  return { names: open.map(frName), rej: open.filter(i => i.st === 'nein') };
}
const ulOpts = u => u.fest && u.name === 'Interview' ? [['fehlt', 'offen'], ['arbeit', 'vereinbart', 't-warn'], ['da', 'geführt', 't-ok']] : u.fest && u.name === 'Angebot' ? [['fehlt', 'fehlt'], ['arbeit', 'angefragt', 't-warn'], ['da', 'liegt vor', 't-ok'], ['nn', 'nicht nötig']] : [['fehlt', 'fehlt'], ['arbeit', 'in Arbeit', 't-warn'], ['da', 'vorhanden', 't-ok']];
const ulText = u => (ulOpts(u).find(o => o[0] === u.st) || [, u.st])[1];

/* ---------- Finanzierung */
function fin(b) {
  let ge = 0, be = 0, zu = 0, ein = 0;
  for (const f of b.foerderer) {
    const v = +f.betrag || 0;
    if (f.status === 'geplant') ge += v;
    else if (f.status === 'beantragt') be += v;
    else if (f.status === 'zugesagt') { zu += f.zugesagt != null ? +f.zugesagt : v; ein += +f.eingegangen || 0; }
  }
  const eig = +b.eigenanteil || 0, S = +b.summe || 0;
  return { geplant: ge, beantragt: be, zugesagt: zu, eingegangen: ein, eig, S, gedeckt: zu + eig, mitBe: zu + eig + be, mitGe: zu + eig + be + ge };
}
// Finanzierung steht, wenn Zusagen und Eigenmittel den Bedarf decken und kein Antrag mehr läuft; nie angegangene Förderer zählen dann nicht mehr.
// d: was noch fehlt (> 0) oder zu viel ist (< 0) – solange die Finanzierung nicht steht, zählen auch geplante und beantragte Förderer mit
// Beträge in Cent vergleichen: 1.200,10 + 300,30 ist genau 1.500,40 (mit Kommazahlen käme 1.500,3999… heraus – nie „Finanzierung steht“)
const ct = x => Math.round((+x || 0) * 100);
// Reihenfolge der Förderer überall: zugesagt oben, dann nach Einschätzung (sehr wahrscheinlich … sehr unwahrscheinlich; ohne Einschätzung wie
// „unsicher“), abgelehnt ganz unten; Gleiches bleibt in der eingetragenen Reihenfolge
const EINSCH_RANG = { sw: 1, w: 2, u: 3, uw: 4, suw: 5 };
const foeRang = f => f.status === 'zugesagt' ? 0 : f.status === 'abgelehnt' ? 9 : EINSCH_RANG[f.einsch] || 3;
const foeSortiert = L => L.map((f, i) => [f, i]).sort((a, c) => foeRang(a[0]) - foeRang(c[0]) || a[1] - c[1]).map(x => x[0]);
function finState(b) {
  const S = +b.summe || 0, eig = +b.eigenanteil || 0, fs = foeSortiert(b.foerderer.filter(f => f.name.trim() || f.betrag));
  const sum = L => L.reduce((a, f) => a + foeAmt(f), 0);
  const zu = sum(fs.filter(f => f.status === 'zugesagt')), plan = sum(fs.filter(f => f.status !== 'abgelehnt'));
  // gedeckt: Zusagen und Eigenmittel decken die Summe – mit mindestens einer Zusage (nur Eigenmittel gelten nicht als finanziert, Ziel sind Förderer);
  // ohne Summe ist nichts gedeckt. done: gedeckt und kein Antrag mehr offen
  const gedeckt = S > 0 && zu > 0 && ct(zu) + ct(eig) >= ct(S), offen = fs.filter(f => f.status === 'beantragt');
  const done = gedeckt && !offen.length;
  return { S, eig, fs, zu, gedeckt, offen, done, d: S ? (ct(S) - ct(done ? zu : plan) - ct(eig)) / 100 : 0 };
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
  const gap = (ct(F.S) - ct(F.gedeckt)) / 100;
  return gap > 0 ? `${Math.round(F.gedeckt / F.S * 100)} % gedeckt · Lücke ${eur(gap)}` : gap < 0 ? `überdeckt um ${eur(-gap)}` : 'voll gedeckt';
}

/* ---------- Phase und Stand: ergeben sich aus den Häkchen, nichts davon wird von Hand gepflegt */
const PHASES = [
  { k: 'frei', t: 'Freigabe' }, { k: 'foer', t: 'Förderung' }, { k: 'nach', t: 'Nacharbeit' }, { k: 'fertig', t: 'Abgeschlossen' },   // „Abgeschlossen“ ab 0.78 nicht mehr als eigener Schritt angezeigt
];
const names = l => l.map(f => short(f.name)).join(', ');
function nachOffen(b) {
  const L = [];
  for (const f of b.foerderer) if (f.status === 'zugesagt') {
    if (f.vn.noetig && f.vn.st !== 'erledigt') L.push('Verwendungsnachweis ' + short(f.name));
  }
  if (b.nach.ueb.noetig && b.nach.ueb.st !== 'erledigt' && b.foerderer.some(f => f.status === 'zugesagt')) L.push('Spendenübergabe');
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
  const ohneBetrag = b.foerderer.filter(f => f.status === 'zugesagt' && !foeAmt(f));
  if (ohneBetrag.length) warn.push('Zusage ohne Betrag: ' + names(ohneBetrag));
  if (fo.rej.length) return { k: 'stop', step: 0, t: 'Freigabe abgelehnt', sub: fo.rej.map(frName).join(', '), bad: true, warn };
  if (fo.names.length) return { k: 'frei', step: 0, t: 'Es fehlt', sub: fo.names.join(', '), bad: false, warn };
  if (!b.summe) return { k: 'summe', step: 1, t: 'Summe fehlt', sub: 'erst mit der Summe lässt sich die Finanzierung prüfen', bad: true, warn: warn.filter(w => w !== 'Summe fehlt') };
  if (!fs.length) return { k: 'plan', step: 1, t: 'Förderplan aufstellen', sub: 'noch kein Förderer eingetragen', bad: false, warn };
  const vor = fs.filter(f => f.status === 'geplant'), wart = fs.filter(f => f.status === 'beantragt');
  const FS = finState(b), zu = fs.filter(f => f.status === 'zugesagt');
  if (!FS.done) {
    if (FS.gedeckt) return { k: 'warten', step: 1, t: 'Finanzierung steht', sub: 'Antrag bei ' + names(wart) + ' noch offen – ggf. zurückziehen', bad: false, warn };
    if (!FS.zu && FS.eig && ct(FS.eig) >= ct(FS.S) && !vor.length && !wart.length) return { k: 'luecke', step: 1, t: 'Förderer suchen', sub: 'bisher nur Eigenmittel – Ziel ist, sie durch Förderer zu ersetzen', bad: true, warn };
    if (vor.length) return { k: 'antrag', step: 1, t: 'Anträge stellen', sub: names(vor) + (wart.length ? ' · wartet auf ' + names(wart) : ''), bad: false, warn };
    if (wart.length) return { k: 'warten', step: 1, t: 'Warten auf Antwort', sub: names(wart), bad: false, warn };
    return { k: 'luecke', step: 1, t: 'Finanzierungslücke', sub: (FS.S ? eur((ct(FS.S) - ct(FS.zu) - ct(FS.eig)) / 100) + ' offen' : 'keine Zusage') + ', weiteren Förderer suchen', bad: true, warn };
  }
  const geld = zu.filter(f => !(f.eingegangen > 0));
  if (geld.length) return { k: 'geld', step: 1, t: 'Geldeingang offen', sub: names(geld), bad: false, warn };
  const na = nachOffen(b);
  if (na.length) return { k: 'nach', step: 2, t: 'Es fehlt', sub: na.join(', '), bad: false, warn };
  return { k: 'fertig', step: 3, t: 'Alles erledigt', sub: b.archiv ? '' : b.autoArchiv ? 'kommt am ' + fmtDate(b.autoArchiv) + ' von selbst ins Archiv' : 'kann ins Archiv', bad: false, warn };
}
const phaseName = p => p.step < 0 ? p.t : PHASES[p.step].t;
const PH_CLS = ['ph-frei', 'ph-foer', 'ph-nach', 'ph-fertig'];
const phCls = p => p.step < 0 ? 'ph-pause' : PH_CLS[p.step];

// Was vor dem Archivieren noch offen ist: Antworten, Geldeingänge, Verwendungsnachweise, Übergabe, Pressemitteilung
function archivOffen(b) {
  const L = [];
  for (const f of b.foerderer) {
    if (f.status === 'beantragt') L.push('Antwort von ' + short(f.name));
    if (f.status === 'zugesagt' && !(f.eingegangen > 0)) L.push('Geldeingang ' + short(f.name));
    if (f.status === 'zugesagt' && f.vn.noetig && f.vn.st !== 'erledigt') L.push('Verwendungsnachweis ' + short(f.name) + (f.vn.frist ? ' (bis ' + fmtDate(f.vn.frist) + ')' : ''));
  }
  return b.foerderer.some(f => f.status === 'zugesagt') ? L.concat(nachOffen(b).filter(x => !/^Verwendungsnachweis /.test(x))) : L;   // Übergabe und Presse erst nach einer Zusage
}
/* ---------- Fristen: was steht als Nächstes an? */
// z: wo die Frist herkommt (für den Sprung dorthin) – deadline, frist (Antragsfrist), erwartet (Antwort), vn (Verwendungsnachweis), ueb; fid: der Förderer
const vnFrist = f => ({ d: f.vn.frist, t: 'Verwendungsnachweis ' + short(f.name), z: 'vn', fid: f.id });
function fristen(b) {
  const p = phase(b), L = [];
  if ((p.step === 0 || p.step === 1) && b.deadline) L.push({ d: b.deadline, t: 'Deadline des Bedarfs', z: 'deadline' });
  for (const f of b.foerderer) {
    if (f.status === 'geplant' && f.frist) L.push({ d: f.frist, t: 'Antragsfrist ' + short(f.name), z: 'frist', fid: f.id });
    if (f.status === 'beantragt' && f.erwartet) L.push({ d: f.erwartet, t: 'Antwort ' + short(f.name), z: 'erwartet', fid: f.id });
    if (f.status === 'zugesagt' && f.vn.noetig && f.vn.st !== 'erledigt' && f.vn.frist) L.push(vnFrist(f));
  }
  const u = b.nach.ueb;
  if (u.noetig && u.st !== 'erledigt' && u.termin) L.push({ d: u.termin, t: 'Spendenübergabe', z: 'ueb' });
  return L.filter(x => validIso(x.d)).sort((x, y) => x.d.localeCompare(y.d));
}
const nextFrist = b => (b.archiv || b.manuell) ? null : (fristen(b)[0] || null);
const urg = d => { const n = days(today(), d); return n < 0 ? 'u-over' : n <= 14 ? 'u-soon' : ''; };
// Fristen aller Bedarfe, die überfällig sind oder in den nächsten 14 Tagen ablaufen – gebündelt oben im Feld der Hinweise.
// Verwendungsnachweise zählen auch bei zurückgestellten und archivierten Bedarfen (die Pflicht bleibt)
const FRIST_TAGE = 14;
function fristenBald() {
  const L = [];
  for (const b of D.bedarfe) {
    const alle = b.archiv || b.manuell ? b.foerderer.filter(f => f.status === 'zugesagt' && f.vn.noetig && f.vn.st !== 'erledigt' && validIso(f.vn.frist)).map(vnFrist) : fristen(b);
    for (const x of alle) { const n = days(today(), x.d); if (n <= FRIST_TAGE) L.push(Object.assign({ b, n }, x)); }
  }
  return L.sort((x, y) => x.d.localeCompare(y.d));
}
