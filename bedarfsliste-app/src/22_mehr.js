/* ===================================================================== Mehrere Bedarfe gemeinsam bearbeiten (ab 0.80)
   Knopf „Bearbeiten“ oben in der Liste → Bedarfe anklicken (oder „Alle“) → „… bearbeiten“: ein Fenster, in dem alles auf „unverändert“
   steht; nur was man dort wählt, wird bei allen angeklickten gesetzt – Priorität, die drei Freigaben, Förderer (neuen hinzufügen,
   vorhandene auf einen Stand setzen, z. B. „zugesagt“, oder entfernen). Ein Schritt: „Rückgängig“ nimmt alles auf einmal zurück. */

const ICON_MEHR = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="3.5" height="3.5" rx=".8"/><rect x="2" y="9.5" width="3.5" height="3.5" rx=".8"/><path d="M8 4.2h6M8 11.2h6M2.8 4.3l.8.8 1.4-1.6M2.8 11.3l.8.8 1.4-1.6"/></g></svg>';
let MEHR_STILL = false;                                               // beim gemeinsamen Setzen: keine Einzelhinweise (ein Hinweis am Ende)
const mehrKnopf = () => UI.tab === 'archiv' ? '' : `<button class="heute-btn paket-btn" data-act="mehr-wahl" title="Mehrere Bedarfe auf einmal bearbeiten – Priorität, Freigaben, Förderer">${ICON_MEHR}<span>Bearbeiten</span></button>`;
const mehrText = n => n ? n + ' bearbeiten …' : 'Bearbeiten …';
function mehrLeiste() {
  const n = UI.mehrWahl.size;
  return `<span class="heute-hw"><b>Bedarfe zum Bearbeiten anklicken</b></span><button class="small" data-act="mehr-alle" title="alle Bedarfe, die gerade in der Liste stehen (mit Suche und Filtern)">Alle</button><button class="primary small" data-act="mehr-los"${n ? '' : ' disabled'}>${mehrText(n)}</button><button class="undo-btn" data-act="mehr-leer" title="Auswahl aufheben – alle Haken weg" aria-label="Auswahl aufheben">↶</button><button class="link" data-act="mehr-ende" title="Bearbeiten beenden (Esc)">Beenden</button>`;
}
function mehrZahl() { const k = $('[data-act="mehr-los"]'), n = UI.mehrWahl ? UI.mehrWahl.size : 0; if (k) { k.disabled = !n; k.textContent = mehrText(n); } }
function mehrWaehlen(an) { closeMenus(); UI.auf = null; UI.heuteWahl = null; UI.paketWahl = null; UI.mehrWahl = an ? new Set() : null; ORDER.ids = null; keep(renderNow); }

