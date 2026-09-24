/**
 * Smooth / inertial page scroll (Lenis). Skipped in theme editor and when user prefers reduced motion.
 */
(function () {
  'use strict';

  if (typeof Lenis === 'undefined') return;
  if (typeof Shopify !== 'undefined' && Shopify.designMode) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var lenis = new Lenis({
    lerp: 0.085,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.2,
    autoResize: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  function isScrollLocked() {
    var html = document.documentElement;
    var body = document.body;
    if (html.classList.contains('overflow-hidden') || body.classList.contains('overflow-hidden')) {
      return true;
    }
    if (
      body.classList.contains('fc-search-open') ||
      body.classList.contains('menu-open') ||
      body.classList.contains('fc-cart-open')
    ) {
      return true;
    }
    var search = document.getElementById('fc-search-overlay');
    if (search && search.classList.contains('fc-search--open')) return true;
    var drawer = document.querySelector('cart-drawer.drawer.active');
    if (drawer) return true;
    return false;
  }

  function syncLenisPause() {
    if (isScrollLocked()) lenis.stop();
    else lenis.start();
  }

  var mo = new MutationObserver(function () {
    syncLenisPause();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('DOMContentLoaded', function () {
    var search = document.getElementById('fc-search-overlay');
    if (search) {
      mo.observe(search, { attributes: true, attributeFilter: ['class'] });
    }
    var cartDrawer = document.querySelector('cart-drawer');
    if (cartDrawer) {
      mo.observe(cartDrawer, { attributes: true, attributeFilter: ['class', 'open'] });
    }
    syncLenisPause();
  });

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link || link.getAttribute('href') === '#') return;
    var id = link.getAttribute('href').slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0, duration: 1.1 });
  });

  window.fcLenis = lenis;
})();
