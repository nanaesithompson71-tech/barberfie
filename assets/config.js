/* ==========================================================
   BARBERFIE - where the API lives for the hosted site.
   On your PC and on a temporary tunnel nothing is needed: the
   pages find the API on the same address. On Vercel the pages
   and the API are on different hosts, so point at Railway here.
   Include BEFORE assets/api.js.
   ========================================================== */
(function () {
  var h = window.location.hostname;
  if (/\.vercel\.app$/.test(h) || h === 'barberfie.com' || h === 'www.barberfie.com') {
    window.BARBERFIE_API_BASE = 'https://barberfie-production.up.railway.app/api';
  }
})();
