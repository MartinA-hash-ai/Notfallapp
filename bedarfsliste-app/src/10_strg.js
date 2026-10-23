/* ===================================================================== In der Liste direkt bearbeiten – das ist der Normalzustand; mit gedrückter Strg-Taste öffnet ein Klick den Bedarf.
   Name, Summe, Ort, Ansprechperson, Deadline, Beträge und Eigenmittel werden per Klick zum schlichten Feld an derselben Stelle (Vorschläge beim Tippen);
   Freigabe, Angebot, Stand der Förderer und Verwendungsnachweis drehen per Klick einen Stand weiter; über dem Finanzierungsplan unten links ein + für weitere Förderer,
   am Ende des Förderernamens ein Stift zum Umbenennen, beim Nachweis ein Kalender für die Frist; bei der Spendenübergabe ein Kreis mit Stift, der Ort,
   Datum, Uhrzeit und Notizen zum Eintragen öffnet. „+ Bedarf“ legt eine neue Zeile oben in der Liste an und führt durch Name, Summe, Ort, Ansprechperson und Deadline. */

// STRG: Bearbeiten aktiv (Liste, Strg nicht gedrückt). Der Name stammt aus der Zeit, als es umgekehrt war.
let STRG = false, CTRL_NOW = false;
function strgSet(ctrl) {
  CTRL_NOW = !!ctrl;
  STRG = !ctrl && UI.view === 'list';
  document.body.classList.toggle('strg', STRG);
}
// nach einer Änderung: beim Bearbeiten nur die Zeile neu zeichnen (Reihenfolge bleibt), sonst die ganze Liste
function relist(b) {
  const tr = STRG && $(`#list-body tr[data-id="${CSS.escape(b.id)}"]`);
  if (tr) { tr.outerHTML = row(b); aufMass(); } else keep(renderNow);
}
// Zustand der Taste auch an jeder anderen Taste und jedem Klick ablesen (ein offener Kalender schluckt das Loslassen)
document.addEventListener('keydown', e => strgSet(e.key === 'Control' || e.key === 'Meta' || e.ctrlKey || e.metaKey));
document.addEventListener('pointerdown', e => strgSet(e.ctrlKey || e.metaKey), true);
document.addEventListener('keyup', e => { if (e.key === 'Control' || e.key === 'Meta') strgSet(false); });
document.addEventListener('mousemove', e => strgSet(e.ctrlKey || e.metaKey), { passive: true });
window.addEventListener('blur', () => strgSet(false));

// Klicks in offene Felder öffnen nicht den Bedarf (erst nach Feld und Knöpfen anhalten, damit „fertig“ wirkt)
const leStop = el => el.addEventListener('click', e => e.stopPropagation());

// je Klick ein Stand weiter
const ROT_FR = ['offen', 'angefragt', 'ok', 'nein'], ROT_ANG = ['fehlt', 'arbeit', 'da'];
const ROT_FOE = { geplant: 'beantragt', beantragt: 'zugesagt', zugesagt: 'abgelehnt', abgelehnt: 'geplant' };
const nextOf = (L, v) => L[(L.indexOf(v) + 1) % L.length];

