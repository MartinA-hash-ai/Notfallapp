/* ===================================================================== Förderer-Übersicht: „Förderer-Übersicht.xlsx“ neben der Bedarfsliste
   Die Liste schreibt sie selbst aus ihren Daten – alle Bedarfe, auch archivierte (gelöschte fehlen) – und hält sie etwa jede Minute aktuell.
   Blatt „Förderer“: je Förderer eine Zeile mit Anfragen, Zusagen, Ablehnungen; Blatt „Anfragen“: je Förderer und Bedarf eine Zeile.
   Nur zum Lesen und Filtern: Änderungen in der Datei überschreibt die Liste. Für Recherchen nennen die Prompts die Erfahrungen bei ähnlichen Bedarfen. */

const UEB_DATEI = 'Förderer-Übersicht.xlsx';
const ueJahr = (b, f) => (validIso(f.entscheidungAm) ? f.entscheidungAm : validIso(f.beantragtAm) ? f.beantragtAm : validIso(b.angelegt) ? b.angelegt : '').slice(0, 4);
const ueEinsch = k => (EINSCH.find(e => e[0] === k) || [])[1] || '';
// alle Anfragen: je Förderer (mit Namen) in jedem Bedarf
const ueAnfragen = () => D.bedarfe.flatMap(b => b.foerderer.filter(f => f.name.trim()).map(f => ({ b, f })));

function ueBlaetter() {
  const head = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, z = { border: 'thin', v: 'top', wrap: true };
  const kopf = L => L.map(v => ({ v, st: head })), zeile = L => L.map(v => ({ v: v == null ? '' : v, st: z, t: typeof v === 'number' ? 'n' : undefined }));
  const A = ueAnfragen().sort((x, y) => x.f.name.localeCompare(y.f.name, 'de') || ueJahr(y.b, y.f).localeCompare(ueJahr(x.b, x.f)));
  const anfragen = [kopf(['Förderer', 'Art', 'Bedarf', 'Gliederung', 'Stichworte', 'Jahr', 'Stand', 'Betrag (€)', 'Grund der Ablehnung', 'Pro', 'Contra', 'Einschätzung', 'Ausführliche Recherche (Datei)', 'Quellen', 'Archiviert']),
    ...A.map(({ b, f }) => zeile([f.name.trim(), f.art, b.titel, b.gliederung === DIO ? 'Diözese' : b.gliederung, b.stichworte.join(', '), ueJahr(b, f), F_ST_L[f.status] || f.status,
      f.status === 'abgelehnt' ? (+f.betrag || null) : foeAmt(f) || null, f.grund, f.warum, f.knackpunkte, ueEinsch(f.einsch), f.datei, f.quellen, b.archiv ? 'ja' : ''])) ];
  // je Förderer: Angaben aus der neuesten Anfrage, die sie hat; Zahlen über alle Anfragen
  const M = new Map();
  for (const { b, f } of A) {
    const k = kkey(f.name), m = M.get(k) || { n: f.name.trim(), L: [] }; m.L.push({ b, f }); M.set(k, m);
  }
  const erst = (L, fn) => { for (const x of L) { const v = fn(x); if (v) return v; } return ''; };
  const foerderer = [kopf(['Förderer', 'Art', 'Website', 'Antragsweg', 'Kontakt', 'E-Mail', 'Telefon', 'Anfragen', 'Zugesagt', 'Abgelehnt', 'Offen', 'Summe zugesagt (€)', 'Letzte Anfrage', 'Bedarfe', 'Ausführliche Recherche (Datei)']),
    ...[...M.values()].sort((x, y) => x.n.localeCompare(y.n, 'de')).map(({ n, L }) => {
      const st = s => L.filter(x => x.f.status === s).length, k = erst(L, x => x.f.kontakte.find(c => c.n.trim() || c.mail.trim()));
      return zeile([n, erst(L, x => x.f.art), erst(L, x => x.f.web), erst(L, x => x.f.weg), k ? [k.n, k.rolle].filter(Boolean).join(', ') : '', k ? k.mail : '', k ? k.tel : '',
        L.length, st('zugesagt'), st('abgelehnt'), st('geplant') + st('beantragt'), L.filter(x => x.f.status === 'zugesagt').reduce((s, x) => s + foeAmt(x.f), 0) || null,
        L.map(x => ueJahr(x.b, x.f)).filter(Boolean).sort().pop() || '', L.map(x => x.b.titel + (x.f.status !== 'geplant' ? ' (' + F_ST_L[x.f.status] + ')' : '')).join('; '), erst(L, x => x.f.datei)]);
    })];
  const ende = (rows, n) => 'A1:' + colName(n - 1) + Math.max(1, rows.length);
  return [{ name: 'Förderer', cols: [30, 14, 26, 14, 24, 26, 16, 10, 10, 10, 8, 14, 12, 50, 30], rows: foerderer, heights: { 0: 30 }, freeze: 'B2', filter: ende(foerderer, 15) },
    { name: 'Anfragen', cols: [30, 14, 28, 14, 20, 8, 11, 12, 30, 40, 40, 16, 30, 40, 10], rows: anfragen, heights: { 0: 30 }, freeze: 'B2', filter: ende(anfragen, 15) },
    { name: 'Hinweis', cols: [110], grid: false, rows: [[{ v: 'Förderer-Übersicht', st: { b: true, sz: 15 } }], [{ v: 'Diese Datei schreibt die Bedarfsliste selbst aus allen Bedarfen (auch archivierten; gelöschte fehlen) und hält sie aktuell. Änderungen hier werden überschrieben – gepflegt wird in der Bedarfsliste. Zum Auswerten: Filter in der Kopfzeile (z. B. nach Stichwort, Stand oder Jahr).', st: { wrap: true, v: 'top' } }]], heights: { 1: 48 } }];
}
// kurze Prüfsumme der Inhalte: nur schreiben, wenn sich etwas geändert hat
const ueSumme = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length; };
let UE_BUSY = false;
async function ueSchreiben(force) {
  if (DEMO || UE_BUSY || ST.conn !== 'ok' || !ST.htmlDir || !ueAnfragen().length) return false;
  UE_BUSY = true;
  try {
    const S = ueBlaetter(), key = ueSumme(JSON.stringify(S.map(s => s.rows.map(r => r.map(c => c.v)))));
    let da = true; try { await ST.htmlDir.getFileHandle(UEB_DATEI); } catch (e) { da = false; }
    let alt = ''; try { alt = localStorage.getItem('bl-ueb') || ''; } catch (e) { /* ohne Speicher: jedes Mal schreiben */ }
    if (!force && da && alt === key) return false;
    const fh = await ST.htmlDir.getFileHandle(UEB_DATEI, { create: true }), w = await fh.createWritable(); await w.write(await xlsxBlob(S)); await w.close();
    try { localStorage.setItem('bl-ueb', key); } catch (e) { /* egal */ }
    return true;
  } catch (e) { console.warn(e); return false; }                          // z. B. in Excel geöffnet – beim nächsten Mal wieder
  finally { UE_BUSY = false; }
}

