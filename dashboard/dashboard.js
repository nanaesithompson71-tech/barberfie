/* ==========================================================
   BARBERFIE - user dashboard behaviour
   Everything comes from the Node API through ../assets/api.js:
   the signed-in account, the service/barber catalogue, real
   bookings, and payments (cash at the shop or Paystack).
   ========================================================== */

(function () {
  'use strict';

  var REWARDS = [
    { pts: 300, name: 'Free beard trim' },
    { pts: 600, name: 'Free classic haircut' },
    { pts: 1000, name: 'Free cut & beard combo' }
  ];

  /* ---------- State ---------- */
  var data = {
    user: { firstName: '', lastName: '', email: '', phone: '', notes: '', since: '', favouriteBarberId: null },
    prefs: { reminders: true, promos: false, whatsapp: true },
    appointments: []
  };
  var catalog = { services: [], barbers: [] };
  var payConfig = { paystack: false, publicKey: null, currency: 'GHS' };

  /* ---------- Helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function isoDaysFromNow(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function fmtDate(iso, opts) {
    if (!iso) return '';
    var d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    return d.toLocaleDateString('en-GB', opts || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function initials(first, last) { return ((first || '')[0] || '') + ((last || '')[0] || ''); }
  function barberById(id) { return catalog.barbers.filter(function (b) { return b.id === Number(id); })[0] || null; }
  function serviceById(id) { return catalog.services.filter(function (s) { return s.id === Number(id); })[0] || null; }
  function favouriteBarber() { return barberById(data.user.favouriteBarberId) || catalog.barbers[0] || null; }

  /* Shape an API booking for the UI */
  function fromApi(b) {
    return {
      id: b.id, serviceId: b.serviceId, service: b.service, price: Number(b.price),
      barberId: b.barberId, barber: b.barber || 'Any available barber',
      date: String(b.date).slice(0, 10), time24: b.time, time: BarberfieAPI.to12h(b.time),
      status: b.status, paymentMethod: b.paymentMethod, paymentStatus: b.paymentStatus
    };
  }
  function isLive(a) { return a.status === 'confirmed' || a.status === 'pending'; }
  function points() {
    return data.appointments.filter(function (a) { return a.status === 'completed'; })
      .reduce(function (sum, a) { return sum + a.price; }, 0);
  }
  function upcoming() {
    var today = isoDaysFromNow(0);
    return data.appointments.filter(function (a) { return isLive(a) && a.date >= today; })
      .sort(function (a, b) { return (a.date + a.time24).localeCompare(b.date + b.time24); });
  }
  function past() {
    var today = isoDaysFromNow(0);
    return data.appointments.filter(function (a) { return !isLive(a) || a.date < today; })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
  }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  /* ---------- Section navigation ---------- */
  var sections = $$('.dash-section');
  var navLinks = $$('.dash-nav a[data-section]');
  var sectionLinks = $$('.panel-link[data-section]');

  function showSection(id, focusHeading) {
    sections.forEach(function (s) { s.classList.toggle('active', s.id === id); });
    navLinks.forEach(function (l) {
      var on = l.getAttribute('data-section') === id;
      l.classList.toggle('active', on);
      if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
    });
    var sec = document.getElementById(id);
    if (sec && focusHeading) {
      var h = sec.querySelector('h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navLinks.concat(sectionLinks).forEach(function (l) {
    l.addEventListener('click', function (e) {
      e.preventDefault();
      var id = l.getAttribute('data-section');
      history.replaceState(null, '', '#' + id);
      showSection(id, true);
    });
  });

  var initial = location.hash.replace('#', '');
  if (initial && document.getElementById(initial) && document.getElementById(initial).classList.contains('dash-section')) {
    showSection(initial);
  }
  window.addEventListener('hashchange', function () {
    var id = location.hash.replace('#', '');
    if (document.getElementById(id) && document.getElementById(id).classList.contains('dash-section')) showSection(id, true);
  });

  /* Set text on an element if it exists on the page */
  function txt(sel, value) { var el = $(sel); if (el) el.textContent = value; }

  /* Shop hours shown on the overview (matches the homepage) */
  var HOURS = { 0: [12, 18], 1: [8, 20], 2: [8, 20], 3: [8, 20], 4: [8, 20], 5: [8, 20], 6: [8, 21] };
  function renderHours() {
    var now = new Date(), h = HOURS[now.getDay()];
    var fmt = function (x) { return ((x % 12) || 12) + (x < 12 ? ' AM' : ' PM'); };
    txt('#today-hours', h ? fmt(h[0]) + ' - ' + fmt(h[1]) : 'Closed');
    var open = h && now.getHours() >= h[0] && now.getHours() < h[1];
    txt('#open-status', h ? (open ? 'Open now' : 'Closed right now') : 'Closed today');
  }

  /* ---------- Render: user ---------- */
  function renderUser() {
    var u = data.user;
    txt('#user-initials', initials(u.firstName, u.lastName).toUpperCase());
    txt('#user-name', (u.firstName + ' ' + u.lastName).trim());
    txt('#user-email', u.email);
    txt('#greet-name', u.firstName);

    var hour = new Date().getHours();
    $('#overview-title').firstChild.textContent = (hour < 12 ? 'Good morning, ' : hour < 17 ? 'Good afternoon, ' : 'Good evening, ');

    txt('#stat-since', u.since ? fmtDate(u.since, { month: 'short', year: 'numeric' }) : '-');

    var fav = favouriteBarber();
    txt('#barber-name', fav ? fav.name : 'Any available');
    txt('#barber-initials', fav ? fav.name.split(' ').map(function (p) { return p[0]; }).join('') : '?');
    txt('#barber-desc', fav ? (fav.bio || '') : 'We will match you with whoever is free.');
    renderHours();

    // Profile form
    $('#pf-first').value = u.firstName;
    $('#pf-last').value = u.lastName;
    $('#pf-email').value = u.email;
    $('#pf-phone').value = u.phone || '';
    $('#pf-notes').value = u.notes || '';

    // Prefs
    $$('.switch[data-pref]').forEach(function (sw) {
      sw.setAttribute('aria-checked', data.prefs[sw.getAttribute('data-pref')] ? 'true' : 'false');
    });
  }

  /* ---------- Payment badge + button ---------- */
  function payBadge(a) {
    if (a.paymentStatus === 'paid') return '<span class="badge paid">Paid</span>';
    if (a.paymentStatus === 'refunded') return '<span class="badge cancelled">Refunded</span>';
    if (a.paymentMethod === 'paystack') return '<span class="badge unpaid">Payment due</span>';
    return '<span class="badge cash">Cash at shop</span>';
  }
  function payButton(a) {
    if (!isLive(a) || a.paymentStatus === 'paid' || !payConfig.paystack) return '';
    return '<button class="btn btn-primary btn-sm" type="button" data-action="pay" data-id="' + a.id + '">Pay now</button>';
  }

  /* ---------- Render: stats + next appointment ---------- */
  function renderOverview() {
    var up = upcoming();
    var visits = data.appointments.filter(function (a) { return a.status === 'completed'; }).length;
    var pts = points();
    var next = REWARDS.filter(function (r) { return r.pts > pts; })[0];

    txt('#stat-upcoming', up.length);
    txt('#stat-visits', visits);
    txt('#stat-points', pts);
    txt('#stat-points-hint', next ? (next.pts - pts) + ' more to ' + next.name.toLowerCase() : 'all rewards unlocked');
    txt('#greet-sub', up.length === 0 ? 'No appointments booked. Ready for a fresh cut?'
      : up.length === 1 ? 'You have 1 appointment coming up.' : 'You have ' + up.length + ' appointments coming up.');

    var body = $('#next-appt-body');
    if (!up.length) {
      var hasPast = data.appointments.some(function (a) { return a.status === 'completed'; });
      body.innerHTML = '<div class="empty"><p>Nothing booked yet. Your chair is waiting.</p><div class="actions">' +
        '<button class="btn btn-primary btn-sm" type="button" data-action="book">Book now</button>' +
        (hasPast ? '<button class="btn btn-ghost btn-sm" type="button" data-action="rebook">Rebook last visit</button>' : '') +
        '</div></div>';
      return;
    }
    var a = up[0];
    body.innerHTML =
      '<p class="when">' + esc(fmtDate(a.date)) + ' at ' + esc(a.time) + ' ' + payBadge(a) + (a.status === 'pending' ? ' <span class="badge pending">awaiting confirmation</span>' : '') + '</p>' +
      '<p class="meta">' + esc(a.service) + ' with ' + esc(a.barber) + ' &middot; GH&#8373; ' + a.price + '</p>' +
      '<div class="actions">' +
        payButton(a) +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="reschedule" data-id="' + a.id + '">Reschedule</button>' +
        '<button class="btn btn-danger btn-sm" type="button" data-action="cancel" data-id="' + a.id + '">Cancel</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="calendar" data-id="' + a.id + '">Add to calendar</button>' +
      '</div>';
  }

  /* ---------- Render: appointment lists ---------- */
  function apptItem(a, isPast) {
    var d = new Date(a.date + 'T00:00:00');
    var status = isPast && isLive(a) ? 'completed' : a.status;
    var actions = isPast
      ? '<button class="btn btn-ghost btn-sm" type="button" data-action="rebook" data-id="' + a.id + '">Book again</button>'
      : payButton(a) +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="reschedule" data-id="' + a.id + '">Reschedule</button>' +
        '<button class="btn btn-danger btn-sm" type="button" data-action="cancel" data-id="' + a.id + '">Cancel</button>';
    return '<li class="appt' + (isPast ? ' past' : '') + '">' +
      '<div class="date" aria-hidden="true"><b>' + d.getDate() + '</b><small>' + d.toLocaleDateString('en-GB', { month: 'short' }) + '</small></div>' +
      '<div class="info"><strong>' + esc(a.service) + '<span class="badge ' + esc(status) + '">' + esc(status) + '</span>' + (isPast ? '' : payBadge(a)) + '</strong>' +
      '<span>' + esc(fmtDate(a.date)) + ' at ' + esc(a.time) + ' &middot; ' + esc(a.barber) + ' &middot; GH&#8373; ' + a.price + '</span></div>' +
      '<div class="appt-actions">' + actions + '</div></li>';
  }

  function renderAppointments() {
    var up = upcoming(), pa = past();
    $('#upcoming-list').innerHTML = up.length ? up.map(function (a) { return apptItem(a, false); }).join('')
      : '<li class="empty"><p>Nothing booked yet.</p><button class="btn btn-primary btn-sm" type="button" data-action="book">Book an appointment</button></li>';
    $('#past-list').innerHTML = pa.length ? pa.map(function (a) { return apptItem(a, true); }).join('')
      : '<li class="empty"><p>No past visits yet.</p></li>';
  }

  /* Tabs */
  var tabs = $$('.tab');
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        selectTab(tabs[n]); tabs[n].focus();
      }
    });
  });

  /* ---------- Render: loyalty ---------- */
  function renderLoyalty() {
    var pts = points();
    var next = REWARDS.filter(function (r) { return r.pts > pts; })[0];
    var target = next ? next.pts : REWARDS[REWARDS.length - 1].pts;
    var prevTier = REWARDS.filter(function (r) { return r.pts <= pts; }).pop();
    var base = prevTier ? prevTier.pts : 0;
    var ratio = next ? Math.min(1, (pts - base) / (target - base)) : 1;

    var circ = 2 * Math.PI * 52;
    var fill = $('#ring-fill');
    fill.setAttribute('stroke-dasharray', circ);
    fill.setAttribute('stroke-dashoffset', circ * (1 - ratio));
    $('#ring-text').textContent = Math.round(ratio * 100) + '%';
    $('#ring').setAttribute('aria-label', 'Loyalty progress: ' + Math.round(ratio * 100) + ' percent towards ' + (next ? next.name : 'the top reward'));
    $('#loyalty-points').textContent = pts + ' points';
    $('#loyalty-next').textContent = next ? (next.pts - pts) + ' more points to unlock ' + next.name.toLowerCase() + '.' : 'You have unlocked every reward. Legend.';

    $('#rewards-list').innerHTML = REWARDS.map(function (r) {
      var unlocked = pts >= r.pts;
      return '<li><span' + (unlocked ? '' : ' class="locked"') + '>' + esc(r.name) + (unlocked ? ' &middot; <a href="#" data-action="redeem" data-reward="' + esc(r.name) + '">Redeem</a>' : '') + '</span><span class="pts">' + r.pts + ' pts</span></li>';
    }).join('');

    var hist = data.appointments.filter(function (a) { return a.status === 'completed'; })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
    $('#points-history').innerHTML = hist.length ? hist.map(function (a) {
      return '<li><div><strong>' + esc(a.service) + '</strong><span>' + esc(fmtDate(a.date)) + '</span></div><span class="pts" style="color:var(--gold);font-weight:700;">+' + a.price + '</span></li>';
    }).join('') : '<li><span>No points earned yet.</span></li>';
  }

  function renderAll() {
    renderUser(); renderOverview(); renderAppointments(); renderLoyalty();
  }

  /* ---------- Modals ---------- */
  var bookModal = $('#book-modal');
  var confirmModal = $('#confirm-modal');
  var bookForm = $('#book-form');
  var lastFocus = null;
  var editingId = null;
  var confirmAction = null;

  function openModal(m) { lastFocus = document.activeElement; m.showModal(); }
  function closeModal(m) { m.close(); if (lastFocus) lastFocus.focus(); }
  $$('[data-close]').forEach(function (b) { b.addEventListener('click', function () { closeModal(b.closest('dialog')); }); });
  [bookModal, confirmModal].forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(m); });
    m.addEventListener('cancel', function (e) { e.preventDefault(); closeModal(m); });
  });

  function confirm(text, yesLabel, cb) {
    $('#confirm-text').textContent = text;
    $('#confirm-yes').textContent = yesLabel || 'Yes, continue';
    confirmAction = cb;
    openModal(confirmModal);
  }
  $('#confirm-yes').addEventListener('click', function () {
    closeModal(confirmModal);
    if (confirmAction) confirmAction();
  });

  /* ---------- Catalogue selects ---------- */
  function fillCatalog() {
    $('#bk-service').innerHTML = catalog.services.map(function (s) {
      return '<option value="' + s.id + '">' + esc(s.name) + ' - GH&#8373; ' + s.price + '</option>';
    }).join('') || '<option value="">No services available</option>';
    $('#bk-barber').innerHTML = catalog.barbers.map(function (b) {
      return '<option value="' + b.id + '">' + esc(b.name) + '</option>';
    }).join('') + '<option value="">Any available barber</option>';
  }
  function updateTotal() {
    var s = serviceById($('#bk-service').value);
    $('#pay-total').textContent = s ? 'Total: GH₵ ' + s.price : '';
  }
  $('#bk-service').addEventListener('change', updateTotal);

  /* ---------- Slots (from the API) ---------- */
  function renderSlots(selected) {
    var dateVal = $('#bk-date').value;
    var barberId = $('#bk-barber').value;
    var box = $('#slots');
    box.innerHTML = '<p class="hint">Checking availability...</p>';
    $('#bk-time').value = '';
    if (!dateVal) { box.innerHTML = ''; return; }
    BarberfieAPI.availability(dateVal, barberId).then(function (slots) {
      if (!slots.length) { box.innerHTML = '<p class="hint">The shop is closed that day.</p>'; return; }
      box.innerHTML = slots.map(function (s) {
        var label = BarberfieAPI.to12h(s.time);
        var isSel = s.time === selected;
        var free = s.available || isSel;
        return '<button type="button" class="slot" aria-pressed="' + (isSel ? 'true' : 'false') + '"' + (free ? '' : ' disabled') + ' data-slot="' + s.time + '">' + label + '</button>';
      }).join('');
      $('#bk-time').value = selected && slots.some(function (s) { return s.time === selected; }) ? selected : '';
    }).catch(function (err) { box.innerHTML = '<p class="hint">' + esc(err.message) + '</p>'; });
  }
  $('#slots').addEventListener('click', function (e) {
    var b = e.target.closest('.slot'); if (!b || b.disabled) return;
    $$('.slot').forEach(function (s) { s.setAttribute('aria-pressed', 'false'); });
    b.setAttribute('aria-pressed', 'true');
    $('#bk-time').value = b.getAttribute('data-slot');
    $('#slot-error').style.display = 'none';
  });
  $('#bk-date').addEventListener('change', function () { renderSlots($('#bk-time').value); });
  $('#bk-barber').addEventListener('change', function () { renderSlots($('#bk-time').value); });

  function openBooking(prefill, id) {
    editingId = id || null;
    $('#book-title').textContent = id ? 'Reschedule appointment' : 'Book an appointment';
    $('#book-sub').textContent = id ? 'Pick a new date and time. Your service and barber stay the same.' : 'Choose a service, barber, date, time and how you want to pay.';
    $('#book-submit').textContent = id ? 'Save new time' : 'Confirm booking';
    var dateInput = $('#bk-date');
    dateInput.min = isoDaysFromNow(0);
    dateInput.max = isoDaysFromNow(60);
    dateInput.value = (prefill && prefill.date && prefill.date >= dateInput.min) ? prefill.date : isoDaysFromNow(1);
    if (prefill && prefill.serviceId) $('#bk-service').value = String(prefill.serviceId);
    var fav = favouriteBarber();
    $('#bk-barber').value = prefill && prefill.barberId !== undefined ? String(prefill.barberId || '') : (fav ? String(fav.id) : '');
    $('#bk-service').disabled = !!id;
    $('#bk-barber').disabled = !!id;

    // Payment choice only applies to new bookings
    var payBox = $('#pay-choice');
    payBox.hidden = !!id;
    var psOpt = $('#pay-option-paystack');
    psOpt.classList.toggle('disabled', !payConfig.paystack);
    psOpt.querySelector('input').disabled = !payConfig.paystack;
    psOpt.querySelector('small').textContent = payConfig.paystack ? 'Card or mobile money. Secure checkout.' : 'Online payment is not available yet.';
    bookForm.payment.value = 'cash';
    updateTotal();

    renderSlots(prefill && prefill.time24);
    $('#slot-error').style.display = 'none';
    dateInput.closest('.field').classList.remove('has-error');
    openModal(bookModal);
    $('#bk-service').focus();
  }

  /* ---------- Paystack ---------- */
  function payWithPaystack(bookingId, done) {
    if (!window.PaystackPop) { toast('Paystack could not load. Check your internet connection and try again.'); return; }
    BarberfieAPI.api('/payments/paystack/start', { method: 'POST', body: { bookingId: bookingId } }).then(function (p) {
      var handler = PaystackPop.setup({
        key: p.publicKey,
        email: p.email,
        amount: p.amount,
        currency: p.currency,
        ref: p.reference,
        metadata: { bookingId: bookingId },
        callback: function (resp) {
          toast('Confirming your payment...');
          BarberfieAPI.api('/payments/paystack/verify', { method: 'POST', body: { reference: resp.reference } }).then(function () {
            toast('Payment received. Thank you!');
            reloadBookings();
            if (done) done(true);
          }).catch(function (err) { toast(err.message); reloadBookings(); if (done) done(false); });
        },
        onClose: function () {
          toast('Payment not completed. You can pay later from your appointments, or pay cash at the shop.');
          reloadBookings();
          if (done) done(false);
        }
      });
      handler.openIframe();
    }).catch(function (err) { toast(err.message); if (done) done(false); });
  }

  /* ---------- Booking submit ---------- */
  bookForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var date = $('#bk-date'), time = $('#bk-time').value;
    var ok = true;
    if (!date.value || date.value < date.min) { date.closest('.field').classList.add('has-error'); date.closest('.field').querySelector('.error').textContent = 'Choose a date from today onwards.'; ok = false; }
    else date.closest('.field').classList.remove('has-error');
    if (!time) { $('#slot-error').textContent = 'Pick a time slot.'; $('#slot-error').style.display = 'block'; ok = false; }
    if (!ok) return;

    var btn = $('#book-submit');
    btn.disabled = true;

    if (editingId) {
      BarberfieAPI.updateBooking(editingId, { date: date.value, time: time }).then(function (b) {
        toast('Moved to ' + fmtDate(b.date) + ' at ' + BarberfieAPI.to12h(b.time) + '.');
        closeModal(bookModal);
        reloadBookings();
      }).catch(function (err) { toast(err.message); }).then(function () { btn.disabled = false; });
      return;
    }

    var method = bookForm.payment.value === 'paystack' && payConfig.paystack ? 'paystack' : 'cash';
    BarberfieAPI.createBooking({
      serviceId: Number($('#bk-service').value),
      barberId: $('#bk-barber').value ? Number($('#bk-barber').value) : null,
      date: date.value, time: time, paymentMethod: method
    }).then(function (b) {
      closeModal(bookModal);
      btn.disabled = false;
      if (method === 'paystack') {
        toast('Booked! Opening secure payment...');
        payWithPaystack(b.id);
      } else {
        toast('Booked! ' + b.service + ' on ' + fmtDate(b.date) + ' at ' + BarberfieAPI.to12h(b.time) + '. Pay cash at the shop.');
        reloadBookings();
      }
    }).catch(function (err) { toast(err.message); btn.disabled = false; });
  });

  /* ---------- Global action handler ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var id = parseInt(btn.getAttribute('data-id'), 10);
    var appt = data.appointments.filter(function (a) { return a.id === id; })[0];

    if (action === 'book') { openBooking(); }
    else if (action === 'pay' && appt) { payWithPaystack(appt.id); }
    else if (action === 'rebook') {
      var src = appt || data.appointments.filter(function (a) { return a.status === 'completed'; }).sort(function (a, b) { return b.date.localeCompare(a.date); })[0];
      if (!src) { toast('No previous visit to rebook. Start a fresh booking.'); openBooking(); return; }
      openBooking({ serviceId: src.serviceId, barberId: src.barberId });
    }
    else if (action === 'reschedule' && appt) { openBooking(appt, appt.id); }
    else if (action === 'cancel' && appt) {
      var warn = appt.paymentStatus === 'paid' ? ' You have already paid; the shop will arrange your refund.' : '';
      confirm('Cancel your ' + appt.service + ' on ' + fmtDate(appt.date) + ' at ' + appt.time + '?' + warn, 'Yes, cancel it', function () {
        BarberfieAPI.updateBooking(appt.id, { status: 'cancelled' }).then(function () {
          toast('Appointment cancelled. We hope to see you soon.');
          reloadBookings();
        }).catch(function (err) { toast(err.message); });
      });
    }
    else if (action === 'calendar' && appt) {
      var start = appt.date.replace(/-/g, '');
      var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'SUMMARY:BARBERFIE - ' + appt.service, 'DESCRIPTION:With ' + appt.barber + ' at ' + appt.time, 'DTSTART;VALUE=DATE:' + start, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      var url = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
      var a = document.createElement('a'); a.href = url; a.download = 'barberfie-appointment.ics'; document.body.appendChild(a); a.click(); a.remove();
      toast('Calendar file downloaded.');
    }
    else if (action === 'redeem') {
      e.preventDefault();
      toast('Show this screen at the counter to redeem: ' + btn.getAttribute('data-reward') + '.');
    }
  });

  /* ---------- Change favourite barber ---------- */
  $('#change-barber').addEventListener('click', function (e) {
    e.preventDefault();
    if (!catalog.barbers.length) return;
    var ids = catalog.barbers.map(function (b) { return b.id; });
    var idx = ids.indexOf(Number(data.user.favouriteBarberId));
    var nextId = ids[(idx + 1) % ids.length];
    BarberfieAPI.updateMe({ favouriteBarberId: nextId }).then(function (d) {
      applyAccount(d.user); renderUser();
      toast('Favourite barber set to ' + barberById(nextId).name + '.');
    }).catch(function (err) { toast(err.message); });
  });

  /* ---------- Profile ---------- */
  function setErr(input, msg) {
    var f = input.closest('.field');
    f.classList.toggle('has-error', !!msg);
    if (msg) { input.setAttribute('aria-invalid', 'true'); f.querySelector('.error').textContent = msg; }
    else input.removeAttribute('aria-invalid');
  }
  var profileForm = $('#profile-form');
  profileForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = profileForm, ok = true;
    if (!f.firstName.value.trim()) { setErr(f.firstName, 'First name is required.'); ok = false; } else setErr(f.firstName);
    if (!f.lastName.value.trim()) { setErr(f.lastName, 'Last name is required.'); ok = false; } else setErr(f.lastName);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) { setErr(f.email, 'Enter a valid email address.'); ok = false; } else setErr(f.email);
    if (f.phone.value && !/^\+?[\d\s-]{9,15}$/.test(f.phone.value.trim())) { setErr(f.phone, 'Enter a valid phone number.'); ok = false; } else setErr(f.phone);
    if (!ok) { toast('Please fix the highlighted fields.'); return; }
    BarberfieAPI.updateMe({
      firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(),
      email: f.email.value.trim(), phone: f.phone.value.trim(), notes: f.notes.value.trim()
    }).then(function (d) {
      applyAccount(d.user);
      BarberfieAPI.setSession(BarberfieAPI.getToken(), d.user);
      renderUser();
      toast('Profile saved.');
    }).catch(function (err) { toast(err.message); });
  });
  $('#profile-reset').addEventListener('click', function () { renderUser(); $$('.field', profileForm).forEach(function (f) { f.classList.remove('has-error'); }); toast('Changes discarded.'); });

  var pwForm = $('#password-form');
  pwForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = pwForm, ok = true;
    if (!f.current.value) { setErr(f.current, 'Enter your current password.'); ok = false; } else setErr(f.current);
    if (f.next.value.length < 8) { setErr(f.next, 'Use at least 8 characters.'); ok = false; } else setErr(f.next);
    if (f.confirm.value !== f.next.value) { setErr(f.confirm, 'Passwords do not match.'); ok = false; } else setErr(f.confirm);
    if (!ok) return;
    BarberfieAPI.changePassword(f.current.value, f.next.value).then(function () {
      f.reset();
      toast('Password updated.');
    }).catch(function (err) { toast(err.message); });
  });

  /* ---------- Settings ---------- */
  $$('.switch[data-pref]').forEach(function (sw) {
    sw.addEventListener('click', function () {
      var key = sw.getAttribute('data-pref');
      data.prefs[key] = !data.prefs[key];
      sw.setAttribute('aria-checked', data.prefs[key] ? 'true' : 'false');
      var prefs = {}; prefs[key] = data.prefs[key];
      BarberfieAPI.updateMe({ prefs: prefs }).catch(function (err) { toast(err.message); });
      toast(document.getElementById(sw.getAttribute('aria-labelledby')).textContent + (data.prefs[key] ? ' turned on.' : ' turned off.'));
    });
  });

  /* Theme (light / dark) */
  var themeSwitch = $('#theme-switch');
  if (themeSwitch && window.BarberfieTheme) {
    themeSwitch.setAttribute('aria-checked', BarberfieTheme.get() === 'light' ? 'true' : 'false');
    themeSwitch.addEventListener('click', function () {
      var t = BarberfieTheme.toggle();
      themeSwitch.setAttribute('aria-checked', t === 'light' ? 'true' : 'false');
      toast(t === 'light' ? 'Light theme on.' : 'Dark theme on.');
    });
  }

  $('#delete-account').addEventListener('click', function () {
    confirm('This permanently deletes your account, bookings and loyalty points.', 'Delete my account', function () {
      BarberfieAPI.api('/me', { method: 'DELETE' }).then(function () {
        BarberfieAPI.logout();
        window.location.href = '../landingpage.hmtl/homepage.html';
      }).catch(function (err) { toast(err.message); });
    });
  });

  $('#logout').addEventListener('click', function () {
    BarberfieAPI.logout();
    toast('Signing you out...');
    setTimeout(function () { window.location.href = '../auth/login.html'; }, 600);
  });

  /* ---------- Init: load the signed-in account and their data ---------- */
  function applyAccount(u) {
    data.user.firstName = u.firstName;
    data.user.lastName = u.lastName;
    data.user.email = u.email;
    data.user.phone = u.phone || '';
    data.user.notes = u.notes || '';
    data.user.since = u.since ? String(u.since).slice(0, 10) : '';
    data.user.favouriteBarberId = u.favouriteBarberId || null;
    if (u.prefs) data.prefs = { reminders: !!u.prefs.reminders, promos: !!u.prefs.promos, whatsapp: !!u.prefs.whatsapp };
  }

  function reloadBookings() {
    return BarberfieAPI.bookings().then(function (list) {
      data.appointments = list.map(fromApi);
      renderOverview(); renderAppointments(); renderLoyalty();
    }).catch(function (err) { toast(err.message); });
  }

  if (!window.BarberfieAPI || !BarberfieAPI.isSignedIn()) {
    window.location.replace('../auth/login.html');
    return;
  }

  var cached = BarberfieAPI.getUser();
  if (cached) { applyAccount(cached); renderUser(); }

  Promise.all([
    BarberfieAPI.me(),
    BarberfieAPI.services(),
    BarberfieAPI.barbers(),
    BarberfieAPI.api('/payments/config').catch(function () { return payConfig; }),
    BarberfieAPI.bookings()
  ]).then(function (r) {
    applyAccount(r[0].user);
    BarberfieAPI.setSession(BarberfieAPI.getToken(), r[0].user);
    catalog.services = r[1];
    catalog.barbers = r[2];
    payConfig = r[3];
    data.appointments = r[4].map(fromApi);
    fillCatalog();
    renderAll();
  }).catch(function (err) {
    if (err.status === 401) { window.location.replace('../auth/login.html'); return; }
    toast(err.message);
  });
})();
