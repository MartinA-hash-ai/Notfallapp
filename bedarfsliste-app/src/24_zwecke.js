/* ===================================================================== Gemeinnützige Zwecke der Malteser (ab 0.98)
   Dient dem Programm als Abgleich mit den Zwecken eines Förderers (z. B. für die spätere Auswahl beim Förderzweck): Zwecke, die für die Malteser nicht gelten
   (z. B. Kultur), sind für uns nicht relevant. Grundlage: Anlage 1 zum Körperschaftsteuerbescheid 2024 des Malteser Hilfsdienst e.V. (Finanzamt Köln-Ost, 29.05.2026),
   „Hinweise zu steuerbegünstigten Zwecken“ – dort steht: mildtätige, kirchliche und die folgenden gemeinnützigen Zwecke (§ 52 Abs. 2 Satz 1 AO). */
const MHD_ZWECKE = [
  { k: 'Religion', nr: 2, t: 'Förderung der Religion', w: ['religion', 'glaube', 'seelsorge'] },
  { k: 'Gesundheit', nr: 3, t: 'Förderung des öffentlichen Gesundheitswesens und der öffentlichen Gesundheitspflege', w: ['gesundheit', 'pflege', 'medizin', 'krankheit', 'prävention'] },
  { k: 'Jugendhilfe', nr: 4, t: 'Förderung der Jugendhilfe', w: ['jugend', 'kinder'] },
  { k: 'Altenhilfe', nr: 4, t: 'Förderung der Altenhilfe', w: ['senioren', 'alten', 'ältere'] },
  { k: 'Bildung', nr: 7, t: 'Förderung der Volks- und Berufsbildung einschließlich der Studentenhilfe', w: ['bildung', 'erziehung', 'qualifizierung', 'ausbildung', 'schulung'] },
  { k: 'Wohlfahrt', nr: 9, t: 'Förderung des Wohlfahrtswesens', w: ['wohlfahrt', 'soziale', 'sozial', 'obdach', 'wohnungslos'] },
  { k: 'Hilfe für Verfolgte und Geflüchtete', nr: 10, t: 'Förderung der Hilfe für politisch, rassistisch oder religiös Verfolgte, für Flüchtlinge und Vertriebene', w: ['flucht', 'geflüchtete', 'flüchtlinge', 'migration', 'integration', 'vertriebene'] },
  { k: 'Rettung aus Lebensgefahr', nr: 11, t: 'Förderung der Rettung aus Lebensgefahr', w: ['rettung', 'rettungsdienst', 'lebensgefahr', 'erste hilfe'] },
  { k: 'Katastrophen- und Zivilschutz', nr: 12, t: 'Förderung des Katastrophen- und Zivilschutzes', w: ['katastrophenschutz', 'zivilschutz', 'bevölkerungsschutz', 'sanitätsdienst'] },
  { k: 'Entwicklungszusammenarbeit', nr: 15, t: 'Förderung der Entwicklungszusammenarbeit', w: ['entwicklung', 'international', 'ausland'] },
  { k: 'Ehe und Familie', nr: 19, t: 'Förderung des Schutzes von Ehe und Familie', w: ['familie', 'ehe', 'eltern'] },
  { k: 'Bürgerschaftliches Engagement', nr: 25, t: 'Förderung des bürgerschaftlichen Engagements', w: ['ehrenamt', 'engagement', 'freiwillig', 'bürgerschaftlich'] },
  { k: 'Mildtätige Zwecke', nr: 0, t: 'Mildtätige Zwecke (§ 53 AO)', w: ['mildtätig', 'bedürftig', 'hilfsbedürftig'] },
  { k: 'Kirchliche Zwecke', nr: 0, t: 'Kirchliche Zwecke (§ 54 AO)', w: ['kirche', 'kirchlich', 'katholisch'] },
];
// Zwecke der Malteser, die im Förderzweck eines Förderers vorkommen (Stichworte)
const mhdZweckeIn = text => { const t = norm(typeof flPlain === 'function' ? flPlain(text) : String(text || '')); return MHD_ZWECKE.filter(z => z.w.some(w => t.includes(w))); };
