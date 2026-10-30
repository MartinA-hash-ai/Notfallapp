/* ===================================================================== Bedarfe zusammenführen (ab 0.62)
   Manchmal lohnt es sich, mehrere Bedarfe als ein Paket zu bewerben. Knopf oben in der Liste → Bedarfe anklicken → „zusammenführen …“:
   fragt Namen, Ort (wenn verschieden) und die Förderer; der neue Bedarf übernimmt Zuständige, Stichworte, die früheste Deadline, die Summe,
   je Freigabe den am wenigsten fortgeschrittenen Stand, das Fachreferat mit der größten Summe (die Personen der übrigen stehen mit dabei)
   und die Beschreibungen untereinander. Die alten werden zurückgestellt („wurde in Bedarf … zusammengeführt“). Kein Ordner-Link. */

const ICON_PAKET = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2.5v3c0 1.7 1.1 2.7 2.7 3.4L8 10v3.6M13 2.5v3c0 1.7-1.1 2.7-2.7 3.4L8 10"/><path d="M5.8 11.6L8 13.8l2.2-2.2"/></g></svg>';
const pickSet = () => UI.heuteWahl || UI.paketWahl || UI.mehrWahl;   // gerade wird ausgewählt (für heute, zum Zusammenführen oder gemeinsam Bearbeiten: 22_mehr.js)
const paketKnopf = () => UI.tab === 'archiv' ? '' : `<button class="heute-btn paket-btn" data-act="paket-wahl" title="Bedarfe zusammenführen – mehrere zu einem Paket">${ICON_PAKET}<span>Zusammenführen</span></button>`;
function paketLeiste() {
  const n = UI.paketWahl.size;
  return `<span class="heute-hw"><b>Bedarfe zum Zusammenführen anklicken</b></span><button class="primary small" data-act="paket-los"${n < 2 ? ' disabled' : ''}>${n < 2 ? 'Zusammenführen …' : n + ' zusammenführen …'}</button><button class="undo-btn" data-act="paket-leer" title="Auswahl aufheben – alle Haken weg" aria-label="Auswahl aufheben">↶</button><button class="link" data-act="paket-ende" title="Zusammenführen beenden (Esc)">Beenden</button>`;
}
function paketZahl() { const k = $('[data-act="paket-los"]'), n = UI.paketWahl ? UI.paketWahl.size : 0; if (k) { k.disabled = n < 2; k.textContent = n < 2 ? 'Zusammenführen …' : n + ' zusammenführen …'; } }
function paketWaehlen(an) { closeMenus(); UI.auf = null; UI.heuteWahl = null; UI.mehrWahl = null; UI.paketWahl = an ? new Set() : null; ORDER.ids = null; keep(renderNow); }

