/* ===================================================================== Rundmail, E-Mail-Vorlagen, Kalendereintrag und Fachreferat (ab 0.61)
   Rundmail: Knopf mit drei Umschlägen bei „Zuständig“, beim Fachreferat und bei der Spendenübergabe. Fragt, an wen und welche Art
   (Blanko oder eine Vorlage) und öffnet dann Outlook mit allen Empfängern. Die Vorlagen stehen in der Datei der Bedarfsliste
   (D.settings.vorlagen) und gelten für alle, die mit ihr arbeiten – bearbeiten über das Zahnrad → „E-Mail-Vorlagen …“. */

const ICON_RUND = '<svg viewBox="0 0 24 20" width="19" height="16" aria-hidden="true"><g stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">'
  + [[8, 1.5], [5, 5], [2, 8.5]].map(([x, y]) => `<rect x="${x}" y="${y}" width="14" height="9.5" rx="1.2" style="fill:var(--card)"/><path d="M${x + .4} ${y + .7}l6.6 4.9 6.6-4.9" fill="none"/>`).join('') + '</g></svg>';
const ICON_KAL = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.7" y="2.7" width="12.6" height="11.6" rx="1.5"/><path d="M1.7 6.3h12.6M5 1v3M11 1v3"/></g></svg>';
const rundKnopf = (art, t) => `<button class="k-pliste k-rund" data-act="rundmail" data-v="${art}" title="${esc(t)}" aria-label="${esc(t)}">${ICON_RUND}</button>`;

