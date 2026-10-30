/* ===================================================================== Mehrere Bedarfe gemeinsam bearbeiten (ab 0.80, als Vorlagenzeile ab 0.82)
   Knopf „Bearbeiten“ oben in der Liste: Bedarfe anklicken (oder „Alle“). Ganz oben steht dann eine leere Zeile wie ein Bedarf – die Vorlage.
   Sie wird genauso bearbeitet wie jede Zeile (ausführlich oder kompakt): Summe, Ort, Ansprechperson, Deadline, Prio-Stern, jede Freigabe einzeln
   (kompakt: ein Klick auf „Freigabe“ gibt alle frei), Förderer mit Betrag, Stand und Verwendungsnachweis, Spendenübergabe.
   „Auf … übertragen“ setzt bei allen ausgewählten genau das, was in der Vorlage eingetragen bzw. angeklickt wurde – alles andere bleibt,
   wie es ist. Förderer der Vorlage kommen dazu; steht derselbe Förderer schon beim Bedarf, werden nur seine Angaben aus der Vorlage übernommen.
   Ein Schritt: „Rückgängig“ nimmt alles auf einmal zurück. */

const ICON_MEHR = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="3.5" height="3.5" rx=".8"/><rect x="2" y="9.5" width="3.5" height="3.5" rx=".8"/><path d="M8 4.2h6M8 11.2h6M2.8 4.3l.8.8 1.4-1.6M2.8 11.3l.8.8 1.4-1.6"/></g></svg>';
let MEHR_STILL = false;                                               // beim Übertragen: keine Einzelhinweise (ein Hinweis am Ende)
const MEHR = { T: null, T0: null, beruehrt: new Set() };              // Vorlage, ihr Anfangsstand, angeklickte Schalter (Prio, Freigaben, Angebot)
const istVorlage = id => !!MEHR.T && id === MEHR.T.id;
const bedarfVon = id => istVorlage(id) ? MEHR.T : D.bedarfe.find(x => x.id === id);
function vorlageNeu() { const T = blank(); T.id = 'vorlage'; MEHR.T = T; MEHR.T0 = JSON.parse(JSON.stringify(T)); MEHR.beruehrt = new Set(); }

const mehrKnopf = () => UI.tab === 'archiv' ? '' : `<button class="heute-btn paket-btn" data-act="mehr-wahl" title="Mehrere Bedarfe auf einmal bearbeiten: Bedarfe anklicken, oben in der leeren Zeile eintragen, übertragen">${ICON_MEHR}<span>Bearbeiten</span></button>`;
const mehrText = n => n ? 'Auf ' + n + ' übertragen' : 'Übertragen';
function mehrLeiste() {
  const n = UI.mehrWahl.size;
  return `<span class="heute-hw"><b>Bedarfe anklicken, oben eintragen</b></span><button class="small" data-act="mehr-alle" title="alle Bedarfe, die gerade in der Liste stehen (mit Suche und Filtern)">Alle</button><button class="primary small" data-act="mehr-los"${n ? '' : ' disabled'} title="Was in der Zeile oben eingetragen oder angeklickt ist, bei allen ausgewählten setzen">${mehrText(n)}</button><button class="undo-btn" data-act="mehr-leer" title="Vorlage und Auswahl leeren" aria-label="Vorlage und Auswahl leeren">↶</button><button class="link" data-act="mehr-ende" title="Bearbeiten beenden (Esc)">Beenden</button>`;
}
const vorlageFuer = n => n ? 'gilt für ' + n + (n === 1 ? ' ausgewählten Bedarf' : ' ausgewählte Bedarfe') : 'erst Bedarfe anklicken';
function mehrZahl() {
  const k = $('[data-act="mehr-los"]'), s = $('#list-body tr[data-vorlage] .mv-s'), n = UI.mehrWahl ? UI.mehrWahl.size : 0;
  if (k) { k.disabled = !n; k.textContent = mehrText(n); } if (s) s.textContent = vorlageFuer(n);
}
function mehrWaehlen(an) {
  closeMenus(); UI.auf = null; UI.heuteWahl = null; UI.paketWahl = null; UI.mehrWahl = an ? new Set() : null;
  if (an) vorlageNeu(); else MEHR.T = null;
  ORDER.ids = null; keep(renderNow);
}
function mehrLeeren() { if (!UI.mehrWahl) return; UI.mehrWahl.clear(); vorlageNeu(); if (UI.auf === 'vorlage') UI.auf = null; keep(renderNow); }