// Fragen: Name, Ort, Förderer – dann bauen
async function paketDialog() {
  const reihe = filtered().map(x => x.id), B = D.bedarfe.filter(b => UI.paketWahl && UI.paketWahl.has(b.id)).sort((x, y) => reihe.indexOf(x.id) - reihe.indexOf(y.id));
  if (B.length < 2) { toast('Mindestens zwei Bedarfe anklicken.', 'warn'); return; }
  const summe = B.reduce((s, b) => s + (+b.summe || 0), 0);
  const name = h('input', { type: 'text', class: 'pk-name', placeholder: 'z. B. Ausstattung Katastrophenschutz Gütersloh', 'aria-label': 'Name des neuen Bedarfs' });
  const O = []; for (const b of B) { const o = b.gliederung.trim(); if (!o) continue; let x = O.find(y => y.o === o); if (!x) O.push(x = { o, s: 0 }); x.s += +b.summe || 0; }
  let ort = O.length ? O.slice().sort((x, y) => y.s - x.s)[0].o : '';
  const ortWahl = O.length > 1 ? h('div', { class: 'pk-orte' }, O.map(x => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'pk-ort', checked: x.o === ort, onchange: () => { ort = x.o; } }), ' ' + (x.o === DIO ? 'Diözese' : x.o)))) : null;
  const F = B.flatMap(b => b.foerderer.filter(f => f.name.trim()).map(f => ({ b, f }))), ST_R = { zugesagt: 0, beantragt: 1, geplant: 2 }, best = new Map();
  for (const { f } of F) { const k = kkey(f.name), x = best.get(k); if (f.status in ST_R && (!x || ST_R[f.status] < ST_R[x.status])) best.set(k, f); }
  const an = new Set([...best.values()].map(f => f.id));            // je Förderer der am weitesten gediehene angehakt (Zusage vor Antrag vor Plan), abgelehnte nicht
  const foe = F.length ? h('div', { class: 'pk-foe' }, F.map(({ b, f }) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: an.has(f.id), onchange: e => { if (e.target.checked) an.add(f.id); else an.delete(f.id); } }),
    ' ', h('b', null, f.name.trim()), h('span', { class: 'muted small' }, ' · ' + F_ST_L[f.status] + (foeAmt(f) ? ' ' + eur(foeAmt(f)) : '') + ' · aus „' + (b.titel || 'Bedarf') + '“'))))
    : h('p', { class: 'muted small' }, 'Bei diesen Bedarfen steht noch kein Förderer.');
  const ok = await modal('Bedarfe zusammenführen', h('div', { class: 'help pk' },
    h('p', { class: 'muted small' }, B.length + ' Bedarfe, zusammen ' + eur(summe) + ': ' + B.map(b => b.titel || '(ohne Namen)').join(', ') + '. Die bisherigen werden zurückgestellt.'),
    h('h4', null, 'Name des neuen Bedarfs'), name,
    ortWahl ? h('h4', null, 'Ort – die Bedarfe haben verschiedene') : null, ortWahl,
    h('h4', null, 'Welche Förderer sollen übernommen werden?'), foe),
    [['Abbrechen', false], ['Zusammenführen', true, 'primary']], { wide: true, expose: () => setTimeout(() => name.focus(), 80) });
  if (!ok) return;
  const titel = name.value.trim() || 'Paket: ' + B.map(b => b.titel || 'Bedarf').join(' + ');
  const nb = paketBauen(B, titel, ort, F.filter(x => an.has(x.f.id)).map(x => x.f));
  D.bedarfe.unshift(nb);
  for (const b of B) { b.manuell = 'zurückgestellt'; b.grundM = 'wurde in Bedarf „' + titel + '“ zusammengeführt'; }
  UI.paketWahl = null; ORDER.ids = null; changed(); heuteDazu(nb.id);
  oeffnen(nb.id);
  toast(B.length + ' Bedarfe zu „' + titel + '“ zusammengeführt – die bisherigen sind zurückgestellt.', 'ok');
}

