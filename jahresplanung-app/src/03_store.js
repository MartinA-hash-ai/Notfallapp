/* ===================================================================== Speichern: die Datei speichert sich selbst (App + Daten in einer HTML-Datei) */

const DEFAULT_FILE = 'Jahresplanung_Aussenkommunikation.html';
let fileHandle = null, fileStamp = null, DRAFT_OFFER = null;

function currentFileName() {
  try { const n = decodeURIComponent(location.pathname.split('/').pop() || ''); if (/\.html?$/i.test(n)) return n; } catch (e) { /* */ }
  return DEFAULT_FILE;
}
function buildFile(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const S = 'script';
  return '<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>Jahresplanung Außenkommunikation</title>\n<style id="jp-style">' + $('#jp-style').textContent + '</style>\n</head>\n<body>\n<div id="app"></div>\n' +
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

async function save(as = false) {
  const data = JSON.parse(JSON.stringify(D));
  data.meta.savedAt = new Date().toISOString();
  data.meta.savedBy = UI.userName || '';
  const text = buildFile(data);
  if ('showSaveFilePicker' in window) {
    try {
      if (!fileHandle || as) {
        const hnd = await window.showSaveFilePicker({ suggestedName: currentFileName(), types: [{ description: 'Jahresplanung (HTML)', accept: { 'text/html': ['.html'] } }] });
        const f = await hnd.getFile();
        if (f.size > 0) {
          const other = parseFileText(await f.text());
          if (other && other.meta && other.meta.savedAt && other.meta.savedAt !== D.meta.savedAt) {
            const ok = await confirmBox('Andere Version in der Datei',
              `„${hnd.name}“ enthält einen anderen Stand (gespeichert ${fmtStamp(other.meta.savedAt)}${other.meta.savedBy ? ' von ' + other.meta.savedBy : ''}). ` +
              'Wenn du speicherst, wird dieser Stand ersetzt.', 'Trotzdem speichern');
            if (!ok) return false;
          }
        }
        fileHandle = hnd;
      } else {
        const f = await fileHandle.getFile();
        if (fileStamp && f.lastModified !== fileStamp) {
          const other = parseFileText(await f.text());
          const ok = await confirmBox('Datei wurde zwischenzeitlich geändert',
            `Seit dem letzten Öffnen/Speichern hat jemand „${fileHandle.name}“ geändert` +
            (other && other.meta ? ` (${fmtStamp(other.meta.savedAt)}${other.meta.savedBy ? ', ' + other.meta.savedBy : ''})` : '') +
            '. Beim Speichern gehen diese Änderungen verloren.', 'Trotzdem speichern');
          if (!ok) return false;
        }
      }
      const w = await fileHandle.createWritable();
      await w.write(text); await w.close();
      fileStamp = (await fileHandle.getFile()).lastModified;
      afterSave(data);
      toast('Gespeichert in „' + fileHandle.name + '“', 'ok');
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
      console.warn(e);
      toast('Direktes Speichern nicht möglich – die Datei wird heruntergeladen.', 'warn');
    }
  }
  download(currentFileName(), new Blob([text], { type: 'text/html' }));
  afterSave(data);
  modal('Als Download gespeichert', h('div', null,
    h('p', null, `Die Datei „${currentFileName()}“ liegt jetzt in deinem Download-Ordner.`),
    h('p', null, 'Ersetze damit die bisherige Datei (z. B. im Teams-/SharePoint-Ordner). Tipp: Im Microsoft Edge oder Google Chrome kann die Datei direkt überschrieben werden.')));
  return true;
}
function afterSave(data) {
  D.meta = data.meta;
  SAVED_JSON = JSON.stringify(D);
  clearDraft();
  requestRender();
}

function pickFileText(accept = '.html,.htm,.json') {
  return new Promise(resolve => {
    const inp = h('input', { type: 'file', accept, style: 'display:none' });
    inp.addEventListener('change', async () => { const f = inp.files[0]; inp.remove(); resolve(f ? { text: await f.text(), name: f.name } : null); });
    document.body.append(inp); inp.click();
  });
}
async function openFile() {
  if (isDirty() && !await confirmBox('Ungespeicherte Änderungen', 'Beim Öffnen einer anderen Datei gehen die ungespeicherten Änderungen verloren.', 'Trotzdem öffnen')) return;
  let got = null, hnd = null, stamp = null;
  if ('showOpenFilePicker' in window) {
    try {
      [hnd] = await window.showOpenFilePicker({ types: [{ description: 'Jahresplanung', accept: { 'text/html': ['.html', '.htm'], 'application/json': ['.json'] } }] });
      const f = await hnd.getFile(); got = { text: await f.text(), name: f.name }; stamp = f.lastModified;
    } catch (e) { if (e && e.name === 'AbortError') return; hnd = null; }
  }
  if (!got) got = await pickFileText();
  if (!got) return;
  const data = parseFileText(got.text);
  if (!data || !Array.isArray(data.massnahmen)) { toast('In dieser Datei wurden keine Planungsdaten gefunden.', 'err'); return; }
  loadData(normalize(data));
  fileHandle = hnd && /\.html?$/i.test(got.name) ? hnd : null;
  fileStamp = fileHandle ? stamp : null;
  toast('Geöffnet: ' + got.name, 'ok');
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
