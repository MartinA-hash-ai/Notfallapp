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
document.addEventListener('mousemove', ev => {
  const n = document.querySelector('.seitenleiste'); if (!n) return;
  const r = n.getBoundingClientRect(), nah = ev.clientX < r.right + 70 && ev.clientY > r.top - 90 && ev.clientY < r.bottom + 90;
  if (n.classList.contains('nah') !== nah) n.classList.toggle('nah', nah);
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
// Verwendungszweck (Kostenstellen): Inhalt folgt
function zweckDialog() {
  closeMenus();
  modal('Verwendungszweck', h('div', { class: 'sl-leer' }, h('div', { class: 'sl-leer-i', html: ICON_ZIEL }), h('p', {}, 'Hier stehen bald die Kostenstellen bzw. Verwendungszwecke zum Nachschlagen.')), [['Schließen', true, 'primary']], { cls: 'sl-modal' });
}