const FR_RANG = { nein: 0, offen: 1, angefragt: 2, ok: 3 }, UL_RANG = { fehlt: 0, arbeit: 1, da: 2, nn: 3 };
function paketBauen(B, titel, ort, F) {
  const nb = blank(), gl = b => b.gliederung === DIO ? 'Diözese' : b.gliederung;
  const summe = B.reduce((s, b) => s + (+b.summe || 0), 0);
  Object.assign(nb, { titel, gliederung: ort, summe: summe || null, summeArt: B.every(b => b.summeArt === B[0].summeArt) ? B[0].summeArt : 'Schätzung',
    prio: B.some(b => b.prio === 'hoch') ? 'hoch' : 'mittel', deadline: B.map(b => b.deadline).filter(validIso).sort()[0] || '', link: '', pfad: '' });
  const sw = []; for (const s of B.flatMap(b => b.stichworte)) if (!sw.some(x => norm(x) === norm(s))) sw.push(s);
  nb.stichworte = sw;
  // Zuständige: jeder Name einmal, fehlende Angaben aus den anderen ergänzt
  const Z = new Map();
  for (const c of B.flatMap(b => b.zust)) { const k = kkey(c.n) || norm(c.mail); if (!k) continue; const z = Z.get(k); if (!z) Z.set(k, Object.assign(leerZ(), JSON.parse(JSON.stringify(c)))); else for (const p of ['rolle', 'mail', 'tel', 'mobil']) if (!(z[p] || '').trim() && c[p]) z[p] = c[p]; }
  nb.zust = [...Z.values()].slice(0, MAX_ZUST);
  // Beschreibung: oben je Bedarf Name und Summe als Aufzählung, darunter je Bedarf Name, Summe und Text – getrennt durch eine Linie
  const kurz = b => (b.titel || '(ohne Namen)') + ', ' + (b.summe ? eur(b.summe) : 'ohne Summe') + (b.gliederung ? ' (' + gl(b) + ')' : '');
  nb.beschreibung = B.map(b => '* ' + kurz(b)).join('\n') + '\n\n' + B.map(b => '*' + kurz(b) + '*\n' + (b.beschreibung.trim() || '(ohne Beschreibung)')).join('\n---------------\n');
  // Freigaben: je Stelle der Stand, der am wenigsten weit ist (abgelehnt zählt zuerst); Notizen mit dem Namen des Bedarfs
  for (const k of ['ofk', 'fach', 'verw']) {
    const I = B.map(b => b.freigabe[k]), r = Math.min(...I.map(i => FR_RANG[i.st] ?? 1)), M = I.filter(i => (FR_RANG[i.st] ?? 1) === r), x = nb.freigabe[k];
    x.st = M[0].st; x.angefragt = M.map(i => i.angefragt).filter(validIso).sort()[0] || ''; x.erledigt = M.map(i => i.erledigt).filter(validIso).sort().pop() || '';
    x.notiz = B.filter(b => (b.freigabe[k].notiz || '').trim()).map(b => (b.titel || 'Bedarf') + ': ' + b.freigabe[k].notiz.trim()).join('\n');
  }
  // Fachreferat: das mit der größten Summe; die Personen aller Bedarfe (auch der anderen Fachreferate) stehen mit dabei
  const FS = new Map();
  for (const b of B) { const n = b.freigabe.fach.name.trim(); if (!n) continue; const x = FS.get(norm(n)) || { n, s: 0, B: [] }; x.s += +b.summe || 0; x.B.push(b); FS.set(norm(n), x); }
  const haupt = [...FS.values()].sort((x, y) => y.s - x.s)[0];
  if (haupt) {
    const f = nb.freigabe.fach, P = new Map();
    f.name = haupt.n; f.stern = (haupt.B.find(b => b.freigabe.fach.stern) || { freigabe: { fach: {} } }).freigabe.fach.stern || '';
    for (const b of B) for (const p of fachZeig(b).Z) if (!P.has(kkey(p.n))) P.set(kkey(p.n), fachKopie(p));
    f.pers = [...P.values()]; f.aus = fachPersonen(haupt.n).map(p => kkey(p.n)).filter(k => !P.has(k)); f.fuer = norm(haupt.n);
  }
  // Unterlagen: je Name der Stand, der am wenigsten weit ist
  const U = new Map();
  for (const u of B.flatMap(b => b.unterlagen)) { const k = norm(u.name), x = U.get(k); if (!x) U.set(k, Object.assign({}, u, { id: uid('u') })); else if ((UL_RANG[u.st] ?? 0) < (UL_RANG[x.st] ?? 0)) x.st = u.st; }
  nb.unterlagen = [...nb.unterlagen.map(u => U.get(norm(u.name)) || u), ...[...U.values()].filter(u => !FEST_UL.some(n => norm(n) === norm(u.name)))];
  // Förderer: die gewählten als Kopie; Eigenmittel zusammengezählt
  nb.foerderer = F.map(f => Object.assign(JSON.parse(JSON.stringify(f)), { id: uid('f') }));
  const E = B.map(b => b.eigenanteil).filter(v => v != null);
  nb.eigenanteil = E.length ? E.reduce((s, v) => s + (+v || 0), 0) : null;
  return nb;
}
