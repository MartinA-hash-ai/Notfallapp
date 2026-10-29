/* ===================================================================== Tastaturbefehle selbst belegen (Zahnrad → „Tastaturbefehle …“)
   Je Funktion zwei Tasten oder Kombinationen (z. B. „Strg+F“, „Umschalt+Enter“). Gespeichert im Browser (persönlich, nicht in der Datei).
   Die Tasten in Feldern (Enter, Tab, Esc) und im Kalender bleiben fest. taste(e, id): passt der Tastendruck zu einer Funktion? */

const TASTEN = [
  { id: 'l-runter', ber: 'In der Liste', t: 'nächster Bedarf (kompakt mit aufgeklapptem: gleich aufklappen)', std: ['ArrowDown', ''] },
  { id: 'l-hoch', ber: 'In der Liste', t: 'vorheriger Bedarf', std: ['ArrowUp', ''] },
  { id: 'l-erster', ber: 'In der Liste', t: 'erster Bedarf', std: ['Home', ''] },
  { id: 'l-letzter', ber: 'In der Liste', t: 'letzter Bedarf', std: ['End', ''] },
  { id: 'l-enter', ber: 'In der Liste', t: 'kompakt: aufklappen, noch einmal öffnen · ausführlich: öffnen', std: ['Enter', ''] },
  { id: 'l-oeffnen', ber: 'In der Liste', t: 'Bedarf öffnen', std: ['ArrowRight', ''] },
  { id: 'l-name', ber: 'In der Liste', t: 'Namen ändern', std: ['E', 'F2'] },
  { id: 'l-prio', ber: 'In der Liste', t: 'Prio-Stern an / aus', std: ['Leertaste', ''] },
  { id: 'l-suche', ber: 'In der Liste', t: 'in die Suche springen', std: ['Strg+F', ''] },
  { id: 'l-zu', ber: 'In der Liste', t: 'aufgeklappten Bedarf zuklappen', std: ['Esc', ''] },
  { id: 'd-naechster', ber: 'Auf der Seite eines Bedarfs', t: 'nächsten Bedarf der Liste öffnen', std: ['ArrowDown', ''] },
  { id: 'd-voriger', ber: 'Auf der Seite eines Bedarfs', t: 'vorigen Bedarf der Liste öffnen', std: ['ArrowUp', ''] },
  { id: 'd-zurueck', ber: 'Auf der Seite eines Bedarfs', t: 'zurück zur Liste', std: ['ArrowLeft', 'Esc'] },
  { id: 'g-undo', ber: 'Überall', t: 'Rückgängig (außerhalb von Feldern)', std: ['Strg+Z', ''] },
  { id: 'g-save', ber: 'Überall', t: 'Speichern', std: ['Strg+S', ''] },
];
const TASTEN_FEST = [['In Feldern', [['Enter / Tab', 'übernehmen (Tab: weiter zum nächsten Feld, Umschalt+Tab: zurück)'], ['Umschalt+Enter', 'in der Liste: übernehmen und gleich den nächsten Bedarf darunter anlegen'],
  ['Esc', 'verwerfen'], ['Kalender', 'Pfeiltasten: Tag · Bild auf / ab: Monat · Enter: übernehmen · Esc: schließen']]]];
const TASTEN_KEY = 'bl-tasten';
const TASTE_NAME = { ' ': 'Leertaste', Escape: 'Esc', ArrowDown: '↓', ArrowUp: '↑', ArrowLeft: '←', ArrowRight: '→', Home: 'Pos1', End: 'Ende', PageUp: 'Bild ↑', PageDown: 'Bild ↓', Delete: 'Entf', Backspace: '⌫' };
let TASTEN_EIGEN = null;
function tastenLaden() { if (TASTEN_EIGEN) return TASTEN_EIGEN; try { TASTEN_EIGEN = JSON.parse(localStorage.getItem(TASTEN_KEY) || '{}') || {}; } catch (e) { TASTEN_EIGEN = {}; } return TASTEN_EIGEN; }
const tastenVon = id => { const e = tastenLaden()[id], t = TASTEN.find(x => x.id === id); return Array.isArray(e) ? e : t ? t.std : []; };
// Tastendruck → Text wie „Strg+Umschalt+F“; Buchstaben groß, Leertaste und Esc ausgeschrieben, reine Umschalt-/Strg-Tasten zählen nicht
function tasteText(e) {
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock'].includes(e.key)) return '';
  let k = e.key === ' ' ? 'Leertaste' : e.key === 'Escape' ? 'Esc' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  const mod = [(e.ctrlKey || e.metaKey) && 'Strg', e.altKey && 'Alt', e.shiftKey && e.key.length !== 1 && 'Umschalt'].filter(Boolean);   // Umschalt bei Buchstaben steckt schon im Zeichen
  if (e.shiftKey && e.key.length === 1 && /[A-ZÄÖÜ]/.test(e.key) && (e.ctrlKey || e.metaKey || e.altKey)) mod.push('Umschalt');
  return [...mod, k].join('+');
}
const tasteZeigen = s => s ? s.split('+').map(t => TASTE_NAME[t] || t).join('+') : '';
const taste = (e, id) => { const t = tasteText(e); return !!t && tastenVon(id).some(x => x && x === t); };
const tastenText = id => tastenVon(id).filter(Boolean).map(tasteZeigen).join(' / ') || '–';

