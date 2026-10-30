/* ===================================================================== Mehrere Bedarfe gemeinsam bearbeiten (ab 0.80; als Fenster mit einer Bedarfszeile ab 0.83)
   Knopf „Bearbeiten“ oben in der Liste: Bedarfe anklicken (oder „Alle“), dann „… bearbeiten“. Es öffnet sich ein Fenster, so breit wie die Liste,
   darin eine leere Zeile wie ein Bedarf. Sie wird genauso bearbeitet wie jede Zeile: Summe, Ort, Ansprechperson, Deadline, Prio-Stern, jede
   Freigabe einzeln (unverändert → freigegeben → in Bearbeitung → abgelehnt → offen → unverändert; „alle freigeben“ im Spaltenkopf), Förderer
   mit Betrag, Stand und Verwendungsnachweis, Spendenübergabe. Förderer, die bei allen ausgewählten stehen, sind schon da – bei ihnen gilt
   nur, was angeklickt oder eingetragen wird (Stand, Betrag, Nachweis, Frist, ob sie bei der Übergabe dabei sind). „Übertragen“ setzt das bei
   allen; alles andere bleibt, wie es ist. Ein Schritt: „Rückgängig“ nimmt alles auf einmal zurück. */

const ICON_MEHR = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="3.5" height="3.5" rx=".8"/><rect x="2" y="9.5" width="3.5" height="3.5" rx=".8"/><path d="M8 4.2h6M8 11.2h6M2.8 4.3l.8.8 1.4-1.6M2.8 11.3l.8.8 1.4-1.6"/></g></svg>';
let MEHR_STILL = false;                                               // beim Übertragen: keine Einzelhinweise (ein Hinweis am Ende)
// T: die Zeile im Fenster; T0: ihr Anfangsstand; beruehrt: angeklickte Schalter (prio, fr.k, ang, foe.id, amt.id, vn.id, vnf.id);
// gemein: Förderer (id in T), die bei allen stehen; ue: je Förderer der Vorlage, ob er bei der Übergabe dabei ist (dabei, kommt, weg)
const MEHR = { T: null, T0: null, beruehrt: new Set(), gemein: new Set(), ue: new Map() };
const istVorlage = id => !!MEHR.T && id === MEHR.T.id;
const bedarfVon = id => istVorlage(id) ? MEHR.T : D.bedarfe.find(x => x.id === id);
const vorlageBeruehrt = k => { if (MEHR.T) MEHR.beruehrt.add(k); };

const mehrKnopf = () => UI.tab === 'archiv' ? '' : `<button class="heute-btn paket-btn" data-act="mehr-wahl" title="Mehrere Bedarfe auf einmal bearbeiten: anklicken, dann gemeinsam bearbeiten">${ICON_MEHR}<span>Bearbeiten</span></button>`;
const mehrText = n => n ? n + (n === 1 ? ' Bedarf' : ' Bedarfe') + ' bearbeiten …' : 'Bearbeiten …';
function mehrLeiste() {
  const n = UI.mehrWahl.size;
  return `<span class="heute-hw"><b>Bedarfe anklicken</b></span><button class="small" data-act="mehr-alle" title="alle Bedarfe, die gerade in der Liste stehen (mit Suche und Filtern)">Alle</button><button class="primary small" data-act="mehr-los"${n ? '' : ' disabled'}>${mehrText(n)}</button><button class="undo-btn" data-act="mehr-leer" title="Auswahl aufheben – alle Haken weg" aria-label="Auswahl aufheben">↶</button><button class="link" data-act="mehr-ende" title="Bearbeiten beenden (Esc)">Beenden</button>`;
}
function mehrZahl() { const k = $('[data-act="mehr-los"]'), n = UI.mehrWahl ? UI.mehrWahl.size : 0; if (k) { k.disabled = !n; k.textContent = mehrText(n); } }
function mehrWaehlen(an) { closeMenus(); UI.auf = null; UI.heuteWahl = null; UI.paketWahl = null; UI.mehrWahl = an ? new Set() : null; MEHR.T = null; ORDER.ids = null; keep(renderNow); }
function mehrLeeren() { if (UI.mehrWahl) { UI.mehrWahl.clear(); keep(renderNow); } }

