/* ==========================================================
   BARBERFIE - admin dashboard behaviour
   Sample data lives in localStorage so the panel works as a
   demo. Replace load()/save() with API calls later.
   ========================================================== */

(function () {
  'use strict';

  var STORE_KEY = 'barberfie.admin';
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'];

  /* ---------- Data ---------- */
  function iso(offsetDays) {
    var d = new Date(); d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }
  var TODAY = iso(0);

  function defaultData() {
    var customers = [
      { id: 1, firstName: 'Kwame', lastName: 'Mensah', email: 'kwame@example.com', phone: '+233 24 000 0001', notes: 'Number 2 on the sides.', since: '2025-03-01' },
      { id: 2, firstName: 'Nana', lastName: 'Osei', email: 'nana@example.com', phone: '+233 24 000 0002', notes: '', since: '2025-05-14' },
      { id: 3, firstName: 'Kojo', lastName: 'Appiah', email: 'kojo@example.com', phone: '+233 24 000 0003', notes: 'Sensitive skin - warm towel only.', since: '2025-08-02' },
      { id: 4, firstName: 'Yaw', lastName: 'Darko', email: 'yaw.d@example.com', phone: '+233 24 000 0004', notes: '', since: '2026-01-20' },
      { id: 5, firstName: 'Efua', lastName: 'Sarpong', email: 'efua@example.com', phone: '+233 24 000 0005', notes: 'Books for her two sons.', since: '2026-02-11' },
      { id: 6, firstName: 'Kofi', lastName: 'Amoah', email: 'kamoah@example.com', phone: '+233 24 000 0006', notes: '', since: '2026-06-30' }
    ];
    var barbers = [
      { id: 1, name: 'Daniel Asante', bio: 'Fades and beard specialist. 6 years at the chair.', days: [1, 2, 3, 4, 5, 6], active: true },
      { id: 2, name: 'Yaw Boateng', bio: 'Classic cuts and scissor work. Great with kids.', days: [1, 2, 3, 5, 6, 0], active: true },
      { id: 3, name: 'Kofi Owusu', bio: 'Hot towel shaves and line-ups.', days: [2, 3, 4, 5, 6], active: true }
    ];
    var services = [
      { id: 1, name: 'Classic Haircut', price: 40, duration: 30, active: true },
      { id: 2, name: 'Skin Fade', price: 50, duration: 45, active: true },
      { id: 3, name: 'Beard Trim & Shape', price: 25, duration: 20, active: true },
      { id: 4, name: 'Hot Towel Shave', price: 35, duration: 30, active: true },
      { id: 5, name: 'Kids Cut (under 12)', price: 30, duration: 25, active: true },
      { id: 6, name: 'Cut & Beard Combo', price: 60, duration: 60, active: true }
    ];
    var bookings = [];
    var seed = [
      [0, '9:00 AM', 1, 2, 1, 'completed'], [0, '10:00 AM', 2, 1, 2, 'completed'], [0, '11:00 AM', 3, 4, 3, 'confirmed'],
      [0, '1:00 PM', 4, 6, 1, 'confirmed'], [0, '3:00 PM', 5, 5, 2, 'pending'], [0, '5:00 PM', 6, 2, 3, 'confirmed'],
      [1, '10:00 AM', 1, 1, 1, 'confirmed'], [1, '2:00 PM', 3, 3, 3, 'confirmed'], [2, '11:00 AM', 5, 5, 2, 'pending'],
      [3, '4:00 PM', 2, 6, 1, 'confirmed'], [5, '12:00 PM', 4, 2, 2, 'confirmed'],
      [-1, '9:00 AM', 2, 2, 1, 'completed'], [-1, '11:00 AM', 4, 1, 2, 'completed'], [-1, '3:00 PM', 6, 4, 3, 'no-show'],
      [-2, '10:00 AM', 1, 6, 1, 'completed'], [-2, '2:00 PM', 3, 2, 1, 'completed'], [-2, '4:00 PM', 5, 5, 2, 'completed'],
      [-3, '9:00 AM', 6, 1, 3, 'completed'], [-3, '1:00 PM', 2, 3, 1, 'cancelled'],
      [-4, '11:00 AM', 4, 2, 2, 'completed'], [-4, '5:00 PM', 1, 1, 1, 'completed'], [-4, '6:00 PM', 3, 6, 3, 'completed'],
      [-5, '10:00 AM', 5, 5, 2, 'completed'], [-5, '3:00 PM', 6, 2, 1, 'completed'],
      [-6, '12:00 PM', 2, 4, 3, 'completed'], [-6, '2:00 PM', 4, 1, 2, 'completed'], [-6, '4:00 PM', 1, 2, 1, 'completed'],
      [-12, '2:00 PM', 1, 6, 1, 'completed'], [-20, '10:00 AM', 3, 2, 1, 'completed'], [-30, '1:00 PM', 2, 1, 2, 'completed']
    ];
    seed.forEach(function (s, i) {
      var svc = services[s[3] - 1];
      bookings.push({ id: 100 + i, date: iso(s[0]), time: s[1], customerId: s[2], serviceId: s[3], barberId: s[4], price: svc.price, status: s[5] });
    });
    return {
      customers: customers, barbers: barbers, services: services, bookings: bookings,
      shop: { name: 'BARBERFIE', phone: '+233 00 000 0000', email: 'hello@barberfie.com', address: '12 High Street, Accra' },
      hours: { 0: ['12:00', '18:00', true], 1: ['08:00', '20:00', true], 2: ['08:00', '20:00', true], 3: ['08:00', '20:00', true], 4: ['08:00', '20:00', true], 5: ['08:00', '20:00', true], 6: ['08:00', '21:00', true] },
      rules: { online: true, autoConfirm: true, reminders: true }
    };
  }

  function load() {
    try { var raw = localStorage.getItem(STORE_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
    return defaultData();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }
  var data = load();

  /* ---------- Helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function cust(id) { var c = byId(data.customers, id); return c ? c.firstName + ' ' + c.lastName : 'Unknown'; }
  function barber(id) { var b = byId(data.barbers, id); return b ? b.name : 'Any'; }
  function service(id) { var s = byId(data.services, id); return s ? s.name : 'Service'; }
  function fmtDate(d, opts) { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', opts || { weekday: 'short', day: 'numeric', month: 'short' }); }
  function money(n) { return 'GH₵ ' + n; }
  function timeKey(t) { var h = parseInt(t, 10); if (/PM/.test(t) && h !== 12) h += 12; if (/AM/.test(t) && h === 12) h = 0; return h; }
  function sortByDateTime(a, b) { return (a.date + String(timeKey(a.time)).padStart(2, '0')).localeCompare(b.date + String(timeKey(b.time)).padStart(2, '0')); }
  function nextId(list) { return list.reduce(function (m, x) { return Math.max(m, x.id); }, 0) + 1; }
  function weekStart() { var d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  /* ---------- Section navigation ---------- */
  var sections = $$('.dash-section'), navLinks = $$('.dash-nav a[data-section]');
  function showSection(id, focus) {
    sections.forEach(function (s) { s.classList.toggle('active', s.id === id); });
    navLinks.forEach(function (l) {
      var on = l.getAttribute('data-section') === id;
      l.classList.toggle('active', on);
      if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
    });
    if (focus) { var h = $('#' + id + ' h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  navLinks.forEach(function (l) {
    l.addEventListener('click', function (e) { e.preventDefault(); var id = l.getAttribute('data-section'); history.replaceState(null, '', '#' + id); showSection(id, true); });
  });
  (function () {
    var id = location.hash.replace('#', '');
    if (id && $('#' + id + '.dash-section')) showSection(id);
  })();

  /* ---------- Modals ---------- */
  var lastFocus = null, confirmCb = null;
  function openModal(m) { lastFocus = document.activeElement; m.showModal(); var f = m.querySelector('input, select, textarea'); if (f) f.focus(); }
  function closeModal(m) { m.close(); if (lastFocus) lastFocus.focus(); }
  $$('[data-close]').forEach(function (b) { b.addEventListener('click', function () { closeModal(b.closest('dialog')); }); });
  $$('dialog').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(m); });
    m.addEventListener('cancel', function (e) { e.preventDefault(); closeModal(m); });
  });
  function confirmDlg(text, yes, cb) { $('#confirm-text').textContent = text; $('#confirm-yes').textContent = yes; confirmCb = cb; openModal($('#confirm-modal')); }
  $('#confirm-yes').addEventListener('click', function () { closeModal($('#confirm-modal')); if (confirmCb) confirmCb(); });

  function setErr(input, msg) {
    var f = input.closest('.field'); if (!f) return;
    f.classList.toggle('has-error', !!msg);
    if (msg) { input.setAttribute('aria-invalid', 'true'); var e = f.querySelector('.error'); if (e) e.textContent = msg; }
    else input.removeAttribute('aria-invalid');
  }

  /* ---------- Overview ---------- */
  function renderOverview() {
    $('#today-label').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    var today = data.bookings.filter(function (b) { return b.date === TODAY && b.status !== 'cancelled'; }).sort(sortByDateTime);
    var done = today.filter(function (b) { return b.status === 'completed'; });
    var pending = data.bookings.filter(function (b) { return b.status === 'pending' && b.date >= TODAY; }).length;
    $('#st-today').textContent = today.length;
    $('#st-today-hint').textContent = done.length + ' done' + (pending ? ' · ' + pending + ' pending approval' : '');
    $('#st-rev').textContent = money(done.reduce(function (s, b) { return s + b.price; }, 0));

    var ws = weekStart();
    var week = data.bookings.filter(function (b) { return b.status === 'completed' && b.date >= ws && b.date <= TODAY; });
    $('#st-week').textContent = money(week.reduce(function (s, b) { return s + b.price; }, 0));
    $('#st-week-hint').textContent = week.length + ' completed visits since ' + fmtDate(ws);

    var newCust = data.customers.filter(function (c) { return c.since >= iso(-30); }).length;
    $('#st-cust').textContent = data.customers.length;
    $('#st-cust-hint').textContent = newCust + ' new in the last 30 days';

    var sched = $('#today-schedule');
    sched.innerHTML = today.length ? today.map(function (b) {
      var isDone = b.status === 'completed' || b.status === 'no-show';
      return '<li class="' + (isDone ? 'done' : '') + '"><span class="time">' + esc(b.time) + '</span>' +
        '<div class="who"><strong>' + esc(cust(b.customerId)) + '<span class="badge ' + b.status + '">' + b.status + '</span></strong><span>' + esc(service(b.serviceId)) + ' · ' + esc(barber(b.barberId)) + '</span></div>' +
        (isDone ? '<span></span>' : '<button class="btn btn-ghost btn-sm" type="button" data-action="complete" data-id="' + b.id + '">Mark done</button>') + '</li>';
    }).join('') : '<li class="empty"><p>No bookings today yet.</p><button class="btn btn-primary btn-sm" type="button" data-action="new-booking">Add one</button></li>';

    // Week chart
    var days = [], max = 1;
    for (var i = 6; i >= 0; i--) {
      var d = iso(-i);
      var n = data.bookings.filter(function (b) { return b.date === d && b.status === 'completed'; }).length;
      max = Math.max(max, n); days.push({ d: d, n: n });
    }
    $('#week-chart').innerHTML = days.map(function (x) {
      return '<div class="bar' + (x.d === TODAY ? ' today' : '') + '"><b>' + x.n + '</b><i style="height:' + Math.round((x.n / max) * 100) + '%"></i><small>' + DAYS[new Date(x.d + 'T00:00:00').getDay()] + '</small></div>';
    }).join('');

    // Popular services
    var counts = {};
    data.bookings.forEach(function (b) { if (b.status === 'completed') counts[b.serviceId] = (counts[b.serviceId] || 0) + 1; });
    var list = Object.keys(counts).map(function (k) { return { id: +k, n: counts[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
    var top = list.length ? list[0].n : 1;
    $('#popular').innerHTML = list.map(function (x) {
      return '<li><span>' + esc(service(x.id)) + '</span><span class="n">' + x.n + '</span><span class="track"><i style="width:' + Math.round((x.n / top) * 100) + '%"></i></span></li>';
    }).join('') || '<li><span class="n">No completed visits yet.</span></li>';
  }

  /* ---------- Bookings ---------- */
  var sortKey = 'date', sortDir = 1;
  function renderBookingFilters() {
    var sel = $('#bk-barber'); var cur = sel.value;
    sel.innerHTML = '<option value="">All barbers</option>' + data.barbers.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + '</option>'; }).join('');
    sel.value = cur;
  }
  function renderBookings() {
    var q = $('#bk-search').value.trim().toLowerCase();
    var st = $('#bk-status').value, range = $('#bk-range').value, bb = $('#bk-barber').value;
    var ws = weekStart(), we = iso(6 - new Date().getDay());
    var rows = data.bookings.filter(function (b) {
      if (st && b.status !== st) return false;
      if (bb && String(b.barberId) !== bb) return false;
      if (range === 'today' && b.date !== TODAY) return false;
      if (range === 'upcoming' && b.date < TODAY) return false;
      if (range === 'past' && b.date >= TODAY) return false;
      if (range === 'week' && (b.date < ws || b.date > we)) return false;
      if (q) {
        var hay = (cust(b.customerId) + ' ' + service(b.serviceId) + ' ' + barber(b.barberId)).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    rows.sort(function (a, b) {
      var r = sortKey === 'date' ? sortByDateTime(a, b) : sortKey === 'price' ? a.price - b.price : cust(a.customerId).localeCompare(cust(b.customerId));
      return r * sortDir;
    });
    $$('thead th[data-sort], thead th button[data-sort]').forEach(function (btn) {
      var th = btn.closest('th');
      if (btn.getAttribute('data-sort') === sortKey) th.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort');
    });
    $('#bk-count').textContent = rows.length + ' booking' + (rows.length === 1 ? '' : 's');
    $('#bk-table').innerHTML = rows.length ? rows.map(function (b) {
      var isToday = b.date === TODAY;
      return '<tr><td><strong>' + esc(fmtDate(b.date)) + '</strong>' + (isToday ? '<span class="badge today">today</span>' : '') + '<span class="sub">' + esc(b.time) + '</span></td>' +
        '<td>' + esc(cust(b.customerId)) + '</td><td>' + esc(service(b.serviceId)) + '</td><td>' + esc(barber(b.barberId)) + '</td>' +
        '<td class="num">' + money(b.price) + '</td><td><span class="badge ' + b.status + '">' + b.status + '</span></td>' +
        '<td class="actions">' +
          (b.status === 'pending' ? '<button class="btn btn-primary btn-sm" type="button" data-action="approve" data-id="' + b.id + '">Approve</button>' : '') +
          (b.status === 'confirmed' && b.date <= TODAY ? '<button class="btn btn-ghost btn-sm" type="button" data-action="complete" data-id="' + b.id + '">Done</button>' : '') +
          '<button class="icon-btn" type="button" data-action="edit-booking" data-id="' + b.id + '" aria-label="Edit booking for ' + esc(cust(b.customerId)) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button> ' +
          '<button class="icon-btn danger" type="button" data-action="delete-booking" data-id="' + b.id + '" aria-label="Delete booking for ' + esc(cust(b.customerId)) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>' +
        '</td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty"><p>No bookings match these filters.</p></div></td></tr>';
  }
  ['#bk-search', '#bk-status', '#bk-range', '#bk-barber'].forEach(function (s) { $(s).addEventListener('input', renderBookings); });
  $$('thead th button[data-sort]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var k = btn.getAttribute('data-sort');
      if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
      renderBookings();
    });
  });

  /* Booking modal */
  var bookingModal = $('#booking-modal'), bookingForm = $('#booking-form'), editingBooking = null;
  function fillBookingSelects() {
    $('#bm-customer').innerHTML = data.customers.slice().sort(function (a, b) { return a.firstName.localeCompare(b.firstName); }).map(function (c) { return '<option value="' + c.id + '">' + esc(c.firstName + ' ' + c.lastName) + '</option>'; }).join('');
    $('#bm-service').innerHTML = data.services.filter(function (s) { return s.active; }).map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + ' - ' + money(s.price) + '</option>'; }).join('');
    $('#bm-barber').innerHTML = data.barbers.filter(function (b) { return b.active; }).map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + '</option>'; }).join('');
    $('#bm-time').innerHTML = SLOTS.map(function (t) { return '<option>' + t + '</option>'; }).join('');
  }
  function openBooking(b) {
    editingBooking = b || null;
    fillBookingSelects();
    $('#bm-title').textContent = b ? 'Edit booking' : 'New booking';
    $('#bm-submit').textContent = b ? 'Save changes' : 'Create booking';
    var f = bookingForm;
    f.customer.value = b ? b.customerId : data.customers[0].id;
    f.service.value = b ? b.serviceId : data.services[0].id;
    f.barber.value = b ? b.barberId : data.barbers[0].id;
    f.date.value = b ? b.date : TODAY;
    f.time.value = b ? b.time : SLOTS[0];
    f.status.value = b ? b.status : (data.rules.autoConfirm ? 'confirmed' : 'pending');
    $$('.field', f).forEach(function (x) { x.classList.remove('has-error'); });
    openModal(bookingModal);
  }
  bookingForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = bookingForm, ok = true;
    if (!f.date.value) { setErr(f.date, 'Choose a date.'); ok = false; } else setErr(f.date);
    var clash = data.bookings.filter(function (x) {
      return x.id !== (editingBooking && editingBooking.id) && x.date === f.date.value && x.time === f.time.value && String(x.barberId) === f.barber.value && x.status !== 'cancelled';
    })[0];
    if (clash) { setErr(f.time, barber(+f.barber.value) + ' already has ' + cust(clash.customerId) + ' at this time.'); ok = false; } else setErr(f.time);
    if (!ok) return;
    var svc = byId(data.services, +f.service.value);
    var rec = editingBooking || { id: nextId(data.bookings) };
    rec.customerId = +f.customer.value; rec.serviceId = svc.id; rec.barberId = +f.barber.value;
    rec.date = f.date.value; rec.time = f.time.value; rec.status = f.status.value;
    if (!editingBooking) { rec.price = svc.price; data.bookings.push(rec); }
    else if (rec.serviceId !== svc.id) rec.price = svc.price;
    save(); renderAll(); closeModal(bookingModal);
    toast((editingBooking ? 'Booking updated' : 'Booking created') + ' for ' + cust(rec.customerId) + '.');
  });

  /* ---------- Customers ---------- */
  function customerStats(c) {
    var visits = data.bookings.filter(function (b) { return b.customerId === c.id && b.status === 'completed'; });
    var spent = visits.reduce(function (s, b) { return s + b.price; }, 0);
    var last = visits.map(function (b) { return b.date; }).sort().pop();
    return { visits: visits.length, spent: spent, points: spent, last: last };
  }
  function renderCustomers() {
    var q = $('#cu-search').value.trim().toLowerCase();
    var rows = data.customers.filter(function (c) {
      return !q || (c.firstName + ' ' + c.lastName + ' ' + c.email + ' ' + c.phone).toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) { return a.firstName.localeCompare(b.firstName); });
    $('#cu-count').textContent = rows.length + ' customer' + (rows.length === 1 ? '' : 's');
    $('#cu-table').innerHTML = rows.length ? rows.map(function (c) {
      var s = customerStats(c);
      return '<tr><td><strong>' + esc(c.firstName + ' ' + c.lastName) + '</strong>' + (c.notes ? '<span class="sub">' + esc(c.notes) + '</span>' : '') + '</td>' +
        '<td>' + esc(c.email) + '<span class="sub">' + esc(c.phone) + '</span></td>' +
        '<td class="num">' + s.visits + '</td><td class="num">' + money(s.spent) + '</td><td class="num" style="color:var(--gold);font-weight:700;">' + s.points + '</td>' +
        '<td>' + (s.last ? esc(fmtDate(s.last, { day: 'numeric', month: 'short', year: 'numeric' })) : '<span class="sub">Never</span>') + '</td>' +
        '<td class="actions"><button class="btn btn-ghost btn-sm" type="button" data-action="book-for" data-id="' + c.id + '">Book</button>' +
        '<button class="icon-btn" type="button" data-action="edit-customer" data-id="' + c.id + '" aria-label="Edit ' + esc(c.firstName) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button> ' +
        '<button class="icon-btn danger" type="button" data-action="delete-customer" data-id="' + c.id + '" aria-label="Delete ' + esc(c.firstName) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button></td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty"><p>No customers found.</p></div></td></tr>';
  }
  $('#cu-search').addEventListener('input', renderCustomers);

  var customerModal = $('#customer-modal'), customerForm = $('#customer-form'), editingCustomer = null;
  function openCustomer(c) {
    editingCustomer = c || null;
    $('#cm-title').textContent = c ? 'Edit customer' : 'Add customer';
    var f = customerForm;
    f.firstName.value = c ? c.firstName : ''; f.lastName.value = c ? c.lastName : '';
    f.email.value = c ? c.email : ''; f.phone.value = c ? c.phone : ''; f.notes.value = c ? c.notes : '';
    $$('.field', f).forEach(function (x) { x.classList.remove('has-error'); });
    openModal(customerModal);
  }
  customerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = customerForm, ok = true;
    if (!f.firstName.value.trim()) { setErr(f.firstName, 'Required.'); ok = false; } else setErr(f.firstName);
    if (!f.lastName.value.trim()) { setErr(f.lastName, 'Required.'); ok = false; } else setErr(f.lastName);
    if (f.email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) { setErr(f.email, 'Enter a valid email.'); ok = false; } else setErr(f.email);
    if (!f.email.value && !f.phone.value) { setErr(f.phone, 'Add an email or a phone number.'); ok = false; } else setErr(f.phone);
    if (!ok) return;
    var rec = editingCustomer || { id: nextId(data.customers), since: TODAY };
    rec.firstName = f.firstName.value.trim(); rec.lastName = f.lastName.value.trim();
    rec.email = f.email.value.trim(); rec.phone = f.phone.value.trim(); rec.notes = f.notes.value.trim();
    if (!editingCustomer) data.customers.push(rec);
    save(); renderAll(); closeModal(customerModal);
    toast((editingCustomer ? 'Updated ' : 'Added ') + rec.firstName + ' ' + rec.lastName + '.');
  });

  /* ---------- Barbers ---------- */
  function renderBarbers() {
    $('#staff-grid').innerHTML = data.barbers.map(function (b) {
      var todayCount = data.bookings.filter(function (x) { return x.barberId === b.id && x.date === TODAY && x.status !== 'cancelled'; }).length;
      var monthDone = data.bookings.filter(function (x) { return x.barberId === b.id && x.status === 'completed' && x.date >= iso(-30); }).length;
      return '<article class="staff"><div class="top"><div class="avatar" aria-hidden="true">' + esc(b.name.split(' ').map(function (p) { return p[0]; }).join('')) + '</div>' +
        '<div><h3>' + esc(b.name) + '<span class="badge ' + (b.active ? 'active' : 'inactive') + '">' + (b.active ? 'active' : 'off') + '</span></h3><p>' + esc(b.bio) + '</p></div></div>' +
        '<div class="days" aria-label="Working days">' + DAYS.map(function (d, i) { return '<span class="' + (b.days.indexOf(i) > -1 ? 'on' : '') + '">' + d + '</span>'; }).join('') + '</div>' +
        '<p>' + todayCount + ' booking' + (todayCount === 1 ? '' : 's') + ' today · ' + monthDone + ' completed in 30 days</p>' +
        '<div class="foot"><button class="btn btn-ghost btn-sm" type="button" data-action="toggle-barber" data-id="' + b.id + '">' + (b.active ? 'Set as off' : 'Set active') + '</button>' +
        '<span><button class="icon-btn" type="button" data-action="edit-barber" data-id="' + b.id + '" aria-label="Edit ' + esc(b.name) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button> ' +
        '<button class="icon-btn danger" type="button" data-action="delete-barber" data-id="' + b.id + '" aria-label="Remove ' + esc(b.name) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button></span></div></article>';
    }).join('') || '<div class="empty" style="grid-column:1/-1;"><p>No barbers yet.</p></div>';
  }
  var barberModal = $('#barber-modal'), barberForm = $('#barber-form'), editingBarber = null;
  $('#day-picks').innerHTML = DAYS.map(function (d, i) { return '<label><input type="checkbox" name="days" value="' + i + '"> ' + d + '</label>'; }).join('');
  function openBarber(b) {
    editingBarber = b || null;
    $('#brm-title').textContent = b ? 'Edit barber' : 'Add barber';
    barberForm.name.value = b ? b.name : ''; barberForm.bio.value = b ? b.bio : '';
    $$('#day-picks input').forEach(function (cb) { cb.checked = b ? b.days.indexOf(+cb.value) > -1 : +cb.value !== 0; });
    $$('.field', barberForm).forEach(function (x) { x.classList.remove('has-error'); });
    openModal(barberModal);
  }
  barberForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = barberForm;
    if (!f.name.value.trim()) { setErr(f.name, 'Enter a name.'); return; } setErr(f.name);
    var rec = editingBarber || { id: nextId(data.barbers), active: true };
    rec.name = f.name.value.trim(); rec.bio = f.bio.value.trim();
    rec.days = $$('#day-picks input:checked').map(function (cb) { return +cb.value; });
    if (!editingBarber) data.barbers.push(rec);
    save(); renderAll(); closeModal(barberModal);
    toast(rec.name + ' saved.');
  });

  /* ---------- Services ---------- */
  function renderServices() {
    $('#sv-table').innerHTML = data.services.map(function (s) {
      var n = data.bookings.filter(function (b) { return b.serviceId === s.id && b.status === 'completed'; }).length;
      return '<tr><td><strong>' + esc(s.name) + '</strong></td><td class="num">' + money(s.price) + '</td><td class="num">' + s.duration + ' min</td><td class="num">' + n + '</td>' +
        '<td><span class="badge ' + (s.active ? 'active' : 'inactive') + '">' + (s.active ? 'listed' : 'hidden') + '</span></td>' +
        '<td class="actions"><button class="btn btn-ghost btn-sm" type="button" data-action="toggle-service" data-id="' + s.id + '">' + (s.active ? 'Hide' : 'Show') + '</button>' +
        '<button class="icon-btn" type="button" data-action="edit-service" data-id="' + s.id + '" aria-label="Edit ' + esc(s.name) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button> ' +
        '<button class="icon-btn danger" type="button" data-action="delete-service" data-id="' + s.id + '" aria-label="Delete ' + esc(s.name) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button></td></tr>';
    }).join('');
  }
  var serviceModal = $('#service-modal'), serviceForm = $('#service-form'), editingService = null;
  function openService(s) {
    editingService = s || null;
    $('#sm-title').textContent = s ? 'Edit service' : 'Add service';
    serviceForm.name.value = s ? s.name : ''; serviceForm.price.value = s ? s.price : ''; serviceForm.duration.value = s ? s.duration : 30;
    $$('.field', serviceForm).forEach(function (x) { x.classList.remove('has-error'); });
    openModal(serviceModal);
  }
  serviceForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = serviceForm, ok = true;
    if (!f.name.value.trim()) { setErr(f.name, 'Enter a name.'); ok = false; } else setErr(f.name);
    if (!(+f.price.value >= 0) || f.price.value === '') { setErr(f.price, 'Enter a price.'); ok = false; } else setErr(f.price);
    if (!(+f.duration.value >= 5)) { setErr(f.duration, 'At least 5 minutes.'); ok = false; } else setErr(f.duration);
    if (!ok) return;
    var rec = editingService || { id: nextId(data.services), active: true };
    rec.name = f.name.value.trim(); rec.price = +f.price.value; rec.duration = +f.duration.value;
    if (!editingService) data.services.push(rec);
    save(); renderAll(); closeModal(serviceModal);
    toast(rec.name + ' saved.');
  });

  /* ---------- Settings ---------- */
  function renderSettings() {
    var grid = $('#hours-grid');
    $$('.row', grid).forEach(function (r) { r.remove(); });
    var order = [1, 2, 3, 4, 5, 6, 0];
    var html = order.map(function (d) {
      var h = data.hours[d];
      return '<span class="row day">' + DAYS[d] + '</span>' +
        '<input class="row" type="time" name="open-' + d + '" value="' + h[0] + '"' + (h[2] ? '' : ' disabled') + ' aria-label="' + DAYS[d] + ' opens">' +
        '<input class="row" type="time" name="close-' + d + '" value="' + h[1] + '"' + (h[2] ? '' : ' disabled') + ' aria-label="' + DAYS[d] + ' closes">' +
        '<button class="row switch" type="button" role="switch" aria-checked="' + (h[2] ? 'true' : 'false') + '" aria-label="' + DAYS[d] + ' open" data-day="' + d + '"></button>';
    }).join('');
    grid.insertAdjacentHTML('beforeend', html);
    $('#sh-name').value = data.shop.name; $('#sh-phone').value = data.shop.phone; $('#sh-email').value = data.shop.email; $('#sh-address').value = data.shop.address;
    $$('.switch[data-rule]').forEach(function (sw) { sw.setAttribute('aria-checked', data.rules[sw.getAttribute('data-rule')] ? 'true' : 'false'); });
  }
  $('#hours-grid').addEventListener('click', function (e) {
    var sw = e.target.closest('.switch[data-day]'); if (!sw) return;
    var d = sw.getAttribute('data-day'), on = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', on ? 'true' : 'false');
    $('[name="open-' + d + '"]').disabled = !on; $('[name="close-' + d + '"]').disabled = !on;
  });
  $('#hours-form').addEventListener('submit', function (e) {
    e.preventDefault();
    for (var d = 0; d < 7; d++) {
      var on = $('.switch[data-day="' + d + '"]').getAttribute('aria-checked') === 'true';
      var o = $('[name="open-' + d + '"]').value, c = $('[name="close-' + d + '"]').value;
      if (on && o >= c) { toast(DAYS[d] + ': closing time must be after opening time.'); return; }
      data.hours[d] = [o, c, on];
    }
    save(); toast('Opening hours saved.');
  });
  $('#shop-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (!f.name.value.trim()) { setErr(f.name, 'Shop name is required.'); return; } setErr(f.name);
    if (f.email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) { setErr(f.email, 'Enter a valid email.'); return; } setErr(f.email);
    data.shop = { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), address: f.address.value.trim() };
    save(); toast('Shop details saved.');
  });
  $$('.switch[data-rule]').forEach(function (sw) {
    sw.addEventListener('click', function () {
      var k = sw.getAttribute('data-rule'); data.rules[k] = !data.rules[k];
      sw.setAttribute('aria-checked', data.rules[k] ? 'true' : 'false'); save();
      toast(document.getElementById(sw.getAttribute('aria-labelledby')).textContent + (data.rules[k] ? ' on.' : ' off.'));
    });
  });
  $('#reset-data').addEventListener('click', function () {
    confirmDlg('Reset all demo bookings, customers, barbers and settings to their defaults?', 'Reset data', function () {
      data = defaultData(); save(); renderAll(); toast('Demo data reset.');
    });
  });

  /* ---------- Global actions ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]'); if (!btn) return;
    var action = btn.getAttribute('data-action'), id = +btn.getAttribute('data-id');
    var b = byId(data.bookings, id), c = byId(data.customers, id), br = byId(data.barbers, id), s = byId(data.services, id);

    switch (action) {
      case 'new-booking': openBooking(); break;
      case 'edit-booking': if (b) openBooking(b); break;
      case 'book-for': openBooking(); bookingForm.customer.value = id; break;
      case 'approve': if (b) { b.status = 'confirmed'; save(); renderAll(); toast('Booking confirmed for ' + cust(b.customerId) + '.'); } break;
      case 'complete': if (b) { b.status = 'completed'; save(); renderAll(); toast(cust(b.customerId) + ' marked as done. ' + b.price + ' points added.'); } break;
      case 'delete-booking': if (b) confirmDlg('Delete the booking for ' + cust(b.customerId) + ' on ' + fmtDate(b.date) + '?', 'Delete booking', function () {
        data.bookings = data.bookings.filter(function (x) { return x.id !== id; }); save(); renderAll(); toast('Booking deleted.');
      }); break;

      case 'new-customer': openCustomer(); break;
      case 'edit-customer': if (c) openCustomer(c); break;
      case 'delete-customer': if (c) confirmDlg('Delete ' + c.firstName + ' ' + c.lastName + ' and all of their bookings?', 'Delete customer', function () {
        data.customers = data.customers.filter(function (x) { return x.id !== id; });
        data.bookings = data.bookings.filter(function (x) { return x.customerId !== id; });
        save(); renderAll(); toast('Customer deleted.');
      }); break;

      case 'new-barber': openBarber(); break;
      case 'edit-barber': if (br) openBarber(br); break;
      case 'toggle-barber': if (br) { br.active = !br.active; save(); renderAll(); toast(br.name + (br.active ? ' is now active.' : ' set as off.')); } break;
      case 'delete-barber': if (br) {
        var upcoming = data.bookings.filter(function (x) { return x.barberId === id && x.date >= TODAY && x.status !== 'cancelled'; }).length;
        confirmDlg('Remove ' + br.name + '?' + (upcoming ? ' They have ' + upcoming + ' upcoming booking' + (upcoming === 1 ? '' : 's') + ' that you will need to reassign.' : ''), 'Remove barber', function () {
          data.barbers = data.barbers.filter(function (x) { return x.id !== id; }); save(); renderAll(); toast('Barber removed.');
        });
      } break;

      case 'new-service': openService(); break;
      case 'edit-service': if (s) openService(s); break;
      case 'toggle-service': if (s) { s.active = !s.active; save(); renderAll(); toast(s.name + (s.active ? ' is now listed.' : ' hidden from booking.')); } break;
      case 'delete-service': if (s) confirmDlg('Delete ' + s.name + '? Past bookings keep their record.', 'Delete service', function () {
        data.services = data.services.filter(function (x) { return x.id !== id; }); save(); renderAll(); toast('Service deleted.');
      }); break;
    }
  });

  $$('.dash-nav .logout').forEach(function (l) { l.addEventListener('click', function () { if (window.BarberfieAPI) BarberfieAPI.logout(); }); });

  /* ---------- Init ---------- */
  function renderAll() {
    renderOverview(); renderBookingFilters(); renderBookings(); renderCustomers(); renderBarbers(); renderServices(); renderSettings();
  }
  renderAll();
})();
