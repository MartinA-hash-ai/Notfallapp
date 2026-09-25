/* ===================================================================== Exporte: Excel (.xlsx), Outlook (.ics), Drucken/PDF */

/* ---------- ZIP (ohne Kompression) für .xlsx */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipBlob(files, type) {
  const enc = new TextEncoder(), parts = [], central = [];
  const now = new Date();
  const dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dtime, true); lh.setUint16(12, ddate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dtime, true); ch.setUint16(14, ddate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type });
}

/* Excel-Arbeitsmappen: siehe 14_xlsx.js */

/* ---------- Outlook / Kalender (.ics) */
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function icsFold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = '', lim = 75;
  for (const ch of line) {
    if (enc.encode(cur + ch).length > lim) { out.push(cur); cur = ch; lim = 74; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const icsDate = n => ds(n).replace(/-/g, '');
function icsEvent(uidv, a, b, summary, desc) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return ['BEGIN:VEVENT', 'UID:' + uidv + '@jahresplanung.local', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + icsDate(a), 'DTEND;VALUE=DATE:' + icsDate(b + 1),
    'SUMMARY:' + icsEsc(summary), desc ? 'DESCRIPTION:' + icsEsc(desc) : null, 'CATEGORIES:Jahresplanung', 'TRANSP:TRANSPARENT',
    'X-MICROSOFT-CDO-BUSYSTATUS:FREE', 'END:VEVENT'].filter(Boolean);
}
async function exportICS() {
  const y = UI.year;
  const o = { S: true, I: true, P: true, onlyVisible: false, steps: true, vac: false };
  const cb = (k, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o[k], onchange: e => { o[k] = e.target.checked; } }), label);
  const ok = await modal('Termine für Outlook exportieren', h('div', { class: 'form' },
    h('p', null, `Erstellt eine Kalenderdatei (.ics) mit den Terminen ${y}. In Outlook: Datei öffnen → „Als neuen Kalender öffnen“ oder importieren.`),
    h('div', { class: 'checks' }, cb('S', 'Start Selektion'), cb('I', 'Start inhaltliche Arbeit'), cb('P', 'PAL (Briefkasten-Termin)'),
      cb('steps', 'Meilensteine und Arbeitsschritte aus Detailplänen'), cb('vac', 'Urlaube'), cb('onlyVisible', 'nur die in der Seitenleiste angezeigten Maßnahmen')),
    h('p', { class: 'muted small' }, 'Hinweis: Wiederholter Import legt die Termine in Outlook ggf. doppelt an. Am übersichtlichsten ist ein eigener Kalender „Jahresplanung“, den du vor einem neuen Import löschst.')),
    [['Abbrechen', false], ['Kalenderdatei erstellen', true, 'primary']]);
  if (!ok) return;
  const a = mkdn(y, 1, 1), b = mkdn(y, 12, 31), L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jahresplanung Aussenkommunikation//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsEsc('Jahresplanung ' + y)];
  let n = 0;
  for (const x of C.ms) {
    if (o.onlyVisible && !visibleM(x)) continue;
    for (const [t, k, lab] of TYPES) {
      if (!o[t] || x[k] == null || x[k] < a || x[k] > b) continue;
      L.push(...icsEvent(x.id + '-' + t + '-' + ds(x[k]), x[k], x[k], (t === 'P' ? 'PAL' : lab) + ' · ' + x.m.name,
        [x.m.name, TYPE_LABEL[t] + ': ' + fmtW(x[k]), x.pal != null && t !== 'P' ? 'PAL: ' + fmtW(x.pal) : '', t === 'P' && x.m.palStatus !== 'fest' ? 'PAL noch vorläufig' : '', x.m.verantwortlich ? 'Verantwortlich: ' + x.m.verantwortlich : '', x.m.hinweis].filter(Boolean).join('\n')));
      n++;
    }
    if (o.steps && x.pc) for (const s of x.m.plan.steps) {
      const r = x.pc.map.get(s.id);
      if (!r || r.start == null || s.typ === 'gruppe' || r.end < a || r.start > b) continue;
      const isPoint = s.typ !== 'aufgabe';
      L.push(...icsEvent(x.id + '-' + s.id + '-' + ds(r.start), r.start, isPoint ? r.start : Math.max(r.start, r.end - 1),
        (isPoint ? '◆ ' : '') + s.name + ' · ' + x.m.name, [s.wer ? 'Zugeordnet: ' + s.wer : '', s.kommentar, isPoint ? '' : 'bis ' + fmtW(r.end)].filter(Boolean).join('\n')));
      n++;
    }
  }
  if (o.vac) for (const v of C.vac) if (v.bis >= a && v.von <= b) { L.push(...icsEvent('u-' + v.u.id, v.von, v.bis, 'Urlaub: ' + (v.u.wer || '?'), v.u.notiz)); n++; }
  L.push('END:VCALENDAR');
  download('Jahresplanung_' + y + '.ics', new Blob([L.map(icsFold).join('\r\n') + '\r\n'], { type: 'text/calendar' }));
  toast(n + ' Termine exportiert', 'ok');
}

/* ---------- Drucken / PDF */
function printView() {
  UI.printing = true; renderNow();
  setTimeout(() => { window.print(); }, 60);
}
window.addEventListener('afterprint', () => { if (UI.printing) { UI.printing = false; renderNow(); } });
