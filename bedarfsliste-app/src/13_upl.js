/* ===================================================================== Unternehmensplanung (UPL): Investitionsabfrage aus Excel als Bedarfe übernehmen
   Je Zeile mit OG-Nr., OG-Name und Investition ein Bedarf: Name (Anfang der Beschreibung), Ort, Summe (Gesamtkosten), Beschreibung (dahinter
   „ ---- “ und die Kommentierung des Fundraisings), Prio (Stern bei „hoch“), Stichwort „UPL <Jahr>“. Freigaben nur, wenn erteilt:
   Referat „genehmigt“ → Fachreferat freigegeben, Finanzausschuss/GF „genehmigt“ → Verwaltung budgetiert. Andere Kommentare werden nicht übernommen.
   Ein zweites Einlesen legt nichts doppelt an (Kennung b.upl) – es trägt nur neu erteilte Freigaben und fehlende Summen nach. */

// Kopfzeile mit „OG-Name“ und „Gesamtkosten“; die Gruppen stehen in der Zeile darüber (verbundene Zellen tragen ihren Wert überall)
function uplSpalten(rows) {
  const hi = rows.slice(0, 20).findIndex(r => r.some(v => /^og-?name/.test(norm(v))) && r.some(v => /gesamtkosten/.test(norm(v))));
  if (hi < 0) return null;
  const head = rows[hi].map(norm), grp = (rows[hi - 1] || []).map(norm), C = { hi };
  const such = (fn) => head.findIndex((t, c) => fn(t, grp[c] || ''));
  C.nr = such(t => /^og-?nr/.test(t)); C.og = such(t => /^og-?name/.test(t)); C.prio = such(t => /^priorit/.test(t));
  C.text = such(t => /^investition/.test(t) || /beschreibung/.test(t)); C.summe = such(t => /gesamtkosten/.test(t)); C.dienst = such(t => t === 'dienst');
  C.fr = such((t, g) => /fundraising/.test(g) && /kommentier/.test(t));
  C.refBew = such((t, g) => /referat/.test(g) && /bewertung/.test(t)); C.refBeg = such((t, g) => /referat/.test(g) && /begr(ü|ue)ndung/.test(t));
  C.gfBew = such((t, g) => /(\bgf\b|gesch(ä|ae)ftsf|finanzausschuss)/.test(g) && /bewertung/.test(t)); C.gfBeg = such((t, g) => /(\bgf\b|gesch(ä|ae)ftsf|finanzausschuss)/.test(g) && /begr(ü|ue)ndung/.test(t));
  return C.og >= 0 && C.text >= 0 ? C : null;
}
// Name des Bedarfs: der Anfang der Beschreibung bis zum ersten Satzzeichen, höchstens etwa 60 Zeichen (an einer Wortgrenze); „Investition: …“ ohne das Etikett
function uplTitel(t) {
  let s = String(t).trim().split(/\n/)[0].replace(/\s+/g, ' ').trim().replace(/^(investition|anschaffung|beschaffung|bedarf|gegenstand|projekt)\s*:\s*/i, '').split(/[:.;(\n]| - | – /)[0].trim();
  if (s.length > 60) { s = s.slice(0, 60); s = s.slice(0, s.lastIndexOf(' ') > 30 ? s.lastIndexOf(' ') : 60).trim() + ' …'; }
  return s.replace(/[„“"]/g, '') || 'Investition';
}
const uplOrt = og => { const s = String(og).trim(); if (/^(dgs|di(ö|oe)zes)/i.test(s)) return DIO; return GL_LIST.find(g => norm(g) === norm(s)) || s; };
const uplGenehmigt = v => /^(genehmigt|freigegeben|ja|budgetiert|zugestimmt)\b/i.test(String(v || '').trim());

function uplLesen(book, jahr) {
  const out = [];
  for (const sh of book.sheets) {
    if (sh.hidden) continue;
    const rows = sh.rows, C = uplSpalten(rows); if (!C) continue;
    const zelle = (r, c) => c >= 0 ? cellStr(r[c]) : '';
    for (const r of rows.slice(C.hi + 1)) {
      const og = r[C.og], text = zelle(r, C.text);
      if (typeof og !== 'string' || !og.trim() || !text || (C.nr >= 0 && !/^\d{4,}$/.test(String(r[C.nr]).trim()))) continue;   // Legende, Summen, Leerzeilen
      const fr = zelle(r, C.fr), sum = typeof r[C.summe] === 'number' && r[C.summe] > 0 ? r[C.summe] : deNum(zelle(r, C.summe));
      out.push({ key: String(r[C.nr] ?? '') + '|' + kkey(text).slice(0, 80), titel: uplTitel(text), ort: uplOrt(og), summe: typeof sum === 'number' && sum > 0 ? sum : null,
        beschreibung: text.trim() + (fr ? ' ---- ' + fr.trim() : ''), hoch: /^hoch$/i.test(zelle(r, C.prio).replace(/["„“]/g, '').trim()), dienst: zelle(r, C.dienst),
        fach: uplGenehmigt(zelle(r, C.refBew)) ? zelle(r, C.refBeg) || 'genehmigt' : null, verw: uplGenehmigt(zelle(r, C.gfBew)) ? zelle(r, C.gfBeg) || 'genehmigt' : null, jahr });
    }
  }
  return out;
}
// eine Zeile in einen Bedarf übertragen (neu) bzw. Neues nachtragen (vorhanden); true, wenn sich etwas geändert hat
function uplAnwenden(b, z, neu) {
  let n = false;
  const frei = (k, notiz) => { const f = b.freigabe[k]; if (notiz && f.st !== 'ok') { f.st = 'ok'; f.erledigt = f.erledigt || today(); f.notiz = f.notiz || 'laut UPL: ' + notiz; n = true; } };
  if (neu) Object.assign(b, { titel: z.titel, gliederung: z.ort, summe: z.summe, beschreibung: z.beschreibung, prio: z.hoch ? 'hoch' : 'mittel', upl: z.key,
    stichworte: z.jahr ? ['UPL ' + z.jahr] : [] });
  else if (b.summe == null && z.summe) { b.summe = z.summe; n = true; }
  if (z.fach && z.dienst && !b.freigabe.fach.name) b.freigabe.fach.name = z.dienst;
  frei('fach', z.fach); frei('verw', z.verw);
  return neu || n;
}
async function uplImport(file) {
  if (!file) return;
  let L = [];
  const jahr = (String(file.name).match(/20\d\d/) || [''])[0];
  try { L = uplLesen(await xlsxBook(await file.arrayBuffer(), { max: 8e6 }), jahr); } catch (e) { console.warn(e); }
  if (!L.length) { modal('Keine Investitionen gefunden', h('p', null, 'In „' + file.name + '“ steht keine Tabelle mit den Spalten „OG-Name“, „Investition mit Beschreibung“ und „Gesamtkosten“.')); return; }
  const da = new Map(D.bedarfe.filter(b => b.upl).map(b => [b.upl, b])), an = L.map(z => !da.has(z.key));
  const frT = z => [z.fach && 'Fachreferat', z.verw && 'Verwaltung'].filter(Boolean).join(', ');
  const zeilen = L.map((z, i) => h('tr', { class: da.has(z.key) ? 'muted' : '' },
    h('td', null, da.has(z.key) ? '' : h('input', { type: 'checkbox', checked: true, 'aria-label': 'übernehmen', onchange: e => { an[i] = e.target.checked; } })),
    h('td', null, z.hoch ? '★ ' : '', h('b', null, z.titel), da.has(z.key) ? h('span', { class: 'small' }, ' – schon in der Liste') : null),
    h('td', null, z.ort === DIO ? 'Diözese' : z.ort), h('td', { class: 'num' }, z.summe ? eur(z.summe) : '–'), h('td', { class: 'small' }, frT(z) || '–')));
  const neuN = an.filter(Boolean).length;
  const body = h('div', { class: 'help' },
    h('p', null, h('b', null, L.length + ' Investitionen'), ' in „' + file.name + '“' + (neuN < L.length ? ', davon ' + (L.length - neuN) + ' schon in der Liste (dort werden nur neu erteilte Freigaben und fehlende Summen nachgetragen)' : '') + '.'),
    h('p', { class: 'muted small' }, 'Übernommen werden Name (Anfang der Beschreibung – gern kürzen), Ort, Summe, Beschreibung mit „ ---- “ und der Kommentierung des Fundraisings, Stern bei Priorität „hoch“'
      + (jahr ? ' und das Stichwort „UPL ' + jahr + '“' : '') + '. Freigaben nur, wenn erteilt: Referat „genehmigt“ = Fachreferat freigegeben, Finanzausschuss/GF „genehmigt“ = Verwaltung budgetiert.'),
    h('div', { class: 'upl-tab' }, h('table', { class: 'imp-tab' }, h('thead', null, h('tr', null, h('th'), h('th', null, 'Bedarf'), h('th', null, 'Ort'), h('th', { class: 'num' }, 'Summe'), h('th', null, 'Freigaben'))), h('tbody', null, zeilen))));
  if (!await modal('UPL einlesen', body, [['Abbrechen', false], ['Übernehmen', true, 'primary']], { wide: true })) return;
  const before = JSON.stringify(D); let neu = 0, nach = 0;
  L.forEach((z, i) => {
    const alt = da.get(z.key);
    if (alt) { if (uplAnwenden(alt, z, false)) nach++; return; }
    if (!an[i]) return;
    const b = blank(); uplAnwenden(b, z, true); D.bedarfe.push(b); da.set(z.key, b); neu++;
  });
  if (!neu && !nach) { toast('Nichts Neues in der UPL.'); return; }
  changed(); ORDER.ids = null; Object.assign(UI, { view: 'list', tab: 'aktiv', q: '', fSw: jahr && neu ? 'UPL ' + jahr : UI.fSw }); renderNow();
  toast([neu && neu + ' Bedarfe aus der UPL angelegt', nach && nach + ' vorhandene ergänzt'].filter(Boolean).join(', ') + '.', 'ok', undoGanz(before));
}
