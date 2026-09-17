/* ==========================================================
   BARBERFIE — "The Chair" immersive landing page
   One scroll timeline drives five scenes shot in one room.
   Lenis smooths scroll, GSAP ScrollTrigger scrubs each scene,
   CSS sticky pins them. Without GSAP or with reduced motion
   the page falls back to a plain readable layout.
   ========================================================== */
(function () {
  'use strict';

  var doc = document, root = doc.documentElement, body = doc.body;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var vw = function (n) { return window.innerWidth * n / 100; };
  var vh = function (n) { return window.innerHeight * n / 100; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var API = window.BarberfieAPI;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var isStatic = reduce || !hasGsap;
  if (isStatic) root.classList.add('is-static');

  /* ==========================================================
     CONTENT (fallbacks; the API overrides services and barbers)
     ========================================================== */
  var SERVICES = [
    { id: null, name: 'Signature Cut', price: 40, minutes: 45, tool: 'shears', desc: 'A tailored cut finished with a straight-razor neckline and styled to leave.' },
    { id: null, name: 'Skin Fade', price: 50, minutes: 50, tool: 'clippers', desc: 'Low, mid or high, blended to the skin with your choice of top.' },
    { id: null, name: 'Beard Sculpt', price: 25, minutes: 25, tool: 'razor', desc: 'Shaping, line-up and conditioning oil so it stays soft.' },
    { id: null, name: 'Hot Towel Shave', price: 35, minutes: 35, tool: 'towel', desc: 'A traditional straight-razor shave with hot towels and balm.' },
    { id: null, name: 'Cut and Beard', price: 60, minutes: 70, tool: 'comb', desc: 'The full refresh, haircut and beard work in one sitting.' }
  ];
  var BARBERS = [
    { id: null, name: 'Kofi', years: 12, spec: 'Skin fades', quote: 'He listens first, then cuts. Best fade in Accra.', img: 'img/barber-1.jpg' },
    { id: null, name: 'Yaw', years: 8, spec: 'Classic cuts and shaves', quote: 'The hot towel shave is worth every cedi.', img: 'img/barber-2.jpg' },
    { id: null, name: 'Nana', years: 6, spec: 'Textured crops', quote: 'Finally someone who understands my curls.', img: 'img/barber-3.jpg' },
    { id: null, name: 'Kwesi', years: 9, spec: 'Beard sculpting', quote: 'My beard has never looked this sharp.', img: 'img/barber-4.jpg' }
  ];
  var WORK = [
    { t: 'Skin fade, full beard', s: 'Fade', b: 'Kofi', img: 'img/cut-skin-fade-beard.jpg' },
    { t: 'Twist top, skin fade', s: 'Textured', b: 'Nana', img: 'img/cut-twist-fade.jpg' },
    { t: '360 waves, tapered beard', s: 'Classic', b: 'Yaw', img: 'img/cut-waves.jpg' },
    { t: 'High top fade', s: 'Fade', b: 'Kofi', img: 'img/cut-high-top-chair.jpg' },
    { t: 'Cornrows and beard', s: 'Beard', b: 'Kwesi', img: 'img/hero-mirror.jpg' },
    { t: 'Low skin fade', s: 'Fade', b: 'Kofi', img: 'img/cut-low-fade.jpg' },
    { t: 'Textured top, tight sides', s: 'Textured', b: 'Nana', img: 'img/cut-textured-top.jpg' },
    { t: 'Buzz cut', s: 'Crop', b: 'Kwesi', img: 'img/cut-buzz.jpg' },
    { t: 'Full beard sculpt', s: 'Beard', b: 'Kwesi', img: 'img/cut-beard-sculpt.jpg' },
    { t: 'Fresh fade, from the back', s: 'Fade', b: 'Kofi', img: 'img/cut-fade-back.jpg' },
    { t: 'Afro shape-up', s: 'Textured', b: 'Nana', img: 'img/cut-afro-shape.jpg' },
    { t: 'Crop and comb', s: 'Crop', b: 'Yaw', img: 'img/cut-crop-comb.jpg' },
    { t: 'Line-up', s: 'Classic', b: 'Yaw', img: 'img/cut-line-up.jpg' },
    { t: 'Beard and waves', s: 'Beard', b: 'Kwesi', img: 'img/cut-beard-waves.jpg' },
    { t: 'Mid fade with clippers', s: 'Fade', b: 'Kofi', img: 'img/cut-fade-clippers.jpg' },
    { t: 'Blonde curls, faded', s: 'Textured', b: 'Nana', img: 'img/cut-blonde-curls.jpg' },
    { t: 'Classic short', s: 'Classic', b: 'Yaw', img: 'img/cut-classic-short.jpg' },
    { t: 'Twists and beard', s: 'Beard', b: 'Kwesi', img: 'img/cut-twists-beard.jpg' },
    { t: 'The distinguished cut', s: 'Classic', b: 'Yaw', img: 'img/cut-distinguished.jpg' }
  ];
  var TOOL_SVG = {
    shears: '<svg viewBox="0 0 48 48"><circle cx="14" cy="34" r="6"/><circle cx="34" cy="34" r="6"/><path d="M18 30 40 6M30 30 8 6M22 22l4 4"/></svg>',
    clippers: '<svg viewBox="0 0 48 48"><rect x="16" y="14" width="16" height="28" rx="4"/><path d="M14 14h20M12 10h24M18 10V6M24 10V6M30 10V6M22 22v10M26 22v10"/></svg>',
    razor: '<svg viewBox="0 0 48 48"><path d="M8 40 26 22M22 18l8-8 10 10-8 8zM26 14l8 8"/><path d="M6 42l4-4"/></svg>',
    towel: '<svg viewBox="0 0 48 48"><rect x="8" y="16" width="32" height="20" rx="10"/><path d="M8 26h32M16 16v20M32 16v20"/><path d="M18 8c0 3 3 3 3 6M27 8c0 3 3 3 3 6"/></svg>',
    comb: '<svg viewBox="0 0 48 48"><rect x="6" y="18" width="36" height="10" rx="4"/><path d="M10 28v8M15 28v8M20 28v8M25 28v8M30 28v8M35 28v8"/></svg>'
  };
  var STYLE_PATHS = {
    Fade: 'M40 62 Q40 36 60 34 Q80 36 80 62 L78 70 L42 70 Z',
    Crop: 'M38 60 Q40 38 60 36 Q82 38 82 58 L80 66 L40 66 Z',
    Textured: 'M36 62 Q34 40 48 38 Q54 30 62 36 Q74 30 80 42 Q86 56 80 64 L40 66 Z',
    Classic: 'M40 62 Q36 38 60 36 Q86 40 82 60 Q70 54 60 56 Q50 54 40 62 Z',
    Beard: 'M40 60 Q42 40 60 38 Q78 40 80 60 L80 70 L40 70 Z M44 84 Q60 108 76 84 L78 74 L42 74 Z'
  };

  function placeholderSvg(style, seed) {
    var h1 = 20 + (seed * 37) % 30, h2 = h1 + 10;
    return '<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><linearGradient id="bg' + seed + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h1 + ',20%,24%)"/><stop offset="1" stop-color="hsl(' + h2 + ',24%,12%)"/></linearGradient></defs>' +
      '<rect width="120" height="150" fill="url(#bg' + seed + ')"/>' +
      '<ellipse cx="60" cy="140" rx="46" ry="22" fill="#1a1512"/>' +
      '<path d="M44 96 Q60 104 76 96 L82 130 L38 130 Z" fill="#241c17"/>' +
      '<ellipse cx="60" cy="72" rx="22" ry="30" fill="#3b2a20"/>' +
      '<path d="' + (STYLE_PATHS[style] || STYLE_PATHS.Classic) + '" fill="#120d0b"/>' +
      '<ellipse cx="60" cy="52" rx="20" ry="10" fill="rgba(255,255,255,0.05)"/>' +
      '</svg>';
  }

  /* ==========================================================
     TEXT SPLITTING and REVEALS
     ========================================================== */
  $$('[data-split]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var o = doc.createElement('span'); o.className = 'w';
      var n = doc.createElement('span'); n.className = 'wi'; n.textContent = w; n.style.setProperty('--i', i);
      o.appendChild(n); el.appendChild(o);
      if (i < words.length - 1) el.appendChild(doc.createTextNode(' '));
    });
  });
  function setIn(el, on) { if (el) el.classList.toggle('is-in', !!on); }
  /* Once a reveal has played, drop its transition so scroll-driven tweens are not smoothed twice */
  doc.addEventListener('transitionend', function (e) { if (e.target.matches && e.target.matches('[data-reveal].is-in')) e.target.classList.add('is-settled'); });

  /* ==========================================================
     BUILD: services, tools, wall, stations
     ========================================================== */
  var stopsEl = $('#serviceStops'), counterEl = $('#counterTop');
  function buildServices() {
    stopsEl.innerHTML = ''; counterEl.innerHTML = '';
    SERVICES.forEach(function (s, i) {
      var li = doc.createElement('li'); li.className = 'stop'; li.dataset.i = i;
      li.innerHTML =
        '<span class="stop-num">0' + (i + 1) + ' / 0' + SERVICES.length + '</span>' +
        '<h3 class="stop-name">' + s.name + '</h3>' +
        '<span class="stop-price">GH₵ ' + s.price + '</span>' +
        '<p class="stop-desc">' + (s.desc || '') + '</p>' +
        '<span class="stop-meta">' + (s.minutes || 45) + ' minutes</span>' +
        '<a class="ghost stop-book" href="#book" data-book-service="' + i + '">Book this</a>';
      stopsEl.appendChild(li);
      var t = doc.createElement('div'); t.className = 'tool'; t.innerHTML = TOOL_SVG[s.tool] || TOOL_SVG.shears;
      counterEl.appendChild(t);
    });
    if (isStatic) $$('.stop').forEach(function (el) { el.classList.add('is-active', 'is-deep'); });
  }

  var trackEl = $('#wallTrack');
  function buildWall() {
    trackEl.innerHTML = '';
    var depths = ['near', 'mid', 'far', 'mid', 'far', 'near'];
    WORK.forEach(function (w, i) {
      var f = doc.createElement('figure');
      f.className = 'frame ' + depths[i % depths.length]; f.tabIndex = 0; f.dataset.i = i; f.dataset.style = w.s;
      f.setAttribute('aria-label', w.t + ' by ' + w.b);
      f.innerHTML = '<div class="ph">' + placeholderSvg(w.s, i + 1) + (w.img ? '<img src="' + w.img + '" alt="" decoding="async">' : '') + '</div><figcaption><span>' + w.t + '</span><em>' + w.b + '</em></figcaption>';
      trackEl.appendChild(f);
    });
  }

  var stationsEl = $('#stations');
  function buildStations() {
    stationsEl.innerHTML = '';
    BARBERS.forEach(function (b, i) {
      var d = doc.createElement('article'); d.className = 'station'; d.style.setProperty('--i', i % 2);
      d.innerHTML =
        '<div class="station-portrait">' + placeholderSvg('Classic', 20 + i) + (b.img ? '<img src="' + b.img + '" alt="" decoding="async">' : '') + '</div>' +
        '<h3 class="station-name">' + b.name + '</h3>' +
        '<span class="station-spec">' + (b.spec || 'Barber') + (b.years ? ' · ' + b.years + ' yrs' : '') + '</span>' +
        '<p class="station-quote">“' + (b.quote || 'Ask for ' + b.name + '.') + '”</p>' +
        '<a class="ghost station-book" href="#book" data-book-barber="' + i + '">Book with ' + b.name + '</a>';
      stationsEl.appendChild(d);
    });
    if (isStatic) $$('.station').forEach(function (el) { el.classList.add('is-focus'); });
  }

  buildServices(); buildWall(); buildStations();
  /* A photo that fails to load falls back to the drawn placeholder */
  function dropBroken(e) {
    if (e.target.tagName !== 'IMG') return;
    var f = e.target.closest('.frame');
    e.target.remove();
    /* A wall photo that does not exist hides its frame instead of showing a drawing */
    if (f) { f.classList.add('is-hidden'); f.dataset.missing = '1'; if (window.ScrollTrigger) ScrollTrigger.refresh(); }
  }
  trackEl.addEventListener('error', dropBroken, true);
  stationsEl.addEventListener('error', dropBroken, true);
  /* Photos fade in over the drawing once they have loaded */
  function markLoaded(e) { if (e.target.tagName === 'IMG') e.target.classList.add('is-loaded'); }
  trackEl.addEventListener('load', markLoaded, true);
  stationsEl.addEventListener('load', markLoaded, true);

  /* ==========================================================
     API: real services and barbers when the API is reachable
     ========================================================== */
  var apiReady = Promise.resolve(false);
  if (API) {
    apiReady = Promise.all([API.services().catch(function () { return null; }), API.barbers().catch(function () { return null; })])
      .then(function (r) {
        var svc = r[0] && (r[0].services || r[0]), brb = r[1] && (r[1].barbers || r[1]);
        var changed = false;
        if (Array.isArray(svc) && svc.length) {
          var tools = ['shears', 'clippers', 'razor', 'towel', 'comb'];
          SERVICES = svc.slice(0, 6).map(function (s, i) {
            return { id: s.id, name: s.name, price: Number(s.price) || 0, minutes: s.duration || s.duration_minutes || s.minutes || 45, tool: tools[i % tools.length], desc: s.description || '' };
          });
          changed = true;
        }
        if (Array.isArray(brb) && brb.length) {
          BARBERS = brb.slice(0, 6).map(function (b, i) {
            return { id: b.id, name: b.name, years: b.years || null, spec: b.specialty || b.bio || 'Barber', quote: b.quote || (BARBERS[i] && BARBERS[i].quote) || '', img: b.photo || b.image || (BARBERS[i] && BARBERS[i].img) || null };
          });
          changed = true;
        }
        if (changed) { buildServices(); buildStations(); if (hasGsap && !isStatic) ScrollTrigger.refresh(); }
        return true;
      });
  }

  /* ==========================================================
     STAGE: plates, spot, chair, sign
     ========================================================== */
  var plates = {}; $$('.plate').forEach(function (p) { plates[p.dataset.plate] = p; });
  var activePlate = null;
  function showPlate(name) {
    if (activePlate === name) return;
    activePlate = name;
    Object.keys(plates).forEach(function (k) { plates[k].classList.toggle('is-active', k === name); });
  }
  showPlate('street');
  var sign = $('#sign');
  var chairWrap = $('#chairWrap'), chair = $('#chair'), spot = $('#spot');

  /* Sign turns on with two false starts, then holds (hero load) */
  function lightSign() {
    if (isStatic) { sign.style.opacity = 1; return; }
    var seq = [[0, 0], [120, 0.7], [180, 0], [420, 0.9], [480, 0.2], [640, 1]];
    seq.forEach(function (s) { setTimeout(function () { sign.style.opacity = s[1]; }, s[0]); });
    setTimeout(function () { sign.classList.add('is-lit'); }, 700);
  }

  /* ==========================================================
     STATIC MODE: show everything, wire the basics, stop here
     ========================================================== */
  function wireCommon() {
    /* Year, hours, open status */
    var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
    var HOURS = { 0: [12, 18], 1: [8, 20], 2: [8, 20], 3: [8, 20], 4: [8, 20], 5: [8, 20], 6: [8, 21] };
    var now = new Date(), today = HOURS[now.getDay()], h = now.getHours() + now.getMinutes() / 60;
    var fmt = function (x) { return ((x % 12) || 12) + ':00 ' + (x < 12 ? 'AM' : 'PM'); };
    var th = $('#todayHours'); if (th && today) th.textContent = fmt(today[0]) + ' – ' + fmt(today[1]);
    var st = $('#openStatus');
    if (st && today) { var open = h >= today[0] && h < today[1]; st.textContent = open ? 'Open now' : 'Closed now'; st.classList.add(open ? 'is-open' : 'is-closed'); }

    /* Signed-in visitors get their dashboard instead of Sign in */
    if (API && API.isSignedIn()) {
      var me = API.getUser(), dest = me && me.role === 'admin' ? '../admin/admin.html' : '../dashboard/dashboard.html';
      $$('[data-account]').forEach(function (a) { a.href = dest; a.textContent = 'My bookings'; });
    }
  }
  wireCommon();
  lightSign();

  /* ==========================================================
     BOOKING FORM (works in both modes)
     ========================================================== */
  if ($('#bookForm')) {
    var form = $('#bookForm'), fService = $('#fService'), fBarber = $('#fBarber'), fDate = $('#fDate'), fTime = $('#fTime');
    var note = $('#formNote'), confirmBox = $('#bookConfirm');
    var params = new URLSearchParams(location.search);
    var pre = { service: params.get('service'), barber: params.get('barber') };
  
    function fillSelects() {
      fService.innerHTML = SERVICES.map(function (s, i) { return '<option value="' + i + '">' + s.name + ' · GH₵ ' + s.price + '</option>'; }).join('');
      fBarber.innerHTML = '<option value="">Any barber</option>' + BARBERS.map(function (b, i) { return '<option value="' + i + '">' + b.name + ' · ' + (b.spec || '') + '</option>'; }).join('');
      if (pre.service !== null) { var si = SERVICES.findIndex(function (s) { return String(s.id) === pre.service || s.name === pre.service; }); if (si >= 0) fService.value = si; }
      if (pre.barber !== null) { var bi = BARBERS.findIndex(function (b) { return String(b.id) === pre.barber || b.name === pre.barber; }); if (bi >= 0) fBarber.value = bi; }
    }
    fillSelects();
    apiReady.then(fillSelects);
    var todayIso = new Date().toISOString().slice(0, 10);
    fDate.min = todayIso;
  
    function setNote(msg, err) { note.textContent = msg || ''; note.classList.toggle('is-error', !!err); }
    function defaultSlots(date) {
      var dow = new Date(date + 'T00:00:00').getDay(), H = { 0: [12, 18], 6: [8, 21] }[dow] || [8, 20], out = [];
      for (var h = H[0]; h < H[1]; h++) out.push({ time: (h < 10 ? '0' : '') + h + ':00', available: true });
      return out;
    }
    function renderSlots(slots) {
      var free = slots.filter(function (s) { return s.available !== false; });
      fTime.innerHTML = free.length ? free.map(function (s) { return '<option value="' + s.time + '">' + (API ? API.to12h(s.time) : s.time) + '</option>'; }).join('') : '<option value="">No free slots that day</option>';
    }
    function loadSlots() {
      var date = fDate.value; if (!date) return;
      fTime.innerHTML = '<option value="">Checking…</option>';
      var b = BARBERS[fBarber.value];
      var p = API ? API.availability(date, b && b.id ? b.id : undefined).then(function (d) { return d.slots || d; }).catch(function () { return null; }) : Promise.resolve(null);
      p.then(function (slots) { renderSlots(Array.isArray(slots) && slots.length ? slots : defaultSlots(date)); });
    }
    fDate.addEventListener('change', loadSlots);
    fBarber.addEventListener('change', loadSlots);
  
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var s = SERVICES[fService.value], b = BARBERS[fBarber.value] || null;
      if (!s || !fDate.value || !fTime.value) { setNote('Pick a service, a date and a time.', true); return; }
      var summary = s.name + (b ? ' with ' + b.name : '') + ', ' + fDate.value + ' at ' + (API ? API.to12h(fTime.value) : fTime.value);
      if (!API || !API.isSignedIn()) {
        var next = location.pathname + '?service=' + encodeURIComponent(s.id || s.name) + (b ? '&barber=' + encodeURIComponent(b.id || b.name) : '') + '#book';
        setNote('Sign in to hold the chair. Bringing you back here after.');
        setTimeout(function () { location.href = '../auth/login.html?next=' + encodeURIComponent(next); }, 600);
        return;
      }
      if (!s.id) { setNote('The booking service is offline right now. Call us and we will hold the chair.', true); return; }
      $('#bookSubmit').disabled = true; setNote('Holding the chair…');
      API.createBooking({ serviceId: s.id, barberId: b && b.id ? b.id : undefined, date: fDate.value, time: fTime.value })
        .then(function () {
          form.hidden = true; confirmBox.hidden = false; $('#confirmSummary').textContent = summary;
          sign.style.opacity = 1;
          if (sound.on) sound.snip();
        })
        .catch(function (err) { setNote(err.message || 'That did not go through. Try another time.', true); })
        .then(function () { $('#bookSubmit').disabled = false; });
    });
  
    /* Deep links from Services and Barbers preselect the form */
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('[data-book-service], [data-book-barber]');
      if (!a) return;
      if (a.dataset.bookService !== undefined) fService.value = a.dataset.bookService;
      if (a.dataset.bookBarber !== undefined) fBarber.value = a.dataset.bookBarber;
      if (fDate.value) loadSlots();
    });
  }

  /* Book a chair: signed-in visitors go straight to their dashboard to book; others sign in first.
     A service or barber picked higher up the page rides along so the dashboard can preselect it. */
  (function () {
    var link = $('[data-book-link]'); if (!link) return;
    var picked = { service: null, barber: null };
    function dest() {
      var signedIn = API && API.isSignedIn(), me = signedIn ? API.getUser() : null;
      var dash = me && me.role === 'admin' ? '../admin/admin.html' : '../dashboard/dashboard.html';
      var qs = [];
      if (picked.service) qs.push('service=' + encodeURIComponent(picked.service));
      if (picked.barber) qs.push('barber=' + encodeURIComponent(picked.barber));
      var target = dash + (qs.length ? '?' + qs.join('&') : '');
      return signedIn ? target : '../auth/login.html?next=' + encodeURIComponent(target);
    }
    function refresh() { link.href = dest(); }
    refresh();
    if (API && API.isSignedIn()) { var su = $('[data-signup-link]'); if (su) su.hidden = true; }
    doc.addEventListener('click', function (e) {
      var el = e.target.closest('[data-book-service], [data-book-barber]'); if (!el) return;
      if (el.dataset.bookService !== undefined && SERVICES[el.dataset.bookService]) picked.service = SERVICES[el.dataset.bookService].id || SERVICES[el.dataset.bookService].name;
      if (el.dataset.bookBarber !== undefined && BARBERS[el.dataset.bookBarber]) picked.barber = BARBERS[el.dataset.bookBarber].id || BARBERS[el.dataset.bookBarber].name;
      refresh();
    });
  })();

  /* ==========================================================
     SOUND (opt-in): room tone, clipper hum, snip
     ========================================================== */
  var sound = { on: false, ctx: null, room: null, hum: null };
  sound.start = function () {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    if (!sound.ctx) sound.ctx = new AC();
    var ctx = sound.ctx, len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    var g = ctx.createGain(); g.gain.value = 0; src.connect(lp).connect(g).connect(ctx.destination); src.start();
    g.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1.5);
    sound.room = { src: src, g: g };
    ctx.resume();
  };
  sound.stop = function () { if (sound.room) { var g = sound.room.g, s = sound.room.src; g.gain.linearRampToValueAtTime(0, sound.ctx.currentTime + 0.6); setTimeout(function () { try { s.stop(); } catch (e) { /* ignore */ } }, 700); sound.room = null; } sound.humOff(); };
  sound.humOn = function () {
    if (!sound.on || sound.hum) return; var ctx = sound.ctx;
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 110; o2.type = 'square'; o2.frequency.value = 220.7;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; g.gain.value = 0;
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(ctx.destination); o.start(); o2.start();
    g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.25); sound.hum = { o: o, o2: o2, g: g };
  };
  sound.humOff = function () { if (!sound.hum) return; var h = sound.hum, t = sound.ctx.currentTime; h.g.gain.linearRampToValueAtTime(0, t + 0.3); setTimeout(function () { h.o.stop(); h.o2.stop(); }, 350); sound.hum = null; };
  sound.snip = function () {
    if (!sound.on) return; var ctx = sound.ctx, len = ctx.sampleRate * 0.08, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    var s = ctx.createBufferSource(); s.buffer = buf; var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    var g = ctx.createGain(); g.gain.value = 0.5; s.connect(hp).connect(g).connect(ctx.destination); s.start();
  };
  var soundBtn = $('#soundToggle');
  soundBtn.addEventListener('click', function () {
    sound.on = !sound.on; soundBtn.setAttribute('aria-pressed', sound.on); soundBtn.setAttribute('aria-label', sound.on ? 'Turn sound off' : 'Turn sound on');
    if (sound.on) sound.start(); else sound.stop();
  });
  doc.addEventListener('click', function (e) { if (e.target.closest('.cta') && sound.on) sound.snip(); });

  if (isStatic) {
    $$('[data-split]').forEach(function (el) { el.classList.add('is-in'); });
    $$('[data-reveal]').forEach(function (el) { el.classList.add('is-in'); });
    $('#proof').classList.add('is-in');
    return;
  }

  /* ==========================================================
     SCROLL SYSTEM: Lenis + GSAP ScrollTrigger
     ========================================================== */
  gsap.registerPlugin(ScrollTrigger);
  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, touchMultiplier: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  var SCRUB = 0.8;
  var isTouch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var narrow = function () { return window.innerWidth < 900; };

  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.2, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }
  function sceneTarget(hash) {
    var el = $(hash); if (!el) return null;
    var top = el.getBoundingClientRect().top + window.scrollY;
    if (hash === '#book') top += el.offsetHeight - window.innerHeight; /* land at the end of the pin: chair settled, form below */
    return top;
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]'); if (!a) return;
    var hash = a.getAttribute('href'); if (hash.length < 2) return;
    var y = sceneTarget(hash); if (y === null) return;
    e.preventDefault(); scrollToY(y); history.replaceState(null, '', hash);
  });

  /* Scene index and plates follow whichever scene is on screen */
  var indexLinks = {}; $$('.scene-index a').forEach(function (a) { indexLinks[a.dataset.scene] = a; });
  function setScene(name, plate) {
    showPlate(plate);
    Object.keys(indexLinks).forEach(function (k) { indexLinks[k].classList.toggle('is-active', k === name); });
    body.classList.toggle('in-booking', name === 'book');
  }
  $$('.scene').forEach(function (sec) {
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: function (st) { if (st.isActive) setScene(sec.dataset.scene, sec.dataset.plate); }
    });
  });

  /* Nav: slim line on scroll down, back on scroll up */
  var nav = $('#nav'), lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: function (st) {
      var y = st.scroll();
      nav.classList.toggle('is-hidden', y > 120 && y > lastY + 4);
      if (y < lastY - 4 || y <= 120) nav.classList.remove('is-hidden');
      lastY = y;
    }
  });

  function sceneTl(id, extra) {
    return gsap.timeline({ scrollTrigger: Object.assign({ trigger: id, start: 'top top', end: 'bottom bottom', scrub: SCRUB, invalidateOnRefresh: true }, extra || {}) });
  }
  function titleGate(tl, id, at) {
    var title = $(id + ' .scene-title'), curtain = $(id + ' .curtain');
    tl.eventCallback('onUpdate', function () { setIn(title, tl.progress() > (at || 0.06)); });
    if (curtain) tl.fromTo(curtain, { scaleX: 0 }, { scaleX: 1, duration: 0.15, ease: 'none' }, 0);
  }

  /* ---------- Scene 1: Street ---------- */
  var hero = $('#hero');

  var heroTl = sceneTl('#hero');
  heroTl
    .to({}, { duration: 0.3 }) /* plateau: rain and sign only */
    .to('.plate-street .rain', { scale: 1.6, opacity: 0, duration: 0.45, ease: 'power2.in' }, 0.3)
    .to('.plate-street .street', { yPercent: 40, opacity: 0, duration: 0.45, ease: 'power2.in' }, 0.3)
    .to('.plate-street .facade', { scale: 1.3, opacity: 0, duration: 0.45, ease: 'power1.in' }, 0.3)
    .to('.plate-street .window', { scale: 2.6, xPercent: -20, yPercent: 10, opacity: 0, duration: 0.5, ease: 'power2.in' }, 0.3)
    .to('.plate-street .sky', { scale: 1.2, opacity: 0.2, duration: 0.6, ease: 'none' }, 0.3)
    .to('.plate-street .photo', { scale: 1.25, opacity: 0, duration: 0.5, ease: 'power2.in' }, 0.3)
    .to(sign, { yPercent: -160, opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.45)
    .to('.hero-copy', { yPercent: -40, opacity: 0, duration: 0.25, ease: 'power2.in' }, 0.6)
    .to('.hero-hours', { yPercent: 30, opacity: 0, duration: 0.25, ease: 'power2.in' }, 0.6)
    .to('.scroll-hint', { opacity: 0, duration: 0.1 }, 0.3);
  heroTl.eventCallback('onUpdate', function () { if (heroTl.progress() > 0.9) showPlate('interior'); else if (activePlate !== 'street' && heroTl.progress() < 0.9) showPlate('street'); });

  /* Hero copy reveals on load */
  setTimeout(function () { setIn($('#hero-title'), true); }, 500);
  $$('#hero [data-reveal]').forEach(function (el, i) { setTimeout(function () { el.classList.add('is-in'); }, 900 + i * 160); });

  /* ---------- Scene 2: The chair (Services) ---------- */
  var stops = function () { return $$('#serviceStops .stop'); };
  var tools = function () { return $$('#counterTop .tool'); };
  var svcTl = sceneTl('#services');
  titleGate(svcTl, '#services');
  svcTl
    .fromTo('#serviceProgress', { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'none' }, 0);
  var lastStop = -1;
  svcTl.eventCallback('onUpdate', function () {
    var p = svcTl.progress(), n = SERVICES.length;
    setIn($('#services-title'), p > 0.06);
    var span = 0.75, u = clamp((p - 0.1) / span, 0, 0.9999), idx = Math.floor(u * n), sub = (u * n) - idx;
    if (p < 0.1) idx = -1;
    if (p >= 0.85) idx = n - 1;
    var deep = idx >= 0 && (sub > 0.45 || p >= 0.85);
    stops().forEach(function (el, i) { el.classList.toggle('is-active', i === idx); el.classList.toggle('is-deep', i === idx && deep); });
    tools().forEach(function (el, i) { el.classList.toggle('is-up', i === idx); });
    if (idx !== lastStop) { lastStop = idx; if (sound.on && idx >= 0 && SERVICES[idx].tool === 'clippers') sound.humOn(); else sound.humOff(); }
  });

  /* ---------- Scene 3: The mirror wall (Portfolio) ---------- */
  var wallTl = sceneTl('#work');
  titleGate(wallTl, '#work');
  var trackDistance = function () { return Math.max(0, trackEl.scrollWidth - window.innerWidth + vw(20)); };
  wallTl
    .fromTo(trackEl, { x: 0 }, { x: function () { return -trackDistance(); }, duration: 0.65, ease: 'none', immediateRender: false }, 0.15)
    .fromTo('#wallProgress', { scaleX: 0 }, { scaleX: 1, duration: 0.65, ease: 'none' }, 0.15)
    .to(trackEl, { x: function () { return -trackDistance() - vw(60); }, duration: 0.2, ease: 'power1.in' }, 0.8);
  /* per-depth drift: near frames slide faster than far ones */
  wallTl.eventCallback('onUpdate', function () {
    setIn($('#work-title'), wallTl.progress() > 0.06);
    var x = gsap.getProperty(trackEl, 'x') || 0;
    $$('.frame', trackEl).forEach(function (f) {
      var k = f.classList.contains('near') ? 0.12 : f.classList.contains('far') ? -0.10 : 0;
      f.style.setProperty('--px', (x * k) + 'px');
    });
  });

  /* Hover racks focus; click expands */
  trackEl.addEventListener('mouseover', function (e) { var f = e.target.closest('.frame'); if (!f) return; trackEl.classList.add('has-focus'); $$('.frame.is-focus', trackEl).forEach(function (o) { o.classList.remove('is-focus'); }); f.classList.add('is-focus'); });
  trackEl.addEventListener('mouseleave', function () { trackEl.classList.remove('has-focus'); $$('.frame.is-focus', trackEl).forEach(function (o) { o.classList.remove('is-focus'); }); });
  trackEl.addEventListener('mousemove', function (e) { var f = e.target.closest('.frame'); if (!f) return; var r = f.getBoundingClientRect(); f.style.setProperty('--ry', (((e.clientX - r.left) / r.width) - 0.5) * 6 + 'deg'); });

  $$('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('.chip').forEach(function (o) { o.classList.remove('is-active'); }); c.classList.add('is-active');
      var f = c.dataset.filter;
      $('.frame', trackEl).forEach(function (fr) { fr.classList.toggle('is-hidden', fr.dataset.missing === '1' || (f !== 'all' && fr.dataset.style !== f)); });
      ScrollTrigger.refresh();
    });
  });

  /* Lightbox */
  var lb = $('#lightbox'), lbIdx = 0, lastFocus = null;
  function visibleFrames() { return $$('.frame:not(.is-hidden)', trackEl); }
  function openLb(frame) {
    var frames = visibleFrames(); lbIdx = frames.indexOf(frame); if (lbIdx < 0) return;
    lastFocus = frame; renderLb(); lb.hidden = false; if (lenis) lenis.stop(); $('#lightboxClose').focus();
  }
  function renderLb() {
    var frames = visibleFrames(), f = frames[lbIdx], w = WORK[f.dataset.i];
    $('#lightboxImg').innerHTML = $('.ph', f).innerHTML;
    $('#lightboxTitle').textContent = w.t; $('#lightboxMeta').textContent = w.s + ' · by ' + w.b;
    var bi = BARBERS.findIndex(function (b) { return b.name === w.b; });
    var link = $('#lightboxBook'); link.textContent = 'Book with ' + w.b; link.dataset.bookBarber = bi >= 0 ? bi : '';
  }
  function closeLb() { lb.hidden = true; if (lenis) lenis.start(); if (lastFocus) lastFocus.focus(); }
  trackEl.addEventListener('click', function (e) { var f = e.target.closest('.frame'); if (f) openLb(f); });
  trackEl.addEventListener('keydown', function (e) { var f = e.target.closest('.frame'); if (f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openLb(f); } });
  $('#lightboxClose').addEventListener('click', closeLb);
  $('#lightboxBook').addEventListener('click', closeLb);
  $('#lightboxPrev').addEventListener('click', function () { var n = visibleFrames().length; lbIdx = (lbIdx - 1 + n) % n; renderLb(); });
  $('#lightboxNext').addEventListener('click', function () { var n = visibleFrames().length; lbIdx = (lbIdx + 1) % n; renderLb(); });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  doc.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') $('#lightboxPrev').click();
    if (e.key === 'ArrowRight') $('#lightboxNext').click();
    if (e.key === 'Tab') { var f = $$('button, a', lb), first = f[0], last = f[f.length - 1]; if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); } }
  });

  /* ---------- Scene 4: The counter (Barbers) ---------- */
  var barTl = sceneTl('#barbers');
  titleGate(barTl, '#barbers');
  var stationDistance = function () { return Math.max(0, stationsEl.scrollWidth - window.innerWidth + vw(20)); };
  barTl
    .fromTo(stationsEl, { x: 0 }, { x: function () { return -stationDistance(); }, duration: 0.75, ease: 'none', immediateRender: false }, 0.1);
  barTl.eventCallback('onUpdate', function () {
    var p = barTl.progress(), n = BARBERS.length;
    setIn($('#barbers-title'), p > 0.06);
    var u = clamp((p - 0.1) / 0.75, 0, 0.9999), idx = p < 0.08 ? -1 : Math.floor(u * n);
    $$('.station', stationsEl).forEach(function (el, i) { el.classList.toggle('is-focus', i === idx || p >= 0.85); });
    $('#proof').classList.toggle('is-in', p > 0.82);
  });

  /* ---------- Scene 5: The empty chair (Booking) ---------- */
  var bookTl = sceneTl('#book');
  bookTl
    .to('.plate-interior', { opacity: 0, duration: 0.3 }, 0)
    .to({}, { duration: 0.6 });
  bookTl.eventCallback('onUpdate', function () { setIn($('#book-title'), bookTl.progress() > 0.25); });
  var footerST = ScrollTrigger.create({ trigger: '.book-details', start: 'top 90%', end: 'top 40%' });

  /* ==========================================================
     THE CHAIR and THE SPOTLIGHT: one function of scroll position
     Scene timelines never touch them, so two scrubbing scenes can
     never fight over the same transform. The state is eased toward
     its target every frame, which gives the same lag as the scrub.
     ========================================================== */
  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var seg = function (p, a, b, ease) { var t = clamp((p - a) / (b - a), 0, 1); return ease ? ease(t) : t; };
  var mix = function (from, to, t) { var o = {}; Object.keys(from).forEach(function (k) { o[k] = from[k] + (to[k] - from[k]) * t; }); return o; };
  var K = function () {
    var n = narrow();
    return {
      street: { x: vw(n ? 23 : 22), y: vh(n ? -20 : -4), s: 0.34, o: plates.street.classList.contains('has-photo') ? 0 : 0.9, b: 0.6, r: 0 },
      seat: { x: vw(n ? 30 : 18), y: vh(n ? 8 : 4), s: 1, o: 1, b: 0, r: 0 },
      seatEnd: { x: vw(n ? 32 : 22), y: vh(n ? 8 : 4), s: 1, o: 1, b: 0, r: 0 },
      wall: { x: vw(-34), y: vh(22), s: 0.8, o: 0.45, b: 3, r: 0 },
      gone: { x: vw(-34), y: vh(22), s: 0.8, o: 0, b: 3, r: 0 },
      empty: { x: 0, y: vh(14), s: 0.9, o: 1, b: 0, r: 0 },
      spotStreet: { x: vw(22), y: vh(-8), s: 0.7, o: 0.6 },
      spotSeat: { x: vw(18), y: 0, s: 1, o: 1 },
      spotSeatEnd: { x: vw(22), y: 0, s: 1, o: 1 },
      spotWall: { x: 0, y: vh(-10), s: 1.3, o: 0.5 },
      spotCounter: { x: vw(10), y: 0, s: 1, o: 0.8 },
      spotCounterEnd: { x: vw(-10), y: 0, s: 1, o: 0.8 },
      spotEmpty: { x: 0, y: vh(14), s: 0.55, o: 1 }
    };
  };
  function targets() {
    var k = K(), st = [heroTl, svcTl, wallTl, barTl, bookTl].map(function (t) { return t.scrollTrigger.progress; });
    var h = st[0], sv = st[1], wk = st[2], br = st[3], bk = st[4], ft = footerST.progress;
    var chairT, spotT;
    if (bk > 0) {
      chairT = mix(k.gone, k.empty, seg(bk, 0, 0.4, easeOut)); spotT = mix(k.spotWall, k.spotEmpty, seg(bk, 0, 0.4, easeOut));
      if (ft > 0) chairT.o = 1 - 0.75 * ft;
    } else if (br > 0) {
      chairT = k.gone; spotT = mix(mix(k.spotWall, k.spotCounter, seg(br, 0, 0.3)), k.spotCounterEnd, seg(br, 0.3, 0.85));
    } else if (wk > 0) {
      chairT = mix(k.seatEnd, k.wall, seg(wk, 0, 0.15, easeInOut)); chairT.o *= 1 - seg(wk, 0.8, 0.9);
      spotT = mix(k.spotSeatEnd, k.spotWall, seg(wk, 0, 0.15));
    } else if (sv > 0) {
      chairT = mix(k.seat, k.seatEnd, seg(sv, 0.1, 0.85));
      chairT.r = sv < 0.85 ? -55 + 110 * seg(sv, 0.1, 0.85) : 55 * (1 - seg(sv, 0.85, 1, easeOut));
      spotT = mix(k.spotSeat, k.spotSeatEnd, seg(sv, 0.1, 0.85));
    } else {
      chairT = mix(k.street, k.seat, seg(h, 0.45, 1, easeInOut)); spotT = mix(k.spotStreet, k.spotSeat, seg(h, 0.45, 1));
    }
    return { chair: chairT, spot: spotT };
  }
  var cur = targets(), LAG = 0.1;
  gsap.set(chairWrap, { x: cur.chair.x, y: cur.chair.y, scale: cur.chair.s, opacity: cur.chair.o, filter: 'blur(' + cur.chair.b + 'px)' });
  gsap.ticker.add(function () {
    var t = targets();
    cur.chair = mix(cur.chair, t.chair, LAG); cur.spot = mix(cur.spot, t.spot, LAG);
    gsap.set(chairWrap, { x: cur.chair.x, y: cur.chair.y, scale: cur.chair.s, opacity: cur.chair.o, filter: 'blur(' + (cur.chair.b < 0.05 ? 0 : cur.chair.b.toFixed(2)) + 'px)' });
    gsap.set(chair, { rotationY: cur.chair.r });
    gsap.set(spot, { x: cur.spot.x, y: cur.spot.y, scale: cur.spot.s, opacity: cur.spot.o });
  });

  /* ==========================================================
     POINTER PARALLAX (desktop): plates tilt toward the cursor
     ========================================================== */
  var px = 0, py = 0, tx = 0, ty = 0;
  if (!isTouch) {
    doc.addEventListener('mousemove', function (e) { tx = (e.clientX / window.innerWidth - 0.5); ty = (e.clientY / window.innerHeight - 0.5); }, { passive: true });
    gsap.ticker.add(function () {
      px += (tx - px) * 0.06; py += (ty - py) * 0.06;
      var active = plates[activePlate]; if (!active) return;
      $$('.layer', active).forEach(function (l, i) {
        var k = 6 + i * 5; l.style.translate = (-px * k) + 'px ' + (-py * k) + 'px';
      });
    });
  } else if (window.DeviceOrientationEvent) {
    /* gyroscope on touch, gentle and low-passed */
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma === null) return;
      tx = clamp(e.gamma / 45, -1, 1) * 0.5; ty = clamp((e.beta - 40) / 45, -1, 1) * 0.5;
    }, { passive: true });
    gsap.ticker.add(function () {
      px += (tx - px) * 0.05; py += (ty - py) * 0.05;
      var active = plates[activePlate]; if (!active) return;
      $('.layer', active).forEach(function (l, i) { var k = 4 + i * 3; l.style.translate = (-px * k) + 'px ' + (-py * k) + 'px'; });
    });
  }

  /* ==========================================================
     CURSOR and MAGNETIC CTA (desktop)
     ========================================================== */
  var cursor = $('#cursor');
  if (!isTouch && cursor) {
    /* The custom brass cursor is switched off: the normal system pointer is used. Hover and magnet effects stay. */
    var cx = 0, cy = 0, rx = 0, ry = 0, dot = $('.cursor-dot', cursor), ring = $('.cursor-ring', cursor);
    doc.addEventListener('mousemove', function (e) { cx = e.clientX; cy = e.clientY; }, { passive: true });
    gsap.ticker.add(function () {
      rx += (cx - rx) * 0.15; ry += (cy - ry) * 0.15;
      dot.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
    });
    doc.addEventListener('mouseover', function (e) {
      cursor.classList.toggle('is-view', !!e.target.closest('.frame'));
      cursor.classList.toggle('is-link', !e.target.closest('.frame') && !!e.target.closest('a, button, select, input, .chip'));
    });
    doc.addEventListener('mouseleave', function () { cursor.style.opacity = 0; });
    doc.addEventListener('mouseenter', function () { cursor.style.opacity = 1; });

    $$('[data-magnet]').forEach(function (btn) {
      var R = 120;
      doc.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2;
        var dx = e.clientX - mx, dy = e.clientY - my, d = Math.hypot(dx, dy);
        if (d < R) {
          var k = (1 - d / R) * 8;
          btn.style.transform = 'translate(' + (dx / d * k) + 'px,' + (dy / d * k) + 'px)';
          btn.style.setProperty('--lx', ((e.clientX - r.left) / r.width * 100) + '%');
          btn.style.setProperty('--ly', ((e.clientY - r.top) / r.height * 100) + '%');
        } else if (btn.style.transform) { btn.style.transform = ''; }
      }, { passive: true });
    });
  }

  /* Service rows: hovering a stop lifts its tool */
  stopsEl.addEventListener('mouseover', function (e) { var s = e.target.closest('.stop'); if (!s) return; tools().forEach(function (t, i) { t.classList.toggle('is-up', i === +s.dataset.i); }); });

  /* Keep everything measured after fonts and layout settle */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  if (location.hash && $(location.hash)) setTimeout(function () { var y = sceneTarget(location.hash); if (y !== null) scrollToY(y); }, 300);
})();
