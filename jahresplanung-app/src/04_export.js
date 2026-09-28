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
const ICS_KINDS = [['S', 'Start Selektion'], ['I', 'Start inhaltliche Arbeit'], ['P', 'PAL (Briefkasten)'], ['steps', 'Arbeitsschritte aus Detailplänen'], ['ms', 'Meilensteine/Ziele aus Detailplänen'], ['vac', 'Urlaube']];
// alle wählbaren Kalendereinträge; jeder Eintrag ist ganztägig
function icsItems(o) {
  const a = o.from, b = o.to, out = [];
  const who = o.person, match = n => !who || (n || '') === who;
  for (const x of C.ms) {
    if (!o.ms.has(x.id)) continue;
    for (const [t, k, lab] of TYPES) {
      if (!o.kinds[t] || x[k] == null || x[k] < a || x[k] > b || !match(x.m.verantwortlich)) continue;
      out.push({ kind: t, mid: x.id, uid: x.id + '-' + t + '-' + ds(x[k]), a: x[k], b: x[k], summary: (t === 'P' ? 'PAL' : lab) + ' · ' + x.m.name,
        desc: [x.m.name, TYPE_LABEL[t] + ': ' + fmtW(x[k]), x.pal != null && t !== 'P' ? 'PAL: ' + fmtW(x.pal) : '', t === 'P' && x.m.palStatus !== 'fest' ? 'PAL noch vorläufig' : '',
          x.m.verantwortlich ? 'Hauptverantwortlich: ' + x.m.verantwortlich : '', x.m.hinweis].filter(Boolean).join('\n') });
    }
    if (x.pc) for (const s of x.m.plan.steps) {
      const r = x.pc.map.get(s.id), isPoint = s.typ !== 'aufgabe', kind = isPoint ? 'ms' : 'steps';
      if (!o.kinds[kind] || !r || r.start == null || s.typ === 'gruppe' || r.end < a || r.start > b || !match(s.wer)) continue;
      out.push({ kind, mid: x.id, uid: x.id + '-' + s.id, a: isPoint ? r.end : r.start, b: isPoint ? r.end : Math.max(r.start, r.end - 1),
        summary: (isPoint ? '◆ ' : '') + s.name + ' · ' + x.m.name, desc: [x.m.name, s.wer ? 'Zugeordnet: ' + s.wer : '', s.kommentar, isPoint ? '' : fmtW(r.start) + ' – ' + fmtW(r.end)].filter(Boolean).join('\n') });
    }
  }
  if (o.kinds.vac) for (const v of C.vac) if (v.bis >= a && v.von <= b && match(v.u.wer)) out.push({ kind: 'vac', mid: null, uid: 'u-' + v.u.id, a: v.von, b: v.bis, summary: 'Urlaub: ' + (v.u.wer || '?'), desc: v.u.notiz });
  return out.sort((p, q) => p.a - q.a);
}
function icsFile(name, items) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jahresplanung Aussenkommunikation//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(name)];
  items.forEach(e => L.push(...icsEvent(e.uid, e.a, e.b, e.summary, e.desc)));
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
const fileSafe = s => String(s).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 60);
async function exportICS() {
  const y = UI.year, list = C.ms.filter(x => inYear(x, y)), today = todayDn();
  const last = UI.icsOpts || {};
  const o = { kinds: Object.assign({ S: true, I: true, P: true, steps: false, ms: false, vac: false }, last.kinds), ms: new Set(list.map(x => x.id)),
    person: '', range: last.range || 'year', from: mkdn(y, 1, 1), to: mkdn(y, 12, 31), split: last.split || 'one' };
  const persons = D.personen.map(p => p.name);
  const wrap = h('div', { class: 'form' }), count = h('div', { class: 'calcline' });
  const range = () => {
    if (o.range === 'year') { o.from = mkdn(y, 1, 1); o.to = mkdn(y, 12, 31); }
    else if (o.range === 'rest') { o.from = Math.max(today, mkdn(y, 1, 1)); o.to = mkdn(y, 12, 31); }
  };
  const upd = () => {
    range();
    const items = icsItems(o), files = o.split === 'one' ? 1 : new Set(items.map(e => o.split === 'kind' ? e.kind : e.mid || 'vac')).size;
    count.textContent = items.length + ' Termine' + (items.length ? ' · ' + files + (files === 1 ? ' Datei' : ' Dateien (als ZIP)') : '') + ' · alle ganztägig';
  };
  const preset = kinds => { o.kinds = Object.assign({ S: false, I: false, P: false, steps: false, ms: false, vac: false }, kinds); draw(); };
  const draw = () => {
    const cb = k => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!o.kinds[k], onchange: e => { o.kinds[k] = e.target.checked; upd(); } }), ICS_KINDS.find(q => q[0] === k)[1]);
    const radio = (name, val, label, key) => h('label', { class: 'check' }, h('input', { type: 'radio', name, checked: o[key] === val, onchange: () => { o[key] = val; draw(); } }), label);
    wrap.replaceChildren(
      h('p', { class: 'muted small' }, 'Erstellt Kalenderdateien (.ics) für Outlook. Doppelklick auf die Datei → „Als neuen Kalender öffnen“ oder importieren.'),
      h('div', { class: 'ics-presets' }, h('span', { class: 'muted small' }, 'Schnellauswahl:'),
        h('button', { class: 'pill', onclick: e => { e.preventDefault(); preset({ S: true }); } }, 'nur Selektions-Starts'),
        h('button', { class: 'pill', onclick: e => { e.preventDefault(); preset({ I: true }); } }, 'nur Inhalts-Starts'),
        h('button', { class: 'pill', onclick: e => { e.preventDefault(); preset({ P: true }); } }, 'nur PAL'),
        h('button', { class: 'pill', onclick: e => { e.preventDefault(); preset({ S: true, I: true, P: true }); } }, 'alle Starts + PAL'),
        h('button', { class: 'pill', onclick: e => { e.preventDefault(); preset({ S: true, I: true, P: true, steps: true, ms: true }); } }, 'alles aus den Maßnahmen')),
      h('div', { class: 'pdf-cols' },
        h('div', null,
          h('h3', null, 'Termine'), h('div', { class: 'checks' }, ICS_KINDS.map(([k]) => cb(k))),
          h('h3', null, 'Person'), h('select', { onchange: e => { o.person = e.target.value; upd(); } }, h('option', { value: '' }, 'alle Personen'),
            persons.map(n => h('option', { value: n, selected: o.person === n }, n))),
          h('div', { class: 'muted small' }, 'Starts/PAL: hauptverantwortliche Person · Schritte: zugeordnete Person'),
          h('h3', null, 'Zeitraum'), h('div', { class: 'checks' }, radio('rng', 'year', 'ganzes Jahr ' + y, 'range'), radio('rng', 'rest', 'ab heute bis Jahresende', 'range'), radio('rng', 'free', 'eigener Zeitraum', 'range'),
            o.range === 'free' ? h('div', { class: 'inl' }, h('input', { type: 'date', value: ds(o.from), onchange: e => { o.from = dn(e.target.value) ?? o.from; upd(); } }), '–',
              h('input', { type: 'date', value: ds(o.to), onchange: e => { o.to = dn(e.target.value) ?? o.to; upd(); } })) : null),
          h('h3', null, 'Dateien'), h('div', { class: 'checks' }, radio('spl', 'one', 'eine Kalenderdatei', 'split'), radio('spl', 'mass', 'je Maßnahme eine Datei', 'split'), radio('spl', 'kind', 'je Terminart eine Datei', 'split'))),
        msPicker(o.ms, list, upd)),
      count,
      h('p', { class: 'muted small' }, 'Hinweis: Wiederholter Import kann Termine in Outlook doppelt anlegen. Am übersichtlichsten ist ein eigener Kalender „Jahresplanung“, den du vor einem neuen Import löschst.'));
    upd();
  };
  draw();
  const ok = await modal('Termine für Outlook exportieren', wrap, [['Abbrechen', false], ['Kalenderdatei erstellen', true, 'primary']], { wide: true });
  if (!ok) return;
  UI.icsOpts = { kinds: o.kinds, range: o.range, split: o.split }; saveUI();
  range();
  const items = icsItems(o);
  if (!items.length) { toast('Keine Termine für diese Auswahl.', 'warn'); return; }
  const base = 'Jahresplanung_' + y + (o.person ? '_' + fileSafe(o.person) : '');
  const kindName = k => ({ S: 'Start_Selektion', I: 'Start_Inhalt', P: 'PAL', steps: 'Arbeitsschritte', ms: 'Meilensteine', vac: 'Urlaube' })[k];
  const onlyKind = Object.keys(o.kinds).filter(k => o.kinds[k]);
  if (o.split === 'one') {
    const suffix = onlyKind.length === 1 ? '_' + kindName(onlyKind[0]) : o.ms.size === 1 ? '_' + fileSafe(C.byId.get([...o.ms][0]).m.name) : '';
    download(base + suffix + '.ics', new Blob([icsFile('Jahresplanung ' + y + suffix.replace(/_/g, ' '), items)], { type: 'text/calendar' }));
  } else {
    const groups = new Map();
    items.forEach(e => { const k = o.split === 'kind' ? e.kind : e.mid || 'vac'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
    const files = [...groups].map(([k, its]) => {
      const nm = o.split === 'kind' ? kindName(k) : k === 'vac' ? 'Urlaube' : fileSafe(C.byId.get(k).m.name);
      return { name: base + '_' + nm + '.ics', data: icsFile('Jahresplanung ' + y + ' ' + nm.replace(/_/g, ' '), its) };
    });
    download(base + '_Kalender.zip', zipBlob(files, 'application/zip'));
  }
  toast(items.length + ' Termine exportiert', 'ok');
}

/* ---------- Drucken über das Browser-Menü: helle Darstellung (PDF-Export siehe 15_pdf.js) */
window.addEventListener('afterprint', () => { if (UI.printing) { UI.printing = false; renderNow(); } });
