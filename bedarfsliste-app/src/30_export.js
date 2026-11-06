/* ===================================================================== Exportieren (ab 0.139)
   Knopf „Exportieren“ oben rechts neben ↶. Ein Fenster mit drei Fragen: Was (Bedarfe / Förderer), Welche (alle angezeigten, ausgewählte, nur dieser),
   Wie: PDF (kompakt, ausführlich oder Detail – über das Druckfenster „Als PDF speichern“), Excel, Termine für Outlook (.ics mit Erinnerung).
   Die Spalten der Übersichten sind wählbar; die Wahl merkt sich der Browser (bl-export). */
const EX_KEY = 'bl-export';
const ICON_EXP = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 12.5V3M6.3 6.6L10 2.9l3.7 3.7M4 10.5v5.2c0 .7.6 1.3 1.3 1.3h9.4c.7 0 1.3-.6 1.3-1.3v-5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const exLaden = () => { try { return JSON.parse(localStorage.getItem(EX_KEY) || '{}') || {}; } catch (e) { return {}; } };
const exMerken = o => { try { localStorage.setItem(EX_KEY, JSON.stringify(o)); } catch (e) { /* ohne Speicher */ } };
const exE = s => esc(String(s ?? '')).replace(/\n/g, '<br>');
const exPlain = t => String(t || '').replace(/^\s*(?:[•*-]|\d+\.)\s+/gm, '').replace(/(^|[\s(„>])[*_~+](?=\S)/g, '$1').replace(/(\S)[*_~+](?=$|[\s.,;:!?)“<])/g, '$1').trim();
const exFmt = t => t ? fmtText(t) : '';
const exEinsch = v => (EINSCH.find(e => e[0] === v) || [, ''])[1];

/* ---------- Spalten der Übersichten: [Schlüssel, Überschrift, in kompakt, in ausführlich, Inhalt(x, ausführlich) → HTML] */
const exFoeZeile = (f, a) => esc(f.name.trim() || '(ohne Namen)') + ' · ' + F_ST_L[f.status] + (foeAmt(f) ? ' · ' + eur(foeAmt(f)) : '') + (a && f.status === 'geplant' && f.frist ? ' · Frist ' + fmtDate(f.frist) : '') + (a && f.einsch ? ' · ' + exEinsch(f.einsch) : '');
const EX_B = [
  ['titel', 'Bedarf', 1, 1, b => '<b>' + esc(b.titel || '(ohne Namen)') + '</b>'],
  ['gl', 'Gliederung', 1, 1, b => esc(b.gliederung)],
  ['summe', 'Summe', 1, 1, b => b.summe ? eur(b.summe) : '–'],
  ['prio', 'Priorität', 0, 1, b => esc(b.prio)],
  ['stand', 'Stand', 1, 1, (b, a) => { const p = phase(b); return esc(phaseName(p)) + (a && p.sub ? '<div class="ex-k">' + esc(p.t + (p.sub ? ': ' + p.sub : '')) + '</div>' : ''); }],
  ['foerderer', 'Förderer', 0, 1, (b, a) => { const L = b.foerderer.filter(f => f.name.trim() || f.betrag); if (!L.length) return '–';
    if (!a) { const z = L.filter(f => f.status === 'zugesagt'); return L.length + (L.length === 1 ? ' Förderer' : ' Förderer') + (z.length ? ', ' + z.length + ' zugesagt' : ''); }
    return L.map(f => '<div class="ex-fz"><b>' + esc(f.name.trim() || '(ohne Namen)') + '</b><span class="ex-k"> · ' + [F_ST_L[f.status], foeAmt(f) ? eur(foeAmt(f)) : '', f.status === 'geplant' && f.frist ? 'Frist ' + fmtDate(f.frist) : '', f.einsch ? exEinsch(f.einsch) : ''].filter(Boolean).join(' · ') + '</span></div>').join(''); }],
  ['finanz', 'Finanzierung', 0, 1, b => { const F = finState(b); return F.S ? 'zugesagt ' + eur(F.zu) + (F.eig ? ' · Eigenmittel ' + eur(F.eig) : '') + (F.d > 0 ? ' · offen ' + eur(F.d) : '') : '–'; }],
  ['frist', 'Nächste Frist', 1, 1, b => { const x = nextFrist(b); return x ? fmtDate(x.d) + '<div class="ex-k">' + esc(x.t) + '</div>' : '–'; }],
  ['deadline', 'Deadline', 0, 0, b => b.deadline ? fmtDate(b.deadline) : '–'],
  ['freigabe', 'Freigabe', 0, 1, b => { const o = frOffen(b); return o.rej.length ? 'abgelehnt: ' + esc(o.rej.map(frName).join(', ')) : o.names.length ? 'es fehlt: ' + esc(o.names.join(', ')) : 'vollständig'; }],
  ['zust', 'Ansprechperson', 1, 1, (b, a) => { const z = b.zust.filter(x => x.n.trim()); if (!z.length) return '–'; return esc(z[0].n) + (a ? '<div class="ex-k">' + esc([z[0].rolle, z[0].mail, z[0].tel || z[0].mobil].filter(Boolean).join(' · ')) + '</div>' : ''); }],
  ['stichworte', 'Stichworte', 0, 0, b => esc(b.stichworte.join(', ')) || '–'],
  ['beschreibung', 'Beschreibung', 0, 0, b => esc(exPlain(b.beschreibung)).slice(0, 600) || '–']];
