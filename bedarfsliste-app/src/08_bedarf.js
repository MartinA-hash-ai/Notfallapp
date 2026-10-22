/* ===================================================================== Seite eines Bedarfs
   Kopf: Name und Gliederung direkt änderbar, rechts die Summe mit „⋯“ (zurückstellen, archivieren) und Löschen; Phase und Stand hängen an der Kopfzeile.
   Links Zuständig/Deadline/Stichwort/Beschreibung, der Förderplan (Übersicht, dann je Förderer eine Karte) und die Nacharbeit; rechts Freigaben, Unterlagen und Ordner.
   Eingabefelder tragen data-p (Pfad im Bedarf), bei Förderern zusätzlich data-fid, bei Unterlagen data-uid.
   Tippen ändert nur die Daten und zeichnet abgeleitete Teile neu (refresh); Knöpfe und Auswahlfelder zeichnen die Seite neu. */

const fld = (lab, inner, cls = '', info = '') => `<div class="fld ${cls}"><span class="lab">${lab}${info ? ' ' + infoBtn(info) : ''}</span>${inner}</div>`;
const tin = (o, p, x = '', ph = '') => `<input type="text" data-p="${p}" ${x} value="${esc(getPath(o, p) ?? '')}" placeholder="${esc(ph)}">`;
const nin = (o, p, x = '', ph = '0') => `<input type="text" inputmode="decimal" class="num" data-num data-p="${p}" ${x} value="${esc(fmtNum(getPath(o, p)))}" placeholder="${esc(ph)}">`;
const din = (o, p, x = '') => `<input type="date" data-p="${p}" ${x} value="${esc(getPath(o, p) || '')}">`;
const tarea = (o, p, x = '', ph = '', rows = 2) => `<textarea data-p="${p}" ${x} rows="${rows}" placeholder="${esc(ph)}">${esc(getPath(o, p) ?? '')}</textarea>`;
const cbx = (o, p, lab, x = '') => `<label class="check"><input type="checkbox" data-p="${p}" ${x} ${getPath(o, p) ? 'checked' : ''}> ${lab}</label>`;
const seg = (opts, cur, attrs, cls = '') => `<div class="seg ${cls}" role="group">` + opts.map(([v, l, tone]) =>
  `<button type="button" class="${v === cur ? 'on ' + (tone || '') : ''}" data-act="set" data-v="${esc(v)}" ${attrs} aria-pressed="${v === cur}">${l}</button>`).join('') + '</div>';
