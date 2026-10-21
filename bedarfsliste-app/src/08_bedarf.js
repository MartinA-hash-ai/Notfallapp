/* ===================================================================== Seite eines Bedarfs: Eckdaten · Freigabe und Unterlagen · Förderplan · Nacharbeit
   Eingabefelder tragen data-p (Pfad im Bedarf), bei Förderern zusätzlich data-fid, bei Unterlagen data-uid.
   Tippen ändert nur die Daten und zeichnet abgeleitete Teile neu (refresh); Knöpfe und Auswahlfelder zeichnen die Seite neu. */

const fld = (lab, inner, cls = '', info = '') => `<div class="fld ${cls}"><span class="lab">${lab}${info ? ' ' + infoBtn(info) : ''}</span>${inner}</div>`;
const tin = (o, p, x = '', ph = '') => `<input type="text" data-p="${p}" ${x} value="${esc(getPath(o, p) ?? '')}" placeholder="${esc(ph)}">`;
const nin = (o, p, x = '') => `<input type="text" inputmode="decimal" class="num" data-num data-p="${p}" ${x} value="${esc(fmtNum(getPath(o, p)))}" placeholder="0">`;
const din = (o, p, x = '') => `<input type="date" data-p="${p}" ${x} value="${esc(getPath(o, p) || '')}">`;
const tarea = (o, p, x = '', ph = '', rows = 2) => `<textarea data-p="${p}" ${x} rows="${rows}" placeholder="${esc(ph)}">${esc(getPath(o, p) ?? '')}</textarea>`;
const cbx = (o, p, lab, x = '') => `<label class="check"><input type="checkbox" data-p="${p}" ${x} ${getPath(o, p) ? 'checked' : ''}> ${lab}</label>`;
const seg = (opts, cur, attrs, cls = '') => `<div class="seg ${cls}" role="group">` + opts.map(([v, l, tone]) =>
  `<button type="button" class="${v === cur ? 'on ' + (tone || '') : ''}" data-act="set" data-v="${esc(v)}" ${attrs} aria-pressed="${v === cur}">${l}</button>`).join('') + '</div>';