// für die Prompts: Erfahrungen mit Förderern bei ähnlichen Bedarfen (gleiches Stichwort oder gleiches Wort im Namen), ohne nur geplante
const UE_FUELL = /^(und|oder|für|fuer|der|die|das|des|den|dem|ein|eine|mit|von|zum|zur|neue?[rsnm]?|ersatz|anschaffung|beschaffung|projekt|bedarf|malteser)$/i;
// Worte ab 3 Buchstaben (MTW, RTW, AED), ohne Füllwörter und ohne Ortsnamen – sonst wären „Küche Brakel“ und „MTW Brakel“ ähnlich
const ueWorte = (b, orte) => new Set(norm(b.titel).split(/[^a-zäöüß0-9]+/).filter(w => w.length >= 3 && !UE_FUELL.test(w) && !orte.has(w)));
function ueAehnlich(b, max = 12) {
  const orte = new Set(D.bedarfe.flatMap(x => norm(x.gliederung).split(/[^a-zäöüß0-9]+/)).filter(Boolean)), W = ueWorte(b, orte), sw = new Set(b.stichworte.map(norm));
  const L = D.bedarfe.filter(x => x !== b && (x.stichworte.some(s => sw.has(norm(s))) || [...ueWorte(x, orte)].some(w => W.has(w))))
    .flatMap(x => x.foerderer.filter(f => f.name.trim() && f.status !== 'geplant').map(f => ({ b: x, f })))
    .sort((x, y) => ueJahr(y.b, y.f).localeCompare(ueJahr(x.b, x.f)));
  return L.slice(0, max).map(({ b: x, f }) => '- ' + f.name.trim() + ': ' + F_ST_L[f.status] + (foeAmt(f) && f.status !== 'abgelehnt' ? ' ' + eur(foeAmt(f)) : '') + ' für „' + (x.titel || 'Bedarf') + '“'
    + ' (' + [x.gliederung === DIO ? 'Diözese' : x.gliederung, ueJahr(x, f)].filter(Boolean).join(', ') + ')' + (f.status === 'abgelehnt' && f.grund.trim() ? ' – Grund: ' + f.grund.trim().replace(/\s*\n+\s*/g, ' ') : ''));
}
