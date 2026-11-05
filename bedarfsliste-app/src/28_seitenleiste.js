/* ===================================================================== Seitenleiste links (ab 0.125)
   Drei weiße Knöpfe am linken Rand, immer etwa auf halber Höhe (auch beim Scrollen): Verwendungszweck, Kontenliste, Gebietsnummern.
   Sie stecken zum Teil hinter dem Rand; kommt die Maus in die Nähe, lugen sie ein paar Pixel hervor, beim Darüberfahren noch etwas mehr,
   daneben erscheint der Name. Ein Klick öffnet das jeweilige Fenster. */
const ICON_ZIEL = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="13" r="8.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="11" cy="13" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M11 13 19.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M17 3.2 20.8 3.2 20.8 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_TEMPEL = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.5 21.5 7.2H2.5z" fill="currentColor"/><rect x="3" y="8.3" width="18" height="1.8" rx=".9" fill="currentColor"/><path d="M5.6 11.2h2.2v6.6H5.6zM10.9 11.2h2.2v6.6h-2.2zM16.2 11.2h2.2v6.6h-2.2z" fill="currentColor"/><rect x="3" y="18.6" width="18" height="1.6" rx=".8" fill="currentColor"/><rect x="2" y="20.8" width="20" height="1.6" rx=".8" fill="currentColor"/></svg>';
const ICON_PIN = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 1.8a7.6 7.6 0 0 0-7.6 7.6c0 5.6 7.6 12.8 7.6 12.8s7.6-7.2 7.6-12.8A7.6 7.6 0 0 0 12 1.8zm0 10.5a2.9 2.9 0 1 1 0-5.8 2.9 2.9 0 0 1 0 5.8z" fill="currentColor"/></svg>';
const SEITE_KNOEPFE = [['sl-zweck', ICON_ZIEL, 'Verwendungszweck'], ['konten', ICON_TEMPEL, 'Kontenliste'], ['sl-gebiet', ICON_PIN, 'Gebietsnummern']];
const seitenleisteHtml = () => `<nav class="seitenleiste" aria-label="Nachschlagen">${SEITE_KNOEPFE.map(([act, ic, t]) => `<button type="button" class="sl-k" data-act="${act}" aria-label="${t}">${ic}<span class="sl-t">${t}</span></button>`).join('')}</nav>`;
// Maus in der Nähe (linker Rand, ungefähr auf Höhe der Knöpfe): Knöpfe lugen hervor
// jeder Knopf für sich: wenn die Maus auf seiner Höhe bis etwa 70 px an den Knopf herankommt
document.addEventListener('mousemove', ev => {
  for (const k of document.querySelectorAll('.seitenleiste .sl-k')) {
    const r = k.getBoundingClientRect(), nah = ev.clientX < r.right + 70 && ev.clientY >= r.top - 3 && ev.clientY <= r.bottom + 3;
    if (k.classList.contains('nah') !== nah) k.classList.toggle('nah', nah);
  }
}, { passive: true });

// Gebietsnummern der Diözese Paderborn (Liste der Diözesangeschäftsstelle)
const GEBIETE = [['160101', 'DGS Paderborn'], ['160102', 'Hospizdienste Dortmund'], ['160103', 'Lourdes Wallfahrt'], ['160111', 'Kreisgliederung PB'], ['160112', 'Hospizdienste Schwerte'],
  ['160135', 'Lage-Lippe'], ['160189', 'MBZ Westfalen (Schule Dortmund)'], ['160191', 'Bezirk Ostwestfalen-Lippe'], ['160192', 'Bezirk Ruhrgebiet-Hellweg'], ['160193', 'Bezirk Südwestfalen'],
  ['160707', 'Borchen'], ['160808', 'Brakel'], ['161010', 'Hövelhof'], ['161111', 'Büren'], ['161212', 'Altenbeken'], ['161313', 'Emscher-Ruhr'], ['161717', 'Geseke'], ['162222', 'Fröndenberg'],
  ['162323', 'Herzebrock'], ['162424', 'Höxter'], ['162727', 'Bad Laasphe'], ['162828', 'Lennestadt'], ['163131', 'Lippstadt'], ['163232', 'Iserlohn-Menden'], ['163636', 'Olsberg'],
  ['163737', 'Olpe Stadt'], ['163838', 'Bielefeld'], ['163939', 'Paderborn Stadt'], ['164040', 'Rheda-Wiedenbrück'], ['164747', 'Steinheim'], ['164949', 'Herne'], ['165151', 'Warstein'],
  ['165252', 'Wenden'], ['165858', 'Arnsberg-Meschede'], ['165959', 'Balve'], ['167070', 'Netphen'], ['168181', 'Hagen'], ['168282', 'Siegen'], ['168306', 'Malteserladen Dortmund'],
  ['168383', 'Dortmund'], ['168484', 'Hamm'], ['168585', 'Rietberg'], ['168686', 'Gütersloh'], ['168888', 'Kreis Unna / Schwerte'], ['168989', 'Werl-Soest']];