// kompakte Ansicht: Strg+Klick klappt einen Bedarf ausführlich auf (dort wie gewohnt bearbeiten), noch einmal Strg+Klick öffnet ihn;
// ein Klick irgendwo anders klappt ihn wieder zu (nicht in seinen offenen Feldern, Kalendern und Menüs)
document.addEventListener('click', e => {
  if (UI.view !== 'list' || UI.ansicht !== 'kompakt') return;
  const tr = e.target.closest('#list-body tr[data-id]');
  if ((e.ctrlKey || e.metaKey) && tr) {
    if (tr.dataset.id === UI.auf) return;                                             // schon aufgeklappt: Strg+Klick öffnet den Bedarf
    e.preventDefault(); e.stopPropagation(); aufklappen(tr.dataset.id); return;
  }
  if (UI.auf && !(tr && tr.dataset.id === UI.auf) && !e.target.closest('.menu, .cal-pop, .le-sug, .modal, .backdrop, .ue-form, #toasts, .le-edit, .le-new')) aufklappen(null);
}, true);
function aufklappen(id) {
  const alt = UI.auf; UI.auf = id;
  for (const x of [alt, id]) { const b = x && D.bedarfe.find(y => y.id === x), tr = x && $(`#list-body tr[data-id="${CSS.escape(x)}"]`); if (b && tr) tr.outerHTML = row(b); }
  aufMass();
}
// Klick in eine Zeile: bearbeiten (ein Klick neben ein Feld tut nichts); mit Strg geht er durch und öffnet den Bedarf
document.addEventListener('click', e => {
  if (UI.view !== 'list' || e.ctrlKey || e.metaKey) return;
  if (e.target.closest('.le-edit, .le-new, .ue-form')) return;                         // offene Felder halten ihre Klicks selbst zurück (le-stop)
  const tr = e.target.closest('#list-body tr[data-id]'); if (!tr) return;
  e.preventDefault(); e.stopPropagation();
  const b = D.bedarfe.find(x => x.id === tr.dataset.id), el = e.target.closest('[data-le]');
  if (b && el) strgAct(b, el);
}, true);

// then(wie): nach dem Feld – 'enter' (übernommen mit Enter oder Vorschlag), 'esc' oder 'blur'
function strgAct(b, el, then) {
  const f = el.dataset.fid ? b.foerderer.find(x => x.id === el.dataset.fid) : null, done = () => { changed(); relist(b); };
  switch (el.dataset.le) {
    case 'titel': return editField(b, el, { value: b.titel, area: true, label: 'Name des Bedarfs', feld: 'titel', then, set: v => { if (v.trim()) b.titel = v.trim(); } });
    case 'summe': return editField(b, el, { value: b.summe, num: true, label: 'Summe', feld: 'summe', then, set: v => { b.summe = v; } });
    case 'ort': return editField(b, el, { value: b.gliederung, src: SRC.ort, label: 'Ort oder Gliederung', feld: 'ort', then, set: v => { b.gliederung = v.trim(); } });
    case 'zust': return editField(b, el, { value: (b.zust[0] || {}).n || '', src: SRC.zust, label: 'Ansprechperson', feld: 'zust', then, set: v => { b.zust = zustVorn(b, v.trim()); } });
    case 'deadline': return calPop(el, b.deadline, v => { b.deadline = v; changed(); relist(b); }, { clear: 'Deadline entfernen' });
    case 'eig': return editField(b, el, { value: b.eigenanteil, num: true, right: true, label: 'Eigenmittel in Euro', set: v => { b.eigenanteil = v; } });
    case 'amt': if (!f) return;
      return editField(b, el, { value: f.status === 'zugesagt' ? f.zugesagt : f.betrag, num: true, right: true, label: 'Betrag in Euro', set: v => { if (f.status === 'zugesagt') f.zugesagt = v; else f.betrag = v; } });
    case 'fr': {
      const k = el.dataset.k, it = b.freigabe[k];
      if (k === 'ofk' && b.gliederung === DIO) { toast('Bei Bedarfen der Diözese entfällt der Ortsführungskreis.', 'warn'); return; }
      const v = nextOf(ROT_FR, it.st); it.st = v; effects(b, b, 'freigabe.' + k + '.st', v); return done();
    }
    case 'ang': { const u = angebotUL(b); if (!u) return; u.st = nextOf(ROT_ANG, u.st); return done(); }
    case 'foe': { if (!f) return; const v = ROT_FOE[f.status] || 'geplant'; f.status = v; effects(b, f, 'status', v); return done(); }
    case 'vn': {                                                                         // nicht nötig → steht aus → in Arbeit → erledigt → nicht nötig
      if (!f) return; const x = f.vn;
      if (!x.noetig) Object.assign(x, { noetig: true, st: 'offen' });
      else if (x.st === 'erledigt') Object.assign(x, { noetig: false, st: 'offen' });
      else x.st = x.st === 'offen' ? 'arbeit' : 'erledigt';
      return done();
    }
    case 'foe-name': if (!f) return;                                                    // Stift am Ende des Namens: Förderer umbenennen
      return editField(b, el.closest('.fn'), { value: f.name, keep: true, fit: true, src: SRC.foe, label: 'Förderer', set: v => { if (v.trim()) f.name = v.trim(); } });
    case 'vn-frist': if (!f) return;                                                    // Kalender neben „Frist fehlt“ bzw. der Frist
      return calPop(el, f.vn.frist, v => { f.vn.frist = v; changed(); relist(b); }, { clear: 'Frist entfernen' });
    case 'ueb': return uebForm(b, el);
    case 'add': return addFoeForm(el, b);
  }
}