const dl = (id, vals) => `<datalist id="${id}">${uniq(vals).map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
const INFO = {
  ordner: 'Link: in OneDrive beim Ordner „Link kopieren“ wählen und hier einfügen – „Öffnen“ zeigt den Ordner im Browser, Word-Dateien gehen von dort in der Desktop-App auf. Pfad: aus der Adresszeile des Explorers kopieren. „Kopieren“ legt ihn in die Zwischenablage, im Explorer dann Strg+L und Strg+V. Direkt öffnen kann der Browser den Explorer nicht.',
  deadline: 'Bis wann der Bedarf gedeckt sein muss. Ohne Deadline steht in der Liste blass „ohne Deadline“.',
  stichwort: 'Bedarfe mit demselben Stichwort – zum Beispiel einem Fördertopf – lassen sich in der Liste zusammen filtern.',
  recherche: 'Die Excel enthält den Bedarf (Beschreibung, Summe, Gliederung) und den bisherigen Förderplan. Im Blatt „Anleitung“ steht, was in jede Spalte gehört – so kann eine KI sie direkt als Vorlage für die Förderrecherche nehmen. Die ausgefüllte Datei hier wieder übernehmen: neue Förderer kommen dazu, vorhandene werden ergänzt.',
  freigabe: 'Kreis anklicken, um den Stand zu ändern: gelb = angefragt, grün = zugestimmt, rot = abgelehnt. Ortsführungskreis immer, Fachreferat und Verwaltung ab 1.000 € – darunter nur, wenn sie angefragt wurden. Dazu muss das Angebot vorliegen (bei den Unterlagen).',
};
const infoBtn = k => `<button class="info" data-act="info" data-v="${k}" aria-label="Hinweis anzeigen" title="Hinweis">i</button>`;
const okLink = s => /^https?:\/\//i.test((s || '').trim());
const linkBtn = b => okLink(b.link) ? `<a class="btn" href="${esc(b.link.trim())}" target="_blank" rel="noopener" data-act="link">Öffnen ↗</a>` : `<span class="btn disabled" aria-disabled="true" title="Erst einen Link einfügen (https://…)">Öffnen ↗</span>`;
const copyBtn = b => `<button data-act="copy-path" ${b.pfad ? '' : 'disabled'}>Kopieren</button>`;
const zustChips = b => b.zust.map((n, i) => `<span class="pchip">${esc(n)}<button class="x" data-act="rm-zust" data-i="${i}" aria-label="${esc(n)} entfernen">×</button></span>`).join('');
const metaRest = b => (b.stichwort ? `<span class="chip sw">${esc(b.stichwort)}</span> · ` : '') + (b.angelegt ? 'angelegt ' + fmtDate(b.angelegt) : '');
const ICON_TRASH = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-.9 11.1A2 2 0 0 1 15.1 22H8.9a2 2 0 0 1-2-1.9L6 9zm4 2v8h1.6v-8H10zm2.4 0v8H14v-8h-1.6z"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M11 4h2v9.2l3.6-3.6 1.4 1.4-6 6-6-6 1.4-1.4 3.6 3.6V4zM5 18h14v2H5v-2z"/></svg>';
const ICON_UP = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M11 20h2v-9.2l3.6 3.6 1.4-1.4-6-6-6 6 1.4 1.4 3.6-3.6V20zM5 4h14v2H5V4z"/></svg>';
const ICON_PEN = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M4 17.2V20h2.8L17.3 9.5l-2.8-2.8L4 17.2zm15.7-10.1a1 1 0 0 0 0-1.4l-1.4-1.4a1 1 0 0 0-1.4 0l-1.2 1.2 2.8 2.8 1.2-1.2z"/></svg>';

function steps(b) {
  const p = phase(b);
  if (p.step < 0) return `<div class="steps"><span class="phase ph-pause">${esc(p.t)}</span></div>`;
  return '<ol class="steps">' + PHASES.map((s, i) => `<li class="${p.step > i || p.step === 3 ? 'done' : p.step === i ? 'cur ' + PH_CLS[i] : ''}">${s.t}</li>`).join('') + '</ol>';
}
function statusBlock(b) {
  const p = phase(b);
  return (p.step >= 0 ? `<span class="st-main${p.bad ? ' bad' : ''}"><b>${esc(p.t)}</b>${p.sub ? ': ' + esc(p.sub) : ''}</span>` : '<span class="muted">Der Bedarf ruht – über „⋯“ oben rechts wieder aufnehmen.</span>')
    + p.warn.map(w => `<span class="st-warn">⚠ ${esc(w)}</span>`).join('');
}

function bedarfView(b) {
  return `<main class="bedarf">
    <div class="d-head">
      ${prioMark(b)}
      <div class="d-name">
        <textarea class="inline title" id="f-titel" data-p="titel" rows="1" placeholder="Bedarf" aria-label="Bedarf">${esc(b.titel)}</textarea>
        <div class="d-sub"><input type="text" class="inline gl" data-p="gliederung" list="dl-gl" value="${esc(b.gliederung)}" placeholder="Gliederung (Ort oder Diözese)" aria-label="Gliederung"><span class="muted" id="d-meta">${metaRest(b)}</span></div>
      </div>
      <div class="d-right-head">
        <div class="sum-line"><input type="text" inputmode="decimal" class="inline num sum" data-num data-p="summe" value="${esc(fmtNum(b.summe))}" placeholder="Summe" aria-label="Summe in Euro"><span class="unit">€</span></div>
        <div class="d-actions">
          <button class="icon-btn" data-act="more" aria-label="Weitere Aktionen: zurückstellen, archivieren" title="Zurückstellen, verwerfen, archivieren">⋯</button>
          <button class="icon-btn trash" data-act="del" aria-label="Bedarf löschen" title="Bedarf löschen">${ICON_TRASH}</button>
        </div>
        <div class="sum-art">${seg([['Schätzung', 'Schätzung'], ['Angebot', 'laut Angebot']], b.summeArt, 'data-p="summeArt"', 'small')}</div>
      </div>
    </div>
    ${b.archiv ? '<div class="d-flag">Dieser Bedarf liegt im Archiv. <button class="link" data-act="unarchive">Zurück in die Liste holen</button></div>' : ''}
    <div class="d-grid">
      <div class="d-left">${secInfo(b)}${secFoe(b)}${secNach(b)}</div>
      <aside class="d-right">${sidePanel(b)}</aside>
    </div>
    ${dl('dl-gl', [DIO, ...GL_LIST, ...D.bedarfe.map(x => x.gliederung)])}
  </main>`;
}
// Menü hinter „⋯“: zurückstellen, verwerfen, wieder aufnehmen, archivieren
function moreMenu(btn) {
  closeMenus();
  const b = cur(); if (!b) return;
  const item = (act, label, v) => h('button', { role: 'menuitem', 'data-act': act, 'data-p': v != null ? 'manuell' : null, 'data-v': v != null ? v : null }, label);
  const m = h('div', { class: 'menu', id: 'mmenu', role: 'menu' },
    b.manuell ? item('set', 'Wieder aufnehmen', '') : null,
    b.manuell !== 'zurückgestellt' ? item('set', 'Zurückstellen', 'zurückgestellt') : null,
    b.manuell !== 'verworfen' ? item('set', 'Verwerfen', 'verworfen') : null,
    h('hr'),
    b.archiv ? item('unarchive', 'Aus dem Archiv holen') : item('archive', 'Archivieren'));
  placePop(m, btn, 'right');
  m.querySelector('button').focus();
}

/* ---------- Zuständig, Deadline, Stichwort, Beschreibung */
function secInfo(b) {
  return `<section class="card info-card" id="sec-eck">
    <div class="grid g12">
      ${fld('Zuständig', `<div class="chips"><span id="zust-chips">${zustChips(b)}</span><input id="zust-new" class="chip-in" list="dl-zust" placeholder="+ Name, Enter" aria-label="Zuständige Person hinzufügen"></div>`, 's4')}
      ${fld('Deadline', din(b, 'deadline', 'aria-label="Deadline"'), 's3', 'deadline')}
      ${fld('Stichwort oder Fördertopf', tin(b, 'stichwort', 'list="dl-sw" aria-label="Stichwort oder Fördertopf"', 'z. B. Landesprogramm Digitalisierung'), 's5', 'stichwort')}
      ${fld('Beschreibung', tarea(b, 'beschreibung', 'aria-label="Beschreibung" class="desc"', 'Kurzbeschreibung aus der UPL oder in eigenen Worten', 4), 's12')}
    </div>
    ${dl('dl-sw', D.bedarfe.map(x => x.stichwort))}${dl('dl-zust', D.bedarfe.flatMap(x => x.zust))}
  </section>`;
}

/* ---------- Rechts: Freigaben, Unterlagen, Ordner – je Punkt ein Kreis (grün ✓, gelb …, rot ✗); ein Klick darauf bietet die anderen Stände an */
const CIRC_SYM = { ok: ICO.ok, run: ICO.run, no: ICO.no, off: '', na: ICO.na };
const circ = (kind, attrs, label) => `<button class="circ c-${kind}" data-act="circ" ${attrs} aria-label="${esc(label)} – nächster Stand" title="Klicken: nächster Stand">${CIRC_SYM[kind]}</button>`;
const frKind = i => i.na ? 'na' : ({ ok: 'ok', angefragt: 'run', nein: 'no', offen: 'off' })[i.st];
const ulKind = u => ({ da: 'ok', arbeit: 'run', fehlt: 'no' })[u.st] || 'no';
function freigabeList(b) {
  const rows = frItems(b).map(i => {
    const p = 'freigabe.' + i.k;
    const name = i.k === 'fach' ? `<input type="text" class="inline fr-name" data-p="${p}.name" list="dl-fach" value="${esc(i.item.name)}" placeholder="Fachreferat" title="Fachreferat" aria-label="Fachreferat">`
      : `<span class="ci-n" title="${esc(i.label)}">${i.k === 'verw' ? 'Verwaltung' : esc(i.label)}</span>`;
    const hint = i.na ? 'entfällt' : i.opt && i.st === 'offen' ? 'nicht nötig' : i.st === 'offen' ? 'noch nicht angefragt' : '';
    const since = i.st === 'angefragt' && validIso(i.item.angefragt) ? 'angefragt am ' + fmtDate(i.item.angefragt) + ', seit ' + days(i.item.angefragt, today()) + ' Tagen' : 'angefragt am';
    const date = !i.na && (i.st === 'angefragt' || i.st === 'nein') ? `<input type="date" class="inline date" data-p="${p}.angefragt" value="${esc(i.item.angefragt || '')}" aria-label="angefragt am" title="${esc(since)}">` : '';
    return `<div class="ci-row" id="fr-${i.k}">${i.na ? `<span class="circ c-na" aria-hidden="true">${ICO.na}</span>` : circ(frKind(i), `data-kind="fr" data-k="${i.k}"`, i.label)}
      <div class="ci-t">${name}${hint ? `<span class="ci-hint">${hint}</span>` : ''}</div>${date}</div>`;
  }).join('');
  const fo = frOffen(b);
  return rows + (fo.names.length ? `<div class="ci-foot warn">Es fehlt noch: ${esc(fo.names.join(', '))}</div>` : '')
    + dl('dl-fach', [...FACH_LIST, ...D.bedarfe.map(x => x.freigabe.fach.name)]);
}
function unterlagenList(b) {
  return b.unterlagen.map(u => `<div class="ci-row">${circ(ulKind(u), `data-kind="ul" data-uid="${u.id}"`, u.name || 'Unterlage')}
      <div class="ci-t">${u.fest ? `<span class="ci-n">${esc(u.name)}</span>` : tin(u, 'name', `class="inline" data-uid="${u.id}" aria-label="Name der Unterlage"`, 'Unterlage')}<span class="ci-hint">${esc(ulText(u))}</span></div>
      ${u.fest ? '' : `<button class="x" data-act="rm-ul" data-uid="${u.id}" aria-label="${esc(u.name)} entfernen" title="entfernen">×</button>`}</div>`).join('')
    + `<div class="ci-row add"><span class="circ c-add" aria-hidden="true">+</span><input type="text" id="ul-new" class="inline" list="dl-ul" placeholder="weitere Unterlage" aria-label="Weitere Unterlage hinzufügen"></div>`
    + dl('dl-ul', ['Bilder', 'Presseartikel', 'Studien', 'Kostenplan', 'Zeitplan', 'Unterstützerschreiben'].filter(n => !b.unterlagen.some(u => u.name === n)));
}
function sidePanel(b) {
  return `<section class="card side" id="sec-frei">
    <h3>Freigaben ${infoBtn('freigabe')}</h3><div id="fr-body" class="ci-list">${freigabeList(b)}</div>
    <h3>Unterlagen</h3><div id="ul-body" class="ci-list">${unterlagenList(b)}</div>
    <h3>Ordner ${infoBtn('ordner')}</h3>
    <div class="o-row"><span class="o-lab">OneDrive / SharePoint</span><div class="row">${tin(b, 'link', 'class="grow" aria-label="Link zum Ordner"', 'Link einfügen (https://…)')}<span id="link-btn">${linkBtn(b)}</span></div></div>
    <div class="o-row"><span class="o-lab">Pfad im Explorer</span><div class="row">${tin(b, 'pfad', 'class="grow mono" aria-label="Ordnerpfad"', 'C:\\Users\\…\\OneDrive - Malteser\\…')}<span id="copy-btn">${copyBtn(b)}</span></div></div>
  </section>`;
}
// Klick auf den Kreis: ein Stand weiter (Freigabe: offen → angefragt → zugestimmt → abgelehnt; Unterlage: fehlt → in Arbeit → vorhanden)
function circNext(btn) {
  const b = cur(); if (!b) return;
  if (btn.dataset.kind === 'fr') { const k = btn.dataset.k, it = b.freigabe[k], v = nextOf(ROT_FR, it.st); it.st = v; effects(b, b, 'freigabe.' + k + '.st', v); }
  else { const u = b.unterlagen.find(x => x.id === btn.dataset.uid); if (!u) return; u.st = nextOf(ROT_ANG, u.st); }
  changed();
}

/* ---------- Förderplan: je Förderer eine Überschrift (Name), rechts groß die Summe mit Anteil, daneben der Stand mit Fristen, oben rechts die Einschätzung;
   darunter Pro und Contra, Kontakt und Details zum Aufklappen */
const F_ST = [['geplant', 'geplant'], ['vorb', 'in Vorbereitung', 't-warn'], ['beantragt', 'beantragt', 't-run'], ['zugesagt', 'zugesagt', 't-ok'], ['abgelehnt', 'abgelehnt', 't-err']];
const F_ST_L = Object.fromEntries(F_ST.map(([v, l]) => [v, l]));
const LVL = ['suw', 'uw', 'u', 'w', 'sw'];                 // Einschätzung als Punkte 1 (rot) … 5 (grün)
const artFromKartei = (k, name) => /stiftung/i.test(name) || /stift/i.test(k.blatt) ? 'Stiftung' : /sparkasse/i.test(name) ? 'Sparkasse' : /bank/i.test(name) ? 'Volksbank / Bank' : '';
// Hinweise, die immer zu sehen sind: andere Region laut Kartei, derselbe Förderer bei anderen Bedarfen
function foeWarnList(b, f) {
  if (!f.name.trim()) return [];
  const k = kartei(f.name), key = kkey(f.name);
  const other = D.bedarfe.filter(x => x !== b && !x.archiv && x.foerderer.some(g => kkey(g.name) === key && g.status !== 'abgelehnt'));
  const L = [];
  if (k && b.gliederung && b.gliederung !== DIO && k.gl.length && !k.gl.some(g => /^alle$/i.test(g)) && !k.gl.includes(b.gliederung)) L.push('Laut Kartei zuständig für ' + esc(k.gl.join(', ')));
  if (other.length) L.push('Auch im Förderplan von: ' + other.map(x => `<button class="link" data-act="open" data-id="${x.id}">${esc(x.titel || '(ohne Namen)')}</button> (${F_ST_L[x.foerderer.find(g => kkey(g.name) === key).status]})`).join(', '));
  return L;
}
const foeWarn = (b, f) => foeWarnList(b, f).length ? `<button class="fw-tri" data-act="fw" data-fid="${f.id}" aria-label="Hinweise anzeigen">${ICON_TRI}</button>` : '';
function fwPop(btn) {
  closeMenus();
  const b = cur(), f = b && b.foerderer.find(x => x.id === btn.dataset.fid); if (!f) return;
  const m = h('div', { class: 'menu info-pop fw-pop', role: 'tooltip', 'data-fid': f.id, html: foeWarnList(b, f).map(t => `<div>${t}</div>`).join('') });
  placePop(m, btn);
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
  return `<div class="det-panel"><div><div id="dk-${f.id}">${detKartei(f)}</div>
      <div class="det-more"><div class="kv"><span class="k">Antrag stellt</span>${seg([['ich', 'ich'], ['gl', 'Gliederung selbst']], f.durch, `data-p="durch" ${a}`, 'small')}</div>
        ${f.status === 'zugesagt' ? `<div class="kv"><span class="k">beantragt waren</span>${nin(f, 'betrag', a + ' aria-label="beantragter Betrag"')}<span class="unit">€</span></div>` : ''}</div></div>
    <div class="det-o"><h4>Eigene Angaben und Recherche</h4><div class="grid own-grid">${OWN_FIELDS.map(([k, l]) => fld(l, area(k) ? tarea(f, k, a + ` aria-label="${l}"`) : tin(f, k, a + ` aria-label="${l}"`), area(k) ? 'wide' : '')).join('')}</div></div></div>`;
}
const AMT_LAB = { geplant: 'Erwartete Summe', vorb: 'Erwartete Summe', beantragt: 'Beantragte Summe', zugesagt: 'Zugesagte Summe', abgelehnt: 'Beantragt (abgelehnt)' };
const pct = (v, S) => S ? Math.round(v / S * 100) + ' %' : '';
function foeShare(b, f) {
  const S = +b.summe || 0, v = f.status === 'abgelehnt' ? 0 : foeAmt(f);
  return S ? pct(v, S) : '';
}
function geldBlock(f) {
  const a = `data-fid="${f.id}"`;
  if (UI.geld === f.id) return `<div class="geld form"><label>Betrag<span class="row"><input id="geld-betrag" type="text" inputmode="decimal" class="num" value="${esc(fmtNum(f.eingegangen ?? f.zugesagt ?? f.betrag))}"><span class="unit">€</span></span></label>
      <label>eingegangen am<input id="geld-datum" type="date" value="${esc(f.eingangAm || today())}"></label><div class="row"><button class="primary" data-act="geld-ok" ${a}>Bestätigen</button><button data-act="geld-no">Abbrechen</button></div>
      ${f.eingegangen > 0 ? `<button class="link small" data-act="geld-undo" ${a}>Eingang zurücknehmen</button>` : ''}</div>`;
  if (f.eingegangen > 0) return `<div class="geld ok">✓ ${eur(f.eingegangen)} eingegangen<br>am ${fmtDate(f.eingangAm) || '–'} <button class="link small" data-act="geld" ${a}>ändern</button></div>`;
  return `<div class="geld"><button class="primary small" data-act="geld" ${a}>Geldeingang bestätigen</button></div>`;
}
// Fristen je Stand, jeweils Bezeichnung über dem Datum
function fpDates(f) {
  const d = (lab, p) => `<label class="fp-d"><span>${lab}:</span><input type="text" class="inline date dfeld" data-dp="${p}" data-fid="${f.id}" value="${esc(fmtDate(f[p]))}" placeholder="tt.mm.jjjj" aria-label="${lab}" autocomplete="off"></label>`;
  return ({ geplant: d('Antragsfrist', 'frist'), vorb: d('Antragsfrist', 'frist'), beantragt: d('beantragt am', 'beantragtAm') + d('Antwort erwartet', 'erwartet'),
    zugesagt: d('zugesagt am', 'entscheidungAm'), abgelehnt: d('abgelehnt am', 'entscheidungAm') })[f.status];
}
// Einschätzung: fünf kleine Punkte, die sich von rechts füllen – der rechte allein ist „sehr unwahrscheinlich“, alle fünf „sehr wahrscheinlich“
function dots(f) {
  const lv = LVL.indexOf(f.einsch) + 1, lab = lv ? EINSCH.find(e => e[0] === f.einsch)[1] : 'noch keine Einschätzung';
  return `<div class="dots-box"><div class="dots lv${lv}" role="group" aria-label="Einschätzung: ${esc(lab)}">`
    + [5, 4, 3, 2, 1].map(n => { const k = LVL[n - 1], l = EINSCH.find(e => e[0] === k)[1]; return `<button class="dot${n <= lv ? ' on' : ''}" data-act="set" data-p="einsch" data-v="${k}" data-toggle="" data-fid="${f.id}" title="${l}" aria-label="${l}" aria-pressed="${n === lv}"></button>`; }).join('')
    + `</div><span class="dots-t">${esc(lab)}</span></div>`;
}
// je Förderer eine kompakte Kachel: Name mit Stift und Löschen, Einschätzung; groß die Summe mit Anteil; Stand mit Datum; Pro und Contra je eine Zeile; unten Kontakt
function fpCard(b, f) {
  const a = `data-fid="${f.id}"`, st = f.status, open = !!UI.open['det-' + f.id], amtP = st === 'zugesagt' ? 'zugesagt' : 'betrag';
  return `<article class="card fp fk st-${st}${open ? ' open' : ''}" id="foe-${f.id}">
    <div class="fk-top">
      <div class="fk-kopf">
        <div class="fp-title"><input type="text" class="inline fp-h" data-p="name" ${a} value="${esc(f.name)}" placeholder="Förderer" aria-label="Förderer" autocomplete="off">
          <button class="rm" data-act="rm-foe" ${a} title="Förderer entfernen" aria-label="Förderer entfernen">${ICON_TRASH}</button><span id="fw-${f.id}">${foeWarn(b, f)}</span></div>
        <div class="fk-amt"><input type="text" inputmode="decimal" class="inline num amt" data-num data-p="${amtP}" ${a} id="amt-${f.id}" value="${esc(fmtNum(st === 'zugesagt' ? f.zugesagt : f.betrag))}" placeholder="0" aria-label="${AMT_LAB[st]}" title="${AMT_LAB[st]}"><span class="unit">€</span></div>
      </div>
      ${dots(f)}
    </div>
    <div class="fk-st"><button class="st-btn s-${st}" data-act="st-menu" ${a} aria-label="Stand: ${F_ST_L[st]} – ändern">${F_ST_L[st]} <span aria-hidden="true">▾</span></button><div class="fp-dates">${fpDates(f)}</div></div>
    ${st === 'zugesagt' ? `<div class="fk-geld">${geldBlock(f)}</div>` : ''}
    <div class="pc">
      <label class="pro" title="Pro: warum passt das?"><i></i>${tarea(f, 'warum', a + ' rows="1" aria-label="Pro – warum passt das"', 'Pro: Warum passt das? Satzungszweck, Förderschwerpunkt, Regionalbezug …')}</label>
      <label class="contra" title="Contra: wo hakt es?"><i></i>${tarea(f, 'knackpunkte', a + ' rows="1" aria-label="Contra – Knackpunkte"', 'Contra: Wo hakt es? Worauf muss der Antrag den Fokus legen?')}</label>
    </div>
    <div class="det">
      <button class="det-btn" data-act="det" data-v="${f.id}" aria-expanded="${open}"><span class="tw">${open ? '▾' : '▸'}</span><span class="ds" id="ds-${f.id}">${detSummary(f)}</span></button>
      ${open ? detPanel(b, f) : ''}
    </div>
  </article>`;
}
// Stand eines Förderers wählen: kleines Menü am Knopf
function stMenu(btn) {
  closeMenus();
  const b = cur(), f = b && b.foerderer.find(x => x.id === btn.dataset.fid); if (!f) return;
  const m = h('div', { class: 'menu st-pop', role: 'menu' }, F_ST.map(([v, l]) =>
    h('button', { role: 'menuitem', class: v === f.status ? 'on' : '', 'data-act': 'set', 'data-p': 'status', 'data-fid': f.id, 'data-v': v, html: `<span class="st-btn s-${v}">${l}</span>` })));
  placePop(m, btn);
  (m.querySelector('button.on') || m.querySelector('button')).focus();
}
/* ---------- Übersicht oben im Förderplan: Tabelle (Gesamtbedarf, Förderer nach Stand, Delta, Eigenmittel) und daneben ein Kreisdiagramm.
   Die Tabelle ist zugleich die Legende: jede Zeile trägt das Farbfeld ihres Kreisstücks. */
const ROW_CLS = { zugesagt: 'r-zu', beantragt: 'r-be', vorb: 'r-ge', geplant: 'r-ge', abgelehnt: 'r-ab' };
const segKind = f => f.status === 'zugesagt' ? 'zu' : f.status === 'beantragt' ? 'be' : f.status === 'abgelehnt' ? 'none' : 'ge';
const swa = k => `<i class="swa ${k}" aria-hidden="true"></i>`;
const PIE = [['zu', 'zugesagt'], ['eig', 'Eigenmittel'], ['be', 'beantragt'], ['ge', 'nicht beantragt'], ['off', 'Delta, noch ohne Förderer']];
function finPie(b) {
  const F = finState(b), sum = {}, wer = {};
  for (const f of F.fs) {
    const k = segKind(f), v = foeAmt(f);
    if (k === 'none' || !(v > 0) || (F.done && k !== 'zu')) continue;               // steht die Finanzierung, zählen nur noch Zusagen
    sum[k] = (sum[k] || 0) + v; (wer[k] = wer[k] || []).push(f.name || '(ohne Namen)');
  }
  if (F.eig > 0) sum.eig = F.eig;
  const tot = Object.values(sum).reduce((x, y) => x + y, 0), max = Math.max(F.S, tot);
  if (F.S > tot) sum.off = F.S - tot;
  if (!max) return '<svg class="pie" viewBox="0 0 100 100" aria-hidden="true"><circle class="ps off" cx="50" cy="50" r="48"/></svg>';
  let w = -Math.PI / 2;
  const pt = x => (50 + 48 * Math.cos(x)).toFixed(2) + ' ' + (50 + 48 * Math.sin(x)).toFixed(2);
  const slices = PIE.filter(([k]) => sum[k] > 0).map(([k, l]) => {
    const da = sum[k] / max * 2 * Math.PI, d = da > 2 * Math.PI - 1e-6 ? null : `M50 50L${pt(w)}A48 48 0 ${da > Math.PI ? 1 : 0} 1 ${pt(w + da)}Z`;
    w += da;
    const t = `<title>${esc(l + ': ' + eur(sum[k]) + ' (' + pct(sum[k], max) + ')' + (wer[k] ? ' – ' + wer[k].join(', ') : ''))}</title>`;
    return d ? `<path class="ps ${k}" d="${d}">${t}</path>` : `<circle class="ps ${k}" cx="50" cy="50" r="48">${t}</circle>`;
  });
  return `<svg class="pie" viewBox="0 0 100 100" role="img" aria-label="${esc(finText(b))}"><defs><pattern id="pie-ge" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<rect width="5" height="5" style="fill:var(--card)"/><rect width="2.6" height="5" style="fill:var(--f-ge)"/></pattern></defs>${slices.join('')}</svg>`;
}
function finRows(b) {
  const S = +b.summe || 0, F = finState(b);
  return `<tr class="r-sum"><th>${swa('none')}Gesamtbedarf</th><td class="num">${S ? eur(S) : '–'}</td><td class="num">${S ? '100 %' : ''}</td></tr>`
    + b.foerderer.filter(f => f.name.trim() || f.betrag).map(f => { const v = foeAmt(f);
      return `<tr class="${ROW_CLS[f.status]}"><th>${swa(segKind(f))}${esc(f.name || '(ohne Namen)')} <span class="r-st">${F_ST_L[f.status]}${f.status === 'zugesagt' && f.eingegangen > 0 ? ', eingegangen' : ''}</span></th><td class="num">${eur(v)}</td><td class="num">${f.status === 'abgelehnt' ? '' : pct(v, S)}</td></tr>`; }).join('')
    + (F.d ? `<tr class="r-delta"><th>${swa(F.d > 0 ? 'off' : 'none')}${F.d > 0 ? 'Delta <span class="r-st">noch ohne Förderer</span>' : 'Überfinanzierung'}</th><td class="num">${eur(Math.abs(F.d))}</td><td class="num">${pct(Math.abs(F.d), S)}</td></tr>` : '');
}
const finEigPct = b => pct(+b.eigenanteil || 0, +b.summe || 0);
function secFoe(b) {
  return `<section class="card fp-head" id="sec-foe">
    <div class="sec-head"><h2>Förderplan</h2>
      <div class="sec-tools"><button class="icon-btn" data-act="vorlage" aria-label="Excel-Vorlage für die KI-Recherche herunterladen" title="Excel-Vorlage für die KI-Recherche herunterladen – mit Bedarf, bisherigem Förderplan und Anleitung">${ICON_DOWN}</button>
        <button class="icon-btn" data-act="import" aria-label="Ausgefüllte Recherche-Excel übernehmen" title="Ausgefüllte Recherche-Excel übernehmen – neue Förderer kommen dazu, vorhandene werden ergänzt">${ICON_UP}</button></div></div>
    <div class="fin-wrap">
    <table class="fsum"><tbody id="fin-rows">${finRows(b)}</tbody>
      <tbody><tr class="r-eig"><th>${swa('eig')}Eigenmittel <span class="r-st">aus Mitteln der Gliederung oder der Diözese</span></th><td class="num"><span class="row nowrap"><input type="text" inputmode="decimal" class="inline num eig" data-num data-p="eigenanteil" value="${esc(fmtNum(b.eigenanteil))}" placeholder="0" aria-label="Eigenmittel in Euro"><span class="unit">€</span></span></td><td class="num" id="fin-eig">${finEigPct(b)}</td></tr></tbody></table>
    <div id="fin-pie" class="fin-pie">${finPie(b)}</div></div>
  </section>
  <div class="fk-grid">${b.foerderer.map(f => fpCard(b, f)).join('')}<button class="fk-neu" data-act="add-foe" title="Förderer hinzufügen – viele auf einmal über die Recherche-Excel (Symbol oben rechts im Förderplan)"><span class="fk-plus" aria-hidden="true">+</span>Förderer hinzufügen</button></div>`;
}

/* ---------- Nacharbeit: Übergabe und Pressemitteilung einmal je Bedarf, Verwendungsnachweis (Sach- und Finanzbericht) je Förderer */
function nachLine(f) {
  const a = `data-fid="${f.id}"`, x = f.vn;
  return `<div class="nl ${x.noetig && x.st !== 'erledigt' ? 'open' : ''}">${cbx(f, 'vn.noetig', 'Verwendungsnachweis', a)}${x.noetig ? `<label class="inl">Frist ${din(f, 'vn.frist', a + ' aria-label="Frist Verwendungsnachweis"')}</label>${seg(VN_ST, x.st, `data-p="vn.st" ${a}`, 'small')}` : '<span class="muted small">nicht nötig</span>'}</div>`;
}
function nachBody(b) {
  const zu = b.foerderer.filter(f => f.status === 'zugesagt'), cand = b.foerderer.filter(f => f.status !== 'abgelehnt' && f.name.trim()), n = b.nach;
  return `<div class="grid two">
    <div><h3>Gemeinsam für den Bedarf</h3>
      <div class="na-block"><div class="na-head">${cbx(b, 'nach.ueb.noetig', 'Spendenübergabe')}${n.ueb.noetig ? seg([['offen', 'offen'], ['terminiert', 'terminiert', 't-run'], ['erledigt', 'erledigt', 't-ok']], n.ueb.st, 'data-p="nach.ueb.st"', 'small') : ''}</div>
        ${n.ueb.noetig ? `<div class="grid2">${fld('Termin', `<span class="row nowrap">${din(b, 'nach.ueb.termin', 'aria-label="Termin der Spendenübergabe"')}<input type="time" data-p="nach.ueb.zeit" value="${esc(n.ueb.zeit)}" aria-label="Uhrzeit der Spendenübergabe"></span>`)}${fld('Ort', tin(b, 'nach.ueb.ort', 'aria-label="Ort der Spendenübergabe"', 'z. B. Wache, Rathaus'))}</div>
          ${fld('Notizen', tarea(b, 'nach.ueb.info', 'aria-label="Notizen zur Spendenübergabe"', 'z. B. warum es noch dauert: Küche wird erst im November eingebaut, Übergabe danach mit Fotos'))}
          ${fld('Wer ist dabei?', `<div class="mit">${cand.length ? cand.map(f => `<label class="check"><input type="checkbox" data-act="mit" data-fid="${f.id}" ${n.ueb.mit.includes(f.id) ? 'checked' : ''}> ${esc(f.name)} <span class="muted small">${F_ST_L[f.status]}</span></label>`).join('') : '<span class="muted small">Noch keine Förderer im Förderplan</span>'}</div>`)}` : ''}
      </div>
      <div class="na-block"><div class="na-head">${cbx(b, 'nach.pm.noetig', 'Pressemitteilung')}${n.pm.noetig ? seg([['offen', 'offen'], ['arbeit', 'in Arbeit', 't-warn'], ['veroeff', 'veröffentlicht', 't-ok']], n.pm.st, 'data-p="nach.pm.st"', 'small') : ''}</div>
        ${n.pm.noetig && n.pm.st === 'veroeff' ? `<div class="grid2">${fld('veröffentlicht am', din(b, 'nach.pm.datum', 'aria-label="Pressemitteilung veröffentlicht am"'))}</div>` : ''}
      </div>
    </div>
    <div><h3>Je Förderer</h3>
      ${zu.length ? zu.map(f => `<div class="na-block"><div class="na-title">${esc(f.name || '(ohne Namen)')}</div>${nachLine(f)}</div>`).join('') : '<div class="empty small">Erscheint, sobald eine Förderung zugesagt ist.</div>'}
    </div>
  </div>`;
}
function secNach(b) {
  return `<section class="card" id="sec-nach"><div class="sec-head"><h2>Nacharbeit</h2><p>Spendenübergabe und Pressemitteilung einmal für den ganzen Bedarf, der Verwendungsnachweis (Sach- und Finanzbericht) je Förderer.</p></div>
    <div id="nach-body">${nachBody(b)}</div></section>`;
}
