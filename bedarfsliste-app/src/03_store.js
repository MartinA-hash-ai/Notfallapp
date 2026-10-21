/* ===================================================================== Speichern: die Datei speichert sich selbst (Programm + Daten in einer HTML-Datei)
   Aufbau wie bei der Jahresplanung, vereinfacht für eine Person (kein Protokoll, keine Anwesenheit).
   Gespeichert wird im Ordner der Programmdatei (z. B. im OneDrive) – automatisch kurz nach jeder Änderung. */

const DEFAULT_FILE = 'Bedarfsliste.html';
const UPD_ZIP_RE = /^Bedarfsliste.*\.zip$/i;
let BROKEN = null;                            // Daten der geöffneten Datei unlesbar: Speichern gesperrt, bis gültige Daten geladen sind
const ST = { dir: null, html: null, htmlDir: null, stamp: null, conn: 'none', saving: false, again: false, timer: null, watch: null, tick: 0,
  conflict: null, lastSave: null, fail: null, retry: null, newer: null, zipUpd: null, perm: null, askArmed: false };
const FSA = !DEMO && 'showDirectoryPicker' in window;

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
function buildFile(data, css = $('#bl-style').textContent, js = $('#bl-app').textContent) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c'), S = 'script';
  return '<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>Bedarfsliste</title>\n<link rel="icon" href="' + FAVICON + '">\n<style id="bl-style">' + css + '</style>\n</head>\n<body>\n<div id="app"></div>\n' +
    '<' + S + ' type="application/json" id="bl-data">' + json + '</' + S + '>\n<' + S + ' id="bl-app">' + js + '</' + S + '>\n</body>\n</html>\n';
}
function parseFileText(text) {
  try {
    const t = text.trim();
    if (t.startsWith('{')) return JSON.parse(t);
    const m = t.match(/<script[^>]*id="bl-data"[^>]*>([\s\S]*?)<\/script>/i);
    return m ? JSON.parse(m[1]) : null;
  } catch (e) { return null; }
}
const isData = d => isObj(d) && Array.isArray(d.bedarfe);

