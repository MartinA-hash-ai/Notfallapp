/* ===================================================================== Fördererliste: KI-Recherche für mehrere Förderer auf einmal (ab 0.121)
   Knopf „KI-Recherche“ oben in der Fördererliste: Förderer anklicken (oder „Alle“ – mit Suche und Filtern), dann „Recherche für n Förderer …“.
   Das Fenster bietet: 1 · alle Vorlagen als ZIP (je Förderer eine Datei, Förderer-ID im Dateinamen und im Blatt „Anleitung“), 2 · einen gemeinsamen
   Auftrag (für Copilot, Cowork, Claude Code …), 3 · ein Ablagefeld für die ausgefüllten Dateien (mehrere .xlsx oder eine ZIP). Beim Einlesen ordnet
   das Programm jede Datei ihrem Förderer zu (ID, sonst Name) und zeigt nacheinander für jede Datei das bekannte Fenster „Angaben übernehmen?“. */
const flSerieKnopf = () => `<button class="heute-btn fl-serie-btn" data-act="fl-serie" title="Mehrere Förderer auswählen und gemeinsam mit KI recherchieren lassen">${ICON_KI}<span>KI-Recherche</span></button>`;
const flSerieText = n => n ? 'Recherche für ' + n + (n === 1 ? ' Förderer' : ' Förderer') + ' …' : 'Recherche …';
function flSerieLeiste() {
  const n = UI.flWahl.size;
  return `<span class="heute-hw"><b>Förderer anklicken</b></span><button class="small" data-act="fl-serie-alle" title="alle Förderer, die gerade in der Liste stehen (mit Suche und Filtern)">Alle</button><button class="primary small" data-act="fl-serie-los"${n ? '' : ' disabled'}>${flSerieText(n)}</button><button class="undo-btn" data-act="fl-serie-leer" title="Auswahl aufheben – alle Haken weg" aria-label="Auswahl aufheben">↶</button><button class="undo-btn ende-x" data-act="fl-serie-ende" title="Auswahl beenden (Esc)" aria-label="Auswahl beenden">×</button>`;
}
function flSerieUmschalten(id) {
  if (!UI.flWahl || !id) return; if (UI.flWahl.has(id)) UI.flWahl.delete(id); else UI.flWahl.add(id);
  keep(renderNow);
}
const flSerieDatei = e => 'Recherche_' + e.id + '_' + String(e.kurz || e.name || 'Foerderer').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) + '.xlsx';

