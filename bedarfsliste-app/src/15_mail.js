/* ===================================================================== Rundmail, E-Mail-Vorlagen, Kalendereintrag und Fachreferat (ab 0.61)
   Rundmail: Knopf mit drei Umschlägen bei „Zuständig“, beim Fachreferat und bei der Spendenübergabe. Fragt, an wen und welche Art
   (Blanko oder eine Vorlage) und öffnet dann Outlook mit allen Empfängern. Die Vorlagen stehen in der Datei der Bedarfsliste
   (D.settings.vorlagen) und gelten für alle, die mit ihr arbeiten – bearbeiten über das Zahnrad → „E-Mail-Vorlagen …“. */

const ICON_RUND = '<svg viewBox="0 0 24 20" width="19" height="16" aria-hidden="true"><g stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">'
  + [[8, 1.5], [5, 5], [2, 8.5]].map(([x, y]) => `<rect x="${x}" y="${y}" width="14" height="9.5" rx="1.2" style="fill:var(--card)"/><path d="M${x + .4} ${y + .7}l6.6 4.9 6.6-4.9" fill="none"/>`).join('') + '</g></svg>';
const ICON_KAL = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.7" y="2.7" width="12.6" height="11.6" rx="1.5"/><path d="M1.7 6.3h12.6M5 1v3M11 1v3"/></g></svg>';
const rundKnopf = (art, t) => `<button class="k-pliste k-rund" data-act="rundmail" data-v="${art}" title="${esc(t)}" aria-label="${esc(t)}">${ICON_RUND}</button>`;

const VL_FUER = [['ueb', 'Spendenübergabe'], ['zust', 'Zuständige'], ['fach', 'Fachreferat'], ['alle', 'überall']];
const VL_STD = [{ id: 'v-ueb', name: 'Absprache für Spendenübergabe', fuer: 'ueb', betreff: 'Spendenübergabe „{bedarf}“ – Absprache',
  text: 'Hallo zusammen,\n\nfür „{bedarf}“ ({gliederung}) planen wir die Spendenübergabe:\n\nWann: {wann}\nWo: {ort}\n\nGespendet haben:\n{spender}\n\nBitte gebt mir kurz Bescheid, wer von euch an der Übergabe teilnimmt.\n\nViele Grüße' }];
const VL_PLATZ = [['bedarf', 'Name des Bedarfs'], ['gliederung', 'Gliederung'], ['summe', 'Summe des Bedarfs'], ['wann', 'Termin der Spendenübergabe mit Uhrzeit'], ['ort', 'Ort der Spendenübergabe'],
  ['spender', 'Förderer mit Zusage und Betrag, je Zeile einer'], ['ansprechperson', 'Ansprechperson des Bedarfs'], ['fachreferat', 'Fachreferat'], ['link', 'Link zum Ordner']];
const vorlagen = () => Array.isArray(D.settings.vorlagen) ? D.settings.vorlagen : VL_STD;
const WTAG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
function vlWerte(b) {
  const u = b.nach.ueb, Z = b.foerderer.filter(f => f.status === 'zugesagt' && f.name.trim()), mit = Z.filter(f => u.mit.includes(f.id));
  const wann = validIso(u.termin) ? WTAG[new Date(u.termin + 'T12:00').getDay()] + ', ' + fmtDate(u.termin) + (u.zeit ? ', ' + u.zeit + ' Uhr' : '') : 'noch offen';
  return { bedarf: b.titel || 'Bedarf', gliederung: b.gliederung === DIO ? 'Diözese' : b.gliederung || '', summe: b.summe ? eur(b.summe) : '', wann, ort: u.ort.trim() || 'noch offen',
    spender: (mit.length ? mit : Z).map(f => '- ' + f.name.trim() + (foeAmt(f) ? ': ' + eur(foeAmt(f)) : '')).join('\n') || '- (noch keine Zusage eingetragen)',
    ansprechperson: (b.zust[0] && b.zust[0].n) || '', fachreferat: b.freigabe.fach.name.trim(), link: okLink(b.link) ? b.link.trim() : '' };
}
const vlFuellen = (t, W) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => W[k] != null ? W[k] : m).replace(/\u00a0/g, ' ');

