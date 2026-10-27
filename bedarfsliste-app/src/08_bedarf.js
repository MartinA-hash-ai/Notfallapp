/* ===================================================================== Seite eines Bedarfs
   Kopf: Name und Gliederung direkt änderbar, rechts die Summe, das Copilot-Zeichen (11_copilot.js) und „⋯“ (zurückstellen, archivieren, löschen); Phase und Stand hängen an der Kopfzeile.
   Links Zuständig/Deadline/Stichwort/Beschreibung, der Förderplan (Übersicht, dann je Förderer eine Karte) und die Nacharbeit; rechts Freigaben, Unterlagen und Ordner.
   Eingabefelder tragen data-p (Pfad im Bedarf), bei Förderern zusätzlich data-fid, bei Unterlagen data-uid.
   Tippen ändert nur die Daten und zeichnet abgeleitete Teile neu (refresh); Knöpfe und Auswahlfelder zeichnen die Seite neu. */

const fld = (lab, inner, cls = '', info = '') => `<div class="fld ${cls}"><span class="lab">${lab}${info ? ' ' + infoBtn(info) : ''}</span>${inner}</div>`;
const tin = (o, p, x = '', ph = '') => `<input type="text" data-p="${p}" ${x} value="${esc(getPath(o, p) ?? '')}" placeholder="${esc(ph)}">`;
const nin = (o, p, x = '', ph = '0') => `<input type="text" inputmode="decimal" class="num" data-num data-p="${p}" ${x} value="${esc(fmtNum(getPath(o, p)))}" placeholder="${esc(ph)}">`;
// Datum und Uhrzeit: Textfeld mit dem eigenen Kalender bzw. den Rädern der Uhrzeit (wie in der Liste) – tippen geht auch (05.10.2026, 1530)
const dfeld = (o, p, x = '', cls = '') => `<input type="text" class="dfeld${cls ? ' ' + cls : ''}" data-dp="${p}" ${x} value="${esc(fmtDate(getPath(o, p)))}" placeholder="tt.mm.jjjj" autocomplete="off">`;
const zfeld = (o, p, x = '') => `<input type="text" class="zfeld" data-zp="${p}" ${x} value="${esc(getPath(o, p) || '')}" placeholder="hh:mm" inputmode="numeric" autocomplete="off">`;
const tarea = (o, p, x = '', ph = '', rows = 2) => `<textarea data-p="${p}" ${x} rows="${rows}" placeholder="${esc(ph)}">${esc(getPath(o, p) ?? '')}</textarea>`;
const cbx = (o, p, lab, x = '') => `<label class="check"><input type="checkbox" data-p="${p}" ${x} ${getPath(o, p) ? 'checked' : ''}> ${lab}</label>`;
const seg = (opts, cur, attrs, cls = '') => `<div class="seg ${cls}" role="group">` + opts.map(([v, l, tone]) =>
  `<button type="button" class="${v === cur ? 'on ' + (tone || '') : ''}" data-act="set" data-v="${esc(v)}" ${attrs} aria-pressed="${v === cur}">${l}</button>`).join('') + '</div>';