const EX_F = [
  ['name', 'Förderer', 1, 1, e => '<b>' + esc(e.name || '(ohne Namen)') + '</b>' + (e.kurz ? ' <span class="ex-k">(' + esc(e.kurz) + ')</span>' : '') + (flGrossE(e) ? ' <span class="ex-k">· über 10.000 € möglich</span>' : '')],
  ['art', 'Art', 1, 1, e => esc(e.art) || '–'],
  ['gl', 'Fördergebiet', 1, 1, e => esc(flEff(e).gl.map(g => /^alle$/i.test(g) ? 'alle Gliederungen' : g).join(', ')) || '–'],
  ['schwer', 'Förderzweck', 1, 1, e => esc(flKomma(flEff(e).schwer)) || '–'],
  ['hoehe', 'Förderhöhe', 1, 1, e => esc(e.topfe.length ? e.topfe.map(t => flHoeheKlar(t)).filter(Boolean).join(' / ') : flHoeheKlar(e)) || '–'],
  ['fristen', 'Fristen', 1, 1, e => { const L = flFristenDaten(e).filter(x => x.iso >= today()); return L.length ? L.map(x => fmtDate(x.iso).slice(0, 6) + (x.topf && e.topfe.length > 1 ? ' (' + esc(x.topf) + ')' : '')).join(', ') : esc(flPlain(flEff(e).fristen)) || '–'; }],
  ['kontakt', 'Ansprechperson', 1, 1, (e, a) => { const k = flKontaktHaupt(e); return k ? esc(k.n) + (a ? '<div class="ex-k">' + esc([k.pos, k.mail, k.tel].filter(Boolean).join(' · ')) + '</div>' : '') : '–'; }],
  ['einsch', 'Einschätzung', 0, 1, (e, a) => { const B = flBewFuer(e); const L = (a ? FL_BEW : FL_BEW.filter(x => x.k === 'chance')).filter(x => B[x.k].v).map(x => x.kurz + ' ' + x.st[B[x.k].v - 1]); return L.map(esc).join('<br>') || '–'; }],
  ['weg', 'Antragsweg', 0, 1, e => esc(flEff(e).weg.join(', ')) || '–'],
  ['toepfe', 'Fördertöpfe', 0, 1, e => esc(e.topfe.map(t => t.name).join(', ')) || '–'],
  ['foerderungen', 'Förderungen', 0, 1, e => { const K = flKennzahl(flHistorie(e)); return K.n ? K.n + ' seit ' + K.seit + ' · ' + eur(K.sum) : '–'; }],
  ['notiz', 'Notizen', 0, 0, e => esc(flPlain(flEff(e).notiz)).slice(0, 500) || '–']];

/* ---------- Was ausgewählt werden kann */
const exAktiveB = () => { try { return filtered(); } catch (e) { return D.bedarfe.filter(b => !b.archiv); } };
function exQuelle(was) {
  if (was === 'f') return { alle: flGefiltert(), voll: D.fl ? D.fl.liste.slice().sort((a, c) => a.name.localeCompare(c.name, 'de')) : [], dieser: UI.view === 'fdetail' ? flCur() : null, name: e => e.name || '(ohne Namen)' };
  const voll = D.bedarfe.slice().sort((a, c) => !!a.archiv - !!c.archiv || (a.titel || '').localeCompare(c.titel || '', 'de'));
  return { alle: exAktiveB(), voll, dieser: UI.view === 'detail' ? cur() : null, name: b => (b.titel || '(ohne Namen)') + (b.archiv ? ' · Archiv' : '') + (b.gliederung ? ' · ' + b.gliederung : '') };
}

