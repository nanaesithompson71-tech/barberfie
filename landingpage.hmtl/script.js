/* ==========================================================
   BARBERFIE - shared JavaScript
   Loaded on every page. Keeps the site usable without
   depending on any library.
   ========================================================== */

(function () {
  'use strict';

  /* ---------- 1. Mobile menu toggle ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');

  function closeMenu() {
    if (!nav || !toggle) return;
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Menu';
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Close' : 'Menu';
    });

    // Close the menu after choosing a link on mobile
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    // Close the menu with the Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        closeMenu();
        toggle.focus();
      }
    });

    // Close the menu when clicking outside of it
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('open')) return;
      if (!nav.contains(e.target) && !toggle.contains(e.target)) {
        closeMenu();
      }
    });

    // Reset if the window is resized back to desktop width
    window.addEventListener('resize', function () {
      if (window.innerWidth > 720) closeMenu();
    });
  }

  /* ---------- 2. Highlight the current nav link while scrolling ---------- */
  var sections = document.querySelectorAll('main section[id]');
  var navLinks = document.querySelectorAll('.nav-list a[href^="#"]');

  if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.getAttribute('id');
        navLinks.forEach(function (link) {
          var matches = link.getAttribute('href') === '#' + id;
          if (matches) {
            link.setAttribute('aria-current', 'location');
          } else if (link.getAttribute('aria-current') === 'location') {
            link.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });

    sections.forEach(function (section) { observer.observe(section); });
  }

  /* ---------- 3. Show whether the shop is open right now ---------- */
  // Hours: [openHour, closeHour] in 24h format, index 0 = Sunday.
  var HOURS = {
    0: [12, 18], // Sunday
    1: [8, 20],  // Monday
    2: [8, 20],
    3: [8, 20],
    4: [8, 20],
    5: [8, 20],  // Friday
    6: [8, 21]   // Saturday
  };

  var statusEl = document.getElementById('open-status');
  if (statusEl) {
    var now = new Date();
    var today = HOURS[now.getDay()];
    var hour = now.getHours() + now.getMinutes() / 60;
    var isOpen = today && hour >= today[0] && hour < today[1];

    statusEl.textContent = isOpen ? 'Open now' : 'Closed now';
    statusEl.classList.add(isOpen ? 'is-open' : 'is-closed');
  }

  /* ---------- 4. Back-to-top button ---------- */
  var topBtn = document.querySelector('.back-to-top');
  if (topBtn) {
    window.addEventListener('scroll', function () {
      topBtn.classList.toggle('show', window.scrollY > 500);
    }, { passive: true });

    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- 5. Keep the footer year current ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

})();
