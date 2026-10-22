/* ===================================================================== Strg gedrückt halten: in der Liste direkt bearbeiten.
   Name, Summe, Ort, Ansprechperson, Deadline, Beträge und Eigenmittel werden per Klick zum Feld (Enter oder Klick daneben übernimmt, Esc verwirft);
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
  if (e.target.closest('.le-edit, .le-add')) { e.stopPropagation(); return; }          // Klick ins offene Feld öffnet nicht den Bedarf
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
    case 'summe': return editField(b, el, { value: fmtNum(b.summe), num: true, label: 'Summe in Euro', set: v => { b.summe = v; } });
    case 'ort': return editField(b, el, { value: b.gliederung, list: 'dl-gl', label: 'Gliederung', set: v => { b.gliederung = v.trim(); } });
    case 'zust': return editField(b, el, { value: b.zust[0] || '', list: 'dl-zust', label: 'Ansprechperson', set: v => { v = v.trim(); b.zust = v ? [v, ...b.zust.slice(1).filter(x => x !== v)] : b.zust.slice(1); } });
    case 'deadline': return editField(b, el, { type: 'date', value: b.deadline, label: 'Deadline', set: v => { b.deadline = v; } });
    case 'eig': return editField(b, el, { value: fmtNum(b.eigenanteil), num: true, label: 'Eigenmittel in Euro', set: v => { b.eigenanteil = v; } });
    case 'amt': if (!f) return;
      return editField(b, el, { value: fmtNum(f.status === 'zugesagt' ? f.zugesagt : f.betrag), num: true, label: 'Betrag ' + f.name, set: v => { if (f.status === 'zugesagt') f.zugesagt = v; else f.betrag = v; } });
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

// ein Feld an Ort und Stelle; Enter oder Klick daneben übernimmt, Esc verwirft
function editField(b, el, o) {
  if (el.querySelector('.le-edit')) return;
  const inp = o.area ? h('textarea', { class: 'le-edit', rows: 1, value: o.value ?? '', 'aria-label': o.label })                 // langer Name bricht um
    : h('input', { type: o.type || 'text', value: o.value ?? '', class: 'le-edit' + (o.num ? ' num' : ''), list: o.list || null, inputmode: o.num ? 'decimal' : null, 'aria-label': o.label });
  el.replaceChildren(inp); el.classList.add('le-on');
  inp.focus(); if (inp.type !== 'date') inp.select();
  let fertig = false;
  const finish = ok => {
    if (fertig) return; fertig = true;
    if (ok) {
      let v = inp.value;
      if (o.num) {
        v = deNum(v);
        if (v === null) { toast('„' + inp.value + '“ ist keine Zahl – nicht übernommen (z. B. 1500 oder 1.234,50).', 'warn'); relist(b); return; }
        if (v === '') v = null;
      }
      if (v !== o.value) { o.set(v); changed(); }
    }
    relist(b);
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
  inp.addEventListener('blur', () => finish(true));
}

// + im Finanzierungsplan: Name (Vorschläge aus der Förder-Kartei) und Betrag, neuer Förderer steht auf „geplant“
function addFoeForm(el, b) {
  const cell = el.closest('.l-fin'); if (!cell || cell.querySelector('.le-add')) return;
  const nm = h('input', { type: 'text', class: 'le-edit', placeholder: 'Förderer', list: 'dl-kartei', 'aria-label': 'Neuer Förderer' });
  const am = h('input', { type: 'text', class: 'le-edit num', placeholder: 'Betrag €', inputmode: 'decimal', 'aria-label': 'Betrag in Euro' });
  const box = h('div', { class: 'le-add' }, nm, am);
  cell.append(box); nm.focus();
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
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.target === nm && !am.value.trim()) am.focus(); else finish(true);
  });
  box.addEventListener('focusout', () => setTimeout(() => { if (!box.contains(document.activeElement)) finish(true); }, 0));
}
