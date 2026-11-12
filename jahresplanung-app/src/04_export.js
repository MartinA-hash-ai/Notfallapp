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
// at: Uhrzeit „HH:MM“ – dann ein kurzer Termin (15 Minuten, „frei“) mit Erinnerung zu Beginn statt eines Ganztagestermins
// (bei Ganztagesterminen übernimmt Outlook die Erinnerung nicht zuverlässig)
function icsEvent(uidv, a, b, summary, desc, at) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  let when = ['DTSTART;VALUE=DATE:' + icsDate(a), 'DTEND;VALUE=DATE:' + icsDate(b + 1)], alarm = [];
  if (at) {
    const [hh, mm] = at.split(':').map(Number), t0 = hh * 60 + mm, t1 = Math.min(t0 + 15, 23 * 60 + 59), tm = t => p2(Math.floor(t / 60)) + p2(t % 60) + '00';
    when = ['DTSTART;TZID=Europe/Berlin:' + icsDate(a) + 'T' + tm(t0), 'DTEND;TZID=Europe/Berlin:' + icsDate(a) + 'T' + tm(t1)];
    alarm = ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(summary), 'TRIGGER:-PT0M', 'END:VALARM'];
  }
  return ['BEGIN:VEVENT', 'UID:' + uidv + '@jahresplanung.local', 'DTSTAMP:' + stamp, ...when,
    'SUMMARY:' + icsEsc(summary), desc ? 'DESCRIPTION:' + icsEsc(desc) : null, 'CATEGORIES:Jahresplanung', 'TRANSP:TRANSPARENT',
    'X-MICROSOFT-CDO-BUSYSTATUS:FREE', ...alarm, 'END:VEVENT'].filter(Boolean);
}
const ICS_TZ = ['BEGIN:VTIMEZONE', 'TZID:Europe/Berlin', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'];
/* Termine für Outlook (0.54): je Maßnahme der Start (frühester Termin) und die Starts der Abschnitte – jeweils mit Puffer in Werktagen –
   sowie die Aufgaben einer Person aus den Detailplänen; immer eine Datei, alles ganztägig */
const wtBack = (n, w) => n == null || !(w > 0) ? n : dateForWT(n, w);              // w Werktage vorher
// frühester Termin der Maßnahme (Starts vor dem PAL, Schritte im Detailplan, PAL)
function icsFirst(x) {
  const c = [...PHV().map(p => x.st[p.key]), x.pal];
  if (x.pc) for (const r of x.pc.map.values()) c.push(r.start);
  const v = c.filter(n => n != null);
  return v.length ? Math.min(...v) : null;
}
// Abschnitte: im Detailplan die Abschnitte (Gruppen), sonst die Bereiche vor dem PAL
function icsSections(x) {
  const steps = x.pc ? x.m.plan.steps : [];
  if (steps.some(s => s.typ === 'gruppe')) {
    const out = []; let g = null;
    for (const s of steps) {
      if (s.typ === 'gruppe') { g = { id: s.id, k: s.bereich && !phNach(s.bereich) ? s.bereich : '', name: str(s.name).trim() || (s.bereich ? phName(s.bereich) : 'Abschnitt'), n: null }; out.push(g); continue; }
      const r = x.pc.map.get(s.id); if (g && r && r.start != null && (g.n == null || r.start < g.n)) g.n = r.start;
    }
    // Bereich mit nur einem Abschnitt: derselbe Start wie in der Tabelle (festgelegter Beginn-Schritt)
    for (const g of out) if (g.k && x.st[g.k] != null && out.filter(q => q.k === g.k).length === 1) g.n = x.st[g.k];
    return out.filter(g => g.n != null);
  }
  return PHV().filter(p => x.st[p.key] != null).map(p => ({ id: p.key, k: p.key, name: p.name, n: x.st[p.key] }));
}
// Aufgaben, Meilensteine und Ziele einer Person aus den Detailplänen
function icsTasks(person, list) {
  const out = [];
  if (person) for (const x of list) if (x.pc) for (const s of x.m.plan.steps) {
    if (s.typ === 'gruppe' || str(s.wer).trim() !== person) continue;
    const r = x.pc.map.get(s.id); if (!r || r.start == null) continue;
    const pt = s.typ !== 'aufgabe';
    out.push({ key: x.id + ':' + s.id, x, s, pt, a: pt ? r.end : r.start, b: pt ? r.end : Math.max(r.start, r.end - 1) });
  }
  return out.sort((p, q) => p.a - q.a || p.x.m.name.localeCompare(q.x.m.name, 'de'));
}
// alle Termine der Auswahl o = { ms, off, tk, start: {on, buf}, ab: {on, buf}, tbuf, person, fut }
function icsCollect(o, list) {
  const out = [], today = todayDn(), keep = e => !o.fut || e.a >= today;
  const info = x => [x.pal != null ? 'PAL: ' + fmtW(x.pal) + (x.m.palStatus !== 'fest' ? ' (vorläufig)' : '') : '', respOf(x) ? 'Verantwortlich: ' + respOf(x) : '', x.m.hinweis].filter(Boolean);
  for (const x of list) {
    if (!o.ms.has(x.id)) continue;
    const nm = x.m.name || '(ohne Namen)';
    if (o.start.on) {
      const n = icsFirst(x), key = x.id + ':start';
      if (n != null && !o.off.has(key)) out.push({ key, kind: 'start', mid: x.id, uid: x.id + '-start', n, a: wtBack(n, o.start.buf),
        summary: nm + ' – Start' + (o.start.buf > 0 ? ' ' + fmtWS(n) : ''), desc: [nm, 'Start der Maßnahme: ' + fmtW(n) + (o.start.buf > 0 ? ' (Erinnerung ' + o.start.buf + ' Werktage vorher)' : ''), ...info(x)].join('\n') });
    }
    if (o.ab.on) for (const g of icsSections(x)) {
      const key = x.id + ':ab:' + g.id;
      if (!o.off.has(key)) out.push({ key, kind: 'ab', mid: x.id, uid: x.id + '-ab-' + g.id, n: g.n, a: wtBack(g.n, o.ab.buf), g,
        summary: nm + ' – ' + g.name + (o.ab.buf > 0 ? ' ab ' + fmtWS(g.n) : ''), desc: [nm, 'Abschnitt „' + g.name + '“ beginnt: ' + fmtW(g.n) + (o.ab.buf > 0 ? ' (Erinnerung ' + o.ab.buf + ' Werktage vorher)' : ''), ...info(x)].join('\n') });
    }
  }
  for (const t of icsTasks(o.person, list)) {
    if (!o.tk.has(t.key)) continue;
    const nm = t.x.m.name || '(ohne Namen)', when = t.pt ? fmtW(t.a) : fmtW(t.a) + (t.b > t.a ? ' – ' + fmtW(t.b) : '');
    out.push({ key: t.key, kind: 'task', mid: t.x.id, uid: t.x.id + '-' + t.s.id, n: t.a, a: wtBack(t.a, o.tbuf),
      summary: (t.pt ? '◆ ' : '') + (t.s.name || 'Aufgabe') + ' · ' + nm + (o.tbuf > 0 ? ' ab ' + fmtWS(t.a) : ''),
      desc: [nm, (t.s.name || 'Aufgabe') + ': ' + when, 'Zugeordnet: ' + o.person, t.s.kommentar, ...info(t.x)].filter(Boolean).join('\n') });
  }
  return out.filter(keep).map(e => Object.assign(e, { b: e.a })).sort((p, q) => p.a - q.a);
}
function icsFile(name, items, at) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jahresplanung Aussenkommunikation//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(name), ...(at ? ICS_TZ : [])];
  items.forEach(e => L.push(...icsEvent(e.uid, e.a, e.b, e.summary, e.desc, at)));
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
const fileSafe = s => String(s).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 60);
async function exportICS() {
  const y = UI.year, list = C.ms.filter(x => inYear(x, y)), today = todayDn();
  const last = UI.icsOpts || {}, ids = new Set(list.map(x => x.id)), arr = v => Array.isArray(v) ? v : [];
  const persons = [...new Set([...D.personen.map(p => p.name), ...list.flatMap(x => x.pc ? x.m.plan.steps.map(s => str(s.wer).trim()) : [])].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  const num = (v, d) => isNum(v) ? clamp(Math.round(+v), 0, 60) : d;
  const o = {
    tab: last.tab === 'tasks' ? 'tasks' : 'ms', q: '', resp: '', fut: last.fut !== false,
    start: { on: last.start ? last.start.on !== false : true, buf: num(last.start && last.start.buf, 5) },
    ab: { on: !!(last.ab && last.ab.on), buf: num(last.ab && last.ab.buf, 2) }, tbuf: num(last.tbuf, 0),
    ms: new Set(arr(last.ms).filter(id => ids.has(id))), off: new Set(arr(last.off)), tk: new Set(arr(last.tk)), tags: new Set(),
    alarm: { on: !last.alarm || last.alarm.on !== false, t: /^\d\d:\d\d$/.test(last.alarm && last.alarm.t) ? last.alarm.t : '09:00' },
    person: persons.includes(last.person) ? last.person : persons.includes(UI.userName) ? UI.userName : '' };
  const lastDate = x => Math.max(...[x.pal, ...Object.values(x.st), ...(x.pc ? [...x.pc.map.values()].map(r => r.end) : [])].filter(n => n != null));
  const tagHit = x => !o.tags.size || ((x.m.tags || []).length ? x.m.tags.some(t => o.tags.has(t)) : o.tags.has(''));   // Schlagworte: eins davon gewählt ('' = ohne)
  const visible = () => list.filter(x => (!o.fut || lastDate(x) >= today) && (!o.resp || respOf(x) === o.resp) && tagHit(x)
    && (!o.q || (x.m.name || '').toLowerCase().includes(o.q.toLowerCase())));
  const wrap = h('div', { class: 'icsx' }), body = h('div', { class: 'icsbody' }), count = h('div', { class: 'ics-count' });
  // kleine Bausteine
  const sw = (on, label, onclick) => h('button', { class: 'ics-sw' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on), 'aria-label': label, onclick }, h('span', { class: 'vs-knob' }));
  const stepper = (val, set, label) => {
    const inp = h('input', { type: 'number', min: 0, max: 60, value: val, 'aria-label': label + ' – Werktage vorher', onchange: e => { set(num(e.target.value, 0)); draw(); } });
    return h('span', { class: 'ics-buf', tip: 'Erinnerung so viele Werktage vor dem Termin (0 = am Tag selbst)' },
      h('button', { class: 'ics-pm', 'aria-label': 'weniger', onclick: () => { set(Math.max(0, val - 1)); draw(); } }, '−'), inp,
      h('button', { class: 'ics-pm', 'aria-label': 'mehr', onclick: () => { set(Math.min(60, val + 1)); draw(); } }, '+'), h('span', { class: 'unit' }, 'WT vorher'));
  };
  const allNone = (sel, keys) => h('span', { class: 'ics-an' },
    h('button', { class: 'link', onclick: () => { keys().forEach(k => sel.add(k)); draw(); } }, 'alle'), ' · ',
    h('button', { class: 'link', onclick: () => { keys().forEach(k => sel.delete(k)); draw(); } }, 'keine'));
  const futPill = () => h('button', { class: 'pill ics-fut' + (o.fut ? ' on' : ''), 'aria-pressed': String(o.fut), tip: 'vergangene Termine ausblenden', onclick: () => { o.fut = !o.fut; draw(); } }, 'ab heute');
  const tab = (k, ic, label) => h('button', { class: 'seg-btn' + (o.tab === k ? ' on' : ''), dataset: { tab: k }, 'aria-pressed': String(o.tab === k), onclick: () => { o.tab = k; draw(); } }, icon(ic), label);
  const dateTxt = n => n == null ? '–' : fmtWS(n);
  // Schlagwort-Filter: Knopf mit Auswahlliste
  const tagsOf = () => { const s = new Set(); list.forEach(x => (x.m.tags || []).forEach(t => s.add(t))); return [...s].sort((a, b) => a.localeCompare(b, 'de')); };
  const tagBtn = () => {
    const tags = tagsOf(), noTag = list.some(x => !(x.m.tags || []).length);
    if (!tags.length) return null;
    const box = h('div', { class: 'ics-tagpop' });
    const fill = () => {
      const item = (k, label) => h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: o.tags.has(k), onchange: e => { e.target.checked ? o.tags.add(k) : o.tags.delete(k); draw(); fill(); } }), label);
      setKids(box, tags.map(t => item(t, h('span', { class: 'tagchip' }, t))), noTag ? item('', h('span', { class: 'muted' }, 'ohne Schlagwort')) : null,
        o.tags.size ? h('button', { class: 'link small', onclick: () => { o.tags.clear(); closeMenu(); draw(); } }, 'alle zeigen') : null);
    };
    const n = o.tags.size, btn = h('button', { class: 'ics-tagbtn' + (n ? ' on' : ''), 'aria-label': 'nach Schlagworten filtern', onclick: e => { e.stopPropagation(); fill(); popover(btn, box); } },
      icon('tag'), 'Schlagworte' + (n ? ' (' + n + ')' : ''), ' ▾');
    return btn;
  };
  const alarmCtl = () => h('span', { class: 'ics-alarm' + (o.alarm.on ? ' on' : ''), tip: o.alarm.on ? 'Termine mit Hinweis (Erinnerung) in Outlook – als kurzer Termin um diese Uhrzeit, als „frei“ eingetragen' : 'ohne Hinweis – Ganztagestermine' },
    sw(o.alarm.on, 'Hinweis in Outlook', () => { o.alarm.on = !o.alarm.on; draw(); }), icon('bell'),
    o.alarm.on ? h('input', { type: 'time', class: 'ics-time', value: o.alarm.t, step: 300, 'aria-label': 'Uhrzeit des Hinweises', onchange: e => { if (/^\d\d:\d\d$/.test(e.target.value)) o.alarm.t = e.target.value; draw(); } }) : h('span', { class: 'muted small' }, 'ganztägig'));
  const msView = items => {
    const opt = (k, ic, label) => h('div', { class: 'ics-opt' + (o[k].on ? ' on' : ''), dataset: { opt: k } },
      sw(o[k].on, label, () => { o[k].on = !o[k].on; draw(); }), icon(ic), h('b', null, label), o[k].on ? stepper(o[k].buf, v => { o[k].buf = v; }, label) : null);
    const vis = visible(), byKey = new Map(items.map(e => [e.key, e]));
    const chip = (key, cls, lead, n, title) => {
      const e = byKey.get(key), off = o.off.has(key);
      return h('button', { class: 'icsc ' + cls + (off ? ' off' : '') + (!e && !off ? ' past' : ''), dataset: { key }, 'aria-pressed': String(!off), tip: title + ': ' + fmtW(n) + (e && e.a !== n ? ' – Erinnerung ' + fmtW(e.a) : '') + (off ? ' (abgewählt)' : ''),
        onclick: () => { off ? o.off.delete(key) : o.off.add(key); draw(); } }, lead, h('span', { class: 'd' }, dateTxt(e ? e.a : wtBack(n, cls === 'k-start' ? o.start.buf : o.ab.buf))));
    };
    return [
      h('div', { class: 'ics-opts' }, opt('start', 'flag', 'Start der Maßnahme'), opt('ab', 'layers', 'Start der Abschnitte')),
      h('div', { class: 'ics-filter' },
        h('input', { type: 'search', class: 'ics-q', placeholder: 'Suchen …', value: o.q, 'aria-label': 'Maßnahmen suchen', oninput: e => { o.q = e.target.value; drawList(); } }),
        h('select', { class: 'ics-resp', 'aria-label': 'Verantwortlich', onchange: e => { o.resp = e.target.value; draw(); } }, h('option', { value: '' }, 'alle Verantwortlichen'),
          allResp().map(n => h('option', { value: n, selected: o.resp === n }, n))),
        tagBtn(), h('span', { class: 'sp' }), allNone(o.ms, () => visible().map(x => x.id))),
      h('div', { class: 'icsprev' }, vis.length ? vis.map(x => {
        const on = o.ms.has(x.id), first = icsFirst(x);
        return h('div', { class: 'icsm' + (on ? ' on' : ''), dataset: { m: x.id } },
          h('label', { class: 'mchk' }, h('input', { type: 'checkbox', checked: on, onchange: e => { e.target.checked ? o.ms.add(x.id) : o.ms.delete(x.id); draw(); } }),
            h('span', { class: 'dot', style: { background: x.color } }), h('span', { class: 'nm' }, x.m.name || '(ohne Namen)')),
          on ? h('div', { class: 'icschips' },
            o.start.on && first != null ? chip(x.id + ':start', 'k-start', icon('flag'), first, 'Start der Maßnahme') : null,
            o.ab.on ? icsSections(x).map(g => chip(x.id + ':ab:' + g.id, 'k-ab', g.k ? h('span', { class: 'ics-k' }, g.k) : h('span', { class: 'ics-gn' }, g.name), g.n, g.name)) : null) : null);
      }) : h('div', { class: 'muted ics-empty' }, 'keine Maßnahmen'))];
  };
  const taskView = () => {
    const all = icsTasks(o.person, list).filter(t => !o.fut || t.b >= today);
    return [
      h('div', { class: 'ics-opts' }, h('div', { class: 'ics-opt on person' }, icon('user'),
        h('select', { class: 'ics-person', 'aria-label': 'Person', onchange: e => { o.person = e.target.value; draw(); } }, h('option', { value: '' }, 'Person wählen …'),
          persons.map(n => h('option', { value: n, selected: o.person === n }, n))),
        stepper(o.tbuf, v => { o.tbuf = v; }, 'Aufgaben'))),
      all.length ? h('div', { class: 'ics-filter' }, h('span', { class: 'sp' }), allNone(o.tk, () => all.map(t => t.key))) : null,
      h('div', { class: 'icsprev tasks' }, !o.person ? h('div', { class: 'muted ics-empty' }, icon('user'), ' Person wählen')
        : all.length ? all.map(t => {
          const on = o.tk.has(t.key);
          return h('label', { class: 'icst' + (on ? ' on' : ''), dataset: { key: t.key } }, h('input', { type: 'checkbox', checked: on, onchange: e => { e.target.checked ? o.tk.add(t.key) : o.tk.delete(t.key); draw(); } }),
            h('span', { class: 'd', tip: t.pt || t.b === t.a ? fmtW(t.a) : fmtW(t.a) + ' – ' + fmtW(t.b) }, fmtWS(wtBack(t.a, o.tbuf))), h('span', { class: 'ty' }, t.pt ? '◆' : ''),
            h('span', { class: 'nm' }, t.s.name || 'Aufgabe'), h('span', { class: 'ms' }, h('span', { class: 'dot', style: { background: t.x.color } }), t.x.m.name || ''));
        }) : h('div', { class: 'muted ics-empty' }, 'keine Aufgaben für ' + o.person))];
  };
  let drawList = () => {};
  const draw = () => {
    const items = icsCollect(o, list), nMs = items.filter(e => e.kind !== 'task').length, nT = items.length - nMs;
    setKids(wrap,
      h('div', { class: 'ics-top' }, h('span', { class: 'segs ics-tabs' }, tab('ms', 'flag', 'Maßnahmen'), tab('tasks', 'user', 'Aufgaben')), h('span', { class: 'sp' }), alarmCtl(), futPill()),
      body);
    setKids(body, o.tab === 'ms' ? msView(items) : taskView());
    setKids(count, icon('calendar'), h('b', null, String(items.length)), items.length === 1 ? ' Termin' : ' Termine',
      nMs && nT ? h('span', { class: 'muted' }, ' (' + nMs + ' Maßnahmen · ' + nT + ' Aufgaben)') : null);
    wrap.append(count);
    drawList = () => { const q = body.querySelector('.ics-q'), pos = q ? q.selectionStart : 0; draw(); const q2 = body.querySelector('.ics-q'); if (q2) { q2.focus(); q2.setSelectionRange(pos, pos); } };
  };
  draw();
  const ok = await modal('Termine für Outlook', wrap, [['Abbrechen', false], ['Kalenderdatei erstellen', true, 'primary']], { wide: true, cls: 'icsdlg' });
  UI.icsOpts = { tab: o.tab, fut: o.fut, alarm: o.alarm, start: o.start, ab: o.ab, tbuf: o.tbuf, person: o.person, ms: [...o.ms], off: [...o.off].filter(k => ids.has(k.split(':')[0])), tk: [...o.tk].filter(k => ids.has(k.split(':')[0])) }; saveUI();
  if (!ok) return;
  const items = icsCollect(o, list);
  if (!items.length) { toast('Keine Termine ausgewählt.', 'warn'); return; }
  const suffix = items.every(e => e.kind === 'task') ? '_' + fileSafe(o.person) : o.ms.size === 1 && !items.some(e => e.kind === 'task') ? '_' + fileSafe(C.byId.get([...o.ms][0]).m.name) : '';
  download('Jahresplanung_' + y + suffix + '.ics', new Blob([icsFile('Jahresplanung ' + y + suffix.replace(/_/g, ' '), items, o.alarm.on ? o.alarm.t : null)], { type: 'text/calendar' }));
  toast(items.length + ' Termine exportiert', 'ok');
}

