/* ===================================================================== KI-Knopf in der Liste (links neben „+ Bedarf“, ab 0.64)
   Kacheln mit Aufgaben, für die es einen Prompt gibt. Erste Aufgabe: „Bedarf aus Daten erstellen“ – aus einer E-Mail, einem Interview-Transkript,
   einer Teams-Unterhaltung … entsteht genau ein neuer Bedarf (ohne Spendenübergabe und Nacharbeit).
   Eine Quelle → Copilot: antwortet im Chat mit einem festen Textblock, den man hier einfügt („Einlesen“).
   Mehrere Quellen → Cowork: füllt eine Textdatei im Ordner „Förderrecherche“, die die Liste anlegt; ist sie ausgefüllt, fragt die Liste von selbst.
   Beide Wege nutzen denselben Aufbau (neuLesen). Vor dem Anlegen immer eine Vorschau: was erkannt wurde, was fehlt, was auffällt. Nichts wird ergänzt. */

const KI_LISTE = [{ k: 'neu', t: 'Bedarf aus Daten erstellen', s: 'aus E-Mail, Interview, Teams … – ein Bedarf je Auftrag' }];
const KI_LISTE_ICO = { neu: kiSvg('M7 3h7l4 4v14H7zM14 3v4h4M12.5 11v6M9.5 14h6') };
const NEU_DATEI = 'Neuer Bedarf', NEU_RE = /^Neuer Bedarf.*\.(txt|md)$/i;
const kiListeKnopf = () => `<button class="icon-btn ki-btn ki-liste${EIN.neu ? ' neu' : ''}" data-act="ki-liste" aria-label="Mit Copilot oder Cowork" title="${EIN.neu ? 'Cowork hat einen neuen Bedarf vorbereitet – ansehen' : 'Mit Copilot oder Cowork: Bedarf aus Daten erstellen …'}">${ICON_KI}</button>`;

/* ---------- Aufbau der Antwort – für Copilot im Codeblock, für Cowork als Inhalt der Datei */
const NEU_BLOCK = () => ['#BEDARF', 'Name:', 'Ort:', 'Summe:', 'Summe ist: Schätzung | Angebot', 'Deadline:', 'Prio: hoch | normal', 'Stichworte:', 'Fachreferat:', 'Ordner:',
  '#BESCHREIBUNG', '(der Text)',
  '#FREIGABEN', 'Ortsführungskreis: offen | angefragt am TT.MM.JJJJ | zugestimmt am TT.MM.JJJJ | abgelehnt am TT.MM.JJJJ', 'Fachreferat:', 'Verwaltung:',
  '#UNTERLAGEN', 'Angebot: vorhanden | in Arbeit | fehlt', 'Konzept:', 'Projektsteckbrief:', '(weitere Unterlagen je Zeile „Name: Stand“)',
  '#ZUSTÄNDIGE', 'Name:', 'Position:', 'E-Mail:', 'Telefon:', 'Handy:', '(Leerzeile, dann die nächste Person, wieder mit „Name:“)',
  '#FÖRDERER', 'Name:', 'Stand: geplant | beantragt | zugesagt | abgelehnt', 'Summe:', 'Antragsfrist:', '(nur Förderer, die in den Unterlagen genannt sind; Leerzeile, dann der nächste)',
  '#QUELLEN', '- (je Quelle eine Zeile: Art, Absender oder Titel, Datum)', '#OFFEN', '- (was fehlt, unklar ist oder sich widerspricht)'];
