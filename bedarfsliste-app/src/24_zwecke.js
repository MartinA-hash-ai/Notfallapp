/* ===================================================================== Gemeinnützige Zwecke der Malteser (ab 0.98)
   Grundlage für die spätere Auswahl beim Förderzweck eines Förderers: Zwecke, die für die Malteser nicht gelten (z. B. Kultur), sind für uns nicht relevant.
   Stand der Recherche 01.11.2026 aus Zusammenfassungen der Malteser-Dokumente (Satzung des Malteser Hilfsdienst e.V., „Vereinfachter Spendennachweis“) –
   die Originale konnten nicht selbst gelesen werden; vor Verwendung in Anträgen im PDF prüfen:
   malteser.de/spenden-helfen/transparenz/satzung.html · malteser.de/fileadmin/Files_sites/Fachbereiche/Spenden/Spenden-und-Helfen/Transparenz/Vereinfachter_Spendennachweis_MHD_eV.pdf
   Die Zuordnung der Nummern zu den Zwecken (§ 52 Abs. 2 AO) stammt aus der AO, nicht aus den Malteser-Dokumenten. */
const MHD_ZWECKE = [
  { nr: 3, t: 'Öffentliche Gesundheitspflege', w: ['gesundheit', 'pflege', 'medizin', 'krankheit', 'prävention'] },
  { nr: 4, t: 'Jugend- und Altenhilfe', w: ['jugend', 'kinder', 'senioren', 'alten', 'ältere', 'altenhilfe'] },
  { nr: 7, t: 'Erziehung, Volks- und Berufsbildung', w: ['bildung', 'erziehung', 'qualifizierung', 'ausbildung', 'schulung'] },
  { nr: 9, t: 'Wohlfahrtswesen', w: ['wohlfahrt', 'soziale', 'sozial', 'hilfsbedürftig', 'obdach', 'wohnungslos'] },
  { nr: 10, t: 'Hilfe für Verfolgte, Flüchtlinge, Vertriebene', w: ['flucht', 'geflüchtete', 'flüchtlinge', 'migration', 'integration', 'vertriebene'] },
  { nr: 11, t: 'Rettung aus Lebensgefahr', w: ['rettung', 'rettungsdienst', 'lebensgefahr', 'erste hilfe'] },
  { nr: 12, t: 'Katastrophen- und Zivilschutz (Bevölkerungsschutz)', w: ['katastrophenschutz', 'zivilschutz', 'bevölkerungsschutz', 'unfallverhütung', 'sanitätsdienst'] },
  { nr: 15, t: 'Entwicklungszusammenarbeit', w: ['entwicklung', 'international', 'ausland', 'hilfe weltweit'] },
  { nr: 19, t: 'Schutz von Ehe und Familie', w: ['familie', 'ehe', 'eltern'] },
  { nr: 25, t: 'Bürgerschaftliches Engagement (Ehrenamt)', w: ['ehrenamt', 'engagement', 'freiwillig', 'bürgerschaftlich'] },
  { nr: 0, t: 'Mildtätige Zwecke (§ 53 AO): selbstlose Unterstützung hilfsbedürftiger Personen', w: ['mildtätig', 'bedürftig', 'hilfsbedürftig', 'arm'] },
  { nr: 0, t: 'Kirchliche Zwecke (§ 54 AO): Förderung der römisch-katholischen Kirche', w: ['kirche', 'kirchlich', 'katholisch', 'religion'] },
];
// Zwecke der Malteser, die im Förderzweck eines Förderers vorkommen (Stichworte, später für die Auswahl)
const mhdZweckeIn = text => { const t = norm(flPlainSafe(text)); return MHD_ZWECKE.filter(z => z.w.some(w => t.includes(w))); };
const flPlainSafe = t => typeof flPlain === 'function' ? flPlain(t) : String(t || '');
function mhdZweckeZeigen() {
  modal('Gemeinnützige Zwecke der Malteser', h('div', { class: 'mhd-zw' },
    h('p', { class: 'muted small' }, 'Für diese Zwecke ist der Malteser Hilfsdienst e. V. als gemeinnützig anerkannt. Förderzwecke, die hier nicht vorkommen (z. B. Kultur), sind für uns nicht relevant. Später lässt sich der Förderzweck eines Förderers aus dieser Liste auswählen.'),
    h('ul', null, ...MHD_ZWECKE.map(z => h('li', null, h('b', null, z.t), z.nr ? h('span', { class: 'muted' }, ' · § 52 Abs. 2 Nr. ' + z.nr + ' AO') : null))),
    h('p', { class: 'muted small' }, 'Stand der Recherche: 01.11.2026, aus Zusammenfassungen von Satzung (§ 2 Ziff. 2, § 3 Ziff. 1) und „Vereinfachtem Spendennachweis“ des Vereins; die Zuordnung zu den Nummern der Abgabenordnung stammt nicht aus diesen Dokumenten. Vor Verwendung in einem Antrag bitte in der Satzung auf malteser.de gegenprüfen.')));
}