const dl = (id, vals) => `<datalist id="${id}">${uniq(vals).map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
const INFO = {
  ordner: 'Den Ordner in SharePoint im Browser öffnen und die Adresse aus der Adresszeile hier einfügen – „Öffnen“ zeigt ihn dann im Browser, Word-Dateien gehen von dort in der Desktop-App auf. Aus so einem Link merkt sich die Liste, wo „Ortsgliederungen“ in SharePoint liegt, und baut die Links für die Ordner, die Cowork oder Copilot finden, selbst.',
  deadline: 'Bis wann der Bedarf gedeckt sein muss. Ohne Deadline steht in der Liste blass „ohne Deadline“.',
  stichwort: 'Bedarfe mit demselben Stichwort – zum Beispiel einem Fördertopf – lassen sich in der Liste zusammen filtern. Ein Bedarf kann mehrere Stichworte haben: eintippen, Enter, das nächste.',
  recherche: 'Die Excel enthält den Bedarf (Beschreibung, Summe, Gliederung) und den bisherigen Förderplan. Im Blatt „Anleitung“ steht, was in jede Spalte gehört – so kann eine KI sie direkt als Vorlage für die Förderrecherche nehmen. Die ausgefüllte Datei hier wieder übernehmen: neue Förderer kommen dazu, vorhandene werden ergänzt.',
  freigabe: 'Kreis anklicken, um den Stand zu ändern: gelb = angefragt, grün = zugestimmt, rot = abgelehnt. Ortsführungskreis immer, Fachreferat und Verwaltung ab 1.000 € – darunter nur, wenn sie angefragt wurden.',
};
const infoBtn = k => `<button class="info" data-act="info" data-v="${k}" aria-label="Hinweis anzeigen" title="Hinweis">i</button>`;
const okLink = s => /^https?:\/\//i.test((s || '').trim());
// Ordner bekannt (von Cowork), aber noch kein Link: die Liste kennt die SharePoint-Adresse noch nicht
// Freigabelink („/:f:/s/…“): öffnet den Ordner, verrät aber nicht, wo er liegt – Cowork findet ihn darüber nicht
const linkHinweis = b => okLink(b.link) && /\/:[a-z]:\/[sgu]\//i.test(b.link) && !(b.pfad || '').trim() ? '<p class="muted small o-hw">Freigabelink: öffnet den Ordner, aber Cowork findet ihn darüber nicht. Besser in SharePoint die Adresse aus der Adresszeile oder einen Link mit „/:f:/r/“ einfügen.</p>' : '';
const linkBtn = b => okLink(b.link) ? `<a class="btn" href="${esc(b.link.trim())}" target="_blank" rel="noopener" data-act="link">Öffnen ↗</a>` : `<span class="btn disabled" aria-disabled="true" title="Erst einen Link einfügen (https://…)">Öffnen ↗</span>`;
// unter dem Namen: die Deadline (Klick öffnet den Kalender); wann der Bedarf angelegt wurde, steht im Hinweis
const metaRest = b => `<button class="d-dl${b.deadline ? '' : ' leer'}" data-act="deadline" title="Deadline ändern${b.angelegt ? ' · angelegt am ' + fmtDate(b.angelegt) : ''}">Deadline: <b>${b.deadline ? fmtDate(b.deadline) : 'keine'}</b></button>`;
// Stichworte oben neben dem Namen: Marken mit ×, dahinter ein kleines + (beim Überfahren „Stichworte oder Fördertöpfe“)
const swHead = b => b.stichworte.map((s, i) => `<span class="pchip">${esc(s)}<button class="x" data-act="sw-weg" data-i="${i}" aria-label="${esc(s)} entfernen" title="entfernen">×</button></span>`).join('')
  + `<button class="sw-plus" data-act="sw-pop" data-tip="Stichworte oder Fördertöpfe" aria-label="Stichwort oder Fördertopf hinzufügen">+</button>`;
const ICON_TRASH = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-.9 11.1A2 2 0 0 1 15.1 22H8.9a2 2 0 0 1-2-1.9L6 9zm4 2v8h1.6v-8H10zm2.4 0v8H14v-8h-1.6z"/></svg>';
const ICON_UP = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M11 20h2v-9.2l3.6 3.6 1.4-1.4-6-6-6 6 1.4 1.4 3.6-3.6V20zM5 4h14v2H5V4z"/></svg>';
const ICON_PEN = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M4 17.2V20h2.8L17.3 9.5l-2.8-2.8L4 17.2zm15.7-10.1a1 1 0 0 0 0-1.4l-1.4-1.4a1 1 0 0 0-1.4 0l-1.2 1.2 2.8 2.8 1.2-1.2z"/></svg>';

const stText = p => (p.step < 0 ? p.t : p.t + (p.sub ? ': ' + p.sub : '')) + p.warn.map(w => ' · ⚠ ' + w).join('');
function steps(b) {
  const p = phase(b);
  if (p.step < 0) return `<div class="steps" title="${esc(stText(p))}"><span class="phase ph-pause">${esc(p.t)}</span></div>`;
  return `<ol class="steps" title="${esc(stText(p))}">` + PHASES.map((s, i) => { const done = p.step > i || p.step === 3;
    return `<li class="${done ? 'done' : p.step === i ? 'cur ' + PH_CLS[i] : ''}"><span class="st-k">${done ? ICO.ok : i + 1}</span>${s.t}</li>`; }).join('') + '</ol>';
}

function bedarfView(b) {
  return `<main class="bedarf">
    ${KI_NEU[b.id] ? '<div class="d-flag ki-flag"><span class="ki-ico-s">' + ICON_KI + '</span>Cowork hat Ergebnisse in die Arbeits-Excel geschrieben – noch nicht übernommen. <button class="primary" data-act="ki-erg">Ansehen und übernehmen</button></div>' : ''}
    ${b.archiv ? '<div class="d-flag">Dieser Bedarf liegt im Archiv. <button class="link" data-act="unarchive">Zurück in die Liste holen</button></div>' : ''}
    <div class="d-grid">
    <div class="d-head">
      <button class="star-p d-star${b.prio === 'hoch' ? ' on' : ''}" data-act="prio-stern" aria-pressed="${b.prio === 'hoch'}" title="${b.prio === 'hoch' ? 'Prio – klicken: keine Prio' : 'keine Prio – klicken: Prio'}" aria-label="Priorität">${ICON_STERN}</button>
      <div class="d-name">
        <textarea class="inline title" id="f-titel" data-p="titel" rows="1" placeholder="Bedarf" aria-label="Bedarf">${esc(b.titel)}</textarea>
        <div class="d-sub"><input type="text" class="inline gl" data-p="gliederung" list="dl-gl" value="${esc(b.gliederung)}" placeholder="Gliederung (Ort oder Diözese)" aria-label="Gliederung"><span class="muted" id="d-meta">${metaRest(b)}</span></div>
      </div>
      <div class="d-sw" id="d-sw">${swHead(b)}</div>
      <div class="d-right-head">
        <div class="sum-line"><input type="text" inputmode="decimal" class="inline num sum" data-num data-p="summe" value="${esc(fmtNum(b.summe))}" placeholder="Summe" aria-label="Summe in Euro"><span class="unit">€</span></div>
      </div>
    </div>
    <div class="d-actions">
      <button class="icon-btn ki-btn${KI_NEU[b.id] ? ' neu' : ''}" data-act="ki" aria-label="Mit Copilot oder Cowork weiterarbeiten" title="${KI_NEU[b.id] ? 'Ergebnis von Copilot oder Cowork liegt vor – ansehen' : 'Mit Copilot oder Cowork weiterarbeiten'}">${ICON_KI}</button>
      <button class="icon-btn" data-act="more" aria-label="Weitere Aktionen: zurückstellen, archivieren, löschen" title="Zurückstellen, verwerfen, archivieren, löschen">⋯</button>
    </div>
    <div class="d-left">${secInfo(b)}${secFoe(b)}${secNach(b)}</div>
    <aside class="d-right">${sidePanel(b)}</aside>
    </div>
    ${UI.det ? foePop(b) : ''}
    ${dl('dl-gl', [DIO, ...GL_LIST, ...D.bedarfe.map(x => x.gliederung)])}
  </main>`;
}
// Menü hinter „⋯“: zurückstellen, verwerfen, wieder aufnehmen, archivieren, löschen
function moreMenu(btn) {
  closeMenus();
  const b = cur(); if (!b) return;
  const item = (act, label, v, cls) => h('button', { role: 'menuitem', class: cls || null, 'data-act': act, 'data-p': v != null ? 'manuell' : null, 'data-v': v != null ? v : null }, label);
  const m = h('div', { class: 'menu', id: 'mmenu', role: 'menu' },
    b.manuell ? item('set', 'Wieder aufnehmen', '') : null,
    b.manuell !== 'zurückgestellt' ? item('set', 'Zurückstellen', 'zurückgestellt') : null,
    b.manuell !== 'verworfen' ? item('set', 'Verwerfen', 'verworfen') : null,
    h('hr'),
    b.archiv ? item('unarchive', 'Aus dem Archiv holen') : item('archive', 'Archivieren'),
    h('hr'),
    h('button', { role: 'menuitem', class: 'gefahr', 'data-act': 'del', html: ICON_TRASH + '<span>Bedarf löschen …</span>' }));
  placePop(m, btn, 'right');
  m.querySelector('button').focus();
}

/* ---------- Zuständig, Deadline, Stichwort, Beschreibung */
// oben: links nur die Zuständigen (je Zeile zwei, wie die Kontakte im Förderer-Fenster), rechts die Beschreibung (die ganze Fläche ist anklickbar).
// Deadline und Stichworte stehen im Kopf der Seite. Keine Eingabefelder – Angaben anklicken und ändern, die Zuständigen über den Stift.
function secInfo(b) {
  const ed = UI.zEdit === b.id;
  const pl = `<button class="k-pliste" data-act="pers-liste" title="Personenliste bearbeiten: Personen der Gliederungen und Fachreferate (Dienstleitung, Geschäftsführung, Beauftragte …) mit Kontaktdaten">Personenliste</button>`;
  return `<section class="card info-card eck" id="sec-eck">
    <div class="eck-l">${kKopf('Zuständig', ed, '', pl)}<div id="zust-liste">${zustListe(b)}</div><div id="fach-pers">${fachBlock(b)}</div></div>
    <div class="eck-r">${pe(b, 'beschreibung', 'Beschreibung ' + FMT_I, 'area', { aria: 'Beschreibung', fmt: true, ph: 'Kurzbeschreibung aus der UPL oder in eigenen Worten' })}</div>
  </section>`;
}

/* ---------- Rechts: Freigaben, Unterlagen, Ordner – je Punkt ein Kreis (grün ✓, gelb …, rot ✗); ein Klick darauf bietet die anderen Stände an */
const CIRC_SYM = { ok: ICO.ok, run: ICO.run, no: ICO.no, off: '', na: ICO.na };
const circ = (kind, attrs, label) => `<button class="circ c-${kind}" data-act="circ" ${attrs} aria-label="${esc(label)} – nächster Stand" title="Klicken: nächster Stand">${CIRC_SYM[kind]}</button>`;
const frKind = i => i.na ? 'na' : ({ ok: 'ok', angefragt: 'run', nein: 'no', offen: 'off' })[i.st];
const ulKind = u => ({ da: 'ok', arbeit: 'run', fehlt: 'no', nn: 'na' })[u.st] || 'no';
function freigabeList(b) {
  const rows = frItems(b).map(i => {
    const p = 'freigabe.' + i.k;
    const name = i.k === 'fach' ? `<span class="fr-fach"><span class="ci-n">Fachreferat</span><input type="text" class="inline fr-name" data-p="${p}.name" list="dl-fach" value="${esc(i.item.name)}" placeholder="welches?" title="Welches Fachreferat" aria-label="Welches Fachreferat"></span>`
      : `<span class="ci-n" title="${esc(i.label)}">${i.k === 'verw' ? 'Verwaltung' : esc(i.label)}</span>`;
    const hint = i.na ? 'entfällt' : i.opt && i.st === 'offen' ? 'nicht nötig' : i.st === 'offen' ? 'noch nicht angefragt' : '';
    const since = i.st === 'angefragt' && validIso(i.item.angefragt) ? 'angefragt am ' + fmtDate(i.item.angefragt) + ', seit ' + days(i.item.angefragt, today()) + ' Tagen' : 'angefragt am';
    const date = !i.na && (i.st === 'angefragt' || i.st === 'nein') ? dfeld(b, p + '.angefragt', `aria-label="angefragt am" title="${esc(since)}"`, 'inline date') : '';
    return `<div class="ci-row" id="fr-${i.k}">${i.na ? `<span class="circ c-na" aria-hidden="true">${ICO.na}</span>` : circ(frKind(i), `data-kind="fr" data-k="${i.k}"`, i.label)}
      <div class="ci-t">${name}${hint ? `<span class="ci-hint">${hint}</span>` : ''}</div>${date}</div>`;
  }).join('');
  const fo = frOffen(b);
  return rows + (fo.names.length ? `<div class="ci-foot warn">Es fehlt noch: ${esc(fo.names.join(', '))}</div>` : '')
    + dl('dl-fach', [...fachNamen(), ...D.bedarfe.map(x => x.freigabe.fach.name)]);
}
function unterlagenList(b) {
  return b.unterlagen.map(u => `<div class="ci-row"${u.fest && u.name === 'Angebot' ? ' id="fr-ang"' : ''}>${circ(ulKind(u), `data-kind="ul" data-uid="${u.id}"`, u.name || 'Unterlage')}
      <div class="ci-t">${u.fest ? `<span class="ci-n">${esc(u.name)}</span>` : tin(u, 'name', `class="inline" data-uid="${u.id}" aria-label="Name der Unterlage"`, 'Unterlage')}<span class="ci-hint">${esc(ulText(u))}</span></div>
      ${u.fest ? '' : `<button class="x" data-act="rm-ul" data-uid="${u.id}" aria-label="${esc(u.name)} entfernen" title="entfernen">×</button>`}</div>`).join('')
    + `<div class="ci-row add"><span class="circ c-add" aria-hidden="true">+</span><input type="text" id="ul-new" class="inline" list="dl-ul" placeholder="weitere Unterlage" aria-label="Weitere Unterlage hinzufügen"></div>`
    + dl('dl-ul', ['Bilder', 'Presseartikel', 'Studien', 'Kostenplan', 'Zeitplan', 'Unterstützerschreiben'].filter(n => !b.unterlagen.some(u => u.name === n)));
}
function frBlock(b) {
  const ok = !frOffen(b).names.length;                    // alle nötigen Freigaben (das Angebot steht bei den Unterlagen)
  return `<div class="fr-blk${ok ? ' ok' : ''}"><h3>Freigaben${ok ? ' <span class="fr-ok">· alle vorhanden</span>' : ''} ${infoBtn('freigabe')}</h3><div id="fr-body" class="ci-list">${freigabeList(b)}</div></div>`;
}
function sidePanel(b) {
  return `<section class="card side" id="sec-frei">
    <div id="fr-blk">${frBlock(b)}</div>
    <h3>Unterlagen</h3><div id="ul-body" class="ci-list">${unterlagenList(b)}</div>
    <h3>Ordner ${infoBtn('ordner')}</h3>
    <div class="o-row"><span class="o-lab">OneDrive / SharePoint</span><div class="row">${tin(b, 'link', 'class="grow" aria-label="Link zum Ordner"', 'SharePoint-Link einfügen (https://…)')}<span id="link-btn">${linkBtn(b)}</span></div>
      <div id="link-hw">${linkHinweis(b)}</div></div>
  </section>`;
}
// Klick auf den Kreis: ein Stand weiter (Freigabe: offen → angefragt → zugestimmt → abgelehnt; Unterlage: fehlt → in Arbeit → vorhanden)
function circNext(btn) {
  const b = cur(); if (!b) return;
  if (btn.dataset.kind === 'fr') { const k = btn.dataset.k, it = b.freigabe[k], alt = it.st, v = nextOf(ROT_FR, alt); it.st = v; effects(b, b, 'freigabe.' + k + '.st', v, alt); }
  else { const u = b.unterlagen.find(x => x.id === btn.dataset.uid); if (!u) return; u.st = nextOf(u.fest && u.name === 'Angebot' ? ROT_ANG_A : ROT_ANG, u.st); }
  changed();
}

/* ---------- Förderplan: je Förderer eine Überschrift (Name), rechts groß die Summe mit Anteil, daneben der Stand mit Fristen, oben rechts die Einschätzung;
   darunter Pro und Contra, Kontakt und Details zum Aufklappen */
const F_ST = [['geplant', 'geplant'], ['beantragt', 'beantragt', 't-run'], ['zugesagt', 'zugesagt', 't-ok'], ['abgelehnt', 'abgelehnt', 't-err']];
const F_ST_L = Object.fromEntries(F_ST.map(([v, l]) => [v, l]));
const LVL = ['suw', 'uw', 'u', 'w', 'sw'];                 // Einschätzung als Punkte 1 (rot) … 5 (grün)
const artFromKartei = (k, name) => /stiftung/i.test(name) || /stift/i.test(k.blatt) ? 'Stiftung' : /sparkasse/i.test(name) ? 'Sparkasse' : /bank/i.test(name) ? 'Volksbank / Bank' : '';
// Hinweise am Förderer: k 'amt' (Zusage ohne Betrag) und 'kartei' (andere Gliederung laut Kartei) brauchen Aufmerksamkeit – rotes Dreieck,
// sie stehen auch oben im Feld der Hinweise; 'auch' (derselbe Förderer bei anderen Bedarfen) ist nur zur Kenntnis – graues Dreieck
function foeHinweise(b, f) {
  if (!f.name.trim()) return [];
  const k = kartei(f.name), L = [];
  if (f.status === 'zugesagt' && !foeAmt(f)) L.push({ k: 'amt', t: 'Zusage ohne Betrag – bitte die zugesagte Summe eintragen (bei einer Sachspende ihren Wert).' });
  if (k && b.gliederung && !istDio(b.gliederung) && k.gl.length && !k.gl.some(g => /^alle$/i.test(g)) && !k.gl.includes(b.gliederung)) L.push({ k: 'kartei', t: 'Laut Kartei zuständig für ' + esc(k.gl.join(', ')) });
  return L;
}
function foeWarnList(b, f) {
  if (!f.name.trim()) return [];
  const key = kkey(f.name), other = D.bedarfe.filter(x => x !== b && !x.archiv && x.foerderer.some(g => kkey(g.name) === key && g.status !== 'abgelehnt'));
  const L = foeHinweise(b, f).map(x => x.t);
  if (other.length) L.push('Auch im Förderplan von: ' + other.map(x => `<button class="link" data-act="open" data-id="${x.id}">${esc(x.titel || '(ohne Namen)')}</button> (${F_ST_L[x.foerderer.find(g => kkey(g.name) === key).status]})`).join(', '));
  return L;
}
const foeWarn = (b, f) => !foeWarnList(b, f).length ? '' : `<button class="fw-tri${foeHinweise(b, f).length ? '' : ' grau'}" data-act="fw" data-fid="${f.id}" aria-label="Hinweise anzeigen">${ICON_TRI}</button>`;
function fwPop(btn) {
  closeMenus();
  const b = cur(), f = b && b.foerderer.find(x => x.id === btn.dataset.fid); if (!f) return;
  const m = h('div', { class: 'menu info-pop fw-pop', role: 'tooltip', 'data-fid': f.id, html: foeWarnList(b, f).map(t => `<div>${t}</div>`).join('') });
  placePop(m, btn);
}
// Fuß der Kachel: links die Hauptansprechperson (ohne Person, z. B. bei einem Portal: die Website), daneben Telefon und E-Mail als Symbole
// (beim Überfahren steht dran, was dahinter ist; Klick ruft an bzw. schreibt); rechts „Weitere Infos →“ öffnet das Fenster
function fussKontakt(f) {
  const k = kartei(f.name), kk = k && k.kontakte[0], hk = f.kontakte[0] || (kk ? { n: kk.n, rolle: '', mail: kk.m, tel: kk.t } : null);
  const web = webUrl(f.web || (k && k.web) || ''), tel = hk && telNr(hk.tel);
  const name = hk && (hk.n || hk.rolle) ? `<span class="ff-n">${esc(hk.n || hk.rolle)}</span>`
    : web ? `<a class="ff-n" href="${esc(web)}" target="_blank" rel="noopener" data-act="link">${esc(/portal/i.test(f.weg) ? 'Portal: ' : '')}${esc(kurzUrl(web).split('/')[0])}</a>` : '<span class="ff-n leer">kein Kontakt</span>';
  const sym = [tel && `<a class="fi" href="tel:${tel}" data-act="link" data-tip="${esc(hk.tel)}" aria-label="Anrufen: ${esc(hk.tel)}">☎</a>`,
    hk && hk.mail && `<a class="fi" href="mailto:${esc(hk.mail)}" data-act="link" data-tip="${esc(hk.mail)}" aria-label="E-Mail an ${esc(hk.mail)}">✉</a>`].filter(Boolean).join('');
  return `${name}${sym}<button class="ff-mehr" data-act="det" data-v="${f.id}" aria-haspopup="dialog">Weitere Infos <span aria-hidden="true">→</span></button>`;
}
// Kontakt und Details eines Förderers als Fenster (Entwurf A „Steckbrief“): links der Kontakt, rechts die Bedingungen, darunter Quellen und Notizen.
// Keine Eingabefelder: die Angaben stehen als Text da, ein Klick macht sie bearbeitbar (Enter bzw. Klick daneben übernimmt, Esc verwirft).
// Feste Höhe; was nicht passt, scrollt im Fenster.
const telNr = t => String(t || '').replace(/[^\d+]/g, '');
const webUrl = u => { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : /^www\.|^[\w-]+\.[a-z]{2,}(\/|$)/i.test(u) ? 'https://' + u : ''; };
const kurzUrl = u => String(u).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
function quellenListe(t) {
  const L = quellenZeilen(t); if (!L.length) return '';
  return L.map(z => { const u = (z.match(/https?:\/\/\S+/) || [])[0];
    return u ? `<a href="${esc(u)}" target="_blank" rel="noopener" data-act="link" title="${esc(u)}">${esc(z === u ? kurzUrl(u).slice(0, 90) : z)}</a>` : `<span>${esc(z)}</span>`; }).join('');
}
const FX = { web: ['web', '↗', 'Seite öffnen'] };
// eine Angabe zum Anklicken: art 'line' (eine Zeile), 'area' (mehrere Zeilen), 'num' (Betrag); fx: Knopf zum Schreiben, Anrufen, Öffnen
// f: ein Förderer (mit data-fid) oder der Bedarf selbst; o.fmt: Text mit Formatierung, o.sug: Vorschläge beim Tippen, o.aria: Name des Felds
function pe(f, k, lab, art = 'line', o = {}) {
  const v = getPath(f, k), leer = v == null || String(v).trim() === '';
  const shown = o.html != null ? o.html : art === 'num' ? (leer ? '' : eur(v)) : art === 'date' ? fmtDate(v) : o.fmt ? fmtText(v) : esc(k === 'web' ? kurzUrl(v || '') : v || '');
  const fx = o.fx && !leer ? `<button class="fx" data-act="${FX[o.fx][0]}" data-fid="${f.id}" title="${FX[o.fx][2]}" aria-label="${FX[o.fx][2]}">${FX[o.fx][1]}</button>` : '';
  return `<div class="pe${o.cls ? ' ' + o.cls : ''}" data-act="pe"${f.foerderer ? '' : ` data-fid="${f.id}"`} data-k="${k}" data-art="${art}" data-lab="${esc(o.aria || lab || o.ph || k)}"${o.fmt ? ' data-fmt="1"' : ''}${o.sug ? ` data-sug="${o.sug}"` : ''} title="Klicken zum Bearbeiten">`
    + (lab ? `<div class="lab">${lab}</div>` : '')
    + `<div class="val${leer ? ' leer' : ''}">${leer ? esc(o.ph || 'nicht eingetragen') : `<span class="pv${o.fmt ? ' fmt' : ''}">${shown}</span>${fx}`}</div>${ICON_PEN}</div>`;
}
// Kontakte eines Förderers und Zuständige eines Bedarfs sehen gleich aus: untereinander Name, Funktion, E-Mail und Telefon als Links,
// daneben Knöpfe; der Stern markiert den ersten (Hauptkontakt in der Kachel bzw. Ansprechperson in der Liste), ☆ macht einen anderen dazu.
// Bearbeiten (Stift oben rechts): schlichte Linien mit blassem Hinweis, untereinander (keine Kästen); „Fertig“ steht dann oben rechts.
// o: a – Attribute der Knöpfe (data-fid beim Förderer), p – Pfad der Liste, edit, wer, neu – Texte für +, haupt – Texte zum Stern, extra – Zeilen aus der Kartei,
// max – höchstens so viele, kompakt – E-Mail und Telefon nur als Hinweis an den Knöpfen (beim Überfahren), nicht als Zeilen
function personen(L, o) {
  const a = o.a || '', n = L.length, plus = t => !o.lesen && n < (o.max || MAX_KONTAKTE) ? `<button class="kadd" data-act="k-neu" ${a}><i>+</i>${t}</button>` : '';
  if (o.edit) {
    const linie = (i, p, ph) => `<input type="${p === 'mail' ? 'email' : p === 'tel' || p === 'mobil' ? 'tel' : 'text'}" class="k-li k-li-${p}" data-p="${o.p}.${i}.${p}" ${a} value="${esc(L[i][p] || '')}" placeholder="${ph}" aria-label="${ph}" autocomplete="off">`;
    return L.map((c, i) => `<div class="k-ed">${linie(i, 'n', 'Vorname Nachname')}${linie(i, 'rolle', 'Position')}${linie(i, 'mail', 'E-Mail-Adresse')}${linie(i, 'tel', 'Telefonnummer')}${o.mobil ? linie(i, 'mobil', 'Handynummer') : ''}
        <button class="x" data-act="k-weg" data-i="${i}" ${a} title="${o.wer} entfernen" aria-label="${o.wer} entfernen">×</button></div>`).join('') + plus(o.neu[0]);
  }
  const knopf = (href, sym, t, tip) => `<a class="kb" href="${esc(href)}" data-act="link" data-tip="${esc(tip)}" aria-label="${t}: ${esc(tip)}">${sym}</a>`;
  const zeile = (c, i, ausKartei) => {
    const tel = telNr(c.tel), mob = telNr(c.mobil || ''), links = o.kompakt ? '' : [c.mail && `<div><a href="mailto:${esc(c.mail)}" data-act="link">${esc(c.mail)}</a></div>`,
      tel && `<div><a href="tel:${tel}" data-act="link">${esc(c.tel)}</a></div>`, mob && `<div><a href="tel:${mob}" data-act="link">${esc(c.mobil)}</a></div>`].filter(Boolean).join('');
    const fk = o.fachStern != null && kkey(c.n), fs = fk && fk === o.fachStern;
    const stern = fk ? `<button class="star${fs ? '' : ' off'}" data-act="fach-stern" data-k="${esc(fk)}" title="${fs ? 'Hauptansprechperson im Fachreferat – noch einmal: zurücknehmen' : 'Zur Hauptansprechperson im Fachreferat machen'}" aria-pressed="${fs}">${fs ? '★' : '☆'}</button>`
      : ausKartei || o.lesen ? '' : i === 0 ? `<span class="star" title="${o.haupt[0]}">★</span>`
      : `<button class="star off" data-act="k-haupt" data-i="${i}" ${a} title="${o.haupt[1]}" aria-label="${o.haupt[1]}">☆</button>`;
    return `<div class="k1${ausKartei ? ' kartei' : ''}">${stern}<div class="kn">${esc(c.n || c.rolle || '(ohne Namen)')}${ausKartei ? ' <span class="badge k">Kartei</span>' : ''}</div>`
      + (c.n && c.rolle ? `<div class="kr">${esc(c.rolle)}</div>` : '') + (links ? `<div class="kl">${links}</div>` : '')
      + `<div class="acts">${c.mail ? knopf('mailto:' + c.mail, '✉', 'E-Mail schreiben', c.mail) : ''}${tel ? knopf('tel:' + tel, '☎', 'Anrufen', c.tel) : ''}${mob ? knopf('tel:' + mob, ICON_HANDY, 'Handy anrufen', c.mobil) : ''}</div></div>`;
  };
  return L.map((c, i) => zeile(c, i, false)).join('') + (o.extra || []).map(c => zeile(c, 0, true)).join('') + (o.lesen ? '' : plus(n ? o.neu[0] : o.neu[1]));
}
// Kontakte des Förderers (die aus der Förder-Kartei sind beim Eintragen schon übernommen – karteiFuellen)
function kontaktListe(f) {
  return personen(f.kontakte, { a: `data-fid="${f.id}"`, p: 'kontakte', edit: UI.kEdit === f.id, wer: 'Kontakt', neu: ['weiterer Kontakt', 'Kontakt eintragen'],
    haupt: ['Hauptkontakt – steht in der Kachel', 'Zum Hauptkontakt machen'] });
}
const ICON_HANDY = '<svg viewBox="0 0 12 16" width="10" height="14" aria-hidden="true"><rect x="1.5" y="1" width="9" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.8 12.3h2.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
// Fachreferat des Bedarfs (Name aus der Freigabe): alle Personen der Personenliste, die dazugehören – nur zum Ansehen und Kontaktieren
// Ist eine Auswahl getroffen (b.freigabe.fach.wahl: Schlüssel der Namen), stehen nur diese Personen da, die übrigen sind ausgeblendet;
// der Stift rechts neben der Überschrift öffnet die Auswahl: Karte anklicken schaltet sie an oder aus, keine = alle.
// Stern beim Fachreferat: Hauptansprechperson (b.freigabe.fach.stern) – steht vorn
const fachSternK = (b, L) => { const k = b.freigabe.fach.stern || ''; return k && L.some(p => kkey(p.n) === k) ? k : ''; };
const fachWahl = (b, L) => (b.freigabe.fach.wahl || []).filter(k => L.some(p => kkey(p.n) === k));
function fachBlock(b) {
  const name = b.freigabe.fach.name.trim(), L = fachPersonen(name), W = fachWahl(b, L), ed = UI.fachEdit === b.id && L.length > 0;
  const zeig0 = W.length ? L.filter(p => W.includes(kkey(p.n))) : L, weg = L.length - zeig0.length, sk = fachSternK(b, zeig0);
  const zeig = sk ? [...zeig0.filter(p => kkey(p.n) === sk), ...zeig0.filter(p => kkey(p.n) !== sk)] : zeig0;   // mit Stern: vorn
  const karte = p => { const on = W.includes(kkey(p.n));
    return `<button type="button" class="k1 fach-w${on ? ' on' : ''}" data-act="fach-wahl" data-k="${esc(kkey(p.n))}" aria-pressed="${on}"><span class="fw-h" aria-hidden="true">${on ? '✓' : ''}</span><div class="kn">${esc(p.n)}</div>${p.rolle ? `<div class="kr">${esc(p.rolle)}</div>` : ''}</button>`; };
  const inhalt = !name ? '<p class="muted small fach-hw">Welches Fachreferat? In der Freigabe beim Fachreferat den Namen eintragen.</p>'
    : !L.length ? `<p class="muted small fach-hw">Noch niemand mit dem Fachreferat „${esc(name)}“ in der Personenliste – dort in der Spalte „Fachreferat“ eintragen (Knopf „Personenliste“).</p>`
    : ed ? L.map(karte).join('') + '<p class="muted small fach-hw">Anklicken, wer bei diesem Bedarf angezeigt wird – die anderen werden ausgeblendet. Niemand gewählt: alle.</p>'
    : personen(zeig, { kompakt: true, mobil: true, lesen: true, fachStern: fachSternK(b, zeig) });
  const knopf = !L.length ? '' : ed ? '<button class="k-fertig" data-act="fach-fertig">Fertig</button>'
    : `<button class="k-pen fach-pen" data-act="fach-edit" title="Festlegen, wer aus dem Fachreferat bei diesem Bedarf angezeigt wird" aria-label="Personen des Fachreferats auswählen">${ICON_PEN}</button>`;
  return `<div class="sub fach-kopf">Fachreferat${name ? ' <span class="fach-n">' + esc(name) + '</span>' : ''}${!ed && weg ? `<span class="fach-plus" title="${weg} weitere im Fachreferat ausgeblendet – über den Stift ändern">(+${weg})</span>` : ''}${knopf}</div><div class="fach-liste${ed ? ' wahl' : ''}">${inhalt}</div>`;
}
const zustListe = b => personen(b.zust, { p: 'zust', edit: UI.zEdit === b.id, kompakt: true, mobil: true, max: MAX_ZUST, wer: 'Person', neu: ['weitere Person', 'Zuständige Person eintragen'],
  haupt: ['Ansprechperson – steht in der Liste', 'Zur Ansprechperson machen'] });
// Überschrift über Kontakten bzw. Zuständigen: rechts der Stift, beim Bearbeiten „Fertig“
const kKopf = (titel, edit, a = '', extra = '') => `<div class="sub">${titel}${extra}${edit ? `<button class="k-fertig" data-act="k-fertig" ${a}>Fertig</button>`
  : `<button class="k-pen" data-act="k-edit" ${a} title="${titel} bearbeiten" aria-label="${titel} bearbeiten">${ICON_PEN}</button>`}</div>`;
const FMT_I = '<button class="info" data-act="fmt-info" title="Texte formatieren: Aufzählung, fett, kursiv …" aria-label="Wie formatiere ich Texte?">i</button>';
function foePop(b) {
  const f = b.foerderer.find(x => x.id === UI.det); if (!f) return '';
  const a = `data-fid="${f.id}"`, amtP = f.status === 'zugesagt' ? 'zugesagt' : 'betrag', amt = f[amtP];
  return `<div class="pop-back" data-act="det-zu"></div>
    <div class="foe-pop" role="dialog" aria-modal="true" aria-label="Kontakt und Details: ${esc(f.name || 'Förderer')}">
      <header><h3>${esc(f.name || '(ohne Namen)')}</h3>
        <div class="pe pe-amt" data-act="pe" ${a} data-k="${amtP}" data-art="num" data-lab="${AMT_LAB[f.status]}" title="${AMT_LAB[f.status]} – klicken zum Ändern"><div class="val${amt ? '' : ' leer'}"><span class="pv">${amt ? eur(amt) : f.status === 'zugesagt' && f.betrag ? 'wie beantragt (' + eur(f.betrag) + ')' : 'Summe'}</span></div>${ICON_PEN}</div>
        <div class="pop-einsch">${dots(f)}</div>
        <button class="x" data-act="det-zu" aria-label="Schließen" title="Schließen (Esc)">×</button></header>
      <div class="pop-body">
        <div class="pA-box">${kKopf('Kontakte', UI.kEdit === f.id, a)}
          ${kontaktListe(f)}<div class="ksep"></div>
          ${pe(f, 'web', 'Website oder Portal', 'line', { fx: 'web' })}${pe(f, 'weg', 'Antragsweg')}${f.status === 'zugesagt' ? pe(f, 'betrag', 'Beantragt waren', 'num') : ''}</div>
        <div class="pA-bed">${f.status === 'abgelehnt' ? pe(f, 'grund', 'Grund der Ablehnung', 'area', { ph: 'Warum abgelehnt? z. B. Satzungszweck passt nicht, Budget ausgeschöpft, Region – hilft bei späteren Recherchen' }) : ''}${f.datei ? pe(f, 'datei', 'Ausführliche Recherche (Datei im Ordner des Bedarfs)') : ''}${pe(f, 'fristInfo', 'Fristen und Termine', 'area', { fmt: true })}${pe(f, 'hoehe', 'Übliche Fördersumme', 'area', { fmt: true })}${pe(f, 'eigenInfo', 'Eigenanteil', 'area', { fmt: true })}</div>
        <div class="pA-q"><div class="sub">Quellen</div>${pe(f, 'quellen', '', 'area', { html: `<span class="ql">${quellenListe(f.quellen)}</span>`, ph: 'Links eintragen, je Link eine Zeile', cls: 'pe-q' })}</div>
        <div class="pA-n"><div class="sub">Notizen ${FMT_I}</div>${pe(f, 'notiz', '', 'area', { ph: 'Notizen eintragen – „* “ am Zeilenanfang macht eine Aufzählung', fmt: true })}</div>
      </div>
    </div>`;
}
// Angabe im Fenster bearbeiten: an derselben Stelle ein Feld; danach neu zeichnen, das Fenster bleibt an derselben Scrollstelle
function popEdit(el) {
  if (el.querySelector('.pe-in')) return;
  const b = cur(), f = b && (el.dataset.fid ? b.foerderer.find(x => x.id === el.dataset.fid) : b); if (!f) return;
  const k = el.dataset.k, art = el.dataset.art, lang = art === 'area', val = el.querySelector('.val');
  const alt = getPath(f, k);
  if (art === 'date') return calPop(el, alt, v => { setPath(f, k, v || ''); changed(); keep(renderNow); }, { clear: el.dataset.lab + ' entfernen' });
  // Texte mit Formatierung: Schreibfeld, das fett, kursiv, Aufzählungen usw. gleich zeigt; sonst ein schlichtes Feld
  const rich = lang && !!el.dataset.fmt;
  const inp = rich ? h('div', { class: 'pe-in pe-rich', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': el.dataset.lab })
    : h(lang ? 'textarea' : 'input', { class: 'pe-in', rows: lang ? 2 : null, type: lang ? null : 'text', inputmode: art === 'num' ? 'decimal' : null, 'aria-label': el.dataset.lab });
  if (rich) inp.innerHTML = fmtText(alt || '', true) || '<div><br></div>'; else inp.value = art === 'num' ? fmtNum(alt) : alt ?? '';
  const wert = () => rich ? richText(inp) : inp.value;
  if (lang && el.closest('.eck-r')) inp.style.minHeight = Math.max(60, val.getBoundingClientRect().bottom - val.getBoundingClientRect().top, el.getBoundingClientRect().bottom - val.getBoundingClientRect().top - 10) + 'px';
  val.classList.remove('leer'); val.replaceChildren(inp); el.classList.add('edit');
  inp.focus();
  if (rich) { const rg = document.createRange(); rg.selectNodeContents(inp); rg.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(rg); }
  else try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) { /* */ }
  const leiste = rich ? richEdit(inp) : null;
  const sk = el.dataset.sug && suggest(inp, SRC[el.dataset.sug], () => finish(true));
  let fertig = false;
  const finish = ok => {
    if (fertig) return; fertig = true;
    if (leiste) leiste();
    if (ok) {
      let v = k === 'quellen' ? quellenZeilen(wert()).join('\n') : wert().trim();
      if (art === 'num') { v = deNum(v); if (v === null) { toast('„' + wert() + '“ ist keine Zahl – nicht übernommen.', 'warn'); v = alt; } else if (v === '') v = null; }
      if (v !== (alt ?? (art === 'num' ? null : ''))) { setPath(f, k, v); if (k === 'name' && el.dataset.fid) karteiFuellen(b, f); changed(); }
    }
    const y = ($('.foe-pop .pop-body') || {}).scrollTop || 0;
    keep(renderNow);
    const nb = $('.foe-pop .pop-body'); if (nb) nb.scrollTop = y;
  };
  inp.addEventListener('keydown', e => {
    if (sk && sk(e)) { e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    else if (e.key === 'Enter' && (!lang || e.ctrlKey)) { e.preventDefault(); finish(true); }
  });
  inp.addEventListener('blur', () => { if (document.hasFocus()) finish(true); });     // Fensterwechsel: Feld bleibt offen
}
const AMT_LAB = { geplant: 'Erwartete Summe', beantragt: 'Beantragte Summe', zugesagt: 'Zugesagte Summe', abgelehnt: 'Beantragt (abgelehnt)' };
const pct = (v, S) => S ? Math.round(v / S * 100) + ' %' : '';
function foeShare(b, f) {
  const S = +b.summe || 0, v = f.status === 'abgelehnt' ? 0 : foeAmt(f);
  return S ? pct(v, S) : '';
}
function geldBlock(f) {
  const a = `data-fid="${f.id}"`;
  if (f.eingegangen > 0) return `<span class="geld ok">${ICO.ok}eingegangen am ${fmtDate(f.eingangAm) || '–'}<button class="pen" data-act="geld" ${a} title="Geldeingang ändern" aria-label="Geldeingang ändern">${ICON_PEN}</button></span>`;
  return `<button class="link geld-link" data-act="geld" ${a}>→ Geldeingang bestätigen</button>`;
}
// Geldeingang: Kalender mit dem Tag des Eingangs (der Betrag ist die Zusage); „Eingang zurücknehmen“ leert ihn wieder
function geldPop(btn) {
  const b = cur(), f = b && b.foerderer.find(x => x.id === btn.dataset.fid); if (!f) return;
  calPop(btn, f.eingangAm || today(), v => {
    if (v) Object.assign(f, { eingegangen: f.zugesagt ?? f.betrag, eingangAm: v }); else Object.assign(f, { eingegangen: null, eingangAm: '' });
    changed(); keep(renderNow);
  }, { clear: f.eingegangen > 0 ? 'Eingang zurücknehmen' : '' });
}
// Fristen je Stand, jeweils Bezeichnung über dem Datum
function fpDates(f) {
  const d = (lab, p) => `<label class="fp-d"><span>${lab}${lab === 'am' ? '' : ':'}</span><input type="text" class="inline date dfeld" data-dp="${p}" data-fid="${f.id}" value="${esc(fmtDate(f[p]))}" placeholder="tt.mm.jjjj" aria-label="${lab}" autocomplete="off"></label>`;
  return ({ geplant: d('Antragsfrist', 'frist'), beantragt: d('am', 'beantragtAm') + d('Antwort erwartet', 'erwartet'),
    zugesagt: d('am', 'entscheidungAm'), abgelehnt: d('am', 'entscheidungAm') })[f.status];
}
// Einschätzung: fünf kleine Punkte, die sich von rechts füllen – der rechte allein ist „sehr unwahrscheinlich“, alle fünf „sehr wahrscheinlich“
function dots(f) {
  const lv = LVL.indexOf(f.einsch) + 1, lab = lv ? EINSCH.find(e => e[0] === f.einsch)[1] : 'noch keine Einschätzung';
  return `<div class="dots-box"><div class="dots lv${lv}" role="group" aria-label="Einschätzung: ${esc(lab)}">`
    + [5, 4, 3, 2, 1].map(n => { const k = LVL[n - 1], l = EINSCH.find(e => e[0] === k)[1]; return `<button class="dot${n <= lv ? ' on' : ''}" data-act="set" data-p="einsch" data-v="${k}" data-toggle="" data-fid="${f.id}" title="${l}" aria-label="${l}" aria-pressed="${n === lv}"></button>`; }).join('')
    + `</div><span class="dots-t">${esc(lab)}</span></div>`;
}
// je Förderer eine kompakte Kachel: Name mit Löschen, Einschätzung; groß die Summe; Stand mit Datum (nach dem Geldeingang nur noch „eingegangen am …“ mit Stift); Pro und Contra; unten Kontakt
function fpCard(b, f) {
  const a = `data-fid="${f.id}"`, st = f.status, amtP = st === 'zugesagt' ? 'zugesagt' : 'betrag';
  return `<article class="card fp fk st-${st}" id="foe-${f.id}">
    <div class="fk-top">
      <div class="fk-kopf">
        <div class="fp-title"><input type="text" class="inline fp-h" data-p="name" ${a} value="${esc(f.name)}" placeholder="Förderer" aria-label="Förderer" autocomplete="off">
          <button class="rm" data-act="rm-foe" ${a} title="Förderer entfernen" aria-label="Förderer entfernen">${ICON_TRASH}</button><span id="fw-${f.id}">${foeWarn(b, f)}</span></div>
        <div class="fk-amt"><input type="text" inputmode="decimal" class="inline num amt" data-num data-p="${amtP}" ${a} id="amt-${f.id}" value="${esc(fmtNum(st === 'zugesagt' ? f.zugesagt : f.betrag))}" placeholder="${st === 'zugesagt' && f.zugesagt == null && f.betrag ? 'wie beantragt (' + esc(fmtNum(f.betrag)) + ')' : '0'}" aria-label="${AMT_LAB[st]}" title="${AMT_LAB[st]}${st === 'zugesagt' && f.zugesagt == null && f.betrag ? ' – leer: wie beantragt, ' + esc(eur(f.betrag)) : ''}"><span class="unit">€</span></div>
      </div>
      ${dots(f)}
    </div>
    <div class="fk-st">${st === 'zugesagt' && f.eingegangen > 0 ? geldBlock(f) : `<button class="st-btn s-${st}" data-act="st-menu" ${a} aria-label="Stand: ${F_ST_L[st]} – ändern">${F_ST_L[st]} <span aria-hidden="true">▾</span></button><div class="fp-dates">${fpDates(f)}</div>${st === 'zugesagt' ? geldBlock(f) : ''}`}</div>
    <div class="pc">
      <div class="pro" title="Pro: warum passt das?"><i></i>${pe(f, 'warum', '', 'area', { fmt: true, cls: 'pe-pc', aria: 'Pro – warum passt das', ph: 'Pro: Warum passt das? Satzungszweck, Förderschwerpunkt, Regionalbezug …' })}</div>
      <div class="contra" title="Contra: wo hakt es?"><i></i>${pe(f, 'knackpunkte', '', 'area', { fmt: true, cls: 'pe-pc', aria: 'Contra – Knackpunkte', ph: 'Contra: Wo hakt es? Worauf muss der Antrag den Fokus legen?' })}</div>
    </div>
    <div class="det">
      <div class="fk-fuss" id="fuss-${f.id}">${fussKontakt(f)}</div>
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
const ROW_CLS = { zugesagt: 'r-zu', beantragt: 'r-be', geplant: 'r-ge', abgelehnt: 'r-ab' };
const segKind = f => f.status === 'zugesagt' ? 'zu' : f.status === 'beantragt' ? 'be' : f.status === 'abgelehnt' ? 'none' : 'ge';
const swa = k => `<i class="swa ${k}" aria-hidden="true"></i>`;
// Kreisdiagramm: je Förderer ein Stück, beschriftet links und rechts mit Linie zum Stück (Name, Betrag, Anteil).
// Klick auf das Stück eines Förderers schaltet seinen Stand weiter (geplant → beantragt → zugesagt → abgelehnt); die Farbe wechselt sofort,
// neu aufgeteilt wird der Kreis erst, wenn die Maus ihn verlässt (sonst springen die Stücke unter dem Mauszeiger weg)
const PIE = { W: 560, H: 240, R: 82 };
let PIE_HOLD = false;
// Breite eines Textes in der Schrift der Beschriftung (über ein unsichtbares Zeichenfeld gemessen)
const textBreite = (() => { let c = null; return (t, font) => { c = c || document.createElement('canvas').getContext('2d'); c.font = font; return c.measureText(t).width; }; })();
function pieZeilen(t, max) {
  const font = '600 13px ' + getComputedStyle(document.body).fontFamily, w = s => textBreite(s, font), fit = s => { if (w(s) <= max) return s; while (s.length > 1 && w(s + '…') > max) s = s.slice(0, -1).trimEnd(); return s + '…'; };
  if (w(t) <= max) return [t];
  const wo = t.split(/\s+/); let a = '';
  for (const x of wo) { const n = a ? a + ' ' + x : x; if (w(n) > max) break; a = n; }
  if (!a) return [fit(t)];
  const rest = t.slice(a.length).trim();
  return rest ? [a, fit(rest)] : [a];
}
function finPie(b) {
  const F = finState(b), parts = [], fs = F.fs.filter(f => segKind(f) !== 'none' && !(F.done && segKind(f) !== 'zu'));   // steht die Finanzierung, zählen nur noch Zusagen
  const add = (k, name, v, fid) => { if (v > 0) parts.push({ k, name, v, fid }); };
  fs.filter(f => segKind(f) === 'zu').forEach(f => add('zu', f.name || '(ohne Namen)', foeAmt(f), f.id));
  add('eig', 'Eigenmittel', F.eig);
  for (const k of ['be', 'ge']) fs.filter(f => segKind(f) === k).forEach(f => add(k, f.name || '(ohne Namen)', foeAmt(f), f.id));
  const tot = parts.reduce((x, p) => x + p.v, 0), max = Math.max(F.S, tot);
  add('off', 'Delta, noch ohne Förderer', (ct(F.S) - ct(tot)) / 100);
  // mehr als 6 Teile: Beschriftungen als Liste rechts neben dem Kreis (an den Stücken liefen sie sonst über die Karte)
  const viele = parts.length > 6, { W, H, R } = PIE, cx = viele ? R + 16 : W / 2, cy = H / 2, xy = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const svg = inner => `<svg class="pie" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(finText(b))}"><defs><pattern id="pie-off" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<rect width="4" height="4" style="fill:var(--track)"/><rect width="1.2" height="4" style="fill:var(--off-st)"/></pattern></defs>${inner}</svg>`;
  if (!max) return svg(`<circle class="ps off" cx="${cx}" cy="${cy}" r="${R}"/>`);
  let w = -Math.PI / 2;
  const P = parts.map(p => { const da = p.v / max * 2 * Math.PI, o = Object.assign({}, p, { a0: w, da, mid: w + da / 2 }); w += da; return o; });
  const slices = P.map(p => {
    const pt = a => xy(a, R).map(n => n.toFixed(2)).join(' '), act = p.fid ? ` data-act="pie-st" data-fid="${p.fid}" aria-label="${esc(p.name)}: Stand weiterschalten"` : '';
    return p.da > 2 * Math.PI - 1e-6 ? `<circle class="ps ${p.k}" cx="${cx}" cy="${cy}" r="${R}"${act}/>`
      : `<path class="ps ${p.k}" d="M${cx} ${cy}L${pt(p.a0)}A${R} ${R} 0 ${p.da > Math.PI ? 1 : 0} 1 ${pt(p.a0 + p.da)}Z"${act}/>`;
  });
  if (viele) {
    const font = '600 13px ' + getComputedStyle(document.body).fontFamily, lx = cx + R + 28, rx = W - 4, n = Math.floor((H - 8) / 19);
    const zeig = P.length > n ? P.slice(0, n - 1) : P, mehr = P.length - zeig.length;
    const kurz = (t, max) => { if (textBreite(t, font) <= max) return t; let s = t; while (s.length > 1 && textBreite(s + '…', font) > max) s = s.slice(0, -1).trimEnd(); return s + '…'; };
    const zeilen = zeig.map((p, i) => { const y = 16 + i * 19, wert = esc(eur(p.v)) + ' · ' + Math.round(p.v / max * 100) + ' %';
      return `<g class="pl"><rect class="ps ${p.k}" x="${lx}" y="${y - 10}" width="11" height="11" rx="2"/><text class="pl-n" x="${lx + 18}" y="${y}">${esc(kurz(p.k === 'off' ? 'Delta' : p.name, rx - lx - 18 - 128))}</text>`
        + `<text class="pl-v" x="${rx}" y="${y}" text-anchor="end">${wert}</text></g>`; });
    if (mehr) zeilen.push(`<text class="pl-v" x="${lx + 18}" y="${16 + zeig.length * 19}">… und ${mehr} weitere</text>`);
    return svg(slices.join('') + zeilen.join(''));
  }
  // Beschriftungen: rechte und linke Seite getrennt von oben nach unten, mit Mindestabstand, damit sich nichts überlappt
  // lange Namen stehen in zwei Zeilen (darüber) – genau so breit, wie neben dem Kreis Platz ist; mehr wird mit … gekürzt
  const GAP = 32, TOP = 18, BOT = H - 22, PLATZ = W / 2 - R - 44 - 4;
  P.forEach(p => { p.re = Math.cos(p.mid) >= 0; p.y = xy(p.mid, R + 16)[1]; p.zeilen = pieZeilen(p.k === 'off' ? 'Delta' : p.name, PLATZ); });
  for (const re of [true, false]) {
    const L = P.filter(p => p.re === re).sort((a, c) => a.y - c.y);
    L.forEach((p, i) => { const top = TOP + (p.zeilen.length - 1) * 15; p.y = Math.max(p.y, top, i ? L[i - 1].y + GAP + (p.zeilen.length - 1) * 15 : top); });
    const over = L.length ? L[L.length - 1].y - BOT : 0;
    if (over > 0) for (let i = L.length - 1; i >= 0; i--) L[i].y = Math.min(L[i].y - over, i < L.length - 1 ? L[i + 1].y - GAP : BOT);
  }
  const labels = P.map(p => {
    const [x0, y0] = xy(p.mid, R), [x1, y1] = xy(p.mid, R + 12), tx = p.re ? cx + R + 44 : cx - R - 44, anc = p.re ? 'start' : 'end';
    const Z = p.zeilen, y = p.y - 2 - (Z.length - 1) * 15;
    return `<g class="pl"><polyline class="pl-l" points="${x0.toFixed(1)},${y0.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)} ${(tx + (p.re ? -6 : 6)).toFixed(1)},${p.y.toFixed(1)}"/>`
      + `<text class="pl-n" x="${tx}" y="${y.toFixed(1)}" text-anchor="${anc}">${Z.map((z, i) => `<tspan x="${tx}" dy="${i ? 15 : 0}">${esc(z)}</tspan>`).join('')}</text>`
      + `<text class="pl-v" x="${tx}" y="${(p.y + 13).toFixed(1)}" text-anchor="${anc}">${esc(eur(p.v))} · ${Math.round(p.v / max * 100)} %</text></g>`;
  });
  return svg(slices.join('') + labels.join(''));
}
// kleines Hinweisfeld beim Überfahren von Elementen mit data-tip (z. B. Telefonnummer, E-Mail-Adresse) – sofort, hell statt des schwarzen Browser-Hinweises
document.addEventListener('mouseover', e => {
  const el = e.target.closest && e.target.closest('[data-tip]'); let t = $('.tip-pop');
  if (!el) { if (t) t.remove(); return; }
  if (!t) { t = h('div', { class: 'tip-pop', role: 'tooltip' }); document.body.append(t); }
  t.textContent = el.dataset.tip;
  const r = el.getBoundingClientRect();
  t.style.left = Math.max(8, Math.min(r.left + r.width / 2 - t.offsetWidth / 2, innerWidth - t.offsetWidth - 8)) + 'px'; t.style.top = (r.top - t.offsetHeight - 6 < 4 ? r.bottom + 6 : r.top - t.offsetHeight - 6) + 'px';
});
function finRows(b) {
  const S = +b.summe || 0, F = finState(b);
  return `<tr class="r-sum"><th>${swa('none')}Gesamtbedarf</th><td class="num">${S ? eur(S) : '–'}</td><td class="num">${S ? '100 %' : ''}</td></tr>`
    + foeSortiert(b.foerderer.filter(f => f.name.trim() || f.betrag)).map(f => { const v = foeAmt(f);
      const weg = F.done && f.status === 'geplant';                                  // Finanzierung steht: geplante Förderer braucht es nicht mehr
      return `<tr class="${ROW_CLS[f.status]}${weg ? ' r-weg' : ''}"><th>${swa(segKind(f))}${esc(f.name || '(ohne Namen)')} <span class="r-st">${weg ? 'geplant – nicht mehr nötig' : F_ST_L[f.status]}${f.status === 'zugesagt' && f.eingegangen > 0 ? ', eingegangen' : ''}</span></th><td class="num">${eur(v)}</td><td class="num">${weg || f.status === 'abgelehnt' ? '' : pct(v, S)}</td></tr>`; }).join('')
    + (F.d ? `<tr class="r-delta"><th>${swa(F.d > 0 ? 'off' : 'none')}${F.d > 0 ? 'Delta <span class="r-st">noch ohne Förderer</span>' : 'Überfinanzierung'}</th><td class="num">${eur(Math.abs(F.d))}</td><td class="num">${pct(Math.abs(F.d), S)}</td></tr>` : '');
}
const finEigPct = b => pct(+b.eigenanteil || 0, +b.summe || 0);
// Förderplan und Nacharbeit lassen sich einklappen. Beim Öffnen eines Bedarfs je nach Phase: steht die Finanzierung (Nacharbeit, abgeschlossen),
// ist der Förderplan zu und die Nacharbeit offen – sonst umgekehrt. Von Hand umgeklappt gilt, solange man auf der Seite bleibt.
// Wechselt unterwegs die Phase (z. B. letzter Geldeingang bestätigt), klappt der Bereich der neuen Phase auf – zugeklappt wird dabei nichts
let ZU = null;
const zuStd = b => { const nach = phase(b).step >= 2; return { id: b.id, n: nach, foe: nach, nach: !nach }; };
const zuGet = (b, k) => {
  const n = phase(b).step >= 2;
  if (!ZU || ZU.id !== b.id) ZU = zuStd(b); else if (ZU.n !== n) { ZU.n = n; ZU[n ? 'nach' : 'foe'] = false; }
  return ZU[k];
};
const zuSet = (b, k, v) => { zuGet(b, k); ZU[k] = v; };
const ICON_CHEV = '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const zuKopf = (k, titel, zu) => `<h2><button class="sec-zu${zu ? ' zu' : ''}" data-act="zu" data-v="${k}" aria-expanded="${!zu}" title="${zu ? 'Aufklappen' : 'Einklappen'}">${ICON_CHEV}${titel}</button></h2>`;
// Kurzinfo im eingeklappten Förderplan – sagt dasselbe wie der Stand oben (Phase)
function foeKurz(b) {
  const F = finState(b), n = F.fs.filter(f => f.status !== 'abgelehnt').length, rest = (ct(F.S) - ct(F.zu) - ct(F.eig)) / 100;
  const stand = !F.S ? 'Summe fehlt' : F.gedeckt ? 'Finanzierung steht' + (F.offen.length ? ' – Antrag bei ' + names(F.offen) + ' noch offen' : '')
    : !F.zu && F.eig && rest <= 0 ? 'bisher nur Eigenmittel' : eur(rest) + ' noch ohne Zusage';
  return [n + ' Förderer', F.zu ? eur(F.zu) + ' zugesagt' : 'noch keine Zusage', stand].join(' · ');
}
function secFoe(b) {
  if (zuGet(b, 'foe')) return `<section class="card fp-head zu" id="sec-foe"><div class="sec-head">${zuKopf('foe', 'Förderplan', true)}<p id="foe-kurz">${esc(foeKurz(b))}</p></div></section>`;
  return `<section class="card fp-head" id="sec-foe">
    <div class="sec-head">${zuKopf('foe', 'Förderplan', false)}
      <div class="sec-tools"><button class="icon-btn" data-act="import" aria-label="Ausgefüllte Recherche-Excel übernehmen" title="Ausgefüllte Recherche-Excel übernehmen – du siehst zuerst die Vorschläge">${ICON_UP}</button></div></div>
    <div class="fin-wrap">
    <table class="fsum"><tbody id="fin-rows">${finRows(b)}</tbody>
      <tbody><tr class="r-eig"><th>${swa('eig')}Eigenmittel <span class="r-st">aus Mitteln der Gliederung oder der Diözese</span></th><td class="num"><span class="row nowrap"><input type="text" inputmode="decimal" class="inline num eig" data-num data-p="eigenanteil" value="${esc(fmtNum(b.eigenanteil))}" placeholder="0" aria-label="Eigenmittel in Euro"><span class="unit">€</span></span></td><td class="num" id="fin-eig">${finEigPct(b)}</td></tr></tbody></table>
    <div id="fin-pie" class="fin-pie">${finPie(b)}</div></div>
  </section>
  <div class="fk-grid">${foeSortiert(b.foerderer).map(f => fpCard(b, f)).join('')}<button class="fk-neu" data-act="add-foe" title="Förderer hinzufügen – viele auf einmal über die Recherche-Excel (Symbol oben rechts im Förderplan)"><span class="fk-plus" aria-hidden="true">+</span>Förderer hinzufügen</button></div>`;
}