function neuPrompt(wo, datei) {
  const cw = wo === 'cowork', P = rechOrdnerOk() ? rechPfad() : { lokal: '', od: '' }, F = fachNamen().filter(Boolean);
  const L = ['Ich bin Fundraiser beim Malteser Hilfsdienst e. V. in der Diözese Paderborn. Aus den Unterlagen unten soll genau ein neuer Bedarf für meine Bedarfsliste entstehen.', ''];
  L.push('## Unterlagen', cw ? 'Mehrere Quellen (z. B. E-Mails, Interview-Transkripte, Teams-Unterhaltungen, Dateien) – ich nenne sie dir unten oder lege sie dir hin. Lies alle, bevor du schreibst. '
    + 'Widersprechen sie sich, nimm die neueste Angabe und nenne den Widerspruch unter #OFFEN. Kannst du eine Quelle nicht öffnen, sag es mir, statt weiterzumachen.'
    : 'Eine Quelle (z. B. eine E-Mail, ein Interview-Transkript oder eine Teams-Unterhaltung) – ich füge sie unten ein oder hänge sie an. Kannst du sie nicht öffnen, sag es mir.', '');
  L.push('## Aufgabe', 'Entnimm den Unterlagen alles, was die Bedarfsliste braucht, und gib es im Aufbau unten aus:',
    '- Name: kurz und sprechend, was angeschafft oder umgesetzt wird (z. B. „Defibrillator für den Sanitätsdienst“), ohne Ort.',
    '- Ort: die Malteser-Gliederung (z. B. Brakel, Gütersloh, Hagen) oder „Diözese“ bei Projekten der Diözese.',
    '- Summe: nur, wenn ein Betrag genannt ist (Zahl in Euro); „Summe ist: Angebot“ nur, wenn ein Angebot vorliegt, sonst „Schätzung“.',
    '- Deadline: nur, wenn ein Termin genannt ist, bis zu dem das Geld da sein muss. Prio „hoch“ nur, wenn es ausdrücklich dringend oder vorrangig ist.',
    '- Fachreferat: das zuständige Fachreferat der Diözese' + (F.length ? ' – eines von: ' + F.join(', ') : '') + '; nur, wenn es aus den Unterlagen hervorgeht.',
    '- Beschreibung: ' + KI_BESCHR,
    '- Freigaben (Ortsführungskreis, Fachreferat, Verwaltung), Unterlagen, Zuständige mit Kontaktdaten und Förderer: nur, was in den Unterlagen steht.', '');
  L.push('## Regeln', '- Nichts erfinden, nichts schätzen, nichts ergänzen. Was nicht in den Unterlagen steht, bleibt leer (Feldname stehen lassen, nichts dahinter) und kommt unter #OFFEN.',
    '- Personen: nur dienstliche Angaben aus den Unterlagen; Telefonnummern mit Vorwahl.', '- Datum als TT.MM.JJJJ, Beträge als Zahl in Euro.',
    '- Bei Feldern mit Auswahl („a | b | c“) genau einen Wert schreiben.', '- ' + KI_FORMAT, '- Überschriften (#…) und Feldnamen genau so lassen, keine Tabellen.', '');
  if (cw) {
    const wo2 = P.od ? 'in meinem OneDrive unter „' + P.od + '“' : 'im Unterordner „' + RECH_DIR + '“ neben der Bedarfsliste in meinem OneDrive';
    L.push('## Ergebnis', 'Schreib das Ergebnis in die Datei „' + datei + '“ ' + wo2 + (P.lokal ? ' (auf dem PC: ' + P.lokal + ')' : '') + '. Sie enthält den Aufbau schon – '
      + 'fülle ihn aus und speichere sie unter demselben Namen am selben Ort, als reinen Text (UTF-8). Lege keine andere Datei an.',
      'Zum Schluss im Chat zwei, drei Sätze: was du gefunden hast und was offen blieb.', '', 'Aufbau (so steht er in der Datei):', ...NEU_BLOCK());
  } else {
    L.push('## Ausgabe', 'Schreib zuerst kurz, was du gefunden hast und was offen blieb. Gib danach das Ergebnis in genau einem Codeblock aus, genau in diesem Aufbau – '
      + 'ich übernehme ihn automatisch:', '```text', ...NEU_BLOCK(), '```');
  }
  return L.join('\n');
}
// Inhalt der Datei für Cowork: kurze Anleitung oben, dann der Aufbau mit leeren Feldern
const neuDateiText = datei => ['Neuer Bedarf für die Bedarfsliste – von Cowork auszufüllen („' + datei + '“). Aufbau und Feldnamen nicht ändern; was nicht in den Unterlagen steht, bleibt leer.', '',
  ...NEU_BLOCK().map(z => z.replace(/^(Summe ist|Prio|Ortsführungskreis|Angebot|Stand):.*$/, '$1:'))].join('\r\n');

/* ---------- Lesen: Copilot-Text oder Datei → Rohdaten. Verträgt Fettschrift, Aufzählungszeichen, Codeblöcke, nicht ausgefüllte Platzhalter */
const NEU_SEK = [[/^bedarf$/, 'b'], [/^beschreibung$/, 'text'], [/^freigaben?$/, 'fr'], [/^unterlagen$/, 'ul'], [/^(zuständige|zustaendige|zuständig|ansprechpersonen?|kontakte)$/, 'z'],
  [/^(förderer|foerderer|förderplan)$/, 'f'], [/^quellen?$/, 'q'], [/^(offen|offene punkte|fehlt)$/, 'o']];
const NEU_FELD = { name: 'name', bedarf: 'name', titel: 'name', ort: 'ort', gliederung: 'ort', summe: 'summe', betrag: 'summe', 'summe ist': 'art', art: 'art', deadline: 'deadline', frist: 'deadline',
  prio: 'prio', priorität: 'prio', stichworte: 'sw', stichwort: 'sw', fachreferat: 'fach', ordner: 'ordner', link: 'ordner',
  position: 'rolle', funktion: 'rolle', 'e-mail': 'mail', email: 'mail', mail: 'mail', telefon: 'tel', tel: 'tel', handy: 'mobil', mobil: 'mobil',
  stand: 'stand', status: 'stand', antragsfrist: 'frist' };