/* ---------- Fenster */
async function exportDialog() {
  closeMenus();
  if (!D) return;
  const M = exLaden();
  const S = { was: UI.view === 'flist' || UI.view === 'fdetail' ? 'f' : 'b', welche: UI.view === 'detail' || UI.view === 'fdetail' ? 'dieser' : 'alle', format: M.format || 'pdf', umfang: M.umfang || 'kompakt', wahl: new Set(), q: '',
    sp: Object.assign({}, M.sp || {}), arten: new Set(M.arten || ['frist', 'erwartet', 'vn', 'ueb', 'deadline', 'flfrist']), vorher: M.vorher || '1w' };
  if (!D.fl || !D.fl.liste.length) S.was = 'b';
  const box = h('div', { class: 'ex' });
  const seg = (L, v, fn) => h('div', { class: 'seg ex-seg' }, ...L.filter(Boolean).map(([k, t]) => h('button', { type: 'button', class: k === v ? 'on' : '', onclick: () => { fn(k); zeig(); } }, t)));
  const spKey = () => S.was + '-' + S.umfang;
  const spalten = () => { const DEF = S.was === 'f' ? EX_F : EX_B, ak = S.umfang === 'ausf'; return S.sp[spKey()] || DEF.filter(x => ak ? x[3] : x[2]).map(x => x[0]); };
  let zu = () => {};
  const zeig = () => {
    const Q = exQuelle(S.was);
    if (S.welche === 'dieser' && !Q.dieser) S.welche = 'alle';
    const teile = [];
    teile.push(h('div', { class: 'ex-r' }, h('span', { class: 'ex-l' }, 'Was?'), seg([['b', 'Bedarfe'], D.fl && D.fl.liste.length ? ['f', 'Förderer'] : null], S.was, k => { if (S.was !== k) { S.was = k; S.wahl.clear(); S.welche = 'alle'; } })));
    teile.push(h('div', { class: 'ex-r' }, h('span', { class: 'ex-l' }, 'Welche?'), seg([['alle', 'alle angezeigten (' + Q.alle.length + ')'], ['wahl', 'ausgewählte' + (S.wahl.size ? ' (' + S.wahl.size + ')' : ' …')], Q.dieser ? ['dieser', 'nur diesen'] : null], S.welche, k => { S.welche = k; })));
    if (S.welche === 'wahl') {
      const L = Q.voll.filter(x => !S.q || norm(Q.name(x)).includes(S.q));
      const such = h('input', { type: 'search', class: 'ex-such', placeholder: 'In der Auswahl suchen …', value: S.q, oninput: e => { S.q = norm(e.target.value); const p = e.target.selectionStart; zeig(); const n = box.querySelector('.ex-such'); n.focus(); n.setSelectionRange(p, p); } });
      teile.push(h('div', { class: 'ex-wahl' }, h('div', { class: 'ex-wk' }, such, h('button', { type: 'button', class: 'link small', onclick: () => { L.forEach(x => S.wahl.add(x.id)); zeig(); } }, 'alle'), h('button', { type: 'button', class: 'link small', onclick: () => { S.wahl.clear(); zeig(); } }, 'keine')),
        h('div', { class: 'ex-wl' }, ...L.map(x => { const c = h('input', { type: 'checkbox', checked: S.wahl.has(x.id), onchange: () => { c.checked ? S.wahl.add(x.id) : S.wahl.delete(x.id); zahl(); } }); return h('label', { class: 'ex-wz' }, c, h('span', null, Q.name(x))); }))));
    }
    teile.push(h('div', { class: 'ex-r' }, h('span', { class: 'ex-l' }, 'Wie?'), seg([['pdf', 'PDF'], ['xlsx', 'Excel'], ['ics', 'Termine (Outlook)']], S.format, k => { S.format = k; })));
    if (S.format === 'pdf') {
      teile.push(h('div', { class: 'ex-r' }, h('span', { class: 'ex-l' }, 'Umfang'), seg([['kompakt', 'kompakt'], ['ausf', 'ausführlich'], ['detail', 'Detail – je ' + (S.was === 'f' ? 'Förderer' : 'Bedarf') + ' eine Seite']], S.umfang, k => { S.umfang = k; })));
      if (S.umfang !== 'detail') {
        const DEF = S.was === 'f' ? EX_F : EX_B, an = new Set(spalten());
        teile.push(h('div', { class: 'ex-r ex-r-sp' }, h('span', { class: 'ex-l' }, 'Spalten'), h('div', { class: 'ex-sp' }, ...DEF.map(([k, t], i) => { const c = h('input', { type: 'checkbox', checked: an.has(k), disabled: i === 0,
          onchange: () => { const L = spalten().filter(x => x !== k); if (c.checked) L.push(k); S.sp[spKey()] = DEF.map(x => x[0]).filter(x => L.includes(x) || x === DEF[0][0]); } }); return h('label', { class: 'ex-spz' }, c, t); }),
          S.sp[spKey()] ? h('button', { type: 'button', class: 'link small ex-sp-r', onclick: () => { delete S.sp[spKey()]; zeig(); } }, 'Standard') : null)));
      }
      teile.push(h('p', { class: 'muted small ex-h' }, 'Öffnet das Druckfenster – dort „Als PDF speichern“ wählen (oder direkt drucken).'));
    } else if (S.format === 'ics') {
      const A = S.was === 'f' ? [['flfrist', 'Fristen der Fördererliste']] : [['frist', 'Antragsfristen'], ['erwartet', 'erwartete Antworten'], ['vn', 'Verwendungsnachweise'], ['ueb', 'Spendenübergaben'], ['deadline', 'Deadline des Bedarfs']];
      teile.push(h('div', { class: 'ex-r ex-r-sp' }, h('span', { class: 'ex-l' }, 'Termine'), h('div', { class: 'ex-sp' }, ...A.map(([k, t]) => { const c = h('input', { type: 'checkbox', checked: S.arten.has(k), onchange: () => { c.checked ? S.arten.add(k) : S.arten.delete(k); zahl(); } }); return h('label', { class: 'ex-spz' }, c, t); }))));
      const sel = h('select', { class: 'ex-vorher', onchange: e => { S.vorher = e.target.value; } }, ...EX_VORHER.map(([k, t]) => h('option', { value: k, selected: k === S.vorher }, t)));
      teile.push(h('div', { class: 'ex-r' }, h('span', { class: 'ex-l' }, 'Erinnerung'), sel));
      teile.push(h('p', { class: 'muted small ex-h' }, 'Eine Datei mit allen künftigen Terminen der Auswahl, ganztägig. Doppelklick auf die Datei übernimmt sie in Outlook.'));
    } else teile.push(h('p', { class: 'muted small ex-h' }, S.was === 'f' ? 'Die Fördererliste der Auswahl mit allen Blättern (Förderer, Fördertöpfe, Kontakte, Fristen, Förderungen …).' : 'Blatt „Bedarfe“ (eine Zeile je Bedarf) und „Förderplan“ (eine Zeile je Förderer eines Bedarfs).'));
    teile.push(h('div', { class: 'ex-fuss' }, h('span', { class: 'muted small ex-n' }), h('button', { type: 'button', class: 'primary ex-los', onclick: () => zu('los') }, 'Exportieren')));
    box.replaceChildren(...teile); zahl();
  };
  const auswahl = () => { const Q = exQuelle(S.was); return S.welche === 'dieser' ? (Q.dieser ? [Q.dieser] : []) : S.welche === 'wahl' ? Q.voll.filter(x => S.wahl.has(x.id)) : Q.alle; };
  const zahl = () => { const n = auswahl().length, t = box.querySelector('.ex-n'), b = box.querySelector('.ex-los'); if (t) t.textContent = n + (S.was === 'f' ? (n === 1 ? ' Förderer' : ' Förderer') : (n === 1 ? ' Bedarf' : ' Bedarfe')); if (b) b.disabled = !n || (S.format === 'ics' && !S.arten.size); };
  zeig();
  const k = await modal('Exportieren', box, [], { cls: 'ex-modal', expose: c => { zu = c; } });
  if (k !== 'los') return;
  exMerken({ format: S.format, umfang: S.umfang, sp: S.sp, arten: [...S.arten], vorher: S.vorher });
  const L = auswahl(); if (!L.length) return;
  if (S.format === 'pdf') exDrucken(S.was, L, S.umfang, spalten());
  else if (S.format === 'xlsx') { if (S.was === 'f') download('Fördererliste ' + today() + '.xlsx', flBlob(flExportZeilen(L))); else download('Bedarfe ' + today() + '.xlsx', exBedarfeXlsx(L)); }
  else exIcs(S.was, L, S.arten, S.vorher);
}

