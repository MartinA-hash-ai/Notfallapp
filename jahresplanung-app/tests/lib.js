// Hilfen für die Tests ab 0.7: Seite mit nachgebautem Mailing-Ordner öffnen, Dateien lesen/schreiben
const fs = require('fs');
const { chromium } = require('./pw');
const T = require('./common');
const ORIG = fs.readFileSync(T.HTML, 'utf8');
const MAIN = 'Jahresplanung_Aussenkommunikation.html';
let failures = 0;
const ok = (c, m) => { if (!c) failures++; console.log((c ? 'OK   ' : 'FAIL ') + m); };

async function open(b, { file = T.HTML, fakefs = true, width = 1600 } = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true });
  if (fakefs) await ctx.addInitScript({ path: T.FAKEFS });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  await p.goto('file://' + file); await p.waitForTimeout(300);
  return p;
}
const readF = (p, n = MAIN) => p.evaluate(n => { const f = __fs.files['/Mailing/' + n]; return f ? new TextDecoder().decode(f.data) : null; }, n);
const writeF = (p, text, n = MAIN, lm) => p.evaluate(([t, n, lm]) => { __fs.files['/Mailing/' + n] = { data: new TextEncoder().encode(t), lm: lm || (90000 + (++__fs.n)) }; }, [text, n, lm]);
// Mailing-Ordner mit der Programmdatei anlegen und verbinden (wie „Speicherort wählen“)
async function connect(p, text = ORIG) {
  await writeF(p, text, MAIN, 1000);
  await p.evaluate(() => { UI.userName = 'Martin'; commit(d => { d.massnahmen[0].hinweis = 'verbunden'; }); });
  await p.click('#savebox'); await p.waitForTimeout(200);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(800);
  return p.evaluate(() => ST.conn);
}
const dataOf = text => JSON.parse(text.match(/<script type="application\/json" id="jp-data">([\s\S]*?)<\/script>/)[1]);
const withData = (text, fn) => text.replace(/(<script type="application\/json" id="jp-data">)([\s\S]*?)(<\/script>)/, (m, a, d, c) => { const o = JSON.parse(d); fn(o); return a + JSON.stringify(o).replace(/</g, '\\u003c') + c; });
const verOf = t => (t.match(/const APP_INFO = \{"version": "([^"]+)"/) || [])[1];
const banners = p => p.evaluate(() => [...document.querySelectorAll('.banner')].map(e => e.textContent));
const finish = async (b, pages) => {
  const errs = pages.flatMap(p => p.errs || []);
  console.log('ERR', errs.join(' | ') || 'keine');
  await b.close();
  if (failures) process.exitCode = 1;
};
module.exports = { chromium, T, ORIG, MAIN, ok, open, readF, writeF, connect, dataOf, withData, verOf, banners, finish, fs };