// Vorschläge beim Tippen: schlichtes Fenster unter dem Feld, gefiltert nach dem Eingegebenen; Pfeiltasten wählen, Enter oder Klick übernimmt.
// o.all: schon beim Hineinklicken die ganze Liste (scrollbar, zum Wert gescrollt); o.match: eigener Abgleich
function suggest(inp, source, onPick, o = {}) {
  let box = null, hi = -1, items = [];
  const close = () => { if (box) box.remove(); box = null; hi = -1; };
  const draw = () => {
    close();
    const raw = inp.value.trim(), q = norm(raw); if (!q && !o.all) return;
    items = o.match ? source().filter(v => o.match(raw, v))
      : uniq(source().filter(Boolean)).filter(v => norm(v).includes(q) && norm(v) !== q).sort((a, c) => (norm(c).startsWith(q) - norm(a).startsWith(q)) || a.localeCompare(c, 'de')).slice(0, 7);
    if (!items.length) return;
    box = h('div', { class: 'le-sug' + (o.all ? ' lang' : ''), role: 'listbox' }, items.map((v, i) => h('div', { class: 'le-opt' + (v === raw ? ' on' : ''), role: 'option', 'data-i': i }, v)));
    box.addEventListener('mousedown', e => { e.preventDefault(); const x = e.target.closest('.le-opt'); if (!x) return; inp.value = items[+x.dataset.i]; close(); onPick(); });
    document.body.append(box);
    const r = inp.getBoundingClientRect();
    Object.assign(box.style, { left: r.left + 'px', top: (r.bottom + 3) + 'px', minWidth: Math.max(r.width, o.all ? 80 : 160) + 'px' });
    const cur = box.querySelector('.le-opt.on') || (o.near && box.children[Math.max(0, items.indexOf(o.near()))]);
    if (cur) box.scrollTop = cur.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2;
  };
  const mark = () => [...box.children].forEach((c, i) => c.classList.toggle('on', i === hi));
  inp.addEventListener('input', draw);
  if (o.all) inp.addEventListener('focus', draw);
  inp.addEventListener('blur', close);
  return e => {                                                   // Tastendruck: true, wenn er nur die Vorschläge betraf
    if (!box) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { hi = Math.max(-1, Math.min(items.length - 1, hi + (e.key === 'ArrowDown' ? 1 : -1))); mark(); const c = box.children[hi]; if (c) c.scrollIntoView({ block: 'nearest' }); return true; }
    if (e.key === 'Escape') { close(); return true; }
    if (e.key === 'Enter' && hi >= 0) { inp.value = items[hi]; close(); onPick(); return true; }
    if (e.key === 'Enter') close();
    return false;
  };
}
window.addEventListener('scroll', e => { if (!(e.target instanceof Element && e.target.closest('.le-sug'))) $$('.le-sug').forEach(x => x.remove()); }, true);