/* ---------- PDF über das Druckfenster: eigener Druckbereich, die Seite selbst wird beim Drucken ausgeblendet */
function exDrucken(was, L, umfang, sp) {
  const titel = (was === 'f' ? 'Fördererliste' : 'Bedarfe') + (umfang === 'detail' ? ' – Detail' : umfang === 'ausf' ? ' – ausführlich' : ' – Übersicht');
  const kopf = `<div class="ex-pk"><div><b>${esc(titel)}</b><span>Malteser · Diözese Paderborn · Fundraising</span></div><span>Stand ${fmtDate(today())} · ${L.length} ${was === 'f' ? 'Förderer' : L.length === 1 ? 'Bedarf' : 'Bedarfe'}</span></div>`;
  let inhalt;
  if (umfang === 'detail') inhalt = L.map((x, i) => `<section class="ex-seite${i ? ' neu' : ''}">${kopf}${was === 'f' ? exFDetail(x) : exBDetail(x)}</section>`).join('');
  else {
    const DEF = (was === 'f' ? EX_F : EX_B).filter(c => sp.includes(c[0])), a = umfang === 'ausf';
    inhalt = kopf + `<table class="ex-tab${a ? ' ausf' : ''}"><thead><tr>${DEF.map(c => `<th class="ex-c-${c[0]}">${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${L.map(x => `<tr>${DEF.map(c => `<td class="ex-c-${c[0]}">${c[4](x, a)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  let d = document.getElementById('ex-druck'); if (d) d.remove();
  d = h('div', { id: 'ex-druck', class: umfang === 'detail' ? 'hoch' : 'quer', html: inhalt }); document.body.append(d);
  const alt = document.title; document.title = dateiName(titel + ' ' + today());
  document.documentElement.classList.add('ex-drucken', umfang === 'detail' ? 'ex-hoch' : 'ex-quer');
  const pg = h('style', { id: 'ex-page' }, '@page { size: A4 ' + (umfang === 'detail' ? 'portrait' : 'landscape') + '; margin: 12mm; }'); document.head.append(pg);   // Übersicht quer, Detail hoch
  const weg = () => { document.documentElement.classList.remove('ex-drucken', 'ex-hoch', 'ex-quer'); document.title = alt; d.remove(); pg.remove(); removeEventListener('afterprint', weg); };
  addEventListener('afterprint', weg);
  setTimeout(() => { try { window.print(); } catch (e) { weg(); } }, 60);
}
const exZeile = (t, v) => v ? `<tr><th>${esc(t)}</th><td>${v}</td></tr>` : '';
function exBDetail(b) {
  const p = phase(b), F = finState(b), L = b.foerderer.filter(f => f.name.trim() || f.betrag), u = b.nach.ueb;
  const zust = b.zust.filter(z => z.n.trim()).map(z => `<div>${esc(z.n)}${[z.rolle, z.mail, z.tel || z.mobil].filter(Boolean).length ? ' <span class="ex-k">· ' + esc([z.rolle, z.mail, z.tel || z.mobil].filter(Boolean).join(' · ')) + '</span>' : ''}</div>`).join('');
  const fr = frItems(b).map(i => `<div>${esc(frName(i))}: ${esc(frText(i) || i.st)}</div>`).join('');
  const ul = b.unterlagen.map(x => `<div>${esc(x.name)}: ${esc(ulText(x))}</div>`).join('');
  const plan = L.length ? `<table class="ex-plan"><thead><tr><th>Förderer</th><th>Stand</th><th>Betrag</th><th>Fristen</th><th>Einschätzung</th></tr></thead><tbody>${L.map(f => `<tr><td><b>${esc(f.name.trim() || '(ohne Namen)')}</b>${f.warum ? '<div class="ex-k">+ ' + esc(exPlain(f.warum)) + '</div>' : ''}${f.knackpunkte ? '<div class="ex-k">– ' + esc(exPlain(f.knackpunkte)) + '</div>' : ''}</td><td>${F_ST_L[f.status]}${f.status === 'zugesagt' && f.eingegangen > 0 ? '<div class="ex-k">eingegangen ' + eur(f.eingegangen) + '</div>' : ''}</td><td>${foeAmt(f) ? eur(foeAmt(f)) : '–'}</td><td>${[f.frist && 'Antrag bis ' + fmtDate(f.frist), f.erwartet && 'Antwort ' + fmtDate(f.erwartet), f.status === 'zugesagt' && f.vn.noetig && f.vn.frist && 'Nachweis bis ' + fmtDate(f.vn.frist)].filter(Boolean).join('<br>') || '–'}</td><td>${esc(exEinsch(f.einsch)) || '–'}</td></tr>`).join('')}</tbody></table>` : '<p class="ex-k">Noch kein Förderer eingetragen.</p>';
  return `<h1>${esc(b.titel || '(ohne Namen)')}</h1>
    <table class="ex-steck">${exZeile('Gliederung', esc(b.gliederung))}${exZeile('Summe', b.summe ? eur(b.summe) + (b.summeArt ? ' <span class="ex-k">(' + esc(b.summeArt) + ')</span>' : '') : '')}${exZeile('Priorität', esc(b.prio))}${exZeile('Deadline', b.deadline ? fmtDate(b.deadline) : '')}
      ${exZeile('Stand', esc(phaseName(p)) + (p.sub || p.t ? ' <span class="ex-k">· ' + esc(p.t + (p.sub ? ': ' + p.sub : '')) + '</span>' : ''))}${exZeile('Stichworte', esc(b.stichworte.join(', ')))}${exZeile('Zuständig', zust)}</table>
    ${b.beschreibung ? '<h2>Beschreibung</h2><div class="ex-txt">' + exFmt(b.beschreibung) + '</div>' : ''}
    <h2>Freigabe und Unterlagen</h2><div class="ex-zwei"><div>${fr}</div><div>${ul}</div></div>
    <h2>Förderplan</h2>${plan}
    <p class="ex-sum">${F.S ? 'Summe ' + eur(F.S) + ' · zugesagt ' + eur(F.zu) + (F.eig ? ' · Eigenmittel ' + eur(F.eig) : '') + (F.d > 0 ? ' · offen ' + eur(F.d) : '') : ''}</p>
    ${u.noetig && (u.termin || u.ort) ? '<h2>Spendenübergabe</h2><p>' + [u.termin && fmtDate(u.termin) + (u.zeit ? ', ' + esc(u.zeit) + ' Uhr' : ''), esc(u.ort)].filter(Boolean).join(' · ') + '</p>' : ''}`;
}
function exFDetail(e) {
  const H = flHistorie(e), K = flKennzahl(H), T = e.topfe.length ? e.topfe : [e];
  const steck = W => `<table class="ex-steck">${exZeile('Förderzweck', exFmt(W.schwer))}${exZeile('Fördergebiet', esc(W.gl.map(g => /^alle$/i.test(g) ? 'alle Gliederungen' : g).join(', ')))}${exZeile('Förderhöhe', esc(flHoeheKlar(W)) + (flGrossT(W) ? ' <span class="ex-k">· über 10.000 € möglich</span>' : ''))}${exZeile('Förderquote', esc(W.quote))}
    ${exZeile('Fristen', esc(flFristenDaten(Object.assign({}, e, { fristenL: e.fristenL.filter(f => W === e || f.topf === W.name || (!f.topf && W === e.topfe[0])) })).map(x => fmtDate(x.iso).slice(0, 6)).join(', ')) + (W.fristen ? ' <span class="ex-k">' + esc(flPlain(W.fristen)) + '</span>' : ''))}
    ${exZeile('Antragsweg', esc(W.weg.join(', ')))}${exZeile('Antrag an', esc(W.antrag))}${exZeile('Homepage', esc(W.web))}${exZeile('Richtlinien', esc(W.richtlinien))}${exZeile('Anschrift', esc(W.anschrift))}
    ${exZeile('Einschätzung', esc(FL_BEW.map(x => { const B = flBew(e, W === e ? null : W)[x.k]; return B.v ? x.t + ': ' + x.st[B.v - 1] : ''; }).filter(Boolean).join(' · ')))}${exZeile('Recherche', W.recherche ? fmtDate(W.recherche) : '')}</table>
    ${W.notiz ? '<div class="ex-txt">' + exFmt(W.notiz) + '</div>' : ''}${(W.beispiele || []).length ? '<p class="ex-k"><b>Beispiele:</b> ' + esc(W.beispiele.map(x => x.titel).filter(Boolean).join(' · ')) + '</p>' : ''}`;
  const kont = e.kontakte.filter(k => k.n.trim()).map(k => `<div>${k.anschreiben === 'ja' ? '★ ' : ''}${esc(k.n)}${[k.pos, k.mail, k.tel, k.gl.length ? 'für ' + k.gl.join(', ') : ''].filter(Boolean).length ? ' <span class="ex-k">· ' + esc([k.pos, k.mail, k.tel, k.gl.length ? 'für ' + k.gl.join(', ') : ''].filter(Boolean).join(' · ')) + '</span>' : ''}${k.anschreiben === 'nein' ? ' <span class="ex-k">· nicht anschreiben</span>' : ''}</div>`).join('');
  const ansp = e.ansprache.map(a => `<div><b>${esc(a.gl || 'alle')}:</b> ${esc(a.titel || (a.art === 'nicht anschreiben' ? 'Nicht anschreiben' : 'Hinweis'))}${a.hinweis ? ' – ' + esc(flPlain(a.hinweis)) : ''}</div>`).join('');
  const hist = H.length ? `<table class="ex-plan"><thead><tr><th>Jahr</th><th>Ergebnis</th><th>Betrag</th><th>Zweck</th><th>Gliederung</th></tr></thead><tbody>${H.slice(0, 25).map(x => `<tr><td>${esc(x.jahr)}</td><td>${esc(x.ergebnis)}${x.grund ? '<div class="ex-k">' + esc(x.grund) + '</div>' : ''}</td><td>${x.betrag ? eur(x.betrag) : '–'}</td><td>${esc(x.zweck)}</td><td>${esc((x.gl || []).join(', '))}</td></tr>`).join('')}</tbody></table>` : '';
  return `<h1>${esc(e.name || '(ohne Namen)')}${e.kurz ? ' <span class="ex-k">(' + esc(e.kurz) + ')</span>' : ''}</h1>
    <p class="ex-k">${esc([e.art, e.status !== 'aktiv' ? e.status : '', K.n ? K.n + ' Förderungen seit ' + K.seit + ', zusammen ' + eur(K.sum) : 'keine Förderung seit ' + K.seit].filter(Boolean).join(' · '))}</p>
    ${ansp ? '<h2>Hinweise zur Ansprache</h2>' + ansp : ''}${kont ? '<h2>Ansprechpersonen</h2>' + kont : ''}
    ${e.topfe.length ? T.map(t => '<h2>Fördertopf: ' + esc(t.name || '(ohne Namen)') + '</h2>' + steck(t)).join('') : '<h2>Steckbrief</h2>' + steck(e)}
    ${hist ? '<h2>Förderungen und Absagen</h2>' + hist : ''}`;
}

/* ---------- Excel der Bedarfe */
function exBedarfeXlsx(L) {
  const kopf = { b: true, color: '#FFFFFF', fill: '#404040', v: 'center', wrap: true, border: 'thin' }, z = { border: 'thin', v: 'top', wrap: true };
  const K = ['Bedarf', 'Gliederung', 'Summe (€)', 'Priorität', 'Stand', 'Was fehlt', 'Deadline', 'Nächste Frist', 'Frist für', 'zugesagt (€)', 'offen (€)', 'Freigabe', 'Ansprechperson', 'E-Mail', 'Stichworte', 'Archiv'];
  const R = L.map(b => { const p = phase(b), F = finState(b), x = nextFrist(b), o = frOffen(b), z0 = b.zust.find(q => q.n.trim()) || {};
    return [b.titel, b.gliederung, b.summe ?? '', b.prio, phaseName(p), p.t + (p.sub ? ': ' + p.sub : ''), b.deadline ? fmtDate(b.deadline) : '', x ? fmtDate(x.d) : '', x ? x.t : '', F.zu || '', F.d > 0 ? F.d : '', o.names.length ? 'es fehlt: ' + o.names.join(', ') : 'vollständig', z0.n || '', z0.mail || '', b.stichworte.join(', '), b.archiv ? 'ja' : '']; });
  const KF = ['Bedarf', 'Gliederung', 'Förderer', 'Stand', 'Betrag (€)', 'eingegangen (€)', 'Antragsfrist', 'beantragt am', 'Antwort erwartet', 'Nachweis bis', 'Einschätzung', 'Argumente', 'Knackpunkte'];
  const RF = L.flatMap(b => b.foerderer.filter(f => f.name.trim() || f.betrag).map(f => [b.titel, b.gliederung, f.name, F_ST_L[f.status], foeAmt(f) || '', f.eingegangen ?? '', f.frist ? fmtDate(f.frist) : '', f.beantragtAm ? fmtDate(f.beantragtAm) : '', f.erwartet ? fmtDate(f.erwartet) : '', f.vn.noetig && f.vn.frist ? fmtDate(f.vn.frist) : '', exEinsch(f.einsch), exPlain(f.warum), exPlain(f.knackpunkte)]));
  const blatt = (name, K, R, w) => ({ name, cols: w, rows: [K.map(v => ({ v, st: kopf })), ...R.map(r => r.map(v => ({ v, st: z })))], heights: { 0: 30 }, freeze: 'B2', filter: 'A1:' + colName(K.length - 1) + (R.length + 1) });
  return xlsxBlob([blatt('Bedarfe', K, R, [40, 16, 11, 9, 18, 40, 11, 12, 30, 12, 11, 30, 22, 28, 24, 7]), blatt('Förderplan', KF, RF, [36, 16, 30, 11, 11, 12, 11, 11, 12, 11, 18, 40, 40])]);
}

/* ---------- Termine für Outlook: eine .ics mit allen künftigen Terminen der Auswahl, ganztägig, mit Erinnerung */
const EX_VORHER = [['0', 'keine Erinnerung'], ['tag', 'am Tag selbst (8 Uhr)'], ['1t', '1 Tag vorher'], ['3t', '3 Tage vorher'], ['1w', '1 Woche vorher'], ['2w', '2 Wochen vorher'], ['4w', '4 Wochen vorher']];
const EX_TRIGGER_ZEIT = { tag: '-PT1H', '1t': '-P1D', '3t': '-P3D', '1w': '-P7D', '2w': '-P14D', '4w': '-P28D' };   // Termin mit Uhrzeit (Spendenübergabe)
const EX_TRIGGER = { tag: 'PT8H', '1t': '-PT16H', '3t': '-P2DT16H', '1w': '-P6DT16H', '2w': '-P13DT16H', '4w': '-P27DT16H' };   // ganztägig: ab Mitternacht – Erinnerung jeweils um 8 Uhr
function exTermine(was, L, arten) {
  const heute = today(), T = [];
  if (was === 'f') {
    if (!arten.has('flfrist')) return T;
    const y = +heute.slice(0, 4);
    for (const e of L) { const s = new Set(); for (const j of [y, y + 1]) for (const x of flFristDatenSicher(e, j)) { const k = x.iso + '|' + (x.topf || ''); if (x.iso < heute || s.has(k)) continue; s.add(k);
      T.push({ d: x.iso, uid: e.id + '-' + x.iso + '-' + norm(x.topf || '').replace(/\W+/g, ''), t: 'Frist ' + (e.kurz || e.name) + (x.topf && e.topfe.length > 1 ? ' – ' + x.topf : ''), beschr: [e.name, x.topf ? 'Fördertopf: ' + x.topf : '', e.web ? 'Homepage: ' + e.web : '', 'aus der Fördererliste (Bedarfsliste)'].filter(Boolean).join('\n') }); } }
    return T.sort((a, c) => a.d.localeCompare(c.d));
  }
  for (const b of L) {
    const alle = fristen(b);
    const dl = arten.has('deadline') && b.deadline && !alle.some(x => x.z === 'deadline') ? [{ d: b.deadline, t: 'Deadline des Bedarfs', z: 'deadline' }] : [];
    for (const x of alle.concat(dl)) {
      if (!arten.has(x.z) || x.d < heute) continue;
      T.push({ d: x.d, uid: b.id + '-' + x.z + '-' + (x.fid || '0'), t: x.t + ' – ' + (b.titel || 'Bedarf') + (b.gliederung ? ' (' + b.gliederung + ')' : ''), beschr: [(b.titel || 'Bedarf') + (b.summe ? ' – ' + eur(b.summe) : ''), b.gliederung ? 'Gliederung: ' + b.gliederung : '', 'aus der Bedarfsliste'].filter(Boolean).join('\n').replace(/ /g, ' '),
        zeit: x.z === 'ueb' ? b.nach.ueb.zeit : '', ort: x.z === 'ueb' ? b.nach.ueb.ort : '' });
    }
  }
  return T.sort((a, c) => a.d.localeCompare(c.d));
}
const flFristDatenSicher = (e, j) => { try { return flFristenDaten(e, j); } catch (x) { return []; } };
function exIcs(was, L, arten, vorher) {
  const T = exTermine(was, L, arten);
  if (!T.length) { toast('In der Auswahl gibt es keine künftigen Termine dieser Art.', 'warn'); return; }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', tr = EX_TRIGGER[vorher];
  const K = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Malteser Dioezese Paderborn//Bedarfsliste//DE', 'METHOD:PUBLISH'];
  for (const x of T) {
    const m = /^(\d{1,2}):(\d{2})/.exec(x.zeit || ''), st = m ? new Date(x.d + 'T' + m[1].padStart(2, '0') + ':' + m[2] + ':00') : null, morgen = new Date(x.d + 'T12:00'); morgen.setDate(morgen.getDate() + 1);
    K.push('BEGIN:VEVENT', 'UID:' + x.uid + '@bedarfsliste', 'DTSTAMP:' + stamp,
      st ? 'DTSTART:' + icsZeit(st) : 'DTSTART;VALUE=DATE:' + x.d.replace(/-/g, ''), st ? 'DTEND:' + icsZeit(new Date(st.getTime() + 36e5)) : 'DTEND;VALUE=DATE:' + icsZeit(morgen).slice(0, 8),
      'SUMMARY:' + icsText(x.t), x.ort ? 'LOCATION:' + icsText(x.ort) : null, 'DESCRIPTION:' + icsText(x.beschr), 'TRANSP:TRANSPARENT', 'X-MICROSOFT-CDO-BUSYSTATUS:FREE');
    if (tr) K.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(x.t), 'TRIGGER:' + (st ? EX_TRIGGER_ZEIT[vorher] : tr), 'END:VALARM');
    K.push('END:VEVENT');
  }
  K.push('END:VCALENDAR');
  download((was === 'f' ? 'Fristen Fördererliste ' : 'Termine Bedarfe ') + today() + '.ics', new Blob([K.filter(Boolean).map(icsFalten).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }));
  if (!DEMO) toast(T.length + (T.length === 1 ? ' Termin' : ' Termine') + ' heruntergeladen – Datei öffnen, dann übernimmt Outlook sie.', 'ok');
}
