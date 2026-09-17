/* ==========================================================
   BARBERFIE - auth page behaviour (login / signup)
   Validates on the client, then talks to the Node.js API
   through ../assets/api.js.
   ========================================================== */

(function () {
  'use strict';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* Where to go after signing in: a relative ?next= link from the page that sent
     us here (the booking flow), otherwise the dashboard for the user's role.
     Only same-site relative paths are honoured. */
  function destinationFor(user) {
    var next = new URLSearchParams(window.location.search).get('next');
    if (next && /^(\.\.?\/|[A-Za-z0-9_-])/.test(next) && next.indexOf('//') === -1 && next.indexOf(':') === -1) return next;
    return user && user.role === 'admin' ? '../admin/admin.html' : '../dashboard/dashboard.html';
  }

  /* Already signed in? Skip the sign-in / sign-up pages and go straight to the dashboard. */
  if (window.BarberfieAPI && BarberfieAPI.isSignedIn() && (document.getElementById('login-form') || document.getElementById('signup-form'))) {
    window.location.replace(destinationFor(BarberfieAPI.getUser()));
    return;
  }

  /* ---------- Show / hide password ---------- */
  document.querySelectorAll('.toggle-password').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
    });
  });

  /* ---------- Field helpers ---------- */
  function setError(input, message) {
    var field = input.closest('.field');
    var err = field ? field.querySelector('.error') : null;
    if (message) {
      if (field) field.classList.add('has-error');
      input.setAttribute('aria-invalid', 'true');
      if (err) err.textContent = message;
    } else {
      if (field) field.classList.remove('has-error');
      input.removeAttribute('aria-invalid');
    }
  }

  function showAlert(form, type, message) {
    var box = form.querySelector('.form-alert');
    if (!box) return;
    box.className = 'form-alert ' + type;
    box.textContent = message;
  }

  /* ---------- Password strength (signup) ---------- */
  function scorePassword(value) {
    var score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    return score;
  }

  var pw = document.getElementById('signup-password');
  var text = document.querySelector('.strength-text');

  if (pw && text) {
    pw.addEventListener('input', function () {
      var weak = pw.value && scorePassword(pw.value) < 2;
      text.textContent = weak ? 'Password not strong enough' : '';
    });
  }

  /* ---------- Login form ---------- */
  var loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = loginForm.email;
      var password = loginForm.password;
      var ok = true;

      if (!EMAIL_RE.test(email.value.trim())) { setError(email, 'Enter a valid email address.'); ok = false; } else { setError(email); }
      if (!password.value) { setError(password, 'Enter your password.'); ok = false; } else { setError(password); }

      if (!ok) { showAlert(loginForm, 'error', 'Please fix the highlighted fields.'); return; }

      var submitBtn = loginForm.querySelector('[type="submit"]');
      submitBtn.disabled = true; submitBtn.textContent = 'Signing in...';
      BarberfieAPI.login(email.value.trim(), password.value).then(function (d) {
        showAlert(loginForm, 'success', 'Welcome back, ' + d.user.firstName + '! One moment...');
        var dest = destinationFor(d.user);
        setTimeout(function () { window.location.href = dest; }, 900);
      }).catch(function (err) {
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          showUnverified(loginForm, email.value.trim());
        } else {
          showAlert(loginForm, 'error', err.message);
        }
        submitBtn.disabled = false; submitBtn.textContent = 'Sign In';
      });
    });
  }

  /* ---------- Unverified email: message + resend link ---------- */
  function showUnverified(form, email) {
    showAlert(form, 'error', 'Your account is not created yet. Type the 6-digit code from your email below, or click the link in it, to finish signing up.');
    showCodeEntry(form, email);
  }

  /* ---------- Signup form ---------- */
  var signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = signupForm;
      var ok = true;

      if (!f.firstName.value.trim()) { setError(f.firstName, 'First name is required.'); ok = false; } else { setError(f.firstName); }
      if (!f.lastName.value.trim()) { setError(f.lastName, 'Last name is required.'); ok = false; } else { setError(f.lastName); }
      if (!EMAIL_RE.test(f.email.value.trim())) { setError(f.email, 'Enter a valid email address.'); ok = false; } else { setError(f.email); }
      var localNumber = f.phone.value.replace(/[\s()-]/g, '').replace(/^0+/, '');
      var fullPhone = f.country.value + localNumber;
      if (!localNumber) { setError(f.phone, 'Phone number is required.'); ok = false; }
      else if (!/^\d{6,12}$/.test(localNumber)) { setError(f.phone, 'Enter a valid phone number (digits only, without the country code).'); ok = false; }
      else { setError(f.phone); }
      if (scorePassword(f.password.value) < 2) { setError(f.password, 'Use at least 8 characters with a mix of upper and lower case letters.'); ok = false; } else { setError(f.password); }
      if (f.confirm.value !== f.password.value) { setError(f.confirm, 'Passwords do not match.'); ok = false; } else { setError(f.confirm); }
      if (!f.terms.checked) { setError(f.terms, 'You need to accept the terms to continue.'); ok = false; } else { setError(f.terms); }

      if (!ok) { showAlert(f, 'error', 'Please fix the highlighted fields.'); return; }

      var submitBtn = f.querySelector('[type="submit"]');
      submitBtn.disabled = true; submitBtn.textContent = 'Sending code...';
      BarberfieAPI.register({
        firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(),
        email: f.email.value.trim(), phone: fullPhone, password: f.password.value
      }).then(function (d) {
        showAlert(f, 'success', 'Almost done! We emailed a 6-digit code to ' + d.email + '. Enter it below (or click the link in the email) and your account will be created.');
        f.querySelectorAll('input, select').forEach(function (i) { i.disabled = true; });
        submitBtn.hidden = true;
        showCodeEntry(f, d.email);
        watchPending(f, d.pendingKey);
      }).catch(function (err) {
        showAlert(f, 'error', err.message);
        submitBtn.disabled = false; submitBtn.textContent = 'Create Account';
      });
    });
  }

  /* ---------- Code entry: type the 6-digit code from the email ---------- */
  function goToDashboard(form, user) {
    showAlert(form, 'success', 'Email verified! Welcome, ' + user.firstName + '. One moment...');
    var dest = destinationFor(user);
    setTimeout(function () { window.location.href = dest; }, 900);
  }

  function showCodeEntry(form, email) {
    if (form.querySelector('.code-entry')) return;
    var box = document.createElement('div');
    box.className = 'code-entry';
    box.innerHTML =
      '<label for="verify-code-input">Verification code</label>' +
      '<div class="code-row">' +
        '<input type="text" id="verify-code-input" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="000000" autocomplete="one-time-code">' +
        '<button type="button" class="btn btn-primary" id="verify-code-btn">Verify</button>' +
      '</div>' +
      '<p class="hint">Did not get it? Check spam, or <a id="verify-code-resend">send a new code</a>.</p>';
    var actions = form.querySelector('[type="submit"]');
    if (actions && actions.parentNode === form) form.insertBefore(box, actions); else form.appendChild(box);

    var input = box.querySelector('#verify-code-input');
    var btn = box.querySelector('#verify-code-btn');
    var resend = box.querySelector('#verify-code-resend');
    input.disabled = false;
    input.focus();

    function submitCode() {
      var code = input.value.replace(/\D/g, '');
      if (code.length !== 6) { showAlert(form, 'error', 'Enter the 6-digit code from your email.'); input.focus(); return; }
      btn.disabled = true; btn.textContent = 'Checking...';
      BarberfieAPI.verifyCode(email, code).then(function (d) {
        goToDashboard(form, d.user);
      }).catch(function (err) {
        showAlert(form, 'error', err.message);
        btn.disabled = false; btn.textContent = 'Verify';
        input.select();
      });
    }
    btn.addEventListener('click', submitCode);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitCode(); } });
    input.addEventListener('input', function () { if (input.value.replace(/\D/g, '').length === 6) submitCode(); });
    resend.addEventListener('click', function (e) {
      e.preventDefault();
      resend.textContent = 'sending...';
      BarberfieAPI.resendVerification(email).then(function () {
        showAlert(form, 'success', 'A new code has been sent to ' + email + '.');
        resend.textContent = 'send a new code';
      }).catch(function (err) { showAlert(form, 'error', err.message); resend.textContent = 'send a new code'; });
    });
  }

  /* ---------- Wait for the email link to be clicked (any device) ---------- */
  function watchPending(form, key) {
    if (!key) return;
    var timer = setInterval(function () {
      BarberfieAPI.checkPending(key).then(function (d) {
        if (!d.verified) return;
        clearInterval(timer);
        goToDashboard(form, d.user);
      }).catch(function (err) {
        // 404 means the key was already used or the sign-up expired; stop asking.
        if (err.status === 404) { clearInterval(timer); BarberfieAPI.clearPendingKey(); }
      });
    }, 3000);
  }

  // If the user closed the signup tab and came back to sign in, keep watching
  // for the verification so they still land on the dashboard automatically.
  if (loginForm && !BarberfieAPI.isSignedIn()) {
    var savedKey = BarberfieAPI.getPendingKey();
    if (savedKey) {
      showAlert(loginForm, 'success', 'Your sign-up is waiting for email verification. Click the link in your inbox and this page will take you to your dashboard.');
      watchPending(loginForm, savedKey);
    }
  }

  /* ---------- Google sign-in (login + signup) ---------- */
  var googleBtn = document.getElementById('google-btn');
  var activeForm = loginForm || signupForm;
  if (googleBtn && activeForm) {
    var googleLabel = googleBtn.textContent.trim();
    googleBtn.addEventListener('click', function () {
      if (!window.google || !google.accounts || !google.accounts.oauth2) {
        showAlert(activeForm, 'error', 'Google sign-in is still loading. Please try again in a moment.');
        return;
      }
      googleBtn.disabled = true; googleBtn.textContent = 'Opening Google...';
      var reset = function () { googleBtn.disabled = false; googleBtn.textContent = googleLabel; };

      BarberfieAPI.googleConfig().then(function (cfg) {
        if (!cfg.clientId) { showAlert(activeForm, 'error', 'Google sign-in is not set up yet.'); reset(); return; }
        var client = google.accounts.oauth2.initTokenClient({
          client_id: cfg.clientId,
          scope: 'openid email profile',
          callback: function (resp) {
            if (!resp || !resp.access_token) { showAlert(activeForm, 'error', 'Google sign-in was cancelled.'); reset(); return; }
            BarberfieAPI.googleLogin(resp.access_token).then(function (d) {
              if (d.pendingVerification) {
                // New Google account: confirm the email with the code/link like everyone else
                showAlert(activeForm, 'success', 'Almost there! We emailed a 6-digit code to ' + d.email + '. Type it below, or click the link in the email.');
                activeForm.querySelectorAll('input, select').forEach(function (i) { i.disabled = true; });
                var sb = activeForm.querySelector('[type="submit"]'); if (sb) sb.hidden = true;
                googleBtn.hidden = true;
                showCodeEntry(activeForm, d.email);
                watchPending(activeForm, d.pendingKey);
                return;
              }
              goToDashboard(activeForm, d.user);
            }).catch(function (err) { showAlert(activeForm, 'error', err.message); reset(); });
          },
          error_callback: function () { showAlert(activeForm, 'error', 'Google sign-in was closed before finishing.'); reset(); }
        });
        client.requestAccessToken();
      }).catch(function (err) { showAlert(activeForm, 'error', err.message); reset(); });
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
