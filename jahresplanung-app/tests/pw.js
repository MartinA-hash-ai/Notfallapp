// Playwright laden: aus PLAYWRIGHT_PATH, einer lokalen Installation oder der globalen Installation
for (const p of [process.env.PLAYWRIGHT_PATH, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean)) {
  try { module.exports = require(p); break; } catch (e) { /* nächsten Ort versuchen */ }
}
if (!module.exports || !module.exports.chromium) throw new Error('Playwright nicht gefunden – PLAYWRIGHT_PATH setzen');

// Bildschirmfotos der Tests nur mit SHOTS=1 – geprüft wird per Code, die Bilder dienen nur zum Anschauen und kosten Zeit
if (!process.env.SHOTS) {
  const bt = module.exports.chromium, launch = bt.launch.bind(bt);
  let done = false;
  const quiet = pg => { if (!done) { done = true; Object.getPrototypeOf(pg).screenshot = async () => Buffer.alloc(0); } return pg; };
  bt.launch = async (...a) => {
    const b = await launch(...a), np = b.newPage.bind(b), nc = b.newContext.bind(b);
    b.newPage = async (...x) => quiet(await np(...x));
    b.newContext = async (...x) => { const c = await nc(...x), cp = c.newPage.bind(c); c.newPage = async (...y) => quiet(await cp(...y)); return c; };
    return b;
  };
}
