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
  loadUI();
  let d = null;
  try { const el = $('#jp-data'); d = el && el.textContent.trim() ? JSON.parse(el.textContent) : null; } catch (e) { console.error(e); }
  document.body.append(h('div', { id: 'toasts', 'aria-live': 'polite' }));
  initTips();
  loadData(normalize(d || emptyData()));
  ensurePersons(D); SAVED_JSON = JSON.stringify(D);
  UI.view = OLD_VIEWS[UI.view] || UI.view;
  if (!VIEW_FN[UI.view]) UI.view = 'jahr';
  if (!UI.secOpen || typeof UI.secOpen !== 'object') UI.secOpen = {};
  checkDraft();
  renderNow();
  restoreFolder().then(() => renderNow());
  document.addEventListener('visibilitychange', () => { if (document.hidden && isDirty() && ST.conn === 'ok' && !ST.conflict) saveAll({ auto: true }); });
  if (!FSA) toast('Hinweis: Dieser Browser kann die Datei nicht direkt überschreiben – „Speichern“ lädt eine neue Datei herunter. Am besten Edge oder Chrome verwenden.', 'warn');
}
document.addEventListener('DOMContentLoaded', boot);