const VL_FUER = [['ueb', 'Spendenübergabe'], ['zust', 'Zuständige'], ['fach', 'Fachreferat'], ['alle', 'überall']];
// mitgelieferte Vorlagen je Bereich; gelöschte merkt sich D.settings.vorlagenWeg, damit sie nicht wiederkommen
const VL_STD = [
  { id: 'v-ueb', name: 'Absprache für Spendenübergabe', fuer: 'ueb', betreff: 'Spendenübergabe „{bedarf}“ – Absprache',
    text: 'Hallo zusammen,\n\nfür „{bedarf}“ ({gliederung}) planen wir die Spendenübergabe:\n\nWann: {wann}\nWo: {ort}\n\nGespendet haben:\n{spender}\n\nBitte gebt mir kurz Bescheid, wer von euch an der Übergabe teilnimmt.\n\nViele Grüße' },
  { id: 'v-ueb-presse', name: 'Pressetermin zur Spendenübergabe', fuer: 'ueb', betreff: 'Pressetermin: Spendenübergabe „{bedarf}“',
    text: 'Hallo zusammen,\n\nam {wann} findet in {ort} die Spendenübergabe für „{bedarf}“ ({gliederung}) statt.\n\nGespendet haben:\n{spender}\n\nKönnt ihr die Presse einladen bzw. Fotos und einen kurzen Bericht für unsere Kanäle übernehmen? Gebt mir bitte Bescheid, wer von euch dabei ist.\n\nViele Grüße' },
  { id: 'v-z-interview', name: 'Terminvereinbarung zum Interview', fuer: 'zust', betreff: 'Kurzes Gespräch zu „{bedarf}“',
    text: 'Hallo zusammen,\n\nfür die Förderanträge zu „{bedarf}“ möchte ich gern ein kurzes Gespräch (ca. 30 Minuten) mit euch führen: Wofür wird es gebraucht, wer profitiert davon, was ändert sich dadurch? Damit kann ich die Anträge gut begründen.\n\nWann passt es euch in den nächsten zwei Wochen? Gern auch per Teams.\n\nViele Grüße' },
  { id: 'v-z-unterlagen', name: 'Unterlagen anfragen', fuer: 'zust', betreff: 'Unterlagen für „{bedarf}“',
    text: 'Hallo zusammen,\n\nfür die Förderanträge zu „{bedarf}“ fehlen mir noch:\n{fehlt}\n\nKönnt ihr mir das in den nächsten zwei Wochen schicken oder in den Ordner legen?\n{link}\n\nViele Grüße' },
  { id: 'v-z-ueb-frage', name: 'Spendenübergabe: Wann passt es?', fuer: 'zust', betreff: 'Spendenübergabe „{bedarf}“ – Terminfrage',
    text: 'Hallo zusammen,\n\ndie Finanzierung für „{bedarf}“ steht – vielen Dank für eure Unterstützung! Gespendet haben:\n{spender}\n\nFür die Spendenübergabe mit den Förderern suchen wir einen Termin. Nennt mir bitte zwei, drei Termine, die euch passen, und einen geeigneten Ort (z. B. Wache oder Unterkunft).\n\nViele Grüße' },
  { id: 'v-z-ueb-einl', name: 'Einladung zur Spendenübergabe', fuer: 'zust', betreff: 'Einladung: Spendenübergabe „{bedarf}“',
    text: 'Hallo zusammen,\n\nherzliche Einladung zur Spendenübergabe für „{bedarf}“:\n\nWann: {wann}\nWo: {ort}\n\nMit dabei sind:\n{spender}\n\nSchön wäre es, wenn einige von euch in Dienstkleidung dabei sind – für die Fotos. Gebt mir bitte kurz Bescheid, wer kommt.\n\nViele Grüße' },
  { id: 'v-f-freigabe', name: 'Abfrage der Freigabe', fuer: 'fach', betreff: 'Bitte um Freigabe: „{bedarf}“ ({gliederung})',
    text: 'Hallo zusammen,\n\nfür „{bedarf}“ ({gliederung}, rund {summe}) bitten wir um die Freigabe durch das Fachreferat {fachreferat}.\n\nKurz zum Bedarf:\n{beschreibung}\n\nAnsprechperson vor Ort: {ansprechperson}\nUnterlagen: {link}\n\nGebt mir bitte bis Ende nächster Woche Rückmeldung, ob ihr den Bedarf befürwortet.\n\nViele Grüße' },
  { id: 'v-f-zusage', name: 'Info: Finanzierung steht', fuer: 'fach', betreff: 'Finanzierung steht: „{bedarf}“ ({gliederung})',
    text: 'Hallo zusammen,\n\nzur Info: Die Finanzierung für „{bedarf}“ ({gliederung}) steht. Gespendet haben:\n{spender}\n\nDie Spendenübergabe stimmen wir mit der Gliederung ab – wenn ihr dabei sein möchtet, gebt mir kurz Bescheid.\n\nViele Grüße' },
];
const VL_PLATZ = [['bedarf', 'Name des Bedarfs'], ['gliederung', 'Gliederung'], ['summe', 'Summe des Bedarfs'], ['wann', 'Termin der Spendenübergabe mit Uhrzeit'], ['ort', 'Ort der Spendenübergabe'],
  ['spender', 'Förderer mit Zusage und Betrag, je Zeile einer'], ['ansprechperson', 'Ansprechperson des Bedarfs'], ['fachreferat', 'Fachreferat'], ['link', 'Link zum Ordner'], ['beschreibung', 'Beschreibung des Bedarfs'], ['fehlt', 'Unterlagen, die noch fehlen, je Zeile eine']];
const vorlagen = () => { const S = D.settings, eig = Array.isArray(S.vorlagen) ? S.vorlagen : [], weg = new Set(S.vorlagenWeg || []);
  return [...eig, ...VL_STD.filter(v => !weg.has(v.id) && !eig.some(e => e.id === v.id))]; };   // neue mitgelieferte kommen dazu