async function gebieteDialog() {
  closeMenus();
  const such = h('input', { type: 'search', class: 'k-such', placeholder: 'Gliederung oder Nummer suchen …', 'aria-label': 'Gebietsnummer suchen' });
  const wrap = h('div', { class: 'k-wrap sl-wrap' });
  const zeig = () => { const q = norm(such.value);
    const L = GEBIETE.filter(([n, g]) => !q || n.includes(q) || norm(g).includes(q));
    wrap.innerHTML = `<table class="k-tab sl-tab"><thead><tr><th>Gebietsnummer</th><th>Gliederung</th></tr></thead><tbody>${L.map(([n, g]) => `<tr><td>${kKopierbar(n, 'k-iban', 'Klicken: Gebietsnummer kopieren', n)}</td><td>${kKopierbar(g, 'sl-gl', 'Klicken: Namen kopieren', esc(g))}</td></tr>`).join('')
      || `<tr><td colspan="2" class="muted k-nix">Nichts passt zu „${esc(such.value)}“.</td></tr>`}</tbody></table>`; };
  such.addEventListener('input', zeig);
  wrap.addEventListener('click', e => { const c = e.target.closest('.k-c'); if (c) kopiereZeichen(c); });
  zeig();
  await modal('Gebietsnummern', h('div', { class: 'k-box' }, h('div', { class: 'k-kopf' }, such), wrap), [], { wide: true, cls: 'k-modal sl-modal', expose: () => setTimeout(() => such.focus(), 40) });
}
// Verwendungszweck: Kostenstellen nach Bereichen (Liste „Kostenstellen“); Suche nach Nummer, Name oder Bereich, ein Klick kopiert
const KOSTEN = [
  ["Verwaltung", [["9100", "Mitglieder"], ["9140", "abzugsfähige Kosten Mitgliederumlage"], ["9150", "Fundraising"], ["9151", "Mailingmittel"], ["9200", "Vermögensverwaltung"], ["9300", "Veranstaltungen MHD-intern"], ["9400", "Veranstaltungen MHD-extern"], ["9510", "GF/allg. Verwaltung"], ["9520", "Umlagen"], ["9550", "Presse- und Öffentlichkeitsarbeit"], ["9600", "Hausverwaltung"], ["9700", "Werkstatt/Tankstelle/Kfz"], ["9988", "Sanierungskosten"]]],
  ["Ausbildung", [["1100", "Erste Hilfe"], ["1500", "RD/extern"], ["1650", "Sozialpflegerische Ausbildung"], ["1200", "Abenteuer Helfen"], ["1400", "EH-Bundesprogramm"], ["1700", "Helfer intern"], ["1800", "Hilfskostenstelle Ausbildung"]]],
  ["Soziales Ehrenamt", [["2300", "ehrenamtliche Sozialdienste"], ["2310", "Besuchs- und Betreuungsdienste"], ["2311", "Einsamkeit"], ["2320", "Migrantenmedizin"], ["2330", "Demenzdienste"], ["2340", "Flüchtlingsbetreuung"], ["2341", "Ehrenamtskoordinator"], ["2342", "Erstorientierung"], ["2343", "Sonstige Projekte FLUE"], ["2360", "Herzenswunsch-KTW"], ["2370", "Teilhabeberatung EUTB"], ["2830", "Betreuung bei Blutspende (DRK)"]]],
  ["Hospiz", [["2400", "Hospizarbeit"], ["2410", "besondere Hospizdienste"], ["2450", "Trauerarbeit"]]],
  ["Notfallvorsorge", [["5100", "Katastrophenschutz Bund"], ["5200", "Katastrophenschutz Land"], ["2100", "Einsätze"], ["2150", "Psychosoziale Begleitung"]]],
  ["Jugend und Schule", [["6100", "Malteser Jugend"], ["6200", "Schulsanitätsdienst"], ["6300", "Schulprojekte"]]],
  ["Auslandsdienst", [["9410", "Auslandsdienst"]]],
  ["Rettungsdienst / Krankentransport", [["3100", "Öffentlicher Rettungsdienst"], ["3200", "Sonstige Rettungs- und Krankentransporte"], ["3300", "Rückholdienst"]]],
  ["Fahrdienste", [["4100", "Behindertenfahrdienst"], ["4200", "Individual Transport für Behinderte"], ["4300", "Behinderten-Reisedienst"]]],
  ["Hausnotruf", [["2200", "Hausnotruf"]]],
  ["Mahlzeitendienst", [["2500", "Mahlzeitendienst"], ["2510", "MZD steuerpflichtig"]]],
  ["Pflege", [["2350", "Stationäre Einrichtungen"], ["2670", "Leistungskomplexe ohne Pflegegrad"], ["2600", "Leistungskomplexe Pflegegrad 1"], ["2610", "Leistungskomplexe Pflegegrad 2"], ["2620", "Leistungskomplexe Pflegegrad 3"], ["2630", "Leistungskomplexe Pflegegrad 4"], ["2640", "Leistungskomplexe Pflegegrad 5"], ["2650", "Verhinderungspflege gem. §39"], ["2660", "Sonstige Leistungen nach SGB XI"], ["2665", "Sonstige Erträge aus ambulanten Leistungen"], ["2680", "Entlastungsleistungen gem. §45"], ["2690", "Investitionskosten"], ["2710", "Leistungen nach SGB V"], ["2730", "Leistungen nach BSHG"]]],
  ["Betreutes Wohnen", [["2380", "Betreutes Wohnen"]]],
  ["wirt. Geschäftsbetr. Betreuungsdienst", [["2810", "Küchenumsätze"], ["2820", "Cafeteria"]]],
  ["wirt. Geschäftsbetr. Rettungsdienst/Kranentransport", [["3380", "Rückholdfahrdienste mit PKW"], ["3810", "Transport von Kranken im PKW"], ["3820", "Beförderung gesunder Personen"], ["3830", "Medikamententransport"], ["3840", "Ärzte im Notfall-Vertretungsdienst"], ["3850", "Kfz-Verkauf"]]],
  ["wirt. Geschäftsbetr. Sonstiges", [["9811", "Altkleidersammlung"], ["9812", "Altkleidersammlung mit fremden Containern"], ["9813", "Verwertung Alt-Handys"], ["9815", "Altpapier-/Altglasverkäufe"], ["9821", "Materialverkäufe"], ["9823", "Projekte im WGB"], ["9831", "Gesellige Veranstaltungen"], ["9832", "Basare und Malteserläden"], ["9843", "Lotterien in eigener Regie"], ["9850", "Transport von Sachgütern"], ["9861", "Werkstattleistungen für Dritte"], ["9862", "Personalgestellung"], ["9870", "Vermietung beweglicher Sachen"], ["9880", "Verkauf von Tankstellenprodukten"], ["9885", "(Haus-)Notrufbesetzungen ggü. gewerbl. Auftraggebern"], ["9886", "Sicherheit Plus und Rauchmelder"], ["9890", "Verwertung von Nachlässen"], ["9892", "Parkplatzdienst"], ["9893", "Steuerpflichtige Verwaltungsleistungen/Umlagen an Orts e. V."], ["9894", "Hotelähnliche Leistungen"], ["9895", "Automatenverkäufe"], ["9896", "Einnahmen aus Inseraten"], ["9898", "Einnahmen aus aktivem Sponsoring"], ["9899", "Sonstige WG"]]]];