/* ---------- Nacharbeit: Übergabe und Pressemitteilung einmal je Bedarf, Verwendungsnachweis (Sach- und Finanzbericht) je Förderer */
function nachLine(f) {
  const a = `data-fid="${f.id}"`, x = f.vn;
  return `<div class="nl ${x.noetig && x.st !== 'erledigt' ? 'open' : ''}" id="nl-${f.id}">${cbx(f, 'vn.noetig', 'Verwendungsnachweis', a)}${x.noetig ? `<label class="inl">Frist ${dfeld(f, 'vn.frist', a + ' aria-label="Frist Verwendungsnachweis"')}</label>${seg(VN_ST, x.st, `data-p="vn.st" ${a}`, 'small')}` : '<span class="muted small">nicht nötig</span>'}</div>`;
}
function nachBody(b) {
  const zu = b.foerderer.filter(f => f.status === 'zugesagt'), cand = b.foerderer.filter(f => f.status !== 'abgelehnt' && f.name.trim()), n = b.nach;
  return `<div class="grid two">
    <div><h3>Gemeinsam für den Bedarf</h3>
      <div class="na-block"><div class="na-head">${cbx(b, 'nach.ueb.noetig', 'Spendenübergabe')}${n.ueb.noetig ? seg([['offen', 'offen'], ['terminiert', 'terminiert', 't-run'], ['erledigt', 'erledigt', 't-ok']], n.ueb.st, 'data-p="nach.ueb.st"', 'small') : ''}</div>
        ${n.ueb.noetig ? `<div class="grid2">${fld('Termin', `<span class="row nowrap">${dfeld(b, 'nach.ueb.termin', 'aria-label="Termin der Spendenübergabe"')}${zfeld(b, 'nach.ueb.zeit', 'aria-label="Uhrzeit der Spendenübergabe"')}</span>`, 'ue-termin')}${fld('Ort', tin(b, 'nach.ueb.ort', 'aria-label="Ort der Spendenübergabe"', 'z. B. Wache, Rathaus'))}</div>
          ${pe(b, 'nach.ueb.info', 'Notizen', 'area', { fmt: true, cls: 'pe-ue', aria: 'Notizen zur Spendenübergabe', ph: 'z. B. warum es noch dauert: Küche wird erst im November eingebaut, Übergabe danach mit Fotos' })}
          ${fld('Wer ist dabei?', `<div class="mit">${cand.length ? cand.map(f => `<label class="check"><input type="checkbox" data-act="mit" data-fid="${f.id}" ${n.ueb.mit.includes(f.id) ? 'checked' : ''}> ${esc(f.name)} <span class="muted small">${F_ST_L[f.status]}</span></label>`).join('') : '<span class="muted small">Noch keine Förderer im Förderplan</span>'}</div>`)}` : ''}
      </div>
      <div class="na-block"><div class="na-head">${cbx(b, 'nach.pm.noetig', 'Pressemitteilung')}${n.pm.noetig ? seg([['offen', 'offen'], ['arbeit', 'in Arbeit', 't-warn'], ['veroeff', 'veröffentlicht', 't-ok']], n.pm.st, 'data-p="nach.pm.st"', 'small') : ''}</div>
        ${n.pm.noetig && n.pm.st === 'veroeff' ? `<div class="grid2">${fld('veröffentlicht am', dfeld(b, 'nach.pm.datum', 'aria-label="Pressemitteilung veröffentlicht am"'))}</div>` : ''}
      </div>
    </div>
    <div><h3>Je Förderer</h3>
      ${zu.length ? zu.map(f => `<div class="na-block"><div class="na-title">${esc(f.name || '(ohne Namen)')}</div>${nachLine(f)}</div>`).join('') : '<div class="empty small">Erscheint, sobald eine Förderung zugesagt ist.</div>'}
    </div>
  </div>`;
}
function secNach(b) {
  if (zuGet(b, 'nach')) { const L = nachOffen(b);
    return `<section class="card zu" id="sec-nach"><div class="sec-head">${zuKopf('nach', 'Nacharbeit', true)}<p id="nach-kurz">${esc(L.length ? 'offen: ' + L.join(', ') : 'nichts offen')}</p></div></section>`; }
  return `<section class="card" id="sec-nach"><div class="sec-head">${zuKopf('nach', 'Nacharbeit', false)}<p>Spendenübergabe und Pressemitteilung einmal für den ganzen Bedarf, der Verwendungsnachweis (Sach- und Finanzbericht) je Förderer.</p></div>
    <div id="nach-body">${nachBody(b)}</div></section>`;
}
