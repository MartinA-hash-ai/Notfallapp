// Hilfen für die Tests: Seite mit nachgebautem Ordner öffnen, Dateien lesen/schreiben, Ergebnis melden
const fs = require('fs');
const { chromium } = require('./pw');
const T = require('./common');
const ORIG = fs.readFileSync(T.HTML, 'utf8');
const MAIN = 'Bedarfsliste.html';
let failures = 0;
const ok = (c, m) => { if (!c) failures++; console.log((c ? 'OK   ' : 'FAIL ') + m); };

// clock: Uhr der Seite steuerbar – mit skip(p, ms) springt sie vor (statt echt auf Speichern/Überwachung zu warten)
// motion: Animationen zeigen (sonst wie bei „Animationen aus“ in Windows – die Seite wechselt sofort, Tests müssen nicht warten)
async function open(b, { file = T.HTML, fakefs = true, width = 1500, clock = false, dark = false, motion = false } = {}) {
  const ctx = await b.newContext({ viewport: { width, height: 950 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true, colorScheme: dark ? 'dark' : 'light', reducedMotion: motion ? 'no-preference' : 'reduce' });
  if (clock) await ctx.clock.install();
  if (fakefs) await ctx.addInitScript({ path: T.FAKEFS });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000); p.errs = []; p.reqs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console: ' + m.text()); });
  p.on('request', r => { if (!/^(file|blob|data):/.test(r.url())) p.reqs.push(r.url()); });
  await p.goto('file://' + file); await p.waitForTimeout(300);
  return p;
}
const skip = async (p, ms) => { await p.clock.fastForward(ms); await p.waitForTimeout(250); };
const readF = (p, n = MAIN) => p.evaluate(n => { const f = __fs.files['/Ordner/' + n]; return f ? new TextDecoder().decode(f.data) : null; }, n);
const writeF = (p, text, n = MAIN, lm) => p.evaluate(([t, n, lm]) => { __fs.files['/Ordner/' + n] = { data: new TextEncoder().encode(t), lm: lm || (90000 + (++__fs.n)) }; }, [text, n, lm]);
const writeBin = (p, b64, n) => p.evaluate(([b, n]) => { __fs.files['/Ordner/' + n] = { data: Uint8Array.from(atob(b), c => c.charCodeAt(0)), lm: 90000 + (++__fs.n) }; }, [b64, n]);
// Ordner mit der Programmdatei anlegen und verbinden (wie „Ordner wählen …“)
async function connect(p, text = ORIG) {
  await writeF(p, text, MAIN, 1000);
  await p.click('button[data-act="connect"]'); await p.waitForTimeout(200);
  await p.click('.modal footer button.primary'); await p.waitForTimeout(600);
  return p.evaluate(() => ST.conn);
}
const dataOf = text => JSON.parse(text.match(/<script type="application\/json" id="bl-data">([\s\S]*?)<\/script>/)[1]);
const verOf = t => (t.match(/const APP_INFO = \{"version": "([^"]+)"/) || [])[1];
const finish = async (b, pages) => {
  const errs = pages.flatMap(p => p.errs || []);
  console.log('ERR', errs.join(' | ') || 'keine');
  await b.close();
  if (failures) process.exitCode = 1;
};
module.exports = { chromium, T, ORIG, MAIN, ok, open, skip, readF, writeF, writeBin, connect, dataOf, verOf, finish, fs };