async function zweckDialog() {
  closeMenus();
  const such = h('input', { type: 'search', class: 'k-such', placeholder: 'Kostenstelle suchen, z. B. Hospiz oder 2400 …', 'aria-label': 'Kostenstelle suchen' });
  const wrap = h('div', { class: 'k-wrap sl-wrap' });
  const zeig = () => { const q = norm(such.value);
    const T = KOSTEN.map(([b, L]) => [b, norm(b).includes(q) ? L : L.filter(([n, t]) => n.includes(q) || norm(t).includes(q))]).filter(([, L]) => L.length);
    wrap.innerHTML = `<table class="k-tab sl-tab"><thead><tr><th>Kostenstelle</th><th>Bezeichnung</th></tr></thead><tbody>${T.map(([b, L]) => `<tr class="sl-gr"><th colspan="2">${esc(b)}</th></tr>`
      + L.map(([n, t]) => `<tr><td>${kKopierbar(n, 'k-iban', 'Klicken: Kostenstelle kopieren', n)}</td><td>${kKopierbar(t, 'sl-gl', 'Klicken: Bezeichnung kopieren', esc(t))}</td></tr>`).join('')).join('')
      || `<tr><td colspan="2" class="muted k-nix">Nichts passt zu „${esc(such.value)}“.</td></tr>`}</tbody></table>`; };
  such.addEventListener('input', zeig);
  wrap.addEventListener('click', e => { const c = e.target.closest('.k-c'); if (c) kopiereZeichen(c); });
  zeig();
  await modal('Verwendungszweck – Kostenstellen', h('div', { class: 'k-box' }, h('div', { class: 'k-kopf' }, such), wrap), [], { wide: true, cls: 'k-modal sl-modal', expose: () => setTimeout(() => such.focus(), 40) });
}