/* ---------- Presse und Öffentlichkeit: Personen mit diesem Fachreferat in der Personenliste; bei der Spendenübergabe anklickbar, anfangs alle gewählt */
const PRESSE_RE = /presse|öffentlichkeit|oeffentlichkeit|kommunikation/;
const pressePersonen = () => PR.list.filter(p => PRESSE_RE.test(norm(p.fach)));
const presseWahl = b => { const aus = new Set(b.nach.ueb.presseAus || []); return pressePersonen().filter(p => !aus.has(kkey(p.n))); };
function presseBlock(b) {
  const L = pressePersonen(), aus = new Set(b.nach.ueb.presseAus || []);
  if (!L.length) return '<p class="muted small">Noch niemand mit dem Fachreferat „Presse und Öffentlichkeit“ in der Personenliste – dort in der Spalte „Fachreferat“ eintragen.</p>';
  return `<div class="presse">${L.map(p => { const k = kkey(p.n), on = !aus.has(k);
    return `<button type="button" class="k1 fach-w${on ? ' on' : ''}" data-act="presse-wahl" data-k="${esc(k)}" aria-pressed="${on}" title="${on ? 'Bekommt die Rundmail – klicken: nicht' : 'Klicken: bekommt die Rundmail'}"><span class="fw-h" aria-hidden="true">${on ? '✓' : ''}</span><div class="kn">${esc(p.n)}</div>${p.rolle ? `<div class="kr">${esc(p.rolle)}</div>` : ''}</button>`; }).join('')}</div>`;
}

