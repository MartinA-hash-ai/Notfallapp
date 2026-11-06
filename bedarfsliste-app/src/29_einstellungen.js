/* ===================================================================== Einstellungen (ab 0.134)
   Das Zahnrad oben rechts zeigt nur noch Darstellung (Sonne/Mond), „Programm-Update einspielen …“ und „Einstellungen …“.
   Das Fenster „Einstellungen“ bündelt alles Seltene in Gruppen: Personen, E-Mail und Adressen, Bedienung, Daten einlesen, Sicherung, Über.
   Ein Klick öffnet das bisherige Fenster; ist es zu, kommt man zurück in die Einstellungen. */
const ICON_HELL = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10 1.8v2.1M10 16.1v2.1M1.8 10h2.1M16.1 10h2.1M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5"/></g></svg>';
const ICON_DUNKEL = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M15.8 12.6A6.6 6.6 0 0 1 7.4 4.2a6.6 6.6 0 1 0 8.4 8.4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const EI = {   // kleine Zeichen für die Einträge
  pers: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="6.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 17c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  stern: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 2.6l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L2.8 7.8l5-.6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  mail: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 5.5l7 5.5 7-5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  haus: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 9.2L10 3.5l7 5.7V16.5H3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 16.5v-4.3h4v4.3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  tasten: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2" y="5" width="16" height="10" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 8.2h1M8.5 8.2h1M12 8.2h1M15 8.2h0M6 11.8h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  excel: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 2.5h7l3.5 3.5v11.5H5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 9.5l4 5M12 9.5l-4 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  bank: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2.5 7.5L10 3l7.5 4.5zM4.5 8.5v6M8 8.5v6M12 8.5v6M15.5 8.5v6M2.5 17h15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  kartei: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="5" width="15" height="11.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 5V3.5h9V5M6 9.5h8M6 12.5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>',
  diagramm: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="2.5" width="15" height="15" rx="2" fill="none" stroke="#1d6f42" stroke-width="1.5"/><path d="M6 14V10.5M10 14V6.5M14 14V8.5" stroke="#1d6f42" stroke-width="2" stroke-linecap="round"/></svg>',
  ab: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 3v9.5M6 8.8l4 4 4-4M3.5 16.5h13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  auf: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 13V3.5M6 7.2l4-4 4 4M3.5 16.5h13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 9v5M10 6.2v.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' };
// die Gruppen und Einträge: [Schlüssel, Zeichen, Titel, Erklärung, Aktion]; ohne Aktion (z. B. in der Vorschau) fällt der Eintrag weg
function einstGruppen() {
  const ohneVorschau = fn => DEMO ? null : fn;
  return [
    ['Personen', [
      ['pers-liste', 'pers', 'Personenliste', 'Personen der Gliederungen und Fachreferate; Stern = Hauptansprechperson des Fachreferats', () => personenListeDialog()]]],
    ['E-Mail', [
      ['vorlagen', 'mail', 'E-Mail-Vorlagen', 'Texte für Rundmails und Spendenübergabe', () => vorlagenDialog()]]],
    ['Bedienung', [
      ['tasten', 'tasten', 'Tastaturbefehle', 'Übersicht und eigene Tasten festlegen', () => tastenDialog()]]],
    ['Daten einlesen', [
      ['upl', 'diagramm', 'UPL einlesen', 'Excel der Investitionsabfrage – legt die Bedarfe an oder ergänzt sie', ohneVorschau(async () => { const f = await pickFile('.xlsx'); if (f) await uplImport(f); })],
      flAktiv() ? null : ['kartei', 'kartei', 'Förder-Kartei', 'Excel „Banken- und Stiftungsübersicht“ wählen oder verknüpfen' + (KR.list.length ? ' (' + KR.list.length + ' Förderer)' : ''), ohneVorschau(async () => { if (ST.conn !== 'ok' && !await connectFolder()) return; await karteiChoose(); })]]],
    ['Datensicherung', [
      ['backup', 'ab', 'Sicherung herunterladen', 'Eine Kopie aller Daten als Datei (.json) – z. B. vor großen Änderungen', ohneVorschau(() => saveBackup())],
      ['restore', 'auf', 'Sicherung laden …', 'Stand aus einer Sicherung zurückholen; der jetzige Stand wird vorher gesichert', ohneVorschau(() => openBackup())]]],
  ].map(([t, L]) => [t, L.filter(x => x && x[4])]).filter(([, L]) => L.length);
}
async function einstellungen() {
  closeMenus();
  const G = einstGruppen(), aktion = {};
  const eintrag = ([k, ic, t, s, fn]) => { aktion[k] = fn;
    return h('button', { type: 'button', class: 'einst-e', 'data-k': k, onclick: () => zu(k) }, h('span', { class: 'einst-ic', html: EI[ic] }), h('span', { class: 'einst-t' }, h('b', null, t), h('span', null, s)), h('span', { class: 'einst-pf', 'aria-hidden': 'true' }, '›')); };
  let zu = () => {};
  const fuss = h('div', { class: 'einst-fuss' }, h('button', { type: 'button', class: 'einst-ueber', 'data-k': 'about', onclick: () => zu('about') }, h('span', { html: EI.info }), 'Über die Bedarfsliste · Version ' + APP_INFO.version + ' · was ist neu'));
  aktion.about = () => about();
  const body = h('div', { class: 'einst' }, ...G.map(([t, L]) => h('section', { class: 'einst-g' }, h('h3', null, t), h('div', { class: 'einst-l' }, ...L.map(eintrag)))), fuss);
  const k = await modal('Einstellungen', body, [], { cls: 'einst-modal', expose: c => { zu = c; setTimeout(() => { const b = body.querySelector('.einst-e'); if (b) b.focus(); }, 30); } });
  if (!k || !aktion[k]) return;
  try { await aktion[k](); } catch (e) { console.warn(e); }
  if (!$('.modal')) einstellungen();                                             // danach zurück in die Einstellungen
}
