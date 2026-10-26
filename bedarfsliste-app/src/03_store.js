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
    BROKEN = null; D = normalize(other); SAVED_JSON = JSON.stringify(D); undoReset();
    toast('Die geöffnete Datei war beschädigt – der Stand aus dem Ordner wurde geladen.', 'ok');
  } else if (isData(other) && other.meta && other.meta.savedAt && other.meta.savedAt !== D.meta.savedAt && (!D.meta.savedAt || other.meta.savedAt > D.meta.savedAt)) externalChange(other, f.lastModified);
  noteNewer(text, other);
  startWatch();
  scanUpdatePkg();
  karteiScan(); personenScan();
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
/* ---------- Rückgängig: die letzten 50 Stände (ohne Speicherangaben); schnelle Änderungen hintereinander (Tippen) zählen als ein Schritt */
// Rückgängig: vor jeder Änderung den Stand merken (höchstens 50 Schritte). Tippen im selben Feld zählt als ein Schritt;
// alles andere (Löschen, Status, Knöpfe) ist immer ein eigener Schritt. Wird die Datei von außen neu geladen, beginnt es von vorn.
// Je Schritt nur, was sich geändert hat (die betroffenen Bedarfe, Reihenfolge, Einstellungen) – nicht jedes Mal der ganze Bestand.
const UNDO = { stack: [], last: null, t: 0, aus: false, tipp: null, tippAlt: null };
const undoStand = () => JSON.stringify({ bedarfe: D.bedarfe, settings: D.settings });
const undoAufnahme = () => ({ set: JSON.stringify(D.settings), ids: D.bedarfe.map(b => b.id), bd: new Map(D.bedarfe.map(b => [b.id, JSON.stringify(b)])) });
// was man braucht, um vom Stand B zurück zum Stand A zu kommen (null: kein Unterschied)
function undoDiff(A, B) {
  const alt = []; for (const [id, j] of A.bd) if (B.bd.get(id) !== j) alt.push([id, j]);
  const neu = B.ids.filter(id => !A.bd.has(id)), ordnung = A.ids.join('\n') !== B.ids.join('\n') ? A.ids : null, set = A.set !== B.set ? A.set : null;
  return alt.length || neu.length || ordnung || set ? { alt, neu, ordnung, set } : null;
}
// der Stand, zu dem Schritt s von L aus zurückführt
function undoZiel(L, s) { const bd = new Map(L.bd); s.neu.forEach(id => bd.delete(id)); s.alt.forEach(([id, j]) => bd.set(id, j)); return { set: s.set ?? L.set, ids: s.ordnung || L.ids, bd }; }
// zwei Schritte hintereinander (Tippen im selben Feld) zu einem: s führt von S1 nach S0, d von S2 nach S1
function undoVerbinden(s, d) {
  const hat = new Set(s.alt.map(a => a[0]));
  for (const [id, j] of d.alt) if (!hat.has(id) && !s.neu.includes(id)) s.alt.push([id, j]);
  for (const id of d.neu) if (!s.neu.includes(id)) s.neu.push(id);
  if (!s.ordnung && d.ordnung) s.ordnung = d.ordnung; if (s.set == null && d.set != null) s.set = d.set;
}
function undoReset() { UNDO.stack = []; UNDO.last = undoAufnahme(); UNDO.t = 0; UNDO.tippAlt = null; }
function undoMerk() {
  const tipp = UNDO.tipp; UNDO.tipp = null;
  if (UNDO.aus || !UNDO.last) return;
  const jetzt = undoAufnahme(), t = Date.now(), d = undoDiff(UNDO.last, jetzt);
  if (!d) return;
  const oben = UNDO.stack[UNDO.stack.length - 1];
  if (oben && !undoDiff(undoZiel(UNDO.last, oben), jetzt)) UNDO.stack.pop();             // Änderung wieder zurückgenommen: kein leerer Schritt
  else if (oben && tipp && tipp === UNDO.tippAlt && t - UNDO.t < 2000) undoVerbinden(oben, d);
  else { UNDO.stack.push(d); if (UNDO.stack.length > 50) UNDO.stack.shift(); }
  UNDO.last = jetzt; UNDO.t = t; UNDO.tippAlt = tipp;
}
function undo() {
  if (!UNDO.stack.length) { toast('Nichts zum Rückgängigmachen.'); return; }
  const s = UNDO.stack.pop(), map = new Map(D.bedarfe.map(b => [b.id, b]));
  s.neu.forEach(id => map.delete(id)); s.alt.forEach(([id, j]) => map.set(id, JSON.parse(j)));
  const ids = s.ordnung || D.bedarfe.map(b => b.id);
  D = normalize(Object.assign({}, D, { settings: s.set != null ? JSON.parse(s.set) : D.settings, bedarfe: ids.map(id => map.get(id)).filter(Boolean) }));
  UNDO.last = undoAufnahme(); UNDO.t = 0; UNDO.tippAlt = null;
  UNDO.aus = true; try { changed(); } finally { UNDO.aus = false; }
  ORDER.ids = null;                                                                       // Wiederhergestelltes steht an seinem Platz in der Liste
  keep(renderNow); toast('Rückgängig gemacht' + (UNDO.stack.length ? '' : ' – weiter zurück geht es nicht.'), 'ok');
}
function changed() {
  undoMerk(); FCACHE = null;
  const fc = $('#frist-chip'); if (fc) fc.outerHTML = fristChip();                   // Fristen oben gleich nachführen
  if (DEMO) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(D)); } catch (e) { /* ohne Speicher weiter */ } return; }
  saveDraftBald(); scheduleAutosave(); updateSaveUI();
}
// Entwurf im Browser höchstens alle 1,5 Sekunden schreiben (bei jedem Tastendruck wäre das bei vielen Bedarfen spürbar);
// beim Schließen, beim Wechsel in ein anderes Fenster und nach dem Speichern wird sofort geschrieben
let DRAFT_T = null;
function saveDraftBald() { if (!DRAFT_T) DRAFT_T = setTimeout(() => { DRAFT_T = null; saveDraft(); }, 1500); }
function scheduleAutosave() {
  clearTimeout(ST.timer); ST.timer = null;
  if (ST.conn !== 'ok' || ST.conflict || ST.newer || BROKEN) return;
  ST.timer = setTimeout(() => { ST.timer = null; saveAll({ auto: true }); }, 2000);
}
async function saveAll(opts = {}) {
  clearTimeout(ST.timer); ST.timer = null;
  if (DEMO) return false;
  if (BROKEN) { if (!opts.auto) toast('Speichern ist gesperrt: Die Daten dieser Datei waren beschädigt. Erst eine Datensicherung laden (Hinweis oben).', 'err'); return false; }
  if (ST.newer && !opts.update) { if (!opts.auto) toast('Im Ordner liegt eine neuere Programmversion (' + ST.newer.version + '). Bitte zuerst neu starten (Hinweis oben).', 'err'); return false; }
  if (ST.saving) { ST.again = true; return false; }
  if (!FSA) return opts.auto ? false : saveDownload();
  if (ST.conn !== 'ok') {
    if (opts.auto) return false;
    if (!await connectFolder()) return false;
  }
  if (ST.conflict && !opts.trotzKonflikt) { if (!opts.auto) toast('Erst den Hinweis oben klären (anderen Stand laden oder meinen behalten).', 'warn'); return false; }
  ST.saving = true; updateSaveUI();
  try {
    const f = await ST.html.getFile();
    if (!opts.trotzKonflikt && ST.stamp != null && f.lastModified !== ST.stamp) {
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
    // gespeichert ist genau dieser Stand – was während des Speicherns getippt wurde, bleibt „ungespeichert“ (und im Entwurf)
    D.meta = data.meta; SAVED_JSON = JSON.stringify(data);
    if (isDirty()) saveDraft(); else clearDraft();
    try { ST.stamp = (await ST.html.getFile()).lastModified; } catch (x) { ST.stamp = null; }   // Datei kurz gesperrt (OneDrive): Stempel holt der nächste Blick
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
// still übernommen wird nur, was nach einem echten neueren Stand aussieht – älter, ohne Speicherdatum (z. B. frisch überkopierte
// Programmdatei) oder leer gegenüber diesem Stand sieht nach einem Versehen aus: dann fragen statt alles zu ersetzen
function fremdGrund(other) {
  if (!other.meta || !other.meta.savedAt) return 'ohne';
  if (D.meta.savedAt && other.meta.savedAt < D.meta.savedAt) return 'aelter';
  if (!other.bedarfe.length && D.bedarfe.length) return 'leer';
  return null;
}
function externalChange(other, stamp) {
  const grund = BROKEN ? null : fremdGrund(other);
  if (BROKEN || (!isDirty() && !offenesFeld() && !grund)) {
    D = normalize(other); SAVED_JSON = JSON.stringify(D); undoReset(); ST.conflict = null; BROKEN = null;
    if (stamp != null) ST.stamp = stamp;
    toast('Neuer Stand geladen (gespeichert ' + fmtStamp(other.meta.savedAt) + ')', 'ok');
    safeRender();
  } else {
    ST.conflict = { other, stamp, grund };
    clearTimeout(ST.timer); ST.timer = null;
    safeRender();
  }
}
function startWatch() {
  clearInterval(ST.watch);
  ST.watch = setInterval(async () => {
    if (ST.conn !== 'ok' || ST.saving || document.hidden) return;
    ST.tick++;
    if (ST.tick % 4 === 2) { scanUpdatePkg(); personenPflegen(); }  // etwa jede Minute: Update-Paket im Ordner? Neue Kontakte in die Personen-Excel
    if (ST.tick % 4 === 0) { karteiScan(); personenScan(); if (KR.list.length && karteiErgaenzen()) { changed(); safeRender(); } }      // etwa jede Minute: Förder-Kartei oder Personen-Excel geändert?
    if (ST.tick % 4 === 1) { kiCheck(); kiScan(); }               // etwa jede Minute: neues Ergebnis von Cowork? (Hinweis auf der Seite, Fenster)
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
// Wer verliert, landet als Sicherung im Download-Ordner. Liegt im Ordner eine neuere Programmversion, wird sie nicht mit der alten
// überschrieben: mein Stand kommt als Entwurf mit, die neue Version startet und bietet ihn zum Wiederherstellen an
function resolveConflict(how) {
  const c = ST.conflict; if (!c) return;
  if (how === 'mine') {
    if (isData(c.other) && c.other.bedarfe.length) sicherung(c.other, 'Stand-aus-der-Datei');
    if (ST.newer) { entwurfFest(); window.__blReload = true; location.reload(); return; }
    ST.conflict = null; saveAll({ trotzKonflikt: true });
  } else {
    ST.conflict = null;
    sicherung(D, 'mein-Stand');
    D = normalize(c.other); SAVED_JSON = JSON.stringify(D); undoReset(); if (c.stamp != null) ST.stamp = c.stamp; clearDraft();
    toast('Stand aus der Datei geladen – dein bisheriger Stand liegt als Sicherung im Download-Ordner.', 'ok');
  }
  renderNow();
}

/* ---------- Entwurf im Browser (Schutz vor Verlust, falls nicht gespeichert wurde) */
// Ein Entwurf aus einer früheren Sitzung wird beim Start beiseitegelegt (eigener Schlüssel) und angeboten: neue Änderungen überschreiben ihn nicht,
// bis „Wiederherstellen“ oder „Verwerfen“ gewählt ist
const draftKey = () => 'bl-draft:' + location.pathname, offerKey = () => 'bl-draft-angebot:' + location.pathname;
let DRAFT_OFFER = null;
function saveDraft() {
  try {
    if (isDirty() && !BROKEN) localStorage.setItem(draftKey(), JSON.stringify({ base: D.meta.savedAt, at: new Date().toISOString(), data: D }));
    else localStorage.removeItem(draftKey());
  } catch (e) { /* kein Speicher verfügbar */ }
}
function clearDraft() { try { localStorage.removeItem(draftKey()); } catch (e) { /* */ } }
function dropOffer() { try { localStorage.removeItem(offerKey()); } catch (e) { /* */ } DRAFT_OFFER = null; }
function entwurfFest() { try { localStorage.setItem(draftKey(), JSON.stringify({ base: D.meta.savedAt, at: new Date().toISOString(), data: D })); } catch (e) { /* */ } }
function readDraft(k = draftKey()) { try { const d = JSON.parse(localStorage.getItem(k) || 'null'); return d && isData(d.data) ? d : null; } catch (e) { return null; } }
function checkDraft() {
  const neu = readDraft(), alt = readDraft(offerKey()), d = neu && alt ? (neu.at >= alt.at ? neu : alt) : neu || alt;
  if (!d) return;
  if (!BROKEN && JSON.stringify(normalize(JSON.parse(JSON.stringify(d.data)))) === SAVED_JSON) { clearDraft(); dropOffer(); return; }
  DRAFT_OFFER = d;
  try { localStorage.setItem(offerKey(), JSON.stringify(d)); localStorage.removeItem(draftKey()); } catch (e) { /* */ }
}
// Wiederherstellen: wurde die Datei nach dem Stand gespeichert, auf dem der Entwurf beruht (z. B. am anderen Rechner), erst fragen –
// der neuere Stand wird dann vorher als Sicherung heruntergeladen
async function restoreDraft() {
  const dr = DRAFT_OFFER; if (!dr) return;
  if (!BROKEN && (dr.base || '') !== (D.meta.savedAt || '')) {
    if (!await confirmBox('Die Datei ist neuer als diese Änderungen', 'Die Datei wurde am ' + fmtStamp(D.meta.savedAt) + ' gespeichert – nach dem Stand, auf dem diese Änderungen beruhen' + (dr.base ? ' (' + fmtStamp(dr.base) + ')' : '') +
      '. Wiederherstellen ersetzt den neueren Stand; er wird vorher als Sicherung heruntergeladen.', 'Trotzdem wiederherstellen')) return;
    sicherung(D, 'Stand-der-Datei');
  }
  const vorher = JSON.stringify(D);
  D = normalize(dr.data); BROKEN = null; dropOffer();
  changed(); renderNow();
  toast('Ungespeicherte Änderungen wiederhergestellt – werden gespeichert.', 'ok', undoGanz(vorher));
}
// Rückgängig für Aktionen, die den ganzen Stand ersetzen: wurde danach weiter geändert, erst fragen (sonst wäre das mit weg)
function undoGanz(vorher) {
  const nachher = undoStand();
  return async () => {
    if (undoStand() !== nachher && !await confirmBox('Seitdem geändert', 'Seitdem wurde weiter geändert. „Rückgängig“ nimmt auch diese Änderungen zurück. Trotzdem?', 'Trotzdem zurück')) return;
    D = normalize(Object.assign(JSON.parse(vorher), { meta: D.meta })); changed(); ORDER.ids = null; keep(renderNow);
  };
}

/* ---------- Sicherung */
function sicherung(data = D, zusatz = '') {
  download('Bedarfsliste_Sicherung_' + today() + (zusatz ? '_' + zusatz : '') + '.json', new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
}
function saveBackup() { sicherung(D); }
async function openBackup() {
  if (!await confirmBox('Sicherung laden', 'Die Daten aus der Sicherung (.json oder eine ältere Kopie der Programmdatei) ersetzen den aktuellen Stand. Der aktuelle Stand wird vorher als Sicherung heruntergeladen.', 'Sicherung wählen …')) return;
  const f = await pickFile('.json,.html,.htm'); if (!f) return;
  const data = parseFileText(await f.text());
  if (!isData(data)) { toast('In dieser Datei wurden keine Bedarfe gefunden.', 'err'); return; }
  if (!BROKEN) saveBackup();
  const before = JSON.stringify(D);
  const n = normalize(data); n.meta = D.meta; D = n; BROKEN = null;
  changed(); renderNow();
  toast('Sicherung „' + f.name + '“ geladen.', 'ok', undoGanz(before));
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
  if (ST.conflict) { toast('Erst den Hinweis oben klären (anderen Stand laden oder meinen behalten), dann das Update einspielen.', 'warn'); return; }
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
  // vorher nachsehen: inzwischen woanders gespeichert, oder liegt im Ordner schon eine neuere Version? Dann nichts überschreiben
  try {
    const f0 = await ST.html.getFile(), t0 = await f0.text(), o0 = parseFileText(t0), v0 = fileVersion(t0);
    if (v0 && info && verCmp(v0, info.version) > 0) return modal('Update nicht nötig', h('p', null, 'Im Ordner liegt schon Version ' + v0 + ' – neuer als dieses Update (' + info.version + '). Bitte die Bedarfsliste neu laden.'));
    if (isData(o0) && o0.meta && o0.meta.savedAt && o0.meta.savedAt !== D.meta.savedAt) {
      externalChange(o0, f0.lastModified);
      return modal('Update noch nicht eingespielt', h('p', null, 'Die Datei wurde gerade woanders gespeichert. Erst diesen Stand übernehmen (oder den Hinweis oben klären), dann das Update noch einmal einspielen.'));
    }
  } catch (e) { return fail('Die Programmdatei im Ordner ist gerade nicht lesbar (wird sie synchronisiert?).'); }
  const oldCss = $('#bl-style').textContent, oldJs = $('#bl-app').textContent;
  $('#bl-style').textContent = prog.css; $('#bl-app').textContent = prog.js;
  let ok = false, saved = '';
  try { ok = await saveAll({ update: true }); saved = ok ? await (await ST.html.getFile()).text() : ''; } catch (e) { console.warn(e); }
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
  else if (xl && PERS_RE.test(xl.name) && !$('.modal')) personenDatei(xl);
  else if (xl && UI.view === 'detail' && cur() && !$('.modal')) importFoerderplan(cur(), xl);
  else toast('Hier lässt sich ein Update-Paket (.zip) ablegen – oder auf der Seite eines Bedarfs eine Förderplan-Excel.', 'warn');
});