// Übersicht (auch im Fenster „Über die Bedarfsliste“): die belegten Tasten, dann die festen in Feldern
function kuerzelTabelle() {
  const G = [];
  for (const t of TASTEN) { let g = G.find(x => x[0] === t.ber); if (!g) G.push(g = [t.ber, []]); g[1].push([tastenText(t.id), t.t]); }
  const i = G.findIndex(g => g[0] === 'Überall');                                   // die festen Tasten in Feldern vor „Überall“
  G.splice(i < 0 ? G.length : i, 0, ...TASTEN_FEST);
  return h('table', { class: 'kuerzel' }, G.map(([t, K]) => h('tbody', null, h('tr', { class: 'kz-g' }, h('th', { colspan: 2 }, t)), K.map(([k, x]) => h('tr', null, h('th', null, k), h('td', null, x))))));
}
// Belegen: Knopf anklicken, dann die Taste bzw. Kombination drücken (Esc und Tab gehen auch); × leert, „Standard“ setzt zurück
async function tastenDialog() {
  closeMenus();
  const E = JSON.parse(JSON.stringify(Object.fromEntries(TASTEN.map(t => [t.id, tastenVon(t.id).slice(0, 2).concat(['', '']).slice(0, 2)]))));
  let warte = null;
  const tab = h('table', { class: 'tasten' });
  const knopf = (id, i) => h('span', { class: 'ta-f' }, h('button', { type: 'button', class: 'ta-k' + (warte && warte.id === id && warte.i === i ? ' warte' : '') + (E[id][i] ? '' : ' leer'),
      onclick: () => { warte = { id, i }; zeig(); } }, warte && warte.id === id && warte.i === i ? 'Taste drücken …' : tasteZeigen(E[id][i]) || 'frei'),
    E[id][i] ? h('button', { type: 'button', class: 'x', title: 'leeren', 'aria-label': 'leeren', onclick: () => { E[id][i] = ''; warte = null; zeig(); } }, '×') : null);
  const doppelt = (id, i) => { const t = TASTEN.find(x => x.id === id), v = E[id][i]; return v && TASTEN.some(x => x.ber === t.ber && E[x.id].some((w, j) => w === v && !(x.id === id && j === i))); };
  const zeig = () => {
    const G = [];
    for (const t of TASTEN) { let g = G.find(x => x[0] === t.ber); if (!g) G.push(g = [t.ber, []]); g[1].push(t); }
    tab.replaceChildren(...G.map(([ber, L]) => h('tbody', null, h('tr', { class: 'kz-g' }, h('th', { colspan: 4 }, ber)),
      L.map(t => h('tr', { class: doppelt(t.id, 0) || doppelt(t.id, 1) ? 'doppelt' : '' }, h('td', null, t.t), h('td', null, knopf(t.id, 0)), h('td', null, knopf(t.id, 1)),
        h('td', null, h('button', { type: 'button', class: 'link small', title: 'Standard: ' + t.std.filter(Boolean).map(tasteZeigen).join(' / '), onclick: () => { E[t.id] = t.std.slice(); warte = null; zeig(); } }, 'Standard')))))));
  };
  const fang = e => { if (!warte) return; const t = tasteText(e); if (!t) return; e.preventDefault(); e.stopPropagation(); E[warte.id][warte.i] = t; warte = null; zeig(); };
  document.addEventListener('keydown', fang, true);
  zeig();
  const ok = await modal('Tastaturbefehle', h('div', { class: 'help' },
    h('p', { class: 'muted small' }, 'Je Funktion zwei Tasten oder Kombinationen (z. B. Strg+F). Feld anklicken und die Taste drücken. Rot: in diesem Bereich doppelt belegt. Gilt für diesen Browser.'), tab,
    h('button', { type: 'button', class: 'link small', onclick: () => { TASTEN.forEach(t => { E[t.id] = t.std.slice(); }); warte = null; zeig(); } }, 'Alle auf Standard')),
    [['Abbrechen', false], ['Speichern', true, 'primary']], { wide: true });
  document.removeEventListener('keydown', fang, true);
  if (!ok) return;
  TASTEN_EIGEN = Object.fromEntries(TASTEN.filter(t => JSON.stringify(E[t.id]) !== JSON.stringify(t.std)).map(t => [t.id, E[t.id]]));
  try { localStorage.setItem(TASTEN_KEY, JSON.stringify(TASTEN_EIGEN)); } catch (e) { /* ohne Speicher: nur für diese Sitzung */ }
  toast('Tastaturbefehle gespeichert', 'ok'); safeRender();
}