const dl = (id, vals) => `<datalist id="${id}">${uniq(vals).map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
const INFO = {
  ordner: 'Link: in OneDrive beim Ordner „Link kopieren“ wählen und hier einfügen – „Öffnen“ zeigt den Ordner im Browser, Word-Dateien gehen von dort in der Desktop-App auf. Pfad: aus der Adresszeile des Explorers kopieren. „Kopieren“ legt ihn in die Zwischenablage, im Explorer dann Strg+L und Strg+V. Direkt öffnen kann der Browser den Explorer nicht.',
  deadline: 'Bis wann der Bedarf gedeckt sein muss. Ohne Deadline steht in der Liste ein Strich.',
  stichwort: 'Bedarfe mit demselben Stichwort – zum Beispiel einem Fördertopf – lassen sich in der Liste zusammen filtern.',
  recherche: 'Die Excel enthält den Bedarf (Beschreibung, Summe, Gliederung) und den bisherigen Förderplan. Im Blatt „Anleitung“ steht, was in jede Spalte gehört – so kann eine KI sie direkt als Vorlage für die Förderrecherche nehmen. Die ausgefüllte Datei hier wieder übernehmen: neue Förderer kommen dazu, vorhandene werden ergänzt.',
  freigabe: 'Ortsführungskreis immer, Fachreferat und Verwaltung ab 1.000 € – darunter nur, wenn sie angefragt wurden. Dazu muss das Angebot vorliegen (bei den Unterlagen). Ein zweiter Klick auf den gewählten Stand nimmt ihn zurück.',
};
const infoBtn = k => `<button class="info" data-act="info" data-v="${k}" aria-label="Hinweis anzeigen" title="Hinweis">i</button>`;
const okLink = s => /^https?:\/\//i.test((s || '').trim());
const linkBtn = b => okLink(b.link) ? `<a class="btn" href="${esc(b.link.trim())}" target="_blank" rel="noopener" data-act="link">Öffnen ↗</a>` : `<span class="btn disabled" aria-disabled="true" title="Erst einen Link einfügen (https://…)">Öffnen ↗</span>`;
const copyBtn = b => `<button data-act="copy-path" ${b.pfad ? '' : 'disabled'}>Kopieren</button>`;
const zustChips = b => b.zust.map((n, i) => `<span class="pchip">${esc(n)}<button class="x" data-act="rm-zust" data-i="${i}" aria-label="${esc(n)} entfernen">×</button></span>`).join('');
const metaLine = b => esc(glName(b)) + (b.stichwort ? ` · <span class="chip sw">${esc(b.stichwort)}</span>` : '') + (b.angelegt ? ` · angelegt ${fmtDate(b.angelegt)}` : '');

function steps(b) {
  const p = phase(b);
  if (p.step < 0) return `<div class="steps"><span class="phase ph-pause">${esc(p.t)}</span></div>`;
  return '<ol class="steps">' + PHASES.map((s, i) => `<li class="${p.step > i || p.step === 3 ? 'done' : p.step === i ? 'cur ' + PH_CLS[i] : ''}">${s.t}</li>`).join('') + '</ol>';
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

/* ---------- Eckdaten: Beschreibung und Ordner nebeneinander, gleich hoch */
function secEck(b) {
  return `<section class="card" id="sec-eck">
    <div class="sec-head"><h2>Eckdaten</h2></div>
    <div class="grid g12">
      ${fld('Bedarf', tin(b, 'titel', 'id="f-titel" aria-label="Bedarf"', 'z. B. Mannschaftstransportwagen für den Sanitätsdienst'), 's6')}
      ${fld('Gliederung', tin(b, 'gliederung', 'list="dl-gl" aria-label="Gliederung"', 'Ort, oder „Diözese“'), 's3')}
      ${fld('Priorität', seg(PRIO.map(([v, l]) => [v, l, 't-p-' + v]), b.prio, 'data-p="prio"', 'small'), 's3')}
      ${fld('Zuständig', `<div class="chips"><span id="zust-chips">${zustChips(b)}</span><input id="zust-new" class="chip-in" list="dl-zust" placeholder="+ Name, Enter" aria-label="Zuständige Person hinzufügen"></div>`, 's4')}
      ${fld('Summe', `<div class="row">${nin(b, 'summe', 'aria-label="Summe in Euro"')}<span class="unit">€</span>${seg([['Schätzung', 'Schätzung'], ['Angebot', 'laut Angebot']], b.summeArt, 'data-p="summeArt"', 'small')}</div>`, 's3')}
      ${fld('Deadline', din(b, 'deadline', 'aria-label="Deadline"'), 's2', 'deadline')}
      ${fld('Stichwort oder Fördertopf', tin(b, 'stichwort', 'list="dl-sw" aria-label="Stichwort oder Fördertopf"', 'z. B. Landesprogramm Digitalisierung'), 's3', 'stichwort')}
      <div class="fld s12"><span class="lab">Beschreibung</span>
        <div class="desc-row">
          ${tarea(b, 'beschreibung', 'aria-label="Beschreibung" class="desc"', 'Kurzbeschreibung aus der UPL oder in eigenen Worten', 6)}
          <div class="ordner"><div class="o-head">Ordner ${infoBtn('ordner')}</div>
            <div class="o-row"><span class="o-lab">OneDrive / SharePoint</span><div class="row">${tin(b, 'link', 'class="grow" aria-label="Link zum Ordner"', 'Link einfügen (https://…)')}<span id="link-btn">${linkBtn(b)}</span></div></div>
            <div class="o-row"><span class="o-lab">Pfad im Explorer</span><div class="row">${tin(b, 'pfad', 'class="grow mono" aria-label="Ordnerpfad"', 'C:\\Users\\…\\OneDrive - Malteser\\…')}<span id="copy-btn">${copyBtn(b)}</span></div></div>
          </div>
        </div>
      </div>
    </div>
    ${dl('dl-gl', [DIO, ...GL_LIST, ...D.bedarfe.map(x => x.gliederung)])}${dl('dl-sw', D.bedarfe.map(x => x.stichwort))}${dl('dl-zust', D.bedarfe.flatMap(x => x.zust))}
  </section>`;
}

/* ---------- Freigabe (ohne „offen“: ein Stand beginnt mit „angefragt“) und Unterlagen (mit dem Angebot) */
function freigabeBody(b) {
  const rows = frItems(b).map(i => {
    const p = 'freigabe.' + i.k;
    if (i.na) return `<div class="fr-row na"><div class="fr-lab">${i.label}</div><div class="fr-na">${esc(i.na)}</div></div>`;
    const since = i.st === 'angefragt' && validIso(i.item.angefragt) ? `<span class="since">seit ${days(i.item.angefragt, today())} Tagen</span>` : '';
    return `<div class="fr-row st-${i.st}">
      <div class="fr-lab">${i.label}${i.k === 'ofk' && b.gliederung ? `<span class="sub">${esc(b.gliederung)}</span>` : ''}${i.opt ? '<span class="sub">unter 1.000 € nicht nötig</span>' : ''}${i.k === 'fach' ? tin(b, p + '.name', 'list="dl-fach" class="fach" aria-label="Welches Fachreferat"', 'welches?') : ''}</div>
      <div class="fr-seg">${seg([['angefragt', 'angefragt', 't-run'], ['ok', i.ok, 't-ok'], ['nein', i.nein, 't-err']], i.st, `data-p="${p}.st" data-toggle="offen"`, 'small')}</div>
      <div class="fr-dates">${i.st === 'offen' ? '' : `<label>angefragt am ${din(b, p + '.angefragt', 'aria-label="angefragt am"')}</label>${since}`}</div>
      <div class="fr-note">${tin(b, p + '.notiz', 'aria-label="Notiz"', 'Notiz')}</div>
    </div>`;
  }).join('');
  const fo = frOffen(b);
  return rows + (fo.names.length ? `<div class="fr-foot warn">Es fehlt noch: ${esc(fo.names.join(', '))}</div>` : '<div class="fr-foot ok">✓ Freigabe vollständig, die Anträge können raus</div>')
    + dl('dl-fach', [...FACH_LIST, ...D.bedarfe.map(x => x.freigabe.fach.name)]);
}
function unterlagenBody(b) {
  return b.unterlagen.map(u => `<div class="ul-row"><div class="ul-name">${u.fest ? esc(u.name) : tin(u, 'name', `data-uid="${u.id}" aria-label="Name der Unterlage"`)}</div>
      ${seg(ulOpts(u), u.st, `data-p="st" data-uid="${u.id}"`, 'small')}
      ${u.fest ? '<span></span>' : `<button class="x" data-act="rm-ul" data-uid="${u.id}" aria-label="${esc(u.name)} entfernen">×</button>`}</div>`).join('')
    + `<div class="ul-add"><input type="text" id="ul-new" list="dl-ul" placeholder="Weitere Unterlage, z. B. Bilder" aria-label="Weitere Unterlage"><button data-act="add-ul">+ Unterlage</button></div>`
    + dl('dl-ul', ['Bilder', 'Presseartikel', 'Studien', 'Kostenplan', 'Zeitplan', 'Unterstützerschreiben'].filter(n => !b.unterlagen.some(u => u.name === n)));
}
function secFrei(b) {
  return `<section class="card" id="sec-frei">
    <div class="sec-head"><h2>Freigabe und Unterlagen</h2></div>
    <div class="grid frei"><div><h3>Freigabe ${infoBtn('freigabe')}</h3><div id="fr-body">${freigabeBody(b)}</div></div><div><h3>Unterlagen</h3><div id="ul-body">${unterlagenBody(b)}</div></div></div>
  </section>`;
}

/* ---------- Förderplan: je Förderer links das Wesentliche (wer, Stand, warum, Knackpunkte), rechts die Summe und ihr Anteil am Bedarf */
const F_ST = [['geplant', 'geplant'], ['vorb', 'in Vorbereitung', 't-warn'], ['beantragt', 'beantragt', 't-run'], ['zugesagt', 'zugesagt', 't-ok'], ['abgelehnt', 'abgelehnt', 't-err']];
const F_ST_L = Object.fromEntries(F_ST.map(([v, l]) => [v, l]));
const artFromKartei = (k, name) => /stiftung/i.test(name) || /stift/i.test(k.blatt) ? 'Stiftung' : /sparkasse/i.test(name) ? 'Sparkasse' : /bank/i.test(name) ? 'Volksbank / Bank' : '';
// Hinweise, die immer zu sehen sind: andere Region laut Kartei, derselbe Förderer bei anderen Bedarfen
function foeWarn(b, f) {
  if (!f.name.trim()) return '';
  const k = kartei(f.name), key = kkey(f.name);
  const other = D.bedarfe.filter(x => x !== b && !x.archiv && x.foerderer.some(g => kkey(g.name) === key && g.status !== 'abgelehnt'));
  const L = [];
  if (k && b.gliederung && b.gliederung !== DIO && k.gl.length && !k.gl.some(g => /^alle$/i.test(g)) && !k.gl.includes(b.gliederung)) L.push('Laut Kartei zuständig für ' + esc(k.gl.join(', ')));
  if (other.length) L.push('Auch im Förderplan von: ' + other.map(x => `<button class="link" data-act="open" data-id="${x.id}">${esc(x.titel || '(ohne Namen)')}</button> (${F_ST_L[x.foerderer.find(g => kkey(g.name) === key).status]})`).join(', '));
  return L.length ? `<div class="foe-warn">${L.map(t => `<div>${t}</div>`).join('')}</div>` : '';
}
function detSummary(f) {
  const k = kartei(f.name), c = k && k.kontakte[0];
  const parts = [c ? c.n : f.kontakt, k && k.weg.length ? 'Antrag ' + k.weg.join(' oder ') : f.weg, !c && f.mail].filter(Boolean);
  return esc(parts.join(' · ') || (k ? 'aus der Förder-Kartei' : 'Ansprechperson, Antragsweg, Quellen …'));
}
function detKartei(f) {
  const k = kartei(f.name);
  if (!k) return KR.list.length && f.name.trim() ? '<p class="muted small">Nicht in der Förder-Kartei.</p>' : '';
  const hist = Object.entries(k.hist).sort((a, c) => c[0] - a[0]);
  const row = (t, v) => v ? `<dt>${t}</dt><dd>${v}</dd>` : '';
  return `<div class="det-k"><h4>Aus der Förder-Kartei <span class="badge k">${esc(k.blatt)}</span></h4>
    <dl class="dl">${row('Antragsweg', esc(k.weg.join(' oder ')))}${row('Website', k.web ? `<a href="${esc(/^https?:/i.test(k.web) ? k.web : 'https://' + k.web)}" target="_blank" rel="noopener" data-act="link">${esc(k.web.replace(/^https?:\/\//, '').slice(0, 60))}</a>` : '')}
      ${row('Gliederungen', esc(k.gl.join(', ')))}${row('Schwerpunkte', esc(k.schwer))}${row('Notiz', esc(k.notiz))}
      ${row('Bisher gefördert', hist.length ? hist.map(([y, v]) => `<div>${y}: ${esc(v.replace(/\n/g, ', '))}</div>`).join('') : '<span class="muted">nichts eingetragen</span>')}</dl>
    ${k.kontakte.length ? `<table class="kt"><thead><tr><th>Kontakt</th><th>E-Mail</th><th>Telefon</th></tr></thead><tbody>${k.kontakte.map(c => `<tr><td>${esc(c.n)}${c.nicht ? '<div class="sub">nicht direkt anschreiben</div>' : ''}</td><td class="sel">${esc(c.m)}</td><td>${esc(c.t)}</td></tr>`).join('')}</tbody></table>` : ''}</div>`;
}
const OWN_FIELDS = [['kontakt', 'Ansprechperson oder Portal'], ['mail', 'E-Mail'], ['tel', 'Telefon'], ['web', 'Website oder Portal-Link'], ['weg', 'Antragsweg'],
  ['fristInfo', 'Weitere Fristen und Termine'], ['hoehe', 'Übliche Fördersumme'], ['eigenInfo', 'Eigenanteil gefordert'], ['quellen', 'Quellen'], ['notiz', 'Notizen']];
function detPanel(b, f) {
  const a = `data-fid="${f.id}"`, area = k => k === 'quellen' || k === 'notiz' || k === 'fristInfo';
  return `<div class="det-panel"><div id="dk-${f.id}">${detKartei(f)}</div>
    <div class="det-o"><h4>Eigene Angaben und Recherche</h4><div class="grid own-grid">${OWN_FIELDS.map(([k, l]) => fld(l, area(k) ? tarea(f, k, a + ` aria-label="${l}"`) : tin(f, k, a + ` aria-label="${l}"`), area(k) ? 'wide' : '')).join('')}</div></div></div>`;
}
const AMT_LAB = { geplant: 'Erwartete Summe', vorb: 'Erwartete Summe', beantragt: 'Beantragt', zugesagt: 'Zugesagt', abgelehnt: 'Beantragt (abgelehnt)' };
function foeShare(b, f) {
  const S = +b.summe || 0, v = f.status === 'abgelehnt' ? 0 : foeAmt(f);
  return segBar(b, { hl: f.id }) + `<div class="share-t">${S ? `<b>${Math.round(v / S * 100)} %</b> des Bedarfs (${eur(S)})` : 'Summe des Bedarfs fehlt'}</div>`;
}
function geldBlock(f) {
  const a = `data-fid="${f.id}"`;
  if (UI.geld === f.id) return `<div class="geld form"><label>Betrag<span class="row"><input id="geld-betrag" type="text" inputmode="decimal" class="num" value="${esc(fmtNum(f.eingegangen ?? f.zugesagt ?? f.betrag))}"><span class="unit">€</span></span></label>
      <label>eingegangen am<input id="geld-datum" type="date" value="${esc(f.eingangAm || today())}"></label><div class="row"><button class="primary" data-act="geld-ok" ${a}>Bestätigen</button><button data-act="geld-no">Abbrechen</button></div>
      ${f.eingegangen > 0 ? `<button class="link small" data-act="geld-undo" ${a}>Eingang zurücknehmen</button>` : ''}</div>`;
  if (f.eingegangen > 0) return `<div class="geld ok">✓ ${eur(f.eingegangen)} eingegangen am ${fmtDate(f.eingangAm) || '–'} <button class="link small" data-act="geld" ${a}>ändern</button></div>`;
  return `<div class="geld"><button class="primary" data-act="geld" ${a}>Geldeingang bestätigen</button></div>`;
}
function foeCard(b, f) {
  const a = `data-fid="${f.id}"`, st = f.status, open = !!UI.open['det-' + f.id];
  const dates = st === 'geplant' || st === 'vorb'
    ? fld('Antragsfrist', din(f, 'frist', a + ' aria-label="Antragsfrist"'))
    : fld('beantragt am', din(f, 'beantragtAm', a + ' aria-label="beantragt am"'))
      + (st === 'beantragt' ? fld('Antwort erwartet', din(f, 'erwartet', a + ' aria-label="Antwort erwartet"')) : fld(st === 'zugesagt' ? 'zugesagt am' : 'abgelehnt am', din(f, 'entscheidungAm', a + ' aria-label="Entscheidung am"')));
  const arts = uniq([...ART, f.art]);
  return `<article class="foe st-${st}" id="foe-${f.id}">
    <div class="foe-main">
      <div class="foe-head">
        <div class="foe-name">${tin(f, 'name', a + ' list="dl-kartei" aria-label="Förderer"', 'Wer fördert? z. B. Sparkasse …')}</div>
        <select data-p="art" ${a} id="art-${f.id}" class="art${f.art ? '' : ' empty'}" aria-label="Art des Förderers"><option value="">Art …</option>${arts.map(x => `<option ${x === f.art ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <button class="x" data-act="rm-foe" ${a} title="Förderer entfernen" aria-label="Förderer entfernen">×</button>
      </div>
      <div id="fw-${f.id}">${foeWarn(b, f)}</div>
      <div class="kv"><span class="k">Stand</span>${seg(F_ST, st, `data-p="status" ${a}`, 'small')}</div>
      <div class="kv"><span class="k">Einschätzung</span>${seg(EINSCH, f.einsch, `data-p="einsch" data-toggle="" ${a}`, 'small einsch')}</div>
      <div class="kv"><span class="k">Antrag stellt</span>${seg([['ich', 'ich'], ['gl', 'Gliederung selbst']], f.durch, `data-p="durch" ${a}`, 'small')}</div>
      <div class="dates">${dates}</div>
      <div class="why">${fld('Warum passt das?', tarea(f, 'warum', a + ' aria-label="Warum passt das"', 'Satzungszweck, Förderschwerpunkt, Regionalbezug …'))}
      ${fld('Knackpunkte', tarea(f, 'knackpunkte', a + ' aria-label="Knackpunkte"', 'Wo hakt es? Worauf muss der Antrag den Fokus legen?'))}</div>
      <div class="det">
        <button class="det-btn" data-act="det" data-v="${f.id}" aria-expanded="${open}"><span class="tw">${open ? '▾' : '▸'}</span>Kontakt und Details <span class="muted" id="ds-${f.id}">${detSummary(f)}</span></button>
        ${open ? detPanel(b, f) : ''}
      </div>
    </div>
    <aside class="foe-sum">
      <label class="amt-lab" for="amt-${f.id}">${AMT_LAB[st]}</label>
      <div class="amt-big">${nin(f, st === 'zugesagt' ? 'zugesagt' : 'betrag', a + ` id="amt-${f.id}" aria-label="${AMT_LAB[st]}"`)}<span class="unit">€</span></div>
      ${st === 'zugesagt' ? `<div class="amt-small">beantragt ${nin(f, 'betrag', a + ' aria-label="beantragter Betrag"')} €</div>` : ''}
      <div id="sh-${f.id}" class="share">${foeShare(b, f)}</div>
      ${st === 'zugesagt' ? geldBlock(f) : ''}
    </aside>
  </article>`;
}
function finSummary(b) {
  const F = fin(b), S = F.S;
  if (!S) return '<div class="fin muted">Trag oben in den Eckdaten eine Summe ein, dann rechnet die Liste die Deckung aus.</div>';
  const line = (lab, v, cls = '') => { const gap = S - v; return `<tr class="${cls}"><th>${lab}</th><td class="num">${eur(v)}</td><td class="num">${Math.round(v / S * 100)} %</td>
    <td class="num ${gap > 0 ? 'gap' : gap < 0 ? 'over' : 'okc'}">${gap > 0 ? 'Lücke ' + eur(gap) : gap < 0 ? 'überdeckt um ' + eur(-gap) : 'gedeckt'}</td></tr>`; };
  return `<div class="fin"><div class="fin-l">${segBar(b, { big: true })}<div class="legend">${LEGEND_FIN}</div>
    ${F.mitGe > S ? '<div class="small hint-warn">Geplant ist mehr als der Bedarf. Kommt am Ende mehr Geld zusammen als nötig, fällt das spätestens im Verwendungsnachweis auf.</div>' : ''}</div>
    <table class="fintab"><tbody>
      <tr><th>Bedarf</th><td class="num">${eur(S)}</td><td></td><td></td></tr>
      ${line('Zugesagt und Eigenanteil', F.gedeckt, 'main')}${line('… wenn alles Beantragte kommt', F.mitBe)}${line('… wenn auch alles Geplante kommt', F.mitGe)}
      <tr><th>Eingegangen</th><td class="num">${eur(F.eingegangen)}</td><td></td><td class="num muted">${F.zugesagt > F.eingegangen ? 'noch offen: ' + eur(F.zugesagt - F.eingegangen) : ''}</td></tr>
    </tbody></table></div>`;
}
function secFoe(b) {
  return `<section class="card" id="sec-foe">
    <div class="sec-head"><h2>Förderplan</h2></div>
    <div class="research"><span class="r-lab">Recherche ${infoBtn('recherche')}</span>
      <button data-act="vorlage">⤓ Excel-Vorlage für die KI-Recherche</button><button data-act="import">Ausgefüllte Excel übernehmen …</button></div>
    <div class="foe-list">${b.foerderer.map(f => foeCard(b, f)).join('') || '<div class="empty">Noch kein Förderer eingetragen – einzeln mit „+ Förderer“ oder viele auf einmal aus einer ausgefüllten Recherche-Excel.</div>'}</div>
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