// die Zeile im Fenster: leer wie ein neuer Bedarf, dazu die Förderer, die bei allen ausgewählten stehen
function vorlageNeu(B) {
  const T = blank(); T.id = 'vorlage';
  const M = new Map(); for (const b of B) for (const f of b.foerderer) if (f.name.trim()) { const k = kkey(f.name), x = M.get(k) || { f, bei: new Set(), st: new Set() }; x.bei.add(b.id); x.st.add(f.status); M.set(k, x); }
  MEHR.gemein = new Set(); MEHR.ue = new Map(); MEHR.beruehrt = new Set();
  for (const x of M.values()) if (x.bei.size === B.length) {
    const f = ff({ name: x.f.name.trim(), status: x.st.size === 1 ? [...x.st][0] : 'geplant' }); T.foerderer.push(f); MEHR.gemein.add(f.id);
    if (f.status === 'zugesagt') T.nach.ueb.mit.push(f.id);
  }
  MEHR.T = T; MEHR.T0 = JSON.parse(JSON.stringify(T));
}
// Freigaben der Vorlage: nicht angeklickt = unverändert
const FR_VL = { ok: 'freigegeben', angefragt: 'in Bearbeitung', nein: 'abgelehnt', offen: 'offen' }, FR_VL_ROT = ['ok', 'angefragt', 'nein', 'offen'];
function vorlageFreigabe(T) {
  return [['ofk', 'Ortsführungskreis'], ['verw', 'Verwaltung'], ['fach', 'Fachreferat']].map(([k, lab]) => {
    const an = MEHR.beruehrt.has('fr.' + k), st = T.freigabe[k].st;
    return `<div class="ml${an ? '' : ' mv-unv'}" data-le="fr" data-k="${k}" title="${an ? FR_VL[st] : 'unverändert'} – klicken: ${an ? (st === 'offen' ? 'wieder unverändert' : FR_VL[FR_VL_ROT[FR_VL_ROT.indexOf(st) + 1]]) : 'freigegeben'}">${an ? mi(({ ok: 'ok', angefragt: 'run', nein: 'no' })[st] || 'off', FR_VL[st]) : mi('none')}<span>${lab}${an ? ' <i class="mv-st">' + FR_VL[st] + '</i>' : ' <i class="mv-st muted">unverändert</i>'}</span></div>`;
  }).join('');
}
function vorlageFrKlick(T, k) {
  const it = T.freigabe[k], key = 'fr.' + k;
  if (!MEHR.beruehrt.has(key)) { MEHR.beruehrt.add(key); it.st = 'ok'; }
  else if (it.st === 'offen') { MEHR.beruehrt.delete(key); it.st = 'offen'; }
  else it.st = FR_VL_ROT[FR_VL_ROT.indexOf(it.st) + 1];
}
function vorlageAlleFrei(T) { for (const k of ['ofk', 'fach', 'verw']) { MEHR.beruehrt.add('fr.' + k); T.freigabe[k].st = 'ok'; } }
// Spendenübergabe je Förderer der Vorlage: unverändert → dabei → kommt → nicht dabei → unverändert
const UE_VL = [undefined, 'dabei', 'kommt', 'weg'], UE_VL_T = { dabei: 'soll dabei sein', kommt: 'kommt (Einladung raus, Zusage)', weg: 'nicht dabei' };
function vorlagePunkt(f) {
  const z = MEHR.ue.get(f.id), nx = UE_VL[(UE_VL.indexOf(z) + 1) % UE_VL.length];
  return `<span class="ue-weg mv-ue${z === 'kommt' ? ' an ok' : ''}"><i class="ue-pkt${z === 'kommt' ? ' ok' : z === 'weg' ? ' mv-weg' : z ? '' : ' mv-leer'}" data-le="ue-mit" data-fid="${f.id}" title="Spendenübergabe: ${z ? UE_VL_T[z] : 'unverändert'} – klicken: ${nx ? UE_VL_T[nx] : 'unverändert'}"></i></span>`;
}
const vorlageUeKlick = fid => { const z = MEHR.ue.get(fid), nx = UE_VL[(UE_VL.indexOf(z) + 1) % UE_VL.length]; if (nx) MEHR.ue.set(fid, nx); else MEHR.ue.delete(fid); };

