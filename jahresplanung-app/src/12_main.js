/* ===================================================================== Start */

function flashTarget() {
  if (!UI.flash || UI.flash.startsWith('n:')) return;
  const e = $('[data-flash="' + CSS.escape(UI.flash) + '"]');
  UI.flash = null;
  if (!e) return;
  e.scrollIntoView({ block: 'center', behavior: 'smooth' });
  e.classList.add('flash');
  setTimeout(() => e.classList.remove('flash'), 2200);
}
function boot() {
  loadUI(); applyTheme();
  let d = null, broken = null;
  const el = $('#jp-data'), raw = el ? el.textContent.trim() : '';
  if (raw) try { d = JSON.parse(raw); if (!d || typeof d !== 'object' || !Array.isArray(d.massnahmen)) throw new Error('keine Planungsdaten gefunden'); }
  catch (e) { console.error(e); broken = (e && e.message) || String(e); d = null; }
  document.body.append(h('div', { id: 'toasts', 'aria-live': 'polite' }));
  initTips();
  loadData(normalize(d || emptyData()));
  ensurePersons(D); SAVED_JSON = JSON.stringify(D);
  if (broken) BROKEN = { reason: broken.replace(/^JSON\.parse: /, '').slice(0, 120) };
  if (UI.view === 'urlaub') { UI.view = 'einstellungen'; UI.settTab = 'urlaub'; }   // ab 0.14: Urlaub & Feiertage in den Einstellungen
  UI.view = OLD_VIEWS[UI.view] || UI.view;
  if (!VIEW_FN[UI.view]) UI.view = 'jahr';
  if (!UI.secOpen || typeof UI.secOpen !== 'object') UI.secOpen = {};
  checkDraft();
  renderNow();
  if (BROKEN) brokenDialog(); else showSplash();
  restoreFolder().then(() => { renderNow(); askPermissionOnFirstClick(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && isDirty() && ST.conn === 'ok' && !ST.conflict) saveAll({ auto: true }); });
}
document.addEventListener('DOMContentLoaded', boot);
