/* ===================================================================== Strg gedrückt halten: in der Liste direkt bearbeiten.
   Name, Summe, Ort, Ansprechperson, Deadline, Beträge und Eigenmittel werden per Klick zum schlichten Feld an derselben Stelle (Vorschläge beim Tippen);
   Freigabe, Angebot, Stand der Förderer und Verwendungsnachweis drehen per Klick einen Stand weiter; über dem Finanzierungsplan unten links ein + für weitere Förderer. */

let STRG = false;
function strgSet(on) {
  on = !!on && UI.view === 'list';
  if (on === STRG) return;
  STRG = on;
  document.body.classList.toggle('strg', on);
  if (on) ORDER.ids = filtered().map(b => b.id);
  else if (ORDER.ids) { ORDER.ids = null; if (UI.view === 'list' && !$('.le-edit')) keep(renderNow); }   // erst jetzt neu sortieren (ein offenes Feld sortiert beim Übernehmen)
}
// nach einer Änderung: mit Strg nur die Zeile neu zeichnen (Reihenfolge bleibt), sonst die ganze Liste
function relist(b) {
  const tr = STRG && $(`#list-body tr[data-id="${CSS.escape(b.id)}"]`);
  if (tr) tr.outerHTML = row(b); else keep(renderNow);
}
document.addEventListener('keydown', e => { if (e.key === 'Control' || e.key === 'Meta') strgSet(true); });
document.addEventListener('keyup', e => { if (e.key === 'Control' || e.key === 'Meta') strgSet(false); });
document.addEventListener('mousemove', e => strgSet(e.ctrlKey || e.metaKey), { passive: true });
window.addEventListener('blur', () => strgSet(false));

// je Klick ein Stand weiter
const ROT_FR = ['offen', 'angefragt', 'ok', 'nein'], ROT_ANG = ['fehlt', 'arbeit', 'da'];
const ROT_FOE = { geplant: 'beantragt', vorb: 'zugesagt', beantragt: 'zugesagt', zugesagt: 'abgelehnt', abgelehnt: 'geplant' };
const nextOf = (L, v) => L[(L.indexOf(v) + 1) % L.length];

document.addEventListener('click', e => {
  if (UI.view !== 'list') return;
  if (e.target.closest('.le-edit, .le-new')) { e.stopPropagation(); return; }          // Klick ins offene Feld öffnet nicht den Bedarf
  if (!(e.ctrlKey || e.metaKey)) return;
  const tr = e.target.closest('#list-body tr[data-id]'); if (!tr) return;
  e.preventDefault(); e.stopPropagation();
  const b = D.bedarfe.find(x => x.id === tr.dataset.id), el = e.target.closest('[data-le]');
  if (b && el) strgAct(b, el);
}, true);

function strgAct(b, el) {
  const f = el.dataset.fid ? b.foerderer.find(x => x.id === el.dataset.fid) : null, done = () => { changed(); relist(b); };
  switch (el.dataset.le) {
    case 'titel': return editField(b, el, { value: b.titel, area: true, label: 'Bedarf', set: v => { if (v.trim()) b.titel = v.trim(); } });
    case 'summe': return editField(b, el, { value: b.summe, num: true, label: 'Summe in Euro', set: v => { b.summe = v; } });
    case 'ort': return editField(b, el, { value: b.gliederung, src: SRC.ort, label: 'Ort oder Gliederung', set: v => { b.gliederung = v.trim(); } });
    case 'zust': return editField(b, el, { value: b.zust[0] || '', src: SRC.zust, label: 'Ansprechperson', set: v => { v = v.trim(); b.zust = v ? [v, ...b.zust.slice(1).filter(x => x !== v)] : b.zust.slice(1); } });
    case 'deadline': return editField(b, el, { type: 'date', value: b.deadline, label: 'Deadline', set: v => { b.deadline = v; } });
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
    case 'add': return addFoeForm(el, b);
  }
}

// Vorschläge beim Tippen: schlichtes Fenster unter dem Feld, gefiltert nach dem Eingegebenen; Pfeiltasten wählen, Enter oder Klick übernimmt
function suggest(inp, source, onPick) {
  let box = null, hi = -1, items = [];
  const close = () => { if (box) box.remove(); box = null; hi = -1; };
  const draw = () => {
    close();
    const q = norm(inp.value.trim()); if (!q) return;
    items = uniq(source().filter(Boolean)).filter(v => norm(v).includes(q) && norm(v) !== q)
      .sort((a, c) => (norm(c).startsWith(q) - norm(a).startsWith(q)) || a.localeCompare(c, 'de')).slice(0, 7);
    if (!items.length) return;
    box = h('div', { class: 'le-sug', role: 'listbox' }, items.map((v, i) => h('div', { class: 'le-opt', role: 'option', 'data-i': i }, v)));
    box.addEventListener('mousedown', e => { const o = e.target.closest('.le-opt'); if (!o) return; e.preventDefault(); inp.value = items[+o.dataset.i]; close(); onPick(); });
    document.body.append(box);
    const r = inp.getBoundingClientRect();
    Object.assign(box.style, { left: r.left + 'px', top: (r.bottom + 3) + 'px', minWidth: Math.max(r.width, 160) + 'px' });
  };
  const mark = () => [...box.children].forEach((c, i) => c.classList.toggle('on', i === hi));
  inp.addEventListener('input', draw);
  inp.addEventListener('blur', close);
  return e => {                                                   // Tastendruck: true, wenn er nur die Vorschläge betraf
    if (!box) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { hi = Math.max(-1, Math.min(items.length - 1, hi + (e.key === 'ArrowDown' ? 1 : -1))); mark(); return true; }
    if (e.key === 'Escape') { close(); return true; }
    if (e.key === 'Enter' && hi >= 0) inp.value = items[hi];
    if (e.key === 'Enter') close();
    return false;
  };
}
window.addEventListener('scroll', () => $$('.le-sug').forEach(x => x.remove()), true);
const SRC = {
  ort: () => [DIO, ...GL_LIST, ...D.bedarfe.map(x => x.gliederung)],
  zust: () => D.bedarfe.flatMap(x => x.zust),
  foe: () => [...KR.list.map(k => k.name), ...D.bedarfe.flatMap(x => x.foerderer.map(f => f.name))],
};