/* ---------- Kalendereintrag für Outlook (.ics): Doppelklick auf die Datei trägt den Termin ein (1 Stunde; ohne Uhrzeit ganztägig) */
const icsText = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFalten = z => { const out = []; let s = z; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); };
const icsZeit = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
function icsBlob(b) {
  const u = b.nach.ueb, W = vlWerte(b), tag = u.termin.replace(/-/g, ''), m = /^(\d{1,2}):(\d{2})/.exec(u.zeit || '');
  const st = m ? new Date(u.termin + 'T' + m[1].padStart(2, '0') + ':' + m[2] + ':00') : null, jetzt = new Date();
  const ende = st ? new Date(st.getTime() + 36e5) : null, morgen = new Date(u.termin + 'T12:00'); morgen.setDate(morgen.getDate() + 1);
  const beschr = ['Spendenübergabe für „' + W.bedarf + '“' + (W.gliederung ? ' (' + W.gliederung + ')' : ''), '', 'Gespendet haben:', W.spender,
    W.ansprechperson ? '\nAnsprechperson: ' + W.ansprechperson : '', u.info.trim() ? '\n' + u.info.trim() : ''].join('\n');
  const Z = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Malteser Dioezese Paderborn//Bedarfsliste//DE', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    'UID:' + b.id + '-uebergabe@bedarfsliste', 'DTSTAMP:' + jetzt.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
    st ? 'DTSTART:' + icsZeit(st) : 'DTSTART;VALUE=DATE:' + tag, st ? 'DTEND:' + icsZeit(ende) : 'DTEND;VALUE=DATE:' + icsZeit(morgen).slice(0, 8),
    'SUMMARY:' + icsText('Spendenübergabe: ' + W.bedarf), u.ort.trim() ? 'LOCATION:' + icsText(u.ort.trim()) : null, 'DESCRIPTION:' + icsText(beschr),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Spendenübergabe', 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean);
  return new Blob([Z.map(icsFalten).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
}
function icsLaden(b) {
  if (!validIso(b.nach.ueb.termin)) { toast('Erst den Termin der Spendenübergabe eintragen.', 'warn'); return; }
  download('Spendenübergabe ' + dateiName(b.titel || 'Bedarf') + '.ics', icsBlob(b));
  if (!DEMO) toast('Kalendereintrag heruntergeladen – Datei öffnen, dann trägt Outlook den Termin ein.', 'ok');
}
const dateiName = s => String(s).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

/* ---------- Rundmail: Empfänger nach Gruppen (angehakt je nach Knopf), Art: Blanko oder Vorlage → Outlook */
function rundGruppen(b) {
  const G = [['zust', 'Zuständig', b.zust.filter(z => z.n.trim() || z.mail.trim())], ['fach', 'Fachreferat' + (b.freigabe.fach.name.trim() ? ' ' + b.freigabe.fach.name.trim() : ''), fachZeig(b).Z],
    ['presse', 'Presse und Öffentlichkeit', pressePersonen()]];
  return G.filter(g => g[2].length);
}
async function rundmail(b, art) {
  closeMenus();
  const G = rundGruppen(b), presseAn = new Set(presseWahl(b).map(p => kkey(p.n)));
  const vor = { zust: ['zust'], fach: ['fach'], ueb: ['zust', 'presse'] }[art] || ['zust'];
  const an = new Set();
  G.forEach(([g, , L]) => L.forEach(p => { if (p.mail && vor.includes(g) && (g !== 'presse' || presseAn.has(kkey(p.n)))) an.add(g + '|' + kkey(p.n)); }));
  const V = vorlagen().filter(v => v.fuer === art || v.fuer === 'alle');
  let wahl = '';
  const zahl = h('span');
  const zaehl = () => { const M = new Set(G.flatMap(([g, , L]) => L.filter(p => an.has(g + '|' + kkey(p.n))).map(p => p.mail.trim().toLowerCase()))); zahl.textContent = M.size ? 'E-Mail an ' + M.size + ' öffnen' : 'E-Mail öffnen'; };
  const emp = h('div', { class: 'rm-emp' }, G.map(([g, t, L]) => h('div', { class: 'rm-g' }, h('div', { class: 'rm-gt' }, t),
    L.map(p => { const k = g + '|' + kkey(p.n);
      return h('label', { class: 'check rm-p' + (p.mail ? '' : ' ohne'), title: p.mail || 'keine E-Mail-Adresse eingetragen' }, h('input', { type: 'checkbox', checked: an.has(k), disabled: !p.mail,
        onchange: e => { if (e.target.checked) an.add(k); else an.delete(k); zaehl(); } }), ' ' + (p.n || p.mail), h('span', { class: 'muted small' }, p.mail ? '' : ' · ohne E-Mail')); }))));
  const arten = h('div', { class: 'rm-arten' }, [['', 'Blanko', 'nur die Empfänger, Betreff mit dem Namen des Bedarfs'], ...V.map(v => [v.id, v.name, v.betreff])].map(([id, t, x]) =>
    h('label', { class: 'check rm-a' }, h('input', { type: 'radio', name: 'rm-art', checked: id === wahl, onchange: () => { wahl = id; } }), ' ', h('b', null, t), x ? h('span', { class: 'muted small' }, ' – ' + vlFuellen(x, vlWerte(b))) : null)));
  zaehl();
  const v = await modal('Rundmail', h('div', { class: 'help rm' }, G.length ? null : h('p', { class: 'muted' }, 'Noch niemand mit E-Mail-Adresse – erst Personen eintragen.'),
    h('h4', null, 'An'), emp, h('h4', null, 'Art der E-Mail'), arten),
    [['Neue Vorlage …', 'neu', 'link'], ['Abbrechen', false], [zahl, true, 'primary']], { wide: true });
  if (v === 'neu') { if (await vorlagenDialog({ neu: art })) rundmail(b, art); return; }
  if (!v) return;
  const M = uniq(G.flatMap(([g, , L]) => L.filter(p => p.mail && an.has(g + '|' + kkey(p.n))).map(p => p.mail.trim())));
  if (!M.length) { toast('Niemand mit E-Mail-Adresse angehakt.', 'warn'); return; }
  const vl = V.find(x => x.id === wahl), W = vlWerte(b);
  const betreff = vl ? vlFuellen(vl.betreff, W) : (art === 'ueb' ? 'Spendenübergabe ' : '') + '„' + W.bedarf + '“' + (W.gliederung ? ' (' + W.gliederung + ')' : '');
  // Outlook trennt Empfänger mit „;“ (andere Programme mit „,“ – Outlook ist hier der Standard)
  const url = 'mailto:' + M.map(encodeURIComponent).join(';').replace(/%40/g, '@') + '?subject=' + encodeURIComponent(betreff) + (vl ? '&body=' + encodeURIComponent(vlFuellen(vl.text, W).replace(/\r?\n/g, '\r\n')) : '');
  if (url.length > 1900) toast('Sehr lange E-Mail – falls Outlook sie abschneidet, die Vorlage kürzen.', 'warn');
  const a = h('a', { href: url }); document.body.append(a); a.click(); a.remove();
}

/* ---------- Vorlagen bearbeiten (Zahnrad → „E-Mail-Vorlagen …“): Name, wofür, Betreff, Text mit Platzhaltern in {geschweiften Klammern} */
async function vorlagenDialog(o = {}) {
  closeMenus();
  const L = JSON.parse(JSON.stringify(vorlagen()));
  let i = 0;
  if (o.neu) { L.push({ id: uid('v'), name: 'Neue Vorlage', fuer: o.neu, betreff: '„{bedarf}“', text: 'Hallo zusammen,\n\n\n\nViele Grüße' }); i = L.length - 1; }
  const sel = h('select', { class: 'vl-sel', 'aria-label': 'Vorlage', onchange: e => { i = +e.target.value; zeig(); } });
  const name = h('input', { type: 'text', class: 'vl-name', 'aria-label': 'Name der Vorlage', oninput: e => { L[i].name = e.target.value; liste(); } });
  const fuer = h('select', { 'aria-label': 'Wofür', onchange: e => { L[i].fuer = e.target.value; } }, VL_FUER.map(([v, t]) => h('option', { value: v }, t)));
  const betreff = h('input', { type: 'text', class: 'vl-betreff', 'aria-label': 'Betreff', oninput: e => { L[i].betreff = e.target.value; } });
  const text = h('textarea', { rows: 12, class: 'vl-text', 'aria-label': 'Text', oninput: e => { L[i].text = e.target.value; } });
  let zuletzt = text;
  [betreff, text].forEach(el => el.addEventListener('focus', () => { zuletzt = el; }));
  const platz = h('div', { class: 'vl-platz' }, VL_PLATZ.map(([k, t]) => h('button', { type: 'button', class: 'mini-btn', title: t, onmousedown: e => e.preventDefault(),
    onclick: () => { const el = zuletzt, s = el.selectionStart ?? el.value.length, en = el.selectionEnd ?? s; el.value = el.value.slice(0, s) + '{' + k + '}' + el.value.slice(en); el.selectionStart = el.selectionEnd = s + k.length + 2; el.dispatchEvent(new Event('input')); el.focus(); } }, '{' + k + '}')));
  const leer = h('p', { class: 'muted' }, 'Keine Vorlagen – über „Neue Vorlage“ eine anlegen.'), feld = h('div', { class: 'vl-feld' },
    h('label', null, h('span', { class: 'lab' }, 'Name'), name), h('label', null, h('span', { class: 'lab' }, 'Für'), fuer),
    h('label', { class: 'vl-w' }, h('span', { class: 'lab' }, 'Betreff'), betreff), h('label', { class: 'vl-w' }, h('span', { class: 'lab' }, 'Text'), text),
    h('div', { class: 'vl-w' }, h('span', { class: 'lab' }, 'Platzhalter – anklicken fügt ihn an der Schreibmarke ein'), platz));
  const liste = () => sel.replaceChildren(...L.map((v, j) => h('option', { value: j, selected: j === i }, (v.name || '(ohne Namen)') + ' – ' + (VL_FUER.find(x => x[0] === v.fuer) || VL_FUER[3])[1])));
  const zeig = () => { liste(); leer.hidden = !!L.length; feld.hidden = !L.length; sel.hidden = !L.length; if (!L.length) return;
    const v = L[i]; name.value = v.name; fuer.value = v.fuer; betreff.value = v.betreff; text.value = v.text; };
  const kopf = h('div', { class: 'row vl-kopf' }, sel,
    h('button', { type: 'button', onclick: () => { L.push({ id: uid('v'), name: 'Neue Vorlage', fuer: 'alle', betreff: '„{bedarf}“', text: '' }); i = L.length - 1; zeig(); name.focus(); name.select(); } }, 'Neue Vorlage'),
    h('button', { type: 'button', class: 'link', onclick: () => { if (!L.length) return; L.splice(i, 1); i = Math.max(0, i - 1); zeig(); } }, 'Löschen'),
    h('button', { type: 'button', class: 'link small', title: 'Die mitgelieferte Vorlage „Absprache für Spendenübergabe“ wieder dazunehmen', onclick: () => { for (const s of VL_STD) if (!L.some(v => v.id === s.id)) L.push(Object.assign({}, s)); zeig(); } }, 'Mitgelieferte wieder dazu'));
  zeig();
  const ok = await modal('E-Mail-Vorlagen', h('div', { class: 'help vl' }, h('p', { class: 'muted small' }, 'Für die Rundmail (Knopf mit drei Umschlägen). Gespeichert in der Bedarfsliste – gilt für alle, die mit ihr arbeiten.'), kopf, leer, feld),
    [['Abbrechen', false], ['Speichern', true, 'primary']], { wide: true });
  if (!ok) return false;
  D.settings.vorlagen = L.map(v => Object.assign(v, { name: v.name.trim() || 'Vorlage' })); changed(); toast('Vorlagen gespeichert', 'ok');
  return true;
}

/* ---------- Fachreferat beim Bedarf: alle Personen mit diesem Fachreferat, ohne die ausgeblendeten (fach.aus), dazu weitere aus der Personenliste (fach.dazu).
   Hauptansprechperson: je Bedarf (fach.stern), sonst die des Fachreferats (D.settings.fachHaupt, einmal gefragt) */
const FACH_HAUPT_STD = { notfallvorsorge: 'Thorsten Heß' };          // vom Fundraising genannt – gilt, bis jemand anderes gewählt ist
function fachZeig(b) {
  const f = b.freigabe.fach, name = f.name.trim(), L = fachPersonen(name);
  if (Array.isArray(f.wahl) && f.wahl.length && L.length) { f.aus = L.map(p => kkey(p.n)).filter(k => !f.wahl.includes(k)); delete f.wahl; }   // Auswahl bis 0.60 → ausgeblendete
  const gilt = !f.fuer || f.fuer === norm(name);                    // anderes Fachreferat eingetragen: die Auswahl galt dem alten
  const aus = new Set(gilt ? f.aus || [] : []), drin = L.filter(p => !aus.has(kkey(p.n)));
  const dazu = (gilt ? f.dazu || [] : []).map(k => PR.list.find(p => kkey(p.n) === k)).filter(p => p && !L.includes(p));
  return { name, L, Z: [...drin, ...dazu], weg: L.length - drin.length };
}
// Schlüssel der Standard-Hauptansprechperson; '' = bewusst niemand; undefined = noch nicht gefragt (oder nicht mehr im Fachreferat)
function fachHauptStd(name, L) {
  const k = norm(name), S = D.settings.fachHaupt || {};
  let v = S[k];
  if (v === undefined && FACH_HAUPT_STD[k]) v = kkey(FACH_HAUPT_STD[k]);
  if (v === undefined) return undefined;
  return v && !L.some(p => kkey(p.n) === v) ? (S[k] === undefined ? undefined : '') : v;
}
const fachHauptSetzen = (name, k) => { D.settings.fachHaupt = Object.assign({}, D.settings.fachHaupt, { [norm(name)]: k }); changed(); };
// Stift beim Fachreferat: wer beim Bedarf steht – Haken an/aus, über die Suche weitere Mitarbeiterinnen und Mitarbeiter dazu
async function fachDialog(b) {
  const f = b.freigabe.fach, { name, L, Z } = fachZeig(b), imF = new Set(L.map(p => kkey(p.n))), an = new Set(Z.map(p => kkey(p.n)));
  const liste = h('div', { class: 'ps-liste' }), zahl = h('span', { class: 'muted small' });
  const text = p => norm([p.n, p.rolle, p.gl, p.fach, p.mail].filter(Boolean).join(' '));
  let q = [];
  const zeig = () => {
    const S = q.length ? PR.list.filter(p => q.every(w => text(p).includes(w))).slice(0, 60) : [...L, ...Z.filter(p => !imF.has(kkey(p.n)))];
    liste.replaceChildren(...(S.length ? S.map(p => { const k = kkey(p.n);
      return h('label', { class: 'ps-z' }, h('input', { type: 'checkbox', checked: an.has(k), onchange: e => { if (e.target.checked) an.add(k); else an.delete(k); } }),
        h('span', { class: 'ps-n' }, p.n, imF.has(k) ? h('span', { class: 'muted small' }, ' · im Fachreferat') : null),
        h('span', { class: 'ps-i small muted' }, [p.rolle, p.gl, p.fach && 'Fachreferat ' + p.fach].filter(Boolean).join(' · ')),
        h('span', { class: 'ps-k small muted' }, [p.mail, p.tel || p.mobil].filter(Boolean).join(' · '))); })
      : [h('p', { class: 'muted small' }, q.length ? 'Niemand gefunden.' : 'Noch niemand im Fachreferat – oben suchen und dazunehmen.')]));
    zahl.textContent = q.length ? S.length + (S.length === 60 ? '+' : '') + ' gefunden' : 'Haken: steht beim Bedarf';
  };
  const such = h('input', { type: 'search', class: 'ps-such', placeholder: 'Weitere Person suchen: Name, Position, Gliederung …', oninput: e => { q = norm(e.target.value).split(/\s+/).filter(Boolean); zeig(); } });
  zeig();
  const ok = await modal('Fachreferat ' + name, h('div', { class: 'help ps' }, h('div', { class: 'row ps-kopf' }, such, zahl), liste),
    [['Abbrechen', false], ['Übernehmen', true, 'primary']], { expose: () => setTimeout(() => such.focus(), 80) });
  if (!ok) return;
  f.aus = L.map(p => kkey(p.n)).filter(k => !an.has(k)); f.dazu = [...an].filter(k => !imF.has(k)); f.fuer = norm(name); delete f.wahl;
  changed(); swap('fach-pers', fachBlock(b), true);
}
// Zahnrad → „Hauptansprechpersonen der Fachreferate …“: je Fachreferat die Standard-Hauptansprechperson
async function fachHauptDialog() {
  closeMenus();
  const N = uniq(fachNamen().map(n => n.trim()).filter(n => fachPersonen(n).length)).sort((a, c) => a.localeCompare(c, 'de'));
  const W = {};
  const rows = N.map(n => { const L = fachPersonen(n), v = fachHauptStd(n, L);
    const s = h('select', { onchange: e => { W[norm(n)] = e.target.value; } }, h('option', { value: '' }, '– niemand –'), L.map(p => h('option', { value: kkey(p.n), selected: kkey(p.n) === v }, p.n)));
    return h('tr', null, h('td', null, n), h('td', null, s)); });
  const ok = await modal('Hauptansprechpersonen der Fachreferate', h('div', { class: 'help' },
    h('p', { class: 'muted small' }, 'Steht beim Bedarf mit Stern vorn und gilt für alle Bedarfe mit diesem Fachreferat. Beim einzelnen Bedarf lässt sich über den Stern jede andere wählen.'),
    N.length ? h('table', { class: 'fh-tab' }, rows) : h('p', { class: 'muted' }, 'Noch keine Fachreferate in der Personenliste (Spalte „Fachreferat“).')),
    [['Abbrechen', false], ['Speichern', true, 'primary']]);
  if (!ok || !Object.keys(W).length) return;
  D.settings.fachHaupt = Object.assign({}, D.settings.fachHaupt, W); changed(); keep(renderNow); toast('Hauptansprechpersonen gespeichert', 'ok');
}