const WTAG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
function vlWerte(b) {
  const u = b.nach.ueb, Z = b.foerderer.filter(f => f.status === 'zugesagt' && f.name.trim()), mit = Z.filter(f => u.mit.includes(f.id));
  const wann = validIso(u.termin) ? WTAG[new Date(u.termin + 'T12:00').getDay()] + ', ' + fmtDate(u.termin) + (u.zeit ? ', ' + u.zeit + ' Uhr' : '') : 'noch offen';
  return { bedarf: b.titel || 'Bedarf', gliederung: b.gliederung === DIO ? 'Diözese' : b.gliederung || '', summe: b.summe ? eur(b.summe) : '', wann, ort: u.ort.trim() || 'noch offen',
    spender: (mit.length ? mit : Z).map(f => '- ' + f.name.trim() + (foeAmt(f) ? ': ' + eur(foeAmt(f)) : '')).join('\n') || '- (noch keine Zusage eingetragen)',
    ansprechperson: (b.zust[0] && b.zust[0].n) || '', fachreferat: b.freigabe.fach.name.trim(), link: okLink(b.link) ? b.link.trim() : '',
    beschreibung: String(b.beschreibung || '').replace(/\*\*|__|~~/g, '').replace(/^\s*[*•]\s+/gm, '- ').trim() || '(noch keine Beschreibung)',
    fehlt: b.unterlagen.filter(u => u.st === 'fehlt' || u.st === 'arbeit').map(u => '- ' + u.name).join('\n') || '- (alles da)' };
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
async function rundmail(b, art, wahl = '') {
  closeMenus();
  const G = rundGruppen(b), presseAn = new Set(presseWahl(b).map(p => kkey(p.n)));
  const vor = { zust: ['zust'], fach: ['fach'], ueb: ['zust', 'presse'] }[art] || ['zust'];
  const an = new Set();
  G.forEach(([g, , L]) => L.forEach(p => { if (p.mail && vor.includes(g) && (g !== 'presse' || presseAn.has(kkey(p.n)))) an.add(g + '|' + kkey(p.n)); }));
  const V = vorlagen().filter(v => v.fuer === art || v.fuer === 'alle'), W = vlWerte(b);
  if (!V.some(v => v.id === wahl)) wahl = '';
  let zu = null;
  const zahl = h('span');
  const zaehl = () => { const M = new Set(G.flatMap(([g, , L]) => L.filter(p => an.has(g + '|' + kkey(p.n))).map(p => p.mail.trim().toLowerCase()))); zahl.textContent = M.size ? 'E-Mail an ' + M.size + ' öffnen' : 'E-Mail öffnen'; };
  // je Vorlage eine Kachel (zwei je Reihe): Klick wählt, Doppelklick öffnet gleich die E-Mail, Stift bearbeitet die Vorlage
  const kacheln = h('div', { class: 'rm-kacheln' });
  const zeigK = () => kacheln.replaceChildren(...[['', 'Blanko', 'nur Empfänger und Betreff']].concat(V.map(v => [v.id, v.name, vlFuellen(v.betreff, W)])).map(([id, t, x]) =>
    h('div', { class: 'rm-k' + (id === wahl ? ' on' : ''), role: 'radio', tabindex: 0, 'aria-checked': String(id === wahl), title: id ? 'Doppelklick: gleich die E-Mail öffnen' : '',
      onclick: () => { wahl = id; zeigK(); }, ondblclick: () => { wahl = id; zu && zu(true); }, onkeydown: e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); wahl = id; zeigK(); } } },
      h('b', null, t), h('span', { class: 'rm-ks' }, x),
      id ? h('button', { type: 'button', class: 'rm-pen', title: 'Vorlage bearbeiten', 'aria-label': 'Vorlage bearbeiten', html: ICON_PEN, onclick: e => { e.stopPropagation(); zu && zu({ edit: id }); } }) : null))
    .concat(h('button', { type: 'button', class: 'rm-k rm-neu', onclick: () => zu && zu('neu') }, h('span', { class: 'rm-plus', 'aria-hidden': 'true' }, '+'), 'Neue Vorlage')));
  const emp = h('div', { class: 'rm-emp' }, G.map(([g, t, L]) => h('div', { class: 'rm-g' }, h('div', { class: 'rm-gt' }, t),
    L.map(p => { const k = g + '|' + kkey(p.n);
      return h('label', { class: 'check rm-p' + (p.mail ? '' : ' ohne'), title: p.mail || 'keine E-Mail-Adresse eingetragen' }, h('input', { type: 'checkbox', checked: an.has(k), disabled: !p.mail,
        onchange: e => { if (e.target.checked) an.add(k); else an.delete(k); zaehl(); } }), ' ' + (p.n || p.mail), h('span', { class: 'muted small' }, p.mail ? '' : ' · ohne E-Mail')); }))));
  zeigK(); zaehl();
  const v = await modal('Rundmail', h('div', { class: 'help rm' }, h('h4', null, 'Worum geht es?'), kacheln,
    h('h4', null, 'An'), G.length ? emp : h('p', { class: 'muted' }, 'Noch niemand mit E-Mail-Adresse – erst Personen eintragen.')),
    [['Abbrechen', false], [zahl, true, 'primary']], { wide: true, expose: c => { zu = c; } });
  if (v === 'neu') { if (await vorlagenDialog({ neu: art })) rundmail(b, art, (vorlagen().filter(x => x.fuer === art).pop() || {}).id); return; }
  if (v && v.edit) { await vorlagenDialog({ id: v.edit }); rundmail(b, art, v.edit); return; }
  if (!v) return;
  const M = uniq(G.flatMap(([g, , L]) => L.filter(p => p.mail && an.has(g + '|' + kkey(p.n))).map(p => p.mail.trim())));
  if (!M.length) { toast('Niemand mit E-Mail-Adresse angehakt.', 'warn'); return; }
  const vl = V.find(x => x.id === wahl);
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
  if (o.id) i = Math.max(0, L.findIndex(v => v.id === o.id));
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
  D.settings.vorlagen = L.map(v => Object.assign(v, { name: v.name.trim() || 'Vorlage' })); D.settings.vorlagenWeg = VL_STD.map(v => v.id).filter(id => !L.some(v => v.id === id)); changed(); toast('Vorlagen gespeichert', 'ok');
  return true;
}