// ein Feld genau dort, wo der Wert steht: schlicht mit Linie darunter, ohne Rahmen; die Spalten verschieben sich nicht.
// Leer begonnen (nur der Name des Felds steht blass darin) – wer nichts eingibt, ändert nichts. Enter oder Klick daneben übernimmt, Esc verwirft.
function editField(b, el, o) {
  const cell = el.closest('td'); if (!cell || cell.querySelector('.le-edit')) return;
  const inp = o.area ? h('textarea', { class: 'le-edit', rows: 1, value: o.value ?? '', placeholder: o.label, 'aria-label': o.label })     // der Name bleibt zum Korrigieren stehen
    : h('input', { type: o.type || 'text', value: '', class: 'le-edit' + (o.num ? ' num' : ''), placeholder: o.label, inputmode: o.num ? 'decimal' : null, autocomplete: 'off', 'aria-label': o.label });
  cell.classList.add('le-cell'); cell.append(inp);
  const cs = getComputedStyle(cell), pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), c = cell.getBoundingClientRect(), x0 = c.left + cell.clientLeft, y0 = c.top + cell.clientTop, maxR = cell.clientWidth - pr;
  let r = el.getBoundingClientRect();
  if (el === cell) { const rg = document.createRange(); rg.selectNodeContents(el); const t = rg.getBoundingClientRect(); if (t.height) r = t; }
  const left = o.right ? Math.max(pl, r.right - x0 - Math.max(r.width, 90)) : el === cell ? pl : r.left - x0;
  const width = o.right ? r.right - x0 - left : maxR - left;
  Object.assign(inp.style, { left: left + 'px', top: (r.top - y0) + 'px', width: width + 'px' });
  el.classList.add('le-hide');
  inp.focus(); if (o.area) inp.select();
  let fertig = false;
  const finish = ok => {
    if (fertig) return; fertig = true;
    let v = inp.value;
    if (ok && String(v).trim()) {
      if (o.num) v = deNum(v);
      if (v === null) toast('„' + inp.value + '“ ist keine Zahl – nicht übernommen (z. B. 1500 oder 1.234,50).', 'warn');
      else if (v !== o.value) { o.set(v === '' ? null : v); changed(); }
    }
    relist(b);
  };
  const sug = o.src ? suggest(inp, o.src, () => finish(true)) : () => false;
  inp.addEventListener('keydown', e => {
    if (sug(e)) { e.preventDefault(); return; }
    if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  inp.addEventListener('blur', () => finish(true));
}

// + im Finanzierungsplan: neue Zeile unter den Förderern – Name (blass „Förderer“, Vorschläge aus Förder-Kartei und Förderplänen) und Betrag dort, wo die Beträge stehen
function addFoeForm(el, b) {
  const fg = el.closest('.l-fin') && el.closest('.l-fin').querySelector('.fg'); if (!fg || fg.querySelector('.le-new')) return;
  const nm = h('input', { type: 'text', class: 'le-edit le-in', placeholder: 'Förderer', size: 1, autocomplete: 'off', 'aria-label': 'Neuer Förderer' });
  const am = h('input', { type: 'text', class: 'le-edit le-in num', placeholder: 'Betrag in Euro', size: 1, inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Betrag in Euro' });
  const line = h('div', { class: 'fr le-new' }, h('span', { class: 'mi m-off' }), h('span', { class: 'fn' }, nm), h('span', { class: 'fa' }, am), h('span'), h('span'), h('span'));
  fg.insertBefore(line, fg.querySelector('.fline'));
  // Betrag rechtsbündig in der Spalte der Beträge; ist sie schmaler als das Feld, ragt es nach links, und der Name endet davor (keine Spalte verschiebt sich)
  const fa = am.parentElement, fn = nm.parentElement;
  nm.style.width = Math.max(60, fn.clientWidth - Math.max(0, am.offsetWidth - fa.clientWidth) - 8) + 'px';
  nm.focus();
  let fertig = false;
  const finish = ok => {
    if (fertig) return; fertig = true;
    const name = nm.value.trim(), v = deNum(am.value);
    if (ok && name) {
      if (v === null) toast('„' + am.value + '“ ist keine Zahl – Förderer ohne Betrag angelegt.', 'warn');
      const nf = ff({ name, betrag: v === null || v === '' ? null : v }), k = kartei(name), art = k ? artFromKartei(k, name) : '';
      if (art) nf.art = art;
      b.foerderer.push(nf); changed();
    }
    relist(b);
  };
  const next = () => { if (!am.value.trim()) am.focus(); else finish(true); };
  const sug = suggest(nm, SRC.foe, next);
  line.addEventListener('keydown', e => {
    if (e.target === nm && sug(e)) { e.preventDefault(); return; }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.target === nm) next(); else finish(true);
  });
  line.addEventListener('focusout', () => setTimeout(() => { if (!line.contains(document.activeElement)) finish(true); }, 0));
}
