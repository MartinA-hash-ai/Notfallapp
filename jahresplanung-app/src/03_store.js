/* ===================================================================== Speichern: die Datei speichert sich selbst (App + Daten in einer HTML-Datei) */

const DEFAULT_FILE = 'Jahresplanung_Aussenkommunikation.html';
let DRAFT_OFFER = null;

function currentFileName() {
  try { const n = decodeURIComponent(location.pathname.split('/').pop() || ''); if (/\.html?$/i.test(n)) return n; } catch (e) { /* */ }
  return DEFAULT_FILE;
}
function localPath() {
  try {
    if (location.protocol !== 'file:') return null;
    const p = decodeURIComponent(location.pathname);
    return location.host ? '\\\\' + location.host + p.replace(/\//g, '\\') : p.replace(/^\/(?=[A-Za-z]:)/, '').replace(/\//g, '\\');
  } catch (e) { return null; }
}
function openedFromDownloads() {
  const p = localPath();
  return location.protocol !== 'file:' || (p && /\\(Downloads|Download|INetCache|Temp)\\/i.test(p));
}
function buildFile(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const S = 'script';
  return '<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>Jahresplanung Außenkommunikation</title>\n<link rel="icon" href="' + FAVICON + '">\n<style id="jp-style">' + $('#jp-style').textContent + '</style>\n</head>\n<body>\n<div id="app"></div>\n' +
    '<' + S + ' type="application/json" id="jp-data">' + json + '</' + S + '>\n<' + S + ' id="jp-app">' + $('#jp-app').textContent + '</' + S + '>\n</body>\n</html>\n';
}
function parseFileText(text) {
  try {
    const t = text.trim();
    if (t.startsWith('{')) return JSON.parse(t);
    const m = t.match(/<script[^>]*id="jp-data"[^>]*>([\s\S]*?)<\/script>/i);
    return m ? JSON.parse(m[1]) : null;
  } catch (e) { return null; }
}
const fmtStamp = iso => { if (!iso) return 'unbekannt'; const d = new Date(iso); return d.toLocaleDateString('de-DE') + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'; };

/* ---------- Speichern über Ordnerzugriff: Programmdatei + Ansichts-Excel, automatisch nach Änderungen */
const VIEW_XLSX = 'Jahresplanung – aktueller Stand.xlsx';
const ST = { dir: null, html: null, stamp: null, conn: 'none', saving: false, again: false, conflict: null, lastSave: null, xlsxErr: null, timer: null, watch: null };
const FSA = 'showDirectoryPicker' in window;

// Ordner-Zugriff im Browser merken (IndexedDB), damit beim nächsten Start ein Klick reicht
function idbOpen() { return new Promise((res, rej) => { const r = indexedDB.open('jahresplanung', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbGet(k) { try { const db = await idbOpen(); return await new Promise(res => { const q = db.transaction('h').objectStore('h').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }
async function idbSet(k, v) { try { const db = await idbOpen(); await new Promise(res => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').put(v, k); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* */ } }
const handleKey = () => 'dir:' + (localPath() || location.href);

async function restoreFolder() {
  if (!FSA) return;
  const hnd = await idbGet(handleKey());
  if (!hnd || !hnd.queryPermission) return;
  ST.dir = hnd;
  let p = 'prompt';
  try { p = await hnd.queryPermission({ mode: 'readwrite' }); } catch (e) { /* */ }
  if (p === 'granted') await attachFolder(); else ST.conn = 'needs-permission';
  updateSaveUI();
}
async function findHtml(dir) {
  const name = currentFileName();
  try { return await dir.getFileHandle(name); } catch (e) { /* weiter suchen */ }
  const subs = [], files = [];
  for await (const [n, e] of dir.entries()) { if (e.kind === 'directory' && /^Jahresplanung/i.test(n)) subs.push(e); if (e.kind === 'file' && /^Jahresplanung.*\.html?$/i.test(n)) files.push(e); }
  for (const sd of subs) { try { return await sd.getFileHandle(name); } catch (e) { /* */ } }
  return files[0] || null;
}
async function attachFolder(create) {
  let hf = await findHtml(ST.dir);
  if (!hf && create) hf = await ST.dir.getFileHandle(currentFileName(), { create: true });
  if (!hf) { ST.conn = 'none'; return false; }
  ST.html = hf;
  const f = await hf.getFile();
  ST.stamp = f.lastModified;
  ST.conn = 'ok';
  const other = f.size ? parseFileText(await f.text()) : null;
  if (other && other.meta && other.meta.savedAt && other.meta.savedAt !== D.meta.savedAt && (!D.meta.savedAt || other.meta.savedAt > D.meta.savedAt)) externalChange(other);
  startWatch();
  return true;
}
async function connectFolder() {
  if (!FSA) return false;
  try {
    if (ST.dir && ST.conn === 'needs-permission') {
      if (await ST.dir.requestPermission({ mode: 'readwrite' }) === 'granted' && await attachFolder()) { updateSaveUI(); return true; }
    }
    const p = localPath(), folder = p ? p.slice(0, p.lastIndexOf('\\')) : null;
    const ok = await modal('Speicherort wählen', h('div', { class: 'help' },
      h('p', null, 'Wähle im nächsten Fenster einmalig den Mailing-Ordner (den Ordner, in dem „Jahresplanung starten“ und diese Datei liegen) und bestätige „Bearbeiten zulassen“.'),
      folder ? h('p', { class: 'pathbox' }, folder) : null,
      h('p', null, 'Danach speichert die App automatisch nach jeder Änderung – in die Programmdatei und in die Ansichts-Excel „' + VIEW_XLSX + '“, die sich jede/r auch in Teams ansehen kann.'),
      h('p', { class: 'muted small' }, 'Bei späteren Starts fragt der Browser nur noch einmal kurz, ob die App den Ordner bearbeiten darf.')),
      [['Abbrechen', false], ['Ordner wählen', true, 'primary']]);
    if (!ok) return false;
    const dir = await window.showDirectoryPicker({ id: 'jahresplanung', mode: 'readwrite' });
    ST.dir = dir;
    let found = await findHtml(dir);
    if (!found && !await confirmBox('Hier anlegen?', `In „${dir.name}“ liegt noch keine Jahresplanung. Soll die App hier angelegt werden (Programmdatei „${currentFileName()}“ und Ansichts-Excel)?`, 'Hier anlegen')) { ST.dir = null; return false; }
    await idbSet(handleKey(), dir);
    const res = await attachFolder(true);
    updateSaveUI();
    return res;
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
    console.warn(e); toast('Ordnerzugriff nicht möglich: ' + (e.message || e), 'err');
    return false;
  }
}
function scheduleAutosave() {
  clearTimeout(ST.timer);
  if (UI.autoSave === false || ST.conn !== 'ok' || ST.conflict) return;
  ST.timer = setTimeout(() => saveAll({ auto: true }), 2500);
}
async function saveAll(opts = {}) {
  clearTimeout(ST.timer);
  if (ST.saving) { ST.again = true; return false; }
  if (!FSA) return saveDownload();
  if (ST.conn !== 'ok') {
    if (opts.auto) return false;
    if (!await connectFolder()) return false;
  }
  if (ST.conflict && !opts.force) { if (!opts.auto) toast('Erst den Konflikt oben lösen (Stand laden oder überschreiben).', 'warn'); return false; }
  ST.saving = true; updateSaveUI();
  try {
    const f = await ST.html.getFile();
    if (!opts.force && ST.stamp != null && f.lastModified !== ST.stamp) {
      const other = parseFileText(await f.text());
      if (other && other.meta && other.meta.savedAt !== D.meta.savedAt) { ST.saving = false; externalChange(other); return false; }
      ST.stamp = f.lastModified;
    }
    const data = JSON.parse(JSON.stringify(D));
    data.meta.savedAt = new Date().toISOString();
    data.meta.savedBy = UI.userName || '';
    const w = await ST.html.createWritable();
    await w.write(buildFile(data)); await w.close();
    ST.stamp = (await ST.html.getFile()).lastModified;
    D.meta = data.meta; SAVED_JSON = JSON.stringify(D); clearDraft();
    ST.lastSave = new Date(); ST.conflict = null;
    try {
      derive();
      const xh = await ST.dir.getFileHandle(VIEW_XLSX, { create: true });
      const xw = await xh.createWritable(); await xw.write(viewWorkbook()); await xw.close();
      ST.xlsxErr = null;
    } catch (e) { console.warn(e); ST.xlsxErr = (e && e.message) || String(e); }
    if (!opts.auto) toast(ST.xlsxErr ? 'Gespeichert – aber die Excel-Ansicht konnte nicht aktualisiert werden.' : 'Gespeichert (Programm und Excel-Ansicht)', ST.xlsxErr ? 'warn' : 'ok');
    return true;
  } catch (e) {
    console.warn(e);
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) ST.conn = 'needs-permission';
    toast('Speichern fehlgeschlagen: ' + ((e && e.message) || e), 'err');
    return false;
  } finally {
    ST.saving = false;
    updateSaveUI();
    if (ST.xlsxErr || ST.conflict) safeRender();
    if (ST.again) { ST.again = false; if (isDirty()) scheduleAutosave(); }
  }
}
function save() { return saveAll({ manual: true }); }
async function saveDownload() {
  const data = JSON.parse(JSON.stringify(D));
  data.meta.savedAt = new Date().toISOString(); data.meta.savedBy = UI.userName || '';
  download(currentFileName(), new Blob([buildFile(data)], { type: 'text/html' }));
  D.meta = data.meta; SAVED_JSON = JSON.stringify(D); clearDraft(); updateSaveUI();
  modal('Als Download gespeichert', h('div', null,
    h('p', null, `Dieser Browser kann nicht direkt in den Ordner speichern. Die Datei „${currentFileName()}“ liegt jetzt in deinem Download-Ordner – ersetze damit die bisherige Datei.`),
    h('p', null, 'Die Excel-Ansicht wird nur in Microsoft Edge oder Google Chrome automatisch aktualisiert.')));
  return true;
}
async function saveCopy() {
  const data = JSON.parse(JSON.stringify(D));
  data.meta.savedAt = new Date().toISOString(); data.meta.savedBy = UI.userName || '';
  const text = buildFile(data);
  if ('showSaveFilePicker' in window) {
    try {
      const hnd = await window.showSaveFilePicker({ suggestedName: 'Jahresplanung_Kopie_' + ds(todayDn()) + '.html', types: [{ description: 'Jahresplanung (HTML)', accept: { 'text/html': ['.html'] } }] });
      const w = await hnd.createWritable(); await w.write(text); await w.close();
      toast('Kopie gespeichert: ' + hnd.name, 'ok'); return;
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  download('Jahresplanung_Kopie_' + ds(todayDn()) + '.html', new Blob([text], { type: 'text/html' }));
}

/* ---------- Änderungen anderer erkennen (die Datei wird per OneDrive synchronisiert) */
function externalChange(other) {
  if (!isDirty()) {
    D = normalize(other); SAVED_JSON = JSON.stringify(D); UNDO.length = 0; REDO.length = 0; ST.conflict = null;
    toast('Neuer Stand geladen (gespeichert ' + fmtStamp(other.meta.savedAt) + (other.meta.savedBy ? ' von ' + other.meta.savedBy : '') + ')', 'ok');
    safeRender();
  } else {
    ST.conflict = { other };
    clearTimeout(ST.timer);
    safeRender();
  }
}
function startWatch() {
  clearInterval(ST.watch);
  ST.watch = setInterval(async () => {
    if (ST.conn !== 'ok' || ST.saving || ST.conflict || document.hidden) return;
    try {
      const f = await ST.html.getFile();
      if (f.lastModified === ST.stamp) return;
      const other = parseFileText(await f.text());
      ST.stamp = f.lastModified;
      if (other && other.meta && other.meta.savedAt !== D.meta.savedAt) externalChange(other);
    } catch (e) { /* Datei kurz nicht lesbar (Synchronisierung) */ }
  }, 15000);
}
function resolveConflict(keepMine) {
  const c = ST.conflict; if (!c) return;
  if (keepMine) { ST.conflict = null; saveAll({ force: true }); }
  else { ST.conflict = null; UNDO.push(JSON.stringify(D)); D = normalize(c.other); SAVED_JSON = JSON.stringify(D); clearDraft(); toast('Stand von ' + (c.other.meta.savedBy || 'der Datei') + ' geladen – deine Änderung ist mit Strg+Z zurückholbar (dann speichern).', 'ok'); }
  renderNow();
}
// neu zeichnen, aber nicht mitten im Tippen
function safeRender() {
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.closest('#app')) { ae.addEventListener('blur', () => requestRender(), { once: true }); return; }
  requestRender();
}
function updateSaveUI() {
  const box = $('#savebox');
  if (box) box.replaceWith(saveBox());
  document.title = (isDirty() ? '● ' : '') + 'Jahresplanung ' + (UI.year || '');
}
function saveBox() {
  const dirty = isDirty(), t = ST.lastSave ? ST.lastSave.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
  let label, cls = 'save', tip;
  if (!FSA) { label = dirty ? '● Speichern' : '✓ Gespeichert'; cls += dirty ? ' primary dirty' : ''; tip = 'Speichern lädt die Datei herunter (Browser ohne Ordnerzugriff)'; }
  else if (ST.saving) { label = 'Speichert …'; tip = 'wird gespeichert'; }
  else if (ST.conflict) { label = '⚠ Konflikt'; cls += ' primary'; tip = 'Jemand anderes hat zwischendurch gespeichert – siehe Hinweis oben'; }
  else if (ST.conn === 'none') { label = 'Speichern …'; cls += ' primary' + (dirty ? ' dirty' : ''); tip = 'Einmal den Mailing-Ordner wählen – danach speichert die App automatisch'; }
  else if (ST.conn === 'needs-permission') { label = '🔓 Speichern aktivieren'; cls += ' primary'; tip = 'Ein Klick: der Browser fragt, ob die App den Ordner bearbeiten darf'; }
  else if (dirty) { label = UI.autoSave === false ? '● Speichern' : '● wird gespeichert …'; cls += ' primary dirty'; tip = 'Jetzt speichern (Strg+S)'; }
  else { label = '✓ Gespeichert' + (t ? ' ' + t : ''); tip = 'Programm und Excel-Ansicht sind aktuell' + (ST.xlsxErr ? ' (Excel-Ansicht: Fehler)' : ''); }
  return h('button', { id: 'savebox', class: cls, tip, onclick: () => save() }, label);
}

function pickFileText(accept = '.html,.htm,.json') {
  return new Promise(resolve => {
    const inp = h('input', { type: 'file', accept, style: 'display:none' });
    inp.addEventListener('change', async () => { const f = inp.files[0]; inp.remove(); resolve(f ? { text: await f.text(), name: f.name } : null); });
    document.body.append(inp); inp.click();
  });
}
async function openFile() {
  if (!await confirmBox('Daten übernehmen', 'Die Daten aus einer anderen Jahresplanung-Datei (HTML oder JSON) ersetzen den aktuellen Stand. Danach wird gespeichert. Strg+Z macht es rückgängig.', 'Datei wählen')) return;
  const got = await pickFileText();
  if (!got) return;
  const data = parseFileText(got.text);
  if (!data || !Array.isArray(data.massnahmen)) { toast('In dieser Datei wurden keine Planungsdaten gefunden.', 'err'); return; }
  commit(d => { const n = normalize(JSON.parse(JSON.stringify(data))); n.meta = d.meta; Object.keys(d).forEach(k => delete d[k]); Object.assign(d, n); }, 'Daten aus „' + got.name + '“ übernommen');
}
async function exportJSON() {
  download('Jahresplanung_Daten_' + ds(todayDn()) + '.json', new Blob([JSON.stringify(D, null, 1)], { type: 'application/json' }));
}

/* ---------- Entwurf im Browser (Schutz vor Verlust, falls nicht gespeichert wurde) */
const draftKey = () => 'jp-draft:' + location.pathname;
function saveDraft() {
  try {
    if (isDirty()) localStorage.setItem(draftKey(), JSON.stringify({ base: D.meta.savedAt, at: new Date().toISOString(), data: D }));
    else localStorage.removeItem(draftKey());
  } catch (e) { /* kein Speicher verfügbar */ }
}
function clearDraft() { try { localStorage.removeItem(draftKey()); } catch (e) { /* */ } DRAFT_OFFER = null; }
function checkDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey()) || 'null');
    if (!d || !d.data) return;
    if (d.base !== D.meta.savedAt || JSON.stringify(d.data) === SAVED_JSON) { localStorage.removeItem(draftKey()); return; }
    DRAFT_OFFER = d;
  } catch (e) { /* */ }
}
function restoreDraft() {
  if (!DRAFT_OFFER) return;
  UNDO.push(JSON.stringify(D));
  D = normalize(DRAFT_OFFER.data);
  DRAFT_OFFER = null;
  changed();
  toast('Ungespeicherte Änderungen wiederhergestellt – bitte speichern.', 'ok');
}

function loadData(d) {
  D = d;
  SAVED_JSON = JSON.stringify(D);
  UNDO.length = 0; REDO.length = 0;
  UI.year = D.settings.year || new Date().getFullYear();
  requestRender();
}
