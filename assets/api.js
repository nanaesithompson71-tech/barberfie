/* ==========================================================
   BARBERFIE - shared frontend API client
   Include on any page:  <script src="../assets/api.js"></script>
   Exposes window.BarberfieAPI.
   ========================================================== */
(function (global) {
  'use strict';

  // When the pages are served by the API itself (port 4000, or a public tunnel
  // address with no port) everything is on the same origin. When served by a
  // separate dev server (port 5500) the API lives on port 4000 of the same host.
  var sameOrigin = window.location.port !== '5500';
  var host = window.location.hostname;
  var CONFIG = {
    api: sameOrigin ? window.location.origin + '/api' : 'http://' + host + ':4000/api',
    php: 'http://' + host + ':8080',                 // PHP public endpoints (hours.php, contact.php, ...)
    reports: 'http://' + host + ':8000/reports'      // Django reports
  };
  var TOKEN_KEY = 'barberfie.token';
  var USER_KEY = 'barberfie.user';
  var PENDING_KEY = 'barberfie.pending';

  function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; } }
  function setSession(token, user) {
    try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch (e) { /* ignore */ }
  }
  function clearSession() { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ } }

  function request(base, path, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(base + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data; try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { error: text }; }
        if (!res.ok) {
          var err = new Error(data.error || ('Request failed (' + res.status + ')'));
          err.status = res.status;
          err.code = data.code;
          if (res.status === 401) clearSession();
          throw err;
        }
        return data;
      });
    }).catch(function (err) {
      if (err instanceof TypeError) { var e = new Error('Cannot reach the server. Is the API running?'); e.status = 0; throw e; }
      throw err;
    });
  }

  var api = function (path, options) { return request(CONFIG.api, path, options); };

  global.BarberfieAPI = {
    config: CONFIG,
    getToken: getToken,
    getUser: getUser,
    setSession: setSession,
    clearSession: clearSession,
    isSignedIn: function () { return !!getToken(); },

    /* Node API */
    api: api,
    login: function (email, password) {
      return api('/auth/login', { method: 'POST', body: { email: email, password: password } })
        .then(function (d) { setSession(d.token, d.user); return d; });
    },
    register: function (payload) {
      // Nothing is stored as an account yet: the sign-up waits until the emailed
      // code is typed or the link is clicked. Remember the pending key so this
      // device can be signed in once that happens.
      return api('/auth/register', { method: 'POST', body: payload }).then(function (d) {
        try { if (d.pendingKey) localStorage.setItem(PENDING_KEY, d.pendingKey); } catch (e) { /* ignore */ }
        return d;
      });
    },
    getPendingKey: function () { try { return localStorage.getItem(PENDING_KEY); } catch (e) { return null; } },
    clearPendingKey: function () { try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ } },
    /* Ask whether the email link has been clicked yet. Resolves { verified, token?, user? }. */
    checkPending: function (key) {
      return api('/auth/pending?key=' + encodeURIComponent(key)).then(function (d) {
        if (d.verified) { setSession(d.token, d.user); try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ } }
        return d;
      });
    },
    verifyEmail: function (token) {
      return api('/auth/verify?token=' + encodeURIComponent(token))
        .then(function (d) { setSession(d.token, d.user); return d; });
    },
    /* Type the 6-digit code from the email. Signs in on success. */
    verifyCode: function (email, code) {
      return api('/auth/verify-code', { method: 'POST', body: { email: email, code: code } })
        .then(function (d) { setSession(d.token, d.user); try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ } return d; });
    },
    googleConfig: function () { return api('/auth/google/config'); },
    googleLogin: function (accessToken) {
      return api('/auth/google', { method: 'POST', body: { accessToken: accessToken } })
        .then(function (d) { setSession(d.token, d.user); return d; });
    },
    resendVerification: function (email) {
      return api('/auth/resend', { method: 'POST', body: { email: email } });
    },
    logout: function () { clearSession(); },
    me: function () { return api('/me'); },
    updateMe: function (payload) { return api('/me', { method: 'PATCH', body: payload }); },
    changePassword: function (current, next) { return api('/auth/password', { method: 'POST', body: { current: current, next: next } }); },
    services: function (all) { return api('/services' + (all ? '?all=1' : '')); },
    barbers: function (all) { return api('/barbers' + (all ? '?all=1' : '')); },
    hours: function () { return api('/hours'); },
    availability: function (date, barberId) { return api('/bookings/availability?date=' + date + (barberId ? '&barberId=' + barberId : '')); },
    bookings: function (params) {
      var qs = params ? '?' + Object.keys(params).filter(function (k) { return params[k] !== undefined && params[k] !== ''; })
        .map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&') : '';
      return api('/bookings' + qs);
    },
    createBooking: function (payload) { return api('/bookings', { method: 'POST', body: payload }); },
    updateBooking: function (id, payload) { return api('/bookings/' + id, { method: 'PATCH', body: payload }); },
    deleteBooking: function (id) { return api('/bookings/' + id, { method: 'DELETE' }); },
    customers: function (q) { return api('/customers' + (q ? '?q=' + encodeURIComponent(q) : '')); },
    settings: function () { return api('/settings'); },
    saveSettings: function (payload) { return api('/settings', { method: 'PUT', body: payload }); },

    /* PHP public endpoints (no login needed) */
    php: function (file, options) { return request(CONFIG.php, '/' + file, options); },
    sendContact: function (payload) { return request(CONFIG.php, '/contact.php', { method: 'POST', body: payload }); },

    /* Django reports (admin token required) */
    report: function (path) { return request(CONFIG.reports, path); },

    /* Convert between the API's 24h "HH:MM" and the UI's "h:MM AM" */
    to12h: function (t) { var h = +t.slice(0, 2), m = t.slice(3, 5); return ((h % 12) || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM'); },
    to24h: function (t) { var p = /(\d+):(\d+)\s*(AM|PM)/i.exec(t); if (!p) return t; var h = +p[1] % 12 + (/pm/i.test(p[3]) ? 12 : 0); return String(h).padStart(2, '0') + ':' + p[2]; }
  };
})(window);