// Uhrzeit in 5-Minuten-Schritten: zwei Räder (Stunden, Minuten); Getipptes wird auf 5 Minuten gerundet (1530, 15.30, 15:32 → 15:30)
function normZeit(s) {
  s = String(s || '').trim().replace(/\s*uhr$/i, '');
  let q = /^(\d{1,2})[:.,h ](\d{1,2})$/.exec(s), hh, mm;
  if (q) { hh = +q[1]; mm = q[2].length === 1 ? +q[2] * 10 : +q[2]; }
  else if (/^\d{3,4}$/.test(s)) { hh = +s.slice(0, -2); mm = +s.slice(-2); }
  else if (/^\d{1,2}$/.test(s)) { hh = +s; mm = 0; }
  else return '';
  mm = Math.round(mm / 5) * 5; if (mm === 60) { mm = 0; hh++; }
  return hh < 24 && mm < 60 ? z2(hh) + ':' + z2(mm) : '';
}
function zeitPop(inp, done) {
  closeMenus();
  const cur = normZeit(inp.value);
  let hh = cur.slice(0, 2), mm = cur.slice(3);
  const col = (k, L, sel) => `<div class="zeit-col" data-k="${k}" aria-label="${k === 'h' ? 'Stunde' : 'Minute'}">${L.map(v => `<button type="button" class="zeit-v${v === sel ? ' on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>`;
  const box = h('div', { class: 'menu zeit-pop', role: 'dialog', 'aria-label': 'Uhrzeit wählen',
    html: col('h', Array.from({ length: 24 }, (_, i) => z2(i)), hh) + '<span class="zeit-dp">:</span>' + col('m', Array.from({ length: 12 }, (_, i) => z2(i * 5)), mm) });
  const mark = (k, v) => box.querySelectorAll(`.zeit-col[data-k="${k}"] .zeit-v`).forEach(x => x.classList.toggle('on', x.dataset.v === v));
  box.addEventListener('mousedown', e => e.preventDefault());                     // der Fokus bleibt im Feld
  box.addEventListener('click', e => {
    const b = e.target.closest('.zeit-v'); if (!b) return;
    if (b.parentElement.dataset.k === 'h') hh = b.dataset.v; else mm = b.dataset.v;
    if (!hh) hh = '12'; if (!mm) mm = '00';
    mark('h', hh); mark('m', mm); inp.value = hh + ':' + mm;
    if (b.parentElement.dataset.k === 'm') { box.remove(); done(); }               // Minute gewählt: fertig
  });
  placePop(box, inp);
  for (const [k, v] of [['h', hh || '12'], ['m', mm || '00']]) {                  // Räder auf die gewählte Zeit (sonst 12:00) drehen
    const c = box.querySelector(`.zeit-col[data-k="${k}"]`), x = c.querySelector(`[data-v="${v}"]`);
    if (x) c.scrollTop = x.offsetTop - c.clientHeight / 2 + x.offsetHeight / 2;
  }
}