// Zeile im Fenster: immer ausführlich, ohne Namen und ohne Sprung auf eine Seite
function vorlageZeile() {
  const a = UI.ansicht; UI.ansicht = 'voll';
  try {
    const n = UI.mehrWahl ? UI.mehrWahl.size : 0;
    return row(MEHR.T).replace('<tr data-act="open" ', '<tr data-vorlage="1" ').replace(/<button class="zu-det"[^>]*><\/button>/, '')
      .replace('<span class="le-w" data-le="titel"><span class="ph">Name des Bedarfs</span></span>', `<span class="mv-t">${n} ${n === 1 ? 'Bedarf' : 'Bedarfe'}</span><span class="mv-s">Eingetragenes gilt für alle</span>`);
  } finally { UI.ansicht = a; }
}
const zeileHtml = b => b === MEHR.T ? vorlageZeile() : row(b);                  // Zeile neu zeichnen – die Vorlage mit ihrer Beschriftung

async function mehrDialog() {
  const B = D.bedarfe.filter(b => UI.mehrWahl && UI.mehrWahl.has(b.id)); if (!B.length) { toast('Erst Bedarfe anklicken.', 'warn'); return; }
  vorlageNeu(B);
  const kopf = `<thead><tr><th class="l-star"></th><th>Bedarf</th><th>Summe</th><th>Ort</th><th class="l-fr">Freigabe <button type="button" class="link small mv-alle">alle freigeben</button></th>`
    + `<th class="l-fin"><div class="fg fg-h"><span>Finanzierungsplan</span><span>Verwendungsnachweis</span></div></th><th class="l-ueb">Spendenübergabe</th></tr></thead>`;
  const tab = h('div', { class: 'tablewrap mv-wrap', html: `<table class="list mv-tab">${kopf}<tbody id="mehr-body">${vorlageZeile()}</tbody></table>` });
  tab.addEventListener('click', e => {
    if (e.target.closest('.le-edit, .le-new, .ue-form')) return;
    if (e.target.closest('.mv-alle')) { vorlageAlleFrei(MEHR.T); relist(MEHR.T); return; }
    const el = e.target.closest('[data-le]'); if (!el || !MEHR.T) return;
    e.preventDefault(); strgAct(MEHR.T, el);
  });
  const breite = Math.min(innerWidth - 32, Math.max(900, ($('table.list') || {}).offsetWidth || 1200) + 40);
  const ok = await modal(B.length === 1 ? '1 Bedarf bearbeiten' : B.length + ' Bedarfe gemeinsam bearbeiten', h('div', { class: 'mv' },
    h('p', { class: 'muted small' }, 'Was du in der Zeile einträgst oder anklickst, wird bei allen ' + B.length + ' gesetzt; alles andere bleibt bei jedem Bedarf, wie es ist. '
      + (MEHR.gemein.size ? 'Die Förderer, die bei allen stehen, sind schon eingetragen – bei ihnen gilt nur, was du anklickst.' : 'Neue Förderer mit dem „+“ im Finanzierungsplan.')), tab),
    [['Abbrechen', false], ['Übertragen', true, 'primary']], { wide: true, cls: 'mv-modal', expose: () => setTimeout(() => { const m = $('.modal.mv-modal'); if (m) m.style.maxWidth = breite + 'px'; }, 0) });
  closeMenus();
  if (!ok) { MEHR.T = null; return; }
  const vorher = JSON.stringify(D), R = mehrAnwenden(B, MEHR.T);
  MEHR.T = null;
  if (!R.n) { toast('Nichts geändert – es war nichts eingetragen, oder bei allen stand es schon so.', 'warn'); return; }
  UI.mehrWahl = null; ORDER.ids = null; keep(renderNow);
  toast(R.n + (R.n === 1 ? ' Bedarf' : ' Bedarfe') + ' geändert' + (R.ohneBetrag ? ' · ' + R.ohneBetrag + '× Zusage ohne Betrag – bitte die Summen eintragen' : '') + (R.geld ? ' · ' + R.geld + '× Geld schon eingegangen, Stand nicht geändert' : ''), R.ohneBetrag || R.geld ? 'warn' : 'ok', undoGanz(vorher));
}
// setzt, was in der Vorlage T steht, bei allen; zählt geänderte Bedarfe, Zusagen ohne Betrag und Förderer, bei denen das Geld schon da ist
function mehrAnwenden(B, T) {
  const T0 = MEHR.T0, R = { n: 0, ohneBetrag: 0, geld: 0 }, an = k => MEHR.beruehrt.has(k), u0 = T0.nach.ueb, vn0 = JSON.stringify(ff({}).vn);
  const status = (b, f, v) => { if (f.status === v) return; if (geldDa(f)) { R.geld++; return; } const alt = f.status; f.status = v; effects(b, f, 'status', v, alt); if (v === 'zugesagt' && !foeAmt(f)) R.ohneBetrag++; };
  MEHR_STILL = true;
  try {
    for (const b of B) {
      const vor = JSON.stringify(b);
      if (an('prio')) b.prio = T.prio;
      if (T.summe != null && T.summe !== '') b.summe = T.summe;
      if (T.gliederung.trim()) b.gliederung = T.gliederung;
      if (T.zust[0] && T.zust[0].n.trim()) b.zust = zustVorn(b, T.zust[0].n.trim());
      if (T.deadline) b.deadline = T.deadline;
      if (T.eigenanteil != null && T.eigenanteil !== '') b.eigenanteil = T.eigenanteil;
      for (const k of ['ofk', 'fach', 'verw']) {
        if (!an('fr.' + k) || (k === 'ofk' && istDio(b.gliederung))) continue;
        const alt = b.freigabe[k].st, v = T.freigabe[k].st; if (alt !== v) { b.freigabe[k].st = v; effects(b, b, 'freigabe.' + k + '.st', v, alt); }
      }
      if (an('ang')) { const u = angebotUL(b), t = angebotUL(T); if (u && t) u.st = t.st; }
      for (const tf of T.foerderer) {
        if (!tf.name.trim()) continue;
        let ex = b.foerderer.find(f => kkey(f.name) === kkey(tf.name));
        if (MEHR.gemein.has(tf.id)) {                                               // steht bei allen: nur, was angeklickt oder eingetragen wurde
          if (!ex) continue;
          if (an('foe.' + tf.id)) status(b, ex, tf.status);
          if (an('amt.' + tf.id)) { if (ex.status === 'zugesagt') ex.zugesagt = foeAmt(tf); else ex.betrag = foeAmt(tf); }
          if (an('vn.' + tf.id)) { ex.vn.noetig = tf.vn.noetig; ex.vn.st = tf.vn.st; }
          if (an('vnf.' + tf.id)) ex.vn.frist = tf.vn.frist;
        } else if (!ex) {                                                           // neu: mit allem, was in der Vorlage steht
          const f = JSON.parse(JSON.stringify(tf)), st = f.status; f.id = uid('f'); f.status = 'geplant'; b.foerderer.push(f); ex = f;
          if (st !== 'geplant') { f.status = st; effects(b, f, 'status', st, 'geplant'); if (tf.zugesagt != null) f.zugesagt = tf.zugesagt; }
          if (st === 'zugesagt' && !foeAmt(f)) R.ohneBetrag++;
        } else {                                                                    // neu eingetragen, steht aber bei diesem schon: dessen Angaben übernehmen
          if (tf.status !== 'geplant') status(b, ex, tf.status);
          if (tf.betrag != null) ex.betrag = tf.betrag;
          if (tf.zugesagt != null && ex.status === 'zugesagt') ex.zugesagt = tf.zugesagt;
          if (JSON.stringify(tf.vn) !== vn0) ex.vn = JSON.parse(JSON.stringify(tf.vn));
        }
        const z = MEHR.ue.get(tf.id), u = b.nach.ueb;                              // dabei bei der Spendenübergabe?
        if (z && ex && ex.status === 'zugesagt') {
          if (z === 'weg') u.mit = u.mit.filter(id => id !== ex.id);
          else { if (!u.mit.includes(ex.id)) u.mit.push(ex.id); if (z === 'kommt') { const e = (u.einl || {})[ex.id] || {}; u.einl = Object.assign({}, u.einl, { [ex.id]: { am: e.am || today(), zu: 'ja' } }); } }
        }
      }
      const u = b.nach.ueb, tu = T.nach.ueb;
      for (const p of ['noetig', 'st', 'termin', 'zeit', 'ort', 'info']) if (tu[p] !== u0[p]) u[p] = tu[p];
      if (JSON.stringify(b) !== vor) R.n++;
    }
  } finally { MEHR_STILL = false; }
  if (R.n) changed();
  return R;
}
