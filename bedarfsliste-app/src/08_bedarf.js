/* ===================================================================== Seite eines Bedarfs: Eckdaten · Freigabe und Unterlagen · Förderplan · Nacharbeit
   Eingabefelder tragen data-p (Pfad im Bedarf), bei Förderern zusätzlich data-fid, bei Unterlagen data-uid.
   Tippen ändert nur die Daten und zeichnet abgeleitete Teile neu (refresh); Knöpfe und Auswahlfelder zeichnen die Seite neu. */

const fld = (lab, inner, cls = '', help = '') => `<div class="fld ${cls}"><span class="lab">${lab}</span>${inner}${help ? `<span class="help">${help}</span>` : ''}</div>`;
const tin = (o, p, x = '', ph = '') => `<input type="text" data-p="${p}" ${x} value="${esc(getPath(o, p) ?? '')}" placeholder="${esc(ph)}">`;
const nin = (o, p, x = '') => `<input type="text" inputmode="decimal" class="num" data-num data-p="${p}" ${x} value="${esc(fmtNum(getPath(o, p)))}" placeholder="0">`;
const din = (o, p, x = '') => `<input type="date" data-p="${p}" ${x} value="${esc(getPath(o, p) || '')}">`;
const tarea = (o, p, x = '', ph = '', rows = 2) => `<textarea data-p="${p}" ${x} rows="${rows}" placeholder="${esc(ph)}">${esc(getPath(o, p) ?? '')}</textarea>`;
const cbx = (o, p, lab, x = '') => `<label class="check"><input type="checkbox" data-p="${p}" ${x} ${getPath(o, p) ? 'checked' : ''}> ${lab}</label>`;
const seg = (opts, cur, attrs, cls = '') => `<div class="seg ${cls}" role="group">` + opts.map(([v, l, tone]) =>
  `<button type="button" class="${v === cur ? 'on ' + (tone || '') : ''}" data-act="set" data-v="${esc(v)}" ${attrs} aria-pressed="${v === cur}">${l}</button>`).join('') + '</div>';
