/* ---------- Ordner per Ziehen (ab 0.78): auf „OneDrive / SharePoint“ fallen lassen → Link zum Ordner in SharePoint.
   Ein Link aus dem Browser (SharePoint) oder ein Pfad als Text wird direkt übernommen. Aus dem Explorer verrät der Browser nur den Namen
   des Ordners, nicht wo er liegt: liegt er im Ordner der Bedarfsliste (verbunden), rechnet die App den Weg nach; sonst schlägt sie den Ort vor,
   an dem die Ordner ähnlicher Bedarfe liegen (gleiche Gliederung zuerst) – zum Bestätigen oder Ändern. */
const ordnerZone = e => UI.view === 'detail' && e.target && e.target.closest && e.target.closest('.o-link');
document.addEventListener('dragover', e => { const z = ordnerZone(e); if (!z) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'link'; z.classList.add('drop-an'); });
document.addEventListener('dragleave', e => { const z = ordnerZone(e); if (z && !z.contains(e.relatedTarget)) z.classList.remove('drop-an'); });
document.addEventListener('drop', e => {
  const z = ordnerZone(e); if (!z) return;
  e.preventDefault(); z.classList.remove('drop-an');
  const b = cur(), dt = e.dataTransfer; if (!b || !dt) return;
  // was der Browser hergibt, nur jetzt (während des Ereignisses) lesbar
  const txt = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').split(/\r?\n/).map(x => x.trim()).find(x => x && !x.startsWith('#')) || '';
  const it = [...(dt.items || [])].find(i => i.kind === 'file');
  const eintrag = it && it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
  const hnd = it && it.getAsFileSystemHandle ? it.getAsFileSystemHandle().catch(() => null) : null;
  ordnerAblegen(b, { txt, eintrag, hnd, name: eintrag ? eintrag.name : it && it.getAsFile() ? it.getAsFile().name : '' });
});
function ordnerSetzen(b, l) { b.link = l.link; b.pfad = l.pfad || ''; changed(); keep(renderNow); toast('Link zum Ordner hinterlegt.', 'ok'); }
async function ordnerAblegen(b, x) {
  if (!x.eintrag && !x.name) {
    const l = ordnerLink(x.txt); if (l) return ordnerSetzen(b, l);
    toast('Damit lässt sich nichts anfangen – einen Ordner aus dem Explorer oder einen SharePoint-Link hierher ziehen.', 'warn'); return;
  }
  if (x.eintrag && !x.eintrag.isDirectory) { toast('Das ist eine Datei – bitte den ganzen Ordner hierher ziehen.', 'warn'); return; }
  // liegt der Ordner im verbundenen Ordner der Bedarfsliste? Dann ist der Weg bekannt
  const h = x.hnd ? await x.hnd : null, rel = h && ST.dir && ST.dir.resolve ? await ST.dir.resolve(h).catch(() => null) : null, L = localPath();
  if (rel && rel.length && L) { const l = ordnerLink(L.replace(/\\[^\\]*$/, '') + '\\' + rel.join('\\')); if (l) return ordnerSetzen(b, l); }
  const ort = await ordnerOrtFragen(b, x.name); if (!ort) return;
  const pfad = ort.replace(/[\\/]+$/, '') + '\\' + x.name, link = spLink(pfad);
  if (!link) { toast('Aus „' + pfad + '“ lässt sich kein SharePoint-Link bauen – der Ort muss mit „Ortsgliederungen“ oder „1601_Diözese_Pojekte“ beginnen.', 'warn'); return; }
  ordnerSetzen(b, { link, pfad });
}
// wo liegen die Ordner der anderen Bedarfe? (aus Pfad oder Link) – gleiche Gliederung zuerst, dann die häufigsten Orte
function ordnerOrte(b) {
  const alle = new Map(), gleich = new Map(), plus = (M, k) => M.set(k, (M.get(k) || 0) + 1);
  for (const x of D.bedarfe) {
    if (x === b) continue;
    const rel = ((x.pfad || '').trim() && spRel(x.pfad)) || (okLink(x.link) && spRelLink(x.link)); if (!rel || rel.length < 2) continue;
    const ort = rel.slice(0, -1).join('\\'); plus(alle, ort); if (b.gliederung && x.gliederung === b.gliederung) plus(gleich, ort);
  }
  const sortiert = M => [...M].sort((a, c) => c[1] - a[1]).map(x => x[0]);
  return uniq([...sortiert(gleich), ...sortiert(alle), b.gliederung && b.gliederung !== DIO ? 'Ortsgliederungen\\' + b.gliederung : '1601_Diözese_Pojekte']).slice(0, 6);
}
async function ordnerOrtFragen(b, name) {
  const O = ordnerOrte(b), feld = h('input', { type: 'text', class: 'tf-feld', value: O[0] || '', 'aria-label': 'Ort des Ordners', placeholder: 'z. B. Ortsgliederungen\\Brakel' });
  const vorschau = h('div', { class: 'muted small or-vor' }), zeig = () => { const l = spLink(feld.value.trim().replace(/[\\/]+$/, '') + '\\' + name); vorschau.textContent = l ? 'Link: ' + l : 'Der Ort muss mit „Ortsgliederungen“ oder „1601_Diözese_Pojekte“ beginnen.'; };
  feld.addEventListener('input', zeig); zeig();
  const knopf = o => h('button', { type: 'button', class: 'or-opt' + (o === feld.value ? ' on' : ''), onclick: ev => { feld.value = o; zeig(); ev.currentTarget.parentElement.querySelectorAll('.or-opt').forEach(k => k.classList.toggle('on', k === ev.currentTarget)); } }, o);
  let zu = null; feld.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); zu && zu(true); } });
  const ok = await modal('Wo liegt „' + name + '“?', h('div', { class: 'tf' },
    h('p', { class: 'small' }, 'Beim Ziehen aus dem Explorer verrät der Browser nur den Namen des Ordners, nicht wo er liegt. Vorschläge – dort liegen die Ordner ähnlicher Bedarfe:'),
    h('div', { class: 'or-liste' }, ...O.map(knopf)), h('label', { class: 'tf-l' }, 'Ort des Ordners (ab „Ortsgliederungen“ bzw. „1601_Diözese_Pojekte“)'), feld, vorschau),
    [['Abbrechen', false], ['Übernehmen', true, 'primary']], { wide: true, expose: c => { zu = c; } });
  return ok ? feld.value.trim() : null;
}