const neuWert = v => { const t = ohnePlatzhalter(String(v || '').replace(/^\s*[„"]|[“"]\s*$/g, '').trim()); return /\s\|\s/.test(t) || /^\(.*\)$/.test(t) || /^(…|\.\.\.|TT\.MM\.JJJJ)$/i.test(t) ? '' : t; };
function neuLesen(t) {
  const r = { f: {}, text: [], fr: {}, ul: [], z: [], foe: [], q: [], o: [] };
  let sek = '', cur = null;
  for (const z0 of String(t || '').replace(/^﻿/, '').replace(/\r/g, '').split('\n')) {
    if (/^\s*```/.test(z0)) continue;
    const z1 = kiMd(z0), z = z1.replace(/\*/g, '').replace(/^\s*[-•]\s+(?=[^:]{1,40}:)/, '');
    const hd = z0.replace(/\*/g, '').match(/^\s*#+\s*([^#]+?)\s*#*\s*$/), sk = hd && NEU_SEK.find(([re]) => re.test(norm(hd[1])));
    if (sk) { sek = sk[1]; cur = null; continue; }
    if (sek === 'text') { r.text.push(z1.trimEnd()); continue; }
    if (sek === 'q' || sek === 'o') { const v = neuWert(z.replace(/^\s*[-•]\s*/, '')); if (v) r[sek].push(v); continue; }
    const m = z.match(/^\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .\-]{0,40}?)\s*:\s*(.*)$/); if (!m || !sek) continue;
    const lab = norm(m[1]), v = neuWert(m[2]);
    if (sek === 'b') { const k = NEU_FELD[lab]; if (k && v && !r.f[k]) r.f[k] = v; }
    else if (sek === 'fr') { const k = /^(ortsführungskreis|ofk|ortsfuehrungskreis)/.test(lab) ? 'ofk' : /^fach/.test(lab) ? 'fach' : /^verw/.test(lab) ? 'verw' : ''; if (k && v) r.fr[k] = v; }
    else if (sek === 'ul') { if (v) r.ul.push([m[1].trim(), v]); }
    else if (sek === 'z' || sek === 'f') { const k = NEU_FELD[lab]; if (k === 'name') { cur = { name: v }; r[sek === 'z' ? 'z' : 'foe'].push(cur); } else if (k && cur && v) cur[k] = v; }
  }
  r.text = r.text.join('\n').replace(/^\s*\(der Text\)\s*$/m, '').trim();
  r.z = r.z.filter(p => p.name); r.foe = r.foe.filter(p => p.name);
  return r;
}

/* ---------- Rohdaten → neuer Bedarf, mit Hinweisen (warn: auffällig, leer: nicht gefunden) */
const FR_WORT = [[/abgelehnt|nein|abgesagt/, 'nein'], [/zugestimmt|freigegeben|genehmigt|zugesagt|\bok\b|\bja\b|erteilt/, 'ok'], [/angefragt|beantragt|vorgelegt|läuft/, 'angefragt'], [/offen|noch nicht/, 'offen']];
const UL_WORT = [[/fehlt|nicht vorhanden|liegt nicht vor/, 'fehlt'], [/arbeit|kommt|angefragt|wird erstellt/, 'arbeit'], [/nicht nötig|entfällt/, 'nn'], [/vorhanden|liegt vor|\bda\b|ja/, 'da']];
const FOE_WORT = [[/abgelehnt|absage/, 'abgelehnt'], [/zugesagt|bewilligt|zusage/, 'zugesagt'], [/beantragt|gestellt|eingereicht/, 'beantragt'], [/geplant|angedacht|vorgesehen/, 'geplant']];
const wortSt = (L, v) => (L.find(([re]) => re.test(norm(v))) || [])[1] || '';
function neuOrt(v) {
  const n = norm(v); if (!n) return '';
  if (/^(diözese|dioezese)( paderborn)?$/.test(n) || /^diözesan/.test(n)) return DIO;
  return GL_LIST.find(g => norm(g) === n) || GL_LIST.slice().sort((a, c) => c.length - a.length).find(g => n.includes(norm(g))) || D.bedarfe.map(x => x.gliederung).find(g => g && norm(g) === n) || '';
}
function neuBauen(r) {
  const b = blank(), f = r.f, warn = [], leer = [];
  b.titel = f.name || ''; if (!b.titel) leer.push('Name');
  const ort = neuOrt(f.ort); b.gliederung = ort || f.ort || ''; if (!f.ort) leer.push('Ort'); else if (!ort) warn.push('Ort „' + f.ort + '“ ist keine bekannte Gliederung – bitte prüfen.');
  if (f.summe) { const x = deNum(String(f.summe).replace(/€|euro|eur\b|ca\.?|rund|etwa|brutto|netto/gi, '').trim()); if (typeof x === 'number' && x > 0) b.summe = x; else warn.push('Summe „' + f.summe + '“ ist keine Zahl – nicht übernommen.'); } else leer.push('Summe');
  b.summeArt = /angebot/i.test(f.art || '') ? 'Angebot' : 'Schätzung';
  if (f.deadline) { const d = anyDate(f.deadline); if (d) b.deadline = d; else warn.push('Deadline „' + f.deadline + '“ ist kein Datum – nicht übernommen.'); }
  if (/hoch|dringend|ja\b|vorrang/i.test(f.prio || '')) b.prio = 'hoch';
  if (f.sw) b.stichworte = uniq(f.sw.split(/\s*[,;]\s*/).map(s => s.trim()).filter(Boolean));
  if (f.fach) { const fn = fachNamen().find(n => norm(n) === norm(f.fach)); b.freigabe.fach.name = fn || f.fach; if (!fn) warn.push('Fachreferat „' + f.fach + '“ kennt die Personenliste nicht – bitte prüfen.'); }
  if (f.ordner) { const l = ordnerLink(f.ordner); if (l) { b.link = l.link; b.pfad = l.pfad; } else warn.push('Ordner „' + f.ordner + '“ ist weder Link noch Pfad im SharePoint-Ordner – nicht übernommen.'); }
  b.beschreibung = r.text; if (!r.text) leer.push('Beschreibung');
  for (const k of ['ofk', 'fach', 'verw']) { const v = r.fr[k]; if (!v) continue; const st = wortSt(FR_WORT, v), d = anyDate((v.match(/\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2}/) || [''])[0]) || '';
    if (!st) { warn.push('Freigabe ' + FR_NAME[k] + ' „' + v + '“ nicht verstanden.'); continue; }
    const x = b.freigabe[k]; x.st = st; if (st === 'angefragt') x.angefragt = d; else if (st !== 'offen') { x.erledigt = d; x.angefragt = x.angefragt || ''; } }
  for (const [n, v] of r.ul) { const st = wortSt(UL_WORT, v); if (!st) continue; const u = b.unterlagen.find(x => norm(x.name) === norm(n)); if (u) u.st = st; else b.unterlagen.push(UL(n, st)); }
  const Z = new Map();
  for (const p of r.z) { const k = kkey(p.name); if (Z.has(k)) continue; Z.set(k, Object.assign(leerZ(), { n: p.name, rolle: p.rolle || '', mail: mailText(p.mail || ''), tel: telText(p.tel || ''), mobil: telText(p.mobil || '') })); }
  b.zust = [...Z.values()].slice(0, MAX_ZUST); if (!b.zust.length) leer.push('Zuständige');
  b.foerderer = r.foe.map(p => { const x = typeof deNum(String(p.summe || '').replace(/€|euro|eur\b/gi, '')) === 'number' ? deNum(String(p.summe).replace(/€|euro|eur\b/gi, '')) : null;
    const st = wortSt(FOE_WORT, p.stand || '') || 'geplant';
    return ff(Object.assign({ name: p.name, status: st, frist: anyDate(p.frist || '') || '' }, st === 'zugesagt' ? { betrag: x, zugesagt: x } : { betrag: x })); });
  // schon da? gleicher Name, oder gleicher Ort und ein gemeinsames Wort im Namen
  const W = new Set(norm(b.titel).split(/[^a-zäöüß0-9]+/).filter(w => w.length >= 4));
  const aehnlich = D.bedarfe.filter(x => x.titel && (norm(x.titel) === norm(b.titel) || (b.gliederung && x.gliederung === b.gliederung && norm(x.titel).split(/[^a-zäöüß0-9]+/).some(w => W.has(w)))));
  for (const x of aehnlich.slice(0, 3)) warn.push('Ähnlicher Bedarf schon vorhanden: „' + x.titel + '“' + (x.gliederung ? ' (' + (x.gliederung === DIO ? 'Diözese' : x.gliederung) + ')' : '') + (x.archiv ? ' im Archiv' : '') + '.');
  return { b, warn, leer };
}
const FR_NAME = { ofk: 'Ortsführungskreis', fach: 'Fachreferat', verw: 'Verwaltung' };

/* ---------- Vorschau: erst ansehen, dann anlegen */
const neuLeer = r => !r.f.name && !r.text && !r.z.length;
const neuKeinBlock = () => toast('Kein Bedarf gefunden – den Block ab „#BEDARF“ einfügen (in Copilot beim Codeblock auf „Kopieren“ klicken).', 'warn');
// Vorschau zum Bearbeiten: Angabe anklicken → Feld (Enter oder Klick daneben übernimmt, Esc verwirft); Listen (Stichworte, Personen …) mit × zum Entfernen.
// Die offenen Punkte und Quellen der KI lassen sich unter die Beschreibung setzen, sonst wären sie nach dem Anlegen weg.
async function neuVorschau(text, quelle) {
  const r = neuLesen(text);
  if (neuLeer(r)) { neuKeinBlock(); return false; }
  const { b, warn, leer } = neuBauen(r);
  const frDa = new Set(['ofk', 'fach', 'verw'].filter(k => r.fr[k])), ulDa = new Set(r.ul.map(([n]) => norm(n)));
  const name = h('input', { type: 'text', class: 'nv-name', value: b.titel, placeholder: 'Name des Bedarfs', 'aria-label': 'Name des Bedarfs' });
  const dl = h('dl', { class: 'nv-dl' });
  const chip = (t, weg) => h('span', { class: 'pchip' }, t, h('button', { type: 'button', class: 'x', title: 'entfernen', 'aria-label': t + ' entfernen', onclick: e => { e.stopPropagation(); weg(); zeig(); } }, '×'));
  let edit = '';
  // Textangabe: zeigen oder (angeklickt) als Feld; set liefert false, wenn der Wert nicht passt
  const feld = (k, lab, zeigen, roh, set, o = {}) => {
    if (edit === k) {
      const inp = h(o.lang ? 'textarea' : 'input', Object.assign({ class: 'nv-in', 'aria-label': lab, placeholder: o.ph || '' }, o.lang ? { rows: 8 } : { type: 'text' }));
      inp.value = roh(); let fertig = false;
      const los = ok => { if (fertig) return; fertig = true; if (ok && set(inp.value.trim()) === false) toast(lab + ': „' + inp.value.trim() + '“ passt nicht – nicht übernommen.', 'warn'); edit = ''; zeig(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); los(false); } else if (e.key === 'Enter' && (!o.lang || e.ctrlKey)) { e.preventDefault(); los(true); } });
      inp.addEventListener('blur', () => los(true));
      setTimeout(() => { inp.focus(); if (!o.lang) inp.select(); }, 0);
      return [h('dt', null, lab), h('dd', null, inp, o.lang ? h('div', { class: 'muted small' }, 'Strg+Enter oder Klick daneben übernimmt, Esc verwirft') : null)];
    }
    const v = zeigen();
    return [h('dt', null, lab), h('dd', { class: 'nv-e' + (v ? '' : ' leer') + (o.lang ? ' nv-lang' : ''), tabindex: 0, title: 'Klicken zum Ändern', onclick: () => { edit = k; zeig(); },
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); edit = k; zeig(); } } }, v || 'nicht gefunden – klicken zum Eintragen')];
  };
  const liste = (lab, L) => [h('dt', null, lab), h('dd', { class: L.length ? 'nv-chips' : 'leer' }, L.length ? L : 'nicht gefunden')];
  const FR_T = { ok: 'zugestimmt', angefragt: 'angefragt', nein: 'abgelehnt', offen: 'offen' };
  const zeig = () => dl.replaceChildren(
    ...feld('ort', 'Ort', () => b.gliederung === DIO ? 'Diözese' : b.gliederung, () => b.gliederung === DIO ? 'Diözese' : b.gliederung, v => { b.gliederung = neuOrt(v) || v; }, { ph: 'Gliederung oder „Diözese“' }),
    ...feld('summe', 'Summe', () => b.summe ? eur(b.summe) + ' (' + b.summeArt + ')' : '', () => b.summe ? fmtNum(b.summe) : '', v => { if (!v) { b.summe = null; return; } const x = deNum(v.replace(/€/g, '')); if (typeof x !== 'number') return false; b.summe = x; }, { ph: 'Betrag in Euro' }),
    ...feld('dl', 'Deadline', () => fmtDate(b.deadline), () => fmtDate(b.deadline), v => { if (!v) { b.deadline = ''; return; } const d = anyDate(v); if (!d) return false; b.deadline = d; }, { ph: 'TT.MM.JJJJ' }),
    h('dt', null, 'Prio'), h('dd', null, h('button', { type: 'button', class: 'nv-prio' + (b.prio === 'hoch' ? ' on' : ''), title: 'Klicken: Prio an / aus', onclick: () => { b.prio = b.prio === 'hoch' ? 'mittel' : 'hoch'; zeig(); } }, b.prio === 'hoch' ? '★ hoch' : '☆ keine Prio')),
    ...liste('Stichworte', [...b.stichworte.map((t, i) => chip(t, () => b.stichworte.splice(i, 1))), h('input', { type: 'text', class: 'nv-sw', placeholder: '+ Stichwort', 'aria-label': 'Stichwort hinzufügen',
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value.trim(); if (v && !b.stichworte.some(x => norm(x) === norm(v))) b.stichworte.push(v); zeig(); const n = dl.querySelector('.nv-sw'); if (n) n.focus(); } } })]),
    ...feld('fach', 'Fachreferat', () => b.freigabe.fach.name, () => b.freigabe.fach.name, v => { b.freigabe.fach.name = fachNamen().find(n => norm(n) === norm(v)) || v; }),
    ...feld('ordner', 'Ordner', () => b.link, () => b.pfad || b.link, v => { if (!v) { b.link = ''; b.pfad = ''; return; } const l = ordnerLink(v); if (!l) return false; b.link = l.link; b.pfad = l.pfad; }, { ph: 'SharePoint-Link oder Pfad aus dem Explorer' }),
    ...liste('Freigaben', ['ofk', 'fach', 'verw'].filter(k => frDa.has(k)).map(k => { const x = b.freigabe[k];
      return chip(FR_NAME[k] + ': ' + FR_T[x.st] + (x.erledigt || x.angefragt ? ' am ' + fmtDate(x.erledigt || x.angefragt) : ''), () => { Object.assign(x, { st: 'offen', angefragt: '', erledigt: '' }); frDa.delete(k); }); })),
    ...liste('Unterlagen', b.unterlagen.filter(u => ulDa.has(norm(u.name))).map(u => chip(u.name + ': ' + ulText(u), () => { ulDa.delete(norm(u.name)); if (u.fest) u.st = 'fehlt'; else b.unterlagen.splice(b.unterlagen.indexOf(u), 1); }))),
    ...liste('Zuständige', b.zust.map((z, i) => chip([z.n, z.rolle, z.mail].filter(Boolean).join(', '), () => b.zust.splice(i, 1)))),
    ...liste('Förderer', b.foerderer.map((x, i) => chip(x.name + ' (' + F_ST_L[x.status] + (foeAmt(x) ? ', ' + eur(foeAmt(x)) : '') + ')', () => b.foerderer.splice(i, 1)))),
    ...feld('text', 'Beschreibung', () => b.beschreibung, () => b.beschreibung, v => { b.beschreibung = v; }, { lang: true }));
  zeig();
  const mitOffen = h('input', { type: 'checkbox', checked: r.o.length > 0 }), mitQ = h('input', { type: 'checkbox', checked: r.q.length > 0 });
  const body = h('div', { class: 'help nv' },
    h('p', { class: 'muted small' }, 'Aus ' + quelle + '. Übernommen wird nur, was dort steht. Angaben anklicken zum Ändern, × entfernt.'),
    warn.length ? h('div', { class: 'nv-warn' }, h('b', null, 'Bitte prüfen'), h('ul', null, warn.map(t => h('li', null, t)))) : null,
    h('label', { class: 'nv-l' }, 'Name', name), dl,
    r.o.length ? h('div', { class: 'nv-offen' }, h('b', null, 'Laut KI offen'), h('ul', null, r.o.map(t => h('li', null, t))),
      h('label', { class: 'check nv-mit' }, mitOffen, ' Unter die Beschreibung setzen (sonst ist es nach dem Anlegen weg)')) : null,
    r.q.length ? h('div', { class: 'nv-q' }, h('span', { class: 'muted small' }, h('b', null, 'Quellen: '), r.q.join(' · ')), h('label', { class: 'check nv-mit' }, mitQ, ' Unter die Beschreibung setzen')) : null);
  const ok = await modal('Neuen Bedarf anlegen?', body, [['Abbrechen', false], ['Bedarf anlegen', true, 'primary']], { wide: true, expose: () => setTimeout(() => { name.focus(); name.select(); }, 80) });
  if (!ok) return false;
  b.titel = name.value.trim() || b.titel || 'Neuer Bedarf';
  const anh = [r.o.length && mitOffen.checked ? '*Offen laut KI:*\n' + r.o.map(t => '- ' + t).join('\n') : '', r.q.length && mitQ.checked ? '*Quellen:*\n' + r.q.map(t => '- ' + t).join('\n') : ''].filter(Boolean);
  if (anh.length) b.beschreibung = [b.beschreibung.trim(), ...anh].filter(Boolean).join('\n\n');
  D.bedarfe.unshift(b); UI.tab = 'aktiv'; changed(); heuteDazu(b.id);
  oeffnen(b.id);
  const fehlt = leer.filter(x => !(x === 'Summe' && b.summe) && !(x === 'Ort' && b.gliederung) && !(x === 'Beschreibung' && b.beschreibung) && !(x === 'Zuständige' && b.zust.length) && !(x === 'Name' && b.titel));
  toast('„' + b.titel + '“ angelegt' + (fehlt.length ? ' – nicht gefunden: ' + fehlt.join(', ') : '') + '.', 'ok');
  if (b.zust.length) setTimeout(() => wennFrei(() => personenBestaetigen(b.zust, b.gliederung)), 400);
  return true;
}

/* ---------- Datei für Cowork: anlegen, beobachten, einlesen. Übernommene Stände merkt sich die Bedarfsliste (D.settings.eingangFertig) */
const EIN = { neu: false };
const einKey = f => f.name + '|' + f.lastModified;
const einFertig = () => Array.isArray(D.settings.eingangFertig) ? D.settings.eingangFertig : [];
const einGemeldet = () => { try { return JSON.parse(localStorage.getItem('bl-eingang') || '[]'); } catch (e) { return []; } };
function einMerk(f, wo) {
  if (wo === 'fertig') { D.settings.eingangFertig = [...einFertig(), einKey(f)].slice(-100); changed(); }
  else try { localStorage.setItem('bl-eingang', JSON.stringify([...einGemeldet(), einKey(f)].slice(-100))); } catch (e) { /* nur diese Sitzung */ }
}
async function neuDateiAnlegen() {
  const n = NEU_DATEI + '_' + today().split('-').reverse().join('.') + '_' + Math.random().toString(36).slice(2, 6) + '.txt', text = '﻿' + neuDateiText(n);
  const d = await rechDir(true);
  if (d) try { const fh = await d.getFileHandle(n, { create: true }), w = await fh.createWritable(); await w.write(text); await w.close(); return { n, im: true }; } catch (e) { console.warn(e); }
  if (!DEMO) download(n, new Blob([text], { type: 'text/plain;charset=utf-8' }));
  return { n, im: false };
}
// ausgefüllte, noch nicht übernommene Dateien im Ordner „Förderrecherche“ (neueste zuerst)
async function einDateien() {
  const d = await rechDir(); if (!d) return [];
  const L = [], fertig = new Set(einFertig());
  for await (const [n, e] of d.entries()) {
    if (e.kind !== 'file' || !NEU_RE.test(n)) continue;
    const f = await e.getFile(); if (fertig.has(einKey(f))) continue;
    const t = await f.text(), r = neuLesen(t); if (r.f.name || r.text) L.push({ f, t, r });
  }
  return L.sort((x, y) => y.f.lastModified - x.f.lastModified);
}
let EIN_SCAN = false;
async function eingangScan() {
  if (EIN_SCAN || DEMO || !rechOrdnerOk() || $('.modal') || beschaeftigt()) return;
  EIN_SCAN = true;
  try {
    const L = await einDateien(), neu = L.length > 0;
    if (EIN.neu !== neu) { EIN.neu = neu; safeRender(); }
    const x = L.find(y => !einGemeldet().includes(einKey(y.f))); if (!x || $('.modal')) return;
    einMerk(x.f, 'gemeldet');
    const ja = await modal('Neuer Bedarf von Cowork', h('div', { class: 'help ki-meldung' }, h('span', { class: 'ki-meldung-ico', html: ICON_KI }),
      h('div', null, h('p', null, 'Cowork hat einen neuen Bedarf vorbereitet: ', h('b', null, '„' + (x.r.f.name || 'ohne Namen') + '“'), ' (' + x.f.name + ', ' + lmText(x.f) + ' Uhr).'),
        h('p', { class: 'muted' }, 'Jetzt ansehen und anlegen? Du siehst vorher, was erkannt wurde.'))), [['Später', false], ['Ansehen …', true, 'primary']]);
    if (ja) await einUebernehmen(x);
  } catch (e) { console.warn(e); } finally { EIN_SCAN = false; }
}
async function einUebernehmen(x) {
  if (await neuVorschau(x.t, 'der Datei „' + x.f.name + '“ von Cowork')) { einMerk(x.f, 'fertig'); EIN.neu = (await einDateien()).length > 0; safeRender(); }
}

/* ---------- Dialog: Kacheln → Aufgabe mit Copilot oder Cowork */
async function kiListeDialog() {
  closeMenus();
  let close = null, k = '', wo = 'copilot', antwort = '', datei = null, kopiert = null, promptAuf = false;
  const root = h('div', { class: 'ki' }), setze = (...L) => root.replaceChildren(...L.filter(Boolean)), btn = (t, cls, fn, x) => h('button', Object.assign({ type: 'button', class: cls || '', onclick: fn }, x || {}), t);
  const kopiere = text => new Promise(res => { try { navigator.clipboard.writeText(text).then(() => res(true), () => res(false)); } catch (e) { res(false); } });
  const offen = rechOrdnerOk() ? await einDateien() : [];
  const zeichne = () => {
    if (!k) {
      setze(
        offen.length ? h('div', { class: 'd-flag ki-flag' }, h('span', { class: 'ki-ico-s', html: ICON_KI }), 'Cowork hat einen neuen Bedarf vorbereitet: „' + (offen[0].r.f.name || 'ohne Namen') + '“.',
          btn('Ansehen …', 'primary', () => { close(null); einUebernehmen(offen[0]); })) : null,
        h('div', { class: 'ki-kacheln' }, KI_LISTE.map(x => h('button', { type: 'button', class: 'ki-k', 'data-k': x.k, onclick: () => { k = x.k; zeichne(); } },
          h('span', { class: 'ki-k-top' }, h('span', { class: 'ki-ico', html: KI_LISTE_ICO[x.k] }), h('b', null, x.t)), h('small', null, x.s)))),
        h('p', { class: 'muted small' }, 'Weitere Aufgaben folgen.'));
      return;
    }
    const cw = wo === 'cowork', P = neuPrompt(wo, datei ? datei.n : NEU_DATEI + '_….txt');
    const seg = h('div', { class: 'seg small ki-wo', role: 'group', 'aria-label': 'Wer macht es?' }, [['copilot', 'Copilot'], ['cowork', 'Cowork']].map(([v, l]) =>
      btn(l, v === wo ? 'on' : '', () => { wo = v; kopiert = null; zeichne(); }, { title: v === 'cowork' ? 'Mehrere Quellen: Cowork liest alle und füllt eine Datei, die Liste meldet sich von selbst' : 'Eine Quelle: Copilot antwortet im Chat, den Textblock hier einfügen' })));
    const kop = async () => {
      if (cw && !datei) datei = await neuDateiAnlegen();
      kopiert = await kopiere(neuPrompt(wo, datei ? datei.n : ''));
      if (!kopiert) promptAuf = true;
      zeichne();
    };
    setze(
      h('div', { class: 'ki-kopf2' }, btn('‹ Aufgaben', 'link small', () => { k = ''; zeichne(); }), h('b', null, 'Bedarf aus Daten erstellen')),
      h('div', { class: 'ki-fuss' }, seg, h('span', { class: 'muted small' }, 'Eine Quelle: Copilot · mehrere Quellen: Cowork')),
      h('ol', { class: 'ki-schritte small' }, cw
        ? [h('li', null, '„Auftrag kopieren“ legt die Datei ', h('b', null, datei ? datei.n : 'Neuer Bedarf_….txt'), ' im Ordner „' + RECH_DIR + '“ an und kopiert den Prompt.'),
          h('li', null, 'In Cowork einfügen und die Quellen nennen oder anhängen.'), h('li', null, 'Ist die Datei ausgefüllt, fragt die Liste von selbst, ob der Bedarf angelegt werden soll – oder hier auf „Einlesen“.')]
        : [h('li', null, 'Prompt kopieren und in Copilot einfügen; die Quelle (E-Mail, Transkript, Teams …) dazu einfügen oder anhängen.'), h('li', null, 'Den Textblock am Ende seiner Antwort kopieren und unten einfügen.'), h('li', null, '„Einlesen …“ zeigt, was erkannt wurde, dann „Bedarf anlegen“.')]),
      kopiert === true ? h('div', { class: 'ki-ok' }, h('b', null, '✓ Prompt kopiert'), cw ? (datei && datei.im ? ' – in Cowork einfügen.' : ' – die Datei liegt in „Downloads“: in den Ordner „' + RECH_DIR + '“ neben der Bedarfsliste legen.') : ' – in Copilot einfügen.') : null,
      promptAuf ? h('div', { class: 'ki-prompt' }, h('textarea', { class: 'rech-prompt', rows: 9, spellcheck: false, 'aria-label': 'Prompt', value: P })) : null,
      cw ? null : h('div', { class: 'ki-antwort' }, h('b', null, 'Antwort von Copilot'),
        h('textarea', { rows: 6, placeholder: '#BEDARF\nName: …', 'aria-label': 'Antwort von Copilot', value: antwort, oninput: e => { antwort = e.target.value; } })),
      h('div', { class: 'ki-fuss' }, btn(promptAuf ? 'Prompt ausblenden' : 'Prompt ansehen', 'link small', () => { promptAuf = !promptAuf; zeichne(); }), h('span', { class: 'ki-sp' }),
        btn(cw ? 'Auftrag kopieren' : 'Prompt kopieren', kopiert === true ? '' : 'primary', kop),
        btn('Einlesen …', kopiert === true ? 'primary' : '', async () => {
          if (!cw) { if (!antwort.trim()) { toast('Erst die Antwort von Copilot einfügen.', 'warn'); return; } if (neuLeer(neuLesen(antwort))) { neuKeinBlock(); return; } close(null); neuVorschau(antwort, 'der Antwort von Copilot'); return; }
          if (DEMO) { toast('In der Vorschau lassen sich keine Dateien einlesen. In der Programmdatei geht das.', 'warn'); return; }
          const L = rechOrdnerOk() ? await einDateien() : [], x = (datei && L.find(y => y.f.name === datei.n)) || L[0];
          if (x) { close(null); einUebernehmen(x); return; }
          const f = await pickFile('.txt,.md'); if (!f) return;
          close(null); const t = await f.text(); if (await neuVorschau(t, 'der Datei „' + f.name + '“')) einMerk(f, 'fertig');
        })));
  };
  zeichne();
  await modal('Mit Copilot oder Cowork', root, [], { wide: true, expose: c => { close = c; } });
}