/* ---------- Fachreferat beim Bedarf: alle Personen mit diesem Fachreferat, ohne die ausgeblendeten (fach.aus), dazu weitere aus der Personenliste (fach.dazu).
   Hauptansprechperson: je Bedarf (fach.stern), sonst die des Fachreferats (D.settings.fachHaupt, einmal gefragt) */
const FACH_HAUPT_STD = { notfallvorsorge: 'Thorsten Heß' };          // vom Fundraising genannt – gilt, bis jemand anderes gewählt ist
// fach.pers: Personen, die beim Bedarf feststehen (mit ihren Angaben – über den Stift änderbar); dazu kommen die übrigen des Fachreferats aus der
// Personenliste, außer den ausgeblendeten (fach.aus). Fehlende Angaben ergänzt die Personenliste.
const fachKopie = p => Object.assign(leerZ(), { n: p.n || '', rolle: p.rolle || '', mail: p.mail || '', tel: p.tel || '', mobil: p.mobil || '' });
function fachZeig(b) {
  const f = b.freigabe.fach, name = f.name.trim(), L = fachPersonen(name);
  if (f.fuer && f.fuer !== norm(name)) { f.aus = []; f.pers = []; f.dazu = []; f.fuer = ''; }   // anderes Fachreferat eingetragen: die Auswahl galt dem alten
  if (Array.isArray(f.wahl) && f.wahl.length && L.length) { f.aus = L.map(p => kkey(p.n)).filter(k => !f.wahl.includes(k)); }   // Auswahl bis 0.60 → ausgeblendete
  delete f.wahl;
  if (Array.isArray(f.dazu) && f.dazu.length) { f.pers = [...(f.pers || []), ...f.dazu.map(k => PR.list.find(p => kkey(p.n) === k)).filter(Boolean).map(fachKopie)]; f.dazu = []; }   // 0.61 → 0.62
  const aus = new Set(f.aus || []), P = (f.pers || []).filter(c => !kontaktLeer(c)), pk = new Map(P.map(c => [kkey(c.n), c]));
  const voll = c => { const p = person(c.n); return p ? Object.assign({}, c, ...['rolle', 'mail', 'tel', 'mobil'].map(k => (c[k] || '').trim() ? {} : { [k]: p[k] || '' })) : c; };
  const Z = [...L.filter(p => !aus.has(kkey(p.n))).map(p => pk.has(kkey(p.n)) ? voll(pk.get(kkey(p.n))) : p), ...P.filter(c => !L.some(p => kkey(p.n) === kkey(c.n))).map(voll)];
  return { name, L, Z, weg: L.filter(p => aus.has(kkey(p.n)) && !pk.has(kkey(p.n))).length };
}
// alle, die gerade beim Fachreferat stehen, als feste Personen übernehmen (vor dem Bearbeiten und nach der Auswahl)
function fachFest(b, Z) {
  const f = b.freigabe.fach, { name, L } = fachZeig(b);
  f.pers = Z.map(fachKopie); f.aus = L.map(p => kkey(p.n)).filter(k => !f.pers.some(c => kkey(c.n) === k)); f.fuer = norm(name);
}
let FSNAP = '[]';
// Stift: die Personen beim Fachreferat direkt bearbeiten (wie bei „Zuständig“); „Fertig“ fragt, ob Neues in die Personenliste soll
function fachBearbeiten(b, neu) {
  if (UI.fEdit !== b.id) { fachFest(b, fachZeig(b).Z); FSNAP = JSON.stringify(b.freigabe.fach.pers); }
  if (neu) b.freigabe.fach.pers.push(leerZ());
  changed(); UI.fEdit = b.id; keep(renderNow);
  const E = $$('#fach-pers .k-ed'), e = neu ? E[E.length - 1] : E[0], inp = e && e.querySelector('input'); if (inp) inp.focus();
}
function fachFertig(b) {
  const f = b.freigabe.fach, name = f.name.trim(), L = fachPersonen(name);
  f.pers = (f.pers || []).filter(c => !kontaktLeer(c)); f.aus = L.map(p => kkey(p.n)).filter(k => !f.pers.some(c => kkey(c.n) === k)); f.fuer = norm(name);
  const vor = JSON.parse(FSNAP || '[]').map(c => JSON.stringify(c)); FSNAP = '[]';
  const N = f.pers.filter(c => !vor.includes(JSON.stringify(c))).map(c => person(c.n) ? c : Object.assign({}, c, { fach: name }));   // Neue gehören zum Fachreferat
  if (N.length) setTimeout(() => wennFrei(() => personenBestaetigen(N, '')), 0);
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
  const liste = h('div', { class: 'ps-liste fd-liste' });
  const text = p => norm([p.n, p.rolle, p.gl, p.fach, p.mail].filter(Boolean).join(' '));
  let q = [];
  const zeig = () => {
    const S = q.length ? PR.list.filter(p => q.every(w => text(p).includes(w))).slice(0, 60) : [...L, ...Z.filter(p => !imF.has(kkey(p.n)))];   // Z: auch von Hand Eingetragene
    liste.replaceChildren(...(S.length ? S.map(p => { const k = kkey(p.n);
      return h('label', { class: 'ps-z' }, h('input', { type: 'checkbox', checked: an.has(k), onchange: e => { if (e.target.checked) an.add(k); else an.delete(k); } }),
        h('span', { class: 'ps-n' }, p.n, h('span', { class: 'muted small' }, ' · ' + (imF.has(k) ? name : p.fach || p.gl || 'Personenliste')))); })   // nur der Name, dahinter das Fachreferat
      : [h('p', { class: 'muted small' }, q.length ? 'Niemand gefunden.' : 'Noch niemand im Fachreferat – oben suchen und dazunehmen.')]));
  };
  const such = h('input', { type: 'search', class: 'ps-such', placeholder: 'Weitere Person suchen: Name, Position, Gliederung …', oninput: e => { q = norm(e.target.value).split(/\s+/).filter(Boolean); zeig(); } });
  zeig();
  const ok = await modal('Fachreferat ' + name, h('div', { class: 'help ps' }, h('div', { class: 'row ps-kopf' }, such), liste),
    [['Neue Person eintragen …', 'neu', 'link ps-neu'], ['Abbrechen', false], ['Übernehmen', true, 'primary']], { expose: () => setTimeout(() => such.focus(), 80) });
  if (ok === 'neu') { fachBearbeiten(b, true); return; }                    // nicht in der Personenliste: von Hand eintragen
  if (!ok) return;
  const nach = [...Z.filter(p => an.has(kkey(p.n))), ...PR.list.filter(p => an.has(kkey(p.n)) && !Z.some(z => kkey(z.n) === kkey(p.n)))];
  fachFest(b, nach); changed(); swap('fach-pers', fachBlock(b), true);
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