// Wahl im Fenster: Knöpfe nebeneinander, der erste („unverändert“) ist vorgewählt
function wahlZeile(titel, O, setze, hinweis) {
  const seg = h('div', { class: 'seg small mw-seg', role: 'group', 'aria-label': titel }, ...O.map(([v, l], i) => h('button', { type: 'button', class: i ? '' : 'on', onclick: e => {
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === e.currentTarget)); setze(v); } }, l)));
  return h('div', { class: 'mw-z' }, h('span', { class: 'mw-l' }, titel, hinweis ? h('span', { class: 'muted small' }, ' ' + hinweis) : null), seg);
}
const MW_FR = [[null, 'unverändert'], ['offen', 'offen'], ['angefragt', 'in Bearbeitung'], ['ok', 'freigegeben'], ['nein', 'abgelehnt']];
const MW_FOE = [['', '– unverändert –'], ['geplant', 'geplant'], ['beantragt', 'beantragt'], ['zugesagt', 'zugesagt'], ['abgelehnt', 'abgelehnt'], ['weg', 'entfernen']];
async function mehrDialog() {
  const B = D.bedarfe.filter(b => UI.mehrWahl && UI.mehrWahl.has(b.id)); if (!B.length) { toast('Erst Bedarfe anklicken.', 'warn'); return; }
  const w = { prio: null, fr: {}, foe: new Map(), alle: '', neu: null };
  // vorhandene Förderer (je Name einmal) mit „bei x von n“
  const F = new Map(); for (const b of B) for (const f of b.foerderer) if (f.name.trim()) { const k = kkey(f.name), x = F.get(k) || { n: f.name.trim(), bei: new Set(), st: new Set() }; x.bei.add(b.id); x.st.add(F_ST_L[f.status]); F.set(k, x); }
  const sel = (aria, set) => { const s = h('select', { 'aria-label': aria, onchange: e => set(e.target.value) }, ...MW_FOE.map(([v, l]) => h('option', { value: v }, l))); return s; };
  const foeZeilen = [...F].sort((a, c) => c[1].bei.size - a[1].bei.size || a[1].n.localeCompare(c[1].n, 'de')).map(([k, x]) => h('div', { class: 'mw-f' },
    h('span', { class: 'mw-fn' }, h('b', {}, x.n), h('span', { class: 'muted small' }, ' · bei ' + x.bei.size + ' von ' + B.length + ' · ' + [...x.st].join(', '))), sel('Stand für ' + x.n, v => { if (v) w.foe.set(k, v); else w.foe.delete(k); })));
  const nName = h('input', { type: 'text', placeholder: 'Name des Förderers', 'aria-label': 'Neuer Förderer', list: $('#dl-kartei') ? 'dl-kartei' : null });
  const nBetrag = h('input', { type: 'text', inputmode: 'decimal', class: 'num', placeholder: 'Betrag je Bedarf', 'aria-label': 'Betrag je Bedarf' });
  const nSt = h('select', { 'aria-label': 'Stand des neuen Förderers' }, ...F_ST.map(([v, l]) => h('option', { value: v }, l)));
  const ok = await modal(B.length === 1 ? '1 Bedarf bearbeiten' : B.length + ' Bedarfe gemeinsam bearbeiten', h('div', { class: 'help mw' },
    h('p', { class: 'muted small' }, B.map(b => b.titel || '(ohne Namen)').join(', ') + '. Was auf „unverändert“ bleibt, bleibt bei jedem Bedarf, wie es ist.'),
    h('h4', {}, 'Priorität'), wahlZeile('Prio', [[null, 'unverändert'], ['hoch', 'Prio setzen'], ['mittel', 'Prio entfernen']], v => { w.prio = v; }),
    h('h4', {}, 'Freigaben'),
    ...['ofk', 'fach', 'verw'].map(k => wahlZeile(FR_DEF[k].label, MW_FR, v => { if (v) w.fr[k] = v; else delete w.fr[k]; }, k === 'ofk' && B.some(b => istDio(b.gliederung)) ? '(entfällt bei Bedarfen der Diözese)' : '')),
    h('h4', {}, 'Förderer, die schon eingetragen sind'),
    F.size ? h('div', { class: 'mw-fl' }, h('div', { class: 'mw-f mw-alle' }, h('span', { class: 'mw-fn' }, h('b', {}, 'Alle Förderer'), h('span', { class: 'muted small' }, ' · gilt, wo unten nichts anderes gewählt ist')), sel('Stand für alle Förderer', v => { w.alle = v; })), ...foeZeilen)
      : h('p', { class: 'muted small' }, 'Bei diesen Bedarfen steht noch kein Förderer.'),
    h('h4', {}, 'Förderer hinzufügen'), h('div', { class: 'mw-neu' }, nName, nSt, nBetrag),
    h('p', { class: 'muted small' }, 'Steht er bei einem Bedarf schon, wird er dort nicht doppelt eingetragen.')),
    [['Abbrechen', false], ['Übernehmen', true, 'primary']], { wide: true });
  if (!ok) return;
  if (nName.value.trim()) w.neu = { name: nName.value.trim(), st: nSt.value, betrag: zahlOderLeer(nBetrag.value) };
  const vorher = JSON.stringify(D), R = mehrAnwenden(B, w);
  if (!R.n) { toast('Nichts geändert – alles stand schon so.', 'ok'); return; }
  UI.mehrWahl = null; ORDER.ids = null; keep(renderNow);
  toast(R.n + (R.n === 1 ? ' Bedarf' : ' Bedarfe') + ' geändert' + (R.ohneBetrag ? ' · ' + R.ohneBetrag + '× Zusage ohne Betrag – bitte die Summen eintragen' : '') + (R.geld ? ' · ' + R.geld + '× Geld schon eingegangen, Stand nicht geändert' : ''), R.ohneBetrag || R.geld ? 'warn' : 'ok', undoGanz(vorher));
}
// setzt das Gewählte bei allen; zählt geänderte Bedarfe, Zusagen ohne Betrag und Förderer, bei denen das Geld schon da ist (bleiben, wie sie sind)
function mehrAnwenden(B, w) {
  const R = { n: 0, ohneBetrag: 0, geld: 0 };
  MEHR_STILL = true;
  try {
    for (const b of B) {
      const vor = JSON.stringify(b);
      if (w.prio) b.prio = w.prio;
      for (const k of Object.keys(w.fr)) {
        if (k === 'ofk' && istDio(b.gliederung)) continue;
        const alt = b.freigabe[k].st; if (alt !== w.fr[k]) { b.freigabe[k].st = w.fr[k]; effects(b, b, 'freigabe.' + k + '.st', w.fr[k], alt); }
      }
      for (const f of b.foerderer.slice()) {
        const v = w.foe.get(kkey(f.name)) || w.alle; if (!v || !f.name.trim()) continue;
        if (v === 'weg') { b.foerderer = b.foerderer.filter(x => x !== f); b.nach.ueb.mit = b.nach.ueb.mit.filter(id => id !== f.id); continue; }
        if (f.status === v) continue;
        if (geldDa(f)) { R.geld++; continue; }
        const alt = f.status; f.status = v; effects(b, f, 'status', v, alt); if (v === 'zugesagt' && !foeAmt(f)) R.ohneBetrag++;
      }
      if (w.neu && !b.foerderer.some(f => kkey(f.name) === kkey(w.neu.name))) {
        const f = ff({ name: w.neu.name, betrag: w.neu.betrag }); b.foerderer.push(f);
        if (w.neu.st !== 'geplant') { f.status = w.neu.st; effects(b, f, 'status', w.neu.st, 'geplant'); if (w.neu.st === 'zugesagt' && !foeAmt(f)) R.ohneBetrag++; }
      }
      if (JSON.stringify(b) !== vor) R.n++;
    }
  } finally { MEHR_STILL = false; }
  if (R.n) changed();
  return R;
}