// die Vorlage als Zeile ganz oben in der Liste: wie ein Bedarf, nur ohne Namen und ohne Sprung auf eine Seite
function vorlageZeile() {
  const T = MEHR.T, n = UI.mehrWahl.size;
  return row(T).replace('<tr ', '<tr data-vorlage="1" ').replace(/<button class="zu-det"[^>]*><\/button>/, '')
    .replace('<span class="le-w" data-le="titel"><span class="ph">Name des Bedarfs</span></span>', `<span class="mv-t">Vorlage</span><span class="mv-s">${vorlageFuer(n)}</span>`)
    .replace('<td class="k-fr">', '<td class="k-fr" data-le="fr-alle" title="Klicken: alle Freigaben erteilt – noch einmal: wieder unverändert">');
}
// Schalter der Vorlage (in strgAct): angeklickt merken – auch wenn er wieder auf dem Anfangsstand steht, gilt er dann als gewählt
function vorlageBeruehrt(k) { if (MEHR.T) MEHR.beruehrt.add(k); }
function vorlageAlleFrei(T) {
  const alle = ['ofk', 'fach', 'verw'].every(k => T.freigabe[k].st === 'ok');
  for (const k of ['ofk', 'fach', 'verw']) { T.freigabe[k].st = alle ? 'offen' : 'ok'; if (alle) MEHR.beruehrt.delete('fr.' + k); else MEHR.beruehrt.add('fr.' + k); }
}

async function mehrUebertragen() {
  const B = D.bedarfe.filter(b => UI.mehrWahl && UI.mehrWahl.has(b.id)); if (!B.length) { toast('Erst Bedarfe anklicken.', 'warn'); return; }
  const vorher = JSON.stringify(D), R = mehrAnwenden(B, MEHR.T);
  if (!R.n) { toast('Nichts geändert – in der Vorlage ist noch nichts eingetragen, oder bei allen stand es schon so.', 'warn'); return; }
  UI.mehrWahl = null; MEHR.T = null; UI.auf = null; ORDER.ids = null; keep(renderNow);
  toast(R.n + (R.n === 1 ? ' Bedarf' : ' Bedarfe') + ' geändert' + (R.ohneBetrag ? ' · ' + R.ohneBetrag + '× Zusage ohne Betrag – bitte die Summen eintragen' : '') + (R.geld ? ' · ' + R.geld + '× Geld schon eingegangen, Stand nicht geändert' : ''), R.ohneBetrag || R.geld ? 'warn' : 'ok', undoGanz(vorher));
}
// setzt, was in der Vorlage T steht, bei allen; zählt geänderte Bedarfe, Zusagen ohne Betrag und Förderer, bei denen das Geld schon da ist
function mehrAnwenden(B, T) {
  const T0 = MEHR.T0 || JSON.parse(JSON.stringify(blank())), R = { n: 0, ohneBetrag: 0, geld: 0 }, an = k => MEHR.beruehrt.has(k);
  const u0 = T0.nach.ueb, vn0 = JSON.stringify(ff({}).vn);
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
        const ex = b.foerderer.find(f => kkey(f.name) === kkey(tf.name));
        if (!ex) {                                                                  // neu: mit allem, was in der Vorlage steht
          const f = JSON.parse(JSON.stringify(tf)), st = f.status; f.id = uid('f'); f.status = 'geplant'; b.foerderer.push(f);
          if (st !== 'geplant') { f.status = st; effects(b, f, 'status', st, 'geplant'); if (tf.zugesagt != null) f.zugesagt = tf.zugesagt; }
          if (st === 'zugesagt' && !foeAmt(f)) R.ohneBetrag++;
          continue;
        }
        if (tf.status !== 'geplant' && ex.status !== tf.status) {                   // schon da: nur, was in der Vorlage eingetragen ist
          if (geldDa(ex)) R.geld++;
          else { const alt = ex.status; ex.status = tf.status; effects(b, ex, 'status', tf.status, alt); if (tf.status === 'zugesagt' && !foeAmt(ex)) R.ohneBetrag++; }
        }
        if (tf.betrag != null) ex.betrag = tf.betrag;
        if (tf.zugesagt != null && ex.status === 'zugesagt') ex.zugesagt = tf.zugesagt;
        if (JSON.stringify(tf.vn) !== vn0) ex.vn = JSON.parse(JSON.stringify(tf.vn));
      }
      const u = b.nach.ueb, tu = T.nach.ueb;
      for (const p of ['noetig', 'st', 'termin', 'zeit', 'ort', 'info']) if (tu[p] !== u0[p]) u[p] = tu[p];
      if (JSON.stringify(b) !== vor) R.n++;
    }
  } finally { MEHR_STILL = false; }
  if (R.n) changed();
  return R;
}
const zeileHtml = b => b === MEHR.T ? vorlageZeile() : row(b);                  // Zeile neu zeichnen – die Vorlage mit ihrer Beschriftung
