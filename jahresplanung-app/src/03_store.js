/* ===================================================================== Speichern: die Datei speichert sich selbst (App + Daten in einer HTML-Datei) */

const DEFAULT_FILE = 'Jahresplanung_Aussenkommunikation.html';
let DRAFT_OFFER = null;
let BROKEN = null;                            // Daten der geöffneten Datei unlesbar: Speichern gesperrt, bis gültige Daten geladen sind

// Programmversion einer gespeicherten Datei (null bei sehr alten Dateien) und Vergleich „0.6.4“ < „0.7“
const fileVersion = text => ((text || '').match(/const APP_INFO = \{"version": "([^"]+)"/) || [])[1] || null;
function verCmp(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}

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
// Passt der verbundene Speicherort zur geöffneten Datei? (Ordnername als Anhaltspunkt – Pfade gibt der Browser nicht heraus)
function folderMismatch() {
  const p = localPath();
  if (!p || !ST.dir || ST.conn !== 'ok') return null;
  const parts = p.split('\\'), parent = parts[parts.length - 2], grand = parts[parts.length - 3];
  if (parent === ST.dir.name || (/^Jahresplanung/i.test(parent) && grand === ST.dir.name)) return null;
  return { opened: parts.slice(0, -1).join('\\'), connected: ST.dir.name };
}
function openedFromDownloads() {
  const p = localPath();
  return location.protocol !== 'file:' || (p && /\\(Downloads|Download|INetCache|Temp)\\/i.test(p));
}
function buildFile(data, css = $('#jp-style').textContent, js = $('#jp-app').textContent) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const S = 'script';
  return '<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>Jahresplanung Außenkommunikation</title>\n<link rel="icon" href="' + FAVICON + '">\n<style id="jp-style">' + css + '</style>\n</head>\n<body>\n<div id="app"></div>\n' +
    '<' + S + ' type="application/json" id="jp-data">' + json + '</' + S + '>\n<' + S + ' id="jp-app">' + js + '</' + S + '>\n</body>\n</html>\n';
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
const ST = { dir: null, html: null, htmlDir: null, stamp: null, conn: 'none', saving: false, again: false, conflict: null, lastSave: null, xlsxErr: null, timer: null, watch: null,
  newer: null, fail: null, retry: null, xlsxTimer: null, copies: [], tick: 0 };
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
// Programmdatei im Ordner suchen (auch im Unterordner „Jahresplanung …“); liefert Datei und Ordner
async function findHtml(dir) {
  const name = currentFileName();
  try { return { file: await dir.getFileHandle(name), dir }; } catch (e) { /* weiter suchen */ }
  const subs = [], files = [];
  for await (const [n, e] of dir.entries()) { if (e.kind === 'directory' && /^Jahresplanung/i.test(n)) subs.push(e); if (e.kind === 'file' && /^Jahresplanung.*\.html?$/i.test(n)) files.push(e); }
  for (const sd of subs) { try { return { file: await sd.getFileHandle(name), dir: sd }; } catch (e) { /* */ } }
  const main = files.find(f => f.name === DEFAULT_FILE) || files[0];
  return main ? { file: main, dir } : null;
}
async function attachFolder(create) {
  let found = await findHtml(ST.dir);
  if (!found && create) found = { file: await ST.dir.getFileHandle(currentFileName(), { create: true }), dir: ST.dir };
  if (!found) { ST.conn = 'none'; return false; }
  ST.html = found.file; ST.htmlDir = found.dir;
  const f = await ST.html.getFile();
  ST.stamp = f.lastModified;
  ST.conn = 'ok';
  const text = f.size ? await f.text() : '', other = text ? parseFileText(text) : null;
  if (other && BROKEN) {                        // geöffnete Datei kaputt, die im Ordner lesbar: diese nehmen
    BROKEN = null; D = normalize(other); SAVED_JSON = JSON.stringify(D); UNDO.length = 0; REDO.length = 0;
    toast('Die geöffnete Datei war beschädigt – der Stand aus dem Mailing-Ordner wurde geladen.', 'ok');
  } else if (other && other.meta && other.meta.savedAt && other.meta.savedAt !== D.meta.savedAt && (!D.meta.savedAt || other.meta.savedAt > D.meta.savedAt)) externalChange(other, f.lastModified);
  noteNewer(text, other);
  startWatch();
  scanCopies();
  scanUpdatePkg();
  presenceTick();
  SP.at = null; spScan();                       // Spendeneingänge im Hintergrund einlesen (Hinweis am Reiter „Spenden“)
  safeRender();                                 // u. a. Hinweis, falls Datei und Speicherort nicht zusammenpassen
  return true;
}
// Liegt im Ordner eine neuere Programmversion? Dann nicht mehr speichern (sonst käme die alte Version zurück)
function noteNewer(text, other) {
  const v = fileVersion(text);
  if (!v || verCmp(v, APP_INFO.version) <= 0) return false;
  if (!ST.newer) { ST.newer = { version: v, by: other && other.meta ? other.meta.savedBy : '' }; clearTimeout(ST.timer); ST.timer = null; safeRender(); }
  return true;
}
// Name für Protokoll und Anwesenheit: Hinweis oben, solange keiner eingetragen ist (blockiert nichts)
function nameBanner() {
  let v = '';
  const take = () => { if (!v) return; UI.userName = v; saveUI(); presenceTick(); renderNow(); toast('Danke, ' + v + '!', 'ok'); };
  return h('div', { class: 'banner warn' },
    h('span', null, 'Wie heißt du? Der Name steht im Änderungsprotokoll („gespeichert von …“) und zeigt den anderen, wer die Jahresplanung gerade geöffnet hat.'),
    h('input', { placeholder: 'Vorname', 'data-fk': 'username', style: 'width:140px', oninput: e => { v = e.target.value.trim(); }, onkeydown: e => { if (e.key === 'Enter') take(); } }),
    h('button', { class: 'primary', onclick: take }, 'Übernehmen'),
    h('button', { onclick: () => { UI.nameLater = true; renderNow(); } }, 'Später'));
}
/* ---------- Wer arbeitet gerade? Jedes offene App-Fenster legt im Unterordner „Jahresplanung (automatisch)“ eine kleine
   Anwesenheitsdatei ab und erneuert sie alle 30 Sekunden. OneDrive gleicht sie ab – die Anzeige kann also etwas nachhinken. */
const APP_DIR = 'Jahresplanung (automatisch)', INST = uid(), PRESENCE = { others: [], key: '', since: null };
async function presenceTick() {
  if (!FSA || ST.conn !== 'ok' || !ST.htmlDir || document.hidden) return;
  try {
    const dir = await ST.htmlDir.getDirectoryHandle(APP_DIR, { create: true }), mine = 'anwesend-' + INST + '.json';
    PRESENCE.since = PRESENCE.since || new Date().toISOString();
    const w = await (await dir.getFileHandle(mine, { create: true })).createWritable();
    await w.write(JSON.stringify({ name: UI.userName || '', inst: INST, since: PRESENCE.since, at: new Date().toISOString(), edit: LAST_EDIT, version: APP_INFO.version })); await w.close();
    const others = [], now = Date.now();
    for await (const [n, e] of dir.entries()) {
      if (e.kind !== 'file' || !/^anwesend-.+\.json$/.test(n) || n === mine) continue;
      try {
        const o = JSON.parse(await (await e.getFile()).text()), age = now - Date.parse(o.at);
        if (!(age < 86400000)) { dir.removeEntry(n).catch(() => {}); continue; }      // alte Dateien aufräumen
        if (age < 180000) others.push(o);
      } catch (x) { /* halb synchronisiert: nächstes Mal */ }
    }
    const key = JSON.stringify(others.map(o => [o.inst, o.name, o.edit]));
    if (key !== PRESENCE.key) { PRESENCE.key = key; PRESENCE.others = others; safeRender(); }
  } catch (e) { console.warn(e); }
}
window.addEventListener('pagehide', () => {
  if (ST.htmlDir && ST.conn === 'ok') ST.htmlDir.getDirectoryHandle(APP_DIR).then(d => d.removeEntry('anwesend-' + INST + '.json')).catch(() => {});
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) presenceTick(); });
function reloadForNewer() {
  saveDraft();                                  // ungespeicherte Änderungen bleiben im Browser und werden nach dem Neustart angeboten
  window.__jpReload = true;
  location.reload();
}
function askPermissionOnFirstClick() {
  if (!FSA || ST.conn !== 'needs-permission' || ST.askArmed) return;
  ST.askArmed = true;
  const ask = () => {
    document.removeEventListener('pointerdown', ask, true); document.removeEventListener('keydown', ask, true);
    ST.askArmed = false;
    if (ST.conn !== 'needs-permission' || !ST.dir) return;
    ST.perm = ST.dir.requestPermission({ mode: 'readwrite' }).then(async p => {
      if (p === 'granted' && await attachFolder()) { updateSaveUI(); releasePointer(); safeRender(); if (isDirty()) scheduleAutosave(); }
      return p;
    }).catch(() => 'denied').finally(() => { ST.perm = null; });
  };
  document.addEventListener('pointerdown', ask, true); document.addEventListener('keydown', ask, true);
}
async function connectFolder() {
  if (!FSA) return false;
  if (ST.perm) { await ST.perm; if (ST.conn === 'ok') return true; }
  try {
    if (ST.dir && ST.conn === 'needs-permission') {
      if (await ST.dir.requestPermission({ mode: 'readwrite' }) === 'granted' && await attachFolder()) { updateSaveUI(); return true; }
    }
    const p = localPath(), folder = p ? p.slice(0, p.lastIndexOf('\\')) : null;
    const ok = await modal('Speicherort wählen', h('div', { class: 'help' },
      h('p', null, 'Wähle im nächsten Fenster einmalig den Mailing-Ordner (den Ordner, in dem diese Datei liegt) und bestätige „Bearbeiten zulassen“.'),
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
  clearTimeout(ST.timer); ST.timer = null;
  if (UI.autoSave === false || ST.conn !== 'ok' || ST.conflict || ST.newer || BROKEN) return;
  ST.timer = setTimeout(() => { ST.timer = null; saveAll({ auto: true }); }, 2500);
}
async function saveAll(opts = {}) {
  clearTimeout(ST.timer); ST.timer = null;
  if (BROKEN) { if (!opts.auto) toast('Speichern ist gesperrt: Die Daten dieser Datei waren beschädigt. Erst eine Datensicherung laden (Hinweis oben).', 'err'); return false; }
  if (ST.newer && !opts.force) { if (!opts.auto) toast('Im Ordner liegt eine neuere Programmversion (' + ST.newer.version + '). Bitte zuerst neu starten (Hinweis oben).', 'err'); return false; }
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
      const text = await f.text(), other = parseFileText(text);
      if (noteNewer(text, other)) { ST.saving = false; if (!isDirty() && other) externalChange(other, f.lastModified); return false; }
      if (!other && text.length) {                // Datei gerade unlesbar (z. B. halb synchronisiert): nicht blind überschreiben
        ST.saving = false; throw Object.assign(new Error('Die Datei im Ordner ist gerade nicht lesbar (wird sie synchronisiert?)'), { name: 'Unreadable' });
      }
      if (other && other.meta && other.meta.savedAt !== D.meta.savedAt) { ST.saving = false; externalChange(other, f.lastModified); return false; }
      ST.stamp = f.lastModified;
    }
    const data = JSON.parse(JSON.stringify(D));
    data.meta.savedAt = new Date().toISOString();
    data.meta.savedBy = UI.userName || '';
    data.meta.rev = (+D.meta.rev || 0) + 1;                 // Datenstand-Nummer, zählt jedes Speichern
    data.log = logWithEntry(data.meta);                     // Änderungsprotokoll: was seit dem letzten Speichern geändert wurde
    const w = await ST.html.createWritable();
    await w.write(buildFile(data)); await w.close();
    ST.stamp = (await ST.html.getFile()).lastModified;
    D.meta = data.meta; D.log = data.log; SAVED_JSON = JSON.stringify(D); clearDraft();
    ST.lastSave = new Date(); ST.conflict = null;
    if (ST.fail) { if (ST.fail.n > 1) toast('Wieder gespeichert.', 'ok'); ST.fail = null; }
    clearTimeout(ST.retry); ST.retry = null;
    await writeViewXlsx();
    if (!opts.auto) toast(ST.xlsxErr ? 'Gespeichert – aber die Excel-Ansicht konnte nicht aktualisiert werden.' : 'Gespeichert (Programm und Excel-Ansicht)', ST.xlsxErr ? 'warn' : 'ok');
    return true;
  } catch (e) {
    console.warn(e);
    const perm = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    ST.fail = { msg: (e && e.message) || String(e), n: (ST.fail ? ST.fail.n : 0) + 1, at: new Date() };
    if (perm) { ST.conn = 'needs-permission'; askPermissionOnFirstClick(); }
    else {                                        // z. B. Datei kurz gesperrt (OneDrive, Virenscanner): automatisch erneut versuchen
      clearTimeout(ST.retry);
      ST.retry = setTimeout(() => { ST.retry = null; if (isDirty()) saveAll({ auto: true }); }, Math.min(60000, 5000 * 2 ** (ST.fail.n - 1)));
    }
    if (!opts.auto || ST.fail.n === 1) toast('Speichern fehlgeschlagen: ' + ST.fail.msg + (perm ? '' : ' – neuer Versuch läuft automatisch.'), 'err');
    return false;
  } finally {
    ST.saving = false;
    updateSaveUI();
    if (ST.xlsxErr || ST.conflict) safeRender();
    if (ST.again) { ST.again = false; if (isDirty()) scheduleAutosave(); }
  }
}
function save() { return saveAll({ manual: true }); }
// Protokoll = bisherige Einträge (aus Datei und aktuellem Stand zusammengeführt) + ein Eintrag mit den Änderungen seit dem letzten Speichern
function logWithEntry(meta) {
  let base = {}; try { base = JSON.parse(SAVED_JSON) || {}; } catch (e) { /* */ }
  const seen = new Set(), all = [];
  for (const e of [...(base.log || []), ...(D.log || [])]) { const k = e.at + '|' + e.by + '|' + (e.items || []).join('|'); if (!seen.has(k)) { seen.add(k); all.push(e); } }
  all.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const items = base.massnahmen ? describeChanges(base, D) : [];
  if (items.length) all.push({ at: meta.savedAt, by: meta.savedBy || '', items });
  return all.slice(-LOG_MAX);
}
// Ansichts-Excel (für Teams) schreiben; klappt es nicht (z. B. gerade in Excel geöffnet), später erneut versuchen
async function writeViewXlsx() {
  clearTimeout(ST.xlsxTimer); ST.xlsxTimer = null;
  if (!ST.dir || ST.conn !== 'ok') return;
  try {
    derive();
    const xh = await ST.dir.getFileHandle(VIEW_XLSX, { create: true });
    const xw = await xh.createWritable(); await xw.write(viewWorkbook({ year: +D.settings.year || UI.year })); await xw.close();
    if (ST.xlsxErr) { ST.xlsxErr = null; safeRender(); }
  } catch (e) {
    console.warn(e); ST.xlsxErr = (e && e.message) || String(e);
    ST.xlsxTimer = setTimeout(writeViewXlsx, 30000);
  }
}
async function saveDownload() {
  const data = JSON.parse(JSON.stringify(D));
  data.meta.savedAt = new Date().toISOString(); data.meta.savedBy = UI.userName || ''; data.meta.rev = (+D.meta.rev || 0) + 1;
  data.log = logWithEntry(data.meta);
  download(currentFileName(), new Blob([buildFile(data)], { type: 'text/html' }));
  D.meta = data.meta; D.log = data.log; SAVED_JSON = JSON.stringify(D); clearDraft(); updateSaveUI();
  modal('Als Download gespeichert', h('div', null,
    h('p', null, `${browserName()} kann nicht direkt in den Mailing-Ordner speichern. Die Datei „${currentFileName()}“ liegt jetzt in deinem Download-Ordner – ersetze damit die bisherige Datei.`),
    h('p', null, 'Mit Microsoft Edge oder Google Chrome speichert die Jahresplanung automatisch in den Mailing-Ordner.')),
    [['Edge oder Chrome einrichten …', () => { setTimeout(browserDialog, 0); return true; }], ['OK', true, 'primary']]);
  return true;
}
// Welcher Browser? (nur für Hinweise) – Brave sperrt den Ordnerzugriff, Firefox und Safari haben ihn nicht
function browserName() {
  const u = navigator.userAgent;
  return navigator.brave ? 'Brave' : /Firefox\//.test(u) ? 'Firefox' : /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Vivaldi/.test(u) ? 'Vivaldi' : /Chrome\//.test(u) ? 'Dieser Browser' : /Safari\//.test(u) ? 'Safari' : 'Dieser Browser';
}
// Browser ohne Ordnerzugriff: Zusammenhang erklären und Edge/Chrome als Standardbrowser anbieten
function browserDialog() {
  const b = browserName(), inB = b === 'Dieser Browser' ? 'diesem Browser' : b;
  modal('Edge oder Chrome als Standardbrowser', h('div', { class: 'help brw' },
    h('p', null, 'Die Jahresplanung speichert automatisch direkt in die Programmdatei im Mailing-Ordner – das können nur ', h('b', null, 'Microsoft Edge'), ' und ', h('b', null, 'Google Chrome'), '. ',
      'In ' + inB + ' landet jede Änderung nur als Download: Die gemeinsame Datei im Mailing-Ordner bleibt unverändert, die anderen sehen deine Änderungen nicht, und die Spendeneingänge lassen sich nicht einlesen.'),
    h('h3', null, 'Edge oder Chrome als Standardbrowser festlegen (Windows 10/11)'),
    h('ol', null,
      h('li', null, 'Windows-Einstellungen öffnen – Knopf unten oder Start → Einstellungen.'),
      h('li', null, '„Apps“ → „Standard-Apps“.'),
      h('li', null, '„Microsoft Edge“ oder „Google Chrome“ wählen und „Als Standard festlegen“ klicken.'),
      h('li', null, 'Die Jahresplanung schließen und neu öffnen.')),
    h('p', null, h('a', { class: 'brw-btn', href: 'ms-settings:defaultapps' }, 'Windows-Einstellungen „Standard-Apps“ öffnen')),
    h('h3', null, 'Standardbrowser lieber behalten?'),
    h('p', null, 'Dann die Jahresplanung gezielt mit Edge öffnen: Rechtsklick auf „Jahresplanung_Aussenkommunikation.html“ → „Öffnen mit“ → „Microsoft Edge“.')),
    [['Schließen', true, 'primary']], { wide: true });
}
/* ---------- Änderungen anderer erkennen (die Datei wird per OneDrive synchronisiert) */
function externalChange(other, stamp) {
  if (!isDirty() || BROKEN) {
    D = normalize(other); SAVED_JSON = JSON.stringify(D); UNDO.length = 0; REDO.length = 0; ST.conflict = null; BROKEN = null;
    if (stamp != null) ST.stamp = stamp;
    toast('Neuer Stand geladen (gespeichert ' + fmtStamp(other.meta.savedAt) + (other.meta.savedBy ? ' von ' + other.meta.savedBy : '') + ')', 'ok');
    safeRender();
  } else {
    ST.conflict = { other, stamp };
    clearTimeout(ST.timer); ST.timer = null;
    safeRender();
  }
}
function startWatch() {
  clearInterval(ST.watch);
  ST.watch = setInterval(async () => {
    if (ST.conn !== 'ok' || ST.saving || document.hidden) return;
    ST.tick++;
    if (ST.tick % 4 === 0) scanCopies();                          // etwa jede Minute: Konfliktkopien von OneDrive?
    if (ST.tick % 4 === 2) scanUpdatePkg();                       // etwa jede Minute: Update-Paket im Mailing-Ordner?
    if (ST.tick % 2 === 0) presenceTick();                        // alle 30 Sekunden: wer arbeitet noch in der Jahresplanung?
    if (ST.conflict) return;
    try {
      const f = await ST.html.getFile();
      if (f.lastModified !== ST.stamp) {
        const text = await f.text(), other = parseFileText(text);
        if (!other) return;                                        // Datei kurz nicht lesbar (Synchronisierung): beim nächsten Mal
        ST.stamp = f.lastModified;
        if (noteNewer(text, other)) { if (!isDirty()) externalChange(other, f.lastModified); return; }
        if (other.meta && other.meta.savedAt !== D.meta.savedAt) { externalChange(other, f.lastModified); return; }
      }
      // Sicherheitsnetz: ungespeichert, aber kein Speichern geplant → jetzt speichern
      if (isDirty() && !ST.timer && !ST.retry && UI.autoSave !== false && !ST.newer && !BROKEN) saveAll({ auto: true });
    } catch (e) { /* Datei kurz nicht lesbar (Synchronisierung) */ }
  }, 15000);
}
// Konflikt lösen: zusammenführen (empfohlen), meinen Stand behalten oder den anderen laden
async function resolveConflict(how) {
  const c = ST.conflict; if (!c) return;
  if (how === 'merge') {
    const theirs = normalize(JSON.parse(JSON.stringify(c.other)));
    const merged = await mergeWithUI(JSON.parse(SAVED_JSON), D, theirs, c.other.meta.savedBy || 'der/die andere');
    if (!merged || ST.conflict !== c) return;
    ST.conflict = null; UNDO.push(JSON.stringify(D)); REDO.length = 0;
    D = merged; SAVED_JSON = JSON.stringify(theirs); if (c.stamp != null) ST.stamp = c.stamp;
    toast('Zusammengeführt – wird gespeichert.', 'ok');
    changed(); saveAll({ auto: true });
  } else if (how === 'mine') { ST.conflict = null; saveAll({ force: true }); }
  else { ST.conflict = null; UNDO.push(JSON.stringify(D)); D = normalize(c.other); SAVED_JSON = JSON.stringify(D); if (c.stamp != null) ST.stamp = c.stamp; clearDraft(); toast('Stand von ' + (c.other.meta.savedBy || 'der Datei') + ' geladen – deine Änderung ist mit Strg+Z zurückholbar (dann speichern).', 'ok'); }
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
  else if (BROKEN) { label = '⚠ Speichern gesperrt'; cls += ' primary'; tip = 'Die Daten dieser Datei waren beschädigt – siehe Hinweis oben'; }
  else if (ST.newer) { label = '⚠ Neustart nötig'; cls += ' primary'; tip = 'Im Ordner liegt eine neuere Programmversion – siehe Hinweis oben'; }
  else if (ST.conflict) { label = '⚠ Konflikt'; cls += ' primary'; tip = 'Jemand anderes hat zwischendurch gespeichert – siehe Hinweis oben'; }
  else if (ST.conn === 'none') { label = 'Speichern …'; cls += ' primary' + (dirty ? ' dirty' : ''); tip = 'Einmal den Mailing-Ordner wählen – danach speichert die App automatisch'; }
  else if (ST.conn === 'needs-permission') { label = '🔓 Speichern aktivieren'; cls += ' primary'; tip = 'Ein Klick: der Browser fragt, ob die App den Ordner bearbeiten darf'; }
  else if (ST.fail && dirty) { label = '⚠ Nicht gespeichert'; cls += ' primary dirty'; tip = 'Speichern fehlgeschlagen: ' + ST.fail.msg + '. Neuer Versuch läuft automatisch – oder hier klicken.'; }
  else if (dirty) { label = UI.autoSave === false ? '● Speichern' : '● wird gespeichert …'; cls += ' primary dirty'; tip = 'Jetzt speichern (Strg+S)'; }
  else { label = '✓ Gespeichert' + (t ? ' ' + t : ''); cls += ' ok'; tip = 'Programm und Excel-Ansicht sind aktuell' + (ST.xlsxErr ? ' (Excel-Ansicht: Fehler)' : ''); }
  return h('button', { id: 'savebox', class: cls, tip, onclick: () => save() }, label);
}

function pickFileText(accept = '.html,.htm,.json') {
  return new Promise(resolve => {
    const inp = h('input', { type: 'file', accept, style: 'display:none' });
    inp.addEventListener('change', async () => { const f = inp.files[0]; inp.remove(); resolve(f ? { text: await f.text(), name: f.name } : null); });
    document.body.append(inp); inp.click();
  });
}
// Sicherung hochladen: eine Sicherung (.json) oder ältere Kopie der Programmdatei ersetzt den aktuellen Stand (für alle).
// Vorher wird der aktuelle Stand als Sicherung heruntergeladen; Strg+Z macht es rückgängig.
async function openFile(noAsk) {
  if (!noAsk && !await confirmBox('Sicherung hochladen', 'Die Daten aus der Sicherung (.json oder eine ältere Kopie der Programmdatei) ersetzen den aktuellen Stand – für alle, die mit der Jahresplanung arbeiten. Der aktuelle Stand wird vorher als Sicherung heruntergeladen; Strg+Z macht es rückgängig.', 'Sicherung wählen …')) return;
  const got = await pickFileText();
  if (!got) return;
  const data = parseFileText(got.text);
  if (!data || !Array.isArray(data.massnahmen)) { toast('In dieser Datei wurden keine Planungsdaten gefunden.', 'err'); return; }
  if (!noAsk && !BROKEN) exportJSON();
  if (commit(d => { const n = normalize(JSON.parse(JSON.stringify(data))); n.meta = d.meta; Object.keys(d).forEach(k => delete d[k]); Object.assign(d, n); }, 'Sicherung „' + got.name + '“ hochgeladen') && BROKEN) {
    BROKEN = null; toast('Daten geladen – Speichern ist wieder möglich.', 'ok'); scheduleAutosave(); renderNow();
  }
}
// Beim Start: Daten der Datei unlesbar → erklären und Wege zurück anbieten (nichts überschreiben)
async function brokenDialog() {
  if (!BROKEN) return;
  const dr = readDraft();
  const r = await modal('Planungsdaten beschädigt', h('div', { class: 'help' },
    h('p', null, 'Die Planungsdaten in dieser Datei lassen sich nicht lesen (' + BROKEN.reason + '). Die App zeigt deshalb nichts an und speichert nicht – so wird die Datei nicht mit einem leeren Stand überschrieben.'),
    h('p', null, 'Wege zurück:'),
    h('ul', null,
      dr ? h('li', null, 'den Stand aus diesem Browser vom ' + fmtStamp(dr.at) + ' wiederherstellen') : null,
      h('li', null, 'eine Datensicherung (.json) oder eine ältere Kopie der Programmdatei laden'),
      h('li', null, 'in Teams/SharePoint im Mailing-Ordner über „Versionsverlauf“ eine ältere Fassung der Datei wiederherstellen und neu starten'))),
    [['Nur ansehen', false], dr ? ['Browser-Stand wiederherstellen', 'draft'] : null, ['Datensicherung laden …', 'file', 'primary']].filter(Boolean));
  if (r === 'draft') {
    UNDO.push(JSON.stringify(D)); D = normalize(dr.data); BROKEN = null; DRAFT_OFFER = null;
    changed(); toast('Stand aus dem Browser wiederhergestellt – wird gespeichert.', 'ok');
  } else if (r === 'file') await openFile(true);
}
/* ---------- Programm-Update: aus dem ZIP-Paket (ohne Entpacken) oder aus der Programmdatei.
   Das Paket lässt sich wählen, ins Fenster ziehen oder im Mailing-Ordner ablegen (die App findet es dort selbst). */
const UPD_ZIP_RE = /^Jahresplanung.*\.zip$/i;
function pickFileRaw(accept) {
  return new Promise(resolve => {
    const inp = h('input', { type: 'file', accept, style: 'display:none' });
    inp.addEventListener('change', () => { const f = inp.files[0]; inp.remove(); resolve(f || null); });
    document.body.append(inp); inp.click();
  });
}
// Programmdatei aus einer gewählten Datei holen: ZIP-Paket (die HTML darin) oder die HTML selbst
async function programFromFile(file) {
  if (/\.zip$/i.test(file.name)) {
    let z; try { z = zipIndex(await file.arrayBuffer()); } catch (e) { return { err: '„' + file.name + '“ ist kein lesbares ZIP-Paket.' }; }
    const names = [...z.out.keys()].filter(n => /(^|\/)Jahresplanung[^/]*\.html?$/i.test(n) && !/(^|\/)__MACOSX\//.test(n));
    const inner = names.find(n => n.split('/').pop() === DEFAULT_FILE) || names[0];
    if (!inner) return { err: 'Im Paket „' + file.name + '“ steckt keine Programmdatei (' + DEFAULT_FILE + ').' };
    try { return { text: await zipText(z, inner), name: file.name }; } catch (e) { return { err: '„' + file.name + '“ lässt sich nicht entpacken (' + e.message + ').' }; }
  }
  return { text: await file.text(), name: file.name };
}
function parseProgram(text) {
  const st = text.match(/<style id="jp-style">([\s\S]*?)<\/style>/), app = text.match(/<script id="jp-app">([\s\S]*)<\/script>\s*<\/body>/);
  if (!st || !app) return null;
  const ver = (app[1].match(/const APP_INFO = (\{[^}]*\});/) || [])[1];
  let info = null; try { info = ver ? JSON.parse(ver) : null; } catch (e) { /* ältere Version ohne Nummer */ }
  return { css: st[1], js: app[1], info };
}
// Update-Paket im Mailing-Ordner (oder im Unterordner der Programmdatei) suchen; nur neuere Versionen melden
const _zipSeen = new Map(); let _zipBusy = false;
async function scanUpdatePkg() {
  if (_zipBusy || !FSA || ST.conn !== 'ok' || !ST.dir) return;
  _zipBusy = true;
  try {
    let best = null;
    for (const dir of [...new Set([ST.dir, ST.htmlDir].filter(Boolean))]) {
      for await (const [n, e] of dir.entries()) {
        if (e.kind !== 'file' || !UPD_ZIP_RE.test(n)) continue;
        const f = await e.getFile(), key = dir.name + '/' + n + '@' + f.lastModified + '@' + f.size;
        if (!_zipSeen.has(key)) { let info = null; try { const g = await programFromFile(f), pr = g.text ? parseProgram(g.text) : null; info = pr && pr.info; } catch (x) { /* halb synchronisiert: nächstes Mal */ } _zipSeen.set(key, info); }
        const info = _zipSeen.get(key);
        if (info && info.version && verCmp(info.version, APP_INFO.version) > 0 && (!best || verCmp(info.version, best.info.version) > 0)) best = { name: n, handle: e, dir, info };
      }
    }
    const k = o => o ? o.dir.name + '/' + o.name + '@' + o.info.version : '';
    if (k(best) !== k(ST.zipUpd)) { ST.zipUpd = best; safeRender(); }
  } catch (e) { console.warn(e); }
  finally { _zipBusy = false; }
}
function zipBanner() {
  const z = ST.zipUpd; if (!z || ST.newer || UI._zipHide === z.name + '@' + z.info.version) return null;
  return h('div', { class: 'banner upd' },
    h('span', null, 'Im Mailing-Ordner liegt das Update-Paket „' + z.name + '“ mit Version ' + z.info.version + (z.info.date ? ' (' + fmtIsoLocal(z.info.date) + ')' : '') + ' – installiert ist Version ' + APP_INFO.version + '.'),
    h('button', { class: 'primary', onclick: async () => { const f = await z.handle.getFile().catch(() => null); if (!f) { toast('Das Paket ist nicht mehr da.', 'warn'); ST.zipUpd = null; renderNow(); return; } updateProgram(Object.assign(await programFromFile(f), { pkg: z })); } }, 'Jetzt einspielen …'),
    h('button', { onclick: () => { UI._zipHide = z.name + '@' + z.info.version; renderNow(); } }, 'Später'));
}
// Update-Paket ins Fenster ziehen; andere Dateien öffnet der Browser nie (das würde die App verlassen)
document.addEventListener('dragover', e => { if ([...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files')) e.preventDefault(); });
document.addEventListener('drop', async e => {
  const fl = [...((e.dataTransfer && e.dataTransfer.files) || [])]; if (!fl.length) return;
  e.preventDefault();
  const pk = fl.find(f => /\.zip$/i.test(f.name));
  if (pk) { if ($('.modal')) return; updateProgram(await programFromFile(pk)); }
  else if (!e.spHandled) toast('Hier lässt sich ein Update-Paket (.zip) ablegen. Spendeneingänge (CSV/Excel) im Reiter „Auswertung“ ins Fenster ziehen.', 'warn');
});
// Neue Programmversion übernehmen: Code aus dem Paket bzw. der Datei, Daten von hier
async function updateProgram(got) {
  if (BROKEN) { toast('Erst die beschädigten Daten wiederherstellen (Hinweis oben) – sonst würde das Update einen leeren Stand speichern.', 'err'); return; }
  if (!got || got instanceof Event) {
    if (!await confirmBox('Programm-Update einspielen', 'Wähle das Update-Paket „Jahresplanung_fuer_Mailing-Ordner.zip“ – entpacken ist nicht nötig (die Programmdatei ' + DEFAULT_FILE + ' geht auch). Noch einfacher: das Paket ins Fenster ziehen oder im Mailing-Ordner speichern – die App meldet es dann von selbst. Deine Daten bleiben erhalten, nur das Programm wird ersetzt. Zur Sicherheit wird vorher eine Datensicherung (.json) heruntergeladen.', 'Datei wählen')) return;
    const f = await pickFileRaw('.zip,.html,.htm'); if (!f) return;
    got = await programFromFile(f);
  }
  if (got.err) { modal('Kein Update-Paket', h('p', null, got.err)); return; }
  const prog = parseProgram(got.text || '');
  if (!prog) { modal('Keine Programmdatei', h('p', null, '„' + got.name + '“ ist keine Jahresplanung-Programmdatei. Bitte das Update-Paket (.zip) oder die Datei ' + DEFAULT_FILE + ' wählen.')); return; }
  const st = [null, prog.css], app = [null, prog.js], info = prog.info;
  if ((!info || verCmp(info.version, APP_INFO.version) < 0) && !await confirmBox('Ältere Version?', 'Die gewählte Datei hat ' + (info ? 'Version ' + info.version : 'keine Versionsnummer') +
    ' und ist älter als die installierte Version ' + APP_INFO.version + '. Damit würde das Programm zurückgestuft. Wirklich einspielen?', 'Trotzdem einspielen')) return;
  let delPkg = !!got.pkg;
  if (!await modal('Update übernehmen?', h('div', null,
    h('p', null, 'Installiert: Version ' + APP_INFO.version + ' · Neu: ' + (info ? 'Version ' + info.version + ' (' + fmtIsoLocal(info.date) + ')' : 'ohne Versionsnummer') + (/\.zip$/i.test(got.name) ? ' aus „' + got.name + '“' : '') + '. Danach startet das Programm neu.'),
    got.pkg ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true, onchange: e => { delPkg = e.target.checked; } }), 'Update-Paket danach aus dem Mailing-Ordner löschen') : null),
    [['Abbrechen', false], ['Übernehmen', true, 'primary']])) return;
  const newFile = () => { const data = JSON.parse(JSON.stringify(D)); data.meta.savedAt = new Date().toISOString(); data.meta.savedBy = UI.userName || ''; return buildFile(data, st[1], app[1]); };
  // gelingt das Speichern im Ordner nicht: aktualisierte Datei zum Herunterladen anbieten
  const fail = async reason => {
    const dl = await modal('Update nicht gespeichert', h('div', { class: 'help' }, h('p', null, reason),
      h('p', null, 'Ausweg: Lade die aktualisierte Datei herunter (neues Programm mit deinen aktuellen Daten) und ersetze damit im Explorer die Datei „' + currentFileName() + '“ im Mailing-Ordner. Vorher alle App-Fenster schließen.')),
      [['Schließen', false], ['Aktualisierte Datei herunterladen', true, 'primary']]);
    if (dl) download(currentFileName(), new Blob([newFile()], { type: 'text/html' }));
  };
  if (!FSA) { exportJSON(); return fail('Dieser Browser kann nicht direkt in den Mailing-Ordner schreiben (am besten Edge oder Chrome verwenden).'); }
  if (ST.conn !== 'ok' && !await connectFolder()) return fail('Die App hat keinen Zugriff auf den Mailing-Ordner bekommen (Frage des Browsers abgelehnt oder Ordnerwahl abgebrochen).');
  exportJSON();
  for (let i = 0; i < 60 && ST.saving; i++) await new Promise(r => setTimeout(r, 100));   // laufendes Speichern abwarten
  const oldCss = $('#jp-style').textContent, oldJs = $('#jp-app').textContent;
  $('#jp-style').textContent = st[1]; $('#jp-app').textContent = app[1];
  let ok = false, saved = '';
  try { ok = await saveAll({ manual: true, force: true }); saved = ok ? await (await ST.html.getFile()).text() : ''; } catch (e) { console.warn(e); }
  const savedVer = (saved.match(/const APP_INFO = \{"version": "([^"]+)"/) || [])[1];
  if (!ok || !saved.includes(app[1].slice(-400)) || (info && savedVer !== info.version)) {
    $('#jp-style').textContent = oldCss; $('#jp-app').textContent = oldJs;
    return fail('Die neue Version konnte nicht in „' + (ST.html ? ST.html.name : currentFileName()) + '“ im Ordner „' + (ST.dir ? ST.dir.name : '?') + '“ geschrieben werden.');
  }
  if (got.pkg && delPkg) { try { await got.pkg.dir.removeEntry(got.pkg.name); ST.zipUpd = null; } catch (e) { console.warn(e); } }   // Paket ist eingespielt
  // wurde die App aus einem anderen Ordner geöffnet, zeigt ein Neustart hier weiter die alte Version
  const mm = folderMismatch();
  if (mm) {
    await modal('Update gespeichert – aber woanders', h('div', { class: 'help' },
      h('p', null, 'Version ' + (info ? info.version : '') + ' liegt jetzt im verbundenen Ordner „' + mm.connected + '“.'),
      h('p', null, 'Geöffnet ist aber die Datei aus:'), h('p', { class: 'pathbox' }, mm.opened),
      h('p', null, 'Bitte dieses Fenster schließen und „' + DEFAULT_FILE + '“ in dem Ordner öffnen, in dem gespeichert werden soll (im Windows-Explorer doppelklicken).')));
    return;
  }
  toast('Update gespeichert – Neustart …', 'ok');
  setTimeout(() => location.reload(), 900);
}
async function exportJSON() {
  download('Jahresplanung_Daten_' + ds(todayDn()) + '.json', new Blob([JSON.stringify(D, null, 1)], { type: 'application/json' }));
}
// Sicherung speichern: alle Planungsdaten als eigene Datei (.json) – Speicherort selbst wählen (sonst Download-Ordner)
async function saveBackup() {
  const name = 'Jahresplanung_Sicherung_' + ds(todayDn()) + '.json', blob = new Blob([JSON.stringify(D, null, 1)], { type: 'application/json' });
  if ('showSaveFilePicker' in window) {
    try {
      const hnd = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Sicherung der Jahresplanung (JSON)', accept: { 'application/json': ['.json'] } }] });
      const w = await hnd.createWritable(); await w.write(blob); await w.close();
      toast('Sicherung gespeichert: ' + hnd.name, 'ok'); return true;
    } catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  download(name, blob); toast('Sicherung im Download-Ordner gespeichert: ' + name, 'ok'); return true;
}

/* ---------- Entwurf im Browser (Schutz vor Verlust, falls nicht gespeichert wurde) */
const draftKey = () => 'jp-draft:' + location.pathname;
function saveDraft() {
  try {
    if (isDirty() && !BROKEN) localStorage.setItem(draftKey(), JSON.stringify({ base: D.meta.savedAt, baseData: SAVED_JSON, at: new Date().toISOString(), data: D }));
    else localStorage.removeItem(draftKey());
  } catch (e) { /* kein Speicher verfügbar */ }
}
function clearDraft() { try { localStorage.removeItem(draftKey()); } catch (e) { /* */ } DRAFT_OFFER = null; }
function readDraft() { try { const d = JSON.parse(localStorage.getItem(draftKey()) || 'null'); return d && d.data ? d : null; } catch (e) { return null; } }
function checkDraft() {
  const d = readDraft(); if (!d) return;
  if (BROKEN) { DRAFT_OFFER = null; return; }                       // wird im Dialog zur beschädigten Datei angeboten
  if (JSON.stringify(normalize(JSON.parse(JSON.stringify(d.data)))) === SAVED_JSON) { clearDraft(); return; }   // nichts Neues
  DRAFT_OFFER = Object.assign(d, { sameBase: d.base === D.meta.savedAt });
}
async function restoreDraft() {
  const dr = DRAFT_OFFER; if (!dr) return;
  let next;
  if (dr.sameBase) next = normalize(dr.data);
  else {                                                            // inzwischen neu gespeichert: nur die eigenen Änderungen darüberlegen
    const base = dr.baseData ? JSON.parse(dr.baseData) : null;
    next = base ? await mergeWithUI(normalize(base), normalize(dr.data), JSON.parse(SAVED_JSON), D.meta.savedBy || 'der aktuelle Stand')
      : await compareDialog(normalize(dr.data), 'deinen ungespeicherten Änderungen vom ' + fmtStamp(dr.at));
    if (!next) return;
  }
  UNDO.push(JSON.stringify(D));
  D = next;
  DRAFT_OFFER = null;
  changed();
  toast('Ungespeicherte Änderungen wiederhergestellt – werden gespeichert.', 'ok');
}

const BASE_NAME = DEFAULT_FILE.replace(/\.html$/, '');
const isCopyName = n => n !== DEFAULT_FILE && n.toLowerCase().startsWith(BASE_NAME.toLowerCase()) && /\.html?$/i.test(n);
const inCopy = () => currentFileName() !== DEFAULT_FILE && isCopyName(currentFileName());
let _scanBusy = false;
async function scanCopies() {
  if (_scanBusy || !ST.htmlDir || ST.conn !== 'ok') return;
  _scanBusy = true;
  try {
    const found = [];
    ST.mainExists = false;
    for await (const [n, e] of ST.htmlDir.entries()) {
      if (e.kind !== 'file') continue;
      if (n === DEFAULT_FILE) ST.mainExists = true;
      if (!isCopyName(n) || n === currentFileName()) continue;
      const f = await e.getFile(), key = n + '@' + f.lastModified;
      const old = ST.copies.find(c => c.key === key);
      if (old) { found.push(old); continue; }
      const data = parseFileText(await f.text());
      if (!data || !Array.isArray(data.massnahmen)) continue;
      const nd = normalize(JSON.parse(JSON.stringify(data)));
      found.push({ name: n, key, handle: e, data: nd, meta: nd.meta, same: sameContent(nd, D) });
    }
    const before = ST.copies.map(c => c.key).join('|');
    ST.copies = inCopy() ? [] : found;
    if (ST.copies.map(c => c.key).join('|') !== before || inCopy()) safeRender();
  } catch (e) { console.warn(e); }
  finally { _scanBusy = false; }
}
const copyHidden = c => !!(UI.copiesSeen && UI.copiesSeen[c.key]);
async function handleCopy(c) {
  if (!c.same) {
    const next = await compareDialog(normalize(JSON.parse(JSON.stringify(c.data))), '„' + c.name + '“'   // gleiche Form wie der eigene Stand (z. B. PAL-Abschnitt), sonst scheinbare Unterschiede
       + (c.meta.savedBy ? ' (gespeichert ' + fmtStamp(c.meta.savedAt) + ' von ' + c.meta.savedBy + ')' : ''));
    if (!next) return;
    UNDO.push(JSON.stringify(D)); REDO.length = 0; D = next; changed();
  }
  if (await confirmBox('Kopie wegräumen?', '„' + c.name + '“ wird in den Unterordner „' + TIDY_DIR + '“ verschoben. Dort bleibt sie erhalten, stört aber nicht mehr.', 'Wegräumen', 'Liegen lassen')) {
    try {
      const sub = await ST.htmlDir.getDirectoryHandle(TIDY_DIR, { create: true });
      const w = await (await sub.getFileHandle(c.name, { create: true })).createWritable(); await w.write(await (await c.handle.getFile()).text()); await w.close();
      await ST.htmlDir.removeEntry(c.name);
      ST.copies = ST.copies.filter(q => q !== c); toast('„' + c.name + '“ weggeräumt.', 'ok');
    } catch (e) { toast('Wegräumen nicht möglich: ' + ((e && e.message) || e), 'err'); }
  } else { UI.copiesSeen = Object.assign({}, UI.copiesSeen, { [c.key]: 1 }); saveUI(); }
  renderNow();
}
const TIDY_DIR = 'Konfliktkopien (erledigt)';
function openMainFile() {
  const go = () => { window.__jpReload = true; location.href = new URL(encodeURIComponent(DEFAULT_FILE), location.href).href; };
  if (isDirty() && ST.conn === 'ok') saveAll({ manual: true }).then(ok => { if (ok) go(); }); else go();
}

function loadData(d) {
  D = d;
  SAVED_JSON = JSON.stringify(D);
  UNDO.length = 0; REDO.length = 0;
  UI.year = D.settings.year || new Date().getFullYear();
  requestRender();
}