// eigener Kalender (hell oder dunkel wie das Programm): Monat blättern, Tag anklicken; o.clear: Datum entfernen
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function calPop(anchor, iso, pick, o = {}) {
  closeMenus();
  const start = validIso(iso) ? iso : today();
  let y = +start.slice(0, 4), m = +start.slice(5, 7) - 1;
  const box = h('div', { class: 'menu cal-pop', role: 'dialog', 'aria-label': 'Datum wählen' });
  const draw = () => {
    const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7, n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), heute = today();
    let g = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<span class="cal-wd">${d}</span>`).join('') + '<span></span>'.repeat(lead);
    for (let d = 1; d <= n; d++) { const v = `${y}-${z2(m + 1)}-${z2(d)}`; g += `<button type="button" class="cal-d${v === iso ? ' on' : ''}${v === heute ? ' heute' : ''}" data-v="${v}">${d}</button>`; }
    box.innerHTML = `<div class="cal-h"><button type="button" class="cal-nav" data-d="-1" aria-label="Voriger Monat">‹</button><b>${MONATE[m]} ${y}</b><button type="button" class="cal-nav" data-d="1" aria-label="Nächster Monat">›</button></div>`
      + `<div class="cal-g">${g}</div>` + (o.clear && validIso(iso) ? `<div class="cal-f"><button type="button" class="link small" data-v="">${o.clear}</button></div>` : '');
  };
  draw();
  box.addEventListener('mousedown', e => e.preventDefault());                    // der Fokus bleibt, wo er ist
  box.addEventListener('click', e => {
    const nav = e.target.closest('.cal-nav');
    if (nav) { m += +nav.dataset.d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } draw(); return; }
    const d = e.target.closest('[data-v]'); if (d) { box.remove(); pick(d.dataset.v); }
  });
  placePop(box, anchor, o.align);
  return box;
}

const SRC = {
  ort: () => [DIO, ...GL_LIST, ...D.bedarfe.map(x => x.gliederung)],
  zust: () => [...PR.list.map(p => p.n), ...D.bedarfe.flatMap(x => x.zust.map(z => z.n))],
  stichwort: () => D.bedarfe.flatMap(x => x.stichworte),
  uebOrt: () => [...D.bedarfe.map(x => x.nach.ueb.ort), ...GL_LIST],
  foe: () => [...KR.list.map(k => k.name), ...D.bedarfe.flatMap(x => x.foerderer.map(f => f.name))],
};

// ein Feld genau dort, wo der Wert steht: schlicht mit Linie darunter, ohne Rahmen; die Spalten verschieben sich nicht.
// Leer begonnen (nur der Name des Felds steht blass darin) – wer nichts eingibt, ändert nichts. Enter oder Klick daneben übernimmt, Esc verwirft.
function editField(b, el, o) {
  const cell = el.closest('td'); if (!cell || cell.querySelector('.le-edit')) return;
  const inp = o.area ? h('textarea', { class: 'le-edit', rows: 1, value: o.value ?? '', placeholder: o.label, 'aria-label': o.label })     // Name und Notizen bleiben zum Korrigieren stehen
    : h('input', { type: o.type || 'text', value: o.keep ? o.value ?? '' : '', class: 'le-edit' + (o.num ? ' num' : ''), placeholder: o.label, inputmode: o.num ? 'decimal' : null, autocomplete: 'off', 'aria-label': o.label });
  cell.classList.add('le-cell'); cell.append(inp);
  const cs = getComputedStyle(cell), pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), c = cell.getBoundingClientRect(), x0 = c.left + cell.clientLeft, y0 = c.top + cell.clientTop, maxR = cell.clientWidth - pr;
  let r = el.getBoundingClientRect();
  if (el === cell) { const rg = document.createRange(); rg.selectNodeContents(el); const t = rg.getBoundingClientRect(); if (t.height) r = t; }
  const left = o.right ? Math.max(pl, r.right - x0 - Math.max(r.width, 90)) : el === cell ? pl : r.left - x0;
  const width = o.right ? r.right - x0 - left : o.fit ? r.width : maxR - left;
  Object.assign(inp.style, { left: left + 'px', top: (r.top - y0) + 'px', width: width + 'px' });
  el.classList.add('le-hide'); leStop(inp);
  inp.focus(); if (o.area || o.keep) inp.select();
  let fertig = false;
  const finish = (ok, wie) => {
    if (fertig) return; fertig = true;
    let v = inp.value;
    if (ok && String(v).trim()) {
      if (o.num) v = deNum(v);
      if (v === null) toast('„' + inp.value + '“ ist keine Zahl – nicht übernommen (z. B. 1500 oder 1.234,50).', 'warn');
      else if (v !== o.value) { o.set(v === '' ? null : v); changed(); }
    }
    relist(b);
    if (o.then) o.then(wie);
    else if ((wie === 'tab' || wie === 'back') && o.feld) feldWeiter(b, o.feld, wie);
  };
  let umsch = false;                                     // Umschalt+Enter: übernehmen und gleich der nächste neue Bedarf ('neu')
  const sug = o.src ? suggest(inp, o.src, () => finish(true, umsch ? 'neu' : 'enter')) : () => false;
  inp.addEventListener('keydown', e => {
    umsch = e.key === 'Enter' && e.shiftKey;
    if (sug(e)) { e.preventDefault(); return; }
    if (e.key === 'Enter' && !(o.multi && e.shiftKey)) { e.preventDefault(); finish(true, e.shiftKey ? 'neu' : 'enter'); } else if (e.key === 'Escape') { e.preventDefault(); finish(false, 'esc'); }
    else if (e.key === 'Tab' && o.feld) { e.preventDefault(); finish(true, e.shiftKey ? 'back' : 'tab'); }
  });
  inp.addEventListener('blur', () => finish(true, 'blur'));
}

// Tab im Feld: übernehmen und weiter zum nächsten Feld der Zeile (Shift+Tab: zurück) – Name → Summe → Ort → Ansprechperson → Deadline;
// in der kompakten Ansicht nur Name → Summe → Ort (die anderen stehen dort nicht)
const LISTE_FELDER = ['titel', 'summe', 'ort', 'zust', 'deadline'];
const zeilenFelder = id => { const tr = $(`#list-body tr[data-id="${CSS.escape(id)}"]`); return tr ? LISTE_FELDER.filter(k => tr.querySelector(`[data-le="${k}"]`)) : []; };
function feldWeiter(b, k, wie, then) {
  const L = zeilenFelder(b.id), i = L.indexOf(k) + (wie === 'back' ? -1 : 1);
  const el = i >= 0 && i < L.length && $(`#list-body tr[data-id="${CSS.escape(b.id)}"] [data-le="${L[i]}"]`);
  if (el) strgAct(b, el, then);
}
// „+ Bedarf“: neue Zeile oben in der Liste, dann der Reihe nach Name → Summe → Ort → Ansprechperson → Deadline (Enter oder Tab, Shift+Tab zurück);
// Umschalt+Enter legt gleich den nächsten Bedarf an, direkt darunter – so lassen sich viele hintereinander eintippen.
// Esc oder Klick daneben hört auf. Bleibt der Name leer, verschwindet die neue Zeile wieder.
function neuerBedarf(nach) {
  const nb = blank(); D.bedarfe.unshift(nb); changed();
  Object.assign(UI, { tab: 'aktiv', view: 'list', q: '', fSw: '' });
  const L = (ORDER.ids || []).filter(id => id !== nb.id), at = nach ? L.indexOf(nach) : -1;
  ORDER.ids = at >= 0 ? [...L.slice(0, at + 1), nb.id, ...L.slice(at + 1)] : [nb.id, ...L];
  renderNow(); strgSet(false);
  if (at < 0) scrollTo(0, 0); else { const tr = $(`#list-body tr[data-id="${CSS.escape(nb.id)}"]`); if (tr) tr.scrollIntoView({ block: 'nearest' }); }
  const feld = k => $(`#list-body tr[data-id="${CSS.escape(nb.id)}"] [data-le="${k}"]`);
  const schritte = zeilenFelder(nb.id);
  const weg = () => { D.bedarfe = D.bedarfe.filter(x => x !== nb); ORDER.ids = ORDER.ids && ORDER.ids.filter(id => id !== nb.id); changed(); keep(renderNow); };
  const geh = i => {
    const el = feld(schritte[i]); if (!el) return;
    strgAct(nb, el, wie => {
      if (i === 0 && !nb.titel.trim()) { weg(); return; }
      if (wie === 'neu') { neuerBedarf(nb.id); return; }
      if ((wie === 'enter' || wie === 'tab') && i + 1 < schritte.length) geh(i + 1);
      else if (wie === 'back' && i > 0) geh(i - 1);
    });
  };
  geh(0);
}

// + im Finanzierungsplan: neue Zeile unter den Förderern – Name (blass „Förderer“, Vorschläge aus Förder-Kartei und Förderplänen) und Betrag dort, wo die Beträge stehen.
// Enter: vom Namen zum Betrag, dann speichern; Shift+Enter: speichern und gleich die nächste Zeile – ganz ohne Maus
function addFoeForm(el, b) {
  const fg = el.closest('.l-fin') && el.closest('.l-fin').querySelector('.fg'); if (!fg || fg.querySelector('.le-new')) return;
  const nm = h('input', { type: 'text', class: 'le-edit le-in', placeholder: 'Förderer', size: 1, autocomplete: 'off', 'aria-label': 'Neuer Förderer' });
  const am = h('input', { type: 'text', class: 'le-edit le-in num', placeholder: 'Betrag in Euro', size: 1, inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Betrag in Euro' });
  const line = h('div', { class: 'fr le-new' }, h('span', { class: 'mi m-off' }), h('span', { class: 'fn' }, nm), h('span', { class: 'fa' }, am), h('span'), h('span'), h('span'));
  fg.insertBefore(line, fg.querySelector('.fline')); leStop(line);
  // Betrag rechtsbündig in der Spalte der Beträge; ist sie schmaler als das Feld, ragt es nach links, und der Name endet davor (keine Spalte verschiebt sich)
  const fa = am.parentElement, fn = nm.parentElement;
  nm.style.width = Math.max(60, fn.clientWidth - Math.max(0, am.offsetWidth - fa.clientWidth) - 8) + 'px';
  nm.focus();
  let fertig = false;
  const finish = (ok, weiter) => {                                                   // weiter: gleich die nächste leere Zeile (Shift+Enter)
    if (fertig) return; fertig = true;
    const name = nm.value.trim(), v = deNum(am.value);
    if (ok && name) {
      if (v === null) toast('„' + am.value + '“ ist keine Zahl – Förderer ohne Betrag angelegt.', 'warn');
      const nf = ff({ name, betrag: v === null || v === '' ? null : v }), k = kartei(name), art = k ? artFromKartei(k, name) : '';
      if (art) nf.art = art;
      b.foerderer.push(nf); changed();
    } else weiter = false;
    relist(b);
    const plus = weiter && $(`#list-body tr[data-id="${CSS.escape(b.id)}"] .le-plus`);
    if (plus) addFoeForm(plus, b);
  };
  const next = () => { if (!am.value.trim()) am.focus(); else finish(true); };
  const sug = suggest(nm, SRC.foe, next);
  line.addEventListener('keydown', e => {
    if (e.target === nm && sug(e)) { e.preventDefault(); return; }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.shiftKey) finish(true, true);                                             // Shift+Enter: speichern und nächster Förderer
    else if (e.target === nm) next(); else finish(true);
  });
  line.addEventListener('focusout', () => setTimeout(() => { if (!line.contains(document.activeElement)) finish(true); }, 0));
}

// Spendenübergabe eintragen: Ort (mit Vorschlägen), Datum und Uhrzeit, Notizen – vorbelegt, leeren löscht. Enter, „fertig“ oder Klick daneben übernimmt, Esc verwirft.
function uebForm(b, el) {
  const cell = el.closest('td'); if (!cell || cell.querySelector('.ue-form')) return;
  const u = b.nach.ueb, inp = (o) => h('input', Object.assign({ type: 'text', class: 'le-edit le-in', autocomplete: 'off' }, o));
  const ort = inp({ value: u.ort, placeholder: 'Ort', 'aria-label': 'Ort der Spendenübergabe' });
  const dat = inp({ value: fmtDate(u.termin), placeholder: 'Datum', 'aria-label': 'Datum der Spendenübergabe' });
  const zeit = inp({ value: u.zeit, placeholder: 'Uhrzeit', inputmode: 'numeric', 'aria-label': 'Uhrzeit der Spendenübergabe' });
  const info = h('textarea', { class: 'le-edit le-in', rows: 1, value: u.info, placeholder: 'Notizen', 'aria-label': 'Notizen zur Spendenübergabe' });
  const ok = h('button', { class: 'link small ue-ok', type: 'button' }, 'fertig');
  const form = h('div', { class: 'ue-form' }, ort, h('div', { class: 'ue-wann' }, dat, zeit), info, ok);
  cell.replaceChildren(form); leStop(form); ort.focus();
  let fertig = false;
  const finish = save => {
    if (fertig) return; fertig = true;
    closeMenus();
    if (save) {
      const d = anyDate(dat.value), t = normZeit(zeit.value);
      if (dat.value.trim() && !d) toast('„' + dat.value + '“ ist kein Datum – Datum nicht übernommen (z. B. 05.12.2026).', 'warn');
      Object.assign(u, { ort: ort.value.trim(), termin: d || (dat.value.trim() ? u.termin : ''), zeit: t, info: info.value.trim() });
      if (u.termin && u.st === 'offen') u.st = 'terminiert';
      if (!u.termin && u.st === 'terminiert') u.st = 'offen';
      changed();
    }
    relist(b);
  };
  const sug = suggest(ort, SRC.uebOrt, () => dat.focus());
  const kal = () => { if (!$('.cal-pop')) calPop(dat, anyDate(dat.value), v => { dat.value = fmtDate(v); zeit.focus(); }); };
  const rad = () => { if (!$('.zeit-pop')) zeitPop(zeit, () => info.focus()); };
  zeit.addEventListener('focus', rad); zeit.addEventListener('click', rad);
  zeit.addEventListener('input', () => closeMenus()); zeit.addEventListener('blur', () => closeMenus());
  dat.addEventListener('focus', kal); dat.addEventListener('click', kal);
  dat.addEventListener('input', () => closeMenus()); dat.addEventListener('blur', () => closeMenus());
  form.addEventListener('keydown', e => {
    if (e.target === ort && sug(e)) { e.preventDefault(); return; }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    if (e.key === 'Enter' && !(e.target === info && e.shiftKey)) { e.preventDefault(); finish(true); }
  });
  ok.addEventListener('click', () => finish(true));
  form.addEventListener('focusout', () => setTimeout(() => { if (!fertig && !form.contains(document.activeElement)) finish(true); }, 0));
}

// Namensfeld der Förderer-Kachel: eigene Vorschläge (Förder-Kartei und Förderpläne) statt der Auswahlliste des Browsers
document.addEventListener('focusin', e => {
  const el = e.target;
  if (!el.matches || !el.matches('input.fp-h[data-p="name"]') || el.dataset.sug) return;
  el.dataset.sug = '1';
  const k = suggest(el, SRC.foe, () => { el.dispatchEvent(new Event('input', { bubbles: true })); el.blur(); });
  el.addEventListener('keydown', ev => { if (k(ev)) ev.preventDefault(); });
});
// Beträge in den Feldern der Liste ebenfalls gleich mit Tausenderpunkt
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('input.le-edit.num')) liveNum(e.target); }, true);

