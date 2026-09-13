/* ==========================================================
   BARBERFIE - light / dark theme
   Loaded in the <head> of every page so the chosen theme is
   applied before the first paint (no flash). The choice is
   remembered in this browser under "barberfie.theme".
   Exposes window.BarberfieTheme = { get, set, toggle }.
   ========================================================== */
(function () {
  'use strict';
  var KEY = 'barberfie.theme';
  var root = document.documentElement;

  function get() {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
  }
  function apply(theme) {
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
  }
  function set(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
    apply(theme);
    return theme;
  }

  apply(get());

  window.BarberfieTheme = {
    get: get,
    set: set,
    toggle: function () { return set(get() === 'light' ? 'dark' : 'light'); }
  };
})();
