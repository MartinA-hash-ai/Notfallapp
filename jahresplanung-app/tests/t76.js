// 0.47: Kopfzeile mit Zahnrad (Einstellungen und Werkzeuge) und Diskette beim Speichern; „Spendenzwecke zuordnen“ aufgeräumt – Regeln und Vorschläge
// anfangs zu (Knöpfe im Kopf, gemerkt), beim Zweck immer seine Spenden, Treffer immer gelb, ohne Hinweis links und ohne Anzahl/Summe im Kopf
const { chromium, ok, open, connect, finish } = require('./lib');
const HEAD = 'Buchungsdatum;Valuta;Betrag €;BLZ / BIC;Kontonummer / IBAN;Kontoinhaber;Typ;Verwendungszweck;Buchungstext;Personenname';
const p2 = x => String(x).padStart(2, '0');
const L = (d, b, who, zw) => [d, d, String(b), "'TESTDE11XXX", 'DE00100000000000' + who, 'Probe ' + who, "'Zugang/Gutschrift", zw, "'Spendengutschrift", "'Paderborn - Lage"].join(';');
const csv = r => '﻿' + [HEAD, ...r].join('\r\n') + '\r\n';
(async () => {
  const b = await chromium.launch(), pages = [];
  const p = await open(b, { width: 1500 }); pages.push(p);
  ok(await connect(p) === 'ok', 'Mailing-Ordner verbunden');
  // ---- A: Kopfzeile
  const a0 = await p.evaluate(() => { const g = document.querySelector('header .actions .menu-btn.gear'), s = document.querySelector('#savebox');
    return [!!g && !!g.querySelector('svg') && !/⋯/.test(g.textContent), g && g.getAttribute('aria-label'), !!s.querySelector('.ico svg'), s.querySelector('.save-t').textContent]; });
  ok(a0[0] && a0[1] === 'Einstellungen und Werkzeuge' && a0[2] && /^(Gespeichert|wird gespeichert|Speichert)/.test(a0[3]), 'A: Zahnrad statt ⋯, Speichern mit Diskette: ' + JSON.stringify(a0));
  await p.click('header .actions .menu-btn.gear'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => [...document.querySelectorAll('.menu button')].map(e => e.textContent).join('|') === 'Einstellungen …|Daten prüfen …|Daten zurücksetzen …|☾ Dunkles Design|Programm-Update einspielen …'), 'A: Zahnrad-Menü – Einstellungen zuerst, dann die Werkzeuge');
  await p.keyboard.press('Escape');
  // ---- B: Spendenzwecke zuordnen – Grundzustand
  const rows = []; for (let m = 1; m <= 6; m++) { rows.push(L('05.' + p2(m) + '.2027', 20, '00000' + m, 'Spende Rikscha')); rows.push(L('12.' + p2(m) + '.2027', 50, '00010' + m, 'Spende Wärmebus')); rows.push(L('20.' + p2(m) + '.2027', 30, '00020' + m, 'Spende Jubiläum')); }
  await p.evaluate(t => { __fs.files['/Mailing/Spendeneingänge 2027/e.csv'] = { data: new TextEncoder().encode(t), lm: 81000 }; }, csv(rows));
  await p.evaluate(() => commit(d => { d.zwecke.push({ id: 'zr', name: 'Rikscha', farbe: '#2e7d32', worte: ['Rikscha'], konten: [], massnahmen: [] }); }));
  await p.evaluate(() => { UI.year = 2027; UI.view = 'spenden'; UI.spMid = 'allg:2027'; SP.at = null; renderNow(); spScan({ manual: true }); }); await p.waitForFunction(() => SP.rows.length === 18); await p.waitForTimeout(300);
  await p.click('.spj-zi[data-z="zr"]'); await p.waitForTimeout(200);
  const b0 = await p.evaluate(() => ({ rules: !!document.querySelector('.spj-rules'), sug: !!document.querySelector('.spj-sugbar'), tog: [...document.querySelectorAll('.spj-zh .spj-tog')].map(t => t.textContent).join('|'),
    lv: !!document.querySelector('.spj-lv'), title: document.querySelector('.spj-lh b').textContent, n: document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length, hlt: !!document.querySelector('.sp-hltog'),
    marks: document.querySelectorAll('[data-sec="sp-zu"] mark.sp-hl').length, hint: /Klick = Zweck/.test(document.querySelector('.spj-side').textContent), zst: !!document.querySelector('.spj-zh .spj-zst') }));
  ok(!b0.rules && !b0.sug && b0.tog === 'Regeln (1) ▾|Vorschläge ▾', 'B: Regeln und Vorschläge anfangs zu – im Kopf die Knöpfe „Regeln (1)“ und „Vorschläge“ ' + JSON.stringify(b0));
  ok(!b0.lv && b0.title === 'Zugeordnet' && b0.n === 6 && !b0.hlt && b0.marks === 6, 'B: beim Zweck „Zugeordnet“ mit seinen 6 Spenden – ohne Umschalter, Treffer immer gelb, ohne Schalter dafür');
  ok(!b0.hint && !b0.zst, 'B: kein Hinweis „Klick = Zweck wählen …“ links, keine Anzahl/Summe neben dem Namen');
  await p.click('.spj-tog:has-text("Regeln")'); await p.click('.spj-tog:has-text("Vorschläge")'); await p.waitForTimeout(250);
  const b1 = await p.evaluate(() => [!!document.querySelector('.spj-rules .sp-newrule'), !!document.querySelector('.spj-sugbar'), UI.spjRulesOpen, UI.spjSugOpen, UI_KEYS.includes('spjRulesOpen') && UI_KEYS.includes('spjSugOpen')]);
  ok(b1.every(Boolean), 'B: Klick blendet Regeln (mit „+ neue Regel“) und Vorschläge ein – wird gemerkt');
  await p.click('.spj-tog:has-text("Regeln")'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !document.querySelector('.spj-rules')), 'B: nochmal Klick – Regeln wieder zu');
  // ---- C: neuer Zweck – Regeln gleich offen; zweckungebunden links
  await p.click('.spj-add'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => !!document.querySelector('.spj-red .sp-wordin') && document.activeElement === document.querySelector('.spj-name')), 'C: „+ Zweck“ – Regeln und „Neue Regel“ offen, damit gleich ein Schlagwort hineinkann');
  await p.click('.spj-zi[data-z="-"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('.spj-lh b').textContent === 'Zweckungebunden' && document.querySelectorAll('[data-sec="sp-zu"] .spj-row').length === 12), 'C: links „zweckungebunden“ – die 12 Spenden ohne Zweck');
  // ---- D: Maßnahme – im Kopf nur der PAL, kein „Treffer hervorheben“
  await p.evaluate(() => commit(d => { const c = JSON.parse(JSON.stringify(d.massnahmen[0])); Object.assign(c, { id: 'wb', name: 'Wärmebus-Mailing', pal: '2027-01-10', regel: { worte: ['Wärmebus'], ab: 0, bis: 200 } }); delete c.plan; d.massnahmen.push(c); }));
  await p.evaluate(() => { UI.spMid = 'wb'; renderNow(); }); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.querySelector('.spm .spj-zh .spj-zst').textContent === 'PAL 10.01.2027' && !document.querySelector('.sp-hltog') && document.querySelectorAll('.spm-listbox mark.sp-hl').length === 6),
    'D: „Spenden zuordnen“ einer Maßnahme – im Kopf nur „PAL 10.01.2027“ (ohne Anzahl/Summe), Treffer gelb ohne Schalter');
  await finish(b, pages);
})();