// Hinweise am Förderer (rotes Dreieck): beim Überfahren ein kleines Fenster; es bleibt, solange die Maus auf Dreieck oder Fenster ist
let fwZu = null;
document.addEventListener('mouseover', e => {
  const t = e.target.closest && e.target.closest('.fw-tri'), p = $('.fw-pop');
  if (t) { clearTimeout(fwZu); if (!p || p.dataset.fid !== t.dataset.fid) fwPop(t); return; }
  if (!p) return;
  if (e.target.closest && e.target.closest('.fw-pop')) { clearTimeout(fwZu); return; }
  clearTimeout(fwZu); fwZu = setTimeout(() => { const q = $('.fw-pop'); if (q && !q.matches(':hover')) q.remove(); }, 250);
});
// Datumsfeld ohne Kalendersymbol (Förderer-Kacheln): Klick öffnet den eigenen Kalender, tippen geht auch (05.10.2026)
function dfeldSet(el, iso) {
  const b = cur(), f = b && b.foerderer.find(x => x.id === el.dataset.fid); if (!f || (f[el.dataset.dp] || '') === iso) return;
  f[el.dataset.dp] = iso; changed(); keep(renderNow);
}
const dfeldAuf = el => { const p = $('.cal-pop'); if (p && p.feld === el) return; calPop(el, anyDate(el.value), v => dfeldSet(el, v), { clear: 'Datum entfernen' }).feld = el; };
document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('input.dfeld'); if (el) dfeldAuf(el); });
document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('input.dfeld')) dfeldAuf(e.target); });
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('input.dfeld')) closeMenus(); });
document.addEventListener('change', e => {
  const el = e.target; if (!el.matches || !el.matches('input.dfeld')) return;
  const v = el.value.trim(), iso = v ? anyDate(v) : '';
  if (v && !iso) { toast('„' + v + '“ ist kein Datum – nicht übernommen (z. B. 05.10.2026).', 'warn'); keep(renderNow); return; }
  dfeldSet(el, iso);
});