/* ---------- Ordnerzugriff im Browser merken (IndexedDB), damit beim nächsten Start ein Klick reicht */
function idbOpen() { return new Promise((res, rej) => { const r = indexedDB.open('bedarfsliste', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
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
// Programmdatei im Ordner suchen (auch im Unterordner „Bedarfsliste …“)
async function findHtml(dir) {
  const name = currentFileName();
  try { return { file: await dir.getFileHandle(name), dir }; } catch (e) { /* weiter suchen */ }
  const subs = [], files = [];
  for await (const [n, e] of dir.entries()) { if (e.kind === 'directory' && /^Bedarfsliste/i.test(n)) subs.push(e); if (e.kind === 'file' && /^Bedarfsliste.*\.html?$/i.test(n)) files.push(e); }
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
  if (isData(other) && BROKEN) {                // geöffnete Datei kaputt, die im Ordner lesbar: diese nehmen
    BROKEN = null; D = normalize(other); SAVED_JSON = JSON.stringify(D);
    toast('Die geöffnete Datei war beschädigt – der Stand aus dem Ordner wurde geladen.', 'ok');
  } else if (isData(other) && other.meta && other.meta.savedAt && other.meta.savedAt !== D.meta.savedAt && (!D.meta.savedAt || other.meta.savedAt > D.meta.savedAt)) externalChange(other, f.lastModified);
  noteNewer(text, other);
  startWatch();
  scanUpdatePkg();
  karteiScan();
  safeRender();
  return true;
}
// Liegt im Ordner eine neuere Programmversion? Dann nicht mehr speichern (sonst käme die alte Version zurück)
function noteNewer(text, other) {
  const v = fileVersion(text);
  if (!v || verCmp(v, APP_INFO.version) <= 0) return false;
  if (!ST.newer) { ST.newer = { version: v }; clearTimeout(ST.timer); ST.timer = null; safeRender(); }
  return true;
}
// Nach einem Neustart fragt der Browser beim ersten Klick, ob die App den Ordner wieder bearbeiten darf
function askPermissionOnFirstClick() {
  if (!FSA || ST.conn !== 'needs-permission' || ST.askArmed) return;
  ST.askArmed = true;
  const ask = () => {
    document.removeEventListener('pointerdown', ask, true); document.removeEventListener('keydown', ask, true);
    ST.askArmed = false;
    if (ST.conn !== 'needs-permission' || !ST.dir) return;
    ST.perm = ST.dir.requestPermission({ mode: 'readwrite' }).then(async p => {
      if (p === 'granted' && await attachFolder()) { updateSaveUI(); safeRender(); if (isDirty()) scheduleAutosave(); }
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
      h('p', null, 'Wähle im nächsten Fenster einmalig den Ordner, in dem diese Datei liegt, und bestätige „Bearbeiten zulassen“.'),
      folder ? h('p', { class: 'pathbox' }, folder) : null,
      h('p', null, 'Danach speichert die Bedarfsliste automatisch nach jeder Änderung in diese Datei. Liegt im selben Ordner deine Förder-Kartei (Excel), liest die Liste sie mit ein.'),
      h('p', { class: 'muted small' }, 'Bei späteren Starts fragt der Browser nur noch einmal kurz, ob die App den Ordner bearbeiten darf.')),
      [['Abbrechen', false], ['Ordner wählen', true, 'primary']]);
    if (!ok) return false;
    const dir = await window.showDirectoryPicker({ id: 'bedarfsliste', mode: 'readwrite' });
    ST.dir = dir;
    const found = await findHtml(dir);
    if (!found && !await confirmBox('Hier anlegen?', `In „${dir.name}“ liegt noch keine Bedarfsliste. Soll sie hier angelegt werden (Datei „${currentFileName()}“)?`, 'Hier anlegen')) { ST.dir = null; return false; }
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

/* ---------- Speichern */
function changed() {
  if (DEMO) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(D)); } catch (e) { /* ohne Speicher weiter */ } return; }
  saveDraft(); scheduleAutosave(); updateSaveUI();
}
function scheduleAutosave() {
  clearTimeout(ST.timer); ST.timer = null;
  if (ST.conn !== 'ok' || ST.conflict || ST.newer || BROKEN) return;
  ST.timer = setTimeout(() => { ST.timer = null; saveAll({ auto: true }); }, 2000);
}
async function saveAll(opts = {}) {
  clearTimeout(ST.timer); ST.timer = null;
  if (DEMO) return false;
  if (BROKEN) { if (!opts.auto) toast('Speichern ist gesperrt: Die Daten dieser Datei waren beschädigt. Erst eine Datensicherung laden (Hinweis oben).', 'err'); return false; }
  if (ST.newer && !opts.force) { if (!opts.auto) toast('Im Ordner liegt eine neuere Programmversion (' + ST.newer.version + '). Bitte zuerst neu starten (Hinweis oben).', 'err'); return false; }
  if (ST.saving) { ST.again = true; return false; }
  if (!FSA) return opts.auto ? false : saveDownload();
  if (ST.conn !== 'ok') {
    if (opts.auto) return false;
    if (!await connectFolder()) return false;
  }
  if (ST.conflict && !opts.force) { if (!opts.auto) toast('Erst den Hinweis oben klären (anderen Stand laden oder meinen behalten).', 'warn'); return false; }
  ST.saving = true; updateSaveUI();
  try {
    const f = await ST.html.getFile();
    if (!opts.force && ST.stamp != null && f.lastModified !== ST.stamp) {
      const text = await f.text(), other = parseFileText(text);
      if (noteNewer(text, other)) { ST.saving = false; if (!isDirty() && isData(other)) externalChange(other, f.lastModified); return false; }
      if (!other && text.length) { ST.saving = false; throw Object.assign(new Error('Die Datei im Ordner ist gerade nicht lesbar (wird sie synchronisiert?)'), { name: 'Unreadable' }); }
      if (isData(other) && other.meta && other.meta.savedAt !== D.meta.savedAt) { ST.saving = false; externalChange(other, f.lastModified); return false; }
      ST.stamp = f.lastModified;
    }
    const data = JSON.parse(JSON.stringify(D));
    data.meta.savedAt = new Date().toISOString();
    data.meta.rev = (+D.meta.rev || 0) + 1;
    const w = await ST.html.createWritable();
    await w.write(buildFile(data)); await w.close();
    ST.stamp = (await ST.html.getFile()).lastModified;
    D.meta = data.meta; SAVED_JSON = JSON.stringify(D); clearDraft();
    ST.lastSave = new Date(); ST.conflict = null;
    if (ST.fail) { if (ST.fail.n > 1) toast('Wieder gespeichert.', 'ok'); ST.fail = null; }
    clearTimeout(ST.retry); ST.retry = null;
    if (!opts.auto) toast('Gespeichert', 'ok');
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
    if (ST.conflict) safeRender();
    if (ST.again) { ST.again = false; if (isDirty()) scheduleAutosave(); }
  }
}
async function saveDownload() {
  const data = JSON.parse(JSON.stringify(D));
  data.meta.savedAt = new Date().toISOString(); data.meta.rev = (+D.meta.rev || 0) + 1;
  download(currentFileName(), new Blob([buildFile(data)], { type: 'text/html' }));
  D.meta = data.meta; SAVED_JSON = JSON.stringify(D); clearDraft(); updateSaveUI();
  modal('Als Download gespeichert', h('div', null,
    h('p', null, `Dieser Browser kann nicht direkt in den Ordner speichern. Die Datei „${currentFileName()}“ liegt jetzt in deinem Download-Ordner – ersetze damit die bisherige Datei.`),
    h('p', null, 'Mit Microsoft Edge oder Google Chrome speichert die Bedarfsliste automatisch.')));
  return true;
}

/* ---------- Änderungen von außen (z. B. am zweiten Rechner gespeichert und per OneDrive abgeglichen) */
function externalChange(other, stamp) {
  if (!isDirty() || BROKEN) {
    D = normalize(other); SAVED_JSON = JSON.stringify(D); ST.conflict = null; BROKEN = null;
    if (stamp != null) ST.stamp = stamp;
    toast('Neuer Stand geladen (gespeichert ' + fmtStamp(other.meta.savedAt) + ')', 'ok');
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
    if (ST.tick % 4 === 2) scanUpdatePkg();                       // etwa jede Minute: Update-Paket im Ordner?
    if (ST.tick % 4 === 0) karteiScan();                          // etwa jede Minute: Förder-Kartei geändert?
    if (ST.conflict) return;
    try {
      const f = await ST.html.getFile();
      if (f.lastModified !== ST.stamp) {
        const text = await f.text(), other = parseFileText(text);
        if (!isData(other)) return;                                // Datei kurz nicht lesbar (Synchronisierung): beim nächsten Mal
        ST.stamp = f.lastModified;
        if (noteNewer(text, other)) { if (!isDirty()) externalChange(other, f.lastModified); return; }
        if (other.meta && other.meta.savedAt !== D.meta.savedAt) { externalChange(other, f.lastModified); return; }
      }
      if (isDirty() && !ST.timer && !ST.retry && !ST.newer && !BROKEN) saveAll({ auto: true });   // Sicherheitsnetz
    } catch (e) { /* Datei kurz nicht lesbar (Synchronisierung) */ }
  }, 15000);
}
function resolveConflict(how) {
  const c = ST.conflict; if (!c) return;
  ST.conflict = null;
  if (how === 'mine') saveAll({ force: true });
  else {
    const mine = JSON.stringify(D);
    D = normalize(c.other); SAVED_JSON = JSON.stringify(D); if (c.stamp != null) ST.stamp = c.stamp; clearDraft();
    toast('Stand aus der Datei geladen.', 'ok', () => { D = normalize(JSON.parse(mine)); changed(); renderNow(); });
  }
  renderNow();
}

/* ---------- Entwurf im Browser (Schutz vor Verlust, falls nicht gespeichert wurde) */
const draftKey = () => 'bl-draft:' + location.pathname;
let DRAFT_OFFER = null;
function saveDraft() {
  try {
    if (isDirty() && !BROKEN) localStorage.setItem(draftKey(), JSON.stringify({ base: D.meta.savedAt, at: new Date().toISOString(), data: D }));
    else localStorage.removeItem(draftKey());
  } catch (e) { /* kein Speicher verfügbar */ }
}
function clearDraft() { try { localStorage.removeItem(draftKey()); } catch (e) { /* */ } DRAFT_OFFER = null; }
function readDraft() { try { const d = JSON.parse(localStorage.getItem(draftKey()) || 'null'); return d && isData(d.data) ? d : null; } catch (e) { return null; } }
function checkDraft() {
  const d = readDraft(); if (!d || BROKEN) return;
  if (JSON.stringify(normalize(JSON.parse(JSON.stringify(d.data)))) === SAVED_JSON) { clearDraft(); return; }
  DRAFT_OFFER = d;
}
function restoreDraft() {
  const dr = DRAFT_OFFER; if (!dr) return;
  const before = JSON.stringify(D);
  D = normalize(dr.data); DRAFT_OFFER = null;
  changed(); renderNow();
  toast('Ungespeicherte Änderungen wiederhergestellt – werden gespeichert.', 'ok', () => { D = normalize(JSON.parse(before)); changed(); renderNow(); });
}

/* ---------- Sicherung */
function saveBackup() {
  download('Bedarfsliste_Sicherung_' + today() + '.json', new Blob([JSON.stringify(D, null, 1)], { type: 'application/json' }));
}
async function openBackup() {
  if (!await confirmBox('Sicherung laden', 'Die Daten aus der Sicherung (.json oder eine ältere Kopie der Programmdatei) ersetzen den aktuellen Stand. Der aktuelle Stand wird vorher als Sicherung heruntergeladen.', 'Sicherung wählen …')) return;
  const f = await pickFile('.json,.html,.htm'); if (!f) return;
  const data = parseFileText(await f.text());
  if (!isData(data)) { toast('In dieser Datei wurden keine Bedarfe gefunden.', 'err'); return; }
  if (!BROKEN) saveBackup();
  const before = JSON.stringify(D);
  const n = normalize(data); n.meta = D.meta; D = n; BROKEN = null;
  changed(); renderNow();
  toast('Sicherung „' + f.name + '“ geladen.', 'ok', () => { D = normalize(JSON.parse(before)); changed(); renderNow(); });
}

/* ---------- Programm-Update: aus dem ZIP-Paket (ohne Entpacken) oder aus der Programmdatei; die Daten bleiben */
async function programFromFile(file) {
  if (/\.zip$/i.test(file.name)) {
    let z; try { z = zipIndex(await file.arrayBuffer()); } catch (e) { return { err: '„' + file.name + '“ ist kein lesbares ZIP-Paket.' }; }
    const nm = [...z.out.keys()].filter(n => /(^|\/)Bedarfsliste[^/]*\.html?$/i.test(n) && !/(^|\/)__MACOSX\//.test(n));
    const inner = nm.find(n => n.split('/').pop() === DEFAULT_FILE) || nm[0];
    if (!inner) return { err: 'Im Paket „' + file.name + '“ steckt keine Programmdatei (' + DEFAULT_FILE + ').' };
    try { return { text: await zipText(z, inner), name: file.name }; } catch (e) { return { err: '„' + file.name + '“ lässt sich nicht entpacken (' + e.message + ').' }; }
  }
  return { text: await file.text(), name: file.name };
}
function parseProgram(text) {
  const st = text.match(/<style id="bl-style">([\s\S]*?)<\/style>/), app = text.match(/<script id="bl-app">([\s\S]*)<\/script>\s*<\/body>/);
  if (!st || !app) return null;
  const ver = (app[1].match(/const APP_INFO = (\{[^}]*\});/) || [])[1];
  let info = null; try { info = ver ? JSON.parse(ver) : null; } catch (e) { /* ohne Nummer */ }
  return { css: st[1], js: app[1], info };
}
const _zipSeen = new Map(); let _zipBusy = false;
async function scanUpdatePkg() {
  if (_zipBusy || !FSA || ST.conn !== 'ok' || !ST.htmlDir) return;
  _zipBusy = true;
  try {
    let best = null;
    for await (const [n, e] of ST.htmlDir.entries()) {
      if (e.kind !== 'file' || !UPD_ZIP_RE.test(n)) continue;
      const f = await e.getFile(), key = n + '@' + f.lastModified + '@' + f.size;
      if (!_zipSeen.has(key)) { let info = null; try { const g = await programFromFile(f), pr = g.text ? parseProgram(g.text) : null; info = pr && pr.info; } catch (x) { /* halb synchronisiert */ } _zipSeen.set(key, info); }
      const info = _zipSeen.get(key);
      if (info && info.version && verCmp(info.version, APP_INFO.version) > 0 && (!best || verCmp(info.version, best.info.version) > 0)) best = { name: n, handle: e, info };
    }
    const k = o => o ? o.name + '@' + o.info.version : '';
    if (k(best) !== k(ST.zipUpd)) { ST.zipUpd = best; safeRender(); }
  } catch (e) { console.warn(e); }
  finally { _zipBusy = false; }
}
async function updateProgram(got) {
  if (BROKEN) { toast('Erst die beschädigten Daten wiederherstellen (Hinweis oben).', 'err'); return; }
  if (!got) {
    if (!await confirmBox('Programm-Update einspielen', 'Wähle das Update-Paket „Bedarfsliste_Update.zip“ (entpacken ist nicht nötig) oder eine neue Programmdatei „' + DEFAULT_FILE + '“. Deine Daten bleiben erhalten, nur das Programm wird ersetzt. Zur Sicherheit wird vorher eine Datensicherung heruntergeladen.', 'Datei wählen')) return;
    const f = await pickFile('.zip,.html,.htm'); if (!f) return;
    got = await programFromFile(f);
  }
  if (got.err) { modal('Kein Update-Paket', h('p', null, got.err)); return; }
  const prog = parseProgram(got.text || '');
  if (!prog) { modal('Keine Programmdatei', h('p', null, '„' + got.name + '“ ist keine Programmdatei der Bedarfsliste.')); return; }
  const info = prog.info;
  if ((!info || verCmp(info.version, APP_INFO.version) < 0) && !await confirmBox('Ältere Version?', 'Die gewählte Datei hat ' + (info ? 'Version ' + info.version : 'keine Versionsnummer') +
    ' und ist älter als die installierte Version ' + APP_INFO.version + '. Wirklich einspielen?', 'Trotzdem einspielen')) return;
  if (!await confirmBox('Update übernehmen?', 'Installiert: Version ' + APP_INFO.version + ' · Neu: ' + (info ? 'Version ' + info.version : 'ohne Versionsnummer') + '. Danach startet das Programm neu.', 'Übernehmen')) return;
  const newFile = () => { const data = JSON.parse(JSON.stringify(D)); data.meta.savedAt = new Date().toISOString(); return buildFile(data, prog.css, prog.js); };
  const fail = async reason => {
    const dl = await modal('Update nicht gespeichert', h('div', { class: 'help' }, h('p', null, reason),
      h('p', null, 'Ausweg: Lade die aktualisierte Datei herunter (neues Programm mit deinen Daten) und ersetze damit im Explorer die Datei „' + currentFileName() + '“. Vorher alle Fenster der Bedarfsliste schließen.')),
      [['Schließen', false], ['Aktualisierte Datei herunterladen', true, 'primary']]);
    if (dl) download(currentFileName(), new Blob([newFile()], { type: 'text/html' }));
  };
  if (!FSA) { saveBackup(); return fail('Dieser Browser kann nicht direkt in den Ordner schreiben (am besten Edge oder Chrome verwenden).'); }
  if (ST.conn !== 'ok' && !await connectFolder()) return fail('Die App hat keinen Zugriff auf den Ordner bekommen.');
  saveBackup();
  for (let i = 0; i < 60 && ST.saving; i++) await new Promise(r => setTimeout(r, 100));
  const oldCss = $('#bl-style').textContent, oldJs = $('#bl-app').textContent;
  $('#bl-style').textContent = prog.css; $('#bl-app').textContent = prog.js;
  let ok = false, saved = '';
  try { ok = await saveAll({ force: true }); saved = ok ? await (await ST.html.getFile()).text() : ''; } catch (e) { console.warn(e); }
  if (!ok || !saved.includes(prog.js.slice(-400)) || (info && fileVersion(saved) !== info.version)) {
    $('#bl-style').textContent = oldCss; $('#bl-app').textContent = oldJs;
    return fail('Die neue Version konnte nicht in „' + (ST.html ? ST.html.name : currentFileName()) + '“ geschrieben werden.');
  }
  if (got.pkg) { try { await ST.htmlDir.removeEntry(got.pkg.name); ST.zipUpd = null; } catch (e) { console.warn(e); } }
  toast('Update gespeichert – Neustart …', 'ok');
  setTimeout(() => location.reload(), 900);
}
document.addEventListener('dragover', e => { if ([...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files')) e.preventDefault(); });
document.addEventListener('drop', async e => {
  const fl = [...((e.dataTransfer && e.dataTransfer.files) || [])]; if (!fl.length) return;
  e.preventDefault();
  const pk = fl.find(f => /\.zip$/i.test(f.name)), xl = fl.find(f => /\.xlsx$/i.test(f.name));
  if (pk && !$('.modal')) updateProgram(await programFromFile(pk));
  else if (xl && UI.view === 'detail' && cur() && !$('.modal')) importFoerderplan(cur(), xl);
  else toast('Hier lässt sich ein Update-Paket (.zip) ablegen – oder auf der Seite eines Bedarfs eine Förderplan-Excel.', 'warn');
});