// gemeinsamer Auftrag: Liste der Förderer, dann der bekannte Auftrag für eine Datei (gilt für jede)
function flcSeriePrompt(L) {
  const einzel = flcPrompt(null).split('\n'), a = einzel.indexOf('So gehst du vor:'), b = einzel.findIndex((t, i) => i > a && /^Gib mir die ausgefüllte Datei/.test(t));
  const regeln = einzel.slice(a, b).join('\n').trim();
  return [
    'Du bist Rechercheassistent im Fundraising der Malteser (Malteser Hilfsdienst e. V., Diözese Paderborn). Im Anhang liegen ' + L.length + ' Excel-Dateien – je Förderer eine (der Dateiname und das Blatt „Anleitung“ nennen die Förderer-ID). Recherchiere im Web jeden der folgenden Förderer und fülle seine Datei aus. Ich lese die Dateien danach in unser Programm ein.',
    '',
    ...L.map((e, i) => (i + 1) + '. ' + e.name + (e.kurz ? ' (' + e.kurz + ')' : '') + (e.web ? ' – Homepage: ' + e.web : '') + ' – Datei: ' + flSerieDatei(e) + (e.topfe.length ? ' – hat bei uns schon die Fördertöpfe: ' + e.topfe.map(t => '„' + t.name + '“').join(', ') + ' (im Blatt „Fördertöpfe“ schon eingetragen – diese Zeilen mit genau diesen Namen ausfüllen, weitere Programme darunter)' : '')),
    '',
    'Wichtig für mehrere Förderer:',
    '- Jeder Förderer bekommt nur seine eigene Datei. Nichts zwischen den Förderern vermischen, keine Angaben von einem Förderer in die Datei eines anderen.',
    '- Arbeite die Förderer einzeln ab – wenn du kannst, gleichzeitig (z. B. ein Unterauftrag je Förderer). Jeder Förderer bekommt dieselbe Gründlichkeit.',
    '- Fülle die Dateien direkt aus (z. B. mit Python und openpyxl), ohne Blätter, Spalten, Überschriften oder Formate zu ändern. Wenn du die Dateien nicht direkt bearbeiten kannst, gib je Förderer den Inhalt jedes Blatts als Tabelle mit denselben Überschriften aus.',
    '',
    'Für JEDE Datei gilt der folgende Auftrag:',
    '',
    regeln,
    '',
    'Gib mir alle ausgefüllten Dateien zum Herunterladen zurück – mit demselben Dateinamen und dem Zusatz „_ausgefuellt“, gern zusammen als ZIP. Schreibe darunter je Förderer höchstens drei Sätze, was du nicht gefunden hast und wo du unsicher bist.',
  ].join('\n');
}
function flcTextKopieren(t, ok) {
  const fail = () => { modal('Auftrag für die KI', h('textarea', { class: 'rech-prompt', rows: 14, spellcheck: false, value: t, readonly: true })); };
  try { navigator.clipboard.writeText(t).then(() => toast(ok, 'ok'), fail); } catch (x) { fail(); }
}

async function flSerieDialog() {
  const L = D.fl.liste.filter(e => UI.flWahl && UI.flWahl.has(e.id)); if (!L.length) { toast('Erst Förderer anklicken.', 'warn'); return; }
  let zu = null;
  const nimm = fl => { fl = [...(fl || [])].filter(f => /\.(xlsx|zip)$/i.test(f.name)); if (!fl.length) { toast('Bitte die ausgefüllten Excel-Dateien (.xlsx) oder eine ZIP nehmen.', 'warn'); return; } if (zu) zu(true); flSerieEinlesen(fl); };
  const ablage = h('div', { class: 'flc-drop', role: 'button', tabindex: '0', 'aria-label': 'Ausgefüllte Dateien einlesen' },
    h('b', {}, '3 · Ausgefüllte Dateien hier hineinziehen'), h('span', { class: 'muted small' }, 'mehrere Excel-Dateien oder eine ZIP – oder klicken, um sie auszuwählen'));
  const waehle = async () => { const inp = h('input', { type: 'file', accept: '.xlsx,.zip', multiple: true }); inp.addEventListener('change', () => nimm(inp.files)); inp.click(); };
  ablage.addEventListener('click', waehle);
  ablage.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); waehle(); } });
  ablage.addEventListener('dragover', ev => { ev.preventDefault(); ev.stopPropagation(); ablage.classList.add('ueber'); });
  ablage.addEventListener('dragleave', () => ablage.classList.remove('ueber'));
  ablage.addEventListener('drop', ev => { ev.preventDefault(); ev.stopPropagation(); ablage.classList.remove('ueber'); nimm(ev.dataTransfer && ev.dataTransfer.files); });
  const zipLaden = async () => {
    const files = []; for (const e of L) files.push({ name: flSerieDatei(e), data: new Uint8Array(await flcVorlageBlob(e).arrayBuffer()) });
    download('KI-Recherche_' + L.length + '_Foerderer.zip', zipBlob(files, 'application/zip'));
  };
  const body = h('div', { class: 'flc-dlg fl-serie-dlg' },
    h('ul', { class: 'fl-serie-l' }, ...L.map(e => h('li', {}, h('b', {}, e.kurz || e.name), e.kurz ? h('span', { class: 'muted' }, ' ' + e.name) : null, e.topfe.length ? h('span', { class: 'muted small' }, ' · ' + e.topfe.length + (e.topfe.length === 1 ? ' Fördertopf' : ' Fördertöpfe')) : null))),
    h('div', { class: 'flc-knoepfe' },
      h('button', { class: 'primary', onclick: zipLaden }, '1 · Vorlagen herunterladen (ZIP)'),
      h('button', { class: 'primary', onclick: () => flcTextKopieren(flcSeriePrompt(L), 'Auftrag kopiert – in die KI einfügen und die Dateien aus der ZIP anhängen') }, '2 · Auftrag kopieren')),
    ablage);
  modal('KI-Recherche für ' + L.length + ' Förderer', body, [['Fertig', true, 'primary']], { expose: c => { zu = c; } });
}