const dl = (id, vals) => `<datalist id="${id}">${uniq(vals).map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
const okLink = s => /^https?:\/\//i.test((s || '').trim());
const linkBtn = b => okLink(b.link) ? `<a class="btn" href="${esc(b.link.trim())}" target="_blank" rel="noopener" data-act="link">Öffnen ↗</a>` : `<span class="btn disabled" aria-disabled="true" title="Erst einen Link einfügen (https://…)">Öffnen ↗</span>`;
const copyBtn = b => `<button data-act="copy-path" ${b.pfad ? '' : 'disabled'}>Kopieren</button>`;
const zustChips = b => b.zust.map((n, i) => `<span class="pchip">${esc(n)}<button class="x" data-act="rm-zust" data-i="${i}" aria-label="${esc(n)} entfernen">×</button></span>`).join('');
const metaLine = b => esc(glName(b)) + (b.stichwort ? ` · <span class="chip sw">${esc(b.stichwort)}</span>` : '') + (b.angelegt ? ` · angelegt ${fmtDate(b.angelegt)}` : '');

function steps(b) {
  const p = phase(b);
  if (p.step < 0) return `<div class="steps"><span class="phase ph-pause">${esc(p.t)}</span></div>`;
  return '<ol class="steps">' + PHASES.map((s, i) => `<li class="${p.step > i || p.step === 3 ? 'done' : p.step === i ? 'cur' : ''}">${s.t}</li>`).join('') + '</ol>';
}
function statusBlock(b) {
  const p = phase(b);
  return (p.step >= 0 ? `<span class="st-main${p.bad ? ' bad' : ''}"><b>${esc(p.t)}</b>${p.sub ? ': ' + esc(p.sub) : ''}</span>` : '<span class="muted">Der Bedarf ruht – oben rechts wieder auf „Bedarf läuft“ stellen.</span>')
    + p.warn.map(w => `<span class="st-warn">⚠ ${esc(w)}</span>`).join('');
}

function bedarfView(b) {
  const nav = [['sec-eck', 'Eckdaten'], ['sec-frei', 'Freigabe und Unterlagen'], ['sec-foe', 'Förderplan'], ['sec-nach', 'Nacharbeit']];
  return `<main class="bedarf">
    <div class="d-top">
      <button class="back" data-act="back">‹ Alle Bedarfe</button>
      <div class="d-head">
        <div class="d-titlewrap"><div class="tline">${prioMark(b)}<h1 id="d-title">${esc(b.titel || 'Neuer Bedarf')}</h1></div><div class="d-meta" id="d-meta">${metaLine(b)}</div></div>
        <div class="d-actions">
          <select data-p="manuell" aria-label="Bedarf läuft, ist zurückgestellt oder verworfen">${[['', 'Bedarf läuft'], ['zurückgestellt', 'zurückgestellt'], ['verworfen', 'verworfen']].map(([v, l]) => `<option value="${v}" ${b.manuell === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          ${b.archiv ? '<button data-act="unarchive">Aus dem Archiv holen</button>' : '<button data-act="archive">Archivieren</button>'}
          ${UI.delAsk ? '<span class="confirm">Wirklich löschen? <button class="dangerfill" data-act="del-ok">Löschen</button><button data-act="del-no">Abbrechen</button></span>' : '<button class="ghost danger" data-act="del">Löschen</button>'}
        </div>
      </div>
      <div class="d-status">
        <div class="d-statusrow"><div id="d-steps">${steps(b)}</div><div id="d-status">${statusBlock(b)}</div></div>
        <nav class="jump" aria-label="Bereiche">${nav.map(([id, l]) => `<button class="link" data-act="jump" data-v="${id}">${l}</button>`).join('')}</nav>
      </div>
    </div>
    ${secEck(b)}${secFrei(b)}${secFoe(b)}${secNach(b)}
  </main>`;
}

/* ---------- Eckdaten */
function secEck(b) {
  return `<section class="card" id="sec-eck">
    <div class="sec-head"><h2>Eckdaten</h2></div>
    <div class="grid g12">
      ${fld('Bedarf', tin(b, 'titel', 'id="f-titel" aria-label="Bedarf"', 'z. B. Mannschaftstransportwagen für den Sanitätsdienst'), 's6')}
      ${fld('Gliederung', tin(b, 'gliederung', 'list="dl-gl" aria-label="Gliederung"', 'Ort, oder „Diözese“'), 's3')}
      ${fld('Priorität', seg(PRIO.map(([v, l]) => [v, l, v === 'hoch' ? 't-err' : v === 'mittel' ? 't-warn' : '']), b.prio, 'data-p="prio"', 'small'), 's3')}
      ${fld('Zuständig', `<div class="chips"><span id="zust-chips">${zustChips(b)}</span><input id="zust-new" class="chip-in" list="dl-zust" placeholder="+ Name, Enter" aria-label="Zuständige Person hinzufügen"></div>`, 's4')}
      ${fld('Summe', `<div class="row">${nin(b, 'summe', 'aria-label="Summe in Euro"')}<span class="unit">€</span>${seg([['Schätzung', 'Schätzung'], ['Angebot', 'laut Angebot']], b.summeArt, 'data-p="summeArt"', 'small')}</div>`, 's3')}
      ${fld('Deadline', din(b, 'deadline', 'aria-label="Deadline"'), 's2', 'Bis wann gedeckt sein muss')}
      ${fld('Stichwort oder Fördertopf', tin(b, 'stichwort', 'list="dl-sw" aria-label="Stichwort oder Fördertopf"', 'z. B. Landesprogramm Digitalisierung'), 's3')}
      ${fld('Beschreibung', tarea(b, 'beschreibung', 'aria-label="Beschreibung" class="desc"', 'Kurzbeschreibung aus der UPL oder in eigenen Worten', 7), 's8')}
      <div class="fld s4 ordner"><span class="lab">Ordner</span>
        <div class="o-row"><span class="o-lab">OneDrive / SharePoint</span><div class="row">${tin(b, 'link', 'class="grow" aria-label="Link zum Ordner"', 'Link einfügen (https://…)')}<span id="link-btn">${linkBtn(b)}</span></div></div>
        <div class="o-row"><span class="o-lab">Pfad im Explorer</span><div class="row">${tin(b, 'pfad', 'class="grow mono" aria-label="Ordnerpfad"', 'C:\\Users\\…\\OneDrive - Malteser\\…')}<span id="copy-btn">${copyBtn(b)}</span></div></div>
        <span class="help">Link: in OneDrive beim Ordner „Link kopieren“. Pfad: im Explorer nach dem Kopieren Strg+L, dann Strg+V – direkt öffnen kann der Browser den Explorer nicht.</span>
      </div>
    </div>
    ${dl('dl-gl', [DIO, ...GL_LIST, ...D.bedarfe.map(x => x.gliederung)])}${dl('dl-sw', D.bedarfe.map(x => x.stichwort))}${dl('dl-zust', D.bedarfe.flatMap(x => x.zust))}
  </section>`;
}

/* ---------- Freigabe und Unterlagen */
function freigabeBody(b) {
  const items = frItems(b);
  const rows = items.map(i => {
    const p = 'freigabe.' + i.k;
    if (i.na) return `<div class="fr-row na"><div class="fr-lab">${i.label}</div><div class="fr-na">${esc(i.na)}${i.k === 'fach' ? ' · <button class="link" data-act="set" data-p="freigabe.trotzdem" data-v="true">trotzdem einbeziehen</button>' : ''}</div></div>`;
    const opts = [['offen', i.offen], ['angefragt', 'angefragt', 't-run'], ['ok', i.ok, 't-ok']];
    if (i.nein) opts.push(['nein', i.nein, 't-err']);
    const since = i.st === 'angefragt' && validIso(i.item.angefragt) ? `<span class="since">seit ${days(i.item.angefragt, today())} Tagen</span>` : '';
    const dates = i.st === 'offen' ? '' : `<label>angefragt ${din(b, p + '.angefragt', 'aria-label="angefragt am"')}</label>${since}`
      + (i.st === 'ok' || i.st === 'nein' ? `<label>${i.st === 'nein' ? 'abgelehnt' : 'erledigt'} ${din(b, p + '.erledigt', 'aria-label="erledigt am"')}</label>` : '');
    return `<div class="fr-row st-${i.st}">
      <div class="fr-lab">${i.label}${i.k === 'ofk' && b.gliederung ? `<div class="sub">${esc(b.gliederung)}</div>` : ''}${i.k === 'fach' ? tin(b, p + '.name', 'list="dl-fach" class="fach" aria-label="Welches Fachreferat"', 'welches?') : ''}</div>
      <div class="fr-seg">${seg(opts, i.st, `data-p="${p}.st"`, 'small')}</div>
      <div class="fr-dates">${dates}</div>
      <div class="fr-note">${tin(b, p + '.notiz', 'aria-label="Notiz"', 'Notiz')}</div>
    </div>`;
  }).join('');
  const fehl = items.filter(i => !i.na && i.st !== 'ok');
  return rows + (fehl.length ? `<div class="fr-foot warn">Es fehlt noch: ${esc(fehl.map(frName).join(', '))}</div>` : '<div class="fr-foot ok">✓ Freigabe vollständig, die Anträge können raus</div>')
    + (b.freigabe.trotzdem && !ab1000(b) ? '<p class="small"><button class="link" data-act="set" data-p="freigabe.trotzdem" data-v="false">Fachreferat und Verwaltung wieder ausblenden (unter 1.000 €)</button></p>' : '')
    + dl('dl-fach', [...FACH_LIST, ...D.bedarfe.map(x => x.freigabe.fach.name)]);
}
function unterlagenBody(b) {
  return b.unterlagen.map(u => `<div class="ul-row"><div class="ul-name">${u.fest ? esc(u.name) : tin(u, 'name', `data-uid="${u.id}" aria-label="Name der Unterlage"`)}</div>
      ${seg([['fehlt', 'fehlt'], ['arbeit', 'in Arbeit', 't-warn'], ['da', 'vorhanden', 't-ok']], u.st, `data-p="st" data-uid="${u.id}"`, 'small')}
      ${u.fest ? '<span></span>' : `<button class="x" data-act="rm-ul" data-uid="${u.id}" aria-label="${esc(u.name)} entfernen">×</button>`}</div>`).join('')
    + `<div class="ul-add"><input type="text" id="ul-new" list="dl-ul" placeholder="Weitere Unterlage, z. B. Bilder" aria-label="Weitere Unterlage"><button data-act="add-ul">+ Unterlage</button></div>`
    + dl('dl-ul', ['Bilder', 'Presseartikel', 'Studien', 'Kostenplan', 'Zeitplan', 'Unterstützerschreiben'].filter(n => !b.unterlagen.some(u => u.name === n)));
}
function secFrei(b) {
  return `<section class="card" id="sec-frei">
    <div class="sec-head"><h2>Freigabe und Unterlagen</h2><p>Ortsführungskreis und Angebot braucht es immer, Fachreferat und Verwaltung ab 1.000 €.</p></div>
    <div class="grid frei"><div><h3>Freigabe</h3><div id="fr-body">${freigabeBody(b)}</div></div><div><h3>Unterlagen</h3><div id="ul-body">${unterlagenBody(b)}</div></div></div>
  </section>`;
}

/* ---------- Förderplan */
const F_ST = [['geplant', 'geplant'], ['vorb', 'in Vorbereitung', 't-warn'], ['beantragt', 'beantragt', 't-run'], ['zugesagt', 'zugesagt', 't-ok'], ['abgelehnt', 'abgelehnt', 't-err']];
const F_ST_L = Object.fromEntries(F_ST.map(([v, l]) => [v, l]));
function karteiBlock(b, f) {
  if (!f.name.trim()) return '';
  const k = kartei(f.name), key = kkey(f.name);
  const other = D.bedarfe.filter(x => x !== b && !x.archiv && x.foerderer.some(g => kkey(g.name) === key && g.status !== 'abgelehnt'));
  const also = other.length ? `<div class="also">Auch im Förderplan von: ${other.map(x => `<button class="link" data-act="open" data-id="${x.id}">${esc(x.titel || '(ohne Namen)')}</button> (${F_ST_L[x.foerderer.find(g => kkey(g.name) === key).status]})`).join(', ')}</div>` : '';
  if (!k) return (KR.list.length ? '<div class="kinfo none">nicht in der Förder-Kartei</div>' : '') + also;
  const hist = Object.entries(k.hist).sort((a, c) => c[0] - a[0]).map(([y, v]) => `${y}: ${esc(v.replace(/\n/g, ', '))}`).join(' · ') || 'noch keine Förderung eingetragen';
  const region = b.gliederung && b.gliederung !== DIO && k.gl.length && !k.gl.some(g => /^alle$/i.test(g)) && !k.gl.includes(b.gliederung) ? `<div class="hint-warn">Laut Kartei zuständig für ${esc(k.gl.join(', '))}</div>` : '';
  const kontakte = k.kontakte.map(c => `<div>${esc(c.n)}${c.nicht ? ' <span class="muted">(nicht direkt anschreiben)</span>' : ''}${c.m ? ' · <span class="sel">' + esc(c.m) + '</span>' : ''}${c.t ? ' · ' + esc(c.t) : ''}</div>`).join('');
  return `<div class="kinfo"><span class="badge k">aus der Kartei · ${esc(k.blatt)}</span>
    <div>${k.weg.length ? 'Antrag ' + esc(k.weg.join(' oder ')) : ''}${k.web ? (k.weg.length ? ' · ' : '') + `<a href="${esc(/^https?:/i.test(k.web) ? k.web : 'https://' + k.web)}" target="_blank" rel="noopener" data-act="link">${esc(k.web.replace(/^https?:\/\//, '').slice(0, 50))}</a>` : ''}${k.notiz ? ' · ' + esc(k.notiz) : ''}</div>
    ${kontakte}${k.schwer ? `<div>Schwerpunkte: ${esc(k.schwer)}</div>` : ''}<div>Bisher: ${hist}</div>${region}</div>${also}`;
}
function geldBlock(f) {
  const a = `data-fid="${f.id}"`;
  if (UI.geld === f.id) return `<div class="geld form"><label>Betrag<span class="row"><input id="geld-betrag" type="text" inputmode="decimal" class="num" value="${esc(fmtNum(f.eingegangen ?? f.zugesagt ?? f.betrag))}"><span class="unit">€</span></span></label>
      <label>eingegangen am<input id="geld-datum" type="date" value="${esc(f.eingangAm || today())}"></label><button class="primary" data-act="geld-ok" ${a}>Bestätigen</button><button data-act="geld-no">Abbrechen</button>
      ${f.eingegangen > 0 ? `<button class="link small" data-act="geld-undo" ${a}>Eingang zurücknehmen</button>` : ''}</div>`;
  if (f.eingegangen > 0) return `<div class="geld ok">✓ ${eur(f.eingegangen)} eingegangen am ${fmtDate(f.eingangAm) || '–'} <button class="link small" data-act="geld" ${a}>ändern</button></div>`;
  return `<div class="geld"><button class="primary" data-act="geld" ${a}>Geldeingang bestätigen</button></div>`;
}
const RES_FIELDS = [['art', 'Art'], ['weg', 'Antragsweg'], ['kontakt', 'Ansprechperson oder Portal'], ['mail', 'E-Mail'], ['tel', 'Telefon'], ['web', 'Website oder Portal-Link'],
  ['fristInfo', 'Weitere Fristen und Termine'], ['hoehe', 'Übliche Fördersumme'], ['eigenInfo', 'Eigenanteil gefordert'], ['quellen', 'Quellen'], ['notiz', 'Notizen']];
function resSummary(f) {
  const parts = [f.art, f.weg, f.kontakt, f.web && f.web.replace(/^https?:\/\//, '').slice(0, 40)].filter(Boolean);
  return parts.length ? esc(parts.join(' · ')) : 'Art, Antragsweg, Kontakt, Quellen …';
}
function foeCard(b, f) {
  const a = `data-fid="${f.id}"`, st = f.status;
  const dates = st === 'geplant' || st === 'vorb'
    ? fld('Antragsfrist', din(f, 'frist', a + ' aria-label="Antragsfrist"'))
    : fld('beantragt am', din(f, 'beantragtAm', a + ' aria-label="beantragt am"'))
      + (st === 'beantragt' ? fld('Antwort erwartet', din(f, 'erwartet', a + ' aria-label="Antwort erwartet"')) : fld(st === 'zugesagt' ? 'zugesagt am' : 'abgelehnt am', din(f, 'entscheidungAm', a + ' aria-label="Entscheidung am"')));
  const open = !!UI.open['res-' + f.id];
  return `<article class="foe st-${st}" id="foe-${f.id}">
    <div class="foe-head">
      <div class="foe-name">${tin(f, 'name', a + ' list="dl-kartei" aria-label="Förderer"', 'Förderer, z. B. Sparkasse …')}</div>
      ${seg(F_ST, st, `data-p="status" ${a}`, 'small')}
      <button class="x" data-act="rm-foe" ${a} title="Förderer entfernen" aria-label="Förderer entfernen">×</button>
    </div>
    <div id="fk-${f.id}">${karteiBlock(b, f)}</div>
    <div class="foe-body">
      <div class="foe-l">
        <div class="kv"><span class="k">Antrag stellt</span>${seg([['ich', 'ich'], ['gl', 'Gliederung selbst']], f.durch, `data-p="durch" ${a}`, 'small')}</div>
        <div class="kv"><span class="k">Einschätzung</span>${seg(EINSCH, f.einsch, `data-p="einsch" ${a}`, 'small')}</div>
        <div class="amounts">
          <label class="amt">${st === 'geplant' || st === 'vorb' ? 'Betrag (geplant)' : 'beantragt'}<span class="row">${nin(f, 'betrag', a + ' aria-label="beantragter Betrag"')}<span class="unit">€</span></span></label>
          ${st === 'zugesagt' ? `<label class="amt">zugesagt<span class="row">${nin(f, 'zugesagt', a + ' aria-label="zugesagter Betrag"')}<span class="unit">€</span></span></label>` : ''}
          ${dates}
        </div>
        ${st === 'zugesagt' ? geldBlock(f) : ''}
      </div>
      <div class="foe-r">
        ${fld('Warum passt das?', tarea(f, 'warum', a + ' aria-label="Warum passt das"', 'Satzungszweck, Förderschwerpunkt, Regionalbezug …'))}
        ${fld('Knackpunkte', tarea(f, 'knackpunkte', a + ' aria-label="Knackpunkte"', 'Wo hakt es? Worauf muss der Antrag den Fokus legen?'))}
      </div>
    </div>
    <div class="res">
      <button class="res-btn" data-act="res" data-v="${f.id}" aria-expanded="${open}"><span class="tw">${open ? '▾' : '▸'}</span>Recherche <span class="muted" id="rs-${f.id}">${resSummary(f)}</span></button>
      ${open ? `<div class="grid res-grid">${RES_FIELDS.map(([k, l]) => fld(l, k === 'quellen' || k === 'notiz' || k === 'fristInfo' ? tarea(f, k, a + ` aria-label="${l}"`) : tin(f, k, a + ` aria-label="${l}"`), k === 'quellen' || k === 'notiz' ? 's2' : '')).join('')}</div>` : ''}
    </div>
  </article>`;
}
function finSummary(b) {
  const F = fin(b), S = F.S;
  if (!S) return '<div class="fin muted">Trag oben in den Eckdaten eine Summe ein, dann rechnet die Liste die Deckung aus.</div>';
  const line = (lab, v, cls = '') => { const gap = S - v; return `<tr class="${cls}"><th>${lab}</th><td class="num">${eur(v)}</td><td class="num">${Math.round(v / S * 100)} %</td>
    <td class="num ${gap > 0 ? 'gap' : gap < 0 ? 'over' : 'okc'}">${gap > 0 ? 'Lücke ' + eur(gap) : gap < 0 ? 'überdeckt um ' + eur(-gap) : 'gedeckt'}</td></tr>`; };
  return `<div class="fin"><div class="fin-l">${finBar(b, true)}<div class="legend">${LEGEND_FIN}</div>
    ${F.mitGe > S ? '<div class="small hint-warn">Geplant ist mehr als der Bedarf. Kommt am Ende mehr Geld zusammen als nötig, fällt das spätestens im Verwendungsnachweis auf.</div>' : ''}</div>
    <table class="fintab"><tbody>
      <tr><th>Bedarf</th><td class="num">${eur(S)}</td><td></td><td></td></tr>
      ${line('Zugesagt und Eigenanteil', F.gedeckt, 'main')}${line('… wenn alles Beantragte kommt', F.mitBe)}${line('… wenn auch alles Geplante kommt', F.mitGe)}
      <tr><th>Eingegangen</th><td class="num">${eur(F.eingegangen)}</td><td></td><td class="num muted">${F.zugesagt > F.eingegangen ? 'noch offen: ' + eur(F.zugesagt - F.eingegangen) : ''}</td></tr>
    </tbody></table></div>`;
}
function secFoe(b) {
  return `<section class="card" id="sec-foe">
    <div class="sec-head"><h2>Förderplan</h2><p>Wer könnte fördern, warum passt es, wie steht es? Die Antragsarbeit selbst bleibt im Explorer.</p>
      <div class="sec-tools"><button data-act="vorlage" title="Excel mit dem Bedarf und dem bisherigen Förderplan – zum Ausfüllen oder als Vorlage für eine KI-Recherche">Excel-Vorlage für die Recherche</button><button data-act="import">Aus Excel übernehmen …</button></div></div>
    <div class="foe-list">${b.foerderer.map(f => foeCard(b, f)).join('') || '<div class="empty">Noch kein Förderer eingetragen. Einzeln mit „+ Förderer“ oder viele auf einmal aus einer ausgefüllten Förderplan-Excel.</div>'}</div>
    <div class="foe-add"><button data-act="add-foe">+ Förderer</button><span class="muted small">${KR.list.length ? 'Namen aus der Förder-Kartei werden beim Tippen vorgeschlagen.' : ''}</span></div>
    <div class="eigen"><span class="lab">Eigenanteil</span>${nin(b, 'eigenanteil', 'aria-label="Eigenanteil in Euro"')}<span class="unit">€</span><span class="muted small">aus Mitteln der Gliederung oder der Diözese</span></div>
    <div id="fin-sum">${finSummary(b)}</div>
    ${dl('dl-kartei', KR.list.map(k => k.name))}
  </section>`;
}

/* ---------- Nacharbeit: Übergabe und Pressemitteilung einmal je Bedarf, Berichte je Förderer */
function nachLine(f, k, lab) {
  const a = `data-fid="${f.id}"`, x = f[k];
  return `<div class="nl ${x.noetig && !x.erledigt ? 'open' : ''}">${cbx(f, k + '.noetig', lab, a)}${x.noetig ? `<label class="inl">Frist ${din(f, k + '.frist', a + ' aria-label="Frist ' + lab + '"')}</label>${cbx(f, k + '.erledigt', 'erledigt', a)}` : '<span class="muted small">nicht nötig</span>'}</div>`;
}
function nachBody(b) {
  const zu = b.foerderer.filter(f => f.status === 'zugesagt'), cand = b.foerderer.filter(f => f.status !== 'abgelehnt' && f.name.trim()), n = b.nach;
  return `<div class="grid two">
    <div><h3>Gemeinsam für den Bedarf</h3>
      <div class="na-block"><div class="na-head">${cbx(b, 'nach.ueb.noetig', 'Spendenübergabe')}${n.ueb.noetig ? seg([['offen', 'offen'], ['terminiert', 'terminiert', 't-run'], ['erledigt', 'erledigt', 't-ok']], n.ueb.st, 'data-p="nach.ueb.st"', 'small') : ''}</div>
        ${n.ueb.noetig ? `<div class="grid2">${fld('Termin', din(b, 'nach.ueb.termin', 'aria-label="Termin der Spendenübergabe"'))}${fld('Ort', tin(b, 'nach.ueb.ort', 'aria-label="Ort der Spendenübergabe"', 'z. B. Wache, Rathaus'))}</div>
          ${fld('Wer ist dabei?', `<div class="mit">${cand.length ? cand.map(f => `<label class="check"><input type="checkbox" data-act="mit" data-fid="${f.id}" ${n.ueb.mit.includes(f.id) ? 'checked' : ''}> ${esc(f.name)} <span class="muted small">${F_ST_L[f.status]}</span></label>`).join('') : '<span class="muted small">Noch keine Förderer im Förderplan</span>'}</div>`)}` : ''}
      </div>
      <div class="na-block"><div class="na-head">${cbx(b, 'nach.pm.noetig', 'Pressemitteilung')}${n.pm.noetig ? seg([['offen', 'offen'], ['arbeit', 'in Arbeit', 't-warn'], ['veroeff', 'veröffentlicht', 't-ok']], n.pm.st, 'data-p="nach.pm.st"', 'small') : ''}</div>
        ${n.pm.noetig && n.pm.st === 'veroeff' ? `<div class="grid2">${fld('veröffentlicht am', din(b, 'nach.pm.datum', 'aria-label="Pressemitteilung veröffentlicht am"'))}</div>` : ''}
      </div>
    </div>
    <div><h3>Je Förderer</h3>
      ${zu.length ? zu.map(f => `<div class="na-block"><div class="na-title">${esc(f.name || '(ohne Namen)')}</div>${nachLine(f, 'sb', 'Sachbericht')}${nachLine(f, 'vn', 'Verwendungsnachweis')}</div>`).join('') : '<div class="empty small">Erscheint, sobald eine Förderung zugesagt ist.</div>'}
    </div>
  </div>`;
}
function secNach(b) {
  return `<section class="card" id="sec-nach"><div class="sec-head"><h2>Nacharbeit</h2><p>Spendenübergabe und Pressemitteilung gibt es einmal für den ganzen Bedarf, Sachbericht und Verwendungsnachweis je Förderer.</p></div>
    <div id="nach-body">${nachBody(b)}</div></section>`;
}
