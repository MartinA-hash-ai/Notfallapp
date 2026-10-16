// Playwright laden: aus PLAYWRIGHT_PATH, einer lokalen Installation oder der globalen Installation
for (const p of [process.env.PLAYWRIGHT_PATH, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean)) {
  try { module.exports = require(p); break; } catch (e) { /* nächsten Ort versuchen */ }
}
if (!module.exports || !module.exports.chromium) throw new Error('Playwright nicht gefunden – PLAYWRIGHT_PATH setzen');