// ausgefüllte Dateien (einzelne .xlsx oder ZIP) → je Datei ihr Förderer → nacheinander das Fenster „Angaben übernehmen?“
async function flSerieDateien(fl) {
  const out = [];
  for (const f of fl) {
    if (!/\.zip$/i.test(f.name)) { out.push(f); continue; }
    try { const z = zipIndex(await f.arrayBuffer());
      for (const name of z.out.keys()) { if (!/\.xlsx$/i.test(name) || /(^|\/)(__MACOSX|\.)/.test(name)) continue; const r = zipRaw(z, name); if (!r) continue;
        const data = r.e.meth === 0 ? r.data : r.e.meth === 8 ? new Uint8Array(await new Response(new Blob([r.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : null;
        if (data) out.push(new File([data], name.split('/').pop())); }
    } catch (x) { console.warn(x); toast('„' + f.name + '“ ließ sich nicht entpacken.', 'warn'); }
  }
  return out;
}
async function flSerieZuordnen(f, R) {
  const id = R.fid || ((f.name.match(/(?:^|_)(F\d{3,})(?:_|\.|$)/) || [])[1]) || '';
  let e = flEintrag(id);
  if (!e) { const n = norm(R.F.name && R.F.name.text); if (n) { const T = D.fl.liste.filter(x => norm(x.name) === n || (x.kurz && norm(x.kurz) === n)); if (T.length === 1) e = T[0]; } }
  if (e) return e;
  const sel = h('select', { class: 'flc-sel', 'aria-label': 'Förderer' }, h('option', { value: '' }, '– überspringen –'), ...D.fl.liste.slice().sort((a, c) => a.name.localeCompare(c.name, 'de')).map(x => h('option', { value: x.id }, x.name)));
  const ok = await modal('Zu welchem Förderer gehört die Datei?', h('div', { class: 'flc-dlg' }, h('p', {}, '„' + f.name + '“' + (R.F.name && R.F.name.text ? ' (Name in der Datei: „' + R.F.name.text + '“)' : '') + ' ließ sich keinem Förderer zuordnen.'), sel), [['Überspringen', false], ['Zuordnen', true, 'primary']]);
  return ok ? flEintrag(sel.value) : null;
}
async function flSerieEinlesen(fl) {
  if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
  const F = await flSerieDateien(fl); if (!F.length) { toast('Keine Excel-Datei gefunden.', 'warn'); return; }
  let fertig = 0, ohne = 0;
  for (let i = 0; i < F.length; i++) {
    const f = F[i]; let R = null; try { R = flcLesen(await xlsxBook(await f.arrayBuffer())); } catch (x) { console.warn(x); }
    if (!R) { ohne++; toast('„' + f.name + '“ ist keine ausgefüllte Recherche-Vorlage – übersprungen.', 'warn'); continue; }
    const e = await flSerieZuordnen(f, R); if (!e) { ohne++; continue; }
    await flcEinlesen(f, e, { nr: i + 1, von: F.length }); fertig++;
  }
  UI.flWahl = null; keep(renderNow);
  if (F.length > 1) toast(fertig + ' von ' + F.length + ' Dateien durchgesehen' + (ohne ? ', ' + ohne + ' übersprungen' : ''), 'ok');
}
